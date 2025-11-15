'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/retroui/Button';

interface CopyButtonProps {
  text: string;
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export function CopyButton({ text, ariaLabel = 'Copy content', size = 'sm' }: CopyButtonProps) {
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
    <Button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      aria-label={ariaLabel}
      variant="outline"
      size={size}
    >
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  );
}
