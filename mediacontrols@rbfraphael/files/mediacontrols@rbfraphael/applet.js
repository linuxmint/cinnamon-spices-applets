const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Interfaces = imports.misc.interfaces;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";

class MediaPlayer {
    constructor(name, updateCallback = () => { }) {
        this.name = name;

        this.mediaServer = null;
        this.mediaServerPlayer = null;
        this.prop = null;
        this.propChangeId = null;

        this.isPlaying = false;
        this.songArtist = "";
        this.songTitle = "";
        this.appIcon = "multimedia-audio-player-symbolic";

        this.menuItem = new PopupMenu.PopupMenuItem(this.name);

        this.updateCallback = updateCallback;

        this.initDBus();
    }

    initDBus() {
        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_NAME, this.name, (proxy, error) => {
            if (error) {
                global.log(error);
            } else {
                this.mediaServer = proxy;

                if (this.mediaServer.DesktopEntry) {
                    this.appIcon = this.mediaServer.DesktopEntry;
                }

                this.menuItem.setLabel(this.mediaServer.Identity);

                this.updateCallback();
            }
        });

        Interfaces.getDBusProxyWithOwnerAsync(MEDIA_PLAYER_2_PLAYER_NAME, this.name, (proxy, error) => {
            if (error) {
                global.log(error);
            } else {
                this.mediaServerPlayer = proxy;
                this.setMetadata(this.mediaServerPlayer.Metadata);
                this.setStatus(this.mediaServerPlayer.PlaybackStatus);

                this.updateCallback();
            }
        });

        Interfaces.getDBusPropertiesAsync(this.name, MEDIA_PLAYER_2_PATH, (proxy, error) => {
            if (error) {
                global.log(error);
            } else {
                this.prop = proxy;

                this.propChangeId = this.prop.connectSignal('PropertiesChanged', (proxy, sender, [iface, props]) => {
                    if (props.PlaybackStatus) {
                        this.setStatus(props.PlaybackStatus.unpack());
                    }

                    if (props.Metadata) {
                        this.setMetadata(props.Metadata.deep_unpack());
                    }

                    this.updateCallback();
                });
            }
        });
    }

    setStatus(status) {
        if (!status) { return; }
        this.isPlaying = status == "Playing";
    }

    setMetadata(metadata) {
        if (!metadata) { return; }

        if (metadata['mpris:artUrl']) {
            // Capa do álbum
            let artUrl = metadata['mpris:artUrl'].unpack();
        }

        this.songArtist = "";
        if (metadata['xesam:artist']) {
            switch (metadata["xesam:artist"].get_type_string()) {
                case 's':
                    // smplayer sends a string
                    this.songArtist = metadata["xesam:artist"].unpack();
                    break;
                case 'as':
                    // others send an array of strings
                    this.songArtist = metadata["xesam:artist"].deep_unpack().join(", ");
                    break;
            }
        }

        this.songTitle = "";
        if (metadata["xesam:title"]) {
            this.songTitle = metadata["xesam:title"].unpack();
        }
    }

    destroy() {
        if (this.prop && this.propChangeId) {
            this.prop.disconnectSignal(this.propChangeId);
            this.propChangeId = null;
        }

        this.menuItem.destroy();
    }
}

class MediaControlsApplet extends Applet.TextIconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this._appletOrientation = orientation;
        this._appletPanelHeight = panel_height;
        this._appletInstanceId = instance_id;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._players = {};
        this._activePlayer = null;
        this._ownerChangedId = null;

        this._buildUi();
        this._loadDBus();
    }

    _buildUi() {
        // Menu Icon
        this.playerIcon = new St.Icon({ icon_name: "multimedia-audio-player-symbolic", icon_size: 16, icon_type: St.IconType.SYMBOLIC, style_class: "mediacontrols_rbfraphael-element" });
        this.actor.add_child(this.playerIcon);

        // Previous Button
        this.previousButton = new St.Button({ style_class: "mediacontrols_rbfraphael-element" });
        this.previousButton.child = new St.Icon({ icon_name: "media-skip-backward-symbolic", icon_size: 16, icon_type: St.IconType.SYMBOLIC })
        this.previousButton.connect("clicked", () => this._buttonAction("previous"));
        this.actor.add_child(this.previousButton);

        // Play/Pause Button
        this.playPauseButton = new St.Button({ style_class: "mediacontrols_rbfraphael-element" });
        this.playPauseButton.child = new St.Icon({ icon_name: "media-playback-pause-symbolic", icon_size: 16, icon_type: St.IconType.SYMBOLIC })
        this.playPauseButton.connect("clicked", () => this._buttonAction("playPause"));
        this.actor.add_child(this.playPauseButton);

        // Play/Pause Button
        this.nextButton = new St.Button({ style_class: "mediacontrols_rbfraphael-element" });
        this.nextButton.child = new St.Icon({ icon_name: "media-skip-forward-symbolic", icon_size: 16, icon_type: St.IconType.SYMBOLIC })
        this.nextButton.connect("clicked", () => this._buttonAction("next"));
        this.actor.add_child(this.nextButton);

        // Media Info
        this.mediaInfo = new St.Bin({ x_align: St.Align.START, y_align: St.Align.MIDDLE, style_class: "mediacontrols_rbfraphael-element" });
        this.mediaInfo.child = new St.Label({ text: "No player selected" });
        this.actor.add_child(this.mediaInfo);

        // Menu Icon
        let menuIconName = ["pan-down-symbolic", "pan-left-symbolic", "pan-up-symbolic", "pan-right-symbolic"][this._appletOrientation];
        this.menuIcon = new St.Icon({ icon_name: menuIconName, icon_size: 16, icon_type: St.IconType.SYMBOLIC })
        this.actor.add_child(this.menuIcon);

        this._updateUi();
    }

    _buttonAction(action) {
        if (this._activePlayer) {
            let timeout = false;
            switch (action) {
                case "playPause":
                    this._activePlayer.mediaServerPlayer.PlayPauseRemote();
                    timeout = true;
                    break;
                case "next":
                    this._activePlayer.mediaServerPlayer.NextRemote();
                    timeout = true;
                    break;
                case "previous":
                    this._activePlayer.mediaServerPlayer.PreviousRemote();
                    timeout = true;
                    break;
                default:
                    break;
            }

            if (timeout) {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                    this._updateUi();
                    return GLib.SOURCE_REMOVE;
                });
            }
        }
    }

    _updateUi() {
        try {
            if (this._activePlayer) {
                this.playerIcon.icon_name = this._activePlayer.appIcon;

                if (this._activePlayer.isPlaying) {
                    this.playPauseButton.child.icon_name = "media-playback-pause-symbolic";
                } else {
                    this.playPauseButton.child.icon_name = "media-playback-start-symbolic";
                }

                let songDescription = this._activePlayer.songTitle;
                if (this._activePlayer.songArtist.length > 0) {
                    songDescription += songDescription.length > 0 ? " - " : "";
                    songDescription += this._activePlayer.songArtist;
                }

                this.mediaInfo.child.text = songDescription;
            } else {
                this.playerIcon.icon_name = "multimedia-audio-player-symbolic";
                this.playPauseButton.child.icon_name = "media-playback-start-symbolic";
                this.mediaInfo.child.text = "No player selected";
            }
        } catch (e) {
            global.logError(e);
            throw e;
        }
    }

    _loadDBus() {
        Interfaces.getDBusAsync((proxy, error) => {
            if (error) {
                global.log(error);
                throw error;
            }

            this._dbus = proxy;

            let nameRegex = /^org\.mpris\.MediaPlayer2\./;

            this._dbus.ListNamesRemote((names) => {
                for (let n in names[0]) {
                    let name = names[0][n];
                    if (nameRegex.test(name)) {
                        this._dbus.GetNameOwnerRemote(name, (owner) => {
                            this._addPlayer(name, owner[0], true);
                        });
                    }
                }
            });

            this._ownerChangedId = this._dbus.connectSignal('NameOwnerChanged',
                (proxy, sender, [name, oldOwner, newOwner]) => {
                    if (nameRegex.test(name)) {
                        if (newOwner && !oldOwner) {
                            this._addPlayer(name, newOwner, true);
                        } else if (oldOwner && !newOwner) {
                            this._removePlayer(name);
                        } else {
                            this._updatePlayerOwner(name, newOwner);
                        }
                    }
                }
            );
        });
    }

    _addPlayer(name, ownerId, switchTo = false) {
        try {
            let player = new MediaPlayer(name, () => { this._updateUi() });
            let menuItem = player.menuItem;

            menuItem.activate = () => {
                this._switchPlayer(player);
                this.menu.toggle();
            };

            this._players[name] = { player, ownerId }
            this.menu.addMenuItem(menuItem);

            if (switchTo) {
                this._switchPlayer(player);
            }
        } catch (e) {
            global.logError(e);
            throw e;
        }
    }

    _removePlayer(name) {
        try {
            if (!this._players[name]) {
                return;
            }

            let player = this._players[name].player;

            if (this._activePlayer == player) {
                let allPlayers = Object.keys(this._players);
                if (allPlayers.length > 1) {
                    let newPlayerName = allPlayers[allPlayers.length - 1];
                    this._switchPlayer(this._players[newPlayerName].player);
                } else {
                    this._switchPlayer(null);
                }
            }

            player.destroy();
            delete this._players[name];
        } catch (e) {
            global.logError(e);
            throw e;
        }
    }

    _updatePlayerOwner(name, ownerId) {
        this._players[name].ownerId = ownerId;
    }

    _switchPlayer(player) {
        try {
            Object.keys(this._players).forEach(key => {
                this._players[key].player.menuItem.setShowDot(false);
            });

            this._activePlayer = player;

            if (this._activePlayer !== null) {
                this._activePlayer.menuItem.setShowDot(true);
            }

            this._updateUi();
        } catch (e) {
            global.logError(e);
            throw e;
        }
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        Object.values(this._players).forEach((p) => {
            p.player.destroy();
        });

        if (this._dbus && this._ownerChangedId) {
            this._dbus.disconnectSignal(this._ownerChangedId);
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MediaControlsApplet(orientation, panel_height, instance_id);
}