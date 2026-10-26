import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { calendars, pickCalendar } from "@/lib/google/sync";
import { publicOrigin } from "@/lib/origin";
import { currentMember } from "@/lib/supabase/server";

export const maxDuration = 300;

export type CalendarsResponse = { calendars: { id: string; name: string; primary: boolean }[] } | { error: string };

/** The calendars of the connected account that Casa can change. */
export async function GET(): Promise<NextResponse<CalendarsResponse>> {
  if (!(await currentMember())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    const list = await calendars();
    return NextResponse.json({
      calendars: list.map((c) => ({ id: c.id, name: c.summary, primary: Boolean(c.primary) })).sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't list the calendars." }, { status: 502 });
  }
}

const pickSchema = z.object({ calendarId: z.string().min(1).max(500) });

/** Picks the Casa calendar and syncs everything once. */
export async function POST(request: NextRequest): Promise<NextResponse<{ ok: true; error?: string } | { error: string }>> {
  if (!(await currentMember())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = pickSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pick a calendar." }, { status: 400 });

  const origin = publicOrigin(request);
  // Google only sends change notifications to an https address.
  const notify = origin.startsWith("https://") ? `${origin}/api/agenda/google/notify` : null;
  try {
    const result = await pickCalendar(body.data.calendarId, notify);
    return NextResponse.json({ ok: true, ...(result.error ? { error: result.error } : {}) });
  } catch (error) {
    console.error("Picking the Casa calendar failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't use that calendar." }, { status: 502 });
  }
}
