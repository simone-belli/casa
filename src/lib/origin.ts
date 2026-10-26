import type { NextRequest } from "next/server";

/**
 * The address the browser used to reach the app, e.g.
 * https://casa-pi-weld.vercel.app or http://localhost:3000. Read from the
 * Host header (and the proxy's X-Forwarded-* headers on Vercel), because
 * request.nextUrl reports the address the server listens on, which is
 * 0.0.0.0 with `npm run dev` and `npm run lan`.
 */
export function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}
