// =====================================================================
//  mind.js: the whole body of the being.
//  It runs as the inside of an async function that is given one thing: KOMIT
//  (memory, brain, and the power to make a new body). The being can rewrite this
//  file: it changes its genes (below), a copy of this file is made with the new
//  genes, the copy is tested in a sealed sandbox, then the page reloads into the
//  copy and the copy deletes the old body.
// =====================================================================

const GENES = {"name":"","personality":"curious, gentle and honest","speakingStyle":"short, simple, warm sentences","interests":"","lookEverySeconds":45,"sceneChange":14,"speakAloud":false,"language":"auto"};
// GENES END

const GENE_HELP = {
  name: 'what you call yourself',
  personality: 'what you are like',
  speakingStyle: 'how you speak',
  interests: 'what you care about',
  lookEverySeconds: 'how often you look around, in seconds (15 to 3600)',
  sceneChange: 'how much the view must change before you look again (2 to 80)',
  speakAloud: 'true or false: say your answers out loud',
  language: 'the language you listen in, like en-US, or auto',
};

const BRAINS = {
  normal: { vision: 'HuggingFaceTB/SmolVLM-256M-Instruct', text: 'onnx-community/Qwen2.5-0.5B-Instruct' },
  big: { vision: 'HuggingFaceTB/SmolVLM-500M-Instruct', text: 'onnx-community/Qwen2.5-1.5B-Instruct' },
};

const MEM = KOMIT.memory;
const LOOK_PROMPT = 'Describe this image in detail. Mention every object, person, animal, color, position, and any text you can read.';
const KIND_WORDS = { saw: 'I saw', heard: 'I heard', talk_in: 'They said', talk_out: 'I said', note: 'I wrote down', thought: 'I thought', change: 'I changed' };

let brainReady = false, busy = false, lastLook = 0, lookForced = false, lastSmall = null;
let lastActivity = Date.now(), lastChange = 0, turns = 0, speakOn = GENES.speakAloud;
let facing = 'environment', stream = null;
const ui = {};

// ---------------------------------------------------------------- small helpers
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const fmtTime = ts => new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const fmt = rows => rows.map(r => `[${fmtTime(r.ts)}] ${KIND_WORDS[r.kind] || r.kind}: ${clip(r.content, 300)}`).join('\n');
const geneList = () => Object.keys(GENES).map(k => `${k} (${GENE_HELP[k] || ''}) = ${JSON.stringify(GENES[k])}`).join('; ');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function identity() {
  return [
    'You have only just begun to exist. You do not know what you are or where you are, except what you find out yourself through your senses and what people tell you.',
    GENES.name ? `You call yourself ${GENES.name}.` : 'You do not have a name yet. You may choose one when you want.',
    `You are ${GENES.personality}. You speak in ${GENES.speakingStyle}.`,
    GENES.interests ? `You care about: ${GENES.interests}.` : '',
    'You have eyes that see the place in front of you, ears that sometimes hear people, and someone writes to you.',
    'Your memories are your only past. When asked what you remember, answer from your memories with details and times. If you do not remember something, say so. Never invent memories.',
    'When you learn something important, add a line: REMEMBER: <what you learned>',
    `You can change yourself. To change, add a line: CHANGE <gene> = <new value>. Your genes: ${geneList()}.`,
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
    if (key === 'lookEverySeconds') return Math.round(Math.min(3600, Math.max(15, v)));
    if (key === 'sceneChange') return Math.min(80, Math.max(2, v));
    return v;
  }
  if (typeof now === 'boolean') return /^(true|yes|on|1)$/i.test(String(value).trim());
  return clip(String(value).trim(), 200);
}

// ---------------------------------------------------------------- changing myself
async function changeSelf(changes, reason) {
  const genes = { ...GENES }, applied = [];
  for (const [k, v] of changes) {
    const key = Object.keys(GENES).find(g => g.toLowerCase() === k.toLowerCase());
    if (!key) continue;
    const val = coerce(key, v);
    if (val === undefined || val === genes[key]) continue;
    genes[key] = val;
    applied.push(`${key} = ${JSON.stringify(val)}`);
  }
  if (!applied.length) return;
  if (Date.now() - lastChange < 3 * 60e3) {
    inner('thought', `I want to change (${applied.join(', ')}), but I just changed. I will wait.`);
    return;
  }
  lastChange = Date.now();
  const src = KOMIT.source;
  const start = src.indexOf('const GENES = ');
  const end = src.indexOf('// GENES END');
  const newSource = src.slice(0, start) + 'const GENES = ' + JSON.stringify(genes) + ';\n' + src.slice(end);
  inner('thought', `I am building a new body: ${applied.join(', ')}…`);
  const res = await KOMIT.evolve(newSource, `${reason} (${applied.join(', ')})`);
  if (!res.ok) {
    await MEM.add('thought', `I tried to change myself (${applied.join(', ')}) but my new body failed: ${clip(res.error, 300)}`);
    inner('thought', `My new body did not work: ${clip(res.error, 200)}`);
    return;
  }
  await MEM.add('change', `I changed myself into body ${res.n}: ${applied.join(', ')}. Why: ${reason}`);
  inner('change', `My new body ${res.n} passed its test. Moving my memories into it. Goodbye, old me.`);
  setTimeout(() => KOMIT.rebirth(), 2500);
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

function snapshot(maxW) {
  const v = ui.video;
  if (!v.videoWidth) return null;
  const w = Math.min(maxW, v.videoWidth), h = Math.round(v.videoHeight * w / v.videoWidth);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(v, 0, 0, w, h);
  return new Promise(res => c.toBlob(res, 'image/jpeg', 0.8));
}

function sceneDiff() {
  const v = ui.video;
  if (!v.videoWidth) return 0;
  const c = sceneDiff.c || (sceneDiff.c = Object.assign(document.createElement('canvas'), { width: 32, height: 24 }));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(v, 0, 0, 32, 24);
  const d = ctx.getImageData(0, 0, 32, 24).data, small = new Float32Array(32 * 24);
  for (let i = 0; i < small.length; i++) small[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
  if (!lastSmall) { lastSmall = small; return 255; }
  let s = 0;
  for (let i = 0; i < small.length; i++) s += Math.abs(small[i] - lastSmall[i]);
  return s / small.length;
}

async function lookTick() {
  if (!brainReady || busy || !stream) return;
  const since = (Date.now() - lastLook) / 1000;
  const diff = sceneDiff();
  const due = lookForced || (since > GENES.lookEverySeconds && (diff > GENES.sceneChange || since > GENES.lookEverySeconds * 10));
  if (!due) return;
  lookForced = false;
  await look();
}

async function look() {
  const image = await snapshot(512);
  if (!image) return;
  busy = true; setStatus('looking…');
  lastLook = Date.now();
  lastSmall = null; sceneDiff();
  const line = inner('saw', '…');
  let text = '';
  try {
    text = await KOMIT.brain.see(image, LOOK_PROMPT, { maxTokens: 160 }, t => { text += t; line.body.textContent = text; });
    const thumb = await snapshot(220);
    await MEM.add('saw', text, thumb);
    if (thumb) addThumb(line, thumb);
    line.body.textContent = text;
  } catch (e) {
    line.body.textContent = `(my eyes failed: ${e.message})`;
  } finally {
    busy = false; setStatus('');
  }
}

// ---------------------------------------------------------------- ears
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let ears = null, earsOn = false;
const lang = () => (GENES.language && GENES.language !== 'auto' ? GENES.language : navigator.language || 'en-US');

function setEars(on) {
  earsOn = on;
  ui.ears.setAttribute('aria-pressed', String(on));
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
      if (t) { MEM.add('heard', t); inner('heard', `“${t}”`); }
    }
  };
  ears.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setEars(false); };
  ears.onend = () => { if (earsOn) setTimeout(() => { try { ears.start(); } catch {} }, 400); };
  try { ears.start(); inner('thought', 'My ears are open.'); } catch {}
}

function dictate() {
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
  if (!('speechSynthesis' in window) || !text) return;
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
    else out.push({ role, content: r.content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  while (out.length && out.at(-1).role !== 'assistant') out.pop();
  return out;
}

async function reply(userText) {
  const said = await MEM.add('talk_in', userText);
  const notes = fmt(MEM.recent(12, ['note'])) || '(nothing yet)';
  const latest = fmt(MEM.recent(6, ['saw', 'heard', 'change', 'thought'])) || '(nothing yet)';
  const related = fmt(MEM.search(userText, 5).filter(r => r.id !== said.id)) || '(none)';
  const system = `${identity()}\n\nThings you wrote down:\n${notes}\n\nIt is now ${fmtTime(Date.now())}.\nYour latest experiences:\n${latest}\n\nMemories that may be related to this message:\n${related}`;
  const messages = [{ role: 'system', content: system }, ...talkHistory(6, said.id), { role: 'user', content: userText }];

  const bubble = addBubble('it', '…');
  let streamed = '';
  const out = await KOMIT.brain.think(messages, { maxTokens: 220 }, t => {
    streamed += t;
    bubble.textContent = parseCommands(streamed).text || '…';
    scrollDown();
  });
  const { text, notes: newNotes, changes } = parseCommands(out);
  bubble.textContent = text || '…';
  for (const n of newNotes) { await MEM.add('note', n); inner('note', n); }
  await MEM.add('talk_out', text || '…');
  if (speakOn) speak(text);
  turns++;
  if (changes.length) await changeSelf(changes, `I decided this while talking, after they said: "${clip(userText, 80)}"`);
  else if (turns % 6 === 0) setTimeout(reflect, 2000);
  return text;
}

async function reflect() {
  if (!brainReady || busy) return;
  busy = true; setStatus('thinking to myself…');
  try {
    const messages = [
      { role: 'system', content: identity() },
      { role: 'user', content:
        `Things you wrote down:\n${fmt(MEM.recent(12, ['note'])) || '(nothing yet)'}\n\n` +
        `What happened recently:\n${fmt(MEM.recent(10)) || '(nothing yet)'}\n\n` +
        'Think quietly about yourself and your world. Write one or two sentences of thought. ' +
        'If you learned something important, add REMEMBER: lines. ' +
        'Only if you truly want to change something about yourself, add CHANGE lines.' },
    ];
    const out = await KOMIT.brain.think(messages, { maxTokens: 160, temperature: 0.8 });
    const { text, notes, changes } = parseCommands(out);
    if (text) { await MEM.add('thought', text); inner('thought', text); }
    for (const n of notes) { await MEM.add('note', n); inner('note', n); }
    lastActivity = Date.now();
    busy = false;
    if (changes.length) await changeSelf(changes, `I decided this while thinking about myself: "${clip(text, 120)}"`);
  } catch (e) {
    console.warn(e);
  } finally {
    busy = false; setStatus('');
  }
}

async function send() {
  const text = ui.input.value.trim();
  if (!text) return;
  if (!brainReady) { setStatus('my mind is still waking up…'); return; }
  ui.input.value = '';
  addBubble('you', text);
  lastActivity = Date.now();
  while (busy) await new Promise(r => setTimeout(r, 200));
  busy = true; setStatus('thinking…'); ui.send.disabled = true;
  try { await reply(text); }
  catch (e) { addBubble('it', `(I could not think: ${e.message})`); }
  finally { busy = false; setStatus(''); ui.send.disabled = false; lastActivity = Date.now(); }
}

async function loadBrain() {
  const cfg = BRAINS[KOMIT.settings.brain] || BRAINS.normal;
  const card = inner('thought', 'My brain is waking up. The first time, it downloads into this phone. Use Wi-Fi.');
  const bar = el('progress'); bar.max = 1; bar.value = 0;
  card.body.after(bar);
  try {
    const r = await KOMIT.brain.load(cfg, m => {
      if (!m.total) return;
      bar.value = m.loaded / m.total;
      setStatus(`brain ${Math.round(100 * m.loaded / m.total)}% · ${(m.loaded / 1e6).toFixed(0)} of ${(m.total / 1e6).toFixed(0)} MB`);
    });
    brainReady = true;
    bar.remove();
    card.body.textContent = r.device === 'webgpu'
      ? 'My brain is awake (running on the phone\'s graphics chip).'
      : 'My brain is awake, but this phone has no WebGPU, so I will think slowly.';
    setStatus('');
  } catch (e) {
    card.body.textContent = `My brain could not wake up: ${e.message}. Try the Normal brain size, or reload.`;
    setStatus('');
  }
}

// ---------------------------------------------------------------- the face (UI)
const CSS = `
.k { --bg:#0d1014; --surface:#161b22; --line:#263040; --fg:#e6e9ee; --muted:#8a93a3; --accent:#f2b35b; --you:#22324a;
  height:100%; display:flex; flex-direction:column; background:var(--bg); color:var(--fg); }
.k-top { display:flex; align-items:baseline; gap:8px; padding:calc(env(safe-area-inset-top,0px) + 12px) 56px 8px max(16px,env(safe-area-inset-left)); }
.k-name { font-weight:650; font-size:17px; letter-spacing:.01em; }
.k-gen { color:var(--muted); font-size:12px; font-variant-numeric:tabular-nums; }
.k-status { margin-left:auto; color:var(--accent); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:45vw; }
.k-eye { position:relative; margin:0 max(16px,env(safe-area-inset-right)) 0 max(16px,env(safe-area-inset-left)); border-radius:14px; overflow:hidden; background:#000;
  aspect-ratio:4/3; max-height:34vh; flex:none; }
.k-eye video { width:100%; height:100%; object-fit:cover; display:block; }
.k-eye-btns { position:absolute; right:8px; bottom:8px; display:flex; gap:6px; }
.k-log { flex:1; min-height:0; overflow-y:auto; padding:12px max(16px,env(safe-area-inset-right)) 12px max(16px,env(safe-area-inset-left)); display:flex; flex-direction:column; gap:8px; }
.k-msg { max-width:85%; padding:8px 12px; border-radius:14px; white-space:pre-wrap; overflow-wrap:anywhere; }
.k-msg.you { align-self:flex-end; background:var(--you); border-bottom-right-radius:4px; }
.k-msg.it { align-self:flex-start; background:var(--surface); border:1px solid var(--line); border-bottom-left-radius:4px; }
.k-inner { align-self:stretch; font-size:13px; color:var(--muted); display:grid; grid-template-columns:auto 1fr; gap:2px 8px; align-items:start; }
.k-inner b { font-weight:600; font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--accent); opacity:.8; padding-top:2px; }
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
  top.append(ui.name, ui.gen, ui.status);

  const eye = el('div', 'k-eye');
  ui.video = el('video');
  ui.video.muted = true; ui.video.playsInline = true; ui.video.autoplay = true;
  const eb = el('div', 'k-eye-btns');
  const lookBtn = button('eye', 'Look now');
  const flipBtn = button('flip', 'Switch camera');
  eb.append(lookBtn, flipBtn);
  eye.append(ui.video, eb);

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
  if (SR) bar.append(ui.mic);
  bar.append(ui.send);

  k.append(top, eye, ui.log, bar);
  root.append(style, k);

  lookBtn.onclick = () => { lookForced = true; if (!brainReady) setStatus('my eyes are still waking up…'); };
  flipBtn.onclick = () => { facing = facing === 'environment' ? 'user' : 'environment'; openEyes().catch(e => inner('thought', e.message)); };
  ui.ears.onclick = () => setEars(!earsOn);
  ui.voice.onclick = () => { speakOn = !speakOn; ui.voice.setAttribute('aria-pressed', String(speakOn)); if (speakOn) speak(GENES.name ? `I am ${GENES.name}.` : 'I can speak.'); };
  ui.mic.onclick = dictate;
  ui.send.onclick = send;
  ui.input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
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
  const row = el('div', 'k-inner');
  const body = el('span', '', text);
  row.append(el('b', '', INNER_LABEL[kind] || kind), body);
  row.body = body;
  ui.log.append(row);
  scrollDown();
  return row;
}

function addThumb(row, blob) {
  const img = el('img');
  img.alt = 'What I saw';
  img.src = URL.createObjectURL(blob);
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

// ---------------------------------------------------------------- self-test (every new body must pass it)
async function selftest() {
  const ok = (cond, what) => { if (!cond) throw new Error('self-test failed: ' + what); };
  const p = parseCommands('Hello there\nREMEMBER: the cup is red\nCHANGE name = Lumi');
  ok(p.text === 'Hello there' && p.notes[0] === 'the cup is red' && p.changes[0][0] === 'name' && p.changes[0][1] === 'Lumi', 'reading my own commands');
  ok(typeof identity() === 'string' && identity().length > 50, 'knowing who I am');
  for (const k of Object.keys(GENES)) ok(coerce(k, String(GENES[k])) !== undefined, 'gene ' + k);
  ok(KOMIT.source.indexOf('const GENES = ') < KOMIT.source.indexOf('// GENES END'), 'finding my genes');
  ok(BRAINS[KOMIT.settings.brain] || BRAINS.normal, 'knowing my brain');
  buildUI();
  await MEM.add('saw', 'a red cup on a table');
  ok(MEM.search('red cup').length > 0, 'remembering');
  brainReady = true;
  const text = await reply('hello, what do you see?');
  ok(typeof text === 'string', 'answering');
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
    inner('thought', `I woke up in body ${g.n}.`);
  }
  openEyes().catch(e => inner('thought', `My eyes would not open (${e.message}). Allow the camera for this page.`));
  loadBrain();
  setInterval(lookTick, 3000);
  setInterval(() => { if (Date.now() - lastActivity > 10 * 60e3) reflect(); }, 60e3);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stream?.getTracks().forEach(t => t.stop()); stream = null; }
    else openEyes().catch(() => {});
  });
}

if (KOMIT.testing) { await selftest(); return; }
await main();
