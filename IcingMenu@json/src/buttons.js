const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;
const clog = imports.applet.clog

const MAX_FAV_ICON_SIZE = 32;
const CATEGORY_ICON_SIZE = 22;
const APPLICATION_ICON_SIZE = 22;

const MAX_BUTTON_WIDTH = 'max-width: 20em;';

const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();

function ApplicationContextMenuItem(appButton, label, action, iconName) {
  this._init(appButton, label, action, iconName);
}

ApplicationContextMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (appButton, label, action, iconName) {
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

  activate: function (event) {
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
      break;
    case 'add_to_desktop':
      let file = Gio.file_new_for_path(this._appButton.app.get_app_info().get_filename());
      let destFile = Gio.file_new_for_path(`${USER_DESKTOP_PATH}/${this._appButton.app.get_id()}`);
      try {
        file.copy(destFile, 0, null, function () {});
        try {
          FileUtils.changeModeGFile(destFile, 755);
        } catch (e) {
          Util.spawnCommandLine(`chmod +x '${USER_DESKTOP_PATH}/${this._appButton.app.get_id()}'`);
        }
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
      Util.spawnCommandLine(`gksu -m '${_('Please provide your password to uninstall this application')}' /usr/bin/cinnamon-remove-application '${this._appButton.app.get_app_info().get_filename()}'`);
      this._appButton.appsMenuButton.menu.close();
      break;
    case 'run_with_nvidia_gpu':
      Util.spawnCommandLine(`optirun gtk-launch ${this._appButton.app.get_id()}`);
      this._appButton.appsMenuButton.menu.close();
      break;
    }
    return false;
  }

};

function GenericApplicationButton(appsMenuButton, app) {
  this._init(appsMenuButton, app);
}

GenericApplicationButton.prototype = {
  __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

  _init: function (appsMenuButton, app, withMenu) {
    this.app = app;
    this.appsMenuButton = appsMenuButton;
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });

    this.withMenu = withMenu;
    if (this.withMenu) {
      this.menu = new PopupMenu.PopupSubMenu(this.actor);
      this.menu.actor.set_style_class_name('menu-context-menu');
      this.menu.connect('open-state-changed', ()=>this._subMenuOpenStateChanged);
    }
  },

  highlight: function () {
    this.actor.add_style_pseudo_class('highlighted');
  },

  unhighlight: function () {
    var app_key = this.app.get_id();
    if (app_key === null) {
      app_key = this.app.get_name() + ':' + this.app.get_description();
    }
    this.appsMenuButton._knownApps.push(app_key);
    this.actor.remove_style_pseudo_class('highlighted');
  },

  _onButtonReleaseEvent: function (actor, event) {
    if (event.get_button() == 1) {
      this.activate(event);
    }
    if (event.get_button() == 3) {
      this.activateContextMenus(event);
    }
    return true;
  },

  activate: function (event) {
    this.unhighlight();
    this.app.open_new_window(-1);
    this.appsMenuButton.menu.close();
  },

  activateContextMenus: function (event) {
    if (this.withMenu && !this.menu.isOpen) {
      this.appsMenuButton.closeContextMenus(this.app, true);
    }
    this.toggleMenu();
  },

  closeMenu: function () {
    if (this.withMenu) {
      this.menu.close();
    }
  },

  toggleMenu: function () {
    if (!this.withMenu) {
      return;
    }

    if (!this.menu.isOpen) {
      let children = this.menu.box.get_children();
      for (let i = 0, len = children.length; i < len; i++) {
        this.menu.box.remove_actor(children[i]);
      }
      var menuItem;
      menuItem = new ApplicationContextMenuItem(this, _('Add to panel'), 'add_to_panel', 'list-add');
      this.menu.addMenuItem(menuItem);
      if (USER_DESKTOP_PATH) {
        menuItem = new ApplicationContextMenuItem(this, _('Add to desktop'), 'add_to_desktop', 'computer');
        this.menu.addMenuItem(menuItem);
      }
      if (AppFavorites.getAppFavorites().isFavorite(this.app.get_id())) {
        menuItem = new ApplicationContextMenuItem(this, _('Remove from favorites'), 'remove_from_favorites', 'starred');
        this.menu.addMenuItem(menuItem);
      } else {
        menuItem = new ApplicationContextMenuItem(this, _('Add to favorites'), 'add_to_favorites', 'non-starred');
        this.menu.addMenuItem(menuItem);
      }
      if (this.appsMenuButton._canUninstallApps) {
        menuItem = new ApplicationContextMenuItem(this, _('Uninstall'), 'uninstall', 'edit-delete');
        this.menu.addMenuItem(menuItem);
      }
      if (this.appsMenuButton._isBumblebeeInstalled) {
        menuItem = new ApplicationContextMenuItem(this, _('Run with nVidia GPU'), 'run_with_nvidia_gpu', 'cpu');
        this.menu.addMenuItem(menuItem);
      }
    }
    this.menu.toggle();
  },

  _subMenuOpenStateChanged: function(recentContextMenu) {
    if (recentContextMenu.isOpen) {
      this.appsMenuButton._activeContextMenuParent = this;
      this.appsMenuButton._scrollToButton(recentContextMenu);
    } else {
      this.appsMenuButton._activeContextMenuItem = null;
      this.appsMenuButton._activeContextMenuParent = null;
    }
  },

  get _contextIsOpen() {
    return this.appsMenuButton.recentContextMenu !== null && this.appsMenuButton.recentContextMenu.isOpen;
  },

  destroy: function() {
    this.file = null;
    this.appsMenuButton = null;
    this.label.destroy();
    if (this.icon) {
      this.icon.destroy();
    }

    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
  },
}

function TransientButton(appsMenuButton, pathOrCommand) {
  this._init(appsMenuButton, pathOrCommand);
}

TransientButton.prototype = {
  __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

  _init: function (appsMenuButton, pathOrCommand) {
    let displayPath = pathOrCommand;
    if (pathOrCommand.charAt(0) == '~') {
      pathOrCommand = pathOrCommand.slice(1);
      pathOrCommand = GLib.get_home_dir() + pathOrCommand;
    }

    this.isPath = pathOrCommand.substr(pathOrCommand.length - 1) == '/';
    if (this.isPath) {
      this.path = pathOrCommand;
    } else {
      let n = pathOrCommand.lastIndexOf('/');
      if (n != 1) {
        this.path = pathOrCommand.substr(0, n);
      }
    }

    this.pathOrCommand = pathOrCommand;

    this.appsMenuButton = appsMenuButton;
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });

    // We need this fake app to help appEnterEvent/appLeaveEvent
    // work with our search result.
    this.app = {
      get_app_info: {
        get_filename: function () {
          return pathOrCommand;
        }
      },
      get_id: function () {
        return -1;
      },
      get_description: function () {
        return this.pathOrCommand;
      },
      get_name: function () {
        return '';
      }
    };

    this.file = Gio.file_new_for_path(this.pathOrCommand);

    try {
      this.handler = this.file.query_default_handler(null);
      let contentType = Gio.content_type_guess(this.pathOrCommand, null);
      let themedIcon = Gio.content_type_get_icon(contentType[0]);
      this.icon = new St.Icon({
        gicon: themedIcon,
        icon_size: APPLICATION_ICON_SIZE,
        icon_type: St.IconType.FULLCOLOR
      });
      this.actor.set_style_class_name('menu-application-button');
    } catch (e) {
      this.handler = null;
      let iconName = this.isPath ? 'folder' : 'unknown';
      this.icon = new St.Icon({
        icon_name: iconName,
        icon_size: APPLICATION_ICON_SIZE,
        icon_type: St.IconType.FULLCOLOR,
      });
      // @todo Would be nice to indicate we don't have a handler for this file.
      this.actor.set_style_class_name('menu-application-button');
    }

    this.addActor(this.icon);

    this.label = new St.Label({
      text: displayPath,
      style_class: 'menu-application-button-label'
    });
    this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    this.label.set_style(MAX_BUTTON_WIDTH);
    this.addActor(this.label);
    this.isDraggableApp = false;
  },

  _onButtonReleaseEvent: function (actor, event) {
    if (event.get_button() == 1) {
      this.activate(event);
    }
    return true;
  },

  activate: function (event) {
    if (this.handler !== null) {
      this.handler.launch([this.file], null)
    } else {
      // Try anyway, even though we probably shouldn't.
      try {
        Util.spawn(['gvfs-open', this.file.get_uri()])
      } catch (e) {
        global.logError('No handler available to open ' + this.file.get_uri());
      }

    }

    this.appsMenuButton.menu.close();
  }
}

function ApplicationButton(appsMenuButton, app, showIcon) {
  this._init(appsMenuButton, app, showIcon);
}

ApplicationButton.prototype = {
  __proto__: GenericApplicationButton.prototype,

  _init: function (appsMenuButton, app, showIcon) {
    GenericApplicationButton.prototype._init.call(this, appsMenuButton, app, true);
    this.category = [];
    this.actor.set_style_class_name('menu-application-button');

    if (showIcon) {
      this.icon = this.app.create_icon_texture(APPLICATION_ICON_SIZE)
      this.addActor(this.icon);
    }
    this.name = this.app.get_name();
    this.label = new St.Label({
      text: this.name,
      style_class: 'menu-application-button-label'
    });
    this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    this.label.set_style(MAX_BUTTON_WIDTH);
    this.addActor(this.label);
    this._draggable = DND.makeDraggable(this.actor);
    this._draggable.connect('drag-end', ()=>this._onDragEnd());
    this.isDraggableApp = true;
    this.actor.label_actor = this.label;
    if (showIcon) {
      this.icon.realize();
    }
    this.label.realize();
  },

  get_app_id: function () {
    return this.app.get_id();
  },

  getDragActor: function () {
    let favorites = AppFavorites.getAppFavorites().getFavorites();
    let nbFavorites = favorites.length;
    let monitorHeight = Main.layoutManager.primaryMonitor.height;
    let real_size = (0.7 * monitorHeight) / nbFavorites;
    let icon_size = 0.6 * real_size / global.ui_scale;
    if (icon_size > MAX_FAV_ICON_SIZE) {
      icon_size = MAX_FAV_ICON_SIZE;
    }
    return this.app.create_icon_texture(icon_size);
  },

  // Returns the original actor that should align with the actor
  // we show as the item is being dragged.
  getDragActorSource: function () {
    return this.actor;
  },

  _onDragEnd: function () {
    this.appsMenuButton.favoritesBox._delegate._clearDragPlaceholder();
  }
};

function SearchProviderResultButton(appsMenuButton, provider, result) {
  this._init(appsMenuButton, provider, result);
}

SearchProviderResultButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (appsMenuButton, provider, result) {
    this.provider = provider;
    this.result = result;

    this.appsMenuButton = appsMenuButton;
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });
    this.actor.set_style_class_name('menu-application-button');

    // We need this fake app to help appEnterEvent/appLeaveEvent
    // work with our search result.
    this.app = {
      get_app_info: {
        get_filename: function () {
          return result.id;
        }
      },
      get_id: function () {
        return -1;
      },
      get_description: function () {
        return result.description;
      },
      get_name: function () {
        return result.label;
      }
    };

    this.icon = null;
    if (result.icon) {
      this.icon = result.icon;
    } else if (result.icon_app) {
      this.icon = result.icon_app.create_icon_texture(APPLICATION_ICON_SIZE);
    } else if (result.icon_filename) {
      this.icon = new St.Icon({
        gicon: new Gio.FileIcon({
          file: Gio.file_new_for_path(result.icon_filename)
        }),
        icon_size: APPLICATION_ICON_SIZE
      });
    }

    if (this.icon) {
      this.addActor(this.icon);
    }
    this.label = new St.Label({
      text: result.label,
      style_class: 'menu-application-button-label'
    });
    this.addActor(this.label);
    this.isDraggableApp = false;
    if (this.icon) {
      this.icon.realize();
    }
    this.label.realize();
  },

  _onButtonReleaseEvent: function (actor, event) {
    if (event.get_button() == 1) {
      this.activate(event);
    }
    return true;
  },

  activate: function (event) {
    try {
      this.provider.on_result_selected(this.result);
      this.appsMenuButton.menu.close();
    } catch (e) {
      global.logError(e);
    }
  }
}

function PlaceButton(appsMenuButton, place, button_name, showIcon) {
  this._init(appsMenuButton, place, button_name, showIcon);
}

PlaceButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (appsMenuButton, place, button_name, showIcon) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });
    this.appsMenuButton = appsMenuButton;
    this.place = place;
    this.button_name = button_name;
    this.actor.set_style_class_name('menu-application-button');
    this.actor._delegate = this;
    this.label = new St.Label({
      text: this.button_name,
      style_class: 'menu-application-button-label'
    });
    this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    this.label.set_style(MAX_BUTTON_WIDTH);
    if (showIcon) {
      this.icon = place.iconFactory(APPLICATION_ICON_SIZE);
      if (!this.icon) {
        this.icon = new St.Icon({
          icon_name: 'folder',
          icon_size: APPLICATION_ICON_SIZE,
          icon_type: St.IconType.FULLCOLOR
        });
      }
      if (this.icon) {
        this.addActor(this.icon);
      }
    }
    this.addActor(this.label);
    if (showIcon) {
      this.icon.realize();
    }
    this.label.realize();
  },

  _onButtonReleaseEvent: function (actor, event) {
    if (event.get_button() == 1) {
      this.place.launch();
      this.appsMenuButton.menu.close();
    }
  },

  activate: function (event) {
    this.place.launch();
    this.appsMenuButton.menu.close();
  }
};

function RecentContextMenuItem(recentButton, label, is_default, callback) {
  this._init(recentButton, label, is_default, callback);
}

RecentContextMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (recentButton, label, is_default, callback) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      focusOnHover: false
    });

    this._recentButton = recentButton;
    this._callback = callback;
    this.label = new St.Label({
      text: label
    });
    this.addActor(this.label);

    if (is_default) {
      this.label.style = 'font-weight: bold;';
    }
  },

  activate: function (event) {
    this._callback()
    return false;
  }
};

function RecentButton(appsMenuButton, file, showIcon) {
  this._init(appsMenuButton, file, showIcon);
}

RecentButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (appsMenuButton, file, showIcon) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });
    this.mimeType = file.mimeType;
    this.uri = file.uri;
    this.uriDecoded = file.uriDecoded;
    this.appsMenuButton = appsMenuButton;
    this.button_name = file.name;
    this.actor.set_style_class_name('menu-application-button');
    this.actor._delegate = this;
    this.label = new St.Label({
      text: this.button_name,
      style_class: 'menu-application-button-label'
    });
    this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    this.label.set_style(MAX_BUTTON_WIDTH);
    if (showIcon) {
      this.icon = file.createIcon(APPLICATION_ICON_SIZE);
      this.addActor(this.icon);
    }
    this.addActor(this.label);
    if (showIcon) {
      this.icon.realize();
    }
    this.label.realize();

    this.menu = new PopupMenu.PopupSubMenu(this.actor);
    this.menu.actor.set_style_class_name('menu-context-menu');
    this.menu.connect('open-state-changed', ()=>this._subMenuOpenStateChanged());
  },

  _onButtonReleaseEvent: function (actor, event) {
    if (event.get_button() == 1) {
      this.activate(event);
    }
    if (event.get_button() == 3) {
      this.activateContextMenus(event);
    }
    return true;
  },

  activate: function (event) {
    Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
    this.appsMenuButton.menu.close();
  },

  activateContextMenus: function (event) {
    let menu = this.appsMenuButton.recentContextMenu;
    if (menu !== null && menu.isOpen) {
      this.appsMenuButton.closeContextMenus(this, true);
    }
    this.toggleMenu();
  },

  closeMenu: function () {
    this.menu.close();
  },

  hasLocalPath: function (file) {
    return file.is_native() || file.get_path() !== null;
  },

  toggleMenu: function() {
    if (this.appsMenuButton.recentContextMenu === null) {
      let menu = new PopupMenu.PopupSubMenu(this.actor);
      menu.actor.set_style_class_name('menu-context-menu');
      menu.connect('open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
      this.appsMenuButton.recentContextMenu = menu;
    }

    let menu = this.appsMenuButton.recentContextMenu;

    if (!menu.isOpen) {
      let parent = menu.actor.get_parent();
      if (parent !== null) {
        parent.remove_child(menu.actor);
      }

      menu.sourceActor = this.actor;
      this.actor.get_parent().insert_child_above(menu.actor, this.actor);

      let children = menu.box.get_children();
      for (var i in children) {
        menu.box.remove_actor(children[i]);
      }

      let menuItem;

      menuItem = new PopupMenu.PopupMenuItem(_("Open with"), {
        reactive: false
      });
      menuItem.actor.style = "font-weight: bold";
      menu.addMenuItem(menuItem);

      let file = Gio.File.new_for_uri(this.uri);

      let default_info = Gio.AppInfo.get_default_for_type(this.mimeType, !this.hasLocalPath(file));

      if (default_info) {
        menuItem = new RecentContextMenuItem(this,
          default_info.get_display_name(),
          false,
          Lang.bind(this, function() {
            default_info.launch([file], null, null);
            this.toggleMenu();
            this.appsMenuButton.menu.close();
          }));
        menu.addMenuItem(menuItem);
      }

      let infos = Gio.AppInfo.get_all_for_type(this.mimeType)

      for (let i = 0; i < infos.length; i++) {
        let info = infos[i];

        file = Gio.File.new_for_uri(this.uri);

        if (!this.hasLocalPath(file) && !info.supports_uris()) {
          continue;
        }

        if (info.equal(default_info)) {
          continue;
        }

        menuItem = new RecentContextMenuItem(this,
          info.get_display_name(),
          false,
          Lang.bind(this, function() {
            info.launch([file], null, null);
            this.toggleMenu();
            this.appsMenuButton.menu.close();
          }));
        menu.addMenuItem(menuItem);
      }

      if (GLib.find_program_in_path("nemo-open-with") != null) {
        menuItem = new RecentContextMenuItem(this,
          _("Other application..."),
          false,
          Lang.bind(this, function() {
            Util.spawnCommandLine("nemo-open-with " + this.uri);
            this.toggleMenu();
            this.appsMenuButton.menu.close();
          }));
        menu.addMenuItem(menuItem);
      }
    }
    this.appsMenuButton.recentContextMenu.toggle();
  },

  _subMenuOpenStateChanged: function () {
    if (this.menu.isOpen) {
      this.appsMenuButton._activeContextMenuParent = this;
      this.appsMenuButton._scrollToButton(this.menu);
    } else {
      this.appsMenuButton._activeContextMenuItem = null;
      this.appsMenuButton._activeContextMenuParent = null;
    }
  },

  get _contextIsOpen() {
    return this.menu.isOpen;
  }
};

function GenericButton(label, icon, reactive, callback) {
  this._init(label, icon, reactive, callback);
}

GenericButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (label, icon, reactive, callback) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });
    this.actor.set_style_class_name('menu-application-button');
    this.actor._delegate = this;
    this.button_name = '';

    this.label = new St.Label({
      text: label,
      style_class: 'menu-application-button-label'
    });
    this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    this.label.set_style(MAX_BUTTON_WIDTH);

    if (icon !== null) {
      let icon_actor = new St.Icon({
        icon_name: icon,
        icon_type: St.IconType.FULLCOLOR,
        icon_size: APPLICATION_ICON_SIZE
      });
      this.addActor(icon_actor);
    }

    this.addActor(this.label);
    this.label.realize();

    this.actor.reactive = reactive;
    this.callback = callback;

    this.menu = new PopupMenu.PopupSubMenu(this.actor);
  },

  _onButtonReleaseEvent: function (actor, event) {
    if (event.get_button() == 1) {
      this.callback();
    }
  }
}

function RecentClearButton(appsMenuButton) {
  this._init(appsMenuButton);
}

RecentClearButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (appsMenuButton) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });
    this.appsMenuButton = appsMenuButton;
    this.actor.set_style_class_name('menu-application-button');
    this.button_name = _('Clear list');
    this.actor._delegate = this;
    this.label = new St.Label({
      text: this.button_name,
      style_class: 'menu-application-button-label'
    });
    this.icon = new St.Icon({
      icon_name: 'edit-clear',
      icon_type: St.IconType.SYMBOLIC,
      icon_size: APPLICATION_ICON_SIZE
    });
    this.addActor(this.icon);
    this.addActor(this.label);

    this.menu = new PopupMenu.PopupSubMenu(this.actor);
  },

  _onButtonReleaseEvent: function (actor, event) {
    if (event.get_button() == 1) {
      this.activate(event);
    }
  },

  activate: function (event) {
    this.appsMenuButton.menu.close();
    let GtkRecent = new Gtk.RecentManager();
    GtkRecent.purge_items();
  }
};

function NoRecentDocsButton() {
  this._init();
}

NoRecentDocsButton.prototype = {
  __proto__: GenericButton.prototype,

  _init: function () {
    GenericButton.prototype._init.call(this, _('No recent documents'), null, false, null);
  }
};

function CategoryButton(app, showIcon) {
  this._init(app, showIcon);
}

CategoryButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (category, showIcon) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });

    this.actor.set_style_class_name('menu-category-button');
    var label;
    let icon = null;
    if (category) {
      if (showIcon) {
        icon = category.get_icon();
        if (icon && icon.get_names) {
          this.icon_name = icon.get_names().toString();
        } else {
          this.icon_name = '';
        }
      } else {
        this.icon_name = '';
      }
      label = category.get_name();
    } else {
      label = _('All Applications');
    }

    this.actor._delegate = this;
    this.label = new St.Label({
      text: label,
      style_class: 'menu-category-button-label'
    });
    if (category && this.icon_name) {
      this.icon = St.TextureCache.get_default().load_gicon(null, icon, CATEGORY_ICON_SIZE);
      if (this.icon) {
        this.addActor(this.icon);
        this.icon.realize();
      }
    }
    this.actor.accessible_role = Atk.Role.LIST_ITEM;
    this.addActor(this.label);
    this.label.realize();
  }
};

function PlaceCategoryButton(app, showIcon) {
  this._init(app, showIcon);
}

PlaceCategoryButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (category, showIcon) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });
    this.actor.set_style_class_name('menu-category-button');
    this.actor._delegate = this;
    this.label = new St.Label({
      text: _('Places'),
      style_class: 'menu-category-button-label'
    });
    if (showIcon) {
      this.icon = new St.Icon({
        icon_name: 'folder',
        icon_size: CATEGORY_ICON_SIZE,
        icon_type: St.IconType.FULLCOLOR
      });
      this.addActor(this.icon);
      this.icon.realize();
    } else {
      this.icon = null;
    }
    this.addActor(this.label);
    this.label.realize();
  }
};

function RecentCategoryButton(app, showIcon) {
  this._init(app, showIcon);
}

RecentCategoryButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (category, showIcon) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });
    this.actor.set_style_class_name('menu-category-button');
    this.actor._delegate = this;
    this.label = new St.Label({
      text: _('Recent Files'),
      style_class: 'menu-category-button-label'
    });
    if (showIcon) {
      this.icon = new St.Icon({
        icon_name: 'folder-recent',
        icon_size: CATEGORY_ICON_SIZE,
        icon_type: St.IconType.FULLCOLOR
      });
      this.addActor(this.icon);
      this.icon.realize()
    } else {
      this.icon = null;
    }
    this.addActor(this.label);
    this.label.realize();
  }
};

function FavoritesButton(appsMenuButton, app, nbFavorites) {
  this._init(appsMenuButton, app, nbFavorites);
}

FavoritesButton.prototype = {
  __proto__: GenericApplicationButton.prototype,

  _init: function (appsMenuButton, app, nbFavorites) {
    GenericApplicationButton.prototype._init.call(this, appsMenuButton, app);
    let monitorHeight = Main.layoutManager.primaryMonitor.height;
    let real_size = (0.7 * monitorHeight) / nbFavorites;
    let icon_size = 0.6 * real_size / global.ui_scale;
    if (icon_size > MAX_FAV_ICON_SIZE) {
      icon_size = MAX_FAV_ICON_SIZE;
    }
    this.actor.style = 'padding-top: ' + (icon_size / 3) + 'px;padding-bottom: ' + (icon_size / 3) + 'px; margin:auto;'

    this.actor.add_style_class_name('menu-favorites-button');
    let icon = app.create_icon_texture(icon_size);

    this.addActor(icon);
    icon.realize();

    this._draggable = DND.makeDraggable(this.actor);
    this._draggable.connect('drag-end', ()=>this._onDragEnd());
    this.isDraggableApp = true;
  },

  _onDragEnd: function () {
    this.actor.get_parent()._delegate._clearDragPlaceholder();
  },

  get_app_id: function () {
    return this.app.get_id();
  },

  getDragActor: function () {
    return new Clutter.Clone({
      source: this.actor
    });
  },

  // Returns the original actor that should align with the actor
  // we show as the item is being dragged.
  getDragActorSource: function () {
    return this.actor;
  }
};

function SystemButton(appsMenuButton, icon, nbFavorites, name, desc) {
  this._init(appsMenuButton, icon, nbFavorites, name, desc);
}

SystemButton.prototype = {
  __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

  _init: function (appsMenuButton, icon, nbFavorites, name, desc) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });

    this.name = name;
    this.desc = desc;

    let monitorHeight = Main.layoutManager.primaryMonitor.height;
    let real_size = (0.7 * monitorHeight) / nbFavorites;
    let icon_size = 0.6 * real_size / global.ui_scale;
    if (icon_size > MAX_FAV_ICON_SIZE) {
      icon_size = MAX_FAV_ICON_SIZE;
    }
    this.actor.style = 'padding-top: ' + (icon_size / 3) + 'px;padding-bottom: ' + (icon_size / 3) + 'px; margin:auto;'
    this.actor.add_style_class_name('menu-favorites-button');

    let iconObj = new St.Icon({
      icon_name: icon,
      icon_size: icon_size,
      icon_type: St.IconType.FULLCOLOR
    });
    this.addActor(iconObj);
    iconObj.realize()
  },

  _onButtonReleaseEvent: function (actor, event) {
    if (event.get_button() == 1) {
      this.activate();
    }
  }
};

function CategoriesApplicationsBox() {
  this._init();
}

CategoriesApplicationsBox.prototype = {
  _init: function () {
    this.actor = new St.BoxLayout();
    this.actor._delegate = this;
  },

  acceptDrop: function (source, actor, x, y, time) {
    if (source instanceof FavoritesButton) {
      source.actor.destroy();
      actor.destroy();
      AppFavorites.getAppFavorites().removeFavorite(source.app.get_id());
      return true;
    }
    return false;
  }
}

function FavoritesBox() {
  this._init();
}

FavoritesBox.prototype = {
  _init: function () {
    this.actor = new St.BoxLayout({
      vertical: true
    });
    this.actor._delegate = this;

    this._dragPlaceholder = null;
    this._dragPlaceholderPos = -1;
    this._animatingPlaceholdersCount = 0;
  },

  _clearDragPlaceholder: function () {
    if (this._dragPlaceholder) {
      this._dragPlaceholder.animateOutAndDestroy();
      this._dragPlaceholder = null;
      this._dragPlaceholderPos = -1;
    }
  },

  handleDragOver: function (source, actor, x, y, time) {
    let app = source.app;

    let favorites = AppFavorites.getAppFavorites().getFavorites();
    let numFavorites = favorites.length;

    let favPos = favorites.indexOf(app);

    let children = this.actor.get_children();
    let numChildren = children.length;
    let boxHeight = this.actor.height;

    // Keep the placeholder out of the index calculation; assuming that
    // the remove target has the same size as 'normal' items, we don't
    // need to do the same adjustment there.
    if (this._dragPlaceholder) {
      boxHeight -= this._dragPlaceholder.actor.height;
      numChildren--;
    }

    let pos = Math.round(y * numChildren / boxHeight);

    if (pos != this._dragPlaceholderPos && pos <= numFavorites) {
      if (this._animatingPlaceholdersCount > 0) {
        let appChildren = children.filter(function (actor) {
          return (actor._delegate instanceof FavoritesButton);
        });
        this._dragPlaceholderPos = children.indexOf(appChildren[pos]);
      } else {
        this._dragPlaceholderPos = pos;
      }

      // Don't allow positioning before or after self
      if (favPos != -1 && (pos == favPos || pos == favPos + 1)) {
        if (this._dragPlaceholder) {
          this._dragPlaceholder.animateOutAndDestroy();
          this._animatingPlaceholdersCount++;
          this._dragPlaceholder.actor.connect('destroy', ()=>{
            this._animatingPlaceholdersCount--;
          });
        }
        this._dragPlaceholder = null;

        return DND.DragMotionResult.CONTINUE;
      }

      // If the placeholder already exists, we just move
      // it, but if we are adding it, expand its size in
      // an animation
      let fadeIn;
      if (this._dragPlaceholder) {
        this._dragPlaceholder.actor.destroy();
        fadeIn = false;
      } else {
        fadeIn = true;
      }

      this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
      this._dragPlaceholder.child.set_width(source.actor.height);
      this._dragPlaceholder.child.set_height(source.actor.height);
      this.actor.insert_child_at_index(this._dragPlaceholder.actor,
        this._dragPlaceholderPos);
      if (fadeIn) {
        this._dragPlaceholder.animateIn();
      }
    }

    return DND.DragMotionResult.MOVE_DROP;
  },

  // Draggable target interface
  acceptDrop: function (source, actor, x, y, time) {
    let app = source.app;

    let id = app.get_id();

    let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

    let srcIsFavorite = (id in favorites);

    let favPos = 0;
    let children = this.actor.get_children();
    for (let i = 0, len = this._dragPlaceholderPos.length; i < len; i++) {
      if (this._dragPlaceholder &&
        children[i] == this._dragPlaceholder.actor) {
        continue;
      }

      if (!(children[i]._delegate instanceof FavoritesButton)) {
        continue;
      }

      let childId = children[i]._delegate.app.get_id();
      if (childId == id) {
        continue;
      }
      if (childId in favorites) {
        favPos++;
      }
    }

    Meta.later_add(Meta.LaterType.BEFORE_REDRAW, ()=>{
      let appFavorites = AppFavorites.getAppFavorites();
      if (srcIsFavorite) {
        appFavorites.moveFavoriteToPos(id, favPos);
      } else {
        appFavorites.addFavoriteAtPos(id, favPos);
      }
      return false;
    });

    return true;
  }
}