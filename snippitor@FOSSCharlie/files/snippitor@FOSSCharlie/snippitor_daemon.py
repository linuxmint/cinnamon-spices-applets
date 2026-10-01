#!/usr/bin/env python3
"""
Snippitor daemon.

Copyright (C) 2026  FOSSCharlie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.

USE AT YOUR OWN RISK: this software is provided "as is", without
warranty of any kind, express or implied. See the LICENSE file
included with this applet for the full text.

---

Watches everything you type system-wide (X11 only) and, when you type one
of your configured trigger strings followed by a "boundary" character
(space, tab, enter, or punctuation), deletes the trigger and types the
expansion in its place.

Config file: <this applet's folder>/data/expansions.json
    {
        "c#": "Charlie",
        "brb": "be right back"
    }

The daemon polls the config file's mtime every couple of seconds and
reloads automatically, so the GUI editor doesn't need to signal it.

KNOWN LIMITATION: this watches keystrokes passively and corrects
afterward (delete + retype) rather than truly intercepting them before
they reach the app - X11 has no reliable way to do the latter without
also blocking this script's own corrective keystrokes (a genuine,
well-known limitation of building tools like this on X11, shared by
tools like AutoKey/espanso). At very fast/bursty typing speeds, a race
between your next keystrokes and this script's correction can rarely
cause a small glitch (e.g. a missing space). If that happens, just fix
that one instance manually - it won't happen on every expansion.

On some systems, a duplicate "echo" of this script's own corrective
backspaces can arrive noticeably late (well over a second, on at least
one tested machine). To absorb that safely without freezing keystroke
processing, this script stays in a brief "just corrected something"
grace period (~0.6s) after each expansion, during which a new trigger
won't be recognized (it's typed through literally instead). Expansions
typed back-to-back within that window are the one known tradeoff of
this approach - everything else types normally during that time.
"""

import json
import os
import string
import sys
import threading
import time

# Use the pynput copy bundled alongside this script instead of requiring a
# separate system-wide install.
_VENDOR_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor")
if os.path.isdir(_VENDOR_DIR) and _VENDOR_DIR not in sys.path:
    sys.path.insert(0, _VENDOR_DIR)

from pynput import keyboard

# Data lives INSIDE the applet's own folder rather than ~/.config, so
# that however the applet gets removed (right-click Remove, or the
# Applets "Manage & Download" uninstall action, which may not run any
# of this script's own cleanup code at all) deleting the applet folder
# naturally takes its data with it too - no cleanup hook required.
CONFIG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
CONFIG_FILE = os.path.join(CONFIG_DIR, "expansions.json")

# One-time migration from the old ~/.config location used by earlier
# versions of this applet, so upgrading doesn't lose existing triggers.
_OLD_CONFIG_FILE = os.path.expanduser("~/.config/snippitor/expansions.json")

# Characters that always count as "still typing a trigger word".
# Any additional symbol used in an actual configured trigger (like the
# "#" in "c#", or "%" in a custom "d%" trigger) is added dynamically in
# Snippitor._update_word_chars() - so any symbol the user picks in the
# GUI editor works automatically, without needing to be hardcoded here.
BASE_WORD_CHARS = set(string.ascii_letters + string.digits)

DEFAULT_EXPANSIONS = {
    "tel#": "01234567890",
}


def _restrict_permissions():
    """Data here can include personal info (phone numbers, addresses,
    etc, given what people naturally store trigger phrases for) - keep it
    private to the owner rather than the default umask, which is often
    world-readable (644/755) on many systems."""
    try:
        os.chmod(CONFIG_DIR, 0o700)
    except OSError:
        pass
    try:
        os.chmod(CONFIG_FILE, 0o600)
    except OSError:
        pass


def ensure_config():
    os.makedirs(CONFIG_DIR, exist_ok=True)
    if not os.path.exists(CONFIG_FILE):
        if os.path.exists(_OLD_CONFIG_FILE):
            # Migrate existing triggers from the old ~/.config location
            # used by earlier versions of this applet.
            try:
                with open(_OLD_CONFIG_FILE, "r") as f:
                    old_data = json.load(f)
                if isinstance(old_data, dict) and old_data:
                    with open(CONFIG_FILE, "w") as f:
                        json.dump(old_data, f, indent=2)
                    _restrict_permissions()
                    return
            except Exception:
                pass
        with open(CONFIG_FILE, "w") as f:
            json.dump(DEFAULT_EXPANSIONS, f, indent=2)
    _restrict_permissions()


def load_expansions():
    try:
        with open(CONFIG_FILE, "r") as f:
            data = json.load(f)
        if isinstance(data, dict):
            # Defensively filter out any malformed entries (e.g. from a
            # hand-edited or corrupted config file) rather than trusting
            # the file blindly - a non-string trigger or expansion would
            # otherwise reach pynput's Controller.type() later and raise,
            # which on_press now survives, but it's better to never load
            # bad data in the first place.
            return {
                k: v for k, v in data.items()
                if isinstance(k, str) and isinstance(v, str)
            }
    except Exception:
        pass
    return dict(DEFAULT_EXPANSIONS)


class Snippitor:
    BOUNDARY_KEYS = {
        keyboard.Key.space,
        keyboard.Key.tab,
        keyboard.Key.enter,
    }

    # Modifier/lock keys that are routinely held down to produce a shifted
    # character (Shift+3 -> "#", Shift+a -> "A", AltGr+... etc). These must
    # be ignored entirely - not treated as boundaries and not allowed to
    # reset the in-progress buffer - otherwise typing any shifted symbol
    # or capital letter breaks trigger matching.
    MODIFIER_KEYS = {
        keyboard.Key.shift, keyboard.Key.shift_l, keyboard.Key.shift_r,
        keyboard.Key.ctrl, keyboard.Key.ctrl_l, keyboard.Key.ctrl_r,
        keyboard.Key.alt, keyboard.Key.alt_l, keyboard.Key.alt_r, keyboard.Key.alt_gr,
        keyboard.Key.cmd, keyboard.Key.cmd_l, keyboard.Key.cmd_r,
        keyboard.Key.caps_lock, keyboard.Key.num_lock, keyboard.Key.scroll_lock,
    }

    def __init__(self):
        ensure_config()
        self.expansions = load_expansions()
        self._mtime = self._get_mtime()
        self.word_chars = set(BASE_WORD_CHARS)
        self._update_word_chars()
        self.buffer = ""
        self.suppress = False  # true while we are typing a replacement ourselves
        self.controller = keyboard.Controller()

        self._stop = False
        self._reload_thread = threading.Thread(target=self._reload_loop, daemon=True)
        self._reload_thread.start()

    def _update_word_chars(self):
        """Recompute which non-alphanumeric characters count as "still
        typing a trigger word", based on whatever symbols actually appear
        in the configured triggers - so any custom trigger (e.g. "d%")
        works without needing its symbols hardcoded anywhere."""
        chars = set(BASE_WORD_CHARS)
        for trigger in self.expansions.keys():
            for ch in trigger:
                if ch not in BASE_WORD_CHARS:
                    chars.add(ch)
        self.word_chars = chars

    def _get_mtime(self):
        try:
            return os.path.getmtime(CONFIG_FILE)
        except OSError:
            return None

    def _reload_loop(self):
        while not self._stop:
            time.sleep(2)
            m = self._get_mtime()
            if m != self._mtime:
                self._mtime = m
                self.expansions = load_expansions()
                self._update_word_chars()

    # Character equivalents for boundary keys that aren't already plain
    # characters, so the boundary can always be retyped via .type() - the
    # same mechanism already used for the expansion text and for
    # punctuation boundaries, and proven reliable. Retyping Key.space via
    # raw press()/release() instead of .type(' ') was found to silently
    # fail to land on at least one real system, even in complete
    # isolation with nothing typed afterward - so that path is avoided
    # entirely now rather than only used as a fallback.
    BOUNDARY_CHAR_MAP = {
        keyboard.Key.space: " ",
        keyboard.Key.tab: "\t",
        keyboard.Key.enter: "\n",
    }

    def _do_replacement(self, trigger, expansion, boundary):
        self.suppress = True
        try:
            # By the time we notice the boundary key, it has already landed
            # in the focused field (passive listeners can't intercept before
            # delivery) - so we need to delete the trigger AND the boundary
            # character, then retype the expansion followed by the boundary.
            # These small delays help GTK/IBus-based apps register each
            # synthetic event distinctly. Counterintuitively, making this
            # sequence much longer does NOT reduce the risk of colliding
            # with continued typing - it increases it, since the user's
            # next keystrokes keep arriving on their own schedule regardless
            # of how long this takes. Keep this tight.
            total_to_delete = len(trigger) + 1
            for _ in range(total_to_delete):
                self.controller.press(keyboard.Key.backspace)
                self.controller.release(keyboard.Key.backspace)
                time.sleep(0.005)
            self.controller.type(expansion)

            boundary_char = boundary if isinstance(boundary, str) else self.BOUNDARY_CHAR_MAP.get(boundary)
            if boundary_char is not None:
                self.controller.type(boundary_char)
            else:
                # No character mapping available (an unrecognized special
                # key) - fall back to press/release.
                self.controller.press(boundary)
                time.sleep(0.01)
                self.controller.release(boundary)
        finally:
            # Some systems deliver a delayed duplicate "echo" of our own
            # synthetic backspace events well after we finish sending them.
            # Blocking this thread to wait them out doesn't work - on_press
            # and this function run on the SAME thread as event dispatch,
            # so sleeping here makes the listener deaf to everything
            # (including those echoes) until the sleep ends, and they just
            # pile up and land the instant we stop, which fixes nothing.
            # Instead, un-suppress asynchronously via a timer: this
            # function returns immediately, the listener thread stays live
            # and keeps processing events normally, and the grace period
            # below still correctly filters out any delayed echoes because
            # the listener is actually running while they arrive.
            timer = threading.Timer(0.6, self._clear_suppress)
            timer.daemon = True
            timer.start()

    def _clear_suppress(self):
        self.suppress = False

    def on_press(self, key):
        try:
            self._handle_press(key)
        except Exception:
            # A single unexpected error here (e.g. a malformed entry from
            # a hand-edited or bad imported config file) must never be
            # allowed to kill the listener thread - pynput re-raises
            # uncaught callback exceptions into the thread that calls
            # .join(), which would silently take down the entire daemon
            # with no visible error, since it normally runs detached.
            # Reset to a safe state and keep going instead.
            self.buffer = ""
            self.suppress = False

    def _handle_press(self, key):
        if self.suppress:
            return

        if key in self.MODIFIER_KEYS:
            return

        # Resolve to a printable character where possible
        char = None
        try:
            char = key.char
        except AttributeError:
            char = None

        if char is not None:
            if char in self.word_chars:
                self.buffer += char
                if len(self.buffer) > 60:
                    self.buffer = self.buffer[-60:]
                return
            else:
                # a punctuation/symbol character typed via .char (e.g. "@")
                # falls through to boundary handling below
                pass

        is_boundary = key in self.BOUNDARY_KEYS or (char is not None and char not in self.word_chars)

        if key == keyboard.Key.backspace:
            self.buffer = self.buffer[:-1]
            return

        if is_boundary:
            trigger = self.buffer
            if trigger in self.expansions:
                expansion = self.expansions[trigger]
                # If the boundary came through as a literal character
                # (space, or punctuation like "," or "."), retype that
                # character. Otherwise it's a special key (tab/enter) -
                # retype it by pressing that key again.
                boundary = char if char is not None else key
                self._do_replacement(trigger, expansion, boundary)
            self.buffer = ""
            return

        # Any other non-word, non-boundary key (arrows, function keys, etc.)
        # breaks the current word buffer.
        if char is None and key not in self.BOUNDARY_KEYS:
            self.buffer = ""

    def run(self):
        with keyboard.Listener(on_press=self.on_press) as listener:
            listener.join()


if __name__ == "__main__":
    Snippitor().run()
