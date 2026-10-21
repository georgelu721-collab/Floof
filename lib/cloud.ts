"use client";

import { sb } from "./supabase";
import { timeAgo } from "./data";
import type { Clan, Comment, LedgerEntry, MomentType, Notification, Pet, Post, Thread } from "./types";

/* ---------------- Row → app model mapping ---------------- */

type PetRow = {
  id: string;
  owner_id: string | null;
  handle: string;
  name: string;
  species: Pet["species"];
  breed: string;
  age: string;
  city: string;
  bio: string[];
  look: Pet["look"];
  photo_url: string | null;
  bg: string;
  clan: Clan | null;
  verified: boolean;
  paw_score_base: number;
  followers: number;
  following: number;
  biscuits_received: number;
  post_count: number;
};

type PostRow = {
  id: string;
  pet_id: string;
  scene: Post["scene"];
  accessory: Post["accessory"];
  expression: Post["expression"];
  image_url: string | null;
  image_urls: string[] | null;
  overlay: string | null;
  caption: string;
  tags: string[];
  location: string | null;
  moment: MomentType | null;
  slides: number | null;
  created_at: string;
  boop_count: number;
  comment_count: number;
  biscuit_count: number;
};

const toPet = (r: PetRow): Pet => ({
  id: r.id,
  handle: r.handle,
  name: r.name,
  species: r.species,
  breed: r.breed,
  age: r.age,
  city: r.city,
  bio: r.bio ?? [],
  owner: r.owner_id ? "member" : "Floof",
  ownerId: r.owner_id,
  look: r.look,
  photo: r.photo_url ?? undefined,
  followers: r.followers,
  following: r.following,
  biscuitsReceived: r.biscuits_received,
  pawScore: r.paw_score_base,
  postCount: r.post_count,
  clan: r.clan ?? "dogs",
  verified: r.verified,
  bg: r.bg,
});

/* ---------------- Snapshot of everything the app shows ---------------- */

export type Snapshot = {
  userId: string | null;
  myPetId: string | null;
  pets: Pet[];
  posts: Post[];
  clan: { cats: number; dogs: number };
  myClanFloofs: number;
  voteCounts: Record<string, Record<string, number>>; // competition -> post -> votes
  entries: Record<string, string[]>; // competition -> post ids (all pets)
  initialVotes: Record<string, string>;
  mine: {
    boops: Record<string, true>;
    saved: Record<string, true>;
    following: Record<string, true>;
    balance: number;
    ledger: LedgerEntry[];
    interactions: Record<string, number>;
    clan: Clan | null;
    events: Record<string, "interested" | "going">;
    checkins: Record<string, true>;
    entries: Record<string, string>;
    votes: Record<string, string>;
    packs: Record<string, true>;
    meetupsOptIn: boolean;
    threads: Record<string, Thread["messages"]>;
  } | null;
};

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const mustAny = (res: { data: unknown; error: { message: string } | null }): unknown => {
  if (res.error) throw new Error(res.error.message);
  return res.data;
};

const bump = (m: Record<string, number>, id: string, n: number) => {
  m[id] = (m[id] ?? 0) + n;
};

export async function loadSnapshot(): Promise<Snapshot> {
  const db = sb();
  const { data: auth } = await db.auth.getSession();
  const userId = auth.session?.user.id ?? null;

  const [petRows, postRows, clanRows, voteRows, entryRows] = await Promise.all([
    db.from("pet_profiles").select("*").order("created_at", { ascending: true }).limit(1000),
    db.from("post_feed").select("*").order("created_at", { ascending: false }).limit(300),
    db.from("clan_totals").select("*"),
    db.from("competition_vote_counts").select("*"),
    db.from("competition_entries").select("competition_id, post_id, pet_id"),
  ]).then((r) => r.map(mustAny)) as [PetRow[], PostRow[], { clan: Clan; points: number }[], { competition_id: string; post_id: string; votes: number }[], { competition_id: string; post_id: string; pet_id: string }[]];

  const pets = petRows.map(toPet);
  const postIds = postRows.map((p) => p.id);
  const commentRows = postIds.length
    ? must(await db.from("comments").select("id, post_id, pet_id, text, likes, created_at").in("post_id", postIds).order("created_at"))
    : [];
  const commentsByPost: Record<string, Comment[]> = {};
  for (const c of commentRows as { id: string; post_id: string; pet_id: string; text: string; likes: number; created_at: string }[]) {
    (commentsByPost[c.post_id] ??= []).push({ id: c.id, petId: c.pet_id, text: c.text, likes: c.likes, ago: timeAgo(Date.parse(c.created_at)) });
  }

  const myPet = userId ? petRows.find((p) => p.owner_id === userId) : undefined;
  const myPetId = myPet?.id ?? null;

  let mine: Snapshot["mine"] = null;
  let myBoops = new Set<string>();
  let myFollows = new Set<string>();
  if (myPetId) {
    const [boops, saves, follows, myComments, ledger, msgs, rsvps, entries, votes, packs] = (await Promise.all([
      db.from("boops").select("post_id").eq("pet_id", myPetId),
      db.from("saves").select("post_id").eq("pet_id", myPetId),
      db.from("follows").select("followee_id").eq("follower_id", myPetId),
      db.from("comments").select("post_id").eq("pet_id", myPetId),
      db.from("biscuit_ledger").select("*").eq("pet_id", myPetId).order("created_at", { ascending: false }).limit(200),
      db.from("messages").select("*").or(`from_pet.eq.${myPetId},to_pet.eq.${myPetId}`).order("created_at").limit(500),
      db.from("event_rsvps").select("*").eq("pet_id", myPetId),
      db.from("competition_entries").select("*").eq("pet_id", myPetId),
      db.from("competition_votes").select("*").eq("voter_id", myPetId),
      db.from("pack_members").select("pack_id").eq("pet_id", myPetId),
    ]).then((r) => r.map(mustAny))) as [
      { post_id: string }[],
      { post_id: string }[],
      { followee_id: string }[],
      { post_id: string }[],
      { id: string; kind: string; amount: number; counterparty_id: string | null; note: string | null; created_at: string }[],
      { id: string; from_pet: string; to_pet: string; text: string; created_at: string }[],
      { event_id: string; status: "interested" | "going"; checked_in: boolean }[],
      { competition_id: string; post_id: string }[],
      { competition_id: string; post_id: string }[],
      { pack_id: string }[],
    ];

    const ownerOf = new Map(postRows.map((p) => [p.id, p.pet_id]));
    const interactions: Record<string, number> = {};
    for (const b of boops) if (ownerOf.get(b.post_id)) bump(interactions, ownerOf.get(b.post_id)!, 1);
    for (const c of myComments) if (ownerOf.get(c.post_id)) bump(interactions, ownerOf.get(c.post_id)!, 2);
    for (const f of follows) bump(interactions, f.followee_id, 3);

    let balance = 0;
    const led: LedgerEntry[] = [];
    for (const l of ledger) {
      if (l.kind === "welcome" || l.kind === "topup") balance += l.amount;
      if (l.kind === "sent") {
        balance -= l.amount;
        if (l.counterparty_id) bump(interactions, l.counterparty_id, 5 * l.amount);
      }
      if (l.kind === "received" && l.counterparty_id) bump(interactions, l.counterparty_id, 2 * l.amount);
      led.push({
        id: l.id,
        type: l.kind === "welcome" ? "topup" : (l.kind as LedgerEntry["type"]),
        amount: l.amount,
        petId: l.counterparty_id ?? undefined,
        note: l.note ?? undefined,
        at: Date.parse(l.created_at),
      });
    }

    const threads: Record<string, Thread["messages"]> = {};
    for (const m of msgs) {
      const other = m.from_pet === myPetId ? m.to_pet : m.from_pet;
      bump(interactions, other, 1);
      (threads[`dm-${other}`] ??= []).push({
        id: m.id,
        from: m.from_pet === myPetId ? "me" : m.from_pet,
        text: m.text,
        at: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    }

    myBoops = new Set(boops.map((b) => b.post_id));
    myFollows = new Set(follows.map((f) => f.followee_id));
    mine = {
      boops: Object.fromEntries(boops.map((b) => [b.post_id, true as const])),
      saved: Object.fromEntries(saves.map((b) => [b.post_id, true as const])),
      following: Object.fromEntries(follows.map((f) => [f.followee_id, true as const])),
      balance,
      ledger: led,
      interactions,
      clan: myPet!.clan,
      events: Object.fromEntries(rsvps.map((r) => [r.event_id, r.status])),
      checkins: Object.fromEntries(rsvps.filter((r) => r.checked_in).map((r) => [r.event_id, true as const])),
      entries: Object.fromEntries(entries.map((e) => [e.competition_id, e.post_id])),
      votes: Object.fromEntries(votes.map((v) => [v.competition_id, v.post_id])),
      packs: Object.fromEntries(packs.map((p) => [p.pack_id, true as const])),
      meetupsOptIn: !!(await db.from("pets").select("meetups_opt_in").eq("id", myPetId).single()).data?.meetups_opt_in,
      threads,
    };
  }

  // Counts from the views include my own boop/follow; the UI adds those back from local state.
  const posts: Post[] = postRows.map((r) => ({
    id: r.id,
    petId: r.pet_id,
    scene: r.scene,
    accessory: r.accessory,
    expression: r.expression,
    image: r.image_url ?? undefined,
    images: r.image_urls && r.image_urls.length > 1 ? r.image_urls : undefined,
    overlay: r.overlay ?? undefined,
    caption: r.caption,
    tags: r.tags ?? [],
    location: r.location ?? undefined,
    moment: r.moment ?? undefined,
    slides: r.slides ?? undefined,
    boops: r.boop_count - (myBoops.has(r.id) ? 1 : 0),
    biscuits: r.biscuit_count,
    commentCount: r.comment_count,
    comments: commentsByPost[r.id] ?? [],
    createdAt: Date.parse(r.created_at),
  }));
  for (const p of pets) if (myFollows.has(p.id)) p.followers -= 1;

  const weekAgo = Date.now() - 7 * 86_400_000;
  const myClanFloofs = myPetId ? posts.filter((p) => p.petId === myPetId && p.createdAt > weekAgo).length : 0;
  const clan = { cats: 0, dogs: 0 };
  for (const c of clanRows) clan[c.clan] = c.points;

  const voteCounts: Snapshot["voteCounts"] = {};
  for (const v of voteRows) (voteCounts[v.competition_id] ??= {})[v.post_id] = v.votes;
  const allEntries: Snapshot["entries"] = {};
  for (const e of entryRows) (allEntries[e.competition_id] ??= []).push(e.post_id);

  return { userId, myPetId, pets, posts, clan, myClanFloofs, voteCounts, entries: allEntries, initialVotes: mine?.votes ?? {}, mine };
}

/* ---------------- Writes ---------------- */

function dataUrlToBlob(dataUrl: string) {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Upload a data URL photo to the public "media" bucket and return its URL. */
export async function uploadPhoto(dataUrl: string, name: string) {
  const db = sb();
  const { data: auth } = await db.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) throw new Error("Please log in first");
  const path = `${uid}/${name}-${Date.now().toString(36)}.jpg`;
  must(await db.storage.from("media").upload(path, dataUrlToBlob(dataUrl), { contentType: "image/jpeg", upsert: false }));
  return db.storage.from("media").getPublicUrl(path).data.publicUrl;
}

const check = (r: { error: { message: string; code?: string } | null }) => {
  if (r.error) throw new Error(r.error.code === "23505" ? "That username is already taken" : r.error.message);
};

export const remote = {
  async createPet(pet: Pet) {
    const db = sb();
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) throw new Error("Please log in first");
    const photo = pet.photo?.startsWith("data:") ? await uploadPhoto(pet.photo, "avatar") : pet.photo;
    check(
      await db.from("pets").insert({
        owner_id: auth.session.user.id,
        handle: pet.handle,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        age: pet.age,
        city: pet.city,
        bio: pet.bio,
        look: pet.look,
        photo_url: photo ?? null,
        bg: pet.bg,
        clan: pet.clan,
      }),
    );
  },
  async updatePet(id: string, patch: Partial<{ clan: Clan; meetups_opt_in: boolean; name: string; bio: string[]; photo_url: string }>) {
    check(await sb().from("pets").update(patch).eq("id", id));
  },
  async toggle(table: "boops" | "saves", on: boolean, row: { post_id: string; pet_id: string }) {
    const q = sb().from(table);
    check(on ? await q.upsert(row, { ignoreDuplicates: true }) : await q.delete().match(row));
  },
  async follow(on: boolean, follower: string, followee: string) {
    const q = sb().from("follows");
    const row = { follower_id: follower, followee_id: followee };
    check(on ? await q.upsert(row, { ignoreDuplicates: true }) : await q.delete().match(row));
  },
  async comment(postId: string, petId: string, text: string) {
    check(await sb().from("comments").insert({ post_id: postId, pet_id: petId, text }));
  },
  async post(p: Post) {
    const all = p.images?.length ? p.images : p.image ? [p.image] : [];
    const urls = await Promise.all(all.map((src, i) => (src.startsWith("data:") ? uploadPhoto(src, `post-${i + 1}`) : Promise.resolve(src))));
    const image = urls[0];
    check(
      await sb().from("posts").insert({
        id: p.id,
        pet_id: p.petId,
        scene: p.scene,
        accessory: p.accessory,
        expression: p.expression,
        image_url: image ?? null,
        image_urls: urls,
        overlay: p.overlay ?? null,
        caption: p.caption,
        tags: p.tags,
        location: p.location ?? null,
        moment: p.moment ?? null,
      }),
    );
  },
  async sendBiscuits(from: string, to: string, amount: number, note?: string, postId?: string) {
    check(await sb().rpc("send_biscuits", { p_from: from, p_to: to, p_amount: amount, p_note: note ?? null, p_post: postId ?? null }));
  },
  async topup(pet: string, amount: number) {
    check(await sb().rpc("topup_biscuits", { p_pet: pet, p_amount: amount }));
  },
  async redeem(pet: string, amount: number, note: string) {
    check(await sb().rpc("redeem_biscuits", { p_pet: pet, p_amount: amount, p_note: note }));
  },
  async rsvp(eventId: string, petId: string, status: "interested" | "going" | null) {
    const q = sb().from("event_rsvps");
    check(status ? await q.upsert({ event_id: eventId, pet_id: petId, status }) : await q.delete().match({ event_id: eventId, pet_id: petId }));
  },
  async checkin(eventId: string, petId: string) {
    check(await sb().from("event_rsvps").upsert({ event_id: eventId, pet_id: petId, status: "going", checked_in: true }));
  },
  async enter(compId: string, petId: string, postId: string) {
    check(await sb().from("competition_entries").insert({ competition_id: compId, pet_id: petId, post_id: postId }));
  },
  async vote(compId: string, petId: string, postId: string) {
    check(await sb().from("competition_votes").upsert({ competition_id: compId, voter_id: petId, post_id: postId }));
  },
  async pack(on: boolean, packId: string, petId: string) {
    const q = sb().from("pack_members");
    check(on ? await q.upsert({ pack_id: packId, pet_id: petId }, { ignoreDuplicates: true }) : await q.delete().match({ pack_id: packId, pet_id: petId }));
  },
  async message(from: string, to: string, text: string) {
    check(await sb().from("messages").insert({ from_pet: from, to_pet: to, text }));
  },
};

/* ---------------- Notifications from real activity ---------------- */

/** Pet ids that follow this pet, or that this pet follows (newest first). */
export async function loadFollowList(petId: string, kind: "followers" | "following"): Promise<string[]> {
  const col = kind === "followers" ? "follower_id" : "followee_id";
  const match = kind === "followers" ? "followee_id" : "follower_id";
  const rows = mustAny(
    await sb().from("follows").select(col).eq(match, petId).order("created_at", { ascending: false }).limit(1000),
  ) as Record<string, string>[];
  return rows.map((r) => r[col]);
}

export async function loadNotifications(petId: string): Promise<Notification[]> {
  const db = sb();
  const [boops, comments, follows, biscuits] = (await Promise.all([
    db.from("boops").select("pet_id, post_id, created_at, posts!inner(pet_id)").eq("posts.pet_id", petId).neq("pet_id", petId).order("created_at", { ascending: false }).limit(30),
    db.from("comments").select("pet_id, post_id, text, created_at, posts!inner(pet_id)").eq("posts.pet_id", petId).neq("pet_id", petId).order("created_at", { ascending: false }).limit(30),
    db.from("follows").select("follower_id, created_at").eq("followee_id", petId).order("created_at", { ascending: false }).limit(30),
    db.from("biscuit_ledger").select("id, counterparty_id, amount, note, post_id, created_at").eq("pet_id", petId).eq("kind", "received").order("created_at", { ascending: false }).limit(30),
  ]).then((r) => r.map(mustAny))) as [
    { pet_id: string; post_id: string; created_at: string }[],
    { pet_id: string; post_id: string; text: string; created_at: string }[],
    { follower_id: string; created_at: string }[],
    { id: string; counterparty_id: string | null; amount: number; note: string | null; post_id: string | null; created_at: string }[],
  ];

  const list: (Notification & { t: number })[] = [
    ...boops.map((b, i) => ({ id: `b${i}`, petId: b.pet_id, kind: "boop" as const, text: "booped your floof", postId: b.post_id, t: Date.parse(b.created_at), ago: "" })),
    ...comments.map((c, i) => ({ id: `c${i}`, petId: c.pet_id, kind: "comment" as const, text: `commented: “${c.text}”`, postId: c.post_id, t: Date.parse(c.created_at), ago: "" })),
    ...follows.map((f, i) => ({ id: `f${i}`, petId: f.follower_id, kind: "follow" as const, text: "started following you", t: Date.parse(f.created_at), ago: "" })),
    ...biscuits
      .filter((b) => b.counterparty_id)
      .map((b) => ({
        id: b.id,
        petId: b.counterparty_id!,
        kind: "biscuit" as const,
        text: `sent you ${b.amount} biscuit${b.amount > 1 ? "s" : ""} 🍪${b.note ? ` “${b.note}”` : ""}`,
        postId: b.post_id ?? undefined,
        t: Date.parse(b.created_at),
        ago: "",
      })),
  ];
  return list
    .sort((a, b) => b.t - a.t)
    .slice(0, 50)
    .map((n) => ({ ...n, ago: timeAgo(n.t) }));
}

/** Calls back when someone sends my pet a message. Returns an unsubscribe function. */
export function subscribeToMessages(petId: string, onMessage: (m: { id: string; from_pet: string; text: string; created_at: string }) => void) {
  const channel = sb()
    .channel(`dm-${petId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `to_pet=eq.${petId}` }, (payload) =>
      onMessage(payload.new as { id: string; from_pet: string; text: string; created_at: string }),
    )
    .subscribe();
  return () => {
    void sb().removeChannel(channel);
  };
}
