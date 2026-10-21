"use client";

import Link from "next/link";
import { CLAN_WAR, compact } from "@/lib/data";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";
import { ScoreBar, useClanScores, useCountdown } from "@/components/ClanWar";
import type { Clan } from "@/lib/types";

export default function ClanWars() {
  const { s, dispatch, pets, toast, me } = useStore();
  const { label } = useCountdown();
  const { cats, dogs, catPct } = useClanScores();
  const leading: Clan = cats > dogs ? "cats" : "dogs";

  const board = [
    { name: "Dogs", score: dogs, emoji: "🐶" },
    { name: "Cats", score: cats, emoji: "🐱" },
    ...CLAN_WAR.others,
  ].sort((a, b) => b.score - a.score);

  const top = pets
    .filter((p) => (s.clan ? p.clan === s.clan : true))
    .sort((a, b) => b.pawScore - a.pawScore)
    .slice(0, 5);

  const join = (c: Clan) => {
    dispatch({ t: "joinClan", clan: c });
    toast(`Welcome to Team ${c === "cats" ? "Cats 🐱" : "Dogs 🐶"}!`);
  };

  return (
    <Page>
      <TopBar title="Clan Wars" sub={`${CLAN_WAR.title} — who will win?`} />

      <section className="px-4 text-center">
        <div className="text-6xl">⚔️</div>
        <h2 className="mt-2 font-display text-2xl font-bold">Cats vs Dogs</h2>
        <p className="mx-auto mt-1 max-w-[300px] text-sm font-semibold text-cocoa-soft">
          Friendly competition. May the fluffiest team win! 🏆
        </p>
        <p className="mt-3 text-xs font-extrabold uppercase tracking-wider text-muted">Ends in</p>
        <p className="font-display text-2xl font-semibold tabular-nums">{label}</p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 px-4">
        {(["cats", "dogs"] as Clan[]).map((c) => {
          const on = s.clan === c;
          return (
            <button
              key={c}
              onClick={() => join(c)}
              className={`relative rounded-3xl p-4 text-center transition ${on ? "ring-4 ring-cocoa" : ""}`}
              style={{ background: c === "cats" ? "#EAE3FA" : "#FFE6CC" }}
            >
              {leading === c && <span className="absolute right-3 top-2 text-lg">👑</span>}
              <div className="text-5xl">{c === "cats" ? "🐱" : "🐶"}</div>
              <p className="mt-1 font-display text-lg font-semibold">Team {c === "cats" ? "Cats" : "Dogs"}</p>
              <p className="text-sm font-bold text-cocoa-soft">{compact(c === "cats" ? cats : dogs)} floofs</p>
              <p className="mt-2 text-xs font-extrabold">{on ? "✓ Your team" : "Tap to join"}</p>
            </button>
          );
        })}
      </section>

      <div className="px-4">
        <ScoreBar catPct={catPct} className="mt-4 h-5" />
        <div className="mt-1 flex justify-between text-xs font-extrabold">
          <span className="text-cats">{catPct.toFixed(1)}%</span>
          <span className="text-dogs">{(100 - catPct).toFixed(1)}%</span>
        </div>
      </div>

      <section className="card mx-4 mt-5 p-5 text-center">
        <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Current challenge</p>
        <p className="mt-1 font-display text-xl font-semibold">{CLAN_WAR.challenge}</p>
        <p className="mt-1 text-sm text-cocoa-soft">Every floof you post = +5 points for your team. Biscuits sent between clans = bonus friendship points.</p>
        {s.clan ? (
          <>
            <p className="mt-3 text-sm font-bold">
              Your contribution: <span className="text-blush">{s.clanFloofs} floofs (+{s.clanFloofs * 5} pts)</span>
            </p>
            <Link href="/create?tag=CatsVsDogs" className="btn btn-dark mt-4 w-full">
              Post a floof for Team {s.clan === "cats" ? "Cats" : "Dogs"}
            </Link>
          </>
        ) : (
          <button className="btn btn-dark mt-4 w-full" onClick={() => join(me.species === "cat" ? "cats" : "dogs")}>
            Join the Clan War
          </button>
        )}
      </section>

      <SectionTitle>Leaderboard</SectionTitle>
      <ol className="card mx-4 divide-y divide-oat px-4">
        {board.map((b, i) => (
          <li key={b.name} className="flex items-center gap-3 py-3">
            <span className="w-5 font-display font-semibold text-muted">{i + 1}</span>
            <span className="text-2xl">{b.emoji}</span>
            <span className="flex-1 font-extrabold">{b.name}</span>
            <span className="font-bold tabular-nums text-cocoa-soft">{compact(b.score)}</span>
          </li>
        ))}
      </ol>

      <SectionTitle>Top floofs {s.clan ? `in Team ${s.clan === "cats" ? "Cats" : "Dogs"}` : ""}</SectionTitle>
      <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2">
        {top.map((p, i) => (
          <Link key={p.id} href={`/profile/${p.handle}`} className="flex w-20 shrink-0 flex-col items-center text-center">
            <span className="relative">
              <PetAvatar pet={p} size={64} ring="story" />
              {i === 0 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-lg">👑</span>}
            </span>
            <span className="mt-1 w-full truncate text-xs font-extrabold">{p.name}</span>
            <span className="text-[11px] font-bold text-muted">{p.pawScore.toLocaleString()}</span>
          </Link>
        ))}
      </div>

      <p className="px-8 pt-6 text-center text-xs font-semibold text-muted">
        Clan Wars are just for fun — no trash talk, only boops. Rabbits & birds have their own leagues 🐰🐦
      </p>
    </Page>
  );
}
