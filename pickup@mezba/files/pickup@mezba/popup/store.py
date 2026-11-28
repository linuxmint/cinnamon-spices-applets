# -*- coding: utf-8 -*-
"""Storage layer for Pickup.

Everything persisted lives in one small JSON file (~/.config/pickup/state.json)
plus sibling files for large text blobs (~/.config/pickup/texts/<id>.txt).

Design notes:
  * Files are only *referenced* by path -- never copied. Dropping a 4 GB video
    costs a few hundred bytes of JSON.
  * Text under TEXT_INLINE_LIMIT is stored inline in the JSON so the common case
    is one file read. Anything bigger is spilled to texts/<id>.txt; the JSON
    keeps just the id + a short preview, so the item list stays fast to load.
  * Writes are atomic (tmp file + os.replace) because the popup process can be
    killed at any moment by the session.
"""

import errno
import json
import os
import stat
import time
import uuid

# --- tunables ---------------------------------------------------------------
CONFIG_DIR = os.path.join(
    os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config"), "pickup"
)
STATE_PATH = os.path.join(CONFIG_DIR, "state.json")
TEXTS_DIR = os.path.join(CONFIG_DIR, "texts")

# Safety net only. Text items are meant to hold entire multi-page prompts, so
# this is 1 MB of UTF-8 text (~1 million ASCII characters). Nothing in the UI
# hints at a limit until it is actually hit.
MAX_TEXT_BYTES = 1024 * 1024

# Text longer than this is spilled to its own file instead of living in the
# JSON blob. Kept small so state.json stays snappy to parse.
TEXT_INLINE_LIMIT = 8 * 1024

# Preview length in characters for text items and card labels.
PREVIEW_CHARS = 120

# Unpinned items disappear this long after being added (see store.prune).
MAX_AGE_SECONDS = 48 * 60 * 60

# "Clear all" keeps pinned items. Flip to False to make it wipe everything.
CLEAR_ALL_KEEPS_PINNED = True

KIND_FILE = "file"
KIND_TEXT = "text"


def now():
    return time.time()


def _ensure_dirs():
    os.makedirs(CONFIG_DIR, exist_ok=True)
    os.makedirs(TEXTS_DIR, exist_ok=True)


def _atomic_write_json(path, payload):
    _ensure_dirs()
    tmp = "%s.%d.tmp" % (path, os.getpid())
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)


class Store:
    """Item list + preferences, backed by one JSON file.

    The object keeps an in-memory copy and saves on every mutation. The file is
    tiny (paths, ids, timestamps), so this is cheap and keeps the on-disk state
    consistent even if the popup is killed a moment later.
    """

    def __init__(self, path=STATE_PATH, texts_dir=TEXTS_DIR):
        self.path = path
        self.texts_dir = texts_dir
        self.items = []
        self.prefs = {
            "layout": "grid",
            "width": 560,
            "height": 560,
            "position": None,
            "theme": None,  # None = follow system, else "dark" / "light"
        }
        self.load()

    # -- persistence ---------------------------------------------------------
    def load(self):
        try:
            with open(self.path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except FileNotFoundError:
            data = {}
        except (OSError, ValueError):
            # Unreadable/corrupt: keep a copy instead of silently starting
            # empty and overwriting the user's shelf on the next save.
            data = {}
            try:
                os.replace(self.path, self.path + ".broken")
            except OSError:
                pass
        if not isinstance(data, dict):
            data = {}
        items = data.get("items")
        self.items = [i for i in items if isinstance(i, dict) and i.get("id")] if isinstance(items, list) else []
        prefs = data.get("prefs")
        if isinstance(prefs, dict):
            self.prefs.update({k: v for k, v in prefs.items() if k in self.prefs})
        # Drop references to spilled text files that are no longer needed.
        self._collect_text_orphans()

    def save(self):
        try:
            _atomic_write_json(self.path, {"version": 1, "prefs": self.prefs, "items": self.items})
        except OSError as exc:
            print("pickup: could not save state: %s" % exc)

    def _collect_text_orphans(self):
        """Delete text blobs not referenced by any item (best effort)."""
        try:
            names = os.listdir(self.texts_dir)
        except OSError:
            return
        keep = {i["text_ref"] for i in self.items if i.get("text_ref")}
        for name in names:
            if not name.endswith(".txt"):
                continue
            stem = name[:-4]
            if stem not in keep:
                try:
                    full = os.path.join(self.texts_dir, name)
                    if time.time() - os.path.getmtime(full) < 60:
                        continue
                    os.unlink(full)
                except OSError:
                    pass

    # -- text helpers --------------------------------------------------------
    def _write_text_blob(self, item_id, text):
        os.makedirs(self.texts_dir, exist_ok=True)
        ref = item_id
        final = os.path.join(self.texts_dir, ref + ".txt")
        tmp = final + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.replace(tmp, final)
        return ref

    def _read_text_blob(self, ref):
        try:
            with open(os.path.join(self.texts_dir, ref + ".txt"), "r", encoding="utf-8") as fh:
                return fh.read()
        except OSError:
            return ""

    def _delete_text_blob(self, ref):
        if not ref:
            return
        try:
            os.unlink(os.path.join(self.texts_dir, ref + ".txt"))
        except OSError:
            pass

    # -- item access ---------------------------------------------------------
    def get_text(self, item):
        """Full text of a text item, reading the spilled file if needed."""
        if item.get("kind") != KIND_TEXT:
            return ""
        if item.get("text_ref"):
            return self._read_text_blob(item["text_ref"])
        return item.get("text") or ""

    def _normalize_path(self, path):
        try:
            return os.path.abspath(os.path.expanduser(path))
        except (TypeError, ValueError):
            return None

    def _file_key(self, path):
        """Identity of a file for duplicate detection.

        Prefer (device, inode) so the same file reached through a symlink or a
        different mount path is still recognised, with the absolute path as a
        fallback for files that cannot be stat'ed.
        """
        try:
            st = os.stat(path)
            return "inode:%d:%d" % (st.st_dev, st.st_ino)
        except OSError:
            return "path:" + path

    def find_file(self, path):
        key = self._file_key(path)
        norm = self._normalize_path(path)
        for item in self.items:
            if item.get("kind") != KIND_FILE:
                continue
            if item.get("key") == key:
                return item
            if norm and item.get("path") == norm:
                return item
        return None

    def add_file(self, path, uri=None):
        """Add a path reference. Returns (item, created). Never copies.

        Existing entries are not duplicated; they are bumped to the top with a
        refreshed timestamp instead.
        """
        norm = self._normalize_path(path)
        if not norm:
            return None, False
        existing = self.find_file(norm)
        if existing is not None:
            existing["added"] = now()
            self._to_front(existing)
            self.save()
            return existing, False
        item = {
            "id": uuid.uuid4().hex[:12],
            "kind": KIND_FILE,
            "path": norm,
            "uri": uri or "",
            "key": self._file_key(norm),
            "added": now(),
            "pinned": False,
            "is_dir": os.path.isdir(norm),
        }
        self.items.insert(0, item)
        self.save()
        return item, True

    def add_files(self, paths):
        created = 0
        for path in paths:
            _item, was_created = self.add_file(path)
            if was_created:
                created += 1
        return created

    def find_text(self, text):
        """Duplicate detection for text: compare the full text."""
        for item in self.items:
            if item.get("kind") == KIND_TEXT and self.get_text(item) == text:
                return item
        return None

    def add_text(self, text):
        if not isinstance(text, str):
            return None, False
        text = text.strip("\x00")
        if not text.strip():
            return None, False
        raw = text.encode("utf-8", "replace")
        if len(raw) > MAX_TEXT_BYTES:
            # Hard safety net: keep the head of an absurdly large drop instead
            # of failing outright, and mark it so the UI can say so.
            text = raw[:MAX_TEXT_BYTES].decode("utf-8", "ignore")
            truncated = True
        else:
            truncated = False
        existing = self.find_text(text)
        if existing is not None:
            existing["added"] = now()
            self._to_front(existing)
            self.save()
            return existing, False
        item_id = uuid.uuid4().hex[:12]
        item = {
            "id": item_id,
            "kind": KIND_TEXT,
            "added": now(),
            "pinned": False,
            "chars": len(text),
            "preview": _preview(text),
            "truncated": truncated,
        }
        if len(text.encode("utf-8", "replace")) > TEXT_INLINE_LIMIT:
            item["text_ref"] = self._write_text_blob(item_id, text)
        else:
            item["text"] = text
        self.items.insert(0, item)
        self.save()
        return item, True

    def _to_front(self, item):
        try:
            self.items.remove(item)
        except ValueError:
            return
        self.items.insert(0, item)

    def remove(self, item_id):
        for index, item in enumerate(self.items):
            if item.get("id") == item_id:
                self._delete_text_blob(item.get("text_ref"))
                del self.items[index]
                self.save()
                return True
        return False

    def clear_all(self, keep_pinned=CLEAR_ALL_KEEPS_PINNED):
        if keep_pinned:
            kept = [i for i in self.items if i.get("pinned")]
        else:
            kept = []
        removed = [i for i in self.items if i not in kept]
        for item in removed:
            self._delete_text_blob(item.get("text_ref"))
        self.items = kept
        self.save()
        return len(removed)

    def toggle_pin(self, item_id):
        for item in self.items:
            if item.get("id") == item_id:
                item["pinned"] = not item.get("pinned")
                self.save()
                return item["pinned"]
        return None

    def set_pinned(self, item_id, pinned):
        for item in self.items:
            if item.get("id") == item_id:
                item["pinned"] = bool(pinned)
                self.save()
                return True
        return False

    # -- maintenance ---------------------------------------------------------
    def prune(self, max_age=MAX_AGE_SECONDS, current=None):
        """Remove expired unpinned items. Call on popup open / applet load."""
        current = now() if current is None else current
        cutoff = current - max_age
        survivors = []
        removed = 0
        for item in self.items:
            if item.get("pinned"):
                survivors.append(item)
            elif float(item.get("added") or 0) >= cutoff:
                survivors.append(item)
            else:
                self._delete_text_blob(item.get("text_ref"))
                removed += 1
        if removed:
            self.items = survivors
            self.save()
        return removed

    def is_missing(self, item):
        if item.get("kind") != KIND_FILE:
            return False
        return not os.path.exists(item.get("path") or "")

    def check_missing(self):
        """Annotate items with a transient 'missing' flag (not persisted)."""
        missing = 0
        for item in self.items:
            item["missing"] = self.is_missing(item)
            if item["missing"]:
                missing += 1
        return missing

    def count(self):
        return len(self.items)

    def set_pref(self, key, value):
        if key in self.prefs and self.prefs.get(key) != value:
            self.prefs[key] = value
            self.save()

def _preview(text, limit=PREVIEW_CHARS):
    """First few words, single line, for card labels."""
    flat = " ".join(text.split())
    if len(flat) <= limit:
        return flat
    return flat[: limit - 1].rstrip() + "\u2026"


def path_to_uri(path):
    """Absolute local path -> file:// URI (percent-encoded)."""
    from urllib.parse import quote

    return "file://" + quote(os.path.abspath(path), safe="/@")


def uri_to_path(uri):
    """Accept file:// URIs and bare paths; return a local path or None."""
    if not uri:
        return None
    uri = uri.strip()
    if uri.startswith("file://"):
        from urllib.parse import unquote, urlparse

        parsed = urlparse(uri)
        if parsed.netloc and parsed.netloc not in ("", "localhost"):
            return None
        return unquote(parsed.path)
    if uri.startswith("/"):
        return uri
    return None


def human_size(num_bytes):
    try:
        num_bytes = float(num_bytes)
    except (TypeError, ValueError):
        return ""
    units = ["B", "KB", "MB", "GB", "TB"]
    index = 0
    while num_bytes >= 1024 and index < len(units) - 1:
        num_bytes /= 1024.0
        index += 1
    if index == 0:
        return "%d B" % int(num_bytes)
    if num_bytes < 10:
        return "%.1f %s" % (num_bytes, units[index])
    return "%.0f %s" % (num_bytes, units[index])


def item_size(item):
    """Size in bytes for display, or None when unknown (text, missing files)."""
    if item.get("kind") == KIND_TEXT:
        return None
    try:
        st = os.stat(item.get("path") or "")
    except OSError:
        return None
    if stat.S_ISDIR(st.st_mode):
        try:
            return sum(1 for _ in os.scandir(item["path"]))
        except OSError:
            return None
    return st.st_size
