import { NextResponse } from "next/server";
import { disconnect } from "@/lib/google/sync";
import { currentMember } from "@/lib/supabase/server";

/** Stops syncing. Nothing is deleted from Agenda or from Google. */
export async function POST() {
  if (!(await currentMember())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    await disconnect();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't disconnect." }, { status: 502 });
  }
}
