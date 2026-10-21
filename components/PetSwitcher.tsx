"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { PetAvatar } from "./PetArt";
import { Sheet } from "./Sheet";

/** Switch between the pets on this account (owned or shared with family). */
export function PetSwitcher({ onClose }: { onClose: () => void }) {
  const { myPets, me, dispatch, toast, cloud } = useStore();
  return (
    <Sheet title="Your pets" onClose={onClose}>
      <ul className="space-y-1">
        {myPets.map((p) => (
          <li key={p.id}>
            <button
              className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left ${p.id === me.id ? "bg-sand" : "hover:bg-sand"}`}
              onClick={async () => {
                if (p.id !== me.id) {
                  await dispatch({ t: "switchPet", petId: p.id });
                  toast(`Switched to ${p.name} 🐾`);
                }
                onClose();
              }}
            >
              <PetAvatar pet={p} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold">{p.name}</span>
                <span className="block truncate text-xs font-semibold text-muted">@{p.handle}</span>
              </span>
              {p.id === me.id && <span className="text-sm font-extrabold text-blush">✓</span>}
            </button>
          </li>
        ))}
      </ul>
      <Link href="/onboarding?another=1" className="btn btn-dark mt-3 w-full" onClick={onClose}>
        + Add another pet
      </Link>
      {cloud && (
        <Link href="/family/join" className="btn btn-soft mt-2 w-full" onClick={onClose}>
          Join a family member&apos;s pet with a code
        </Link>
      )}
      <p className="mt-3 text-center text-xs font-semibold text-muted">Up to 6 pets per account.</p>
    </Sheet>
  );
}
