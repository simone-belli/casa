export const ITEM_STATUSES = ["have", "need"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export type Item = {
  id: string;
  name: string;
  note: string | null;
  /** How much we need this time, e.g. "600 g"; cleared when bought. */
  amount: string | null;
  status: ItemStatus;
  is_one_off: boolean;
  needed_by: string | null;
  needed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** The fixed home places, in order (set up by migration 0003). */
export const HOME_PLACES = ["Fruit", "Fridge", "Freezer", "Pantry", "Bathroom", "Clean & wash", "Other"] as const;
/** Where items without a home place are listed. */
export const OTHER_PLACE = "Other";

export type Place = { id: string; name: string; position: number };
/**
 * A supermarket has aisles in walking order. A specialist shop (a chemist, a
 * hardware store) has none: an item is either sold there or not, and new
 * items start as not sold.
 */
export const STORE_KINDS = ["supermarket", "shop"] as const;
export type StoreKind = (typeof STORE_KINDS)[number];

/** `kind` is missing until migration 0011 has been run; treat that as a supermarket. */
export type Store = { id: string; name: string; position: number; kind?: StoreKind };
export type Aisle = { id: string; store_id: string; name: string; position: number };

export type ItemPlace = { item_id: string; place_id: string };
/** Where an item is in a supermarket; aisle_id null means it isn't sold there. */
export type ItemAisle = { item_id: string; store_id: string; aisle_id: string | null };

/** Choice for an item that a supermarket doesn't sell (stored as a filing with no aisle). */
export const NOT_SOLD = "not-sold";

/**
 * The one aisle a specialist shop has, out of sight: items filed under it are
 * sold there, and any other item (filed with no aisle, or not at all) isn't.
 */
export const SHOP_AISLE_NAME = "Sold here";

/** Everything in the Groceries section, loaded in one go (it's small). */
export type Groceries = {
  items: Item[];
  places: Place[];
  stores: Store[];
  aisles: Aisle[];
  itemPlaces: ItemPlace[];
  itemAisles: ItemAisle[];
};

export const EMPTY_GROCERIES: Groceries = {
  items: [],
  places: [],
  stores: [],
  aisles: [],
  itemPlaces: [],
  itemAisles: [],
};
