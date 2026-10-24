"use client";

import { useEffect } from "react";

/** Registers /sw.js. Browsers only allow this over https (or on localhost). */
export function ServiceWorker() {
  useEffect(() => {
    if (window.isSecureContext && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
