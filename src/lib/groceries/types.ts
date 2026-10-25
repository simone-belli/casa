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

export type Place = { id: string; name: string; position: number };
export type Store = { id: string; name: string; position: number };
export type Aisle = { id: string; store_id: string; name: string; position: number };

export type ItemPlace = { item_id: string; place_id: string };
export type ItemAisle = { item_id: string; store_id: string; aisle_id: string };

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
