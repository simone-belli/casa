import { NextResponse } from "next/server";

/**
 * Prints errors from the phones in the server logs (Vercel → Logs, or the
 * terminal when running locally), since there's no easy way to see an
 * iPhone's browser console.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (body) {
    const field = (key: string) => String(body[key] ?? "").slice(0, 2000);
    console.error(`[phone] ${field("message")}\n  page: ${field("page")}\n  device: ${field("device")}\n${field("stack")}`);
  }
  return new NextResponse(null, { status: 204 });
}
