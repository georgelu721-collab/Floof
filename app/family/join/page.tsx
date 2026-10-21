"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { pickPet, remote } from "@/lib/cloud";
import { useStore } from "@/lib/store";
import { TopBar } from "@/components/Shell";

function JoinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { userId, reload, toast, cloud, ready } = useStore();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ready && !cloud) return <TopBar title="Family sharing works in the live app" />;

  const join = async () => {
    if (!userId) return router.push("/login");
    setBusy(true);
    setError(null);
    try {
      const petId = await remote.acceptFamilyInvite(code);
      pickPet(userId, petId);
      await reload();
      toast("You're now part of the family 💛");
      router.replace("/home");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh pb-10">
      <TopBar title="Join a family pet" />
      <div className="space-y-4 px-6 pt-4 text-center">
        <p className="text-6xl">👨‍👩‍👧🐾</p>
        <p className="font-semibold text-cocoa-soft">Enter the invite code a family member shared with you to help manage their pet: posting, messages, care reminders and more.</p>
        <input className="input text-center font-mono text-lg tracking-widest" placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} />
        {error && <p className="text-sm font-bold text-blush">{error}</p>}
        {userId ? (
          <button className="btn btn-dark w-full" onClick={join} disabled={busy || !code.trim()}>
            {busy ? "Joining…" : "Join"}
          </button>
        ) : (
          <Link href="/login" className="btn btn-dark w-full">
            Log in to join
          </Link>
        )}
      </div>
    </main>
  );
}

export default function Join() {
  return (
    <Suspense>
      <JoinInner />
    </Suspense>
  );
}
