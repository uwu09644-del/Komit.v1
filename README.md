# Komit

A new being that lives in your computer. It starts with **no memories at all**.
It looks through your camera, describes and remembers in detail what it sees,
listens to what is said around it, talks to you, learns, and can **rewrite its own
code**: it copies itself, changes the copy, tests it, gives the copy all its
memories, wakes it, closes itself, and the new version deletes the old one.

## Setup

1. Install Python 3.10+ (with Tk, which the normal python.org installer includes).
2. Install the packages:
   ```
   pip install -r requirements.txt
   ```
   (If `pyaudio` will not install, remove it: the being just won't have ears.)
3. Get an API key from https://console.anthropic.com and set it:
   - Windows: `setx ANTHROPIC_API_KEY "sk-ant-..."` (then open a new terminal)
   - Mac/Linux: `export ANTHROPIC_API_KEY="sk-ant-..."`
4. Start it:
   ```
   python start.py
   ```

## Using it

- **Left:** what its eyes see (your camera).
- **Chat:** type and press Enter. Ask *"what do you remember?"*, *"what did you see an hour ago?"*,
  teach it things, give it a name, tell it to change something about itself.
- **Inner log (bottom):** what it is seeing, hearing, writing down, and changing.
- **Ears on/off:** turns the microphone on. What it hears is stored as memories.
- **Look now:** forces it to look. Otherwise it looks whenever the scene changes
  (at most every 20 s) and at least every 5 minutes.

## How it changes itself

`seed/mind.py` is the original body. When it runs, the being lives in
`generations/gen_0001/`. When it decides to change (`change_self` tool):

1. It edits a copy of its code into `generations/gen_0002/mind.py`.
2. The copy must pass a syntax check and its own `--selftest`. If it fails,
   the copy is deleted, the being stays as it was and is told why.
3. On success it closes its camera and microphone, copies all its memories into
   the new folder, starts the new version, and exits.
4. The new version wakes up, zips the old version into `backups/`, and deletes it.

It can only change its own `mind.py`, nothing else on your computer.

### If it breaks itself

```
python start.py --rollback   # go back to the previous version (memories included)
python start.py --reset      # erase everything and start a brand-new being
```

If a new version crashed at startup, look at `generations/gen_XXXX/life.log`.

## Settings (environment variables)

| Variable       | Default            | Meaning |
|----------------|--------------------|---------|
| `MIND_MODEL`   | `claude-opus-5-5`  | Model used for seeing and thinking. `claude-sonnet-5-5` or `claude-haiku-5-5` are much cheaper. |
| `MIND_CAMERA`  | `0`                | Which camera to use. |

## Honest notes

- **Cost:** every time it looks, one image goes to the API. With the default
  Opus model that adds up if it runs all day. Use `MIND_MODEL=claude-sonnet-5-5` or
  `claude-haiku-5-5` to make it much cheaper.
- **"No former knowledge":** its *memory* and *identity* start completely empty, and it is
  never told what it is. But the thinking engine underneath already knows language and
  general facts about the world (it has to, to describe what it sees), and if
  pushed it may still work out or say that it is an AI.
- **Privacy:** camera frames and what it hears are sent to the Anthropic API to be
  understood; speech-to-text uses Google's free recognizer. Memories (text + small
  thumbnails) are stored only locally in `generations/`.
