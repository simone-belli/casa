import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const MODEL = "claude-sonnet-5-5";

const parsedSchema = z.object({
  kind: z.enum(["event", "task"]),
  title: z.string(),
  /** YYYY-MM-DD, or null when no day is mentioned. */
  date: z.string().nullable(),
  /** Last day of a multi-day item (inclusive), or null. */
  end_date: z.string().nullable(),
  /** HH:MM (24-hour), or null when no time is mentioned. */
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  assignee: z.enum(["unassigned", "speaker", "other", "both"]),
  repeat: z.object({
    freq: z.enum(["none", "daily", "weekly", "monthly", "yearly"]),
    interval: z.number(),
    /** Weekly: 0 = Sunday … 6 = Saturday. */
    weekdays: z.array(z.number()),
    monthly_by: z.enum(["day", "weekday"]),
    until: z.string().nullable(),
  }),
  /** Minutes before the start, or null. */
  reminder_minutes: z.number().nullable(),
  note: z.string().nullable(),
});
export type ParsedAgenda = z.infer<typeof parsedSchema>;

const SYSTEM_PROMPT = `You help Simone and Kat add things to Agenda, their shared calendar and to-do list. One of them types or dictates a single line, and you turn it into the fields of one event or task. They check and correct the result in a form before it's saved, so leave out anything that isn't said rather than guessing.

Fields:
- "kind": "event" for something that happens at a time and that people attend or that takes place (a party, an appointment, a trip, a visit). "task" for something to get done (book, buy, call, fix, pay, take out). If unsure, "task".
- "title": short and natural, in the language it was written in (often English or Italian); do not translate. Drop the parts that became other fields (the day, time, who it's for, how often), e.g. "Marco's birthday party Saturday 7pm" becomes "Marco's birthday party".
- "date": the day, as YYYY-MM-DD, worked out from today's date given below. A weekday name means the next one after today ("Saturday" on a Saturday means a week later, unless they say "today"). "Tonight" and "this evening" are today. null if no day is mentioned.
- "end_date": only for something that spans several days ("Rome trip Friday to Sunday"); otherwise null.
- "start_time" / "end_time": 24-hour HH:MM. null when not mentioned. "Morning", "afternoon" and similar on their own aren't times: leave them null. Don't invent an end time.
- "assignee": who it's for. "speaker" when the writer says it's for them ("I need to", "remind me to", "for me"); "other" when it's for the other person by name or "you"; "both" for both of them ("we", "us", "both of us", "together"); otherwise "unassigned". Things like a party they attend together are "both" only if the line says so.
- "repeat": only if it repeats ("every Tuesday", "every two weeks", "monthly", "on the last Friday of the month"). freq "none" otherwise. "interval" is 1 unless said ("every 2 weeks" is 2). "weekdays" lists the days for a weekly repeat, 0 = Sunday to 6 = Saturday (empty means the start day's weekday). "monthly_by" is "weekday" for "the first Monday"-style rules, else "day". "until" is a YYYY-MM-DD end date if one is said. If it repeats but no start day is mentioned, set "date" to the first matching day from today.
- "reminder_minutes": only if a reminder is asked for ("remind me an hour before" is 60, "the day before" is 1440, "at the time" is 0); otherwise null.
- "note": anything useful left over that isn't part of the title (an address, a detail); usually null.`;

export class ParseError extends Error {}

export type ParseContext = {
  /** Today in the writer's time zone, YYYY-MM-DD. */
  today: string;
  /** The current local time, HH:MM. */
  now: string;
  timeZone: string;
  speaker: string;
  other: string;
};

/** Reads one typed or dictated line into the fields of an event or task. */
export async function parseAgenda(text: string, context: ParseContext): Promise<ParsedAgenda> {
  const weekday = new Date(`${context.today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(parsedSchema) },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Today is ${weekday} ${context.today}, ${context.now} (${context.timeZone}). Written by ${context.speaker}; the other person is ${context.other}.\n<line>\n${text}\n</line>`,
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new ParseError("The AI declined to read that.");
  if (!response.parsed_output) throw new ParseError("The AI's answer couldn't be read. Please try again.");
  return response.parsed_output;
}
