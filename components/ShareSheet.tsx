"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dmKey, THREADS } from "@/lib/data";
import { useStore } from "@/lib/store";
import type { Pet, Post } from "@/lib/types";
import { IconCheck, IconSearch, IconSend, IconX } from "./Icons";
import { PetAvatar, PostMedia } from "./PetArt";

/** Share a post with other pets by direct message, or outside Floof. */
export function ShareSheet({ post, onClose }: { post: Post; onClose: () => void }) {
  const { pets, me, s, cloud, signedIn, dispatch, toast, pet, bestFriends } = useStore();
  const owner = pet(post.petId);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Suggestions: recently messaged → following → best friends → everyone else.
  const { recent, rest } = useMemo(() => {
    const lastTs: Record<string, number> = {};
    for (const [key, msgs] of Object.entries(s.threads)) {
      const id = key.startsWith("dm-") ? key.slice(3) : THREADS.find((t) => t.id === key && t.petIds.length === 1)?.petIds[0];
      if (!id || !msgs.length) continue;
      lastTs[id] = Math.max(lastTs[id] ?? 0, ...msgs.map((m) => m.ts ?? 1));
    }
    if (!cloud) for (const t of THREADS) if (t.petIds.length === 1 && !(t.petIds[0] in lastTs)) lastTs[t.petIds[0]] = 0.5;

    const ok = (p?: Pet): p is Pet => !!p && p.id !== me.id;
    const recentIds = Object.entries(lastTs)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
    const ordered = [
      ...recentIds,
      ...Object.keys(s.following),
      ...bestFriends(me.id).map((f) => f.pet.id),
      ...pets.map((p) => p.id),
    ];
    const seen = new Set<string>();
    const all: Pet[] = [];
    for (const id of ordered) {
      if (seen.has(id)) continue;
      seen.add(id);
      const p = pet(id);
      if (ok(p)) all.push(p);
    }
    const recentSet = new Set(recentIds);
    return { recent: all.filter((p) => recentSet.has(p.id)), rest: all.filter((p) => !recentSet.has(p.id)) };
  }, [s.threads, s.following, cloud, me.id, pets, pet, bestFriends]);

  const query = q.trim().toLowerCase();
  const match = (p: Pet) => !query || `${p.name} ${p.handle} ${p.breed}`.toLowerCase().includes(query);
  const people = query ? [...recent, ...rest].filter(match) : [...recent, ...rest].slice(0, 16);

  const toggle = (id: string) => setPicked((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const url = typeof window !== "undefined" ? `${window.location.origin}/post/${post.id}` : `/post/${post.id}`;

  const send = async () => {
    if (!picked.length || busy) return;
    setBusy(true);
    const text = note.trim() ? `${note.trim()}\n${url}` : url;
    const results = await Promise.all(
      picked.map((id) => dispatch({ t: "message", threadId: dmKey(id, cloud), text, petIds: [id] })),
    );
    setBusy(false);
    const sent = picked.filter((_, i) => results[i]);
    if (sent.length) {
      const first = pet(sent[0])?.name ?? "a friend";
      toast(`Sent to ${first}${sent.length > 1 ? ` and ${sent.length - 1} other${sent.length > 2 ? "s" : ""}` : ""} ✉️`);
      onClose();
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied 🔗");
    } catch {
      toast(url);
    }
  };
  const nativeShare = async () => {
    try {
      await navigator.share({ title: `${owner?.name ?? "A floof"} on Floof`, url });
    } catch {
      /* cancelled */
    }
  };
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cocoa/40" onClick={onClose}>
      <div
        className="animate-sheet flex max-h-[85dvh] w-full max-w-[440px] flex-col rounded-t-[2rem] bg-paper pb-[max(env(safe-area-inset-bottom),16px)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Share"
      >
        <div className="flex items-center gap-3 px-5 pb-3 pt-4">
          {owner && <PostMedia post={post} pet={owner} className="h-12 w-12 shrink-0 rounded-xl" />}
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold leading-tight">Share</p>
            <p className="truncate text-xs font-semibold text-muted">{owner ? `${owner.handle}: ${post.caption}` : post.caption}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-sand" aria-label="Close">
            <IconX />
          </button>
        </div>

        {signedIn ? (
          <>
            <div className="relative px-5">
              <IconSearch size={18} className="absolute left-9 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input pl-11" placeholder="Search pets" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3">
              {!query && recent.length > 0 && <p className="px-2 pb-1 text-xs font-extrabold uppercase tracking-wide text-muted">Recent</p>}
              <div className="grid grid-cols-4 gap-y-3">
                {people.map((p, i) => {
                  const on = picked.includes(p.id);
                  const firstOfRest = !query && recent.length > 0 && i === recent.length;
                  return (
                    <div key={p.id} className={firstOfRest ? "contents" : "contents"}>
                      {firstOfRest && (
                        <p className="col-span-4 px-2 pt-1 text-xs font-extrabold uppercase tracking-wide text-muted">Following & friends</p>
                      )}
                      <button onClick={() => toggle(p.id)} className="flex flex-col items-center gap-1 px-1" aria-pressed={on}>
                        <span className="relative">
                          <PetAvatar pet={p} size={60} ring={on ? "me" : "none"} />
                          {on && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-blush text-white ring-2 ring-paper">
                              <IconCheck size={14} />
                            </span>
                          )}
                        </span>
                        <span className="w-full truncate text-center text-xs font-bold">{p.name}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              {people.length === 0 && <p className="py-8 text-center text-sm font-semibold text-muted">No pets match “{q}”</p>}
            </div>

            {picked.length > 0 ? (
              <div className="space-y-2 border-t border-oat px-5 pt-3">
                <input className="input" placeholder="Write a message…" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
                <button className="btn btn-dark w-full" onClick={send} disabled={busy}>
                  <IconSend size={18} />
                  {busy ? "Sending…" : picked.length === 1 ? `Send to ${pet(picked[0])?.name}` : `Send to ${picked.length} pets`}
                </button>
              </div>
            ) : (
              <ShareOutside copy={copy} nativeShare={canNativeShare ? nativeShare : undefined} />
            )}
          </>
        ) : (
          <div className="px-5 pb-2">
            <p className="rounded-2xl bg-sand px-4 py-3 text-sm font-semibold">
              <Link href="/login" className="font-extrabold text-blush">
                Log in
              </Link>{" "}
              to send floofs to friends on Floof.
            </p>
            <ShareOutside copy={copy} nativeShare={canNativeShare ? nativeShare : undefined} />
          </div>
        )}
      </div>
    </div>
  );
}

function ShareOutside({ copy, nativeShare }: { copy: () => void; nativeShare?: () => void }) {
  return (
    <div className="flex gap-3 border-t border-oat px-5 pt-3">
      <button onClick={copy} className="btn btn-soft flex-1 !py-2.5 text-sm">
        🔗 Copy link
      </button>
      {nativeShare && (
        <button onClick={nativeShare} className="btn btn-soft flex-1 !py-2.5 text-sm">
          ↗ More options
        </button>
      )}
    </div>
  );
}
