import type { Metadata } from "next";
import { Suspense } from "react";
import { ui } from "@/components/ui";
import { RicettarioHeader } from "../../header";
import { EditRecipe } from "./edit-recipe";

export const metadata: Metadata = { title: "Edit recipe" };

export default function EditRecipePage() {
  return (
    <main className={ui.page.replace("px-4", "")}>
      <Suspense fallback={<RicettarioHeader title="Edit recipe" back={{ href: "/ricettario", label: "Back to recipes" }} />}>
        <EditRecipe />
      </Suspense>
    </main>
  );
}
