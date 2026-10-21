"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";

function emojiFor(rank: number, streak: number, score: number) {
  const e: string[] = [];
  if (rank === 0) e.push("💛");
  if (rank === 0 && streak >= 14) e.push("❤️");
  if (rank === 0 && streak >= 60) e.push("💕");
  if (rank > 0 && rank < 3) e.push("😊");
  if (score > 80 && rank > 0) e.push("😎");
  if (streak > 0) e.push(`${streak}🔥`);
  return e.join(" ");
}

export default function Friends() {
  const { me, bestFriends, pawScore } = useStore();
  const list = bestFriends(me.id);
  const top = list[0];

  return (
    <Page>
      <TopBar title="Best Friends" sub="Like a friendship score — but for floofs" />

      <section className="card mx-4 overflow-hidden bg-gradient-to-br from-[#FFF4CC] to-[#FFE3CF] p-5 text-center">
        <p className="text-4xl">👑</p>
        <p className="mt-1 font-display text-2xl font-bold">{me.name}&apos;s Best Friend</p>
        {top ? (
          <Link href={`/profile/${top.pet.handle}`} className="mt-4 flex items-center justify-center gap-4">
            <PetAvatar pet={me} size={70} ring="me" />
            <span className="text-3xl">💛</span>
            <PetAvatar pet={top.pet} size={70} ring="story" />
          </Link>
        ) : (
          <p className="mt-2 text-sm text-cocoa-soft">Boop, comment, message and send biscuits to grow a friendship!</p>
        )}
        {top && (
          <p className="mt-3 font-bold">
            {top.pet.name} · {top.streak > 0 ? `${top.streak} day streak 🔥` : "new friend"}
          </p>
        )}
        <Link href={`/pawscore/${me.handle}`} className="mt-4 block rounded-2xl bg-paper/80 p-3">
          <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Your pet&apos;s social score</p>
          <p className="font-display text-4xl font-bold">{pawScore(me.id).toLocaleString()}</p>
          <p className="text-xs font-bold text-blush">See how it&apos;s calculated →</p>
        </Link>
      </section>

      <SectionTitle>Close friends</SectionTitle>
      <ol className="space-y-3 px-4">
        {list.map((f, i) => (
          <li key={f.pet.id}>
            <Link href={`/profile/${f.pet.handle}`} className="flex items-center gap-3">
              <span className="w-5 text-center font-display font-semibold text-muted">{i + 1}</span>
              <PetAvatar pet={f.pet} size={48} />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">
                  {f.pet.name} <span className="font-normal">{emojiFor(i, f.streak, f.score)}</span>
                </p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand">
                  <div className="h-full rounded-full bg-gradient-to-r from-peach to-blush" style={{ width: `${Math.min(100, (f.score / (list[0]?.score || 1)) * 100)}%` }} />
                </div>
              </div>
              <span className="text-sm font-bold text-muted">{f.score}</span>
            </Link>
          </li>
        ))}
      </ol>

      <section className="card mx-4 mt-6 p-4 text-sm">
        <p className="font-display text-base font-semibold">What the emojis mean</p>
        <ul className="mt-2 space-y-1 font-semibold text-cocoa-soft">
          <li>💛 Best Friend — you interact with them the most</li>
          <li>❤️ BFF — #1 best friends for 2 weeks straight</li>
          <li>💕 Super BFF — #1 best friends for 2 months</li>
          <li>😊 Close friend · 😎 they're a top friend of yours too</li>
          <li>🔥 Streak — days in a row you've interacted</li>
        </ul>
        <p className="mt-3 text-xs text-muted">Boops +1 · Comments +2 · Follows +3 · Messages +1 · Each biscuit +5</p>
      </section>
    </Page>
  );
}
