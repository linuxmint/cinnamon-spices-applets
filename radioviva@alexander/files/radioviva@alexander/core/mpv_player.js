/**
 * RadioViva - MPV Audio Engine & IPC Controller
 * Controla o processo MPV via Unix Domain Socket (JSON IPC)
 * 100% assíncrono, sem processos órfãos, sem processos zumbis (<defunct>) e consumo zero em idle.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

var PlaybackStatus = {
    STOPPED: "stopped",
    LOADING: "loading",
    PLAYING: "playing",
    PAUSED: "paused",
    ERROR: "error"
};

var MpvPlayer = class MpvPlayer {
    constructor(callbacks = {}) {
        this.callbacks = Object.assign({
            onStatusChange: (status) => {},
            onMetadataChange: (meta) => {},
            onVolumeChange: (vol) => {},
            onRecordingChange: (isRec, path) => {}
        }, callbacks);

        const runtimeDir = GLib.get_user_runtime_dir() || "/tmp";
        this.sockPath = `${runtimeDir}/radioviva-${GLib.get_user_name()}.sock`;

        this.mpvProcess = null;
        this.socketConn = null;
        this.inStream = null;
        this.outStream = null;
        this.cancellable = new Gio.Cancellable();

        this._isConnecting = false;
        this._cleaningUpOrphans = false;
        this._afterCleanupCallback = null;
        this._pendingPlayCallback = null;
        this._connectTimeoutId = 0;
        this._reconnectTimeoutId = 0;

        this.status = PlaybackStatus.STOPPED;
        this.currentStation = null;
        this.currentTitle = "";
        this.currentVolume = 80;
        this.savedVolumeBeforeMute = 80;
        this.isRecording = false;
        this.recordingPath = "";

        this.nextRequestId = 1;
        this.pendingRequests = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;

        // Limpa processos órfãos de sessões anteriores do Cinnamon apenas na inicialização
        this._killOrphanMpvProcesses();
        this._cleanSocketFile();
    }

    _killOrphanMpvProcesses() {
        try {
            this._cleaningUpOrphans = true;
            const launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.STDERR_SILENCE | Gio.SubprocessFlags.STDOUT_SILENCE
            });
            const proc = launcher.spawnv([
                "/usr/bin/pkill",
                "-9",
                "-u",
                String(GLib.get_user_name()),
                "-f",
                "^/usr/bin/mpv .*--title=RadioViva$"
            ]);
            proc.wait_async(null, (p, res) => {
                try {
                    p.wait_finish(res);
                } catch (e) {}
                this._cleaningUpOrphans = false;
                if (this._afterCleanupCallback) {
                    const cb = this._afterCleanupCallback;
                    this._afterCleanupCallback = null;
                    cb();
                }
            });
        } catch (e) {
            this._cleaningUpOrphans = false;
        }
    }

    _cleanSocketFile() {
        try {
            const file = Gio.File.new_for_path(this.sockPath);
            file.delete(null);
        } catch (e) {
            // Ignora se o arquivo não existir
        }
    }

    _clearTimers() {
        if (this._connectTimeoutId > 0) {
            GLib.source_remove(this._connectTimeoutId);
            this._connectTimeoutId = 0;
        }
        if (this._reconnectTimeoutId > 0) {
            GLib.source_remove(this._reconnectTimeoutId);
            this._reconnectTimeoutId = 0;
        }
    }

    _closeSocket() {
        this._isConnecting = false;
        this.pendingRequests.clear();

        if (this.cancellable && !this.cancellable.is_cancelled()) {
            this.cancellable.cancel();
        }
        this.cancellable = new Gio.Cancellable();

        if (this.socketConn) {
            try {
                this.socketConn.close(null);
            } catch (e) {}
        }
        this.socketConn = null;
        this.inStream = null;
        this.outStream = null;
    }

    _terminateMpvProcess() {
        this._closeSocket();

        if (this.mpvProcess) {
            const proc = this.mpvProcess;
            this.mpvProcess = null;
            try {
                proc.force_exit();
            } catch (e) {}
        }

        this._cleanSocketFile();
    }

    _spawnMpv() {
        if (this.mpvProcess) {
            return true;
        }

        this._terminateMpvProcess();

        // Inicialização ultra-otimizada e blindada do MPV:
        // Desativa vídeo, capas de álbuns, OSD, scripts e bindings para uso mínimo de CPU e RAM.
        const argv = [
            "/usr/bin/mpv",
            "--no-config",
            "--load-scripts=no",
            "--ytdl=no",
            "--idle=yes",
            "--no-video",
            "--audio-display=no",
            "--vid=no",
            "--vo=null",
            "--no-terminal",
            "--gapless-audio=yes",
            "--no-osc",
            "--no-osd-bar",
            "--input-default-bindings=no",
            "--no-input-builtin-bindings",
            `--input-ipc-server=${this.sockPath}`,
            `--volume=${this.currentVolume}`,
            "--demuxer-max-bytes=2048KiB",
            "--title=RadioViva"
        ];

        try {
            const launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.STDERR_SILENCE | Gio.SubprocessFlags.STDOUT_SILENCE
            });
            const proc = launcher.spawnv(argv);
            this.mpvProcess = proc;

            // Colhe o status de saída assincronamente para nunca gerar processos <defunct> (zumbis)
            proc.wait_async(null, (p, res) => {
                try {
                    p.wait_finish(res);
                } catch (e) {}
                if (this.mpvProcess === proc) {
                    this.mpvProcess = null;
                    this._closeSocket();
                    if (this.status !== PlaybackStatus.STOPPED && this.status !== PlaybackStatus.ERROR) {
                        this._setStatus(PlaybackStatus.STOPPED);
                    }
                }
            });

            return true;
        } catch (e) {
            global.logError(`[RadioViva] Falha ao iniciar MPV: ${e.message}`);
            this._setStatus(PlaybackStatus.ERROR);
            return false;
        }
    }

    _connectSocket(onConnected) {
        if (this.socketConn && this.socketConn.is_connected() && this.outStream && !this.outStream.is_closed()) {
            if (onConnected) onConnected();
            return;
        }

        this._pendingPlayCallback = onConnected;

        // Evita múltiplas tentativas paralelas de conexão se o usuário clicar rápido
        if (this._isConnecting) {
            return;
        }

        this._isConnecting = true;
        const currentCancellable = this.cancellable;
        const address = Gio.UnixSocketAddress.new(this.sockPath);
        let attempts = 0;
        const maxWaitAttempts = 25; // 25 * 80ms = 2.0s max

        const tryConnect = () => {
            if (currentCancellable.is_cancelled() || this.status === PlaybackStatus.STOPPED) {
                this._isConnecting = false;
                return;
            }

            const client = new Gio.SocketClient();
            client.connect_async(address, currentCancellable, (cli, res) => {
                try {
                    const conn = cli.connect_finish(res);
                    if (currentCancellable.is_cancelled() || this.status === PlaybackStatus.STOPPED) {
                        try { conn.close(null); } catch (e) {}
                        this._isConnecting = false;
                        return;
                    }

                    this.socketConn = conn;
                    this.inStream = Gio.DataInputStream.new(this.socketConn.get_input_stream());
                    this.outStream = Gio.DataOutputStream.new(this.socketConn.get_output_stream());
                    this._isConnecting = false;

                    this._setupPropertyObservers();
                    this._startListening(currentCancellable);

                    if (this._pendingPlayCallback) {
                        const cb = this._pendingPlayCallback;
                        this._pendingPlayCallback = null;
                        cb();
                    }
                } catch (err) {
                    if (currentCancellable.is_cancelled() || this.status === PlaybackStatus.STOPPED) {
                        this._isConnecting = false;
                        return;
                    }

                    attempts++;
                    if (attempts < maxWaitAttempts) {
                        this._connectTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
                            this._connectTimeoutId = 0;
                            tryConnect();
                            return GLib.SOURCE_REMOVE;
                        });
                    } else {
                        this._isConnecting = false;
                        this._pendingPlayCallback = null;
                        global.logError(`[RadioViva] Erro de conexão socket IPC após ${attempts} tentativas: ${err.message}`);
                        this._setStatus(PlaybackStatus.ERROR);
                    }
                }
            });
        };

        tryConnect();
    }

    _setupPropertyObservers() {
        this.sendCommand(["observe_property", 1, "media-title"]);
        this.sendCommand(["observe_property", 2, "pause"]);
        this.sendCommand(["observe_property", 3, "idle-active"]);
        this.sendCommand(["observe_property", 4, "volume"]);
        this.sendCommand(["observe_property", 5, "metadata/by-key/icy-title"]);
    }

    _startListening(listenCancellable) {
        if (!this.inStream || !listenCancellable || listenCancellable.is_cancelled()) return;

        this.inStream.read_line_async(GLib.PRIORITY_DEFAULT, listenCancellable, (stream, res) => {
            try {
                const [line] = stream.read_line_finish_utf8(res);
                if (line !== null) {
                    const trimmed = line.trim();
                    if (trimmed.length > 0) {
                        this._handleIpcMessage(trimmed);
                    }
                    this._startListening(listenCancellable);
                } else {
                    // EOF: Conexão encerrada pelo MPV (para imediatamente o loop para não consumir CPU)
                    if (!listenCancellable.is_cancelled()) {
                        this._closeSocket();
                    }
                }
            } catch (e) {
                if (!listenCancellable.is_cancelled()) {
                    this._closeSocket();
                }
            }
        });
    }

    _handleIpcMessage(line) {
        let msg;
        try {
            msg = JSON.parse(line);
        } catch (e) {
            return;
        }

        if (msg.request_id && this.pendingRequests.has(msg.request_id)) {
            const cb = this.pendingRequests.get(msg.request_id);
            this.pendingRequests.delete(msg.request_id);
            cb(msg.error, msg.data);
            return;
        }

        if (msg.event === "property-change") {
            this._handlePropertyChange(msg.name, msg.data);
        } else if (msg.event === "playback-restart") {
            if (this.status !== PlaybackStatus.STOPPED && this.status !== PlaybackStatus.PAUSED) {
                this._setStatus(PlaybackStatus.PLAYING);
            }
        } else if (msg.event === "end-file") {
            if (msg.reason === "error") {
                this._handlePlaybackError();
            } else if (msg.reason === "stop" || msg.reason === "eof") {
                if (this.status !== PlaybackStatus.LOADING) {
                    this._setStatus(PlaybackStatus.STOPPED);
                }
            }
        }
    }

    _handlePropertyChange(name, value) {
        if (name === "media-title" || name === "metadata/by-key/icy-title") {
            const newTitle = (value || "").trim();
            if (newTitle && newTitle !== this.currentTitle && newTitle !== "RadioViva") {
                this.currentTitle = newTitle;
                this.callbacks.onMetadataChange({
                    title: this.currentTitle,
                    station: this.currentStation
                });
            }
        } else if (name === "pause") {
            if (value === true && this.status === PlaybackStatus.PLAYING) {
                this._setStatus(PlaybackStatus.PAUSED);
            } else if (value === false && this.status === PlaybackStatus.PAUSED) {
                this._setStatus(PlaybackStatus.PLAYING);
            }
        } else if (name === "idle-active") {
            if (value === true && this.status !== PlaybackStatus.LOADING && this.status !== PlaybackStatus.STOPPED) {
                this._setStatus(PlaybackStatus.STOPPED);
            }
        } else if (name === "volume" && typeof value === "number") {
            const rounded = Math.round(value);
            if (rounded !== this.currentVolume) {
                this.currentVolume = rounded;
                this.callbacks.onVolumeChange(this.currentVolume);
            }
        }
    }

    _handlePlaybackError() {
        if (this.status === PlaybackStatus.STOPPED) return;

        if (this.currentStation && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this._setStatus(PlaybackStatus.LOADING);
            this._clearTimers();
            this._reconnectTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                this._reconnectTimeoutId = 0;
                if (this.currentStation && this.status !== PlaybackStatus.STOPPED) {
                    this._startPlayback(this.currentStation, false);
                }
                return GLib.SOURCE_REMOVE;
            });
        } else {
            this._terminateMpvProcess();
            this._setStatus(PlaybackStatus.ERROR);
        }
    }

    _setStatus(newStatus) {
        this.status = newStatus;
        if (newStatus === PlaybackStatus.STOPPED || newStatus === PlaybackStatus.ERROR) {
            this.currentTitle = "";
            this.isRecording = false;
            this.recordingPath = "";
        }
        this.callbacks.onStatusChange(this.status);
    }

    sendCommand(args, callback) {
        if (!this.outStream || this.outStream.is_closed()) {
            return;
        }

        const reqId = this.nextRequestId++;
        if (callback) {
            this.pendingRequests.set(reqId, callback);
        }

        const payload = JSON.stringify({
            command: args,
            request_id: reqId
        }) + "\n";

        try {
            this.outStream.put_string(payload, this.cancellable);
        } catch (e) {
            global.logError(`[RadioViva] Erro ao enviar comando IPC: ${e.message}`);
            this._closeSocket();
        }
    }

    play(station) {
        this._startPlayback(station, true);
    }

    _startPlayback(station, resetRetries = true) {
        if (!station || !station.url) return;

        if (this._cleaningUpOrphans) {
            this._afterCleanupCallback = () => this._startPlayback(station, resetRetries);
            return;
        }

        // Validação estrita de URL (Apenas protocolos remotos permitidos para streaming de rádio)
        const trimmedUrl = String(station.url).trim();
        const isSafeProtocol = /^(https?|mms|rtmps?):\/\/[^\s"'`<>]+$/i.test(trimmedUrl);
        if (!isSafeProtocol) {
            global.logError(`[RadioViva] URL de stream bloqueada por segurança (protocolo não permitido): ${trimmedUrl}`);
            this._setStatus(PlaybackStatus.ERROR);
            return;
        }

        this._clearTimers();
        this.currentStation = station;
        this.currentTitle = "";
        if (resetRetries) {
            this.reconnectAttempts = 0;
        }
        this._setStatus(PlaybackStatus.LOADING);

        const doPlay = () => {
            if (this.status === PlaybackStatus.STOPPED) return;
            this.sendCommand(["loadfile", trimmedUrl, "replace"]);
            this.sendCommand(["set_property", "pause", false]);
            this.sendCommand(["set_property", "volume", this.currentVolume]);
        };

        const isAlive = Boolean(this.mpvProcess);
        const isSocketReady = this.socketConn && this.socketConn.is_connected() && this.outStream && !this.outStream.is_closed();

        if (!isAlive) {
            if (!this._spawnMpv()) return;
            this._connectSocket(doPlay);
        } else if (!isSocketReady) {
            this._connectSocket(doPlay);
        } else {
            doPlay();
        }
    }

    togglePause() {
        if (this.status === PlaybackStatus.PLAYING) {
            this.sendCommand(["set_property", "pause", true]);
            this._setStatus(PlaybackStatus.PAUSED);
        } else if (this.status === PlaybackStatus.PAUSED) {
            this.sendCommand(["set_property", "pause", false]);
            this._setStatus(PlaybackStatus.PLAYING);
        } else if (this.currentStation) {
            this.play(this.currentStation);
        }
    }

    stop() {
        this._clearTimers();
        this._afterCleanupCallback = null;
        this._pendingPlayCallback = null;
        this.reconnectAttempts = this.maxReconnectAttempts;

        // Envia quit e encerra o processo MPV completamente ao parar:
        // Garante 0% de CPU, 0MB de RAM e impossibilidade de áudio fantasma em segundo plano.
        if (this.outStream && !this.outStream.is_closed()) {
            try {
                this.sendCommand(["quit"]);
            } catch (e) {}
        }

        this._terminateMpvProcess();
        this._setStatus(PlaybackStatus.STOPPED);
    }

    setVolume(volumePercent) {
        const vol = Math.max(0, Math.min(100, Math.round(volumePercent)));
        if (vol === this.currentVolume) return;

        this.currentVolume = vol;
        this.sendCommand(["set_property", "volume", vol]);
        this.callbacks.onVolumeChange(this.currentVolume);
    }

    changeVolume(delta) {
        this.setVolume(this.currentVolume + delta);
    }

    toggleMute() {
        if (this.currentVolume > 0) {
            this.savedVolumeBeforeMute = this.currentVolume;
            this.setVolume(0);
        } else {
            this.setVolume(this.savedVolumeBeforeMute || 80);
        }
    }

    startRecording(customDir) {
        if (!this.currentStation || this.status === PlaybackStatus.STOPPED) {
            return false;
        }

        const baseDir = customDir || `${GLib.get_home_dir()}/Música/RadioViva`;
        const dirFile = Gio.File.new_for_path(baseDir);
        try {
            dirFile.make_directory_with_parents(null);
        } catch (e) {
            // Diretório já existe ou falha na criação
        }

        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
        const sanitizedName = (this.currentStation.name || "Radio").replace(/[^a-zA-Z0-9_-]/g, "_");
        this.recordingPath = `${baseDir}/${sanitizedName}_${dateStr}.mp3`;

        this.sendCommand(["set_property", "stream-record", this.recordingPath], (err) => {
            if (!err || err === "success") {
                this.isRecording = true;
                this.callbacks.onRecordingChange(true, this.recordingPath);
            }
        });
        return true;
    }

    stopRecording() {
        if (!this.isRecording) return;
        this.sendCommand(["set_property", "stream-record", ""], () => {
            this.isRecording = false;
            const savedPath = this.recordingPath;
            this.recordingPath = "";
            this.callbacks.onRecordingChange(false, savedPath);
        });
    }

    destroy() {
        this.stop();
    }
};
