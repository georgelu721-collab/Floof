"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { newUuid, useStore } from "@/lib/store";
import type { Comment } from "@/lib/types";
import { PetAvatar } from "@/components/PetArt";
import { PostCard } from "@/components/PostCard";
import { Page, TopBar } from "@/components/Shell";
import { IconHeart, IconX } from "@/components/Icons";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const { post, pet, me, dispatch, ready } = useStore();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const input = useRef<HTMLInputElement>(null);
  const p = post(id);

  if (!p) {
    return (
      <Page>
        <TopBar title="Floof" />
        <p className="px-8 py-20 text-center font-semibold text-muted">{ready ? "This floof wandered off 🐾" : "Loading…"}</p>
      </Page>
    );
  }

  const top = p.comments.filter((c) => !c.parentId);
  const repliesOf = (cid: string) => p.comments.filter((c) => c.parentId === cid);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const parent = replyTo ? (replyTo.parentId ? p.comments.find((c) => c.id === replyTo.parentId) ?? replyTo : replyTo) : null;
    void dispatch({ t: "comment", postId: p.id, petId: replyTo?.petId ?? p.petId, text: text.trim(), parentId: parent?.id, id: newUuid() });
    if (parent) setOpen((o) => ({ ...o, [parent.id]: true }));
    setText("");
    setReplyTo(null);
  };

  const startReply = (c: Comment) => {
    const who = pet(c.petId);
    setReplyTo(c);
    setText(who && who.id !== me.id ? `@${who.handle} ` : "");
    setTimeout(() => input.current?.focus(), 0);
  };

  return (
    <Page>
      <TopBar title="Floof" />
      <PostCard post={p} full />
      <h2 id="comments" className="px-4 pb-3 pt-1 font-display text-lg font-semibold">
        Comments <span className="text-muted">{p.comments.length}</span>
      </h2>
      <section className="space-y-4 px-4 pb-28">
        {top.map((c) => {
          const replies = repliesOf(c.id);
          const expanded = open[c.id] || replies.length <= 2;
          return (
            <div key={c.id}>
              <CommentRow c={c} onReply={() => startReply(c)} />
              {replies.length > 0 && (
                <div className="ml-11 mt-3 space-y-3">
                  {(expanded ? replies : replies.slice(-1)).map((r) => (
                    <CommentRow key={r.id} c={r} small onReply={() => startReply(r)} />
                  ))}
                  {!expanded && (
                    <button className="text-xs font-extrabold text-muted" onClick={() => setOpen((o) => ({ ...o, [c.id]: true }))}>
                      ── View {replies.length - 1} more repl{replies.length - 1 === 1 ? "y" : "ies"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {p.comments.length === 0 && <p className="text-center text-sm font-semibold text-muted">Be the first to say something kind ♡</p>}
      </section>
      <form onSubmit={submit} className="fixed bottom-[76px] left-1/2 z-30 w-full max-w-[440px] -translate-x-1/2 border-t border-oat bg-cream/95 px-4 py-2.5 backdrop-blur">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-muted">
            <span className="flex-1 truncate">Replying to {pet(replyTo.petId)?.handle ?? "comment"}</span>
            <button type="button" onClick={() => (setReplyTo(null), setText(""))} aria-label="Cancel reply">
              <IconX size={14} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <PetAvatar pet={me} size={34} />
          <input
            ref={input}
            className="input"
            enterKeyHint="send"
            placeholder={replyTo ? "Write a reply…" : "Add a kind comment…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
          />
          <button className="font-extrabold text-blush disabled:opacity-40" disabled={!text.trim()}>
            Post
          </button>
        </div>
      </form>
    </Page>
  );
}

function CommentRow({ c, small, onReply }: { c: Comment; small?: boolean; onReply: () => void }) {
  const { pet, s, dispatch, commentLikeCount } = useStore();
  const cp = pet(c.petId);
  if (!cp) return null;
  const liked = !!s.commentLikes[c.id];
  const likes = commentLikeCount(c);
  return (
    <div className="flex gap-3">
      <Link href={`/profile/${cp.handle}`}>
        <PetAvatar pet={cp} size={small ? 26 : 34} />
      </Link>
      <div className="min-w-0 flex-1 text-sm">
        <p className="break-words">
          <Link href={`/profile/${cp.handle}`} className="font-extrabold">
            {cp.handle}
          </Link>{" "}
          {c.text}
        </p>
        <p className="mt-0.5 flex gap-3 text-xs font-semibold text-muted">
          <span>{c.ago}</span>
          {likes > 0 && (
            <span>
              {likes} like{likes === 1 ? "" : "s"}
            </span>
          )}
          <button className="font-extrabold" onClick={onReply}>
            Reply
          </button>
        </p>
      </div>
      <button onClick={() => void dispatch({ t: "commentLike", commentId: c.id, petId: c.petId })} aria-pressed={liked} aria-label="Like comment" className="mt-1 self-start">
        <IconHeart size={16} className={liked ? "animate-pop fill-blush text-blush" : "text-muted"} />
      </button>
    </div>
  );
}
