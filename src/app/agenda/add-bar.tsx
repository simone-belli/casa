"use client";

import { useState } from "react";
import { ui } from "@/components/ui";
import type { ParseAgendaResponse } from "@/app/api/agenda/parse/route";
import { draftFromQuickAdd, newDraft, type Draft } from "@/lib/agenda/draft";
import { zonedParts } from "@/lib/agenda/time";
import type { ItemKind } from "@/lib/agenda/types";
import type { Viewer } from "@/lib/agenda/views";

type Props = {
  viewer: Viewer;
  /** What a bare "+" adds: an event on the chosen day, or an undated task. */
  kind: ItemKind;
  date?: string;
  onDraft: (draft: Draft) => void;
};

/**
 * Type or dictate a line like "Marco's birthday party Saturday 7pm": Claude
 * fills in the form, which opens for checking before anything is saved.
 */
export function AddBar({ viewer, kind, date, onDraft }: Props) {
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const line = text.trim();
    const blank = newDraft(kind, viewer.timeZone, kind === "event" ? (date ?? viewer.today) : undefined);
    setError(null);
    if (!line) return onDraft(blank);

    setReading(true);
    try {
      const response = await fetch("/api/agenda/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: line,
          today: viewer.today,
          now: zonedParts(new Date(), viewer.timeZone).time,
          timeZone: viewer.timeZone,
        }),
      });
      const body = (await response.json().catch(() => ({ error: "The server didn't answer." }))) as ParseAgendaResponse;
      if ("error" in body) {
        setError(`${body.error} Fill in the rest yourself.`);
        onDraft({ ...blank, title: line });
      } else {
        onDraft(draftFromQuickAdd(body.item, blank));
      }
      setText("");
    } catch {
      setError("Couldn't reach the app to read that. Fill in the rest yourself.");
      onDraft({ ...blank, title: line });
      setText("");
    }
    setReading(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!reading) void add();
        }}
      >
        <input
          type="text"
          enterKeyHint="go"
          autoComplete="off"
          placeholder={kind === "event" ? "e.g. Marco's party Saturday 7pm" : "e.g. Book the boiler service"}
          aria-label="Add something: type or dictate"
          value={text}
          disabled={reading}
          onChange={(e) => setText(e.target.value)}
          className={`${ui.input} rounded-full px-4`}
        />
        <button type="submit" disabled={reading} aria-label="Add" className={`${ui.primary} w-11 shrink-0 px-0 text-2xl`}>
          {reading ? <span className="text-base">…</span> : "+"}
        </button>
      </form>
      {reading && <p className="px-2 text-sm text-muted">Reading…</p>}
      {error && (
        <button type="button" onClick={() => setError(null)} className={`${ui.error} w-full text-left`}>
          {error} <span className="underline">OK</span>
        </button>
      )}
    </div>
  );
}
