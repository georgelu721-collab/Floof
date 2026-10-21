"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { compact, MOMENT_TYPES, timeAgo } from "@/lib/data";
import { useStore } from "@/lib/store";
import type { Post } from "@/lib/types";
import { BiscuitSheet } from "./BiscuitSheet";
import { ShareSheet } from "./ShareSheet";
import { SaveSheet } from "./SaveSheet";
import { Sheet } from "./Sheet";
import { TaggedLine } from "./TagPicker";
import { useRouter } from "next/navigation";
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
  const { pet, s, dispatch, toast, me } = useStore();
  const owner = pet(post.petId);
  const [sheet, setSheet] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [saveSheet, setSaveSheet] = useState(false);
  const router = useRouter();
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
          {(post.location || post.taggedPets?.length) && (
            <p className="truncate text-xs font-semibold text-muted">
              {post.location}
              {post.location && post.taggedPets?.length ? " · " : ""}
              <TaggedLine ids={post.taggedPets} />
            </p>
          )}
        </div>
        <button className="rounded-full p-1.5 text-muted hover:bg-sand" aria-label="More" onClick={() => setMenu(true)}>
          <IconMore />
        </button>
      </header>

      {post.status === "pending" && (
        <p className="mx-3 mb-2 rounded-2xl bg-[#FFF1C9] px-4 py-2.5 text-sm font-bold">
          🔍 Checking for a pet… only you can see this until it&apos;s approved.
        </p>
      )}
      {post.status === "rejected" && (
        <div className="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-blush-soft px-4 py-2.5 text-sm font-bold">
          <p className="flex-1">
            🚫 Hidden: {post.moderationNote || "we couldn't spot a pet in this photo."} Only you can see it.
          </p>
          <button
            onClick={() => {
              if (confirm("Delete this post?")) void dispatch({ t: "deletePost", postId: post.id });
            }}
            className="shrink-0 rounded-full bg-cocoa px-3 py-1.5 text-xs font-extrabold text-white"
          >
            Delete
          </button>
        </div>
      )}

      <div className={`relative mx-3 select-none ${post.status === "rejected" ? "opacity-50" : ""}`} onClick={onMediaTap}>
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
        <button onClick={() => setShareOpen(true)} aria-label="Share">
          <IconSend />
        </button>
        <button
          className="ml-auto"
          onClick={async () => {
            if (saved) return void dispatch({ t: "save", postId: post.id });
            if (await dispatch({ t: "save", postId: post.id })) setSaveSheet(true);
          }}
          aria-pressed={saved}
          aria-label="Save"
        >
          <IconBookmark className={saved ? "fill-cocoa" : ""} />
        </button>
      </div>

      <div className="space-y-1.5 px-4 pt-2 text-[15px]">
        {owner.id === me.id && <BiscuitGifts postId={post.id} />}
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
          <Link href={`/post/${post.id}#comments`} className="block text-sm font-semibold text-muted">
            {post.commentCount === 1 ? "View 1 comment" : `View all ${compact(post.commentCount)} comments`}
          </Link>
        )}
        {!full &&
          post.comments.filter((c) => !c.parentId).slice(-2).map((c) => {
            const by = pet(c.petId);
            if (!by) return null;
            return (
              <p key={c.id} className="truncate text-sm">
                <Link href={`/profile/${by.handle}`} className="font-extrabold">
                  {by.handle}
                </Link>{" "}
                {c.text}
              </p>
            );
          })}
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {when}
          {post.editedAt ? " · edited" : ""}
        </p>
      </div>

      {shareOpen && <ShareSheet post={post} onClose={() => setShareOpen(false)} />}
      {saveSheet && <SaveSheet post={post} onClose={() => setSaveSheet(false)} />}
      {menu && (
        <Sheet title="Floof" onClose={() => setMenu(false)}>
          <div className="space-y-2">
            {owner.id === me.id && (
              <>
                <button className="btn btn-soft w-full" onClick={() => router.push(`/post/${post.id}/edit`)}>
                  ✏️ Edit caption & tags
                </button>
                <button
                  className="btn btn-soft w-full !text-blush"
                  onClick={async () => {
                    if (!confirm("Delete this floof? This can't be undone.")) return;
                    setMenu(false);
                    if (await dispatch({ t: "deletePost", postId: post.id })) toast("Floof deleted");
                  }}
                >
                  🗑️ Delete
                </button>
              </>
            )}
            <button
              className="btn btn-soft w-full"
              onClick={() => {
                setMenu(false);
                setSaveSheet(true);
                if (!saved) void dispatch({ t: "save", postId: post.id });
              }}
            >
              🔖 Save to collection
            </button>
            <button
              className="btn btn-soft w-full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
                  toast("Link copied 🔗");
                } catch {
                  toast(`${window.location.origin}/post/${post.id}`);
                }
                setMenu(false);
              }}
            >
              🔗 Copy link
            </button>
          </div>
        </Sheet>
      )}
      {sheet && <BiscuitSheet pet={owner} postId={post.id} onClose={() => setSheet(false)} onSent={(n) => setExtraBiscuits((x) => x + n)} />}
    </article>
  );
}

/** For the post's owner: who sent biscuits on this post (gift details are private to the owner). */
function BiscuitGifts({ postId }: { postId: string }) {
  const { s, pet } = useStore();
  const gifts = s.ledger.filter((l) => l.type === "received" && l.postId === postId && l.petId);
  if (!gifts.length) return null;
  const bySender = new Map<string, number>();
  for (const g of gifts) bySender.set(g.petId!, (bySender.get(g.petId!) ?? 0) + g.amount);
  const senders = [...bySender.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 rounded-2xl bg-[#FFF1E0] px-3 py-2 text-sm">
      <BiscuitIcon size={18} />
      {senders.slice(0, 3).map(([id, n], i) => {
        const p = pet(id);
        return (
          <span key={id}>
            <Link href={`/profile/${p?.handle ?? ""}`} className="font-extrabold">
              {p?.handle ?? "a fan"}
            </Link>{" "}
            sent {n}
            {i < Math.min(senders.length, 3) - 1 ? "," : ""}
          </span>
        );
      })}
      {senders.length > 3 && <span className="font-semibold text-muted">+{senders.length - 3} more</span>}
    </p>
  );
}
