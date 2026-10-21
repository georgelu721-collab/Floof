"use client";

import { useState } from "react";
import { formatAUD, LISTINGS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { Page, TopBar } from "@/components/Shell";
import { IconSearch } from "@/components/Icons";
import type { Listing } from "@/lib/types";

const CATS: { id: Listing["category"] | "All"; emoji: string; tint: string }[] = [
  { id: "All", emoji: "✨", tint: "#F6EBDD" },
  { id: "Supplies", emoji: "🦴", tint: "#E7E3F7" },
  { id: "Services", emoji: "✂️", tint: "#E2F0DA" },
  { id: "Adoption", emoji: "💜", tint: "#FDE4E8" },
];

export default function Marketplace() {
  const { me, toast } = useStore();
  const [cat, setCat] = useState<(typeof CATS)[number]["id"]>("All");
  const [q, setQ] = useState("");
  const list = LISTINGS.filter((l) => (cat === "All" || l.category === cat) && l.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <Page>
      <TopBar title="Marketplace" sub="Buy · Sell · Adopt · Support — powered by Lyca Marketplace" />

      <div className="px-4">
        <div className="relative">
          <IconSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-11" placeholder="Search pets, products, or services" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 px-4 pt-4">
        {CATS.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className="flex flex-col items-center gap-1">
            <span className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl ${cat === c.id ? "ring-2 ring-cocoa" : ""}`} style={{ background: c.tint }}>
              {c.emoji}
            </span>
            <span className="text-xs font-bold">{c.id}</span>
          </button>
        ))}
      </div>

      <section className="card mx-4 mt-5 flex items-center gap-3 bg-gradient-to-r from-[#EFE8FB] to-[#E3EEFB] p-4">
        <span className="text-3xl">🍪</span>
        <div className="flex-1">
          <p className="font-extrabold">Spend {me.name}&apos;s biscuits</p>
          <p className="text-xs font-semibold text-cocoa-soft">
            {me.biscuitsReceived} biscuits = {formatAUD(me.biscuitsReceived)} credit at checkout
          </p>
        </div>
      </section>

      <h2 className="px-4 pb-3 pt-6 font-display text-lg font-semibold">Featured</h2>
      <div className="grid grid-cols-2 gap-3 px-4">
        {list.map((l) => (
          <div key={l.id} className="card overflow-hidden">
            <div className="flex aspect-[4/3] items-center justify-center text-5xl" style={{ background: l.tint }}>
              {l.emoji}
            </div>
            <div className="p-3">
              <p className="truncate font-extrabold">{l.title}</p>
              <p className="text-sm font-bold text-cocoa-soft">{l.price}</p>
              <p className="truncate text-xs font-semibold text-muted">{l.where}</p>
              <button className="mt-2 w-full rounded-full bg-sand py-1.5 text-xs font-extrabold" onClick={() => toast("Opening on Lyca Marketplace… (demo)")}>
                {l.category === "Adoption" ? "Meet me" : "View"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {list.length === 0 && <p className="px-8 py-10 text-center font-semibold text-muted">Nothing found</p>}

      <section className="mx-4 mt-6 rounded-3xl bg-paper p-4 text-center shadow-sm">
        <p className="text-xs font-bold text-muted">Powered by</p>
        <p className="font-display text-xl font-bold">Lyca Marketplace</p>
        <p className="text-sm font-semibold text-cocoa-soft">Better together for pet parents</p>
        <p className="mt-2 text-[11px] text-muted">Partner integration placeholder — listings shown are sample data.</p>
      </section>
    </Page>
  );
}
