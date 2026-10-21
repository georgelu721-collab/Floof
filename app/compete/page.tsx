"use client";

import Link from "next/link";
import { useState } from "react";
import { MEETUPS, compact } from "@/lib/data";
import { allCompetitions } from "@/lib/daily";
import { useStore } from "@/lib/store";
import { PetAvatar, PetScene } from "@/components/PetArt";
import { Page, SectionTitle } from "@/components/Shell";
import { ClanWarMini } from "@/components/ClanWar";
import { IconCalendar, IconChevron, IconPin } from "@/components/Icons";

const TABS = ["active", "upcoming", "past"] as const;

export default function Compete() {
  const { pet, me, bestFriends, pawScore } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("active");
  const bf = bestFriends(me.id)[0];

  return (
    <Page>
      <header className="px-4 pb-2 pt-[max(env(safe-area-inset-top),18px)]">
        <h1 className="font-display text-[30px] font-bold">Compete & Meet</h1>
        <p className="text-sm font-semibold text-muted">Friendly competitions, clan wars and opt-in meetups</p>
      </header>

      <div className="pt-3">
        <ClanWarMini />
      </div>

      <Link href="/friends" className="card mx-4 flex items-center gap-4 p-4">
        <span className="text-3xl">👑</span>
        <div className="flex-1">
          <p className="font-display text-lg font-semibold leading-tight">{bf ? `${me.name}'s Best Friend` : "Find a best friend"}</p>
          <p className="text-sm font-semibold text-muted">
            {bf ? `${bf.pet.name} 💛 · ${bf.streak}🔥 streak` : "Boop, comment and send biscuits!"} · PawScore {pawScore(me.id).toLocaleString()}
          </p>
        </div>
        {bf && <PetAvatar pet={bf.pet} size={48} ring="story" />}
      </Link>

      <SectionTitle>Competitions</SectionTitle>
      <div className="flex gap-2 px-4 pb-3">
        {TABS.map((t) => (
          <button key={t} className="chip capitalize" data-on={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-3 px-4">
        {allCompetitions().filter((c) => c.status === tab).map((c) => {
          const hero = pet(c.heroPetId)!;
          return (
            <Link key={c.id} href={`/competitions/${c.id}`} className="relative block h-40 overflow-hidden rounded-3xl">
              <PetScene usePhoto pet={hero} scene={c.scene} accessory={c.accessory} className="absolute inset-0 h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-r from-cocoa/85 via-cocoa/50 to-transparent" />
              <div className="relative flex h-full max-w-[65%] flex-col justify-center p-5 text-white">
                {c.id.startsWith("season-") && <span className="mb-1 w-max rounded-full bg-butter px-2 py-0.5 text-[10px] font-extrabold uppercase text-cocoa">This month</span>}
                <h3 className="font-display text-xl font-semibold leading-tight">{c.title}</h3>
                <p className="mt-1 text-sm font-semibold text-white/80">
                  {c.status === "active" ? `Ends in ${c.endsInDays} days` : c.status === "upcoming" ? `Starts in ${c.endsInDays} days` : `Winner: ${pet(c.winnerPetId!)?.name}`}
                </p>
                <span className="mt-3 w-max rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-cocoa">View details</span>
              </div>
            </Link>
          );
        })}
      </div>

      <SectionTitle
        action={
          <Link href="/meetups" className="text-sm font-extrabold text-blush">
            See all
          </Link>
        }
      >
        Meetups & Events
      </SectionTitle>
      <div className="space-y-3 px-4">
        {MEETUPS.slice(0, 3).map((m) => {
          const hero = pet(m.heroPetId)!;
          return (
            <Link key={m.id} href={`/meetups/${m.id}`} className="card flex items-center gap-3 p-3">
              <PetScene usePhoto pet={hero} scene={m.scene} className="h-16 w-16 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{m.title}</p>
                <p className="flex items-center gap-1 text-xs font-semibold text-muted">
                  <IconCalendar size={13} /> {m.date} · {m.time}{m.recurring ? ` · 🔁 ${m.recurring}` : ""}
                </p>
                <p className="flex items-center gap-1 truncate text-xs font-semibold text-muted">
                  <IconPin size={13} /> {m.place} · {compact(m.interested)} interested
                </p>
              </div>
              <IconChevron className="text-muted" />
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
