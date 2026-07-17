import {aggregate,buildEvidence,roleOfBit} from './analytics.js';

const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,value));
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
const range=values=>values.length?Math.max(...values)-Math.min(...values):0;

export function buildPartEntries(build){
  return [
    ['Blade',build.blade],
    ['Lock Chip',build.lockChip],
    ['Main Blade',build.mainBlade],
    ['Assist Blade',build.assistBlade],
    ['Over Blade',build.overBlade],
    ['Metal Blade',build.metalBlade],
    ['Ratchet',build.ratchet],
    ['Bit',build.bit],
    ['Ratchet Integrated Bit',build.integratedBit]
  ].filter(([,name])=>Boolean(name)).map(([category,name])=>({category,name}));
}

export function buildName(build){
  if(build.system==='CX Expand'){
    return [build.lockChip,build.overBlade,build.metalBlade,build.assistBlade,build.ratchet,build.bit].filter(Boolean).join(' ');
  }
  if(build.system==='CX Integrated'){
    return [build.lockChip,build.mainBlade,build.assistBlade,build.integratedBit].filter(Boolean).join(' ');
  }
  if(build.system==='CX'){
    return [build.lockChip,build.mainBlade,build.assistBlade,build.ratchet,build.bit].filter(Boolean).join(' ');
  }
  return [build.blade,build.ratchet,build.bit].filter(Boolean).join(' ');
}

function ratchetHeight(name=''){
  return +(name.match(/-(\d+)/)?.[1]||60);
}

function bitVector(name=''){
  const role=roleOfBit(name);
  if(role==='Attack')return {attack:86,stamina:34,defense:40};
  if(role==='Stamina')return {attack:34,stamina:86,defense:58};
  if(role==='Defense')return {attack:36,stamina:62,defense:86};
  return {attack:62,stamina:62,defense:62};
}

function sourceTokens(part){
  return (part?.source||'').split(';').map(value=>value.trim()).filter(Boolean);
}

function productForSource(source,catalog){
  return catalog.find(product=>source===product.code||source.startsWith(`${product.code}-`));
}

function stockRoleVector(build,parts,catalog){
  const coreCategories=new Set(['Blade','Lock Chip','Main Blade','Assist Blade','Over Blade','Metal Blade']);
  const vectors=[];
  const sources=new Set();

  for(const entry of buildPartEntries(build)){
    if(!coreCategories.has(entry.category))continue;
    const owned=parts.find(part=>part.category===entry.category&&part.name===entry.name);
    for(const source of sourceTokens(owned))sources.add(source);
  }

  for(const source of sources){
    const product=productForSource(source,catalog);
    if(!product)continue;
    const stockUnit=(product.parts||[]).find(part=>part.category==='Bit'||part.category==='Ratchet Integrated Bit');
    if(stockUnit)vectors.push(bitVector(stockUnit.name));
  }

  if(!vectors.length)return {attack:60,stamina:60,defense:60};
  return {
    attack:mean(vectors.map(vector=>vector.attack)),
    stamina:mean(vectors.map(vector=>vector.stamina)),
    defense:mean(vectors.map(vector=>vector.defense))
  };
}

function profileFor(build,parts,catalog){
  const bit=bitVector(build.bit||build.integratedBit);
  const core=stockRoleVector(build,parts,catalog);
  const height=ratchetHeight(build.ratchet);
  const delta=(60-height)/10;

  const attack=clamp(bit.attack*0.64+core.attack*0.36+delta*5);
  const stamina=clamp(bit.stamina*0.64+core.stamina*0.36-delta*2);
  const defense=clamp(bit.defense*0.64+core.defense*0.36+delta*2);
  const vector={attack,stamina,defense};
  const entries=Object.entries(vector).sort((a,b)=>b[1]-a[1]);
  const role=entries[0][0][0].toUpperCase()+entries[0][0].slice(1);
  const versatility=clamp(100-range(Object.values(vector)));
  const mechanical=clamp(entries[0][1]*0.72+mean(Object.values(vector))*0.28);

  return {vector,role,versatility,mechanical,height};
}

function createEvidenceContext(savedBuilds,tests,matches){
  const stats=aggregate(matches);
  const statsByName=new Map(stats.map(row=>[row.name,row]));
  const evidenceByName=new Map();
  for(const build of savedBuilds){
    evidenceByName.set(build.name,buildEvidence(build,savedBuilds,tests,matches));
  }
  return {statsByName,evidenceByName};
}

function observedCandidateEvidence(build,savedBuilds,context){
  const exact=savedBuilds.find(saved=>saved.name===build.name);
  if(exact){
    const evidence=context.evidenceByName.get(exact.name);
    return {
      score:evidence?.score||0,
      matches:evidence?.stats?.matches||0,
      selfRate:evidence?.stats?.selfRate||0,
      stability:evidence?.stats?.stability||0.5,
      source:'Exact tested build'
    };
  }
  const candidateParts=new Set(buildPartEntries(build).map(part=>`${part.category}|${part.name}`));
  let weighted=0,totalWeight=0,matchesSeen=0,selfWeighted=0,stabilityWeighted=0;

  for(const saved of savedBuilds){
    const savedParts=buildPartEntries(saved).map(part=>`${part.category}|${part.name}`);
    const shared=savedParts.filter(part=>candidateParts.has(part)).length;
    if(!shared)continue;

    const stat=context.statsByName.get(saved.name);
    const evidence=context.evidenceByName.get(saved.name);
    const weight=shared/Math.max(candidateParts.size,savedParts.length);
    weighted+=evidence.score*weight;
    totalWeight+=weight;
    matchesSeen+=stat?.matches||0;
    selfWeighted+=(stat?.selfRate||0)*weight;
    stabilityWeighted+=(stat?.stability||0.5)*weight;
  }

  if(!totalWeight){
    return {score:45,matches:0,selfRate:0.08,stability:0.5,source:'Untested heuristic prior'};
  }

  return {
    score:clamp(weighted/totalWeight),
    matches:matchesSeen,
    selfRate:selfWeighted/totalWeight,
    stability:stabilityWeighted/totalWeight,
    source:'Inherited component evidence'
  };
}

function scoreCandidate(build,parts,catalog,savedBuilds,context){
  const profile=profileFor(build,parts,catalog);
  const observed=observedCandidateEvidence(build,savedBuilds,context);
  const reliability=clamp(
    58+
    profile.versatility*0.16+
    observed.stability*18-
    observed.selfRate*85-
    Math.max(0,profile.height-60)*0.45
  );
  const uncertaintyPenalty=observed.matches?Math.max(0,12-observed.matches)*0.45:8;
  const overall=clamp(
    profile.mechanical*0.44+
    observed.score*0.31+
    reliability*0.15+
    profile.versatility*0.10-
    uncertaintyPenalty
  );

  return {
    ...build,
    name:buildName(build),
    profile:profile.vector,
    role:profile.role,
    mechanical:Math.round(profile.mechanical),
    evidenceScore:Math.round(observed.score),
    evidenceMatches:observed.matches,
    evidenceSource:observed.source,
    reliability:Math.round(reliability),
    versatility:Math.round(profile.versatility),
    overall:Math.round(overall),
    uncertainty:observed.matches?clamp(100-observed.matches*6):100
  };
}

function positiveParts(parts,category){
  return parts.filter(part=>part.category===category&&part.qty>0);
}

export function generateLegalBuilds(parts,savedBuilds=[],tests=[],matches=[],catalog=[]){
  const context=createEvidenceContext(savedBuilds,tests,matches);
  const blades=positiveParts(parts,'Blade');
  const chips=positiveParts(parts,'Lock Chip');
  const mains=positiveParts(parts,'Main Blade');
  const assists=positiveParts(parts,'Assist Blade');
  const overs=positiveParts(parts,'Over Blade');
  const metals=positiveParts(parts,'Metal Blade');
  const ratchets=positiveParts(parts,'Ratchet').filter(part=>part.name!=='Integrated');
  const bits=positiveParts(parts,'Bit');
  const integrated=positiveParts(parts,'Ratchet Integrated Bit');

  const raw=[];
  for(const blade of blades){
    for(const ratchet of ratchets){
      for(const bit of bits){
        raw.push({system:'Standard',blade:blade.name,ratchet:ratchet.name,bit:bit.name});
      }
    }
  }

  for(const chip of chips){
    for(const main of mains){
      for(const assist of assists){
        for(const ratchet of ratchets){
          for(const bit of bits){
            raw.push({
              system:'CX',lockChip:chip.name,mainBlade:main.name,assistBlade:assist.name,
              ratchet:ratchet.name,bit:bit.name
            });
          }
        }
      }
    }
  }

  for(const chip of chips){
    for(const over of overs){
      for(const metal of metals){
        for(const assist of assists){
          for(const ratchet of ratchets){
            for(const bit of bits){
              raw.push({
                system:'CX Expand',lockChip:chip.name,overBlade:over.name,metalBlade:metal.name,
                assistBlade:assist.name,ratchet:ratchet.name,bit:bit.name
              });
            }
          }
        }
      }
    }
  }

  for(const chip of chips){
    for(const main of mains){
      for(const assist of assists){
        for(const unit of integrated){
          raw.push({
            system:'CX Integrated',lockChip:chip.name,mainBlade:main.name,
            assistBlade:assist.name,integratedBit:unit.name
          });
        }
      }
    }
  }

  const seen=new Set();
  return raw
    .map(build=>scoreCandidate({...build,name:buildName(build)},parts,catalog,savedBuilds,context))
    .filter(build=>{
      if(seen.has(build.name))return false;
      seen.add(build.name);
      return true;
    });
}

export function isDuplicateRestricted(category,name){
  if(category==='Lock Chip'){
    return /^(Valkyrie|Emperor)$/i.test(name);
  }
  return true;
}

export function officialDeckLegality(deck,parts){
  const issues=[];
  if(deck.length!==3)issues.push(`Deck has ${deck.length}/3 Beys`);

  const ownedCounts={};
  for(const part of parts)ownedCounts[`${part.category}|${part.name}`]=part.qty||0;

  const used={};
  const duplicateKeys=new Set();
  for(const build of deck){
    for(const part of buildPartEntries(build)){
      const key=`${part.category}|${part.name}`;
      used[key]=(used[key]||0)+1;
      if(isDuplicateRestricted(part.category,part.name)){
        if(duplicateKeys.has(key))issues.push(`Duplicate restricted part: ${part.name}`);
        duplicateKeys.add(key);
      }
    }
  }

  for(const [key,count] of Object.entries(used)){
    if(count>(ownedCounts[key]||0)){
      const [,name]=key.split('|');
      issues.push(`${name}: deck uses ${count}, owned ${ownedCounts[key]||0}`);
    }
  }

  return {legal:issues.length===0,issues};
}

function deckMetrics(deck){
  const scores=deck.map(build=>build.overall);
  const evidence=deck.map(build=>build.evidenceScore);
  const coverage={
    attack:Math.max(...deck.map(build=>build.profile.attack)),
    stamina:Math.max(...deck.map(build=>build.profile.stamina)),
    defense:Math.max(...deck.map(build=>build.profile.defense))
  };
  const coverageValues=Object.values(coverage);
  const roleCount=new Set(deck.map(build=>build.role)).size;
  const scoreGap=range(scores);
  const evidenceGap=range(evidence);
  const coverageGap=range(coverageValues);
  const floor=Math.min(...scores);
  const average=mean(scores);
  const coverageFloor=Math.min(...coverageValues);
  const gapIndex=clamp(100-(scoreGap*0.48+coverageGap*0.34+evidenceGap*0.18));
  const objective=clamp(
    floor*0.30+
    average*0.18+
    coverageFloor*0.18+
    (100-scoreGap)*0.13+
    (100-coverageGap)*0.10+
    (100-evidenceGap)*0.06+
    (roleCount/3*100)*0.05
  );

  return {
    objective:Math.round(objective),
    gapIndex:Math.round(gapIndex),
    floor:Math.round(floor),
    average:Math.round(average),
    scoreGap:Math.round(scoreGap),
    evidenceGap:Math.round(evidenceGap),
    coverageGap:Math.round(coverageGap),
    coverage:Object.fromEntries(Object.entries(coverage).map(([key,value])=>[key,Math.round(value)])),
    roleCount
  };
}

function shortlistCandidates(candidates,options={}){
  const selected=new Map();
  const add=build=>selected.set(build.name,build);

  const sorted=candidates.slice().sort((a,b)=>b.overall-a.overall||b.evidenceScore-a.evidenceScore);
  sorted.slice(0,24).forEach(add);

  for(const role of ['Attack','Stamina','Defense','Balance']){
    candidates.filter(build=>build.role===role)
      .sort((a,b)=>b.overall-a.overall||b.reliability-a.reliability)
      .slice(0,18).forEach(add);
  }

  candidates.slice().sort((a,b)=>b.evidenceScore-a.evidenceScore).slice(0,16).forEach(add);
  candidates.slice().sort((a,b)=>b.versatility-a.versatility).slice(0,12).forEach(add);

  if(options.anchorPart){
    candidates.filter(build=>buildPartEntries(build).some(part=>part.name===options.anchorPart))
      .sort((a,b)=>b.overall-a.overall||b.evidenceScore-a.evidenceScore)
      .slice(0,24).forEach(add);
  }

  return [...selected.values()];
}

export function optimizeDecks(parts,savedBuilds=[],tests=[],matches=[],catalog=[],limit=10,options={}){
  const allCandidates=generateLegalBuilds(parts,savedBuilds,tests,matches,catalog);
  const frontier=shortlistCandidates(allCandidates,options);
  const best=[];
  let triplesEvaluated=0;

  for(let i=0;i<frontier.length-2;i++){
    for(let j=i+1;j<frontier.length-1;j++){
      for(let k=j+1;k<frontier.length;k++){
        const deck=[frontier[i],frontier[j],frontier[k]];
        if(options.requireAnchor&&options.anchorPart&&!deck.some(build=>buildPartEntries(build).some(part=>part.name===options.anchorPart)))continue;
        const legality=officialDeckLegality(deck,parts);
        if(!legality.legal)continue;
        triplesEvaluated++;
        const metrics=deckMetrics(deck);
        metrics.anchorIncluded=options.anchorPart?deck.some(build=>buildPartEntries(build).some(part=>part.name===options.anchorPart)):false;
        const entry={deck,metrics};

        let inserted=false;
        for(let index=0;index<best.length;index++){
          const other=best[index];
          if(
            metrics.objective>other.metrics.objective ||
            (metrics.objective===other.metrics.objective&&metrics.gapIndex>other.metrics.gapIndex) ||
            (metrics.objective===other.metrics.objective&&metrics.gapIndex===other.metrics.gapIndex&&metrics.floor>other.metrics.floor)
          ){
            best.splice(index,0,entry);
            inserted=true;
            break;
          }
        }
        if(!inserted)best.push(entry);
        if(best.length>limit)best.length=limit;
      }
    }
  }

  return {
    generated:allCandidates.length,
    frontier:frontier.length,
    triplesEvaluated,
    decks:best
  };
}

export function explainDeck(entry){
  if(!entry)return [];
  const {metrics,deck}=entry;
  const weakest=deck.slice().sort((a,b)=>a.overall-b.overall)[0];
  const leastCertain=deck.slice().sort((a,b)=>b.uncertainty-a.uncertainty)[0];
  return [
    `Weakest-Bey floor: ${metrics.floor}/100.`,
    `Performance gap: ${metrics.scoreGap} points across the three Beys.`,
    `Role-coverage gap: ${metrics.coverageGap} points.`,
    `Evidence gap: ${metrics.evidenceGap} points.`,
    `Coverage: Attack ${metrics.coverage.attack}, Stamina ${metrics.coverage.stamina}, Defense ${metrics.coverage.defense}.`,
    `Weakest current candidate: ${weakest.name}.`,
    `Highest uncertainty: ${leastCertain.name}.`
  ];
}

export function suggestSingleVariableRepairs(target,deck,candidates,parts,limit=5){
  if(!target)return [];
  const targetEntries=buildPartEntries(target);
  const others=deck.filter(build=>build.name!==target.name);
  const suggestions=[];

  for(const candidate of candidates){
    if(candidate.name===target.name)continue;
    const candidateEntries=buildPartEntries(candidate);
    const targetMap=new Map(targetEntries.map(part=>[part.category,part.name]));
    const candidateMap=new Map(candidateEntries.map(part=>[part.category,part.name]));
    const categories=new Set([...targetMap.keys(),...candidateMap.keys()]);
    const changed=[...categories].filter(category=>targetMap.get(category)!==candidateMap.get(category));
    if(changed.length!==1)continue;

    const proposed=[...others,candidate];
    if(!officialDeckLegality(proposed,parts).legal)continue;
    const before=deckMetrics(deck);
    const after=deckMetrics(proposed);
    suggestions.push({
      changed:changed[0],
      from:targetMap.get(changed[0])||'—',
      to:candidateMap.get(changed[0])||'—',
      build:candidate,
      objectiveGain:after.objective-before.objective,
      gapGain:after.gapIndex-before.gapIndex,
      metrics:after
    });
  }

  return suggestions
    .sort((a,b)=>b.objectiveGain-a.objectiveGain||b.gapGain-a.gapGain)
    .slice(0,limit);
}
