"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadNotifications } from "@/lib/cloud";
import type { Notification } from "@/lib/types";
import { NOTIFICATIONS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { PetAvatar, PostMedia } from "@/components/PetArt";
import { Page, TopBar } from "@/components/Shell";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "boop", label: "Boops" },
  { id: "comment", label: "Comments" },
  { id: "biscuit", label: "Biscuits" },
  { id: "follow", label: "Follows" },
] as const;

export default function Notifications() {
  const { pet, post, s, dispatch, me, cloud, signedIn } = useStore();
  const [f, setF] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [live, setLive] = useState<Notification[] | null>(null);
  useEffect(() => {
    if (!cloud || !signedIn) return;
    loadNotifications(me.id).then(setLive, () => setLive([]));
  }, [cloud, signedIn, me.id]);
  const source = cloud ? (live ?? []) : NOTIFICATIONS;
  const list = source.filter((n) => f === "all" || n.kind === f);

  return (
    <Page>
      <TopBar title="Notifications" />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {FILTERS.map((x) => (
          <button key={x.id} className="chip" data-on={f === x.id} onClick={() => setF(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <ul className="space-y-1 px-4">
        {list.map((n) => {
          const p = n.kind === "trending" ? me : pet(n.petId);
          if (!p) return null;
          const target = n.postId ? post(n.postId) : undefined;
          return (
            <li key={n.id} className="flex items-center gap-3 py-2">
              <Link href={`/profile/${p.handle}`}>
                <PetAvatar pet={p} size={46} />
              </Link>
              <p className="flex-1 text-sm">
                {n.kind !== "trending" && (
                  <Link href={`/profile/${p.handle}`} className="font-extrabold">
                    {p.handle}{" "}
                  </Link>
                )}
                {n.text} <span className="font-semibold text-muted">{n.ago}</span>
              </p>
              {n.kind === "follow" ? (
                <button
                  onClick={() => dispatch({ t: "follow", petId: p.id })}
                  className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${s.following[p.id] ? "bg-sand" : "bg-blush text-white"}`}
                >
                  {s.following[p.id] ? "Following" : "Follow back"}
                </button>
              ) : n.kind === "pack" ? (
                <Link href="/meetups" className="rounded-full bg-sand px-3 py-1.5 text-xs font-extrabold">
                  View
                </Link>
              ) : target ? (
                <Link href={`/post/${target.id}`}>
                  <PostMedia post={target} pet={pet(target.petId)!} className="h-11 w-11 rounded-xl" />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
      {cloud && !signedIn && <p className="px-8 py-16 text-center font-semibold text-muted">Log in to see your notifications 🔔</p>}
      {cloud && signedIn && live && list.length === 0 && (
        <p className="px-8 py-16 text-center font-semibold text-muted">No notifications yet. Post a floof and make some friends! 🐾</p>
      )}
    </Page>
  );
}
