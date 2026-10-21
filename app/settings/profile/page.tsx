"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fileToDataUrl } from "@/lib/image";
import { currentSubscription, disablePush, enablePush, pushSupport } from "@/lib/push";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";

export default function EditProfile() {
  const router = useRouter();
  const { me, s, dispatch, signedIn, ready, toast, cloud } = useStore();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gotcha, setGotcha] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [push, setPush] = useState<"on" | "off" | "busy">("off");
  const support = typeof window === "undefined" ? "unsupported" : pushSupport();

  useEffect(() => {
    if (!ready || loaded || !signedIn) return;
    setName(me.name);
    setBio(me.bio.join("\n"));
    setBreed(me.breed);
    setAge(me.age);
    setCity(me.city);
    setBirthday(me.birthday ?? "");
    setGotcha(me.gotchaDay ?? "");
    setPhoto(me.photo);
    setLoaded(true);
  }, [ready, loaded, signedIn, me]);

  useEffect(() => {
    currentSubscription().then((sub) => setPush(sub ? "on" : "off"), () => undefined);
  }, []);

  if (ready && !signedIn) {
    router.replace("/login");
    return null;
  }

  const bioLines = bio
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4);

  const save = async () => {
    if (!name.trim()) return toast("Your pet needs a name 🐾");
    setSaving(true);
    const ok = await dispatch({
      t: "updateMe",
      patch: {
        name: name.trim(),
        bio: bioLines,
        breed: breed.trim(),
        age: age.trim(),
        city: city.trim(),
        // Only send dates that changed.
        ...(birthday !== (me.birthday ?? "") ? { birthday: birthday || undefined } : {}),
        ...(gotcha !== (me.gotchaDay ?? "") ? { gotchaDay: gotcha || undefined } : {}),
        ...(photo !== me.photo ? { photo } : {}),
      },
    });
    setSaving(false);
    if (ok) {
      toast("Profile saved ✓");
      router.push(`/profile/${me.handle}`);
    }
  };

  const togglePush = async () => {
    setPush("busy");
    try {
      if (push === "on") {
        await disablePush();
        setPush("off");
        toast("Notifications off");
      } else {
        await enablePush(me.id);
        setPush("on");
        toast("Notifications on 🔔");
      }
    } catch (e) {
      toast((e as Error).message);
      setPush((await currentSubscription()) ? "on" : "off");
    }
  };

  return (
    <Page>
      <TopBar title="Edit profile" />
      <div className="flex flex-col items-center px-6">
        <label className="relative cursor-pointer">
          <PetAvatar pet={{ ...me, photo }} size={112} ring="story" />
          <span className="absolute bottom-1 right-1 rounded-full bg-cocoa px-2.5 py-1 text-xs font-bold text-white">📷 Change</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setPhoto(await fileToDataUrl(f, 400));
            }}
          />
        </label>
        {photo && (
          <button className="mt-2 text-xs font-bold text-muted underline" onClick={() => setPhoto(undefined)}>
            Use illustrated avatar instead
          </button>
        )}
      </div>

      <section className="space-y-3 px-5 pt-5">
        <Field label="Name">
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Bio" hint={`Up to 4 short lines · ${bioLines.length}/4`}>
          <textarea
            className="input min-h-28 !rounded-3xl"
            value={bio}
            maxLength={240}
            placeholder={"Professional napper\nSnacks, walks, and making friends ♡"}
            onChange={(e) => setBio(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Breed">
            <input className="input" value={breed} maxLength={40} onChange={(e) => setBreed(e.target.value)} />
          </Field>
          <Field label="Age">
            <input className="input" value={age} maxLength={30} onChange={(e) => setAge(e.target.value)} />
          </Field>
        </div>
        <Field label="City">
          <input className="input" value={city} maxLength={40} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="🎂 Birthday">
            <input className="input" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </Field>
          <Field label="🏡 Gotcha Day">
            <input className="input" type="date" value={gotcha} onChange={(e) => setGotcha(e.target.value)} />
          </Field>
        </div>
        <p className="px-2 text-xs font-semibold text-muted">We&apos;ll remind you ahead of birthdays and Gotcha Days.</p>
        <button className="btn btn-dark w-full" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </section>

      <SectionTitle>Settings</SectionTitle>
      <section className="card mx-4 divide-y divide-oat px-4">
        <div className="flex items-center gap-3 py-3">
          <div className="flex-1">
            <p className="font-extrabold">🔔 Notifications</p>
            <p className="text-xs font-semibold text-muted">
              {support === "ok"
                ? "Daily prompt, streak reminders, weekly recap and pet-care reminders"
                : support === "ios-needs-home-screen"
                  ? "On iPhone: tap Share → “Add to Home Screen”, open Floof from there, then turn this on"
                  : "Not supported in this browser"}
            </p>
          </div>
          <button
            onClick={togglePush}
            disabled={support !== "ok" || push === "busy" || !cloud}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${push === "on" ? "bg-sage" : "bg-oat"}`}
            aria-pressed={push === "on"}
            aria-label="Notifications"
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${push === "on" ? "left-6" : "left-1"}`} />
          </button>
        </div>
        <div className="flex items-center gap-3 py-3">
          <div className="flex-1">
            <p className="font-extrabold">📍 Meetups</p>
            <p className="text-xs font-semibold text-muted">Show me opt-in meetups in public places</p>
          </div>
          <button
            onClick={() => void dispatch({ t: "meetupsOptIn", on: !s.meetupsOptIn })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${s.meetupsOptIn ? "bg-sage" : "bg-oat"}`}
            aria-pressed={s.meetupsOptIn}
            aria-label="Meetups"
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${s.meetupsOptIn ? "left-6" : "left-1"}`} />
          </button>
        </div>
        <button
          className="w-full py-3 text-left font-extrabold text-blush"
          onClick={() => {
            if (confirm("Log out of Floof?")) void dispatch({ t: "logout" }).then(() => router.push("/"));
          }}
        >
          Log out
        </button>
      </section>
    </Page>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-extrabold">{label}</label>
      {children}
      {hint && <p className="mt-1 pl-3 text-xs font-semibold text-muted">{hint}</p>}
    </div>
  );
}
