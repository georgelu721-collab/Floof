"use client";

import { remote } from "./cloud";
import { VAPID_PUBLIC_KEY } from "./push-key";

export { VAPID_PUBLIC_KEY };

export function pushSupport(): "ok" | "ios-needs-home-screen" | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return ios && !standalone ? "ios-needs-home-screen" : "unsupported";
  }
  if (ios && !standalone) return "ios-needs-home-screen";
  return "ok";
}

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription() {
  if (pushSupport() !== "ok") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(petId: string) {
  if (pushSupport() !== "ok") throw new Error("Notifications aren't supported here");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them in your browser settings.");
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  await remote.savePushSubscription(petId, sub.toJSON());
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await remote.deletePushSubscription(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe();
}
