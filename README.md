# Casa

Simone and Kat's household hub: one mobile web app with a section per area of
home life. Specs live in [`docs/`](docs):

- [`docs/CASA-SPEC.md`](docs/CASA-SPEC.md): the hub
- [`docs/RICETTARIO-SPEC.md`](docs/RICETTARIO-SPEC.md): the recipe section
- [`docs/AGENDA-SPEC.md`](docs/AGENDA-SPEC.md): the calendar and tasks section (specced, not built yet)
- [`docs/GROCERIES-SPEC.md`](docs/GROCERIES-SPEC.md): the shopping list section

| Section | Status |
|---|---|
| **Ricettario** (recipes) | v0: add by typing/dictation, photo or link; scaling; editing; live sync |
| **Agenda** (calendar and tasks) | Specced; "coming soon" placeholder |
| **Groceries** (shopping list) | v1: home and shopping views, quick add, one-offs, supermarkets and aisles, paste import; live sync |

Casa is deployed on Vercel at `https://<your-app>.vercel.app` and works from
anywhere over HTTPS. It can also be run on a computer for development.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind) · Supabase (Postgres with row
level security, Auth, Realtime, Storage) · Claude Sonnet 5.5 for reading
recipes, called only from the server.

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
   [`0005_not_sold_here.sql`](supabase/migrations/0005_not_sold_here.sql).

   **Already set up?** Run, in order, whichever of these you haven't run yet.
   `0003` and `0005` are safe to run again; if Groceries says the home places
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
   address (`https://<your-app>.vercel.app`) and add the same address followed
   by `/**` to *Redirect URLs*. For local development, also add
   `http://localhost:3000/**`.

### 2. Configuration

The app reads these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: from
  the project's **Connect** dialog (or Project Settings → API). The legacy
  `anon` key also works, as `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `ANTHROPIC_API_KEY`: your Claude API key. It stays on the server; the
  phones never see it.

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

On the phones, open `https://<your-app>.vercel.app` in Safari, then
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

## Development

```sh
npm run dev        # dev server with hot reload, also reachable on the LAN
npm run lan        # production build served on the LAN (port 3000)
npm test           # unit tests (scaling, formatting, search, link parsing, grocery views)
npm run lint
npm run typecheck
npm run icons      # regenerate app icons after changing a logo in logos/
```

Layout:

```
src/app/(casa)/        Casa home, sign-in, settings          (terracotta theme)
src/app/ricettario/    recipe list, add, view, edit          (trattoria red)
src/app/agenda/        coming-soon placeholder               (navy and amber)
src/app/groceries/     at home, shopping, settings, import   (green and kraft)
src/app/api/ricettario/parse/   server route that reads recipes with Claude
src/app/api/groceries/sort/     server route that sorts a pasted list with Claude
src/lib/recipes/       data model, scaling, formatting, search, database calls
src/lib/groceries/     data model, list views, database calls, live data hook
src/lib/ai/            Claude prompt, link fetching and page extraction
supabase/migrations/   database schema and security rules
logos/                 source logos; public/brand and public/icons are generated
```

## Known limitations of v0

- Photos uploaded for a recipe that's then abandoned are removed when you
  leave the page, but not if you close the app while still on it.
- If both of you edit the same recipe at once, the last save wins. The second
  person sees a warning first.
