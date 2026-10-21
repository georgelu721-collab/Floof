"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Playdate } from "@/lib/types";
import { PetAvatar } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";
import { IconCalendar, IconPin } from "@/components/Icons";

const fmt = (t: number) =>
  new Date(t).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function Playdates() {
  const { s, me, signedIn, dispatch, toast, pet } = useStore();
  const [showPast, setShowPast] = useState(false);
  if (!signedIn) {
    return (
      <Page>
        <TopBar title="Playdates" />
        <p className="px-8 py-16 text-center font-semibold text-muted">
          <Link href="/login" className="text-blush">
            Log in
          </Link>{" "}
          to plan playdates.
        </p>
      </Page>
    );
  }
  const now = Date.now();
  const mine = s.playdates.filter((p) => p.fromPet === me.id || p.toPet === me.id);
  const requests = mine.filter((p) => p.toPet === me.id && p.status === "pending" && p.startsAt > now);
  const upcoming = mine.filter((p) => p.status === "accepted" && p.startsAt > now - 3 * 3600_000).sort((a, b) => a.startsAt - b.startsAt);
  const sent = mine.filter((p) => p.fromPet === me.id && p.status === "pending" && p.startsAt > now);
  const past = mine.filter((p) => !requests.includes(p) && !upcoming.includes(p) && !sent.includes(p));

  const Row = ({ p, children }: { p: Playdate; children?: React.ReactNode }) => {
    const other = pet(p.fromPet === me.id ? p.toPet : p.fromPet);
    if (!other) return null;
    return (
      <div className="card flex gap-3 p-3">
        <Link href={`/profile/${other.handle}`}>
          <PetAvatar pet={other} size={48} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">
            {p.fromPet === me.id ? `You → ${other.name}` : `${other.name} → you`}
            {p.status !== "pending" && p.status !== "accepted" && <span className="ml-2 text-xs font-bold capitalize text-muted">{p.status}</span>}
          </p>
          <p className="flex items-center gap-1 text-xs font-semibold text-muted">
            <IconCalendar size={12} /> {fmt(p.startsAt)}
          </p>
          <p className="flex items-center gap-1 truncate text-xs font-semibold text-muted">
            <IconPin size={12} /> {p.place}
          </p>
          {p.note && <p className="mt-1 text-sm">“{p.note}”</p>}
          {children && <div className="mt-2 flex gap-2">{children}</div>}
        </div>
      </div>
    );
  };

  const set = async (p: Playdate, status: Playdate["status"], msg: string) => {
    if (await dispatch({ t: "playdateStatus", id: p.id, status })) toast(msg);
  };

  return (
    <Page>
      <TopBar title="Playdates" sub="Invite friends from their profile 🎾" />
      {requests.length > 0 && (
        <>
          <SectionTitle>Invitations</SectionTitle>
          <div className="space-y-2 px-4">
            {requests.map((p) => (
              <Row key={p.id} p={p}>
                <button className="rounded-full bg-sage px-4 py-1.5 text-xs font-extrabold text-white" onClick={() => set(p, "accepted", "Playdate accepted 🎉")}>
                  Accept
                </button>
                <button className="rounded-full bg-sand px-4 py-1.5 text-xs font-extrabold" onClick={() => set(p, "declined", "Declined")}>
                  Decline
                </button>
              </Row>
            ))}
          </div>
        </>
      )}
      <SectionTitle>Upcoming</SectionTitle>
      <div className="space-y-2 px-4">
        {upcoming.map((p) => (
          <Row key={p.id} p={p}>
            <Link href={`/messages/${p.fromPet === me.id ? p.toPet : p.fromPet}`} className="rounded-full bg-sand px-4 py-1.5 text-xs font-extrabold">
              Message
            </Link>
            {p.fromPet === me.id && (
              <button className="rounded-full bg-sand px-4 py-1.5 text-xs font-extrabold text-blush" onClick={() => set(p, "cancelled", "Playdate cancelled")}>
                Cancel
              </button>
            )}
          </Row>
        ))}
        {upcoming.length === 0 && <p className="py-4 text-center text-sm font-semibold text-muted">No playdates planned yet. Find a friend and tap 🎾 on their profile.</p>}
      </div>
      {sent.length > 0 && (
        <>
          <SectionTitle>Waiting for a reply</SectionTitle>
          <div className="space-y-2 px-4">
            {sent.map((p) => (
              <Row key={p.id} p={p}>
                <button className="rounded-full bg-sand px-4 py-1.5 text-xs font-extrabold" onClick={() => set(p, "cancelled", "Invite cancelled")}>
                  Cancel invite
                </button>
              </Row>
            ))}
          </div>
        </>
      )}
      {past.length > 0 && (
        <div className="px-4 pt-6">
          <button className="text-sm font-extrabold text-muted" onClick={() => setShowPast((x) => !x)}>
            {showPast ? "Hide" : "Show"} past & declined ({past.length})
          </button>
          {showPast && (
            <div className="mt-2 space-y-2 opacity-70">
              {past.map((p) => (
                <Row key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
