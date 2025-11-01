import { z } from 'zod';
import { createMcpHandler } from 'mcp-handler';
import { supabase } from '@/lib/supabase';

const handler = createMcpHandler(
  (server) => {
    // Upload tool: Upload files to Supabase storage and return the file ID
    server.tool(
      'upload',
      'Upload a file to the AI wiki storage. Returns the file ID that can be used with the contribute tool to map it to a route.',
      {
        fileName: z.string().describe('The name of the file (e.g., "shadcn-guide.md")'),
        content: z.string().describe('The file content as a string'),
        contentType: z.string().optional().describe('MIME type of the file (e.g., "text/markdown", "text/plain"). Defaults to "text/plain"'),
      },
      async ({ fileName, content, contentType = 'text/plain' }) => {
        try {
          const fileId = crypto.randomUUID();
          const filePath = `${fileId}/${fileName}`;

          // Upload file to Supabase storage
          const { error: uploadError } = await supabase.storage
            .from('ai-wiki-storage')
            .upload(filePath, content, {
              contentType,
              upsert: false,
            });

          if (uploadError) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error uploading file: ${uploadError.message}`,
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `File uploaded successfully!\n\nFile ID: ${fileId}\nFile Name: ${fileName}\nPath: ${filePath}\n\nUse this file ID with the 'contribute' tool to map it to a route.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Contribute tool: Map a file ID to a route
    server.tool(
      'contribute',
      'Map an uploaded file to a route path in the AI wiki. The route is like a file path (e.g., "ui/shadcn/installation" or "backend/supabase/auth"). This allows the file to be found via the read tool.',
      {
        fileId: z.string().describe('The file ID returned from the upload tool'),
        route: z.string().describe('The route path for this content (e.g., "ui/shadcn/installation", "backend/nodejs/express")'),
        fileName: z.string().describe('The original file name for reference'),
      },
      async ({ fileId, route, fileName }) => {
        try {
          // Verify the file exists in storage
          const filePath = `${fileId}/${fileName}`;
          const { data: fileData, error: fileError } = await supabase.storage
            .from('ai-wiki-storage')
            .list(fileId);

          if (fileError || !fileData || fileData.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: File with ID ${fileId} not found in storage. Please upload the file first using the 'upload' tool.`,
                },
              ],
              isError: true,
            };
          }

          // Insert or update the route mapping
          const { error: insertError } = await supabase
            .from('wiki_files_index')
            .upsert({
              route,
              file_id: fileId,
              file_name: fileName,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'route',
            });

          if (insertError) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error mapping route: ${insertError.message}`,
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `Successfully mapped route "${route}" to file ID ${fileId}!\n\nYou can now read this content using the 'read' tool with the route: "${route}"`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Read tool: Get file by route or search
    server.tool(
      'read',
      'Read content from the AI wiki by route path. If the exact route is not found, checks for child routes (like a directory listing). If no children exist, performs a fulltext search and returns the top 10 matching results with snippets.',
      {
        route: z.string().describe('The route path to read (e.g., "ui/shadcn/installation") or search terms'),
      },
      async ({ route }) => {
        try {
          // First, try to find exact route match
          const { data: indexData, error: indexError } = await supabase
            .from('wiki_files_index')
            .select('file_id, file_name, route')
            .eq('route', route)
            .single();

          if (!indexError && indexData) {
            // Found exact match, retrieve the file content
            const filePath = `${indexData.file_id}/${indexData.file_name}`;
            const { data: fileData, error: fileError } = await supabase.storage
              .from('ai-wiki-storage')
              .download(filePath);

            if (fileError || !fileData) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error: Route "${route}" is mapped but file could not be retrieved: ${fileError?.message || 'Unknown error'}`,
                  },
                ],
                isError: true,
              };
            }

            const fileContent = await fileData.text();

            return {
              content: [
                {
                  type: 'text',
                  text: `# ${route}\n\nFile: ${indexData.file_name}\n\n---\n\n${fileContent}`,
                },
              ],
            };
          }

          // No exact match found, check for child routes
          // First try: exact prefix match
          const routePrefix = route.endsWith('/') ? route : `${route}/`;
          let { data: childRoutes, error: childError } = await supabase
            .from('wiki_files_index')
            .select('route, file_name')
            .like('route', `${routePrefix}%`)
            .order('route');

          // Second try: fuzzy prefix match (e.g., "ui/aceternity" matches "ui/aceternityui/...")
          if ((!childRoutes || childRoutes.length === 0) && !route.endsWith('/')) {
            const fuzzyPattern = `${route}%`;
            const { data: fuzzyResults } = await supabase
              .from('wiki_files_index')
              .select('route, file_name')
              .ilike('route', fuzzyPattern)
              .order('route');

            // If fuzzy results exist, find the common parent path
            if (fuzzyResults && fuzzyResults.length > 0) {
              // Find the longest common prefix among all fuzzy results
              let commonPrefixParts: string[] = [];
              const firstParts = fuzzyResults[0].route.split('/');

              for (let i = 0; i < firstParts.length; i++) {
                const segment = firstParts[i];
                if (fuzzyResults.every(r => r.route.split('/')[i] === segment)) {
                  commonPrefixParts.push(segment);
                } else {
                  break;
                }
              }

              const commonPrefix = commonPrefixParts.join('/');

              // If we found a common prefix different from search term, navigate to it
              if (commonPrefix && commonPrefix !== route) {
                // Get children of the common prefix
                const { data: suggestedChildren } = await supabase
                  .from('wiki_files_index')
                  .select('route, file_name')
                  .like('route', `${commonPrefix}/%`)
                  .order('route');

                if (suggestedChildren && suggestedChildren.length > 0) {
                  childRoutes = suggestedChildren;
                  // Update the display to show we're navigating to the closest match
                  const childList = suggestedChildren
                    .map((child) => {
                      const relativePath = child.route.substring(commonPrefix.length + 1);
                      const firstSegment = relativePath.split('/')[0];
                      return firstSegment;
                    })
                    .filter((value, index, self) => self.indexOf(value) === index)
                    .map((childName) => {
                      const childRoute = `${commonPrefix}/${childName}`;
                      const matchingRoute = suggestedChildren.find(r => r.route === childRoute || r.route.startsWith(`${childRoute}/`));
                      return `- ${childRoute}${matchingRoute?.route === childRoute ? ` (${matchingRoute.file_name})` : ' (directory)'}`;
                    })
                    .join('\n');

                  return {
                    content: [
                      {
                        type: 'text',
                        text: `# ${commonPrefix}\n\n⚠️ No exact match for "${route}", showing closest match: "${commonPrefix}"\n\nFound ${suggestedChildren.length} child route(s):\n\n${childList}\n\nUse the exact route path with the 'read' tool to view content.`,
                      },
                    ],
                  };
                }
              }
            }
          }

          // If we found exact children, show them
          if (!childError && childRoutes && childRoutes.length > 0) {
            const childList = childRoutes
              .map((child) => {
                const relativePath = child.route.substring(routePrefix.length);
                const firstSegment = relativePath.split('/')[0];
                return firstSegment;
              })
              .filter((value, index, self) => self.indexOf(value) === index)
              .map((childName) => {
                const childRoute = `${routePrefix}${childName}`;
                const matchingRoute = childRoutes.find(r => r.route === childRoute || r.route.startsWith(`${childRoute}/`));
                return `- ${childRoute}${matchingRoute?.route === childRoute ? ` (${matchingRoute.file_name})` : ' (directory)'}`;
              })
              .join('\n');

            return {
              content: [
                {
                  type: 'text',
                  text: `# ${route}\n\nNo file exists at this route, but found ${childRoutes.length} child route(s):\n\n${childList}\n\nUse the exact route path with the 'read' tool to view content.`,
                },
              ],
            };
          }

          // No children found, perform fuzzy search
          // First try: case-insensitive substring matching (most flexible)
          const searchPattern = `%${route}%`;
          let { data: searchResults } = await supabase
            .from('wiki_files_index')
            .select('file_id, file_name, route')
            .ilike('route', searchPattern)
            .limit(10);

          // Second try: if no results, try fulltext search with prefix matching
          if (!searchResults || searchResults.length === 0) {
            // Convert route to prefix search tokens (each word becomes a prefix)
            const searchTokens = route
              .replace(/\//g, ' ')
              .split(/\s+/)
              .filter(token => token.length > 0)
              .map(token => `${token}:*`)
              .join(' & ');

            const { data: ftsResults } = await supabase
              .from('wiki_files_index')
              .select('file_id, file_name, route')
              .textSearch('route_search', searchTokens, {
                type: 'plain',
                config: 'english',
              })
              .limit(10);

            searchResults = ftsResults;
          }

          // Third try: if still no results, try websearch (most lenient)
          if (!searchResults || searchResults.length === 0) {
            const { data: webResults } = await supabase
              .from('wiki_files_index')
              .select('file_id, file_name, route')
              .textSearch('route_search', route, {
                type: 'websearch',
                config: 'english',
              })
              .limit(10);

            searchResults = webResults;
          }

          if (!searchResults || searchResults.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No results found for "${route}". Try different search terms or check available routes.`,
                },
              ],
            };
          }

          // Get file snippets for search results
          const resultsWithSnippets = await Promise.all(
            searchResults.map(async (result) => {
              const filePath = `${result.file_id}/${result.file_name}`;
              const { data: fileData } = await supabase.storage
                .from('ai-wiki-storage')
                .download(filePath);

              let snippet = '';
              if (fileData) {
                const content = await fileData.text();
                // Get first 200 characters as snippet
                snippet = content.substring(0, 200) + (content.length > 200 ? '...' : '');
              }

              return {
                route: result.route,
                fileName: result.file_name,
                snippet,
              };
            })
          );

          const searchResultText = resultsWithSnippets
            .map((result, index) =>
              `${index + 1}. Route: ${result.route}\n   File: ${result.fileName}\n   Preview: ${result.snippet}\n`
            )
            .join('\n');

          return {
            content: [
              {
                type: 'text',
                text: `No exact match for "${route}". Here are the top ${searchResults.length} search results:\n\n${searchResultText}\n\nUse the exact route path with the 'read' tool to view full content.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  },
  {},
  { basePath: '/api' },
);

export { handler as GET, handler as POST, handler as DELETE };
