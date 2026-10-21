"use client";

import Link from "next/link";
import { useState } from "react";
import { breedSlug } from "@/lib/breeds";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { Page, TopBar } from "@/components/Shell";
import { IconSearch } from "@/components/Icons";

export default function Breeds() {
  const { pets, me } = useStore();
  const [q, setQ] = useState("");
  const clubs = new Map<string, { name: string; pets: typeof pets }>();
  for (const p of pets) {
    if (!p.breed) continue;
    const slug = breedSlug(p.breed);
    if (!slug) continue;
    const c = clubs.get(slug) ?? { name: p.breed, pets: [] };
    c.pets.push(p);
    clubs.set(slug, c);
  }
  const list = [...clubs.entries()]
    .filter(([, c]) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(b[0] === breedSlug(me.breed)) - Number(a[0] === breedSlug(me.breed)) || b[1].pets.length - a[1].pets.length);

  return (
    <Page>
      <TopBar title="Breed clubs" sub="A home for every breed on Floof" />
      <div className="relative px-4">
        <IconSearch size={18} className="absolute left-8 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-11" placeholder="Search breeds" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="space-y-2 px-4 pt-4">
        {list.map(([slug, c]) => (
          <li key={slug}>
            <Link href={`/breeds/${slug}`} className="card flex items-center gap-3 p-3">
              <div className="flex -space-x-3">
                {c.pets.slice(0, 3).map((p) => (
                  <PetAvatar key={p.id} pet={p} size={40} />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{c.name} Club</p>
                <p className="text-xs font-semibold text-muted">
                  {c.pets.length} pet{c.pets.length === 1 ? "" : "s"}
                  {slug === breedSlug(me.breed) ? " · your breed" : ""}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
