imports.gi.versions.Gst = "1.0";
const Gst = imports.gi.Gst;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Channels = imports.channels;

const DEFAULT_VOLUME = 1;
const CLIENT_NAME = "fm-radio";

function createControlButtons(player, pr) {
    let box = new St.BoxLayout({
        vertical: false,
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
    });

    let prev = new St.Icon({
        style_class: "icon",
        icon_name: "media-skip-backward-symbolic",
        reactive: true,
        icon_size: 25,
    });

    let icon = new St.Icon({
        style_class: "icon",
        icon_name: player.isPlaying()
            ? "media-playback-stop-symbolic"
            : "media-playback-start-symbolic",
        reactive: true,
        icon_size: 42,
    });

    let next = new St.Icon({
        style_class: "icon",
        icon_name: "media-skip-forward-symbolic",
        reactive: true,
        icon_size: 25,
    });

    box.add_child(prev);
    box.add_child(icon);
    box.add_child(next);

    // Expose this icon to the applet so it can be updated
    pr.playStopIcon = icon;

    next.connect("button-press-event", () => {
        player.stop();
        player.next();
        player.play();
        pr.channelChanged();
    });

    prev.connect("button-press-event", () => {
        player.stop();
        player.prev();
        player.play();
        pr.channelChanged();
    });

    icon.connect("button-press-event", () => {
        if (player.isPlaying()) {
            player.stop();
            pr.setPlayingState(false);
        } else {
            player.play();
            pr.setPlayingState(true);
        }
    });

    return box;
}

const RadioPlayer = class RadioPlayer {
    constructor(channel) {
        Gst.init(null);
        this.playbin = Gst.ElementFactory.make("playbin", "fmradio");
        this.playbin.set_property("uri", channel.getLink());
        this.sink = Gst.ElementFactory.make("pulsesink", "sink");

        this.sink.set_property("client-name", CLIENT_NAME);
        this.playbin.set_property("audio-sink", this.sink);
        this.channel = channel;
        this.playing = false;
        this.setVolume(DEFAULT_VOLUME);

        let bus = this.playbin.get_bus();
        bus.add_signal_watch();
        bus.connect("message", (bus, msg) => {
            if (msg != null) this._onMessageReceived(msg);
        });
        this.onError = null;
        this.onTagChanged = null;
    }

    play() {
        this.playbin.set_state(Gst.State.PLAYING);
        this.playing = true;
    }

    setOnError(onError) {
        this.onError = onError;
    }

    setOnTagChanged(onTagChanged) {
        this.onTagChanged = onTagChanged;
    }

    setMute(mute) {
        this.playbin.set_property("mute", mute);
    }

    stop() {
        this.playbin.set_state(Gst.State.NULL);
        this.playing = false;
    }

    next() {
        let num = this.channel.getNum();
        let totalChannels = Channels.getChannels().length;
        num = num >= totalChannels - 1 ? 0 : num + 1;
        this.setChannel(Channels.getChannel(num));
    }

    prev() {
        let num = this.channel.getNum();
        let totalChannels = Channels.getChannels().length;
        num = num <= 0 ? totalChannels - 1 : num - 1;
        this.setChannel(Channels.getChannel(num));
    }

    setChannel(ch) {
        this.channel = ch;
        this.tag = ""; // Clear the previous title from memory
        this.stop();
        this.playbin.set_property("uri", ch.getLink());
        this.play();
    }

    getChannel() {
        return this.channel;
    }

    setVolume(value) {
        this.playbin.volume = value;
    }

    isPlaying() {
        return this.playing;
    }

    getTag() {
        return this.tag;
    }

    _onMessageReceived(msg) {
        switch (msg.type) {
            case Gst.MessageType.TAG: {
                let tagList = msg.parse_tag();
                let tmp = tagList.get_string("title");
                this.tag = tmp[1];
                if (this.onTagChanged != null) this.onTagChanged();
                break;
            }

            case Gst.MessageType.STREAM_START:
                if (this.onTagChanged != null) this.onTagChanged();
                break;

            case Gst.MessageType.EOS:
            case Gst.MessageType.ERROR:
                this.stop();
                if (this.onError != null) this.onError();
                break;
            default:
                break;
        }
    }
};

var Radio = {
    RadioPlayer: RadioPlayer,
    ControlButtons: createControlButtons
};
