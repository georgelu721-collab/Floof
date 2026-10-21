"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AFFINITY, DEMO_ALERTS, DEMO_PET_ID, demoReminders, PETS, POSTS } from "./data";
import { CLOUD, sb } from "./supabase";
import { loadSnapshot, moderatePost, remote, subscribeToMessages, uploadPhoto, type Snapshot } from "./cloud";
import { addDays, dailyStreak, dayKey, fromKey, levelFor, postingStreak } from "./daily";
import type { Clan, Comment, LedgerEntry, LostAlert, MomentType, Pet, Post, Reminder, Thread, Weight } from "./types";

type State = {
  me: string | null;
  customPets: Pet[];
  myPosts: Post[];
  boops: Record<string, true>;
  saved: Record<string, true>;
  following: Record<string, true>;
  comments: Record<string, Comment[]>;
  balance: number; // biscuits in wallet
  received: number; // change to my pet's received biscuits during this session
  ledger: LedgerEntry[];
  interactions: Record<string, number>; // my affinity with other pets
  clan: Clan | null;
  clanFloofs: number;
  events: Record<string, "interested" | "going">;
  checkins: Record<string, true>;
  entries: Record<string, string>; // competitionId -> postId
  votes: Record<string, string>; // competitionId -> postId
  packs: Record<string, true>;
  meetupsOptIn: boolean;
  threads: Record<string, Thread["messages"]>;
  unlocked: Partial<Record<MomentType, string>>; // moment -> postId
  deleted: Record<string, true>;
  dailyVotes: Record<string, string>; // day -> post I voted for
  interactionDays: Record<string, string[]>; // pet -> days I interacted with them
  reminders: Reminder[];
  weights: Weight[];
  alerts: LostAlert[]; // local demo alerts, plus ones I just posted (cloud)
  resolvedAlerts: Record<string, true>;
  meEdits: Partial<Pet>; // local demo: edits to a built-in pet
};

const initial: State = {
  me: null,
  customPets: [],
  myPosts: [],
  boops: {},
  saved: {},
  following: { mochi: true, luna: true, biscuit: true },
  comments: {},
  balance: 50,
  received: 0,
  ledger: [{ id: "welcome", type: "topup", amount: 50, note: "Welcome gift from Floof 🎁", at: 0 }],
  interactions: {},
  clan: null,
  clanFloofs: 0,
  events: {},
  checkins: {},
  entries: {},
  votes: {},
  packs: { "floofy-friends": true },
  meetupsOptIn: false,
  threads: {},
  unlocked: {},
  deleted: {},
  dailyVotes: {},
  interactionDays: {},
  reminders: [],
  weights: [],
  alerts: [],
  resolvedAlerts: {},
  meEdits: {},
};

export type Action =
  | { t: "hydrate"; s: Partial<State> }
  | { t: "login"; id: string }
  | { t: "createPet"; pet: Pet; follow?: string[]; packs?: string[] }
  | { t: "logout" }
  | { t: "boop"; postId: string; petId: string }
  | { t: "save"; postId: string }
  | { t: "follow"; petId: string }
  | { t: "comment"; postId: string; petId: string; text: string }
  | { t: "post"; post: Post }
  | { t: "deletePost"; postId: string }
  | { t: "sendBiscuits"; petId: string; amount: number; note?: string; postId?: string }
  | { t: "topup"; amount: number; note: string }
  | { t: "redeem"; amount: number; note: string }
  | { t: "joinClan"; clan: Clan }
  | { t: "clanFloof"; n: number }
  | { t: "event"; id: string; status: "interested" | "going" | null }
  | { t: "checkin"; id: string }
  | { t: "enter"; compId: string; postId: string }
  | { t: "vote"; compId: string; postId: string; petId: string }
  | { t: "pack"; id: string }
  | { t: "meetupsOptIn"; on: boolean }
  | { t: "message"; threadId: string; text: string; petIds: string[] }
  | { t: "incoming"; threadId: string; msg: Thread["messages"][number]; petId: string }
  | { t: "updateMe"; patch: Partial<Pet> }
  | { t: "dailyVote"; day: string; postId: string | null; petId: string }
  | { t: "addReminder"; reminder: Reminder }
  | { t: "completeReminder"; id: string }
  | { t: "deleteReminder"; id: string }
  | { t: "addWeight"; weight: Weight }
  | { t: "deleteWeight"; id: string }
  | { t: "postAlert"; alert: LostAlert }
  | { t: "resolveAlert"; id: string };

const bump = (m: Record<string, number>, id: string, n: number) => ({ ...m, [id]: (m[id] ?? 0) + n });
/** Remember that I interacted with a pet today (for best-friend streaks). */
const touch = (days: Record<string, string[]>, id: string) => {
  const today = dayKey();
  const list = days[id] ?? [];
  return list.includes(today) ? days : { ...days, [id]: [...list, today] };
};
const PERIOD: Record<Reminder["repeat"], number> = { none: 0, monthly: 1, quarterly: 3, yearly: 12 };
/** Next due date after today for a repeating reminder. */
function nextDue(r: Reminder) {
  const d = fromKey(r.due);
  const today = dayKey();
  do d.setMonth(d.getMonth() + PERIOD[r.repeat]);
  while (dayKey(d) <= today);
  return dayKey(d);
}
const uid = () => Math.random().toString(36).slice(2, 10);

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "hydrate":
      return { ...s, ...a.s };
    case "login":
      return { ...s, me: a.id };
    case "createPet":
      return {
        ...s,
        customPets: [...s.customPets.filter((p) => p.id !== a.pet.id), a.pet],
        me: a.pet.id,
        following: a.follow ? Object.fromEntries(a.follow.map((id) => [id, true as const])) : s.following,
        packs: a.packs ? Object.fromEntries(a.packs.map((id) => [id, true as const])) : s.packs,
        clan: a.pet.clan,
        // A new pet starts with a clean slate (the demo's sample care data belongs to Big Mac).
        reminders: [],
        weights: [],
        dailyVotes: {},
        interactionDays: {},
      };
    case "logout":
      return { ...s, me: null };
    case "boop": {
      const on = !s.boops[a.postId];
      const boops = { ...s.boops };
      if (on) boops[a.postId] = true;
      else delete boops[a.postId];
      return { ...s, boops, interactions: bump(s.interactions, a.petId, on ? 1 : -1), interactionDays: on ? touch(s.interactionDays, a.petId) : s.interactionDays };
    }
    case "save": {
      const saved = { ...s.saved };
      if (saved[a.postId]) delete saved[a.postId];
      else saved[a.postId] = true;
      return { ...s, saved };
    }
    case "follow": {
      const following = { ...s.following };
      if (following[a.petId]) delete following[a.petId];
      else following[a.petId] = true;
      return { ...s, following, interactions: bump(s.interactions, a.petId, following[a.petId] ? 3 : -3) };
    }
    case "comment": {
      const c: Comment = { id: uid(), petId: s.me ?? DEMO_PET_ID, text: a.text, ago: "now", likes: 0 };
      return {
        ...s,
        comments: { ...s.comments, [a.postId]: [...(s.comments[a.postId] ?? []), c] },
        interactions: bump(s.interactions, a.petId, 2),
        interactionDays: touch(s.interactionDays, a.petId),
      };
    }
    case "post": {
      const unlocked = a.post.moment && !s.unlocked[a.post.moment] ? { ...s.unlocked, [a.post.moment]: a.post.id } : s.unlocked;
      return { ...s, myPosts: [a.post, ...s.myPosts], unlocked, clanFloofs: s.clan ? s.clanFloofs + 1 : s.clanFloofs };
    }
    case "deletePost":
      return { ...s, myPosts: s.myPosts.filter((p) => p.id !== a.postId), deleted: { ...s.deleted, [a.postId]: true } };
    case "sendBiscuits":
      if (a.amount > s.balance || a.amount <= 0) return s;
      return {
        ...s,
        balance: s.balance - a.amount,
        ledger: [{ id: uid(), type: "sent", amount: a.amount, petId: a.petId, note: a.note, at: Date.now() }, ...s.ledger],
        interactions: bump(s.interactions, a.petId, 5 * a.amount),
        interactionDays: touch(s.interactionDays, a.petId),
      };
    case "topup":
      return {
        ...s,
        balance: s.balance + a.amount,
        ledger: [{ id: uid(), type: "topup", amount: a.amount, note: a.note, at: Date.now() }, ...s.ledger],
      };
    case "redeem":
      return {
        ...s,
        received: s.received - a.amount,
        ledger: [{ id: uid(), type: "redeem", amount: a.amount, note: a.note, at: Date.now() }, ...s.ledger],
      };
    case "joinClan":
      return { ...s, clan: a.clan };
    case "clanFloof":
      return { ...s, clanFloofs: s.clanFloofs + a.n };
    case "event": {
      const events = { ...s.events };
      if (a.status) events[a.id] = a.status;
      else delete events[a.id];
      return { ...s, events };
    }
    case "checkin":
      return { ...s, checkins: { ...s.checkins, [a.id]: true } };
    case "enter":
      return { ...s, entries: { ...s.entries, [a.compId]: a.postId } };
    case "vote":
      return { ...s, votes: { ...s.votes, [a.compId]: a.postId }, interactions: bump(s.interactions, a.petId, 2) };
    case "pack": {
      const packs = { ...s.packs };
      if (packs[a.id]) delete packs[a.id];
      else packs[a.id] = true;
      return { ...s, packs };
    }
    case "meetupsOptIn":
      return { ...s, meetupsOptIn: a.on };
    case "message": {
      const msg = { id: uid(), from: "me", text: a.text, at: "now", ts: Date.now() };
      let interactions = s.interactions;
      let interactionDays = s.interactionDays;
      for (const p of a.petIds) {
        interactions = bump(interactions, p, 1);
        interactionDays = touch(interactionDays, p);
      }
      return { ...s, threads: { ...s.threads, [a.threadId]: [...(s.threads[a.threadId] ?? []), msg] }, interactions, interactionDays };
    }
    case "incoming":
      if ((s.threads[a.threadId] ?? []).some((m) => m.id === a.msg.id)) return s;
      return {
        ...s,
        threads: { ...s.threads, [a.threadId]: [...(s.threads[a.threadId] ?? []), a.msg] },
        interactions: bump(s.interactions, a.petId, 1),
      };
    case "updateMe":
      return s.customPets.some((p) => p.id === s.me)
        ? { ...s, customPets: s.customPets.map((p) => (p.id === s.me ? { ...p, ...a.patch } : p)) }
        : { ...s, meEdits: { ...s.meEdits, ...a.patch } };
    case "dailyVote": {
      const dailyVotes = { ...s.dailyVotes };
      if (a.postId) dailyVotes[a.day] = a.postId;
      else delete dailyVotes[a.day];
      return { ...s, dailyVotes, interactionDays: a.postId ? touch(s.interactionDays, a.petId) : s.interactionDays };
    }
    case "addReminder":
      return { ...s, reminders: [...s.reminders, a.reminder].sort((x, y) => x.due.localeCompare(y.due)) };
    case "completeReminder":
      return {
        ...s,
        reminders: s.reminders
          .flatMap((r) => (r.id !== a.id ? [r] : r.repeat === "none" ? [] : [{ ...r, due: nextDue(r) }]))
          .sort((x, y) => x.due.localeCompare(y.due)),
      };
    case "deleteReminder":
      return { ...s, reminders: s.reminders.filter((r) => r.id !== a.id) };
    case "addWeight":
      return { ...s, weights: [...s.weights, a.weight].sort((x, y) => x.date.localeCompare(y.date)) };
    case "deleteWeight":
      return { ...s, weights: s.weights.filter((w) => w.id !== a.id) };
    case "postAlert":
      return { ...s, alerts: [a.alert, ...s.alerts] };
    case "resolveAlert":
      return {
        ...s,
        alerts: s.alerts.map((x) => (x.id === a.id ? { ...x, status: "resolved" as const } : x)),
        resolvedAlerts: { ...s.resolvedAlerts, [a.id]: true },
      };
  }
}

/** Saves an action to Supabase. Runs after the change is already shown on screen. */
async function syncAction(a: Action, before: State, me: string) {
  switch (a.t) {
    case "boop":
      return remote.toggle("boops", !before.boops[a.postId], { post_id: a.postId, pet_id: me });
    case "save":
      return remote.toggle("saves", !before.saved[a.postId], { post_id: a.postId, pet_id: me });
    case "follow":
      return remote.follow(!before.following[a.petId], me, a.petId);
    case "comment":
      return remote.comment(a.postId, me, a.text);
    case "post":
      return remote.post(a.post);
    case "deletePost":
      return remote.deletePost(a.postId);
    case "sendBiscuits":
      return remote.sendBiscuits(me, a.petId, a.amount, a.note, a.postId);
    case "topup":
      return remote.topup(me, a.amount);
    case "redeem":
      return remote.redeem(me, a.amount, a.note);
    case "joinClan":
      return remote.updatePet(me, { clan: a.clan });
    case "event":
      return remote.rsvp(a.id, me, a.status);
    case "checkin":
      return remote.checkin(a.id, me);
    case "enter":
      return remote.enter(a.compId, me, a.postId);
    case "vote":
      return remote.vote(a.compId, me, a.postId);
    case "pack":
      return remote.pack(!before.packs[a.id], a.id, me);
    case "meetupsOptIn":
      return remote.updatePet(me, { meetups_opt_in: a.on });
    case "message":
      return remote.message(me, a.petIds[0], a.text);
    case "updateMe": {
      const photo = a.patch.photo?.startsWith("data:") ? await uploadPhoto(a.patch.photo, "avatar") : a.patch.photo;
      const patch: Parameters<typeof remote.updatePet>[1] = {};
      if (a.patch.name !== undefined) patch.name = a.patch.name;
      if (a.patch.bio !== undefined) patch.bio = a.patch.bio;
      if (a.patch.breed !== undefined) patch.breed = a.patch.breed;
      if (a.patch.age !== undefined) patch.age = a.patch.age;
      if (a.patch.city !== undefined) patch.city = a.patch.city;
      if ("birthday" in a.patch) patch.birthday = a.patch.birthday || null;
      if ("gotchaDay" in a.patch) patch.gotcha_day = a.patch.gotchaDay || null;
      if ("photo" in a.patch) patch.photo_url = photo ?? null;
      return remote.updatePet(me, patch);
    }
    case "dailyVote":
      return remote.dailyVote(a.day, me, a.postId);
    case "addReminder":
      return remote.addReminder(me, a.reminder);
    case "completeReminder": {
      const r = before.reminders.find((x) => x.id === a.id);
      if (!r) return;
      return r.repeat === "none" ? remote.deleteReminder(r.id) : remote.updateReminder({ ...r, due: nextDue(r) });
    }
    case "deleteReminder":
      return remote.deleteReminder(a.id);
    case "addWeight":
      return remote.addWeight(me, a.weight);
    case "deleteWeight":
      return remote.deleteWeight(a.id);
    case "postAlert":
      return remote.postAlert(a.alert);
    case "resolveAlert":
      return remote.resolveAlert(a.id);
  }
}

const KEY = "floof:v1";

const GUEST: Pet = {
  id: "guest",
  handle: "guest",
  name: "Guest",
  species: "dog",
  breed: "",
  age: "",
  city: "",
  bio: [],
  owner: "",
  look: { fur: "#EFE2D1", ear: "#E0CBB6", muzzle: "#FFF8EE", earStyle: "floppy" },
  followers: 0,
  following: 0,
  biscuitsReceived: 0,
  pawScore: 0,
  clan: "dogs",
  bg: "#F6EBDD",
};

type Ctx = {
  s: State;
  ready: boolean;
  cloud: boolean;
  /** Signed in with a pet (cloud), or any local session. */
  signedIn: boolean;
  userId: string | null;
  dispatch: (a: Action) => Promise<boolean>;
  reload: () => Promise<void>;
  pets: Pet[];
  posts: Post[];
  me: Pet;
  pet: (id: string) => Pet | undefined;
  post: (id: string) => Post | undefined;
  bestFriends: (petId: string) => { pet: Pet; score: number; streak: number }[];
  pawScore: (petId: string) => number;
  pawBreakdown: (petId: string) => PawPart[];
  clanExtra: { cats: number; dogs: number };
  extraVotes: (compId: string, postId: string) => number;
  remoteEntries: (compId: string) => string[];
  toast: (msg: string) => void;
  toastMsg: string | null;
  loadError: string | null;
  /** My posting streak (one free skip per week). */
  streak: { streak: number; postedToday: boolean; atRisk: boolean; best: number };
  /** Consecutive days I've interacted with a pet. */
  friendStreak: (petId: string) => number;
  interactedToday: (petId: string) => boolean;
  dailyAnswers: (day: string) => Post[];
  dailyVoteCount: (day: string, postId: string) => number;
  alerts: LostAlert[];
  level: (petId: string) => ReturnType<typeof levelFor>;
  myPostDays: Set<string>;
};

export type PawPart = { key: string; emoji: string; label: string; count: number; per: number; points: number };

const StoreCtx = createContext<Ctx | null>(null);

const LOGIN_FREE = new Set<Action["t"]>(["hydrate", "login", "logout", "incoming"]);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, rawDispatch] = useReducer(
    reducer,
    CLOUD
      ? { ...initial, balance: 0, ledger: [], following: {}, packs: {} }
      : {
          ...initial,
          alerts: DEMO_ALERTS,
          reminders: demoReminders(dayKey()),
          weights: [
            { id: "demo-w1", date: addDays(dayKey(), -60), kg: 31.2 },
            { id: "demo-w2", date: addDays(dayKey(), -30), kg: 31.8 },
            { id: "demo-w3", date: addDays(dayKey(), -3), kg: 32.1 },
          ],
        },
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [toastMsg, setToast] = useState<string | null>(null);
  const stateRef = useRef(s);
  stateRef.current = s;

  const toast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((m) => (m === msg ? null : m)), 2600);
  }, []);

  /* ---------- Cloud mode: load from Supabase ---------- */
  const reload = useCallback(async () => {
    if (!CLOUD) return;
    try {
      const next = await loadSnapshot();
      setSnap(next);
      setLoadError(null);
      const m = next.mine;
      rawDispatch({
        t: "hydrate",
        s: {
          ...initial,
          me: next.myPetId,
          following: m?.following ?? {},
          packs: m?.packs ?? {},
          balance: m?.balance ?? 0,
          ledger: m?.ledger ?? [],
          ...(m ? { ...m, clanFloofs: next.myClanFloofs } : {}),
        },
      });
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setReady(true);
    }
  }, [toast]);

  useEffect(() => {
    if (!CLOUD) return;
    void reload();
    const { data } = sb().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void reload();
    });
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 5000) return;
      last = Date.now();
      void reload();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, [reload]);

  // Live incoming messages.
  const myPetId = snap?.myPetId ?? null;
  useEffect(() => {
    if (!CLOUD || !myPetId) return;
    return subscribeToMessages(myPetId, (m) =>
      rawDispatch({
        t: "incoming",
        threadId: `dm-${m.from_pet}`,
        petId: m.from_pet,
        msg: { id: m.id, from: m.from_pet, text: m.text, ts: Date.parse(m.created_at), at: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      }),
    );
  }, [myPetId]);

  /* ---------- Local mode: browser storage ---------- */
  useEffect(() => {
    if (CLOUD) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) rawDispatch({ t: "hydrate", s: JSON.parse(raw) });
    } catch {
      /* storage unavailable: run with defaults */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (CLOUD || !ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      try {
        const slim = { ...s, myPosts: s.myPosts.map((p, i) => (i < 3 ? p : { ...p, image: undefined, images: undefined })) };
        localStorage.setItem(KEY, JSON.stringify(slim));
      } catch {
        /* give up quietly */
      }
    }
  }, [s, ready]);

  /* ---------- Actions ---------- */
  const dispatch = useCallback(
    async (a: Action): Promise<boolean> => {
      if (!CLOUD) {
        rawDispatch(a);
        return true;
      }
      if (a.t === "logout") {
        await sb().auth.signOut();
        rawDispatch(a);
        return true;
      }
      if (a.t === "createPet") {
        try {
          const newId = await remote.createPet(a.pet);
          // Starter follows and packs picked during sign-up (best effort).
          await Promise.allSettled([
            ...(a.follow ?? []).map((id) => remote.follow(true, newId, id)),
            ...(a.packs ?? []).map((id) => remote.pack(true, id, newId)),
          ]);
          await reload();
          return true;
        } catch (e) {
          toast((e as Error).message);
          return false;
        }
      }
      const me = stateRef.current.me;
      if (!me && !LOGIN_FREE.has(a.t)) {
        toast("Log in or create a pet account to do that 🐾");
        window.setTimeout(() => window.location.assign("/login"), 900);
        return false;
      }
      if (a.t === "sendBiscuits" && a.amount > stateRef.current.balance) return false;
      const hasPhotos = a.t === "post" && !!(a.post.image || a.post.images?.length);
      if (a.t === "post" && hasPhotos) a = { ...a, post: { ...a.post, status: "pending" } };
      const before = stateRef.current;
      rawDispatch(a);
      if (LOGIN_FREE.has(a.t) || a.t === "clanFloof") return true;
      try {
        await syncAction(a, before, me!);
        if (a.t === "updateMe" || a.t === "postAlert") void reload();
        if (a.t === "post" && hasPhotos) {
          // Check the photos for a pet, then refresh so the post shows its result.
          void moderatePost(a.post.id).then((r) => {
            if (r.status === "approved") toast("✅ Pet spotted! Your floof is live");
            else if (r.status === "rejected") toast(`🚫 ${r.message || "We couldn't spot a pet in this photo"}`);
            void reload();
          });
        }
        return true;
      } catch (e) {
        toast(`Didn't save: ${(e as Error).message}`);
        void reload();
        return false;
      }
    },
    [reload, toast],
  );

  /* ---------- Derived data ---------- */
  const value = useMemo<Ctx>(() => {
    // In cloud mode the built-in house pets are always available, even before (or without) the database.
    const pets = CLOUD
      ? [...(snap?.pets ?? []), ...PETS.filter((p) => !snap?.pets.some((x) => x.id === p.id)).map((p) => ({ ...p, ownerId: null }))]
      : [...PETS, ...s.customPets];
    const pet = (id: string) => pets.find((p) => p.id === id);
    const cloudGuest = CLOUD && !s.me;
    const meId = CLOUD ? (s.me ?? GUEST.id) : (s.me ?? DEMO_PET_ID);
    const meBase = cloudGuest ? GUEST : (pet(meId) ?? (CLOUD ? GUEST : PETS[0]));
    const me: Pet = {
      ...meBase,
      ...(CLOUD ? {} : s.meEdits),
      biscuitsReceived: meBase.biscuitsReceived + s.received,
      clan: s.clan ?? meBase.clan,
    };

    const allPosts = CLOUD ? [...s.myPosts.filter((p) => !snap?.posts.some((x) => x.id === p.id)), ...(snap?.posts ?? [])] : [...s.myPosts, ...POSTS];
    const posts = allPosts.filter((p) => !s.deleted[p.id]).map((p) => {
      const extra = s.comments[p.id] ?? [];
      return extra.length ? { ...p, comments: [...p.comments, ...extra], commentCount: p.commentCount + extra.length } : p;
    });
    const post = (id: string) => posts.find((p) => p.id === id);

    const today = dayKey();
    const daysWith = (id: string) => new Set([...(snap?.mine?.interactionDays[id] ?? []), ...(s.interactionDays[id] ?? [])]);
    const friendStreak = (id: string) => dailyStreak(daysWith(id), today);
    const interactedToday = (id: string) => daysWith(id).has(today);

    const bestFriends = (petId: string) => {
      const seed = AFFINITY[petId] ?? (petId === meId ? { mochi: { score: 12, streak: 2 }, luna: { score: 8, streak: 1 } } : {});
      const map: Record<string, { score: number; streak: number }> = {};
      for (const [id, v] of Object.entries(seed)) map[id] = { ...v };
      if (petId === meId) {
        for (const [id, n] of Object.entries(s.interactions)) {
          if (id === meId) continue;
          map[id] = { score: (map[id]?.score ?? 0) + n, streak: map[id]?.streak ?? 0 };
        }
        // Real streaks from actual activity (cloud), or the demo's sample streaks topped up by real ones (local).
        for (const id of Object.keys(map)) map[id].streak = CLOUD ? friendStreak(id) : Math.max(map[id].streak, friendStreak(id));
      }
      return Object.entries(map)
        .map(([id, v]) => ({ pet: pet(id)!, ...v }))
        .filter((x) => x.pet && x.score > 0)
        .sort((a, b) => b.score - a.score);
    };

    /** How a PawScore is made up. Full detail is only known for my own pet. */
    const pawBreakdown = (petId: string): PawPart[] => {
      const p = petId === me.id ? me : pet(petId);
      if (!p) return [];
      const base: PawPart = { key: "base", emoji: "🐾", label: p.pawScore > 100 ? "Floof legacy score" : "Welcome bonus", count: 1, per: p.pawScore, points: p.pawScore };
      if (petId !== meId) {
        const posted = p.ownerId ? (p.postCount ?? 0) : 0;
        return posted ? [base, { key: "posts", emoji: "📸", label: "Floofs posted", count: posted, per: 25, points: posted * 25 }] : [base];
      }
      const sent = s.ledger.filter((l) => l.type === "sent").reduce((a, l) => a + l.amount, 0);
      const parts: Omit<PawPart, "points">[] = [
        { key: "posts", emoji: "📸", label: "Floofs posted", count: posts.filter((x) => x.petId === meId && x.createdAt).length, per: 25 },
        { key: "boops", emoji: "❤️", label: "Boops given", count: Object.keys(s.boops).length, per: 2 },
        { key: "comments", emoji: "💬", label: "Kind comments", count: posts.reduce((a, x) => a + x.comments.filter((c) => c.petId === meId).length, 0), per: 4 },
        { key: "biscuits", emoji: "🍪", label: "Biscuits sent", count: sent, per: 3 },
        { key: "checkins", emoji: "📍", label: "Event check-ins", count: Object.keys(s.checkins).length, per: 50 },
        { key: "events", emoji: "🎟️", label: "Events joined", count: Object.keys(s.events).length, per: 10 },
      ];
      return [base, ...parts.map((x) => ({ ...x, points: x.count * x.per }))];
    };
    const pawScore = (petId: string) => pawBreakdown(petId).reduce((a, x) => a + x.points, 0);

    const clanExtra = CLOUD && snap
      ? {
          cats: snap.clan.cats + (s.clan === "cats" ? Math.max(0, s.clanFloofs - snap.myClanFloofs) * 5 : 0),
          dogs: snap.clan.dogs + (s.clan === "dogs" ? Math.max(0, s.clanFloofs - snap.myClanFloofs) * 5 : 0),
        }
      : { cats: s.clan === "cats" ? s.clanFloofs * 5 : 0, dogs: s.clan === "dogs" ? s.clanFloofs * 5 : 0 };

    const extraVotes = (compId: string, postId: string) =>
      snap ? (snap.voteCounts[compId]?.[postId] ?? 0) - (snap.initialVotes[compId] === postId ? 1 : 0) : 0;
    const remoteEntries = (compId: string) => snap?.entries[compId] ?? [];

    const myPostDays = new Set<string>([
      ...(snap?.mine?.myPostDays ?? []),
      ...posts.filter((p) => p.petId === meId && p.createdAt).map((p) => dayKey(new Date(p.createdAt))),
    ]);
    const streak = postingStreak(myPostDays, today);

    const dailyAnswers = (day: string) =>
      posts.filter((p) => p.dailyDate === day && (p.status === undefined || p.status === "approved" || p.petId === meId));
    const dailyVoteCount = (day: string, postId: string) => {
      const counted = snap?.dailyVoteCounts[day]?.[postId] ?? 0;
      const wasMine = snap?.mine?.dailyVotes[day] === postId ? 1 : 0;
      const isMine = s.dailyVotes[day] === postId ? 1 : 0;
      return counted - wasMine + isMine;
    };

    const baseAlerts = CLOUD ? [...s.alerts.filter((a) => !snap?.alerts.some((x) => x.id === a.id)), ...(snap?.alerts ?? [])] : s.alerts;
    const alerts = baseAlerts.map((a) => (s.resolvedAlerts[a.id] ? { ...a, status: "resolved" as const } : a));

    return {
      s,
      ready,
      cloud: CLOUD,
      signedIn: CLOUD ? !!s.me : true,
      userId: snap?.userId ?? null,
      dispatch,
      reload,
      pets,
      posts,
      me,
      pet: (id: string) => (id === me.id ? me : pet(id)),
      post,
      bestFriends,
      pawScore,
      pawBreakdown,
      clanExtra,
      extraVotes,
      remoteEntries,
      toast,
      toastMsg,
      loadError,
      streak,
      friendStreak,
      interactedToday,
      dailyAnswers,
      dailyVoteCount,
      alerts,
      level: (id: string) => levelFor(pawScore(id)),
      myPostDays,
    };
  }, [s, ready, snap, dispatch, reload, toast, toastMsg, loadError]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export const newId = uid;
