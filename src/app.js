import {DATA_VERSION,APP_NAME,defaultSettings,products,archetypes,launchProfiles,stadiumProfiles,officialRules} from "./data.js";
import {fastOptimize,exactDeckCount,confidence,planTests,directives,evidenceMatrix,serializeDeck,allBladeAssemblies} from "./engine.js";
import {read,write} from "./storage.js";
import {round} from "./math.js";

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const STORE={settings:"settings",batches:"batches",logs:"logs"};
const SMOKE_MODE=new URLSearchParams(location.search).has("smoke");
let settings={...defaultSettings,...read(STORE.settings,{})};
let batches=read(STORE.batches,[]),logs=read(STORE.logs,[]);
let result=null,currentDeck=null,alternatives=[],activeLab=null,searchWorker=null,labWorker=null,working=false,session=null,deferredInstall=null;
const exact=exactDeckCount();

function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function pct(x){return`${Math.round((x||0)*100)}%`}
function idx(x){return`${Math.round((x||0)*100)}`}
function fmt(n){return Number(n||0).toLocaleString()}
function toast(text){const el=$("#toast");el.textContent=text;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2800)}
function log(text){const row={time:new Date().toISOString(),text};logs.push(row);logs=logs.slice(-180);write(STORE.logs,logs);renderLog()}
function setCoach(state,text){const el=$("#coachState");el.className=`status ${state}`;el.querySelector("b").textContent=text}
function setProgress(value,text){$("#progressBar").style.width=`${Math.max(0,Math.min(1,value))*100}%`;$("#statusText").textContent=text}
function setWorking(value){working=value;$("#stopWork").classList.toggle("hidden",!value);$("#stopLab").classList.toggle("hidden",!labWorker);["runAutopilot","runFast","runDeep","runLab"].forEach(id=>$("#"+id).disabled=value)}

function initTabs(){
  $$(".tab").forEach(t=>t.onclick=()=>switchView(t.dataset.view));
}
function switchView(id){$$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===id));$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));scrollTo({top:0,behavior:"smooth"})}

function initSettings(){
  $("#autopilot").checked=settings.autopilot;$("#searchMode").value=settings.searchMode;$("#labMatches").value=settings.labMatches;$("#batchSize").value=settings.testBatchSize;
  $("#autopilot").onchange=e=>saveSetting("autopilot",e.target.checked);
  $("#searchMode").onchange=e=>saveSetting("searchMode",e.target.value);
  $("#labMatches").onchange=e=>saveSetting("labMatches",Math.max(1000,Math.min(50000,Number(e.target.value)||12000)));
  $("#batchSize").onchange=e=>saveSetting("testBatchSize",Math.max(2,Math.min(12,Number(e.target.value)||4)));
}
function saveSetting(key,value){settings[key]=value;write(STORE.settings,settings);toast("Setting saved")}

function runSearch(mode=settings.searchMode,runLabAfter=false){
  stopWorkers(false);settings.searchMode=mode;write(STORE.settings,settings);$("#searchMode").value=mode;setWorking(true);setCoach("running",mode==="deep"?"Deep audit":"Optimizing");setProgress(0,mode==="deep"?`Preparing exhaustive audit of ${fmt(exact.total)} legal allocations…`:"Building a dominance-screened candidate set…");
  log(`${mode==="deep"?"Deep exhaustive":"Fast"} search started.`);
  searchWorker=new Worker("./src/optimizer-worker.js",{type:"module"});
  searchWorker.onmessage=e=>{
    const m=e.data;
    if(m.type==="progress"){
      const text=mode==="deep"?`${fmt(m.screened)} / ${fmt(exact.total)} allocations evaluated · blade triples ${m.bladeTriplesDone||0}/${m.bladeTriplesTotal||exact.bladeTriples}`:`${fmt(m.screened)} candidate decks screened · ${fmt(m.legal)} legal`;
      setProgress(m.progress||0,text);return;
    }
    if(m.type==="error"){setCoach("error","Search error");setWorking(false);log(m.message);toast("Search failed; see audit trace");return}
    if(m.type==="stopped"){setCoach("","Stopped");setWorking(false);setProgress(0,"Stopped by user.");log("Search stopped.");return}
    if(m.type==="done"){
      result=m.result;currentDeck=result.decks[0]||null;alternatives=result.decks.slice(1);searchWorker.terminate();searchWorker=null;setWorking(false);setProgress(1,`${fmt(result.screened)} legal allocation candidates evaluated.`);setCoach("ready",result.search.complete?"Exact audit complete":"Fast result ready");
      log(`${result.search.mode} completed. Top decision score ${round(currentDeck?.metrics.score||0,2)}.`);renderAll();
      if(runLabAfter||settings.autopilot)runTournamentLab();
    }
  };
  searchWorker.postMessage({type:"search",mode,settings,batches});
}

function runTournamentLab(){
  if(!result?.decks?.length)return toast("Build a deck first");
  if(labWorker)labWorker.terminate();labWorker=new Worker("./src/lab-worker.js",{type:"module"});setWorking(true);setCoach("running","Running lab");setProgress(0,"Evaluating all six blind orders and adaptive reorder cycles…");$("#stopLab").classList.remove("hidden");
  const shortlist=result.decks.slice(0,Math.min(10,result.decks.length));log(`Scenario lab started for ${shortlist.length} decks × 6 first orders × ${fmt(settings.labMatches)} matches.`);
  labWorker.onmessage=e=>{
    const m=e.data;if(m.type==="progress"){setProgress(m.progress,`${fmt(m.work)} / ${fmt(m.totalWork)} modeled matches`);return}
    if(m.type==="error"){setCoach("error","Lab error");log(m.message);finishLabWorker();return}
    if(m.type==="stopped"){setCoach("","Stopped");log("Scenario lab stopped.");finishLabWorker();return}
    if(m.type==="done"){
      const byId=new Map(m.result.results.map(x=>[x.deckId,x]));for(const d of result.decks)d.lab=byId.get(d.id)||null;
      // Lab is a tie-breaker only. It cannot override a materially stronger evidence-led decision score.
      result.decks.sort((a,b)=>(b.metrics.score+(b.lab?.robustness||0)*1.2+(b.lab?.diff||0)*.12)-(a.metrics.score+(a.lab?.robustness||0)*1.2+(a.lab?.diff||0)*.12));
      currentDeck=result.decks[0];alternatives=result.decks.slice(1);activeLab=currentDeck.lab||null;log(`Scenario lab completed. Best blind order: ${activeLab?activeLab.bestOrder.map(i=>i+1).join("-"):"n/a"}.`);setCoach("ready","Coach ready");setProgress(1,"Auto-Pilot cycle complete.");finishLabWorker(false);renderAll();
    }
  };
  labWorker.postMessage({type:"run",decks:shortlist,matches:SMOKE_MODE?120:settings.labMatches,seed:settings.seed});
}
function finishLabWorker(reset=true){if(labWorker){labWorker.terminate();labWorker=null}setWorking(false);$("#stopLab").classList.add("hidden");if(reset)setProgress(0,"Waiting.")}
function stopWorkers(message=true){if(searchWorker){searchWorker.terminate();searchWorker=null}if(labWorker){labWorker.terminate();labWorker=null}setWorking(false);setCoach("","Stopped");setProgress(0,"Stopped by user.");if(message)toast("Coach stopped")}

function renderAll(){renderCommand();renderDeck();renderLab();renderTests();renderEvidence();renderCollection();renderAudit()}
function renderCommand(){
  $("#comboCount").textContent=fmt(result?.search.comboSpace||0);$("#exactCount").textContent=fmt(exact.total);$("#screenedCount").textContent=fmt(result?.screened||0);$("#searchStatus").textContent=result?.search.complete?"Exhaustive":"Screened";
  const games=batches.reduce((s,x)=>s+Number(x.games||0),0);$("#gamesStat").textContent=fmt(games);
  if(!currentDeck){$("#verdict").textContent="No deck generated";return}
  const conf=confidence(currentDeck,batches),weak=currentDeck.metrics.matchup.slice().sort((a,b)=>a.lowBackup-b.lowBackup)[0];
  $("#confidenceBadge").textContent=conf.label;$("#verdict").textContent=conf.label==="Hypothesis"?"Strongest current hypothesis—not yet proven":`${conf.label} owned-parts recommendation`;
  $("#verdictText").textContent=`Decision score ${round(currentDeck.metrics.score,1)}/100. The coach prioritizes backup coverage, the weakest matchup, critical-finish access on every Bey, and physical evidence.`;
  $("#backupStat").textContent=idx(currentDeck.metrics.lowBackup);$("#weakStat").textContent=`${idx(weak.lowBackup)} · ${weak.name}`;$("#criticalStat").textContent=idx(currentDeck.metrics.criticalFloor);$("#controlStat").textContent=idx(currentDeck.metrics.control);
  $("#deckStrip").innerHTML=currentDeck.combos.map((c,i)=>`<div class="mini-bey"><b>${i+1}. ${esc(c.name)}</b><span>${esc(c.role)} · critical ${idx(c.critical)}/100</span></div>`).join("");
  $("#directives").innerHTML=directives(currentDeck,alternatives,batches).map((x,i)=>`<div class="directive"><b>${String(i+1).padStart(2,"0")}</b><span>${esc(x)}</span></div>`).join("");
}
function renderDeck(){
  if(!currentDeck){$("#deckCards").innerHTML="";return}
  $("#deckCards").innerHTML=currentDeck.combos.map((c,i)=>`<article class="panel deck-card"><span class="index">${i+1}</span><div class="combo-title">${esc(c.name)}</div><div class="parts">${c.blade.components.map(esc).join(" · ")} · ${c.ratchet?esc(c.ratchet.name):"ratchet integrated"} · ${esc(c.bit.name)}</div><div class="chip-row"><span class="chip">${esc(c.role)}</span><span class="chip">${esc(c.launch.primary)}</span><span class="chip">${esc(c.dominantFinish)} route</span></div><div class="card-metrics"><div><span>Critical access</span><strong>${idx(c.critical)}/100</strong></div><div><span>Self-KO control</span><strong>${idx(1-c.selfKO.mean)}/100</strong></div><div><span>Evidence games</span><strong>${fmt(c.evidenceGames)}</strong></div><div><span>Primary launch</span><strong>${esc(c.launch.primary.replaceAll("-"," "))}</strong></div></div></article>`).join("");
  $("#matrix").innerHTML=`<table><thead><tr><th>Stress profile</th><th>Primary</th><th>Backup</th><th>Floor</th><th>Conservative backup</th></tr></thead><tbody>${currentDeck.metrics.matchup.map(x=>`<tr><td>${esc(x.name)}</td>${[x.primary,x.backup,x.floor,x.lowBackup].map(v=>`<td><div class="signal-cell"><span>${idx(v)}</span><div class="meter"><i style="width:${v*100}%"></i></div></div></td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const order=activeLab?.bestOrder||[0,1,2];$("#orderDoctrine").innerHTML=`<p><strong>Blind first cycle:</strong> ${order.map(i=>`${i+1}. ${esc(currentDeck.combos[i].name)}`).join(" → ")}.</p><p>After the first three battles, Regulation 12 permits both players to rebuild the order if neither has reached four points. The lab therefore recalculates an adaptive best response rather than blindly repeating the first cycle.</p><p><strong>Launch discipline:</strong> ${currentDeck.combos.map(c=>`${esc(c.name)} — ${esc(c.launch.primary)}`).join("; ")}.</p>`;
  $("#alternatives").innerHTML=alternatives.slice(0,8).map((d,i)=>`<div class="alt-row"><div><strong>${i+2}. ${d.combos.map(c=>esc(c.name)).join(" / ")}</strong><div class="muted">Backup ${idx(d.metrics.lowBackup)} · worst backup ${idx(d.metrics.worstBackup)} · critical floor ${idx(d.metrics.criticalFloor)}</div></div><span class="score">${round(d.metrics.score,1)}</span><button class="button ghost small" data-adopt="${i}">Inspect</button></div>`).join("")||'<p class="muted">No alternatives available.</p>';
  $$('[data-adopt]').forEach(b=>b.onclick=()=>{const d=alternatives[Number(b.dataset.adopt)];const old=currentDeck;currentDeck=d;alternatives=[old,...alternatives.filter(x=>x!==d)];activeLab=currentDeck.lab||null;renderAll();toast("Alternative loaded for inspection")});
}
function renderLab(){
  const l=activeLab;if(!l){["labRate","labOrder","labDiff","labRobust","labBattles"].forEach(id=>$("#"+id).textContent="—");$("#labRange").textContent="No lab result";$("#labBars").innerHTML='<p class="muted">Run the scenario lab after building a deck.</p>';return}
  $("#labRate").textContent=pct(l.rate);$("#labRange").textContent=`90% Monte Carlo interval ${pct(l.low)}–${pct(l.high)}`;$("#labOrder").textContent=l.bestOrder.map(i=>i+1).join(" → ");$("#labDiff").textContent=(l.diff>=0?"+":"")+round(l.diff,2);$("#labRobust").textContent=pct(l.robustness);$("#labBattles").textContent=round(l.avgBattles,1);
  $("#labBars").innerHTML=archetypes.map(a=>{const x=l.profileRates[a.id]||{rate:0,n:0,diff:0};return`<div class="bar-row"><span>${esc(a.name)}</span><div class="bar"><div style="width:${x.rate*100}%"></div></div><span class="interval">${pct(x.rate)} · Δ ${round(x.diff,2)}</span></div>`}).join("");
}
function renderLog(){$("#console").innerHTML=logs.slice().reverse().map(x=>`<div class="logline"><b>${new Date(x.time).toLocaleTimeString()}</b> ${esc(x.text)}</div>`).join("")||"No audit events."}

function currentPlan(){return planTests(currentDeck,alternatives,batches,settings.testBatchSize)}
function renderTests(){
  const plan=currentPlan();$("#testPlan").innerHTML=plan.map((x,i)=>`<article class="test-card"><span class="priority">PRIORITY ${i+1} · ${esc(x.kind.toUpperCase())}</span><h3>${esc(x.comboName)}</h3><p class="muted">vs ${esc(x.opponentName)}</p><div class="test-meta"><div><span>Batch</span><strong>${x.games} battles</strong></div><div><span>Position</span><strong>Auto-alternate</strong></div><div><span>Launch</span><strong>${esc(x.launch)}</strong></div><div><span>Fallback launch</span><strong>${esc(x.alternateLaunch)}</strong></div></div><p class="prose">${esc(x.purpose)}</p><button class="button primary small" data-session="${i}">Start guided batch</button></article>`).join("")||'<div class="notice">Build a deck to generate an adaptive test queue.</div>';
  $$('[data-session]').forEach(b=>b.onclick=()=>startSession(plan[Number(b.dataset.session)]));renderSession();
}
function startSession(plan){session={plan,results:[]};switchView("tests");renderSession();$("#sessionPanel").scrollIntoView({behavior:"smooth",block:"start"})}
function sessionPosition(){if(!session)return"—";const first=session.plan.position||"left";return session.results.length%2===0?first:(first==="left"?"right":"left")}
function renderSession(){
  $("#sessionPanel").classList.toggle("hidden",!session);if(!session)return;const{plan,results}=session;$("#sessionTitle").textContent=plan.comboName;$("#sessionOpponent").textContent=plan.opponentName;$("#sessionLaunch").textContent=plan.launch;$("#sessionPosition").textContent=sessionPosition().toUpperCase();$("#sessionKind").textContent=plan.kind;$("#sessionPurpose").textContent=plan.purpose;$("#sessionProgress").textContent=`${results.length} / ${plan.games}`;$("#undoSession").disabled=!results.length;
}
function recordSession(value){if(!session)return;const position=sessionPosition(),[outcome,finish]=value.split(":");session.results.push({outcome,finish,position,time:new Date().toISOString()});if(session.results.length>=session.plan.games)commitSession();else renderSession()}
function commitSession(){
  const{plan,results}=session,wins=results.filter(x=>x.outcome==="win"),winFinishes={spin:0,over:0,burst:0,xtreme:0},lossFinishes={spin:0,over:0,burst:0,xtreme:0};let selfKOs=0;
  for(const r of results){if(r.finish==="selfko"){selfKOs++;continue}(r.outcome==="win"?winFinishes:lossFinishes)[r.finish]++}
  batches.push({id:crypto.randomUUID?.()||String(Date.now()),plannedTestId:plan.id,comboId:plan.comboId,opponentArchetype:plan.opponentArchetype,games:results.length,wins:wins.length,losses:results.length-wins.length,winFinishes,lossFinishes,selfKOs,launchProfile:plan.launch,position:"alternating",stadium:"xtreme",notes:`Guided ${plan.kind} batch`,battleLog:results,date:new Date().toISOString()});
  write(STORE.batches,batches);session=null;renderSession();toast("Batch committed; Auto-Pilot rescoring");runSearch("fast",settings.autopilot);
}

function renderEvidence(){
  const combos=result?.combos||[];const selected=$("#eCombo").value,deckIds=new Set(currentDeck?.combos.map(c=>c.id)||[]);$("#eCombo").innerHTML=combos.slice().sort((a,b)=>(deckIds.has(b.id)?1:0)-(deckIds.has(a.id)?1:0)||a.name.localeCompare(b.name)).map(c=>`<option value="${c.id}">${deckIds.has(c.id)?"★ ":""}${esc(c.name)}</option>`).join("");if(combos.some(c=>c.id===selected))$("#eCombo").value=selected;
  $("#eArch").innerHTML=archetypes.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");$("#eLaunch").innerHTML=launchProfiles.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("");$("#eStadium").innerHTML=stadiumProfiles.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("");
  const games=batches.reduce((s,x)=>s+Number(x.games||0),0),wins=batches.reduce((s,x)=>s+Number(x.wins||0),0),self=batches.reduce((s,x)=>s+Number(x.selfKOs||0),0),cells=new Set(batches.map(x=>`${x.comboId}|${x.opponentArchetype}`)).size;
  $("#evidenceSummary").innerHTML=[["Logged battles",games],["Observed battle wins",games?`${Math.round(wins/games*100)}%`:"0%"],["Covered cells",cells],["Self-KO / errors",self],["Deck status",currentDeck?confidence(currentDeck,batches).label:"—"]].map(([a,b])=>`<article class="panel stat evidence-summary-card"><span>${a}</span><strong>${b}</strong></article>`).join("");
  const map=new Map(combos.map(c=>[c.id,c]));$("#history").innerHTML=batches.slice().reverse().map((x,ri)=>{const idx=batches.length-1-ri,a=archetypes.find(a=>a.id===x.opponentArchetype);return`<div class="history-row"><div><strong>${esc(map.get(x.comboId)?.name||"Archived combination")}</strong><div class="muted">${x.games} battles · ${x.wins} wins · vs ${esc(a?.name||x.opponentArchetype)} · ${esc(x.launchProfile||"launch not recorded")} · ${esc(x.notes||"")}</div></div><strong>${x.wins}/${x.games}</strong><button class="button danger small" data-delete="${idx}">Delete</button></div>`}).join("")||'<div class="notice">No physical evidence logged. The recommendation must remain a hypothesis.</div>';
  $$('[data-delete]').forEach(b=>b.onclick=()=>{batches.splice(Number(b.dataset.delete),1);write(STORE.batches,batches);runSearch("fast",false)});
}
function renderCollection(){
  $("#productGrid").innerHTML=products.map(p=>`<article class="panel product-card"><span class="code">${esc(p.code)}</span><h3>${esc(p.name)}</h3><ul>${p.contributes.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>${p.note?`<p class="note">${esc(p.note)}</p>`:""}</article>`).join("");
  const assemblies=allBladeAssemblies();$("#spaceAudit").innerHTML=[["Blade assemblies",assemblies.length],["Legal combinations",result?.search.comboSpace||2025],["Legal blade triples",exact.bladeTriples],["Legal deck allocations",fmt(exact.total)]].map(([a,b])=>`<div><span>${a}</span><strong>${b}</strong></div>`).join("");
}
function renderAudit(){$("#version").textContent=`Data ${DATA_VERSION}`}

function initActions(){
  $("#runAutopilot").onclick=()=>runSearch(settings.searchMode,true);$("#runFast").onclick=()=>runSearch("fast",false);$("#runDeep").onclick=()=>runSearch("deep",false);$("#runLab").onclick=runTournamentLab;$("#stopWork").onclick=()=>stopWorkers();$("#stopLab").onclick=()=>stopWorkers();
  $("#refreshTests").onclick=()=>{renderTests();toast("Adaptive queue recalculated")};$$("[data-result]").forEach(b=>b.onclick=()=>recordSession(b.dataset.result));$("#undoSession").onclick=()=>{if(session?.results.length){session.results.pop();renderSession()}};$("#abortSession").onclick=()=>{session=null;renderSession();toast("Batch discarded")};
  $("#copyDeck").onclick=async()=>{if(!currentDeck)return;await navigator.clipboard.writeText(serializeDeck(currentDeck));toast("Deck copied")};$("#clearLog").onclick=()=>{logs=[];write(STORE.logs,logs);renderLog()};
  $("#exportReport").onclick=()=>{if(!currentDeck)return;download("x-deck-lab-v3-report.json",{app:APP_NAME,version:DATA_VERSION,generatedAt:new Date().toISOString(),rules:officialRules,search:result.search,deck:{score:currentDeck.metrics.score,confidence:confidence(currentDeck,batches),combos:currentDeck.combos.map(c=>({name:c.name,components:c.blade.components,ratchet:c.ratchet?.name||"integrated",bit:c.bit.name,role:c.role,launch:c.launch,critical:c.critical,evidenceGames:c.evidenceGames})),metrics:currentDeck.metrics,lab:activeLab},directives:directives(currentDeck,alternatives,batches),nextTests:currentPlan(),evidence:{batches:batches.length,games:batches.reduce((s,x)=>s+Number(x.games||0),0)}})};
  $("#exportData").onclick=()=>download("x-deck-lab-v3-backup.json",{schema:3,version:DATA_VERSION,settings,batches});$("#importData").onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());if(!Array.isArray(d.batches))throw Error("Invalid V3 backup");batches=d.batches;settings={...defaultSettings,...d.settings};write(STORE.batches,batches);write(STORE.settings,settings);location.reload()}catch(err){toast(err.message)}};
  $("#clearEvidence").onclick=()=>{if(confirm("Delete all physical evidence from this device?")){batches=[];write(STORE.batches,batches);runSearch("fast",false)}};
  $("#evidenceForm").onsubmit=e=>{e.preventDefault();const games=Number($("#eGames").value),wins=Number($("#eWins").value),winFinishes={spin:Number($("#eSpin").value),over:Number($("#eOver").value),burst:Number($("#eBurst").value),xtreme:Number($("#eXtreme").value)},finishWins=Object.values(winFinishes).reduce((s,x)=>s+x,0),selfKOs=Number($("#eSelfKO").value);if(wins>games)return toast("Wins cannot exceed games");if(finishWins>wins)return toast("Finish-win counts cannot exceed wins");if(selfKOs>games-wins)return toast("Self-KO losses cannot exceed total losses");batches.push({id:crypto.randomUUID?.()||String(Date.now()),comboId:$("#eCombo").value,opponentArchetype:$("#eArch").value,games,wins,losses:games-wins,winFinishes,selfKOs,launchProfile:$("#eLaunch").value,position:$("#ePosition").value,stadium:$("#eStadium").value,notes:$("#eNotes").value.trim(),date:new Date().toISOString()});write(STORE.batches,batches);toast("Evidence committed; coach rescoring");runSearch("fast",settings.autopilot)};
}
function download(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function initPwa(){if(!SMOKE_MODE&&"serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js");window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("#installBtn").classList.remove("hidden")});$("#installBtn").onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("#installBtn").classList.add("hidden")}}

initTabs();initSettings();initActions();initPwa();renderLog();renderCollection();renderAudit();setCoach("running","Initializing");
if(SMOKE_MODE){const r=fastOptimize({...settings,fastBreadth:90,shortlistSize:8},batches);result=r;currentDeck=r.decks[0];alternatives=r.decks.slice(1);setCoach("ready","Smoke ready");renderAll()}else runSearch("fast",false);
