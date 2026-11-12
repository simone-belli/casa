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
      <header className="flex items-center gap-3 py-4">
        <Image src="/brand/casa.svg" alt="" width={44} height={44} className="shrink-0 rounded-xl shadow-sm" priority unoptimized />
        <h1 className="min-w-0 flex-1 font-display text-3xl text-ink">Casa</h1>
        <nav className="flex shrink-0 gap-2.5" aria-label="Sections">
          {SECTIONS.map((section) => (
            <SafeLink key={section.href} href={section.href} aria-label={section.name} className="rounded-[14px] shadow-sm active:scale-95">
              <Image src={section.logo} alt="" width={52} height={52} className="rounded-[14px]" unoptimized />
            </SafeLink>
          ))}
        </nav>
      </header>

      <div className="pt-2">
        <HomeAgenda />
      </div>

      <footer className="mt-auto flex items-center justify-between pt-10">
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
