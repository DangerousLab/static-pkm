import { useState, useEffect } from 'react';
import { useDebounce } from './useDebounce';

export function useLayoutWidth(
  ref: React.RefObject<HTMLElement | null>,
  debounceMs: number = 50
): number {
  const [width, setWidth] = useState<number>(0);
  const debouncedWidth = useDebounce(width, debounceMs);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(w);
    });
    
    ro.observe(ref.current);
    // Set initial value synchronously
    setWidth(ref.current.getBoundingClientRect().width);
    
    return () => {
      ro.disconnect();
    };
  }, [ref]);

  return debouncedWidth;
}
