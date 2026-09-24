#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dimmer.py - Desktop Wallpaper Brightness Manager for Cinnamon
Processes the current desktop wallpaper using Pillow and applies the desired brightness level.
"""

import sys
import os
import json
import argparse
import urllib.parse
from pathlib import Path
from PIL import Image, ImageEnhance, ImageOps

import gi
gi.require_version('Gio', '2.0')
from gi.repository import Gio

CONFIG_DIR = Path.home() / ".config" / "wallpaper-brightness"
CACHE_DIR = Path.home() / ".cache" / "wallpaper-brightness"
CONFIG_FILE = CONFIG_DIR / "config.json"

SCHEMA_ID = "org.cinnamon.desktop.background"
KEY_URI = "picture-uri"


def get_gsettings():
    return Gio.Settings.new(SCHEMA_ID)


def load_config():
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            sys.stderr.write(f"Warning reading config: {e}\n")
    return {
        "brightness": 100,
        "original_uri": "",
        "current_dimmed_uri": "",
        "slot": "a"
    }


def save_config(cfg):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)


def uri_to_path(uri: str) -> str:
    if uri.startswith("file://"):
        parsed = urllib.parse.urlparse(uri)
        return urllib.parse.unquote(parsed.path)
    return uri


def path_to_uri(path: str) -> str:
    abs_path = os.path.abspath(path)
    return Path(abs_path).as_uri()


def is_cached_uri(uri: str) -> bool:
    cache_path_str = str(CACHE_DIR)
    path = uri_to_path(uri)
    return path.startswith(cache_path_str)


def process_image(src_path: str, brightness_pct: int, slot: str) -> str:
    """Generates a brightness-adjusted version of src_path image."""
    factor = max(0.05, min(1.0, brightness_pct / 100.0))
    dest_file = CACHE_DIR / f"dimmed_wallpaper_{slot}.jpg"

    with Image.open(src_path) as im:
        # Correct EXIF rotation if present
        im = ImageOps.exif_transpose(im)

        # Handle transparency/alpha channels over a black background
        if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
            im = im.convert('RGBA')
            bg = Image.new('RGB', im.size, (0, 0, 0))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        elif im.mode != 'RGB':
            im = im.convert('RGB')

        # Apply brightness adjustment
        enhancer = ImageEnhance.Brightness(im)
        dimmed = enhancer.enhance(factor)
        dimmed.save(dest_file, "JPEG", quality=96)

    return path_to_uri(str(dest_file))


def set_brightness(target_pct: int):
    target_pct = max(10, min(100, int(target_pct)))
    settings = get_gsettings()
    current_uri = settings.get_string(KEY_URI)
    cfg = load_config()

    # If current URI is not our cache, it is the original image
    if current_uri and not is_cached_uri(current_uri):
        cfg["original_uri"] = current_uri
    elif not cfg.get("original_uri"):
        cfg["original_uri"] = current_uri

    orig_uri = cfg.get("original_uri")
    if not orig_uri:
        sys.stderr.write("Error: Original wallpaper not found.\n")
        return

    orig_path = uri_to_path(orig_uri)
    if not os.path.isfile(orig_path):
        sys.stderr.write(f"Error: File {orig_path} does not exist.\n")
        return

    if target_pct == 100:
        # Restore original wallpaper intact
        settings.set_string(KEY_URI, orig_uri)
        cfg["brightness"] = 100
        cfg["current_dimmed_uri"] = ""
        save_config(cfg)

        # Clean temporary cache files so no disk space is wasted
        if CACHE_DIR.exists():
            for f in CACHE_DIR.glob("dimmed_wallpaper_*.jpg"):
                try:
                    f.unlink()
                except OSError:
                    pass

        print("100")
        return

    # Alternate slot ('a' <-> 'b') to ensure URI changes and Cinnamon forces immediate reload
    next_slot = "b" if cfg.get("slot") == "a" else "a"

    try:
        new_dimmed_uri = process_image(orig_path, target_pct, next_slot)
        settings.set_string(KEY_URI, new_dimmed_uri)

        # Remove previous slot file to keep at most 1 image on disk
        old_slot = "a" if next_slot == "b" else "b"
        old_file = CACHE_DIR / f"dimmed_wallpaper_{old_slot}.jpg"
        if old_file.exists():
            try:
                old_file.unlink()
            except OSError:
                pass

        cfg["brightness"] = target_pct
        cfg["current_dimmed_uri"] = new_dimmed_uri
        cfg["slot"] = next_slot
        save_config(cfg)
        print(f"{target_pct}")
    except Exception as e:
        sys.stderr.write(f"Error processing image: {e}\n")


def sync_wallpaper():
    """Detects if wallpaper changed externally (e.g. user selected new wallpaper or slideshow)."""
    settings = get_gsettings()
    current_uri = settings.get_string(KEY_URI)
    cfg = load_config()

    # If wallpaper changed to a file outside our cache
    if current_uri and not is_cached_uri(current_uri):
        if current_uri != cfg.get("original_uri"):
            cfg["original_uri"] = current_uri
            save_config(cfg)
            brightness = cfg.get("brightness", 100)
            if brightness < 100:
                set_brightness(brightness)
            else:
                save_config(cfg)


def main():
    parser = argparse.ArgumentParser(description="Wallpaper brightness adjuster for Cinnamon")
    parser.add_argument("--set", type=int, help="Set brightness level (10 to 100)")
    parser.add_argument("--get", action="store_true", help="Print current brightness")
    parser.add_argument("--get-json", action="store_true", help="Print full state as JSON")
    parser.add_argument("--reset", action="store_true", help="Restore original wallpaper at 100%")
    parser.add_argument("--sync", action="store_true", help="Sync if wallpaper changed externally")

    args = parser.parse_args()

    if args.set is not None:
        set_brightness(args.set)
    elif args.get:
        cfg = load_config()
        print(cfg.get("brightness", 100))
    elif args.get_json:
        cfg = load_config()
        print(json.dumps(cfg))
    elif args.reset:
        set_brightness(100)
    elif args.sync:
        sync_wallpaper()
    else:
        cfg = load_config()
        print(f"Current brightness: {cfg.get('brightness', 100)}%")


if __name__ == "__main__":
    main()
