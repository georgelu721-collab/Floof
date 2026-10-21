"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { THREADS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { BiscuitSheet } from "@/components/BiscuitSheet";
import { TopBar } from "@/components/Shell";
import { BiscuitIcon, IconSend } from "@/components/Icons";

export default function Thread() {
  const { id } = useParams<{ id: string }>();
  const { pet, s, dispatch, me, cloud } = useStore();
  const [text, setText] = useState("");
  const [sheet, setSheet] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  // `id` is either a seeded thread id or a pet id for a direct message.
  const seeded = cloud ? undefined : (THREADS.find((t) => t.id === id) ?? THREADS.find((t) => t.petIds.length === 1 && t.petIds[0] === id));
  const petIds = seeded ? seeded.petIds : [id];
  const key = seeded ? seeded.id : `dm-${id}`;
  const other = pet(petIds[0]);
  const messages = [...(seeded?.messages ?? []), ...(s.threads[key] ?? [])];
  const sentBiscuits = s.ledger.filter((l) => l.type === "sent" && l.petId === other?.id);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!other) return <TopBar title="Chat not found" />;

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    dispatch({ t: "message", threadId: key, text: text.trim(), petIds });
    setText("");
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <TopBar
        title={
          <Link href={`/profile/${other.handle}`} className="flex items-center gap-2">
            <PetAvatar pet={other} size={34} /> {seeded?.title ?? other.name}
          </Link>
        }
        sub={petIds.length > 1 ? `${petIds.length + 1} floofs` : other.ownerId === null ? "Floof house pet · won’t reply" : "Direct message"}
      />
      <div className="flex-1 space-y-2 px-4 pb-4">
        {messages.map((m) => {
          const mine = m.from === "me";
          const from = mine ? me : pet(m.from);
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
              {!mine && from && <PetAvatar pet={from} size={26} />}
              <div className={`max-w-[75%] rounded-3xl px-4 py-2.5 text-[15px] font-semibold ${mine ? "rounded-br-md bg-cocoa text-white" : "rounded-bl-md bg-paper shadow-sm"}`}>
                {m.text}
                <span className={`ml-2 text-[10px] ${mine ? "text-white/60" : "text-muted"}`}>{m.at}</span>
              </div>
            </div>
          );
        })}
        {sentBiscuits.length > 0 && (
          <p className="pt-2 text-center text-xs font-bold text-muted">
            You&apos;ve sent {other.name} {sentBiscuits.reduce((a, l) => a + l.amount, 0)} biscuits 🍪
          </p>
        )}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="sticky bottom-0 flex items-center gap-2 bg-cream px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-2">
        <button type="button" onClick={() => setSheet(true)} className="rounded-full bg-sand p-2.5" aria-label="Send a biscuit">
          <BiscuitIcon size={22} />
        </button>
        <input className="input" placeholder="Message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
        <button className="rounded-full bg-blush p-2.5 text-white disabled:opacity-40" disabled={!text.trim()} aria-label="Send">
          <IconSend size={20} />
        </button>
      </form>
      {sheet && <BiscuitSheet pet={other} onClose={() => setSheet(false)} />}
    </main>
  );
}
