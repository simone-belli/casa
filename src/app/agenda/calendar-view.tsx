"use client";

import { useMemo, useState } from "react";
import type { Draft } from "@/lib/agenda/draft";
import { dayLabel } from "@/lib/agenda/format";
import type { Occurrence } from "@/lib/agenda/occurrences";
import { addDays, startOfMonth, startOfWeek } from "@/lib/agenda/time";
import { useAgenda, useMySettings, useViewer } from "@/lib/agenda/use-agenda";
import { useDeviceSetting } from "@/lib/device-setting";
import { useHousehold } from "@/lib/household";
import { busyDays, calendarDays, calendarOverdue, taskSections, type CalendarFilter } from "@/lib/agenda/views";
import { AddBar } from "./add-bar";
import { ItemSheet } from "./item-sheet";
import { NudgeBanner } from "./nudge-banner";
import { ErrorBanner, GroupTitle, ItemList, ItemRow, LoadState, useAgendaActions } from "./parts";
import { MonthGrid } from "./month-grid";

/** How many days the list shows at a time. */
const PAGE_DAYS = 60;

/** Every dated item, day by day from today, with a month grid to jump around. */
export function CalendarView() {
  const { data, loadFailed, error, clearError, change } = useAgenda();
  const viewer = useViewer();
  const { nameOf } = useHousehold();
  const mySettings = useMySettings(viewer?.me ?? null);
  const actions = useAgendaActions(change);
  const [filter, setFilter] = useDeviceSetting<CalendarFilter>("agenda:filter", "everyone");
  const [showMonth, setShowMonth] = useDeviceSetting("agenda:showMonth", false);
  const [from, setFrom] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [days, setDays] = useState(PAGE_DAYS);
  const [sheet, setSheet] = useState<{ draft: Draft } | { occ: Occurrence } | null>(null);

  const start = from ?? viewer?.today ?? null;
  const shownMonth = month ?? start;

  const view = useMemo(() => {
    if (!data || !viewer || !start || !shownMonth) return null;
    const gridFrom = startOfWeek(startOfMonth(shownMonth));
    return {
      days: calendarDays(data, viewer, filter, start, days),
      overdue: start === viewer.today ? calendarOverdue(data, viewer, filter) : [],
      busy: showMonth ? busyDays(data, viewer, filter, gridFrom, addDays(gridFrom, 41)) : new Map<string, number>(),
      sections: taskSections(data, viewer),
    };
  }, [data, viewer, filter, start, days, showMonth, shownMonth]);

  if (!data || !viewer || !view || !start || !shownMonth) return <LoadState failed={loadFailed} />;

  const jump = (date: string) => {
    setFrom(date === viewer.today ? null : date);
    setDays(PAGE_DAYS);
  };

  return (
    <div className="flex flex-col gap-4 pt-4">
      <NudgeBanner sections={view.sections} viewer={viewer} mySettings={mySettings} />
      <AddBar viewer={viewer} kind="event" date={start} onDraft={(draft) => setSheet({ draft })} />
      <ErrorBanner error={error} onDismiss={clearError} />

      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-full border border-line bg-surface p-0.5 text-sm font-semibold" role="group" aria-label="Show">
          {(
            [
              ["everyone", "Everyone"],
              ["mine", "Mine"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1.5 ${filter === value ? "bg-brand text-brand-ink" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {start !== viewer.today && (
            <button type="button" onClick={() => jump(viewer.today)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-brand">
              Today
            </button>
          )}
          <button
            type="button"
            aria-pressed={showMonth}
            onClick={() => setShowMonth(!showMonth)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${showMonth ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink"}`}
          >
            Month
          </button>
        </div>
      </div>

      {showMonth && (
        <MonthGrid
          month={shownMonth}
          today={viewer.today}
          selected={start}
          busy={view.busy}
          onMonth={(m) => setMonth(m)}
          onPick={(date) => {
            jump(date);
            setMonth(date);
          }}
        />
      )}

      {view.overdue.length > 0 && (
        <section>
          <GroupTitle accent count={view.overdue.length}>
            Overdue
          </GroupTitle>
          <ItemList>
            {view.overdue.map((occ) => (
              <ItemRow key={occ.key} occ={occ} agenda={data} viewer={viewer} nameOf={nameOf} actions={actions} onOpen={(o) => setSheet({ occ: o })} overdue />
            ))}
          </ItemList>
        </section>
      )}

      {view.days.map((day) => (
        <section key={day.date}>
          <GroupTitle>{dayLabel(day.date, viewer.today)}</GroupTitle>
          {day.occurrences.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">Nothing planned</p>
          ) : (
            <ItemList>
              {day.occurrences.map((occ) => (
                <ItemRow
                  key={`${occ.key}@${day.date}`}
                  occ={occ}
                  agenda={data}
                  viewer={viewer}
                  nameOf={nameOf}
                  actions={actions}
                  onOpen={(o) => setSheet({ occ: o })}
                  day={day.date}
                />
              ))}
            </ItemList>
          )}
        </section>
      ))}

      <button type="button" onClick={() => setDays(days + PAGE_DAYS)} className="py-3 text-center font-semibold text-brand">
        Show later dates
      </button>

      {sheet && (
        <ItemSheet
          key={"occ" in sheet ? sheet.occ.key : "new"}
          target={sheet}
          agenda={data}
          viewer={viewer}
          nameOf={nameOf}
          change={change}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
