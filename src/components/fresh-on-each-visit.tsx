"use client";

import { Fragment, useEffect, useState } from "react";

/**
 * Next.js keeps recently visited pages alive but hidden, with their state, so
 * coming back to a form would show the abandoned draft. Effects are cleaned up
 * when a page is hidden; we use that moment to remount the children, so every
 * visit starts fresh.
 */
export function FreshOnEachVisit({ children }: { children: React.ReactNode }) {
  const [visit, setVisit] = useState(0);
  useEffect(() => () => setVisit((v) => v + 1), []);
  return <Fragment key={visit}>{children}</Fragment>;
}
