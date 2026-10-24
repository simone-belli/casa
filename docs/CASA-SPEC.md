# Casa — Spec v0.2

**Note for Claude Code:** this is a new project, starting from scratch. The repository is empty apart from this spec. **Casa** is a household hub for Simone and Kat that holds several sections, starting with **Ricettario** (recipes) and **Agenda** (calendar and tasks). Build the Casa shell and the Ricettario section first. Agenda should exist only as an empty placeholder section, and we'll spec and build it later.

## Casa — the hub

- One mobile-first web app (PWA), one home-screen icon, one login per person, shared data.
- Designed to host several sections; more may be added later.
- Initial sections: **Ricettario** (build now) and **Agenda** (empty placeholder for now).
- Each section has its own name, logo and visual theme. Casa, Ricettario and Agenda do not share a theme.
- Home screen: the Casa logo and two large buttons, **Ricettario** and **Agenda** (marked "coming soon"), with a small link to Settings.
- Settings (Casa level, shared): default family size, the household members, sign out.
- v0 is not deployed: it runs on a computer at home and the phones open it over Wi-Fi. Moving to Vercel later needs no code changes.

## Section 1 — Ricettario (build now)

Specified in [RICETTARIO-SPEC.md](RICETTARIO-SPEC.md).

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

The chosen logos are in [`/logos`](../logos): `casa.svg` (also the home-screen icon), `ricettario.svg` and `agenda.svg`. Each section's theme colours come from its logo.
