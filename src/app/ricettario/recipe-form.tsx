"use client";

import { useState } from "react";
import { Stepper } from "@/components/stepper";
import { ui } from "@/components/ui";
import { COURSES, DIETS, type Label, LABEL_NAMES, MEALS, mergeLabels, SEASONS, splitLabels } from "@/lib/recipes/labels";
import { parseQuantity, quantityToInput } from "@/lib/recipes/quantity";
import {
  type Ingredient,
  type RecipeDraft,
  recipeDraftSchema,
  SCALING_MODES,
  type ScalingMode,
  UNIT_SUGGESTIONS,
} from "@/lib/recipes/types";
import { uid } from "@/lib/uid";
import { PhotoStrip } from "./photo-strip";

type IngredientRow = { key: string; name: string; quantity: string; unit: string; scaling: ScalingMode; note: string };
type StepRow = { key: string; text: string };

const SCALING_LABELS: Record<ScalingMode, string> = {
  linear: "Scales",
  rounded: "Scales, whole units",
  fixed: "Fixed amount",
};

type Props = {
  initial: RecipeDraft;
  /** Portions the form shows amounts for at first (portion recipes). */
  initialPortions: number;
  warnings?: string[];
  banner?: React.ReactNode;
  submitLabel: string;
  onSave: (draft: RecipeDraft) => Promise<void>;
  onCancel: () => void;
};

function toRows(ingredients: Ingredient[], factor: (i: Ingredient) => number): IngredientRow[] {
  return ingredients.map((i) => ({
    key: uid(),
    name: i.name,
    quantity: i.quantity === null ? "" : quantityToInput(i.quantity * factor(i)),
    unit: i.unit,
    scaling: i.scaling,
    note: i.note ?? "",
  }));
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * The review/edit form. For portion recipes, people enter amounts for a number
 * of portions they choose; they are stored per adult portion on save.
 */
export function RecipeForm({ initial, initialPortions, warnings = [], banner, submitLabel, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [kind, setKind] = useState(initial.kind);
  const [yieldText, setYieldText] = useState(initial.yield ?? "");
  const [portions, setPortions] = useState(initialPortions);
  const [labels, setLabels] = useState<Label[]>(() => splitLabels(initial.tags).labels);
  const [tags, setTags] = useState(() => splitLabels(initial.tags).others.join(", "));
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    toRows(initial.ingredients, (i) => (initial.kind === "portion" && i.scaling !== "fixed" ? initialPortions : 1)),
  );
  const [steps, setSteps] = useState<StepRow[]>(() => initial.steps.map((text) => ({ key: uid(), text })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The amounts shown are for `portions` servings; made as a batch they stay
  // as they are, and the batch makes that many servings.
  function changeKind(next: typeof kind) {
    if (next === "batch" && kind === "portion" && !yieldText.trim()) {
      setYieldText(`${quantityToInput(portions)} ${portions === 1 ? "serving" : "servings"}`);
    }
    setKind(next);
  }

  const updateIngredient = (key: string, patch: Partial<IngredientRow>) =>
    setIngredients((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const updateStep = (key: string, text: string) =>
    setSteps((rows) => rows.map((r) => (r.key === key ? { ...r, text } : r)));

  function buildDraft(): RecipeDraft | string {
    const parsedIngredients: Ingredient[] = [];
    for (const row of ingredients) {
      if (!row.name.trim()) continue;
      const quantity = parseQuantity(row.quantity);
      if (quantity === undefined) return `“${row.quantity}” isn't a quantity (${row.name}).`;
      const divisor = kind === "portion" && row.scaling !== "fixed" ? portions : 1;
      parsedIngredients.push({
        name: row.name.trim(),
        quantity: quantity === null ? null : quantity / divisor,
        unit: row.unit.trim(),
        scaling: row.scaling,
        note: row.note.trim() || null,
      });
    }
    const draft = {
      ...initial,
      title: title.trim(),
      kind,
      yield: kind === "batch" ? yieldText.trim() || null : null,
      tags: mergeLabels(labels, tags.split(",")),
      notes: notes.trim() || null,
      ingredients: parsedIngredients,
      steps: steps.map((s) => s.text.trim()).filter(Boolean),
    };
    if (!draft.title) return "Give the recipe a title.";
    const result = recipeDraftSchema.safeParse(draft);
    return result.success ? result.data : "Some fields aren't valid. Please check the recipe.";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const draft = buildDraft();
    if (typeof draft === "string") {
      setError(draft);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setSaving(false);
    }
  }

  const small = "rounded-lg border border-line bg-surface px-2 py-2 text-ink focus:border-brand focus:outline-none";
  const iconButton = "flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-line disabled:opacity-30";

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pt-5">
      {banner}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-1 font-semibold">Please check:</p>
          <ul className="list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <section className={`${ui.card} flex flex-col gap-4`}>
        <div>
          <label htmlFor="title" className={ui.label}>
            Title
          </label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className={`${ui.input} font-display text-lg`} />
        </div>

        <fieldset>
          <legend className={ui.label}>Made as</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["portion", "batch"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => changeKind(k)}
                aria-pressed={kind === k}
                className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${kind === k ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink"}`}
              >
                {k === "portion" ? "Portions" : "A batch"}
              </button>
            ))}
          </div>
        </fieldset>

        <p className="-mt-2 text-xs text-muted">
          {kind === "portion"
            ? "Scaled by the number of adults and children eating."
            : "Made as a whole (cake, bread, biscuits…), scaled in batches."}
        </p>

        {kind === "batch" && (
          <div>
            <label htmlFor="yield" className={ui.label}>
              One batch makes
            </label>
            <input id="yield" placeholder="1 cake, 24 cm tin" value={yieldText} onChange={(e) => setYieldText(e.target.value)} className={ui.input} />
          </div>
        )}

        <LabelGroup legend="Good for" options={MEALS} ticked={labels} onChange={setLabels} />
        <LabelGroup legend="Menu" options={COURSES} ticked={labels} onChange={setLabels} />
        <LabelGroup legend="Diet" options={DIETS} ticked={labels} onChange={setLabels} />
        <LabelGroup
          legend="Season"
          hint="Leave both unticked if it's good all year."
          options={SEASONS}
          ticked={labels}
          onChange={setLabels}
        />
      </section>

      <section className={`${ui.card} flex flex-col gap-3`}>
        <h2 className="font-display text-xl">Ingredients</h2>
        {kind === "portion" && (
          <div className="rounded-xl bg-bg p-3">
            <Stepper
              label="Amounts below are for (portions)"
              value={portions}
              min={0.5}
              onChange={(v) => setPortions(Math.max(0.5, v))}
            />
          </div>
        )}

        <datalist id="units">
          {UNIT_SUGGESTIONS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>

        <ol className="flex flex-col gap-3">
          {ingredients.map((row, index) => (
            <li key={row.key} className="flex flex-col gap-2 rounded-xl border border-line p-2">
              <div className="flex gap-2">
                <input aria-label="Quantity" inputMode="decimal" placeholder="Qty" value={row.quantity} onChange={(e) => updateIngredient(row.key, { quantity: e.target.value })} className={`${small} w-16`} />
                <input aria-label="Unit" list="units" placeholder="unit" autoCapitalize="none" value={row.unit} onChange={(e) => updateIngredient(row.key, { unit: e.target.value })} className={`${small} w-20`} />
                <input aria-label="Ingredient" placeholder="Ingredient" value={row.name} onChange={(e) => updateIngredient(row.key, { name: e.target.value })} className={`${small} min-w-0 flex-1`} />
              </div>
              <div className="flex items-center gap-2">
                <select aria-label="Scaling" value={row.scaling} onChange={(e) => updateIngredient(row.key, { scaling: e.target.value as ScalingMode })} className={`${small} w-36 text-sm`}>
                  {SCALING_MODES.map((m) => (
                    <option key={m} value={m}>
                      {SCALING_LABELS[m]}
                    </option>
                  ))}
                </select>
                <input aria-label="Note" placeholder="note (optional)" value={row.note} onChange={(e) => updateIngredient(row.key, { note: e.target.value })} className={`${small} min-w-0 flex-1 text-sm`} />
              </div>
              <div className="flex justify-end">
                <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => setIngredients((r) => move(r, index, -1))} className={iconButton}>↑</button>
                <button type="button" aria-label="Move down" disabled={index === ingredients.length - 1} onClick={() => setIngredients((r) => move(r, index, 1))} className={iconButton}>↓</button>
                <button type="button" aria-label="Remove ingredient" onClick={() => setIngredients((r) => r.filter((x) => x.key !== row.key))} className={iconButton}>✕</button>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setIngredients((r) => [...r, { key: uid(), name: "", quantity: "", unit: "", scaling: "linear", note: "" }])}
          className={ui.secondary}
        >
          + Add ingredient
        </button>
        <p className="text-xs text-muted">Leave the quantity empty for “to taste”.</p>
      </section>

      <section className={`${ui.card} flex flex-col gap-3`}>
        <h2 className="font-display text-xl">Steps</h2>
        <ol className="flex flex-col gap-3">
          {steps.map((row, index) => (
            <li key={row.key} className="flex gap-2">
              <span className="pt-2.5 font-display text-lg text-brand">{index + 1}</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <textarea aria-label={`Step ${index + 1}`} rows={3} value={row.text} onChange={(e) => updateStep(row.key, e.target.value)} className={ui.input} />
                <div className="flex justify-end">
                  <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => setSteps((r) => move(r, index, -1))} className={iconButton}>↑</button>
                  <button type="button" aria-label="Move down" disabled={index === steps.length - 1} onClick={() => setSteps((r) => move(r, index, 1))} className={iconButton}>↓</button>
                  <button type="button" aria-label="Remove step" onClick={() => setSteps((r) => r.filter((x) => x.key !== row.key))} className={iconButton}>✕</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setSteps((r) => [...r, { key: uid(), text: "" }])} className={ui.secondary}>
          + Add step
        </button>
      </section>

      <section className={`${ui.card} flex flex-col gap-4`}>
        <div>
          <label htmlFor="tags" className={ui.label}>
            Tags (separated by commas)
          </label>
          <input id="tags" autoCapitalize="none" placeholder="pasta, sunday" value={tags} onChange={(e) => setTags(e.target.value)} className={ui.input} />
        </div>
        <div>
          <label htmlFor="notes" className={ui.label}>
            Notes
          </label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={ui.input} />
        </div>
      </section>

      {(initial.photo_paths.length > 0 || initial.source_url || initial.source_text) && (
        <section className={`${ui.card} flex flex-col gap-3`}>
          <h2 className="font-display text-xl">Source</h2>
          <PhotoStrip paths={initial.photo_paths} />
          {initial.source_url && (
            <a href={initial.source_url} target="_blank" rel="noreferrer" className="break-all text-sm text-brand underline">
              {initial.source_url}
            </a>
          )}
          {initial.source_text && (
            <details className="text-sm">
              <summary className="text-muted">Original text</summary>
              <p className="mt-2 whitespace-pre-wrap text-ink">{initial.source_text}</p>
            </details>
          )}
        </section>
      )}

      {error && <p className={ui.error}>{error}</p>}
      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-line bg-bg/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur">
        <button type="button" onClick={onCancel} className={`${ui.secondary} flex-1`}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${ui.primary} flex-[2]`}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function LabelGroup({
  legend,
  hint,
  options,
  ticked,
  onChange,
}: {
  legend: string;
  hint?: string;
  options: readonly Label[];
  ticked: Label[];
  onChange: (labels: Label[]) => void;
}) {
  return (
    <fieldset>
      <legend className={ui.label}>{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((label) => {
          const on = ticked.includes(label);
          return (
            <label
              key={label}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-semibold ${on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink"}`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onChange(on ? ticked.filter((x) => x !== label) : [...ticked, label])}
                className="h-4 w-4 accent-white"
              />
              {LABEL_NAMES[label]}
            </label>
          );
        })}
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </fieldset>
  );
}
