"use client";

import { useCallback, useEffect, useState } from "react";

/** A setting kept on this phone only (e.g. the chosen supermarket). */
export function useDeviceSetting<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists in the browser
      if (stored !== null) setValue(JSON.parse(stored) as T);
    } catch {
      // Private browsing or blocked storage: use the default.
    }
  }, [key]);
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Not remembered, but still works for this visit.
      }
    },
    [key],
  );
  return [value, set];
}
