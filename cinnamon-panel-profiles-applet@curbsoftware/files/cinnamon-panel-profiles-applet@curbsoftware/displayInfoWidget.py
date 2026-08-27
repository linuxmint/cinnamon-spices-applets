#!/usr/bin/python3
"""Read-only display summary for the Panel Profiles applet settings.

Shows how many displays are connected and what the active profile
expects, so the display numbers that used to live in the panel menu are
still one click away. Purely informational: the bound key is a placeholder
that this widget never reads or writes, and nothing here watches for
changes; the value refreshes whenever the settings window is reopened,
which is plenty for a diagnostics row.
"""

import json
import os

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gdk, GLib, Gtk

from xapp.SettingsWidgets import SettingsWidget, SettingsLabel

STATE_DIR = os.path.join(GLib.get_user_config_dir(),
                         "cinnamon-panel-profiles")


def _read_json(path):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return json.load(handle)
    except Exception:
        return None


def _connected_displays():
    try:
        display = Gdk.Display.get_default()
        if display:
            return display.get_n_monitors()
    except Exception:
        pass
    return None


def _active_profile_summary():
    """Return the active profile name and expected display count."""
    state = _read_json(os.path.join(STATE_DIR, "state.json"))
    if not isinstance(state, dict):
        return None, None
    profile_id = (state.get("activeProfileId")
                  or state.get("activePanelProfileId"))
    if not profile_id:
        return None, None
    profile = _read_json(
        os.path.join(STATE_DIR, "profiles", "%s.json" % profile_id))
    if not isinstance(profile, dict):
        return None, None
    topology = profile.get("monitorTopology") or {}
    expected = topology.get("expectedCount")
    if not isinstance(expected, int) or expected < 1:
        expected = None
    return profile.get("name"), expected


def _summary_text():
    connected = _connected_displays()
    connected_text = ("%d displays connected" % connected
                      if connected is not None else
                      "displays connected: ?")
    name, expected = _active_profile_summary()
    if not name:
        return "%s · no active profile" % connected_text
    expected_text = ("expects %d" % expected
                     if expected is not None else "expects ?")
    return "%s · active profile: %s (%s)" % (
        connected_text, name, expected_text)


class DisplayInfoWidget(SettingsWidget):
    bind_dir = None

    def __init__(self, info, key, settings):
        super(DisplayInfoWidget, self).__init__()
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(8)
        self.fill_row()

        self.label = SettingsLabel(info.get("description", "Displays"))
        self.pack_start(self.label, False, False, 0)

        self.value = Gtk.Label(xalign=0)
        self.value.set_line_wrap(True)
        self.value.get_style_context().add_class("dim-label")
        self.value.set_text(_summary_text())
        self.pack_start(self.value, False, False, 0)

        if info.get("tooltip"):
            self.set_tooltip_text(info["tooltip"])
