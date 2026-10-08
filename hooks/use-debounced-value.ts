"use client";

import { useEffect, useState } from "react";

/**
 * Debounce a fast-changing value (search inputs) before it is fed into a
 * query key or URL. Falls back to the raw value after `delayMs` of inactivity.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
