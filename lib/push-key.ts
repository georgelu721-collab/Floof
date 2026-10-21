// Public half of the app's push key pair (safe to share). The private half is VAPID_PRIVATE_KEY in Vercel.
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "BDWbF-gfUpLn3yJ9Ohe-pc4vqXIkb2JKlPfFtbldcC7y_cGz-fS5IdoWjMiw4unYZDp63XgMvTiGuFwUqG7-qWM";
