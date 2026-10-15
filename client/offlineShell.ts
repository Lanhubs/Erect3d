import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'
export function offlineShell():Plugin {
  return {name:'erect-offline-shell',apply:'build',generateBundle(_options,bundle) {
    const files=['/','/favicon.svg',...Object.keys(bundle).map(file=>`/${file}`)]
    const version=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,16)
    this.emitFile({type:'asset',fileName:'offline-worker.js',source:`
const cacheName='erect-shell-${version}',files=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(files))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys()) if(key.startsWith('erect-shell-')&&key!==cacheName) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/private-assets/')||url.pathname==='/ready')return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(async response=>{
      if(response.ok&&response.headers.get('Content-Type')?.includes('text/html')&&/^\\/(projects|cloud)(\\/|$)/.test(url.pathname)){
        await (await caches.open(cacheName)).put('/',response.clone());
      }
      return response;
    }).catch(()=>caches.open(cacheName).then(cache=>cache.match('/',{ignoreVary:true}))));return;
  }
  if(!files.includes(url.pathname)&&!url.pathname.startsWith('/assets/'))return;
  event.respondWith((async()=>{
    const cache=await caches.open(cacheName),saved=await cache.match(request,{ignoreVary:true});
    if(saved)return saved;
    const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;
  })());
});`})
  }}
}
