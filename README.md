# Casa

Simone and Kat's household hub: one mobile web app with a section per area of
home life. Specs live in [`docs/`](docs):

- [`docs/CASA-SPEC.md`](docs/CASA-SPEC.md): the hub
- [`docs/RICETTARIO-SPEC.md`](docs/RICETTARIO-SPEC.md): the recipe section
- [`docs/AGENDA-SPEC.md`](docs/AGENDA-SPEC.md): the calendar and tasks section
- [`docs/GROCERIES-SPEC.md`](docs/GROCERIES-SPEC.md): the shopping list section

| Section | Status |
|---|---|
| **Ricettario** (recipes) | v0: add by typing/dictation, photo or link; menu filters (quick, Italian, Asian…, vegetarian, in season); scaling; editing; live sync |
| **Agenda** (calendar and tasks) | v0: calendar and tasks views, proposals, recurring items, weekly nudge, quick add with Claude, two-way Google Calendar sync; live sync |
| **Groceries** (shopping list) | v1: home and shopping views, quick add, one-offs, supermarkets and aisles, paste import; live sync |

Casa is deployed on Vercel at `https://casa-pi-weld.vercel.app` and works from
anywhere over HTTPS. It can also be run on a computer for development.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind) · Supabase (Postgres with row
level security, Auth, Realtime, Storage) · Claude Sonnet 5.5 for reading
recipes and sorting them into the menu, sorting grocery lists and reading Agenda's quick-add lines, called only
from the server.

## One-time setup

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**.
   This creates the tables, security rules, live updates and the private
   `recipe-photos` bucket. Then do the same, in order, with each Groceries
   migration: [`0002_groceries.sql`](supabase/migrations/0002_groceries.sql),
   [`0003_fixed_home_places.sql`](supabase/migrations/0003_fixed_home_places.sql),
   [`0004_freezer.sql`](supabase/migrations/0004_freezer.sql) and
   [`0005_not_sold_here.sql`](supabase/migrations/0005_not_sold_here.sql), then
   the Agenda migrations [`0006_agenda.sql`](supabase/migrations/0006_agenda.sql)
   and [`0007_agenda_sync.sql`](supabase/migrations/0007_agenda_sync.sql), and finally
   [`0008_bug_reports.sql`](supabase/migrations/0008_bug_reports.sql) for the
   *Report a bug* screen and [`0009_seasons.sql`](supabase/migrations/0009_seasons.sql)
   for Ricettario's seasons.

   **Already set up?** Run, in order, whichever of these you haven't run yet.
   `0003`, `0005`, `0007`, `0008` and `0009` are safe to run again; if Groceries says the home places
   aren't set up, run `0003`.
3. Still in the SQL Editor, add the two of you (lower-case emails):

   ```sql
   insert into public.allowed_emails (email, display_name) values
     ('simone@example.com', 'Simone'),
     ('kat@example.com', 'Kat');
   ```

4. **Authentication → Users → Add user → Create new user**: create a user for
   each of the two addresses (tick *Auto confirm*; the password doesn't matter,
   you'll sign in with emailed codes).
5. **Authentication → Sign In / Providers**: turn **off** *Allow new users to sign up*.
6. **Authentication → Emails → Magic link**: replace the template with
   [`supabase/email-templates/magic-link.html`](supabase/email-templates/magic-link.html),
   so the email contains a 6-digit code. (On iPhone a home-screen app doesn't
   share its login with Safari, so the code is the reliable way to sign in.)
7. **Emails for Kat:** Supabase's built-in email sender only delivers to
   members of your Supabase organisation and only a few emails per hour. Either
   invite Kat's address to the organisation (**Organization → Team**), or set
   up your own SMTP sender under **Authentication → Emails → SMTP settings**.
   Sessions last a long time, so you'll rarely need to sign in.
8. **Authentication → URL Configuration**: set *Site URL* to the Vercel
   address (`https://casa-pi-weld.vercel.app`) and add the same address followed
   by `/**` to *Redirect URLs*. For local development, also add
   `http://localhost:3000/**`.

### 2. Configuration

The app reads these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: from
  the project's **Connect** dialog (or Project Settings → API). The legacy
  `anon` key also works, as `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `ANTHROPIC_API_KEY`: your Claude API key. It stays on the server; the
  phones never see it.
- For Agenda's Google Calendar sync (optional; see step 5):
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_SECRET_KEY`,
  `AGENDA_TOKEN_KEY` and `CRON_SECRET`. All of them stay on the server.

On Vercel, set them under **Project → Settings → Environment Variables**. For
local development, copy them into `.env.local`:

```sh
cp .env.example .env.local
```

### 3. Deploy on Vercel

1. In Vercel, **Add New → Project** and import this repository. The defaults
   for Next.js are right; no build settings need changing.
2. Add the environment variables from step 2 and deploy.
3. Every push to `main` deploys again.

On the phones, open `https://casa-pi-weld.vercel.app` in Safari, then
**Share → Add to Home Screen** to get the Casa icon.

### 4. Run it locally (optional)

You need Node.js 22 or later.

```sh
npm install
npm run dev
```

Then open `http://localhost:3000`. `npm run dev` also listens on the home
network, so a phone on the same Wi-Fi can open
`http://<computer-name>.local:3000` (sign-in redirects only work for
addresses listed in step 1.8).

### 5. Google Calendar for Agenda (optional)

Agenda keeps everything dated in one shared Google calendar, so it shows up in
both your calendar apps. Agenda works without it; set it up once:

1. **The Casa calendar.** In Google Calendar (on a computer), with the account
   that will own it: **Other calendars → + → Create new calendar**, name it
   "Casa". Then in its **Settings and sharing → Share with specific people**,
   add the other person with *Make changes to events*.
2. **A Google Cloud project.** At
   [console.cloud.google.com](https://console.cloud.google.com), create a
   project (e.g. "Casa"), then **APIs & Services → Library** → enable the
   **Google Calendar API**.
3. **The consent screen.** **APIs & Services → OAuth consent screen**
   (*Google Auth Platform*): app name "Casa", user type **External**. Under
   **Branding**: support and developer contact email, no logo (a logo needs
   Google's brand verification), home page `https://casa-pi-weld.vercel.app/login`,
   privacy policy `https://casa-pi-weld.vercel.app/privacy`, and authorised
   domain `casa-pi-weld.vercel.app`. Under **Audience**, add the owner's Google
   account as a test user, then **Publish app** (to *In production*). While it
   stays in *Testing*, Google ends the connection every 7 days. Google shows an
   "unverified app" warning when you connect: that's expected for a private
   app; choose *Advanced → Go to Casa*.
4. **The OAuth client.** **APIs & Services → Credentials → Create
   credentials → OAuth client ID**, type **Web application**. Under
   *Authorised redirect URIs* add
   `https://casa-pi-weld.vercel.app/api/agenda/google/callback` (and
   `http://localhost:3000/api/agenda/google/callback` for local development:
   Google only accepts plain `http` for `localhost`, so connect from the
   computer's own browser at `http://localhost:3000`, not from a phone or a
   `.local` address).
   Copy the client ID and secret into `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`.
5. **The other secrets:**
   - `SUPABASE_SECRET_KEY`: Supabase → **Project Settings → API Keys** →
     a secret key (`sb_secret_...`; the legacy `service_role` key also works).
     The server uses it to sync while nobody is signed in. Never put it in a
     `NEXT_PUBLIC_` variable.
   - `AGENDA_TOKEN_KEY`: encrypts the stored Google sign-in. Generate one with
     `openssl rand -base64 32`.
   - `CRON_SECRET`: any long random string (e.g. `openssl rand -hex 32`).
     Vercel sends it with the daily job in [`vercel.json`](vercel.json) that
     keeps Google's change notifications switched on.
6. Add all five to Vercel's environment variables and redeploy.
7. In Casa: **Agenda → ⚙︎ → Connect Google Calendar**, sign in with the
   account that owns the Casa calendar, and pick "Casa" from the list. The
   first sync copies everything dated across, both ways.

Changes made in Agenda reach Google straight away. Changes made in Google come
back within seconds (Google notifies Casa's https address), and Agenda also
checks whenever it's opened. Running locally over plain http there are no
notifications, so changes from Google arrive when Agenda is opened.

## Development

```sh
npm run dev        # dev server with hot reload, also reachable on the LAN
npm run lan        # production build served on the LAN (port 3000)
npm test           # unit tests (scaling, formatting, search, link parsing, grocery views, agenda)
npm run lint
npm run typecheck
npm run icons      # regenerate app icons after changing a logo in logos/
```

Layout:

```
src/app/(casa)/        Casa home, sign-in, settings, bug reports (terracotta theme)
src/app/ricettario/    menu, recipe lists, add, view, edit, settings (trattoria red)
src/app/agenda/        calendar, tasks, add/edit, settings   (navy and amber)
src/app/groceries/     at home, shopping, settings, import   (green and kraft)
src/app/api/ricettario/parse/   server route that reads recipes with Claude
src/app/api/ricettario/label/   server route that suggests recipes' menu labels with Claude
src/app/api/groceries/sort/     server route that sorts a pasted list with Claude
src/app/api/agenda/parse/       server route that reads a quick-add line with Claude
src/app/api/agenda/sync/        server route the phones call to sync with Google Calendar
src/app/api/agenda/google/      connecting Google, picking the calendar, Google's notifications, the daily renewal
src/lib/recipes/       data model, scaling, formatting, search, database calls
src/lib/groceries/     data model, list views, database calls, live data hook
src/lib/agenda/        data model, time zones, recurrence, occurrences, views, assigning
src/lib/ai/            Claude prompts, link fetching and page extraction
src/lib/google/        Google Calendar API calls, token encryption, the sync itself
supabase/migrations/   database schema and security rules
logos/                 source logos; public/brand and public/icons are generated
```

## Bug reports

The small *Report a bug* button on the Casa home screen opens a screen where
either of you can type or dictate what went wrong. Reports are saved in the
`bug_reports` table (Supabase → **Table Editor**), with who sent it, when, and
the phone's browser. The phones can only add reports; review them in the
dashboard and set `status` to `fixed` or `wontfix` once dealt with.

## Known limitations of v0

- Photos uploaded for a recipe that's then abandoned are removed when you
  leave the page, but not if you close the app while still on it.
- If both of you edit the same recipe at once, the last save wins. The second
  person sees a warning first.
