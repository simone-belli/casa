"use client";

import { useState } from "react";
import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { MENU } from "@/lib/recipes/menu";
import { useSafeRouter } from "@/lib/navigation";
import { MenuFilters, useMenuFilters } from "./menu-filters";

/** Ricettario's home: pick a category (or search) to see the matching recipes. */
export function Menu() {
  const router = useSafeRouter();
  const filters = useMenuFilters();
  const [query, setQuery] = useState("");

  return (
    <div className="flex flex-col gap-4 pt-4">
      <h2 className="font-display text-2xl">What shall we eat?</h2>
      <nav aria-label="Menu" className="grid grid-cols-4 gap-2">
        {MENU.map((item) => (
          <SafeLink
            key={item.tag}
            href={`/ricettario/recipes?c=${item.tag}`}
            className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface px-1 py-2 text-center text-xs leading-tight font-semibold text-ink shadow-sm active:scale-[0.97] active:bg-bg"
          >
            <span className="text-2xl" aria-hidden>
              {item.icon}
            </span>
            {item.name}
          </SafeLink>
        ))}
      </nav>
      <SafeLink
        href="/ricettario/recipes"
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface font-semibold text-ink shadow-sm active:bg-bg"
      >
        <span aria-hidden>📖</span> All recipes
      </SafeLink>
      <MenuFilters filters={filters} />
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) router.push(`/ricettario/recipes?q=${encodeURIComponent(query.trim())}`);
        }}
      >
        <input
          type="search"
          enterKeyHint="search"
          placeholder="Search recipes, ingredients, tags…"
          aria-label="Search recipes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${ui.input} rounded-full px-4`}
        />
      </form>
    </div>
  );
}
