"use client";

import Link from "next/link";
import { useState } from "react";
import { FILTERS, shopItem } from "@/lib/shop";
import { useStore } from "@/lib/store";
import { BiscuitIcon } from "./Icons";
import { FilteredSample, FramePreview } from "./ShopPreviews";
import { Sheet } from "./Sheet";

/** Confirm buying a Biscuit Shop item with wallet biscuits. */
export function UnlockSheet({ itemId, onClose, onUnlocked }: { itemId: string; onClose: () => void; onUnlocked?: () => void }) {
  const { s, dispatch, toast, signedIn } = useStore();
  const [busy, setBusy] = useState(false);
  const item = shopItem(itemId);
  if (!item) return null;
  const owned = !!s.unlocks[item.id];
  const short = item.price > s.balance;

  const buy = async () => {
    setBusy(true);
    const ok = await dispatch({ t: "unlock", item: item.id });
    setBusy(false);
    if (ok) {
      toast(`${item.emoji} ${item.name} unlocked!`);
      onUnlocked?.();
      onClose();
    }
  };

  return (
    <Sheet title="Biscuit Shop" onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <ItemArt id={item.id} />
        <p className="mt-3 font-display text-xl font-semibold">
          {item.emoji} {item.name}
        </p>
        <p className="text-sm font-semibold text-muted">
          {item.kind === "frame" ? "Photo border" : item.kind === "filter" ? "Photo filter" : "Sticker pack"} · yours to keep
        </p>
        <p className="mt-3 flex items-center gap-1.5 font-display text-2xl font-semibold">
          <BiscuitIcon size={26} /> {item.price}
        </p>
        <p className="text-xs font-bold text-muted">You have {s.balance} biscuits</p>
      </div>
      <div className="mt-4 space-y-2">
        {owned ? (
          <button className="btn btn-soft w-full" onClick={onClose}>
            ✓ Already unlocked
          </button>
        ) : !signedIn ? (
          <Link href="/login" className="btn btn-dark w-full">
            Log in to unlock
          </Link>
        ) : short ? (
          <Link href="/wallet" className="btn btn-dark w-full">
            Top up biscuits ({item.price - s.balance} more needed)
          </Link>
        ) : (
          <button className="btn btn-pink w-full" disabled={busy} onClick={buy}>
            {busy ? "Unlocking…" : `Unlock for ${item.price} biscuits`}
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** A small picture of a shop item. */
export function ItemArt({ id, size = 96 }: { id: string; size?: number }) {
  const item = shopItem(id);
  if (!item) return null;
  if (item.kind === "frame") return <FramePreview frame={item.id.slice(6)} size={size} />;
  if (item.kind === "stickers")
    return (
      <span className="grid grid-cols-3 place-items-center rounded-2xl bg-sand p-1.5" style={{ width: size, height: size, fontSize: size / 4.2 }}>
        {item.stickers!.map((e) => (
          <span key={e}>{e}</span>
        ))}
      </span>
    );
  const look = FILTERS.find((f) => f.id === item.id.slice(7))?.look;
  return look ? <FilteredSample look={look} size={size} /> : null;
}
