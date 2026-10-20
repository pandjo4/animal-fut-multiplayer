'use strict';
/* ==========================================================
   GAME_DATA — sva konfiguracija na jednom mjestu
   ========================================================== */
   
   
   
   
// Online multiplayer connects lazily from multiplayer.js (no connection is opened for offline play).
   
const GAME_DATA = {
  SAVE_KEY: 'wildxi.save',
  SAVE_VERSION: 6,
  STARTER_IDS: ['boulder','antler','granite','coil','gallop','kong','bandit','swing','plume','tusker','rascal'],
  START_COINS: 300,
  RARITIES: ['Common', 'Rare', 'Epic', 'Legendary', 'Dinosaur'],
  RARITY_RANK: { Common: 0, Rare: 1, Epic: 2, Legendary: 3, Dinosaur: 4 },
  DUP_COINS: { Common: 15, Rare: 40, Epic: 100, Legendary: 250, Dinosaur: 2000 },
  // težina pojavljivanja u draftu; posjedovane karte imaju množitelj; Legendary only ako je own
  DRAFT_WEIGHT: { Common: 55, Rare: 30, Epic: 12, Legendary: 4, Dinosaur: 2 },
  DRAFT_OWNED_MULT: 3,
  REWARDS: { qf: 100, sf: 180, final: 300, win: 500 }, // ukupna reward za ostvareni rezultat
  ROUND_NAMES: ['Quarter-final', 'Semi-final', 'Final'],
  DIET: {
    H: { name: 'Herbivore', icon: '🌿', col: '#5fdc8a' },
    C: { name: 'Carnivore', icon: '🥩', col: '#ff6b5e' },
    O: { name: 'Omnivore', icon: '🍽️', col: '#ffbe46' }
  },
  CLASS: { Mammal: '🐾', Insect: '🪳', Bird: '🪶', Reptile: '🦎', Amphibian: '🐸', Arthropod: '🕷️', Fish: '🐟', Mollusk: '🐚', Echinoderm: '⭐', Dinosaur: '🦖' },
  FAMILY: {
    Feline: 'Mačke', Canine: 'Psi', Raptor: 'Grabljivice', Elephant: 'Slonovi', Rhino: 'Nosorozi',
    Crocodilian: 'Krokodili', Bovine: 'Goveda', Equine: 'Konji', Cervid: 'Jeleni', Giraffid: 'Žirafe',
    Bear: 'Medvjedi', Primate: 'Primati', Procyonid: 'Rakuni', Swine: 'Svinje', Mustelid: 'Kune',
    Corvid: 'Vrane', Hippo: 'Nilski konji', Camelid: 'Kamile', Antelope: 'Antilope', Marsupial: 'Tobolčari',
    Lizard: 'Gušteri', Snake: 'Zmije', Turtle: 'Kornjače', Rodent: 'Glodari', Ratite: 'Trkačice',
    Wader: 'Močvarice', Kingfisher: 'Vodomari', Cetacean: 'Kitovi i delfini', Cephalopod: 'Glavonošci', Arachnid: 'Pauci'
  },
  POSITIONS: ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'],
  POS_GROUP: { GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', CDM: 'MID', CM: 'MID', CAM: 'MID', LW: 'ATT', RW: 'ATT', ST: 'ATT' },
  // ponderi atributa za ukupnu ocjenu po poziciji: [pac, sho, pas, def, phy, ref]
  OVR_WEIGHTS: {
    GK:  [.06, 0, .10, .10, .12, .62],
    CB:  [.10, .05, .10, .45, .30, 0],
    LB:  [.25, .08, .20, .32, .15, 0],
    RB:  [.25, .08, .20, .32, .15, 0],
    CDM: [.08, .07, .30, .35, .20, 0],
    CM:  [.15, .20, .35, .15, .15, 0],
    CAM: [.20, .27, .38, .07, .08, 0],
    LW:  [.38, .25, .25, .05, .07, 0],
    RW:  [.38, .25, .25, .05, .07, 0],
    ST:  [.25, .50, .10, 0, .15, 0]
  },
  OUT_OF_POS: { secondary: 3, sameGroup: 9, adjacentGroup: 16, farGroup: 26, gk: 45 },
  CHEM: { // pravila hemije (ne changesti)
    dietSame: 3, dietOmni: 2, dietNone: 0, classSame: 2, familySame: 2,
    maxLink: 7, captainBonus: 3, captainMax: 6,
    // Dinosaur cards: a link with a Dinosaur is never grey. Any match (diet/class/family) = green, min 5 points;
    // nothing in common = yellow, 3 points.
    dinoMatch: 5, dinoNoMatch: 3
  },
  CHEM_GREEN: 5, CHEM_BLUE: 3,
  TRAITS: {
    speedster:   { name: 'Speedster',   icon: '⚡', desc: 'Bolji u kontrama i probojima po krilu.' },
    aerialKing:  { name: 'Aerial King', icon: '🪽', desc: 'Wins more aerial duels and improves headers.' },
    playmaker:   { name: 'Playmaker',   icon: '🎯', desc: 'Creates more chances and provides more assists.' },
    wall:        { name: 'Wall',        icon: '🧱', desc: 'Makes it harder for opponents to create clear chances.' },
    reflexMaster:{ name: 'Reflex Master', icon: '🧤', desc: 'Improves goalkeeper saves.' },
    captain:     { name: 'Captain',     icon: '👑', desc: '+3 chemistry for the team (max +6).' },
    finisher:    { name: 'Finisher',    icon: '🎯', desc: 'Improves chance conversion.' },
    interceptor: { name: 'Interceptor', icon: '✂️', desc: 'Intercepts passes and launches counterattacks.' }
  },
  STYLES: {
    balanced:   { name: 'Balanced',   icon: '⚖️', desc: 'Bez posebnih bonusa.', ctrl: 1, atk: 1, def: 1, wing: 1, through: 1, long: 1, counter: 1, foul: 1, intercept: 0 },
    possession: { name: 'Possession', icon: '🔁', desc: 'More possession and short passing.', ctrl: 1.06, atk: 1, def: 1, wing: .8, through: 1.35, long: .6, counter: .6, foul: .8, intercept: 0 },
    counter:    { name: 'Counter',    icon: '🏃', desc: 'Waits for mistakes and counterattacks.', ctrl: .95, atk: 1.02, def: 1.02, wing: 1, through: 1, long: .9, counter: 1.9, foul: 1, intercept: .03 },
    direct:     { name: 'Direct',     icon: '🎯', desc: 'Crosses, corners, and long-range shots.', ctrl: .97, atk: 1.02, def: 1, wing: 1.6, through: .6, long: 1.5, counter: 1, foul: 1.1, intercept: 0 },
    press:      { name: 'High Press', icon: '🔥', desc: 'Aggressive interceptions, with more fouls.', ctrl: 1.03, atk: 1, def: .98, wing: 1, through: 1, long: 1, counter: 1.25, foul: 1.5, intercept: .05 },
    defensive:  { name: 'Park the Bus', icon: '🚌', desc: 'Deep and compact; dangerous on the counter.', ctrl: .92, atk: .94, def: 1.1, wing: .8, through: .7, long: 1.3, counter: 1.6, foul: 1.05, intercept: .03 },
    wingplay:   { name: 'Wing Play', icon: '🪽', desc: 'Stretches the pitch with crosses from both flanks.', ctrl: 1, atk: 1.02, def: .98, wing: 1.8, through: .6, long: .8, counter: 1, foul: 1, intercept: 0 },
    longball:   { name: 'Long Ball', icon: '🚀', desc: 'Skips midfield with direct long passes.', ctrl: .93, atk: 1.03, def: 1, wing: .8, through: .5, long: 1.9, counter: 1, foul: 1.05, intercept: 0 },
    total:      { name: 'Total Football', icon: '🌀', desc: 'Fluid and aggressive; wins the ball high and plays through the middle.', ctrl: 1.04, atk: 1.03, def: .99, wing: 1.2, through: 1.2, long: .8, counter: 1.1, foul: 1.25, intercept: .02 },
    gegenpress: { name: 'Gegenpress', icon: '⚡', desc: 'Immediately hunts the ball after losing it; intense pressure creates turnovers but costs stamina and discipline.', ctrl: 1.02, atk: 1.04, def: 1.01, wing: 1.05, through: 1.08, long: .85, counter: 1.35, foul: 1.35, intercept: .065 }
  },
  PACKS: [
    { id: 'basic', name: 'Basic Pack', price: 100, icon: '📦', c1: '#5d7a6b', c2: '#2c4437', desc: 'Mostly Common players.', odds: { Common: 85, Rare: 14, Epic: 1, Legendary: 0 } },
    { id: 'rare', name: 'Rare Pack', price: 300, icon: '🎁', c1: '#2f86d6', c2: '#123e73', desc: 'Good chance of Rare, small chance of Epic.', odds: { Common: 30, Rare: 60, Epic: 9.5, Legendary: 0.5 } },
    { id: 'epic', name: 'Epic Pack', price: 750, icon: '💎', c1: '#9b54e6', c2: '#3b1673', desc: 'Good chance of Epic; Legendary is very rare.', odds: { Common: 5, Rare: 40, Epic: 52, Legendary: 3 } },
    { id: 'elite', name: 'Premium Pack', price: 1200, icon: '👑', c1: '#e6b422', c2: '#7a4a05', desc: 'Only Epic cards, with a chance of Legendary.', odds: { Common: 0, Rare: 0, Epic: 95, Legendary: 5 } },
    // Guaranteed contents instead of odds: exactly 1 Dinosaur + 2 Legendary (random order). Only place a Dinosaur can come from a pack.
    { id: 'prehistoric', name: 'Prehistoric Hit Pack', price: 50000, icon: '🦖', c1: '#ff5a3c', c2: '#5a1208', desc: 'Guaranteed: 1 Dinosaur + 2 Legendary players.', odds: {}, guarantee: ['Dinosaur', 'Legendary', 'Legendary'] }
  ],
  // klubovi: fam/diet/cls = tematska sklonost pri slaganju sastava
  CLUBS: [
    { id: 'savanna', name: 'Savanna FC', icon: '🦁', c1: '#e8a21a', c2: '#8a4a05', stadium: 'Pride Park', style: 'possession', fm: ['433', '442'], fam: ['Feline', 'Antelope', 'Equine', 'Giraffid', 'Elephant'] },
    { id: 'wolf', name: 'Wolf United', icon: '🐺', c1: '#6b7d8f', c2: '#222c36', stadium: 'Moonlit Arena', style: 'press', fm: ['442', '352'], fam: ['Canine', 'Bear'], diet: ['C'] },
    { id: 'horns', name: 'Iron Horns', icon: '🦏', c1: '#8a8f93', c2: '#34383b', stadium: 'Horn Fortress', style: 'direct', fm: ['532', '442'], fam: ['Rhino', 'Bovine', 'Cervid'], diet: ['H'] },
    { id: 'sky', name: 'Sky Hunters', icon: '🦅', c1: '#3b8fe0', c2: '#14346b', stadium: 'Aerie Dome', style: 'counter', fm: ['433', '352'], fam: ['Raptor', 'Corvid', 'Kingfisher'], cls: ['Bird'] },
    { id: 'jungle', name: 'Jungle Royals', icon: '🦍', c1: '#2f9e55', c2: '#0f4224', stadium: 'Canopy Ground', style: 'possession', fm: ['433', '352'], fam: ['Primate', 'Feline', 'Procyonid'] },
    { id: 'venom', name: 'Venom XI', icon: '🐍', c1: '#8bd13a', c2: '#2b4a0b', stadium: 'Serpent Pit', style: 'counter', fm: ['442', '532'], fam: ['Snake', 'Lizard', 'Crocodilian', 'Turtle'], cls: ['Reptile'] },
    { id: 'frost', name: 'Frostfang FC', icon: '❄️', c1: '#8fd8f2', c2: '#2a5f78', stadium: 'Glacier Bowl', style: 'press', fm: ['442', '433'], fam: ['Bear', 'Canine', 'Mustelid'] },
    { id: 'wildfire', name: 'Wildfire Athletic', icon: '🔥', c1: '#ff6a2b', c2: '#7a1d05', stadium: 'Ember Stadium', style: 'direct', fm: ['433', '442'], diet: ['C'], fam: ['Feline', 'Mustelid'] },
    { id: 'tundra', name: 'Tundra Rovers', icon: '🦌', c1: '#b8a27a', c2: '#4b3f27', stadium: 'Antler Park', style: 'balanced', fm: ['442', '532'], fam: ['Cervid', 'Camelid', 'Bovine'], diet: ['H'] },
    { id: 'delta', name: 'Delta Dynamos', icon: '🐊', c1: '#3aa58a', c2: '#0c3d33', stadium: 'Riverbank Oval', style: 'direct', fm: ['352', '442'], fam: ['Crocodilian', 'Hippo', 'Wader', 'Rodent'] },
    { id: 'outback', name: 'Outback Rangers', icon: '🦘', c1: '#d9742b', c2: '#6b2f0a', stadium: 'Red Dust Oval', style: 'counter', fm: ['433', '442'], fam: ['Marsupial', 'Ratite', 'Antelope'] },
    { id: 'owls', name: 'Night Owls', icon: '🦉', c1: '#7a5cc9', c2: '#241552', stadium: 'Moonroost', style: 'possession', fm: ['352', '433'], fam: ['Raptor', 'Corvid', 'Wader'], cls: ['Bird'] }
  ]
};

const ASSETS = {
  animal: id => `images/animal/${(PLAYER_BY_ID[id] && PLAYER_BY_ID[id].id) || id}.png`,
  pack: { basic:'images/packs/pack-basic.png', rare:'images/packs/pack-premium.png', epic:'images/packs/pack-legendary.png', elite:'images/packs/pack-elite.png' },
  audio: { matchStart:'audio/match-start.mp3', matchEnd:'audio/match-end.mp3', music:'audio/background-music.mp3' }
};
const MEDIA = {
  music:null, effects:{}, settings:{music:true,effects:true}, unlocked:false,
  init() {
    try { const v=JSON.parse(localStorage.getItem('wildxi.audioSettings')||'{}'); this.settings.music=v.music!==false; this.settings.effects=v.effects!==false; } catch(_) {}
    this.music=ASSETS.audio.music ? new Audio(ASSETS.audio.music) : null; if(this.music){this.music.loop=true;this.music.volume=.22;this.music.preload='none';}
    Object.entries({start:ASSETS.audio.matchStart,end:ASSETS.audio.matchEnd}).forEach(([k,src])=>{const a=new Audio(src);a.preload='none';a.volume=.75;this.effects[k]=a;});
    const unlock=()=>{this.unlocked=true;this.syncMusic();};
    document.addEventListener('pointerdown',unlock,{once:true}); document.addEventListener('keydown',unlock,{once:true});
  },
  save(){try{localStorage.setItem('wildxi.audioSettings',JSON.stringify(this.settings));}catch(_){}},
  syncMusic(){if(!this.music)return;if(this.settings.music&&this.unlocked){const p=this.music.play();if(p&&p.catch)p.catch(()=>{});}else this.music.pause();},
  toggle(k){this.settings[k]=!this.settings[k];this.save();if(k==='music')this.syncMusic();return this.settings[k];},
  play(k){if(!this.settings.effects||!this.effects[k])return;try{const a=this.effects[k];a.pause();a.currentTime=0;const p=a.play();if(p&&p.catch)p.catch(()=>{});}catch(_){}}
};
function animalArt(p, cls='') {
  return `<span class="animal-art ${cls}"><img src="${ASSETS.animal(p.id)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span>${p.emoji}</span></span>`;
}
function packArt(pk) {
  const src=ASSETS.pack[pk.id]||`images/packs/pack-${pk.id}.png`;
  return `<span class="pack-art-img"><img src="${src}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span>${pk.icon}</span></span>`;
}
const SQUAD_COOLDOWN_MS=10000, SQUAD_COOLDOWN_KEY='wildxi.squadGameFinishedAt';
function squadCooldownLeft(){try{return Math.max(0,SQUAD_COOLDOWN_MS-(Date.now()-Number(localStorage.getItem(SQUAD_COOLDOWN_KEY)||0)));}catch(_){return 0;}}
function squadCooldownLabel(){const n=Math.ceil(squadCooldownLeft()/1000);return n>0?`Ponovo možeš igrati za ${n} s`:'⚽ Squad Game — pojedinačni meč';}

// formacije: koordinate u % pitcha (x lijevo→desno, y gore=attack → dolje=gol), graf midfield (indeksi)
GAME_DATA.FORMATIONS = {
  '433': { id: '433', name: '4-3-3', desc: 'Two wingers and a striker; balanced attack and midfield.',
    slots: [['GK',50,90],['LB',14,72],['CB',38,76],['CB',62,76],['RB',86,72],['CM',27,52],['CDM',50,58],['CM',73,52],['LW',17,26],['ST',50,20],['RW',83,26]],
    links: [[0,2],[0,3],[1,2],[2,3],[3,4],[1,5],[2,6],[3,6],[4,7],[5,6],[6,7],[5,8],[7,10],[5,9],[7,9],[8,9],[9,10]] },
  '442': { id: '442', name: '4-4-2', desc: 'Classic shape with a wide midfield and two strikers.',
    slots: [['GK',50,90],['LB',14,72],['CB',38,76],['CB',62,76],['RB',86,72],['LW',14,48],['CM',38,54],['CM',62,54],['RW',86,48],['ST',36,22],['ST',64,22]],
    links: [[0,2],[0,3],[1,2],[2,3],[3,4],[1,5],[2,6],[3,7],[4,8],[5,6],[6,7],[7,8],[5,9],[6,9],[7,10],[8,10],[9,10]] },
  '352': { id: '352', name: '3-5-2', desc: 'Tri stopera, krilni bekovi i jaka sredina.',
    slots: [['GK',50,90],['CB',24,76],['CB',50,79],['CB',76,76],['LB',10,52],['CM',32,50],['CDM',50,58],['CM',68,50],['RB',90,52],['ST',36,22],['ST',64,22]],
    links: [[0,1],[0,2],[0,3],[1,2],[2,3],[1,4],[3,8],[1,5],[2,6],[3,7],[4,5],[5,6],[6,7],[7,8],[5,9],[7,10],[9,10],[4,9],[8,10]] },
  '532': { id: '532', name: '5-3-2', desc: 'A solid five-player defense with two strikers.',
    slots: [['GK',50,90],['LB',10,66],['CB',30,77],['CB',50,80],['CB',70,77],['RB',90,66],['CM',28,50],['CDM',50,55],['CM',72,50],['ST',36,22],['ST',64,22]],
    links: [[0,2],[0,3],[0,4],[1,2],[2,3],[3,4],[4,5],[1,6],[2,6],[3,7],[4,8],[5,8],[6,7],[7,8],[6,9],[8,10],[9,10],[7,9],[7,10]] }
,
  '4231': { id: '4231', name: '4-2-3-1', desc: 'The CAM creates chances behind the striker while the wingers stretch the defense.',
    slots: [['GK',50,90],['LB',12,72],['CB',38,76],['CB',62,76],['RB',88,72],['CDM',38,59],['CDM',62,59],['LW',17,38],['CAM',50,34],['RW',83,38],['ST',50,17]],
    links: [[0,2],[0,3],[1,2],[2,3],[3,4],[1,5],[2,5],[3,6],[4,6],[5,6],[5,8],[6,8],[7,8],[8,9],[7,10],[8,10],[9,10]] },
  '4141': { id: '4141', name: '4-1-4-1', desc: 'A strong CDM protects the defense while four midfielders support one striker.',
    slots: [['GK',50,90],['LB',12,72],['CB',38,76],['CB',62,76],['RB',88,72],['CDM',50,62],['LW',15,43],['CM',38,49],['CM',62,49],['RW',85,43],['ST',50,19]],
    links: [[0,2],[0,3],[1,2],[2,3],[3,4],[1,5],[2,5],[3,5],[4,5],[5,7],[5,8],[6,7],[7,8],[8,9],[6,10],[7,10],[8,10],[9,10]] },
  '3412': { id: '3412', name: '3-4-1-2', desc: 'Three center-backs, a wide midfield, and a CAM behind two strikers.',
    slots: [['GK',50,90],['CB',23,76],['CB',50,79],['CB',77,76],['LB',12,54],['CM',35,54],['CM',65,54],['RB',88,54],['CAM',50,35],['ST',36,19],['ST',64,19]],
    links: [[0,1],[0,2],[0,3],[1,2],[2,3],[1,4],[4,5],[5,6],[6,7],[7,3],[5,8],[6,8],[8,9],[8,10],[9,10]] },
  '4312': { id: '4312', name: '4-3-1-2', desc: 'Three midfielders feed a CAM behind two strikers.',
    slots: [['GK',50,90],['LB',14,72],['CB',38,76],['CB',62,76],['RB',86,72],['CM',27,55],['CDM',50,60],['CM',73,55],['CAM',50,36],['ST',36,19],['ST',64,19]],
    links: [[0,2],[0,3],[1,2],[1,5],[2,3],[2,5],[2,6],[3,4],[3,6],[3,7],[4,7],[5,6],[5,8],[6,7],[6,8],[7,8],[8,9],[8,10],[9,10]] },
  '4321': { id: '4321', name: '4-3-2-1', desc: 'Christmas tree: two CAMs support a lone striker.',
    slots: [['GK',50,90],['LB',14,72],['CB',38,76],['CB',62,76],['RB',86,72],['CM',27,56],['CDM',50,60],['CM',73,56],['CAM',33,35],['CAM',67,35],['ST',50,18]],
    links: [[0,2],[0,3],[1,2],[1,5],[2,3],[2,6],[3,4],[3,6],[4,7],[5,6],[5,8],[6,7],[6,8],[6,9],[7,9],[8,10],[9,10]] },
  '451': { id: '451', name: '4-5-1', desc: 'Packed midfield with wide wingers and a lone striker.',
    slots: [['GK',50,90],['LB',14,72],['CB',38,76],['CB',62,76],['RB',86,72],['LW',12,46],['CM',32,52],['CDM',50,58],['CM',68,52],['RW',88,46],['ST',50,19]],
    links: [[0,2],[0,3],[1,2],[1,5],[1,6],[2,3],[2,6],[2,7],[3,4],[3,7],[3,8],[4,8],[4,9],[5,6],[5,10],[6,7],[6,10],[7,8],[8,9],[8,10],[9,10]] },
  '343': { id: '343', name: '3-4-3', desc: 'All-out attack: three center-backs, wide midfield and three forwards.',
    slots: [['GK',50,90],['CB',24,76],['CB',50,79],['CB',76,76],['LB',12,56],['CM',38,54],['CM',62,54],['RB',88,56],['LW',18,27],['ST',50,19],['RW',82,27]],
    links: [[0,1],[0,2],[0,3],[1,2],[1,4],[1,5],[2,3],[2,5],[3,6],[3,7],[4,5],[4,8],[5,6],[5,9],[6,7],[6,9],[7,10],[8,9],[9,10]] },
  '541': { id: '541', name: '5-4-1', desc: 'Ultra-defensive: five at the back and a lone striker on the counter.',
    slots: [['GK',50,90],['LB',10,66],['CB',30,77],['CB',50,80],['CB',70,77],['RB',90,66],['LW',17,46],['CM',38,52],['CM',62,52],['RW',83,46],['ST',50,19]],
    links: [[0,2],[0,3],[0,4],[1,2],[1,6],[1,7],[2,3],[2,7],[3,4],[4,5],[4,8],[5,8],[5,9],[6,7],[6,10],[7,8],[7,10],[8,9],[8,10],[9,10]] },
  '4411': { id: '4411', name: '4-4-1-1', desc: 'Flat four in midfield with a second striker dropping into the gaps.',
    slots: [['GK',50,90],['LB',14,72],['CB',38,76],['CB',62,76],['RB',86,72],['LW',14,50],['CM',38,55],['CM',62,55],['RW',86,50],['CAM',50,34],['ST',50,18]],
    links: [[0,2],[0,3],[1,2],[1,5],[1,6],[2,3],[2,6],[3,4],[3,7],[4,7],[4,8],[5,6],[5,9],[5,10],[6,7],[6,9],[7,8],[7,9],[8,9],[8,10],[9,10]] },
  '3421': { id: '3421', name: '3-4-2-1', desc: 'Three center-backs, wide midfield and two creators behind a striker.',
    slots: [['GK',50,90],['CB',23,76],['CB',50,79],['CB',77,76],['LB',12,54],['CM',38,54],['CM',62,54],['RB',88,54],['CAM',33,34],['CAM',67,34],['ST',50,18]],
    links: [[0,1],[0,2],[0,3],[1,2],[1,4],[1,5],[2,3],[2,5],[3,6],[3,7],[4,5],[4,8],[5,6],[5,8],[6,7],[6,9],[7,9],[8,10],[9,10]] },
  '4222': { id: '4222', name: '4-2-2-2', desc: 'Two holding midfielders protect the back four while two narrow creators feed a pair of strikers.',
    slots: [['GK',50,90],['LB',13,72],['CB',38,76],['CB',62,76],['RB',87,72],['CDM',38,59],['CDM',62,59],['CAM',34,38],['CAM',66,38],['ST',36,19],['ST',64,19]],
    links: [[0,2],[0,3],[1,2],[2,3],[3,4],[1,5],[2,5],[3,6],[4,6],[5,6],[5,7],[6,8],[7,8],[7,9],[7,10],[8,9],[8,10],[9,10]] },
  '41212': { id: '41212', name: '4-1-2-1-2', desc: 'A narrow diamond midfield overloads the centre and connects a CAM to two strikers.',
    slots: [['GK',50,90],['LB',13,72],['CB',38,76],['CB',62,76],['RB',87,72],['CDM',50,62],['CM',30,49],['CM',70,49],['CAM',50,35],['ST',36,19],['ST',64,19]],
    links: [[0,2],[0,3],[1,2],[2,3],[3,4],[1,5],[2,5],[3,5],[4,5],[5,6],[5,7],[6,7],[6,8],[7,8],[8,9],[8,10],[9,10]] }
};


// Family labels use the scientific family names stored on every card (the original table used English
// group keys that never matched any card, so labels fell back to Latin and club themes never applied).
Object.assign(GAME_DATA.FAMILY, {
  Asteriidae: 'Morske zvijezde', Apterygidae: 'Kivi ptice', Istiophoridae: 'Marlini', Dugongidae: 'Dugongi',
  Accipitridae: 'Orlovi i jastrebovi', Ailuridae: 'Crvene pande', Alcedinidae: 'Vodomari', Alcidae: 'Njorke i tupici',
  Alligatoridae: 'Aligatori', Araneae: 'Pauci', Balaenopteridae: 'Kitovi brazdaši', Bovidae: 'Goveda i antilope',
  Bradypodidae: 'Ljenjivci', Camelidae: 'Kamile', Canidae: 'Psi', Castoridae: 'Dabrovi', Cervidae: 'Jeleni',
  Chamaeleonidae: 'Kameleoni', Cheloniidae: 'Morske kornjače', Chiroptera: 'Šišmiši', Crocodylidae: 'Krokodili',
  Dasypodidae: 'Armadilosi', Delphinidae: 'Delfini', Elapidae: 'Kobre', Elephantidae: 'Slonovi', Equidae: 'Konji',
  Erinaceidae: 'Ježevi', Falconidae: 'Sokolovi', Felidae: 'Mačke', Giraffidae: 'Žirafe', Gruidae: 'Ždralovi',
  Hippopotamidae: 'Nilski konji', Hominidae: 'Veliki majmuni', Hyaenidae: 'Hijene', Iguanidae: 'Iguane',
  Lemuridae: 'Lemuri', Leporidae: 'Zečevi', Macropodidae: 'Kenguri', Manidae: 'Pangolini', Mephitidae: 'Tvorovi',
  Mobulidae: 'Raže', Muridae: 'Miševi', Mustelidae: 'Kune', Myrmecophagidae: 'Mravojedi', Octopodidae: 'Hobotnice',
  Odobenidae: 'Morževi', Phascolarctidae: 'Koale', Phasianidae: 'Fazani i kokoši', Phoenicopteridae: 'Flamingosi',
  Primates: 'Primati', Procyonidae: 'Rakuni', Psittaciformes: 'Papige', Ranidae: 'Žabe', Rhinocerotidae: 'Nosorozi',
  Salamandridae: 'Daždevnjaci', Sciuridae: 'Vjeverice', Selachimorpha: 'Morski psi', Sepiidae: 'Sipe',
  Serpentes: 'Zmije', Spheniscidae: 'Pingvini', Strigidae: 'Sove', Struthionidae: 'Nojevi', Suidae: 'Svinje',
  Tapiridae: 'Tapiri', Trochilidae: 'Kolibri', Ursidae: 'Medvjedi',
  Tyrannosauridae: 'Tiranosauri', Dromaeosauridae: 'Raptori', Ceratopsidae: 'Rogati dinosauri', Spinosauridae: 'Spinosauri',
  Brachiosauridae: 'Dugovrati dinosauri', Stegosauridae: 'Stegosauri', Pteranodontidae: 'Pterosauri'
});
// Club theme keys -> real family names on the cards (so the +6 family bias in AI squad building works).
(function () {
  const A = {
    Feline: ['Felidae'], Antelope: ['Bovidae'], Equine: ['Equidae'], Giraffid: ['Giraffidae'], Elephant: ['Elephantidae'],
    Canine: ['Canidae'], Bear: ['Ursidae'], Rhino: ['Rhinocerotidae'], Bovine: ['Bovidae'], Cervid: ['Cervidae'],
    Raptor: ['Accipitridae', 'Falconidae', 'Strigidae'], Corvid: [], Kingfisher: ['Alcedinidae'],
    Primate: ['Primates', 'Hominidae', 'Lemuridae'], Procyonid: ['Procyonidae'], Snake: ['Serpentes', 'Elapidae'],
    Lizard: ['Iguanidae', 'Chamaeleonidae'], Crocodilian: ['Crocodylidae', 'Alligatoridae'], Turtle: ['Cheloniidae'],
    Mustelid: ['Mustelidae'], Camelid: ['Camelidae'], Hippo: ['Hippopotamidae'], Wader: ['Gruidae', 'Phoenicopteridae'],
    Rodent: ['Castoridae', 'Sciuridae', 'Muridae'], Marsupial: ['Macropodidae', 'Phascolarctidae'], Ratite: ['Struthionidae']
  };
  GAME_DATA.CLUBS.forEach((c) => { if (c.fam) c.fam = [...new Set(c.fam.flatMap((f) => A[f] || [f]))]; });
})();

/* ==========================================================
   EXCLUSIVE REWARDS — cards that exist only as quest rewards.
   They are excluded from packs, AI squads and draft offers (unless already owned),
   and are granted exactly once by EXCLUSIVE_SYSTEM.claim().
   Progress reads existing stats, so existing saves keep their earned progress.
   ========================================================== */
GAME_DATA.EXCLUSIVES = {
  medojed: {
    quest: 'Sweet as honey',
    requirements: [
      { id: 'cups', icon: '🏆', label: 'Win the Cup 2 times', need: 2, get: () => (STATE.stats.trophies || 0) },
      { id: 'league', icon: '♾️', label: 'Reach a 5-win streak in the Endless League', need: 5,
        get: () => Number(window.WILDXI_FEATURES && window.WILDXI_FEATURES.leagueBest ? window.WILDXI_FEATURES.leagueBest() : 0) || 0 },
      { id: 'collection', icon: '📚', label: 'Collect 40 different players', need: 40,
        get: () => Object.keys(STATE.owned).filter((id) => STATE.owned[id] > 0 && PLAYER_BY_ID[id] && !PLAYER_BY_ID[id].exclusive).length }
    ]
  },
    jegulja: {
    quest: 'Organized lightning',
    requirements: [
      { id: 'streak', icon: '🔥', label: 'Reach a 8-win streak', need: 8, get: () => (STATE.stats.bestStreak || 0) },
      { id: 'played', icon: '⚽', label: 'Play 100 matches', need: 100, get: () => (STATE.stats.played || 0) }
    ]
  },
  // Dostupan samo preko koda (WILDXI-ADMIN1); ne pojavljuje se u misijama ni u paketima.
  'crni-marlin': { codeOnly: true, quest: 'Secret code', requirements: [] },
    // Dostupan samo preko koda (WILDXI-ADMIN2); ne pojavljuje se u misijama ni u paketima.
  'skakavac': { codeOnly: true, quest: 'Secret code', requirements: [] },
  dugong: {
    quest: 'Loyal fan',
    requirements: [
      { id: 'days', icon: '📅', label: 'Play matches on 3 different days', need: 3, get: () => ((STATE.playDays || []).length) },
      { id: 'saves', icon: '🧤', label: 'Record 100 goalkeeper saves', need: 100, get: () => (STATE.stats.saves || 0) }
    ]
  },
  kitoglav: {
    quest: 'Squad architect',
    requirements: [
      { id: 'chemistry', icon: '🔗', label: 'Build a squad with 68+ chemistry', need: 68, get: () => (STATE.best.chem || 0) },
      { id: 'rating', icon: '⭐', label: 'Build a squad with 88+ team rating', need: 88, get: () => (STATE.best.ovr || 0) }
    ]
  },
  cibetka: {
    quest: 'Winning manager',
    requirements: [
      { id: 'wins', icon: '🏆', label: 'Win 25 matches', need: 25, get: () => (STATE.stats.wins || 0) }
    ]
  }
};

// Secret codes for Dinosaur cards (the only way to get one besides the Prehistoric Hit Pack). Code -> card id.
GAME_DATA.DINO_CODES = {
  'WILDXI-TREX': 't-rex', 'WILDXI-STEGO': 'stegosaurus', 'WILDXI-RAPTOR': 'velociraptor', 'WILDXI-GALLI': 'gallimimus',
  'WILDXI-SPINO': 'spinosaurus', 'WILDXI-BRACHIO': 'brachiosaurus', 'WILDXI-PTERA': 'pteranodon'
};

/* ==========================================================
   PLAYER_DATABASE
   [ime, emoji, vrsta, poz, sekundarna, ishrana, klasa, porodica, raritet, [pac,sho,pas,def,phy,(ref)], osobina, opis]
   ========================================================== */
const PLAYER_ROWS = (window.WILD_XI_PLAYER_ROWS || []).concat(window.WILD_XI_EXCLUSIVE_ROWS || [], window.WILD_XI_DINO_ROWS || []);


function computeOvr(pos, st) {
  const w = GAME_DATA.OVR_WEIGHTS[pos];
  return Math.round(st[0] * w[0] + st[1] * w[1] + st[2] * w[2] + st[3] * w[3] + st[4] * w[4] + st[5] * w[5]);
}
// Jedna kartica po životinji: slični nazivi/varijante spajaju se u jednu vrstu.
function animalKey(species) {
  const s = String(species).toLocaleLowerCase('bs').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const aliases = {
    'zlatni orao':'orao', 'crni orao':'orao', 'bijeli orao':'orao',
    'crna pantera':'pantera', 'polarna lisica':'lisica', 'crvena lisica':'lisica', 'arkt icki vuk':'vuk', 'arkt icki vuk':'vuk', 'arkt icki vuk':'vuk',
    'arkticki vuk':'vuk', 'arkt icki vuk':'vuk', 'arkt icki vuk':'vuk', 'arkt icki vuk':'vuk', 'arkt icki vuk':'vuk', 'arkt icki vuk':'vuk', 'arkt icki vuk':'vuk', 'arkt icki vuk':'vuk', 'arkt icki vuk':'vuk', 'arkt icki vuk':'vuk', 'arkt icki vuk':'vuk', 'snjezni leopard':'leopard',
    'divlji bivol':'bivo', 'bizon':'bizon', 'bizon jr':'bizon',
    'grizli':'medvjed', 'polarni medvjed':'medvjed',
    'morska kornjaca':'kornjaca', 'divovska kornjaca':'kornjaca',
    'rakunski pas':'rakunski pas'
  };
  return aliases[s] || (s.startsWith('arkticki ') ? 'vuk' : s);
}
function animalDisplayName(species) {
  const key = animalKey(species);
  const labels = {
    'orao':'Orao', 'pantera':'Pantera', 'lisica':'Lisica', 'vuk':'Vuk',
    'leopard':'Leopard', 'nosorog':'Nosorog', 'bivo':'Bivo', 'bizon':'Bizon',
    'medvjed':'Medvjed', 'kornjaca':'Kornjača'
  };
  return labels[key] || species;
}
function rowOvr(r) {
  const w = GAME_DATA.OVR_WEIGHTS[r[3]], a = r[9].slice();
  if (a.length < 6) { let h=0; for (const ch of r[0]) h=(h*31+ch.charCodeAt(0))%997; a.push(20+(h%25)); }
  return Math.round(a.reduce((sum,v,i)=>sum+v*w[i],0));
}
const canonicalRows = [];
const rowByKey = new Map();
for (const r of PLAYER_ROWS.filter(Boolean)) {
  const key = animalKey(r[2]);
  const prior = rowByKey.get(key);
  if (!prior) { rowByKey.set(key, r); canonicalRows.push(r); }
  else if (rowOvr(r) > rowOvr(prior)) { rowByKey.set(key, r); canonicalRows[canonicalRows.indexOf(prior)] = r; }
}
const PLAYER_DATABASE = canonicalRows.map((r) => {
  const slug = animalKey(r[2]).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const st = r[9].slice();
  if (st.length < 6) { // refleksi za playere iz polja: deterministički 20-44
    let h = 0; for (const ch of r[0]) h = (h * 31 + ch.charCodeAt(0)) % 997;
    st.push(20 + (h % 25));
  }
  const attrs = { pac: st[0], sho: st[1], pas: st[2], def: st[3], phy: st[4], ref: st[5] };
  return {
    id: slug, imageId: r[0].toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: animalDisplayName(r[2]), legacyName: r[0], emoji: r[1], species: r[2], pos: r[3], sec: r[4] || '', diet: r[5], cls: r[6],
    family: r[7], rarity: r[8], attrs, stats: st, trait: r[10], desc: r[11], ovr: computeOvr(r[3], st)
  };
});
const PLAYER_BY_ID = {};
const PLAYER_ID_ALIASES = {};
PLAYER_DATABASE.forEach((p) => { PLAYER_BY_ID[p.id] = p; PLAYER_ID_ALIASES[p.id] = p.id; p.exclusive = !!GAME_DATA.EXCLUSIVES[p.id]; });
Object.keys(GAME_DATA.EXCLUSIVES).forEach((id) => { if (!PLAYER_BY_ID[id]) console.error('Exclusive reward player missing from database:', id); });
// Eksplicitna mapa stari nadimak/ID -> kanonski ID životinje.
// Važno: sejv se uvijek normalizuje na kanonski ID, nikad se alias ne čuva kao posebna karta.
PLAYER_ROWS.forEach((r) => {
  if (!Array.isArray(r) || !r.length) return;
  const oldId = r[0].toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const p = PLAYER_DATABASE.find(x => animalKey(x.species) === animalKey(r[2]));
  if (p) {
    PLAYER_ID_ALIASES[oldId] = p.id;
    if (!PLAYER_BY_ID[oldId]) PLAYER_BY_ID[oldId] = p;
  }
});
function canonicalPlayerId(id) { return PLAYER_ID_ALIASES[id] || (PLAYER_BY_ID[id] ? PLAYER_BY_ID[id].id : null); }
function canonicalSlots(slots) {
  const seen = new Set();
  return slots.map((id) => {
    if (id == null) return null;
    const canonical = canonicalPlayerId(id);
    if (!canonical || seen.has(canonical)) return null;
    seen.add(canonical);
    return canonical;
  });
}
GAME_DATA.STARTER_IDS = GAME_DATA.STARTER_IDS.map(id => {
  const old = PLAYER_BY_ID[id];
  return old ? old.id : id;
});


/* ==========================================================
   UTIL
   ========================================================== */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function shuffled(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function weightedPick(items, wf, rnd) {
  let tot = 0;
  const w = items.map((it) => { const x = Math.max(0.00001, wf(it)); tot += x; return x; });
  let r = rnd() * tot;
  for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
const famLabel = (f) => GAME_DATA.FAMILY[f] || f;

/* ==========================================================
   CHEMISTRY_SYSTEM — ishrana + klasa + porodica, po midfieldma formacije
   ========================================================== */
const CHEMISTRY_SYSTEM = {
  dietPoints(d1, d2) {
    const C = GAME_DATA.CHEM;
    if (d1 === d2) return C.dietSame;                       // ista ishrana: +3 (uvijek, i Omni+Omni)
    if (d1 === 'O' || d2 === 'O') return C.dietOmni;        // različita, ali barem jedan Omnivore: +2
    return C.dietNone;                                      // različita bez Omnivorea: 0
  },
  classPoints(c1, c2) { return c1 === c2 ? GAME_DATA.CHEM.classSame : 0; },
  familyPoints(f1, f2) { return f1 === f2 ? GAME_DATA.CHEM.familySame : 0; },
  linkInfo(p1, p2) {
    const diet = this.dietPoints(p1.diet, p2.diet), cls = this.classPoints(p1.cls, p2.cls), fam = this.familyPoints(p1.family, p2.family);
    const total = diet + cls + fam;
    const C = GAME_DATA.CHEM;
    if (p1.rarity === 'Dinosaur' || p2.rarity === 'Dinosaur') {
      // Dinosaur links are never grey: anything in common -> green (>= dinoMatch points), otherwise yellow (dinoNoMatch points).
      if (total > 0) return { diet, cls, fam, total: Math.min(C.maxLink, Math.max(total, C.dinoMatch)), max: C.maxLink, level: 'g', dino: true, matched: true };
      return { diet, cls, fam, total: C.dinoNoMatch, max: C.maxLink, level: 'y', dino: true, matched: false };
    }
    return { diet, cls, fam, total, max: GAME_DATA.CHEM.maxLink, level: total >= GAME_DATA.CHEM_GREEN ? 'g' : total >= GAME_DATA.CHEM_BLUE ? 'b' : 's' };
  },
  explain(p1, p2) {
    const i = this.linkInfo(p1, p2);
    if (i.dino) return `${p1.name} + ${p2.name}: Dinosaur link — ${i.matched ? 'something in common (+' + i.diet + ' diet, +' + i.cls + ' class, +' + i.fam + ' family), boosted to' : 'nothing in common, minimum link of'} ${i.total} chemistry points.`;
    return `${p1.name} + ${p2.name}: +${i.diet} for diet, +${i.cls} for animal class, +${i.fam} for family = ${i.total} chemistry points.`;
  },
  // players: niz players po indeksu slota (null = prazno)
  team(formationId, players) {
    const F = GAME_DATA.FORMATIONS[formationId];
    const links = F.links.map(([a, b]) => (players[a] && players[b] ? { a, b, info: this.linkInfo(players[a], players[b]) } : { a, b, info: null }));
    let raw = 0, n = 0;
    links.forEach((l) => { if (l.info) { raw += l.info.total; n++; } });
    const base = n ? Math.round(raw / (n * GAME_DATA.CHEM.maxLink) * 100) : 0;
    const caps = players.filter((p) => p && p.trait === 'captain').length;
    const bonus = n ? Math.min(GAME_DATA.CHEM.captainMax, caps * GAME_DATA.CHEM.captainBonus) : 0;
    return { links, raw, count: n, base, bonus, pct: clamp(base + bonus, 0, 100) };
  }
};

/* ==========================================================
   SQUAD_SYSTEM — pozicije, kazne, izgradnja tima i snaga
   ========================================================== */
const styleIdSafe = (id) => GAME_DATA.STYLES[id] ? id : 'balanced';
const SQUAD_SYSTEM = {
  fitInfo(p, slotPos) {
    const O = GAME_DATA.OUT_OF_POS, G = GAME_DATA.POS_GROUP;
    if (p.pos === slotPos) return { pen: 0, label: 'Natural position', cls: 'ok' };
    if (p.sec === slotPos) return { pen: O.secondary, label: 'Sekundarna pozicija', cls: 'mid' };
    const gp = G[p.pos], gs = G[slotPos];
    if (gp === 'GK' || gs === 'GK') return { pen: O.gk, label: 'Potpuno van pozicije', cls: 'bad' };
    if (gp === gs) return { pen: O.sameGroup, label: 'Van pozicije (ista linija)', cls: 'bad' };
    if (gp === 'MID' || gs === 'MID') return { pen: O.adjacentGroup, label: 'Van pozicije (susjedna linija)', cls: 'bad' };
    return { pen: O.farGroup, label: 'Van pozicije (daleka linija)', cls: 'bad' };
  },
  // efektivni atributi players na slotu (uz AI bonus kluba 'boost')
  slotPlayer(p, slotPos, boost, lvl) {
    const b = boost || 0, up = lvl || 0; // lvl = card upgrade level (user's own cards only; AI never gets it)
    const st = p.stats.map((v) => clamp(v + b, 1, 99));
    const raw = computeOvr(p.pos, st);
    const base = raw + up; // each upgrade level = +1 OVR, exactly as shown on the card
    const fit = this.fitInfo(p, slotPos);
    const ovr = Math.max(1, base - fit.pen);
    const f = ovr / Math.max(1, raw); // scales every attribute used by the match engine (upgrade and position penalty alike)
    const eff = { pac: st[0] * f, sho: st[1] * f, pas: st[2] * f, def: st[3] * f, phy: st[4] * f, ref: st[5] * f };
    return { p, pos: slotPos, fit, base, ovr, eff };
  },
  W: {
    atk: { ST: 1, LW: .85, RW: .85, CAM: .8, CM: .45, CDM: .2, LB: .25, RB: .25, CB: .05, GK: 0 },
    ctrl: { CM: 1, CDM: .9, CAM: .8, LB: .4, RB: .4, LW: .4, RW: .4, ST: .2, CB: .3, GK: 0 },
    def: { CB: 1, CDM: .8, LB: .8, RB: .8, CM: .4, CAM: .15, LW: .1, RW: .1, ST: .05, GK: 0 }
  },
  REF: { atk: 4.4, ctrl: 5.3, def: 5.4 },
  rate(slots, kind) {
    const W = this.W[kind];
    let sw = 0, sq = 0;
    slots.forEach((s) => {
      const w = W[s.pos] || 0; if (!w) return;
      const e = s.eff;
      const q = kind === 'atk' ? .38 * e.sho + .27 * e.pas + .35 * e.pac : kind === 'ctrl' ? .5 * e.pas + .15 * e.pac + .15 * e.phy + .2 * e.def : .6 * e.def + .25 * e.phy + .15 * e.pac;
      sw += w; sq += w * q;
    });
    if (!sw) return 1;
    return (sq / sw) * (0.85 + 0.15 * sw / this.REF[kind]);
  },
  // t: {name, icon, c1, c2, stadium, formation, ids:[...], boost, style}
  buildTeam(t) {
    const F = GAME_DATA.FORMATIONS[t.formation];
    const players = t.ids.map((id) => (id ? PLAYER_BY_ID[id] : null));
    const slots = F.slots.map(([pos, x, y], i) => {
      const p = players[i];
      if (!p) return { p: null, pos, x, y, ovr: 0, eff: null, fit: null };
      const sp = this.slotPlayer(p, pos, t.boost || 0, t.user ? (STATE.upgrades[p.id] || 0) : ((t.upg && t.upg[p.id]) || 0));
      sp.x = x; sp.y = y;
      return sp;
    });
    const filled = slots.filter((s) => s.p);
    const chem = CHEMISTRY_SYSTEM.team(t.formation, players);
    const style = GAME_DATA.STYLES[t.style] || GAME_DATA.STYLES.balanced;
    const chemMult = 1 + clamp((chem.pct - 45) / 55, -0.65, 1) * 0.04;
    const ovr = filled.length ? Math.round(filled.reduce((a, s) => a + s.ovr, 0) / filled.length) : 0;
    const complete = filled.length === slots.length;
    const team = {
      name: t.name || 'Your XI', user: !!t.user, crest: t.crest || null, icon: (t.user && typeof window.renderUserCrest === 'function') ? window.renderUserCrest(40) : (t.icon || '🐾'), c1: t.c1 || '#d9a21a', c2: t.c2 || '#6b4a05', stadium: t.stadium || 'Wild Arena',
      formation: t.formation, fm: F, styleId: t.style || 'balanced', style, boost: t.boost || 0,
      slots, players, chem, ovr, complete, chemMult, clubId: t.clubId || null
    };
    if (complete) {
      const posCount = (pos) => slots.filter((s) => s.pos === pos && s.p).length;
      const hasCAM = posCount('CAM') > 0;
      const wide = posCount('LW') + posCount('RW') + posCount('LB') + posCount('RB');
      const midfield = posCount('CM') + posCount('CDM') + posCount('CAM');
      const forwards = posCount('ST') + posCount('LW') + posCount('RW');
      const sid = styleIdSafe(t.style);
      const tactical = {
        atk: (hasCAM ? .035 : 0) + (sid === 'direct' && wide >= 2 ? .045 : 0) + (sid === 'counter' && forwards >= 2 ? .035 : 0),
        ctrl: (sid === 'possession' && midfield >= 3 ? .06 : 0) + (hasCAM && sid === 'possession' ? .025 : 0),
        def: (posCount('CDM') >= 2 ? .035 : 0) + (sid === 'press' && midfield >= 3 ? .025 : 0)
      };
      team.atk = this.rate(slots, 'atk') * style.atk * chemMult * (1 + tactical.atk);
      team.ctrl = this.rate(slots, 'ctrl') * style.ctrl * chemMult * (1 + tactical.ctrl);
      team.def = this.rate(slots, 'def') * style.def * chemMult * (1 + tactical.def);
      team.tactical = tactical;
      team.gk = slots[0].eff.ref;
    }
    return team;
  },
  fromSquad(sq, name) {
    return this.buildTeam({ user: true, name: name || STATE.managerName || 'Your XI', icon: '🐾', formation: sq.formation, ids: sq.slots, style: sq.style, c1: '#f4c542', c2: '#7a5606' });
  },
  // pohlepno popunjavanje: najbolji raspoloživi player za svako slot (rijetka slots prva)
  autoFill(fid, ids) {
    const F = GAME_DATA.FORMATIONS[fid];
    const pool = ids.map((id) => PLAYER_BY_ID[id]).filter(Boolean);
    const out = Array(11).fill(null), used = new Set();
    const cnt = (i) => pool.filter((p) => p.pos === F.slots[i][0] || p.sec === F.slots[i][0]).length;
    F.slots.map((x, i) => i).sort((a, b) => cnt(a) - cnt(b)).forEach((i) => {
      let best = null, bs = -1e9;
      pool.forEach((p) => { if (used.has(p.id)) return; const sc = p.ovr - this.fitInfo(p, F.slots[i][0]).pen; if (sc > bs) { bs = sc; best = p; } });
      if (best) { out[i] = best.id; used.add(best.id); }
    });
    return out;
  },
  isComplete(sq) { return !!(sq && sq.slots && sq.slots.length === 11 && sq.slots.every(Boolean)); }
};

/* ==========================================================
   SAVE_SYSTEM — localStorage uz verzioniranje i sigurno učitavanje
   ========================================================== */
const SAVE_SYSTEM = {
  mem: null,
  defaultState() {
    return {
      v: GAME_DATA.SAVE_VERSION, coins: GAME_DATA.START_COINS, owned: {},
      stats: { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, saves: 0, tournaments: 0, trophies: 0, finals: 0, packs: 0, coinsEarned: 0, streak: 0, bestStreak: 0 },
      best: { chem: 0, ovr: 0 }, history: [], settings: { speed: 'normal', tacticsCollapsed: false, positionWarningsCollapsed: true },
      upgrades: {},
      squad: null, savedSquads: [null, null, null], draftSquad: null, draft: null, tournament: null, starterGiven: false, managerName: 'Wild XI', redeemedCodes: [], exclusiveClaims: [], playDays: [], playedSeen: null
    };
  },
  sanitize(d) {
    const base = this.defaultState();
    if (!d || typeof d !== 'object') return base;
    const out = base;
    if (Number.isFinite(d.coins) && d.coins >= 0) out.coins = Math.floor(d.coins);
    if (d.owned && typeof d.owned === 'object') {
      for (const id in d.owned) {
        const canonical = canonicalPlayerId(id);
        const count = Number(d.owned[id]);
        if (canonical && Number.isFinite(count) && count > 0) {
          // Ako više starih kartica predstavlja istu životinju, spoji ih u jedan ID.
          // Zadrži najveći broj copies umjesto sabiranja varijanti iste životinje.
          out.owned[canonical] = Math.max(out.owned[canonical] || 0, Math.floor(count));
        }
      }
    }
    if (d.stats && typeof d.stats === 'object') for (const k in out.stats) if (Number.isFinite(d.stats[k])) out.stats[k] = d.stats[k];
    if (d.best && typeof d.best === 'object') { out.best.chem = Number(d.best.chem) || 0; out.best.ovr = Number(d.best.ovr) || 0; }
    if (Array.isArray(d.history)) out.history = d.history.filter((h) => h && typeof h === 'object').slice(0, 30);
    if (d.settings && ['normal', 'fast'].includes(d.settings.speed)) out.settings.speed = d.settings.speed;
    if (d.settings && typeof d.settings.tacticsCollapsed === 'boolean') out.settings.tacticsCollapsed = d.settings.tacticsCollapsed;
    if (d.settings && typeof d.settings.positionWarningsCollapsed === 'boolean') out.settings.positionWarningsCollapsed = d.settings.positionWarningsCollapsed;
    if (d.upgrades && typeof d.upgrades === 'object') for (const id in d.upgrades) { const canonical = canonicalPlayerId(id); const level = Number(d.upgrades[id]); if (canonical && Number.isInteger(level) && level >= 1 && level <= 3) out.upgrades[canonical] = level; }
    if (typeof d.managerName === 'string') out.managerName = d.managerName.trim().slice(0, 18) || 'Wild XI';
    if (Array.isArray(d.redeemedCodes)) out.redeemedCodes = [...new Set(d.redeemedCodes.filter((x) => typeof x === 'string').map((x) => x.toUpperCase().slice(0, 64)))];
    // Exclusive reward cards: claim record is kept as a whitelist of known ids. A claimed card is always
    // owned exactly once (never duplicated by save/load) and an owned exclusive always counts as claimed.
    if (Array.isArray(d.exclusiveClaims)) out.exclusiveClaims = [...new Set(d.exclusiveClaims.filter((x) => typeof x === 'string' && GAME_DATA.EXCLUSIVES[x]))];
    Object.keys(GAME_DATA.EXCLUSIVES).forEach((id) => {
      if (out.owned[id] > 0) { out.owned[id] = 1; if (!out.exclusiveClaims.includes(id)) out.exclusiveClaims.push(id); }
      else if (out.exclusiveClaims.includes(id) && PLAYER_BY_ID[id]) out.owned[id] = 1;
    });
    const okSquad = (x) => x && GAME_DATA.FORMATIONS[x.formation] && Array.isArray(x.slots) && x.slots.length === 11 && x.slots.every((y) => y === null || PLAYER_BY_ID[y]);
    const cp = (x) => ({ formation: x.formation, slots: canonicalSlots(x.slots), style: GAME_DATA.STYLES[x.style] ? x.style : 'balanced' });
    const old = !(d.v >= 2); // v1: jedini 'squad' je bio rezultat drafta
    if (old) { if (okSquad(d.squad)) out.draftSquad = cp(d.squad); }
    else { if (okSquad(d.squad)) out.squad = cp(d.squad); if (okSquad(d.draftSquad)) out.draftSquad = cp(d.draftSquad); }
    if (Array.isArray(d.savedSquads)) out.savedSquads = Array.from({length:3}, (_,i) => okSquad(d.savedSquads[i]) ? {...cp(d.savedSquads[i]), name: String(d.savedSquads[i].name || `Team ${i+1}`).slice(0,24)} : null);
    if (Array.isArray(d.playDays)) out.playDays = [...new Set(d.playDays.filter((x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)))].slice(-400);
    if (Number.isFinite(d.playedSeen)) out.playedSeen = d.playedSeen;
    out.starterGiven = !!d.starterGiven;
    if (d.draft && GAME_DATA.FORMATIONS[d.draft.formation] && Array.isArray(d.draft.slots) && d.draft.slots.length === 11 && d.draft.slots.every((x) => x === null || PLAYER_BY_ID[x]) &&
        Array.isArray(d.draft.offers) && d.draft.offers.every((x) => PLAYER_BY_ID[x]) && Array.isArray(d.draft.picked)) {
      out.draft = { formation: d.draft.formation, slots: canonicalSlots(d.draft.slots), offers: [...new Set(d.draft.offers.map(canonicalPlayerId).filter(Boolean))], picked: [...new Set(d.draft.picked.map(canonicalPlayerId).filter(Boolean))], done: !!d.draft.done };
    }
    if (d.tournament && Array.isArray(d.tournament.teams) && d.tournament.teams.length === 8 && Array.isArray(d.tournament.bracket) && d.tournament.bracket.length === 3) {
      const ok = d.tournament.teams.every((t) => t && GAME_DATA.FORMATIONS[t.formation] && Array.isArray(t.ids) && t.ids.length === 11 && t.ids.every((x) => PLAYER_BY_ID[x]));
      if (ok) { out.tournament = d.tournament; if (out.tournament.mode !== 'squad') out.tournament.mode = 'draft'; }
    }
    return out;
  },
  finalize(st) {
    if (!Number.isFinite(st.playedSeen)) st.playedSeen = (st.stats && st.stats.played) || 0; // starter set od 11 Common players (only dodaje, nikad ne briše)
    if (!st.starterGiven) { GAME_DATA.STARTER_IDS.forEach((id) => { if (!st.owned[id]) st.owned[id] = 1; }); st.starterGiven = true; }
    return st;
  },
  load() {
    let raw = null;
    try { raw = localStorage.getItem(GAME_DATA.SAVE_KEY); } catch (e) { return this.finalize(this.defaultState()); }
    if (!raw) return this.finalize(this.defaultState());
    try {
      const data = JSON.parse(raw);
      return this.finalize(this.sanitize(data)); // v1 -> v2 migracija je u sanitize()
    } catch (e) {
      console.warn('Save corrupted, kept a backup copy', e);
      try { localStorage.setItem(GAME_DATA.SAVE_KEY + '.backup', raw); } catch (e2) { /* ignore */ }
      return this.finalize(this.defaultState());
    }
  },
  save(state) {
    try { localStorage.setItem(GAME_DATA.SAVE_KEY, JSON.stringify(state)); } catch (e) { console.warn('Save failed', e); }
  },
  reset() {
    try { localStorage.removeItem(GAME_DATA.SAVE_KEY); localStorage.removeItem(GAME_DATA.SAVE_KEY + '.backup'); } catch (e) { /* ignore */ }
    return this.finalize(this.defaultState());
  }
};

let STATE = SAVE_SYSTEM.load();
const BASE_PLAYER_STATS = {};
PLAYER_DATABASE.forEach(p => { BASE_PLAYER_STATS[p.id] = { ovr:p.ovr, attrs:{...p.attrs}, stats:p.stats.slice() }; });
function applyPlayerUpgradeLevel(id, level) { const p=PLAYER_BY_ID[id], b=BASE_PLAYER_STATS[id]; if(!p||!b)return; p.ovr=b.ovr+level; p.attrs={...b.attrs}; Object.keys(p.attrs).forEach(k => { p.attrs[k]=Math.min(99,p.attrs[k]+level); }); p.stats=b.stats.slice(); }
Object.keys(STATE.upgrades || {}).forEach(id => applyPlayerUpgradeLevel(id, STATE.upgrades[id]));
function trackPlayDay() {
  const played = (STATE.stats && STATE.stats.played) || 0;
  if (played > (STATE.playedSeen || 0)) {
    const day = new Date().toISOString().slice(0, 10);
    if (!Array.isArray(STATE.playDays)) STATE.playDays = [];
    if (!STATE.playDays.includes(day)) STATE.playDays.push(day);
    STATE.playedSeen = played;
  }
}
const persist = () => { trackPlayDay(); SAVE_SYSTEM.save(STATE); };

/* ==========================================================
   MATCH_ENGINE — događaji od 1. do 90. minute (+ nadoknada, penali)
   Cijela match se unaprijed generiše iz seed-a; UI je only reprodukuje.
   ========================================================== */
const MATCH_TEXT = {
  wing: ['{P} probija {S} stranu i šalje opasan centaršut.', '{P} nadmudruje beka na {S} strani i ubacuje loptu u šesnaesterac.', 'Brza akcija po krilu — {P} diže glavu i centrira!', '{P} stiže do osnovne linije i vraća loptu na peti metar.'],
  through: ['{P} vidi prostor i šalje loptu iza odbrane!', 'Briljantno dodavanje igrača {P} presijeca liniju odbrane.', '{P} i {A} razmjenjuju brza dodavanja pred kaznenim prostorom.', '{P} diriguje napadom i traži rupu u odbrani kluba {O}.'],
  long: ['{A} dobija loptu 25 metara od gola i odlučuje da proba iz daljine!', '{A} nema prostora za dodavanje i pokušava udarac sa distance.', 'Lopta se odbija do {A} na ivici kaznenog prostora!'],
  counter: ['Brza kontra! {P} prebacuje loptu na {A} u prazan prostor.', '{P} diže glavu i šalje dugu loptu za {A} — kontra!', 'Odbrana kluba {O} je otvorena — {A} jurca prema golu!'],
  intercept: ['{I} presijeca dodavanje i započinje brzu kontru!', '{I} čita igru savršeno, hvata loptu i kreće u kontru!'],
  defClear: ['{D} čisti loptu iz opasne zone.', '{D} savršeno presijeca centaršut.', 'Odbrana kluba {O} stoji čvrsto — {D} gasi opasnost.', '{D} u zadnji čas stiže do lopte i izbija je.'],
  corner: ['KORNER! {T} imaju priliku iz prekida.', '{D} izbija loptu u korner. {T} će izvoditi korner.'],
  cornerTake: ['{P} izvodi korner i ubacuje loptu u gužvu.', '{P} diže loptu na korneru — {A} se izdvaja u skoku!'],
  cornerNo: ['Korner izveden na prvu stativu, ali {D} je prvi na lopti.', 'Korner prelazi sve igrače — {D} izbija loptu iz opasne zone.'],
  goalHead: ['GOL! {A} glavom šalje loptu u mrežu nakon preciznog centaršuta {P}!', 'GOL! {A} skače najviše u kaznenom prostoru i glavom matira {G}!'],
  goalThrough: ['GOL! {A} ostaje sam pred {G} i hladnokrvno ga savladava nakon dodavanja {P}!', 'GOL! {A} lukom prebacuje {G} i mreža se trese!'],
  goalLong: ['GOL! {A} puca sa distance — {G} ne može da dohvati loptu!', 'GOL! Raketa iz daljine! {A} pogađa gornji ugao!'],
  goalCounter: ['GOL! Kontra završena! {A} savlađuje {G} nakon brze akcije {P}!', 'GOL! {A} u trku šutira i loptom pogađa mrežu!'],
  goalCorner: ['GOL! {A} glavom na korneru, mreža se trese!', 'GOL! Nakon korner-a {A} je prvi na lopti i pogađa!'],
  save: ['{G} sjajno brani udarac igrača {A}!', '{A} puca prema golu, ali {G} reaguje refleksno!', '{G} se baca u donji ugao i izbija šut igrača {A}!'],
  miss: ['{A} šutira — preko okvira gola.', '{A} promašuje za dlaku, lopta ide pored stative.', '{A} nema sreće, lopta ide pored gola.'],
  post: ['{A} pogađa stativu! Nevjerovatno!', '{A} gađa prečku! Lopta se vraća u igru.'],
  block: ['{D} blokira udarac igrača {A}!', '{D} baca se pod šut igrača {A} i spašava situaciju.'],
  foul: ['{F} ruši {V} — prekršaj za {T}.', 'Prekršaj! {F} kasno ulazi u duel sa {V}.'],
  yellow: ['Žuti karton za {F} zbog grubog starta.', 'Sudija vadi žuti karton igraču {F}.'],
  penalty: ['PENAL za {T}! {F} ruši {V} u kaznenom prostoru!', 'Sudija pokazuje na bijelu tačku! {F} je nedozvoljeno zaustavio {V}.'],
  penGoal: ['GOL! {A} sigurno izvodi jedanaesterac!', 'GOL! {A} šalje {G} na pogrešnu stranu!'],
  penSave: ['{G} brani penal igrača {A}!'],
  penMiss: ['{A} puca preko gola — penal promašen!']
};

const MATCH_ENGINE = (function () {
  const SHOOT_W = { ST: 1, LW: .55, RW: .55, CAM: .5, CM: .22, CDM: .08, LB: .06, RB: .06, CB: .04, GK: 0 };
  const HEAD_W = { ST: 1, CB: .6, CDM: .25, CM: .2, CAM: .15, LW: .1, RW: .1, LB: .1, RB: .1, GK: 0 };
  const PASS_W = { CAM: 1, CM: .9, LW: .7, RW: .7, CDM: .5, LB: .45, RB: .45, ST: .3, CB: .12, GK: .02 };
  const DEF_W = { CB: 1, CDM: .8, LB: .6, RB: .6, CM: .4, CAM: .15, LW: .1, RW: .1, ST: .05, GK: 0 };
  const tpl = (s, v) => s.replace(/\{(\w)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));

  function simulate(teams, seed, opts) {
    const o = opts || {};
    const R = mulberry32(seed >>> 0);
    const rnd = () => R();
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const wpick = (arr, wf) => weightedPick(arr, wf, rnd);
    const T = teams;
    const S = [T[0].slots, T[1].slots];
    const STY = (side) => T[side].style;
    // vremenska linija
    const ticks = [];
    const h1 = 1 + Math.floor(rnd() * 3) + (rnd() < .3 ? 1 : 0), h2 = 2 + Math.floor(rnd() * 3);
    for (let m = 1; m <= 45; m++) ticks.push({ l: m + "'", h: 1, m });
    for (let s = 1; s <= h1; s++) ticks.push({ l: '45+' + s + "'", h: 1, m: 45 });
    const firstEnd = ticks.length - 1;
    for (let m = 46; m <= 90; m++) ticks.push({ l: m + "'", h: 2, m });
    for (let s = 1; s <= h2; s++) ticks.push({ l: '90+' + s + "'", h: 2, m: 90 });
    const lastIdx = ticks.length - 1;
    const halfEnd = (i) => (ticks[i].h === 1 ? firstEnd : lastIdx);

    const stats = { poss: [0, 0], shots: [0, 0], sot: [0, 0], corners: [0, 0], fouls: [0, 0], yellow: [0, 0], saves: [0, 0] };
    const score = [0, 0];
    const events = [];
    const goals = [];
    const snap = () => JSON.parse(JSON.stringify(stats));
    const ballX = (side, depth) => (side === 0 ? 52 + depth * 40 : 48 - depth * 40);
    function ev(ti, team, kind, text, ball, extra) {
      const e = { t: ti, l: ticks[ti].l, team, kind, text, score: score.slice(), st: snap(), ball: ball === undefined ? 50 : ball };
      if (extra) Object.assign(e, extra);
      events.push(e);
    }
    // --- izbor aktera
    const gkOf = (side) => S[side][0];
    function pickShooter(side, header, exclude) {
      return wpick(S[side].filter((s) => s.pos !== 'GK' && s !== exclude), (s) => {
        let w;
        if (header) w = (HEAD_W[s.pos] || .05) * Math.pow(s.eff.phy / 70, 2.2) * (s.p.trait === 'aerialKing' ? 1.8 : 1) * (0.4 + 0.6 * s.eff.sho / 70);
        else w = (SHOOT_W[s.pos] || .03) * Math.pow(s.eff.sho / 70, 2);
        if (s.p.trait === 'finisher') w *= 1.35;
        return w;
      });
    }
    function pickPasser(side, exclude) {
      return wpick(S[side].filter((s) => s !== exclude && s.pos !== 'GK'), (s) => (PASS_W[s.pos] || .1) * Math.pow(s.eff.pas / 70, 2) * (s.p.trait === 'playmaker' ? 1.8 : 1));
    }
    function pickDefender(side) {
      return wpick(S[side].filter((s) => s.pos !== 'GK'), (s) => (DEF_W[s.pos] || .05) * Math.pow(s.eff.def / 70, 1.5));
    }
    function pickRunner(side, exclude) { // kontre: brzi igrači
      return wpick(S[side].filter((s) => s !== exclude && s.pos !== 'GK'), (s) => (SHOOT_W[s.pos] || .05) * Math.pow(s.eff.pac / 70, 3) * (s.p.trait === 'speedster' ? 1.8 : 1));
    }
    const count = (side, trait) => S[side].filter((s) => s.pos !== 'GK' && s.p.trait === trait).length;
    const gkEff = (side) => { const g = gkOf(side); return g.eff.ref * (g.p.trait === 'reflexMaster' ? 1.08 : 1); };

    // --- attack
    function runAttack(idx, side0, forcedKind, prefix) {
      let side = side0;
      let k = 0;
      const last = halfEnd(idx);
      const emit = (team, kind, text, ball, extra) => {
        ev(Math.min(idx + k, last), team, kind, (k === 0 && prefix ? prefix + ' ' : '') + text, ball, extra);
        k++;
      };
      let kind = forcedKind;
      const A0 = () => T[side], D0 = () => T[1 - side];
      if (!kind) {
        const st = STY(side);
        kind = wpick(['wing', 'through', 'long'], (x) => ({ wing: .38 * st.wing, through: .34 * st.through, long: .12 * st.long }[x]));
        // presijecanje dodavanja -> kontra suprotne ekipe
        const ints = S[1 - side].filter((s) => s.pos !== 'GK' && s.p.trait === 'interceptor');
        if (rnd() < .035 + .05 * ints.length + STY(1 - side).intercept) {
          const I = ints.length ? pick(ints) : pickDefender(1 - side);
          side = 1 - side; kind = 'counter';
          emit(side, 'turnover', tpl(pick(MATCH_TEXT.intercept), { I: I.p.name }), ballX(side, .35));
          kind = 'counter';
          return finishChain();
        }
      }
      return finishChain();

      function finishChain() {
        const A = A0(), D = D0();
        const sa = S[side], sd = S[1 - side];
        const passer = kind === 'counter' ? pickRunner(side) : pickPasser(side);
        const header = kind === 'wing';
        let shooter = kind === 'counter' ? pickRunner(side, passer) : pickShooter(side, header, passer);
        const vars = { P: passer.p.name, A: shooter.p.name, O: D.name, T: A.name, S: ['CAM', 'CM'].includes(passer.pos) ? pick(['desnu', 'lijevu']) : (passer.pos === 'LW' || passer.pos === 'LB' ? 'lijevu' : passer.pos === 'RW' || passer.pos === 'RB' ? 'desnu' : pick(['desnu', 'lijevu'])), G: gkOf(1 - side).p.name };
        const playm = count(side, 'playmaker'), walls = count(1 - side, 'wall'), speeders = count(side, 'speedster');
        let pc = .44 + (A.atk - D.def) / 115 + .02 * playm - .018 * walls;
        if (kind === 'counter') pc += .10 + .025 * speeders;
        if (kind === 'through') pc += .02;
        pc = clamp(pc, .16, .8);
        emit(side, 'build', tpl(pick(MATCH_TEXT[kind]), vars), ballX(side, .6));
        if (kind !== 'long' && rnd() > pc) { // šansa nije stvorena
          const d = pickDefender(1 - side);
          const dv = { D: d.p.name, O: D.name, T: A.name };
          if (rnd() < .2) {
            emit(1 - side, 'def', tpl(pick(MATCH_TEXT.defClear), dv), ballX(side, .5));
            corner(side, d);
          } else emit(1 - side, 'def', tpl(pick(MATCH_TEXT.defClear), dv), ballX(side, .45));
          return k;
        }
        shot(kind, shooter, passer);
        return k;
      }

      function corner(cs, d) {
        emit(cs, 'corner', tpl(pick(MATCH_TEXT.corner), { T: T[cs].name, D: d.p.name }), ballX(cs, .95), null);
        stats.corners[cs]++;
        events[events.length - 1].st = snap();
        const taker = pickPasser(cs), head = pickShooter(cs, true, taker);
        const dd = pickDefender(1 - cs);
        const pcor = clamp(.2 + (head.eff.phy - 72) / 150 + (head.p.trait === 'aerialKing' ? .07 : 0) - (T[1 - cs].def - 70) / 400, .08, .55);
        if (rnd() < pcor) {
          emit(cs, 'build', tpl(pick(MATCH_TEXT.cornerTake), { P: taker.p.name, A: head.p.name }), ballX(cs, .95));
          shot('corner', head, taker);
        } else emit(1 - cs, 'def', tpl(pick(MATCH_TEXT.cornerNo), { D: dd.p.name }), ballX(cs, .8));
      }

      function shot(kd, shooter, passer) {
        const A = T[side], D = T[1 - side];
        const header = kd === 'wing' || kd === 'corner';
        const aerial = shooter.p.trait === 'aerialKing', fin = shooter.p.trait === 'finisher';
        const sho = header ? shooter.eff.sho * .45 + shooter.eff.phy * .55 + (aerial ? 6 : 0) : shooter.eff.sho;
        const pBlock = clamp(.13 + (kd === 'long' ? .08 : 0) + (D.def - 70) / 400, .05, .3);
        const pOn = clamp(.42 + (sho - 68) / 170 + (fin ? .05 : 0) + (kd === 'counter' ? .05 : 0) + (kd === 'long' ? -.08 : 0) + (kd === 'through' ? .03 : 0), .2, .72);
        const pGoal = clamp(.335 + (sho - gkEff(1 - side)) / 190 + (fin ? .04 : 0) + (header && aerial ? .03 : 0) + (kd === 'counter' ? .04 : 0) + (kd === 'long' ? -.09 : 0), .08, .58);
        const gk = gkOf(1 - side).p.name;
        const v = { A: shooter.p.name, P: passer.p.name, G: gk, D: pickDefender(1 - side).p.name, T: A.name };
        const ball = ballX(side, .95);
        stats.shots[side]++;
        const r = rnd();
        if (r < pBlock) {
          emit(1 - side, 'block', tpl(pick(MATCH_TEXT.block), v), ball);
          if (rnd() < .25) corner(side, pickDefender(1 - side));
        } else if (rnd() > pOn) {
          emit(1 - side, 'miss', tpl(pick(rnd() < .15 ? MATCH_TEXT.post : MATCH_TEXT.miss), v), ball);
        } else {
          stats.sot[side]++;
          if (rnd() < pGoal) {
            score[side]++;
            goals.push({ side, name: shooter.p.name, emoji: shooter.p.emoji, l: ticks[Math.min(idx + k, last)].l });
            const pool = kd === 'wing' ? 'goalHead' : kd === 'through' ? 'goalThrough' : kd === 'long' ? 'goalLong' : kd === 'counter' ? 'goalCounter' : 'goalCorner';
            const txt = tpl(pick(MATCH_TEXT[pool]), v) + ` (${T[0].name} ${score[0]}:${score[1]} ${T[1].name})`;
            emit(side, 'goal', txt, side === 0 ? 99 : 1, { scorer: shooter.p.name, emoji: shooter.p.emoji });
          } else {
            stats.saves[1 - side]++;
            emit(1 - side, 'save', tpl(pick(MATCH_TEXT.save), v), ball);
            if (rnd() < .25) corner(side, pickDefender(1 - side));
          }
        }
      }
    }

    // --- prekršaj / karton / penal
    function runFoul(idx, holder) {
      const fs = 1 - holder; // faulira ekipa bez lopte
      const F = pickDefender(fs), V = pickPasser(holder);
      const last = halfEnd(idx);
      let k = 0;
      const emit = (team, kind, text, ball, extra) => { ev(Math.min(idx + k, last), team, kind, text, ball, extra); k++; };
      stats.fouls[fs]++;
      if (rnd() < .06) { // penal
        emit(holder, 'foul', tpl(pick(MATCH_TEXT.penalty), { F: F.p.name, V: V.p.name, T: T[holder].name }), ballX(holder, .95));
        const tk = wpick(S[holder].filter((s) => s.pos !== 'GK'), (s) => Math.pow(s.eff.sho / 70, 3) * (SHOOT_W[s.pos] + .05));
        const gk = gkOf(fs);
        const v = { A: tk.p.name, G: gk.p.name };
        stats.shots[holder]++;
        const p = clamp(.76 + (tk.eff.sho - gkEff(fs)) / 380, .55, .88);
        const r = rnd();
        if (r < p) {
          stats.sot[holder]++; score[holder]++;
          goals.push({ side: holder, name: tk.p.name, emoji: tk.p.emoji, l: ticks[Math.min(idx + k, last)].l, pen: true });
          emit(holder, 'goal', tpl(pick(MATCH_TEXT.penGoal), v) + ` (${T[0].name} ${score[0]}:${score[1]} ${T[1].name})`, holder === 0 ? 99 : 1, { scorer: tk.p.name, emoji: tk.p.emoji });
        } else if (r < p + (1 - p) * .6) {
          stats.sot[holder]++; stats.saves[fs]++;
          emit(fs, 'save', tpl(pick(MATCH_TEXT.penSave), v), ballX(holder, .95));
        } else emit(fs, 'miss', tpl(pick(MATCH_TEXT.penMiss), v), ballX(holder, .95));
        return k;
      }
      emit(fs, 'foul', tpl(pick(MATCH_TEXT.foul), { F: F.p.name, V: V.p.name, T: T[holder].name }), ballX(holder, .5));
      if (rnd() < .22) { stats.yellow[fs]++; emit(fs, 'card', tpl(pick(MATCH_TEXT.yellow), { F: F.p.name }), ballX(holder, .5)); }
      return k;
    }

    // --- glavna petlja
    let busyUntil = 0, lastDone = false;
    for (let i = 0; i <= lastIdx; i++) {
      if (i === 0) ev(0, -1, 'sys', 'Sudija označava početak meča! ' + T[0].name + ' protiv ' + T[1].name + '.', 50);
      if (i === firstEnd + 1) ev(i, -1, 'sys', 'Počinje drugo poluvrijeme.', 50);
      const pA = T[0].ctrl / (T[0].ctrl + T[1].ctrl);
      const holder = rnd() < pA ? 0 : 1;
      stats.poss[holder]++;
      if (i < busyUntil) { /* lanac događaja još traje */ }
      else {
        let used = 0;
        if (ticks[i].l === "89'" && !lastDone) {
          lastDone = true;
          const side = score[0] < score[1] ? 0 : score[1] < score[0] ? 1 : (rnd() < pA ? 0 : 1);
          used = runAttack(i, side, null, 'Posljednji napad!');
        } else if (rnd() < .06 * STY(1 - holder).counter) {
          used = runAttack(i, 1 - holder, 'counter', null);
        } else if (rnd() < .62) {
          used = runAttack(i, holder, null, null);
        } else if (rnd() < .1 * STY(1 - holder).foul) {
          used = runFoul(i, holder);
        }
        busyUntil = Math.min(i + used, halfEnd(i) + 1);
      }
      if (i === firstEnd) ev(i, -1, 'sys', `Sudija označava kraj prvog poluvremena. ${T[0].name} ${score[0]}:${score[1]} ${T[1].name}`, 50);
    }
    ev(lastIdx, -1, 'sys', `Kraj meča! ${T[0].name} ${score[0]}:${score[1]} ${T[1].name}`, 50);

    // --- penali ako je neriješeno (nokaut)
    let pens = null, winner = score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : -1;
    if (winner === -1) {
      const pe = [0, 0], taken = [0, 0];
      ev(lastIdx, -1, 'sys', 'Neriješeno! Slijedi raspucavanje jedanaesteraca.', 50);
      const takers = [0, 1].map((s) => S[s].filter((x) => x.pos !== 'GK').sort((a, b) => b.eff.sho - a.eff.sho));
      const kick = (s) => {
        const tk = takers[s][taken[s] % takers[s].length]; taken[s]++;
        const p = clamp(.76 + (tk.eff.sho - gkEff(1 - s)) / 350, .55, .9);
        const ok = rnd() < p;
        if (ok) pe[s]++;
        const e = { t: lastIdx, l: 'PEN', team: s, kind: ok ? 'goal' : 'miss', text: (ok ? 'GOL! ' : 'Promašaj! ') + tk.p.name + (ok ? ' pogađa' : ' ne uspijeva') + ` — raspucavanje ${pe[0]}:${pe[1]}`, score: score.slice(), st: snap(), ball: s === 0 ? 99 : 1, pens: pe.slice() };
        if (ok) { e.scorer = tk.p.name; e.emoji = tk.p.emoji; e.penShootout = true; }
        events.push(e);
      };
      for (let r = 0; r < 5; r++) {
        kick(0); if (pe[0] > pe[1] + (5 - taken[1]) || pe[1] > pe[0] + (5 - taken[0])) break;
        kick(1); if (pe[0] > pe[1] + (5 - taken[1]) || pe[1] > pe[0] + (5 - taken[0])) break;
      }
      let guard = 0;
      while (pe[0] === pe[1] && guard++ < 25) { kick(0); kick(1); }
      if (pe[0] === pe[1]) pe[rnd() < .5 ? 0 : 1]++;
      pens = pe; winner = pe[0] > pe[1] ? 0 : 1;
      events.push({ t: lastIdx, l: 'PEN', team: -1, kind: 'sys', text: `${T[winner].name} pobjeđuje na penale ${pe[0]}:${pe[1]}!`, score: score.slice(), st: snap(), ball: 50, pens: pe.slice() });
    }
    return { events, stats, score, pens, winner, goals, seed };
  }
  return { simulate, possPct: (st) => { const t = st.poss[0] + st.poss[1]; const a = t ? Math.round(st.poss[0] / t * 100) : 50; return [a, 100 - a]; } };
})();

