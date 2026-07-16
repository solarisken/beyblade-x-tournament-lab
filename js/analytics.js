export function comboName(build){return `${build.blade} ${build.ratchet} ${build.bit}`}

export function aggregate(builds,matches,historical=[]){
  const map={};
  const ensure=(name)=>map[name]??={name,w:0,l:0,matches:0,spin:0,burst:0,over:0,xtreme:0,points:0,against:0,self:0,opponents:new Set()};
  const add=(name,opp,w,l,sp,bu,ov,xt,pts,against,self=0)=>{
    const x=ensure(name);x.w+=w;x.l+=l;x.matches+=w+l;x.spin+=sp;x.burst+=bu;x.over+=ov;x.xtreme+=xt;x.points+=pts;x.against+=against;x.self+=self;x.opponents.add(opp);
  };
  for(const t of historical){
    const ap=t.aSpin+2*t.aBurst+2*t.aOver+3*t.aXtreme;
    const bp=t.bSpin+2*t.bBurst+2*t.bOver+3*t.bXtreme;
    add(t.a,t.b,t.aWins,t.bWins,t.aSpin,t.aBurst,t.aOver,t.aXtreme,ap,bp);
    add(t.b,t.a,t.bWins,t.aWins,t.bSpin,t.bBurst,t.bOver,t.bXtreme,bp,ap);
  }
  for(const m of matches){
    const c=(side,f)=>m.rounds.filter(r=>r.side===side&&r.finish===f).length;
    const aw=m.winner===m.a?1:0,bw=1-aw;
    add(m.a,m.b,aw,bw,c("a","Spin"),c("a","Burst"),c("a","Over"),c("a","Xtreme"),m.aScore,m.bScore,m.rounds.filter(r=>r.side==="b"&&r.own).length);
    add(m.b,m.a,bw,aw,c("b","Spin"),c("b","Burst"),c("b","Over"),c("b","Xtreme"),m.bScore,m.aScore,m.rounds.filter(r=>r.side==="a"&&r.own).length);
  }
  return Object.values(map).map(x=>{
    const rounds=x.spin+x.burst+x.over+x.xtreme;
    return {...x,opponents:[...x.opponents],winRate:x.matches?x.w/x.matches:0,diff:x.points-x.against,avgPoints:x.matches?x.points/x.matches:0,
      confidence:x.matches>=36?"High":x.matches>=24?"Medium":x.matches>=12?"Screened":"Low",
      readiness:x.matches>=24&&x.winRate>=.55&&x.diff>0&&x.opponents.size>=3?"Validated candidate":x.matches>=12?"Testing":"Insufficient data",
      koRate:rounds?(x.burst+x.over+x.xtreme)/rounds:0
    };
  });
}

export function matchupMatrix(matches,historical=[]){
  const map={};
  const touch=(a,b,w,l)=>{const key=`${a}|||${b}`;map[key]??={a,b,w:0,l:0};map[key].w+=w;map[key].l+=l};
  for(const h of historical){touch(h.a,h.b,h.aWins,h.bWins);touch(h.b,h.a,h.bWins,h.aWins)}
  for(const m of matches){touch(m.a,m.b,m.winner===m.a?1:0,m.winner===m.b?1:0);touch(m.b,m.a,m.winner===m.b?1:0,m.winner===m.a?1:0)}
  return Object.values(map).map(x=>({...x,rate:(x.w+x.l)?x.w/(x.w+x.l):0}));
}

export function partPerformance(builds,stats){
  const map={};
  for(const s of stats){
    const b=builds.find(x=>comboName(x)===s.name); if(!b) continue;
    for(const [type,part] of [["Blade",b.blade],["Ratchet",b.ratchet],["Bit",b.bit]]){
      const key=`${type}|||${part}`;
      map[key]??={type,part,matches:0,wins:0,points:0,against:0};
      const x=map[key];x.matches+=s.matches;x.wins+=s.w;x.points+=s.points;x.against+=s.against;
    }
  }
  return Object.values(map).map(x=>({...x,winRate:x.matches?x.wins/x.matches:0,diff:x.points-x.against}));
}
