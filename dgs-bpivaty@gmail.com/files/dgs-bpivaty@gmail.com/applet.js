const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const PopupMenu = imports.ui.popupMenu;
const Soup = imports.gi.Soup;
const UUID = "dgs-bpivaty@gmail.com";
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Notify = imports.gi.Notify;
const Secret = imports.gi.Secret;
const Settings = imports.ui.settings;
const Main   = imports.ui.main;

const LoginCancelled = -1;
const UknownUser = '* unknown user *';

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "./local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str)
}

function MyApplet(orientation, metadata, instance_id) {
    this.settings = new Settings.AppletSettings(this, UUID, instance_id);
    this._init(orientation, metadata, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, metadata, instance_id) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation, metadata, instance_id);
        
        try {  
            this.set_applet_tooltip(_("Diplays DGS user games status")); 
            this.set_applet_label('');
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            this.loggedIn = false;
            this.baseUrl = 'http://www.dragongoserver.net/';
            this.password = null;
            this.myId = 0;
            this.cjs_path = '/usr/bin/cjs';
            this.applet_path = metadata.path;
            this.icon_path = metadata.path + "/icons";
            this.orientation = orientation;

            this.notification_list = [];

            this.settings.bind('check-every', 'check_every', Lang.bind(this, this._reset_timer));
            this.settings.bind('beep-when-notify', 'beep_on_notify');

            this.myUserName = this.settings.getValue('user-cred-n');

            this.loopDelay = 1000 * 60 * this.check_every;
            this._loopTimeoutId = Mainloop.timeout_add(this.loopDelay, Lang.bind(this, this._on_timeOut));

            this._set_applet_icon();

            this._init_menu();
        
        }
        catch (e) {
            global.logError(e.message);
        }
    },

    on_applet_added_to_panel: function(userEnabled) {
        
    },

    _set_label(games_to_play) {
        if (games_to_play > 0) {
            this.set_applet_label(games_to_play.toString());
        } else {
            this.set_applet_label('');
        }
    },

    _reset_timer() {
        try {
            Mainloop.source_remove(this._loopTimeoutId);
            this.loopDelay = 1000 * 60 * this.check_every;
            this._loopTimeoutId = Mainloop.timeout_add(this.loopDelay, Lang.bind(this, this._on_timeOut));
        } catch(err) {
            global.log(err.message);
        }
    },

    _launch_dgs_login_window() {
        let current_user = this.settings.getValue('user-cred-n');

        if (current_user == UknownUser) {
            current_user = '';
        }

        Util.spawn_async([this.cjs_path, this.applet_path + '/user.js', current_user], Lang.bind(this, this._on_login_finished));
    },

    _on_login_finished: function(result) {

        if (result == LoginCancelled) {
            if (!this.loggedIn) { 
                this.settings.setValue('user-cred-n', UknownUser);
            }
        }

        if (result != null) {
            let cred = result.trim();

            if (cred.indexOf(',') > 0) {
                data = cred.split(',');

                if (data.length == 2) {
                    if (this._check_user(data[0], data[1])) {
                        this.loggedIn = true;
                        this.myUserName = data[0];
                        this.password = data[1];
                        this.myId = this._parseIdFromUser(this.myUserName);
                        this._set_menu_title();
                        this._store_passwd();
                        this._recreate_all_menu();
                        this.settings.setValue('user-cred-n', this.myUserName);
                    } else {
                        this.loggedIn = false;
                        this.settings.setValue('user-cred-n', UknownUser);
                        this.myUserName = '';
                        this._clear_passwd();
                        this._recreate_all_menu();
                    }
                }
            }
        }
    },

    _check_user: function(dgs_uid, passwd) {
        
        let login_url = this.baseUrl + 'login.php?quick_mode=1&userid=' + dgs_uid  + '&passwd=' + passwd;
        let urlcatch = Gio.file_new_for_uri(login_url);
    
        try {
            loaded = urlcatch.load_contents(null);

            if (loaded[1].toString().trim().indexOf('#Error') > 0) {
                return false;
            } else {
                return true;
            }
            
        }  catch (err) {
            global.log(err.message);
            return false;
        }		
        
    },

    _store_passwd: function() {
        let secretSchema = {
            "org.bp.keyring.DGS.login": Secret.SchemaAttributeType.STRING
        };

        let secretAttributes = {
            "org.bp.keyring.DGS.login": "DGS login." + this.myUserName
        };

        let schema = Secret.Schema.new('org.bp.keyring.DGS', Secret.SchemaFlags.NONE, secretSchema);

        Secret.password_store_sync(schema,
            secretAttributes,
            Secret.COLLECTION_DEFAULT,
            'DGS', this.password, null, null);
    },

    _control_password() {
        let secretSchema = {
            "org.bp.keyring.DGS.login": Secret.SchemaAttributeType.STRING
        };

        let secretAttributes = {
            "org.bp.keyring.DGS.login": "DGS login." + this.myUserName
        };

        let schema = Secret.Schema.new('org.bp.keyring.DGS', Secret.SchemaFlags.NONE, secretSchema);

        let result = Secret.password_lookup(schema, secretAttributes, null,
                Lang.bind(this, this._on_password_lookup));

    },

    _on_password_lookup(source, result) {
        this.password = Secret.password_lookup_finish(result);

        if (this.password != null) {
            if (this._check_user(this.myUserName, this.password)) {
                this._reset_timer();
                this.myId = this._parseIdFromUser(this.myUserName);
                this._login();
            } else {
                this._set_no_user_menu();
            }
        } else {
            this._set_no_user_menu();
        }
    },

    _beep () {
        Util.spawn_async(['/usr/bin/aplay', this.applet_path + '/sounds/Blip.wav']);
    },

    _clear_passwd: function() {
        let secretSchema = {
            "org.bp.keyring.DGS.login": Secret.SchemaAttributeType.STRING
        };

        let secretAttributes = {
            "org.bp.keyring.DGS.login": "DGS login." + this.myUserName
        };

        let schema = Secret.Schema.new('org.bp.keyring.DGS', Secret.SchemaFlags.NONE, secretSchema);

        Secret.password_clear_sync(schema,
            secretAttributes,
            Secret.COLLECTION_DEFAULT,
            'DGS', this.password, null, null);
    },

    _updateUser: function() {
        if (this.user_id) {
            this.set_applet_label(user_id);
        } else {
            this.set_applet_label("");
        }
    },

    _on_timeOut() {
        this._recreate_all_menu();
        return true;
    },

    _set_no_user_menu() {
        let item = new PopupMenu.PopupMenuItem('DGS ( No user, please configure! )');
        item.actor.reactive = false;
        item.actor.can_focus = false;
        this.menu.addMenuItem(item);
        this._set_label('');
    },

    _set_menu_title() {
        let item = new PopupMenu.PopupMenuItem('DGS (' + this.myUserName + ')');
        item.label.add_style_class_name('display-subtitle');
        item.actor.reactive = false;
        item.actor.can_focus = false;
        this.menu.addMenuItem(item);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    },

    _add_refresh_menu_item() {
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let menu_item = new PopupMenu.PopupMenuItem('Refresh list');
        this.menu.addMenuItem(menu_item);
    
    },

    _notify_user_played: function(game) {
        if (this.notification_list.indexOf(game) < 0) {
            if (this.beep_on_notify) {
                this._beep();
            }
            Util.spawn_async([this.cjs_path, this.applet_path + '/notifier.js', game]);
            this.notification_list.push(game);
        }
    },

    _add_game_item: function(item, move_uid) {
        let menu_item = new PopupMenu.PopupMenuItem(item.toString());
        let result;

        if (this.myId === move_uid) {
            // it is my turn to play, notify me
            menu_item.label.add_style_class_name('display-subtitle');
            this._notify_user_played(item);
            result = 1;

        } else {
            // i already played in that game, remove from notified list if still in
            result = 0;
            let index = this.notification_list.indexOf(item);
            if (index >= 0) {
                this.notification_list.splice(index);
            }
        }
        this.menu.addMenuItem(menu_item);
        menu_item.connect("activate", Lang.bind(this, this._on_game_button_pressed));
        return result;
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _parseIdFromUser(user) {
        const req = 'quick_do.php?obj=user&cmd=info&user=' + user.toString();
        let urlcatch = Gio.file_new_for_uri(this.baseUrl + req);

        try {
            loaded = urlcatch.load_contents(null);
            const data = JSON.parse(loaded[1]);
            return data.id;
        }
        catch (err) {
            global.log(err.message);
        }
    },

    _parseUserNameFromId(userid) {
        const req = 'quick_do.php?obj=user&cmd=info&uid=' + userid.toString();
        let urlcatch = Gio.file_new_for_uri(this.baseUrl + req);

        try {
            loaded = urlcatch.load_contents(null);
            const data = JSON.parse(loaded[1]);
            return data.handle;
        }
        catch (err) {
            global.log(err.message);
        }
    },

    _set_applet_icon() {
        let iconFileName = this.icon_path + '/dgs-applet.png';
        this.set_applet_icon_path(iconFileName);
    },

    _parseGameList(jsonData) {
        let maxGames = jsonData.list_totals;
        let maxToPlay = 0;

        for (let i = 0; i < maxGames; i++) {
            let move_uid = jsonData.list_result[i][25];

            const p1 = this._parseUserNameFromId(jsonData.list_result[i][29]);
            const p2 = this._parseUserNameFromId(jsonData.list_result[i][34]);

            const players = p1 + ' vs ' + p2;

            maxToPlay += this._add_game_item(jsonData.list_result[i][0]  + '  (' + players + ')', move_uid);
        }
        this._set_label(maxToPlay);
    },

    _on_game_button_pressed: function(actor, event) {
        let game_id = actor.label.text.split(' ')[0];
        Util.spawnCommandLine("xdg-open " + this.baseUrl + '/game.php?gid=' + game_id.toString());
    },

    _recreate_all_menu() {

        try {
            let was_opened = this.menu.isOpen;
            this.menu.removeAll();

            if (this.loggedIn) {
                this._set_menu_title();
                this._parseGameList(JSON.parse(this._get_game_list()));
                this._add_refresh_menu_item();

                if (was_opened) {
                    this.menu.toggle();
                }
            } else {
                this._set_no_user_menu();
            }
            
        } catch (err) {
            global.log(err.message);
        }
    },

    _get_game_list() {
        let urlcatch = Gio.file_new_for_uri(this.baseUrl);
        const req = 'quick_do.php?obj=game&cmd=list&view=running&uid=' + this.myUserName;

        try {
            urlcatch = Gio.file_new_for_uri(this.baseUrl + req);
            loaded=urlcatch.load_contents(null);
            return loaded[1];

        } catch (err) {
            global.log(err.message);
        }
    },

    _login() {
        this.loggedIn = true;
        this._set_menu_title();
        this._parseGameList(JSON.parse(this._get_game_list()));
        this._add_refresh_menu_item();
    },

    on_applet_removed_from_panel: function(){
        Mainloop.source_remove(this._loopTimeoutId);
    },

    _init_menu() {
        this._control_password();
    },

};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation, metadata);
    return myApplet;      
}
