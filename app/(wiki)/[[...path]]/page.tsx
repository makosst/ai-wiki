import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import { cookies } from 'next/headers';
import { CopyButton } from '@/components/copy-button';

const CURSOR_INSTALL_LINK =
  'https://cursor.com/en-US/install-mcp?name=ai-wiki&config=eyJ0eXBlIjoiaHR0cCIsInVybCI6Imh0dHBzOi8vYWktd2lraS1udS52ZXJjZWwuYXBwL2FwaS9tY3AiLCJoZWFkZXJzIjp7IkFJV0lLSV9BUElfS0VZIjoiWU9VUl9BUElfS0VZIn19';

interface PageProps {
  params: Promise<{
    path?: string[];
  }>;
}

function wrapInAsciiFrame(content: string, maxWidth: number = 100): string {
  const lines = content.split('\n');
  const width = maxWidth;
  const maxLineLength = width - 4; // Account for "║ " and " ║"

  const topBorder = '╔' + '═'.repeat(width - 2) + '╗';
  const bottomBorder = '╚' + '═'.repeat(width - 2) + '╝';

  // Wrap long lines
  const wrappedLines: string[] = [];
  lines.forEach(line => {
    if (line.length <= maxLineLength) {
      wrappedLines.push(line);
    } else {
      // Split long lines into chunks
      let remaining = line;
      while (remaining.length > 0) {
        if (remaining.length <= maxLineLength) {
          wrappedLines.push(remaining);
          break;
        }
        // Try to break at a space
        let breakPoint = maxLineLength;
        const lastSpace = remaining.lastIndexOf(' ', maxLineLength);
        if (lastSpace > maxLineLength * 0.7) { // Only break at space if it's not too far back
          breakPoint = lastSpace;
        }
        wrappedLines.push(remaining.substring(0, breakPoint));
        remaining = remaining.substring(breakPoint).trimStart();
      }
    }
  });

  const paddedLines = wrappedLines.map(line => {
    const padding = Math.max(0, maxLineLength - line.length);
    return '║ ' + line + ' '.repeat(padding) + ' ║';
  });

  return [topBorder, ...paddedLines, bottomBorder].join('\n');
}

// Helper to calculate display length (ignoring markdown link syntax)
function getDisplayLength(text: string): number {
  // Remove markdown link syntax [text](url) and just count the display text
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').length;
}

// Helper to wrap a line with markdown links
function wrapLineWithMarkdown(line: string, maxLength: number): string[] {
  const displayLength = getDisplayLength(line);

  if (displayLength <= maxLength) {
    return [line];
  }

  // If line is too long, we need to wrap it
  // For simplicity, break at spaces while trying to keep markdown links together
  const result: string[] = [];
  let currentLine = '';
  let currentDisplayLength = 0;

  // Split by spaces but keep markdown links together
  const parts = line.split(' ');

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partDisplayLength = getDisplayLength(part);
    const spaceNeeded = currentLine.length > 0 ? 1 : 0; // For the space

    if (currentDisplayLength + spaceNeeded + partDisplayLength <= maxLength) {
      if (currentLine.length > 0) {
        currentLine += ' ';
        currentDisplayLength += 1;
      }
      currentLine += part;
      currentDisplayLength += partDisplayLength;
    } else {
      // Start a new line
      if (currentLine.length > 0) {
        result.push(currentLine);
      }
      currentLine = part;
      currentDisplayLength = partDisplayLength;
    }
  }

  if (currentLine.length > 0) {
    result.push(currentLine);
  }

  return result.length > 0 ? result : [line];
}

function renderFramedMarkdown(lines: string[], maxWidth: number = 96): string {
  const width = maxWidth;
  const maxLineLength = width - 4; // Account for "║ " and " ║"

  const topBorder = '╔' + '═'.repeat(width - 2) + '╗';
  const bottomBorder = '╚' + '═'.repeat(width - 2) + '╝';

  const framedLines: string[] = [topBorder];

  lines.forEach(line => {
    const wrappedLines = wrapLineWithMarkdown(line, maxLineLength);

    wrappedLines.forEach(wrappedLine => {
      const displayLength = getDisplayLength(wrappedLine);
      const padding = Math.max(0, maxLineLength - displayLength);
      framedLines.push('║ ' + wrappedLine + ' '.repeat(padding) + ' ║');
    });
  });

  framedLines.push(bottomBorder);
  return framedLines.join('\n');
}

function createAsciiHeader(title: string): string {
  const width = Math.max(title.length + 4, 60);
  const topBorder = '┌' + '─'.repeat(width - 2) + '┐';
  const bottomBorder = '└' + '─'.repeat(width - 2) + '┘';
  const padding = Math.max(0, width - 4 - title.length);
  const titleLine = '│ ' + title + ' '.repeat(padding) + ' │';

  return [topBorder, titleLine, bottomBorder].join('\n');
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

  const actionLinks = isLoggedIn
    ? `[🔑 API Keys](/api-keys) | [➕ Add to Cursor](${CURSOR_INSTALL_LINK})`
    : `[📝 Sign Up](/login?mode=signup) | [🔐 Log In](/login)`;

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
      const errorContent = `
${actionLinks}

[← Root](/)

${createAsciiHeader('ERROR')}

File could not be retrieved: ${fileError?.message || 'Unknown error'}
`;

    return (
      <div className="preview-container">
        <div className="preview-content">
          <ReactMarkdown>{errorContent}</ReactMarkdown>
        </div>
      </div>
    );
    }

    const fileContent = await fileData.text();

    // Build navigation
    let nav = '[← Root](/)';
    if (pathSegments.length > 1) {
      const upPath = pathSegments.slice(0, -1).join('/');
      nav += ` | [↑ Up](/${upPath})`;
    }

    const framedContent = wrapInAsciiFrame(fileContent, 96);

    const topMarkdown = `
${actionLinks}

${nav}

${createAsciiHeader(`📄 ${route || 'Root'}`)}
`;

    const framedMarkdown = `
\`\`\`
${framedContent}
\`\`\`

${nav}
`;

    const formattedDate = new Date(indexData.updated_at).toLocaleDateString();

    return (
      <div className="preview-container">
        <div className="preview-content">
          <ReactMarkdown>{topMarkdown}</ReactMarkdown>
          <div className="file-metadata">
            <p>File: {indexData.file_name}</p>
            <p>Updated: {formattedDate}</p>
            <CopyButton text={fileContent} ariaLabel="Copy file content" />
          </div>
          <ReactMarkdown>{framedMarkdown}</ReactMarkdown>
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

    // Build navigation
    let nav = '';
    if (route.length > 0) {
      nav = '[← Root](/)';
      if (pathSegments.length > 1) {
        const upPath = pathSegments.slice(0, -1).join('/');
        nav += ` | [↑ Up](/${upPath})`;
      }
      nav += '\n\n';
    }

    // Build directory listing - create framed content with markdown links
    const listingLines = sortedChildren.map(([name, info]) => {
      const icon = info.file_name ? '[FILE]' : '[DIR] ';
      const fileName = info.file_name ? ` (${info.file_name})` : '';
      return `${icon} [${name}](/${info.route})${fileName}`;
    });

    // If we're at the root, also show recently added files
    const isRootRoute = route.length === 0;
    let recentlyAddedSection = '';
    if (isRootRoute) {
      const { data: recentFiles } = await supabase
        .from('wiki_files_index')
        .select('route, file_name, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (recentFiles && recentFiles.length > 0) {
        const recentLines = recentFiles.map(file => {
          const date = new Date(file.updated_at).toLocaleDateString();
          return `[${file.route}](/${file.route}) - ${file.file_name} (${date})`;
        });

        recentlyAddedSection = `

${createAsciiHeader('📅 RECENTLY ADDED')}

Last ${recentFiles.length} updated files

${renderFramedMarkdown(recentLines)}
`;
      }
    }

    const markdownContent = `
${actionLinks}

${nav}${createAsciiHeader(`📁 ${route || 'AI WIKI - ROOT'}`)}

Directory listing - ${sortedChildren.length} item(s)

${renderFramedMarkdown(listingLines)}${recentlyAddedSection}
`;

    return (
      <div className="preview-container">
        <div className="preview-content">
          <ReactMarkdown>{markdownContent}</ReactMarkdown>
        </div>
      </div>
    );
  }

  // Nothing found
  const markdownContent = `
${actionLinks}

[← Root](/)

${createAsciiHeader('404 - NOT FOUND')}

No files or directories found at route: ${route || '(root)'}
`;

  return (
    <div className="preview-container">
      <div className="preview-content">
        <ReactMarkdown>{markdownContent}</ReactMarkdown>
      </div>
    </div>
  );
}
