"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { compact, TRENDING_TAGS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { PetAvatar, PostMedia } from "@/components/PetArt";
import { Page, SectionTitle } from "@/components/Shell";
import { ClanWarMini } from "@/components/ClanWar";
import { IconHeart, IconSearch, IconShop, IconUsers } from "@/components/Icons";

const FILTERS = ["For you", "Dogs", "Cats", "Others", "Moments"] as const;

function ExploreInner() {
  const params = useSearchParams();
  const { posts, pets, pet, s, dispatch, me } = useStore();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [f, setF] = useState<(typeof FILTERS)[number]>("For you");

  const query = q.trim().toLowerCase().replace(/^#/, "");
  const results = useMemo(() => {
    return posts.filter((p) => {
      const owner = pet(p.petId);
      if (!owner) return false;
      if (f === "Dogs" && owner.species !== "dog") return false;
      if (f === "Cats" && owner.species !== "cat") return false;
      if (f === "Others" && (owner.species === "dog" || owner.species === "cat")) return false;
      if (f === "Moments" && !p.moment) return false;
      if (!query) return true;
      return (
        p.caption.toLowerCase().includes(query) ||
        p.tags.some((t) => t.toLowerCase().includes(query)) ||
        owner.name.toLowerCase().includes(query) ||
        owner.handle.includes(query) ||
        owner.breed.toLowerCase().includes(query) ||
        (p.location ?? "").toLowerCase().includes(query)
      );
    });
  }, [posts, pet, f, query]);

  const matchingPets = query
    ? pets.filter((p) => p.name.toLowerCase().includes(query) || p.handle.includes(query) || p.breed.toLowerCase().includes(query))
    : [];

  return (
    <Page>
      <header className="px-4 pb-2 pt-[max(env(safe-area-inset-top),18px)]">
        <h1 className="font-display text-[30px] font-bold">Explore</h1>
        <div className="relative mt-2">
          <IconSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-11" placeholder="Search pets, moments, or tags…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2">
        {FILTERS.map((x) => (
          <button key={x} className="chip" data-on={f === x} onClick={() => setF(x)}>
            {x}
          </button>
        ))}
      </div>

      {!query && (
        <div className="grid grid-cols-3 gap-2 px-4 py-3">
          {[
            { href: "/daily", emoji: "📅", label: "Daily Floof" },
            { href: "/lost", emoji: "🚨", label: "Lost & Found" },
            { href: "/care", emoji: "🩺", label: "Pet care" },
            { href: "/marketplace", emoji: "🛍️", label: "Marketplace" },
            { href: "/meetups", emoji: "📍", label: "Meetups" },
            { href: "/friends", emoji: "💛", label: "Best Friends" },
          ].map((t) => (
            <Link key={t.href} href={t.href} className="card flex flex-col items-center gap-1 p-3 text-center text-xs font-extrabold">
              <span className="text-xl">{t.emoji}</span> {t.label}
            </Link>
          ))}
        </div>
      )}

      {matchingPets.length > 0 && (
        <div className="space-y-2 px-4 py-2">
          {matchingPets.slice(0, 4).map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <Link href={`/profile/${p.handle}`}>
                <PetAvatar pet={p} size={44} />
              </Link>
              <Link href={`/profile/${p.handle}`} className="min-w-0 flex-1 leading-tight">
                <p className="font-extrabold">{p.handle}</p>
                <p className="text-xs font-semibold text-muted">
                  {p.name} · {p.breed}
                </p>
              </Link>
              {p.id !== me.id && (
                <button className="chip" data-on={!s.following[p.id]} onClick={() => dispatch({ t: "follow", petId: p.id })}>
                  {s.following[p.id] ? "Following" : "Follow"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!query && f === "For you" && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          {TRENDING_TAGS.map((t) => (
            <button key={t.tag} onClick={() => setQ(t.tag)} className="shrink-0 rounded-2xl bg-paper px-3 py-2 text-left shadow-sm">
              <p className="text-sm font-extrabold">#{t.tag}</p>
              <p className="text-[11px] font-bold text-muted">{t.count} floofs</p>
            </button>
          ))}
        </div>
      )}

      <div className="columns-2 gap-2 px-3">
        {results.map((p, i) => {
          const owner = pet(p.petId)!;
          return (
            <Link key={p.id} href={`/post/${p.id}`} className="card mb-2 block break-inside-avoid overflow-hidden">
              <PostMedia post={p} pet={owner} className={i % 3 === 0 ? "aspect-[4/5]" : "aspect-square"} />
              <div className="px-2.5 py-2 leading-tight">
                <p className="truncate text-xs font-extrabold">{p.caption}</p>
                <p className="truncate text-[11px] font-bold text-muted">
                  {owner.name} · {compact(p.boops)} boops
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      {results.length === 0 && <p className="px-8 py-16 text-center font-semibold text-muted">No floofs found for “{q}” 🐾</p>}

      {!query && (
        <>
          <SectionTitle>Clan War</SectionTitle>
          <ClanWarMini />
        </>
      )}
    </Page>
  );
}

export default function Explore() {
  return (
    <Suspense>
      <ExploreInner />
    </Suspense>
  );
}
