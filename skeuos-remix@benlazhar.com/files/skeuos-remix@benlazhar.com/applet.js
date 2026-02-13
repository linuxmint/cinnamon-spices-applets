const Applet = imports.ui.applet;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const UUID = 'skeuos-remix@benlazhar.com';

function ConfirmDialog() {
  this._init();
}

function SkeuosRemixApplet(orientation, panelHeight, instanceId) {
  this._init(orientation, panelHeight, instanceId);
}

SkeuosRemixApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function (orientation, panelHeight, instanceId) {
    Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

    try {
      this.set_applet_icon_name("games-config-theme");
      this.set_applet_tooltip("Change skeuos theme and flat remix icons");

      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);

      this._contentSection = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(this._contentSection);

      // BlueLight
      let BlueLight = new PopupMenu.PopupIconMenuItem("Blue Light", "folder-blue", St.IconType.FULLCOLOR); BlueLight.connect('activate', Lang.bind(this, function () { this.applyChanges('Blue', 'Light') }));
      this.menu.addMenuItem(BlueLight);


      // BlueDark
      let BlueDark = new PopupMenu.PopupIconMenuItem("Blue Dark", "folder-blue", St.IconType.FULLCOLOR); BlueDark.connect('activate', Lang.bind(this, function () { this.applyChanges('Blue', 'Dark') }));
      this.menu.addMenuItem(BlueDark);


      // GreenLight
      let GreenLight = new PopupMenu.PopupIconMenuItem("Green Light", "folder-green", St.IconType.FULLCOLOR); GreenLight.connect('activate', Lang.bind(this, function () { this.applyChanges('Green', 'Light') }));
      this.menu.addMenuItem(GreenLight);


      // GreenDark
      let GreenDark = new PopupMenu.PopupIconMenuItem("Green Dark", "folder-green", St.IconType.FULLCOLOR); GreenDark.connect('activate', Lang.bind(this, function () { this.applyChanges('Green', 'Dark') }));
      this.menu.addMenuItem(GreenDark);


      // RedLight
      let RedLight = new PopupMenu.PopupIconMenuItem("Red Light", "folder-red", St.IconType.FULLCOLOR); RedLight.connect('activate', Lang.bind(this, function () { this.applyChanges('Red', 'Light') }));
      this.menu.addMenuItem(RedLight);


      // RedDark
      let RedDark = new PopupMenu.PopupIconMenuItem("Red Dark", "folder-red", St.IconType.FULLCOLOR); RedDark.connect('activate', Lang.bind(this, function () { this.applyChanges('Red', 'Dark') }));
      this.menu.addMenuItem(RedDark);


      // YellowLight
      let YellowLight = new PopupMenu.PopupIconMenuItem("Yellow Light", "folder-yellow", St.IconType.FULLCOLOR); YellowLight.connect('activate', Lang.bind(this, function () { this.applyChanges('Yellow', 'Light') }));
      this.menu.addMenuItem(YellowLight);


      // YellowDark
      let YellowDark = new PopupMenu.PopupIconMenuItem("Yellow Dark", "folder-yellow", St.IconType.FULLCOLOR); YellowDark.connect('activate', Lang.bind(this, function () { this.applyChanges('Yellow', 'Dark') }));
      this.menu.addMenuItem(YellowDark);


      // BlackLight
      let BlackLight = new PopupMenu.PopupIconMenuItem("Black Light", "folder-black", St.IconType.FULLCOLOR); BlackLight.connect('activate', Lang.bind(this, function () { this.applyChanges('Black', 'Light') }));
      this.menu.addMenuItem(BlackLight);


      // BlackDark
      let BlackDark = new PopupMenu.PopupIconMenuItem("Black Dark", "folder-black", St.IconType.FULLCOLOR); BlackDark.connect('activate', Lang.bind(this, function () { this.applyChanges('Black', 'Dark') }));
      this.menu.addMenuItem(BlackDark);


      // BrownLight
      let BrownLight = new PopupMenu.PopupIconMenuItem("Brown Light", "folder-brown", St.IconType.FULLCOLOR); BrownLight.connect('activate', Lang.bind(this, function () { this.applyChanges('Brown', 'Light') }));
      this.menu.addMenuItem(BrownLight);


      // BrownDark
      let BrownDark = new PopupMenu.PopupIconMenuItem("Brown Dark", "folder-brown", St.IconType.FULLCOLOR); BrownDark.connect('activate', Lang.bind(this, function () { this.applyChanges('Brown', 'Dark') }));
      this.menu.addMenuItem(BrownDark);


      // CyanLight
      let CyanLight = new PopupMenu.PopupIconMenuItem("Cyan Light", "folder-cyan", St.IconType.FULLCOLOR); CyanLight.connect('activate', Lang.bind(this, function () { this.applyChanges('Cyan', 'Light') }));
      this.menu.addMenuItem(CyanLight);


      // CyanDark
      let CyanDark = new PopupMenu.PopupIconMenuItem("Cyan Dark", "folder-cyan", St.IconType.FULLCOLOR); CyanDark.connect('activate', Lang.bind(this, function () { this.applyChanges('Cyan', 'Dark') }));
      this.menu.addMenuItem(CyanDark);


      // GreyLight
      let GreyLight = new PopupMenu.PopupIconMenuItem("Grey Light", "folder-grey", St.IconType.FULLCOLOR); GreyLight.connect('activate', Lang.bind(this, function () { this.applyChanges('Grey', 'Light') }));
      this.menu.addMenuItem(GreyLight);


      // GreyDark
      let GreyDark = new PopupMenu.PopupIconMenuItem("Grey Dark", "folder-grey", St.IconType.FULLCOLOR); GreyDark.connect('activate', Lang.bind(this, function () { this.applyChanges('Grey', 'Dark') }));
      this.menu.addMenuItem(GreyDark);


      // MagentaLight
      let MagentaLight = new PopupMenu.PopupIconMenuItem("Magenta Light", "folder-magenta", St.IconType.FULLCOLOR); MagentaLight.connect('activate', Lang.bind(this, function () { this.applyChanges('Magenta', 'Light') }));
      this.menu.addMenuItem(MagentaLight);


      // MagentaDark
      let MagentaDark = new PopupMenu.PopupIconMenuItem("Magenta Dark", "folder-magenta", St.IconType.FULLCOLOR); MagentaDark.connect('activate', Lang.bind(this, function () { this.applyChanges('Magenta', 'Dark') }));
      this.menu.addMenuItem(MagentaDark);


      // OrangeLight
      let OrangeLight = new PopupMenu.PopupIconMenuItem("Orange Light", "folder-orange", St.IconType.FULLCOLOR); OrangeLight.connect('activate', Lang.bind(this, function () { this.applyChanges('Orange', 'Light') }));
      this.menu.addMenuItem(OrangeLight);


      // OrangeDark
      let OrangeDark = new PopupMenu.PopupIconMenuItem("Orange Dark", "folder-orange", St.IconType.FULLCOLOR); OrangeDark.connect('activate', Lang.bind(this, function () { this.applyChanges('Orange', 'Dark') }));
      this.menu.addMenuItem(OrangeDark);


      // TealLight
      let TealLight = new PopupMenu.PopupIconMenuItem("Teal Light", "folder-teal", St.IconType.FULLCOLOR); TealLight.connect('activate', Lang.bind(this, function () { this.applyChanges('Teal', 'Light') }));
      this.menu.addMenuItem(TealLight);


      // TealDark
      let TealDark = new PopupMenu.PopupIconMenuItem("Teal Dark", "folder-teal", St.IconType.FULLCOLOR); TealDark.connect('activate', Lang.bind(this, function () { this.applyChanges('Teal', 'Dark') }));
      this.menu.addMenuItem(TealDark);


      // VioletLight
      let VioletLight = new PopupMenu.PopupIconMenuItem("Violet Light", "folder-violet", St.IconType.FULLCOLOR); VioletLight.connect('activate', Lang.bind(this, function () { this.applyChanges('Violet', 'Light') }));
      this.menu.addMenuItem(VioletLight);


      // VioletDark
      let VioletDark = new PopupMenu.PopupIconMenuItem("Violet Dark", "folder-violet", St.IconType.FULLCOLOR); VioletDark.connect('activate', Lang.bind(this, function () { this.applyChanges('Violet', 'Dark') }));
      this.menu.addMenuItem(VioletDark);


      // WhiteLight
      // let WhiteLight = new PopupMenu.PopupIconMenuItem("White Light", "folder-white", St.IconType.FULLCOLOR); WhiteLight.connect('activate', Lang.bind(this, function () { this.applyChanges('White', 'Light') }));
      // this.menu.addMenuItem(WhiteLight);


      // WhiteDark
      // let WhiteDark = new PopupMenu.PopupIconMenuItem("White Dark", "folder-white", St.IconType.FULLCOLOR); WhiteDark.connect('activate', Lang.bind(this, function () { this.applyChanges('White', 'Dark') }));
      // this.menu.addMenuItem(WhiteDark);

    }
    catch (e) {
      global.logError(e);
    }
  },

  on_applet_clicked: function (event) {
    this.menu.toggle();
  },
  applyChanges: function (color, theme) {
    Main.Util.spawnCommandLine(`gsettings set org.cinnamon.desktop.interface gtk-theme "Skeuos-${color}-${theme}"`);
    Main.Util.spawnCommandLine(`gsettings set org.cinnamon.desktop.interface icon-theme "Flat-Remix-${color}-${theme}"`);
    Main.Util.spawnCommandLine(`gsettings set org.cinnamon.desktop.wm.preferences theme "Skeuos-${color}-${theme}"`);
    Main.Util.spawnCommandLine(`gsettings set org.cinnamon.theme name "Skeuos-${color}-${theme}"`);
  }
};

function main(metadata, orientation, panelHeight, instanceId) {
  let skeuosRemix = new SkeuosRemixApplet(orientation, panelHeight, instanceId);
  return skeuosRemix;
}
