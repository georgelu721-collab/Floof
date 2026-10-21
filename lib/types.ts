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
  likes: number;
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
  moderationNote?: string;
};

export type Notification = {
  id: string;
  petId: string;
  kind: "boop" | "comment" | "follow" | "biscuit" | "mention" | "pack" | "trending" | "bestfriend";
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
  type: "sent" | "topup" | "received" | "redeem";
  amount: number; // biscuits
  petId?: string;
  note?: string;
  at: number;
};

export type Thread = {
  id: string;
  petIds: string[];
  title: string;
  messages: { id: string; from: string; text: string; at: string }[];
};
