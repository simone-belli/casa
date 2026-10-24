import Link from "next/link";
import { ui } from "@/components/ui";
import { RicettarioHeader } from "./header";
import { RecipeList } from "./recipe-list";

export default function RicettarioPage() {
  return (
    <>
      <RicettarioHeader
        action={
          <Link href="/ricettario/new" className="rounded-full bg-white px-4 py-2 font-semibold text-brand active:opacity-80">
            + Add
          </Link>
        }
      />
      <main className={ui.page}>
        <RecipeList />
      </main>
    </>
  );
}
