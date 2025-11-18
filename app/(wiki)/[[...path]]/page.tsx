import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import { cookies } from 'next/headers';
import { CopyButton } from '@/components/copy-button';
import { ViewToggleProvider, ViewToggleButton, ViewToggleContent } from '@/components/view-toggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/retroui/Card';
import { Text } from '@/components/retroui/Text';
import { Button } from '@/components/retroui/Button';
import Link from 'next/link';
import { WikiService } from '@/lib/wiki-service';
import { AddToClaudeCode } from '@/components/add-to-claude-code';
import { AddToCursor } from '@/components/add-to-cursor';
import { AddToCodex } from '@/components/add-to-codex';
import { Pagination } from '@/components/pagination';

// Enable revalidation on page refresh while serving stale content
export const revalidate = 0;

interface PageProps {
  params: Promise<{
    path?: string[];
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
}

function wrapInAsciiFrame(content: string, maxWidth: number = 100): string {
  // No frame - just return the content as-is
  return content;
}

function renderFramedMarkdown(lines: string[], maxWidth: number = 96): string {
  // No frame - just join lines with newlines
  return lines.join('\n');
}

function createAsciiHeader(title: string): string {
  // No frame - just return the title with some formatting
  return `# ${title}`;
}

export default async function PreviewPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const pathSegments = resolvedParams.path || [];
  const route = pathSegments.join('/');
  const currentPage = parseInt(resolvedSearchParams.page || '1', 10);
  const itemsPerPage = 15;

  const cookieStore = await cookies();
  const loginCookie = cookieStore.get('aiwiki_logged_in')?.value;
  let isLoggedIn = loginCookie === '1';

  // Detect if running locally
  const isLocal = process.env.NODE_ENV === 'development';
  const baseUrl = isLocal ? 'http://localhost:3000' : 'https://ai-wiki-nu.vercel.app';

  const ActionLinks = () => (
    <div className="flex gap-2 mb-4 flex-wrap">
      {isLoggedIn ? (
        <>
          <Link href="/api-keys">
            <Button variant="secondary" size="sm">🔑 API Keys</Button>
          </Link>
          <AddToClaudeCode />
          <AddToCodex />
          <AddToCursor />
        </>
      ) : (
        <>
          {isLocal ? (
            <>
              <a href={`${baseUrl}/login?mode=signup`}>
                <Button variant="secondary" size="sm">📝 Sign Up</Button>
              </a>
              <a href={`${baseUrl}/login`}>
                <Button variant="secondary" size="sm">🔐 Log In</Button>
              </a>
            </>
          ) : (
            <>
              <Link href="/login?mode=signup">
                <Button variant="secondary" size="sm">📝 Sign Up</Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary" size="sm">🔐 Log In</Button>
              </Link>
            </>
          )}
        </>
      )}
    </div>
  );

  // Try to find exact route match (cached)
  const { data: indexData, error: indexError } = await WikiService.getCachedIndexData(route);

  // Check for child routes regardless of whether we have an exact match
  const routePrefix = route.length > 0 ? (route.endsWith('/') ? route : `${route}/`) : '';

  // Fetch all child routes using pagination (cached)
  let childRoutes: Array<{ route: string; file_name: string | null }> = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data: pageData, error: pageError } = await WikiService.getCachedChildRoutes(
      routePrefix || '',
      offset,
      pageSize
    );

    if (pageError || !pageData || pageData.length === 0) break;

    childRoutes.push(...pageData);

    if (pageData.length < pageSize) break; // Last page
    offset += pageSize;
  }

  // Filter to get only immediate children, not nested grandchildren
  const immediateChildren = new Map<string, { route: string; file_name: string | null; hasChildren: boolean }>();

  childRoutes.forEach((child) => {
    // Skip the exact route if it exists (we'll display it separately)
    if (child.route === route) return;

    const relativePath = routePrefix ? child.route.substring(routePrefix.length) : child.route;
    const firstSegment = relativePath.split('/')[0];

    const isDirectFile = child.route === `${routePrefix}${firstSegment}`;
    const hasNestedChildren = relativePath.includes('/');

    if (!immediateChildren.has(firstSegment)) {
      immediateChildren.set(firstSegment, {
        route: `${routePrefix}${firstSegment}`,
        file_name: isDirectFile ? child.file_name : null,
        hasChildren: hasNestedChildren,
      });
    } else {
      // If we already have this entry, update it if we find it has children
      const existing = immediateChildren.get(firstSegment)!;
      if (hasNestedChildren) {
        existing.hasChildren = true;
      }
    }
  });

  // If exact match found, display the file content
  if (!indexError && indexData) {
    const filePath = `${indexData.file_id}/${indexData.file_name}`;
    const { data: fileData, error: fileError } = await WikiService.getCachedFileContent(filePath);

    if (fileError || !fileData) {
    return (
      <div className="preview-container">
        <div className="preview-content">
          <ActionLinks />
          <div className="mb-4">
            <Link href="/">
              <Button variant="secondary" size="sm">← Root</Button>
            </Link>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>File could not be retrieved: {fileError?.message || 'Unknown error'}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
    }

    // fileData is now a string (already converted from Blob in the cache layer)
    const fileContent = fileData;
    const framedContent = wrapInAsciiFrame(fileContent, 96);
    const formattedDate = new Date(indexData.updated_at).toLocaleDateString();

    // Check if we also have children to display
    const hasChildren = immediateChildren.size > 0;

    // Check if at root and prepare children display
    const isRootRoute = route.length === 0;
    const sortedChildren = Array.from(immediateChildren.entries()).sort((a, b) => {
      // Sort directories before files (has children = directory)
      const aIsDir = a[1].hasChildren;
      const bIsDir = b[1].hasChildren;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      // Then sort alphabetically
      return a[0].localeCompare(b[0]);
    });

    // Pagination logic
    const totalItems = sortedChildren.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const displayChildren = sortedChildren.slice(startIndex, endIndex);

    // If we're at the root, also show recently added files (cached)
    let recentFiles = null;
    if (isRootRoute && hasChildren) {
      const { data } = await WikiService.getCachedRecentFiles();
      recentFiles = data;
    }

    return (
      <div className="preview-container">
        <div className="preview-content">
          <ActionLinks />
          <div className="flex gap-2 mb-4">
            <Link href="/">
              <Button variant="secondary" size="sm">← Root</Button>
            </Link>
            {pathSegments.length > 1 && (
              <Link href={`/${pathSegments.slice(0, -1).join('/')}`}>
                <Button variant="secondary" size="sm">↑ Up</Button>
              </Link>
            )}
          </div>
          <ViewToggleProvider content={fileContent} framedContent={framedContent}>
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>{hasChildren ? '📁' : '📄'} {route || 'Root'}</CardTitle>
                <CardDescription>
                  File: {indexData.file_name} | Updated: {formattedDate}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <CopyButton text={fileContent} ariaLabel="Copy file content" />
                <ViewToggleButton />
              </CardContent>
            </Card>
            <Card className={hasChildren ? "mb-4" : ""}>
              <CardContent className="p-0">
                <ViewToggleContent content={fileContent} framedContent={framedContent} />
              </CardContent>
            </Card>
          </ViewToggleProvider>
          {hasChildren && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>📁 Children</CardTitle>
                <CardDescription>
                  Directory listing - {totalItems} item(s) total
                  {totalPages > 1 ? ` (page ${currentPage} of ${totalPages})` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 min-h-[480px]">
                  {displayChildren.map(([name, info]) => {
                    const icon = info.hasChildren ? '📁' : '📄';
                    const fileName = info.file_name ? ` (${info.file_name})` : '';
                    return (
                      <div key={name} className="flex flex-wrap items-center gap-2 break-words">
                        <span className="flex-shrink-0">{icon}</span>
                        <Link href={`/${info.route}`} className="hover:underline break-all">
                          {name}{fileName}
                        </Link>
                      </div>
                    );
                  })}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  baseRoute={`/${route}`}
                />
              </CardContent>
            </Card>
          )}
          {recentFiles && recentFiles.length > 0 && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>📅 Recently Added</CardTitle>
                <CardDescription>Last 20 updated files</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentFiles.map(file => {
                    const date = new Date(file.updated_at).toLocaleDateString();
                    return (
                      <div key={file.route} className="flex flex-wrap items-center gap-2 text-sm break-words">
                        <Link href={`/${file.route}`} className="hover:underline break-all">
                          {file.route}
                        </Link>
                        <span className="text-muted-foreground break-words">- {file.file_name} ({date})</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          <div className="flex gap-2 mt-4">
            <Link href="/">
              <Button variant="secondary" size="sm">← Root</Button>
            </Link>
            {pathSegments.length > 1 && (
              <Link href={`/${pathSegments.slice(0, -1).join('/')}`}>
                <Button variant="secondary" size="sm">↑ Up</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If we only have children (no file content), display directory view
  if (immediateChildren.size > 0) {
    const sortedChildren = Array.from(immediateChildren.entries()).sort((a, b) => {
      // Sort directories before files (has children = directory)
      const aIsDir = a[1].hasChildren;
      const bIsDir = b[1].hasChildren;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      // Then sort alphabetically
      return a[0].localeCompare(b[0]);
    });

    // If we're at the root, also show recently added files (cached)
    const isRootRoute = route.length === 0;
    let recentFiles = null;
    if (isRootRoute) {
      const { data } = await WikiService.getCachedRecentFiles();
      recentFiles = data;
    }

    // Pagination logic
    const totalItems = sortedChildren.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const displayChildren = sortedChildren.slice(startIndex, endIndex);

    return (
      <div className="preview-container">
        <div className="preview-content">
          <ActionLinks />
          <div className="flex gap-2 mb-4">
            {route.length > 0 && (
              <>
                <Link href="/">
                  <Button variant="secondary" size="sm">← Root</Button>
                </Link>
                {pathSegments.length > 1 && (
                  <Link href={`/${pathSegments.slice(0, -1).join('/')}`}>
                    <Button variant="secondary" size="sm">↑ Up</Button>
                  </Link>
                )}
              </>
            )}
          </div>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>📁 {route || 'AI WIKI - ROOT'}</CardTitle>
              <CardDescription>
                Directory listing - {totalItems} item(s) total
                {totalPages > 1 ? ` (page ${currentPage} of ${totalPages})` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 min-h-[480px]">
                {displayChildren.map(([name, info]) => {
                  const icon = info.hasChildren ? '📁' : '📄';
                  const fileName = info.file_name ? ` (${info.file_name})` : '';
                  return (
                    <div key={name} className="flex flex-wrap items-center gap-2 break-words">
                      <span className="flex-shrink-0">{icon}</span>
                      <Link href={`/${info.route}`} className="hover:underline break-all">
                        {name}{fileName}
                      </Link>
                    </div>
                  );
                })}
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                baseRoute={`/${route}`}
              />
            </CardContent>
          </Card>
          {recentFiles && recentFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>📅 Recently Added</CardTitle>
                <CardDescription>Last 20 updated files</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentFiles.map(file => {
                    const date = new Date(file.updated_at).toLocaleDateString();
                    return (
                      <div key={file.route} className="flex flex-wrap items-center gap-2 text-sm break-words">
                        <Link href={`/${file.route}`} className="hover:underline break-all">
                          {file.route}
                        </Link>
                        <span className="text-muted-foreground break-words">- {file.file_name} ({date})</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Nothing found
  return (
    <div className="preview-container">
      <div className="preview-content">
        <ActionLinks />
        <div className="mb-4">
          <Link href="/">
            <Button variant="secondary" size="sm">← Root</Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>404 - Not Found</CardTitle>
            <CardDescription>
              No files or directories found at route: {route || '(root)'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
