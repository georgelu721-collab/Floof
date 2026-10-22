// Biscuit Shop: frames (borders), sticker packs and photo filters.
// Free items are always available; the rest are unlocked once per pet with biscuits.
// Prices and premium sticker lists must match shop_price() / shop_sticker_item() in the schema.

export type ShopKind = "frame" | "stickers" | "filter";
export type ShopItem = { id: string; kind: ShopKind; name: string; emoji: string; price: number; stickers?: string[] };

/** Filter look. Applied in this order: brightness, contrast, saturation, sepia, grayscale, then tint and vignette. */
export type FilterLook = { b: number; c: number; s: number; sepia: number; gray: number; tint?: [number, number, number, number]; vignette?: number };

export type Filter = { id: string; name: string; look: FilterLook };

export const FILTERS: Filter[] = [
  { id: "", name: "Original", look: { b: 1, c: 1, s: 1, sepia: 0, gray: 0 } },
  { id: "golden", name: "Golden Retriever", look: { b: 1.05, c: 1.05, s: 1.15, sepia: 0.12, gray: 0, tint: [255, 196, 120, 0.1] } },
  { id: "tuxedo", name: "Tuxedo", look: { b: 1.04, c: 1.15, s: 1, sepia: 0, gray: 1 } },
  { id: "husky", name: "Husky", look: { b: 1.04, c: 1.05, s: 0.9, sepia: 0, gray: 0, tint: [120, 170, 255, 0.12] } },
  { id: "corgi", name: "Corgi Pop", look: { b: 1.06, c: 1.1, s: 1.35, sepia: 0, gray: 0 } },
  // Premium
  { id: "shiba", name: "Shiba Sunset", look: { b: 1.04, c: 1.08, s: 1.2, sepia: 0.15, gray: 0, tint: [255, 120, 70, 0.16], vignette: 0.35 } },
  { id: "siamese", name: "Siamese Vintage", look: { b: 1.06, c: 0.88, s: 0.85, sepia: 0.45, gray: 0, tint: [255, 240, 215, 0.12], vignette: 0.25 } },
  { id: "dalmatian", name: "Dalmatian Noir", look: { b: 0.98, c: 1.45, s: 1, sepia: 0, gray: 1, vignette: 0.45 } },
  { id: "poodle", name: "Poodle Pastel", look: { b: 1.1, c: 0.82, s: 0.8, sepia: 0, gray: 0, tint: [255, 182, 214, 0.16] } },
  { id: "persian", name: "Persian Dream", look: { b: 1.12, c: 0.9, s: 1.05, sepia: 0.08, gray: 0, tint: [255, 255, 255, 0.12], vignette: 0.15 } },
];

export const SHOP: ShopItem[] = [
  // Frames (borders)
  { id: "frame:neon", kind: "frame", name: "Neon Glow", emoji: "💡", price: 20 },
  { id: "frame:rainbow", kind: "frame", name: "Rainbow", emoji: "🌈", price: 20 },
  { id: "frame:film", kind: "frame", name: "Film Strip", emoji: "🎞️", price: 15 },
  { id: "frame:royal", kind: "frame", name: "Royal", emoji: "👑", price: 25 },
  { id: "frame:stars", kind: "frame", name: "Starry", emoji: "✨", price: 15 },
  { id: "frame:bones", kind: "frame", name: "Bones", emoji: "🦴", price: 15 },
  { id: "frame:blossom", kind: "frame", name: "Blossom", emoji: "🌸", price: 15 },
  // Sticker packs
  { id: "stickers:party", kind: "stickers", name: "Party pack", emoji: "🥳", price: 10, stickers: ["🥳", "🎂", "🎁", "🎈", "🪅"] },
  { id: "stickers:spooky", kind: "stickers", name: "Spooky pack", emoji: "🎃", price: 10, stickers: ["🎃", "👻", "🦇", "🕸️", "🍬"] },
  { id: "stickers:fancy", kind: "stickers", name: "Fancy pack", emoji: "💎", price: 15, stickers: ["💎", "🎩", "🦄", "🌟", "💅"] },
  { id: "stickers:snacks", kind: "stickers", name: "Snack pack", emoji: "🍩", price: 10, stickers: ["🍕", "🍩", "🧁", "🍦", "🥓"] },
  { id: "stickers:nature", kind: "stickers", name: "Nature pack", emoji: "🌻", price: 10, stickers: ["🍀", "🌻", "🦋", "🌙", "☀️"] },
  // Filters
  { id: "filter:shiba", kind: "filter", name: "Shiba Sunset", emoji: "🌅", price: 10 },
  { id: "filter:siamese", kind: "filter", name: "Siamese Vintage", emoji: "📜", price: 10 },
  { id: "filter:dalmatian", kind: "filter", name: "Dalmatian Noir", emoji: "🖤", price: 10 },
  { id: "filter:poodle", kind: "filter", name: "Poodle Pastel", emoji: "🩷", price: 10 },
  { id: "filter:persian", kind: "filter", name: "Persian Dream", emoji: "☁️", price: 10 },
];

export const shopItem = (id: string) => SHOP.find((i) => i.id === id);

/** The shop item needed to use a sticker, frame or filter (undefined when it's free). */
export const itemForSticker = (e: string) => SHOP.find((i) => i.stickers?.includes(e));
export const itemForFrame = (frame: string) => (frame ? shopItem(`frame:${frame}`) : undefined);
export const itemForFilter = (filter: string) => (filter ? shopItem(`filter:${filter}`) : undefined);
