"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { uid } from "@/lib/uid";
import { MAX_PHOTOS, PHOTO_BUCKET, PHOTO_MAX_EDGE } from "./photos";
import type { Recipe, RecipeDraft } from "./types";

export async function listRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabaseBrowser()
    .from("recipes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as Recipe[];
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const { data, error } = await supabaseBrowser().from("recipes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Recipe | null;
}

export async function createRecipe(draft: RecipeDraft): Promise<Recipe> {
  const { data, error } = await supabaseBrowser().from("recipes").insert(draft).select().single();
  if (error) throw error;
  return data as Recipe;
}

export async function updateRecipe(id: string, draft: RecipeDraft): Promise<Recipe> {
  const { data, error } = await supabaseBrowser().from("recipes").update(draft).eq("id", id).select().single();
  if (error) throw error;
  return data as Recipe;
}

export async function deleteRecipe(recipe: Recipe): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
  if (error) throw error;
  if (recipe.photo_paths.length > 0) {
    await supabase.storage.from(PHOTO_BUCKET).remove(recipe.photo_paths);
  }
}

/**
 * Calls `onChange` whenever any recipe (or the one with `id`) is added,
 * edited or deleted, by either person. Returns an unsubscribe function.
 */
export function watchRecipes(
  onChange: (event: { type: "INSERT" | "UPDATE" | "DELETE"; recipe: Partial<Recipe> }) => void,
  id?: string,
): () => void {
  const supabase = supabaseBrowser();
  const channel = supabase
    .channel(`recipes:${id ?? "all"}:${uid()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "recipes", ...(id ? { filter: `id=eq.${id}` } : {}) },
      (payload) => {
        const recipe = (payload.eventType === "DELETE" ? payload.old : payload.new) as Partial<Recipe>;
        onChange({ type: payload.eventType, recipe });
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Shrinks a camera photo to a JPEG of at most PHOTO_MAX_EDGE pixels. */
async function downscale(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Photo conversion failed"))), "image/jpeg", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Downscales and uploads photos; returns their storage paths in order. */
export async function uploadPhotos(files: File[]): Promise<string[]> {
  const supabase = supabaseBrowser();
  return Promise.all(
    files.slice(0, MAX_PHOTOS).map(async (file) => {
      const blob = await downscale(file);
      const path = `${uid()}.jpg`;
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      return path;
    }),
  );
}

/** Removes photos uploaded for a recipe that was then abandoned. */
export async function discardPhotos(paths: string[]): Promise<void> {
  if (paths.length > 0) await supabaseBrowser().storage.from(PHOTO_BUCKET).remove(paths);
}

/** Temporary URLs for showing private photos. */
export async function photoUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabaseBrowser().storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  return data.map((d) => d.signedUrl ?? "");
}
