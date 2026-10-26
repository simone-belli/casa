"use client";

import { useEffect, useState } from "react";
import { useDeviceSetting } from "@/lib/device-setting";
import { useHotMonths } from "@/lib/household";
import { currentSeason } from "@/lib/recipes/menu";

/** The Vegetarian and In season tick boxes, remembered on this phone. */
export function useMenuFilters() {
  const [vegetarian, setVegetarian] = useDeviceSetting("ricettario.vegetarian", false);
  const [inSeason, setInSeason] = useDeviceSetting("ricettario.in-season", false);
  const hotMonths = useHotMonths();
  const season = hotMonths ? currentSeason(hotMonths) : null;
  return { vegetarian, setVegetarian, inSeason, setInSeason, season };
}

export function MenuFilters({ filters }: { filters: ReturnType<typeof useMenuFilters> }) {
  const { vegetarian, setVegetarian, inSeason, setInSeason, season } = filters;
  const toggle = "flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold";
  return (
    <div className="flex flex-wrap gap-2">
      <label className={`${toggle} ${vegetarian ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-ink"}`}>
        <input type="checkbox" checked={vegetarian} onChange={() => setVegetarian(!vegetarian)} className="h-4 w-4 accent-brand" />
        Vegetarian
      </label>
      <label className={`${toggle} ${inSeason ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-ink"}`}>
        <input type="checkbox" checked={inSeason} onChange={() => setInSeason(!inSeason)} className="h-4 w-4 accent-brand" />
        In season
        {season && <span className="font-normal text-muted">({season === "hot-season" ? "☀️ hot" : "❄️ cold"})</span>}
      </label>
    </div>
  );
}

const LAST_LIST_KEY = "ricettario.last-list";

/** Remembers the list a recipe was opened from, so its back arrow returns there. */
export function rememberList(href: string) {
  try {
    window.sessionStorage.setItem(LAST_LIST_KEY, href);
  } catch {
    // Blocked storage: back goes to the menu.
  }
}

export function useLastList(): string {
  const [href, setHref] = useState("/ricettario");
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(LAST_LIST_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage only exists in the browser
      if (stored?.startsWith("/ricettario/recipes")) setHref(stored);
    } catch {
      // Blocked storage: back goes to the menu.
    }
  }, []);
  return href;
}
