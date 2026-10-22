// Photo editing in the browser: crop (zoom + pan), rotate, brightness/contrast/saturation and filters.
// The preview uses CSS; the final photo is drawn on a canvas with the same maths, so it looks the
// same everywhere (including browsers without canvas filters).

import { FILTERS, type FilterLook } from "./shop";

export type Aspect = "square" | "portrait";
export type PhotoEdit = {
  zoom: number; // 1 = fill the frame
  x: number; // pan, as a fraction of the frame width (0 = centred)
  y: number; // pan, as a fraction of the frame height
  filter: string;
  brightness: number; // -50..50
  contrast: number; // -50..50
  saturation: number; // -50..50
};
export const NO_EDIT: PhotoEdit = { zoom: 1, x: 0, y: 0, filter: "", brightness: 0, contrast: 0, saturation: 0 };

export const ratioOf = (a: Aspect) => (a === "portrait" ? 5 / 4 : 1); // height / width
export const OUT_W = 1080;
export const THUMB_W = 480;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** The full look of an edit: the filter combined with the user's slider tweaks. */
export function lookOf(e: PhotoEdit): FilterLook {
  const f = FILTERS.find((x) => x.id === e.filter)?.look ?? FILTERS[0].look;
  return { ...f, b: f.b * (1 + e.brightness / 100), c: f.c * (1 + e.contrast / 100), s: f.s * (1 + e.saturation / 100) };
}

export function cssFilter(l: FilterLook) {
  return `brightness(${l.b}) contrast(${l.c}) saturate(${l.s}) sepia(${l.sepia}) grayscale(${l.gray})`;
}

/** Size and position of the photo inside a frame of width 1 and height `ratio`. */
export function placement(imgW: number, imgH: number, ratio: number, e: PhotoEdit) {
  const cover = Math.max(1 / imgW, ratio / imgH);
  const w = imgW * cover * e.zoom;
  const h = imgH * cover * e.zoom;
  const maxX = Math.max(0, (w - 1) / 2);
  const maxY = Math.max(0, (h - ratio) / 2) / ratio;
  const x = Math.max(-maxX, Math.min(maxX, e.x));
  const y = Math.max(-maxY, Math.min(maxY, e.y));
  // left/top of the photo, in frame units
  return { w, h, left: 0.5 + x - w / 2, top: ratio / 2 + y * ratio - h / 2, x, y };
}

/** Rotate a photo 90° clockwise. */
export async function rotate90(src: string) {
  const img = await loadImage(src);
  const c = document.createElement("canvas");
  c.width = img.height;
  c.height = img.width;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  return c.toDataURL("image/jpeg", 0.92);
}

function matrixFor(l: FilterLook) {
  // Affine colour matrix (3x3 + offset) for brightness → contrast → saturate → sepia → grayscale.
  const mul = (a: number[][], b: number[][]) => a.map((r) => [0, 1, 2, 3].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j] + (j === 3 ? r[3] : 0)));
  const lin = (m: number[][]) => m.map((r) => [...r, 0]);
  const s = l.s;
  const sat = lin([
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ]);
  const a = 1 - l.sepia;
  const sep = lin([
    [0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a],
    [0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a],
    [0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a],
  ]);
  const g = 1 - l.gray;
  const gray = lin([
    [0.2126 + 0.7874 * g, 0.7152 - 0.7152 * g, 0.0722 - 0.0722 * g],
    [0.2126 - 0.2126 * g, 0.7152 + 0.2848 * g, 0.0722 - 0.0722 * g],
    [0.2126 - 0.2126 * g, 0.7152 - 0.7152 * g, 0.0722 + 0.9278 * g],
  ]);
  // brightness then contrast: v * b * c + 0.5 * (1 - c)
  const bc = [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? l.b * l.c : 0)).concat(0.5 * (1 - l.c)));
  // Apply right-to-left: gray(sep(sat(bc(v))))
  return mul(gray, mul(sep, mul(sat, bc)));
}

/** Draw the edited photo at full size and return a JPEG data URL. */
export async function renderPhoto(src: string, aspect: Aspect, e: PhotoEdit, width = OUT_W) {
  const img = await loadImage(src);
  const ratio = ratioOf(aspect);
  const W = width;
  const H = Math.round(width * ratio);
  const p = placement(img.naturalWidth, img.naturalHeight, ratio, e);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, p.left * W, p.top * W, p.w * W, p.h * W);

  const l = lookOf(e);
  const plain = l.b === 1 && l.c === 1 && l.s === 1 && !l.sepia && !l.gray && !l.tint && !l.vignette;
  if (!plain) {
    const data = ctx.getImageData(0, 0, W, H);
    const d = data.data;
    const m = matrixFor(l);
    const [tr, tg, tb, ta] = l.tint ?? [0, 0, 0, 0];
    const v = l.vignette ?? 0;
    const cx = W / 2;
    const cy = H / 2;
    for (let y = 0; y < H; y++) {
      const dy = (y - cy) / cy;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const r = d[i] / 255;
        const g = d[i + 1] / 255;
        const b = d[i + 2] / 255;
        let R = Math.min(1, Math.max(0, m[0][0] * r + m[0][1] * g + m[0][2] * b + m[0][3]));
        let G = Math.min(1, Math.max(0, m[1][0] * r + m[1][1] * g + m[1][2] * b + m[1][3]));
        let B = Math.min(1, Math.max(0, m[2][0] * r + m[2][1] * g + m[2][2] * b + m[2][3]));
        if (ta) {
          R = R * (1 - ta) + (tr / 255) * ta;
          G = G * (1 - ta) + (tg / 255) * ta;
          B = B * (1 - ta) + (tb / 255) * ta;
        }
        if (v) {
          const dx = (x - cx) / cx;
          const dist = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
          const t = Math.min(1, Math.max(0, (dist - 0.45) / 0.55));
          const k = 1 - v * t;
          R *= k;
          G *= k;
          B *= k;
        }
        d[i] = R * 255;
        d[i + 1] = G * 255;
        d[i + 2] = B * 255;
      }
    }
    ctx.putImageData(data, 0, 0);
  }
  return c.toDataURL("image/jpeg", 0.86);
}

/** A small copy of a finished photo, for grids. */
export async function makeThumb(src: string, width = THUMB_W) {
  const img = await loadImage(src);
  const scale = Math.min(1, width / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.74);
}

/** Uploaded post photos are named *.f.jpg and have a small *.t.jpg copy next to them. */
export const thumbOf = (url: string) => (url.endsWith(".f.jpg") ? url.slice(0, -6) + ".t.jpg" : url);
