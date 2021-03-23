const Lang = imports.lang;
const St = imports.gi.St;
const UUID = "systray-collapsible@koutch";
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Gettext = imports.gettext;
///@koutch new const
const Tooltips = imports.ui.tooltips;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
/// Cinnamon settings
const Settings = imports.ui.settings;  // Needed for settings API
const Util = imports.misc.util;
const Config = imports.misc.config; // To check cinnamon version to show/hide settings in context menu 
///---

const ICON_SCALE_FACTOR = .88; // for custom panel heights, 22 (default icon size) / 25 (default panel height)

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation, panel_height, instance_id) {///@koutch instance_id needed for settings API
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,
///@koutch function modified
    _init: function(orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.actor.remove_style_class_name("applet-box");

        this._signals = { added: null,
                          removed: null,
                          redisplay: null,
///@koutch +++
                          after_redisplay: null };

        ///Settings
        this.settings = new Settings.AppletSettings(this, "systray-collapsible@koutch", instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, "new-icon-time", "new_icon_time", this.on_applet_clicked, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "expand-time", "expand_time", this.on_applet_clicked, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "auto-export-to-file", "auto_export_to_file", this.on_applet_clicked, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "expand-icon-name", "expand_icon_name", this._setTray_button_icons, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "collapse-icon-name", "collapse_icon_name", this._setTray_button_icons, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "style-class", "style_class", this._setActorStyle, null);
        ///@koutch to show players support by "Sound applet player". this._onDragEnd is to redisplay system tray 
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-hidden-player", "show_hidden_player", this._onDragEnd, null);
        ///to save icons_hide_by_user values in Cinnamon settings API
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "icons-hide-by-user", "icons_hide_by_user_settings",  this._loadIconsHideByUser, null);
		///@mank319 whether or not to expand on hovering the expand button
		this.settings.bindProperty(Settings.BindingDirection.IN, "expand-on-hover", "expand_on_hover", this._updateTray_button, null);
		
        this.tray_icon_open =  new St.Icon();
        this.tray_icon_close =  new St.Icon();
        this.tray_button = new St.Button();

        this.tray_button._isAdded = false;
        this.tray_isExpand = false;
        this.tray_switch_isOnToggle = false;
        this.tray_newHiddenIcon_Added = false;

        this.hidden_actor = new St.BoxLayout({});/// store hidden icons to keep them in bin box for "_onTrayIconRemoved" function
		
        this.actual_hidden_role = [];
        this.actual_shown_role = [];
        this.added_icons =[];/// to fix icons are replaced by grey icons after dragging after dragging

        this._loadIconsHideByUser();

        this._setActorStyle(); /// replace this.actor.style="spacing: 5px;";

///---
   },

    on_applet_clicked: function(event) {
    },
///@koutch function modified
    on_applet_removed_from_panel: function () {
        Main.statusIconDispatcher.disconnect(this._signals.added);
        Main.statusIconDispatcher.disconnect(this._signals.removed);
        Main.statusIconDispatcher.disconnect(this._signals.redisplay);
///@koutch +++
        Main.statusIconDispatcher.disconnect(this._signals.after_redisplay);

        this._clean_timeoutId();
        this.settings.finalize();    // This is called when a user removes the applet from the panel
///---
    },
///@koutch function modified
    on_applet_added_to_panel: function() {
        this._signals.added = Main.statusIconDispatcher.connect('status-icon-added', Lang.bind(this, this._onTrayIconAdded));
        this._signals.removed = Main.statusIconDispatcher.connect('status-icon-removed', Lang.bind(this, this._onTrayIconRemoved));
        this._signals.redisplay = Main.statusIconDispatcher.connect('before-redisplay', Lang.bind(this, this._onBeforeRedisplay));
///@koutch +++
        this._signals.after_redisplay = Main.statusIconDispatcher.connect('after-redisplay', Lang.bind(this, this._onAfterRedisplay));
        this._setTray_button_icons();
///---
    },

    on_panel_height_changed: function() {
        Main.statusIconDispatcher.redisplay();
    },
///@koutch function modified
    _onBeforeRedisplay: function() {
       let children = this.actor.get_children();
        for (var i = 0; i < children.length; i++) {
            children[i].destroy();
        }
///@koutch +++
       children = this.hidden_actor.get_children();
        for (var i = 0; i < children.length; i++) {
            if (children[i]._TimeoutId)
             Mainloop.source_remove(children[i]._TimeoutId);
             children[i].destroy();
        }

        this.tray_button._isAdded = false; /// if there is tray_button, it has juste been destroyed
        this.added_icons =[];
///---
    },
///@koutch function modified
    _onTrayIconAdded: function(o, icon, role) {
        try {

            let hiddenIcons = ["network", "power", "keyboard", "gnome-settings-daemon", "volume", "bluetooth", "bluetooth-manager", "battery", "a11y", "banshee", "tomahawk", "clementine", "amarok"];
            let buggyIcons = ["pidgin", "thunderbird"];
            if (this.show_hidden_player){
		///@koutch to show players support by "Sound applet player"
		hiddenIcons = ["network", "power", "keyboard", "gnome-settings-daemon", "volume", "bluetooth", "bluetooth-manager", "battery", "a11y"];
            }
            if (hiddenIcons.indexOf(role) != -1 ) {
                // We've got an applet for that
                return;
            }

/// global.log("Adding systray: " + role + " (" + icon.get_width() + "x" + icon.get_height() + "px)"); replace in "_insertStatusItem"

///@koutch +++
            ///@koutch to fix icons are replaced by grey icons after dragging
            if (this.added_icons.indexOf(role) != -1){
                return; /// prevent adding several same icons
            }
            this.added_icons[this.added_icons.length] = role;
///---
            let box = new St.Bin({ style_class: 'panel-status-button', reactive: true, track_hover: true});
            let iconParent = icon.get_parent();
            if (iconParent) {
                iconParent.remove_actor(icon);
///@koutch +++
                if (iconParent._rolePosition){ /// iconParent belonging to this.actor or this.hidden_actor
                    if (iconParent._TimeoutId)  /// iconParent belonging to this.hidden_actor
                        Mainloop.source_remove(iconParent._TimeoutId);
                    iconParent.destroy();
                }
            }
///---
            box.add_actor(icon);

            this._insertStatusItem(box, -1, icon, role);
            let width = 22;
            let height = 22;
            let themeNode = box.get_theme_node();

            if ( themeNode ) { ///@koutch prevent error "themeNode is null" e.g happen with Exaile
                if (themeNode.get_length('width')) {
                    width = themeNode.get_length('width');
                }
                if (themeNode.get_length('height')) {
                    height = themeNode.get_length('height');
                }
            }
            if (global.settings.get_boolean('panel-scale-text-icons')) {
                width = Math.floor(this._panelHeight * ICON_SCALE_FACTOR);
                height = Math.floor(this._panelHeight * ICON_SCALE_FACTOR);
            }

            if (icon.get_width() == 1 || icon.get_height() == 1 || buggyIcons.indexOf(role) != -1) {
                icon.set_height(height);
            }
            else {
                icon.set_size(width, height);
            }
        }
        catch (e) {
            global.logError(e);
        }
    },
///@koutch function modified
    _onTrayIconRemoved: function(o, icon) {
        let box = icon.get_parent();
        if (box && box instanceof St.Bin){
///@koutch +++
            global.log("Removing systray: " + box._role); /// like on adding icons :)
            if (this.added_icons.indexOf(box._role) != -1)
                this.added_icons.splice(this.added_icons.indexOf(box._role),1);

            if (this.actual_hidden_role.indexOf(box._role) != -1){ /// look for hidden icon if tray is expand
                this.actual_hidden_role.splice(this.actual_hidden_role.indexOf(box._role),1);
            }
            if (this.actual_shown_role.indexOf(box._role) != -1)
                this.actual_shown_role.splice(this.actual_shown_role.indexOf(box._role),1);

            if (box._TimeoutId)
                    Mainloop.source_remove(box._TimeoutId);
///---
            box.destroy();
///+++
            if (this._updateTray_buttonTimeoutId)/// prevent several call
                Mainloop.source_remove(this._updateTray_buttonTimeoutId);
            this._updateTray_buttonTimeoutId = Mainloop.timeout_add(1, Lang.bind(this, function() {
                this._updateTray_button();
            }));
 ///---
       }
    },
///@koutch function modified
    _insertStatusItem: function(actor, position, icon, role) {
/// +++
        if ( this.icons_hide_by_user.indexOf(role) != -1 ){
            if (this.actual_hidden_role.indexOf(role) == -1){
                this.actual_hidden_role[this.actual_hidden_role.length] = role;
                global.log("Hiding systray: " + role);
            }

            if (this.actual_shown_role.indexOf(role) != -1)
                this.actual_shown_role.splice(this.actual_shown_role.indexOf(role),1);

            ///@koutch set position to keep the order of addition and put hidden after shown icon
            if (position == -1) { ///ensure this is not this.tray_button
                position = this.actual_shown_role.length + this.actual_hidden_role.indexOf(role);
            }
        }
        else {
            if (this.actual_shown_role.indexOf(role) == -1 && role != 'tray_icon'){
                this.actual_shown_role[this.actual_shown_role.length] = role;
                global.log("Adding systray: " + role);
            }

            if (this.actual_hidden_role.indexOf(role) != -1)
                this.actual_hidden_role.splice(this.actual_hidden_role.indexOf(role),1);

            ///@koutch set position to keep the order of addition
            if (position == -1) { ///ensure this is not this.tray_button
                position = this.actual_shown_role.indexOf(role);
            }
        }
///---
        let children = this.actor.get_children();
        let i;
        for (i = children.length - 1; i >= 0; i--) {
            let rolePosition = children[i]._rolePosition;
            if (position < rolePosition) { ///@koutch replace ' > ' by ' < ' to keep the order of addition with the first icon on de right (children[0] is on the left)
                this.actor.insert_actor(actor, i + 1);
                break;
            }
        }
        if (i == -1) {
            // If we didn't find a position, we must be first
             this.actor.insert_actor(actor, 0);
        }

        actor._rolePosition = position;
///@koutch +++
        actor._icon = icon; ///for _hide_icon function
        actor._role = role; ///for _hide_icon function

        if ( this.icons_hide_by_user.indexOf(role) != -1 ){ /// test if icon has to be hide
            if (!this.tray_isExpand){ /// ensure tray isn't expand otherwise the icon will be hide during collapse
                if (this.tray_switch_isOnToggle){ /// when an icon state toggle from hide to show in context menu
                    this._hide_icon(role);         /// "Main.statusIconDispatcher.redisplay()" is called
                }                                 /// but hidden icons have not to be shown as if it is a new icon
                else {
                    this.tray_newHiddenIcon_Added = true;
                    actor._TimeoutId = Mainloop.timeout_add_seconds(this.new_icon_time, Lang.bind(this, function() {
                        this.tray_newHiddenIcon_Added = false;
                        this._hide_icon(role);
                    }));
                }
            }
        }

        if (this._updateTray_buttonTimeoutId) /// prevent several call
            Mainloop.source_remove(this._updateTray_buttonTimeoutId);
        this._updateTray_buttonTimeoutId = Mainloop.timeout_add(1, Lang.bind(this, function() {
            this._updateTray_button();
        }));
///---
    },
///@koutch new functions
    _hide_icon: function(role) {
        let children = this.actor.get_children();
            for (var i = 0; i < children.length; i++) {
                if (children[i]._role == role ){ /// it is the icon to hide
                    let iconParent = children[i]._icon.get_parent();
                    let icon = children[i]._icon
                    if (iconParent )
                        iconParent.remove_actor(icon);
                    if (iconParent._TimeoutId)
                        Mainloop.source_remove(iconParent._TimeoutId);

                    let hiddenBox = new St.Bin({}); /// to keep icon in a Bin box for "_onTrayIconRemoved"
                    hiddenBox.add_actor(icon);
                    this.hidden_actor.insert_actor(hiddenBox,0);
                    hiddenBox._role = role; /// add role to update "this.added_icons/this.actual_hidden_role/this.actual_shown_role" in "_onTrayIconRemoved"

                    iconParent.destroy();

                    if (this.actual_hidden_role.indexOf(role) == -1){
                        this.actual_hidden_role[this.actual_hidden_role.length] = role;
                        global.log("Hiding systray: " + role);
                    }
                    if (this.actual_shown_role.indexOf(role) != -1){
                        this.actual_shown_role.splice(this.actual_shown_role.indexOf(role),1);
                    }
                }
            }
            if (this._updateTray_buttonTimeoutId)/// prevent several call
                Mainloop.source_remove(this._updateTray_buttonTimeoutId);
            this._updateTray_buttonTimeoutId = Mainloop.timeout_add(1, Lang.bind(this, function() {
                this._updateTray_button();
            }));

    },

    _onButtonReleaseEvent: function (actor, event) {
        Applet.IconApplet.prototype._onButtonReleaseEvent.call(this, actor, event);
        if (event.get_button()==3)///right click
            this._update_context_menu();
        return true;
    },

    _onButtonPressEvent: function (actor, event) {
        Applet.IconApplet.prototype._onButtonPressEvent.call(this, actor, event);
        if (event.get_button()==3)///right click
            this._update_context_menu();
        return true;
    },

    _onDragBegin: function() {
        this._onBeforeRedisplay(); ///to destroy all icons
        this._clean_timeoutId();
    },

    _onDragEnd: function() {
        this._onBeforeRedisplay(); ///to destroy all icons
        if (this._timeout_drag_Id)
            Mainloop.source_remove(this._timeout_drag_Id);

        this._timeout_drag_Id = Mainloop.timeout_add_seconds(1, Lang.bind(this, function() {
            Main.statusIconDispatcher.redisplay();
        }));
    },

    _onDragCancelled: function() {
        this._onBeforeRedisplay(); ///to destroy all icons
        if (this._timeout_drag_Id)
            Mainloop.source_remove(this._timeout_drag_Id);

        this._timeout_drag_Id = Mainloop.timeout_add_seconds(1, Lang.bind(this, function() {
            Main.statusIconDispatcher.redisplay();
        }));
    },

    _onAfterRedisplay: function() {
        if (this._timeout_drag_Id)
            Mainloop.source_remove(this._timeout_drag_Id);
     },

    _setActorStyle: function() {
        /// you can edit stylesheet.css to customize the applet
        switch(this.style_class){
            case "option 1" : /// Gradient Style with hover effect
                this.actor.remove_style_class_name('systray-collapsible-gradient');
                this.actor.remove_style_class_name('systray-collapsible-border');
                this.actor.add_style_class_name('systray-collapsible-gradient');

                this.actor.connect('enter-event', Lang.bind(this, Lang.bind(this, function(){
                    this.actor.add_style_pseudo_class('focus');
                } )));
                this.actor.connect('leave-event', Lang.bind(this, Lang.bind(this, function(){
                    this.actor.remove_style_pseudo_class('focus');
                } )));
                break;

            case "option 2" : /// Gradient Style without hover effect
                this.actor.remove_style_class_name('systray-collapsible-gradient');
                this.actor.remove_style_class_name('systray-collapsible-border');
                this.actor.add_style_class_name('systray-collapsible-gradient');

                this.actor.connect('enter-event', Lang.bind(this, Lang.bind(this, function(){
                    this.actor.remove_style_pseudo_class('focus');
                } )));
                this.actor.connect('leave-event', Lang.bind(this, Lang.bind(this, function(){
                    this.actor.remove_style_pseudo_class('focus');
                } )));
                break;

            case "option 3" : /// Border Style with hover effect
                this.actor.remove_style_class_name('systray-collapsible-gradient');
                this.actor.remove_style_class_name('systray-collapsible-border');
                this.actor.add_style_class_name('systray-collapsible-border');

                this.actor.connect('enter-event', Lang.bind(this, Lang.bind(this, function(){
                    this.actor.add_style_pseudo_class('focus');
                } )));
                this.actor.connect('leave-event', Lang.bind(this, Lang.bind(this, function(){
                    this.actor.remove_style_pseudo_class('focus');
                } )));
                break;

            case "option 4" : /// Border Style without hover effect
                this.actor.remove_style_class_name('systray-collapsible-gradient');
                this.actor.remove_style_class_name('systray-collapsible-border');
                this.actor.add_style_class_name('systray-collapsible-border');
                this.actor.connect('enter-event', Lang.bind(this, Lang.bind(this, function(){
                    this.actor.remove_style_pseudo_class('focus');
                } )));
                this.actor.connect('leave-event', Lang.bind(this, Lang.bind(this, function(){
                    this.actor.remove_style_pseudo_class('focus');
                } )));
  
                break;
        }
    },

    _setTray_button_icons: function() {
        try {/// @koutch --- try loading expand icon ---
            let icon_open_file = Gio.File.new_for_path(this.expand_icon_name);
            if (icon_open_file.query_exists(null)) { /// this.expand_icon_name is a path
                let gicon_open = new Gio.FileIcon({ file: Gio.file_new_for_path(this.expand_icon_name) });
                let icon_open =  new St.Icon({ gicon: gicon_open, style_class: 'popup-menu-icon' });
                this.tray_icon_open = icon_open;
            }
            else {
                let icon_open = new St.Icon({ icon_name: this.expand_icon_name, style_class: 'popup-menu-icon' });
                this.tray_icon_open = icon_open;
            }
        }
        catch (e)  {
            global.logError('Systray-collapsible@koutch ; Failed to load icon file ' + this.expand_icon_name + ' : ' + e);
            let icon_open = new St.Icon({ icon_name: 'go-previous-symbolic', style_class: 'popup-menu-icon' });
            this.tray_icon_open = icon_open;
        }

        try {/// @koutch --- try loading collapse icon ---
            let icon_close_file = Gio.File.new_for_path(this.collapse_icon_name);
            if (icon_close_file.query_exists(null)) { /// this.collapse_icon_name is a path
                let gicon_close = new Gio.FileIcon({ file: Gio.file_new_for_path(this.collapse_icon_name) });
                let icon_close =  new St.Icon({ gicon: gicon_close, style_class: 'popup-menu-icon' });
                this.tray_icon_close = icon_close;
            }
            else {
                let icon_close = new St.Icon({ icon_name: this.collapse_icon_name, style_class: 'popup-menu-icon' });
                this.tray_icon_close = icon_close;
            }
        }
        catch (e)  {
            global.logError('Systray-collapsible@koutch ; Failed to load icon file ' + this.collapse_icon_name + ' : ' + e);
            let icon_close = new St.Icon({ icon_name: 'go-next-symbolic', style_class: 'popup-menu-icon' });
            this.tray_icon_close = icon_close;
        }
        /// update tray icon
        if (this.tray_button._isAdded){
            if (this.tray_isExpand || this.tray_newHiddenIcon_Added)
                this.tray_button.set_child(this.tray_icon_close);
            else
                this.tray_button.set_child(this.tray_icon_open);
        }
    },

    _addTray_button: function() {
        this.tray_button = new St.Button({ child: this.tray_icon_close, style_class: 'panel-status-button' });

        this.tray_button.connect('button-release-event', Lang.bind(this, function(o,event){
            this._applet_context_menu.close();
            if (!global.settings.get_boolean('panel-edit-mode')){ ///
                if (event.get_button()==1)///left click
                    this._expandTray(this.expand_time);

                if (event.get_button()==3){///right click
                    this._update_context_menu();
                    //this._applet_context_menu.toggle();
                }
            }
        }));
		
		///@mank319 Catch enter-event to expand on hovering the button
		this.tray_button.connect('enter-event', Lang.bind(this, function(o, event){
			/*  
			 * Expand if the following criteria is met:
			 * -expand on hover activated
			 * -it is not expanded already (to avoid collapse on hover)
			 * -panel edit mode is off
			 */
			if (this.expand_on_hover && !this.tray_isExpand && !global.settings.get_boolean('panel-edit-mode')) {
             this._expandTray(this.expand_time);
			}
		}));

        let tray_icon_box = new St.Bin({ style_class: 'panel-status-button', reactive: true});
        tray_icon_box.add_actor(this.tray_button);
        this._insertStatusItem(tray_icon_box, 1000, null, 'tray_icon'); ///@koutch position = '1000' to ensure 'tray_icon_box' stay first

        this.tray_button._isAdded = true;
        this._setTray_button_icons();
    },

    _updateTray_button: function(){
        if (this.actual_hidden_role.length == 0 && this.tray_button._isAdded){ ///remove tray_button if no hidden icons
            let children = this.actor.get_children();
            if (children[0]._role == 'tray_icon' ) /// ensure tray icon is displayed
                children[0].destroy();
            this.tray_button._isAdded = false;
        }
        else {
            if (this.tray_button._isAdded)
                this._setTray_button_icons();
            else {
                if (this.actual_hidden_role.length > 0){
                    this.tray_button._isAdded = true; /// to prevent serveral add
                    this._addTray_button();
                }
            }
        }
    },

    _expandTray: function(time){
        if (!this.tray_isExpand && !this.tray_newHiddenIcon_Added) {
            this.tray_isExpand = true;
            if (this._tray_buttonTimeoutId)
                Mainloop.source_remove(this._tray_buttonTimeoutId);
            this._tray_buttonTimeoutId = Mainloop.timeout_add_seconds(time, Lang.bind(this, function() {
                this._collapseTray();
            }));
            Main.statusIconDispatcher.redisplay();
        }
        else {
            this.tray_newHiddenIcon_Added = false;
            this._collapseTray();
        }
    },

    _collapseTray: function(){
        this.tray_isExpand = false;
        if (this.tray_button._isAdded)
            this._setTray_button_icons();

        for (let i = 0; i< this.icons_hide_by_user.length; i++){
            if ( this.actual_hidden_role.indexOf(this.icons_hide_by_user[i]) != -1 )
                this._hide_icon(this.icons_hide_by_user[i]);
        }
        if (this._tray_buttonTimeoutId)
            Mainloop.source_remove(this._tray_buttonTimeoutId);

    },

    _update_context_menu: function() {
        this._applet_context_menu.removeAll();
        let hidden_icons_displayed = []; /// a part of hidden icons might be displayed (e.g. when new hidden icon is added)
        let children = this.actor.get_children();
        ///@koutch set switch state of displayed icons
        for (let i = children.length - 1; i >= 0; i--){ /// from children.length - 1 to 0 to keep icons order
            if (children[i]._role != 'tray_icon'){
                let switch_state = true;
                if (this.icons_hide_by_user.indexOf(children[i]._role) != -1 ) {
                    switch_state = false;
                    hidden_icons_displayed[hidden_icons_displayed.length] = children[i]._role;
                }
                let switch_item = new PopupMenu.PopupSwitchMenuItem(children[i]._role, switch_state);
                let toggle_role = children[i]._role;
                switch_item.connect('toggled', Lang.bind(this, function(){
                    this._on_switch_toggled(toggle_role);
                    this._applet_context_menu.toggle();
                }));

                this._applet_context_menu.addMenuItem(switch_item);
            }
        }
        ///@koutch set switch state of hidden icons
        this._previous_icon_menu = new PopupMenu.PopupSubMenuMenuItem(_("Previous") + " " + _("Icons"), {expend:false }); /// to group inactive icons

        for (let i = this.icons_hide_by_user.length - 1; i >= 0; i--){ /// from this.icons_hide_by_user.length - 1 to 0 to keep icons order
            if ( hidden_icons_displayed.indexOf(this.icons_hide_by_user[i]) == -1 ){ /// hidden_icons_displayed has been list befor
                if ( this.actual_hidden_role.indexOf(this.icons_hide_by_user[i]) != -1) { /// icon is hidden but active
                    let switch_item = new PopupMenu.PopupSwitchMenuItem(this.icons_hide_by_user[i], false);
                    let toggle_role = this.icons_hide_by_user[i];
                    switch_item.connect('toggled', Lang.bind(this, function(){
                        this._on_switch_toggled(toggle_role);
                        this._applet_context_menu.toggle();
                   }));
                    this._applet_context_menu.addMenuItem(switch_item);
                }
                else { /// icon is hidden and inactive : replace PopupSwitchMenuItem by PopupMenuItem with close button
                    let item = new PopupMenu.PopupMenuItem("  - " + this.icons_hide_by_user[i]);
                    let toggle_role = this.icons_hide_by_user[i];
                    let close_icon = new St.Icon({ icon_name: 'window-close', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
                    let close_button = new St.Button({ child: close_icon });
                    close_button.connect('clicked', Lang.bind(this, function(){
                       this._on_switch_toggled(toggle_role); /// close button has the same function as switch button
                       this._applet_context_menu.toggle();
                       this._previous_icon_menu.activate();
                    }));
                    item.addActor(close_button, { align: St.Align.END });
                    this._previous_icon_menu.menu.addMenuItem(item); /// add to the group of missing icons (this._previous_icon_menu)
                }
            }
        }

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); /// add Separator before the group of missing icons abd settings
        this._applet_context_menu.addMenuItem(this._previous_icon_menu);

        ///@koutch add Settings to context_menu

        if (!this.auto_export_to_file) {
            this.save_menu_item = new PopupMenu.PopupMenuItem(_("Export to a file"));
            this.save_menu_item.connect('activate', Lang.bind(this, function () {
                this._saveIconsHideByUser();
            }));
            this._applet_context_menu.addMenuItem(this.save_menu_item);
        }

        /// @koutch check Cinnamon version
        let cinnamonVersion = Config.PACKAGE_VERSION.split('.')
        let majorVersion = parseInt(cinnamonVersion[0])

        // for Cinnamon 1.x, build a menu item
        if (majorVersion < 2) {
            this.edit_menu_item = new PopupMenu.PopupImageMenuItem(_("Settings"), "system-run-symbolic");
            this.edit_menu_item = new PopupMenu.PopupImageMenuItem(_("Configure..."), "system-run-symbolic");
            this.edit_menu_item.connect('activate', Lang.bind(this, function () {
                Util.spawnCommandLine('cinnamon-settings applets systray-collapsible@koutch');
            }));		
            this._applet_context_menu.addMenuItem(this.edit_menu_item);
        }
        else { 
	    this.context_menu_item_remove = null;
	    this.context_menu_separator = null;
	    this.context_menu_item_configure = null;
	    this.finalizeContextMenu();
	}
		
        this._applet_context_menu.open();

    },


    _on_switch_toggled: function(role) {
        if (this.icons_hide_by_user.indexOf(role) == -1 ) {
            this.icons_hide_by_user[this.icons_hide_by_user.length] = role;
            this._hide_icon(role);
            if (this._timeout_switch_Id)
                Mainloop.source_remove(this._timeout_switch_Id);
            this._timeout_switch_Id = Mainloop.timeout_add(1, Lang.bind(this, function(){
                this._applet_context_menu.toggle(); ///@koutch need a moment befor toggle
            }));
        }
        else {
            this.icons_hide_by_user.splice(this.icons_hide_by_user.indexOf(role),1);
            if (!this.tray_isExpand) {
                this.tray_switch_isOnToggle = true;///@koutch prevent all hidden icons considered as new icons in "_insertStatusItem"
                Main.statusIconDispatcher.redisplay();
            }
            if (this._timeout_switch_Id)
                Mainloop.source_remove(this._timeout_switch_Id);
            this._timeout_switch_Id = Mainloop.timeout_add(1, Lang.bind(this, function(){
                this._applet_context_menu.toggle(); ///@koutch need a moment befor toggle
                this.tray_switch_isOnToggle = false;///@koutch prevent systray expanding
            }));
        }
        this._update_context_menu();
        if (this.auto_export_to_file)
            this._saveIconsHideByUser();
    },

    _clean_timeoutId: function() {
        if (this._timeout_switch_Id)
            Mainloop.source_remove(this._timeout_switch_Id);
        if (this._tray_buttonTimeoutId)
            Mainloop.source_remove(this._tray_buttonTimeoutId);
        if (this._updateTray_buttonTimeoutId)
            Mainloop.source_remove(this._tray_buttonTimeoutId);
        if (this._timeout_drag_Id)
            Mainloop.source_remove(this._timeout_drag_Id);
        let children = this.hidden_actor.get_children();
        for (var i = 0; i < children.length; i++) {
            if (children[i]._TimeoutId)
                Mainloop.source_remove(children[i]._TimeoutId);
        }
    },

    _loadIconsHideByUser: function() {
        try {
            this.icons_hide_by_user = JSON.parse(this.icons_hide_by_user_settings);
        }
        catch(e) {
            global.logError("Systray-collapsible@koutch ; unable to load icons-hide-by-user in settings API. Using default values : " + e );
            this.icons_hide_by_user = JSON.parse("[]");
        }
    },

    _saveIconsHideByUser: function() {
        this.icons_hide_by_user_settings = JSON.stringify(this.icons_hide_by_user);
    }
///---
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
