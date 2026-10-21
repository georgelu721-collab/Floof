import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Toast } from "@/components/Shell";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Floof — Pets make a kinder world",
  description:
    "Floof is a kinder social network for pets. Share first pet moments, send biscuits, join meetups, compete in Clan Wars and find your pet's best friend.",
  applicationName: "Floof",
  openGraph: {
    title: "Floof — Pets make a kinder world",
    description: "Share first pet moments, send biscuits, and find your pet's best friend.",
    images: ["/floof-logo.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff8ee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Fredoka:wght@500;600;700&family=Nunito:wght@500;600;700;800&display=swap"
        />
      </head>
      <body>
        <StoreProvider>
          <div className="relative mx-auto min-h-dvh w-full max-w-[440px] bg-cream shadow-[0_0_60px_-20px_rgba(74,46,34,.35)]">
            {children}
            <Toast />
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
