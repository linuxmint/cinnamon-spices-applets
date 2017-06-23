const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const AppletDir = imports.ui.appletManager.applets['Cinnamenu@json'];

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

/* =========================================================================
/* name:    SearchWebBookmarks
 * @desc    Class to consolodate search of web browser(s) bookmarks
 * @desc    Code borrowed from SearchBookmarks extension by bmh1980
 * @desc    at https://extensions.gnome.org/extension/557/search-bookmarks/
 * ========================================================================= */

function SearchWebBookmarks() {
  this._init.apply(this, arguments);
}

SearchWebBookmarks.prototype = {

  _init: function() {
    Chromium.init();
    Firefox.init();
    GoogleChrome.init();
    Midori.init();
    Opera.init();
  },

  destroy: function() {
    Chromium.deinit();
    Firefox.deinit();
    GoogleChrome.deinit();
    Midori.deinit();
    Opera.deinit();
  }
};

/* =========================================================================
/* name:    CategoryListButton
 * @desc    A button with an icon that holds category info
 * ========================================================================= */

function CategoryListButton() {
  this._init.apply(this, arguments);
}

CategoryListButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function(_parent, dir, altNameText, altIconName, selectorMethod) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });

    if (!selectorMethod) {
      selectorMethod = '_selectCategory';
    }
    this.selectorMethod = selectorMethod;

    this._parent = _parent;
    this._ignoreHoverSelect = null;

    this.actor.set_style_class_name('menu-category-button');
    this.actor._delegate = this;
    let iconSize = _parent._applet.categoryIconSize;

    this._dir = dir;
    this.disabled = false;
    let categoryNameText = '';

    let icon;

    if (typeof dir !== 'string') {
      icon = dir.get_icon();
      if (icon && icon.get_names) {
        this.icon_name = icon.get_names().toString();
      } else {
        this.icon_name = '';
      }
      let dirName = dir.get_name();
      categoryNameText = dirName ? dirName : '';
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
      categoryNameText = altNameText;
      this.icon_name = altIconName;
      icon = altIconName;
      this.icon = new St.Icon({
        icon_name: icon,
        icon_size: iconSize,
        icon_type: St.IconType.FULLCOLOR
      });
    }
    this.categoryNameText = categoryNameText;
    this.addActor(this.icon);
    this.icon.realize();
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

  handleEnter: function() {
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

  handleLeave: function() {
    this.actor.remove_style_class_name('menu-category-button-selected');
    this._parent.selectedAppTitle.set_text('');
    this._parent.selectedAppDescription.set_text('');
  },

  handleButtonRelease: function() {
    if (this.disabled) {
      return false;
    }

    this._parent.selectedAppTitle.set_text(this.categoryNameText);
    this._parent.selectedAppDescription.set_text('');
    this._parent._selectCategory(this);
  },

  disable: function() {
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

function ApplicationContextMenuItem(appButton, label, action, iconName) {
  this._init(appButton, label, action, iconName);
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
        this._appButton._parent._applet.appFavorites.addFavorite(this._appButton.app.get_id());
        this._appButton.menu.close();
        break;
      case 'remove_from_favorites':
        this._appButton._parent._applet.appFavorites.removeFavorite(this._appButton.app.get_id());
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

/* =========================================================================
/* name:    AppListGridButton
 * @desc    A button with an icon and label that holds app info for various
 * @desc    types of sources (application, places, recent)
 * ========================================================================= */

function AppListGridButton() {
  this._init.apply(this, arguments);
}

AppListGridButton.prototype = {
  __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,
  _init: function(_parent, app, appType, isGridType, appIndex, appListLength) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });

    this._parent = _parent;

    this.menu = new PopupMenu.PopupSubMenu(this.actor);
    this.menu.actor.set_style_class_name('menu-context-menu');
    this.menu.box.set_style('background-color: ' + this._parent.theme.backgroundColor + '; border: 1px solid' + this._parent.theme.borderColor
      + '; border-radius: ' + this._parent.theme.borderRadius + 'px; padding-top: ' + this._parent.theme.padding + 'px; padding-bottom: ' + this._parent.theme.padding + 'px;');
    this.menu.isOpen = false;

    this.app = app;
    this.appType = appType;
    this.isGridType = isGridType;
    this.appListLength = appListLength;
    this._stateChangedId = 0;
    this.column = null;
    let style = '';

    this.appIndex = appIndex;

    if (isGridType) {
      style = 'popup-menu-item cinnamenu-application-grid-button col'+this._parent._applet.appsGridColumnCount.toString();

      if (this._parent._applet.appsGridIconScale) {
        let size = Math.round(Math.abs((Math.round(appListLength / this._parent._applet.appsGridColumnCount)) - 2048) / appListLength);
        size = isNaN(size) || size < 48 ? 48 : size > 102 ? 102 : size;
        this._iconSize = size
      } else {
        this._iconSize = this._parent._applet.appsGridIconSize > 0 ? this._parent._applet.appsGridIconSize : 64;
      }

    } else {
      style = 'menu-application-button';
      this._iconSize = (this._parent._applet.appsListIconSize > 0) ? this._parent._applet.appsListIconSize : 28;
      this._iconContainer = new St.BoxLayout({
        vertical: true
      });
    }

    this.actor.set_style_class_name(style);
    this.actor.x_align = isGridType ? St.Align.MIDDLE : St.Align.START;
    this.actor.y_align = St.Align.MIDDLE;

    // appType 0 = application, appType 1 = place, appType 2 = recent
    if (appType == ApplicationType._applications) {
      this.icon = app.create_icon_texture(this._iconSize);
      this.label = new St.Label({
        text: app.name,
        style_class: 'menu-application-button-label'
      });
    } else if (appType == ApplicationType._places) {
      this.icon = new St.Icon({
        gicon: app.icon,
        icon_size: this._iconSize
      });
      if (!this.icon) {
        this.icon = new St.Icon({
          icon_name: 'error',
          icon_size: this._iconSize,
          icon_type: St.IconType.FULLCOLOR
        });
      }
      this.label = new St.Label({
        text: app.name,
        style_class: 'menu-application-button-label'
      });
    } else if (appType == ApplicationType._recent) {
      let gicon = Gio.content_type_get_icon(app.mime);
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
      this.label = new St.Label({
        text: app.name,
        style_class: 'menu-application-button-label'
      });
    }

    this.dot = new St.Widget({
      style: 'width: 5px; height: 5px; background-color: ' + this._parent.theme.mainBoxBorderColor + '; margin-bottom: 2px; border-radius: 128px;',
      layout_manager: new Clutter.BinLayout(),
      x_expand: true,
      y_expand: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.END
    });

    this.buttonBox = new St.BoxLayout({
      vertical: isGridType,
      width: 250
    });
    let iconDotContainer = isGridType ? 'buttonBox' : '_iconContainer';
    this[iconDotContainer].add(this.icon, {
      x_fill: false,
      y_fill: false,
      x_align: isGridType ? St.Align.MIDDLE : St.Align.END,
      y_align: isGridType ? St.Align.START : St.Align.END
    });
    if (!isGridType) {
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
      x_align: isGridType ? St.Align.MIDDLE : St.Align.START,
      y_align: isGridType ? St.Align.MIDDLE : St.Align.MIDDLE
    });
    this[iconDotContainer].add(this.dot, {
      x_fill: false,
      y_fill: false,
      x_align: isGridType ? St.Align.MIDDLE : St.Align.END,
      y_align: isGridType ? St.Align.START : St.Align.END
    });

    this.buttonBox.add_actor(this.menu.actor);
    this.addActor(this.buttonBox);
    this.icon.realize();
    this.label.realize();

    // Connect signals
    if (appType == ApplicationType._applications) {
      this._stateChangedId = this.app.connect('notify::state', Lang.bind(this, this._onStateChanged));
    }

    // Check if running state
    this.dot.opacity = 0;
    this._onStateChanged();

    this.actor.connect('enter-event', Lang.bind(this, this.handleEnter));
    this.actor.connect('leave-event', Lang.bind(this, this.handleLeave));
    this.actor.connect('button-press-event', Lang.bind(this, this.handleButtonPress));
  },

  handleEnter: function(actor, e) {
    if (this._parent.menuIsOpen && this._parent.menuIsOpen !== this.appIndex) {
      return false;
    }
    this.actor.add_style_class_name('menu-application-button-selected');
    if (this.appType === ApplicationType._applications) {
      this._parent.selectedAppTitle.set_text(this.app.name);
      if (this.app.description) {
        this._parent.selectedAppDescription.set_text(this.app.description);
      } else {
        this._parent.selectedAppDescription.set_text('');
      }
    } else {
      // Until we figure out how to prevent the menu width from expanding when long titles are displayed,
      // we will truncate the text.
      let nameLength = this.app.name.length;
      let truncLimit = this.isGridType ? 45 : 30;
      let trailingTrunc = nameLength > 70 ? '...' : '';
      let name = this.app.name.substring(0, truncLimit) + trailingTrunc;
      this._parent.selectedAppTitle.set_text(name);
      if (this.app.description) {
        this._parent.selectedAppDescription.set_text(this.app.description);
      } else {
        if (this.app.hasOwnProperty('uri')) {
          this._parent.selectedAppDescription.set_text(this.app.uri);
        } else {
          this._parent.selectedAppDescription.set_text('');
        }
      }
    }
    return true;
  },

  handleLeave: function() {
    this.actor.remove_style_class_name('menu-application-button-selected');
    this._parent.selectedAppTitle.set_text('');
    this._parent.selectedAppDescription.set_text('');
  },

  handleButtonPress: function() {
    this.actor.add_style_pseudo_class('pressed');
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
    this.actor.remove_style_pseudo_class('pressed');
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
    this._parent.selectedAppTitle.set_text('');
    this._parent.selectedAppDescription.set_text('');
    if (this.appType === ApplicationType._applications) {
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
      for (let i = 0, len = this._parent.appButtons.length; i < len; i++) {
        if (this.appIndex !== this._parent.appButtons[i].appIndex) {
          this._parent.appButtons[i].closeMenu();
        }
      }
    }
    this.toggleMenu(this._parent._applet.startupViewMode === ApplicationsViewMode.LIST);
  },

  setColumn: function(column) {
    this.column = column;
    if ((column === 0 || column === this.appListLength) && this.appListLength > 1) {
      this.menu.actor.set_position(-90, 50);
    } else if (column === this._parent._applet.appsGridColumnCount) {
      this.menu.actor.set_position(160, 50);
    } else {
      this.menu.actor.set_position(0, 50);
    }
  },

  _onStateChanged: function() {
    if (!this.app) {
      return false;
    }
    if (this.appType == ApplicationType._applications) {
      if (this.app.state != Cinnamon.AppState.STOPPED) {
        this.dot.opacity = 255;
      } else {
        this.dot.opacity = 0;
      }
    }
    return true;
  },

  getDragActor: function() {
    let appIcon;
    if (this.appType == ApplicationType._applications) {
      appIcon = this.app.create_icon_texture(this._iconSize);
    } else if (this.appType == ApplicationType._places) {
      appIcon = new St.Icon({
        gicon: this.app.icon,
        icon_size: this._iconSize
      });
    } else if (this.appType == ApplicationType._recent) {
      let gicon = Gio.content_type_get_icon(this.app.mime);
      appIcon = new St.Icon({
        gicon: gicon,
        icon_size: this._iconSize
      });
    }
    return appIcon;
  },

  closeMenu: function() {
    this.menu.close();
  },

  toggleMenu: function() {
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
      if (this._parent._applet.appFavorites.isFavorite(this.app.get_id())) {
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
    this.menu.toggle_with_options(this._parent._applet.enableAnimation);
    return true
  },

  destroy: function() {
    this._parent = null;
    this.app = null;
    let children = this.menu.box.get_children();
    for (var i = 0; i < children.length; i++) {
      this.menu.box.remove_actor(children[i]);
    }
    this.menu.destroy();
    this.dot.destroy();
    this.label.destroy();
    this.icon.destroy();
    if (this._iconContainer) {
      this._iconContainer.destroy();
    }
    this.buttonBox.destroy();
    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
  }
};

/* =========================================================================
/* name:    GroupButton
 * @desc    A generic icon button
 * @impl    Used for user/power group buttons
 * ========================================================================= */

function GroupButton() {
  this._init.apply(this, arguments);
}

GroupButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (_parent, iconName, iconSize, labelText, params) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });
    this._applet = _parent._applet;
    this._opened = false;
    this.buttonEnterCallback = null;
    this.buttonLeaveCallback = null;
    this.buttonPressCallback = null;
    this.buttonReleaseCallback = null;

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
    if (labelText) {
      this.label = new St.Label({
        text: labelText,
        style_class: params.style_class + '-label'
      });
      this.addActor(this.label);
    }
  },

  setIcon: function(iconName) {
    this.removeActor(this.icon);
    this.icon.destroy();
    this.icon = this.icon = new St.Icon({
      icon_name: iconName,
      icon_size: this._iconSize,
      icon_type: St.IconType.FULLCOLOR
    });
    this.addActor(this.icon);
    this.icon.realize();
  },

  setButtonEnterCallback: function(cb) {
    this.buttonEnterCallback = cb;
    this.actor.connect('enter-event', Lang.bind(this, this.buttonEnterCallback));
  },

  setButtonLeaveCallback: function(cb) {
    this.buttonLeaveCallback = cb;
    this.actor.connect('leave-event', Lang.bind(this, this.buttonLeaveCallback));
  },

  setButtonPressCallback: function(cb) {
    this.buttonPressCallback = cb;
    this.actor.connect('button-press-event', Lang.bind(this, this.buttonPressCallback));
  },

  setButtonReleaseCallback: function(cb) {
    this.buttonReleaseCallback = cb;
    this.actor.connect('button-release-event', Lang.bind(this, this.buttonReleaseCallback));
  },

  select: function() {
    this.buttonEnterCallback.call();
  },

  unSelect: function() {
    this.buttonLeaveCallback.call();
  },

  click: function() {
    this.buttonPressCallback.call();
    this.buttonReleaseCallback.call();
  },

  _onButtonReleaseEvent: function(actor) {
    return false;
  },

  destroy: function(actor) {
    this._applet = null;
    this.label.destroy();
    if (this.icon) {
      this.icon.destroy();
    }

    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
  },
};
