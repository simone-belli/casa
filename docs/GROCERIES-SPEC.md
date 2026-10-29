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
- **Specialist shop**: a shop that sells only a few of our things (a chemist, a hardware store like Bunnings, a wine shop). It has **no aisles**: each item is either **sold here** or **not sold here**, and **every item starts as not sold here**, including items added later. So setting one up is just picking the few things we buy there.
- **Filing**: for each supermarket, each item can be filed under **one** aisle of that shop, or marked **Not sold here**. Items not sold at a supermarket are left out of its shopping list. At a specialist shop, filing is just sold or not sold.
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
- **At a specialist shop** there are no aisles and no **Not sorted yet**: what we need that's sold there is in one **To buy** list. Needed items not sold there are left out. A new item added by quick add while in a specialist shop is marked as sold there.

## Quick add

The most frequent action, available in both views.

- Type a name, e.g. "pesto". Matching existing items are suggested as you type.
- Pick a match: it becomes **need**.
- No match: create a new item, already marked **need**. You can choose its home places (optional, skippable) or mark it as a **one-off**.
- When a new regular item is added from the shop view, it's filed under the aisle you pick, or under **Not sorted yet**.

## From a recipe

A recipe in the Ricettario has a **Buy ingredients** button (see [RICETTARIO-SPEC.md](RICETTARIO-SPEC.md)). The ingredients we tick become **need**: an existing item with the same name (ignoring case, accents and plurals, so "eggs" finds "Egg") is switched to need, and for anything else the person either picks the existing item it is (similar names are suggested) or sets it up as a new item, with its home places and aisles, before it's added. An item can carry an **amount** for this trip (e.g. "600 g"), shown under its name with the note. Adding more of something already on the list adds to the amount ("200 g + 600 g"). The amount is cleared when the item is bought, and can be changed in the item's edit sheet while we need it.

## Who needs it (optional view)

When an item switches to need, the app records who did it. A toggle (**Show who added it**, off by default, saved on each phone) shows a small "Simone" or "Kat" next to the items we need, in both views.

## Managing items and supermarkets

- Items: rename, change home places, add a note (e.g. "the Oatly one", "2 packs"), change the filing per supermarket, delete (with confirmation).
- Supermarkets: add, rename, delete (with confirmation). Aisles: add, rename, move up and down, delete. Items filed under a deleted aisle go back to **Not sorted yet** for that shop.
- **Adding a supermarket** can start empty or **copy another supermarket's aisles and filings**, which we then adjust.
- **Adding a specialist shop** can start with nothing sold there, or copy what another specialist shop sells. Its settings show **What it sells**: the items sold there, each removable, and a search box to add more. An item's edit sheet has a sold / not sold choice for each specialist shop.
- **Changing the kind**: a supermarket can be turned into a specialist shop (after confirming): its aisles go, everything filed under an aisle stays sold there and the rest isn't. A specialist shop turned back into a supermarket keeps what it sells under one aisle, "Sold here", and the rest stays not sold; its aisles can then be added.
- **Suggest aisles** (per supermarket, not for specialist shops): Claude files every item not yet sorted there under its likeliest aisle, using what it knows about that chain's layout. Items already filed are left alone, so it's safe to run again after corrections.
- **File every item** (per supermarket, not for specialist shops): puts every regular item under one chosen aisle, or marks them all **Not sold here**, either only the items not sorted yet there or all of them (replacing their filing, after confirming).

## Importing the current Notes list

A one-time import screen (reachable again later from settings):

1. Paste the Notes checklist into a text box, one item per line. Checklist symbols and empty lines are ignored.
2. Claude reads the lines and suggests home places for each item, from the seven fixed places. If the pasted text has headings (e.g. "Fridge"), they're used as hints. Long lists are sorted in parts, cut at the headings.
3. A review screen shows every item with its suggested places and a have/need switch (default **have**, since Notes' tick state may not survive the copy). We fix anything wrong and confirm. Nothing is saved before that.

Supermarket filings aren't guessed. They're done while shopping, through **Not sorted yet**.

## Data model

- `grocery_places`: id, name, position (the seven fixed places; read-only for the app)
- `grocery_items`: id, name, note, amount (this trip only; cleared when switched to have), status (`have` / `need`), is_one_off, needed_by (user, set when switched to need), needed_at, created by / updated by, timestamps
- `grocery_item_places`: item id, place id
- `grocery_stores`: id, name, position, kind (`supermarket` / `shop`)
- `grocery_aisles`: id, store id, name, position
- `grocery_item_aisles`: item id, store id, aisle id (one per item per store; no aisle = not sold there). A specialist shop has one aisle the app keeps out of sight: an item filed under it is sold there, and any other item (filed with no aisle, or not filed at all) isn't, which is why new items start as not sold.

All tables are shared by the two users, with the same Row Level Security as the Ricettario, and Realtime is turned on for `grocery_items` (at least) so both phones update live. The chosen supermarket and the "show who added it" toggle are per-phone settings, stored on the device.

## Out of scope for v1

- Quantities and units as structured data (a free-text note and amount cover it)
- Prices, budgets and purchase history
- Suggestions based on how often things are bought
- Offline mode (supermarket reception may be patchy; revisit if it becomes a problem)

## Branding

Logo: `logos/groceries.svg`. The theme colours come from the logo, like every other section.
