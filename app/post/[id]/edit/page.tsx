"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { PetAvatar, PostMedia } from "@/components/PetArt";
import { TopBar } from "@/components/Shell";
import { TagPicker } from "@/components/TagPicker";
import { IconPin } from "@/components/Icons";

export default function EditPost() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { post, pet, me, dispatch, toast, ready } = useStore();
  const p = post(id);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [location, setLocation] = useState("");
  const [tagged, setTagged] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!p || loaded) return;
    setCaption(p.caption);
    setTags(p.tags.join(" "));
    setLocation(p.location ?? "");
    setTagged(p.taggedPets ?? []);
    setLoaded(true);
  }, [p, loaded]);

  if (!p) return <TopBar title={ready ? "Floof not found" : "Loading…"} />;
  if (p.petId !== me.id) return <TopBar title="You can only edit your own floofs" />;

  const save = async () => {
    const ok = await dispatch({
      t: "editPost",
      postId: p.id,
      patch: {
        caption: caption.trim() || "🐾",
        tags: tags
          .split(/[\s,#]+/)
          .map((t) => t.trim())
          .filter(Boolean),
        location: location.trim(),
        taggedPets: tagged,
      },
    });
    if (ok) {
      toast("Floof updated ✓");
      router.replace(`/post/${p.id}`);
    }
  };

  return (
    <main className="pb-10">
      <TopBar title="Edit floof" />
      <div className="space-y-3 px-4">
        <PostMedia post={p} pet={pet(p.petId)!} className="aspect-[4/3] rounded-3xl" />
        <textarea className="input min-h-24 !rounded-3xl" value={caption} maxLength={500} onChange={(e) => setCaption(e.target.value)} placeholder="Caption" />
        <input className="input" placeholder="#tags (space separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
        <div className="relative">
          <IconPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-11" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <button className="card flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setPicking(true)}>
          <span className="text-xl">🏷️</span>
          <span className="flex-1 font-bold">Tag pets</span>
          <span className="flex -space-x-2">
            {tagged.slice(0, 4).map((t) => (pet(t) ? <PetAvatar key={t} pet={pet(t)!} size={26} /> : null))}
          </span>
          <span className="text-sm font-bold text-muted">{tagged.length || "None"}</span>
        </button>
        <p className="px-2 text-xs font-semibold text-muted">Photos can&apos;t be changed after posting. Delete and re-post to swap them.</p>
        <button className="btn btn-dark w-full" onClick={save}>
          Save changes
        </button>
      </div>
      {picking && <TagPicker value={tagged} onChange={setTagged} onClose={() => setPicking(false)} />}
    </main>
  );
}
