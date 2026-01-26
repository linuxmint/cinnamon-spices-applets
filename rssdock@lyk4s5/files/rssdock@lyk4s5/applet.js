const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Soup = imports.gi.Soup;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
// Cinnamon 6.x için TextDecoder globaldir, import gerekmez ama GLib kullanılabilir
const GLib = imports.gi.GLib; 

class MyApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        
        try {
            this.metadata = metadata;
            this.instance_id = instance_id;

            let iconPath = this.metadata.path + "/icon.png";
            this.set_applet_icon_path(iconPath);

            this._full_title = "Loading...";
            this._scroll_x = 0;
            this._ticker_id = 0;
            this._all_news_items = [];

            if (this._applet_label) this._applet_label.hide();
            
            // Taşıyıcı Kutu
            this._display_bin = new St.Bin({ 
                clip_to_allocation: true, 
                style: "margin-left: 2px;",
                y_fill: true,
                x_fill: false, 
                y_align: St.Align.MIDDLE
            });
            this.actor.add_actor(this._display_bin);

            // Yazı Etiketi
            this._scroll_label = new St.Label({ 
                text: this._full_title,
                style_class: "rss-label"
            });
            
            this._scroll_label.clutter_text.ellipsize = 0; 
            this._scroll_label.clutter_text.line_wrap = false; 

            this._display_bin.set_child(this._scroll_label);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // Ayarlar
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN, "news_sources", "news_sources", this.update_news.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "update_interval", "update_interval", this.update_news.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "scroll_speed", "scroll_speed", null, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "scroll_limit", "scroll_limit", this._on_layout_changed.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "width_multiplier", "width_multiplier", this._on_layout_changed.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "vertical_offset", "vertical_offset", this._on_vertical_offset_changed.bind(this), null);
            
            this._on_layout_changed();
            this._on_vertical_offset_changed();
            
            // Başlangıç gecikmesi
            Mainloop.timeout_add(1500, () => {
                this.update_news();
                this._run_ticker();
            });

        } catch (e) {
            global.logError("[RSSDock] Constructor Error: " + e);
        }
    }

    _on_vertical_offset_changed() {
        this._scroll_label.set_style("white-space: nowrap; margin-top: " + (this.vertical_offset || 0) + "px;");
    }

    _on_layout_changed() {
        let target_width = (this.scroll_limit || 30) * (this.width_multiplier || 8.5);
        this._display_bin.set_width(target_width);
        this._display_bin.set_height(this._panelHeight); 
    }

    _format_time(dateObj) {
        try {
            let h = dateObj.getHours().toString().padStart(2, '0');
            let m = dateObj.getMinutes().toString().padStart(2, '0');
            return "[" + h + ":" + m + "]";
        } catch (e) { return "[00:00]"; }
    }

    update_news() {
        if (this._updateLoopId) Mainloop.source_remove(this._updateLoopId);

        let sources = this.news_sources;
        if (!sources || sources.length === 0) {
            this._full_title = "Please Add RSS to Settings!";
            this._all_news_items = [];
            this._rebuild_ui();
            return;
        }

        this._all_news_items = [];
        this._full_title = "Güncelleniyor...";
        
        let completed_requests = 0;
        let total_sources = sources.length;

        sources.forEach((source) => {
            if (!source || !source.url) {
                completed_requests++;
                if (completed_requests === total_sources) this._rebuild_ui();
                return;
            }

            let session = new Soup.Session();
            session.user_agent = "Mozilla/5.0 (X11; Linux x86_64) RSSDock/1.0"; 
            session.timeout = 10;
            
            // TRT gibi siteler query parametresini sevmeyebilir, temiz URL deneyelim
            let url = source.url.trim();
            // let freshUrl = url + (url.includes("?") ? "&" : "?") + "cb=" + Date.now(); 
            // Cache buster'ı kapattım, bazı sunucular 404 veriyor
            
            let message = Soup.Message.new('GET', url);
            
            session.send_and_read_async(message, 0, null, (session, result) => {
                try {
                    let bytes = session.send_and_read_finish(result);
                    
                    // --- KRİTİK DÜZELTME: TextDecoder ---
                    let decoder = new TextDecoder('utf-8');
                    let xml = decoder.decode(bytes.get_data()); // Byte'ı String'e çevir
                    
                    // Basit Regex
                    let items = xml.match(/<(item|entry)[\s\S]*?>[\s\S]*?<\/\1>/gi);
                    
                    if (items) {
                        items.forEach(item => {
                            let titleMatch = item.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i);
                            let linkMatch = item.match(/<(link|guid)[\s\S]*?>([\s\S]*?)<\/\1>/i);
                            
                            if (titleMatch) {
                                let title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
                                let link = "";
                                if (linkMatch) {
                                    link = linkMatch[0].includes("href=") ? 
                                           linkMatch[0].match(/href="([^"]+)"/i)[1] : 
                                           linkMatch[2].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
                                }
                                this._all_news_items.push({
                                    title: title, link: link, source: source.label || "RSS", date: new Date(), timeStr: this._format_time(new Date())
                                });
                            }
                        });
                    } else {
                        global.logError("[RSSDock] XML ayrıştırılamadı veya boş: " + url);
                    }
                } catch (e) {
                    global.logError("[RSSDock] Fetch/Parse Error (" + url + "): " + e);
                } finally {
                    completed_requests++;
                    if (completed_requests === total_sources) {
                        this._rebuild_ui();
                    }
                }
            });
        });

        this._updateLoopId = Mainloop.timeout_add_seconds((this.update_interval || 15) * 60, this.update_news.bind(this));
    }

    _rebuild_ui() {
        try {
            this.menu.removeAll();
            let refreshItem = new PopupMenu.PopupMenuItem("🔄 Yenile");
            refreshItem.connect('activate', this.update_news.bind(this));
            this.menu.addMenuItem(refreshItem);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            if (this._all_news_items.length > 0) {
                // Karışık gelmemesi için sırala
                this._all_news_items.sort((a, b) => b.date - a.date);
                
                let top = this._all_news_items[0];
                this._full_title = top.timeStr + " [" + top.source + "] " + top.title;

                let limit = Math.min(this._all_news_items.length, 30);
                for (let i = 0; i < limit; i++) {
                    let item = this._all_news_items[i];
                    let menuItem = new PopupMenu.PopupMenuItem(item.timeStr + " " + item.title);
                    menuItem.connect('activate', () => {
                        if (item.link) Gio.app_info_launch_default_for_uri(item.link, null);
                    });
                    this.menu.addMenuItem(menuItem);
                }
            } else {
                this._full_title = "Haber bulunamadı.";
            }
        } catch (err) {
            global.logError("[RSSDock] UI Error: " + err);
        }
    }

    _run_ticker() {
        if (this._ticker_id) Mainloop.source_remove(this._ticker_id);
        
        let spacer = "          *** ";
        let combined = this._full_title + spacer;
        
        if (this._scroll_label.get_text() !== (combined + combined)) {
             this._scroll_label.set_text(combined + combined);
        }

        let totalWidth = this._scroll_label.get_width();
        let resetPoint = totalWidth / 2;

        if (resetPoint > 0) {
            this._scroll_x -= 1;
            if (Math.abs(this._scroll_x) >= resetPoint) {
                this._scroll_x = 0;
            }
            this._scroll_label.translation_x = this._scroll_x;
        }

        let speed = Math.max(10, this.scroll_speed || 30);
        this._ticker_id = Mainloop.timeout_add(speed, this._run_ticker.bind(this));
    }

    on_applet_clicked(event) { this.menu.toggle(); }
    on_panel_height_changed() { this._on_layout_changed(); }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
