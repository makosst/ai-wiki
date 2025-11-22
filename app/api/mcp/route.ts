import { z } from 'zod';
import { createMcpHandler } from 'mcp-handler';
import { WikiService } from '@/lib/wiki-service';
import { WorkflowService, createWorkflowSchema, updateWorkflowSchema } from '@/lib/workflow-service';
import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const handler = createMcpHandler(
  (server) => {
    // Get user_id from context (set during authentication)
    const getUserId = (extra: any): string => {
      // The extra parameter contains the request object
      const req = extra?.request as Request;
      return req?.headers?.get('x-user-id') || '';
    };
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

    // Workflow tools
    server.tool(
      'list_workflows',
      'List all workflows for the authenticated user',
      {},
      async (params, extra) => {
        const userId = getUserId(extra);
        if (!userId) {
          return {
            content: [{ type: 'text', text: 'User not authenticated' }],
            isError: true,
          };
        }

        const result = await WorkflowService.list(userId);

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        if (!result.workflows || result.workflows.length === 0) {
          return {
            content: [{ type: 'text', text: 'No workflows found. Create your first workflow!' }],
          };
        }

        const workflowList = result.workflows
          .map((w) => `- ${w.name} (ID: ${w.id})\n  ${w.description || 'No description'}\n  Updated: ${new Date(w.updated_at).toLocaleString()}`)
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${result.workflows.length} workflow(s):\n\n${workflowList}`,
            },
          ],
        };
      },
    );

    server.tool(
      'get_workflow',
      'Get a specific workflow by ID',
      {
        id: z.string().uuid().describe('The workflow ID'),
      },
      async ({ id }, extra) => {
        const userId = getUserId(extra);
        if (!userId) {
          return {
            content: [{ type: 'text', text: 'User not authenticated' }],
            isError: true,
          };
        }

        const result = await WorkflowService.get(id, userId);

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        const workflow = result.workflow!;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(workflow, null, 2),
            },
          ],
        };
      },
    );

    server.tool(
      'create_workflow',
      'Create a new workflow',
      {
        name: z.string().min(1).describe('Name of the workflow'),
        description: z.string().optional().describe('Optional description'),
        workflow_data: z.object({
          nodes: z.array(z.any()).describe('Array of nodes'),
          edges: z.array(z.any()).describe('Array of edges'),
          viewport: z.object({
            x: z.number(),
            y: z.number(),
            zoom: z.number(),
          }).optional().describe('Viewport settings'),
        }).describe('ReactFlow graph data'),
      },
      async (params, extra) => {
        const userId = getUserId(extra);
        if (!userId) {
          return {
            content: [{ type: 'text', text: 'User not authenticated' }],
            isError: true,
          };
        }

        const result = await WorkflowService.create(userId, params);

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Successfully created workflow "${result.workflow!.name}" (ID: ${result.workflow!.id})`,
            },
          ],
        };
      },
    );

    server.tool(
      'update_workflow',
      'Update an existing workflow',
      {
        id: z.string().uuid().describe('The workflow ID to update'),
        name: z.string().min(1).optional().describe('New name'),
        description: z.string().optional().describe('New description'),
        workflow_data: z.object({
          nodes: z.array(z.any()),
          edges: z.array(z.any()),
          viewport: z.object({
            x: z.number(),
            y: z.number(),
            zoom: z.number(),
          }).optional(),
        }).optional().describe('Updated ReactFlow graph data'),
      },
      async (params, extra) => {
        const userId = getUserId(extra);
        if (!userId) {
          return {
            content: [{ type: 'text', text: 'User not authenticated' }],
            isError: true,
          };
        }

        const result = await WorkflowService.update(userId, params);

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated workflow "${result.workflow!.name}" (ID: ${result.workflow!.id})`,
            },
          ],
        };
      },
    );

    server.tool(
      'delete_workflow',
      'Delete a workflow',
      {
        id: z.string().uuid().describe('The workflow ID to delete'),
      },
      async ({ id }, extra) => {
        const userId = getUserId(extra);
        if (!userId) {
          return {
            content: [{ type: 'text', text: 'User not authenticated' }],
            isError: true,
          };
        }

        const result = await WorkflowService.delete(id, userId);

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted workflow (ID: ${id})`,
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
async function validateApiKeyFromRequest(req: Request): Promise<{ valid: boolean; userId?: string }> {
  // Get API key from header or query parameter
  let apiKey = req.headers.get('aiwiki_api_key');

  if (!apiKey) {
    const url = new URL(req.url);
    apiKey = url.searchParams.get('key') || url.searchParams.get('api_key') || url.searchParams.get('aiwiki_api_key');
  }

  if (!apiKey) {
    console.log('[MCP Auth] No API key provided');
    return { valid: false };
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
    return { valid: false };
  }

  if (!data) {
    console.log('[MCP Auth] No matching API key found');
    return { valid: false };
  }

  console.log('[MCP Auth] Valid API key found for user:', data.user_id);

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return { valid: true, userId: data.user_id };
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

  const authResult = await validateApiKeyFromRequest(req);

  if (!authResult.valid) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or missing API key. Please provide a valid API key in the aiwiki_api_key header or as a query parameter (?key=xxx, ?api_key=xxx, or ?aiwiki_api_key=xxx).'
      },
      { status: 401 }
    );
  }

  // Clone the request and add user_id to headers for handler context
  const headers = new Headers(req.headers);
  headers.set('x-user-id', authResult.userId || '');

  const modifiedReq = new Request(req, { headers });

  return handler(modifiedReq);
}

export {
  authenticatedHandler as GET,
  authenticatedHandler as POST,
  authenticatedHandler as DELETE,
  authenticatedHandler as OPTIONS
};
