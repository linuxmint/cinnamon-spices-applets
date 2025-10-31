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
            Util.spawnCommandLine("mpv --vid=no https://euc13.playlist.ttvnw.net/v1/playlist/CroGbwFwTBfCY0guxc80vtInr5nykiYOZWZ6_nBg6ir45NrXpX0eja3EcdO4eOHktCS_JMS03VoOG4yFGWl7fNtVtQAmoO8zqBfvn9xaTHUJqXNLw75qIZ0VE47kqtb_vAm5rgWZc3pjIRGJ6aiPPZv-c83ThvQs_sh8k8wOar4sWA_Wh8sCUhcFPB-NXJAXNQg53_ya2P0GXUXxid4WGCh_3AwF72TAjakCIsqm94XzKvpGe5os4JrPXTmWMF1P_bP0SWTRU7ebtZEyOUTXCczPci93XjLd9wxLmzVAx0E0ZGpJSWcuL4JBkH0vgk3iYikd7wJUjtVOrPliuTTZ__I8V9T7B-4K86HXx7-Ad0TK4KvvLOiPqfelhaObyckdB-EvDddRqFBrrjLWlKMRqZDgspLIRzFxDd4hGLWc57oeWg9HaFhd05rY-udzAfu_K9smk8OkjPkaZvWrHPI_ypvxr1MOddT5G-OOceFUMc4fe5fe8jIXHx0GQmyXz2BoXVlfn3MwSvfgQgsJxKPHlpazUK7gn1uKv059RYN4RqujlqqOVOSJqeEhgnGgYW5kkAsJm3bcYuVwPtCJeMJhabshh5LIBLNMVTGnTtycL_45D9nqRUE_jEkFu-UkV0f8w6tEBg8sP01rXG-60JzVf6VPrTjOPnmNmjtzARTq99AGRN0_yYy7GcrwAysZxDUOJfA_fvYcfjGOdX-dqkOQYRbOVAU4qqmvA4IwqXlrtL2PNsDZyvKnQjdZQCrtqoB9-9A8d_gi5ITSyjWNBgxbkC3gTkxbsic9aZpUdvLFBb5ygEm8Pxos0XwOnTUkIrLnV9sFBI6_MudTq5-fLfbY-LpWo3Jz7b72YToszHQu0YHKMkuRglNTWFbrMq0iWT1ZGhe7hCOV8mEKgbZaHfeJu53PVhJ2WljTkDNXIeisHwIAnnDGz7AsHx4ieCjVUfqoSMnNxOuXKQOsLCT5kEdLaYjulxyvXQ5Y7pT2q_U9qXFAjZW4MxWjvd-Xd9IQYL6CUUjK7urYM-G6ODH_Neb4M_1sNmSEUoojD6GR-yicfdyjingfz4VwTZAjsozGZbwt-LFOfZU34ej6DuQVVxoMHqhldHOfOluoQWeoIAEqCWV1LXdlc3QtMjDMDQ.m3u8");
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

        //k2 radio
        var radiostation11 = _("K2");
        this.RadioItem.menu.addAction(radiostation11, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv http://stream.radiok2.bg:8000/rk2");
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

        //bnt
        var tvstation1 = _("BNT");
        this.TvItem.menu.addAction(tvstation1, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv https://cdn3.glebul.com:8443/dvr/hd-bnt-1-hd/tracks-v1a1/index.m3u8?token=418f6aaa58bed4a09cb11d863a5057b7bb04155d-33fd8c7a49fb2b6804894f25f1d1099e-1761871845-1761861045 --title=BNT --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv");
            Main.notify(_("Watching %s").format(tvstation1));
        });

        //bnt2
        var tvstation2 = _("BNT 2");
        this.TvItem.menu.addAction(tvstation2, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv https://cdn4.glebul.com:8443/dvr/bnt-2/tracks-v1a1/index.m3u8?token=1e15fd311994bad7f16603e9f6a868045b92bd4c-866cf3a238e254d45e7240c81ab5e765-1761872030-1761861230 --title='BNT 2' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv");
            Main.notify(_("Watching %s").format(tvstation2));
        });
        
        //bnt3
        var tvstation3 = _("BNT 3");
        this.TvItem.menu.addAction(tvstation3, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv https://cdn4.glebul.com:8443/dvr/hd-bnt-3-hd/tracks-v1a1/index.m3u8?token=a5d3c2481ec148b33e85f9c8214e1a1c86a8f3a1-df66aec7911cc438622e9d7a7449a5b6-1761872182-1761861382 --title='BNT 3' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv");
            Main.notify(_("Watching %s").format(tvstation3));
        });
        
         //bnt4
        var tvstation4 = _("BNT 4");
        this.TvItem.menu.addAction(tvstation4, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv https://cdn4.glebul.com:8443/dvr/bnt-4/tracks-v1a1/index.m3u8?token=5e0f442bbfb59b4bfd55fba3cba6767cf6abd77b-91dcd2e112e6af82269be62413175560-1761872554-1761861754 --title='BNT 4' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv");
            Main.notify(_("Watching %s").format(tvstation4));
        });

        //btv
        var tvstation5 = _("bTV");
        this.TvItem.menu.addAction(tvstation5, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv 'https://cdn4.glebul.com:8443/dvr/hd-btv-hd/tracks-v1a1/index.m3u8?token=00e22310c81f99ea073943ed581ca7be6f7522dc-72e1efdb57f63d8021481bd91ab918f3-1761871677-1761860877' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='bTV'");
            Main.notify(_("Watching %s").format(tvstation5));
        });

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

        //nova
        var tvstation9 = _("Nova");
        this.TvItem.menu.addAction(tvstation9, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='NOVA' https://e121-ts.cdn.bg/ntv/fls/ntv_2.stream/at=O0M9MjEzLjEzMC43OS4xNjM7RT0xNzYxODc2OTYzO0E9MTtLPTM7UD0wMTExMDtTPTlmNWM0M2UxZTQwM2JmOTBiY2ZiYTM4OTJmNTQ3NDFjNjU4YzZlZjY=/chunklist.m3u8");
            Main.notify(_("Watching %s").format(tvstation9));
        });

        //onair
        var tvstation10 = _("On Air");
        this.TvItem.menu.addAction(tvstation10, () => {
            Util.spawnCommandLine("killall -9 mpv");
            Util.spawnCommandLine("mpv 'https://e112-ts.cdn.bg/mnet/fls/bonair.stream/at=O0M9MjEzLjEzMC43OS4xNjM7RT0xNzYxODc2Nzg4O0E9MTtLPTM7UD0wMTExMDtTPTM1NmQyYWU3MzgyM2NhNzMyNjJlNmJjMzFjMTQyZDhlYmUwMTdiZjM=/chunklist.m3u8' --config-dir=/home/$USER/.local/share/cinnamon/applets/BgRadio@spacy01/mpv --title='On Air' \"");
            Main.notify(_("Watching %s").format(tvstation10));
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
