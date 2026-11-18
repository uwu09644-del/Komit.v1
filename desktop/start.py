#!/usr/bin/env python3
"""
Start the being.

    python start.py              wake up the newest generation (creates the first one if needed)
    python start.py --rollback   throw away the newest generation and restore the backed-up one
    python start.py --reset      forget everything and start a brand-new being (asks first)
"""
import argparse
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SEED = ROOT / "seed" / "mind.py"
GENS = ROOT / "generations"
BACKUPS = ROOT / "backups"


def generations():
    return sorted(d for d in GENS.glob("gen_*") if (d / "mind.py").exists())


def newest():
    gens = generations()
    if not gens:
        first = GENS / "gen_0001"
        first.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SEED, first / "mind.py")
        print("A new being is born: generation 1")
        return first
    # Unfinished generations (no memory handed over yet) are leftovers of a failed change.
    for g in reversed(gens):
        if (g / "memory").exists() or g == gens[0]:
            return g
    return gens[-1]


def rollback():
    zips = sorted(BACKUPS.glob("gen_*.zip"))
    if not zips:
        print("No backup to roll back to.")
        return
    z = zips[-1]
    target = GENS / z.stem
    for g in generations():
        if g.name > z.stem:
            print(f"Removing {g.name}")
            shutil.rmtree(g)
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(z) as f:
        f.extractall(target)
    (target / "alive").unlink(missing_ok=True)
    print(f"Restored {z.stem}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--rollback", action="store_true")
    p.add_argument("--reset", action="store_true")
    a = p.parse_args()
    if a.reset:
        if input("This erases ALL memories forever. Type 'yes': ").strip() == "yes":
            shutil.rmtree(GENS, ignore_errors=True)
            shutil.rmtree(BACKUPS, ignore_errors=True)
            print("Erased.")
        return
    if a.rollback:
        rollback()
    gen = newest()
    (gen / "alive").unlink(missing_ok=True)
    print(f"Waking {gen.name} ...")
    sys.exit(subprocess.call([sys.executable, str(gen / "mind.py")], cwd=str(ROOT)))


if __name__ == "__main__":
    main()
