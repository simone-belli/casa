import type { Metadata } from "next";
import { ui } from "@/components/ui";
import { RicettarioHeader } from "../header";
import { RicettarioSettings } from "./ricettario-settings";

export const metadata: Metadata = { title: "Settings" };

export default function RicettarioSettingsPage() {
  return (
    <>
      <RicettarioHeader title="Settings" back={{ href: "/ricettario", label: "Back to the menu" }} />
      <main className={ui.page}>
        <RicettarioSettings />
      </main>
    </>
  );
}
