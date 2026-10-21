"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { AFFINITY, DEMO_PET_ID, PETS, POSTS, THREADS } from "./data";
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
  received: number; // extra biscuits received by my pet (on top of seed)
  ledger: LedgerEntry[];
  interactions: Record<string, number>; // my extra affinity with other pets
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

type Action =
  | { t: "hydrate"; s: Partial<State> }
  | { t: "login"; id: string }
  | { t: "createPet"; pet: Pet }
  | { t: "logout" }
  | { t: "boop"; postId: string; petId: string }
  | { t: "save"; postId: string }
  | { t: "follow"; petId: string }
  | { t: "comment"; postId: string; petId: string; text: string }
  | { t: "post"; post: Post }
  | { t: "sendBiscuits"; petId: string; amount: number; note?: string }
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
      return {
        ...s,
        myPosts: [a.post, ...s.myPosts],
        unlocked,
        clanFloofs: s.clan ? s.clanFloofs + 1 : s.clanFloofs,
      };
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
    case "updateMe":
      return {
        ...s,
        customPets: s.customPets.map((p) => (p.id === s.me ? { ...p, ...a.patch } : p)),
      };
  }
}

const KEY = "floof:v1";

type Ctx = {
  s: State;
  ready: boolean;
  dispatch: React.Dispatch<Action>;
  pets: Pet[];
  posts: Post[];
  me: Pet;
  pet: (id: string) => Pet | undefined;
  post: (id: string) => Post | undefined;
  bestFriends: (petId: string) => { pet: Pet; score: number; streak: number }[];
  pawScore: (petId: string) => number;
  toast: (msg: string) => void;
  toastMsg: string | null;
};

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, dispatch] = useReducer(reducer, initial);
  const [ready, setReady] = useState(false);
  const [toastMsg, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) dispatch({ t: "hydrate", s: JSON.parse(raw) });
    } catch {
      /* storage unavailable: run with defaults */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // Most likely over quota because of uploaded photos: drop the oldest image posts' photos.
      try {
        const slim = { ...s, myPosts: s.myPosts.map((p, i) => (i < 3 ? p : { ...p, image: undefined })) };
        localStorage.setItem(KEY, JSON.stringify(slim));
      } catch {
        /* give up quietly */
      }
    }
  }, [s, ready]);

  const toast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((m) => (m === msg ? null : m)), 2400);
  }, []);

  const value = useMemo<Ctx>(() => {
    const pets = [...PETS, ...s.customPets];
    const pet = (id: string) => pets.find((p) => p.id === id);
    const meId = s.me ?? DEMO_PET_ID;
    const meBase = pet(meId) ?? PETS[0];
    const me: Pet = {
      ...meBase,
      biscuitsReceived: meBase.biscuitsReceived + s.received,
      followers: meBase.followers,
    };

    // Posts: my new posts first, then seeded posts, with my comments merged in.
    const posts = [...s.myPosts, ...POSTS].map((p) => {
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
      const p = pet(petId);
      if (!p) return 0;
      if (petId !== meId) return p.pawScore;
      const sent = s.ledger.filter((l) => l.type === "sent").reduce((a, l) => a + l.amount, 0);
      return (
        p.pawScore +
        s.myPosts.length * 25 +
        Object.keys(s.boops).length * 2 +
        Object.values(s.comments).flat().length * 4 +
        sent * 3 +
        Object.keys(s.checkins).length * 50 +
        Object.keys(s.events).length * 10 +
        s.clanFloofs * 5
      );
    };

    return { s, ready, dispatch, pets, posts, me, pet, post, bestFriends, pawScore, toast, toastMsg };
  }, [s, ready, toast, toastMsg]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export const newId = uid;
