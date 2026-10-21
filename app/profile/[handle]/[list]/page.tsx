"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AFFINITY, compact } from "@/lib/data";
import { loadFollowList } from "@/lib/cloud";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { Page, TopBar } from "@/components/Shell";
import { IconSearch } from "@/components/Icons";

type Kind = "followers" | "following";

export default function FollowList() {
  const params = useParams<{ handle: string; list: string }>();
  const kind: Kind = params.list === "following" ? "following" : "followers";
  const { pets, pet: petById, me, s, dispatch, cloud, ready, signedIn } = useStore();
  const pet = pets.find((p) => p.handle === decodeURIComponent(params.handle)) ?? (me.handle === params.handle ? me : undefined);
  const [remote, setRemote] = useState<{ followers: string[]; following: string[] } | null>(null);
  const [myFollowers, setMyFollowers] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  // Load both lists from the database (cloud), so the tabs switch instantly.
  useEffect(() => {
    if (!cloud || !pet) return;
    let live = true;
    Promise.all([loadFollowList(pet.id, "followers"), loadFollowList(pet.id, "following")]).then(
      ([followers, following]) => live && setRemote({ followers, following }),
      () => live && setRemote({ followers: [], following: [] }),
    );
    return () => {
      live = false;
    };
  }, [cloud, pet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Who follows me, for the "Follows you" label.
  useEffect(() => {
    if (!cloud || !signedIn) return;
    loadFollowList(me.id, "followers").then((ids) => setMyFollowers(new Set(ids)), () => undefined);
  }, [cloud, signedIn, me.id]);

  const ids = useMemo(() => {
    if (!pet) return [];
    const isMe = pet.id === me.id;
    let list: string[];
    if (cloud) {
      if (!remote) return null;
      list = [...remote[kind]];
    } else if (kind === "following") {
      list = isMe ? [] : Object.keys(AFFINITY[pet.id] ?? {});
    } else {
      list = Object.entries(AFFINITY)
        .filter(([, friends]) => pet.id in friends)
        .map(([id]) => id);
    }
    // Reflect my follows/unfollows from this session right away.
    if (isMe && kind === "following") {
      list = [...Object.keys(s.following).filter((id) => !list.includes(id)), ...list.filter((id) => s.following[id])];
    }
    if (!isMe && kind === "followers" && signedIn) {
      list = list.filter((id) => id !== me.id);
      if (s.following[pet.id]) list.unshift(me.id);
    }
    return list;
  }, [pet, me.id, cloud, remote, kind, s.following, signedIn]);

  const followsMe = (id: string) => (cloud ? myFollowers.has(id) : Object.keys(AFFINITY[id] ?? {}).includes(me.id));

  if (!pet) {
    return (
      <Page>
        <TopBar title="Profile" />
        <p className="px-8 py-20 text-center font-semibold text-muted">{ready ? "No floof by that name 🐾" : "Loading…"}</p>
      </Page>
    );
  }

  const rows = (ids ?? [])
    .map((id) => petById(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .filter((p) => !q.trim() || `${p.name} ${p.handle} ${p.breed}`.toLowerCase().includes(q.trim().toLowerCase()));

  const total = kind === "followers" ? pet.followers + (s.following[pet.id] && pet.id !== me.id ? 1 : 0) : pet.following;
  const more = Math.max(0, total - (ids?.length ?? 0));

  return (
    <Page>
      <TopBar title={pet.handle} />

      <div className="flex border-b border-oat">
        {(["followers", "following"] as Kind[]).map((k) => (
          <Link
            key={k}
            href={`/profile/${pet.handle}/${k}`}
            replace
            className={`flex-1 border-b-2 py-3 text-center text-sm font-extrabold capitalize ${kind === k ? "border-cocoa text-cocoa" : "border-transparent text-muted"}`}
          >
            {k}
          </Link>
        ))}
      </div>

      <div className="relative px-4 pt-4">
        <IconSearch size={18} className="absolute left-8 top-[calc(50%+8px)] -translate-y-1/2 text-muted" />
        <input className="input pl-11" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {ids === null ? (
        <p className="px-8 py-16 text-center font-semibold text-muted">Loading…</p>
      ) : (
        <ul className="space-y-1 px-4 pt-3">
          {rows.map((p) => {
            const isMe = p.id === me.id;
            const following = !!s.following[p.id];
            return (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <Link href={`/profile/${p.handle}`}>
                  <PetAvatar pet={p} size={50} />
                </Link>
                <Link href={`/profile/${p.handle}`} className="min-w-0 flex-1 leading-tight">
                  <p className="truncate font-extrabold">
                    {p.handle}
                    {p.verified && <span className="ml-1 text-sm text-sky">●</span>}
                  </p>
                  <p className="truncate text-sm font-semibold text-muted">
                    {p.name}
                    {p.breed ? ` · ${p.breed}` : ""}
                  </p>
                  {!isMe && followsMe(p.id) && (
                    <span className="mt-1 inline-block rounded-md bg-sand px-1.5 py-0.5 text-[11px] font-extrabold text-cocoa-soft">Follows you</span>
                  )}
                </Link>
                {isMe ? (
                  <span className="text-xs font-bold text-muted">You</span>
                ) : (
                  <button
                    onClick={() => void dispatch({ t: "follow", petId: p.id })}
                    className={`rounded-full px-4 py-1.5 text-sm font-extrabold ${following ? "bg-sand text-cocoa" : "bg-blush text-white"}`}
                  >
                    {following ? "Following" : followsMe(p.id) ? "Follow back" : "Follow"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {ids !== null && rows.length === 0 && (
        <p className="px-8 py-14 text-center font-semibold text-muted">
          {q.trim()
            ? `No one matches “${q}”`
            : kind === "followers"
              ? `No followers yet. ${pet.id === me.id ? "Post a floof to get noticed! 🐾" : ""}`
              : `${pet.id === me.id ? "You're" : `${pet.name} is`} not following anyone yet.`}
        </p>
      )}

      {ids !== null && more > 0 && !q.trim() && (
        <p className="px-8 pb-6 pt-3 text-center text-sm font-semibold text-muted">
          + {compact(more)} more {kind === "followers" ? "fans" : "pets"} from before they joined Floof
        </p>
      )}
    </Page>
  );
}
