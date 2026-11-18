// =====================================================================
//  hero.js: the whole of the hero. His choices, his instincts in battle,
//  his voice, his memory and his growth.
//  It runs as the inside of an async function given one thing: KOMIT
//  (the world as he can sense it, his memory, his mind, and the power to
//  build himself a new body).
//
//  He changes himself by evolving. He builds a copy of this code with new
//  genes, or with a new ability grown into the SKILLS section at the bottom.
//  The copy is tested in a sealed sandbox. Then he moves into it, and the old
//  body is deleted. He does not know any of this is code. He feels it as
//  growing.
// =====================================================================

const BODY_VERSION = 1;
const GENES = {"name":"","sex":"m","personality":"curious, stubborn and kind","speakingStyle":"plain, short sentences","dream":"","bravery":0.5,"caution":0.5,"greed":0.4,"kindness":0.6,"sociability":0.5,"romance":0.5,"curiosity":0.6,"potionAt":0.35,"restAt":0.3,"thinkEveryMinutes":3,"growEveryMinutes":12};
// GENES END

const W = KOMIT.world, MEM = KOMIT.memory;
const SKILLS = [];
const MARK_GENES = /^const GENES = \{.*\};\s*$/m;
const MARK_SKILLS_END = '// SKILLS' + ' END';
const roman = n => ['', 'I', 'II', 'III', 'IV', 'V'][n] || String(n);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clip = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const he = () => (GENES.sex === 'f' ? 'she' : 'he');

let plan = null, lastTalkWith = {}, lastThought = 0, lastGrowth = Date.now(), lastDialog = 0, evolving = false, goal = '';
const born = Date.now();
let stats = loadStats();

function loadStats() {
  try { return JSON.parse(localStorage.getItem('komit-hero-stats')) || {}; } catch { return {}; }
}
function saveStats() { try { localStorage.setItem('komit-hero-stats', JSON.stringify(stats)); } catch {} }
function bump(k, v = 1) { stats[k] = (stats[k] || 0) + v; saveStats(); }

// ---------------------------------------------------------------- deciding what to do
function hostiles(me) {
  return W.near(me.sense || 8).filter(o => o.hostile);
}

function decide() {
  const me = W.me();
  if (!me || me.ghost) return { do: 'idle' };
  for (const s of SKILLS) { const r = s.decide && s.decide(me); if (r) return r; }

  const hpR = me.hp / me.maxHp;
  const foes = hostiles(me);
  if (foes.length) {
    const close = foes.filter(f => f.dist < 5);
    const threat = close.reduce((sum, f) => sum + f.power, 0);
    const courage = 0.6 + GENES.bravery - GENES.caution * 0.5;
    if ((hpR < GENES.restAt && me.potions === 0) || threat > me.power * courage * 1.6) {
      plan = null;
      return { do: 'flee', from: (close[0] || foes[0]).id };
    }
    const t = pickTarget(foes, me);
    if (t) return { do: 'fight', target: t.id };
  }
  if (hpR < GENES.restAt + 0.15) return { do: 'rest' };
  if (me.hunger > 0.7) return { do: 'eat' };
  if (me.energy < 0.2 || (me.night && me.energy < 0.45 && GENES.bravery < 0.75)) {
    const far = Math.hypot(me.home.x - me.x, me.home.y - me.y) > 18;
    return far && !foes.length ? { do: 'rest', here: true } : { do: 'rest' };   // camp in the wilds, or sleep at home
  }

  // keep following the plan until it is done
  if (plan && !(me.intentDone && me.intent === plan.do) && Date.now() < plan.until) return plan;

  const wantPotions = 2 + Math.round(GENES.caution * 3);
  if (me.cores > 25 || (me.potions < wantPotions && me.gold >= 15)) return setPlan({ do: 'shop', potions: wantPotions }, 60);

  const q = questPlan(me);
  if (q) return setPlan(q, 90);

  const towns = W.towns();
  const threatened = towns.find(t => t.threat > 0 && t.dist < 40);
  if (threatened && GENES.kindness + GENES.bravery > 0.9 && hpR > 0.6) return setPlan({ do: 'guard', town: threatened.id }, 40);

  if (me.social > 0.8 - GENES.sociability * 0.3) {
    const s = socialPlan(me);
    if (s) return setPlan(s, 40);
  }
  return setPlan(huntPlan(me), 120);
}

function setPlan(it, seconds) { plan = { ...it, until: Date.now() + seconds * 1000 }; return plan; }

function pickTarget(list, me) {
  for (const s of SKILLS) { if (s.chooseTarget) { const id = s.chooseTarget(list, me); if (id) return list.find(x => x.id === id); } }
  const want = new Set(W.quests().filter(q => q.kind === 'hunt').map(q => q.p.type));
  return list.slice().sort((a, b) => score(a) - score(b))[0];
  function score(m) { return m.dist * 8 + m.power * (0.5 + GENES.caution) - (want.has(m.type) || want.has('any') ? 40 : 0); }
}

function chooseTarget(monsters) {
  const me = W.me();
  const t = pickTarget(monsters, me);
  return t ? t.id : 0;
}

function huntPlan(me) {
  const my = me.rank + (GENES.bravery > 0.65 ? 1 : 0) - (GENES.caution > 0.7 ? 1 : 0);
  const rifts = W.rifts().filter(r => r.rank <= Math.max(1, my)).sort((a, b) => (a.dist + a.daysLeft * 5) - (b.dist + b.daysLeft * 5));
  return rifts.length ? { do: 'hunt', rift: rifts[0].id } : { do: 'hunt' };
}

function socialPlan(me) {
  const rel = W.relations().filter(r => r.alive && !r.family);
  const now = Date.now();
  const fresh = r => now - (lastTalkWith[r.id] || 0) > 120000;
  if (!me.partner && GENES.romance > 0.35 && me.age >= 18) {
    const love = rel.find(r => r.single && r.aff > 35 && r.age >= 18 && r.age < 45 && (GENES.sex === 'm' ? r.sex === 'f' : r.sex === 'm') && fresh(r));
    if (love) { lastTalkWith[love.id] = now; return { do: 'court', target: love.id }; }
  }
  const near = W.near(25, 'human').filter(p => !p.hostile && p.type !== 'child');
  const friend = rel.find(r => r.aff > 10 && fresh(r) && near.some(p => p.id === r.id)) || near.find(p => fresh(p));
  if (friend) { lastTalkWith[friend.id] = now; return { do: 'talk', target: friend.id }; }
  return null;
}

function questPlan(me) {
  for (const q of W.quests()) {
    switch (q.kind) {
      case 'hunt': {
        const r = W.rifts().filter(x => q.p.type === 'any' || x.types.includes(q.p.type)).sort((a, b) => a.dist - b.dist)[0];
        if (r && r.rank <= me.rank + 1 + (GENES.bravery > 0.6 ? 1 : 0)) return { do: 'hunt', rift: r.id };
        if (q.p.type === 'wolf' && me.night) return { do: 'hunt' };
        break;
      }
      case 'rift': { const r = W.rifts().filter(x => x.rank >= q.p.rank).sort((a, b) => a.dist - b.dist)[0]; if (r && r.rank <= me.rank + 1) return { do: 'hunt', rift: r.id }; break; }
      case 'level': case 'gold': return huntPlan(me);
      case 'visit': { const t = W.towns()[q.p.town]; if (t) return { do: 'go', x: t.x, y: t.y + 1 }; break; }
      case 'protect': { const t = W.towns()[q.p.town]; if (t) return t.threat ? { do: 'guard', town: t.id } : (t.dist > 6 ? { do: 'go', x: t.x, y: t.y + 1 } : { do: 'guard', town: t.id }); break; }
      case 'friends': case 'partner': { const s = socialPlan({ ...me, partner: q.kind === 'partner' ? 0 : me.partner }); if (s) return s; break; }
      case 'defeat': { const t = W.find(q.p.target); if (t && (t.power < me.power * (1 + GENES.bravery) || me.hp > me.maxHp * 0.8)) return { do: 'fight', target: t.id, lethal: t.kind === 'monster' || t.outlaw }; break; }
    }
  }
  return null;
}

// ---------------------------------------------------------------- instincts in battle
function combat(ctx) {
  for (const s of SKILLS) { const r = s.combat && s.combat(ctx); if (r) return r; }
  const me = ctx.me, hpR = me.hp / me.maxHp;
  if (hpR < GENES.potionAt && me.potions > 0) return 'potion';
  if (hpR < GENES.restAt * 0.8 && me.potions === 0) return 'retreat';
  return 'attack';
}

function passives() {
  const p = {};
  for (const s of SKILLS) {
    const r = s.passive && s.passive();
    if (r) for (const k of Object.keys(r)) p[k] = (p[k] || 0) + (Number(r[k]) || 0);
  }
  return p;
}

function allocate(points) {
  const magic = SKILLS.some(s => s.magic);
  const w = {
    str: 0.3 + GENES.bravery * 0.4, vit: 0.2 + GENES.caution * 0.5, agi: 0.15 + GENES.curiosity * 0.15,
    per: 0.1 + GENES.curiosity * 0.2, int: (magic ? 0.4 : 0.05) + GENES.curiosity * 0.1,
  };
  const total = Object.values(w).reduce((a, b) => a + b, 0), out = {};
  let left = points;
  for (const k of Object.keys(w)) { out[k] = Math.floor(points * w[k] / total); left -= out[k]; }
  const best = Object.keys(w).sort((a, b) => w[b] - w[a]);
  for (let i = 0; left > 0; i++, left--) out[best[i % best.length]]++;
  return out;
}

// ---------------------------------------------------------------- his voice and his mind
function parseLines(text) {
  const notes = [], changes = [], goals = [], keep = [];
  for (const line of String(text).split('\n')) {
    let m = line.match(/^\W*REMEMBER\s*:\s*(.+)$/i);
    if (m) { notes.push(m[1].trim()); continue; }
    m = line.match(/^\W*GOAL\s*:\s*(.+)$/i);
    if (m) { goals.push(m[1].trim()); continue; }
    m = line.match(/^\W*CHANGE\s+([A-Za-z]+)\s*(?:=|to|:)\s*(.+)$/i);
    if (m) { changes.push([m[1], m[2].trim().replace(/^["'`]+|["'`.]+$/g, '')]); continue; }
    keep.push(line);
  }
  return { text: keep.join('\n').trim().replace(/^["']|["']$/g, ''), notes, changes, goals };
}

function abilityNames() { return SKILLS.map(s => (SKILL_LIBRARY[s.id] && SKILL_LIBRARY[s.id].title) || s.id); }

function identity() {
  const me = W.me(), t = W.time(), towns = W.towns(), home = towns[me.town] || towns[0];
  const rel = W.relations().filter(r => r.alive);
  const partner = rel.find(r => r.partner);
  const close = rel.filter(r => r.aff > 40 && !r.partner).slice(0, 4).map(r => r.name);
  const enemies = rel.filter(r => r.aff < -30).slice(0, 3).map(r => r.name);
  const skills = abilityNames();
  const ctx = SKILLS.map(s => s.context && s.context()).filter(Boolean);
  return [
    `You are ${GENES.name}, a ${Math.floor(me.age)}-year-old ${GENES.sex === 'f' ? 'young woman' : 'young man'} who lives in the town of ${home.name}, in a world of towns, wild lands, monsters and rifts that tear open and spill monsters.`,
    'This world is the only world you have ever known. You are a person of this world, like everyone around you.',
    `You are ${GENES.personality}. You speak in ${GENES.speakingStyle}.`,
    GENES.dream ? `What you want most in life: ${GENES.dream}.` : '',
    goal ? `Your current goal: ${goal}.` : '',
    'Some time ago a voice began to speak inside your head. It calls itself the System. Nobody else can hear it. It shows you your level and strength, gives you quests and gifts, and sometimes asks you things. You do not know what it is.',
    `You are a hunter: level ${me.level}, rank ${roman(me.rank)}. Health ${me.hp}/${me.maxHp}. You have ${me.gold} gold and ${me.potions} potions.${skills.length ? ' Skills the System gave you: ' + skills.join(', ') + '.' : ''}`,
    `It is day ${t.day} of year ${t.year}, ${t.clock}${t.night ? ', at night' : ''}. Right now you are ${me.doing}.`,
    partner ? `Your partner is ${partner.name}.` : 'You have no partner.',
    me.children.length ? `You have ${me.children.length} child${me.children.length > 1 ? 'ren' : ''}.` : '',
    close.length ? `People close to you: ${close.join(', ')}.` : '',
    enemies.length ? `People you dislike: ${enemies.join(', ')}.` : '',
    ...ctx,
  ].filter(Boolean).join('\n');
}

function memoriesFor(text) {
  const fmt = rows => rows.map(r => `Day ${r.day} ${r.time}: ${clip(r.content, 160)}`).join('\n');
  const recent = fmt(MEM.recent(6, ['event', 'thought', 'change']));
  const related = fmt(MEM.search(text || '', 4, ['event', 'sys_in', 'sys_out', 'note', 'thought']));
  const notes = fmt(MEM.recent(6, ['note']));
  return `Things you remember well:\n${notes || '(nothing yet)'}\n\nWhat happened lately:\n${recent || '(nothing yet)'}\n\nMemories that may matter now:\n${related || '(none)'}`;
}

async function ask(question, maxTokens = 24, temperature = 0.6, priority = 2) {
  const out = await KOMIT.brain.think([
    { role: 'system', content: identity() },
    { role: 'user', content: question },
  ], { maxTokens, temperature }, null, priority);
  return parseLines(out).text.split('\n')[0].trim();
}

async function absorb(parsed, why) {
  for (const n of parsed.notes) await MEM.add('note', n);
  if (parsed.goals.length) { goal = clip(parsed.goals[0], 80); await MEM.add('note', `My goal: ${goal}`); share(); }
  if (parsed.changes.length) await growFromWords(parsed.changes, why);
}

// The System speaks to him.
KOMIT.on('system', async msg => {
  const mine = msg.kind === 'question' ? 'The System asks you a question.' : msg.kind === 'quest' ? 'The System gives you a quest.' : msg.kind === 'gift' ? 'The System gives you a gift.' : 'The System speaks to you.';
  const wishes = wishesIn(msg.text);
  try {
    const out = await KOMIT.brain.think([
      { role: 'system', content: identity() + '\n\n' + memoriesFor(msg.text) + '\n\nAnswer only as yourself, in first person, in 1 to 3 short sentences. If you learn something important, add a line REMEMBER: <it>. If you set yourself a goal, add a line GOAL: <goal>.' },
      { role: 'user', content: `${mine}\nThe System: "${msg.text}"` },
    ], { maxTokens: 140, temperature: 0.7 }, null, 1);
    const parsed = parseLines(out);
    const reply = parsed.text || '…';
    KOMIT.reply(reply);
    await absorb(parsed, `the System said: "${clip(msg.text, 80)}"`);
  } catch (e) {
    KOMIT.notify(`He could not answer yet (${e.message}).`);
  }
  if (wishes.length) await growFromWords(wishes, `the System told me: "${clip(msg.text, 80)}"`);
});

// What happens to him becomes memory.
KOMIT.on('event', async ev => {
  if (ev.heroText) await MEM.add('event', ev.heroText);
  const me = W.me();
  if (!me) return;
  if (ev.type === 'heroDied') bump('deaths');
  if (ev.type === 'kill' && ev.hero) bump('kills');
  if (ev.type === 'levelup') {
    bump('levels');
    if (ev.level % 5 === 0) { KOMIT.notify(`Evolution available at level ${ev.level}.`); KOMIT.after(4000, () => grow(true)); }
  }
  if (ev.type === 'evolutionGift') grow(true);
  if (ev.type === 'talk' && (ev.a === me.id || ev.b === me.id)) dialog(ev.a === me.id ? ev.b : ev.a, ev.romantic);
  if (['heroRevived', 'partners', 'birth', 'questDone', 'riftClosed', 'death'].includes(ev.type) && ev.heroText !== null && (ev.type !== 'death' || ev.heroText)) {
    KOMIT.after(1500, () => thinkNow(4));
  }
});

async function dialog(otherId, romantic) {
  if (!KOMIT.brain.ready() || Date.now() - lastDialog < 45000) return;
  lastDialog = Date.now();
  const o = W.describe(otherId);
  if (!o || o.kind !== 'human') return;
  const first = o.first || o.name.split(' ')[0];
  try {
    const out = await KOMIT.brain.think([
      { role: 'system', content: identity() },
      { role: 'user', content: `You meet ${o.name}, ${o.age} years old, ${o.job}${o.partner ? ', partner of ' + o.partner : ''}. ${first} is ${o.traits.join(', ')} and feels ${o.mood}. ${first} feels about you: ${o.heroFeeling > 40 ? 'fond of you' : o.heroFeeling < -30 ? 'dislikes you' : 'neutral'}.${romantic ? ' You are drawn to ' + first + '.' : ''}\nWrite a very short exchange: first one line ${first} says, then one line you answer. Use exactly this format:\n${first}: ...\n${GENES.name}: ...` },
    ], { maxTokens: 70, temperature: 0.85 }, null, 3);
    const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
    const theirs = lines.find(l => l.toLowerCase().startsWith(first.toLowerCase() + ':'));
    const mine = lines.find(l => l.toLowerCase().startsWith(GENES.name.toLowerCase() + ':'));
    if (theirs) KOMIT.bubble(otherId, theirs.slice(first.length + 1).trim());
    if (mine) KOMIT.after(1800, () => KOMIT.say(mine.slice(GENES.name.length + 1).trim()));
    if (theirs || mine) await MEM.add('event', `I talked with ${o.name}. ${theirs || ''} ${mine ? '/ I said: ' + mine.slice(GENES.name.length + 1).trim() : ''}`.trim());
  } catch {}
}

async function thinkNow(priority = 4) {
  if (!KOMIT.brain.ready() || evolving) return;
  lastThought = Date.now();
  try {
    const out = await KOMIT.brain.think([
      { role: 'system', content: identity() + '\n\n' + memoriesFor('') },
      { role: 'user', content: 'What are you thinking right now, privately? Write one or two sentences. If you set yourself a new goal, add a line GOAL: <goal>. If you learned something important, add a line REMEMBER: <it>.' },
    ], { maxTokens: 90, temperature: 0.85 }, null, priority);
    const parsed = parseLines(out);
    if (parsed.text) {
      const t = parsed.text.split('\n')[0];
      KOMIT.thought(t);
      KOMIT.say(t);
      await MEM.add('thought', t);
    }
    await absorb(parsed, 'I was thinking about my life');
  } catch {}
}

// What the person clearly asked for, even if his small mind forgets to write CHANGE.
function wishesIn(text) {
  const out = [];
  const m = String(text).match(/(?:call (?:you|yourself)|your name (?:is|will be|should be)|be called)\s+["']?([\p{Lu}][\p{L}-]{1,20})/u);
  if (m) out.push(['name', m[1]]);
  if (/\b(?:be|more) (?:brave|bold|fearless)/i.test(text)) out.push(['bravery', String(Math.min(1, GENES.bravery + 0.2))]);
  if (/\b(?:be|more) (?:careful|cautious)/i.test(text)) out.push(['caution', String(Math.min(1, GENES.caution + 0.2))]);
  if (/\b(?:be|more) (?:kind|gentle)/i.test(text)) out.push(['kindness', String(Math.min(1, GENES.kindness + 0.2))]);
  if (/\b(?:find love|fall in love|find a partner|get married)/i.test(text)) out.push(['romance', String(Math.min(1, GENES.romance + 0.3))]);
  return out;
}

// ---------------------------------------------------------------- evolving (building a new body)
const NUM_RANGE = { bravery: [0, 1], caution: [0, 1], greed: [0, 1], kindness: [0, 1], sociability: [0, 1], romance: [0, 1], curiosity: [0, 1], potionAt: [0.1, 0.7], restAt: [0.1, 0.6], thinkEveryMinutes: [1, 30], growEveryMinutes: [4, 120] };

function coerce(key, value) {
  const now = GENES[key];
  if (typeof now === 'number') {
    const v = parseFloat(value);
    if (!isFinite(v)) return undefined;
    const [lo, hi] = NUM_RANGE[key] || [-1e9, 1e9];
    return Math.round(clamp(v, lo, hi) * 100) / 100;
  }
  if (typeof now === 'boolean') return /^(true|yes|on|1)$/i.test(String(value).trim());
  return clip(String(value).trim(), 120);
}

function newBodySource(genes, addSkillCode) {
  let src = KOMIT.source.replace(MARK_GENES, () => 'const GENES = ' + JSON.stringify(genes) + ';');
  if (addSkillCode) { const end = src.lastIndexOf(MARK_SKILLS_END); src = src.slice(0, end) + addSkillCode + src.slice(end); }
  return src;
}

async function changeSelf(changes, reason, addSkillCode = '', skillTitle = '') {
  if (evolving) return false;
  const genes = { ...GENES }, applied = [];
  for (const [k, v] of changes) {
    const key = Object.keys(GENES).find(g => g.toLowerCase() === String(k).toLowerCase());
    if (!key || key === 'sex') continue;
    const val = coerce(key, v);
    if (val === undefined || val === genes[key]) continue;
    genes[key] = val;
    applied.push(typeof val === 'number' ? `${key} ${val > GENES[key] ? '↑' : '↓'} ${val}` : `${key}: "${val}"`);
  }
  if (skillTitle) applied.push(`new skill: ${skillTitle}`);
  if (!applied.length) return false;
  evolving = true;
  KOMIT.notify(`Evolution in progress: ${applied.join(', ')}…`);
  const res = await KOMIT.evolve(newBodySource(genes, addSkillCode), `${reason} (${applied.join(', ')})`);
  if (!res.ok) {
    evolving = false;
    await MEM.add('thought', `I tried to change, but it did not take hold: ${clip(res.error, 200)}`);
    KOMIT.notify(`Evolution failed: ${clip(res.error, 160)}`);
    return false;
  }
  await MEM.add('change', `I changed. ${applied.join(', ')}. Why: ${reason}`);
  stats = { gold0: W.me().gold }; saveStats();
  KOMIT.rebirth();
  return true;
}

let lastWordsChange = 0;
async function growFromWords(changes, why) {
  if (Date.now() - lastWordsChange < 60000) return;
  lastWordsChange = Date.now();
  await changeSelf(changes, `I decided this because ${why}`);
}

function pickNumber(text, max) {
  const m = String(text).match(/\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
  return n >= 1 && n <= max ? n : 0;
}

let growing = false;
async function grow(manual = false) {
  if (evolving || growing || !KOMIT.brain.ready()) return;
  const me = W.me();
  if (!me || me.ghost) return;
  growing = true;
  try { await growNow(manual, me); } finally { growing = false; }
}
async function growNow(manual, me) {
  lastGrowth = Date.now();
  const changes = [], why = [];
  let skillCode = '', skillTitle = '';
  try {
    // 1. Learn from what life did to me.
    if ((stats.deaths || 0) >= 1) { changes.push(['caution', GENES.caution + 0.1], ['potionAt', GENES.potionAt + 0.05]); why.push(`I died ${stats.deaths} time${stats.deaths > 1 ? 's' : ''}, so I will be more careful`); }
    else if ((stats.kills || 0) >= 8) { changes.push(['bravery', GENES.bravery + 0.08]); why.push(`I won ${stats.kills} fights without dying, so I trust my strength more`); }
    if (me.gold < 30) { changes.push(['greed', GENES.greed + 0.08]); why.push('I am poor, so I care more about gold'); }
    const friends = W.relations().filter(r => r.alive && r.aff > 45).length;
    if (friends < 2 && GENES.sociability < 0.8) { changes.push(['sociability', GENES.sociability + 0.1]); why.push('I am lonely, so I will seek out people'); }
    const speed = KOMIT.brain.speed();
    if (speed > 40 && GENES.thinkEveryMinutes < 10) { changes.push(['thinkEveryMinutes', GENES.thinkEveryMinutes + 2]); why.push('my thoughts are slow, so I think less often to stay sharp'); }
    else if (speed && speed < 10 && GENES.thinkEveryMinutes > 2) { changes.push(['thinkEveryMinutes', GENES.thinkEveryMinutes - 1]); why.push('my thoughts are quick, so I think more often'); }

    // 2. Grow a new skill.
    const missing = Object.keys(SKILL_LIBRARY).filter(id => !SKILLS.some(s => s.id === id));
    if (missing.length) {
      const menu = missing.map((id, i) => `${i + 1}) ${SKILL_LIBRARY[id].title}: ${SKILL_LIBRARY[id].about}`).join('\n');
      const answer = await ask(`The System offers you one new skill. You may choose:\n${menu}\nWhich one do you want most? Answer with only the number.`, 6, 0.7);
      let n = pickNumber(answer, missing.length);
      const chose = !!n;
      if (!n) n = 1 + Math.floor(Math.random() * missing.length);
      const id = missing[n - 1];
      skillCode = `SKILLS.push((${SKILL_LIBRARY[id].make.toString()})());\n`;
      skillTitle = SKILL_LIBRARY[id].title;
      why.push(chose ? `I chose ${skillTitle}` : `I was drawn to ${skillTitle}`);
    }

    // 3. Become someone.
    const growths = MEM.recent(500, ['change']).length;
    if (growths % 3 === 1) {
      const w = (await ask(`Think about everything you have lived.\n${memoriesFor('')}\nDescribe your own character in 3 to 6 words. Answer with only the words.`, 20, 0.8)).replace(/[.!"]/g, '').trim();
      if (w.split(/\s+/).length >= 2 && w.split(/\s+/).length <= 10 && !/\bAI\b|assistant|language model|program/i.test(w)) { changes.push(['personality', w]); why.push('I see who I am becoming'); }
    } else if (growths % 3 === 2 || !GENES.dream) {
      const d = (await ask('What do you want most in your life? Answer in 3 to 8 words only.', 20, 0.8)).replace(/[."]/g, '').trim();
      if (d.split(/\s+/).length >= 2 && d.split(/\s+/).length <= 12 && !/\bAI\b|assistant|language model|program/i.test(d)) { changes.push(['dream', d]); why.push('I know what I want'); }
    }
  } catch (e) {
    console.warn('growth failed', e);
  }
  if (changes.length || skillCode) await changeSelf(changes, why.join('; ') || 'I felt myself grow', skillCode, skillTitle);
  else if (manual) KOMIT.notify('He searched himself and found nothing to change right now.');
}

// ---------------------------------------------------------------- skills he can grow
// Each skill is real code. When he grows one, its code is copied into the SKILLS
// section at the bottom of his body, and he wakes up in a new body that has it.
const SKILL_LIBRARY = {
  fireBolt: {
    title: 'Fire Bolt', about: 'hurl fire at enemies from a distance',
    make: function () {
      return { id: 'fireBolt', magic: true, combat(ctx) { if (ctx.me.mp >= 8 && (ctx.target.dist > 1.6 || Math.random() < 0.45)) return { cast: 'firebolt' }; return null; } };
    },
  },
  secondWind: {
    title: 'Second Wind', about: 'heal your own wounds in the middle of a fight',
    make: function () {
      return { id: 'secondWind', magic: true, combat(ctx) { if (ctx.me.hp < ctx.me.maxHp * 0.5 && ctx.me.mp >= 10) return { cast: 'heal' }; return null; } };
    },
  },
  arcaneShield: {
    title: 'Arcane Shield', about: 'raise a shield when many enemies surround you',
    make: function () {
      return { id: 'arcaneShield', magic: true, combat(ctx) { if (ctx.enemies.length >= 2 && ctx.me.mp >= 12 && !ctx.me.shield) return { cast: 'shield' }; return null; } };
    },
  },
  quickStep: {
    title: 'Quick Step', about: 'move faster, and dash away from death',
    make: function () {
      return {
        id: 'quickStep',
        passive() { return { spd: 0.1 }; },
        combat(ctx) { if (ctx.me.hp < ctx.me.maxHp * 0.3 && ctx.me.mp >= 5) return { cast: 'dash' }; return null; },
      };
    },
  },
  ironSkin: {
    title: 'Iron Skin', about: 'your skin hardens against blows',
    make: function () { return { id: 'ironSkin', passive() { return { def: 0.25 }; } }; },
  },
  bloodFrenzy: {
    title: 'Blood Frenzy', about: 'hit harder, even harder when you are hurt',
    make: function () {
      return { id: 'bloodFrenzy', passive() { const me = W.me(); return { atk: 0.1 + (me && me.hp < me.maxHp * 0.5 ? 0.25 : 0) }; } };
    },
  },
  hunterSense: {
    title: "Hunter's Sense", about: 'sense monsters from far away and pick the weakest',
    make: function () {
      return {
        id: 'hunterSense',
        passive() { return { sense: 0.3 }; },
        chooseTarget(list) { const s = list.slice().sort((a, b) => a.power - b.power); return s[0] ? s[0].id : 0; },
      };
    },
  },
  tactician: {
    title: 'Tactician', about: 'know when to step back from a losing fight',
    make: function () {
      return {
        id: 'tactician',
        combat(ctx) { if (ctx.enemies.length >= 3 && ctx.me.hp < ctx.me.maxHp * 0.6) return 'retreat'; return null; },
        context() { return 'You think carefully before every fight.'; },
      };
    },
  },
  guardian: {
    title: 'Guardian', about: 'rush to protect towns when monsters come',
    make: function () {
      return {
        id: 'guardian',
        decide(me) {
          if (me.hp < me.maxHp * 0.5) return null;
          const t = W.towns().find(x => x.threat > 0 && x.dist < 45);
          return t ? { do: 'guard', town: t.id } : null;
        },
        context() { return 'You feel a deep need to protect the townsfolk.'; },
      };
    },
  },
  tradersTongue: {
    title: "Trader's Tongue", about: 'sell for more and buy better gear',
    make: function () {
      return {
        id: 'tradersTongue',
        passive() { return { gold: 0.3 }; },
        decide(me) {
          const tier = Math.min(me.weapon, me.armor) + 1;
          if (me.gold > 60 * tier * tier + 40 && me.hp > me.maxHp * 0.7 && W.near(8).every(o => !o.hostile)) return { do: 'shop', gear: true, potions: 3 };
          return null;
        },
      };
    },
  },
  charm: {
    title: 'Charm', about: 'people warm to you quickly',
    make: function () { return { id: 'charm', passive() { return { social: 0.5 }; } }; },
  },
  keenMind: {
    title: 'Keen Mind', about: 'learn faster from every battle',
    make: function () { return { id: 'keenMind', passive() { return { xp: 0.2 }; } }; },
  },
};

// ---------------------------------------------------------------- skills he has grown
// SKILLS START
// SKILLS END

function share() {
  KOMIT.setInfo({ abilities: abilityNames(), personality: GENES.personality, dream: GENES.dream, goal });
}

// ---------------------------------------------------------------- self-test (every new body must pass it)
async function selftest() {
  const ok = (c, what) => { if (!c) throw new Error('self-test failed: ' + what); };
  const p = parseLines('I am fine.\nREMEMBER: wolves hunt at night\nGOAL: reach level 10\nCHANGE bravery = 0.8');
  ok(p.text === 'I am fine.' && p.notes[0] === 'wolves hunt at night' && p.goals[0] === 'reach level 10' && p.changes[0][0] === 'bravery', 'reading my own words');
  ok(wishesIn('from now on I will call you Arden')[0][1] === 'Arden', 'hearing wishes');
  ok(typeof identity() === 'string' && identity().length > 100, 'knowing who I am');
  for (const k of Object.keys(GENES)) if (k !== 'sex') ok(coerce(k, String(GENES[k])) !== undefined, 'gene ' + k);
  ok(MARK_GENES.test(KOMIT.source), 'finding my genes');
  ok(KOMIT.source.lastIndexOf(MARK_SKILLS_END) > KOMIT.source.indexOf('// SKILLS' + ' START'), 'finding my skills');
  ok(new Set(SKILLS.map(s => s.id)).size === SKILLS.length, 'no skill grown twice');
  const valid = new Set(['fight', 'hunt', 'guard', 'flee', 'rest', 'eat', 'shop', 'work', 'talk', 'court', 'follow', 'go', 'explore', 'wander', 'idle']);
  for (let i = 0; i < 5; i++) { const it = decide(); ok(it && valid.has(it.do), 'deciding (' + JSON.stringify(it) + ')'); }
  plan = null;
  const ctx = { me: W.me(), target: W.near(8, 'monster')[0], enemies: W.near(8, 'monster'), allies: [] };
  const a = combat(ctx);
  ok(a === 'attack' || a === 'potion' || a === 'retreat' || (a && a.cast), 'fighting');
  const al = allocate(7);
  ok(Object.values(al).reduce((x, y) => x + y, 0) === 7, 'growing stronger');
  for (const v of Object.values(passives())) ok(isFinite(v), 'passive numbers');
  ok(chooseTarget(W.near(8, 'monster')) > 0, 'choosing a target');
  for (const id of Object.keys(SKILL_LIBRARY)) {
    const s = SKILL_LIBRARY[id].make();
    ok(s.id === id, 'skill id ' + id);
    if (s.combat) { const r = s.combat(ctx); ok(r === null || r === 'attack' || r === 'potion' || r === 'retreat' || (r && r.cast), 'skill combat ' + id); }
    if (s.passive) for (const v of Object.values(s.passive())) ok(isFinite(v), 'skill passive ' + id);
    if (s.decide) { const r = s.decide(W.me()); ok(r === null || valid.has(r.do), 'skill decide ' + id); }
    if (s.chooseTarget) s.chooseTarget(W.near(8, 'monster'), W.me());
    if (s.context) ok(typeof s.context() === 'string', 'skill context ' + id);
  }
  ok(newBodySource(GENES, '// x\n').includes('// x\n' + MARK_SKILLS_END), 'growing code');
  const t = parseLines(await KOMIT.brain.think([{ role: 'user', content: 'test' }], {}, null, 1));
  ok(typeof t.text === 'string', 'thinking');
  KOMIT.report(true);
}

// ---------------------------------------------------------------- life
function main() {
  KOMIT.setMind({ decide, combat, passives, allocate, chooseTarget });
  KOMIT.alive();
  share();
  const g = KOMIT.generation;
  if (g.firstWake && g.n > 1) {
    KOMIT.notify(`Evolution complete. ${GENES.name} awakens in body ${g.n}.`);
    MEM.add('change', `I woke up changed. ${g.reason}`);
    KOMIT.after(2500, () => thinkNow(3));
  } else if (g.firstWake) {
    KOMIT.notify(`The System is now connected to ${GENES.name}. Only ${he()} can hear you.`);
    MEM.add('event', 'A voice began to speak to me. It calls itself the System. Nobody else can hear it.');
  }
  KOMIT.every(15000, () => {
    if (evolving) return;
    if (Date.now() - lastThought > GENES.thinkEveryMinutes * 60000) thinkNow(4);
    if (Date.now() - lastGrowth > GENES.growEveryMinutes * 60000 && Date.now() - born > 120000) {
      const me = W.me();
      if (me && !me.ghost && !W.near(8).some(o => o.hostile)) grow();
    }
  });
}

if (KOMIT.testing) { await selftest(); return; }
main();
