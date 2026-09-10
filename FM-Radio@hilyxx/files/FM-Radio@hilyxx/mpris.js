const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const MPRIS_XML = `
<node>
    <interface name="org.mpris.MediaPlayer2">
        <property name="CanQuit" type="b" access="read"/>
        <property name="CanRaise" type="b" access="read"/>
        <property name="HasTrackList" type="b" access="read"/>
        <property name="Identity" type="s" access="read"/>
        <property name="DesktopEntry" type="s" access="read"/>
    </interface>
    <interface name="org.mpris.MediaPlayer2.Player">
        <method name="Next"/>
        <method name="Previous"/>
        <method name="Pause"/>
        <method name="PlayPause"/>
        <method name="Stop"/>
        <method name="Play"/>
        <property name="PlaybackStatus" type="s" access="read"/>
        <property name="Metadata" type="a{sv}" access="read"/>
        <property name="CanGoNext" type="b" access="read"/>
        <property name="CanGoPrevious" type="b" access="read"/>
        <property name="CanPlay" type="b" access="read"/>
        <property name="CanPause" type="b" access="read"/>
        <property name="CanControl" type="b" access="read"/>
    </interface>
</node>`;

var MprisServer = class MprisServer {
    constructor(applet) {
        this.applet = applet;
        this.nodeInfo = Gio.DBusNodeInfo.new_for_xml(MPRIS_XML);
        this.connection = null;

        this.busNameId = Gio.bus_own_name(
            Gio.BusType.SESSION,
            'org.mpris.MediaPlayer2.fmradio',
            Gio.BusNameOwnerFlags.NONE,
            (connection, name) => {
                this.connection = connection;
                this._registerObject(connection);
            },
            null, null
        );
    }

    _registerObject(connection) {
        try {
            this.objectId1 = connection.register_object(
                '/org/mpris/MediaPlayer2',
                this.nodeInfo.lookup_interface('org.mpris.MediaPlayer2'),
                null, this._handleGetProperty.bind(this), null
            );
            this.objectId2 = connection.register_object(
                '/org/mpris/MediaPlayer2',
                this.nodeInfo.lookup_interface('org.mpris.MediaPlayer2.Player'),
                this._handleMethodCall.bind(this),
                this._handleGetProperty.bind(this), null
            );
        } catch (e) {
            global.logError("[FM Radio] Erreur MPRIS Init : " + e);
        }
    }

    _handleMethodCall(connection, sender, objectPath, interfaceName, methodName, parameters, invocation) {
        try {
            if (methodName === 'PlayPause' || methodName === 'Pause' || methodName === 'Play') {
                this.applet.on_applet_middle_clicked();
            } else if (methodName === 'Stop') {
                if (this.applet.player && this.applet.player.isPlaying()) {
                    this.applet.player.stop();
                    this.applet.setPlayingState(false);
                }
            } else if (methodName === 'Next') {
                if (this.applet.player) {
                    this.applet.player.stop();
                    this.applet.player.next();
                    this.applet.player.play();
                    this.applet.channelChanged();
                }
            } else if (methodName === 'Previous') {
                if (this.applet.player) {
                    this.applet.player.stop();
                    this.applet.player.prev();
                    this.applet.player.play();
                    this.applet.channelChanged();
                }
            }
            invocation.return_value(null);
        } catch (e) {}
    }

    _handleGetProperty(connection, sender, objectPath, interfaceName, propertyName) {
        try {
            if (interfaceName === 'org.mpris.MediaPlayer2') {
                switch (propertyName) {
                    case 'CanQuit': return GLib.Variant.new_boolean(false);
                    case 'CanRaise': return GLib.Variant.new_boolean(false);
                    case 'HasTrackList': return GLib.Variant.new_boolean(false);
                    case 'Identity': return GLib.Variant.new_string('FM Radio');
                    case 'DesktopEntry': return GLib.Variant.new_string('cinnamon-settings-applets');
                }
            } else if (interfaceName === 'org.mpris.MediaPlayer2.Player') {
                let isPlaying = this.applet.player && this.applet.player.isPlaying();
                switch (propertyName) {
                    case 'PlaybackStatus': 
                        return GLib.Variant.new_string(isPlaying ? 'Playing' : 'Stopped');
                    case 'CanGoNext': return GLib.Variant.new_boolean(true);
                    case 'CanGoPrevious': return GLib.Variant.new_boolean(true);
                    case 'CanPlay': return GLib.Variant.new_boolean(true);
                    case 'CanPause': return GLib.Variant.new_boolean(true);
                    case 'CanControl': return GLib.Variant.new_boolean(true);
                    case 'Metadata': 
                        let title = this.applet.player ? this.applet.player.getTitle() : '';
                        let artist = this.applet.player ? this.applet.player.getArtist() : '';
                        let station = (this.applet.player && this.applet.player.getChannel()) ? this.applet.player.getChannel().getName() : 'FM Radio';
                        
                        let meta = {
                            'mpris:trackid': GLib.Variant.new_string('/org/mpris/MediaPlayer2/TrackList/NoTrack'),
                            'xesam:title': GLib.Variant.new_string(title || station),
                            'xesam:artist': GLib.Variant.new_strv([artist || ''])
                        };
                        return GLib.Variant.new('a{sv}', meta);
                }
            }
        } catch (e) {}
        return null;
    }

    updateStatus() {
        if (!this.connection) return;
        try {
            let isPlaying = this.applet.player && this.applet.player.isPlaying();
            let props = {
                'PlaybackStatus': GLib.Variant.new_string(isPlaying ? 'Playing' : 'Stopped')
            };
            
            let title = this.applet.player ? this.applet.player.getTitle() : '';
            let artist = this.applet.player ? this.applet.player.getArtist() : '';
            let station = (this.applet.player && this.applet.player.getChannel()) ? this.applet.player.getChannel().getName() : 'FM Radio';
            
            let meta = {
                'mpris:trackid': GLib.Variant.new_string('/org/mpris/MediaPlayer2/TrackList/NoTrack'),
                'xesam:title': GLib.Variant.new_string(title || station),
                'xesam:artist': GLib.Variant.new_strv([artist || ''])
            };
            props['Metadata'] = GLib.Variant.new('a{sv}', meta);

            this.connection.emit_signal(
                null,
                '/org/mpris/MediaPlayer2',
                'org.freedesktop.DBus.Properties',
                'PropertiesChanged',
                GLib.Variant.new('(sa{sv}as)', ['org.mpris.MediaPlayer2.Player', props, []])
            );
        } catch (e) {}
    }

    destroy() {
        if (this.connection) {
            if (this.objectId1) {
                this.connection.unregister_object(this.objectId1);
                this.objectId1 = 0;
            }
            if (this.objectId2) {
                this.connection.unregister_object(this.objectId2);
                this.objectId2 = 0;
            }
            this.connection = null;
        }

        if (this.busNameId) {
            Gio.bus_unown_name(this.busNameId);
            this.busNameId = 0;
        }
    }
};
