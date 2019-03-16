/*
 * Cinnamon RSS feed reader applet
 *
 * Author: jonbrett.dev@gmail.com
 * Date: 2013 - 2017
 *
 * Cinnamon RSS feed reader applet is free software: you can redistribute it
 * and/or modify it under the terms of the GNU General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * Cinnamon RSS feed reader applet is distributed in the hope that it will be
 * useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General
 * Public License for more details.
 * You should have received a copy of the GNU General Public License along
 * with Cinnamon RSS feed reader applet.  If not, see
 * <http://www.gnu.org/licenses/>.
 */

const UUID = "feeds@jonbrettdev.wordpress.com";

const FEED_IMAGE_HEIGHT_MAX = 100;
const FEED_IMAGE_WIDTH_MAX = 200;
const TOOLTIP_WIDTH = 500.0;
const MIN_MENU_WIDTH = 400;
const GLib = imports.gi.GLib;
// Set the path constants 
const APPLET_PATH = imports.ui.appletManager.appletMeta[UUID].path;
const DATA_PATH = GLib.get_home_dir() + "/.cinnamon/" + UUID;
const ICON_PATH = APPLET_PATH + '/icons/';
const FEED_CONFIG_FILE = DATA_PATH + "/feeds.json";
imports.searchPath.push(APPLET_PATH);

const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const CinnamonVersion=imports.misc.config.PACKAGE_VERSION;
const FeedReader = imports.feedreader;
const Gio = imports.gi.Gio;

const Gtk = imports.gi.Gtk;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const Util = imports.misc.util;

const Clutter = imports.gi.Clutter;
const Logger = imports.log_util;
const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;
const Signals = imports.signals;

// Translation support
const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

/*  Application hook */
function main(metadata, orientation, panel_height, instance_id) {
    return new FeedApplet(metadata, orientation, panel_height, instance_id);
}

/* constructor for applet */
function FeedApplet() {
    this._init.apply(this, arguments);
}

/* Applet */
FeedApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        // Check for dependencies up front
        this._check_dependencies();
        // Initialize the settings early so we can use them
        this._init_settings();
        this.open_menu = null;
        // Queue used to hold feeds that need to be processed
        this.feed_queue = [];

        try {
            let debug_logging = this.settings.getValue("enable-verbose-logging");

            // Initialize a debug logger
            this.logger = new Logger.Logger({
                uuid: UUID,
                verbose: debug_logging
            });

            this.logger.info("Logging set at " + ((debug_logging) ? "debug" : "info"));
            this.logger.debug("Instance ID (config file): " + instance_id);
            this.logger.debug("Selected Instance Name: " + this.instance_name);

            this.feeds = new Array();

            Gtk.IconTheme.get_default().append_search_path(ICON_PATH);
            this.set_applet_icon_symbolic_name("rss");
            this.set_applet_tooltip(_("Feed reader"));

            this.logger.debug("Creating menus");
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.feed_file_error = false;
            this._read_json_config();
        } catch (e) {
            // Just in-case the logger is the issue.
            if(this.logger != undefined){
                this.logger.error(e);
            }
            global.logError(e);
        }

        this._build_context_menu();

        this.timeout = this.refresh_interval_mins * 60 * 1000;
        this.logger.debug("Initial timeout set in: " + this.timeout + " ms");
        /* Set the next timeout */
        this.timer_id = Mainloop.timeout_add(this.timeout,
                Lang.bind(this, this._process_feeds));

        this.logger.debug("timer_id: " + this.timer_id);
    },

    notify_send: function(notification, iconPath) {
        if (iconPath == null)
            iconPath = this.appletPath + '/icon.png';
        Util.spawnCommandLine('notify-send "' + notification + '" -i ' + iconPath);
    },

    notify_installation: function(packageName) {
        this.notify_send(_("Please install the '%s' package.").format(packageName), null);
    },

    _check_feedparser: function(output) {
        if (output == "FAIL") {
            this.notify_installation('python-feedparser');
            Util.spawnCommandLine("apturl apt://python-feedparser");
        }
    },

    /* private function to check, confirm and install any dependencies */
    _check_dependencies: function() {
       Util.spawn_async(['python', APPLET_PATH + '/check_feedparser.py'], Lang.bind(this, this._check_feedparser));
    },

    /* private function that connects to the settings-schema and initializes the variables */
    _init_settings: function(instance_id) {
        this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);

        this.settings.bindProperty(Settings.BindingDirection.IN,
                "refresh_interval",
                "refresh_interval_mins",
                this._on_settings_changed,
                null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
                "max_items",
                "max_items",
                this._on_settings_changed,
                null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
                "enable-verbose-logging",
                "enable_verbose_logging",
                this._on_settings_changed,
                null);

        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "instance_name",
                "instance_name",
                this._read_json_config,
                null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
                "notifications_enabled",
                "notifications_enabled",
                this._on_settings_changed,
                null);
    },
    /* Public method for adding a feed to be processed (downloaded) */
    enqueue_feed: function(item){
        this.logger.debug("checking to add feed_id " + item.feed_id + " to the process queue.");
        // Only add items once to the queue.

        let found = this.feed_queue.find(feed => (feed.feed_id == item.feed_id));

        if(!found){
            // push the item on the queue
            this.feed_queue.push(item);
            this.logger.debug("Added feed to the process queue.");
        }
    },

    /* Public method to dequeue the next feed and process it (downloading and parsing). */
    process_next_feed: function() {
        // Need to limit this to a single execution
        this.logger.debug("Processing the process queue, length: " + this.feed_queue.length);
        if(this.feed_queue.length > 0){
            this.is_feed_downloading = true;
            let item = this.feed_queue.shift();
            // start the download of the feed
            item.reader.download_feed();
        }
    },

    /* Private method to create the sub menu items for a feed. */
    _build_context_menu: function() {
        this.logger.debug("FeedApplet._build_context_menu");

        var s = new Applet.MenuItem(
                _("Mark all read"),
                "object-select-symbolic",
                Lang.bind(this, function() {
                    for (var i = 0; i < this.feeds.length; i++) {
                        this.feeds[i].reader.mark_all_items_read();
                        this.feeds[i].update();
                    }
                }));
        this._applet_context_menu.addMenuItem(s);

        var s = new Applet.MenuItem(
                _("Reload"),
                "view-refresh-symbolic",
                Lang.bind(this, function() {
                    this.logger.debug("view-refresh-symbolic calling refresh");
                    this._process_feeds();
                }));
        this._applet_context_menu.addMenuItem(s);

        var s = new Applet.MenuItem(
                _("Manage feeds"),
                "document-properties-symbolic",
                Lang.bind(this, function() {
                    this.manage_feeds();
                }));
        this._applet_context_menu.addMenuItem(s);

        /* Include setting menu item in Cinnamon < 2.0.0 */
        this.logger.debug("Cinnamon Version: " + CinnamonVersion);
        if (parseInt(CinnamonVersion) == 1) {
            s = new Applet.MenuItem(
                    _("Settings"),
                    "emblem-system-symbolic",
                    Lang.bind(this, function() {
                        Util.spawnCommandLine('cinnamon-settings applets ' + UUID);
                    }));
            this._applet_context_menu.addMenuItem(s);
        }
    },
    _read_json_config: function(instance_name = null) {            
        if(instance_name != null && instance_name.trim() != ""){
            this.instance_name = instance_name.trim();
        }
        // Read the json config file.
        let argv = ["python3", APPLET_PATH + "/ConfigFileManager.py", FEED_CONFIG_FILE];
        Util.spawn_async(argv, Lang.bind(this, this._load_feeds));                    
    },
    /* Private method used to load / reload all the feeds. */
    _load_feeds: function(url_json) {
        this.logger.debug("FeedApplet._load_feeds");        
        this.feeds = new Array();
        this.menu.removeAll();
        let data = JSON.parse(url_json);
        let i = 0;

        // Find the feeds for the selected instance_name and populate those feeds.
        for (let key in data['instances']) {
            if (data['instances'][key]['name'].trim() === this.instance_name) {
                let iinterval = data['instances'][key]['interval']; // Not currently used
                
                for (let fkey in data['instances'][key]['feeds']) {
                    try {
                        if (data['instances'][key]['feeds'][fkey]['enabled']) {
                            this.feeds[i] = new FeedDisplayMenuItem(
                                data['instances'][key]['feeds'][fkey]['url'],
                                this,
                                {
                                    feed_id: data['instances'][key]['feeds'][fkey]['id'],
                                    logger: this.logger,
                                    max_items: this.max_items,
                                    show_read_items: data['instances'][key]['feeds'][fkey]['showreaditems'],
                                    show_feed_image: data['instances'][key]['feeds'][fkey]['showimage'],
                                    custom_title: data['instances'][key]['feeds'][fkey]['title'],
                                    notify: data['instances'][key]['feeds'][fkey]['notify'],
                                    interval: data['instances'][key]['feeds'][fkey]['interval'] // Not currently used
                                });
                            this.menu.addMenuItem(this.feeds[i]);
                            i++;
                        }
                    } catch (e) {
                        global.logError("Error Parsing feeds.json file: " + e);
                    }
                }
            }
        }
    },

    /* public method to notify of changes to
     * feed info (e.g. unread count, title).  Updates the
     * applet icon and tooltip */
    update_title: function() {
        this.logger.debug("FeedApplet.update_title");
        let unread_count = 0;
        let tooltip = "";
        let first = true;

        // Application tooltip will only list unread feeds.
        for (var i = 0; i < this.feeds.length; i++) {
            let count = this.feeds[i].get_unread_count();

            if(count > 0){
                unread_count += count;
                // ensure the last feed added does not get a newline character.
                if(!first){
                    tooltip += "\n";
                }
                tooltip += this.feeds[i].get_title();
                first = false;
            }
        }

        if (unread_count > 0) {
            this.set_applet_icon_symbolic_name("feed-new");
            this.set_applet_tooltip(tooltip);
        } else {
            this.set_applet_icon_symbolic_name("feed");
            this.set_applet_tooltip(_("No unread feeds"));
        }
    },

    /* Private method used to handle updating feeds when a change has been made in the settings menu */
    _on_settings_changed: function() {
        this.logger.debug("FeedApplet._on_settings_changed");
        for (var i = 0; i < this.feeds.length; i++) {
            this.feeds[i].on_settings_changed({
                    max_items: this.max_items
            });
        }

        logging_level = this.settings.getValue("enable-verbose-logging");
        // notify only when the logging level has changed.
        if(this.logger.verbose != logging_level){
            this.logger.info("Logging changed to " + ((this.logger.verbose) ? "debug" : "info"));
            this.logger.verbose = logging_level;
        }

        this._process_feeds();
    },

    /* Private method to initiate the downloading and refreshing of all feeds. */
    _process_feeds: function() {
        this.logger.debug("FeedApplet._process_feeds: Removing previous timer: " + this.timer_id);

        /* Remove any previous timeout */
        if (this.timer_id) {
            Mainloop.source_remove(this.timer_id);
            this.timer_id = 0;
        }
        this.logger.debug("Number of feeds to queue: " + this.feeds.length);
        for (var i = 0; i < this.feeds.length; i++) {
            this.enqueue_feed(this.feeds[i]);
        }

        // Process the queue items.
        this.process_next_feed();

        /* Convert refresh interval from mins -> ms */
        this.timeout = this.refresh_interval_mins * 60 * 1000;

        this.logger.debug("Setting next timeout to: " + this.timeout + " ms");
        /* Set the next timeout */
        this.timer_id = Mainloop.timeout_add(this.timeout,
                Lang.bind(this, this._process_feeds));

        this.logger.debug("timer_id: " + this.timer_id);
    },

    on_applet_clicked: function(event) {
        this.logger.debug("FeedApplet.on_applet_clicked");
        this.menu.toggle();
        this.toggle_feeds(null);
    },

    new_item_notification: function(feed, feedtitle, itemtitle) {
        this.logger.debug("FeedApplet.new_item_notification");
        /* Displays a popup notification using notify-send */

        // if notifications are disabled don't do anything
        if(!this.notifications_enabled) {
            this.logger.debug("Notifications Disabled");
            return;
        }

        this._notifyMessage(feed, feedtitle, itemtitle);
    },

    item_read_notification: function(feed){
        this.logger.debug("FeedApplet.item_read_notification");
        if(this.notifications_enabled) {
            this._destroyMessage(feed);
        }
    },

    toggle_feeds: function(feed_to_show, auto_next = false) {
        this.logger.debug("FeedApplet.toggle_feeds auto:" + auto_next);

        // Check if a menu is already open
        if(this.open_menu != null){
            // if matches requested feed and is not empty then exit, otherwise close the feed
            if(feed_to_show != null && this.open_menu.feed_id == feed_to_show.feed_id && this.open_menu.unread_count > 0){
                return;
            }

            // Close the last menu since we will be opening a new menu.
            this.open_menu.close_menu();
            this.open_menu = null;
        }

        if(auto_next && feed_to_show != null && feed_to_show.unread_count == 0){
            feed_to_show = null;
        }

        if (feed_to_show != null) {
            // We know the feed to show, just open it.
            this.feed_to_show = feed_to_show;
            this.feed_to_show.open_menu();
        } else {
            for (let i in this.feeds) {
                if (this.feeds[i].unread_count > 0) {
                    this.logger.debug("Opening Menu: " + this.feeds[i]);
                    this.feeds[i].open_menu();
                    return;
                }
            }
            // If we get here then no feeds are available, if this was the result of opening or marking the
            // last feed read then close the menu.
            if(auto_next)
                // Close the menu since this is the last feed
                this.menu.close(true);
        }
    },
    /* Feed manager functions */
    manage_feeds: function() {
        this.logger.debug("FeedApplet.manage_feeds");
        let pythonfile = 'manage_feeds.py';
        try {            
            this._set_permissions(pythonfile);

            let argv = ['python3', APPLET_PATH + '/' + pythonfile, FEED_CONFIG_FILE, this.instance_name];
            Util.spawn_async(argv, Lang.bind(this, this._read_json_config));     
        }
        catch (e) {
            if(this.logger != undefined){
                this.logger.error(e);
            }
            global.logError(e);
        }
    },

    redirect_feed: function(current_url, redirected_url) {
        this.logger.debug("FeedApplet.redirect_feed");
        let pythonfile = 'ConfigFileManager.py';
        try {
            this._set_permissions(pythonfile);        
            let argv = ['python3', APPLET_PATH + '/' + pythonfile, FEED_CONFIG_FILE];
            argv.push('--instance', this.instance_name);
            argv.push('--oldurl', current_url);
            argv.push('--newurl', redirected_url);
            Util.spawn_async(argv, Lang.bind(this, this._read_json_config));     
        }
        catch (e) {
            if(this.logger != undefined){
                this.logger.error(e);
            }
            global.logError(e);
        }
    },

    _set_permissions: function (python_file) {
        this.logger.debug("FeedApplet._set_permissions");
        try {
            Util.spawnCommandLine('chmod +x "' + APPLET_PATH + '/' + python_file + '"');
            Util.spawnCommandLine('chown $USER "' + APPLET_PATH + '/' + python_file + '"');
            
        } catch (e) {
            if (this.logger != undefined) {
                this.logger.error(e);
            }
            global.logError(e);
        }
        this.logger.debug("FeedApplet._set_permissions Done");
    },
    on_applet_removed_from_panel: function() {
        /* Clean up the timer so if the feed applet is removed it stops firing requests.  */
        this.logger.debug("FeedApplet.on_applet_removed_from_panel");
        if (this.timer_id) {
            this.logger.debug("Removing Timer with ID: " + this.timer_id);
            Mainloop.source_remove(this.timer_id);
            this.timer_id = 0;
        }

        // Remove all notifications since they no longer apply
        for (i in this.feeds){
            this._destroyMessage(this.feeds[i].reader);
        }
    },

    _ensureSource: function() {
        this.logger.debug("FeedApplet._ensureSource");
        if(!this._source) {
            let gicon = Gio.icon_new_for_string(APPLET_PATH + "/icon.png");
            let icon = new St.Icon({ gicon: gicon});

            this._source = new FeedMessageTraySource("RSS Feed Notification", icon);
            this._source.connect('destroy', Lang.bind(this, function(){
                this._source = null;
            }));
            if (Main.messageTray) Main.messageTray.add(this._source);
        }
    },

    _notifyMessage: function(reader, title, text){
        this.logger.debug("FeedApplet._notifyMessage");
        if(reader._notification)
            reader._notification.destroy();

        this._ensureSource();

        let gicon = Gio.icon_new_for_string(APPLET_PATH + "/icon.png");
        let icon = new St.Icon({ gicon: gicon});
        reader._notification = new MessageTray.Notification(this._source, title, text, {icon: icon});
        reader._notification.setTransient(false);
        reader._notification.connect('destroy', function(){
            reader._notification = null;
        });

        this._source.notify(reader._notification);
    },

    _destroyMessage: function(reader){
        this.logger.debug("FeedApplet._destroyMessage");
        if(reader._notification){
            reader._notification.destroy();
        }
    },
};

function FeedMessageTraySource() {
    this._init();
}

FeedMessageTraySource.prototype = {
    __proto__: MessageTray.Source.prototype,

    _init: function() {
        MessageTray.Source.prototype._init.call(this, _("Feeds"));

        let gicon = Gio.icon_new_for_string(APPLET_PATH + "/icon.png");
        let icon = new St.Icon({ gicon: gicon});

        this._setSummaryIcon(icon);
    }
};

/* Menu item for displaying the feed title*/
function FeedDisplayMenuItem() {
    this._init.apply(this, arguments);
}

FeedDisplayMenuItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function (url, owner, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});

        //Used to keep track of unique feeds.
        this.feed_id = params.feed_id;
        this.notify = params.notify;
        this.interval = params.interval; // Not currently used, possible future feature.

        //TODO: Add Box layout type to facilitate adding an icon?
        this.menuItemCount = 0;
        this.show_action_items = false;
        this._title = new St.Label({ text: "loading",
            style_class: 'feedreader-title-label'
        });

        this.addActor(this._title, {expand: true, align: St.Align.START});


        this._triangleBin = new St.Bin({ x_align: St.Align.END });
        this.addActor(this._triangleBin, { expand: true,
                                           span: -1,
                                           align: St.Align.END });

        this._triangle = new St.Icon({ style_class: 'popup-menu-arrow',
                              icon_name: 'pan-end',
                              icon_type: St.IconType.SYMBOLIC,
                              y_expand: true,
                              y_align: Clutter.ActorAlign.CENTER,
                              important: true });

        this._triangle.pivot_point = new Clutter.Point({ x: 0.5, y: 0.6 });
        this._triangleBin.child = this._triangle;

        this.menu = new PopupMenu.PopupSubMenu(this.actor, this._triangle);
        this.menu.actor.set_style_class_name('menu_context_menu');

        this.logger = params.logger;
        this.owner = owner;
        this.max_items = params.max_items;
        this.show_feed_image = params.show_feed_image;
        this.show_read_items = params.show_read_items;
        this.unread_count = 0;
        this.logger.debug("Loading FeedReader url: " + url);
        this.custom_title = params.custom_title;

        /* Create reader */
        this.reader = new FeedReader.FeedReader(
                this.logger,
                this.feed_id,
                url,         
                this.notify,       
                {
                    'onUpdate' : Lang.bind(this, this.update),
                    'onError' : Lang.bind(this, this.error),
                    'onNewItem' : Lang.bind(this.owner, this.owner.new_item_notification),
                    'onItemRead' : Lang.bind(this.owner, this.owner.item_read_notification),
                    'onDownloaded' : Lang.bind(this.owner, this.owner.process_next_feed),
                }
            );

        this.reader.connect('items-loaded', Lang.bind(this, function()
        {
            this.logger.debug("items-loaded Event Fired for reader");
            // Title needs to be set on items-loaded event
            if(!this.custom_title)
                this.rssTitle = this.reader.title;
            else
                this.rssTitle = this.custom_title;

            this._title.set_text(this.rssTitle);

            this.title_length = (this._title.length > MIN_MENU_WIDTH) ? this._title.length : MIN_MENU_WIDTH;
            this.owner.enqueue_feed(this);
            this.update();
            this.owner.process_next_feed();
        }));

        this.actor.connect('enter-event', Lang.bind(this, this._buttonEnterEvent));
        this.actor.connect('leave-event', Lang.bind(this, this._buttonLeaveEvent));
    },

    get_title: function() {

        let title =  this.custom_title || this.reader.title;
        if (this.reader.is_redirected)
            title += " (Redirected to: " + this.reader.redirected_url + ")";
        title += " [" + this.reader.get_unread_count() + " / " + this.reader.items.length + "]";
        return title;
    },

    get_unread_count: function() {
        return this.unread_count;
    },

    error: function(reader, message, full_message) {
        this.menu.removeAll();

        this.menu.addMenuItem(new LabelMenuItem(
                    message, full_message));
    },

    update: function() {
        this.logger.debug("FeedDisplayMenuItem.update");
        this.menu.removeAll();
        this.menuItemCount = 0;
        let msg = "Finding first " +
                  this.max_items +
                  " unread items out of: " +
                  this.reader.items.length +
                  " total items";

        this.logger.debug(msg);
        let menu_items = 0;
        this.unread_count = 0;

        for (var i = 0; i < this.reader.items.length && menu_items < this.max_items; i++) {
            if (this.reader.items[i].read && !this.show_read_items)
                continue;

            if (!this.reader.items[i].read)
                this.unread_count++;

            let item = new FeedMenuItem(this, this.reader.items[i], this.title_length, this.logger);
            item.connect('item-read', Lang.bind(this, function () { this.update(); }));
            this.menu.addMenuItem(item);

            menu_items++;
        }

        // Add the menu items and close the menu?
        this._add_submenu();

        this.logger.debug("Items Loaded: " + menu_items);
        this.logger.debug("Link: " + this.reader.url);

        let tooltipText = _("Right Click to open feed: \n") + this.reader.url;
        let tooltip = new Tooltips.Tooltip(this.actor, tooltipText);

        /* Append unread_count to title */
        this._title.set_text(this.get_title());

        if(this.unread_count > 0)
            this.actor.add_style_class_name('feedreader-feed-new');
        else
            this.actor.remove_style_class_name('feedreader-feed-new');

        this.owner.update_title();
    },

    on_settings_changed: function(params) {
        this.max_items = params.max_items;
        this.show_feed_image = params.show_feed_image;
        this.show_read_items = params.show_read_items;        
        this.update();
    },

    _onButtonReleaseEvent: function (actor, event) {
        this.logger.debug("FeedDisplayMenuItem Button Pressed Event: " + event.get_button());

        if(event.get_button() == 3){
            // Right click, open feed url
            try {
                Util.spawnCommandLine('xdg-open ' + this.reader.get_url());
            } catch (e) {
                global.logError(e);
            }
        } else {
            // Left click, show menu
            this.owner.toggle_feeds(this);
        }
    },

    open_menu: function() {
        this.logger.debug("FeedDisplayMenuItem.open_menu id:" + this.feed_id);

        this.actor.add_style_class_name('feedreader-feed-selected');
        this.menu.open(true);
        this.owner.open_menu = this;
    },

    close_menu: function() {
        this.logger.debug("FeedDisplayMenuItem.close_menu id:" + this.feed_id);
        this.actor.remove_style_class_name('feedreader-feed-selected');
        this.menu.close(true);
    },

    _add_submenu: function(){
        // Add a new item to the top of the list.
        let menu_item;

        if(this.reader.get_unread_count() > this.max_items){
            // Only one page of items to read, no need to display mark all posts option.
            menu_item = new ApplicationContextMenuItem(this, _("Mark All Posts Read"), "mark_all_read");
            this.menu.addMenuItem(menu_item, 0);
            this.menuItemCount++;
        }

        let cnt = (this.max_items < this.unread_count) ? this.max_items : this.unread_count;
        if(cnt > 0){
            menu_item = new ApplicationContextMenuItem(this, _("Mark Next ") + cnt + _(" Posts Read"), "mark_next_read");
            this.menu.addMenuItem(menu_item, 0);
            this.menuItemCount++;
        }

        if(this.reader.is_redirected) {
            menu_item = new ApplicationContextMenuItem(this, _("Update feed URL"), "update_feed_url");
            this.menu.addMenuItem(menu_item, 0);
            this.menuItemCount++;
        }
    },

    _buttonEnterEvent: function(){
        this.actor.add_style_class_name('feedreader-feed-hover');
    },

    _buttonLeaveEvent: function() {
        this.actor.remove_style_class_name('feedreader-feed-hover');
    },
};
Signals.addSignalMethods(FeedDisplayMenuItem.prototype);
/* Menu item for displaying an feed item */
function FeedMenuItem() {
    this._init.apply(this, arguments);
}

FeedMenuItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function (parent, item, width, logger, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
        this._item_menu_count = 0;
        this.parent = parent;
        this.logger = logger;
        this.show_action_items = false;

        this.menu = new PopupMenu.PopupSubMenu(this.actor);
        this.item = item;
        if (this.item.read){
                this._icon_name = 'feed-symbolic';
                this.icon_type = St.IconType.SYMBOLIC;
            }
        else
            {
                this._icon_name = 'feed-new-symbolic';
                this.icon_type = St.IconType.FULLCOLOR;
        }

        this.icon = new St.Icon({icon_name: this._icon_name,
                icon_type: this.icon_type,
                style_class: 'popup-menu-icon' });

        // Calculate the age of the post, hours or days only
        let age = this.calculate_age(item.published);

        this.label = new St.Label({text: age + item.title});

        let box = new St.BoxLayout({ style_class: 'popup-combobox-item' });
        box.set_width(width);

        box.add(this.icon, {span: 0});
        box.add(this.label, {expand: true, span: 1, align: St.Align.START});
        this.addActor(box, { expand: true } );

        let description = item.title  +  '\n' +
                _('Published: ') + item.published  +  '\n\n' +
                item.description_text;

        this.tooltip = new Tooltips.Tooltip(this.actor, description);

        /* Some hacking of the underlying tooltip ClutterText to set wrapping,
         * format, etc */
        try {
            this.tooltip._tooltip.style_class = 'feedreader-item-tooltip';
            this.tooltip._tooltip.get_clutter_text().set_width(TOOLTIP_WIDTH);
            this.tooltip._tooltip.get_clutter_text().set_line_alignment(0);
            this.tooltip._tooltip.get_clutter_text().set_line_wrap(true);
            this.tooltip._tooltip.get_clutter_text().set_markup(
                    '<span weight="bold">' +
                    item.title +
                    '</span>\n' +
                    _('Published: ') + item.published  +  '\n\n' +
                    item.description);
        } catch (e) {
            this.logger.debug("Error Tweaking Tooltip: " + e);
            /* If we couldn't tweak the tooltip format this is likely because
             * the underlying implementation has changed. Don't issue any
             * failure here */
        }

        /* Ensure tooltip is destroyed when this menu item is destroyed */
        this.connect('destroy', Lang.bind(this, function() {
            this.tooltip.destroy();
        }));
        this.actor.connect('enter-event', Lang.bind(this, this._buttonEnterEvent));
        this.actor.connect('leave-event', Lang.bind(this, this._buttonLeaveEvent));
    },

    _onButtonReleaseEvent: function (actor, event) {
        this.logger.debug("FeedMenuItem Button Pressed Event: " + event.get_button());
        if(event.get_button() == 1){
            this.activate(event);
            return true;
        }

        // Is this feed expanded?
        if(event.get_button() == 3){
            this.logger.debug("Show Submenu");
            this.toggleMenu();
            //this.open_menu();
            return true;
        }
        return false;
    },

    activate: function() {
        /* Opens item then marks it read */
        this.item.open();
        this.mark_read();
    },

    mark_read: function() {
        /* Marks the item read without opening it. */
        this.logger.debug("mark_read");
        this.item.mark_read();
        this._icon_name = 'feed-symbolic';
        this.icon.set_icon_name(this._icon_name);
        // Close sub menus if action has been taken.
        if(this.show_action_items)
            this.toggleMenu();

        this.emit('item-read');

        // Check and toggle feeds if this is the last item.
        //if(this.parent.get_unread_count() == 0)
        this.parent.owner.toggle_feeds(this.parent, true);
    },

    _open_menu: function() {
        this.logger.debug("FeedItem.open_menu");

        if(this._item_menu_count == 0) {
            // No submenu item(s), add the item(s)
            let menu_item;
            menu_item = new ApplicationContextMenuItem(this, _("Mark Post Read"), "mark_post_read");
            this.menu.addMenuItem(menu_item);
            this._item_menu_count++;
        }

        this.menu.open();
    },

    _close_menu: function() {
        this.logger.debug("FeedItem.close_menu");
        // no need to remove, just close the menu.

        this.menu.close();
    },

    toggleMenu: function() {
        this.logger.debug("toggleMenu");

        if(!this.menu.isOpen){
            this._open_menu();
        } else {
            this._close_menu();
        }
    },

    calculate_age: function(published){
        try {
            let age = new Date().getTime() - published;
            let h = Math.floor(age / (60 * 60 * 1000));
            let d = Math.floor(age / (24 * 60 * 60 * 1000))

            if(d > 0){
                return "(" + d + _("d) ");
            } else if (h > 0) {
                return "(" + h + _("h) ")
            } else {
                return _("(<1h) ");
            }
        } catch (e){
            this.logger.error(e);
            return '';
        }
    },

    _buttonEnterEvent: function(){
        this.actor.add_style_class_name('feedreader-feed-hover');
    },

    _buttonLeaveEvent: function() {
        this.actor.remove_style_class_name('feedreader-feed-hover');
    },
};

function ApplicationContextMenuItem(feed_display_menu_item, label, action){
    this._init(feed_display_menu_item, label, action);
}

ApplicationContextMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(feed_display_menu_item, label, action){
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});

        this._fdmi = feed_display_menu_item;
        this._action = action;
        this.label = new St.Label({ text: label });
        this.addActor(this.label);
        this.actor.connect('enter-event', Lang.bind(this, this._buttonEnterEvent));
        this.actor.connect('leave-event', Lang.bind(this, this._buttonLeaveEvent));
    },

    activate: function(event){
        global.log(this._action);
        switch(this._action){
            case "mark_all_read":
                global.log("Marking all items read");
                try {
                    //this._appButton.menu.close();
                    this._fdmi.reader.mark_all_items_read();
                    this._fdmi.update();
                    // All items have been marked so we know we are opening a new feed menu.
                    this._fdmi.owner.toggle_feeds(null);
                } catch (e){
                    global.log("error: " + e);
                }

                break;
            case "mark_next_read":
                global.log("Marking next " + this._fdmi.max_items + " items read");
                try {
                    //this._appButton.close_menu();
                    this._fdmi.reader.mark_next_items_read(this._fdmi.max_items);
                    this._fdmi.update();
                    this._fdmi.owner.toggle_feeds(this._fdmi, true);

                } catch (e){
                    global.log("error: " + e);
                }

                break;

            case "update_feed_url":
                let redirected_url = this._fdmi.reader.redirected_url;
                let current_url = this._fdmi.reader.url;

                global.log("Updating feed to point to: " + redirected_url);

                // Update the feed, no GUI is shown
                
                this._fdmi.owner.redirect_feed(current_url, redirected_url);

                // Reload the regular title and remove the is_redirected flag
                this._fdmi.owner.toggle_feeds(this._fdmi, true);
                break;

            case "delete_all_items":
                global.log("Marking all items 'deleted'");
                break;

            case "mark_post_read":
                global.log("Marking item 'read'");
                this._fdmi.mark_read();
                break;

            case "delete_post":
                global.log("deleting item");
                break;
        }
    },

    _onButtonReleaseEvent: function (actor, event) {
        if(event.get_button() == 1){
            this.activate(event);
        }
        return true;
    },

    _buttonEnterEvent: function(){
        this.actor.add_style_class_name('feedreader-feed-hover');
    },

    _buttonLeaveEvent: function() {
        this.actor.remove_style_class_name('feedreader-feed-hover');
    },
};
