import { useState, useMemo } from 'react';

const PAGE_SIZE = 10; // P2-C Pagination page size

export function usePaginatedItems<T>(items: T[]) {
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  const paginatedItems = useMemo(() => {
    return items.slice(0, visibleCount);
  }, [items, visibleCount]);

  const hasMore = visibleCount < items.length;

  const loadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, items.length));
  };

  const resetPagination = () => {
    setVisibleCount(PAGE_SIZE);
  };

  return {
    items: paginatedItems,
    hasMore,
    loadMore,
    totalCount: items.length,
    visibleCount: Math.min(visibleCount, items.length),
    resetPagination,
  };
}
