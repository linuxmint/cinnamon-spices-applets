const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Pango = imports.gi.Pango;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const AppletDir = imports.ui.appletManager.applets['Cinnamenu@json'];
const setTimeout = AppletDir.timers.setTimeout;
const clearTimeout = AppletDir.timers.clearTimeout;

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

const Chromium = AppletDir.webChromium;
const Firefox = AppletDir.webFirefox;
const GoogleChrome = AppletDir.webGoogleChrome;
const Midori = AppletDir.webMidori;
const Opera = AppletDir.webOpera;

const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();

const ApplicationType = {
  _applications: 0,
  _places: 1,
  _recent: 2
};

const ApplicationsViewMode = {
  LIST: 0,
  GRID: 1
};

/**
 * @name SearchWebBookmarks
 * @description Class to consolodate search of web browser(s) bookmarks
 * @description Code borrowed from SearchBookmarks extension by bmh1980
 * @description at https://extensions.gnome.org/extension/557/search-bookmarks/
 */
function SearchWebBookmarks() {
  this._init.apply(this, arguments);
}

SearchWebBookmarks.prototype = {

  _init: function () {
    Chromium.init();
    Firefox.init();
    GoogleChrome.init();
    Midori.init();
    Opera.init();
  },

  destroy: function () {
    Chromium.deinit();
    Firefox.deinit();
    GoogleChrome.deinit();
    Midori.deinit();
    Opera.deinit();
  }
};

/**
   * @name CategoryListButton
   * @description A button with an icon that holds category info
   *
   * @param {class} _parent
   * @param {string} dir
   * @param {string} altNameText
   * @param {any} altIconName
   * @param {string} selectorMethod
   */

function CategoryListButton() {
  this._init.apply(this, arguments);
}

CategoryListButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function(_parent, dir, altNameText, altIconName, selectorMethod) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false,
      activate: false
    });

    if (!selectorMethod) {
      selectorMethod = '_selectCategory';
    }
    this.selectorMethod = selectorMethod;

    this._parent = _parent;
    this._ignoreHoverSelect = null;

    this.actor.set_style_class_name('menu-category-button');
    this.actor._delegate = this;
    let iconSize = _parent.categoryIconSize;

    this._dir = dir;
    let isStrDir = typeof dir === 'string';
    let dirName = !isStrDir ? dir.get_name() : null;
    let categoryNameText = isStrDir ? altNameText : dirName ? dirName : '';
    this.disabled = false;

    if (this._parent.showCategoryIcons) {
      let icon;
      if (!isStrDir) {
        icon = dir.get_icon();
        if (icon && icon.get_names) {
          this.icon_name = icon.get_names().toString();
        } else {
          this.icon_name = '';
        }
        if (this.icon_name) {
          this.icon = St.TextureCache.get_default().load_gicon(null, icon, iconSize);
        } else {
          icon = dir.get_icon() && typeof dir.get_icon().get_names === 'function' ? dir.get_icon().get_names().toString() : 'error';
          this.icon = new St.Icon({
            icon_name: icon,
            icon_size: iconSize
          });
        }
      } else {
        this.icon_name = altIconName;
        icon = altIconName;
        this.icon = new St.Icon({
          icon_name: icon,
          icon_size: iconSize,
          icon_type: St.IconType.FULLCOLOR
        });
      }
      this.addActor(this.icon);
      this.icon.realize();
    }

    this.categoryNameText = categoryNameText;
    this.label = new St.Label({
      text: this.categoryNameText,
      style_class: 'menu-category-button-label'
    });
    this.addActor(this.label);
    this.label.realize();

    // Connect signals
    this.actor.connect('enter-event', Lang.bind(this, this.handleEnter));
    this.actor.connect('leave-event', Lang.bind(this, this.handleLeave));
    this.actor.connect('button-release-event', Lang.bind(this, this.handleButtonRelease));
  },

  handleEnter: function () {
    if (this.disabled) {
      return false;
    }

    this.actor.add_style_class_name('menu-category-button-selected');
    this._parent.selectedAppTitle.set_text(this.categoryNameText);
    this._parent.selectedAppDescription.set_text('');

    if (this._ignoreHoverSelect) {
      return false;
    }

    Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, Lang.bind(this, function() {
      this._parent[this.selectorMethod](this, null);
    }));
    return true;
  },

  handleLeave: function () {
    this.actor.remove_style_class_name('menu-category-button-selected');
    this._parent.selectedAppTitle.set_text('');
    this._parent.selectedAppDescription.set_text('');
  },

  handleButtonRelease: function () {
    if (this.disabled) {
      return false;
    }

    this._parent.selectedAppTitle.set_text(this.categoryNameText);
    this._parent.selectedAppDescription.set_text('');
    this._parent._selectCategory(this);
  },

  disable: function () {
    if (this.actor.has_style_class_name('menu-category-button-greyed')) {
      return false;
    }

    this.actor.set_style_class_name('menu-category-button-greyed');
    this.disabled = true;
  },

  enable: function () {
    this.actor.set_style_class_name('menu-category-button');
    this.disabled = false;
  },

  destroy: function(actor) {
    this._parent = null;
    this.actor._delegate = null;
    this.label.destroy();
    if (this.icon) {
      this.icon.destroy();
    }

    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
  },
};

/**
 * @name ApplicationContextMenuItem
 * @description Context menu class based on the one found in the default Cinnamon applet.
 *
 * @param {class} appButton
 * @param {string} label
 * @param {boolean} action
 * @param {string} iconName
 */

function ApplicationContextMenuItem() {
  this._init.apply(this, arguments);
}

ApplicationContextMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function(appButton, label, action, iconName) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      focusOnHover: false
    });

    this._appButton = appButton;
    this._action = action;
    this.label = new St.Label({
      text: label
    });

    if (iconName !== null) {
      this.icon = new St.Icon({
        icon_name: iconName,
        icon_size: 12,
        icon_type: St.IconType.SYMBOLIC
      });
      if (this.icon) {
        this.addActor(this.icon);
        this.icon.realize();
      }
    }

    this.addActor(this.label);
  },

  activate: function(event) {
    switch (this._action) {
      case 'add_to_panel':
        if (!Main.AppletManager.get_role_provider_exists(Main.AppletManager.Roles.PANEL_LAUNCHER)) {
          let new_applet_id = global.settings.get_int('next-applet-id');
          global.settings.set_int('next-applet-id', (new_applet_id + 1));
          let enabled_applets = global.settings.get_strv('enabled-applets');
          enabled_applets.push('panel1:right:0:panel-launchers@cinnamon.org:' + new_applet_id);
          global.settings.set_strv('enabled-applets', enabled_applets);
        }

        let launcherApplet = Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER);
        launcherApplet.acceptNewLauncher(this._appButton.app.get_id());

        this._appButton.toggleMenu();
        this._appButton._parent.menu.open();
        break;
      case 'add_to_desktop':
        let file = Gio.file_new_for_path(this._appButton.app.get_app_info().get_filename());
        let destFile = Gio.file_new_for_path(USER_DESKTOP_PATH + '/' + this._appButton.app.get_id());
        try {
          file.copy(destFile, 0, null, function() {});
          FileUtils.changeModeGFile(destFile, 755);
        } catch (e) {
          global.log(e);
        }
        this._appButton.toggleMenu();
        break;
      case 'add_to_favorites':
        this._appButton._parent.appFavorites.addFavorite(this._appButton.app.get_id());
        this._appButton.menu.close();
        break;
      case 'remove_from_favorites':
        this._appButton._parent.appFavorites.removeFavorite(this._appButton.app.get_id());
        this._appButton.menu.close();
        break;
      case 'uninstall':
        Util.spawnCommandLine('gksu -m \'' + _('Please provide your password to uninstall this application')
          + '\' /usr/bin/cinnamon-remove-application \'' + this._appButton.app.get_app_info().get_filename() + '\'');
        this._appButton._parent.menu.close();
        break;
      case 'run_with_nvidia_gpu':
        Util.spawnCommandLine('optirun gtk-launch ' + this._appButton.app.get_id());
        this._appButton._parent.menu.close();
        break;
    }
    return false;
  }
};

  /**
   * @name AppListGridButton
   * @description A button container with an icon, label, and dot responsible for
   * @description handling both list and grid views.
   *
   * @param {class} _parent
   * @param {object} app
   * @param {number} appType
   * @param {number} appIndex
   * @param {number} appListLength
   */

function AppListGridButton() {
  this._init.apply(this, arguments);
}

AppListGridButton.prototype = {
  __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

  _init: function(_parent, app, appType, appIndex, appListLength) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false,
      activate: false
    });

    this._parent = _parent;
    this.actor._delegate = this;

    this.menu = new PopupMenu.PopupSubMenu(this.actor);
    this.menu.actor.set_style_class_name('menu-context-menu');
    this.menu.box.set_style('background-color: ' + this._parent.theme.backgroundColor + '; border: 1px solid' + this._parent.theme.borderColor
      + '; border-radius: ' + this._parent.theme.borderRadius + 'px; padding-top: ' + this._parent.theme.padding + 'px; padding-bottom: ' + this._parent.theme.padding + 'px;');
    this.menu.isOpen = false;

    this.app = app;
    this.appType = appType;
    this.isStrApp = typeof app === 'string';
    this.isGridType = this._parent.startupViewMode === ApplicationsViewMode.GRID;
    this.appListLength = appListLength;
    this._stateChangedId = 0;
    this.column = null;
    let className = '';
    this.appIndex = appIndex;

    if (this.isGridType) {
      className = 'menu-application-button'
      if (this._parent.appsGridIconScale) {
        let size = Math.round(Math.abs((Math.round(appListLength / this._parent.appsGridColumnCount)) - 2048) / appListLength);
        size = isNaN(size) || size < 48 ? 48 : size > 102 ? 102 : size;
        this._iconSize = size;
      } else {
        this._iconSize = this._parent.appsGridIconSize > 0 ? this._parent.appsGridIconSize : 64;
      }


    } else {
      className = 'menu-application-button';
      this._iconSize = (this._parent.appsListIconSize > 0) ? this._parent.appsListIconSize : 28;
      this._iconContainer = new St.BoxLayout({
        vertical: true
      });
    }

    this.actor.set_style_class_name(className);
    this.actor.x_align = this.isGridType ? St.Align.MIDDLE : St.Align.START;
    this.actor.y_align = St.Align.MIDDLE;

    if (this.isGridType) {
      this.actor.width = this._parent.applicationsGridBox.width / this._parent.appsGridColumnCount;
    }

    // appType 0 = application, appType 1 = place, appType 2 = recent

    if (this.isStrApp) {
      if (app.charAt(0) === '~') {
        app = app.slice(1);
        app = GLib.get_home_dir() + app;
      }
      const name = app;
      let contentType = Gio.content_type_guess(name, null);
      let themedIcon = Gio.content_type_get_icon(contentType[0]);
      this.isPath = app[0] === '/';
      this.app = {
        name: name,
        description: name,
        uri: name,
        icon: themedIcon
      };
      this.appType = ApplicationType._places;
      this.file = Gio.file_new_for_path(this.app.name);
      try {
        this.handler = this.file.query_default_handler(null);
      } catch (e) {
        this.handler = null;
      }
    }

    if (this.app.description) {
      let slice = this.app.description.slice(0, 7);
      if (slice === 'http://' || slice === 'file://') {
        this.app.description = this.app.description.slice(7);
      }
      if (this.app.description.slice(-1) === '/') {
        this.app.description = this.app.description.slice(0, -1);
      }
    } else {
      this.app.description = this._parent.fallbackDescription;
    }

    if (this.appType === ApplicationType._applications) {
      if (this._parent.showApplicationIcons) {
        this.icon = this.app.create_icon_texture(this._iconSize);
      }
    } else if (this.appType === ApplicationType._places) {
      if (this._parent.showApplicationIcons) {
        let iconObj = {
          icon_size: this._iconSize
        };
        if (this.file) {
          iconObj.icon_name = this.app.icon === undefined ? 'unknown' : 'folder';
          iconObj.icon_type = St.IconType.FULLCOLOR;
        } else {
          iconObj.gicon = this.app.icon;
        }

        this.icon = new St.Icon(iconObj);
        if (!this.icon) {
          this.icon = new St.Icon({
            icon_name: 'error',
            icon_size: this._iconSize,
            icon_type: St.IconType.FULLCOLOR
          });
        }
      }
    } else if (this.appType === ApplicationType._recent) {
      if (this._parent.showApplicationIcons) {
        let gicon = Gio.content_type_get_icon(this.app.mime);
        this.icon = new St.Icon({
          gicon: gicon,
          icon_size: this._iconSize
        });
        if (!this.icon) {
          this.icon = new St.Icon({
            icon_name: 'error',
            icon_size: this._iconSize,
            icon_type: St.IconType.FULLCOLOR
          });
        }
      }
    }

    this.label = new St.Label({
      text: this.app.name,
      style_class: 'menu-application-button-label'
    });

    this.dot = new St.Widget({
      style: 'width: 5px; height: 5px; background-color: ' + this._parent.theme.mainBoxBorderColor + '; margin-bottom: 2px; border-radius: 128px;',
      layout_manager: new Clutter.BinLayout(),
      x_expand: true,
      y_expand: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.END
    });

    this.buttonBox = new St.BoxLayout({
      vertical: this.isGridType,
      width: 250
    });
    let iconDotContainer = this.isGridType ? 'buttonBox' : '_iconContainer';
    if (this.icon) {
      this[iconDotContainer].add(this.icon, {
        x_fill: false,
        y_fill: false,
        x_align: this.isGridType ? St.Align.MIDDLE : St.Align.END,
        y_align: this.isGridType ? St.Align.START : St.Align.END
      });
    }
    if (!this.isGridType) {
      this.buttonBox.add(this._iconContainer, {
        x_fill: false,
        y_fill: false,
        x_align: St.Align.START,
        y_align: St.Align.MIDDLE
      });
    }
    this.buttonBox.add(this.label, {
      x_fill: false,
      y_fill: false,
      x_align: this.isGridType ? St.Align.MIDDLE : St.Align.START,
      y_align: St.Align.MIDDLE
    });
    this[iconDotContainer].add(this.dot, {
      x_fill: false,
      y_fill: true,
      x_align: this.isGridType ? St.Align.MIDDLE : St.Align.END,
      y_align: this.isGridType ? St.Align.START : St.Align.END
    });

    this.buttonBox.add_actor(this.menu.actor);
    this.addActor(this.buttonBox);
    if (this.icon) {
      this.icon.realize();
    }
    if (this._parent.showAppDescriptionsOnButtons) {
      this.formatLabel({});
    }
    this.label.realize();

    // Connect signals
    if (this.appType === ApplicationType._applications) {
      this._stateChangedId = this.app.connect('notify::state', Lang.bind(this, this._onStateChanged));
    }

    // Check if running state
    this.dot.opacity = 0;
    this._onStateChanged();

    this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
    this.actor.connect('enter-event', Lang.bind(this, this.handleEnter));
    this.actor.connect('leave-event', Lang.bind(this, this.handleLeave));
    this.actor.connect('parent-set', Lang.bind(this, this.handleParentChange));
  },

  handleParentChange: function () {
    this.isGridType = this._parent.startupViewMode === ApplicationsViewMode.GRID;
    if (!this.app.description) {
      this.app.description = this._parent.fallbackDescription;
    }
    if (this._parent.searchActive) {
      this.formatLabel({});
    }
    if (this.icon) {
      this.icon.realize();
    }
    if (this._parent.showAppDescriptionsOnButtons) {
      this.formatLabel({});
    }
    this.label.realize();
  },

  formatLabel: function (opts) {
    let description = this.app.description;
    if (this.description) {
      let diff = this.description.length - description.length;
      diff = Array(Math.abs(Math.ceil(diff))).join(' ');
      description = description + diff;
    }

    if (opts.removeFormatting) {
      this.app.name = this.app.name.replace(/<[^>]*>/g, '');
      this.app.description = this.app.description.replace(/<[^>]*>/g, '');
    }

    let markup = '<span>' + this.app.name.replace(/&/g, '&amp;') + '</span>';

    if (this._parent.showAppDescriptionsOnButtons) {
      markup += '\n<span size="small">' + description.replace(/&/g, '&amp;') + '</span>';
    } else {
      if (this._parent.searchActive) {
        let nameClutterText = this._parent.selectedAppTitle.get_clutter_text();
        if (nameClutterText) {
          nameClutterText.set_markup(this.app.name.replace(/&/g, '&amp;'));
        }
        let descriptionClutterText = this._parent.selectedAppDescription.get_clutter_text();
        if (descriptionClutterText) {
          descriptionClutterText.set_markup(description.replace(/&/g, '&amp;'));
        }
      } else {
        this._parent.selectedAppTitle.set_text(this.app.name.replace(/<[^>]*>/g, ''));
        this._parent.selectedAppDescription.set_text(description.replace(/<[^>]*>/g, ''));
      }
    }

    if (this.app.shouldHighlight) {
      markup = '<b>' + markup + '</b>';
    }
    let clutterText = this.label.get_clutter_text();
    if (clutterText) {
      this.label.get_clutter_text().set_markup(markup);
      clutterText.ellipsize = opts.reset && opts.reset === 1 ? null : Pango.EllipsizeMode.END;
    }

    if (this.isGridType) {
      let width = this.description ? this.description.length : this.app.description.length;
      this.label.set_style('text-align: center;min-width: ' + width.toString() + 'px;');
    }
  },

  handleMarquee: function (opts) {
    if (opts.reset === 2) {
      opts.reset = 0;
    }

    if (opts.firstRecursion) {
      opts.firstRecursion = false;
      opts.limit = opts.end;
    }

    //log([opts.start, opts.end, opts.limit, this.app.description.length, this.description.length])

    if (opts.reset === 1) {
      opts.start = 0;
      opts.end = opts.limit;
      this.app.description = this.description;
      opts.reset = 2;
    } else if (Math.floor(opts.end) === this.description.length) {
      opts.reset = 1;
    } else {
      ++opts.start;
      ++opts.end;
      this.app.description = this.description.substr(opts.start, opts.end);
    }

    this.formatLabel(opts);

    let interval = opts.reset > 0 ? 1000 : 75;

    this.marqueeTimer = setTimeout(()=>this.handleMarquee(opts), interval);
  },

  handleEnter: function () {
    if (this._parent.menuIsOpen && this._parent.menuIsOpen !== this.appIndex) {
      return false;
    }

    this._parent._selectedItemIndex = this.appIndex;

    this.actor.add_style_class_name('menu-application-button-selected');

    // Check marquee conditions, and set it up
    let labelWidth, actorWidth, allocatedTextLength;
    if (this._parent.showAppDescriptionsOnButtons) {
      labelWidth = this.label.get_size()[0];
      actorWidth = this.actor.get_size()[0];
      allocatedTextLength = this.isGridType ? actorWidth / (this._parent.appsGridColumnCount * 2) : 41;
    } else {
      this.formatLabel({});
      labelWidth = this.app.description.length;
      actorWidth = 16;
      allocatedTextLength = 16;
    }
    if (labelWidth > actorWidth && !this._parent.menuIsOpen) {
      this.description = this.app.description;
      this.marqueeTimer = setTimeout(()=>this.handleMarquee({
        start: 0,
        end: allocatedTextLength,
        firstRecursion: true,
        reset: 0
      }), 1000);
    } else {
      this.formatLabel({});
    }
    return true;
  },

  handleLeave: function (fromKey) {
    if (fromKey === true) {
      this._parent._selectedItemIndex = -1;
    }

    if (this.description) {
      this.app.description = this.description;
      this.formatLabel({});
      if (!this._parent.menuIsOpen) {
        clearTimeout(this.marqueeTimer);
      }
    }

    //this.actor.remove_style_class_name('menu-application-button-selected');
    this.actor.set_style_class_name('menu-application-button');
    this._parent.selectedAppTitle.set_text('');
    this._parent.selectedAppDescription.set_text('');
  },

  highlight: function () { // TBD
    this.actor.add_style_pseudo_class('highlighted');
  },

  unhighlight: function () { // TBD
    var app_key = this.app.get_id();
    if (app_key === null) {
      app_key = this.app.get_name() + ':' + this.app.get_description();
    }
    //this.appsMenuButton._knownApps.push(app_key);
    this.actor.remove_style_pseudo_class('highlighted');
  },

  _onButtonReleaseEvent: function(actor, e){
    let button = e.get_button();
    if (button === 1) {
      if (this.menuIsOpen) {
        if (this._parent.menuIsopen !== this.appIndex && this.menu._activeMenuItem) {
          this.menu._activeMenuItem.activate();
        } else {
          this.menu.close();
        }
        return false;
      }
      this.activate(e);
    } else if (button === 3) {
      this.activateContextMenus(e);
    }
    return true;
  },

  activate: function (event) {
    if (this.file) {
      if (this.handler) {
        this.handler.launch([this.file], null);
      } else {
        try {
          Util.spawn(['gvfs-open', this.app.uri])
        } catch (e) {
          global.logError('No handler available to open ' + this.app.uri);
        }
      }
    } else if (this.appType === ApplicationType._applications) {
      this.app.open_new_window(-1);
    } else if (this.appType === ApplicationType._places) {
      if (this.app.uri) {
        this.app.app.launch_uris([this.app.uri], null);
      } else {
        this.app.launch();
      }
    } else if (this.appType === ApplicationType._recent) {
      Gio.app_info_launch_default_for_uri(this.app.uri, global.create_app_launch_context(0, -1));
    }
    this._parent.menu.close();
  },

  activateContextMenus: function (event) {
    if (!this.menu.isOpen) {
      // Make sure all other context menus are closed before toggle.
      let children = this._parent._activeContainer.get_children();
      for (let i = 0, len = children.length; i < len; i++) {
        if (this.appIndex !== children[i]._delegate.appIndex) {
          children[i]._delegate.closeMenu();
        }
      }
    }
    this.toggleMenu(!this.isGridType);
  },

  setColumn: function(column) {
    this.column = column;
    if ((column === 0 || column === this.appListLength) && this.appListLength > 1) {
      this.menu.actor.set_position(-90, 50);
    } else if (column === this._parent.appsGridColumnCount) {
      this.menu.actor.set_position(160, 50);
    } else {
      this.menu.actor.set_position(0, 50);
    }
  },

  _onStateChanged: function () {
    if (!this.app) {
      return false;
    }
    if (this.appType === ApplicationType._applications) {
      if (this.app.state != Cinnamon.AppState.STOPPED) {
        this.dot.opacity = 255;
      } else {
        this.dot.opacity = 0;
      }
    }
    return true;
  },

  getDragActor: function () {
    let appIcon;
    if (this.appType === ApplicationType._applications) {
      appIcon = this.app.create_icon_texture(this._iconSize);
    } else if (this.appType === ApplicationType._places) {
      appIcon = new St.Icon({
        gicon: this.app.icon,
        icon_size: this._iconSize
      });
    } else if (this.appType === ApplicationType._recent) {
      let gicon = Gio.content_type_get_icon(this.app.mime);
      appIcon = new St.Icon({
        gicon: gicon,
        icon_size: this._iconSize
      });
    }
    return appIcon;
  },

  closeMenu: function () {
    this.menu.close();
  },

  toggleMenu: function () {
    if (this.appType !== ApplicationType._applications) {
      return false;
    }

    if (!this.menu.isOpen) {
      let children = this.menu.box.get_children();
      for (var i = 0; i < children.length; i++) {
        this.menu.box.remove_actor(children[i]);
      }
      this._parent.menuIsOpen = this.appIndex;

      let menuItem;
      menuItem = new ApplicationContextMenuItem(this, _('Add to panel'), 'add_to_panel', 'list-add');
      this.menu.addMenuItem(menuItem);
      if (USER_DESKTOP_PATH) {
        menuItem = new ApplicationContextMenuItem(this, _('Add to desktop'), 'add_to_desktop', 'computer');
        this.menu.addMenuItem(menuItem);
      }
      if (this._parent.appFavorites.isFavorite(this.app.get_id())) {
        menuItem = new ApplicationContextMenuItem(this, _('Remove from favorites'), 'remove_from_favorites',
          'starred');
        this.menu.addMenuItem(menuItem);
      } else {
        menuItem = new ApplicationContextMenuItem(this, _('Add to favorites'), 'add_to_favorites', 'non-starred');
        this.menu.addMenuItem(menuItem);
      }
      menuItem = new ApplicationContextMenuItem(this, _('Uninstall'), 'uninstall', 'edit-delete');
      this.menu.addMenuItem(menuItem);
      if (this._parent._isBumblebeeInstalled) {
        menuItem = new ApplicationContextMenuItem(this, _('Run with NVIDIA GPU'), 'run_with_nvidia_gpu', 'cpu');
        this.menu.addMenuItem(menuItem);
      }
      this.actor.add_style_class_name('menu-application-button-selected');

      // In grid mode we will ensure our menu isn't overlapped by any other actors.
      if (this.isGridType) {
        this.actor.raise_top();
      }

    } else {
      if (this.isGridType) {
        // Reset the actor depth.
        //this.buttonBox.lower_bottom();
      }
      // Allow other buttons hover functions to take effect.
      this._parent.menuIsOpen = null;
    }
    this.menu.toggle_with_options(this._parent.enableAnimation);
    return true
  },

  clearSearchFormatting: function () {
    this.formatLabel({
      removeFormatting: true
    });
  },

  destroy: function () {
    this.actor._delegate = null;
    this._parent = null;
    this.app = null;
    /*let children = this.menu.box.get_children();
    for (var i = 0; i < children.length; i++) {
      this.menu.box.remove_actor(children[i]);
    }*/
    this.menu.destroy();
    this.dot.destroy();
    this.label.destroy();
    if (this.icon) {
      this.icon.destroy();
    }
    if (this._iconContainer) {
      this._iconContainer.destroy();
    }
    this.buttonBox.destroy();
    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
  }
};

  /**
   * @name GroupButton
   * @description A generic icon button used for user/power group buttons
   *
   * @param {class} _parent
   * @param {string} iconName
   * @param {number} iconSize
   * @param {string} name
   * @param {string} description
   * @param {function} buttonReleaseCallback
   */

function GroupButton() {
  this._init.apply(this, arguments);
}

GroupButton.prototype = {
  __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,


  _init: function (_parent, iconName, iconSize, name, description, buttonReleaseCallback) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false,
      activate: false
    });
    this._parent = _parent;
    this.name = name;
    this.description = description;
    this.buttonReleaseCallback = buttonReleaseCallback;

    let monitorHeight = Main.layoutManager.primaryMonitor.height;
    let realSize = (0.7 * monitorHeight) / 4;
    let adjustedIconSize = 0.6 * realSize / global.ui_scale;
    if (adjustedIconSize > iconSize) {
      adjustedIconSize = iconSize;
    }
    this.actor.style = 'padding-top: ' + (adjustedIconSize / 3) + 'px;padding-bottom: ' + (adjustedIconSize / 3) + 'px; margin:auto;'
    this.actor.add_style_class_name('menu-favorites-button');
    this.actor._delegate = this;

    if (iconName && iconSize) {
      this._iconSize = adjustedIconSize;
      this.icon = new St.Icon({
        icon_name: iconName,
        icon_size: adjustedIconSize,
        icon_type: adjustedIconSize <= 25 ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR
      });
      this.addActor(this.icon);
      this.icon.realize();
    }

    this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
  },

  _onButtonReleaseEvent: function () {
    this._parent.menu.close();
    this.buttonReleaseCallback();
  },

  destroy: function(actor) {
    this.label.destroy();
    if (this.icon) {
      this.icon.destroy();
    }
    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
  },
};
