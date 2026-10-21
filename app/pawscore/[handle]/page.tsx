"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";
import { IconChevron } from "@/components/Icons";

const TIPS = [
  { emoji: "📸", text: "Post a floof", pts: "+25", href: "/create" },
  { emoji: "📍", text: "Check in at an event", pts: "+50", href: "/meetups" },
  { emoji: "🎟️", text: "Join a meetup or event", pts: "+10", href: "/meetups" },
  { emoji: "💬", text: "Leave a kind comment", pts: "+4", href: "/home" },
  { emoji: "🍪", text: "Send a biscuit", pts: "+3 each", href: "/home" },
  { emoji: "❤️", text: "Boop a floof", pts: "+2", href: "/explore" },
];

export default function PawScorePage() {
  const { handle } = useParams<{ handle: string }>();
  const { pets, me, pet: petById, pawScore, pawBreakdown, s, signedIn, ready } = useStore();
  const pet = me.handle === decodeURIComponent(handle) ? me : pets.find((p) => p.handle === decodeURIComponent(handle));

  if (!pet) {
    return (
      <Page>
        <TopBar title="PawScore" />
        <p className="px-8 py-20 text-center font-semibold text-muted">{ready ? "No floof by that name 🐾" : "Loading…"}</p>
      </Page>
    );
  }

  const isMe = signedIn && pet.id === me.id;
  const score = pawScore(pet.id);
  const parts = pawBreakdown(pet.id);
  const earned = parts.filter((p) => p.key !== "base");
  const maxPart = Math.max(1, ...parts.map((p) => p.points));

  // Rank among every pet on Floof.
  const everyone = [...pets.filter((p) => p.id !== me.id), ...(signedIn ? [me] : [])];
  const ranked = everyone.map((p) => ({ p, score: pawScore(p.id) })).sort((a, b) => b.score - a.score);
  const rank = ranked.findIndex((r) => r.p.id === pet.id) + 1;
  const topPct = rank > 0 ? Math.max(1, Math.ceil((rank / ranked.length) * 100)) : null;

  // Leaderboard: this pet plus the pets I follow (or that it's friends with).
  const circleIds = new Set<string>([pet.id, ...(isMe ? Object.keys(s.following) : []), ...(signedIn ? [me.id] : [])]);
  const circle = ranked.filter((r) => circleIds.has(r.p.id));

  return (
    <Page>
      <TopBar title="PawScore" sub={isMe ? "Your pet's social score" : `${pet.name}'s social score`} />

      <section className="card mx-4 bg-gradient-to-br from-[#FFF4CC] to-[#FFE3CF] p-5 text-center">
        <PetAvatar pet={pet} size={72} ring="story" className="mx-auto" />
        <p className="mt-2 font-display text-lg font-semibold">{pet.name}</p>
        <p className="font-display text-5xl font-bold tabular-nums">{score.toLocaleString()}</p>
        {rank > 0 && (
          <p className="mt-2 text-sm font-bold text-cocoa-soft">
            #{rank} of {ranked.length} pets on Floof{topPct !== null && topPct <= 50 ? ` · Top ${topPct}%` : ""}
          </p>
        )}
      </section>

      <SectionTitle>How it&apos;s calculated</SectionTitle>
      <ul className="card mx-4 divide-y divide-oat px-4">
        {(isMe ? parts : parts).map((part) => (
          <li key={part.key} className="py-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">{part.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{part.label}</p>
                {part.key !== "base" && (
                  <p className="text-xs font-semibold text-muted">
                    {part.count.toLocaleString()} × {part.per} pts
                  </p>
                )}
              </div>
              <span className="font-display text-lg font-semibold tabular-nums">+{part.points.toLocaleString()}</span>
            </div>
            <div className="ml-9 mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand">
              <div className="h-full rounded-full bg-gradient-to-r from-peach to-blush" style={{ width: `${(part.points / maxPart) * 100}%` }} />
            </div>
          </li>
        ))}
        <li className="flex items-center justify-between py-3">
          <span className="font-extrabold">Total</span>
          <span className="font-display text-xl font-bold tabular-nums">{score.toLocaleString()}</span>
        </li>
      </ul>
      {!isMe && (
        <p className="px-6 pt-2 text-center text-xs font-semibold text-muted">
          Only {pet.name}&apos;s owner can see the full activity breakdown.
        </p>
      )}
      {isMe && earned.every((p) => p.points === 0) && (
        <p className="px-6 pt-2 text-center text-sm font-semibold text-muted">You haven&apos;t earned any points yet — try the ideas below! 🐾</p>
      )}

      {isMe && (
        <>
          <SectionTitle>Earn more paws</SectionTitle>
          <div className="space-y-2 px-4">
            {TIPS.map((t) => (
              <Link key={t.text} href={t.href} className="card flex items-center gap-3 px-4 py-3">
                <span className="text-xl">{t.emoji}</span>
                <span className="flex-1 font-bold">{t.text}</span>
                <span className="rounded-full bg-[#E2F0DA] px-2.5 py-1 text-xs font-extrabold text-[#4F7A3E]">{t.pts}</span>
                <IconChevron size={18} className="text-muted" />
              </Link>
            ))}
          </div>
        </>
      )}

      {circle.length > 1 && (
        <>
          <SectionTitle>{isMe ? "You & pets you follow" : "Leaderboard"}</SectionTitle>
          <ol className="card mx-4 divide-y divide-oat px-4">
            {circle.map((r) => {
              const p = petById(r.p.id) ?? r.p;
              const mine = signedIn && p.id === me.id;
              return (
                <li key={p.id}>
                  <Link href={`/pawscore/${p.handle}`} className={`flex items-center gap-3 py-2.5 ${mine ? "font-extrabold" : ""}`}>
                    <span className="w-8 text-sm font-bold text-muted">#{ranked.findIndex((x) => x.p.id === p.id) + 1}</span>
                    <PetAvatar pet={p} size={36} ring={mine ? "me" : "none"} />
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {p.name}
                      {mine && <span className="ml-1 text-xs text-blush">You</span>}
                    </span>
                    <span className="font-display font-semibold tabular-nums">{r.score.toLocaleString()}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Page>
  );
}
