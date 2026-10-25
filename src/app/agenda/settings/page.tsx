import type { Metadata } from "next";
import { ui } from "@/components/ui";
import { AgendaHeader } from "../header";
import { AgendaSettings } from "./agenda-settings";

export const metadata: Metadata = { title: "Settings" };

export default function AgendaSettingsPage() {
  return (
    <>
      <AgendaHeader title="Agenda settings" back={{ href: "/agenda", label: "Back to the calendar" }} />
      <main className={ui.page}>
        <AgendaSettings />
      </main>
    </>
  );
}
