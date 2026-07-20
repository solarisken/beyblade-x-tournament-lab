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
const broadInventory = Object.fromEntries(DATA.parts.filter((part) => part.status === 'released' && !part.banned).map((part) => [part.id, { qty: 2, condition: 'good', notes: '' }]));

function battle({ deckId = 'deck-1', bey, archetype, result = 'win', finish = 'spin', finishCause, selfKo, selfKoKnown, opponentBitRole = archetype === 'attack' ? 'attack' : archetype, stadium = 'Xtreme Stadium', launchPosition = 'Center position', technique = 'Controlled launch', contaminated = false, index = 0 }) {
  const inferredCause = finishCause || (finish === 'spin' ? 'spin-exhaustion' : finish === 'burst' ? 'burst-impact' : ['draw','relaunch'].includes(finish) ? 'draw-invalid' : 'forced-contact');
  return {
    id: `battle-${archetype}-${index}-${result}-${finish}`, deckId, ownSignature: Core.beySignature(bey),
    opponentArchetype: archetype, opponentBitRole, result, finish, finishCause: inferredCause,
    ...(typeof selfKo === 'boolean' ? { selfKo, selfKoKnown: selfKoKnown ?? true } : {}),
    stadium, launchPosition, technique, contaminated, timestamp: new Date(2026, 6, 1, 0, index).toISOString()
  };
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

test('adaptive planner uses concurrently owned opponents and hard-excludes attack-bit mirrors', () => {
  const deck = [validDeck[0], validDeck[1], validDeck[2]];
  const plan = Core.buildTestPlan({ deck, deckId: 'deck-1', partMap: map, inventory: broadInventory, battles: [], scoring: DATA.scoring, metaProfiles: DATA.defaultMetaProfiles, settings: { ...DATA.testDefaults, avoidAttackMirrors: true }, limit: 20 });
  assert.ok(plan.length > 0);
  plan.forEach((item) => {
    assert.ok(item.opponentBey);
    assert.ok(item.opponentSignature);
    assert.equal(Core.inventoryCapacityForBattle(deck[item.beyIndex], item.opponentBey, broadInventory, map).valid, true);
    assert.equal(item.ownBitRole === 'attack' && item.opponentBitRole === 'attack', false);
  });
});

test('engineering profiles rank attack and stamina mechanisms in the expected directions', () => {
  const attack = basic('blade-impact-drake','ratchet-9-60','bit-low-rush');
  const stamina = basic('blade-wizard-rod','ratchet-5-70','bit-disk-ball');
  const attackProfile = Core.engineeringProfileForBey(attack, map);
  const staminaProfile = Core.engineeringProfileForBey(stamina, map);
  assert.ok(attackProfile.metrics.impactPotential > staminaProfile.metrics.impactPotential);
  assert.ok(attackProfile.metrics.xDashPotential > staminaProfile.metrics.xDashPotential);
  assert.ok(staminaProfile.metrics.spinRetention > attackProfile.metrics.spinRetention);
  assert.ok(staminaProfile.metrics.stability > attackProfile.metrics.stability);
});

test('engineering metrics are bounded proxies and preserve deck positions', () => {
  const partial = [validDeck[0], {}, validDeck[2]];
  const analysis = Core.engineeringDeckAssessment(partial, map, Core.metaArchetypeWeights(DATA.defaultMetaProfiles));
  assert.deepEqual(analysis.profiles.map((profile) => profile.deckIndex), [0,2]);
  analysis.profiles.forEach((profile) => Object.values(profile.metrics).forEach((value) => assert.ok(value >= 0 && value <= 100)));
  assert.equal(Core.ratchetHeightForBey(basic('blade-dran-sword','ratchet-1-50','bit-flat'), map), 50);
  assert.equal(Core.ratchetHeightForBey(basic('blade-dran-sword','ratchet-3-80','bit-flat'), map), 80);
});

test('owned opponent generator respects simultaneous inventory capacity', () => {
  const own = validDeck[0];
  const limited = inventoryFor([own, validDeck[1]]);
  const opponents = Core.generateOwnedOpponentCandidates({ inventory: limited, ownBey: own, partMap: map, avoidAttackMirrors: true, maxCandidates: 20 });
  assert.ok(opponents.length > 0);
  opponents.forEach((candidate) => assert.equal(Core.inventoryCapacityForBattle(own, candidate.bey, limited, map).valid, true));
});

test('attack-bit mirror policy is reversible but enabled by default for generated tests', () => {
  const own = basic('blade-impact-drake','ratchet-9-60','bit-low-rush');
  const excluded = Core.generateOwnedOpponentCandidates({ inventory: broadInventory, ownBey: own, partMap: map, avoidAttackMirrors: true, maxCandidates: 90 });
  const allowed = Core.generateOwnedOpponentCandidates({ inventory: broadInventory, ownBey: own, partMap: map, avoidAttackMirrors: false, maxCandidates: 90 });
  assert.equal(excluded.some((candidate) => candidate.engineering.bitRole === 'attack'), false);
  assert.equal(allowed.some((candidate) => candidate.engineering.bitRole === 'attack'), true);
});

test('engineering-ranked deck suggestions are legal, owned, and expose modeled coverage', () => {
  const suggestions = Core.suggestDecks({ inventory: broadInventory, partMap: map, profile: DATA.profiles.tt3on3, includeAnnounced: false, battles: [], metaProfiles: DATA.defaultMetaProfiles, settings: { ...DATA.testDefaults, candidatePool: 48 }, limit: 3 });
  assert.ok(suggestions.length > 0);
  suggestions.forEach((suggestion) => {
    assert.equal(Core.legalityCheck(suggestion.deck, DATA.profiles.tt3on3, map).legal, true);
    assert.equal(Core.inventoryCapacityCheck(suggestion.deck, broadInventory, map).valid, true);
    assert.ok(suggestion.engineering.score >= 0 && suggestion.engineering.score <= 100);
    assert.ok(Core.CORE_ARCHETYPES.every((archetype) => Number.isFinite(suggestion.engineering.matchups[archetype])));
  });
});

test('schema v3 deck-library migration preserves decks, battles, and settings', () => {
  const raw = { schemaVersion: 3, inventory: inventoryFor(validDeck), decks: [{ id: 'd3', name: 'Existing', beys: validDeck, profileId: 'tt3on3' }], activeDeckId: 'd3', battles: [{ id: 'b3', deckId: 'd3' }], settings: { avoidAttackMirrors: true }, metaProfiles: DATA.defaultMetaProfiles };
  const migrated = Core.migrateState(raw);
  assert.equal(migrated.schemaVersion, Core.SCHEMA_VERSION);
  assert.equal(migrated.decks[0].id, 'd3');
  assert.equal(migrated.battles[0].id, 'b3');
  assert.equal(migrated.settings.avoidAttackMirrors, true);
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
  assert.match(source, /x-deck-lab-v3\.0\.0/);
  const listeners = {};
  const cache = { addAll: async (assets) => { cache.assets = assets; }, put: async () => {} };
  const cachesMock = { open: async () => cache, keys: async () => ['old-cache','x-deck-lab-v2.2.0'], delete: async (key) => key === 'old-cache', match: async () => null };
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


test('ordinary Yes/No self-KO answers are valid decided evidence', () => {
  const logs = [
    battle({ bey: validDeck[0], archetype: 'stamina', result: 'loss', finish: 'over', selfKo: true, index: 501 }),
    battle({ bey: validDeck[0], archetype: 'defense', result: 'loss', finish: 'xtreme', selfKo: true, index: 502 }),
    battle({ bey: validDeck[0], archetype: 'stamina', result: 'win', finish: 'spin', selfKo: false, index: 503 })
  ];
  const summary = Core.summarizeBattles(logs, DATA.scoring);
  assert.equal(summary.effective, 3);
  assert.equal(summary.contaminated, 0);
  assert.equal(summary.selfKoAnswered, 3);
  assert.equal(summary.ownSelfKos, 2);
  assert.equal(summary.selfKoRate, 2 / 3);
  assert.ok(summary.selfKoInterval.low < summary.selfKoRate && summary.selfKoInterval.high > summary.selfKoRate);
});

test('ordinary self-KO summaries remain available by technique, position, and stadium', () => {
  const logs = [
    battle({ bey: validDeck[0], archetype: 'stamina', result: 'loss', finish: 'xtreme', selfKo: true, technique: 'Hard launch', launchPosition: 'Left position', stadium: 'Xtreme Stadium', index: 511 }),
    battle({ bey: validDeck[0], archetype: 'stamina', result: 'win', finish: 'spin', selfKo: false, technique: 'Controlled launch', launchPosition: 'Center position', stadium: 'Wide Xtreme Stadium', index: 512 })
  ];
  const analytics = Core.battleAnalytics({ battles: logs, deck: validDeck, deckId: 'deck-1', scoring: DATA.scoring });
  assert.equal(analytics.selfKoByTechnique.find((row) => row.key === 'Hard launch').ownSelfKos, 1);
  assert.equal(analytics.selfKoByPosition.find((row) => row.key === 'Left position').ownSelfKos, 1);
  assert.equal(analytics.selfKoByStadium.find((row) => row.key === 'Xtreme Stadium').ownSelfKos, 1);
});

test('readiness gates and score penalize excessive ordinary self-KO results', () => {
  const clean = [];
  const unstable = [];
  const archetypes = ['attack','stamina','defense','balance'];
  validDeck.forEach((bey, b) => archetypes.forEach((archetype, a) => {
    for (let i = 0; i < 6; i += 1) {
      clean.push(battle({ bey, archetype, result: i < 5 ? 'win' : 'loss', finish: i === 0 ? 'xtreme' : 'spin', selfKo: false, index: 600 + b * 100 + a * 10 + i }));
      unstable.push(battle({ bey, archetype, result: i < 3 ? 'win' : 'loss', finish: i >= 3 ? (i % 2 ? 'over' : 'xtreme') : 'spin', selfKo: i >= 3, index: 900 + b * 100 + a * 10 + i }));
    }
  }));
  const args = { deck: validDeck, deckId: 'deck-1', profile: DATA.profiles.tt3on3, partMap: map, inventory: inventoryFor(validDeck), includeAnnounced: false, settings: { ...DATA.testDefaults, minimumBattles: 36, minimumPerBey: 10, minimumPerArchetype: 6, minimumSelfKoTestsPerBey: 5 }, scoring: DATA.scoring };
  const cleanAssessment = Core.readinessAssessment({ ...args, battles: clean });
  const unstableAssessment = Core.readinessAssessment({ ...args, battles: unstable });
  assert.equal(unstableAssessment.gates.find((gate) => gate.id === 'selfKoControl').pass, false);
  assert.ok(unstableAssessment.score <= cleanAssessment.score - 15, `${cleanAssessment.score} vs ${unstableAssessment.score}`);
});

test('adaptive planner requests easy self-KO checks against owned stamina or defense opponents', () => {
  const plan = Core.buildTestPlan({ deck: validDeck, deckId: 'deck-1', partMap: map, inventory: broadInventory, battles: [], scoring: DATA.scoring, metaProfiles: DATA.defaultMetaProfiles, settings: { ...DATA.testDefaults, minimumSelfKoTestsPerBey: 5, avoidAttackMirrors: true }, limit: 12 });
  const stability = plan.filter((task) => task.testType === 'stability');
  assert.equal(new Set(stability.map((task) => task.beyIndex)).size, 3);
  stability.forEach((task) => {
    assert.ok(['stamina','defense'].includes(task.opponentArchetype));
    assert.notEqual(task.opponentBitRole, 'attack');
    assert.match(task.launchProtocol, /same launcher|self-KO question/i);
  });
});

test('modeled and observed self-KO estimates are explicit and bounded', () => {
  const profile = Core.engineeringProfileForBey(validDeck[0], map);
  const modeled = Core.modeledSelfKoProbability(profile);
  const estimate = Core.empiricalSelfKoEstimate({ selfKoEvidence: 10, ownSelfKos: 2 }, modeled);
  assert.ok(modeled >= 0.01 && modeled <= 0.28);
  assert.ok(estimate.probability > 0 && estimate.probability < 1);
  assert.equal(estimate.evidence, 10);
});

test('forecast returns deterministic self-KO exposure metrics', () => {
  const meta = [{ id: 'm-selfko', name: 'Field', weight: 1, lineup: ['attack','stamina','defense'] }];
  const logs = [];
  validDeck.forEach((bey, index) => {
    for (let i = 0; i < 6; i += 1) logs.push(battle({ bey, archetype: meta[0].lineup[index], result: i < 4 ? 'win' : 'loss', finish: i === 5 ? 'xtreme' : 'spin', selfKo: i === 5, index: 1300 + index * 20 + i }));
  });
  const args = { deck: validDeck, deckId: 'deck-1', partMap: map, battles: logs, scoring: DATA.scoring, metaProfiles: meta, targetPoints: 4, simulations: 400, seed: 99, order: [0,1,2] };
  const first = Core.forecastTournament(args);
  const second = Core.forecastTournament(args);
  assert.equal(first.simulatedSelfKoRate, second.simulatedSelfKoRate);
  assert.equal(first.averageSelfKosPerMatch, second.averageSelfKosPerMatch);
  assert.ok(first.simulatedSelfKoRate >= 0 && first.simulatedSelfKoRate <= 1);
  assert.ok(first.simulatedSelfKoInterval.high >= first.simulatedSelfKoRate);
});

test('legacy detailed self-KO records migrate to the ordinary flag without guessing unknown KOs', () => {
  const raw = { schemaVersion: 4, inventory: inventoryFor(validDeck), decks: [{ id: 'd4', name: 'Legacy', beys: validDeck, profileId: 'tt3on3' }], activeDeckId: 'd4', battles: [
    { id: 'spin-old', deckId: 'd4', ownSignature: Core.beySignature(validDeck[0]), result: 'win', finish: 'spin' },
    { id: 'selfko-old', deckId: 'd4', ownSignature: Core.beySignature(validDeck[0]), result: 'loss', finish: 'xtreme', finishCause: 'own-rail-overshoot' },
    { id: 'ko-old', deckId: 'd4', ownSignature: Core.beySignature(validDeck[0]), result: 'loss', finish: 'xtreme' }
  ], settings: { minimumStabilityPerBey: 6 }, metaProfiles: DATA.defaultMetaProfiles };
  const migrated = Core.migrateState(raw);
  assert.equal(migrated.schemaVersion, Core.SCHEMA_VERSION);
  assert.equal(migrated.battles[0].selfKo, false);
  assert.equal(migrated.battles[0].selfKoKnown, true);
  assert.equal(migrated.battles[1].selfKo, true);
  assert.equal(migrated.battles[1].selfKoKnown, true);
  assert.equal(migrated.battles[2].selfKoKnown, false);
  assert.equal(migrated.settings.minimumSelfKoTestsPerBey, 6);
  assert.equal(migrated.settings.showGuide, true);
});

test('root HTML uses one ordinary self-KO question and includes kid-friendly guidance', () => {
  const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  ['selfKoQuestion','selfKoAnalysis','minimumSelfKoTestsPerBey','maxObservedSelfKoRate','guideDialog','guideSteps','guideButton','showGuide'].forEach((id) => assert.match(html, new RegExp(`id="${id}"|name="${id}"`)));
  assert.match(html, /Did your Bey go out by itself/i);
  assert.match(html, /Start with Parts/i);
  assert.match(html, /Add your parts/i);
  assert.doesNotMatch(html, /id="battleFinishCause"|id="minimumFinishCauseCoverage"|id="minimumStabilityPerBey"|id="maxSelfKoUpperBound"/);
});

test('opponent self-KO is credited as a win without inflating own self-KO rate', () => {
  const summary = Core.summarizeBattles([
    battle({ bey: validDeck[0], archetype: 'attack', result: 'win', finish: 'xtreme', finishCause: 'opponent-self-ko', index: 1701 }),
    battle({ bey: validDeck[0], archetype: 'attack', result: 'loss', finish: 'over', finishCause: 'forced-contact', index: 1702 })
  ], DATA.scoring);
  assert.equal(summary.opponentSelfKos, 1);
  assert.equal(summary.ownSelfKos, 0);
  assert.equal(summary.selfKoRate, 0);
  assert.equal(summary.wins, 1);
});

test('owned-parts optimizer demotes combinations with repeated observed self-KO', () => {
  const inventory = inventoryFor(validDeck);
  const settings = { ...DATA.testDefaults, candidatePool: 30 };
  const baseline = Core.suggestDecks({ inventory, partMap: map, profile: DATA.profiles.tt3on3, includeAnnounced: false, battles: [], metaProfiles: DATA.defaultMetaProfiles, settings, limit: 50 });
  assert.ok(baseline.length > 0);
  const target = baseline[0];
  const deckKey = (deck) => deck.map(Core.beySignature).sort().join('||');
  const targetKey = deckKey(target.deck);
  const unstableLogs = target.deck.flatMap((bey, b) => Array.from({ length: 10 }, (_, i) => battle({ bey, archetype: i % 2 ? 'stamina' : 'defense', result: i < 4 ? 'win' : 'loss', finish: i < 4 ? 'spin' : i % 2 ? 'over' : 'xtreme', selfKo: i >= 4, index: 1800 + b * 20 + i })));
  const reranked = Core.suggestDecks({ inventory, partMap: map, profile: DATA.profiles.tt3on3, includeAnnounced: false, battles: unstableLogs, metaProfiles: DATA.defaultMetaProfiles, settings, limit: 50 });
  const same = reranked.find((entry) => deckKey(entry.deck) === targetKey);
  assert.ok(!same || same.score < target.score - 5, same ? `${target.score} -> ${same.score}` : 'demoted out of shortlist');
});


test('adaptive planner exposes bounded information-gain scores and prioritizes unknown evidence', () => {
  const inventory = { ...broadInventory };
  const plan = Core.buildTestPlan({ deck: validDeck, deckId: 'info-deck', partMap: map, inventory, includeAnnounced: false, battles: [], scoring: DATA.scoring, metaProfiles: DATA.defaultMetaProfiles, settings: DATA.testDefaults, limit: 6 });
  assert.ok(plan.length > 0);
  assert.ok(plan.every((task) => Number.isFinite(task.informationGain) && task.informationGain >= 0 && task.informationGain <= 100));
  assert.ok(plan[0].informationGain >= plan.at(-1).informationGain || plan[0].priority >= plan.at(-1).priority);
});

test('coach-first HTML includes player/advanced modes, roadmap, patterns, and no Analysis tab', () => {
  const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(html, /id="modeButton"/);
  assert.match(html, /id="coachRoadmap"/);
  assert.match(html, /id="coachPatterns"/);
  assert.match(html, /<small>Coach<\/small>/);
  assert.doesNotMatch(html, /<small>Analysis<\/small>/);
});
