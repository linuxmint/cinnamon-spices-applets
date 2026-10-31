#!/usr/bin/python3
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 randomkiapps
"""Opt-in setup of the tested EE 7.2.3 / PipeWire / WirePlumber stereo route.

The read-only status command is safe at applet startup. Only enable/disable
write settings or restart audio. All subprocess arguments bypass the shell.
"""
import ast
import fcntl
import gettext
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

UUID = "easy-effects-selector@randomkiapps"
SCHEMA = "com.github.wwmm.easyeffects"
OUTPUT = SCHEMA + ".streamoutputs"
INPUT = SCHEMA + ".streaminputs"
SINK = "ee_route_sink"
_ = gettext.translation(UUID, str(Path.home() / ".local/share/locale"), fallback=True).gettext
LEGACY_STREAM = "ee_route_playback"
# EE 7 displays this node name verbatim in its exclusions. Keep the actual
# translated identity in the saved state, including across language changes.
STREAM = _("Preset Selector – Forwarding")
STREAM_NAMES = {LEGACY_STREAM, "Preset Selector – Forwarding", "Preset Selector – Weiterleitung", STREAM}


def route_config(pretty=True):
    args = {
        "node.name": "ee_route", "audio.channels": 2, "audio.position": ["FL", "FR"],
        "capture.props": {"media.class": "Audio/Sink", "node.name": SINK,
                          "node.description": _("Preset Selector – Fixed output") if pretty else "EE fester Ausgang",
                          "priority.session": 0},
        "playback.props": {"node.name": STREAM if pretty else LEGACY_STREAM,
                           "node.description": STREAM if pretty else "EE Weiterleitung",
                           "node.passive": True, "node.dont-reconnect": False,
                           "node.dont-move": True, "state.restore-target": False}
    }
    if pretty:
        args["playback.props"].update({"application.name": STREAM,
                                      "application.icon-name": "com.github.wwmm.easyeffects"})
    return {"context.modules": [{"name": "libpipewire-module-loopback", "args": args}]}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def atomic_write(path, data):
    if path.is_symlink():
        raise RuntimeError(_("A routing file is a symbolic link; it was left unchanged."))
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".ee-route-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


class Routing:
    def __init__(self, config=None, run=None):
        self.config = Path(config or os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
        self.file = self.config / "pipewire/pipewire.conf.d/90-ee-route.conf"
        self.state_file = self.config / UUID / "bypass-route.json"
        self.run = run or self.command

    @staticmethod
    def command(argv, check=True):
        result = subprocess.run(argv, capture_output=True, text=True, timeout=15, check=False)
        if check and result.returncode:
            raise RuntimeError(result.stderr.strip() or _("The audio command failed."))
        return result

    def get(self, schema, key):
        value = self.run(["gsettings", "get", schema, key]).stdout.strip()
        if value in ("true", "false"):
            return value == "true"
        if value.startswith("@as "):
            value = value[4:]
        return ast.literal_eval(value)

    def set(self, schema, key, value):
        literal = ("true" if value else "false") if isinstance(value, bool) else repr(value)
        self.run(["gsettings", "set", schema, key, literal])

    def state(self):
        if self.state_file.is_symlink():
            raise RuntimeError(_("A routing file is a symbolic link; it was left unchanged."))
        if not self.state_file.exists():
            return None
        state = json.loads(self.state_file.read_text())
        if state.get("owner") != UUID or state.get("format") != 1:
            raise RuntimeError(_("The saved routing information is invalid."))
        return state

    def save(self, state):
        atomic_write(self.state_file, (json.dumps(state, ensure_ascii=False, indent=2) + "\n").encode())

    def status(self):
        state = self.state()
        result = {"enabled": False, "managed": False, "stream": None}
        if not (state and state.get("enabled")):
            return result
        if not self.file.is_file() or self.file.is_symlink():
            return {**result, "error": _("The managed routing file is missing or has been replaced.")}
        if not self.owns_file(state):
            return {**result, "error": _("The routing configuration was changed outside the applet; it was left unchanged.")}
        stream = self.stream_name(state)
        result.update(managed=True, stream=stream)
        # Inspect the actual EE preferences, not just our last successful setup.
        # No settings, state files or services are changed by this command.
        try:
            self.check_version()
            current = self.snapshot()
            output, input_settings = current["output"], current["input"]
            if output["use-default-output-device"] or output["output-device"] != SINK \
                    or input_settings["use-default-input-device"]:
                return {**result, "error": _("The Easy Effects device settings no longer match the bypass-preserving route. Enable this option again to restore it.")}
            if stream not in output["blocklist"]:
                return {**result, "missing-exclusion": True,
                        "error": _("The forwarding application could not be excluded.")}
        except Exception as error:
            return {**result, "error": str(error)}
        return {**result, "enabled": True}

    def stream_name(self, state):
        # Older 1.5.1 states have no stream field. Read their owned configuration
        # so startup works without migrating or restarting audio implicitly.
        args = json.loads(self.file.read_text())["context.modules"][0]["args"]
        stream = args["playback.props"]["node.name"]
        if not isinstance(stream, str) or not stream or ("stream" in state and state["stream"] != stream):
            raise RuntimeError(_("The saved routing information is invalid."))
        return stream

    def check_version(self):
        version = self.run(["easyeffects", "--version"]).stdout.strip().split()
        if not version or version[-1] != "7.2.3":
            raise RuntimeError(_("This routing option requires the native Easy Effects 7.2.3 package."))

    def owns_file(self, state):
        return self.file.is_file() and not self.file.is_symlink() and digest(self.file.read_bytes()) == state.get("sha256")

    def nodes(self):
        return json.loads(self.run(["pw-dump"]).stdout)

    def running(self):
        return "true" in self.run([
            "gdbus", "call", "--session", "--dest", "org.freedesktop.DBus",
            "--object-path", "/org/freedesktop/DBus", "--method", "org.freedesktop.DBus.NameHasOwner", SCHEMA
        ]).stdout

    def wait(self, condition):
        deadline = time.monotonic() + 7
        while time.monotonic() < deadline:
            if condition():
                return
            time.sleep(0.1)
        raise RuntimeError(_("The audio service did not become ready in time."))

    def preflight(self):
        for name in ("gsettings", "pw-dump", "systemctl", "gdbus", "easyeffects"):
            if not shutil.which(name):
                raise RuntimeError(_("A required command is missing: %s") % name)
        if any(os.environ.get(key) for key in ("PIPEWIRE_CONFIG_DIR", "PIPEWIRE_CONFIG_PREFIX", "PIPEWIRE_CONFIG_NAME")):
            raise RuntimeError(_("A custom PipeWire configuration is in use; it was left unchanged."))
        self.check_version()
        services = []
        for name in ("pipewire.service", "pipewire-pulse.service", "wireplumber.service"):
            if self.run(["systemctl", "--user", "is-active", name], check=False).returncode == 0:
                services.append(name)
            elif name != "pipewire-pulse.service":
                raise RuntimeError(_("PipeWire and WirePlumber must be running."))
        # Read and verify every required setting before writing anything.
        for schema, keys in ((OUTPUT, ("use-default-output-device", "output-device", "blocklist")),
                             (INPUT, ("use-default-input-device", "input-device"))):
            for key in keys:
                if self.run(["gsettings", "writable", schema, key]).stdout.strip() != "true":
                    raise RuntimeError(_("The Easy Effects device settings are not writable."))
        if self.run(["gsettings", "writable", SCHEMA, "bypass"]).stdout.strip() != "true":
            raise RuntimeError(_("The Easy Effects bypass setting is not writable."))
        return services

    def snapshot(self):
        return {"output": {key: self.get(OUTPUT, key) for key in
                           ("use-default-output-device", "output-device", "blocklist")},
                "input": {key: self.get(INPUT, key) for key in ("use-default-input-device", "input-device")}}

    @staticmethod
    def default_device(nodes, key):
        for obj in nodes:
            if obj.get("type") == "PipeWire:Interface:Metadata":
                for entry in obj.get("metadata", []):
                    if entry.get("key") == key:
                        value = entry.get("value", {})
                        value = json.loads(value) if isinstance(value, str) else value
                        return value.get("name", "")
        return ""

    def default_sink(self, nodes):
        name = self.default_device(nodes, "default.audio.sink")
        if name and name not in (SINK, "easyeffects_sink"):
            return name
        raise RuntimeError(_("A physical default output device could not be found."))

    def restart(self, services, was_running, bypass, enabled):
        self.run(["systemctl", "--user", "restart", *services])
        def route_ready():
            nodes = self.nodes()
            names = [obj.get("info", {}).get("props", {}).get("node.name") for obj in nodes]
            if enabled:
                state = self.state()
                return SINK in names and self.stream_name(state) in names
            # systemctl returning does not mean WirePlumber has discovered the
            # physical devices yet. Wait on teardown as well as on setup.
            default = self.default_device(nodes, "default.audio.sink")
            return bool(default and default in names and default not in (SINK, "easyeffects_sink"))
        self.wait(route_ready)
        if was_running:
            # A background service survives the short-lived setup process.
            subprocess.Popen(["easyeffects", "--gapplication-service"], stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)
            self.wait(self.running)
            self.restore_bypass(bypass)
        else:
            self.set(SCHEMA, "bypass", bypass)

    def restore_bypass(self, bypass):
        # EE can clear bypass again when devices arrive after its bus name is
        # acquired. Observe both devices and bypass until startup settles; this
        # bounded restoration ends with the transaction, including on disable.
        deadline = time.monotonic() + 8
        previous = None
        stable_since = time.monotonic()
        applied = False
        while time.monotonic() < deadline:
            devices = self.snapshot()
            nodes = self.nodes()
            physical = sorted((obj.get("id", 0),
                               obj.get("info", {}).get("props", {}).get("node.name", ""))
                              for obj in nodes if obj.get("info", {}).get("props", {}).get("media.class")
                              in ("Audio/Sink", "Audio/Source")
                              and obj.get("info", {}).get("props", {}).get("node.name")
                              not in ("easyeffects_sink", "easyeffects_source"))
            signature = (devices, physical, self.default_device(nodes, "default.audio.sink"),
                         self.default_device(nodes, "default.audio.source"))
            now = time.monotonic()
            if signature != previous:
                previous, stable_since = signature, now
            if not applied or self.get(SCHEMA, "bypass") != bypass:
                self.run(["easyeffects", "--bypass=" + ("1" if bypass else "2")])
                applied, stable_since = True, time.monotonic()
            elif now - stable_since >= 2:
                return
            time.sleep(0.1)
        raise RuntimeError(_("The bypass state did not settle after restarting Easy Effects."))

    def change(self, enabled):
        state = self.state()
        installed = bool(state and state.get("enabled"))
        if enabled and installed:
            if self.file.exists() and not self.owns_file(state):
                raise RuntimeError(_("The routing configuration was changed outside the applet; it was left unchanged."))
            status = self.status()
            if status["enabled"] and status["stream"] == STREAM:
                return status
            # An explicit re-enable repairs changed preferences or a missing
            # owned file and migrates the legacy name. Preserve the first backup.
        if not enabled and not installed:
            return {"enabled": False, "managed": False, "stream": None}
        services = self.preflight()
        nodes = self.nodes()
        previous = self.snapshot()
        output = previous["output"]
        input_settings = previous["input"]
        bypass = self.get(SCHEMA, "bypass")
        was_running = self.running()
        if self.file.is_symlink():
            raise RuntimeError(_("A routing file is a symbolic link; it was left unchanged."))
        old_file = self.file.read_bytes() if self.file.exists() else None
        old_state = self.state_file.read_bytes() if self.state_file.exists() else None
        if installed and old_file is not None and not self.owns_file(state):
            raise RuntimeError(_("The routing configuration was changed outside the applet; it was left unchanged."))
        old_stream = self.stream_name(state) if installed and old_file is not None else LEGACY_STREAM
        reserved = STREAM_NAMES | {old_stream}
        if enabled:
            # Only the exact manually tested configuration can be adopted.
            if old_file is not None and not installed:
                try:
                    known = json.loads(old_file) == route_config(pretty=False)
                except (ValueError, UnicodeError):
                    known = False
                if not known:
                    raise RuntimeError(_("An existing routing configuration was left unchanged."))
            for path in self.file.parent.glob("*.conf"):
                if path != self.file and (SINK in path.read_text() or any(name in path.read_text() for name in reserved)):
                    raise RuntimeError(_("Another configuration already defines the Easy Effects route."))
            backup = state["previous"] if installed else {"output": dict(output), "input": dict(input_settings)}
            if backup["output"]["output-device"] == SINK:
                backup["output"]["use-default-output-device"] = True
                backup["output"]["output-device"] = self.default_sink(nodes)
            input_device = input_settings["input-device"] or self.default_device(nodes, "default.audio.source")
            data = (json.dumps(route_config(), ensure_ascii=False, indent=4) + "\n").encode()
            new_state = {"owner": UUID, "format": 1, "enabled": True,
                         "sha256": digest(data), "previous": backup, "input-device": input_device, "stream": STREAM}
            if old_file is not None and not installed:
                # Keep a recovery copy which PipeWire will not load as a fragment.
                atomic_write(self.state_file.parent / "manual-route-before-applet.json", old_file)
        elif old_file is not None and not self.owns_file(state):
            raise RuntimeError(_("The routing configuration was changed outside the applet; it was left unchanged."))
        try:
            # Stop EE before touching its device; 7.2.3 resets bypass on changes.
            if was_running:
                self.run(["easyeffects", "--quit"])
                self.wait(lambda: not self.running())
            if enabled:
                atomic_write(self.file, data)
                self.save(new_state)
                self.set(OUTPUT, "blocklist", [name for name in output["blocklist"] if name not in reserved] + [STREAM])
                self.set(OUTPUT, "use-default-output-device", False)
                self.set(OUTPUT, "output-device", SINK)
                # Keep the tested stable input: default-source changes also reset global bypass.
                self.set(INPUT, "use-default-input-device", False)
                if input_device != input_settings["input-device"]:
                    self.set(INPUT, "input-device", input_device)
            else:
                # Preserve a device selected by the user while this option was on.
                if output["output-device"] == SINK:
                    self.set(OUTPUT, "use-default-output-device", state["previous"]["output"]["use-default-output-device"])
                    self.set(OUTPUT, "output-device", state["previous"]["output"]["output-device"])
                if not input_settings["use-default-input-device"] and input_settings["input-device"] == state["input-device"]:
                    for key, value in state["previous"]["input"].items():
                        self.set(INPUT, key, value)
                self.set(OUTPUT, "blocklist", [name for name in output["blocklist"] if name not in reserved])
                self.file.unlink(missing_ok=True)
                self.save({**state, "enabled": False})
            self.restart(services, was_running, bypass, enabled)
            return self.status()
        except Exception as error:
            # Transaction rollback retains unrelated settings, files and exclusions.
            try:
                if self.running():
                    self.run(["easyeffects", "--quit"])
                    self.wait(lambda: not self.running())
                if old_file is None:
                    self.file.unlink(missing_ok=True)
                else:
                    atomic_write(self.file, old_file)
                if old_state is None:
                    self.state_file.unlink(missing_ok=True)
                else:
                    atomic_write(self.state_file, old_state)
                for schema, values in ((OUTPUT, output), (INPUT, input_settings)):
                    for key, value in values.items():
                        self.set(schema, key, value)
                self.restart(services, was_running, bypass, old_file is not None and output["output-device"] == SINK)
            except Exception as recovery:
                raise RuntimeError(_("Setup failed: %s\nRecovery also failed: %s") % (error, recovery)) from error
            raise RuntimeError(_("Setup failed; the previous configuration was restored: %s") % error) from error


def main():
    route = Routing()
    action = sys.argv[1] if len(sys.argv) == 2 else ""
    try:
        if action == "status":
            # A Cinnamon reload can overlap an existing setup process. Read its
            # final state under the same lock without creating anything at startup.
            lock_file = route.state_file.parent / "bypass-route.lock"
            if lock_file.is_symlink():
                raise RuntimeError(_("A routing file is a symbolic link; it was left unchanged."))
            if lock_file.exists():
                with lock_file.open("r") as lock:
                    fcntl.flock(lock, fcntl.LOCK_SH)
                    result = route.status()
            else:
                result = route.status()
        elif action in ("enable", "disable"):
            # A lock serializes rapid switch changes and Cinnamon reloads.
            lock_file = route.state_file.parent / "bypass-route.lock"
            lock_file.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            if lock_file.is_symlink():
                raise RuntimeError(_("A routing file is a symbolic link; it was left unchanged."))
            with lock_file.open("a") as lock:
                fcntl.flock(lock, fcntl.LOCK_EX)
                result = route.change(action == "enable")
        else:
            raise RuntimeError("Unknown action")
    except Exception as error:
        try:
            result = {**route.status(), "error": str(error)}
        except Exception:
            result = {"enabled": False, "managed": False, "stream": None, "error": str(error)}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
