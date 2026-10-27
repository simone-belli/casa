import { describe, expect, it } from "vitest";
import type { Ingredient } from "@/lib/recipes/types";
import { amountByDefault, combineAmounts, findItem, planPurchase, shoppingAmount } from "../from-recipe";
import type { Item } from "../types";

const item = (id: string, name: string, status: Item["status"] = "have", amount: string | null = null): Item => ({
  id,
  name,
  note: null,
  amount,
  status,
  is_one_off: false,
  needed_by: null,
  needed_at: null,
  created_at: "",
  updated_at: "",
});

const ingredient = (name: string, quantity: number | null, unit = "", scaling: Ingredient["scaling"] = "linear"): Ingredient => ({
  name,
  quantity,
  unit,
  scaling,
  note: null,
});

describe("amounts", () => {
  it("keeps weights and volumes by default, not counts or spoons", () => {
    expect(amountByDefault(ingredient("minced meat", 200, "g"))).toBe(true);
    expect(amountByDefault(ingredient("milk", 0.5, "l"))).toBe(true);
    expect(amountByDefault(ingredient("eggs", 1, "", "rounded"))).toBe(false);
    expect(amountByDefault(ingredient("olive oil", 1, "tbsp"))).toBe(false);
    expect(amountByDefault(ingredient("salt", null))).toBe(false);
  });

  it("scales the amount like the recipe screen", () => {
    expect(shoppingAmount(ingredient("minced meat", 200, "g"), 3)).toBe("600 g");
    expect(shoppingAmount(ingredient("flour", 400, "g"), 3)).toBe("1.2 kg");
    expect(shoppingAmount(ingredient("salt", null), 3)).toBeNull();
    expect(shoppingAmount(ingredient("mince", 200, "g"), 0)).toBeNull();
  });

  it("adds to an amount already on the list", () => {
    expect(combineAmounts(null, "600 g")).toBe("600 g");
    expect(combineAmounts("200 g", null)).toBe("200 g");
    expect(combineAmounts("200 g", "600 g")).toBe("200 g + 600 g");
  });
});

describe("findItem", () => {
  const items = [item("eggs", "Eggs"), item("olive", "Olive"), item("tom", "Tomato"), item("oil", "Olive oil")];

  it("matches names ignoring case and plurals", () => {
    expect(findItem(items, "eggs")?.id).toBe("eggs");
    expect(findItem(items, "egg")?.id).toBe("eggs");
    expect(findItem(items, "olives")?.id).toBe("olive");
    expect(findItem(items, "tomatoes")?.id).toBe("tom");
    expect(findItem(items, "olive oil")?.id).toBe("oil");
    expect(findItem(items, "basil")).toBeUndefined();
  });
});

describe("planPurchase", () => {
  it("marks existing items needed and adds new ones", () => {
    const items = [item("eggs", "Eggs"), item("mince", "Minced meat", "need", "200 g")];
    const plan = planPurchase(items, [
      { name: "eggs", amount: null },
      { name: "minced meat", amount: "600 g" },
      { name: "basil", amount: null },
      { name: "parmesan", amount: "50 g" },
      { name: "Parmesan", amount: "30 g" },
    ]);
    expect(plan.update).toEqual([
      { id: "eggs", amount: null },
      { id: "mince", amount: "200 g + 600 g" },
    ]);
    expect(plan.create).toEqual([
      { name: "Basil", amount: null },
      { name: "Parmesan", amount: "50 g + 30 g" },
    ]);
  });

  it("ignores an old amount on an item we have", () => {
    const plan = planPurchase([item("mince", "Minced meat", "have", "200 g")], [{ name: "Minced meat", amount: "600 g" }]);
    expect(plan.update).toEqual([{ id: "mince", amount: "600 g" }]);
  });
});
