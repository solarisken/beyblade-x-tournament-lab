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
    notes: extra.notes || '',
    engineering: extra.engineering || null
  });

  const data = {
    meta: {
      appName: 'X Deck Lab',
      version: '3.1.0',
      verifiedThrough: '2026-07-20',
      schemaVersion: 8,
      rulesVersion: 'Takara Tomy Regulation v12 / WBO rules checked 2026-07-19',
      catalogPolicy: 'The release library covers official Takara Tomy Japan products that contain at least one Beyblade performance part, ordered by release date. Releases containing only launchers, stadiums, cases, stickers, or other non-Bey accessories are excluded. Announced products with Bey parts are visible but cannot be added as owned until release verification.',
      disclaimer: 'Independent tournament-preparation tool. Engineering scores are qualitative proxies. A self-KO is recorded with one simple yes/no answer. Controlled battle results—not the model—remain the final evidence.'
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
      candidatePool: 48,
      targetPerOpponent: 3,
      opponentPoolSize: 90,
      minimumSelfKoTestsPerBey: 8,
      maxObservedSelfKoRate: 0.15,
      showGuide: true,
      experienceMode: 'player'
    },

    engineeringModel: {
      version: 2,
      method: 'Dimensionless physics-informed proxy model',
      metrics: ['impactPotential','rotationalInertia','spinRetention','stability','koResistance','burstResistance','xDashPotential','control','recoilRisk','selfKoRisk'],
      measuredInputs: [],
      proxyInputs: ['official type classification','catalog geometry descriptors','ratchet nominal height','bit contact-profile descriptors','spin direction'],
      limitations: ['No measured part mass or mass distribution','No launch RPM','No material friction coefficient','No mold, wear, stadium, or launcher calibration']
    },


    finishCauses: [
      { id: 'forced-contact', name: 'Opponent-forced contact / clean KO' },
      { id: 'own-no-contact-self-ko', name: 'Own no-contact self-KO' },
      { id: 'own-glancing-self-ko', name: 'Own glancing-contact self-KO' },
      { id: 'own-rail-overshoot', name: 'Own rail overshoot' },
      { id: 'own-rebound-self-ko', name: 'Own rebound self-KO' },
      { id: 'own-launch-destabilization', name: 'Own launch-angle destabilization' },
      { id: 'opponent-self-ko', name: 'Opponent self-KO' },
      { id: 'spin-exhaustion', name: 'Spin exhaustion' },
      { id: 'burst-impact', name: 'Burst from contact' },
      { id: 'draw-invalid', name: 'Draw / relaunch / invalid' },
      { id: 'unknown-contact-cause', name: 'Unknown contact cause (legacy)' }
    ],

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


      // Additional official and collaboration blades used by boxed-product records
      part('blade-bear-scratch', 'BearScratch', 'blade', { role: 'defense' }),
      part('blade-tyranno-beat', 'TyrannoBeat', 'blade', { role: 'attack' }),
      part('blade-ptera-swing', 'PteraSwing', 'blade', { role: 'balance' }),
      part('blade-mammoth-tusk', 'MammothTusk', 'blade', { role: 'defense' }),
      part('blade-tackle-goat', 'TackleGoat', 'blade', { role: 'balance' }),
      part('blade-croc-crunch', 'CrocCrunch', 'blade', { role: 'attack' }),
      part('blade-iron-man', 'Iron Man', 'blade', { role: 'balance' }),
      part('blade-thanos', 'Thanos', 'blade', { role: 'defense' }),
      part('blade-spider-man', 'Spider-Man', 'blade', { role: 'attack' }),
      part('blade-venom', 'Venom', 'blade', { role: 'defense' }),
      part('blade-luke-skywalker', 'Luke Skywalker', 'blade', { role: 'balance' }),
      part('blade-darth-vader', 'Darth Vader', 'blade', { role: 'attack' }),
      part('blade-mandalorian', 'The Mandalorian', 'blade', { role: 'attack' }),
      part('blade-moff-gideon', 'Moff Gideon', 'blade', { role: 'defense' }),
      part('blade-optimus-prime', 'Optimus Prime', 'blade', { role: 'balance' }),
      part('blade-megatron', 'Megatron', 'blade', { role: 'defense' }),
      part('blade-optimus-primal', 'Optimus Primal', 'blade', { role: 'attack' }),
      part('blade-starscream', 'Starscream', 'blade', { role: 'defense' }),
      part('blade-t-rex', 'T-Rex', 'blade', { role: 'attack' }),
      part('blade-mosasaurus', 'Mosasaurus', 'blade', { role: 'defense' }),
      part('blade-spinosaurus', 'Spinosaurus', 'blade', { role: 'attack' }),
      part('blade-quetzalcoatlus', 'Quetzalcoatlus', 'blade', { role: 'defense' }),

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

      part('bit-merge', 'Merge', 'bit', { role: 'balance', code: 'M' }),
      part('bit-rubber-flat', 'Rubber Flat', 'bit', { role: 'attack', code: 'RF' }),
      part('integrated-operate', 'Operate', 'integratedBit', { line: 'Custom', role: 'defense', code: 'Op', notes: 'Ratchet-integrated bit.' }),
      part('integrated-turbo', 'Turbo', 'integratedBit', { line: 'Custom', role: 'balance', code: 'Tr', notes: 'Ratchet-integrated bit used by PegasusBlast ATr.' })
    ],

    // Verified stock combinations useful for fast inventory entry. This is deliberately not a claim that every recolor is listed.
    products: [
      {
            "id": "BX-01",
            "catalogCode": "BX-01",
            "name": "DranSword 3-60F",
            "releaseDate": "2023-07-15",
            "productType": "starter",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-dran-sword",
                  "ratchet-3-60",
                  "bit-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-02",
            "catalogCode": "BX-02",
            "name": "HellsScythe 4-60T",
            "releaseDate": "2023-07-15",
            "productType": "starter",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-hells-scythe",
                  "ratchet-4-60",
                  "bit-taper"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-03",
            "catalogCode": "BX-03",
            "name": "WizardArrow 4-80B",
            "releaseDate": "2023-07-15",
            "productType": "starter",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-wizard-arrow",
                  "ratchet-4-80",
                  "bit-ball"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-04",
            "catalogCode": "BX-04",
            "name": "KnightShield 3-80N",
            "releaseDate": "2023-07-15",
            "productType": "starter",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-knight-shield",
                  "ratchet-3-80",
                  "bit-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-05",
            "catalogCode": "BX-05",
            "name": "WizardArrow 4-80B",
            "releaseDate": "2023-07-15",
            "productType": "booster",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-wizard-arrow",
                  "ratchet-4-80",
                  "bit-ball"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-06",
            "catalogCode": "BX-06",
            "name": "KnightShield 3-80N",
            "releaseDate": "2023-07-15",
            "productType": "booster",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-knight-shield",
                  "ratchet-3-80",
                  "bit-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-07",
            "catalogCode": "BX-07",
            "name": "Start Dash Set",
            "releaseDate": "2023-07-15",
            "productType": "entry-set",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-dran-sword",
                  "ratchet-3-60",
                  "bit-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": "Includes DranSword 3-60F plus launcher, grip, pass, and stadium accessories."
      },
      {
            "id": "BX-08",
            "catalogCode": "BX-08",
            "name": "3on3 Deck Set",
            "releaseDate": "2023-07-15",
            "productType": "deck-set",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-hells-scythe",
                  "ratchet-3-80",
                  "bit-ball",
                  "blade-wizard-arrow",
                  "ratchet-4-60",
                  "bit-needle",
                  "blade-knight-shield",
                  "ratchet-4-80",
                  "bit-taper"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": "Three fixed Beyblades."
      },
      {
            "id": "BX-00-DRANZER",
            "catalogCode": "BX-00",
            "name": "DranzerSpiral 3-80T",
            "releaseDate": "2023-07-15",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-dranzer-spiral",
                  "ratchet-3-80",
                  "bit-taper"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-13",
            "catalogCode": "BX-13",
            "name": "KnightLance 4-80HN",
            "releaseDate": "2023-08-10",
            "productType": "booster",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-knight-lance",
                  "ratchet-4-80",
                  "bit-high-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-14",
            "catalogCode": "BX-14",
            "name": "Random Booster Vol.1",
            "releaseDate": "2023-09-09",
            "productType": "random-booster",
            "line": "BX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "SharkEdge 3-60LF",
                        "parts": [
                              "blade-shark-edge",
                              "ratchet-3-60",
                              "bit-low-flat"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "SharkEdge 4-80N",
                        "parts": [
                              "blade-shark-edge",
                              "ratchet-4-80",
                              "bit-needle"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "DranSword 3-80B",
                        "parts": [
                              "blade-dran-sword",
                              "ratchet-3-80",
                              "bit-ball"
                        ]
                  },
                  {
                        "id": "04",
                        "name": "WizardArrow 3-60T",
                        "parts": [
                              "blade-wizard-arrow",
                              "ratchet-3-60",
                              "bit-taper"
                        ]
                  },
                  {
                        "id": "05",
                        "name": "HellsScythe 4-80LF",
                        "parts": [
                              "blade-hells-scythe",
                              "ratchet-4-80",
                              "bit-low-flat"
                        ]
                  },
                  {
                        "id": "06",
                        "name": "KnightShield 4-60LF",
                        "parts": [
                              "blade-knight-shield",
                              "ratchet-4-60",
                              "bit-low-flat"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-00-HELLSSCYTHE-GOLD",
            "catalogCode": "BX-00",
            "name": "HellsScythe 4-60T Metal Coat: Gold",
            "releaseDate": "2023-09-11",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-hells-scythe",
                  "ratchet-4-60",
                  "bit-taper"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-15",
            "catalogCode": "BX-15",
            "name": "LeonClaw 5-60P",
            "releaseDate": "2023-10-07",
            "productType": "starter",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-leon-claw",
                  "ratchet-5-60",
                  "bit-point"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-16",
            "catalogCode": "BX-16",
            "name": "Random Booster ViperTail Select",
            "releaseDate": "2023-10-07",
            "productType": "random-select",
            "line": "BX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "ViperTail 5-80O",
                        "parts": [
                              "blade-viper-tail",
                              "ratchet-5-80",
                              "bit-orb"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "ViperTail 4-60F",
                        "parts": [
                              "blade-viper-tail",
                              "ratchet-4-60",
                              "bit-flat"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "ViperTail 3-80HN",
                        "parts": [
                              "blade-viper-tail",
                              "ratchet-3-80",
                              "bit-high-needle"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-17",
            "catalogCode": "BX-17",
            "name": "Battle Entry Set",
            "releaseDate": "2023-10-07",
            "productType": "entry-set",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-dran-sword",
                  "ratchet-3-60",
                  "bit-flat",
                  "blade-wizard-arrow",
                  "ratchet-4-80",
                  "bit-ball"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": "Two fixed Beyblades plus stadium and launchers."
      },
      {
            "id": "BX-19",
            "catalogCode": "BX-19",
            "name": "RhinoHorn 3-80S",
            "releaseDate": "2023-11-02",
            "productType": "booster",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-rhino-horn",
                  "ratchet-3-80",
                  "bit-spike"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-20",
            "catalogCode": "BX-20",
            "name": "DranDagger Deck Set",
            "releaseDate": "2023-11-02",
            "productType": "deck-set",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-dran-dagger",
                  "ratchet-4-60",
                  "bit-rush",
                  "blade-knight-shield",
                  "ratchet-5-80",
                  "bit-taper",
                  "blade-shark-edge",
                  "ratchet-3-80",
                  "bit-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-21",
            "catalogCode": "BX-21",
            "name": "HellsChain Deck Set",
            "releaseDate": "2023-11-02",
            "productType": "deck-set",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-hells-chain",
                  "ratchet-5-60",
                  "bit-high-taper",
                  "blade-knight-lance",
                  "ratchet-3-60",
                  "bit-low-flat",
                  "blade-wizard-arrow",
                  "ratchet-4-80",
                  "bit-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-22",
            "catalogCode": "BX-22",
            "name": "DranSword 3-60F Entry Package",
            "releaseDate": "2023-12-02",
            "productType": "starter",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-dran-sword",
                  "ratchet-3-60",
                  "bit-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-23",
            "catalogCode": "BX-23",
            "name": "PhoenixWing 9-60GF",
            "releaseDate": "2023-12-27",
            "productType": "starter",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-phoenix-wing",
                  "ratchet-9-60",
                  "bit-gear-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-24",
            "catalogCode": "BX-24",
            "name": "Random Booster Vol.2",
            "releaseDate": "2023-12-27",
            "productType": "random-booster",
            "line": "BX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "WyvernGale 5-80GB",
                        "parts": [
                              "blade-wyvern-gale",
                              "ratchet-5-80",
                              "bit-gear-ball"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "WyvernGale 3-60T",
                        "parts": [
                              "blade-wyvern-gale",
                              "ratchet-3-60",
                              "bit-taper"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "KnightLance 4-60GB",
                        "parts": [
                              "blade-knight-lance",
                              "ratchet-4-60",
                              "bit-gear-ball"
                        ]
                  },
                  {
                        "id": "04",
                        "name": "ViperTail 5-60F",
                        "parts": [
                              "blade-viper-tail",
                              "ratchet-5-60",
                              "bit-flat"
                        ]
                  },
                  {
                        "id": "05",
                        "name": "LeonClaw 3-80HN",
                        "parts": [
                              "blade-leon-claw",
                              "ratchet-3-80",
                              "bit-high-needle"
                        ]
                  },
                  {
                        "id": "06",
                        "name": "WizardArrow 4-80GB",
                        "parts": [
                              "blade-wizard-arrow",
                              "ratchet-4-80",
                              "bit-gear-ball"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-26",
            "catalogCode": "BX-26",
            "name": "UnicornSting 5-60GP",
            "releaseDate": "2024-01-27",
            "productType": "booster",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-unicorn-sting",
                  "ratchet-5-60",
                  "bit-gear-point"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-27",
            "catalogCode": "BX-27",
            "name": "Random Booster SphinxCowl Select",
            "releaseDate": "2024-02-22",
            "productType": "random-select",
            "line": "BX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "SphinxCowl 9-80GN",
                        "parts": [
                              "blade-sphinx-cowl",
                              "ratchet-9-80",
                              "bit-gear-needle"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "SphinxCowl 4-80HT",
                        "parts": [
                              "blade-sphinx-cowl",
                              "ratchet-4-80",
                              "bit-high-taper"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "SphinxCowl 5-60O",
                        "parts": [
                              "blade-sphinx-cowl",
                              "ratchet-5-60",
                              "bit-orb"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-00-LEONCLAW-GOLD",
            "catalogCode": "BX-00",
            "name": "LeonClaw 5-60P Metal Coat: Gold",
            "releaseDate": "2024-02-22",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-leon-claw",
                  "ratchet-5-60",
                  "bit-point"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-SHARKEDGE-BLUE",
            "catalogCode": "BX-00",
            "name": "SharkEdge 5-60GF Metal Coat: Blue",
            "releaseDate": "2024-03-23",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-shark-edge",
                  "ratchet-5-60",
                  "bit-gear-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-01",
            "catalogCode": "UX-01",
            "name": "DranBuster 1-60A",
            "releaseDate": "2024-03-30",
            "productType": "starter",
            "line": "UX",
            "limited": false,
            "parts": [
                  "blade-dran-buster",
                  "ratchet-1-60",
                  "bit-accel"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-02",
            "catalogCode": "UX-02",
            "name": "HellsHammer 3-70H",
            "releaseDate": "2024-03-30",
            "productType": "starter",
            "line": "UX",
            "limited": false,
            "parts": [
                  "blade-hells-hammer",
                  "ratchet-3-70",
                  "bit-hexa"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-03",
            "catalogCode": "UX-03",
            "name": "WizardRod 5-70DB",
            "releaseDate": "2024-03-30",
            "productType": "booster",
            "line": "UX",
            "limited": false,
            "parts": [
                  "blade-wizard-rod",
                  "ratchet-5-70",
                  "bit-disk-ball"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-04",
            "catalogCode": "UX-04",
            "name": "Battle Entry Set U",
            "releaseDate": "2024-04-27",
            "productType": "entry-set",
            "line": "UX",
            "limited": false,
            "parts": [
                  "blade-dran-buster",
                  "ratchet-1-60",
                  "bit-accel",
                  "blade-wizard-rod",
                  "ratchet-5-70",
                  "bit-disk-ball"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": "Two fixed Beyblades plus stadium and launchers."
      },
      {
            "id": "BX-00-DRIGER",
            "catalogCode": "BX-00",
            "name": "DrigerSlash 4-80P",
            "releaseDate": "2024-04-27",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-driger-slash",
                  "ratchet-4-80",
                  "bit-point"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-31",
            "catalogCode": "BX-31",
            "name": "Random Booster Vol.3",
            "releaseDate": "2024-04-27",
            "productType": "random-booster",
            "line": "BX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "TyrannoBeat 4-70Q",
                        "parts": [
                              "blade-tyranno-beat",
                              "ratchet-4-70",
                              "bit-quake"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "TyrannoBeat 3-60S",
                        "parts": [
                              "blade-tyranno-beat",
                              "ratchet-3-60",
                              "bit-spike"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "HellsChain 9-80O",
                        "parts": [
                              "blade-hells-chain",
                              "ratchet-9-80",
                              "bit-orb"
                        ]
                  },
                  {
                        "id": "04",
                        "name": "DranDagger 4-70P",
                        "parts": [
                              "blade-dran-dagger",
                              "ratchet-4-70",
                              "bit-point"
                        ]
                  },
                  {
                        "id": "05",
                        "name": "SharkEdge 1-60Q",
                        "parts": [
                              "blade-shark-edge",
                              "ratchet-1-60",
                              "bit-quake"
                        ]
                  },
                  {
                        "id": "06",
                        "name": "RhinoHorn 5-80Q",
                        "parts": [
                              "blade-rhino-horn",
                              "ratchet-5-80",
                              "bit-quake"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-00-HELLSCHAIN-BLACK",
            "catalogCode": "BX-00",
            "name": "HellsChain 5-60HT Metal Coat: Black",
            "releaseDate": "2024-05-16",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-hells-chain",
                  "ratchet-5-60",
                  "bit-high-taper"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-05",
            "catalogCode": "UX-05",
            "name": "Random Booster ShinobiShadow Select",
            "releaseDate": "2024-05-18",
            "productType": "random-select",
            "line": "UX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "ShinobiShadow 1-80MN",
                        "parts": [
                              "blade-shinobi-shadow",
                              "ratchet-1-80",
                              "bit-metal-needle"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "ShinobiShadow 9-60LF",
                        "parts": [
                              "blade-shinobi-shadow",
                              "ratchet-9-60",
                              "bit-low-flat"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "ShinobiShadow 3-70GP",
                        "parts": [
                              "blade-shinobi-shadow",
                              "ratchet-3-70",
                              "bit-gear-point"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-33",
            "catalogCode": "BX-33",
            "name": "WeissTiger 3-60U",
            "releaseDate": "2024-06-15",
            "productType": "booster",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-weiss-tiger",
                  "ratchet-3-60",
                  "bit-unite"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-34",
            "catalogCode": "BX-34",
            "name": "CobaltDragoon 2-60C",
            "releaseDate": "2024-07-13",
            "productType": "starter",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-cobalt-dragoon",
                  "ratchet-2-60",
                  "bit-cyclone"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-35",
            "catalogCode": "BX-35",
            "name": "Random Booster Vol.4",
            "releaseDate": "2024-07-13",
            "productType": "random-booster",
            "line": "BX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "BlackShell 4-60D",
                        "parts": [
                              "blade-black-shell",
                              "ratchet-4-60",
                              "bit-dot"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "BlackShell 9-80B",
                        "parts": [
                              "blade-black-shell",
                              "ratchet-9-80",
                              "bit-ball"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "UnicornSting 3-70D",
                        "parts": [
                              "blade-unicorn-sting",
                              "ratchet-3-70",
                              "bit-dot"
                        ]
                  },
                  {
                        "id": "04",
                        "name": "WizardRod 1-60R",
                        "parts": [
                              "blade-wizard-rod",
                              "ratchet-1-60",
                              "bit-rush"
                        ]
                  },
                  {
                        "id": "05",
                        "name": "PhoenixWing 5-80H",
                        "parts": [
                              "blade-phoenix-wing",
                              "ratchet-5-80",
                              "bit-hexa"
                        ]
                  },
                  {
                        "id": "06",
                        "name": "ViperTail 5-70D",
                        "parts": [
                              "blade-viper-tail",
                              "ratchet-5-70",
                              "bit-dot"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-00-BITSET-GOLD",
            "catalogCode": "BX-00",
            "name": "Bit Set F/T/B/N Gold × Black",
            "releaseDate": "2024-07-30",
            "productType": "part-set",
            "line": "BX",
            "limited": true,
            "parts": [
                  "bit-flat",
                  "bit-taper",
                  "bit-ball",
                  "bit-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-DRANDAGGER-GIANTS",
            "catalogCode": "BX-00",
            "name": "DranDagger 2-80GP Giants Ver.",
            "releaseDate": "2024-08-03",
            "productType": "starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-dran-dagger",
                  "ratchet-2-80",
                  "bit-gear-point"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-DRANZER-BLACK",
            "catalogCode": "BX-00",
            "name": "DranzerSpiral 3-80T Black Ver.",
            "releaseDate": "2024-08-10",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-dranzer-spiral",
                  "ratchet-3-80",
                  "bit-taper"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-06",
            "catalogCode": "UX-06",
            "name": "LeonCrest 7-60GN",
            "releaseDate": "2024-08-10",
            "productType": "booster",
            "line": "UX",
            "limited": false,
            "parts": [
                  "blade-leon-crest",
                  "ratchet-7-60",
                  "bit-gear-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-07",
            "catalogCode": "UX-07",
            "name": "PhoenixRudder Deck Set",
            "releaseDate": "2024-08-10",
            "productType": "deck-set",
            "line": "UX",
            "limited": false,
            "parts": [],
            "variants": [],
            "inventoryMode": "catalog",
            "contentsNote": "Official three-Bey deck set. Mark the set owned; add or adjust exact loose parts from the part ledger if needed."
      },
      {
            "id": "BX-00-COBALTDRAGOON-BLACK",
            "catalogCode": "BX-00",
            "name": "CobaltDragoon 2-60C Metal Coat: Black",
            "releaseDate": "2024-08-31",
            "productType": "starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-cobalt-dragoon",
                  "ratchet-2-60",
                  "bit-cyclone"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-LDRAGO",
            "catalogCode": "BX-00",
            "name": "Random Booster Lightning L-Drago 1-60F",
            "releaseDate": "2024-09-14",
            "productType": "random-select",
            "line": "BX",
            "limited": true,
            "parts": [],
            "variants": [
                  {
                        "id": "01U",
                        "name": "Lightning L-Drago Upper Type 1-60F",
                        "parts": [
                              "blade-lightning-l-drago-upper",
                              "ratchet-1-60",
                              "bit-flat"
                        ]
                  },
                  {
                        "id": "01R",
                        "name": "Lightning L-Drago Rapid-Hit Type 1-60F",
                        "parts": [
                              "blade-lightning-l-drago-rapid",
                              "ratchet-1-60",
                              "bit-flat"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-36",
            "catalogCode": "BX-36",
            "name": "Random Booster WhaleWave Select",
            "releaseDate": "2024-09-14",
            "productType": "random-select",
            "line": "BX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "WhaleWave 5-80E",
                        "parts": [
                              "blade-whale-wave",
                              "ratchet-5-80",
                              "bit-elevate"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "WhaleWave 4-70HN",
                        "parts": [
                              "blade-whale-wave",
                              "ratchet-4-70",
                              "bit-high-needle"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "WhaleWave 3-80GB",
                        "parts": [
                              "blade-whale-wave",
                              "ratchet-3-80",
                              "bit-gear-ball"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "UX-08",
            "catalogCode": "UX-08",
            "name": "SilverWolf 3-80FB",
            "releaseDate": "2024-10-12",
            "productType": "starter",
            "line": "UX",
            "limited": false,
            "parts": [
                  "blade-silver-wolf",
                  "ratchet-3-80",
                  "bit-free-ball"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-37",
            "catalogCode": "BX-37",
            "name": "Double Xtreme Stadium Set",
            "releaseDate": "2024-10-12",
            "productType": "entry-set",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-bear-scratch",
                  "ratchet-5-60",
                  "bit-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": "Includes BearScratch 5-60F plus Double Xtreme Stadium and launcher."
      },
      {
            "id": "BX-38",
            "catalogCode": "BX-38",
            "name": "CrimsonGaruda 4-70TP",
            "releaseDate": "2024-11-02",
            "productType": "booster",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-crimson-garuda",
                  "ratchet-4-70",
                  "bit-trans-point"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-09",
            "catalogCode": "UX-09",
            "name": "SamuraiSaber 2-70L",
            "releaseDate": "2024-11-02",
            "productType": "starter",
            "line": "UX",
            "limited": false,
            "parts": [
                  "blade-samurai-saber",
                  "ratchet-2-70",
                  "bit-level"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-10",
            "catalogCode": "UX-10",
            "name": "Customize Set U",
            "releaseDate": "2024-11-02",
            "productType": "customize-set",
            "line": "UX",
            "limited": false,
            "parts": [
                  "blade-knight-mail",
                  "blade-ptera-swing",
                  "blade-hells-hammer",
                  "blade-tyranno-beat",
                  "ratchet-1-60",
                  "ratchet-3-85",
                  "ratchet-7-70",
                  "bit-bound-spike",
                  "bit-ball",
                  "bit-metal-needle",
                  "bit-point",
                  "bit-rubber-accel",
                  "bit-rush"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": "Four blades, three ratchets, and six bits; up to three complete Beys can be assembled at once."
      },
      {
            "id": "UX-00-DRAN-DECK",
            "catalogCode": "UX-00",
            "name": "Asian Championship Dran Deck Starter",
            "releaseDate": "2024-11-16",
            "productType": "deck-set",
            "line": "UX",
            "limited": true,
            "parts": [],
            "variants": [],
            "inventoryMode": "catalog",
            "contentsNote": "Official limited Dran deck product. Mark owned; verify exact included recolors before adjusting individual quantities."
      },
      {
            "id": "BX-00-COBALTDRAKE-CLEAR",
            "catalogCode": "BX-00",
            "name": "CobaltDrake 4-60F Clear Ver.",
            "releaseDate": "2024-11-28",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-cobalt-drake",
                  "ratchet-4-60",
                  "bit-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-00-DRANBUSTER-COLOR",
            "catalogCode": "UX-00",
            "name": "DranBuster 1-60A Color Choice Booster",
            "releaseDate": "2024-12-27",
            "productType": "booster",
            "line": "UX",
            "limited": true,
            "parts": [
                  "blade-dran-buster",
                  "ratchet-1-60",
                  "bit-accel"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-MAMMOTHTUSK",
            "catalogCode": "BX-00",
            "name": "MammothTusk 2-80E Metal Coat: Black",
            "releaseDate": "2024-12-27",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-mammoth-tusk",
                  "ratchet-2-80",
                  "bit-elevate"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-11",
            "catalogCode": "UX-11",
            "name": "ImpactDrake 9-60LR",
            "releaseDate": "2024-12-28",
            "productType": "starter",
            "line": "UX",
            "limited": false,
            "parts": [
                  "blade-impact-drake",
                  "ratchet-9-60",
                  "bit-low-rush"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-12",
            "catalogCode": "UX-12",
            "name": "Random Booster Vol.5",
            "releaseDate": "2024-12-28",
            "productType": "random-booster",
            "line": "UX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "GhostCircle 0-80GB",
                        "parts": [
                              "blade-ghost-circle",
                              "ratchet-0-80",
                              "bit-gear-ball"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "GhostCircle 4-60H",
                        "parts": [
                              "blade-ghost-circle",
                              "ratchet-4-60",
                              "bit-hexa"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "ShinobiShadow 3-80F",
                        "parts": [
                              "blade-shinobi-shadow",
                              "ratchet-3-80",
                              "bit-flat"
                        ]
                  },
                  {
                        "id": "04",
                        "name": "LeonClaw 0-80E",
                        "parts": [
                              "blade-leon-claw",
                              "ratchet-0-80",
                              "bit-elevate"
                        ]
                  },
                  {
                        "id": "05",
                        "name": "PhoenixFeather 2-60N",
                        "parts": [
                              "blade-phoenix-feather",
                              "ratchet-2-60",
                              "bit-needle"
                        ]
                  },
                  {
                        "id": "06",
                        "name": "WyvernGale 0-80C",
                        "parts": [
                              "blade-wyvern-gale",
                              "ratchet-0-80",
                              "bit-cyclone"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-00-DRACIEL",
            "catalogCode": "BX-00",
            "name": "DracielShield 7-60D",
            "releaseDate": "2024-12-28",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-draciel-shield",
                  "ratchet-7-60",
                  "bit-dot"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-00-DRANBUSTER-BARCA",
            "catalogCode": "UX-00",
            "name": "DranBuster 1-60A FC Barcelona Ver.",
            "releaseDate": "2025-01-25",
            "productType": "starter",
            "line": "UX",
            "limited": true,
            "parts": [
                  "blade-dran-buster",
                  "ratchet-1-60",
                  "bit-accel"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-00-KICKOFF-BARCA",
            "catalogCode": "UX-00",
            "name": "Bey Kickoff Set FC Barcelona Ver.",
            "releaseDate": "2025-01-25",
            "productType": "entry-set",
            "line": "UX",
            "limited": true,
            "parts": [
                  "blade-dran-buster",
                  "ratchet-1-60",
                  "bit-accel"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": "Includes the FC Barcelona DranBuster and play accessories."
      },
      {
            "id": "UX-13",
            "catalogCode": "UX-13",
            "name": "GolemRock 1-60UN",
            "releaseDate": "2025-01-25",
            "productType": "booster",
            "line": "UX",
            "limited": false,
            "parts": [
                  "blade-golem-rock",
                  "ratchet-1-60",
                  "bit-under-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-39",
            "catalogCode": "BX-39",
            "name": "Random Booster ShelterDrake Select",
            "releaseDate": "2025-02-15",
            "productType": "random-select",
            "line": "BX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "ShelterDrake 7-80GP",
                        "parts": [
                              "blade-shelter-drake",
                              "ratchet-7-80",
                              "bit-gear-point"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "ShelterDrake 5-70O",
                        "parts": [
                              "blade-shelter-drake",
                              "ratchet-5-70",
                              "bit-orb"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "ShelterDrake 3-60D",
                        "parts": [
                              "blade-shelter-drake",
                              "ratchet-3-60",
                              "bit-dot"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-00-PHOENIX-KITANI",
            "catalogCode": "BX-00",
            "name": "PhoenixWing 9-60GF Kitani Tatsuya Ver.",
            "releaseDate": "2025-03-15",
            "productType": "starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-phoenix-wing",
                  "ratchet-9-60",
                  "bit-gear-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-25TH",
            "catalogCode": "BX-00",
            "name": "Beyblade 25th Anniversary Set",
            "releaseDate": "2025-03-21",
            "productType": "collection-set",
            "line": "BX",
            "limited": true,
            "parts": [],
            "variants": [],
            "inventoryMode": "catalog",
            "contentsNote": "Official anniversary collection. Mark the box owned; add exact loose parts separately for any opened contents."
      },
      {
            "id": "CX-01",
            "catalogCode": "CX-01",
            "name": "DranBrave S6-60V",
            "releaseDate": "2025-03-29",
            "productType": "starter",
            "line": "CX",
            "limited": false,
            "parts": [
                  "lock-dran",
                  "main-brave",
                  "assist-slash",
                  "ratchet-6-60",
                  "bit-vortex"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-02",
            "catalogCode": "CX-02",
            "name": "WizardArc R4-55LO",
            "releaseDate": "2025-03-29",
            "productType": "starter",
            "line": "CX",
            "limited": false,
            "parts": [
                  "lock-wizard",
                  "main-arc",
                  "assist-round",
                  "ratchet-4-55",
                  "bit-low-orb"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-03",
            "catalogCode": "CX-03",
            "name": "PerseusDark B6-80W",
            "releaseDate": "2025-03-29",
            "productType": "booster",
            "line": "CX",
            "limited": false,
            "parts": [
                  "lock-perseus",
                  "main-dark",
                  "assist-bumper",
                  "ratchet-6-80",
                  "bit-wedge"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-04",
            "catalogCode": "CX-04",
            "name": "Battle Entry Set C",
            "releaseDate": "2025-03-29",
            "productType": "entry-set",
            "line": "CX",
            "limited": false,
            "parts": [
                  "lock-dran",
                  "main-brave",
                  "assist-slash",
                  "ratchet-6-60",
                  "bit-vortex",
                  "lock-perseus",
                  "main-dark",
                  "assist-bumper",
                  "ratchet-6-80",
                  "bit-wedge"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": "Two fixed Custom Line Beyblades plus stadium and launchers."
      },
      {
            "id": "BX-00-XENO",
            "catalogCode": "BX-00",
            "name": "XenoXcalibur 3-60GF",
            "releaseDate": "2025-03-29",
            "productType": "starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-xeno-xcalibur",
                  "ratchet-3-60",
                  "bit-gear-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-05",
            "catalogCode": "CX-05",
            "name": "Random Booster Vol.6",
            "releaseDate": "2025-04-26",
            "productType": "random-booster",
            "line": "CX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "HellsReaper T4-70K",
                        "parts": [
                              "lock-hells",
                              "main-reaper",
                              "assist-turn",
                              "ratchet-4-70",
                              "bit-kick"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "RhinoReaper C4-55D",
                        "parts": [
                              "lock-rhino",
                              "main-reaper",
                              "assist-charge",
                              "ratchet-4-55",
                              "bit-dot"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "HellsArc T3-85O",
                        "parts": [
                              "lock-hells",
                              "main-arc",
                              "assist-turn",
                              "ratchet-3-85",
                              "bit-orb"
                        ]
                  },
                  {
                        "id": "04",
                        "name": "LeonCrest 9-80K",
                        "parts": [
                              "blade-leon-crest",
                              "ratchet-9-80",
                              "bit-kick"
                        ]
                  },
                  {
                        "id": "05",
                        "name": "PhoenixRudder 4-70LF",
                        "parts": [
                              "blade-phoenix-rudder",
                              "ratchet-4-70",
                              "bit-low-flat"
                        ]
                  },
                  {
                        "id": "06",
                        "name": "WhaleWave 7-60K",
                        "parts": [
                              "blade-whale-wave",
                              "ratchet-7-60",
                              "bit-kick"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-00-MARVEL-IRON",
            "catalogCode": "BX-00",
            "name": "Marvel Iron Man 4-80B / Thanos 4-60P",
            "releaseDate": "2025-04-26",
            "productType": "double-starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-iron-man",
                  "ratchet-4-80",
                  "bit-ball",
                  "blade-thanos",
                  "ratchet-4-60",
                  "bit-point"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-MARVEL-SPIDER",
            "catalogCode": "BX-00",
            "name": "Marvel Spider-Man 3-60F / Venom 3-80N",
            "releaseDate": "2025-04-26",
            "productType": "double-starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-spider-man",
                  "ratchet-3-60",
                  "bit-flat",
                  "blade-venom",
                  "ratchet-3-80",
                  "bit-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-SW-LUKE",
            "catalogCode": "BX-00",
            "name": "Star Wars Luke Skywalker 4-80B / Darth Vader 4-60P",
            "releaseDate": "2025-04-26",
            "productType": "double-starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-luke-skywalker",
                  "ratchet-4-80",
                  "bit-ball",
                  "blade-darth-vader",
                  "ratchet-4-60",
                  "bit-point"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-SW-MANDO",
            "catalogCode": "BX-00",
            "name": "Star Wars Mandalorian 3-60F / Moff Gideon 3-80N",
            "releaseDate": "2025-04-26",
            "productType": "double-starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-mandalorian",
                  "ratchet-3-60",
                  "bit-flat",
                  "blade-moff-gideon",
                  "ratchet-3-80",
                  "bit-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-14",
            "catalogCode": "UX-14",
            "name": "ScorpioSpear 0-70Z",
            "releaseDate": "2025-04-26",
            "productType": "starter",
            "line": "UX",
            "limited": false,
            "parts": [
                  "blade-scorpio-spear",
                  "ratchet-0-70",
                  "bit-zap"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-TF-OPTIMUS",
            "catalogCode": "BX-00",
            "name": "Transformers Optimus Prime 4-60P / Megatron 4-80B",
            "releaseDate": "2025-05-17",
            "productType": "double-starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-optimus-prime",
                  "ratchet-4-60",
                  "bit-point",
                  "blade-megatron",
                  "ratchet-4-80",
                  "bit-ball"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-TF-PRIMAL",
            "catalogCode": "BX-00",
            "name": "Transformers Optimus Primal 3-60F / Starscream 3-80N",
            "releaseDate": "2025-05-17",
            "productType": "double-starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-optimus-primal",
                  "ratchet-3-60",
                  "bit-flat",
                  "blade-starscream",
                  "ratchet-3-80",
                  "bit-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-06",
            "catalogCode": "CX-06",
            "name": "Random Booster FoxBrush Select",
            "releaseDate": "2025-05-17",
            "productType": "random-select",
            "line": "CX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "FoxBrush J9-70GR",
                        "parts": [
                              "lock-fox",
                              "main-brush",
                              "assist-jaggy",
                              "ratchet-9-70",
                              "bit-gear-rush"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "FoxBrush J0-80DB",
                        "parts": [
                              "lock-fox",
                              "main-brush",
                              "assist-jaggy",
                              "ratchet-0-80",
                              "bit-disk-ball"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "FoxBrush J2-60U",
                        "parts": [
                              "lock-fox",
                              "main-brush",
                              "assist-jaggy",
                              "ratchet-2-60",
                              "bit-unite"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-44",
            "catalogCode": "BX-44",
            "name": "TriceraPress M-85BS",
            "releaseDate": "2025-06-28",
            "productType": "booster",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-tricera-press",
                  "ratchet-m-85",
                  "bit-bound-spike"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-00-KNIGHTMAIL-NAVY",
            "catalogCode": "UX-00",
            "name": "KnightMail 3-85BS Metal Coat: Navy",
            "releaseDate": "2025-07-17",
            "productType": "booster",
            "line": "UX",
            "limited": true,
            "parts": [
                  "blade-knight-mail",
                  "ratchet-3-85",
                  "bit-bound-spike"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-07",
            "catalogCode": "CX-07",
            "name": "PegasusBlast ATr",
            "releaseDate": "2025-07-19",
            "productType": "starter",
            "line": "CX",
            "limited": false,
            "parts": [
                  "lock-pegasus",
                  "main-blast",
                  "assist-assault",
                  "integrated-turbo"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-08",
            "catalogCode": "CX-08",
            "name": "Random Booster Vol.7",
            "releaseDate": "2025-07-19",
            "productType": "random-booster",
            "line": "CX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "CerberusFlame W5-80WB",
                        "parts": [
                              "lock-cerberus",
                              "main-flame",
                              "assist-wheel",
                              "ratchet-5-80",
                              "bit-wall-ball"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "WhaleFlame M3-85HT",
                        "parts": [
                              "lock-whale",
                              "main-flame",
                              "assist-massive",
                              "ratchet-3-85",
                              "bit-high-taper"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "CerberusDark W1-60F",
                        "parts": [
                              "lock-cerberus",
                              "main-dark",
                              "assist-wheel",
                              "ratchet-1-60",
                              "bit-flat"
                        ]
                  },
                  {
                        "id": "04",
                        "name": "DranBuster 5-80MN",
                        "parts": [
                              "blade-dran-buster",
                              "ratchet-5-80",
                              "bit-metal-needle"
                        ]
                  },
                  {
                        "id": "05",
                        "name": "BlackShell 7-70WB",
                        "parts": [
                              "blade-black-shell",
                              "ratchet-7-70",
                              "bit-wall-ball"
                        ]
                  },
                  {
                        "id": "06",
                        "name": "CobaltDragoon 4-55WB",
                        "parts": [
                              "blade-cobalt-dragoon",
                              "ratchet-4-55",
                              "bit-wall-ball"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-00-JW-TREX",
            "catalogCode": "BX-00",
            "name": "Jurassic World T-Rex / Mosasaurus Double Starter",
            "releaseDate": "2025-07-19",
            "productType": "double-starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-t-rex",
                  "ratchet-4-80",
                  "bit-ball",
                  "blade-mosasaurus",
                  "ratchet-4-60",
                  "bit-point"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-JW-SPINO",
            "catalogCode": "BX-00",
            "name": "Jurassic World Spinosaurus / Quetzalcoatlus Double Starter",
            "releaseDate": "2025-07-19",
            "productType": "double-starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-spinosaurus",
                  "ratchet-3-60",
                  "bit-flat",
                  "blade-quetzalcoatlus",
                  "ratchet-3-80",
                  "bit-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-ROCKLEONE",
            "catalogCode": "BX-00",
            "name": "RockLeone 6-80GN",
            "releaseDate": "2025-07-19",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-rock-leone",
                  "ratchet-6-80",
                  "bit-gear-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-00-PEGASUS-RED",
            "catalogCode": "CX-00",
            "name": "PegasusBlast ATr Metal Coat: Red",
            "releaseDate": "2025-08-03",
            "productType": "starter",
            "line": "CX",
            "limited": true,
            "parts": [
                  "lock-pegasus",
                  "main-blast",
                  "assist-assault",
                  "integrated-turbo"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-00-WIZARD-BLACK",
            "catalogCode": "CX-00",
            "name": "WizardArc R4-55LO Metal Coat: Black",
            "releaseDate": "2025-08-09",
            "productType": "booster",
            "line": "CX",
            "limited": true,
            "parts": [
                  "lock-wizard",
                  "main-arc",
                  "assist-round",
                  "ratchet-4-55",
                  "bit-low-orb"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-45",
            "catalogCode": "BX-45",
            "name": "SamuraiCalibur 6-70M",
            "releaseDate": "2025-08-09",
            "productType": "booster",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-samurai-calibur",
                  "ratchet-6-70",
                  "bit-merge"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-15",
            "catalogCode": "UX-15",
            "name": "SharkScale Deck Set",
            "releaseDate": "2025-08-09",
            "productType": "deck-set",
            "line": "UX",
            "limited": false,
            "parts": [],
            "variants": [],
            "inventoryMode": "catalog",
            "contentsNote": "Official three-line deck set. Mark the box owned; use the loose-parts ledger to confirm opened contents."
      },
      {
            "id": "CX-09",
            "catalogCode": "CX-09",
            "name": "SolEclipse D5-70TK",
            "releaseDate": "2025-09-27",
            "productType": "starter",
            "line": "CX",
            "limited": false,
            "parts": [
                  "lock-sol",
                  "main-eclipse",
                  "assist-dual",
                  "ratchet-5-70",
                  "bit-trans-kick"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-46",
            "catalogCode": "BX-46",
            "name": "Battle Entry Set Infinity",
            "releaseDate": "2025-10-11",
            "productType": "entry-set",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-cobalt-drake",
                  "ratchet-9-60",
                  "bit-rush",
                  "blade-tackle-goat",
                  "ratchet-7-70",
                  "bit-taper"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": "Includes CobaltDrake 9-60R and TackleGoat 7-70T plus Infinity Stadium and launchers."
      },
      {
            "id": "UX-16",
            "catalogCode": "UX-16",
            "name": "Random Booster ClockMirage Select",
            "releaseDate": "2025-10-11",
            "productType": "random-select",
            "line": "UX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "ClockMirage 9-65B — color 1",
                        "parts": [
                              "blade-clock-mirage",
                              "ratchet-9-65",
                              "bit-ball"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "ClockMirage 9-65B — color 2",
                        "parts": [
                              "blade-clock-mirage",
                              "ratchet-9-65",
                              "bit-ball"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "ClockMirage 9-65B — color 3",
                        "parts": [
                              "blade-clock-mirage",
                              "ratchet-9-65",
                              "bit-ball"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "CX-10",
            "catalogCode": "CX-10",
            "name": "WolfHunt F0-60DB",
            "releaseDate": "2025-11-01",
            "productType": "booster",
            "line": "CX",
            "limited": false,
            "parts": [
                  "lock-wolf",
                  "main-hunt",
                  "assist-free",
                  "ratchet-0-60",
                  "bit-disk-ball"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-11",
            "catalogCode": "CX-11",
            "name": "EmperorMight Deck Set",
            "releaseDate": "2025-11-01",
            "productType": "deck-set",
            "line": "CX",
            "limited": false,
            "parts": [],
            "variants": [],
            "inventoryMode": "catalog",
            "contentsNote": "Official three-Bey Custom Line deck set. Mark owned; confirm any recolor-specific loose parts in the ledger."
      },
      {
            "id": "BX-00-BITSET-SILVER",
            "catalogCode": "BX-00",
            "name": "Bit Set F/T/B/N Silver × White",
            "releaseDate": "2025-11-15",
            "productType": "part-set",
            "line": "BX",
            "limited": true,
            "parts": [
                  "bit-flat",
                  "bit-taper",
                  "bit-ball",
                  "bit-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-17",
            "catalogCode": "UX-17",
            "name": "MeteorDragoon 3-70J",
            "releaseDate": "2025-12-27",
            "productType": "starter",
            "line": "UX",
            "limited": false,
            "parts": [
                  "blade-meteor-dragoon",
                  "ratchet-3-70",
                  "bit-jolt"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-18",
            "catalogCode": "UX-18",
            "name": "Random Booster Vol.8",
            "releaseDate": "2025-12-27",
            "productType": "random-booster",
            "line": "UX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "MummyCurse 7-55W",
                        "parts": [
                              "blade-mummy-curse",
                              "ratchet-7-55",
                              "bit-wedge"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "MummyCurse 4-60C",
                        "parts": [
                              "blade-mummy-curse",
                              "ratchet-4-60",
                              "bit-cyclone"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "PegasusBrush M3-85W",
                        "parts": [
                              "lock-pegasus",
                              "main-brush",
                              "assist-massive",
                              "ratchet-3-85",
                              "bit-wedge"
                        ]
                  },
                  {
                        "id": "04",
                        "name": "SolBrave C9-70TP",
                        "parts": [
                              "lock-sol",
                              "main-brave",
                              "assist-charge",
                              "ratchet-9-70",
                              "bit-trans-point"
                        ]
                  },
                  {
                        "id": "05",
                        "name": "DranDagger 7-55G",
                        "parts": [
                              "blade-dran-dagger",
                              "ratchet-7-55",
                              "bit-glide"
                        ]
                  },
                  {
                        "id": "06",
                        "name": "WeissTiger 4-80LR",
                        "parts": [
                              "blade-weiss-tiger",
                              "ratchet-4-80",
                              "bit-low-rush"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-00-DRAGOONSTORM",
            "catalogCode": "BX-00",
            "name": "DragoonStorm 4-60RA",
            "releaseDate": "2025-12-27",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-dragoon-storm",
                  "ratchet-4-60",
                  "bit-rubber-accel"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-12",
            "catalogCode": "CX-12",
            "name": "PhoenixFlare Z9-80WW",
            "releaseDate": "2026-01-24",
            "productType": "booster",
            "line": "CX",
            "limited": false,
            "parts": [
                  "lock-phoenix",
                  "main-flare",
                  "assist-zillion",
                  "ratchet-9-80",
                  "bit-wall-wedge"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-48",
            "catalogCode": "BX-48",
            "name": "Random Booster Vol.9",
            "releaseDate": "2026-02-14",
            "productType": "random-booster",
            "line": "BX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "CobaltDragoon 9-80F",
                        "parts": [
                              "blade-cobalt-dragoon",
                              "ratchet-9-80",
                              "bit-flat"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "SharkEdge 4-70E",
                        "parts": [
                              "blade-shark-edge",
                              "ratchet-4-70",
                              "bit-elevate"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "MammothTusk 7-60S",
                        "parts": [
                              "blade-mammoth-tusk",
                              "ratchet-7-60",
                              "bit-spike"
                        ]
                  },
                  {
                        "id": "04",
                        "name": "HellsScythe 3-85GB",
                        "parts": [
                              "blade-hells-scythe",
                              "ratchet-3-85",
                              "bit-gear-ball"
                        ]
                  },
                  {
                        "id": "05",
                        "name": "DranBuster 2-80Q",
                        "parts": [
                              "blade-dran-buster",
                              "ratchet-2-80",
                              "bit-quake"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "UX-00-AEROPEGASUS-RED",
            "catalogCode": "UX-00",
            "name": "AeroPegasus 3-70A Red Ver.",
            "releaseDate": "2026-02-21",
            "productType": "booster",
            "line": "UX",
            "limited": true,
            "parts": [
                  "blade-aero-pegasus",
                  "ratchet-3-70",
                  "bit-accel"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-DRANSWORD-JLEAGUE",
            "catalogCode": "BX-00",
            "name": "DranSword 1-60V J.League Ver.",
            "releaseDate": "2026-03-14",
            "productType": "starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-dran-sword",
                  "ratchet-1-60",
                  "bit-vortex"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-COBALTDRAGOON-JLEAGUE",
            "catalogCode": "BX-00",
            "name": "CobaltDragoon 9-60F J.League Ver.",
            "releaseDate": "2026-03-14",
            "productType": "starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-cobalt-dragoon",
                  "ratchet-9-60",
                  "bit-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-13",
            "catalogCode": "CX-13",
            "name": "BahamutBlitz BK1-50I",
            "releaseDate": "2026-03-28",
            "productType": "starter",
            "line": "CX",
            "limited": false,
            "parts": [
                  "lock-bahamut",
                  "metal-blitz",
                  "over-break",
                  "assist-knuckle",
                  "ratchet-1-50",
                  "bit-ignition"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-14",
            "catalogCode": "CX-14",
            "name": "KnightFortress GV8-70UN",
            "releaseDate": "2026-03-28",
            "productType": "starter",
            "line": "CX",
            "limited": false,
            "parts": [
                  "lock-knight",
                  "metal-fortress",
                  "over-guard",
                  "assist-vertical",
                  "ratchet-8-70",
                  "bit-under-needle"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-15",
            "catalogCode": "CX-15",
            "name": "RagnaRage FE4-55Y",
            "releaseDate": "2026-03-28",
            "productType": "booster",
            "line": "CX",
            "limited": false,
            "parts": [
                  "lock-ragna",
                  "metal-rage",
                  "over-flow",
                  "assist-erase",
                  "ratchet-4-55",
                  "bit-yielding"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-16",
            "catalogCode": "CX-16",
            "name": "Start Dash Set C",
            "releaseDate": "2026-03-28",
            "productType": "entry-set",
            "line": "CX",
            "limited": false,
            "parts": [
                  "lock-bahamut",
                  "metal-blitz",
                  "over-break",
                  "assist-knuckle",
                  "ratchet-1-50",
                  "bit-ignition"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": "Includes a special-color BahamutBlitz BK1-50I plus stadium, launcher, and grip."
      },
      {
            "id": "BX-00-STORMSPRIGGAN",
            "catalogCode": "BX-00",
            "name": "StormSpriggan 2-70M",
            "releaseDate": "2026-03-28",
            "productType": "starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-storm-spriggan",
                  "ratchet-2-70",
                  "bit-merge"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-19",
            "catalogCode": "UX-19",
            "name": "BulletGriffon H",
            "releaseDate": "2026-04-25",
            "productType": "starter",
            "line": "UX",
            "limited": false,
            "parts": [
                  "rib-bullet-griffon",
                  "bit-hexa"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-00-SCORPIO-MAGENTA",
            "catalogCode": "UX-00",
            "name": "ScorpioSpear 0-70Z Metal Coat: Magenta",
            "releaseDate": "2026-04-25",
            "productType": "booster",
            "line": "UX",
            "limited": true,
            "parts": [
                  "blade-scorpio-spear",
                  "ratchet-0-70",
                  "bit-zap"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-17",
            "catalogCode": "CX-17",
            "name": "Random Booster Vol.10",
            "releaseDate": "2026-04-25",
            "productType": "random-booster",
            "line": "CX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "UnicornDelta PO3-60GU",
                        "parts": [
                              "lock-unicorn",
                              "metal-delta",
                              "over-peak",
                              "assist-odd",
                              "ratchet-3-60",
                              "bit-gear-unite"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "UnicornDelta PO1-80GR",
                        "parts": [
                              "lock-unicorn",
                              "metal-delta",
                              "over-peak",
                              "assist-odd",
                              "ratchet-1-80",
                              "bit-gear-rush"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "SamuraiSaber 9-65LO",
                        "parts": [
                              "blade-samurai-saber",
                              "ratchet-9-65",
                              "bit-low-orb"
                        ]
                  },
                  {
                        "id": "04",
                        "name": "HellsHammer 3-85GU",
                        "parts": [
                              "blade-hells-hammer",
                              "ratchet-3-85",
                              "bit-gear-unite"
                        ]
                  },
                  {
                        "id": "05",
                        "name": "TyrannoBeat 3-60N",
                        "parts": [
                              "blade-tyranno-beat",
                              "ratchet-3-60",
                              "bit-needle"
                        ]
                  },
                  {
                        "id": "06",
                        "name": "CrimsonGaruda 7-80GU",
                        "parts": [
                              "blade-crimson-garuda",
                              "ratchet-7-80",
                              "bit-gear-unite"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "BX-49",
            "catalogCode": "BX-49",
            "name": "DranStrike 4-50FF",
            "releaseDate": "2026-05-16",
            "productType": "starter",
            "line": "BX",
            "limited": false,
            "parts": [
                  "blade-dran-strike",
                  "ratchet-4-50",
                  "bit-free-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-00-DRANBRAVE-BLACK",
            "catalogCode": "CX-00",
            "name": "DranBrave S6-60V Metal Coat: Black",
            "releaseDate": "2026-05-30",
            "productType": "booster",
            "line": "CX",
            "limited": true,
            "parts": [
                  "lock-dran",
                  "main-brave",
                  "assist-slash",
                  "ratchet-6-60",
                  "bit-vortex"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-00-SAMURAI-BLUE",
            "catalogCode": "UX-00",
            "name": "SamuraiSaber 5-60K Samurai Blue Ver.",
            "releaseDate": "2026-06-13",
            "productType": "starter",
            "line": "UX",
            "limited": true,
            "parts": [
                  "blade-samurai-saber",
                  "ratchet-5-60",
                  "bit-kick"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-18",
            "catalogCode": "CX-18",
            "name": "Random Booster BrachioWhip Select",
            "releaseDate": "2026-06-13",
            "productType": "random-select",
            "line": "CX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "BrachioWhip OW5-70Nr — color 1",
                        "parts": [
                              "lock-brachio",
                              "metal-whip",
                              "over-outer",
                              "assist-wheel",
                              "ratchet-5-70",
                              "bit-narrow"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "BrachioWhip OW5-70Nr — color 2",
                        "parts": [
                              "lock-brachio",
                              "metal-whip",
                              "over-outer",
                              "assist-wheel",
                              "ratchet-5-70",
                              "bit-narrow"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "BrachioWhip OW5-70Nr — color 3",
                        "parts": [
                              "lock-brachio",
                              "metal-whip",
                              "over-outer",
                              "assist-wheel",
                              "ratchet-5-70",
                              "bit-narrow"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "CX-00-BUCKS",
            "catalogCode": "CX-00",
            "name": "BucksAntlers B2-60D",
            "releaseDate": "2026-07-09",
            "productType": "booster",
            "line": "CX",
            "limited": true,
            "parts": [
                  "lock-bucks",
                  "main-antlers",
                  "assist-bumper",
                  "ratchet-2-60",
                  "bit-dot"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-00-KRAKEN",
            "catalogCode": "CX-00",
            "name": "KrakenWriggle S3-70O",
            "releaseDate": "2026-07-09",
            "productType": "booster",
            "line": "CX",
            "limited": true,
            "parts": [
                  "lock-kraken",
                  "main-wriggle",
                  "assist-slash",
                  "ratchet-3-70",
                  "bit-orb"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-00-HORNET",
            "catalogCode": "CX-00",
            "name": "HornetFort R7-60T",
            "releaseDate": "2026-07-09",
            "productType": "booster",
            "line": "CX",
            "limited": true,
            "parts": [
                  "lock-hornet",
                  "main-fort",
                  "assist-round",
                  "ratchet-7-60",
                  "bit-taper"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-00-DRAKE",
            "catalogCode": "CX-00",
            "name": "DrakeBrave G4-70I",
            "releaseDate": "2026-07-09",
            "productType": "booster",
            "line": "CX",
            "limited": true,
            "parts": [
                  "lock-drake",
                  "main-brave",
                  "assist-gravity",
                  "ratchet-4-70",
                  "bit-ignition"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-STORMPEGASIS",
            "catalogCode": "BX-00",
            "name": "StormPegasis 3-70RA",
            "releaseDate": "2026-07-11",
            "productType": "starter",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-storm-pegasis",
                  "ratchet-3-70",
                  "bit-rubber-accel"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-50",
            "catalogCode": "BX-50",
            "name": "Random Booster Vol.11",
            "releaseDate": "2026-07-11",
            "productType": "random-booster",
            "line": "BX",
            "limited": false,
            "parts": [],
            "variants": [
                  {
                        "id": "01",
                        "name": "HeavensRing 0-80DS",
                        "parts": [
                              "blade-heavens-ring",
                              "ratchet-0-80",
                              "bit-disk-spike"
                        ]
                  },
                  {
                        "id": "02",
                        "name": "HeavensRing 6-60TP",
                        "parts": [
                              "blade-heavens-ring",
                              "ratchet-6-60",
                              "bit-trans-point"
                        ]
                  },
                  {
                        "id": "03",
                        "name": "ImpactDrake 7-55FB",
                        "parts": [
                              "blade-impact-drake",
                              "ratchet-7-55",
                              "bit-free-ball"
                        ]
                  },
                  {
                        "id": "04",
                        "name": "GhostCircle M-85DS",
                        "parts": [
                              "blade-ghost-circle",
                              "ratchet-m-85",
                              "bit-disk-spike"
                        ]
                  },
                  {
                        "id": "05",
                        "name": "WolfFlame D9-65L",
                        "parts": [
                              "lock-wolf",
                              "main-flame",
                              "assist-dual",
                              "ratchet-9-65",
                              "bit-level"
                        ]
                  },
                  {
                        "id": "06",
                        "name": "CerberusReaper B0-80WB",
                        "parts": [
                              "lock-cerberus",
                              "main-reaper",
                              "assist-bumper",
                              "ratchet-0-80",
                              "bit-wall-ball"
                        ]
                  }
            ],
            "inventoryMode": "variant",
            "contentsNote": ""
      },
      {
            "id": "UX-20",
            "catalogCode": "UX-20",
            "name": "GloryValkyrie LF",
            "releaseDate": "2026-07-11",
            "productType": "starter",
            "line": "UX",
            "limited": false,
            "parts": [
                  "rib-glory-valkyrie",
                  "bit-low-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "BX-00-DRANSWORD-V2",
            "catalogCode": "BX-00",
            "name": "DranSword 3-60F Version 2.0",
            "releaseDate": "2026-08-08",
            "productType": "booster",
            "line": "BX",
            "limited": true,
            "parts": [
                  "blade-dran-sword",
                  "ratchet-3-60",
                  "bit-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "UX-21",
            "catalogCode": "UX-21",
            "name": "HellsNether Deck Set",
            "releaseDate": "2026-08-08",
            "productType": "deck-set",
            "line": "UX",
            "limited": false,
            "parts": [
                  "rib-hells-nether",
                  "blade-silver-wolf",
                  "ratchet-9-70",
                  "bit-rush",
                  "ratchet-8-80",
                  "bit-ball"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": "Announced deck set; only officially identified performance parts are mapped until release verification."
      },
      {
            "id": "UX-00-GLORY-BLUE",
            "catalogCode": "UX-00",
            "name": "GloryValkyrie LF Metal Coat: Blue",
            "releaseDate": "2026-08-29",
            "productType": "starter",
            "line": "UX",
            "limited": true,
            "parts": [
                  "rib-glory-valkyrie",
                  "bit-low-flat"
            ],
            "variants": [],
            "inventoryMode": "exact",
            "contentsNote": ""
      },
      {
            "id": "CX-00-EVA",
            "catalogCode": "CX-00",
            "name": "Evangelion Deck Set",
            "releaseDate": "2026-08-29",
            "productType": "deck-set",
            "line": "CX",
            "limited": true,
            "parts": [],
            "variants": [],
            "inventoryMode": "catalog",
            "contentsNote": "Announced collaboration set. Exact performance-part mapping will remain locked until official release verification."
      },
      {
            "id": "CX-00-TIGARAGE",
            "catalogCode": "CX-00",
            "name": "TigaRage FT3-60T",
            "releaseDate": "2026-09-12",
            "productType": "starter",
            "line": "CX",
            "limited": true,
            "parts": [],
            "variants": [],
            "inventoryMode": "catalog",
            "contentsNote": "Announced product. Exact expanded Custom Line component mapping will be verified at release."
      }
],

    sources: [
      { label: 'Takara Tomy — official Beyblade X regulation', kind: 'rules', url: 'https://beyblade.takaratomy.co.jp/beyblade-x/_image/regulation.pdf', note: 'Regulation v12, effective March/April 2026 publication cycle.' },
      { label: 'Takara Tomy — official product lineup', kind: 'catalog', url: 'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/', note: 'Official Takara Tomy Japan products containing at least one Beyblade performance part checked through 2026-07-20; accessory-only releases are excluded, and announced products with Bey parts are listed separately.' },
      { label: 'World Beyblade Organization — Beyblade X rules', kind: 'rules', url: 'https://worldbeyblade.org/Thread-Beyblade-X-Rules', note: 'Used for optional WBO profiles; event-specific rules still control.' },
      { label: 'Beyblade Wiki — Basic, Unique, and Custom Line part lists', kind: 'catalog', note: 'Secondary catalog cross-check; official sources take precedence.' },
      { label: 'Beyblade Planner — part list cross-check', kind: 'catalog', note: 'Secondary cross-check for legacy part coverage.' },
      { label: 'A. C. Or — The Dynamics of a Tippe Top', kind: 'engineering', url: 'https://hal.science/hal-01975393v1/file/Or93.pdf', note: 'Contact friction and rotational dynamics inform the model boundaries.' },
      { label: 'SIAM News — Spinning Tops in Spinning Frames', kind: 'engineering', url: 'https://www.siam.org/publications/siam-news/articles/spinning-tops-in-spinning-frames/', note: 'Classical top stability, precession, and nutation background.' }
    ]
  };

  // Keep official releases that contain at least one Beyblade performance part. Accessory-only releases never enter the library.
  const today = data.meta.verifiedThrough;
  const explicitBeyCounts = {
    'UX-07': 3,
    'UX-00-DRAN-DECK': 3,
    'BX-00-25TH': 4,
    'UX-15': 3,
    'CX-11': 3,
    'CX-00-EVA': 3,
    'CX-00-TIGARAGE': 1
  };
  const categoryByPartId = Object.fromEntries(data.parts.map((entry) => [entry.id, entry.category]));
  const inferBeyCountFromParts = (partIds = []) => {
    const counts = {};
    partIds.forEach((id) => {
      const category = categoryByPartId[id];
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
  const inferProductBeyCount = (product) => {
    if (Number.isFinite(Number(product.beyCount))) return Math.max(0, Math.floor(Number(product.beyCount)));
    if (explicitBeyCounts[product.id]) return explicitBeyCounts[product.id];
    if (Array.isArray(product.variants) && product.variants.length) {
      return product.variants.some((variant) => inferBeyCountFromParts(variant.parts || []) > 0) ? 1 : 0;
    }
    return inferBeyCountFromParts(product.parts || []);
  };
  const beyPartCategories = new Set(['blade','ratchetIntegratedBlade','lockChip','metalBlade','overBlade','mainBlade','assistBlade','ratchet','bit','integratedBit']);
  const inferBeyPartCount = (product) => [...(product.parts || []), ...(product.variants || []).flatMap((variant) => variant.parts || [])]
    .filter((id) => beyPartCategories.has(categoryByPartId[id])).length;

  data.products = data.products.map((product) => {
    const normalized = {
      ...product,
      line: product.line || String(product.catalogCode || product.id).split('-')[0],
      productType: product.productType || 'product',
      limited: Boolean(product.limited),
      parts: Array.isArray(product.parts) ? product.parts : [],
      variants: Array.isArray(product.variants) ? product.variants : [],
      inventoryMode: product.inventoryMode || (product.variants?.length ? 'variant' : (product.parts?.length ? 'exact' : 'catalog')),
      releaseYear: String(product.releaseDate || '').slice(0, 4),
      status: product.releaseDate && product.releaseDate > today ? 'announced' : (product.status || 'released')
    };
    const beyCount = inferProductBeyCount(normalized);
    const beyPartCount = inferBeyPartCount(normalized);
    return { ...normalized, beyCount, beyPartCount, containsBey: beyCount > 0, containsBeyParts: beyCount > 0 || beyPartCount > 0 };
  }).filter((product) => product.containsBeyParts)
    .sort((a, b) => String(a.releaseDate || '').localeCompare(String(b.releaseDate || '')) || String(a.catalogCode || a.id).localeCompare(String(b.catalogCode || b.id)));


  const seen = new Set();
  data.parts = data.parts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  root.XDATA = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
