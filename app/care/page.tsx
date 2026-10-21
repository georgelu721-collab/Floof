"use client";

import Link from "next/link";
import { useState } from "react";
import { dayKey, daysBetween, fromKey } from "@/lib/daily";
import { newId, useStore } from "@/lib/store";
import type { Post, Reminder } from "@/lib/types";
import { PostMedia } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";
import { IconCheck, IconX } from "@/components/Icons";

const KINDS: { kind: Reminder["kind"]; label: string; emoji: string; repeat: Reminder["repeat"] }[] = [
  { kind: "flea", label: "Flea & tick", emoji: "🪲", repeat: "monthly" },
  { kind: "worming", label: "Worming", emoji: "💊", repeat: "quarterly" },
  { kind: "vaccination", label: "Vaccination", emoji: "💉", repeat: "yearly" },
  { kind: "vet", label: "Vet check-up", emoji: "🩺", repeat: "yearly" },
  { kind: "grooming", label: "Grooming", emoji: "✂️", repeat: "monthly" },
  { kind: "medication", label: "Medication", emoji: "💊", repeat: "none" },
  { kind: "other", label: "Other", emoji: "📌", repeat: "none" },
];
const emojiFor = (k: Reminder["kind"]) => KINDS.find((x) => x.kind === k)?.emoji ?? "📌";
const REPEAT_LABEL: Record<Reminder["repeat"], string> = { none: "Once", monthly: "Monthly", quarterly: "Every 3 months", yearly: "Yearly" };

function dueLabel(today: string, due: string) {
  const d = daysBetween(today, due);
  if (d < 0) return { text: `Overdue by ${-d} day${d === -1 ? "" : "s"}`, urgent: true };
  if (d === 0) return { text: "Due today", urgent: true };
  if (d === 1) return { text: "Due tomorrow", urgent: true };
  if (d <= 7) return { text: `In ${d} days`, urgent: false };
  return { text: fromKey(due).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }), urgent: false };
}

function nextAnniversary(today: string, date: string) {
  const [, m, d] = date.split("-").map(Number);
  const t = fromKey(today);
  let next = new Date(t.getFullYear(), m - 1, d);
  if (dayKey(next) < today) next = new Date(t.getFullYear() + 1, m - 1, d);
  return { key: dayKey(next), age: next.getFullYear() - Number(date.slice(0, 4)) };
}

export default function Care() {
  const { me, s, dispatch, posts, signedIn, toast } = useStore();
  const today = dayKey();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<Reminder["kind"]>("flea");
  const [title, setTitle] = useState("Flea & tick treatment");
  const [due, setDue] = useState(today);
  const [repeat, setRepeat] = useState<Reminder["repeat"]>("monthly");
  const [kg, setKg] = useState("");
  const [kgDate, setKgDate] = useState(today);

  if (!signedIn) {
    return (
      <Page>
        <TopBar title="Pet care" />
        <p className="px-8 py-16 text-center font-semibold text-muted">
          <Link href="/login" className="text-blush">
            Log in
          </Link>{" "}
          to keep track of your pet&apos;s care.
        </p>
      </Page>
    );
  }

  const anniversaries = [
    me.birthday && { id: "birthday", emoji: "🎂", title: `${me.name}'s birthday`, ...nextAnniversary(today, me.birthday) },
    me.gotchaDay && { id: "gotcha", emoji: "🏡", title: "Gotcha Day", ...nextAnniversary(today, me.gotchaDay) },
  ].filter(Boolean) as { id: string; emoji: string; title: string; key: string; age: number }[];

  const memories = posts
    .filter((p) => p.petId === me.id && p.createdAt)
    .filter((p) => {
      const d = new Date(p.createdAt);
      const t = fromKey(today);
      return d.getDate() === t.getDate() && (d.getMonth() !== t.getMonth() || d.getFullYear() !== t.getFullYear());
    });
  const moments = posts.filter((p) => p.petId === me.id && p.moment).slice(0, 6);

  const addReminder = () => {
    if (!title.trim()) return;
    void dispatch({ t: "addReminder", reminder: { id: crypto.randomUUID?.() ?? newId(), title: title.trim(), kind, due, repeat } });
    toast("Reminder added 🩺");
    setAdding(false);
  };

  const addWeight = () => {
    const n = Number(kg.replace(",", "."));
    if (!n || n <= 0 || n >= 200) return toast("Enter a weight in kg");
    void dispatch({ t: "addWeight", weight: { id: crypto.randomUUID?.() ?? newId(), date: kgDate, kg: Math.round(n * 100) / 100 } });
    setKg("");
  };

  return (
    <Page>
      <TopBar title="Pet care" sub={`Reminders, growth and memories for ${me.name}`} />

      <SectionTitle
        action={
          <button className="text-sm font-extrabold text-blush" onClick={() => setAdding((x) => !x)}>
            {adding ? "Cancel" : "+ Add"}
          </button>
        }
      >
        Coming up
      </SectionTitle>

      {adding && (
        <section className="card mx-4 mb-3 space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                className="chip"
                data-on={kind === k.kind}
                onClick={() => {
                  setKind(k.kind);
                  setRepeat(k.repeat);
                  setTitle(k.kind === "other" ? "" : k.kind === "flea" ? "Flea & tick treatment" : k.label);
                }}
              >
                {k.emoji} {k.label}
              </button>
            ))}
          </div>
          <input className="input" placeholder="What's it for?" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
            <select className="input" value={repeat} onChange={(e) => setRepeat(e.target.value as Reminder["repeat"])} aria-label="Repeat">
              {(Object.keys(REPEAT_LABEL) as Reminder["repeat"][]).map((r) => (
                <option key={r} value={r}>
                  {REPEAT_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-dark w-full" onClick={addReminder} disabled={!title.trim()}>
            Save reminder
          </button>
        </section>
      )}

      <ul className="space-y-2 px-4">
        {anniversaries.map((a) => {
          const d = daysBetween(today, a.key);
          return (
            <li key={a.id} className="card flex items-center gap-3 px-4 py-3">
              <span className="text-2xl">{a.emoji}</span>
              <div className="flex-1">
                <p className="font-extrabold">{a.title}</p>
                <p className="text-xs font-semibold text-muted">
                  {d === 0 ? "Today! 🎉" : `In ${d} day${d === 1 ? "" : "s"}`} · turning {a.age}
                </p>
              </div>
            </li>
          );
        })}
        {s.reminders.map((r) => {
          const label = dueLabel(today, r.due);
          return (
            <li key={r.id} className="card flex items-center gap-3 px-4 py-3">
              <span className="text-2xl">{emojiFor(r.kind)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{r.title}</p>
                <p className={`text-xs font-semibold ${label.urgent ? "text-blush" : "text-muted"}`}>
                  {label.text} · {REPEAT_LABEL[r.repeat]}
                </p>
              </div>
              <button
                onClick={() => {
                  void dispatch({ t: "completeReminder", id: r.id });
                  toast(r.repeat === "none" ? "Done ✓" : "Done ✓ Next one scheduled");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E2F0DA] text-[#4F7A3E]"
                aria-label={`Mark ${r.title} done`}
              >
                <IconCheck size={18} />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete “${r.title}”?`)) void dispatch({ t: "deleteReminder", id: r.id });
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-sand text-muted"
                aria-label={`Delete ${r.title}`}
              >
                <IconX size={16} />
              </button>
            </li>
          );
        })}
        {anniversaries.length === 0 && (
          <li>
            <Link href="/settings/profile" className="card flex items-center gap-3 px-4 py-3">
              <span className="text-2xl">🎂</span>
              <span className="flex-1 text-sm font-bold">Add {me.name}&apos;s birthday or Gotcha Day</span>
              <span className="text-sm font-extrabold text-blush">Add</span>
            </Link>
          </li>
        )}
        {s.reminders.length === 0 && !adding && (
          <li className="px-4 py-2 text-center text-sm font-semibold text-muted">
            No reminders yet. Add flea treatments, vaccinations or vet visits so you never miss one.
          </li>
        )}
      </ul>

      <SectionTitle>Weight & growth</SectionTitle>
      <section className="card mx-4 p-4">
        <WeightChart />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input className="input" inputMode="decimal" placeholder="Weight (kg)" value={kg} onChange={(e) => setKg(e.target.value)} />
          <input className="input" type="date" value={kgDate} onChange={(e) => setKgDate(e.target.value)} aria-label="Date weighed" />
          <button className="btn btn-dark col-span-2 !py-2.5" onClick={addWeight}>
            Log weight
          </button>
        </div>
        {s.weights.length > 0 && (
          <ul className="mt-3 divide-y divide-oat text-sm">
            {[...s.weights].reverse().slice(0, 5).map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2">
                <span className="font-semibold text-muted">{fromKey(w.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                <span className="flex items-center gap-2 font-extrabold">
                  {w.kg} kg
                  <button onClick={() => void dispatch({ t: "deleteWeight", id: w.id })} className="text-muted" aria-label="Delete weight">
                    <IconX size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SectionTitle>Memories</SectionTitle>
      {memories.length > 0 ? (
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4">
          {memories.map((p) => (
            <MemoryTile key={p.id} post={p} today={today} />
          ))}
        </div>
      ) : (
        <p className="px-6 text-sm font-semibold text-muted">“On this day” memories will show up here as {me.name}&apos;s floofs build up. 📸</p>
      )}
      {moments.length > 0 && (
        <Link href="/moments" className="card mx-4 mt-3 flex items-center gap-3 px-4 py-3">
          <span className="text-2xl">✨</span>
          <span className="flex-1 font-bold">First Pet Moments timeline</span>
          <span className="text-sm font-bold text-muted">{moments.length}</span>
        </Link>
      )}
    </Page>
  );
}

function MemoryTile({ post, today }: { post: Post; today: string }) {
  const { pet } = useStore();
  const d = new Date(post.createdAt);
  const t = fromKey(today);
  const months = (t.getFullYear() - d.getFullYear()) * 12 + t.getMonth() - d.getMonth();
  const label = months % 12 === 0 ? `${months / 12} year${months > 12 ? "s" : ""} ago` : `${months} month${months > 1 ? "s" : ""} ago`;
  return (
    <Link href={`/post/${post.id}`} className="w-36 shrink-0">
      <PostMedia post={post} pet={pet(post.petId)!} className="aspect-square rounded-2xl" />
      <p className="mt-1 text-xs font-extrabold">{label}</p>
    </Link>
  );
}

function WeightChart() {
  const { s } = useStore();
  const pts = s.weights;
  if (pts.length === 0) return <p className="text-sm font-semibold text-muted">Log weights to see a growth chart.</p>;
  const W = 320;
  const H = 110;
  const min = Math.min(...pts.map((p) => p.kg));
  const max = Math.max(...pts.map((p) => p.kg));
  const pad = Math.max(0.5, (max - min) * 0.2);
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (pts.length === 1 ? W / 2 : 12 + (i / (pts.length - 1)) * (W - 24));
  const y = (kg: number) => H - 14 - ((kg - lo) / (hi - lo)) * (H - 28);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const change = pts.length > 1 ? last.kg - pts[0].kg : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-2xl font-semibold">{last.kg} kg</p>
        {pts.length > 1 && (
          <p className="text-xs font-bold text-muted">
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)} kg since first entry
          </p>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Weight over time">
        <path d={`${path} L${x(pts.length - 1)} ${H} L${x(0)} ${H} Z`} fill="#F7A07A" opacity=".15" />
        <path d={path} fill="none" stroke="#EE7A8C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.kg)} r="4" fill="#fff" stroke="#EE7A8C" strokeWidth="2.5" />
        ))}
      </svg>
    </div>
  );
}
