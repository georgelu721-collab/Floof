"use client";

import { sb } from "./supabase";
import { timeAgo } from "./data";
import { addDays, dayKey } from "./daily";
import { makeThumb } from "./photo";
import { shopItem } from "./shop";
import type { Clan, Collection, Comment, LedgerEntry, LostAlert, MomentType, Note, Notification, Pet, Playdate, Post, Reminder, Sticker, Story, Thread, Weight } from "./types";

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
  birthday: string | null;
  gotcha_day: string | null;
  personality: string | null;
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
  status: "pending" | "approved" | "rejected" | null;
  moderation_note: string | null;
  slides: number | null;
  daily_date: string | null;
  tagged_pets: string[] | null;
  frame: string | null;
  stickers: Sticker[] | null;
  edited_at: string | null;
  aspect?: "square" | "portrait" | null;
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
  birthday: r.birthday ?? undefined,
  gotchaDay: r.gotcha_day ?? undefined,
  personality: r.personality ?? undefined,
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
  dailyVoteCounts: Record<string, Record<string, number>>; // day -> post -> votes
  alerts: LostAlert[];
  stories: Story[];
  myPets: string[]; // pets this account owns or helps manage
  mine: {
    commentLikes: Record<string, true>;
    unlocks: Record<string, true>;
    notes: Note[];
    collections: Collection[];
    pawFivesSent: Record<string, string>; // pet -> last day I paw-fived them
    playdates: Playdate[];
    seenStories: Record<string, true>;
    storyViewers: Record<string, string[]>; // my story -> viewer pets
    family: { isOwner: boolean; members: number };
    dailyVotes: Record<string, string>; // day -> post I voted for
    myPostDays: string[];
    interactionDays: Record<string, string[]>; // pet -> days I interacted with them
    reminders: Reminder[];
    weights: Weight[];
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

/** For newer features: if the table isn't set up yet, carry on with nothing instead of failing. */
const soft = (res: { data: unknown; error: { message: string } | null }): unknown => (res.error ? [] : res.data);

const bump = (m: Record<string, number>, id: string, n: number) => {
  m[id] = (m[id] ?? 0) + n;
};

type AlertRow = {
  id: string;
  kind: "lost" | "found";
  reporter_id: string;
  pet_id: string | null;
  name: string;
  description: string;
  suburb: string;
  city: string;
  last_seen: string;
  photo_url: string | null;
  status: "active" | "resolved";
  resolved_at: string | null;
  created_at: string;
};

const toAlert = (a: AlertRow): LostAlert => ({
  id: a.id,
  kind: a.kind,
  reporterId: a.reporter_id,
  petId: a.pet_id ?? undefined,
  name: a.name,
  description: a.description,
  suburb: a.suburb,
  city: a.city,
  lastSeen: a.last_seen,
  photo: a.photo_url ?? undefined,
  status: a.status,
  createdAt: Date.parse(a.created_at),
});

const PICK_KEY = (uid: string) => `floof:pet:${uid}`;
function readPickedPet(uid: string) {
  try {
    return localStorage.getItem(PICK_KEY(uid));
  } catch {
    return null;
  }
}
/** Switch which of my pets I'm using. */
export function pickPet(uid: string, petId: string) {
  try {
    localStorage.setItem(PICK_KEY(uid), petId);
  } catch {
    /* ignore */
  }
}

export async function loadSnapshot(): Promise<Snapshot> {
  const db = sb();
  const { data: auth } = await db.auth.getSession();
  const userId = auth.session?.user.id ?? null;

  const today = dayKey();
  const yesterday = addDays(today, -1);
  const [petRows, feedRows, clanRows, voteRows, entryRows, dailyRows, dailyVoteRows, alertRows, storyRows, memberRows] = await Promise.all([
    db.from("pet_profiles").select("*").order("created_at", { ascending: true }).limit(1000),
    db.from("post_feed").select("*").order("created_at", { ascending: false }).limit(300),
    db.from("clan_totals").select("*"),
    db.from("competition_vote_counts").select("*"),
    db.from("competition_entries").select("competition_id, post_id, pet_id"),
    db.from("post_feed").select("*").gte("daily_date", addDays(today, -2)).order("created_at", { ascending: false }).limit(300),
    db.from("daily_votes").select("day, post_id, voter_id").gte("day", yesterday).limit(5000),
    db.from("lost_alerts").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("stories").select("*").gt("expires_at", new Date().toISOString()).order("created_at").limit(500),
    userId ? db.from("pet_members").select("pet_id").eq("user_id", userId) : Promise.resolve({ data: [], error: null }),
  ]).then((r) => r.map((x, i) => (i >= 5 ? soft(x) : mustAny(x)))) as [
    PetRow[],
    PostRow[],
    { clan: Clan; points: number }[],
    { competition_id: string; post_id: string; votes: number }[],
    { competition_id: string; post_id: string; pet_id: string }[],
    PostRow[],
    { day: string; post_id: string; voter_id: string }[],
    AlertRow[],
    { id: string; pet_id: string; image_url: string | null; text: string | null; bg: string; created_at: string; expires_at: string }[],
    { pet_id: string }[],
  ];

  // Which pet am I? An account can own or help manage several; remember the last one picked.
  const memberOf = new Set(memberRows.map((m) => m.pet_id));
  const myPetRows = userId ? petRows.filter((p) => p.owner_id === userId || memberOf.has(p.id)) : [];
  const myPets = myPetRows.map((p) => p.id);
  const picked = userId ? readPickedPet(userId) : null;
  const myPet = myPetRows.find((p) => p.id === picked) ?? myPetRows.find((p) => p.owner_id === userId) ?? myPetRows[0];
  const myPetId = myPet?.id ?? null;

  // Today's / yesterday's Daily Floof answers and posts I'm tagged in, even if older than the main feed window.
  const taggedRows = myPetId
    ? ((soft(await db.from("post_feed").select("*").contains("tagged_pets", [myPetId]).order("created_at", { ascending: false }).limit(100)) as PostRow[]) ?? [])
    : [];
  const postRows = [...feedRows];
  for (const extra of [...dailyRows, ...taggedRows]) if (!postRows.some((f) => f.id === extra.id)) postRows.push(extra);

  const pets = petRows.map(toPet);
  const postIds = postRows.map((p) => p.id);
  const commentRows = (postIds.length
    ? must(await db.from("comments").select("*").in("post_id", postIds).order("created_at"))
    : []) as { id: string; post_id: string; pet_id: string; text: string; likes: number; created_at: string; parent_id?: string | null }[];
  const likeRows = (commentRows.length
    ? soft(await db.from("comment_like_counts").select("*").in("comment_id", commentRows.map((c) => c.id)))
    : []) as { comment_id: string; likes: number }[];
  const likeCount = new Map(likeRows.map((l) => [l.comment_id, l.likes]));
  const commentsByPost: Record<string, Comment[]> = {};
  for (const c of commentRows) {
    (commentsByPost[c.post_id] ??= []).push({
      id: c.id,
      petId: c.pet_id,
      text: c.text,
      likes: c.likes + (likeCount.get(c.id) ?? 0),
      parentId: c.parent_id ?? undefined,
      ago: timeAgo(Date.parse(c.created_at)),
    });
  }
  const stories: Story[] = storyRows.map((s) => ({
    id: s.id,
    petId: s.pet_id,
    image: s.image_url ?? undefined,
    text: s.text ?? undefined,
    bg: s.bg,
    createdAt: Date.parse(s.created_at),
    expiresAt: Date.parse(s.expires_at),
  }));

  let mine: Snapshot["mine"] = null;
  let myBoops = new Set<string>();
  let myFollows = new Set<string>();
  if (myPetId) {
    const [boops, saves, follows, myComments, ledger, msgs, rsvps, entries, votes, packs, myPostDates, reminderRows, weightRows] = (await Promise.all([
      db.from("boops").select("post_id, created_at").eq("pet_id", myPetId),
      db.from("saves").select("post_id").eq("pet_id", myPetId),
      db.from("follows").select("followee_id").eq("follower_id", myPetId),
      db.from("comments").select("post_id, created_at").eq("pet_id", myPetId),
      db.from("biscuit_ledger").select("*").eq("pet_id", myPetId).order("created_at", { ascending: false }).limit(200),
      db.from("messages").select("*").or(`from_pet.eq.${myPetId},to_pet.eq.${myPetId}`).order("created_at").limit(500),
      db.from("event_rsvps").select("*").eq("pet_id", myPetId),
      db.from("competition_entries").select("*").eq("pet_id", myPetId),
      db.from("competition_votes").select("*").eq("voter_id", myPetId),
      db.from("pack_members").select("pack_id").eq("pet_id", myPetId),
      db.from("posts").select("created_at").eq("pet_id", myPetId).order("created_at", { ascending: false }).limit(1000),
      db.from("reminders").select("*").eq("pet_id", myPetId).order("due_date"),
      db.from("pet_weights").select("*").eq("pet_id", myPetId).order("measured_on"),
    ]).then((r) => r.map((x, i) => (i >= 10 ? soft(x) : mustAny(x))))) as [
      { post_id: string; created_at: string }[],
      { post_id: string }[],
      { followee_id: string }[],
      { post_id: string; created_at: string }[],
      { id: string; kind: string; amount: number; counterparty_id: string | null; post_id: string | null; note: string | null; created_at: string }[],
      { id: string; from_pet: string; to_pet: string; text: string; created_at: string; reply_to?: string | null }[],
      { event_id: string; status: "interested" | "going"; checked_in: boolean }[],
      { competition_id: string; post_id: string }[],
      { competition_id: string; post_id: string }[],
      { pack_id: string }[],
      { created_at: string }[],
      { id: string; title: string; kind: Reminder["kind"]; due_date: string; repeat: Reminder["repeat"] }[],
      { id: string; measured_on: string; kg: number | string }[],
    ];

    const myStoryIds = stories.filter((s) => s.petId === myPetId).map((s) => s.id);
    const [myLikes, cols, colItems, pawRows, playRows, reactRows, seenRows, viewerRows, memberCount, unlockRows, noteRows] = (await Promise.all([
      db.from("comment_likes").select("comment_id").eq("pet_id", myPetId),
      db.from("collections").select("*").eq("pet_id", myPetId).order("created_at"),
      db.from("collection_items").select("collection_id, post_id, collections!inner(pet_id)").eq("collections.pet_id", myPetId),
      db.from("paw_fives").select("*").or(`from_pet.eq.${myPetId},to_pet.eq.${myPetId}`).gte("day", addDays(today, -60)),
      db.from("playdates").select("*").or(`from_pet.eq.${myPetId},to_pet.eq.${myPetId}`).order("starts_at"),
      msgs.length ? db.from("message_reactions").select("*").in("message_id", msgs.map((m) => m.id)) : Promise.resolve({ data: [], error: null }),
      db.from("story_views").select("story_id").eq("viewer_id", myPetId),
      myStoryIds.length ? db.from("story_views").select("story_id, viewer_id").in("story_id", myStoryIds) : Promise.resolve({ data: [], error: null }),
      db.from("pet_members").select("user_id").eq("pet_id", myPetId),
      db.from("shop_unlocks").select("item").eq("pet_id", myPetId),
      db.from("pet_notes").select("*").eq("pet_id", myPetId).order("updated_at", { ascending: false }),
    ]).then((r) => r.map(soft))) as [
      { comment_id: string }[],
      { id: string; name: string }[],
      { collection_id: string; post_id: string }[],
      { from_pet: string; to_pet: string; day: string; created_at: string }[],
      { id: string; from_pet: string; to_pet: string; place: string; starts_at: string; note: string; status: Playdate["status"] }[],
      { message_id: string; pet_id: string; emoji: string }[],
      { story_id: string }[],
      { story_id: string; viewer_id: string }[],
      { user_id: string }[],
      { item: string }[],
      { id: string; title: string; body: string; pinned: boolean; updated_at: string }[],
    ];
    const reactionsByMsg: Record<string, Record<string, string>> = {};
    for (const r of reactRows) (reactionsByMsg[r.message_id] ??= {})[r.pet_id] = r.emoji;

    // Which days I interacted with each pet (for best-friend streaks).
    const days: Record<string, Set<string>> = {};
    const mark = (pet: string | undefined | null, iso: string) => {
      if (!pet || pet === myPetId) return;
      (days[pet] ??= new Set()).add(dayKey(new Date(iso)));
    };

    const ownerOf = new Map(postRows.map((p) => [p.id, p.pet_id]));
    const interactions: Record<string, number> = {};
    for (const b of boops) if (ownerOf.get(b.post_id)) {
      bump(interactions, ownerOf.get(b.post_id)!, 1);
      mark(ownerOf.get(b.post_id), b.created_at);
    }
    for (const c of myComments) if (ownerOf.get(c.post_id)) {
      bump(interactions, ownerOf.get(c.post_id)!, 2);
      mark(ownerOf.get(c.post_id), c.created_at);
    }
    for (const f of follows) bump(interactions, f.followee_id, 3);

    let balance = 0;
    const led: LedgerEntry[] = [];
    for (const l of ledger) {
      if (l.kind === "welcome" || l.kind === "topup") balance += l.amount;
      if (l.kind === "shop") balance -= l.amount;
      if (l.kind === "sent") {
        balance -= l.amount;
        if (l.counterparty_id) bump(interactions, l.counterparty_id, 5 * l.amount);
        mark(l.counterparty_id, l.created_at);
      }
      if (l.kind === "received" && l.counterparty_id) bump(interactions, l.counterparty_id, 2 * l.amount);
      led.push({
        id: l.id,
        type: l.kind === "welcome" ? "topup" : (l.kind as LedgerEntry["type"]),
        amount: l.amount,
        petId: l.counterparty_id ?? undefined,
        postId: l.post_id ?? undefined,
        note: l.note?.startsWith("Biscuit Shop: ") ? `Biscuit Shop: ${shopItem(l.note.slice(14))?.name ?? l.note.slice(14)}` : (l.note ?? undefined),
        at: Date.parse(l.created_at),
      });
    }

    const threads: Record<string, Thread["messages"]> = {};
    for (const m of msgs) {
      const other = m.from_pet === myPetId ? m.to_pet : m.from_pet;
      bump(interactions, other, 1);
      if (m.from_pet === myPetId) mark(other, m.created_at);
      (threads[`dm-${other}`] ??= []).push({
        id: m.id,
        from: m.from_pet === myPetId ? "me" : m.from_pet,
        text: m.text,
        replyTo: m.reply_to ?? undefined,
        reactions: reactionsByMsg[m.id],
        ts: Date.parse(m.created_at),
        at: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    }

    myBoops = new Set(boops.map((b) => b.post_id));
    myFollows = new Set(follows.map((f) => f.followee_id));
    for (const p of pawRows) if (p.from_pet === myPetId) mark(p.to_pet, p.created_at);
    const pawFivesSent: Record<string, string> = {};
    for (const p of pawRows) if (p.from_pet === myPetId && (pawFivesSent[p.to_pet] ?? "") < p.day) pawFivesSent[p.to_pet] = p.day;
    const storyViewers: Record<string, string[]> = {};
    for (const v of viewerRows) (storyViewers[v.story_id] ??= []).push(v.viewer_id);

    mine = {
      commentLikes: Object.fromEntries(myLikes.map((l) => [l.comment_id, true as const])),
      unlocks: Object.fromEntries(unlockRows.map((u) => [u.item, true as const])),
      notes: noteRows.map((n) => ({ id: n.id, title: n.title, body: n.body, pinned: n.pinned, updatedAt: Date.parse(n.updated_at) })),
      collections: cols.map((c) => ({ id: c.id, name: c.name, postIds: colItems.filter((i) => i.collection_id === c.id).map((i) => i.post_id) })),
      pawFivesSent,
      playdates: playRows.map((p) => ({ id: p.id, fromPet: p.from_pet, toPet: p.to_pet, place: p.place, startsAt: Date.parse(p.starts_at), note: p.note, status: p.status })),
      seenStories: Object.fromEntries(seenRows.map((v) => [v.story_id, true as const])),
      storyViewers,
      family: { isOwner: myPet!.owner_id === userId, members: memberCount.length },
      dailyVotes: Object.fromEntries(dailyVoteRows.filter((v) => v.voter_id === myPetId).map((v) => [v.day, v.post_id])),
      myPostDays: [...new Set(myPostDates.map((p) => dayKey(new Date(p.created_at))))],
      interactionDays: Object.fromEntries(Object.entries(days).map(([k, v]) => [k, [...v]])),
      reminders: reminderRows.map((r) => ({ id: r.id, title: r.title, kind: r.kind, due: r.due_date, repeat: r.repeat })),
      weights: weightRows.map((w) => ({ id: w.id, date: w.measured_on, kg: Number(w.kg) })),
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
    status: r.status ?? "approved",
    moderationNote: r.moderation_note ?? undefined,
    slides: r.slides ?? undefined,
    dailyDate: r.daily_date ?? undefined,
    taggedPets: r.tagged_pets?.length ? r.tagged_pets : undefined,
    frame: r.frame ?? undefined,
    aspect: r.aspect === "portrait" ? "portrait" : undefined,
    stickers: r.stickers?.length ? r.stickers : undefined,
    editedAt: r.edited_at ? Date.parse(r.edited_at) : undefined,
    boops: r.boop_count - (myBoops.has(r.id) ? 1 : 0),
    biscuits: r.biscuit_count,
    commentCount: r.comment_count,
    comments: commentsByPost[r.id] ?? [],
    createdAt: Date.parse(r.created_at),
  }));
  for (const p of pets) if (myFollows.has(p.id)) p.followers -= 1;

  // Re-check my photo posts that got stuck waiting (e.g. the check was interrupted).
  if (myPetId) {
    for (const p of posts) {
      if (p.petId === myPetId && p.status === "pending" && Date.now() - p.createdAt > 20_000) void moderatePost(p.id);
    }
  }

  const weekAgo = Date.now() - 7 * 86_400_000;
  const myClanFloofs = myPetId ? posts.filter((p) => p.petId === myPetId && p.createdAt > weekAgo).length : 0;
  const clan = { cats: 0, dogs: 0 };
  for (const c of clanRows) clan[c.clan] = c.points;

  const voteCounts: Snapshot["voteCounts"] = {};
  for (const v of voteRows) (voteCounts[v.competition_id] ??= {})[v.post_id] = v.votes;
  const allEntries: Snapshot["entries"] = {};
  for (const e of entryRows) (allEntries[e.competition_id] ??= []).push(e.post_id);

  const dailyVoteCounts: Snapshot["dailyVoteCounts"] = {};
  for (const v of dailyVoteRows) {
    const day = (dailyVoteCounts[v.day] ??= {});
    day[v.post_id] = (day[v.post_id] ?? 0) + 1;
  }
  const weekAgoIso = Date.now() - 7 * 86_400_000;
  const alerts = alertRows
    .filter((a) => a.status === "active" || (a.resolved_at && Date.parse(a.resolved_at) > weekAgoIso))
    .map(toAlert);

  return {
    userId,
    myPetId,
    pets,
    posts,
    clan,
    myClanFloofs,
    voteCounts,
    entries: allEntries,
    initialVotes: mine?.votes ?? {},
    dailyVoteCounts,
    alerts,
    stories,
    myPets,
    mine,
  };
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
export async function uploadPhoto(dataUrl: string, name: string, thumb?: string) {
  const db = sb();
  const { data: auth } = await db.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) throw new Error("Please log in first");
  const base = `${uid}/${name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  // Photos with a small copy are named *.f.jpg / *.t.jpg so grids can load the small one (see thumbOf).
  const path = thumb ? `${base}.f.jpg` : `${base}.jpg`;
  const opts = { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" };
  must(await db.storage.from("media").upload(path, dataUrlToBlob(dataUrl), opts));
  if (thumb) must(await db.storage.from("media").upload(`${base}.t.jpg`, dataUrlToBlob(thumb), opts));
  return db.storage.from("media").getPublicUrl(path).data.publicUrl;
}

const check = (r: { error: { message: string; code?: string } | null }) => {
  if (r.error) throw new Error(r.error.code === "23505" ? "That username is already taken" : r.error.message);
};

/** Ask the server to check a post's photos for pets. */
export async function moderatePost(postId: string): Promise<{ status: string; message?: string; filter?: "on" | "off" }> {
  try {
    const res = await fetch("/api/moderate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    return (await res.json()) as { status: string; message?: string; filter?: "on" | "off" };
  } catch {
    return { status: "pending" };
  }
}

export const remote = {
  async updatePost(id: string, patch: { caption?: string; tags?: string[]; location?: string | null; tagged_pets?: string[] }) {
    check(await sb().from("posts").update(patch).eq("id", id));
  },
  async commentLike(on: boolean, commentId: string, pet: string) {
    const q = sb().from("comment_likes");
    check(on ? await q.upsert({ comment_id: commentId, pet_id: pet }, { ignoreDuplicates: true }) : await q.delete().match({ comment_id: commentId, pet_id: pet }));
  },
  async react(messageId: string, pet: string, emoji: string | null) {
    const q = sb().from("message_reactions");
    check(emoji ? await q.upsert({ message_id: messageId, pet_id: pet, emoji }) : await q.delete().match({ message_id: messageId, pet_id: pet }));
  },
  async postStory(st: Story) {
    const image = st.image?.startsWith("data:") ? await uploadPhoto(st.image, "story") : st.image;
    check(await sb().from("stories").insert({ id: st.id, pet_id: st.petId, image_url: image ?? null, text: st.text ?? null, bg: st.bg }));
  },
  async deleteStory(id: string) {
    check(await sb().from("stories").delete().eq("id", id));
  },
  async viewStory(id: string, pet: string) {
    await sb().from("story_views").upsert({ story_id: id, viewer_id: pet }, { ignoreDuplicates: true });
  },
  async createCollection(pet: string, c: Collection) {
    check(await sb().from("collections").insert({ id: c.id, pet_id: pet, name: c.name }));
    if (c.postIds.length) check(await sb().from("collection_items").insert(c.postIds.map((post_id) => ({ collection_id: c.id, post_id }))));
  },
  async renameCollection(id: string, name: string) {
    check(await sb().from("collections").update({ name }).eq("id", id));
  },
  async deleteCollection(id: string) {
    check(await sb().from("collections").delete().eq("id", id));
  },
  async collectionItem(on: boolean, collectionId: string, postId: string) {
    const q = sb().from("collection_items");
    check(on ? await q.upsert({ collection_id: collectionId, post_id: postId }, { ignoreDuplicates: true }) : await q.delete().match({ collection_id: collectionId, post_id: postId }));
  },
  async pawFive(from: string, to: string) {
    check(await sb().from("paw_fives").insert({ from_pet: from, to_pet: to }));
  },
  async invitePlaydate(p: Playdate) {
    check(await sb().from("playdates").insert({ id: p.id, from_pet: p.fromPet, to_pet: p.toPet, place: p.place, starts_at: new Date(p.startsAt).toISOString(), note: p.note }));
  },
  async playdateStatus(id: string, status: Playdate["status"]) {
    check(await sb().from("playdates").update({ status }).eq("id", id));
  },
  async createFamilyInvite(pet: string): Promise<string> {
    const res = await sb().rpc("create_family_invite", { p_pet: pet });
    check(res);
    return res.data as string;
  },
  async acceptFamilyInvite(code: string): Promise<string> {
    const res = await sb().rpc("accept_family_invite", { p_code: code });
    check(res);
    return res.data as string;
  },
  async leaveFamily(pet: string, userId: string) {
    check(await sb().from("pet_members").delete().match({ pet_id: pet, user_id: userId }));
  },
  async dailyVote(day: string, voter: string, postId: string | null) {
    const q = sb().from("daily_votes");
    check(postId ? await q.upsert({ day, voter_id: voter, post_id: postId }) : await q.delete().match({ day, voter_id: voter }));
  },
  async addReminder(pet: string, r: Reminder) {
    check(await sb().from("reminders").insert({ id: r.id, pet_id: pet, title: r.title, kind: r.kind, due_date: r.due, repeat: r.repeat }));
  },
  async updateReminder(r: Reminder) {
    check(await sb().from("reminders").update({ due_date: r.due }).eq("id", r.id));
  },
  async deleteReminder(id: string) {
    check(await sb().from("reminders").delete().eq("id", id));
  },
  async unlock(pet: string, item: string, from: "wallet" | "earnings") {
    check(await sb().rpc("buy_shop_item", { p_pet: pet, p_item: item, p_from: from }));
  },
  async saveNote(pet: string, n: Note) {
    check(await sb().from("pet_notes").upsert({ id: n.id, pet_id: pet, title: n.title, body: n.body, pinned: n.pinned }));
  },
  async deleteNote(id: string) {
    check(await sb().from("pet_notes").delete().eq("id", id));
  },
  async addWeight(pet: string, w: Weight) {
    check(await sb().from("pet_weights").insert({ id: w.id, pet_id: pet, measured_on: w.date, kg: w.kg }));
  },
  async deleteWeight(id: string) {
    check(await sb().from("pet_weights").delete().eq("id", id));
  },
  async postAlert(a: LostAlert) {
    const photo = a.photo?.startsWith("data:") ? await uploadPhoto(a.photo, "alert") : a.photo;
    check(
      await sb().from("lost_alerts").insert({
        id: a.id,
        kind: a.kind,
        reporter_id: a.reporterId,
        pet_id: a.petId ?? null,
        name: a.name,
        description: a.description,
        suburb: a.suburb,
        city: a.city,
        last_seen: a.lastSeen,
        photo_url: photo ?? null,
      }),
    );
  },
  async resolveAlert(id: string) {
    check(await sb().from("lost_alerts").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id));
  },
  async savePushSubscription(pet: string, sub: PushSubscriptionJSON) {
    check(
      await sb()
        .from("push_subscriptions")
        .upsert({ pet_id: pet, endpoint: sub.endpoint, p256dh: sub.keys?.p256dh ?? "", auth: sub.keys?.auth ?? "" }, { onConflict: "endpoint" }),
    );
  },
  async deletePushSubscription(endpoint: string) {
    check(await sb().from("push_subscriptions").delete().eq("endpoint", endpoint));
  },
  async deletePost(id: string) {
    check(await sb().from("posts").delete().eq("id", id));
  },
  async createPet(pet: Pet) {
    const db = sb();
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) throw new Error("Please log in first");
    const photo = pet.photo?.startsWith("data:") ? await uploadPhoto(pet.photo, "avatar") : pet.photo;
    const res = await db
      .from("pets")
      .insert({
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
      })
      .select("id")
      .single();
    check(res);
    return (res.data as { id: string }).id;
  },
  async updatePet(
    id: string,
    patch: Partial<{ clan: Clan; meetups_opt_in: boolean; name: string; bio: string[]; photo_url: string | null; personality: string; breed: string; age: string; city: string; birthday: string | null; gotcha_day: string | null }>,
  ) {
    const res = await sb().from("pets").update(patch).eq("id", id);
    // If the database hasn't been updated with the birthday columns yet, save everything else.
    if (res.error && /birthday|gotcha_day/.test(res.error.message) && ("birthday" in patch || "gotcha_day" in patch)) {
      const rest = { ...patch };
      delete rest.birthday;
      delete rest.gotcha_day;
      check(await sb().from("pets").update(rest).eq("id", id));
      throw new Error("Saved, except birthday/Gotcha Day: re-run supabase/setup.sql in Supabase to enable them");
    }
    check(res);
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
  async comment(postId: string, petId: string, text: string, parentId?: string, id?: string) {
    check(await sb().from("comments").insert({ ...(id ? { id } : {}), post_id: postId, pet_id: petId, text, parent_id: parentId ?? null }));
  },
  async post(p: Post) {
    const all = p.images?.length ? p.images : p.image ? [p.image] : [];
    const urls = await Promise.all(
      all.map(async (src, i) => (src.startsWith("data:") ? uploadPhoto(src, `post-${i + 1}`, await makeThumb(src)) : src)),
    );
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
        daily_date: p.dailyDate ?? null,
        ...(p.taggedPets?.length ? { tagged_pets: p.taggedPets } : {}),
        ...(p.frame ? { frame: p.frame } : {}),
        ...(p.stickers?.length ? { stickers: p.stickers } : {}),
        ...(p.aspect === "portrait" ? { aspect: "portrait" } : {}),
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
  async message(from: string, to: string, text: string, replyTo?: string, id?: string) {
    check(await sb().from("messages").insert({ ...(id ? { id } : {}), from_pet: from, to_pet: to, text, reply_to: replyTo ?? null }));
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
        text: `sent you ${b.amount} biscuit${b.amount > 1 ? "s" : ""} 🍪${b.post_id ? " for your floof" : ""}${b.note ? ` “${b.note}”` : ""}`,
        postId: b.post_id ?? undefined,
        t: Date.parse(b.created_at),
        ago: "",
      })),
  ];

  // Newer social activity (quietly skipped if those tables aren't set up yet).
  const [replies, likes, tagged, paws, plays] = (await Promise.all([
    db.from("comments").select("id, pet_id, post_id, text, created_at, parent:comments!parent_id!inner(pet_id)").eq("parent.pet_id", petId).neq("pet_id", petId).order("created_at", { ascending: false }).limit(30),
    db.from("comment_likes").select("pet_id, created_at, comments!inner(pet_id, post_id, text)").eq("comments.pet_id", petId).neq("pet_id", petId).order("created_at", { ascending: false }).limit(30),
    db.from("posts").select("id, pet_id, created_at").contains("tagged_pets", [petId]).eq("status", "approved").order("created_at", { ascending: false }).limit(30),
    db.from("paw_fives").select("from_pet, created_at").eq("to_pet", petId).order("created_at", { ascending: false }).limit(30),
    db.from("playdates").select("id, from_pet, to_pet, place, status, created_at").or(`and(to_pet.eq.${petId},status.eq.pending),and(from_pet.eq.${petId},status.eq.accepted)`).order("created_at", { ascending: false }).limit(30),
  ]).then((r) => r.map(soft))) as [
    { id: string; pet_id: string; post_id: string; text: string; created_at: string }[],
    { pet_id: string; created_at: string; comments: { post_id: string; text: string } }[],
    { id: string; pet_id: string; created_at: string }[],
    { from_pet: string; created_at: string }[],
    { id: string; from_pet: string; to_pet: string; place: string; status: string; created_at: string }[],
  ];
  list.push(
    ...replies.map((r) => ({ id: `r${r.id}`, petId: r.pet_id, kind: "reply" as const, text: `replied to your comment: “${r.text}”`, postId: r.post_id, t: Date.parse(r.created_at), ago: "" })),
    ...likes.map((l, i) => ({ id: `l${i}`, petId: l.pet_id, kind: "commentLike" as const, text: `liked your comment: “${l.comments.text}”`, postId: l.comments.post_id, t: Date.parse(l.created_at), ago: "" })),
    ...tagged.filter((p) => p.pet_id !== petId).map((p) => ({ id: `t${p.id}`, petId: p.pet_id, kind: "tag" as const, text: "tagged you in a floof", postId: p.id, t: Date.parse(p.created_at), ago: "" })),
    ...paws.map((p, i) => ({ id: `p${i}`, petId: p.from_pet, kind: "pawfive" as const, text: "sent you a paw-five 🐾", t: Date.parse(p.created_at), ago: "" })),
    ...plays.map((p) => ({
      id: `pd${p.id}`,
      petId: p.to_pet === petId ? p.from_pet : p.to_pet,
      kind: "playdate" as const,
      text: p.to_pet === petId ? `invited you to a playdate at ${p.place} 🎾` : `accepted your playdate at ${p.place} 🎉`,
      t: Date.parse(p.created_at),
      ago: "",
    })),
  );
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

/** The last 7 days for my pet: what came in and what I posted. */
export type Recap = { boops: number; comments: number; followers: number; biscuits: number; posts: number; topPostId?: string; fans: string[] };

export async function loadRecap(petId: string): Promise<Recap> {
  const db = sb();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [boops, comments, follows, biscuits, posts] = (await Promise.all([
    db.from("boops").select("post_id, pet_id, posts!inner(pet_id)").eq("posts.pet_id", petId).neq("pet_id", petId).gte("created_at", since).limit(2000),
    db.from("comments").select("pet_id, posts!inner(pet_id)").eq("posts.pet_id", petId).neq("pet_id", petId).gte("created_at", since).limit(2000),
    db.from("follows").select("follower_id").eq("followee_id", petId).gte("created_at", since).limit(2000),
    db.from("biscuit_ledger").select("amount, counterparty_id").eq("pet_id", petId).eq("kind", "received").gte("created_at", since).limit(2000),
    db.from("posts").select("id").eq("pet_id", petId).gte("created_at", since).limit(500),
  ]).then((r) => r.map(mustAny))) as [
    { post_id: string; pet_id: string }[],
    { pet_id: string }[],
    { follower_id: string }[],
    { amount: number; counterparty_id: string | null }[],
    { id: string }[],
  ];
  const perPost: Record<string, number> = {};
  const fanScore: Record<string, number> = {};
  for (const b of boops) {
    perPost[b.post_id] = (perPost[b.post_id] ?? 0) + 1;
    fanScore[b.pet_id] = (fanScore[b.pet_id] ?? 0) + 1;
  }
  for (const c of comments) fanScore[c.pet_id] = (fanScore[c.pet_id] ?? 0) + 2;
  for (const b of biscuits) if (b.counterparty_id) fanScore[b.counterparty_id] = (fanScore[b.counterparty_id] ?? 0) + 3 * b.amount;
  return {
    boops: boops.length,
    comments: comments.length,
    followers: follows.length,
    biscuits: biscuits.reduce((a, b) => a + b.amount, 0),
    posts: posts.length,
    topPostId: Object.entries(perPost).sort((a, b) => b[1] - a[1])[0]?.[0],
    fans: Object.entries(fanScore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id),
  };
}

/** Live reactions on my messages. Returns an unsubscribe function. */
export function subscribeToReactions(onChange: (r: { message_id: string; pet_id: string; emoji: string | null }) => void) {
  const channel = sb()
    .channel("reactions")
    .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
      if (payload.eventType === "DELETE") {
        const old = payload.old as { message_id?: string; pet_id?: string };
        if (old.message_id && old.pet_id) onChange({ message_id: old.message_id, pet_id: old.pet_id, emoji: null });
      } else {
        const row = payload.new as { message_id: string; pet_id: string; emoji: string };
        onChange(row);
      }
    })
    .subscribe();
  return () => {
    void sb().removeChannel(channel);
  };
}
