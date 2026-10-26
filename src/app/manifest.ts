import type { MetadataRoute } from "next";

// PWA: Home screen එකට එකතු කළ විට app එකක් ලෙස විවෘත වේ
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Innovative ICT",
    short_name: "Innovative ICT",
    description: "Innovative ICT learning management system",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1633",
    theme_color: "#0b1633",
    lang: "si",
    icons: [
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
      { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
