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
            Util.spawnCommandLine("mpv http://live.btvradio.bg/btv-radio.mp3 &");
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
            Util.spawnCommandLine("mpv http://live.btvradio.bg/classic-fm.mp3");
            Main.notify(_("Listening %s").format(radiostation4));
        });

        //darik radio
        var radiostation5 = _("Darik");
        this.RadioItem.menu.addAction(radiostation5, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://darikradio.by.host.bg:8000/S2-128");
            Main.notify(_("Listening %s").format(radiostation5));
        });

        //darik nostalgie
        var radiostation6 = _("Darik Nostalgie");
        this.RadioItem.menu.addAction(radiostation6, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://darikradio.by.host.bg:8000/Nostalgie");
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
            Util.spawnCommandLine("mpv http://live.btvradio.bg/jazz-fm.mp3");
            Main.notify(_("Listening %s").format(radiostation10));
        });

        //k2 radio
        var radiostation11 = _("K2");
        this.RadioItem.menu.addAction(radiostation11, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://stream.radiok2.bg:8000/rk2-high");
            Main.notify(_("Listening %s").format(radiostation11));
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
            Util.spawnCommandLine("mpv http://live.btvradio.bg/njoy.mp3");
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
            Util.spawnCommandLine("mpv rtsp://31.13.217.76:1935/rtplive/thevoiceradio_live.stream");
            Main.notify(_("Listening %s").format(radiostation17));
        });

        //zrock radio
        var radiostation18 = _("Z-Rock");
        this.RadioItem.menu.addAction(radiostation18, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://live.btvradio.bg/z-rock.mp3");
            Main.notify(_("Listening %s").format(radiostation18));
        });

        //end radio drop down menu               
        this.menu.addMenuItem(this.RadioItem);


        //tv - dropdown menu
        this.TvItem = new PopupMenu.PopupSubMenuMenuItem(_("TV stations"));

        //bnt
        var tvstation1 = _("BNT");
        this.TvItem.menu.addAction(tvstation1, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"wget -r -l1 -H -Dcdn.bg -O '/tmp/bnt.txt' 'http://tv.bnt.bg/bnt1/16x9/'; grep playlist.m3u8 '/tmp/bnt.txt' | cut -c27-115 > '/tmp/bnt1.txt'; mpv --title=BNT --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv $(cat /tmp/bnt1.txt); rm /tmp/bnt.txt /tmp/bnt1.txt \"");
            Main.notify(_("Watching %s").format(tvstation1));
        });

        //bnt2
        var tvstation2 = _("BNT 2");
        this.TvItem.menu.addAction(tvstation2, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"wget -r -l1 -H -Dcdn.bg -O '/tmp/bnt.txt' 'http://tv.bnt.bg/bnt2/16x9/'; grep playlist.m3u8 '/tmp/bnt.txt' | cut -c27-115 > '/tmp/bnt1.txt'; mpv --title='BNT 2' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv $(cat /tmp/bnt1.txt); rm /tmp/bnt.txt /tmp/bnt1.txt\"");
            Main.notify(_("Watching %s").format(tvstation2));
        });

        //bnthd
        var tvstation3 = _("BNT HD");
        this.TvItem.menu.addAction(tvstation3, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"wget -r -l1 -H -Dcdn.bg -O '/tmp/bnt.txt' 'http://tv.bnt.bg/bnthd/'; grep playlist.m3u8 '/tmp/bnt.txt' | cut -c27-116 > '/tmp/bnt1.txt'; mpv --title='BNT HD' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv $(cat /tmp/bnt1.txt); rm /tmp/bnt.txt /tmp/bnt1.txt\"");
            Main.notify(_("Watching %s").format(tvstation3));
        });

        //bntsat
        var tvstation4 = _("BNT World");
        this.TvItem.menu.addAction(tvstation4, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"wget -r -l1 -H -Dcdn.bg -O '/tmp/bnt.txt' 'http://tv.bnt.bg/bntworld/'; grep playlist.m3u8 '/tmp/bnt.txt' | cut -c27-115 > '/tmp/bnt1.txt'; mpv --title='BNT World' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv $(cat /tmp/bnt1.txt); rm /tmp/bnt.txt /tmp/bnt1.txt\"");
            Main.notify(_("Watching %s").format(tvstation4));
        });

        //btv
        var tvstation5 = _("bTV");
        this.TvItem.menu.addAction(tvstation5, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"mpv 'http://46.10.150.111/alpha/alpha/playlist.m3u8' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='bTV'\"");
            Main.notify(_("Watching %s").format(tvstation5));
        });

        //bit
        var tvstation6 = _("BIT");
        this.TvItem.menu.addAction(tvstation6, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"mpv 'http://hls.cdn.bg:2103/fls/bit_2.stream/playlist.m3u8' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='BIT'\"");
            Main.notify(_("Watching %s").format(tvstation6));
        });

        //city
        var tvstation7 = _("City");
        this.TvItem.menu.addAction(tvstation7, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"rtmpdump -r 'rtmp://nodeb.gocaster.net:1935/CGL/_definst_/' -W 'http://iphone.fmstreams.com/jwplayer/player.swf' -p 'http://city.bg/live/' -y 'mp4:TODAYFM_TEST2' -b '0' | mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='City' -\"");
            Main.notify(_("Watching %s").format(tvstation7));
        });

        //kanal3
        var tvstation8 = _("Kanal 3");
        this.TvItem.menu.addAction(tvstation8, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"rtmpdump -r 'rtmp://edge4.cdn.bg:2017/fls' -a 'fls/' -W 'http://i.cdn.bg/flash/jwplayer510/player.swf' -f 'WIN 18,0,0,232' -p 'http://i.cdn.bg/live/Atki7GnEae' -y 'kanal3.stream?at=b0d1270b39e08ad9c78dc53f43a1ba5c' | mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='Kanal 3' -\"");
            Main.notify(_("Watching %s").format(tvstation8));
        });

        //nova
        var tvstation9 = _("Nova");
        this.TvItem.menu.addAction(tvstation9, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"rtmpdump -r 'rtmp://e1.cdn.bg:2060/fls' -T 'N0v4TV6#2' -a 'fls' -f 'WIN 18,0,0,232' -W 'http://i.cdn.bg/eflash/jwNTV/player.swf' -p 'http://i.cdn.bg/live/0OmMKJ4SgY' -y 'ntv_1.stream' | mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='NOVA' -\"");
            Main.notify(_("Watching %s").format(tvstation9));
        });

        //onair
        var tvstation10 = _("On Air");
        this.TvItem.menu.addAction(tvstation10, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"mpv 'http://ios.cdn.bg:2006/fls/bonair.stream/playlist.m3u8' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='On Air' \"");
            Main.notify(_("Watching %s").format(tvstation10));
        });

        //thevoice
        var tvstation11 = _("The Voice");
        this.TvItem.menu.addAction(tvstation11, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"rtmpdump -r 'rtmp://31.13.217.76/rtplive' -W 'http://www.thevoice.bg/js/thevoice_videostreem.swf' -p 'http://www.thevoice.bg/' -y 'thevoice_live.stream' -b '0' | mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='The Voice' -\"");
            Main.notify(_("Watching %s").format(tvstation11));
        });

        //magictv
        var tvstation12 = _("Magic TV");
        this.TvItem.menu.addAction(tvstation12, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("bash -c \"rtmpdump -r 'rtmp://31.13.217.76:1935/magictv' -W 'http://www.thevoice.bg/js/thevoice_videostreem.swf' -p 'http://www.thevoice.bg/' -y 'magictv_live.stream' -b '0' | mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='Magic TV' -\"");
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