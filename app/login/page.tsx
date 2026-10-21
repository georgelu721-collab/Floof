"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { TopBar } from "@/components/Shell";

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { s, userId, ready, cloud, reload } = useStore();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  // Already signed in: go to the right place.
  useEffect(() => {
    if (!ready) return;
    if (!cloud) router.replace("/");
    else if (s.me) router.replace("/home");
    else if (userId) router.replace("/onboarding");
  }, [ready, cloud, s.me, userId, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await sb().auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/onboarding` },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
      } else {
        const { error } = await sb().auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email) return setError("Type your email first, then tap “Forgot password”.");
    const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
    setError(error ? error.message : "Check your inbox for a reset link 📬");
  };

  if (checkEmail) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
        <p className="text-6xl">📬</p>
        <h1 className="mt-4 font-display text-2xl font-semibold">Check your email</h1>
        <p className="mt-2 text-cocoa-soft">
          We sent a confirmation link to <b>{email}</b>. Tap it to finish creating your pet&apos;s account.
        </p>
        <button className="btn btn-soft mt-6" onClick={() => setCheckEmail(false)}>
          Back
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-dvh pb-10">
      <TopBar title={mode === "signup" ? "Create an account" : "Log in"} />
      <div className="flex flex-col items-center px-6">
        <Image src="/floof-pets.jpg" alt="" width={240} height={163} className="rounded-3xl mix-blend-multiply" priority />
        <p className="mt-3 text-center font-semibold text-cocoa-soft">
          {mode === "signup" ? "Your human account comes first, then you'll set up your pet." : "Welcome back! Your floofs missed you."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3 px-6 pt-6">
        <input className="input" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          className="input"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder="Password (6+ characters)"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="px-2 text-sm font-bold text-blush">{error}</p>}
        <button className="btn btn-dark w-full text-lg" disabled={busy}>
          {busy ? "One sec…" : mode === "signup" ? "Create account" : "Log in"}
        </button>
      </form>

      <div className="space-y-3 px-6 pt-5 text-center text-sm font-bold">
        <button className="text-blush" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Already have an account? Log in" : "New to Floof? Create an account"}
        </button>
        {mode === "signin" && (
          <button className="block w-full text-muted" onClick={reset}>
            Forgot password?
          </button>
        )}
        <Link href="/home" className="block text-muted">
          Just looking around →
        </Link>
      </div>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
