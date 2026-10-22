"use client";

import Link from "next/link";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { MOMENT_TYPES } from "@/lib/data";
import { addDays, dayKey, promptFor } from "@/lib/daily";
import { fileToDataUrl } from "@/lib/image";
import { newId, useStore } from "@/lib/store";
import type { Accessory, Expression, MomentType, Scene, Sticker } from "@/lib/types";
import { ALL_FRAMES, Decorations, PetAvatar, PostMedia, STICKERS } from "@/components/PetArt";
import { type EditablePhoto, PhotoEditor } from "@/components/PhotoEditor";
import { UnlockSheet } from "@/components/UnlockSheet";
import { type Aspect, NO_EDIT, renderPhoto } from "@/lib/photo";
import { SHOP } from "@/lib/shop";
import { TagPicker } from "@/components/TagPicker";
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
  const { me, dispatch, toast, s, signedIn, ready, cloud, pet: petOf } = useStore();
  const initialMoment = params.get("moment") as MomentType | null;
  const validMoment = initialMoment && initialMoment in MOMENT_TYPES ? initialMoment : null;
  // Answering the Daily Floof prompt (?daily=YYYY-MM-DD, only today or yesterday).
  const dailyParam = params.get("daily");
  const dailyDate = dailyParam && (dailyParam === dayKey() || dailyParam === addDays(dayKey(), -1)) ? dailyParam : undefined;
  const dailyPrompt = dailyDate ? promptFor(dailyDate) : null;

  const [raw, setRaw] = useState<(EditablePhoto & { out?: string })[]>([]);
  const photos = raw.map((p) => p.out ?? p.src);
  const image = photos[0];
  const [aspect, setAspect] = useState<Aspect>("square");
  const [editing, setEditing] = useState<number | null>(null);
  const [buying, setBuying] = useState<{ item: string; then?: () => void } | null>(null);
  const owns = (item?: string) => !item || !!s.unlocks[item];
  // Re-draw edited photos when the post's shape changes.
  useEffect(() => {
    let live = true;
    void Promise.all(raw.map((p) => (p.out ? renderPhoto(p.src, aspect, p.edit) : Promise.resolve(undefined)))).then((outs) => {
      if (live) setRaw((rs) => rs.map((r, i) => (r.out && outs[i] ? { ...r, out: outs[i] } : r)));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);
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
  const [tagged, setTagged] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [frame, setFrame] = useState("");
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const dragging = useRef<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const moveSticker = (e: React.PointerEvent) => {
    if (dragging.current === null || !previewRef.current) return;
    const r = previewRef.current.getBoundingClientRect();
    const x = Math.min(95, Math.max(5, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(95, Math.max(5, ((e.clientY - r.top) / r.height) * 100));
    const i = dragging.current;
    setStickers((st) => st.map((s, j) => (j === i ? { ...s, x: Math.round(x), y: Math.round(y) } : s)));
  };

  const post = async () => {
    const id = `my_${newId()}`;
    let finals: string[] = [];
    if (raw.length) {
      setBusy(true);
      try {
        finals = await Promise.all(raw.map((p) => renderPhoto(p.src, aspect, p.edit)));
      } catch {
        setBusy(false);
        return toast("Couldn't prepare your photos. Try again?");
      }
    }
    dispatch({
      t: "post",
      post: {
        id,
        petId: me.id,
        scene,
        accessory,
        expression,
        image: finals[0],
        images: finals.length > 1 ? finals : undefined,
        aspect: aspect === "portrait" ? "portrait" : undefined,
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
        taggedPets: tagged.length ? tagged : undefined,
        frame: frame || undefined,
        stickers: stickers.length ? stickers : undefined,
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
        <div className="mb-3 grid grid-cols-2 rounded-full bg-sand p-1 text-sm font-extrabold">
          <span className="rounded-full bg-paper py-2 text-center shadow-sm">📸 Post</span>
          <Link href="/story/new" replace className="py-2 text-center text-muted">
            ⏳ Story
          </Link>
        </div>
        {dailyPrompt && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#FFE9D2] to-[#FDE4E8] px-4 py-3">
            <span className="text-3xl">{dailyPrompt.emoji}</span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-soft">Daily Floof</p>
              <p className="font-display text-lg font-semibold leading-tight">{dailyPrompt.text}</p>
            </div>
          </div>
        )}
        <div
          ref={previewRef}
          className="relative"
          onPointerMove={moveSticker}
          onPointerUp={() => (dragging.current = null)}
          onPointerLeave={() => (dragging.current = null)}
        >
        <PostMedia
          post={{ scene, accessory, expression, image, images: photos, overlay, frame }}
          pet={me}
          carousel
          className={`${aspect === "portrait" ? "aspect-[4/5]" : "aspect-square"} rounded-[1.6rem]`}
        />
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.6rem]" style={{ containerType: "inline-size" }}>
            <Decorations
              stickers={stickers}
              onStickerPointerDown={(i, e) => {
                dragging.current = i;
                e.preventDefault();
              }}
            />
          </div>
        </div>
        {stickers.length > 0 && <p className="mt-1 text-center text-xs font-semibold text-muted">Drag stickers to move them</p>}

        <div className="mt-3 flex items-center justify-center gap-2">
          {(["square", "portrait"] as Aspect[]).map((a) => (
            <button key={a} className="chip" data-on={aspect === a} onClick={() => setAspect(a)}>
              {a === "square" ? "◻️ Square" : "▯ Portrait 4:5"}
            </button>
          ))}
        </div>

        {photos.length > 0 && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pt-1.5">
            {photos.map((src, i) => (
              <div key={i} className="relative shrink-0">
                <button onClick={() => setEditing(i)} aria-label={`Edit photo ${i + 1}`} className="relative block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Photo ${i + 1}`} className="h-16 w-16 rounded-xl object-cover" />
                  <span className="absolute inset-x-0 bottom-0 rounded-b-xl bg-cocoa/70 py-0.5 text-center text-[10px] font-extrabold text-white">✏️ Edit</span>
                </button>
                <button
                  onClick={() => setRaw((ps) => ps.filter((_, j) => j !== i))}
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
                  const urls = await Promise.all(files.map((f) => fileToDataUrl(f, 1600, 0.9)));
                  setRaw((ps) => [...ps, ...urls.map((src) => ({ src, edit: { ...NO_EDIT } }))].slice(0, MAX_PHOTOS));
                  if (!raw.length) setEditing(0);
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
          <p className="flex items-center text-sm font-extrabold">
            <span className="flex-1">Frame</span>
            <Link href="/shop" className="text-xs font-extrabold text-blush">
              🛍️ Biscuit Shop
            </Link>
          </p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {ALL_FRAMES.map((f) => (
              <button
                key={f.id}
                className="chip"
                data-on={frame === f.id}
                onClick={() => (owns(f.item) ? setFrame(f.id) : setBuying({ item: f.item!, then: () => setFrame(f.id) }))}
              >
                {f.label}
                {!owns(f.item) && <span className="ml-1 text-xs opacity-70">🔒 {SHOP.find((i) => i.id === f.item)?.price}🍪</span>}
              </button>
            ))}
          </div>
          <p className="text-sm font-extrabold">Stickers {stickers.length > 0 && <span className="font-semibold text-muted">· {stickers.length}/6</span>}</p>
          <div className="flex flex-wrap gap-1.5">
            {[...STICKERS, ...SHOP.filter((i) => i.kind === "stickers" && owns(i.id)).flatMap((i) => i.stickers!)].map((e) => (
              <button
                key={e}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand text-xl disabled:opacity-40"
                disabled={stickers.length >= 6}
                onClick={() => setStickers((st) => [...st, { e, x: 30 + ((st.length * 17) % 45), y: 25 + ((st.length * 23) % 50) }])}
                aria-label={`Add ${e} sticker`}
              >
                {e}
              </button>
            ))}
            {SHOP.filter((i) => i.kind === "stickers" && !owns(i.id)).map((i) => (
              <button
                key={i.id}
                className="flex h-10 items-center gap-1 rounded-xl border border-dashed border-oat bg-paper px-2.5 text-xs font-extrabold"
                onClick={() => setBuying({ item: i.id })}
              >
                <span className="text-lg">{i.emoji}</span> 🔒 {i.price}🍪
              </button>
            ))}
            {stickers.length > 0 && (
              <button className="rounded-xl bg-sand px-3 text-xs font-extrabold" onClick={() => setStickers((st) => st.slice(0, -1))}>
                Undo
              </button>
            )}
          </div>
          <button className="card flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setPicking(true)}>
            <span className="text-xl">🏷️</span>
            <span className="flex-1 font-bold">Tag pets</span>
            <span className="flex -space-x-2">
              {tagged.slice(0, 4).map((t) => (petOf(t) ? <PetAvatar key={t} pet={petOf(t)!} size={26} /> : null))}
            </span>
            <span className="text-sm font-bold text-muted">{tagged.length || "None"}</span>
          </button>
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

        {picking && <TagPicker value={tagged} onChange={setTagged} onClose={() => setPicking(false)} />}
        {buying && <UnlockSheet itemId={buying.item} onClose={() => setBuying(null)} onUnlocked={buying.then} />}
        {editing !== null && raw[editing] && (
          <PhotoEditor
            key={editing}
            photo={raw[editing]}
            aspect={aspect}
            onAspect={setAspect}
            count={raw.length}
            onCancel={() => setEditing(null)}
            onApplyFilterToAll={(filter) => {
              setRaw((rs) => rs.map((r) => ({ ...r, edit: { ...r.edit, filter } })));
              void Promise.all(raw.map((r) => renderPhoto(r.src, aspect, { ...r.edit, filter }))).then((outs) =>
                setRaw((rs) => rs.map((r, i) => ({ ...r, out: outs[i] ?? r.out }))),
              );
              toast("Filter added to every photo ✨");
            }}
            onDone={async (p) => {
              const i = editing;
              setEditing(null);
              const out = await renderPhoto(p.src, aspect, p.edit);
              setRaw((rs) => rs.map((r, j) => (j === i ? { ...p, out } : r)));
            }}
          />
        )}
        <button className="btn btn-pink mt-6 w-full text-lg" onClick={() => void post()} disabled={busy}>
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
