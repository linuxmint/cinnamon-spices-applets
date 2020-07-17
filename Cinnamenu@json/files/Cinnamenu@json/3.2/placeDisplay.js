/* ========================================================================================================
 *  CREDITS:  This code was copied from the Places Status Indicator extension and modified to provide the
 *  functions needed by cinnamenu. Many thanks to gcampax for a great extension.
 * ========================================================================================================
 */
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;
const Main = imports.ui.main;

// l10n
const Gettext = imports.gettext;
const UUID = 'Cinnamenu@json';

function _(str) {
  let cinnamonTranslation = Gettext.gettext(str);
  if (cinnamonTranslation !== str) {
    return cinnamonTranslation;
  }
  return Gettext.dgettext(UUID, str);
}

function PlaceInfo() {
  this._init.apply(this, arguments);
}

PlaceInfo.prototype = {
  _init: function(kind, file, name, icon) {
    this.kind = kind;
    this.file = file;
    this.name = name ? name : this._getFileName();
    this.icon = icon ? new Gio.ThemedIcon({
      name: icon
    }) : this.getIcon();
  },

  isRemovable: function() {
    return false;
  },

  launch: function(timestamp) {
    //let time = global.get_current_time();
    let launchContext = global.create_app_launch_context();
    launchContext.set_timestamp(timestamp);

    try {
      Gio.AppInfo.launch_default_for_uri(this.file.get_uri(),
        launchContext);
    } catch (e) {
      this.file.mount_enclosing_volume(0, null, null, function(file, result) {
        file.mount_enclosing_volume_finish(result);
        Gio.AppInfo.launch_default_for_uri(file.get_uri(), launchContext);
      });
      Main.notifyError( "Failed to launch " + this.name, e.message);
    }
  },

  getIcon: function() {
    try {
      let info;
      info = this.file.query_info('standard::icon', 0, null);
      return info.get_icon();
    } catch (e) {
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
  },

  _getFileName: function() {
    try {
      let info = this.file.query_info('standard::display-name', 0, null);
      return info.get_display_name();
    } catch (e) {
      return this.file.get_basename();
    }
  },
};

function PlaceDeviceInfo() {
  this._init.apply(this, arguments);
}

PlaceDeviceInfo.prototype = {
  __proto__: PlaceInfo.prototype,

  _init: function(kind, mount) {
    this._mount = mount;
    PlaceInfo.prototype._init.call(this, kind, mount.get_root(), mount.get_name());
  },

  getIcon: function() {
    return this._mount.get_icon();
  }
};

const DEFAULT_DIRECTORIES = [
  GLib.UserDirectory.DIRECTORY_DOCUMENTS,
  GLib.UserDirectory.DIRECTORY_DOWNLOAD,
  GLib.UserDirectory.DIRECTORY_MUSIC,
  GLib.UserDirectory.DIRECTORY_PICTURES,
  GLib.UserDirectory.DIRECTORY_VIDEOS
];

function PlacesManager() {
  this._init.apply(this, arguments);
}

PlacesManager.prototype = {
  _init: function(useSymbolic) {

    this._places = {
      special: [],
      devices: [],
      bookmarks: [],
      network: [],
    };

    let homePath = GLib.get_home_dir();

    this._places.special.push(new PlaceInfo('special',
      Gio.File.new_for_path(homePath),
      _("Home")));

    for (let i = 0, len = DEFAULT_DIRECTORIES.length; i < len; i++) {
      let specialPath = GLib.get_user_special_dir(DEFAULT_DIRECTORIES[i]);
      if (specialPath) {
        if (specialPath == homePath) {
          continue;
        }
        this._places.special.push(new PlaceInfo('special',
          Gio.File.new_for_path(specialPath)));
      }
    }

    /*
     * Show devices, code more or less ported from nautilus-places-sidebar.c
     */
    this._volumeMonitor = Gio.VolumeMonitor.get();
    this._connectVolumeMonitorSignals();
    this._updateMounts();

    this._bookmarksFile = this._findBookmarksFile(); // Passingthru67 - Added missing semi-colon
    this._bookmarkTimeoutId = 0;
    this._monitor = null;

    if (this._bookmarksFile) {
      this._monitor = this._bookmarksFile.monitor_file(Gio.FileMonitorFlags.NONE, null);
      this._monitor.connect('changed', Lang.bind(this, function() {
        if (this._bookmarkTimeoutId > 0) {
          return;
        }
        /* Defensive event compression */
        this._bookmarkTimeoutId = Mainloop.timeout_add(100, Lang.bind(this, function() {
          this._bookmarkTimeoutId = 0;
          this._reloadBookmarks();
          return false;
        }));
      }));
      this._reloadBookmarks();
    }
  },

  _connectVolumeMonitorSignals: function() {
    const signals = ['volume-added', 'volume-removed', 'volume-changed',
      'mount-added', 'mount-removed', 'mount-changed',
      'drive-connected', 'drive-disconnected', 'drive-changed'
    ];

    this._volumeMonitorSignals = [];
    let func = Lang.bind(this, this._updateMounts);
    for (let i = 0, len = signals.length; i < len; i++) {
      let id = this._volumeMonitor.connect(signals[i], func);
      this._volumeMonitorSignals.push(id);
    }
  },

  destroy: function() {
    for (let i = 0, len = this._volumeMonitorSignals.length; i < len; i++) {
      this._volumeMonitor.disconnect(this._volumeMonitorSignals[i]);
    }

    if (this._monitor) {
      this._monitor.cancel();
    }
    if (this._bookmarkTimeoutId) {
      Mainloop.source_remove(this._bookmarkTimeoutId);
    }
  },

  _updateMounts: function() {
    this._places.devices = [];
    this._places.network = [];

    this._places.devices.push(new PlaceInfo('devices',
      Gio.File.new_for_path('/'),
      _("Computer"),
      'drive-harddisk'));
    this._places.network.push(new PlaceInfo('network',
      Gio.File.new_for_uri('network:///'),
      _("Browse network"),
      'network-workgroup'));

    /* first go through all connected drives */
    let drives = this._volumeMonitor.get_connected_drives();
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
          this._addMount(kind, mount);
        }
      }
    }

    /* add all volumes that is not associated with a drive */
    let volumes = this._volumeMonitor.get_volumes();
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
        this._addMount(kind, mount);
      }
    }

    /* add mounts that have no volume (/etc/mtab mounts, ftp, sftp,...) */
    let mounts = this._volumeMonitor.get_mounts();
    for (let i = 0, len = mounts.length; i < len; i++) {
      if (mounts[i].is_shadowed() || mounts[i].get_volume()) {
        continue;
      }

      let root = mounts[i].get_default_location();
      let kind = root.is_native() ? 'devices' : 'network';

      this._addMount(kind, mounts[i]);
    }

    this.emit('devices-updated');
    this.emit('network-updated');
  },

  _findBookmarksFile: function() {
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
  },

  _reloadBookmarks: function() {
    this._bookmarks = [];

    let [success, content] = this._bookmarksFile.load_contents(null);
    if (!success) return;
    let lines = content.toString().split('\n');

    let bookmarks = [];
    for (let i = 0, len = lines.length; i < len; i++) {
      let line = lines[i];
      let components = line.split(' ');
      let bookmark = components[0];

      if (!bookmark) {
        continue;
      }

      let file = Gio.File.new_for_uri(bookmark);
      if (file.is_native() && !file.query_exists(null)) {
        continue;
      }

      let duplicate = false;
      for (let i = 0, len = this._places.special.length; i < len; i++) {
        if (file.equal(this._places.special[i].file)) {
          duplicate = true;
          break;
        }
      }
      if (duplicate) {
        continue;
      }
      for (let i = 0, len = bookmarks.length; i < len; i++) {
        if (file.equal(bookmarks[i].file)) {
          duplicate = true;
          break;
        }
      }
      if (duplicate) {
        continue;
      }

      let label = null;
      if (components.length > 1) {
        label = components.slice(1).join(' ');
      }

      bookmarks.push(new PlaceInfo('bookmarks', file, label));
    }

    this._places.bookmarks = bookmarks;

    this.emit('bookmarks-updated');
  },

  _addMount: function(kind, mount) {
    let devItem = new PlaceDeviceInfo(kind, mount);
    this._places[kind].push(devItem);
  },

  getPlace: function(kind) {
    return this._places[kind];
  },

  getAllPlaces: function() {
    return this._places.special.concat(this._places.bookmarks, this._places.devices);
  },

  getDefaultPlaces: function() {
    return this._places.special;
  },

  getBookmarks: function() {
    return this._places.bookmarks;
  },

  getMounts: function() {
    return this._places.devices;
  }
};
Signals.addSignalMethods(PlacesManager.prototype);
