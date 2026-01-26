const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Soup = imports.gi.Soup;

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.metadata = metadata;
        this.set_applet_icon_path(this.metadata.path + "/icon.png");
        this.set_applet_label(_("Loading Newsticker..."));

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this._setupSettings();

        this._allNews = [];
        this._tickerText = "";
        this._tickerPosition = 0;
        this._error = false;

        // Menü
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._updateFeed();
        this._tickerLoop();
        this._setWidth();

        // refresh every X seconds
        this._refreshLoop = Mainloop.timeout_add_seconds(this.update_interval * 60, Lang.bind(this, this._updateFeed));
    },

    _setupSettings: function () {
        this.news_sources = this.settings.getValue("news_sources") || [];
        this.tickerSeperator = "*******";
        this.update_interval = this.settings.getValue("update_interval") || 15;
        this.scroll_speed = this.settings.getValue("scroll_speed") || 30;
        this.width_multiplier = this.settings.getValue("width_multiplier") || 8.5;
        this.scroll_limit = this.settings.getValue("scroll_limit") || 30;
        this.vertical_offset = this.settings.getValue("vertical_offset") || 5;

        this.settings.bindProperty(Settings.BindingDirection.IN, 'news_sources', 'news_sources', this._updateFeed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'update_interval', 'update_interval', this._updateFeed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'scroll_speed', 'scroll_speed');
        this.settings.bindProperty(Settings.BindingDirection.IN, 'width_multiplier', 'width_multiplier', this._setWidth, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'scroll_limit', 'scroll_limit');
        this.settings.bindProperty(Settings.BindingDirection.IN, 'vertical_offset', 'vertical_offset', this._updateLabelStyle, null);
    },

    _setWidth: function () {
        let width_px = Math.round(this.width_multiplier * 15); // multiplier mantığı
        this.actor.set_style("width: " + width_px + "px;");
        this.actor.x_align = St.Align.MIDDLE;
        this.tickerCharacters = Math.floor(width_px / 7);
    },

    _updateLabelStyle: function () {
        let offset = this.vertical_offset || 0;
        this.actor.set_style(this.actor.get_style() + `margin-top: ${offset}px;`);
    },

    _formatTime: function (date) {
        let h = date.getHours().toString().padStart(2, "0");
        let m = date.getMinutes().toString().padStart(2, "0");
        return `[${h}:${m}]`;
    },

    _updateFeed: function () {
        // Tüm kaynaklardan haberleri çek
        this._allNews = [];
        let sources = this.news_sources || [];
        if (!sources.length) {
            this._tickerText = _("No RSS source configured");
            this._buildMenu();
            return;
        }

        let completed = 0;
        let total = sources.length;
        sources.forEach(source => {
            let session = new Soup.Session();
            let msg = Soup.Message.new("GET", source.url.trim());

            session.send_and_read_async(msg, 0, null, (s, res) => {
                try {
                    let bytes = s.send_and_read_finish(res);
                    if (!bytes) return;

                    let xml = new TextDecoder("utf-8").decode(bytes.get_data());
                    let items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

                    items.forEach(item => {
                        const title = item.match(/<title>(.*?)<\/title>/)?.[1] || "No Title";
                        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "#";
                        let pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
                        let dateObj = pubDate ? new Date(pubDate) : new Date();

                        this._allNews.push({
                            title: title,
                            link: link,
                            date: dateObj,
                            source: source.label || "RSS"
                        });
                    });
                } catch (e) {
                    global.logError("Error while loading RSS: " + e.message);
                } finally {
                    completed++;
                    if (completed === total) {
                        // Tüm kaynaklar bittiğinde devam et
                        this._allNews.sort((a, b) => b.date - a.date); // tarihe göre sırala (en yeni başta)
                        this._buildMenu();
                    }
                }
            });
        });
    },

    _buildMenu: function () {
        this.menu.removeAll();

        if (this._allNews.length === 0) return;

        const menuSection = new PopupMenu.PopupMenuSection({ style_class: "popup-menu-section" });

        const scrollView = new St.ScrollView({
            x_fill: true,
            y_fill: true,
            style_class: "scrollView",
            clip_to_allocation: true
        });
        scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);

        const menuContainer = new St.BoxLayout({ vertical: true, style_class: "menuBox" });
        scrollView.add_actor(menuContainer);

        // En güncel 15 haber
        this._allNews.slice(0, 15).forEach(item => {
            let timeStr = this._formatTime(item.date);
            let prefix = `${timeStr}[${item.source}] `;

            let maxLen = 100;
            let displayTitle = item.title;
            if (displayTitle.length > maxLen) {
                displayTitle = displayTitle.substring(0, maxLen) + "...";
            }

            let fullText = prefix + displayTitle;

            let btn = new St.Button({ reactive: true, track_hover: true, style_class: "menuButton", x_align: St.Align.START });

            let box = new St.BoxLayout({ vertical: false, style_class: "buttonBox" });

            let icon = new St.Icon({
                gicon: Gio.icon_new_for_string(this.metadata.path + "/icon.png"),
                icon_size: 18,
                style_class: "popup-menu-icon"
            });
            box.add_actor(icon);

            let titleLabel = new St.Label({ text: fullText, style_class: "popup-menu-item-title" });
            box.add_actor(titleLabel);

            btn.add_actor(box);

            btn.connect("clicked", () => { Gio.app_info_launch_default_for_uri(item.link, null); });

            menuContainer.add_child(btn);
        });

        menuSection.actor.add_actor(scrollView);
        this.menu.addMenuItem(menuSection);
    },

    _tickerLoop: function () {
        // Ticker headline’ları güncel ve sıralı şekilde birleştir
        if (this._allNews.length > 0) {
            const chainedHeadlines = this._allNews
                .slice(0, 15)
                .map(item => `[${this._formatTime(item.date)}][${item.source}] ${item.title}`);
            this._tickerText = chainedHeadlines.join(' ' + this.tickerSeperator + ' ');
        }

        const textWindow = this._tickerText.substring(this._tickerPosition, this._tickerPosition + this.scroll_limit);

        this.set_applet_label(textWindow);

        this._tickerPosition += 1;

        if (this._tickerPosition >= this._tickerText.length) {
            this._tickerPosition = 0;
        }

        Mainloop.timeout_add(this.scroll_speed, Lang.bind(this, this._tickerLoop));
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
