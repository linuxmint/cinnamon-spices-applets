const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Signals = imports.signals;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
//const DND = imports.ui.dnd;
const AppletDir = imports.ui.appletManager.applets['Cinnamenu@json'];

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

  _init: function(_parent, dir, altNameText, altIconName) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });
    this.buttonEnterCallback = null;
    this.buttonLeaveCallback = null;
    this.buttonPressCallback = null;
    this.buttonReleaseCallback = null;
    this._ignoreHoverSelect = null;

    this.actor.set_style_class_name('menu-category-button');
    this.actor._delegate = this;
    let iconSize = _parent._applet.categoryIconSize;

    this._dir = dir;
    let categoryNameText = '';
    //let categoryIconName = null;

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
        icon = dir.get_icon() ? dir.get_icon().get_names().toString() : 'error';
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
    this.addActor(this.icon);
    this.icon.realize();
    this.label = new St.Label({
      text: categoryNameText,
      style_class: 'menu-category-button-label'
    });
    this.addActor(this.label);
    this.label.realize();

    // Connect signals
    this.actor.connect('touch-event', Lang.bind(this, this._onTouchEvent));
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
    this._ignoreHoverSelect = true;
    this.buttonEnterCallback.call();
  },

  unSelect: function() {
    this._ignoreHoverSelect = false;
    this.buttonLeaveCallback.call();
  },

  click: function() {
    this.buttonPressCallback.call();
    this.buttonReleaseCallback.call();
  },

  _onTouchEvent: function(actor, event) {
    return Clutter.EVENT_PROPAGATE;
  }
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
        AppFavorites.getAppFavorites().addFavorite(this._appButton.app.get_id());
        this._appButton.toggleMenu();
        break;
      case 'remove_from_favorites':
        AppFavorites.getAppFavorites().removeFavorite(this._appButton.app.get_id());
        this._appButton.toggleMenu();
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
  _init: function(_parent, app, appType, isGridType, appIndex, appListLength) {

    this._parent = _parent;
    this._applet = _parent._applet;
    this.app = app;
    this._type = appType;
    this.isGridType = isGridType;
    this._stateChangedId = 0;
    this.column = null;
    let style;

    this.appIndex = appIndex;

    if (isGridType) {
      style = 'popup-menu-item cinnamenu-application-grid-button col'+this._applet.appsGridColumnCount.toString();

      if (this._applet.appsGridIconScale) {
        let size = Math.round(Math.abs((Math.round(appListLength / this._applet.appsGridColumnCount)) - 2048) / appListLength);
        size = isNaN(size) || size < 48 ? 48 : size > 102 ? 102 : size;
        this._iconSize = size
      } else {
        this._iconSize = this._applet.appsGridIconSize > 0 ? this._applet.appsGridIconSize : 64;
      }

    } else {
      style = 'menu-application-button';
      this._iconSize = (this._applet.appsListIconSize > 0) ? this._applet.appsListIconSize : 28;
      this._iconContainer = new St.BoxLayout({
        vertical: true
      });
    }
    this.actor = new St.Button({
      reactive: true,
      style_class: style,
      x_align: isGridType ? St.Align.MIDDLE : St.Align.START,
      y_align: St.Align.MIDDLE
    });
    this.actor._delegate = this;

    // appType 0 = application, appType 1 = place, appType 2 = recent
    if (appType == ApplicationType._applications) {
      this.icon = app.create_icon_texture(this._iconSize);
      this.label = new St.Label({
        text: app.get_name(),
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

    this._dot = new St.Widget({
      style: 'width: 5px; height: 5px; background-color: ' + this._parent.theme.mainBoxBorderColor + '; margin-bottom: 2px; border-radius: 128px;',
      layout_manager: new Clutter.BinLayout(),
      x_expand: true,
      y_expand: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.END
    });

    this.buttonbox = new St.BoxLayout({
      vertical: isGridType,
      width: 250
    });
    let iconDotContainer = isGridType ? 'buttonbox' : '_iconContainer';
    this[iconDotContainer].add(this.icon, {
      x_fill: false,
      y_fill: false,
      x_align: isGridType ? St.Align.MIDDLE : St.Align.END,
      y_align: isGridType ? St.Align.START : St.Align.END
    });
    this.icon.realize();
    if (!isGridType) {
      this.buttonbox.add(this._iconContainer, {
        x_fill: false,
        y_fill: false,
        x_align: St.Align.START,
        y_align: St.Align.MIDDLE
      });
    }
    this.buttonbox.add(this.label, {
      x_fill: false,
      y_fill: false,
      x_align: isGridType ? St.Align.MIDDLE : St.Align.START,
      y_align: isGridType ? St.Align.MIDDLE : St.Align.MIDDLE
    });
    this[iconDotContainer].add(this._dot, {
      x_fill: false,
      y_fill: false,
      x_align: isGridType ? St.Align.MIDDLE : St.Align.END,
      y_align: isGridType ? St.Align.START : St.Align.END
    });

    this.menu = new PopupMenu.PopupSubMenu(this.actor);
    this.menu.actor.set_style_class_name('menu-context-menu');
    this.menu.box.set_style('background-color: ' + this._parent.theme.backgroundColor + '; border: 1px solid' + this._parent.theme.borderColor 
      + '; border-radius: ' + this._parent.theme.borderRadius + 'px; padding-top: ' + this._parent.theme.padding + 'px; padding-bottom: ' + this._parent.theme.padding + 'px;');
    this.buttonbox.add_actor(this.menu.actor);
    this.actor.set_child(this.buttonbox);

    // Connect signals
    //this.actor.connect('touch-event', Lang.bind(this, this._onTouchEvent));
    if (appType == ApplicationType._applications) {
      this._stateChangedId = this.app.connect('notify::state', Lang.bind(this, this._onStateChanged));
    }

    // Check if running state
    this._dot.opacity = 0;
    this._onStateChanged();
  },

  /*_onTouchEvent: function(actor, event) {
    return Clutter.EVENT_PROPAGATE;
  },*/

  setColumn: function(column) {
    this.column = column;
    if (column === 0) {
      this.menu.actor.set_position(-90, 50);
    } else if (column === this._applet.appsGridColumnCount) {
      this.menu.actor.set_position(160, 50);
    } else {
      this.menu.actor.set_position(0, 50);
    }
  },

  _onStateChanged: function() {
    if (this._type == ApplicationType._applications) {
      if (this.app.state != Cinnamon.AppState.STOPPED) {
        this._dot.opacity = 255;
      } else {
        this._dot.opacity = 0;
      }
    }
  },

  getDragActor: function() {
    let appIcon;
    if (this._type == ApplicationType._applications) {
      appIcon = this.app.create_icon_texture(this._iconSize);
    } else if (this._type == ApplicationType._places) {
      appIcon = new St.Icon({
        gicon: this.app.icon,
        icon_size: this._iconSize
      });
    } else if (this._type == ApplicationType._recent) {
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
    if (this._type !== ApplicationType._applications) {
      return false;
    }
    if (!this.menu.isOpen) {
      let children = this.menu.box.get_children();
      for (var i in children) {
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
      if (AppFavorites.getAppFavorites().isFavorite(this.app.get_id())) {
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

      // Make sure all other context menus are closed before toggle.
      for (let i = 0, len = this._parent.appButtons.length; i < len; i++) {
        if (this.appIndex !== this._parent.appButtons[i].appIndex) {
          this._parent.appButtons[i].closeMenu();
        }
      }
    } else {
      if (this.isGridType) {
        // Reset the actor depth.
        //this.buttonbox.lower_bottom();
      }
      // Allow other buttons hover functions to take effect.
      this._parent.menuIsOpen = null;
    }
    this.menu.toggle();
    return true
  },

  destroy: function() {
    this.actor._delegate = null;
    this.removeAll();
    this.menu.destroy();
    this.buttonbox.destroy_all_children();
    this.actor.destroy_all_children()
    this.actor.destroy();
  }
};
Signals.addSignalMethods(AppListGridButton.prototype);

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

    // Connect signals
    this.actor.connect('touch-event', Lang.bind(this, this._onTouchEvent));
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

  _onTouchEvent: function(actor, event) {
    return Clutter.EVENT_PROPAGATE;
  },

  _onButtonReleaseEvent: function(actor) {
    return false;
  },

  destroy: function(actor) {
    this._parent = null;
    this.label.destroy();
    if (this.icon) {
      this.icon.destroy();
    }

    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
  },
};
