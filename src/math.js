export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
export const sum=a=>a.reduce((s,x)=>s+x,0);
export const round=(x,n=3)=>Number(Number(x).toFixed(n));
export const normalize=a=>{const s=sum(a);return s?a.map(x=>x/s):a.map(()=>1/a.length)};
export function seeded(seed=1){let x=seed>>>0;return()=>{x|=0;x=x+0x6D2B79F5|0;let t=Math.imul(x^x>>>15,1|x);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

// Normal approximation is sufficient for a transparent decision interval in this local tool.
export function betaSummary(alpha,beta,z=1.645){
  const mean=alpha/(alpha+beta),variance=alpha*beta/((alpha+beta)**2*(alpha+beta+1));
  const sd=Math.sqrt(variance);return {alpha,beta,mean,low:clamp(mean-z*sd),high:clamp(mean+z*sd),width:clamp(2*z*sd)};
}
export function wilson(wins,n,z=1.645){
  if(!n)return{low:0,high:1};const p=wins/n,z2=z*z,den=1+z2/n;
  const center=(p+z2/(2*n))/den,half=z*Math.sqrt((p*(1-p)+z2/(4*n))/n)/den;
  return{low:clamp(center-half),high:clamp(center+half)};
}
export function hashString(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
export function permutations(items,k=items.length){const out=[];const used=Array(items.length).fill(false),cur=[];function rec(){if(cur.length===k){out.push(cur.slice());return}for(let i=0;i<items.length;i++)if(!used[i]){used[i]=true;cur.push(items[i]);rec();cur.pop();used[i]=false}}rec();return out}
export function popcount(x){let n=0;while(x){x&=x-1;n++}return n}
