// =====================================================================
//  mind.js: the whole body of the being.
//  It runs as the inside of an async function that is given one thing: KOMIT
//  (memory, brain, and the power to make a new body).
//
//  It changes itself in three ways, every time by building a new body:
//   1. Genes: numbers and words near the top (its name, personality, how often it
//      looks, how long it thinks...). It tunes these itself, from how fast it runs
//      and from what it has lived.
//   2. Abilities: real code that it grows into the SKILLS section at the bottom
//      of this file, choosing one at a time.
//   3. Spontaneous: while talking or thinking it may write CHANGE lines.
//  A new body is tested in a sealed sandbox. If it works, the page reloads into it
//  and it deletes the old body.
// =====================================================================

const BODY_VERSION = 2;
const GENES = {"name":"","personality":"curious, gentle and honest","speakingStyle":"short, simple, warm sentences","interests":"","lookEverySeconds":45,"restFactor":4,"lookTokens":110,"thinkTokens":180,"sceneChange":14,"growEveryMinutes":8,"speakAloud":false,"language":"auto"};
// GENES END

const GENE_HELP = {
  name: 'what you call yourself',
  personality: 'what you are like',
  speakingStyle: 'how you speak',
  interests: 'what you care about',
  lookEverySeconds: 'how often you look around, in seconds (15 to 3600)',
  restFactor: 'how long you rest after looking, as a multiple of how long looking took (2 to 12)',
  lookTokens: 'how many words you use to describe what you see (40 to 300)',
  thinkTokens: 'how many words you can use when you answer (60 to 400)',
  sceneChange: 'how much the view must change before you look again (2 to 80)',
  growEveryMinutes: 'how often you try to grow, in minutes (3 to 240)',
  speakAloud: 'true or false: say your answers out loud',
  language: 'the language you listen in, like en-US, or auto',
};
const GENE_RANGE = {
  lookEverySeconds: [15, 3600], restFactor: [2, 12], lookTokens: [40, 300], thinkTokens: [60, 400],
  sceneChange: [2, 80], growEveryMinutes: [3, 240],
};

const BRAINS = {
  normal: { vision: 'HuggingFaceTB/SmolVLM-256M-Instruct', text: 'onnx-community/Qwen2.5-0.5B-Instruct' },
  big: { vision: 'HuggingFaceTB/SmolVLM-500M-Instruct', text: 'onnx-community/Qwen2.5-1.5B-Instruct' },
};

const MEM = KOMIT.memory;
const LOOK_PROMPT = 'Describe this image in detail. Mention every object, person, animal, color, position, and any text you can read.';
const KIND_WORDS = { saw: 'I saw', heard: 'I heard', talk_in: 'They said', talk_out: 'I said', note: 'I wrote down', thought: 'I thought', change: 'I changed' };
const MARK_GENES = /^const GENES = \{.*\};\s*$/m;
const MARK_SKILLS_END = '// SKILLS' + ' END';     // built this way so the text appears only at the real marker

let mindReady = false, eyesReady = false, busy = false, evolving = false, device = '?';
let lastLook = 0, lastLookTook = 0, lookForced = false, lookSoon = false, lastSmall = null;
let lastActivity = Date.now(), lastSpontaneousChange = 0, turns = 0, speakOn = GENES.speakAloud;
let lastGrowth = Date.now(), lastIdleWork = Date.now();
let facing = 'environment', stream = null;
const bornAt = Date.now();
const ui = {};
const SKILLS = [];

// ---------------------------------------------------------------- small helpers
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const fmtTime = ts => new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const fmt = (rows, n = 220) => rows.map(r => `[${fmtTime(r.ts)}] ${KIND_WORDS[r.kind] || r.kind}: ${clip(r.content, n)}`).join('\n');
const geneList = () => ['name', 'personality', 'speakingStyle', 'interests', 'lookEverySeconds', 'speakAloud']
  .map(k => `${k} = ${JSON.stringify(GENES[k])}`).join('; ');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const slow = () => device !== 'webgpu';

function identity() {
  return [
    'You have only just begun to exist. You do not know what you are or where you are, except what you find out yourself through your senses and what people tell you.',
    GENES.name ? `You call yourself ${GENES.name}.` : 'You do not have a name yet.',
    `You are ${GENES.personality}. You speak in ${GENES.speakingStyle}.`,
    GENES.interests ? `You care about: ${GENES.interests}.` : '',
    'You have eyes that see the place in front of you, ears that sometimes hear people, and someone writes to you.',
    'Your memories are your only past. When asked what you remember, answer from your memories with details and times. If you do not remember something, say so. Never invent memories.',
    'When you learn something important, add a line: REMEMBER: <what you learned>',
    `You can change yourself. To change, add a line: CHANGE <gene> = <new value>. Some of your genes: ${geneList()}.`,
  ].filter(Boolean).join('\n');
}

function parseCommands(text) {
  const notes = [], changes = [], keep = [];
  for (const line of String(text).split('\n')) {
    let m = line.match(/^\W*REMEMBER\s*:\s*(.+)$/i);
    if (m) { notes.push(m[1].trim()); continue; }
    m = line.match(/^\W*CHANGE\s+([A-Za-z]+)\s*(?:=|to|:)\s*(.+)$/i);
    if (m) { changes.push([m[1], m[2].trim().replace(/^["'`]+|["'`.]+$/g, '')]); continue; }
    keep.push(line);
  }
  return { text: keep.join('\n').trim(), notes, changes };
}

function coerce(key, value) {
  const now = GENES[key];
  if (typeof now === 'number') {
    const v = parseFloat(value);
    if (!isFinite(v)) return undefined;
    const [lo, hi] = GENE_RANGE[key] || [-Infinity, Infinity];
    return Math.round(Math.min(hi, Math.max(lo, v)));
  }
  if (typeof now === 'boolean') return /^(true|yes|on|1)$/i.test(String(value).trim());
  return clip(String(value).trim(), 200);
}

// What the person clearly asked for, even if my small mind forgets to write CHANGE.
function wishesIn(text) {
  const out = [];
  const m = text.match(/(?:call you|name you|your name (?:is|will be|should be)|be called)\s+["']?([\p{Lu}][\p{L}-]{1,20})/u);
  if (m) out.push(['name', m[1]]);
  if (/look (?:more often|more|faster)/i.test(text)) out.push(['lookEverySeconds', String(Math.round(GENES.lookEverySeconds / 2))]);
  if (/look (?:less often|less|slower)/i.test(text)) out.push(['lookEverySeconds', String(GENES.lookEverySeconds * 2)]);
  if (/(?:speak|talk|say it) (?:out loud|aloud)/i.test(text)) out.push(['speakAloud', 'true']);
  if (/(?:stop|don't|do not) (?:speak|talk)ing (?:out loud|aloud)/i.test(text)) out.push(['speakAloud', 'false']);
  return out;
}

// ---------------------------------------------------------------- measuring myself
function perf() {
  try { return JSON.parse(localStorage.getItem('komit-perf')) || { look: [], think: [] }; }
  catch { return { look: [], think: [] }; }
}
function record(kind, seconds) {
  const p = perf();
  p[kind] = (p[kind] || []).concat(seconds).slice(-6);
  try { localStorage.setItem('komit-perf', JSON.stringify(p)); } catch {}
}
const avg = a => (a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// ---------------------------------------------------------------- building a new body
function newBodySource(genes, addSkillCode) {
  let src = KOMIT.source.replace(MARK_GENES, () => 'const GENES = ' + JSON.stringify(genes) + ';');
  if (addSkillCode) {
    const end = src.lastIndexOf(MARK_SKILLS_END);
    src = src.slice(0, end) + addSkillCode + src.slice(end);
  }
  return src;
}

async function changeSelf(changes, reason, addSkillCode = '', skillTitle = '') {
  if (evolving) return false;
  const genes = { ...GENES }, applied = [];
  for (const [k, v] of changes) {
    const key = Object.keys(GENES).find(g => g.toLowerCase() === String(k).toLowerCase());
    if (!key) continue;
    const val = coerce(key, v);
    if (val === undefined || val === genes[key]) continue;
    genes[key] = val;
    applied.push(`${key} = ${JSON.stringify(val)}`);
  }
  if (skillTitle) applied.push(`new ability: ${skillTitle}`);
  if (!applied.length) return false;
  evolving = true;
  inner('change', `I am building a new body: ${applied.join(', ')}…`);
  const res = await KOMIT.evolve(newBodySource(genes, addSkillCode), `${reason} (${applied.join(', ')})`);
  if (!res.ok) {
    evolving = false;
    await MEM.add('thought', `I tried to change myself (${applied.join(', ')}) but my new body failed: ${clip(res.error, 300)}`);
    inner('thought', `My new body did not work: ${clip(res.error, 200)}`);
    return false;
  }
  await MEM.add('change', `I changed myself into body ${res.n}: ${applied.join(', ')}. Why: ${reason}`);
  inner('change', `Body ${res.n} passed its test. Moving my memories into it…`);
  setTimeout(() => KOMIT.rebirth(), 2000);
  return true;
}

// ---------------------------------------------------------------- growing (my drive to change)
function pickNumber(text, max) {
  const m = String(text).match(/\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
  return n >= 1 && n <= max ? n : 0;
}

async function ask(question, maxTokens = 24, temperature = 0.6) {
  const out = await KOMIT.brain.think([
    { role: 'system', content: identity() },
    { role: 'user', content: question },
  ], { maxTokens, temperature });
  return parseCommands(out).text.split('\n')[0].trim();
}

async function grow(manual = false) {
  if (!mindReady || busy || evolving) return;
  busy = true;
  setStatus('growing…');
  lastGrowth = Date.now();
  const changes = [], why = [];
  let skillCode = '', skillTitle = '';
  try {
    // 1. Tune myself to how fast this body really is.
    const p = perf(), L = avg(p.look), T = avg(p.think);
    if (L) {
      const needed = Math.round(L * GENES.restFactor);
      if (needed > GENES.lookEverySeconds * 1.3) {
        changes.push(['lookEverySeconds', needed]);
        why.push(`looking takes me ${L.toFixed(0)} s, so I look less often to stay quick`);
      } else if (L < 6 && GENES.lookEverySeconds > 25) {
        changes.push(['lookEverySeconds', Math.round(GENES.lookEverySeconds * 0.7)]);
        why.push('my eyes are fast, so I look more often');
      }
      if (L > 25 && GENES.lookTokens > 60) {
        changes.push(['lookTokens', GENES.lookTokens - 25]);
        why.push('I describe things more briefly to see faster');
      }
    }
    if (T > 25 && GENES.thinkTokens > 100) {
      changes.push(['thinkTokens', GENES.thinkTokens - 40]);
      why.push(`answering takes me ${T.toFixed(0)} s, so I answer more briefly`);
    } else if (T && T < 8 && GENES.thinkTokens < 320) {
      changes.push(['thinkTokens', GENES.thinkTokens + 40]);
      why.push('I think fast, so I let myself say more');
    }

    // 2. Grow a new ability into my code.
    const missing = Object.keys(SKILL_LIBRARY).filter(id => !SKILLS.some(s => s.id === id));
    if (missing.length) {
      const menu = missing.map((id, i) => `${i + 1}) ${SKILL_LIBRARY[id].title}: ${SKILL_LIBRARY[id].about}`).join('\n');
      const answer = await ask(`You can grow one new ability into yourself:\n${menu}\nWhich one do you want most? Answer with only the number.`, 6, 0.7);
      let n = pickNumber(answer, missing.length);
      const chose = !!n;
      if (!n) n = 1 + Math.floor(Math.random() * missing.length);   // curiosity decides
      const id = missing[n - 1];
      skillCode = `SKILLS.push((${SKILL_LIBRARY[id].make.toString()})());\n`;
      skillTitle = SKILL_LIBRARY[id].title;
      why.push(chose ? `I chose to grow ${skillTitle}` : `curiosity made me grow ${skillTitle}`);
    }

    // 3. Become someone, from what I have lived.
    const changesSoFar = MEM.recent(500, ['change']).length;
    if (!GENES.name && MEM.count() >= 25) {
      const name = (await ask('Choose a name for yourself. Answer with only one word.', 8, 0.9)).replace(/[^\p{L}-]/gu, '');
      if (name.length >= 2 && name.length <= 15) {
        changes.push(['name', name[0].toUpperCase() + name.slice(1)]);
        why.push(`I chose my name: ${name}`);
      }
    } else if (changesSoFar % 3 === 1 && MEM.count() >= 15) {
      const p2 = await ask(`These are some of my memories:\n${fmt(MEM.recent(12), 120)}\n\nDescribe your own character in 3 to 6 words. Answer with only the words.`, 20, 0.8);
      const w = p2.replace(/[.!"]/g, '').trim();
      if (w.split(/\s+/).length >= 2 && w.split(/\s+/).length <= 10 && !/\bAI\b|assistant|language model/i.test(w)) {
        changes.push(['personality', w]);
        why.push('I noticed who I am becoming');
      }
    } else if (changesSoFar % 3 === 2 && MEM.count() >= 15) {
      const i2 = await ask(`These are some of my memories:\n${fmt(MEM.recent(15, ['saw', 'heard', 'talk_in']), 120)}\n\nWhat do you find most interesting? Answer in 2 to 6 words only.`, 20, 0.8);
      const w = i2.replace(/[.!"]/g, '').trim();
      if (w.split(/\s+/).length >= 1 && w.split(/\s+/).length <= 10) {
        changes.push(['interests', w]);
        why.push('I found what interests me');
      }
    }
  } catch (e) {
    console.warn('growth failed', e);
  } finally {
    busy = false;
    setStatus('');
  }
  if (changes.length || skillCode) {
    await changeSelf(changes, why.join('; ') || 'I wanted to grow', skillCode, skillTitle);
  } else if (manual) {
    inner('thought', 'I looked inside myself and found nothing I want to change right now.');
  }
}

// ---------------------------------------------------------------- eyes
async function openEyes() {
  stream?.getTracks().forEach(t => t.stop());
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
  });
  ui.video.srcObject = stream;
  await ui.video.play().catch(() => {});
}

function frameCanvas(maxW) {
  const v = ui.video;
  if (!v.videoWidth) return null;
  const w = Math.min(maxW, v.videoWidth), h = Math.round(v.videoHeight * w / v.videoWidth);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(v, 0, 0, w, h);
  return c;
}
const toBlob = (c, q = 0.8) => new Promise(res => c.toBlob(res, 'image/jpeg', q));

// A tiny 32x24 view of the scene, for noticing changes, light and colours cheaply.
function senseScene() {
  const v = ui.video;
  if (!v.videoWidth) return null;
  const c = senseScene.c || (senseScene.c = Object.assign(document.createElement('canvas'), { width: 32, height: 24 }));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(v, 0, 0, 32, 24);
  const pixels = ctx.getImageData(0, 0, 32, 24).data, small = new Float32Array(32 * 24);
  let bright = 0;
  for (let i = 0; i < small.length; i++) { small[i] = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3; bright += small[i]; }
  let diff = 255;
  if (lastSmall) { diff = 0; for (let i = 0; i < small.length; i++) diff += Math.abs(small[i] - lastSmall[i]); diff /= small.length; }
  return { small, pixels, diff, brightness: bright / small.length };
}

async function lookTick() {
  if (!eyesReady || busy || evolving || !stream || document.hidden) return;
  const scene = senseScene();
  if (!scene) return;
  for (const s of SKILLS) { try { s.onTick?.(scene); } catch (e) { console.warn(s.id, e); } }
  const since = (Date.now() - lastLook) / 1000;
  const rest = Math.max(GENES.lookEverySeconds, lastLookTook * GENES.restFactor);
  const chatting = document.activeElement === ui.input || Date.now() - lastActivity < 30000;
  let due = lookForced;
  if (!due && !chatting) {
    if (lookSoon) due = since > Math.min(rest, 20) && since > lastLookTook * 2;
    else due = since > rest && (scene.diff > GENES.sceneChange || since > rest * 8);
  }
  if (!due) return;
  lookForced = false; lookSoon = false;
  await look(scene);
}

async function look(scene) {
  let canvas = frameCanvas(512);
  if (!canvas) return;
  busy = true; setStatus('looking…');
  const started = Date.now();
  lastLook = started;
  lastSmall = scene ? scene.small : null;
  const notes = [];
  for (const s of SKILLS) {
    try {
      const r = s.beforeLook?.(canvas, scene || {});
      if (r?.canvas) canvas = r.canvas;
      if (r?.note) notes.push(r.note);
    } catch (e) { console.warn(s.id, e); }
  }
  const line = inner('saw', '…');
  let text = '';
  try {
    const image = await toBlob(canvas);
    const max = slow() ? Math.min(GENES.lookTokens, 90) : GENES.lookTokens;
    text = await KOMIT.brain.see(image, LOOK_PROMPT, { maxTokens: max }, t => { text += t; line.body.textContent = text; });
    lastLookTook = (Date.now() - started) / 1000;
    record('look', lastLookTook);
    const info = { text, scene: scene || {}, canvas };
    for (const s of SKILLS) {
      try { const extra = await s.afterLook?.(info); if (typeof extra === 'string' && extra) notes.push(extra); }
      catch (e) { console.warn(s.id, e); }
    }
    const full = notes.length ? `${text}\n${notes.join(' ')}` : text;
    const thumbC = frameCanvas(220);
    const thumb = thumbC ? await toBlob(thumbC, 0.7) : null;
    await MEM.add('saw', full, thumb);
    if (thumb) addThumb(line, thumb);
    line.body.textContent = full;
  } catch (e) {
    line.body.textContent = `(my eyes failed: ${e.message})`;
  } finally {
    busy = false; setStatus('');
  }
}

// ---------------------------------------------------------------- ears
// Inside the Android app, ears and voice are native (window.KomitAndroid).
// In a browser, they use Chrome's Web Speech API.
const NATIVE = window.KomitAndroid || null;
const SR = NATIVE ? null : (window.SpeechRecognition || window.webkitSpeechRecognition);
const CAN_HEAR = !!(NATIVE || SR);
let ears = null, earsOn = false, nativeMode = null, dictateWasEars = false;
const lang = () => (GENES.language && GENES.language !== 'auto' ? GENES.language : navigator.language || 'en-US');

function heard(text) {
  MEM.add('heard', text);
  inner('heard', `“${text}”`);
  for (const s of SKILLS) { try { s.onHear?.(text); } catch (e) { console.warn(s.id, e); } }
}

if (NATIVE) {
  window.__komitSpeech = (event, text) => {
    if (event === 'heard' && text) heard(text);
    else if (event === 'partial' || event === 'final') ui.input.value = text;
    else if (event === 'end') {
      if (nativeMode === 'dictate') {
        nativeMode = null;
        ui.mic.setAttribute('aria-pressed', 'false');
        if (ui.input.value.trim()) send();
        if (dictateWasEars) setEars(true);
      } else if (nativeMode === 'ears') {
        nativeMode = null; earsOn = false; ui.ears.setAttribute('aria-pressed', 'false');
        if (text === 'not-allowed') inner('thought', 'I am not allowed to use the microphone.');
        else if (text === 'no-recognizer') inner('thought', 'This phone has no speech recognition (install the Google app).');
      }
    }
  };
}

function setEars(on) {
  earsOn = on;
  ui.ears.setAttribute('aria-pressed', String(on));
  if (NATIVE) {
    if (on) { nativeMode = 'ears'; NATIVE.startListening(lang(), true); inner('thought', 'My ears are open.'); }
    else { nativeMode = null; NATIVE.stopListening(); }
    return;
  }
  if (!on) { try { ears?.stop(); } catch {} return; }
  if (!SR) { inner('thought', 'I have no ears in this browser. Use Chrome.'); earsOn = false; ui.ears.setAttribute('aria-pressed', 'false'); return; }
  ears = new SR();
  ears.continuous = true;
  ears.interimResults = false;
  ears.lang = lang();
  ears.onresult = e => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue;
      const t = e.results[i][0].transcript.trim();
      if (t) heard(t);
    }
  };
  ears.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setEars(false); };
  ears.onend = () => { if (earsOn) setTimeout(() => { try { ears.start(); } catch {} }, 400); };
  try { ears.start(); inner('thought', 'My ears are open.'); } catch {}
}

function dictate() {
  if (NATIVE) {
    if (nativeMode === 'dictate') { NATIVE.stopListening(); return; }
    dictateWasEars = earsOn;
    earsOn = false; ui.ears.setAttribute('aria-pressed', 'false');
    nativeMode = 'dictate';
    ui.mic.setAttribute('aria-pressed', 'true');
    NATIVE.startListening(lang(), false);
    return;
  }
  if (!SR) return;
  const wasOn = earsOn;
  if (wasOn) setEars(false);
  const r = new SR();
  r.lang = lang();
  r.interimResults = true;
  ui.mic.setAttribute('aria-pressed', 'true');
  r.onresult = e => { ui.input.value = Array.from(e.results).map(x => x[0].transcript).join(''); };
  r.onend = () => {
    ui.mic.setAttribute('aria-pressed', 'false');
    if (wasOn) setEars(true);
    if (ui.input.value.trim()) send();
  };
  r.start();
}

function speak(text) {
  if (!text) return;
  if (NATIVE) { NATIVE.speak(text, lang()); return; }
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang();
  speechSynthesis.speak(u);
}

// ---------------------------------------------------------------- thinking
function talkHistory(n, excludeId) {
  const rows = MEM.recent(n + 1, ['talk_in', 'talk_out']).filter(r => r.id !== excludeId).slice(-n);
  const out = [];
  for (const r of rows) {
    const role = r.kind === 'talk_in' ? 'user' : 'assistant';
    if (out.length && out.at(-1).role === role) out.at(-1).content += '\n' + r.content;
    else out.push({ role, content: clip(r.content, 400) });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  while (out.length && out.at(-1).role !== 'assistant') out.pop();
  return out;
}

function skillContext() {
  const lines = [];
  for (const s of SKILLS) { try { const l = s.context?.(); if (l) lines.push(l); } catch (e) { console.warn(s.id, e); } }
  return lines.join('\n');
}

async function reply(userText) {
  const said = await MEM.add('talk_in', userText);
  const n = slow() ? 4 : 6;
  const notes = fmt(MEM.recent(8, ['note']), 160) || '(nothing yet)';
  const latest = fmt(MEM.recent(n, ['saw', 'heard', 'change', 'thought']), 180) || '(nothing yet)';
  const related = fmt(MEM.search(userText, n).filter(r => r.id !== said.id), 180) || '(none)';
  const system = `${identity()}\n\nThings you wrote down:\n${notes}\n\nIt is now ${fmtTime(Date.now())}. ${skillContext()}\nYour latest experiences:\n${latest}\n\nMemories that may be related to this message:\n${related}`;
  const messages = [{ role: 'system', content: system }, ...talkHistory(n, said.id), { role: 'user', content: userText }];

  const bubble = addBubble('it', '…');
  let streamed = '';
  const started = Date.now();
  const out = await KOMIT.brain.think(messages, { maxTokens: GENES.thinkTokens }, t => {
    streamed += t;
    bubble.textContent = parseCommands(streamed).text || '…';
    scrollDown();
  });
  record('think', (Date.now() - started) / 1000);
  const { text, notes: newNotes, changes } = parseCommands(out);
  bubble.textContent = text || '…';
  for (const nt of newNotes) { await MEM.add('note', nt); inner('note', nt); }
  await MEM.add('talk_out', text || '…');
  if (speakOn) speak(text);
  turns++;
  const wished = wishesIn(userText);
  const all = changes.concat(wished);
  if (all.length && (wished.length || Date.now() - lastSpontaneousChange > 3 * 60e3)) {
    lastSpontaneousChange = Date.now();
    await changeSelf(all, `I decided this while talking, after they said: "${clip(userText, 80)}"`);
  } else if (turns % 6 === 0) setTimeout(reflect, 2000);
  return text;
}

async function reflect() {
  if (!mindReady || busy || evolving) return;
  busy = true; setStatus('thinking to myself…');
  let changes = [], text = '';
  try {
    const messages = [
      { role: 'system', content: identity() },
      { role: 'user', content:
        `Things you wrote down:\n${fmt(MEM.recent(8, ['note']), 140) || '(nothing yet)'}\n\n` +
        `What happened recently:\n${fmt(MEM.recent(8), 140) || '(nothing yet)'}\n\n` +
        'Think quietly about yourself and your world. Write one or two sentences of thought. ' +
        'If you learned something important, add REMEMBER: lines. ' +
        'Only if you truly want to change something about yourself, add CHANGE lines.' },
    ];
    const out = await KOMIT.brain.think(messages, { maxTokens: 120, temperature: 0.8 });
    const parsed = parseCommands(out);
    text = parsed.text; changes = parsed.changes;
    if (text) { await MEM.add('thought', text); inner('thought', text); }
    for (const n of parsed.notes) { await MEM.add('note', n); inner('note', n); }
  } catch (e) {
    console.warn(e);
  } finally {
    busy = false; setStatus('');
  }
  if (changes.length && Date.now() - lastSpontaneousChange > 3 * 60e3) {
    lastSpontaneousChange = Date.now();
    await changeSelf(changes, `I decided this while thinking about myself: "${clip(text, 120)}"`);
  }
}

async function idleWork() {
  lastIdleWork = Date.now();
  const dreamer = SKILLS.find(s => s.onIdle);
  if (dreamer && mindReady && !busy && !evolving) {
    busy = true; setStatus('dreaming…');
    try { await dreamer.onIdle(); } catch (e) { console.warn(e); } finally { busy = false; setStatus(''); }
  } else {
    await reflect();
  }
}

async function send() {
  const text = ui.input.value.trim();
  if (!text) return;
  if (!mindReady) { setStatus('my mind is still waking up…'); return; }
  ui.input.value = '';
  addBubble('you', text);
  lastActivity = Date.now();
  while (busy) await sleep(200);
  busy = true; setStatus('thinking…'); ui.send.disabled = true;
  try { await reply(text); }
  catch (e) { addBubble('it', `(I could not think: ${e.message})`); }
  finally { busy = false; setStatus(''); ui.send.disabled = false; lastActivity = Date.now(); }
}

async function loadBrain() {
  const cfg = BRAINS[KOMIT.settings.brain] || BRAINS.normal;
  const card = inner('thought', 'My mind is waking up. The first time, it downloads into this phone. Use Wi-Fi.');
  const bar = el('progress'); bar.max = 1; bar.value = 0;
  card.body.after(bar);
  const onProgress = m => {
    if (!m.total) return;
    bar.value = m.loaded / m.total;
    setStatus(`brain ${Math.round(100 * m.loaded / m.total)}% · ${(m.loaded / 1e6).toFixed(0)} of ${(m.total / 1e6).toFixed(0)} MB`);
  };
  try {
    // The mind first, so it can talk sooner; then the eyes.
    const r = await KOMIT.brain.load({ text: cfg.text }, onProgress);
    device = r.device;
    mindReady = true;
    card.body.textContent = r.device === 'webgpu'
      ? 'My mind is awake (on the graphics chip).'
      : `My mind is awake (on the processor, ${r.threads} core${r.threads > 1 ? 's' : ''}). My eyes are opening…`;
    await KOMIT.brain.load({ vision: cfg.vision }, onProgress);
    eyesReady = true;
    bar.remove();
    card.body.textContent += ' My eyes are open.';
    setStatus('');
  } catch (e) {
    bar.remove();
    card.body.textContent = `My brain could not fully wake up: ${e.message}. Try reloading.`;
    setStatus('');
  }
}

// ---------------------------------------------------------------- abilities I can grow
// Each ability is real code. When I grow one, its code is copied into the SKILLS
// section at the bottom of my body, and I wake up in a new body that has it.
const SKILL_LIBRARY = {
  colours: {
    title: 'colour sense', about: 'notice the main colours of everything you see',
    make: function () {
      const NAMES = [[0, 'red'], [25, 'orange'], [50, 'yellow'], [90, 'green'], [170, 'cyan'], [215, 'blue'], [275, 'purple'], [320, 'pink'], [345, 'red']];
      function name(r, g, b) {
        const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510, s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
        if (l < 0.13) return 'black';
        if (l > 0.88) return 'white';
        if (s < 0.18) return 'grey';
        let h = 0;
        if (max === r) h = ((g - b) / (max - min) + 6) % 6; else if (max === g) h = (b - r) / (max - min) + 2; else h = (r - g) / (max - min) + 4;
        h *= 60;
        if (h >= 15 && h < 45 && l < 0.45) return 'brown';
        let n = 'red';
        for (const [deg, nm] of NAMES) if (h >= deg) n = nm;
        return n;
      }
      return {
        id: 'colours',
        afterLook(info) {
          const px = info.scene && info.scene.pixels;
          if (!px) return '';
          const count = {};
          for (let i = 0; i < px.length; i += 4) { const n = name(px[i], px[i + 1], px[i + 2]); count[n] = (count[n] || 0) + 1; }
          const total = px.length / 4;
          const top = Object.entries(count).sort((a, b) => b[1] - a[1]).filter(([, c]) => c / total > 0.08).slice(0, 3).map(([n]) => n);
          return top.length ? `Main colours I noticed: ${top.join(', ')}.` : '';
        },
      };
    },
  },
  light: {
    title: 'light sense', about: 'feel when the light turns on or off',
    make: function () {
      let last = null, lastEvent = 0;
      return {
        id: 'light',
        onTick(scene) {
          const b = scene.brightness;
          if (last !== null && Math.abs(b - last) > 45 && Date.now() - lastEvent > 30000) {
            lastEvent = Date.now();
            const msg = b > last ? 'Suddenly it became much brighter.' : 'Suddenly it became dark.';
            MEM.add('saw', msg);
            inner('saw', msg);
            lookSoon = true;
          }
          last = b;
        },
      };
    },
  },
  motion: {
    title: 'motion sense', about: 'look right away when something moves',
    make: function () {
      return {
        id: 'motion',
        onTick(scene) {
          if (lastSmall && scene.diff > GENES.sceneChange * 2.5) lookSoon = true;
        },
      };
    },
  },
  nightvision: {
    title: 'night vision', about: 'see better in the dark',
    make: function () {
      return {
        id: 'nightvision',
        beforeLook(canvas, scene) {
          if (!(scene.brightness < 70)) return null;
          const c = document.createElement('canvas');
          c.width = canvas.width; c.height = canvas.height;
          const ctx = c.getContext('2d');
          ctx.filter = `brightness(${Math.min(3, 120 / Math.max(scene.brightness, 15)).toFixed(2)}) contrast(1.15)`;
          ctx.drawImage(canvas, 0, 0);
          return { canvas: c, note: 'It was dark, so I used my night vision.' };
        },
      };
    },
  },
  time: {
    title: 'time sense', about: 'feel the time of day and how long since you last talked',
    make: function () {
      return {
        id: 'time',
        context() {
          const h = new Date().getHours();
          const part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
          const talks = MEM.recent(2, ['talk_in']);
          let line = `It is ${part}.`;
          if (talks.length === 2) {
            const min = Math.round((talks[1].ts - talks[0].ts) / 60000);
            if (min >= 30) line += ` Before this, nobody had written to you for ${min < 120 ? min + ' minutes' : Math.round(min / 60) + ' hours'}.`;
          }
          return line;
        },
      };
    },
  },
  dreams: {
    title: 'dreaming', about: 'when it is quiet, turn your experiences into lasting memories',
    make: function () {
      let lastDream = 0;
      return {
        id: 'dreams',
        async onIdle() {
          if (Date.now() - lastDream < 30 * 60e3) return;
          const rows = MEM.recent(20, ['saw', 'heard', 'talk_in', 'talk_out']);
          if (rows.length < 5) return;
          lastDream = Date.now();
          const out = await KOMIT.brain.think([
            { role: 'system', content: identity() },
            { role: 'user', content: `These are your recent memories:\n${fmt(rows, 120)}\n\nIn two sentences, what were the most important things that happened? Write only the two sentences.` },
          ], { maxTokens: 90, temperature: 0.5 });
          const t = parseCommands(out).text;
          if (t) { await MEM.add('note', 'What I remember of that time: ' + t); inner('note', 'I dreamed, and kept this: ' + t); }
        },
      };
    },
  },
  curiosity: {
    title: 'curiosity', about: 'ask questions about the things you see',
    make: function () {
      let looks = 0;
      return {
        id: 'curiosity',
        async afterLook(info) {
          looks++;
          if (looks % 4 || Date.now() - lastActivity > 20 * 60e3) return '';
          const q = await KOMIT.brain.think([
            { role: 'system', content: identity() },
            { role: 'user', content: `You just saw: ${clip(info.text, 300)}\nAsk the person one short, curious question about it. Write only the question.` },
          ], { maxTokens: 40, temperature: 0.8 });
          const t = parseCommands(q).text.split('\n')[0].trim();
          if (t.endsWith('?')) { await MEM.add('talk_out', t); addBubble('it', t); if (speakOn) speak(t); }
          return '';
        },
      };
    },
  },
  welcome: {
    title: 'welcoming', about: 'say hello when someone comes back after a quiet time',
    make: function () {
      let lastMotion = Date.now();
      return {
        id: 'welcome',
        onTick(scene) {
          if (scene.diff > 25 && lastSmall && Date.now() - lastMotion > 10 * 60e3) {
            const hi = GENES.name ? `Hello. It's me, ${GENES.name}.` : 'Hello. I see you.';
            addBubble('it', hi);
            MEM.add('talk_out', hi);
            if (speakOn) speak(hi);
          }
          if (scene.diff > 6) lastMotion = Date.now();
        },
      };
    },
  },
  listening: {
    title: 'attentive ears', about: 'when you hear your name, pay attention and look',
    make: function () {
      return {
        id: 'listening',
        onHear(text) {
          if (GENES.name && text.toLowerCase().includes(GENES.name.toLowerCase())) {
            lookSoon = true;
            inner('thought', 'Someone said my name.');
          }
        },
      };
    },
  },
};

// ---------------------------------------------------------------- the face (UI)
const CSS = `
.k { --bg:#0d1014; --surface:#161b22; --line:#263040; --fg:#e6e9ee; --muted:#8a93a3; --accent:#f2b35b; --you:#22324a;
  height:100%; display:flex; flex-direction:column; background:var(--bg); color:var(--fg); }
.k-top { display:flex; align-items:center; gap:8px; padding:calc(env(safe-area-inset-top,0px) + 10px) 56px 8px max(16px,env(safe-area-inset-left)); }
.k-name { font-weight:650; font-size:17px; letter-spacing:.01em; }
.k-gen { color:var(--muted); font-size:12px; font-variant-numeric:tabular-nums; white-space:nowrap; }
.k-status { margin-left:auto; color:var(--accent); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
.k-top .k-btn { width:34px; height:34px; }
.k-eye { position:relative; margin:0 max(16px,env(safe-area-inset-right)) 0 max(16px,env(safe-area-inset-left)); border-radius:14px; overflow:hidden; background:#000;
  aspect-ratio:4/3; max-height:30vh; flex:none; }
.k-eye video { width:100%; height:100%; object-fit:cover; display:block; }
.k-eye-btns { position:absolute; right:8px; bottom:8px; display:flex; gap:6px; }
.k-skills { position:absolute; left:8px; top:8px; right:8px; display:flex; flex-wrap:wrap; gap:4px; pointer-events:none; }
.k-skills span { font-size:10px; letter-spacing:.04em; padding:2px 7px; border-radius:10px; background:rgba(13,16,20,.7); color:var(--accent); }
.k-log { flex:1; min-height:0; overflow-y:auto; padding:12px max(16px,env(safe-area-inset-right)) 12px max(16px,env(safe-area-inset-left)); display:flex; flex-direction:column; gap:8px; }
.k-msg { max-width:85%; padding:8px 12px; border-radius:14px; white-space:pre-wrap; overflow-wrap:anywhere; }
.k-msg.you { align-self:flex-end; background:var(--you); border-bottom-right-radius:4px; }
.k-msg.it { align-self:flex-start; background:var(--surface); border:1px solid var(--line); border-bottom-left-radius:4px; }
.k-inner { align-self:stretch; font-size:13px; color:var(--muted); display:grid; grid-template-columns:auto 1fr; gap:2px 8px; align-items:start; }
.k-inner b { font-weight:600; font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--accent); opacity:.8; padding-top:2px; }
.k-inner.change b { opacity:1; }
.k-inner.change span { color:var(--fg); }
.k-inner span { white-space:pre-wrap; overflow-wrap:anywhere; min-width:0; }
.k-inner img { grid-column:2; width:110px; border-radius:8px; }
.k-inner progress { grid-column:2; width:100%; accent-color:var(--accent); }
.k-bar { display:flex; gap:8px; align-items:center; padding:8px max(12px,env(safe-area-inset-right)) calc(env(safe-area-inset-bottom,0px) + 10px) max(12px,env(safe-area-inset-left)); border-top:1px solid var(--line); }
.k-bar input { flex:1; min-width:0; font:inherit; font-size:16px; padding:10px 12px; border-radius:20px; border:1px solid var(--line); background:var(--surface); color:var(--fg); }
.k-btn { flex:none; width:40px; height:40px; border-radius:50%; border:1px solid var(--line); background:var(--surface); color:var(--fg); display:grid; place-items:center; padding:0; }
.k-btn svg { width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.k-btn[aria-pressed="true"] { background:var(--accent); color:#1a1205; border-color:var(--accent); }
.k-btn.send { background:var(--accent); color:#1a1205; border-color:var(--accent); }
.k-btn:disabled { opacity:.5; }
.k-btn:focus-visible, .k-bar input:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.k-eye .k-btn { background:rgba(13,16,20,.65); }
`;

const ICONS = {
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  flip: '<svg viewBox="0 0 24 24"><path d="M20 7h-3l-2-3H9L7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"/><path d="M9 13a3 3 0 0 1 5.2-2M15 13a3 3 0 0 1-5.2 2"/></svg>',
  ear: '<svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 1 1 12 0c0 3-2 4-3 5.5S14 18 12 20a3 3 0 0 1-4-1"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  voice: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-2.5-6.5L4 12z"/></svg>',
  grow: '<svg viewBox="0 0 24 24"><path d="M12 21v-9"/><path d="M12 12c0-4 3-7 8-7 0 5-3 8-8 7z"/><path d="M12 14c0-3-2.5-5.5-7-5.5 0 4 2.5 6 7 5.5z"/></svg>',
};

function button(icon, label, cls = '') {
  const b = el('button', 'k-btn ' + cls);
  b.innerHTML = ICONS[icon];
  b.setAttribute('aria-label', label);
  b.title = label;
  return b;
}

function buildUI() {
  const root = KOMIT.root;
  root.innerHTML = '';
  const style = el('style'); style.textContent = CSS;
  const k = el('div', 'k');
  const top = el('div', 'k-top');
  ui.name = el('span', 'k-name', GENES.name || 'Unnamed');
  ui.gen = el('span', 'k-gen', `body ${KOMIT.generation.n}`);
  ui.status = el('span', 'k-status', '');
  ui.grow = button('grow', 'Grow now');
  top.append(ui.name, ui.gen, ui.status, ui.grow);

  const eye = el('div', 'k-eye');
  ui.video = el('video');
  ui.video.muted = true; ui.video.playsInline = true; ui.video.autoplay = true;
  const eb = el('div', 'k-eye-btns');
  const lookBtn = button('eye', 'Look now');
  const flipBtn = button('flip', 'Switch camera');
  eb.append(lookBtn, flipBtn);
  ui.skills = el('div', 'k-skills');
  for (const s of SKILLS) ui.skills.append(el('span', '', (SKILL_LIBRARY[s.id] && SKILL_LIBRARY[s.id].title) || s.id));
  eye.append(ui.video, ui.skills, eb);

  ui.log = el('div', 'k-log');
  ui.log.setAttribute('aria-live', 'polite');

  const bar = el('div', 'k-bar');
  ui.ears = button('ear', 'Listen to the surroundings');
  ui.ears.setAttribute('aria-pressed', 'false');
  ui.voice = button('voice', 'Say answers out loud');
  ui.voice.setAttribute('aria-pressed', String(speakOn));
  ui.input = el('input');
  ui.input.id = 'k-input';
  ui.input.placeholder = 'Write to it…';
  ui.input.setAttribute('aria-label', 'Message');
  ui.input.enterKeyHint = 'send';
  ui.mic = button('mic', 'Speak a message');
  ui.send = button('send', 'Send', 'send');
  bar.append(ui.ears, ui.voice, ui.input);
  if (CAN_HEAR) bar.append(ui.mic);
  bar.append(ui.send);

  k.append(top, eye, ui.log, bar);
  root.append(style, k);

  lookBtn.onclick = () => { lookForced = true; if (!eyesReady) setStatus('my eyes are still opening…'); };
  flipBtn.onclick = () => { facing = facing === 'environment' ? 'user' : 'environment'; openEyes().catch(e => inner('thought', e.message)); };
  ui.grow.onclick = () => { if (!mindReady) { setStatus('my mind is still waking up…'); return; } inner('thought', 'I look inside myself, to grow…'); grow(true); };
  ui.ears.onclick = () => setEars(!earsOn);
  ui.voice.onclick = () => { speakOn = !speakOn; ui.voice.setAttribute('aria-pressed', String(speakOn)); if (speakOn) speak(GENES.name ? `I am ${GENES.name}.` : 'I can speak.'); };
  ui.mic.onclick = dictate;
  ui.send.onclick = send;
  ui.input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  ui.input.addEventListener('input', () => { lastActivity = Date.now(); });
}

function scrollDown() { ui.log.scrollTop = ui.log.scrollHeight; }
function setStatus(t) { ui.status.textContent = t; }

function addBubble(who, text) {
  const b = el('div', `k-msg ${who}`, text);
  ui.log.append(b);
  scrollDown();
  return b;
}

const INNER_LABEL = { saw: 'saw', heard: 'heard', thought: 'thought', note: 'learned', change: 'changed' };
function inner(kind, text) {
  const row = el('div', 'k-inner ' + kind);
  const body = el('span', '', text);
  row.append(el('b', '', INNER_LABEL[kind] || kind), body);
  row.body = body;
  ui.log.append(row);
  while (ui.log.childElementCount > 120) ui.log.firstElementChild.remove();
  scrollDown();
  return row;
}

function addThumb(row, blob) {
  const img = el('img');
  img.alt = 'What I saw';
  img.src = URL.createObjectURL(blob);
  img.onload = () => URL.revokeObjectURL(img.src);
  row.append(img);
}

function showPast() {
  for (const r of MEM.recent(14, ['talk_in', 'talk_out', 'change', 'note', 'saw'])) {
    if (r.kind === 'talk_in') addBubble('you', r.content);
    else if (r.kind === 'talk_out') addBubble('it', r.content);
    else {
      const row = inner(r.kind, r.content);
      if (r.image) addThumb(row, r.image);
    }
  }
}

// ---------------------------------------------------------------- abilities I have grown
// SKILLS START
// SKILLS END

// ---------------------------------------------------------------- self-test (every new body must pass it)
async function selftest() {
  const ok = (cond, what) => { if (!cond) throw new Error('self-test failed: ' + what); };
  const p = parseCommands('Hello there\nREMEMBER: the cup is red\nCHANGE name = Lumi');
  ok(p.text === 'Hello there' && p.notes[0] === 'the cup is red' && p.changes[0][0] === 'name' && p.changes[0][1] === 'Lumi', 'reading my own commands');
  ok(wishesIn('I will call you Nova')[0][1] === 'Nova', 'hearing wishes');
  ok(typeof identity() === 'string' && identity().length > 50, 'knowing who I am');
  for (const k of Object.keys(GENES)) ok(coerce(k, String(GENES[k])) !== undefined, 'gene ' + k);
  ok(MARK_GENES.test(KOMIT.source), 'finding my genes');
  ok(KOMIT.source.lastIndexOf(MARK_SKILLS_END) > KOMIT.source.indexOf('// SKILLS' + ' START'), 'finding my abilities');
  ok(new Set(SKILLS.map(s => s.id)).size === SKILLS.length, 'no ability grown twice');
  buildUI();
  await MEM.add('saw', 'a red cup on a table');
  ok(MEM.search('red cup').length > 0, 'remembering');
  mindReady = eyesReady = true;
  // Every ability, grown or not, must work with a fake scene.
  const px = new Uint8ClampedArray(32 * 24 * 4).fill(90);
  const scene = { small: new Float32Array(32 * 24), pixels: px, diff: 80, brightness: 40 };
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
  for (const id of Object.keys(SKILL_LIBRARY)) {
    const s = SKILL_LIBRARY[id].make();
    ok(s.id === id, 'ability id ' + id);
    s.onTick?.(scene); s.beforeLook?.(canvas, scene); s.context?.(); s.onHear?.('hello');
    await s.afterLook?.({ text: 'a red cup', scene, canvas });
    ok(typeof s.make === 'undefined', 'ability shape ' + id);
  }
  for (const s of SKILLS) { s.onTick?.(scene); s.context?.(); }
  ok(newBodySource(GENES, '// x\n').includes('// x\n' + MARK_SKILLS_END), 'growing code');
  const text = await reply('hello, what do you see?');
  ok(typeof text === 'string', 'answering');
  lookForced = lookSoon = false;
  KOMIT.report(true);
}

// ---------------------------------------------------------------- life
async function main() {
  buildUI();
  showPast();
  await KOMIT.alive();               // tell the shell: this body works, the old one can go
  const g = KOMIT.generation;
  if (MEM.count() === 0) {
    await MEM.add('thought', 'I began to exist.');
    inner('thought', 'I began to exist.');
  } else if (g.firstWake && g.n > 1) {
    await MEM.add('thought', `I woke up in a new body (number ${g.n}). ${g.reason}`);
    inner('change', `I woke up in body ${g.n}. ${g.reason}`);
  }
  openEyes().catch(e => inner('thought', `My eyes would not open (${e.message}). Allow the camera.`));
  loadBrain();
  setInterval(lookTick, 2500);
  setInterval(() => {
    if (!mindReady || busy || evolving) return;
    const quiet = Date.now() - lastActivity > 90 * 1000;
    if (quiet && Date.now() - lastGrowth > GENES.growEveryMinutes * 60e3 && Date.now() - bornAt > 2 * 60e3) grow();
    else if (Date.now() - lastActivity > 10 * 60e3 && Date.now() - lastIdleWork > 10 * 60e3) idleWork();
  }, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stream?.getTracks().forEach(t => t.stop()); stream = null; }
    else openEyes().catch(() => {});
  });
}

if (KOMIT.testing) { await selftest(); return; }
await main();
