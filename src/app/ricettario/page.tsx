import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { RicettarioHeader } from "./header";
import { RecipeList } from "./recipe-list";

export default function RicettarioPage() {
  return (
    <>
      <RicettarioHeader
        hideTitle
        action={
          <SafeLink href="/ricettario/new" className="rounded-full bg-white px-4 py-2 font-semibold text-brand active:opacity-80">
            + Add
          </SafeLink>
        }
      />
      <main className={ui.page}>
        <RecipeList />
      </main>
    </>
  );
}
