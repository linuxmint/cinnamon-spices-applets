const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Main = imports.ui.main;
const Settings = imports.ui.settings;


function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_label(_("Loading Newsticker..."));

        this.actor.set_style("width: 400px;");

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        // Get settings
        this.rssURL = this.settings.getValue("rssURL") || "https://rss.nytimes.com/services/xml/rss/nyt/World.xml";
        this.tickerSeperator = this.settings.getValue("tickerSeperator") || "*******";
        this.refreshInterval = this.settings.getValue("refreshInterval") || 300;
        this.tickerSpeed = this.settings.getValue("tickerSpeed") || 100;

        // Bind settings properties
        const boundSettings = [
            "rssURL",
            "tickerSeperator",
            "refreshInterval",
            "tickerSpeed"
        ]
        boundSettings.forEach(setting => {
            this.settings.bindProperty(Settings.BindingDirection.IN, setting, setting, this.on_settings_changed, null);
        });

        this._headlineIndex = 0;
        this._headlines = [];
        this._tickerText = "";
        this._tickerPosition = 0;

        this._updateFeed();
        this._tickerLoop();

        // refresh every 5 minutes
        this._refreshLoop = Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this._updateFeed));
    },

    _updateFeed: function () {
        let request = Gio.file_new_for_uri(this.rssURL);
        request.load_contents_async(null, Lang.bind(this, function (obj, res) {
            try {
                let [success, contents] = obj.load_contents_finish(res);
                if (success) {
                    let feed = contents.toString();
                    this._parseFeed(feed);
                } else {
                    global.logError("Could not load RSS-Feed");
                }
            } catch (e) {
                global.logError("Error while loading RSS: " + e.message);
            }
        }));
        return true;
    },

    _parseFeed: function (feed) {
        this._headlines = [];
        const items = feed.match(/<item>([\s\S]*?)<\/item>/g) || [];

        items.forEach(item => {
            const title = item.match(/<title>(.*?)<\/title>/)?.[1] || "No Title";
            const description = item.match(/<description>(.*?)<\/description>/)?.[1] || "No Description";
            const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "#";

            this._headlines.push({
                title: title,
                description: description,
                link: link
            });
        });

        if (this._headlines.length > 0) {
            this._headlineIndex = 0;
            this._tickerText = this._headlines[0].title + " - ";
            this._tickerPosition = 0;
        }
    },

    _tickerLoop: function () {
        if (this._headlines.length > 0) {
            this._tickerText = this._headlines.map(item => item.title).join(' ' + this.tickerSeperator + ' ');

            // set window of 60 characters
            const displayText = this._tickerText.substring(this._tickerPosition, this._tickerPosition + 60);

            // display text
            this.set_applet_label(displayText);
            this._tickerPosition += 1;

            // endless loop
            if (this._tickerPosition >= this._tickerText.length) {
                this._tickerPosition = 0;
            }
        }

        Mainloop.timeout_add(this.tickerSpeed, Lang.bind(this, this._tickerLoop));
    },

    // click on applet
    on_applet_clicked: function (event) {
        if (this._headlines.length > 0) {
            let headline = this._headlines[this._headlineIndex];

            // open link in browser
            Gio.app_info_launch_default_for_uri(headline.link, null);
        }
    },

    on_applet_removed_from_panel: function () {
        Mainloop.source_remove(this._refreshLoop);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
