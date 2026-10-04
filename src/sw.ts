/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import {
  CacheFirst,
  ExpirationPlugin,
  Route,
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

const modelRoute = new Route(
  ({ url }) => url.pathname.endsWith(".onnx") || url.pathname.endsWith(".wasm"),
  new CacheFirst({
    cacheName: "agri-edge-models",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 5,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

serwist.registerRoute(modelRoute);

// Default routes include a same-origin catch-all. First match wins, so the
// model route has to sit in front of that catch-all.
const getRoutes = serwist.routes.get("GET");
if (getRoutes) {
  const index = getRoutes.indexOf(modelRoute);
  if (index > 0) {
    getRoutes.splice(index, 1);
    getRoutes.unshift(modelRoute);
  }
}

serwist.addEventListeners();

type QuestionSyncEvent = ExtendableEvent & { tag: string };

async function notifyQuestionSync() {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  await Promise.all(
    clients.map((client) => client.postMessage({ type: "sync-questions" })),
  );
}

self.addEventListener("sync", (event) => {
  const syncEvent = event as QuestionSyncEvent;
  if (syncEvent.tag !== "sync-questions") {
    return;
  }

  syncEvent.waitUntil(notifyQuestionSync());
});
