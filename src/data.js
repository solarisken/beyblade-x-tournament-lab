export const DATA_VERSION = "2026.07.17-v3";
export const APP_NAME = "X Deck Lab V3";

export const officialRules = {
  id: "tt-regulation-12-3on3",
  name: "Takara Tomy Regulation 12 · 3-on-3",
  effectiveDate: "2026-03-13",
  targetPoints: 4,
  finishPoints: { spin: 1, over: 2, burst: 2, xtreme: 3 },
  duplicateCanonicalParts: false,
  cycleLength: 3,
  reorderAfterCycle: true,
  bulletMainBodyDecidesFinish: true,
  notes: [
    "Same-name parts cannot be repeated in one 3-on-3 deck, even when colors differ.",
    "After three battles without a match winner, both players rebuild the battle order.",
    "A detached Bullet from BulletGriffon does not determine the finish; the main body does."
  ]
};

export const defaultSettings = {
  autopilot: true,
  searchMode: "fast",
  fastBreadth: 210,
  shortlistSize: 24,
  labMatches: 12000,
  testBatchSize: 4,
  evidenceThreshold: 24,
  riskTolerance: 42,
  conservativeWeight: 82,
  criticalFloorWeight: 88,
  backupCoverageWeight: 92,
  seed: 20260717
};

// The confirmed owned-products collection is authoritative for this build.
export const products = [
  { code: "UX-14", name: "ScorpioSpear 0-70Z", owned: 1, contributes: ["ScorpioSpear", "0-70", "Zap"] },
  { code: "CX-16", name: "BahamutBlitz BK1-50I · Special Color", owned: 1, contributes: ["Bahamut Lock", "Break Over", "Blitz Metal", "Knuckle Assist", "1-50", "Ignition"], note: "Same functional configuration as CX-13; color differs." },
  { code: "UX-19", name: "BulletGriffon H", owned: 1, contributes: ["BulletGriffon · integrated ratchet", "Hexa"], note: "No separate ratchet can be installed." },
  { code: "UX-08", name: "SilverWolf 3-80FB", owned: 1, contributes: ["SilverWolf", "3-80", "Free Ball"] },
  { code: "CX-09", name: "SolEclipse D5-70TK", owned: 1, contributes: ["Sol Lock", "Eclipse Main", "Dual Assist", "5-70", "Trans Kick"] },
  { code: "CX-10", name: "WolfHunt F0-60DB", owned: 1, contributes: ["Wolf Lock", "Hunt Main", "Free Assist", "0-60", "Disc Ball"] },
  { code: "BX-23", name: "PhoenixWing 9-60GF", owned: 1, contributes: ["PhoenixWing", "9-60 copy A", "Gear Flat"] },
  { code: "UX-11", name: "ImpactDrake 9-60LR", owned: 1, contributes: ["ImpactDrake", "9-60 copy B", "Low Rush"], note: "Second physical 9-60 copy cannot be paired with the other 9-60 in official 3-on-3." },
  { code: "BX-49", name: "DranStrike 4-50FF", owned: 1, contributes: ["DranStrike", "4-50", "Free Flat"] }
];

// Qualitative mechanistic signals only. They are not official statistics and are never shown as measured win rates.
// Dimensions: pressure, endurance, defense, control, burstResistance, recoil, criticalAccess, mass, destabilize.
const q = (pressure, endurance, defense, control, burstResistance, recoil, criticalAccess, mass, destabilize) =>
  ({ pressure, endurance, defense, control, burstResistance, recoil, criticalAccess, mass, destabilize });

export const fixedBlades = [
  { id: "scorpio-spear", name: "ScorpioSpear", source: "UX-14", system: "UX", type: "balance", traits: q(.45,.18,.32,.28,.30,.30,.48,-.05,.42), tags: ["counter", "shape-change"] },
  { id: "bullet-griffon", name: "BulletGriffon", source: "UX-19", system: "UX-expand", type: "balance", integratedRatchet: true, traits: q(.18,.55,.72,.34,.62,.06,.38,.92,.12), tags: ["separation", "main-body-finish"] },
  { id: "silver-wolf", name: "SilverWolf", source: "UX-08", system: "UX", type: "stamina", traits: q(-.25,.92,.50,.70,.38,-.38,-.18,.08,.15), tags: ["free-spin", "endurance"] },
  { id: "phoenix-wing", name: "PhoenixWing", source: "BX-23", system: "BX", type: "attack", traits: q(.78,-.05,.08,.22,.10,.62,.78,.08,.30), tags: ["smash", "recoil"] },
  { id: "impact-drake", name: "ImpactDrake", source: "UX-11", system: "UX", type: "attack", traits: q(.88,-.28,-.02,.20,.14,.58,.88,.18,.40), tags: ["rubber-contact", "attack"] },
  { id: "dran-strike", name: "DranStrike", source: "BX-49", system: "BX-expand", type: "attack", traits: q(.82,-.08,.16,.48,.34,.36,.82,.22,.44), tags: ["repeat-hit", "controlled-attack"] }
];

export const cxParts = {
  locks: [
    { id: "sol", name: "Sol", source: "CX-09", resource: "lock:sol", duplicateException: true, traits: q(.06,.03,.03,.04,.04,.02,.05,.01,.02) },
    { id: "wolf", name: "Wolf", source: "CX-10", resource: "lock:wolf", duplicateException: true, traits: q(-.02,.10,.12,.10,.08,-.03,-.01,.02,.03) },
    { id: "bahamut", name: "Bahamut", source: "CX-16", resource: "lock:bahamut", duplicateException: true, traits: q(.10,-.02,.02,.00,.04,.08,.10,.03,.06) }
  ],
  standardMains: [
    { id: "eclipse", name: "Eclipse", source: "CX-09", resource: "main:eclipse", type: "balance", traits: q(.30,.22,.12,.14,.06,.18,.32,.05,.18), tags: ["dual-mode"] },
    { id: "hunt", name: "Hunt", source: "CX-10", resource: "main:hunt", type: "balance", traits: q(.12,.42,.30,.32,.10,-.08,.14,.07,.08), tags: ["free-spin"] }
  ],
  overBlades: [
    { id: "break", name: "Break", source: "CX-16", resource: "over:break", traits: q(.28,-.08,-.04,-.02,.02,.24,.30,.04,.20) }
  ],
  metalBlades: [
    { id: "blitz", name: "Blitz", source: "CX-16", resource: "metal:blitz", type: "attack", traits: q(.54,-.24,-.06,-.08,.08,.42,.58,.20,.30), tags: ["offset-heavy-hit"] }
  ],
  assists: [
    { id: "dual", name: "Dual", source: "CX-09", resource: "assist:dual", traits: q(.20,-.03,-.02,-.03,.02,.16,.22,.03,.10) },
    { id: "free", name: "Free", source: "CX-10", resource: "assist:free", traits: q(-.04,.18,.22,.18,.06,-.14,-.03,.03,.04) },
    { id: "knuckle", name: "Knuckle", source: "CX-16", resource: "assist:knuckle", traits: q(.16,-.05,.04,.02,.08,.08,.18,.05,.14) }
  ]
};

export const ratchets = [
  { id: "0-70", canonical: "0-70", name: "0-70", source: "UX-14", ownedCopies: 1, height: 70, resource: "ratchet:0-70", traits: q(.03,.00,.04,.00,.04,.00,.04,.00,.03) },
  { id: "1-50", canonical: "1-50", name: "1-50", source: "CX-16", ownedCopies: 1, height: 50, resource: "ratchet:1-50", traits: q(.16,-.09,-.06,-.02,.12,.10,.18,.00,.14) },
  { id: "3-80", canonical: "3-80", name: "3-80", source: "UX-08", ownedCopies: 1, height: 80, resource: "ratchet:3-80", traits: q(-.06,.10,.04,.04,-.14,.06,-.03,.01,-.04) },
  { id: "5-70", canonical: "5-70", name: "5-70", source: "CX-09", ownedCopies: 1, height: 70, resource: "ratchet:5-70", traits: q(.00,.08,.10,.08,.08,-.03,.01,.02,.02) },
  { id: "0-60", canonical: "0-60", name: "0-60", source: "CX-10", ownedCopies: 1, height: 60, resource: "ratchet:0-60", traits: q(.07,.06,.12,.08,.10,-.04,.08,.02,.08) },
  { id: "9-60", canonical: "9-60", name: "9-60", source: "BX-23 + UX-11", ownedCopies: 2, height: 60, resource: "ratchet:9-60", traits: q(.07,.09,.13,.10,.16,-.06,.08,.03,.06), note: "Two physical copies owned; official 3-on-3 still permits only one 9-60 in the deck." },
  { id: "4-50", canonical: "4-50", name: "4-50", source: "BX-49", ownedCopies: 1, height: 50, resource: "ratchet:4-50", traits: q(.13,-.07,-.01,.04,.12,.06,.14,.00,.12) }
];

export const bits = [
  { id: "zap", canonical: "Zap", name: "Zap", code: "Z", source: "UX-14", resource: "bit:zap", type: "balance", traits: q(.16,.00,.08,.12,.08,.06,.18,.00,.10) },
  { id: "ignition", canonical: "Ignition", name: "Ignition", code: "I", source: "CX-16", resource: "bit:ignition", type: "attack", traits: q(.40,-.28,-.12,-.18,.08,.26,.44,.00,.22), lowHeight: true },
  { id: "hexa", canonical: "Hexa", name: "Hexa", code: "H", source: "UX-19", resource: "bit:hexa", type: "balance", traits: q(-.01,.12,.30,.24,.30,-.16,.02,.00,.02) },
  { id: "free-ball", canonical: "Free Ball", name: "Free Ball", code: "FB", source: "UX-08", resource: "bit:free-ball", type: "stamina", traits: q(-.22,.43,.14,.30,.06,-.22,-.17,.00,-.03) },
  { id: "trans-kick", canonical: "Trans Kick", name: "Trans Kick", code: "TK", source: "CX-09", resource: "bit:trans-kick", type: "balance", traits: q(.14,.10,.03,.08,.06,.08,.16,.00,.08) },
  { id: "disc-ball", canonical: "Disc Ball", name: "Disc Ball", code: "DB", source: "CX-10", resource: "bit:disc-ball", type: "stamina", traits: q(-.20,.40,.20,.26,.06,-.20,-.14,.00,-.02) },
  { id: "gear-flat", canonical: "Gear Flat", name: "Gear Flat", code: "GF", source: "BX-23", resource: "bit:gear-flat", type: "attack", traits: q(.36,-.32,-.16,-.24,.04,.32,.40,.00,.20) },
  { id: "low-rush", canonical: "Low Rush", name: "Low Rush", code: "LR", source: "UX-11", resource: "bit:low-rush", type: "attack", traits: q(.34,-.18,-.04,.20,.14,.13,.38,.00,.20), lowHeight: true },
  { id: "free-flat", canonical: "Free Flat", name: "Free Flat", code: "FF", source: "BX-49", resource: "bit:free-flat", type: "attack", traits: q(.27,-.06,.01,.30,.12,.02,.29,.00,.16) }
];

export const archetypes = [
  { id: "heavy-attack", name: "Heavy smash attack", weight: .24, opponentLineup: ["heavy-attack", "balance", "stamina"] },
  { id: "low-attack", name: "Low destabilizer", weight: .19, opponentLineup: ["low-attack", "heavy-attack", "balance"] },
  { id: "stamina", name: "Pure stamina", weight: .24, opponentLineup: ["stamina", "defense", "balance"] },
  { id: "defense", name: "Defense / counter", weight: .16, opponentLineup: ["defense", "stamina", "balance"] },
  { id: "balance", name: "Adaptive balance", weight: .17, opponentLineup: ["balance", "heavy-attack", "stamina"] }
];

export const launchProfiles = [
  { id: "level-hard", name: "Level · hard" },
  { id: "level-controlled", name: "Level · controlled" },
  { id: "light-bank", name: "Light bank" },
  { id: "deep-bank", name: "Deep bank" },
  { id: "counter-tilt", name: "Counter-tilt" },
  { id: "weak-launch", name: "Weak launch" }
];

export const stadiumProfiles = [
  { id: "xtreme", name: "Takara Tomy Xtreme Stadium" },
  { id: "wide", name: "Wide Xtreme Stadium" },
  { id: "infinity", name: "Infinity Stadium" }
];
