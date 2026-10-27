# Ricettario — Spec v0.2

_v0.2 resolves the open questions from v0.1 and adds batch recipes, units and source handling._

## Purpose

A shared recipe library for Simone and Kat. Today recipes are scattered across memory, paper notebooks and phones; this app unifies them in one place to reference while cooking and to adjust over time.

## Users and platform

- Two users (Simone and Kat), each with their own login.
- One shared collection: both can view, add and edit everything; changes are visible to the other immediately (live updates).
- Used essentially 100% on phones. Mobile-first web app (PWA) that can be added to the home screen; no app store.
- Interface language: **English**. Recipes are kept in English too: one written in another language (often Italian) is translated when it's read, so the review form already shows it in English. Dishes known in English by their Italian name keep it (Tiramisù). The original text, page or photos stay attached as the source.

## Architecture

| Concern | Choice |
|---|---|
| Frontend | Next.js (App Router, TypeScript), Tailwind CSS, installable PWA |
| Hosting | Vercel |
| Database | Supabase Postgres, with Row Level Security |
| Live updates | Supabase Realtime on the `recipes` table |
| Photo storage | Supabase Storage, private bucket `recipe-photos` |
| Authentication | Supabase email sign-in; the email carries a magic link and a one-time code (the code is what works inside an iPhone home-screen app). Sign-ups disabled, only Simone's and Kat's addresses are allowed (`allowed_emails` table enforced by RLS) |
| AI parsing | Claude Sonnet 5.5 (`claude-sonnet-5-5`) via the Anthropic TypeScript SDK, structured outputs, called only from a server route |

The Anthropic API key and the Supabase service credentials live only in server environment variables.

## Adding recipes

Three input routes, all normalised by an AI step into one structured format:

1. **Dictation / typing** — a large text box; dictation uses the phone keyboard's built-in microphone (no in-app audio recording).
2. **Photo** — one or more phone camera snaps of notebook pages. Photos are downscaled on the phone, uploaded to storage, transcribed and parsed. **The original photos stay attached to the recipe** so a misreading can be checked later.
3. **Paste** — pasted text, or a link. **Links are fetched by the server** and the recipe is read from the page (structured `schema.org/Recipe` data when present, page text otherwise). The source URL is kept on the recipe.

The AI converts imperial units (cups, ounces, °F…) to metric, and converts quantities to the recipe's base (per adult portion, or per batch).

After parsing, the user reviews and edits the structured recipe in a form before saving. The form shows the amounts for the number of servings the source gives (e.g. 4), so they can be checked against it. Switching the recipe to **A batch** keeps those amounts exactly as they are, not scaled to the family, and fills in "One batch makes" with the servings (e.g. "4 servings") if it's empty. Nothing is saved until they confirm. The AI never fills in the notes; they start empty for the user to write.

## Recipe data model

- Title, optional notes, optional tags
- **Labels**, ticked in the form and stored as tags. The AI pre-ticks them when parsing; the user can change them in the review. Any number, including none:
  - **Good for**: `breakfast`, `lunch`, `dinner`, `snack`
  - **Menu**: `quick` (ready in 25 minutes or less), `italian`, `asian`, `slow-cooker`, `bbq`, `starter`, `side`, `dessert`
  - **Diet**: `vegetarian`
  - **Season**: `hot-season` (fresh, cool food), `cold-season` (warming food); neither means good all year
- **Kind**: `portion` or `batch`
  - `portion` — ingredient quantities are stored **per adult portion**
  - `batch` — quantities are stored for **one batch**, with a yield description (e.g. "1 cake, 24 cm tin", "8 biscuits")
- Ingredients (ordered): name, quantity (optional — "salt to taste" has none), unit, **scaling mode** (linear / rounded to whole units / fixed), optional note
- Steps (ordered)
- Source: optional URL, attached photos, original pasted/dictated text
- Created by / updated by, timestamps

Units are metric: g, kg, ml, l, tsp, tbsp, plus count-style units (pieces, cloves, slices, pinch…) and an empty unit for plain counts ("3 eggs").

## Scaling

Scaling is a **temporary view adjustment**: it changes displayed quantities but is never saved.

**Portion recipes**

- Controls for **number of adults** and **number of children**.
- A child counts as **half an adult**: portions = adults + 0.5 × children.
- Default is the family composition (2 adults + 2 children = 3 portions), configurable in settings (shared by both users).

**Batch recipes**

- A multiplier control: ×0.5, ×1, ×1.5, ×2, ×3. Default ×1.

**Ingredient scaling modes** (both kinds)

- *Linear* — multiply by portions or multiplier (most ingredients)
- *Rounded* — multiply, then round to whole units, minimum 1 (e.g. eggs)
- *Fixed* — never scales (e.g. a pinch of salt, a baking tin)

Displayed amounts are rounded sensibly (e.g. whole grams above 10 g, halves and quarters for spoons).

## Buying the ingredients

Under **Ingredients**, a **Buy ingredients** button opens a checklist of the recipe's ingredients for adding them to [Groceries](GROCERIES-SPEC.md):

- Nothing is ticked at first: we tick what we need to buy. Each row says whether it's new to Groceries, already on the list, or one Groceries says we have.
- Ingredients with a quantity show their amount, scaled as on the recipe screen. The amount is kept for weights and volumes (g, kg, ml, l) and left off for counts and spoons ("eggs", not "3 eggs"); tapping it switches it.
- **Done** adds the ticked ingredients to the list as needed, with the amounts kept, and offers to open Groceries.
- If some ticked ingredients aren't in Groceries by that name, Done first asks about each of them, one at a time:
  - **Is it something already in Groceries?** Items with a similar name are suggested ("Parmigiano" for "Parmigiano Reggiano"), and a search box finds any other. Picking one adds that item instead.
  - **No, it's a new item**: its name in Groceries (the ingredient's, editable), whether it's a one-off, its home places and its aisle in each supermarket, as in Groceries' own edit sheet. Chosen straight away when nothing similar is in Groceries.
  Nothing is saved until the last one is answered; Back returns to the previous question, then to the checklist.

## Finding recipes

- **Ricettario's home is the menu** ("What shall we eat?"): a button per menu category (Quick, Italian, Asian, Slow cook, BBQ, Starters, Side dishes, Desserts), an **All recipes** button, and a search box. Tapping a button, or searching, opens the matching recipes on their own screen; its back arrow returns to the menu, and a recipe's back arrow returns to the list it was opened from.
- Two tick boxes, on the menu and on the list, remembered on each phone:
  - **Vegetarian**: only vegetarian recipes.
  - **In season**: hides recipes ticked only for the other season.
- The list has its own search box, combined with the category and the tick boxes; it matches titles, ingredients, tags and notes. Recipes are listed most recently updated first.

## Ricettario settings

Opened with ⚙︎ on the menu.

- **Seasons** (shared): the months of the hot season; the others are the cold season.
- **Sort recipes into the menu with Claude**: Claude reads the recipes that have no menu, diet or season label yet (or, on request, all of them again) and suggests their labels. The suggestions are shown for review, each label can be changed, and nothing is saved until the person confirms. Meals already ticked are kept; other tags are untouched.

## Editing

- Users can change quantities, add, remove and reorder ingredients, and edit steps.
- Edits **overwrite** the original; no version history.
- Recipes can be deleted (with confirmation).

## Out of scope for v1

- Separate personal collections
- Recipe version history
- Native iOS/Android apps
- In-app audio recording / server-side speech-to-text
- Favourites
- Offline mode

## Branding

Chosen logo: the negative version, a white italic **R** on tablecloth red (`#C8102E`) with a red-and-white checkered band. The checkered band is reused as the app header's bottom border.
