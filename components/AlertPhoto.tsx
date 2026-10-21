"use client";

import { useStore } from "@/lib/store";
import type { LostAlert } from "@/lib/types";
import { PetAvatar } from "./PetArt";

export function AlertPhoto({ alert, className = "" }: { alert: LostAlert; className?: string }) {
  const { pet } = useStore();
  const p = alert.petId ? pet(alert.petId) : undefined;
  if (alert.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={alert.photo} alt={alert.name} className={`object-cover ${className}`} />;
  }
  if (p) return <PetAvatar pet={p} size={96} className={className} />;
  return <div className={`flex items-center justify-center bg-sand text-4xl ${className}`}>{alert.kind === "lost" ? "🐾" : "🏠"}</div>;
}

