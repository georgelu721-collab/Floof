"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import type { Pet } from "@/lib/types";
import { PetAvatar } from "./PetArt";

/** Order of pets in the story bar: live unseen stories, then seen stories, then followed pets. */
export function useStoryOrder(): Pet[] {
  const { pets, me, s, storiesFor } = useStore();
  const others = pets.filter((p) => p.id !== me.id);
  const withStories = others.filter((p) => storiesFor(p.id).length > 0);
  const unseen = withStories.filter((p) => storiesFor(p.id).some((st) => !s.seenStories[st.id]));
  const seen = withStories.filter((p) => !unseen.includes(p));
  const rest = others
    .filter((p) => !withStories.includes(p))
    .sort((a, b) => Number(!!s.following[b.id]) - Number(!!s.following[a.id]))
    .slice(0, Math.max(0, 9 - withStories.length));
  return [...unseen, ...seen, ...rest];
}

export function StoryBar() {
  const { me, s, storiesFor, signedIn } = useStore();
  const order = useStoryOrder();
  const mine = storiesFor(me.id);

  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-3 pt-1">
      <div className="flex w-[70px] shrink-0 flex-col items-center gap-1">
        <span className="relative">
          <Link href={mine.length ? `/story/${me.id}` : "/story/new"} aria-label="Your story">
            <PetAvatar pet={me} size={66} ring={mine.length ? "me" : "seen"} />
          </Link>
          <Link
            href={signedIn ? "/story/new" : "/login"}
            aria-label="Add to your story"
            className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-cocoa text-sm font-black text-white ring-2 ring-cream"
          >
            +
          </Link>
        </span>
        <span className="w-full truncate text-center text-xs font-bold">Your story</span>
      </div>
      {order.map((p) => {
        const live = storiesFor(p.id);
        const unseen = live.some((st) => !s.seenStories[st.id]);
        return (
          <Link key={p.id} href={`/story/${p.id}`} className="flex w-[70px] shrink-0 flex-col items-center gap-1">
            <PetAvatar pet={p} size={66} ring={live.length ? (unseen ? "story" : "seen") : "none"} />
            <span className="w-full truncate text-center text-xs font-bold">{p.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
