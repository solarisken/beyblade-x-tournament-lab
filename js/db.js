const DB='beylab-rebuild-v1',VER=2,STORES=['parts','productsOwned','builds','tests','matches','settings','projects','notebook'];
function open(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,VER);r.onupgradeneeded=()=>{for(const s of STORES)if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
export async function all(s){const d=await open();return new Promise((res,rej)=>{const r=d.transaction(s).objectStore(s).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
export async function put(s,v){const d=await open();return new Promise((res,rej)=>{const t=d.transaction(s,'readwrite');t.objectStore(s).put(v);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
export async function remove(s,id){const d=await open();return new Promise((res,rej)=>{const t=d.transaction(s,'readwrite');t.objectStore(s).delete(id);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
export async function clear(s){const d=await open();return new Promise((res,rej)=>{const t=d.transaction(s,'readwrite');t.objectStore(s).clear();t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
export async function dump(){const o={};for(const s of STORES)o[s]=await all(s);return o}
export async function restore(o){for(const s of STORES){await clear(s);for(const x of(o[s]||[]))await put(s,x)}}
export {STORES};