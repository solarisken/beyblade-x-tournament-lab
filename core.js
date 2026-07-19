(function (root) {
  'use strict';

  const SCHEMA_VERSION = 3;
  const PART_SLOTS = ['blade','ratchetIntegratedBlade','lockChip','metalBlade','overBlade','mainBlade','assistBlade','ratchet','bit','integratedBit'];
  const CORE_ARCHETYPES = ['attack','stamina','defense','balance','left-spin'];

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const round = (value, digits = 1) => Number(Number(value || 0).toFixed(digits));
  const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);
  const mean = (values) => values.length ? sum(values) / values.length : 0;
  const unique = (values) => [...new Set(values.filter(Boolean))];

  function scoreForFinish(finish, scoring) {
    return Number((scoring || {})[finish] || 0);
  }

  function wilsonInterval(wins, total, z = 1.96) {
    wins = Math.max(0, Number(wins) || 0);
    total = Math.max(0, Number(total) || 0);
    if (!total) return { low: 0, high: 1, center: 0.5 };
    const p = wins / total;
    const z2 = z * z;
    const denominator = 1 + z2 / total;
    const center = (p + z2 / (2 * total)) / denominator;
    const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / denominator;
    return { low: clamp(center - margin, 0, 1), high: clamp(center + margin, 0, 1), center };
  }

  function partIdsFromBey(bey) {
    if (!bey) return [];
    const ids = [];
    PART_SLOTS.forEach((slot) => {
      const value = bey[slot];
      if (Array.isArray(value)) value.filter(Boolean).forEach((id) => ids.push(id));
      else if (value) ids.push(value);
    });
    return ids;
  }

  function beyIsComplete(bey) {
    if (!bey) return false;
    if (bey.system === 'integrated') return Boolean(bey.ratchetIntegratedBlade && bey.bit);
    if (bey.system === 'custom') {
      const topComplete = Boolean(bey.lockChip && bey.assistBlade && (bey.mainBlade || (bey.metalBlade && bey.overBlade)));
      const driveComplete = Boolean(bey.integratedBit || (bey.ratchet && bey.bit));
      return topComplete && driveComplete;
    }
    return Boolean(bey.blade && bey.ratchet && bey.bit);
  }

  function beySignature(bey) {
    if (!bey) return '';
    return `${bey.system || 'basic'}:${PART_SLOTS.map((slot) => Array.isArray(bey[slot]) ? bey[slot].join('+') : (bey[slot] || '')).join('|')}`;
  }

  function nameForBey(bey, partMap) {
    if (!bey) return 'Incomplete Bey';
    const name = (id) => partMap[id]?.name || id || '';
    if (bey.system === 'integrated') return [name(bey.ratchetIntegratedBlade), name(bey.bit)].filter(Boolean).join(' ');
    if (bey.system === 'custom') {
      const top = bey.mainBlade
        ? [name(bey.lockChip), name(bey.mainBlade), name(bey.assistBlade)]
        : [name(bey.lockChip), name(bey.metalBlade), name(bey.overBlade), name(bey.assistBlade)];
      const drive = bey.integratedBit ? [name(bey.integratedBit)] : [name(bey.ratchet), name(bey.bit)];
      return [...top, ...drive].filter(Boolean).join(' ');
    }
    return [name(bey.blade), name(bey.ratchet), name(bey.bit)].filter(Boolean).join(' ');
  }

  function inventoryQuantity(inventory, id) {
    const record = inventory?.[id];
    if (record && typeof record === 'object') return Math.max(0, Math.floor(Number(record.qty) || 0));
    return Math.max(0, Math.floor(Number(record) || 0));
  }

  function inventoryCapacityCheck(deck, inventory, partMap) {
    const used = {};
    (deck || []).forEach((bey) => partIdsFromBey(bey).forEach((id) => { used[id] = (used[id] || 0) + 1; }));
    const shortages = Object.entries(used)
      .filter(([id, count]) => inventoryQuantity(inventory, id) < count)
      .map(([id, count]) => ({ id, name: partMap[id]?.name || id, required: count, owned: inventoryQuantity(inventory, id) }));
    return { valid: shortages.length === 0, shortages, used };
  }

  function legalityCheck(deck, profile, partMap, options = {}) {
    const issues = [];
    const warnings = [];
    const includeAnnounced = Boolean(options.includeAnnounced);
    const expected = Number(profile?.deckSize || 3);
    const normalized = Array.isArray(deck) ? deck.slice(0, expected) : [];

    if (normalized.length !== expected) issues.push(`Deck must contain exactly ${expected} Beyblades.`);
    normalized.forEach((bey, index) => {
      if (!beyIsComplete(bey)) issues.push(`Bey ${index + 1} is incomplete.`);
      partIdsFromBey(bey).forEach((id) => {
        const part = partMap[id];
        if (!part) return issues.push(`Bey ${index + 1} uses an unknown part (${id}).`);
        if (part.status === 'announced' && !includeAnnounced) issues.push(`${part.name} is announced but not released in the verified catalog.`);
        if (part.status === 'custom') warnings.push(`${part.name} is custom data and requires organizer verification.`);
        if ((profile?.bannedParts || []).includes(id)) issues.push(`${part.name} is banned by the selected profile.`);
      });
    });

    if (profile?.noDuplicateParts) {
      const occurrences = new Map();
      normalized.forEach((bey, beyIndex) => partIdsFromBey(bey).forEach((id) => {
        if (!occurrences.has(id)) occurrences.set(id, []);
        occurrences.get(id).push(beyIndex + 1);
      }));
      occurrences.forEach((positions, id) => {
        if (positions.length < 2) return;
        const part = partMap[id];
        const isLock = part?.category === 'lockChip';
        const ttOrdinaryLockException = profile.lockChipPolicy === 'tt-v12' && isLock && !['lock-valkyrie','lock-emperor'].includes(id);
        if (!ttOrdinaryLockException) issues.push(`${part?.name || id} is repeated in Beys ${positions.join(', ')}.`);
      });
    }

    return { legal: issues.length === 0, issues, warnings };
  }

  function inferBeyRole(bey, partMap) {
    const weights = { attack: 0, stamina: 0, defense: 0, balance: 0 };
    const slotWeights = {
      blade: 2.4, ratchetIntegratedBlade: 2.6, mainBlade: 2.1, metalBlade: 1.5, overBlade: 0.9,
      assistBlade: 0.7, bit: 1.8, integratedBit: 1.9, ratchet: 0.35, lockChip: 0
    };
    PART_SLOTS.forEach((slot) => {
      const id = bey?.[slot];
      if (!id || Array.isArray(id)) return;
      const role = partMap[id]?.role;
      if (weights[role] !== undefined) weights[role] += slotWeights[slot] || 0.5;
    });
    const ordered = Object.entries(weights).sort((a, b) => b[1] - a[1]);
    if (!ordered[0] || ordered[0][1] === 0) return 'balance';
    if (ordered[1] && Math.abs(ordered[0][1] - ordered[1][1]) < 0.8) return 'balance';
    return ordered[0][0];
  }

  function roleDiversity(deck, partMap) {
    const roles = (deck || []).filter(beyIsComplete).map((bey) => inferBeyRole(bey, partMap));
    return { roles, unique: unique(roles).length, complete: roles.length === (deck || []).length };
  }

  function relevantBattlesForDeck(battles, deck, deckId) {
    const signatures = new Set((deck || []).map(beySignature).filter(Boolean));
    return (battles || []).filter((battle) => {
      if (deckId && battle.deckId && battle.deckId !== deckId) return false;
      const signature = battle.ownSignature || '';
      return signatures.has(signature);
    });
  }

  function normalizeBattle(battle, scoring = {}) {
    const result = battle?.result || (battle?.won === true ? 'win' : battle?.won === false ? 'loss' : 'draw');
    const finish = battle?.finish || 'spin';
    const contaminated = Boolean(battle?.contaminated || battle?.launchError);
    const decided = !contaminated && ['win','loss'].includes(result) && !['draw','relaunch'].includes(finish);
    const points = scoreForFinish(finish, scoring);
    return { ...battle, result, finish, contaminated, decided, points };
  }

  function summarizeBattles(battles, scoring = {}) {
    const normalized = (battles || []).map((battle) => normalizeBattle(battle, scoring));
    const effective = normalized.filter((battle) => battle.decided);
    const wins = effective.filter((battle) => battle.result === 'win').length;
    const losses = effective.filter((battle) => battle.result === 'loss').length;
    const interval = wilsonInterval(wins, effective.length);
    const pointsFor = sum(effective.filter((battle) => battle.result === 'win').map((battle) => battle.points));
    const pointsAgainst = sum(effective.filter((battle) => battle.result === 'loss').map((battle) => battle.points));
    const contaminated = normalized.filter((battle) => battle.contaminated).length;
    const finishCounts = {};
    effective.forEach((battle) => {
      const key = `${battle.result}:${battle.finish}`;
      finishCounts[key] = (finishCounts[key] || 0) + 1;
    });
    return {
      total: normalized.length,
      effective: effective.length,
      wins,
      losses,
      winRate: effective.length ? wins / effective.length : 0,
      interval,
      pointsFor,
      pointsAgainst,
      pointDifferential: pointsFor - pointsAgainst,
      contaminated,
      contaminationRate: normalized.length ? contaminated / normalized.length : 0,
      finishCounts
    };
  }

  function groupBattleSummary(battles, keyFn, scoring) {
    const groups = {};
    (battles || []).forEach((battle) => {
      const key = keyFn(battle) || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(battle);
    });
    return Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, summarizeBattles(values, scoring)]));
  }

  function battleAnalytics({ battles, deck, deckId, scoring }) {
    const relevant = relevantBattlesForDeck(battles, deck, deckId);
    const overall = summarizeBattles(relevant, scoring);
    const byBey = groupBattleSummary(relevant, (battle) => battle.ownSignature, scoring);
    const byArchetype = groupBattleSummary(relevant, (battle) => battle.opponentArchetype, scoring);
    const byCell = groupBattleSummary(relevant, (battle) => `${battle.ownSignature}::${battle.opponentArchetype || 'unknown'}`, scoring);
    const multiPointWinsByBey = {};
    relevant.map((battle) => normalizeBattle(battle, scoring)).filter((battle) => battle.decided && battle.result === 'win' && battle.points >= 2)
      .forEach((battle) => { multiPointWinsByBey[battle.ownSignature] = (multiPointWinsByBey[battle.ownSignature] || 0) + 1; });
    return { relevant, overall, byBey, byArchetype, byCell, multiPointWinsByBey };
  }

  function readinessAssessment({ deck, deckId, profile, partMap, inventory, battles, includeAnnounced, settings = {}, scoring = {} }) {
    const cfg = {
      minimumBattles: Number(settings.minimumBattles || 36),
      minimumPerBey: Number(settings.minimumPerBey || 10),
      minimumPerArchetype: Number(settings.minimumPerArchetype || 6),
      lowerBoundTarget: Number(settings.lowerBoundTarget || 0.50),
      maxContaminationRate: Number(settings.maxContaminationRate || 0.10),
      requireMultiPointFinish: settings.requireMultiPointFinish !== false
    };
    const legality = legalityCheck(deck, profile, partMap, { includeAnnounced });
    const capacity = inventoryCapacityCheck(deck, inventory || {}, partMap);
    const analytics = battleAnalytics({ battles, deck, deckId, scoring });
    const signatures = (deck || []).map(beySignature);
    const perBeyCounts = signatures.map((signature) => analytics.byBey[signature]?.effective || 0);
    const archetypeCounts = CORE_ARCHETYPES.slice(0, 4).map((archetype) => analytics.byArchetype[archetype]?.effective || 0);
    const criticalCounts = signatures.map((signature) => analytics.multiPointWinsByBey[signature] || 0);
    const diversity = roleDiversity(deck, partMap);

    const gates = [
      { id: 'legal', label: 'Legal construction', pass: legality.legal, detail: legality.legal ? 'No rules blockers.' : legality.issues[0] },
      { id: 'owned', label: 'Owned-part capacity', pass: capacity.valid, detail: capacity.valid ? 'Inventory supports the deck.' : `${capacity.shortages.length} part shortage(s).` },
      { id: 'sample', label: 'Total decided battles', pass: analytics.overall.effective >= cfg.minimumBattles, detail: `${analytics.overall.effective}/${cfg.minimumBattles}` },
      { id: 'perBey', label: 'Evidence for every Bey', pass: perBeyCounts.every((count) => count >= cfg.minimumPerBey), detail: `${perBeyCounts.length ? Math.min(...perBeyCounts) : 0}/${cfg.minimumPerBey} lowest coverage` },
      { id: 'matchups', label: 'Core matchup coverage', pass: archetypeCounts.every((count) => count >= cfg.minimumPerArchetype), detail: `${archetypeCounts.length ? Math.min(...archetypeCounts) : 0}/${cfg.minimumPerArchetype} lowest coverage` },
      { id: 'confidence', label: 'Defensible win-rate floor', pass: analytics.overall.interval.low >= cfg.lowerBoundTarget, detail: `${round(analytics.overall.interval.low * 100, 1)}% lower 95% bound` },
      { id: 'execution', label: 'Launch-data quality', pass: analytics.overall.contaminationRate <= cfg.maxContaminationRate, detail: `${round(analytics.overall.contaminationRate * 100, 1)}% contaminated` },
      { id: 'finishRoutes', label: 'Multi-point finish evidence', pass: !cfg.requireMultiPointFinish || criticalCounts.every((count) => count >= 1), detail: cfg.requireMultiPointFinish ? `${criticalCounts.filter((count) => count > 0).length}/${signatures.length} Beys demonstrated` : 'Not required' },
      { id: 'roles', label: 'Role spread', pass: diversity.unique >= 2, detail: `${diversity.unique} distinct empirical role labels` }
    ];

    const evidenceScore = clamp((analytics.overall.effective / cfg.minimumBattles) * 25, 0, 25);
    const performanceScore = clamp(((analytics.overall.interval.low - 0.30) / 0.30) * 25, 0, 25);
    const perBeyScore = clamp(mean(perBeyCounts.map((count) => count / cfg.minimumPerBey)) * 10, 0, 10);
    const matchupScore = clamp(mean(archetypeCounts.map((count) => count / cfg.minimumPerArchetype)) * 12, 0, 12);
    const executionScore = clamp((1 - analytics.overall.contaminationRate / Math.max(cfg.maxContaminationRate * 2, 0.01)) * 8, 0, 8);
    const finishScore = clamp((criticalCounts.filter((count) => count > 0).length / Math.max(signatures.length, 1)) * 10, 0, 10);
    const roleScore = diversity.unique >= 3 ? 10 : diversity.unique === 2 ? 7 : 2;
    let score = round(evidenceScore + performanceScore + perBeyScore + matchupScore + executionScore + finishScore + roleScore, 0);
    if (!legality.legal || !capacity.valid) score = Math.min(score, 39);

    const hardPass = gates.every((gate) => gate.pass);
    let label = 'Unvalidated';
    if (analytics.overall.effective >= 12) label = 'Developing';
    if (score >= 60 && legality.legal && capacity.valid) label = 'Tournament candidate';
    if (score >= 75 && hardPass) label = 'Tournament ready';
    if (score >= 88 && hardPass && analytics.overall.interval.low >= 0.55) label = 'Strong tournament evidence';

    return {
      score,
      label,
      tournamentReady: hardPass && score >= 75,
      gates,
      blockers: gates.filter((gate) => !gate.pass),
      legality,
      capacity,
      analytics,
      diversity,
      settings: cfg,
      components: { evidence: round(evidenceScore), performance: round(performanceScore), perBey: round(perBeyScore), matchups: round(matchupScore), execution: round(executionScore), finishes: round(finishScore), roles: round(roleScore) }
    };
  }

  function metaArchetypeWeights(metaProfiles) {
    const weights = Object.fromEntries(CORE_ARCHETYPES.map((id) => [id, 0]));
    let total = 0;
    (metaProfiles || []).forEach((profile) => {
      const weight = Math.max(0, Number(profile.weight) || 0);
      (profile.lineup || []).forEach((archetype) => { if (weights[archetype] !== undefined) weights[archetype] += weight; });
      total += weight * Math.max(1, (profile.lineup || []).length);
    });
    if (!total) return { attack: 0.25, stamina: 0.25, defense: 0.25, balance: 0.25, 'left-spin': 0 };
    Object.keys(weights).forEach((key) => { weights[key] /= total; });
    return weights;
  }

  function buildTestPlan({ deck, deckId, partMap, battles, scoring, metaProfiles, settings = {}, limit = 12 }) {
    const targetPerCell = Math.max(1, Number(settings.targetPerCell || 5));
    const avoidAttackMirrors = settings.avoidAttackMirrors !== false;
    const analytics = battleAnalytics({ battles, deck, deckId, scoring });
    const weights = metaArchetypeWeights(metaProfiles);
    const tasks = [];

    (deck || []).forEach((bey, beyIndex) => {
      if (!beyIsComplete(bey)) return;
      const signature = beySignature(bey);
      const ownRole = inferBeyRole(bey, partMap);
      CORE_ARCHETYPES.forEach((archetype) => {
        const summary = analytics.byCell[`${signature}::${archetype}`] || summarizeBattles([], scoring);
        const target = archetype === 'left-spin' ? Math.max(2, Math.ceil(targetPerCell * 0.6)) : targetPerCell;
        const deficit = Math.max(0, target - summary.effective);
        if (!deficit) return;
        const uncertainty = 1 - Math.min(1, summary.effective / target);
        const metaWeight = weights[archetype] || (archetype === 'left-spin' ? 0.08 : 0.1);
        const mirrorPenalty = avoidAttackMirrors && ownRole === 'attack' && archetype === 'attack' ? 0.28 : 1;
        const priority = (deficit * 2 + uncertainty * 4 + metaWeight * 10) * mirrorPenalty;
        tasks.push({
          id: `${signature}::${archetype}`,
          beyIndex,
          ownSignature: signature,
          ownName: nameForBey(bey, partMap),
          ownRole,
          opponentArchetype: archetype,
          completed: summary.effective,
          target,
          deficit,
          priority: round(priority, 2),
          rationale: mirrorPenalty < 1
            ? 'Deferred attack mirror; retained only because evidence is still incomplete.'
            : summary.effective === 0 ? 'Untested matchup cell.' : 'Raises the weakest evidence cell and narrows uncertainty.'
        });
      });
    });

    tasks.sort((a, b) => b.priority - a.priority || a.completed - b.completed || a.beyIndex - b.beyIndex);
    return tasks.slice(0, limit);
  }

  function permutations(values) {
    if (values.length <= 1) return [values.slice()];
    const result = [];
    values.forEach((value, index) => permutations([...values.slice(0, index), ...values.slice(index + 1)]).forEach((rest) => result.push([value, ...rest])));
    return result;
  }

  function matchupEstimate(analytics, signature, archetype) {
    const summary = analytics.byCell[`${signature}::${archetype}`] || { wins: 0, effective: 0, interval: { low: 0, high: 1 } };
    const meanRate = (summary.wins + 1) / (summary.effective + 2);
    const confidence = Math.min(1, summary.effective / 8);
    const conservative = confidence * summary.interval.low + (1 - confidence) * 0.42;
    return { mean: meanRate, conservative, sample: summary.effective };
  }

  function optimizeDeckOrder({ deck, deckId, partMap, battles, scoring, metaProfiles }) {
    if (!Array.isArray(deck) || deck.length !== 3 || deck.some((bey) => !beyIsComplete(bey))) return { available: false, reason: 'Complete all three Beys first.', rankings: [] };
    const analytics = battleAnalytics({ battles, deck, deckId, scoring });
    const profiles = (metaProfiles || []).filter((profile) => Array.isArray(profile.lineup) && profile.lineup.length >= 3 && Number(profile.weight) > 0);
    if (!profiles.length) return { available: false, reason: 'Add at least one three-position meta lineup.', rankings: [] };
    const totalRelevant = analytics.overall.effective;
    const positionWeights = [1.15, 1, 0.9];
    const rankings = permutations([0, 1, 2]).map((order) => {
      let expected = 0;
      let conservative = 0;
      let evidence = 0;
      let weightTotal = 0;
      profiles.forEach((profile) => {
        const profileWeight = Number(profile.weight) || 0;
        order.forEach((beyIndex, position) => {
          const matchup = matchupEstimate(analytics, beySignature(deck[beyIndex]), profile.lineup[position]);
          const weight = profileWeight * positionWeights[position];
          expected += matchup.mean * weight;
          conservative += matchup.conservative * weight;
          evidence += Math.min(8, matchup.sample) * weight;
          weightTotal += weight;
        });
      });
      return {
        order,
        names: order.map((index) => nameForBey(deck[index], partMap)),
        expected: weightTotal ? expected / weightTotal : 0,
        conservative: weightTotal ? conservative / weightTotal : 0,
        evidence: weightTotal ? evidence / weightTotal : 0
      };
    }).sort((a, b) => b.conservative - a.conservative || b.expected - a.expected);
    return {
      available: true,
      lowEvidence: totalRelevant < 24,
      reason: totalRelevant < 24 ? 'Order is provisional because matchup evidence is limited.' : 'Order is ranked from logged matchup evidence and weighted meta lineups.',
      rankings
    };
  }

  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function weightedChoice(items, weightFn, random) {
    const weights = items.map((item) => Math.max(0, Number(weightFn(item)) || 0));
    const total = sum(weights);
    if (!items.length) return null;
    if (!total) return items[Math.floor(random() * items.length)];
    let cursor = random() * total;
    for (let i = 0; i < items.length; i += 1) {
      cursor -= weights[i];
      if (cursor <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function priorPointDistribution(role) {
    if (role === 'attack') return [1,2,2,3,3];
    if (role === 'stamina') return [1,1,1,2];
    if (role === 'defense') return [1,1,2,2];
    return [1,1,2,2,3];
  }

  function forecastTournament({ deck, deckId, partMap, battles, scoring, metaProfiles, targetPoints = 4, simulations = 5000, seed = 20260719, order }) {
    const profiles = (metaProfiles || []).filter((profile) => Array.isArray(profile.lineup) && profile.lineup.length >= 3 && Number(profile.weight) > 0);
    if (!profiles.length || deck?.length !== 3 || deck.some((bey) => !beyIsComplete(bey))) return { available: false, reason: 'A complete deck and at least one meta lineup are required.' };
    const selectedOrder = Array.isArray(order) && order.length === 3 ? order : [0,1,2];
    const analytics = battleAnalytics({ battles, deck, deckId, scoring });
    const random = mulberry32(Number(seed) || 1);
    const normalizedRelevant = analytics.relevant.map((battle) => normalizeBattle(battle, scoring)).filter((battle) => battle.decided);
    let matchWins = 0;
    const samples = [];

    for (let simulation = 0; simulation < simulations; simulation += 1) {
      const profile = weightedChoice(profiles, (item) => item.weight, random);
      let ownPoints = 0;
      let opponentPoints = 0;
      let battleIndex = 0;
      while (ownPoints < targetPoints && opponentPoints < targetPoints && battleIndex < 18) {
        const position = battleIndex % 3;
        const beyIndex = selectedOrder[position];
        const signature = beySignature(deck[beyIndex]);
        const archetype = profile.lineup[position] || 'unknown';
        const cell = normalizedRelevant.filter((battle) => battle.ownSignature === signature && battle.opponentArchetype === archetype);
        let win;
        let points;
        if (cell.length >= 3) {
          const sampled = cell[Math.floor(random() * cell.length)];
          win = sampled.result === 'win';
          points = Math.max(1, sampled.points || 1);
        } else {
          const estimate = matchupEstimate(analytics, signature, archetype);
          const p = clamp(estimate.mean * Math.min(1, cell.length / 3) + 0.44 * (1 - Math.min(1, cell.length / 3)), 0.25, 0.75);
          win = random() < p;
          const distribution = priorPointDistribution(inferBeyRole(deck[beyIndex], partMap));
          points = distribution[Math.floor(random() * distribution.length)];
        }
        if (win) ownPoints = Math.min(targetPoints, ownPoints + points);
        else opponentPoints = Math.min(targetPoints, opponentPoints + points);
        battleIndex += 1;
      }
      const won = ownPoints >= targetPoints && ownPoints > opponentPoints;
      if (won) matchWins += 1;
      samples.push({ won, ownPoints, opponentPoints });
    }
    const interval = wilsonInterval(matchWins, simulations);
    return {
      available: true,
      simulations,
      matchWins,
      winRate: matchWins / simulations,
      interval,
      averagePointsFor: mean(samples.map((sample) => sample.ownPoints)),
      averagePointsAgainst: mean(samples.map((sample) => sample.opponentPoints)),
      evidenceBattles: analytics.overall.effective,
      lowEvidence: analytics.overall.effective < 30,
      reason: analytics.overall.effective < 30
        ? 'Forecast is prior-heavy because fewer than 30 relevant decided battles are available.'
        : 'Forecast resamples empirical matchup outcomes and uses conservative priors only for sparse cells.'
    };
  }

  function roleCompatibility(topRole, bitRole, assistRole) {
    let score = 0;
    if (topRole === bitRole) score += 4;
    else if (topRole === 'balance' || bitRole === 'balance') score += 2;
    else score += 0.5;
    if (assistRole === topRole) score += 1;
    else if (assistRole === 'balance') score += 0.5;
    return score;
  }

  function inventoryCanSupplyBey(bey, inventory) {
    const counts = {};
    partIdsFromBey(bey).forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    return Object.entries(counts).every(([id, count]) => inventoryQuantity(inventory, id) >= count);
  }

  function generateOwnedCandidates({ inventory, partMap, includeAnnounced = false, maxCandidates = 120 }) {
    const owned = Object.values(partMap).filter((part) => inventoryQuantity(inventory, part.id) > 0 && (includeAnnounced || part.status !== 'announced'));
    const byCategory = {};
    owned.forEach((part) => { if (!byCategory[part.category]) byCategory[part.category] = []; byCategory[part.category].push(part); });
    const candidates = [];
    const candidateSignatures = new Set();
    const push = (bey, topRole, bitRole, assistRole, architecture) => {
      if (!beyIsComplete(bey) || !inventoryCanSupplyBey(bey, inventory)) return;
      const signature = beySignature(bey);
      if (candidateSignatures.has(signature)) return;
      candidateSignatures.add(signature);
      candidates.push({ bey, signature, role: inferBeyRole(bey, partMap), architecture, heuristic: roleCompatibility(topRole, bitRole, assistRole) });
      if (candidates.length > 5000) candidates.sort((a, b) => b.heuristic - a.heuristic).splice(2500);
    };

    const ratchets = (byCategory.ratchet || []).slice(0, 16);
    const bits = (byCategory.bit || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    (byCategory.blade || []).forEach((blade) => {
      const rankedBits = bits.slice().sort((a, b) => roleCompatibility(blade.role, b.role) - roleCompatibility(blade.role, a.role)).slice(0, 8);
      ratchets.forEach((ratchet) => rankedBits.forEach((bit) => push({ system: 'basic', blade: blade.id, ratchet: ratchet.id, bit: bit.id }, blade.role, bit.role, 'balance', 'basic')));
    });
    (byCategory.ratchetIntegratedBlade || []).forEach((blade) => {
      bits.slice().sort((a, b) => roleCompatibility(blade.role, b.role) - roleCompatibility(blade.role, a.role)).slice(0, 10)
        .forEach((bit) => push({ system: 'integrated', ratchetIntegratedBlade: blade.id, bit: bit.id }, blade.role, bit.role, 'balance', 'integrated'));
    });

    const locks = (byCategory.lockChip || []).slice(0, 12);
    const assists = (byCategory.assistBlade || []);
    const integratedBits = (byCategory.integratedBit || []);
    const mains = byCategory.mainBlade || [];
    mains.forEach((main) => {
      const rankedAssists = assists.slice().sort((a, b) => roleCompatibility(main.role, main.role, b.role) - roleCompatibility(main.role, main.role, a.role)).slice(0, 5);
      const rankedBits = bits.slice().sort((a, b) => roleCompatibility(main.role, b.role) - roleCompatibility(main.role, a.role)).slice(0, 6);
      locks.forEach((lock) => rankedAssists.forEach((assist) => {
        ratchets.slice(0, 10).forEach((ratchet) => rankedBits.forEach((bit) => push({ system: 'custom', customArchitecture: 'main', customDrive: 'standard', lockChip: lock.id, mainBlade: main.id, assistBlade: assist.id, ratchet: ratchet.id, bit: bit.id }, main.role, bit.role, assist.role, 'custom-main')));
        integratedBits.forEach((integratedBit) => push({ system: 'custom', customArchitecture: 'main', customDrive: 'integrated', lockChip: lock.id, mainBlade: main.id, assistBlade: assist.id, integratedBit: integratedBit.id }, main.role, integratedBit.role, assist.role, 'custom-main-integrated'));
      }));
    });

    const metals = byCategory.metalBlade || [];
    const overs = byCategory.overBlade || [];
    metals.forEach((metal) => overs.slice(0, 6).forEach((over) => {
      const topRole = metal.role === over.role ? metal.role : 'balance';
      const rankedAssists = assists.slice().sort((a, b) => roleCompatibility(topRole, topRole, b.role) - roleCompatibility(topRole, topRole, a.role)).slice(0, 4);
      const rankedBits = bits.slice().sort((a, b) => roleCompatibility(topRole, b.role) - roleCompatibility(topRole, a.role)).slice(0, 5);
      locks.forEach((lock) => rankedAssists.forEach((assist) => ratchets.slice(0, 8).forEach((ratchet) => rankedBits.forEach((bit) => push({ system: 'custom', customArchitecture: 'expanded', customDrive: 'standard', lockChip: lock.id, metalBlade: metal.id, overBlade: over.id, assistBlade: assist.id, ratchet: ratchet.id, bit: bit.id }, topRole, bit.role, assist.role, 'custom-expanded')))));
    }));

    return candidates.sort((a, b) => b.heuristic - a.heuristic || a.signature.localeCompare(b.signature)).slice(0, maxCandidates);
  }

  function suggestDecks({ inventory, partMap, profile, includeAnnounced, battles = [], settings = {}, limit = 5 }) {
    const requestedPool = clamp(Math.floor(Number(settings.candidatePool || 36)), 12, 120);
    const poolSizes = unique([requestedPool, Math.max(requestedPool, 48), Math.max(requestedPool, 72), 120]).sort((a, b) => a - b);

    const rankPool = (maxCandidates) => {
      const candidates = generateOwnedCandidates({ inventory, partMap, includeAnnounced, maxCandidates });
      const suggestions = [];
      for (let i = 0; i < candidates.length; i += 1) {
        for (let j = i + 1; j < candidates.length; j += 1) {
          for (let k = j + 1; k < candidates.length; k += 1) {
            const selected = [candidates[i], candidates[j], candidates[k]];
            const deck = selected.map((candidate) => candidate.bey);
            const legality = legalityCheck(deck, profile, partMap, { includeAnnounced });
            if (!legality.legal || !inventoryCapacityCheck(deck, inventory, partMap).valid) continue;
            const roles = selected.map((candidate) => candidate.role);
            const diversity = unique(roles).length;
            const attackRoutes = roles.filter((role) => role === 'attack' || role === 'balance').length;
            const evidenceBonus = sum(selected.map((candidate) => {
              const summary = summarizeBattles((battles || []).filter((battle) => battle.ownSignature === candidate.signature), {});
              return Math.min(4, summary.effective / 3) + summary.interval.low * 2;
            }));
            const score = sum(selected.map((candidate) => candidate.heuristic)) + diversity * 5 + attackRoutes * 1.2 + evidenceBonus;
            suggestions.push({ deck, score: round(score, 2), roles, legality, note: 'Structural shortlist from owned parts. Roles and existing logs rank candidates; physical performance still requires controlled testing.' });
            if (suggestions.length > 500) suggestions.sort((a, b) => b.score - a.score).splice(250);
          }
        }
      }
      return suggestions.sort((a, b) => b.score - a.score).slice(0, limit);
    };

    let ranked = [];
    for (const poolSize of poolSizes) {
      ranked = rankPool(poolSize);
      if (ranked.length >= limit || poolSize === 120) break;
    }
    return ranked;
  }

  function dataQualityAudit(data) {
    const issues = [];
    const warnings = [];
    const ids = new Set();
    (data.parts || []).forEach((part) => {
      if (!part.id || !part.name || !part.category) issues.push('A catalog part is missing id, name, or category.');
      if (ids.has(part.id)) issues.push(`Duplicate part ID: ${part.id}`);
      ids.add(part.id);
      if (!['attack','stamina','defense','balance'].includes(part.role)) warnings.push(`${part.id} has an unrecognized role.`);
      if (part.status === 'announced' && !part.notes) warnings.push(`${part.id} is announced without a release note.`);
    });
    (data.products || []).forEach((product) => (product.parts || []).forEach((id) => { if (!ids.has(id)) issues.push(`${product.id} references missing part ${id}.`); }));
    return { pass: issues.length === 0, issues: unique(issues), warnings: unique(warnings), counts: { parts: data.parts?.length || 0, products: data.products?.length || 0, profiles: Object.keys(data.profiles || {}).length } };
  }

  function fnv1a(value) {
    let hash = 0x811c9dc5;
    const text = String(value);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (`0000000${(hash >>> 0).toString(16)}`).slice(-8);
  }

  function migrateState(raw) {
    const now = new Date().toISOString();
    if (!raw || typeof raw !== 'object') return null;
    if (Number(raw.schemaVersion) >= SCHEMA_VERSION && Array.isArray(raw.decks)) return raw;
    const inventory = {};
    Object.entries(raw.inventory || {}).forEach(([id, value]) => {
      const qty = value && typeof value === 'object' ? Number(value.qty) : Number(value);
      if (qty > 0) inventory[id] = { qty: Math.floor(qty), condition: value?.condition || 'good', notes: value?.notes || '' };
    });
    const deckId = `deck-migrated-${fnv1a(now)}`;
    const deck = Array.isArray(raw.deck) ? raw.deck.slice(0, 3) : [];
    const migratedBattles = (raw.battles || []).map((battle) => ({
      ...battle,
      deckId: battle.deckId || deckId,
      ownSignature: battle.ownSignature || (Number.isInteger(battle.ownBeyIndex) ? beySignature(deck[battle.ownBeyIndex]) : ''),
      result: battle.result || (battle.won === true ? 'win' : battle.won === false ? 'loss' : 'draw'),
      contaminated: Boolean(battle.contaminated || battle.launchError)
    }));
    return {
      schemaVersion: SCHEMA_VERSION,
      migratedFrom: Number(raw.version || raw.schemaVersion || 1),
      inventory,
      customParts: Array.isArray(raw.customParts) ? raw.customParts : [],
      decks: [{ id: deckId, name: 'Migrated Tournament Deck', profileId: raw.profileId || 'tt3on3', includeAnnounced: Boolean(raw.includeAnnounced), beys: deck, notes: '', tags: [], createdAt: now, updatedAt: now }],
      activeDeckId: deckId,
      battles: migratedBattles,
      metaProfiles: [],
      customProfiles: [],
      settings: {},
      createdAt: now,
      updatedAt: now
    };
  }

  const api = {
    SCHEMA_VERSION,
    PART_SLOTS,
    CORE_ARCHETYPES,
    clamp,
    round,
    scoreForFinish,
    wilsonInterval,
    partIdsFromBey,
    beyIsComplete,
    beySignature,
    nameForBey,
    inventoryQuantity,
    inventoryCapacityCheck,
    legalityCheck,
    inferBeyRole,
    roleDiversity,
    relevantBattlesForDeck,
    normalizeBattle,
    summarizeBattles,
    battleAnalytics,
    readinessAssessment,
    metaArchetypeWeights,
    buildTestPlan,
    permutations,
    matchupEstimate,
    optimizeDeckOrder,
    forecastTournament,
    generateOwnedCandidates,
    suggestDecks,
    dataQualityAudit,
    fnv1a,
    migrateState
  };

  root.XCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
