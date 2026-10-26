import type { Metadata } from "next";
import { Suspense } from "react";
import { RicettarioHeader } from "../header";
import { RecipeList } from "./recipe-list";

export const metadata: Metadata = { title: "Recipes" };

export default function RecipesPage() {
  return (
    <Suspense fallback={<RicettarioHeader title="Recipes" back={{ href: "/ricettario", label: "Back to the menu" }} />}>
      <RecipeList />
    </Suspense>
  );
}
