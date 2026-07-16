import {getAll,put,del,exportAll,importAll,clearStore} from "./db.js";
import {aggregate,comboName,matchupMatrix,partPerformance} from "./analytics.js";
import {recommend} from "./recommendations.js";

const BASE_PARTS=[
{id:"blade-dranstrike",category:"Blade",name:"DranStrike",qty:1,source:"BX-49"},
{id:"blade-phoenixwing",category:"Blade",name:"PhoenixWing",qty:1,source:"BX-23"},
{id:"blade-impactdrake",category:"Blade",name:"ImpactDrake",qty:1,source:"UX-11"},
{id:"blade-silverwolf",category:"Blade",name:"SilverWolf",qty:1,source:"UX-08"},
{id:"blade-scorpiospear",category:"Blade",name:"ScorpioSpear",qty:1,source:"UX-14"},
{id:"blade-bulletgriffon",category:"Blade",name:"BulletGriffon",qty:1,source:"UX-19"},
{id:"blade-bahamutblitz",category:"Blade",name:"BahamutBlitz BK",qty:1,source:"CX-16"},
{id:"blade-soleclipse",category:"Blade",name:"SolEclipse D",qty:1,source:"CX-09"},
{id:"blade-wolfhunt",category:"Blade",name:"WolfHunt F",qty:1,source:"CX-10"},
{id:"ratchet-integrated",category:"Ratchet",name:"Integrated",qty:1,source:"UX-19"},
{id:"ratchet-060",category:"Ratchet",name:"0-60",qty:1,source:"CX-10"},
{id:"ratchet-070",category:"Ratchet",name:"0-70",qty:1,source:"UX-14"},
{id:"ratchet-150",category:"Ratchet",name:"1-50",qty:1,source:"CX-16"},
{id:"ratchet-380",category:"Ratchet",name:"3-80",qty:1,source:"UX-08"},
{id:"ratchet-450",category:"Ratchet",name:"4-50",qty:1,source:"BX-49"},
{id:"ratchet-570",category:"Ratchet",name:"5-70",qty:1,source:"CX-09"},
{id:"ratchet-960",category:"Ratchet",name:"9-60",qty:2,source:"BX-23 / UX-11"},
{id:"bit-discball",category:"Bit",name:"Disc Ball",qty:1,source:"CX-10"},
{id:"bit-freeball",category:"Bit",name:"Free Ball",qty:1,source:"UX-08"},
{id:"bit-freeflat",category:"Bit",name:"Free Flat",qty:1,source:"BX-49"},
{id:"bit-gearflat",category:"Bit",name:"Gear Flat",qty:1,source:"BX-23"},
{id:"bit-hexa",category:"Bit",name:"Hexa",qty:1,source:"UX-19"},
{id:"bit-ignition",category:"Bit",name:"Ignition",qty:1,source:"CX-16"},
{id:"bit-lowrush",category:"Bit",name:"Low Rush",qty:1,source:"UX-11"},
{id:"bit-transkick",category:"Bit",name:"Trans Kick",qty:1,source:"CX-09"},
{id:"bit-zap",category:"Bit",name:"Zap",qty:1,source:"UX-14"}];

const BASE_BUILDS=[
{id:"build-ds",name:"DranStrike 1-50 Low Rush",blade:"DranStrike",ratchet:"1-50",bit:"Low Rush",role:"Primary attacker",status:"Tournament Candidate",slot:"Bey 1",version:1,parentId:""},
{id:"build-sw",name:"SilverWolf 9-60 Hexa",blade:"SilverWolf",ratchet:"9-60",bit:"Hexa",role:"Defense",status:"Benchmark",slot:"Bey 2",version:1,parentId:""},
{id:"build-pw",name:"PhoenixWing 9-60 Gear Flat",blade:"PhoenixWing",ratchet:"9-60",bit:"Gear Flat",role:"Secondary attacker",status:"Benchmark",slot:"Bey 3",version:1,parentId:""},
{id:"build-bb",name:"BahamutBlitz BK 0-70 Ignition",blade:"BahamutBlitz BK",ratchet:"0-70",bit:"Ignition",role:"Balance / counter",status:"Test Bey",slot:"Test Bey",version:1,parentId:""}];

const HIST=[];

let state={page:"home",parts:[],builds:[],matches:[],tests:[],history:[],battle:null,pending:null,wizard:null,filter:"",partFilter:"All"};

function uid(){return crypto.randomUUID?.()||Date.now()+"-"+Math.random()}
async function seed(){
 if(!(await getAll("parts")).length) for(const x of BASE_PARTS) await put("parts",x);
 if(!(await getAll("builds")).length) for(const x of BASE_BUILDS) await put("builds",x);
 if(!(await getAll("history")).length) for(const x of HIST) await put("history",x);
 if(!(await getAll("tests")).length) await put("tests",{id:"test-ds-sw",focusId:"build-ds",opponentId:"build-sw",target:12,status:"Active",priority:"High",purpose:"Initial screening: test knockout conversion and consistency against the optimized defense/stamina benchmark"});
}
async function refresh(){
 state.parts=await getAll("parts");state.builds=await getAll("builds");state.matches=await getAll("matches");state.tests=await getAll("tests");state.history=await getAll("history");render();
}
function build(id){return state.builds.find(x=>x.id===id)}
function slotBuild(slot){return state.builds.find(x=>x.slot===slot)}
function partQty(category,name){return state.parts.find(x=>x.category===category&&x.name===name)?.qty||0}
function deckIssues(){
 const deck=state.builds.filter(x=>["Bey 1","Bey 2","Bey 3"].includes(x.slot));const out=[];
 for(const k of["blade","ratchet","bit"]){const m={};deck.forEach(x=>m[x[k]]=(m[x[k]]||0)+1);Object.entries(m).forEach(([p,n])=>{const cat=k[0].toUpperCase()+k.slice(1),q=partQty(cat,p);if(n>q)out.push(`${p} used ${n} times; owned ${q}.`)})}
 deck.forEach(x=>{if(x.blade==="BulletGriffon"&&x.ratchet!=="Integrated")out.push("BulletGriffon requires Integrated.");if(x.blade!=="BulletGriffon"&&x.ratchet==="Integrated")out.push("Integrated is BulletGriffon-only.")});
 return [...new Set(out)];
}
function pairIssue(a,b){
 if(a.id===b.id)return"Choose different builds.";
 for(const [cat,key] of [["Blade","blade"],["Ratchet","ratchet"],["Bit","bit"]]) if(a[key]===b[key]&&partQty(cat,a[key])<2)return`Only one ${a[key]} is owned.`;
 return"";
}
function completed(test){
 const a=build(test.focusId)?.name,b=build(test.opponentId)?.name;
 return state.matches.filter(m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a)).length;
}
function nav(){return `<nav>${[["home","⌂","Home"],["wizard","＋","New Test"],["battle","⚔","Battle"],["tests","☷","Tests"],["tournament","🏆","Event"],["analytics","▥","Stats"],["collection","⚙","Collection"]].map(x=>`<button class="${state.page===x[0]?"active":""}" data-go="${x[0]}"><span>${x[1]}</span>${x[2]}</button>`).join("")}</nav>`}
function badge(text,level=""){return `<span class="badge ${level}">${text}</span>`}
function render(){
 const views={home:homeView,wizard:wizardView,battle:battleView,tests:testsView,tournament:tournamentView,analytics:analyticsView,collection:collectionView};
 document.getElementById("app").innerHTML=`<header><h1>Personal Beyblade X Tournament Lab</h1><p>IndexedDB · offline · scalable match analytics</p></header><main>${views[state.page]()}</main>${nav()}`;
 bind();
}
function go(p){state.page=p;render()}
function stats(){return aggregate(state.builds,state.matches,state.history)}
function homeView(){
 const s=stats(),rec=recommend(s,state.tests.map(t=>({...t,completed:completed(t)}))),active=state.tests.find(t=>t.status==="Active")||state.tests.find(t=>t.status==="Planned"),best=[...s].sort((a,b)=>b.winRate-a.winRate||b.diff-a.diff)[0];
 const readiness=best?Math.min(100,Math.round((Math.min(best.matches,36)/36)*45 + Math.min(best.opponents.length,3)/3*25 + Math.max(0,Math.min(1,best.winRate))*20 + (best.diff>0?10:0))):0;
 return `<div class="card hero"><div class="queue-top"><div><h2>Tournament command center</h2><p class="muted">Clean test database · controlled evidence only</p></div>${badge(readiness+"% readiness",readiness>=80?"good":readiness>=40?"warn":"")}</div><div class="notice"><b>${rec.title}</b><br>${rec.body}</div></div>
 <div class="grid"><div class="metric"><b>${state.matches.length}</b><span>Controlled matches</span></div><div class="metric"><b>${state.tests.filter(x=>x.status==="Complete").length}</b><span>Completed test series</span></div><div class="metric"><b>${best?(best.winRate*100).toFixed(1)+"%":"—"}</b><span>Best observed win rate</span></div><div class="metric"><b>${deckIssues().length||"✓"}</b><span>Deck legality</span></div></div>
 ${active?testCard(active,true):`<div class="card"><p>No active tests.</p><button class="btn" data-go="wizard">Create test</button></div>`}
 <div class="card"><h3>Current tournament deck</h3>${["Bey 1","Bey 2","Bey 3"].map(slot=>{const b=slotBuild(slot);return `<p>${badge(slot)} <b>${b?.name||"Unassigned"}</b><br><span class="muted">${b?.role||""}</span></p>`}).join("")}<div class="notice">${deckIssues().length?deckIssues().join("<br>"):"Owned-part check passed."}</div></div>`;
}
function testCard(t,home=false){
 const a=build(t.focusId),b=build(t.opponentId),done=completed(t),remain=Math.max(0,t.target-done);
 return `<div class="queue-item"><div class="queue-top"><div><b>${a?.name}</b><br><span class="muted">vs</span><br><b>${b?.name}</b></div>${badge(t.status,t.status==="Active"?"warn":t.status==="Complete"?"good":"")}</div><p class="tiny">${t.purpose||""}</p><div class="progress"><div style="width:${Math.min(100,done/t.target*100)}%"></div></div><p class="muted">${done}/${t.target} · ${remain} remaining</p>${t.id==="test-ds-sw"?`<p class="tiny">Decision rule: 7–5 or better → extend to 24; 6–6 → extend immediately; 5–7 or worse → inspect finish profile before changing parts.</p>`:""}<div class="actions"><button class="btn" data-start="${t.id}">Continue</button>${home?`<button class="btn secondary" data-go="tests">Manage</button>`:`<button class="btn secondary" data-edit-test="${t.id}">Edit</button><button class="btn danger" data-delete-test="${t.id}">Delete</button>`}</div></div>`;
}
function wizardView(){
 const w=state.wizard||{step:1,focusId:state.builds[0]?.id,opponentId:state.builds[3]?.id,target:12,purpose:""};
 state.wizard=w;
 const bars=[1,2,3,4].map(i=>`<span class="${i<=w.step?"active":""}"></span>`).join("");
 if(w.step===1)return `<div class="card"><div class="wizard-step">${bars}</div><h2>Choose focus build</h2><label>Focus build</label><select id="wizFocus">${buildOptions(w.focusId)}</select><div class="actions"><button class="btn" data-wiz-next="1">Next</button></div></div>`;
 if(w.step===2)return `<div class="card"><div class="wizard-step">${bars}</div><h2>Choose opponent</h2><label>Opponent build</label><select id="wizOpponent">${buildOptions(w.opponentId)}</select><div class="actions"><button class="btn secondary" data-wiz-back>Back</button><button class="btn" data-wiz-next="2">Next</button></div></div>`;
 if(w.step===3)return `<div class="card"><div class="wizard-step">${bars}</div><h2>Set test target</h2><div class="grid">${[12,24,36,50].map(n=>`<button class="btn ${w.target===n?"good":"secondary"}" data-target="${n}">${n} matches</button>`).join("")}</div><label>Custom target</label><input id="wizTarget" type="number" min="1" max="500" value="${w.target}"><label>Purpose</label><textarea id="wizPurpose">${w.purpose||""}</textarea><div class="actions"><button class="btn secondary" data-wiz-back>Back</button><button class="btn" data-wiz-next="3">Review</button></div></div>`;
 const a=build(w.focusId),b=build(w.opponentId),err=a&&b?pairIssue(a,b):"Select builds";
 return `<div class="card"><div class="wizard-step">${bars}</div><h2>Review test</h2><p><b>${a?.name}</b><br><span class="muted">vs</span><br><b>${b?.name}</b></p><p>Target: <b>${w.target}</b> first-to-4 matches</p>${err?`<div class="notice">${err}</div>`:""}<div class="actions"><button class="btn secondary" data-wiz-back>Back</button><button class="btn good" data-create-test ${err?"disabled":""}>Create and start</button></div></div>`;
}
function buildOptions(selected){return state.builds.map(x=>`<option value="${x.id}" ${x.id===selected?"selected":""}>${x.name}</option>`).join("")}
function testsView(){return `<div class="card"><div class="toolbar"><h2>Testing queue</h2><button class="btn icon" data-go="wizard">+</button></div></div>${state.tests.sort((a,b)=>["Active","Planned","Paused","Complete"].indexOf(a.status)-["Active","Planned","Paused","Complete"].indexOf(b.status)).map(t=>testCard(t)).join("")}<div id="modal"></div>`}
function tournamentView(){
 const eventMatches=state.matches.filter(m=>m.mode==="Tournament");
 return `<div class="card hero"><h2>Tournament Mode</h2><p class="muted">Event results stay separate from controlled testing.</p><div class="grid"><div class="metric"><b>${eventMatches.length}</b><span>Event matches</span></div><div class="metric"><b>${eventMatches.filter(m=>m.winner).length}</b><span>Recorded outcomes</span></div></div></div>
 <div class="card"><h3>Start tournament match</h3><label>Your Bey</label><select id="eventA">${buildOptions(slotBuild("Bey 1")?.id)}</select><label>Opponent build</label><select id="eventB">${buildOptions(slotBuild("Test Bey")?.id)}</select><label>Round / stage</label><input id="eventStage" placeholder="Swiss Round 1, Top 8, Final"><div class="actions"><button class="btn" id="startEvent">Start match</button></div></div>
 <div class="card"><h3>Event history</h3>${eventMatches.length?`<div class="scroll"><table><tr><th>Date</th><th>Stage</th><th>Matchup</th><th>Winner</th></tr>${eventMatches.map(m=>`<tr><td>${new Date(m.date).toLocaleDateString()}</td><td>${m.stage||""}</td><td>${m.a} vs ${m.b}</td><td>${m.winner}</td></tr>`).join("")}</table></div>`:`<p class="muted">No tournament matches recorded.</p>`}</div>`;
}
function battleView(){
 const m=state.battle;if(!m)return `<div class="card"><h2>No active match</h2><button class="btn" data-go="wizard">Start testing wizard</button></div>`;
 const done=m.aScore>=4||m.bScore>=4;
 return `<div class="card hero"><div class="scoreboard"><div><b>${m.a}</b><div class="score">${m.aScore}</div></div><div class="versus">VS</div><div><b>${m.b}</b><div class="score">${m.bScore}</div></div></div></div>
 ${done?`<div class="card"><h2>${m.aScore>m.bScore?m.a:m.b} wins</h2><div class="actions"><button class="btn good" data-save-match>Save match</button><button class="btn secondary" data-undo>Undo</button><button class="btn danger" data-discard>Discard</button></div></div>`:
 `<div class="card"><h3>${m.a}</h3>${finishButtons("a")}</div><div class="card"><h3>${m.b}</h3>${finishButtons("b")}</div><div class="actions"><button class="btn secondary" data-undo>Undo</button><button class="btn danger" data-discard>Cancel</button></div>`}
 <div class="card"><h3>Round history</h3>${m.rounds.length?`<div class="scroll"><table><tr><th>#</th><th>Winner</th><th>Finish</th><th>Pts</th><th>Own</th></tr>${m.rounds.map((r,i)=>`<tr><td>${i+1}</td><td>${r.side==="a"?m.a:m.b}</td><td>${r.finish}</td><td>${r.points}</td><td>${r.own?"Yes":""}</td></tr>`).join("")}</table></div>`:`<p class="muted">No rounds recorded.</p>`}</div>
 ${state.pending?ownModal():""}`;
}
function finishButtons(side){return `<div class="finish-grid">${[["Spin",1,"spin"],["Burst",2,"burst"],["Over",2,"over"],["Xtreme",3,"xtreme"]].map(x=>`<button class="finish ${x[2]}" data-finish="${side}|${x[0]}|${x[1]}">${x[0]}<small>${x[1]} point${x[1]>1?"s":""}</small></button>`).join("")}</div>`}
function ownModal(){return `<div class="modal"><div class="card"><h3>Own Finish?</h3><p class="muted">Yes only if the losing Bey entered the zone without contact.</p><div class="actions"><button class="btn secondary" data-own="false">No / contact</button><button class="btn danger" data-own="true">Yes</button></div></div></div>`}
function analyticsView(){
 const s=stats().sort((a,b)=>b.winRate-a.winRate||b.diff-a.diff),matrix=matchupMatrix(state.matches,state.history),parts=partPerformance(state.builds,s);
 const names=[...new Set(matrix.flatMap(x=>[x.a,x.b]))];
 return `<div class="card"><h2>Combo leaderboard</h2><div class="scroll"><table><tr><th>Combo</th><th>Record</th><th>Win %</th><th>Diff</th><th>Confidence</th></tr>${s.map(x=>`<tr><td>${x.name}</td><td>${x.w}-${x.l}</td><td>${(x.winRate*100).toFixed(1)}%</td><td>${x.diff>=0?"+":""}${x.diff}</td><td>${x.confidence}</td></tr>`).join("")}</table></div></div>
 <div class="card"><h2>Matchup matrix</h2><div class="scroll"><table class="matrix"><tr><th></th>${names.map(n=>`<th>${n}</th>`).join("")}</tr>${names.map(a=>`<tr><th class="rowlabel">${a}</th>${names.map(b=>{if(a===b)return"<td>—</td>";const x=matrix.find(m=>m.a===a&&m.b===b);if(!x)return"<td>—</td>";const c=x.rate>.55?"positive":x.rate<.45?"negative":"neutral";return`<td class="${c}">${(x.rate*100).toFixed(0)}%<br><span class="tiny">${x.w}-${x.l}</span></td>`}).join("")}</tr>`).join("")}</table></div></div>
 <div class="card"><h2>Part performance</h2><div class="scroll"><table><tr><th>Type</th><th>Part</th><th>Matches</th><th>Win %</th><th>Diff</th></tr>${parts.sort((a,b)=>b.matches-a.matches).map(x=>`<tr><td>${x.type}</td><td>${x.part}</td><td>${x.matches}</td><td>${(x.winRate*100).toFixed(1)}%</td><td>${x.diff>=0?"+":""}${x.diff}</td></tr>`).join("")}</table></div></div>
 ${s.map(x=>statCard(x)).join("")}`;
}
function statCard(x){const total=x.spin+x.burst+x.over+x.xtreme||1;return `<div class="card"><div class="queue-top"><div><h3>${x.name}</h3>${badge(x.readiness,x.readiness.includes("Validated")?"good":x.readiness==="Testing"?"warn":"")}</div><div><b>${(x.winRate*100).toFixed(1)}%</b><br><span class="tiny">${x.matches} matches</span></div></div>${[["Spin",x.spin],["Burst",x.burst],["Over",x.over],["Xtreme",x.xtreme]].map(([n,v])=>`<div class="statbar"><span>${n}</span><div class="bar"><div style="width:${v/total*100}%"></div></div><b>${v}</b></div>`).join("")}<p class="muted">Avg points: ${x.avgPoints.toFixed(2)} · KO rate: ${(x.koRate*100).toFixed(1)}% · Self-exit losses: ${x.self}</p></div>`}
function collectionView(){
 const filtered=state.parts.filter(x=>(state.partFilter==="All"||x.category===state.partFilter)&&x.name.toLowerCase().includes(state.filter.toLowerCase()));
 return `<div class="card"><h2>Collection manager</h2><div class="search-row"><input id="partSearch" placeholder="Search parts" value="${state.filter}"><select id="partCategory"><option>All</option><option>Blade</option><option>Ratchet</option><option>Bit</option></select></div><div class="actions"><button class="btn" data-add-part>Add part</button><button class="btn secondary" data-add-build>Add saved build</button></div></div>
 <div class="card"><div class="scroll"><table><tr><th>Category</th><th>Part</th><th>Qty</th><th>Source</th><th></th></tr>${filtered.sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name)).map(x=>`<tr><td>${x.category}</td><td>${x.name}</td><td>${x.qty}</td><td>${x.source||""}</td><td><button class="btn secondary" data-edit-part="${x.id}">Edit</button></td></tr>`).join("")}</table></div></div>
 <div class="card"><h2>Saved builds and history</h2>${state.builds.map(b=>`<div class="queue-item"><div class="queue-top"><div><b>${b.name}</b><br><span class="muted">${b.role||""}</span></div>${badge(b.status||"Candidate")}</div><p class="tiny">v${b.version||1} · ${b.blade} · ${b.ratchet} · ${b.bit}</p><div class="actions"><button class="btn secondary" data-edit-build="${b.id}">Edit</button><button class="btn danger" data-delete-build="${b.id}">Delete</button></div></div>`).join("")}</div>
 <div class="card"><h3>Backup</h3><div class="actions"><button class="btn" data-export>Export backup</button><button class="btn secondary" data-import>Import backup</button><button class="btn danger" data-reset>Reset database</button></div><input id="importFile" class="hidden" type="file" accept=".json"></div><div id="modal"></div>`;
}
function bind(){
 document.querySelectorAll("[data-go]").forEach(x=>x.onclick=()=>go(x.dataset.go));
 document.querySelectorAll("[data-start]").forEach(x=>x.onclick=()=>startTest(x.dataset.start));
 document.querySelectorAll("[data-delete-test]").forEach(x=>x.onclick=()=>deleteTest(x.dataset.deleteTest));
 document.querySelectorAll("[data-edit-test]").forEach(x=>x.onclick=()=>editTest(x.dataset.editTest));
 document.querySelectorAll("[data-finish]").forEach(x=>x.onclick=()=>{const [s,f,p]=x.dataset.finish.split("|");selectFinish(s,f,+p)});
 document.querySelectorAll("[data-own]").forEach(x=>x.onclick=()=>confirmOwn(x.dataset.own==="true"));
 document.querySelector("[data-undo]")?.addEventListener("click",undo);
 document.querySelector("[data-discard]")?.addEventListener("click",discard);
 document.querySelector("[data-save-match]")?.addEventListener("click",saveMatch);
 const se=document.querySelector("#startEvent");if(se)se.onclick=()=>startEventMatch();
 document.querySelectorAll("[data-wiz-next]").forEach(x=>x.onclick=()=>wizardNext(+x.dataset.wizNext));
 document.querySelectorAll("[data-wiz-back]").forEach(x=>x.onclick=()=>{state.wizard.step--;render()});
 document.querySelectorAll("[data-target]").forEach(x=>x.onclick=()=>{state.wizard.target=+x.dataset.target;render()});
 document.querySelector("[data-create-test]")?.addEventListener("click",createTest);
 document.querySelector("#partSearch")?.addEventListener("input",e=>{state.filter=e.target.value;render()});
 const pc=document.querySelector("#partCategory");if(pc){pc.value=state.partFilter;pc.onchange=e=>{state.partFilter=e.target.value;render()}}
 document.querySelector("[data-add-part]")?.addEventListener("click",()=>partModal());
 document.querySelectorAll("[data-edit-part]").forEach(x=>x.onclick=()=>partModal(x.dataset.editPart));
 document.querySelector("[data-add-build]")?.addEventListener("click",()=>buildModal());
 document.querySelectorAll("[data-edit-build]").forEach(x=>x.onclick=()=>buildModal(x.dataset.editBuild));
 document.querySelectorAll("[data-delete-build]").forEach(x=>x.onclick=()=>deleteBuild(x.dataset.deleteBuild));
 document.querySelector("[data-export]")?.addEventListener("click",exportBackup);
 document.querySelector("[data-import]")?.addEventListener("click",()=>document.querySelector("#importFile").click());
 document.querySelector("#importFile")?.addEventListener("change",importBackup);
 document.querySelector("[data-reset]")?.addEventListener("click",resetDB);
}
function startEventMatch(){
 const a=build(document.querySelector("#eventA").value),b=build(document.querySelector("#eventB").value);
 if(!a||!b)return alert("Choose both builds.");
 const err=pairIssue(a,b);if(err)return alert(err);
 state.battle={id:uid(),mode:"Tournament",stage:document.querySelector("#eventStage").value,a:a.name,b:b.name,aScore:0,bScore:0,rounds:[],startedAt:new Date().toISOString()};
 state.page="battle";render();
}
async function startTest(id){const t=state.tests.find(x=>x.id===id),a=build(t.focusId),b=build(t.opponentId),err=pairIssue(a,b);if(err)return alert(err);state.battle={id:uid(),mode:"Controlled Test",testId:id,a:a.name,b:b.name,aScore:0,bScore:0,rounds:[],startedAt:new Date().toISOString()};state.page="battle";render()}
function selectFinish(side,finish,points){navigator.vibrate?.(18);if(["Over","Xtreme"].includes(finish)){state.pending={side,finish,points};render()}else addRound(side,finish,points,false)}
function confirmOwn(own){const p=state.pending;state.pending=null;addRound(p.side,p.finish,p.points,own)}
function addRound(side,finish,points,own){state.battle.rounds.push({side,finish,points,own});side==="a"?state.battle.aScore+=points:state.battle.bScore+=points;render()}
function undo(){if(state.pending){state.pending=null;return render()}const r=state.battle?.rounds.pop();if(!r)return;r.side==="a"?state.battle.aScore-=r.points:state.battle.bScore-=r.points;render()}
function discard(){if(confirm("Discard this match?")){state.battle=null;render()}}
async function saveMatch(){const m=state.battle;m.winner=m.aScore>m.bScore?m.a:m.b;m.date=new Date().toISOString();await put("matches",m);const t=m.mode==="Controlled Test"?state.tests.find(x=>x.id===m.testId):null;if(t&&completed(t)+1>=t.target){t.status="Complete";await put("tests",t)}state.battle=null;state.page="home";await refresh()}
function wizardNext(step){if(step===1){state.wizard.focusId=document.querySelector("#wizFocus").value;state.wizard.step=2}else if(step===2){state.wizard.opponentId=document.querySelector("#wizOpponent").value;state.wizard.step=3}else{state.wizard.target=Math.max(1,+document.querySelector("#wizTarget").value||12);state.wizard.purpose=document.querySelector("#wizPurpose").value;state.wizard.step=4}render()}
async function createTest(){const w=state.wizard,t={id:uid(),focusId:w.focusId,opponentId:w.opponentId,target:w.target,status:"Active",priority:"High",purpose:w.purpose};for(const x of state.tests.filter(x=>x.status==="Active")){x.status="Paused";await put("tests",x)}await put("tests",t);state.wizard=null;await refresh();startTest(t.id)}
async function deleteTest(id){if(confirm("Delete test?")){await del("tests",id);await refresh()}}
function editTest(id){const t=state.tests.find(x=>x.id===id);state.wizard={step:1,focusId:t.focusId,opponentId:t.opponentId,target:t.target,purpose:t.purpose,editing:id};go("wizard")}
function partModal(id=null){const p=id?state.parts.find(x=>x.id===id):{id:uid(),category:"Blade",name:"",qty:1,source:""};document.querySelector("#modal").innerHTML=`<div class="modal"><div class="card"><h3>${id?"Edit":"Add"} part</h3><label>Category</label><select id="pmCat">${["Blade","Ratchet","Bit"].map(x=>`<option ${x===p.category?"selected":""}>${x}</option>`).join("")}</select><label>Name</label><input id="pmName" value="${p.name}"><label>Quantity</label><input id="pmQty" type="number" min="0" value="${p.qty}"><label>Source</label><input id="pmSource" value="${p.source||""}"><div class="actions"><button class="btn" id="pmSave">Save</button>${id?`<button class="btn danger" id="pmDelete">Delete</button>`:""}<button class="btn secondary" id="pmCancel">Cancel</button></div></div></div>`;document.querySelector("#pmSave").onclick=async()=>{const x={id:p.id,category:pmCat.value,name:pmName.value.trim(),qty:Math.max(0,+pmQty.value||0),source:pmSource.value};if(!x.name)return alert("Enter a name.");await put("parts",x);await refresh()};document.querySelector("#pmCancel").onclick=()=>render();if(id)document.querySelector("#pmDelete").onclick=async()=>{const inUse=state.builds.some(b=>[b.blade,b.ratchet,b.bit].includes(p.name));if(inUse)return alert("This part is used by a saved build. Edit or delete that build first.");await del("parts",p.id);await refresh()}}
function buildModal(id=null){const b=id?state.builds.find(x=>x.id===id):{id:uid(),blade:state.parts.find(x=>x.category==="Blade")?.name,ratchet:state.parts.find(x=>x.category==="Ratchet")?.name,bit:state.parts.find(x=>x.category==="Bit")?.name,role:"",status:"Experimental",slot:""};const options=cat=>state.parts.filter(x=>x.category===cat&&x.qty>0).map(x=>`<option ${x.name===b[cat.toLowerCase()]?"selected":""}>${x.name}</option>`).join("");document.querySelector("#modal").innerHTML=`<div class="modal"><div class="card"><h3>${id?"Edit":"Add"} build</h3><label>Blade</label><select id="bmBlade">${options("Blade")}</select><label>Ratchet</label><select id="bmRatchet">${options("Ratchet")}</select><label>Bit</label><select id="bmBit">${options("Bit")}</select><label>Role</label><input id="bmRole" value="${b.role||""}"><label>Status</label><select id="bmStatus">${["Experimental","Benchmark","Tournament Candidate","Validated","Rejected","Test Bey"].map(x=>`<option ${x===b.status?"selected":""}>${x}</option>`).join("")}</select><label>Deck slot</label><select id="bmSlot">${["","Bey 1","Bey 2","Bey 3","Test Bey"].map(x=>`<option ${x===b.slot?"selected":""}>${x||"None"}</option>`).join("")}</select><div class="actions"><button class="btn" id="bmSave">Save</button><button class="btn secondary" id="bmCancel">Cancel</button></div></div></div>`;document.querySelector("#bmSave").onclick=async()=>{const changed=id&&(b.blade!==bmBlade.value||b.ratchet!==bmRatchet.value||b.bit!==bmBit.value);
const x=changed?{...b,id:uid(),parentId:b.parentId||b.id,version:(b.version||1)+1,blade:bmBlade.value,ratchet:bmRatchet.value,bit:bmBit.value,role:bmRole.value,status:bmStatus.value,slot:bmSlot.value}:{...b,blade:bmBlade.value,ratchet:bmRatchet.value,bit:bmBit.value,role:bmRole.value,status:bmStatus.value,slot:bmSlot.value};
x.name=comboName(x);if(x.slot)for(const other of state.builds.filter(y=>y.id!==x.id&&y.slot===x.slot)){other.slot="";await put("builds",other)}await put("builds",x);await put("history",{id:uid(),type:"build-change",buildId:x.id,timestamp:new Date().toISOString(),snapshot:x});await refresh()};document.querySelector("#bmCancel").onclick=()=>render()}
async function deleteBuild(id){if(state.tests.some(t=>t.focusId===id||t.opponentId===id))return alert("This build is used by a test. Delete or edit the test first.");if(confirm("Delete saved build?")){await del("builds",id);await refresh()}}
async function exportBackup(){const data=await exportAll();const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="beylab-v4-backup.json";a.click()}
async function importBackup(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=async()=>{try{await importAll(JSON.parse(r.result));await refresh()}catch{alert("Invalid backup.")}};r.readAsText(f)}
async function resetDB(){if(!confirm("Erase all app data and restore defaults?"))return;for(const s of["settings","parts","builds","matches","tests","history"])await clearStore(s);await seed();await refresh()}
addEventListener("load",async()=>{if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js");await seed();await refresh()});
