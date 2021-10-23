
const Main = imports.ui.main;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const ByteArray = imports.byteArray;

const DEBUG = false;
const UUID = 'googledrive@pbojan'
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;

function l(message) {
  if (!DEBUG) {
    return;
  }

  global.log(message);
}

class GoogleDriveApplet extends Applet.IconApplet {
  constructor(orientation, panelHeight, instanceId) {
    try {
      super(orientation, panelHeight, instanceId);

      this.set_applet_icon_path(AppletDir + '/icon.png');
      this.set_applet_tooltip('Google Drive');

      this.cfgLocation = '';
      this.cfgWhitelist = [];

      this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
      this.settings.bind('location', 'cfgLocation', this.onLocationChanged);
      this.settings.bind('whitelist', 'cfgWhitelist', this.onWhitelistChanged);
      //this.settings.bind('syncOnStartup', 'cfgSyncOnStartup', null);

      this.contentSection = new PopupMenu.PopupMenuSection();
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager = new PopupMenu.PopupMenuManager(this);

      this.initUI(orientation);
    } catch (e) {
      global.logError(e);
    }
  }

  initUI(orientation) {
    l('Called method initUi()');

    this.setupNoConfigurationUI(orientation);
    this.setupInitDriveUI(orientation)
    this.setupMainUI(orientation);
    this.setupCheckingDrive(orientation);

    this.onLocationChanged();
  }

  onLocationChanged() {
    l('Called method onLocationChanged() with location %s'.format(this.cfgLocation));

    this.menuManager.removeMenu(this.menu);
    if (!this.cfgLocation) {
      this.menu = this.configuraionMenu;
      this.menuManager.addMenu(this.menu);
      return;
    }

    this.loadDriveInfo();

    this.menu = this.checkingDriveMenu;
    this.menuManager.addMenu(this.menu);
  }

  loadDriveInfo() {
    let command = '/bin/sh -c "cd %s && drive about -quota"'.format(this.getLocationPath());

    Util.spawnCommandLineAsyncIO(command, this.onLoadedDriveInfo.bind(this));
  }

  onLoadedDriveInfo(output, err) {
    l('Loaded drive info with output: %s'.format(output));;
    if (!err && output.includes('DRIVE')) {
      this.menu = this.mainMenu;
    } else {
      this.menu = this.initMenu;
    }

    this.menuManager.addMenu(this.menu);
  }

  onWhitelistChanged() {
    l('Called method onWhitelistChanged() with whitelist %s'.format(this.getWhitelist()));
  }

  setupNoConfigurationUI(orientation) {
    this.configuraionMenu = new Applet.AppletPopupMenu(this, orientation);
    this.configuraionMenu.addMenuItem(this.contentSection);

    let item = new PopupMenu.PopupMenuItem('Please configure the applet first!', {hover: false});
    this.configuraionMenu.addMenuItem(item);
    this.configuraionMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = this.buildMenuItem('Open Configuration', 'configuration', 'cinnamon-settings applets ' + UUID)
    this.configuraionMenu.addMenuItem(item);
  }

  setupInitDriveUI(orientation) {
    this.initMenu = new Applet.AppletPopupMenu(this, orientation);
    this.initMenu.addMenuItem(this.contentSection);

    let item = new PopupMenu.PopupMenuItem('Drive folder is not initialised!', {hover: false});
    this.initMenu.addMenuItem(item);
    this.initMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = new PopupMenu.PopupMenuItem('Current location: ' + this.getLocationPath(), { hover: false });
    this.initMenu.addMenuItem(item);

    item = new PopupMenu.PopupMenuItem('Make sure you have selected the correct location before clicking Init Drive!', { hover: false });
    this.initMenu.addMenuItem(item);
    this.initMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = this.buildMenuItem('Init Drive', 'gdrive', this.buildCommand('Drive Init', 'drive init'))
    this.initMenu.addMenuItem(item);
  }

  setupMainUI(orientation) {
    this.mainMenu = new Applet.AppletPopupMenu(this, orientation);
    this.mainMenu.addMenuItem(this.contentSection);

    let item = this.buildMenuItemWithCallback('Pull from Drive', 'draw-arrow-down', this.onDrivePullClicked);
    this.mainMenu.addMenuItem(item);

    item = this.buildMenuItemWithCallback('Push to Drive', 'draw-arrow-up', this.onDrivePushClicked);
    this.mainMenu.addMenuItem(item);
    this.mainMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = this.buildMenuItem('Open Local Drive', 'folder', 'nemo ' + this.cfgLocation);
    this.mainMenu.addMenuItem(item);

    item = this.buildMenuItem('Open Remote Drive', 'gdrive', 'xdg-open https://drive.google.com/drive/my-drive');
    this.mainMenu.addMenuItem(item);
    this.mainMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = this.buildMenuItem('Open Configuration', 'configuration', 'cinnamon-settings applets ' + UUID)
    this.mainMenu.addMenuItem(item);
  }

  setupCheckingDrive(orientation) {
    this.checkingDriveMenu = new Applet.AppletPopupMenu(this, orientation);
    this.checkingDriveMenu.addMenuItem(this.contentSection);

    let item = new PopupMenu.PopupMenuItem("Checking folder %s Drive status!\nIf you see this message for a long time, try to change your location configuration again!".format(this.getLocationPath()), { hover: false });
    this.checkingDriveMenu.addMenuItem(item);
  }

  buildMenuItem(title, icon, command) {
    let item = new PopupMenu.PopupIconMenuItem(title, icon, St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function () {
      Util.spawnCommandLine(command);
    }));

    return item;
  }

  buildMenuItemWithCallback(title, icon, callback) {
    let item = new PopupMenu.PopupIconMenuItem(title, icon, St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, callback));

    return item;
  }

  onDrivePullClicked() {
    let command = this.buildCommand('Drive Pull', 'drive pull' + this.getWhitelist())

    Util.spawnCommandLine(command);
  }

  onDrivePushClicked () {
    l('Callback method onDrivePushClicked() with whitelist %s'.format(this.getWhitelist()));
    let command = this.buildCommand('Drive Push', 'drive push' + this.getWhitelist());

    Util.spawnCommandLine(command);
  }

  buildCommand(title, command) {
    let path = this.getLocationPath();
    let escapedCommand = command.replace(/'/g, `'\\''`);

    return `gnome-terminal --window --title="${title}" -- bash -i -c "cd ${path}; printf '\\033[1mCurrent Location %s\\nExecuting Command: %s\\n' $(pwd) '${escapedCommand}'; ${command}; echo Press enter to continue...; read line"`;
  }

  getLocationPath() {
    return this.cfgLocation.replace('file://', '');
  }

  getWhitelist() {
    if (this.cfgWhitelist.length === 0) {
      return '';
    }

    let folders = [];
    this.cfgWhitelist.forEach(obj => {
      folders.push(`'${obj.name}'`);
    })

    return ' ' + folders.join(' ');
  }

  on_applet_clicked(event) {
    this.menu.toggle();
  }

  visitGitHub () {
    Util.spawnCommandLine("xdg-open https://github.com/pbojan/googledrive-applet-cinnamon/");
  }

  visitWebsite() {
    Util.spawnCommandLine("xdg-open https://cinnamon-spices.linuxmint.com/applets/view/348");
  }

  submitIssue() {
    Util.spawnCommandLine("xdg-open https://github.com/pbojan/googledrive-applet-cinnamon/issues");
  }
}

function main(metadata, orientation, panel_height, instance_id) {
  return new GoogleDriveApplet(orientation, panel_height, instance_id);
}
