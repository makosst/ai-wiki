'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface ViewToggleProps {
  content: string;
  framedContent: string;
}

function createMarkdownFrame(content: string): { top: string; bottom: string } {
  const width = 96;
  const topBorder = '╔' + '═'.repeat(width - 2) + '╗';
  const bottomBorder = '╚' + '═'.repeat(width - 2) + '╝';

  return { top: topBorder, bottom: bottomBorder };
}

export function ViewToggle({ content, framedContent }: ViewToggleProps) {
  const [viewMode, setViewMode] = useState<'plain' | 'markdown'>('markdown');
  const [borderLines, setBorderLines] = useState(100);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && viewMode === 'markdown') {
      // Wait for next frame to ensure content is rendered
      requestAnimationFrame(() => {
        if (contentRef.current) {
          const height = contentRef.current.offsetHeight;
          const computedStyle = window.getComputedStyle(contentRef.current);
          const lineHeight = parseFloat(computedStyle.lineHeight) || 16;
          const lines = Math.ceil(height / lineHeight);
          setBorderLines(Math.max(lines, 50));
        }
      });
    }
  }, [content, viewMode]);

  const toggleView = () => {
    setViewMode(prev => prev === 'plain' ? 'markdown' : 'plain');
  };

  const frame = createMarkdownFrame(content);
  const leftBorder = Array(borderLines).fill('║').join('\n');
  const rightBorder = Array(borderLines).fill('║').join('\n');

  return (
    <div>
      <div className="file-actions">
        <button
          type="button"
          className="view-toggle-button"
          onClick={toggleView}
          aria-label="Toggle between markdown and plain text view"
        >
          {viewMode === 'plain' ? 'Markdown' : 'Plain'}
        </button>
      </div>

      {viewMode === 'plain' ? (
        <ReactMarkdown>{`\`\`\`\n${framedContent}\n\`\`\``}</ReactMarkdown>
      ) : (
        <div className="markdown-framed"><pre className="frame-border">{frame.top}</pre><div className="markdown-content-wrapper"><pre className="markdown-side-border">{leftBorder}</pre><div className="markdown-view" ref={contentRef}><ReactMarkdown>{content}</ReactMarkdown></div><pre className="markdown-side-border">{rightBorder}</pre></div><pre className="frame-border">{frame.bottom}</pre></div>
      )}
    </div>
  );
}
