"use client";

import Link from "next/link";
import { useState } from "react";
import { SHOP, type ShopKind } from "@/lib/shop";
import { useStore } from "@/lib/store";
import { Page, SectionTitle, TopBar } from "@/components/Shell";
import { BiscuitIcon } from "@/components/Icons";
import { ItemArt, UnlockSheet } from "@/components/UnlockSheet";

const SECTIONS: { kind: ShopKind; title: string; blurb: string }[] = [
  { kind: "frame", title: "Borders", blurb: "Frame your photos" },
  { kind: "stickers", title: "Sticker packs", blurb: "Five stickers in every pack" },
  { kind: "filter", title: "Filters", blurb: "Pick them in the photo editor" },
];

export default function Shop() {
  const { s } = useStore();
  const [buying, setBuying] = useState<string | null>(null);
  const owned = SHOP.filter((i) => s.unlocks[i.id]).length;

  return (
    <Page>
      <TopBar title="Biscuit Shop" sub="Borders, stickers & filters" />
      <section className="card mx-4 flex items-center gap-4 bg-gradient-to-br from-[#FFE6CC] to-[#FDE4E8] p-4">
        <BiscuitIcon size={44} />
        <div className="flex-1 leading-tight">
          <p className="font-display text-3xl font-bold">{s.balance}</p>
          <p className="text-sm font-bold text-cocoa-soft">biscuits to spend · {owned} unlocked</p>
        </div>
        <Link href="/wallet" className="btn btn-dark !px-4 !py-2 text-sm">
          Top up
        </Link>
      </section>
      <p className="px-6 pt-2 text-center text-xs font-semibold text-muted">Unlocks are yours to keep and work on every post you make.</p>

      {SECTIONS.map((sec) => (
        <div key={sec.kind}>
          <SectionTitle>{sec.title}</SectionTitle>
          <p className="-mt-2 px-4 pb-2 text-xs font-semibold text-muted">{sec.blurb}</p>
          <div className="grid grid-cols-3 gap-3 px-4">
            {SHOP.filter((i) => i.kind === sec.kind).map((i) => {
              const have = !!s.unlocks[i.id];
              return (
                <button key={i.id} onClick={() => setBuying(i.id)} className="card flex flex-col items-center gap-1.5 p-2.5 text-center transition active:scale-95">
                  <ItemArt id={i.id} size={84} />
                  <span className="w-full truncate text-xs font-extrabold">{i.name}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${have ? "bg-sage/20 text-sage" : "bg-cocoa text-white"}`}>
                    {have ? "✓ Owned" : `${i.price} 🍪`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="h-6" />
      {buying && <UnlockSheet itemId={buying} onClose={() => setBuying(null)} />}
    </Page>
  );
}
