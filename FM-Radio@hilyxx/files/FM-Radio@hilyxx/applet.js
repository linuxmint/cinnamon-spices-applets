// === IMPORTS & CONSTANTS ===
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Pango = imports.gi.Pango;
const Clutter = imports.gi.Clutter;
const Slider = imports.ui.slider;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;

const UUID = "FM-Radio@hilyxx";
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;
if (imports.searchPath.indexOf(AppletDir) === -1) {
    imports.searchPath.push(AppletDir);
}

const RadioModule = imports.radio; 
const Radio = RadioModule.Radio;
const Channels = imports.channels;
const Data = imports.data;
const Search = imports.search;
const Mpris = imports.mpris;

// === CORE UI CONTROLLER ===
class FMRadioApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.uuid = metadata.uuid;
        this.extPath = metadata.path;

        this.settings = new Settings.AppletSettings(this, this.uuid, instance_id);
        this.settings.bind("custom_stations", "custom_stations", this._onSettingsChanged, this);
        this.settings.bind("key_play_pause", "key_play_pause", this._bindKeyBindings, this);
        this.settings.bind("show_recording_notifications", "show_recording_notifications");
        this.settings.bind("recording_folder", "recording_folder");
        this.settings.bind("import_file", "import_file");
        this.settings.bind("search_keyword", "search_keyword");
        this.settings.bind("search_results_list", "search_results_list");
        this.settings.bind("search_full_data", "search_full_data");
        this.settings.bind("search_warning", "search_warning");

        if (!this.recording_folder || this.recording_folder.trim() === "") {
            this.recording_folder = "file://" + this._getDefaultMusicDir();
        }
        
        this._onClearClicked();

        // Send the station list to channels.js before starting the player
        Channels.setChannels(this.custom_stations);

        let savedPrefs = Data.load();
        let initialChannel = Channels.getChannel(savedPrefs.lastChannel) ?? Channels.getChannel(0);
        this.player = new Radio.RadioPlayer(initialChannel);
        this.player.setVolume(savedPrefs.lastVol ?? 1);

        this.set_applet_icon_symbolic_path(this.extPath + "/icon/radio-off-symbolic.svg");
        this.set_applet_tooltip(_("FM Radio"));
        
        this.isRecording = false;
        this.recordProcess = null;
        this.blinkTimerId = null;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._buildMenu();

        let reloadMenuItem = new PopupMenu.PopupIconMenuItem(
            _("Reload applet"), 
            "view-refresh-symbolic", 
            St.IconType.SYMBOLIC
        );
        
        reloadMenuItem.connect('activate', () => {
            global.log("Radio FM : Manual reload.");
            
            this._onSettingsChanged();
            
            if (this.player && this.player.isPlaying()) {
                this.player.stop();
                this.setPlayingState(false);
            }
        });
        
        this._applet_context_menu.addMenuItem(reloadMenuItem);

        this._bindKeyBindings();
        this._startHijackTimer();
    }

    _onSettingsChanged() {
        // Updates the station list in memory and reloads the menu
        Channels.setChannels(this.custom_stations);
        this._loadChannels();
    }

    // === SEARCH/ADD STATION(S) ===
    _onSearchClicked() {
        let keyword = this.search_keyword;
        Search.findStations(keyword, (resultsArray, fullDataArray) => {
            
            if (typeof resultsArray === "string") {
                this.search_warning = "empty";
                this.search_results_list = [];
                this.search_full_data = [];
                return;
            }

            if (!resultsArray || resultsArray.length === 0) {
                this.search_warning = "not_found";
                this.search_results_list = [];
                this.search_full_data = [];
                return;
            }

            this.search_warning = "none";
            this.search_results_list = resultsArray;
            this.search_full_data = fullDataArray || []; 
        });
    }

    _onAddSelectedClicked() {
        if (!this.search_results_list || this.search_results_list.length === 0) return;

        let toAdd = this.search_results_list.filter(item => item.select === true);

        if (toAdd.length === 0) {
            this._showNotification(_("FM Radio"), _("Please select a station."));
            return;
        }

        let currentList = JSON.parse(JSON.stringify(this.custom_stations || []));

        toAdd.forEach(station => {
            let originalData = this.search_full_data.find(s => s.url === station.url);
            
            let realName = originalData ? originalData.name : station.name;

            currentList.push({
                name: realName,
                link: station.url,
                pic: station.pic || ""
            });
        });

        this.settings.setValue("custom_stations", currentList);
        this.custom_stations = currentList;
        this._onSettingsChanged();

        let resetList = this.search_results_list.map(item => { 
            item.select = false; 
            return item; 
        });
        this.settings.setValue("search_results_list", resetList);

        let message = (toAdd.length === 1) 
            ? _("station added successfully!") 
            : _("stations added successfully!");

        this._showNotification(_("FM Radio"), toAdd.length + " " + message);
    }

    _onClearClicked() {
        if (this.search_keyword !== "") this.search_keyword = "";
        
        this.search_warning = "none";
        this.search_results_list = [];
        this.search_full_data = [];
    }

    _getDefaultMusicDir() {
        let musicDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_MUSIC);
        return musicDir ? musicDir : (GLib.get_home_dir() + "/" + _("Music"));
    }

    _onResetFolderClicked() {
        this.recording_folder = "file://" + this._getDefaultMusicDir();
    }

    _showNotification(title, msg) {
        if (!this._notificationSource) {
            this._notificationSource = new MessageTray.SystemNotificationSource(title);
            Main.messageTray.add(this._notificationSource);
        }
        
        let notification = new MessageTray.Notification(this._notificationSource, title, msg);
        
        notification.setTransient(false);
        this._notificationSource.notify(notification);
    }

    // === BACKUP ===
    _onExportClicked() {
        let backupPath = this._getDefaultMusicDir() + "/FM-Radio-Stations-Backup.json";
        
        try {
            let jsonString = JSON.stringify(this.custom_stations, null, 4);
            GLib.file_set_contents(backupPath, jsonString);
            this._showNotification(_("FM Radio"), _("Stations successfully saved to:\n") + backupPath);
        } catch (e) {
            global.logError("FM Radio: Error exporting stations - " + e);
            this._showNotification(_("FM Radio"), _("Error saving backup."));
        }
    }

    _onImportClicked() {
        if (!this.import_file || this.import_file.trim() === "") {
            this._showNotification(_("FM Radio"), _("Please select a backup file to import first."));
            return;
        }
        
        let path = this.import_file.replace("file://", "");
        let file = Gio.file_new_for_path(path);
        
        file.load_contents_async(null, (sourceFile, res) => {
            try {
                let [success, contents] = sourceFile.load_contents_finish(res);
                if (success) {
                    let data = imports.byteArray.toString(contents);
                    let stations = JSON.parse(data);
                    
                    if (Array.isArray(stations)) {
                        this.settings.setValue("custom_stations", stations);
                    
                       this.custom_stations = stations;
                       this._onSettingsChanged();
                    
                       this.settings.setValue("import_file", "");
                    
                       this._showNotification(_("FM Radio"), _("Stations successfully restored!"));
                   } else {
                       this._showNotification(_("FM Radio"), _("Invalid JSON file format."));
                   }
                }
            } catch (e) {
                global.logError("FM Radio: Error importing stations - " + e);
                this._showNotification(_("FM Radio"), _("Error reading the backup file."));
            }
        });
    }

    _bindKeyBindings() {
        Main.keybindingManager.removeHotKey("fm-play-" + this.instance_id);

        if (this.key_play_pause) {
            Main.keybindingManager.addHotKey("fm-play-" + this.instance_id, this.key_play_pause, () => {
                this.on_applet_middle_clicked();
            });
        }
    }

    // === MENU ===
    _buildMenu() {
        this.volumeMenuItem = new PopupMenu.PopupSliderMenuItem(this.player.getVolume());
        
        let volumeIcon = new St.Icon({ 
            icon_name: 'audio-volume-medium-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 16, 
            style_class: 'popup-menu-icon'
        });
  
        this.volumeMenuItem.removeActor(this.volumeMenuItem._slider);
        
        this.volumeMenuItem.addActor(volumeIcon, { span: 0 });
        this.volumeMenuItem.addActor(this.volumeMenuItem._slider, { span: -1, expand: true });

        const updateIcon = (v) => {
            let state = v === 0 ? 'muted' : v < 0.33 ? 'low' : v < 0.66 ? 'medium' : 'high';
            volumeIcon.set_icon_name(`audio-volume-${state}-symbolic`);
        };

        updateIcon(this.player.getVolume());
        
        this.volumeMenuItem.connect('value-changed', (menuItem, value) => {
            this.player.setVolume(value);
            Data.save(this.player.getChannel(), value);
            updateIcon(value);
        });

        this.menu.addMenuItem(this.volumeMenuItem);

        let controlMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: true, hover: false, activate: false });
        this.controlBox = Radio.ControlButtons(this.player, this);

        let centerBox = new St.BoxLayout({ 
            x_expand: true, 
            x_align: Clutter.ActorAlign.CENTER,
            width: 210,
        });

        centerBox.add_child(this.controlBox);
        controlMenuItem.addActor(centerBox, { expand: true, span: -1 });
        this.menu.addMenuItem(controlMenuItem);

        this.statusMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: true, hover: false, activate: false });
        this.box = new St.BoxLayout({ 
            x_expand: true,
            y_expand: true,
            width: 210, 
            vertical: true 
        });

        this.artistLabel = new St.Label({
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
            style_class: 'artist-label',
        });
        this.artistLabel.clutter_text.line_wrap = true;
        this.artistLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.artistLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        this.statusLabel = new St.Label({
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
            style_class: 'title-label',
        });
        this.statusLabel.clutter_text.line_wrap = true;
        this.statusLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.statusLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        this.channelLabel = new St.Label({
            text: this.player.getChannel().getName(),
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            style_class: 'radio-label',
        });
        this.channelLabel.clutter_text.line_wrap = true;
        this.channelLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.channelLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        this.channelIcon = new St.Icon({
            gicon: this.player.getChannel().getResolvedIcon(),
            icon_size: 48, 
            x_align: Clutter.ActorAlign.CENTER, 
            style_class: 'channel-icon',
            reactive: true 
        });

        this.channelIcon.connect('button-press-event', () => {
            this._toggleRecording();
        });


        this.box.add_child(this.artistLabel);
        this.box.add_child(this.statusLabel);
        this.box.add_child(this.channelLabel); 
        this.box.add_child(this.channelIcon);
        this.statusMenuItem.addActor(this.box, { expand: true, span: -1 });

        this.menu.addMenuItem(this.statusMenuItem);

        if (!this.player.isPlaying()) {
            this.statusMenuItem.actor.hide();
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.channelsMenu = new PopupMenu.PopupSubMenuMenuItem(_("All stations"));
        this.channelsMenu.actor.width = 210;
        this.channelsMenu.menu.actor.width = 210;
        this.menu.addMenuItem(this.channelsMenu);

        this._loadChannels();

        this.player.setOnError(() => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                if (this.artistLabel) {
                    this.artistLabel.set_text("");
                }
                if (this.statusLabel) {
                    this.statusLabel.set_text(_("Reconnecting..."));
                }
                
                this.artistLabel.clutter_text.queue_relayout();
                this.statusLabel.clutter_text.queue_relayout();
                this.box.queue_relayout();
                
                this._updateTooltip();
                
                return GLib.SOURCE_REMOVE; 
            });
        });

        this.player.setOnTagChanged(() => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                let title = this.player.getTitle();
                let artist = this.player.getArtist();
                
                if (artist && artist.trim() !== "") {
                    this.artistLabel.set_text(artist);
                } else {
                    this.artistLabel.set_text("");
                }
                
                if (title && title.trim() !== "") {
                    this.statusLabel.set_text(title);
                } else {
                    let currentTag = this.player.getTag();
                    this.statusLabel.set_text(currentTag ? currentTag : _("Waiting..."));
                }
                
                this.artistLabel.clutter_text.queue_relayout();
                this.statusLabel.clutter_text.queue_relayout();
                
                this.box.queue_relayout();
                this.statusMenuItem.actor.queue_relayout();

                this._updateTooltip();

                if (this.mprisServer) this.mprisServer.updateStatus();
                
                return GLib.SOURCE_REMOVE; 
            });
        });
    }

    _loadChannels() {
        this.channelsMenu.menu.removeAll();

        Channels.getChannels().forEach((ch) => {
            let item = new Channels.ChannelBox(ch, this.player, this);
            this.channelsMenu.menu.addMenuItem(item);
        });
    }

    channelChanged() {
        if (this.isRecording) {
            this._stopRecording();
        }

        this.setPlayingState(this.player.isPlaying());
        Data.save(this.player.getChannel(), this.player.getVolume());

        if (this.channelLabel) {
            let currentChannel = this.player.getChannel();
            if (currentChannel) {
                this.channelLabel.set_text("" + currentChannel.getName());
                
                if (this.channelIcon) {
                    this.channelIcon.set_gicon(currentChannel.getResolvedIcon());
                }
            }
        }

        if (this.artistLabel) {
            this.artistLabel.set_text("");
        }

        if (this.statusLabel) {
            this.statusLabel.set_text(_("Waiting..."));
        }

        this._updateTooltip();
    }

    // === RECORDING ===
    _toggleRecording() {
        if (!this.player || !this.player.isPlaying()) {
            this._showNotification(_("FM Radio"), _("Please start a radio station first to record it."));
            return;
        }

        if (this.isRecording) {
            this._stopRecording();
        } else {
            this._startRecording();
        }
    }

    _startRecording() {
        let recordDir = "";

        // If a custom folder is set in the settings
        if (this.recording_folder && this.recording_folder.trim() !== "") {
            let rawFolder = this.recording_folder.trim();
            let customPath = null;

            if (rawFolder.startsWith("file://")) { 
                let gfile = Gio.File.new_for_uri(rawFolder);
                customPath = gfile.get_path();
            } else {
                customPath = rawFolder;
            }

            if (customPath) {
                recordDir = customPath + "/FM-Radio";
            }
        }

        // If no valid custom folder is set, fall back to the default Music folder
        if (!recordDir) {
            recordDir = this._getDefaultMusicDir() + "/FM-Radio";
        }
        
        // Create the directory if it does not exist
        let dir = Gio.file_new_for_path(recordDir);
        try {
            dir.make_directory_with_parents(null);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                global.logError("FM Radio: Error creating recording directory - " + e);
            }
        }

        let currentChannel = this.player.getChannel();
        let channelName = currentChannel.getName().replace(/[^a-zA-Z0-9]/g, "_");
        let streamUrl = currentChannel.getLink();
        
        // Prevent crash if the station has no valid URL
        if (!streamUrl || typeof streamUrl !== "string" || streamUrl.trim() === "") {
            this._showNotification(_("FM Radio"), _("Cannot record: This station has no valid URL."));
            return;
        }
        
        let timestamp = GLib.DateTime.new_now_local().format("%Y-%m-%d_%H-%M-%S");
        let filename = `${recordDir}/${channelName}_${timestamp}.mp3`; 

        try {
            this.recordProcess = Gio.Subprocess.new(
                ['curl', '-s', '-L', '-o', filename, streamUrl],
                Gio.SubprocessFlags.NONE
            ); 
            
            this.isRecording = true;

            if (this.show_recording_notifications) {
                this._showNotification(_("FM Radio"), _("Recording started: ") + currentChannel.getName());
            }

            this.channelIcon.add_style_class_name('channel-icon-recording');

            if (this._applet_icon) {
                this._applet_icon.style = "color: #ff4444;"; 
            }
            
            let showRecordIcon = true;
            
            // Blinks the main panel icon
            this.blinkTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
                if (showRecordIcon) {
                    this.set_applet_icon_symbolic_name('media-record'); 
                } else {
                    this.set_applet_icon_symbolic_path(this.extPath + "/icon/radio-symbolic.svg");
                }
                showRecordIcon = !showRecordIcon;
                return GLib.SOURCE_CONTINUE;
            });
            
            this.set_applet_icon_symbolic_name('media-record');

        } catch (e) {
            global.logError("FM Radio: Error while recording - " + e);
            this._showNotification(_("FM Radio"), _("Error starting recording."));
        }
    }

    _stopRecording() {
        if (this.recordProcess) {
            this.recordProcess.force_exit();
            this.recordProcess = null;
        }
        
        if (this.blinkTimerId) {
            GLib.source_remove(this.blinkTimerId);
            this.blinkTimerId = null;
        }

        if (this._applet_icon) {
            this._applet_icon.style = ""; // Remove red color
        }

        this.isRecording = false; // Important: set back to false before updating the state
        
        if (this.player) {
            this.setPlayingState(this.player.isPlaying());
        }

        if (this.show_recording_notifications) {
            this._showNotification(_("FM Radio"), _("Recording finished and saved to the /FM-Radio folder."));
        }
        
        this.channelIcon.remove_style_class_name('channel-icon-recording');
    }

    _updateTooltip() {
        if (this.player && this.player.isPlaying()) {
            let stationName = this.player.getChannel() ? this.player.getChannel().getName() : "";
            
            let artist = (this.player.getArtist && this.player.getArtist() !== "") ? this.player.getArtist() : "";
            let title = (this.player.getTitle && this.player.getTitle() !== "") ? this.player.getTitle() : this.player.getTag();
            
            let tooltipText = stationName;
            if (artist || title) {
                let separator = (artist && title) ? " - " : "";
                tooltipText += "\n" + artist + separator + (title ? title : "");
            }
            
            this.set_applet_tooltip(tooltipText);
        } else {
            this.set_applet_tooltip(_("FM Radio"));
        }

        if (this._applet_tooltip && this._applet_tooltip._tooltip) {
            let tooltipLabel = this._applet_tooltip._tooltip;
            
            tooltipLabel.clutter_text.line_wrap = true;
            tooltipLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
            
            tooltipLabel.style = "max-width: 250px; text-align: center;";
        }
    }

    setPlayingState(isPlaying) {
        if (!isPlaying && this.isRecording) {
            this._stopRecording();
        }

        if (!this.isRecording) {
            let iconFile = isPlaying ? "/icon/radio-symbolic.svg" : "/icon/radio-off-symbolic.svg";
            this.set_applet_icon_symbolic_path(this.extPath + iconFile);
        }

        if (this.statusMenuItem) {
            if (isPlaying) {
                this.statusMenuItem.actor.show();
            } else {
                this.statusMenuItem.actor.hide();
            }
        }

        if (this.playStopIcon) {
            this.playStopIcon.set_icon_name(
                isPlaying ? "media-playback-stop-symbolic" : "media-playback-start-symbolic"
            );
        }

        this._updateTooltip();

        if (isPlaying) {
            if (!this.mprisServer) {
                this.mprisServer = new Mpris.MprisServer(this);
            }
            this.mprisServer.updateStatus();
        } else {
            if (this.mprisServer) {
                this.mprisServer.destroy();
                this.mprisServer = null;
            }
        }
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    // START/STOP (Middle click)
    on_applet_middle_clicked(event) {
        if (this.player) {
            if (this.player.isPlaying()) {
                this.player.stop();
                this.setPlayingState(false);
            } else {
                this.player.play();
                this.setPlayingState(true);
            }
        }
    }

// === MONKEY-PATCHING (watchdog) ===
// Hijack Cinnamon's sound applet to prevent it from
//registering our MPRIS player and avoid duplicate controls
    _startHijackTimer() {
        if (this._hijackTimerId) return;
        
        this._hijackTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this._hijackSoundApplet();
            return GLib.SOURCE_CONTINUE; 
        });
        
        this._hijackSoundApplet();
    }

    _hijackSoundApplet() {
        if (!this._hackedSoundApplets) {
            this._hackedSoundApplets = [];
        }
        
        if (!Main.panelManager) return;
        
        let panels = (typeof Main.panelManager.getPanels === 'function') 
            ? Main.panelManager.getPanels() 
            : Main.panelManager.panels;
            
        if (!panels) return;
        
        for (let i = 0; i < panels.length; i++) {
            let panel = panels[i];
            if (!panel) continue; 
            
            let boxes = [panel._leftBox, panel._centerBox, panel._rightBox];
            for (let j = 0; j < boxes.length; j++) {
                let box = boxes[j];
                if (!box) continue;
                
                let children = box.get_children();
                for (let k = 0; k < children.length; k++) {
                    let actor = children[k];
                    if (!actor || !actor._applet) continue;
                    
                    let soundApplet = actor._applet;
                    let uuid = soundApplet._uuid || (soundApplet.metadata ? soundApplet.metadata.uuid : "");
                    
                    if (uuid === "sound@cinnamon.org" || uuid === "sound150@claudiux") {
                        
                        if (!soundApplet._original_addPlayer_fmradio && typeof soundApplet._addPlayer === 'function') {
                            
                            soundApplet._original_addPlayer_fmradio = soundApplet._addPlayer;
                            
                            soundApplet._addPlayer = function(arg1, arg2) {
                                let targetBusName = "";
                                
                                // Cinnamon <= 6.6 or sound150 (arg1 is a string)
                                if (typeof arg1 === 'string') {
                                    targetBusName = arg1;
                                } 
                                // Cinnamon >= 6.7 (arg1 is an mprisPlayer object)
                                else if (arg1 && typeof arg1.getBusName === 'function') {
                                    targetBusName = arg1.getBusName();
                                }

                                if (targetBusName === "org.mpris.MediaPlayer2.fmradio") {
                                    return;
                                }
                                
                                this._original_addPlayer_fmradio(arg1, arg2);
                            };
                            
                            if (!this._hackedSoundApplets.includes(soundApplet)) {
                                this._hackedSoundApplets.push(soundApplet);
                            }
                            
                            // Force cleanup if the Sound applet had time to display before us
                            if (soundApplet._players) {
                                for (let owner in soundApplet._players) {
                                    if (soundApplet._players[owner] && soundApplet._players[owner]._busName === "org.mpris.MediaPlayer2.fmradio") {
                                        soundApplet._removePlayer("org.mpris.MediaPlayer2.fmradio", owner);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    _releaseSoundApplet() {
        if (this._hackedSoundApplets) {
            for (let i = 0; i < this._hackedSoundApplets.length; i++) {
                let soundApplet = this._hackedSoundApplets[i];
                if (soundApplet && soundApplet._original_addPlayer_fmradio) {
                    soundApplet._addPlayer = soundApplet._original_addPlayer_fmradio;
                    delete soundApplet._original_addPlayer_fmradio;
                }
            }
            this._hackedSoundApplets = [];
        }
    }

    on_applet_removed_from_panel() {
        if (this.player) {
            this.player.destroy();
        }

        if (this.isRecording) {
            this._stopRecording();
        }

        if (this.mprisServer) {
            this.mprisServer.destroy();
        }

        // stop watchdog
        if (this._hijackTimerId) {
            GLib.source_remove(this._hijackTimerId);
            this._hijackTimerId = null;
        }

        this._releaseSoundApplet();
        Main.keybindingManager.removeHotKey("fm-play-" + this.instance_id);
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new FMRadioApplet(metadata, orientation, panel_height, instance_id);
}
