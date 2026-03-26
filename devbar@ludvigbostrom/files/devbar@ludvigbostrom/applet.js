const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;  // Needed for settings API
const Soup = imports.gi.Soup;
const PopupMenu = imports.ui.popupMenu;
const ByteArray = imports.byteArray;

// eslint-disable-next-line no-unused-vars
function ConfirmDialog() {
    this._init();
}

function MyApplet(orientation, panelHeight, instanceId) {
    this._init(orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init(orientation, panelHeight, instanceId) {
        Applet.TextApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        try {
            this.stop = false;
            this.settings = this.setUpSettings(instanceId);
            this.username =  GLib.get_user_name();
            this.url = this.setUpUrl();
            this.on_settings_changed();
            this.set_applet_label('dev-bar');
            this.set_applet_tooltip('Dev bar');

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = this.setUpMenu(orientation);

            this.update();
        } catch (e) {
            // eslint-disable-next-line no-undef
            global.logError(e);
        }
    },
    setUpSettings(instanceId) {
        const settings = new Settings.AppletSettings(this, 'devbar@ludvigbostrom', instanceId);
        settings.bindProperty(
            Settings.BindingDirection.IN,
            'url',
            'inputUrl',
            this.on_settings_changed,
            null
        );
        settings.bindProperty(
            Settings.BindingDirection.IN,
            'appendUsername',
            'appendUsername',
            this.on_settings_changed,
            null
        );
        settings.bindProperty(
            Settings.BindingDirection.IN,
            'interval',
            'interval',
            this.on_settings_changed,
            null
        );
        return settings;
    },
    setUpUrl() {
        const url = this.inputUrl;
        if (url === '')
            return '';
        else if (url.endsWith('/'))
            return `${url}${this.appendUsername ? this.username : ''}`;
        else
            return `${url}/${this.appendUsername ? this.username : ''}`;
    },
    setUpMenu(orientation) {
        const menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(menu);
        menu.addMenuItem(new PopupMenu.PopupMenuSection());
        return menu;
    },
    on_applet_removed_from_panel() {
        this.stop = true;
        if (this.httpSession !== undefined) {
            this.httpSession.abort();
            this.httpSession = undefined;
        }
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
        this.menu.destroy();
        this.menuManager.destroy();
    },
    on_settings_changed() {
        this.url = this.setUpUrl(this.inputUrl);
    },
    update() {
        if (this.stop) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
            return;
        }
        if (this.url !== '')
            this.loadWorkflowAsync(this.onWorkflowCallback);
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
        this._timeout = Mainloop.timeout_add_seconds(this.interval, function mainloopTimeout() {
            this.update();
        }.bind(this));
    },
    on_applet_clicked() {
        this.menu.toggle();
    },
    onWorkflowCallback(json) {
        this.updateLabel(json);
        this.updateMenu(json);
    },
    updateLabel(json) {
        this.currentCount = 0;
        let title = '';
        let displayObjects = json['metadata']['display'];
        Object.keys(displayObjects).forEach(function (key) {
            let data = json['data'][key];
            let display = displayObjects[key];
            if (data && data.length > 0) {
                this.currentCount += 1 + data.length;
                title += `${display['symbol'] + data.length.toString()}  `;
            }
        }.bind(this));
        if (title === '')
            title = '✓';

        this.set_applet_label(title);
    },
    updateMenu(json) {
        if (this.menu.isOpen)
            return;

        this.menu.removeAll();
        let displayObjects = json['metadata']['display'];
        Object.keys(displayObjects).forEach(function (key) {
            let data = json['data'][key];
            let display = displayObjects[key];
            if (data && data.length > 0) {
                let item = null;
                if (this.currentCount > 25) {
                    item = new PopupMenu.PopupSubMenuMenuItem(display['title']);
                    item.menu.actor.style = 'max-height: 300px;';
                } else {
                    item = new PopupMenu.PopupMenuItem(display['title']);
                }
                this.menu.addMenuItem(item);
                for (let index in data) {
                    let issue = data[index];
                    if (this.currentCount > 25)
                        item.menu.addCommandlineAction(issue['title'], `xdg-open ${issue['url']}`);
                    else
                        this.menu.addCommandlineAction(issue['title'], `xdg-open ${issue['url']}`);
                }
            }
        }.bind(this));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addSettingsAction('Settings', 'applets devbar@ludvigbostrom');
        this.menu.addAction('Refresh', () => this.loadWorkflowAsync(this.onWorkflowCallback));
    },
    loadWorkflowAsync(callback) {
        if (!this.httpSession) {
            if (Soup.MAJOR_VERSION === 2) {
                this.httpSession = new Soup.SessionAsync();
                Soup.Session.prototype.add_feature.call(this.httpSession, new Soup.ProxyResolverDefault());    
            } else {
                this.httpSession = new Soup.Session();
            }
        }

        let message = Soup.Message.new('GET', this.url);

        if (Soup.MAJOR_VERSION === 2) {
            this.httpSession.queue_message(message, function soupQueue(_, msg) {
                if (msg && msg.response_body.data) {
                    try {
                        callback.call(this, JSON.parse(msg.response_body.data));
                    } catch (err) {
                        this.set_applet_label('!');
                    }
                } else if ((msg && msg.status_code !== 503) || !msg) {
                    this.set_applet_label('!');
                }
            }.bind(this));
        } else {
            this.httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null, (session, result) => {
                try {
                    const bytes = this.httpSession.send_and_read_finish(result);
                    callback.call(this, JSON.parse(ByteArray.toString(bytes.get_data())));
                } catch (err) {
                    this.set_applet_label("!");
                }
            });
        }
    },
};

// eslint-disable-next-line no-unused-vars
function main(metadata, orientation, panelHeight, instanceId) {
    let myApplet = new MyApplet(orientation, panelHeight, instanceId);
    return myApplet;
}
