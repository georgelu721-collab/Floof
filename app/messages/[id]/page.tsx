"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SHARED_POST_RE, THREADS } from "@/lib/data";
import { newUuid, useStore } from "@/lib/store";
import type { Message } from "@/lib/types";
import { PetAvatar, PostMedia } from "@/components/PetArt";
import { BiscuitSheet } from "@/components/BiscuitSheet";
import { TopBar } from "@/components/Shell";
import { BiscuitIcon, IconSend, IconX } from "@/components/Icons";

const REACTIONS = ["❤️", "😂", "😮", "😢", "🐾", "🍪", "👍"];

export default function Thread() {
  const { id } = useParams<{ id: string }>();
  const { pet, s, dispatch, me, cloud } = useStore();
  const [text, setText] = useState("");
  const [sheet, setSheet] = useState(false);
  const [picker, setPicker] = useState<string | null>(null); // message id with the reaction bar open
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const input = useRef<HTMLInputElement>(null);
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
    void dispatch({ t: "message", threadId: key, text: text.trim(), petIds, replyTo: replyTo?.id, id: newUuid() });
    setText("");
    setReplyTo(null);
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
          const quoted = m.replyTo ? messages.find((x) => x.id === m.replyTo) : undefined;
          const counts = Object.values(m.reactions ?? {}).reduce<Record<string, number>>((acc, e) => ((acc[e] = (acc[e] ?? 0) + 1), acc), {});
          const myReaction = m.reactions?.[me.id];
          return (
            <div key={m.id} id={`m-${m.id}`} className={`relative flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
              {!mine && from && <PetAvatar pet={from} size={26} />}
              <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                {quoted && (
                  <button
                    className={`mb-0.5 max-w-full truncate rounded-2xl border-l-4 border-peach bg-sand/70 px-3 py-1 text-left text-xs font-semibold text-cocoa-soft`}
                    onClick={() => document.getElementById(`m-${quoted.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  >
                    ↩ {quoted.from === "me" ? "You" : (pet(quoted.from)?.name ?? "")}: {quoted.text.replace(/https?:\/\/\S+/g, "🔗")}
                  </button>
                )}
                <LongPress onLong={() => setPicker(m.id)}>
                  <MessageBody text={m.text} at={m.at} mine={mine} />
                </LongPress>
                {Object.keys(counts).length > 0 && (
                  <div className={`-mt-1.5 flex gap-1 ${mine ? "mr-2" : "ml-2"}`}>
                    {Object.entries(counts).map(([e, n]) => (
                      <button
                        key={e}
                        onClick={() => void dispatch({ t: "react", threadId: key, messageId: m.id, emoji: myReaction === e ? null : e })}
                        className={`rounded-full px-1.5 py-0.5 text-xs shadow-sm ${myReaction === e ? "bg-blush-soft ring-1 ring-blush" : "bg-paper"}`}
                      >
                        {e}
                        {n > 1 ? ` ${n}` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {picker === m.id && (
                <div className={`absolute top-full z-20 mt-1 flex items-center gap-1 rounded-full bg-paper px-2 py-1.5 shadow-lg ${mine ? "right-0" : "left-8"}`}>
                  {REACTIONS.map((e) => (
                    <button
                      key={e}
                      className={`rounded-full px-1 text-xl transition hover:scale-125 ${myReaction === e ? "bg-blush-soft" : ""}`}
                      onClick={() => {
                        void dispatch({ t: "react", threadId: key, messageId: m.id, emoji: myReaction === e ? null : e });
                        setPicker(null);
                      }}
                      aria-label={`React ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                  <button
                    className="ml-1 rounded-full bg-sand px-2.5 py-1 text-xs font-extrabold"
                    onClick={() => {
                      setReplyTo(m);
                      setPicker(null);
                      setTimeout(() => input.current?.focus(), 0);
                    }}
                  >
                    Reply
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {picker && <div className="fixed inset-0 z-10" onClick={() => setPicker(null)} />}
        {messages.length > 0 && <p className="pt-1 text-center text-[11px] font-semibold text-muted">Press and hold a message to react or reply</p>}
        {sentBiscuits.length > 0 && (
          <p className="pt-2 text-center text-xs font-bold text-muted">
            You&apos;ve sent {other.name} {sentBiscuits.reduce((a, l) => a + l.amount, 0)} biscuits 🍪
          </p>
        )}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="sticky bottom-0 bg-cream px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-2">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl border-l-4 border-peach bg-sand px-3 py-1.5 text-xs font-semibold">
            <span className="min-w-0 flex-1 truncate">
              Replying to {replyTo.from === "me" ? "yourself" : pet(replyTo.from)?.name}: {replyTo.text}
            </span>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
              <IconX size={14} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSheet(true)} className="rounded-full bg-sand p-2.5" aria-label="Send a biscuit">
            <BiscuitIcon size={22} />
          </button>
          <input ref={input} className="input" placeholder="Message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
          <button className="rounded-full bg-blush p-2.5 text-white disabled:opacity-40" disabled={!text.trim()} aria-label="Send">
            <IconSend size={20} />
          </button>
        </div>
      </form>
      {sheet && <BiscuitSheet pet={other} onClose={() => setSheet(false)} />}
    </main>
  );
}

/** Press and hold (or double-click) to open the reaction bar. */
function LongPress({ onLong, children }: { onLong: () => void; children: React.ReactNode }) {
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <div
      className="select-none [-webkit-touch-callout:none]"
      onPointerDown={() => {
        clear();
        timer.current = window.setTimeout(onLong, 420);
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onDoubleClick={onLong}
      onContextMenu={(e) => {
        e.preventDefault();
        onLong();
      }}
    >
      {children}
    </div>
  );
}

/** A chat bubble; Floof post links become a tappable post preview. */
function MessageBody({ text, at, mine }: { text: string; at: string; mine: boolean }) {
  const { post, pet } = useStore();
  const match = text.match(SHARED_POST_RE);
  const shared = match ? post(match[1]) : undefined;
  const owner = shared ? pet(shared.petId) : undefined;
  const words = (match ? text.replace(match[0], "") : text).trim();
  const bubble = `max-w-full rounded-3xl text-[15px] font-semibold ${mine ? "rounded-br-md bg-cocoa text-white" : "rounded-bl-md bg-paper shadow-sm"}`;
  const time = <span className={`ml-2 text-[10px] ${mine ? "text-white/60" : "text-muted"}`}>{at}</span>;

  if (!shared || !owner) {
    return (
      <div className={`${bubble} whitespace-pre-line break-words px-4 py-2.5`}>
        {text}
        {time}
      </div>
    );
  }
  return (
    <div className={`${bubble} w-60 overflow-hidden p-1.5`}>
      <Link href={`/post/${shared.id}`} className="block overflow-hidden rounded-[1.25rem] bg-paper text-cocoa">
        <div className="flex items-center gap-2 px-3 py-2">
          <PetAvatar pet={owner} size={24} />
          <span className="truncate text-xs font-extrabold">{owner.handle}</span>
        </div>
        <PostMedia post={shared} pet={owner} className="aspect-square" />
        <p className="line-clamp-2 px-3 py-2 text-xs font-semibold">{shared.caption}</p>
      </Link>
      {words && <p className="whitespace-pre-line break-words px-2.5 pb-1 pt-2">{words}</p>}
      <p className="px-2.5 pb-1 text-right">{time}</p>
    </div>
  );
}
