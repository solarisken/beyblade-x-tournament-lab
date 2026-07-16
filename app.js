const OWNED = {
  blades:[
    ["DranStrike","BX-49"],["PhoenixWing","BX-23"],["ImpactDrake","UX-11"],["SilverWolf","UX-08"],
    ["ScorpioSpear","UX-14"],["BulletGriffon","UX-19"],["BahamutBlitz BK","CX-16"],
    ["SolEclipse D","CX-09"],["WolfHunt F","CX-10"]
  ],
  ratchets:[["Integrated",1],["0-60",1],["0-70",1],["1-50",1],["3-80",1],["4-50",1],["5-70",1],["9-60",2]],
  bits:["Disc Ball","Free Ball","Free Flat","Gear Flat","Hexa","Ignition","Low Rush","Trans Kick","Zap"]
};
const DEFAULT = {
  deck:[
    {slot:"Bey 1",blade:"DranStrike",ratchet:"1-50",bit:"Low Rush",role:"Primary attacker"},
    {slot:"Bey 2",blade:"SilverWolf",ratchet:"9-60",bit:"Hexa",role:"Defense"},
    {slot:"Bey 3",blade:"PhoenixWing",ratchet:"9-60",bit:"Gear Flat",role:"Secondary attacker"},
    {slot:"Test Bey",blade:"BahamutBlitz BK",ratchet:"0-70",bit:"Ignition",role:"Balance / counter"}
  ],
  matches:[],
  historical:[
    {a:"DranStrike 1-50 Low Rush",b:"SilverWolf 9-60 Hexa",aWins:7,bWins:5,aSpin:2,aBurst:0,aOver:12,aXtreme:5,bSpin:22,bBurst:0,bOver:4,bXtreme:0},
    {a:"DranStrike 1-50 Low Rush",b:"PhoenixWing 9-60 Gear Flat",aWins:7,bWins:5,aSpin:12,aBurst:1,aOver:6,aXtreme:3,bSpin:10,bBurst:0,bOver:2,bXtreme:3}
  ],
  activeTest:{focus:0,opponent:3,target:12}
};
let state = loadState();
let page = "home";
let battle = null;
let pendingFinish = null;

function loadState(){
  try{return JSON.parse(localStorage.getItem("beylab-pwa-state")) || structuredClone(DEFAULT)}
  catch(e){return structuredClone(DEFAULT)}
}
function saveState(){localStorage.setItem("beylab-pwa-state",JSON.stringify(state))}
function comboName(x){return `${x.blade} ${x.ratchet} ${x.bit}`}
function allCombos(){return state.deck.map(comboName)}
function officialPoints(type){return {Spin:1,Burst:2,Over:2,Xtreme:3}[type]||0}
function uid(){return crypto.randomUUID ? crypto.randomUUID() : Date.now()+"-"+Math.random()}
function partConflict(){
  const issues=[];
  const deck=state.deck.slice(0,3);
  const ratCounts={}; const bitCounts={}; const bladeCounts={};
  deck.forEach(x=>{
    bladeCounts[x.blade]=(bladeCounts[x.blade]||0)+1;
    ratCounts[x.ratchet]=(ratCounts[x.ratchet]||0)+1;
    bitCounts[x.bit]=(bitCounts[x.bit]||0)+1;
    if(x.blade==="BulletGriffon"&&x.ratchet!=="Integrated")issues.push("BulletGriffon requires Integrated ratchet.");
    if(x.blade!=="BulletGriffon"&&x.ratchet==="Integrated")issues.push("Integrated ratchet is BulletGriffon-only.");
  });
  Object.entries(bladeCounts).forEach(([p,n])=>{if(n>1)issues.push(`${p} used ${n} times; owned 1.`)});
  Object.entries(ratCounts).forEach(([p,n])=>{
    const qty=(OWNED.ratchets.find(x=>x[0]===p)||[p,1])[1];
    if(n>qty)issues.push(`${p} used ${n} times; owned ${qty}.`);
  });
  Object.entries(bitCounts).forEach(([p,n])=>{if(n>1)issues.push(`${p} used ${n} times; owned 1.`)});
  return [...new Set(issues)];
}
function selectedPairAvailable(a,b){
  if(a===b)return "Choose different slots.";
  const x=state.deck[a], y=state.deck[b];
  if(x.blade===y.blade)return `Only one ${x.blade} blade is owned.`;
  if(x.ratchet===y.ratchet){
    const qty=(OWNED.ratchets.find(r=>r[0]===x.ratchet)||[x.ratchet,1])[1];
    if(qty<2)return `Only one ${x.ratchet} ratchet is owned.`;
  }
  if(x.bit===y.bit)return `Only one ${x.bit} bit is owned.`;
  return "";
}
function aggregate(){
  const map={};
  function add(name,w,l,sp,bu,ov,xt,pts,against){
    if(!map[name])map[name]={name,w:0,l:0,spin:0,burst:0,over:0,xtreme:0,points:0,against:0,matches:0};
    const x=map[name]; x.w+=w;x.l+=l;x.matches+=w+l;x.spin+=sp;x.burst+=bu;x.over+=ov;x.xtreme+=xt;x.points+=pts;x.against+=against;
  }
  state.historical.forEach(s=>{
    const ap=s.aSpin+2*s.aBurst+2*s.aOver+3*s.aXtreme;
    const bp=s.bSpin+2*s.bBurst+2*s.bOver+3*s.bXtreme;
    add(s.a,s.aWins,s.bWins,s.aSpin,s.aBurst,s.aOver,s.aXtreme,ap,bp);
    add(s.b,s.bWins,s.aWins,s.bSpin,s.bBurst,s.bOver,s.bXtreme,bp,ap);
  });
  state.matches.forEach(m=>{
    const aW=m.winner===m.a?1:0,bW=m.winner===m.b?1:0;
    const count=(side,type)=>m.rounds.filter(r=>r.side===side&&r.finish===type).length;
    add(m.a,aW,bW,count("a","Spin"),count("a","Burst"),count("a","Over"),count("a","Xtreme"),m.aScore,m.bScore);
    add(m.b,bW,aW,count("b","Spin"),count("b","Burst"),count("b","Over"),count("b","Xtreme"),m.bScore,m.aScore);
  });
  return Object.values(map).map(x=>({...x,winRate:x.matches?x.w/x.matches:0,diff:x.points-x.against}));
}
function nav(){
  return `<nav>${[
    ["home","⌂","Home"],["battle","⚔","Battle"],["deck","◈","Deck"],["analytics","▥","Analytics"],["data","⚙","Data"]
  ].map(([id,icon,label])=>`<button class="${page===id?"active":""}" onclick="go('${id}')"><span>${icon}</span>${label}</button>`).join("")}</nav>`;
}
function header(sub){
  return `<header><h1>Personal Beyblade X Tournament Lab</h1><p>${sub}</p></header>`;
}
function render(){
  const app=document.getElementById("app");
  const views={home:homeView,battle:battleView,deck:deckView,analytics:analyticsView,data:dataView};
  app.innerHTML=header(page==="battle"?"First-to-4 one-tap scoring":"Owned-parts tournament testing and analytics")+`<main>${views[page]()}</main>`+nav();
}
function go(id){page=id;render()}

function homeView(){
  const a=aggregate().find(x=>x.name==="DranStrike 1-50 Low Rush");
  const test=state.activeTest;
  const completed=state.matches.filter(m=>
    (m.a===comboName(state.deck[test.focus])&&m.b===comboName(state.deck[test.opponent]))||
    (m.b===comboName(state.deck[test.focus])&&m.a===comboName(state.deck[test.opponent]))
  ).length;
  const remain=Math.max(0,test.target-completed);
  const issues=partConflict();
  return `
  <div class="card">
    <h2>Current decision</h2>
    <div class="notice"><b>Keep DranStrike 1-50 Low Rush unchanged.</b><br>
    Existing evidence: ${a?`${a.w}-${a.l}, ${(a.winRate*100).toFixed(1)}% win rate, ${a.diff>=0?"+":""}${a.diff} point differential`:"No data"}.</div>
  </div>
  <div class="grid">
    <div class="metric"><b>${a?a.matches:0}</b><span>DranStrike matches</span></div>
    <div class="metric"><b>${a?(a.winRate*100).toFixed(1)+"%":"—"}</b><span>DranStrike win rate</span></div>
    <div class="metric"><b>${state.matches.length}</b><span>New matches saved</span></div>
    <div class="metric"><b>${issues.length?issues.length:"✓"}</b><span>Deck legality</span></div>
  </div>
  <div class="card">
    <h3>Priority test</h3>
    <p><b>${comboName(state.deck[test.focus])}</b><br><span class="muted">vs</span><br><b>${comboName(state.deck[test.opponent])}</b></p>
    <div class="progress"><div style="width:${Math.min(100,completed/test.target*100)}%"></div></div>
    <p class="muted">${completed} of ${test.target} completed · ${remain} remaining</p>
    <button class="btn" onclick="startBattle(${test.focus},${test.opponent})">Start next match</button>
  </div>
  <div class="card">
    <h3>Current deck</h3>
    ${state.deck.slice(0,3).map((x,i)=>`<p><span class="badge">${x.slot}</span> <b>${comboName(x)}</b><br><span class="muted">${x.role}</span></p>`).join("")}
    ${issues.length?`<div class="notice">${issues.join("<br>")}</div>`:`<span class="badge good">Owned-part check passed</span>`}
  </div>`;
}

function deckView(){
  const opts=(arr,selected)=>arr.map(x=>{const v=Array.isArray(x)?x[0]:x;return `<option ${v===selected?"selected":""}>${v}</option>`}).join("");
  return `<div class="card"><h2>Deck and Test Bey</h2><p class="muted">Change any owned part. Bey 1–3 are checked as a simultaneous tournament deck; Test Bey is independent.</p>
    ${state.deck.map((x,i)=>`<div class="deck-row">
      <div class="slot">${x.slot}</div>
      <div><label>Blade</label><select onchange="updatePart(${i},'blade',this.value)">${opts(OWNED.blades,x.blade)}</select></div>
      <div><label>Ratchet</label><select onchange="updatePart(${i},'ratchet',this.value)">${opts(OWNED.ratchets,x.ratchet)}</select></div>
      <div><label>Bit</label><select onchange="updatePart(${i},'bit',this.value)">${opts(OWNED.bits,x.bit)}</select></div>
    </div>`).join("")}
    <div class="notice">${partConflict().length?partConflict().join("<br>"):"Tournament deck is legal with the confirmed owned quantities."}</div>
  </div>`;
}
function updatePart(i,k,v){state.deck[i][k]=v;saveState();render()}

function startBattle(a,b){
  const err=selectedPairAvailable(a,b); if(err){alert(err);return}
  battle={aIndex:a,bIndex:b,a:comboName(state.deck[a]),b:comboName(state.deck[b]),aScore:0,bScore:0,rounds:[],startedAt:new Date().toISOString()};
  page="battle";render();
}
function battleView(){
  if(!battle)return `<div class="card"><h2>Start a match</h2>
    <label>Combo A</label><select id="pickA">${state.deck.map((x,i)=>`<option value="${i}">${x.slot}: ${comboName(x)}</option>`).join("")}</select>
    <label>Combo B</label><select id="pickB">${state.deck.map((x,i)=>`<option value="${i}" ${i===3?"selected":""}>${x.slot}: ${comboName(x)}</option>`).join("")}</select>
    <div class="actions"><button class="btn" onclick="startBattle(+pickA.value,+pickB.value)">Start match</button></div></div>`;
  const complete=battle.aScore>=4||battle.bScore>=4;
  return `<div class="card">
    <div class="scoreboard">
      <div><b>${battle.a}</b><div class="score">${battle.aScore}</div></div><div class="versus">VS</div>
      <div><b>${battle.b}</b><div class="score">${battle.bScore}</div></div>
    </div>
  </div>
  ${complete?`<div class="card"><h2>${battle.aScore>battle.bScore?battle.a:battle.b} wins</h2>
    <div class="actions"><button class="btn good" onclick="saveBattle()">Save match</button><button class="btn secondary" onclick="undoRound()">Undo</button><button class="btn danger" onclick="cancelBattle()">Discard</button></div></div>`:
  `<div class="card"><h3>${battle.a}</h3><div class="finish-grid">${finishButtons("a")}</div></div>
   <div class="card"><h3>${battle.b}</h3><div class="finish-grid">${finishButtons("b")}</div></div>
   <div class="actions"><button class="btn secondary" onclick="undoRound()">Undo last round</button><button class="btn danger" onclick="cancelBattle()">Cancel match</button></div>`}
  <div class="card"><h3>Round history</h3>${battle.rounds.length?`<div class="scroll"><table><tr><th>#</th><th>Winner</th><th>Finish</th><th>Points</th><th>Own finish</th></tr>${battle.rounds.map((r,i)=>`<tr><td>${i+1}</td><td>${r.side==="a"?battle.a:battle.b}</td><td>${r.finish}</td><td>${r.points}</td><td>${r.own?"Yes":""}</td></tr>`).join("")}</table></div>`:`<p class="muted">No rounds recorded.</p>`}</div>
  ${pendingFinish?ownFinishModal():""}`;
}
function finishButtons(side){
  return [["Spin",1,"spin"],["Burst",2,"burst"],["Over",2,"over"],["Xtreme",3,"xtreme"]].map(([f,p,c])=>
    `<button class="finish ${c}" onclick="chooseFinish('${side}','${f}',${p})">${f}<small>${p} point${p>1?"s":""}</small></button>`).join("");
}
function chooseFinish(side,finish,points){
  if(finish==="Over"||finish==="Xtreme"){pendingFinish={side,finish,points};render()}
  else addRound(side,finish,points,false);
}
function ownFinishModal(){
  return `<div class="modal"><div class="card"><h3>Was this an Own Finish?</h3>
    <p class="muted">Choose Yes only when the losing Bey entered the Over/Xtreme Zone without contacting the opponent.</p>
    <div class="actions"><button class="btn secondary" onclick="confirmFinish(false)">No / contact occurred</button><button class="btn danger" onclick="confirmFinish(true)">Yes, Own Finish</button></div></div></div>`;
}
function confirmFinish(own){const p=pendingFinish;pendingFinish=null;addRound(p.side,p.finish,p.points,own)}
function addRound(side,finish,points,own){
  battle.rounds.push({side,finish,points,own});
  if(side==="a")battle.aScore+=points;else battle.bScore+=points;
  render();
}
function undoRound(){
  if(pendingFinish){pendingFinish=null;render();return}
  const r=battle?.rounds.pop();if(!r)return;
  if(r.side==="a")battle.aScore-=r.points;else battle.bScore-=r.points;render();
}
function cancelBattle(){if(confirm("Discard this match?")){battle=null;render()}}
function saveBattle(){
  const winner=battle.aScore>battle.bScore?battle.a:battle.b;
  state.matches.push({id:uid(),date:new Date().toISOString(),a:battle.a,b:battle.b,winner,aScore:battle.aScore,bScore:battle.bScore,rounds:battle.rounds});
  saveState();battle=null;page="home";render();
}

function analyticsView(){
  const data=aggregate().sort((a,b)=>b.winRate-a.winRate||b.diff-a.diff);
  return `<div class="card"><h2>Combo leaderboard</h2><div class="scroll"><table><tr><th>Combo</th><th>Record</th><th>Win %</th><th>Points</th><th>Diff</th></tr>
    ${data.map(x=>`<tr><td>${x.name}</td><td>${x.w}-${x.l}</td><td>${(x.winRate*100).toFixed(1)}%</td><td>${x.points}-${x.against}</td><td>${x.diff>=0?"+":""}${x.diff}</td></tr>`).join("")}</table></div></div>
    <div class="card"><h3>Finish profiles</h3>${data.map(x=>{
      const total=x.spin+x.burst+x.over+x.xtreme||1;
      return `<p><b>${x.name}</b><br><span class="muted">Spin ${(x.spin/total*100).toFixed(0)}% · Burst ${(x.burst/total*100).toFixed(0)}% · Over ${(x.over/total*100).toFixed(0)}% · Xtreme ${(x.xtreme/total*100).toFixed(0)}%</span></p>`;
    }).join("")}</div>`;
}

function dataView(){
  return `<div class="card"><h2>Data management</h2><p class="muted">All data is stored locally on this device. Export backups regularly.</p>
    <div class="actions"><button class="btn" onclick="exportBackup()">Export backup</button><button class="btn secondary" onclick="document.getElementById('importFile').click()">Import backup</button><button class="btn secondary" onclick="exportCSV()">Export CSV</button><button class="btn danger" onclick="resetAll()">Reset app</button></div>
    <input id="importFile" class="hidden" type="file" accept=".json" onchange="importBackup(event)">
  </div>
  <div class="card"><h3>Install status</h3><p id="installText" class="muted">Use your browser menu and choose “Add to Home screen” after the app is hosted.</p></div>`;
}
function download(name,text,type){
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function exportBackup(){download("beylab-backup.json",JSON.stringify(state,null,2),"application/json")}
function importBackup(e){
  const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{state=JSON.parse(r.result);saveState();render();alert("Backup imported.")}catch{alert("Invalid backup.")}};
  r.readAsText(f);
}
function exportCSV(){
  let csv="date,combo_a,combo_b,winner,a_score,b_score,round,round_winner,finish,points,own_finish\n";
  state.matches.forEach(m=>m.rounds.forEach((r,i)=>csv += [
    m.date,`"${m.a}"`,`"${m.b}"`,`"${m.winner}"`,m.aScore,m.bScore,i+1,`"${r.side==="a"?m.a:m.b}"`,r.finish,r.points,r.own
  ].join(",")+"\n"));
  download("beylab-matches.csv",csv,"text/csv");
}
function resetAll(){if(confirm("Erase all saved app data?")){state=structuredClone(DEFAULT);saveState();battle=null;render()}}

window.addEventListener("load",()=>{
  if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js");
  render();
});