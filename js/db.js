const DB='beylab-rebuild-v1';
const VER=4;
const STORES=['parts','productsOwned','builds','tests','matches','settings','projects','notebook','coachLog','optimizationRuns'];

function open(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,VER);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const store of STORES){
        if(!db.objectStoreNames.contains(store)){
          db.createObjectStore(store,{keyPath:'id'});
        }
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

export async function all(store){
  const db=await open();
  return new Promise((resolve,reject)=>{
    const request=db.transaction(store).objectStore(store).getAll();
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

export async function put(store,value){
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}

export async function remove(store,id){
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}

export async function clear(store){
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}

export async function dump(){
  const result={};
  for(const store of STORES)result[store]=await all(store);
  return result;
}

export async function restore(payload){
  for(const store of STORES){
    await clear(store);
    for(const row of payload[store]||[])await put(store,row);
  }
}

export {STORES};
