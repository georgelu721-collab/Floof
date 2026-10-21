"use client";

import { useState } from "react";
import { newUuid, useStore } from "@/lib/store";
import type { Post } from "@/lib/types";
import { PostMedia } from "./PetArt";
import { Sheet } from "./Sheet";

/** Saved! Optionally file the post into one or more collections. */
export function SaveSheet({ post, onClose }: { post: Post; onClose: () => void }) {
  const { s, dispatch, pet, posts, toast } = useStore();
  const [name, setName] = useState("");
  const owner = pet(post.petId);

  const create = () => {
    const n = name.trim();
    if (!n) return;
    void dispatch({ t: "createCollection", collection: { id: newUuid(), name: n, postIds: [post.id] } });
    toast(`Saved to “${n}”`);
    setName("");
  };

  return (
    <Sheet title="Saved ✓" onClose={onClose}>
      <p className="mb-3 text-sm font-semibold text-muted">Add it to a collection to find it later.</p>
      <div className="grid grid-cols-3 gap-3">
        {s.collections.map((c) => {
          const inIt = c.postIds.includes(post.id);
          const cover = posts.find((p) => p.id === c.postIds[c.postIds.length - 1]);
          return (
            <button
              key={c.id}
              onClick={() => void dispatch({ t: "collectionItem", collectionId: c.id, postId: post.id, on: !inIt })}
              className="text-left"
              aria-pressed={inIt}
            >
              <div className={`relative overflow-hidden rounded-2xl ${inIt ? "ring-4 ring-blush" : ""}`}>
                {cover && pet(cover.petId) ? (
                  <PostMedia post={cover} pet={pet(cover.petId)!} className="aspect-square" />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-sand text-2xl">🔖</div>
                )}
                {inIt && <span className="absolute right-1.5 top-1.5 rounded-full bg-blush px-1.5 text-xs font-bold text-white">✓</span>}
              </div>
              <p className="mt-1 truncate text-xs font-extrabold">{c.name}</p>
              <p className="text-[11px] font-semibold text-muted">{c.postIds.length} saved</p>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <input className="input" placeholder="New collection, e.g. Grooming ideas" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
        <button className="btn btn-dark !px-4" onClick={create} disabled={!name.trim()}>
          Add
        </button>
      </div>
      {owner && <p className="mt-3 text-center text-xs font-semibold text-muted">Saved floofs are private — only you can see them.</p>}
    </Sheet>
  );
}
