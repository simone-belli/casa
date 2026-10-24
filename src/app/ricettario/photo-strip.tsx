"use client";

import { useEffect, useState } from "react";
import { photoUrls } from "@/lib/recipes/db";

/** Thumbnails of a recipe's original photos; tap one to open it full size. */
export function PhotoStrip({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  const key = paths.join("|");

  useEffect(() => {
    let cancelled = false;
    photoUrls(key ? key.split("|") : []).then(
      (list) => !cancelled && setUrls(list),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (paths.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {paths.map((path, i) =>
        urls[i] ? (
          <a key={path} href={urls[i]} target="_blank" rel="noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs from private storage */}
            <img src={urls[i]} alt={`Original photo ${i + 1}`} className="h-28 w-24 rounded-lg border border-line object-cover" />
          </a>
        ) : (
          <div key={path} className="h-28 w-24 shrink-0 animate-pulse rounded-lg bg-line" />
        ),
      )}
    </div>
  );
}
