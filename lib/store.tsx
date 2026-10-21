"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AFFINITY, DEMO_PET_ID, PETS, POSTS } from "./data";
import { CLOUD, sb } from "./supabase";
import { loadSnapshot, remote, subscribeToMessages, type Snapshot } from "./cloud";
import type { Clan, Comment, LedgerEntry, MomentType, Pet, Post, Thread } from "./types";

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
};

export type Action =
  | { t: "hydrate"; s: Partial<State> }
  | { t: "login"; id: string }
  | { t: "createPet"; pet: Pet }
  | { t: "logout" }
  | { t: "boop"; postId: string; petId: string }
  | { t: "save"; postId: string }
  | { t: "follow"; petId: string }
  | { t: "comment"; postId: string; petId: string; text: string }
  | { t: "post"; post: Post }
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
  | { t: "updateMe"; patch: Partial<Pet> };

const bump = (m: Record<string, number>, id: string, n: number) => ({ ...m, [id]: (m[id] ?? 0) + n });
const uid = () => Math.random().toString(36).slice(2, 10);

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "hydrate":
      return { ...s, ...a.s };
    case "login":
      return { ...s, me: a.id };
    case "createPet":
      return { ...s, customPets: [...s.customPets.filter((p) => p.id !== a.pet.id), a.pet], me: a.pet.id };
    case "logout":
      return { ...s, me: null };
    case "boop": {
      const on = !s.boops[a.postId];
      const boops = { ...s.boops };
      if (on) boops[a.postId] = true;
      else delete boops[a.postId];
      return { ...s, boops, interactions: bump(s.interactions, a.petId, on ? 1 : -1) };
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
      };
    }
    case "post": {
      const unlocked = a.post.moment && !s.unlocked[a.post.moment] ? { ...s.unlocked, [a.post.moment]: a.post.id } : s.unlocked;
      return { ...s, myPosts: [a.post, ...s.myPosts], unlocked, clanFloofs: s.clan ? s.clanFloofs + 1 : s.clanFloofs };
    }
    case "sendBiscuits":
      if (a.amount > s.balance || a.amount <= 0) return s;
      return {
        ...s,
        balance: s.balance - a.amount,
        ledger: [{ id: uid(), type: "sent", amount: a.amount, petId: a.petId, note: a.note, at: Date.now() }, ...s.ledger],
        interactions: bump(s.interactions, a.petId, 5 * a.amount),
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
      const msg = { id: uid(), from: "me", text: a.text, at: "now" };
      let interactions = s.interactions;
      for (const p of a.petIds) interactions = bump(interactions, p, 1);
      return { ...s, threads: { ...s.threads, [a.threadId]: [...(s.threads[a.threadId] ?? []), msg] }, interactions };
    }
    case "incoming":
      if ((s.threads[a.threadId] ?? []).some((m) => m.id === a.msg.id)) return s;
      return {
        ...s,
        threads: { ...s.threads, [a.threadId]: [...(s.threads[a.threadId] ?? []), a.msg] },
        interactions: bump(s.interactions, a.petId, 1),
      };
    case "updateMe":
      return { ...s, customPets: s.customPets.map((p) => (p.id === s.me ? { ...p, ...a.patch } : p)) };
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
    case "updateMe":
      return remote.updatePet(me, { name: a.patch.name, bio: a.patch.bio });
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
  clanExtra: { cats: number; dogs: number };
  extraVotes: (compId: string, postId: string) => number;
  remoteEntries: (compId: string) => string[];
  toast: (msg: string) => void;
  toastMsg: string | null;
  loadError: string | null;
};

const StoreCtx = createContext<Ctx | null>(null);

const LOGIN_FREE = new Set<Action["t"]>(["hydrate", "login", "logout", "incoming"]);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, rawDispatch] = useReducer(reducer, CLOUD ? { ...initial, balance: 0, ledger: [], following: {}, packs: {} } : initial);
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
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
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
        msg: { id: m.id, from: m.from_pet, text: m.text, at: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
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
          await remote.createPet(a.pet);
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
      const before = stateRef.current;
      rawDispatch(a);
      if (LOGIN_FREE.has(a.t) || a.t === "clanFloof") return true;
      try {
        await syncAction(a, before, me!);
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
    const me: Pet = { ...meBase, biscuitsReceived: meBase.biscuitsReceived + s.received, clan: s.clan ?? meBase.clan };

    const allPosts = CLOUD ? [...s.myPosts.filter((p) => !snap?.posts.some((x) => x.id === p.id)), ...(snap?.posts ?? [])] : [...s.myPosts, ...POSTS];
    const posts = allPosts.map((p) => {
      const extra = s.comments[p.id] ?? [];
      return extra.length ? { ...p, comments: [...p.comments, ...extra], commentCount: p.commentCount + extra.length } : p;
    });
    const post = (id: string) => posts.find((p) => p.id === id);

    const bestFriends = (petId: string) => {
      const seed = AFFINITY[petId] ?? (petId === meId ? { mochi: { score: 12, streak: 2 }, luna: { score: 8, streak: 1 } } : {});
      const map: Record<string, { score: number; streak: number }> = {};
      for (const [id, v] of Object.entries(seed)) map[id] = { ...v };
      if (petId === meId) {
        for (const [id, n] of Object.entries(s.interactions)) {
          if (id === meId) continue;
          map[id] = { score: (map[id]?.score ?? 0) + n, streak: map[id]?.streak ?? (n > 0 ? 1 : 0) };
        }
      }
      return Object.entries(map)
        .map(([id, v]) => ({ pet: pet(id)!, ...v }))
        .filter((x) => x.pet && x.score > 0)
        .sort((a, b) => b.score - a.score);
    };

    const pawScore = (petId: string) => {
      const p = petId === me.id ? me : pet(petId);
      if (!p) return 0;
      if (petId !== meId) return p.pawScore + (p.ownerId ? (p.postCount ?? 0) * 25 : 0);
      const sent = s.ledger.filter((l) => l.type === "sent").reduce((a, l) => a + l.amount, 0);
      const myPostCount = posts.filter((x) => x.petId === meId && x.createdAt).length;
      return (
        p.pawScore +
        myPostCount * 25 +
        Object.keys(s.boops).length * 2 +
        Object.values(s.comments).flat().length * 4 +
        sent * 3 +
        Object.keys(s.checkins).length * 50 +
        Object.keys(s.events).length * 10
      );
    };

    const clanExtra = CLOUD && snap
      ? {
          cats: snap.clan.cats + (s.clan === "cats" ? Math.max(0, s.clanFloofs - snap.myClanFloofs) * 5 : 0),
          dogs: snap.clan.dogs + (s.clan === "dogs" ? Math.max(0, s.clanFloofs - snap.myClanFloofs) * 5 : 0),
        }
      : { cats: s.clan === "cats" ? s.clanFloofs * 5 : 0, dogs: s.clan === "dogs" ? s.clanFloofs * 5 : 0 };

    const extraVotes = (compId: string, postId: string) =>
      snap ? (snap.voteCounts[compId]?.[postId] ?? 0) - (snap.initialVotes[compId] === postId ? 1 : 0) : 0;
    const remoteEntries = (compId: string) => snap?.entries[compId] ?? [];

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
      clanExtra,
      extraVotes,
      remoteEntries,
      toast,
      toastMsg,
      loadError,
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
