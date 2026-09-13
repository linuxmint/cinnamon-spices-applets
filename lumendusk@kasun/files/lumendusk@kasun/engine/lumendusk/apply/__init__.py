"""Platform-specific "apply" backends (theme, night light, …).

Phase 1 targets Linux Mint / Cinnamon. Later phases add Windows and macOS
implementations behind the same function names.
"""

from .nightlight import nightlight_on, set_nightlight
from .theme import appearance_for, set_theme

__all__ = ["appearance_for", "nightlight_on", "set_nightlight", "set_theme"]
