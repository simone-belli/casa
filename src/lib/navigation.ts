"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

/** How long an in-app navigation may take before we fall back to a full page load. */
const FALLBACK_MS = 2500;

let pending: number | undefined;

/**
 * Safari home-screen apps can leave an in-app navigation hanging after the app
 * has been in the background (a request suspended with the app never
 * settles). If the page still hasn't changed shortly after a navigation
 * starts, load the target normally instead, so a tap always gets somewhere.
 */
export function navigateWithFallback(href: string, mode: "push" | "replace" = "push") {
  const target = new URL(href, window.location.href);
  const from = window.location.href;
  // Only the latest navigation counts; an older one must never pull the
  // person back after they've moved on.
  window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    if (window.location.href !== from || target.href === from) return;
    if (mode === "replace") window.location.replace(target.href);
    else window.location.assign(target.href);
  }, FALLBACK_MS);
}

/** useRouter() whose push/replace fall back to a full page load if they hang. */
export function useSafeRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      push(href: string) {
        router.push(href);
        navigateWithFallback(href, "push");
      },
      replace(href: string) {
        router.replace(href);
        navigateWithFallback(href, "replace");
      },
      refresh: () => router.refresh(),
    }),
    [router],
  );
}
