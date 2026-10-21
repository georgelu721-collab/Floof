"use client";

import { IconX } from "./Icons";

/** A bottom sheet that slides up over the page. */
export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cocoa/40" onClick={onClose}>
      <div
        className="animate-sheet max-h-[88dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[2rem] bg-paper px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="mb-3 flex items-center gap-2">
          <p className="flex-1 font-display text-lg font-semibold">{title}</p>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-sand" aria-label="Close">
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
