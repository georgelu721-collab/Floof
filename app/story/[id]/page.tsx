"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { dmKey, timeAgo } from "@/lib/data";
import { useStore } from "@/lib/store";
import type { Post, Story } from "@/lib/types";
import { PetAvatar, PostMedia } from "@/components/PetArt";
import { BiscuitSheet } from "@/components/BiscuitSheet";
import { Sheet } from "@/components/Sheet";
import { useStoryOrder } from "@/components/StoryBar";
import { BiscuitIcon, IconSend, IconX } from "@/components/Icons";

const DURATION = 5000;

type Item = { kind: "story"; story: Story } | { kind: "post"; post: Post };

export default function StoryViewer() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pet, posts, me, storiesFor, dispatch, storyViewers, cloud, toast, signedIn } = useStore();
  const p = pet(id);
  const order = useStoryOrder();
  const live = storiesFor(id);
  // Real stories if they have any; otherwise their latest floofs.
  const items: Item[] = useMemo(
    () => (live.length ? live.map((story) => ({ kind: "story" as const, story })) : posts.filter((x) => x.petId === id).slice(0, 3).map((post) => ({ kind: "post" as const, post }))),
    [live, posts, id],
  );
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [viewers, setViewers] = useState(false);
  const [reply, setReply] = useState("");
  const mine = id === me.id;
  const nextPet = order[order.findIndex((x) => x.id === id) + 1]?.id;
  const item = items[Math.min(i, items.length - 1)];

  const next = () => {
    if (i < items.length - 1) setI(i + 1);
    else if (nextPet && !mine) router.replace(`/story/${nextPet}`);
    else router.push("/home");
  };

  useEffect(() => {
    if (item?.kind === "story" && !mine) void dispatch({ t: "viewStory", id: item.story.id });
  }, [item, mine]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (paused || sheet || viewers) return;
    const t = setTimeout(next, DURATION);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, id, paused, sheet, viewers]);

  if (!p) return null;
  if (!item) {
    return (
      <main className="fixed inset-0 z-50 mx-auto flex max-w-[440px] flex-col items-center justify-center bg-[#2B1B15] text-white">
        <p>No stories yet</p>
        <Link href="/home" className="btn mt-4 bg-white text-cocoa">
          Back
        </Link>
      </main>
    );
  }

  const sendReply = async () => {
    if (!reply.trim() || !signedIn) return;
    const text = item.kind === "story" ? `Replied to your story: ${reply.trim()}` : reply.trim();
    if (await dispatch({ t: "message", threadId: dmKey(p.id, cloud), text, petIds: [p.id] })) {
      toast(`Sent to ${p.name} ✉️`);
      setReply("");
    }
  };

  const when = item.kind === "story" ? timeAgo(item.story.createdAt) : item.post.createdAt ? timeAgo(item.post.createdAt) : item.post.ago ?? "";
  const views = item.kind === "story" ? storyViewers(item.story.id) : [];

  return (
    <main className="fixed inset-0 z-50 mx-auto max-w-[440px] bg-[#2B1B15] text-white">
      <div className="absolute inset-x-0 top-0 z-10 space-y-3 bg-gradient-to-b from-black/55 to-transparent p-4 pb-8 pt-[max(env(safe-area-inset-top),14px)]">
        <div className="flex gap-1">
          {items.map((_, k) => (
            <div key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                key={`${id}-${i}`}
                className="h-full bg-white"
                style={{ width: k < i ? "100%" : k > i ? "0%" : undefined, animation: k === i && !paused && !sheet && !viewers ? `story ${DURATION}ms linear forwards` : undefined }}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/profile/${p.handle}`}>
            <PetAvatar pet={p} size={36} />
          </Link>
          <div className="flex-1 leading-tight">
            <p className="font-extrabold">{p.handle}</p>
            <p className="text-xs text-white/70">{when}</p>
          </div>
          {mine && item.kind === "story" && (
            <button
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold"
              onClick={async () => {
                if (!confirm("Delete this story?")) return;
                await dispatch({ t: "deleteStory", id: item.story.id });
                toast("Story deleted");
                if (items.length <= 1) router.push("/home");
                else setI(Math.max(0, i - 1));
              }}
            >
              Delete
            </button>
          )}
          <button onClick={() => router.push("/home")} aria-label="Close">
            <IconX />
          </button>
        </div>
      </div>

      <div
        className="absolute inset-0"
        onPointerDown={() => setPaused(true)}
        onPointerUp={(e) => {
          setPaused(false);
          const x = e.clientX / window.innerWidth;
          if (x < 0.3) setI(Math.max(0, i - 1));
          else next();
        }}
      >
        {item.kind === "story" ? (
          item.story.image ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.story.image} alt="" className="h-full w-full object-cover" />
              {item.story.text && (
                <p className="absolute inset-x-6 bottom-28 rounded-2xl bg-black/35 px-3 py-2 text-center font-display text-2xl font-semibold">{item.story.text}</p>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center font-display text-3xl font-semibold" style={{ background: item.story.bg }}>
              {item.story.text}
            </div>
          )
        ) : (
          <PostMedia post={{ ...item.post, overlay: undefined }} pet={p} className="h-full w-full" hd />
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/60 to-transparent p-5 pb-[max(env(safe-area-inset-bottom),20px)]">
        {item.kind === "post" && <p className="mb-4 font-semibold drop-shadow">{item.post.caption}</p>}
        {mine ? (
          item.kind === "story" && (
            <button className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold" onClick={() => setViewers(true)}>
              👀 {views.length} view{views.length === 1 ? "" : "s"}
            </button>
          )
        ) : (
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-full border border-white/60 bg-transparent px-4 py-3 text-sm font-semibold text-white placeholder:text-white/70 focus:outline-none"
              placeholder={`Reply to ${p.name}…`}
              value={reply}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
            />
            {reply.trim() ? (
              <button onClick={sendReply} className="rounded-full bg-white px-4 text-cocoa" aria-label="Send">
                <IconSend size={18} />
              </button>
            ) : (
              <button onClick={() => setSheet(true)} className="flex items-center gap-1 rounded-full bg-white px-4 font-extrabold text-cocoa">
                <BiscuitIcon size={20} /> Biscuit
              </button>
            )}
          </div>
        )}
      </div>
      {sheet && <BiscuitSheet pet={p} onClose={() => setSheet(false)} />}
      {viewers && (
        <Sheet title={`Viewed by ${views.length}`} onClose={() => setViewers(false)}>
          <ul className="space-y-2 text-cocoa">
            {views.map((v) => {
              const vp = pet(v);
              return vp ? (
                <li key={v} className="flex items-center gap-3">
                  <PetAvatar pet={vp} size={36} />
                  <span className="font-bold">{vp.name}</span>
                </li>
              ) : null;
            })}
            {views.length === 0 && <li className="text-sm font-semibold text-muted">No views yet</li>}
          </ul>
        </Sheet>
      )}
    </main>
  );
}
