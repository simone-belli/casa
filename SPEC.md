# Casa — Spec v0.2

**Note for Claude Code:** the project is now called **Casa**. It's a household hub for Simone and Kat that holds several sections, starting with **Ricettario** (recipes) and **Agenda** (calendar and tasks). Please restructure the existing work so Ricettario becomes the first section inside Casa. Build Ricettario only for now. Agenda should exist as an empty placeholder section, and we'll spec and build it later.

## Casa — the hub

- One mobile-first web app (PWA), one home-screen icon, one login per person, shared data.
- Designed to host several sections; more may be added later.
- Initial sections: **Ricettario** (build now) and **Agenda** (empty placeholder for now).
- Each section has its own name, logo and visual theme. Casa, Ricettario and Agenda do not share a theme.

## Section 1 — Ricettario (build now)

## Purpose

A shared recipe library for Simone and Kat. Today recipes are scattered across memory, paper notebooks and phones; this app unifies them in one place to reference while cooking and to adjust over time.

## Users and platform

- Two users (Simone and Kat), each with their own login.
- One shared collection: both can view, add and edit everything; changes are visible to the other immediately.
- Used essentially 100% on phones. Build as a mobile-first web app (PWA) that can be added to the home screen; no app store.

## Adding recipes

Three input routes, all normalised by an AI step into one structured format:

1. **Dictation / typing** — for recipes that live in their heads.
2. **Photo** — phone camera snaps of notebook pages, transcribed and parsed.
3. **Paste** — text or links copied from the phone.

After parsing, the user reviews and confirms the structured recipe before saving.

## Recipe data model

- Title, optional notes/tags
- Ingredients: name, quantity, unit, **scaling mode** (linear / rounded to whole units / fixed)
- Steps (ordered)
- Quantities stored **per adult portion** so scaling is straightforward

## Portion scaling

- Every recipe page has controls for **number of adults** and **number of children**.
- A child counts as **half an adult**: portions = adults + 0.5 × children.
- Default is the family composition (2 adults + 2 children = 3 portions), configurable in settings.
- Scaling is a **temporary view adjustment**: it changes displayed quantities but is not saved to the recipe.
- Ingredient scaling modes:
  - *Linear* — multiply by portions (most ingredients)
  - *Rounded* — multiply then round to whole units (e.g. eggs)
  - *Fixed* — never scales (e.g. a pinch of salt, a baking tin)

## Editing

- Users can change quantities, add or remove ingredients, and edit steps.
- Edits **overwrite** the original; no version history.

## Out of scope for v1

- Separate personal collections
- Recipe version history
- Native iOS/Android apps

## Open questions

- Hosting and database choice
- Authentication approach for two users
- Which AI model/API to use for parsing photos and text
- Search and organisation (tags, categories)

## Section 2 — Agenda (later; placeholder only for now)

Agenda is not part of the current build. Show it in Casa's navigation as an empty "coming soon" section. The requirements we've captured so far are below, for reference only.

- One section with two views: a **calendar view** for anything dated and a **task list** with open or undecided tasks at the top.
- Calendar: fixed and recurring events with times, ideally synced with Apple Calendar on both iPhones.
- Tasks: one person proposes a task to the other, who can accept or decline it. Reminders can be set on tasks.
- Open tasks can leave both the owner and the timing undecided.
- Task lifecycle: open, proposed, accepted or declined, done.
- Each person can choose whether dated tasks appear in their iPhone calendar. The default is still to be decided.
- There is an optional periodic nudge about open tasks that are still undecided.

## Logos

## Ricettario logo

&#91;embedded content: logo concepts · rustic trattoria\]

Chosen logo: the negative version, a white italic R on tablecloth red (#C8102E) with a red-and-white checkered band.

## Casa and Agenda logos (chosen)

&#91;embedded content: Casa and Agenda logo options\]
