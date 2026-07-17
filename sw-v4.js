const CACHE='beylab-v4-0-0';
const FILES=[
  './','./index.html','./styles.css?v=4.0.0','./manifest.webmanifest?v=4.0.0',
  './js/app.js?v=4.0.0','./js/db.js','./js/analytics.js','./js/optimizer.js',
  './data/products.json?v=4.0.0','./data/version.json?v=4.0.0',
  './data/rules.json','./data/optimizer-model.json','./data/validation.json',
  './icons/icon-192.png','./icons/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  const networkFirst=
    event.request.mode==='navigate' ||
    /\/(index\.html|js\/app\.js|js\/analytics\.js|js\/optimizer\.js|js\/db\.js|data\/products\.json)$/.test(url.pathname);

  if(networkFirst){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          return response;
        })
        .catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
