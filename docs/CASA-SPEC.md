# Casa — Spec v0.2

**Note for Claude Code:** this is a new project, starting from scratch. The repository is empty apart from this spec. **Casa** is a household hub for Simone and Kat that holds several sections, starting with **Ricettario** (recipes) and **Agenda** (calendar and tasks). Build the Casa shell and the Ricettario section first. Agenda should exist only as an empty placeholder section, and we'll spec and build it later.

## Casa — the hub

- One mobile-first web app (PWA), one home-screen icon, one login per person, shared data.
- Designed to host several sections; more may be added later.
- Initial sections: **Ricettario** and **Groceries** (built), **Agenda** (empty placeholder for now).
- Each section has its own name, logo and visual theme. Casa, Ricettario, Agenda and Groceries do not share a theme.
- Home screen: the Casa logo and large buttons for **Agenda**, **Groceries** and **Ricettario**, in that order, with a small **Report a bug** button at the bottom left and a small link to Settings at the bottom right.
- Report a bug: a screen where either person types or dictates (with the keyboard's microphone) what went wrong and sends it. Reports are stored in the database for review during development; the app can only add them.
- Settings (Casa level, shared): default family size, the hot season's months (for Ricettario's *In season* filter), the household members, sign out.
- Casa is deployed on Vercel and served over HTTPS, so it works from anywhere, not just on the home Wi-Fi. It can still be run on a computer for development.

## Section 1 — Ricettario (build now)

Specified in [RICETTARIO-SPEC.md](RICETTARIO-SPEC.md).

## Section 2 — Agenda (specced, not built yet)

Specified in [AGENDA-SPEC.md](AGENDA-SPEC.md). Until it's built, it stays a "coming soon" section in Casa's navigation.

## Section 3 — Groceries (v1 built)

Specified in [GROCERIES-SPEC.md](GROCERIES-SPEC.md).

## Logos

The chosen logos are in [`/logos`](../logos): `casa.svg` (also the home-screen icon), `ricettario.svg`, `agenda.svg` and `groceries.svg`. Each section's theme colours come from its logo.
