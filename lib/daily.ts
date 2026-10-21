import { COMPETITIONS } from "./data";
import type { Competition } from "./types";

/* ---------- Dates (local time) ---------- */

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function fromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const addDays = (key: string, n: number) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

export const daysBetween = (a: string, b: string) => Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);

/* ---------- Daily Floof prompts ---------- */

export const PROMPTS = [
  { text: "Show us their nap spot", emoji: "😴" },
  { text: "Toy of the day", emoji: "🧸" },
  { text: "Best side-eye", emoji: "👀" },
  { text: "Mid-zoomies blur", emoji: "💨" },
  { text: "Snack face", emoji: "🍗" },
  { text: "Where are they right now?", emoji: "📍" },
  { text: "The most dramatic sigh", emoji: "😮‍💨" },
  { text: "Show us the toe beans", emoji: "🐾" },
  { text: "Their favourite human", emoji: "🫶" },
  { text: "Caught being naughty", emoji: "😈" },
  { text: "Tongue out", emoji: "😛" },
  { text: "Window watching", emoji: "🪟" },
  { text: "Walk view", emoji: "🌳" },
  { text: "Bath time (or the aftermath)", emoji: "🛁" },
  { text: "The weirdest sleeping position", emoji: "🌀" },
  { text: "Best friend photo", emoji: "💛" },
  { text: "Waiting for dinner", emoji: "🍽️" },
  { text: "Head tilt", emoji: "🤔" },
  { text: "Cosiest blanket", emoji: "🛋️" },
  { text: "Morning face", emoji: "🌅" },
  { text: "In a box (or bag)", emoji: "📦" },
  { text: "Paws in the air", emoji: "🙌" },
  { text: "Guarding the house", emoji: "🛡️" },
  { text: "Outfit of the day", emoji: "🎀" },
  { text: "Fluff close-up", emoji: "☁️" },
  { text: "Puppy-dog eyes", emoji: "🥺" },
  { text: "Their throne (favourite chair)", emoji: "👑" },
  { text: "After a big adventure", emoji: "🏞️" },
];

export function promptFor(key: string) {
  // Based on the calendar date only, so phones and the server agree in any time zone.
  const [y, m, d] = key.split("-").map(Number);
  const n = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return PROMPTS[((n % PROMPTS.length) + PROMPTS.length) % PROMPTS.length];
}

/** Time until the next prompt (local midnight). */
export function untilTomorrow(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const ms = next.getTime() - now.getTime();
  return { h: Math.floor(ms / 3_600_000), m: Math.floor((ms % 3_600_000) / 60_000) };
}

/* ---------- Streaks ---------- */

/**
 * Posting streak in days. One missed day per 7 days is forgiven (a "free skip"),
 * so a busy day doesn't wipe a long streak.
 */
export function postingStreak(days: Set<string>, today = dayKey()) {
  const yesterday = addDays(today, -1);
  const postedToday = days.has(today);
  let cursor = postedToday ? today : yesterday;
  if (!days.has(cursor)) {
    // Allow a free skip yesterday if they posted the day before.
    if (!postedToday && days.has(addDays(today, -2))) cursor = addDays(today, -2);
    else return { streak: 0, postedToday, atRisk: false, best: bestStreak(days) };
  }
  let streak = 0;
  // If we already skipped yesterday, that's this week's free skip.
  let lastSkip = cursor === addDays(today, -2) ? -1 : -Infinity;
  let i = 0;
  for (let guard = 0; guard < 2000; guard++) {
    if (days.has(cursor)) streak++;
    else if (i - lastSkip >= 7 && days.has(addDays(cursor, -1))) lastSkip = i;
    else break;
    cursor = addDays(cursor, -1);
    i++;
  }
  return { streak, postedToday, atRisk: !postedToday && streak > 0, best: Math.max(streak, bestStreak(days)) };
}

function bestStreak(days: Set<string>) {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of sorted) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Consecutive days (ending today or yesterday) with at least one interaction. */
export function dailyStreak(days: Set<string>, today = dayKey()) {
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor) && n < 2000) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/* ---------- Levels ---------- */

const TIERS = [
  { from: 1, name: "Pup" },
  { from: 5, name: "Good Floof" },
  { from: 10, name: "Top Floof" },
  { from: 15, name: "Floof Star" },
  { from: 20, name: "Floof Legend" },
];

export function levelFor(score: number) {
  const level = Math.max(1, Math.floor(Math.sqrt(Math.max(0, score) / 25)));
  const floor = 25 * level * level;
  const next = 25 * (level + 1) * (level + 1);
  const tier = [...TIERS].reverse().find((t) => level >= t.from)!.name;
  return { level, tier, progress: Math.min(1, (score - floor) / (next - floor)), toNext: Math.max(0, next - score) };
}

/* ---------- Weekly + seasonal rhythm ---------- */

const CHALLENGES = [
  "Most Zoomies",
  "Best Costume",
  "Sleepiest Pose",
  "Messiest Eater",
  "Best Trick",
  "Cutest Duo",
  "Biggest Stretch",
  "Best Bed Head",
];

/** Clan War challenge rotates every week (weeks start Monday). */
export function weeklyChallenge(now = new Date()) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = Math.floor(monday.getTime() / (7 * 86_400_000));
  return CHALLENGES[((week % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
}

const SEASONS: Record<number, { title: string; blurb: string; scene: Competition["scene"]; accessory: Competition["accessory"]; heroPetId: string }> = {
  0: { title: "New Year, New Floof", blurb: "Show us your pet's resolution energy.", scene: "party", accessory: "party", heroPetId: "biscuit" },
  1: { title: "Valentine's Cuddle Cup", blurb: "The cuddliest, most loved-up floofs.", scene: "blossom", accessory: "bow", heroPetId: "nala" },
  2: { title: "Autumn Leaves", blurb: "Crunchy leaves and cosy vibes.", scene: "park", accessory: "bandana", heroPetId: "toby" },
  3: { title: "Easter Hunt", blurb: "Bunny ears, egg hunts and spring fun.", scene: "park", accessory: "flowers", heroPetId: "clover" },
  4: { title: "Cosiest Nap", blurb: "Winter's coming. Show us the snuggliest nap.", scene: "cozy", accessory: "none", heroPetId: "luna" },
  5: { title: "Winter Woollies", blurb: "Jumpers, coats and fluffy winter fits.", scene: "snow", accessory: "hat", heroPetId: "mochi" },
  6: { title: "Snow Day", blurb: "Snow, rain or indoor zoomies.", scene: "snow", accessory: "bandana", heroPetId: "bigmac" },
  7: { title: "Spring Zoomies", blurb: "First signs of spring and big zoomies.", scene: "blossom", accessory: "flowers", heroPetId: "biscuit" },
  8: { title: "Father's Day Floofs", blurb: "Your pet and their favourite dad.", scene: "park", accessory: "bandana", heroPetId: "toby" },
  9: { title: "Halloween Costume Contest", blurb: "Spooky, silly, or both. Best costume wins.", scene: "night", accessory: "hat", heroPetId: "pepper" },
  10: { title: "Beach Days", blurb: "Sand, surf and salty floofs.", scene: "beach", accessory: "sunglasses", heroPetId: "rex" },
  11: { title: "Festive Floofs", blurb: "Santa hats, wrapping paper chaos, tree guarding.", scene: "party", accessory: "party", heroPetId: "miso" },
};

/** This month's seasonal competition. */
export function seasonalCompetition(now = new Date()): Competition {
  const s = SEASONS[now.getMonth()];
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysLeft = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
  return {
    id: `season-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    title: s.title,
    blurb: `${s.blurb} A new seasonal contest starts every month.`,
    status: "active",
    endsInDays: daysLeft,
    prize: "Seasonal winner badge 🏅 + featured on Explore",
    sponsor: "Floof",
    scene: s.scene,
    accessory: s.accessory,
    heroPetId: s.heroPetId,
    entries: [],
  };
}

/** All competitions, including this month's seasonal one. */
export function allCompetitions(now = new Date()) {
  return [seasonalCompetition(now), ...COMPETITIONS];
}
