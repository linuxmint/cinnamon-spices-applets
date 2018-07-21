const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "show-hide-applets@mohammad-sn"
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            Gtk.IconTheme.get_default().append_search_path(metadata.path);
            this.set_applet_icon_symbolic_name("1");

            this.settings = new Settings.AppletSettings(this, "show-hide-applets@mohammad-sn", this.instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN, "autohide", "auto_hide", Lang.bind(this, function(){
                    if (this._hideTimeoutId & !this.auto_hide){
                        Mainloop.source_remove(this._hideTimeoutId);
                        this._hideTimeoutId = 0;
                    }
                    else if(this.auto_hide & this.h)
                        this.autodo(true);
                }), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "disablestarttimeautohide", "disable_starttime_autohide", function(){}, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "hoveractivates", "hover_activates", function(){}, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "hoveractivateshide", "hover_activates_hide", function(){}, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "hidetime", "hide_time", function(){}, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "hovertime", "hover_time", function(){}, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "autohiders", "autohide_rs", Lang.bind(this,function () {
                    if(!this.h){
                        //this.h=true;
                        this.doAction(true);
                        this.autodo(true);
                    }
                }), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "autohiderstime", "autohide_rs_time", function(){}, null);



            let editMode = global.settings.get_boolean("panel-edit-mode");
            this.panelEditMode = new PopupMenu.PopupSwitchMenuItem(_("Panel Edit mode"), editMode);
            this.panelEditMode.connect('toggled', function(item) {
                global.settings.set_boolean("panel-edit-mode", item.state);
            });
            this._applet_context_menu.addMenuItem(this.panelEditMode);

            let addapplets = new PopupMenu.PopupMenuItem(_("Add applets to the panel"));
            let addappletsicon = new St.Icon({icon_name: "applets", icon_size: 22, icon_type: St.IconType.FULLCOLOR });
            addapplets.connect('activate', function() {
                Util.spawnCommandLine("cinnamon-settings applets");
            });
            addapplets.addActor(addappletsicon, { align: St.Align.END });
            this._applet_context_menu.addMenuItem(addapplets);



            global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
            this.actor.connect('enter-event', Lang.bind(this, this._onEntered));



            this.h = true;
            this.alreadyH = [];
            if((!this.disable_starttime_autohide) || this.auto_hide){
                this._hideTimeoutId = Mainloop.timeout_add_seconds(2, Lang.bind(this,function () {
                    if(this.h)
                        this.autodo(true);
                }));
            }



            /*if more than one instance
            this.actor.connect('hide', Lang.bind(this, function(){
                if (this.h)
                    this.doAction(true);
            }));*/

            this.cbox = Main.panel._rightBox;

            /*this doesn't work, i don't know why!
            if (Main.panel2 !== null){
                let c2=Main.panel2._rightBox.get_children();
                if (c2.indexOf(this.actor) > -1)
                    this.cbox = Main.panel2._rightBox;
            }*/

            if (this._rshideTimeoutId){
                Mainloop.source_remove(this._rshideTimeoutId);
                this._rshideTimeoutId = 0;
            }

            this.cbox.connect('queue-relayout', Lang.bind(this, Lang.bind(this, function(actor, m){
                if (this.autohide_rs && !this.h){
                    this._rshideTimeoutId = Mainloop.timeout_add_seconds(this.autohide_rs_time, Lang.bind(this,function () {
                        if(!this.h){
                            //this.h=true;
                            this.doAction(true);
                            this.autodo(true);
                        }
                        return false;
                    }));
                }
            })));
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.doAction(true);
    },

    _onEntered: function(event) {
        if(!this.actor.hover && this.hover_activates && !global.settings.get_boolean("panel-edit-mode"))
            this._showTimeoutId = Mainloop.timeout_add(this.hover_time, Lang.bind(this,function () {
                if(this.actor.hover && (this.hover_activates_hide || !this.h))
                    this.doAction(true);
            }));
    },

    doAction: function(updalreadyH) {
        if (this._hideTimeoutId){
            Mainloop.source_remove(this._hideTimeoutId);
            this._hideTimeoutId = 0;
        }
        let _children = this.cbox.get_children();
        let p = _children.indexOf(this.actor);
        if(this.h){
            if (updalreadyH)
                this.alreadyH=[];
            this.set_applet_icon_symbolic_name("2");
            for(let i = p - 1; i > -1; i--){
                if(!_children[i].visible && updalreadyH)
                    this.alreadyH.push(_children[i]);
                if(_children[i]._applet._uuid=="systray@cinnamon.org" || _children[i]._applet._uuid=="systray@cinnaman"){
                    this.tray = _children[i];
                    let tis = _children[i].get_first_child().get_children();
                    for(j in tis){
                        tis[j].set_size(0, 0);
                    }
                    Mainloop.timeout_add(10, Lang.bind(this, function(){
                        this.tray.hide();
                        return false;
                    }));
                    continue;
                    //this.traysize =
                }
                _children[i].hide();
//                if(_children[i]._applet._uuid=="systray@cinnamon.org" || _children[i]._applet._uuid=="systray-collapsible@koutch"){
//                    this.sta=_children[i];
//                    this.stai=i;
//                    this.cbox.remove_actor(_children[i]);
//                }
            }
        }
        else{
            this.set_applet_icon_symbolic_name("1");
            for(let i = 0; i < p; i++){
                if(this.alreadyH.indexOf(_children[i])<0)
                    _children[i].show();
                if(_children[i]._applet._uuid=="systray@cinnaman"){
                    let htis = _children[i].get_first_child().get_children();
                    for(j in htis){
                        htis[j].set_size(16, 16);
                    }
                }
                if(_children[i]._applet._uuid=="systray@cinnamon.org"){
                    let htis = _children[i].get_first_child().get_children();
                    for(j in htis){
                        htis[j].set_size(20, 20);
                    }
                }
            }
            if (this.sta){
                this.cbox.insert_actor(this.sta,this.stai);
                Main.statusIconDispatcher.redisplay();
            }

            if(this.auto_hide & !global.settings.get_boolean("panel-edit-mode"))
                this._hideTimeoutId = Mainloop.timeout_add_seconds(this.hide_time, Lang.bind(this,function(){this.autodo(updalreadyH);}));
        }
        this.h = !this.h;
    },

    on_panel_edit_mode_changed: function() {
        this.panelEditMode.setToggleState(global.settings.get_boolean("panel-edit-mode"));
        if (global.settings.get_boolean("panel-edit-mode")){
            if (!this.h){
                this.doAction(true);
            }
        } else if (this.h){
            this.doAction(true);
        }
    },

    autodo: function(updalreadyH){
        let postpone=this.actor.hover && this.hover_activates;
        let _children = this.cbox.get_children();
        let p = _children.indexOf(this.actor);
        for(let i = 0; i < p; i++){
            postpone = postpone || _children[i].hover;
            if(_children[i]._applet._menuManager)
                postpone = postpone || _children[i]._applet._menuManager._activeMenu;
            if(_children[i]._applet.menuManager)
                postpone = postpone || _children[i]._applet.menuManager._activeMenu;
            if(postpone)
                break;
        }
        if (postpone)
            this._hideTimeoutId = Mainloop.timeout_add_seconds(this.hide_time, Lang.bind(this,function(){this.autodo(updalreadyH);}));
        else if(this.h && !global.settings.get_boolean("panel-edit-mode"))
            this.doAction(updalreadyH);

    },

    on_applet_removed_from_panel: function() {
        if(!this.h){
            this.doAction(true);
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
