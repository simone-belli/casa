# Casa

Simone and Kat's household hub: one mobile web app with a section per area of
home life. Specs live in [`docs/`](docs):

- [`docs/CASA-SPEC.md`](docs/CASA-SPEC.md): the hub
- [`docs/RICETTARIO-SPEC.md`](docs/RICETTARIO-SPEC.md): the recipe section
- [`docs/AGENDA-SPEC.md`](docs/AGENDA-SPEC.md): the calendar and tasks section (specced, not built yet)
- [`docs/GROCERIES-SPEC.md`](docs/GROCERIES-SPEC.md): the shopping list section (specced, not built yet)

| Section | Status |
|---|---|
| **Ricettario** (recipes) | v0: add by typing/dictation, photo or link; scaling; editing; live sync |
| **Agenda** (calendar and tasks) | Specced; "coming soon" placeholder |
| **Groceries** (shopping list) | "Coming soon" placeholder |

v0 runs on a computer at home and is opened from the phones over Wi-Fi; it
isn't deployed anywhere yet.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind) · Supabase (Postgres with row
level security, Auth, Realtime, Storage) · Claude Sonnet 5.5 for reading
recipes, called only from the server.

## One-time setup

You need Node.js 22 or later on the computer that will run the app.

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**.
   This creates the tables, security rules, live updates and the private
   `recipe-photos` bucket.
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
8. **Authentication → URL Configuration**: set *Site URL* to the address the
   phones use (see step 3 below, e.g. `http://simones-macbook.local:3000`) and
   add the same address followed by `/**` to *Redirect URLs*.

### 2. Configuration

```sh
cp .env.example .env.local
```

Fill in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: from
  the project's **Connect** dialog (or Project Settings → API). The legacy
  `anon` key also works, as `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `ANTHROPIC_API_KEY`: your Claude API key. It stays on the computer; the
  phones never see it.

### 3. Run it and open it on the phones

```sh
npm install
npm run lan
```

`npm run lan` builds the app and serves it to the whole home network on port
3000. On the phones (same Wi-Fi), open `http://<computer-name>.local:3000`.
On a Mac, the computer name is in **System Settings → General → Sharing →
Local hostname**. The `.local` name stays the same when the router hands out a
new IP address. The `Network:` address printed in the terminal works too.

Then **Share → Add to Home Screen** in Safari to get the Casa icon.

Keep the computer awake while you're using the app. On a Mac, run
`caffeinate -s npm run lan` instead.

## Development

```sh
npm run dev        # dev server with hot reload, also reachable on the LAN
npm test           # unit tests (scaling, formatting, search, link parsing)
npm run lint
npm run typecheck
npm run icons      # regenerate app icons after changing a logo in logos/
```

Layout:

```
src/app/(casa)/        Casa home, sign-in, settings          (terracotta theme)
src/app/ricettario/    recipe list, add, view, edit          (trattoria red)
src/app/agenda/        coming-soon placeholder               (navy and amber)
src/app/groceries/     coming-soon placeholder               (green and kraft)
src/app/api/ricettario/parse/   server route that reads recipes with Claude
src/lib/recipes/       data model, scaling, formatting, search, database calls
src/lib/ai/            Claude prompt, link fetching and page extraction
supabase/migrations/   database schema and security rules
logos/                 source logos; public/brand and public/icons are generated
```

## Known limitations of v0

- Served over plain `http` on the home network, so there's no service worker
  (browsers only allow it over https). The home-screen app works, but needs
  the computer to be on. Deploying to Vercel later fixes both.
- Photos uploaded for a recipe that's then abandoned are removed when you
  leave the page, but not if you close the app while still on it.
- If both of you edit the same recipe at once, the last save wins. The second
  person sees a warning first.
