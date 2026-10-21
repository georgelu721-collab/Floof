"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { PetAvatar, PostMedia } from "@/components/PetArt";
import { BiscuitSheet } from "@/components/BiscuitSheet";
import { BiscuitIcon, IconX } from "@/components/Icons";

const DURATION = 5000;

export default function Story() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pet, posts, pets, me } = useStore();
  const p = pet(id);
  const items = useMemo(() => posts.filter((x) => x.petId === id).slice(0, 3), [posts, id]);
  const [i, setI] = useState(0);
  const [sheet, setSheet] = useState(false);

  const order = pets.filter((x) => x.id !== me.id).slice(0, 9).map((x) => x.id);
  const nextPet = order[order.indexOf(id) + 1];

  const next = () => {
    if (i < items.length - 1) setI(i + 1);
    else if (nextPet) router.replace(`/story/${nextPet}`);
    else router.push("/home");
  };

  useEffect(() => {
    if (sheet) return;
    const t = setTimeout(next, DURATION);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, id, sheet]);

  if (!p) return null;
  const item = items[i];

  return (
    <main className="fixed inset-0 z-50 mx-auto max-w-[440px] bg-[#2B1B15] text-white">
      <div className="absolute inset-x-0 top-0 z-10 space-y-3 p-4 pt-[max(env(safe-area-inset-top),14px)]">
        <div className="flex gap-1">
          {items.map((_, k) => (
            <div key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                key={`${id}-${i}`}
                className="h-full bg-white"
                style={{ width: k < i ? "100%" : k > i ? "0%" : undefined, animation: k === i && !sheet ? `story ${DURATION}ms linear forwards` : undefined }}
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
            <p className="text-xs text-white/70">{item?.ago ?? "now"}</p>
          </div>
          <button onClick={() => router.push("/home")} aria-label="Close">
            <IconX />
          </button>
        </div>
      </div>

      <button className="absolute inset-0" onClick={next} aria-label="Next">
        {item ? (
          <PostMedia post={{ ...item, overlay: undefined }} pet={p} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/70">No stories yet</div>
        )}
      </button>

      {item && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/60 to-transparent p-5 pb-[max(env(safe-area-inset-bottom),20px)]">
          <p className="mb-4 font-semibold drop-shadow">{item.caption}</p>
          <div className="flex gap-3">
            <Link href={`/messages/${p.id}`} className="flex-1 rounded-full border border-white/60 px-4 py-3 text-sm font-semibold text-white/80">
              Send a message…
            </Link>
            <button onClick={() => setSheet(true)} className="flex items-center gap-1 rounded-full bg-white px-4 font-extrabold text-cocoa">
              <BiscuitIcon size={20} /> Biscuit
            </button>
          </div>
        </div>
      )}
      {sheet && <BiscuitSheet pet={p} onClose={() => setSheet(false)} />}
    </main>
  );
}
