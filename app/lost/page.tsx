"use client";

import Link from "next/link";
import { useState } from "react";
import { timeAgo } from "@/lib/data";
import { useStore } from "@/lib/store";
import type { LostAlert } from "@/lib/types";
import { AlertPhoto } from "@/components/AlertPhoto";
import { Page, TopBar } from "@/components/Shell";
import { IconPin } from "@/components/Icons";

export default function Lost() {
  const { alerts, me, signedIn } = useStore();
  const [scope, setScope] = useState<"near" | "all">("near");
  const near = (a: LostAlert) => !me.city || !a.city || a.city.toLowerCase() === me.city.toLowerCase();
  const list = alerts.filter((a) => (scope === "all" || near(a)));
  const active = list.filter((a) => a.status === "active");
  const resolved = list.filter((a) => a.status === "resolved");

  return (
    <Page>
      <TopBar title="Lost & Found" sub="Help reunite pets with their families" />

      <div className="grid grid-cols-2 gap-2 px-4">
        <Link href={signedIn ? "/lost/new?kind=lost" : "/login"} className="btn btn-pink !py-3 text-sm">
          🚨 My pet is lost
        </Link>
        <Link href={signedIn ? "/lost/new?kind=found" : "/login"} className="btn btn-soft !py-3 text-sm">
          🏠 I found a pet
        </Link>
      </div>

      <div className="flex gap-2 px-4 pt-4">
        <button className="chip" data-on={scope === "near"} onClick={() => setScope("near")}>
          📍 {me.city ? `Near ${me.city}` : "Near me"}
        </button>
        <button className="chip" data-on={scope === "all"} onClick={() => setScope("all")}>
          Everywhere
        </button>
      </div>

      <div className="space-y-3 px-4 pt-4">
        {active.map((a) => (
          <AlertRow key={a.id} alert={a} />
        ))}
        {active.length === 0 && (
          <p className="py-10 text-center font-semibold text-muted">No active alerts {scope === "near" ? "near you" : ""} — great news! 💛</p>
        )}
      </div>

      {resolved.length > 0 && (
        <>
          <p className="px-4 pb-2 pt-6 font-display text-lg font-semibold">Recently reunited ❤️</p>
          <div className="space-y-3 px-4 opacity-70">
            {resolved.map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </div>
        </>
      )}
      <p className="px-8 pt-6 text-center text-xs font-semibold text-muted">
        Also contact your local council pound and vets, and check the microchip registry.
      </p>
    </Page>
  );
}

function AlertRow({ alert }: { alert: LostAlert }) {
  return (
    <Link href={`/lost/${alert.id}`} className="card flex gap-3 p-3">
      <AlertPhoto alert={alert} className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl" />
      <div className="min-w-0 flex-1">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase ${
            alert.status === "resolved" ? "bg-[#E2F0DA] text-[#4F7A3E]" : alert.kind === "lost" ? "bg-blush text-white" : "bg-[#FFF1C9]"
          }`}
        >
          {alert.status === "resolved" ? "Reunited" : alert.kind}
        </span>
        <p className="mt-1 truncate font-extrabold">{alert.name}</p>
        <p className="flex items-center gap-1 truncate text-xs font-semibold text-muted">
          <IconPin size={12} /> {[alert.suburb, alert.city].filter(Boolean).join(", ") || "Location not given"}
        </p>
        <p className="truncate text-xs font-semibold text-muted">
          {alert.lastSeen ? `Last seen: ${alert.lastSeen}` : ""} {alert.createdAt ? `· ${timeAgo(alert.createdAt)}` : ""}
        </p>
      </div>
    </Link>
  );
}
