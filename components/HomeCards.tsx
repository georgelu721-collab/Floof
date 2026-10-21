"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dayKey, daysBetween, fromKey, promptFor, untilTomorrow } from "@/lib/daily";
import { useStore } from "@/lib/store";
import type { Post } from "@/lib/types";
import { PostMedia } from "./PetArt";
import { IconChevron, IconX } from "./Icons";

/* ---------- First-week checklist ---------- */

const DISMISS_KEY = "floof:checklist-dismissed";

export function StarterChecklist() {
  const { me, s, posts, signedIn } = useStore();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(DISMISS_KEY) === me.id);
    } catch {
      setHidden(false);
    }
  }, [me.id]);
  if (!signedIn || hidden) return null;

  const mine = posts.filter((p) => p.petId === me.id && p.createdAt);
  const items = [
    { done: !!me.photo, label: "Add a profile photo", href: "/settings/profile" },
    { done: Object.keys(s.following).length >= 3, label: "Follow 3 pets", href: "/explore" },
    { done: mine.length > 0, label: "Post your first floof", href: "/create?moment=first-floof" },
    { done: mine.some((p) => p.dailyDate), label: "Answer a Daily Floof", href: "/daily" },
    { done: Object.keys(s.packs).length > 0, label: "Join a Pack", href: "/meetups" },
    { done: s.ledger.some((l) => l.type === "sent"), label: "Send a biscuit 🍪", href: "/explore" },
    { done: !!(me.birthday || me.gotchaDay), label: "Add a birthday or Gotcha Day", href: "/settings/profile" },
  ];
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;

  return (
    <section className="card mx-4 mb-3 p-4">
      <div className="flex items-center gap-2">
        <p className="flex-1 font-display text-lg font-semibold">Get started on Floof</p>
        <span className="text-sm font-bold text-muted">
          {done}/{items.length}
        </span>
        <button
          aria-label="Hide checklist"
          className="rounded-full p-1 text-muted hover:bg-sand"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, me.id);
            } catch {
              /* ignore */
            }
            setHidden(true);
          }}
        >
          <IconX size={16} />
        </button>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand">
        <div className="h-full rounded-full bg-gradient-to-r from-peach to-blush" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul className="mt-3 space-y-1">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.href} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm font-bold ${i.done ? "text-muted line-through" : "hover:bg-sand"}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${i.done ? "bg-sage text-white" : "border-2 border-oat"}`}>
                {i.done ? "✓" : ""}
              </span>
              <span className="flex-1">{i.label}</span>
              {!i.done && <IconChevron size={16} className="text-muted" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Daily Floof ---------- */

export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function DailyCard() {
  const { streak, posts, me, dailyAnswers, signedIn } = useStore();
  const now = useNow();
  if (!now) return null;
  const today = dayKey(now);
  const prompt = promptFor(today);
  const answered = posts.some((p) => p.petId === me.id && p.dailyDate === today);
  const answers = dailyAnswers(today).length;
  const left = untilTomorrow(now);

  return (
    <section className="card mx-4 mb-3 overflow-hidden bg-gradient-to-br from-[#FFE9D2] to-[#FDE4E8] p-4">
      <div className="flex items-start gap-3">
        <span className="text-4xl">{prompt.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-soft">Daily Floof · today</p>
          <p className="font-display text-xl font-semibold leading-tight">{prompt.text}</p>
          <p className="mt-1 text-xs font-bold text-cocoa-soft">
            {answers} answer{answers === 1 ? "" : "s"} so far · new prompt in {left.h}h {left.m}m
          </p>
        </div>
        {signedIn && streak.streak > 0 && (
          <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-sm font-extrabold" title="Posting streak">
            🔥 {streak.streak}
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {answered ? (
          <span className="btn btn-soft !bg-paper/80 !py-2.5 text-sm">✓ Answered</span>
        ) : (
          <Link href={`/create?daily=${today}`} className="btn btn-dark !py-2.5 text-sm">
            Answer in 10s
          </Link>
        )}
        <Link href="/daily" className="btn btn-soft !bg-paper/80 !py-2.5 text-sm">
          See answers & vote
        </Link>
      </div>
    </section>
  );
}

/* ---------- Small nudges ---------- */

type Nudge = { key: string; emoji: string; title: string; sub: string; href: string; tint: string; thumb?: Post };

function memoryFor(posts: Post[], meId: string, today: string): { post: Post; label: string } | null {
  const t = fromKey(today);
  const mine = posts.filter((p) => p.petId === meId && p.createdAt).sort((a, b) => a.createdAt - b.createdAt);
  for (const p of mine) {
    const d = new Date(p.createdAt);
    if (d.getMonth() === t.getMonth() && d.getDate() === t.getDate() && d.getFullYear() < t.getFullYear()) {
      const n = t.getFullYear() - d.getFullYear();
      return { post: p, label: `${n} year${n > 1 ? "s" : ""} ago today` };
    }
  }
  for (const p of mine) {
    const d = new Date(p.createdAt);
    const months = (t.getFullYear() - d.getFullYear()) * 12 + t.getMonth() - d.getMonth();
    if (d.getDate() === t.getDate() && months >= 1) return { post: p, label: `${months} month${months > 1 ? "s" : ""} ago today` };
  }
  return null;
}

export function useNudges(): Nudge[] {
  const { me, streak, bestFriends, interactedToday, alerts, s, posts, signedIn } = useStore();
  const now = useNow();
  if (!now || !signedIn) return [];
  const today = dayKey(now);
  const out: Nudge[] = [];

  if (streak.atRisk && streak.streak >= 2) {
    out.push({
      key: "streak",
      emoji: "🔥",
      title: `Your ${streak.streak}-day streak ends tonight`,
      sub: `Answer today's prompt: ${promptFor(today).text}`,
      href: `/create?daily=${today}`,
      tint: "#FFE6CC",
    });
  }

  const bf = bestFriends(me.id).find((f) => f.streak >= 2 && !interactedToday(f.pet.id));
  if (bf) {
    out.push({
      key: "friend",
      emoji: "💛",
      title: `${bf.streak}-day streak with ${bf.pet.name}`,
      sub: "Boop, comment or say hi today to keep it going",
      href: `/messages/${bf.pet.id}`,
      tint: "#FFF1C9",
    });
  }

  const nearby = alerts.find(
    (a) => a.status === "active" && a.reporterId !== me.id && (!me.city || !a.city || a.city.toLowerCase() === me.city.toLowerCase()),
  );
  if (nearby) {
    out.push({
      key: "lost",
      emoji: nearby.kind === "lost" ? "🚨" : "🏠",
      title: nearby.kind === "lost" ? `Lost pet nearby: ${nearby.name}` : `Found pet nearby: ${nearby.name}`,
      sub: `${nearby.suburb || nearby.city} · can you help?`,
      href: `/lost/${nearby.id}`,
      tint: "#FDE4E8",
    });
  }

  const due = s.reminders.find((r) => daysBetween(today, r.due) <= 3);
  if (due) {
    const d = daysBetween(today, due.due);
    out.push({
      key: "care",
      emoji: "🩺",
      title: due.title,
      sub: d < 0 ? `Overdue by ${-d} day${d === -1 ? "" : "s"}` : d === 0 ? "Due today" : `Due in ${d} day${d === 1 ? "" : "s"}`,
      href: "/care",
      tint: "#D3E9F7",
    });
  }

  for (const [label, date] of [
    ["birthday", me.birthday],
    ["Gotcha Day", me.gotchaDay],
  ] as const) {
    if (!date) continue;
    const [, m, d] = date.split("-").map(Number);
    const t = fromKey(today);
    let next = new Date(t.getFullYear(), m - 1, d);
    if (dayKey(next) < today) next = new Date(t.getFullYear() + 1, m - 1, d);
    const inDays = daysBetween(today, dayKey(next));
    if (inDays <= 7) {
      out.push({
        key: label,
        emoji: label === "birthday" ? "🎂" : "🏡",
        title: inDays === 0 ? `Happy ${label}, ${me.name}! 🎉` : `${me.name}'s ${label} is in ${inDays} day${inDays === 1 ? "" : "s"}`,
        sub: "Post a floof to celebrate",
        href: `/create?moment=${label === "birthday" ? "first-birthday" : "gotcha-day"}`,
        tint: "#F9D3DA",
      });
    }
  }

  const memory = memoryFor(posts, me.id, today);
  if (memory) {
    out.push({ key: "memory", emoji: "📸", title: "On this day", sub: memory.label, href: `/post/${memory.post.id}`, tint: "#E7E3F7", thumb: memory.post });
  }

  const day = now.getDay();
  if (day === 0 || day === 1) {
    out.push({ key: "recap", emoji: "📊", title: "Your weekly recap is ready", sub: "Boops, biscuits and new friends this week", href: "/recap", tint: "#E2F0DA" });
  }

  return out;
}

export function Nudges({ max = 2 }: { max?: number }) {
  const nudges = useNudges().slice(0, max);
  const { pet } = useStore();
  if (!nudges.length) return null;
  return (
    <div className="mb-3 space-y-2 px-4">
      {nudges.map((n) => (
        <Link key={n.key} href={n.href} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: n.tint }}>
          {n.thumb ? (
            <PostMedia post={n.thumb} pet={pet(n.thumb.petId)!} className="h-11 w-11 shrink-0 rounded-xl" />
          ) : (
            <span className="text-2xl">{n.emoji}</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold">{n.title}</span>
            <span className="block truncate text-xs font-semibold text-cocoa-soft">{n.sub}</span>
          </span>
          <IconChevron size={18} className="shrink-0 text-cocoa-soft" />
        </Link>
      ))}
    </div>
  );
}
