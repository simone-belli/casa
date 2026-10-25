import { NextResponse } from "next/server";
import { z } from "zod";
import { describeClaudeError } from "@/lib/ai/errors";
import { ParseError, parseAgenda, type ParsedAgenda } from "@/lib/ai/parse-agenda";
import { isDate, isTimeZone } from "@/lib/agenda/time";
import { currentMember } from "@/lib/supabase/server";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(500),
  /** The phone's today, local time and time zone, so "Saturday 7pm" means the right day. */
  today: z.string().refine(isDate),
  now: z.string().regex(/^\d{2}:\d{2}$/),
  timeZone: z.string().refine(isTimeZone),
});

export type ParseAgendaResponse = { item: ParsedAgenda } | { error: string };

export async function POST(request: Request): Promise<NextResponse<ParseAgendaResponse>> {
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Nothing to read." }, { status: 400 });

  const { data: members } = await member.supabase.rpc("household_members");
  const list = (members ?? []) as { user_id: string; display_name: string }[];
  const speaker = list.find((m) => m.user_id === member.user.id)?.display_name ?? "the writer";
  const other = list.find((m) => m.user_id !== member.user.id)?.display_name ?? "the other person";

  try {
    const { text, today, now, timeZone } = body.data;
    return NextResponse.json({ item: await parseAgenda(text, { today, now, timeZone, speaker, other }) });
  } catch (error) {
    if (error instanceof ParseError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("Reading an agenda line failed", error);
    return NextResponse.json({ error: describeClaudeError(error) }, { status: 502 });
  }
}
