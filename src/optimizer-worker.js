import {fastOptimize,deepOptimize} from "./engine.js";
let stopped=false;
self.onmessage=async e=>{
  if(e.data.type==="stop"){stopped=true;return}
  if(e.data.type!=="search")return;stopped=false;
  const{mode,settings,batches}=e.data;
  try{
    const progress=x=>self.postMessage({type:"progress",stage:"search",...x});
    const result=mode==="deep"?await deepOptimize(settings,batches,{onProgress:progress,shouldStop:()=>stopped}):fastOptimize(settings,batches,progress);
    if(stopped)self.postMessage({type:"stopped",stage:"search"});else self.postMessage({type:"done",stage:"search",result});
  }catch(error){self.postMessage({type:"error",stage:"search",message:error?.stack||String(error)})}
};
