const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.TextApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        // Safe defaults
        this.messages = ["Loading..."];
        this.lastIndex = -1;
        this.currentTypingTimeout = null;
        this.timer = null;

        let messagesFile = Gio.file_new_for_path(metadata.path + "/messages.json");

        // Async load (classic callback style)
        messagesFile.load_contents_async(null, Lang.bind(this, function(file, result) {
            try {
                let success, data;
                [success, data] = file.load_contents_finish(result);   // still may fail on very old GJS

                // Safer alternative without destructuring:
                // let resultArray = file.load_contents_finish(result);
                // let success = resultArray[0];
                // let data = resultArray[1];

                if (!success || !data) {
                    this.messages = ["Error loading messages"];
                } else {
                    this.messages = JSON.parse(data.toString());

                    if (!Array.isArray(this.messages) || this.messages.length === 0) {
                        this.messages = ["No messages found"];
                    }
                }
            } catch (e) {
                this.messages = ["Invalid JSON"];
                global.logError(e);
            }

            this.setRandomMessage();
            this.startTimer();
        }));
    },

    startTimer: function() {
        this.timer = Mainloop.timeout_add_seconds(300, Lang.bind(this, function() {
            this.setRandomMessage();
            return true;
        }));
    },

    stopCurrentTyping: function() {
        if (this.currentTypingTimeout) {
            Mainloop.source_remove(this.currentTypingTimeout);
            this.currentTypingTimeout = null;
        }
    },

    setRandomMessage: function() {
        this.stopCurrentTyping();

        if (!this.messages || this.messages.length === 0) {
            this.set_applet_label("…");
            return;
        }

        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * this.messages.length);
        } while (newIndex === this.lastIndex && this.messages.length > 1);

        this.lastIndex = newIndex;
        let message = this.messages[newIndex] || "";

        this.set_applet_label("");
        let i = 0;
        let self = this;

        let typeNextChar = function() {
            if (i >= message.length) {
                self.currentTypingTimeout = null;
                return false;
            }

            self.set_applet_label(message.substring(0, i + 1));
            i++;

            let delay = 100;
            let lastChar = message[i - 1];
            if (" .,!?:;".indexOf(lastChar) !== -1) {
                delay = 200;
            }

            self.currentTypingTimeout = Mainloop.timeout_add(delay, typeNextChar);
            return false;
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
