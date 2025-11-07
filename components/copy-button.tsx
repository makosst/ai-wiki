'use client';

import { useEffect, useRef, useState } from 'react';

interface CopyButtonProps {
  text: string;
  ariaLabel?: string;
}

export function CopyButton({ text, ariaLabel = 'Copy content' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy content', error);
    }
  };

  return (
    <button
      type="button"
      className="copy-button"
      onClick={handleCopy}
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
