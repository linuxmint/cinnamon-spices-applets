const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;

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
        this._setupSettings();

        this._headlineIndex = 0;
        this._headlines = [];
        this._tickerText = "";
        this._tickerPosition = 0;
        this._error = false;

        // Create popup menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._updateFeed();
        this._tickerLoop();

        // refresh every 5 minutes
        this._refreshLoop = Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this._updateFeed));
    },

    _setupSettings: function () {
        // Get settings
        this.rssURL = this.settings.getValue("rssURL") || "https://rss.nytimes.com/services/xml/rss/nyt/World.xml";
        this.tickerSeperator = this.settings.getValue("tickerSeperator") || "*******";
        this.refreshInterval = this.settings.getValue("refreshInterval") || 300;
        this.tickerSpeed = this.settings.getValue("tickerSpeed") || 300;

        // Bind settings properties
        this.settings.bindProperty(Settings.BindingDirection.IN, 'rssURL', 'rssURL', this._updateFeed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'tickerSeperator', 'tickerSeperator');
        this.settings.bindProperty(Settings.BindingDirection.IN, 'refreshInterval', 'refreshInterval', this._updateFeed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'tickerSpeed', 'tickerSpeed');
    },

    /**
    * Updates the RSS feed by asynchronously loading data from the feed URL.
    * 
    * Sends an asynchronous request to load the RSS feed contents from `rssURL`.
    * If the request is successful, the feed content is parsed using `_parseFeed`.
    * In case of an error, it logs the issue and sets an error message.
    * 
    */
    _updateFeed: function () {
        const request = Gio.file_new_for_uri(this.rssURL);
        request.load_contents_async(null, Lang.bind(this, function (obj, res) {
            try {
                const [success, contents] = obj.load_contents_finish(res);
                if (success) {
                    const feed = contents.toString();
                    this._parseFeed(feed);
                    this._error = false;
                } else {
                    global.logError("Could not load RSS-Feed");
                    this._tickerText = _("Could not load RSS-Feed");
                    this._error = true;
                }
            } catch (e) {
                global.logError("Error while loading RSS: " + e.message);
                this._tickerText = _("Error while loading RSS") + ": " + e.message;
                this._error = true;
            }
        }));
    },

    /**
    * Parses an RSS feed and extracts items into `_headlines`.
    * 
    * Extracts the title, description, and link from each `<item>` in the feed
    * and stores them in the `_headlines` array.
    * 
    * @param {string} feed - RSS feed as an XML string.
    */
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

        this._buildMenu();
    },

    /**
    * Builds the popup menu for the applet.
    * 
    * This menu is displayed when the applet is clicked.
    * It contains buttons for each headline in the `_headlines` array.
    * 
    */
    _buildMenu: function () {
        this.menu.removeAll();

        // no menu if no headlines
        if (this._headlines.length === 0) return;

        const menuSection = new PopupMenu.PopupMenuSection({ style_class: "popup-menu-section" });

        // create scroll view
        const scrollView = new St.ScrollView({
            x_fill: true,
            y_fill: true,
            style_class: "scrollView",
            clip_to_allocation: true
        });
        scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);

        // add new container to scroll view
        const menuContainer = new St.BoxLayout({ vertical: true, style_class: "menuBox" });
        scrollView.add_actor(menuContainer);

        this._headlines.forEach(item => {
            // create button for each headline
            const btn = new St.Button({ reactive: true, track_hover: true, style_class: "menuButton", x_align: St.Align.START });

            // box in button containing title and description
            const box = new St.BoxLayout({ vertical: true, style_class: "buttonBox" });
            const titleLabel = new St.Label({ text: item.title, style_class: "popup-menu-item-title" });
            const descriptionLabel = new St.Label({ text: item.description, style_class: "popup-menu-item-description" });
            box.add_actor(titleLabel);
            box.add_actor(descriptionLabel);

            btn.add_actor(box);

            // open link on click
            btn.connect("clicked", () => { Gio.app_info_launch_default_for_uri(item.link, null); });

            menuContainer.add_child(btn);
        });

        menuSection.actor.add_actor(scrollView);
        this.menu.addMenuItem(menuSection);
    },

    /**
    * Continuously updates the ticker display by cycling through the headlines.
    * 
    * Combines all headlines into a single scrolling string, then displays a 
    * windowed portion of it in the applet label. Loops back to the beginning 
    * when the ticker reaches the end of the text.
    * 
    */
    _tickerLoop: function () {
        // get chained headlines string
        if (this._headlines.length > 0) {
            const chainedHeadlines = this._headlines.map(item => item.title);
            this._tickerText = chainedHeadlines.join(' ' + this.tickerSeperator + ' ');
        }

        // get the window of the ticker text that will be displayed
        const textWindow = this._tickerText.substring(this._tickerPosition, this._tickerPosition + 60);

        this.set_applet_label(textWindow);

        this._tickerPosition += 1;

        // play the ticker from the beginning when it reaches the end
        if (this._tickerPosition >= this._tickerText.length) {
            this._tickerPosition = 0;
        }

        Mainloop.timeout_add(this.tickerSpeed, Lang.bind(this, this._tickerLoop));
    },


    on_applet_clicked: function () {
        this.menu.toggle();
    },


    on_applet_removed_from_panel: function () {
        Mainloop.source_remove(this._refreshLoop);
    }
};


function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
