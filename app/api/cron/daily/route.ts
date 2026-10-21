// Daily notifications, run by Vercel Cron (see vercel.json) once a day, early evening in Sydney.
// Sends each subscribed pet: today's Daily Floof prompt (or a "streak ends tonight" nudge),
// care reminders due today/tomorrow, birthday wishes, and a weekly recap on Sundays.
//
// Needs in Vercel: SUPABASE_SECRET_KEY, VAPID_PRIVATE_KEY, and CRON_SECRET (Vercel sends it automatically).

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { addDays, postingStreak, promptFor } from "@/lib/daily";
import { VAPID_PUBLIC_KEY } from "@/lib/push-key";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ttnqpjmjlbyxzfqgwhgi.supabase.co";
const TZ = process.env.FLOOF_TIMEZONE ?? "Australia/Sydney";

/** YYYY-MM-DD in the app's time zone. */
const tzDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

type Note = { title: string; body: string; url: string; tag: string };

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const secret = process.env.SUPABASE_SECRET_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !vapidPrivate) return Response.json({ status: "unconfigured" }, { status: 503 });

  webpush.setVapidDetails("mailto:hello@floof.app", VAPID_PUBLIC_KEY, vapidPrivate);
  const db = createClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: subs, error } = await db.from("push_subscriptions").select("id, pet_id, endpoint, p256dh, auth").not("pet_id", "is", null).limit(5000);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!subs?.length) return Response.json({ sent: 0 });

  const now = new Date();
  const today = tzDay(now);
  const tomorrow = addDays(today, 1);
  const isSunday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(now) === "Sun";
  const prompt = promptFor(today);
  const petIds = [...new Set(subs.map((s) => s.pet_id as string))];
  const since60 = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const since7 = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [{ data: pets }, { data: posts }, { data: reminders }] = await Promise.all([
    db.from("pets").select("id, name, birthday, gotcha_day").in("id", petIds),
    db.from("posts").select("pet_id, created_at").in("pet_id", petIds).gte("created_at", since60).limit(20000),
    db.from("reminders").select("pet_id, title, due_date").in("pet_id", petIds).lte("due_date", tomorrow).limit(5000),
  ]);

  const notesFor = async (petId: string): Promise<Note[]> => {
    const pet = pets?.find((p) => p.id === petId);
    if (!pet) return [];
    const notes: Note[] = [];
    const days = new Set((posts ?? []).filter((p) => p.pet_id === petId).map((p) => tzDay(new Date(p.created_at))));
    const streak = postingStreak(days, today);
    if (streak.atRisk && streak.streak >= 2) {
      notes.push({ title: `🔥 Your ${streak.streak}-day streak ends tonight!`, body: `Today's Daily Floof: ${prompt.text} ${prompt.emoji}`, url: `/create?daily=${today}`, tag: "daily" });
    } else if (!streak.postedToday) {
      notes.push({ title: `${prompt.emoji} Today's Daily Floof`, body: `${prompt.text}. Answer in 10 seconds 🐾`, url: `/create?daily=${today}`, tag: "daily" });
    }
    for (const r of (reminders ?? []).filter((r) => r.pet_id === petId)) {
      const when = r.due_date < today ? "is overdue" : r.due_date === today ? "is due today" : "is due tomorrow";
      notes.push({ title: `🩺 ${r.title} ${when}`, body: `For ${pet.name}. Tap to mark it done.`, url: "/care", tag: `care-${r.title}` });
    }
    for (const [date, label, emoji] of [
      [pet.birthday, "birthday", "🎂"],
      [pet.gotcha_day, "Gotcha Day", "🏡"],
    ] as const) {
      if (date && date.slice(5) === today.slice(5)) {
        notes.push({ title: `${emoji} Happy ${label}, ${pet.name}!`, body: "Post a floof to celebrate 🎉", url: "/create", tag: label });
      }
    }
    if (isSunday) {
      const [{ count: boops }, { data: biscuits }] = await Promise.all([
        db.from("boops").select("post_id, posts!inner(pet_id)", { count: "exact", head: true }).eq("posts.pet_id", petId).gte("created_at", since7),
        db.from("biscuit_ledger").select("amount").eq("pet_id", petId).eq("kind", "received").gte("created_at", since7),
      ]);
      const got = (biscuits ?? []).reduce((a, b) => a + b.amount, 0);
      notes.push({ title: `📊 ${pet.name}'s week on Floof`, body: `${boops ?? 0} boops and ${got} biscuits this week. See your recap!`, url: "/recap", tag: "recap" });
    }
    return notes.slice(0, 3);
  };

  let sent = 0;
  let removed = 0;
  const cache = new Map<string, Note[]>();
  for (const sub of subs) {
    const petId = sub.pet_id as string;
    if (!cache.has(petId)) cache.set(petId, await notesFor(petId));
    for (const note of cache.get(petId)!) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(note), { TTL: 6 * 3600 });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
          break;
        }
        console.error("push failed", status, (err as Error).message);
      }
    }
  }
  return Response.json({ sent, removed, subscriptions: subs.length });
}
