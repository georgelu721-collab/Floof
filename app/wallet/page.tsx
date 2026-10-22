"use client";

import Link from "next/link";
import { formatAUD, timeAgo } from "@/lib/data";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";
import { BiscuitIcon } from "@/components/Icons";

const PACKS = [
  { n: 10, price: "$1.00", bonus: "" },
  { n: 50, price: "$5.00", bonus: "" },
  { n: 120, price: "$10.00", bonus: "+20 bonus" },
];

export default function Wallet() {
  const { s, me, dispatch, toast, pet } = useStore();
  const sent = s.ledger.filter((l) => l.type === "sent").reduce((a, l) => a + l.amount, 0);
  const receivedValue = me.biscuitsReceived;

  return (
    <Page>
      <TopBar title="Biscuit Wallet" sub="1 biscuit = 10 cents" />

      <section className="card mx-4 bg-gradient-to-br from-[#FFE6CC] to-[#FDE4E8] p-5 text-center">
        <BiscuitIcon size={48} className="mx-auto animate-wiggle" />
        <p className="mt-2 font-display text-5xl font-bold">{s.balance}</p>
        <p className="font-bold text-cocoa-soft">biscuits to send · {formatAUD(s.balance)}</p>
        <p className="mt-2 text-xs font-bold text-muted">You&apos;ve sent {sent} biscuits ({formatAUD(sent)}) to other floofs</p>
      </section>

      <SectionTitle>Top up</SectionTitle>
      <div className="grid grid-cols-3 gap-3 px-4">
        {PACKS.map((p) => (
          <button
            key={p.n}
            className="card flex flex-col items-center p-3 transition active:scale-95"
            onClick={() => {
              const total = p.n + (p.bonus ? 20 : 0);
              dispatch({ t: "topup", amount: total, note: `Top-up via Lyca Pay (${p.price})` });
              toast(`+${total} biscuits added 🍪`);
            }}
          >
            <span className="font-display text-2xl font-semibold">{p.n}</span>
            <span className="text-xs font-bold text-muted">biscuits</span>
            <span className="mt-2 rounded-full bg-cocoa px-3 py-1 text-sm font-extrabold text-white">{p.price}</span>
            {p.bonus && <span className="mt-1 text-[11px] font-extrabold text-sage">{p.bonus}</span>}
          </button>
        ))}
      </div>
      <p className="px-6 pt-2 text-center text-xs text-muted">Demo mode — no real payment is taken. Payments would be processed by Lyca Marketplace.</p>

      <Link href="/shop" className="card mx-4 mt-4 flex items-center gap-3 p-4">
        <span className="text-3xl">🛍️</span>
        <span className="flex-1 leading-tight">
          <span className="block font-display text-lg font-semibold">Biscuit Shop</span>
          <span className="text-xs font-bold text-muted">Spend biscuits on borders, sticker packs & filters</span>
        </span>
        <span className="text-xl text-muted">›</span>
      </Link>

      <SectionTitle>{me.name}&apos;s earnings</SectionTitle>
      <section className="card mx-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-2xl font-semibold">{receivedValue} biscuits</p>
            <p className="text-sm font-bold text-muted">received from fans · worth {formatAUD(receivedValue)}</p>
          </div>
          <PetAvatar pet={me} size={48} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/marketplace" className="btn btn-dark !py-2.5 text-sm">
            Spend at Lyca
          </Link>
          <button
            className="btn btn-soft !py-2.5 text-sm"
            disabled={receivedValue < 10}
            onClick={() => {
              dispatch({ t: "redeem", amount: 10, note: "Donated to Rescue & Adoption 🏡" });
              toast("Donated 10 biscuits ($1) to rescue pets 💛");
            }}
          >
            Donate 10 to rescues
          </button>
        </div>
      </section>

      <SectionTitle>History</SectionTitle>
      <ul className="divide-y divide-oat px-4">
        {s.ledger.map((l) => {
          const p = l.petId ? pet(l.petId) : undefined;
          return (
            <li key={l.id} className="flex items-center gap-3 py-3">
              {p ? (
                <PetAvatar pet={p} size={38} />
              ) : (
                <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-sand">
                  <BiscuitIcon size={22} />
                </span>
              )}
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-extrabold">
                  {l.type === "sent" ? `Sent to ${p?.name ?? "a floof"}` : l.type === "received" ? `From ${p?.name ?? "a fan"}` : l.type === "redeem" ? "Redeemed" : l.type === "shop" ? "Biscuit Shop" : "Top-up"}
                </p>
                <p className="truncate text-xs font-semibold text-muted">
                  {l.note ?? ""} {l.at ? `· ${timeAgo(l.at)}` : ""}
                </p>
              </div>
              <span className={`font-extrabold ${l.type === "sent" || l.type === "redeem" || l.type === "shop" ? "text-cocoa-soft" : "text-sage"}`}>
                {l.type === "sent" || l.type === "redeem" || l.type === "shop" ? "−" : "+"}
                {l.amount} 🍪
              </span>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
