# Deploying World Streak

Deployment is a human step: the agents never run commands against Supabase cloud or Vercel production. Follow these sections in order. Everything here fits the free plans until the pre-launch items.

## 1. Create the Supabase cloud project

1. At supabase.com, create a project on the **free plan**. Pick a region close to most players and save the database password in your password manager.
2. From **Project Settings → API**, note the **Project URL**, the **anon (public) key** and the **service_role key**. The service role key is a secret: it goes only into Vercel's server-side settings (section 5), never into the browser or the repository.

## 2. Apply the migrations

From the repository root on your own machine:

1. `npx supabase login`
2. `npx supabase link --project-ref <project ref>` (the ref is in the project URL, `https://<project ref>.supabase.co`).
3. `npx supabase db push` applies everything in `supabase/migrations/`, including the row-level security policies.

Do **not** run `supabase/seed.sql` against the cloud project: it creates the local-only admin `admin@local.test`.

## 3. Check pg_cron and the close jobs

1. In **Database → Extensions**, confirm `pg_cron` is enabled (the migrations enable it; if the dashboard shows it off, switch it on and run `npx supabase db push` again).
2. In the SQL editor, run `select jobname, schedule, command from cron.job;` and confirm both jobs exist:
   - `close-due-game-days` at `0 0 * * *` (the daily close at midnight UTC)
   - `close-due-game-days-safety-net` at `*/5 * * * *` (catches a missed close)
3. The next morning, `select jobname, status, start_time from cron.job_run_details order by start_time desc limit 5;` should show successful runs.

## 4. Set up authentication

In **Authentication**:

1. **Sign In / Providers → Email:** turn **Confirm email off** (the game signs players in straight after sign-up, as it does locally).
2. **URL Configuration:** set the **Site URL** to the production address (for example `https://<your domain>`), and add these **Redirect URLs**:
   - `https://<your domain>/auth/callback`
   - `https://*-<your vercel team>.vercel.app/auth/callback` (preview deployments), if you want Google sign-in on previews
3. **Google provider:**
   1. In Google Cloud Console, create an OAuth client of type *Web application* (free).
   2. Add Supabase's callback, `https://<project ref>.supabase.co/auth/v1/callback`, as an authorised redirect URI.
   3. Paste the client ID and secret into **Providers → Google** in Supabase and enable it. (Locally these are `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, read by `supabase/config.toml`; in the cloud they live only in the dashboard.)

## 5. Create the Vercel project

1. At vercel.com, import the GitHub repository (Hobby plan is fine until ads, see section 8). The framework preset is Next.js; keep the default build command.
2. Under **Settings → Environment Variables**, add each of these for Production (and Preview if you use previews). Next.js builds `NEXT_PUBLIC_` values into the page, so set them before the first production build, and redeploy after any change.

| Variable | Value | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The Project URL from section 1 | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anon key from section 1 | No (public by design; RLS protects the data) |
| `SUPABASE_SERVICE_ROLE_KEY` | The service_role key from section 1 | **Yes**: server only, never prefixed `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | `https://<your domain>` (used in shared result cards) | No |
| `NEXT_PUBLIC_ADS_ENABLED` | `false` until section 8 | No |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | Empty until section 8 (`ca-pub-…`) | No |
| `NEXT_PUBLIC_ADS_PLACEHOLDER` | `false` (development only: grey boxes where ads go) | No |

These are the names in `.env.example` and the ones the app reads; a unit test (`tests/docs/deployment.test.ts`) fails if a new one is added without appearing here.

3. Deploy, then open `/api/health` on the deployment: it should answer that the database is reachable.

## 6. Make the owner an admin

1. Sign up on the deployed site with the owner's email, and complete the profile.
2. In the Supabase SQL editor, run (with the real email):

   ```sql
   update profiles set is_admin = true where id = (select id from auth.users where email = '<owner email>');
   ```

3. Sign out and in again, then open `/admin`: it should list today and the next 7 game days. Any other account gets a 404 there.

## 7. Deploying changes later

- Vercel deploys `main` on every merge. Database changes go out with `npx supabase db push` (section 2), **before** the code that needs them.
- **Engine changes** (a challenge's rules, target ranges or scoring): the server replays each attempt with the engine it runs when the attempt is submitted, so an attempt started on the old engine and submitted on the new one could be scored differently. Deploy them when no attempt is open, for example just after the daily close at midnight UTC.
- Check `/admin/settings` after a deploy if the change adds a setting.

## 8. Before public launch

- [ ] **Domain:** buy one, add it in Vercel (**Settings → Domains**), then update the Supabase Site URL and redirect URLs (section 4) and `NEXT_PUBLIC_SITE_URL` (section 5).
- [ ] **Custom email provider:** Supabase's built-in email is rate limited and for testing only. Set up an SMTP provider in **Authentication → SMTP Settings** before any feature sends players email.
- [ ] **Vercel Pro before ads:** the Hobby plan does not allow commercial use, so upgrade before switching ads on.
- [ ] **AdSense:** once approved, set `NEXT_PUBLIC_ADSENSE_CLIENT` to the `ca-pub-…` ID and `NEXT_PUBLIC_ADS_ENABLED=true`, then redeploy (T45).
- [ ] **Legal review of the official rules:** the `/rules` page is marked as a draft until a lawyer has reviewed the prize, eligibility and draw terms (see `docs/NEEDS_HUMAN.md`).
- [ ] Open items in `docs/NEEDS_HUMAN.md` marked "before launch" (accessibility pass, sign-up protection keys, location check).
