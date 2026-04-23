#!/usr/bin/env python3

# Bing-Daily 
# Copyright (c) 2026 Keith Driscoll
# https://keithdriscoll.nyc/projects/bing-daily
# Licensed under the MIT License. See LICENSE file for details.

"""
Bing Daily Engine
Fetches and manages Bing Image of the Day wallpapers.
Images fetched exclusively via the Peapix API.
"""

import hashlib
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib import request
from urllib.error import URLError, HTTPError

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
CACHE_DIR = Path.home() / ".cache" / "bing-daily"
HISTORY_FILE = CACHE_DIR / "history.json"
INDEX_FILE = CACHE_DIR / "current_index"
LOG_FILE = CACHE_DIR / "log.txt"

# ---------------------------------------------------------------------------
# Config defaults
# ---------------------------------------------------------------------------
DEFAULT_HISTORY_LIMIT = 30
CONFIG_FILE = Path.home() / ".config" / "bing-daily" / "config.json"

# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------
PEAPIX_BASE = "https://peapix.com/bing/feed"

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

def setup_logging():
    """Configure logging to both file and stderr."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("bing_wallpaper")
    logger.setLevel(logging.DEBUG)
    if not logger.handlers:
        # File handler — append
        fh = logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8")
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        logger.addHandler(fh)
        # Stderr handler — only WARNING and above
        sh = logging.StreamHandler(sys.stderr)
        sh.setLevel(logging.WARNING)
        sh.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
        logger.addHandler(sh)
    return logger


log = setup_logging()


def _safe_url(url: str) -> str:
    """Strip query string from a URL before logging (no identifying params in log)."""
    return url.split("?")[0]


def md5_file(path: Path) -> str:
    """Return MD5 hex digest of a file's contents."""
    return hashlib.md5(path.read_bytes()).hexdigest()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_history_limit() -> int:
    """Read history_limit from config file, fall back to default."""
    try:
        if CONFIG_FILE.exists():
            data = json.loads(CONFIG_FILE.read_text())
            return int(data.get("history_limit", DEFAULT_HISTORY_LIMIT))
    except Exception:
        pass
    return DEFAULT_HISTORY_LIMIT


def get_region() -> str:
    """Read region from config file, fall back to '' (Global). Empty string = Global feed."""
    try:
        if CONFIG_FILE.exists():
            data = json.loads(CONFIG_FILE.read_text())
            if "region" in data:
                return str(data["region"])
    except Exception:
        pass
    return ""


def get_frequency() -> str:
    """Read frequency from config file, fall back to 'daily'."""
    try:
        if CONFIG_FILE.exists():
            data = json.loads(CONFIG_FILE.read_text())
            return str(data.get("frequency", "daily"))
    except Exception:
        pass
    return "daily"


def load_history() -> list:
    """Load history.json; return empty list on any error."""
    if not HISTORY_FILE.exists():
        log.info("history.json not found — starting fresh")
        return []
    try:
        data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            log.warning("history.json is not a list — resetting")
            return []
        return data
    except json.JSONDecodeError as e:
        log.error("Failed to parse history.json: %s", e)
        return []


def save_history(history: list):
    """Write history list to disk."""
    HISTORY_FILE.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")


def load_index() -> int:
    """Load current_index; default to 0 on any error."""
    try:
        if INDEX_FILE.exists():
            return int(INDEX_FILE.read_text().strip())
    except (ValueError, OSError):
        pass
    return 0


def save_index(idx: int):
    INDEX_FILE.write_text(str(idx))


def set_wallpaper(local_path: str):
    """Set Cinnamon desktop wallpaper via gsettings (both light and dark keys)."""
    uri = f"file://{local_path}"
    # picture-uri — required key, log error on failure
    result = subprocess.run(
        ["gsettings", "set", "org.cinnamon.desktop.background", "picture-uri", uri],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log.error(
            "gsettings set picture-uri failed (exit %d): %s",
            result.returncode,
            result.stderr.strip(),
        )
    else:
        log.info("Set wallpaper picture-uri → %s", uri)
    # picture-uri-dark — optional (Cinnamon 6.2+), silently skip if unsupported
    result = subprocess.run(
        ["gsettings", "set", "org.cinnamon.desktop.background", "picture-uri-dark", uri],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log.info("picture-uri-dark not supported on this Cinnamon version (skipping)")
    else:
        log.info("Set wallpaper picture-uri-dark → %s", uri)


def http_get(url: str, timeout: int = 15) -> bytes:
    """
    Fetch a URL; retry once after 5 s on network errors.
    Raises URLError / HTTPError on persistent failure.
    """
    # Intentional: Chrome UA is standard practice for image API access.
    # Without it, some CDNs return 403. No personal data is included.
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
    }
    req = request.Request(url, headers=headers)
    for attempt in range(2):
        try:
            with request.urlopen(req, timeout=timeout) as resp:
                if resp.status != 200:
                    raise HTTPError(url, resp.status, "Non-200 response", {}, None)
                return resp.read()
        except (URLError, OSError) as e:
            if attempt == 0:
                log.warning("Network error on %s: %s — retrying in 5 s", _safe_url(url), e)
                time.sleep(5)
            else:
                raise


def download_image(url: str, dest: Path) -> bool:
    """Download image to dest. Returns True on success."""
    try:
        data = http_get(url)
        dest.write_bytes(data)
        log.info("Downloaded image from %s → %s (%d bytes)", _safe_url(url), dest, len(data))
        return True
    except Exception as e:
        log.error("Failed to download image from %s: %s", _safe_url(url), e)
        return False


# ---------------------------------------------------------------------------
# API fetchers
# ---------------------------------------------------------------------------

def fetch_peapix() -> dict:
    """
    Fetch from Peapix. Returns a normalised entry dict or raises.
    Normalised keys: date, title, copyright, url
    """
    region = get_region()
    if region:
        url = PEAPIX_BASE + '?country=' + region
    else:
        url = PEAPIX_BASE
    log.info("Trying Peapix API: %s", _safe_url(url))
    raw = http_get(url)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        snippet = raw[:500].decode("utf-8", errors="replace")
        log.error("Peapix returned invalid JSON: %s | Raw: %s", e, snippet)
        raise

    if not isinstance(data, list) or len(data) == 0:
        raise ValueError("Peapix response is empty or not a list")

    item = data[0]
    url = item.get("fullUrl") or item.get("imageUrl") or item.get("thumbUrl")
    if not url:
        raise ValueError(f"Peapix item missing image URL keys: {list(item.keys())}")

    entry = {
        "date": datetime.now().strftime("%Y%m%d"),
        "title": item.get("title", "Bing Image of the Day"),
        "copyright": item.get("copyright", ""),
        "url": url,
    }
    log.info("Peapix entry: title=%r url=%s", entry["title"], _safe_url(entry["url"]))
    return entry


def fetch_today() -> dict:
    """
    Fetch today's image from Peapix.
    Raises RuntimeError on failure.
    """
    try:
        return fetch_peapix()
    except Exception as e:
        log.error("Peapix failed: %s", e)
        raise RuntimeError(
            f"Failed to fetch image from Peapix: {e}\n"
            f"Check your network connection or see {LOG_FILE}"
        ) from e


def fetch_peapix_all() -> list:
    """
    Fetch all items from the Peapix feed (typically 8 days, newest first).
    Returns a list of normalised entry dicts: {date, title, copyright, url}.
    Dates are inferred as today, yesterday, etc. (Peapix doesn't include them).
    """
    from datetime import timedelta
    region = get_region()
    url = PEAPIX_BASE + '?country=' + region if region else PEAPIX_BASE
    log.info("Fetching full Peapix feed: %s", _safe_url(url))
    raw = http_get(url)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        snippet = raw[:500].decode("utf-8", errors="replace")
        log.error("Peapix returned invalid JSON: %s | Raw: %s", e, snippet)
        raise
    if not isinstance(data, list) or len(data) == 0:
        raise ValueError("Peapix response is empty or not a list")

    today = datetime.now()
    entries = []
    for i, item in enumerate(data):
        img_url = item.get("fullUrl") or item.get("imageUrl") or item.get("thumbUrl")
        if not img_url:
            log.warning("Peapix item %d missing image URL — skipping", i)
            continue
        date_str = (today - timedelta(days=i)).strftime("%Y%m%d")
        entries.append({
            "date": date_str,
            "title": item.get("title", "Bing Image of the Day"),
            "copyright": item.get("copyright", ""),
            "url": img_url,
        })
    log.info("Peapix feed: %d items", len(entries))
    return entries


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_refresh():
    """Fetch today's image for the current region and set as wallpaper."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    # Use LOCAL date — UTC can roll to tomorrow while locally it's still today
    today = datetime.now().strftime("%Y%m%d")
    dest = CACHE_DIR / f"{today}.jpg"
    current_region = get_region()

    history = load_history()

    # Fast path: already have today's image AND it was fetched for this exact region
    today_entry = history[0] if history and history[0].get("date") == today else None
    if dest.exists() and today_entry and today_entry.get("region") == current_region:
        log.info("Image for %s (%s) already cached — skipping", today, current_region or "global")
        print("Wallpaper set to today's image")
        save_index(0)
        set_wallpaper(str(dest))
        return

    # Need to fetch — either no file yet, or region changed
    try:
        entry = fetch_today()
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)

    if dest.exists():
        # Region changed — download to a temp file and compare MD5 before replacing
        tmp = dest.with_suffix(".tmp")
        if not download_image(entry["url"], tmp):
            print(f"Failed to download image. Check {LOG_FILE} for details.", file=sys.stderr)
            sys.exit(1)

        if md5_file(tmp) == md5_file(dest):
            # Same image for both regions (e.g. Global and US share today's pick)
            tmp.unlink()
            log.info("Region changed to %r but image is identical — updating stored region", current_region or "global")
            if today_entry:
                today_entry["region"] = current_region
                save_history(history)
            print("Wallpaper set to today's image")
            save_index(0)
            set_wallpaper(str(dest))
            return
        else:
            # Different image — replace atomically
            tmp.replace(dest)
            log.info("Region changed to %r — new image installed", current_region or "global")
    else:
        if not download_image(entry["url"], dest):
            print(f"Failed to download image. Check {LOG_FILE} for details.", file=sys.stderr)
            sys.exit(1)

    # Build history entry (includes region so future refreshes can detect changes)
    history_entry = {
        "date": today,
        "title": entry["title"],
        "copyright": entry["copyright"],
        "url": entry["url"],
        "local_path": str(dest),
        "region": current_region,
    }

    # Remove any existing entry for today (idempotent) and prepend
    history = [h for h in history if h.get("date") != today]
    history.insert(0, history_entry)

    # Trim to limit
    limit = get_history_limit()
    if len(history) > limit:
        removed = history[limit:]
        history = history[:limit]
        for old in removed:
            old_path = Path(old.get("local_path", ""))
            if old_path.exists():
                try:
                    old_path.unlink()
                    log.info("Trimmed old image: %s", old_path)
                except OSError as e:
                    log.warning("Could not delete old image %s: %s", old_path, e)

    save_history(history)
    save_index(0)
    set_wallpaper(str(dest))
    log.info("Refresh complete: %s", history_entry["title"])


def cmd_next():
    """Move to a newer image (decrement index)."""
    history = load_history()
    if not history:
        print("BOUNDARY:newest")
        return

    idx = load_index()
    if idx <= 0:
        print("BOUNDARY:newest")
        log.info("next: already at newest (index 0)")
        return

    idx -= 1
    save_index(idx)
    entry = history[idx]
    local_path = entry.get("local_path", "")
    if not Path(local_path).exists():
        log.error("Image file missing: %s", local_path)
        print(f"Image file not found: {local_path}", file=sys.stderr)
        sys.exit(1)
    set_wallpaper(local_path)
    log.info("next: moved to index %d (newer)", idx)


def cmd_prev():
    """Move to an older image (increment index)."""
    history = load_history()
    if not history:
        print("BOUNDARY:oldest")
        return

    idx = load_index()
    if idx >= len(history) - 1:
        print("BOUNDARY:oldest")
        log.info("prev: already at oldest (index %d)", idx)
        return

    idx += 1
    save_index(idx)
    entry = history[idx]
    local_path = entry.get("local_path", "")
    if not Path(local_path).exists():
        log.error("Image file missing: %s", local_path)
        print(f"Image file not found: {local_path}", file=sys.stderr)
        sys.exit(1)
    set_wallpaper(local_path)
    log.info("prev: moved to index %d (older)", idx)


def cmd_open():
    """Open the current image with xdg-open."""
    history = load_history()
    if not history:
        print("No images in history.", file=sys.stderr)
        sys.exit(1)

    idx = load_index()
    idx = max(0, min(idx, len(history) - 1))
    local_path = history[idx].get("local_path", "")
    if not Path(local_path).exists():
        print(f"Image file not found: {local_path}", file=sys.stderr)
        sys.exit(1)

    result = subprocess.run(["xdg-open", local_path])
    if result.returncode != 0:
        log.error("xdg-open failed for %s", local_path)
        sys.exit(1)


def cmd_info():
    """Print current image entry as formatted JSON."""
    history = load_history()
    if not history:
        print("No images in history.", file=sys.stderr)
        sys.exit(1)

    idx = load_index()
    idx = max(0, min(idx, len(history) - 1))
    print(json.dumps(history[idx], indent=2, ensure_ascii=False))


def cmd_populate():
    """Download all images from the Peapix feed (typically the last 8 days)."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    limit = get_history_limit()
    history = load_history()
    existing_dates = {h.get("date") for h in history}

    try:
        feed = fetch_peapix_all()
    except Exception as e:
        print(f"Failed to fetch image feed: {e}", file=sys.stderr)
        sys.exit(1)

    downloaded = 0
    failed = 0

    for entry in feed:
        date_str = entry["date"]
        dest = CACHE_DIR / f"{date_str}.jpg"

        if dest.exists() and date_str in existing_dates:
            log.info("populate: %s already cached — skipping", date_str)
            continue

        if not download_image(entry["url"], dest):
            failed += 1
            continue

        history_entry = {
            "date": date_str,
            "title": entry["title"],
            "copyright": entry["copyright"],
            "url": entry["url"],
            "local_path": str(dest),
        }
        history = [h for h in history if h.get("date") != date_str]
        history.insert(0, history_entry)
        existing_dates.add(date_str)
        downloaded += 1

    # Sort newest first and trim to limit
    history.sort(key=lambda h: h.get("date", ""), reverse=True)
    history = history[:limit]
    save_history(history)
    save_index(0)
    if history:
        set_wallpaper(history[0].get("local_path", ""))
    print(f"populated:{downloaded}:{failed}")
    log.info("Populate complete: %d downloaded, %d failed", downloaded, failed)


def cmd_clear():
    """Delete all cached images and reset history."""
    history = load_history()
    deleted = 0
    for entry in history:
        path = Path(entry.get("local_path", ""))
        if path.exists():
            try:
                path.unlink()
                deleted += 1
                log.info("Deleted: %s", path)
            except OSError as e:
                log.warning("Could not delete %s: %s", path, e)
    save_history([])
    if INDEX_FILE.exists():
        try:
            INDEX_FILE.unlink()
        except OSError:
            pass
    print(f"cleared:{deleted}")
    log.info("Clear complete: %d images deleted", deleted)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

COMMANDS = {
    "refresh": cmd_refresh,
    "next": cmd_next,
    "prev": cmd_prev,
    "open": cmd_open,
    "info": cmd_info,
    "populate": cmd_populate,
    "clear": cmd_clear,
}

if __name__ == "__main__":
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(f"Usage: {sys.argv[0]} <{'|'.join(COMMANDS)}>" , file=sys.stderr)
        sys.exit(1)
    COMMANDS[sys.argv[1]]()
