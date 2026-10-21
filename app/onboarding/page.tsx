"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PetAvatar } from "@/components/PetArt";
import { TopBar } from "@/components/Shell";
import { fileToDataUrl } from "@/lib/image";
import { useStore } from "@/lib/store";
import { PACKS } from "@/lib/data";
import type { Clan, Look, Pet, Species } from "@/lib/types";

const LOOKS: Record<Species, { label: string; look: Look }[]> = {
  dog: [
    { label: "Fluffy white", look: { fur: "#FFFBF4", ear: "#F6EADB", muzzle: "#FFFFFF", earStyle: "fluffy" } },
    { label: "Golden", look: { fur: "#E3B270", ear: "#CF9752", muzzle: "#F6D7A8", earStyle: "floppy" } },
    { label: "Fox-like", look: { fur: "#E8A15E", ear: "#D98C48", muzzle: "#FFF6EA", earStyle: "pointy" } },
    { label: "Chocolate", look: { fur: "#8B5E45", ear: "#6E4532", muzzle: "#C99878", earStyle: "floppy" } },
    { label: "Grey", look: { fur: "#9C8E83", ear: "#857669", muzzle: "#D8CFC6", earStyle: "pointy" } },
  ],
  cat: [
    { label: "Tabby", look: { fur: "#B9A795", ear: "#A89380", muzzle: "#FFF8F0", stripes: "#6F5D50", earStyle: "cat" } },
    { label: "Ginger", look: { fur: "#F0A55E", ear: "#E08F45", muzzle: "#FFF4E6", stripes: "#C9752F", earStyle: "cat" } },
    { label: "Tuxedo", look: { fur: "#3E3A3A", ear: "#2E2A2A", muzzle: "#FFFFFF", earStyle: "cat" } },
    { label: "Cream", look: { fur: "#FBF5EC", ear: "#7C6656", muzzle: "#FFFFFF", earStyle: "cat" } },
    { label: "Grey", look: { fur: "#A3A6AD", ear: "#8D9097", muzzle: "#E8E9EC", earStyle: "cat" } },
  ],
  bunny: [
    { label: "Snow", look: { fur: "#F4ECE2", ear: "#E0CBB6", muzzle: "#FFFFFF", earStyle: "bunny" } },
    { label: "Brown", look: { fur: "#B88A66", ear: "#9E7253", muzzle: "#EBD6C2", earStyle: "bunny" } },
  ],
  hamster: [
    { label: "Golden", look: { fur: "#EDBF8A", ear: "#E5A97A", muzzle: "#FFF6EA", earStyle: "round" } },
    { label: "Grey", look: { fur: "#BDB4AC", ear: "#A79C93", muzzle: "#F2EEEA", earStyle: "round" } },
  ],
};

const BGS = ["#FDE7EC", "#E7E3F7", "#FFF1C9", "#E2F0DA", "#DDEBF7", "#FFE3CF"];

export default function Onboarding() {
  const { dispatch, pets, toast, cloud, userId, ready, s } = useStore();
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [lookIdx, setLookIdx] = useState(0);
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("Sydney");
  const [photo, setPhoto] = useState<string | undefined>();
  const [clan, setClan] = useState<Clan>("dogs");

  useEffect(() => {
    if (!ready || !cloud) return;
    const addingAnother = new URLSearchParams(window.location.search).get("another") === "1";
    if (s.me && !addingAnother) router.replace("/home");
    else if (!userId) router.replace("/login?mode=signup");
  }, [ready, cloud, userId, s.me, router]);

  // Starter follows: popular pets, same city and species first.
  const suggestions = [...pets]
    .filter((p) => p.id !== s.me)
    .sort((a, b) => Number(b.city === city) - Number(a.city === city) || Number(b.species === species) - Number(a.species === species) || b.followers - a.followers)
    .slice(0, 8);
  const [follow, setFollow] = useState<string[]>([]);
  const [packs, setPacks] = useState<string[]>(["floofy-friends"]);
  useEffect(() => {
    if (step === 3 && follow.length === 0) setFollow(suggestions.slice(0, 5).map((p) => p.id));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const look = LOOKS[species][Math.min(lookIdx, LOOKS[species].length - 1)].look;
  const autoHandle = (name.trim() ? `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".")}.${species}` : "").replace(/^\.|\.$/g, "");
  const finalHandle = (handle || autoHandle).toLowerCase().replace(/[^a-z0-9._]/g, "");
  const handleTaken = pets.some((p) => p.handle === finalHandle);

  const preview: Pet = {
    id: "preview",
    handle: finalHandle || "your.pet",
    name: name || "Your pet",
    species,
    breed,
    age,
    city,
    bio: [],
    owner: "",
    look,
    photo,
    followers: 0,
    following: 0,
    biscuitsReceived: 0,
    pawScore: 0,
    clan,
    bg: BGS[(name.length + lookIdx) % BGS.length],
  };

  const finish = async () => {
    const id = `pet_${Date.now().toString(36)}`;
    setSaving(true);
    const ok = await dispatch({
      t: "createPet",
      pet: {
        ...preview,
        id,
        breed: breed || (species === "dog" ? "Good dog" : species === "cat" ? "Cool cat" : species),
        age: age || "Age is just a number",
        bio: ["New to Floof 🐾", "Here to make friends"],
        owner: "You",
        followers: 0,
        following: 3,
        pawScore: 100,
      },
      follow,
      packs,
    });
    setSaving(false);
    if (!ok) return;
    if (!cloud) void dispatch({ t: "joinClan", clan });
    toast(`Welcome to Floof, ${name}! 🎉 Let's post your first floof`);
    router.replace("/create?moment=first-floof");
  };

  return (
    <main className="min-h-dvh pb-10">
      <TopBar title="Create a pet account" sub={`Step ${step + 1} of 4`} />
      <div className="mx-4 mb-6 h-2 overflow-hidden rounded-full bg-sand">
        <div className="h-full rounded-full bg-gradient-to-r from-peach to-blush transition-all" style={{ width: `${((step + 1) / 4) * 100}%` }} />
      </div>

      <div className="flex flex-col items-center px-6">
        <label className="relative cursor-pointer">
          <PetAvatar pet={preview} size={128} ring="story" />
          <span className="absolute bottom-1 right-1 rounded-full bg-cocoa px-2.5 py-1 text-xs font-bold text-white">📷 Photo</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setPhoto(await fileToDataUrl(f, 360));
            }}
          />
        </label>
        <p className="mt-2 text-xs font-semibold text-muted">Upload a photo or use your illustrated floof</p>
      </div>

      {step === 0 && (
        <section className="space-y-4 px-6 pt-6">
          <Field label="Pet's name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mochi" maxLength={24} autoFocus />
          </Field>
          <Field label="Species">
            <div className="flex flex-wrap gap-2">
              {(["dog", "cat", "bunny", "hamster"] as Species[]).map((sp) => (
                <button
                  key={sp}
                  className="chip"
                  data-on={species === sp}
                  onClick={() => {
                    setSpecies(sp);
                    setLookIdx(0);
                    setClan(sp === "cat" ? "cats" : "dogs");
                  }}
                >
                  {{ dog: "🐶 Dog", cat: "🐱 Cat", bunny: "🐰 Bunny", hamster: "🐹 Hamster" }[sp]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Look">
            <div className="no-scrollbar -mx-6 flex gap-3 overflow-x-auto px-6 pb-1">
              {LOOKS[species].map((l, i) => (
                <button key={l.label} onClick={() => setLookIdx(i)} className="flex flex-col items-center gap-1">
                  <PetAvatar pet={{ ...preview, photo: undefined, look: l.look }} size={60} ring={i === lookIdx ? "me" : "none"} />
                  <span className="text-xs font-bold">{l.label}</span>
                </button>
              ))}
            </div>
          </Field>
          <button className="btn btn-dark mt-4 w-full" disabled={!name.trim()} onClick={() => setStep(1)}>
            Next
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4 px-6 pt-6">
          <Field label="Username" hint={handleTaken ? "That username is taken" : `floof.app/@${finalHandle}`}>
            <input className="input" value={handle || autoHandle} onChange={(e) => setHandle(e.target.value)} placeholder="mochi.the.samoyed" />
          </Field>
          <Field label="Breed">
            <input className="input" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="e.g. Bichon Frise" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <input className="input" value={age} onChange={(e) => setAge(e.target.value)} placeholder="2 years old" />
            </Field>
            <Field label="City">
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sydney" />
            </Field>
          </div>
          <div className="flex gap-3 pt-4">
            <button className="btn btn-soft flex-1" onClick={() => setStep(0)}>
              Back
            </button>
            <button className="btn btn-dark flex-1" disabled={!finalHandle || handleTaken} onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4 px-6 pt-6">
          <h2 className="text-center font-display text-xl font-semibold">Pick your Clan ⚔️</h2>
          <p className="text-center text-sm text-cocoa-soft">
            Clan Wars are friendly weekly challenges. Every floof you post earns points for your team. Bunnies & hamsters can join either side!
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(["cats", "dogs"] as Clan[]).map((c) => (
              <button
                key={c}
                onClick={() => setClan(c)}
                className={`rounded-3xl p-5 text-center transition ${clan === c ? "ring-4 ring-cocoa" : ""}`}
                style={{ background: c === "cats" ? "#E7E3F7" : "#FFE6CC" }}
              >
                <div className="text-4xl">{c === "cats" ? "🐱" : "🐶"}</div>
                <div className="mt-2 font-display text-lg font-semibold">Team {c === "cats" ? "Cats" : "Dogs"}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-3 pt-4">
            <button className="btn btn-soft flex-1" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn btn-dark flex-1" onClick={() => setStep(3)}>
              Next
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4 px-6 pt-6">
          <h2 className="text-center font-display text-xl font-semibold">Make some friends 🐾</h2>
          <p className="text-center text-sm text-cocoa-soft">Follow a few floofs so your feed is full from day one.</p>
          <div className="grid grid-cols-4 gap-3">
            {suggestions.map((p) => {
              const on = follow.includes(p.id);
              return (
                <button key={p.id} onClick={() => setFollow((f) => (on ? f.filter((x) => x !== p.id) : [...f, p.id]))} className="flex flex-col items-center gap-1">
                  <span className="relative">
                    <PetAvatar pet={p} size={58} ring={on ? "me" : "none"} />
                    {on && <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blush text-[11px] text-white ring-2 ring-cream">✓</span>}
                  </span>
                  <span className="w-full truncate text-center text-xs font-bold">{p.name}</span>
                </button>
              );
            })}
          </div>
          <p className="pt-2 text-sm font-extrabold">Join a Pack</p>
          <div className="flex flex-wrap gap-2">
            {PACKS.map((p) => (
              <button key={p.id} className="chip" data-on={packs.includes(p.id)} onClick={() => setPacks((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))}>
                {p.name}
              </button>
            ))}
          </div>
          <div className="flex gap-3 pt-4">
            <button className="btn btn-soft flex-1" onClick={() => setStep(2)}>
              Back
            </button>
            <button className="btn btn-pink flex-1" onClick={finish} disabled={saving}>
              {saving ? "Saving…" : "Start floofing 🐾"}
            </button>
          </div>
          <p className="text-center text-xs text-muted">You get 50 free biscuits to send to new friends.</p>
        </section>
      )}
    </main>
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
