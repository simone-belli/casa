"use client";

import { useSafeRouter } from "@/lib/navigation";
import { useEffect, useRef, useState } from "react";
import type { ParseResponse } from "@/app/api/ricettario/parse/route";
import { ui } from "@/components/ui";
import { useFamilyDefaults } from "@/lib/household";
import { createRecipe, discardPhotos, uploadPhotos } from "@/lib/recipes/db";
import { MAX_PHOTOS } from "@/lib/recipes/photos";
import { portionsFor } from "@/lib/recipes/scaling";
import { emptyDraft, type RecipeDraft } from "@/lib/recipes/types";
import { RecipeForm } from "../recipe-form";

type Method = "text" | "photo" | "paste";
type Review = { draft: RecipeDraft; warnings: string[] };

const METHODS: { id: Method; icon: string; title: string; hint: string }[] = [
  { id: "text", icon: "🎙️", title: "Type or dictate", hint: "Use the microphone on your keyboard" },
  { id: "photo", icon: "📷", title: "Photo of a page", hint: `Up to ${MAX_PHOTOS} photos of a notebook` },
  { id: "paste", icon: "📋", title: "Paste text or a link", hint: "From a website, message or note" },
];

const isLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

export function NewRecipe() {
  const router = useSafeRouter();
  const family = useFamilyDefaults();
  const [method, setMethod] = useState<Method | null>(null);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Free the photo previews when leaving the page.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_PHOTOS - photos.length;
    const added = Array.from(list)
      .slice(0, room)
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos([...photos, ...added]);
    setUploaded([]);
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].preview);
    setPhotos(photos.filter((_, i) => i !== index));
    setUploaded([]);
  }

  async function read() {
    setReading(true);
    setError(null);
    try {
      let body: object;
      if (method === "photo") {
        const paths = uploaded.length > 0 ? uploaded : await uploadPhotos(photos.map((p) => p.file));
        setUploaded(paths);
        body = { type: "photos", paths };
      } else if (method === "paste" && isLink(text)) {
        body = { type: "url", url: text.trim() };
      } else {
        body = { type: "text", text };
      }
      const response = await fetch("/api/ricettario/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({ error: "The server didn't answer properly." }))) as ParseResponse;
      if ("error" in result) {
        setError(result.error);
      } else {
        setReview(result);
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setReading(false);
    }
  }

  function cancel() {
    void discardPhotos(uploaded);
    router.push("/ricettario");
  }

  if (review && family) {
    return (
      <RecipeForm
        initial={review.draft}
        initialPortions={portionsFor(family.default_adults, family.default_children)}
        warnings={review.warnings}
        submitLabel="Save recipe"
        onCancel={cancel}
        onSave={async (draft) => {
          const recipe = await createRecipe(draft);
          router.replace(`/ricettario/${recipe.id}`);
        }}
      />
    );
  }

  if (!method) {
    return (
      <div className="flex flex-col gap-3 pt-5">
        {METHODS.map((m) => (
          <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={`${ui.card} flex items-center gap-4 text-left active:bg-bg`}>
            <span className="text-3xl" aria-hidden>
              {m.icon}
            </span>
            <span>
              <span className="block font-display text-xl">{m.title}</span>
              <span className="text-sm text-muted">{m.hint}</span>
            </span>
          </button>
        ))}
        <button type="button" onClick={() => setReview({ draft: emptyDraft(), warnings: [] })} className="mt-2 text-center text-muted underline">
          Or fill in the form yourself
        </button>
      </div>
    );
  }

  const canRead = method === "photo" ? photos.length > 0 : text.trim().length > 0;

  return (
    <div className="flex flex-col gap-4 pt-5">
      <button type="button" onClick={() => setMethod(null)} className="self-start text-sm text-muted underline" disabled={reading}>
        ‹ Choose another way
      </button>

      {method === "photo" ? (
        <div className={`${ui.card} flex flex-col gap-3`}>
          <p className="text-muted">Take a photo of each page, in order. Make sure the writing is sharp and well lit.</p>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map(({ preview }, i) => (
                <div key={preview} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img src={preview} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full rounded-lg border border-line object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove page ${i + 1}`}
                    disabled={reading}
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }} />
          {photos.length < MAX_PHOTOS && (
            <button type="button" disabled={reading} onClick={() => fileInput.current?.click()} className={ui.secondary}>
              {photos.length === 0 ? "📷 Take or choose photos" : "+ Add another page"}
            </button>
          )}
        </div>
      ) : (
        <div className={ui.card}>
          <label htmlFor="recipe-text" className={ui.label}>
            {method === "text" ? "Say or type the recipe: ingredients, amounts, how many it serves, and the steps." : "Paste a link or the recipe text."}
          </label>
          <textarea
            id="recipe-text"
            rows={method === "text" ? 12 : 8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={reading}
            className={ui.input}
            placeholder={method === "paste" ? "https://…" : "Pasta e ceci per 4 persone: 320 g di pasta corta…"}
          />
          {method === "paste" && isLink(text) && <p className="mt-2 text-sm text-muted">We&apos;ll read the recipe from that page.</p>}
        </div>
      )}

      {error && <p className={ui.error}>{error}</p>}

      <button type="button" disabled={!canRead || reading || !family} onClick={read} className={ui.primary}>
        {reading ? "Reading the recipe…" : "Read recipe"}
      </button>
      {reading && <p className="text-center text-sm text-muted">This can take up to a minute.</p>}
    </div>
  );
}
