#!/usr/bin/python3
"""Profile management widget for the Panel Profiles applet settings.

Lists every saved profile with Rename, Duplicate
and Delete buttons. Runs inside the cinnamon-settings process and edits
the profile files and state.json directly; it never talks to the live
applet (there is no bridge). The applet re-reads profiles on every menu
open, so changes here appear the next time the panel menu is used, with no
restart.

Delete and apply share a short cross-process lock. Delete rechecks the
durable pending transaction while holding that lock immediately before
unlinking a profile, so an apply cannot lose its target between validation
and recovery capture.
"""

import copy
import hashlib
import json
import os
import re
import tempfile
import time
import uuid as uuidlib
from contextlib import contextmanager
from datetime import datetime, timezone

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import GLib, Gtk

from xapp.SettingsWidgets import SettingsWidget, SettingsLabel

STATE_DIR = os.path.join(GLib.get_user_config_dir(), "cinnamon-panel-profiles")
PROFILES_DIR = os.path.join(STATE_DIR, "profiles")
STATE_FILE = os.path.join(STATE_DIR, "state.json")
PROFILE_NAME_MAX = 80
SELF_UUID = "cinnamon-panel-profiles-applet@curbsoftware"
STORE_LOCK_FILE = os.path.join(STATE_DIR, "store.lock")
STORE_LOCK_STALE_SECONDS = 300
STORE_LOCK_WAIT_SECONDS = 2.0
_STORE_LOCK_DEPTH = 0
PROFILE_ID_RE = re.compile(r"^[A-Za-z0-9-]+$")
COMPONENT_RE = re.compile(r"^[A-Za-z0-9._+@-]+$")
RELATIVE_PATH_RE = re.compile(
    r"^[A-Za-z0-9._+@-]+/[A-Za-z0-9._+@-]+\.json$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")

def _now_iso():
    """Local-time ISO 8601 with offset, matching the JS %Y-%m-%dT%H:%M:%S%:z."""
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _read_json(path):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return json.load(handle)
    except Exception:
        return None


def _atomic_write_json(path, obj):
    """Write JSON with the applet's durability rules: temp sibling, 0600,
    atomic replace."""
    directory = os.path.dirname(path)
    fd, tmp = tempfile.mkstemp(dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(obj, handle, indent=2)
            handle.write("\n")
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


@contextmanager
def _store_lock():
    """Exclusive short lock shared with profileStore.js."""
    global _STORE_LOCK_DEPTH
    if _STORE_LOCK_DEPTH > 0:
        _STORE_LOCK_DEPTH += 1
        try:
            yield
        finally:
            _STORE_LOCK_DEPTH -= 1
        return
    os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
    fd = None
    deadline = time.monotonic() + STORE_LOCK_WAIT_SECONDS
    while fd is None:
        try:
            fd = os.open(STORE_LOCK_FILE,
                         os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            try:
                if time.time() - os.path.getmtime(STORE_LOCK_FILE) > \
                        STORE_LOCK_STALE_SECONDS:
                    os.unlink(STORE_LOCK_FILE)
                    continue
            except OSError:
                pass
            if time.monotonic() >= deadline:
                raise RuntimeError(
                    "Profile storage is busy. Try again in a moment.")
            time.sleep(0.02)
    _STORE_LOCK_DEPTH = 1
    try:
        yield
    finally:
        _STORE_LOCK_DEPTH = 0
        try:
            os.close(fd)
        finally:
            try:
                os.unlink(STORE_LOCK_FILE)
            except OSError:
                pass


def _valid_config(config):
    if not isinstance(config, dict):
        return False
    uuid = config.get("uuid")
    instance_id = config.get("instanceId")
    relative_path = config.get("relativePath")
    content = config.get("content")
    if not all(isinstance(v, str)
               for v in (uuid, instance_id, relative_path, content)):
        return False
    if (not uuid or uuid == ".." or not COMPONENT_RE.fullmatch(uuid)
            or (instance_id and
                (instance_id == ".." or
                 not COMPONENT_RE.fullmatch(instance_id)))
            or not RELATIVE_PATH_RE.fullmatch(relative_path)):
        return False
    owner, filename = relative_path.split("/", 1)
    expected = {uuid + ".json"}
    if instance_id:
        expected.add(instance_id + ".json")
    if owner != uuid or filename not in expected or uuid == SELF_UUID:
        return False
    digest = config.get("sha256")
    if digest in (None, ""):
        return True
    return (isinstance(digest, str) and SHA256_RE.fullmatch(digest) and
            hashlib.sha256(content.encode("utf-8")).hexdigest() == digest)


def _valid_profile(profile, filename_id):
    if not isinstance(profile, dict):
        return False
    version = profile.get("schemaVersion")
    if not isinstance(version, int) or isinstance(version, bool) or \
            version < 1 or version > 4:
        return False
    if (not PROFILE_ID_RE.fullmatch(filename_id)
            or profile.get("id") != filename_id
            or not isinstance(profile.get("name"), str)
            or not profile["name"].strip()
            or len(profile["name"].strip()) > PROFILE_NAME_MAX
            or not isinstance(profile.get("createdAt"), str)
            or not profile["createdAt"]
            or not isinstance(profile.get("updatedAt"), str)
            or not profile["updatedAt"]):
        return False
    topology = profile.get("monitorTopology")
    if (not isinstance(topology, dict)
            or not isinstance(topology.get("expectedCount"), int)
            or isinstance(topology.get("expectedCount"), bool)
            or topology["expectedCount"] < 1
            or not isinstance(topology.get("monitors"), list)):
        return False
    settings = profile.get("cinnamonSettings")
    if (not isinstance(settings, dict)
            or "panels-enabled" not in settings
            or "enabled-applets" not in settings):
        return False
    for key in ("panels-enabled", "enabled-applets"):
        record = settings[key]
        if (not isinstance(record, dict)
                or not isinstance(record.get("type"), str)
                or not record["type"]
                or not isinstance(record.get("value"), str)):
            return False
    applet_configs = profile.get("appletConfigs")
    desklet_configs = profile.get("deskletConfigs", [] if version < 2 else None)
    if (not isinstance(applet_configs, list)
            or not isinstance(desklet_configs, list)
            or not all(_valid_config(c)
                       for c in applet_configs + desklet_configs)):
        return False
    if version >= 4 and not isinstance(profile.get("includeDesklets"), bool):
        return False
    anchor = profile.get("managerAnchor")
    if anchor is not None and (not isinstance(anchor, dict)
                               or anchor.get("uuid") != SELF_UUID):
        return False
    return True


def _includes_desklets(profile):
    """Desklet scope, tolerating unmigrated v1/v2/v3 files."""
    if not isinstance(profile, dict):
        return False
    return (profile.get("includeDesklets") is True
            or profile.get("kind") in ("desklet", "both")
            or profile.get("scope") in ("desklets", "both"))


def _scan_profiles():
    """Return every profile on disk with its display fields."""
    if _STORE_LOCK_DEPTH == 0:
        with _store_lock():
            return _scan_profiles()
    out = []
    if not os.path.isdir(PROFILES_DIR):
        return out
    for name in os.listdir(PROFILES_DIR):
        if not name.endswith(".json"):
            continue
        pid = name[:-5]
        path = os.path.join(PROFILES_DIR, name)
        parsed = None if os.path.islink(path) else _read_json(path)
        if _valid_profile(parsed, pid):
            out.append({
                "id": pid,
                "include_desklets": _includes_desklets(parsed),
                "name": parsed["name"],
                "updated": str(parsed.get("updatedAt") or ""),
                "valid": True,
            })
        else:
            out.append({
                "id": pid,
                "include_desklets": None,
                "name": pid + " (unreadable)",
                "updated": "",
                "valid": False,
            })
    out.sort(key=lambda p: (not p["valid"], p["name"].lower()))
    return out


def _unique_name(base, taken):
    """First free name: base, "<base> Copy", "<base> Copy 2", ..."""
    if base not in taken:
        return base
    candidate = base + " Copy"
    n = 2
    while candidate in taken:
        candidate = "%s Copy %d" % (base, n)
        n += 1
    return candidate


def _fix_state_for_deleted(pid):
    """Clear state.json references to a deleted profile (the applet's
    store did this in JS; the widget owns deletes now)."""
    if _STORE_LOCK_DEPTH == 0:
        with _store_lock():
            return _fix_state_for_deleted(pid)
    state = _read_json(STATE_FILE)
    if not isinstance(state, dict):
        return
    changed = False
    for key in ("activeProfileId", "activePanelProfileId",
                "activeDeskletProfileId", "startupProfileId"):
        if state.get(key) == pid:
            state[key] = None
            changed = True
    if state.get("pendingApply") and state["pendingApply"].get("profileId") == pid:
        state["pendingApply"] = None
        changed = True
    if changed:
        _atomic_write_json(STATE_FILE, state)


def _delete_profile(pid):
    """Delete one profile without racing an apply transaction."""
    with _store_lock():
        state = _read_json(STATE_FILE)
        if (isinstance(state, dict)
                and isinstance(state.get("pendingApply"), dict)
                and state["pendingApply"].get("profileId") == pid):
            raise RuntimeError(
                "This profile started restoring and cannot be deleted yet.")
        os.unlink(os.path.join(PROFILES_DIR, pid + ".json"))
        _fix_state_for_deleted(pid)


class ProfilesManagerWidget(SettingsWidget):
    bind_dir = None

    def __init__(self, info, key, settings):
        super(ProfilesManagerWidget, self).__init__()
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(8)
        self.fill_row()

        self.settings = settings
        self.key = key

        self.pack_start(
            SettingsLabel(info.get("description", "Manage saved profiles")),
            False, False, 0)

        # Columns: id (hidden), desklet inclusion, name, updated.
        self.store = Gtk.ListStore(str, str, str, str)
        self.tree = Gtk.TreeView(model=self.store)
        for column, title in ((1, "Desklets"), (2, "Name"), (3, "Updated")):
            renderer = Gtk.CellRendererText()
            view = Gtk.TreeViewColumn(title, renderer, text=column)
            view.set_resizable(True)
            self.tree.append_column(view)
        self.tree.get_selection().connect("changed", lambda *a: self._update_buttons())
        self.tree.connect("row-activated", lambda *a: self._rename())

        scroll = Gtk.ScrolledWindow()
        scroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        scroll.set_min_content_height(200)
        scroll.set_shadow_type(Gtk.ShadowType.IN)
        scroll.add(self.tree)
        self.pack_start(scroll, True, True, 0)

        buttons = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        self.rename_button = Gtk.Button.new_with_label("Rename")
        self.duplicate_button = Gtk.Button.new_with_label("Duplicate")
        self.delete_button = Gtk.Button.new_with_label("Delete")
        self.rename_button.connect("clicked", lambda *a: self._rename())
        self.duplicate_button.connect("clicked", lambda *a: self._duplicate())
        self.delete_button.connect("clicked", lambda *a: self._delete())
        buttons.pack_start(self.rename_button, False, False, 0)
        buttons.pack_start(self.duplicate_button, False, False, 0)
        buttons.pack_start(self.delete_button, False, False, 0)
        self.pack_start(buttons, False, False, 0)

        hint = Gtk.Label(xalign=0)
        hint.set_text("Profiles are loaded from the panel menu. "
                      "Changes here edit the saved files directly.")
        hint.get_style_context().add_class("dim-label")
        self.pack_start(hint, False, False, 0)

        if info.get("tooltip"):
            self.set_tooltip_text(info["tooltip"])

        self._reload()

    # ------------------------------------------------------------------

    def _reload(self):
        self.store.clear()
        for profile in _scan_profiles():
            self.store.append((
                profile["id"],
                ("Included" if profile["include_desklets"] is True else
                 "Not included" if profile["include_desklets"] is False else
                 "Unknown"),
                profile["name"],
                profile["updated"],
            ))
        self._update_buttons()

    def _selected(self):
        """(row id, profile dict) for the selection, or (None, None)."""
        model, tree_iter = self.tree.get_selection().get_selected()
        if tree_iter is None:
            return None, None
        pid = model.get_value(tree_iter, 0)
        for profile in _scan_profiles():
            if profile["id"] == pid:
                return pid, profile
        return pid, None

    def _update_buttons(self):
        pid, profile = self._selected()
        valid = profile is not None and profile.get("valid")
        self.rename_button.set_sensitive(bool(valid))
        self.duplicate_button.set_sensitive(bool(valid))
        self.delete_button.set_sensitive(pid is not None)

    def _error_dialog(self, message):
        dialog = Gtk.MessageDialog(
            transient_for=self.get_toplevel(),
            modal=True,
            message_type=Gtk.MessageType.ERROR,
            buttons=Gtk.ButtonsType.CLOSE,
            text=message)
        dialog.run()
        dialog.destroy()

    # ------------------------------------------------------------------

    def _rename(self):
        pid, profile = self._selected()
        if not pid or not profile or not profile.get("valid"):
            return
        try:
            entry = Gtk.Entry()
            entry.set_text(profile["name"])
            entry.set_max_length(PROFILE_NAME_MAX)
            dialog = Gtk.Dialog(
                title="Rename profile",
                transient_for=self.get_toplevel(),
                modal=True)
            dialog.add_button("Cancel", Gtk.ResponseType.CANCEL)
            dialog.add_button("Rename", Gtk.ResponseType.OK)
            dialog.get_content_area().pack_start(entry, True, True, 8)
            entry.show()
            dialog.show_all()
            if dialog.run() != Gtk.ResponseType.OK:
                dialog.destroy()
                return
            name = entry.get_text().strip()[:PROFILE_NAME_MAX]
            dialog.destroy()
            if not name:
                return
            with _store_lock():
                taken = {p["name"] for p in _scan_profiles()
                         if p["id"] != pid}
                if name in taken:
                    raise RuntimeError(
                        "A profile with this name already exists.")
                path = os.path.join(PROFILES_DIR, pid + ".json")
                parsed = _read_json(path)
                if not _valid_profile(parsed, pid):
                    raise RuntimeError("The profile file could not be read.")
                parsed["name"] = name
                parsed["updatedAt"] = _now_iso()
                _atomic_write_json(path, parsed)
            self._reload()
        except Exception as exc:
            self._error_dialog("Rename failed: %s" % exc)

    def _duplicate(self):
        pid, profile = self._selected()
        if not pid or not profile or not profile.get("valid"):
            return
        try:
            with _store_lock():
                path = os.path.join(PROFILES_DIR, pid + ".json")
                parsed = _read_json(path)
                if not _valid_profile(parsed, pid):
                    raise RuntimeError("The profile file could not be read.")
                copy_profile = copy.deepcopy(parsed)
                copy_profile["id"] = str(uuidlib.uuid4())
                taken = {p["name"] for p in _scan_profiles()}
                copy_profile["name"] = _unique_name(profile["name"], taken)
                now = _now_iso()
                copy_profile["createdAt"] = now
                copy_profile["updatedAt"] = now
                _atomic_write_json(
                    os.path.join(PROFILES_DIR,
                                 copy_profile["id"] + ".json"),
                    copy_profile)
            self._reload()
        except Exception as exc:
            self._error_dialog("Duplicate failed: %s" % exc)

    def _delete(self):
        pid, profile = self._selected()
        if not pid:
            return
        try:
            state = _read_json(STATE_FILE)
            if (isinstance(state, dict)
                    and isinstance(state.get("pendingApply"), dict)
                    and state["pendingApply"].get("profileId") == pid):
                self._error_dialog(
                    "This profile is being restored and cannot be deleted yet.")
                return
            name = profile["name"] if profile else pid
            dialog = Gtk.MessageDialog(
                transient_for=self.get_toplevel(),
                modal=True,
                message_type=Gtk.MessageType.QUESTION,
                buttons=Gtk.ButtonsType.CANCEL,
                text="Delete \"%s\"?" % name)
            dialog.format_secondary_text(
                "The saved profile will be removed. "
                "Your current panels and desklets are not changed.")
            dialog.add_button("Delete", Gtk.ResponseType.ACCEPT)
            ok = dialog.run() == Gtk.ResponseType.ACCEPT
            dialog.destroy()
            if not ok:
                return
            _delete_profile(pid)
            self._reload()
        except Exception as exc:
            self._error_dialog("Delete failed: %s" % exc)
