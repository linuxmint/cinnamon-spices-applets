// === IMPORTS & CONSTANTS ===
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const PopupMenu = imports.ui.popupMenu;

const UUID = "FM-Radio@hilyxx";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

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
            path = "/images/default-cover.png";
        }
        let iconPath = path.startsWith("/home/") ? path : extPath + (path.startsWith("/") ? "" : "/") + path;
        return Gio.icon_new_for_string(iconPath);
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
            width: 200,
            x_expand: true 
        });
        this.addActor(this.vbox);

        let icon2 = new St.Icon({
            gicon: channel.getResolvedIcon(),
            style: "margin-right:10px",
            icon_size: 32,
        });

        let box2 = new St.BoxLayout({ vertical: false });
        let label1 = new St.Label({
            text: channel.getName(),
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: true,
            style_class: 'channel-label',
            style: 'max-width: 165px;' 
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
