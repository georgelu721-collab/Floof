"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { MOMENT_TYPES } from "@/lib/data";
import { addDays, dayKey, promptFor } from "@/lib/daily";
import { fileToDataUrl } from "@/lib/image";
import { newId, useStore } from "@/lib/store";
import type { Accessory, Expression, MomentType, Scene } from "@/lib/types";
import { PostMedia } from "@/components/PetArt";
import { TopBar } from "@/components/Shell";
import { IconImage, IconPin, PawIcon } from "@/components/Icons";

const MAX_PHOTOS = 6;

const SCENES: { id: Scene; label: string }[] = [
  { id: "park", label: "🌳 Park" },
  { id: "beach", label: "🏖️ Beach" },
  { id: "blossom", label: "🌸 Blossom" },
  { id: "cozy", label: "🛋️ Cozy" },
  { id: "expo", label: "🎪 Expo" },
  { id: "salon", label: "✂️ Salon" },
  { id: "party", label: "🎉 Party" },
  { id: "snow", label: "❄️ Snow" },
  { id: "sunset", label: "🌅 Sunset" },
  { id: "vet", label: "🩺 Vet" },
  { id: "night", label: "🌙 Night" },
];
const ACCESSORIES: { id: Accessory; label: string }[] = [
  { id: "none", label: "None" },
  { id: "bandana", label: "🧣 Bandana" },
  { id: "bow", label: "🎀 Bow" },
  { id: "flowers", label: "🌼 Flowers" },
  { id: "party", label: "🥳 Party hat" },
  { id: "sunglasses", label: "😎 Shades" },
  { id: "crown", label: "👑 Crown" },
  { id: "hat", label: "👒 Hat" },
  { id: "duck", label: "🐥 Duck" },
];
const EXPRESSIONS: { id: Expression; label: string }[] = [
  { id: "happy", label: "😛 Happy" },
  { id: "smile", label: "🙂 Smile" },
  { id: "wink", label: "😉 Wink" },
  { id: "sleepy", label: "😴 Sleepy" },
];

function CreateInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { me, dispatch, toast, s, signedIn, ready, cloud } = useStore();
  const initialMoment = params.get("moment") as MomentType | null;
  const validMoment = initialMoment && initialMoment in MOMENT_TYPES ? initialMoment : null;
  // Answering the Daily Floof prompt (?daily=YYYY-MM-DD, only today or yesterday).
  const dailyParam = params.get("daily");
  const dailyDate = dailyParam && (dailyParam === dayKey() || dailyParam === addDays(dayKey(), -1)) ? dailyParam : undefined;
  const dailyPrompt = dailyDate ? promptFor(dailyDate) : null;

  const [photos, setPhotos] = useState<string[]>([]);
  const image = photos[0];
  const [scene, setScene] = useState<Scene>(validMoment ? MOMENT_TYPES[validMoment].scene : "park");
  const [accessory, setAccessory] = useState<Accessory>("bandana");
  const [expression, setExpression] = useState<Expression>("happy");
  const [overlay, setOverlay] = useState(validMoment ? MOMENT_TYPES[validMoment].title.toLowerCase() + " ♡" : "");
  const [captionHint] = useState(dailyPrompt ? `${dailyPrompt.emoji} ${dailyPrompt.text}` : "");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState(params.get("tag") ?? (validMoment ? "firstmoment" : dailyDate ? "DailyFloof" : ""));
  const [location, setLocation] = useState(me.city ? `${me.city}, Australia` : "");
  const [moment, setMoment] = useState<MomentType | "">(validMoment ?? "");
  const [busy, setBusy] = useState(false);

  const post = () => {
    const id = `my_${newId()}`;
    dispatch({
      t: "post",
      post: {
        id,
        petId: me.id,
        scene,
        accessory,
        expression,
        image,
        images: photos.length > 1 ? photos : undefined,
        overlay: overlay.trim() || undefined,
        caption: caption.trim() || captionHint || "🐾",
        tags: tags
          .split(/[\s,#]+/)
          .map((t) => t.trim())
          .filter(Boolean),
        location: location.trim() || undefined,
        boops: 0,
        biscuits: 0,
        commentCount: 0,
        comments: [],
        createdAt: Date.now(),
        moment: moment || undefined,
        dailyDate,
      },
    });
    toast(
      cloud && photos.length
        ? "Posted! Publishing your photo… 🐾"
        : dailyDate
          ? "🔥 Daily Floof answered! See you tomorrow"
          : moment
          ? `${MOMENT_TYPES[moment].emoji} ${MOMENT_TYPES[moment].title} unlocked!`
          : s.clan
            ? "Floof posted! +5 for your clan 🐾"
            : "Floof posted! 🐾",
    );
    router.push("/home");
  };

  if (ready && !signedIn) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
        <p className="text-6xl">🐾</p>
        <h1 className="mt-4 font-display text-2xl font-semibold">Join Floof to post</h1>
        <p className="mt-1 text-cocoa-soft">Create a pet account to share floofs and first moments.</p>
        <a href="/login?mode=signup" className="btn btn-dark mt-6">
          Create a pet account
        </a>
      </main>
    );
  }

  return (
    <main className="pb-10">
      <TopBar title="Create a Floof" />
      <div className="px-4">
        {dailyPrompt && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#FFE9D2] to-[#FDE4E8] px-4 py-3">
            <span className="text-3xl">{dailyPrompt.emoji}</span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-soft">Daily Floof</p>
              <p className="font-display text-lg font-semibold leading-tight">{dailyPrompt.text}</p>
            </div>
          </div>
        )}
        <PostMedia
          post={{ scene, accessory, expression, image, images: photos, overlay }}
          pet={me}
          carousel
          className="aspect-square rounded-[1.6rem]"
        />

        {photos.length > 0 && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {photos.map((src, i) => (
              <div key={i} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Photo ${i + 1}`} className="h-16 w-16 rounded-xl object-cover" />
                <button
                  onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-cocoa text-xs font-bold text-white"
                  aria-label={`Remove photo ${i + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length < MAX_PHOTOS && (
          <label className="btn btn-soft mt-3 w-full cursor-pointer">
            <IconImage size={18} />{" "}
            {busy ? "Processing…" : photos.length ? `Add more photos (${photos.length}/${MAX_PHOTOS})` : `Upload photos (up to ${MAX_PHOTOS})`}
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
                e.target.value = "";
                if (!files.length) return;
                setBusy(true);
                try {
                  const urls = await Promise.all(files.map((f) => fileToDataUrl(f)));
                  setPhotos((ps) => [...ps, ...urls].slice(0, MAX_PHOTOS));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        )}

        {!image && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-extrabold">Or style an illustrated floof</p>
            <Chips items={SCENES} value={scene} onChange={setScene} />
            <Chips items={ACCESSORIES} value={accessory} onChange={setAccessory} />
            <Chips items={EXPRESSIONS} value={expression} onChange={setExpression} />
          </div>
        )}

        <div className="mt-5 space-y-3">
          <input className="input" placeholder="Handwritten sticker text (e.g. zoomies!)" maxLength={28} value={overlay} onChange={(e) => setOverlay(e.target.value)} />
          <textarea
            className="input min-h-24 !rounded-3xl"
            placeholder={captionHint ? `Caption (optional) — ${captionHint}` : "Write a caption…"}
            value={caption}
            maxLength={300}
            onChange={(e) => setCaption(e.target.value)}
          />
          <input className="input" placeholder="#tags (space separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <div className="relative">
            <IconPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-11" placeholder="Add location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>

        <div className="card mt-5 p-4">
          <p className="font-display text-lg font-semibold">✨ Is this a First Pet Moment?</p>
          <p className="text-xs font-semibold text-muted">Moments are saved to {me.name}&apos;s milestone timeline.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="chip" data-on={moment === ""} onClick={() => setMoment("")}>
              Not a moment
            </button>
            {(Object.keys(MOMENT_TYPES) as MomentType[]).map((k) => (
              <button
                key={k}
                className="chip"
                data-on={moment === k}
                onClick={() => {
                  setMoment(k);
                  if (!image) setScene(MOMENT_TYPES[k].scene);
                }}
              >
                {MOMENT_TYPES[k].emoji} {MOMENT_TYPES[k].title}
                {s.unlocked[k] ? " ✓" : ""}
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-pink mt-6 w-full text-lg" onClick={post} disabled={busy}>
          <PawIcon size={20} /> Post Floof
        </button>
      </div>
    </main>
  );
}

function Chips<T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {items.map((i) => (
        <button key={i.id} className="chip" data-on={value === i.id} onClick={() => onChange(i.id)}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

export default function Create() {
  return (
    <Suspense>
      <CreateInner />
    </Suspense>
  );
}
