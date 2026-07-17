import {archetypes,officialRules} from "./data.js";
import {clamp,seeded,permutations,wilson} from "./math.js";

const ORDERS=permutations([0,1,2]);
const opponentFinish={
  "heavy-attack":{spin:.10,over:.29,burst:.15,xtreme:.46},
  "low-attack":{spin:.16,over:.31,burst:.29,xtreme:.24},
  stamina:{spin:.73,over:.11,burst:.08,xtreme:.08},
  defense:{spin:.62,over:.18,burst:.10,xtreme:.10},
  balance:{spin:.38,over:.24,burst:.14,xtreme:.24}
};

function normal(rng){let u=0,v=0;while(!u)u=rng();while(!v)v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function gammaSample(shape,rng){if(shape<1){const u=rng();return gammaSample(shape+1,rng)*Math.pow(u,1/shape)}const d=shape-1/3,c=1/Math.sqrt(9*d);for(;;){let x,v;do{x=normal(rng);v=1+c*x}while(v<=0);v=v*v*v;const u=rng();if(u<1-.0331*x*x*x*x||Math.log(u)<.5*x*x+d*(1-v+Math.log(v)))return d*v}}
function betaSample(a,b,rng){const x=gammaSample(a,rng),y=gammaSample(b,rng);return x/(x+y)}
function pick(probs,rng){let x=rng(),acc=0;for(const [k,p] of Object.entries(probs)){acc+=p;if(x<=acc)return k}return Object.keys(probs).at(-1)}
function expectedPoints(probs,rules=officialRules){return Object.entries(probs).reduce((s,[k,p])=>s+p*rules.finishPoints[k],0)}
function archIndex(id){return archetypes.findIndex(a=>a.id===id)}

function battleProbability(combo,archId,rng){
  const i=archIndex(archId),e=combo.evidence[i],mechanic=clamp(.5+(combo.signal[i]-.5)*1.18,.31,.69);
  if(e.effectiveGames<.5)return clamp(mechanic+normal(rng)*.025,.24,.76);
  const sampled=betaSample(e.alpha,e.beta,rng),w=Math.min(.86,e.effectiveGames/(e.effectiveGames+8));
  return clamp(mechanic*(1-w)+sampled*w,.18,.82);
}
function expectedBattleDiff(combo,archId,rules=officialRules){
  const i=archIndex(archId),p=clamp(.5+(combo.signal[i]-.5)*1.18,.31,.69),ours=expectedPoints(combo.finish.probs,rules),theirs=expectedPoints(opponentFinish[archId],rules),self=combo.selfKO.mean;
  return (1-self)*(p*ours-(1-p)*theirs)-self;
}
function orderValue(deck,ourOrder,oppLineup,oppOrder){let s=0;for(let i=0;i<3;i++)s+=expectedBattleDiff(deck.combos[ourOrder[i]],oppLineup[oppOrder[i]]);return s}
function adaptiveOrders(deck,oppLineup,initialOppOrder){
  let opp=initialOppOrder,ours=ORDERS[0];
  for(let step=0;step<3;step++){
    ours=ORDERS.slice().sort((a,b)=>orderValue(deck,b,oppLineup,opp)-orderValue(deck,a,oppLineup,opp))[0];
    opp=ORDERS.slice().sort((a,b)=>orderValue(deck,ours,oppLineup,a)-orderValue(deck,ours,oppLineup,b))[0];
  }
  return{ours,opp};
}
function shuffledOrder(rng){const a=[0,1,2];for(let i=2;i;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

export function simulateMatch(deck,firstOrder,profile,rng,rules=officialRules){
  const oppLineup=profile.opponentLineup,firstOpp=shuffledOrder(rng);let ourOrder=firstOrder,oppOrder=firstOpp,ours=0,theirs=0,battles=0,cycles=0;
  while(ours<rules.targetPoints&&theirs<rules.targetPoints&&cycles<6){
    for(let slot=0;slot<3&&ours<rules.targetPoints&&theirs<rules.targetPoints;slot++){
      const combo=deck.combos[ourOrder[slot]],archId=oppLineup[oppOrder[slot]],selfP=betaSample(combo.selfKO.alpha,combo.selfKO.beta,rng);
      if(rng()<selfP){theirs+=1;battles++;continue}
      const won=rng()<battleProbability(combo,archId,rng),finish=won?pick(combo.finish.probs,rng):pick(opponentFinish[archId],rng),points=rules.finishPoints[finish];
      if(won)ours+=points;else theirs+=points;battles++;
    }
    cycles++;
    if(ours<rules.targetPoints&&theirs<rules.targetPoints){const next=adaptiveOrders(deck,oppLineup,oppOrder);ourOrder=next.ours;oppOrder=next.opp}
  }
  return{won:ours>=rules.targetPoints,ours,theirs,diff:ours-theirs,battles,cycles,firstOppOrder:firstOpp};
}

export function runLab(decks,{matches=12000,seed=20260717,rules=officialRules,onProgress,shouldStop}={}){
  const rng=seeded(seed),results=[];let work=0,totalWork=decks.length*ORDERS.length*matches;
  for(let di=0;di<decks.length;di++){
    const deck=decks[di],orderResults=[];
    for(const order of ORDERS){
      let wins=0,diff=0,battles=0;const profiles=Object.fromEntries(archetypes.map(a=>[a.id,{wins:0,total:0,diff:0}]));
      for(let m=0;m<matches;m++){
        if(shouldStop?.())return{stopped:true,results};
        let x=rng(),profile=archetypes.at(-1),acc=0;for(const a of archetypes){acc+=a.weight;if(x<=acc){profile=a;break}}
        const r=simulateMatch(deck,order,profile,rng,rules);wins+=r.won?1:0;diff+=r.diff;battles+=r.battles;const p=profiles[profile.id];p.wins+=r.won?1:0;p.total++;p.diff+=r.diff;work++;
        if(onProgress&&work%3000===0)onProgress({progress:work/totalWork,work,totalWork});
      }
      const ci=wilson(wins,matches),profileRates=Object.fromEntries(Object.entries(profiles).map(([id,v])=>[id,{rate:v.total?v.wins/v.total:0,n:v.total,diff:v.total?v.diff/v.total:0}]));
      orderResults.push({order,wins,total:matches,rate:wins/matches,low:ci.low,high:ci.high,diff:diff/matches,avgBattles:battles/matches,profileRates});
    }
    orderResults.sort((a,b)=>b.low-a.low||b.rate-a.rate);const best=orderResults[0],rates=Object.values(best.profileRates).map(x=>x.rate);
    results.push({deckId:deck.id,bestOrder:best.order,rate:best.rate,low:best.low,high:best.high,diff:best.diff,avgBattles:best.avgBattles,profileRates:best.profileRates,robustness:1-(Math.max(...rates)-Math.min(...rates)),orders:orderResults});
  }
  results.sort((a,b)=>b.low-a.low||b.rate-a.rate);return{stopped:false,results,matches,rules:rules.id};
}
export {ORDERS};
