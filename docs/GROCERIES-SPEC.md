# Groceries — Spec v0.1

_v0.1 is the first version, written from the brainstorm of the current Notes-based workflow._

## Purpose

A shared grocery list for Simone and Kat. Today it's a long macOS Notes checklist: ticked means "we have it", unticked means "we need it". It's used at home to keep track and at the supermarket to tick things off. Two problems:

1. The list is long and everything is always visible, including the many things we already have. That's especially annoying in the shop.
2. At home we think in places (fridge, pantry, cleaning cupboard), but every supermarket is laid out differently, so the list is in the wrong order when we're shopping.

Groceries keeps the one-list idea and shows it in two ways: by home place when taking stock, and by the chosen supermarket's aisles, showing only what we need, when shopping.

## Users and platform

Same as the rest of Casa: two users, one shared list, live updates, mobile-first, interface in English. We often shop independently and sometimes split up in the same shop, so live sync matters during a trip.

## Concepts

- **Item**: something we buy regularly, e.g. "Oat milk". It is either **have** or **need**.
- **Home place**: where an item lives at home. The places are fixed, in this order: **Fruit, Fridge, Freezer, Pantry, Bathroom, Clean & wash, Other**. An item can be in **one or more** home places, or none (it then shows under Other).
- **Supermarket**: a shop we use (three regularly). Each one has an ordered list of **aisles** in walking order (Fruit & veg → Bakery → Meat → …), which we can edit and reorder.
- **Filing**: for each supermarket, each item can be filed under **one** aisle of that shop, or marked **Not sold here**. Items not sold at a supermarket are left out of its shopping list (a short note at the bottom names any that are needed, so they can be bought elsewhere).
- **One-off**: an item we need just this once (e.g. "birthday candles"). It is deleted once bought.

## Home view (taking stock)

- Shows every item, grouped by home place in the places' order. An item in several places appears under each of them. Items with no place go under **Other**, and one-offs go under **One-offs** at the end.
- Tap an item to switch it between have and need. Items we need are clearly highlighted.
- A filter: **All** / **Only what we need**.
- Search box at the top, used by quick add (below).

## Shop view (at the supermarket)

- Start by picking the supermarket. The app remembers the last one each person picked, on their own phone, so Simone and Kat can be in different shops at the same time.
- Shows **only items we need**, grouped by that shop's aisles in walking order.
- At the top:
  - **One-offs**: one-off items we need (never filed).
  - **Not sorted yet**: items we need that aren't filed for this supermarket yet. Tapping an item's "file" control picks an aisle, and that filing is kept for next time. The layout gets set up gradually while shopping.
- **Tap an item when it's in the trolley**: it switches to **have straight away** (and a one-off is deleted). There's no "Done shopping" step.
  - On the phone that ticked it, the item stays greyed out at the bottom under **In the trolley** until the shop view is left, so a mistaken tap can be undone with another tap.
  - On the other person's phone it just disappears from the list, live. If we split up in the shop, neither of us picks up something the other already has.
- Quick add works here too, for things remembered mid-trip.

## Quick add

The most frequent action, available in both views.

- Type a name, e.g. "pesto". Matching existing items are suggested as you type.
- Pick a match: it becomes **need**.
- No match: create a new item, already marked **need**. You can choose its home places (optional, skippable) or mark it as a **one-off**.
- When a new regular item is added from the shop view, it's filed under the aisle you pick, or under **Not sorted yet**.

## Who needs it (optional view)

When an item switches to need, the app records who did it. A toggle (**Show who added it**, off by default, saved on each phone) shows a small "Simone" or "Kat" next to the items we need, in both views.

## Managing items and supermarkets

- Items: rename, change home places, add a note (e.g. "the Oatly one", "2 packs"), change the filing per supermarket, delete (with confirmation).
- Supermarkets: add, rename, delete (with confirmation). Aisles: add, rename, move up and down, delete. Items filed under a deleted aisle go back to **Not sorted yet** for that shop.
- **Adding a supermarket** can start empty or **copy another supermarket's aisles and filings**, which we then adjust.
- **Suggest aisles** (per supermarket): Claude files every item not yet sorted there under its likeliest aisle, using what it knows about that chain's layout. Items already filed are left alone, so it's safe to run again after corrections.

## Importing the current Notes list

A one-time import screen (reachable again later from settings):

1. Paste the Notes checklist into a text box, one item per line. Checklist symbols and empty lines are ignored.
2. Claude reads the lines and suggests home places for each item, from the seven fixed places. If the pasted text has headings (e.g. "Fridge"), they're used as hints. Long lists are sorted in parts, cut at the headings.
3. A review screen shows every item with its suggested places and a have/need switch (default **have**, since Notes' tick state may not survive the copy). We fix anything wrong and confirm. Nothing is saved before that.

Supermarket filings aren't guessed. They're done while shopping, through **Not sorted yet**.

## Data model

- `grocery_places`: id, name, position (the seven fixed places; read-only for the app)
- `grocery_items`: id, name, note, status (`have` / `need`), is_one_off, needed_by (user, set when switched to need), needed_at, created by / updated by, timestamps
- `grocery_item_places`: item id, place id
- `grocery_stores`: id, name, position
- `grocery_aisles`: id, store id, name, position
- `grocery_item_aisles`: item id, store id, aisle id (one per item per store; no aisle = not sold there)

All tables are shared by the two users, with the same Row Level Security as the Ricettario, and Realtime is turned on for `grocery_items` (at least) so both phones update live. The chosen supermarket and the "show who added it" toggle are per-phone settings, stored on the device.

## Out of scope for v1

- Adding a recipe's ingredients to the list from the Ricettario
- Quantities and units as structured data (a free-text note covers it)
- Prices, budgets and purchase history
- Suggestions based on how often things are bought
- Offline mode (supermarket reception may be patchy; revisit if it becomes a problem)

## Branding

Logo: `logos/groceries.svg`. The theme colours come from the logo, like every other section.
