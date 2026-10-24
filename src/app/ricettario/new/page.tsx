import type { Metadata } from "next";
import { FreshOnEachVisit } from "@/components/fresh-on-each-visit";
import { ui } from "@/components/ui";
import { RicettarioHeader } from "../header";
import { NewRecipe } from "./new-recipe";

export const metadata: Metadata = { title: "Add a recipe" };

export default function NewRecipePage() {
  return (
    <>
      <RicettarioHeader title="Add a recipe" back={{ href: "/ricettario", label: "Back to recipes" }} />
      <main className={ui.page}>
        <FreshOnEachVisit>
          <NewRecipe />
        </FreshOnEachVisit>
      </main>
    </>
  );
}
