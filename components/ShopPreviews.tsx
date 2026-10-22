"use client";

import type { FilterLook } from "@/lib/shop";
import { cssFilter } from "@/lib/photo";
import { Decorations } from "./PetArt";

/** The tint and vignette parts of a filter, drawn over a photo (the rest is a CSS filter). */
export function FilterLayers({ look }: { look: FilterLook }) {
  return (
    <>
      {look.tint && <span className="pointer-events-none absolute inset-0" style={{ background: `rgba(${look.tint.join(",")})` }} />}
      {look.vignette ? (
        <span
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(ellipse farthest-corner at center, transparent 45%, rgba(0,0,0,${look.vignette}) 100%)` }}
        />
      ) : null}
    </>
  );
}

/** A sample photo with a filter applied. */
export function FilteredSample({ look, src = "/photos/pet-bigmac.jpg", size }: { look: FilterLook; src?: string; size: number }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-2xl" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" style={{ filter: cssFilter(look) }} />
      <FilterLayers look={look} />
    </span>
  );
}

/** A sample photo with a frame. */
export function FramePreview({ frame, size }: { frame: string; size: number }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-2xl bg-sand" style={{ width: size, height: size, containerType: "inline-size" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/photos/pet-mochi.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <Decorations frame={frame} />
    </span>
  );
}
