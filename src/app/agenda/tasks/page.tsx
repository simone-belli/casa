import type { Metadata } from "next";
import { ui } from "@/components/ui";
import { AgendaHeader } from "../header";
import { TasksView } from "../tasks-view";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <>
      <AgendaHeader tab="tasks" />
      <main className={ui.page}>
        <TasksView />
      </main>
    </>
  );
}
