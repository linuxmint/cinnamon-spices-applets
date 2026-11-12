#!/usr/bin/env python3
"""Scan available GTK/Icon/Cursor/Cinnamon themes and write to JSON for the applet."""
import os
import json
from _config import CACHE_DIR, THEMES_CACHE_FILE as OUTPUT

def _user_data_dir():
    """XDG 用户数据目录（~/.local/share），GNOME 系工具装主题的默认位置"""
    return os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share"))


def scan_themes(base_dirs, condition_func):
    """Generic theme scanner: iterate base_dirs, apply condition_func, return sorted unique names."""
    themes = set()
    for base in base_dirs:
        if not os.path.isdir(base):
            continue
        for name in os.listdir(base):
            if condition_func(base, name):
                themes.add(name)
    return sorted(themes)

def scan_gtk_themes():
    return scan_themes(
        ["/usr/share/themes", os.path.expanduser("~/.themes"),
         os.path.join(_user_data_dir(), "themes")],
        lambda base, name: os.path.isdir(os.path.join(base, name, "gtk-3.0"))
    )

def scan_icon_themes():
    return scan_themes(
        ["/usr/share/icons", os.path.expanduser("~/.icons"),
         os.path.join(_user_data_dir(), "icons")],
        lambda base, name: os.path.isfile(os.path.join(base, name, "index.theme"))
    )

def scan_cursor_themes():
    return scan_themes(
        ["/usr/share/icons", os.path.expanduser("~/.icons"),
         os.path.join(_user_data_dir(), "icons")],
        lambda base, name: os.path.isdir(os.path.join(base, name, "cursors"))
    )

def scan_cinnamon_themes():
    return scan_themes(
        ["/usr/share/themes", os.path.expanduser("~/.themes"),
         os.path.join(_user_data_dir(), "themes")],
        lambda base, name: os.path.isdir(os.path.join(base, name, "cinnamon"))
    )

def main():
    os.makedirs(CACHE_DIR, exist_ok=True)
    data = {
        "gtk": scan_gtk_themes(),
        "icon": scan_icon_themes(),
        "cursor": scan_cursor_themes(),
        "cinnamon": scan_cinnamon_themes(),
    }
    with open(OUTPUT, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("GTK themes: %d" % len(data["gtk"]))
    print("Icon themes: %d" % len(data["icon"]))
    print("Cursor themes: %d" % len(data["cursor"]))
    print("Cinnamon themes: %d" % len(data["cinnamon"]))
    print("Written to: %s" % OUTPUT)

if __name__ == "__main__":
    main()
