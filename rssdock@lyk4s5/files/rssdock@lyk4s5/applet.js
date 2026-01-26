const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Soup = imports.gi.Soup;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;

class MyApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this.instance_id = instance_id;

        this.set_applet_icon_path(this.metadata.path + "/icon.png");
        if (this._applet_label) this._applet_label.hide();

        /* ===== DISPLAY BOX ===== */
        this._display_bin = new St.Bin({
            clip_to_allocation: true,
            x_fill: true,
            y_fill: true,
            x_align: St.Align.START,
            y_align: St.Align.MIDDLE
        });
        this.actor.add_actor(this._display_bin);

        /* ===== SCROLL LABEL ===== */
        this._scroll_label = new St.Label({
            text: "",
            style_class: "rss-label"
        });
        this._scroll_label.clutter_text.line_wrap = false;
        this._display_bin.set_child(this._scroll_label);

        /* ===== STATE ===== */
        this._scroll_x = 0;
        this._content_width = 0;
        this._ticker_id = 0;
        this._all_news_items = [];
        this._full_title = "Haberler yukleniyor...";

        /* ===== MENU ===== */
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        /* ===== SETTINGS ===== */
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "news_sources",
            "news_sources",
            this.update_news.bind(this),
            null
        );

        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "update_interval",
            "update_interval",
            this.update_news.bind(this),
            null
        );

        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "scroll_speed",
            "scroll_speed",
            null,
            null
        );

        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "scroll_limit",
            "scroll_limit",
            this._set_width.bind(this),
            null
        );

        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "width_multiplier",
            "width_multiplier",
            this._set_width.bind(this),
            null
        );

        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "vertical_offset",
            "vertical_offset",
            this._on_vertical_offset_changed.bind(this),
            null
        );

        this._set_width();
        this._on_vertical_offset_changed();

        Mainloop.timeout_add(1000, () => {
            this.update_news();
            this._run_ticker();
        });
    }

    /* ===== WIDTH CONTROL (VISIBLE CHARACTERS) ===== */
    _set_width() {
        let chars = this.scroll_limit || 30;
        let multiplier = this.width_multiplier || 8.5;

        let width = Math.round(chars * multiplier);

        this._display_bin.set_width(width);
        this._display_bin.set_height(this._panelHeight);

        // ticker reset
        this._scroll_x = width;
        this._content_width = 0;

        global.logError(`[RSSDock] Box width: ${width}px (${chars} × ${multiplier})`);
    }

    _on_vertical_offset_changed() {
        this._scroll_label.set_style(
            "white-space: nowrap; margin-top: " + (this.vertical_offset || 0) + "px;"
        );
    }

    _format_time(d) {
        return `[${d.getHours().toString().padStart(2, "0")}:${d
            .getMinutes()
            .toString()
            .padStart(2, "0")}]`;
    }

    /* ===== RSS UPDATE ===== */
    update_news() {
        if (this._updateLoopId) Mainloop.source_remove(this._updateLoopId);

        let sources = this.news_sources || [];
        if (!sources.length) {
            this._full_title = "RSS kaynagi eklenmedi";
            this._apply_new_text();
            return;
        }

        this._all_news_items = [];
        let completed = 0;

        sources.forEach(source => {
            let session = new Soup.Session();
            let msg = Soup.Message.new("GET", source.url.trim());

            session.send_and_read_async(msg, 0, null, (s, res) => {
                try {
                    let bytes = s.send_and_read_finish(res);
                    if (!bytes) return;

                    let xml = new TextDecoder("utf-8").decode(bytes.get_data());
                    let items = xml.match(/<(item|entry)[\s\S]*?>[\s\S]*?<\/\1>/gi) || [];

                    items.forEach(item => {
                        let t = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                        let d =
                            item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) ||
                            item.match(/<updated>([\s\S]*?)<\/updated>/i);

                        if (!t) return;

                        let title = t[1]
                            .replace(/<!\[CDATA\[|\]\]>/g, "")
                            .replace(/<[^>]+>/g, "")
                            .trim();

                        let date = d ? new Date(d[1]) : new Date();

                        this._all_news_items.push({
                            title,
                            date,
                            source: source.label || "RSS",
                            time: this._format_time(date)
                        });
                    });
                } catch (e) {
                    global.logError(e);
                } finally {
                    completed++;
                    if (completed === sources.length) this._rebuild_ui();
                }
            });
        });

        this._updateLoopId = Mainloop.timeout_add_seconds(
            (this.update_interval || 15) * 60,
            this.update_news.bind(this)
        );
    }

    /* ===== UI ===== */
    _rebuild_ui() {
        this.menu.removeAll();

        let refresh = new PopupMenu.PopupMenuItem("🔄 Yenile");
        refresh.connect("activate", this.update_news.bind(this));
        this.menu.addMenuItem(refresh);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (!this._all_news_items.length) {
            this._full_title = "Haber bulunamadi";
            this._apply_new_text();
            return;
        }

        this._all_news_items.sort((a, b) => b.date - a.date);
        let top = this._all_news_items[0];

        this._full_title = `${top.time}[${top.source}] ${top.title}`;
        this._apply_new_text();

        this._all_news_items.slice(0, 10).forEach(item => {
            let txt = `${item.time}[${item.source}] ${item.title}`;
            if (txt.length > 80) txt = txt.substring(0, 77) + "...";

            let mi = new PopupMenu.PopupMenuItem(txt);
            this.menu.addMenuItem(mi);
        });
    }

    _apply_new_text() {
        this._scroll_label.set_text(this._full_title);
        this._scroll_x = this._display_bin.width;
        this._content_width = 0;
    }

    /* ===== TICKER LOOP ===== */
    _run_ticker() {
        if (this._ticker_id) Mainloop.source_remove(this._ticker_id);

        if (this._content_width === 0) {
            let [, natW] = this._scroll_label.get_preferred_width(-1);
            if (natW > 10) this._content_width = natW;
        }

        this._scroll_x -= 2;

        if (this._scroll_x <= -this._content_width) {
            this._scroll_x = this._display_bin.width;
        }

        this._scroll_label.translation_x = this._scroll_x;

        let speed = Math.max(16, this.scroll_speed || 30);
        this._ticker_id = Mainloop.timeout_add(speed, () => this._run_ticker());
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_panel_height_changed() {
        this._set_width();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
