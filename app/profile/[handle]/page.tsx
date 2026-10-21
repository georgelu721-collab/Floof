"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { compact, MOMENT_TYPES } from "@/lib/data";
import { badgesFor } from "@/lib/badges";
import { useStore } from "@/lib/store";
import type { MomentType } from "@/lib/types";
import { PetAvatar, PostMedia } from "@/components/PetArt";
import { BiscuitSheet } from "@/components/BiscuitSheet";
import { Page, TopBar } from "@/components/Shell";
import { BiscuitIcon, IconBookmark, IconChevron, IconChevronDown, IconGrid, IconSettings, IconStar, IconTag } from "@/components/Icons";
import { PetSwitcher } from "@/components/PetSwitcher";
import { PlaydateSheet } from "@/components/PlaydateSheet";
import { breedSlug } from "@/lib/breeds";

const TABS = [
  { id: "floofs", icon: <IconGrid size={20} /> },
  { id: "moments", icon: <IconStar size={20} /> },
  { id: "tagged", icon: <IconTag size={20} /> },
  { id: "saved", icon: <IconBookmark size={20} /> },
] as const;

export default function Profile() {
  const { handle } = useParams<{ handle: string }>();
  const router = useRouter();
  const { pets, posts, me, s, dispatch, bestFriends, pawScore, ready, cloud, level, streak, alerts, pawFivedToday, toast } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("floofs");
  const [sheet, setSheet] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [playdate, setPlaydate] = useState(false);
  const [pawAnim, setPawAnim] = useState(false);
  const pet = me.handle === decodeURIComponent(handle) ? me : pets.find((p) => p.handle === decodeURIComponent(handle));

  if (!pet) {
    return (
      <Page>
        <TopBar title="Profile" />
        <p className="px-8 py-20 text-center font-semibold text-muted">{ready ? "No floof by that name 🐾" : "Loading…"}</p>
      </Page>
    );
  }

  const isMe = pet.id === me.id;
  const following = !!s.following[pet.id];
  const theirPosts = posts.filter((p) => p.petId === pet.id);
  const moments = theirPosts.filter((p) => p.moment);
  const friends = bestFriends(pet.id);
  const bf = friends[0];
  const followers = pet.followers + (following && !isMe ? 1 : 0);
  const shown =
    tab === "floofs"
      ? theirPosts
      : tab === "moments"
        ? moments
        : tab === "tagged"
          ? posts.filter((p) => p.taggedPets?.includes(pet.id))
          : posts.filter((p) => s.saved[p.id]);
  const badges = badgesFor({
    posts: theirPosts.length,
    boops: theirPosts.reduce((a, p) => a + p.boops, 0),
    biscuitsSent: isMe ? s.ledger.filter((l) => l.type === "sent").reduce((a, l) => a + l.amount, 0) : 10,
    events: isMe ? Object.keys(s.events).length : 1,
    moments: moments.map((p) => p.moment!) as MomentType[],
    clan: isMe ? !!s.clan : true,
    friends: friends.length,
    bestStreak: isMe ? streak.best : 0,
    dailyAnswers: theirPosts.filter((p) => p.dailyDate).length,
    helped: isMe && alerts.some((a) => a.reporterId === me.id && a.kind === "found"),
    careReminders: isMe ? s.reminders.length : 0,
  }).filter((b) => b.earned);
  const lvl = level(pet.id);
  const latestMoment = moments[0];

  return (
    <Page>
      <TopBar
        title={
          isMe ? (
            <button className="flex items-center gap-1" onClick={() => setSwitcher(true)} aria-label="Switch pet">
              {pet.handle}
              <IconChevronDown size={18} />
            </button>
          ) : (
            <span className="flex items-center gap-1">
              {pet.handle}
              {pet.verified && <span className="text-sm text-sky">●</span>}
            </span>
          )
        }
        back={!isMe}
        right={
          isMe && (
            <Link href="/settings/profile" className="rounded-full p-2 hover:bg-sand" aria-label="Settings">
              <IconSettings />
            </Link>
          )
        }
      />

      <section className="px-5">
        <div className="flex items-center gap-5">
          <PetAvatar pet={pet} size={92} ring="story" />
          <div className="grid flex-1 grid-cols-3 text-center">
            <Stat n={pet.postCount ?? (pet.owner === "You" ? 0 : 100 + (pet.pawScore % 200)) + theirPosts.length} label="Floofs" />
            <Stat n={followers} label="Followers" href={`/profile/${pet.handle}/followers`} />
            <Stat
              n={isMe ? (cloud ? Object.keys(s.following).length : pet.following + Object.keys(s.following).length) : pet.following}
              label="Following"
              href={`/profile/${pet.handle}/following`}
            />
          </div>
        </div>

        <h2 className="mt-3 flex items-center gap-1 font-display text-xl font-semibold">
          {pet.name} <span className="text-blush">♡</span>
          {pet.clan && <span className="ml-1 rounded-full bg-sand px-2 py-0.5 text-[11px] font-extrabold">{pet.clan === "cats" ? "🐱 Team Cats" : "🐶 Team Dogs"}</span>}
          <Link href={`/pawscore/${pet.handle}`} className="rounded-full bg-[#FFF1C9] px-2 py-0.5 text-[11px] font-extrabold">
            Lv {lvl.level} · {lvl.tier}
          </Link>
        </h2>
        <p className="text-sm font-semibold text-muted">
          {pet.breed ? (
            <Link href={`/breeds/${breedSlug(pet.breed)}`} className="underline decoration-oat underline-offset-2">
              {pet.breed}
            </Link>
          ) : null}
          {[pet.age, pet.city].filter(Boolean).map((x) => ` · ${x}`)}
        </p>
        {(pet.personality || isMe) && (
          <Link href={isMe ? "/quiz" : `/quiz?pet=${pet.handle}`} className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#EFE8FB] px-2.5 py-1 text-xs font-extrabold">
            {pet.personality ? `✨ ${pet.personality}` : "✨ Take the personality quiz"}
          </Link>
        )}
        {pet.bio.map((b) => (
          <p key={b} className="text-[15px]">
            {b}
          </p>
        ))}

        <div className="mt-3 flex flex-wrap gap-2">
          {latestMoment && (
            <Link href={`/post/${latestMoment.id}`} className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: MOMENT_TYPES[latestMoment.moment!].tint }}>
              <span className="text-xl">{MOMENT_TYPES[latestMoment.moment!].emoji}</span>
              <span className="text-xs font-extrabold leading-tight">
                First Pet Moment
                <br />
                <span className="font-bold text-cocoa-soft">{MOMENT_TYPES[latestMoment.moment!].title.replace(/^First /, "")}</span>
              </span>
            </Link>
          )}
          {bf && (
            <Link href={isMe ? "/friends" : `/profile/${bf.pet.handle}`} className="flex items-center gap-2 rounded-2xl bg-[#FFF0B8] px-3 py-2">
              <PetAvatar pet={bf.pet} size={26} />
              <span className="text-xs font-extrabold leading-tight">
                {pet.name}&apos;s Best Friend 💛
                <br />
                <span className="font-bold text-cocoa-soft">
                  {bf.pet.name} {bf.streak > 0 && `· ${bf.streak}🔥`}
                </span>
              </span>
            </Link>
          )}
        </div>

        {isMe ? (
          <div className="mt-4 space-y-2">
            <Link href="/settings/profile" className="btn btn-soft w-full !py-2.5">
              Edit profile
            </Link>
            <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] font-extrabold">
              <Link href="/wallet" className="flex flex-col items-center gap-0.5 rounded-2xl bg-sand py-2">
                <BiscuitIcon size={20} /> {pet.biscuitsReceived}
              </Link>
              <Link href="/moments" className="flex flex-col items-center gap-0.5 rounded-2xl bg-sand py-2">
                <span className="text-lg leading-5">✨</span> Moments
              </Link>
              <Link href="/care" className="flex flex-col items-center gap-0.5 rounded-2xl bg-sand py-2">
                <span className="text-lg leading-5">🩺</span> Care
              </Link>
              <Link href="/recap" className="flex flex-col items-center gap-0.5 rounded-2xl bg-sand py-2">
                <span className="text-lg leading-5">📊</span> Recap
              </Link>
              <Link href="/playdates" className="flex flex-col items-center gap-0.5 rounded-2xl bg-sand py-2">
                <span className="text-lg leading-5">🎾</span> Playdates
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
            <button className={`btn !py-2.5 ${following ? "btn-soft" : "btn-pink"}`} onClick={() => dispatch({ t: "follow", petId: pet.id })}>
              {following ? "Following" : "Follow"}
            </button>
            <Link href={`/messages/${pet.id}`} className="btn btn-soft !py-2.5">
              Message
            </Link>
            <button className="btn btn-soft !px-3.5 !py-2.5" onClick={() => setSheet(true)} aria-label={`Send ${pet.name} a biscuit`}>
              <BiscuitIcon size={20} />
            </button>
            <button
              className={`btn col-span-2 !py-2.5 text-sm ${pawFivedToday(pet.id) ? "btn-soft opacity-70" : "btn-soft"}`}
              disabled={pawFivedToday(pet.id)}
              onClick={async () => {
                if (await dispatch({ t: "pawFive", petId: pet.id })) {
                  setPawAnim(true);
                  setTimeout(() => setPawAnim(false), 1200);
                  toast(`Paw-five sent to ${pet.name}! 🐾`);
                }
              }}
            >
              {pawFivedToday(pet.id) ? "🐾 Paw-fived today" : "🐾 Paw-five"}
            </button>
            <button className="btn btn-soft !px-3.5 !py-2.5" onClick={() => setPlaydate(true)} aria-label={`Invite ${pet.name} to a playdate`}>
              🎾
            </button>
          </div>
        )}

        <Link
          href={`/pawscore/${pet.handle}`}
          className="mt-4 flex items-center justify-between rounded-2xl bg-paper px-4 py-3 shadow-sm transition active:scale-[.99]"
        >
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">PawScore</p>
            <p className="font-display text-2xl font-semibold">{pawScore(pet.id).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2 text-right text-xs font-bold text-muted">
            <div>
              <p>{compact(pet.biscuitsReceived)} biscuits received</p>
              <p>{friends.length} close friends</p>
            </div>
            <IconChevron size={18} />
          </div>
        </Link>
      </section>

      {badges.length > 0 && (
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-5 pt-5">
          {badges.map((b) => (
            <div key={b.id} className="flex w-16 shrink-0 flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full text-2xl" style={{ background: b.tint }}>
                {b.emoji}
              </span>
              <span className="mt-1 text-[11px] font-bold leading-tight">{b.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex border-b border-oat">
        {TABS.filter((t) => t.id !== "saved" || isMe).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 justify-center border-b-2 py-3 ${tab === t.id ? "border-cocoa text-cocoa" : "border-transparent text-muted"}`}
            aria-label={t.id}
          >
            {t.icon}
          </button>
        ))}
      </div>
      {tab === "saved" && isMe && (
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-3">
          {s.collections.map((c) => {
            const cover = posts.find((x) => x.id === c.postIds[c.postIds.length - 1]);
            return (
              <Link key={c.id} href={`/collections/${c.id}`} className="w-24 shrink-0">
                {cover && pets.find((x) => x.id === cover.petId) ? (
                  <PostMedia post={cover} pet={pets.find((x) => x.id === cover.petId)!} className="aspect-square rounded-2xl" />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-2xl bg-sand text-2xl">🔖</div>
                )}
                <p className="mt-1 truncate text-xs font-extrabold">{c.name}</p>
                <p className="text-[11px] font-semibold text-muted">{c.postIds.length}</p>
              </Link>
            );
          })}
          {s.collections.length === 0 && <p className="text-xs font-semibold text-muted">Tip: when you save a floof you can add it to a collection.</p>}
        </div>
      )}
      <div className="grid grid-cols-3 gap-0.5">
        {shown.map((p) => (
          <Link key={p.id} href={`/post/${p.id}`} className="relative">
            <PostMedia post={p} pet={pets.find((x) => x.id === p.petId)!} className="aspect-square" />
            {p.moment && <span className="absolute right-1 top-1 text-sm">{MOMENT_TYPES[p.moment].emoji}</span>}
          </Link>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="px-8 py-12 text-center font-semibold text-muted">
          {tab === "saved" ? "Nothing saved yet" : tab === "tagged" ? `No floofs tagging ${pet.name} yet` : isMe ? "Post your first floof! 🐾" : "No floofs yet"}
        </p>
      )}
      {sheet && <BiscuitSheet pet={pet} onClose={() => setSheet(false)} />}
      {switcher && <PetSwitcher onClose={() => setSwitcher(false)} />}
      {pawAnim && <div className="animate-float-up pointer-events-none fixed left-1/2 top-1/2 z-50 -ml-8 text-6xl">🐾</div>}
      {playdate && <PlaydateSheet pet={pet} onClose={() => setPlaydate(false)} />}
    </Page>
  );
}

function Stat({ n, label, href }: { n: number; label: string; href?: string }) {
  const body = (
    <>
      <p className="font-display text-xl font-semibold">{compact(n)}</p>
      <p className="text-xs font-bold text-muted">{label}</p>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-xl py-1 transition hover:bg-sand active:scale-95">
      {body}
    </Link>
  ) : (
    <div className="py-1">{body}</div>
  );
}
