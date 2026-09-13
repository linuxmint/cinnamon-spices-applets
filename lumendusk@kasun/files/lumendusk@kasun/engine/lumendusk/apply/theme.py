"""Apply the desktop dark/light appearance for day or night.

Thin adapter over :mod:`lumendusk.apply.appearance`, the whole-desktop switcher.
The switcher moves every appearance key together (shell, window borders, GTK,
libadwaita/GTK4, Flatpak portal, icons, accent), so app windows and the Cinnamon
UI stay in sync — the old two-key approach left the panel and borders behind.

Which appearance belongs to which phase is a setting, not a constant: day →
light and night → dark are only the defaults. See ``theme_day``/``theme_night``
in :class:`lumendusk.config.Config`.
"""

from __future__ import annotations

from ..config import Config
from . import appearance


def appearance_for(dark: bool, config: Config) -> str:
    """The appearance ("light"/"dark") configured for this phase.

    ``dark`` is the *phase* (night), not the appearance — they line up by
    default, and deliberately come apart for someone who wants dark all day.
    """
    return config.theme_night if dark else config.theme_day


def set_theme(dark: bool, config: Config, force: bool = False) -> None:
    # Blank accent = keep the user's current accent (auto-detected).
    accent = (config.theme_accent or "").strip() or None
    appearance.set_mode(appearance_for(dark, config), accent=accent, force=force)
