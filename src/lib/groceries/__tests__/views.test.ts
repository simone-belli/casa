import { describe, expect, it } from "vitest";
import { EMPTY_GROCERIES, type Groceries, type Item } from "../types";
import { homeGroups, matchItems, pastedChunks, pastedLines, sameName, shopView } from "../views";

const item = (id: string, name: string, status: Item["status"] = "have", is_one_off = false): Item => ({
  id,
  name,
  note: null,
  status,
  is_one_off,
  needed_by: null,
  needed_at: null,
  created_at: "",
  updated_at: "",
});

const data: Groceries = {
  ...EMPTY_GROCERIES,
  items: [
    item("milk", "Milk", "need"),
    item("eggs", "Eggs"),
    item("sponge", "Sponges", "need"),
    item("bin", "Bin bags"),
    item("candles", "Birthday candles", "need", true),
    item("apples", "Apples", "need"),
  ],
  places: [
    { id: "pantry", name: "Pantry", position: 1 },
    { id: "fridge", name: "Fridge", position: 0 },
    { id: "bath", name: "Bathroom", position: 2 },
  ],
  itemPlaces: [
    { item_id: "milk", place_id: "fridge" },
    { item_id: "eggs", place_id: "fridge" },
    { item_id: "sponge", place_id: "pantry" },
    { item_id: "sponge", place_id: "bath" },
  ],
  stores: [{ id: "tesco", name: "Tesco", position: 0 }],
  aisles: [
    { id: "dairy", store_id: "tesco", name: "Dairy", position: 1 },
    { id: "fruit", store_id: "tesco", name: "Fruit & veg", position: 0 },
  ],
  itemAisles: [
    { item_id: "milk", store_id: "tesco", aisle_id: "dairy" },
    { item_id: "apples", store_id: "tesco", aisle_id: "fruit" },
  ],
};

const names = (items: Item[]) => items.map((i) => i.name);

describe("homeGroups", () => {
  it("groups by place in order, repeats items in several places, and adds Elsewhere and One-offs", () => {
    const groups = homeGroups(data, false);
    expect(groups.map((g) => [g.title, names(g.items)])).toEqual([
      ["Fridge", ["Eggs", "Milk"]],
      ["Pantry", ["Sponges"]],
      ["Bathroom", ["Sponges"]],
      ["Elsewhere", ["Apples", "Bin bags"]],
      ["One-offs", ["Birthday candles"]],
    ]);
  });

  it("shows only what we need, dropping empty groups", () => {
    const groups = homeGroups(data, true);
    expect(groups.map((g) => [g.title, names(g.items)])).toEqual([
      ["Fridge", ["Milk"]],
      ["Pantry", ["Sponges"]],
      ["Bathroom", ["Sponges"]],
      ["Elsewhere", ["Apples"]],
      ["One-offs", ["Birthday candles"]],
    ]);
  });
});

describe("shopView", () => {
  it("lists only needed items, by aisle in walking order", () => {
    const view = shopView(data, "tesco");
    expect(names(view.oneOffs)).toEqual(["Birthday candles"]);
    expect(names(view.unsorted)).toEqual(["Sponges"]);
    expect(view.aisles.map((a) => [a.aisle.name, names(a.items)])).toEqual([
      ["Fruit & veg", ["Apples"]],
      ["Dairy", ["Milk"]],
    ]);
  });

  it("treats every item as unsorted in a supermarket without filings", () => {
    const view = shopView(data, "lidl");
    expect(names(view.unsorted)).toEqual(["Apples", "Milk", "Sponges"]);
    expect(view.aisles).toEqual([]);
  });
});

describe("matchItems", () => {
  it("finds items containing every word, names starting with the query first", () => {
    const items = [item("1", "Oat milk"), item("2", "Milk"), item("3", "Milk chocolate"), item("4", "Eggs")];
    expect(names(matchItems(items, "milk"))).toEqual(["Milk", "Milk chocolate", "Oat milk"]);
    expect(names(matchItems(items, "oat MILK"))).toEqual(["Oat milk"]);
    expect(matchItems(items, "  ")).toEqual([]);
  });

  it("ignores accents", () => {
    expect(names(matchItems([item("1", "Caffè")], "caffe"))).toEqual(["Caffè"]);
  });
});

describe("sameName", () => {
  it("ignores case, accents and surrounding spaces", () => {
    expect(sameName(" Caffè ", "caffe")).toBe(true);
    expect(sameName("Milk", "Oat milk")).toBe(false);
  });
});

describe("pastedLines", () => {
  it("drops checkboxes, bullets and empty lines", () => {
    const text = "Fridge\n- [ ] Milk\n- [x] Eggs\n\n☐ Butter\n✓ Jam\n• Bread\n* Washing-up liquid\n  Pasta  \n";
    expect(pastedLines(text)).toEqual(["Fridge", "Milk", "Eggs", "Butter", "Jam", "Bread", "Washing-up liquid", "Pasta"]);
  });

  it("keeps hyphens inside names", () => {
    expect(pastedLines("Washing-up liquid")).toEqual(["Washing-up liquid"]);
  });
});

describe("pastedChunks", () => {
  const section = (title: string, n: number) => [title, ...Array.from({ length: n }, (_, i) => `* ${title} ${i + 1}`)].join("\n");

  it("keeps sections whole, cutting only at blank lines", () => {
    const text = [section("Fruit", 30), section("Meat", 30), section("Pasta", 30)].join("\n\n\n");
    const chunks = pastedChunks(text, 80);
    expect(chunks.map((c) => c.length)).toEqual([62, 31]);
    expect(chunks[1][0]).toBe("Pasta");
  });

  it("splits a section longer than the limit, repeating its heading", () => {
    const chunks = pastedChunks(section("Spices", 99), 40);
    expect(chunks.map((c) => c.length)).toEqual([40, 40, 22]);
    expect(chunks.map((c) => c[0])).toEqual(["Spices", "Spices", "Spices"]);
    expect(chunks.flat().filter((l) => l !== "Spices")).toHaveLength(99);
  });

  it("keeps items after a blank line inside a section with their heading", () => {
    const text = `${section("Fruit", 60)}\n\n${section("Meat", 20)}\n\n* Nduja\n\n* Bottarga\n\n${section("Pasta", 20)}`;
    const chunks = pastedChunks(text, 80);
    expect(chunks.map((c) => c.length)).toEqual([61, 44]);
    expect(chunks[1].slice(0, 1)).toEqual(["Meat"]);
    expect(chunks[1]).toContain("Bottarga");
  });

  it("returns nothing for an empty paste", () => {
    expect(pastedChunks(" \n\n ")).toEqual([]);
  });
});
