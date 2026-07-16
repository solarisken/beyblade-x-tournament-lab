export function recommend(stats,tests){
  if(!stats.length) return {title:"First prescribed test",body:"Run DranStrike 1-50 Low Rush vs SilverWolf 9-60 Hexa for 12 first-to-4 matches. Do not change parts during the screening block.",level:"warn"};
  const active=tests.find(t=>t.status==="Active")||tests.find(t=>t.status==="Planned");
  if(active) return {title:"Continue active test",body:`Complete ${Math.max(0,active.target-(active.completed||0))} more matches in the current evidence stage before changing parts.`,level:"warn"};
  const candidate=stats.find(s=>s.readiness==="Validated candidate");
  if(candidate) return {title:"Validated candidate",body:`${candidate.name} has enough breadth and positive results to remain locked.`,level:"good"};
  const best=[...stats].sort((a,b)=>b.winRate-a.winRate||b.diff-a.diff)[0];
  if(best.matches<24) return {title:"Need more evidence",body:`Extend ${best.name} to at least 24 matches across multiple opponents.`,level:"warn"};
  if(best.opponents.length<3) return {title:"Coverage gap",body:`Test ${best.name} against a third distinct optimized archetype.`,level:"warn"};
  return {title:"Review build",body:`${best.name} has enough data for a part-change comparison. Change only one part and create a new saved build.`,level:"good"};
}
