"""Standalone dark/light appearance switch for Cinnamon (Linux Mint).

Self-contained and developed independently of the rest of the codebase so the
mechanism can be proven correct before it's wired into config/options. Run it:

    python3 -m lumendusk.apply.appearance status   # show every appearance key
    python3 -m lumendusk.apply.appearance dark
    python3 -m lumendusk.apply.appearance light
    python3 -m lumendusk.apply.appearance toggle

Why a whole module for "dark mode": on Cinnamon, dark/light is not one setting.
The desktop shell, the window borders, GTK apps, libadwaita/GTK4 apps, Flatpak
apps (via the XApp portal), icons and the accent are all separate keys. Changing
only ``gtk-theme`` + ``color-scheme`` (the old approach) leaves the panel, menus
and window borders on their previous theme — a visible half-switch.

Rather than hard-code theme names, we read Mint's own **authoritative** style
catalog at ``/usr/share/cinnamon/styles.d/*.styles`` — the exact data Cinnamon's
Themes/Style settings use. Each entry maps a family + mode (light / mixed / dark)
+ accent to the concrete theme/icon/cursor/colour names. We detect the current
accent, then apply that accent's *light* or *dark* variant across every key.
"""

from __future__ import annotations

import glob
import json
import os
import subprocess
import sys
from dataclasses import dataclass

from .. import log

# ---- the complete set of keys that make up "appearance" ---------------------
# Cinnamon and its GNOME-compat mirror both matter: some apps read one, some the
# other. Flatpak/sandboxed apps read the XApp portal keys.
_KEYS_THEME = [                                   # GTK theme + window borders
    ("org.cinnamon.desktop.interface", "gtk-theme"),
    ("org.cinnamon.desktop.wm.preferences", "theme"),
    ("org.gnome.desktop.interface", "gtk-theme"),
    ("org.gnome.desktop.wm.preferences", "theme"),
]
_KEY_SHELL = ("org.cinnamon.theme", "name")       # Cinnamon shell / panel / menus
_KEYS_ICON = [
    ("org.cinnamon.desktop.interface", "icon-theme"),
    ("org.gnome.desktop.interface", "icon-theme"),
]
_KEYS_CURSOR = [
    ("org.cinnamon.desktop.interface", "cursor-theme"),
    ("org.gnome.desktop.interface", "cursor-theme"),
]
_KEYS_SCHEME = [                                  # libadwaita/GTK4 + Flatpak portal
    ("org.gnome.desktop.interface", "color-scheme"),
    ("org.x.apps.portal", "color-scheme"),
]
_KEY_ACCENT = ("org.x.apps.portal", "accent-rgb")

_STYLES_GLOBS = [
    "/usr/share/cinnamon/styles.d/*.styles",
    os.path.expanduser("~/.local/share/cinnamon/styles.d/*.styles"),
]


# ---- gsettings helpers ------------------------------------------------------
# gsettings goes through dconf over D-Bus, and a wedged dconf-service leaves it
# waiting rather than failing. The daemon has one thread, so that would stop
# every future transition with a log that just goes quiet. These calls take
# single-digit milliseconds when healthy; five seconds is far past any real one.
_GSETTINGS_TIMEOUT = 5

_schemas_cache: set[str] | None = None


def _schemas() -> set[str]:
    global _schemas_cache
    if _schemas_cache is None:
        try:
            out = subprocess.run(["gsettings", "list-schemas"],
                                 check=True, capture_output=True, text=True,
                                 timeout=_GSETTINGS_TIMEOUT).stdout
            _schemas_cache = set(out.split())
        except (OSError, subprocess.CalledProcessError,
                subprocess.TimeoutExpired):
            _schemas_cache = set()
    return _schemas_cache


def _get(schema: str, key: str) -> str | None:
    if schema not in _schemas():
        return None
    try:
        out = subprocess.run(["gsettings", "get", schema, key],
                             check=True, capture_output=True, text=True,
                             timeout=_GSETTINGS_TIMEOUT).stdout.strip()
        return out.strip("'\"")
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        # None compares unequal to any target, so an unreadable key falls
        # through to a write rather than being skipped as "already correct".
        return None


def _is_current(schema: str, key: str, value: str) -> bool:
    """Does this key already hold ``value``?

    Used to skip writes that would change nothing. dconf notifies listeners on
    every write, identical value or not, so re-setting a key Cinnamon is
    watching makes it reload the theme for no reason. A read that fails returns
    None, which compares unequal — so the uncertain case writes, and the
    optimisation can only ever be skipped, never wrongly applied.
    """
    return _get(schema, key) == value


def _set(schema: str, key: str, value: str) -> bool:
    # Silently skip schemas that don't exist on this machine (e.g. the XApp
    # portal on non-Mint systems) rather than erroring.
    if schema not in _schemas():
        return True
    try:
        subprocess.run(["gsettings", "set", schema, key, value],
                       check=True, capture_output=True, text=True,
                       timeout=_GSETTINGS_TIMEOUT)
        return True
    except subprocess.TimeoutExpired:
        log.warning("set %s %s '%s' timed out after %ss.", schema, key, value,
                    _GSETTINGS_TIMEOUT)
        return False
    except (subprocess.CalledProcessError, OSError) as exc:
        # OSError has no stderr; CalledProcessError may have an empty one.
        detail = getattr(exc, "stderr", None)
        log.warning("set %s %s '%s' failed: %s", schema, key, value,
                    detail.strip() if detail else exc)
        return False


def _installed_icon_themes() -> set[str]:
    names: set[str] = set()
    for d in ("~/.icons", "~/.local/share/icons", "/usr/share/icons"):
        try:
            names.update(os.listdir(os.path.expanduser(d)))
        except OSError:
            pass
    return names


# ---- Mint style catalog -----------------------------------------------------
@dataclass
class Variant:
    """One concrete look: a family + mode + accent from the styles catalog."""
    family: str
    mode: str            # "light" | "mixed" | "dark"
    accent: str          # e.g. "orange", "yaru"
    themes: str          # GTK + window-border theme
    cinnamon: str        # shell theme (== themes unless overridden, i.e. "mixed")
    icons: str
    cursor: str
    color: str           # accent hex, "" if none


def _load_catalog() -> list[Variant]:
    installed_icons = _installed_icon_themes()

    def resolve_icons(entry: dict) -> str:
        if entry.get("icons"):
            return entry["icons"]
        # No explicit icon theme: use the GTK theme's name if such an icon theme
        # exists, else its non-dark counterpart.
        themes = entry["themes"]
        if themes in installed_icons:
            return themes
        return themes.replace("-Dark", "")

    variants: list[Variant] = []
    seen_files: set[str] = set()
    for pattern in _STYLES_GLOBS:
        for path in sorted(glob.glob(pattern)):
            base = os.path.basename(path)
            if base in seen_files:        # user file shadows system file of same name
                continue
            seen_files.add(base)
            try:
                with open(path, encoding="utf-8") as fh:
                    data = json.load(fh)
            except (OSError, ValueError):
                continue
            for family in data.get("styles", []):
                fam_name = family.get("name", "")
                for mode in ("light", "mixed", "dark"):
                    for entry in family.get(mode, []):
                        variants.append(Variant(
                            family=fam_name,
                            mode=mode,
                            accent=entry.get("name", ""),
                            themes=entry["themes"],
                            cinnamon=entry.get("cinnamon", entry["themes"]),
                            icons=resolve_icons(entry),
                            cursor=entry.get("cursor", ""),
                            color=entry.get("color", ""),
                        ))
    return variants


def _current() -> dict[str, str | None]:
    return {
        "themes": _get(*_KEYS_THEME[0]),        # cinnamon gtk-theme
        "shell": _get(*_KEY_SHELL),
        "icons": _get(*_KEYS_ICON[0]),
    }


def detect_variant(catalog: list[Variant]) -> Variant | None:
    """Best-match the live desktop to a catalog entry, to learn family+accent.

    The current state may be inconsistent (that's the bug we fix), so we score a
    match across the theme, shell and icon keys and take the strongest.
    """
    cur = _current()
    best: Variant | None = None
    best_score = 0
    for v in catalog:
        score = 0
        if v.themes == cur["themes"]:
            score += 2
        if v.cinnamon == cur["shell"]:
            score += 1
        if v.icons == cur["icons"]:
            score += 2
        if score > best_score:
            best, best_score = v, score
    return best


def variant_for(catalog: list[Variant], family: str, accent: str,
                mode: str) -> Variant | None:
    for v in catalog:
        if v.family == family and v.accent == accent and v.mode == mode:
            return v
    return None


# ---- apply ------------------------------------------------------------------
def _targets(v: Variant) -> list[tuple[str, str, str]]:
    """Every (schema, key, value) this variant wants set."""
    scheme = "prefer-dark" if v.mode == "dark" else "prefer-light"
    out = [(s, k, v.themes) for s, k in _KEYS_THEME]
    out.append((*_KEY_SHELL, v.cinnamon))
    out += [(s, k, v.icons) for s, k in _KEYS_ICON]
    if v.cursor:
        out += [(s, k, v.cursor) for s, k in _KEYS_CURSOR]
    out += [(s, k, scheme) for s, k in _KEYS_SCHEME]
    if v.color:
        out.append((*_KEY_ACCENT, v.color))
    return out


def apply_variant(v: Variant, force: bool = False) -> bool:
    """Set every appearance key for ``v``, skipping the ones already correct.

    Skipping matters because applying is not always a change: the daemon snaps
    to the current phase when it starts, when you switch back to automatic, and
    after a resume, and most of those find the desktop already correct. Writing
    the same twelve keys anyway made Cinnamon reload its theme — a visible
    flicker in return for nothing.

    Per key, not all-or-nothing: if something else moved one key (a stray
    gsettings edit, an app changing the icon theme), that one is still put back
    while its eleven correct neighbours are left alone.

    ``force`` writes everything regardless. That is for the explicit "apply
    now" — the button you press *because* the desktop looks wrong, where a
    rewrite of already-correct keys is the point rather than the waste.
    """
    targets = _targets(v)
    stale = targets if force else [
        t for t in targets if not _is_current(t[0], t[1], t[2])
    ]
    scheme = "prefer-dark" if v.mode == "dark" else "prefer-light"

    if not stale:
        log.info("appearance already %s [%s/%s]; nothing to change.",
                 v.mode, v.family, v.accent)
        return True

    ok = True
    for schema, key, value in stale:
        ok &= _set(schema, key, value)
    log.info("appearance → %s [%s/%s]: themes=%s, shell=%s, icons=%s, scheme=%s%s",
             v.mode, v.family, v.accent, v.themes, v.cinnamon, v.icons, scheme,
             "" if len(stale) == len(targets)
             else f" ({len(stale)} of {len(targets)} keys were stale)")
    return ok


def set_mode(mode: str, accent: str | None = None, force: bool = False) -> bool:
    """Switch the whole desktop to 'light' or 'dark'.

    ``accent`` None/"" keeps the current accent (auto-detected); otherwise it
    forces a specific accent name (e.g. "yaru", "orange", "aqua").
    ``force`` rewrites keys that already hold the right value — see
    :func:`apply_variant`.
    """
    catalog = _load_catalog()
    if not catalog:
        log.error("no Cinnamon style catalog found in %s — Lumendusk's "
                  "dark/light switch needs Linux Mint / Cinnamon.",
                  " or ".join(_STYLES_GLOBS))
        return False
    cur = detect_variant(catalog)
    family = cur.family if cur else "Mint-Y"
    use_accent = accent or (cur.accent if cur else "yaru")
    target = (variant_for(catalog, family, use_accent, mode)
              # e.g. Mint-X has no dark variant, or a forced accent isn't in this
              # family — fall back to Mint-Y, then to the default yaru accent.
              or variant_for(catalog, "Mint-Y", use_accent, mode)
              or variant_for(catalog, "Mint-Y", "yaru", mode))
    if target is None:
        log.error("no '%s' variant for %s/%s.", mode, family, use_accent)
        return False
    return apply_variant(target, force=force)


def current_mode() -> str:
    """Rough current mode from the shell theme (the panel is the giveaway)."""
    shell = _get(*_KEY_SHELL) or ""
    return "dark" if "-Dark" in shell else "light"


def status() -> None:
    catalog = _load_catalog()
    cur = detect_variant(catalog) if catalog else None
    print("Appearance keys:")
    for schema, key in (_KEYS_THEME[0], _KEY_SHELL, _KEYS_THEME[1],
                        _KEYS_ICON[0], _KEYS_CURSOR[0], _KEYS_SCHEME[0],
                        _KEYS_SCHEME[1], _KEY_ACCENT):
        print(f"  {schema.split('.')[-1]:<16} {key:<13} = {_get(schema, key)}")
    if cur:
        print(f"Detected style : {cur.family}/{cur.accent} "
              f"(looks {current_mode()})")


def _main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print("usage: python3 -m lumendusk.apply.appearance {dark|light|toggle|status}")
        return 0 if argv else 2
    cmd = argv[0]
    if cmd == "status":
        status()
        return 0
    if cmd == "toggle":
        cmd = "light" if current_mode() == "dark" else "dark"
    if cmd in ("dark", "light"):
        return 0 if set_mode(cmd) else 1
    print(f"unknown command: {cmd}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
