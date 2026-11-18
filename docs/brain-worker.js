// The brain: real neural networks running on the phone itself (no API, no server).
// A vision-language model sees, a language model thinks. Both are downloaded once
// from Hugging Face and then kept in the browser's cache.
import {
  pipeline, AutoProcessor, AutoModelForVision2Seq, RawImage, TextStreamer, env,
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

env.allowLocalModels = false;
// Use several CPU cores when the page is cross-origin isolated (the app and the
// website both arrange this). Without it, the CPU brain runs on one core only.
const THREADS = self.crossOriginIsolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)) : 1;
if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.numThreads = THREADS;

let gpu = null;               // null = not checked yet, false = none, {f16} = available
let chat = null, vproc = null, vmodel = null;
const loaded = { text: null, vision: null, device: null };
const files = {};

async function detectGPU() {
  if (gpu !== null) return gpu;
  gpu = false;
  try {
    if (navigator.gpu) {
      const a = await navigator.gpu.requestAdapter();
      if (a) gpu = { f16: a.features.has('shader-f16') };
    }
  } catch {}
  return gpu;
}

function progress(id) {
  return d => {
    if (d.status !== 'progress' || !d.file) return;
    files[d.file] = { loaded: d.loaded || 0, total: d.total || 0 };
    let l = 0, t = 0;
    for (const f of Object.values(files)) { l += f.loaded; t += f.total; }
    postMessage({ id, type: 'progress', loaded: l, total: t, file: d.file });
  };
}

async function firstThatWorks(attempts, make) {
  let last;
  for (const a of attempts) {
    try { return { value: await make(a), used: a }; }
    catch (e) { last = e; console.warn('[brain] could not load with', a, e); }
  }
  throw last || new Error('no way to load this model on this phone');
}

async function load(id, { text, vision }) {
  const g = await detectGPU();
  if (vision && loaded.vision !== vision) {
    await vmodel?.dispose?.();
    vproc = await AutoProcessor.from_pretrained(vision, { progress_callback: progress(id) });
    const tries = [];
    if (g) {
      tries.push({ device: 'webgpu', dtype: { embed_tokens: g.f16 ? 'fp16' : 'fp32', vision_encoder: 'q4', decoder_model_merged: 'q4' } });
      tries.push({ device: 'webgpu', dtype: 'q4' });
    }
    tries.push({ device: 'wasm', dtype: 'q8' }, { device: 'wasm', dtype: 'q4' });
    const r = await firstThatWorks(tries, o =>
      AutoModelForVision2Seq.from_pretrained(vision, { ...o, progress_callback: progress(id) }));
    vmodel = r.value;
    loaded.vision = vision;
    loaded.device = r.used.device;
  }
  if (text && loaded.text !== text) {
    await chat?.dispose?.();
    const tries = [];
    if (g) {
      if (g.f16) tries.push({ device: 'webgpu', dtype: 'q4f16' });
      tries.push({ device: 'webgpu', dtype: 'q4' });
    }
    tries.push({ device: 'wasm', dtype: 'q4' }, { device: 'wasm', dtype: 'q8' });
    const r = await firstThatWorks(tries, o =>
      pipeline('text-generation', text, { ...o, progress_callback: progress(id) }));
    chat = r.value;
    loaded.text = text;
    loaded.device = r.used.device;
  }
  return { device: loaded.device, threads: THREADS, isolated: !!self.crossOriginIsolated };
}

function streamerFor(id, tokenizer) {
  return new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: t => postMessage({ id, type: 'token', text: t }),
  });
}

async function see(id, { image, prompt, maxTokens = 160 }) {
  if (!vmodel) throw new Error('my eyes are not ready yet');
  const img = await RawImage.fromBlob(image);
  const messages = [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: prompt }] }];
  const text = vproc.apply_chat_template(messages, { add_generation_prompt: true });
  const inputs = await vproc(text, [img], { do_image_splitting: false });
  const out = await vmodel.generate({
    ...inputs,
    max_new_tokens: maxTokens,
    do_sample: false,
    repetition_penalty: 1.15,
    streamer: streamerFor(id, vproc.tokenizer),
  });
  const decoded = vproc.batch_decode(out.slice(null, [inputs.input_ids.dims.at(-1), null]), { skip_special_tokens: true });
  return decoded[0].trim();
}

async function think(id, { messages, maxTokens = 220, temperature = 0.7 }) {
  if (!chat) throw new Error('my mind is not ready yet');
  const out = await chat(messages, {
    max_new_tokens: maxTokens,
    do_sample: temperature > 0,
    temperature,
    top_p: 0.9,
    repetition_penalty: 1.1,
    streamer: streamerFor(id, chat.tokenizer),
  });
  const g = out[0].generated_text;
  return (Array.isArray(g) ? g.at(-1).content : String(g)).trim();
}

// One thing at a time: the phone has one GPU.
let queue = Promise.resolve();
const handlers = { load, see, think };

onmessage = e => {
  const { id, type, ...payload } = e.data;
  queue = queue.then(async () => {
    try {
      const fn = handlers[type];
      if (!fn) throw new Error('unknown brain request: ' + type);
      postMessage({ id, type: 'done', result: await fn(id, payload) });
    } catch (err) {
      postMessage({ id, type: 'error', error: String(err?.message || err) });
    }
  });
};
