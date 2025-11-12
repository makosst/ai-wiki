import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import { cookies } from 'next/headers';
import { CopyButton } from '@/components/copy-button';
import { ViewToggleProvider, ViewToggleButton, ViewToggleContent } from '@/components/view-toggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/retroui/Card';
import { Text } from '@/components/retroui/Text';
import { Button } from '@/components/retroui/Button';
import Link from 'next/link';

const CURSOR_INSTALL_LINK =
  'https://cursor.com/en-US/install-mcp?name=ai-wiki&config=eyJ0eXBlIjoiaHR0cCIsInVybCI6Imh0dHBzOi8vYWktd2lraS1udS52ZXJjZWwuYXBwL2FwaS9tY3AiLCJoZWFkZXJzIjp7IkFJV0lLSV9BUElfS0VZIjoiWU9VUl9BUElfS0VZIn19';

interface PageProps {
  params: Promise<{
    path?: string[];
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

export default async function PreviewPage({ params }: PageProps) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path || [];
  const route = pathSegments.join('/');

  const cookieStore = await cookies();
  const loginCookie = cookieStore.get('aiwiki_logged_in')?.value;
  let isLoggedIn = loginCookie === '1';

  const accessToken = cookieStore.get('sb-access-token')?.value;
  if (!isLoggedIn && accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data?.user) {
      isLoggedIn = true;
    }
  }

  const ActionLinks = () => (
    <div className="flex gap-2 mb-4 flex-wrap">
      {isLoggedIn ? (
        <>
          <Link href="/api-keys">
            <Button variant="secondary" size="sm">🔑 API Keys</Button>
          </Link>
          <a href={CURSOR_INSTALL_LINK} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm">➕ Add to Cursor</Button>
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
    </div>
  );

  // Try to find exact route match
  const { data: indexData, error: indexError } = await supabase
    .from('wiki_files_index')
    .select('file_id, file_name, route, updated_at')
    .eq('route', route)
    .single();

  // If exact match found, display the file content
  if (!indexError && indexData) {
    const filePath = `${indexData.file_id}/${indexData.file_name}`;
    const { data: fileData, error: fileError } = await supabase.storage
      .from('ai-wiki-storage')
      .download(filePath);

    if (fileError || !fileData) {
    return (
      <div className="preview-container">
        <div className="preview-content">
          <ActionLinks />
          <div className="mb-4">
            <Link href="/">
              <Button variant="outline" size="sm">← Root</Button>
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

    const fileContent = await fileData.text();
    const framedContent = wrapInAsciiFrame(fileContent, 96);
    const formattedDate = new Date(indexData.updated_at).toLocaleDateString();

    return (
      <div className="preview-container">
        <div className="preview-content">
          <ActionLinks />
          <div className="flex gap-2 mb-4">
            <Link href="/">
              <Button variant="outline" size="sm">← Root</Button>
            </Link>
            {pathSegments.length > 1 && (
              <Link href={`/${pathSegments.slice(0, -1).join('/')}`}>
                <Button variant="outline" size="sm">↑ Up</Button>
              </Link>
            )}
          </div>
          <ViewToggleProvider content={fileContent} framedContent={framedContent}>
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>📄 {route || 'Root'}</CardTitle>
                <CardDescription>
                  File: {indexData.file_name} | Updated: {formattedDate}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <CopyButton text={fileContent} ariaLabel="Copy file content" />
                <ViewToggleButton />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                <ViewToggleContent content={fileContent} framedContent={framedContent} />
              </CardContent>
            </Card>
          </ViewToggleProvider>
          <div className="flex gap-2 mt-4">
            <Link href="/">
              <Button variant="outline" size="sm">← Root</Button>
            </Link>
            {pathSegments.length > 1 && (
              <Link href={`/${pathSegments.slice(0, -1).join('/')}`}>
                <Button variant="outline" size="sm">↑ Up</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No exact match found, check for child routes
  const routePrefix = route.length > 0 ? (route.endsWith('/') ? route : `${route}/`) : '';

  // Fetch all child routes using pagination (Supabase has a 1000 row limit per request)
  let childRoutes: Array<{ route: string; file_name: string | null }> = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data: pageData, error: pageError } = await supabase
      .from('wiki_files_index')
      .select('route, file_name')
      .like('route', routePrefix ? `${routePrefix}%` : '%')
      .order('route')
      .range(offset, offset + pageSize - 1);

    if (pageError || !pageData || pageData.length === 0) break;

    childRoutes.push(...pageData);

    if (pageData.length < pageSize) break; // Last page
    offset += pageSize;
  }

  if (childRoutes && childRoutes.length > 0) {
    // Filter to get only immediate children, not nested grandchildren
    const immediateChildren = new Map<string, { route: string; file_name: string | null }>();

    childRoutes.forEach((child) => {
      // Skip the exact route if it exists (already handled above)
      if (child.route === route) return;

      const relativePath = routePrefix ? child.route.substring(routePrefix.length) : child.route;
      const firstSegment = relativePath.split('/')[0];

      if (!immediateChildren.has(firstSegment)) {
        // Check if this is a direct file or a directory
        const isDirectFile = child.route === `${routePrefix}${firstSegment}`;
        immediateChildren.set(firstSegment, {
          route: `${routePrefix}${firstSegment}`,
          file_name: isDirectFile ? child.file_name : null,
        });
      }
    });

    const sortedChildren = Array.from(immediateChildren.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    // If we're at the root, also show recently added files
    const isRootRoute = route.length === 0;
    let recentFiles = null;
    if (isRootRoute) {
      const { data } = await supabase
        .from('wiki_files_index')
        .select('route, file_name, updated_at')
        .order('updated_at', { ascending: false })
        .limit(20);
      recentFiles = data;
    }

    return (
      <div className="preview-container">
        <div className="preview-content">
          <ActionLinks />
          <div className="flex gap-2 mb-4">
            {route.length > 0 && (
              <>
                <Link href="/">
                  <Button variant="outline" size="sm">← Root</Button>
                </Link>
                {pathSegments.length > 1 && (
                  <Link href={`/${pathSegments.slice(0, -1).join('/')}`}>
                    <Button variant="outline" size="sm">↑ Up</Button>
                  </Link>
                )}
              </>
            )}
          </div>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>📁 {route || 'AI WIKI - ROOT'}</CardTitle>
              <CardDescription>Directory listing - {sortedChildren.length} item(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedChildren.map(([name, info]) => {
                  const icon = info.file_name ? '📄' : '📁';
                  const fileName = info.file_name ? ` (${info.file_name})` : '';
                  return (
                    <div key={name} className="flex items-center gap-2">
                      <span>{icon}</span>
                      <Link href={`/${info.route}`} className="hover:underline">
                        {name}{fileName}
                      </Link>
                    </div>
                  );
                })}
              </div>
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
                      <div key={file.route} className="flex items-center gap-2 text-sm">
                        <Link href={`/${file.route}`} className="hover:underline">
                          {file.route}
                        </Link>
                        <span className="text-muted-foreground">- {file.file_name} ({date})</span>
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
            <Button variant="outline" size="sm">← Root</Button>
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
