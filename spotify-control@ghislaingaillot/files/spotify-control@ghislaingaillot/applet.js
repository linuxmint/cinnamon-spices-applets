const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Util = imports.misc.util;
const Interfaces = imports.misc.interfaces;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Tooltips = imports.ui.tooltips;
const { SpotifyFavorites } = require('./spotifyAuth');

const SPOTIFY_BUS_NAME = "org.mpris.MediaPlayer2.spotify";
const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const PLAYER_IFACE = "org.mpris.MediaPlayer2.Player";
const SPOTIFY_BIN = "/usr/bin/spotify";
const COVER_SIZE = 64;

// A PanelItemTooltip whose content is a cover art thumbnail plus a
// title/artist label, instead of a single line of text.
class TrackTooltip extends Tooltips.PanelItemTooltip {
    _init(panelItem, initTitle, orientation) {
        super._init(panelItem, initTitle, orientation);

        this._tooltip.destroy();

        this._tooltip = new St.BoxLayout({
            name: 'Tooltip',
            style_class: 'spotify-tooltip'
        });
        this._tooltip.show_on_set_parent = false;
        Main.uiGroup.add_actor(this._tooltip);

        this._art = new St.Icon({
            icon_name: 'media-optical',
            icon_type: St.IconType.FULLCOLOR,
            icon_size: COVER_SIZE,
            style_class: 'spotify-tooltip-art'
        });

        this._textBox = new St.BoxLayout({ vertical: true, style_class: 'spotify-tooltip-text' });
        this._titleLabel = new St.Label({ style_class: 'spotify-tooltip-title' });
        this._artistLabel = new St.Label({ style_class: 'spotify-tooltip-artist' });
        this._textBox.add_actor(this._titleLabel);
        this._textBox.add_actor(this._artistLabel);

        this._tooltip.add_actor(this._art);
        this._tooltip.add_actor(this._textBox);

        this._hasContent = false;
    }

    setTrackInfo(title, artist) {
        this._titleLabel.set_text(title || "");
        this._artistLabel.set_text(artist || "");
        this._hasContent = !!(title || artist);
        this._tooltip.queue_relayout();
    }

    setArt(actor) {
        this._tooltip.remove_actor(this._art);
        this._art.destroy();
        this._art = actor;
        if (this._art.add_style_class_name)
            this._art.add_style_class_name('spotify-tooltip-art');
        this._tooltip.insert_child_at_index(this._art, 0);
        this._tooltip.queue_relayout();
    }

    setDefaultArt() {
        this.setArt(new St.Icon({
            icon_name: 'media-optical',
            icon_type: St.IconType.FULLCOLOR,
            icon_size: COVER_SIZE
        }));
    }

    show() {
        if (!this._hasContent || global.menuStack.length > 0 || !this.mousePosition)
            return;

        let op = this._tooltip.get_opacity();
        this._tooltip.set_opacity(0);
        this._tooltip.show();

        const { PanelLoc } = imports.ui.panel;
        let monitor = Main.layoutManager.findMonitorForActor(this._panelItem.actor);
        let [minW, minH, tooltipWidth, tooltipHeight] = this._tooltip.get_preferred_size();
        let tooltipTop = 0;
        let tooltipLeft = 0;
        let panel = null;

        switch (this.orientation) {
            case St.Side.BOTTOM:
                panel = Main.panelManager.getPanel(monitor.index, PanelLoc.bottom);
                tooltipTop = monitor.y + monitor.height - tooltipHeight - panel.actor.height;
                tooltipLeft = this.mousePosition[0] - Math.round(tooltipWidth / 2);
                tooltipLeft = Math.max(tooltipLeft, monitor.x);
                tooltipLeft = Math.min(tooltipLeft, monitor.x + monitor.width - tooltipWidth);
                break;
            case St.Side.TOP:
                panel = Main.panelManager.getPanel(monitor.index, PanelLoc.top);
                tooltipTop = monitor.y + panel.actor.height;
                tooltipLeft = this.mousePosition[0] - Math.round(tooltipWidth / 2);
                tooltipLeft = Math.max(tooltipLeft, monitor.x);
                tooltipLeft = Math.min(tooltipLeft, monitor.x + monitor.width - tooltipWidth);
                break;
            case St.Side.LEFT:
                panel = Main.panelManager.getPanel(monitor.index, PanelLoc.left);
                tooltipTop = this._panelItem.actor.get_transformed_position()[1];
                tooltipTop += Math.round((this._panelItem.actor.height - tooltipHeight) / 2);
                if (tooltipTop < monitor.y)
                    tooltipTop = monitor.y;
                else if (tooltipTop + tooltipHeight > monitor.y + monitor.height)
                    tooltipTop = monitor.y + monitor.height - tooltipHeight;
                tooltipLeft = monitor.x + panel.actor.width;
                break;
            case St.Side.RIGHT:
                panel = Main.panelManager.getPanel(monitor.index, PanelLoc.right);
                tooltipTop = this._panelItem.actor.get_transformed_position()[1];
                tooltipTop += Math.round((this._panelItem.actor.height - tooltipHeight) / 2);
                if (tooltipTop < monitor.y)
                    tooltipTop = monitor.y;
                else if (tooltipTop + tooltipHeight > monitor.y + monitor.height)
                    tooltipTop = monitor.y + monitor.height - tooltipHeight;
                tooltipLeft = monitor.x + monitor.width - tooltipWidth - panel.actor.width;
                break;
            default:
                break;
        }

        this._tooltip.set_position(tooltipLeft, tooltipTop);
        this._tooltip.set_opacity(op);
        this.visible = true;
    }
}

class SpotifyControlApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.actor.add_style_class_name('spotify-control-applet');

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "enable-favorites", "favoritesEnabled", () => this._updateStarVisibility(), null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "client-id", "spotifyClientId", null, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "refresh-token", "spotifyRefreshToken", null, null);

        this._favorites = new SpotifyFavorites(this);

        this._playerProxy = null;
        this._propsProxy = null;
        this._propsChangedId = 0;
        this._available = false;
        this._status = "";
        this._title = "";
        this._artist = "";
        this._currentTrackUri = null;
        this._liked = false;
        this._lastArtUrl = null;
        this._coverTmpFile = null;
        this._coverLoadToken = 0;

        this._prevButton = this._makeIconButton('xsi-media-skip-backward', () => this._onPrevious());
        this._playPauseButton = this._makeIconButton('xsi-media-playback-start', () => this._onPlayPause());
        this._nextButton = this._makeIconButton('xsi-media-skip-forward', () => this._onNext());
        this._starButton = this._makeIconButton('xsi-non-starred', () => this._onFavoriteClicked());
        this._starButton.visible = false;

        this.actor.add_actor(this._prevButton);
        this.actor.add_actor(this._playPauseButton);
        this.actor.add_actor(this._nextButton);
        this.actor.add_actor(this._starButton);

        // Custom applet tooltip (album art + title/artist) instead of the
        // default plain-text one.
        this._applet_tooltip.destroy();
        this._applet_tooltip = new TrackTooltip(this, "", orientation);

        this._applet_context_menu.addAction(_("Open Spotify"), () => this._launchSpotify());

        this._setAvailable(false);

        this._watcherId = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            SPOTIFY_BUS_NAME,
            Gio.BusNameWatcherFlags.NONE,
            () => this._onNameAppeared(),
            () => this._onNameVanished()
        );
    }

    _makeIconButton(iconName, callback) {
        let button = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            style_class: 'spotify-control-button'
        });
        let icon = new St.Icon({
            icon_name: iconName,
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 14
        });
        button.set_child(icon);
        button.connect('clicked', callback);
        button._icon = icon;
        return button;
    }

    _onNameAppeared() {
        this._playerProxy = Interfaces.getDBusProxyWithOwner(PLAYER_IFACE, SPOTIFY_BUS_NAME);
        this._propsProxy = Interfaces.getDBusProperties(SPOTIFY_BUS_NAME, MEDIA_PLAYER_2_PATH);

        this._propsChangedId = this._propsProxy.connectSignal('PropertiesChanged',
            (proxy, sender, [iface, changedProps]) => {
                if (iface !== PLAYER_IFACE)
                    return;
                if (changedProps.PlaybackStatus)
                    this._setStatus(changedProps.PlaybackStatus.unpack());
                if (changedProps.Metadata)
                    this._setMetadata(changedProps.Metadata.deep_unpack());
            });

        this._setAvailable(true);

        this._propsProxy.GetAllRemote(PLAYER_IFACE, (result, error) => {
            if (error || !result)
                return;
            let props = result[0];
            if (props.PlaybackStatus)
                this._setStatus(props.PlaybackStatus.unpack());
            if (props.Metadata)
                this._setMetadata(props.Metadata.deep_unpack());
        });
    }

    _onNameVanished() {
        if (this._propsProxy && this._propsChangedId)
            this._propsProxy.disconnectSignal(this._propsChangedId);

        this._playerProxy = null;
        this._propsProxy = null;
        this._propsChangedId = 0;
        this._status = "";
        this._title = "";
        this._artist = "";
        this._currentTrackUri = null;
        this._lastArtUrl = null;

        this._setAvailable(false);
    }

    _setStatus(status) {
        this._status = status;
        let playing = status === "Playing";
        this._playPauseButton._icon.icon_name = playing ?
            'xsi-media-playback-pause' : 'xsi-media-playback-start';
    }

    _setMetadata(metadata) {
        if (!metadata)
            return;

        let title = "";
        if (metadata["xesam:title"])
            title = metadata["xesam:title"].unpack();

        let artist = "";
        if (metadata["xesam:artist"]) {
            let value = metadata["xesam:artist"];
            switch (value.get_type_string()) {
                case 's':
                    artist = value.unpack();
                    break;
                case 'as':
                    artist = value.deep_unpack().join(", ");
                    break;
            }
        }

        let artUrl = metadata["mpris:artUrl"] ? metadata["mpris:artUrl"].unpack() : null;
        let trackUri = metadata["mpris:trackid"] ? metadata["mpris:trackid"].unpack() : null;

        this._title = title;
        this._artist = artist;
        this._updateTooltip();
        this._updateCoverArt(artUrl);

        if (trackUri !== this._currentTrackUri) {
            this._currentTrackUri = trackUri;
            this._onTrackChanged(trackUri);
        }
    }

    _onTrackChanged(trackUri) {
        this._setLikedState(false);

        let isTrack = this._isSpotifyTrackUri(trackUri);
        this._updateStarVisibility();

        if (isTrack && this._favorites.isConnected()) {
            let trackId = this._trackIdFromUri(trackUri);
            this._favorites.checkLiked(trackId, (liked) => {
                if (trackUri !== this._currentTrackUri || liked === null)
                    return;
                this._setLikedState(liked);
            });
        }
    }

    _updateStarVisibility() {
        this._starButton.visible = this._available && this.favoritesEnabled &&
            this._isSpotifyTrackUri(this._currentTrackUri);
    }

    _isSpotifyTrackUri(uri) {
        return !!uri && uri.indexOf('/track/') !== -1;
    }

    _trackIdFromUri(uri) {
        return uri.split('/').pop();
    }

    _updateTooltip() {
        if (!this._available) {
            this._applet_tooltip.setTrackInfo(_("Spotify (click to launch)"), "");
            return;
        }

        if (this._title)
            this._applet_tooltip.setTrackInfo(this._title, this._artist);
        else
            this._applet_tooltip.setTrackInfo(_("Spotify"), "");
    }

    _updateCoverArt(artUrl) {
        if (this._lastArtUrl === artUrl)
            return;
        this._lastArtUrl = artUrl;
        this._coverLoadToken++;
        let token = this._coverLoadToken;

        if (!artUrl) {
            this._applet_tooltip.setDefaultArt();
            return;
        }

        if (artUrl.match(/^https?:/)) {
            if (!this._coverTmpFile)
                this._coverTmpFile = Gio.file_new_tmp('XXXXXX.spotify-cover')[0];
            let path = this._coverTmpFile.get_path();
            Util.spawn_async(['wget', '-q', artUrl, '-O', path], () => {
                if (token === this._coverLoadToken)
                    this._loadCoverFromFile(path, token);
            });
        } else {
            let path = decodeURIComponent(artUrl.replace(/^file:\/\//, ""));
            this._loadCoverFromFile(path, token);
        }
    }

    _loadCoverFromFile(path, token) {
        if (!path || !GLib.file_test(path, GLib.FileTest.EXISTS)) {
            if (token === this._coverLoadToken)
                this._applet_tooltip.setDefaultArt();
            return;
        }
        St.TextureCache.get_default().load_image_from_file_async(path, COVER_SIZE, COVER_SIZE,
            (cache, handle, actor) => {
                if (token === this._coverLoadToken)
                    this._applet_tooltip.setArt(actor);
            });
    }

    _setLikedState(liked) {
        this._liked = liked;
        this._starButton._icon.icon_name = liked ? 'xsi-starred' : 'xsi-non-starred';
        if (liked)
            this._starButton._icon.add_style_class_name('spotify-star-active');
        else
            this._starButton._icon.remove_style_class_name('spotify-star-active');
    }

    _onFavoriteClicked() {
        if (!this._available || !this.favoritesEnabled || !this._isSpotifyTrackUri(this._currentTrackUri))
            return;

        if (!this._favorites.isConfigured()) {
            Main.notify(_("Spotify"), _("Set a Client ID first (right-click → Configure)."));
            return;
        }
        if (!this._favorites.isConnected()) {
            Main.notify(_("Spotify"), _("Connect your account first (right-click → Configure)."));
            return;
        }

        let trackUri = this._currentTrackUri;
        let trackId = this._trackIdFromUri(trackUri);
        let newLiked = !this._liked;

        this._starButton.reactive = false;
        this._favorites.setLiked(trackId, newLiked, (ok) => {
            this._starButton.reactive = true;
            if (trackUri !== this._currentTrackUri)
                return;
            if (ok) {
                this._setLikedState(newLiked);
                Main.notify(_("Spotify"), newLiked ?
                    _("Added to Liked Songs") : _("Removed from Liked Songs"));
            } else {
                Main.notify(_("Spotify"), _("Could not update favorites."));
            }
        });
    }

    onConnectClicked() {
        if (!this._favorites.isConfigured()) {
            Main.notify(_("Spotify"), _("Set a Client ID first."));
            return;
        }

        Main.notify(_("Spotify"), _("Opening your browser to authorize the application…"));
        this._favorites.startAuth((ok, err) => {
            if (ok) {
                Main.notify(_("Spotify"), _("Account connected."));
                if (this._isSpotifyTrackUri(this._currentTrackUri)) {
                    let trackUri = this._currentTrackUri;
                    this._favorites.checkLiked(this._trackIdFromUri(trackUri), (liked) => {
                        if (trackUri === this._currentTrackUri && liked !== null)
                            this._setLikedState(liked);
                    });
                }
            } else {
                Main.notify(_("Spotify"), _("Connection failed: %s").format(err));
            }
        });
    }

    onDisconnectClicked() {
        this._favorites.disconnect();
        this._setLikedState(false);
        Main.notify(_("Spotify"), _("Account disconnected."));
    }

    _setAvailable(available) {
        this._available = available;
        let opacity = available ? 255 : 110;
        this._prevButton._icon.opacity = opacity;
        this._playPauseButton._icon.opacity = opacity;
        this._nextButton._icon.opacity = opacity;
        if (!available)
            this._playPauseButton._icon.icon_name = 'xsi-media-playback-start';
        this._updateStarVisibility();
        this._updateTooltip();
    }

    _launchSpotify() {
        Util.spawn([SPOTIFY_BIN]);
    }

    _onPrevious() {
        if (this._available && this._playerProxy)
            this._playerProxy.PreviousRemote();
        else
            this._launchSpotify();
    }

    _onPlayPause() {
        if (this._available && this._playerProxy)
            this._playerProxy.PlayPauseRemote();
        else
            this._launchSpotify();
    }

    _onNext() {
        if (this._available && this._playerProxy)
            this._playerProxy.NextRemote();
        else
            this._launchSpotify();
    }

    on_applet_removed_from_panel() {
        if (this._watcherId) {
            Gio.bus_unwatch_name(this._watcherId);
            this._watcherId = 0;
        }
        this._onNameVanished();
        this._favorites.cancelAuth();

        // Invalidate any in-flight cover art download/decode so its
        // callback becomes a no-op if it resolves after removal.
        this._coverLoadToken++;

        if (this._coverTmpFile) {
            try {
                this._coverTmpFile.delete(null);
            } catch (e) {
                // ignore
            }
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new SpotifyControlApplet(metadata, orientation, panel_height, instance_id);
}
