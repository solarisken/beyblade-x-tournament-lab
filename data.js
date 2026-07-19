(function (root) {
  'use strict';

  const part = (id, name, category, extra = {}) => ({
    id,
    name,
    category,
    line: extra.line || 'Basic/Unique',
    status: extra.status || 'released',
    role: extra.role || 'balance',
    code: extra.code || '',
    source: extra.source || 'catalog',
    notes: extra.notes || ''
  });

  const data = {
    meta: {
      appName: 'X Deck Lab',
      version: '2.0.0',
      verifiedThrough: '2026-07-19',
      schemaVersion: 3,
      rulesVersion: 'Takara Tomy Regulation v12 / WBO rules checked 2026-07-19',
      catalogPolicy: 'Released parts are enabled by default. Announced parts remain opt-in until their release date is reached and the catalog is reverified.',
      disclaimer: 'Independent empirical tournament-preparation tool. It does not simulate physics or guarantee tournament outcomes.'
    },

    categories: [
      { id: 'blade', label: 'Blade' },
      { id: 'ratchetIntegratedBlade', label: 'Ratchet-integrated blade' },
      { id: 'lockChip', label: 'Lock chip' },
      { id: 'metalBlade', label: 'Metal blade' },
      { id: 'overBlade', label: 'Over blade' },
      { id: 'mainBlade', label: 'Main blade' },
      { id: 'assistBlade', label: 'Assist blade' },
      { id: 'ratchet', label: 'Ratchet' },
      { id: 'bit', label: 'Bit' },
      { id: 'integratedBit', label: 'Ratchet-integrated bit' }
    ],

    profiles: {
      tt3on3: {
        id: 'tt3on3',
        name: 'Takara Tomy 3on3 — Regulation v12',
        targetPoints: 4,
        deckSize: 3,
        noDuplicateParts: true,
        lockChipPolicy: 'tt-v12',
        bannedParts: [],
        notes: 'Official scoring. In Custom Line, ordinary lock chips may repeat; Valkyrie and Emperor are limited to one each.'
      },
      wbo3on3: {
        id: 'wbo3on3',
        name: 'WBO 3on3 — standard profile',
        targetPoints: 4,
        deckSize: 3,
        noDuplicateParts: true,
        lockChipPolicy: 'no-duplicates',
        bannedParts: ['bit-metal-needle'],
        notes: 'Conservative default profile. Event organizers may publish additional clauses; verify the event page.'
      },
      wbocounter: {
        id: 'wbocounter',
        name: 'WBO Counter Battle — standard profile',
        targetPoints: 4,
        deckSize: 3,
        noDuplicateParts: true,
        lockChipPolicy: 'no-duplicates',
        bannedParts: ['bit-metal-needle'],
        notes: 'Counter Battle selection mechanics vary by event. This profile checks deck construction only.'
      },
      custom: {
        id: 'custom',
        name: 'Custom testing profile',
        targetPoints: 4,
        deckSize: 3,
        noDuplicateParts: false,
        lockChipPolicy: 'allow',
        bannedParts: [],
        notes: 'Use for lab work only. Customize assumptions in the exported JSON.'
      }
    },

    scoring: {
      spin: 1,
      over: 2,
      burst: 2,
      xtreme: 3,
      draw: 0,
      relaunch: 0
    },

    stadiums: [
      'Xtreme Stadium',
      'Wide Xtreme Stadium',
      'Infinity Stadium',
      'Double Xtreme Stadium',
      'Hasbro Xtreme Beystadium',
      'Other / custom'
    ],

    archetypes: [
      { id: 'attack', name: 'Attack', description: 'High contact pressure, Xtreme/Over threat, variable self-KO exposure.' },
      { id: 'stamina', name: 'Stamina', description: 'Spin-time and life-after-death pressure; often punishes low consistency.' },
      { id: 'defense', name: 'Defense', description: 'KO resistance and controlled movement; may trade spin endurance.' },
      { id: 'balance', name: 'Balance', description: 'Mixed win conditions and adaptable launch patterns.' },
      { id: 'left-spin', name: 'Left-spin', description: 'Opposite-spin interactions and specialized matchup behavior.' },
      { id: 'unknown', name: 'Unknown / field', description: 'Use when the opponent is not classified.' }
    ],

    testDefaults: {
      minimumBattles: 36,
      minimumPerBey: 10,
      minimumPerArchetype: 6,
      targetPerCell: 5,
      lowerBoundTarget: 0.50,
      maxContaminationRate: 0.10,
      requireMultiPointFinish: true,
      avoidAttackMirrors: true,
      candidatePool: 36
    },

    launchPositions: ['Left position', 'Right position', 'Center position', 'Not recorded'],
    launchTechniques: ['Flat launch', 'Banked launch', 'Tilt launch', 'Weak launch', 'Hard launch', 'Controlled launch', 'Other / not recorded'],
    conditions: [
      { id: 'new', name: 'New / near-new' },
      { id: 'good', name: 'Good' },
      { id: 'worn', name: 'Worn but tournament-legal' },
      { id: 'verify', name: 'Needs legality or wear verification' }
    ],
    defaultMetaProfiles: [
      { id: 'meta-balanced', name: 'Balanced field', weight: 1, lineup: ['attack','stamina','defense'] },
      { id: 'meta-stamina-core', name: 'Stamina-heavy field', weight: 0.7, lineup: ['stamina','balance','attack'] },
      { id: 'meta-pressure', name: 'Attack-pressure field', weight: 0.5, lineup: ['attack','balance','stamina'] }
    ],

    officialLinks: {
      regulation: 'https://beyblade.takaratomy.co.jp/beyblade-x/_image/regulation.pdf',
      lineup: 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/',
      wboRules: 'https://worldbeyblade.org/Thread-Beyblade-X-Rules'
    },

    parts: [
      // Basic Line and X-Over blades
      part('blade-black-shell', 'BlackShell', 'blade', { role: 'defense' }),
      part('blade-cobalt-dragoon', 'CobaltDragoon', 'blade', { role: 'attack', notes: 'Left-spin blade.' }),
      part('blade-cobalt-drake', 'CobaltDrake', 'blade', { role: 'attack' }),
      part('blade-crimson-garuda', 'CrimsonGaruda', 'blade', { role: 'balance' }),
      part('blade-dran-dagger', 'DranDagger', 'blade', { role: 'attack' }),
      part('blade-dran-strike', 'DranStrike', 'blade', { role: 'attack' }),
      part('blade-dran-sword', 'DranSword', 'blade', { role: 'attack' }),
      part('blade-hells-chain', 'HellsChain', 'blade', { role: 'balance' }),
      part('blade-heavens-ring', 'HeavensRing', 'blade', { role: 'stamina', notes: 'Prize blade in BX-50 Random Booster Vol.11.' }),
      part('blade-hells-scythe', 'HellsScythe', 'blade', { role: 'stamina' }),
      part('blade-knight-lance', 'KnightLance', 'blade', { role: 'defense' }),
      part('blade-knight-shield', 'KnightShield', 'blade', { role: 'defense' }),
      part('blade-leon-claw', 'LeonClaw', 'blade', { role: 'balance' }),
      part('blade-phoenix-feather', 'PhoenixFeather', 'blade', { role: 'attack' }),
      part('blade-phoenix-wing', 'PhoenixWing', 'blade', { role: 'attack' }),
      part('blade-rhino-horn', 'RhinoHorn', 'blade', { role: 'defense' }),
      part('blade-samurai-calibur', 'SamuraiCalibur', 'blade', { role: 'attack' }),
      part('blade-shark-edge', 'SharkEdge', 'blade', { role: 'attack' }),
      part('blade-shelter-drake', 'ShelterDrake', 'blade', { role: 'defense' }),
      part('blade-sphinx-cowl', 'SphinxCowl', 'blade', { role: 'defense' }),
      part('blade-tricera-press', 'TriceraPress', 'blade', { role: 'defense' }),
      part('blade-unicorn-sting', 'UnicornSting', 'blade', { role: 'balance' }),
      part('blade-viper-tail', 'ViperTail', 'blade', { role: 'balance' }),
      part('blade-weiss-tiger', 'WeissTiger', 'blade', { role: 'attack' }),
      part('blade-whale-wave', 'WhaleWave', 'blade', { role: 'attack' }),
      part('blade-wizard-arrow', 'WizardArrow', 'blade', { role: 'stamina' }),
      part('blade-wyvern-gale', 'WyvernGale', 'blade', { role: 'stamina' }),
      part('blade-dragoon-storm', 'DragoonStorm', 'blade', { role: 'attack', notes: 'Left-spin X-Over blade.' }),
      part('blade-draciel-shield', 'DracielShield', 'blade', { role: 'defense' }),
      part('blade-dranzer-spiral', 'DranzerSpiral', 'blade', { role: 'balance' }),
      part('blade-driger-slash', 'DrigerSlash', 'blade', { role: 'attack' }),
      part('blade-lightning-l-drago-upper', 'Lightning L-Drago (Upper Type)', 'blade', { role: 'attack', notes: 'Left-spin X-Over blade.' }),
      part('blade-lightning-l-drago-rapid', 'Lightning L-Drago (Rapid-Hit Type)', 'blade', { role: 'attack', notes: 'Left-spin X-Over blade.' }),
      part('blade-rock-leone', 'RockLeone', 'blade', { role: 'defense' }),
      part('blade-storm-pegasis', 'StormPegasis', 'blade', { role: 'attack' }),
      part('blade-storm-spriggan', 'StormSpriggan', 'blade', { role: 'balance' }),
      part('blade-victory-valkyrie', 'VictoryValkyrie', 'blade', { role: 'attack' }),
      part('blade-xeno-xcalibur', 'XenoXcalibur', 'blade', { role: 'attack' }),

      // Unique Line blades
      part('blade-aero-pegasus', 'AeroPegasus', 'blade', { line: 'Unique', role: 'attack' }),
      part('blade-clock-mirage', 'ClockMirage', 'blade', { line: 'Unique', role: 'stamina' }),
      part('blade-dran-buster', 'DranBuster', 'blade', { line: 'Unique', role: 'attack' }),
      part('blade-ghost-circle', 'GhostCircle', 'blade', { line: 'Unique', role: 'stamina' }),
      part('blade-golem-rock', 'GolemRock', 'blade', { line: 'Unique', role: 'defense' }),
      part('blade-hells-hammer', 'HellsHammer', 'blade', { line: 'Unique', role: 'balance' }),
      part('blade-impact-drake', 'ImpactDrake', 'blade', { line: 'Unique', role: 'attack' }),
      part('blade-knight-mail', 'KnightMail', 'blade', { line: 'Unique', role: 'defense' }),
      part('blade-leon-crest', 'LeonCrest', 'blade', { line: 'Unique', role: 'defense' }),
      part('blade-meteor-dragoon', 'MeteorDragoon', 'blade', { line: 'Unique', role: 'attack', notes: 'Left-spin blade.' }),
      part('blade-mummy-curse', 'MummyCurse', 'blade', { line: 'Unique', role: 'defense' }),
      part('blade-orochi-cluster', 'OrochiCluster', 'blade', { line: 'Unique', role: 'stamina' }),
      part('blade-phoenix-rudder', 'PhoenixRudder', 'blade', { line: 'Unique', role: 'balance' }),
      part('blade-samurai-saber', 'SamuraiSaber', 'blade', { line: 'Unique', role: 'attack' }),
      part('blade-scorpio-spear', 'ScorpioSpear', 'blade', { line: 'Unique', role: 'attack' }),
      part('blade-shark-scale', 'SharkScale', 'blade', { line: 'Unique', role: 'attack' }),
      part('blade-shinobi-shadow', 'ShinobiShadow', 'blade', { line: 'Unique', role: 'defense' }),
      part('blade-silver-wolf', 'SilverWolf', 'blade', { line: 'Unique', role: 'stamina' }),
      part('blade-wizard-rod', 'WizardRod', 'blade', { line: 'Unique', role: 'stamina' }),

      // Ratchet-integrated blades
      part('rib-bullet-griffon', 'BulletGriffon', 'ratchetIntegratedBlade', { line: 'Unique', role: 'balance', code: 'H', notes: 'Ratchet is integrated into the blade. Use a bit only.' }),
      part('rib-glory-valkyrie', 'GloryValkyrie', 'ratchetIntegratedBlade', { line: 'Unique', role: 'attack', code: 'LF', notes: 'Released 2026-07-11. Ratchet is integrated into the blade.' }),
      part('rib-hells-nether', 'HellsNether', 'ratchetIntegratedBlade', { line: 'Unique', role: 'balance', code: 'Z', status: 'announced', notes: 'Announced for 2026-08-08; excluded by default.' }),

      // Custom Line lock chips
      ...[
        ['bahamut','Bahamut'],['brachio','Brachio'],['cerberus','Cerberus'],['drake','Drake'],['dran','Dran'],
        ['eva','Eva'],['fox','Fox'],['hells','Hells'],['hornet','Hornet'],['knight','Knight'],['kraken','Kraken'],
        ['leon','Leon'],['emperor','Emperor'],['pegasus','Pegasus'],['perseus','Perseus'],['phoenix','Phoenix'],
        ['ragna','Ragna'],['rhino','Rhino'],['sol','Sol'],['bucks','Bucks'],['unicorn','Unicorn'],['valkyrie','Valkyrie'],
        ['whale','Whale'],['wolf','Wolf'],['wizard','Wizard']
      ].map(([id,name]) => part(`lock-${id}`, name, 'lockChip', { line: 'Custom', role: 'balance' })),

      // Custom Line main blades
      ...[
        ['antlers','Antlers','defense'],['arc','Arc','stamina'],['blast','Blast','attack'],['brave','Brave','attack'],
        ['brush','Brush','balance'],['dark','Dark','defense'],['eclipse','Eclipse','balance'],['fang','Fang','attack'],
        ['flame','Flame','attack'],['flare','Flare','attack'],['fort','Fort','defense'],['hunt','Hunt','balance'],
        ['might','Might','attack'],['reaper','Reaper','attack'],['volt','Volt','attack'],['wriggle','Wriggle','stamina']
      ].map(([id,name,role]) => part(`main-${id}`, name, 'mainBlade', { line: 'Custom', role })),

      // Custom Line expanded architecture: Metal Blade + Over Blade + Assist Blade.
      ...[
        ['blitz','Blitz','attack'],['delta','Delta','balance'],['fortress','Fortress','defense'],
        ['rage','Rage','stamina'],['whip','Whip','attack']
      ].map(([id,name,role]) => part(`metal-${id}`, name, 'metalBlade', { line: 'Custom Expanded', role })),
      ...[
        ['break','B','Break','attack'],['flow','F','Flow','stamina'],['guard','G','Guard','defense'],
        ['outer','O','Outer','balance'],['peak','P','Peak','attack']
      ].map(([id,code,name,role]) => part(`over-${id}`, name, 'overBlade', { line: 'Custom Expanded', role, code })),

      // Current Custom Line assist blade names, not single letters
      ...[
        ['assault','A','Assault','attack'],['bumper','B','Bumper','defense'],['charge','C','Charge','attack'],
        ['dual','D','Dual','balance'],['erase','E','Erase','defense'],['free','F','Free','stamina'],
        ['gravity','G','Gravity','stamina'],['heavy','H','Heavy','defense'],['jaggy','J','Jaggy','attack'],
        ['knuckle','K','Knuckle','attack'],['massive','M','Massive','defense'],['odd','O','Odd','balance'],
        ['round','R','Round','defense'],['slash','S','Slash','attack'],['turn','T','Turn','balance'],
        ['vertical','V','Vertical','defense'],['wheel','W','Wheel','stamina'],['zillion','Z','Zillion','balance']
      ].map(([id,code,name,role]) => part(`assist-${id}`, name, 'assistBlade', { line: 'Custom', role, code })),

      // Ratchets: released through July 2026 core catalog
      ...[
        '0-60','0-70','0-80','1-50','1-60','1-80','2-60','2-70','2-80','3-60','3-70','3-80','3-85',
        '4-50','4-55','4-60','4-70','4-80','5-60','5-70','5-80','6-60','6-70','6-80','7-55','7-60',
        '7-70','7-80','8-70','9-60','9-65','9-70','9-80','M-85'
      ].map(name => part(`ratchet-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`, name, 'ratchet', { role: name.endsWith('50') || name.endsWith('55') || name.endsWith('60') ? 'attack' : (name.endsWith('80') || name.endsWith('85') ? 'defense' : 'balance') })),

      part('ratchet-8-80', '8-80', 'ratchet', { role: 'defense', status: 'announced', notes: 'Announced for UX-21 on 2026-08-08; excluded by default.' }),

      // Bits
      ...[
        ['accel','A','Accel','attack'],['ball','B','Ball','stamina'],['bound-spike','BS','Bound Spike','defense'],
        ['cyclone','C','Cyclone','attack'],['disk-ball','DB','Disk Ball','stamina'],['dot','D','Dot','defense'],
        ['elevate','E','Elevate','balance'],['flat','F','Flat','attack'],['free-ball','FB','Free Ball','stamina'],['free-flat','FF','Free Flat','attack'],
        ['gear-ball','GB','Gear Ball','stamina'],['gear-flat','GF','Gear Flat','attack'],['gear-needle','GN','Gear Needle','defense'],
        ['gear-point','GP','Gear Point','balance'],['gear-rush','GR','Gear Rush','attack'],['gear-unite','GU','Gear Unite','balance'],
        ['glide','G','Glide','stamina'],['hexa','H','Hexa','defense'],['high-needle','HN','High Needle','defense'],
        ['high-taper','HT','High Taper','balance'],['ignition','I','Ignition','attack'],['jolt','J','Jolt','attack'],
        ['kick','K','Kick','balance'],['level','L','Level','balance'],['low-flat','LF','Low Flat','attack'],
        ['low-orb','LO','Low Orb','stamina'],['low-rush','LR','Low Rush','attack'],['metal-needle','MN','Metal Needle','defense'],
        ['narrow','Nr','Narrow','defense'],['needle','N','Needle','defense'],['orb','O','Orb','stamina'],
        ['point','P','Point','balance'],['quake','Q','Quake','attack'],['rubber-accel','RA','Rubber Accel','attack'],
        ['rush','R','Rush','attack'],['spike','S','Spike','defense'],['taper','T','Taper','balance'],
        ['trans-kick','TK','Trans Kick','balance'],['trans-point','TP','Trans Point','balance'],['under-flat','UF','Under Flat','attack'],
        ['under-needle','UN','Under Needle','defense'],['unite','U','Unite','balance'],['vortex','V','Vortex','attack'],
        ['wall-ball','WB','Wall Ball','stamina'],['wall-wedge','WW','Wall Wedge','defense'],['wedge','W','Wedge','defense'],
        ['zap','Z','Zap','attack'],['bit-rubber-flat','RF','Rubber Flat','attack'],['disk-spike','DS','Disk Spike','stamina'],
        ['yielding','Y','Yielding','stamina'],['bit-needle-rare','N','Needle','defense']
      ].map(([id,code,name,role]) => part(`bit-${id}`, name, 'bit', { role, code })),

      part('integrated-operate', 'Operate', 'integratedBit', { line: 'Custom', role: 'defense', code: 'Op', notes: 'Ratchet-integrated bit.' }),
      part('integrated-turbo', 'Turbo', 'integratedBit', { line: 'Custom', role: 'balance', code: 'Tr', notes: 'Ratchet-integrated bit used by PegasusBlast ATr.' })
    ],

    // Verified stock combinations useful for fast inventory entry. This is deliberately not a claim that every recolor is listed.
    products: [
      { id: 'BX-01', name: 'DranSword 3-60F', status: 'released', parts: ['blade-dran-sword','ratchet-3-60','bit-flat'] },
      { id: 'BX-04', name: 'KnightShield 3-80N', status: 'released', parts: ['blade-knight-shield','ratchet-3-80','bit-needle'] },
      { id: 'BX-05', name: 'WizardArrow 4-80B', status: 'released', parts: ['blade-wizard-arrow','ratchet-4-80','bit-ball'] },
      { id: 'BX-15', name: 'LeonClaw 5-60P', status: 'released', parts: ['blade-leon-claw','ratchet-5-60','bit-point'] },
      { id: 'BX-23', name: 'PhoenixWing 9-60GF', status: 'released', parts: ['blade-phoenix-wing','ratchet-9-60','bit-gear-flat'] },
      { id: 'BX-26', name: 'UnicornSting 5-60GP', status: 'released', parts: ['blade-unicorn-sting','ratchet-5-60','bit-gear-point'] },
      { id: 'BX-31', name: 'Random Booster Vol.3', status: 'released', parts: [] },
      { id: 'BX-34', name: 'CobaltDragoon 2-60C', status: 'released', parts: ['blade-cobalt-dragoon','ratchet-2-60','bit-cyclone'] },
      { id: 'BX-38', name: 'CrimsonGaruda 4-70TP', status: 'released', parts: ['blade-crimson-garuda','ratchet-4-70','bit-trans-point'] },
      { id: 'BX-44', name: 'TriceraPress M-85BS', status: 'released', parts: ['blade-tricera-press','ratchet-m-85','bit-bound-spike'] },
      { id: 'BX-49', releaseDate: '2026-05-16', name: 'DranStrike 4-50FF', status: 'released', parts: ['blade-dran-strike','ratchet-4-50','bit-free-flat'] },
      { id: 'UX-01', name: 'DranBuster 1-60A', status: 'released', parts: ['blade-dran-buster','ratchet-1-60','bit-accel'] },
      { id: 'UX-02', name: 'HellsHammer 3-70H', status: 'released', parts: ['blade-hells-hammer','ratchet-3-70','bit-hexa'] },
      { id: 'UX-03', name: 'WizardRod 5-70DB', status: 'released', parts: ['blade-wizard-rod','ratchet-5-70','bit-disk-ball'] },
      { id: 'UX-06', name: 'LeonCrest 7-60GN', status: 'released', parts: ['blade-leon-crest','ratchet-7-60','bit-gear-needle'] },
      { id: 'UX-08', name: 'SilverWolf 3-80FB', status: 'released', parts: ['blade-silver-wolf','ratchet-3-80','bit-free-ball'] },
      { id: 'UX-09', name: 'SamuraiSaber 2-70L', status: 'released', parts: ['blade-samurai-saber','ratchet-2-70','bit-level'] },
      { id: 'UX-11', name: 'ImpactDrake 9-60LR', status: 'released', parts: ['blade-impact-drake','ratchet-9-60','bit-low-rush'] },
      { id: 'UX-13', name: 'GolemRock 1-60UN', status: 'released', parts: ['blade-golem-rock','ratchet-1-60','bit-under-needle'] },
      { id: 'UX-14', name: 'ScorpioSpear 0-70Z', status: 'released', parts: ['blade-scorpio-spear','ratchet-0-70','bit-zap'] },
      { id: 'UX-17', name: 'MeteorDragoon 3-70J', status: 'released', parts: ['blade-meteor-dragoon','ratchet-3-70','bit-jolt'] },
      { id: 'UX-19', releaseDate: '2026-04-25', name: 'BulletGriffon H', status: 'released', parts: ['rib-bullet-griffon','bit-hexa'] },
      { id: 'UX-20', releaseDate: '2026-07-11', name: 'GloryValkyrie LF', status: 'released', parts: ['rib-glory-valkyrie','bit-low-flat'] },
      { id: 'CX-01', name: 'DranBrave S6-60V', status: 'released', parts: ['lock-dran','main-brave','assist-slash','ratchet-6-60','bit-vortex'] },
      { id: 'CX-02', name: 'WizardArc R4-55LO', status: 'released', parts: ['lock-wizard','main-arc','assist-round','ratchet-4-55','bit-low-orb'] },
      { id: 'CX-03', name: 'PerseusDark B6-80W', status: 'released', parts: ['lock-perseus','main-dark','assist-bumper','ratchet-6-80','bit-wedge'] },
      { id: 'CX-07', name: 'PegasusBlast ATr', status: 'released', parts: ['lock-pegasus','main-blast','assist-assault','integrated-turbo'] },
      { id: 'CX-09', name: 'SolEclipse D5-70TK', status: 'released', parts: ['lock-sol','main-eclipse','assist-dual','ratchet-5-70','bit-trans-kick'] },
      { id: 'CX-10', name: 'WolfHunt F0-60DB', status: 'released', parts: ['lock-wolf','main-hunt','assist-free','ratchet-0-60','bit-disk-ball'] },
      { id: 'CX-12', name: 'PhoenixFlare Z9-80WW', status: 'released', parts: ['lock-phoenix','main-flare','assist-zillion','ratchet-9-80','bit-wall-wedge'] },
      { id: 'CX-13', releaseDate: '2026-03-28', name: 'BahamutBlitz BK1-50I', status: 'released', parts: ['lock-bahamut','metal-blitz','over-break','assist-knuckle','ratchet-1-50','bit-ignition'] },
      { id: 'CX-14', releaseDate: '2026-03-28', name: 'KnightFortress GV8-70UN', status: 'released', parts: ['lock-knight','metal-fortress','over-guard','assist-vertical','ratchet-8-70','bit-under-needle'] },
      { id: 'CX-15', releaseDate: '2026-03-28', name: 'RagnaRage FE4-55Y', status: 'released', parts: ['lock-ragna','metal-rage','over-flow','assist-erase','ratchet-4-55','bit-yielding'] },
      { id: 'CX-18-01', releaseDate: '2026-06-13', name: 'BrachioWhip OW5-70Nr', status: 'released', parts: ['lock-brachio','metal-whip','over-outer','assist-wheel','ratchet-5-70','bit-narrow'] },
      { id: 'CX-00-Bucks', releaseDate: '2026-07-09', name: 'BucksAntlers B2-60D', status: 'released', parts: ['lock-bucks','main-antlers','assist-bumper','ratchet-2-60','bit-dot'] },
      { id: 'CX-00-Kraken', releaseDate: '2026-07-09', name: 'KrakenWriggle S3-70O', status: 'released', parts: ['lock-kraken','main-wriggle','assist-slash','ratchet-3-70','bit-orb'] },
      { id: 'CX-00-Hornet', releaseDate: '2026-07-09', name: 'HornetFort R7-60T', status: 'released', parts: ['lock-hornet','main-fort','assist-round','ratchet-7-60','bit-taper'] },
      { id: 'CX-00-Drake', releaseDate: '2026-07-09', name: 'DrakeBrave G4-70I', status: 'released', parts: ['lock-drake','main-brave','assist-gravity','ratchet-4-70','bit-ignition'] },
      { id: 'BX-00-StormPegasis', releaseDate: '2026-07-11', name: 'StormPegasis 3-70RA', status: 'released', parts: ['blade-storm-pegasis','ratchet-3-70','bit-rubber-accel'] },
      { id: 'BX-50-01', name: 'HeavensRing 0-80DS', status: 'released', releaseDate: '2026-07-11', parts: ['blade-heavens-ring','ratchet-0-80','bit-disk-spike'] },
      { id: 'BX-50-02', name: 'HeavensRing 6-60TP', status: 'released', releaseDate: '2026-07-11', parts: ['blade-heavens-ring','ratchet-6-60','bit-trans-point'] },
      { id: 'BX-50-03', releaseDate: '2026-07-11', name: 'ImpactDrake 7-55FB', status: 'released', parts: ['blade-impact-drake','ratchet-7-55','bit-free-ball'] },
      { id: 'BX-50-04', releaseDate: '2026-07-11', name: 'GhostCircle M-85DS', status: 'released', parts: ['blade-ghost-circle','ratchet-m-85','bit-disk-spike'] },
      { id: 'BX-50-05', releaseDate: '2026-07-11', name: 'WolfFlame D9-65L', status: 'released', parts: ['lock-wolf','main-flame','assist-dual','ratchet-9-65','bit-level'] },
      { id: 'BX-50-06', releaseDate: '2026-07-11', name: 'CerberusReaper B0-80WB', status: 'released', parts: ['lock-cerberus','main-reaper','assist-bumper','ratchet-0-80','bit-wall-ball'] },
      { id: 'UX-21', name: 'HellsNether Deck Set', status: 'announced', releaseDate: '2026-08-08', parts: ['rib-hells-nether','blade-silver-wolf','ratchet-9-70','bit-rush','ratchet-8-80','bit-ball'] }
    ],

    sources: [
      { label: 'Takara Tomy — official Beyblade X regulation', kind: 'rules', url: 'https://beyblade.takaratomy.co.jp/beyblade-x/_image/regulation.pdf', note: 'Regulation v12, effective March/April 2026 publication cycle.' },
      { label: 'Takara Tomy — official product lineup', kind: 'catalog', url: 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/', note: 'Release dates checked through 2026-07-19.' },
      { label: 'World Beyblade Organization — Beyblade X rules', kind: 'rules', url: 'https://worldbeyblade.org/Thread-Beyblade-X-Rules', note: 'Used for optional WBO profiles; event-specific rules still control.' },
      { label: 'Beyblade Wiki — Basic, Unique, and Custom Line part lists', kind: 'catalog', note: 'Secondary catalog cross-check; official sources take precedence.' },
      { label: 'Beyblade Planner — part list cross-check', kind: 'catalog', note: 'Secondary cross-check for legacy part coverage.' }
    ]
  };

  // Remove duplicate IDs while preserving the first verified entry. Duplicated display names remain legal catalog aliases only when IDs differ.
  const today = data.meta.verifiedThrough;
  data.products = data.products.map((product) => ({
    ...product,
    status: product.releaseDate && product.releaseDate > today ? 'announced' : (product.status || 'released')
  }));


  const seen = new Set();
  data.parts = data.parts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  root.XDATA = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
