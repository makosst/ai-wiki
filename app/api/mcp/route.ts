import { z } from 'zod';
import { createMcpHandler } from 'mcp-handler';
import { NextRequest } from 'next/server';
import { WikiService } from '@/lib/wiki-service';
import { validateApiKey, createUnauthorizedResponse } from '@/lib/auth-middleware';

const handler = createMcpHandler(
  (server) => {
    const singleContributionSchema = z.object({
      fileName: z.string().describe('The name of the file (e.g., "shadcn-guide.md")'),
      content: z.string().describe('The file content as a string'),
      route: z.string().describe('The route path for this content (e.g., "ui/shadcn/installation", "backend/nodejs/express")'),
      contentType: z
        .string()
        .optional()
        .describe('MIME type of the file (e.g., "text/markdown"). Defaults to "text/plain"'),
    });

    if(true){
    // Contribute tool: Upload files and map them to routes. Supports single or batch contributions.
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
  }
    // Read tool: Get file by route or search
    server.tool(
      'read',
      'Read content from the AI wiki by route path. Always start with reading by the library name. Use the .md when trying to read concrete content.',
      {
        route: z.string().describe('The route path to read (e.g., "ui/shadcn/installation") or search terms'),
      },
      async ({ route }) => {
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
                text: `# ${route}\n\nNo file exists at this route, but found ${result.childRoutes.length} child route(s):\n\n${childList}\n\nUse the exact route path with the 'read' tool to view content.`,
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

// Optional authentication wrapper - works with or without API key
async function optionalAuthHandler(request: NextRequest) {
  // API key is now optional - just continue to handler
  return handler(request);
}

export { optionalAuthHandler as GET, optionalAuthHandler as POST, optionalAuthHandler as DELETE };
