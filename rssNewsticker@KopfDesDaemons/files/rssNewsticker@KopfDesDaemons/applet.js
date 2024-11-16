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

    _updateFeed: function () {
        let request = Gio.file_new_for_uri(this.rssURL);
        request.load_contents_async(null, Lang.bind(this, function (obj, res) {
            try {
                let [success, contents] = obj.load_contents_finish(res);
                if (success) {
                    let feed = contents.toString();
                    this._parseFeed(feed);
                    this._error = false;
                } else {
                    global.logError("Could not load RSS-Feed");
                    this._tickerText = _("Could not load RSS-Feed");
                    this._error = true;
                }
            } catch (e) {
                global.logError("Error while loading RSS: " + e.message);
                this._tickerText = _("Error while loading RSS: " + e.message);
                this._error = true;
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

        this._buildMenu();
    },

    _buildMenu: function () {
        // Menü zurücksetzen
        this.menu.removeAll();

        if (this._headlines.length === 0) {
            let menuItem = new PopupMenu.PopupMenuItem("Keine Nachrichten verfügbar");
            this.menu.addMenuItem(menuItem);
            return;
        }

        // PopupMenuSection als Container erstellen
        let menuSection = new PopupMenu.PopupMenuSection();

        // ScrollView erstellen und an den MenuSection Container anhängen
        let scrollView = new St.ScrollView({
            x_fill: true,
            y_fill: true,
            style_class: "popup-menu-content"  // Styling-Klasse für ScrollView
        });
        scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);  // nur vertikales Scrollen erlauben

        // BoxLayout als Container für die Menüeinträge innerhalb des ScrollView erstellen
        let menuContainer = new St.BoxLayout({ vertical: true });
        scrollView.add_actor(menuContainer);

        // Menüelemente hinzufügen
        this._headlines.forEach(item => {
            let menuItem = new PopupMenu.PopupMenuItem(item.title);

            let descriptionLabel = new St.Label({
                text: item.description,
                style_class: "popup-inactive-menu-item"
            });
            menuItem.actor.add_actor(descriptionLabel);

            // Klick-Event zum Öffnen des Links
            menuItem.connect("activate", () => {
                Gio.app_info_launch_default_for_uri(item.link, null);
            });

            menuContainer.add_child(menuItem.actor);  // Menüeintrag in den Container hinzufügen
        });

        // ScrollView zum Menü-Abschnitt hinzufügen
        menuSection.actor.add_actor(scrollView);

        // Begrenzung der maximalen Größe des ScrollViews
        scrollView.style = "max-height: 400px; max-width: 300px;";

        // Menüabschnitt zum Menü hinzufügen
        this.menu.addMenuItem(menuSection);
    },

    _tickerLoop: function () {
        if (this._headlines.length > 0) {
            this._tickerText = this._headlines.map(item => item.title).join(' ' + this.tickerSeperator + ' ');
        }

        const displayText = this._tickerText.substring(this._tickerPosition, this._tickerPosition + 60);

        this.set_applet_label(displayText);
        this._tickerPosition += 1;

        if (this._tickerPosition >= this._tickerText.length) {
            this._tickerPosition = 0;
        }

        Mainloop.timeout_add(this.tickerSpeed, Lang.bind(this, this._tickerLoop));
    },

    on_applet_clicked: function (event) {
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function () {
        Mainloop.source_remove(this._refreshLoop);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
