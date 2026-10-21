"use client";

import Link from "next/link";
import { useState } from "react";
import { formatAUD } from "@/lib/data";
import { useStore } from "@/lib/store";
import type { Pet } from "@/lib/types";
import { BiscuitIcon, IconX } from "./Icons";
import { PetAvatar } from "./PetArt";

const AMOUNTS = [1, 5, 10];

export function BiscuitSheet({ pet, onClose, onSent }: { pet: Pet; onClose: () => void; onSent?: (n: number) => void }) {
  const { s, dispatch, toast, me } = useStore();
  const [amount, setAmount] = useState(1);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  const isMe = pet.id === me.id;
  const tooMuch = amount > s.balance;

  const send = () => {
    if (tooMuch || isMe) return;
    dispatch({ t: "sendBiscuits", petId: pet.id, amount, note: note.trim() || undefined });
    setSent(amount);
    onSent?.(amount);
    toast(`Sent ${amount} biscuit${amount > 1 ? "s" : ""} to ${pet.name} 🍪`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cocoa/40" onClick={onClose}>
      <div
        className="animate-sheet relative w-full max-w-[440px] rounded-t-[2rem] bg-paper px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Send biscuits to ${pet.name}`}
      >
        <button onClick={onClose} className="absolute left-4 top-4 rounded-full p-2 text-muted hover:bg-sand" aria-label="Close">
          <IconX />
        </button>
        {sent ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="relative">
              <PetAvatar pet={pet} size={96} ring="story" />
              {Array.from({ length: Math.min(sent, 10) }, (_, i) => (
                <span key={i} className="animate-float-up absolute left-1/2 top-1/2" style={{ animationDelay: `${i * 90}ms`, marginLeft: (i % 5) * 14 - 28 }}>
                  <BiscuitIcon size={26} />
                </span>
              ))}
            </div>
            <h3 className="mt-5 font-display text-2xl font-semibold">Biscuit{sent > 1 ? "s" : ""} delivered!</h3>
            <p className="mt-1 text-cocoa-soft">
              {pet.name} got {sent} biscuit{sent > 1 ? "s" : ""} ({formatAUD(sent)}). You two are getting closer 💛
            </p>
            <button className="btn btn-dark mt-6 w-full" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <BiscuitIcon size={40} className="animate-wiggle" />
            <h3 className="mt-1 font-display text-[28px] font-semibold">Biscuits</h3>
            <p className="text-cocoa-soft">
              Send a biscuit to <b>{pet.name}</b>! 1 biscuit = 10c
            </p>
            <div className="my-5 flex items-center gap-3">
              <PetAvatar pet={pet} size={56} ring="story" />
              <div className="text-left">
                <p className="font-bold">{pet.name}</p>
                <p className="text-sm text-muted">@{pet.handle}</p>
              </div>
            </div>
            <div className="grid w-full grid-cols-3 gap-3">
              {AMOUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setAmount(n)}
                  className={`rounded-2xl py-3 font-display text-lg font-semibold transition ${amount === n ? "bg-cocoa text-white" : "bg-sand"}`}
                >
                  {n} 🍪
                  <span className={`block text-xs font-sans font-bold ${amount === n ? "text-white/70" : "text-muted"}`}>{formatAUD(n)}</span>
                </button>
              ))}
            </div>
            <input
              className="input mt-4"
              placeholder="Add a note (optional)"
              maxLength={60}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="mt-4 text-sm text-muted">
              Your balance: <b className="text-cocoa">{s.balance} biscuits</b> ({formatAUD(s.balance)})
            </p>
            {isMe ? (
              <p className="mt-3 text-sm font-bold text-blush">You can't send biscuits to yourself, silly 🐾</p>
            ) : tooMuch ? (
              <Link href="/wallet" className="btn btn-pink mt-4 w-full">
                Top up biscuits
              </Link>
            ) : (
              <button className="btn btn-dark mt-4 w-full text-lg" onClick={send}>
                Send {amount} Biscuit{amount > 1 ? "s" : ""}
              </button>
            )}
            <p className="mt-4 text-xs text-muted">
              Powered by <b className="text-cocoa">Lyca Marketplace</b> · biscuits can be spent on pet treats & services
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
