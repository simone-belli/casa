import Image from "next/image";
import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { HomeAgenda } from "./home-agenda";

const SECTIONS = [
  { href: "/agenda", logo: "/brand/agenda.svg", name: "Agenda" },
  { href: "/groceries", logo: "/brand/groceries.svg", name: "Groceries" },
  { href: "/ricettario", logo: "/brand/ricettario.svg", name: "Ricettario" },
];

export default function CasaHome() {
  return (
    <main className={`${ui.page} flex min-h-dvh flex-col pt-[max(env(safe-area-inset-top),1rem)]`}>
      <header className="flex items-center justify-center gap-3 pt-4 pb-6">
        <Image src="/brand/casa.svg" alt="" width={48} height={48} className="shrink-0 rounded-xl shadow-sm" priority unoptimized />
        <h1 className="font-display text-4xl text-ink">Casa</h1>
      </header>

      <nav className="grid grid-cols-3 gap-4" aria-label="Sections">
        {SECTIONS.map((section) => (
          <SafeLink key={section.href} href={section.href} aria-label={section.name} className="block rounded-[24px] shadow-md active:scale-[0.97]">
            <Image src={section.logo} alt="" width={160} height={160} className="aspect-square h-auto w-full rounded-[24px]" priority unoptimized />
          </SafeLink>
        ))}
      </nav>

      <div className="flex flex-1 flex-col pt-8">
        <HomeAgenda />
      </div>

      <footer className="flex items-center justify-between pt-10">
        <SafeLink
          href="/report-bug"
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted shadow-sm active:bg-line"
        >
          🐞 Report a bug
        </SafeLink>
        <SafeLink href="/settings" className="text-muted underline-offset-4 active:underline">
          Settings
        </SafeLink>
      </footer>
    </main>
  );
}
