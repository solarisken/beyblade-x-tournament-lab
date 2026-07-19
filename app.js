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
    state.battles = Array.isArray(source.battles) ? source.battles.filter((battle) => battle?.id) : [];
    state.metaProfiles = Array.isArray(source.metaProfiles) && source.metaProfiles.length
      ? source.metaProfiles.filter((profile) => profile?.id && profile?.name && Array.isArray(profile.lineup))
      : base.metaProfiles;
    state.customProfiles = Array.isArray(source.customProfiles) ? source.customProfiles.filter((profile) => profile?.id && profile?.name) : [];
    state.settings = { ...DATA.testDefaults, ...(source.settings || {}) };
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

  function renderDashboard() {
    const deck = activeDeck();
    const assessment = currentAssessment();
    const plan = Core.buildTestPlan({ deck: deck.beys, deckId: deck.id, partMap: partMap(), battles: state.battles, scoring: DATA.scoring, metaProfiles: state.metaProfiles, settings: state.settings, limit: 4 });
    const hero = $('#dashboardHero');
    hero.style.setProperty('--score-angle', `${assessment.score * 3.6}deg`);
    hero.innerHTML = `
      <div class="hero-top">
        <div><p class="eyebrow">${escapeHtml(deck.name)}</p><h3>${escapeHtml(assessment.label)}</h3><p>${assessment.tournamentReady ? 'All configured evidence gates pass.' : `${assessment.blockers.length} readiness gate${assessment.blockers.length === 1 ? '' : 's'} remain open.`}</p></div>
        <div class="hero-score" aria-label="Readiness score ${assessment.score} out of 100"><strong>${assessment.score}</strong></div>
      </div>
      <div class="hero-footer">${assessment.legality.legal ? badge('Legal', 'pass') : badge('Illegal', 'fail')}${assessment.capacity.valid ? badge('Owned', 'pass') : badge('Part shortage', 'fail')}${badge(`${assessment.analytics.overall.effective} decided battles`, 'info')}</div>`;

    $('#dashboardMetrics').innerHTML = [
      ['Win rate', fmtPct(assessment.analytics.overall.winRate, 1), `95% floor ${fmtPct(assessment.analytics.overall.interval.low, 1)}`],
      ['Point differential', assessment.analytics.overall.pointDifferential > 0 ? `+${assessment.analytics.overall.pointDifferential}` : String(assessment.analytics.overall.pointDifferential), `${assessment.analytics.overall.pointsFor} for / ${assessment.analytics.overall.pointsAgainst} against`],
      ['Role spread', `${assessment.diversity.unique}/3`, assessment.diversity.roles.join(' · ') || 'Complete the deck'],
      ['Data quality', fmtPct(1 - assessment.analytics.overall.contaminationRate, 0), `${assessment.analytics.overall.contaminated} excluded records`]
    ].map(([label, value, note]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><span>${escapeHtml(note)}</span></div>`).join('');

    $('#dashboardPlan').innerHTML = plan.length ? plan.map((task, index) => `
      <div class="list-card compact"><div class="list-card-header"><div><strong>${index + 1}. ${escapeHtml(task.ownName)} vs ${escapeHtml(labelForArchetype(task.opponentArchetype))}</strong><p>${escapeHtml(task.completed)} of ${escapeHtml(task.target)} controlled results. ${escapeHtml(task.rationale)}</p></div>${badge(`${task.deficit} needed`, 'warn')}</div></div>`).join('') : emptyState('Complete the deck or the configured evidence matrix is already filled.');

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
      return `<article class="bey-card"><div class="bey-card-header"><span class="bey-number">${index + 1}</span><div class="bey-title"><strong>${escapeHtml(Core.nameForBey(bey, map))}</strong><small>${Core.beyIsComplete(bey) ? `${escapeHtml(role)} role · ${escapeHtml(bey.system)}` : 'Incomplete combination'}</small></div><button class="icon-button" type="button" data-clear-bey="${index}" aria-label="Clear Bey ${index + 1}">×</button></div><div class="bey-fields">${fields}</div></article>`;
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
      <div class="list-card"><div class="list-card-header"><div><strong>#${index + 1} · ${suggestion.roles.map((role) => escapeHtml(role)).join(' / ')}</strong><p>${suggestion.deck.map((bey, beyIndex) => `${beyIndex + 1}. ${escapeHtml(Core.nameForBey(bey, partMap()))}`).join('<br>')}</p><p>${escapeHtml(suggestion.note)}</p></div><button class="button primary compact" type="button" data-apply-suggestion="${index}">Use deck</button></div></div>`).join('') : '';
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
        smartSuggestions = Core.suggestDecks({ inventory: state.inventory, partMap: partMap(), profile: currentProfile(), includeAnnounced: activeDeck().includeAnnounced, battles: state.battles, settings: state.settings, limit: 5 });
        renderSmartSuggestions();
        toast(smartSuggestions.length ? `${smartSuggestions.length} legal deck shortlists generated.` : 'No three-Bey legal deck can be built from the current inventory.');
      } catch (error) {
        console.error(error);
        toast('Optimizer failed. Run diagnostics and verify catalog data.');
      } finally {
        $('#smartBuildButton').disabled = false;
        $('#smartBuildButton').textContent = 'Generate ranked decks';
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
    const plan = Core.buildTestPlan({ deck: deck.beys, deckId: deck.id, partMap: partMap(), battles: state.battles, scoring: DATA.scoring, metaProfiles: state.metaProfiles, settings: state.settings, limit: 12 });
    const assessment = currentAssessment();
    $('#planProgress').textContent = `${assessment.analytics.overall.effective} decided battles`;
    $('#testPlanList').innerHTML = plan.length ? plan.map((task, index) => `
      <button class="test-task" type="button" data-plan-bey="${task.beyIndex}" data-plan-archetype="${escapeHtml(task.opponentArchetype)}"><div><strong>${escapeHtml(task.ownName)} vs ${escapeHtml(labelForArchetype(task.opponentArchetype))}</strong><small>${escapeHtml(task.rationale)}</small><progress max="${task.target}" value="${task.completed}"></progress><small>${task.completed}/${task.target} valid results</small></div><span class="task-rank">${index + 1}</span></button>`).join('') : emptyState('No adaptive task is available. Complete the deck or raise evidence targets in Platform controls.');
  }

  function renderBattleFormOptions() {
    const deck = activeDeck();
    $('#battleOwnBey').innerHTML = deck.beys.map((bey, index) => `<option value="${index}" ${Core.beyIsComplete(bey) ? '' : 'disabled'}>${index + 1}. ${escapeHtml(Core.nameForBey(bey, partMap()))}</option>`).join('');
    if (!$('#battleArchetype').options.length) DATA.archetypes.forEach((entry) => $('#battleArchetype').add(new Option(entry.name, entry.id)));
    if (!$('#battleStadium').options.length) DATA.stadiums.forEach((entry) => $('#battleStadium').add(new Option(entry, entry)));
    if (!$('#battlePosition').options.length) DATA.launchPositions.forEach((entry) => $('#battlePosition').add(new Option(entry, entry)));
    if (!$('#battleTechnique').options.length) DATA.launchTechniques.forEach((entry) => $('#battleTechnique').add(new Option(entry, entry)));
  }

  function renderBattleHistory() {
    const deck = activeDeck();
    const battles = state.battles.filter((battle) => battle.deckId === deck.id).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 40);
    $('#battleHistory').innerHTML = battles.length ? battles.map((battle) => {
      const normalized = Core.normalizeBattle(battle, DATA.scoring);
      return `<div class="history-item ${escapeHtml(normalized.result)} ${normalized.contaminated ? 'contaminated' : ''}"><div class="history-top"><div><strong>${escapeHtml(battle.ownName || 'Deck Bey')} · ${escapeHtml(normalized.result.toUpperCase())}</strong><p>${escapeHtml(labelForArchetype(battle.opponentArchetype))}${battle.opponentName ? ` · ${escapeHtml(battle.opponentName)}` : ''} · ${escapeHtml(normalized.finish)} finish · ${normalized.points} point${normalized.points === 1 ? '' : 's'}</p></div><button class="icon-button" type="button" data-delete-battle="${escapeHtml(battle.id)}" aria-label="Delete battle">×</button></div><p>${escapeHtml(fmtDate(battle.timestamp))}${normalized.contaminated ? ' · excluded from decided evidence' : ''}${battle.notes ? ` · ${escapeHtml(battle.notes)}` : ''}</p></div>`;
    }).join('') : emptyState('No battles are logged for the active deck.');
  }

  function recordBattle(form) {
    const data = new FormData(form);
    const deck = activeDeck();
    const ownBeyIndex = Number(data.get('ownBeyIndex'));
    const bey = deck.beys[ownBeyIndex];
    if (!Core.beyIsComplete(bey)) return toast('Select a complete Bey.');
    let result = String(data.get('result'));
    let finish = String(data.get('finish'));
    if (result === 'draw') finish = 'draw';
    if (result === 'relaunch') finish = 'relaunch';
    const battle = {
      id: uid('battle'),
      deckId: deck.id,
      deckName: deck.name,
      ownBeyIndex,
      ownSignature: Core.beySignature(bey),
      ownName: Core.nameForBey(bey, partMap()),
      opponentArchetype: String(data.get('opponentArchetype')),
      opponentName: String(data.get('opponentName') || '').trim(),
      result,
      finish,
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
    toast('Battle recorded. Readiness evidence recalculated.');
  }

  function renderAnalysisView() {
    const assessment = currentAssessment();
    const deck = activeDeck();
    const hero = $('#analysisHero');
    hero.style.setProperty('--score-angle', `${assessment.score * 3.6}deg`);
    hero.innerHTML = `<div class="hero-top"><div><p class="eyebrow">${escapeHtml(deck.name)}</p><h3>${escapeHtml(assessment.label)}</h3><p>Win rate ${fmtPct(assessment.analytics.overall.winRate, 1)}; Wilson 95% interval ${fmtPct(assessment.analytics.overall.interval.low, 1)}–${fmtPct(assessment.analytics.overall.interval.high, 1)} from ${assessment.analytics.overall.effective} decided battles.</p></div><div class="hero-score"><strong>${assessment.score}</strong></div></div><div class="hero-footer">${assessment.tournamentReady ? badge('Ready under configured policy', 'pass') : badge(`${assessment.blockers.length} gates open`, 'fail')}${badge(`Catalog checked ${DATA.meta.verifiedThrough}`, 'info')}</div>`;
    $('#analysisComponents').innerHTML = Object.entries(assessment.components).map(([name, value]) => `<div class="metric"><span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong><span>component points</span></div>`).join('');
    $('#readinessGates').innerHTML = assessment.gates.map((gate) => `<div class="gate-row"><span class="gate-icon ${gate.pass ? 'pass' : 'fail'}">${gate.pass ? '✓' : '!'}</span><div><strong>${escapeHtml(gate.label)}</strong><small>${escapeHtml(gate.detail)}</small></div></div>`).join('');
    renderCoverageMatrix(assessment);
    renderOrderAnalysis();
    renderForecast();
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
    $('#forecastResults').innerHTML = `<div class="metric-grid"><div class="metric"><span>Estimated match win rate</span><strong>${fmtPct(lastForecast.winRate, 1)}</strong><span>95% simulation interval ${fmtPct(lastForecast.interval.low, 1)}–${fmtPct(lastForecast.interval.high, 1)}</span></div><div class="metric"><span>Average score</span><strong>${lastForecast.averagePointsFor.toFixed(2)}–${lastForecast.averagePointsAgainst.toFixed(2)}</strong><span>${lastForecast.simulations.toLocaleString()} simulated matches</span></div><div class="metric"><span>Empirical evidence</span><strong>${lastForecast.evidenceBattles}</strong><span>relevant decided battles</span></div><div class="metric"><span>Model status</span><strong>${lastForecast.lowEvidence ? 'Prior-heavy' : 'Evidence-led'}</strong><span>not a physics simulation</span></div></div><p class="muted">${escapeHtml(lastForecast.reason)}</p>`;
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
      const task = event.target.closest('[data-plan-bey]');
      if (task) {
        $('#battleOwnBey').value = task.dataset.planBey;
        $('#battleArchetype').value = task.dataset.planArchetype;
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

    $('#battleForm').addEventListener('submit', (event) => { event.preventDefault(); recordBattle(event.currentTarget); });
    $('#refreshPlanButton').addEventListener('click', renderTestPlan);
    $('#clearBattlesButton').addEventListener('click', () => {
      const deck = activeDeck();
      const count = state.battles.filter((battle) => battle.deckId === deck.id).length;
      if (!count || !confirm(`Delete ${count} battle records for ${deck.name}?`)) return;
      state.battles = state.battles.filter((battle) => battle.deckId !== deck.id); saveState(); renderTestView(); toast('Active deck battle history cleared.');
    });
    $('#runForecastButton').addEventListener('click', runForecast);

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
      ['minimumBattles','minimumPerBey','minimumPerArchetype','targetPerCell'].forEach((name) => { state.settings[name] = Number(data.get(name)); });
      ['lowerBoundTarget','maxContaminationRate'].forEach((name) => { state.settings[name] = Number(data.get(name)); });
      state.settings.requireMultiPointFinish = data.get('requireMultiPointFinish') === 'on';
      state.settings.avoidAttackMirrors = data.get('avoidAttackMirrors') === 'on';
      saveState(); renderMoreView(); toast('Readiness policy saved.');
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
      localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_KEY); state = defaultState(); saveState(); smartSuggestions = []; lastForecast = null; renderAll(); navigate('dashboard'); toast('Local data reset.');
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
    renderConnectionStatus();
    renderInventoryControls();
    renderDashboard();
    renderInventoryView();
    renderDeckView();
    renderTestView();
    renderAnalysisView();
    renderMoreView();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./service-worker.js').catch((error) => console.warn('Service worker registration failed.', error));
  }

  bindEvents();
  renderAll();
  registerServiceWorker();
  document.documentElement.dataset.appReady = 'true';
})();
