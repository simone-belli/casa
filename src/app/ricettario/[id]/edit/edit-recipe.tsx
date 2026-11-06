"use client";

import { useSafeRouter } from "@/lib/navigation";
import { useState } from "react";
import { useFamilyDefaults, useHousehold } from "@/lib/household";
import { createRecipe, getRecipe, updateRecipe } from "@/lib/recipes/db";
import { portionsFor } from "@/lib/recipes/scaling";
import type { RecipeDraft } from "@/lib/recipes/types";
import { RicettarioHeader } from "../../header";
import { RecipeForm } from "../../recipe-form";
import { useRecipe } from "../use-recipe";

export function EditRecipe() {
  const router = useSafeRouter();
  const family = useFamilyDefaults();
  const { me, nameOf } = useHousehold();
  const [remote, setRemote] = useState<{ type: "UPDATE" | "DELETE"; by: string | null } | null>(null);
  const { id, state } = useRecipe({
    live: false,
    onRemoteChange: (type, recipe) => {
      // Our own save also triggers an update event; only warn about the other person's.
      if (type === "UPDATE" && recipe.updated_by === me) return;
      setRemote({ type, by: recipe.updated_by ?? null });
    },
  });
  const back = { href: `/ricettario/${id}`, label: "Back to recipe" };

  if (state.status !== "ready" || !family) {
    return (
      <>
        <RicettarioHeader title="Edit recipe" back={back} />
        <p className="px-4 py-12 text-center text-muted">
          {state.status === "missing" ? "This recipe was deleted." : state.status === "error" ? "Couldn't load the recipe." : "Loading…"}
        </p>
      </>
    );
  }

  const { recipe } = state;
  const initial: RecipeDraft = {
    title: recipe.title,
    notes: recipe.notes,
    tags: recipe.tags,
    kind: recipe.kind,
    yield: recipe.yield,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    source_url: recipe.source_url,
    source_text: recipe.source_text,
    photo_paths: recipe.photo_paths,
  };
  const who = (remote && nameOf(remote.by)) || "Someone";

  return (
    <>
      <RicettarioHeader title="Edit recipe" back={back} />
      <div className="px-4">
        <RecipeForm
          initial={initial}
          initialPortions={portionsFor(family.default_adults, family.default_children)}
          submitLabel={remote?.type === "DELETE" ? "Save as a new copy" : "Save changes"}
          banner={
            remote && (
              <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                {remote.type === "DELETE"
                  ? "This recipe was deleted while you were editing. Saving will add it back."
                  : `${who} updated this recipe while you were editing. Saving will replace their changes with yours.`}
              </p>
            )
          }
          onCancel={() => router.push(`/ricettario/${id}`)}
          onSave={async (draft) => {
            if (remote?.type === "DELETE") {
              const created = await createRecipe(draft);
              router.replace(`/ricettario/${created.id}`);
              return;
            }
            // Unless they've seen the warning, only save over the recipe as it was
            // opened: a change the live update missed (phone asleep, poor
            // signal) must not be overwritten unseen.
            const saved = await updateRecipe(id, draft, remote ? undefined : recipe.updated_at);
            if (!saved) {
              const latest = await getRecipe(id);
              setRemote(latest ? { type: "UPDATE", by: latest.updated_by } : { type: "DELETE", by: null });
              return false;
            }
            router.replace(`/ricettario/${id}`);
          }}
        />
      </div>
    </>
  );
}
