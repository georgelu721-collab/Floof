"use client";

import Link from "next/link";
import { useState } from "react";
import { MEETUPS, PACKS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { PetAvatar, PetScene } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";
import { IconCalendar, IconPin, IconShield } from "@/components/Icons";

const FILTERS = ["All", "Events", "Meetups", "For my pet"] as const;

export default function Meetups() {
  const { s, dispatch, pet, me, toast } = useStore();
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");

  const list = MEETUPS.filter((m) =>
    f === "Events" ? m.kind === "event" : f === "Meetups" ? m.kind === "meetup" : f === "For my pet" ? !m.forSpecies || m.forSpecies.includes(me.species) : true,
  );

  return (
    <Page>
      <TopBar title="Meetups" sub="Real pets. Real people. Always opt-in." />

      {!s.meetupsOptIn ? (
        <section className="card mx-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E2F0DA] text-sage">
              <IconShield />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">Meetups are opt-in</p>
              <p className="text-sm font-semibold text-muted">You choose if and when you're visible.</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm font-semibold text-cocoa-soft">
            <li>📍 Only public places — parks, beaches, cafes, expos</li>
            <li>🙈 We never show your home or exact location</li>
            <li>✅ Hosts are verified pet parents</li>
            <li>🚪 Leave any time from Settings</li>
          </ul>
          <button
            className="btn btn-dark mt-4 w-full"
            onClick={() => {
              dispatch({ t: "meetupsOptIn", on: true });
              toast("Meetups turned on 🐾");
            }}
          >
            Turn on meetups
          </button>
        </section>
      ) : (
        <div className="mx-4 flex items-center justify-between rounded-2xl bg-[#E2F0DA] px-4 py-2.5 text-sm font-bold">
          <span>✅ You&apos;re opted in to meetups</span>
          <button className="text-cocoa-soft underline" onClick={() => dispatch({ t: "meetupsOptIn", on: false })}>
            Turn off
          </button>
        </div>
      )}

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-5">
        {FILTERS.map((x) => (
          <button key={x} className="chip" data-on={f === x} onClick={() => setF(x)}>
            {x}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4 pt-4">
        {list.map((m) => {
          const hero = pet(m.heroPetId)!;
          const st = s.events[m.id];
          return (
            <div key={m.id} className="card flex gap-3 p-3">
              <Link href={`/meetups/${m.id}`} className="shrink-0">
                <PetScene usePhoto pet={hero} scene={m.scene} className="h-24 w-24 rounded-2xl" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/meetups/${m.id}`}>
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-blush">{m.kind}</p>
                  <p className="truncate font-extrabold">{m.title}</p>
                  <p className="flex items-center gap-1 text-xs font-semibold text-muted">
                    <IconCalendar size={13} /> {m.date} · {m.time}{m.recurring ? ` · 🔁 ${m.recurring}` : ""}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs font-semibold text-muted">
                    <IconPin size={13} /> {m.place}
                  </p>
                </Link>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {m.attendees.slice(0, 4).map((a) => (
                      <PetAvatar key={a} pet={pet(a)!} size={24} />
                    ))}
                    <span className="pl-3 text-xs font-bold text-muted">{m.going + (st === "going" ? 1 : 0)} going</span>
                  </div>
                  <button
                    disabled={!s.meetupsOptIn}
                    onClick={() => {
                      dispatch({ t: "event", id: m.id, status: st === "going" ? null : "going" });
                      if (st !== "going") toast(`You're going to ${m.title}! 🎉`);
                    }}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold disabled:opacity-40 ${st === "going" ? "bg-sage text-white" : "bg-cocoa text-white"}`}
                  >
                    {st === "going" ? "Going ✓" : "Join"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <SectionTitle>Packs near you</SectionTitle>
      <div className="space-y-3 px-4">
        {PACKS.map((p) => {
          const lead = pet(p.petId)!;
          const joined = !!s.packs[p.id];
          return (
            <div key={p.id} className="flex items-center gap-3">
              <PetAvatar pet={lead} size={52} />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{p.name}</p>
                <p className="text-xs font-semibold text-muted">{p.members}</p>
                <div className="mt-1 flex gap-1">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => dispatch({ t: "pack", id: p.id })}
                className={`rounded-full px-4 py-1.5 text-sm font-extrabold ${joined ? "bg-sand text-cocoa-soft" : "bg-blush text-white"}`}
              >
                {joined ? "Joined" : "Join"}
              </button>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
