import type { Metadata } from "next";
import { SectionHeader } from "@/components/section-header";
import { ui } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <SectionHeader logo={{ src: "/brand/casa.svg", href: "/", label: "Casa home" }} title="Settings" back={{ href: "/", label: "Back to Casa" }} />
      <main className={`${ui.page} pt-6`}>
        <SettingsForm />
      </main>
    </>
  );
}
