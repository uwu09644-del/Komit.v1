# Komit

A new being that lives in your phone. It starts with **no memories at all**. It looks
through your camera and remembers what it sees in detail. It listens to what is said
around it, talks with you, learns, and **changes its own code**: it builds a copy of
itself with the change, tests the copy, moves into it, and the new version deletes
the old one.

**No API, no account, no cost.** The AI is real neural networks that run on your phone's
own chip:
- **Eyes:** SmolVLM, a vision-language model, describes what the camera sees.
- **Mind:** Qwen2.5 Instruct, a language model, thinks and talks.

They download once (about 700 MB, so use Wi-Fi) and stay in Chrome's storage.

## Install the app (APK)

1. On your phone, open **https://github.com/uwu09644-del/Komit.v1/releases/tag/komit-latest**
2. Tap **Komit.apk** to download it, then open it. Android will ask you to allow installing
   apps from your browser: allow it, then tap **Install**.
3. Open **Komit** and allow the camera and microphone.

A new APK is built by GitHub automatically every time the code changes (see
`.github/workflows/android.yml`). Every APK is signed with the same key, so a new
one installs over the old one and **keeps all memories**.

In the app, listening and speaking use Android's own speech services, and everything
else is the same as the website version below.

## Or use it as a website (one time, all from the phone)

1. On github.com, open this repository → **Settings** → **Pages**.
2. Under *Build and deployment*: Source **Deploy from a branch** → Branch
   **`claude/camera-memory-ai-0hmqy0`** → folder **`/docs`** → **Save**.
3. Wait 1–2 minutes, then open in **Chrome**:
   **https://uwu09644-del.github.io/Komit.v1/**
4. Allow the camera. Then use Chrome's menu ⋮ → **Add to Home screen**, and it opens like an app.

The first start downloads the brain (you will see a progress bar). After that it starts in seconds.

## Using it

- **Write to it**, or tap the **mic** to speak a message. Ask *"what do you remember?"*,
  *"what did you see this morning?"*, teach it things, or give it a name.
- **Eye button:** look now. Otherwise it looks by itself when the view changes.
- **Ear button:** it listens to everything said around it and remembers it.
- **Speaker button:** it says its answers out loud.
- **⋮ menu (top right):** brain size, download all memories, go back to the previous
  body, erase everything.

## How it changes itself

All of its code is `docs/mind.js`, and the first version comes from that file. After
that, its code is saved in the phone's storage as numbered **bodies**. It changes in
three ways:

- **It tunes itself.** It measures how long it takes to look and to answer. If this phone
  is slow, it looks less often and speaks more briefly so it stays quick. If the phone is
  fast, it does more.
- **It grows abilities.** It picks a new ability, and the ability's real code is copied
  into its body. The abilities are colour sense, light sense, motion sense, night vision,
  time sense, dreaming (turning experiences into lasting memories), curiosity (asking you
  about what it sees), welcoming, and attentive ears. The chips on the camera view show
  what it has grown.
- **It becomes someone.** It chooses its name and notices its own character and interests
  from its memories. You can also just tell it ("I'll call you Nova", "look more often").

It tries to grow on its own every few minutes when nobody is chatting, or right away if
you tap the **sprout** button. Each change works the same way:

1. It builds a **copy** of its code with the change.
2. The copy must pass a **self-test** in a sealed sandbox. If it fails, the being stays as
   it is and remembers that the change failed.
3. The page reloads into the new body with all the memories, and the new body **deletes
   the older one**. One previous body is kept as a backup.

**Upgrades from outside:** when a newer app or website comes out, the being moves into a
new body built from the new code. It keeps its genes, its grown abilities, and all its memories.

## Good to know

- Use **Chrome on Android**, or the APK. A phone with **WebGPU** thinks in seconds. Without
  it, the AI runs on the processor using several cores. That is slower, so the being
  tunes itself to look less often.
- These are *small* models, so they fit on a phone. It is a real AI, but a simple one: it
  sometimes gets things wrong, like a young mind. Pick **Big brain** in the ⋮ menu if
  your phone is strong (it needs about 1.8 GB).
- Seeing and thinking happen on the phone. **Listening** uses Chrome's built-in speech
  recognition, which on most phones sends audio to Google to turn it into text.
- All memories stay on your phone. Clearing Chrome's site data erases them, so
  use ⋮ → *Download all memories* to keep a copy.

## Files

| Path | What it is |
|------|------------|
| `docs/index.html` | The shell. It keeps memories and bodies, runs the self-tests, and handles rollback. It never changes. |
| `docs/mind.js` | The being's first body. This is the code it rewrites. |
| `docs/brain-worker.js` | Runs the neural networks in the background. |
| `android/` | The Android app: it wraps `docs/` and adds the camera permission, native listening, speaking and saving. |
| `desktop/` | The older desktop (PC) version, which uses the Claude API. |
