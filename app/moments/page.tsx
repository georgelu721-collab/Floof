"use client";

import Link from "next/link";
import { MOMENT_TYPES } from "@/lib/data";
import { useStore } from "@/lib/store";
import type { MomentType } from "@/lib/types";
import { PostMedia } from "@/components/PetArt";
import { Page, TopBar } from "@/components/Shell";
import { IconChevron, IconPlus } from "@/components/Icons";

export default function Moments() {
  const { posts, me } = useStore();
  const mine = posts.filter((p) => p.petId === me.id && p.moment);
  const byType = new Map<MomentType, (typeof mine)[number]>();
  for (const p of mine) if (!byType.has(p.moment!)) byType.set(p.moment!, p);
  const types = Object.keys(MOMENT_TYPES) as MomentType[];
  const done = types.filter((t) => byType.has(t));
  const hero = mine[0];

  return (
    <Page>
      <TopBar title="First Pet Moments" sub="Celebrate the milestones" />

      {hero ? (
        <Link href={`/post/${hero.id}`} className="card mx-4 block overflow-hidden">
          <PostMedia post={hero} pet={me} className="aspect-[16/10]" />
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full text-2xl" style={{ background: MOMENT_TYPES[hero.moment!].tint }}>
              {MOMENT_TYPES[hero.moment!].emoji}
            </span>
            <div className="flex-1">
              <p className="font-display text-lg font-semibold">{MOMENT_TYPES[hero.moment!].title}</p>
              <p className="text-sm font-semibold text-muted">{MOMENT_TYPES[hero.moment!].blurb}</p>
            </div>
            <IconChevron className="text-muted" />
          </div>
        </Link>
      ) : (
        <div className="card mx-4 p-6 text-center">
          <p className="text-4xl">✨</p>
          <p className="mt-2 font-display text-lg font-semibold">No moments yet</p>
          <p className="text-sm text-muted">Every first deserves a celebration. Start with your first floof!</p>
        </div>
      )}

      <div className="mx-4 mt-5">
        <div className="flex justify-between text-sm font-extrabold">
          <span>{me.name}&apos;s milestones</span>
          <span className="text-muted">
            {done.length}/{types.length}
          </span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-gradient-to-r from-peach to-blush" style={{ width: `${(done.length / types.length) * 100}%` }} />
        </div>
      </div>

      <ul className="mt-4 space-y-2 px-4">
        {types.map((t) => {
          const m = MOMENT_TYPES[t];
          const p = byType.get(t);
          return (
            <li key={t}>
              <Link href={p ? `/post/${p.id}` : `/create?moment=${t}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-sand">
                <span className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${p ? "" : "opacity-50 grayscale"}`} style={{ background: m.tint }}>
                  {m.emoji}
                </span>
                <div className="flex-1">
                  <p className={`font-extrabold ${p ? "" : "text-cocoa-soft"}`}>{m.title}</p>
                  <p className="text-xs font-semibold text-muted">{p ? m.blurb : "Not yet — tap to capture it"}</p>
                </div>
                {p ? <span className="text-sage">✓</span> : <IconPlus size={18} className="text-muted" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
