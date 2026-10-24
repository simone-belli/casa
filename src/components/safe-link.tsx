"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { navigateWithFallback } from "@/lib/navigation";

/** next/link with a full-page-load fallback; see navigateWithFallback. */
export function SafeLink({ onClick, href, ...props }: ComponentProps<typeof Link> & { href: string }) {
  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (!event.defaultPrevented && !modified) navigateWithFallback(href);
      }}
      {...props}
    />
  );
}
