import Image from "next/image";
import { SectionHeader } from "@/components/section-header";
import { ui } from "@/components/ui";

export default function AgendaPage() {
  return (
    <>
      <SectionHeader logo="/brand/agenda.svg" title="Agenda" back={{ href: "/", label: "Back to Casa" }} />
      <main className={`${ui.page} flex flex-col items-center gap-4 pt-16 text-center`}>
        <Image src="/brand/agenda.svg" alt="" width={96} height={96} className="rounded-3xl shadow-md" unoptimized />
        <h2 className="font-display text-2xl font-semibold">Coming soon</h2>
        <p className="max-w-sm text-muted">
          A shared calendar and task list for the two of you. We&apos;ll build it after Ricettario.
        </p>
        <span className="h-1 w-16 rounded-full bg-accent" />
      </main>
    </>
  );
}
