"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { PetAvatar } from "./PetArt";
import { IconBack, IconHome, IconSearch, IconTrophy, PawIcon } from "./Icons";

export function BottomNav() {
  const path = usePathname();
  const { me } = useStore();
  const item = (href: string, label: string, icon: React.ReactNode, match: string[]) => {
    const on = match.some((m) => path === m || path.startsWith(m + "/"));
    return (
      <Link href={href} className={`flex w-16 flex-col items-center gap-0.5 text-[11px] font-bold ${on ? "text-cocoa" : "text-muted"}`}>
        {icon}
        {label}
      </Link>
    );
  };
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2 border-t border-oat bg-paper/95 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur">
      <div className="flex items-end justify-around px-2">
        {item("/home", "Home", <IconHome />, ["/home", "/post"])}
        {item("/explore", "Explore", <IconSearch />, ["/explore"])}
        <Link
          href="/create"
          aria-label="Create a floof"
          className="-mt-7 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-peach to-blush text-white shadow-[0_8px_20px_-6px_rgba(238,122,140,.8)] ring-4 ring-paper transition active:scale-95"
        >
          <PawIcon size={30} />
        </Link>
        {item("/compete", "Compete", <IconTrophy />, ["/compete", "/competitions", "/clan-wars", "/meetups"])}
        {item(
          `/profile/${me.handle}`,
          "Profile",
          <PetAvatar pet={me} size={24} ring={path.startsWith(`/profile/${me.handle}`) ? "me" : "none"} />,
          [`/profile/${me.handle}`, "/moments", "/wallet", "/friends"],
        )}
      </div>
    </nav>
  );
}

export function TopBar({
  title,
  back = true,
  right,
  sub,
}: {
  title: React.ReactNode;
  back?: boolean;
  right?: React.ReactNode;
  sub?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 bg-cream/90 px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)] backdrop-blur">
      {back && (
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/home"))}
          className="-ml-2 rounded-full p-2 hover:bg-sand"
          aria-label="Back"
        >
          <IconBack />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[22px] font-semibold leading-tight">{title}</h1>
        {sub && <p className="truncate text-xs font-semibold text-muted">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function Toast() {
  const { toastMsg } = useStore();
  if (!toastMsg) return null;
  return (
    <div className="animate-toast fixed bottom-28 left-1/2 z-50 w-max max-w-[90vw] -translate-x-1/2 rounded-full bg-cocoa px-5 py-3 text-sm font-bold text-white shadow-lg">
      {toastMsg}
    </div>
  );
}

export function Page({ children, nav = true }: { children: React.ReactNode; nav?: boolean }) {
  return (
    <>
      <main className={nav ? "pb-28" : "pb-8"}>{children}</main>
      {nav && <BottomNav />}
    </>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between px-4">
      <h2 className="font-display text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}
