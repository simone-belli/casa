import { Suspense } from "react";
import { ui } from "@/components/ui";
import { RicettarioHeader } from "../header";
import { RecipeView } from "./recipe-view";

export default function RecipePage() {
  return (
    <main className={ui.page.replace("px-4", "")}>
      <Suspense fallback={<RicettarioHeader title="Recipe" back={{ href: "/ricettario", label: "Back to recipes" }} />}>
        <RecipeView />
      </Suspense>
    </main>
  );
}
