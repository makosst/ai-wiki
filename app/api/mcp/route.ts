import { z } from 'zod';
import { createMcpHandler } from 'mcp-handler';
import { WikiService } from '@/lib/wiki-service';
import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const handler = createMcpHandler(
  (server) => {
    const singleContributionSchema = z.object({
      fileName: z.string().describe('The name of the file (e.g., "shadcn-guide.md")'),
      content: z.string().describe('The file content as a string'),
      route: z.string().describe('The route path for this content (e.g., "shadcn/installation", "backend/nodejs/express")'),
      contentType: z
        .string()
        .optional()
        .describe('MIME type of the file (e.g., "text/markdown"). Defaults to "text/plain"'),
    });

    // Contribution tool temporarily disabled in favor of API-only submissions.
    /*
    server.tool(
      'contribute',
      'Upload content directly to the AI wiki and map it to one or more routes. Provide either a single contribution object or an array under "contributions".',
      { contributions: z.array(singleContributionSchema).min(1).describe('List of contributions to upload and map in a single call.') },
      async ({ contributions }) => {
        const results = await WikiService.contribute(contributions);

        const successCount = results.filter((result) => result.success).length;
        const failureCount = results.length - successCount;

        const summaryLines = [
          `Processed ${results.length} contribution${results.length === 1 ? '' : 's'}.`,
          `Successful: ${successCount}.`,
          `Failed: ${failureCount}.`,
          '',
          ...results.map((result) =>
            result.success
              ? `SUCCESS - ${result.message} (file name: ${result.fileName})`
              : `ERROR - ${result.message}`,
          ),
        ];

        return {
          content: [
            {
              type: 'text',
              text: summaryLines.join('\n'),
            },
          ],
          isError: failureCount === results.length && results.length > 0,
        };
      },
    );
    */
    // Read tool: Get file by route or search
    server.tool(
      'read',
      'Read content from the AI wiki by route path. Read the empty route to get the overview. Use the .md when trying to read concrete content.',
      {
        route: z.string().describe('The route path to read (e.g., "shadcn/installation") or search terms'),
      },
      async ({ route }, extra) => {
        const result = await WikiService.read(route);

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: result.message || 'Failed to read content',
              },
            ],
            isError: true,
          };
        }

        // If we found exact content
        if (result.content) {
          return {
            content: [
              {
                type: 'text',
                text: `# ${route}\n\nFile: ${result.fileName}\n\n---\n\n${result.content}`,
              },
            ],
          };
        }

        // If we found child routes
        if (result.childRoutes && result.childRoutes.length > 0) {
          const childList = result.childRoutes
            .map((child) => {
              const fileName = child.fileName ? ` (${child.fileName})` : ' (directory)';
              return `- ${child.route}${fileName}`;
            })
            .join('\n');

          return {
            content: [
              {
                type: 'text',
                text: `# ${route}\n\nThis is a directory, found ${result.childRoutes.length} child route(s):\n\n${childList}\n\nUse the exact route path with the 'read' tool to view content.`,
              },
            ],
          };
        }

        // If we found search results
        if (result.searchResults && result.searchResults.length > 0) {
          const searchResultText = result.searchResults
            .map((res, index) =>
              `${index + 1}. Route: ${res.route}\n   File: ${res.fileName}\n   Preview: ${res.snippet}\n`
            )
            .join('\n');

          return {
            content: [
              {
                type: 'text',
                text: `No exact match for "${route}". Here are the top ${result.searchResults.length} search results:\n\n${searchResultText}\n\nUse the exact route path with the 'read' tool to view full content.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `No results found for "${route}".`,
            },
          ],
        };
      },
    );
  },
  {},
  { basePath: '/api' },
);

// Validate API key from request without consuming the body
async function validateApiKeyFromRequest(req: Request): Promise<boolean> {
  // Get API key from header or query parameter
  let apiKey = req.headers.get('aiwiki_api_key');

  if (!apiKey) {
    const url = new URL(req.url);
    apiKey = url.searchParams.get('api_key') || url.searchParams.get('aiwiki_api_key');
  }

  if (!apiKey) {
    console.log('[MCP Auth] No API key provided');
    return false;
  }

  console.log('[MCP Auth] Validating API key:', apiKey.substring(0, 20) + '...');

  // Validate API key against database
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, is_active, user_id')
    .eq('key', apiKey)
    .eq('is_active', true)
    .single();

  if (error) {
    console.log('[MCP Auth] Database error:', error);
    return false;
  }

  if (!data) {
    console.log('[MCP Auth] No matching API key found');
    return false;
  }

  console.log('[MCP Auth] Valid API key found for user:', data.user_id);

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return true;
}

// Wrap the handler with authentication
async function authenticatedHandler(req: Request) {
  // Allow OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, aiwiki_api_key',
      },
    });
  }

  const isValid = await validateApiKeyFromRequest(req);

  if (!isValid) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or missing API key. Please provide a valid API key in the aiwiki_api_key header or as a query parameter (?api_key=xxx).'
      },
      { status: 401 }
    );
  }

  return handler(req);
}

export {
  authenticatedHandler as GET,
  authenticatedHandler as POST,
  authenticatedHandler as DELETE,
  authenticatedHandler as OPTIONS
};
