const CACHE_NAME = "pikmin-flower-map-v6";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg"
];

// 安裝時先快取基本檔案
self.addEventListener("install", function (event) {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
});

// 啟用新版 Service Worker 時，刪掉舊快取
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// 讀取檔案時：優先抓網路新版，失敗才用快取
self.addEventListener("fetch", function (event) {
  event.respondWith(
    fetch(event.request)
      .then(function (networkResponse) {
        const responseClone = networkResponse.clone();

        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, responseClone);
        });

        return networkResponse;
      })
      .catch(function () {
        return caches.match(event.request);
      })
  );
});