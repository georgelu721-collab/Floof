"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadRecap, type Recap } from "@/lib/cloud";
import { useStore } from "@/lib/store";
import { PetAvatar, PostMedia } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";
import { BiscuitIcon } from "@/components/Icons";

export default function RecapPage() {
  const { me, cloud, signedIn, posts, pet, streak, pawScore, level, bestFriends, s } = useStore();
  const [recap, setRecap] = useState<Recap | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    if (cloud) {
      loadRecap(me.id).then(setRecap, () => setFailed(true));
    } else {
      // Local demo: a believable week built from the sample data.
      const mine = posts.filter((p) => p.petId === me.id);
      const demoPet = me.owner !== "You"; // built-in demo pets get sample numbers; a new pet starts at zero
      setRecap({
        boops: demoPet ? 128 : mine.reduce((a, p) => a + p.boops, 0),
        comments: demoPet ? 14 : mine.reduce((a, p) => a + p.commentCount, 0),
        followers: demoPet ? 6 : 0,
        biscuits: s.ledger.filter((l) => l.type === "received").reduce((a, l) => a + l.amount, 0) + (demoPet ? 23 : 0),
        posts: mine.filter((p) => p.createdAt && Date.now() - p.createdAt < 7 * 86_400_000).length,
        topPostId: mine[0]?.id,
        fans: bestFriends(me.id).slice(0, 5).map((f) => f.pet.id),
      });
    }
  }, [cloud, signedIn, me.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!signedIn) {
    return (
      <Page>
        <TopBar title="Weekly recap" />
        <p className="px-8 py-16 text-center font-semibold text-muted">Log in to see your weekly recap 📊</p>
      </Page>
    );
  }

  const top = recap?.topPostId ? posts.find((p) => p.id === recap.topPostId) : undefined;
  const lvl = level(me.id);
  const tiles = recap
    ? [
        { emoji: "❤️", n: recap.boops, label: "boops" },
        { emoji: "💬", n: recap.comments, label: "comments" },
        { emoji: "🐾", n: recap.followers, label: "new followers" },
        { emoji: "🍪", n: recap.biscuits, label: "biscuits" },
      ]
    : [];

  return (
    <Page>
      <TopBar title="Weekly recap" sub="Your last 7 days on Floof" />

      <section className="card mx-4 bg-gradient-to-br from-[#E2F0DA] to-[#FFF1C9] p-5 text-center">
        <PetAvatar pet={me} size={72} ring="story" className="mx-auto" />
        <p className="mt-2 font-display text-2xl font-bold">{me.name}&apos;s week</p>
        <p className="text-sm font-bold text-cocoa-soft">
          Level {lvl.level} · {lvl.tier} · PawScore {pawScore(me.id).toLocaleString()}
        </p>
      </section>

      {failed && <p className="px-8 py-6 text-center font-semibold text-muted">Couldn&apos;t load your recap right now.</p>}
      {!recap && !failed && <p className="px-8 py-10 text-center font-semibold text-muted">Crunching the numbers… 🐾</p>}

      {recap && (
        <>
          <div className="grid grid-cols-2 gap-3 px-4 pt-4">
            {tiles.map((t) => (
              <div key={t.label} className="card p-4 text-center">
                <p className="text-2xl">{t.label === "biscuits" ? <BiscuitIcon size={26} className="mx-auto" /> : t.emoji}</p>
                <p className="font-display text-3xl font-bold tabular-nums">{t.n.toLocaleString()}</p>
                <p className="text-xs font-bold text-muted">{t.label}</p>
              </div>
            ))}
          </div>

          <section className="card mx-4 mt-3 flex items-center gap-4 p-4">
            <span className="font-display text-3xl font-bold">🔥 {streak.streak}</span>
            <p className="flex-1 text-sm font-semibold text-cocoa-soft">
              day posting streak · you posted {recap.posts} floof{recap.posts === 1 ? "" : "s"} this week
            </p>
          </section>

          {top && pet(top.petId) && (
            <>
              <SectionTitle>Top floof this week</SectionTitle>
              <Link href={`/post/${top.id}`} className="card mx-4 block overflow-hidden">
                <PostMedia post={top} pet={pet(top.petId)!} className="aspect-[4/3]" />
                <p className="truncate px-4 py-3 text-sm font-bold">{top.caption}</p>
              </Link>
            </>
          )}

          {recap.fans.length > 0 && (
            <>
              <SectionTitle>Biggest fans</SectionTitle>
              <div className="no-scrollbar flex gap-4 overflow-x-auto px-4">
                {recap.fans.map((id, i) => {
                  const p = pet(id);
                  if (!p) return null;
                  return (
                    <Link key={id} href={`/profile/${p.handle}`} className="flex w-16 shrink-0 flex-col items-center">
                      <span className="relative">
                        <PetAvatar pet={p} size={56} ring={i === 0 ? "story" : "none"} />
                        {i === 0 && <span className="absolute -top-2 left-1/2 -translate-x-1/2">👑</span>}
                      </span>
                      <span className="mt-1 w-full truncate text-center text-xs font-bold">{p.name}</span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          <div className="px-4 pt-6">
            <Link href="/daily" className="btn btn-dark w-full">
              Start next week strong: answer today&apos;s Daily Floof
            </Link>
          </div>
        </>
      )}
    </Page>
  );
}
