"use client";

import { useState } from "react";
import { pickPet, remote } from "@/lib/cloud";
import { useStore } from "@/lib/store";

/** Settings: share this pet with family members. */
export function FamilyCard() {
  const { me, family, cloud, userId, reload, toast, myPets } = useStore();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!cloud) {
    return <p className="py-3 text-sm font-semibold text-muted">Family sharing is available in the live app.</p>;
  }

  const invite = async () => {
    setBusy(true);
    try {
      const code = await remote.createFamilyInvite(me.id);
      setLink(`${window.location.origin}/family/join?code=${code}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!link) return;
    try {
      if (navigator.share) await navigator.share({ title: `Help manage ${me.name} on Floof`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast("Invite link copied 🔗");
      }
    } catch {
      /* cancelled */
    }
  };

  const leave = async () => {
    if (!userId || !confirm(`Stop managing ${me.name}?`)) return;
    try {
      await remote.leaveFamily(me.id, userId);
      const other = myPets.find((p) => p.id !== me.id);
      if (other) pickPet(userId, other.id);
      await reload();
      toast("You left the family pet");
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <div className="py-3">
      <p className="font-extrabold">👨‍👩‍👧 Family</p>
      <p className="text-xs font-semibold text-muted">
        {family.isOwner
          ? family.members
            ? `You and ${family.members} family member${family.members === 1 ? "" : "s"} manage ${me.name}.`
            : `Invite a partner or housemate to help manage ${me.name}.`
          : `You help manage ${me.name} with their owner.`}
      </p>
      {family.isOwner ? (
        link ? (
          <div className="mt-2 space-y-2">
            <p className="break-all rounded-xl bg-sand px-3 py-2 font-mono text-xs">{link}</p>
            <button className="btn btn-dark w-full !py-2.5 text-sm" onClick={share}>
              Share invite link
            </button>
            <p className="text-[11px] font-semibold text-muted">Works once and expires in 7 days.</p>
          </div>
        ) : (
          <button className="btn btn-soft mt-2 w-full !py-2.5 text-sm" onClick={invite} disabled={busy}>
            {busy ? "Creating…" : "Invite a family member"}
          </button>
        )
      ) : (
        <button className="btn btn-soft mt-2 w-full !py-2.5 text-sm !text-blush" onClick={leave}>
          Leave
        </button>
      )}
    </div>
  );
}
