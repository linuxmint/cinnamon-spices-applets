const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        try {
            this.metadata = metadata;
            Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
            
            // 1. İKON YÜKLEME
            let iconPath = this.metadata.path + "/icons/rss.png";
            this.set_applet_icon_path(iconPath);

            this._full_title = "Haberler taranıyor...";
            this._scroll_x = 0;
            this._ticker_id = 0;
            this._all_news_items = [];

            if (this._applet_label) this._applet_label.hide();
            
            // 2. YAZI TÜNELİ (Widget: Hareket için özgür alan tanır)
            this._display_bin = new St.Widget({ 
                clip_to_allocation: true, 
                style: "margin-left: 2px;" // Paneli bozmayacak kadar küçük bir boşluk
            });
            this.actor.add_actor(this._display_bin);

            this._scroll_label = new St.Label({ 
                text: this._full_title,
                style: "white-space: nowrap;" 
            });
            this._display_bin.add_actor(this._scroll_label);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN, "news_sources", "news_sources", this.update_news, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "update_interval", "update_interval", this.update_news, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "scroll_speed", "scroll_speed", null, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "scroll_limit", "scroll_limit", this._on_layout_changed, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "width_multiplier", "width_multiplier", this._on_layout_changed, null);
            
            this._on_layout_changed();
            this.update_news();
            this._run_ticker();
        } catch (e) { log("[HaberDock] Hata: " + e); }
    },

    _on_layout_changed: function() {
        let target_width = (this.scroll_limit || 30) * (this.width_multiplier || 8.5);
        this._display_bin.set_width(target_width);
        this._display_bin.set_height(this._panelHeight || 40);
    },

    _format_time: function(dateObj) {
        let h = dateObj.getHours().toString().padStart(2, '0');
        let m = dateObj.getMinutes().toString().padStart(2, '0');
        return "[" + h + ":" + m + "]";
    },

    update_news: function() {
        let sources = this.news_sources;
        if (!sources || sources.length === 0) return;
        this._all_news_items = [];
        let completed_requests = 0;

        sources.forEach((source) => {
            let session = new Soup.Session();
            let freshUrl = source.url + (source.url.includes("?") ? "&" : "?") + "cb=" + Date.now();
            let message = Soup.Message.new('GET', freshUrl);
            
            session.send_and_read_async(message, 0, null, (session, result) => {
                try {
                    let bytes = session.send_and_read_finish(result);
                    let xml = bytes.get_data().toString();
                    let items = xml.match(/<item[\s\S]*?>[\s\S]*?<\/item>/gi);
                    if (items) {
                        items.forEach(item => {
                            let titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
                            let linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);
                            let dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
                            if (titleMatch && linkMatch) {
                                let title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
                                let link = linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
                                let d = dateMatch ? new Date(dateMatch[1]) : new Date();
                                let dateObj = isNaN(d.getTime()) ? new Date() : d;
                                this._all_news_items.push({
                                    title: title, link: link, source: source.label, date: dateObj, timeStr: this._format_time(dateObj)
                                });
                            }
                        });
                    }
                } catch (e) {}
                completed_requests++;
                if (completed_requests === sources.length) this._rebuild_ui();
            });
        });
        if (this._updateLoopId) Mainloop.source_remove(this._updateLoopId);
        this._updateLoopId = Mainloop.timeout_add_seconds((this.update_interval || 15) * 60, Lang.bind(this, this.update_news));
    },

    _rebuild_ui: function() {
        try {
            this._all_news_items.sort((a, b) => b.date.getTime() - a.date.getTime());
            this.menu.removeAll();

            let refreshItem = new PopupMenu.PopupMenuItem("🔄 Listeyi Şimdi Güncelle");
            refreshItem.connect('activate', Lang.bind(this, this.update_news));
            this.menu.addMenuItem(refreshItem);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            if (this._all_news_items.length > 0) {
                let top = this._all_news_items[0];
                this._full_title = top.timeStr + " [" + top.source + "] " + top.title;

                let limit = Math.min(this._all_news_items.length, 25);
                for (let i = 0; i < limit; i++) {
                    let item = this._all_news_items[i];
                    let label = item.timeStr + " [" + item.source + "] " + item.title;
                    let displayText = label.length > 65 ? label.substring(0, 62) + "..." : label;
                    let menuItem = new PopupMenu.PopupMenuItem(displayText);
                    menuItem.connect('activate', () => Gio.app_info_launch_default_for_uri(item.link, null));
                    this.menu.addMenuItem(menuItem);
                }
            }
        } catch (err) { log("[HaberDock] UI Hatası: " + err); }
    },

    _run_ticker: function() {
        if (this._ticker_id) Mainloop.source_remove(this._ticker_id);
        
        let spacer = "          *** ";
        let combined = this._full_title + spacer;
        this._scroll_label.set_text(combined + combined);

        let [min, totalWidth] = this._scroll_label.get_preferred_width(-1);
        let resetPoint = totalWidth / 2;

        if (resetPoint > 0) {
            this._scroll_x -= 1;
            if (Math.abs(this._scroll_x) >= resetPoint) {
                this._scroll_x = 0;
            }
            // St.Widget içinde bu komut artık çalışır:
            this._scroll_label.set_x(this._scroll_x);
        }

        this._ticker_id = Mainloop.timeout_add(this.scroll_speed || 30, Lang.bind(this, this._run_ticker));
    },

    on_applet_clicked: function(event) { this.menu.toggle(); }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}