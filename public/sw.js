const CACHE_NAME = "catalog-shell-v3";

function getBasePath() {
  const scopePath = self.registration?.scope ? new URL(self.registration.scope).pathname : "/";
  if (!scopePath || scopePath === "/") return "";
  return scopePath.replace(/\/$/, "");
}

const BASE_PATH = getBasePath();
const CORE_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/offline.html`,
  `${BASE_PATH}/catalog-config.js`,
  `${BASE_PATH}/manifest.webmanifest`,
  `${BASE_PATH}/favicon.svg`,
  `${BASE_PATH}/pwa-icon.svg`,
  `${BASE_PATH}/pwa-maskable.svg`,
];
const OFFLINE_DOCUMENT = `${BASE_PATH}/offline.html`;

function isApiRequest(url) {
  return (
    url.pathname === `${BASE_PATH}/api`
    || url.pathname.startsWith(`${BASE_PATH}/api/`)
    || url.pathname.startsWith(`${BASE_PATH}/.netlify/functions`)
  );
}

async function warmCoreCache() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(CORE_ASSETS);
}

self.addEventListener("install", (event) => {
  event.waitUntil(warmCoreCache());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );

  self.clients.claim();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (
      (await cache.match(request))
      || (await cache.match(`${BASE_PATH}/index.html`))
      || cache.match(OFFLINE_DOCUMENT)
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise || fetch(request);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    request.destination === "script"
    || request.destination === "style"
    || request.destination === "image"
    || request.destination === "font"
    || url.pathname.startsWith(`${BASE_PATH}/assets/`)
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
