"use client";

import { monthLabel } from "@/lib/agenda/format";
import { addDays, addMonths, dateParts, startOfMonth, startOfWeek } from "@/lib/agenda/time";

type Props = {
  /** Any day in the month shown. */
  month: string;
  today: string;
  selected: string;
  /** Number of items on each busy day. */
  busy: Map<string, number>;
  onMonth: (month: string) => void;
  onPick: (date: string) => void;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** A month at a glance, Monday first; tap a day to jump to it. */
export function MonthGrid({ month, today, selected, busy, onMonth, onPick }: Props) {
  const first = startOfMonth(month);
  const gridStart = startOfWeek(first);
  const { month: shown } = dateParts(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  // Drop a last row that's entirely next month.
  const visible = dateParts(days[35]).month !== shown ? days.slice(0, 35) : days;

  return (
    <section className="rounded-2xl border border-line bg-surface p-3 shadow-sm" aria-label={monthLabel(first)}>
      <div className="flex items-center justify-between pb-2">
        <button type="button" onClick={() => onMonth(addMonths(first, -1))} aria-label="Previous month" className="flex h-9 w-9 items-center justify-center rounded-full text-xl active:bg-bg">
          ‹
        </button>
        <h2 className="font-semibold">{monthLabel(first)}</h2>
        <button type="button" onClick={() => onMonth(addMonths(first, 1))} aria-label="Next month" className="flex h-9 w-9 items-center justify-center rounded-full text-xl active:bg-bg">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="pb-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {visible.map((date) => {
          const inMonth = dateParts(date).month === shown;
          const count = busy.get(date) ?? 0;
          const isToday = date === today;
          const isSelected = date === selected;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onPick(date)}
              aria-label={`${date}${count ? `, ${count} item${count === 1 ? "" : "s"}` : ""}`}
              aria-current={isToday ? "date" : undefined}
              className="flex h-10 flex-col items-center justify-center rounded-xl active:bg-bg"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums ${
                  isSelected ? "bg-brand font-semibold text-brand-ink" : isToday ? "font-bold text-brand ring-2 ring-accent" : inMonth ? "text-ink" : "text-muted/50"
                }`}
              >
                {dateParts(date).day}
              </span>
              <span className={`mt-0.5 h-1 w-1 rounded-full ${count ? "bg-accent" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
