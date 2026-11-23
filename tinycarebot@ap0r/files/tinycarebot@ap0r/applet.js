const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;

class MyApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.messages = ["Loading..."];
        this.lastIndex = -1;
        this.currentTypingTimeout = null;
        this.rotationTimer = null;

        this._loadMessages(metadata.path);
    }

    _loadMessages(path) {
        const file = Gio.File.new_for_path(`${path}/messages.json`);

        file.load_contents_async(null, (source, result) => {
            try {
                const [success, contents] = source.load_contents_finish(result);

                if (!success || !contents) {
                    this.messages = ["Error loading messages"];
                } else {
                    const parsed = JSON.parse(contents.toString());

                    if (Array.isArray(parsed) && parsed.length > 0) {
                        this.messages = parsed;
                    } else {
                        this.messages = ["No messages found"];
                    }
                }
            } catch (e) {
                this.messages = ["Invalid JSON"];
                global.logError(e);
            }

            this._showRandomMessage();
            this._startRotationTimer();
        });
    }

    _startRotationTimer() {
        if (this.rotationTimer) {
            Mainloop.source_remove(this.rotationTimer);
        }

        this.rotationTimer = Mainloop.timeout_add_seconds(300, () => {
            this._showRandomMessage();
            return true;
        });
    }

    _stopTypingAnimation() {
        if (this.currentTypingTimeout) {
            Mainloop.source_remove(this.currentTypingTimeout);
            this.currentTypingTimeout = null;
        }
    }

    _showRandomMessage() {
        this._stopTypingAnimation();

        if (!this.messages || this.messages.length === 0) {
            this.set_applet_label("...");
            return;
        }

        let index;

        do {
            index = Math.floor(Math.random() * this.messages.length);
        } while (
            this.messages.length > 1 &&
            index === this.lastIndex
        );

        this.lastIndex = index;

        const message = String(this.messages[index] || "");

        this.set_applet_label("");

        let position = 0;

        const typeNextCharacter = () => {
            if (position >= message.length) {
                this.currentTypingTimeout = null;
                return false;
            }

            this.set_applet_label(
                message.substring(0, position + 1)
            );

            const typedChar = message[position];
            position++;

            let delay = 100;

            if (" .,!?:;".includes(typedChar)) {
                delay = 200;
            }

            this.currentTypingTimeout =
            Mainloop.timeout_add(delay, typeNextCharacter);

            return false;
        };

        typeNextCharacter();
    }

    on_applet_clicked() {
        this._showRandomMessage();
    }

    on_applet_removed_from_panel() {
        if (this.rotationTimer) {
            Mainloop.source_remove(this.rotationTimer);
            this.rotationTimer = null;
        }

        this._stopTypingAnimation();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(
        metadata,
        orientation,
        panelHeight,
        instanceId
    );
}
