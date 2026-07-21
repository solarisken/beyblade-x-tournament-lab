(function (root) {
  'use strict';

  const p = (id, name, category, role, stats = {}, extra = {}) => ({
    id, name, category, role,
    line: extra.line || 'Basic/Unique',
    code: extra.code || '',
    status: extra.status || 'released',
    notes: extra.notes || '',
    attackMovement: Boolean(extra.attackMovement),
    spin: extra.spin || 'right',
    stats: {
      impact: stats.impact || 0,
      stamina: stats.stamina || 0,
      defense: stats.defense || 0,
      control: stats.control || 0,
      recoil: stats.recoil || 0,
      selfKo: stats.selfKo || 0,
      burst: stats.burst || 0
    }
  });

  const stock = (id, name, releaseDate, parts, extra = {}) => ({
    id, name, releaseDate, parts,
    line: extra.line || id.split('-')[0],
    type: extra.type || 'Starter / Booster',
    status: extra.status || 'released',
    note: extra.note || ''
  });

  const data = {
    meta: {
      appName: 'X Command Center',
      version: '1.1.0',
      schemaVersion: 2,
      verifiedThrough: '2026-07-20',
      rulesLabel: 'Takara Tomy Regulation v12 / WBO X rules checked 2026-07-20',
      catalogNotice: 'The bundled product list is a verified starter catalog, not a claim of exhaustive global inventory. Add loose parts or import a catalog patch for products not yet bundled.'
    },
    categories: [
      ['blade', 'Blade'],
      ['ratchetIntegratedBlade', 'Ratchet-integrated blade'],
      ['lockChip', 'Lock chip'],
      ['mainBlade', 'Main blade'],
      ['metalBlade', 'Metal blade'],
      ['overBlade', 'Over blade'],
      ['assistBlade', 'Assist blade'],
      ['ratchet', 'Ratchet'],
      ['bit', 'Bit']
    ].map(([id, label]) => ({ id, label })),
    scoring: { spin: 1, over: 2, burst: 2, xtreme: 3 },
    stadiums: ['Xtreme Stadium', 'Wide Xtreme Stadium', 'Infinity Stadium', 'Hasbro Xtreme Beystadium', 'Other / custom'],
    archetypes: [
      { id: 'attack', name: 'Attack' },
      { id: 'stamina', name: 'Stamina' },
      { id: 'defense', name: 'Defense' },
      { id: 'balance', name: 'Balance' },
      { id: 'left-spin', name: 'Left-spin' }
    ],
    profiles: [
      { id: 'tt-v12', name: 'Takara Tomy 3on3 — Regulation v12', deckSize: 3, noDuplicateParts: true, targetPoints: 4, basicLockRepeats: true },
      { id: 'wbo-standard', name: 'WBO X 3on3 — standard', deckSize: 3, noDuplicateParts: true, targetPoints: 4, basicLockRepeats: true },
      { id: 'lab', name: 'Open laboratory profile', deckSize: 3, noDuplicateParts: false, targetPoints: 4, basicLockRepeats: true }
    ],
    parts: [
      // Basic and Unique blades
      p('blade-dran-sword','DranSword','blade','attack',{impact:7,stamina:3,defense:3,control:4,recoil:6,selfKo:5,burst:3}),
      p('blade-hells-scythe','HellsScythe','blade','stamina',{impact:3,stamina:7,defense:5,control:6,recoil:3,selfKo:2,burst:4}),
      p('blade-wizard-arrow','WizardArrow','blade','stamina',{impact:2,stamina:7,defense:4,control:7,recoil:2,selfKo:2,burst:4}),
      p('blade-knight-shield','KnightShield','blade','defense',{impact:3,stamina:5,defense:7,control:6,recoil:3,selfKo:2,burst:5}),
      p('blade-knight-lance','KnightLance','blade','defense',{impact:4,stamina:4,defense:7,control:5,recoil:4,selfKo:3,burst:5}),
      p('blade-shark-edge','SharkEdge','blade','attack',{impact:8,stamina:2,defense:2,control:3,recoil:8,selfKo:7,burst:3}),
      p('blade-phoenix-wing','PhoenixWing','blade','attack',{impact:9,stamina:4,defense:5,control:5,recoil:7,selfKo:5,burst:5}),
      p('blade-cobalt-dragoon','CobaltDragoon','blade','attack',{impact:8,stamina:5,defense:4,control:4,recoil:7,selfKo:6,burst:5},{spin:'left'}),
      p('blade-whale-wave','WhaleWave','blade','attack',{impact:8,stamina:4,defense:5,control:4,recoil:7,selfKo:5,burst:5}),
      p('blade-tyranno-beat','TyrannoBeat','blade','attack',{impact:8,stamina:4,defense:5,control:4,recoil:7,selfKo:5,burst:5}),
      p('blade-unicorn-sting','UnicornSting','blade','balance',{impact:5,stamina:6,defense:5,control:6,recoil:4,selfKo:3,burst:5}),
      p('blade-wyvern-gale','WyvernGale','blade','stamina',{impact:2,stamina:7,defense:5,control:6,recoil:2,selfKo:2,burst:4}),
      p('blade-sphinx-cowl','SphinxCowl','blade','defense',{impact:3,stamina:5,defense:7,control:5,recoil:4,selfKo:3,burst:5}),
      p('blade-black-shell','BlackShell','blade','defense',{impact:4,stamina:4,defense:8,control:5,recoil:4,selfKo:3,burst:6}),
      p('blade-dran-buster','DranBuster','blade','attack',{impact:10,stamina:2,defense:3,control:3,recoil:9,selfKo:7,burst:4},{line:'Unique'}),
      p('blade-hells-hammer','HellsHammer','blade','balance',{impact:6,stamina:4,defense:6,control:5,recoil:5,selfKo:4,burst:5},{line:'Unique'}),
      p('blade-wizard-rod','WizardRod','blade','stamina',{impact:3,stamina:10,defense:7,control:8,recoil:2,selfKo:2,burst:6},{line:'Unique'}),
      p('blade-shinobi-shadow','ShinobiShadow','blade','defense',{impact:3,stamina:5,defense:8,control:7,recoil:3,selfKo:2,burst:6},{line:'Unique'}),
      p('blade-leon-crest','LeonCrest','blade','defense',{impact:4,stamina:5,defense:9,control:6,recoil:4,selfKo:3,burst:6},{line:'Unique'}),
      p('blade-silver-wolf','SilverWolf','blade','stamina',{impact:4,stamina:9,defense:7,control:8,recoil:3,selfKo:2,burst:6},{line:'Unique'}),
      p('blade-samurai-saber','SamuraiSaber','blade','attack',{impact:8,stamina:4,defense:4,control:5,recoil:7,selfKo:5,burst:5},{line:'Unique'}),
      p('blade-impact-drake','ImpactDrake','blade','attack',{impact:10,stamina:3,defense:5,control:4,recoil:8,selfKo:6,burst:5},{line:'Unique'}),
      p('blade-knight-mail','KnightMail','blade','defense',{impact:4,stamina:6,defense:9,control:7,recoil:3,selfKo:2,burst:7},{line:'Unique'}),
      p('blade-aero-pegasus','AeroPegasus','blade','attack',{impact:9,stamina:6,defense:5,control:5,recoil:7,selfKo:5,burst:6},{line:'Unique'}),
      p('blade-clock-mirage','ClockMirage','blade','stamina',{impact:3,stamina:9,defense:6,control:8,recoil:2,selfKo:2,burst:6},{line:'Unique'}),
      p('blade-meteor-dragoon','MeteorDragoon','blade','attack',{impact:9,stamina:5,defense:5,control:4,recoil:8,selfKo:6,burst:5},{line:'Unique',spin:'left'}),
      p('rib-bullet-griffon','BulletGriffon H','ratchetIntegratedBlade','balance',{impact:6,stamina:6,defense:6,control:6,recoil:5,selfKo:4,burst:6},{line:'Unique Expand',notes:'Ratchet is integrated. Add only a bit.'}),
      p('rib-glory-valkyrie','GloryValkyrie LF','ratchetIntegratedBlade','attack',{impact:9,stamina:3,defense:4,control:4,recoil:8,selfKo:7,burst:6},{line:'Unique Expand',notes:'Ratchet is integrated. Add only a bit.'}),

      // Custom Line lock chips
      ...['Bahamut','Cerberus','Dran','Hells','Knight','Leon','Pegasus','Phoenix','Rhino','Unicorn','Valkyrie','Whale','Wolf','Wizard'].map(name => p(`lock-${name.toLowerCase()}`,name,'lockChip','balance',{control:1,burst:1},{line:'Custom'})),
      // Custom Line main blades
      p('main-blast','Blast','mainBlade','attack',{impact:7,stamina:2,defense:3,control:3,recoil:7,selfKo:5},{line:'Custom'}),
      p('main-brave','Brave','mainBlade','attack',{impact:8,stamina:3,defense:4,control:4,recoil:7,selfKo:5},{line:'Custom'}),
      p('main-flame','Flame','mainBlade','attack',{impact:8,stamina:3,defense:4,control:4,recoil:7,selfKo:5},{line:'Custom'}),
      p('main-fort','Fort','mainBlade','defense',{impact:3,stamina:5,defense:8,control:6,recoil:3,selfKo:2},{line:'Custom'}),
      p('main-hunt','Hunt','mainBlade','balance',{impact:5,stamina:6,defense:5,control:6,recoil:4,selfKo:3},{line:'Custom'}),
      p('main-reaper','Reaper','mainBlade','attack',{impact:8,stamina:3,defense:4,control:4,recoil:7,selfKo:5},{line:'Custom'}),
      p('main-wriggle','Wriggle','mainBlade','stamina',{impact:3,stamina:8,defense:5,control:7,recoil:3,selfKo:2},{line:'Custom'}),
      // Expanded Custom Line
      p('metal-blitz','Blitz','metalBlade','attack',{impact:7,stamina:3,defense:4,control:4,recoil:6,selfKo:4},{line:'Custom Expanded'}),
      p('metal-fortress','Fortress','metalBlade','defense',{impact:3,stamina:5,defense:8,control:6,recoil:3,selfKo:2},{line:'Custom Expanded'}),
      p('metal-rage','Rage','metalBlade','stamina',{impact:4,stamina:8,defense:6,control:7,recoil:3,selfKo:2},{line:'Custom Expanded'}),
      p('over-break','Break','overBlade','attack',{impact:3,recoil:2,selfKo:1},{line:'Custom Expanded',code:'B'}),
      p('over-flow','Flow','overBlade','stamina',{stamina:3,control:2},{line:'Custom Expanded',code:'F'}),
      p('over-guard','Guard','overBlade','defense',{defense:3,control:2},{line:'Custom Expanded',code:'G'}),
      p('over-outer','Outer','overBlade','balance',{impact:1,stamina:1,defense:1,control:1},{line:'Custom Expanded',code:'O'}),
      // Full assist names
      p('assist-assault','Assault','assistBlade','attack',{impact:3,recoil:2,selfKo:1},{line:'Custom',code:'A'}),
      p('assist-bumper','Bumper','assistBlade','defense',{defense:3,control:1},{line:'Custom',code:'B'}),
      p('assist-dual','Dual','assistBlade','balance',{impact:1,stamina:1,defense:1,control:1},{line:'Custom',code:'D'}),
      p('assist-free','Free','assistBlade','stamina',{stamina:3,control:2},{line:'Custom',code:'F'}),
      p('assist-gravity','Gravity','assistBlade','stamina',{stamina:3,defense:1},{line:'Custom',code:'G'}),
      p('assist-heavy','Heavy','assistBlade','defense',{defense:3,burst:1},{line:'Custom',code:'H'}),
      p('assist-jaggy','Jaggy','assistBlade','attack',{impact:3,recoil:2,selfKo:1},{line:'Custom',code:'J'}),
      p('assist-knuckle','Knuckle','assistBlade','attack',{impact:3,control:1,recoil:1},{line:'Custom',code:'K'}),
      p('assist-massive','Massive','assistBlade','defense',{defense:3,stamina:1},{line:'Custom',code:'M'}),
      p('assist-round','Round','assistBlade','defense',{defense:2,stamina:2,control:1},{line:'Custom',code:'R'}),
      p('assist-slash','Slash','assistBlade','attack',{impact:3,recoil:2,selfKo:1},{line:'Custom',code:'S'}),
      p('assist-turn','Turn','assistBlade','balance',{impact:1,stamina:1,defense:1,control:2},{line:'Custom',code:'T'}),
      p('assist-wheel','Wheel','assistBlade','stamina',{stamina:3,defense:1},{line:'Custom',code:'W'}),

      // Ratchets
      ...[
        ['1-60','attack',2,2],['2-60','balance',1,1],['3-60','balance',1,1],['4-60','balance',1,1],['5-60','balance',1,1],['7-60','defense',0,1],['9-60','stamina',0,1],
        ['1-70','attack',2,3],['3-70','balance',1,2],['4-70','balance',1,2],['5-70','balance',1,2],['7-70','defense',0,2],['9-70','stamina',0,2],
        ['1-80','attack',2,5],['3-80','balance',1,4],['4-80','balance',1,4],['5-80','balance',1,4],['7-80','defense',0,4],['9-80','stamina',0,4]
      ].map(([name,role,impact,selfKo]) => p(`ratchet-${name}`,name,'ratchet',role,{impact,stamina:role==='stamina'?1:0,defense:role==='defense'?1:0,control:0,recoil:selfKo>2?1:0,selfKo,burst:selfKo>2?1:3},{line:'Ratchet'})),

      // Bits
      p('bit-flat','Flat','bit','attack',{impact:4,stamina:1,defense:1,control:2,recoil:3,selfKo:4,burst:1},{code:'F',attackMovement:true}),
      p('bit-low-flat','Low Flat','bit','attack',{impact:5,stamina:1,defense:1,control:2,recoil:4,selfKo:5,burst:1},{code:'LF',attackMovement:true}),
      p('bit-rush','Rush','bit','attack',{impact:4,stamina:3,defense:2,control:5,recoil:2,selfKo:3,burst:2},{code:'R',attackMovement:true}),
      p('bit-low-rush','Low Rush','bit','attack',{impact:5,stamina:2,defense:2,control:4,recoil:3,selfKo:4,burst:2},{code:'LR',attackMovement:true}),
      p('bit-gear-flat','Gear Flat','bit','attack',{impact:5,stamina:1,defense:1,control:2,recoil:4,selfKo:6,burst:1},{code:'GF',attackMovement:true}),
      p('bit-accel','Accel','bit','attack',{impact:5,stamina:2,defense:1,control:3,recoil:4,selfKo:5,burst:1},{code:'A',attackMovement:true}),
      p('bit-point','Point','bit','balance',{impact:3,stamina:5,defense:3,control:5,recoil:2,selfKo:2,burst:2},{code:'P'}),
      p('bit-taper','Taper','bit','balance',{impact:3,stamina:4,defense:3,control:5,recoil:2,selfKo:2,burst:2},{code:'T'}),
      p('bit-level','Level','bit','balance',{impact:4,stamina:4,defense:3,control:5,recoil:2,selfKo:3,burst:2},{code:'L'}),
      p('bit-trans-point','Trans Point','bit','balance',{impact:3,stamina:5,defense:3,control:5,recoil:2,selfKo:2,burst:2},{code:'TP'}),
      p('bit-ball','Ball','bit','stamina',{impact:1,stamina:8,defense:5,control:7,recoil:1,selfKo:1,burst:3},{code:'B'}),
      p('bit-free-ball','Free Ball','bit','stamina',{impact:1,stamina:9,defense:5,control:8,recoil:1,selfKo:1,burst:3},{code:'FB'}),
      p('bit-disk-ball','Disk Ball','bit','stamina',{impact:1,stamina:9,defense:6,control:7,recoil:1,selfKo:1,burst:3},{code:'DB'}),
      p('bit-orb','Orb','bit','stamina',{impact:1,stamina:7,defense:5,control:7,recoil:1,selfKo:1,burst:3},{code:'O'}),
      p('bit-hex','Hexa','bit','defense',{impact:2,stamina:6,defense:8,control:8,recoil:1,selfKo:1,burst:4},{code:'H'}),
      p('bit-high-needle','High Needle','bit','defense',{impact:1,stamina:6,defense:7,control:8,recoil:1,selfKo:1,burst:3},{code:'HN'}),
      p('bit-needle','Needle','bit','defense',{impact:1,stamina:5,defense:7,control:8,recoil:1,selfKo:1,burst:3},{code:'N'}),
      p('bit-gear-needle','Gear Needle','bit','defense',{impact:2,stamina:5,defense:7,control:6,recoil:2,selfKo:2,burst:3},{code:'GN'}),
      p('bit-dot','Dot','bit','defense',{impact:2,stamina:5,defense:7,control:7,recoil:2,selfKo:2,burst:3},{code:'D'}),
      p('bit-bound-spike','Bound Spike','bit','defense',{impact:2,stamina:6,defense:8,control:7,recoil:2,selfKo:2,burst:4},{code:'BS'}),
      p('bit-metal-needle','Metal Needle','bit','defense',{impact:1,stamina:6,defense:7,control:8,recoil:1,selfKo:1,burst:3},{code:'MN',notes:'Check event legality and wear policy.'})
    ],
    products: [
      stock('BX-01','DranSword 3-60F','2023-07-15',['blade-dran-sword','ratchet-3-60','bit-flat'],{type:'Starter'}),
      stock('BX-02','HellsScythe 4-60T','2023-07-15',['blade-hells-scythe','ratchet-4-60','bit-taper'],{type:'Booster'}),
      stock('BX-03','WizardArrow 4-80B','2023-07-15',['blade-wizard-arrow','ratchet-4-80','bit-ball'],{type:'Starter'}),
      stock('BX-04','KnightShield 3-80N','2023-07-15',['blade-knight-shield','ratchet-3-80','bit-needle'],{type:'Booster'}),
      stock('BX-13','KnightLance 4-80HN','2023-10-07',['blade-knight-lance','ratchet-4-80','bit-high-needle'],{type:'Booster'}),
      stock('BX-23','PhoenixWing 9-60GF','2023-12-27',['blade-phoenix-wing','ratchet-9-60','bit-gear-flat'],{type:'Starter'}),
      stock('UX-01','DranBuster 1-60A','2024-03-30',['blade-dran-buster','ratchet-1-60','bit-accel'],{type:'Starter',line:'UX'}),
      stock('UX-02','HellsHammer 3-70H','2024-03-30',['blade-hells-hammer','ratchet-3-70','bit-hex'],{type:'Booster',line:'UX'}),
      stock('UX-03','WizardRod 5-70DB','2024-03-30',['blade-wizard-rod','ratchet-5-70','bit-disk-ball'],{type:'Booster',line:'UX'}),
      stock('UX-04','Battle Entry Set U — DranBuster + WizardRod','2024-04-27',['blade-dran-buster','ratchet-1-60','bit-accel','blade-wizard-rod','ratchet-5-70','bit-disk-ball'],{type:'Battle set',line:'UX'}),
      stock('UX-05','ShinobiShadow 1-80MN','2024-05-18',['blade-shinobi-shadow','ratchet-1-80','bit-metal-needle'],{type:'Random Select',line:'UX'}),
      stock('UX-06','LeonCrest 7-60GN','2024-08-10',['blade-leon-crest','ratchet-7-60','bit-gear-needle'],{type:'Starter',line:'UX'}),
      stock('UX-08','SilverWolf 3-80FB','2024-10-12',['blade-silver-wolf','ratchet-3-80','bit-free-ball'],{type:'Starter',line:'UX'}),
      stock('UX-20','GloryValkyrie LF','2026-07-11',['rib-glory-valkyrie','bit-low-flat'],{type:'Starter',line:'UX'}),
      stock('BX-50-01','HeavensRing 0-80DS','2026-07-11',[],{type:'Random Booster pull',status:'catalog-only',note:'Listed for browsing. Add its exact parts as loose parts until the complete mapped record is imported.'}),
      stock('BX-50-03','ImpactDrake 7-55FB','2026-07-11',['blade-impact-drake','bit-free-ball'],{type:'Random Booster pull',status:'catalog-only',note:'The bundled starter catalog does not infer the unlisted ratchet. Add exact parts manually.'}),
      stock('UX-21','HellsNether Deck Set','2026-08-08',[],{type:'Deck set',line:'UX',status:'announced',note:'Announced product; cannot be marked owned before release verification.'})
    ]
  };

  root.XCC_DATA = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
