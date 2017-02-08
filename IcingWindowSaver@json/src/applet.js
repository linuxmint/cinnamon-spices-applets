const Applet = imports.ui.applet;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Main = imports.ui.main;

var appletPath = '~/.local/share/cinnamon/applets/IcingWindowSaver@json/';

var MyApplet = function(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init(metadata, orientation, panelHeight, instance_id){
    Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);

    this.orientation = orientation

    this.c32 = true;

    try {
      this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    } catch (e) {
      this.c32 = null
    }

    this.set_applet_icon_symbolic_name('video-display');
    this.set_applet_tooltip('Window Saver');

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this._contentSection = new PopupMenu.PopupMenuSection();
    this.menu.addMenuItem(this._contentSection);

    let item = new PopupMenu.PopupIconMenuItem(_('Save'), 'media-floppy', St.IconType.SYMBOLIC);
    item.connect('activate', ()=>{
      this._saveWindows();
    });
    this.menu.addMenuItem(item);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = new PopupMenu.PopupIconMenuItem(_('Restore'), 'view-restore', St.IconType.SYMBOLIC);
    item.connect('activate', ()=>{
      this._restoreWindows();
    });
    this.menu.addMenuItem(item);

    Main.keybindingManager.addHotKey('save-windows-positions', '<Shift><Ctrl>S', ()=>this._saveWindows())
    Main.keybindingManager.addHotKey('restore-windows-positions', '<Shift><Ctrl>R', ()=>this._restoreWindows())

  },

  _saveWindows(){
    Util.trySpawnCommandLine(`bash -c "${appletPath}savewindows.sh"`)
  },

  _restoreWindows(){
    Util.trySpawnCommandLine(`bash -c "${appletPath}restorewindows.sh"`);
  },

  on_applet_clicked(event){
    this.menu.toggle();
  },
};

var main = function(metadata, orientation, panel_height, instance_id) {
  let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id)
  return myApplet
};