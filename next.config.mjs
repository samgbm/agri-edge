import withSerwistInit from "@serwist/next";
import { randomUUID } from "node:crypto";

const revision = randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  // Turbopack (next dev) cannot run the Serwist webpack plugin.
  // Production builds use `next build --webpack`, which emits public/sw.js.
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [
    { url: "/", revision },
    { url: "/offline", revision },
  ],
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withSerwist(nextConfig);
