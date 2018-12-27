const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;

const {_} = require('./constants');
const {readFileAsync, tryFn} = require('./utils');

class PlaceInfo {
  constructor(kind, file, name, icon) {
    this.kind = kind;
    this.file = file;
    this.name = name ? name : this.getFileName();

    // If icon is null, icon is set by PlaceDeviceInfo, and it would
    // be inefficient to call getIcon here. Possibly why the original code
    // needed try-catch.
    this.icon = icon ? new Gio.ThemedIcon({
      name: icon
    })
    : icon !== null ? this.getIcon()
    : null;
  }

  isRemovable() {
    return false;
  }

  launch(timestamp) {
    //let time = global.get_current_time();
    let launchContext = global.create_app_launch_context();
    launchContext.set_timestamp(timestamp);

    tryFn(
      () => Gio.AppInfo.launch_default_for_uri(this.file.get_uri(), launchContext),
      (e) => {
        this.file.mount_enclosing_volume(0, null, null, function(file, result) {
          file.mount_enclosing_volume_finish(result);
          Gio.AppInfo.launch_default_for_uri(file.get_uri(), launchContext);
        });
        Main.notifyError(_('Failed to launch "%s"').format(this.name), e.message);
      }
    );
  }

  getIcon() {
    return tryFn(
      () => {
        let info;
        info = this.file.query_info('standard::icon', 0, null);
        return info.get_icon();
      },
      () => {
        // return a generic icon for this kind
        switch (this.kind) {
          case 'network':
            return new Gio.ThemedIcon({
              name: 'folder-remote'
            });
          case 'devices':
            return new Gio.ThemedIcon({
              name: 'drive-harddisk'
            });
          case 'special':
          case 'bookmarks':
          default:
            if (!this.file.is_native()) {
              return new Gio.ThemedIcon({
                name: 'folder-remote'
              });
            } else {
              return new Gio.ThemedIcon({
                name: 'folder'
              });
            }
        }
      }
    );
  }

  getFileName() {
    return tryFn(
      () => {
        return this.file.query_info('standard::display-name', 0, null)
          .get_display_name()
      },
      () => this.file.get_basename(),
    );
  }
};

class PlaceDeviceInfo extends PlaceInfo {
  constructor(kind, mount) {
    super(kind, mount.get_root(), mount.get_name(), null);
    this.mount = mount;
    this.icon = mount.get_icon();
  }
};

const DEFAULT_DIRECTORIES = [
  GLib.UserDirectory.DIRECTORY_DOCUMENTS,
  GLib.UserDirectory.DIRECTORY_DOWNLOAD,
  GLib.UserDirectory.DIRECTORY_MUSIC,
  GLib.UserDirectory.DIRECTORY_PICTURES,
  GLib.UserDirectory.DIRECTORY_VIDEOS
];

class PlacesManager {
  constructor() {
    this.places = {
      special: [],
      devices: [],
      bookmarks: [],
      network: [],
    };

    let homePath = GLib.get_home_dir();

    this.places.special.push(
      new PlaceInfo(
        'special',
        Gio.File.new_for_path(homePath),
        _('Home')
      )
    );

    for (let i = 0, len = DEFAULT_DIRECTORIES.length; i < len; i++) {
      let specialPath = GLib.get_user_special_dir(DEFAULT_DIRECTORIES[i]);
      if (specialPath) {
        if (specialPath === homePath) {
          continue;
        }
        this.places.special.push(
          new PlaceInfo(
            'special',
            Gio.File.new_for_path(specialPath)
          )
        );
      }
    }

    // Show devices, code more or less ported from nautilus-places-sidebar.c
    this.volumeMonitor = Gio.VolumeMonitor.get();
    this.connectVolumeMonitorSignals();
    this.updateMounts();

    this.bookmarksFile = this.findBookmarksFile();
    this.monitor = null;

    if (this.bookmarksFile) {
      this.monitor = this.bookmarksFile.monitor_file(Gio.FileMonitorFlags.NONE, null);
      this.monitor.connect('changed', () => setTimeout(() => this.reloadBookmarks(), 100));
      this.reloadBookmarks();
    }
  }

  connectVolumeMonitorSignals() {
    const signals = ['volume-added', 'volume-removed', 'volume-changed',
      'mount-added', 'mount-removed', 'mount-changed',
      'drive-connected', 'drive-disconnected', 'drive-changed'
    ];

    this.volumeMonitorSignals = [];
    let func = Lang.bind(this, this.updateMounts);
    for (let i = 0, len = signals.length; i < len; i++) {
      let id = this.volumeMonitor.connect(signals[i], func);
      this.volumeMonitorSignals.push(id);
    }
  }

  updateMounts() {
    this.places.devices = [
      new PlaceInfo('devices', Gio.File.new_for_path('/'), _('Computer'), 'drive-harddisk')
    ];
    this.places.network = [
      new PlaceInfo('network', Gio.File.new_for_uri('network:///'),  _('Browse network'), 'network-workgroup')
    ];

    // first go through all connected drives
    let drives = this.volumeMonitor.get_connected_drives();
    for (let i = 0, len = drives.length; i < len; i++) {
      let volumes = drives[i].get_volumes();

      for (let j = 0, len = volumes.length; j < len; j++) {
        let mount = volumes[j].get_mount();
        let kind = 'devices';
        let identifier = volumes[j].get_identifier('class');
        if (identifier && identifier.indexOf('network') >= 0) {
          kind = 'network';
        }

        if (mount !== null) {
          this.addMount(kind, mount);
        }
      }
    }

    // add all volumes that is not associated with a drive
    let volumes = this.volumeMonitor.get_volumes();
    for (let i = 0, len = volumes.length; i < len; i++) {
      if (volumes[i].get_drive() !== null) {
        continue;
      }

      let kind = 'devices';
      let identifier = volumes[i].get_identifier('class');
      if (identifier && identifier.indexOf('network') >= 0) {
        kind = 'network';
      }

      let mount = volumes[i].get_mount();
      if (mount) {
        this.addMount(kind, mount);
      }
    }

    // add mounts that have no volume (/etc/mtab mounts, ftp, sftp, etc)
    let mounts = this.volumeMonitor.get_mounts();
    for (let i = 0, len = mounts.length; i < len; i++) {
      if (mounts[i].is_shadowed() || mounts[i].get_volume()) {
        continue;
      }

      let root = mounts[i].get_default_location();
      let kind = root.is_native() ? 'devices' : 'network';

      this.addMount(kind, mounts[i]);
    }
  }

  findBookmarksFile() {
    let paths = [
      GLib.build_filenamev([GLib.get_user_config_dir(), 'gtk-3.0', 'bookmarks']),
      GLib.build_filenamev([GLib.get_home_dir(), '.gtk-bookmarks']),
    ];

    for (let i = 0, len = paths.length; i < len; i++) {
      if (GLib.file_test(paths[i], GLib.FileTest.EXISTS)) {
        return Gio.File.new_for_path(paths[i]);
      }
    }

    return null;
  }

  reloadBookmarks() {
    this.bookmarks = [];
    readFileAsync(this.bookmarksFile).then((content) =>{
      let lines = content.split('\n');
      let bookmarks = [];
      for (let i = 0, len = lines.length; i < len; i++) {
        let line = lines[i];
        let components = line.split(' ');
        let bookmark = components[0];

        if (!bookmark) continue;

        let file = Gio.File.new_for_uri(bookmark);
        if (file.is_native() && !file.query_exists(null)) {
          continue;
        }

        let duplicate = false;
        for (let i = 0, len = this.places.special.length; i < len; i++) {
          if (file.equal(this.places.special[i].file)) {
            duplicate = true;
            break;
          }
        }
        if (duplicate) continue;
        for (let i = 0, len = bookmarks.length; i < len; i++) {
          if (file.equal(bookmarks[i].file)) {
            duplicate = true;
            break;
          }
        }
        if (duplicate) continue;

        let label = null;
        if (components.length > 1) {
          label = components.slice(1).join(' ');
        }

        bookmarks.push(new PlaceInfo('bookmarks', file, label));
      }

      this.places.bookmarks = bookmarks;
    }).catch((e) => global.logError(e))
  }

  addMount(kind, mount) {
    let devItem = new PlaceDeviceInfo(kind, mount);
    this.places[kind].push(devItem);
  }

  destroy() {
    for (let i = 0, len = this.volumeMonitorSignals.length; i < len; i++) {
      this.volumeMonitor.disconnect(this.volumeMonitorSignals[i]);
    }

    if (this.monitor) {
      this.monitor.cancel();
    }
  }
};