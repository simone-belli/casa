import { ui } from "@/components/ui";
import { CalendarView } from "./calendar-view";
import { AgendaHeader } from "./header";

export default function AgendaPage() {
  return (
    <>
      <AgendaHeader tab="calendar" />
      <main className={ui.page}>
        <CalendarView />
      </main>
    </>
  );
}
