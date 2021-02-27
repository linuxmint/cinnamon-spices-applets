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
        var radiostation = "";

        //bg radio
        radiostation = _("Bg Radio");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://149.13.0.81:80/bgradio.ogg &");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //btv radio
        radiostation = _("bTV Radio");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://live.btvradio.bg/btv-radio.mp3 &");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //city radio
        radiostation = _("City Radio");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://149.13.0.81:8000/city.ogg");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //classicfm radio
        radiostation = _("Classic FM");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://live.btvradio.bg/classic-fm.mp3");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //darik radio
        radiostation = _("Darik");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://darikradio.by.host.bg:8000/S2-128");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //darik nostalgie
        radiostation = _("Darik Nostalgie");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://darikradio.by.host.bg:8000/Nostalgie");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //energy radio
        radiostation = _("Energy");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://149.13.0.80/nrj_low.ogg &");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //fmplus radio
        radiostation = _("FM+");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://193.108.24.21:8000/fmplus");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //fresh radio
        radiostation = _("Fresh");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://193.108.24.21:8000/fresh");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //jazzfm radio
        radiostation = _("Jazz FM");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://live.btvradio.bg/jazz-fm.mp3");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //k2 radio
        radiostation = _("K2");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://stream.radiok2.bg:8000/rk2-high");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //melody radio
        radiostation = _("Melody");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://193.108.24.6:8000/melody");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //njoy radio
        radiostation = _("N-Joy");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://live.btvradio.bg/njoy.mp3");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //nova radio
        radiostation = _("Nova Radio");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://stream81.metacast.eu/nova.ogg");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //radio1 radio
        radiostation = _("Radio 1");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://149.13.0.81/radio1.ogg");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //radio1rock radio
        radiostation = _("Radio 1 Rock");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://149.13.0.81/radio1rock.ogg");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //thevoice radio
        radiostation = _("The Voice Radio");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv rtsp://31.13.217.76:1935/rtplive/thevoiceradio_live.stream");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //zrock radio
        radiostation = _("Z-Rock");
        this.RadioItem.menu.addAction(radiostation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://live.btvradio.bg/z-rock.mp3");
            Main.notify(_("Listening %s").format(radiostation));
        });

        //end radio drop down menu               
        this.menu.addMenuItem(this.RadioItem);


        //tv - dropdown menu
        this.TvItem = new PopupMenu.PopupSubMenuMenuItem(_("TV stations"));
        var tvstation = "";

        //bnt
        tvstation = _("BNT");
        this.TvItem.menu.addAction(tvstation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"wget -r -l1 -H -Dcdn.bg -O '/tmp/bnt.txt' 'http://tv.bnt.bg/bnt1/16x9/'; grep playlist.m3u8 '/tmp/bnt.txt' | cut -c27-115 > '/tmp/bnt1.txt'; mpv --title=BNT --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv $(cat /tmp/bnt1.txt); rm /tmp/bnt.txt /tmp/bnt1.txt \"");
            Main.notify(_("Watching %s").format(tvstation));
        });

        //bnt2
        tvstation = _("BNT 2");
        this.TvItem.menu.addAction(tvstation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"wget -r -l1 -H -Dcdn.bg -O '/tmp/bnt.txt' 'http://tv.bnt.bg/bnt2/16x9/'; grep playlist.m3u8 '/tmp/bnt.txt' | cut -c27-115 > '/tmp/bnt1.txt'; mpv --title='BNT 2' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv $(cat /tmp/bnt1.txt); rm /tmp/bnt.txt /tmp/bnt1.txt\"");
            Main.notify(_("Watching %s").format(tvstation));
        });

        //bnthd
        tvstation = _("BNT HD");
        this.TvItem.menu.addAction(tvstation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"wget -r -l1 -H -Dcdn.bg -O '/tmp/bnt.txt' 'http://tv.bnt.bg/bnthd/'; grep playlist.m3u8 '/tmp/bnt.txt' | cut -c27-116 > '/tmp/bnt1.txt'; mpv --title='BNT HD' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv $(cat /tmp/bnt1.txt); rm /tmp/bnt.txt /tmp/bnt1.txt\"");
            Main.notify(_("Watching %s").format(tvstation));
        });

        //bntsat
        tvstation = _("BNT World");
        this.TvItem.menu.addAction(tvstation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"wget -r -l1 -H -Dcdn.bg -O '/tmp/bnt.txt' 'http://tv.bnt.bg/bntworld/'; grep playlist.m3u8 '/tmp/bnt.txt' | cut -c27-115 > '/tmp/bnt1.txt'; mpv --title='BNT World' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv $(cat /tmp/bnt1.txt); rm /tmp/bnt.txt /tmp/bnt1.txt\"");
            Main.notify(_("Watching %s").format(tvstation));
        });

        //btv
        tvstation = _("bTV");
        this.TvItem.menu.addAction(tvstation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"mpv 'http://46.10.150.111/alpha/alpha/playlist.m3u8' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='bTV'\"");
            Main.notify(_("Watching %s").format(tvstation));
        });

        //bit
        tvstation = _("BIT");
        this.TvItem.menu.addAction(tvstation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"mpv 'http://hls.cdn.bg:2103/fls/bit_2.stream/playlist.m3u8' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='BIT'\"");
            Main.notify(_("Watching %s").format(tvstation));
        });

        //city
        tvstation = _("City");
        this.TvItem.menu.addAction(tvstation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"rtmpdump -r 'rtmp://nodeb.gocaster.net:1935/CGL/_definst_/' -W 'http://iphone.fmstreams.com/jwplayer/player.swf' -p 'http://city.bg/live/' -y 'mp4:TODAYFM_TEST2' -b '0' | mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='City' -\"");
            Main.notify(_("Watching %s").format(tvstation));
        });

        //kanal3
        tvstation = _("Kanal 3");
        this.TvItem.menu.addAction(tvstation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"rtmpdump -r 'rtmp://edge4.cdn.bg:2017/fls' -a 'fls/' -W 'http://i.cdn.bg/flash/jwplayer510/player.swf' -f 'WIN 18,0,0,232' -p 'http://i.cdn.bg/live/Atki7GnEae' -y 'kanal3.stream?at=b0d1270b39e08ad9c78dc53f43a1ba5c' | mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='Kanal 3' -\"");
            Main.notify(_("Watching %s").format(tvstation));
        });

        //nova
        tvstation = _("Nova");
        this.TvItem.menu.addAction(tvstation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"rtmpdump -r 'rtmp://e1.cdn.bg:2060/fls' -T 'N0v4TV6#2' -a 'fls' -f 'WIN 18,0,0,232' -W 'http://i.cdn.bg/eflash/jwNTV/player.swf' -p 'http://i.cdn.bg/live/0OmMKJ4SgY' -y 'ntv_1.stream' | mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='NOVA' -\"");
            Main.notify(_("Watching %s").format(tvstation));
        });

        //onair
        tvstation = _("On Air");
        this.TvItem.menu.addAction(tvstation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"mpv 'http://ios.cdn.bg:2006/fls/bonair.stream/playlist.m3u8' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='On Air' \"");
            Main.notify(_("Watching %s").format(tvstation));
        });

        //thevoice
        tvstation = _("The Voice");
        this.TvItem.menu.addAction(tvstation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"rtmpdump -r 'rtmp://31.13.217.76/rtplive' -W 'http://www.thevoice.bg/js/thevoice_videostreem.swf' -p 'http://www.thevoice.bg/' -y 'thevoice_live.stream' -b '0' | mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='The Voice' -\"");
            Main.notify(_("Watching %s").format(tvstation));
        });

        //magictv
        tvstation = _("Magic TV");
        this.TvItem.menu.addAction(tvstation, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"rtmpdump -r 'rtmp://31.13.217.76:1935/magictv' -W 'http://www.thevoice.bg/js/thevoice_videostreem.swf' -p 'http://www.thevoice.bg/' -y 'magictv_live.stream' -b '0' | mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='Magic TV' -\"");
            Main.notify(_("Watching %s").format(tvstation));
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