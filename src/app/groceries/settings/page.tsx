import type { Metadata } from "next";
import { ui } from "@/components/ui";
import { GroceriesHeader } from "../header";
import { GroceriesSettings } from "./groceries-settings";

export const metadata: Metadata = { title: "Settings" };

export default function GroceriesSettingsPage() {
  return (
    <>
      <GroceriesHeader title="Groceries settings" back={{ href: "/groceries", label: "Back to the list" }} />
      <main className={ui.page}>
        <GroceriesSettings />
      </main>
    </>
  );
}
