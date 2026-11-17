# -*- coding: utf-8 -*-
"""Frosted-glass theming for the Pickup popup.

The "frosted" look here is intentionally the *cheap* kind: a translucent rounded
panel drawn over whatever is behind the window, plus a 1px light border. There
is no backdrop blur and no screenshot hack -- those cost CPU every frame and
look worse when the wallpaper changes.

Both palettes are defined explicitly instead of relying on theme colours, so the
popup looks identical under any GTK theme while still following light/dark mode.
"""

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, Gtk  # noqa: E402


# --- palette ---------------------------------------------------------------
# alpha is the frosted translucency. Raise it for a more solid panel.
DARK = {
    "root": "rgba(24, 26, 32, 0.82)",
    "root_border": "rgba(255, 255, 255, 0.14)",
    "header": "rgba(255, 255, 255, 0.035)",
    "text": "#eef1f5",
    "text_dim": "rgba(238, 241, 245, 0.62)",
    "text_faint": "rgba(238, 241, 245, 0.38)",
    "card": "rgba(255, 255, 255, 0.055)",
    "card_hover": "rgba(255, 255, 255, 0.105)",
    "card_selected": "rgba(122, 186, 255, 0.24)",
    "card_selected_border": "rgba(140, 197, 255, 0.85)",
    "card_border": "rgba(255, 255, 255, 0.08)",
    "accent": "#8ec5ff",
    "button": "rgba(255, 255, 255, 0.07)",
    "button_hover": "rgba(255, 255, 255, 0.15)",
    "menu_bg": "rgba(30, 33, 40, 0.97)",
    "menu_border": "rgba(255, 255, 255, 0.15)",
    "menu_hover": "rgba(255, 255, 255, 0.12)",
    "menu_text": "#f0f3f7",
    "menu_danger": "#ff8f8f",
    "separator": "rgba(255, 255, 255, 0.10)",
    "scroll": "rgba(255, 255, 255, 0.20)",
    "scroll_hover": "rgba(255, 255, 255, 0.34)",
    "drop_highlight": "rgba(142, 197, 255, 0.30)",
    "thumb_bg": "rgba(0, 0, 0, 0.28)",
    "badge_bg": "#e0453f",
    "badge_text": "#ffffff",
}

LIGHT = {
    "root": "rgba(250, 251, 253, 0.80)",
    "root_border": "rgba(255, 255, 255, 0.75)",
    "header": "rgba(255, 255, 255, 0.30)",
    "text": "#1d2129",
    "text_dim": "rgba(29, 33, 41, 0.62)",
    "text_faint": "rgba(29, 33, 41, 0.40)",
    "card": "rgba(255, 255, 255, 0.62)",
    "card_hover": "rgba(255, 255, 255, 0.92)",
    "card_selected": "rgba(72, 140, 220, 0.18)",
    "card_selected_border": "rgba(56, 122, 205, 0.75)",
    "card_border": "rgba(0, 0, 0, 0.09)",
    "accent": "#2f6fbf",
    "button": "rgba(255, 255, 255, 0.55)",
    "button_hover": "rgba(0, 0, 0, 0.08)",
    "menu_bg": "rgba(252, 252, 254, 0.98)",
    "menu_border": "rgba(0, 0, 0, 0.14)",
    "menu_hover": "rgba(0, 0, 0, 0.07)",
    "menu_text": "#1d2129",
    "menu_danger": "#b3261e",
    "separator": "rgba(0, 0, 0, 0.10)",
    "scroll": "rgba(0, 0, 0, 0.20)",
    "scroll_hover": "rgba(0, 0, 0, 0.34)",
    "drop_highlight": "rgba(56, 122, 205, 0.20)",
    "thumb_bg": "rgba(0, 0, 0, 0.06)",
    "badge_bg": "#c9342e",
    "badge_text": "#ffffff",
}


def system_prefers_dark():
    """Follow the desktop's light/dark setting.

    Checks (in order) the GNOME/Cinnamon colour-scheme key, Cinnamon's own
    theme name heuristics, and finally the luminance of the GTK theme background.
    """
    try:
        from gi.repository import Gio

        source = Gio.SettingsSchemaSource.get_default()
        for schema, key in (
            ("org.gnome.desktop.interface", "color-scheme"),
            ("org.cinnamon.desktop.interface", "color-scheme"),
        ):
            if not source or not source.lookup(schema, True):
                continue
            settings = Gio.Settings.new(schema)
            # Cinnamon ships this schema without a color-scheme key on some
            # versions, and Gio aborts the process for unknown keys.
            if key not in settings.list_keys():
                continue
            value = settings.get_string(key)
            if value == "prefer-dark":
                return True
            if value == "prefer-light":
                return False
    except Exception:
        pass

    try:
        theme_name = (Gtk.Settings.get_default().get_property("gtk-theme-name") or "").lower()
        if "dark" in theme_name or theme_name.endswith("-black"):
            return True
        if "light" in theme_name:
            return False
    except Exception:
        pass

    try:
        window = Gtk.Window()
        ok, colour = window.get_style_context().lookup_color("theme_bg_color")
        if ok:
            luminance = 0.2126 * colour.red + 0.7152 * colour.green + 0.0722 * colour.blue
            return luminance < 0.5
    except Exception:
        pass
    return True


def palette(dark=True):
    return DARK if dark else LIGHT


def _css(p):
    """Build the stylesheet for one palette.

    Selector notes for GTK3:
      * The toplevel must be fully transparent; the rounded panel is #root, so
        the corners really are see-through on a compositing WM.
      * GTK3 popovers have a single ``popover`` node that carries the theme's
        ``background`` class, so custom styling must target
        ``popover.background.<class>`` and win on specificity.
    """
    return """
/* ---------- window shell ---------- */
window.pickup-window {{
    background-color: transparent;
    background-image: none;
}}

#pickup-root {{
    background-color: {root};
    border: 1px solid {root_border};
    border-radius: 16px;
}}

/* ---------- header (drag handle) ---------- */
#pickup-header {{
    background-color: {header};
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    border-bottom: 1px solid {separator};
    padding: 7px 9px;
}}

#pickup-title {{
    color: {text};
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.4px;
}}
#pickup-count {{
    color: {text_dim};
    font-size: 11px;
}}

.pickup-icon-button {{
    background-color: {button};
    border: none;
    border-radius: 999px;
    padding: 4px;
    min-width: 22px;
    min-height: 22px;
    color: {text};
    box-shadow: none;
}}
.pickup-icon-button:hover {{
    background-color: {button_hover};
}}
.pickup-icon-button:active {{
    background-color: {button_hover};
}}
.pickup-icon-button image {{
    color: {text};
}}

/* ---------- text buttons in header / empty state ---------- */
.pickup-pill {{
    background-color: {button};
    border: none;
    border-radius: 999px;
    padding: 4px 11px;
    font-size: 11px;
    color: {text};
    box-shadow: none;
}}
.pickup-pill:hover {{
    background-color: {button_hover};
}}
.pickup-pill:disabled {{
    color: {text_faint};
    background-color: transparent;
}}

/* ---------- scroll area ---------- */
#pickup-scroll {{
    background-color: transparent;
    border: none;
}}
#pickup-scroll viewport {{
    background-color: transparent;
}}
#pickup-scroll overshoot,
#pickup-scroll undershoot {{
    background: none;
}}
#pickup-flow {{
    background-color: transparent;
    padding: 10px;
}}
#pickup-list {{
    background-color: transparent;
    padding: 8px;
}}

/* ---------- item cards ---------- */
.pickup-card {{
    background-color: {card};
    border: 1px solid {card_border};
    border-radius: 12px;
}}
.pickup-card:hover {{
    background-color: {card_hover};
}}
.pickup-card.pickup-selected {{
    background-color: {card_selected};
    border: 1px solid {card_selected_border};
}}
.pickup-card.pickup-missing {{
    background-color: {card};
    border: 1px dashed {card_border};
}}
.pickup-name {{
    color: {text};
    font-size: 11.5px;
}}
.pickup-meta {{
    color: {text_dim};
    font-size: 10.5px;
}}
.pickup-missing .pickup-name {{
    color: {text_faint};
}}
.pickup-missing-label {{
    color: {menu_danger};
    font-size: 10px;
    font-weight: 700;
}}
.pickup-thumb {{
    background-color: {thumb_bg};
    border-radius: 8px;
}}
.pickup-thumb-empty {{
    background-color: {thumb_bg};
    border-radius: 8px;
}}
.pickup-ext {{
    color: {text};
    font-size: 10px;
    font-weight: 700;
}}
.pickup-ext-dim {{
    color: {text_dim};
    font-size: 10px;
    font-weight: 700;
}}
.pickup-pin {{
    color: {accent};
}}
.pickup-pin-dim {{
    color: {text_faint};
}}
/* The selection box is drawn by cards.SelectBox; these colours feed it:
   color = checked fill, background-color = empty fill, border = empty outline. */
.pickup-check {{
    color: {accent};
    background-color: {menu_bg};
    border: 1px solid {text_faint};
}}

/* list row tweaks */
.pickup-row-thumb {{
    background-color: {thumb_bg};
    border-radius: 8px;
}}

/* ---------- empty state ---------- */
#pickup-empty {{
    color: {text_dim};
    font-size: 12.5px;
}}
#pickup-empty-icon {{
    color: {text_faint};
}}

/* ---------- drop highlight ---------- */
#pickup-root.pickup-drop {{
    background-color: {drop_highlight};
    border: 1px solid {accent};
}}
#pickup-drop-hint {{
    color: {text};
    font-size: 12px;
    background-color: {card};
    border-radius: 10px;
    padding: 6px 12px;
}}

/* ---------- scrollbar ---------- */
#pickup-scroll scrollbar {{
    background-color: transparent;
    border: none;
    min-width: 8px;
}}
#pickup-scroll scrollbar slider {{
    background-color: {scroll};
    border-radius: 999px;
    min-width: 6px;
    min-height: 28px;
    border: 2px solid transparent;
    background-clip: padding-box;
}}
#pickup-scroll scrollbar slider:hover {{
    background-color: {scroll_hover};
}}
#pickup-scroll scrollbar trough {{
    background-color: transparent;
    border: none;
}}

/* ---------- custom context menu (GTK3 popover) ---------- */
popover.background.pickup-menu {{
    background-color: transparent;
    border: none;
    border-radius: 14px;
    padding: 0;
    margin: 0;
    box-shadow: none;
}}
popover.background.pickup-menu > box {{
    background-color: {menu_bg};
    border: 1px solid {menu_border};
    border-radius: 14px;
    padding: 6px;
}}
.popup-menu-item {{
    background-color: transparent;
    border-radius: 8px;
    padding: 6px 10px;
    min-height: 20px;
}}
.popup-menu-item:hover {{
    background-color: {menu_hover};
}}
.popup-menu-item:active {{
    background-color: {menu_hover};
}}
.popup-menu-item label {{
    color: {menu_text};
    font-size: 12px;
}}
.popup-menu-item image {{
    color: {menu_text};
}}
.popup-menu-item.pickup-danger label,
.popup-menu-item.pickup-danger image {{
    color: {menu_danger};
}}
.pickup-menu-separator {{
    background-color: {separator};
    min-height: 1px;
    margin: 4px 6px;
}}
.pickup-menu-heading {{
    color: {text_faint};
    font-size: 10px;
    font-weight: 700;
    padding: 4px 10px 2px 10px;
}}

/* ---------- layout switcher menu ---------- */
.popup-choice-item {{
    background-color: transparent;
    border-radius: 8px;
    padding: 6px 12px 6px 8px;
}}
.popup-choice-item:hover {{
    background-color: {menu_hover};
}}
.popup-choice-item label {{
    color: {menu_text};
    font-size: 12px;
}}
.popup-choice-item image {{
    color: {menu_text};
}}
.popup-choice-item.pickup-choice-active label,
.popup-choice-item.pickup-choice-active image {{
    color: {accent};
}}

/* ---------- inline toast ---------- */
#pickup-toast {{
    background-color: {menu_bg};
    border: 1px solid {menu_border};
    border-radius: 10px;
    color: {menu_text};
    font-size: 11.5px;
    padding: 6px 12px;
}}
""".format(**p)


def install_css(screen, dark=True):
    """Apply the stylesheet for the given mode. Returns the provider."""
    provider = Gtk.CssProvider()
    try:
        provider.load_from_data(_css(palette(dark)).encode("utf-8"))
    except Exception as exc:  # pragma: no cover - malformed CSS is a dev bug
        print("pickup: CSS error: %s" % exc)
    Gtk.StyleContext.add_provider_for_screen(
        screen, provider, Gtk.STYLE_PROVIDER_PRIORITY_USER + 1
    )
    return provider


def swap_css(screen, old_provider, dark):
    """Replace the installed stylesheet (runtime dark/light switch)."""
    if old_provider is not None:
        try:
            Gtk.StyleContext.remove_provider_for_screen(screen, old_provider)
        except Exception:
            pass
    return install_css(screen, dark)


def rgba_from_string(spec):
    colour = Gdk.RGBA()
    colour.parse(spec)
    return colour
