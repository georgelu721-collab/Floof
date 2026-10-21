"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { dmKey, timeAgo } from "@/lib/data";
import { useStore } from "@/lib/store";
import { PetAvatar } from "@/components/PetArt";
import { Page, TopBar } from "@/components/Shell";
import { IconPin } from "@/components/Icons";
import { AlertPhoto } from "@/components/AlertPhoto";

export default function AlertPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { alerts, pet, me, dispatch, cloud, toast, signedIn, ready } = useStore();
  const a = alerts.find((x) => x.id === id);

  if (!a) {
    return (
      <Page>
        <TopBar title="Lost & Found" />
        <p className="px-8 py-20 text-center font-semibold text-muted">{ready ? "This alert is no longer available." : "Loading…"}</p>
      </Page>
    );
  }
  const reporter = pet(a.reporterId);
  const mine = a.reporterId === me.id;

  const seen = async () => {
    if (!signedIn) return router.push("/login");
    const text =
      a.kind === "lost"
        ? `Hi! I think I may have seen ${a.name}. ${window.location.origin}/lost/${a.id}`
        : `Hi! I think the pet you found might be ours/known to me. ${window.location.origin}/lost/${a.id}`;
    const ok = await dispatch({ t: "message", threadId: dmKey(a.reporterId, cloud), text, petIds: [a.reporterId] });
    if (ok) router.push(`/messages/${a.reporterId}`);
  };

  const share = async () => {
    const url = `${window.location.origin}/lost/${a.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${a.kind === "lost" ? "Lost" : "Found"} pet: ${a.name}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied — share it in local groups 🔗");
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <Page>
      <TopBar title={a.kind === "lost" ? "Lost pet" : "Found pet"} />
      <AlertPhoto alert={a} className="mx-4 block aspect-[4/3] w-[calc(100%-2rem)] overflow-hidden rounded-3xl" />
      <section className="px-5 pt-4">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-extrabold uppercase ${
            a.status === "resolved" ? "bg-[#E2F0DA] text-[#4F7A3E]" : a.kind === "lost" ? "bg-blush text-white" : "bg-[#FFF1C9]"
          }`}
        >
          {a.status === "resolved" ? "Reunited ❤️" : a.kind === "lost" ? "Missing" : "Found"}
        </span>
        <h1 className="mt-2 font-display text-[26px] font-bold leading-tight">{a.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 font-semibold text-cocoa-soft">
          <IconPin size={16} /> {[a.suburb, a.city].filter(Boolean).join(", ") || "Location not given"}
        </p>
        {a.lastSeen && <p className="mt-1 font-semibold text-cocoa-soft">🕒 {a.lastSeen}</p>}
        {a.description && <p className="mt-3 whitespace-pre-line">{a.description}</p>}

        {reporter && (
          <Link href={`/profile/${reporter.handle}`} className="mt-4 flex items-center gap-2 text-sm font-bold text-muted">
            <PetAvatar pet={reporter} size={28} /> Posted by {reporter.handle} {a.createdAt ? `· ${timeAgo(a.createdAt)}` : ""}
          </Link>
        )}

        {a.status === "active" && (
          <div className="mt-5 space-y-2">
            {mine ? (
              <button
                className="btn btn-dark w-full"
                onClick={async () => {
                  if (confirm(a.kind === "lost" ? `Is ${a.name} home safe?` : "Has this pet been reunited?")) {
                    await dispatch({ t: "resolveAlert", id: a.id });
                    toast("So happy! ❤️ Alert closed");
                  }
                }}
              >
                ❤️ Mark as reunited
              </button>
            ) : (
              <button className="btn btn-pink w-full" onClick={seen}>
                {a.kind === "lost" ? "👀 I've seen them" : "💬 That might be my pet"}
              </button>
            )}
            <button className="btn btn-soft w-full" onClick={share}>
              Share alert
            </button>
          </div>
        )}
      </section>
    </Page>
  );
}
