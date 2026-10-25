import Image from "next/image";
import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";

const SECTIONS = [
  { href: "/ricettario", logo: "/brand/ricettario.svg", name: "Ricettario", blurb: "Our recipes", soon: false },
  { href: "/agenda", logo: "/brand/agenda.svg", name: "Agenda", blurb: "Our calendar and tasks", soon: false },
  { href: "/groceries", logo: "/brand/groceries.svg", name: "Groceries", blurb: "Our shopping list", soon: false },
];

export default function CasaHome() {
  return (
    <main className={`${ui.page} flex min-h-dvh flex-col pt-[max(env(safe-area-inset-top),1.5rem)]`}>
      <header className="flex flex-col items-center gap-3 py-8 text-center">
        <Image src="/brand/casa.svg" alt="" width={88} height={88} className="rounded-[22px] shadow-md" priority unoptimized />
        <h1 className="font-display text-4xl text-ink">Casa</h1>
      </header>

      <nav className="grid gap-4">
        {SECTIONS.map((section) => (
          <SafeLink
            key={section.href}
            href={section.href}
            className={`flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 shadow-sm active:scale-[0.99] ${section.soon ? "opacity-70" : ""}`}
          >
            <Image src={section.logo} alt="" width={72} height={72} className="rounded-[18px]" unoptimized />
            <span className="flex flex-col">
              <span className="font-display text-2xl text-ink">{section.name}</span>
              <span className="text-muted">{section.blurb}</span>
            </span>
          </SafeLink>
        ))}
      </nav>

      <footer className="mt-auto pt-10 text-center">
        <SafeLink href="/settings" className="text-muted underline-offset-4 active:underline">
          Settings
        </SafeLink>
      </footer>
    </main>
  );
}
