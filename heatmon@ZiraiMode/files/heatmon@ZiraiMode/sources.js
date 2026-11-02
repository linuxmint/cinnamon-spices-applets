// System data sources: async sysfs/procfs readers and the nvidia-smi stream.
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const { parseNvidiaSmiLine } = require('./metrics');

Gio._promisify(Gio.File.prototype, 'load_contents_async', 'load_contents_finish');
Gio._promisify(Gio.File.prototype, 'enumerate_children_async', 'enumerate_children_finish');
Gio._promisify(Gio.FileEnumerator.prototype, 'next_files_async', 'next_files_finish');

const decoder = new TextDecoder();

async function readText(path) {
    try {
        const [bytes] = await Gio.File.new_for_path(path).load_contents_async(null);
        return decoder.decode(bytes);
    } catch (e) {
        return null;
    }
}

async function listDir(path) {
    const names = [];
    try {
        const en = await Gio.File.new_for_path(path).enumerate_children_async(
            'standard::name', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null);
        for (;;) {
            const infos = await en.next_files_async(100, GLib.PRIORITY_DEFAULT, null);
            if (!infos.length)
                break;
            for (const info of infos)
                names.push(info.get_name());
        }
    } catch (e) {
        // missing directory → empty list
    }
    return names;
}

async function readTrim(path) {
    const t = await readText(path);
    return t === null ? null : t.trim();
}

async function hwmonDirs() {
    const dirs = (await listDir('/sys/class/hwmon')).sort().map(n => `/sys/class/hwmon/${n}`);
    const names = await Promise.all(dirs.map(d => readTrim(`${d}/name`)));
    return dirs.map((dir, i) => ({ dir, name: names[i] }));
}

async function findCpuSensors() {
    const hw = (await hwmonDirs()).find(h => ['coretemp', 'k10temp', 'zenpower'].includes(h.name));
    if (!hw)
        return null;
    const dir = hw.dir;
    const labelFiles = (await listDir(dir)).filter(f => /^temp\d+_label$/.test(f));
    const labels = await Promise.all(labelFiles.map(f => readTrim(`${dir}/${f}`)));
    let packagePath = null;
    const cores = [];
    labelFiles.forEach((f, i) => {
        const label = labels[i] || '';
        const input = `${dir}/${f.replace('_label', '_input')}`;
        if (['Package id 0', 'Tctl', 'Tdie'].includes(label)) {
            if (packagePath === null || label === 'Tdie')
                packagePath = input;
        } else {
            const c = /^Core (\d+)$/.exec(label);
            if (c)
                cores.push({ n: Number(c[1]), label: `C${c[1]}`, path: input });
        }
    });
    if (packagePath === null)
        packagePath = `${dir}/temp1_input`;
    cores.sort((a, b) => a.n - b.n);
    return { packagePath, cores: cores.map(({ label, path }) => ({ label, path })) };
}

async function findNvmeSensors() {
    const nvme = (await hwmonDirs()).filter(h => h.name === 'nvme');
    const models = await Promise.all(nvme.map(h => readTrim(`${h.dir}/device/model`)));
    return nvme.map((h, i) => ({ model: models[i] || h.dir.split('/').pop(), path: `${h.dir}/temp1_input` }));
}

async function readMilliC(path) {
    const v = parseInt(await readText(path), 10);
    return isNaN(v) ? null : v / 1000;
}

async function readCpuFreqs() {
    const base = '/sys/devices/system/cpu';
    const cpus = (await listDir(base)).filter(n => /^cpu\d+$/.test(n));
    const khz = (await Promise.all(cpus.map(n => readText(`${base}/${n}/cpufreq/scaling_cur_freq`))))
        .map(t => parseInt(t, 10)).filter(v => !isNaN(v));
    if (!khz.length)
        return null;
    return { avgGHz: khz.reduce((a, b) => a + b, 0) / khz.length / 1e6, maxGHz: Math.max(...khz) / 1e6 };
}

async function readCpuModel() {
    const t = await readText('/proc/cpuinfo');
    const m = t && /^model name\s*:\s*(.+)$/m.exec(t);
    return m ? m[1].trim() : null;
}

async function listInterfaces() {
    return (await listDir('/sys/class/net')).filter(n => n !== 'lo').sort();
}

function lookupIPv4(iface, cb) {
    if (!iface) {
        cb(null);
        return;
    }
    try {
        const proc = Gio.Subprocess.new(['ip', '-4', '-o', 'addr', 'show', 'dev', iface],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        proc.communicate_utf8_async(null, null, (p, res) => {
            try {
                const [, stdout] = p.communicate_utf8_finish(res);
                const m = /inet (\d+\.\d+\.\d+\.\d+\/\d+)/.exec(stdout || '');
                cb(m ? m[1] : null);
            } catch (e) {
                cb(null);
            }
        });
    } catch (e) {
        cb(null);
    }
}

const SMI_QUERY = '--query-gpu=temperature.gpu,utilization.gpu,memory.used,memory.total,' +
    'power.draw,power.limit,fan.speed,clocks.gr,clocks.mem,name';

class NvidiaSmi {
    static available() {
        return GLib.find_program_in_path('nvidia-smi') !== null;
    }

    constructor() {
        this.latest = null;
        this._proc = null;
        this._cancellable = null;
        this._restartId = 0;
        this._stopped = true;
        this._interval = 1000;
    }

    start(intervalMs) {
        this._stopped = false;
        this._interval = intervalMs;
        const cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        try {
            this._proc = Gio.Subprocess.new(
                ['nvidia-smi', '-i', '0', SMI_QUERY, '--format=csv,noheader,nounits',
                    '-lms', String(intervalMs)],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        } catch (e) {
            this._proc = null;
            this._scheduleRestart();
            return;
        }
        const stream = new Gio.DataInputStream({ base_stream: this._proc.get_stdout_pipe() });
        this._readLine(stream, cancellable);
    }

    _readLine(stream, cancellable) {
        stream.read_line_async(GLib.PRIORITY_DEFAULT, cancellable, (s, res) => {
            if (cancellable.is_cancelled())
                return;
            let line;
            try {
                [line] = s.read_line_finish_utf8(res);
            } catch (e) {
                line = null;
            }
            if (line === null) {
                this._scheduleRestart();
                return;
            }
            const parsed = parseNvidiaSmiLine(line);
            if (parsed)
                this.latest = Object.assign(parsed, { time: GLib.get_monotonic_time() });
            this._readLine(stream, cancellable);
        });
    }

    _scheduleRestart() {
        if (this._stopped || this._restartId)
            return;
        global.logError(`${__meta.uuid}: nvidia-smi exited, restarting in 10 s`);
        if (this._proc) {
            this._proc.force_exit();
            this._proc = null;
        }
        this._restartId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this._restartId = 0;
            if (!this._stopped)
                this.start(this._interval);
            return GLib.SOURCE_REMOVE;
        });
    }

    stop() {
        this._stopped = true;
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        if (this._proc) {
            this._proc.force_exit();
            this._proc = null;
        }
        if (this._restartId) {
            GLib.source_remove(this._restartId);
            this._restartId = 0;
        }
        this.latest = null;
    }
}

module.exports = {
    readText, findCpuSensors, findNvmeSensors, readMilliC, readCpuFreqs,
    readCpuModel, listInterfaces, lookupIPv4, NvidiaSmi,
};
