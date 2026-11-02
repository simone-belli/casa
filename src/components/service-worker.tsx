"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js. Browsers only allow this over https (or on localhost).
 * It only keeps files in production builds; see public/sw.js.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (window.isSecureContext && "serviceWorker" in navigator) {
      const caching = process.env.NODE_ENV === "production" ? "1" : "0";
      navigator.serviceWorker.register(`/sw.js?cache=${caching}`).catch(() => {});
    }
  }, []);
  return null;
}
