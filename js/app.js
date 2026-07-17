import {all,put,remove,clear,dump,restore,STORES} from './db.js';import {aggregate,researchCoach} from './analytics.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],uid=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random();
let S={page:'home',catalog:[],parts:[],productsOwned:[],builds:[],tests:[],matches:[],projects:[],notebook:[],battle:null,pending:null};
async function load(){const r=await fetch('./data/products.json',{cache:'no-store'});if(!r.ok)throw new Error('Could not load product catalog');S.catalog=await r.json();S.parts=await all('parts');S.productsOwned=await all('productsOwned');S.builds=await all('builds');S.tests=await all('tests');S.matches=await all('matches');S.projects=await all('projects');S.notebook=await all('notebook');render()}
function nav(){return `<nav>${[['home','⌂','Home'],['collection','◫','Collection'],['builds','◇','Builds'],['research','☷','Lab'],['battle','⚔','Battle'],['stats','▥','Stats']].map(x=>`<button class="${S.page===x[0]?'active':''}" data-go="${x[0]}"><span>${x[1]}</span>${x[2]}</button>`).join('')}</nav>`}
function render(){const v={home:home,collection,builds,research,battle,stats};$('#app').innerHTML=`<header><h1>Beyblade X Tournament Lab</h1><p>Tournament Lab v2.2 · Lab Coach Access · offline inventory and controlled testing</p></header><main>${v[S.page]()}</main>${nav()}`;bind()}
function go(p){S.page=p;render()}
function buildSystem(b){
 if(b.system)return b.system;
 if(b.lockChip&&(b.overBlade||b.metalBlade))return 'CX Expand';
 if(b.lockChip&&b.integratedBit)return 'CX Integrated';
 if(b.lockChip&&b.mainBlade)return 'CX';
 return 'Standard';
}
function bname(b){
 const system=buildSystem(b);
 if(system==='CX Expand')return `${b.lockChip} ${b.overBlade} ${b.metalBlade} ${b.assistBlade} ${b.ratchet} ${b.bit}`.replace(/\s+/g,' ').trim();
 if(system==='CX Integrated')return `${b.lockChip} ${b.mainBlade} ${b.assistBlade} ${b.integratedBit}`.replace(/\s+/g,' ').trim();
 if(system==='CX')return `${b.lockChip} ${b.mainBlade} ${b.assistBlade} ${b.ratchet} ${b.bit}`.replace(/\s+/g,' ').trim();
 return `${b.blade} ${b.ratchet} ${b.bit}`.replace(/\s+/g,' ').trim();
}
function buildPartNames(b){
 return [b.blade,b.lockChip,b.mainBlade,b.assistBlade,b.overBlade,b.metalBlade,b.ratchet,b.bit,b.integratedBit].filter(Boolean);
}

function testMatches(testId){return S.matches.filter(m=>m.testId===testId)}
function testStage(target){return target>=96?'Tournament Verified':target>=64?'High Confidence':target>=32?'Validated':'Screening'}
function nextStage(target){return target<16?16:target<32?32:target<64?64:target<96?96:96}
function projectForTest(t){return S.projects.find(p=>p.id===t.projectId)}
function evidenceForBuild(name){
 const x=aggregate(S.matches).find(s=>s.name===name);
 if(!x)return {score:0,label:'Experimental',reasons:['No controlled matches.']};
 let score=0,reasons=[];
 score+=Math.min(40,(x.matches/96)*40);
 score+=Math.min(20,(x.opponents.length/3)*20);
 score+=Math.max(0,Math.min(20,x.winRate*20));
 score+=x.diff>0?10:0;
 score+=Math.max(0,Math.min(10,x.stability*10));
 if(x.selfRate>.15)score-=10;
 score=Math.max(0,Math.min(100,Math.round(score)));
 const label=score>=85?'Tournament Ready':score>=65?'High Confidence':score>=45?'Validated':score>=20?'Screened':'Experimental';
 reasons=[`${x.matches} controlled matches`,`${x.opponents.length} distinct opponents`,`${(x.winRate*100).toFixed(1)}% win rate`,`${x.diff>=0?'+':''}${x.diff} point differential`,`${(x.selfRate*100).toFixed(1)}% self-exit rate`];
 return {score,label,reasons,stats:x};
}
function deckLegality(){
 const deck=S.builds.filter(b=>['Bey 1','Bey 2','Bey 3'].includes(b.slot));
 const issues=[];
 const counts={};
 for(const b of deck)for(const part of buildPartNames(b))counts[part]=(counts[part]||0)+1;
 for(const [name,n] of Object.entries(counts)){
   const owned=S.parts.find(p=>p.name===name)?.qty||0;
   if(n>owned)issues.push(`${name}: deck uses ${n}, owned ${owned}.`);
 }
 return {legal:issues.length===0,issues};
}
function notebookSummary(test){
 const a=S.builds.find(x=>x.id===test.aId),b=S.builds.find(x=>x.id===test.bId),rows=testMatches(test.id);
 const wins=rows.filter(m=>m.winner===a?.name).length,losses=rows.length-wins;
 const pts=rows.reduce((n,m)=>n+(m.a===a?.name?m.aScore:m.bScore),0);
 const against=rows.reduce((n,m)=>n+(m.a===a?.name?m.bScore:m.aScore),0);
 return {
   id:uid(),projectId:test.projectId,testId:test.id,date:new Date().toISOString(),
   title:`${testStage(test.target)}: ${a?.name} vs ${b?.name}`,
   question:projectForTest(test)?.question||'Controlled matchup evaluation',
   conditions:projectForTest(test)?.conditions||'Use fixed stadium and launch procedure.',
   result:`${wins}-${losses}; point differential ${pts-against>=0?'+':''}${pts-against}.`,
   decision:wins>losses?'Continue or advance while preserving the build.':wins===losses?'Extend testing before changing parts.':'Review finish profile and self-exits before changing one variable.',
   uncertainty:rows.length<96?'More evidence or opponent coverage is required.':'Benchmark stage complete.'
 };
}
function home(){
 const a=aggregate(S.matches),coach=researchCoach({builds:S.builds,tests:S.tests,matches:S.matches,projects:S.projects}),best=[...a].sort((x,y)=>y.winRate-x.winRate||y.diff-x.diff)[0],active=S.tests.find(x=>x.status==='Active');
 const reasonList=coach.reasons?.map(x=>`<li>${x}</li>`).join('')||'';
 const ev=best?evidenceForBuild(best.name):null,legal=deckLegality(),project=active?projectForTest(active):S.projects.find(p=>p.status==='Active');
 return `<div class="card hero"><div class="top"><div><h2>Local Research Coach</h2><p class="muted">Offline, explainable, and free</p></div><span class="badge ${coach.level==='good'?'good':coach.level==='bad'?'bad':'warn'}">${coach.title}</span></div><div class="notice"><b>${coach.decision}</b></div>
 <div class="grid" style="margin-top:10px">
  <div class="metric"><b>${coach.confidence??0}%</b><span>Coach confidence</span></div>
  <div class="metric"><b>${coach.priorityScore??0}</b><span>Information priority</span></div>
  <div class="metric"><b>${coach.warnings?.length||0}</b><span>Data-quality warnings</span></div>
 </div>
 ${reasonList?`<ul class="coach-reasons">${reasonList}</ul>`:''}
 ${coach.warnings?.length?`<div class="notice">${coach.warnings.map(x=>`⚠ ${x}`).join('<br>')}</div>`:''}
 <p><b>Next action:</b> ${coach.next}</p></div>
 <div class="grid"><div class="metric"><b>${S.parts.reduce((n,x)=>n+x.qty,0)}</b><span>Owned part copies</span></div><div class="metric"><b>${S.builds.length}</b><span>Saved builds</span></div><div class="metric"><b>${S.matches.length}</b><span>Controlled matches</span></div><div class="metric"><b>${ev?ev.score+'%':'—'}</b><span>Best evidence score</span></div></div>
 ${project?`<div class="card"><h3>Active Research Project</h3><p><b>${project.question}</b></p><p class="muted">${project.conditions||''}</p>${active?testCard(active):''}</div>`:active?testCard(active):''}
 <div class="card"><div class="top"><h3>Tournament Deck Legality</h3><span class="badge ${legal.legal?'good':'bad'}">${legal.legal?'Legal':'Conflict'}</span></div>${legal.legal?`<p class="muted">Assigned Bey 1–3 do not exceed owned quantities.</p>`:`<ul>${legal.issues.map(x=>`<li>${x}</li>`).join('')}</ul>`}</div>
 <div class="card"><h3>Research Method</h3><div class="grid"><div class="metric"><b>1</b><span>Define one question</span></div><div class="metric"><b>2</b><span>Change one variable</span></div><div class="metric"><b>3</b><span>Use fixed conditions</span></div><div class="metric"><b>4</b><span>Advance 16 → 32 → 64 → 96</span></div></div></div>`
}
function productRow(p){const o=S.productsOwned.find(x=>x.code===p.code),count=p.variants?.length||1;return `<tr data-product-row data-search="${(p.code+' '+p.name+' '+(p.parts||[]).map(x=>x.name).join(' ')+' '+(p.variants||[]).map(v=>v.name+' '+v.parts.map(x=>x.name).join(' ')).join(' ')).toLowerCase()}"><td>${p.code}</td><td>${p.name}</td><td>${p.line}</td><td>${p.type}</td><td>${p.releaseDate||''}</td><td>${o?.qty||0}</td><td>${p.variants?.length?`<span class="badge warn">${count} variants</span>`:'<span class="badge good">Mapped</span>'}</td><td><button class="btn secondary" data-product="${p.code}">Add</button></td></tr>`}
function collection(){return `<div class="card hero"><h2>Released Product / Set Library</h2><p class="muted">Choose a mapped product. Its included parts are loaded automatically.</p><div class="search"><input id="prodSearch" placeholder="Search product or included part"><select id="prodLine"><option>All</option><option>BX</option><option>UX</option><option>CX</option></select></div><div class="scroll"><table><tr><th>Code</th><th>Product</th><th>Line</th><th>Type</th><th>Release</th><th>Owned</th><th>Mapping</th><th></th></tr>${S.catalog.map(productRow).join('')}</table></div></div><div class="card"><div class="top"><h2>Owned Parts</h2><button class="btn" data-loose>Add Independent Part</button></div><div class="scroll"><table><tr><th>Category</th><th>Part</th><th>Qty</th><th>Source</th><th></th></tr>${S.parts.length?S.parts.sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name)).map(x=>`<tr><td>${x.category}</td><td>${x.name}</td><td>${x.qty}</td><td>${x.source||''}</td><td><button class="btn secondary" data-edit-part="${x.id}">Edit</button></td></tr>`).join(''):`<tr><td colspan="5" class="muted">Collection is empty.</td></tr>`}</table></div></div><div class="card"><h3>Backup and reset</h3><div class="actions"><button class="btn" data-export>Export</button><button class="btn secondary" data-import>Import</button><button class="btn danger" data-reset>Factory Reset</button></div><input id="importFile" class="hidden" type="file" accept=".json"></div><div id="modal"></div>`}
function builds(){
 const legal=deckLegality();
 return `<div class="card"><div class="top"><h2>Saved Builds</h2><button class="btn" data-new-build>Add Build</button></div>
 <div class="notice"><b>Deck legality:</b> ${legal.legal?'Passed':legal.issues.join(' · ')}</div>
 ${S.builds.length?S.builds.map(x=>{const ev=evidenceForBuild(x.name);return `<div class="queue"><div class="top"><div><b>${x.name}</b><br><span class="muted">${buildSystem(x)} · ${x.role||''} · ${x.slot||'Unassigned'}</span></div><span class="badge ${ev.score>=65?'good':ev.score>=20?'warn':''}">${ev.label} ${ev.score}%</span></div><div class="actions"><button class="btn secondary" data-edit-build="${x.id}">Edit</button><button class="btn danger" data-del-build="${x.id}">Delete</button></div></div>`}).join(''):`<p class="muted">No builds yet.</p>`}</div><div id="modal"></div>`
}
function research(){
 const coach=researchCoach({builds:S.builds,tests:S.tests,matches:S.matches,projects:S.projects});
 const activeProject=S.projects.find(p=>p.status==='Active');
 return `<div class="card hero coach-console">
   <div class="top">
     <div>
       <h2>Smart Research Coach</h2>
       <p class="muted">Always available in Lab · offline and free</p>
     </div>
     <span class="badge ${coach.level==='good'?'good':coach.level==='bad'?'bad':'warn'}">${coach.title}</span>
   </div>
   <div class="notice"><b>${coach.decision}</b></div>
   <div class="grid" style="margin-top:10px">
     <div class="metric"><b>${coach.confidence??0}%</b><span>Coach confidence</span></div>
     <div class="metric"><b>${coach.priorityScore??0}</b><span>Information priority</span></div>
     <div class="metric"><b>${coach.warnings?.length||0}</b><span>Warnings</span></div>
     <div class="metric"><b>${activeProject?'Active':'None'}</b><span>Research project</span></div>
   </div>
   <p><b>Recommended action:</b> ${coach.next}</p>
   ${coach.warnings?.length?`<div class="notice">${coach.warnings.map(x=>`⚠ ${x}`).join('<br>')}</div>`:''}
   <div class="actions">
     ${coach.recommendedTest?`<button class="btn" data-start-test="${coach.recommendedTest}">Start Recommended Test</button>`:''}
     ${!coach.recommendedTest&&S.builds.length>=2?`<button class="btn good" data-auto-plan>Auto-Create Coach Test</button>`:''}
     <button class="btn secondary" data-refresh-coach>Refresh Coach</button>
   </div>
 </div>
 <div class="card"><div class="top"><h2>Research Projects</h2><button class="btn" data-new-project>Add Project</button></div>${S.projects.length?S.projects.map(p=>`<div class="queue"><div class="top"><div><b>${p.question}</b><br><span class="muted">${p.conditions||''}</span></div><span class="badge">${p.status||'Active'}</span></div><div class="actions"><button class="btn secondary" data-edit-project="${p.id}">Edit</button><button class="btn danger" data-del-project="${p.id}">Delete</button></div></div>`).join(''):`<p class="muted">Create a project before starting a controlled test.</p>`}</div>
 <div class="card"><div class="top"><h2>Guided Test Queue</h2><button class="btn" data-new-test>Add Test</button></div>${S.tests.length?S.tests.sort((a,b)=>(a.status==='Active'?-1:1)).map(testCard).join(''):`<p class="muted">No tests yet.</p>`}</div>
 <div class="card"><h2>Research Notebook</h2>${S.notebook.length?S.notebook.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(n=>`<div class="queue"><b>${n.title}</b><p class="muted">${new Date(n.date).toLocaleString()}</p><p><b>Question:</b> ${n.question}</p><p><b>Conditions:</b> ${n.conditions}</p><p><b>Result:</b> ${n.result}</p><p><b>Decision:</b> ${n.decision}</p><p><b>Remaining uncertainty:</b> ${n.uncertainty}</p></div>`).join(''):`<p class="muted">Completed evidence stages will be summarized here automatically.</p>`}</div><div id="modal"></div>`
}
function testCard(t){const a=S.builds.find(x=>x.id===t.aId),b=S.builds.find(x=>x.id===t.bId),done=S.matches.filter(x=>x.testId===t.id).length;return `<div class="queue"><div class="top"><div><b>${a?.name||'Missing build'}</b><br><span class="muted">vs</span><br><b>${b?.name||'Missing build'}</b></div><span class="badge">${t.status}</span></div><div class="progress"><div style="width:${Math.min(100,done/t.target*100)}%"></div></div><p class="muted">${done}/${t.target} · ${testStage(t.target)}${projectForTest(t)?` · ${projectForTest(t).question}`:''}</p><div class="actions"><button class="btn" data-start-test="${t.id}">Continue</button><button class="btn secondary" data-edit-test="${t.id}">Edit</button><button class="btn danger" data-del-test="${t.id}">Delete</button></div></div>`}
function battle(){const m=S.battle;if(!m)return `<div class="card"><h2>No active match</h2><button class="btn" data-go="research">Open Research</button></div>`;const done=m.aScore>=4||m.bScore>=4;return `<div class="card hero"><div class="scoreboard"><div><b>${m.a}</b><div class="score">${m.aScore}</div></div><div>VS</div><div><b>${m.b}</b><div class="score">${m.bScore}</div></div></div></div>${done?`<div class="card"><h2>${m.aScore>m.bScore?m.a:m.b} wins</h2><div class="actions"><button class="btn good" data-save-match>Save</button><button class="btn secondary" data-undo>Undo</button><button class="btn danger" data-discard>Discard</button></div></div>`:`${sideButtons('a',m.a)}${sideButtons('b',m.b)}<div class="actions"><button class="btn secondary" data-undo>Undo</button><button class="btn danger" data-discard>Cancel</button></div>`}<div class="card"><h3>Rounds</h3>${m.rounds.length?`<div class="scroll"><table><tr><th>#</th><th>Winner</th><th>Finish</th><th>Pts</th><th>Own</th></tr>${m.rounds.map((r,i)=>`<tr><td>${i+1}</td><td>${r.side==='a'?m.a:m.b}</td><td>${r.finish}</td><td>${r.points}</td><td>${r.own?'Yes':''}</td></tr>`).join('')}</table></div>`:`<p class="muted">No rounds.</p>`}</div>${S.pending?ownModal():''}`}
function sideButtons(s,n){return `<div class="card"><h3>${n}</h3><div class="finish-grid">${[['Spin',1],['Burst',2],['Over',2],['Xtreme',3]].map(x=>`<button class="finish" data-finish="${s}|${x[0]}|${x[1]}">${x[0]}<small>${x[1]} point${x[1]>1?'s':''}</small></button>`).join('')}</div></div>`}function ownModal(){return `<div class="modal"><div class="card"><h3>Own Finish?</h3><p class="muted">Yes only when the losing Bey entered the zone without contact.</p><div class="actions"><button class="btn secondary" data-own="false">No</button><button class="btn danger" data-own="true">Yes</button></div></div></div>`}
function stats(){const a=aggregate(S.matches);return `<div class="card"><h2>Analytics</h2><div class="scroll"><table><tr><th>Combo</th><th>Record</th><th>Win %</th><th>Diff</th><th>Evidence</th></tr>${a.length?a.sort((x,y)=>y.winRate-x.winRate).map(x=>`<tr><td>${x.name}</td><td>${x.w}-${x.l}</td><td>${(x.winRate*100).toFixed(1)}%</td><td>${x.diff>=0?'+':''}${x.diff}</td><td>${x.confidence}</td></tr>`).join(''):`<tr><td colspan="5" class="muted">No match data.</td></tr>`}</table></div></div>`}
function bind(){$$('[data-go]').forEach(x=>x.onclick=()=>go(x.dataset.go));$('#prodSearch')?.addEventListener('input',filterProducts);$('#prodLine')?.addEventListener('change',filterProducts);$$('[data-product]').forEach(x=>x.onclick=()=>productModal(x.dataset.product));$('[data-loose]')?.addEventListener('click',()=>partModal());$$('[data-edit-part]').forEach(x=>x.onclick=()=>partModal(x.dataset.editPart));$('[data-new-build]')?.addEventListener('click',()=>buildModal());$$('[data-edit-build]').forEach(x=>x.onclick=()=>buildModal(x.dataset.editBuild));$$('[data-del-build]').forEach(x=>x.onclick=()=>deleteBuild(x.dataset.delBuild));$('[data-new-project]')?.addEventListener('click',()=>projectModal());$$('[data-edit-project]').forEach(x=>x.onclick=()=>projectModal(x.dataset.editProject));$$('[data-del-project]').forEach(x=>x.onclick=()=>deleteProject(x.dataset.delProject));$('[data-new-test]')?.addEventListener('click',()=>testModal());$$('[data-edit-test]').forEach(x=>x.onclick=()=>testModal(x.dataset.editTest));$$('[data-del-test]').forEach(x=>x.onclick=()=>deleteTest(x.dataset.delTest));$$('[data-start-test]').forEach(x=>x.onclick=()=>startTest(x.dataset.startTest));
 $('[data-auto-plan]')?.addEventListener('click',autoCreateCoachTest);
 $('[data-refresh-coach]')?.addEventListener('click',render);$$('[data-finish]').forEach(x=>x.onclick=()=>{const[a,b,c]=x.dataset.finish.split('|');finish(a,b,+c)});$$('[data-own]').forEach(x=>x.onclick=()=>confirmOwn(x.dataset.own==='true'));$('[data-undo]')?.addEventListener('click',undo);$('[data-discard]')?.addEventListener('click',discard);$('[data-save-match]')?.addEventListener('click',saveMatch);$('[data-export]')?.addEventListener('click',exportData);$('[data-import]')?.addEventListener('click',()=>$('#importFile').click());$('#importFile')?.addEventListener('change',importData);$('[data-reset]')?.addEventListener('click',resetAll)}
function filterProducts(){const q=($('#prodSearch')?.value||'').toLowerCase(),line=$('#prodLine')?.value||'All';$$('[data-product-row]').forEach(r=>r.style.display=(!q||r.dataset.search.includes(q))&&(line==='All'||r.children[2].textContent===line)?'':'none')}
function productModal(code){
 const p=S.catalog.find(x=>x.code===code);
 const variants=p.variants||[];
 const preview=()=>{
   const selected=variants.length?variants.find(v=>v.id===$('#variantSelect')?.value):null;
   const parts=selected?.parts||p.parts||[];
   const box=$('#partsPreview');
   if(box)box.innerHTML=parts.map(x=>`<label>${x.category}</label><input value="${x.name}" readonly>`).join('');
 };
 $('#modal').innerHTML=`<div class="modal"><div class="card"><h3>${p.code} — ${p.name}</h3>
 <p class="muted">${variants.length?'Choose the exact pull or included variant.':'All included Bey parts are mapped and selected automatically.'}</p>
 ${variants.length?`<label>Exact variant</label><select id="variantSelect">${variants.map(v=>`<option value="${v.id}">${v.id} — ${v.name}</option>`).join('')}</select>`:''}
 <div id="partsPreview"></div>
 <label>Quantity owned</label><input id="productQty" type="number" min="1" value="1">
 <div class="actions"><button class="btn good" id="addProduct">Add product</button><button class="btn secondary" id="cancel">Close</button></div></div></div>`;
 $('#cancel').onclick=render;
 $('#variantSelect')?.addEventListener('change',preview);
 preview();
 $('#addProduct').onclick=async()=>{
   const qty=Math.max(1,+$('#productQty').value||1);
   const selected=variants.length?variants.find(v=>v.id===$('#variantSelect').value):null;
   const parts=selected?.parts||p.parts||[];
   for(const part of parts){
     let x=S.parts.find(v=>v.category===part.category&&v.name===part.name);
     if(x){x.qty+=qty;x.source=[...new Set((x.source||'').split(';').map(v=>v.trim()).filter(Boolean).concat(selected?`${p.code}-${selected.id}`:p.code))].join('; ')}
     else{x={id:uid(),category:part.category,name:part.name,qty,source:selected?`${p.code}-${selected.id}`:p.code}}
     await put('parts',x)
   }
   const ownedCode=selected?`${p.code}-${selected.id}`:p.code;
   let o=S.productsOwned.find(x=>x.code===ownedCode)||{id:ownedCode,code:ownedCode,qty:0};
   o.qty+=qty;await put('productsOwned',o);await load()
 }
}
function partModal(id=null){const p=id?S.parts.find(x=>x.id===id):{id:uid(),category:'Blade',name:'',qty:1,source:'Loose / independent'};$('#modal').innerHTML=`<div class="modal"><div class="card"><h3>${id?'Edit':'Add'} Independent Part</h3><label>Category</label><select id="pc">${['Blade','Ratchet','Bit','Lock Chip','Main Blade','Assist Blade','Metal Blade','Over Blade'].map(x=>`<option ${x===p.category?'selected':''}>${x}</option>`).join('')}</select><label>Name</label><input id="pn" value="${p.name}"><label>Quantity</label><input id="pq" type="number" min="0" value="${p.qty}"><label>Source</label><input id="ps" value="${p.source||''}"><div class="actions"><button class="btn" id="savePart">Save</button>${id?'<button class="btn danger" id="deletePart">Delete</button>':''}<button class="btn secondary" id="cancel">Cancel</button></div></div></div>`;$('#cancel').onclick=render;$('#savePart').onclick=async()=>{const x={id:p.id,category:$('#pc').value,name:$('#pn').value.trim(),qty:Math.max(0,+$('#pq').value||0),source:$('#ps').value.trim()};if(!x.name)return alert('Enter a name');await put('parts',x);await load()};if(id)$('#deletePart').onclick=async()=>{if(S.builds.some(b=>buildPartNames(b).includes(p.name)))return alert('Part is used by a saved build');await remove('parts',p.id);await load()}}
function opts(cat,sel){
 const rows=S.parts.filter(x=>x.category===cat&&x.qty>0);
 return rows.length
  ?rows.map(x=>`<option ${x.name===sel?'selected':''}>${x.name}</option>`).join('')
  :`<option value="">No owned ${cat}</option>`;
}
function buildFields(system,b){
 if(system==='CX Integrated')return `
   <label>Lock Chip</label><select id="blc">${opts('Lock Chip',b.lockChip)}</select>
   <label>Main Blade</label><select id="bmain">${opts('Main Blade',b.mainBlade)}</select>
   <label>Assist Blade</label><select id="bab">${opts('Assist Blade',b.assistBlade)}</select>
   <label>Ratchet Integrated Bit</label><select id="bib">${opts('Ratchet Integrated Bit',b.integratedBit)}</select>`;
 if(system==='CX Expand')return `
   <label>Lock Chip</label><select id="blc">${opts('Lock Chip',b.lockChip)}</select>
   <label>Over Blade</label><select id="bob">${opts('Over Blade',b.overBlade)}</select>
   <label>Metal Blade</label><select id="bmb">${opts('Metal Blade',b.metalBlade)}</select>
   <label>Assist Blade</label><select id="bab">${opts('Assist Blade',b.assistBlade)}</select>
   <label>Ratchet</label><select id="br">${opts('Ratchet',b.ratchet)}</select>
   <label>Bit</label><select id="bi">${opts('Bit',b.bit)}</select>`;
 if(system==='CX')return `
   <label>Lock Chip</label><select id="blc">${opts('Lock Chip',b.lockChip)}</select>
   <label>Main Blade</label><select id="bmain">${opts('Main Blade',b.mainBlade)}</select>
   <label>Assist Blade</label><select id="bab">${opts('Assist Blade',b.assistBlade)}</select>
   <label>Ratchet</label><select id="br">${opts('Ratchet',b.ratchet)}</select>
   <label>Bit</label><select id="bi">${opts('Bit',b.bit)}</select>`;
 return `
   <label>Blade</label><select id="bb">${opts('Blade',b.blade)}</select>
   <label>Ratchet</label><select id="br">${opts('Ratchet',b.ratchet)}</select>
   <label>Bit</label><select id="bi">${opts('Bit',b.bit)}</select>`;
}
function readBuildFields(system,b){
 const base={...b,system,role:$('#bro').value,slot:$('#bslot').value,status:$('#bs').value};
 if(system==='CX Integrated')return {...base,blade:'',overBlade:'',metalBlade:'',ratchet:'',bit:'',lockChip:$('#blc').value,mainBlade:$('#bmain').value,assistBlade:$('#bab').value,integratedBit:$('#bib').value};
 if(system==='CX Expand')return {...base,blade:'',mainBlade:'',lockChip:$('#blc').value,overBlade:$('#bob').value,metalBlade:$('#bmb').value,assistBlade:$('#bab').value,ratchet:$('#br').value,bit:$('#bi').value};
 if(system==='CX')return {...base,blade:'',overBlade:'',metalBlade:'',lockChip:$('#blc').value,mainBlade:$('#bmain').value,assistBlade:$('#bab').value,ratchet:$('#br').value,bit:$('#bi').value};
 return {...base,lockChip:'',mainBlade:'',assistBlade:'',overBlade:'',metalBlade:'',blade:$('#bb').value,ratchet:$('#br').value,bit:$('#bi').value};
}
function buildModal(id=null){
 if(!S.parts.length)return alert('Add owned parts first');
 const b=id?S.builds.find(x=>x.id===id):{
   id:uid(),system:'Standard',
   blade:S.parts.find(x=>x.category==='Blade')?.name||'',
   ratchet:S.parts.find(x=>x.category==='Ratchet')?.name||'',
   bit:S.parts.find(x=>x.category==='Bit')?.name||'',
   role:'',status:'Experimental'
 };
 const initialSystem=buildSystem(b);
 $('#modal').innerHTML=`<div class="modal"><div class="card"><h3>${id?'Edit':'Add'} Build</h3>
   <label>Build System</label>
   <select id="buildSystem">
     ${['Standard','CX','CX Integrated','CX Expand'].map(x=>`<option ${x===initialSystem?'selected':''}>${x}</option>`).join('')}
   </select>
   <div id="buildFields"></div>
   <label>Role</label><input id="bro" value="${b.role||''}"><label>Tournament deck slot</label><select id="bslot">${['','Bey 1','Bey 2','Bey 3','Test Bey'].map(x=>`<option ${x===(b.slot||'')?'selected':''}>${x||'Unassigned'}</option>`).join('')}</select>
   <label>Status</label><select id="bs">${['Experimental','Benchmark','Tournament Candidate','Validated'].map(x=>`<option ${x===b.status?'selected':''}>${x}</option>`).join('')}</select>
   <div class="actions"><button class="btn" id="saveBuild">Save</button><button class="btn secondary" id="cancel">Cancel</button></div>
 </div></div>`;
 const paint=()=>{$('#buildFields').innerHTML=buildFields($('#buildSystem').value,b)};
 $('#buildSystem').onchange=paint;paint();
 $('#cancel').onclick=render;
 $('#saveBuild').onclick=async()=>{
   const x=readBuildFields($('#buildSystem').value,b);
   const required=buildPartNames(x);
   if(required.some(v=>!v))return alert('Complete every required component.');
   x.name=bname(x);
   await put('builds',x);
   await load();
 };
}
async function deleteBuild(id){if(S.tests.some(t=>t.aId===id||t.bId===id))return alert('Build is used by a test');if(confirm('Delete build?')){await remove('builds',id);await load()}}
function buildOptions(sel){return S.builds.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${x.name}</option>`).join('')}

async function autoCreateCoachTest(){
 if(S.builds.length<2)return alert('Create at least two builds first.');
 let project=S.projects.find(p=>p.status==='Active');
 if(!project){
   project={
     id:uid(),
     question:`Can ${S.builds[0].name} consistently defeat ${S.builds[1].name}?`,
     conditions:'Same stadium, alternating launch order, fixed builds, no part changes during the evidence stage.',
     status:'Active'
   };
   await put('projects',project);
 }
 for(const t of S.tests.filter(t=>t.status==='Active')){
   t.status='Paused';
   await put('tests',t);
 }
 const test={
   id:uid(),
   projectId:project.id,
   aId:S.builds[0].id,
   bId:S.builds[1].id,
   target:16,
   status:'Active'
 };
 await put('tests',test);
 await load();
 startTest(test.id);
}
function projectModal(id=null){
 const p=id?S.projects.find(x=>x.id===id):{id:uid(),question:'',conditions:'Same stadium, alternating launch order, fixed builds.',status:'Active'};
 $('#modal').innerHTML=`<div class="modal"><div class="card"><h3>${id?'Edit':'Add'} Research Project</h3><label>Research question</label><textarea id="prq">${p.question||''}</textarea><label>Fixed conditions</label><textarea id="prc">${p.conditions||''}</textarea><label>Status</label><select id="prs">${['Active','Paused','Complete'].map(x=>`<option ${x===p.status?'selected':''}>${x}</option>`).join('')}</select><div class="actions"><button class="btn" id="saveProject">Save</button><button class="btn secondary" id="cancel">Cancel</button></div></div></div>`;
 $('#cancel').onclick=render;$('#saveProject').onclick=async()=>{const x={...p,question:$('#prq').value.trim(),conditions:$('#prc').value.trim(),status:$('#prs').value};if(!x.question)return alert('Enter a research question');await put('projects',x);await load()}
}
async function deleteProject(id){if(S.tests.some(t=>t.projectId===id))return alert('Project is used by a test');if(confirm('Delete project?')){await remove('projects',id);await load()}}
function projectOptions(sel){return `<option value="">No project</option>`+S.projects.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${x.question}</option>`).join('')}
function testModal(id=null){
 if(S.builds.length<2)return alert('Create at least two builds');
 const t=id?S.tests.find(x=>x.id===id):{id:uid(),projectId:S.projects.find(x=>x.status==='Active')?.id||'',aId:S.builds[0].id,bId:S.builds[1].id,target:16,status:'Active'};
 $('#modal').innerHTML=`<div class="modal"><div class="card"><h3>${id?'Edit':'Add'} Controlled Test</h3><label>Research project</label><select id="tpr">${projectOptions(t.projectId)}</select><label>Focus</label><select id="ta">${buildOptions(t.aId)}</select><label>Opponent</label><select id="tb">${buildOptions(t.bId)}</select><label>Evidence target</label><select id="tt">${[16,32,64,96].map(x=>`<option ${x===t.target?'selected':''}>${x} — ${testStage(x)}</option>`).join('')}</select><label>Status</label><select id="ts">${['Active','Planned','Paused','Complete'].map(x=>`<option ${x===t.status?'selected':''}>${x}</option>`).join('')}</select><div class="actions"><button class="btn" id="saveTest">Save</button><button class="btn secondary" id="cancel">Cancel</button></div></div></div>`;
 $('#cancel').onclick=render;$('#saveTest').onclick=async()=>{const x={...t,projectId:$('#tpr').value,aId:$('#ta').value,bId:$('#tb').value,target:+$('#tt').value,status:$('#ts').value};if(x.aId===x.bId)return alert('Choose different builds');await put('tests',x);await load()}
}
async function deleteTest(id){if(confirm('Delete test?')){await remove('tests',id);await load()}}function startTest(id){const t=S.tests.find(x=>x.id===id),a=S.builds.find(x=>x.id===t.aId),b=S.builds.find(x=>x.id===t.bId);S.battle={id:uid(),testId:id,a:a.name,b:b.name,aScore:0,bScore:0,rounds:[]};go('battle')}function finish(side,f,p){if(['Over','Xtreme'].includes(f)){S.pending={side,f,p};render()}else addRound(side,f,p,false)}function confirmOwn(o){const x=S.pending;S.pending=null;addRound(x.side,x.f,x.p,o)}function addRound(side,finish,points,own){S.battle.rounds.push({side,finish,points,own});side==='a'?S.battle.aScore+=points:S.battle.bScore+=points;render()}function undo(){if(S.pending){S.pending=null;return render()}const r=S.battle?.rounds.pop();if(!r)return;r.side==='a'?S.battle.aScore-=r.points:S.battle.bScore-=r.points;render()}function discard(){if(confirm('Discard match?')){S.battle=null;render()}}async function saveMatch(){
 const m=S.battle;m.winner=m.aScore>m.bScore?m.a:m.b;m.date=new Date().toISOString();await put('matches',m);
 const t=S.tests.find(x=>x.id===m.testId);
 if(t){
   const count=testMatches(t.id).length+1;
   if(count>=t.target){
     await put('notebook',notebookSummary(t));
     if(t.target<96){t.target=nextStage(t.target);t.status='Active'}else{t.status='Complete';const p=projectForTest(t);if(p){p.status='Complete';await put('projects',p)}}
     await put('tests',t);
   }
 }
 S.battle=null;await load();go('home')
}
async function exportData(){const o=await dump(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,2)],{type:'application/json'}));a.download='beylab-backup.json';a.click()}function importData(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=async()=>{try{await restore(JSON.parse(r.result));await load()}catch(err){alert('Invalid backup')}};r.readAsText(f)}async function resetAll(){if(!confirm('Erase collection, builds, tests, and matches?'))return;for(const s of STORES)await clear(s);await load()}
window.addEventListener('error',e=>showError(e.error||e.message));window.addEventListener('unhandledrejection',e=>showError(e.reason));function showError(err){$('#app').innerHTML=`<div class="error card"><h2>App startup error</h2><p>The interface could not load. This message replaces the previous blank screen.</p><pre>${String(err?.stack||err)}</pre><button class="btn" onclick="location.reload()">Reload</button></div>`}
try{if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');await load()}catch(e){showError(e)}