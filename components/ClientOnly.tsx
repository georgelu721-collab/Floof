"use client";

import { useEffect, useState } from "react";
import { PawIcon } from "./Icons";

/**
 * Floof depends on who is signed in, local dates and browser storage, so pages are drawn in the
 * browser only. This avoids the server and phone disagreeing (e.g. on today's date).
 */
export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-peach">
        <PawIcon size={44} className="animate-pulse" />
      </div>
    );
  }
  return <>{children}</>;
}
