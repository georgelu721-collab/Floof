"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { breedPackId, breedSlug } from "@/lib/breeds";
import { useStore } from "@/lib/store";
import { PetAvatar, PostMedia } from "@/components/PetArt";
import { Page, SectionTitle, TopBar } from "@/components/Shell";

export default function BreedClub() {
  const { slug } = useParams<{ slug: string }>();
  const { pets, posts, s, dispatch, signedIn, toast } = useStore();
  const members = pets.filter((p) => p.breed && breedSlug(p.breed) === slug);
  const name = members[0]?.breed ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const ids = new Set(members.map((p) => p.id));
  const feed = posts.filter((p) => ids.has(p.petId) && (p.status === undefined || p.status === "approved")).slice(0, 30);
  const packId = breedPackId(slug);
  const joined = !!s.packs[packId];

  return (
    <Page>
      <TopBar title={`${name} Club`} sub={`${members.length} pet${members.length === 1 ? "" : "s"} on Floof`} />
      <section className="card mx-4 flex items-center gap-3 p-4">
        <div className="flex -space-x-3">
          {members.slice(0, 4).map((p) => (
            <PetAvatar key={p.id} pet={p} size={44} />
          ))}
        </div>
        <p className="flex-1 text-sm font-semibold text-cocoa-soft">Tips, photos and meetups for {name} families.</p>
        {signedIn && (
          <button
            className={`rounded-full px-4 py-2 text-sm font-extrabold ${joined ? "bg-sand" : "bg-blush text-white"}`}
            onClick={async () => {
              if (await dispatch({ t: "pack", id: packId })) toast(joined ? `Left the ${name} Club` : `Welcome to the ${name} Club! 🐾`);
            }}
          >
            {joined ? "Joined ✓" : "Join club"}
          </button>
        )}
      </section>

      <SectionTitle>Members</SectionTitle>
      <div className="no-scrollbar flex gap-4 overflow-x-auto px-4">
        {members.map((p) => (
          <Link key={p.id} href={`/profile/${p.handle}`} className="flex w-16 shrink-0 flex-col items-center">
            <PetAvatar pet={p} size={56} />
            <span className="mt-1 w-full truncate text-center text-xs font-bold">{p.name}</span>
          </Link>
        ))}
      </div>

      <SectionTitle>Floofs</SectionTitle>
      <div className="grid grid-cols-3 gap-0.5">
        {feed.map((p) => (
          <Link key={p.id} href={`/post/${p.id}`}>
            <PostMedia post={p} pet={pets.find((x) => x.id === p.petId)!} className="aspect-square" />
          </Link>
        ))}
      </div>
      {feed.length === 0 && <p className="px-8 py-10 text-center font-semibold text-muted">No floofs from this breed yet.</p>}
    </Page>
  );
}
