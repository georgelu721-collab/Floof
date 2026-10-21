"use client";

import Link from "next/link";
import { addDays, dayKey, promptFor, untilTomorrow } from "@/lib/daily";
import { useStore } from "@/lib/store";
import { PetAvatar, PostMedia } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";
import { useNow } from "@/components/HomeCards";

export default function Daily() {
  const { posts, me, streak, myPostDays, dailyAnswers, dailyVoteCount, s, dispatch, pet, signedIn, toast } = useStore();
  const now = useNow(30_000);
  if (!now) return <Page><TopBar title="Daily Floof" /></Page>;

  const today = dayKey(now);
  const yesterday = addDays(today, -1);
  const prompt = promptFor(today);
  const left = untilTomorrow(now);
  const answered = posts.some((p) => p.petId === me.id && p.dailyDate === today);
  const answers = [...dailyAnswers(today)].sort((a, b) => dailyVoteCount(today, b.id) - dailyVoteCount(today, a.id));
  const myVote = s.dailyVotes[today];

  const yAnswers = dailyAnswers(yesterday);
  const winner = [...yAnswers].sort((a, b) => dailyVoteCount(yesterday, b.id) - dailyVoteCount(yesterday, a.id))[0];
  const winnerVotes = winner ? dailyVoteCount(yesterday, winner.id) : 0;
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));

  const vote = (postId: string, owner: string) => {
    const next = myVote === postId ? null : postId;
    void dispatch({ t: "dailyVote", day: today, postId: next, petId: owner });
    if (next) toast("Vote counted 🗳️");
  };

  return (
    <Page>
      <TopBar title="Daily Floof" sub="One prompt a day · answer in 10 seconds" />

      <section className="card mx-4 bg-gradient-to-br from-[#FFE9D2] to-[#FDE4E8] p-5 text-center">
        <p className="text-5xl">{prompt.emoji}</p>
        <p className="mt-2 text-xs font-extrabold uppercase tracking-wider text-cocoa-soft">Today&apos;s prompt</p>
        <p className="font-display text-2xl font-semibold">{prompt.text}</p>
        <p className="mt-1 text-sm font-bold text-cocoa-soft">
          New prompt in {left.h}h {left.m}m
        </p>
        {answered ? (
          <p className="btn btn-soft mt-4 w-full !bg-paper/80">✓ You answered today</p>
        ) : (
          <Link href={`/create?daily=${today}`} className="btn btn-dark mt-4 w-full">
            Answer today&apos;s prompt
          </Link>
        )}
      </section>

      {signedIn && (
        <section className="card mx-4 mt-4 p-4">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="font-display text-3xl font-bold">🔥 {streak.streak}</p>
              <p className="text-xs font-bold text-muted">day streak</p>
            </div>
            <div className="flex-1 text-sm font-semibold text-cocoa-soft">
              {streak.atRisk
                ? "Post today to keep your streak alive!"
                : streak.postedToday
                  ? "Nice! Come back tomorrow to keep it going."
                  : "Post today to start a streak."}
              <p className="mt-0.5 text-xs text-muted">Best: {streak.best} day{streak.best === 1 ? "" : "s"} · 1 free skip day per week</p>
            </div>
          </div>
          <div className="mt-3 flex justify-between">
            {last14.map((d) => (
              <span
                key={d}
                title={d}
                className={`h-5 w-5 rounded-full ${myPostDays.has(d) ? "bg-gradient-to-br from-peach to-blush" : "bg-sand"} ${d === today ? "ring-2 ring-cocoa ring-offset-1" : ""}`}
              />
            ))}
          </div>
          <p className="mt-1 text-right text-[10px] font-bold text-muted">last 14 days</p>
        </section>
      )}

      {winner && pet(winner.petId) && (
        <>
          <SectionTitle>Yesterday&apos;s winner 🏆</SectionTitle>
          <Link href={`/post/${winner.id}`} className="card mx-4 flex items-center gap-3 p-3">
            <PostMedia post={winner} pet={pet(winner.petId)!} className="h-20 w-20 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{promptFor(yesterday).text}</p>
              <p className="flex items-center gap-2 font-extrabold">
                <PetAvatar pet={pet(winner.petId)!} size={22} /> {pet(winner.petId)!.name}
              </p>
              <p className="text-sm font-bold text-blush">{winnerVotes} vote{winnerVotes === 1 ? "" : "s"}</p>
            </div>
          </Link>
        </>
      )}

      <SectionTitle>Today&apos;s answers</SectionTitle>
      {answers.length === 0 ? (
        <p className="px-8 py-8 text-center font-semibold text-muted">No answers yet — be the first! 🐾</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4">
          {answers.map((p) => {
            const owner = pet(p.petId);
            if (!owner) return null;
            const mine = p.petId === me.id;
            const votes = dailyVoteCount(today, p.id);
            const voted = myVote === p.id;
            return (
              <div key={p.id} className="card overflow-hidden">
                <Link href={`/post/${p.id}`}>
                  <PostMedia post={p} pet={owner} className="aspect-square" />
                </Link>
                <div className="flex items-center gap-2 p-2.5">
                  <PetAvatar pet={owner} size={24} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-extrabold">{owner.name}</p>
                    <p className="text-xs font-bold text-muted">
                      {votes} vote{votes === 1 ? "" : "s"}
                    </p>
                  </div>
                  {mine ? (
                    <span className="text-xs font-bold text-muted">You</span>
                  ) : (
                    <button
                      onClick={() => vote(p.id, owner.id)}
                      className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${voted ? "bg-blush text-white" : "bg-sand"}`}
                      aria-pressed={voted}
                    >
                      {voted ? "Voted ♥" : "Vote"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="px-8 pt-4 text-center text-xs font-semibold text-muted">One vote a day. Tomorrow&apos;s winner gets the 🏆 spot.</p>
    </Page>
  );
}
