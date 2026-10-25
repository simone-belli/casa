export const ITEM_STATUSES = ["have", "need"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export type Item = {
  id: string;
  name: string;
  note: string | null;
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
export type Store = { id: string; name: string; position: number };
export type Aisle = { id: string; store_id: string; name: string; position: number };

export type ItemPlace = { item_id: string; place_id: string };
/** Where an item is in a supermarket; aisle_id null means it isn't sold there. */
export type ItemAisle = { item_id: string; store_id: string; aisle_id: string | null };

/** Choice for an item that a supermarket doesn't sell (stored as a filing with no aisle). */
export const NOT_SOLD = "not-sold";

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
