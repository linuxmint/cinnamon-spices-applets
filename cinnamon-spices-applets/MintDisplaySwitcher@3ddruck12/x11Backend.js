// x11Backend.js — X11-Display-Backend via xrandr (voll implementiert)

const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const DisplayInfo = require('./displayInfo');

/** Regex: Zeile mit Auflösung und Position, z. B. 1920x1080+0+0 */
const GEOMETRY_PATTERN = /(\d+)x(\d+)\+(-?\d+)\+(-?\d+)/;

/** Regex: xrandr-Output-Zeile */
const OUTPUT_LINE_PATTERN = /^(\S+)\s+(connected|disconnected)/;

class X11Backend {
    getName() {
        return 'x11';
    }

    canApplyModes() {
        return true;
    }

    /**
     * Liest den aktuellen Display-Zustand via xrandr --query.
     * @param {object} [options] — preferredExternal
     * @returns {object} DisplaySnapshot
     */
    getSnapshot(options = {}) {
        let stdout = '';
        try {
            const result = GLib.spawn_command_line_sync('xrandr --query', null);
            stdout = ByteArray.toString(result[1]);
        } catch (e) {
            global.logError('[MintDisplaySwitcher] xrandr --query fehlgeschlagen: ' + e.message);
            return this._emptySnapshot();
        }

        const snapshot = this._parseXrandrQuery(stdout);
        return this._applyPreferredExternal(snapshot, options.preferredExternal);
    }

    /**
     * Wendet einen Anzeigemodus via xrandr an.
     * @param {string} mode — MODES-Wert aus displayInfo.js
     * @param {object} [options] — extendPosition, preferredExternal
     * @returns {{ success: boolean, error?: string }}
     */
    applyMode(mode, options = {}) {
        const snapshot = this.getSnapshot(options);
        const command = this._buildXrandrCommand(mode, snapshot, options);

        if (!command) {
            return {
                success: false,
                error: 'Modus für aktuelles Display-Setup nicht verfügbar'
            };
        }

        try {
            const [, , stderr, exitCode] = GLib.spawn_command_line_sync(
                'xrandr ' + command, null);

            if (exitCode !== 0) {
                const errText = stderr ? ByteArray.toString(stderr).trim() : '';
                return {
                    success: false,
                    error: errText || 'xrandr-Befehl fehlgeschlagen (Exit ' + exitCode + ')'
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
     * Parst die Ausgabe von xrandr --query in einen DisplaySnapshot.
     * @param {string} output — Rohtext von xrandr
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
                // "primary" kann vor der Geometrie stehen
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
                    // Verbunden, aber ausgeschaltet (--off)
                    info.active = false;
                }
            }

            outputs.push(info);
        }

        // Internes Display: erstes internes Output (connected oder bekannt)
        let internal = outputs.find(o => o.role === 'internal' && o.connected);
        if (!internal)
            internal = outputs.find(o => o.role === 'internal');

        // Externes Display: erstes verbundenes externes, sonst erstes bekanntes externe
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
     * Setzt bevorzugtes externes Display, falls in den Einstellungen angegeben.
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
     * Baut die xrandr-Argumente für einen Modus.
     * @param {string} mode
     * @param {object} snapshot
     * @param {object} [options] — extendPosition
     * @returns {string|null} xrandr-Argumente ohne "xrandr"-Präfix
     */
    _buildXrandrCommand(mode, snapshot, options = {}) {
        const internal = snapshot.internal;
        const external = snapshot.external;

        if (!internal)
            return null;

        const internalName = internal.name;
        const externalName = external ? external.name : null;

        switch (mode) {
        case DisplayInfo.MODES.LAPTOP:
            if (!DisplayInfo.isModeAvailable(mode, snapshot))
                return null;
            if (externalName && external.connected)
                return `--output ${externalName} --off --output ${internalName} --auto --primary`;
            return `--output ${internalName} --auto --primary`;

        case DisplayInfo.MODES.EXTERNAL:
            if (!externalName || !DisplayInfo.isModeAvailable(mode, snapshot))
                return null;
            return `--output ${internalName} --off --output ${externalName} --auto --primary`;

        case DisplayInfo.MODES.MIRROR:
            if (!externalName || !DisplayInfo.isModeAvailable(mode, snapshot))
                return null;
            return `--output ${internalName} --auto --primary --output ${externalName} --same-as ${internalName} --auto`;

        case DisplayInfo.MODES.EXTEND: {
            if (!externalName || !DisplayInfo.isModeAvailable(mode, snapshot))
                return null;
            const position = options.extendPosition || 'right-of';
            const valid = ['right-of', 'left-of', 'above', 'below'];
            const rel = valid.includes(position) ? position : 'right-of';
            return `--output ${internalName} --auto --primary --output ${externalName} --auto --${rel} ${internalName}`;
        }

        default:
            return null;
        }
    }
}
