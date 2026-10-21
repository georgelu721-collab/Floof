# Floof 🐾

**Pets make a kinder world.** Floof is an Instagram-style social network for pets.

## Features

- **Feed & stories**: post "floofs", boop (like), comment, save and share. Double-tap a photo to boop.
- **First Pet Moments**: mark a post as a milestone (first haircut, first pet expo, first vet visit, first beach day, gotcha day…) and track them on a timeline.
- **Biscuits** 🍪: send biscuits to other pets. 1 biscuit = 10c. Includes a wallet with top-ups, history, and spending or donating what your pet receives.
- **Lyca Marketplace**: a partner marketplace page for supplies, services and adoption, where pets can spend their biscuits. Uses sample data for now.
- **Best Friends**: a Snapchat-style friendship score. Your pet's #1 best friend (e.g. *Big Mac's Best Friend*), streaks 🔥, friend emojis and a **PawScore** social score.
- **Clan Wars** ⚔️: a weekly friendly Cats vs Dogs challenge with a live countdown, team scores and a leaderboard. Each floof you post adds points to your team.
- **Competitions**: sponsored contests (e.g. Cutest Smile) where you enter a post and vote.
- **Meetups (opt-in)**: events and meetups in public places that you RSVP to. Check in to unlock moments. Pet "Packs" (groups) are here too.
- Explore and search, notifications, direct messages, a profile with badges, and sign-up with a custom illustrated avatar or uploaded photo.

## Tech

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript, Tailwind CSS v4
- [Supabase](https://supabase.com) backend: Postgres database, email logins, photo storage and live messages
- Starter pets use real photos from [Unsplash](https://unsplash.com) (free under the Unsplash License), stored in `public/photos`. Drawn SVG versions are used as a fallback, and users can upload their own photos

## Backend setup (one time)

1. **Create the database.** In Supabase, open **SQL Editor → New query**, paste all of [`supabase/setup.sql`](supabase/setup.sql) and click **Run**. This creates the tables, security rules, biscuit functions, photo bucket and starter content. It's safe to run again.
2. **Set the login redirect URL.** In **Authentication → URL Configuration**, set **Site URL** to your Vercel address (e.g. `https://floof.vercel.app`) and add `https://*.vercel.app/**` and `http://localhost:3000/**` under **Redirect URLs**. Without this, the email confirmation links point to `localhost`.
3. *(Optional, for testing)* In **Authentication → Sign In / Providers → Email**, turn off **Confirm email** so new accounts work immediately. Supabase's built-in email sender only allows a few emails per hour; add your own SMTP under **Authentication → Emails** before launch.

The app's Supabase URL and **publishable** key are set in `lib/supabase.ts` (they are public by design). To use a different project, set these in Vercel → Settings → Environment Variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |

Never put the `sb_secret_…` key in the app or in GitHub: it bypasses all security rules. The app doesn't need it.

To run the old browser-only demo with no backend, set `NEXT_PUBLIC_FLOOF_LOCAL=1`.

### Pet-only photo check

New posts with photos are checked by Claude (`app/api/moderate/route.ts`) before anyone else can see them: every photo must show a pet or other animal (people are fine alongside a pet). Until approved, a post is visible only to its owner; rejected posts show the reason and can be deleted. Drawn posts skip the check. The database enforces this, so it can't be bypassed from the browser.

Add these in **Vercel → Settings → Environment Variables** (server-only, never sent to the browser), then redeploy:

| Variable | Where to get it |
| --- | --- |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → secret key (`sb_secret_…`) |

Without them, photo posts stay "checking" (visible only to their owner) and are checked automatically once the keys are added.

### Daily habits & notifications

- **Daily Floof** (`/daily`): one prompt a day, posting streaks (one free skip per week), voting, yesterday's winner.
- **Pet care** (`/care`): reminders (vaccinations, flea/worming, vet), birthday & Gotcha Day, weight log, "On this day" memories.
- **Lost & Found** (`/lost`): public alerts for lost/found pets, "I've seen them" messages the reporter.
- **Weekly recap** (`/recap`), best-friend streak nudges, PawScore levels and badges, weekly Clan War challenges, monthly seasonal contests, a starter checklist and a 4-step sign-up.
- **Push notifications**: `app/api/cron/daily` runs once a day (see `vercel.json`, 07:00 UTC ≈ 6pm Sydney) and sends the daily prompt or a streak warning, care reminders due today/tomorrow, birthday wishes, and a Sunday recap. Users turn them on in **Edit profile → Notifications**. On iPhone they must first add Floof to the Home Screen.

Extra Vercel environment variables for notifications:

| Variable | Value |
| --- | --- |
| `VAPID_PRIVATE_KEY` | The private push key (the public half is in `lib/push-key.ts`). Generate a new pair with `npx web-push generate-vapid-keys` if you ever need to, and update both. |
| `CRON_SECRET` | Any long random string. Vercel sends it to the cron job automatically, so nobody else can trigger it. |

### How the data is protected

Every table has row level security: anyone can read public things (pets, posts, boops, comments), but you can only create or change rows for **your own pet**. Saves, messages and the biscuit ledger are private. Biscuits can only move through database functions (`send_biscuits`, `topup_biscuits`, `redeem_biscuits`) that check ownership and balance, so a wallet can't be faked or overspent.

Top-ups are **demo only**: `topup_biscuits` adds biscuits without payment. Replace it with a Stripe webhook before biscuits are worth real money.

### Changing starter content

House pets and sample posts live in `lib/data.ts`. After editing, run `npm run db:seed` to regenerate `supabase/seed.sql` and `supabase/setup.sql`, then run the new seed in the SQL Editor.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repo.
2. Vercel detects Next.js automatically. Keep the defaults and click **Deploy**.

No environment variables are needed.

## Next steps for production

- Payments for biscuit top-ups (Stripe) and payouts through the Lyca Marketplace partner API
- Google / Apple sign-in (Supabase → Authentication → Providers)
- Moderation tools (report a post, block a pet) and a safety review for meetups
- Events, competitions and packs are defined in `lib/data.ts`; move them into tables when you want to manage them without code changes
