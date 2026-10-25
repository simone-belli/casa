"use client";

import { useState } from "react";
import { ui } from "@/components/ui";
import type { Groceries, Store } from "@/lib/groceries/types";
import type { AislesResponse } from "@/app/api/groceries/aisles/route";

/** Asks Claude to file this supermarket's unsorted items under their likeliest aisles. */
export function SuggestAisles({ store, data }: { store: Store; data: Groceries }) {
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  const hasAisles = data.aisles.some((a) => a.store_id === store.id);
  const filed = new Set(data.itemAisles.filter((f) => f.store_id === store.id).map((f) => f.item_id));
  const unsorted = data.items.filter((i) => !i.is_one_off && !filed.has(i.id)).length;

  async function suggest() {
    setStatus("working");
    setMessage(null);
    try {
      const response = await fetch("/api/groceries/aisles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: store.id }),
      });
      const body = (await response.json().catch(() => ({ error: "The server didn't answer. Please try again." }))) as AislesResponse;
      if ("error" in body) setMessage({ text: body.error, failed: true });
      else
        setMessage({
          text: `Sorted ${body.filed} items${body.left > 0 ? `; ${body.left} still to sort by hand` : ""}. Fix any that are wrong with ⋯ on the item, or as you shop.`,
          failed: false,
        });
    } catch {
      setMessage({ text: "Couldn't reach the app. Check your connection.", failed: true });
    }
    setStatus("idle");
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <button type="button" onClick={() => void suggest()} disabled={!hasAisles || unsorted === 0 || status === "working"} className={ui.secondary}>
        {status === "working" ? "Sorting… (up to a minute)" : `Suggest aisles for ${unsorted} unsorted items`}
      </button>
      {!hasAisles && <p className="text-sm text-muted">Add the aisles first.</p>}
      {message && <p className={message.failed ? ui.error : "text-sm text-brand"}>{message.text}</p>}
    </div>
  );
}
