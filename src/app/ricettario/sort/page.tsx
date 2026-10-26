import type { Metadata } from "next";
import { FreshOnEachVisit } from "@/components/fresh-on-each-visit";
import { ui } from "@/components/ui";
import { RicettarioHeader } from "../header";
import { SortRecipes } from "./sort-recipes";

export const metadata: Metadata = { title: "Sort recipes" };

export default function SortRecipesPage() {
  return (
    <>
      <RicettarioHeader title="Sort recipes" back={{ href: "/ricettario/settings", label: "Back to settings" }} />
      <main className={ui.page}>
        <FreshOnEachVisit>
          <SortRecipes />
        </FreshOnEachVisit>
      </main>
    </>
  );
}
