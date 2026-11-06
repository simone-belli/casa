"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Subscribes to live updates, calling `catchUp` each time the connection
 * comes back after dropping (patchy reception, a phone waking up): changes
 * made while it was down never arrive as live updates, so they're loaded.
 */
export function subscribeWithCatchUp(channel: RealtimeChannel, catchUp: () => void): RealtimeChannel {
  let connectedBefore = false;
  return channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    if (connectedBefore) catchUp();
    connectedBefore = true;
  });
}
