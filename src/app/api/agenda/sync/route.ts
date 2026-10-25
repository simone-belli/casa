import { NextResponse } from "next/server";
import { missingConfig } from "@/lib/google/calendar";
import { syncNow, type SyncResult } from "@/lib/google/sync";
import { currentMember } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Called by the phones when Agenda opens and after each change. */
export async function POST(): Promise<NextResponse<SyncResult | { error: string }>> {
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  // Google sync not set up on this server: nothing to do.
  if (missingConfig().length > 0) return NextResponse.json({ connected: false });
  return NextResponse.json(await syncNow());
}
