// x11Backend.js — X11 display backend via xrandr

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const DisplayInfo = require('./displayInfo');

/** Regex: geometry line, e.g. 1920x1080+0+0 */
const GEOMETRY_PATTERN = /(\d+)x(\d+)\+(-?\d+)\+(-?\d+)/;

/** Regex: xrandr output line */
const OUTPUT_LINE_PATTERN = /^(\S+)\s+(connected|disconnected)/;

class X11Backend {
    getName() {
        return 'x11';
    }

    canApplyModes() {
        return true;
    }

    /**
     * Reads the current display state via xrandr --query.
     * Uses Gio.Subprocess to avoid blocking the main loop.
     * @param {object} [options] — preferredExternal
     * @returns {object} DisplaySnapshot
     */
    getSnapshot(options = {}) {
        let stdout = '';
        try {
            const proc = Gio.Subprocess.new(
                ['xrandr', '--query'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);

            const [, stdoutBytes] = proc.communicate(null, null);
            if (stdoutBytes)
                stdout = stdoutBytes.get_data() instanceof Uint8Array
                    ? new TextDecoder().decode(stdoutBytes.get_data())
                    : stdoutBytes.get_data().toString();
        } catch (e) {
            global.logError('[MintDisplaySwitcher] xrandr --query failed: ' + e.message);
            return this._emptySnapshot();
        }

        const snapshot = this._parseXrandrQuery(stdout);
        return this._applyPreferredExternal(snapshot, options.preferredExternal);
    }

    /**
     * Applies a display mode via xrandr.
     * Uses Gio.Subprocess to avoid blocking the main loop.
     * @param {string} mode — MODES value from displayInfo.js
     * @param {object} [options] — extendPosition, preferredExternal
     * @returns {{ success: boolean, error?: string }}
     */
    applyMode(mode, options = {}) {
        const snapshot = this.getSnapshot(options);
        const argv = this._buildXrandrArgv(mode, snapshot, options);

        if (!argv) {
            return {
                success: false,
                error: 'Mode not available for current display setup'
            };
        }

        try {
            const proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDERR_PIPE);

            const [, , stderrBytes] = proc.communicate(null, null);
            const exitCode = proc.get_exit_status();

            if (exitCode !== 0) {
                let errText = '';
                if (stderrBytes) {
                    errText = stderrBytes.get_data() instanceof Uint8Array
                        ? new TextDecoder().decode(stderrBytes.get_data()).trim()
                        : stderrBytes.get_data().toString().trim();
                }
                return {
                    success: false,
                    error: errText || 'xrandr command failed (exit ' + exitCode + ')'
                };
            }
        } catch (e) {
            return { success: false, error: e.message };
        }

        return { success: true };
    }

    _emptySnapshot() {
        return {
            backend: 'x11',
            internal: null,
            external: null,
            outputs: []
        };
    }

    /**
     * Parses xrandr --query output into a DisplaySnapshot.
     * @param {string} output — raw xrandr text
     */
    _parseXrandrQuery(output) {
        const outputs = [];
        const lines = output.split('\n');

        for (const line of lines) {
            const match = line.match(OUTPUT_LINE_PATTERN);
            if (!match)
                continue;

            const name = match[1];
            const state = match[2];
            const role = DisplayInfo.classifyOutputRole(name);
            const info = DisplayInfo.emptyOutput(name, role);

            info.connected = (state === 'connected');

            if (info.connected) {
                const isPrimary = line.includes(' primary ');
                const geomMatch = line.match(GEOMETRY_PATTERN);

                if (geomMatch) {
                    info.active = true;
                    info.width = parseInt(geomMatch[1], 10);
                    info.height = parseInt(geomMatch[2], 10);
                    info.x = parseInt(geomMatch[3], 10);
                    info.y = parseInt(geomMatch[4], 10);
                    info.primary = isPrimary || line.indexOf('primary') !== -1;
                } else {
                    // Connected but switched off (--off)
                    info.active = false;
                }
            }

            outputs.push(info);
        }

        let internal = outputs.find(o => o.role === 'internal' && o.connected);
        if (!internal)
            internal = outputs.find(o => o.role === 'internal');

        let external = outputs.find(o => o.role === 'external' && o.connected);
        if (!external)
            external = outputs.find(o => o.role === 'external');

        return {
            backend: 'x11',
            internal: internal || null,
            external: external || null,
            outputs: outputs
        };
    }

    /**
     * Overrides the external display with a user-preferred output name.
     */
    _applyPreferredExternal(snapshot, preferredExternal) {
        if (!preferredExternal || !String(preferredExternal).trim())
            return snapshot;

        const name = String(preferredExternal).trim();
        const found = snapshot.outputs.find(o => o.name === name);
        if (found)
            snapshot.external = found;

        return snapshot;
    }

    /**
     * Builds an xrandr argument vector for the given mode.
     * Returns null when the mode is not available.
     * @param {string} mode
     * @param {object} snapshot
     * @param {object} [options] — extendPosition
     * @returns {string[]|null}
     */
    _buildXrandrArgv(mode, snapshot, options = {}) {
        const internal = snapshot.internal;
        const external = snapshot.external;

        if (!internal)
            return null;

        const int = internal.name;
        const ext = external ? external.name : null;

        switch (mode) {
        case DisplayInfo.MODES.LAPTOP:
            if (!DisplayInfo.isModeAvailable(mode, snapshot))
                return null;
            if (ext && external.connected)
                return ['xrandr',
                    '--output', int, '--auto', '--primary', '--pos', '0x0',
                    '--output', ext, '--off'];
            return ['xrandr', '--output', int, '--auto', '--primary', '--pos', '0x0'];

        case DisplayInfo.MODES.EXTERNAL:
            if (!ext || !DisplayInfo.isModeAvailable(mode, snapshot))
                return null;
            return ['xrandr', '--output', int, '--off',
                '--output', ext, '--auto', '--primary'];

        case DisplayInfo.MODES.MIRROR:
            if (!ext || !DisplayInfo.isModeAvailable(mode, snapshot))
                return null;
            return ['xrandr',
                '--output', int, '--auto', '--primary',
                '--output', ext, '--same-as', int, '--auto'];

        case DisplayInfo.MODES.EXTEND: {
            if (!ext || !DisplayInfo.isModeAvailable(mode, snapshot))
                return null;
            const validPositions = ['right-of', 'left-of', 'above', 'below'];
            const pos = validPositions.includes(options.extendPosition)
                ? options.extendPosition : 'right-of';
            return ['xrandr',
                '--output', int, '--auto', '--primary',
                '--output', ext, '--auto', '--' + pos, int];
        }

        default:
            return null;
        }
    }
}
