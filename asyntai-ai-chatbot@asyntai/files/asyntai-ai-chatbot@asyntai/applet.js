// Asyntai AI Chatbot applet for Cinnamon.
// Copyright (c) Asyntai. Licensed under the MIT license.
//
// The applet talks only to the public Asyntai API (https://asyntai.com/api/v1/)
// with the API key the user pastes in the applet settings. The key leaves the
// machine only in the Authorization header of those calls.

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;
const Pango = imports.gi.Pango;
const ByteArray = imports.byteArray;
const Gettext = imports.gettext;

const UUID = "asyntai-ai-chatbot@asyntai";
const BASE_URL = "https://asyntai.com";
const USER_AGENT = "AsyntaiCinnamon/1.0";
const LIST_SIZE = 50;
const MENU_ROWS = 10;
const TIMEOUT_SECONDS = 60;
const SOUP3 = Soup.MAJOR_VERSION === 3;

// Questions asked from this applet go through the same API as a visitor chat,
// so Asyntai stores them as chats. They are the owner's own questions, so the
// chat list leaves them out. The other Asyntai launchers mark theirs the same way.
const ASK_MARKER = "cinnamon_ask_";
const OWN_MARKERS = [ASK_MARKER, "flow_ask_", "cmdpal_ask_", "raycast_ask_", "ext_ask_"];

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
    return Gettext.dgettext(UUID, text);
}

function ngettext(singular, plural, n) {
    return Gettext.dngettext(UUID, singular, plural, n);
}

function str(row, name) {
    if (!row || typeof row !== "object")
        return "";
    let value = row[name];
    if (typeof value === "number")
        return String(value);
    return typeof value === "string" ? value : "";
}

function rows(root, name) {
    let list = root && Array.isArray(root[name]) ? root[name] : [];
    return list.filter(r => r && typeof r === "object");
}

function isOwnQuestion(sessionId) {
    if (!sessionId)
        return false;
    // The chat API stores a caller's session id as "api_" + the id.
    let sid = sessionId.startsWith("api_") ? sessionId.slice(4) : sessionId;
    return OWN_MARKERS.some(marker => sid.startsWith(marker));
}

function timeOf(value) {
    let t = Date.parse(value || "");
    return isNaN(t) ? 0 : t;
}

function ago(value) {
    let t = timeOf(value);
    if (!t)
        return "";
    let minutes = Math.floor((Date.now() - t) / 60000);
    if (minutes < 1)
        return _("just now");
    if (minutes < 60)
        return ngettext("%d minute ago", "%d minutes ago", minutes).format(minutes);
    let hours = Math.floor(minutes / 60);
    if (hours < 24)
        return ngettext("%d hour ago", "%d hours ago", hours).format(hours);
    let days = Math.floor(hours / 24);
    return ngettext("%d day ago", "%d days ago", days).format(days);
}

function joined(parts) {
    return parts.filter(p => p).join("  ·  ");
}

function shorten(text, max) {
    let clean = (text || "").replace(/\s+/g, " ").trim();
    return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

function newAskSession() {
    let hex = GLib.uuid_string_random().replace(/-/g, "").slice(0, 6);
    return ASK_MARKER + Date.now() + "_" + hex;
}


class AsyntaiClient {
    constructor() {
        this._session = new Soup.Session();
        this._session.user_agent = USER_AGENT;
        this._session.timeout = TIMEOUT_SECONDS;
        this.apiKey = "";
        // True after the last call failed because the key is missing or refused.
        this.keyProblem = false;
    }

    get hasKey() {
        return this.apiKey.trim().length > 0;
    }

    chatUrl(sessionId) {
        return BASE_URL + "/chat/" + encodeURIComponent(sessionId) + "/";
    }

    sessions(callback) {
        this._get("/api/v1/sessions/?limit=" + LIST_SIZE, (error, root) => {
            if (error)
                return callback(error, []);
            let list = rows(root, "sessions").filter(s => !isOwnQuestion(str(s, "session_id")));
            callback(null, list);
        });
    }

    leads(callback) {
        this._get("/api/v1/leads/?limit=" + LIST_SIZE, (error, root) => {
            callback(error, error ? [] : rows(root, "leads"));
        });
    }

    tickets(callback) {
        this._get("/api/v1/tickets/?limit=" + LIST_SIZE, (error, root) => {
            callback(error, error ? [] : rows(root, "tickets"));
        });
    }

    ask(question, sessionId, callback) {
        let body = { message: question, session_id: sessionId };
        this._send("POST", "/api/v1/chat/", body, (error, root) => {
            callback(error, error ? "" : str(root, "response"));
        });
    }

    abort() {
        this._session.abort();
    }

    _get(path, callback) {
        this._send("GET", path, null, callback);
    }

    _send(method, path, body, callback) {
        if (!this.hasKey) {
            this.keyProblem = true;
            callback(_("Add your Asyntai API key in the applet settings."), null);
            return;
        }
        this.keyProblem = false;

        let message = Soup.Message.new(method, BASE_URL + path);
        if (!message) {
            callback(_("Asyntai did not answer. Check your connection."), null);
            return;
        }
        message.request_headers.append("Authorization", "Bearer " + this.apiKey.trim());
        message.request_headers.append("Accept", "application/json");

        let json = body === null ? null : JSON.stringify(body);

        if (SOUP3) {
            if (json !== null) {
                let bytes = new GLib.Bytes(ByteArray.fromString(json));
                message.set_request_body_from_bytes("application/json", bytes);
            }
            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                let text = "";
                try {
                    let bytes = session.send_and_read_finish(result);
                    let data = bytes ? bytes.get_data() : null;
                    text = data ? ByteArray.toString(data) : "";
                } catch (e) {
                    callback(_("Asyntai did not answer. Check your connection."), null);
                    return;
                }
                this._finish(message.get_status(), text, callback);
            });
        } else {
            if (json !== null)
                message.set_request("application/json", Soup.MemoryUse.COPY, json);
            this._session.queue_message(message, (session, msg) => {
                let text = msg.response_body && msg.response_body.data ? msg.response_body.data : "";
                this._finish(msg.status_code, text, callback);
            });
        }
    }

    _finish(status, text, callback) {
        if (!status || status < 100) {
            callback(_("Asyntai did not answer. Check your connection."), null);
            return;
        }

        let root = null;
        try {
            root = text.trim() ? JSON.parse(text) : {};
        } catch (e) {
            root = null;
        }
        let error = root && typeof root === "object" ? str(root, "error") : "";

        this.keyProblem = status === 401;
        if (status === 401) {
            callback(_("Asyntai no longer accepts this API key. Paste a new key in the applet settings."), null);
            return;
        }
        if (status === 403) {
            callback(error || _("The Asyntai API needs the Starter plan or higher."), null);
            return;
        }
        if (status === 429) {
            callback(error || _("Your chatbot reached its message limit."), null);
            return;
        }
        let failed = root && typeof root === "object" && root.success === false;
        if (status >= 400 || failed || !root || typeof root !== "object") {
            callback(error || _("Asyntai answered with status %d.").format(status), null);
            return;
        }
        callback(null, root);
    }
}


class AsyntaiApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._timerId = 0;
        this._generation = 0;
        this._askSession = "";
        this._lastAnswer = "";
        this._newestChatSeenByPoll = 0;
        this._newestLeadSeenByPoll = 0;
        this._newChats = 0;
        this._removed = false;

        this.client = new AsyntaiClient();

        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        this.settings.bind("api-key", "apiKey", this._onKeyChanged);
        this.settings.bind("refresh-minutes", "refreshMinutes", this._restartTimer);
        this.settings.bind("show-count", "showCount", this._updatePanel);
        this.settings.bind("notify", "notifyNew", null);
        this.settings.bind("seen-chats", "seenChats", null);
        this.settings.bind("seen-leads", "seenLeads", null);
        this.client.apiKey = this.apiKey || "";

        this._iconFile = Gio.File.new_for_path(metadata.path + "/icon.png");
        this.set_applet_icon_path(metadata.path + "/icon.png");
        this.set_applet_tooltip(_("Asyntai AI Chatbot"));
        this.hide_applet_label(true);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._buildMenu();
        this.menu.connect("open-state-changed", (menu, open) => this._onMenuToggled(open));

        this._restartTimer();
        this._poll();
    }

    // -- menu ------------------------------------------------------------

    _buildMenu() {
        let caption = new PopupMenu.PopupMenuItem(_("Ask your chatbot"), { reactive: false });
        caption.label.style = "font-weight: bold;";
        this.menu.addMenuItem(caption);

        let askItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        // Same look as the search box of the stock Cinnamon menu.
        this.entry = new St.Entry({
            name: "menu-search-entry",
            hint_text: _("Ask your chatbot a question"),
            track_hover: true,
            can_focus: true,
            x_expand: true,
            style: "width: 22em;",
        });
        this.entry.clutter_text.connect("activate", () => this._ask());
        askItem.addActor(this.entry, { expand: true, span: -1 });
        this.menu.addMenuItem(askItem);

        this.answerItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.answerLabel = new St.Label({ text: "", style: "width: 22em;" });
        this.answerLabel.clutter_text.line_wrap = true;
        this.answerLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.answerLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.answerItem.addActor(this.answerLabel, { expand: true, span: -1 });
        this.menu.addMenuItem(this.answerItem);

        this.copyItem = new PopupMenu.PopupIconMenuItem(_("Copy the answer"), "edit-copy-symbolic", St.IconType.SYMBOLIC);
        this.copyItem.connect("activate", () => {
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, this._lastAnswer);
        });
        this.menu.addMenuItem(this.copyItem);

        this.newConversationItem = new PopupMenu.PopupIconMenuItem(_("Start a new conversation"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
        this.newConversationItem.connect("activate", () => {
            this._askSession = "";
            this._lastAnswer = "";
            this._showAnswer("");
        });
        this.menu.addMenuItem(this.newConversationItem);
        this._showAnswer("");

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.statusItem = new PopupMenu.PopupMenuItem("", { reactive: false });
        this.statusItem.label.clutter_text.line_wrap = true;
        this.statusItem.label.style = "width: 22em;";
        this.menu.addMenuItem(this.statusItem);

        this.settingsItem = new PopupMenu.PopupIconMenuItem(_("Open the applet settings"), "preferences-system-symbolic", St.IconType.SYMBOLIC);
        this.settingsItem.connect("activate", () => this.configureApplet());
        this.menu.addMenuItem(this.settingsItem);

        this.chatsMenu = new PopupMenu.PopupSubMenuMenuItem(_("Recent chats"));
        this.menu.addMenuItem(this.chatsMenu);
        this.leadsMenu = new PopupMenu.PopupSubMenuMenuItem(_("Leads"));
        this.menu.addMenuItem(this.leadsMenu);
        this.ticketsMenu = new PopupMenu.PopupSubMenuMenuItem(_("Tickets"));
        this.menu.addMenuItem(this.ticketsMenu);

        // Keep one list open at a time, so the menu stays a usable height.
        let lists = [this.chatsMenu, this.leadsMenu, this.ticketsMenu];
        for (let list of lists) {
            list.menu.connect("open-state-changed", (submenu, open) => {
                if (!open)
                    return;
                for (let other of lists) {
                    if (other !== list)
                        other.menu.close(false);
                }
            });
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let dashboard = new PopupMenu.PopupIconMenuItem(_("Open the Asyntai dashboard"), "web-browser-symbolic", St.IconType.SYMBOLIC);
        dashboard.connect("activate", () => this._openUrl(BASE_URL + "/dashboard/"));
        this.menu.addMenuItem(dashboard);

        let refresh = new PopupMenu.PopupIconMenuItem(_("Refresh"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
        refresh.connect("activate", () => this._refreshLists());
        this.menu.addMenuItem(refresh);

        this._setStatus("");
    }

    _setStatus(text, offerSettings) {
        this.statusItem.label.text = text;
        this.statusItem.actor.visible = text.length > 0;
        this.settingsItem.actor.visible = !!offerSettings;
        let lists = this.client.hasKey && !offerSettings;
        this.chatsMenu.actor.visible = lists;
        this.leadsMenu.actor.visible = lists;
        this.ticketsMenu.actor.visible = lists;
    }

    _showAnswer(text) {
        this.answerLabel.text = text;
        this.answerItem.actor.visible = text.length > 0;
        let answered = this._lastAnswer.length > 0;
        this.copyItem.actor.visible = answered;
        this.newConversationItem.actor.visible = answered;
    }

    _addRow(menu, title, detail, url) {
        let item = new PopupMenu.PopupBaseMenuItem();
        let box = new St.BoxLayout({ vertical: true, style: "width: 22em;" });
        let titleLabel = new St.Label({ text: title });
        titleLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        box.add_child(titleLabel);
        if (detail) {
            let detailLabel = new St.Label({ text: detail, style: "font-size: 0.85em; opacity: 0.7;" });
            detailLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            box.add_child(detailLabel);
        }
        item.addActor(box, { expand: true, span: -1 });
        if (url)
            item.connect("activate", () => this._openUrl(url));
        menu.menu.addMenuItem(item);
    }

    _addEmpty(menu, text) {
        menu.menu.addMenuItem(new PopupMenu.PopupMenuItem(text, { reactive: false }));
    }

    _onMenuToggled(open) {
        if (!open)
            return;
        if (!this.client.hasKey) {
            this._setStatus(_("Add your Asyntai API key to see your chats and ask your chatbot."), true);
            return;
        }
        global.stage.set_key_focus(this.entry);
        this._refreshLists();
    }

    _refreshLists() {
        if (!this.client.hasKey) {
            this._setStatus(_("Add your Asyntai API key to see your chats and ask your chatbot."), true);
            return;
        }
        let generation = this._generation;
        this._setStatus(_("Loading..."));

        this.client.sessions((error, list) => {
            if (this._stale(generation))
                return;
            this.chatsMenu.menu.removeAll();
            if (error) {
                this._setStatus(error, this.client.keyProblem);
                // Leads and tickets fail the same way, so show the reason only.
                this.chatsMenu.actor.visible = false;
                this.leadsMenu.actor.visible = false;
                this.ticketsMenu.actor.visible = false;
                return;
            }
            this._setStatus("");
            this._markChatsSeen(list);
            if (!list.length)
                this._addEmpty(this.chatsMenu, _("No chats yet"));
            for (let s of list.slice(0, MENU_ROWS)) {
                let sid = str(s, "session_id");
                let count = parseInt(str(s, "message_count")) || 0;
                let detail = joined([
                    ago(str(s, "last_message_at")),
                    count ? ngettext("%d message", "%d messages", count).format(count) : "",
                    str(s, "website_domain"),
                    str(s, "country"),
                ]);
                this._addRow(this.chatsMenu, shorten(str(s, "first_message"), 60) || _("Chat"), detail, sid ? this.client.chatUrl(sid) : "");
            }
        });

        this.client.leads((error, list) => {
            if (this._stale(generation))
                return;
            this.leadsMenu.menu.removeAll();
            if (error)
                return;
            this._markLeadsSeen(list);
            if (!list.length)
                this._addEmpty(this.leadsMenu, _("No leads yet"));
            for (let lead of list.slice(0, MENU_ROWS)) {
                let sid = str(lead, "session_id");
                let email = str(lead, "email");
                let phone = str(lead, "phone");
                let detail = joined([ago(str(lead, "started_at")), email ? phone : "", shorten(str(lead, "page_url"), 50)]);
                this._addRow(this.leadsMenu, email || phone || _("Lead"), detail, sid ? this.client.chatUrl(sid) : "");
            }
        });

        this.client.tickets((error, list) => {
            if (this._stale(generation))
                return;
            this.ticketsMenu.menu.removeAll();
            if (error)
                return;
            if (!list.length)
                this._addEmpty(this.ticketsMenu, _("No tickets yet"));
            for (let t of list.slice(0, MENU_ROWS)) {
                let sid = str(t, "session_id");
                let number = str(t, "ticket_number");
                let subject = str(t, "subject") || _("No subject");
                let title = number ? _("%s: %s").format(number, subject) : subject;
                let status = str(t, "status");
                let detail = joined([status ? status.charAt(0).toUpperCase() + status.slice(1) : "", str(t, "visitor_email"), ago(str(t, "created_at"))]);
                this._addRow(this.ticketsMenu, shorten(title, 60), detail, sid ? this.client.chatUrl(sid) : "");
            }
        });
    }

    // -- asking the chatbot ---------------------------------------------

    _ask() {
        let question = this.entry.get_text().trim();
        if (!question)
            return;
        if (!this.client.hasKey) {
            this._setStatus(_("Add your Asyntai API key to see your chats and ask your chatbot."), true);
            return;
        }
        if (!this._askSession)
            this._askSession = newAskSession();

        let generation = this._generation;
        this.entry.set_text("");
        this.entry.reactive = false;
        this._lastAnswer = "";
        this._showAnswer(_("You: %s").format(question) + "\n\n" + _("Your chatbot is writing an answer..."));

        this.client.ask(question, this._askSession, (error, answer) => {
            if (this._stale(generation))
                return;
            this.entry.reactive = true;
            global.stage.set_key_focus(this.entry);
            if (error) {
                this._lastAnswer = "";
                this._showAnswer(_("You: %s").format(question) + "\n\n" + error);
                return;
            }
            this._lastAnswer = answer;
            this._showAnswer(_("You: %s").format(question) + "\n\n" + (answer || _("Your chatbot gave an empty answer.")));
        });
    }

    // -- new chats and leads on the panel -------------------------------

    _poll() {
        if (!this.client.hasKey) {
            this._newChats = 0;
            this._updatePanel();
            return;
        }
        let generation = this._generation;

        this.client.sessions((error, list) => {
            if (this._stale(generation) || error)
                return;
            let newest = this._newest(list, "last_message_at");
            if (!this.seenChats && newest) {
                // First run: start counting from now, not from the whole history.
                this.seenChats = new Date(newest).toISOString();
            }
            let seen = timeOf(this.seenChats);
            this._newChats = list.filter(s => timeOf(str(s, "last_message_at")) > seen).length;
            this._updatePanel();

            if (this._newestChatSeenByPoll && this.notifyNew) {
                let fresh = list.filter(s => timeOf(str(s, "last_message_at")) > this._newestChatSeenByPoll);
                if (fresh.length === 1)
                    this._notify(_("New chat on your website"), shorten(str(fresh[0], "first_message"), 120));
                else if (fresh.length > 1)
                    this._notify(_("New chats on your website"), ngettext("%d chat has new messages.", "%d chats have new messages.", fresh.length).format(fresh.length));
            }
            this._newestChatSeenByPoll = Math.max(this._newestChatSeenByPoll, newest);
        });

        this.client.leads((error, list) => {
            if (this._stale(generation) || error)
                return;
            let newest = this._newest(list, "started_at");
            if (!this.seenLeads && newest)
                this.seenLeads = new Date(newest).toISOString();

            if (this._newestLeadSeenByPoll && this.notifyNew) {
                let fresh = list.filter(l => timeOf(str(l, "started_at")) > this._newestLeadSeenByPoll);
                for (let lead of fresh.slice(0, 3))
                    this._notify(_("New lead"), str(lead, "email") || str(lead, "phone"));
            }
            this._newestLeadSeenByPoll = Math.max(this._newestLeadSeenByPoll, newest);
        });
    }

    _notify(title, body) {
        // Main.notify with the Asyntai icon instead of the generic one.
        let source = new MessageTray.SystemNotificationSource();
        Main.messageTray.add(source);
        let icon = new St.Icon({ gicon: new Gio.FileIcon({ file: this._iconFile }), icon_size: 24 });
        let notification = new MessageTray.Notification(source, title, body, { icon: icon });
        notification.setTransient(true);
        source.notify(notification);
    }

    _newest(list, field) {
        return list.reduce((max, row) => Math.max(max, timeOf(str(row, field))), 0);
    }

    _markChatsSeen(list) {
        let newest = this._newest(list, "last_message_at");
        if (newest && newest > timeOf(this.seenChats))
            this.seenChats = new Date(newest).toISOString();
        this._newestChatSeenByPoll = Math.max(this._newestChatSeenByPoll, newest);
        this._newChats = 0;
        this._updatePanel();
    }

    _markLeadsSeen(list) {
        let newest = this._newest(list, "started_at");
        if (newest && newest > timeOf(this.seenLeads))
            this.seenLeads = new Date(newest).toISOString();
        this._newestLeadSeenByPoll = Math.max(this._newestLeadSeenByPoll, newest);
    }

    _updatePanel() {
        if (this._removed)
            return;
        let show = this.showCount && this._newChats > 0;
        this.set_applet_label(show ? String(this._newChats) : "");
        this.hide_applet_label(!show);
        if (this._newChats > 0)
            this.set_applet_tooltip(ngettext("Asyntai: %d new chat", "Asyntai: %d new chats", this._newChats).format(this._newChats));
        else
            this.set_applet_tooltip(_("Asyntai AI Chatbot"));
    }

    // -- settings and lifecycle -----------------------------------------

    _onKeyChanged() {
        this.client.apiKey = this.apiKey || "";
        this._generation++;
        this.client.abort();
        this._askSession = "";
        this._lastAnswer = "";
        this._showAnswer("");
        this.entry.reactive = true;
        this.chatsMenu.menu.removeAll();
        this.leadsMenu.menu.removeAll();
        this.ticketsMenu.menu.removeAll();
        this._newestChatSeenByPoll = 0;
        this._newestLeadSeenByPoll = 0;
        this.seenChats = "";
        this.seenLeads = "";
        this._setStatus("");
        this._poll();
    }

    _restartTimer() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
        let minutes = Math.max(1, parseInt(this.refreshMinutes) || 5);
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, minutes * 60, () => {
            this._poll();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stale(generation) {
        return this._removed || generation !== this._generation;
    }

    _openUrl(url) {
        Gio.AppInfo.launch_default_for_uri_async(url, null, null, (source, result) => {
            try {
                Gio.AppInfo.launch_default_for_uri_finish(result);
            } catch (e) {
                global.logError(UUID + ": could not open " + url + ": " + e.message);
            }
        });
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this._removed = true;
        this._generation++;
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
        this.client.abort();
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new AsyntaiApplet(metadata, orientation, panelHeight, instanceId);
}
