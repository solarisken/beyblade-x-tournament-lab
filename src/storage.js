const PREFIX="xdeck-v3:";
export function read(key,fallback){try{const v=localStorage.getItem(PREFIX+key);return v===null?fallback:JSON.parse(v)}catch{return fallback}}
export function write(key,value){localStorage.setItem(PREFIX+key,JSON.stringify(value))}
export function remove(key){localStorage.removeItem(PREFIX+key)}
export function exportState(keys){return Object.fromEntries(keys.map(k=>[k,read(k,null)]))}
