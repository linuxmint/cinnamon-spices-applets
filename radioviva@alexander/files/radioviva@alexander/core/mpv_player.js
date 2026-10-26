/**
 * RadioViva - MPV Audio Engine & IPC Controller
 * Controla o processo MPV via Unix Domain Socket (JSON IPC)
 * 100% assíncrono, sem travamento de interface no Cinnamon.
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
    }

    _cleanSocketFile() {
        try {
            const file = Gio.File.new_for_path(this.sockPath);
            file.delete(null);
        } catch (e) {
            // Ignora se o arquivo não existir
        }
    }

    _spawnMpv() {
        if (this.mpvProcess && !this.mpvProcess.get_if_exited()) {
            return true;
        }

        this._cleanSocketFile();

        // Inicialização blindada do MPV daemon:
        // --no-config: Impede carregamento de configs não controladas do usuário
        // --load-scripts=no: Impede execução de plugins Lua de terceiros
        // --ytdl=no: Impede chamada a python youtube-dl para streams de rádio
        const argv = [
            "/usr/bin/mpv",
            "--no-config",
            "--load-scripts=no",
            "--ytdl=no",
            "--idle=yes",
            "--no-video",
            "--no-terminal",
            "--gapless-audio=yes",
            `--input-ipc-server=${this.sockPath}`,
            `--volume=${this.currentVolume}`,
            "--demuxer-max-bytes=4096KiB",
            "--force-media-title=RadioViva",
            "--title=RadioViva"
        ];

        try {
            const launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.NONE
            });
            this.mpvProcess = launcher.spawnv(argv);
            return true;
        } catch (e) {
            global.logError(`[RadioViva] Falha ao iniciar MPV: ${e.message}`);
            this._setStatus(PlaybackStatus.ERROR);
            return false;
        }
    }

    _connectSocket(onConnected) {
        if (this.socketConn && this.socketConn.is_connected()) {
            if (onConnected) onConnected();
            return;
        }

        const client = new Gio.SocketClient();
        const address = Gio.UnixSocketAddress.new(this.sockPath);

        let attempts = 0;
        const maxWaitAttempts = 15; // 15 * 100ms = 1.5s max

        const tryConnect = () => {
            client.connect_async(address, this.cancellable, (cli, res) => {
                try {
                    this.socketConn = cli.connect_finish(res);
                    this.inStream = Gio.DataInputStream.new(this.socketConn.get_input_stream());
                    this.outStream = this.socketConn.get_output_stream();

                    this._setupPropertyObservers();
                    this._startListening();

                    if (onConnected) onConnected();
                } catch (err) {
                    attempts++;
                    if (attempts < maxWaitAttempts) {
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                            tryConnect();
                            return GLib.SOURCE_REMOVE;
                        });
                    } else {
                        global.logError(`[RadioViva] Erro de conexão socket IPC: ${err.message}`);
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
        this.sendCommand(["observe_property", 5, "audio-codec-name"]);
        this.sendCommand(["observe_property", 6, "audio-bitrate"]);
    }

    _startListening() {
        if (!this.inStream || this.cancellable.is_cancelled()) return;

        this.inStream.read_line_async(GLib.PRIORITY_DEFAULT, this.cancellable, (stream, res) => {
            try {
                const [line] = stream.read_line_finish_utf8(res);
                if (line) {
                    this._handleIpcMessage(line);
                }
                this._startListening();
            } catch (e) {
                // Socket fechado ou cancelado
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

        // Respostas de comandos
        if (msg.request_id && this.pendingRequests.has(msg.request_id)) {
            const cb = this.pendingRequests.get(msg.request_id);
            this.pendingRequests.delete(msg.request_id);
            cb(msg.error, msg.data);
            return;
        }

        // Eventos
        if (msg.event === "property-change") {
            this._handlePropertyChange(msg.name, msg.data);
        } else if (msg.event === "playback-restart") {
            if (this.status !== PlaybackStatus.STOPPED) {
                this._setStatus(PlaybackStatus.PLAYING);
            }
        } else if (msg.event === "end-file") {
            if (msg.reason === "error") {
                this._handlePlaybackError();
            } else if (msg.reason === "stop" || msg.reason === "eof") {
                this._setStatus(PlaybackStatus.STOPPED);
            }
        }
    }

    _handlePropertyChange(name, value) {
        if (name === "media-title") {
            this.currentTitle = (value || "").trim();
            this.callbacks.onMetadataChange({
                title: this.currentTitle,
                station: this.currentStation
            });
        } else if (name === "pause") {
            if (value && this.status === PlaybackStatus.PLAYING) {
                this._setStatus(PlaybackStatus.PAUSED);
            } else if (!value && this.status === PlaybackStatus.PAUSED) {
                this._setStatus(PlaybackStatus.PLAYING);
            }
        } else if (name === "idle-active") {
            if (value && this.status !== PlaybackStatus.LOADING) {
                this._setStatus(PlaybackStatus.STOPPED);
            }
        } else if (name === "volume" && typeof value === "number") {
            this.currentVolume = Math.round(value);
            this.callbacks.onVolumeChange(this.currentVolume);
        }
    }

    _handlePlaybackError() {
        if (this.currentStation && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this._setStatus(PlaybackStatus.LOADING);
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                if (this.currentStation) {
                    this.play(this.currentStation);
                }
                return GLib.SOURCE_REMOVE;
            });
        } else {
            this._setStatus(PlaybackStatus.ERROR);
        }
    }

    _setStatus(newStatus) {
        this.status = newStatus;
        if (newStatus === PlaybackStatus.STOPPED || newStatus === PlaybackStatus.ERROR) {
            this.currentTitle = "";
            if (this.isRecording) {
                this.stopRecording();
            }
        }
        this.callbacks.onStatusChange(this.status);
    }

    sendCommand(args, callback) {
        const reqId = this.nextRequestId++;
        if (callback) {
            this.pendingRequests.set(reqId, callback);
        }

        const payload = JSON.stringify({
            command: args,
            request_id: reqId
        }) + "\n";

        if (this.outStream && !this.outStream.is_closed()) {
            try {
                this.outStream.write(payload, this.cancellable);
            } catch (e) {
                global.logError(`[RadioViva] Erro ao enviar comando IPC: ${e.message}`);
            }
        }
    }

    play(station) {
        if (!station || !station.url) return;

        // Validação estrita de URL (Apenas protocolos remotos permitidos para streaming de rádio)
        const trimmedUrl = String(station.url).trim();
        const isSafeProtocol = /^(https?|mms|rtmps?):\/\/[^\s"'`<>]+$/i.test(trimmedUrl);
        if (!isSafeProtocol) {
            global.logError(`[RadioViva] URL de stream bloqueada por segurança (protocolo não permitido): ${trimmedUrl}`);
            this._setStatus(PlaybackStatus.ERROR);
            return;
        }

        this.currentStation = station;
        this.reconnectAttempts = 0;
        this._setStatus(PlaybackStatus.LOADING);

        const doPlay = () => {
            if (this.status === PlaybackStatus.STOPPED) return;
            this.sendCommand(["loadfile", trimmedUrl, "replace"]);
            this.sendCommand(["set_property", "pause", false]);
        };

        if (!this.mpvProcess || !this.socketConn || !this.socketConn.is_connected()) {
            this._spawnMpv();
            this._connectSocket(() => {
                doPlay();
            });
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
        this.reconnectAttempts = this.maxReconnectAttempts;
        this.sendCommand(["stop"]);
        this.sendCommand(["set_property", "pause", true]);
        this._setStatus(PlaybackStatus.STOPPED);
    }

    setVolume(volumePercent) {
        const vol = Math.max(0, Math.min(100, Math.round(volumePercent)));
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
        this.cancellable.cancel();
        if (this.isRecording) {
            this.stopRecording();
        }
        if (this.socketConn) {
            try {
                this.sendCommand(["quit"]);
                this.socketConn.close(null);
            } catch (e) {}
        }
        if (this.mpvProcess) {
            try {
                this.mpvProcess.force_exit();
            } catch (e) {}
        }
        this._cleanSocketFile();
    }
};
