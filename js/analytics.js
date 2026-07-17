export function aggregate(matches){
  const m={};
  const ensure=n=>m[n]??={name:n,w:0,l:0,matches:0,points:0,against:0,finishes:{Spin:0,Burst:0,Over:0,Xtreme:0},self:0,opponents:new Set(),firstHalf:[],secondHalf:[]};
  const add=(n,opp,w,l,p,a,index,total)=>{const x=ensure(n);x.w+=w;x.l+=l;x.matches++;x.points+=p;x.against+=a;x.opponents.add(opp);(index<total/2?x.firstHalf:x.secondHalf).push(w)};
  for(let i=0;i<matches.length;i++){
    const g=matches[i];
    add(g.a,g.b,g.winner===g.a?1:0,g.winner===g.b?1:0,g.aScore,g.bScore,i,matches.length);
    add(g.b,g.a,g.winner===g.b?1:0,g.winner===g.a?1:0,g.bScore,g.aScore,i,matches.length);
    for(const r of g.rounds){
      const n=r.side==='a'?g.a:g.b;ensure(n).finishes[r.finish]++;
      if(r.own){const loser=r.side==='a'?g.b:g.a;ensure(loser).self++}
    }
  }
  return Object.values(m).map(x=>{
    const totalFinishes=Object.values(x.finishes).reduce((a,b)=>a+b,0);
    const firstRate=x.firstHalf.length?x.firstHalf.reduce((a,b)=>a+b,0)/x.firstHalf.length:0;
    const secondRate=x.secondHalf.length?x.secondHalf.reduce((a,b)=>a+b,0)/x.secondHalf.length:0;
    const stability=x.matches>=8?Math.max(0,1-Math.abs(firstRate-secondRate)):0;
    const selfRate=totalFinishes?x.self/totalFinishes:0;
    const ko=(x.finishes.Burst+x.finishes.Over+x.finishes.Xtreme);
    return {...x,
      opponents:[...x.opponents],
      winRate:x.matches?x.w/x.matches:0,
      diff:x.points-x.against,
      avgPoints:x.matches?x.points/x.matches:0,
      selfRate,
      koRate:totalFinishes?ko/totalFinishes:0,
      stability,
      confidence:x.matches>=96?'Tournament verified':x.matches>=64?'High confidence':x.matches>=32?'Validated':x.matches>=16?'Screened':'Experimental'
    }
  })
}


export function researchCoach({builds,tests,matches,projects=[]}){
  const stats=aggregate(matches);
  const active=tests.find(t=>t.status==='Active')||tests.find(t=>t.status==='Planned');
  const result={
    title:'Research setup required',
    decision:'Create two complete builds and one controlled project.',
    level:'warn', reasons:[], next:'Create the focus build and benchmark opponent.',
    confidence:0, priorityScore:0, recommendedTest:null, warnings:[]
  };
  if(!builds.length){result.reasons=['No saved builds exist.'];return result;}
  if(builds.length<2){
    result.title='Create a benchmark opponent';
    result.decision='A controlled comparison requires at least two complete builds.';
    result.reasons=['Only one saved build exists.'];
    result.next='Create a second optimized build from owned parts.';
    return result;
  }
  const byName=name=>stats.find(s=>s.name===name);
  const testRows=t=>matches.filter(m=>m.testId===t.id);
  const buildOf=id=>builds.find(b=>b.id===id);

  const scoredTests=tests.filter(t=>t.status!=='Complete').map(t=>{
    const rows=testRows(t),a=buildOf(t.aId),b=buildOf(t.bId),focus=byName(a?.name);
    const progress=t.target?rows.length/t.target:0;
    const remaining=Math.max(0,(t.target||16)-rows.length);
    const opponentNovelty=focus?Math.max(0,3-focus.opponents.length):3;
    const uncertainty=focus?Math.max(0,1-Math.abs(focus.winRate-.5)*2):1;
    const instability=focus&&focus.matches>=8?Math.max(0,1-focus.stability):.5;
    const selfRisk=focus?.selfRate||0;
    const score=remaining*2+opponentNovelty*12+uncertainty*20+instability*15+selfRisk*10+(t.status==='Active'?25:0)-progress*8;
    return {test:t,a,b,rows,focus,remaining,score};
  }).sort((x,y)=>y.score-x.score);
  const top=scoredTests[0];

  if(active){
    const a=buildOf(active.aId),b=buildOf(active.bId),rows=testRows(active);
    const focus=byName(a?.name),remaining=Math.max(0,active.target-rows.length);
    result.recommendedTest=active.id;
    result.priorityScore=Math.round(top?.score||0);
    result.reasons.push(`${rows.length} of ${active.target} matches complete.`);
    if(focus){
      result.reasons.push(`Current record: ${focus.w}-${focus.l} (${(focus.winRate*100).toFixed(1)}%).`);
      result.reasons.push(`Point differential: ${focus.diff>=0?'+':''}${focus.diff}.`);
      result.reasons.push(`Stability score: ${(focus.stability*100).toFixed(0)}%.`);
      result.reasons.push(`Self-exit rate: ${(focus.selfRate*100).toFixed(1)}%.`);
      result.confidence=Math.min(100,Math.round(
        Math.min(40,focus.matches/16*40)+Math.min(20,focus.opponents.length/3*20)+
        Math.min(20,focus.stability*20)+(focus.diff>0?10:0)+(focus.selfRate<.1?10:0)
      ));
      if(focus.selfRate>.18){
        result.title='Investigate launch instability';
        result.decision='Do not change parts yet. The self-exit rate is too high to isolate part performance.';
        result.level='bad';
        result.warnings.push('High self-exit rate may be masking the true matchup result.');
        result.next=`Repeat the same matchup in a separate session and compare launch consistency before changing ${a?.name}.`;
        return result;
      }
      if(focus.matches>=8&&focus.stability<.68){
        result.title='Results are unstable';
        result.decision='Continue the same test under identical conditions. Do not promote or reject the build yet.';
        result.level='warn';
        result.warnings.push('First-half and second-half results differ materially.');
        result.next=`Complete ${remaining} more match${remaining===1?'':'es'} against ${b?.name||'the benchmark'}.`;
        return result;
      }
    }
    if(remaining>0){
      result.title='Continue the active experiment';
      result.decision='Keep both builds unchanged until the current evidence stage is complete.';
      result.level='warn';
      result.next=`Resume ${a?.name||'focus build'} vs ${b?.name||'opponent'} for ${remaining} more match${remaining===1?'':'es'}.`;
      return result;
    }
  }

  if(!stats.length){
    result.title='Start a four-match rapid screen';
    result.decision='Use fixed conditions. The coach will stop early or extend only when the result remains unclear.';
    result.reasons=['No controlled match data exists.'];
    result.next='Create an active project and a four-match Rapid screening test.';
    return result;
  }

  const best=[...stats].sort((a,b)=>b.winRate-a.winRate||b.diff-a.diff||b.stability-a.stability)[0];
  result.confidence=Math.min(100,Math.round(
    Math.min(40,best.matches/16*40)+Math.min(20,best.opponents.length/3*20)+
    Math.min(20,best.stability*20)+(best.diff>0?10:0)+(best.selfRate<.1?10:0)
  ));
  result.reasons=[
    `${best.name}: ${best.w}-${best.l}, ${(best.winRate*100).toFixed(1)}% win rate.`,
    `Point differential: ${best.diff>=0?'+':''}${best.diff}.`,
    `Opponent coverage: ${best.opponents.length} distinct build${best.opponents.length===1?'':'s'}.`,
    `Stability score: ${(best.stability*100).toFixed(0)}%.`,
    `Self-exit rate: ${(best.selfRate*100).toFixed(1)}%.`,
    `Evidence level: ${best.confidence}.`
  ];

  if(best.selfRate>.15){
    result.title='Resolve self-exit risk';
    result.decision='The current build cannot be tournament-verified while self-exits remain elevated.';
    result.level='bad';
    result.next='Repeat the same matchup in a new session and compare launch technique before any part change.';
    return result;
  }
  if(best.matches<4){
    result.title='Collect initial evidence';
    result.decision='The coach needs at least four controlled matches before making an early decision.';
    result.next=`Continue ${best.name} under unchanged conditions.`;
    return result;
  }
  if(best.opponents.length<3){
    result.title='Expand matchup coverage';
    result.decision='Serious tournament consideration requires evidence against contrasting opponent roles.';
    result.next=top?`Run ${top.a?.name||'the focus build'} vs ${top.b?.name||'the next benchmark'}.`:'Create the next contrasting matchup.';
    result.recommendedTest=top?.test?.id||null;
    result.priorityScore=Math.round(top?.score||0);
    return result;
  }
  if(best.matches<12){
    result.title='Promising candidate';
    result.decision='The current evidence is useful, but matchup coverage and repeatability still control promotion.';
    result.level='warn';
    result.next='Let the app-wide coach select the next highest-value matchup.';
    return result;
  }
  const weak=best.opponents.map(name=>{
    const rows=matches.filter(m=>(m.a===best.name&&m.b===name)||(m.b===best.name&&m.a===name));
    const wins=rows.filter(m=>m.winner===best.name).length;
    return {name,rate:rows.length?wins/rows.length:0};
  }).sort((a,b)=>a.rate-b.rate)[0];

  if(weak&&weak.rate<.4){
    result.title='Critical matchup weakness';
    result.decision=`Do not lock the build yet. Win rate against ${weak.name} is ${(weak.rate*100).toFixed(1)}%.`;
    result.level='bad';
    result.next='Create a one-variable A/B experiment specifically against the weakest matchup.';
    return result;
  }
  result.title='Tournament-verified candidate';
  result.decision='The current evidence supports preserving this build for serious tournament use.';
  result.level='good';
  result.next='Freeze the build, document launch technique, and begin verification of the remaining deck slots.';
  result.confidence=Math.max(result.confidence,90);
  return result;
}
