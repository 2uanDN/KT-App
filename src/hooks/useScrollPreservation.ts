import { useEffect, useRef } from 'react';

export function useScrollPreservation(screenKey: string) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(`scroll:${screenKey}`);
    if (saved && listRef.current) {
      listRef.current.scrollTop = parseInt(saved, 10);
    }
    return () => {
      if (listRef.current) {
        sessionStorage.setItem(`scroll:${screenKey}`, String(listRef.current.scrollTop));
      }
    };
  }, [screenKey]);

  return listRef;
}
