'use client';

import { useState, useEffect, useRef, createContext, useContext } from 'react';
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

function createMarkdownFrame(width: number = 96): { top: string; bottom: string } {
  const topBorder = '╔' + '═'.repeat(Math.max(0, width - 2)) + '╗';
  const bottomBorder = '╚' + '═'.repeat(Math.max(0, width - 2)) + '╝';

  return { top: topBorder, bottom: bottomBorder };
}

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

  const [borderLines, setBorderLines] = useState(100);
  const [frameWidth, setFrameWidth] = useState(96);
  const [isMobile, setIsMobile] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current || !contentRef.current || !wrapperRef.current) return;

      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!contentRef.current || !wrapperRef.current) return;

          const computedStyle = window.getComputedStyle(wrapperRef.current);
          const fontSize = parseFloat(computedStyle.fontSize) || 16;

          // Calculate number of lines needed - the wrapper height determines this
          const wrapperHeight = wrapperRef.current.scrollHeight;
          const borderLineHeight = fontSize; // line-height: 1 means 1em

          const calculatedLines = Math.ceil(wrapperHeight / borderLineHeight);
          setBorderLines(Math.max(calculatedLines, 10));

          // Calculate frame width based on actual wrapper width in pixels
          const wrapperWidthPx = wrapperRef.current.offsetWidth;
          const chWidth = fontSize * 0.6; // Approximate width of a monospace character

          // Calculate number of characters that exactly match the wrapper width
          let calculatedWidth = Math.round(wrapperWidthPx / chWidth);

          if (mobile) {
            calculatedWidth = Math.min(calculatedWidth, 120);
            calculatedWidth = Math.max(calculatedWidth, 40);
          } else {
            calculatedWidth = Math.min(calculatedWidth, 120);
            calculatedWidth = Math.max(calculatedWidth, 50);
          }

          setFrameWidth(calculatedWidth);
        });
      });
    };

    // Initial update
    updateDimensions();

    // Update on resize
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    if (wrapperRef.current) {
      resizeObserver.observe(wrapperRef.current);
    }

    window.addEventListener('resize', updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [content, context.viewMode]);

  const frame = createMarkdownFrame(frameWidth);
  const leftBorder = Array(borderLines).fill('║').join('\n');
  const rightBorder = Array(borderLines).fill('║').join('\n');

  return context.viewMode === 'plain' ? (
    isMobile ? (
      <div className="plain-text-mobile"><ReactMarkdown>{`\`\`\`\n${content}\n\`\`\``}</ReactMarkdown></div>
    ) : (
      <ReactMarkdown>{`\`\`\`\n${framedContent}\n\`\`\``}</ReactMarkdown>
    )
  ) : (
    <div className="markdown-framed" ref={containerRef}><div className="markdown-content-wrapper" ref={wrapperRef}><div className="markdown-view" ref={contentRef}><ReactMarkdown>{content}</ReactMarkdown></div></div></div>
  );
}
