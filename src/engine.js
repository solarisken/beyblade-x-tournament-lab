import { fixedBlades,cxParts,ratchets,bits,archetypes,defaultSettings } from "./data.js";
import { clamp,avg,normalize,betaSummary,round,permutations,popcount } from "./math.js";

const TRAITS=["pressure","endurance","defense","control","burstResistance","recoil","criticalAccess","mass","destabilize"];
const addTraits=(...xs)=>Object.fromEntries(TRAITS.map(k=>[k,xs.reduce((s,x)=>s+(x?.[k]||0),0)]));
const ARCH_INDEX=Object.fromEntries(archetypes.map((a,i)=>[a.id,i]));

export function allBladeAssemblies(){
  const out=fixedBlades.map(b=>({
    ...b, family:"fixed", resources:[`blade:${b.id}`], components:[b.name], canonicalParts:[`blade:${b.id}`]
  }));
  for(const lock of cxParts.locks) for(const main of cxParts.standardMains) for(const assist of cxParts.assists){
    out.push({
      id:`cx-standard-${lock.id}-${main.id}-${assist.id}`,
      name:`${lock.name}${main.name} ${assist.name}`,
      source:`${lock.source}+${main.source}+${assist.source}`,
      system:"CX",family:"cx-standard",type:main.type,
      traits:addTraits(lock.traits,main.traits,assist.traits),
      tags:[...(main.tags||[]),"custom-line"],
      resources:[lock.resource,main.resource,assist.resource],
      components:[`${lock.name} Lock`,`${main.name} Main`,`${assist.name} Assist`],
      canonicalParts:[lock.resource,main.resource,assist.resource]
    });
  }
  for(const lock of cxParts.locks) for(const over of cxParts.overBlades) for(const metal of cxParts.metalBlades) for(const assist of cxParts.assists){
    out.push({
      id:`cx-expand-${lock.id}-${over.id}-${metal.id}-${assist.id}`,
      name:`${lock.name}${metal.name} ${over.name} ${assist.name}`,
      source:`${lock.source}+${over.source}+${metal.source}+${assist.source}`,
      system:"CX-expand",family:"cx-expand",type:metal.type,
      traits:addTraits(lock.traits,over.traits,metal.traits,assist.traits),
      tags:[...(metal.tags||[]),"expand-blade"],
      resources:[lock.resource,over.resource,metal.resource,assist.resource],
      components:[`${lock.name} Lock`,`${over.name} Over`,`${metal.name} Metal`,`${assist.name} Assist`],
      canonicalParts:[lock.resource,over.resource,metal.resource,assist.resource]
    });
  }
  return out;
}

function mechanicSuitability(combo,archId){
  const t=combo.traits;
  const low=clamp((70-(combo.ratchet?.height ?? 58))/24,-.45,.85)+(combo.bit.lowHeight?.18:0);
  let s=0;
  if(archId==="heavy-attack") s=.31*t.defense+.22*t.burstResistance+.22*t.control+.13*t.endurance+.08*t.mass-.22*t.recoil;
  if(archId==="low-attack") s=.27*t.burstResistance+.22*t.defense+.18*t.control+.15*low+.10*t.mass-.12*t.recoil+.08*t.destabilize;
  if(archId==="stamina") s=.30*t.criticalAccess+.22*t.pressure+.17*t.control+.12*t.endurance+.10*low+.09*t.destabilize-.12*t.recoil;
  if(archId==="defense") s=.23*t.endurance+.21*t.control+.17*t.pressure+.14*t.criticalAccess+.10*t.destabilize+.08*t.mass-.14*t.recoil;
  if(archId==="balance") s=.22*t.control+.17*t.pressure+.16*t.defense+.14*t.endurance+.11*t.burstResistance+.10*t.criticalAccess+.10*t.destabilize-.12*t.recoil;
  // The physical description signal is deliberately compressed. It is not a measured probability.
  return clamp(.5+.105*Math.tanh(s*1.05),.36,.64);
}

function evidencePosterior(comboId,archId,batches=[],launchId=null,position=null){
  let wins=0,losses=0,effectiveGames=0,rawGames=0;
  for(const row of batches){
    if(row.comboId!==comboId)continue;
    const games=Number(row.games||0),rowWins=Number(row.wins||0),rowLosses=Number(row.losses??Math.max(0,games-rowWins));
    rawGames+=games;
    let w=row.opponentArchetype===archId?1:.06;
    if(launchId)w*=row.launchProfile===launchId?1:.55;
    if(position&&row.position&&row.position!=="alternating")w*=row.position===position?1:.72;
    wins+=rowWins*w;losses+=rowLosses*w;effectiveGames+=(rowWins+rowLosses)*w;
  }
  const p=betaSummary(1+wins,1+losses);
  return {...p,effectiveGames,rawGames,wins,losses};
}

function finishModel(combo,batches=[]){
  const t=combo.traits;
  const prior=[
    1.3+Math.max(0,t.endurance+t.control)*1.25,
    1.1+Math.max(0,t.criticalAccess+t.pressure-t.recoil*.2)*1.05,
    .9+Math.max(0,t.destabilize+t.pressure*.35)*.8,
    1.0+Math.max(0,t.criticalAccess+t.pressure+t.control*.15)*1.0
  ];
  const counts={spin:0,over:0,burst:0,xtreme:0};
  for(const row of batches)if(row.comboId===combo.id){const f=row.winFinishes||{};for(const k of Object.keys(counts))counts[k]+=Number(f[k]||0)}
  const keys=["spin","over","burst","xtreme"],post=keys.map((k,i)=>prior[i]+counts[k]),probs=normalize(post);
  return {probs:Object.fromEntries(keys.map((k,i)=>[k,probs[i]])),counts,total:Object.values(counts).reduce((s,x)=>s+x,0)};
}

function selfKoModel(combo,batches=[]){
  const t=combo.traits,prior=clamp(.07+.07*Math.max(0,t.recoil)+.045*Math.max(0,t.pressure-t.control),.025,.22);
  let self=0,games=0;for(const row of batches)if(row.comboId===combo.id){self+=Number(row.selfKOs||0);games+=Number(row.games||0)}
  return {...betaSummary(prior*4+self,(1-prior)*4+Math.max(0,games-self)),games,self,prior};
}

function roleVector(t){
  const raw=[Math.max(.05,.55+t.pressure+t.criticalAccess*.7-t.endurance*.15),Math.max(.05,.55+t.endurance+t.control*.35-t.pressure*.1),Math.max(.05,.55+t.defense+t.burstResistance*.55-t.recoil*.25)];
  return normalize(raw);
}
function roleName(v){const i=v.indexOf(Math.max(...v));return ["Attack pressure","Stamina anchor","Defense counter"][i]}
function launchPlan(combo){
  const t=combo.traits;
  if(combo.blade.integratedRatchet)return{primary:"level-controlled",alternate:"counter-tilt",reason:"Protect main-body stability and compare separation behavior."};
  if(t.pressure>.95&&t.control<.05)return{primary:"light-bank",alternate:"level-controlled",reason:"Preserve contact access while measuring self-KO exposure."};
  if(t.pressure>.72)return{primary:"level-hard",alternate:"light-bank",reason:"Compare direct contact with controlled rail entry."};
  if(t.endurance>.75)return{primary:"level-controlled",alternate:"weak-launch",reason:"Establish endurance floor before adding launch variance."};
  if(t.defense>.62)return{primary:"counter-tilt",alternate:"level-controlled",reason:"Test containment without excessive tilt."};
  return{primary:"level-controlled",alternate:"light-bank",reason:"Use a repeatable baseline first."};
}
function dominantFinish(f){return Object.entries(f.probs).sort((a,b)=>b[1]-a[1])[0][0]}

export function generateCombos(batches=[]){
  const combos=[];
  for(const blade of allBladeAssemblies()){
    const allowedRatchets=blade.integratedRatchet?[null]:ratchets;
    for(const ratchet of allowedRatchets)for(const bit of bits){
      const traits=addTraits(blade.traits,ratchet?.traits,bit.traits);
      const id=`${blade.id}|${ratchet?.id||"integrated"}|${bit.id}`;
      const launch=launchPlan({blade,ratchet,bit,traits});
      const mech=archetypes.map(a=>mechanicSuitability({blade,ratchet,bit,traits},a.id));
      const evidence=archetypes.map((a,i)=>evidencePosterior(id,a.id,batches,launch.primary));
      const signal=mech.map((m,i)=>{const w=Math.min(.86,evidence[i].effectiveGames/(evidence[i].effectiveGames+10));return m*(1-w)+evidence[i].mean*w});
      const lower=mech.map((m,i)=>{const w=Math.min(.90,evidence[i].effectiveGames/(evidence[i].effectiveGames+8));return clamp((m-.13)*(1-w)+evidence[i].low*w)});
      const finish=finishModel({id,traits},batches),selfKO=selfKoModel({id,traits},batches),rv=roleVector(traits);
      const resources=[...blade.resources,...(ratchet?[ratchet.resource]:[]),bit.resource];
      const canonicalParts=[...blade.canonicalParts,...(ratchet?[`ratchet:${ratchet.canonical}`]:[`integrated:${blade.id}`]),`bit:${bit.canonical}`];
      const typeMatch=blade.type===bit.type?1:(blade.type==="balance"||bit.type==="balance"?.6:.25);
      const critical=clamp(finish.probs.over+finish.probs.burst+finish.probs.xtreme);
      const evidenceSupport=avg(evidence.map(x=>Math.min(1,x.effectiveGames/24)));
      const base=avg(lower)*.45+avg(signal)*.28+critical*.12+(1-selfKO.mean)*.08+typeMatch*.035+evidenceSupport*.035;
      combos.push({
        id,name:`${blade.name} ${ratchet?ratchet.name:"[Integrated]"}${bit.code}`,
        blade,ratchet,bit,traits,resources,canonicalParts,launch,mechanic:mech,evidence,signal,lower,finish,selfKO,
        roleVector:rv,role:roleName(rv),dominantFinish:dominantFinish(finish),critical,evidenceSupport,base,
        evidenceGames:batches.filter(x=>x.comboId===id).reduce((s,x)=>s+Number(x.games||0),0)
      });
    }
  }
  return combos;
}

export function legalDeck(deck){
  if(deck.length!==3)return false;
  const physical=deck.flatMap(c=>c.resources);if(new Set(physical).size!==physical.length)return false;
  const canonical=deck.flatMap(c=>c.canonicalParts);if(new Set(canonical).size!==canonical.length)return false;
  return true;
}
export function deckSignature(deck){return deck.map(c=>`${c.blade.id}|${c.ratchet?.canonical||"integrated"}|${c.bit.canonical}`).sort().join("::")}

function topMidBottom(a,b,c){const hi=Math.max(a,b,c),lo=Math.min(a,b,c);return[hi,a+b+c-hi-lo,lo]}
export function scoreDeck(deck,settings=defaultSettings){
  const backupW=(settings.backupCoverageWeight??92)/100,criticalW=(settings.criticalFloorWeight??88)/100,conservativeW=(settings.conservativeWeight??82)/100;
  let primary=0,backup=0,floor=0,lowPrimary=0,lowBackup=0,worstBackup=1,worstFloor=1;
  const matchup=[];
  for(let i=0;i<archetypes.length;i++){
    const a=archetypes[i],s=topMidBottom(deck[0].signal[i],deck[1].signal[i],deck[2].signal[i]),l=topMidBottom(deck[0].lower[i],deck[1].lower[i],deck[2].lower[i]);
    primary+=s[0]*a.weight;backup+=s[1]*a.weight;floor+=s[2]*a.weight;lowPrimary+=l[0]*a.weight;lowBackup+=l[1]*a.weight;
    worstBackup=Math.min(worstBackup,l[1]);worstFloor=Math.min(worstFloor,l[2]);
    matchup.push({id:a.id,name:a.name,weight:a.weight,primary:s[0],backup:s[1],floor:s[2],lowPrimary:l[0],lowBackup:l[1],lowFloor:l[2]});
  }
  const criticalFloor=Math.min(...deck.map(c=>c.critical)),criticalAvg=avg(deck.map(c=>c.critical));
  const control=1-avg(deck.map(c=>c.selfKO.mean));
  const finishDiversity=popcount(deck.reduce((m,c)=>m|(1<<["spin","over","burst","xtreme"].indexOf(c.dominantFinish)),0))/3;
  const evidenceSupport=avg(deck.map(c=>c.evidenceSupport));
  const evidenceGames=deck.reduce((s,c)=>s+c.evidenceGames,0);
  const roleCentroid=[0,1,2].map(i=>avg(deck.map(c=>c.roleVector[i])));
  const roleSpread=avg(deck.map(c=>Math.sqrt(c.roleVector.reduce((s,x,i)=>s+(x-roleCentroid[i])**2,0))));
  const gapControl=clamp(1-roleSpread*.85);
  const score=100*(
    primary*.14 + backup*.18*backupW + floor*.07 +
    lowPrimary*.15*conservativeW + lowBackup*.15*backupW*conservativeW +
    worstBackup*.10*backupW + worstFloor*.04 +
    criticalFloor*.08*criticalW + criticalAvg*.03 + finishDiversity*.02 +
    control*.02 + gapControl*.01 + evidenceSupport*.01
  );
  return{score:round(score,4),primary,backup,floor,lowPrimary,lowBackup,worstBackup,worstFloor,criticalFloor,criticalAvg,control,finishDiversity,evidenceSupport,evidenceGames,gapControl,matchup};
}

function candidateSelection(combos,breadth){
  const selected=new Map(),groups=new Map();
  for(const c of combos){if(!groups.has(c.blade.id))groups.set(c.blade.id,[]);groups.get(c.blade.id).push(c)}
  for(const group of groups.values()){
    group.sort((a,b)=>b.base-a.base);
    group.slice(0,4).forEach(c=>selected.set(c.id,c));
    for(let i=0;i<archetypes.length;i++){
      group.slice().sort((a,b)=>b.lower[i]-a.lower[i]).slice(0,2).forEach(c=>selected.set(c.id,c));
      group.slice().sort((a,b)=>b.signal[i]-a.signal[i]).slice(0,2).forEach(c=>selected.set(c.id,c));
    }
    group.slice().sort((a,b)=>b.critical-a.critical).slice(0,2).forEach(c=>selected.set(c.id,c));
  }
  for(const c of combos.slice().sort((a,b)=>b.base-a.base)){if(selected.size>=breadth)break;selected.set(c.id,c)}
  return[...selected.values()].sort((a,b)=>b.base-a.base).slice(0,breadth);
}

class MinHeap{
  constructor(limit){this.limit=limit;this.a=[]}
  push(x){if(this.a.length<this.limit){this.a.push(x);this.up(this.a.length-1);return}if(x.metrics.score<=this.a[0].metrics.score)return;this.a[0]=x;this.down(0)}
  up(i){while(i){const p=(i-1)>>1;if(this.a[p].metrics.score<=this.a[i].metrics.score)break;[this.a[p],this.a[i]]=[this.a[i],this.a[p]];i=p}}
  down(i){for(;;){let l=i*2+1,r=l+1,m=i;if(l<this.a.length&&this.a[l].metrics.score<this.a[m].metrics.score)m=l;if(r<this.a.length&&this.a[r].metrics.score<this.a[m].metrics.score)m=r;if(m===i)break;[this.a[m],this.a[i]]=[this.a[i],this.a[m]];i=m}}
  sorted(){return this.a.sort((a,b)=>b.metrics.score-a.metrics.score)}
}

export function fastOptimize(settings=defaultSettings,batches=[],progress){
  const combos=generateCombos(batches),candidates=candidateSelection(combos,settings.fastBreadth||210),heap=new MinHeap(settings.shortlistSize||24);
  let screened=0,legal=0;
  for(let i=0;i<candidates.length-2;i++){
    for(let j=i+1;j<candidates.length-1;j++){
      const pair=[candidates[i],candidates[j]];
      const r=pair.flatMap(c=>c.resources),p=pair.flatMap(c=>c.canonicalParts);if(new Set(r).size!==r.length||new Set(p).size!==p.length)continue;
      for(let k=j+1;k<candidates.length;k++){
        screened++;const deck=[candidates[i],candidates[j],candidates[k]];if(!legalDeck(deck))continue;legal++;
        heap.push({id:deckSignature(deck),combos:deck,metrics:scoreDeck(deck,settings)});
      }
    }
    if(progress&&i%4===0)progress({progress:i/candidates.length,screened,legal});
  }
  return{combos,candidates,decks:heap.sorted(),screened,legal,search:{mode:"fast dominance-screened",complete:false,comboSpace:combos.length,candidateBreadth:candidates.length}};
}

export function legalBladeTriples(blades=allBladeAssemblies()){
  const out=[];for(let i=0;i<blades.length-2;i++)for(let j=i+1;j<blades.length-1;j++){
    const pair=[...blades[i].resources,...blades[j].resources];if(new Set(pair).size!==pair.length)continue;
    for(let k=j+1;k<blades.length;k++){const resources=[...pair,...blades[k].resources];if(new Set(resources).size===resources.length)out.push([blades[i],blades[j],blades[k]])}
  }return out;
}
export function exactDeckCount(){
  const triples=legalBladeTriples();let withIntegrated=0;for(const t of triples)if(t.some(b=>b.integratedRatchet))withIntegrated++;
  const without=triples.length-withIntegrated;
  return{bladeTriples:triples.length,withIntegrated,withoutIntegrated:without,total:without*permutations(ratchets,3).length*permutations(bits,3).length+withIntegrated*permutations(ratchets,2).length*permutations(bits,3).length};
}

export async function deepOptimize(settings=defaultSettings,batches=[],hooks={}){
  const combos=generateCombos(batches),lookup=new Map(combos.map(c=>[c.id,c])),blades=allBladeAssemblies(),triples=legalBladeTriples(blades);
  const r3=permutations(ratchets,3),r2=permutations(ratchets,2),b3=permutations(bits,3),heap=new MinHeap(settings.shortlistSize||24);
  const maxTriples=Math.min(triples.length,hooks.maxBladeTriples??triples.length);let screened=0,legal=0;
  for(let ti=0;ti<maxTriples;ti++){
    if(hooks.shouldStop?.())break;
    const tri=triples[ti],integratedIndex=tri.findIndex(x=>x.integratedRatchet),ratchetPerms=integratedIndex>=0?r2:r3;
    for(const rp of ratchetPerms){
      const assignedR=[];let ri=0;for(let pos=0;pos<3;pos++)assignedR[pos]=pos===integratedIndex?null:rp[ri++];
      for(const bp of b3){
        screened++;
        const deck=tri.map((blade,pos)=>lookup.get(`${blade.id}|${assignedR[pos]?.id||"integrated"}|${bp[pos].id}`));
        // Blade triples and canonical ratchet/bit permutations are already legal by construction.
        legal++;heap.push({id:deckSignature(deck),combos:deck,metrics:scoreDeck(deck,settings)});
      }
    }
    if(hooks.onProgress&&(ti%2===0||ti===maxTriples-1))hooks.onProgress({progress:(ti+1)/maxTriples,bladeTriplesDone:ti+1,bladeTriplesTotal:maxTriples,screened,legal});
    if(ti%3===0)await new Promise(r=>setTimeout(r,0));
  }
  const complete=maxTriples===triples.length&&!hooks.shouldStop?.();
  return{combos,decks:heap.sorted(),screened,legal,search:{mode:"deep exhaustive allocation audit",complete,comboSpace:combos.length,bladeTriples:triples.length,bladeTriplesProcessed:maxTriples,exactCount:exactDeckCount().total}};
}

export function confidence(deck,batches=[]){
  if(!deck)return{label:"No deck",score:0,games:0,minimumCell:0};
  const cells=[];for(const c of deck.combos)for(const a of archetypes){const e=c.evidence[ARCH_INDEX[a.id]];cells.push(e.effectiveGames)}
  const games=deck.metrics.evidenceGames,minimumCell=Math.min(...cells),covered=cells.filter(n=>n>=8).length/cells.length;
  let label="Hypothesis";if(games>=36&&covered>=.35)label="Developing";if(games>=120&&covered>=.7&&minimumCell>=4)label="Supported";if(games>=240&&covered>=.9&&minimumCell>=10)label="Validated locally";
  return{label,games,minimumCell,covered,score:round(clamp(games/240*.45+covered*.55)*100)};
}

export function planTests(deck,alternatives=[],batches=[],batchSize=4){
  if(!deck)return[];const items=[];
  const bestMatch=Math.max(...deck.metrics.matchup.map(x=>x.lowBackup));
  for(const combo of deck.combos)for(let i=0;i<archetypes.length;i++){
    const e=combo.evidence[i],match=deck.metrics.matchup[i],decisionReady=e.effectiveGames>=12&&(e.low>.5||e.high<.5);
    const consequence=1+(bestMatch-match.lowBackup)*3+(combo===deck.combos.find(c=>c.lower[i]===Math.min(...deck.combos.map(x=>x.lower[i])))?.65:0);
    const priority=e.width*consequence*(1+1/Math.sqrt(e.effectiveGames+1))*(decisionReady?.24:1);
    items.push({kind:"coverage",combo,arch:archetypes[i],priority,purpose:`Resolve ${archetypes[i].name} backup coverage; current evidence interval ${Math.round(e.low*100)}–${Math.round(e.high*100)} with effective n=${round(e.effectiveGames,1)}.`});
  }
  for(const alt of alternatives.slice(0,4)){
    const newCombos=alt.combos.filter(c=>!deck.combos.some(x=>x.id===c.id));
    for(const combo of newCombos){const margin=Math.abs(deck.metrics.score-alt.metrics.score),priority=(1/(1+margin))*1.4*(1-combo.evidenceSupport);items.push({kind:"challenger",combo,arch:archetypes[combo.lower.indexOf(Math.min(...combo.lower))],priority,purpose:`Challenge the incumbent with a near-score alternative. Deck score gap: ${round(margin,2)} points.`})}
  }
  items.sort((a,b)=>b.priority-a.priority);const seen=new Set(),out=[];
  for(const x of items){const key=`${x.combo.id}|${x.arch.id}|${x.kind}`;if(seen.has(key))continue;seen.add(key);out.push({
    id:`${key}|${Date.now()}|${out.length}`,kind:x.kind,comboId:x.combo.id,comboName:x.combo.name,opponentArchetype:x.arch.id,opponentName:x.arch.name,
    games:batchSize,launch:x.combo.launch.primary,alternateLaunch:x.combo.launch.alternate,position:out.length%2?"right":"left",priority:round(x.priority,4),purpose:x.purpose,status:"queued"
  });if(out.length===6)break}
  return out;
}

export function directives(deck,alternatives=[],batches=[]){
  if(!deck)return[];const weak=deck.metrics.matchup.slice().sort((a,b)=>a.lowBackup-b.lowBackup)[0],risky=deck.combos.slice().sort((a,b)=>b.selfKO.mean-a.selfKO.mean)[0],conf=confidence(deck,batches),plan=planTests(deck,alternatives,batches,4);
  return[
    `Current evidence status: ${conf.label}. Treat the recommendation as a decision hypothesis, not a tournament-proven fact.`,
    `The deck's largest redundancy gap is ${weak.name}; the conservative second-option signal is ${Math.round(weak.lowBackup*100)}/100.`,
    `Every selected Bey must retain critical-finish access. Current critical floor: ${Math.round(deck.metrics.criticalFloor*100)}/100.`,
    `${risky.name} has the highest self-KO exposure. Test ${risky.launch.primary} against ${risky.launch.alternate} before increasing launch power.`,
    `Run the first ${Math.min(3,plan.length)} adaptive batches, then let Auto-Pilot rescore the deck. Do not complete the entire queue after the decision has already separated.`
  ];
}

export function evidenceMatrix(deck){return deck?.combos.map(c=>({combo:c,rows:archetypes.map((a,i)=>({archetype:a,mechanic:c.mechanic[i],signal:c.signal[i],lower:c.lower[i],...c.evidence[i]}))}))||[]}
export function serializeDeck(deck){return deck?deck.combos.map((c,i)=>`${i+1}. ${c.name} — ${c.role}; ${c.launch.primary}`).join("\n"):"No deck generated."}
export {archetypes,ratchets,bits};
