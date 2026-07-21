(function (root) {
  'use strict';

  const data = root.XCC_DATA || (typeof require === 'function' ? require('./data.js') : null);
  if (!data) throw new Error('XCC_DATA is required.');

  const partMap = new Map(data.parts.map(part => [part.id, part]));
  const productMap = new Map(data.products.map(product => [product.id, product]));
  const profileMap = new Map(data.profiles.map(profile => [profile.id, profile]));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function emptyBey(index = 0) {
    return {
      id: uid(`bey${index + 1}`),
      architecture: 'standard',
      blade: '',
      integratedBlade: '',
      lockChip: '',
      mainBlade: '',
      metalBlade: '',
      overBlade: '',
      assistBlade: '',
      ratchet: '',
      bit: ''
    };
  }

  function normalizeBey(input = {}, index = 0) {
    return { ...emptyBey(index), ...input, id: input.id || uid(`bey${index + 1}`) };
  }

  function getBeyPartIds(bey) {
    if (!bey) return [];
    const byArchitecture = {
      standard: [bey.blade, bey.ratchet, bey.bit],
      integrated: [bey.integratedBlade, bey.bit],
      custom: [bey.lockChip, bey.mainBlade, bey.assistBlade, bey.ratchet, bey.bit],
      expanded: [bey.lockChip, bey.metalBlade, bey.overBlade, bey.assistBlade, bey.ratchet, bey.bit]
    };
    return (byArchitecture[bey.architecture] || byArchitecture.standard).filter(Boolean);
  }

  function isCompleteBey(bey) {
    const required = {
      standard: ['blade', 'ratchet', 'bit'],
      integrated: ['integratedBlade', 'bit'],
      custom: ['lockChip', 'mainBlade', 'assistBlade', 'ratchet', 'bit'],
      expanded: ['lockChip', 'metalBlade', 'overBlade', 'assistBlade', 'ratchet', 'bit']
    }[bey?.architecture || 'standard'];
    return required.every(key => Boolean(bey?.[key]));
  }

  function partName(id) {
    return partMap.get(id)?.name || '—';
  }

  function bitCode(id) {
    const part = partMap.get(id);
    return part?.code || part?.name || '—';
  }

  function beyName(bey) {
    if (!bey || !isCompleteBey(bey)) return 'Incomplete Bey';
    if (bey.architecture === 'integrated') return `${partName(bey.integratedBlade)} ${bitCode(bey.bit)}`;
    if (bey.architecture === 'custom') {
      return `${partName(bey.lockChip)}${partName(bey.mainBlade)} ${partMap.get(bey.assistBlade)?.code || partName(bey.assistBlade)}${partName(bey.ratchet)}${bitCode(bey.bit)}`;
    }
    if (bey.architecture === 'expanded') {
      return `${partName(bey.lockChip)}${partName(bey.metalBlade)} ${partMap.get(bey.overBlade)?.code || ''}${partMap.get(bey.assistBlade)?.code || ''}${partName(bey.ratchet)}${bitCode(bey.bit)}`;
    }
    return `${partName(bey.blade)} ${partName(bey.ratchet)}${bitCode(bey.bit)}`;
  }

  function beySignature(bey) {
    return `${bey?.architecture || 'standard'}:${getBeyPartIds(bey).join('|')}`;
  }

  function getInventoryCounts(state) {
    const counts = {};
    Object.entries(state?.looseParts || {}).forEach(([partId, qty]) => {
      counts[partId] = (counts[partId] || 0) + Math.max(0, Number(qty) || 0);
    });
    Object.entries(state?.ownedProducts || {}).forEach(([productId, qty]) => {
      const product = productMap.get(productId);
      if (!product || !Array.isArray(product.parts)) return;
      product.parts.forEach(partId => {
        counts[partId] = (counts[partId] || 0) + Math.max(0, Number(qty) || 0);
      });
    });
    return counts;
  }

  function countParts(partIds) {
    return partIds.reduce((acc, partId) => {
      acc[partId] = (acc[partId] || 0) + 1;
      return acc;
    }, {});
  }

  function canSupplyPartIds(partIds, inventory) {
    const needed = countParts(partIds);
    return Object.entries(needed).every(([partId, qty]) => (inventory[partId] || 0) >= qty);
  }

  function canBuildBey(bey, inventory) {
    return isCompleteBey(bey) && canSupplyPartIds(getBeyPartIds(bey), inventory);
  }

  function canBuildTogether(beys, inventory) {
    const all = beys.flatMap(getBeyPartIds);
    return beys.every(isCompleteBey) && canSupplyPartIds(all, inventory);
  }

  function isBasicLock(partId) {
    return partMap.get(partId)?.category === 'lockChip' && !['lock-valkyrie'].includes(partId);
  }

  function validateDeck(deck, inventory, profileId = 'tt-v12') {
    const profile = profileMap.get(profileId) || profileMap.get('tt-v12');
    const beys = (deck?.beys || []).map(normalizeBey);
    const errors = [];
    if (beys.length !== profile.deckSize) errors.push(`Deck must contain ${profile.deckSize} Beys.`);
    beys.forEach((bey, index) => {
      if (!isCompleteBey(bey)) errors.push(`Bey ${index + 1} is incomplete.`);
    });
    if (beys.every(isCompleteBey) && !canBuildTogether(beys, inventory)) errors.push('Owned quantities cannot build all three Beys at the same time.');
    if (profile.noDuplicateParts) {
      const seen = new Map();
      beys.forEach((bey, beyIndex) => {
        getBeyPartIds(bey).forEach(partId => {
          if (profile.basicLockRepeats && isBasicLock(partId)) return;
          if (seen.has(partId)) errors.push(`${partName(partId)} repeats in Bey ${seen.get(partId) + 1} and Bey ${beyIndex + 1}.`);
          else seen.set(partId, beyIndex);
        });
      });
    }
    return { legal: errors.length === 0, errors };
  }

  function aggregateStats(bey) {
    const totals = { impact: 0, stamina: 0, defense: 0, control: 0, recoil: 0, selfKo: 0, burst: 0 };
    getBeyPartIds(bey).forEach(partId => {
      const stats = partMap.get(partId)?.stats || {};
      Object.keys(totals).forEach(key => { totals[key] += Number(stats[key]) || 0; });
    });
    return totals;
  }

  function roleOfBey(bey) {
    const parts = getBeyPartIds(bey).map(id => partMap.get(id)).filter(Boolean);
    const bit = parts.find(part => part.category === 'bit');
    const top = parts.find(part => ['blade','ratchetIntegratedBlade','mainBlade','metalBlade'].includes(part.category));
    if (top?.spin === 'left') return 'left-spin';
    const roles = [top?.role, bit?.role].filter(Boolean);
    if (roles.length === 2 && roles[0] === roles[1]) return roles[0];
    if (bit?.role === 'attack' && aggregateStats(bey).impact >= 12) return 'attack';
    if (bit?.role === 'stamina') return 'stamina';
    if (bit?.role === 'defense') return 'defense';
    return top?.role || bit?.role || 'balance';
  }

  function usesAttackMovementBit(bey) {
    const bit = partMap.get(bey?.bit);
    return Boolean(bit?.attackMovement);
  }

  function engineeringScore(bey, battles = []) {
    const s = aggregateStats(bey);
    const consistency = (s.stamina * 1.1) + (s.defense * 0.9) + (s.control * 1.0) + (s.burst * 0.5);
    const pressure = (s.impact * 1.1) - (s.recoil * 0.45) - (s.selfKo * 0.55);
    const role = roleOfBey(bey);
    let roleFit = 0;
    if (role === 'attack') roleFit = s.impact * 0.35 + s.control * 0.15;
    if (role === 'stamina') roleFit = s.stamina * 0.4 + s.control * 0.2;
    if (role === 'defense') roleFit = s.defense * 0.4 + s.burst * 0.2;
    if (role === 'balance' || role === 'left-spin') roleFit = (s.impact + s.stamina + s.defense + s.control) * 0.12;

    const signature = beySignature(bey);
    const relevant = battles.filter(b => !b.excluded && b.ownSignature === signature);
    const wins = relevant.filter(b => b.winner === 'own').length;
    const empirical = relevant.length ? ((wins / relevant.length) - 0.5) * 12 * Math.min(1, relevant.length / 10) : 0;
    return Number((consistency + pressure + roleFit + empirical).toFixed(2));
  }

  function generateCandidates(inventory, options = {}) {
    const byCategory = {};
    data.parts.forEach(part => {
      if ((inventory[part.id] || 0) > 0 && part.status !== 'announced') {
        (byCategory[part.category] ||= []).push(part.id);
      }
    });
    const candidates = [];
    const push = bey => {
      if (!canBuildBey(bey, inventory)) return;
      const signature = beySignature(bey);
      if (candidates.some(item => item.signature === signature)) return;
      candidates.push({ bey, signature, score: engineeringScore(bey, options.battles || []), role: roleOfBey(bey) });
    };

    const max = options.maxCandidates || 2500;
    outerStandard:
    for (const blade of (byCategory.blade || [])) {
      for (const ratchet of (byCategory.ratchet || [])) {
        for (const bit of (byCategory.bit || [])) {
          push(normalizeBey({ architecture: 'standard', blade, ratchet, bit }));
          if (candidates.length >= max) break outerStandard;
        }
      }
    }

    for (const integratedBlade of (byCategory.ratchetIntegratedBlade || [])) {
      for (const bit of (byCategory.bit || [])) push(normalizeBey({ architecture: 'integrated', integratedBlade, bit }));
    }

    const customLimit = Math.max(0, max - candidates.length);
    let customCount = 0;
    customLoop:
    for (const lockChip of (byCategory.lockChip || [])) {
      for (const mainBlade of (byCategory.mainBlade || [])) {
        for (const assistBlade of (byCategory.assistBlade || [])) {
          for (const ratchet of (byCategory.ratchet || [])) {
            for (const bit of (byCategory.bit || [])) {
              push(normalizeBey({ architecture: 'custom', lockChip, mainBlade, assistBlade, ratchet, bit }));
              customCount += 1;
              if (customCount >= customLimit) break customLoop;
            }
          }
        }
      }
    }

    const expandedLimit = Math.max(0, Math.floor((max - candidates.length) / 2));
    let expandedCount = 0;
    expandedLoop:
    for (const lockChip of (byCategory.lockChip || [])) {
      for (const metalBlade of (byCategory.metalBlade || [])) {
        for (const overBlade of (byCategory.overBlade || [])) {
          for (const assistBlade of (byCategory.assistBlade || [])) {
            for (const ratchet of (byCategory.ratchet || [])) {
              for (const bit of (byCategory.bit || [])) {
                push(normalizeBey({ architecture: 'expanded', lockChip, metalBlade, overBlade, assistBlade, ratchet, bit }));
                expandedCount += 1;
                if (expandedCount >= expandedLimit) break expandedLoop;
              }
            }
          }
        }
      }
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  function optimizeDecks(state, limit = 6) {
    const inventory = getInventoryCounts(state);
    const candidates = generateCandidates(inventory, { battles: state.battles || [], maxCandidates: 2200 }).slice(0, 70);
    const profileId = state.settings?.profileId || 'tt-v12';
    const results = [];
    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        for (let k = j + 1; k < candidates.length; k += 1) {
          const trio = [candidates[i], candidates[j], candidates[k]];
          const deck = { id: uid('suggested'), name: 'Suggested deck', beys: trio.map(item => item.bey) };
          const validation = validateDeck(deck, inventory, profileId);
          if (!validation.legal) continue;
          const roles = new Set(trio.map(item => item.role));
          const diversity = roles.size * 6;
          const attackRoutes = trio.filter(item => aggregateStats(item.bey).impact >= 14).length;
          const staminaRoutes = trio.filter(item => aggregateStats(item.bey).stamina >= 14).length;
          const resilienceRoutes = trio.filter(item => aggregateStats(item.bey).defense >= 14).length;
          const routeCoverage = [attackRoutes, staminaRoutes, resilienceRoutes].filter(Boolean).length * 4;
          const sharedRisk = trio.reduce((sum, item) => sum + aggregateStats(item.bey).selfKo, 0) * 0.08;
          const score = trio.reduce((sum, item) => sum + item.score, 0) + diversity + routeCoverage - sharedRisk;
          results.push({ deck, score: Number(score.toFixed(2)), roles: trio.map(item => item.role), validation });
        }
      }
    }
    const seen = new Set();
    return results.sort((a, b) => b.score - a.score).filter(result => {
      const key = [...result.deck.beys.map(beySignature)].sort().join('~');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  }

  function wilsonLower(wins, total, z = 1.96) {
    if (!total) return 0;
    const phat = wins / total;
    const denominator = 1 + (z * z / total);
    const center = phat + (z * z / (2 * total));
    const margin = z * Math.sqrt((phat * (1 - phat) / total) + (z * z / (4 * total * total)));
    return (center - margin) / denominator;
  }

  function analyzeState(state) {
    const deck = state.decks?.find(item => item.id === state.activeDeckId) || state.decks?.[0];
    const inventory = getInventoryCounts(state);
    const validation = validateDeck(deck || { beys: [] }, inventory, state.settings?.profileId || 'tt-v12');
    const decided = (state.battles || []).filter(b => !b.excluded && ['own','opponent'].includes(b.winner));
    const wins = decided.filter(b => b.winner === 'own').length;
    const winRate = decided.length ? wins / decided.length : 0;
    const lower = wilsonLower(wins, decided.length);
    const deckSignatures = (deck?.beys || []).map(beySignature);
    const perBey = deckSignatures.map(signature => decided.filter(b => b.ownSignature === signature).length);
    const archetypes = new Set(decided.map(b => b.opponentRole).filter(Boolean));
    const cells = new Set(decided.map(b => `${b.ownSignature}::${b.opponentRole}`));
    const targetCells = Math.max(1, deckSignatures.length * 4);
    const coverage = clamp(cells.size / targetCells, 0, 1);
    const selfKoLosses = decided.filter(b => b.winner === 'opponent' && b.selfKo).length;
    const koEligibleLosses = decided.filter(b => b.winner === 'opponent' && ['over','xtreme'].includes(b.finish)).length;
    const selfKoRate = koEligibleLosses ? selfKoLosses / koEligibleLosses : 0;

    let score = 0;
    score += validation.legal ? 20 : 0;
    score += Math.min(20, decided.length / 36 * 20);
    score += Math.min(20, lower / 0.55 * 20);
    score += coverage * 20;
    score += Math.min(10, (Math.min(...(perBey.length ? perBey : [0])) / 10) * 10);
    score += Math.max(0, 10 - selfKoRate * 30);
    score = Math.round(clamp(score, 0, 100));

    const blockers = [];
    if (!validation.legal) blockers.push(...validation.errors.slice(0, 3));
    if (decided.length < 36) blockers.push(`Record ${36 - decided.length} more decided battles for the full evidence gate.`);
    if (deckSignatures.length && Math.min(...perBey) < 10) blockers.push('Each deck Bey needs at least 10 decided tests.');
    if (archetypes.size < 4) blockers.push('Test against at least four opponent roles.');
    if (coverage < 0.75) blockers.push('Fill missing Bey × opponent-role evidence cells.');
    if (selfKoRate > 0.15) blockers.push('Observed self-KO exposure is above the 15% control target.');
    if (lower < 0.50) blockers.push('The 95% lower confidence bound is below 50%.');

    let label = 'Not assessable';
    if (validation.legal && decided.length >= 12) label = score >= 80 ? 'Tournament evidence is strong' : score >= 60 ? 'Promising, but not proven' : 'More controlled testing required';
    return { score, label, validation, decided, wins, winRate, lower, perBey, coverage, selfKoRate, blockers };
  }

  function pairingKey(own, opponent) {
    return `${beySignature(own)}>>${beySignature(opponent)}`;
  }

  function generateTestMissions(state, count = 6) {
    const deck = state.decks?.find(item => item.id === state.activeDeckId) || state.decks?.[0];
    if (!deck) return [];
    const inventory = getInventoryCounts(state);
    const ownBeys = (deck.beys || []).filter(bey => canBuildBey(bey, inventory));
    if (!ownBeys.length) return [];
    const allBattles = state.battles || [];
    const candidates = generateCandidates(inventory, { battles: allBattles, maxCandidates: 1800 }).slice(0, 140);
    const decidedBattles = allBattles.filter(b => !b.excluded);
    const recent = decidedBattles.slice(-10).reverse();
    const lastKey = recent[0]?.pairingKey || '';
    const recentPartSet = new Set(recent.slice(0, 5).flatMap(b => b.opponentParts || []));
    const targetPerCell = Number(state.settings?.targetPerCell || 4);
    const cellCounts = new Map();
    const pairingCounts = new Map();
    const koFinishCounts = new Map();
    decidedBattles.forEach(battle => {
      const cellKey = `${battle.ownSignature}::${battle.opponentRole}`;
      cellCounts.set(cellKey, (cellCounts.get(cellKey) || 0) + 1);
      pairingCounts.set(battle.pairingKey, (pairingCounts.get(battle.pairingKey) || 0) + 1);
      if (['over','xtreme'].includes(battle.finish)) koFinishCounts.set(battle.ownSignature, (koFinishCounts.get(battle.ownSignature) || 0) + 1);
    });
    const missions = [];

    ownBeys.forEach(own => {
      const ownSig = beySignature(own);
      const ownUsesAttackMovement = usesAttackMovementBit(own);
      candidates.forEach(candidate => {
        const opponent = candidate.bey;
        if (ownSig === candidate.signature) return;
        if (!canBuildTogether([own, opponent], inventory)) return;
        const key = pairingKey(own, opponent);
        const role = candidate.role;
        const cellCount = cellCounts.get(`${ownSig}::${role}`) || 0;
        const exactCount = pairingCounts.get(key) || 0;
        const recentIndex = recent.findIndex(b => b.pairingKey === key);
        const recentOpponentIndex = recent.findIndex(b => b.opponentSignature === candidate.signature);
        const sharedRecentParts = getBeyPartIds(opponent).filter(id => recentPartSet.has(id)).length;
        const selfKoNeed = Math.max(0, 8 - (koFinishCounts.get(ownSig) || 0));
        let priority = Math.max(0, targetPerCell - cellCount) * 16;
        priority += Math.max(0, 3 - exactCount) * 7;
        priority += selfKoNeed * (ownUsesAttackMovement ? 1.5 : 0.4);
        priority += candidate.score * 0.08;
        if (recentIndex >= 0) priority -= (12 - recentIndex) * 9;
        if (recentOpponentIndex >= 0) priority -= (8 - recentOpponentIndex) * 5;
        priority -= sharedRecentParts * 3;
        if (key === lastKey) priority -= 1000;
        missions.push({
          id: uid('mission'), own, opponent, ownName: beyName(own), opponentName: beyName(opponent),
          ownSignature: ownSig, opponentSignature: candidate.signature, pairingKey: key,
          opponentRole: role, priority, cellCount, exactCount,
          reason: cellCount < targetPerCell ? `Needs ${targetPerCell - cellCount} more ${role} evidence battle${targetPerCell - cellCount === 1 ? '' : 's'}.` : exactCount < 3 ? 'Needs repeat evidence against this exact owned opponent.' : 'Useful rotation test with low recent overlap.'
        });
      });
    });

    missions.sort((a, b) => b.priority - a.priority);
    const unique = [];
    const usedPairs = new Set();
    const usedOpponentSigs = new Set();
    for (const mission of missions) {
      if (usedPairs.has(mission.pairingKey)) continue;
      if (usedOpponentSigs.has(mission.opponentSignature) && unique.length < Math.ceil(count / 2)) continue;
      usedPairs.add(mission.pairingKey);
      usedOpponentSigs.add(mission.opponentSignature);
      unique.push(mission);
      if (unique.length >= count) break;
    }

    if (unique.length > 1 && unique[0].pairingKey === lastKey) {
      const alternative = unique.findIndex(item => item.pairingKey !== lastKey);
      if (alternative > 0) [unique[0], unique[alternative]] = [unique[alternative], unique[0]];
    }
    return unique;
  }

  function validateBattleInput(input) {
    const errors = [];
    if (!input?.ownSignature || !input?.opponentSignature) errors.push('Choose a valid test mission.');
    if (!['own','opponent'].includes(input?.winner)) errors.push('Choose the winner.');
    if (!['spin','over','burst','xtreme'].includes(input?.finish)) errors.push('Choose the finish.');
    if (input?.selfKo && !(input.winner === 'opponent' && ['over','xtreme'].includes(input.finish))) {
      errors.push('Self-KO = Yes is valid only when your Bey loses by Over or Xtreme finish.');
    }
    return { valid: errors.length === 0, errors };
  }

  const api = {
    data, partMap, productMap, profileMap, uid, emptyBey, normalizeBey, getBeyPartIds, isCompleteBey,
    partName, beyName, beySignature, getInventoryCounts, canSupplyPartIds, canBuildBey, canBuildTogether,
    validateDeck, aggregateStats, roleOfBey, usesAttackMovementBit, engineeringScore, generateCandidates,
    optimizeDecks, wilsonLower, analyzeState, pairingKey, generateTestMissions, validateBattleInput
  };

  root.XCC_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
