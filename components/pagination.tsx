'use client';

import { Button } from '@/components/retroui/Button';
import Link from 'next/link';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseRoute: string;
}

export function Pagination({ currentPage, totalPages, baseRoute }: PaginationProps) {
  const createPageUrl = (page: number) => {
    return `${baseRoute}?page=${page}`;
  };

  // Always render container to maintain consistent height
  if (totalPages <= 1) {
    return <div className="h-[44px] mt-4" />;
  }

  const pages = [];
  const maxPagesToShow = 7;

  if (totalPages <= maxPagesToShow) {
    // Show all pages
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    // Show first page, last page, current page and surrounding pages
    if (currentPage <= 3) {
      // Near the start
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push(-1); // Ellipsis
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      // Near the end
      pages.push(1);
      pages.push(-1); // Ellipsis
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      // In the middle
      pages.push(1);
      pages.push(-1); // Ellipsis
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push(-2); // Another ellipsis
      pages.push(totalPages);
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      {currentPage > 1 ? (
        <Link href={createPageUrl(currentPage - 1)}>
          <Button variant="secondary" size="sm">←</Button>
        </Link>
      ) : (
        <Button variant="secondary" size="sm">←</Button>
      )}

      <div className="flex gap-1">
        {pages.map((page, index) => {
          if (page < 0) {
            // Ellipsis
            return (
              <span key={`ellipsis-${index}`} className="px-2 py-1">
                ...
              </span>
            );
          }

          if (page === currentPage) {
            return (
              <Button key={page} variant="default" size="sm" disabled>
                {page}
              </Button>
            );
          }

          return (
            <Link key={page} href={createPageUrl(page)}>
              <Button variant="secondary" size="sm">
                {page}
              </Button>
            </Link>
          );
        })}
      </div>

      {currentPage < totalPages ? (
        <Link href={createPageUrl(currentPage + 1)}>
          <Button variant="secondary" size="sm">→</Button>
        </Link>
      ) : (
        <Button variant="secondary" size="sm">→</Button>
      )}
    </div>
  );
}
