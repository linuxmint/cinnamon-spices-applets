/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;

// l10n/translation support
const UUID = "scripts@paucapo.com";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panelHeight, instance_id) {
   this._init(metadata, orientation, panelHeight, instance_id);
}

MyApplet.prototype = {
   __proto__: Applet.TextIconApplet.prototype,

   _init: function(metadata, orientation, panelHeight, instance_id) {
      Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);

      this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);

      this.settings.bindProperty(Settings.BindingDirection.IN, "autoupdate", "autoupdate", this._onSettingsAutoupdate, null)
      this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "directory", "directory", this._onSettingsDirectory, null)

      this.settings.bindProperty(Settings.BindingDirection.IN, "showtitle", "showtitle", this._onSettingsTitle, null)
      this.settings.bindProperty(Settings.BindingDirection.IN, "paneltitle", "paneltitle", this._onSettingsTitle, null)

      this.settings.bindProperty(Settings.BindingDirection.IN, "customicon", "customicon", this._onSettingsIcon, null)
      this.settings.bindProperty(Settings.BindingDirection.IN, "icon", "icon", this._onSettingsIcon, null)

      if (this.directory == "" || typeof this.directory == "undefined") {
         this.directory = GLib.get_home_dir()+"/.local/share/nemo/scripts";
      }
      this.autoupdate_last = this.autoupdate;
      this.directory_last = this.directory;

      this._onSettingsIcon();
      this._onSettingsTitle();

      try {

         //this.set_applet_icon_symbolic_name("system-run");

         this.menuManager = new PopupMenu.PopupMenuManager(this);
         this.menu = new Applet.AppletPopupMenu(this, orientation);
         this.menuManager.addMenu(this.menu);

         if (!this.autoupdate)
            this._createMenu();

      } catch (e) {
         global.logError(e);
      }
   },

   on_applet_removed_from_panel: function() {
      this.settings.finalize();
   },

   _onSettingsAutoupdate: function() {
      if (this.autoupdate != this.autoupdate_last) {
         this.autoupdate_last = this.autoupdate;
         this._updateMenu();
      }
   },

   _onSettingsDirectory: function() {
      if (this.directory != this.directory_last) {
         this.directory_last = this.directory;
         this._updateMenu();
      }
   },

   _onSettingsTitle: function() {
      if (this.showtitle) {
         this.set_applet_label(_(this.paneltitle));
         this.set_applet_tooltip(_(this.paneltitle));
      } else {
         this.set_applet_label("");
         this.set_applet_tooltip(_("Scripts"));
      }
   },

   _onSettingsIcon: function() {
      if (this.customicon) {
         let icon_file = Gio.File.new_for_path(this.icon);
         if (icon_file.query_exists(null)) {
            this.set_applet_icon_path(this.icon)
         } else {
            this.set_applet_icon_name(this.icon)
            //this.set_applet_icon_symbolic_name(this.icon);
         }
      } else {
         this.set_applet_icon_symbolic_name("system-run");
      }
   },

   on_applet_clicked: function(event) {
      if (this.autoupdate && !this.menu.isOpen) {
         this._updateMenu();
      }
      this.menu.toggle();
   },

   _updateMenu: function() {
      this.menu.removeAll();
      this._createMenu();
   },

   _createMenu: function() {
      this.menu = this._loadDir(this.directory, this.menu);

      this._addSeparator();

      let open = new PopupMenu.PopupMenuItem(_("Open scripts folder"));
      open.connect('activate', Lang.bind(this, this._openFolder));
      this.menu.addMenuItem(open);

      if (!this.autoupdate) {
         let update = new PopupMenu.PopupMenuItem(_("Update menu"));
         update.connect('activate', Lang.bind(this, this._updateMenu));
         this.menu.addMenuItem(update);
      }
   },

   _showNotify: function(message){
      GLib.spawn_command_line_async("notify-send --icon=system-run '"+message+"'");
   },

   _addSeparator: function() {
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
   },

   _openFolder: function() {
      try {
         GLib.spawn_command_line_async("xdg-open '"+this.directory+"'");
      } catch (e) {
         this._showNotify(e);
      }
   },

   _executeScript: function(script) {
      try {
         GLib.spawn_command_line_async("\"" + script + "\"");
      } catch (e) {
         // notify showed prevent script errors or inexistent file
         this._showNotify(e);
      }
   },

   _loadDir: function(dir, m) {

      // Workaround for Cinnamon 3.2.x settings window path selectors.
      // They return an URI instead of a path like they used to. ¬¬
      if (/^file:\/\//.test(dir))
          dir = dir.substr(7);
      
      let currentDir =  Gio.file_new_for_path(dir);
      if (currentDir.query_exists(null)){

         let dirs = [];
         let files = [];

         let enumerator= currentDir.enumerate_children('standard::type', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
         let file;

         // get all dirs and files
         while ((file = enumerator.next_file(null)) != null) {
            let fileName = file.get_name();
            let fileType = file.get_file_type();
            if (fileType == Gio.FileType.DIRECTORY) {
               dirs.push(fileName);
            } else {
               files.push(fileName);
            }
         }

         // populate dirs first
         if (dirs.length > 0) {
            dirs.sort();
            for (let i = 0; i < dirs.length; i++) {
               let directory =  currentDir.get_path() + "/" + dirs[i];
               let submenu = new PopupMenu.PopupSubMenuMenuItem(dirs[i]);
               submenu.label.add_style_class_name('scripts-directory');
               submenu.menu = this._loadDir(directory, submenu.menu);
               m.addMenuItem(submenu);
            }
         }

         // populate files
         if (files.length > 0) {
            files.sort();
            for (let i = 0; i < files.length; i++) {
               let script = currentDir.get_path() + "/" + files[i];
               let item = new PopupMenu.PopupMenuItem(files[i]);
               item.connect('activate', Lang.bind(this, function() {this._executeScript(script)} ));
               m.addMenuItem(item);
            }
         }
      }

      return m;
   }

};

function main(metadata, orientation, panelHeight, instance_id) {
   let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
   return myApplet;
}



