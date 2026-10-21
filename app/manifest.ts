import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Floof",
    short_name: "Floof",
    description: "A kinder social network for pets",
    start_url: "/home",
    display: "standalone",
    background_color: "#fff8ee",
    theme_color: "#fff8ee",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
