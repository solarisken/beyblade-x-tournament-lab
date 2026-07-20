(function (root) {
  'use strict';

  const SCHEMA_VERSION = 8;
  const ENGINEERING_MODEL_VERSION = 2;
  const PART_SLOTS = ['blade','ratchetIntegratedBlade','lockChip','metalBlade','overBlade','mainBlade','assistBlade','ratchet','bit','integratedBit'];
  const CORE_ARCHETYPES = ['attack','stamina','defense','balance','left-spin'];
  const OWN_SELF_KO_CAUSES = new Set(['own-no-contact-self-ko','own-glancing-self-ko','own-rail-overshoot','own-rebound-self-ko','own-launch-destabilization','own-unknown-self-ko']);
  const SELF_KO_CAUSES = new Set([...OWN_SELF_KO_CAUSES, 'opponent-self-ko']);

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


  function inventoryCapacityForBattle(ownBey, opponentBey, inventory, partMap) {
    return inventoryCapacityCheck([ownBey, opponentBey], inventory, partMap);
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


  function bitIdFromBey(bey) {
    return bey?.integratedBit || bey?.bit || '';
  }

  function bitRoleForBey(bey, partMap) {
    const role = partMap?.[bitIdFromBey(bey)]?.role;
    return ['attack','stamina','defense','balance'].includes(role) ? role : 'balance';
  }

  function isLeftSpinBey(bey, partMap) {
    return partIdsFromBey(bey).some((id) => /left[- ]spin/i.test(`${partMap?.[id]?.notes || ''} ${partMap?.[id]?.name || ''}`));
  }

  function ratchetHeightForBey(bey, partMap) {
    if (bey?.integratedBit) return 70;
    if (bey?.system === 'integrated' && !bey?.ratchet) return 65;
    const text = `${partMap?.[bey?.ratchet]?.name || bey?.ratchet || ''}`;
    const match = text.match(/-(\d{2})(?:\D|$)/);
    return match ? clamp(Number(match[1]), 50, 85) : 70;
  }

  function roleTopDefaults(role) {
    const defaults = {
      attack:  { aggression: 0.86, inertia: 0.58, symmetry: 0.43, koResistance: 0.42, recoil: 0.68 },
      stamina: { aggression: 0.27, inertia: 0.80, symmetry: 0.84, koResistance: 0.58, recoil: 0.22 },
      defense: { aggression: 0.39, inertia: 0.68, symmetry: 0.72, koResistance: 0.84, recoil: 0.28 },
      balance: { aggression: 0.56, inertia: 0.66, symmetry: 0.65, koResistance: 0.65, recoil: 0.44 }
    };
    return { ...(defaults[role] || defaults.balance) };
  }

  function roleBitDefaults(role) {
    const defaults = {
      attack:  { traction: 0.84, mobility: 0.91, spinRetention: 0.34, stability: 0.43, control: 0.42, peripheralMass: 0.25 },
      stamina: { traction: 0.25, mobility: 0.24, spinRetention: 0.91, stability: 0.74, control: 0.67, peripheralMass: 0.62 },
      defense: { traction: 0.56, mobility: 0.22, spinRetention: 0.63, stability: 0.88, control: 0.84, peripheralMass: 0.38 },
      balance: { traction: 0.57, mobility: 0.55, spinRetention: 0.64, stability: 0.68, control: 0.68, peripheralMass: 0.42 }
    };
    return { ...(defaults[role] || defaults.balance) };
  }

  function boundedVector(vector) {
    return Object.fromEntries(Object.entries(vector).map(([key, value]) => [key, clamp(value, 0, 1)]));
  }

  function partTopEngineering(part) {
    const result = roleTopDefaults(part?.role);
    const text = `${part?.name || ''} ${part?.notes || ''}`.toLowerCase();
    if (/(ring|circle|rod|round|arc|orbital|wheel)/.test(text)) { result.inertia += 0.08; result.symmetry += 0.09; result.recoil -= 0.06; }
    if (/(impact|buster|strike|sword|spear|shark|blast|brave|blitz|whip|flare|reaper|drake)/.test(text)) { result.aggression += 0.09; result.recoil += 0.07; result.symmetry -= 0.05; }
    if (/(shield|mail|crest|fort|fortress|shell|rock|press|guard)/.test(text)) { result.koResistance += 0.09; result.symmetry += 0.04; result.aggression -= 0.03; }
    if (part?.category === 'assistBlade') { result.aggression *= 0.8; result.inertia *= 0.82; result.koResistance *= 0.82; }
    if (part?.category === 'overBlade') { result.aggression *= 0.88; result.inertia *= 0.9; result.koResistance *= 0.9; }
    if (part?.engineering && typeof part.engineering === 'object') Object.assign(result, part.engineering);
    return boundedVector(result);
  }

  function partBitEngineering(part) {
    const result = roleBitDefaults(part?.role);
    const text = `${part?.name || ''} ${part?.code || ''}`.toLowerCase();
    if (/rubber/.test(text)) { result.traction += 0.15; result.mobility += 0.06; result.spinRetention -= 0.12; }
    if (/(flat|rush|accel|jolt|vortex|zap|cyclone|quake|ignition)/.test(text)) { result.mobility += 0.08; result.traction += 0.05; result.control -= 0.04; }
    if (/(ball|orb)/.test(text)) { result.spinRetention += 0.08; result.stability += 0.07; result.mobility -= 0.05; }
    if (/(needle|spike|wedge|dot|hexa|narrow)/.test(text)) { result.stability += 0.08; result.control += 0.09; result.mobility -= 0.06; }
    if (/free/.test(text)) { result.spinRetention += 0.07; result.control += 0.02; }
    if (/(disk|wall)/.test(text)) { result.peripheralMass += 0.10; result.spinRetention += 0.04; }
    if (/gear/.test(text)) { result.mobility += 0.05; result.traction += 0.04; result.spinRetention -= 0.03; }
    if (part?.engineering && typeof part.engineering === 'object') Object.assign(result, part.engineering);
    return boundedVector(result);
  }

  function weightedTopEngineering(bey, partMap) {
    const weighted = [];
    const add = (id, weight) => { if (id && partMap?.[id]) weighted.push({ vector: partTopEngineering(partMap[id]), weight }); };
    add(bey?.blade, 1);
    add(bey?.ratchetIntegratedBlade, 1);
    add(bey?.mainBlade, 0.82);
    add(bey?.metalBlade, 0.72);
    add(bey?.overBlade, 0.42);
    add(bey?.assistBlade, 0.30);
    if (!weighted.length) return roleTopDefaults('balance');
    const keys = ['aggression','inertia','symmetry','koResistance','recoil'];
    const totalWeight = sum(weighted.map((entry) => entry.weight));
    return Object.fromEntries(keys.map((key) => [key, sum(weighted.map((entry) => entry.vector[key] * entry.weight)) / totalWeight]));
  }

  function engineeringRoleFit(profile, role) {
    const metric = profile.metrics;
    const weights = {
      attack:  { impactPotential: 0.30, xDashPotential: 0.23, control: 0.14, stability: 0.10, burstResistance: 0.08, spinRetention: 0.08, koResistance: 0.07 },
      stamina: { spinRetention: 0.34, rotationalInertia: 0.24, stability: 0.18, control: 0.11, burstResistance: 0.08, koResistance: 0.05 },
      defense: { koResistance: 0.30, stability: 0.24, burstResistance: 0.14, control: 0.13, spinRetention: 0.11, rotationalInertia: 0.08 },
      balance: { control: 0.20, stability: 0.18, spinRetention: 0.17, koResistance: 0.16, impactPotential: 0.13, burstResistance: 0.09, xDashPotential: 0.07 }
    }[role] || null;
    if (!weights) return 0;
    return round(sum(Object.entries(weights).map(([key, weight]) => metric[key] * weight)), 1);
  }

  function engineeringMatchupRatings(profile) {
    const m = profile.metrics;
    return {
      attack: round(0.30 * m.koResistance + 0.22 * m.stability + 0.16 * m.control + 0.14 * m.burstResistance + 0.10 * m.spinRetention + 0.08 * (100 - m.selfKoRisk), 1),
      stamina: round(0.30 * m.impactPotential + 0.20 * m.xDashPotential + 0.17 * m.control + 0.15 * m.spinRetention + 0.10 * m.stability + 0.08 * m.rotationalInertia, 1),
      defense: round(0.27 * m.spinRetention + 0.22 * m.impactPotential + 0.17 * m.control + 0.14 * m.xDashPotential + 0.12 * m.stability + 0.08 * m.rotationalInertia, 1),
      balance: round(0.18 * m.impactPotential + 0.18 * m.spinRetention + 0.18 * m.stability + 0.17 * m.koResistance + 0.16 * m.control + 0.13 * m.burstResistance, 1),
      'left-spin': round(0.27 * m.spinRetention + 0.23 * m.stability + 0.19 * m.control + 0.16 * m.rotationalInertia + 0.15 * m.koResistance, 1)
    };
  }

  function engineeringProfileForBey(bey, partMap) {
    const top = weightedTopEngineering(bey, partMap);
    const bitPart = partMap?.[bitIdFromBey(bey)] || { role: 'balance', name: '' };
    const bit = partBitEngineering(bitPart);
    const ratchetHeight = ratchetHeightForBey(bey, partMap);
    const bitName = `${bitPart.name || ''}`.toLowerCase();
    const bitHeightOffset = /low|under/.test(bitName) ? -0.08 : /high/.test(bitName) ? 0.08 : 0;
    const lowCenter = clamp(1 - ((ratchetHeight - 50) / 35) - bitHeightOffset, 0, 1);
    const impactPotential = clamp(0.42 * top.aggression + 0.27 * bit.mobility + 0.18 * bit.traction + 0.13 * top.inertia, 0, 1);
    const rotationalInertia = clamp(0.74 * top.inertia + 0.16 * top.symmetry + 0.10 * bit.peripheralMass, 0, 1);
    const spinRetention = clamp(0.39 * bit.spinRetention + 0.27 * rotationalInertia + 0.19 * top.symmetry + 0.15 * bit.stability - 0.07 * bit.traction, 0, 1);
    const stability = clamp(0.31 * bit.stability + 0.20 * bit.control + 0.18 * top.symmetry + 0.17 * lowCenter + 0.14 * top.koResistance - 0.07 * top.recoil, 0, 1);
    const koResistance = clamp(0.30 * top.koResistance + 0.24 * stability + 0.18 * lowCenter + 0.15 * bit.control + 0.13 * bit.traction, 0, 1);
    const burstResistance = clamp(0.34 * lowCenter + 0.25 * stability + 0.18 * top.symmetry + 0.16 * bit.control + 0.07 * top.koResistance - 0.07 * top.recoil, 0, 1);
    const xDashPotential = clamp(0.45 * bit.mobility + 0.34 * bit.traction + 0.21 * top.aggression, 0, 1);
    const control = clamp(0.46 * bit.control + 0.21 * stability + 0.17 * top.symmetry + 0.10 * lowCenter + 0.06 * (1 - top.recoil), 0, 1);
    const recoilRisk = clamp(0.72 * top.recoil + 0.28 * bit.mobility, 0, 1);
    const selfKoRisk = clamp(0.39 * bit.mobility + 0.27 * top.recoil + 0.20 * bit.traction - 0.26 * control + 0.10 * (1 - lowCenter), 0, 1);
    const metrics = Object.fromEntries(Object.entries({ impactPotential, rotationalInertia, spinRetention, stability, koResistance, burstResistance, xDashPotential, control, recoilRisk, selfKoRisk }).map(([key, value]) => [key, round(value * 100, 1)]));
    const inferredRole = inferBeyRole(bey, partMap);
    const profile = {
      modelVersion: ENGINEERING_MODEL_VERSION,
      inferredRole,
      bitRole: bitRoleForBey(bey, partMap),
      spinDirection: isLeftSpinBey(bey, partMap) ? 'left' : 'right',
      ratchetHeight,
      metrics,
      confidence: partIdsFromBey(bey).some((id) => partMap?.[id]?.status === 'custom') ? 0.38 : 0.58,
      assumptions: ['Qualitative geometry/type proxies', 'No measured mass or RPM', 'No coefficient-of-friction or mold-variation data']
    };
    profile.roleFit = engineeringRoleFit(profile, inferredRole);
    profile.matchups = engineeringMatchupRatings(profile);
    const ordered = Object.entries(profile.matchups).sort((a, b) => b[1] - a[1]);
    profile.strongestMatchup = ordered[0]?.[0] || 'balance';
    profile.weakestMatchup = ordered.at(-1)?.[0] || 'balance';
    return profile;
  }

  function engineeringDeckAssessment(deck, partMap, metaWeights = {}) {
    const profiles = (deck || []).map((bey, deckIndex) => ({ bey, deckIndex })).filter((entry) => beyIsComplete(entry.bey)).map((entry) => ({ ...engineeringProfileForBey(entry.bey, partMap), deckIndex: entry.deckIndex, bey: entry.bey }));
    if (!profiles.length) return { score: 0, profiles: [], matchups: {}, weakestMatchup: 'unknown', averageSelfKoRisk: 100, roleSpread: 0, bitRoleSpread: 0 };
    const matchups = {};
    CORE_ARCHETYPES.forEach((archetype) => {
      const ratings = profiles.map((profile) => profile.matchups[archetype] || 0).sort((a, b) => b - a);
      matchups[archetype] = round((ratings[0] || 0) * 0.62 + (ratings[1] || ratings[0] || 0) * 0.27 + (ratings[2] || ratings[1] || ratings[0] || 0) * 0.11, 1);
    });
    const weights = Object.keys(metaWeights || {}).length ? metaWeights : { attack: 0.25, stamina: 0.25, defense: 0.25, balance: 0.25, 'left-spin': 0 };
    const weightTotal = sum(CORE_ARCHETYPES.map((id) => Number(weights[id] || 0))) || 1;
    const weightedAverage = sum(CORE_ARCHETYPES.map((id) => matchups[id] * Number(weights[id] || 0))) / weightTotal;
    const weakest = Object.entries(matchups).filter(([id]) => id !== 'left-spin' || Number(weights[id] || 0) > 0).sort((a, b) => a[1] - b[1])[0] || ['unknown', 0];
    const averageSelfKoRisk = mean(profiles.map((profile) => profile.metrics.selfKoRisk));
    const roleSpread = unique(profiles.map((profile) => profile.inferredRole)).length;
    const bitRoleSpread = unique(profiles.map((profile) => profile.bitRole)).length;
    const diversityScore = clamp(((roleSpread - 1) / 2) * 65 + ((bitRoleSpread - 1) / 2) * 35, 0, 100);
    const score = round(0.38 * weightedAverage + 0.34 * weakest[1] + 0.17 * (100 - averageSelfKoRisk) + 0.11 * diversityScore, 1);
    return { modelVersion: ENGINEERING_MODEL_VERSION, score, profiles, matchups, weakestMatchup: weakest[0], weakestRating: weakest[1], weightedAverage: round(weightedAverage, 1), averageSelfKoRisk: round(averageSelfKoRisk, 1), roleSpread, bitRoleSpread, confidence: round(mean(profiles.map((profile) => profile.confidence)), 2) };
  }

  function opponentArchetypeForBey(bey, partMap) {
    return isLeftSpinBey(bey, partMap) ? 'left-spin' : inferBeyRole(bey, partMap);
  }

  function relevantBattlesForDeck(battles, deck, deckId) {
    const signatures = new Set((deck || []).map(beySignature).filter(Boolean));
    return (battles || []).filter((battle) => {
      if (deckId && battle.deckId && battle.deckId !== deckId) return false;
      const signature = battle.ownSignature || '';
      return signatures.has(signature);
    });
  }

  function defaultFinishCause(result, finish) {
    if (finish === 'spin') return 'spin-exhaustion';
    if (finish === 'burst') return 'burst-impact';
    if (finish === 'draw' || finish === 'relaunch' || result === 'draw' || result === 'relaunch') return 'draw-invalid';
    if (finish === 'over' || finish === 'xtreme') return 'unknown-contact-cause';
    return 'unknown';
  }

  function normalizeBattle(battle, scoring = {}) {
    const result = battle?.result || (battle?.won === true ? 'win' : battle?.won === false ? 'loss' : 'draw');
    const finish = battle?.finish || 'spin';
    const contaminated = Boolean(battle?.contaminated || battle?.launchError);
    const decided = !contaminated && ['win','loss'].includes(result) && !['draw','relaunch'].includes(finish);
    const points = scoreForFinish(finish, scoring);
    let finishCause = String(battle?.finishCause || '');
    if (!finishCause && (battle?.selfKo === true || battle?.selfKoSide === 'own')) finishCause = 'own-unknown-self-ko';
    if (!finishCause && battle?.selfKoSide === 'opponent') finishCause = 'opponent-self-ko';
    if (!finishCause) finishCause = defaultFinishCause(result, finish);

    const explicitSelfKo = typeof battle?.selfKo === 'boolean';
    const legacyOwnSelfKo = battle?.selfKoSide === 'own' || OWN_SELF_KO_CAUSES.has(finishCause);
    const legacyOpponentSelfKo = battle?.selfKoSide === 'opponent' || finishCause === 'opponent-self-ko';
    const selfKo = explicitSelfKo ? battle.selfKo : Boolean(legacyOwnSelfKo);
    const legacyAnswerKnown = !['unknown','unknown-contact-cause'].includes(finishCause);
    const selfKoKnown = typeof battle?.selfKoKnown === 'boolean'
      ? battle.selfKoKnown
      : explicitSelfKo || Boolean(battle?.selfKoSide) || legacyAnswerKnown;
    const ownSelfKo = decided && selfKoKnown && selfKo;
    const opponentSelfKo = decided && !selfKo && legacyOpponentSelfKo;
    const causeKnown = selfKoKnown;
    const stabilityEvidence = decided && selfKoKnown;
    return { ...battle, result, finish, finishCause, selfKo, selfKoKnown, selfKoSide: ownSelfKo ? 'own' : opponentSelfKo ? 'opponent' : '', causeKnown, ownSelfKo, opponentSelfKo, stabilityEvidence, contaminated, decided, points };
  }

  function summarizeBattles(battles, scoring = {}) {
    const normalized = (battles || []).map((battle) => normalizeBattle(battle, scoring));
    const effective = normalized.filter((battle) => battle.decided);
    const knownCause = effective.filter((battle) => battle.causeKnown);
    const wins = effective.filter((battle) => battle.result === 'win').length;
    const losses = effective.filter((battle) => battle.result === 'loss').length;
    const interval = wilsonInterval(wins, effective.length);
    const pointsFor = sum(effective.filter((battle) => battle.result === 'win').map((battle) => battle.points));
    const pointsAgainst = sum(effective.filter((battle) => battle.result === 'loss').map((battle) => battle.points));
    const contaminated = normalized.filter((battle) => battle.contaminated).length;
    const ownSelfKos = knownCause.filter((battle) => battle.ownSelfKo);
    const opponentSelfKos = knownCause.filter((battle) => battle.opponentSelfKo);
    const selfKoInterval = wilsonInterval(ownSelfKos.length, knownCause.length);
    const finishCounts = {};
    const causeCounts = {};
    effective.forEach((battle) => {
      const key = `${battle.result}:${battle.finish}`;
      finishCounts[key] = (finishCounts[key] || 0) + 1;
      causeCounts[battle.finishCause] = (causeCounts[battle.finishCause] || 0) + 1;
    });
    const ownSelfKoByFinish = {
      over: ownSelfKos.filter((battle) => battle.finish === 'over').length,
      xtreme: ownSelfKos.filter((battle) => battle.finish === 'xtreme').length
    };
    const controlledStability = knownCause.filter((battle) => ['stamina','defense'].includes(battle.opponentArchetype) && battle.opponentBitRole !== 'attack');
    const controlledSelfKos = controlledStability.filter((battle) => battle.ownSelfKo).length;
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
      finishCounts,
      causeCounts,
      causeKnown: knownCause.length,
      causeCoverage: effective.length ? knownCause.length / effective.length : 0,
      selfKoAnswered: knownCause.length,
      selfKoAnswerRate: effective.length ? knownCause.length / effective.length : 0,
      selfKoEvidence: knownCause.length,
      ownSelfKos: ownSelfKos.length,
      opponentSelfKos: opponentSelfKos.length,
      selfKoRate: knownCause.length ? ownSelfKos.length / knownCause.length : 0,
      selfKoInterval,
      ownSelfKoByFinish,
      controlledStabilityBattles: controlledStability.length,
      controlledSelfKos,
      controlledSelfKoRate: controlledStability.length ? controlledSelfKos / controlledStability.length : 0,
      controlledSelfKoInterval: wilsonInterval(controlledSelfKos, controlledStability.length)
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

  function selfKoBreakdown(battles, keyFn, scoring) {
    return Object.entries(groupBattleSummary(battles, keyFn, scoring))
      .map(([key, summary]) => ({ key, ...summary }))
      .filter((row) => row.selfKoEvidence > 0)
      .sort((a, b) => b.ownSelfKos - a.ownSelfKos || b.selfKoEvidence - a.selfKoEvidence || a.key.localeCompare(b.key));
  }

  function battleAnalytics({ battles, deck, deckId, scoring }) {
    const relevant = relevantBattlesForDeck(battles, deck, deckId);
    const overall = summarizeBattles(relevant, scoring);
    const byBey = groupBattleSummary(relevant, (battle) => battle.ownSignature, scoring);
    const byArchetype = groupBattleSummary(relevant, (battle) => battle.opponentArchetype, scoring);
    const byCell = groupBattleSummary(relevant, (battle) => `${battle.ownSignature}::${battle.opponentArchetype || 'unknown'}`, scoring);
    const byOpponent = groupBattleSummary(relevant.filter((battle) => battle.opponentSignature), (battle) => battle.opponentSignature, scoring);
    const byOpponentCell = groupBattleSummary(relevant.filter((battle) => battle.opponentSignature), (battle) => `${battle.ownSignature}::${battle.opponentSignature}`, scoring);
    const multiPointWinsByBey = {};
    relevant.map((battle) => normalizeBattle(battle, scoring)).filter((battle) => battle.decided && battle.result === 'win' && battle.points >= 2)
      .forEach((battle) => { multiPointWinsByBey[battle.ownSignature] = (multiPointWinsByBey[battle.ownSignature] || 0) + 1; });
    return {
      relevant, overall, byBey, byArchetype, byCell, byOpponent, byOpponentCell, multiPointWinsByBey,
      selfKoByTechnique: selfKoBreakdown(relevant, (battle) => battle.technique || 'Not recorded', scoring),
      selfKoByPosition: selfKoBreakdown(relevant, (battle) => battle.launchPosition || 'Not recorded', scoring),
      selfKoByStadium: selfKoBreakdown(relevant, (battle) => battle.stadium || 'Not recorded', scoring)
    };
  }

  function modeledSelfKoProbability(profileOrBey, partMap) {
    const profile = profileOrBey?.metrics ? profileOrBey : engineeringProfileForBey(profileOrBey, partMap);
    const risk = clamp(Number(profile?.metrics?.selfKoRisk || 0) / 100, 0, 1);
    return clamp(0.015 + 0.22 * Math.pow(risk, 1.35), 0.01, 0.28);
  }

  function empiricalSelfKoEstimate(summary, modeledProbability = 0.08, priorStrength = 4) {
    const evidence = Math.max(0, Number(summary?.selfKoEvidence || 0));
    const events = Math.max(0, Number(summary?.ownSelfKos || 0));
    const probability = (events + priorStrength * clamp(modeledProbability, 0, 1)) / (evidence + priorStrength);
    return { probability: clamp(probability, 0, 1), evidence, events, modeledProbability: clamp(modeledProbability, 0, 1) };
  }

  function readinessAssessment({ deck, deckId, profile, partMap, inventory, battles, includeAnnounced, settings = {}, scoring = {} }) {
    const cfg = {
      minimumBattles: Number(settings.minimumBattles || 36),
      minimumPerBey: Number(settings.minimumPerBey || 10),
      minimumPerArchetype: Number(settings.minimumPerArchetype || 6),
      lowerBoundTarget: Number(settings.lowerBoundTarget || 0.50),
      maxContaminationRate: Number(settings.maxContaminationRate || 0.10),
      requireMultiPointFinish: settings.requireMultiPointFinish !== false,
      minimumSelfKoTestsPerBey: Number(settings.minimumSelfKoTestsPerBey || settings.minimumStabilityPerBey || 8),
      maxObservedSelfKoRate: Number(settings.maxObservedSelfKoRate ?? 0.15)
    };
    const legality = legalityCheck(deck, profile, partMap, { includeAnnounced });
    const capacity = inventoryCapacityCheck(deck, inventory || {}, partMap);
    const analytics = battleAnalytics({ battles, deck, deckId, scoring });
    const signatures = (deck || []).map(beySignature);
    const perBeyCounts = signatures.map((signature) => analytics.byBey[signature]?.effective || 0);
    const perBeySelfKo = signatures.map((signature) => analytics.byBey[signature] || summarizeBattles([], scoring));
    const archetypeCounts = CORE_ARCHETYPES.slice(0, 4).map((archetype) => analytics.byArchetype[archetype]?.effective || 0);
    const criticalCounts = signatures.map((signature) => analytics.multiPointWinsByBey[signature] || 0);
    const diversity = roleDiversity(deck, partMap);
    const selfKoControlPass = perBeySelfKo.every((summary) => summary.selfKoEvidence >= cfg.minimumSelfKoTestsPerBey && summary.selfKoRate <= cfg.maxObservedSelfKoRate);
    const worstSelfKo = perBeySelfKo.slice().sort((a, b) => b.selfKoRate - a.selfKoRate || b.selfKoInterval.high - a.selfKoInterval.high)[0] || summarizeBattles([], scoring);

    const gates = [
      { id: 'legal', label: 'Legal construction', pass: legality.legal, detail: legality.legal ? 'No rules blockers.' : legality.issues[0] },
      { id: 'owned', label: 'Owned-part capacity', pass: capacity.valid, detail: capacity.valid ? 'Inventory supports the deck.' : `${capacity.shortages.length} part shortage(s).` },
      { id: 'sample', label: 'Total decided battles', pass: analytics.overall.effective >= cfg.minimumBattles, detail: `${analytics.overall.effective}/${cfg.minimumBattles}` },
      { id: 'perBey', label: 'Evidence for every Bey', pass: perBeyCounts.every((count) => count >= cfg.minimumPerBey), detail: `${perBeyCounts.length ? Math.min(...perBeyCounts) : 0}/${cfg.minimumPerBey} lowest coverage` },
      { id: 'matchups', label: 'Core matchup coverage', pass: archetypeCounts.every((count) => count >= cfg.minimumPerArchetype), detail: `${archetypeCounts.length ? Math.min(...archetypeCounts) : 0}/${cfg.minimumPerArchetype} lowest coverage` },
      { id: 'confidence', label: 'Defensible win-rate floor', pass: analytics.overall.interval.low >= cfg.lowerBoundTarget, detail: `${round(analytics.overall.interval.low * 100, 1)}% lower 95% bound` },
      { id: 'execution', label: 'Launch-data quality', pass: analytics.overall.contaminationRate <= cfg.maxContaminationRate, detail: `${round(analytics.overall.contaminationRate * 100, 1)}% contaminated` },
      { id: 'selfKoControl', label: 'Self-KO check for every Bey', pass: selfKoControlPass, detail: `${perBeySelfKo.length ? Math.min(...perBeySelfKo.map((summary) => summary.selfKoEvidence)) : 0}/${cfg.minimumSelfKoTestsPerBey} lowest test count; worst rate ${round(worstSelfKo.selfKoRate * 100, 1)}%` },
      { id: 'finishRoutes', label: 'Multi-point finish evidence', pass: !cfg.requireMultiPointFinish || criticalCounts.every((count) => count >= 1), detail: cfg.requireMultiPointFinish ? `${criticalCounts.filter((count) => count > 0).length}/${signatures.length} Beys demonstrated` : 'Not required' },
      { id: 'roles', label: 'Role spread', pass: diversity.unique >= 2, detail: `${diversity.unique} distinct empirical role labels` }
    ];

    const evidenceScore = clamp((analytics.overall.effective / cfg.minimumBattles) * 20, 0, 20);
    const performanceScore = clamp(((analytics.overall.interval.low - 0.30) / 0.30) * 22, 0, 22);
    const perBeyScore = clamp(mean(perBeyCounts.map((count) => count / cfg.minimumPerBey)) * 8, 0, 8);
    const matchupScore = clamp(mean(archetypeCounts.map((count) => count / cfg.minimumPerArchetype)) * 10, 0, 10);
    const executionScore = clamp((1 - analytics.overall.contaminationRate / Math.max(cfg.maxContaminationRate * 2, 0.01)) * 7, 0, 7);
    const finishScore = clamp((criticalCounts.filter((count) => count > 0).length / Math.max(signatures.length, 1)) * 8, 0, 8);
    const roleScore = diversity.unique >= 3 ? 7 : diversity.unique === 2 ? 5 : 1;
    const selfKoQuality = mean(perBeySelfKo.map((summary) => {
      if (summary.selfKoEvidence < cfg.minimumSelfKoTestsPerBey) return clamp(summary.selfKoEvidence / cfg.minimumSelfKoTestsPerBey, 0, 1) * 0.35;
      return clamp(1 - summary.selfKoRate / Math.max(cfg.maxObservedSelfKoRate * 1.5, 0.01), 0, 1);
    }));
    const selfKoScore = clamp(selfKoQuality * 18, 0, 18);
    const excessSelfKo = Math.max(0, analytics.overall.selfKoRate - cfg.maxObservedSelfKoRate);
    const selfKoPenalty = analytics.overall.selfKoEvidence >= cfg.minimumSelfKoTestsPerBey ? clamp(5 * (excessSelfKo > 0 ? 1 : 0) + excessSelfKo / Math.max(cfg.maxObservedSelfKoRate, 0.01) * 15, 0, 20) : 0;
    let score = round(evidenceScore + performanceScore + perBeyScore + matchupScore + executionScore + finishScore + roleScore + selfKoScore - selfKoPenalty, 0);
    score = clamp(score, 0, 100);
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
      components: { evidence: round(evidenceScore), performance: round(performanceScore), perBey: round(perBeyScore), matchups: round(matchupScore), execution: round(executionScore), finishes: round(finishScore), roles: round(roleScore), selfKo: round(selfKoScore), selfKoPenalty: -round(selfKoPenalty) }
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

  function generateOwnedOpponentCandidates({ inventory, ownBey, partMap, includeAnnounced = false, avoidAttackMirrors = true, maxCandidates = 90 }) {
    if (!beyIsComplete(ownBey)) return [];
    const ownSignature = beySignature(ownBey);
    const ownBitRole = bitRoleForBey(ownBey, partMap);
    const pool = generateOwnedCandidates({ inventory, partMap, includeAnnounced, maxCandidates: Math.max(maxCandidates * 2, 120) });
    const candidates = pool.filter((candidate) => {
      if (candidate.signature === ownSignature) return false;
      if (!inventoryCapacityForBattle(ownBey, candidate.bey, inventory, partMap).valid) return false;
      if (avoidAttackMirrors && ownBitRole === 'attack' && candidate.engineering.bitRole === 'attack') return false;
      return true;
    }).map((candidate) => {
      const opponentArchetype = opponentArchetypeForBey(candidate.bey, partMap);
      const benchmarkScore = round(0.42 * candidate.engineering.roleFit + 0.28 * mean(Object.values(candidate.engineering.matchups)) + 0.18 * (100 - candidate.engineering.metrics.selfKoRisk) + 0.12 * candidate.engineering.metrics.control, 1);
      return { ...candidate, opponentArchetype, benchmarkScore, ownedCapacity: true };
    });
    const perArchetype = {};
    candidates.sort((a, b) => b.benchmarkScore - a.benchmarkScore || a.signature.localeCompare(b.signature));
    return candidates.filter((candidate) => {
      const count = perArchetype[candidate.opponentArchetype] || 0;
      if (count >= Math.max(8, Math.ceil(maxCandidates / 5))) return false;
      perArchetype[candidate.opponentArchetype] = count + 1;
      return true;
    }).slice(0, maxCandidates);
  }

  function signaturePartIds(signature) {
    const body = String(signature || '').split(':').slice(1).join(':');
    if (!body) return [];
    return body.split('|').flatMap((value) => String(value || '').split('+')).filter(Boolean);
  }

  function signatureSimilarity(left, right) {
    const a = new Set(signaturePartIds(left));
    const b = new Set(signaturePartIds(right));
    if (!a.size || !b.size) return 0;
    let intersection = 0;
    a.forEach((id) => { if (b.has(id)) intersection += 1; });
    return intersection / (a.size + b.size - intersection);
  }

  function recentDeckBattles(battles, deckId, windowSize) {
    return (battles || [])
      .filter((battle) => battle && battle.deckId === deckId && !battle.contaminated && battle.ownSignature && battle.opponentSignature)
      .slice()
      .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
      .slice(0, Math.max(1, windowSize));
  }

  function buildTestPlan({ deck, deckId, partMap, inventory = {}, includeAnnounced = false, battles, scoring, metaProfiles, settings = {}, limit = 12 }) {
    const targetPerCell = Math.max(1, Number(settings.targetPerCell || 5));
    const targetPerOpponent = Math.max(1, Number(settings.targetPerOpponent || Math.min(3, targetPerCell)));
    const avoidAttackMirrors = settings.avoidAttackMirrors !== false;
    const minimumSelfKoTestsPerBey = Math.max(1, Number(settings.minimumSelfKoTestsPerBey || settings.minimumStabilityPerBey || 8));
    const maxObservedSelfKoRate = Number(settings.maxObservedSelfKoRate ?? 0.15);
    const analytics = battleAnalytics({ battles, deck, deckId, scoring });
    const weights = metaArchetypeWeights(metaProfiles);
    const recentBattleWindow = Math.max(2, Number(settings.recentBattleWindow || 6));
    const exactPairCooldown = Math.max(1, Number(settings.exactPairCooldown || 3));
    const recent = recentDeckBattles(battles, deckId, recentBattleWindow);
    const lastBattle = recent[0] || null;
    const lastPairId = lastBattle ? `${lastBattle.ownSignature}::${lastBattle.opponentSignature}` : '';
    const tasks = [];

    (deck || []).forEach((bey, beyIndex) => {
      if (!beyIsComplete(bey)) return;
      const signature = beySignature(bey);
      const ownRole = inferBeyRole(bey, partMap);
      const ownBitRole = bitRoleForBey(bey, partMap);
      const ownEngineering = engineeringProfileForBey(bey, partMap);
      const modeledSelfKoRate = modeledSelfKoProbability(ownEngineering);
      const ownSummary = analytics.byBey[signature] || summarizeBattles([], scoring);
      const stabilityDeficit = Math.max(0, minimumSelfKoTestsPerBey - ownSummary.selfKoEvidence);
      const observedHigh = ownSummary.selfKoEvidence >= 3 && ownSummary.selfKoRate > maxObservedSelfKoRate;
      const disagreement = ownSummary.selfKoEvidence >= 3 ? Math.abs(ownSummary.selfKoRate - modeledSelfKoRate) : 0;
      const opponents = generateOwnedOpponentCandidates({ inventory, ownBey: bey, partMap, includeAnnounced, avoidAttackMirrors, maxCandidates: Number(settings.opponentPoolSize || 90) });
      opponents.forEach((opponent) => {
        const archetype = opponent.opponentArchetype;
        const archetypeSummary = analytics.byCell[`${signature}::${archetype}`] || summarizeBattles([], scoring);
        const opponentSummary = analytics.byOpponentCell[`${signature}::${opponent.signature}`] || summarizeBattles([], scoring);
        const archetypeTarget = archetype === 'left-spin' ? Math.max(2, Math.ceil(targetPerCell * 0.6)) : targetPerCell;
        const archetypeDeficit = Math.max(0, archetypeTarget - archetypeSummary.effective);
        const opponentDeficit = Math.max(0, targetPerOpponent - opponentSummary.effective);
        const stabilityBenchmark = ['stamina','defense'].includes(archetype) && opponent.engineering.bitRole !== 'attack';
        const stabilityNeed = stabilityBenchmark && (stabilityDeficit > 0 || observedHigh || disagreement >= 0.08);
        if (!archetypeDeficit && !opponentDeficit && !stabilityNeed) return;
        const uncertainty = 1 - Math.min(1, opponentSummary.effective / targetPerOpponent);
        const confidenceWidth = opponentSummary.effective ? Math.max(0, Number(opponentSummary.interval.high || 1) - Number(opponentSummary.interval.low || 0)) : 1;
        const novelty = opponentSummary.effective === 0 ? 1 : 0;
        const beyNeed = Math.max(0, Number(settings.minimumPerBey || 10) - ownSummary.effective) / Math.max(1, Number(settings.minimumPerBey || 10));
        const informationGain = clamp(0.34 * uncertainty + 0.24 * confidenceWidth + 0.18 * novelty + 0.14 * Math.min(1, archetypeDeficit / Math.max(1, archetypeTarget)) + 0.10 * Math.min(1, beyNeed), 0, 1);
        const metaWeight = weights[archetype] || (archetype === 'left-spin' ? 0.08 : 0.1);
        const benchmark = opponent.benchmarkScore / 100;
        const stabilityBoost = stabilityNeed ? Math.min(14, stabilityDeficit * 2.2 + (observedHigh ? 6 : 0) + (disagreement >= 0.08 ? 4 : 0)) : 0;
        const pairId = `${signature}::${opponent.signature}`;
        const exactRecent = recent.filter((battle) => `${battle.ownSignature}::${battle.opponentSignature}` === pairId);
        const lastExactDistance = recent.findIndex((battle) => `${battle.ownSignature}::${battle.opponentSignature}` === pairId);
        const recentOwnCount = recent.filter((battle) => battle.ownSignature === signature).length;
        const recentOpponentCount = recent.filter((battle) => battle.opponentSignature === opponent.signature).length;
        const recentPartSimilarity = recent.reduce((highest, battle) => Math.max(highest, signatureSimilarity(battle.opponentSignature, opponent.signature)), 0);
        const immediateRepeat = pairId === lastPairId;
        const cooldownPenalty = lastExactDistance < 0 ? 0 : Math.max(0, exactPairCooldown - lastExactDistance) * 4.5;
        const rotationPenalty = exactRecent.length * 5.5 + cooldownPenalty + recentOpponentCount * 2.2 + recentOwnCount * 0.8 + recentPartSimilarity * 3 + (immediateRepeat ? 16 : 0);
        const basePriority = archetypeDeficit * 2.0 + opponentDeficit * 1.8 + informationGain * 8 + metaWeight * 8 + benchmark * 1.6 + stabilityBoost;
        const priority = basePriority - rotationPenalty;
        const testType = stabilityNeed ? 'stability' : 'matchup';
        let rationale = opponentSummary.effective === 0
          ? `Untested owned benchmark; ${archetypeSummary.effective}/${archetypeTarget} ${archetype} evidence.`
          : `Adds repeat evidence against a physically constructible owned ${archetype} benchmark.`;
        if (recent.length && !exactRecent.length) rationale += ' Rotated in to avoid repeating the same recent parts.';
        if (stabilityNeed) {
          rationale = `${stabilityDeficit}/${minimumSelfKoTestsPerBey} self-KO checks remaining. Use the same controlled launch and answer Yes only when your Bey goes out by itself.`;
        }
        tasks.push({
          id: `${signature}::${opponent.signature}`,
          beyIndex,
          ownSignature: signature,
          ownName: nameForBey(bey, partMap),
          ownRole,
          ownBitRole,
          ownEngineering,
          modeledSelfKoRate,
          observedSelfKoRate: ownSummary.selfKoRate,
          observedSelfKoUpper: ownSummary.selfKoInterval.high,
          stabilityEvidence: ownSummary.selfKoEvidence,
          testType,
          launchProtocol: stabilityNeed ? 'Use the same launcher, position, and launch style. After the battle, answer the simple self-KO question.' : 'Use your planned launch and record the result, finish, and self-KO answer.',
          opponentBey: opponent.bey,
          opponentSignature: opponent.signature,
          opponentName: nameForBey(opponent.bey, partMap),
          opponentArchetype: archetype,
          opponentBitRole: opponent.engineering.bitRole,
          opponentEngineering: opponent.engineering,
          completed: opponentSummary.effective,
          archetypeCompleted: archetypeSummary.effective,
          target: targetPerOpponent,
          archetypeTarget,
          deficit: Math.max(opponentDeficit, Math.min(archetypeDeficit, targetPerOpponent), stabilityNeed ? Math.min(stabilityDeficit, targetPerOpponent) : 0),
          informationGain: round(informationGain * 100, 1),
          uncertainty: round(uncertainty * 100, 1),
          priority: round(priority, 2),
          basePriority: round(basePriority, 2),
          pairId,
          immediateRepeat,
          recentExactCount: exactRecent.length,
          lastExactDistance,
          rotationPenalty: round(rotationPenalty, 2),
          rationale
        });
      });
    });

    const selected = [];
    const selectedIds = new Set();
    const selectedOpponents = new Set();
    const selectedOwnCounts = {};
    const perOwnArchetype = {};
    tasks.sort((a, b) => b.priority - a.priority || a.completed - b.completed || a.beyIndex - b.beyIndex || a.opponentSignature.localeCompare(b.opponentSignature));

    const pick = (task) => {
      selected.push(task);
      selectedIds.add(task.id);
      selectedOpponents.add(task.opponentSignature);
      selectedOwnCounts[task.beyIndex] = (selectedOwnCounts[task.beyIndex] || 0) + 1;
      const key = `${task.beyIndex}:${task.opponentArchetype}`;
      perOwnArchetype[key] = (perOwnArchetype[key] || 0) + 1;
    };

    if (tasks.length && limit > 0) {
      const nonImmediate = tasks.filter((task) => !task.immediateRepeat);
      const differentOpponent = lastBattle ? nonImmediate.filter((task) => task.opponentSignature !== lastBattle.opponentSignature) : nonImmediate;
      pick((differentOpponent[0] || nonImmediate[0] || tasks[0]));
    }

    const stabilityBeys = unique(tasks.filter((task) => task.testType === 'stability').map((task) => task.beyIndex));
    for (const beyIndex of stabilityBeys) {
      if (selected.length >= limit || selected.some((task) => task.beyIndex === beyIndex && task.testType === 'stability')) continue;
      const choices = tasks.filter((task) => !selectedIds.has(task.id) && task.beyIndex === beyIndex && task.testType === 'stability');
      const fresh = choices.find((task) => !task.immediateRepeat && !selectedOpponents.has(task.opponentSignature));
      const task = fresh || choices.find((entry) => !entry.immediateRepeat) || choices[0];
      if (task) pick(task);
    }

    while (selected.length < limit) {
      const remaining = tasks.filter((task) => !selectedIds.has(task.id) && (perOwnArchetype[`${task.beyIndex}:${task.opponentArchetype}`] || 0) < 2);
      if (!remaining.length) break;
      const previous = selected[selected.length - 1];
      remaining.sort((a, b) => {
        const adjusted = (task) => task.priority
          - (selectedOpponents.has(task.opponentSignature) ? 5 : 0)
          - ((selectedOwnCounts[task.beyIndex] || 0) * 1.7)
          - (previous && previous.beyIndex === task.beyIndex ? 2.5 : 0)
          - (previous && previous.opponentArchetype === task.opponentArchetype ? 1.5 : 0);
        return adjusted(b) - adjusted(a) || a.completed - b.completed || a.opponentSignature.localeCompare(b.opponentSignature);
      });
      pick(remaining[0]);
    }
    return selected;
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
    const selfKoEstimates = Object.fromEntries(deck.map((bey) => {
      const signature = beySignature(bey);
      const modeled = modeledSelfKoProbability(bey, partMap);
      return [signature, empiricalSelfKoEstimate(analytics.byBey[signature], modeled)];
    }));
    let matchWins = 0;
    let simulatedSelfKos = 0;
    let simulatedBattles = 0;
    const samples = [];

    for (let simulation = 0; simulation < simulations; simulation += 1) {
      const profile = weightedChoice(profiles, (item) => item.weight, random);
      let ownPoints = 0;
      let opponentPoints = 0;
      let battleIndex = 0;
      let matchSelfKos = 0;
      while (ownPoints < targetPoints && opponentPoints < targetPoints && battleIndex < 18) {
        const position = battleIndex % 3;
        const beyIndex = selectedOrder[position];
        const signature = beySignature(deck[beyIndex]);
        const archetype = profile.lineup[position] || 'unknown';
        const cell = normalizedRelevant.filter((battle) => battle.ownSignature === signature && battle.opponentArchetype === archetype);
        let win;
        let points;
        let selfKo = false;
        if (cell.length >= 3) {
          const sampled = cell[Math.floor(random() * cell.length)];
          win = sampled.result === 'win';
          points = Math.max(1, sampled.points || 1);
          selfKo = Boolean(sampled.ownSelfKo);
        } else {
          const estimate = matchupEstimate(analytics, signature, archetype);
          const evidenceBlend = Math.min(1, cell.length / 3);
          const baseWin = clamp(estimate.mean * evidenceBlend + 0.44 * (1 - evidenceBlend), 0.25, 0.75);
          const selfKoProbability = selfKoEstimates[signature]?.probability || 0.08;
          selfKo = random() < selfKoProbability;
          if (selfKo) {
            win = false;
            points = random() < 0.58 ? 2 : 3;
          } else {
            win = random() < baseWin;
            const distribution = priorPointDistribution(inferBeyRole(deck[beyIndex], partMap));
            points = distribution[Math.floor(random() * distribution.length)];
          }
        }
        if (selfKo) { simulatedSelfKos += 1; matchSelfKos += 1; }
        simulatedBattles += 1;
        if (win) ownPoints = Math.min(targetPoints, ownPoints + points);
        else opponentPoints = Math.min(targetPoints, opponentPoints + points);
        battleIndex += 1;
      }
      const won = ownPoints >= targetPoints && ownPoints > opponentPoints;
      if (won) matchWins += 1;
      samples.push({ won, ownPoints, opponentPoints, selfKos: matchSelfKos });
    }
    const interval = wilsonInterval(matchWins, simulations);
    const selfKoInterval = wilsonInterval(simulatedSelfKos, simulatedBattles);
    return {
      available: true,
      simulations,
      matchWins,
      winRate: matchWins / simulations,
      interval,
      averagePointsFor: mean(samples.map((sample) => sample.ownPoints)),
      averagePointsAgainst: mean(samples.map((sample) => sample.opponentPoints)),
      evidenceBattles: analytics.overall.effective,
      observedSelfKoRate: analytics.overall.selfKoRate,
      observedSelfKoInterval: analytics.overall.selfKoInterval,
      simulatedSelfKoRate: simulatedBattles ? simulatedSelfKos / simulatedBattles : 0,
      simulatedSelfKoInterval: selfKoInterval,
      averageSelfKosPerMatch: mean(samples.map((sample) => sample.selfKos)),
      lowEvidence: analytics.overall.effective < 30 || analytics.overall.selfKoAnswerRate < 0.8,
      reason: analytics.overall.effective < 30 || analytics.overall.selfKoAnswerRate < 0.8
        ? 'Forecast is prior-heavy because battle count or self-KO answers are limited; sparse cells use the engineering-informed self-KO estimate.'
        : 'Forecast resamples recorded matchups and ordinary self-KO results; conservative estimates are used only for sparse matchups.'
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
      const engineering = engineeringProfileForBey(bey, partMap);
      const compatibility = roleCompatibility(topRole, bitRole, assistRole);
      const heuristic = round(engineering.roleFit / 12 + compatibility * 0.32 + mean(Object.values(engineering.matchups)) / 45 - engineering.metrics.selfKoRisk / 90, 3);
      candidates.push({ bey, signature, role: engineering.inferredRole, architecture, heuristic, engineering });
    };

    const partHeight = (part) => {
      const match = `${part?.name || ''}`.match(/-(\d{2})(?:\D|$)/);
      return match ? Number(match[1]) : 70;
    };
    const allRatchets = (byCategory.ratchet || []).slice().sort((a, b) => partHeight(a) - partHeight(b) || a.name.localeCompare(b.name));
    const heightGroups = new Map();
    allRatchets.forEach((part) => {
      const height = partHeight(part);
      if (!heightGroups.has(height)) heightGroups.set(height, []);
      heightGroups.get(height).push(part);
    });
    const ratchets = [];
    let ratchetDepth = 0;
    while (ratchets.length < Math.min(15, allRatchets.length)) {
      let added = false;
      [...heightGroups.keys()].sort((a, b) => a - b).forEach((height) => {
        const part = heightGroups.get(height)[ratchetDepth];
        if (part && ratchets.length < 15) { ratchets.push(part); added = true; }
      });
      if (!added) break;
      ratchetDepth += 1;
    }
    const bits = (byCategory.bit || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const roleBalancedParts = (parts, topRole, limit) => {
      const sorted = parts.slice().sort((a, b) => roleCompatibility(topRole, b.role, 'balance') - roleCompatibility(topRole, a.role, 'balance') || a.name.localeCompare(b.name));
      const selected = [];
      ['attack','stamina','defense','balance'].forEach((role) => {
        sorted.filter((part) => part.role === role).slice(0, 2).forEach((part) => { if (!selected.includes(part) && selected.length < limit) selected.push(part); });
      });
      sorted.forEach((part) => { if (!selected.includes(part) && selected.length < limit) selected.push(part); });
      return selected;
    };

    (byCategory.blade || []).forEach((blade, bladeIndex) => {
      const rankedBits = roleBalancedParts(bits, blade.role, 8);
      rankedBits.forEach((bit, bitIndex) => {
        const variants = Math.min(3, ratchets.length);
        for (let variant = 0; variant < variants; variant += 1) {
          const ratchet = ratchets[(bladeIndex + bitIndex * 3 + variant * 5) % ratchets.length];
          if (ratchet) push({ system: 'basic', blade: blade.id, ratchet: ratchet.id, bit: bit.id }, blade.role, bit.role, 'balance', 'basic');
        }
      });
    });
    (byCategory.ratchetIntegratedBlade || []).forEach((blade) => {
      roleBalancedParts(bits, blade.role, 10).forEach((bit) => push({ system: 'integrated', ratchetIntegratedBlade: blade.id, bit: bit.id }, blade.role, bit.role, 'balance', 'integrated'));
    });

    const locks = (byCategory.lockChip || []).slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8);
    const assists = (byCategory.assistBlade || []);
    const integratedBits = (byCategory.integratedBit || []);
    const mains = byCategory.mainBlade || [];
    mains.forEach((main, mainIndex) => {
      const rankedAssists = roleBalancedParts(assists, main.role, 5);
      const rankedBits = roleBalancedParts(bits, main.role, 6);
      rankedAssists.forEach((assist, assistIndex) => rankedBits.forEach((bit, bitIndex) => {
        const comboIndex = assistIndex * rankedBits.length + bitIndex;
        for (let variant = 0; variant < Math.min(2, ratchets.length); variant += 1) {
          const ratchet = ratchets[(mainIndex + comboIndex * 3 + variant * 7) % ratchets.length];
          const lock = locks[(mainIndex + comboIndex + variant) % locks.length];
          if (lock && ratchet) push({ system: 'custom', customArchitecture: 'main', customDrive: 'standard', lockChip: lock.id, mainBlade: main.id, assistBlade: assist.id, ratchet: ratchet.id, bit: bit.id }, main.role, bit.role, assist.role, 'custom-main');
        }
      }));
      rankedAssists.forEach((assist, assistIndex) => integratedBits.forEach((integratedBit, bitIndex) => {
        for (let variant = 0; variant < Math.min(2, locks.length); variant += 1) {
          const lock = locks[(mainIndex + assistIndex + bitIndex + variant) % locks.length];
          if (lock) push({ system: 'custom', customArchitecture: 'main', customDrive: 'integrated', lockChip: lock.id, mainBlade: main.id, assistBlade: assist.id, integratedBit: integratedBit.id }, main.role, integratedBit.role, assist.role, 'custom-main-integrated');
        }
      }));
    });

    const metals = byCategory.metalBlade || [];
    const overs = byCategory.overBlade || [];
    metals.forEach((metal, metalIndex) => overs.forEach((over, overIndex) => {
      const topRole = metal.role === over.role ? metal.role : 'balance';
      const rankedAssists = roleBalancedParts(assists, topRole, 4);
      const rankedBits = roleBalancedParts(bits, topRole, 5);
      rankedAssists.forEach((assist, assistIndex) => rankedBits.forEach((bit, bitIndex) => {
        const comboIndex = assistIndex * rankedBits.length + bitIndex;
        for (let variant = 0; variant < Math.min(2, ratchets.length); variant += 1) {
          const ratchet = ratchets[(metalIndex * 3 + overIndex * 5 + comboIndex * 2 + variant * 7) % ratchets.length];
          const lock = locks[(metalIndex + overIndex + comboIndex + variant) % locks.length];
          if (lock && ratchet) push({ system: 'custom', customArchitecture: 'expanded', customDrive: 'standard', lockChip: lock.id, metalBlade: metal.id, overBlade: over.id, assistBlade: assist.id, ratchet: ratchet.id, bit: bit.id }, topRole, bit.role, assist.role, 'custom-expanded');
        }
      }));
    }));

    const ranked = candidates.sort((a, b) => b.heuristic - a.heuristic || a.signature.localeCompare(b.signature));
    if (ranked.length <= maxCandidates) return ranked;
    const familyKey = (candidate) => candidate.bey.blade || candidate.bey.ratchetIntegratedBlade || candidate.bey.mainBlade || `${candidate.bey.metalBlade || ''}+${candidate.bey.overBlade || ''}` || candidate.signature;
    const families = new Map();
    ranked.forEach((candidate) => {
      const key = familyKey(candidate);
      if (!families.has(key)) families.set(key, []);
      families.get(key).push(candidate);
    });
    const selected = [];
    const selectedIds = new Set();
    const ratchetUse = {};
    const bitUse = {};
    const roleUse = { attack: 0, stamina: 0, defense: 0, balance: 0 };
    const take = (candidate) => {
      selected.push(candidate);
      selectedIds.add(candidate.signature);
      const ratchet = candidate.bey.ratchet || 'integrated';
      const bit = bitIdFromBey(candidate.bey) || 'none';
      ratchetUse[ratchet] = (ratchetUse[ratchet] || 0) + 1;
      bitUse[bit] = (bitUse[bit] || 0) + 1;
      roleUse[candidate.engineering.bitRole] = (roleUse[candidate.engineering.bitRole] || 0) + 1;
    };
    const adjusted = (candidate) => {
      const ratchet = candidate.bey.ratchet || 'integrated';
      const bit = bitIdFromBey(candidate.bey) || 'none';
      const role = candidate.engineering.bitRole;
      const roleDeficit = Math.max(...Object.values(roleUse)) - (roleUse[role] || 0);
      return candidate.heuristic - 0.22 * (ratchetUse[ratchet] || 0) - 0.25 * (bitUse[bit] || 0) + 0.08 * roleDeficit;
    };
    const familyOrder = [...families.entries()].sort((a, b) => b[1][0].heuristic - a[1][0].heuristic);
    familyOrder.forEach(([, family]) => {
      if (selected.length >= maxCandidates) return;
      const best = family.slice(0, 50).sort((a, b) => adjusted(b) - adjusted(a))[0];
      if (best) take(best);
    });
    while (selected.length < maxCandidates) {
      let best = null;
      let bestScore = -Infinity;
      ranked.forEach((candidate) => {
        if (selectedIds.has(candidate.signature)) return;
        const score = adjusted(candidate);
        if (score > bestScore) { best = candidate; bestScore = score; }
      });
      if (!best) break;
      take(best);
    }
    return selected;
  }

  function suggestDecks({ inventory, partMap, profile, includeAnnounced, battles = [], metaProfiles = [], settings = {}, limit = 5 }) {
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
            const engineering = engineeringDeckAssessment(deck, partMap, metaArchetypeWeights(metaProfiles));
            const candidateSummaries = selected.map((candidate) => summarizeBattles((battles || []).filter((battle) => battle.ownSignature === candidate.signature), {}));
            const evidenceBonus = sum(candidateSummaries.map((summary) => Math.min(3, summary.effective / 4) + summary.interval.low * 1.5));
            const selfKoPenalty = sum(candidateSummaries.map((summary) => {
              if (summary.selfKoEvidence < 3) return 0;
              const threshold = Number(settings.maxObservedSelfKoRate ?? 0.15);
              const excess = Math.max(0, summary.selfKoRate - threshold);
              return summary.selfKoRate * 4 + excess * 34;
            }));
            const score = engineering.score + evidenceBonus * 1.5 - selfKoPenalty;
            suggestions.push({
              deck,
              score: round(score, 2),
              roles,
              legality,
              engineering,
              note: `Physics-informed shortlist from owned parts. It maximizes the weakest modeled matchup (${engineering.weakestMatchup} ${engineering.weakestRating}/100), controls modeled and observed self-KO risk, and uses existing battle logs as a secondary signal.`
            });
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

  function productBeyCount(product, partMap = {}) {
    if (!product || typeof product !== 'object') return 0;
    if (Number.isFinite(Number(product.beyCount))) return Math.max(0, Math.floor(Number(product.beyCount)));

    const countParts = (partIds = []) => {
      const counts = {};
      partIds.forEach((id) => {
        const category = partMap[id]?.category;
        if (category) counts[category] = (counts[category] || 0) + 1;
      });
      let locks = counts.lockChip || 0;
      let assists = counts.assistBlade || 0;
      let ratchets = counts.ratchet || 0;
      let bits = counts.bit || 0;
      let mains = counts.mainBlade || 0;
      let metals = counts.metalBlade || 0;
      let overs = counts.overBlade || 0;
      let total = 0;

      const integratedCustom = Math.min(mains, locks, assists, counts.integratedBit || 0);
      total += integratedCustom; mains -= integratedCustom; locks -= integratedCustom; assists -= integratedCustom;
      const expanded = Math.min(metals, overs, locks, assists, ratchets, bits);
      total += expanded; metals -= expanded; overs -= expanded; locks -= expanded; assists -= expanded; ratchets -= expanded; bits -= expanded;
      const standardCustom = Math.min(mains, locks, assists, ratchets, bits);
      total += standardCustom; mains -= standardCustom; locks -= standardCustom; assists -= standardCustom; ratchets -= standardCustom; bits -= standardCustom;
      const integratedBlades = Math.min(counts.ratchetIntegratedBlade || 0, bits);
      total += integratedBlades; bits -= integratedBlades;
      total += Math.min(counts.blade || 0, ratchets, bits);
      return total;
    };

    if (Array.isArray(product.variants) && product.variants.length) {
      return product.variants.some((variant) => countParts(variant.parts || []) > 0) ? 1 : 0;
    }
    return countParts(product.parts || []);
  }

  const BEY_PART_CATEGORIES = new Set(['blade','ratchetIntegratedBlade','lockChip','metalBlade','overBlade','mainBlade','assistBlade','ratchet','bit','integratedBit']);

  function productBeyPartIds(product, partMap = {}) {
    if (!product || typeof product !== 'object') return [];
    const references = [...(product.parts || []), ...(product.variants || []).flatMap((variant) => variant.parts || [])];
    return references.filter((id) => BEY_PART_CATEGORIES.has(partMap[id]?.category));
  }

  function productBeyPartCount(product, partMap = {}) {
    return productBeyPartIds(product, partMap).length;
  }

  function productContainsBey(product, partMap = {}) {
    return productBeyCount(product, partMap) > 0;
  }

  function productContainsBeyParts(product, partMap = {}) {
    return productContainsBey(product, partMap) || productBeyPartCount(product, partMap) > 0;
  }

  function dataQualityAudit(data) {
    const issues = [];
    const warnings = [];
    const ids = new Set();
    const products = data.products || [];
    const productIds = new Set();
    (data.parts || []).forEach((part) => {
      if (!part.id || !part.name || !part.category) issues.push('A catalog part is missing id, name, or category.');
      if (ids.has(part.id)) issues.push(`Duplicate part ID: ${part.id}`);
      ids.add(part.id);
      if (!['attack','stamina','defense','balance'].includes(part.role)) warnings.push(`${part.id} has an unrecognized role.`);
      if (part.engineering && Object.values(part.engineering).some((value) => !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1)) issues.push(`${part.id} has an engineering override outside 0–1.`);
      if (part.status === 'announced' && !part.notes) warnings.push(`${part.id} is announced without a release note.`);
    });
    const map = Object.fromEntries((data.parts || []).map((part) => [part.id, part]));
    products.forEach((product) => {
      if (!product.id || !product.name || !product.releaseDate) issues.push('A catalog product is missing id, name, or release date.');
      if (productIds.has(product.id)) issues.push(`Duplicate product ID: ${product.id}`);
      productIds.add(product.id);
      const references = [...(product.parts || []), ...(product.variants || []).flatMap((variant) => variant.parts || [])];
      references.forEach((id) => { if (!ids.has(id)) issues.push(`${product.id} references missing part ${id}.`); });
      if (!productContainsBeyParts(product, map)) issues.push(`${product.id} does not contain any Beyblade performance part and must not appear in the release library.`);
      if (product.status === 'released' && product.releaseDate > data.meta?.verifiedThrough) issues.push(`${product.id} is marked released after the catalog verification date.`);
      if (product.status === 'announced' && product.releaseDate <= data.meta?.verifiedThrough) warnings.push(`${product.id} is still marked announced on or before the verification date.`);
    });
    return { pass: issues.length === 0, issues: unique(issues), warnings: unique(warnings), counts: { parts: data.parts?.length || 0, products: products.length, profiles: Object.keys(data.profiles || {}).length } };
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
    if (Array.isArray(raw.decks)) {
      return {
        ...raw,
        schemaVersion: SCHEMA_VERSION,
        decks: raw.decks.map((deck) => ({ ...deck, beys: Array.isArray(deck.beys) ? deck.beys : [] })),
        inventory: raw.inventory && typeof raw.inventory === 'object' ? raw.inventory : {},
        ownedProducts: raw.ownedProducts && typeof raw.ownedProducts === 'object' ? raw.ownedProducts : {},
        battles: Array.isArray(raw.battles) ? raw.battles.map((battle) => normalizeBattle(battle, {})) : [],
        metaProfiles: Array.isArray(raw.metaProfiles) ? raw.metaProfiles : [],
        customProfiles: Array.isArray(raw.customProfiles) ? raw.customProfiles : [],
        customParts: Array.isArray(raw.customParts) ? raw.customParts : [],
        settings: (() => {
          const settings = { ...(raw.settings || {}) };
          if (settings.minimumSelfKoTestsPerBey == null && settings.minimumStabilityPerBey != null) settings.minimumSelfKoTestsPerBey = settings.minimumStabilityPerBey;
          delete settings.minimumFinishCauseCoverage;
          delete settings.minimumStabilityPerBey;
          delete settings.maxSelfKoUpperBound;
          if (settings.showGuide == null) settings.showGuide = true;
          if (!['player','advanced'].includes(settings.experienceMode)) settings.experienceMode = 'player';
          return settings;
        })(),
        updatedAt: raw.updatedAt || now
      };
    }
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
      contaminated: Boolean(battle.contaminated || battle.launchError),
      finishCause: normalizeBattle(battle, {}).finishCause,
      selfKo: normalizeBattle(battle, {}).selfKo,
      selfKoKnown: normalizeBattle(battle, {}).selfKoKnown,
      selfKoSide: normalizeBattle(battle, {}).selfKoSide
    }));
    return {
      schemaVersion: SCHEMA_VERSION,
      migratedFrom: Number(raw.version || raw.schemaVersion || 1),
      inventory,
      ownedProducts: raw.ownedProducts && typeof raw.ownedProducts === 'object' ? raw.ownedProducts : {},
      customParts: Array.isArray(raw.customParts) ? raw.customParts : [],
      decks: [{ id: deckId, name: 'Migrated Tournament Deck', profileId: raw.profileId || 'tt3on3', includeAnnounced: Boolean(raw.includeAnnounced), beys: deck, notes: '', tags: [], createdAt: now, updatedAt: now }],
      activeDeckId: deckId,
      battles: migratedBattles,
      metaProfiles: [],
      customProfiles: [],
      settings: { minimumSelfKoTestsPerBey: 8, maxObservedSelfKoRate: 0.15, showGuide: true, experienceMode: 'player' },
      createdAt: now,
      updatedAt: now
    };
  }

  const api = {
    SCHEMA_VERSION,
    ENGINEERING_MODEL_VERSION,
    PART_SLOTS,
    CORE_ARCHETYPES,
    OWN_SELF_KO_CAUSES,
    SELF_KO_CAUSES,
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
    inventoryCapacityForBattle,
    legalityCheck,
    inferBeyRole,
    roleDiversity,
    bitIdFromBey,
    bitRoleForBey,
    isLeftSpinBey,
    ratchetHeightForBey,
    engineeringProfileForBey,
    engineeringRoleFit,
    engineeringMatchupRatings,
    engineeringDeckAssessment,
    opponentArchetypeForBey,
    relevantBattlesForDeck,
    defaultFinishCause,
    normalizeBattle,
    summarizeBattles,
    selfKoBreakdown,
    battleAnalytics,
    modeledSelfKoProbability,
    empiricalSelfKoEstimate,
    readinessAssessment,
    metaArchetypeWeights,
    buildTestPlan,
    generateOwnedOpponentCandidates,
    permutations,
    matchupEstimate,
    optimizeDeckOrder,
    forecastTournament,
    generateOwnedCandidates,
    suggestDecks,
    productBeyCount,
    productBeyPartIds,
    productBeyPartCount,
    productContainsBey,
    productContainsBeyParts,
    dataQualityAudit,
    fnv1a,
    migrateState
  };

  root.XCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
