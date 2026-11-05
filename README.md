# URUSS Q4 Campaign — Live Dashboard + Admin CMS

A complete Next.js / Supabase campaign dashboard designed using the supplied URUSS branding. The home page works on TV screens, desktop, tablets, and mobiles. Administrators use a password-protected CMS to publish daily reports and edit campaign settings. Public displays receive new figures through Supabase Realtime and animate number changes automatically.

## Features

**Public (`/`):** branded responsive TV dashboard; full-screen button; 60-day countdown in Malaysia time (days/hours/minutes/seconds); campaign goal and file count; latest recorded cumulative collection; today's disbursed file count; progress bar; real-time updates and animated counters; reconnect polling every 30 seconds; responsive cards and reduced-motion support.

**Admin (`/admin/login`, `/admin`):** Supabase email/password sign-in; database-managed admin role; overview; daily reporting for any date within the campaign (including correcting previous dates); campaign title/period/tagline/target/file-count/start/end editing; report history; audit log; password recovery; live publishing; logout. No public registration screen.

**Built-in design inputs from the sketch:** RM4,000,000 collection target, 200 files, and 22 disbursed files on 5 November 2026. The collection amount was **not provided**, so it remains **unreported** until an administrator enters an actual amount. The example campaign spans **5 November 2026 to 3 January 2027**, 60 calendar days inclusive; the end date is fully editable. These dates are design defaults, not a confirmed business deadline.

## Tech stack

- Next.js 15 App Router + TypeScript + React 19
- Supabase Database + Auth + Realtime + RLS (no service-role key in the browser)
- CSS motion and `requestAnimationFrame` counter animation
- GitHub (source control) + Vercel (hosting)
- All provided URUSS logo files included under `public/brand/`

## Setup (required for a LIVE backend)

### 1. Create a Supabase project

Open [Supabase](https://supabase.com/dashboard) and create a project. Go to **SQL Editor > New query**, paste the entire file `supabase/schema.sql`, and run it. This creates all tables, RLS policies, triggers, initial briefing values, and Realtime publication subscriptions. Do not skip the SQL script: it secures admin updates and enables live screen refreshes.

### 2. Create the administrator account

In **Authentication > Users**, use **Add user** to create an admin with an email and a strong password. Confirm the user exists, then run this in Supabase SQL Editor, replacing the email with the one you created:

```sql
insert into public.admin_users (user_id, email)
select id, email from auth.users where email = 'admin@yourcompany.com'
on conflict (user_id) do update set email = excluded.email;
```

Only users in `admin_users` can write campaign data. To give someone else admin access, first add them in Supabase Auth, then run the same query for their actual email. Do not enable public self-signups without adding your own separate review/approval system.

### 3. Set up local environment

Requires Node.js 20.9+ (Node 22 recommended).

```bash
npm install
cp .env.example .env.local
npm run dev
```

In `.env.local`, fill in your **real Supabase project URL** and **anon/publishable key** (Supabase > Project Settings > API / API Keys):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

Only the **public/publishable (anon) key** belongs here. **Never use or commit `service_role` / secret keys.** The database RLS policies enforce permissions even though the browser can call Supabase directly.

Run locally at <http://localhost:3000>. When Supabase environment variables are absent, `/` displays a **clearly marked briefing preview**, and admin sign-in is disabled. The application becomes live immediately when the correct environment variables and SQL schema are configured.

### 4. Set authentication redirect URLs

In Supabase **Authentication > URL Configuration**, set the production Site URL to your Vercel URL. Add these to the allow-list of Redirect URLs as appropriate:

- `http://localhost:3000/admin/reset-password`
- `https://YOUR_PROJECT.vercel.app/admin/reset-password`
- any production custom domain equivalent

The `Forgot your password?` link in the CMS sends a recovery email using this callback.

### 5. Deploy using GitHub + Vercel

```bash
git init
git add .
git commit -m "Build URUSS Q4 live campaign and secure CMS"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Create an empty GitHub repository first, replace its URL in the command, and **do not commit `.env.local`**. On [Vercel](https://vercel.com), import the GitHub project. In **Project Settings > Environment Variables**, configure both `NEXT_PUBLIC_SUPABASE_*` values for the deployed environment. Deploy, configure Supabase auth redirect URLs, and open `/admin/login` to start publishing.

## How daily reporting works

- **Target collection** — fixed campaign goal managed on the Settings page; prefilled from sketch at RM4,000,000.
- **Number of files** — current campaign file count managed on the Settings page; prefilled at 200.
- **Collection as of today** — enter the **cumulative** collection amount (RM) as of the selected reporting date. The public dashboard shows the latest recorded cumulative amount and labels its actual reporting date. No made-up figure appears on days without a collection report.
- **Disbursed files today** — enter the **number of files disbursed on the selected day only**. If a new day begins in Malaysia and no report has been entered yet, the public dashboard says **Not reported** instead of carrying yesterday's figure forward.
- **Countdown** — configured from campaign start and end dates. The timer stops at **11:59:59 PM Asia/Kuala_Lumpur time** on the end date. It updates every second on every public screen.
- **Audit** — admin updates generate database-side audit records, visible to admins only. Updating an existing reporting date preserves the unique per-day row; the audit log records the change.

After an admin clicks Publish, Supabase Realtime triggers the dashboard to fetch updated data, animate figures, briefly glow, and show an update notification. A 30-second refresh fallback keeps unattended TV displays current if Realtime disconnects. Fullscreen mode is user-triggered because browsers normally block automatic fullscreen requests.

## Security considerations

- **RLS** protects all editable rows. The public anon role has read-only access to campaign data.
- **Admin authorization** is checked against `admin_users` in Supabase, not trusted client-side UI state.
- **Audit** is captured with privileged PostgreSQL triggers. Browser users cannot directly create/edit audit entries.
- **No service-role key** is used anywhere in Next.js.
- HTTPS is handled by Vercel; do not collect sensitive customer or banking information in this dashboard.
- The homepage is intentionally public; anyone with its URL can see the campaign metrics. Use private-network access, Vercel authentication, or another access gate if these figures should be restricted to internal screens only.

## Project structure

```text
app/
  page.tsx                      Public dashboard
  admin/page.tsx                Protected admin CMS
  admin/login/page.tsx          Admin sign-in
  admin/reset-password/page.tsx Password recovery
  globals.css                   Responsive design and motion
components/
  campaign-dashboard.tsx        Live updates / TV view
  animated-number.tsx           Count-up animation
lib/
  supabase.ts, data.ts          Supabase client / queries
  date.ts, types.ts             Malaysia timezone / schemas
supabase/schema.sql             Database setup, RLS, audit, Realtime
public/brand/                   Actual uploaded URUSS logos
```

## Customization

Visual styles live in `app/globals.css`. URUSS brand colors are defined as CSS variables (`--green`, `--lime`, `--dark`). Replace the supplied logo files in `public/brand` only if the official logo changes. The CMS edits all requested business data without code changes.

**Testing checklist:** sign in as an admin; confirm an unauthorized Supabase user cannot edit data; save today's collection and disbursed counts; open the public page in a second window; confirm automatic number animation; edit a prior report; check audit log; use fullscreen on TV; verify `Not reported` behavior after midnight MYT.
