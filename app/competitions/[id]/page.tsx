"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { COMPETITIONS, compact } from "@/lib/data";
import { useStore } from "@/lib/store";
import { PetAvatar, PetScene, PostMedia } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";
import { IconCheck, IconTrophy } from "@/components/Icons";

export default function CompetitionPage() {
  const { id } = useParams<{ id: string }>();
  const { pet, post, posts, me, s, dispatch, toast, extraVotes, remoteEntries } = useStore();
  const [picking, setPicking] = useState(false);
  const c = COMPETITIONS.find((x) => x.id === id);
  if (!c) return <TopBar title="Competition not found" />;
  const hero = pet(c.heroPetId)!;

  const myEntry = s.entries[c.id];
  const myVote = s.votes[c.id];
  const entries = [
    ...(myEntry ? [{ postId: myEntry, votes: 1 }] : []),
    ...c.entries.filter((e) => e.postId !== myEntry),
    ...remoteEntries(c.id)
      .filter((id) => id !== myEntry && !c.entries.some((e) => e.postId === id))
      .map((postId) => ({ postId, votes: 0 })),
  ]
    .map((e) => ({ ...e, votes: e.votes + extraVotes(c.id, e.postId) + (myVote === e.postId ? 1 : 0), post: post(e.postId) }))
    .filter((e) => e.post)
    .sort((a, b) => b.votes - a.votes);
  const myPosts = posts.filter((p) => p.petId === me.id && !p.image?.startsWith("data:"));

  return (
    <Page>
      <TopBar title={c.title} sub={`Sponsored by ${c.sponsor}`} />
      <div className="relative mx-4 h-52 overflow-hidden rounded-3xl">
        <PetScene pet={hero} scene={c.scene} accessory={c.accessory} className="absolute inset-0 h-full w-full" />
        <span className="absolute left-3 top-3 rounded-full bg-paper px-3 py-1 text-xs font-extrabold capitalize">{c.status}</span>
      </div>
      <section className="px-4 pt-4">
        <p className="font-semibold text-cocoa-soft">{c.blurb}</p>
        <div className="card mt-4 flex items-center gap-3 p-4">
          <IconTrophy className="text-dogs" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Prize</p>
            <p className="font-bold">{c.prize}</p>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold text-muted">
          {c.status === "active" ? `Voting closes in ${c.endsInDays} days · one vote per pet` : c.status === "upcoming" ? `Opens in ${c.endsInDays} days` : "This competition has ended"}
        </p>

        {c.status !== "past" && (
          <button className="btn btn-dark mt-4 w-full" onClick={() => setPicking((x) => !x)} disabled={!!myEntry}>
            {myEntry ? "✓ You've entered" : c.status === "upcoming" ? "Pre-register an entry" : "Enter with one of your floofs"}
          </button>
        )}

        {picking && !myEntry && (
          <div className="mt-3">
            {myPosts.length === 0 ? (
              <p className="text-center text-sm font-semibold text-muted">
                You have no floofs yet.{" "}
                <Link href="/create" className="text-blush">
                  Post one first
                </Link>
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {myPosts.map((p) => (
                  <button
                    key={p.id}
                    onClick={async () => {
                      setPicking(false);
                      if (await dispatch({ t: "enter", compId: c.id, postId: p.id })) toast("Entry submitted! Good luck 🍀");
                    }}
                  >
                    <PostMedia post={p} pet={me} className="aspect-square rounded-2xl" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {entries.length > 0 && (
        <>
          <SectionTitle>{c.status === "past" ? "Winner" : "Leaderboard"}</SectionTitle>
          <div className="grid grid-cols-2 gap-3 px-4">
            {entries.map((e, i) => {
              const owner = pet(e.post!.petId)!;
              const voted = myVote === e.postId;
              return (
                <div key={e.postId} className="card overflow-hidden">
                  <div className="relative">
                    <PostMedia post={e.post!} pet={owner} className="aspect-square" />
                    <span className="absolute left-2 top-2 rounded-full bg-paper px-2 py-0.5 text-xs font-extrabold">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5">
                    <PetAvatar pet={owner} size={26} />
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-sm font-extrabold">{owner.name}</p>
                      <p className="text-xs font-bold text-muted">{compact(e.votes)} votes</p>
                    </div>
                    {c.status === "active" && owner.id !== me.id && (
                      <button
                        onClick={() => {
                          dispatch({ t: "vote", compId: c.id, postId: e.postId, petId: owner.id });
                          toast(`Voted for ${owner.name} 🗳️`);
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${voted ? "bg-sage text-white" : "bg-sand"}`}
                      >
                        {voted ? <IconCheck size={14} /> : "Vote"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}
