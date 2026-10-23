import type { NextConfig } from "next";

// Content-Security-Policy (nonce සහිත) src/proxy.ts හි සෑම request එකකටම සාදයි.
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Dev පමණි: localhost නොවන ලිපිනයකින් (උදා: "Network" ලෙස පෙන්වන http://192.168.56.1:3000) විවෘත කළ විට Next.js dev JS blocked වී
  // පිටුව hydrate නොවේ (බොත්තම් "නිහඬව" ක්‍රියා නොකරයි). එම ලිපින මෙහි ඉඩ දෙයි; අමතර ඒවා ALLOWED_DEV_ORIGINS (කොමාවෙන් වෙන් කර) මගින් එක් කළ හැක.
  allowedDevOrigins: ["192.168.56.1", ...(process.env.ALLOWED_DEV_ORIGINS ?? "").split(",").map((h) => h.trim()).filter(Boolean)],
  // පැවරුම් file උඩුගත කිරීම (එක් වරකට උපරිම 4MB + multipart ඉඩ)
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      // Confidentiality: සත්‍යාපනය වූ පිටු සහ API browser/proxy cache වල ගබඩා නොවේ (logout පසු "back" බොත්තමෙන් දත්ත නොපෙනේ)
      ...["/dashboard/:path*", "/admin/:path*", "/login/:path*", "/api/notifications", "/api/files/:path*", "/api/agent-file/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      })),
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
