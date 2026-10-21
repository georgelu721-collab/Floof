"use client";

import Link from "next/link";
import { useState } from "react";
import { NOTIFICATIONS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { PostCard } from "@/components/PostCard";
import { Page } from "@/components/Shell";
import { BiscuitIcon, IconBell, IconChat, PawIcon } from "@/components/Icons";
import { ClanWarMini } from "@/components/ClanWar";

const TABS = ["For you", "Following", "Moments"] as const;

export default function Home() {
  const { posts, pets, me, s, loadError, reload, ready, signedIn, cloud } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("For you");

  const storyPets = pets.filter((p) => p.id !== me.id).slice(0, 9);
  const feed =
    tab === "Following"
      ? posts.filter((p) => s.following[p.petId] || p.petId === me.id)
      : tab === "Moments"
        ? posts.filter((p) => p.moment)
        : posts;

  return (
    <Page>
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-cream/90 px-4 pb-2 pt-[max(env(safe-area-inset-top),14px)] backdrop-blur">
        <h1 className="flex items-center gap-1 font-display text-[30px] font-bold tracking-tight">
          <PawIcon size={24} className="text-cocoa" /> Floof
        </h1>
        <div className="ml-auto flex items-center gap-1">
          <Link href="/wallet" className="flex items-center gap-1 rounded-full bg-sand px-3 py-1.5 text-sm font-extrabold" aria-label="Biscuit wallet">
            <BiscuitIcon size={20} /> {s.balance}
          </Link>
          <Link href="/notifications" className="relative rounded-full p-2 hover:bg-sand" aria-label="Notifications">
            <IconBell />
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-blush ring-2 ring-cream" />
            <span className="sr-only">{NOTIFICATIONS.length} new</span>
          </Link>
          <Link href="/messages" className="rounded-full p-2 hover:bg-sand" aria-label="Messages">
            <IconChat />
          </Link>
        </div>
      </header>

      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-3 pt-1">
        <Link href="/create?type=story" className="flex w-[70px] shrink-0 flex-col items-center gap-1">
          <span className="relative">
            <PetAvatar pet={me} size={66} ring="seen" />
            <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-cocoa text-sm font-black text-white ring-2 ring-cream">+</span>
          </span>
          <span className="w-full truncate text-center text-xs font-bold">Your story</span>
        </Link>
        {storyPets.map((p, i) => (
          <Link key={p.id} href={`/story/${p.id}`} className="flex w-[70px] shrink-0 flex-col items-center gap-1">
            <PetAvatar pet={p} size={66} ring={i < 6 ? "story" : "seen"} />
            <span className="w-full truncate text-center text-xs font-bold">{p.name}</span>
          </Link>
        ))}
      </div>

      <div className="flex gap-2 px-4 pb-2">
        {TABS.map((t) => (
          <button key={t} className="chip" data-on={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {loadError && (
        <div className="card mx-4 my-4 p-5 text-center">
          <p className="text-3xl">🙀</p>
          <p className="mt-1 font-display text-lg font-semibold">Can&apos;t reach Floof right now</p>
          <p className="text-sm text-muted">Check your connection and try again.</p>
          <button className="btn btn-dark mt-3" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}

      {cloud && ready && !signedIn && !loadError && (
        <Link href="/login?mode=signup" className="card mx-4 my-3 flex items-center gap-3 bg-gradient-to-r from-[#FFE6CC] to-[#FDE4E8] p-4">
          <span className="text-3xl">🐾</span>
          <span className="flex-1">
            <span className="block font-extrabold">Join Floof</span>
            <span className="block text-xs font-semibold text-cocoa-soft">Create your pet&apos;s account to boop, post and send biscuits</span>
          </span>
        </Link>
      )}

      {!loadError && ready && feed.length === 0 && (
        <p className="px-8 py-16 text-center font-semibold text-muted">Nothing here yet — follow some floofs from Explore! 🐾</p>
      )}

      {feed.map((p, i) => (
        <div key={p.id}>
          <PostCard post={p} />
          {i === 1 && <ClanWarMini />}
        </div>
      ))}
    </Page>
  );
}
