import { SafeLink } from "@/components/safe-link";
import { SectionHeader } from "@/components/section-header";

const TABS = [
  { key: "calendar", href: "/agenda", label: "Calendar" },
  { key: "tasks", href: "/agenda/tasks", label: "Tasks" },
] as const;

/** The Agenda header; on the two views it carries the Calendar / Tasks switch. */
export function AgendaHeader({
  title = "Agenda",
  back = { href: "/", label: "Back to Casa" },
  tab,
}: {
  title?: string;
  back?: { href: string; label: string };
  tab?: (typeof TABS)[number]["key"];
}) {
  return (
    <SectionHeader
      logo={{ src: "/brand/agenda.svg", href: "/agenda", label: "Agenda home" }}
      casaLink
      title={title}
      hideTitle={Boolean(tab)}
      back={back}
      action={
        tab && (
          <SafeLink href="/agenda/settings" aria-label="Agenda settings" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-2xl active:bg-white/20">
            ⚙︎
          </SafeLink>
        )
      }
      band={
        tab && (
          <nav className="mx-auto flex max-w-2xl gap-2 px-4 pb-3" aria-label="Agenda views">
            {TABS.map((t) => (
              <SafeLink
                key={t.key}
                href={t.href}
                aria-current={t.key === tab ? "page" : undefined}
                className={`flex-1 rounded-full py-2 text-center font-semibold ${
                  t.key === tab ? "bg-white text-brand" : "bg-white/15 text-brand-ink active:bg-white/25"
                }`}
              >
                {t.label}
              </SafeLink>
            ))}
          </nav>
        )
      }
    />
  );
}
