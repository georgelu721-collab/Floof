"use client";

import { useEffect, useRef, useState } from "react";
import { type Aspect, cssFilter, loadImage, lookOf, NO_EDIT, type PhotoEdit, placement, ratioOf, rotate90 } from "@/lib/photo";
import { FILTERS, itemForFilter } from "@/lib/shop";
import { useStore } from "@/lib/store";
import { FilterLayers } from "./ShopPreviews";
import { UnlockSheet } from "./UnlockSheet";
import { IconX } from "./Icons";

export type EditablePhoto = { src: string; edit: PhotoEdit };

/** Full-screen editor for one photo: crop (drag + zoom), rotate, filters and light adjustments. */
export function PhotoEditor({
  photo,
  aspect,
  onAspect,
  onDone,
  onCancel,
  onApplyFilterToAll,
  count,
}: {
  photo: EditablePhoto;
  aspect: Aspect;
  onAspect: (a: Aspect) => void;
  onDone: (p: EditablePhoto) => void;
  onCancel: () => void;
  onApplyFilterToAll?: (filter: string) => void;
  count: number;
}) {
  const { s } = useStore();
  const [src, setSrc] = useState(photo.src);
  const [edit, setEdit] = useState<PhotoEdit>(photo.edit);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [tab, setTab] = useState<"crop" | "filter" | "adjust">("filter");
  const [buying, setBuying] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ex: number; ey: number } | null>(null);
  const pinch = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ d: number; zoom: number } | null>(null);

  useEffect(() => {
    let live = true;
    void loadImage(src).then((img) => live && setSize({ w: img.naturalWidth, h: img.naturalHeight }));
    return () => {
      live = false;
    };
  }, [src]);

  const ratio = ratioOf(aspect);
  const p = size ? placement(size.w, size.h, ratio, edit) : null;
  const look = lookOf(edit);
  const set = (patch: Partial<PhotoEdit>) => setEdit((e) => ({ ...e, ...patch }));
  const owns = (filter: string) => {
    const item = itemForFilter(filter);
    return !item || !!s.unlocks[item.id];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current.size === 2) {
      const [a, b] = [...pinch.current.values()];
      pinchStart.current = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: edit.zoom };
      drag.current = null;
    } else {
      const cur = p ?? { x: edit.x, y: edit.y };
      drag.current = { x: e.clientX, y: e.clientY, ex: cur.x, ey: cur.y };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pinch.current.has(e.pointerId)) return;
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const box = frameRef.current?.getBoundingClientRect();
    if (!box) return;
    if (pinch.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pinch.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      set({ zoom: Math.min(4, Math.max(1, (pinchStart.current.zoom * d) / pinchStart.current.d)) });
      return;
    }
    if (!drag.current || !size) return;
    const nx = drag.current.ex + (e.clientX - drag.current.x) / box.width;
    const ny = drag.current.ey + (e.clientY - drag.current.y) / box.height;
    const c = placement(size.w, size.h, ratio, { ...edit, x: nx, y: ny });
    set({ x: c.x, y: c.y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pinch.current.delete(e.pointerId);
    if (pinch.current.size < 2) pinchStart.current = null;
    drag.current = null;
  };

  const done = () => {
    if (!owns(edit.filter)) return setBuying(itemForFilter(edit.filter)!.id);
    const c = size ? placement(size.w, size.h, ratio, edit) : null;
    onDone({ src, edit: c ? { ...edit, x: c.x, y: c.y } : edit });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-[#1E1411]">
      <div className="flex h-full w-full max-w-[440px] flex-col text-white">
        <div className="flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),14px)]">
          <button onClick={onCancel} aria-label="Cancel" className="p-1">
            <IconX />
          </button>
          <p className="font-display text-lg font-semibold">Edit photo</p>
          <button onClick={done} className="rounded-full bg-white px-4 py-1.5 text-sm font-extrabold text-cocoa">
            Done
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden px-4">
          <div
            ref={frameRef}
            className="relative touch-none select-none overflow-hidden rounded-2xl bg-black"
            style={{ aspectRatio: `1 / ${ratio}`, width: `min(100%, calc((100dvh - 330px) / ${ratio}))`, cursor: "grab" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {p && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt="Photo being edited"
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{
                  left: `${p.left * 100}%`,
                  top: `${(p.top / ratio) * 100}%`,
                  width: `${p.w * 100}%`,
                  height: `${(p.h / ratio) * 100}%`,
                  filter: cssFilter(look),
                }}
              />
            )}
            <FilterLayers look={look} />
            {tab === "crop" && (
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className="border border-white/25" />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
          {tab === "crop" && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                {(["square", "portrait"] as Aspect[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => onAspect(a)}
                    className={`rounded-full px-4 py-1.5 text-sm font-extrabold ${aspect === a ? "bg-white text-cocoa" : "bg-white/10"}`}
                  >
                    {a === "square" ? "◻️ Square 1:1" : "▯ Portrait 4:5"}
                  </button>
                ))}
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      setSrc(await rotate90(src));
                      set({ x: 0, y: 0 });
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-extrabold"
                >
                  ↻ Rotate
                </button>
              </div>
              <Slider label="Zoom" min={100} max={400} value={Math.round(edit.zoom * 100)} onChange={(v) => set({ zoom: v / 100 })} />
              <p className="text-center text-xs font-semibold text-white/50">Drag the photo to reposition · {count > 1 ? "all photos in a post share one shape" : "pinch or slide to zoom"}</p>
            </div>
          )}

          {tab === "filter" && (
            <div className="space-y-2">
              <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
                {FILTERS.map((f) => {
                  const item = itemForFilter(f.id);
                  const locked = !owns(f.id);
                  return (
                    <button key={f.id} onClick={() => set({ filter: f.id })} className="flex w-[68px] shrink-0 flex-col items-center gap-1">
                      <span className={`relative block h-[68px] w-[68px] overflow-hidden rounded-xl ${edit.filter === f.id ? "ring-2 ring-white" : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" style={{ filter: cssFilter(f.look) }} />
                        <FilterLayers look={f.look} />
                        {locked && (
                          <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-[10px] font-extrabold">🔒 {item!.price} 🍪</span>
                        )}
                      </span>
                      <span className="w-full truncate text-center text-[11px] font-bold leading-tight">{f.name}</span>
                    </button>
                  );
                })}
              </div>
              {!owns(edit.filter) && (
                <button className="btn btn-pink w-full !py-2.5 text-sm" onClick={() => setBuying(itemForFilter(edit.filter)!.id)}>
                  Unlock {FILTERS.find((f) => f.id === edit.filter)?.name} for {itemForFilter(edit.filter)!.price} biscuits
                </button>
              )}
              {owns(edit.filter) && count > 1 && onApplyFilterToAll && (
                <button className="w-full text-center text-xs font-extrabold text-white/70" onClick={() => onApplyFilterToAll(edit.filter)}>
                  Use this filter on all {count} photos
                </button>
              )}
            </div>
          )}

          {tab === "adjust" && (
            <div className="space-y-2">
              <Slider label="☀️ Brightness" min={-50} max={50} value={edit.brightness} onChange={(v) => set({ brightness: v })} />
              <Slider label="🌓 Contrast" min={-50} max={50} value={edit.contrast} onChange={(v) => set({ contrast: v })} />
              <Slider label="🎨 Saturation" min={-50} max={50} value={edit.saturation} onChange={(v) => set({ saturation: v })} />
              <button className="w-full text-center text-xs font-extrabold text-white/70" onClick={() => set({ brightness: 0, contrast: 0, saturation: 0 })}>
                Reset
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 rounded-full bg-white/10 p-1 text-sm font-extrabold">
            {(
              [
                ["filter", "Filters"],
                ["adjust", "Adjust"],
                ["crop", "Crop"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-full py-2 ${tab === k ? "bg-white text-cocoa" : "text-white/70"}`}>
                {label}
              </button>
            ))}
          </div>
          <button className="w-full text-center text-xs font-bold text-white/50" onClick={() => setEdit({ ...NO_EDIT })}>
            Undo all edits
          </button>
        </div>
      </div>
      {buying && <UnlockSheet itemId={buying} onClose={() => setBuying(null)} />}
    </div>
  );
}

function Slider({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm font-bold">
      <span className="w-28 shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[#F28CA0]" />
      <span className="w-9 text-right text-xs tabular-nums text-white/60">{value > 0 && min < 0 ? `+${value}` : value}</span>
    </label>
  );
}
