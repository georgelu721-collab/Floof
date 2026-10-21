"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DEMO_PET_ID } from "@/lib/data";
import { useStore } from "@/lib/store";
import { PawIcon } from "@/components/Icons";

export default function Welcome() {
  const { s, ready, dispatch } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (ready && s.me) router.replace("/home");
  }, [ready, s.me, router]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden px-8 pb-10 pt-16 text-center">
      {[
        "left-6 top-10 rotate-[-20deg] text-peach/40",
        "right-8 top-24 rotate-[18deg] text-blush/30",
        "left-10 bottom-48 rotate-[10deg] text-sage/40",
        "right-10 bottom-60 rotate-[-12deg] text-peach/30",
      ].map((c, i) => (
        <span key={i} className={`absolute ${c}`}>
          <PawIcon size={i % 2 ? 34 : 44} />
        </span>
      ))}

      <Image src="/floof-logo.jpg" alt="Floof logo — a bichon and a kitten" width={320} height={320} priority className="rounded-[2rem] mix-blend-multiply" />

      <h1 className="sr-only">Floof</h1>
      <p className="mt-2 font-display text-[26px] font-semibold leading-snug">
        Pets make
        <br />a kinder world <span className="text-blush">♥</span>
      </p>
      <p className="mt-3 max-w-[300px] text-sm font-semibold text-cocoa-soft">
        Share first pet moments, send biscuits, join meetups and find your pet&apos;s best friend.
      </p>

      <div className="mt-auto w-full space-y-3 pt-10">
        <Link href="/onboarding" className="btn btn-dark w-full text-lg">
          Create a pet account
        </Link>
        <button
          className="btn btn-soft w-full text-lg"
          onClick={() => {
            dispatch({ t: "login", id: DEMO_PET_ID });
            router.push("/home");
          }}
        >
          Log in as Big Mac (demo)
        </button>
        <p className="pt-2 text-xs text-muted">By continuing you agree to be kind to every floof. 🐾</p>
      </div>
    </main>
  );
}
