/* RADIO WORLD 001: cache only first-party shell. Absolutely no radio/audio capture. */
const NAME='static-live-radio-world-001-shell-v1';
const PATHS=['/','/app.js','/styles.css','/icon.svg','/manifest.webmanifest','/api/worlds'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(NAME).then(cache=>cache.addAll(PATHS)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==NAME&&k.startsWith('static-live-radio-world-')).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  // No cross-origin requests, media, broadcast recording or speculative fetches.
  if(url.origin!==self.location.origin||!PATHS.includes(url.pathname)||url.search)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const clone=response.clone();caches.open(NAME).then(c=>c.put(event.request,clone));}
    return response;
  }).catch(()=>caches.match(event.request)));
});
