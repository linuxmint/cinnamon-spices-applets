const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;

function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.TextApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        // load messages.json file
        let messagesFile = Gio.file_new_for_path(metadata.path + "/messages.json");
        let [success, data] = messagesFile.load_contents(null);

        if (!success || !data) {
            this.messages = ["Error loading messages"];
        } else {
            try {
                this.messages = JSON.parse(data.toString());
                if (!Array.isArray(this.messages) || this.messages.length === 0) {
                    this.messages = ["No messages found"];
                }
            } catch (e) {
                this.messages = ["Invalid JSON"];
            }
        }

        this.lastIndex = -1;
        this.currentTypingTimeout = null;

        this.setRandomMessage();
        this.startTimer();
    },

    startTimer: function() {
        // 300 sec = 5 min (600 = 10 min)
        this.timer = Mainloop.timeout_add_seconds(300, () => {
            this.setRandomMessage();
            return true; // loop
        });
    },

    stopCurrentTyping: function() {
        if (this.currentTypingTimeout) {
            Mainloop.source_remove(this.currentTypingTimeout);
            this.currentTypingTimeout = null;
        }
    },

    setRandomMessage: function() {
        this.stopCurrentTyping();

        // Pick a new message
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * this.messages.length);
        } while (newIndex === this.lastIndex && this.messages.length > 1);

        this.lastIndex = newIndex;
        const message = this.messages[newIndex] || "";

        this.set_applet_label(""); // Clear label

        let i = 0;
        const typeNextChar = () => {
            if (i >= message.length) {
                this.currentTypingTimeout = null;
                return;
            }

            this.set_applet_label(message.substring(0, i + 1));
            i++;

            let delay = 100; // pause a blink between letters
            const lastChar = message[i - 1];

            if (" .,!?:;".includes(lastChar)) {
                delay = 200; // pause a tad more than a blink between words
            }

            this.currentTypingTimeout = Mainloop.timeout_add(delay, typeNextChar);
        };

        typeNextChar();
    },

    on_applet_clicked: function() {
        this.setRandomMessage();
    },

    on_applet_removed_from_panel: function() {
        if (this.timer) {
            Mainloop.source_remove(this.timer);
            this.timer = null;
        }
        this.stopCurrentTyping();
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
