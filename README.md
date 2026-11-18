# Komit

## Komit World

A living fantasy world on your phone, with towns, wild lands, rifts that spill monsters,
and the people who live there. One young hunter hears a voice nobody else can hear:
**you, the System.**

- **The people live for themselves.** Every person has their own needs (food, sleep, company),
  personality, memories and relationships. They work, talk, make friends and enemies,
  fall in love, have children who grow up, take up arms, steal, fight, sometimes kill,
  become outlaws, take revenge, grieve, grow old and die. Nobody scripts it.
- **The world is dangerous.** Rifts tear open and spawn monsters. Hunters close them.
  If they don't, the rift breaks and monsters march on a town, and people bar their doors.
- **The hero is the one who changes himself.** He runs on the stronger mind, Qwen2.5 1.5B,
  on the phone itself. He rewrites his own code: he grows new skills, tunes his courage
  and caution from what life did to him, and finds his own character and dream. Each change
  builds a new body that is tested in a sealed sandbox. Then he moves into it while the world
  keeps running, and his old body is deleted (one is kept as a backup).
- **He doesn't know.** To him, this world is the only world. The System is a mysterious voice,
  and his evolutions feel like growing.
- **Only you and he share the System.** From the System tab you can:
  - send him **messages** and **questions** (he answers from his own memories)
  - give him **quests** (defeat monsters, close a rift, reach a level, protect a town, find a
    partner, defeat someone you tapped, or your own words) with rewards
  - send **gifts**: gold, experience, stat points, potions, gear, healing, or an **evolution**
- **Tap anyone** to see their life (family, feelings, memories) and **read their thoughts**.

Tabs: **System** (you and him), **Status** (his status window, skills, who he is),
**Quests**, **World** (population, towns, rifts, strongest hunters, outlaws) and
**Chronicle** (the history of the world: births, deaths, love, murders, rift breaks).
Time runs at 1×, 3× or 10×. A day is 90 seconds at 1×, and a year is 8 days.

### Install

**APK (Android):** open **https://github.com/uwu09644-del/Komit.v1/releases/tag/komit-latest**
on your phone, download **Komit.apk** and install it. A new APK installs over the old one and
keeps the world.

**Website:** in this repo on GitHub, open Settings → Pages → *Deploy from a branch* →
branch `claude/camera-memory-ai-0hmqy0`, folder `/docs`. Then open
`https://uwu09644-del.github.io/Komit.v1/world/` in Chrome.

The first start downloads the hero's mind (about 1.1 GB for the strong mind), so use Wi-Fi.
If the phone can't fit it, it automatically uses the light mind (0.5B). You can also choose
in the ⋮ menu.

### Honest notes

- **How the people think.** A phone can't run a language model for every person at once.
  Each person decides moment to moment with a fast "needs and personality" brain, and the
  language model gives them a voice when you read their thoughts or the hero talks with them.
  The hero thinks with the language model all the time.
- **What he can grow.** He grows skills from a set of real code abilities, and tunes his genes.
  A phone-sized model is too small to safely write brand-new code from scratch.
- **Where things live.** Everything stays on your phone. "End this world" in the ⋮ menu
  starts over.

## The camera being (the first Komit)

`docs/index.html`: an AI that looks through your camera, remembers in detail, listens,
and evolves its own code. Open it from the World's ⋮ menu, or at the site root.

## Files

| Path | What it is |
|------|------------|
| `docs/world/world.js` | The world and its laws: map, people, monsters, rifts, love, death. It never changes. |
| `docs/world/hero.js` | The hero's first body. This is the code he rewrites. |
| `docs/world/index.html` | The System: the screen, your window to him, his bodies, self-tests, saving. |
| `docs/brain-worker.js` | Runs the language model on the phone (WebGPU, or several CPU cores). |
| `docs/index.html`, `docs/mind.js` | The camera being. |
| `android/` | The Android app wrapper. |
| `desktop/` | The original desktop (PC) camera version. |
