"use client";

import { useState } from "react";
import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

const MAX_LENGTH = 10000;

export function BugReportForm() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send() {
    setStatus("sending");
    const { error } = await supabaseBrowser()
      .from("bug_reports")
      .insert({ description: text.trim(), device: navigator.userAgent });
    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <div className={`${ui.card} flex flex-col gap-4 text-center`}>
        <p className="font-display text-xl">Thanks, it&apos;s been sent</p>
        <p className="text-muted">We&apos;ll look into it.</p>
        <div className="flex flex-col gap-2">
          <SafeLink href="/" className={ui.primary}>
            Back to Casa
          </SafeLink>
          <button
            type="button"
            onClick={() => {
              setText("");
              setStatus("idle");
            }}
            className={ui.secondary}
          >
            Report another
          </button>
        </div>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <div className="flex flex-col gap-4">
      <div className={ui.card}>
        <label htmlFor="bug-text" className={ui.label}>
          What went wrong? Type it, or tap the microphone on your keyboard and say it. Mention which section you were in and what you
          expected to happen.
        </label>
        <textarea
          id="bug-text"
          rows={10}
          maxLength={MAX_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sending}
          className={ui.input}
          placeholder="In Groceries, when I tick an item in the shop view…"
        />
      </div>

      {status === "error" && <p className={ui.error}>Couldn&apos;t send it. Check your connection and try again.</p>}

      <button type="button" disabled={!text.trim() || sending} onClick={send} className={ui.primary}>
        {sending ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
