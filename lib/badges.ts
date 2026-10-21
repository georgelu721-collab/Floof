import type { MomentType } from "./types";

export type Badge = { id: string; label: string; emoji: string; tint: string; earned: boolean };

export function badgesFor(opts: {
  posts: number;
  boops: number;
  biscuitsSent: number;
  events: number;
  moments: MomentType[];
  clan: boolean;
  friends: number;
}): Badge[] {
  const m = new Set(opts.moments);
  return [
    { id: "first-floof", label: "First Floof", emoji: "🐾", tint: "#FBD9C4", earned: opts.posts > 0 },
    { id: "boops", label: "1K Boops", emoji: "❤️", tint: "#FDE4E8", earned: opts.boops >= 1000 },
    { id: "explorer", label: "Explorer", emoji: "⛰️", tint: "#D3E9F7", earned: m.has("first-beach") || m.has("first-park") || m.has("first-snow") },
    { id: "foodie", label: "Foodie", emoji: "🦴", tint: "#FFE6CC", earned: opts.biscuitsSent >= 5 },
    { id: "butterfloof", label: "Social Butterfloof", emoji: "🦋", tint: "#E7E3F7", earned: opts.friends >= 3 },
    { id: "event", label: "Event Goer", emoji: "🎪", tint: "#FFF1C9", earned: opts.events > 0 || m.has("first-expo") },
    { id: "clan", label: "Clan Warrior", emoji: "⚔️", tint: "#EFE8FB", earned: opts.clan },
    { id: "glowup", label: "Glow Up", emoji: "✂️", tint: "#E2D8F7", earned: m.has("first-haircut") },
    { id: "rescue", label: "Rescue Supporter", emoji: "🏡", tint: "#E2F0DA", earned: false },
  ];
}
