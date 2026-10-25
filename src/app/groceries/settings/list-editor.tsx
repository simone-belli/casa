"use client";

import { useState } from "react";
import { ui } from "@/components/ui";

type Row = { id: string; name: string };

type Props = {
  rows: Row[];
  /** What one row is called, e.g. "place" or "aisle". */
  noun: string;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  /** Saves the new order, as the ids in order. */
  onReorder: (ids: string[]) => void;
  onDelete: (row: Row) => void;
};

const small =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-muted active:bg-bg disabled:opacity-25";

/** An ordered list of names that can be added to, renamed, moved and deleted. */
export function ListEditor({ rows, noun, onAdd, onRename, onReorder, onDelete }: Props) {
  const [adding, setAdding] = useState("");

  const move = (index: number, by: -1 | 1) => {
    const ids = rows.map((r) => r.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    onReorder(ids);
  };

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col">
        {rows.map((row, index) => (
          <li key={row.id} className="flex items-center gap-1 border-b border-line py-1 last:border-b-0">
            <input
              key={row.name}
              defaultValue={row.name}
              aria-label={`${noun} name`}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (!name) e.target.value = row.name;
                else if (name !== row.name) onRename(row.id, name);
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-2 focus:bg-bg focus:outline-none"
            />
            <button type="button" className={small} aria-label={`Move ${row.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>
              ↑
            </button>
            <button type="button" className={small} aria-label={`Move ${row.name} down`} disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
              ↓
            </button>
            <button type="button" className={`${small} text-danger`} aria-label={`Delete ${row.name}`} onClick={() => onDelete(row)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!adding.trim()) return;
          onAdd(adding.trim());
          setAdding("");
        }}
      >
        <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder={`New ${noun}`} className={ui.input} />
        <button type="submit" disabled={!adding.trim()} className={ui.secondary}>
          Add
        </button>
      </form>
    </div>
  );
}
