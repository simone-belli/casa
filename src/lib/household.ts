"use client";

import { useEffect, useState } from "react";
import { DEFAULT_HOT_MONTHS } from "@/lib/recipes/menu";
import { supabaseBrowser } from "@/lib/supabase/client";

export type HouseholdSettings = { default_adults: number; default_children: number };
export type Member = { user_id: string; display_name: string };

export const FALLBACK_SETTINGS: HouseholdSettings = { default_adults: 2, default_children: 2 };

export async function loadSettings(): Promise<HouseholdSettings> {
  const { data, error } = await supabaseBrowser()
    .from("household_settings")
    .select("default_adults, default_children")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
}

export async function saveSettings(settings: HouseholdSettings): Promise<void> {
  const { error } = await supabaseBrowser().from("household_settings").update(settings).eq("id", 1);
  if (error) throw error;
}

/**
 * Months (1–12) of the hot season; the rest are the cold season. Loaded on
 * their own so the other settings still work before migration 0009 is run.
 */
export async function loadHotMonths(): Promise<number[]> {
  const { data, error } = await supabaseBrowser().from("household_settings").select("hot_months").eq("id", 1).single();
  if (error) throw error;
  return (data as { hot_months: number[] }).hot_months;
}

export async function saveHotMonths(hotMonths: number[]): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("household_settings")
    .update({ hot_months: [...hotMonths].sort((a, b) => a - b) })
    .eq("id", 1);
  if (error) throw error;
}

/** The household's hot months, or the default ones if they can't be loaded. */
export function useHotMonths() {
  const [months, setMonths] = useState<number[] | null>(null);
  useEffect(() => {
    loadHotMonths().then(setMonths, () => setMonths(DEFAULT_HOT_MONTHS));
  }, []);
  return months;
}

export async function loadMembers(): Promise<Member[]> {
  const { data, error } = await supabaseBrowser().rpc("household_members");
  if (error) throw error;
  return data as Member[];
}

/** Household members and the signed-in user's id. */
export function useHousehold() {
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadMembers(), supabaseBrowser().auth.getUser()])
      .then(([list, { data }]) => {
        if (cancelled) return;
        setMembers(list);
        setMe(data.user?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const nameOf = (userId: string | null | undefined) =>
    members.find((m) => m.user_id === userId)?.display_name ?? null;

  return { members, me, nameOf };
}

/** The household's default family size (shared setting). */
export function useFamilyDefaults() {
  const [settings, setSettings] = useState<HouseholdSettings | null>(null);
  useEffect(() => {
    loadSettings().then(setSettings, () => setSettings(FALLBACK_SETTINGS));
  }, []);
  return settings;
}
