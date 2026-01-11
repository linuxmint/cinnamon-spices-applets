let Pk = null;
try {
    imports.gi.versions.PackageKitGlib = "1.0";
    Pk = imports.gi.PackageKitGlib;
} catch (e) {
    // PackageKitGlib not installed or introspection not available
}

const UpdateState = Object.freeze({
    BLOCKED: 'blocked',
    INSTALLED: 'installed',
    AVAILABLE: 'available',
    OTHER: 'other',
});

/**
 * Decode update state code into (stateEnum, string)
 */
function decodeUpdateState(code) {
    if (!Pk) {
        return [UpdateState.OTHER, UpdateState.OTHER];
    }

    const tryDecode = (val) => {
        try {
            const s = Pk.InfoEnum.to_string(val);
            if (s !== String(val)) {
                let state = UpdateState.OTHER;
                if (val === Pk.InfoEnum.BLOCKED)
                    state = UpdateState.BLOCKED;
                else if (val === Pk.InfoEnum.INSTALLED)
                    state = UpdateState.INSTALLED;
                else if (val === Pk.InfoEnum.AVAILABLE)
                    state = UpdateState.AVAILABLE;
                return [state, s];
            }
        } catch (e) { /* ignore */ }
        return null;
    };

    // 1) direct enum
    let res = tryDecode(code);
    if (!res) {
        // 2) check 16-bit words (some backends encode value in high/low words)
        const lo = code & 0xFFFF;
        const hi = (code >>> 16) & 0xFFFF;
        if (lo) res = tryDecode(lo);
        if (!res && hi) res = tryDecode(hi);
    }

    return res || [UpdateState.OTHER, UpdateState.OTHER];
}

var Updates = class {
    constructor() {
        this.map = new Map();
    };

    add(info, pkgid, summary) {
        const [state, infoStr] = decodeUpdateState(info);
        if (state === UpdateState.BLOCKED || state == UpdateState.AVAILABLE) {
            return false;
        } else {
            const tokens = pkgid.split(';');
            if (tokens.length < 4) {
                return false;
            }

            const [name, version, arch, repo] = tokens;

            if (state === UpdateState.INSTALLED) {
                if (this.map.has(name) && this.map.get(name).localVersion === "") {
                    this.map.get(name).localVersion = version;
                    return true;
                } else {
                    return false;
                }
            } else {
                const obj = {
                    isFirmware: "0",
                    pkgid,
                    version,
                    localVersion: "",
                    arch,
                    repo,
                    type: infoStr,
                    description: summary,
                };
                this.map.set(name, obj);
                return false;
            }
        }
    }

    addFirmware(name, deviceid, localVersion, version, description) {
        const obj = {
            isFirmware: "1",
            deviceid,
            localVersion,
            version,
            type: "firmware",
            description,
        };
        this.map.set(name, obj);
    }

    toStr() {
        let out = "";
        for (const [name, obj] of this.map) {
            if (obj.isFirmware === "0") {
                out += `${obj.isFirmware}#${name}#${obj.pkgid}#${obj.version}#${obj.localVersion}#${obj.arch}#${obj.repo}#${obj.type}#${obj.description}\n`;
            } else {
                out += `${obj.isFirmware}#${name}#${obj.deviceid}#${obj.version}#${obj.localVersion}#${obj.type}#${obj.description}\n`;
            }
        }
        return out;
    }

    static fromStr(str) {
        const updates = new Updates();
        const lines = str.split('\n');
        for (let line of lines) {
            if (!(line = line.trim())) continue;
            const tokens = line.split('#');
            if (!tokens || tokens.length === 0 || !tokens[0]
                || (tokens[0] !== "0" && tokens[0] !== "1")
                || (tokens[0] === "0" && tokens.length < 9)
                || (tokens[0] === "1" && tokens.length < 7)) {
                continue;
            }

            const isFirmware = tokens[0] === "1";
            if (!isFirmware) {
                const [isFirmware, name, pkgid, version, localVersion, arch, repo, type, description] = tokens.map(t => t.trim());
                updates.map.set(name, { pkgid, version, localVersion, arch, repo, type, description, isFirmware });
            } else {
                const [isFirmware, name, deviceid, version, localVersion, type, description] = tokens.map(t => t.trim());
                updates.map.set(name, { deviceid, version, localVersion, type, description, isFirmware });
            }
        }
        return updates;
    }
}
