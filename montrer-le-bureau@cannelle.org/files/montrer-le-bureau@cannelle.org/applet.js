//Based of original Cinnamon applet "show-desktop@cinnamon.org"

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Util = imports.misc.util;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const ModalDialog = imports.ui.modalDialog;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const LOCKFILE = '/var/tmp/vlcrec.run';
const DefIcon = "user-desktop";
const RecIcon = "media-record";

// l10n/translation support
const UUID = "montrer-le-bureau@cannelle.org"
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name(DefIcon);
        this.set_applet_tooltip(_("Show or capture desktop"));

        this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "encapsulation",
            "M_X_R",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "audio-codec",
            "A_COD",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "video-codec",
            "V_COD",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "file-name",
            "F_NAME",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "dir-name",
            "D_NAME",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "audio-samplerate",
            "A_SRATE",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "audio-channels",
            "A_CHAN",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "video-bitrate",
            "V_BRATE",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "audio-bitrate",
            "A_BRATE",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "video-framerate",
            "F_P_S",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "screen-caching",
            "S_CACHE",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "video-filter-crop",
            "VF_CROP",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "crop-left",
            "CROP_L",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "crop-top",
            "CROP_T",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "crop-right",
            "CROP_R",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "crop-bottom",
            "CROP_B",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "video-filter-logo",
            "WMRK_YES",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "logo-file",
            "WMRK_FILE",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "logo-position",
            "WMRK_POS",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "logo-y",
            "WMRK_POSY",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "logo-x",
            "WMRK_POSX",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "logo-opacity",
            "WMRK_OPCT",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "use-screen-shot",
            "SS_YES",
            null,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "ss-tool",
            "SS_CMD",
            null,
            null);

        this._initContextMenu();

    },

    _initContextMenu: function() {
        this.empty_item = new PopupMenu.PopupIconMenuItem(_("Record Screen"),
            RecIcon,
            St.IconType.SYMBOLIC);
        this.empty_item.connect('activate', Lang.bind(this, this.do_VlcTranscode));
        this._applet_context_menu.addMenuItem(this.empty_item);

        this.open_item = new PopupMenu.PopupIconMenuItem(_("Stop Recording"),
            "media-playback-stop",
            St.IconType.SYMBOLIC);
        this.open_item.connect('activate', Lang.bind(this, this.do_StopTranscode));
        this._applet_context_menu.addMenuItem(this.open_item);
    },

    do_VlcTranscode: function() {

        let ONAME = this.F_NAME;
        let DIRNAME = this.D_NAME;
        let ACOD = this.A_COD;
        let VCOD = this.V_COD;
        let VFPS = this.F_P_S;
        let SMPLRT = this.A_SRATE;
        let ACHAN = this.A_CHAN;
        let VBR = this.V_BRATE;
        let ABR = this.A_BRATE;
        let MUXR = this.M_X_R;
        let SCRW = global.screen_width;
        let SCRH = global.screen_height;
        let SCASH = this.S_CACHE;

        let LOGOFLTR = "";
        let USELOGO = "";
        if (this.WMRK_YES)
            USELOGO = "--logo-file=" + this.WMRK_FILE + " --logo-position=" + this.WMRK_POS + " --logo-y=" + this.WMRK_POSY + " --logo-x=" + this.WMRK_POSX + " --logo-opacity=" + this.WMRK_OPCT + " ";
        if (USELOGO !== "")
            LOGOFLTR = ",sfilter=logo";

        let VFCROP = "";
        if (this.VF_CROP)
            VFCROP = ",vfilter=croppadd{cropleft=" + this.CROP_L + ",cropbottom=" + this.CROP_B + ",croptop=" + this.CROP_T + ",cropright=" + this.CROP_R + "}";

        let now = new Date();
        let N_O_W = now.toLocaleFormat("-%F_%T.");

        let CMDLINE = "vlc screen://  --qt-start-minimized --input-slave alsa:// --no-video " + USELOGO + "--screen-width=" + SCRW + " --screen-height=" + SCRH + " :screen-fps=" + VFPS + " :screen-caching=" + SCASH + " ";

        let TRANSCODING = "--sout " + "\"#transcode{vcodec=" + VCOD + VFCROP + ",vb=" + VBR + ",fps=" + VFPS + ",scale=" + "1" + ",acodec=" + ACOD + ",ab=" + ABR + ",channels=" + ACHAN + ",samplerate=" + SMPLRT + LOGOFLTR + "}:duplicate{dst=std{access=file,mux=" + MUXR + ",dst=" + DIRNAME + "/" + ONAME + N_O_W + MUXR + "}}\"";

        let lock_file = Gio.file_new_for_path(LOCKFILE);
        if (lock_file.query_exists(null)) {
            new ModalDialog.NotifyDialog(_("Sorry, only one instance allowed!\n")).open();
        } else if ((this.CROP_L >= SCRW) || (this.CROP_R >= SCRW) || (this.CROP_B >= SCRH) || (this.CROP_T >= SCRH)) {
            new ModalDialog.NotifyDialog(_("Sorry, the record can't start,\n because you have incorrect crop settings!\n")).open();
        } else {
            Util.spawnCommandLine("touch " + LOCKFILE);
            Util.spawnCommandLine(CMDLINE + TRANSCODING);
            this.set_applet_icon_name(RecIcon);
        }
    },

    do_StopTranscode: function() {
        let lock_file = Gio.file_new_for_path(LOCKFILE);
        if (lock_file.query_exists(null)) {
            Util.spawnCommandLine("killall -SIGTERM vlc");
            Util.spawnCommandLine("rm -f " + LOCKFILE);
            Main.notify(_("Recording has finished"));
            this.set_applet_icon_name(DefIcon);
        } else {
            new ModalDialog.NotifyDialog(_("There is no active recording.\n")).open();
        }
    },

    _onButtonPressEvent: function(actor, event) {
        if (this._applet_enabled) {
            if (event.get_button() == 1) {
                if (!this._draggable.inhibit) {
                    return false;
                } else {
                    if (this._applet_context_menu.isOpen) {
                        this._applet_context_menu.toggle();
                    }
                    this.on_applet_clicked(event);
                }
            }
            if ((this.SS_YES === true) && GLib.file_test(this.SS_CMD, GLib.FileTest.IS_EXECUTABLE)) {
                if (event.get_button() == 2) {
                    Util.spawnCommandLine(this.SS_CMD);
                }
            }
            if (event.get_button() == 3) {
                if (this._applet_context_menu._getMenuItems().length > 0) {
                    this._applet_context_menu.toggle();
                }
            }
        }
        return true;
    },


    on_applet_clicked: function(event) {
        global.screen.toggle_desktop(global.get_current_time());
    },

    on_applet_removed_from_panel: function() {
        Util.killall("vlc");
        Util.spawnCommandLine("rm -f " + LOCKFILE);
        this.settings.finalize();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
