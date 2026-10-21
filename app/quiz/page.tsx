"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { TopBar } from "@/components/Shell";

type Trait = "chaos" | "snuggle" | "social" | "food" | "brave" | "royal";

const QUESTIONS: { q: string; a: { t: string; trait: Trait }[] }[] = [
  {
    q: "It's 6am. Your pet is…",
    a: [
      { t: "Already doing zoomies 💨", trait: "chaos" },
      { t: "Buried under the blanket 🛌", trait: "snuggle" },
      { t: "Staring at you. Breakfast. Now. 🍗", trait: "food" },
      { t: "Waiting to be served, as is tradition 👑", trait: "royal" },
    ],
  },
  {
    q: "A stranger comes to the door…",
    a: [
      { t: "New best friend!! 🥰", trait: "social" },
      { t: "Hides until they leave 🙈", trait: "snuggle" },
      { t: "Investigates bravely 🕵️", trait: "brave" },
      { t: "Did they bring snacks? 👀", trait: "food" },
    ],
  },
  {
    q: "Favourite way to spend a Sunday?",
    a: [
      { t: "Park, beach, adventure 🏞️", trait: "brave" },
      { t: "Couch. Sun patch. Repeat ☀️", trait: "snuggle" },
      { t: "Playdate with friends 🐾", trait: "social" },
      { t: "Knocking things off tables 🍽️", trait: "chaos" },
    ],
  },
  {
    q: "Toy of choice?",
    a: [
      { t: "Whatever they just destroyed 💥", trait: "chaos" },
      { t: "A treat puzzle 🧩", trait: "food" },
      { t: "A soft plushie to cuddle 🧸", trait: "snuggle" },
      { t: "Toys are beneath them 💅", trait: "royal" },
    ],
  },
  {
    q: "Bath time reaction?",
    a: [
      { t: "Splash party! 🌊", trait: "brave" },
      { t: "Betrayal. Utter betrayal 😾", trait: "royal" },
      { t: "Escapes, soaking, through the house 🏃", trait: "chaos" },
      { t: "Sad eyes, but accepts cuddles after 🥺", trait: "snuggle" },
    ],
  },
  {
    q: "At a pet meetup they…",
    a: [
      { t: "Say hi to EVERYONE 👋", trait: "social" },
      { t: "Find the treat table first 🍪", trait: "food" },
      { t: "Lead the pack 🦁", trait: "brave" },
      { t: "Sit on someone's lap 💛", trait: "snuggle" },
    ],
  },
];

const RESULTS: Record<Trait, { name: string; emoji: string; blurb: string }> = {
  chaos: { name: "Chaotic Gremlin", emoji: "🌪️", blurb: "Unpredictable, hilarious and always up to something. Life is never boring." },
  snuggle: { name: "Professional Snuggler", emoji: "🧸", blurb: "Warm, gentle and the world's best nap partner." },
  social: { name: "Social Butterfloof", emoji: "🦋", blurb: "Never met a stranger. Every walk is a meet-and-greet." },
  food: { name: "Snack Inspector", emoji: "🍗", blurb: "Highly motivated by food. Knows the sound of every wrapper." },
  brave: { name: "Fearless Explorer", emoji: "🧭", blurb: "Adventure first, questions later. Born for the outdoors." },
  royal: { name: "Tiny Royal", emoji: "👑", blurb: "Elegant, opinionated and fully aware they run the household." },
};

export default function Quiz() {
  const router = useRouter();
  const { me, dispatch, toast, signedIn } = useStore();
  const [step, setStep] = useState(0);
  const [score, setScore] = useState<Record<Trait, number>>({ chaos: 0, snuggle: 0, social: 0, food: 0, brave: 0, royal: 0 });
  const done = step >= QUESTIONS.length;
  const top = (Object.entries(score) as [Trait, number][]).sort((a, b) => b[1] - a[1])[0][0];
  const result = RESULTS[top];

  return (
    <main className="min-h-dvh pb-10">
      <TopBar title="Personality quiz" sub={done ? "Your result" : `Question ${step + 1} of ${QUESTIONS.length}`} />
      <div className="mx-4 mb-6 h-2 overflow-hidden rounded-full bg-sand">
        <div className="h-full rounded-full bg-gradient-to-r from-peach to-blush transition-all" style={{ width: `${(Math.min(step, QUESTIONS.length) / QUESTIONS.length) * 100}%` }} />
      </div>

      {!done ? (
        <section className="px-5">
          <h2 className="text-center font-display text-2xl font-semibold">{QUESTIONS[step].q}</h2>
          <div className="mt-5 space-y-3">
            {QUESTIONS[step].a.map((a) => (
              <button
                key={a.t}
                className="card w-full px-5 py-4 text-left font-bold transition active:scale-[.98]"
                onClick={() => {
                  setScore((sc) => ({ ...sc, [a.trait]: sc[a.trait] + 1 }));
                  setStep((x) => x + 1);
                }}
              >
                {a.t}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="px-5 text-center">
          <PetAvatar pet={me} size={96} ring="story" className="mx-auto" />
          <p className="animate-pop mt-4 text-6xl">{result.emoji}</p>
          <p className="mt-2 text-sm font-extrabold uppercase tracking-wider text-muted">{signedIn ? `${me.name} is a…` : "Your pet is a…"}</p>
          <h2 className="font-display text-3xl font-bold">{result.name}</h2>
          <p className="mx-auto mt-2 max-w-[300px] font-semibold text-cocoa-soft">{result.blurb}</p>
          {signedIn ? (
            <button
              className="btn btn-dark mt-6 w-full"
              onClick={async () => {
                if (await dispatch({ t: "updateMe", patch: { personality: result.name } })) {
                  toast(`Added “${result.name}” to ${me.name}'s profile ✨`);
                  router.push(`/profile/${me.handle}`);
                }
              }}
            >
              Add to {me.name}&apos;s profile
            </button>
          ) : (
            <Link href="/login?mode=signup" className="btn btn-dark mt-6 w-full">
              Create a pet account to save it
            </Link>
          )}
          <button
            className="btn btn-soft mt-2 w-full"
            onClick={() => {
              setStep(0);
              setScore({ chaos: 0, snuggle: 0, social: 0, food: 0, brave: 0, royal: 0 });
            }}
          >
            Retake quiz
          </button>
        </section>
      )}
    </main>
  );
}
