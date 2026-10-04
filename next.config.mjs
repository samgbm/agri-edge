import withSerwistInit from "@serwist/next";
import { randomUUID } from "node:crypto";

const revision = randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  // The MobileNet placeholder is about 14 MB. The default precache limit is 2 MB.
  maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
  // Turbopack (next dev) cannot run the Serwist webpack plugin.
  // Production builds use `next build --webpack`, which emits public/sw.js.
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [
    { url: "/", revision },
    { url: "/offline", revision },
    { url: "/models/coffee_rust_quantized.onnx", revision },
    { url: "/ort-wasm.wasm", revision },
    { url: "/ort-wasm-simd.wasm", revision },
  ],
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // The package "node" export uses fs. The browser build must stay in WASM.
        "onnxruntime-web$": "onnxruntime-web/wasm",
      };
    }
    return config;
  },
};

export default withSerwist(nextConfig);
