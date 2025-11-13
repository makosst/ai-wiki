'use client';

import { useState, createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/retroui/Button';

interface ViewToggleProps {
  content: string;
  framedContent: string;
}

interface ViewToggleContextValue {
  viewMode: 'plain' | 'markdown';
  toggleView: () => void;
}

const ViewToggleContext = createContext<ViewToggleContextValue | null>(null);

export function ViewToggleProvider({ children, content, framedContent }: ViewToggleProps & { children: React.ReactNode }) {
  const [viewMode, setViewMode] = useState<'plain' | 'markdown'>('markdown');

  const toggleView = () => {
    setViewMode(prev => prev === 'plain' ? 'markdown' : 'plain');
  };

  return (
    <ViewToggleContext.Provider value={{ viewMode, toggleView }}>
      {children}
    </ViewToggleContext.Provider>
  );
}

export function ViewToggleButton() {
  const context = useContext(ViewToggleContext);
  if (!context) throw new Error('ViewToggleButton must be used within ViewToggleProvider');

  return (
    <Button
      type="button"
      onClick={context.toggleView}
      aria-label="Toggle between markdown and plain text view"
      variant="outline"
      size="sm"
    >
      {context.viewMode === 'plain' ? 'Markdown' : 'Plain'}
    </Button>
  );
}

export function ViewToggleContent({ content, framedContent }: ViewToggleProps) {
  const context = useContext(ViewToggleContext);
  if (!context) throw new Error('ViewToggleContent must be used within ViewToggleProvider');

  return context.viewMode === 'plain' ? (
    <div className="markdown-framed">
      <div className="markdown-content-wrapper">
        <div className="markdown-view">
          <pre className="whitespace-pre-wrap break-words font-mono text-base m-0 p-0">
            {content}
          </pre>
        </div>
      </div>
    </div>
  ) : (
    <div className="markdown-framed">
      <div className="markdown-content-wrapper">
        <div className="markdown-view">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
