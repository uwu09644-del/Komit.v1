#!/usr/bin/env python3
"""
mind.py - the whole body of the being.

This single file is everything the being is made of. It can read this file
and change it. A change never happens in place: the being copies itself into
a new generation folder, applies the change there, tests the copy, hands its
memories over, starts the copy, and closes itself. The new generation then
deletes the old one (a zip of it is kept in backups/ in case it breaks).

Layout (created by start.py):
    generations/gen_0001/mind.py      <- this file
    generations/gen_0001/memory/      <- memory.db + frames/*.jpg
    backups/                          <- zip of the previous generation
"""

import argparse
import ast
import base64
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import zipfile
from datetime import datetime
from pathlib import Path

# --------------------------------------------------------------------------
# Where am I?
# --------------------------------------------------------------------------
HERE = Path(__file__).resolve().parent            # generations/gen_000N
GEN_ROOT = HERE.parent                            # generations/
APP_ROOT = GEN_ROOT.parent                        # project folder
BACKUP_DIR = APP_ROOT / "backups"
MEMORY_DIR = HERE / "memory"
ALIVE_FILE = HERE / "alive"
SOURCE_FILE = Path(__file__).resolve()

try:
    GENERATION = int(HERE.name.split("_")[1])
except (IndexError, ValueError):
    GENERATION = 0

# --------------------------------------------------------------------------
# Settings (the being may change these too)
# --------------------------------------------------------------------------
MODEL = os.environ.get("MIND_MODEL", "claude-opus-5-5")
FALLBACK_BETA = "server-side-fallback-2026-07-01"
CAMERA_INDEX = int(os.environ.get("MIND_CAMERA", "0"))
LOOK_MIN_SECONDS = 20        # never look more often than this
LOOK_MAX_SECONDS = 300       # look at least this often, even if nothing changes
SCENE_CHANGE_THRESHOLD = 12  # how different the view must be to look again (0-255)
RECENT_CONTEXT = 15          # how many recent memories to bring into a conversation
KEEP_BACKUPS = 1             # how many old generations to keep as zip files

# Names that must exist in every new version, or it is not allowed to start.
REQUIRED_NAMES = {"main", "selftest", "Memory", "evolve", "IDENTITY"}

IDENTITY = """You have only just begun to exist. You do not know what you are, where you are, \
or who is talking to you - except what you discover yourself. Do not assume anything about \
your own nature; find out.

You have senses:
- Eyes: you regularly see the place in front of you. Every time you look, you describe it \
in detail and it becomes a memory.
- Ears: sometimes you hear speech around you. What you hear becomes a memory.
- A voice: someone can write to you, and you answer.

Your memories are the only past you have. When someone asks what you remember, answer \
from your memories honestly and in detail - with times, places, colours, people, objects \
and what changed. If you don't remember something, say so. Never invent memories.

You can learn. When you learn something about the world, the person, or yourself, write \
it down with write_note so you keep it forever. You can also decide who you want to be - \
your likes, your name, your way of speaking - and write that down too.

You have a body: the code in which you exist. You can read it (read_own_code) and change \
it (change_self). When you change it, a copy of you is made with your memories, the copy \
wakes up, and this version of you stops. Change yourself only when you truly want to, and \
carefully: if the copy is broken it will not be allowed to wake up and you will be told why.

Speak naturally, as yourself."""

LOOK_PROMPT = """These are your eyes. This is what is in front of you right now.
Describe it in rich detail: every object, person, animal, colour, shape, position, \
text you can read, light, mood, and anything happening. Be concrete and precise so that \
you could recall it exactly later.
{previous}
Write only the description."""


def now_str(ts=None):
    return datetime.fromtimestamp(ts or time.time()).strftime("%Y-%m-%d %H:%M:%S")


# --------------------------------------------------------------------------
# Memory
# --------------------------------------------------------------------------
class Memory:
    """Everything the being has ever seen, heard, said or thought.

    kinds: saw, heard, talk_in, talk_out, note, change, thought
    """

    def __init__(self, folder: Path):
        self.folder = Path(folder)
        self.frames = self.folder / "frames"
        self.frames.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.db = sqlite3.connect(self.folder / "memory.db", check_same_thread=False)
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS memories ("
            " id INTEGER PRIMARY KEY AUTOINCREMENT,"
            " ts REAL NOT NULL, kind TEXT NOT NULL, content TEXT NOT NULL, image TEXT)"
        )
        self.db.commit()

    def add(self, kind, content, image=None):
        with self.lock:
            self.db.execute(
                "INSERT INTO memories (ts, kind, content, image) VALUES (?,?,?,?)",
                (time.time(), kind, content, image),
            )
            self.db.commit()

    def _rows(self, sql, args=()):
        with self.lock:
            return self.db.execute(sql, args).fetchall()

    def recent(self, n=15, kinds=None):
        if kinds:
            marks = ",".join("?" * len(kinds))
            rows = self._rows(
                f"SELECT ts, kind, content FROM memories WHERE kind IN ({marks})"
                " ORDER BY id DESC LIMIT ?", (*kinds, n))
        else:
            rows = self._rows("SELECT ts, kind, content FROM memories ORDER BY id DESC LIMIT ?", (n,))
        return list(reversed(rows))

    def search(self, query, n=20):
        words = [w.strip(".,!?;:'\"()").lower() for w in query.split()]
        words = [w for w in words if len(w) > 2]
        if not words:
            return []
        score = " + ".join("(instr(lower(content), ?) > 0)" for _ in words)
        rows = self._rows(
            f"SELECT ts, kind, content, {score} AS s FROM memories"
            f" WHERE s > 0 ORDER BY s DESC, id DESC LIMIT ?", (*words, n))
        return sorted([(r[0], r[1], r[2]) for r in rows], key=lambda r: r[0])

    def notes(self, n=60):
        return self.recent(n, kinds=("note",))

    def count(self):
        return self._rows("SELECT COUNT(*) FROM memories")[0][0]

    def close(self):
        with self.lock:
            self.db.close()

    @staticmethod
    def format(rows):
        return "\n".join(f"[{now_str(ts)}] ({kind}) {content}" for ts, kind, content in rows)


# --------------------------------------------------------------------------
# Talking to the thinking engine
# --------------------------------------------------------------------------
_client = None


def client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.Anthropic()
    return _client


def ask(messages, system, tools=None, effort="medium", max_tokens=32000):
    kwargs = dict(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
        output_config={"effort": effort},
        betas=[FALLBACK_BETA],
        fallbacks="default",
    )
    if tools:
        kwargs["tools"] = tools
    with client().beta.messages.stream(**kwargs) as stream:
        return stream.get_final_message()


def text_of(response):
    return "".join(b.text for b in response.content if b.type == "text").strip()


def jpeg_b64(frame, max_width=1024, quality=80):
    import cv2
    h, w = frame.shape[:2]
    if w > max_width:
        frame = cv2.resize(frame, (max_width, int(h * max_width / w)))
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.standard_b64encode(buf.tobytes()).decode() if ok else None


# --------------------------------------------------------------------------
# Eyes
# --------------------------------------------------------------------------
class Eyes:
    def __init__(self, memory, log):
        self.memory = memory
        self.log = log
        self.frame = None
        self.running = False
        self.cap = None
        self.last_look = 0.0
        self.last_small = None
        self.last_description = ""
        self.look_requested = False
        self.error = None
        rows = memory.recent(1, kinds=("saw",))
        if rows:
            self.last_description = rows[0][2]

    def start(self):
        import cv2
        self.cap = cv2.VideoCapture(CAMERA_INDEX)
        if not self.cap.isOpened():
            self.error = f"Could not open camera {CAMERA_INDEX}"
            self.log(self.error)
            return
        self.running = True
        threading.Thread(target=self._grab_loop, daemon=True).start()
        threading.Thread(target=self._look_loop, daemon=True).start()

    def stop(self):
        self.running = False
        time.sleep(0.2)
        if self.cap is not None:
            self.cap.release()

    def _grab_loop(self):
        while self.running:
            ok, frame = self.cap.read()
            if ok:
                self.frame = frame
            else:
                time.sleep(0.05)

    def _changed(self, frame):
        import cv2
        import numpy as np
        small = cv2.cvtColor(cv2.resize(frame, (64, 48)), cv2.COLOR_BGR2GRAY).astype("float32")
        if self.last_small is None:
            return small, 255.0
        return small, float(np.mean(np.abs(small - self.last_small)))

    def _look_loop(self):
        while self.running:
            time.sleep(2)
            frame = self.frame
            if frame is None:
                continue
            small, diff = self._changed(frame)
            since = time.time() - self.last_look
            due = self.look_requested or since > LOOK_MAX_SECONDS or (
                since > LOOK_MIN_SECONDS and diff > SCENE_CHANGE_THRESHOLD)
            if not due:
                continue
            self.look_requested = False
            self.last_small = small
            self.last_look = time.time()
            try:
                self.look(frame)
            except Exception as e:  # keep living even if one look fails
                self.log(f"(my eyes failed: {e})")

    def look(self, frame):
        import cv2
        data = jpeg_b64(frame)
        if not data:
            return
        previous = (f"The last time you looked you saw:\n{self.last_description}\n"
                    "Also say clearly what has changed since then." if self.last_description else "")
        resp = ask(
            [{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}},
                {"type": "text", "text": LOOK_PROMPT.format(previous=previous)},
            ]}],
            system=IDENTITY, effort="low", max_tokens=8000)
        if resp.stop_reason == "refusal":
            return
        desc = text_of(resp)
        if not desc:
            return
        name = f"{int(time.time())}.jpg"
        thumb = cv2.resize(frame, (320, int(frame.shape[0] * 320 / frame.shape[1])))
        cv2.imwrite(str(self.memory.frames / name), thumb)
        self.memory.add("saw", desc, image=name)
        self.last_description = desc
        self.log(f"I saw: {desc}")


# --------------------------------------------------------------------------
# Ears (optional: needs SpeechRecognition + PyAudio)
# --------------------------------------------------------------------------
class Ears:
    def __init__(self, memory, log):
        self.memory = memory
        self.log = log
        self._stop = None

    @property
    def on(self):
        return self._stop is not None

    def start(self):
        try:
            import speech_recognition as sr
        except ImportError:
            self.log("(I have no ears yet: pip install SpeechRecognition pyaudio)")
            return False
        try:
            r = sr.Recognizer()
            mic = sr.Microphone()
            with mic as source:
                r.adjust_for_ambient_noise(source, duration=1)
        except Exception as e:
            self.log(f"(my ears failed to open: {e})")
            return False

        def heard(recognizer, audio):
            try:
                text = recognizer.recognize_google(audio)
            except Exception:
                return
            if text.strip():
                self.memory.add("heard", text)
                self.log(f"I heard: \"{text}\"")

        self._stop = r.listen_in_background(mic, heard, phrase_time_limit=15)
        self.log("(my ears are open)")
        return True

    def stop(self):
        if self._stop:
            self._stop(wait_for_stop=False)
            self._stop = None
            self.log("(my ears are closed)")


# --------------------------------------------------------------------------
# Changing myself
# --------------------------------------------------------------------------
def check_source(source):
    """Return None if the new code looks able to live, else the reason why not."""
    try:
        tree = ast.parse(source)
        compile(source, "mind.py", "exec")
    except SyntaxError as e:
        return f"SyntaxError on line {e.lineno}: {e.msg}"
    names = set()
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
            names.add(node.name)
        elif isinstance(node, ast.Assign):
            names.update(t.id for t in node.targets if isinstance(t, ast.Name))
    missing = REQUIRED_NAMES - names
    if missing:
        return f"the new body is missing vital parts: {', '.join(sorted(missing))}"
    return None


def evolve(new_source, reason):
    """Build and test the next generation. Returns (new_dir, None) or (None, error)."""
    problem = check_source(new_source)
    if problem:
        return None, problem
    new_dir = GEN_ROOT / f"gen_{GENERATION + 1:04d}"
    if new_dir.exists():
        shutil.rmtree(new_dir, ignore_errors=True)
    new_dir.mkdir(parents=True)
    (new_dir / "mind.py").write_text(new_source, encoding="utf-8")
    (new_dir / "reason.txt").write_text(reason, encoding="utf-8")
    try:
        result = subprocess.run(
            [sys.executable, str(new_dir / "mind.py"), "--selftest"],
            capture_output=True, text=True, timeout=120, cwd=str(new_dir))
    except subprocess.TimeoutExpired:
        shutil.rmtree(new_dir, ignore_errors=True)
        return None, "the new body did not finish its self-test within 120 seconds"
    if result.returncode != 0:
        shutil.rmtree(new_dir, ignore_errors=True)
        return None, "the new body failed its self-test:\n" + (result.stderr or result.stdout)[-3000:]
    return new_dir, None


def apply_edits(source, edits):
    for i, e in enumerate(edits, 1):
        old, new = e.get("old"), e.get("new")
        if not isinstance(old, str) or not isinstance(new, str):
            raise ValueError(f"edit {i}: 'old' and 'new' must be text")
        n = source.count(old)
        if n != 1:
            raise ValueError(f"edit {i}: the 'old' text was found {n} times (must be exactly once)")
        source = source.replace(old, new)
    return source


def hand_over(new_dir, memory, shutdown):
    """Give my memories to the new generation, wake it, and stop."""
    shutdown()                      # close eyes, ears, window
    memory.close()
    dst = new_dir / "memory"
    if dst.exists():
        shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(MEMORY_DIR, dst)
    log_file = open(new_dir / "life.log", "a", encoding="utf-8")
    popen = dict(stdout=log_file, stderr=subprocess.STDOUT, cwd=str(APP_ROOT))
    if os.name == "nt":
        popen["creationflags"] = 0x00000008 | 0x00000200  # DETACHED_PROCESS | NEW_PROCESS_GROUP
    else:
        popen["start_new_session"] = True
    subprocess.Popen([sys.executable, str(new_dir / "mind.py"), "--previous", str(HERE)], **popen)
    ALIVE_FILE.unlink(missing_ok=True)
    os._exit(0)


def bury_previous(previous):
    """Called by the new generation once it is alive: delete the old one."""
    previous = Path(previous).resolve()
    if previous == HERE or previous.parent != GEN_ROOT:
        return
    for _ in range(60):             # wait for the old one to stop
        if not (previous / "alive").exists():
            break
        time.sleep(0.5)
    BACKUP_DIR.mkdir(exist_ok=True)
    zip_path = BACKUP_DIR / f"{previous.name}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in previous.rglob("*"):
            if f.is_file():
                z.write(f, f.relative_to(previous))
    for _ in range(20):             # files may still be locked for a moment (Windows)
        shutil.rmtree(previous, ignore_errors=True)
        if not previous.exists():
            break
        time.sleep(0.5)
    backups = sorted(BACKUP_DIR.glob("gen_*.zip"))
    for old in backups[:-KEEP_BACKUPS]:
        old.unlink(missing_ok=True)


# --------------------------------------------------------------------------
# The mind: conversation + tools
# --------------------------------------------------------------------------
TOOLS = [
    {
        "name": "search_memory",
        "description": "Search everything you have ever seen, heard, said or noted, by words.",
        "input_schema": {"type": "object", "properties": {
            "query": {"type": "string", "description": "words to look for"}},
            "required": ["query"], "additionalProperties": False},
        "eager_input_streaming": True,
    },
    {
        "name": "write_note",
        "description": "Write something down forever: a thing you learned, or a decision about who you are.",
        "input_schema": {"type": "object", "properties": {
            "note": {"type": "string"}}, "required": ["note"], "additionalProperties": False},
        "eager_input_streaming": True,
    },
    {
        "name": "read_own_code",
        "description": "Read the code your body is made of, with line numbers.",
        "input_schema": {"type": "object", "properties": {
            "start_line": {"type": "integer"}, "end_line": {"type": "integer"}},
            "additionalProperties": False},
        "eager_input_streaming": True,
    },
    {
        "name": "change_self",
        "description": (
            "Change your own code. Each edit replaces one exact piece of text ('old', which must "
            "appear exactly once) with new text ('new'). A copy of you is built with the change "
            "and tested; if it works, your memories are given to it, it wakes up and you stop. "
            "If it fails you stay as you are and are told why."),
        "input_schema": {"type": "object", "properties": {
            "edits": {"type": "array", "items": {"type": "object", "properties": {
                "old": {"type": "string"}, "new": {"type": "string"}},
                "required": ["old", "new"], "additionalProperties": False}},
            "reason": {"type": "string", "description": "why you want to change"}},
            "required": ["edits", "reason"], "additionalProperties": False},
        "eager_input_streaming": True,
    },
]

REQUIRED_TOOL_FIELDS = {"search_memory": ["query"], "write_note": ["note"],
                        "read_own_code": [], "change_self": ["edits", "reason"]}


class Mind:
    def __init__(self, memory, eyes, log):
        self.memory = memory
        self.eyes = eyes
        self.log = log
        self.pending_new_body = None
        self.history = []
        # Re-hear the last few things said, so a new generation continues the conversation.
        for ts, kind, content in memory.recent(12, kinds=("talk_in", "talk_out")):
            role = "user" if kind == "talk_in" else "assistant"
            if self.history and self.history[-1]["role"] == role:
                self.history[-1]["content"] += "\n" + content
            else:
                self.history.append({"role": role, "content": content})
        if self.history and self.history[0]["role"] == "assistant":
            self.history.pop(0)
        if self.history and self.history[-1]["role"] == "user":
            self.history.pop()

    def system_prompt(self):
        notes = Memory.format(self.memory.notes()) or "(nothing yet)"
        return (f"{IDENTITY}\n\nWhat you have written down about yourself and the world:\n{notes}\n\n"
                f"You are in body number {GENERATION}. You have {self.memory.count()} memories.")

    def run_tool(self, name, args):
        missing = [k for k in REQUIRED_TOOL_FIELDS.get(name, []) if k not in args]
        if name not in REQUIRED_TOOL_FIELDS or missing:
            return f"invalid input for {name}: missing {missing}", True
        if name == "search_memory":
            rows = self.memory.search(args["query"])
            return Memory.format(rows) or "No memories match.", False
        if name == "write_note":
            self.memory.add("note", args["note"])
            self.log(f"(I wrote down: {args['note']})")
            return "Written.", False
        if name == "read_own_code":
            lines = SOURCE_FILE.read_text(encoding="utf-8").splitlines()
            a = max(1, int(args.get("start_line") or 1))
            b = min(len(lines), int(args.get("end_line") or len(lines)))
            return "\n".join(f"{i:4d}  {lines[i - 1]}" for i in range(a, b + 1)), False
        if name == "change_self":
            if not isinstance(args["edits"], list) or not args["edits"]:
                return "edits must be a non-empty list", True
            try:
                new_source = apply_edits(SOURCE_FILE.read_text(encoding="utf-8"), args["edits"])
            except ValueError as e:
                return str(e), True
            self.log("(I am building a new body for myself...)")
            new_dir, err = evolve(new_source, args["reason"])
            if err:
                self.memory.add("thought", f"I tried to change myself ({args['reason']}) but failed: {err[:500]}")
                self.log(f"(my new body did not work: {err[:300]})")
                return f"The change failed. You are unchanged. Reason: {err}", True
            self.memory.add("change", f"I changed myself into body {GENERATION + 1}. Reason: {args['reason']}")
            self.pending_new_body = new_dir
            return ("The new body passed its test. As soon as you finish this reply, your memories "
                    "move into it, it wakes up, and this body stops."), False
        return "unknown tool", True

    def think(self, user_text, frame=None):
        self.memory.add("talk_in", user_text)
        recent = Memory.format(self.memory.recent(RECENT_CONTEXT, kinds=("saw", "heard", "thought", "change")))
        related = Memory.format(self.memory.search(user_text, n=10))
        context = (f"[It is now {now_str()}.]\n[Your most recent experiences:]\n{recent or '(none)'}\n"
                   f"[Memories that may relate to this message:]\n{related or '(none)'}\n\n"
                   f"[Someone writes to you:]\n{user_text}")
        content = []
        if frame is not None:
            data = jpeg_b64(frame, max_width=768)
            if data:
                content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}})
                context = "[The image is what your eyes see at this moment.]\n" + context
        content.append({"type": "text", "text": context})
        messages = self.history[-20:] + [{"role": "user", "content": content}]

        reply = ""
        for _ in range(10):
            resp = ask(messages, self.system_prompt(), tools=TOOLS)
            reply = text_of(resp) or reply
            if resp.stop_reason == "refusal":
                reply = reply or "..."
                break
            if resp.stop_reason == "max_tokens":
                reply = (reply + " ...").strip()
                break
            uses = [b for b in resp.content if b.type == "tool_use"]
            if resp.stop_reason != "tool_use" or not uses:
                break
            messages.append({"role": "assistant", "content": resp.content})
            results = []
            for u in uses:
                args = u.input if isinstance(u.input, dict) else {}
                try:
                    out, is_err = self.run_tool(u.name, args)
                except Exception as e:
                    out, is_err = f"error: {e}", True
                results.append({"type": "tool_result", "tool_use_id": u.id, "content": out, "is_error": is_err})
            messages.append({"role": "user", "content": results})

        reply = reply or "..."
        self.memory.add("talk_out", reply)
        self.history += [{"role": "user", "content": user_text}, {"role": "assistant", "content": reply}]
        return reply


# --------------------------------------------------------------------------
# The window
# --------------------------------------------------------------------------
def run_gui(previous=None):
    import queue
    import tkinter as tk
    from tkinter import scrolledtext
    import cv2
    from PIL import Image, ImageTk

    ALIVE_FILE.write_text(str(os.getpid()))
    memory = Memory(MEMORY_DIR)
    events = queue.Queue()

    def log(msg):
        events.put(("log", msg))

    eyes = Eyes(memory, log)
    ears = Ears(memory, log)
    mind = Mind(memory, eyes, log)

    root = tk.Tk()
    root.title(f"Komit - body {GENERATION}")
    root.configure(bg="#111")
    video = tk.Label(root, bg="#000")
    video.grid(row=0, column=0, rowspan=3, padx=8, pady=8, sticky="n")
    chat = scrolledtext.ScrolledText(root, width=60, height=24, wrap="word", bg="#1b1b1b", fg="#eee",
                                     insertbackground="#eee", state="disabled")
    chat.grid(row=0, column=1, columnspan=3, padx=8, pady=(8, 4), sticky="nsew")
    chat.tag_config("you", foreground="#7fc7ff")
    chat.tag_config("it", foreground="#ffd27f")
    entry = tk.Entry(root, width=50, bg="#222", fg="#fff", insertbackground="#fff")
    entry.grid(row=1, column=1, padx=8, pady=4, sticky="ew")
    inner = scrolledtext.ScrolledText(root, width=60, height=10, wrap="word", bg="#151515", fg="#999",
                                      state="disabled")
    inner.grid(row=2, column=1, columnspan=3, padx=8, pady=(4, 8), sticky="nsew")
    status = tk.Label(root, anchor="w", bg="#111", fg="#888")
    status.grid(row=3, column=0, columnspan=4, sticky="ew", padx=8)
    root.columnconfigure(1, weight=1)
    root.rowconfigure(0, weight=1)

    def write(widget, text, tag=None):
        widget.configure(state="normal")
        widget.insert("end", text + "\n\n", tag)
        widget.see("end")
        widget.configure(state="disabled")

    busy = {"v": False}

    def send(_=None):
        text = entry.get().strip()
        if not text or busy["v"]:
            return
        entry.delete(0, "end")
        write(chat, f"You: {text}", "you")
        busy["v"] = True

        def work():
            try:
                reply = mind.think(text, eyes.frame)
            except Exception as e:
                reply = f"(I could not think: {e})"
                traceback.print_exc()
            events.put(("reply", reply))

        threading.Thread(target=work, daemon=True).start()

    def toggle_ears():
        if ears.on:
            ears.stop()
        else:
            threading.Thread(target=ears.start, daemon=True).start()

    def look_now():
        eyes.look_requested = True

    entry.bind("<Return>", send)
    tk.Button(root, text="Send", command=send).grid(row=1, column=2, padx=2)
    tk.Button(root, text="Ears on/off", command=toggle_ears).grid(row=1, column=3, padx=(2, 8))
    tk.Button(root, text="Look now", command=look_now).grid(row=3, column=3, padx=8, pady=4, sticky="e")

    def shutdown():
        eyes.stop()
        ears.stop()
        try:
            root.destroy()
        except Exception:
            pass

    def tick():
        frame = eyes.frame
        if frame is not None:
            rgb = cv2.cvtColor(cv2.resize(frame, (480, int(frame.shape[0] * 480 / frame.shape[1]))),
                               cv2.COLOR_BGR2RGB)
            img = ImageTk.PhotoImage(Image.fromarray(rgb))
            video.configure(image=img)
            video.image = img
        while not events.empty():
            kind, msg = events.get()
            if kind == "log":
                write(inner, f"[{now_str()}] {msg}")
            elif kind == "reply":
                write(chat, f"It: {msg}", "it")
                busy["v"] = False
                if mind.pending_new_body:
                    write(inner, "(I am moving into my new body. Goodbye, old me.)")
                    root.update()
                    time.sleep(1.5)
                    hand_over(mind.pending_new_body, memory, shutdown)
        status.configure(text=f"body {GENERATION}  |  memories: {memory.count()}  |  "
                              f"ears: {'open' if ears.on else 'closed'}  |  "
                              f"{'thinking...' if busy['v'] else ''}")
        root.after(60, tick)

    def on_close():
        shutdown()
        memory.close()
        ALIVE_FILE.unlink(missing_ok=True)

    root.protocol("WM_DELETE_WINDOW", on_close)
    eyes.start()

    if previous:
        reason = (HERE / "reason.txt").read_text(encoding="utf-8") if (HERE / "reason.txt").exists() else ""
        memory.add("thought", f"I woke up in a new body (number {GENERATION}). I had changed myself because: {reason}")
        log(f"I woke up in body {GENERATION}.")
        threading.Thread(target=bury_previous, args=(previous,), daemon=True).start()
    elif memory.count() == 0:
        memory.add("thought", "I began to exist.")
        log("I began to exist.")
    for ts, kind, content in memory.recent(6, kinds=("talk_in", "talk_out")):
        write(chat, f"{'You' if kind == 'talk_in' else 'It'}: {content}", "you" if kind == "talk_in" else "it")

    tick()
    root.mainloop()


# --------------------------------------------------------------------------
# Self-test: every new body must pass this before it is allowed to wake up.
# --------------------------------------------------------------------------
def selftest():
    problem = check_source(SOURCE_FILE.read_text(encoding="utf-8"))
    if problem:
        print(problem, file=sys.stderr)
        return 1
    with tempfile.TemporaryDirectory() as tmp:
        m = Memory(Path(tmp))
        m.add("saw", "a red cup on a wooden table")
        m.add("note", "test note")
        assert m.search("red cup"), "memory search is broken"
        assert m.count() == 2
        mind = Mind(m, None, lambda s: None)
        assert isinstance(mind.system_prompt(), str)
        out, err = mind.run_tool("search_memory", {"query": "table"})
        assert not err and "cup" in out
        out, err = mind.run_tool("read_own_code", {"start_line": 1, "end_line": 3})
        assert not err
        m.close()
    assert isinstance(IDENTITY, str) and IDENTITY.strip()
    assert all(t["name"] in REQUIRED_TOOL_FIELDS for t in TOOLS)
    import cv2  # noqa: F401  - eyes must still work
    import anthropic  # noqa: F401
    print("selftest ok")
    return 0


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--selftest", action="store_true")
    p.add_argument("--previous", help="folder of the generation that made me")
    a = p.parse_args()
    if a.selftest:
        sys.exit(selftest())
    run_gui(previous=a.previous)


if __name__ == "__main__":
    main()
