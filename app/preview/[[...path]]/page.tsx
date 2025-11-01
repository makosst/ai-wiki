import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

interface PageProps {
  params: Promise<{
    path?: string[];
  }>;
}

interface RouteInfo {
  route: string;
  file_name: string;
  file_id: string;
  updated_at: string;
}

export default async function PreviewPage({ params }: PageProps) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path || [];
  const route = pathSegments.join('/');

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
        <div className="container mx-auto px-4 py-8">
          <div className="mb-4">
            <Link href="/preview" className="text-blue-600 hover:underline">
              ← Back to root
            </Link>
          </div>
          <h1 className="text-3xl font-bold mb-4 text-red-600">Error</h1>
          <p>File could not be retrieved: {fileError?.message || 'Unknown error'}</p>
        </div>
      );
    }

    const fileContent = await fileData.text();

    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-4">
          <Link href="/preview" className="text-blue-600 hover:underline">
            ← Back to root
          </Link>
          {pathSegments.length > 1 && (
            <span className="mx-2">|</span>
          )}
          {pathSegments.length > 1 && (
            <Link
              href={`/preview/${pathSegments.slice(0, -1).join('/')}`}
              className="text-blue-600 hover:underline"
            >
              ← Up one level
            </Link>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-4 pb-4 border-b">
            <h1 className="text-3xl font-bold mb-2">{route || 'Root'}</h1>
            <p className="text-sm text-gray-600">File: {indexData.file_name}</p>
            <p className="text-sm text-gray-500">
              Last updated: {new Date(indexData.updated_at).toLocaleDateString()}
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <ReactMarkdown>{fileContent}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // No exact match found, check for child routes
  const routePrefix = route.length > 0 ? (route.endsWith('/') ? route : `${route}/`) : '';
  const { data: childRoutes, error: childError } = await supabase
    .from('wiki_files_index')
    .select('route, file_name')
    .like('route', routePrefix ? `${routePrefix}%` : '%')
    .order('route');

  if (!childError && childRoutes && childRoutes.length > 0) {
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

    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-4">
          {route.length > 0 && (
            <>
              <Link href="/preview" className="text-blue-600 hover:underline">
                ← Back to root
              </Link>
              {pathSegments.length > 1 && (
                <>
                  <span className="mx-2">|</span>
                  <Link
                    href={`/preview/${pathSegments.slice(0, -1).join('/')}`}
                    className="text-blue-600 hover:underline"
                  >
                    ← Up one level
                  </Link>
                </>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-4">
            {route || 'AI Wiki - Root'}
          </h1>
          <p className="text-gray-600 mb-6">
            {sortedChildren.length} item(s) in this directory
          </p>

          <div className="space-y-2">
            {sortedChildren.map(([name, info]) => (
              <Link
                key={info.route}
                href={`/preview/${info.route}`}
                className="block p-4 border rounded-lg hover:bg-gray-50 hover:border-blue-500 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-lg">
                      {info.file_name ? '📄' : '📁'} {name}
                    </span>
                    {info.file_name && (
                      <span className="ml-3 text-sm text-gray-500">
                        ({info.file_name})
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Nothing found
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-4">
        <Link href="/preview" className="text-blue-600 hover:underline">
          ← Back to root
        </Link>
      </div>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold mb-4 text-gray-700">No Content Found</h1>
        <p className="text-gray-600">
          No files or directories found at route: <code className="bg-gray-100 px-2 py-1 rounded">{route || '(root)'}</code>
        </p>
      </div>
    </div>
  );
}
