# -*- coding: utf-8 -*-
"""Thumbnail helpers for Pickup.

Implements just enough of the freedesktop thumbnail spec to *share* the normal
thumbnail cache used by Nemo and friends:

    ~/.cache/thumbnails/normal/<md5-of-file-uri>.png

A cached thumbnail is reused when its embedded ``Thumb::MTime`` matches the
file's mtime, so opening the popup repeatedly never regenerates anything.
Generation only happens for items that are about to become visible.

Images use GdkPixbuf. Videos use ``ffmpegthumbnailer`` when installed and fall
back to a single-frame ``ffmpeg`` grab; with neither available we return None
and the UI shows a normal file icon instead.
"""

import hashlib
import os
import shutil
import subprocess
import tempfile
import urllib.parse

import gi

gi.require_version("GdkPixbuf", "2.0")
from gi.repository import GdkPixbuf  # noqa: E402

THUMB_SIZE = 128
_CACHE_ROOT = os.path.join(
    os.environ.get("XDG_CACHE_HOME") or os.path.expanduser("~/.cache"), "thumbnails"
)
NORMAL_DIR = os.path.join(_CACHE_ROOT, "normal")

IMAGE_MIME_PREFIX = "image/"
VIDEO_MIME_PREFIX = "video/"

# Formats GdkPixbuf can be trusted with. Anything else in image/* (heic in some
# builds, psd, ...) simply yields no thumbnail.
_PIXBUF_SAFE = {"png", "jpeg", "jpg", "gif", "bmp", "webp", "tiff", "tif", "svg", "ico", "jxl"}

_memory_cache = {}


def _file_uri(path):
    return "file://" + urllib.parse.quote(os.path.abspath(path), safe="/@")


def _cache_path(path):
    digest = hashlib.md5(_file_uri(path).encode("utf-8")).hexdigest()
    return os.path.join(NORMAL_DIR, digest + ".png")


def _read_png_text(path):
    """Return PNG tEXt/iTXt chunks as a dict, or {} on failure.

    GdkPixbuf's get_option() only exposes *some* tEXt keys depending on how the
    pixbuf was loaded (the "tEXt::" prefix is inconsistent across versions), so
    the thumbnail metadata is read straight from the container instead.
    """
    try:
        with open(path, "rb") as fh:
            data = fh.read()
    except OSError:
        return {}
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        return {}
    chunks = {}
    pos = 8
    total = len(data)
    while pos + 8 <= total:
        try:
            length = int.from_bytes(data[pos : pos + 4], "big")
        except ValueError:
            break
        if length < 0 or pos + 12 + length > total:
            break
        kind = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + length]
        if kind == b"tEXt" and b"\x00" in payload:
            key, _, value = payload.partition(b"\x00")
            chunks[key.decode("latin-1")] = value.decode("latin-1")
        pos += 12 + length
        if kind == b"IEND":
            break
    return chunks


def _is_cache_fresh(cache_file, mtime):
    try:
        stat = os.stat(cache_file)
    except OSError:
        return False
    # Cheap check first: the cache file must not be older than the source.
    if stat.st_mtime + 1 < mtime:
        return False
    recorded = _read_png_text(cache_file).get("Thumb::MTime")
    if recorded is None:
        return True
    try:
        return int(recorded) == int(mtime)
    except (TypeError, ValueError):
        return False


def _save_thumbnail(pixbuf, cache_file, uri, mtime):
    os.makedirs(os.path.dirname(cache_file), exist_ok=True)
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".png", dir=os.path.dirname(cache_file))
    os.close(tmp_fd)
    try:
        pixbuf.savev(
            tmp_path,
            "png",
            ["tEXt::Thumb::URI", "tEXt::Thumb::MTime", "tEXt::Software"],
            [uri, str(int(mtime)), "Pickup"],
        )
        os.replace(tmp_path, cache_file)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _scale(pixbuf, size=THUMB_SIZE):
    width, height = pixbuf.get_width(), pixbuf.get_height()
    if width <= 0 or height <= 0:
        return None
    scale = min(float(size) / width, float(size) / height, 1.0)
    new_w = max(1, int(round(width * scale)))
    new_h = max(1, int(round(height * scale)))
    if (new_w, new_h) == (width, height):
        return pixbuf
    return pixbuf.scale_simple(new_w, new_h, GdkPixbuf.InterpType.BILINEAR)


def _from_image(path):
    try:
        pixbuf = GdkPixbuf.Pixbuf.new_from_file(path)
    except Exception:
        return None
    return _scale(pixbuf)


def _run(cmd, timeout=15):
    try:
        subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=timeout,
            check=False,
        )
        return True
    except (OSError, subprocess.SubprocessError):
        return False


def _from_video(path):
    """Return a scaled pixbuf for a video frame, or None."""
    tool = shutil.which("ffmpegthumbnailer")
    tmp_fd, tmp_png = tempfile.mkstemp(suffix=".png")
    os.close(tmp_fd)
    try:
        if tool:
            ok = _run(
                [
                    tool,
                    "-i", path,
                    "-o", tmp_png,
                    "-s", str(THUMB_SIZE),
                    "-t", "10%",
                    "-q", "5",
                    "-f",          # fall back to the first frame if 10% fails
                ]
            )
        else:
            ffmpeg = shutil.which("ffmpeg")
            if not ffmpeg:
                return None
            ok = _run(
                [
                    ffmpeg, "-nostdin", "-y",
                    "-ss", "1",
                    "-i", path,
                    "-frames:v", "1",
                    "-vf", "scale=%d:-1:force_original_aspect_ratio=decrease" % THUMB_SIZE,
                    tmp_png,
                ]
            )
        if not ok or not os.path.exists(tmp_png) or os.path.getsize(tmp_png) == 0:
            return None
        pixbuf = GdkPixbuf.Pixbuf.new_from_file(tmp_png)
        # ffmpeg may emit a 1-pixel image for a broken file; ignore those.
        if pixbuf.get_width() < 2 or pixbuf.get_height() < 2:
            return None
        return _scale(pixbuf)
    except Exception:
        return None
    finally:
        try:
            os.unlink(tmp_png)
        except OSError:
            pass


def item_mime(item):
    """MIME of a file item, guessed once and remembered on the item."""
    mime = item.get("mime")
    if not mime:
        mime = guess_mime(item.get("path") or "", bool(item.get("is_dir")))
        item["mime"] = mime
    return mime


def has_source(item):
    """True when this item is a file that could plausibly have a thumbnail."""
    if item.get("kind") != "file" or item.get("is_dir") or item.get("missing"):
        return False
    mime = item_mime(item)
    return mime.startswith(IMAGE_MIME_PREFIX) or mime.startswith(VIDEO_MIME_PREFIX)


def cached_thumbnail(item):
    """Thumbnail only if it is already in memory (never blocks)."""
    return _memory_cache.get((item.get("path") or "", item.get("added")))


def request_thumbnail(item, callback):
    """Build the thumbnail on a worker thread; callback(pixbuf) runs on the UI loop.

    Decoding a big image or grabbing a video frame can take seconds, and doing
    that on the UI thread freezes the whole popup.
    """
    import threading

    from gi.repository import GLib

    snapshot = dict(item)

    def work():
        try:
            pixbuf = get_thumbnail(snapshot)
        except Exception:
            pixbuf = None
        GLib.idle_add(lambda: (callback(pixbuf), False)[1])

    threading.Thread(target=work, daemon=True).start()


def get_thumbnail(item):
    """Cached thumbnail for an item, generating it if needed.

    Returns a GdkPixbuf or None. Safe to call on the main loop for a handful of
    visible items: the usual path is a single stat + pixbuf load.
    """
    if not has_source(item):
        return None
    path = item.get("path") or ""
    cache_file = _cache_path(path)
    key = (path, item.get("added"))
    cached = _memory_cache.get(key)
    if cached is not None:
        return cached
    try:
        mtime = os.stat(path).st_mtime
    except OSError:
        return None
    if _is_cache_fresh(cache_file, mtime):
        try:
            pixbuf = GdkPixbuf.Pixbuf.new_from_file(cache_file)
            _memory_cache[key] = pixbuf
            return pixbuf
        except Exception:
            pass
    mime = item_mime(item)
    if mime.startswith(VIDEO_MIME_PREFIX):
        pixbuf = _from_video(path)
    else:
        pixbuf = _from_image(path)
    if pixbuf is None:
        _memory_cache[key] = None
        return None
    uri = _file_uri(path)
    _save_thumbnail(pixbuf, cache_file, uri, mtime)
    _memory_cache[key] = pixbuf
    return pixbuf


def guess_mime(path, is_dir=False):
    """MIME type guess, cheap enough for a few dozen items."""
    if is_dir:
        return "inode/directory"
    try:
        from gi.repository import Gio

        mime, _uncertain = Gio.content_type_guess(path, None)
        if mime:
            return mime
    except Exception:
        pass
    import mimetypes

    return mimetypes.guess_type(path)[0] or "application/octet-stream"


def extension_label(path, is_dir=False):
    """Short badge text for non-thumbnailed files, e.g. 'PDF', 'ZIP'."""
    if is_dir:
        return ""
    name = os.path.basename(path)
    if "." in name.lstrip("."):
        ext = name.rsplit(".", 1)[1]
        if 1 <= len(ext) <= 5 and ext.isalnum():
            return ext.upper()
        return ext[:4].upper()
    return ""
