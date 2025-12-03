const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = 'BgRadio@spacy01';
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(text) {
    return Gettext.dgettext(UUID, text);
}

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        try {
            this.set_applet_icon_symbolic_name("folder-videos-symbolic");
            this.set_applet_tooltip(_("Bulgarian Radio and TV Streams"));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);

            this.populate_menu();
        } catch (e) {
            global.logError(e);
        }
    },

    populate_menu: function() {
        //radio - dropdown menu
        this.RadioItem = new PopupMenu.PopupSubMenuMenuItem(_("Radio stations"));

        //bg radio
        var radiostation1 = _("Bg Radio");
        this.RadioItem.menu.addAction(radiostation1, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://149.13.0.81:80/bgradio.ogg &");
            Main.notify(_("Listening %s").format(radiostation1));
        });

        //btv radio
        var radiostation2 = _("bTV Radio");
        this.RadioItem.menu.addAction(radiostation2, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv https://cdn.bweb.bg/radio/btv-radio.mp3 &");
            Main.notify(_("Listening %s").format(radiostation2));
        });

        //city radio
        var radiostation3 = _("City Radio");
        this.RadioItem.menu.addAction(radiostation3, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://149.13.0.81:8000/city.ogg");
            Main.notify(_("Listening %s").format(radiostation3));
        });

        //classicfm radio
        var radiostation4 = _("Classic FM");
        this.RadioItem.menu.addAction(radiostation4, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv 	https://cdn.bweb.bg/radio/classic-fm.mp3");
            Main.notify(_("Listening %s").format(radiostation4));
        });

        //darik radio
        var radiostation5 = _("Darik");
        this.RadioItem.menu.addAction(radiostation5, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv --vid=no https://a12.asurahosting.com/listen/darik_radio/radio.mp3");
            Main.notify(_("Listening %s").format(radiostation5));
        });

        //darik nostalgie
        var radiostation6 = _("Darik Nostalgie");
        this.RadioItem.menu.addAction(radiostation6, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv https://a10.asurahosting.com:7600/radio.mp3");
            Main.notify(_("Listening %s").format(radiostation6));
        });

        //energy radio
        var radiostation7 = _("Energy");
        this.RadioItem.menu.addAction(radiostation7, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://149.13.0.80/nrj_low.ogg &");
            Main.notify(_("Listening %s").format(radiostation7));
        });

        //fmplus radio
        var radiostation8 = _("FM+");
        this.RadioItem.menu.addAction(radiostation8, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://193.108.24.21:8000/fmplus");
            Main.notify(_("Listening %s").format(radiostation8));
        });

        //fresh radio
        var radiostation9 = _("Fresh");
        this.RadioItem.menu.addAction(radiostation9, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://193.108.24.21:8000/fresh");
            Main.notify(_("Listening %s").format(radiostation9));
        });

        //jazzfm radio
        var radiostation10 = _("Jazz FM");
        this.RadioItem.menu.addAction(radiostation10, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv https://cdn.bweb.bg/radio/jazz-fm.mp3");
            Main.notify(_("Listening %s").format(radiostation10));
        });

        //melody radio
        var radiostation12 = _("Melody");
        this.RadioItem.menu.addAction(radiostation12, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://193.108.24.6:8000/melody");
            Main.notify(_("Listening %s").format(radiostation12));
        });

        //njoy radio
        var radiostation13 = _("N-Joy");
        this.RadioItem.menu.addAction(radiostation13, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv https://cdn.bweb.bg/radio/njoy.mp3");
            Main.notify(_("Listening %s").format(radiostation13));
        });

        //nova radio
        var radiostation14 = _("Nova Radio");
        this.RadioItem.menu.addAction(radiostation14, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://stream81.metacast.eu/nova.ogg");
            Main.notify(_("Listening %s").format(radiostation14));
        });

        //radio1 radio
        var radiostation15 = _("Radio 1");
        this.RadioItem.menu.addAction(radiostation15, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://149.13.0.81/radio1.ogg");
            Main.notify(_("Listening %s").format(radiostation15));
        });

        //radio1rock radio
        var radiostation16 = _("Radio 1 Rock");
        this.RadioItem.menu.addAction(radiostation16, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://149.13.0.81/radio1rock.ogg");
            Main.notify(_("Listening %s").format(radiostation16));
        });

        //thevoice radio
        var radiostation17 = _("The Voice Radio");
        this.RadioItem.menu.addAction(radiostation17, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv https://nova-radio.neterra.tv/thevoice");
            Main.notify(_("Listening %s").format(radiostation17));
        });

        //zrock radio
        var radiostation18 = _("Z-Rock");
        this.RadioItem.menu.addAction(radiostation18, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv https://cdn.bweb.bg/radio/z-rock.mp3");
            Main.notify(_("Listening %s").format(radiostation18));
        });

        //end radio drop down menu               
        this.menu.addMenuItem(this.RadioItem);


        //tv - dropdown menu
        this.TvItem = new PopupMenu.PopupSubMenuMenuItem(_("TV stations"));

        //city
        var tvstation7 = _("City");
        this.TvItem.menu.addAction(tvstation7, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='City' https://tv.city.bg/play/tshls/citytv/3.m3u8");
            Main.notify(_("Watching %s").format(tvstation7));
        });

        //kanal3
        var tvstation8 = _("Kanal 3");
        this.TvItem.menu.addAction(tvstation8, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='Kanal 3' 'https://cdn2.invivo.bg/k3artfrwbsitfrnglpvlv/tracks-v1/index.fmp4.m3u8' --audio-file='https://cdn2.invivo.bg/k3artfrwbsitfrnglpvlv/tracks-a1/index.fmp4.m3u8'");
            Main.notify(_("Watching %s").format(tvstation8));
        });

        //thevoice
        var tvstation11 = _("The Voice");
        this.TvItem.menu.addAction(tvstation11, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='The Voice' https://bss1.neterra.tv/thevoice/stream_0.m3u8");
            Main.notify(_("Watching %s").format(tvstation11));
        });

        //magictv
        var tvstation12 = _("Magic TV");
        this.TvItem.menu.addAction(tvstation12, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='Magic TV' https://bss1.neterra.tv/magictv/stream_0.m3u8");
            Main.notify(_("Watching %s").format(tvstation12));
        });

        //end tv drop down menu                
        this.menu.addMenuItem(this.TvItem);

        //kill
        this.menu.addAction(_("Stop"), () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("killall -9 rtmpdump");
            Main.notify(_("All Stop"));
        });
    },

    on_applet_clicked: function(event) {
        Util.spawnCommandLine("bash -c \" [ -f /usr/bin/rtmpdump ] || apturl apt://rtmpdump \"");
        Util.spawnCommandLine("bash -c \" [ -f /usr/bin/mpv ] || apturl apt://mpv \"");
        this.menu.toggle();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
};
