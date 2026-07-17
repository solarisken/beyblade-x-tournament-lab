import {all,put,remove,clear,dump,restore,STORES} from './db.js';
import {
  aggregate,matchupDecision,roleOfBit,buildEvidence
} from './analytics.js';
import {
  optimizeDecks,officialDeckLegality,generateLegalBuilds,explainDeck,
  suggestSingleVariableRepairs,buildPartEntries
} from './optimizer.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));

const VERSION='4.0.0';
const CONFIRMED_PRODUCTS=['UX-14','CX-16','UX-19','UX-08','CX-09','CX-10','BX-23','UX-11','BX-49'];
const ANCHOR_PART='DranStrike';

const S={
  page:'home',
  catalog:[],parts:[],productsOwned:[],builds:[],tests:[],matches:[],
  projects:[],notebook:[],coachLog:[],optimizationRuns:[],
  battle:null,pending:null,lastSave:null
};

async function reloadData(){
  S.parts=await all('parts');
  S.productsOwned=await all('productsOwned');
  S.builds=await all('builds');
  S.tests=await all('tests');
  S.matches=await all('matches');
  S.projects=await all('projects');
  S.notebook=await all('notebook');
  S.coachLog=await all('coachLog');
  S.optimizationRuns=await all('optimizationRuns');
}

async function load(){
  const response=await fetch(`./data/products.json?v=${VERSION}`,{cache:'no-store'});
  if(!response.ok)throw new Error('Could not load the product catalog.');
  S.catalog=await response.json();
  await reloadData();
  render();
}

function buildSystem(build){
  if(build.system)return build.system;
  if(build.lockChip&&(build.overBlade||build.metalBlade))return 'CX Expand';
  if(build.lockChip&&build.integratedBit)return 'CX Integrated';
  if(build.lockChip&&build.mainBlade)return 'CX';
  return 'Standard';
}

function buildName(build){
  const system=buildSystem(build);
  if(system==='CX Expand'){
    return [build.lockChip,build.overBlade,build.metalBlade,build.assistBlade,build.ratchet,build.bit].filter(Boolean).join(' ');
  }
  if(system==='CX Integrated'){
    return [build.lockChip,build.mainBlade,build.assistBlade,build.integratedBit].filter(Boolean).join(' ');
  }
  if(system==='CX'){
    return [build.lockChip,build.mainBlade,build.assistBlade,build.ratchet,build.bit].filter(Boolean).join(' ');
  }
  return [build.blade,build.ratchet,build.bit].filter(Boolean).join(' ');
}

function buildParts(build){
  return [
    build.blade,build.lockChip,build.mainBlade,build.assistBlade,
    build.overBlade,build.metalBlade,build.ratchet,build.bit,build.integratedBit
  ].filter(Boolean);
}

function buildRole(build){
  const explicit=(build.role||'').match(/Attack|Stamina|Defense|Balance/i)?.[0];
  return explicit?explicit[0].toUpperCase()+explicit.slice(1).toLowerCase():roleOfBit(build.bit||build.integratedBit);
}

function ownedQty(name){
  return S.parts.find(part=>part.name===name)?.qty||0;
}

function sourceTokens(part){
  return (part.source||'').split(';').map(value=>value.trim()).filter(Boolean);
}

function usedCount(builds,name){
  return builds.reduce((count,build)=>count+buildParts(build).filter(part=>part===name).length,0);
}

function canUse(builds,names){
  return names.every(name=>usedCount(builds,name)<ownedQty(name));
}

function ratchetHeight(name=''){
  return +(name.match(/-(\d+)/)?.[1]||99);
}

function evidence(build){
  return buildEvidence(build,S.builds,S.tests,S.matches);
}

function hashText(text){
  let hash=2166136261;
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(16);
}

function optimizationSignature(){
  const parts=S.parts
    .map(part=>[part.category,part.name,part.qty].join('|'))
    .sort();
  const matches=S.matches
    .map(match=>[match.testId,match.winner,match.aScore,match.bScore].join('|'))
    .sort();
  const tests=S.tests
    .map(test=>[test.id,test.status,test.aId,test.bId].join('|'))
    .sort();
  return hashText(JSON.stringify({version:VERSION,parts,matches,tests}));
}

function latestOptimization(requireFresh=true){
  const runs=S.optimizationRuns.slice().sort((a,b)=>b.date.localeCompare(a.date));
  if(!requireFresh)return runs[0]||null;
  const signature=optimizationSignature();
  return runs.find(run=>run.signature===signature)||null;
}

function assignedDeck(){
  return S.builds
    .filter(build=>['Bey 1','Bey 2','Bey 3'].includes(build.slot))
    .sort((a,b)=>a.slot.localeCompare(b.slot));
}

function assignedLegality(){
  return officialDeckLegality(assignedDeck(),S.parts);
}

function topOptimization(){
  return latestOptimization()?.decks?.[0]||null;
}

function optimizationApplied(run=latestOptimization()){
  if(!run?.appliedDeckNames?.length)return false;
  const current=assignedDeck().map(build=>build.name);
  return run.appliedDeckNames.length===3&&run.appliedDeckNames.every((name,index)=>current[index]===name);
}

function directive(){
  if(!S.parts.length){
    return {
      phase:'Collection',level:'warn',
      title:'Load the confirmed owned collection',
      detail:'The optimizer cannot generate legal decks until owned quantities are recorded.',
      action:'load-confirmed',label:'Load Confirmed Collection'
    };
  }

  const active=S.tests.find(test=>test.status==='Active');
  if(active){
    const decision=matchupDecision(active,S.builds,S.matches);
    return {
      phase:'Testing',
      level:decision.status==='continue'?'warn':decision.status==='pass'?'good':'bad',
      title:decision.status==='continue'?'Continue the active matchup':'Review the matchup decision',
      detail:decision.reason,
      action:decision.status==='continue'?'continue-test':'review-lab',
      testId:active.id,
      label:decision.status==='continue'?'Start Next Match':'Review Coach Decision'
    };
  }

  const run=latestOptimization();
  if(!run){
    return {
      phase:'Optimization',level:'warn',
      title:'Recalculate the strongest low-gap deck',
      detail:'Collection or evidence changed. The optimizer must regenerate legal builds and re-score every deck candidate.',
      action:'optimize',label:'Run Strongest Optimizer'
    };
  }

  if(!optimizationApplied(run)){
    return {
      phase:'Deck',level:'warn',
      title:'Apply the best low-gap 3-on-3 deck',
      detail:`Best objective ${run.decks[0]?.metrics?.objective??0}/100 with gap index ${run.decks[0]?.metrics?.gapIndex??0}/100.`,
      action:'apply-best',label:'Apply Best Deck'
    };
  }

  const legality=assignedLegality();
  if(!legality.legal){
    return {
      phase:'Deck',level:'bad',
      title:'Repair official 3-on-3 legality',
      detail:legality.issues.join(' · '),
      action:'apply-best',label:'Repair with Best Legal Deck'
    };
  }

  const ready=assignedDeck().filter(build=>evidence(build).ready).length;
  if(ready===3){
    return {
      phase:'Decision',level:'good',
      title:'Low-gap serious candidate deck assembled',
      detail:'All three assigned Beys are legal and evidence-supported within the owned testing pool.',
      action:'review-deck',label:'Review Final Deck'
    };
  }

  return {
    phase:'Planning',level:'warn',
    title:'Test the weakest or least-certain deck member',
    detail:'The optimizer has minimized the current gaps. The coach will now test the uncertainty that matters most.',
    action:'plan-test',label:'Coach Plan Next Matchup'
  };
}

async function logCoach(message,type='action',meta={}){
  await put('coachLog',{
    id:uid(),date:new Date().toISOString(),type,message,meta
  });
}

function go(page){
  S.page=page;
  render();
}

function nav(){
  const items=[
    ['home','◎','Coach'],
    ['collection','◫','Collection'],
    ['deck','◇','Deck'],
    ['lab','☷','Lab'],
    ['battle','⚔','Battle'],
    ['evidence','▥','Evidence']
  ];
  return `<nav>${items.map(([page,icon,label])=>`
    <button class="${S.page===page?'active':''}" data-go="${page}">
      <span>${icon}</span>${label}
    </button>`).join('')}</nav>`;
}

function coachDock(){
  const item=directive();
  return `<section class="card coach-dock">
    <div class="top">
      <div>
        <div class="eyebrow">SMART COACH · ${esc(item.phase)}</div>
        <h2>${esc(item.title)}</h2>
      </div>
      <span class="badge ${item.level==='good'?'good':item.level==='bad'?'bad':'warn'}">Managed</span>
    </div>
    <p>${esc(item.detail)}</p>
    <div class="actions">
      <button class="btn ${item.level==='good'?'good':''}" data-coach-action="${esc(item.action)}" ${item.testId?`data-test-id="${esc(item.testId)}"`:''}>${esc(item.label)}</button>
      <button class="btn secondary" data-go="lab">Why this?</button>
    </div>
  </section>`;
}

function render(){
  const pages={
    home:homePage,
    collection:collectionPage,
    deck:deckPage,
    lab:labPage,
    battle:battlePage,
    evidence:evidencePage
  };
  const page=pages[S.page]||homePage;
  $('#app').innerHTML=`
    <header>
      <div class="top">
        <div>
          <h1>Beyblade X Tournament Lab</h1>
          <p>Version ${VERSION} · Exhaustive owned-pool low-gap optimizer</p>
        </div>
        <span class="badge good">V4 ACTIVE</span>
      </div>
    </header>
    <main>
      ${coachDock()}
      ${page()}
    </main>
    ${nav()}
  `;
  bind();
}

function workflowStatus(){
  const run=latestOptimization();
  const legality=assignedLegality();
  const deck=assignedDeck();
  const ready=deck.filter(build=>evidence(build).ready).length;
  return [
    {label:'Collection',done:S.parts.length>0,detail:`${S.parts.reduce((n,p)=>n+p.qty,0)} owned part copies`},
    {label:'Exhaustive Search',done:Boolean(run),detail:run?`${run.generated} legal builds generated`:'Not calculated'},
    {label:'Low-Gap Deck',done:optimizationApplied(run)&&legality.legal,detail:run?`Gap index ${run.decks[0]?.metrics?.gapIndex??0}/100`:'Not applied'},
    {label:'Serious Evidence',done:ready===3,detail:`${ready}/3 serious candidates`}
  ];
}

function homePage(){
  const status=workflowStatus();
  const run=latestOptimization();
  const top=run?.decks?.[0];
  const legality=assignedLegality();
  const deck=assignedDeck();

  return `
    <section class="card hero">
      <div class="top">
        <div>
          <div class="eyebrow">CHAMPIONSHIP OPTIMIZER</div>
          <h2>Strongest owned-pool deck with reduced internal gaps</h2>
        </div>
        <span class="badge ${status.every(step=>step.done)?'good':'warn'}">${status.filter(step=>step.done).length}/4 complete</span>
      </div>
      <div class="workflow">
        ${status.map((step,index)=>`
          <div class="workflow-step ${step.done?'done':''}">
            <b>${step.done?'✓':index+1}</b>
            <div><strong>${esc(step.label)}</strong><span>${esc(step.detail)}</span></div>
          </div>`).join('')}
      </div>
    </section>

    ${top?`
      <section class="grid">
        <div class="metric"><b>${top.metrics.objective}</b><span>Deck objective</span></div>
        <div class="metric"><b>${top.metrics.gapIndex}</b><span>Low-gap index</span></div>
        <div class="metric"><b>${top.metrics.floor}</b><span>Weakest-Bey floor</span></div>
        <div class="metric"><b>${top.metrics.scoreGap}</b><span>Performance gap</span></div>
      </section>`:
      `<section class="card"><p class="muted">Run the optimizer to calculate the strongest legal deck from the owned collection.</p></section>`}

    <section class="card">
      <div class="top">
        <h2>Current Tournament Deck</h2>
        <span class="badge ${legality.legal?'good':'bad'}">${legality.legal?'Officially legal':'Not ready'}</span>
      </div>
      ${deck.length?deck.map(deckBuildCard).join(''):
        '<p class="muted">No optimized deck is currently assigned.</p>'}
    </section>

    <section class="card">
      <h2>V4 optimizer rule</h2>
      <p>The engine generates every legal build from recorded owned parts, scores each candidate transparently, and then performs exact three-deck optimization over a dominance-pruned frontier.</p>
      <div class="notice"><b>Low-gap priority:</b> The objective rewards a high weakest-Bey floor, balanced Attack/Stamina/Defense coverage, small performance gaps, small evidence gaps, and official no-duplicate-part legality.</div>
    </section>
  `;
}

function productSearchText(product){
  return [
    product.code,product.name,
    ...(product.parts||[]).map(part=>part.name),
    ...(product.variants||[]).flatMap(variant=>[variant.name,...variant.parts.map(part=>part.name)])
  ].join(' ').toLowerCase();
}

function productRow(product){
  const owned=S.productsOwned.find(item=>item.code===product.code)?.qty||0;
  return `<tr data-product-row data-line="${esc(product.line)}" data-search="${esc(productSearchText(product))}">
    <td>${esc(product.code)}</td>
    <td>${esc(product.name)}</td>
    <td>${esc(product.line)}</td>
    <td>${owned}</td>
    <td>${product.mappingStatus==='verified'?'<span class="badge good">Mapped</span>':'<span class="badge warn">Review</span>'}</td>
    <td><button class="btn secondary" data-product="${esc(product.code)}">Add</button></td>
  </tr>`;
}

function collectionPage(){
  const confirmedOwned=CONFIRMED_PRODUCTS.filter(code=>S.productsOwned.some(item=>item.code===code&&item.qty>0)).length;
  return `
    <section class="card hero">
      <div class="top">
        <div>
          <div class="eyebrow">OWNED INVENTORY</div>
          <h2>Collection source of truth</h2>
        </div>
        <span class="badge">${confirmedOwned}/${CONFIRMED_PRODUCTS.length} confirmed products loaded</span>
      </div>
      <p>The coach formulates only from quantities recorded here.</p>
      <div class="actions">
        <button class="btn good" data-load-confirmed>Load Confirmed Collection</button>
        <button class="btn secondary" data-new-part>Add Loose Part</button>
      </div>
    </section>

    <section class="card">
      <h2>Released Product Library</h2>
      <div class="search">
        <input id="productSearch" placeholder="Search code, product, or part">
        <select id="productLine"><option>All</option><option>BX</option><option>UX</option><option>CX</option></select>
      </div>
      <div class="scroll">
        <table>
          <tr><th>Code</th><th>Product</th><th>Line</th><th>Owned</th><th>Mapping</th><th></th></tr>
          ${S.catalog.map(productRow).join('')}
        </table>
      </div>
    </section>

    <section class="card">
      <div class="top"><h2>Owned Parts</h2><span class="badge">${S.parts.length} unique</span></div>
      <div class="scroll">
        <table>
          <tr><th>Category</th><th>Part</th><th>Qty</th><th>Source</th><th></th></tr>
          ${S.parts.length?S.parts.slice().sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name)).map(part=>`
            <tr>
              <td>${esc(part.category)}</td><td>${esc(part.name)}</td><td>${part.qty}</td><td>${esc(part.source||'')}</td>
              <td><button class="btn secondary" data-edit-part="${esc(part.id)}">Edit</button></td>
            </tr>`).join(''):'<tr><td colspan="5" class="muted">No owned parts recorded.</td></tr>'}
        </table>
      </div>
    </section>

    <section class="card">
      <h2>Data Controls</h2>
      <div class="actions">
        <button class="btn" data-export>Export Backup</button>
        <button class="btn secondary" data-import>Import Backup</button>
        <button class="btn danger" data-reset>Factory Reset</button>
      </div>
      <input id="importFile" class="hidden" type="file" accept=".json">
    </section>
    <div id="modal"></div>
  `;
}

function deckBuildCard(build){
  const result=evidence(build);
  return `<article class="build-card">
    <div class="top">
      <div>
        <span class="slot">${esc(build.slot||'Unassigned')}</span>
        <h3>${esc(build.name)}</h3>
        <p class="muted">${esc(buildSystem(build))} · ${esc(buildRole(build))}</p>
      </div>
      <span class="badge ${result.ready?'good':result.score>=30?'warn':''}">${esc(result.label)} ${result.score}%</span>
    </div>
    <div class="evidence-mini">
      <span>${result.passed} passed matchups</span>
      <span>${result.opponentRoles} opponent roles</span>
    </div>
    <div class="actions">
      <button class="btn secondary" data-edit-build="${esc(build.id)}">Edit</button>
      <button class="btn danger" data-delete-build="${esc(build.id)}">Delete</button>
    </div>
  </article>`;
}

function optimizerBuildCard(build,index){
  return `<article class="build-card optimizer-build">
    <div class="top">
      <div>
        <span class="slot">Bey ${index+1} · ${esc(build.role)}</span>
        <h3>${esc(build.name)}</h3>
        <p class="muted">${esc(build.system)} · ${esc(build.evidenceSource)}</p>
      </div>
      <span class="badge">${build.overall}/100</span>
    </div>
    <div class="profile-grid">
      <span>Attack <b>${build.profile.attack}</b></span>
      <span>Stamina <b>${build.profile.stamina}</b></span>
      <span>Defense <b>${build.profile.defense}</b></span>
      <span>Evidence <b>${build.evidenceScore}</b></span>
      <span>Reliability <b>${build.reliability}</b></span>
      <span>Versatility <b>${build.versatility}</b></span>
    </div>
  </article>`;
}

function optimizationSummary(run,rank=0){
  const entry=run?.decks?.[rank];
  if(!entry)return '<p class="muted">No legal deck result.</p>';
  return `
    <div class="optimizer-metrics">
      <div class="metric"><b>${entry.metrics.objective}</b><span>Objective</span></div>
      <div class="metric"><b>${entry.metrics.gapIndex}</b><span>Low-gap index</span></div>
      <div class="metric"><b>${entry.metrics.floor}</b><span>Weakest-Bey floor</span></div>
      <div class="metric"><b>${entry.metrics.scoreGap}</b><span>Performance gap</span></div>
      <div class="metric"><b>${entry.metrics.coverageGap}</b><span>Coverage gap</span></div>
      <div class="metric"><b>${entry.metrics.evidenceGap}</b><span>Evidence gap</span></div>
    </div>
    <div class="optimizer-deck">${entry.deck.map(optimizerBuildCard).join('')}</div>
    <div class="notice">${explainDeck(entry).map(esc).join('<br>')}</div>
  `;
}

function deckPage(){
  const run=latestOptimization();
  const legality=assignedLegality();
  const assigned=assignedDeck();
  const reserve=S.builds.filter(build=>!['Bey 1','Bey 2','Bey 3'].includes(build.slot));

  return `
    <section class="card hero">
      <div class="top">
        <div>
          <div class="eyebrow">OWNED-POOL CHAMPIONSHIP OPTIMIZER</div>
          <h2>High floor, low gap, official 3-on-3 legality</h2>
        </div>
        <span class="badge ${run?'good':'warn'}">${run?'Calculated':'Not calculated'}</span>
      </div>
      <p>The optimizer generates every legal build, then searches the strongest balanced three-Bey combinations. Low-gap optimization is the default. DranStrike is enforced as the owned-pool anchor when it is available, and the other two Beys are selected to raise the floor and close the remaining gaps.</p>
      <div class="actions">
        <button class="btn good" data-run-optimizer>${run?'Recalculate Optimizer':'Run Strongest Optimizer'}</button>
        ${run?'<button class="btn" data-apply-deck="0">Apply Best Low-Gap Deck</button>':''}
        <button class="btn secondary" data-new-build>Manual Build Override</button>
      </div>
      <div class="notice"><b>Anchor:</b> DranStrike is required when owned. The optimizer builds the lowest-gap legal support around it.<br><b>Official duplicate rule:</b> Restricted parts cannot repeat across the three Beys, even in different colors. Custom Line Lock Chips may repeat except Valkyrie and Emperor, subject to owned quantity.</div>
    </section>

    ${run?`
      <section class="card">
        <div class="top">
          <h2>Best Deck Result</h2>
          <span class="badge good">${run.generated} builds · ${run.triplesEvaluated} legal triples</span>
        </div>
        ${optimizationSummary(run,0)}
      </section>

      <section class="card">
        <h2>Alternative Low-Gap Decks</h2>
        ${run.decks.slice(1,4).map((entry,index)=>`
          <article class="queue">
            <div class="top">
              <div><b>Rank ${index+2}</b><div class="muted">${entry.deck.map(build=>build.name).join(' / ')}</div></div>
              <span class="badge">Objective ${entry.metrics.objective} · Gap ${entry.metrics.gapIndex}</span>
            </div>
            <div class="actions"><button class="btn secondary" data-apply-deck="${index+1}">Apply Rank ${index+2}</button></div>
          </article>`).join('')}
      </section>`:
      `<section class="card"><p class="muted">No optimization result. Run the strongest optimizer first.</p></section>`}

    <section class="card">
      <details>
        <summary><b>How the low-gap optimizer scores decks</b></summary>
        <p class="muted">Candidate scoring combines transparent mechanical priors, inherited or exact match evidence, reliability, and versatility. Recorded controlled matches progressively override generic priors.</p>
        <div class="model-grid">
          <span>Weakest-Bey floor <b>30%</b></span>
          <span>Average strength <b>18%</b></span>
          <span>Coverage floor <b>18%</b></span>
          <span>Small performance gap <b>13%</b></span>
          <span>Small coverage gap <b>10%</b></span>
          <span>Small evidence gap <b>6%</b></span>
          <span>Role diversity <b>5%</b></span>
        </div>
        <p class="tiny">Exact triple evaluation is performed over a dominance-pruned frontier after every legal owned build is generated.</p>
      </details>
    </section>

    <section class="card">
      <div class="top">
        <h2>Applied Tournament Deck</h2>
        <span class="badge ${legality.legal?'good':'bad'}">${legality.legal?'Officially legal':'Needs repair'}</span>
      </div>
      ${legality.issues.length?`<div class="notice">${legality.issues.map(esc).join('<br>')}</div>`:''}
      ${assigned.length?assigned.map(deckBuildCard).join(''):'<p class="muted">No deck applied.</p>'}
    </section>

    <section class="card">
      <h2>Reserve and Experimental Builds</h2>
      ${reserve.length?reserve.map(deckBuildCard).join(''):'<p class="muted">No reserve builds.</p>'}
    </section>
    <div id="modal"></div>
  `;
}

function testStage(test){
  if(test.status==='Passed')return 'Passed';
  if(test.status==='Rejected')return 'Rejected';
  if(test.status==='Inconclusive')return 'Inconclusive';
  const count=S.matches.filter(match=>match.testId===test.id).length;
  if(count>=12)return 'Decision stage';
  if(count>=8)return 'Confirmation';
  if(count>=4)return 'Screened';
  return 'Initial evidence';
}

function testCard(test){
  const focus=S.builds.find(build=>build.id===test.aId);
  const opponent=S.builds.find(build=>build.id===test.bId);
  const decision=matchupDecision(test,S.builds,S.matches);
  const count=decision.record.n;
  const target=test.status==='Active'?decision.nextTarget:count;
  return `<article class="queue">
    <div class="top">
      <div>
        <b>${esc(focus?.name||'Missing focus')}</b>
        <div class="muted">vs ${esc(opponent?.name||'Missing opponent')}</div>
      </div>
      <span class="badge ${test.status==='Passed'?'good':test.status==='Rejected'?'bad':'warn'}">${esc(test.status)}</span>
    </div>
    <p class="muted">${esc(testStage(test))} · ${count}/${target} matches</p>
    <div class="progress"><div style="width:${target?Math.min(100,count/target*100):0}%"></div></div>
    <p>${esc(decision.reason)}</p>
    <div class="actions">
      ${test.status==='Active'?`<button class="btn good" data-start-test="${esc(test.id)}">Continue</button>`:''}
      ${['Planned','Paused'].includes(test.status)?`<button class="btn" data-activate-test="${esc(test.id)}">Activate</button>`:''}
      <button class="btn secondary" data-edit-test="${esc(test.id)}">Edit</button>
      <button class="btn danger" data-delete-test="${esc(test.id)}">Delete</button>
    </div>
  </article>`;
}

function latestRejectedTest(){
  return S.tests
    .filter(test=>test.status==='Rejected')
    .slice()
    .sort((a,b)=>(b.updated||b.created||'').localeCompare(a.updated||a.created||''))[0]||null;
}

function repairSuggestions(){
  const rejected=latestRejectedTest();
  const deck=assignedDeck();
  const target=S.builds.find(build=>build.id===rejected?.aId);
  if(!rejected||!target||deck.length!==3)return [];
  const candidates=generateLegalBuilds(S.parts,S.builds,S.tests,S.matches,S.catalog);
  return suggestSingleVariableRepairs(target,deck,candidates,S.parts,5);
}

function labPage(){
  const item=directive();
  const active=S.tests.filter(test=>test.status==='Active');
  const queue=S.tests.filter(test=>test.status!=='Active');
  const logs=S.coachLog.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12);
  const repairs=repairSuggestions();
  const rejected=latestRejectedTest();
  const rejectedBuild=S.builds.find(build=>build.id===rejected?.aId);
  const run=latestOptimization();

  return `
    <section class="card hero">
      <div class="top">
        <div>
          <div class="eyebrow">OPTIMIZER AND TEST COACH</div>
          <h2>${esc(item.title)}</h2>
        </div>
        <span class="badge ${item.level==='good'?'good':item.level==='bad'?'bad':'warn'}">${esc(item.phase)}</span>
      </div>
      <p>${esc(item.detail)}</p>
      ${run?`<div class="notice"><b>Current optimized deck:</b> objective ${run.decks[0]?.metrics?.objective??0}, low-gap index ${run.decks[0]?.metrics?.gapIndex??0}, weakest-Bey floor ${run.decks[0]?.metrics?.floor??0}.</div>`:''}
      <div class="notice"><b>Adaptive evidence:</b> Minimum four matches and maximum sixteen per matchup. The coach extends only while the result remains uncertain.</div>
      <div class="actions">
        <button class="btn" data-coach-action="${esc(item.action)}" ${item.testId?`data-test-id="${esc(item.testId)}"`:''}>${esc(item.label)}</button>
        <button class="btn secondary" data-run-optimizer>Recalculate Deck</button>
        <button class="btn secondary" data-new-test>Manual Test</button>
      </div>
    </section>

    ${repairs.length?`
      <section class="card">
        <div class="top">
          <div>
            <div class="eyebrow">ONE-VARIABLE REPAIR</div>
            <h2>Repair ${esc(rejectedBuild?.name||'failed build')} without widening deck gaps</h2>
          </div>
          <span class="badge warn">${repairs.length} controlled alternatives</span>
        </div>
        ${repairs.map((repair,index)=>`
          <article class="queue">
            <div class="top">
              <div>
                <b>${esc(repair.changed)}: ${esc(repair.from)} → ${esc(repair.to)}</b>
                <div class="muted">${esc(repair.build.name)}</div>
              </div>
              <span class="badge ${repair.objectiveGain>=0?'good':'warn'}">Objective ${repair.objectiveGain>=0?'+':''}${repair.objectiveGain} · Gap ${repair.gapGain>=0?'+':''}${repair.gapGain}</span>
            </div>
            <div class="actions"><button class="btn secondary" data-apply-repair="${index}">Apply Repair</button></div>
          </article>`).join('')}
      </section>`:''}

    <section class="card">
      <h2>Active Matchup</h2>
      ${active.length?active.map(testCard).join(''):'<p class="muted">No active matchup.</p>'}
    </section>

    <section class="card">
      <h2>Research Queue and Decisions</h2>
      ${queue.length?queue.slice().sort((a,b)=>(b.updated||'').localeCompare(a.updated||'')).map(testCard).join(''):
        '<p class="muted">No completed or queued tests.</p>'}
    </section>

    <section class="card">
      <h2>Research Notebook</h2>
      ${S.notebook.length?S.notebook.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(entry=>`
        <article class="queue">
          <b>${esc(entry.title)}</b>
          <p class="tiny">${new Date(entry.date).toLocaleString()}</p>
          <p><b>Result:</b> ${esc(entry.result)}</p>
          <p><b>Decision:</b> ${esc(entry.decision)}</p>
          <p><b>Scope:</b> ${esc(entry.scope||'Owned-pool controlled matchup')}</p>
        </article>`).join(''):'<p class="muted">No completed matchup decisions.</p>'}
    </section>

    <section class="card">
      <h2>Coach Decision Log</h2>
      ${logs.length?logs.map(log=>`
        <div class="log-row">
          <span class="badge">${esc(log.type)}</span>
          <div><b>${esc(log.message)}</b><span>${new Date(log.date).toLocaleString()}</span></div>
        </div>`).join(''):'<p class="muted">No coach actions recorded.</p>'}
    </section>
    <div id="modal"></div>
  `;
}

function savedMatchPanel(){
  const save=S.lastSave;
  if(!save)return '';
  return `<section class="card hero">
    <div class="top">
      <div>
        <div class="eyebrow">${save.complete?'COACH DECISION':'MATCH SAVED'}</div>
        <h2>${esc(save.summary)}</h2>
      </div>
      <span class="badge ${save.decision==='pass'?'good':save.decision==='fail'?'bad':'warn'}">${save.done}/${save.target}</span>
    </div>
    <div class="notice">${esc(save.reason)}</div>
    <div class="actions">
      ${save.complete?
        '<button class="btn good" data-coach-action="plan-test">Coach Continue Workflow</button>':
        `<button class="btn good" data-start-test="${esc(save.testId)}">Start Next Match</button>`}
      <button class="btn secondary" data-go="lab">Open Lab</button>
    </div>
  </section>`;
}

function battlePage(){
  const battle=S.battle;
  if(!battle){
    return savedMatchPanel()||`
      <section class="card">
        <h2>No active match</h2>
        <p class="muted">Use the Smart Coach to start the highest-value matchup.</p>
        <button class="btn" data-coach-action="plan-test">Coach Start Matchup</button>
      </section>`;
  }

  const complete=battle.aScore>=4||battle.bScore>=4;
  return `
    <section class="card hero">
      <div class="scoreboard">
        <div><b>${esc(battle.a)}</b><div class="score">${battle.aScore}</div></div>
        <div>VS</div>
        <div><b>${esc(battle.b)}</b><div class="score">${battle.bScore}</div></div>
      </div>
    </section>

    ${complete?`
      <section class="card">
        <h2>${esc(battle.aScore>battle.bScore?battle.a:battle.b)} wins</h2>
        <div class="actions">
          <button class="btn good" data-save-match>Save and Let Coach Evaluate</button>
          <button class="btn secondary" data-undo>Undo</button>
          <button class="btn danger" data-discard>Discard</button>
        </div>
      </section>`:
      `${finishButtons('a',battle.a)}${finishButtons('b',battle.b)}
       <div class="actions"><button class="btn secondary" data-undo>Undo</button><button class="btn danger" data-discard>Cancel Match</button></div>`}

    <section class="card">
      <h2>Round Log</h2>
      ${battle.rounds.length?`
        <div class="scroll"><table>
          <tr><th>#</th><th>Winner</th><th>Finish</th><th>Points</th><th>Own exit</th></tr>
          ${battle.rounds.map((round,index)=>`<tr>
            <td>${index+1}</td><td>${esc(round.side==='a'?battle.a:battle.b)}</td>
            <td>${esc(round.finish)}</td><td>${round.points}</td><td>${round.own?'Yes':'No'}</td>
          </tr>`).join('')}
        </table></div>`:'<p class="muted">No rounds recorded.</p>'}
    </section>
    ${S.pending?ownFinishModal():''}
  `;
}

function finishButtons(side,name){
  const finishes=[['Spin',1],['Burst',2],['Over',2],['Xtreme',3]];
  return `<section class="card">
    <h2>${esc(name)}</h2>
    <div class="finish-grid">
      ${finishes.map(([finish,points])=>`
        <button class="finish" data-finish="${side}|${finish}|${points}">
          ${finish}<small>${points} point${points>1?'s':''}</small>
        </button>`).join('')}
    </div>
  </section>`;
}

function ownFinishModal(){
  return `<div class="modal"><div class="card">
    <h2>Own finish?</h2>
    <p class="muted">Select Yes only when the losing Bey entered the zone without opponent contact.</p>
    <div class="actions">
      <button class="btn secondary" data-own="false">No</button>
      <button class="btn danger" data-own="true">Yes</button>
    </div>
  </div></div>`;
}

function evidencePage(){
  const stats=aggregate(S.matches);
  const run=latestOptimization();
  const top=run?.decks?.[0];
  const assigned=assignedDeck();
  const legality=assignedLegality();

  return `
    <section class="card hero">
      <div class="top">
        <div>
          <div class="eyebrow">LOW-GAP EVIDENCE BOARD</div>
          <h2>What the optimizer and recorded matches support</h2>
        </div>
        <span class="badge ${assigned.length===3&&assigned.every(build=>evidence(build).ready)?'good':'warn'}">
          ${assigned.filter(build=>evidence(build).ready).length}/3 serious candidates
        </span>
      </div>
      <div class="notice">A “Serious Candidate” requires official deck legality, positive point differential, controlled self-exit rate, and passed evidence against at least two contrasting owned opponents.</div>
    </section>

    ${top?`
      <section class="grid">
        <div class="metric"><b>${top.metrics.objective}</b><span>Deck objective</span></div>
        <div class="metric"><b>${top.metrics.gapIndex}</b><span>Low-gap index</span></div>
        <div class="metric"><b>${top.metrics.floor}</b><span>Weakest-Bey floor</span></div>
        <div class="metric"><b>${top.metrics.coverageGap}</b><span>Role-coverage gap</span></div>
      </section>`:''}

    <section class="card">
      <div class="scroll">
        <table>
          <tr><th>Build</th><th>Role</th><th>Record</th><th>Win %</th><th>Diff</th><th>Coach status</th></tr>
          ${S.builds.length?S.builds.slice().sort((a,b)=>evidence(b).score-evidence(a).score).map(build=>{
            const row=stats.find(stat=>stat.name===build.name);
            const result=evidence(build);
            return `<tr>
              <td>${esc(build.name)}</td><td>${esc(buildRole(build))}</td>
              <td>${row?`${row.w}-${row.l}`:'0-0'}</td>
              <td>${row?`${(row.winRate*100).toFixed(1)}%`:'—'}</td>
              <td>${row?`${row.diff>=0?'+':''}${row.diff}`:'—'}</td>
              <td><span class="badge ${result.ready?'good':result.score>=30?'warn':''}">${esc(result.label)} ${result.score}%</span></td>
            </tr>`;
          }).join(''):'<tr><td colspan="6" class="muted">No builds available.</td></tr>'}
        </table>
      </div>
    </section>

    <section class="card">
      <div class="top">
        <h2>Applied final-deck review</h2>
        <span class="badge ${legality.legal?'good':'bad'}">${legality.legal?'Officially legal':'Not legal'}</span>
      </div>
      ${legality.issues.length?`<div class="notice">${legality.issues.map(esc).join('<br>')}</div>`:''}
      ${assigned.length?assigned.map(deckBuildCard).join(''):'<p class="muted">No assigned deck.</p>'}
    </section>
  `;
}

function optimizationRunPayload(result){
  return {
    id:uid(),
    date:new Date().toISOString(),
    signature:optimizationSignature(),
    generated:result.generated,
    frontier:result.frontier,
    triplesEvaluated:result.triplesEvaluated,
    decks:result.decks,
    objective:'Low Gap Championship',
    rulesVersion:'Takara Tomy Regulation 12th edition, March 2026'
  };
}

async function runOptimizer(){
  if(!S.parts.length){
    S.page='collection';
    render();
    return;
  }

  const result=optimizeDecks(S.parts,S.builds,S.tests,S.matches,S.catalog,10,{anchorPart:ANCHOR_PART,requireAnchor:S.parts.some(part=>part.name===ANCHOR_PART&&part.qty>0)});
  if(!result.decks.length){
    alert('No official-legal three-Bey deck could be generated from the recorded collection.');
    return;
  }

  const run=optimizationRunPayload(result);
  await put('optimizationRuns',run);
  await logCoach(
    `Optimizer generated ${result.generated} legal builds and evaluated ${result.triplesEvaluated} official-legal deck triples. Best objective ${result.decks[0].metrics.objective}; gap index ${result.decks[0].metrics.gapIndex}.`,
    'optimization',
    {runId:run.id}
  );
  await reloadData();
  S.page='deck';
  render();
}

function candidateToSavedBuild(candidate,existing=null){
  return {
    id:existing?.id||uid(),
    system:candidate.system,
    blade:candidate.blade||'',
    lockChip:candidate.lockChip||'',
    mainBlade:candidate.mainBlade||'',
    assistBlade:candidate.assistBlade||'',
    overBlade:candidate.overBlade||'',
    metalBlade:candidate.metalBlade||'',
    ratchet:candidate.ratchet||'',
    bit:candidate.bit||'',
    integratedBit:candidate.integratedBit||'',
    name:candidate.name,
    role:candidate.role,
    status:existing?.status||'Optimizer Candidate',
    slot:existing?.slot||''
  };
}

async function applyOptimizedDeck(rank=0){
  let run=latestOptimization();
  if(!run){
    await runOptimizer();
    run=latestOptimization();
  }
  const entry=run?.decks?.[rank];
  if(!entry)return alert('The selected optimization result is unavailable.');

  const legality=officialDeckLegality(entry.deck,S.parts);
  if(!legality.legal)return alert(`Optimizer result is no longer legal: ${legality.issues.join(' · ')}`);

  const orderedDeck=entry.deck.slice().sort((a,b)=>{
    const aAnchor=buildPartEntries(a).some(part=>part.name===ANCHOR_PART)?0:1;
    const bAnchor=buildPartEntries(b).some(part=>part.name===ANCHOR_PART)?0:1;
    return aAnchor-bAnchor||a.role.localeCompare(b.role);
  });

  const selected=[];
  for(let index=0;index<orderedDeck.length;index++){
    const candidate=orderedDeck[index];
    const existing=S.builds.find(build=>build.name===candidate.name);
    const saved=candidateToSavedBuild(candidate,existing);
    saved.slot=`Bey ${index+1}`;
    saved.status=existing?.status||'Optimizer Candidate';
    await put('builds',saved);
    selected.push(saved);
  }

  const selectedIds=new Set(selected.map(build=>build.id));
  for(const build of S.builds){
    if(selectedIds.has(build.id))continue;
    if(['Bey 1','Bey 2','Bey 3'].includes(build.slot)){
      build.slot='';
      await put('builds',build);
    }
  }

  run.appliedAt=new Date().toISOString();
  run.appliedRank=rank;
  run.appliedDeckNames=selected.map(build=>build.name);
  await put('optimizationRuns',run);
  await logCoach(
    `Applied optimization rank ${rank+1}: ${selected.map(build=>build.name).join(' / ')}. Performance gap ${entry.metrics.scoreGap}; coverage gap ${entry.metrics.coverageGap}; evidence gap ${entry.metrics.evidenceGap}.`,
    'deck',
    {runId:run.id,rank}
  );
  await reloadData();
  S.page='deck';
  render();
}

async function applyRepair(index){
  const repairs=repairSuggestions();
  const repair=repairs[index];
  const rejected=latestRejectedTest();
  const target=S.builds.find(build=>build.id===rejected?.aId);
  if(!repair||!target)return alert('The repair suggestion is no longer available.');

  const replacement=candidateToSavedBuild(repair.build,S.builds.find(build=>build.name===repair.build.name));
  replacement.slot=target.slot;
  replacement.status='Repair Candidate';
  await put('builds',replacement);

  target.slot='';
  await put('builds',target);

  await logCoach(
    `Applied one-variable repair: ${repair.changed} ${repair.from} → ${repair.to}. Objective change ${repair.objectiveGain>=0?'+':''}${repair.objectiveGain}; gap-index change ${repair.gapGain>=0?'+':''}${repair.gapGain}.`,
    'repair',
    {fromBuild:target.name,toBuild:replacement.name}
  );
  await reloadData();
  await runOptimizer();
}

function pairCount(aId,bId){
  return S.tests.filter(test=>
    (test.aId===aId&&test.bId===bId)||(test.aId===bId&&test.bId===aId)
  ).length;
}

function chooseCoachPair(){
  const assigned=assignedDeck();
  if(assigned.length<2)return {};

  const optimized=topOptimization()?.deck||[];
  const metadata=new Map(optimized.map(build=>[build.name,build]));

  const focus=assigned.slice().sort((a,b)=>{
    const aPassed=S.tests.filter(test=>test.aId===a.id&&test.status==='Passed').length;
    const bPassed=S.tests.filter(test=>test.aId===b.id&&test.status==='Passed').length;
    const aMeta=metadata.get(a.name);
    const bMeta=metadata.get(b.name);
    return (
      aPassed-bPassed ||
      (aMeta?.evidenceScore??evidence(a).score)-(bMeta?.evidenceScore??evidence(b).score) ||
      (aMeta?.overall??50)-(bMeta?.overall??50)
    );
  })[0];

  const opponents=assigned.filter(build=>build.id!==focus.id).sort((a,b)=>{
    const aContrast=buildRole(a)!==buildRole(focus)?0:1;
    const bContrast=buildRole(b)!==buildRole(focus)?0:1;
    return (
      pairCount(focus.id,a.id)-pairCount(focus.id,b.id) ||
      aContrast-bContrast ||
      evidence(b).score-evidence(a).score
    );
  });

  return {focus,opponent:opponents[0]};
}

async function createCoachTest(){
  if(!latestOptimization()){
    await runOptimizer();
    return;
  }

  if(!optimizationApplied()){
    await applyOptimizedDeck(0);
    await reloadData();
  }

  const legality=assignedLegality();
  if(!legality.legal){
    alert(`The applied deck is not official-legal: ${legality.issues.join(' · ')}`);
    return;
  }

  const {focus,opponent}=chooseCoachPair();
  if(!focus||!opponent){
    alert('A legal optimized deck with at least two builds is required.');
    return;
  }

  for(const test of S.tests.filter(test=>test.status==='Active')){
    test.status='Paused';
    await put('tests',test);
  }

  let project=S.projects.find(row=>row.status==='Active');
  if(!project){
    project={
      id:uid(),
      question:`Can ${focus.name} maintain the low-gap optimized deck against ${opponent.name}?`,
      conditions:'Same stadium, alternating launch order, unchanged builds, and consistent launch intent.',
      status:'Active',
      created:new Date().toISOString()
    };
    await put('projects',project);
  }

  const test={
    id:uid(),projectId:project.id,aId:focus.id,bId:opponent.id,
    target:4,status:'Active',managed:true,created:new Date().toISOString(),updated:new Date().toISOString()
  };
  await put('tests',test);
  await logCoach(
    `Planned ${focus.name} vs ${opponent.name}. The focus build was selected because it has the lowest current evidence or floor contribution within the optimized deck.`,
    'planning',
    {testId:test.id}
  );
  await reloadData();
  startTest(test.id);
}

async function activateTest(id){
  for(const test of S.tests){
    if(test.id===id)test.status='Active';
    else if(test.status==='Active')test.status='Paused';
    await put('tests',test);
  }
  await reloadData();
  startTest(id);
}

function startTest(id){
  const test=S.tests.find(row=>row.id===id);
  const focus=S.builds.find(row=>row.id===test?.aId);
  const opponent=S.builds.find(row=>row.id===test?.bId);
  if(!test||!focus||!opponent){
    alert('The test or one of its builds is missing.');
    return;
  }
  S.lastSave=null;
  S.battle={
    id:uid(),testId:test.id,
    a:focus.name,b:opponent.name,
    aScore:0,bScore:0,rounds:[]
  };
  S.page='battle';
  render();
}

async function runCoach(action,testId){
  if(action==='load-confirmed')return loadConfirmedCollection();
  if(action==='optimize'||action==='formulate')return runOptimizer();
  if(action==='apply-best'||action==='assign')return applyOptimizedDeck(0);
  if(action==='plan-test')return createCoachTest();
  if(action==='continue-test')return startTest(testId);
  if(action==='activate-test')return activateTest(testId);
  if(action==='review-deck')return go('deck');
  if(action==='review-lab')return go('lab');
}

async function loadConfirmedCollection(){
  let added=0;
  const missing=[];

  for(const code of CONFIRMED_PRODUCTS){
    const product=S.catalog.find(row=>row.code===code);
    if(!product){missing.push(code);continue;}
    const existing=S.productsOwned.find(row=>row.code===code);
    const parts=product.parts||[];
    let changed=false;

    for(const part of parts){
      let owned=S.parts.find(row=>row.category===part.category&&row.name===part.name);
      const alreadySourced=owned&&sourceTokens(owned).includes(code);
      if(alreadySourced)continue;

      if(owned){
        owned.qty+=1;
        const sources=new Set(sourceTokens(owned));
        sources.add(code);
        owned.source=[...sources].join('; ');
      }else{
        owned={id:uid(),category:part.category,name:part.name,qty:1,source:code};
      }
      await put('parts',owned);
      changed=true;
    }

    if(!existing?.qty){
      await put('productsOwned',{id:code,code,qty:1});
      changed=true;
    }
    if(changed)added++;
  }

  await logCoach(`Loaded ${added} confirmed owned products.${missing.length?` Missing catalog codes: ${missing.join(', ')}.`:''}`,'collection');
  await reloadData();
  S.page='collection';
  render();
}

async function addProduct(product,parts,ownedCode,qty){
  for(const part of parts){
    let owned=S.parts.find(row=>row.category===part.category&&row.name===part.name);
    if(owned){
      owned.qty+=qty;
      const sources=new Set(sourceTokens(owned));
      sources.add(ownedCode);
      owned.source=[...sources].join('; ');
    }else{
      owned={id:uid(),category:part.category,name:part.name,qty,source:ownedCode};
    }
    await put('parts',owned);
  }

  const existing=S.productsOwned.find(row=>row.code===ownedCode)||{id:ownedCode,code:ownedCode,qty:0};
  existing.qty+=qty;
  await put('productsOwned',existing);
  await reloadData();
  render();
}

function productModal(code){
  const product=S.catalog.find(row=>row.code===code);
  const variants=product.variants||[];
  $('#modal').innerHTML=`<div class="modal"><div class="card">
    <h2>${esc(product.code)} — ${esc(product.name)}</h2>
    ${variants.length?`
      <label>Exact variant</label>
      <select id="variantSelect">${variants.map(variant=>`<option value="${esc(variant.id)}">${esc(variant.id)} — ${esc(variant.name)}</option>`).join('')}</select>`:''}
    <div id="partsPreview"></div>
    <label>Quantity owned</label><input id="productQty" type="number" min="1" value="1">
    <div class="actions"><button class="btn good" id="addProduct">Add Product</button><button class="btn secondary" id="closeModal">Close</button></div>
  </div></div>`;

  const preview=()=>{
    const variant=variants.length?variants.find(row=>row.id===$('#variantSelect').value):null;
    const parts=variant?.parts||product.parts||[];
    $('#partsPreview').innerHTML=parts.map(part=>`<div class="part-preview"><span>${esc(part.category)}</span><b>${esc(part.name)}</b></div>`).join('');
  };

  $('#variantSelect')?.addEventListener('change',preview);
  $('#closeModal').onclick=render;
  $('#addProduct').onclick=async()=>{
    const variant=variants.length?variants.find(row=>row.id===$('#variantSelect').value):null;
    const parts=variant?.parts||product.parts||[];
    const ownedCode=variant?`${product.code}-${variant.id}`:product.code;
    const qty=Math.max(1,+$('#productQty').value||1);
    await addProduct(product,parts,ownedCode,qty);
  };
  preview();
}

function partOptions(category,selected=''){
  const rows=S.parts.filter(part=>part.category===category&&part.qty>0);
  return rows.length?rows.map(part=>`<option ${part.name===selected?'selected':''}>${esc(part.name)}</option>`).join(''):
    `<option value="">No owned ${esc(category)}</option>`;
}

function partModal(id=null){
  const part=id?S.parts.find(row=>row.id===id):{id:uid(),category:'Blade',name:'',qty:1,source:'Loose / independent'};
  const categories=['Blade','Ratchet','Bit','Lock Chip','Main Blade','Assist Blade','Over Blade','Metal Blade','Ratchet Integrated Bit'];
  $('#modal').innerHTML=`<div class="modal"><div class="card">
    <h2>${id?'Edit':'Add'} Part</h2>
    <label>Category</label><select id="partCategory">${categories.map(category=>`<option ${category===part.category?'selected':''}>${category}</option>`).join('')}</select>
    <label>Name</label><input id="partName" value="${esc(part.name)}">
    <label>Quantity</label><input id="partQty" type="number" min="0" value="${part.qty}">
    <label>Source</label><input id="partSource" value="${esc(part.source||'')}">
    <div class="actions">
      <button class="btn" id="savePart">Save</button>
      ${id?'<button class="btn danger" id="deletePart">Delete</button>':''}
      <button class="btn secondary" id="closeModal">Close</button>
    </div>
  </div></div>`;

  $('#closeModal').onclick=render;
  $('#savePart').onclick=async()=>{
    const row={
      id:part.id,category:$('#partCategory').value,
      name:$('#partName').value.trim(),
      qty:Math.max(0,+$('#partQty').value||0),
      source:$('#partSource').value.trim()
    };
    if(!row.name)return alert('Enter a part name.');
    await put('parts',row);
    await reloadData();
    render();
  };
  if(id)$('#deletePart').onclick=async()=>{
    if(S.builds.some(build=>buildParts(build).includes(part.name)))return alert('This part is used by a saved build.');
    await remove('parts',part.id);
    await reloadData();
    render();
  };
}

function buildFields(system,build){
  if(system==='CX Expand')return `
    <label>Lock Chip</label><select id="lockChip">${partOptions('Lock Chip',build.lockChip)}</select>
    <label>Over Blade</label><select id="overBlade">${partOptions('Over Blade',build.overBlade)}</select>
    <label>Metal Blade</label><select id="metalBlade">${partOptions('Metal Blade',build.metalBlade)}</select>
    <label>Assist Blade</label><select id="assistBlade">${partOptions('Assist Blade',build.assistBlade)}</select>
    <label>Ratchet</label><select id="ratchet">${partOptions('Ratchet',build.ratchet)}</select>
    <label>Bit</label><select id="bit">${partOptions('Bit',build.bit)}</select>`;
  if(system==='CX Integrated')return `
    <label>Lock Chip</label><select id="lockChip">${partOptions('Lock Chip',build.lockChip)}</select>
    <label>Main Blade</label><select id="mainBlade">${partOptions('Main Blade',build.mainBlade)}</select>
    <label>Assist Blade</label><select id="assistBlade">${partOptions('Assist Blade',build.assistBlade)}</select>
    <label>Integrated Ratchet/Bit</label><select id="integratedBit">${partOptions('Ratchet Integrated Bit',build.integratedBit)}</select>`;
  if(system==='CX')return `
    <label>Lock Chip</label><select id="lockChip">${partOptions('Lock Chip',build.lockChip)}</select>
    <label>Main Blade</label><select id="mainBlade">${partOptions('Main Blade',build.mainBlade)}</select>
    <label>Assist Blade</label><select id="assistBlade">${partOptions('Assist Blade',build.assistBlade)}</select>
    <label>Ratchet</label><select id="ratchet">${partOptions('Ratchet',build.ratchet)}</select>
    <label>Bit</label><select id="bit">${partOptions('Bit',build.bit)}</select>`;
  return `
    <label>Blade</label><select id="blade">${partOptions('Blade',build.blade)}</select>
    <label>Ratchet</label><select id="ratchet">${partOptions('Ratchet',build.ratchet)}</select>
    <label>Bit</label><select id="bit">${partOptions('Bit',build.bit)}</select>`;
}

function buildModal(id=null){
  if(!S.parts.length)return alert('Record owned parts first.');
  const build=id?S.builds.find(row=>row.id===id):{
    id:uid(),system:'Standard',role:'Balance',slot:'',status:'Experimental'
  };
  const initial=buildSystem(build);

  $('#modal').innerHTML=`<div class="modal"><div class="card">
    <h2>${id?'Edit':'Add'} Build</h2>
    <label>System</label><select id="buildSystem">${['Standard','CX','CX Integrated','CX Expand'].map(system=>`<option ${system===initial?'selected':''}>${system}</option>`).join('')}</select>
    <div id="buildFields"></div>
    <label>Role</label><select id="buildRole">${['Attack','Stamina','Defense','Balance'].map(role=>`<option ${role===buildRole(build)?'selected':''}>${role}</option>`).join('')}</select>
    <label>Deck slot</label><select id="buildSlot">${['','Bey 1','Bey 2','Bey 3'].map(slot=>`<option value="${slot}" ${slot===(build.slot||'')?'selected':''}>${slot||'Unassigned'}</option>`).join('')}</select>
    <div class="actions"><button class="btn" id="saveBuild">Save</button><button class="btn secondary" id="closeModal">Close</button></div>
  </div></div>`;

  const paint=()=>{$('#buildFields').innerHTML=buildFields($('#buildSystem').value,build)};
  $('#buildSystem').onchange=paint;
  $('#closeModal').onclick=render;
  $('#saveBuild').onclick=async()=>{
    const system=$('#buildSystem').value;
    const row={
      ...build,system,role:$('#buildRole').value,slot:$('#buildSlot').value,
      blade:$('#blade')?.value||'',
      lockChip:$('#lockChip')?.value||'',
      mainBlade:$('#mainBlade')?.value||'',
      assistBlade:$('#assistBlade')?.value||'',
      overBlade:$('#overBlade')?.value||'',
      metalBlade:$('#metalBlade')?.value||'',
      ratchet:$('#ratchet')?.value||'',
      bit:$('#bit')?.value||'',
      integratedBit:$('#integratedBit')?.value||''
    };
    row.name=buildName(row);
    if(!row.name)return alert('Complete the build.');
    await put('builds',row);
    await reloadData();
    render();
  };
  paint();
}

async function deleteBuild(id){
  if(S.tests.some(test=>test.aId===id||test.bId===id))return alert('This build is used by a saved test.');
  if(!confirm('Delete this build?'))return;
  await remove('builds',id);
  await reloadData();
  render();
}

function projectModal(){
  const project={id:uid(),question:'',conditions:'Same stadium, alternating launch order, unchanged builds.',status:'Active'};
  $('#modal').innerHTML=`<div class="modal"><div class="card">
    <h2>Add Research Project</h2>
    <label>Question</label><textarea id="projectQuestion"></textarea>
    <label>Fixed conditions</label><textarea id="projectConditions">${esc(project.conditions)}</textarea>
    <div class="actions"><button class="btn" id="saveProject">Save</button><button class="btn secondary" id="closeModal">Close</button></div>
  </div></div>`;
  $('#closeModal').onclick=render;
  $('#saveProject').onclick=async()=>{
    project.question=$('#projectQuestion').value.trim();
    project.conditions=$('#projectConditions').value.trim();
    if(!project.question)return alert('Enter a research question.');
    await put('projects',project);
    await reloadData();
    render();
  };
}

function buildSelect(selected){
  return S.builds.map(build=>`<option value="${esc(build.id)}" ${build.id===selected?'selected':''}>${esc(build.name)}</option>`).join('');
}

function testModal(id=null){
  if(S.builds.length<2)return alert('Create at least two builds.');
  const test=id?S.tests.find(row=>row.id===id):{
    id:uid(),projectId:S.projects.find(row=>row.status==='Active')?.id||'',
    aId:S.builds[0].id,bId:S.builds[1].id,target:4,status:'Planned',managed:false
  };
  $('#modal').innerHTML=`<div class="modal"><div class="card">
    <h2>${id?'Edit':'Add'} Adaptive Matchup</h2>
    <label>Focus</label><select id="testFocus">${buildSelect(test.aId)}</select>
    <label>Opponent</label><select id="testOpponent">${buildSelect(test.bId)}</select>
    <div class="notice">The coach evaluates after every match, with a four-match minimum and sixteen-match maximum.</div>
    <label>Status</label><select id="testStatus">${['Active','Planned','Paused','Passed','Rejected','Inconclusive'].map(status=>`<option ${status===test.status?'selected':''}>${status}</option>`).join('')}</select>
    <div class="actions"><button class="btn" id="saveTest">Save</button><button class="btn secondary" id="closeModal">Close</button></div>
  </div></div>`;
  $('#closeModal').onclick=render;
  $('#saveTest').onclick=async()=>{
    const row={...test,aId:$('#testFocus').value,bId:$('#testOpponent').value,status:$('#testStatus').value,target:4,updated:new Date().toISOString()};
    if(row.aId===row.bId)return alert('Choose different builds.');
    await put('tests',row);
    await reloadData();
    render();
  };
}

async function deleteTest(id){
  if(!confirm('Delete this test and keep its recorded matches?'))return;
  await remove('tests',id);
  await reloadData();
  render();
}

function finish(side,finishType,points){
  if(['Over','Xtreme'].includes(finishType)){
    S.pending={side,finish:finishType,points};
    render();
  }else{
    addRound(side,finishType,points,false);
  }
}

function confirmOwn(own){
  const pending=S.pending;
  S.pending=null;
  addRound(pending.side,pending.finish,pending.points,own);
}

function addRound(side,finishType,points,own){
  S.battle.rounds.push({side,finish:finishType,points,own});
  if(side==='a')S.battle.aScore+=points;
  else S.battle.bScore+=points;
  render();
}

function undoRound(){
  if(S.pending){
    S.pending=null;
    render();
    return;
  }
  const round=S.battle?.rounds.pop();
  if(!round)return;
  if(round.side==='a')S.battle.aScore-=round.points;
  else S.battle.bScore-=round.points;
  render();
}

function discardBattle(){
  if(!confirm('Discard this unsaved match?'))return;
  S.battle=null;
  S.page='lab';
  render();
}

function notebookEntry(test,decision){
  const focus=S.builds.find(build=>build.id===test.aId);
  const opponent=S.builds.find(build=>build.id===test.bId);
  const record=decision.record;
  return {
    id:uid(),testId:test.id,projectId:test.projectId,date:new Date().toISOString(),
    title:`${focus?.name||'Focus'} vs ${opponent?.name||'Opponent'} — ${decision.status}`,
    result:`${record.wins}-${record.losses}; ${(record.rate*100).toFixed(1)}% focus-build win rate.`,
    decision:decision.reason,
    scope:'Owned-pool controlled matchup'
  };
}

async function updateBuildPromotion(test){
  const focus=S.builds.find(build=>build.id===test.aId);
  if(!focus)return;
  const result=buildEvidence(focus,S.builds,S.tests,S.matches);
  focus.status=result.ready?'Serious Candidate':result.score>=60?'Validated':result.score>=30?'Screened':'Experimental';
  await put('builds',focus);
}

async function saveMatch(){
  const match=S.battle;
  match.winner=match.aScore>match.bScore?match.a:match.b;
  match.date=new Date().toISOString();
  await put('matches',match);

  const test=S.tests.find(row=>row.id===match.testId);
  const decision=matchupDecision(test,S.builds,S.matches,match);
  test.updated=new Date().toISOString();
  test.target=decision.nextTarget;

  if(decision.status==='continue'){
    test.status='Active';
  }else{
    test.status=decision.status==='pass'?'Passed':decision.status==='fail'?'Rejected':'Inconclusive';
  }
  await put('tests',test);

  S.matches.push(match);
  if(decision.status!=='continue'){
    await put('notebook',notebookEntry(test,decision));
    await logCoach(`${test.status}: ${decision.reason}`,'decision',{testId:test.id});
    await reloadData();
    await updateBuildPromotion(test);
  }

  S.lastSave={
    testId:test.id,
    complete:decision.status!=='continue',
    decision:decision.status,
    done:decision.record.n,
    target:decision.status==='continue'?decision.nextTarget:decision.record.n,
    reason:decision.reason,
    summary:`${match.winner} won ${match.aScore}-${match.bScore}`
  };

  S.battle=null;
  await reloadData();
  S.page='battle';
  render();
}

async function exportData(){
  const payload=await dump();
  const link=document.createElement('a');
  link.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  link.download=`beylab-v3-backup-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
}

function importData(event){
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=async()=>{
    try{
      await restore(JSON.parse(reader.result));
      await reloadData();
      render();
    }catch(error){
      alert(`Invalid backup: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

async function resetAll(){
  if(!confirm('Erase collection, builds, tests, matches, notebook, and coach log?'))return;
  for(const store of STORES)await clear(store);
  await reloadData();
  S.page='home';
  render();
}

function filterProducts(){
  const query=($('#productSearch')?.value||'').toLowerCase();
  const line=$('#productLine')?.value||'All';
  $$('[data-product-row]').forEach(row=>{
    const visible=(!query||row.dataset.search.includes(query))&&(line==='All'||row.dataset.line===line);
    row.style.display=visible?'':'none';
  });
}

function bind(){
  $$('[data-go]').forEach(button=>button.onclick=()=>go(button.dataset.go));
  $$('[data-coach-action]').forEach(button=>button.onclick=()=>runCoach(button.dataset.coachAction,button.dataset.testId));
  $$('[data-run-optimizer]').forEach(button=>button.onclick=runOptimizer);
  $$('[data-apply-deck]').forEach(button=>button.onclick=()=>applyOptimizedDeck(+button.dataset.applyDeck||0));
  $$('[data-apply-repair]').forEach(button=>button.onclick=()=>applyRepair(+button.dataset.applyRepair||0));

  $('[data-load-confirmed]')?.addEventListener('click',loadConfirmedCollection);
  $('#productSearch')?.addEventListener('input',filterProducts);
  $('#productLine')?.addEventListener('change',filterProducts);
  $$('[data-product]').forEach(button=>button.onclick=()=>productModal(button.dataset.product));

  $('[data-new-part]')?.addEventListener('click',()=>partModal());
  $$('[data-edit-part]').forEach(button=>button.onclick=()=>partModal(button.dataset.editPart));

  $('[data-new-build]')?.addEventListener('click',()=>buildModal());
  $$('[data-edit-build]').forEach(button=>button.onclick=()=>buildModal(button.dataset.editBuild));
  $$('[data-delete-build]').forEach(button=>button.onclick=()=>deleteBuild(button.dataset.deleteBuild));

  $('[data-new-project]')?.addEventListener('click',projectModal);
  $('[data-new-test]')?.addEventListener('click',()=>testModal());
  $$('[data-edit-test]').forEach(button=>button.onclick=()=>testModal(button.dataset.editTest));
  $$('[data-delete-test]').forEach(button=>button.onclick=()=>deleteTest(button.dataset.deleteTest));
  $$('[data-start-test]').forEach(button=>button.onclick=()=>startTest(button.dataset.startTest));
  $$('[data-activate-test]').forEach(button=>button.onclick=()=>activateTest(button.dataset.activateTest));

  $$('[data-finish]').forEach(button=>button.onclick=()=>{
    const [side,type,points]=button.dataset.finish.split('|');
    finish(side,type,+points);
  });
  $$('[data-own]').forEach(button=>button.onclick=()=>confirmOwn(button.dataset.own==='true'));
  $('[data-undo]')?.addEventListener('click',undoRound);
  $('[data-discard]')?.addEventListener('click',discardBattle);
  $('[data-save-match]')?.addEventListener('click',saveMatch);

  $('[data-export]')?.addEventListener('click',exportData);
  $('[data-import]')?.addEventListener('click',()=>$('#importFile').click());
  $('#importFile')?.addEventListener('change',importData);
  $('[data-reset]')?.addEventListener('click',resetAll);
}

function showError(error){
  $('#app').innerHTML=`<div class="error card">
    <h2>V4 startup error</h2>
    <p>The app stopped instead of showing a blank screen.</p>
    <pre>${esc(error?.stack||error)}</pre>
    <button class="btn" onclick="location.reload()">Reload</button>
  </div>`;
}

window.addEventListener('error',event=>showError(event.error||event.message));
window.addEventListener('unhandledrejection',event=>showError(event.reason));

try{
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw-v4.js',{updateViaCache:'none'}).catch(()=>{});
  }
  await load();
}catch(error){
  showError(error);
}
