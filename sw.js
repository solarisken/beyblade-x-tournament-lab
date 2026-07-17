const C='beylab-rebuild-v1-4-1';
const A=['./','index.html','styles.css','manifest.webmanifest','data/products.json','js/app.js','js/db.js','js/analytics.js','icons/icon-192.png','icons/icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(A)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  const fresh=url.pathname.endsWith('/data/products.json')||
              url.pathname.endsWith('/js/app.js')||
              url.pathname.endsWith('/js/db.js')||
              url.pathname.endsWith('/js/analytics.js')||
              url.pathname.endsWith('/index.html');
  if(fresh){
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .then(r=>{
          const copy=r.clone();
          caches.open(C).then(c=>c.put(e.request,copy));
          return r;
        })
        .catch(()=>caches.match(e.request))
    );
  }else{
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
  }
});