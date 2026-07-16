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

export function researchCoach({builds,tests,matches}){
  const stats=aggregate(matches);
  if(!builds.length){
    return {title:'Create your first controlled build',decision:'Add owned parts, save a complete build, then create a benchmark opponent.',level:'warn',reasons:['No saved builds exist.'],next:'Open Builds and create at least two builds.'}
  }
  if(builds.length<2){
    return {title:'Create a benchmark opponent',decision:'A controlled test requires two complete builds.',level:'warn',reasons:['Only one saved build exists.'],next:'Create a second build using owned parts.'}
  }
  const active=tests.find(t=>t.status==='Active')||tests.find(t=>t.status==='Planned');
  if(active){
    const done=matches.filter(m=>m.testId===active.id).length;
    const a=builds.find(b=>b.id===active.aId),b=builds.find(b=>b.id===active.bId);
    const focus=stats.find(s=>s.name===a?.name);
    const remaining=Math.max(0,active.target-done);
    const reasons=[`${done} of ${active.target} matches complete.`];
    if(focus){
      reasons.push(`Current record: ${focus.w}-${focus.l} (${(focus.winRate*100).toFixed(1)}%).`);
      reasons.push(`Point differential: ${focus.diff>=0?'+':''}${focus.diff}.`);
      if(focus.selfRate>.15) reasons.push(`Warning: self-exit rate is ${(focus.selfRate*100).toFixed(1)}%.`);
      if(focus.matches>=8 && focus.stability<.75) reasons.push('Early and later results are inconsistent.');
    }
    if(remaining>0){
      return {title:'Continue the active test',decision:`Do not change parts yet. Complete ${remaining} more match${remaining===1?'':'es'} against ${b?.name||'the benchmark'}.`,level:'warn',reasons,next:`Resume ${a?.name||'focus build'} vs ${b?.name||'opponent'}.`}
    }
  }
  if(!stats.length){
    return {title:'Start a 16-match screening series',decision:'Use the same stadium, launch procedure, and builds for all matches.',level:'warn',reasons:['No controlled match data exists.'],next:'Create a test with a 16-match target.'}
  }
  const best=[...stats].sort((a,b)=>b.winRate-a.winRate||b.diff-a.diff)[0];
  const reasons=[`${best.name}: ${best.w}-${best.l}, ${(best.winRate*100).toFixed(1)}% win rate.`,`Point differential: ${best.diff>=0?'+':''}${best.diff}.`,`Evidence level: ${best.confidence}.`];
  if(best.selfRate>.15){
    return {title:'Investigate launch instability',decision:'Do not lock this build yet. The self-exit rate is too high for tournament confidence.',level:'bad',reasons,next:'Repeat a controlled session and compare launch consistency before changing parts.'}
  }
  if(best.matches<16){
    return {title:'Insufficient evidence',decision:`Extend ${best.name} to 16 controlled matches before drawing conclusions.`,level:'warn',reasons,next:'Continue the same matchup.'}
  }
  if(best.matches<32){
    return {title:'Screening complete',decision:best.winRate>=.55&&best.diff>0?'The build passed screening. Extend to 32 matches.':'The result is inconclusive or negative. Review finishes before any part change.',level:best.winRate>=.55&&best.diff>0?'good':'warn',reasons,next:best.winRate>=.55&&best.diff>0?'Extend the same test target to 32.':'Inspect finish and self-exit patterns.'}
  }
  if(best.opponents.length<3){
    return {title:'Archetype coverage gap',decision:`${best.name} needs testing against more distinct opponents.`,level:'warn',reasons:[...reasons,`Distinct opponents: ${best.opponents.length}.`],next:'Create a test against a different optimized archetype.'}
  }
  if(best.matches<64){
    return {title:'Validated, not yet verified',decision:`${best.name} has useful evidence but needs 64 total matches for high confidence.`,level:'good',reasons,next:'Continue controlled testing across multiple sessions.'}
  }
  if(best.matches<96){
    return {title:'High confidence',decision:`${best.name} is a strong tournament candidate, but benchmark verification is incomplete.`,level:'good',reasons,next:'Extend critical benchmark matchups toward 96 matches.'}
  }
  return {title:'Tournament-verified evidence',decision:`${best.name} has reached the verification threshold. Preserve the build and validate it in actual tournament mode.`,level:'good',reasons,next:'Record event results separately and monitor whether performance transfers.'}
}
