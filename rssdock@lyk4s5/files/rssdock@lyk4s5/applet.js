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
        this.set_applet_label(_("Loading..."));

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this._setupSettings();

        this._allNews = [];
        this._tickerText = "";
        this._tickerPosition = 0;
        
        this._refreshLoopId = null; // Güncelleme döngüsü ID'si
        this._tickerLoopId = null;  // Kayma döngüsü ID'si

        // Menü kurulumu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._setWidth();
        this._updateFeed(); // İlk veriyi çek ve döngüyü başlat
        this._tickerLoop(); // Yazı kaydırmayı başlat
    },

    _setupSettings: function () {
        this.settings.bindProperty(Settings.BindingDirection.IN, 'news_sources', 'news_sources', this._updateFeed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'update_interval', 'update_interval', this._updateFeed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'scroll_speed', 'scroll_speed');
        this.settings.bindProperty(Settings.BindingDirection.IN, 'width_multiplier', 'width_multiplier', this._setWidth, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'scroll_limit', 'scroll_limit');
        this.settings.bindProperty(Settings.BindingDirection.IN, 'vertical_offset', 'vertical_offset', this._updateLabelStyle, null);
    },

    _setWidth: function () {
        let width_px = Math.round(this.width_multiplier * 15);
        this.actor.set_style("width: " + width_px + "px;");
        this.actor.x_align = St.Align.MIDDLE;
        this.tickerCharacters = Math.floor(width_px / 7);
    },

    _updateLabelStyle: function () {
        let offset = this.vertical_offset || 0;
        let currentStyle = this.actor.get_style() || "";
        // Mevcut stilde margin varsa temizle ve yenisini ekle
        this.actor.set_style(currentStyle.replace(/margin-top:[^;]+;?/g, "") + `margin-top: ${offset}px;`);
    },

    _formatTime: function (date) {
        let h = date.getHours().toString().padStart(2, "0");
        let m = date.getMinutes().toString().padStart(2, "0");
        return `[${h}:${m}]`;
    },

    _updateFeed: function () {
        // Eğer çalışan bir döngü varsa önce onu iptal et (Mükerrer çalışmayı önler)
        if (this._refreshLoopId) {
            Mainloop.source_remove(this._refreshLoopId);
            this._refreshLoopId = null;
        }

        let sources = this.news_sources || [];
        if (sources.length === 0) {
            this._tickerText = _("No RSS source");
            this._allNews = [];
            this._buildMenu();
            this._scheduleUpdate(); // Boş olsa da kontrol etmeye devam et
            return;
        }

        let completed = 0;
        let total = sources.length;
        let newNewsStore = [];

        sources.forEach(source => {
            let session = new Soup.Session();
            // Zaman aşımı ekleyelim ki asılı kalmasın
            session.timeout = 10;
            let msg = Soup.Message.new("GET", source.url.trim());

            session.send_and_read_async(msg, 0, null, (s, res) => {
                try {
                    let bytes = s.send_and_read_finish(res);
                    if (bytes) {
                        let xml = new TextDecoder("utf-8").decode(bytes.get_data());
                        let items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

                        items.forEach(item => {
                            const title = item.match(/<title>(.*?)<\/title>/)?.[1] || "No Title";
                            // XML entity'lerini temizle (basitçe)
                            let cleanTitle = title.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
                            const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "#";
                            let pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
                            
                            newNewsStore.push({
                                title: cleanTitle,
                                link: link,
                                date: pubDate ? new Date(pubDate) : new Date(),
                                source: source.label || "RSS"
                            });
                        });
                    }
                } catch (e) {
                    global.logError("RSS Fetch Error: " + e.message);
                } finally {
                    completed++;
                    if (completed === total) {
                        this._allNews = newNewsStore.sort((a, b) => b.date - a.date);
                        this._buildMenu();
                        this._scheduleUpdate(); // Her şey bitince sonraki turu planla
                    }
                }
            });
        });
    },

    _scheduleUpdate: function() {
        // update_interval dakika cinsinden, saniyeye çeviriyoruz
        let interval = Math.max(1, this.update_interval || 5) * 60;
        this._refreshLoopId = Mainloop.timeout_add_seconds(interval, Lang.bind(this, this._updateFeed));
    },

    _buildMenu: function () {
        this.menu.removeAll();
        if (this._allNews.length === 0) return;

        const menuSection = new PopupMenu.PopupMenuSection();
        const scrollView = new St.ScrollView({ x_fill: true, y_fill: true, style_class: "scrollView" });
        scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);

        const menuContainer = new St.BoxLayout({ vertical: true });
        scrollView.add_actor(menuContainer);

        this._allNews.slice(0, 20).forEach(item => {
            let fullText = `${this._formatTime(item.date)} [${item.source}] ${item.title}`;
            let btn = new St.Button({ 
                label: fullText, 
                style_class: "menu-category-button", // Standart tarza yakın durur
                x_align: St.Align.START 
            });

            btn.connect("clicked", () => { 
                Gio.app_info_launch_default_for_uri(item.link, null);
                this.menu.close();
            });

            menuContainer.add_child(btn);
        });

        menuSection.actor.add_actor(scrollView);
        this.menu.addMenuItem(menuSection);
    },

    _tickerLoop: function () {
        if (this._allNews.length > 0) {
            const chainedHeadlines = this._allNews
                .slice(0, 15)
                .map(item => `[${item.source}] ${item.title}`);
            this._tickerText = chainedHeadlines.join(' ' + this.tickerSeperator + ' ') + ' ' + this.tickerSeperator + ' ';
        }

        if (this._tickerText.length > 0) {
            let display = "";
            if (this._tickerText.length <= this.scroll_limit) {
                display = this._tickerText;
            } else {
                display = this._tickerText.substring(this._tickerPosition, this._tickerPosition + this.scroll_limit);
                // Eğer sona yaklaştıysak başını ekle (kesintisiz döngü efekti)
                if (display.length < this.scroll_limit) {
                    display += this._tickerText.substring(0, this.scroll_limit - display.length);
                }
            }
            this.set_applet_label(display);
            this._tickerPosition++;
            if (this._tickerPosition >= this._tickerText.length) this._tickerPosition = 0;
        }

        // Ticker hızını koru
        this._tickerLoopId = Mainloop.timeout_add(this.scroll_speed, Lang.bind(this, this._tickerLoop));
        return false; // Loop'un kendi kendini tekrar etmesini Mainloop üzerinden kontrol ediyoruz
    },

    on_applet_clicked: function () {
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function () {
        if (this._refreshLoopId) Mainloop.source_remove(this._refreshLoopId);
        if (this._tickerLoopId) Mainloop.source_remove(this._tickerLoopId);
        this.settings.finalize();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
