export function aggregate(matches){
  const map={};
  const ensure=name=>map[name]??={
    name,w:0,l:0,matches:0,points:0,against:0,
    finishes:{Spin:0,Burst:0,Over:0,Xtreme:0},
    selfExits:0,opponents:new Set(),sequence:[]
  };
  for(const match of matches){
    const a=ensure(match.a),b=ensure(match.b);
    const aWin=match.winner===match.a;
    a.matches++;b.matches++;
    a.w+=aWin?1:0;a.l+=aWin?0:1;
    b.w+=aWin?0:1;b.l+=aWin?1:0;
    a.points+=match.aScore||0;a.against+=match.bScore||0;
    b.points+=match.bScore||0;b.against+=match.aScore||0;
    a.opponents.add(match.b);b.opponents.add(match.a);
    a.sequence.push(aWin?1:0);b.sequence.push(aWin?0:1);
    for(const round of match.rounds||[]){
      const winner=round.side==='a'?a:b;
      if(winner.finishes[round.finish]!==undefined)winner.finishes[round.finish]++;
      if(round.own){
        const loser=round.side==='a'?b:a;
        loser.selfExits++;
      }
    }
  }
  return Object.values(map).map(x=>{
    const n=x.sequence.length;
    const half=Math.floor(n/2);
    const first=x.sequence.slice(0,half);
    const second=x.sequence.slice(half);
    const rate=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
    const stability=n>=6?Math.max(0,1-Math.abs(rate(first)-rate(second))):0.5;
    const totalRounds=Object.values(x.finishes).reduce((a,b)=>a+b,0)+x.selfExits;
    return {
      ...x,
      opponents:[...x.opponents],
      winRate:x.matches?x.w/x.matches:0,
      diff:x.points-x.against,
      stability,
      selfRate:totalRounds?x.selfExits/totalRounds:0
    };
  });
}

export function wilsonInterval(wins,n,z=1.2815515655446004){
  if(!n)return {low:0,high:1};
  const p=wins/n,z2=z*z,den=1+z2/n;
  const center=(p+z2/(2*n))/den;
  const margin=z*Math.sqrt((p*(1-p)+z2/(4*n))/n)/den;
  return {low:Math.max(0,center-margin),high:Math.min(1,center+margin)};
}

export function matchupRecord(test,builds,matches,extraMatch=null){
  const focus=builds.find(b=>b.id===test.aId);
  const rows=matches.filter(m=>m.testId===test.id);
  if(extraMatch)rows.push(extraMatch);
  const wins=rows.filter(m=>m.winner===focus?.name).length;
  return {
    wins,
    losses:rows.length-wins,
    n:rows.length,
    rate:rows.length?wins/rows.length:0,
    rows
  };
}

export function matchupDecision(test,builds,matches,extraMatch=null){
  const record=matchupRecord(test,builds,matches,extraMatch);
  const ci=wilsonInterval(record.wins,record.n);
  const confidence=Math.round((1-(ci.high-ci.low))*100);
  const nextTarget=record.n<4?4:record.n<8?8:record.n<12?12:16;

  if(record.n<4){
    return {
      status:'continue',record,ci,confidence,nextTarget,
      reason:`Collect ${4-record.n} more match${4-record.n===1?'':'es'} before an early decision.`
    };
  }

  if(ci.low>.50){
    return {
      status:'pass',record,ci,confidence,nextTarget:record.n,
      reason:`Decisive focus-build advantage. Estimated win range ${(ci.low*100).toFixed(0)}–${(ci.high*100).toFixed(0)}%.`
    };
  }

  if(ci.high<.50){
    return {
      status:'fail',record,ci,confidence,nextTarget:record.n,
      reason:`Decisive opponent advantage. Estimated focus-build range ${(ci.low*100).toFixed(0)}–${(ci.high*100).toFixed(0)}%.`
    };
  }

  if(record.n>=16){
    if(record.wins>=10)return {
      status:'pass',record,ci,confidence,nextTarget:16,
      reason:'Sixteen-match cap reached with a 10–6 or better result.'
    };
    if(record.wins<=6)return {
      status:'fail',record,ci,confidence,nextTarget:16,
      reason:'Sixteen-match cap reached with a 6–10 or worse result.'
    };
    return {
      status:'inconclusive',record,ci,confidence,nextTarget:16,
      reason:'The matchup remains close after sixteen matches.'
    };
  }

  return {
    status:'continue',record,ci,confidence,nextTarget,
    reason:`Evidence remains uncertain. Continue to ${nextTarget} total matches. Estimated range ${(ci.low*100).toFixed(0)}–${(ci.high*100).toFixed(0)}%.`
  };
}

export function roleOfBit(name=''){
  const n=name.toLowerCase();
  if(/flat|rush|vortex|accel|quake|kick|gear|point|zap/.test(n))return 'Attack';
  if(/ball|orb|glide|yield|free|disc/.test(n))return 'Stamina';
  if(/needle|dot|spike|bound|wedge|hexa/.test(n))return 'Defense';
  return 'Balance';
}

export function buildEvidence(build,builds,tests,matches){
  const stats=aggregate(matches).find(x=>x.name===build.name);
  const passed=tests.filter(t=>t.aId===build.id&&t.status==='Passed');
  const opponents=new Set(passed.map(t=>t.bId));
  const opponentRoles=new Set(
    passed.map(t=>builds.find(b=>b.id===t.bId))
      .filter(Boolean)
      .map(b=>b.role||roleOfBit(b.bit||b.integratedBit))
  );

  let score=0;
  const reasons=[];
  if(stats){
    score+=Math.min(30,(stats.matches/16)*30);
    score+=Math.min(15,stats.winRate*15);
    score+=Math.min(10,stats.stability*10);
    score+=stats.diff>0?10:0;
    score+=stats.selfRate<.10?5:stats.selfRate>.18?-10:0;
    reasons.push(`${stats.matches} controlled matches`);
    reasons.push(`${(stats.winRate*100).toFixed(1)}% overall win rate`);
    reasons.push(`${stats.diff>=0?'+':''}${stats.diff} point differential`);
    reasons.push(`${(stats.selfRate*100).toFixed(1)}% self-exit rate`);
  }else{
    reasons.push('No controlled matches');
  }

  score+=Math.min(20,opponents.size*10);
  score+=Math.min(10,opponentRoles.size*5);
  score=Math.max(0,Math.min(100,Math.round(score)));

  const ready=
    passed.length>=2 &&
    opponentRoles.size>=2 &&
    (stats?.matches||0)>=8 &&
    (stats?.diff||0)>0 &&
    (stats?.selfRate||0)<.15;

  const label=ready?'Serious Candidate':
    score>=60?'Validated':
    score>=30?'Screened':'Experimental';

  return {
    score,label,ready,
    passed:passed.length,
    opponentRoles:opponentRoles.size,
    stats,
    reasons
  };
}

export function deckLegality(builds,parts){
  const assigned=builds.filter(b=>['Bey 1','Bey 2','Bey 3'].includes(b.slot));
  const issues=[];
  const counts={};
  const partNames=b=>[
    b.blade,b.lockChip,b.mainBlade,b.assistBlade,b.overBlade,b.metalBlade,
    b.ratchet,b.bit,b.integratedBit
  ].filter(Boolean);

  for(const build of assigned){
    for(const name of partNames(build))counts[name]=(counts[name]||0)+1;
  }
  for(const [name,count] of Object.entries(counts)){
    const owned=parts.find(p=>p.name===name)?.qty||0;
    if(count>owned)issues.push(`${name}: uses ${count}, owned ${owned}`);
  }
  if(assigned.length<3)issues.push(`Deck has ${assigned.length}/3 assigned Beys`);
  return {legal:issues.length===0,issues,assigned};
}

export function coachDirective(state){
  const {parts,builds,tests,matches,projects}=state;
  if(!parts.length){
    return {
      phase:'Collection',level:'warn',
      title:'Load the confirmed owned collection',
      detail:'The coach requires accurate owned quantities before it can formulate legal builds.',
      action:'load-confirmed',label:'Load Confirmed Collection'
    };
  }

  if(builds.length<3){
    return {
      phase:'Formulation',level:'warn',
      title:'Formulate the candidate deck',
      detail:`${builds.length}/3 candidate builds exist. The coach can create the missing builds using owned parts only.`,
      action:'formulate',label:'Coach Formulate Deck'
    };
  }

  const legality=deckLegality(builds,parts);
  if(!legality.legal){
    return {
      phase:'Deck',level:'bad',
      title:'Resolve deck construction conflicts',
      detail:legality.issues.join(' · '),
      action:'assign',label:'Coach Repair Deck'
    };
  }

  const active=tests.find(t=>t.status==='Active');
  if(active){
    const decision=matchupDecision(active,builds,matches);
    return {
      phase:'Testing',
      level:decision.status==='continue'?'warn':decision.status==='pass'?'good':'bad',
      title:decision.status==='continue'?'Continue the active matchup':'Review the completed matchup',
      detail:decision.reason,
      action:decision.status==='continue'?'continue-test':'review-lab',
      testId:active.id,
      label:decision.status==='continue'?'Start Next Match':'Review Coach Decision',
      confidence:decision.confidence
    };
  }

  const queued=tests.find(t=>['Planned','Paused'].includes(t.status));
  if(queued){
    return {
      phase:'Testing',level:'warn',
      title:'Resume the queued matchup',
      detail:'The coach has a controlled matchup waiting.',
      action:'activate-test',testId:queued.id,label:'Activate Matchup'
    };
  }

  const assigned=legality.assigned;
  const evidence=assigned.map(b=>buildEvidence(b,builds,tests,matches));
  if(evidence.length===3&&evidence.every(e=>e.ready)){
    return {
      phase:'Decision',level:'good',
      title:'Owned-pool serious tournament deck identified',
      detail:'All three assigned builds have legal construction and multi-matchup evidence. Review the final deck and launch notes.',
      action:'review-deck',label:'Review Final Deck'
    };
  }

  return {
    phase:'Planning',level:'warn',
    title:projects.length?'Plan the next highest-value matchup':'Create the first coach-managed experiment',
    detail:'The coach will select the least-tested build and a contrasting legal opponent.',
    action:'plan-test',label:'Coach Plan Next Matchup'
  };
}
