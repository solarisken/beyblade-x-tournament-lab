import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const data = require('./data.js');
const core = require('./core.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}

const standard = (blade, ratchet, bit) => core.normalizeBey({ architecture:'standard', blade, ratchet, bit });

function makeState() {
  const b1 = standard('blade-dran-sword','ratchet-3-60','bit-flat');
  const b2 = standard('blade-wizard-rod','ratchet-5-70','bit-disk-ball');
  const b3 = standard('blade-knight-mail','ratchet-7-60','bit-hex');
  const looseParts = {};
  [
    ...core.getBeyPartIds(b1), ...core.getBeyPartIds(b2), ...core.getBeyPartIds(b3),
    'blade-shark-edge','ratchet-1-60','bit-low-flat',
    'blade-silver-wolf','ratchet-9-60','bit-free-ball',
    'blade-black-shell','ratchet-4-80','bit-needle',
    'blade-unicorn-sting','ratchet-3-70','bit-point',
    'blade-cobalt-dragoon','ratchet-9-70','bit-rush'
  ].forEach(id => { looseParts[id] = (looseParts[id] || 0) + 1; });
  const deckId = 'deck-test';
  return {
    ownedProducts:{}, looseParts,
    decks:[{ id:deckId, name:'Test', beys:[b1,b2,b3] }], activeDeckId:deckId,
    battles:[], settings:{ profileId:'tt-v12', targetPerCell:4 }
  };
}

test('catalog part IDs are unique', () => {
  assert.equal(new Set(data.parts.map(p => p.id)).size, data.parts.length);
});

test('catalog product IDs are unique', () => {
  assert.equal(new Set(data.products.map(p => p.id)).size, data.products.length);
});

test('standard and integrated Bey completeness works', () => {
  assert.equal(core.isCompleteBey(standard('blade-dran-sword','ratchet-3-60','bit-flat')), true);
  assert.equal(core.isCompleteBey(core.normalizeBey({ architecture:'integrated', integratedBlade:'rib-glory-valkyrie', bit:'bit-low-flat' })), true);
  assert.equal(core.isCompleteBey(core.normalizeBey({ architecture:'integrated', integratedBlade:'rib-glory-valkyrie' })), false);
});

test('owned product quantities contribute exact mapped parts', () => {
  const counts = core.getInventoryCounts({ ownedProducts:{'BX-01':2}, looseParts:{'bit-ball':1} });
  assert.equal(counts['blade-dran-sword'], 2);
  assert.equal(counts['ratchet-3-60'], 2);
  assert.equal(counts['bit-flat'], 2);
  assert.equal(counts['bit-ball'], 1);
});

test('legal deck passes simultaneous owned capacity', () => {
  const state = makeState();
  const result = core.validateDeck(state.decks[0], core.getInventoryCounts(state), 'tt-v12');
  assert.equal(result.legal, true, result.errors.join('; '));
});

test('duplicate functional part is rejected', () => {
  const state = makeState();
  state.decks[0].beys[1].ratchet = 'ratchet-3-60';
  state.looseParts['ratchet-3-60'] = 2;
  const result = core.validateDeck(state.decks[0], core.getInventoryCounts(state), 'tt-v12');
  assert.equal(result.legal, false);
  assert.ok(result.errors.some(e => e.includes('3-60 repeats')));
});

test('ordinary self-KO accepts only Over/Xtreme losses', () => {
  assert.equal(core.validateBattleInput({ ownSignature:'a',opponentSignature:'b',winner:'opponent',finish:'over',selfKo:true }).valid, true);
  assert.equal(core.validateBattleInput({ ownSignature:'a',opponentSignature:'b',winner:'own',finish:'over',selfKo:true }).valid, false);
  assert.equal(core.validateBattleInput({ ownSignature:'a',opponentSignature:'b',winner:'opponent',finish:'spin',selfKo:true }).valid, false);
});

test('Wilson lower bound is uncertainty-aware', () => {
  const lower = core.wilsonLower(5,10);
  assert.ok(lower > 0.23 && lower < 0.25, String(lower));
  assert.equal(core.wilsonLower(0,0), 0);
});

test('generated missions use complete simultaneous owned opponents', () => {
  const state = makeState();
  const inventory = core.getInventoryCounts(state);
  const missions = core.generateTestMissions(state, 8);
  assert.ok(missions.length >= 2);
  missions.forEach(m => {
    assert.equal(core.isCompleteBey(m.own), true);
    assert.equal(core.isCompleteBey(m.opponent), true);
    assert.equal(core.canBuildTogether([m.own,m.opponent], inventory), true);
  });
});

function makeAttackMirrorOnlyState(settings = { targetPerCell:4 }) {
  const own = standard('blade-dran-sword','ratchet-3-60','bit-flat');
  const opponent = standard('blade-shark-edge','ratchet-1-60','bit-low-flat');
  const looseParts = {};
  [...core.getBeyPartIds(own), ...core.getBeyPartIds(opponent)].forEach(id => { looseParts[id] = (looseParts[id] || 0) + 1; });
  return {
    ownedProducts:{}, looseParts,
    decks:[{ id:'attack-mirror-deck', name:'Attack mirror', beys:[own] }], activeDeckId:'attack-mirror-deck',
    battles:[], settings
  };
}

test('attack-movement bit mirror missions remain eligible', () => {
  const missions = core.generateTestMissions(makeAttackMirrorOnlyState(), 8);
  assert.ok(missions.length > 0);
  assert.ok(missions.some(m => core.usesAttackMovementBit(m.own) && core.usesAttackMovementBit(m.opponent)));
});

test('legacy attack-mirror exclusion flag no longer suppresses legal missions', () => {
  const missions = core.generateTestMissions(makeAttackMirrorOnlyState({ targetPerCell:4, avoidAttackMirrors:true }), 8);
  assert.ok(missions.length > 0);
  assert.ok(missions.every(m => core.usesAttackMovementBit(m.own) && core.usesAttackMovementBit(m.opponent)));
});

test('just-completed pairing is not the next mission when alternatives exist', () => {
  const state = makeState();
  const first = core.generateTestMissions(state, 8)[0];
  assert.ok(first);
  state.battles.push({
    id:'battle-1', createdAt:new Date().toISOString(), excluded:false, winner:'own', finish:'spin', selfKo:false,
    ownSignature:first.ownSignature, opponentSignature:first.opponentSignature, pairingKey:first.pairingKey,
    opponentRole:first.opponentRole, opponentParts:core.getBeyPartIds(first.opponent)
  });
  const next = core.generateTestMissions(state, 8);
  assert.ok(next.length > 1);
  assert.notEqual(next[0].pairingKey, first.pairingKey);
});

test('optimizer returns only legal and owned-capacity decks', () => {
  const state = makeState();
  const inventory = core.getInventoryCounts(state);
  const results = core.optimizeDecks(state, 3);
  assert.ok(results.length > 0);
  results.forEach(result => assert.equal(core.validateDeck(result.deck, inventory, 'tt-v12').legal, true));
});

test('readiness cannot become strong without evidence', () => {
  const state = makeState();
  const analysis = core.analyzeState(state);
  assert.ok(analysis.score < 60);
  assert.ok(analysis.blockers.some(item => item.includes('Record')));
});

console.log(`\n${passed} tests passed.`);
