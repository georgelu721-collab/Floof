// Checks a newly posted floof: every photo must show a pet. Runs on the server only.
//
// Needs two environment variables in Vercel (Settings → Environment Variables):
//   ANTHROPIC_API_KEY    – from console.anthropic.com (optional: without it, photo posts are published unchecked)
//   SUPABASE_SECRET_KEY  – Supabase → Project Settings → API Keys → secret key (sb_secret_…)
// Neither is ever sent to the browser.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ttnqpjmjlbyxzfqgwhgi.supabase.co";

const Verdict = z.object({
  photos: z.array(
    z.object({
      shows_pet: z.boolean(),
      main_subject: z.enum(["pet", "pet_with_people", "person", "object", "food", "scenery", "screenshot_or_text", "unclear"]),
    }),
  ),
  allowed: z.boolean(),
  reason: z.string(),
});

const INSTRUCTIONS = `You are the photo checker for Floof, a social network where every post is about a pet.
Look at each photo (in order) and decide whether it shows a pet or other animal as a clear subject.

Allowed: dogs, cats, rabbits, hamsters, birds, reptiles, fish, horses and other animals, including toys or drawings that are clearly of a pet; photos where people appear together with a pet (a person holding or walking their dog is fine).
Not allowed: photos with no animal at all (selfies or other people alone, objects, food, scenery, screenshots, memes or text).

Set "allowed" to true only if every photo shows a pet or animal. Keep "reason" to one short, friendly sentence a pet owner would read, e.g. "We couldn't spot a pet in photo 2."`;

export async function POST(req: Request) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    return Response.json({ status: "unconfigured", message: "Photo checking is not set up yet." }, { status: 503 });
  }

  const { postId } = (await req.json().catch(() => ({}))) as { postId?: string };
  if (!postId || typeof postId !== "string") return Response.json({ error: "postId required" }, { status: 400 });

  const db = createClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: post, error } = await db.from("posts").select("id, status, image_url, image_urls").eq("id", postId).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!post) return Response.json({ error: "not found" }, { status: 404 });

  // Only pending posts are checked, so calling this again costs nothing.
  if (post.status !== "pending") return Response.json({ status: post.status });

  const origin = new URL(req.url).origin;
  const photos: string[] = (post.image_urls?.length ? post.image_urls : post.image_url ? [post.image_url] : [])
    .slice(0, 6)
    .map((u: string) => (u.startsWith("/") ? origin + u : u));

  // No photos to check, or the AI filter isn't switched on yet (no ANTHROPIC_API_KEY): publish straight away.
  if (photos.length === 0 || !anthropicKey) {
    await db.from("posts").update({ status: "approved", moderation_note: null }).eq("id", postId);
    return Response.json({ status: "approved", filter: anthropicKey ? "on" : "off" });
  }

  const client = new Anthropic({ apiKey: anthropicKey });
  let status: "approved" | "rejected" = "rejected";
  let note = "We couldn't check this photo, so it's hidden for now.";
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Verdict) },
      system: INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: [
            ...photos.flatMap((url, i) => [
              { type: "text" as const, text: `Photo ${i + 1}:` },
              { type: "image" as const, source: { type: "url" as const, url } },
            ]),
            { type: "text" as const, text: `Check these ${photos.length} photo(s).` },
          ],
        },
      ],
    });

    const verdict = response.stop_reason === "refusal" ? null : response.parsed_output;
    if (verdict) {
      const everyPhoto = verdict.photos.length >= photos.length && verdict.photos.slice(0, photos.length).every((p) => p.shows_pet);
      status = verdict.allowed && everyPhoto ? "approved" : "rejected";
      note = status === "approved" ? "" : verdict.reason || "We couldn't spot a pet in this photo.";
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500)) {
      // Temporary problem: leave it pending so it is checked again later.
      return Response.json({ status: "pending", message: "Busy, will retry" }, { status: 503 });
    }
    console.error("moderation failed", err);
  }

  await db.from("posts").update({ status, moderation_note: note || null }).eq("id", postId);
  return Response.json({ status, message: note });
}
