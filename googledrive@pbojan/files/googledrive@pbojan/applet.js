
const Main = imports.ui.main;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;

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
      this.cfgRemote = '';
      this.cfgWhitelist = [];

      this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
      this.settings.bind('location', 'cfgLocation', this.onLocationChanged);
      this.settings.bind('remote', 'cfgRemote', this.onRemoteChanged);
      this.settings.bind('whitelist', 'cfgWhitelist', this.onWhitelistChanged);

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
    this.setupInitDriveUI(orientation);
    this.setupMainUI(orientation);
    this.setupCheckingDrive(orientation);

    this.onLocationChanged();
  }

  onLocationChanged() {
    l('Called method onLocationChanged() with location %s'.format(this.cfgLocation));

    this.menuManager.removeMenu(this.menu);
    if (!this.cfgLocation || !this.cfgRemote) {
      this.menu = this.configuraionMenu;
      this.menuManager.addMenu(this.menu);
      return;
    }

    this.menu = this.checkingDriveMenu;
    this.menuManager.addMenu(this.menu);

    this.checkRemote();
  }

  onRemoteChanged() {
    l('Called method onRemoteChanged() with remote %s'.format(this.cfgRemote));
    this.onLocationChanged();
  }

  onWhitelistChanged() {
    l('Called method onWhitelistChanged() with %d entries'.format(this.cfgWhitelist.length));
  }

  checkRemote() {
    Util.spawnCommandLineAsyncIO('/bin/sh -c "rclone listremotes"', this.onRemoteLoaded.bind(this));
  }

  onRemoteLoaded(output, err) {
    l('rclone listremotes output: %s'.format(output));

    this.menuManager.removeMenu(this.menu);
    let remoteFound = !err && output && output.split('\n')
      .some(line => line.trim().replace(/:$/, '') === this.cfgRemote.trim());

    this.menu = remoteFound ? this.mainMenu : this.initMenu;
    this.menuManager.addMenu(this.menu);
  }

  setupNoConfigurationUI(orientation) {
    this.configuraionMenu = new Applet.AppletPopupMenu(this, orientation);
    this.configuraionMenu.addMenuItem(this.contentSection);

    let item = new PopupMenu.PopupMenuItem('Please configure the applet first!', {hover: false});
    this.configuraionMenu.addMenuItem(item);
    this.configuraionMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = this.buildMenuItem('Open Configuration', 'xapp-prefs-behavior-symbolic', 'cinnamon-settings applets ' + UUID)
    this.configuraionMenu.addMenuItem(item);
  }

  setupInitDriveUI(orientation) {
    this.initMenu = new Applet.AppletPopupMenu(this, orientation);
    this.initMenu.addMenuItem(this.contentSection);

    let item = new PopupMenu.PopupMenuItem('rclone remote not found or not configured!', {hover: false});
    this.initMenu.addMenuItem(item);
    this.initMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = new PopupMenu.PopupMenuItem('Run "rclone listremotes" in a terminal to see your configured remotes.\nClick below to open the rclone Google Drive setup guide.', { hover: false });
    this.initMenu.addMenuItem(item);
    this.initMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = this.buildMenuItem('Open rclone Google Drive Docs', 'help-browser', 'xdg-open https://rclone.org/drive/');
    this.initMenu.addMenuItem(item);
    this.initMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = this.buildMenuItem('Open Configuration', 'xapp-prefs-behavior-symbolic', 'cinnamon-settings applets ' + UUID);
    this.initMenu.addMenuItem(item);
  }

  setupMainUI(orientation) {
    this.mainMenu = new Applet.AppletPopupMenu(this, orientation);
    this.mainMenu.addMenuItem(this.contentSection);

    let item = this.buildMenuItemWithFileIcon('Pull from Drive', 'pull', this.onPullClicked);
    this.mainMenu.addMenuItem(item);

    item = this.buildMenuItemWithFileIcon('Push to Drive', 'push', this.onPushClicked);
    this.mainMenu.addMenuItem(item);

    item = this.buildMenuItemWithFileIcon('Sync from Drive', 'sync-from', this.onSyncClicked);
    this.mainMenu.addMenuItem(item);

    item = this.buildMenuItemWithFileIcon('Sync to Drive', 'sync-to', this.onSyncToClicked);
    this.mainMenu.addMenuItem(item);
    this.mainMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = this.buildMenuItemWithCallback('Open Local Drive', 'folder', this.onOpenLocalDrive);
    this.mainMenu.addMenuItem(item);

    item = this.buildMenuItem('Open Remote Drive', 'gdrive', 'xdg-open https://drive.google.com/drive/my-drive');
    this.mainMenu.addMenuItem(item);
    this.mainMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = this.buildMenuItem('Open Configuration', 'xapp-prefs-behavior-symbolic', 'cinnamon-settings applets ' + UUID)
    this.mainMenu.addMenuItem(item);
  }

  setupCheckingDrive(orientation) {
    this.checkingDriveMenu = new Applet.AppletPopupMenu(this, orientation);
    this.checkingDriveMenu.addMenuItem(this.contentSection);

    let item = new PopupMenu.PopupMenuItem('Checking rclone remote configuration...\nIf this persists, verify your settings in Configuration.', { hover: false });
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

  buildMenuItemWithFileIcon(title, iconName, callback) {
    let item = new PopupMenu.PopupIconMenuItem(title, '', St.IconType.SYMBOLIC);
    let gicon = Gio.icon_new_for_string(AppletDir + '/icons/' + iconName + '.svg');
    item._icon.set_gicon(gicon);
    item.connect('activate', Lang.bind(this, callback));

    return item;
  }

  onPullClicked() {
    l('Callback method onPullClicked()');
    Util.spawnCommandLine(this.buildBashCommand('Drive Pull', this.buildDriveCommands('pull', true), this.buildDriveCommands('pull', false)));
  }

  onPushClicked() {
    l('Callback method onPushClicked()');
    Util.spawnCommandLine(this.buildBashCommand('Drive Push', this.buildDriveCommands('push', true), this.buildDriveCommands('push', false)));
  }

  onSyncClicked() {
    l('Callback method onSyncClicked()');
    Util.spawnCommandLine(this.buildBashCommand('Drive Sync from', this.buildDriveCommands('sync', true), this.buildDriveCommands('sync', false)));
  }

  onSyncToClicked() {
    l('Callback method onSyncToClicked()');
    Util.spawnCommandLine(this.buildBashCommand('Drive Sync to', this.buildDriveCommands('sync-to', true), this.buildDriveCommands('sync-to', false)));
  }

  onOpenLocalDrive() {
    Util.spawnCommandLine('nemo ' + this.getLocationPath());
  }

  buildDriveCommands(action, dryRun) {
    let locationPath = this.getLocationPath();
    let remote = this.cfgRemote.trim();
    let flags = (dryRun ? '--dry-run ' : '-v ') + '--modify-window 1s --exclude "*.desktop"';

    let buildCmd = (src, dst) => {
      let verb = action.startsWith('sync') ? 'sync' : 'copy';
      return `rclone ${verb} ${src} ${dst} ${flags}`;
    };

    let folders = this.cfgWhitelist.length > 0
      ? this.cfgWhitelist.map(obj => obj.name)
      : [null]; // null = operate on root

    return folders.map(folder => {
      let local = this.escapeShellArg(folder ? locationPath + '/' + folder : locationPath);
      let remoteArg = remote + ':' + (folder || '');
      if (action === 'push' || action === 'sync-to') return buildCmd(local, remoteArg);
      return buildCmd(remoteArg, local);
    }).join(' && ');
  }

  buildBashCommand(title, dryRunCommand, realCommand) {
    let path = this.getLocationPath();
    let escapedDryRun = dryRunCommand.replace(/'/g, `'\\''`);

    return `gnome-terminal --window --title="${title}" -- bash -c "` +
      `cd '${path.replace(/'/g, "'\\''")}'; ` +
      `printf '\\\\033[1mCurrent Location %s\\\\nDry-run Command: %s\\\\n' $(pwd) '${escapedDryRun}'; ` +
      `echo; read -r -p 'Press enter to start dry-run...' < /dev/tty; echo; ` +
      `${dryRunCommand}; ` +
      `echo; read -r -p 'Proceed with actual execution? [y/N] ' answer < /dev/tty; ` +
      `if [[ \\\"\\$answer\\\" =~ ^[Yy]\\$ ]]; then echo; ${realCommand}; fi; ` +
      `echo; read -r -p 'Press enter to close...' < /dev/tty"`;
  }

  escapeShellArg(str) {
    return "'" + str.replace(/'/g, "'\\''") + "'";
  }

  getLocationPath() {
    return this.cfgLocation.replace('file://', '');
  }

  on_applet_clicked(event) {
    this.menu.toggle();
  }

  openRcloneDocs() {
    Util.spawnCommandLine('xdg-open https://rclone.org/drive/');
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
