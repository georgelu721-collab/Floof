"use client";

import { useState } from "react";
import { MEETUPS } from "@/lib/data";
import { addDays, dayKey } from "@/lib/daily";
import { newUuid, useStore } from "@/lib/store";
import type { Pet } from "@/lib/types";
import { PetAvatar } from "./PetArt";
import { Sheet } from "./Sheet";

const PLACES = [...new Set(MEETUPS.map((m) => m.place)), "Local dog park", "Beach walk", "Café with outdoor seating"];

/** Invite another pet to a playdate. */
export function PlaydateSheet({ pet, onClose }: { pet: Pet; onClose: () => void }) {
  const { me, dispatch, toast } = useStore();
  const [date, setDate] = useState(addDays(dayKey(), 2));
  const [time, setTime] = useState("10:00");
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!place.trim()) return toast("Where should you meet?");
    const startsAt = new Date(`${date}T${time}`).getTime();
    if (!startsAt || startsAt < Date.now()) return toast("Pick a time in the future");
    setBusy(true);
    const ok = await dispatch({
      t: "invitePlaydate",
      playdate: { id: newUuid(), fromPet: me.id, toPet: pet.id, place: place.trim(), startsAt, note: note.trim(), status: "pending" },
    });
    setBusy(false);
    if (ok) {
      toast(`Playdate invite sent to ${pet.name} 🎾`);
      onClose();
    }
  };

  return (
    <Sheet title="Invite to a playdate" onClose={onClose}>
      <div className="mb-4 flex items-center justify-center gap-3">
        <PetAvatar pet={me} size={52} />
        <span className="text-2xl">🎾</span>
        <PetAvatar pet={pet} size={52} />
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="date" min={dayKey()} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
        </div>
        <input className="input" placeholder="Where? e.g. Centennial Park" value={place} maxLength={100} onChange={(e) => setPlace(e.target.value)} list="playdate-places" />
        <datalist id="playdate-places">
          {PLACES.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {PLACES.slice(0, 5).map((p) => (
            <button key={p} className="chip" data-on={place === p} onClick={() => setPlace(p)}>
              {p}
            </button>
          ))}
        </div>
        <textarea className="input min-h-20 !rounded-3xl" placeholder="Add a note (optional)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        <p className="px-2 text-xs font-semibold text-muted">Tip: meet somewhere public for a first playdate.</p>
        <button className="btn btn-dark w-full" onClick={send} disabled={busy}>
          {busy ? "Sending…" : `Invite ${pet.name}`}
        </button>
      </div>
    </Sheet>
  );
}
