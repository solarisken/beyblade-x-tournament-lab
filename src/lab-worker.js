import {runLab} from "./simulation.js";
let stopped=false;
self.onmessage=e=>{
  if(e.data.type==="stop"){stopped=true;return}
  if(e.data.type!=="run")return;stopped=false;
  try{
    const result=runLab(e.data.decks,{matches:e.data.matches,seed:e.data.seed,onProgress:x=>self.postMessage({type:"progress",stage:"lab",...x}),shouldStop:()=>stopped});
    self.postMessage(result.stopped?{type:"stopped",stage:"lab"}:{type:"done",stage:"lab",result});
  }catch(error){self.postMessage({type:"error",stage:"lab",message:error?.stack||String(error)})}
};
