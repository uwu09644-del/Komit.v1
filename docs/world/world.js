// =====================================================================
//  world.js: the World. Its laws never change; only the hero can change himself.
//  A living fantasy world: towns, families, jobs, hunters, rifts full of monsters,
//  love, babies, ageing, death, crime and revenge. Every person decides for
//  themselves, every moment, from their own needs, personality, memories and
//  relationships.
// =====================================================================

export const TILE = 16, MAP = 96, MIN_PER_SEC = 16, DAYS_PER_YEAR = 8;
const N = MAP * MAP, DAY = 1440;
export const T = { GRASS: 0, FOREST: 1, WATER: 2, MOUNTAIN: 3, SAND: 4, ROAD: 5, FIELD: 6, PLAZA: 7 };
const WALK = [1, 1, 0, 0, 1, 1, 1, 1];
const SPEED = [1, 0.75, 0, 0, 0.9, 1.25, 0.95, 1.1];

const R = Math.random;
const pick = (a, r = R) => a[Math.floor(r() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const roman = n => ['', 'I', 'II', 'III', 'IV', 'V'][n] || String(n);
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hrand(i, k) {
  let x = (Math.imul(i, 374761393) + Math.imul(k, 668265263)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
function shuffle(a, r) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------------------------------------------------------------- names
const M1 = ['Al', 'Bran', 'Cor', 'Dar', 'Ed', 'Fen', 'Gar', 'Hal', 'Ir', 'Jor', 'Kel', 'Lor', 'Mor', 'Nor', 'Os', 'Per', 'Rol', 'Sel', 'Tor', 'Ul', 'Var', 'Wen', 'Ber', 'Cal', 'Dun', 'Gil', 'Ro', 'Tam'];
const M2 = ['ric', 'an', 'win', 'dor', 'mar', 'ek', 'as', 'en', 'ul', 'ard', 'im', 'os', 'lan', 'rick', 'ion', 'bert', 'old'];
const F1 = ['A', 'Bri', 'Ce', 'Da', 'E', 'Fae', 'Gwen', 'Hel', 'I', 'Ja', 'Ka', 'Li', 'Mae', 'Ne', 'O', 'Pe', 'Ro', 'Sa', 'Te', 'Vi', 'Wy', 'Ys', 'El', 'Mi', 'Lu'];
const F2 = ['la', 'ra', 'lyn', 'na', 'wen', 'sa', 'ria', 'ssa', 'ne', 'dra', 'lia', 've', 'mi', 'ris', 'ette'];
const FAMILIES = ['Ashford', 'Brightwater', 'Coldbrook', 'Dunmore', 'Emberly', 'Fairholt', 'Greymane', 'Hollowell', 'Ironwood', 'Larkspur', 'Mossgrove', 'Northam', 'Oakhart', 'Ravensworth', 'Stonebridge', 'Thornfield', 'Underhill', 'Westerly', 'Copperfield', 'Wolfsbane', 'Quillon', 'Marsh', 'Blackwood', 'Fenwick'];
const TOWN_NAMES = ['Highmere', 'Ashvale', 'Thornwick', 'Brindlemoor', 'Duskhollow', 'Westmarch', 'Elderford', 'Ravensreach', 'Goldcrest', 'Mirewood'];
export const personName = sex => (sex === 'm' ? pick(M1) + pick(M2) : pick(F1) + pick(F2));

// ---------------------------------------------------------------- monsters
export const MON = {
  slime: { name: 'Slime', col: '#73d46b', size: 0.3, spd: 1.7, aggro: 4, hp: 0.8, atk: 0.7, def: 0.5 },
  wolf: { name: 'Wolf', col: '#9ba3ab', size: 0.34, spd: 3.2, aggro: 7, hp: 0.9, atk: 1.0, def: 0.7 },
  goblin: { name: 'Goblin', col: '#86a03c', size: 0.3, spd: 3.0, aggro: 6, hp: 0.9, atk: 1.0, def: 0.8 },
  skeleton: { name: 'Skeleton', col: '#e6e0cf', size: 0.34, spd: 2.5, aggro: 6, hp: 1.0, atk: 1.1, def: 1.1 },
  orc: { name: 'Orc', col: '#4f6e31', size: 0.44, spd: 2.7, aggro: 7, hp: 1.3, atk: 1.2, def: 1.2 },
  troll: { name: 'Troll', col: '#7d6047', size: 0.56, spd: 2.1, aggro: 6, hp: 1.8, atk: 1.3, def: 1.4 },
  wraith: { name: 'Wraith', col: '#a98ee0', size: 0.4, spd: 3.2, aggro: 8, hp: 1.0, atk: 1.4, def: 0.9 },
  drake: { name: 'Drake', col: '#cc4a3c', size: 0.62, spd: 3.1, aggro: 9, hp: 1.6, atk: 1.5, def: 1.5 },
};
const RIFT_TYPES = [null, ['slime', 'wolf'], ['goblin', 'wolf'], ['skeleton', 'orc'], ['troll', 'wraith'], ['drake', 'wraith']];
const RIFT_LEVELS = [null, [1, 4], [5, 10], [11, 19], [20, 29], [30, 42]];
const RIFT_COL = [null, '#5cc8ff', '#45d6b5', '#a46cff', '#ff5cd6', '#ff4a3d'];
const JOB_COL = { farmer: '#9a7a43', merchant: '#9a5bb0', healer: '#efe2a4', elder: '#a3a3a3', child: '#e0a77f' };
const CLS_COL = { warrior: '#c8513f', archer: '#4fa35d', mage: '#5b72db', healer: '#e8d575', awakened: '#f2b35b' };
const SKIN = ['#f0c9a4', '#d9a67c', '#b57b52', '#8a5a3a', '#f6dcc4'];

// ---------------------------------------------------------------- terrain generation
function valueNoise(rng) {
  const S = 32, g = new Float32Array(S * S);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const at = (x, y) => g[(((y % S) + S) % S) * S + (((x % S) + S) % S)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
const fbm = (n, x, y) => n(x, y) * 0.55 + n(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + n(x * 4.3 + 1, y * 4.3 + 9) * 0.15;

// A* on the tile grid (shared buffers, no allocation per search)
const gScore = new Float32Array(N), came = new Int32Array(N), seen = new Int32Array(N), shut = new Int32Array(N);
const heapI = new Int32Array(N * 8), heapF = new Float32Array(N * 8);
let stampId = 1;
function astar(sx, sy, tx, ty, cost, maxNodes) {
  stampId++;
  let hs = 0;
  const push = (i, f) => {
    let k = hs++;
    heapI[k] = i; heapF[k] = f;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heapF[p] <= heapF[k]) break;
      [heapI[p], heapI[k]] = [heapI[k], heapI[p]]; [heapF[p], heapF[k]] = [heapF[k], heapF[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heapI[0];
    hs--;
    heapI[0] = heapI[hs]; heapF[0] = heapF[hs];
    let k = 0;
    for (;;) {
      const l = 2 * k + 1, r = l + 1;
      let m = k;
      if (l < hs && heapF[l] < heapF[m]) m = l;
      if (r < hs && heapF[r] < heapF[m]) m = r;
      if (m === k) break;
      [heapI[m], heapI[k]] = [heapI[k], heapI[m]]; [heapF[m], heapF[k]] = [heapF[k], heapF[m]];
      k = m;
    }
    return top;
  };
  const s = sy * MAP + sx, t = ty * MAP + tx;
  const h = (x, y) => Math.hypot(x - tx, y - ty) * 0.8;
  seen[s] = stampId; gScore[s] = 0; came[s] = -1;
  push(s, h(sx, sy));
  let n = 0;
  while (hs > 0 && n++ < maxNodes && hs < N * 8 - 8) {
    const cur = pop();
    if (cur === t) {
      const out = [];
      for (let c = cur; c !== -1; c = came[c]) out.push([c % MAP, (c / MAP) | 0]);
      return out.reverse();
    }
    if (shut[cur] === stampId) continue;
    shut[cur] = stampId;
    const cx = cur % MAP, cy = (cur / MAP) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= MAP || ny >= MAP) continue;
        const c = cost(nx, ny);
        if (c === Infinity) continue;
        const diag = dx && dy;
        if (diag && (cost(cx + dx, cy) === Infinity || cost(cx, cy + dy) === Infinity)) continue;
        const ni = ny * MAP + nx, ng = gScore[cur] + c * (diag ? 1.414 : 1);
        if (seen[ni] !== stampId || ng < gScore[ni]) {
          seen[ni] = stampId; gScore[ni] = ng; came[ni] = cur;
          push(ni, ng + h(nx, ny));
        }
      }
    }
  }
  return null;
}

function generate(seed) {
  const rng = mulberry32(seed);
  const tiles = new Uint8Array(N);
  const ne = valueNoise(rng), nm = valueNoise(rng);
  const E = new Float32Array(N), M = new Float32Array(N);
  for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
    E[y * MAP + x] = fbm(ne, x / 13, y / 13);
    M[y * MAP + x] = fbm(nm, x / 10 + 40, y / 10 + 40);
  }
  const q = (arr, p) => { const s = Float32Array.from(arr).sort(); return s[Math.floor(p * (s.length - 1))]; };
  const wE = q(E, 0.13), sE = q(E, 0.17), mE = q(E, 0.91), fM = q(M, 0.7);
  for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
    const i = y * MAP + x, edge = Math.min(x, y, MAP - 1 - x, MAP - 1 - y);
    tiles[i] = edge < 2 ? T.MOUNTAIN : E[i] < wE ? T.WATER : E[i] < sE ? T.SAND : E[i] > mE ? T.MOUNTAIN : M[i] > fM ? T.FOREST : T.GRASS;
  }
  // towns
  const names = shuffle(TOWN_NAMES, rng), towns = [];
  for (let minD = 34; towns.length < 3 && minD >= 14; minD -= 5) {
    for (let k = 0; k < 800 && towns.length < 3; k++) {
      const x = 13 + Math.floor(rng() * (MAP - 26)), y = 13 + Math.floor(rng() * (MAP - 26));
      const t = tiles[y * MAP + x];
      if (t === T.WATER || t === T.MOUNTAIN) continue;
      if (towns.some(o => Math.hypot(o.x - x, o.y - y) < minD)) continue;
      towns.push({ id: towns.length, name: names[towns.length], x, y, food: 40 });
    }
  }
  const houses = [];
  for (const tn of towns) {
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      const r = Math.hypot(dx, dy), x = tn.x + dx, y = tn.y + dy;
      if (r > 7.5 || x < 2 || y < 2 || x >= MAP - 2 || y >= MAP - 2) continue;
      tiles[y * MAP + x] = r <= 1.6 ? T.PLAZA : T.GRASS;
    }
    tn.guild = { x: tn.x + 0.5, y: tn.y - 2.3 };
    tn.market = { x: tn.x + 3.5, y: tn.y + 0.6 };
    tn.tavern = { x: tn.x - 2.5, y: tn.y + 0.6 };
    tn.fields = [];
    const a0 = rng() * Math.PI * 2;
    for (let f = 0; f < 3; f++) {
      const a = a0 + f * 2.1, fx = Math.round(tn.x + Math.cos(a) * 9.5), fy = Math.round(tn.y + Math.sin(a) * 9.5);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = fx + dx, y = fy + dy;
        if (x < 2 || y < 2 || x >= MAP - 2 || y >= MAP - 2) continue;
        if (tiles[y * MAP + x] !== T.WATER && tiles[y * MAP + x] !== T.MOUNTAIN) tiles[y * MAP + x] = T.FIELD;
      }
      tn.fields.push({ x: fx + 0.5, y: fy + 0.5 });
    }
    let made = 0;
    for (let k = 0; k < 200 && made < 8; k++) {
      const a = rng() * Math.PI * 2, r = 4 + rng() * 3;
      const hx = Math.round(tn.x + Math.cos(a) * r), hy = Math.round(tn.y + Math.sin(a) * r);
      if (Math.abs(hx - tn.x) <= 1 && hy < tn.y) continue;                       // guild
      if (houses.some(h => Math.hypot(h.x - hx, h.y - hy) < 2)) continue;
      if ([tn.guild, tn.market, tn.tavern].some(b => Math.hypot(b.x - 0.5 - hx, b.y - 0.5 - hy) < 2)) continue;
      houses.push({ id: houses.length + 1, x: hx, y: hy, town: tn.id });
      made++;
    }
  }
  // roads between towns
  const roadCost = (x, y) => {
    const t = tiles[y * MAP + x];
    if (x < 2 || y < 2 || x >= MAP - 2 || y >= MAP - 2) return Infinity;
    return t === T.WATER ? 14 : t === T.MOUNTAIN ? 26 : t === T.FOREST ? 2 : t === T.ROAD ? 0.4 : 1;
  };
  for (let i = 0; i + 1 < towns.length; i++) {
    const a = towns[i], b = towns[i + 1];
    const p = astar(a.x, a.y, b.x, b.y, roadCost, N);
    if (p) for (const [x, y] of p) if (tiles[y * MAP + x] !== T.PLAZA) tiles[y * MAP + x] = T.ROAD;
  }
  return { tiles, towns, houses };
}

// ---------------------------------------------------------------- talk
const LINES = {
  greet: ['Good day!', 'Hello there.', 'How are you?', 'Fine weather.', 'Busy day?', 'Morning!'],
  friend: ['Good to see you!', 'Come by tonight?', 'I missed you.', 'Haha, so true!', 'Stay safe out there.'],
  flirt: ['You look lovely today.', 'Walk with me?', 'I like being near you.', 'Stay a little longer?'],
  rude: ['Get lost.', 'What do you want?', 'Leave me alone.', 'You again?', 'Watch your mouth.'],
  fight: ['You will regret that!', 'Enough!', 'Come here!'],
  scared: ['Monsters!', 'Run!', 'Help!', 'Get inside!'],
  grief: ['I miss them…', 'Why them…'],
  hunt: ['For the town!', 'Stay behind me!', 'Got one!', 'Another one!'],
  kid: ['Tag, you\'re it!', 'Let\'s play!', 'Catch me!', 'Hehe!'],
};
const TRAIT_WORDS = e => {
  const t = e.traits, w = [];
  if (t.brave > 0.7) w.push('brave'); else if (t.brave < 0.3) w.push('timid');
  if (t.kind > 0.7) w.push('kind'); else if (t.kind < 0.3) w.push('cold');
  if (t.greed > 0.7) w.push('greedy');
  if (t.social > 0.7) w.push('outgoing'); else if (t.social < 0.3) w.push('shy');
  if (t.ambition > 0.7) w.push('ambitious');
  if (t.aggro > 0.6) w.push('hot-tempered');
  if (t.curious > 0.7) w.push('curious');
  return w.length ? w : ['ordinary'];
};

const r_days = (w, r) => r.breakDay - w.day;
const INTENTS = new Set(['fight', 'hunt', 'guard', 'flee', 'rest', 'eat', 'shop', 'work', 'talk', 'court', 'follow', 'go', 'explore', 'wander', 'idle', 'steal']);
const STICK = { talk: 400, court: 400, hunt: 900, work: 300, wander: 90, shop: 500, eat: 500, explore: 500, go: 600, guard: 500, follow: 40, steal: 400 };

// =====================================================================
export class World {
  constructor(seed) {
    this.seed = seed;
    const g = generate(seed);
    this.tiles = g.tiles; this.towns = g.towns; this.houses = g.houses;
    this.ents = new Map(); this.rifts = []; this.graves = []; this.chronicle = []; this.quests = [];
    this.deadNames = {};
    this.min = 8 * 60; this.nextId = 1000; this.heroId = 0;
    this.stats = { born: 0, died: 0, murders: 0, riftsClosed: 0, breaks: 0, partners: 0 };
    this.listeners = []; this.fx = [];
    this.mind = null; this.mindErrors = 0; this.lastMindError = '';
    this.passive = {}; this.passiveT = 0; this.pathBudget = 8;
    this.lastDay = this.day; this.lastHour = Math.floor(this.hour);
    this.reach = this.floodFill();
    this.heroApi = this.buildHeroApi();
  }

  static create(seed, hero) {
    const w = new World(seed);
    w.populate();
    w.spawnHero(hero);
    w.openRift(1); w.openRift(1); w.openRift(2);
    w.chron(`The chronicle begins. ${w.towns.map(t => t.name).join(', ')} stand among the wilds.`, 'world');
    return w;
  }

  static load(d) {
    const w = new World(d.seed);
    for (const k of ['min', 'nextId', 'heroId', 'towns', 'houses', 'rifts', 'graves', 'chronicle', 'quests', 'stats', 'deadNames']) if (d[k] !== undefined) w[k] = d[k];
    for (const e of d.ents) { e.path = null; e.busy = 0; w.ents.set(e.id, e); }
    w.lastDay = w.day; w.lastHour = Math.floor(w.hour);
    w.terrainDirty = true;
    return w;
  }

  serialize() {
    const ents = [];
    for (const e of this.ents.values()) {
      if (!e.alive && !e.hero) continue;
      const { path, pathI, pathTx, pathTy, stuck, say, ...rest } = e;
      ents.push(rest);
    }
    const { seed, min, nextId, heroId, towns, houses, rifts, graves, chronicle, quests, stats, deadNames } = this;
    return { v: 1, seed, min, nextId, heroId, towns, houses, rifts, graves, chronicle, quests, stats, deadNames, ents, savedAt: Date.now() };
  }

  // ---------------------------------------------------------------- time & map
  get day() { return Math.floor(this.min / DAY) + 1; }
  get hour() { return (this.min % DAY) / 60; }
  get year() { return Math.floor((this.day - 1) / DAYS_PER_YEAR) + 1; }
  get isNight() { const h = this.hour; return h >= 21 || h < 5.5; }
  get hero() { return this.ents.get(this.heroId); }
  clock() { const h = this.hour; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; }
  tileAt(x, y) { x |= 0; y |= 0; return x < 0 || y < 0 || x >= MAP || y >= MAP ? T.MOUNTAIN : this.tiles[y * MAP + x]; }
  walkable(x, y) { return !!WALK[this.tileAt(x, y)]; }
  clearLine(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d * 2);
    for (let i = 1; i <= n; i++) if (!this.walkable(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
    return true;
  }
  floodFill() {
    const r = new Uint8Array(N), t0 = this.towns[0];
    const q = [t0.y * MAP + t0.x];
    r[q[0]] = 1;
    while (q.length) {
      const c = q.pop(), x = c % MAP, y = (c / MAP) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, ni = ny * MAP + nx;
        if (nx < 0 || ny < 0 || nx >= MAP || ny >= MAP || r[ni] || !WALK[this.tiles[ni]]) continue;
        r[ni] = 1; q.push(ni);
      }
    }
    return r;
  }
  randomSpot(x, y, rad, tries = 20) {
    for (let k = 0; k < tries; k++) {
      const a = R() * Math.PI * 2, r = R() * rad, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (px < 2 || py < 2 || px >= MAP - 2 || py >= MAP - 2) continue;
      if (this.walkable(px, py) && this.reach[(py | 0) * MAP + (px | 0)]) return { x: px, y: py };
    }
    return { x, y };
  }
  wildSpot(minTown = 12) {
    for (let k = 0; k < 300; k++) {
      const x = 3 + R() * (MAP - 6), y = 3 + R() * (MAP - 6), i = (y | 0) * MAP + (x | 0);
      if (!this.reach[i] || !WALK[this.tiles[i]]) continue;
      if (this.towns.some(t => Math.hypot(t.x - x, t.y - y) < minTown)) continue;
      return { x: (x | 0) + 0.5, y: (y | 0) + 0.5 };
    }
    return null;
  }
  wildNear(x, y, min = 14, max = 28) {
    for (let k = 0; k < 120; k++) {
      const a = R() * Math.PI * 2, r = min + R() * (max - min), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r, i = (py | 0) * MAP + (px | 0);
      if (px < 3 || py < 3 || px >= MAP - 3 || py >= MAP - 3 || !this.reach[i] || !WALK[this.tiles[i]]) continue;
      if (this.towns.some(t => Math.hypot(t.x - px, t.y - py) < min)) continue;
      return { x: px, y: py };
    }
    return this.wildSpot(min);
  }
  townAt(e, r = 9) { return this.towns.find(t => Math.hypot(t.x + 0.5 - e.x, t.y + 0.5 - e.y) < r) || null; }
  house(id) { return this.houses.find(h => h.id === id); }
  homeSpot(e) {
    const h = this.house(e.home);
    if (h) return { x: h.x + 0.5, y: h.y + 0.7 };
    if (e.camp) return e.camp;
    const t = this.towns[e.town] || this.towns[0];
    return { x: t.tavern.x, y: t.tavern.y + 0.3 };
  }
  nameOf(id) { const e = this.ents.get(id); return e ? e.name : this.deadNames[id] || 'someone'; }
  fullName(e) { return e.family ? `${e.name} ${e.family}` : e.name; }

  // ---------------------------------------------------------------- events
  on(f) { this.listeners.push(f); return () => { this.listeners = this.listeners.filter(x => x !== f); }; }
  emit(ev) {
    ev.day = this.day; ev.time = this.clock();
    if (ev.chron) this.chron(ev.chron, ev.type);
    this.questEvent(ev);
    for (const f of this.listeners) { try { f(ev); } catch (err) { console.error(err); } }
  }
  chron(text, type = 'world') {
    this.chronicle.push({ d: this.day, t: this.clock(), text, type });
    if (this.chronicle.length > 500) this.chronicle.splice(0, this.chronicle.length - 500);
  }
  remember(e, text) {
    if (!e || e.kind !== 'human') return;
    e.mem.push({ d: this.day, t: text });
    if (e.mem.length > 10) e.mem.shift();
  }
  say(e, text) { e.say = { text, until: performance.now() + 3200 }; }
  fxText(x, y, text, col) { this.fx.push({ x, y, text, col, t0: performance.now() }); if (this.fx.length > 80) this.fx.shift(); }

  // ---------------------------------------------------------------- people
  makeHuman({ sex, age, town, home, family, job, parents }) {
    const id = this.nextId++;
    const traits = { brave: R(), kind: R(), greed: R(), social: R(), ambition: R(), aggro: R() * 0.85, curious: R() };
    const hs = home && this.house(home);
    const e = {
      id, kind: 'human', name: personName(sex), family: family || pick(FAMILIES), sex, age, town, home: home || 0,
      x: hs ? hs.x + 0.5 : this.towns[town].x + 0.5, y: hs ? hs.y + 0.7 : this.towns[town].y + 0.5,
      traits, needs: { hunger: R() * 0.4, energy: 0.7 + R() * 0.3, social: R() * 0.5 }, rel: {}, mem: [], children: [], parents: parents || [],
      partner: 0, pregnant: null, gold: 10 + Math.floor(R() * 30), potions: 0, cores: 0, level: 1, xp: 0, job: '', cls: '', weapon: 0, armor: 0,
      kills: 0, outlaw: false, alive: true, intent: { do: 'idle' }, intentAt: 0, decideIn: R() * 2, cdLeft: 0, mp: 0, maxMp: 0, busy: 0,
      pref: R() < 0.88 ? 'opp' : R() < 0.6 ? 'same' : 'any', skin: Math.floor(R() * SKIN.length), born: this.day, grief: 0,
    };
    this.ents.set(id, e);
    this.setJob(e, job || (age < 16 ? 'child' : age >= 62 ? 'elder' : this.chooseJob(e)));
    e.hp = e.maxHp;
    return e;
  }

  chooseJob(e) {
    const t = e.traits;
    if (t.brave > 0.55 && R() < 0.7) return 'hunter';
    if (t.kind > 0.75 && R() < 0.4) return 'healer';
    if (t.greed > 0.6 && R() < 0.5) return 'merchant';
    return R() < 0.75 ? 'farmer' : 'merchant';
  }

  setJob(e, job) {
    e.job = job;
    if (job === 'hunter' && !e.hero) {
      const t = e.traits;
      e.cls = t.kind > 0.78 ? 'healer' : t.brave > 0.6 && t.aggro > 0.4 ? 'warrior' : t.curious > 0.6 ? 'mage' : R() < 0.5 ? 'archer' : 'warrior';
      if (e.level === 1 && e.age > 20) e.level = 2 + Math.floor(R() * R() * 15);
      e.potions = Math.max(e.potions, 2);
    }
    this.recalcNpc(e);
  }

  recalcNpc(e) {
    if (e.hero) return this.recalcHero(e);
    const ratio = e.maxHp ? e.hp / e.maxHp : 1, lv = e.level;
    if (e.job === 'hunter') {
      const c = e.cls;
      e.maxHp = Math.round((c === 'warrior' ? 64 + lv * 14 : c === 'archer' ? 52 + lv * 11 : 46 + lv * 10));
      e.atk = c === 'warrior' ? 6 + lv * 2.2 : c === 'archer' ? 5 + lv * 2 : c === 'mage' ? 6 + lv * 2.3 : 3 + lv * 1.1;
      e.def = c === 'warrior' ? 2 + lv * 1.4 : lv * 0.9;
      e.range = c === 'archer' ? 4.5 : c === 'mage' ? 5 : 1.25;
      e.cd = c === 'archer' ? 1.3 : c === 'mage' ? 1.6 : 1.1;
      e.spd = c === 'archer' ? 3.2 : 3.0;
      e.maxMp = c === 'mage' || c === 'healer' ? 30 + lv * 4 : 0;
    } else {
      const child = e.job === 'child', old = e.job === 'elder';
      e.maxHp = child ? 20 + Math.round(e.age * 2) : 40 + Math.min(20, Math.round(e.age));
      e.atk = child ? 1 : 3 + e.traits.aggro * 4;
      e.def = 0; e.range = 1.15; e.cd = 1.2;
      e.spd = child ? 2.5 : old ? 1.9 : 2.7;
      e.maxMp = e.job === 'healer' ? 40 : 0;
    }
    e.hp = Math.max(1, Math.min(e.maxHp, Math.round(e.maxHp * ratio)));
    e.mp = Math.min(e.mp || e.maxMp, e.maxMp);
  }

  recalcHero(e) {
    const a = e.attrs, p = this.passive || {}, ratio = e.maxHp ? e.hp / e.maxHp : 1;
    e.maxHp = Math.round((60 + a.vit * 12 + e.level * 5) * (1 + (p.hp || 0)));
    e.atk = (5 + a.str * 1.7 + e.weapon * 7) * (1 + (p.atk || 0));
    e.def = (a.vit * 0.35 + e.armor * 5) * (1 + (p.def || 0));
    e.spd = (3 + a.agi * 0.035) * (1 + (p.spd || 0));
    e.cd = Math.max(0.4, 1.1 - a.agi * 0.007);
    e.maxMp = 20 + a.int * 5;
    e.sense = (7 + a.per * 0.15) * (1 + (p.sense || 0));
    e.crit = Math.min(0.5, a.per * 0.004);
    e.range = 1.25;
    if (!e.ghost) e.hp = Math.max(1, Math.min(e.maxHp, Math.round(e.maxHp * ratio)));
    e.mp = Math.min(e.mp ?? e.maxMp, e.maxMp);
  }

  rank(e) { return clamp(1 + Math.floor((e.level || 1) / 10), 1, 5); }
  xpNeed(e) { return Math.round(e.hero ? 50 * Math.pow(e.level, 1.45) : 45 * Math.pow(e.level, 1.5)); }
  power(e) { return Math.sqrt(Math.max(1, e.maxHp) * Math.max(1, e.atk)) * (1 + (e.def || 0) / 25) * (0.4 + 0.6 * Math.max(0, e.hp) / e.maxHp); }

  link(a, b) {
    a.partner = b.id; b.partner = a.id;
    a.rel[b.id] = 80 + R() * 20; b.rel[a.id] = 80 + R() * 20;
  }

  populate() {
    for (const tn of this.towns) {
      const houses = this.houses.filter(h => h.town === tn.id);
      houses.forEach((house, i) => {
        if (tn.id === 0 && i === 0) return;                    // the hero's home
        const roll = R(), fam = pick(FAMILIES);
        if (roll < 0.58) {
          const dad = this.makeHuman({ sex: 'm', age: 22 + R() * 26, town: tn.id, home: house.id, family: fam });
          const mom = this.makeHuman({ sex: 'f', age: 20 + R() * 24, town: tn.id, home: house.id, family: fam });
          dad.pref = mom.pref = 'opp';
          this.link(dad, mom);
          const kids = Math.floor(R() * 4);
          for (let k = 0; k < kids && mom.age > 19; k++) {
            const kid = this.makeHuman({ sex: R() < 0.5 ? 'm' : 'f', age: R() * Math.min(17, mom.age - 18), town: tn.id, home: house.id, family: fam, parents: [dad.id, mom.id] });
            for (const p of [dad, mom]) { p.children.push(kid.id); p.rel[kid.id] = 85; kid.rel[p.id] = 80; }
          }
        } else if (roll < 0.8) {
          this.makeHuman({ sex: R() < 0.5 ? 'm' : 'f', age: 18 + R() * 16, town: tn.id, home: house.id, family: fam });
        } else if (roll < 0.94) {
          const a = this.makeHuman({ sex: 'm', age: 60 + R() * 14, town: tn.id, home: house.id, family: fam });
          if (R() < 0.6) { const b = this.makeHuman({ sex: 'f', age: 58 + R() * 14, town: tn.id, home: house.id, family: fam }); a.pref = b.pref = 'opp'; this.link(a, b); }
        }
      });
      const folk = this.humans().filter(e => e.town === tn.id);
      const adults = folk.filter(e => e.job !== 'child' && e.job !== 'elder');
      const needFarmers = Math.max(2, Math.ceil(folk.length / 4));
      for (const need of [...Array(needFarmers).fill('farmer'), 'hunter', 'hunter']) {
        if (adults.filter(e => e.job === need).length >= (need === 'farmer' ? needFarmers : 2)) continue;
        const c = adults.find(e => e.job !== 'hunter' && e.job !== 'farmer') || adults.find(e => e.job !== need);
        if (c) this.setJob(c, need);
      }
      for (const e of folk) {
        for (let k = 0; k < 5; k++) {
          const o = pick(folk);
          if (o !== e && e.rel[o.id] === undefined) { const v = R() * 45 - 12; e.rel[o.id] = v; o.rel[e.id] = v + (R() - 0.5) * 10; }
        }
      }
    }
    for (const e of this.ents.values()) e.hp = e.maxHp;
  }

  spawnHero({ name, sex }) {
    const tn = this.towns[0];
    let house = this.houses.find(h => h.town === 0 && !this.humans().some(e => e.home === h.id));
    if (!house) house = this.buildHouse(tn) || this.houses.find(h => h.town === 0);
    const e = this.makeHuman({ sex: sex === 'f' ? 'f' : 'm', age: 19, town: 0, home: house.id, family: '', job: 'hunter' });
    Object.assign(e, {
      name: name || personName(sex === 'f' ? 'f' : 'm'), family: '', hero: true, cls: 'awakened', level: 1, gold: 30, potions: 2,
      attrs: { str: 5, agi: 5, vit: 5, int: 5, per: 5 }, statPoints: 0, xpMul: 1.5, deaths: 0, pref: 'opp',
      traits: { brave: 0.5, kind: 0.6, greed: 0.4, social: 0.5, ambition: 0.7, aggro: 0.3, curious: 0.7 },
    });
    this.heroId = e.id;
    this.recalcHero(e);
    e.hp = e.maxHp; e.mp = e.maxMp;
    const folk = this.humans().filter(o => o.town === 0 && !o.hero);
    for (let k = 0; k < 6 && folk.length; k++) { const o = pick(folk); o.rel[e.id] = 5 + R() * 25; e.rel[o.id] = o.rel[e.id]; }
    this.chron(`A young hunter named ${e.name} lived in ${tn.name}. One morning, ${e.sex === 'f' ? 'she' : 'he'} began to hear a voice that nobody else could hear.`, 'hero');
    return e;
  }

  buildHouse(tn) {
    for (let k = 0; k < 120; k++) {
      const a = R() * Math.PI * 2, r = 4 + R() * 6;
      const hx = Math.round(tn.x + Math.cos(a) * r), hy = Math.round(tn.y + Math.sin(a) * r);
      const t = this.tileAt(hx, hy);
      if (t !== T.GRASS && t !== T.SAND) continue;
      if (Math.abs(hx - tn.x) <= 1 && hy < tn.y) continue;
      if (this.houses.some(h => Math.hypot(h.x - hx, h.y - hy) < 2)) continue;
      if ([tn.guild, tn.market, tn.tavern].some(b => Math.hypot(b.x - 0.5 - hx, b.y - 0.5 - hy) < 2)) continue;
      if (!this.reach[hy * MAP + hx]) continue;
      const h = { id: Math.max(0, ...this.houses.map(x => x.id)) + 1, x: hx, y: hy, town: tn.id };
      this.houses.push(h);
      this.terrainDirty = true;
      this.chron(`A new house was built in ${tn.name}.`, 'town');
      return h;
    }
    return null;
  }

  townPop(id) { let n = 0; for (const e of this.ents.values()) if (e.kind === 'human' && e.alive && e.town === id && !e.outlaw) n++; return n; }
  humans() { const out = []; for (const e of this.ents.values()) if (e.kind === 'human' && e.alive) out.push(e); return out; }
  monsters() { const out = []; for (const e of this.ents.values()) if (e.kind === 'monster' && e.alive) out.push(e); return out; }
  homeless(e) { return !this.house(e.home); }
  occupants(hid) { return this.humans().filter(e => e.home === hid); }

  // ---------------------------------------------------------------- monsters & rifts
  spawnMonster(type, level, x, y, opts = {}) {
    const m = MON[type], boss = !!opts.boss, id = this.nextId++;
    const e = {
      id, kind: 'monster', type, level, x, y, home: { x, y }, rift: opts.rift || 0, boss, march: opts.march ?? null, night: !!opts.night,
      name: boss ? `${pick(['Alpha', 'Elder', 'Dread', 'Ancient'])} ${m.name}` : m.name,
      maxHp: Math.round((18 + level * 11) * (boss ? 3.2 : 1) * m.hp), atk: (4 + level * 2.1) * (boss ? 1.5 : 1) * m.atk,
      def: level * 1.1 * m.def * (boss ? 1.3 : 1), spd: m.spd, range: boss ? 1.5 : 1.15, cd: 1.2, cdLeft: 0,
      xp: Math.round((8 + level * 6) * (boss ? 5 : 1)), loot: Math.round((2 + level * 2.5) * (boss ? 6 : 1)),
      alive: true, intent: { do: 'wander' }, intentAt: this.min, decideIn: R(), target: 0, busy: 0,
    };
    e.hp = e.maxHp;
    this.ents.set(id, e);
    return e;
  }

  openRift(rank) {
    if (!rank) {
      const hunters = this.humans().filter(e => e.job === 'hunter').sort((a, b) => b.level - a.level).slice(0, 3);
      const avg = hunters.length ? hunters.reduce((s, e) => s + e.level, 0) / hunters.length : 1;
      const max = clamp(1 + Math.floor(avg / 10), 1, 5);
      rank = clamp(1 + Math.floor(R() * max) + (R() < 0.08 ? 1 : 0), 1, 5);
    }
    let spot = null;
    for (let k = 0; k < 40 && !spot; k++) {
      const s = this.wildSpot(k < 25 ? 20 : 15);
      if (s && !this.rifts.some(r => Math.hypot(r.x - s.x, r.y - s.y) < 9)) spot = s;
    }
    if (!spot) return null;
    const r = { id: this.nextId++, x: spot.x, y: spot.y, rank, kills: 0, need: 5 + rank * 3, bossSpawned: false, opened: this.day, breakDay: this.day + 8 + rank * 2, spawnT: 0 };
    this.rifts.push(r);
    const tn = this.nearestTown(r);
    this.emit({ type: 'riftOpen', rift: r.id, rank, chron: `A rank ${roman(rank)} rift tore open ${this.direction(tn, r)} of ${tn.name}.` });
    return r;
  }
  nearestTown(p) { return this.towns.reduce((b, t) => (Math.hypot(t.x - p.x, t.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? t : b)); }
  direction(from, to) {
    const a = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
    return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][Math.round(((a + 360) % 360) / 45) % 8];
  }
  updateRift(r, dt) {
    r.spawnT -= dt;
    if (r.spawnT > 0) return;
    r.spawnT = 9 + R() * 10;
    let alive = 0;
    for (const e of this.ents.values()) if (e.kind === 'monster' && e.alive && e.rift === r.id) alive++;
    const [lo, hi] = RIFT_LEVELS[r.rank];
    if (r.kills >= r.need && !r.bossSpawned) {
      r.bossSpawned = true;
      const b = this.spawnMonster(pick(RIFT_TYPES[r.rank]), hi, r.x, r.y, { rift: r.id, boss: true });
      this.emit({ type: 'boss', rift: r.id, chron: `The ${b.name} emerged from a rank ${roman(r.rank)} rift.` });
    } else if (alive < 3 + r.rank * 1.5 && this.monsters().length < 50) {
      const s = this.randomSpot(r.x, r.y, 3);
      this.spawnMonster(pick(RIFT_TYPES[r.rank]), lo + Math.floor(R() * (hi - lo + 1)), s.x, s.y, { rift: r.id });
    }
  }
  closeRift(r, killer) {
    this.rifts = this.rifts.filter(x => x !== r);
    for (const e of this.ents.values()) if (e.rift === r.id) e.rift = 0;
    this.stats.riftsClosed++;
    const loot = r.rank * 30;
    if (killer.kind === 'human') { killer.gold += loot; this.remember(killer, `I closed a rank ${roman(r.rank)} rift.`); }
    this.emit({
      type: 'riftClosed', rift: r.id, rank: r.rank, by: killer.id, hero: !!killer.hero,
      heroText: killer.hero ? `I closed a rank ${roman(r.rank)} rift and found ${loot} gold inside.` : null,
      chron: `${this.fullName(killer)} closed a rank ${roman(r.rank)} rift.`,
    });
  }
  breakRift(r) {
    this.rifts = this.rifts.filter(x => x !== r);
    const tn = this.nearestTown(r), [lo, hi] = RIFT_LEVELS[r.rank];
    const n = 3 + r.rank * 2;
    for (let k = 0; k < n; k++) {
      const s = this.randomSpot(r.x, r.y, 3);
      const m = this.spawnMonster(pick(RIFT_TYPES[r.rank]), lo + Math.floor(R() * (hi - lo + 1)), s.x, s.y, { march: tn.id });
      m.expire = this.min + 1.2 * DAY;
    }
    this.stats.breaks++;
    this.emit({ type: 'riftBreak', town: tn.id, rank: r.rank, chron: `A rank ${roman(r.rank)} rift broke! ${n} monsters are marching on ${tn.name}.` });
  }

  // ---------------------------------------------------------------- the clock
  tick(dt) {
    let left = dt;
    while (left > 1e-6) { const s = Math.min(0.25, left); this.step(s); left -= s; }
  }
  step(dt) {
    this.min += dt * MIN_PER_SEC;
    this.pathBudget = 8;
    if (this.day !== this.lastDay) { this.lastDay = this.day; this.newDay(); }
    const hr = Math.floor(this.hour);
    if (hr !== this.lastHour) { this.lastHour = hr; this.newHour(hr); }
    if (this.mind && (this.passiveT -= dt) <= 0) { this.passiveT = 2; this.refreshPassives(); }
    for (const e of this.ents.values()) if (e.alive) this.update(e, dt);
    for (const r of this.rifts.slice()) this.updateRift(r, dt);
    for (const [id, e] of this.ents) if (!e.alive && !e.hero) this.ents.delete(id);
  }

  newHour(h) {
    if (h === 22) this.conceive();
    if (h === 20) {
      const wolves = this.monsters().filter(m => m.night).length;
      for (let k = wolves; k < 6; k++) {
        const s = this.wildSpot(15);
        if (s && this.tileAt(s.x, s.y) === T.FOREST) this.spawnMonster('wolf', 2 + Math.floor(R() * 5), s.x, s.y, { night: true });
      }
    }
    if (h === 6) for (const m of this.monsters()) if (m.night && this.min - (m.lastHitMin ?? -999) > 60) m.alive = false;
    if (h % 3 === 0) this.checkQuests();
  }

  newDay() {
    const day = this.day;
    for (const e of this.humans()) {
      if (e.hero) continue;
      if (e.age > 55 && R() < Math.min(0.5, 0.0008 * Math.exp((e.age - 55) / 6))) { this.die(e, 'age'); continue; }
      if (e.job === 'child' && e.age >= 16) {
        this.setJob(e, this.chooseJob(e));
        this.remember(e, `I came of age and became a ${e.job}.`);
        if (e.job === 'hunter') this.chron(`${this.fullName(e)} came of age and became a hunter.`, 'life');
      } else if (e.age >= 62 && e.job !== 'elder') {
        this.setJob(e, 'elder');
      }
      if (e.grief > 0) e.grief--;
      if (e.outlaw && day - (e.crimeDay || 0) > 6 && R() < 0.3) this.pardon(e);
    }
    for (const r of this.rifts.slice()) if (day >= r.breakDay) this.breakRift(r);
    if (this.rifts.length < 5 && R() < 0.6) this.openRift();
    if (this.humans().length < 30) this.migrants();
    this.graves = this.graves.filter(g => day - g.d < 8);
    for (const tn of this.towns) {
      const folk = this.humans().filter(e => e.town === tn.id && !e.outlaw), pop = folk.length;
      tn.food = Math.min(tn.food, 60 + pop * 6);
      const workers = folk.filter(e => !e.hero && e.job !== 'child' && e.job !== 'elder');
      const farmers = workers.filter(e => e.job === 'farmer').length, hunters = workers.filter(e => e.job === 'hunter').length;
      if (tn.food < pop * 2 && farmers < Math.ceil(pop / 4)) {
        const c = workers.find(e => e.job === 'merchant' || e.job === 'healer') || (hunters > 2 && workers.find(e => e.job === 'hunter'));
        if (c) { this.setJob(c, 'farmer'); this.remember(c, 'Food was short, so I started farming.'); }
      }
      if (hunters < 2) {
        const c = workers.filter(e => e.job !== 'hunter' && e.age < 45).sort((a, b) => b.traits.brave - a.traits.brave)[0];
        if (c && (farmers > 2 || c.job !== 'farmer')) { this.setJob(c, 'hunter'); c.potions = 2; this.remember(c, 'The town needed hunters, so I took up arms.'); this.chron(`${this.fullName(c)} took up arms to protect ${tn.name}.`, 'life'); }
      }
    }
    this.emit({ type: 'newDay' });
  }

  conceive() {
    for (const mom of this.humans()) {
      if (mom.sex !== 'f' || mom.pregnant || mom.age < 18 || mom.age > 42 || !mom.partner) continue;
      const dad = this.ents.get(mom.partner);
      if (!dad || !dad.alive || dad.sex !== 'm' || dad.ghost) continue;
      const tn = this.towns[mom.town];
      const pop = this.humans().filter(e => e.town === mom.town).length;
      const maxKids = 2 + Math.floor((mom.traits.kind + dad.traits.kind) * 1.5);
      if (mom.children.length >= maxKids || tn.food < pop * 0.8 || pop > 60) continue;
      if (dist(mom, dad) > 4) continue;
      if (R() < 0.45) {
        mom.pregnant = { due: this.min + 1.5 * DAY, father: dad.id };
        this.remember(mom, 'I am expecting a child.'); this.remember(dad, 'We are expecting a child.');
        if (mom.hero || dad.hero) this.emit({ type: 'expecting', heroText: mom.hero ? 'I am expecting a child.' : `${mom.name} is expecting our child.` });
      }
    }
  }

  giveBirth(mom) {
    const fatherId = mom.pregnant.father, dad = this.ents.get(fatherId);
    mom.pregnant = null;
    const fam = dad?.family || mom.family || pick(FAMILIES);
    const home = mom.home || dad?.home || 0;
    const baby = this.makeHuman({ sex: R() < 0.5 ? 'm' : 'f', age: 0, town: mom.town, home, family: fam, job: 'child', parents: [fatherId, mom.id] });
    const pt = [dad, mom].filter(Boolean);
    for (const k of Object.keys(baby.traits)) {
      const avg = pt.reduce((s, p) => s + p.traits[k], 0) / pt.length;
      baby.traits[k] = clamp(avg + (R() - 0.5) * 0.35, 0, 1);
    }
    baby.x = mom.x; baby.y = mom.y;
    for (const p of pt) { p.children.push(baby.id); p.rel[baby.id] = 90; baby.rel[p.id] = 85; this.remember(p, `My child ${baby.name} was born.`); }
    this.stats.born++;
    const hero = pt.find(p => p.hero);
    this.emit({
      type: 'birth', id: baby.id, parents: [fatherId, mom.id],
      heroText: hero ? `My child was born: ${baby.sex === 'm' ? 'a son' : 'a daughter'} named ${baby.name}.` : null,
      chron: `${baby.name} ${baby.family} was born to ${mom.name} and ${this.nameOf(fatherId)} in ${this.towns[mom.town].name}.`,
    });
  }

  migrants() {
    const tn = pick(this.towns), fam = pick(FAMILIES);
    let h = this.houses.find(x => x.town === tn.id && !this.occupants(x.id).length) || this.buildHouse(tn);
    const a = this.makeHuman({ sex: 'm', age: 20 + R() * 15, town: tn.id, home: h?.id || 0, family: fam });
    const b = this.makeHuman({ sex: 'f', age: 19 + R() * 15, town: tn.id, home: h?.id || 0, family: fam });
    a.pref = b.pref = 'opp';
    this.link(a, b);
    this.chron(`The ${fam} family arrived in ${tn.name}, fleeing the wilds.`, 'life');
  }

  pardon(e) {
    e.outlaw = false; e.camp = null;
    const h = this.houses.find(x => x.town === e.town && this.occupants(x.id).length < 2) || this.buildHouse(this.towns[e.town]);
    e.home = h?.id || 0;
    this.remember(e, 'I returned to town to start over.');
    this.chron(`${this.fullName(e)}, once an outlaw, returned to ${this.towns[e.town].name}.`, 'crime');
  }

  // ---------------------------------------------------------------- one creature, one moment
  update(e, dt) {
    if (e.cdLeft > 0) e.cdLeft -= dt;
    if (e.ghost) { e.ghost -= dt; if (e.ghost <= 0) this.revive(e); return; }
    if (e.expire && this.min > e.expire && this.min - (e.lastHitMin ?? -999) > 60) { e.alive = false; return; }
    if (e.kind === 'human') this.updateNeeds(e, dt);
    if (!e.alive) return;
    if (e.maxMp) e.mp = Math.min(e.maxMp, e.mp + dt * (0.5 + (e.attrs ? e.attrs.int * 0.04 : 0.3)));
    if (this.min - (e.lastHitMin ?? -999) > 60 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * dt * (e.resting ? 0.03 : 0.004));
    e.decideIn -= dt;
    if (e.decideIn <= 0) { e.decideIn = 0.8 + R() * 0.7; this.decide(e); }
    this.execute(e, dt);
  }

  updateNeeds(e, dt) {
    const n = e.needs;
    n.hunger = Math.min(1, n.hunger + dt * 0.009);
    n.energy = e.sleeping ? Math.min(1, n.energy + dt * 0.03) : Math.max(0, n.energy - dt * 0.008);
    n.social = Math.min(1, n.social + dt * (0.002 + e.traits.social * 0.006));
    e.age += dt * MIN_PER_SEC / DAY / DAYS_PER_YEAR;
    if (n.hunger >= 1 && !e.outlaw) {
      e.hp -= dt * 0.08;
      if (e.hp <= 0) { this.die(e, 'starvation'); return; }
    }
    if (e.pregnant && this.min >= e.pregnant.due) this.giveBirth(e);
  }

  decide(e) {
    if (e.kind === 'monster') return this.monsterDecide(e);
    let it = null;
    if (e.hero && this.mind && this.mind.decide) {
      try { it = this.validIntent(this.mind.decide(this.heroApi)); } catch (err) { this.mindError(err); }
    }
    if (!it) it = this.npcDecide(e);
    this.setIntent(e, it);
  }

  setIntent(e, it) {
    const o = e.intent;
    if (o && o.do === it.do && o.target === it.target && o.rift === it.rift && o.town === it.town && o.x === it.x && !e.intentDone) {
      Object.assign(o, it);
      return;
    }
    e.intent = it; e.intentAt = this.min; e.intentDone = false;
    e.path = null; e.sleeping = false; e.resting = false; e.sheltered = false;
  }

  validIntent(it) {
    if (!it || typeof it !== 'object' || !INTENTS.has(it.do)) return null;
    const out = { do: it.do };
    for (const k of ['target', 'rift', 'town', 'from']) if (it[k] !== undefined) out[k] = Number(it[k]) || 0;
    if (it.x !== undefined) { out.x = clamp(Number(it.x) || 0, 2, MAP - 2); out.y = clamp(Number(it.y) || 0, 2, MAP - 2); }
    if (it.potions !== undefined) out.potions = clamp(Number(it.potions) || 0, 0, 20);
    if (it.gear) out.gear = true;
    if (it.here) out.here = true;
    out.lethal = it.lethal !== false;
    if ((out.do === 'fight' || out.do === 'talk' || out.do === 'court' || out.do === 'follow') && !this.ents.get(out.target)?.alive) return null;
    if (out.do === 'go' && out.x === undefined) return null;
    return out;
  }

  nearestThreat(e, r) {
    let best = null, bd = r;
    for (const o of this.ents.values()) {
      if (!o.alive || o.ghost || o === e) continue;
      let hostile = false;
      if (o.kind === 'monster') hostile = true;
      else if (o.intent?.do === 'fight' && o.intent.target === e.id) hostile = true;
      else if (o.outlaw && !e.outlaw) hostile = true;
      if (!hostile) continue;
      const d = dist(e, o);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  npcDecide(e) {
    const tr = e.traits, n = e.needs, hpR = e.hp / e.maxHp, night = this.isNight, h = this.hour;
    const tn = this.towns[e.town] || this.towns[0];
    if (e.job === 'child' && e.age < 6) {
      const mom = this.ents.get(e.parents[1]) || this.ents.get(e.parents[0]);
      const threat = this.nearestThreat(e, 5);
      if (threat) return { do: 'flee', from: threat.id };
      if (mom && mom.alive && !mom.ghost && !night && this.townAt(mom, 8)) return { do: 'follow', target: mom.id };
      if (!night) return { do: 'wander' };
      return { do: 'rest' };
    }
    const threat = this.nearestThreat(e, e.job === 'hunter' ? 7 : 5);
    if (threat && e.sheltered && e.intent.do === 'rest' && e.job !== 'hunter') return e.intent;   // stay behind the door
    if (threat) {
      const fighter = (e.job === 'hunter' || e.outlaw || (tr.brave > 0.75 && e.job !== 'child' && e.job !== 'elder'));
      const say = !e.say || performance.now() > e.say.until;
      let pack = 0;
      for (const o of this.ents.values()) if (o.alive && o.kind === 'monster' && dist(o, threat) < 4) pack += this.power(o);
      if (threat.kind !== 'monster') pack = this.power(threat);
      let friends = 0;
      for (const o of this.ents.values()) if (o.alive && o.kind === 'human' && o !== e && o.job === 'hunter' && !o.outlaw && dist(o, e) < 6) friends += this.power(o) * 0.6;
      if (fighter && hpR > 0.45 && (this.power(e) + friends) * (0.6 + tr.brave) > pack * 0.9) {
        if (say && R() < 0.3) this.say(e, pick(LINES.hunt));
        return { do: 'fight', target: threat.id, lethal: threat.kind === 'monster' || threat.outlaw || tr.aggro > 0.8 };
      }
      if (say && R() < 0.4) this.say(e, pick(LINES.scared));
      return { do: 'flee', from: threat.id };
    }
    if (e.potions > 0 && hpR < 0.4) { e.potions--; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.45); }
    if (hpR < 0.45) return { do: 'rest' };
    if (e.outlaw) return this.outlawDecide(e);
    if (n.hunger > 0.65) return { do: 'eat' };
    // revenge
    if (e.nemesis) {
      const foe = this.ents.get(e.nemesis);
      if (!foe || !foe.alive) e.nemesis = 0;
      else if (tr.brave > 0.5 && hpR > 0.7 && dist(e, foe) < 30 && this.power(e) > this.power(foe) * 0.7 && R() < 0.3) return { do: 'fight', target: foe.id, lethal: true };
    }
    // justice: hunters chase outlaws
    if (e.job === 'hunter' && tr.brave > 0.55 && hpR > 0.6) {
      const o = this.humans().find(x => x.outlaw && dist(x, e) < 14 && this.power(e) > this.power(x));
      if (o) return { do: 'fight', target: o.id, lethal: true };
    }
    // a town under attack
    const raid = this.monsters().find(m => Math.hypot(m.x - tn.x, m.y - tn.y) < (m.march != null ? 18 : 11));
    if (raid) return e.job === 'hunter' || tr.brave > 0.8 ? { do: 'guard', town: tn.id } : { do: 'rest' };
    // keep doing what I was doing
    const it = e.intent;
    if (it && it.do === 'fight' && !e.intentDone && this.ents.get(it.target)?.kind === 'human' && this.ents.get(it.target).alive && this.min - e.intentAt < 300) return it;
    if (it && !e.intentDone && STICK[it.do] && this.min - e.intentAt < STICK[it.do] && !(night && it.do === 'work')) return it;
    if (night || n.energy < 0.15) {
      if (e.job === 'hunter' && tr.brave > 0.8 && n.energy > 0.5 && hpR > 0.8 && R() < 0.5) return this.huntIntent(e);
      if (tr.greed > 0.75 && tr.kind < 0.3 && e.gold < 15 && h > 22 && R() < 0.04) {
        const victimHome = pick(this.houses.filter(x => x.town === e.town && x.id !== e.home));
        if (victimHome) return { do: 'steal', target: victimHome.id };
      }
      return { do: 'rest' };
    }
    // social life
    if (n.social > 0.6 && R() < 0.55) {
      const s = this.socialIntent(e);
      if (s) return s;
    }
    if (e.job === 'child') return R() < 0.4 && this.socialIntent(e) || { do: 'wander' };
    if (e.job === 'elder') return { do: 'wander' };
    if (h >= 18) return R() < 0.5 && this.socialIntent(e) || { do: 'wander' };
    switch (e.job) {
      case 'hunter':
        if (e.cores > 0 || (e.potions < 2 && e.gold >= 15)) return { do: 'shop', potions: 2 };
        if (hpR < 0.75) return { do: 'rest' };
        return this.huntIntent(e);
      case 'farmer': case 'merchant': case 'healer': return { do: 'work' };
    }
    return { do: 'wander' };
  }

  huntIntent(e) {
    const my = this.rank(e) + (e.traits.brave > 0.7 ? 1 : 0);
    const ok = this.rifts.filter(r => r.rank <= my).sort((a, b) => (dist(a, e) + Math.max(0, r_days(this, a)) * 6) - (dist(b, e) + Math.max(0, r_days(this, b)) * 6));
    if (ok.length) return { do: 'hunt', rift: (R() < 0.75 ? ok[0] : pick(ok)).id };
    return { do: 'hunt', rift: 0 };
  }

  socialIntent(e) {
    const adult = e.job !== 'child';
    const pool = this.humans().filter(o => o !== e && !o.ghost && !o.outlaw && !o.sleeping && o.town === e.town && (o.job === 'child') === !adult && dist(o, e) < 25);
    if (!pool.length) return null;
    // romance
    if (adult && !e.partner && e.age >= 18 && e.age < 55 && R() < 0.35) {
      const loves = pool.filter(o => !o.partner && o.age >= 18 && o.age < 60 && this.attracted(e, o) && (e.rel[o.id] || 0) > 25);
      if (loves.length) return { do: 'court', target: loves.sort((a, b) => (e.rel[b.id] || 0) - (e.rel[a.id] || 0))[0].id };
    }
    let total = 0;
    const w = pool.map(o => { const v = Math.max(2, (e.rel[o.id] || 0) + 30 + (o.id === e.partner ? 80 : 0)); total += v; return v; });
    let r = R() * total;
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return { do: 'talk', target: pool[i].id }; }
    return { do: 'talk', target: pool[0].id };
  }

  attracted(a, b) {
    const ok = (x, y) => x.pref === 'any' || (x.pref === 'opp' ? x.sex !== y.sex : x.sex === y.sex);
    return ok(a, b) && ok(b, a);
  }

  outlawDecide(e) {
    if (!e.camp) e.camp = this.wildSpot(16) || { x: e.x, y: e.y };
    if (this.isNight || e.needs.energy < 0.2) { e.needs.hunger = 0; return { do: 'go', x: e.camp.x, y: e.camp.y }; }
    const prey = this.humans().find(o => !o.outlaw && !o.ghost && dist(o, e) < 9 && !this.townAt(o) && this.power(o) < this.power(e) * 0.9);
    if (prey && R() < 0.5) return { do: 'fight', target: prey.id, lethal: e.traits.aggro > 0.8, rob: true };
    return { do: 'wander' };
  }

  monsterDecide(e) {
    const tgt = e.target && this.ents.get(e.target);
    const tired = tgt && this.min - Math.max(e.lastHitMin ?? -999, e.chaseFrom ?? -999) > 140;
    const leashed = tired || (e.march == null && Math.hypot(e.x - e.home.x, e.y - e.home.y) > 14);
    if (tgt && tgt.alive && !tgt.ghost && !tgt.sheltered && !leashed && dist(e, tgt) < (e.march != null ? 20 : 13)) { this.setIntent(e, { do: 'fight', target: tgt.id, lethal: true }); return; }
    e.target = 0;
    const aggro = MON[e.type].aggro * (this.isNight ? 1.3 : 1) * (e.march != null ? 1.6 : 1) * (e.boss ? 1.3 : 1);
    let best = null, bd = aggro;
    for (const o of this.ents.values()) {
      if (o.kind !== 'human' || !o.alive || o.ghost || o.sheltered) continue;
      if (e.march == null && o.lastHitBy !== e.id && this.townAt(o, 8)) continue;   // towns are safe from roaming monsters
      const d = dist(e, o);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) { e.target = best.id; e.chaseFrom = this.min; this.setIntent(e, { do: 'fight', target: best.id, lethal: true }); return; }
    if (e.march != null) { const tn = this.towns[e.march]; this.setIntent(e, { do: 'go', x: tn.x + 0.5, y: tn.y + 0.5 }); return; }
    if (Math.hypot(e.x - e.home.x, e.y - e.home.y) > 12) { this.setIntent(e, { do: 'go', x: e.home.x, y: e.home.y }); return; }
    if (e.intent.do !== 'wander' || e.intentDone) this.setIntent(e, { do: 'wander' });
  }

  // ---------------------------------------------------------------- doing things
  execute(e, dt) {
    const it = e.intent || (e.intent = { do: 'idle' });
    if (e.busy > 0) { e.busy -= dt; return; }
    const done = () => { e.intentDone = true; e.decideIn = 0; };
    switch (it.do) {
      case 'fight': {
        const t = this.ents.get(it.target);
        if (!t || !t.alive || t.ghost) { e.target = 0; return done(); }
        if (!it.lethal && t.kind === 'human' && t.hp / t.maxHp < 0.3) return this.endBrawl(e, t, it.rob);
        this.engage(e, t, dt);
        return;
      }
      case 'hunt': {
        const sense = e.sense || 8;
        let t = it.target && this.ents.get(it.target);
        if (!t || !t.alive || dist(e, t) > sense * 1.6) {
          const near = [];
          for (const o of this.ents.values()) if (o.kind === 'monster' && o.alive && dist(o, e) < sense) near.push(o);
          t = null;
          if (near.length) {
            if (e.hero && this.mind && this.mind.chooseTarget) {
              try { const id = this.mind.chooseTarget(near.map(m => this.summary(m))); t = near.find(m => m.id === id) || null; } catch (err) { this.mindError(err); }
            }
            if (!t) t = near.reduce((b, m) => (dist(m, e) < dist(b, e) ? m : b));
          }
          it.target = t ? t.id : 0;
        }
        if (t) return this.engage(e, t, dt);
        const r = it.rift && this.rifts.find(x => x.id === it.rift);
        if (it.rift && !r) return done();
        if (!it.ax) { const tn = this.towns[e.town] || this.towns[0]; const c = r || this.wildNear(tn.x, tn.y) || this.homeSpot(e); it.ax = c.x; it.ay = c.y; }
        if (!it.wx || this.moveTo(e, it.wx, it.wy, dt, 0.4)) { const s = this.randomSpot(it.ax, it.ay, 3.5); it.wx = s.x; it.wy = s.y; }
        return;
      }
      case 'guard': {
        const tn = this.towns[it.town] || this.towns[e.town] || this.towns[0];
        let best = null, bd = 16;
        for (const o of this.ents.values()) {
          if (o.kind !== 'monster' || !o.alive) continue;
          const d = Math.hypot(o.x - tn.x, o.y - tn.y);
          if (d < bd) { bd = d; best = o; }
        }
        if (best) return this.engage(e, best, dt);
        if (!it.wx || this.moveTo(e, it.wx, it.wy, dt, 0.4)) { const s = this.randomSpot(tn.x + 0.5, tn.y + 0.5, 6); it.wx = s.x; it.wy = s.y; }
        if (this.min - e.intentAt > 240) done();
        return;
      }
      case 'flee': {
        const th = this.ents.get(it.from);
        if (!th || !th.alive || dist(th, e) > 11) return done();
        if (dist(th, e) < 0.9 && e.cdLeft <= 0) { e.cdLeft = e.cd; this.attack(e, th); }
        const home = this.homeSpot(e);
        if (!e.outlaw && dist(e, home) < 0.7) { this.setIntent(e, { do: 'rest' }); return; }   // bar the door
        if (dist(e, home) > 0.6 && dist(th, home) > dist(e, home) * 0.6) { this.moveTo(e, home.x, home.y, dt, 0.5); return; }
        const dx = e.x - th.x, dy = e.y - th.y, d = Math.hypot(dx, dy) || 1;
        const s = this.randomSpot(e.x + dx / d * 4, e.y + dy / d * 4, 1.5, 6);
        this.moveTo(e, s.x, s.y, dt, 0.3);
        return;
      }
      case 'rest': {
        const home = this.homeSpot(e);
        if (!it.here && !this.moveTo(e, home.x, home.y, dt, 0.4)) return;
        e.resting = true; e.sheltered = !it.here;
        e.sleeping = this.isNight || e.needs.energy < 0.3;
        if (!this.isNight && e.hp >= e.maxHp * 0.95 && e.needs.energy > 0.85) done();
        else if (this.isNight && e.needs.energy > 0.98 && this.hour > 5 && this.hour < 6) done();
        return;
      }
      case 'eat': {
        const tn = this.towns[e.town] || this.towns[0];
        const spot = e.home ? this.homeSpot(e) : { x: tn.tavern.x, y: tn.tavern.y + 0.3 };
        if (!this.moveTo(e, spot.x, spot.y, dt, 0.5)) return;
        if (tn.food >= 1) { tn.food -= 1; e.needs.hunger = 0; }
        else if (e.gold >= 3) { e.gold -= 3; e.needs.hunger = 0; }
        else { this.remember(e, 'There was no food, so I foraged for berries.'); e.needs.hunger = 0.3; e.busy = 4; }
        return done();
      }
      case 'shop': {
        const tn = this.townAt(e, 40) || this.towns[e.town] || this.towns[0];
        if (!this.moveTo(e, tn.market.x, tn.market.y + 0.5, dt, 0.6)) return;
        this.trade(e, it);
        return done();
      }
      case 'work': {
        const tn = this.towns[e.town] || this.towns[0];
        if (!it.wx) {
          const spot = e.job === 'farmer' ? pick(tn.fields) : e.job === 'merchant' ? tn.market : tn.guild;
          const s = this.randomSpot(spot.x, spot.y + (e.job === 'farmer' ? 0 : 0.6), e.job === 'farmer' ? 1.3 : 0.8, 8);
          it.wx = s.x; it.wy = s.y;
        }
        if (!this.moveTo(e, it.wx, it.wy, dt, 0.3)) return;
        if (e.job === 'farmer') tn.food += 0.2 * dt;
        else if (e.job === 'merchant') { e.gold += 0.04 * dt; const pop = this.townPop(tn.id); if (tn.food < pop * 1.5) tn.food += 0.08 * dt; }
        else if (e.job === 'healer') {
          for (const o of this.ents.values()) if (o.kind === 'human' && o.alive && o.hp < o.maxHp && dist(o, e) < 4) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.03 * dt);
        }
        if (R() < dt * 0.05) it.wx = 0;
        if (this.hour >= 18) done();
        return;
      }
      case 'talk': case 'court': {
        const t = this.ents.get(it.target);
        if (!t || !t.alive || t.ghost || this.min - e.intentAt > 400) return done();
        if (dist(e, t) > 1.4) { this.moveTo(e, t.x, t.y, dt, 1.2); return; }
        this.chat(e, t, it.do === 'court');
        e.busy = 2.2; if (!t.hero) { t.busy = 2.2; t.decideIn = 2.3; }
        return done();
      }
      case 'follow': {
        const t = this.ents.get(it.target);
        if (!t || !t.alive) return done();
        if (dist(e, t) > 1.6) this.moveTo(e, t.x, t.y, dt, 1.2);
        return;
      }
      case 'go': {
        if (this.moveTo(e, it.x, it.y, dt, 0.5)) return done();
        if (this.min - e.intentAt > 900) done();
        return;
      }
      case 'explore': {
        if (!it.wx) { const s = this.wildSpot(8) || this.homeSpot(e); it.wx = s.x; it.wy = s.y; }
        if (this.moveTo(e, it.wx, it.wy, dt, 0.5)) done();
        return;
      }
      case 'wander': {
        if (it.wait > 0) { it.wait -= dt; return; }
        if (!it.wx) {
          const a = e.kind === 'monster' ? e.home : e.outlaw && e.camp ? e.camp : e.job === 'child' || e.job === 'elder' ? (this.towns[e.town] || this.towns[0]) : this.homeSpot(e);
          const s = this.randomSpot(a.x + 0.5, a.y + 0.5, e.kind === 'monster' ? 3.5 : 5, 8);
          it.wx = s.x; it.wy = s.y;
        }
        if (this.moveTo(e, it.wx, it.wy, dt, 0.3)) { it.wx = 0; it.wait = 1 + R() * 4; if (e.kind === 'human' && R() < 0.3) done(); }
        return;
      }
      case 'steal': {
        const h = this.house(it.target);
        if (!h) return done();
        if (!this.moveTo(e, h.x + 0.5, h.y + 0.7, dt, 0.5)) return;
        this.steal(e, h);
        return done();
      }
    }
  }

  moveTo(e, tx, ty, dt, stop = 0.2) {
    const d = Math.hypot(tx - e.x, ty - e.y);
    if (d <= stop) return true;
    if (!e.path || Math.hypot((e.pathTx ?? -99) - tx, (e.pathTy ?? -99) - ty) > 1.5 || (e.stuck || 0) > 1.5) this.plan(e, tx, ty);
    if (!e.path) return false;
    const wp = e.path[e.pathI] || [tx, ty];
    const sp = e.spd * (SPEED[this.tileAt(e.x, e.y)] || 0.8) * dt * (e.intent && e.intent.do === 'flee' ? 1.35 : 1);
    const wd = Math.hypot(wp[0] - e.x, wp[1] - e.y);
    if (wd <= sp) { e.x = wp[0]; e.y = wp[1]; e.pathI++; e.stuck = 0; }
    else {
      const nx = e.x + (wp[0] - e.x) / wd * sp, ny = e.y + (wp[1] - e.y) / wd * sp;
      if (this.walkable(nx, ny)) { e.x = nx; e.y = ny; e.stuck = 0; } else e.stuck = (e.stuck || 0) + dt;
      e.face = wp[0] < e.x ? -1 : 1;
    }
    return false;
  }

  plan(e, tx, ty) {
    e.pathTx = tx; e.pathTy = ty; e.pathI = 0; e.stuck = 0;
    if (this.clearLine(e.x, e.y, tx, ty)) { e.path = [[tx, ty]]; return; }
    if (this.pathBudget <= 0) { e.path = null; return; }
    this.pathBudget--;
    const cost = (x, y) => { const t = this.tiles[y * MAP + x]; return WALK[t] ? 1 / SPEED[t] : Infinity; };
    let sx = e.x | 0, sy = e.y | 0;
    if (!this.walkable(sx, sy)) { const s = this.randomSpot(e.x, e.y, 1.5, 10); sx = s.x | 0; sy = s.y | 0; }
    const p = astar(sx, sy, clamp(tx | 0, 0, MAP - 1), clamp(ty | 0, 0, MAP - 1), cost, 3500);
    e.path = p ? p.slice(1).map(([x, y]) => [x + 0.5, y + 0.5]).concat([[tx, ty]]) : [[tx, ty]];
  }

  // ---------------------------------------------------------------- fighting
  summary(o) {
    if (!o) return null;
    const h = this.hero;
    return {
      id: o.id, kind: o.kind, type: o.type || o.job, name: o.kind === 'human' ? this.fullName(o) : o.name, x: o.x, y: o.y,
      hp: Math.round(o.hp), maxHp: o.maxHp, level: o.level, power: Math.round(this.power(o)), boss: !!o.boss, job: o.job, cls: o.cls,
      age: Math.floor(o.age || 0), sex: o.sex, outlaw: !!o.outlaw, town: o.town, partner: o.partner || 0,
      hostile: o.kind === 'monster' || (!!o.outlaw && h && !h.outlaw), aff: h ? Math.round(h.rel[o.id] || 0) : 0,
      dist: h ? Math.round(dist(h, o) * 10) / 10 : 0, rift: o.rift || 0,
    };
  }

  engage(e, t, dt) {
    const d = dist(e, t);
    if (d > e.range) {
      if (e.hero && this.mind && this.mind.combat && e.cdLeft <= 0 && d < 6.5) {
        const a = this.heroCombat(e, t);
        if (a && typeof a === 'object' && a.cast) { e.cdLeft = e.cd; this.doAction(e, t, a); return; }
      }
      this.moveTo(e, t.x, t.y, dt, e.range * 0.85);
      return;
    }
    if (e.cdLeft > 0) return;
    e.cdLeft = e.cd;
    const a = e.hero ? this.heroCombat(e, t) || 'attack' : this.npcCombat(e, t);
    this.doAction(e, t, a);
  }

  heroCombat(e, t) {
    if (!this.mind || !this.mind.combat) return null;
    try {
      const enemies = [], allies = [];
      for (const o of this.ents.values()) {
        if (!o.alive || o === e || dist(o, e) > 6) continue;
        if (o.kind === 'monster' || (o.intent?.do === 'fight' && o.intent.target === e.id)) enemies.push(this.summary(o));
        else if (o.kind === 'human') allies.push(this.summary(o));
      }
      const a = this.mind.combat({ me: this.heroApi.me(), target: this.summary(t), enemies, allies });
      if (a === 'attack' || a === 'potion' || a === 'retreat') return a;
      if (a && typeof a === 'object' && ['firebolt', 'heal', 'shield', 'dash'].includes(a.cast)) return { cast: a.cast };
      return null;
    } catch (err) { this.mindError(err); return null; }
  }

  npcCombat(e, t) {
    if (e.potions > 0 && e.hp < e.maxHp * 0.3) return 'potion';
    if (e.cls === 'healer' && e.mp >= 10) {
      const hurt = this.humans().find(o => !o.outlaw && o.hp < o.maxHp * 0.5 && dist(o, e) < 5);
      if (hurt) { e.mp -= 10; hurt.hp = Math.min(hurt.maxHp, hurt.hp + 20 + e.level * 3); this.fxText(hurt.x, hurt.y - 0.6, '+heal', '#7be38f'); return null; }
    }
    return 'attack';
  }

  doAction(e, t, a) {
    if (!a) return;
    if (a === 'attack') return this.attack(e, t);
    if (a === 'potion') {
      if (e.potions > 0) { e.potions--; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.45); this.fxText(e.x, e.y - 0.7, '+potion', '#7be38f'); }
      else this.attack(e, t);
      return;
    }
    if (a === 'retreat') { this.setIntent(e, { do: 'flee', from: t.id }); e.decideIn = 2.5; return; }
    const sp = a.cast, int = e.attrs ? e.attrs.int : e.level;
    if (sp === 'firebolt' && e.mp >= 8 && dist(e, t) <= 6.5) {
      e.mp -= 8;
      this.fx.push({ bolt: true, x: e.x, y: e.y, x2: t.x, y2: t.y, t0: performance.now() });
      this.hurt(e, t, 8 + int * 2.2, false);
    } else if (sp === 'heal' && e.mp >= 10) {
      e.mp -= 10;
      const v = e.maxHp * 0.25 + int * 2;
      e.hp = Math.min(e.maxHp, e.hp + v);
      this.fxText(e.x, e.y - 0.7, '+' + Math.round(v), '#7be38f');
    } else if (sp === 'shield' && e.mp >= 12) {
      e.mp -= 12;
      e.shieldUntil = this.min + 8 * MIN_PER_SEC;
      this.fxText(e.x, e.y - 0.7, 'shield', '#5cc8ff');
    } else if (sp === 'dash' && e.mp >= 5) {
      e.mp -= 5;
      const dx = e.x - t.x, dy = e.y - t.y, d = Math.hypot(dx, dy) || 1;
      const nx = e.x + dx / d * 3, ny = e.y + dy / d * 3;
      if (this.walkable(nx, ny)) { e.x = nx; e.y = ny; e.path = null; }
    } else if (dist(e, t) <= e.range) this.attack(e, t);
  }

  attack(a, t) {
    let dmg = a.atk * (0.85 + R() * 0.3), crit = false;
    if (a.crit && R() < a.crit) { dmg *= 1.8; crit = true; }
    if (a.kind === 'human' && a.cls === 'archer') this.fx.push({ arrow: true, x: a.x, y: a.y, x2: t.x, y2: t.y, t0: performance.now() });
    if (a.kind === 'human' && a.cls === 'mage') this.fx.push({ bolt: true, x: a.x, y: a.y, x2: t.x, y2: t.y, t0: performance.now() });
    this.hurt(a, t, dmg, crit);
  }

  hurt(a, t, raw, crit) {
    const def = (t.def || 0) * (t.shieldUntil > this.min ? 1.7 : 1);
    const dmg = Math.max(1, Math.round(raw - def * 0.5));
    t.hp -= dmg;
    t.lastHitBy = a.id; t.lastHitMin = this.min; a.lastHitMin = this.min;
    this.fxText(t.x, t.y - 0.8, (crit ? '!' : '') + dmg, t.hero ? '#ff6b6b' : a.hero ? '#ffd27f' : '#ffffff');
    if (t.kind === 'monster' && !t.target) { t.target = a.id; t.chaseFrom = this.min; }
    if (t.kind === 'human') {
      t.resting = t.sleeping = false;
      if (!t.hero && t.intent.do !== 'fight') t.decideIn = 0;
      if (a.kind === 'human') { t.rel[a.id] = clamp((t.rel[a.id] || 0) - 25, -100, 100); }
    }
    if (t.hp <= 0) this.kill(a, t);
  }

  endBrawl(e, t, rob) {
    this.setIntent(e, { do: 'wander' });
    this.setIntent(t, { do: 'flee', from: e.id });
    if (rob && t.gold > 0) { const g = Math.ceil(t.gold * 0.6); t.gold -= g; e.gold += g; this.remember(t, `${e.name} robbed me.`); }
    this.remember(e, `I beat ${t.name} in a fight.`);
    this.remember(t, `${e.name} beat me in a fight.`);
    this.say(e, pick(LINES.rude));
    if (e.hero || t.hero) this.emit({ type: 'brawl', a: e.id, b: t.id, heroText: e.hero ? `I beat ${t.name} in a fight.` : `${e.name} beat me in a fight${rob ? ' and robbed me' : ''}.` });
  }

  kill(killer, v) {
    if (v.kind === 'monster') {
      v.alive = false;
      const r = v.rift && this.rifts.find(x => x.id === v.rift);
      if (r) { r.kills++; if (v.boss) this.closeRift(r, killer); }
      if (killer.kind === 'human') {
        this.gainXp(killer, v.xp);
        killer.cores += v.loot;
        killer.kills++;
      }
      this.emit({
        type: 'kill', killer: killer.id, victim: v.id, mtype: v.type, boss: v.boss, level: v.level, hero: !!killer.hero,
        heroText: killer.hero && (v.boss || v.level >= killer.level) ? `I defeated ${v.boss ? 'the boss ' + v.name : 'a level ' + v.level + ' ' + v.name}.` : null,
        chron: v.boss && killer.kind === 'human' ? `${this.fullName(killer)} slew the ${v.name}.` : null,
      });
      return;
    }
    this.die(v, 'killed', killer);
  }

  gainXp(e, xp) {
    if (e.hero) xp *= (e.xpMul || 1) * (1 + (this.passive.xp || 0));
    e.xp += xp;
    while (e.xp >= this.xpNeed(e)) {
      e.xp -= this.xpNeed(e);
      e.level++;
      if (e.hero) {
        e.statPoints += 5;
        this.allocate(e);
        this.recalcHero(e);
        e.hp = e.maxHp; e.mp = e.maxMp;
        this.emit({ type: 'levelup', hero: true, level: e.level, heroText: `I grew stronger. I am now level ${e.level}.`, chron: e.level % 5 === 0 ? `${e.name} reached level ${e.level}.` : null });
      } else {
        this.recalcNpc(e);
        e.hp = e.maxHp;
        if (e.level % 10 === 0) this.emit({ type: 'rankup', id: e.id, chron: `${this.fullName(e)} became a rank ${roman(this.rank(e))} hunter.` });
      }
    }
  }

  allocate(e) {
    if (e.statPoints <= 0) return;
    let plan = null;
    if (this.mind && this.mind.allocate) { try { plan = this.mind.allocate(e.statPoints, this.heroApi.me()); } catch (err) { this.mindError(err); } }
    let left = e.statPoints;
    if (plan && typeof plan === 'object') {
      for (const k of ['str', 'agi', 'vit', 'int', 'per']) {
        const v = Math.max(0, Math.floor(Number(plan[k]) || 0));
        const use = Math.min(v, left);
        e.attrs[k] += use; left -= use;
      }
    }
    const order = ['str', 'vit', 'agi', 'per', 'int'];
    for (let i = 0; left > 0; i++, left--) e.attrs[order[i % 5]]++;
    e.statPoints = 0;
  }

  die(e, cause, killer) {
    if (e.hero) {
      e.ghost = 20; e.hp = 0; e.deaths = (e.deaths || 0) + 1;
      e.intent = { do: 'idle' }; e.path = null;
      const by = killer ? (killer.kind === 'monster' ? `a ${killer.name}` : killer.name) : cause;
      this.emit({ type: 'heroDied', by, heroText: `I died, killed by ${by}. Then the voice brought me back.`, chron: `${e.name} fell to ${by}… but awoke again at home, as if called back.` });
      return;
    }
    e.alive = false; e.hp = 0;
    this.deadNames[e.id] = this.fullName(e);
    this.graves.push({ x: e.x, y: e.y, d: this.day, name: e.name });
    this.stats.died++;
    const age = Math.floor(e.age);
    let text;
    const kname = killer ? (killer.kind === 'monster' ? `a ${killer.name}` : this.fullName(killer)) : '';
    let murder = false;
    if (cause === 'age') text = `${this.fullName(e)} died peacefully of old age, at ${age}.`;
    else if (cause === 'starvation') text = `${this.fullName(e)} starved to death in ${this.towns[e.town]?.name}.`;
    else if (killer && killer.kind === 'monster') text = `${this.fullName(e)} (${age}) was killed by ${kname}.`;
    else if (killer) {
      const selfDefense = killer.lastHitBy === e.id && e.intent?.do === 'fight';
      murder = !e.outlaw && !selfDefense;
      text = murder ? `${this.fullName(e)} (${age}) was murdered by ${kname}.` : e.outlaw ? `The outlaw ${this.fullName(e)} was slain by ${kname}.` : `${this.fullName(e)} was killed by ${kname} in self-defense.`;
    }
    if (e.partner) {
      const p = this.ents.get(e.partner);
      if (p) { p.partner = 0; p.grief = 5; this.remember(p, `My beloved ${e.name} died.`); }
    }
    for (const id of [...e.children, ...e.parents]) {
      const r = this.ents.get(id);
      if (r) { r.grief = 4; this.remember(r, `${e.name}, my ${e.parents.includes(id) ? 'child' : 'parent'}, died.`); if (murder && killer) { r.nemesis = killer.id; r.rel[killer.id] = -100; } }
    }
    if (murder && killer && killer.kind === 'human') {
      this.stats.murders++;
      killer.crimeDay = this.day;
      if (!killer.hero) {
        killer.outlaw = true;
        killer.camp = this.wildSpot(16);
        killer.home = 0;
        this.remember(killer, `I killed ${e.name}. I can never go back.`);
      } else {
        for (const o of this.humans()) if (o.town === e.town) o.rel[killer.id] = clamp((o.rel[killer.id] || 0) - 40, -100, 100);
      }
    } else if (killer && killer.kind === 'human' && e.outlaw) {
      killer.gold += 25;
      this.remember(killer, `I brought the outlaw ${e.name} to justice.`);
    }
    const h = this.hero;
    const heroKnew = h && (e.partner === h.id || h.children.includes(e.id) || (h.rel[e.id] || 0) > 40);
    this.emit({
      type: 'death', id: e.id, name: this.fullName(e), cause, killer: killer?.id || 0, murder,
      heroText: killer && killer.hero ? (murder ? `I killed ${e.name}.` : `I killed ${e.name}.`) : heroKnew ? `${e.name}, someone close to me, died.` : null,
      chron: text,
    });
  }

  revive(e) {
    e.ghost = 0;
    const home = this.homeSpot(e);
    e.x = home.x; e.y = home.y; e.path = null;
    e.hp = Math.round(e.maxHp * 0.5); e.mp = e.maxMp;
    e.xp = Math.floor(e.xp * 0.9); e.gold = Math.floor(e.gold * 0.8);
    e.intent = { do: 'rest' }; e.intentAt = this.min; e.decideIn = 1;
    this.emit({ type: 'heroRevived' });
  }

  chat(a, b, romantic) {
    const ta = a.traits, tb = b.traits;
    const sim = 1 - (Math.abs(ta.kind - tb.kind) + Math.abs(ta.social - tb.social) + Math.abs(ta.curious - tb.curious) + Math.abs(ta.aggro - tb.aggro)) / 4;
    let d = (sim - 0.62) * 18 + (ta.kind + tb.kind - 1) * 3 - (ta.aggro + tb.aggro) * 3 * R() + (R() - 0.5) * 4;
    if (a.hero || b.hero) d *= 1 + (this.passive.social || 0);
    if (a.grief || b.grief) d += 1;
    a.rel[b.id] = clamp((a.rel[b.id] || 0) + d, -100, 100);
    b.rel[a.id] = clamp((b.rel[a.id] || 0) + d * (0.8 + R() * 0.4), -100, 100);
    a.needs.social = Math.max(0, a.needs.social - 0.55);
    b.needs.social = Math.max(0, b.needs.social - 0.55);
    const kids = a.job === 'child' && b.job === 'child';
    let line = kids ? pick(LINES.kid) : a.grief ? pick(LINES.grief) : d < -2 ? pick(LINES.rude) : romantic ? pick(LINES.flirt) : (a.rel[b.id] > 50 ? pick(LINES.friend) : pick(LINES.greet));
    if (!kids && d >= 0 && R() < 0.25 && this.chronicle.length) {
      const c = this.chronicle[this.chronicle.length - 1 - Math.floor(R() * Math.min(5, this.chronicle.length))];
      if (c && c.d >= this.day - 2) line = `Did you hear? ${c.text.length > 60 ? c.text.slice(0, 58) + '…' : c.text}`;
    }
    if (!a.hero) this.say(a, line);
    if (!b.hero) setTimeout(() => this.say(b, d < -2 ? pick(LINES.rude) : kids ? pick(LINES.kid) : romantic && d > 3 ? '…!' : pick(LINES.greet)), 1100);
    if (romantic && !a.partner && !b.partner && this.attracted(a, b) && a.rel[b.id] > 45 && b.rel[a.id] > 40 && R() < 0.5) this.makePartners(a, b);
    if (d < -2 && ((b.rel[a.id] || 0) < -28 || (d < -6 && tb.aggro > 0.7)) && tb.aggro > 0.5 && tb.brave > 0.3 && !b.hero && b.job !== 'child' && a.job !== 'child') {
      this.say(b, pick(LINES.fight));
      this.setIntent(b, { do: 'fight', target: a.id, lethal: tb.aggro > 0.75 && tb.kind < 0.3 && R() < 0.5 });
      this.chron(`${this.fullName(b)} and ${this.fullName(a)} came to blows in ${this.towns[b.town]?.name}.`, 'crime');
      this.remember(b, `${a.name} insulted me. I attacked.`);
    }
    this.emit({ type: 'talk', a: a.id, b: b.id, romantic, delta: d });
  }

  makePartners(a, b) {
    a.partner = b.id; b.partner = a.id;
    a.rel[b.id] = Math.max(a.rel[b.id], 80); b.rel[a.id] = Math.max(b.rel[a.id], 80);
    this.stats.partners++;
    // move in together
    const keep = a.hero ? a : b.hero ? b : this.occupants(a.home).length <= this.occupants(b.home).length ? a : b;
    const mover = keep === a ? b : a;
    let home = keep.home;
    const crowd = home ? this.occupants(home).filter(o => o !== keep && o !== mover && !keep.children.includes(o.id)).length : 9;
    if (!home || crowd > 0) {
      const tn = this.towns[keep.town];
      const free = this.houses.find(h => h.town === tn.id && !this.occupants(h.id).length) || this.buildHouse(tn);
      if (free) { home = free.id; keep.home = home; }
    }
    mover.home = home; mover.town = keep.town;
    this.remember(a, `${b.name} and I became partners.`); this.remember(b, `${a.name} and I became partners.`);
    const hero = a.hero ? a : b.hero ? b : null;
    this.emit({
      type: 'partners', a: a.id, b: b.id,
      heroText: hero ? `${(hero === a ? b : a).name} and I became partners. We live together now.` : null,
      chron: `${this.fullName(a)} and ${this.fullName(b)} fell in love and became partners.`,
    });
  }

  steal(e, h) {
    const victims = this.occupants(h.id).filter(o => o.gold > 5);
    if (!victims.length) return;
    const v = pick(victims), g = Math.ceil(v.gold * 0.4);
    v.gold -= g; e.gold += g;
    const witness = this.humans().find(o => o !== e && o.home !== e.home && !o.sleeping && dist(o, e) < 5);
    if (witness) {
      v.rel[e.id] = clamp((v.rel[e.id] || 0) - 50, -100, 100);
      witness.rel[e.id] = clamp((witness.rel[e.id] || 0) - 30, -100, 100);
      this.remember(v, `${e.name} stole from me!`);
      this.chron(`${this.fullName(e)} was caught stealing from ${v.name}.`, 'crime');
    } else this.remember(v, 'Someone stole my gold in the night.');
  }

  trade(e, it) {
    if (e.cores > 0) { const g = Math.round(e.cores * (1 + (e.hero ? this.passive.gold || 0 : 0))); e.gold += g; e.cores = 0; }
    const want = it.potions ?? 2;
    while (e.potions < want && e.gold >= 15) { e.gold -= 15; e.potions++; }
    if (it.gear || (!e.hero && e.job === 'hunter')) {
      const slot = e.weapon <= e.armor ? 'weapon' : 'armor';
      const cost = 60 * Math.pow(e[slot] + 1, 2);
      if (e[slot] < 10 && e.gold >= cost + (e.hero ? 0 : 40)) {
        e.gold -= cost; e[slot]++;
        if (e.hero) { this.recalcHero(e); this.emit({ type: 'gear', heroText: `I bought better ${slot === 'weapon' ? 'weapon' : 'armor'} (tier ${e[slot]}).` }); }
        else this.recalcNpc(e);
        if (!e.hero) { e.atk += slot === 'weapon' ? 3 : 0; e.def += slot === 'armor' ? 2 : 0; }
      }
    }
  }

  // ---------------------------------------------------------------- the hero's mind plugs in here
  setMind(m) { this.mind = m; this.passiveT = 0; }
  mindError(err) { this.mindErrors++; this.lastMindError = String((err && err.stack) || err).slice(0, 600); }
  refreshPassives() {
    let p = {};
    try { p = (this.mind && this.mind.passives && this.mind.passives()) || {}; } catch (err) { this.mindError(err); }
    const out = {};
    for (const k of ['atk', 'def', 'hp', 'spd', 'xp', 'gold', 'sense', 'social']) { const v = Number(p[k]); out[k] = isFinite(v) ? clamp(v, -0.3, 0.6) : 0; }
    this.passive = out;
    if (this.hero) this.recalcHero(this.hero);
  }

  buildHeroApi() {
    const w = this;
    return Object.freeze({
      me() {
        const h = w.hero;
        if (!h) return null;
        const hs = w.homeSpot(h), tn = w.townAt(h);
        return Object.freeze({
          ...w.summary(h), mp: Math.round(h.mp), maxMp: h.maxMp, atk: Math.round(h.atk), def: Math.round(h.def), spd: h.spd, sense: h.sense,
          xp: Math.round(h.xp), xpNeed: w.xpNeed(h), gold: Math.floor(h.gold), potions: h.potions, cores: h.cores, weapon: h.weapon, armor: h.armor,
          attrs: { ...h.attrs }, statPoints: h.statPoints, rank: w.rank(h), hunger: h.needs.hunger, energy: h.needs.energy, social: h.needs.social,
          home: { x: hs.x, y: hs.y }, children: h.children.slice(), inTown: tn ? tn.id : -1, night: w.isNight, ghost: !!h.ghost,
          deaths: h.deaths || 0, kills: h.kills, intent: h.intent ? h.intent.do : 'idle', intentTarget: h.intent ? h.intent.target || 0 : 0, intentDone: !!h.intentDone, shield: h.shieldUntil > w.min, doing: w.doing(h),
        });
      },
      near(r = 8, kind = 'any') {
        const h = w.hero, out = [];
        if (!h) return out;
        for (const o of w.ents.values()) {
          if (!o.alive || o === h || o.ghost || dist(o, h) > r) continue;
          if (kind === 'any' || o.kind === kind || (kind === 'rift')) out.push(w.summary(o));
        }
        return out.sort((a, b) => a.dist - b.dist);
      },
      find: id => w.summary(w.ents.get(id)),
      rifts: () => w.rifts.map(r => ({ id: r.id, x: r.x, y: r.y, rank: r.rank, types: RIFT_TYPES[r.rank].slice(), kills: r.kills, need: r.need, daysLeft: r.breakDay - w.day, dist: w.hero ? Math.round(dist(r, w.hero)) : 0 })),
      towns: () => w.towns.map(t => {
        let threat = 0;
        for (const o of w.ents.values()) if (o.kind === 'monster' && o.alive && Math.hypot(o.x - t.x, o.y - t.y) < 14) threat++;
        return { id: t.id, name: t.name, x: t.x + 0.5, y: t.y + 0.5, food: Math.round(t.food), pop: w.humans().filter(e => e.town === t.id).length, threat, dist: w.hero ? Math.round(Math.hypot(t.x - w.hero.x, t.y - w.hero.y)) : 0 };
      }),
      time: () => ({ day: w.day, hour: w.hour, year: w.year, night: w.isNight, clock: w.clock() }),
      quests: () => w.quests.filter(q => q.status === 'active').map(q => ({ id: q.id, kind: q.kind, p: { ...q.p }, text: q.text, progress: q.progress, goal: q.goal })),
      relations() {
        const h = w.hero;
        if (!h) return [];
        return Object.entries(h.rel).map(([id, aff]) => {
          const o = w.ents.get(+id);
          return { id: +id, name: o ? w.fullName(o) : w.deadNames[id] || '?', aff: Math.round(aff), alive: !!(o && o.alive), partner: h.partner === +id, single: o ? !o.partner : false, sex: o?.sex, age: o ? Math.floor(o.age) : 0, family: h.children.includes(+id), town: o?.town };
        }).sort((a, b) => b.aff - a.aff);
      },
      power: o => (o ? (o.power ?? Math.round(w.power(o))) : 0),
      dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
      describe: id => w.describe(id),
    });
  }

  // ---------------------------------------------------------------- quests & gifts from the System
  addQuest(kind, p, reward) {
    const h = this.hero;
    const q = { id: this.nextId++, kind, p: { ...p }, reward: { ...reward }, progress: 0, goal: 1, status: 'active', created: this.day };
    switch (kind) {
      case 'hunt': q.goal = Math.max(1, p.count | 0); q.text = `Defeat ${q.goal} ${p.type === 'any' ? 'monsters' : MON[p.type].name + (q.goal > 1 ? 's' : '')}`; break;
      case 'rift': q.text = `Close a rift of rank ${roman(p.rank)} or higher`; break;
      case 'level': q.goal = p.level | 0; q.progress = h.level; q.text = `Reach level ${q.goal}`; break;
      case 'gold': q.goal = p.amount | 0; q.text = `Gather ${q.goal} gold`; break;
      case 'visit': q.text = `Travel to ${this.towns[p.town]?.name}`; break;
      case 'friends': q.goal = Math.max(1, p.count | 0); q.text = `Make ${q.goal} close friend${q.goal > 1 ? 's' : ''}`; break;
      case 'defeat': q.text = `Defeat ${this.nameOf(p.target)}`; break;
      case 'protect': q.goal = Math.max(1, p.count | 0); q.text = `Protect ${this.towns[p.town]?.name}: defeat ${q.goal} monsters near it`; break;
      case 'partner': q.text = 'Find a partner to share your life with'; break;
      default: q.kind = 'custom'; q.text = String(p.text || 'A task from the System').slice(0, 160);
    }
    if (p.title) q.text = String(p.title).slice(0, 160);
    this.quests.push(q);
    if (this.quests.length > 60) this.quests.splice(0, this.quests.length - 60);
    this.checkQuests();
    return q;
  }

  questEvent(ev) {
    const h = this.hero;
    if (!h) return;
    for (const q of this.quests) {
      if (q.status !== 'active') continue;
      if (q.kind === 'hunt' && ev.type === 'kill' && ev.killer === h.id && (q.p.type === 'any' || q.p.type === ev.mtype)) q.progress++;
      if (q.kind === 'protect' && ev.type === 'kill' && ev.killer === h.id) {
        const tn = this.towns[q.p.town], v = this.hero;
        if (tn && Math.hypot(v.x - tn.x, v.y - tn.y) < 16) q.progress++;
      }
      if (q.kind === 'rift' && ev.type === 'riftClosed' && ev.by === h.id && ev.rank >= q.p.rank) q.progress = 1;
      if (q.kind === 'defeat' && (ev.type === 'death' || ev.type === 'kill') && (ev.id === q.p.target || ev.victim === q.p.target)) {
        if (ev.killer === h.id) q.progress = 1;
        else { q.status = 'failed'; this.emitLater({ type: 'questFailed', quest: q.id, text: q.text }); }
      }
      if (q.kind === 'defeat' && ev.type === 'brawl' && ev.a === h.id && ev.b === q.p.target) q.progress = 1;
    }
    if (ev.type === 'kill' || ev.type === 'riftClosed' || ev.type === 'levelup' || ev.type === 'death' || ev.type === 'partners' || ev.type === 'brawl') this.checkQuests();
  }
  emitLater(ev) { setTimeout(() => this.emit(ev), 0); }

  checkQuests() {
    const h = this.hero;
    if (!h) return;
    for (const q of this.quests) {
      if (q.status !== 'active') continue;
      if (q.kind === 'level') q.progress = h.level;
      if (q.kind === 'gold') q.progress = Math.floor(h.gold);
      if (q.kind === 'visit') { const tn = this.towns[q.p.town]; if (tn && Math.hypot(h.x - tn.x, h.y - tn.y) < 7) q.progress = 1; }
      if (q.kind === 'friends') q.progress = Object.entries(h.rel).filter(([id, v]) => v >= 50 && this.ents.get(+id)?.alive).length;
      if (q.kind === 'partner') q.progress = h.partner ? 1 : 0;
      if (q.kind !== 'custom' && q.progress >= q.goal) this.completeQuest(q);
    }
  }

  completeQuest(q) {
    if (q.status !== 'active') return;
    q.status = 'done'; q.doneDay = this.day;
    const got = this.applyGift(q.reward.kind, q.reward.amount, true);
    this.emitLater({ type: 'questDone', quest: q.id, text: q.text, reward: got, heroText: `I completed the System's quest: ${q.text}. Reward: ${got}.` });
  }
  cancelQuest(id) { const q = this.quests.find(x => x.id === id); if (q && q.status === 'active') q.status = 'cancelled'; }

  applyGift(kind, amount, quiet) {
    const h = this.hero;
    amount = Math.max(1, Math.min(100000, Number(amount) || 1));
    let got = '';
    switch (kind) {
      case 'xp': this.gainXp(h, amount / ((h.xpMul || 1) * (1 + (this.passive.xp || 0)))); got = `${amount} experience`; break;
      case 'gold': h.gold += amount; got = `${amount} gold`; break;
      case 'points': h.statPoints += Math.min(amount, 200); this.allocate(h); this.recalcHero(h); got = `${Math.min(amount, 200)} stat points`; break;
      case 'potions': h.potions += Math.min(amount, 50); got = `${Math.min(amount, 50)} potions`; break;
      case 'weapon': h.weapon = Math.min(10, h.weapon + Math.min(amount, 10)); this.recalcHero(h); got = `a tier ${h.weapon} weapon`; break;
      case 'armor': h.armor = Math.min(10, h.armor + Math.min(amount, 10)); this.recalcHero(h); got = `tier ${h.armor} armor`; break;
      case 'heal': h.hp = h.maxHp; h.mp = h.maxMp; got = 'full health'; break;
      case 'evolution': got = 'an evolution'; this.emitLater({ type: 'evolutionGift' }); break;
      default: got = 'nothing';
    }
    if (!quiet) this.emit({ type: 'gift', kind, amount, heroText: `The voice gave me ${got}.` });
    return got;
  }

  // ---------------------------------------------------------------- telling about people
  doing(e) {
    const it = e.intent || {}, tgt = it.target && this.ents.get(it.target);
    if (e.ghost) return 'between life and death';
    if (e.sleeping) return 'sleeping';
    switch (it.do) {
      case 'fight': return `fighting ${tgt ? (tgt.kind === 'monster' ? 'a ' + tgt.name : tgt.name) : ''}`;
      case 'hunt': return it.rift ? 'hunting at a rift' : 'hunting in the wilds';
      case 'guard': return `guarding ${this.towns[it.town]?.name || 'the town'}`;
      case 'flee': return 'running for their life';
      case 'rest': return 'resting at home';
      case 'eat': return 'having a meal';
      case 'shop': return 'at the market';
      case 'work': return e.job === 'farmer' ? 'working the fields' : e.job === 'merchant' ? 'trading at the market' : 'tending the sick';
      case 'talk': return `talking with ${tgt?.name || 'someone'}`;
      case 'court': return `courting ${tgt?.name || 'someone'}`;
      case 'follow': return `following ${tgt?.name || 'family'}`;
      case 'go': return e.outlaw ? 'hiding in the wilds' : 'travelling';
      case 'explore': return 'exploring';
      case 'steal': return 'sneaking around';
      case 'wander': return e.kind === 'monster' ? 'prowling' : e.job === 'child' ? 'playing' : 'strolling';
      default: return 'idle';
    }
  }

  mood(e) {
    if (e.kind !== 'human') return '';
    const n = e.needs;
    if (e.grief) return 'grieving';
    if (e.hp < e.maxHp * 0.4) return 'hurt';
    if (n.hunger > 0.85) return 'starving';
    if (e.nemesis) return 'vengeful';
    if (e.outlaw) return 'hunted';
    if (n.hunger > 0.6) return 'hungry';
    if (n.energy < 0.2) return 'exhausted';
    if (n.social > 0.8) return 'lonely';
    if (e.partner && e.rel[e.partner] > 70) return 'in love';
    return e.traits.kind > 0.5 ? 'content' : 'restless';
  }

  describe(id) {
    const e = this.ents.get(id);
    if (!e) return null;
    if (e.kind === 'monster') return { id, kind: 'monster', name: e.name, level: e.level, hp: Math.round(e.hp), maxHp: e.maxHp, doing: this.doing(e), boss: e.boss, march: e.march != null ? this.towns[e.march].name : '' };
    const tn = this.towns[e.town];
    return {
      id, kind: 'human', hero: !!e.hero, name: this.fullName(e), first: e.name, sex: e.sex, age: Math.floor(e.age), job: e.job, cls: e.cls,
      level: e.level, rank: this.rank(e), hp: Math.round(e.hp), maxHp: e.maxHp, town: tn?.name, doing: this.doing(e), mood: this.mood(e),
      traits: TRAIT_WORDS(e), gold: Math.floor(e.gold), outlaw: e.outlaw, pregnant: !!e.pregnant,
      partner: e.partner ? this.nameOf(e.partner) : '', parents: e.parents.map(p => this.nameOf(p)), children: e.children.map(c => this.nameOf(c) + (this.ents.get(c) ? '' : ' †')),
      friends: Object.entries(e.rel).filter(([, v]) => v > 45).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([i]) => this.nameOf(+i)),
      enemies: Object.entries(e.rel).filter(([, v]) => v < -40).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([i]) => this.nameOf(+i)),
      heroFeeling: this.hero && !e.hero ? Math.round(e.rel[this.heroId] || 0) : null,
      mem: e.mem.slice(-5).map(m => `Day ${m.d}: ${m.t}`), kills: e.kills,
    };
  }

  profile(id) {
    const d = this.describe(id);
    if (!d || d.kind !== 'human') return '';
    const job = d.job === 'hunter' ? `a level ${d.level} ${d.cls} hunter` : d.job === 'child' ? 'a child' : d.job === 'elder' ? 'an elder' : `a ${d.job}`;
    const hf = d.heroFeeling;
    const h = this.hero;
    return [
      `You are ${d.name}, ${d.age} years old, ${job} in ${d.town}. You are ${d.traits.join(', ')}.`,
      d.partner ? `Your partner is ${d.partner}.` : 'You have no partner.',
      d.children.length ? `Your children: ${d.children.join(', ')}.` : '',
      d.friends.length ? `People you like: ${d.friends.join(', ')}.` : '',
      d.enemies.length ? `People you dislike: ${d.enemies.join(', ')}.` : '',
      h && hf !== null ? `You know ${h.name}, the young hunter, ${hf > 40 ? 'and like them' : hf < -30 ? 'and dislike them' : 'a little'}.` : '',
      d.outlaw ? 'You are an outlaw, hiding in the wilds.' : '',
      `Right now you are ${d.doing} and you feel ${d.mood}.`,
      d.mem.length ? `Recent memories: ${d.mem.join(' ')}` : '',
    ].filter(Boolean).join('\n');
  }

  census() {
    const hum = this.humans(), pop = hum.length;
    const towns = this.towns.map(t => ({ name: t.name, pop: hum.filter(e => e.town === t.id && !e.outlaw).length, food: Math.round(t.food) }));
    const hunters = hum.filter(e => e.job === 'hunter').sort((a, b) => b.level - a.level);
    const oldest = hum.reduce((b, e) => (!b || e.age > b.age ? e : b), null);
    return {
      pop, towns, kids: hum.filter(e => e.job === 'child').length, couples: hum.filter(e => e.partner).length / 2 | 0,
      hunters: hunters.length, top: hunters.slice(0, 5).map(e => ({ id: e.id, name: this.fullName(e), level: e.level, hero: !!e.hero })),
      outlaws: hum.filter(e => e.outlaw).map(e => ({ id: e.id, name: this.fullName(e) })), oldest: oldest ? `${this.fullName(oldest)} (${Math.floor(oldest.age)})` : '',
      monsters: this.monsters().length, rifts: this.rifts.map(r => ({ id: r.id, rank: r.rank, daysLeft: r.breakDay - this.day, kills: r.kills, need: r.need, near: this.nearestTown(r).name })),
      stats: { ...this.stats }, day: this.day, year: this.year,
    };
  }

  // ---------------------------------------------------------------- drawing
  drawTerrain() {
    const c = this.terrain || (this.terrain = document.createElement('canvas'));
    c.width = c.height = MAP * TILE;
    const g = c.getContext('2d');
    const BASE = ['#4e7d3a', '#3d6a2e', '#2a5b86', '#5f5a55', '#c8b27a', '#8d7552', '#a8922f', '#8b8374'];
    for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
      const i = y * MAP + x, t = this.tiles[i], px = x * TILE, py = y * TILE;
      g.fillStyle = BASE[t];
      g.fillRect(px, py, TILE, TILE);
      const r1 = hrand(i, 1), r2 = hrand(i, 2), r3 = hrand(i, 3);
      if (t === T.GRASS || t === T.SAND || t === T.ROAD) {
        g.fillStyle = t === T.GRASS ? (r1 > 0.5 ? '#5a8c44' : '#446f32') : t === T.SAND ? '#d6c18c' : '#7a6446';
        for (let k = 0; k < 3; k++) g.fillRect(px + hrand(i, 10 + k) * 14, py + hrand(i, 20 + k) * 14, 2, 2);
        if (t === T.GRASS && r2 > 0.93) { g.fillStyle = r3 > 0.5 ? '#e8d36a' : '#e9a3c0'; g.fillRect(px + r3 * 12 + 2, py + r1 * 12 + 2, 2, 2); }
      } else if (t === T.FOREST) {
        for (let k = 0; k < 2; k++) {
          const tx = px + 3 + hrand(i, 30 + k) * 10, ty = py + 3 + hrand(i, 40 + k) * 10;
          g.fillStyle = '#4a3523'; g.fillRect(tx - 1, ty + 2, 2, 4);
          g.fillStyle = '#24502a'; g.beginPath(); g.arc(tx, ty, 4.5 + r1, 0, 7); g.fill();
          g.fillStyle = '#31663a'; g.beginPath(); g.arc(tx - 1.2, ty - 1.2, 2, 0, 7); g.fill();
        }
      } else if (t === T.WATER) {
        g.strokeStyle = 'rgba(160,210,255,0.25)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(px + 2 + r1 * 6, py + 5 + r2 * 6); g.lineTo(px + 7 + r1 * 6, py + 5 + r2 * 6); g.stroke();
      } else if (t === T.MOUNTAIN) {
        g.fillStyle = '#4c4743'; g.beginPath(); g.moveTo(px, py + 16); g.lineTo(px + 8 + (r1 - 0.5) * 4, py + 2); g.lineTo(px + 16, py + 16); g.fill();
        g.fillStyle = '#77716a'; g.beginPath(); g.moveTo(px + 3, py + 16); g.lineTo(px + 8 + (r1 - 0.5) * 4, py + 3); g.lineTo(px + 9, py + 16); g.fill();
        if (r2 > 0.55) { g.fillStyle = '#e4e1da'; g.beginPath(); g.moveTo(px + 6 + (r1 - 0.5) * 4, py + 6); g.lineTo(px + 8 + (r1 - 0.5) * 4, py + 2); g.lineTo(px + 10 + (r1 - 0.5) * 4, py + 6); g.fill(); }
      } else if (t === T.FIELD) {
        g.fillStyle = '#8f7b25';
        for (let k = 2; k < 16; k += 4) g.fillRect(px, py + k, 16, 1.5);
        g.fillStyle = '#c9b34c';
        for (let k = 0; k < 4; k++) g.fillRect(px + hrand(i, 50 + k) * 14, py + 1 + k * 4, 2, 2);
      } else if (t === T.PLAZA) {
        g.strokeStyle = '#7a7366'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, 15, 15);
        g.beginPath(); g.moveTo(px + 8, py); g.lineTo(px + 8, py + 8); g.moveTo(px, py + 8); g.lineTo(px + 16, py + 8); g.stroke();
      }
    }
    for (const tn of this.towns) {
      // guild hall
      const gx = (tn.x - 1) * TILE, gy = (tn.y - 4.2) * TILE;
      g.fillStyle = '#5d6475'; g.fillRect(gx, gy + 8, 48, 26);
      g.fillStyle = '#2f3f62'; g.beginPath(); g.moveTo(gx - 4, gy + 10); g.lineTo(gx + 24, gy - 6); g.lineTo(gx + 52, gy + 10); g.fill();
      g.fillStyle = '#2a1f17'; g.fillRect(gx + 20, gy + 22, 8, 12);
      g.fillStyle = '#5cc8ff'; g.fillRect(gx + 6, gy + 14, 6, 9); g.fillRect(gx + 36, gy + 14, 6, 9);
      // tavern
      const tx = (tn.tavern.x - 1) * TILE, ty = (tn.tavern.y - 1.6) * TILE;
      g.fillStyle = '#6b4a2e'; g.fillRect(tx, ty + 6, 30, 18);
      g.fillStyle = '#7d2f22'; g.beginPath(); g.moveTo(tx - 3, ty + 8); g.lineTo(tx + 15, ty - 4); g.lineTo(tx + 33, ty + 8); g.fill();
      g.fillStyle = '#f2b35b'; g.fillRect(tx + 24, ty + 12, 4, 4);
      // market stalls
      const mx = (tn.market.x - 1.2) * TILE, my = (tn.market.y - 0.8) * TILE;
      ['#c94f4f', '#4f8fc9', '#d6b44a'].forEach((col, k) => {
        g.fillStyle = '#6b4a2e'; g.fillRect(mx + k * 13, my + 7, 10, 8);
        g.fillStyle = col; g.fillRect(mx + k * 13 - 1, my + 3, 12, 5);
        g.fillStyle = '#ffffff55'; g.fillRect(mx + k * 13 + 2, my + 3, 3, 5);
      });
    }
    for (const h of this.houses) {
      const px = h.x * TILE, py = h.y * TILE, r = hrand(h.id, 7);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px + 2, py + 5, 15, 12);
      g.fillStyle = r > 0.5 ? '#8a6240' : '#9b7a55'; g.fillRect(px + 1, py + 5, 14, 10);
      g.fillStyle = ['#9a3a2c', '#5a4a8a', '#3f6b4a', '#8a6a2a'][Math.floor(r * 4)];
      g.beginPath(); g.moveTo(px - 1, py + 6); g.lineTo(px + 8, py - 1); g.lineTo(px + 17, py + 6); g.fill();
      g.fillStyle = '#3d2a1a'; g.fillRect(px + 6, py + 10, 4, 5);
      g.fillStyle = '#f5d48a'; g.fillRect(px + 2.5, py + 8, 2.5, 2.5);
    }
    this.terrainDirty = false;
  }

  render(ctx, cam, sel) {
    if (!this.terrain || this.terrainDirty) this.drawTerrain();
    const { w, h, s } = cam, now = performance.now();
    const vx0 = cam.x - w / 2 / s, vy0 = cam.y - h / 2 / s;
    ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = s < TILE;
    ctx.drawImage(this.terrain, vx0 * TILE, vy0 * TILE, (w / s) * TILE, (h / s) * TILE, 0, 0, w, h);
    const X = x => (x - vx0) * s, Y = y => (y - vy0) * s;
    const inView = (x, y, m = 2) => x > vx0 - m && y > vy0 - m && x < vx0 + w / s + m && y < vy0 + h / s + m;

    for (const gr of this.graves) {
      if (!inView(gr.x, gr.y)) continue;
      ctx.fillStyle = '#a9a9b3';
      ctx.fillRect(X(gr.x) - s * 0.05, Y(gr.y) - s * 0.35, s * 0.1, s * 0.45);
      ctx.fillRect(X(gr.x) - s * 0.17, Y(gr.y) - s * 0.25, s * 0.34, s * 0.09);
    }
    for (const r of this.rifts) {
      if (!inView(r.x, r.y, 3)) continue;
      const px = X(r.x), py = Y(r.y), rad = s * (0.55 + r.rank * 0.12), col = RIFT_COL[r.rank];
      const danger = r.breakDay - this.day <= 1;
      const glow = ctx.createRadialGradient(px, py, 0, px, py, rad * 2.2);
      glow.addColorStop(0, (danger && Math.sin(now / 150) > 0 ? '#ff3b30' : col) + '99'); glow.addColorStop(1, col + '00');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, rad * 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#0a0614'; ctx.beginPath(); ctx.ellipse(px, py, rad * 0.75, rad, 0, 0, 7); ctx.fill();
      ctx.lineWidth = Math.max(1.5, s * 0.08);
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = col; ctx.globalAlpha = 0.9 - k * 0.25;
        const a = now / (600 - k * 120) + k * 2.1;
        ctx.beginPath(); ctx.ellipse(px, py, rad * (0.8 - k * 0.18), rad * (1.05 - k * 0.2), 0, a, a + 4); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (s >= 10) { ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.max(9, s * 0.45)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(roman(r.rank), px, py - rad - 4); }
    }

    const list = [];
    for (const e of this.ents.values()) if ((e.alive || e.ghost) && inView(e.x, e.y)) list.push(e);
    list.sort((a, b) => a.y - b.y);
    for (const e of list) (e.kind === 'monster' ? this.drawMonster : this.drawHuman).call(this, ctx, e, X(e.x), Y(e.y), s, now, e.id === sel);

    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i], age = now - f.t0;
      if (age > 900) { this.fx.splice(i, 1); continue; }
      if (f.bolt || f.arrow) {
        if (age > 260) continue;
        const k = age / 260;
        ctx.strokeStyle = f.bolt ? '#ff9a3c' : '#e8e2c4'; ctx.lineWidth = f.bolt ? Math.max(2, s * 0.15) : 1.5;
        const x1 = X(f.x + (f.x2 - f.x) * Math.max(0, k - 0.3)), y1 = Y(f.y + (f.y2 - f.y) * Math.max(0, k - 0.3));
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(X(f.x + (f.x2 - f.x) * k), Y(f.y + (f.y2 - f.y) * k)); ctx.stroke();
        continue;
      }
      if (!inView(f.x, f.y)) continue;
      ctx.globalAlpha = 1 - age / 900;
      ctx.fillStyle = f.col; ctx.font = `700 ${Math.max(9, s * 0.45)}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText(f.text, X(f.x), Y(f.y) - age / 900 * s);
      ctx.globalAlpha = 1;
    }

    // night
    const hr = this.hour;
    const dark = hr >= 21 || hr < 5 ? 0.55 : hr >= 19 ? (hr - 19) / 2 * 0.55 : hr < 7 ? (7 - hr) / 2 * 0.55 : 0;
    if (dark > 0.01) {
      ctx.fillStyle = `rgba(8,12,38,${dark})`; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const tn of this.towns) {
        if (!inView(tn.x, tn.y, 10)) continue;
        const gl = ctx.createRadialGradient(X(tn.x + 0.5), Y(tn.y + 0.5), 0, X(tn.x + 0.5), Y(tn.y + 0.5), s * 7);
        gl.addColorStop(0, `rgba(255,170,80,${dark * 0.45})`); gl.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(X(tn.x + 0.5), Y(tn.y + 0.5), s * 7, 0, 7); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // labels
    ctx.textAlign = 'center';
    if (s >= 7) for (const tn of this.towns) {
      if (!inView(tn.x, tn.y, 4)) continue;
      ctx.font = `700 ${Math.max(11, s * 0.7)}px system-ui`;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(tn.name, X(tn.x + 0.5) + 1, Y(tn.y + 0.5) - s * 5.4 + 1);
      ctx.fillStyle = '#fff3d6'; ctx.fillText(tn.name, X(tn.x + 0.5), Y(tn.y + 0.5) - s * 5.4);
    }
    for (const e of list) {
      if (e.say && now < e.say.until && s >= 9) this.bubble(ctx, X(e.x), Y(e.y) - s * (e.kind === 'monster' ? 0.9 : 1.15), e.say.text, e.hero);
      if ((e.hero || e.id === sel || e.boss) && s >= 6) {
        ctx.font = `600 ${Math.max(10, s * 0.48)}px system-ui`;
        const label = e.hero ? `${e.name} · Lv ${e.level}` : e.kind === 'monster' ? `${e.name} · Lv ${e.level}` : e.name;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(label, X(e.x) + 1, Y(e.y) + s * 0.75 + 1);
        ctx.fillStyle = e.hero ? '#ffd27f' : e.boss ? '#ff8a7a' : '#ffffff'; ctx.fillText(label, X(e.x), Y(e.y) + s * 0.75);
      }
    }
  }

  bubble(ctx, x, y, text, hero) {
    ctx.font = '600 11px system-ui';
    const words = text.split(' '), lines = [''];
    for (const wd of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + wd : wd; if (ctx.measureText(t).width > 150 && lines[lines.length - 1]) lines.push(wd); else lines[lines.length - 1] = t; }
    const shown = lines.slice(0, 3), bw = Math.max(...shown.map(l => ctx.measureText(l).width)) + 12, bh = shown.length * 13 + 8;
    ctx.fillStyle = hero ? 'rgba(255,240,210,0.95)' : 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = hero ? '#f2b35b' : 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh - 6, bw, bh, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 4, y - 6.5); ctx.lineTo(x, y - 1); ctx.lineTo(x + 4, y - 6.5); ctx.fill();
    ctx.fillStyle = '#1b1b22'; ctx.textAlign = 'center';
    shown.forEach((l, i) => ctx.fillText(l, x, y - bh - 6 + 15 + i * 13));
  }

  hpBar(ctx, x, y, w, e) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2, y, w, 3);
    ctx.fillStyle = e.kind === 'monster' ? '#ff5b4f' : e.hero ? '#f2b35b' : '#62d17d';
    ctx.fillRect(x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 3);
  }

  drawHuman(ctx, e, px, py, s, now, selected) {
    const small = e.job === 'child', r = s * (small ? 0.16 + Math.min(16, e.age) * 0.008 : 0.3);
    if (e.ghost) ctx.globalAlpha = 0.35;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px, py + r * 0.9, r * 0.9, r * 0.35, 0, 0, 7); ctx.fill();
    if (e.hero) {
      ctx.strokeStyle = '#f2b35b'; ctx.lineWidth = Math.max(1.5, s * 0.07);
      ctx.beginPath(); ctx.ellipse(px, py + r * 0.9, r * 1.4, r * 0.55, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = `rgba(92,200,255,${0.25 + 0.15 * Math.sin(now / 300)})`; ctx.beginPath(); ctx.arc(px, py - r * 0.8, r * 2, 0, 7); ctx.fill();
    }
    const body = e.job === 'hunter' ? CLS_COL[e.cls] || '#c8513f' : JOB_COL[e.job] || '#888';
    ctx.fillStyle = body; ctx.strokeStyle = e.outlaw ? '#ff3b30' : 'rgba(0,0,0,0.55)'; ctx.lineWidth = e.outlaw ? 2 : 1;
    ctx.beginPath(); ctx.arc(px, py - r * 0.5, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = SKIN[e.skin || 0]; ctx.beginPath(); ctx.arc(px, py - r * 1.75, r * 0.6, 0, 7); ctx.fill(); ctx.stroke();
    if (s >= 10 && e.job === 'hunter') {
      ctx.strokeStyle = e.cls === 'mage' ? '#b48cff' : '#d9d9e0'; ctx.lineWidth = Math.max(1, s * 0.06);
      const f = e.face || 1;
      ctx.beginPath(); ctx.moveTo(px + f * r * 0.9, py - r * 0.2); ctx.lineTo(px + f * r * 1.5, py - r * 1.6); ctx.stroke();
      if (e.cls === 'mage') { ctx.fillStyle = '#c9a8ff'; ctx.beginPath(); ctx.arc(px + f * r * 1.5, py - r * 1.7, r * 0.25, 0, 7); ctx.fill(); }
    }
    if (e.sleeping && s >= 9) { ctx.fillStyle = '#cfe3ff'; ctx.font = `700 ${s * 0.4}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('z', px + r, py - r * 2.4 - Math.sin(now / 400) * 2); }
    if (e.pregnant && s >= 12) { ctx.fillStyle = '#ff9ec2'; ctx.font = `${s * 0.35}px system-ui`; ctx.fillText('♥', px - r * 1.3, py - r * 1.8); }
    if (e.hp < e.maxHp && !e.ghost && (this.min - (e.lastHitMin ?? -999) < 200 || e.hero)) this.hpBar(ctx, px, py - r * 2.8, s * 0.8, e);
    if (selected) { ctx.strokeStyle = '#5cc8ff'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py - r * 0.8, r * 2.4, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    ctx.globalAlpha = 1;
  }

  drawMonster(ctx, e, px, py, s, now, selected) {
    const m = MON[e.type], r = s * m.size * (e.boss ? 1.5 : 1), bob = Math.sin(now / 250 + e.id) * r * 0.08;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px, py + r * 0.8, r, r * 0.35, 0, 0, 7); ctx.fill();
    if (e.boss) { ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(px, py + r * 0.8, r * 1.4, r * 0.5, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = m.col; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
    const y0 = py - r * 0.5 + bob, f = e.face || 1;
    switch (e.type) {
      case 'slime': ctx.beginPath(); ctx.ellipse(px, y0 + r * 0.3, r, r * 0.75, 0, Math.PI, 0); ctx.lineTo(px + r, y0 + r * 0.5); ctx.lineTo(px - r, y0 + r * 0.5); ctx.fill(); ctx.stroke(); break;
      case 'wolf':
        ctx.beginPath(); ctx.ellipse(px, y0, r * 1.2, r * 0.6, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(px + f * r, y0 - r * 0.4, r * 0.5, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + f * r * 0.8, y0 - r * 0.8); ctx.lineTo(px + f * r * 0.9, y0 - r * 1.3); ctx.lineTo(px + f * r * 1.15, y0 - r * 0.85); ctx.fill();
        break;
      case 'drake':
        ctx.beginPath(); ctx.moveTo(px - r * 1.4, y0 - r * 0.9); ctx.lineTo(px, y0 - r * 0.2); ctx.lineTo(px + r * 1.4, y0 - r * 0.9); ctx.lineTo(px, y0 + r * 0.4); ctx.closePath(); ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.ellipse(px, y0, r * 0.6, r * 0.9, 0, 0, 7); ctx.fill(); ctx.stroke();
        break;
      case 'wraith':
        ctx.globalAlpha = 0.65 + 0.2 * Math.sin(now / 200 + e.id);
        ctx.beginPath(); ctx.arc(px, y0 - r * 0.3, r * 0.8, Math.PI, 0); ctx.lineTo(px + r * 0.8, y0 + r * 0.7); ctx.lineTo(px + r * 0.3, y0 + r * 0.4); ctx.lineTo(px, y0 + r * 0.8); ctx.lineTo(px - r * 0.3, y0 + r * 0.4); ctx.lineTo(px - r * 0.8, y0 + r * 0.7); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      default:
        ctx.beginPath(); ctx.arc(px, y0, r, 0, 7); ctx.fill(); ctx.stroke();
        if (e.type === 'goblin') { ctx.beginPath(); ctx.moveTo(px - r * 0.8, y0 - r * 0.3); ctx.lineTo(px - r * 1.5, y0 - r * 0.8); ctx.lineTo(px - r * 0.6, y0 - r * 0.7); ctx.moveTo(px + r * 0.8, y0 - r * 0.3); ctx.lineTo(px + r * 1.5, y0 - r * 0.8); ctx.lineTo(px + r * 0.6, y0 - r * 0.7); ctx.fill(); }
        if (e.type === 'orc' || e.type === 'troll') { ctx.fillStyle = '#f4efe0'; ctx.fillRect(px - r * 0.45, y0 + r * 0.2, r * 0.15, r * 0.3); ctx.fillRect(px + r * 0.3, y0 + r * 0.2, r * 0.15, r * 0.3); }
        if (e.type === 'skeleton') { ctx.fillStyle = '#1b1b22'; ctx.fillRect(px - r * 0.45, y0 - r * 0.2, r * 0.3, r * 0.3); ctx.fillRect(px + r * 0.15, y0 - r * 0.2, r * 0.3, r * 0.3); }
    }
    ctx.fillStyle = e.type === 'wraith' || e.type === 'drake' ? '#ffec6b' : '#1b1b22';
    if (e.type !== 'skeleton') { ctx.beginPath(); ctx.arc(px + f * r * 0.25, y0 - r * 0.15, Math.max(1, r * 0.12), 0, 7); ctx.arc(px + f * r * 0.55, y0 - r * 0.15, Math.max(1, r * 0.12), 0, 7); ctx.fill(); }
    if (e.boss) {
      ctx.fillStyle = '#ffcf3b';
      ctx.beginPath(); ctx.moveTo(px - r * 0.5, y0 - r * 0.9); ctx.lineTo(px - r * 0.3, y0 - r * 1.4); ctx.lineTo(px, y0 - r * 1.0); ctx.lineTo(px + r * 0.3, y0 - r * 1.4); ctx.lineTo(px + r * 0.5, y0 - r * 0.9); ctx.fill();
    }
    if (e.hp < e.maxHp) this.hpBar(ctx, px, py - r * 1.9, s * (e.boss ? 1.4 : 0.8), e);
    if (selected) { ctx.strokeStyle = '#5cc8ff'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py - r * 0.4, r * 2, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  }

  pickAt(x, y, radius = 0.9) {
    let best = null, bd = radius;
    for (const e of this.ents.values()) {
      if (!e.alive && !e.ghost) continue;
      const d = Math.hypot(e.x - x, e.y - 0.35 - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
}
