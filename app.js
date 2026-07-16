
const BASE={blades:[["DranStrike","BX-49",1],["PhoenixWing","BX-23",1],["ImpactDrake","UX-11",1],["SilverWolf","UX-08",1],["ScorpioSpear","UX-14",1],["BulletGriffon","UX-19",1],["BahamutBlitz BK","CX-16",1],["SolEclipse D","CX-09",1],["WolfHunt F","CX-10",1]],ratchets:[["Integrated",1],["0-60",1],["0-70",1],["1-50",1],["3-80",1],["4-50",1],["5-70",1],["9-60",2]],bits:[["Disc Ball",1],["Free Ball",1],["Free Flat",1],["Gear Flat",1],["Hexa",1],["Ignition",1],["Low Rush",1],["Trans Kick",1],["Zap",1]]};
const DEFAULT={
 owned:structuredClone(BASE),
 deck:[
  {slot:"Bey 1",blade:"DranStrike",ratchet:"1-50",bit:"Low Rush",role:"Primary attacker"},
  {slot:"Bey 2",blade:"SilverWolf",ratchet:"9-60",bit:"Hexa",role:"Defense"},
  {slot:"Bey 3",blade:"PhoenixWing",ratchet:"9-60",bit:"Gear Flat",role:"Secondary attacker"},
  {slot:"Test Bey",blade:"BahamutBlitz BK",ratchet:"0-70",bit:"Ignition",role:"Balance / counter"}],
 matches:[],
 historical:[
  {a:"DranStrike 1-50 Low Rush",b:"SilverWolf 9-60 Hexa",aWins:7,bWins:5,aSpin:2,aBurst:0,aOver:12,aXtreme:5,bSpin:22,bBurst:0,bOver:4,bXtreme:0},
  {a:"DranStrike 1-50 Low Rush",b:"PhoenixWing 9-60 Gear Flat",aWins:7,bWins:5,aSpin:12,aBurst:1,aOver:6,aXtreme:3,bSpin:10,bBurst:0,bOver:2,bXtreme:3}],
 queue:[
  {id:"Q1",focus:0,opponent:3,target:12,priority:"High",status:"Active",purpose:"Validate DranStrike against balance/counter"},
  {id:"Q2",focus:1,opponent:3,target:12,priority:"Medium",status:"Planned",purpose:"Evaluate defensive slot coverage"},
  {id:"Q3",focus:2,opponent:3,target:12,priority:"Medium",status:"Planned",purpose:"Evaluate secondary attacker coverage"}]
};
let state=load();migrate();let page="home",battle=null,pending=null;
function load(){try{return JSON.parse(localStorage.getItem("beylab-v3-state"))||JSON.parse(localStorage.getItem("beylab-state"))||structuredClone(DEFAULT)}catch{return structuredClone(DEFAULT)}}
function migrate(){if(!state.owned)state.owned=structuredClone(BASE);if(!state.queue)state.queue=structuredClone(DEFAULT.queue);save()}
function save(){localStorage.setItem("beylab-v3-state",JSON.stringify(state))}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()}
function cname(x){return `${x.blade} ${x.ratchet} ${x.bit}`}
function q(list,n){const x=list.find(v=>v[0]===n);return x?x[x.length-1]:0}
function deckIssues(){let d=state.deck.slice(0,3),out=[];for(const k of["blade","ratchet","bit"]){let m={};d.forEach(x=>m[x[k]]=(m[x[k]]||0)+1);Object.entries(m).forEach(([p,n])=>{const qty=k==="blade"?q(state.owned.blades,p):k==="ratchet"?q(state.owned.ratchets,p):q(state.owned.bits,p);if(n>qty)out.push(`${p} used ${n} times; owned ${qty}.`)})}d.forEach(x=>{if(x.blade==="BulletGriffon"&&x.ratchet!=="Integrated")out.push("BulletGriffon requires Integrated.");if(x.blade!=="BulletGriffon"&&x.ratchet==="Integrated")out.push("Integrated is BulletGriffon-only.")});return [...new Set(out)]}
function pairIssue(a,b){if(a===b)return"Choose different slots.";let x=state.deck[a],y=state.deck[b];if(x.blade===y.blade&&q(state.owned.blades,x.blade)<2)return`Only one ${x.blade} is owned.`;if(x.ratchet===y.ratchet&&q(state.owned.ratchets,x.ratchet)<2)return`Only one ${x.ratchet} is owned.`;if(x.bit===y.bit&&q(state.owned.bits,x.bit)<2)return`Only one ${x.bit} is owned.`;return""}
function aggregate(){let map={};function add(n,w,l,s,b,o,x,p,a,self=0){map[n]??={name:n,w:0,l:0,matches:0,spin:0,burst:0,over:0,xtreme:0,points:0,against:0,self:0};let z=map[n];z.w+=w;z.l+=l;z.matches+=w+l;z.spin+=s;z.burst+=b;z.over+=o;z.xtreme+=x;z.points+=p;z.against+=a;z.self+=self}
state.historical.forEach(t=>{let ap=t.aSpin+2*t.aBurst+2*t.aOver+3*t.aXtreme,bp=t.bSpin+2*t.bBurst+2*t.bOver+3*t.bXtreme;add(t.a,t.aWins,t.bWins,t.aSpin,t.aBurst,t.aOver,t.aXtreme,ap,bp);add(t.b,t.bWins,t.aWins,t.bSpin,t.bBurst,t.bOver,t.bXtreme,bp,ap)});
state.matches.forEach(t=>{let c=(s,f)=>t.rounds.filter(r=>r.side===s&&r.finish===f).length,selfA=t.rounds.filter(r=>r.side==="b"&&r.own).length,selfB=t.rounds.filter(r=>r.side==="a"&&r.own).length,aw=t.winner===t.a?1:0,bw=1-aw;add(t.a,aw,bw,c("a","Spin"),c("a","Burst"),c("a","Over"),c("a","Xtreme"),t.aScore,t.bScore,selfA);add(t.b,bw,aw,c("b","Spin"),c("b","Burst"),c("b","Over"),c("b","Xtreme"),t.bScore,t.aScore,selfB)});
return Object.values(map).map(x=>({...x,wr:x.matches?x.w/x.matches:0,diff:x.points-x.against,avg:x.matches?x.points/x.matches:0,confidence:x.matches>=36?"High":x.matches>=24?"Medium":x.matches>=12?"Screened":"Low",readiness:x.matches>=24&&x.wr>=.55&&x.diff>0?"Candidate":x.matches>=12?"Testing":"Insufficient data"}))}
function testCompleted(item){const a=cname(state.deck[item.focus]),b=cname(state.deck[item.opponent]);return state.matches.filter(m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a)).length}
function activeQueue(){return state.queue.find(x=>x.status==="Active")||state.queue.find(x=>x.status==="Planned")}
function nav(){return `<nav>${[["home","⌂","Home"],["battle","⚔","Battle"],["queue","☷","Tests"],["deck","◈","Deck"],["analytics","▥","Stats"],["data","⚙","Data"]].map(x=>`<button class="${page===x[0]?"active":""}" onclick="go('${x[0]}')"><span>${x[1]}</span>${x[2]}</button>`).join("")}</nav>`}
function render(){let views={home,battle:battleView,queue:queueView,deck:deckView,analytics:analyticsView,data:dataView};document.getElementById("app").innerHTML=`<header><h1>Personal Beyblade X Tournament Lab</h1><p>Testing queue, one-tap scoring, and owned-parts analytics</p></header><main>${views[page]()}</main>${nav()}`}
function go(p){page=p;render()}
function home(){const a=aggregate().find(x=>x.name==="DranStrike 1-50 Low Rush"),t=activeQueue(),done=t?testCompleted(t):0,rem=t?Math.max(0,t.target-done):0;return `<div class="card hero"><h2>Current decision</h2><div class="notice"><b>Keep DranStrike 1-50 Low Rush unchanged.</b><br>${a?`${a.w}-${a.l}, ${(a.wr*100).toFixed(1)}% win rate, ${a.diff>=0?"+":""}${a.diff} point differential.`:"No data"}</div></div><div class="grid"><div class="metric"><b>${a?a.matches:0}</b><span>DranStrike matches</span></div><div class="metric"><b>${a?(a.wr*100).toFixed(1)+"%":"—"}</b><span>Win rate</span></div><div class="metric"><b>${state.matches.length}</b><span>New matches</span></div><div class="metric"><b>${deckIssues().length||"✓"}</b><span>Deck legality</span></div></div>${t?`<div class="card"><div class="queue-top"><div><h3>Priority test</h3><b>${cname(state.deck[t.focus])}</b><br><span class="muted">vs</span><br><b>${cname(state.deck[t.opponent])}</b></div><span class="badge ${t.priority==="High"?"warn":""}">${t.priority}</span></div><div class="progress"><div style="width:${Math.min(100,done/t.target*100)}%"></div></div><p class="muted">${done} of ${t.target} completed · ${rem} remaining</p><div class="actions"><button class="btn" onclick="startBattle(${t.focus},${t.opponent},'${t.id}')">Start next match</button><button class="btn secondary" onclick="go('queue')">Manage tests</button></div></div>`:"<div class='card'><p>No active tests.</p></div>"}`}
function queueView(){return `<div class="card"><div class="toolbar"><h2>Testing queue</h2><button class="btn icon" onclick="showAddTest()">+</button></div><p class="muted">The first Active test is recommended on Home.</p></div>${state.queue.map((t,i)=>{let d=testCompleted(t),r=Math.max(0,t.target-d);return`<div class="queue-item"><div class="queue-top"><div><b>${cname(state.deck[t.focus])}</b><br><span class="muted">vs</span><br><b>${cname(state.deck[t.opponent])}</b></div><span class="badge ${t.status==="Complete"?"good":t.status==="Active"?"warn":""}">${t.status}</span></div><p class="tiny">${t.purpose||""}</p><div class="progress"><div style="width:${Math.min(100,d/t.target*100)}%"></div></div><p class="muted">${d}/${t.target} · ${r} remaining</p><div class="actions"><button class="btn" onclick="startBattle(${t.focus},${t.opponent},'${t.id}')">Test</button><button class="btn secondary" onclick="editTest('${t.id}')">Edit</button><button class="btn danger" onclick="deleteTest('${t.id}')">Delete</button></div></div>`}).join("")}<div id="testModal"></div>`}
function showAddTest(existing=null){const t=existing||{id:uid(),focus:0,opponent:3,target:12,priority:"Medium",status:"Planned",purpose:""};document.getElementById("testModal").innerHTML=`<div class="modal"><div class="card"><h3>${existing?"Edit":"Add"} test</h3><label>Focus slot</label><select id="tf">${state.deck.map((x,i)=>`<option value="${i}" ${i===t.focus?"selected":""}>${x.slot}: ${cname(x)}</option>`).join("")}</select><label>Opponent slot</label><select id="to">${state.deck.map((x,i)=>`<option value="${i}" ${i===t.opponent?"selected":""}>${x.slot}: ${cname(x)}</option>`).join("")}</select><label>Target matches</label><input id="tt" type="number" min="1" max="200" value="${t.target}"><label>Priority</label><select id="tp">${["High","Medium","Low"].map(x=>`<option ${x===t.priority?"selected":""}>${x}</option>`).join("")}</select><label>Status</label><select id="ts">${["Planned","Active","Complete","Paused"].map(x=>`<option ${x===t.status?"selected":""}>${x}</option>`).join("")}</select><label>Purpose</label><textarea id="tpu">${t.purpose||""}</textarea><div class="actions"><button class="btn" onclick="saveTest('${t.id}',${!!existing})">Save</button><button class="btn secondary" onclick="closeTestModal()">Cancel</button></div></div></div>`}
function closeTestModal(){document.getElementById("testModal").innerHTML=""}
function saveTest(id,exists){const x={id,focus:+tf.value,opponent:+to.value,target:Math.max(1,+tt.value||12),priority:tp.value,status:ts.value,purpose:tpu.value};if(x.focus===x.opponent)return alert("Choose different slots.");if(exists)state.queue[state.queue.findIndex(t=>t.id===id)]=x;else state.queue.push(x);save();render()}
function editTest(id){showAddTest(state.queue.find(x=>x.id===id))}function deleteTest(id){if(confirm("Delete this test?")){state.queue=state.queue.filter(x=>x.id!==id);save();render()}}
function opts(list,s){return list.map(x=>`<option ${x[0]===s?"selected":""}>${x[0]}</option>`).join("")}
function deckView(){return `<div class="card"><h2>Deck and Test Bey</h2><p class="muted">Bey 1–3 must be physically legal together. Test Bey is independent.</p>${state.deck.map((x,i)=>`<div class="deck-row"><div class="slot">${x.slot}</div><div><label>Blade</label><select onchange="updateDeck(${i},'blade',this.value)">${opts(state.owned.blades,x.blade)}</select></div><div><label>Ratchet</label><select onchange="updateDeck(${i},'ratchet',this.value)">${opts(state.owned.ratchets,x.ratchet)}</select></div><div><label>Bit</label><select onchange="updateDeck(${i},'bit',this.value)">${opts(state.owned.bits,x.bit)}</select></div></div>`).join("")}<div class="notice">${deckIssues().length?deckIssues().join("<br>"):"Tournament deck is legal."}</div></div>`}
function updateDeck(i,k,v){state.deck[i][k]=v;save();render()}
function startBattle(a,b,testId=null){const e=pairIssue(a,b);if(e)return alert(e);battle={id:uid(),testId,aIndex:a,bIndex:b,a:cname(state.deck[a]),b:cname(state.deck[b]),aScore:0,bScore:0,rounds:[],startedAt:new Date().toISOString()};page="battle";render()}
function battleView(){if(!battle)return`<div class="card"><h2>Start a match</h2><label>Combo A</label><select id="ba">${state.deck.map((x,i)=>`<option value="${i}">${x.slot}: ${cname(x)}</option>`).join("")}</select><label>Combo B</label><select id="bb">${state.deck.map((x,i)=>`<option value="${i}" ${i===3?"selected":""}>${x.slot}: ${cname(x)}</option>`).join("")}</select><div class="actions"><button class="btn" onclick="startBattle(+ba.value,+bb.value)">Start</button></div></div>`;const done=battle.aScore>=4||battle.bScore>=4;return`<div class="card hero"><div class="scoreboard"><div><b>${battle.a}</b><div class="score">${battle.aScore}</div></div><div class="versus">VS</div><div><b>${battle.b}</b><div class="score">${battle.bScore}</div></div></div></div>${done?`<div class="card"><h2>${battle.aScore>battle.bScore?battle.a:battle.b} wins</h2><div class="actions"><button class="btn good" onclick="saveBattle()">Save match</button><button class="btn secondary" onclick="undoRound()">Undo</button><button class="btn danger" onclick="discardBattle()">Discard</button></div></div>`:`<div class="card"><h3>${battle.a}</h3>${finishButtons("a")}</div><div class="card"><h3>${battle.b}</h3>${finishButtons("b")}</div><div class="actions"><button class="btn secondary" onclick="undoRound()">Undo last round</button><button class="btn danger" onclick="discardBattle()">Cancel match</button></div>`}<div class="card"><h3>Round history</h3>${battle.rounds.length?`<div class="scroll"><table><tr><th>#</th><th>Winner</th><th>Finish</th><th>Pts</th><th>Own</th></tr>${battle.rounds.map((r,i)=>`<tr><td>${i+1}</td><td>${r.side==="a"?battle.a:battle.b}</td><td>${r.finish}</td><td>${r.points}</td><td>${r.own?"Yes":""}</td></tr>`).join("")}</table></div>`:`<p class="muted">No rounds recorded.</p>`}</div>${pending?ownModal():""}`}
function finishButtons(side){return`<div class="finish-grid">${[["Spin",1,"spin"],["Burst",2,"burst"],["Over",2,"over"],["Xtreme",3,"xtreme"]].map(x=>`<button class="finish ${x[2]}" onclick="selectFinish('${side}','${x[0]}',${x[1]})">${x[0]}<small>${x[1]} point${x[1]>1?"s":""}</small></button>`).join("")}</div>`}
function selectFinish(s,f,p){navigator.vibrate?.(20);if(f==="Over"||f==="Xtreme"){pending={s,f,p};render()}else addRound(s,f,p,false)}
function ownModal(){return`<div class="modal"><div class="card"><h3>Own Finish?</h3><p class="muted">Choose Yes only when the losing Bey entered the zone without contact.</p><div class="actions"><button class="btn secondary" onclick="confirmOwn(false)">No / contact</button><button class="btn danger" onclick="confirmOwn(true)">Yes</button></div></div></div>`}
function confirmOwn(o){let x=pending;pending=null;addRound(x.s,x.f,x.p,o)}function addRound(s,f,p,o){battle.rounds.push({side:s,finish:f,points:p,own:o});s==="a"?battle.aScore+=p:battle.bScore+=p;render()}
function undoRound(){if(pending){pending=null;return render()}let r=battle.rounds.pop();if(!r)return;r.side==="a"?battle.aScore-=r.points:battle.bScore-=r.points;render()}
function discardBattle(){if(confirm("Discard this match?")){battle=null;render()}}
function saveBattle(){battle.winner=battle.aScore>battle.bScore?battle.a:battle.b;battle.date=new Date().toISOString();state.matches.push(battle);if(battle.testId){let t=state.queue.find(x=>x.id===battle.testId);if(t&&testCompleted(t)>=t.target)t.status="Complete"}save();battle=null;page="home";render()}
function analyticsView(){let a=aggregate().sort((x,y)=>y.wr-x.wr||y.diff-x.diff);return`<div class="card"><h2>Combo leaderboard</h2><div class="scroll"><table><tr><th>Combo</th><th>Record</th><th>Win %</th><th>Diff</th><th>Confidence</th></tr>${a.map(x=>`<tr><td>${x.name}</td><td>${x.w}-${x.l}</td><td>${(x.wr*100).toFixed(1)}%</td><td>${x.diff>=0?"+":""}${x.diff}</td><td>${x.confidence}</td></tr>`).join("")}</table></div></div>${a.map(x=>{let total=x.spin+x.burst+x.over+x.xtreme||1;return`<div class="card"><div class="queue-top"><div><h3>${x.name}</h3><span class="badge ${x.readiness==="Candidate"?"good":x.readiness==="Testing"?"warn":""}">${x.readiness}</span></div><div><b>${(x.wr*100).toFixed(1)}%</b><br><span class="tiny">${x.matches} matches</span></div></div><div class="statbar"><span>Spin</span><div class="bar"><div style="width:${x.spin/total*100}%"></div></div><b>${x.spin}</b></div><div class="statbar"><span>Burst</span><div class="bar"><div style="width:${x.burst/total*100}%"></div></div><b>${x.burst}</b></div><div class="statbar"><span>Over</span><div class="bar"><div style="width:${x.over/total*100}%"></div></div><b>${x.over}</b></div><div class="statbar"><span>Xtreme</span><div class="bar"><div style="width:${x.xtreme/total*100}%"></div></div><b>${x.xtreme}</b></div><p class="muted">Avg points/match: ${x.avg.toFixed(2)} · Self-exit losses: ${x.self}</p></div>`}).join("")}`}

function partList(category){
  return category==="Blade"?state.owned.blades:category==="Ratchet"?state.owned.ratchets:state.owned.bits;
}
function partInUse(category,name){
  const key=category==="Blade"?"blade":category==="Ratchet"?"ratchet":"bit";
  return state.deck.some(x=>x[key]===name);
}
function addPart(cat,n,qty,src){
  n=n.trim();qty=Math.max(1,+qty||1);
  if(!n)return alert("Enter a part name.");
  const list=partList(cat);
  const found=list.find(v=>v[0].toLowerCase()===n.toLowerCase());
  if(found)found[found.length-1]+=qty;
  else list.push(cat==="Blade"?[n,src||"Manual",qty]:[n,qty]);
  save();render();
}
function removePart(cat,name,qty,removeAll=false){
  if(!name)return alert("Choose a part.");
  const list=partList(cat);
  const index=list.findIndex(v=>v[0]===name);
  if(index<0)return alert("Part not found.");
  const current=list[index][list[index].length-1];
  const amount=removeAll?current:Math.max(1,+qty||1);
  const remaining=current-amount;

  if(remaining<=0 && partInUse(cat,name)){
    return alert(`${name} is currently assigned to the deck or Test Bey. Replace it there before removing the final copy.`);
  }

  if(remaining>0) list[index][list[index].length-1]=remaining;
  else list.splice(index,1);

  save();render();
}
function refreshRemoveOptions(){
  const cat=document.getElementById("rc")?.value;
  const select=document.getElementById("rn");
  if(!cat||!select)return;
  select.innerHTML=partList(cat).map(x=>`<option>${x[0]}</option>`).join("");
}
function dataView(){
  const rows=(t,l)=>`<tr><th colspan="4">${t}</th></tr>${l.map(x=>`<tr><td>${x[0]}</td><td>${x[x.length-1]}</td><td>${x.length===3?x[1]:""}</td><td>${partInUse(t.slice(0,-1),x[0])?"In use":""}</td></tr>`).join("")}`;
  return `<div class="card">
    <h2>Collection manager</h2>
    <p class="muted">Manage individual owned parts. New parts appear immediately in the Deck dropdowns.</p>

    <h3>Add a part</h3>
    <div class="grid">
      <div><label>Category</label><select id="pc"><option>Blade</option><option>Ratchet</option><option>Bit</option></select></div>
      <div><label>Part name</label><input id="pn" placeholder="Example: 3-60"></div>
      <div><label>Quantity to add</label><input id="pq" type="number" min="1" value="1"></div>
      <div><label>Source</label><input id="ps" placeholder="Optional"></div>
    </div>
    <div class="actions"><button class="btn" onclick="addPart(pc.value,pn.value,pq.value,ps.value)">Add part</button></div>

    <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">

    <h3>Remove a part</h3>
    <div class="grid">
      <div><label>Category</label><select id="rc" onchange="refreshRemoveOptions()"><option>Blade</option><option>Ratchet</option><option>Bit</option></select></div>
      <div><label>Part</label><select id="rn">${state.owned.blades.map(x=>`<option>${x[0]}</option>`).join("")}</select></div>
      <div><label>Quantity to remove</label><input id="rq" type="number" min="1" value="1"></div>
    </div>
    <div class="actions">
      <button class="btn warn" onclick="removePart(rc.value,rn.value,rq.value,false)">Reduce quantity</button>
      <button class="btn danger" onclick="removePart(rc.value,rn.value,999999,true)">Remove all copies</button>
    </div>
    <p class="tiny">The final copy cannot be removed while it is assigned to Bey 1–3 or the Test Bey.</p>
  </div>

  <div class="card">
    <h3>Owned parts</h3>
    <div class="scroll"><table>
      <tr><th>Part</th><th>Qty</th><th>Source</th><th>Status</th></tr>
      ${rows("Blades",state.owned.blades)}
      ${rows("Ratchets",state.owned.ratchets)}
      ${rows("Bits",state.owned.bits)}
    </table></div>
  </div>

  <div class="card"><h3>Backup and export</h3>
    <div class="actions">
      <button class="btn" onclick="exportBackup()">Export backup</button>
      <button class="btn secondary" onclick="document.getElementById('imp').click()">Import backup</button>
      <button class="btn secondary" onclick="exportCSV()">Export CSV</button>
      <button class="btn danger" onclick="resetApp()">Reset app</button>
    </div>
    <input id="imp" class="hidden" type="file" accept=".json" onchange="importBackup(event)">
  </div>`;
}
function dl(n,t,type){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([t],{type}));a.download=n;a.click()}
function exportBackup(){dl("beylab-v3-backup.json",JSON.stringify(state,null,2),"application/json")}function importBackup(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);migrate();render()}catch{alert("Invalid backup.")}};r.readAsText(f)}
function exportCSV(){let csv="date,combo_a,combo_b,winner,a_score,b_score,round,round_winner,finish,points,own_finish\n";state.matches.forEach(m=>m.rounds.forEach((r,i)=>csv+=[m.date,`"${m.a}"`,`"${m.b}"`,`"${m.winner}"`,m.aScore,m.bScore,i+1,`"${r.side==="a"?m.a:m.b}"`,r.finish,r.points,r.own].join(",")+"\n"));dl("beylab-v3.csv",csv,"text/csv")}
function resetApp(){if(confirm("Reset all saved data?")){state=structuredClone(DEFAULT);save();battle=null;render()}}
addEventListener("load",()=>{if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js");render()});
