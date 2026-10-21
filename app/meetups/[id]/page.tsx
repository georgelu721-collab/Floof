"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { compact, MEETUPS, MOMENT_TYPES } from "@/lib/data";
import { useStore } from "@/lib/store";
import { PetAvatar, PetScene, PostMedia } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";
import { IconBack, IconCalendar, IconCheck, IconPin, IconStar } from "@/components/Icons";

export default function MeetupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pet, posts, s, dispatch, toast } = useStore();
  const m = MEETUPS.find((x) => x.id === id);
  if (!m) return <TopBar title="Event not found" />;
  const hero = pet(m.heroPetId)!;
  const st = s.events[m.id];
  const checkedIn = !!s.checkins[m.id];
  const highlights = posts.filter((p) => m.attendees.includes(p.petId) && (p.scene === m.scene || p.moment === m.momentType)).slice(0, 6);

  const set = (status: "interested" | "going") => {
    if (!s.meetupsOptIn && m.kind === "meetup") {
      dispatch({ t: "meetupsOptIn", on: true });
    }
    dispatch({ t: "event", id: m.id, status: st === status ? null : status });
  };

  return (
    <Page>
      <div className="relative h-64">
        <PetScene usePhoto pet={hero} scene={m.scene} accessory="hat" className="absolute inset-0 h-full w-full" />
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/meetups"))}
          className="absolute left-4 top-[max(env(safe-area-inset-top),14px)] rounded-full bg-paper/90 p-2 shadow"
          aria-label="Back"
        >
          <IconBack />
        </button>
        <div className="absolute inset-x-0 bottom-0 h-14 rounded-t-[2rem] bg-cream" />
      </div>
      <section className="-mt-8 px-5">
        <span className="rounded-full bg-sand px-3 py-1 text-xs font-extrabold capitalize">{m.kind}</span>
        <h1 className="mt-2 font-display text-[28px] font-bold leading-tight">{m.title}</h1>
        <p className="mt-2 flex items-center gap-2 font-semibold">
          <IconCalendar size={18} /> {m.date} · {m.time}{m.recurring ? ` · 🔁 ${m.recurring}` : ""}
        </p>
        <p className="mt-1 flex items-center gap-2 font-semibold">
          <IconPin size={18} /> {m.place}, {m.suburb}
        </p>
        <p className="mt-3 text-cocoa-soft">{m.description}</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => set("interested")} className={`btn ${st === "interested" ? "btn-dark" : "btn-soft"}`}>
            <IconStar size={18} /> Interested
          </button>
          <button
            onClick={() => {
              set("going");
              if (st !== "going") toast("See you there! 🐾");
            }}
            className={`btn ${st === "going" ? "btn-dark" : "btn-soft"}`}
          >
            <IconCheck size={18} /> Going
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex -space-x-2">
            {m.attendees.map((a) => (
              <PetAvatar key={a} pet={pet(a)!} size={30} />
            ))}
          </div>
          <span className="text-sm font-bold text-muted">{compact(m.interested + (st === "interested" ? 1 : 0))} interested</span>
        </div>

        {m.momentType && (
          <div className="card mt-5 flex items-center gap-3 p-4" style={{ background: MOMENT_TYPES[m.momentType].tint }}>
            <span className="text-3xl">{MOMENT_TYPES[m.momentType].emoji}</span>
            <div className="flex-1">
              <p className="font-extrabold">Unlock: {MOMENT_TYPES[m.momentType].title}</p>
              <p className="text-xs font-semibold text-cocoa-soft">Check in on the day to earn the moment & +50 PawScore</p>
            </div>
            {checkedIn ? (
              <Link href={`/create?moment=${m.momentType}`} className="rounded-full bg-cocoa px-3 py-1.5 text-xs font-extrabold text-white">
                Post it
              </Link>
            ) : (
              <button
                disabled={st !== "going"}
                onClick={() => {
                  dispatch({ t: "checkin", id: m.id });
                  toast("Checked in! Moment unlocked ✨");
                }}
                className="rounded-full bg-cocoa px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-40"
              >
                Check in
              </button>
            )}
          </div>
        )}
      </section>

      {highlights.length > 0 && (
        <>
          <SectionTitle>Highlights</SectionTitle>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
            {highlights.map((p) => (
              <Link key={p.id} href={`/post/${p.id}`} className="w-32 shrink-0">
                <PostMedia post={p} pet={pet(p.petId)!} className="aspect-[4/5] rounded-2xl" />
              </Link>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
