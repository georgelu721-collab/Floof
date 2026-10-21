"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { compact, MOMENT_TYPES, timeAgo } from "@/lib/data";
import { useStore } from "@/lib/store";
import type { Post } from "@/lib/types";
import { BiscuitSheet } from "./BiscuitSheet";
import { BiscuitIcon, IconBookmark, IconComment, IconHeart, IconMore, IconSend, PawIcon } from "./Icons";
import { PetAvatar, PostMedia } from "./PetArt";

export function MomentBadge({ type, className = "" }: { type: Post["moment"]; className?: string }) {
  if (!type) return null;
  const m = MOMENT_TYPES[type];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${className}`} style={{ background: m.tint }}>
      <span>{m.emoji}</span> First Pet Moment · {m.title.replace(/^First /, "")}
    </span>
  );
}

export function PostCard({ post, full = false }: { post: Post; full?: boolean }) {
  const { pet, s, dispatch, toast } = useStore();
  const owner = pet(post.petId);
  const [sheet, setSheet] = useState(false);
  const [burst, setBurst] = useState(0);
  const [extraBiscuits, setExtraBiscuits] = useState(0);
  const lastTap = useRef(0);
  if (!owner) return null;

  const booped = !!s.boops[post.id];
  const saved = !!s.saved[post.id];
  const boop = () => dispatch({ t: "boop", postId: post.id, petId: owner.id });

  const onMediaTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!booped) boop();
      setBurst((b) => b + 1);
    }
    lastTap.current = now;
  };

  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${owner.name} on Floof`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied 🔗");
      }
    } catch {
      /* share cancelled */
    }
  };

  const when = post.createdAt ? timeAgo(post.createdAt) : post.ago;

  return (
    <article className="pb-5">
      <header className="flex items-center gap-3 px-4 py-2.5">
        <Link href={`/profile/${owner.handle}`}>
          <PetAvatar pet={owner} size={38} ring="story" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={`/profile/${owner.handle}`} className="text-[15px] font-extrabold">
            {owner.handle}
            {owner.verified && <span className="ml-1 text-sky">●</span>}
          </Link>
          {post.location && <p className="truncate text-xs font-semibold text-muted">{post.location}</p>}
        </div>
        <button className="rounded-full p-1.5 text-muted hover:bg-sand" aria-label="More">
          <IconMore />
        </button>
      </header>

      <div className="relative mx-3 select-none" onClick={onMediaTap}>
        <PostMedia post={post} pet={owner} carousel className="aspect-square rounded-[1.6rem]" />
        {burst > 0 && (
          <span key={burst} className="animate-float-up pointer-events-none absolute left-1/2 top-1/2 -ml-10 -mt-10 text-white drop-shadow-lg">
            <PawIcon size={80} />
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 px-4 pt-3">
        <button onClick={boop} className="flex items-center gap-1.5 font-extrabold" aria-pressed={booped} aria-label="Boop">
          <IconHeart className={booped ? "animate-pop fill-blush text-blush" : ""} />
          {compact(post.boops + (booped ? 1 : 0))}
        </button>
        <Link href={`/post/${post.id}`} className="flex items-center gap-1.5 font-extrabold" aria-label="Comments">
          <IconComment />
          {compact(post.commentCount)}
        </Link>
        <button onClick={() => setSheet(true)} className="flex items-center gap-1.5 font-extrabold" aria-label="Send a biscuit">
          <BiscuitIcon size={24} />
          {compact(post.biscuits + extraBiscuits)}
        </button>
        <button onClick={share} aria-label="Share">
          <IconSend />
        </button>
        <button className="ml-auto" onClick={() => dispatch({ t: "save", postId: post.id })} aria-pressed={saved} aria-label="Save">
          <IconBookmark className={saved ? "fill-cocoa" : ""} />
        </button>
      </div>

      <div className="space-y-1.5 px-4 pt-2 text-[15px]">
        {post.moment && <MomentBadge type={post.moment} />}
        <p>
          <Link href={`/profile/${owner.handle}`} className="font-extrabold">
            {owner.handle}
          </Link>{" "}
          {post.caption}
        </p>
        {post.tags.length > 0 && (
          <p className="flex flex-wrap gap-x-2 text-sm font-bold text-[#6B8FB5]">
            {post.tags.map((t) => (
              <Link key={t} href={`/explore?q=${encodeURIComponent(t)}`}>
                #{t}
              </Link>
            ))}
          </p>
        )}
        {!full && post.commentCount > 0 && (
          <Link href={`/post/${post.id}`} className="block text-sm font-semibold text-muted">
            View all {compact(post.commentCount)} comments
          </Link>
        )}
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{when}</p>
      </div>

      {sheet && <BiscuitSheet pet={owner} postId={post.id} onClose={() => setSheet(false)} onSent={(n) => setExtraBiscuits((x) => x + n)} />}
    </article>
  );
}
