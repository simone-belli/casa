import { after, NextResponse } from "next/server";
import { isOurChannel, syncNow } from "@/lib/google/sync";

export const maxDuration = 300;

/**
 * Google calls this whenever the Casa calendar changes. It's public (Google
 * isn't signed in), so it only acts on our own subscription's id and secret
 * token, and only ever triggers a sync.
 */
export async function POST(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id");
  const token = request.headers.get("x-goog-channel-token");
  if (!(await isOurChannel(channelId, token))) return new NextResponse(null, { status: 404 });
  // "sync" is the hello sent when the subscription starts.
  if (request.headers.get("x-goog-resource-state") !== "sync") {
    after(() => syncNow());
  }
  return new NextResponse(null, { status: 200 });
}
