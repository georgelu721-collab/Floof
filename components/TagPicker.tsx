"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { PetAvatar } from "./PetArt";
import { Sheet } from "./Sheet";
import { IconSearch } from "./Icons";

/** Pick up to 10 pets to tag in a post. */
export function TagPicker({ value, onChange, onClose }: { value: string[]; onChange: (ids: string[]) => void; onClose: () => void }) {
  const { pets, me, s } = useStore();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const list = pets
    .filter((p) => p.id !== me.id)
    .filter((p) => !query || `${p.name} ${p.handle} ${p.breed}`.toLowerCase().includes(query))
    .sort((a, b) => Number(!!s.following[b.id]) - Number(!!s.following[a.id]))
    .slice(0, 40);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : value.length >= 10 ? value : [...value, id]);

  return (
    <Sheet title={`Tag pets (${value.length}/10)`} onClose={onClose}>
      <div className="relative">
        <IconSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-11" placeholder="Search pets" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="mt-3 space-y-1">
        {list.map((p) => {
          const on = value.includes(p.id);
          return (
            <li key={p.id}>
              <button onClick={() => toggle(p.id)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left hover:bg-sand">
                <PetAvatar pet={p} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold">{p.name}</span>
                  <span className="block truncate text-xs font-semibold text-muted">@{p.handle}</span>
                </span>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${on ? "bg-blush text-white" : "border-2 border-oat"}`}>{on ? "✓" : ""}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button className="btn btn-dark sticky bottom-0 mt-3 w-full" onClick={onClose}>
        Done
      </button>
    </Sheet>
  );
}

/** "with Mochi, Luna and 2 others" */
export function TaggedLine({ ids, className = "" }: { ids?: string[]; className?: string }) {
  const { pet } = useStore();
  const names = (ids ?? []).map((id) => pet(id)).filter(Boolean);
  if (!names.length) return null;
  const shown = names.slice(0, 2);
  return (
    <span className={className}>
      with{" "}
      {shown.map((p, i) => (
        <span key={p!.id}>
          <a href={`/profile/${p!.handle}`} className="font-extrabold">
            {p!.name}
          </a>
          {i < shown.length - 1 ? ", " : ""}
        </span>
      ))}
      {names.length > 2 ? ` and ${names.length - 2} other${names.length > 3 ? "s" : ""}` : ""}
    </span>
  );
}
