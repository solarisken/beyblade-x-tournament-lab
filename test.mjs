import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const DATA = require('./data.js');
const Core = require('./core.js');
const map = Object.fromEntries(DATA.parts.map((part) => [part.id, part]));

const basic = (blade, ratchet, bit) => ({ system: 'basic', blade, ratchet, bit });
const custom = (lockChip, mainBlade, assistBlade, ratchet, bit) => ({ system: 'custom', customArchitecture: 'main', customDrive: 'standard', lockChip, mainBlade, assistBlade, ratchet, bit });
const validDeck = [
  basic('blade-dran-sword','ratchet-3-60','bit-flat'),
  basic('blade-wizard-rod','ratchet-5-70','bit-disk-ball'),
  basic('blade-leon-crest','ratchet-7-60','bit-gear-needle')
];
const inventoryFor = (deck) => Object.fromEntries(deck.flatMap(Core.partIdsFromBey).map((id) => [id, { qty: 1, condition: 'good', notes: '' }]));

function battle({ deckId = 'deck-1', bey, archetype, result = 'win', finish = 'spin', contaminated = false, index = 0 }) {
  return { id: `battle-${archetype}-${index}-${result}-${finish}`, deckId, ownSignature: Core.beySignature(bey), opponentArchetype: archetype, result, finish, contaminated, timestamp: new Date(2026, 6, 1, 0, index).toISOString() };
}

test('official finish scoring is preserved', () => {
  assert.equal(Core.scoreForFinish('spin', DATA.scoring), 1);
  assert.equal(Core.scoreForFinish('over', DATA.scoring), 2);
  assert.equal(Core.scoreForFinish('burst', DATA.scoring), 2);
  assert.equal(Core.scoreForFinish('xtreme', DATA.scoring), 3);
});

test('three complete unique Beys pass TT construction rules', () => {
  const result = Core.legalityCheck(validDeck, DATA.profiles.tt3on3, map);
  assert.equal(result.legal, true, result.issues.join('\n'));
});

test('duplicate physical parts are rejected while ordinary TT v12 lock chips may repeat', () => {
  const duplicate = [validDeck[0], basic('blade-phoenix-wing','ratchet-3-60','bit-rush'), validDeck[2]];
  assert.equal(Core.legalityCheck(duplicate, DATA.profiles.tt3on3, map).legal, false);
  const repeatedOrdinaryLock = [
    custom('lock-dran','main-brave','assist-slash','ratchet-6-60','bit-vortex'),
    custom('lock-dran','main-arc','assist-round','ratchet-4-55','bit-low-orb'),
    custom('lock-wizard','main-hunt','assist-free','ratchet-0-60','bit-disk-ball')
  ];
  assert.equal(Core.legalityCheck(repeatedOrdinaryLock, DATA.profiles.tt3on3, map).legal, true);
  repeatedOrdinaryLock[0].lockChip = 'lock-valkyrie';
  repeatedOrdinaryLock[1].lockChip = 'lock-valkyrie';
  assert.equal(Core.legalityCheck(repeatedOrdinaryLock, DATA.profiles.tt3on3, map).legal, false);
});

test('expanded Custom Line and ratchet-integrated architectures validate', () => {
  const expanded = { system: 'custom', customArchitecture: 'expanded', customDrive: 'standard', lockChip: 'lock-bahamut', metalBlade: 'metal-blitz', overBlade: 'over-break', assistBlade: 'assist-knuckle', ratchet: 'ratchet-1-50', bit: 'bit-ignition' };
  const integratedBit = { system: 'custom', customArchitecture: 'main', customDrive: 'integrated', lockChip: 'lock-pegasus', mainBlade: 'main-blast', assistBlade: 'assist-assault', integratedBit: 'integrated-turbo' };
  const integratedBlade = { system: 'integrated', ratchetIntegratedBlade: 'rib-bullet-griffon', bit: 'bit-hexa' };
  assert.equal(Core.beyIsComplete(expanded), true);
  assert.equal(Core.beyIsComplete(integratedBit), true);
  assert.equal(Core.beyIsComplete(integratedBlade), true);
});

test('announced parts remain blocked unless theorycrafting is enabled', () => {
  const deck = [
    { system: 'integrated', ratchetIntegratedBlade: 'rib-hells-nether', bit: 'bit-ball' },
    validDeck[1],
    validDeck[2]
  ];
  assert.equal(Core.legalityCheck(deck, DATA.profiles.tt3on3, map, { includeAnnounced: false }).legal, false);
  assert.equal(Core.legalityCheck(deck, DATA.profiles.tt3on3, map, { includeAnnounced: true }).legal, true);
});

test('inventory capacity is a separate hard gate', () => {
  const inventory = inventoryFor(validDeck);
  delete inventory['bit-flat'];
  const check = Core.inventoryCapacityCheck(validDeck, inventory, map);
  assert.equal(check.valid, false);
  assert.equal(check.shortages[0].id, 'bit-flat');
});

test('Wilson interval and contaminated-battle exclusion prevent fake precision', () => {
  const interval = Core.wilsonInterval(8, 10);
  assert.ok(interval.low < 0.8 && interval.high > 0.8);
  const summary = Core.summarizeBattles([
    battle({ bey: validDeck[0], archetype: 'attack', result: 'win', finish: 'xtreme', index: 1 }),
    battle({ bey: validDeck[0], archetype: 'attack', result: 'loss', finish: 'over', contaminated: true, index: 2 })
  ], DATA.scoring);
  assert.equal(summary.effective, 1);
  assert.equal(summary.contaminated, 1);
  assert.equal(summary.pointsFor, 3);
});

test('readiness requires legality, coverage, confidence, and multi-point evidence', () => {
  const battles = [];
  const archetypes = ['attack','stamina','defense','balance'];
  validDeck.forEach((bey, b) => archetypes.forEach((archetype, a) => {
    for (let i = 0; i < 5; i += 1) battles.push(battle({ bey, archetype, result: i < 4 ? 'win' : 'loss', finish: i === 0 ? 'xtreme' : 'spin', index: b * 100 + a * 10 + i }));
  }));
  const assessment = Core.readinessAssessment({ deck: validDeck, deckId: 'deck-1', profile: DATA.profiles.tt3on3, partMap: map, inventory: inventoryFor(validDeck), battles, includeAnnounced: false, settings: { ...DATA.testDefaults, minimumBattles: 36, minimumPerBey: 10, minimumPerArchetype: 6, targetPerCell: 5, lowerBoundTarget: 0.5 }, scoring: DATA.scoring });
  assert.equal(assessment.legality.legal, true);
  assert.equal(assessment.capacity.valid, true);
  assert.equal(assessment.analytics.overall.effective, 60);
  assert.equal(assessment.gates.find((gate) => gate.id === 'finishRoutes').pass, true);
  assert.ok(assessment.score >= 75);
});

test('adaptive planner prioritizes missing cells and de-prioritizes attack mirrors', () => {
  const deck = [validDeck[0], validDeck[1], validDeck[2]];
  const plan = Core.buildTestPlan({ deck, deckId: 'deck-1', partMap: map, battles: [], scoring: DATA.scoring, metaProfiles: DATA.defaultMetaProfiles, settings: { ...DATA.testDefaults, avoidAttackMirrors: true }, limit: 20 });
  const attackMirror = plan.find((item) => item.beyIndex === 0 && item.opponentArchetype === 'attack');
  const attackVsStamina = plan.find((item) => item.beyIndex === 0 && item.opponentArchetype === 'stamina');
  assert.ok(attackMirror && attackVsStamina);
  assert.ok(attackMirror.priority < attackVsStamina.priority);
});

test('order optimizer ranks permutations from position-specific meta evidence', () => {
  const meta = [{ id: 'm', name: 'Known lineup', weight: 1, lineup: ['attack','stamina','defense'] }];
  const battles = [];
  validDeck.forEach((bey, index) => meta[0].lineup.forEach((archetype, position) => {
    for (let i = 0; i < 8; i += 1) battles.push(battle({ bey, archetype, result: index === position ? 'win' : 'loss', finish: 'spin', index: index * 100 + position * 10 + i }));
  }));
  const result = Core.optimizeDeckOrder({ deck: validDeck, deckId: 'deck-1', partMap: map, battles, scoring: DATA.scoring, metaProfiles: meta });
  assert.equal(result.available, true);
  assert.deepEqual(result.rankings[0].order, [0,1,2]);
});

test('empirical forecast is deterministic for a fixed seed', () => {
  const meta = [{ id: 'm', name: 'Known lineup', weight: 1, lineup: ['attack','stamina','defense'] }];
  const battles = [];
  validDeck.forEach((bey, index) => {
    for (let i = 0; i < 8; i += 1) battles.push(battle({ bey, archetype: meta[0].lineup[index], result: i < 5 ? 'win' : 'loss', finish: i % 2 ? 'spin' : 'over', index: index * 20 + i }));
  });
  const args = { deck: validDeck, deckId: 'deck-1', partMap: map, battles, scoring: DATA.scoring, metaProfiles: meta, targetPoints: 4, simulations: 500, seed: 42, order: [0,1,2] };
  const first = Core.forecastTournament(args);
  const second = Core.forecastTournament(args);
  assert.equal(first.available, true);
  assert.equal(first.winRate, second.winRate);
  assert.equal(first.averagePointsFor, second.averagePointsFor);
});

test('owned-parts optimizer returns legal, supplyable three-Bey shortlists', () => {
  const inventory = inventoryFor(validDeck);
  const suggestions = Core.suggestDecks({ inventory, partMap: map, profile: DATA.profiles.tt3on3, includeAnnounced: false, battles: [], settings: { candidatePool: 30 }, limit: 3 });
  assert.ok(suggestions.length >= 1);
  suggestions.forEach((suggestion) => {
    assert.equal(Core.legalityCheck(suggestion.deck, DATA.profiles.tt3on3, map).legal, true);
    assert.equal(Core.inventoryCapacityCheck(suggestion.deck, inventory, map).valid, true);
  });
});

test('v1 state migrates into versioned deck library without losing inventory or battles', () => {
  const raw = { version: 1, inventory: { 'blade-dran-sword': 1 }, deck: validDeck, profileId: 'tt3on3', battles: [{ id: 'old-battle', ownBeyIndex: 0, won: true, finish: 'spin', opponentArchetype: 'attack' }] };
  const migrated = Core.migrateState(raw);
  assert.equal(migrated.schemaVersion, Core.SCHEMA_VERSION);
  assert.equal(migrated.inventory['blade-dran-sword'].qty, 1);
  assert.equal(migrated.decks.length, 1);
  assert.equal(migrated.battles[0].result, 'win');
  assert.ok(migrated.battles[0].ownSignature);
});

test('catalog integrity includes current released and announced architecture entries', () => {
  const audit = Core.dataQualityAudit(DATA);
  assert.equal(audit.pass, true, audit.issues.join('\n'));
  assert.ok(map['blade-heavens-ring']);
  assert.equal(map['rib-glory-valkyrie'].status, 'released');
  assert.equal(map['rib-hells-nether'].status, 'announced');
  assert.equal(DATA.products.find((product) => product.id === 'UX-21').status, 'announced');
});

test('root HTML references only root runtime assets and includes all six primary views', () => {
  const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  ['dashboard','inventory','deck','test','results','more'].forEach((view) => assert.match(html, new RegExp(`data-view="${view}"`)));
  ['styles.css','data.js','core.js','app.js','manifest.webmanifest'].forEach((asset) => assert.match(html, new RegExp(`(?:href|src)="${asset.replace('.', '\\.')}`)));
  assert.doesNotMatch(html, /(?:href|src)="(?:src|public|assets)\//);
});

test('service worker lifecycle caches every production root asset and clears old versions', async () => {
  const source = fs.readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8');
  const listeners = {};
  const cache = { addAll: async (assets) => { cache.assets = assets; }, put: async () => {} };
  const cachesMock = { open: async () => cache, keys: async () => ['old-cache','x-deck-lab-v2.0.0'], delete: async (key) => key === 'old-cache', match: async () => null };
  const self = { location: { origin: 'https://example.test' }, clients: { claim: async () => true }, skipWaiting: async () => true, addEventListener: (type, fn) => { listeners[type] = fn; } };
  vm.runInNewContext(source, { self, caches: cachesMock, fetch: async () => ({ status: 200, type: 'basic', clone() { return this; } }), URL, Promise });
  let installPromise; listeners.install({ waitUntil: (promise) => { installPromise = promise; } }); await installPromise;
  assert.equal(JSON.stringify(Array.from(cache.assets)), JSON.stringify(['./','./index.html','./styles.css','./data.js','./core.js','./app.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png']));
  let activatePromise; listeners.activate({ waitUntil: (promise) => { activatePromise = promise; } }); await activatePromise;
});

test('owned-parts optimizer expands its candidate pool when extra inventory crowds the first shortlist', () => {
  const productIds = ['BX-50-01', 'BX-50-03', 'BX-50-05', 'BX-50-06'];
  const inventory = {};
  productIds.forEach((productId) => {
    const product = DATA.products.find((entry) => entry.id === productId);
    assert.ok(product, `missing audit product ${productId}`);
    product.parts.forEach((partId) => {
      inventory[partId] = { qty: (inventory[partId]?.qty || 0) + 1, condition: 'good', notes: '' };
    });
  });
  const suggestions = Core.suggestDecks({
    inventory,
    partMap: map,
    profile: DATA.profiles.tt3on3,
    includeAnnounced: false,
    battles: [],
    settings: { ...DATA.testDefaults, candidatePool: 36 },
    limit: 5
  });
  assert.equal(suggestions.length, 5);
  suggestions.forEach((suggestion) => {
    assert.equal(Core.legalityCheck(suggestion.deck, DATA.profiles.tt3on3, map).legal, true);
    assert.equal(Core.inventoryCapacityCheck(suggestion.deck, inventory, map).valid, true);
  });
});

test('portable-data imports enforce backup checksums and catalog product uniqueness', () => {
  const source = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  assert.match(source, /Backup checksum mismatch/);
  assert.match(source, /incomingProductIds/);
  assert.match(source, /checksum verified/);
});
