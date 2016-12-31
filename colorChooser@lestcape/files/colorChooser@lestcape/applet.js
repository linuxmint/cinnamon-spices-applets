// Copyright (C) 2014-2015 Lester Carballo Pérez <lestcape@gmail.com>
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
//const Main = imports.ui.main;

const AppletPath = imports.ui.appletManager.applets['colorChooser@lestcape'];
const ColorChooser = AppletPath.colorChooser;

function MyApplet() {
   this._init.apply(this, arguments);
}

MyApplet.prototype = {
   __proto__: Applet.IconApplet.prototype,

   _init: function(metadata, orientation, panel_height, instance_id) {
      Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
      try {
         this._uuid = metadata["uuid"];
         this.set_applet_tooltip("Color Chooser");
         Gtk.IconTheme.get_default().append_search_path(metadata.path + '/icons/');
            
         this.menuManager = new PopupMenu.PopupMenuManager(this);
         this.menu = new Applet.AppletPopupMenu(this, orientation);
         this.menuManager.addMenu(this.menu);

         this.settings = new Settings.AppletSettings(this, this._uuid, this.instance_id);
         this.settings.bindProperty(Settings.BindingDirection.IN, "apple-icon-symbolic", "iconSymbolic", this._onIconSymbolicChanged, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "save-to-clipboard", "useClipboard", this._onSaveToClipboardChanged, null);
         this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "saved-colors", "savedColors", null, null);
         this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "last-color", "lastColor", null, null);
         this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "format", "format", this._onFormatChanged, null);

         this._initChooser();
      } catch (e) {
         global.logError(e);
      }
   },

   _initChooser: function() {
      let section = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(section);

      let [res, color] = Clutter.Color.from_string(this.lastColor);
      this.chooser = new ColorChooser.ColorChooser(color);
      section.actor.add(this.chooser.actor, {x_fill: true, y_fill: true, y_align: St.Align.START, expand: true});

      this._savedId = this.chooser.connect('saved-color-changed', Lang.bind(this, this._onSavedColorsChanged));
      this._formatId = this.chooser.connect('color-format-changed', Lang.bind(this, this._onChooserColorFormatChanged));
      this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));

      this.chooser.setSaveColors(this.savedColors);

      this._onFormatChanged();
      this._onIconSymbolicChanged();
      this._onSaveToClipboardChanged(); 
   },

   _onSaveToClipboardChanged: function() {
      this.chooser.saveToClipboard(this.useClipboard);
   },

   _onIconSymbolicChanged: function() {
      if(this.iconSymbolic) {
         this.set_applet_icon_symbolic_name("preferences-color");
      } else {
         this.set_applet_icon_name("preferences-color");
      }
   },

   _onFormatChanged: function() {
      if(this.format == "HEXA")
         this.chooser.setFormat(ColorChooser.COLOR_FORMAT.HEXA);
      else if(this.format == "RGBA")
         this.chooser.setFormat(ColorChooser.COLOR_FORMAT.RGBA);
      else if(this.format == "HSLA")
         this.chooser.setFormat(ColorChooser.COLOR_FORMAT.HSLA);
      else if(this.format == "PIXL")
         this.chooser.setFormat(ColorChooser.COLOR_FORMAT.PIXL);
   },

   _onChooserColorFormatChanged: function(chooser, format) {
      if(format == ColorChooser.COLOR_FORMAT.HEXA)
         this.format = "HEXA";
      else if(format == ColorChooser.COLOR_FORMAT.RGBA)
         this.format = "RGBA";
      else if(format == ColorChooser.COLOR_FORMAT.HSLA)
         this.format = "HSLA";
      else if(format == ColorChooser.COLOR_FORMAT.PIXL)
         this.format = "PIXL";
   },

   _onSavedColorsChanged: function(chooser, color, savedColors) {
      this.lastColor = color;
      this.savedColors = savedColors;
      this.menu.close(true);
   },

   _onOpenStateChanged: function(menu, open) {
      if(open) {
         this.chooser.setFocusKeyFocus();
      }
   },

   on_applet_clicked: function(event) {
      this.menu.toggle();
   },

   on_applet_removed_from_panel: function() {
      if(this._savedId > 0)
         this.chooser.disconnect(this._savedId);
      if(this._formatId > 0)
         this.chooser.disconnect(this._formatId);
      this.settings.finalize();
      this.chooser.destroy();
      this.menu.destroy();
      this.menu = null;
      this.menuManager = null;
      this.chooser = null;
      this.actor.destroy();
   }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
