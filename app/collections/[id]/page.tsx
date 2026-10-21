"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { PostMedia } from "@/components/PetArt";
import { Page, TopBar } from "@/components/Shell";

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { s, posts, pet, dispatch, me, ready, toast } = useStore();
  const c = s.collections.find((x) => x.id === id);
  if (!c) return <Page><TopBar title={ready ? "Collection not found" : "Loading…"} /></Page>;
  const items = [...c.postIds].reverse().map((pid) => posts.find((p) => p.id === pid)).filter((p) => !!p);

  return (
    <Page>
      <TopBar
        title={c.name}
        sub={`${c.postIds.length} saved · private`}
        right={
          <div className="flex gap-1">
            <button
              className="rounded-full px-3 py-1.5 text-sm font-bold hover:bg-sand"
              onClick={() => {
                const name = prompt("Rename collection", c.name)?.trim();
                if (name) void dispatch({ t: "renameCollection", id: c.id, name: name.slice(0, 40) });
              }}
            >
              Rename
            </button>
            <button
              className="rounded-full px-3 py-1.5 text-sm font-bold text-blush hover:bg-sand"
              onClick={async () => {
                if (!confirm(`Delete “${c.name}”? The floofs stay saved.`)) return;
                await dispatch({ t: "deleteCollection", id: c.id });
                toast("Collection deleted");
                router.replace(`/profile/${me.handle}`);
              }}
            >
              Delete
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-3 gap-0.5">
        {items.map((p) => (
          <div key={p!.id} className="group relative">
            <Link href={`/post/${p!.id}`}>
              <PostMedia post={p!} pet={pet(p!.petId)!} className="aspect-square" />
            </Link>
            <button
              className="absolute right-1 top-1 rounded-full bg-cocoa/70 px-1.5 text-xs font-bold text-white"
              onClick={() => void dispatch({ t: "collectionItem", collectionId: c.id, postId: p!.id, on: false })}
              aria-label="Remove from collection"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="px-8 py-16 text-center font-semibold text-muted">Nothing here yet. Tap 🔖 on a floof to add it.</p>}
    </Page>
  );
}
