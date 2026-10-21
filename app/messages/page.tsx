"use client";

import Link from "next/link";
import { useState } from "react";
import { SHARED_POST_RE, THREADS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { Page, TopBar } from "@/components/Shell";
import { IconSearch } from "@/components/Icons";

export default function Messages() {
  const { pet, s, pets, me, cloud } = useStore();
  const [q, setQ] = useState("");

  const dmIds = Object.keys(s.threads).filter((k) => k.startsWith("dm-"));
  const threads = [
    ...dmIds
      .map((k) => k.slice(3))
      .filter((pid) => !THREADS.some((t) => t.petIds.length === 1 && t.petIds[0] === pid))
      .map((pid) => ({ id: pid, petIds: [pid], title: pet(pid)?.name ?? pid, messages: [] as { text: string; at: string }[] })),
    ...(cloud ? [] : THREADS),
  ];

  const filtered = threads.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <Page>
      <TopBar title="Messages" />
      <div className="relative px-4">
        <IconSearch size={18} className="absolute left-8 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-11" placeholder="Search pets, people, or groups" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-4">
        {pets
          .filter((p) => p.id !== me.id && s.following[p.id])
          .map((p) => (
            <Link key={p.id} href={`/messages/${p.id}`} className="flex w-16 shrink-0 flex-col items-center gap-1">
              <span className="relative">
                <PetAvatar pet={p} size={58} />
                <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-sage ring-2 ring-cream" />
              </span>
              <span className="w-full truncate text-center text-xs font-bold">{p.name}</span>
            </Link>
          ))}
      </div>

      <ul className="px-4">
        {filtered.map((t) => {
          const local = s.threads[t.id] ?? (t.petIds.length === 1 ? s.threads[`dm-${t.petIds[0]}`] : undefined) ?? [];
          const last = local[local.length - 1] ?? t.messages[t.messages.length - 1];
          const first = pet(t.petIds[0]);
          if (!first) return null;
          const href = THREADS.some((x) => x.id === t.id) ? `/messages/${t.id}` : `/messages/${t.petIds[0]}`;
          return (
            <li key={t.id}>
              <Link href={href} className="flex items-center gap-3 py-2.5">
                <span className="relative">
                  <PetAvatar pet={first} size={52} />
                  {t.petIds[1] && pet(t.petIds[1]) && (
                    <span className="absolute -bottom-1 -right-1">
                      <PetAvatar pet={pet(t.petIds[1])!} size={26} />
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{t.title}</p>
                  <p className="truncate text-sm font-semibold text-muted">
                    {last ? `${SHARED_POST_RE.test(last.text) ? (last.from === "me" ? "You shared a floof" : "Shared a floof 🐾") : last.text} · ${last.at}` : "Say hi 👋"}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
