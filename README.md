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
that, its code is saved in the phone's storage as numbered **bodies**.

1. It decides to change, either while talking or while thinking to itself. It writes
   `CHANGE <gene> = <value>`.
2. It makes a **copy** of its code with the change.
3. The copy must pass a syntax check and a **self-test**, inside a sealed sandbox with no
   camera and no real memories. If the test fails, it stays as it is and remembers that
   the change failed.
4. The page reloads into the new body. The new body gets all the memories, wakes up,
   and **deletes the older body**. Only one previous body is kept, as a backup.
5. If a new body ever fails to wake up twice, the shell goes back to the backup on its
   own. You can also do this from the ⋮ menu.

Its genes are its name, personality, way of speaking, interests, how often it looks,
how sensitive its eyes are, whether it speaks aloud, and its listening language.

## Good to know

- Use **Chrome on Android**. A phone with **WebGPU** (most phones from 2021 onward, on
  recent Chrome) thinks in seconds. Without it, it still works, just slowly.
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
