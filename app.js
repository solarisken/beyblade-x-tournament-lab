(function () {
  'use strict';

  const DATA = window.XDATA;
  const Core = window.XCore;
  const STORAGE_KEY = 'x-deck-lab-state-v2';
  const LEGACY_KEY = 'x-deck-lab-state-v1';
  const SCHEMA_VERSION = Core.SCHEMA_VERSION;
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const fmtPct = (value, digits = 0) => Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : '—';
  const fmtDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
  const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = () => new Date().toISOString();

  function blankBey() {
    return { system: 'basic', customArchitecture: 'main', customDrive: 'standard', blade: '', ratchetIntegratedBlade: '', lockChip: '', metalBlade: '', overBlade: '', mainBlade: '', assistBlade: '', ratchet: '', bit: '', integratedBit: '' };
  }

  function defaultDeck(name = 'Tournament Deck 1') {
    const timestamp = nowIso();
    return { id: uid('deck'), name, profileId: 'tt3on3', includeAnnounced: false, beys: [blankBey(), blankBey(), blankBey()], notes: '', tags: [], createdAt: timestamp, updatedAt: timestamp };
  }

  function defaultState() {
    const deck = defaultDeck();
    return {
      schemaVersion: SCHEMA_VERSION,
      inventory: {},
      customParts: [],
      customProducts: [],
      decks: [deck],
      activeDeckId: deck.id,
      battles: [],
      metaProfiles: (DATA.defaultMetaProfiles || []).map((profile) => ({ ...profile })),
      customProfiles: [],
      settings: { ...(DATA.testDefaults || {}) },
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }

  function normalizeBey(raw) {
    const bey = { ...blankBey(), ...(raw || {}) };
    if (bey.metalBlade) bey.customArchitecture = 'expanded';
    if (bey.integratedBit) bey.customDrive = 'integrated';
    if (!['basic','custom','integrated'].includes(bey.system)) bey.system = 'basic';
    return bey;
  }

  function normalizeState(raw) {
    let source = raw;
    if (!source || typeof source !== 'object') return defaultState();
    if (!Array.isArray(source.decks) || Number(source.schemaVersion) < SCHEMA_VERSION) source = Core.migrateState(source) || defaultState();
    const base = defaultState();
    const state = { ...base, ...source };
    state.schemaVersion = SCHEMA_VERSION;
    state.inventory = {};
    Object.entries(source.inventory || {}).forEach(([id, record]) => {
      const qty = record && typeof record === 'object' ? Number(record.qty) : Number(record);
      if (qty > 0) state.inventory[id] = { qty: Math.floor(qty), condition: record?.condition || 'good', notes: String(record?.notes || '') };
    });
    state.customParts = Array.isArray(source.customParts) ? source.customParts.filter((part) => part?.id && part?.name && part?.category) : [];
    state.customProducts = Array.isArray(source.customProducts) ? source.customProducts.filter((product) => product?.id && product?.name) : [];
    state.decks = Array.isArray(source.decks) ? source.decks.map((deck, index) => ({
      ...defaultDeck(`Deck ${index + 1}`),
      ...deck,
      id: deck.id || uid('deck'),
      name: deck.name || `Deck ${index + 1}`,
      beys: Array.isArray(deck.beys) ? deck.beys.slice(0, 3).map(normalizeBey) : [blankBey(), blankBey(), blankBey()]
    })) : base.decks;
    state.decks.forEach((deck) => { while (deck.beys.length < 3) deck.beys.push(blankBey()); });
    if (!state.decks.length) state.decks = [defaultDeck()];
    if (!state.decks.some((deck) => deck.id === source.activeDeckId)) state.activeDeckId = state.decks[0].id;
    state.battles = Array.isArray(source.battles) ? source.battles.filter((battle) => battle?.id).map((battle) => Core.normalizeBattle(battle, DATA.scoring)) : [];
    state.metaProfiles = Array.isArray(source.metaProfiles) && source.metaProfiles.length
      ? source.metaProfiles.filter((profile) => profile?.id && profile?.name && Array.isArray(profile.lineup))
      : base.metaProfiles;
    state.customProfiles = Array.isArray(source.customProfiles) ? source.customProfiles.filter((profile) => profile?.id && profile?.name) : [];
    const importedSettings = { ...(source.settings || {}) };
    if (importedSettings.minimumSelfKoTestsPerBey == null && importedSettings.minimumStabilityPerBey != null) importedSettings.minimumSelfKoTestsPerBey = importedSettings.minimumStabilityPerBey;
    delete importedSettings.minimumFinishCauseCoverage;
    delete importedSettings.minimumStabilityPerBey;
    delete importedSettings.maxSelfKoUpperBound;
    state.settings = { ...DATA.testDefaults, ...importedSettings };
    if (!['player','advanced'].includes(state.settings.experienceMode)) state.settings.experienceMode = 'player';
    return state;
  }

  function loadState() {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) return normalizeState(JSON.parse(current));
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const migrated = normalizeState(JSON.parse(legacy));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch (error) {
      console.error('State load failed.', error);
    }
    return defaultState();
  }

  let state = loadState();
  let deferredInstallPrompt = null;
  let toastTimer = null;
  let lastForecast = null;
  let smartSuggestions = [];
  let opponentOptions = [];

  function saveState() {
    state.updatedAt = nowIso();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('State save failed.', error);
      toast('Local storage failed. Export a backup now.');
    }
  }

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 2600);
  }

  function allParts() { return [...DATA.parts, ...state.customParts]; }
  function allProducts() { return [...DATA.products, ...state.customProducts]; }
  function partMap() { return Object.fromEntries(allParts().map((part) => [part.id, part])); }
  function allProfiles() { return { ...DATA.profiles, ...Object.fromEntries(state.customProfiles.map((profile) => [profile.id, profile])) }; }
  function activeDeck() { return state.decks.find((deck) => deck.id === state.activeDeckId) || state.decks[0]; }
  function currentProfile() { return allProfiles()[activeDeck().profileId] || DATA.profiles.tt3on3; }
  function currentAssessment() {
    const deck = activeDeck();
    return Core.readinessAssessment({
      deck: deck.beys,
      deckId: deck.id,
      profile: currentProfile(),
      partMap: partMap(),
      inventory: state.inventory,
      battles: state.battles,
      includeAnnounced: deck.includeAnnounced,
      settings: state.settings,
      scoring: DATA.scoring
    });
  }

  function navigate(view) {
    $$('.view').forEach((section) => {
      const active = section.dataset.view === view;
      section.hidden = !active;
      section.classList.toggle('active', active);
    });
    $$('[data-nav]').forEach((button) => {
      const active = button.dataset.nav === view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    if (view === 'dashboard') renderDashboard();
    if (view === 'inventory') renderInventoryView();
    if (view === 'deck') renderDeckView();
    if (view === 'test') renderTestView();
    if (view === 'results') renderAnalysisView();
    if (view === 'more') renderMoreView();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function badge(text, kind = 'info') { return `<span class="badge ${kind}">${escapeHtml(text)}</span>`; }
  function emptyState(message) { return `<div class="empty-state">${escapeHtml(message)}</div>`; }

  function metricLabel(key) {
    return ({ impactPotential: 'Impact', rotationalInertia: 'Rotational inertia', spinRetention: 'Spin retention', stability: 'Stability', koResistance: 'KO resistance', burstResistance: 'Burst resistance', xDashPotential: 'X-Dash', control: 'Control', recoilRisk: 'Recoil risk', selfKoRisk: 'Self-KO risk' })[key] || key;
  }

  function engineeringBars(profile, keys = ['impactPotential','spinRetention','stability','koResistance','control','selfKoRisk']) {
    return `<div class="engineering-bars">${keys.map((key) => `<div class="engineering-row"><span>${escapeHtml(metricLabel(key))}</span><div class="engineering-track"><i style="width:${Math.max(0, Math.min(100, Number(profile.metrics[key]) || 0))}%"></i></div><strong>${escapeHtml(profile.metrics[key])}</strong></div>`).join('')}</div>`;
  }


  function guideProgress() {
    const deck = activeDeck();
    const assessment = currentAssessment();
    const ownedUnits = Object.keys(state.inventory).reduce((total, id) => total + Core.inventoryQuantity(state.inventory, id), 0);
    const relevantBattles = assessment.analytics.overall.total;
    return [
      { step: 1, title: 'Add your parts', note: ownedUnits ? `${ownedUnits} owned part${ownedUnits === 1 ? '' : 's'} recorded` : 'Add a boxed product or loose part', done: ownedUnits > 0, view: 'inventory', action: ownedUnits ? 'View parts' : 'Add parts' },
      { step: 2, title: 'Build three Beys', note: assessment.legality.legal && assessment.capacity.valid ? 'Legal and buildable from owned parts' : 'Complete a legal owned deck', done: assessment.legality.legal && assessment.capacity.valid, view: 'deck', action: 'Open decks' },
      { step: 3, title: 'Run guided tests', note: relevantBattles ? `${relevantBattles} battle${relevantBattles === 1 ? '' : 's'} saved` : 'Tap the first test card and battle once', done: relevantBattles > 0, view: 'test', action: 'Open tests' },
      { step: 4, title: 'Open your deck coach', note: assessment.tournamentReady ? 'Your coach says the deck is ready' : `${assessment.blockers.length} improvement${assessment.blockers.length === 1 ? '' : 's'} to work on`, done: assessment.tournamentReady, view: 'results', action: 'Open coach' }
    ];
  }

  function renderGuidePanels() {
    const show = state.settings.showGuide !== false;
    $$('[data-guide-panel]').forEach((element) => { element.hidden = !show; });
    const container = $('#guideSteps');
    if (!container) return;
    container.innerHTML = guideProgress().map((item) => `<button class="guide-step ${item.done ? 'done' : ''}" type="button" data-nav-target="${item.view}"><span class="guide-step-number">${item.done ? '✓' : item.step}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.note)}</small><em>${escapeHtml(item.action)} →</em></span></button>`).join('');
  }

  function experienceMode() { return state.settings.experienceMode === 'advanced' ? 'advanced' : 'player'; }

  function renderModeState() {
    const advanced = experienceMode() === 'advanced';
    document.body.classList.toggle('advanced-mode', advanced);
    const button = $('#modeButton');
    if (button) {
      button.textContent = advanced ? 'Advanced mode' : 'Player mode';
      button.setAttribute('aria-pressed', advanced ? 'true' : 'false');
    }
    const details = $('#coachAdvancedDetails');
    if (details) details.open = advanced;
  }

  function coachPatterns(assessment) {
    const deck = activeDeck();
    const battles = state.battles.filter((battle) => battle.deckId === deck.id && !battle.contaminated && ['win','loss'].includes(battle.result));
    if (!battles.length) return [{ kind: 'neutral', text: 'No battle pattern yet. Complete the mission so the coach can learn from real results.' }];
    const notes = [];
    const byBey = new Map();
    battles.forEach((battle) => {
      const key = battle.ownSignature || `bey-${battle.ownBeyIndex}`;
      const entry = byBey.get(key) || { total: 0, wins: 0, selfKos: 0, losses: 0, name: battle.ownName || 'This Bey' };
      entry.total += 1; entry.wins += battle.result === 'win' ? 1 : 0; entry.losses += battle.result === 'loss' ? 1 : 0; entry.selfKos += battle.selfKo ? 1 : 0;
      byBey.set(key, entry);
    });
    [...byBey.values()].filter((entry) => entry.total >= 3).sort((a,b) => (a.wins/a.total)-(b.wins/b.total)).slice(0,1).forEach((entry) => notes.push({ kind: 'warning', text: `${entry.name} is the least proven Bey so far: ${entry.wins}/${entry.total} wins. Give it the next controlled matchup test.` }));
    const selfKoBattles = battles.filter((battle) => battle.selfKo);
    if (selfKoBattles.length >= 2) notes.push({ kind: 'warning', text: `${selfKoBattles.length} recorded self-KOs are reducing confidence. Use a controlled launch and keep the same setup for the next three tests.` });
    const archetypes = {};
    battles.forEach((battle) => { const key = battle.opponentArchetype || 'unknown'; const e = archetypes[key] || { total:0,wins:0 }; e.total++; e.wins += battle.result==='win'?1:0; archetypes[key]=e; });
    Object.entries(archetypes).filter(([,e])=>e.total>=3).sort((a,b)=>(a[1].wins/a[1].total)-(b[1].wins/b[1].total)).slice(0,1).forEach(([type,e]) => notes.push({ kind: 'warning', text: `The weakest observed opponent type is ${labelForArchetype(type)}: ${e.wins}/${e.total} wins. The planner will prioritize this uncertainty.` }));
    if (assessment.analytics.overall.effective >= Number(state.settings.minimumBattles || 36)) notes.push({ kind: 'positive', text: 'You have reached the overall battle target. New missions now focus on weak or uncertain matchups instead of raw battle count.' });
    return notes.length ? notes.slice(0,4) : [{ kind: 'positive', text: 'Results are balanced so far. Continue the highest-information mission to strengthen confidence.' }];
  }

  function suggestionExplanation(suggestion) {
    const current = activeDeck().beys;
    const suggestedNames = suggestion.deck.map((bey) => Core.nameForBey(bey, partMap()));
    const currentNames = current.map((bey) => Core.nameForBey(bey, partMap()));
    const changed = suggestedNames.filter((name, index) => name !== currentNames[index]).length;
    const e = suggestion.engineering;
    const reasons = [];
    if (e.bitRoleSpread >= 3) reasons.push('covers three different bit jobs');
    if (e.roleSpread >= 3) reasons.push('spreads deck roles');
    if (e.averageSelfKoRisk <= 35) reasons.push('keeps modeled self-KO risk controlled');
    reasons.push(`protects the weakest matchup at ${e.weakestRating}/100`);
    return `${changed ? `Changes ${changed} of 3 Bey slots and ` : 'Keeps the current structure and '} ${reasons.join(', ')}. Real tests still decide whether the change is better.`;
  }

  function renderDashboard() {
    const deck = activeDeck();
    const assessment = currentAssessment();
    const plan = Core.buildTestPlan({ deck: deck.beys, deckId: deck.id, partMap: partMap(), inventory: state.inventory, includeAnnounced: deck.includeAnnounced, battles: state.battles, scoring: DATA.scoring, metaProfiles: state.metaProfiles, settings: state.settings, limit: 4 });
    const hero = $('#dashboardHero');
    hero.style.setProperty('--score-angle', `${assessment.score * 3.6}deg`);
    hero.innerHTML = `
      <div class="hero-top">
        <div><p class="eyebrow">${escapeHtml(deck.name)}</p><h3>${escapeHtml(assessment.label)}</h3><p>${assessment.tournamentReady ? 'All configured evidence gates pass.' : `${assessment.blockers.length} readiness gate${assessment.blockers.length === 1 ? '' : 's'} remain open.`}</p></div>
        <div class="hero-score" aria-label="Readiness score ${assessment.score} out of 100"><strong>${assessment.score}</strong></div>
      </div>
      <div class="hero-footer"><div>${assessment.legality.legal ? badge('Legal', 'pass') : badge('Illegal', 'fail')}${assessment.capacity.valid ? badge('Owned', 'pass') : badge('Part shortage', 'fail')}${badge(`${assessment.analytics.overall.effective} decided battles`, 'info')}</div><button class="button primary compact" type="button" data-nav-target="results">Open deck coach</button></div>`;

    renderGuidePanels();
    $('#dashboardMetrics').innerHTML = [
      ['Win rate', fmtPct(assessment.analytics.overall.winRate, 1), `${assessment.analytics.overall.wins} wins in ${assessment.analytics.overall.effective} decided battles`],
      ['Points', assessment.analytics.overall.pointDifferential > 0 ? `+${assessment.analytics.overall.pointDifferential}` : String(assessment.analytics.overall.pointDifferential), `${assessment.analytics.overall.pointsFor} scored / ${assessment.analytics.overall.pointsAgainst} allowed`],
      ['Deck roles', `${assessment.diversity.unique}/3`, assessment.diversity.roles.join(' · ') || 'Complete the deck'],
      ['Fair tests', fmtPct(1 - assessment.analytics.overall.contaminationRate, 0), `${assessment.analytics.overall.contaminated} excluded test${assessment.analytics.overall.contaminated === 1 ? '' : 's'}`],
      ['Self-KOs', `${assessment.analytics.overall.ownSelfKos}`, `${assessment.analytics.overall.selfKoEvidence} answered tests · ${fmtPct(assessment.analytics.overall.selfKoRate, 1)}`],
      ['Next action', assessment.tournamentReady ? 'Ready' : `${assessment.blockers.length} open`, assessment.tournamentReady ? 'Keep monitoring new matchups' : 'Follow the first test card']
    ].map(([label, value, note]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><span>${escapeHtml(note)}</span></div>`).join('');

    $('#dashboardPlan').innerHTML = plan.length ? plan.map((task, index) => `
      <div class="list-card compact"><div class="list-card-header"><div><strong>${index + 1}. ${escapeHtml(task.ownName)} vs ${escapeHtml(task.opponentName)}</strong><p>${escapeHtml(task.testType === 'stability' ? 'Self-KO check' : 'Matchup test')} · use the shown owned ${escapeHtml(labelForArchetype(task.opponentArchetype))} opponent · ${escapeHtml(task.completed)}/${escapeHtml(task.target)} saved results. ${escapeHtml(task.rationale)}</p></div>${badge(`${task.deficit} needed`, 'warn')}</div></div>`).join('') : emptyState('No inventory-valid opponent test is available. Add owned parts, complete the deck, or relax the attack-bit mirror exclusion.');

    const roadmap = guideProgress();
    const currentStep = roadmap.find((item) => !item.done) || roadmap[roadmap.length - 1];
    $('#coachRoadmap').innerHTML = `<div class="panel-heading"><div><p class="eyebrow">Coach roadmap</p><h3>${assessment.tournamentReady ? 'Tournament-ready loop' : `Step ${currentStep.step}: ${escapeHtml(currentStep.title)}`}</h3></div>${badge(assessment.tournamentReady ? 'Monitor' : `${roadmap.filter((item)=>item.done).length}/4 complete`, assessment.tournamentReady ? 'pass' : 'info')}</div><p>${assessment.tournamentReady ? 'The setup path is complete. Keep the deck current by following one new mission after changes to parts, launches, or expected opponents.' : escapeHtml(currentStep.note)}</p><button class="button primary" type="button" data-nav-target="${currentStep.view}">${escapeHtml(currentStep.action)}</button>`;

    $('#dashboardBlockers').innerHTML = assessment.blockers.length ? assessment.blockers.slice(0, 6).map((gate) => `
      <div class="list-card compact"><div class="list-card-header"><div><strong>${escapeHtml(gate.label)}</strong><p>${escapeHtml(gate.detail)}</p></div>${badge('Open', 'fail')}</div></div>`).join('') : `<div class="list-card compact"><div class="list-card-header"><div><strong>All gates pass</strong><p>Continue monitoring new matchups, wear, and event-rule changes.</p></div>${badge('Pass', 'pass')}</div></div>`;
  }

  function renderInventoryControls() {
    const categorySelect = $('#inventoryCategory');
    if (categorySelect.options.length <= 1) DATA.categories.forEach((category) => categorySelect.add(new Option(category.label, category.id)));
    const partCategory = $('#partCategory');
    if (!partCategory.options.length) DATA.categories.forEach((category) => partCategory.add(new Option(category.label, category.id)));
    const condition = $('#partCondition');
    if (!condition.options.length) DATA.conditions.forEach((entry) => condition.add(new Option(entry.name, entry.id)));
    renderPartDialogOptions();
  }

  function renderInventoryView() {
    renderInventoryControls();
    renderInventoryList();
    renderProductList();
  }

  function renderInventoryList() {
    const query = $('#inventorySearch').value.trim().toLowerCase();
    const category = $('#inventoryCategory').value;
    const parts = allParts().filter((part) => Core.inventoryQuantity(state.inventory, part.id) > 0)
      .filter((part) => category === 'all' || part.category === category)
      .filter((part) => !query || `${part.name} ${part.code || ''} ${part.line || ''}`.toLowerCase().includes(query))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    const totalUnits = parts.reduce((total, part) => total + Core.inventoryQuantity(state.inventory, part.id), 0);
    $('#inventorySummary').textContent = `${parts.length} part types · ${totalUnits} units`;
    $('#inventoryList').innerHTML = parts.length ? parts.map((part) => {
      const record = state.inventory[part.id] || {};
      const conditionName = DATA.conditions.find((entry) => entry.id === record.condition)?.name || 'Good';
      return `<div class="inventory-row" data-part-id="${escapeHtml(part.id)}">
        <div><strong>${escapeHtml(part.name)}${part.code ? ` <span class="muted">(${escapeHtml(part.code)})</span>` : ''}</strong><div class="inventory-meta"><span class="tag">${escapeHtml(categoryLabel(part.category))}</span><span class="tag">${escapeHtml(part.role)}</span><span class="tag">${escapeHtml(conditionName)}</span>${record.notes ? `<span class="tag">${escapeHtml(record.notes)}</span>` : ''}</div></div>
        <div class="quantity-control" aria-label="Quantity for ${escapeHtml(part.name)}"><button type="button" data-inventory-delta="-1" aria-label="Remove one ${escapeHtml(part.name)}">−</button><output>${Core.inventoryQuantity(state.inventory, part.id)}</output><button type="button" data-inventory-delta="1" aria-label="Add one ${escapeHtml(part.name)}">+</button></div>
      </div>`;
    }).join('') : emptyState('No owned parts match this filter. Add a known product or a loose part.');
  }

  function renderProductList() {
    const query = $('#productSearch').value.trim().toLowerCase();
    const products = allProducts().filter((product) => {
      const partNames = (product.parts || []).map((id) => partMap()[id]?.name || id).join(' ');
      return !query || `${product.id} ${product.name} ${partNames}`.toLowerCase().includes(query);
    }).sort((a, b) => {
      const statusOrder = (a.status === 'released' ? 0 : 1) - (b.status === 'released' ? 0 : 1);
      return statusOrder || String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')) || a.id.localeCompare(b.id);
    }).slice(0, query ? 80 : 28);
    $('#productList').innerHTML = products.length ? products.map((product) => `
      <div class="product-card"><div><strong>${escapeHtml(product.id)} · ${escapeHtml(product.name)}</strong><small>${product.parts?.length || 0} catalog parts${product.releaseDate ? ` · ${escapeHtml(product.releaseDate)}` : ''}${product.status === 'announced' ? ' · announced' : ''}</small></div><button class="button ${product.status === 'announced' ? 'ghost' : 'secondary'} compact" type="button" data-add-product="${escapeHtml(product.id)}" ${product.status === 'announced' ? 'title="Theorycrafting product"' : ''}>Add set</button></div>`).join('') : emptyState('No known product matches this search.');
  }

  function renderPartDialogOptions() {
    const category = $('#partCategory').value || DATA.categories[0].id;
    const select = $('#partSelect');
    const selected = select.value;
    const parts = allParts().filter((part) => part.category === category).sort((a, b) => a.name.localeCompare(b.name));
    select.innerHTML = parts.map((part) => `<option value="${escapeHtml(part.id)}">${escapeHtml(part.name)}${part.code ? ` (${escapeHtml(part.code)})` : ''}${part.status === 'announced' ? ' — announced' : ''}</option>`).join('');
    if (parts.some((part) => part.id === selected)) select.value = selected;
  }

  function inventoryRecord(id) {
    if (!state.inventory[id]) state.inventory[id] = { qty: 0, condition: 'good', notes: '' };
    if (typeof state.inventory[id] !== 'object') state.inventory[id] = { qty: Number(state.inventory[id]) || 0, condition: 'good', notes: '' };
    return state.inventory[id];
  }

  function adjustInventory(id, delta, condition, notes) {
    const record = inventoryRecord(id);
    record.qty = Math.max(0, Math.floor(Number(record.qty || 0) + Number(delta || 0)));
    if (condition) record.condition = condition;
    if (notes) record.notes = notes;
    if (!record.qty) delete state.inventory[id];
    saveState();
  }

  function addProduct(productId) {
    const product = allProducts().find((entry) => entry.id === productId);
    if (!product) return;
    (product.parts || []).forEach((id) => adjustInventory(id, 1));
    saveState();
    renderInventoryList();
    renderProductList();
    toast(`${product.id} added to inventory.`);
  }

  function categoryLabel(categoryId) { return DATA.categories.find((category) => category.id === categoryId)?.label || categoryId; }
  function labelForArchetype(id) { return DATA.archetypes.find((entry) => entry.id === id)?.name || id; }
  function renderDeckView() {
    renderDeckToolbar();
    renderDeckEditor();
    renderDeckValidation();
    renderSmartSuggestions();
  }

  function renderDeckToolbar() {
    const deck = activeDeck();
    $('#deckSelector').innerHTML = state.decks.map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</option>`).join('');
    $('#deckSelector').value = deck.id;
    const profiles = Object.values(allProfiles());
    $('#profileSelector').innerHTML = profiles.map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)}</option>`).join('');
    $('#profileSelector').value = deck.profileId;
    $('#includeAnnouncedToggle').checked = Boolean(deck.includeAnnounced);
    $('#deleteDeckButton').disabled = state.decks.length <= 1;
  }

  function partOptions(category, selected, includeAnnounced) {
    const parts = allParts().filter((part) => part.category === category && (includeAnnounced || part.status !== 'announced'))
      .sort((a, b) => {
        const ownedDiff = Number(Core.inventoryQuantity(state.inventory, b.id) > 0) - Number(Core.inventoryQuantity(state.inventory, a.id) > 0);
        return ownedDiff || a.name.localeCompare(b.name);
      });
    const options = [`<option value="">Select ${escapeHtml(categoryLabel(category).toLowerCase())}</option>`];
    parts.forEach((part) => {
      const owned = Core.inventoryQuantity(state.inventory, part.id);
      options.push(`<option value="${escapeHtml(part.id)}" ${selected === part.id ? 'selected' : ''}>${escapeHtml(part.name)}${part.code ? ` (${escapeHtml(part.code)})` : ''}${owned ? ` · owned ${owned}` : ' · not owned'}${part.status === 'custom' ? ' · custom' : ''}</option>`);
    });
    return options.join('');
  }

  function fieldSelect(index, field, label, category, selected, includeAnnounced) {
    return `<label class="field"><span>${escapeHtml(label)}</span><select data-bey-index="${index}" data-bey-field="${escapeHtml(field)}">${partOptions(category, selected, includeAnnounced)}</select></label>`;
  }

  function renderDeckEditor() {
    const deck = activeDeck();
    const map = partMap();
    $('#deckEditor').innerHTML = deck.beys.map((bey, index) => {
      const role = Core.inferBeyRole(bey, map);
      let fields = `<label class="field"><span>System</span><select data-bey-index="${index}" data-bey-system><option value="basic" ${bey.system === 'basic' ? 'selected' : ''}>Basic / Unique</option><option value="custom" ${bey.system === 'custom' ? 'selected' : ''}>Custom Line</option><option value="integrated" ${bey.system === 'integrated' ? 'selected' : ''}>Ratchet-integrated blade</option></select></label>`;
      if (bey.system === 'basic') {
        fields += fieldSelect(index, 'blade', 'Blade', 'blade', bey.blade, deck.includeAnnounced);
        fields += fieldSelect(index, 'ratchet', 'Ratchet', 'ratchet', bey.ratchet, deck.includeAnnounced);
        fields += fieldSelect(index, 'bit', 'Bit', 'bit', bey.bit, deck.includeAnnounced);
      } else if (bey.system === 'integrated') {
        fields += fieldSelect(index, 'ratchetIntegratedBlade', 'Ratchet-integrated blade', 'ratchetIntegratedBlade', bey.ratchetIntegratedBlade, deck.includeAnnounced);
        fields += fieldSelect(index, 'bit', 'Bit', 'bit', bey.bit, deck.includeAnnounced);
      } else {
        fields += `<label class="field"><span>Top architecture</span><select data-bey-index="${index}" data-bey-architecture><option value="main" ${bey.customArchitecture !== 'expanded' ? 'selected' : ''}>Lock + Main + Assist</option><option value="expanded" ${bey.customArchitecture === 'expanded' ? 'selected' : ''}>Lock + Metal + Over + Assist</option></select></label>`;
        fields += `<label class="field"><span>Drive architecture</span><select data-bey-index="${index}" data-bey-drive><option value="standard" ${bey.customDrive !== 'integrated' ? 'selected' : ''}>Ratchet + Bit</option><option value="integrated" ${bey.customDrive === 'integrated' ? 'selected' : ''}>Ratchet-integrated bit</option></select></label>`;
        fields += fieldSelect(index, 'lockChip', 'Lock chip', 'lockChip', bey.lockChip, deck.includeAnnounced);
        if (bey.customArchitecture === 'expanded') {
          fields += fieldSelect(index, 'metalBlade', 'Metal blade', 'metalBlade', bey.metalBlade, deck.includeAnnounced);
          fields += fieldSelect(index, 'overBlade', 'Over blade', 'overBlade', bey.overBlade, deck.includeAnnounced);
        } else fields += fieldSelect(index, 'mainBlade', 'Main blade', 'mainBlade', bey.mainBlade, deck.includeAnnounced);
        fields += fieldSelect(index, 'assistBlade', 'Assist blade', 'assistBlade', bey.assistBlade, deck.includeAnnounced);
        if (bey.customDrive === 'integrated') fields += fieldSelect(index, 'integratedBit', 'Ratchet-integrated bit', 'integratedBit', bey.integratedBit, deck.includeAnnounced);
        else {
          fields += fieldSelect(index, 'ratchet', 'Ratchet', 'ratchet', bey.ratchet, deck.includeAnnounced);
          fields += fieldSelect(index, 'bit', 'Bit', 'bit', bey.bit, deck.includeAnnounced);
        }
      }
      const engineering = Core.beyIsComplete(bey) ? Core.engineeringProfileForBey(bey, map) : null;
      const quickMetrics = engineering ? [
        ['Attack power', engineering.metrics.impactPotential, 'higher is better'],
        ['Spin', engineering.metrics.spinRetention, 'higher is better'],
        ['Stability', engineering.metrics.stability, 'higher is better'],
        ['Self-KO risk', engineering.metrics.selfKoRisk, 'lower is better']
      ].map(([label, value, hint]) => `<div class="bey-metric"><small>${escapeHtml(label)}</small><strong>${escapeHtml(Math.round(Number(value) || 0))}<span>/100</span></strong><em>${escapeHtml(hint)}</em></div>`).join('') : '';
      return `<article class="bey-card"><div class="bey-card-header"><span class="bey-number">${index + 1}</span><div class="bey-title"><strong>${escapeHtml(Core.nameForBey(bey, map))}</strong><small>${engineering ? `${escapeHtml(role)} setup · ${escapeHtml(engineering.bitRole)} bit · fit ${escapeHtml(Math.round(Number(engineering.roleFit) || 0))}/100` : 'Choose the parts for this Bey'}</small></div><button class="icon-button" type="button" data-clear-bey="${index}" aria-label="Clear Bey ${index + 1}">×</button></div><div class="bey-fields">${fields}</div>${engineering ? `<div class="bey-engineering" aria-label="Quick engineering scores"><div class="bey-engineering-head"><strong>Quick view</strong><small>Scores are estimates until you test the Bey.</small></div><div class="bey-metric-grid">${quickMetrics}</div></div>` : ''}</article>`;
    }).join('');
  }

  function renderDeckValidation() {
    const assessment = currentAssessment();
    const issueCards = assessment.legality.issues.map((issue) => `<div class="list-card compact"><div class="list-card-header"><strong>${escapeHtml(issue)}</strong>${badge('Rules', 'fail')}</div></div>`);
    const shortageCards = assessment.capacity.shortages.map((item) => `<div class="list-card compact"><div class="list-card-header"><div><strong>${escapeHtml(item.name)}</strong><p>Required ${item.required}; owned ${item.owned}.</p></div>${badge('Shortage', 'fail')}</div></div>`);
    const warnings = assessment.legality.warnings.map((warning) => `<div class="list-card compact"><div class="list-card-header"><strong>${escapeHtml(warning)}</strong>${badge('Verify', 'warn')}</div></div>`);
    const all = [...issueCards, ...shortageCards, ...warnings];
    $('#deckValidation').innerHTML = all.length ? `<div class="stack-list">${all.join('')}</div>` : `<div class="list-card compact"><div class="list-card-header"><div><strong>Construction passes</strong><p>${escapeHtml(currentProfile().notes || 'No blockers under this profile.')}</p></div>${badge('Pass', 'pass')}</div></div>`;
  }

  function renderSmartSuggestions() {
    $('#smartBuildResults').innerHTML = smartSuggestions.length ? smartSuggestions.map((suggestion, index) => `
      <div class="list-card engineering-suggestion"><div class="list-card-header"><div><strong>#${index + 1} · engineering ${escapeHtml(suggestion.engineering.score)}/100</strong><p>${suggestion.deck.map((bey, beyIndex) => `${beyIndex + 1}. ${escapeHtml(Core.nameForBey(bey, partMap()))}`).join('<br>')}</p><div class="suggestion-metrics"><span>Weakest: ${escapeHtml(labelForArchetype(suggestion.engineering.weakestMatchup))} ${escapeHtml(suggestion.engineering.weakestRating)}</span><span>Modeled average: ${escapeHtml(suggestion.engineering.weightedAverage)}</span><span>Self-KO risk: ${escapeHtml(suggestion.engineering.averageSelfKoRisk)}</span><span>Bit roles: ${escapeHtml(suggestion.engineering.bitRoleSpread)}/3</span></div><p>${escapeHtml(suggestionExplanation(suggestion))}</p><small>${escapeHtml(suggestion.note)}</small></div><button class="button primary compact" type="button" data-apply-suggestion="${index}">Use deck</button></div></div>`).join('') : '';
  }

  function resetBeyForSystem(system) {
    return { ...blankBey(), system };
  }

  function touchDeck() { activeDeck().updatedAt = nowIso(); lastForecast = null; saveState(); }

  function generateSmartBuilds() {
    $('#smartBuildButton').disabled = true;
    $('#smartBuildButton').textContent = 'Ranking…';
    setTimeout(() => {
      try {
        smartSuggestions = Core.suggestDecks({ inventory: state.inventory, partMap: partMap(), profile: currentProfile(), includeAnnounced: activeDeck().includeAnnounced, battles: state.battles, metaProfiles: state.metaProfiles, settings: state.settings, limit: 5 });
        renderSmartSuggestions();
        toast(smartSuggestions.length ? `${smartSuggestions.length} legal deck shortlists generated.` : 'No three-Bey legal deck can be built from the current inventory.');
      } catch (error) {
        console.error(error);
        toast('Optimizer failed. Run diagnostics and verify catalog data.');
      } finally {
        $('#smartBuildButton').disabled = false;
        $('#smartBuildButton').textContent = 'Build suggested decks';
      }
    }, 20);
  }

  function renderTestView() {
    renderTestPlan();
    renderBattleFormOptions();
    renderBattleHistory();
  }

  function renderTestPlan() {
    const deck = activeDeck();
    const plan = Core.buildTestPlan({ deck: deck.beys, deckId: deck.id, partMap: partMap(), inventory: state.inventory, includeAnnounced: deck.includeAnnounced, battles: state.battles, scoring: DATA.scoring, metaProfiles: state.metaProfiles, settings: state.settings, limit: 12 });
    const assessment = currentAssessment();
    $('#planProgress').textContent = `${assessment.analytics.overall.effective} decided battles`;
    $('#testPlanList').innerHTML = plan.length ? plan.map((task, index) => `
      <button class="test-task" type="button" data-plan-bey="${task.beyIndex}" data-plan-opponent="${escapeHtml(task.opponentSignature)}"><div><strong>${escapeHtml(task.ownName)} vs ${escapeHtml(task.opponentName)}</strong><small>${escapeHtml(task.testType === 'stability' ? 'SELF-KO CHECK' : 'MATCHUP TEST')} · ${escapeHtml(labelForArchetype(task.opponentArchetype))} · information value ${escapeHtml(Math.round(task.informationGain || 0))}/100 · you own all needed parts</small><small>${escapeHtml(task.rationale)}</small><small>${escapeHtml(task.launchProtocol || '')}</small><progress max="${task.target}" value="${task.completed}"></progress><small>${task.completed}/${task.target} results against this Bey · ${task.archetypeCompleted}/${task.archetypeTarget} against this type</small></div><span class="task-rank">${index + 1}</span></button>`).join('') : emptyState('No owned, concurrently constructible opponent remains under the current policy. Add inventory or disable attack-bit mirror exclusion only when that matchup is specifically needed.');
  }

  function renderBattleFormOptions() {
    const deck = activeDeck();
    $('#battleOwnBey').innerHTML = deck.beys.map((bey, index) => `<option value="${index}" ${Core.beyIsComplete(bey) ? '' : 'disabled'}>${index + 1}. ${escapeHtml(Core.nameForBey(bey, partMap()))}</option>`).join('');
    if (!$('#battleStadium').options.length) DATA.stadiums.forEach((entry) => $('#battleStadium').add(new Option(entry, entry)));
    if (!$('#battlePosition').options.length) DATA.launchPositions.forEach((entry) => $('#battlePosition').add(new Option(entry, entry)));
    if (!$('#battleTechnique').options.length) DATA.launchTechniques.forEach((entry) => $('#battleTechnique').add(new Option(entry, entry)));
    renderOwnedOpponentOptions();
  }

  function renderOwnedOpponentOptions(preferredSignature = '') {
    const deck = activeDeck();
    const ownIndex = Number($('#battleOwnBey').value || 0);
    const ownBey = deck.beys[ownIndex];
    opponentOptions = Core.generateOwnedOpponentCandidates({
      inventory: state.inventory,
      ownBey,
      partMap: partMap(),
      includeAnnounced: deck.includeAnnounced,
      avoidAttackMirrors: state.settings.avoidAttackMirrors !== false,
      maxCandidates: Number(state.settings.opponentPoolSize || 90)
    });
    const select = $('#battleOpponent');
    select.innerHTML = opponentOptions.length ? opponentOptions.map((candidate) => `<option value="${escapeHtml(candidate.signature)}">${escapeHtml(Core.nameForBey(candidate.bey, partMap()))} · ${escapeHtml(labelForArchetype(candidate.opponentArchetype))} · ${escapeHtml(candidate.engineering.bitRole)} bit</option>`).join('') : '<option value="">No valid owned opponent</option>';
    if (preferredSignature && opponentOptions.some((candidate) => candidate.signature === preferredSignature)) select.value = preferredSignature;
    select.disabled = !opponentOptions.length;
    const submit = $('#battleForm button[type="submit"]');
    if (submit) submit.disabled = !opponentOptions.length;
    renderOpponentPreview();
  }

  function renderOpponentPreview() {
    const candidate = opponentOptions.find((entry) => entry.signature === $('#battleOpponent').value);
    if (!candidate) {
      $('#battleArchetype').value = '';
      $('#battleArchetypeDisplay').value = '';
      $('#battleOpponentBitRole').value = '';
      $('#opponentEngineering').innerHTML = emptyState('No inventory-valid opponent can be built beside the selected Bey.');
      return;
    }
    $('#battleArchetype').value = candidate.opponentArchetype;
    $('#battleArchetypeDisplay').value = labelForArchetype(candidate.opponentArchetype);
    $('#battleOpponentBitRole').value = candidate.engineering.bitRole;
    const e = candidate.engineering;
    $('#opponentEngineering').innerHTML = `<div class="opponent-preview-head"><div><strong>${escapeHtml(Core.nameForBey(candidate.bey, partMap()))}</strong><small>Owned capacity verified · engineering model v${escapeHtml(e.modelVersion)} · confidence ${fmtPct(e.confidence, 0)}</small></div>${badge(`${escapeHtml(candidate.opponentArchetype)} benchmark`, 'info')}</div>${engineeringBars(e, ['impactPotential','spinRetention','stability','koResistance','control','selfKoRisk'])}<p class="muted">The test planner reserves the selected Bey and this opponent simultaneously. Parts from inactive deck slots may be borrowed because only two Beys are launched in this controlled test.</p>`;
  }

  function renderBattleHistory() {
    const deck = activeDeck();
    const battles = state.battles.filter((battle) => battle.deckId === deck.id).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 40);
    $('#battleHistory').innerHTML = battles.length ? battles.map((battle) => {
      const normalized = Core.normalizeBattle(battle, DATA.scoring);
      return `<div class="history-item ${escapeHtml(normalized.result)} ${normalized.contaminated ? 'contaminated' : ''}"><div class="history-top"><div><strong>${escapeHtml(battle.ownName || 'Deck Bey')} · ${escapeHtml(normalized.result.toUpperCase())}${normalized.selfKo ? ' · SELF-KO' : ''}</strong><p>${battle.opponentName ? escapeHtml(battle.opponentName) : escapeHtml(labelForArchetype(battle.opponentArchetype))}${battle.opponentBitRole ? ` · ${escapeHtml(battle.opponentBitRole)} bit` : ''} · ${escapeHtml(normalized.finish)} finish · ${normalized.points} point${normalized.points === 1 ? '' : 's'}</p></div><button class="icon-button" type="button" data-delete-battle="${escapeHtml(battle.id)}" aria-label="Delete battle">×</button></div><p>${escapeHtml(fmtDate(battle.timestamp))}${normalized.contaminated ? ' · excluded because the test was not fair' : ''}${battle.notes ? ` · ${escapeHtml(battle.notes)}` : ''}</p></div>`;
    }).join('') : emptyState('No battles are logged for the active deck.');
  }

  function recordBattle(form) {
    const data = new FormData(form);
    const deck = activeDeck();
    const ownBeyIndex = Number(data.get('ownBeyIndex'));
    const bey = deck.beys[ownBeyIndex];
    if (!Core.beyIsComplete(bey)) return toast('Select a complete Bey.');
    const opponentSignature = String(data.get('opponentSignature') || '');
    const opponent = opponentOptions.find((entry) => entry.signature === opponentSignature);
    if (!opponent) return toast('Select an inventory-valid owned opponent.');
    const capacity = Core.inventoryCapacityForBattle(bey, opponent.bey, state.inventory, partMap());
    if (!capacity.valid) return toast('The selected Bey and opponent cannot be assembled simultaneously from owned quantities.');
    if (state.settings.avoidAttackMirrors !== false && Core.bitRoleForBey(bey, partMap()) === 'attack' && opponent.engineering.bitRole === 'attack') return toast('Attack-bit mirror testing is excluded by policy.');
    let result = String(data.get('result'));
    let finish = String(data.get('finish'));
    if (result === 'draw') finish = 'draw';
    if (result === 'relaunch') finish = 'relaunch';
    const selfKo = String(data.get('selfKo') || 'no') === 'yes';
    if (selfKo && (result !== 'loss' || !['over','xtreme'].includes(finish))) return toast('Choose Self-KO = Yes only when your Bey lost by leaving the stadium by itself.');
    const battle = {
      id: uid('battle'),
      deckId: deck.id,
      deckName: deck.name,
      ownBeyIndex,
      ownSignature: Core.beySignature(bey),
      ownName: Core.nameForBey(bey, partMap()),
      opponentArchetype: opponent.opponentArchetype,
      opponentSignature: opponent.signature,
      opponentBey: opponent.bey,
      opponentName: Core.nameForBey(opponent.bey, partMap()),
      opponentBitRole: opponent.engineering.bitRole,
      opponentEngineeringVersion: Core.ENGINEERING_MODEL_VERSION,
      result,
      finish,
      selfKo,
      selfKoKnown: true,
      finishCause: Core.defaultFinishCause(result, finish),
      selfKoSide: selfKo ? 'own' : '',
      stadium: String(data.get('stadium') || ''),
      launchPosition: String(data.get('launchPosition') || ''),
      technique: String(data.get('technique') || ''),
      contaminated: data.get('contaminated') === 'on',
      notes: String(data.get('notes') || '').trim(),
      timestamp: nowIso()
    };
    state.battles.push(battle);
    saveState();
    form.reset();
    renderTestView();
    renderDashboard();
    toast(selfKo ? 'Battle saved with Self-KO = Yes.' : 'Battle saved.');
  }

  function renderAnalysisView() {
    const assessment = currentAssessment();
    const deck = activeDeck();
    const map = partMap();
    const engineering = Core.engineeringDeckAssessment(deck.beys, map, Core.metaArchetypeWeights(state.metaProfiles));
    const plan = Core.buildTestPlan({ deck: deck.beys, deckId: deck.id, partMap: map, inventory: state.inventory, includeAnnounced: deck.includeAnnounced, battles: state.battles, scoring: DATA.scoring, metaProfiles: state.metaProfiles, settings: state.settings, limit: 4 });
    const firstTask = plan[0];
    const hero = $('#analysisHero');
    hero.style.setProperty('--score-angle', `${assessment.score * 3.6}deg`);
    const coachMessage = assessment.tournamentReady
      ? 'Your deck passes the configured readiness checks. Keep testing when parts, launches, or the tournament field change.'
      : firstTask ? `Your best next move is a controlled test: ${firstTask.ownName} against ${firstTask.opponentName}.` : 'Complete the open setup checks before collecting more battle evidence.';
    hero.innerHTML = `<div class="hero-top"><div><p class="eyebrow">${escapeHtml(deck.name)}</p><h3>${assessment.tournamentReady ? 'Ready for tournament play' : 'Your coach has a plan'}</h3><p>${escapeHtml(coachMessage)}</p></div><div class="hero-score" aria-label="Readiness score ${assessment.score} out of 100"><strong>${assessment.score}</strong></div></div><div class="hero-footer"><div>${assessment.tournamentReady ? badge('Ready', 'pass') : badge(`${assessment.blockers.length} items open`, 'warn')}${badge(`${assessment.analytics.overall.effective} decided battles`, 'info')}</div><span class="muted">Readiness /100</span></div>`;

    const mission = $('#coachMission');
    if (firstTask) mission.innerHTML = `<div class="coach-mission-head"><div><p class="eyebrow">Today's mission</p><h3>${escapeHtml(firstTask.ownName)} vs ${escapeHtml(firstTask.opponentName)}</h3><p>${escapeHtml(firstTask.testType === 'stability' ? 'Check whether your Bey can stay in the stadium with a controlled launch.' : firstTask.rationale)}</p></div><span class="mission-count">${Math.round(firstTask.informationGain || 0)}<small>info</small></span></div><div class="mission-actions"><button class="button primary" type="button" data-coach-next-test>Start this test</button><small>You own all needed parts. This is the highest-information legal test now; attack-bit mirrors are avoided by default.</small></div>`;
    else mission.innerHTML = `<div class="coach-mission-head"><div><p class="eyebrow">Today's mission</p><h3>${assessment.tournamentReady ? 'Keep your deck current' : 'Finish setup first'}</h3><p>${assessment.tournamentReady ? 'Run a new test when you change a part, launch style, or expected opponent.' : 'Add owned parts and complete three legal Beys so the coach can create a test.'}</p></div></div><div class="mission-actions"><button class="button primary" type="button" data-coach-next-test>${assessment.capacity.valid ? 'Open guided tests' : 'Add parts first'}</button></div>`;

    const cfg = state.settings;
    const totalTarget = Number(cfg.minimumBattles || 36);
    const perBeyTarget = Number(cfg.minimumPerBey || 10);
    const archetypeTarget = Number(cfg.minimumPerArchetype || 6);
    const completedBeys = deck.beys.filter((bey) => {
      const sum = assessment.analytics.byBey[Core.beySignature(bey)];
      return sum && sum.effective >= perBeyTarget;
    }).length;
    const coveredTypes = Core.CORE_ARCHETYPES.filter((type) => (assessment.analytics.byArchetype[type]?.effective || 0) >= archetypeTarget).length;
    const progressRows = [
      ['Battles completed', assessment.analytics.overall.effective, totalTarget, 'Record decided, fair battles.'],
      ['Each Bey tested', completedBeys, 3, `Aim for at least ${perBeyTarget} decided battles per Bey.`],
      ['Opponent types tested', coveredTypes, Core.CORE_ARCHETYPES.length, `Aim for ${archetypeTarget} results against each type.`]
    ];
    $('#coachProgress').innerHTML = progressRows.map(([label, value, target, note]) => { const pct = Math.min(100, Math.round((Number(value) / Math.max(1, Number(target))) * 100)); return `<div class="coach-progress-row"><div><strong>${escapeHtml(label)}</strong><span>${value}/${target}</span></div><progress max="100" value="${pct}"></progress><small>${escapeHtml(note)}</small></div>`; }).join('');

    const strengths = [];
    if (assessment.legality.legal) strengths.push('The deck passes the selected construction rules.');
    if (assessment.capacity.valid) strengths.push('All three Beys can be built from owned parts.');
    if (engineering.profiles.length) {
      const avg = (key) => engineering.profiles.reduce((sum, p) => sum + Number(p.metrics[key] || 0), 0) / engineering.profiles.length;
      const ranked = [['Strong spin retention', avg('spinRetention')], ['Good stability', avg('stability')], ['Strong knockout resistance', avg('koResistance')], ['Good attack potential', avg('impactPotential')]].sort((a,b)=>b[1]-a[1]);
      ranked.slice(0,2).forEach(([label, score]) => strengths.push(`${label} (${Math.round(score)}/100 modeled).`));
      if (engineering.roleSpread >= 3) strengths.push('The three Beys cover different jobs.');
    }
    $('#coachStrengths').innerHTML = (strengths.length ? strengths.slice(0,5) : ['Complete the deck to reveal strengths.']).map((text) => `<div class="coach-point positive"><span>✓</span><p>${escapeHtml(text)}</p></div>`).join('');

    const weaknesses = assessment.blockers.slice(0,4).map((gate) => `${gate.label}: ${gate.detail}`);
    if (engineering.profiles.length && engineering.weakestMatchup) weaknesses.push(`Modeled weak matchup: ${labelForArchetype(engineering.weakestMatchup)} (${engineering.weakestRating}/100).`);
    if (!weaknesses.length) weaknesses.push('No current readiness blocker. Watch for rule, wear, or meta changes.');
    $('#coachWeaknesses').innerHTML = weaknesses.slice(0,5).map((text) => `<div class="coach-point warning"><span>!</span><p>${escapeHtml(text)}</p></div>`).join('');

    if (engineering.profiles.length) {
      const avg = (key) => Math.round(engineering.profiles.reduce((sum, p) => sum + Number(p.metrics[key] || 0), 0) / engineering.profiles.length);
      const simple = [
        ['Attack', avg('impactPotential'), false],
        ['Endurance', avg('spinRetention'), false],
        ['Stability', avg('stability'), false],
        ['KO resistance', avg('koResistance'), false],
        ['Self-KO safety', 100 - Math.round(engineering.averageSelfKoRisk), false]
      ];
      $('#coachPhysics').innerHTML = simple.map(([label, score]) => `<div class="coach-physics-row"><span>${escapeHtml(label)}</span><div class="coach-stars" aria-label="${score} out of 100">${'★'.repeat(Math.max(1, Math.min(5, Math.round(score/20))))}${'☆'.repeat(5-Math.max(1, Math.min(5, Math.round(score/20))))}</div><strong>${score}</strong></div>`).join('') + '<p class="model-warning">These are engineering estimates used to choose tests. Real battle results decide readiness.</p>';
    } else $('#coachPhysics').innerHTML = emptyState('Complete three Beys to see the simple behavior guide.');

    $('#coachPatterns').innerHTML = coachPatterns(assessment).map((item) => `<div class="coach-point ${item.kind === 'positive' ? 'positive' : item.kind === 'warning' ? 'warning' : ''}"><span>${item.kind === 'positive' ? '✓' : item.kind === 'warning' ? '!' : '→'}</span><p>${escapeHtml(item.text)}</p></div>`).join('');

    const componentNames = { legality: 'Rules', inventory: 'Owned parts', sample: 'Battle amount', perBey: 'Each Bey tested', matchups: 'Opponent coverage', execution: 'Fair testing', finishes: 'Finish variety', roles: 'Deck role variety', selfKo: 'Self-KO evidence', selfKoPenalty: 'Self-KO adjustment' };
    $('#analysisComponents').innerHTML = Object.entries(assessment.components).map(([name, value]) => `<div class="metric"><span>${escapeHtml(componentNames[name] || name)}</span><strong>${escapeHtml(value)}</strong><span>readiness points</span></div>`).join('');
    renderEngineeringAnalysis();
    $('#readinessGates').innerHTML = assessment.gates.map((gate) => `<div class="gate-row"><span class="gate-icon ${gate.pass ? 'pass' : 'fail'}">${gate.pass ? '✓' : '!'}</span><div><strong>${escapeHtml(gate.label)}</strong><small>${escapeHtml(gate.detail)}</small></div></div>`).join('');
    renderSelfKoAnalysis(assessment);
    renderCoverageMatrix(assessment);
    renderOrderAnalysis();
    renderForecast();
  }

  function renderEngineeringAnalysis() {
    const deck = activeDeck();
    const analysis = Core.engineeringDeckAssessment(deck.beys, partMap(), Core.metaArchetypeWeights(state.metaProfiles));
    if (!analysis.profiles.length) return $('#engineeringAnalysis').innerHTML = emptyState('Complete at least one Bey to calculate engineering proxies.');
    const matchupRows = Core.CORE_ARCHETYPES.map((archetype) => `<div class="engineering-row"><span>vs ${escapeHtml(labelForArchetype(archetype))}</span><div class="engineering-track"><i style="width:${analysis.matchups[archetype]}%"></i></div><strong>${analysis.matchups[archetype]}</strong></div>`).join('');
    const cards = analysis.profiles.map((profile) => `<article class="engineering-card"><div class="engineering-card-head"><div><strong>${profile.deckIndex + 1}. ${escapeHtml(Core.nameForBey(profile.bey, partMap()))}</strong><small>${escapeHtml(profile.inferredRole)} · ${escapeHtml(profile.bitRole)} bit · ${profile.ratchetHeight} height proxy · confidence ${fmtPct(profile.confidence, 0)}</small></div>${badge(`fit ${profile.roleFit}`, 'info')}</div>${engineeringBars(profile)}</article>`).join('');
    $('#engineeringAnalysis').innerHTML = `<div class="engineering-summary"><div class="metric"><span>Deck engineering score</span><strong>${analysis.score}</strong><span>physics-informed proxy</span></div><div class="metric"><span>Weakest modeled matchup</span><strong>${escapeHtml(labelForArchetype(analysis.weakestMatchup))}</strong><span>${analysis.weakestRating}/100 coverage</span></div><div class="metric"><span>Average self-KO risk</span><strong>${analysis.averageSelfKoRisk}</strong><span>lower is better</span></div><div class="metric"><span>Mechanical diversity</span><strong>${analysis.roleSpread}/${analysis.bitRoleSpread}</strong><span>roles / bit roles</span></div></div><div class="engineering-deck-matchups"><h4>Modeled deck coverage</h4>${matchupRows}</div><div class="engineering-grid">${cards}</div><p class="model-warning">This model is for candidate ranking and test design. It does not know measured mass, exact radial mass distribution, launch RPM, friction coefficients, mold variation, wear, or stadium condition. Controlled battle evidence remains the readiness authority.</p>`;
  }

  function renderSelfKoAnalysis(assessment) {
    const deck = activeDeck();
    const rows = deck.beys.map((bey, index) => {
      const signature = Core.beySignature(bey);
      const summary = assessment.analytics.byBey[signature] || Core.summarizeBattles([], DATA.scoring);
      const modeled = Core.modeledSelfKoProbability(bey, partMap());
      const enough = summary.selfKoEvidence >= Number(state.settings.minimumSelfKoTestsPerBey || 8);
      const controlled = enough && summary.selfKoRate <= Number(state.settings.maxObservedSelfKoRate ?? .15);
      const status = controlled ? 'Looks controlled' : enough ? 'Try a safer launch or setup' : 'Run more tests';
      return `<tr><td><strong>${index + 1}. ${escapeHtml(Core.nameForBey(bey, partMap()))}</strong><small>${escapeHtml(status)}</small></td><td><strong>${summary.selfKoEvidence}</strong><small>answered tests</small></td><td><strong>${summary.ownSelfKos}</strong><small>self-KOs</small></td><td><strong>${fmtPct(summary.selfKoRate, 1)}</strong><small>observed rate</small></td><td><strong>${fmtPct(modeled, 1)}</strong><small>engineering estimate</small></td></tr>`;
    }).join('');
    $('#selfKoAnalysis').innerHTML = `<div class="metric-grid"><div class="metric"><span>Total self-KOs</span><strong>${assessment.analytics.overall.ownSelfKos}</strong><span>in ${assessment.analytics.overall.selfKoEvidence} answered tests</span></div><div class="metric"><span>Observed rate</span><strong>${fmtPct(assessment.analytics.overall.selfKoRate, 1)}</strong><span>lower is better</span></div><div class="metric"><span>Simple rule</span><strong>Yes or No</strong><span>No special cause is needed</span></div><div class="metric"><span>What counts?</span><strong>Goes out alone</strong><span>Your Bey jumps or runs out mostly by itself</span></div></div><div class="table-scroll"><table><thead><tr><th>Bey</th><th>Tests</th><th>Self-KOs</th><th>Rate</th><th>Model estimate</th></tr></thead><tbody>${rows}</tbody></table></div><p class="model-warning">A self-KO is a real loss. Save the battle normally and answer Yes. Exclude a test only when the test itself was not fair.</p>`;
  }

  function renderCoverageMatrix(assessment) {
    const deck = activeDeck();
    const archetypes = Core.CORE_ARCHETYPES;
    const header = archetypes.map((id) => `<th>${escapeHtml(labelForArchetype(id))}</th>`).join('');
    const rows = deck.beys.map((bey) => {
      const signature = Core.beySignature(bey);
      const cells = archetypes.map((archetype) => {
        const summary = assessment.analytics.byCell[`${signature}::${archetype}`] || Core.summarizeBattles([], DATA.scoring);
        const target = archetype === 'left-spin' ? Math.max(2, Math.ceil(Number(state.settings.targetPerCell) * .6)) : Number(state.settings.targetPerCell);
        const cls = summary.effective >= target ? 'cell-good' : summary.effective >= Math.ceil(target / 2) ? 'cell-mid' : 'cell-low';
        return `<td class="${cls}"><strong>${summary.effective} tests</strong><small>${summary.effective ? `${fmtPct(summary.winRate, 0)} win · floor ${fmtPct(summary.interval.low, 0)}` : 'No evidence'}</small></td>`;
      }).join('');
      return `<tr><td><strong>${escapeHtml(Core.nameForBey(bey, partMap()))}</strong><small>${escapeHtml(Core.inferBeyRole(bey, partMap()))}</small></td>${cells}</tr>`;
    }).join('');
    $('#coverageMatrix').innerHTML = `<table><thead><tr><th>Your Bey</th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderOrderAnalysis() {
    const deck = activeDeck();
    const result = Core.optimizeDeckOrder({ deck: deck.beys, deckId: deck.id, partMap: partMap(), battles: state.battles, scoring: DATA.scoring, metaProfiles: state.metaProfiles });
    if (!result.available) return $('#orderAnalysis').innerHTML = emptyState(result.reason);
    $('#orderAnalysis').innerHTML = `<p class="muted">${escapeHtml(result.reason)}</p>${result.rankings.slice(0, 3).map((ranking, index) => `<div class="order-card"><div class="list-card-header"><div><strong>#${index + 1} · conservative index ${fmtPct(ranking.conservative, 1)}</strong><div class="order-sequence">${ranking.names.map((name, position) => `<span class="order-step">${position + 1}. ${escapeHtml(name)}</span>`).join('')}</div><small>Expected ${fmtPct(ranking.expected, 1)} · evidence index ${ranking.evidence.toFixed(1)}</small></div>${index === 0 ? `<button class="button secondary compact" type="button" data-apply-order="${ranking.order.join(',')}">Apply</button>` : ''}</div></div>`).join('')}`;
  }

  function runForecast() {
    const deck = activeDeck();
    const orderAnalysis = Core.optimizeDeckOrder({ deck: deck.beys, deckId: deck.id, partMap: partMap(), battles: state.battles, scoring: DATA.scoring, metaProfiles: state.metaProfiles });
    const order = orderAnalysis.available ? orderAnalysis.rankings[0].order : [0,1,2];
    $('#runForecastButton').disabled = true;
    $('#runForecastButton').textContent = 'Running…';
    setTimeout(() => {
      lastForecast = Core.forecastTournament({ deck: deck.beys, deckId: deck.id, partMap: partMap(), battles: state.battles, scoring: DATA.scoring, metaProfiles: state.metaProfiles, targetPoints: currentProfile().targetPoints || 4, simulations: 6000, seed: Number(Core.fnv1a(state.updatedAt), 16), order });
      renderForecast();
      $('#runForecastButton').disabled = false;
      $('#runForecastButton').textContent = 'Run forecast';
      toast(lastForecast.available ? 'Empirical forecast complete.' : lastForecast.reason);
    }, 20);
  }

  function renderForecast() {
    if (!lastForecast) return $('#forecastResults').innerHTML = emptyState('Run the forecast after logging representative matchup evidence.');
    if (!lastForecast.available) return $('#forecastResults').innerHTML = emptyState(lastForecast.reason);
    $('#forecastResults').innerHTML = `<div class="metric-grid"><div class="metric"><span>Estimated match win rate</span><strong>${fmtPct(lastForecast.winRate, 1)}</strong><span>range ${fmtPct(lastForecast.interval.low, 1)}–${fmtPct(lastForecast.interval.high, 1)}</span></div><div class="metric"><span>Average score</span><strong>${lastForecast.averagePointsFor.toFixed(2)}–${lastForecast.averagePointsAgainst.toFixed(2)}</strong><span>${lastForecast.simulations.toLocaleString()} model runs</span></div><div class="metric"><span>Battle evidence</span><strong>${lastForecast.evidenceBattles}</strong><span>relevant decided battles</span></div><div class="metric"><span>Estimated self-KO chance</span><strong>${fmtPct(lastForecast.simulatedSelfKoRate, 1)}</strong><span>uses recorded Yes/No answers</span></div><div class="metric"><span>Model status</span><strong>${lastForecast.lowEvidence ? 'Needs more tests' : 'Evidence-led'}</strong><span>guide only, not a guarantee</span></div></div><p class="muted">${escapeHtml(lastForecast.reason)}</p>`;
  }

  function renderMoreView() {
    renderMetaProfiles();
    renderRuleProfiles();
    renderSettings();
    renderDiagnostics();
  }

  function renderMetaProfiles() {
    $('#metaProfileList').innerHTML = state.metaProfiles.length ? state.metaProfiles.map((profile) => `
      <div class="list-card"><div class="list-card-header"><div><strong>${escapeHtml(profile.name)}</strong><p>Weight ${Number(profile.weight).toFixed(2)} · ${profile.lineup.map(labelForArchetype).map(escapeHtml).join(' → ')}</p></div><div class="list-actions"><button class="button ghost compact" type="button" data-edit-meta="${escapeHtml(profile.id)}">Edit</button><button class="button danger compact" type="button" data-delete-meta="${escapeHtml(profile.id)}">Delete</button></div></div></div>`).join('') : emptyState('Add at least one lineup for order optimization and forecasts.');
  }

  function renderRuleProfiles() {
    const official = Object.values(DATA.profiles).map((profile) => `<div class="list-card compact"><div class="list-card-header"><div><strong>${escapeHtml(profile.name)}</strong><p>${escapeHtml(profile.notes || '')}</p></div>${badge('Preset', 'info')}</div></div>`);
    const custom = state.customProfiles.map((profile) => `<div class="list-card compact"><div class="list-card-header"><div><strong>${escapeHtml(profile.name)}</strong><p>${profile.deckSize} Beys · ${profile.targetPoints} points · ${profile.noDuplicateParts ? 'no repeats' : 'repeats allowed'}</p></div><div class="list-actions"><button class="button ghost compact" type="button" data-edit-profile="${escapeHtml(profile.id)}">Edit</button><button class="button danger compact" type="button" data-delete-profile="${escapeHtml(profile.id)}">Delete</button></div></div></div>`);
    $('#profileList').innerHTML = [...official, ...custom].join('');
  }

  function renderSettings() {
    const form = $('#settingsForm');
    renderGuidePanels();
    Object.entries(state.settings).forEach(([name, value]) => {
      const input = form.elements.namedItem(name);
      if (!input) return;
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = value;
    });
  }

  function renderDiagnostics() {
    const catalogAudit = Core.dataQualityAudit({ ...DATA, parts: allParts(), products: allProducts(), profiles: allProfiles() });
    const stateJson = JSON.stringify(state);
    const active = activeDeck();
    const orphanBattles = state.battles.filter((battle) => !state.decks.some((deck) => deck.id === battle.deckId)).length;
    const unknownInventory = Object.keys(state.inventory).filter((id) => !partMap()[id]).length;
    const diagnostics = {
      appVersion: DATA.meta.version,
      schemaVersion: state.schemaVersion,
      engineeringModelVersion: Core.ENGINEERING_MODEL_VERSION,
      verifiedThrough: DATA.meta.verifiedThrough,
      parts: allParts().length,
      products: allProducts().length,
      decks: state.decks.length,
      battles: state.battles.length,
      activeDeck: active.name,
      catalogPass: catalogAudit.pass,
      catalogIssues: catalogAudit.issues,
      catalogWarnings: catalogAudit.warnings,
      orphanBattles,
      unknownInventory,
      stateChecksum: Core.fnv1a(stateJson),
      storageBytes: new Blob([stateJson]).size
    };
    $('#diagnostics').innerHTML = `${catalogAudit.pass && !orphanBattles && !unknownInventory ? `<div class="list-card compact"><div class="list-card-header"><div><strong>Integrity checks pass</strong><p>No broken catalog references, orphan battles, or unknown inventory IDs.</p></div>${badge('Pass', 'pass')}</div></div>` : ''}<pre class="code-block">${escapeHtml(JSON.stringify(diagnostics, null, 2))}</pre>`;
  }

  function openMetaDialog(profile) {
    const dialog = $('#metaDialog');
    const form = $('#metaForm');
    const archetypes = DATA.archetypes.filter((entry) => entry.id !== 'unknown');
    ['position1','position2','position3'].forEach((name) => {
      const select = form.elements.namedItem(name);
      if (!select.options.length) archetypes.forEach((entry) => select.add(new Option(entry.name, entry.id)));
    });
    form.reset();
    form.elements.id.value = profile?.id || '';
    form.elements.name.value = profile?.name || '';
    form.elements.weight.value = profile?.weight || 1;
    form.elements.position1.value = profile?.lineup?.[0] || 'attack';
    form.elements.position2.value = profile?.lineup?.[1] || 'stamina';
    form.elements.position3.value = profile?.lineup?.[2] || 'defense';
    dialog.showModal();
  }

  function openProfileDialog(profile) {
    const dialog = $('#profileDialog');
    const form = $('#profileForm');
    form.reset();
    form.elements.id.value = profile?.id || '';
    form.elements.name.value = profile?.name || '';
    form.elements.targetPoints.value = profile?.targetPoints || 4;
    form.elements.deckSize.value = profile?.deckSize || 3;
    form.elements.noDuplicateParts.checked = profile ? Boolean(profile.noDuplicateParts) : true;
    form.elements.lockChipPolicy.value = profile?.lockChipPolicy || 'no-duplicates';
    form.elements.bannedParts.value = (profile?.bannedParts || []).join('\n');
    form.elements.notes.value = profile?.notes || '';
    dialog.showModal();
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function readJsonFile(file) {
    if (!file) throw new Error('No file selected.');
    const text = await file.text();
    return JSON.parse(text);
  }

  function exportBackup() {
    const payload = { app: DATA.meta.appName, appVersion: DATA.meta.version, exportedAt: nowIso(), schemaVersion: SCHEMA_VERSION, checksum: Core.fnv1a(JSON.stringify(state)), state };
    downloadJson(`x-deck-lab-backup-${new Date().toISOString().slice(0, 10)}.json`, payload);
    $('#backupStatus').textContent = `Backup exported with checksum ${payload.checksum}.`;
  }

  function catalogTemplate() {
    return {
      schemaVersion: 1,
      generatedBy: DATA.meta.appName,
      instructions: 'Add new parts/products only. IDs must be unique. Custom patches are stored locally and require verification.',
      parts: [{ id: 'custom-example-blade', name: 'Example Blade', category: 'blade', line: 'Custom', status: 'custom', role: 'balance', code: '', notes: 'Replace or remove this example.' }],
      products: [{ id: 'CUSTOM-001', name: 'Example Product', status: 'custom', releaseDate: '', parts: ['custom-example-blade'] }]
    };
  }

  async function importCatalog(file) {
    const patch = await readJsonFile(file);
    if (!Array.isArray(patch.parts) || !Array.isArray(patch.products)) throw new Error('Catalog patch must include parts and products arrays.');
    const validCategories = new Set(DATA.categories.map((category) => category.id));
    const existingPartIds = new Set(allParts().map((part) => part.id));
    const incomingIds = new Set();
    const parts = patch.parts.map((part) => {
      if (!part?.id || !part?.name || !validCategories.has(part.category)) throw new Error(`Invalid part record: ${part?.id || 'missing ID'}.`);
      if (existingPartIds.has(part.id) || incomingIds.has(part.id)) throw new Error(`Duplicate part ID: ${part.id}.`);
      incomingIds.add(part.id);
      return { ...part, status: 'custom', source: 'local catalog patch', role: ['attack','stamina','defense','balance'].includes(part.role) ? part.role : 'balance' };
    });
    const validIds = new Set([...existingPartIds, ...incomingIds]);
    const existingProductIds = new Set(allProducts().map((product) => product.id));
    const incomingProductIds = new Set();
    const products = patch.products.map((product) => {
      if (!product?.id || !product?.name || existingProductIds.has(product.id) || incomingProductIds.has(product.id)) throw new Error(`Invalid or duplicate product ID: ${product?.id || 'missing ID'}.`);
      incomingProductIds.add(product.id);
      (product.parts || []).forEach((id) => { if (!validIds.has(id)) throw new Error(`${product.id} references missing part ${id}.`); });
      return { ...product, status: 'custom' };
    });
    state.customParts.push(...parts);
    state.customProducts.push(...products);
    saveState();
    renderMoreView();
    toast(`${parts.length} parts and ${products.length} products imported.`);
  }

  function closeDialog(button) { button.closest('dialog')?.close(); }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const nav = event.target.closest('[data-nav]');
      if (nav) return navigate(nav.dataset.nav);
      const navTarget = event.target.closest('[data-nav-target]');
      if (navTarget) return navigate(navTarget.dataset.navTarget);
      const close = event.target.closest('[data-close-dialog]');
      if (close) return closeDialog(close);
      const addProductButton = event.target.closest('[data-add-product]');
      if (addProductButton) return addProduct(addProductButton.dataset.addProduct);
      const inventoryDelta = event.target.closest('[data-inventory-delta]');
      if (inventoryDelta) {
        const id = inventoryDelta.closest('[data-part-id]').dataset.partId;
        adjustInventory(id, Number(inventoryDelta.dataset.inventoryDelta));
        renderInventoryList();
        renderDeckValidation();
        return;
      }
      const clearBey = event.target.closest('[data-clear-bey]');
      if (clearBey) {
        activeDeck().beys[Number(clearBey.dataset.clearBey)] = blankBey();
        touchDeck(); renderDeckView(); return;
      }
      const applySuggestion = event.target.closest('[data-apply-suggestion]');
      if (applySuggestion) {
        const suggestion = smartSuggestions[Number(applySuggestion.dataset.applySuggestion)];
        if (suggestion) { activeDeck().beys = suggestion.deck.map(normalizeBey); touchDeck(); smartSuggestions = []; renderDeckView(); toast('Suggested deck applied.'); }
        return;
      }
      const coachNext = event.target.closest('[data-coach-next-test]');
      if (coachNext) {
        const deck = activeDeck();
        const plan = Core.buildTestPlan({ deck: deck.beys, deckId: deck.id, partMap: partMap(), inventory: state.inventory, includeAnnounced: deck.includeAnnounced, battles: state.battles, scoring: DATA.scoring, metaProfiles: state.metaProfiles, settings: state.settings, limit: 1 });
        const first = plan[0];
        if (!first) { navigate(currentAssessment().capacity.valid ? 'test' : 'inventory'); return; }
        navigate('test');
        $('#battleOwnBey').value = first.beyIndex; renderOwnedOpponentOptions(first.opponentSignature); $('#battleForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const task = event.target.closest('[data-plan-bey]');
      if (task) {
        $('#battleOwnBey').value = task.dataset.planBey;
        renderOwnedOpponentOptions(task.dataset.planOpponent);
        $('#battleForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const deleteBattle = event.target.closest('[data-delete-battle]');
      if (deleteBattle) {
        state.battles = state.battles.filter((battle) => battle.id !== deleteBattle.dataset.deleteBattle);
        saveState(); renderTestView(); return;
      }
      const applyOrder = event.target.closest('[data-apply-order]');
      if (applyOrder) {
        const order = applyOrder.dataset.applyOrder.split(',').map(Number);
        const previous = activeDeck().beys.slice();
        activeDeck().beys = order.map((index) => previous[index]);
        touchDeck(); renderAnalysisView(); toast('Deck order applied.'); return;
      }
      const editMeta = event.target.closest('[data-edit-meta]');
      if (editMeta) return openMetaDialog(state.metaProfiles.find((profile) => profile.id === editMeta.dataset.editMeta));
      const deleteMeta = event.target.closest('[data-delete-meta]');
      if (deleteMeta) { state.metaProfiles = state.metaProfiles.filter((profile) => profile.id !== deleteMeta.dataset.deleteMeta); saveState(); renderMoreView(); return; }
      const editProfile = event.target.closest('[data-edit-profile]');
      if (editProfile) return openProfileDialog(state.customProfiles.find((profile) => profile.id === editProfile.dataset.editProfile));
      const deleteProfile = event.target.closest('[data-delete-profile]');
      if (deleteProfile) {
        const id = deleteProfile.dataset.deleteProfile;
        state.customProfiles = state.customProfiles.filter((profile) => profile.id !== id);
        state.decks.forEach((deck) => { if (deck.profileId === id) deck.profileId = 'tt3on3'; });
        saveState(); renderMoreView(); return;
      }
    });

    $('#guideButton').addEventListener('click', () => $('#guideDialog').showModal());
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-open-guide]')) $('#guideDialog').showModal();
      if (event.target.closest('[data-guide-start]')) { $('#guideDialog').close(); navigate('inventory'); }
    });

    $('#modeButton').addEventListener('click', () => { state.settings.experienceMode = experienceMode() === 'advanced' ? 'player' : 'advanced'; saveState(); renderModeState(); renderAnalysisView(); toast(experienceMode() === 'advanced' ? 'Advanced mode enabled.' : 'Player mode enabled.'); });
    $('#inventorySearch').addEventListener('input', renderInventoryList);
    $('#inventoryCategory').addEventListener('change', renderInventoryList);
    $('#productSearch').addEventListener('input', renderProductList);
    $('#partCategory').addEventListener('change', renderPartDialogOptions);
    $('#openPartDialog').addEventListener('click', () => { renderInventoryControls(); $('#partDialog').showModal(); });
    $('#partForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      adjustInventory(String(data.get('partId')), Number(data.get('quantity')), String(data.get('condition')), String(data.get('notes') || '').trim());
      form.reset(); renderInventoryControls(); $('#partDialog').close(); renderInventoryView(); toast('Loose part added.');
    });

    $('#deckSelector').addEventListener('change', (event) => { state.activeDeckId = event.target.value; smartSuggestions = []; lastForecast = null; saveState(); renderDeckView(); });
    $('#profileSelector').addEventListener('change', (event) => { activeDeck().profileId = event.target.value; touchDeck(); renderDeckValidation(); });
    $('#includeAnnouncedToggle').addEventListener('change', (event) => { activeDeck().includeAnnounced = event.target.checked; touchDeck(); renderDeckView(); });
    $('#deckEditor').addEventListener('change', (event) => {
      const index = Number(event.target.dataset.beyIndex);
      if (!Number.isInteger(index)) return;
      if (event.target.matches('[data-bey-system]')) activeDeck().beys[index] = resetBeyForSystem(event.target.value);
      else if (event.target.matches('[data-bey-architecture]')) {
        const bey = activeDeck().beys[index]; bey.customArchitecture = event.target.value; bey.mainBlade = ''; bey.metalBlade = ''; bey.overBlade = '';
      } else if (event.target.matches('[data-bey-drive]')) {
        const bey = activeDeck().beys[index]; bey.customDrive = event.target.value; bey.ratchet = ''; bey.bit = ''; bey.integratedBit = '';
      } else if (event.target.dataset.beyField) activeDeck().beys[index][event.target.dataset.beyField] = event.target.value;
      touchDeck(); renderDeckEditor(); renderDeckValidation();
    });
    $('#smartBuildButton').addEventListener('click', generateSmartBuilds);
    $('#newDeckButton').addEventListener('click', () => { $('#nameDialogMode').value = 'new'; $('#nameDialogTitle').textContent = 'New deck'; $('#deckNameInput').value = `Tournament Deck ${state.decks.length + 1}`; $('#nameDialog').showModal(); });
    $('#renameDeckButton').addEventListener('click', () => { $('#nameDialogMode').value = 'rename'; $('#nameDialogTitle').textContent = 'Rename deck'; $('#deckNameInput').value = activeDeck().name; $('#nameDialog').showModal(); });
    $('#cloneDeckButton').addEventListener('click', () => { $('#nameDialogMode').value = 'clone'; $('#nameDialogTitle').textContent = 'Clone deck'; $('#deckNameInput').value = `${activeDeck().name} copy`; $('#nameDialog').showModal(); });
    $('#deleteDeckButton').addEventListener('click', () => {
      if (state.decks.length <= 1 || !confirm(`Delete ${activeDeck().name}? Battle logs remain in the backup history but will no longer be active.`)) return;
      state.decks = state.decks.filter((deck) => deck.id !== state.activeDeckId); state.activeDeckId = state.decks[0].id; saveState(); renderDeckView();
    });
    $('#nameForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = $('#deckNameInput').value.trim();
      const mode = $('#nameDialogMode').value;
      if (mode === 'new') { const deck = defaultDeck(name); state.decks.push(deck); state.activeDeckId = deck.id; }
      if (mode === 'rename') activeDeck().name = name;
      if (mode === 'clone') { const source = activeDeck(); const deck = { ...source, id: uid('deck'), name, beys: source.beys.map((bey) => ({ ...bey })), createdAt: nowIso(), updatedAt: nowIso() }; state.decks.push(deck); state.activeDeckId = deck.id; }
      saveState(); $('#nameDialog').close(); renderDeckView();
    });

    $('#battleOwnBey').addEventListener('change', () => renderOwnedOpponentOptions());
    $('#battleOpponent').addEventListener('change', renderOpponentPreview);
    $('#battleForm').addEventListener('submit', (event) => { event.preventDefault(); recordBattle(event.currentTarget); });
    $('#refreshPlanButton').addEventListener('click', renderTestPlan);
    $('#clearBattlesButton').addEventListener('click', () => {
      const deck = activeDeck();
      const count = state.battles.filter((battle) => battle.deckId === deck.id).length;
      if (!count || !confirm(`Delete ${count} battle records for ${deck.name}?`)) return;
      state.battles = state.battles.filter((battle) => battle.deckId !== deck.id); saveState(); renderTestView(); toast('Active deck battle history cleared.');
    });
    $('#runForecastButton').addEventListener('click', runForecast);
    $('#coachNextTestButton').addEventListener('click', () => { const button = document.querySelector('[data-coach-next-test]'); if (button) button.click(); else navigate('test'); });

    $('#addMetaButton').addEventListener('click', () => openMetaDialog(null));
    $('#metaForm').addEventListener('submit', (event) => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const id = String(data.get('id') || uid('meta'));
      const profile = { id, name: String(data.get('name')).trim(), weight: Number(data.get('weight')), lineup: [String(data.get('position1')), String(data.get('position2')), String(data.get('position3'))] };
      const index = state.metaProfiles.findIndex((entry) => entry.id === id); if (index >= 0) state.metaProfiles[index] = profile; else state.metaProfiles.push(profile);
      saveState(); $('#metaDialog').close(); renderMoreView();
    });
    $('#addProfileButton').addEventListener('click', () => openProfileDialog(null));
    $('#profileForm').addEventListener('submit', (event) => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const id = String(data.get('id') || uid('profile'));
      const profile = { id, name: String(data.get('name')).trim(), targetPoints: Number(data.get('targetPoints')), deckSize: Number(data.get('deckSize')), noDuplicateParts: data.get('noDuplicateParts') === 'on', lockChipPolicy: String(data.get('lockChipPolicy')), bannedParts: String(data.get('bannedParts') || '').split(/\r?\n|,/).map((id) => id.trim()).filter(Boolean), notes: String(data.get('notes') || '').trim(), custom: true };
      const index = state.customProfiles.findIndex((entry) => entry.id === id); if (index >= 0) state.customProfiles[index] = profile; else state.customProfiles.push(profile);
      saveState(); $('#profileDialog').close(); renderMoreView();
    });
    $('#settingsForm').addEventListener('submit', (event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      ['minimumBattles','minimumPerBey','minimumPerArchetype','targetPerCell','targetPerOpponent','opponentPoolSize','candidatePool','minimumSelfKoTestsPerBey'].forEach((name) => { state.settings[name] = Number(data.get(name)); });
      ['lowerBoundTarget','maxContaminationRate','maxObservedSelfKoRate'].forEach((name) => { state.settings[name] = Number(data.get(name)); });
      state.settings.requireMultiPointFinish = data.get('requireMultiPointFinish') === 'on';
      state.settings.avoidAttackMirrors = data.get('avoidAttackMirrors') === 'on';
      state.settings.showGuide = data.get('showGuide') === 'on';
      state.settings.experienceMode = String(data.get('experienceMode') || 'player');
      saveState(); renderAll(); toast('Settings saved.');
    });
    $('#exportBackupButton').addEventListener('click', exportBackup);
    $('#importBackupInput').addEventListener('change', async (event) => {
      try {
        const payload = await readJsonFile(event.target.files[0]);
        const imported = payload.state || payload;
        if (payload.state && payload.checksum) {
          const actualChecksum = Core.fnv1a(JSON.stringify(imported));
          if (actualChecksum !== payload.checksum) throw new Error(`Backup checksum mismatch: expected ${payload.checksum}, calculated ${actualChecksum}.`);
        }
        const normalized = normalizeState(imported);
        if (!normalized.decks?.length) throw new Error('Backup contains no deck data.');
        state = normalized; saveState(); renderAll(); $('#backupStatus').textContent = 'Backup checksum verified and data normalized to the current schema.'; toast('Backup imported.');
      } catch (error) { console.error(error); $('#backupStatus').textContent = error.message; toast('Backup import failed.'); }
      event.target.value = '';
    });
    $('#exportCatalogButton').addEventListener('click', () => downloadJson('x-deck-lab-catalog-patch-template.json', catalogTemplate()));
    $('#importCatalogInput').addEventListener('change', async (event) => {
      try { await importCatalog(event.target.files[0]); } catch (error) { console.error(error); toast(error.message || 'Catalog import failed.'); }
      event.target.value = '';
    });
    $('#runAuditButton').addEventListener('click', () => { renderDiagnostics(); toast('Diagnostics refreshed.'); });
    $('#resetAppButton').addEventListener('click', () => {
      if (!confirm('Reset all X Deck Lab local data? This cannot be undone.')) return;
      localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_KEY); state = defaultState(); saveState(); smartSuggestions = []; opponentOptions = []; lastForecast = null; renderAll(); navigate('dashboard'); toast('Local data reset.');
    });

    window.addEventListener('online', renderConnectionStatus);
    window.addEventListener('offline', renderConnectionStatus);
    window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; $('#installButton').hidden = false; });
    $('#installButton').addEventListener('click', async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; $('#installButton').hidden = true; });
  }

  function renderConnectionStatus() {
    const status = $('#connectionStatus');
    const online = navigator.onLine;
    status.textContent = online ? 'Local + online' : 'Offline ready';
    status.className = `status-pill ${online ? 'online' : 'offline'}`;
  }

  function renderAll() {
    renderModeState();
    renderConnectionStatus();
    renderInventoryControls();
    renderDashboard();
    renderInventoryView();
    renderDeckView();
    renderTestView();
    renderAnalysisView();
    renderMoreView();
    renderGuidePanels();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./service-worker.js').catch((error) => console.warn('Service worker registration failed.', error));
  }

  bindEvents();
  renderAll();
  registerServiceWorker();
  document.documentElement.dataset.appReady = 'true';
})();
