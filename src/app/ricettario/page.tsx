import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { RicettarioHeader } from "./header";
import { Menu } from "./menu";

export default function RicettarioPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <RicettarioHeader
        hideTitle
        action={
          <>
            <SafeLink href="/ricettario/settings" aria-label="Ricettario settings" className="-mx-2 flex h-10 w-10 items-center justify-center rounded-full text-2xl active:bg-white/20">
              ⚙︎
            </SafeLink>
            <SafeLink href="/ricettario/new" className="rounded-full bg-white px-4 py-2 font-semibold text-brand active:opacity-80">
              + Add
            </SafeLink>
          </>
        }
      />
      <main className={`${ui.page} flex w-full flex-1 flex-col`}>
        <Menu />
      </main>
    </div>
  );
}
