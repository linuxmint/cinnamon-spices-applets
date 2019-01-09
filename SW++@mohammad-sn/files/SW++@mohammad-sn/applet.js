const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Tweener = imports.ui.tweener;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const SignalManager = imports.misc.signalManager;

/**
 * localization/translation support
 */
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
let UUID = "SW++@mohammad-sn";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
    let customTranslation = Gettext.dgettext(UUID, str);
    if(customTranslation != str) {
        return customTranslation;
    }
    return Gettext.gettext(str);
}

/**
 * #MenuItem
 * @_text (string): Text to be displayed in the menu item
 * @_icon (string): Name of icon to be displayed in the menu item
 * @_callback (Function): Callback function when the menu item is clicked
 * @icon (St.Icon): Icon of the menu item
 *
 * A menu item that contains an icon, a text and responds to clicks
 *
 * Inherits: PopupMenu.PopupBaseMenuItem
 */
function MenuItem(label, icon, callback) {
    this._init(label, icon, callback);
}

MenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    /**
     * _init:
     * @text (string): text to be displayed in the menu item
     * @icon (string): name of icon to be displayed in the menu item
     * @callback (Function): callback function to be called when the menu item is clicked
     *
     * Constructor function
     */
    _init: function(text, icon, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this._text = text;
        this._icon = icon;
        this._callback = callback;

        let table = new St.Table({ homogeneous: false,
                                      reactive: true });
        this.icon = icon;
        table.add(this.icon,
                  {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

        this.label = new St.Label({ text: text });
        this.label.set_margin_left(6.0)
        table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});
        this.addActor(table, { expand: true, span: 1, align: St.Align.START});
        this.connect('activate', callback);
    },

    /**
     * clone:
     *
     * Clones the menu item
     *
     * Returns (MenuItem): a clone of this menu item
     */
    clone: function(){
        return new MenuItem(this._text, this._icon, this._callback);
    }
};


function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
        Gtk.IconTheme.get_default().append_search_path(metadata.path);

        this.set_applet_tooltip(_("desktop"));

        this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN,   // The binding direction - IN means we only listen for changes from this applet
                                 "icon-name",                               // The setting key, from the setting schema file
                                 "icon_name",                               // The property to bind the setting to - in this case it will initialize
                                                                            // this.icon_name to the setting value
                                 this.on_settings_changed,                  // The method to call when this.icon_name has changed, so you can update your applet
                                 null);                                     // Any extra information you want to pass to the callback
                                                                            // (optional - pass null or just leave out this last argument)

        this.settings.bindProperty(Settings.BindingDirection.TWO_WAY,  // Setting type
                                 "width",             // The setting key
                                 "width",             // The property to manage (this.width)
                                 this.width_changed,  // Callback when value changes
                                 null);               // Optional callback data

        this.settings.bindProperty(Settings.BindingDirection.IN, "SHOW-MENU-ON-CLOSE", "SHOW_MENU_ON_CLOSE", this.updateMenu, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "closebuttons", "close_buttons", function(){}, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "closeallbuttons", "closeall_buttons", function(){}, null);

        this.settings.bindProperty(Settings.BindingDirection.IN, "color", "h_color", function(){}, null);
        this.settings.bindProperty(Settings.BindingDirection.TWO_WAY, "highlight", "highlight", function(){}, null);

        this.settings.bindProperty(Settings.BindingDirection.IN, "peekatdesktop", "peek_at_desktop", function(){}, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "peekopacity", "peek_opacity", function(){}, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "alsoopacifyskiptaskbar", "opacify_skip_taskbar", function(){}, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "alsoopacifydesklets", "opacify_desklets", function(){}, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "blur", "blur", null, null);

        this.signals = new SignalManager.SignalManager(this);
        this.actor.connect('enter-event', Lang.bind(this, this._onEntered));
        this.actor.connect('leave-event', Lang.bind(this, this._onLEntered));
        this.signals.connect(global.stage, 'notify::key-focus', Lang.bind(this, this._onLEntered));
        this.scroll_connector = this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
        this._applet_context_menu.connect('open-state-changed', Lang.bind(this, this._onToggled));

        if (this.highlight && this.h_color !== 'rgba(0,0,0,0)'){
            this.actor.style = "background-color: rgba(255,155,0,0.7)"; //highlight for first time
            this.highlight=false
        }

        this.didpeek=false;
        this.uptgg=true;

        this.on_settings_changed();
        this.width_changed();
    },

    updateMenu: function() {
        let allwins = [];
        this._applet_context_menu.removeAll();
        let empty_menu = true;
        try {
            let tracker = Cinnamon.WindowTracker.get_default();
            for ( let wks=0; wks<global.screen.n_workspaces; ++wks ) {
                // construct a list with all windows
                let workspace_name = Main.getWorkspaceName(wks);
                let metaWorkspace = global.screen.get_workspace_by_index(wks);
                let windows = metaWorkspace.list_windows();
                let sticky_windows = windows.filter(
                        function(w) {
                            return !w.is_skip_taskbar() && w.is_on_all_workspaces();
                            });
                windows = windows.filter(
                        function(w) {
                            return !w.is_skip_taskbar() && !w.is_on_all_workspaces();
                            });

                if(sticky_windows.length && (wks==0)) {
                    for ( let i = 0; i < sticky_windows.length; ++i ) {
                        let metaWindow = sticky_windows[i];
                        TL_Dot='...';
                        if( metaWindow.get_title().length < 69 ) {
                                TL_Dot = "";
                        }
                        let app = tracker.get_window_app(metaWindow);
                        let icon = app.create_icon_texture(14);
                        let item = new MenuItem(metaWindow.get_title().substring(0,68) + TL_Dot, icon,
                                 Lang.bind(this, function() { this.activateWindow(metaWorkspace, metaWindow); }));
                        if(this.close_buttons){
                            let close_icon = new St.Icon({ icon_name: 'window-close', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
                            let close_button = new St.Button({ child: close_icon });
                            close_button.connect('clicked', Lang.bind(this, function(){
                                item.destroy();
                                delete allwins[allwins.indexOf(metaWindow)];
                                metaWindow.delete(global.get_current_time());
                                if(this.SHOW_MENU_ON_CLOSE){
                                    this.uptgg=false;
                                    this._applet_context_menu.toggle();
                                }
                            }));
                            close_button.connect('enter-event', Lang.bind(this, Lang.bind(this, function(){
                                    let _children = item.actor.get_children();
                                    _children[_children.length-1].set_style_class_name('popup-menu-icon');
                                    _children[_children.length-1].add_style_class_name('popup-inactive-menu-item');
                            })));
                            close_button.connect('leave-event', Lang.bind(this, Lang.bind(this, function(){
                                    let _children = item.actor.get_children();
                                    _children[_children.length-1].set_style_class_name('popup-menu-icon');
                            })));
                            item.addActor(close_button, { align: St.Align.END });
                            allwins.push(sticky_windows[i]);
                        }
                        this._applet_context_menu.addMenuItem(item);
                    }
                    empty_menu = false;
                    if(windows.length)
                        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                }

                if(windows.length) {
                    if(wks>0) {
                        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                    }
                    if(global.screen.n_workspaces>1) {
                        let item = new PopupMenu.PopupMenuItem(workspace_name);
                        item.actor.reactive = false;
                        item.actor.can_focus = false;
                        item.label.add_style_class_name('popup-subtitle-menu-item');
                        if(wks == global.screen.get_active_workspace().index()) {
                            item.setShowDot(true);
                        }

                        if(this.close_buttons && this.closeall_buttons){
                            let close_icon = new St.Icon({ icon_name: Gtk.STOCK_DELETE, icon_type: St.IconType.FULLCOLOR, style: 'icon-size: 0.85em;' });
                            let close_button = new St.Button({ child: close_icon });
                            close_button.connect('clicked', Lang.bind(this, function(){
                                let items = this._applet_context_menu._getMenuItems();
                                for (let ii = items.indexOf(item); ii < items.length; ii++){
                                    if (items[ii] instanceof PopupMenu.PopupSeparatorMenuItem)
                                        break;
                                    items[ii].destroy();
                                }
                                for(let wi=0; wi<windows.length;wi++){
                                    if(windows[wi]){
                                        windows[wi].delete(global.get_current_time());
                                        delete allwins[allwins.indexOf(windows[wi])];
                                    }
                                }
                                if(this._applet_context_menu.isOpen){
                                    this._applet_context_menu.toggle();
                                }
                                if(this.SHOW_MENU_ON_CLOSE){
                                    this.uptgg=false;
                                    this._applet_context_menu.toggle();
                                }
                            }));
                            close_button.connect('enter-event', Lang.bind(this, Lang.bind(this, function(){
                                    let _children = item.actor.get_children();
                                    _children[_children.length-1].get_children()[0].style="icon-size: 1em;";
                            })));
                            close_button.connect('leave-event', Lang.bind(this, Lang.bind(this, function(){
                                    let _children = item.actor.get_children();
                                    _children[_children.length-1].get_children()[0].style="icon-size: 0.85em;";
                            })));
                            item.addActor(close_button, { align: St.Align.MIDDLE });
                        }

                        this._applet_context_menu.addMenuItem(item);
                        empty_menu = false;
                    }

                    for ( let i = 0; i < windows.length; ++i ) {
                        let metaWindow = windows[i];
                        TL_Dot='...';
                        if( metaWindow.get_title().length < 69 ) {
                                TL_Dot = "";
                        }
                        let app = tracker.get_window_app(metaWindow);
                        let icon = app.create_icon_texture(14);
                        let item = new MenuItem(metaWindow.get_title().substring(0,68) + TL_Dot, icon,
                                Lang.bind(this, function() { this.activateWindow(metaWorkspace, metaWindow); }));

                        if(this.close_buttons){
                            let close_icon = new St.Icon({ icon_name: 'window-close', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
                            let close_button = new St.Button({ child: close_icon });
                            close_button.connect('clicked', Lang.bind(this, function(){
                                let items = this._applet_context_menu._getMenuItems();
                                let ii = items.indexOf(item);
                                if (items[ii + 1] instanceof PopupMenu.PopupSeparatorMenuItem
                                        && (ii < 2 || items[ii - 2] instanceof  PopupMenu.PopupSeparatorMenuItem))
                                    items[ii - 1].destroy();
                                item.destroy();
                                delete allwins[allwins.indexOf(metaWindow)];
                                delete windows[windows.indexOf(metaWindow)];
                                metaWindow.delete(global.get_current_time());
                                if(this.SHOW_MENU_ON_CLOSE){
                                    this.uptgg=false;
                                    this._applet_context_menu.toggle();
                                }
                            }));
                            close_button.connect('enter-event', Lang.bind(this, Lang.bind(this, function(){
                                    let _children = item.actor.get_children();
                                    _children[_children.length-1].set_style_class_name('popup-menu-icon');
                                    _children[_children.length-1].add_style_class_name('popup-inactive-menu-item');
                            })));
                            close_button.connect('leave-event', Lang.bind(this, Lang.bind(this, function(){
                                    let _children = item.actor.get_children();
                                    _children[_children.length-1].set_style_class_name('popup-menu-icon');
                            })));
                            item.addActor(close_button, { align: St.Align.END });
                            allwins.push(windows[i]);
                        }

                        this._applet_context_menu.addMenuItem(item);
                        empty_menu = false;
                    }
                }
            }
        } catch(e) {
            global.logError(e);
        }
        if (empty_menu) {
            let item = new PopupMenu.PopupMenuItem(_("No open windows"))
            item.actor.reactive = false;
            item.actor.can_focus = false;
            item.label.add_style_class_name('popup-subtitle-menu-item');
            this._applet_context_menu.addMenuItem(item);
        }
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                         let icon=   new St.Icon({ icon_name: 'cinnamon-expo-symbolic',
                                         icon_type: St.IconType.SYMBOLIC,
                                         icon_size: 14 });
        let item = new MenuItem(_("Expo"), icon, Lang.bind(this, function() {
           if (!Main.expo.animationInProgress)
              Main.expo.toggle();
        } ));
        if (allwins.length>0 && this.close_buttons && this.closeall_buttons){
            let close_icon = new St.Icon({ icon_name: Gtk.STOCK_DELETE, icon_type: St.IconType.FULLCOLOR, style: 'icon-size: 0.8em;' });
            let close_button = new St.Button({ child: close_icon });
            close_button.connect('clicked', Lang.bind(this, function(){
                for(let wi=0; wi<allwins.length;wi++){
                    if(allwins[wi])
                        allwins[wi].delete(global.get_current_time());}
                this._applet_context_menu.toggle();
            }));
            close_button.connect('enter-event', Lang.bind(this, Lang.bind(this, function(){
                let _children = item.actor.get_children();
                _children[_children.length-1].get_children()[0].style="icon-size: 1em;";
            })));
            close_button.connect('leave-event', Lang.bind(this, Lang.bind(this, function(){
                let _children = item.actor.get_children();
                _children[_children.length-1].get_children()[0].style="icon-size: 0.8em;";
            })));
            item.addActor(close_button, { align: St.Align.MIDDLE });
        }

        this._applet_context_menu.addMenuItem(item);
    },

    activateWindow: function(metaWorkspace, metaWindow) {
        if (!metaWindow.is_on_all_workspaces())
            metaWorkspace.activate(global.get_current_time());
        metaWindow.unminimize(global.get_current_time());
        metaWindow.activate(global.get_current_time());
    },

    _onToggled: function(actor, isOpening){
        if (isOpening){
            if(this.uptgg)
                this.updateMenu();
            else if (this._applet_context_menu._getMenuItems()[0] instanceof PopupMenu.PopupSeparatorMenuItem &&
              (this._applet_context_menu._getMenuItems().length < 3 ||
                (this._applet_context_menu._getMenuItems().length < 4 && this._applet_context_menu._getMenuItems()[1] instanceof PopupMenu.PopupSeparatorMenuItem)
                || (this._applet_context_menu._getMenuItems().length < 5 &&
                    this._applet_context_menu._getMenuItems()[1] instanceof PopupMenu.PopupSeparatorMenuItem &&
                    this._applet_context_menu._getMenuItems()[2] instanceof PopupMenu.PopupSeparatorMenuItem)
              )
             )
                this._applet_context_menu.toggle();
        }
        this.uptgg=true;
    },

    show_all: function(time) {
        let windows = global.get_window_actors();
        for(let i=0; i<windows.length; i++){
            let window = windows[i].meta_window;
            let compositor = windows[i];
            if(window.get_title()=="Desktop"){
                Tweener.addTween(compositor, { opacity: 255, time: time, transition: "easeOutSine" });
            }
            if (this.blur && compositor.eff){
                compositor.remove_effect(compositor.eff);
            }
        }
        Tweener.addTween(global.window_group, {  opacity: 255, time: time, transition: "easeOutSine" });
        Tweener.addTween(Main.deskletContainer.actor, { opacity: 255, time: time, transition: "easeOutSine" });
    },

    _onEntered: function(event) {
        if (this.h_color !== 'rgba(0,0,0,0)') {
            this.actor.style="background-color:" + this.h_color;
        }
        if (global.screen.get_workspace_by_index(1) != null){
            this.set_applet_tooltip(Main.getWorkspaceName(global.screen.get_active_workspace_index()));
            this._applet_tooltip.show();
        }
        if (this.peek_at_desktop){
            if (this._peektimeoutid)
                Mainloop.source_remove(this._peektimeoutid);
            this._peektimeoutid = Mainloop.timeout_add(400, Lang.bind(this,function () {
                if(this.actor.hover && !this._applet_context_menu.isOpen && ! global.settings.get_boolean("panel-edit-mode")){

                    Tweener.addTween(global.window_group, {opacity: this.peek_opacity, time: 0.275, transition: "easeInSine" });

                        let windows = global.get_window_actors();
                        for(let i=0; i<windows.length; i++){
                            let window = windows[i].meta_window;
                            let compositor = windows[i];
                            if(window.get_title() == "Desktop"){
                                if (this.opacify_skip_taskbar)
                                    Tweener.addTween(compositor, { opacity: this.peek_opacity,time: 0.275,transition: "easeInSine" });
                                else
                                    continue;
                                //break;
                            }

                            if (this.blur){
                                if (!compositor.eff) compositor.eff = new Clutter.BlurEffect();
                                compositor.add_effect_with_name('blur',compositor.eff);
                            }
                        }

                    if (this.opacify_desklets){
                        Tweener.addTween(Main.deskletContainer.actor, { opacity: this.peek_opacity, time: 0.275, transition: "easeInSine" });
                    }
                    this.didpeek=true;
                }

            }));
        }
    },

    _onLEntered: function(event) {
        // Only set the hover color if explicitly set, otherwise it will be invisible.
        if (this.h_color !== 'rgba(0,0,0,0)') {
            this.actor.style="background-color: rgba(255,255,255,0)";
        }
        if(this.didpeek){
            this.show_all(0.2);
            this.didpeek=false;
        }
        if (this._peektimeoutid)
            Mainloop.source_remove(this._peektimeoutid);
    },

    on_applet_clicked: function(event) {
        global.screen.toggle_desktop(global.get_current_time());
        this.show_all(0);
        if (this._peektimeoutid)
            Mainloop.source_remove(this._peektimeoutid);
        this.didpeek=false;
    },

    width_changed: function() {
        // Only use a custom width if one is explicitly set, otherwise it will overlap icons in default themes.
        if (this.width !== 15) {
            this.actor.width = this.width;
        }
    },

    on_settings_changed: function() {
        let icon_file = Gio.File.new_for_path(this.icon_name);
        if (icon_file.query_exists(null))
           this.set_applet_icon_path(this.icon_name);
        else
           this.set_applet_icon_name(this.icon_name);
    },

    on_applet_removed_from_panel: function() {
        let windows = global.get_window_actors();
        for(let i=0;i<windows.length;i++){
            let window = windows[i].meta_window;
            if(window.get_title()=="Desktop"){
                let compositor = window.get_compositor_private();
                Tweener.addTween(compositor, {
                    opacity: 255,
                    time: 0,
                    transition: "easeOutSine"
                });
                break;
            }
        }
        Tweener.addTween(global.window_group, {
            opacity: 255,
            time: 0,
            transition: "easeOutSine"
        });
        Tweener.addTween(Main.deskletContainer.actor, {
            opacity: 255,
            time: 0,
            transition: "easeOutSine"
        });
        this.settings.finalize();    // This is called when a user removes the applet from the panel.. we want to
                                     // Remove any connections and file listeners here, which our settings object
                                     // has a few of
        this.signals.disconnectAllSignals();
    },

    handleDragOver: function(source, actor, x, y, time) {
        global.screen.show_desktop(global.get_current_time());
    },

    _onScrollEvent: function(actor, event) {
        //switch workspace
        if (this._peektimeoutid)
            Mainloop.source_remove(this._peektimeoutid);
        var index = global.screen.get_active_workspace_index() + event.get_scroll_direction() * 2 - 1;
        if(global.screen.get_workspace_by_index(index) != null){
            global.screen.get_workspace_by_index(index).activate(global.get_current_time());
            this.set_applet_tooltip(Main.getWorkspaceName(global.screen.get_active_workspace_index()));
            this._applet_tooltip.show();
            this.updateMenu();
        }
    }
};

function main(metadata, orientation, panelHeight, instance_id) {  // Make sure you collect and pass on instanceId
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
    return myApplet;
}
