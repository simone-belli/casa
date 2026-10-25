"use client";

import { useState } from "react";
import { ui } from "@/components/ui";
import { newDraft, type Draft } from "@/lib/agenda/draft";
import type { ItemKind } from "@/lib/agenda/types";
import type { Viewer } from "@/lib/agenda/views";

type Props = {
  viewer: Viewer;
  /** What a bare "+" adds: an event on the chosen day, or an undated task. */
  kind: ItemKind;
  date?: string;
  onDraft: (draft: Draft) => void;
};

/** Type a line to add something; the form opens to check it before saving. */
export function AddBar({ viewer, kind, date, onDraft }: Props) {
  const [text, setText] = useState("");

  const open = () => {
    const draft = newDraft(kind, viewer.timeZone, kind === "event" ? (date ?? viewer.today) : undefined);
    onDraft({ ...draft, title: text.trim() });
    setText("");
  };

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        open();
      }}
    >
      <input
        type="text"
        enterKeyHint="go"
        autoComplete="off"
        placeholder={kind === "event" ? "Add an event or task…" : "Add a task or event…"}
        aria-label="Add something"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={`${ui.input} rounded-full px-4`}
      />
      <button type="submit" aria-label="Add" className={`${ui.primary} w-11 shrink-0 px-0 text-2xl`}>
        +
      </button>
    </form>
  );
}
