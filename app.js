(function () {
  'use strict';

  const D = window.XCC_DATA;
  const C = window.XCC_CORE;
  const STORAGE_KEY = 'xCommandCenterStateV1';
  let deferredInstallPrompt = null;
  let currentMissions = [];
  let missionCacheKey = '';
  let missionCache = [];
  let toastTimer = null;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const h = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  const pct = value => Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';
  const formatDate = value => {
    try { return new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'numeric' }).format(new Date(value)); }
    catch { return value || '—'; }
  };

  function defaultState() {
    const deckId = C.uid('deck');
    return {
      schemaVersion: D.meta.schemaVersion,
      ownedProducts: {},
      looseParts: {},
      decks: [{ id: deckId, name: 'Tournament Deck 1', beys: [C.emptyBey(0), C.emptyBey(1), C.emptyBey(2)] }],
      activeDeckId: deckId,
      battles: [],
      settings: { profileId: 'tt-v12', targetPerCell: 4, kidGuide: true },
      queueRotation: 0,
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeState(input) {
    const fallback = defaultState();
    if (!input || typeof input !== 'object') return fallback;
    const decks = Array.isArray(input.decks) && input.decks.length ? input.decks.map((deck, deckIndex) => ({
      id: deck.id || C.uid('deck'),
      name: String(deck.name || `Tournament Deck ${deckIndex + 1}`),
      beys: [0,1,2].map(index => C.normalizeBey(deck.beys?.[index], index))
    })) : fallback.decks;
    const activeDeckId = decks.some(deck => deck.id === input.activeDeckId) ? input.activeDeckId : decks[0].id;
    const settings = { ...fallback.settings, ...(input.settings || {}) };
    // Migration: v1 exposed an attack-mirror exclusion. v2 intentionally removes it.
    delete settings.avoidAttackMirrors;
    return {
      ...fallback,
      ...input,
      schemaVersion: D.meta.schemaVersion,
      ownedProducts: { ...(input.ownedProducts || {}) },
      looseParts: { ...(input.looseParts || {}) },
      decks,
      activeDeckId,
      battles: Array.isArray(input.battles) ? input.battles : [],
      settings,
      queueRotation: Number(input.queueRotation) || 0
    };
  }

  function loadState() {
    try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
    catch { return defaultState(); }
  }

  let state = loadState();

  function saveState(options = {}) {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (options.render !== false) renderAll();
  }

  function activeDeck() {
    return state.decks.find(deck => deck.id === state.activeDeckId) || state.decks[0];
  }

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function navigate(viewName) {
    $$('.view').forEach(view => {
      const active = view.dataset.view === viewName;
      view.classList.toggle('active', active);
      view.hidden = !active;
    });
    $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.nav === viewName));
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (viewName === 'test') renderTestLab();
    if (viewName === 'records') renderRecords();
    $('#main').focus({ preventScroll: true });
  }

  function renderAll() {
    renderGuideVisibility();
    renderCommand();
    renderCollection();
    renderDeckLab();
    renderTestLab();
    renderRecords();
    renderSettings();
  }

  function renderGuideVisibility() {
    $$('.guide-strip').forEach(element => { element.hidden = !state.settings.kidGuide; });
  }

  function missionsForCurrentState() {
    const key = `${state.updatedAt || ''}|${state.queueRotation || 0}|${state.activeDeckId || ''}`;
    if (key !== missionCacheKey) {
      missionCache = rotatedMissions(C.generateTestMissions(state, 8));
      missionCacheKey = key;
    }
    return missionCache;
  }

  function renderCommand() {
    const analysis = C.analyzeState(state);
    const deck = activeDeck();
    const inventory = C.getInventoryCounts(state);
    const inventoryTotal = Object.values(inventory).reduce((sum, qty) => sum + qty, 0);

    $('#readinessHero').innerHTML = `
      <div class="readiness-copy">
        <p class="eyebrow">Readiness ${analysis.validation.legal ? 'gate active' : 'blocked'}</p>
        <h2>${h(analysis.label)}</h2>
        <p>${analysis.validation.legal ? 'The score combines legality, controlled evidence, matchup coverage, confidence bounds, per-Bey testing, and ordinary self-KO exposure.' : 'Fix deck construction and owned-part capacity before tournament evidence can be assessed.'}</p>
      </div>
      <div class="score-ring" style="--score:${analysis.score}" role="img" aria-label="Readiness score ${analysis.score} out of 100"><strong>${analysis.score}</strong><small>of 100</small></div>`;

    $('#commandMetrics').innerHTML = [
      ['Legal deck', analysis.validation.legal ? 'Yes' : 'No', analysis.validation.legal ? 'Hard gate passed' : `${analysis.validation.errors.length} issue${analysis.validation.errors.length === 1 ? '' : 's'}`],
      ['Decided battles', analysis.decided.length, 'Target: 36'],
      ['Win rate', analysis.decided.length ? pct(analysis.winRate) : '—', `${analysis.wins} wins`],
      ['95% lower bound', analysis.decided.length ? pct(analysis.lower) : '—', 'Uncertainty-aware floor']
    ].map(([label,value,note]) => `<article class="metric-card"><span>${h(label)}</span><strong>${h(value)}</strong><small>${h(note)}</small></article>`).join('');

    currentMissions = missionsForCurrentState();
    const next = getNextAction(analysis, inventoryTotal, deck);
    $('#coachPriority').textContent = next.priority;
    $('#nextAction').innerHTML = `<div class="next-action-card"><span class="action-number">${next.step}</span><div><h3>${h(next.title)}</h3><p>${h(next.text)}</p><button class="button compact ${next.kind}" type="button" data-nav="${h(next.view)}">${h(next.button)}</button></div></div>`;

    $('#activeDeckSummary').innerHTML = deck.beys.map((bey, index) => {
      const complete = C.isCompleteBey(bey);
      return `<article class="bey-summary-card"><span class="bey-index">${index + 1}</span><div><strong>${h(C.beyName(bey))}</strong><small>${complete ? `Engineering ${C.engineeringScore(bey, state.battles).toFixed(1)}` : 'Choose all required parts'}</small></div><span class="role-badge">${h(complete ? C.roleOfBey(bey) : 'incomplete')}</span></article>`;
    }).join('');
    $('#deckLegalitySummary').className = `inline-status ${analysis.validation.legal ? 'good' : 'bad'}`;
    $('#deckLegalitySummary').textContent = analysis.validation.legal ? 'Legal and buildable from owned quantities.' : analysis.validation.errors[0] || 'Deck is not valid.';

    $('#commandQueue').innerHTML = currentMissions.length ? currentMissions.slice(0,3).map((mission, index) => missionCard(mission, index, false)).join('') : '<div class="empty-state">Add enough owned parts and complete a deck to generate controlled tests.</div>';

    renderCoverageMatrix(deck, analysis);
    $('#blockerList').innerHTML = analysis.blockers.length ? analysis.blockers.map(item => `<div class="stack-item">${h(item)}</div>`).join('') : '<div class="stack-item good">No current readiness blocker. Continue rotating tests to keep evidence current.</div>';
  }

  function getNextAction(analysis, inventoryTotal, deck) {
    if (!inventoryTotal) return { priority:'Priority 1', step:'1', title:'Add your physical collection', text:'The system has no usable parts. Mark owned Bey products or enter loose parts before building.', button:'Open collection', view:'collection', kind:'primary' };
    if (!deck.beys.every(C.isCompleteBey)) return { priority:'Priority 1', step:'2', title:'Complete all three Beys', text:'One or more deck slots are incomplete. Build manually or run the owned-parts optimizer.', button:'Open deck lab', view:'deck', kind:'primary' };
    if (!analysis.validation.legal) return { priority:'Priority 1', step:'2', title:'Repair deck legality', text:analysis.validation.errors[0] || 'The active deck fails a hard construction gate.', button:'Fix active deck', view:'deck', kind:'primary' };
    if (analysis.decided.length < 36 || analysis.blockers.length) return { priority:'Priority 1', step:'3', title:'Run the next controlled battle', text:currentMissions[0]?.reason || 'The deck needs broader evidence before readiness can be trusted.', button:'Start next mission', view:'test', kind:'primary' };
    return { priority:'Maintain', step:'4', title:'Review evidence and tournament plan', text:'The main gates are satisfied. Inspect records, finish routes, and order before the event.', button:'Review records', view:'records', kind:'secondary' };
  }

  function renderCoverageMatrix(deck, analysis) {
    const roles = ['attack','stamina','defense','balance'];
    const battles = analysis.decided;
    const target = Number(state.settings.targetPerCell || 4);
    $('#coverageLabel').textContent = `${Math.round(analysis.coverage * 100)}% target coverage`;
    const classFor = count => count >= target ? 'good' : count >= Math.ceil(target / 2) ? 'mid' : 'low';
    const countsFor = bey => {
      const sig = C.beySignature(bey);
      return roles.map(role => ({ role, count: battles.filter(b => b.ownSignature === sig && b.opponentRole === role).length }));
    };
    const head = roles.map(role => `<th>${h(role)}</th>`).join('');
    const rows = deck.beys.map((bey, index) => {
      const cells = countsFor(bey).map(({ count }) => `<td class="${classFor(count)}">${count}/${target}</td>`).join('');
      return `<tr><th>${index + 1}. ${h(C.beyName(bey))}</th>${cells}</tr>`;
    }).join('');
    const cards = deck.beys.map((bey, index) => `<article class="coverage-card"><div class="coverage-card-title"><span class="bey-index">${index + 1}</span><strong>${h(C.beyName(bey))}</strong></div><div class="coverage-role-grid">${countsFor(bey).map(({ role, count }) => `<div class="coverage-role ${classFor(count)}"><span>${h(role)}</span><strong>${count}/${target}</strong></div>`).join('')}</div></article>`).join('');
    $('#coverageMatrix').innerHTML = `<div class="coverage-table-wrap"><table class="coverage-table"><thead><tr><th>Deck Bey</th>${head}</tr></thead><tbody>${rows}</tbody></table></div><div class="coverage-mobile">${cards}</div>`;
  }

  function rotatedMissions(missions) {
    if (!missions.length) return missions;
    const offset = ((state.queueRotation || 0) % missions.length + missions.length) % missions.length;
    return [...missions.slice(offset), ...missions.slice(0, offset)];
  }

  function missionCard(mission, index, selectable = true) {
    const tag = selectable ? 'button' : 'article';
    const attrs = selectable ? `type="button" data-mission-key="${h(mission.pairingKey)}"` : '';
    return `<${tag} class="mission-card" ${attrs}>
      <div class="mission-card-top"><strong>Mission ${index + 1}</strong><span class="role-badge">${h(mission.opponentRole)}</span></div>
      <div class="matchup"><div><small>Your Bey</small><strong>${h(mission.ownName)}</strong></div><span class="vs">VS</span><div><small>Owned opponent</small><strong>${h(mission.opponentName)}</strong></div></div>
      <p>${h(mission.reason)}</p>
    </${tag}>`;
  }

  function renderCollection() {
    populateCollectionFilters();
    renderProducts();
    renderInventory();
    $('#catalogNotice').textContent = D.meta.catalogNotice;
  }

  function populateCollectionFilters() {
    const yearSelect = $('#productYear');
    if (yearSelect.options.length === 1) {
      const years = [...new Set(D.products.map(product => product.releaseDate.slice(0,4)))].sort((a,b) => b.localeCompare(a));
      years.forEach(year => yearSelect.insertAdjacentHTML('beforeend', `<option value="${year}">${year}</option>`));
    }
    const categorySelect = $('#partCategory');
    const looseCategory = $('#looseCategory');
    if (categorySelect.options.length === 1) D.categories.forEach(category => categorySelect.insertAdjacentHTML('beforeend', `<option value="${h(category.id)}">${h(category.label)}</option>`));
    if (!looseCategory.options.length) D.categories.forEach(category => looseCategory.insertAdjacentHTML('beforeend', `<option value="${h(category.id)}">${h(category.label)}</option>`));
    renderLoosePartOptions();
  }

  function renderProducts() {
    const query = $('#productSearch').value.trim().toLowerCase();
    const year = $('#productYear').value;
    const status = $('#productStatus').value;
    const sort = $('#productSort').value;
    let products = D.products.filter(product => {
      const searchText = `${product.id} ${product.name} ${product.parts.map(C.partName).join(' ')}`.toLowerCase();
      if (query && !searchText.includes(query)) return false;
      if (year !== 'all' && !product.releaseDate.startsWith(year)) return false;
      if (status === 'released' && product.status !== 'released') return false;
      if (status === 'owned' && !(state.ownedProducts[product.id] > 0)) return false;
      return true;
    });
    products.sort((a,b) => sort === 'oldest' ? a.releaseDate.localeCompare(b.releaseDate) : sort === 'code' ? a.id.localeCompare(b.id) : b.releaseDate.localeCompare(a.releaseDate));
    $('#productSummary').textContent = `${products.length} product${products.length === 1 ? '' : 's'} shown`;
    $('#productList').innerHTML = products.length ? products.map(product => {
      const qty = Number(state.ownedProducts[product.id]) || 0;
      const usable = product.status === 'released';
      const parts = product.parts.length ? product.parts.map(C.partName).join(' · ') : product.note || 'Exact mapped parts are not bundled.';
      return `<article class="product-card">
        <div class="product-card-head"><div><h3>${h(product.id)} · ${h(product.name)}</h3><div class="product-meta">${h(formatDate(product.releaseDate))} · ${h(product.type)}</div></div><span class="product-status ${h(product.status)}">${h(product.status)}</span></div>
        <p class="product-parts">${h(parts)}</p>
        <div class="quantity-control" aria-label="Owned quantity for ${h(product.id)}"><button type="button" data-product-change="-1" data-product-id="${h(product.id)}" ${qty <= 0 ? 'disabled' : ''}>−</button><output>${qty}</output><button type="button" data-product-change="1" data-product-id="${h(product.id)}" ${!usable ? 'disabled' : ''}>+</button></div>
      </article>`;
    }).join('') : '<div class="empty-state">No products match these filters.</div>';
  }

  function renderInventory() {
    const inventory = C.getInventoryCounts(state);
    const query = $('#partSearch').value.trim().toLowerCase();
    const category = $('#partCategory').value;
    const rows = D.parts.filter(part => (inventory[part.id] || 0) > 0).filter(part => {
      if (query && !`${part.name} ${part.code} ${part.line}`.toLowerCase().includes(query)) return false;
      if (category !== 'all' && part.category !== category) return false;
      return true;
    }).sort((a,b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    const total = Object.values(inventory).reduce((sum, qty) => sum + qty, 0);
    $('#inventorySummary').textContent = `${total} usable part instance${total === 1 ? '' : 's'}`;
    $('#inventoryList').innerHTML = rows.length ? rows.map(part => {
      const totalQty = inventory[part.id] || 0;
      const looseQty = Number(state.looseParts[part.id]) || 0;
      const productQty = totalQty - looseQty;
      return `<article class="inventory-row"><div><strong>${h(part.name)}${part.code ? ` · ${h(part.code)}` : ''}</strong><small>${h(D.categories.find(c => c.id === part.category)?.label || part.category)} · ${h(part.role)} · ${productQty} from products, ${looseQty} loose</small></div><div class="inventory-actions"><button type="button" data-loose-change="-1" data-part-id="${h(part.id)}" ${looseQty <= 0 ? 'disabled' : ''}>−</button><span class="inventory-qty">${totalQty}</span><button type="button" data-loose-change="1" data-part-id="${h(part.id)}">+</button></div></article>`;
    }).join('') : '<div class="empty-state">No owned parts match this view.</div>';
  }

  function renderLoosePartOptions() {
    const category = $('#looseCategory').value || D.categories[0].id;
    const select = $('#loosePart');
    const previous = select.value;
    select.innerHTML = D.parts.filter(part => part.category === category && part.status !== 'announced').sort((a,b) => a.name.localeCompare(b.name)).map(part => `<option value="${h(part.id)}">${h(part.name)}${part.code ? ` (${h(part.code)})` : ''}</option>`).join('');
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }

  function renderDeckLab() {
    const deck = activeDeck();
    const inventory = C.getInventoryCounts(state);
    $('#deckSelector').innerHTML = state.decks.map(item => `<option value="${h(item.id)}" ${item.id === deck.id ? 'selected' : ''}>${h(item.name)}</option>`).join('');
    $('#profileSelector').innerHTML = D.profiles.map(profile => `<option value="${h(profile.id)}" ${profile.id === state.settings.profileId ? 'selected' : ''}>${h(profile.name)}</option>`).join('');
    $('#deckEditor').innerHTML = deck.beys.map((bey, index) => renderBeyEditor(bey, index, inventory)).join('');
    const validation = C.validateDeck(deck, inventory, state.settings.profileId);
    $('#deckValidationBadge').textContent = validation.legal ? 'Legal' : 'Blocked';
    $('#deckValidationBadge').className = `status-chip ${validation.legal ? 'good' : 'bad'}`;
    $('#deckValidationDetails').innerHTML = validation.legal ? '<div class="stack-item good">Complete, no prohibited duplicate functional parts, and simultaneously buildable from owned quantities.</div>' : validation.errors.map(error => `<div class="stack-item">${h(error)}</div>`).join('');
  }

  function renderBeyEditor(bey, index, inventory) {
    const fields = architectureFields(bey.architecture);
    const selects = fields.map(field => {
      const partCategory = field.category;
      const current = bey[field.key];
      const options = D.parts.filter(part => part.category === partCategory && ((inventory[part.id] || 0) > 0 || part.id === current)).sort((a,b) => a.name.localeCompare(b.name));
      return `<label class="field"><span>${h(field.label)}</span><select data-bey-index="${index}" data-bey-field="${h(field.key)}"><option value="">Choose ${h(field.label.toLowerCase())}</option>${options.map(part => `<option value="${h(part.id)}" ${part.id === current ? 'selected' : ''}>${h(part.name)}${part.code ? ` · ${h(part.code)}` : ''} (${inventory[part.id] || 0} owned)</option>`).join('')}</select></label>`;
    }).join('');
    const complete = C.isCompleteBey(bey);
    return `<article class="bey-editor"><div class="bey-editor-head"><div><p class="eyebrow">Deck position ${index + 1}</p><h3>${h(C.beyName(bey))}</h3></div><span class="role-badge">${h(complete ? C.roleOfBey(bey) : 'incomplete')}</span></div><div class="bey-editor-fields"><label class="field"><span>Architecture</span><select data-bey-index="${index}" data-bey-field="architecture"><option value="standard" ${bey.architecture === 'standard' ? 'selected' : ''}>Basic / Unique</option><option value="custom" ${bey.architecture === 'custom' ? 'selected' : ''}>Custom Line</option><option value="expanded" ${bey.architecture === 'expanded' ? 'selected' : ''}>Expanded Custom Line</option><option value="integrated" ${bey.architecture === 'integrated' ? 'selected' : ''}>Ratchet-integrated blade</option></select></label>${selects}</div><div class="bey-preview"><strong>${h(C.beyName(bey))}</strong><small>${complete ? `Role: ${h(C.roleOfBey(bey))} · Engineering score ${C.engineeringScore(bey, state.battles).toFixed(1)}` : 'Complete all required fields.'}</small></div></article>`;
  }

  function architectureFields(architecture) {
    return {
      standard: [{key:'blade',category:'blade',label:'Blade'},{key:'ratchet',category:'ratchet',label:'Ratchet'},{key:'bit',category:'bit',label:'Bit'}],
      integrated: [{key:'integratedBlade',category:'ratchetIntegratedBlade',label:'Integrated blade'},{key:'bit',category:'bit',label:'Bit'}],
      custom: [{key:'lockChip',category:'lockChip',label:'Lock chip'},{key:'mainBlade',category:'mainBlade',label:'Main blade'},{key:'assistBlade',category:'assistBlade',label:'Assist blade'},{key:'ratchet',category:'ratchet',label:'Ratchet'},{key:'bit',category:'bit',label:'Bit'}],
      expanded: [{key:'lockChip',category:'lockChip',label:'Lock chip'},{key:'metalBlade',category:'metalBlade',label:'Metal blade'},{key:'overBlade',category:'overBlade',label:'Over blade'},{key:'assistBlade',category:'assistBlade',label:'Assist blade'},{key:'ratchet',category:'ratchet',label:'Ratchet'},{key:'bit',category:'bit',label:'Bit'}]
    }[architecture] || [];
  }

  function renderOptimizer() {
    const results = C.optimizeDecks(state, 8);
    $('#optimizerResults').innerHTML = results.length ? results.map((result, index) => `<article class="optimizer-card"><div class="panel-heading"><div><p class="eyebrow">Rank ${index + 1}</p><h3>Engineering score ${result.score.toFixed(1)}</h3></div><button class="button compact primary" type="button" data-apply-optimizer="${index}">Apply</button></div><div class="deck-summary-grid">${result.deck.beys.map((bey, beyIndex) => `<div class="bey-summary-card"><span class="bey-index">${beyIndex + 1}</span><div><strong>${h(C.beyName(bey))}</strong><small>${h(C.roleOfBey(bey))}</small></div></div>`).join('')}</div><p class="muted">Role spread: ${h(result.roles.join(' · '))}. Legal and simultaneously buildable under ${h(C.profileMap.get(state.settings.profileId)?.name || state.settings.profileId)}.</p></article>`).join('') : '<div class="empty-state">No legal three-Bey deck can be generated from the current owned inventory. Add more distinct blades, ratchets, and bits or complete the required Custom Line parts.</div>';
    $('#optimizerDialog').dataset.results = JSON.stringify(results.map(result => result.deck));
  }

  function renderTestLab() {
    currentMissions = missionsForCurrentState();
    $('#missionCount').textContent = `${currentMissions.length} available`;
    $('#testQueue').innerHTML = currentMissions.length ? currentMissions.map((mission,index) => missionCard(mission,index,true)).join('') : '<div class="empty-state">No legal owned-opponent mission is available. Complete a legal deck and add enough spare owned parts to build two Beys at the same time.</div>';
    const selectedKey = $('#battleForm').dataset.missionKey || '';
    const selected = currentMissions.find(mission => mission.pairingKey === selectedKey);
    if (!selected) clearSelectedMission();
    populateStadiums();
  }

  function populateStadiums() {
    const select = $('#battleStadium');
    if (!select.options.length) select.innerHTML = D.stadiums.map(stadium => `<option>${h(stadium)}</option>`).join('');
  }

  function selectMission(pairingKey) {
    const mission = currentMissions.find(item => item.pairingKey === pairingKey);
    if (!mission) return;
    $('#battleForm').dataset.missionKey = pairingKey;
    $$('.mission-card[data-mission-key]').forEach(card => card.classList.toggle('selected', card.dataset.missionKey === pairingKey));
    $('#selectedMissionStatus').textContent = 'Ready';
    $('#selectedMissionStatus').className = 'status-chip good';
    $('#selectedMission').className = 'selected-mission';
    $('#selectedMission').innerHTML = `<div class="matchup"><div><small>Your Bey</small><strong>${h(mission.ownName)}</strong></div><span class="vs">VS</span><div><small>Owned opponent</small><strong>${h(mission.opponentName)}</strong></div></div><p class="muted">${h(mission.reason)}</p>`;
    $('#saveBattleButton').disabled = false;
    $('#battleFormError').textContent = '';
    if (window.matchMedia('(max-width: 699px)').matches) {
      $('.record-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function clearSelectedMission() {
    $('#battleForm').dataset.missionKey = '';
    $('#selectedMissionStatus').textContent = 'No mission';
    $('#selectedMissionStatus').className = 'status-chip';
    $('#selectedMission').className = 'selected-mission empty-state';
    $('#selectedMission').textContent = 'Choose a mission from the queue.';
    $('#saveBattleButton').disabled = true;
    $$('.mission-card[data-mission-key]').forEach(card => card.classList.remove('selected'));
  }

  function renderRecords() {
    const analysis = C.analyzeState(state);
    $('#recordMetrics').innerHTML = [
      ['Decided', analysis.decided.length, 'Evidence trials'],
      ['Wins', analysis.wins, analysis.decided.length ? pct(analysis.winRate) : 'No rate'],
      ['Self-KO rate', analysis.decided.length ? pct(analysis.selfKoRate) : '—', 'Over/Xtreme losses'],
      ['Coverage', pct(analysis.coverage), 'Bey × role cells']
    ].map(([label,value,note]) => `<article class="metric-card"><span>${h(label)}</span><strong>${h(value)}</strong><small>${h(note)}</small></article>`).join('');
    const query = $('#recordSearch').value.trim().toLowerCase();
    const result = $('#recordResult').value;
    const records = [...state.battles].reverse().filter(record => {
      const text = `${record.ownName} ${record.opponentName} ${record.notes || ''} ${record.finish}`.toLowerCase();
      if (query && !text.includes(query)) return false;
      if (result === 'win' && (record.winner !== 'own' || record.excluded)) return false;
      if (result === 'loss' && (record.winner !== 'opponent' || record.excluded)) return false;
      if (result === 'excluded' && !record.excluded) return false;
      return true;
    });
    $('#recordCount').textContent = `${records.length} record${records.length === 1 ? '' : 's'}`;
    $('#recordList').innerHTML = records.length ? records.map(record => {
      const cls = record.excluded ? 'excluded' : record.winner === 'own' ? 'win' : 'loss';
      const resultText = record.excluded ? 'Excluded' : record.winner === 'own' ? 'Win' : 'Loss';
      return `<article class="record-card"><div class="record-card-head"><div><h3>${h(record.ownName)} vs ${h(record.opponentName)}</h3><div class="product-meta">${h(formatDate(record.createdAt))} · ${h(record.stadium || 'Stadium not recorded')}</div></div><span class="result-badge ${cls}">${resultText}</span></div><p>${h(record.finish)} finish · opponent role ${h(record.opponentRole)}${record.selfKo ? ' · ordinary self-KO recorded' : ''}${record.notes ? ` · ${h(record.notes)}` : ''}</p><div class="record-actions"><button class="button compact danger" type="button" data-delete-record="${h(record.id)}">Delete</button></div></article>`;
    }).join('') : '<div class="empty-state">No records match this view.</div>';
  }

  function renderSettings() {
    $('#settingTargetPerCell').value = state.settings.targetPerCell || 4;
    $('#settingKidGuide').checked = state.settings.kidGuide !== false;
  }

  function onBattleSubmit(event) {
    event.preventDefault();
    const mission = currentMissions.find(item => item.pairingKey === event.currentTarget.dataset.missionKey);
    if (!mission) { $('#battleFormError').textContent = 'Choose a current mission.'; return; }
    const form = new FormData(event.currentTarget);
    const input = {
      ownSignature: mission.ownSignature,
      opponentSignature: mission.opponentSignature,
      winner: form.get('winner'),
      finish: form.get('finish'),
      selfKo: form.get('selfKo') === 'yes'
    };
    const validation = C.validateBattleInput(input);
    if (!validation.valid) { $('#battleFormError').textContent = validation.errors.join(' '); return; }
    state.battles.push({
      id: C.uid('battle'),
      createdAt: new Date().toISOString(),
      deckId: state.activeDeckId,
      ownName: mission.ownName,
      opponentName: mission.opponentName,
      ownSignature: mission.ownSignature,
      opponentSignature: mission.opponentSignature,
      pairingKey: mission.pairingKey,
      ownParts: C.getBeyPartIds(mission.own),
      opponentParts: C.getBeyPartIds(mission.opponent),
      opponentRole: mission.opponentRole,
      winner: input.winner,
      finish: input.finish,
      points: D.scoring[input.finish] || 0,
      selfKo: input.selfKo,
      stadium: $('#battleStadium').value,
      position: $('#battlePosition').value,
      launch: $('#battleLaunch').value,
      excluded: $('#battleExcluded').checked,
      notes: $('#battleNotes').value.trim()
    });
    state.queueRotation = 0;
    event.currentTarget.reset();
    $('#battleStadium').selectedIndex = 0;
    $('#battlePosition').selectedIndex = 0;
    $('#battleLaunch').selectedIndex = 0;
    clearSelectedMission();
    saveState();
    showToast('Battle saved. The next queue has been recalculated.');
  }

  function updateProduct(productId, delta) {
    const product = C.productMap.get(productId);
    if (!product || product.status !== 'released') return;
    const next = Math.max(0, (Number(state.ownedProducts[productId]) || 0) + delta);
    if (next) state.ownedProducts[productId] = next;
    else delete state.ownedProducts[productId];
    saveState();
  }

  function updateLoosePart(partId, delta) {
    const next = Math.max(0, (Number(state.looseParts[partId]) || 0) + delta);
    if (next) state.looseParts[partId] = next;
    else delete state.looseParts[partId];
    saveState();
  }

  function resetArchitectureFields(bey, architecture) {
    const blank = C.emptyBey();
    return { ...blank, id: bey.id, architecture };
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const columns = ['createdAt','ownName','opponentName','opponentRole','winner','finish','points','selfKo','excluded','stadium','position','launch','notes'];
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [columns.join(','), ...state.battles.map(record => columns.map(key => quote(record[key])).join(','))].join('\n');
    downloadFile(`x-command-center-battles-${new Date().toISOString().slice(0,10)}.csv`, csv, 'text/csv;charset=utf-8');
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const nav = event.target.closest('[data-nav]');
      if (nav) { navigate(nav.dataset.nav); return; }
      const productButton = event.target.closest('[data-product-change]');
      if (productButton) { updateProduct(productButton.dataset.productId, Number(productButton.dataset.productChange)); return; }
      const looseButton = event.target.closest('[data-loose-change]');
      if (looseButton) { updateLoosePart(looseButton.dataset.partId, Number(looseButton.dataset.looseChange)); return; }
      const missionButton = event.target.closest('[data-mission-key]');
      if (missionButton) { selectMission(missionButton.dataset.missionKey); return; }
      const deleteRecord = event.target.closest('[data-delete-record]');
      if (deleteRecord) {
        if (confirm('Delete this battle record?')) {
          state.battles = state.battles.filter(record => record.id !== deleteRecord.dataset.deleteRecord);
          saveState();
        }
        return;
      }
      const closeDialog = event.target.closest('[data-close-dialog]');
      if (closeDialog) { document.getElementById(closeDialog.dataset.closeDialog)?.close(); return; }
      const optimizerApply = event.target.closest('[data-apply-optimizer]');
      if (optimizerApply) {
        const decks = JSON.parse($('#optimizerDialog').dataset.results || '[]');
        const suggestion = decks[Number(optimizerApply.dataset.applyOptimizer)];
        if (suggestion) {
          const deck = activeDeck();
          deck.beys = suggestion.beys.map((bey,index) => C.normalizeBey(bey,index));
          $('#optimizerDialog').close();
          saveState();
          showToast('Suggested deck applied. Run controlled tests before trusting it.');
        }
      }
    });

    $$('.segment').forEach(button => button.addEventListener('click', () => {
      $$('.segment').forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-selected', active); });
      $('#productsPanel').hidden = button.dataset.collectionTab !== 'products';
      $('#partsPanel').hidden = button.dataset.collectionTab !== 'parts';
    }));

    ['productSearch','productYear','productStatus','productSort'].forEach(id => document.getElementById(id).addEventListener(id === 'productSearch' ? 'input' : 'change', renderProducts));
    ['partSearch','partCategory'].forEach(id => document.getElementById(id).addEventListener(id === 'partSearch' ? 'input' : 'change', renderInventory));
    $('#clearProductFilters').addEventListener('click', () => { $('#productSearch').value=''; $('#productYear').value='all'; $('#productStatus').value='released'; $('#productSort').value='newest'; renderProducts(); });

    $('#openLoosePartButton').addEventListener('click', () => $('#loosePartDialog').showModal());
    $('#looseCategory').addEventListener('change', renderLoosePartOptions);
    $('#loosePartForm').addEventListener('submit', event => {
      event.preventDefault();
      const partId = $('#loosePart').value;
      const qty = Math.max(1, Math.min(20, Number($('#looseQuantity').value) || 1));
      updateLoosePart(partId, qty);
      $('#loosePartDialog').close();
      $('#looseQuantity').value = '1';
      showToast(`${C.partName(partId)} added to loose-parts inventory.`);
    });

    $('#deckSelector').addEventListener('change', event => { state.activeDeckId = event.target.value; saveState(); });
    $('#profileSelector').addEventListener('change', event => { state.settings.profileId = event.target.value; saveState(); });
    $('#deckEditor').addEventListener('change', event => {
      const select = event.target.closest('[data-bey-field]');
      if (!select) return;
      const index = Number(select.dataset.beyIndex);
      const field = select.dataset.beyField;
      const deck = activeDeck();
      if (field === 'architecture') deck.beys[index] = resetArchitectureFields(deck.beys[index], select.value);
      else deck.beys[index][field] = select.value;
      saveState();
    });
    $('#newDeckButton').addEventListener('click', () => {
      const name = prompt('Name the new deck:', `Tournament Deck ${state.decks.length + 1}`);
      if (!name?.trim()) return;
      const id = C.uid('deck');
      state.decks.push({ id, name:name.trim(), beys:[C.emptyBey(0),C.emptyBey(1),C.emptyBey(2)] });
      state.activeDeckId = id;
      saveState();
    });
    $('#renameDeckButton').addEventListener('click', () => {
      const deck = activeDeck();
      const name = prompt('Rename deck:', deck.name);
      if (!name?.trim()) return;
      deck.name = name.trim();
      saveState();
    });
    $('#cloneDeckButton').addEventListener('click', () => {
      const source = activeDeck();
      const id = C.uid('deck');
      state.decks.push({ id, name:`${source.name} Copy`, beys:source.beys.map((bey,index) => C.normalizeBey(JSON.parse(JSON.stringify(bey)),index)) });
      state.activeDeckId = id;
      saveState();
    });
    $('#deleteDeckButton').addEventListener('click', () => {
      if (state.decks.length === 1) { showToast('At least one deck must remain.'); return; }
      if (!confirm(`Delete ${activeDeck().name}?`)) return;
      state.decks = state.decks.filter(deck => deck.id !== state.activeDeckId);
      state.activeDeckId = state.decks[0].id;
      saveState();
    });
    $('#optimizeButton').addEventListener('click', () => { renderOptimizer(); $('#optimizerDialog').showModal(); });

    $('#refreshQueueButton').addEventListener('click', () => { state.queueRotation = (state.queueRotation || 0) + 1; saveState(); showToast('Queue rotated without changing saved evidence.'); });
    $('#battleForm').addEventListener('submit', onBattleSubmit);

    ['recordSearch','recordResult'].forEach(id => document.getElementById(id).addEventListener(id === 'recordSearch' ? 'input' : 'change', renderRecords));
    $('#exportCsvButton').addEventListener('click', exportCsv);

    $('#guideButton').addEventListener('click', () => $('#guideDialog').showModal());
    $('#settingsButton').addEventListener('click', () => $('#settingsDialog').showModal());
    $('#settingsForm').addEventListener('submit', event => {
      event.preventDefault();
      state.settings.targetPerCell = Math.max(2, Math.min(12, Number($('#settingTargetPerCell').value) || 4));
      state.settings.kidGuide = $('#settingKidGuide').checked;
      $('#settingsDialog').close();
      saveState();
      showToast('Settings saved. Test queue recalculated.');
    });
    $('#exportBackupButton').addEventListener('click', () => downloadFile(`x-command-center-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ app:D.meta.appName, version:D.meta.version, exportedAt:new Date().toISOString(), state }, null, 2), 'application/json'));
    $('#importBackupInput').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        state = normalizeState(parsed.state || parsed);
        saveState();
        $('#settingsDialog').close();
        showToast('Backup imported.');
      } catch (error) { showToast(`Import failed: ${error.message}`); }
      event.target.value = '';
    });
    $('#resetAppButton').addEventListener('click', () => {
      if (!confirm('Reset the collection, decks, battles, and settings stored in this browser?')) return;
      state = defaultState();
      saveState();
      $('#settingsDialog').close();
      showToast('Local app data reset.');
    });

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      $('#installButton').hidden = false;
    });
    $('#installButton').addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $('#installButton').hidden = true;
    });
  }

  function initializePwa() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    window.addEventListener('online', () => { $('#localStatus').textContent = 'Online'; });
    window.addEventListener('offline', () => { $('#localStatus').textContent = 'Offline-ready'; });
    $('#localStatus').textContent = navigator.onLine ? 'Local' : 'Offline-ready';
  }

  bindEvents();
  renderAll();
  initializePwa();
})();
