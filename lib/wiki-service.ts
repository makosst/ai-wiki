import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Zod schemas
export const contributionSchema = z.object({
  fileName: z.string(),
  content: z.string(),
  route: z.string(),
  contentType: z.string().optional(),
});

export const contributionResultSchema = z.object({
  success: z.boolean(),
  route: z.string(),
  fileId: z.string().optional(),
  fileName: z.string().optional(),
  message: z.string(),
});

export const childRouteSchema = z.object({
  route: z.string(),
  fileName: z.string().nullable(),
});

export const searchResultItemSchema = z.object({
  route: z.string(),
  fileName: z.string(),
  snippet: z.string(),
});

export const readResultSchema = z.object({
  success: z.boolean(),
  route: z.string(),
  fileName: z.string().optional(),
  content: z.string().optional(),
  childRoutes: z.array(childRouteSchema).optional(),
  searchResults: z.array(searchResultItemSchema).optional(),
  message: z.string().optional(),
});

// Inferred types
export type Contribution = z.infer<typeof contributionSchema>;
export type ContributionResult = z.infer<typeof contributionResultSchema>;
export type ChildRoute = z.infer<typeof childRouteSchema>;
export type SearchResultItem = z.infer<typeof searchResultItemSchema>;
export type ReadResult = z.infer<typeof readResultSchema>;

// Helper function to generate route variants (with/without .md extension)
function getRouteVariants(searchRoute: string): string[] {
  const variants = [searchRoute];
  if (searchRoute.endsWith('.md')) {
    variants.push(searchRoute.slice(0, -3));
  } else {
    variants.push(`${searchRoute}.md`);
  }
  return variants;
}

export class WikiService {
  /**
   * Contribute content to the wiki (single or batch)
   */
  static async contribute(contributions: Contribution[]): Promise<ContributionResult[]> {
    const results: ContributionResult[] = [];

    for (const contribution of contributions) {
      const { fileName, content, route, contentType = 'text/plain' } = contribution;

      try {
        const fileId = crypto.randomUUID();
        const filePath = `${fileId}/${fileName}`;

        // Upload the file content to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from('ai-wiki-storage')
          .upload(filePath, content, {
            contentType,
            upsert: false,
          });

        if (uploadError) {
          results.push({
            success: false,
            route,
            fileName,
            message: `Upload failed for route "${route}": ${uploadError.message}`,
          });
          continue;
        }

        // Map the uploaded file to the provided route
        const { error: insertError } = await supabase
          .from('wiki_files_index')
          .upsert(
            {
              route,
              file_id: fileId,
              file_name: fileName,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'route',
            },
          );

        if (insertError) {
          results.push({
            success: false,
            route,
            fileName,
            message: `Index update failed for route "${route}": ${insertError.message}`,
          });
          continue;
        }

        results.push({
          success: true,
          route,
          fileId,
          fileName,
          message: `Route "${route}" mapped to file ID ${fileId}`,
        });
      } catch (error) {
        results.push({
          success: false,
          route,
          fileName,
          message: `Unexpected error for route "${route}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return results;
  }

  /**
   * Read content from the wiki (supports exact match, child routes, and search)
   */
  static async read(route: string): Promise<ReadResult> {
    try {
      // First, try to find exact route match (check both with/without .md)
      const routeVariants = getRouteVariants(route);
      let indexData = null;

      for (const variant of routeVariants) {
        const result = await supabase
          .from('wiki_files_index')
          .select('file_id, file_name, route')
          .eq('route', variant)
          .single();

        if (!result.error && result.data) {
          indexData = result.data;
          break;
        }
      }

      // Also check file_name field if route doesn't match
      if (!indexData) {
        const fileNameVariants = getRouteVariants(route);
        for (const variant of fileNameVariants) {
          const result = await supabase
            .from('wiki_files_index')
            .select('file_id, file_name, route')
            .eq('file_name', variant)
            .single();

          if (!result.error && result.data) {
            indexData = result.data;
            break;
          }
        }
      }

      if (indexData) {
        // Found exact match, retrieve the file content
        const filePath = `${indexData.file_id}/${indexData.file_name}`;
        const { data: fileData, error: fileError } = await supabase.storage
          .from('ai-wiki-storage')
          .download(filePath);

        if (fileError || !fileData) {
          return {
            success: false,
            route,
            message: `Route "${route}" is mapped but file could not be retrieved: ${fileError?.message || 'Unknown error'}`,
          };
        }

        const fileContent = await fileData.text();

        return {
          success: true,
          route,
          fileName: indexData.file_name,
          content: fileContent,
        };
      }

      // No exact match found, check for child routes
      const routePrefix = route.endsWith('/') ? route : `${route}/`;

      // Fetch all child routes using pagination (Supabase has a 1000 row limit per request)
      let allChildRoutes: Array<{ route: string; file_name: string | null }> = [];
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data: pageData } = await supabase
          .from('wiki_files_index')
          .select('route, file_name')
          .like('route', `${routePrefix}%`)
          .order('route')
          .range(offset, offset + pageSize - 1);

        if (!pageData || pageData.length === 0) break;

        allChildRoutes.push(...pageData);

        if (pageData.length < pageSize) break; // Last page
        offset += pageSize;
      }

      let childRoutes = allChildRoutes;

      // Try fuzzy prefix match if no exact children found
      if ((!childRoutes || childRoutes.length === 0) && !route.endsWith('/')) {
        const fuzzyPattern = `${route}%`;
        const { data: fuzzyResults } = await supabase
          .from('wiki_files_index')
          .select('route, file_name')
          .ilike('route', fuzzyPattern)
          .order('route')
          .limit(10000);

        if (fuzzyResults && fuzzyResults.length > 0) {
          // Find the longest common prefix among all fuzzy results
          const commonPrefixParts: string[] = [];
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

          if (commonPrefix && commonPrefix !== route) {
            const { data: suggestedChildren } = await supabase
              .from('wiki_files_index')
              .select('route, file_name')
              .like('route', `${commonPrefix}/%`)
              .order('route')
              .limit(10000);

            if (suggestedChildren && suggestedChildren.length > 0) {
              childRoutes = suggestedChildren;
            }
          }
        }
      }

      // If we found children, return them
      if (childRoutes && childRoutes.length > 0) {
        const uniqueChildren = new Map<string, { route: string; fileName: string | null }>();

        childRoutes.forEach((child) => {
          const relativePath = child.route.substring(routePrefix.length);
          const firstSegment = relativePath.split('/')[0];

          if (!uniqueChildren.has(firstSegment)) {
            const isDirectFile = child.route === `${routePrefix}${firstSegment}`;
            uniqueChildren.set(firstSegment, {
              route: `${routePrefix}${firstSegment}`,
              fileName: isDirectFile ? child.file_name : null,
            });
          }
        });

        return {
          success: true,
          route,
          childRoutes: Array.from(uniqueChildren.values()),
        };
      }

      // No children found, perform fuzzy search
      const searchRouteVariants = getRouteVariants(route);
      const searchPatterns = searchRouteVariants.map(v => `%${v}%`);

      let searchResults: Array<{ file_id: string; file_name: string; route: string }> | null = null;

      // Try searching route field
      for (const pattern of searchPatterns) {
        const { data: routeResults } = await supabase
          .from('wiki_files_index')
          .select('file_id, file_name, route')
          .ilike('route', pattern)
          .limit(10);

        if (routeResults && routeResults.length > 0) {
          searchResults = routeResults;
          break;
        }
      }

      // Try searching file_name field
      if (!searchResults || searchResults.length === 0) {
        for (const pattern of searchPatterns) {
          const { data: fileNameResults } = await supabase
            .from('wiki_files_index')
            .select('file_id, file_name, route')
            .ilike('file_name', pattern)
            .limit(10);

          if (fileNameResults && fileNameResults.length > 0) {
            searchResults = fileNameResults;
            break;
          }
        }
      }

      // Try fulltext search
      if (!searchResults || searchResults.length === 0) {
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

      // Try websearch as last resort
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
          success: false,
          route,
          message: `No results found for "${route}". Try different search terms or check available routes.`,
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
            snippet = content.substring(0, 200) + (content.length > 200 ? '...' : '');
          }

          return {
            route: result.route,
            fileName: result.file_name,
            snippet,
          };
        })
      );

      return {
        success: true,
        route,
        searchResults: resultsWithSnippets,
      };
    } catch (error) {
      return {
        success: false,
        route,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Batch read multiple routes
   */
  static async batchRead(routes: string[]): Promise<ReadResult[]> {
    return Promise.all(routes.map(route => this.read(route)));
  }
}
