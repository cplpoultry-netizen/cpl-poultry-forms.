// CPL Poultry apps — lets the apps open with no internet after the first online visit.
const CACHE = "cpl-apps-v2";
const LOCAL = [
  "./", "index.html", "daily-checklist.html", "feed-stock-calculator.html", "monthly-records.html", "hatchery-report.html"
];
const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"
];
self.addEventListener("install", (e)=>{
  e.waitUntil((async()=>{
    const c = await caches.open(CACHE);
    for(const u of LOCAL){ try{ await c.add(u); }catch(err){} }
    for(const u of CDN){ try{ await c.add(new Request(u, {mode:"no-cors"})); }catch(err){} }
    self.skipWaiting();
  })());
});
self.addEventListener("activate", (e)=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (e)=>{
  if(e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isCdn = url.hostname === "cdnjs.cloudflare.com";
  // OCR engine files (scan paper): fetched with CORS, so cache them as they are
  const isCors = url.hostname === "cdn.jsdelivr.net" || url.hostname === "tessdata.projectnaptha.com";
  if(url.origin !== location.origin && !isCdn && !isCors) return;
  e.respondWith((async()=>{
    const c = await caches.open(CACHE);
    try{
      const req = isCdn ? new Request(e.request.url, {mode:"no-cors"}) : e.request;
      const res = await fetch(req);
      if(res && (res.ok || res.type === "opaque")) c.put(isCdn ? e.request.url : e.request, res.clone());
      return res;
    }catch(err){
      const hit = await c.match(isCdn ? e.request.url : e.request, {ignoreSearch:true});
      if(hit) return hit;
      throw err;
    }
  })());
});
