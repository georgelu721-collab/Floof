"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CLAN_WAR, clanWarEnd, compact } from "@/lib/data";
import { useStore } from "@/lib/store";

export function useCountdown() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return { label: "—", short: "—" };
  const ms = clanWarEnd(now).getTime() - now.getTime();
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return { label: `${d}d ${h}h ${m}m ${String(sec).padStart(2, "0")}s`, short: `${d}d ${h}h` };
}

export function useClanScores() {
  const { clanExtra } = useStore();
  // Tiny live drift so the war feels alive, plus real floofs posted this week.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2500);
    return () => clearInterval(t);
  }, []);
  const cats = CLAN_WAR.cats + tick * 7 + clanExtra.cats;
  const dogs = CLAN_WAR.dogs + tick * 6 + clanExtra.dogs;
  return { cats, dogs, catPct: (cats / (cats + dogs)) * 100 };
}

export function ScoreBar({ catPct, className = "" }: { catPct: number; className?: string }) {
  return (
    <div className={`flex h-4 overflow-hidden rounded-full bg-oat ${className}`}>
      <div className="h-full bg-gradient-to-r from-[#B6A6E6] to-cats transition-all duration-700" style={{ width: `${catPct}%` }} />
      <div className="h-full flex-1 bg-gradient-to-r from-dogs to-[#FFC98A]" />
    </div>
  );
}

export function ClanWarMini() {
  const { short } = useCountdown();
  const { cats, dogs, catPct } = useClanScores();
  const { s } = useStore();
  return (
    <Link href="/clan-wars" className="card mx-4 mb-6 block overflow-hidden bg-gradient-to-br from-[#EFE8FB] to-[#FFEBD6] p-4">
      <div className="flex items-center justify-between">
        <span className="text-3xl">🐱</span>
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-soft">Clan War</p>
          <p className="font-display text-lg font-semibold">{s.clan ? `Go Team ${s.clan === "cats" ? "Cats" : "Dogs"}!` : "Join the Cat vs Dog Clan War!"}</p>
        </div>
        <span className="text-3xl">🐶</span>
      </div>
      <ScoreBar catPct={catPct} className="mt-3" />
      <div className="mt-1.5 flex justify-between text-xs font-extrabold">
        <span className="text-cats">{compact(cats)} floofs</span>
        <span className="text-cocoa-soft">Ends in {short}</span>
        <span className="text-dogs">{compact(dogs)} floofs</span>
      </div>
    </Link>
  );
}
