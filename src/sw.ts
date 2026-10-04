/// <reference lib="webworker" />
import { flushOutbox, SYNC_TAG } from "./lib/voiceQueue";
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

function preferGetRoute(route: Route) {
  serwist.registerRoute(route);
  const routes = serwist.routes.get("GET");
  if (!routes) {
    return;
  }
  const index = routes.indexOf(route);
  if (index > 0) {
    routes.splice(index, 1);
    routes.unshift(route);
  }
}

// Default routes include a same-origin catch-all. First match wins.
preferGetRoute(modelRoute);

// importScripts() from the vision worker hangs when a caching strategy reuses
// that request. Answer worker script loads with a fresh network fetch.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isScript =
    event.request.destination === "script" ||
    (event.request.destination === "" && url.pathname.endsWith(".js"));

  if (!isScript) {
    return;
  }

  event.respondWith(
    (async () => {
      const client = event.clientId ? await self.clients.get(event.clientId) : null;

      if (client?.type === "worker") {
        return fetch(url.href);
      }

      const handled = await serwist.handleRequest({
        request: event.request,
        event,
      });

      return handled ?? fetch(event.request);
    })(),
  );
});

serwist.addEventListeners();

type QuestionSyncEvent = ExtendableEvent & { tag: string };

async function deliverQueuedQuestions() {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  await flushOutbox(async (reply) => {
    if (clients.length === 0) {
      return false;
    }

    await Promise.all(
      clients.map((client) =>
        client.postMessage({
          type: "voice-reply",
          id: reply.id,
          question: reply.question,
          reply: reply.reply,
          meaning: reply.meaning,
        }),
      ),
    );

    return true;
  });
}

self.addEventListener("sync", (event) => {
  const syncEvent = event as QuestionSyncEvent;
  if (syncEvent.tag !== SYNC_TAG) {
    return;
  }

  syncEvent.waitUntil(deliverQueuedQuestions());
});
