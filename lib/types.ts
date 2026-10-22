export type Species = "dog" | "cat" | "bunny" | "hamster";
export type EarStyle = "floppy" | "pointy" | "fluffy" | "cat" | "bunny" | "round";
export type Expression = "happy" | "smile" | "wink" | "sleepy";
export type Accessory =
  | "none"
  | "bandana"
  | "party"
  | "flowers"
  | "sunglasses"
  | "bow"
  | "crown"
  | "hat"
  | "duck";
export type Scene =
  | "park"
  | "beach"
  | "blossom"
  | "expo"
  | "salon"
  | "cozy"
  | "snow"
  | "party"
  | "sunset"
  | "vet"
  | "night";

export type Look = {
  fur: string; // main fur colour
  ear?: string; // ear colour (defaults to fur)
  muzzle?: string; // muzzle / blaze colour
  stripes?: string; // tabby stripes
  earStyle: EarStyle;
};

export type Clan = "cats" | "dogs";

export type Pet = {
  id: string;
  handle: string;
  name: string;
  species: Species;
  breed: string;
  age: string;
  city: string;
  bio: string[];
  owner: string;
  look: Look;
  photo?: string; // optional uploaded avatar (data URL)
  followers: number;
  following: number;
  biscuitsReceived: number;
  pawScore: number;
  postCount?: number; // from the database (cloud mode)
  ownerId?: string | null; // null = Floof house pet
  birthday?: string; // YYYY-MM-DD
  gotchaDay?: string; // YYYY-MM-DD
  personality?: string; // quiz result, e.g. "Chaotic Snuggler"
  clan: Clan;
  verified?: boolean;
  bg: string; // avatar background tint
};

export type MomentType =
  | "first-floof"
  | "first-haircut"
  | "first-expo"
  | "first-vet"
  | "first-beach"
  | "first-birthday"
  | "first-park"
  | "first-snow"
  | "first-friend"
  | "gotcha-day";

export type Comment = {
  id: string;
  petId: string;
  text: string;
  ago: string;
  likes: number; // total likes (sample base + real)
  parentId?: string; // set on replies
};

export type Post = {
  id: string;
  petId: string;
  scene: Scene;
  accessory: Accessory;
  expression: Expression;
  image?: string; // cover photo (URL or data URL)
  images?: string[]; // all photos in order when there is more than one
  overlay?: string; // handwritten text on the photo
  caption: string;
  tags: string[];
  location?: string;
  boops: number;
  biscuits: number;
  commentCount: number;
  comments: Comment[];
  createdAt: number; // epoch ms (0 for seeded posts)
  ago?: string; // display time for seeded posts
  moment?: MomentType;
  slides?: number;
  status?: "pending" | "approved" | "rejected"; // photo check (cloud mode)
  dailyDate?: string; // YYYY-MM-DD of the Daily Floof prompt this answers
  taggedPets?: string[];
  frame?: string;
  stickers?: Sticker[];
  editedAt?: number;
  moderationNote?: string;
  aspect?: "square" | "portrait";
};

export type Notification = {
  id: string;
  petId: string;
  kind: "boop" | "comment" | "follow" | "biscuit" | "mention" | "pack" | "trending" | "bestfriend" | "reply" | "commentLike" | "tag" | "pawfive" | "playdate";
  text: string;
  ago: string;
  postId?: string;
};

export type Competition = {
  id: string;
  title: string;
  blurb: string;
  status: "active" | "upcoming" | "past";
  endsInDays: number;
  prize: string;
  sponsor: string;
  scene: Scene;
  accessory: Accessory;
  heroPetId: string;
  entries: { postId: string; votes: number }[];
  winnerPetId?: string;
};

export type Meetup = {
  id: string;
  title: string;
  kind: "event" | "meetup";
  date: string;
  time: string;
  place: string;
  suburb: string;
  description: string;
  scene: Scene;
  heroPetId: string;
  interested: number;
  going: number;
  attendees: string[];
  momentType?: MomentType;
  forSpecies?: Species[];
  recurring?: string; // e.g. "Every 2nd Saturday"
};

export type Listing = {
  id: string;
  title: string;
  price: string;
  where: string;
  category: "Pets" | "Supplies" | "Services" | "Adoption";
  emoji: string;
  tint: string;
};

export type Pack = {
  id: string;
  name: string;
  members: string;
  tags: string[];
  petId: string;
};

export type LedgerEntry = {
  id: string;
  type: "sent" | "topup" | "received" | "redeem" | "shop";
  amount: number; // biscuits
  petId?: string;
  postId?: string; // the post a gift was sent on
  note?: string;
  at: number;
};

export type Thread = {
  id: string;
  petIds: string[];
  title: string;
  messages: Message[];
};

export type Reminder = {
  id: string;
  title: string;
  kind: "vaccination" | "flea" | "worming" | "vet" | "grooming" | "medication" | "other";
  due: string; // YYYY-MM-DD
  repeat: "none" | "monthly" | "quarterly" | "yearly";
};

export type Weight = { id: string; date: string; kg: number };

export type Note = { id: string; title: string; body: string; pinned: boolean; updatedAt: number };

export type LostAlert = {
  id: string;
  kind: "lost" | "found";
  reporterId: string;
  petId?: string;
  name: string;
  description: string;
  suburb: string;
  city: string;
  lastSeen: string;
  photo?: string;
  status: "active" | "resolved";
  createdAt: number;
};

export type Sticker = { e: string; x: number; y: number }; // emoji at x/y % of the photo

export type Message = {
  id: string;
  from: string; // "me" or a pet id
  text: string;
  at: string;
  ts?: number;
  replyTo?: string;
  reactions?: Record<string, string>; // pet id -> emoji
};

export type Story = {
  id: string;
  petId: string;
  image?: string;
  text?: string;
  bg: string;
  createdAt: number;
  expiresAt: number;
};

export type Collection = { id: string; name: string; postIds: string[] };

export type Playdate = {
  id: string;
  fromPet: string;
  toPet: string;
  place: string;
  startsAt: number;
  note: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
};
