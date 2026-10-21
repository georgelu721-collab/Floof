"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { fileToDataUrl } from "@/lib/image";
import { newId, useStore } from "@/lib/store";
import { TopBar } from "@/components/Shell";
import { IconImage } from "@/components/Icons";

function NewAlertInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { me, dispatch, toast } = useStore();
  const kind = params.get("kind") === "found" ? "found" : "lost";
  const [name, setName] = useState(kind === "lost" ? me.name : "");
  const [description, setDescription] = useState(kind === "lost" ? `${me.breed}. ` : "");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState(me.city ?? "");
  const [lastSeen, setLastSeen] = useState("");
  const [photo, setPhoto] = useState<string | undefined>(kind === "lost" ? me.photo : undefined);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const id = crypto.randomUUID?.() ?? newId();
    const ok = await dispatch({
      t: "postAlert",
      alert: {
        id,
        kind,
        reporterId: me.id,
        petId: kind === "lost" ? me.id : undefined,
        name: name.trim(),
        description: description.trim(),
        suburb: suburb.trim(),
        city: city.trim(),
        lastSeen: lastSeen.trim(),
        photo,
        status: "active",
        createdAt: Date.now(),
      },
    });
    setBusy(false);
    if (ok) {
      toast(kind === "lost" ? "Alert posted. Everyone nearby can see it 💛" : "Thanks for helping! 💛");
      router.replace(`/lost/${id}`);
    }
  };

  return (
    <main className="pb-10">
      <TopBar title={kind === "lost" ? "Report a lost pet" : "Report a found pet"} />
      <div className="space-y-3 px-4">
        <label className="relative block aspect-[4/3] cursor-pointer overflow-hidden rounded-3xl bg-sand">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-2 font-bold text-muted">
              <IconImage /> Add a clear photo
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setPhoto(await fileToDataUrl(f, 900));
            }}
          />
        </label>
        <input className="input" placeholder={kind === "lost" ? "Pet's name" : "Short description, e.g. Brown kelpie, no collar"} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <textarea
          className="input min-h-24 !rounded-3xl"
          placeholder="Colour, size, collar, microchip, temperament, how to approach…"
          value={description}
          maxLength={600}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Suburb / area" value={suburb} onChange={(e) => setSuburb(e.target.value)} />
          <input className="input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <input className="input" placeholder={kind === "lost" ? "Last seen (e.g. Today 7am near Bondi Park)" : "When & where you found them"} value={lastSeen} onChange={(e) => setLastSeen(e.target.value)} />
        <p className="px-2 text-xs font-semibold text-muted">
          Don&apos;t share your home address. People will contact you through Floof messages.
        </p>
        <button className="btn btn-pink w-full" onClick={submit} disabled={busy || !name.trim()}>
          {busy ? "Posting…" : "Post alert"}
        </button>
      </div>
    </main>
  );
}

export default function NewAlert() {
  return (
    <Suspense>
      <NewAlertInner />
    </Suspense>
  );
}
