import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <p className="text-6xl">🐾</p>
      <h1 className="mt-4 font-display text-2xl font-semibold">This floof wandered off</h1>
      <p className="mt-1 text-cocoa-soft">We couldn&apos;t find that page.</p>
      <Link href="/home" className="btn btn-dark mt-6">
        Back home
      </Link>
    </main>
  );
}
