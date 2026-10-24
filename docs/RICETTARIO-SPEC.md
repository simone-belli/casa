# Ricettario — Spec v0.2

_v0.2 resolves the open questions from v0.1 and adds batch recipes, units and source handling._

## Purpose

A shared recipe library for Simone and Kat. Today recipes are scattered across memory, paper notebooks and phones; this app unifies them in one place to reference while cooking and to adjust over time.

## Users and platform

- Two users (Simone and Kat), each with their own login.
- One shared collection: both can view, add and edit everything; changes are visible to the other immediately (live updates).
- Used essentially 100% on phones. Mobile-first web app (PWA) that can be added to the home screen; no app store.
- Interface language: **English**. Recipes keep the language they were written in.

## Architecture

| Concern | Choice |
|---|---|
| Frontend | Next.js (App Router, TypeScript), Tailwind CSS, installable PWA |
| Hosting | Vercel |
| Database | Supabase Postgres, with Row Level Security |
| Live updates | Supabase Realtime on the `recipes` table |
| Photo storage | Supabase Storage, private bucket `recipe-photos` |
| Authentication | Supabase email magic link; sign-ups disabled, only Simone's and Kat's addresses are allowed (`allowed_emails` table enforced by RLS) |
| AI parsing | Claude Sonnet 5.5 (`claude-sonnet-5-5`) via the Anthropic TypeScript SDK, structured outputs, called only from a server route |

The Anthropic API key and the Supabase service credentials live only in server environment variables.

## Adding recipes

Three input routes, all normalised by an AI step into one structured format:

1. **Dictation / typing** — a large text box; dictation uses the phone keyboard's built-in microphone (no in-app audio recording).
2. **Photo** — one or more phone camera snaps of notebook pages. Photos are downscaled on the phone, uploaded to storage, transcribed and parsed. **The original photos stay attached to the recipe** so a misreading can be checked later.
3. **Paste** — pasted text, or a link. **Links are fetched by the server** and the recipe is read from the page (structured `schema.org/Recipe` data when present, page text otherwise). The source URL is kept on the recipe.

The AI converts imperial units (cups, ounces, °F…) to metric, and converts quantities to the recipe's base (per adult portion, or per batch).

After parsing, the user reviews and edits the structured recipe in a form before saving. Nothing is saved until they confirm.

## Recipe data model

- Title, optional notes, optional tags
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

## Finding recipes

- v1: a **text search** box on the recipe list that matches titles, ingredients, tags and notes.
- Recipes are listed most recently updated first.

## Editing

- Users can change quantities, add, remove and reorder ingredients, and edit steps.
- Edits **overwrite** the original; no version history.
- Recipes can be deleted (with confirmation).

## Out of scope for v1

- Separate personal collections
- Recipe version history
- Native iOS/Android apps
- In-app audio recording / server-side speech-to-text
- Fixed categories and favourites (tags exist in the data model, but there is no filtering UI beyond search yet)
- Offline mode

## Branding

Chosen logo: the negative version, a white italic **R** on tablecloth red (`#C8102E`) with a red-and-white checkered band. The checkered band is reused as the app header's bottom border.
