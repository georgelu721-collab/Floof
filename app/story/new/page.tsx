"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fileToDataUrl } from "@/lib/image";
import { newUuid, useStore } from "@/lib/store";
import { IconImage, IconX } from "@/components/Icons";

const BGS = ["#F7A07A", "#EE7A8C", "#8E7CC3", "#8FBF7C", "#A9CDEB", "#4A2E22", "#FBD58A"];

export default function NewStory() {
  const router = useRouter();
  const { me, dispatch, toast, signedIn, ready } = useStore();
  const [image, setImage] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [bg, setBg] = useState(BGS[0]);
  const [busy, setBusy] = useState(false);

  if (ready && !signedIn) {
    router.replace("/login");
    return null;
  }

  const share = async () => {
    if (!image && !text.trim()) return toast("Add a photo or some text first");
    setBusy(true);
    const ok = await dispatch({
      t: "postStory",
      story: { id: newUuid(), petId: me.id, image, text: text.trim() || undefined, bg, createdAt: Date.now(), expiresAt: Date.now() + 86_400_000 },
    });
    setBusy(false);
    if (ok) {
      toast("Added to your story ✨ (24 hours)");
      router.replace("/home");
    }
  };

  return (
    <main className="fixed inset-0 z-50 mx-auto flex max-w-[440px] flex-col bg-[#2B1B15] text-white">
      <div className="flex items-center justify-between p-4 pt-[max(env(safe-area-inset-top),14px)]">
        <button onClick={() => router.back()} aria-label="Close">
          <IconX />
        </button>
        <p className="font-display text-lg font-semibold">New story</p>
        <span className="w-6" />
      </div>
      <div className="mx-4 mb-3 grid grid-cols-2 rounded-full bg-white/10 p-1 text-sm font-extrabold">
        <Link href="/create" replace className="py-2 text-center text-white/60">
          📸 Post
        </Link>
        <span className="rounded-full bg-white/90 py-2 text-center text-cocoa">⏳ Story</span>
      </div>

      <div className="relative mx-4 flex-1 overflow-hidden rounded-3xl" style={{ background: image ? "#000" : bg }}>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <textarea
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          placeholder={image ? "Add text…" : "Type something…"}
          className={`absolute inset-x-4 ${image ? "bottom-6 bg-black/35 py-2" : "top-1/2 -translate-y-1/2 bg-transparent"} resize-none rounded-2xl px-3 text-center font-display text-2xl font-semibold text-white placeholder:text-white/60 focus:outline-none`}
          rows={image ? 2 : 4}
        />
      </div>

      <div className="space-y-3 p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
        {!image && (
          <div className="flex justify-center gap-2">
            {BGS.map((c) => (
              <button key={c} onClick={() => setBg(c)} className={`h-8 w-8 rounded-full ${bg === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#2B1B15]" : ""}`} style={{ background: c }} aria-label={`Background ${c}`} />
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="btn cursor-pointer bg-white/15 text-white">
            <IconImage size={18} /> {image ? "Change photo" : "Add photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setImage(await fileToDataUrl(f, 1080));
              }}
            />
          </label>
          <button className="btn bg-white text-cocoa" onClick={share} disabled={busy}>
            {busy ? "Sharing…" : "Share to story"}
          </button>
        </div>
        <p className="text-center text-xs text-white/60">Stories disappear after 24 hours.</p>
      </div>
    </main>
  );
}
