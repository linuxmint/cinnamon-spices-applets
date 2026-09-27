// === IMPORTS & CONSTANTS ===
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const PopupMenu = imports.ui.popupMenu;

const PICTURES_DIR = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
const CUSTOM_IMAGE_DIR = PICTURES_DIR ? (PICTURES_DIR + "/fm-radio-covers") : null;

const UUID = "FM-Radio@hilyxx";
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

const extPath = GLib.get_user_data_dir() + "/cinnamon/applets/" + UUID;

// === CHANNEL SUBMENU: UI SETUP ===
var currentChannelsList = [];

// Function called by the applet to inject the list from settings
function setChannels(channelsArray) {
    if (!channelsArray || channelsArray.length === 0) return;
    
    currentChannelsList = channelsArray.map(
        (ch, index) => new Channel(ch.name, ch.link, ch.pic, index)
    );
}

function getChannels() {
    return currentChannelsList;
}

function getChannel(index) {
    // If the list is empty (parameter error), return a dummy radio to prevent a crash
    if (currentChannelsList.length === 0) {
        return new Channel(_("Error"), "", "", 0, false);
    }
    return currentChannelsList[index] ?? currentChannelsList[0];
}

var Channel = class Channel {
    constructor(name, link, pic, num) {
        this.name = name;
        this.link = link;
        this.pic = pic;
        this.num = num;
    }
    getName() { return this.name; }
    getLink() { return this.link; }
    getPic() { return this.pic; }
    getNum() { return this.num; }

    getResolvedIcon() {
        let path = this.pic;
        
        if (!path || path.trim() === "") {
            path = "default-cover.png";
        }

        if (path.startsWith("/home/")) {
            try {
                let absoluteFile = Gio.File.new_for_path(path);
                absoluteFile.query_info('*', Gio.FileQueryInfoFlags.NONE, null);
                return Gio.icon_new_for_string(path);
            } catch (e) {}
        }

        let fileName = path.split('/').pop();

        if (CUSTOM_IMAGE_DIR) {
            let customPath = CUSTOM_IMAGE_DIR + "/" + fileName;
            try {
                let customFile = Gio.File.new_for_path(customPath);
                customFile.query_info('*', Gio.FileQueryInfoFlags.NONE, null);
                return Gio.icon_new_for_string(customPath);
            } catch (e) {}
        }

        let defaultPath = extPath + "/images/" + fileName;
        try {
            let defaultFile = Gio.File.new_for_path(defaultPath);
            defaultFile.query_info('*', Gio.FileQueryInfoFlags.NONE, null);
            return Gio.icon_new_for_string(defaultPath);
        } catch (e) {}

        return Gio.icon_new_for_string(extPath + "/images/default-cover.png");
    }
};

var ChannelBox = class ChannelBox extends PopupMenu.PopupBaseMenuItem {
    constructor(channel, player, popup) {
        super({ reactive: true });

        this.player = player;
        this.channel = channel;
        this.popup = popup;

        this.vbox = new St.BoxLayout({ 
            vertical: false,
            x_expand: true 
        });
        this.addActor(this.vbox);

        let icon2 = new St.Icon({
            gicon: channel.getResolvedIcon(),
            style: "margin-right:10px",
            icon_size: 32,
        });

        let box2 = new St.BoxLayout({ vertical: false, x_expand: true });
        let label1 = new St.Label({
            text: channel.getName(),
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: true,
            x_expand: true,
            style_class: 'channel-label'
        });
        
        label1.clutter_text.line_wrap = true;
        label1.clutter_text.line_wrap_mode = Pango.WrapMode.WORD;
        label1.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        this.vbox.add_child(icon2);
        this.vbox.add_child(box2);
        box2.add_child(label1);

        this.connect('activate', () => {
            this.player.stop();
            this.player.setChannel(this.channel);
            this.player.play();
            this.popup.channelChanged();
        });
    }
}
