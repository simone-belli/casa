import { NextResponse } from "next/server";
import { renewWatch, syncNow } from "@/lib/google/sync";

export const maxDuration = 300;

/**
 * Run daily by Vercel Cron (see vercel.json): renews Google's change
 * notifications before they expire, and syncs once as a safety net.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }
  try {
    await renewWatch();
  } catch (error) {
    console.error("Renewing Google change notifications failed", error);
  }
  return NextResponse.json(await syncNow());
}
