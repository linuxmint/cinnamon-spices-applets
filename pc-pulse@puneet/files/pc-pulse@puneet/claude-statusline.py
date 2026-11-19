#!/usr/bin/env python3
"""Claude Code status line that also feeds the PC Pulse panel applet.

Claude Code passes a JSON blob on stdin to its statusLine command. On plans
with usage limits it includes `rate_limits.five_hour` and `rate_limits.seven_day`
(`used_percentage`, `resets_at` in epoch seconds). This script saves those to
  ~/.cache/pc-pulse/claude-limits.json
which the applet reads, and prints a short status line.

Set it up in ~/.claude/settings.json:
  "statusLine": {
    "type": "command",
    "command": "python3 ~/.local/share/cinnamon/applets/pc-pulse@puneet/claude-statusline.py"
  }

Already have a status line? Keep it and chain it:
  "command": "python3 .../claude-statusline.py --chain 'your existing command'"
The JSON is passed on to that command and its output is printed instead.

The figures only refresh while a Claude Code session is open.
"""
import json
import os
import subprocess
import sys
import time

CACHE = os.path.join(os.environ.get("XDG_CACHE_HOME") or os.path.expanduser("~/.cache"), "pc-pulse")
OUT = os.path.join(CACHE, "claude-limits.json")


def merge(old, new):
    """Keep the higher reading for the same window: several open sessions can
    report an older, lower figure, and usage within one window never goes down."""
    out = dict(new)
    for name, win in (old or {}).items():
        cur = out.get(name)
        if not isinstance(win, dict) or not isinstance(cur, dict):
            continue
        if cur.get("resets_at") == win.get("resets_at") and \
                (win.get("used_percentage") or 0) > (cur.get("used_percentage") or 0):
            out[name] = win
    return out


def save(limits):
    os.makedirs(CACHE, exist_ok=True)
    old = {}
    try:
        with open(OUT) as f:
            old = json.load(f).get("rate_limits") or {}
    except (OSError, ValueError):
        pass
    data = {"saved_at": time.time(), "rate_limits": merge(old, limits)}
    tmp = OUT + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f)
    os.replace(tmp, OUT)
    return data["rate_limits"]


def main():
    raw = sys.stdin.read()
    try:
        info = json.loads(raw)
    except ValueError:
        info = {}
    limits = info.get("rate_limits") or {}
    if limits:
        try:
            limits = save(limits)
        except OSError:
            pass

    if "--chain" in sys.argv:
        i = sys.argv.index("--chain")
        if i + 1 < len(sys.argv):
            r = subprocess.run(sys.argv[i + 1], shell=True, input=raw, text=True, capture_output=True)
            sys.stdout.write(r.stdout)
            return

    parts = []
    model = (info.get("model") or {}).get("display_name")
    if model:
        parts.append(model)
    for key, label in (("five_hour", "5h"), ("seven_day", "wk")):
        win = limits.get(key)
        if isinstance(win, dict) and win.get("used_percentage") is not None:
            parts.append("%s %d%%" % (label, round(win["used_percentage"])))
    print(" | ".join(parts) or "Claude")


if __name__ == "__main__":
    main()
