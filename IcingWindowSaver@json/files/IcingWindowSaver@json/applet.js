'use strict';
const Gettext = imports.gettext;
const UUID = "IcingWindowSaver@json";
const GLib = imports.gi.GLib;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

var Applet = imports.ui.applet;
var St = imports.gi.St;
var PopupMenu = imports.ui.popupMenu;
var Util = imports.misc.util;
var Main = imports.ui.main;

var appletPath = '~/.local/share/cinnamon/applets/IcingWindowSaver@json/';

var MyApplet = function MyApplet(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function _init(metadata, orientation, panelHeight, instance_id) {
    var _this = this;

    Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);

    this.orientation = orientation;

    this.c32 = true;

    try {
      this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    } catch (e) {
      this.c32 = null;
    }

    this.set_applet_icon_symbolic_name('video-display');
    this.set_applet_tooltip(_("Window Saver"));

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this._contentSection = new PopupMenu.PopupMenuSection();
    this.menu.addMenuItem(this._contentSection);

    var item = new PopupMenu.PopupIconMenuItem(_("Save"), 'media-floppy', St.IconType.SYMBOLIC);
    item.connect('activate', function () {
      _this._saveWindows();
    });
    this.menu.addMenuItem(item);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = new PopupMenu.PopupIconMenuItem(_("Restore"), 'view-restore', St.IconType.SYMBOLIC);
    item.connect('activate', function () {
      _this._restoreWindows();
    });
    this.menu.addMenuItem(item);

    Main.keybindingManager.addHotKey('save-windows-positions', '<Shift><Ctrl>S', function () {
      return _this._saveWindows();
    });
    Main.keybindingManager.addHotKey('restore-windows-positions', '<Shift><Ctrl>R', function () {
      return _this._restoreWindows();
    });
  },
  _saveWindows: function _saveWindows() {
    Util.trySpawnCommandLine('bash -c "' + appletPath + 'savewindows.sh"');
  },
  _restoreWindows: function _restoreWindows() {
    Util.trySpawnCommandLine('bash -c "' + appletPath + 'restorewindows.sh"');
  },
  on_applet_clicked: function on_applet_clicked(event) {
    this.menu.toggle();
  }
};

var main = function main(metadata, orientation, panel_height, instance_id) {
  var myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
  return myApplet;
};
