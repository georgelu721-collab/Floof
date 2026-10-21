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

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- Tailwind CSS v4
- Pets are drawn as SVG illustrations in the logo's style, so the app needs no external image hosting. You can also upload real photos.
- There's no backend yet. App state (your pet, posts, biscuits, follows, clan) is saved in the browser's `localStorage`, so the demo works right after deploying.

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

- Add a real backend and auth (e.g. Postgres + Auth.js / Clerk) instead of `localStorage`
- Image uploads to object storage (e.g. Vercel Blob)
- Payments for biscuit top-ups and payouts through the Lyca Marketplace partner API
- Moderation and safety review for meetups
