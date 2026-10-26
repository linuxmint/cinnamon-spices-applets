/**
 * RadioViva - Applet para Linux Mint Cinnamon
 * Player de controle visível e completo com menu persistente e configurações ricas.
 */

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Main = imports.ui.main;

class RadioVivaApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this.instanceId = instance_id;
        this.orientation = orientation;

        imports.searchPath.unshift(metadata.path);

        const { MpvPlayer, PlaybackStatus } = imports.core.mpv_player;
        this.PlaybackStatus = PlaybackStatus;

        // Inicializa o motor de áudio MPV
        this.player = new MpvPlayer({
            onStatusChange: this._onPlayerStatusChange.bind(this),
            onMetadataChange: this._onPlayerMetadataChange.bind(this),
            onVolumeChange: this._onPlayerVolumeChange.bind(this)
        });

        this._initSettings();
        this._initUi();
        this._buildMenu();
        this._buildContextMenu();

        // Scroll no ícone do painel para controle de volume
        this.actor.connect("scroll-event", this._onScrollEvent.bind(this));
    }

    _initSettings() {
        this.settings = new Settings.AppletSettings(this, this.metadata.uuid, this.instanceId);

        this.settings.bindProperty(Settings.BindingDirection.IN, "user-stations", "userStations", this._onUserStationsChanged.bind(this), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-station-on-panel", "showStationOnPanel", this._updatePanelDisplay.bind(this), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "panel-text-type", "panelTextType", this._updatePanelDisplay.bind(this), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "max-panel-text-length", "maxPanelTextLength", this._updatePanelDisplay.bind(this), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "icon-style", "iconStyle", this._updateIcon.bind(this), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "keep-menu-open-on-select", "keepMenuOpenOnSelect", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-notifications", "showNotifications", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "notify-on-station-change", "notifyOnStationChange", null, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "initial-volume", "initialVolume", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "volume-step", "volumeStep", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "keep-volume-between-sessions", "keepVolume", null, null);

        if (this.initialVolume && typeof this.initialVolume === "number") {
            this.player.currentVolume = this.initialVolume;
        }
    }

    _initUi() {
        this.set_applet_tooltip("RadioViva - Rádios do Brasil");
        this.iconPath = `${this.metadata.path}/icon.png`;
        this._updateIcon();
        this._updatePanelDisplay();
    }

    _updateIcon() {
        const style = this.iconStyle || "color";
        const isPlaying = (this.player.status === this.PlaybackStatus.PLAYING);

        if (style === "color") {
            const iconFile = Gio.File.new_for_path(this.iconPath);
            if (iconFile.query_exists(null)) {
                this.set_applet_icon_path(this.iconPath);
                return;
            }
        }

        // Estilo Monocromático (Symbolic SVG)
        const symIconPath = isPlaying
            ? `${this.metadata.path}/icons/radioviva-playing-symbolic.svg`
            : `${this.metadata.path}/icons/radioviva-symbolic.svg`;

        const symFile = Gio.File.new_for_path(symIconPath);
        if (symFile.query_exists(null)) {
            this.set_applet_icon_path(symIconPath);
        } else {
            this.set_applet_icon_symbolic_name(isPlaying ? "media-playback-start-symbolic" : "audio-x-generic-symbolic");
        }
    }

    _updatePanelDisplay() {
        if (!this.showStationOnPanel) {
            this.set_applet_label("");
            return;
        }

        const station = this.player.currentStation;
        if (!station || this.player.status === this.PlaybackStatus.STOPPED) {
            this.set_applet_label("");
            return;
        }

        let text = "";
        const type = this.panelTextType || "station";
        const maxLen = this.maxPanelTextLength || 24;

        if (type === "station") {
            text = station.name;
        } else if (type === "track") {
            text = this.player.currentTitle || station.name;
        } else {
            text = this.player.currentTitle ? `${station.name}: ${this.player.currentTitle}` : station.name;
        }

        if (text.length > maxLen) {
            text = text.substring(0, maxLen - 1) + "…";
        }

        this.set_applet_label(` ${text}`);
    }

    _onScrollEvent(actor, event) {
        const direction = event.get_scroll_direction();
        const step = this.volumeStep || 5;
        let delta = 0;

        if (direction === Clutter.ScrollDirection.UP) {
            delta = step;
        } else if (direction === Clutter.ScrollDirection.DOWN) {
            delta = -step;
        }

        if (delta !== 0) {
            this.player.changeVolume(delta);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_middle_clicked(event) {
        this._togglePlayPause();
    }

    _buildMenu() {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        // 1. Player Card de Controle (Sempre visível no topo)
        this._buildPlayerControlCard();

        // 2. Slider de Volume
        this.volumeSlider = new PopupMenu.PopupSliderMenuItem(this.player.currentVolume / 100);
        this.volumeSlider.connect("value-changed", (slider, val) => {
            const vol = Math.round(val * 100);
            this.player.setVolume(vol);
            if (this.keepVolume) {
                this.initialVolume = vol;
            }
        });
        this.menu.addMenuItem(this.volumeSlider);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 3. Seção das Rádios do Usuário (Minhas Rádios)
        this.stationsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this.stationsSection);
        this._populateUserStations();

        // 4. Separador e Botão de Configurações
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const configItem = new PopupMenu.PopupIconMenuItem("⚙️  Configurar Rádios...", "preferences-system-symbolic", St.IconType.SYMBOLIC);
        configItem.connect("activate", () => {
            Util.spawn(["xlet-settings", "applet", this.metadata.uuid, "-i", String(this.instanceId)]);
        });
        this.menu.addMenuItem(configItem);
    }

    _createControlButton(iconName, tooltipText, styleClass, onClick) {
        const btn = new St.Button({
            style_class: `radioviva-btn ${styleClass || ''}`,
            reactive: true,
            can_focus: true,
            track_hover: true
        });
        const icon = new St.Icon({
            icon_name: iconName,
            icon_size: 20,
            icon_type: St.IconType.SYMBOLIC
        });
        btn.set_child(icon);

        btn.connect("clicked", () => {
            onClick();
        });

        return { btn, icon };
    }

    _buildPlayerControlCard() {
        this.playerCard = new St.BoxLayout({
            vertical: true,
            style_class: "radioviva-player-card"
        });

        // Nome da Estação
        this.stationLabel = new St.Label({
            text: "RadioViva",
            style_class: "radioviva-station-name"
        });
        this.playerCard.add_child(this.stationLabel);

        // Nome da Música / Programa
        this.trackLabel = new St.Label({
            text: "Pronto para tocar",
            style_class: "radioviva-track-title"
        });
        this.playerCard.add_child(this.trackLabel);

        // Barra de Botões de Controle (Play/Pause, Stop, Vol -, Vol +, Mute)
        const toolbar = new St.BoxLayout({
            vertical: false,
            x_align: Clutter.ActorAlign.CENTER
        });

        // Botão Play / Pause
        const playCtrl = this._createControlButton("media-playback-start-symbolic", "Play / Pause", "radioviva-btn-play", () => {
            this._togglePlayPause();
        });
        this.playBtn = playCtrl.btn;
        this.playBtnIcon = playCtrl.icon;

        // Botão Stop (Parar)
        const stopCtrl = this._createControlButton("media-playback-stop-symbolic", "Parar", "radioviva-btn-stop", () => {
            this.player.stop();
        });
        this.stopBtn = stopCtrl.btn;

        // Botão Diminuir Volume (-)
        const volDownCtrl = this._createControlButton("audio-volume-low-symbolic", "Diminuir Volume", "", () => {
            const step = this.volumeStep || 5;
            this.player.changeVolume(-step);
        });

        // Botão Aumentar Volume (+)
        const volUpCtrl = this._createControlButton("audio-volume-high-symbolic", "Aumentar Volume", "", () => {
            const step = this.volumeStep || 5;
            this.player.changeVolume(step);
        });

        // Botão Mudo (Mute)
        const muteCtrl = this._createControlButton("audio-volume-muted-symbolic", "Mudo", "", () => {
            this.player.toggleMute();
        });

        toolbar.add_child(this.playBtn);
        toolbar.add_child(this.stopBtn);
        toolbar.add_child(volDownCtrl.btn);
        toolbar.add_child(volUpCtrl.btn);
        toolbar.add_child(muteCtrl.btn);

        this.playerCard.add_child(toolbar);

        this.menu.box.add_child(this.playerCard);
    }

    _togglePlayPause() {
        if (this.player.status === this.PlaybackStatus.PLAYING) {
            this.player.togglePause();
        } else if (this.player.status === this.PlaybackStatus.PAUSED) {
            this.player.togglePause();
        } else if (this.player.currentStation) {
            this.player.play(this.player.currentStation);
        } else {
            const stations = this.userStations || [];
            const first = stations.find(s => s.inc !== false);
            if (first) {
                this._playStation(first);
            }
        }
    }

    _onUserStationsChanged() {
        this._populateUserStations();
    }

    _populateUserStations() {
        this.stationsSection.removeAll();

        const stations = this.userStations || [];
        const enabledStations = stations.filter(s => s.inc !== false);

        if (enabledStations.length === 0) {
            const emptyItem = new PopupMenu.PopupMenuItem("Nenhuma rádio configurada. Clique abaixo em 'Configurar Rádios'", { reactive: false });
            this.stationsSection.addMenuItem(emptyItem);
            return;
        }

        const keepOpen = (this.keepMenuOpenOnSelect !== false);

        enabledStations.forEach(station => {
            const isPlayingThis = (this.player.currentStation && this.player.currentStation.url === station.url && this.player.status === this.PlaybackStatus.PLAYING);
            const iconName = isPlayingThis ? "media-playback-pause-symbolic" : "media-playback-start-symbolic";

            const item = new PopupMenu.PopupIconMenuItem(station.name, iconName, St.IconType.SYMBOLIC);

            // Permite manter o menu aberto ao selecionar a rádio (só fecha ao clicar fora)
            if (keepOpen) {
                item._onButtonReleaseEvent = function(actor, event) {
                    this.activate(event, true);
                    return true;
                };
            }

            item.connect("activate", () => {
                if (isPlayingThis) {
                    this.player.togglePause();
                } else {
                    this._playStation(station);
                }
            });
            this.stationsSection.addMenuItem(item);
        });
    }

    _buildContextMenu() {
        this._applet_context_menu.removeAll();

        const stopItem = new PopupMenu.PopupIconMenuItem("⏹️ Parar Reprodução", "media-playback-stop-symbolic", St.IconType.SYMBOLIC);
        stopItem.connect("activate", () => this.player.stop());
        this._applet_context_menu.addMenuItem(stopItem);

        const playPauseItem = new PopupMenu.PopupIconMenuItem("⏯️ Play / Pause", "media-playback-start-symbolic", St.IconType.SYMBOLIC);
        playPauseItem.connect("activate", () => this._togglePlayPause());
        this._applet_context_menu.addMenuItem(playPauseItem);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const volUpItem = new PopupMenu.PopupIconMenuItem("🔊 Aumentar Volume", "audio-volume-high-symbolic", St.IconType.SYMBOLIC);
        volUpItem.connect("activate", () => {
            const step = this.volumeStep || 5;
            this.player.changeVolume(step);
        });
        this._applet_context_menu.addMenuItem(volUpItem);

        const volDownItem = new PopupMenu.PopupIconMenuItem("🔉 Diminuir Volume", "audio-volume-low-symbolic", St.IconType.SYMBOLIC);
        volDownItem.connect("activate", () => {
            const step = this.volumeStep || 5;
            this.player.changeVolume(-step);
        });
        this._applet_context_menu.addMenuItem(volDownItem);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const settingsItem = new PopupMenu.PopupIconMenuItem("⚙️ Configurações...", "preferences-system-symbolic", St.IconType.SYMBOLIC);
        settingsItem.connect("activate", () => {
            Util.spawn(["xlet-settings", "applet", this.metadata.uuid, "-i", String(this.instanceId)]);
        });
        this._applet_context_menu.addMenuItem(settingsItem);
    }

    _playStation(station) {
        if (!station || !station.url) return;
        this.player.play(station);
        this.stationLabel.set_text(station.name || "RadioViva");
        this.trackLabel.set_text("Conectando...");

        if (this.notifyOnStationChange) {
            const safeName = GLib.markup_escape_text(station.name || "Rádio", -1);
            Main.notify("RadioViva", `Sintonizando: ${safeName}`);
        }
    }

    _onPlayerStatusChange(status) {
        if (status === this.PlaybackStatus.PLAYING) {
            this.playBtnIcon.set_icon_name("media-playback-pause-symbolic");
            this._updateIcon();
        } else if (status === this.PlaybackStatus.PAUSED) {
            this.playBtnIcon.set_icon_name("media-playback-start-symbolic");
            this.trackLabel.set_text("Pausado");
        } else if (status === this.PlaybackStatus.STOPPED) {
            this.playBtnIcon.set_icon_name("media-playback-start-symbolic");
            this.trackLabel.set_text("Parado");
            this._updateIcon();
        } else if (status === this.PlaybackStatus.LOADING) {
            this.trackLabel.set_text("Sintonizando...");
        } else if (status === this.PlaybackStatus.ERROR) {
            this.playBtnIcon.set_icon_name("media-playback-start-symbolic");
            this.trackLabel.set_text("Erro ao conectar");
        }

        this._populateUserStations();
        this._updatePanelDisplay();
        this._updateTooltip();
    }

    _onPlayerMetadataChange(meta) {
        let rawTitle = (meta.title || "Ao vivo").replace(/[\x00-\x1F\x7F]/g, "").trim();
        if (rawTitle.length > 200) {
            rawTitle = rawTitle.substring(0, 199) + "…";
        }

        this.trackLabel.set_text(rawTitle);
        this._updatePanelDisplay();
        this._updateTooltip();

        if (this.showNotifications && rawTitle && meta.station) {
            const safeStation = GLib.markup_escape_text(meta.station.name || "Rádio", -1);
            const safeTitle = GLib.markup_escape_text(rawTitle, -1);
            Main.notify(`RadioViva - ${safeStation}`, safeTitle);
        }
    }

    _onPlayerVolumeChange(volume) {
        if (this.volumeSlider) {
            this.volumeSlider.setValue(volume / 100);
        }
        this._updateTooltip();
    }

    _updateTooltip() {
        const station = this.player.currentStation;
        if (!station || this.player.status === this.PlaybackStatus.STOPPED) {
            this.set_applet_tooltip("RadioViva - Rádios do Brasil");
            return;
        }

        const vol = this.player.currentVolume;
        const track = this.player.currentTitle ? `\n🎵 ${this.player.currentTitle}` : "";
        this.set_applet_tooltip(`RadioViva: ${station.name}${track}\n🔊 Volume: ${vol}%`);
    }

    on_applet_removed_from_panel() {
        if (this.player) {
            this.player.destroy();
        }
        if (this.settings) {
            this.settings.finalize();
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new RadioVivaApplet(metadata, orientation, panel_height, instance_id);
}
