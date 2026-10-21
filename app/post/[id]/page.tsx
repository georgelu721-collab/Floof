"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { PostCard } from "@/components/PostCard";
import { Page, TopBar } from "@/components/Shell";
import { IconHeart } from "@/components/Icons";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const { post, pet, me, dispatch, ready } = useStore();
  const [text, setText] = useState("");
  const p = post(id);

  if (!p) {
    return (
      <Page>
        <TopBar title="Floof" />
        <p className="px-8 py-20 text-center font-semibold text-muted">{ready ? "This floof wandered off 🐾" : "Loading…"}</p>
      </Page>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    dispatch({ t: "comment", postId: p.id, petId: p.petId, text: text.trim() });
    setText("");
  };

  return (
    <Page>
      <TopBar title="Floof" />
      <PostCard post={p} full />
      <h2 id="comments" className="px-4 pb-3 pt-1 font-display text-lg font-semibold">
        Comments <span className="text-muted">{p.comments.length}</span>
      </h2>
      <section className="space-y-4 px-4 pb-20">
        {p.comments.map((c) => {
          const cp = pet(c.petId);
          if (!cp) return null;
          return (
            <div key={c.id} className="flex gap-3">
              <Link href={`/profile/${cp.handle}`}>
                <PetAvatar pet={cp} size={34} />
              </Link>
              <div className="flex-1 text-sm">
                <p>
                  <Link href={`/profile/${cp.handle}`} className="font-extrabold">
                    {cp.handle}
                  </Link>{" "}
                  {c.text}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-muted">
                  {c.ago} · {c.likes} likes · Reply
                </p>
              </div>
              <IconHeart size={16} className="mt-1 text-muted" />
            </div>
          );
        })}
        {p.comments.length === 0 && <p className="text-center text-sm font-semibold text-muted">Be the first to say something kind ♡</p>}
      </section>
      <form onSubmit={submit} className="fixed bottom-[76px] left-1/2 z-30 flex w-full max-w-[440px] -translate-x-1/2 items-center gap-2 border-t border-oat bg-cream/95 px-4 py-2.5 backdrop-blur">
        <PetAvatar pet={me} size={34} />
        <input className="input" enterKeyHint="send" placeholder="Add a kind comment…" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} />
        <button className="font-extrabold text-blush disabled:opacity-40" disabled={!text.trim()}>
          Post
        </button>
      </form>
    </Page>
  );
}
