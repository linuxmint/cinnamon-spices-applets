/* ========================================================================================================
 * applet.js - Cinnamenu extension
 * --------------------------------------------------------------------------------------------------------
 *  CREDITS: 
 *  Forked from Gnomenu by The Panacea Projects - https://github.com/The-Panacea-Projects/Gnomenu.
 *  Ported to Cinnamon by Jason Hicks.
 *  A large part of this code was copied from the Mint menu and Axe menu extensions. Many thanks
 *  to those developers for their great extensions and laying the foundation for Cinnamenu.
 *
 *  Some parts of this code also come from:
 *  gnome-shell-extensions -  http://git.gnome.org/browse/gnome-shell-extensions/
 *  places status indicator extension - http://git.gnome.org/gnome-shell-extensions
 *  recent items extension - http://www.bananenfisch.net/gnome
 *  applications menu extension - https://extensions.gnome.org/extension/6/applications-menu/
 *  search bookmarks extension - https://extensions.gnome.org/extension/557/search-bookmarks/
 * ========================================================================================================
 */
const Main = imports.ui.main;
const IconTheme = imports.gi.Gtk.IconTheme;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const CMenu = imports.gi.CMenu;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Signals = imports.signals;
const Params = imports.misc.params;
const Config = imports.misc.config;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const AppFavorites = imports.ui.appFavorites;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
//const DND = imports.ui.dnd;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;

const AppletDir = imports.ui.appletManager.applets['Cinnamenu@json'];
const kmp = AppletDir.kmp.kmp;

const Chromium = AppletDir.webChromium;
const Firefox = AppletDir.webFirefox;
const GoogleChrome = AppletDir.webGoogleChrome;
const Midori = AppletDir.webMidori;
const Opera = AppletDir.webOpera;

const Gettext = imports.gettext.domain('Cinnamenu@json');
const _ = Gettext.gettext;

const PlaceDisplay = AppletDir.placeDisplay;

const PREFS_DIALOG = 'cinnamon-settings applets Cinnamenu@json';
const PRIVACY_SCHEMA = 'org.cinnamon.desktop.privacy';
const REMEMBER_RECENT_KEY = 'remember-recent-files';

const ShortcutsDisplay = {
  FAVORITES: 0,
  PLACES: 1
};

const SelectMethod = {
  HOVER: 0,
  CLICK: 1
};

const ApplicationType = {
  APPLICATION: 0,
  PLACE: 1,
  RECENT: 2
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

  bookmarksSort: function(a, b) {
    if (a.score < b.score) {
      return 1;
    }
    if (a.score > b.score) {
      return -1;
    }
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    }
    return 0;
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

  _init: function(dir, altNameText, altIconName) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });
    this.buttonEnterCallback = null;
    this.buttonLeaveCallback = null;
    this.buttonPressCallback = null;
    this.buttonReleaseCallback = null;
    this._ignoreHoverSelect = null;

    this.actor.set_style_class_name('menu-category-button');
    if (dir === 'recent' || dir === 'bookmarks' || dir === 'places') { // TBD
      //this.actor.set_style('padding-bottom: -5px');
    }
    this.actor._delegate = this;
    let iconSize = 16;

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

/* =========================================================================
/* name:    ShortcutButton
 * @desc    A button with an icon that holds app info
 * ========================================================================= */

function ShortcutButton() {
  this._init.apply(this, arguments);
}

ShortcutButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function(_parent, app, appType) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false
    });
    this._applet = _parent._applet;
    this._app = app;
    this._type = appType;
    this.actor.set_style_class_name('menu-favorites-button');
    this.actor._delegate = this;
    this._iconSize = (this._applet.shortcutsIconSize > 0) ? this._applet.shortcutsIconSize : 16;

    // appType 0 = application, appType 1 = place, appType 2 = recent
    if (appType == ApplicationType.APPLICATION) {
      this.icon = app.create_icon_texture(this._iconSize);
      this.label = new St.Label({
        text: app.get_name(),
        style_class: 'menu-application-button-label'
      });
    } else if (appType == ApplicationType.PLACE) {
      // Adjust 'places' symbolic icons by reducing their size
      // and setting a special class for button padding
      this._iconSize -= 4;
      this.actor.add_style_class_name('menu-places-button');
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
    } else if (appType == ApplicationType.RECENT) {
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
    this.addActor(this.icon);
    if (this._applet.shortcutsLabel) {
      this.addActor(this.label);
    }

    // Connect signals
    this.actor.connect('touch-event', Lang.bind(this, this._onTouchEvent));

    // Connect drag-n-drop signals
    /*this._draggable = DND.makeDraggable(this.actor);
    this._draggable.connect('drag-begin', Lang.bind(this,
      function() {
        //this._removeMenuTimeout();
        Main.overview.beginItemDrag(this);
        if (this._parent) {
          if (this._parent._categoryWorkspaceMode == CategoryWorkspaceMode.CATEGORY) {
            this._parent.toggleCategoryWorkspaceMode();
          }
        }
      }));
    this._draggable.connect('drag-cancelled', Lang.bind(this,
      function() {
        Main.overview.cancelledItemDrag(this);
      }));
    this._draggable.connect('drag-end', Lang.bind(this,
      function() {
        Main.overview.endItemDrag(this);
      }));*/
  },

  _onTouchEvent: function(actor, event) {
    return Clutter.EVENT_PROPAGATE;
  },

  getDragActor: function() {
    let appIcon;
    if (this._type == ApplicationType.APPLICATION) {
      appIcon = this._app.create_icon_texture(this._iconSize);
    } else if (this._type == ApplicationType.PLACE) {
      appIcon = new St.Icon({
        gicon: this._app.icon,
        icon_size: this._iconSize
      });
    } else if (this._type == ApplicationType.RECENT) {
      let gicon = Gio.content_type_get_icon(this._app.mime);
      appIcon = new St.Icon({
        gicon: gicon,
        icon_size: this._iconSize
      });
    }
    return appIcon;
  },

  // Returns the original actor that should align with the actor
  // we show as the item is being dragged.
  getDragActorSource: function() {
    return this.icon;
  },

  shellWorkspaceLaunch: function(params) {
    params = Params.parse(params, {
      workspace: -1,
      timestamp: 0
    });

    if (this._type == ApplicationType.APPLICATION) {
      this._app.open_new_window(params.workspace);
    } else if (this._type == ApplicationType.PLACE) {
      if (this._app.uri) {
        this._app.app.launch_uris([this._app.uri], null);
      } else {
        this._app.launch();
      }
    } else if (this._type == ApplicationType.RECENT) {
      Gio.app_info_launch_default_for_uri(this._app.uri, global.create_app_launch_context(0, -1));
    }

    this.actor.remove_style_pseudo_class('pressed');
    this.actor.remove_style_class_name('selected');

    if (this._parent.appsMenuButton) {
      if (this._parent.menu.isOpen) {
        this._parent.menu.toggle();
      }
    }
  }
};


/* =========================================================================
/* name:    AppListButton
 * @desc    A button with an icon and label that holds app info for various
 * @desc    types of sources (application, places, recent)
 * ========================================================================= */

function AppListButton() {
  this._init.apply(this, arguments);
}

AppListButton.prototype = {

  _init: function(_parent, app, appType) {
    this._parent = _parent;
    this._applet = _parent._applet;
    this._app = app;
    this._type = appType;
    this._stateChangedId = 0;
    let style = 'menu-application-button';
    this.actor = new St.Button({
      reactive: true,
      style_class: style,
      x_align: St.Align.START,
      y_align: St.Align.MIDDLE
    });
    this.actor._delegate = this;
    this._iconSize = (this._applet.appsListIconSize > 0) ? this._applet.appsListIconSize : 28;

    // appType 0 = application, appType 1 = place, appType 2 = recent
    if (appType == ApplicationType.APPLICATION) {
      this.icon = app.create_icon_texture(this._iconSize);
      this.label = new St.Label({
        text: app.get_name(),
        style_class: 'menu-application-button-label'
      });
    } else if (appType == ApplicationType.PLACE) {
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
    } else if (appType == ApplicationType.RECENT) {
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
      style: 'width: 10px; height: 3px; background-color: #FFFFFF; margin-bottom: 2px;',
      layout_manager: new Clutter.BinLayout(),
      x_expand: true,
      y_expand: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.END
    });

    this._iconContainer = new St.BoxLayout({
      vertical: true
    });
    this._iconContainer.add_style_class_name('menu-application-list-button');

    this._iconContainer.add(this.icon, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.END,
      y_align: St.Align.END
    });
    this._iconContainer.add(this._dot, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.END,
      y_align: St.Align.END
    });

    this.buttonbox = new St.BoxLayout();
    this.buttonbox.add(this._iconContainer, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.MIDDLE
    });
    this.buttonbox.add(this.label, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.MIDDLE
    });

    this.actor.set_child(this.buttonbox);

    // Connect signals
    this.actor.connect('touch-event', Lang.bind(this, this._onTouchEvent));
    if (appType == ApplicationType.APPLICATION) {
      this._stateChangedId = this._app.connect('notify::state', Lang.bind(this, this._onStateChanged));
    }

    // Connect drag-n-drop signals
    /*this._draggable = DND.makeDraggable(this.actor);
    this._draggable.connect('drag-begin', Lang.bind(this,
      function() {
        //this._removeMenuTimeout();
        Main.overview.beginItemDrag(this);
        if (this._parent) {
          if (this._parent._categoryWorkspaceMode == CategoryWorkspaceMode.CATEGORY) {
            this._parent.toggleCategoryWorkspaceMode();
          }
        }
      }));
    this._draggable.connect('drag-cancelled', Lang.bind(this,
      function() {
        Main.overview.cancelledItemDrag(this);
      }));
    this._draggable.connect('drag-end', Lang.bind(this,
      function() {
        Main.overview.endItemDrag(this);
      }));*/

    // Check if running state
    this._dot.opacity = 0;
    this._onStateChanged();
  },

  _onTouchEvent: function(actor, event) {
    return Clutter.EVENT_PROPAGATE;
  },

  _onStateChanged: function() {
    if (this._type == ApplicationType.APPLICATION) {
      if (this._app.state != Cinnamon.AppState.STOPPED) {
        this._dot.opacity = 255;
      } else {
        this._dot.opacity = 0;
      }
    }
  },

  getDragActor: function() {
    let appIcon;
    if (this._type == ApplicationType.APPLICATION) {
      appIcon = this._app.create_icon_texture(this._iconSize);
    } else if (this._type == ApplicationType.PLACE) {
      appIcon = new St.Icon({
        gicon: this._app.icon,
        icon_size: this._iconSize
      });
    } else if (this._type == ApplicationType.RECENT) {
      let gicon = Gio.content_type_get_icon(this._app.mime);
      appIcon = new St.Icon({
        gicon: gicon,
        icon_size: this._iconSize
      });
    }
    return appIcon;
  },

  // Returns the original actor that should align with the actor
  // we show as the item is being dragged.
  getDragActorSource: function() {
    return this.icon;
  },

  shellWorkspaceLaunch: function(params) {
    params = Params.parse(params, {
      workspace: -1,
      timestamp: 0
    });

    if (this._type == ApplicationType.APPLICATION) {
      this._app.open_new_window(params.workspace);
    } else if (this._type == ApplicationType.PLACE) {
      if (this._app.uri) {
        this._app.app.launch_uris([this._app.uri], null);
      } else {
        this._app.launch();
      }
    } else if (this._type == ApplicationType.RECENT) {
      Gio.app_info_launch_default_for_uri(this._app.uri, global.create_app_launch_context(0, -1));
    }

    this.actor.remove_style_pseudo_class('pressed');
    this.actor.remove_style_class_name('selected');

    if (this._parent) {
      if (this._parent.menu.isOpen) {
        this._parent.menu.toggle();
      }
    }
  }
};
Signals.addSignalMethods(AppListButton.prototype);


/* =========================================================================
/* name:    AppGridButton
 * @desc    A button with an icon and label that holds app info for various
 * @desc    types of sources (application, places, recent)
 * ========================================================================= */

function AppGridButton() {
  this._init.apply(this, arguments);
}

AppGridButton.prototype = {
  _init: function(_parent, app, appType, includeText) {
    this._applet = _parent._applet
    this._app = app;
    this._type = appType;
    this._stateChangedId = 0;
    let styleButton = 'popup-menu-item menu-application-button';

    let styleLabel = 'menu-application-button-label';
    if (this._applet.appsGridColumnCount == 3) {
      styleButton += ' col3';
    } else if (this._applet.appsGridColumnCount == 4) {
      styleButton += ' col4';
    } else if (this._applet.appsGridColumnCount == 5) {
      styleButton += ' col5';
    } else if (this._applet.appsGridColumnCount == 6) {
      styleButton += ' col6';
    } else if (this._applet.appsGridColumnCount == 7) {
      styleButton += ' col7';
    }
    if (this._applet.hideCategories) {
      styleButton += ' no-categories';
      styleLabel += ' no-categories';
    }

    this.actor = new St.Button({
      reactive: true,
      style_class: styleButton,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this.actor._delegate = this;
    this._iconSize = (this._applet.appsGridIconSize > 0) ? this._applet.appsGridIconSize : 64;

    // appType 0 = application, appType 1 = place, appType 2 = recent
    if (appType == ApplicationType.APPLICATION) {
      this.icon = app.create_icon_texture(this._iconSize);
      this.label = new St.Label({
        text: app.get_name(),
        style_class: styleLabel
      });
    } else if (appType == ApplicationType.PLACE) {
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
        style_class: styleLabel
      });
    } else if (appType == ApplicationType.RECENT) {
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
        style_class: styleLabel
      });
    }

    this._dot = new St.Widget({
      style: 'width: 10px; height: 3px; background-color: #FFFFFF; margin-bottom: 2px;',
      layout_manager: new Clutter.BinLayout(),
      x_expand: true,
      y_expand: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.END
    });

    this.buttonbox = new St.BoxLayout({
      vertical: true
    });
    this.buttonbox.add(this.icon, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.START
    });
    if (includeText) {
      // Use pango to wrap label text
      //this.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD;
      //this.label.clutter_text.line_wrap = true;
      this.buttonbox.add(this.label, {
        x_fill: false,
        y_fill: true,
        x_align: St.Align.MIDDLE,
        y_align: St.Align.MIDDLE
      });
    }
    this.buttonbox.add(this._dot, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.START
    });
    this.actor.set_child(this.buttonbox);

    // Connect signals
    this.actor.connect('touch-event', Lang.bind(this, this._onTouchEvent));
    if (appType == ApplicationType.APPLICATION) {
      this._stateChangedId = this._app.connect('notify::state', Lang.bind(this, this._onStateChanged));
    }

    // Connect drag-n-drop signals
    /*this._draggable = DND.makeDraggable(this.actor);
    this._draggable.connect('drag-begin', Lang.bind(this,
      function() {
        //this._removeMenuTimeout();
        Main.overview.beginItemDrag(this);
        if (this._parent) {
          if (this._parent._categoryWorkspaceMode == CategoryWorkspaceMode.CATEGORY) {
            this._parent.toggleCategoryWorkspaceMode();
          }
        }
      }));
    this._draggable.connect('drag-cancelled', Lang.bind(this,
      function() {
        Main.overview.cancelledItemDrag(this);
      }));
    this._draggable.connect('drag-end', Lang.bind(this,
      function() {
        Main.overview.endItemDrag(this);
      }));*/

    // Check if running state
    this._dot.opacity = 0;
    this._onStateChanged();
  },

  _onTouchEvent: function(actor, event) {
    return Clutter.EVENT_PROPAGATE;
  },

  _onStateChanged: function() {
    if (this._type == ApplicationType.APPLICATION) {
      if (this._app.state != Cinnamon.AppState.STOPPED) {
        this._dot.opacity = 255;
      } else {
        this._dot.opacity = 0;
      }
    }
  },

  getDragActor: function() {
    let appIcon;
    if (this._type == ApplicationType.APPLICATION) {
      appIcon = this._app.create_icon_texture(this._iconSize);
    } else if (this._type == ApplicationType.PLACE) {
      appIcon = new St.Icon({
        gicon: this._app.icon,
        icon_size: this._iconSize
      });
    } else if (this._type == ApplicationType.RECENT) {
      let gicon = Gio.content_type_get_icon(this._app.mime);
      appIcon = new St.Icon({
        gicon: gicon,
        icon_size: this._iconSize
      });
    }
    return appIcon;
  },

  // Returns the original actor that should align with the actor
  // we show as the item is being dragged.
  getDragActorSource: function() {
    return this.icon;
  },

  shellWorkspaceLaunch: function(params) {
    params = Params.parse(params, {
      workspace: -1,
      timestamp: 0
    });

    if (this._type == ApplicationType.APPLICATION) {
      this._app.open_new_window(params.workspace);
    } else if (this._type == ApplicationType.PLACE) {
      if (this._app.uri) {
        this._app.app.launch_uris([this._app.uri], null);
      } else {
        this._app.launch();
      }
    } else if (this._type == ApplicationType.RECENT) {
      Gio.app_info_launch_default_for_uri(this._app.uri, global.create_app_launch_context(0, -1));
    }

    this.actor.remove_style_pseudo_class('pressed');
    this.actor.remove_style_class_name('selected');

    if (this._parent) {
      if (this._parent.menu.isOpen) {
        this._parent.menu.toggle();
      }
    }
  }
};
Signals.addSignalMethods(AppGridButton.prototype);


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
    /*let style = 'popup-menu-item popup-submenu-menu-item' + params.style_class;
    let paddingTop = labelText ? 2 : iconSize >= 18 ? 5 : 2;*/
    //this.actor.add_style_class_name('menu-favorites-button');
    //this.actor.add_style_class_name(params.style_class);
    let monitorHeight = Main.layoutManager.primaryMonitor.height;
    let realSize = (0.7 * monitorHeight) / 4;
    let adjustedIconSize = 0.6 * realSize / global.ui_scale;
    if (adjustedIconSize > iconSize) {
      adjustedIconSize = iconSize;
    }
    this.actor.style = 'padding-top: ' + (adjustedIconSize / 3) + 'px;padding-bottom: ' + (adjustedIconSize / 3) + 'px; margin:auto;'
    this.actor.add_style_class_name('menu-favorites-button');
    this.actor._delegate = this;
    this.buttonbox = new St.BoxLayout({
      vertical: true
    });

    if (iconName && iconSize) {
      this._iconSize = adjustedIconSize;
      this.icon = new St.Icon({
        icon_name: iconName,
        icon_size: adjustedIconSize,
        icon_type: adjustedIconSize <= 25 ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR
      });
      this.addActor(this.icon);
      this.icon.realize();
      /*this.buttonbox.add(this.icon, {
        x_fill: false,
        y_fill: false,
        x_align: St.Align.MIDDLE,
        y_align: St.Align.MIDDLE
      });*/
    }
    if (labelText) {
      this.label = new St.Label({
        text: labelText,
        style_class: params.style_class + '-label'
      });
      this.addActor(this.label);
      /*this.buttonbox.add(this.label, {
        x_fill: false,
        y_fill: false,
        x_align: St.Align.MIDDLE,
        y_align: St.Align.MIDDLE
      });*/
    }
    //this.actor.set_child(this.buttonbox);

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
  }
};


/* =========================================================================
/* name:    PanelMenuButton
 * @desc    A top panel button the toggles a popup menu
 * @impl    Used for menu button on top panel
 * ========================================================================= */

function PanelMenuButton() {
  this._init.apply(this, arguments)
}

PanelMenuButton.prototype = {
  __proto__: PanelMenu.Button.prototype,

  _init: function(applet) {
    this.launcher = {};
    PanelMenu.Button.prototype._init.call(this, applet.orientation)

    this._applet = applet;
    this.orientation = applet.orientation;
    this.menu = applet.menu

    this.actor.add_style_class_name('panel-status-button');

    let manager;
    if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
      manager = new Clutter.BoxLayout({
        orientation: Clutter.Orientation.HORIZONTAL
      });
    } else {
      manager = new Clutter.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL
      });
      this.actor.add_style_class_name('vertical');
      this._applet.actor.add_style_class_name('vertical');
    }

    this.manager = manager;

    this._bin = new Clutter.Actor({
      layout_manager: manager
    })
    this._box = new St.BoxLayout({
      style_class: 'cinnamenu-panel-menu-button'
    });

    this._bin.add_child(this._box);
    this.actor.add_actor(this._bin);

    this.launcher.actor = this.actor;

    this.panelEditId = global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed))

    this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateToggled));

    this.applicationsByCategory = {};
    this.favorites = [];
    this.frequentApps = [];
    this._applications = [];
    this._places = [];
    this._recent = [];

    this._applicationsViewMode = this._applet.startupViewMode;
    this._appGridColumns = this._applet.appsGridColumnCount;
    this._appGridButtonWidth = this._applet.appsGridLabelWidth;
    this._hoverTimeoutId = 0;
    this._searchTimeoutId = 0;
    this._searchIconClickedId = 0;
    this._selectedItemIndex = null;
    this._previousSelectedItemIndex = null;
    this._activeContainer = null;

    this._searchWebBookmarks = new SearchWebBookmarks();
    this._searchWebErrorsShown = false;
    this._session = new GnomeSession.SessionManager();
    this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
    this.recentManager = Gtk.RecentManager.get_default();
    this.placesManager = null;
    this._display();
  },

  destroy: function() {
    global.settings.disconnect(this.panelEditId)
    PanelMenu.Button.prototype.destroy.call(this)
    this._searchWebBookmarks.destroy();
  },

  on_panel_edit_mode_changed: function() {
    this.actor.reactive = !global.settings.get_boolean('panel-edit-mode')
  },

  // handler for when PanelMenuButton hotspot leave event
  _onHotSpotExited: function() {
    if (this._hoverTimeoutId > 0) {
      Mainloop.source_remove(this._hoverTimeoutId);
    }
  },

  _onOpenStateToggled: function(menu, open) {
    if (global.settings.get_boolean('panel-edit-mode')) {
      return false;
    }
    if (this._applet._appletEnterEventId > 0) {
      this._applet.actor.handler_block(this._applet._appletEnterEventId);
    }
    if (open) {
      // Set focus to search entry
      global.stage.set_key_focus(this.searchEntry);

      this._menuToggleTimeoutId = Mainloop.timeout_add(100, Lang.bind(this, this.resetSearchWithFocus));

      // Load Startup Applications category
      this._selectedItemIndex = null;
      this._activeContainer = null;
      this._applications = [];
      this._places = [];
      this._recent = [];
      this._applicationsViewMode = this._applet.startupViewMode;
      this._appGridColumns = this._applet.appsGridColumnCount;

      // Set height (we also set constraints on scrollboxes
      // Why does height need to be set when already set constraints? because of issue noted below
      // ISSUE: If height isn't set, then popup menu height will expand when application buttons are added
      let height = this.groupCategoriesWorkspacesScrollBox.height;
      this.applicationsScrollBox.height = height;
      this.shortcutsScrollBox.height = height;

      // Set height of viewModeBox to searchBox
      this.viewModeBox.height = this.searchBox.height;
      this._setButtonHeight(this.toggleListGridView.actor, this.searchBox.height);

      // Set Category
      this.categoriesBox.show();
      this._widthCategoriesBox = 0;
      this._widthShortcutsBox = 0;

      // Adjust width of categories box and thumbnails box depending on if shortcuts are shown
      // Determine width based on user-power group button widths
      if (this._applet.hideShortcuts) {
        this._widthShortcutsBox = 0;
        if (this._applet.hideCategories) {
          let categoryWidth = 0;
          this.groupCategoriesWorkspacesScrollBox.width = categoryWidth;
          this.categoriesBox.width = categoryWidth;
          this._widthCategoriesBox = categoryWidth;
        } else {
          if (this.powerGroupBox.width > this.groupCategoriesWorkspacesScrollBox.width) {
            let categoryWidth = this.powerGroupBox.width;
            this.groupCategoriesWorkspacesScrollBox.width = categoryWidth;
            this.categoriesBox.width = categoryWidth;
            this._widthCategoriesBox = categoryWidth;
          } else {
            let groupWidth = this.groupCategoriesWorkspacesScrollBox.width;
            this.categoriesBox.width = groupWidth;
            this._widthCategoriesBox = groupWidth;
          }
        }
      } else {
        this._widthShortcutsBox = this.shortcutsScrollBox.width;
        if (this._applet.hideCategories) {
          let categoryWidth = 0;
          this.groupCategoriesWorkspacesScrollBox.width = categoryWidth;
          this.categoriesBox.width = categoryWidth;
          this._widthCategoriesBox = categoryWidth;
        } else {
          if (this.powerGroupBox.width > (this.groupCategoriesWorkspacesScrollBox.width + this.shortcutsScrollBox.width)) {
            let categoryWidth = this.powerGroupBox.width - this.shortcutsScrollBox.width;
            this.groupCategoriesWorkspacesScrollBox.width = categoryWidth;
            this.categoriesBox.width = categoryWidth;
            this._widthCategoriesBox = categoryWidth;
          } else {
            let groupWidth = this.groupCategoriesWorkspacesScrollBox.width + this.shortcutsScrollBox.width;
            this.powerGroupBox.width = groupWidth;
            this.categoriesBox.width = this.groupCategoriesWorkspacesScrollBox.width;
            this._widthCategoriesBox = this.groupCategoriesWorkspacesScrollBox.width;
          }
        }
      }

      // calculate applications list/grid box width
      this._calculateApplicationsBoxWidth(this._applicationsViewMode === ApplicationsViewMode.LIST);
      this._adjustThemeForCompatibility();

      // Hide applications list/grid box depending on view mode
      if (this._applicationsViewMode === ApplicationsViewMode.LIST) {
        this.toggleListGridView.setIcon('view-grid-symbolic');
        this._switchApplicationsView(ApplicationsViewMode.LIST);
      } else {
        this.toggleListGridView.setIcon('view-list-symbolic');
        this._switchApplicationsView(ApplicationsViewMode.GRID);
      }

      // Display startup apps
      this._resetDisplayApplicationsToStartup();
    } else {
      this.resetSearch();
      this._clearCategorySelections(this.categoriesBox);
      this._clearTabFocusSelections();
      this._clearActiveContainerSelections();
      this._clearApplicationsBox();
      global.stage.set_key_focus(null);
    }
    return true;
  },

  refresh: function() {
    this._clearAll();
    this._display();
  },

  _clearAll: function() {
    this.menu.removeAll();
  },

  _setButtonHeight: function(button, height) {
    let adjustedHeight = height;
    let buttonBorder, buttonPadding;
    if (button.get_stage()) {
      let themeNode = button.get_theme_node();
      buttonBorder = {
        left: themeNode.get_border_width(St.Side.LEFT),
        top: themeNode.get_border_width(St.Side.TOP),
        bottom: themeNode.get_border_width(St.Side.BOTTOM),
        right: themeNode.get_border_width(St.Side.RIGHT),
      };
      buttonPadding = {
        left: themeNode.get_padding(St.Side.LEFT),
        top: themeNode.get_padding(St.Side.TOP),
        bottom: themeNode.get_padding(St.Side.BOTTOM),
        right: themeNode.get_padding(St.Side.RIGHT),
      };
      adjustedHeight = height - (buttonBorder.top + buttonBorder.bottom + buttonPadding.top + buttonPadding.bottom);
    }
    button.height = adjustedHeight;
  },

  _loadCategories: function(dir, root) {
    var rootDir = root;
    var iter = dir.iter();
    var nextType;
    while ((nextType = iter.next()) != CMenu.TreeItemType.INVALID) {
      if (nextType == CMenu.TreeItemType.ENTRY) {
        var entry = iter.get_entry();
        if (!entry.get_app_info().get_nodisplay()) {
          var app = this._applet.appSystem.lookup_app(entry.get_desktop_file_id());
          if (rootDir) {
            if (rootDir.get_menu_id()) {
              this.applicationsByCategory[rootDir.get_menu_id()].push(app);
            }
          } else {
            if (dir.get_menu_id()) {
              this.applicationsByCategory[dir.get_menu_id()].push(app);
            }
          }
        }
      } else if (nextType == CMenu.TreeItemType.DIRECTORY) {
        if (rootDir) {
          this._loadCategories(iter.get_directory(), rootDir);
        } else {
          this._loadCategories(iter.get_directory(), dir);
        }
      }
    }
  },

  _selectCategory: function(button) {
    this.resetSearch();
    this._clearApplicationsBox(button);
    let category = button._dir;
    if (typeof category == 'string') {
      this._displayApplications(this._listApplications(category));
    } else {
      this._displayApplications(this._listApplications(category.get_menu_id()));
    }

    // Cache the current category button so we can invoke this function to get around the list/grid toggle
    // not showing the app list.
    this._currentSelectKey = '_selectCategory';
    this._currentCategoryButton = button;
  },

  _selectFavorites: function(button) {
    this.resetSearch();
    this._clearApplicationsBox(button);

    let favorites = this.favorites;
    this._displayApplications(favorites);
    this._currentSelectKey = '_selectFavorites';
    this._currentCategoryButton = button;
  },

  _selectAllPlaces: function(button) {
    this.resetSearch();
    this._clearApplicationsBox(button);

    let places = this._listPlaces();
    let bookmarks = this._listBookmarks();
    let devices = this._listDevices();

    let allPlaces = places.concat(bookmarks.concat(devices));
    this._displayApplications(null, allPlaces);
    this._currentSelectKey = '_selectAllPlaces';
    this._currentCategoryButton = button;
  },

  _selectBookmarks: function(button) {
    this.resetSearch();
    this._clearApplicationsBox(button);

    let bookmarks = this._listBookmarks();
    this._displayApplications(null, bookmarks);
    this._currentSelectKey = '_selectBookmarks';
    this._currentCategoryButton = button;
  },

  _selectDevices: function(button) {
    this.resetSearch();
    this._clearApplicationsBox(button);

    let devices = this._listDevices();
    this._displayApplications(null, devices);
    this._currentSelectKey = '_selectDevices';
    this._currentCategoryButton = button;
  },

  _selectRecent: function(button) {
    this.resetSearch();
    this._clearApplicationsBox(button);

    let recent = this._listRecent();
    this._displayApplications(null, null, recent);
    this._currentSelectKey = '_selectRecent';
    this._currentCategoryButton = button;
  },

  _selectWebBookmarks: function(button) {
    this.resetSearch();
    this._clearApplicationsBox(button);

    let webBookmarks = this._listWebBookmarks();
    this._displayApplications(null, webBookmarks);
    this._currentSelectKey = '_selectWebBookmarks';
    this._currentCategoryButton = button;
  },

  _switchApplicationsView: function(mode) {
    this._applicationsViewMode = mode;
    let refresh = true;

    if (mode == ApplicationsViewMode.LIST) {
      this.applicationsListBox.show();
      this.applicationsGridBox.hide();
    } else {
      this.applicationsListBox.hide();
      this.applicationsGridBox.show();
    }

    // switch activeContainer and reset _selectedItemIndex for keyboard navigation
    if (this._activeContainer == this.applicationsListBox || this._activeContainer == this.applicationsGridBox) {

      // reset active container
      this._activeContainer = (mode === 0) ? this.applicationsListBox : this.applicationsGridBox;
      this._selectedItemIndex = -1;

      // reset scroll to top
      let vscroll = this.applicationsScrollBox.get_vscroll_bar();
      var new_scroll_value = this.applicationsScrollBox.get_allocation_box().y1;
      vscroll.get_adjustment().set_value(new_scroll_value);
    }

    this._clearApplicationsBox(null, refresh);
    this._displayApplications(null, null, null, refresh);
  },

  _clearCategorySelections: function(container, selectedCategory) {
    let categoryActors = container.get_children();
    if (categoryActors) {
      for (let i = 0, len = categoryActors.length; i < len; i++) {
        let actor = categoryActors[i];
        if (selectedCategory && (actor == selectedCategory.actor)) {
          actor.add_style_class_name('popup-sub-menu');
          if (this._style1) {
            actor.set_style(this._style1);
          }
        } else {
          actor.remove_style_class_name('popup-sub-menu');
          actor.set_style('border-color: none');
        }
      }
    }
  },

  _clearTabFocusSelections: function(selectedBox, resetSearch) {
    this._selectedItemIndex = -1;
    this._clearActiveContainerSelections();
    this._adjustThemeForCompatibility();

    if (!selectedBox) {
      return;
    }

    if (selectedBox != this.searchBox && resetSearch) {
      this.resetSearch();
    }
  },

  _clearActiveContainerSelections: function(selectedContainerActor) {
    if (!this._activeContainer) {
      return;
    }

    // Return if activeContainer has no children
    if (!this._activeContainer.get_children) {
      return;
    }

    this._activeContainer.get_children().forEach(function(actor) {
      if (selectedContainerActor) {
        if (selectedContainerActor && (actor == selectedContainerActor)) {
          actor.add_style_class_name('selected');
          if (actor._delegate && actor._delegate.select) {
            actor._delegate.select();
          }
        } else {
          actor.remove_style_class_name('selected');
        }
      } else {
        actor.remove_style_class_name('selected');
        if (actor._delegate && actor._delegate.unSelect) {
          actor._delegate.unSelect();
        }
      }
    });
  },

  _clearApplicationSelections: function(selectedApplication) {
    this.applicationsListBox.get_children().forEach(function(actor) {
      if (selectedApplication && (actor == selectedApplication)) {
        actor.add_style_class_name('selected');
      } else {
        actor.remove_style_class_name('selected');
      }
    });

    this.applicationsGridBox.get_children().forEach(function(actor) {
      if (selectedApplication && (actor == selectedApplication)) {
        actor.add_style_class_name('selected');
      } else {
        actor.remove_style_class_name('selected');
      }
    });
  },

  _clearApplicationsBox: function(selectedCategory, refresh) {
    let listActors = this.applicationsListBox.get_children();
    if (listActors) {
      for (let i = 0, len = listActors.length; i < len; i++) {
        this.applicationsListBox.remove_actor(listActors[i]);
      }
    }

    let gridActors = this.applicationsGridBox.get_children();
    if (gridActors) {
      for (let i = 0, len = gridActors.length; i < len; i++) {
        this.applicationsGridBox.remove_actor(gridActors[i]);
      }
    }

    // Don't want to clear selected category if just refreshing because of view mode change
    if (refresh) {
      return;
    }

    let categoryActors = this.categoriesBox.get_children();
    if (categoryActors) {
      for (let i = 0, len = categoryActors.length; i < len; i++) {
        let actor = categoryActors[i];
        if (selectedCategory && (actor == selectedCategory.actor)) {
          actor.add_style_class_name('popup-sub-menu');
          if (this._style1) {
            actor.set_style(this._style1);
          }
        } else {
          actor.remove_style_class_name('popup-sub-menu');
          actor.set_style('border-color: none');
        }
      }
    }
  },

  _listPlaces: function(pattern) {
    if (!this.placesManager) {
      return null;
    }
    let places = this.placesManager.getDefaultPlaces();
    let res = [];
    for (let i = 0, len = places.length; i < len; i++) {
      if (!pattern || places[i].name.toLowerCase().indexOf(pattern) !== -1) {
        res.push(places[i]);
      }
    }
    return res;
  },

  _listBookmarks: function(pattern) {
    if (!this.placesManager) {
      return null;
    }
    let bookmarks = this.placesManager.getBookmarks();
    let res = [];
    for (let i = 0, len = bookmarks.length; i < len; i++) {
      if (!pattern || bookmarks[i].name.toLowerCase().indexOf(pattern) !== -1) {
        res.push(bookmarks[i]);
      }
    }
    return res;
  },

  _listWebBookmarks: function(pattern) {
    if (!this._searchWebErrorsShown) {
      if (!Firefox.Gda) {
        let notifyTitle = _('Gno-Menu: Search Firefox bookmarks disabled');
        let notifyMessage = _(
          'If you want to search Firefox bookmarks, you must install the required pacakages: libgir1.2-gda-5.0 [Ubuntu] or libgda-sqlite [Fedora]'
        );
        this.selectedAppTitle.set_text(notifyTitle);
        this.selectedAppDescription.set_text(notifyMessage);
      }
      if (!Midori.Gda) {
        let notifyTitle = _('Gno-Menu: Search Midori bookmarks disabled');
        let notifyMessage = _(
          'If you want to search Midori bookmarks, you must install the required pacakages: libgir1.2-gda-5.0 [Ubuntu] or libgda-sqlite [Fedora]'
        );
        this.selectedAppTitle.set_text(notifyTitle);
        this.selectedAppDescription.set_text(notifyMessage);
      }
    }
    this._searchWebErrorsShown = true;

    let res = [];
    let bookmarks = [];

    bookmarks = bookmarks.concat(Chromium.bookmarks);
    bookmarks = bookmarks.concat(Firefox.bookmarks);
    bookmarks = bookmarks.concat(GoogleChrome.bookmarks);
    bookmarks = bookmarks.concat(Midori.bookmarks);
    bookmarks = bookmarks.concat(Opera.bookmarks);

    for (let i = 0, len = bookmarks.length; i < len; i++) {
      if (!pattern || bookmarks[i].name.toLowerCase().indexOf(pattern) != -1) {
        res.push({
          app: bookmarks[i].appInfo,
          name: bookmarks[i].name,
          icon: bookmarks[i].appInfo.get_icon(),
          mime: null,
          uri: bookmarks[i].uri
        });
      }
    }

    //res.sort(this._searchWebBookmarks.bookmarksSort);
    return res;
  },

  _listDevices: function(pattern) {
    if (!this.placesManager) {
      return null;
    }
    let devices = this.placesManager.getMounts();
    let res = [];
    for (let i = 0, len = devices.length; i < len; i++) {
      if (!pattern || devices[i].name.toLowerCase().indexOf(pattern) !== -1) {
        res.push(devices[i]);
      }
    }
    return res;
  },

  _listRecent: function(pattern) {
    if (!this._applet.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)) {
      return [];
    }

    let recentFiles = this.recentManager.get_items();
    let res = []

    for (let i = 0, len = recentFiles.length; i < len; i++) {
      let recentInfo = recentFiles[i];
      if (recentInfo.exists()) {
        if (!pattern || recentInfo.get_display_name().toLowerCase().indexOf(pattern) !== -1) {
          res.push({
            name: recentInfo.get_display_name(),
            icon: recentInfo.get_gicon(),
            mime: recentInfo.get_mime_type(),
            uri: recentInfo.get_uri()
          });
        }
      }
    }
    return res;
  },

  _listApplications: function(category_menu_id, pattern) {
    let applist;

    if (category_menu_id == 'all') {
      applist = [];
      for (let directory in this.applicationsByCategory) {
        applist = applist.concat(this.applicationsByCategory[directory]);
      }
    } else if (category_menu_id == 'frequent') {
      applist = this.frequentApps;
    } else if (category_menu_id == 'favorites') {
      applist = this.favorites;
    } else {
      if (category_menu_id) {
        applist = this.applicationsByCategory[category_menu_id];
      } else {
        applist = [];
        for (let directory in this.applicationsByCategory) {
          applist = applist.concat(this.applicationsByCategory[directory]);
        }
      }
    }

    let res;
    if (pattern) {
      res = [];
      for (let i = 0, len = applist.length; i < len; i++) {
        let app = applist[i];
        //let info = Gio.DesktopAppInfo.new(app.get_id());
        if (kmp(Util.latinise(app.get_name().toLowerCase()), pattern) !== -1) {
          res.push(app);
        }
      }
    } else {
      res = applist;
    }

    // Ignore favorites when sorting
    if (category_menu_id != 'favorites') {
      if (res === undefined) {
        res = [];
      }
      res.sort(function(a, b) {
        return a.get_name().toLowerCase() > b.get_name().toLowerCase();
      });
    }

    return res;
  },

  _adjustThemeForCompatibility: function() {
    return false; // TBD - this function breaks the top button box styling.
    // Certain menu objects get color, border, etc from theme
    /*let themeBorderColor = null,
      themeBorderColorAlpha = '1';
    let themeBorderColor2 = null,
      themeBorderColor2Alpha = '1';
    let themeBorderColor3 = null,
      themeBorderColor3Alpha = '1';
    let themeBackgroundColor = null,
      themeBackgroundColorAlpha = '1';
    let themeTextColor = null,
      themeTextColorAlpha = '1';
    let themeButtonTextColor = null,
      themeButtonTextColorAlpha = '1';
    let themeButtonTextColor2 = null,
      themeButtonTextColor2Alpha = '1';
    let themeBoxShadow = null;
    let themeBoxShadowColor = null,
      themeBoxShadowColorAlpha = '1';
    let themeBoxShadowInset, themeBoxShadowXOffset, themeBoxShadowYOffset;
    if (this.menu.actor.get_stage()) {
      let themeNode = this.menu.actor.get_theme_node();
      themeBorderColor = themeNode.get_color('-arrow-border-color');
      if (themeBorderColor.alpha) {
        themeBorderColorAlpha = themeBorderColor.alpha / 255;
      }
      themeTextColor = themeNode.get_color('color');
      if (themeTextColor.alpha) {
        themeTextColorAlpha = themeTextColor.alpha / 255;
      }
    }
    if (this._dummyButton.get_stage()) {
      let themeNode = this._dummyButton.get_theme_node();
      themeBackgroundColor = themeNode.get_background_color();
      if (themeBackgroundColor.alpha) {
        themeBackgroundColorAlpha = themeBackgroundColor.alpha / 255;
      }
      themeBoxShadow = themeNode.get_box_shadow();
      if (themeBoxShadow) {
        themeBoxShadowInset = themeBoxShadow.inset;
        if (themeBoxShadowInset) {
          themeBoxShadowInset = 'inset';
        } else {
          themeBoxShadowInset = '';
        }
        themeBoxShadowXOffset = themeBoxShadow.xoffset;
        themeBoxShadowYOffset = themeBoxShadow.yoffset;
        themeBoxShadowColor = themeBoxShadow.color;
        if (themeBoxShadowColor.alpha) {
          themeBoxShadowColorAlpha = themeBoxShadowColor.alpha / 255;
        }
      }
      themeButtonTextColor = themeNode.get_color('color');
      if (themeButtonTextColor.alpha) {
        themeButtonTextColorAlpha = themeButtonTextColor.alpha / 255;
      }
    }
    if (this._dummyButton2.get_stage()) {
      let themeNode = this._dummyButton2.get_theme_node();
      themeBorderColor2 = themeNode.get_border_color(St.Side.TOP);
      if (themeBorderColor2.alpha) {
        themeBorderColor2Alpha = themeBorderColor2.alpha / 255;
      }
      themeButtonTextColor2 = themeNode.get_color('color');
      if (themeButtonTextColor2.alpha) {
        themeButtonTextColor2Alpha = themeButtonTextColor2.alpha / 255;
      }
    }
    
    if (this._dummySeparator.actor.get_stage()) {
      let themeNode = this._dummySeparator.actor.get_theme_node();
      themeBorderColor3 = themeNode.get_border_color(St.Side.TOP);
      if (themeBorderColor3.alpha) {
        themeBorderColor3Alpha = themeBorderColor3.alpha / 255;
      }
    }

    let style1 = ', style2 = ',
      style3 = ', style4 = ',
      style5 = ', style6 = ';
    let delimeter1 = ', delimeter2 = ',
      delimeter3 = ', delimeter4 = ',
      delimeter5 = ', delimeter6 = ';
    if (themeBorderColor) {
      if (style1 != '') {
        delimeter1 = '; ';
      }
      if (style2 != '') {
        delimeter2 = '; ';
      }
      if (style3 != '') {
        delimeter3 = '; ';
      }
      if (style5 != '') {
        delimeter5 = '; ';
      }
      style1 += delimeter1 + 'border-color: rgba(' + themeBorderColor.red + ',' + themeBorderColor.green + ',' +
        themeBorderColor.blue + ',' + themeBorderColorAlpha + ')';
      style2 += delimeter2 + 'border-color: rgba(' + themeBorderColor.red + ',' + themeBorderColor.green + ',' +
        themeBorderColor.blue + ',' + themeBorderColorAlpha + ')';
      style3 += delimeter3 + 'border-color: rgba(' + themeBorderColor.red + ',' + themeBorderColor.green + ',' +
        themeBorderColor.blue + ',' + themeBorderColorAlpha + ')';
      style5 += delimeter5 + 'border-color: rgba(' + themeBorderColor.red + ',' + themeBorderColor.green + ',' +
        themeBorderColor.blue + ',' + themeBorderColorAlpha + ')';
    }
    if (themeBackgroundColor) {
      if (style3 != '') {
        delimeter3 = '; ';
      }
      style3 += delimeter3 + 'background-color: rgba(' + themeBackgroundColor.red + ',' + themeBackgroundColor.green +
        ',' + themeBackgroundColor.blue + ',' + themeBackgroundColorAlpha + ')';
    }
    if (themeTextColor) {
      if (style2 != '') {
        delimeter2 = '; ';
      }
      style2 += delimeter2 + 'color: rgba(' + themeTextColor.red + ',' + themeTextColor.green + ',' +
        themeTextColor.blue + ',' + themeTextColorAlpha + ')';
    }
    if (themeButtonTextColor) {
      if (style3 != '') {
        delimeter3 = '; ';
      }
      style3 += delimeter3 + 'color: rgba(' + themeButtonTextColor.red + ',' + themeButtonTextColor.green + ',' +
        themeButtonTextColor.blue + ',' + themeButtonTextColorAlpha + ')';
    }
    if (themeBoxShadow) {
      if (style3 != '') {
        delimeter3 = '; ';
      }
      style3 += delimeter3 + 'box-shadow: ' + themeBoxShadowInset + ' ' + themeBoxShadowXOffset + 'px ' +
        themeBoxShadowYOffset + 'px ' + ' rgba(' + themeBoxShadowColor.red + ',' + themeBoxShadowColor.green + ',' +
        themeBoxShadowColor.blue + ',' + themeBoxShadowColorAlpha + ')';
    }
    if (themeBorderColor2) {
      if (style4 != '') {
        delimeter4 = '; ';
      }
      style4 += delimeter4 + 'border-color: rgba(' + themeBorderColor2.red + ',' + themeBorderColor2.green + ',' +
        themeBorderColor2.blue + ',' + themeBorderColor2Alpha + ')';
    }
    if (themeButtonTextColor2) {
      if (style5 != '') {
        delimeter5 = '; ';
      }
      style5 += delimeter5 + 'color: rgba(' + themeButtonTextColor2.red + ',' + themeButtonTextColor2.green + ',' +
        themeButtonTextColor2.blue + ',' + themeButtonTextColor2Alpha + ')';
    }
    if (themeBorderColor3) {
      if (style6 != '') {
        delimeter6 = '; ';
      }
      style6 += delimeter6 + 'border-color: rgba(' + themeBorderColor3.red + ',' + themeBorderColor3.green + ',' +
        themeBorderColor3.blue + ',' + themeBorderColor3Alpha + ')';
    }

    this._style1 = style1;
    this._style2 = style5;

    this.searchEntry.set_style(style1);
    this.recentCategory.actor.set_style(style1);
    this.webBookmarksCategory.actor.set_style(style1);
    this.placesCategory.actor.set_style(style1);
    this.toggleStartupAppsView.actor.set_style(style1);
    this.toggleListGridView.actor.set_style(style1);

    this.userGroupBox.set_style(style3);
    this.viewModeBox.set_style(style3);

    // this.shortcutsScrollBox.set_style(style4);
    // this.groupCategoriesWorkspacesScrollBox.set_style(style4);
    // this.applicationsScrollBox.set_style(style4);
    this.shortcutsScrollBox.set_style(style6);
    this.groupCategoriesWorkspacesScrollBox.set_style(style6);
    this.applicationsScrollBox.set_style(style6);

    this.bottomPane.set_style(null);
    this.applicationsBoxWrapper.set_style(null);
    this.searchBox.set_style(null);
    return true;*/
  },

  _calculateApplicationsBoxWidth: function(isListView) {
    // Calculate visible menu boxes and adjust width accordingly
    let searchBoxWidth = this.searchBox.width;
    let searchBoxMargin = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let searchBoxBorder = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let searchBoxPadding = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    if (this.searchBox.get_stage()) {
      let themeNode = this.searchBox.get_theme_node();
      /*searchBoxMargin = { // Not supported in Cinnamon
          left: themeNode.get_margin(St.Side.LEFT),
          top: themeNode.get_margin(St.Side.TOP),
          bottom: themeNode.get_margin(St.Side.BOTTOM),
          right: themeNode.get_margin(St.Side.RIGHT),
      };*/
      searchBoxBorder = {
        left: themeNode.get_border_width(St.Side.LEFT),
        top: themeNode.get_border_width(St.Side.TOP),
        bottom: themeNode.get_border_width(St.Side.BOTTOM),
        right: themeNode.get_border_width(St.Side.RIGHT),
      };
      searchBoxPadding = {
        left: themeNode.get_padding(St.Side.LEFT),
        top: themeNode.get_padding(St.Side.TOP),
        bottom: themeNode.get_padding(St.Side.BOTTOM),
        right: themeNode.get_padding(St.Side.RIGHT),
      };
      searchBoxWidth = this.searchBox.width + searchBoxMargin.left + searchBoxMargin.right + searchBoxBorder.left +
        searchBoxBorder.right;
    }

    let viewModeBoxWrapperWidth = this.viewModeBoxWrapper.width;
    let viewModeBoxWrapperMargin = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let viewModeBoxWrapperBorder = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let viewModeBoxWrapperPadding = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    if (this.viewModeBoxWrapper.get_stage()) {
      let themeNode = this.viewModeBoxWrapper.get_theme_node();
      /*viewModeBoxWrapperMargin = { // Not supported in Cinnamon
          left: themeNode.get_margin(St.Side.LEFT),
          top: themeNode.get_margin(St.Side.TOP),
          bottom: themeNode.get_margin(St.Side.BOTTOM),
          right: themeNode.get_margin(St.Side.RIGHT),
      };*/
      viewModeBoxWrapperBorder = {
        left: themeNode.get_border_width(St.Side.LEFT),
        top: themeNode.get_border_width(St.Side.TOP),
        bottom: themeNode.get_border_width(St.Side.BOTTOM),
        right: themeNode.get_border_width(St.Side.RIGHT),
      };
      viewModeBoxWrapperPadding = {
        left: themeNode.get_padding(St.Side.LEFT),
        top: themeNode.get_padding(St.Side.TOP),
        bottom: themeNode.get_padding(St.Side.BOTTOM),
        right: themeNode.get_padding(St.Side.RIGHT),
      };
      viewModeBoxWrapperWidth = this.viewModeBoxWrapper.width + viewModeBoxWrapperMargin.left +
        viewModeBoxWrapperMargin.right + viewModeBoxWrapperBorder.left + viewModeBoxWrapperBorder.right;
    }

    let topPaneWidth = viewModeBoxWrapperWidth + searchBoxWidth;
    let minWidth = topPaneWidth - (this._widthCategoriesBox + this._widthShortcutsBox);

    let gridBoxBorder = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let gridBoxPadding = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let buttonMargin = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let buttonBorder = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let buttonPadding = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    if (this.applicationsGridBox.get_stage()) {
      let themeNode = this.applicationsGridBox.get_theme_node();
      gridBoxBorder = {
        left: themeNode.get_border_width(St.Side.LEFT),
        top: themeNode.get_border_width(St.Side.TOP),
        bottom: themeNode.get_border_width(St.Side.BOTTOM),
        right: themeNode.get_border_width(St.Side.RIGHT),
      };
      gridBoxPadding = {
        left: themeNode.get_padding(St.Side.LEFT),
        top: themeNode.get_padding(St.Side.TOP),
        bottom: themeNode.get_padding(St.Side.BOTTOM),
        right: themeNode.get_padding(St.Side.RIGHT),
      };

      let appType = ApplicationType.APPLICATION;
      let allAppCategoryButton = this.categoriesBox.get_child_at_index(1)._delegate;
      let allAppcategory = allAppCategoryButton._dir;
      let apps = this._listApplications(allAppcategory);
      if (apps && apps.length > 0) {
        let app = apps[0];
        let appGridButton = new AppGridButton(this, app, appType, true);
        let gridLayout = this.applicationsGridBox.layout_manager;
        gridLayout.pack(appGridButton.actor, 0, 0);
        if (appGridButton.actor.get_stage()) {
          let themeNode = appGridButton.actor.get_theme_node();
          /*buttonMargin = { // Not supported in Cinnamon
              left: themeNode.get_margin(St.Side.LEFT),
              top: themeNode.get_margin(St.Side.TOP),
              bottom: themeNode.get_margin(St.Side.BOTTOM),
              right: themeNode.get_margin(St.Side.RIGHT),
          };*/
          buttonBorder = {
            left: themeNode.get_border_width(St.Side.LEFT),
            top: themeNode.get_border_width(St.Side.TOP),
            bottom: themeNode.get_border_width(St.Side.BOTTOM),
            right: themeNode.get_border_width(St.Side.RIGHT),
          };
          buttonPadding = {
            left: themeNode.get_padding(St.Side.LEFT),
            top: themeNode.get_padding(St.Side.TOP),
            bottom: themeNode.get_padding(St.Side.BOTTOM),
            right: themeNode.get_padding(St.Side.RIGHT),
          };

          // calculate optimal App Grid button width
          this._appGridButtonWidth = this._applet.appsGridLabelWidth;
          let tempSize = this._applet.appsGridIconSize;
          if (this._appGridButtonWidth < tempSize) {
            this._appGridButtonWidth = tempSize;
          }
          tempSize = themeNode.get_min_width();
          if (this._appGridButtonWidth < tempSize) {
            this._appGridButtonWidth = tempSize;
          }
        }
      }
    }

    let scrollBoxBorder = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let scrollBoxPadding = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    if (this.applicationsScrollBox.get_stage()) {
      let themeNode = this.applicationsScrollBox.get_theme_node();
      scrollBoxBorder = {
        left: themeNode.get_border_width(St.Side.LEFT),
        top: themeNode.get_border_width(St.Side.TOP),
        bottom: themeNode.get_border_width(St.Side.BOTTOM),
        right: themeNode.get_border_width(St.Side.RIGHT),
      };
      scrollBoxPadding = {
        left: themeNode.get_padding(St.Side.LEFT),
        top: themeNode.get_padding(St.Side.TOP),
        bottom: themeNode.get_padding(St.Side.BOTTOM),
        right: themeNode.get_padding(St.Side.RIGHT),
      };
    }

    let iconSize = this._appGridButtonWidth + buttonMargin.left + buttonMargin.right + buttonBorder.left +
      buttonBorder.right + buttonPadding.left + buttonPadding.right;
    let gridWidth = (iconSize * this._appGridColumns) + gridBoxBorder.left + gridBoxBorder.right + gridBoxPadding.left +
      gridBoxPadding.right;

    let scrollWidth;
    if (isListView) {
      scrollWidth = (gridWidth / 1.5) + scrollBoxBorder.left + scrollBoxBorder.right + scrollBoxPadding.left +
      scrollBoxPadding.right;
    } else {
      scrollWidth = gridWidth + scrollBoxBorder.left + scrollBoxBorder.right + scrollBoxPadding.left +
      scrollBoxPadding.right;
    }

    if (scrollWidth >= minWidth) {
      this.applicationsScrollBox.width = scrollWidth;
    } else {
      this.applicationsScrollBox.width = minWidth;
      let extraWidth = minWidth - scrollWidth;
      let gridLayout = this.applicationsGridBox.layout_manager;
      gridLayout.set_column_spacing(extraWidth / (this._appGridColumns - 1));
    }
  },

  _resetDisplayApplicationsToStartup: function() { // TBD
    this._selectCategory(this.favAppCategory);
    /*if (this._applet.startupAppsDisplay === StartupAppsDisplay.ALL) {
      // TODO: All apps hardcoded at category position 0
      let allAppCategoryButton = this.categoriesBox.get_child_at_index(0)._delegate;
      let allAppcategory = allAppCategoryButton._dir;
      this._clearApplicationsBox(allAppCategoryButton);
      this._displayApplications(this._listApplications(allAppcategory));
    }
    else if (this._startupAppsView == StartupAppsDisplay.FREQUENT) {
               // TODO: Frequent apps hardcoded at category position 1
               let freqAppCategoryButton = this.categoriesBox.get_child_at_index(1)._delegate;
               let freqAppCategory = freqAppCategoryButton._dir;
               this._clearApplicationsBox(freqAppCategoryButton);
               this._displayApplications(this._listApplications(freqAppCategory));
           }
    else if (this._applet.startupAppsDisplay === StartupAppsDisplay.FAVORITES) {
      // TODO: Favorite apps hardcoded at category position 2
      let favAppCategoryButton = this.categoriesBox.get_child_at_index(1)._delegate;
      let favAppCategory = favAppCategoryButton._dir;
      this._clearApplicationsBox(favAppCategoryButton);
      this._displayApplications(this._listApplications(favAppCategory));
    } else {
      this._clearApplicationsBox();
    }*/
  },

  _displayApplications: function(apps, places, recent, refresh) {
    let viewMode = this._applicationsViewMode;
    let appType;

    // variables for icon grid layout
    //let page = 0;
    let column = 0;
    let rownum = 0;

    if (refresh) {
      apps = this._applications;
    } else {
      this._applications = [];
    }

    let appButtonEnterEvent = (appListButton, appType)=>{
      appListButton.actor.connect('enter-event', Lang.bind(this, function() {
        appListButton.actor.add_style_class_name('menu-application-button-selected');
        if (appType === ApplicationType.APPLICATION) {
          this.selectedAppTitle.set_text(appListButton._app.get_name());
          if (appListButton._app.get_description()) {
            this.selectedAppDescription.set_text(appListButton._app.get_description());
          } else {
            this.selectedAppDescription.set_text('');
          }
        } else {
          // Until we figure out how to prevent the menu width from expanding when long titles are displayed,
          // we will truncate the text.
          let nameLength = appListButton._app.name.length;
          let trailingTrunc = nameLength > 70 ? '...' : '';
          let name = appListButton._app.name.substring(0, 45) + trailingTrunc;
          this.selectedAppTitle.set_text(name);
          if (appListButton._app.description) {
            this.selectedAppDescription.set_text(appListButton._app.description);
          } else {
            if (appListButton._app.hasOwnProperty('uri')) {
              this.selectedAppDescription.set_text(appListButton._app.uri);
            } else {
              this.selectedAppDescription.set_text('');
            }
          }
        }
      }));
    };

    let appButtonLeaveEvent = (appListButton)=>{
      appListButton.actor.connect('leave-event', Lang.bind(this, function() {
        appListButton.actor.remove_style_class_name('menu-application-button-selected');
        this.selectedAppTitle.set_text('');
        this.selectedAppDescription.set_text('');
      }));
    };

    let appButtonButtonPressEvent = (appListButton)=>{
      appListButton.actor.connect('button-press-event', Lang.bind(this, function() {
        appListButton.actor.add_style_pseudo_class('pressed');
      }));
    };

    let appButtonButtonReleaseEvent = (appListButton, appType, app)=>{
      appListButton.actor.connect('button-release-event', Lang.bind(this, function() {
        appListButton.actor.remove_style_pseudo_class('pressed');
        this.selectedAppTitle.set_text('');
        this.selectedAppDescription.set_text('');
        if (appType === ApplicationType.APPLICATION) {
          appListButton._app.open_new_window(-1);
        } else if (appType === ApplicationType.PLACE) {
          if (app.uri) {
            appListButton._app.app.launch_uris([app.uri], null);
          } else {
            appListButton._app.launch();
          }
        } else if (appType === ApplicationType.RECENT) {
          Gio.app_info_launch_default_for_uri(app.uri, global.create_app_launch_context(0, -1));
        }
        this.menu.close();
      }));
    };

    if (apps) {
      appType = ApplicationType.APPLICATION;
      for (let i = 0, len = apps.length; i < len; i++) {
        let app = apps[i];
        // only add if not already in this._applications or refreshing
        if (refresh || !this._applications[app]) {
          if (viewMode == ApplicationsViewMode.LIST) { // ListView
            let appListButton = new AppListButton(this, app, appType);
            appButtonEnterEvent(appListButton, appType);
            appButtonLeaveEvent(appListButton)
            appButtonButtonPressEvent(appListButton);
            appButtonButtonReleaseEvent(appListButton, appType, app);
            this.applicationsListBox.add_actor(appListButton.actor);
          } else { // GridView
            let includeTextLabel = (this._applet.appsGridLabelWidth > 0) ? true : false;
            let appGridButton = new AppGridButton(this, app, appType, includeTextLabel);
            appGridButton.buttonbox.width = this._appGridButtonWidth;
            appButtonEnterEvent(appGridButton, appType);
            appButtonLeaveEvent(appGridButton)
            appButtonButtonPressEvent(appGridButton);
            appButtonButtonReleaseEvent(appGridButton, appType, app);
            let gridLayout = this.applicationsGridBox.layout_manager;
            gridLayout.pack(appGridButton.actor, column, rownum);
            column++;
            if (column > this._appGridColumns - 1) {
              column = 0;
              rownum++;
            }
          }
        }
        if (!refresh) {
          this._applications[app] = app;
        }
      }
    }


    if (refresh) {
      places = this._places;
    } else {
      this._places = [];
    }

    if (places) {
      appType = ApplicationType.PLACE;
      for (let i = 0, len = places.length; i < len; i++) {
        let app = places[i];
        // only add if not already in this._places or refreshing
        if (refresh || !this._places[app.name]) {
          if (viewMode == ApplicationsViewMode.LIST) { // ListView
            let appListButton = new AppListButton(this, app, appType);
            appButtonEnterEvent(appListButton, appType);
            appButtonLeaveEvent(appListButton)
            appButtonButtonPressEvent(appListButton);
            appButtonButtonReleaseEvent(appListButton, appType, app);
            this.applicationsListBox.add_actor(appListButton.actor);
          } else { // GridView
            let appGridButton = new AppGridButton(this, app, appType, true);
            appGridButton.buttonbox.width = this._appGridButtonWidth;
            appButtonEnterEvent(appGridButton, appType);
            appButtonLeaveEvent(appGridButton)
            appButtonButtonPressEvent(appGridButton, appType, app);
            appButtonButtonReleaseEvent(appGridButton, appType, app);
            let gridLayout = this.applicationsGridBox.layout_manager;
            gridLayout.pack(appGridButton.actor, column, rownum);
            column++;
            if (column > this._appGridColumns - 1) {
              column = 0;
              rownum++;
            }
          }
        }
        if (!refresh) {
          this._places[app.name] = app;
        }
      }
    }



    if (refresh) {
      recent = this._recent;
    } else {
      this._recent = [];
    }

    if (recent) {
      appType = ApplicationType.RECENT;
      for (let i = 0, len = recent.length; i < len; i++) {
        let app = recent[i];
        // only add if not already in this._recent or refreshing
        if (refresh || !this._recent[app.name]) {
          if (viewMode == ApplicationsViewMode.LIST) { // ListView
            let appListButton = new AppListButton(this, app, appType);
            appButtonEnterEvent(appListButton, appType);
            appButtonLeaveEvent(appListButton)
            appButtonButtonPressEvent(appListButton);
            appButtonButtonReleaseEvent(appListButton, appType, app);
            this.applicationsListBox.add_actor(appListButton.actor);
          } else { // GridView
            let appGridButton = new AppGridButton(this, app, appType, true);
            appGridButton.buttonbox.width = this._appGridButtonWidth;
            appGridButton.buttonbox.width = this._appGridButtonWidth;
            appButtonEnterEvent(appGridButton, appType);
            appButtonLeaveEvent(appGridButton)
            appButtonButtonPressEvent(appGridButton);
            appButtonButtonReleaseEvent(appGridButton, appType, app);
            let gridLayout = this.applicationsGridBox.layout_manager;
            gridLayout.pack(appGridButton.actor, column, rownum);
            column++;
            if (column > this._appGridColumns - 1) {
              column = 0;
              rownum++;
            }
          }
        }
        if (!refresh) {
          this._recent[app.name] = app;
        }
      }
    }

  },

  _scrollToActiveContainerButton: function(buttonActor) {
    let sBox;
    if (this._activeContainer == this.shortcutsBox) {
      sBox = this.shortcutsScrollBox;
    } else if (this._activeContainer == this.applicationsListBox || this._activeContainer == this.applicationsGridBox) {
      sBox = this.applicationsScrollBox;
    } else {
      return;
    }

    let vscroll = sBox.get_vscroll_bar();
    let buttonBox = buttonActor.get_allocation_box();

    var current_scroll_value = vscroll.get_adjustment().get_value();
    var box_height = sBox.get_allocation_box().y2 - sBox.get_allocation_box().y1;
    var new_scroll_value = current_scroll_value;

    if (current_scroll_value > buttonBox.y1 - 20) {
      new_scroll_value = buttonBox.y1 - 20;
    }
    if (box_height + current_scroll_value < buttonBox.y2 + 20) {
      new_scroll_value = buttonBox.y2 - box_height + 20;
    }
    if (new_scroll_value != current_scroll_value) {
      vscroll.get_adjustment().set_value(new_scroll_value);
    }
  },

  _onMenuKeyPress: function(actor, event) {
    let symbol = event.get_key_symbol();
    let code = event.get_key_code();
    let modifiers = event.get_state();
    let shift = modifiers & Clutter.ModifierType.SHIFT_MASK;
    let viewMode = this._applicationsViewMode;

    let reverse;
    if (code == 23 && shift) {
      reverse = true;
    }

    // Tab navigation
    if (code == 23) {
      if (this._activeContainer) {
        this._clearActiveContainerSelections();
      }
      switch (this._activeContainer) {
        case this.viewModeBox:
          if (reverse) {
            if (this._applet.hideUserOptions) {
              this._activeContainer = this.powerGroupBox;
            } else {
              this._activeContainer = this.viewModeBox;
            }
          } else {
            if (this._applet.hideShortcuts) {
              if (this._applet.hideCategories) {
                this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
              } else {
                this._activeContainer = this.categoriesBox;
              }
            } else {
              this._activeContainer = this.shortcutsBox;
            }
          }
          break;
        case this.shortcutsBox:
          if (reverse) {
            this._activeContainer = this.viewModeBox;
          } else {
            if (this._applet.hideCategories) {
              this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
            } else {
              this._activeContainer = this.categoriesBox;
            }
          }
          break;
        case this.categoriesBox:
          if (reverse) {
            if (this._applet.hideShortcuts) {
              this._activeContainer = this.viewModeBox;
            } else {
              this._activeContainer = this.shortcutsBox;
            }
          } else {
            this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
          }
          break;
        case this.applicationsListBox:
          if (reverse) {
            if (this._applet.hideCategories) {
              if (this._applet.hideShortcuts) {
                this._activeContainer = this.viewModeBox;
              } else {
                this._activeContainer = this.shortcutsBox;
              }
            } else {
              this._activeContainer = this.categoriesBox;
            }
          } else {
            this._activeContainer = this.powerGroupBox;
          }
          break;
        case this.applicationsGridBox:
          if (reverse) {
            if (this._applet.hideCategories) {
              if (this._applet.hideShortcuts) {
                this._activeContainer = this.viewModeBox;
              } else {
                this._activeContainer = this.shortcutsBox;
              }
            } else {
              this._activeContainer = this.categoriesBox;
            }
          } else {
            this._activeContainer = this.powerGroupBox;
          }
          break;
        case this.powerGroupBox:
          if (reverse) {
            this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
          } else {
            if (this._applet.hideUserOptions) {
              this._activeContainer = this.viewModeBox;
            } else {
              this._activeContainer = this.shortcutsBox;
            }
          }
          break;
        default:
          if (reverse) {
            this._activeContainer = this.powerGroupBox;
          } else {
            if (this._applet.hideUserOptions) {
              this._activeContainer = this.viewModeBox;
            } else {
              this._activeContainer = this.shortcutsBox;
            }
          }
      }
      this._clearTabFocusSelections(this._activeContainer, true);
      this.selectActiveContainerItem(symbol, code);
      return true;
    }

    // Set initial active container (default is this.applicationsListBox or this.applicationsGridBox)
    if (this._activeContainer === null && (symbol == Clutter.KEY_Up || symbol == Clutter.KEY_Down)) {
      this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
    } else if (this._activeContainer === null && (symbol == Clutter.KEY_Left || symbol == Clutter.KEY_Right)) {
      this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
    } else if (this._activeContainer === null) {
      return false;
    }

    if (this.selectActiveContainerItem(symbol, code)) {
      return true;
    } else {
      this._clearActiveContainerSelections();
      return false;
    }
  },

  selectActiveContainerItem: function(symbol, code, isFromSearch) {
    // Any items in container?
    let children = [];
    let columns, row;
    if (this._activeContainer.get_children) {
      children = this._activeContainer.get_children();
    }
    if (children.length === 0) {
      this._selectedItemIndex = -1;
    }

    // Get selected item index
    let index = this._selectedItemIndex;
    this._previousSelectedItemIndex = this._selectedItemIndex;

    // Navigate the active container
    if (symbol && symbol == Clutter.KEY_Up) {
      if (!this._selectedItemIndex || this._selectedItemIndex < 0) {
        index = 0;
      } else if (this._selectedItemInde && this._selectedItemIndex > -1) {
        if (this._activeContainer == this.applicationsGridBox) {
          columns = this._appGridColumns;
          index = (this._selectedItemIndex - columns < 0) ? this._selectedItemIndex : this._selectedItemIndex -
            columns;
        } else {
          index = (this._selectedItemIndex - 1 < 0) ? this._selectedItemIndex : this._selectedItemIndex - 1;
        }
      }
    } else if (symbol && symbol == Clutter.KEY_Down) {
      if (!this._selectedItemIndex || this._selectedItemIndex < 0) {
        index = 0;
      } else {
        if (this._activeContainer == this.applicationsGridBox) {
          columns = this._appGridColumns;
          index = (this._selectedItemIndex + columns >= children.length) ? this._selectedItemIndex : this._selectedItemIndex +
            columns;
        } else {
          index = (this._selectedItemIndex + 1 == children.length) ? children.length : this._selectedItemIndex + 1;
        }
      }
    } else if (symbol && symbol == Clutter.KEY_Left) {
      if (!this._selectedItemIndex || this._selectedItemIndex < 0) {
        index = 0;
      } else if (this._selectedItemIndex && this._selectedItemIndex > 0) {
        if (this._activeContainer == this.applicationsGridBox) {
          columns = this._appGridColumns;
          row = Math.floor(this._selectedItemIndex / columns);
          var firstCol = (row * columns);
          index = (this._selectedItemIndex - 1 < firstCol) ? firstCol : this._selectedItemIndex - 1;
        } else {
          index = (this._selectedItemIndex - 1 < 0) ? this._selectedItemIndex : this._selectedItemIndex - 1;
        }
      }
    } else if (symbol && symbol == Clutter.KEY_Right) {
      if (!this._selectedItemIndex || this._selectedItemIndex < 0) {
        index = 0;
      } else {
        if (this._activeContainer == this.applicationsGridBox) {
          columns = this._appGridColumns;
          row = Math.floor(this._selectedItemIndex / columns);
          var lastCol = (row * columns) + columns;
          lastCol = (lastCol > children.length) ? children.length : lastCol;
          index = (this._selectedItemIndex + 1 >= lastCol) ? index : this._selectedItemIndex + 1;
        } else {
          index = (this._selectedItemIndex + 1 == children.length) ? children.length : this._selectedItemIndex + 1;
        }
      }
    } else if (symbol && symbol == Clutter.KEY_Return || symbol == Clutter.KP_Enter) {
      if (this._activeContainer == this.applicationsListBox || this._activeContainer == this.applicationsGridBox ||
        this._activeContainer == this.shortcutsBox) {
        // Launch application or Nautilus place or Recent document
        let item_actor = children[this._selectedItemIndex];
        if (item_actor._delegate._type == ApplicationType.APPLICATION) {
          this.menu.close();
          item_actor._delegate._app.open_new_window(-1);
        } else if (item_actor._delegate._type == ApplicationType.PLACE) {
          this.menu.close();
          if (item_actor._delegate._app.uri) {
            item_actor._delegate._app.app.launch_uris([item_actor._delegate._app.uri], null);
          } else {
            item_actor._delegate._app.launch();
          }
        } else if (item_actor._delegate._type == ApplicationType.RECENT) {
          this.menu.close();
          Gio.app_info_launch_default_for_uri(item_actor._delegate._app.uri, global.create_app_launch_context(0, -1));
        }
        return true;
      } else if (this._activeContainer == this.viewModeBox || this._activeContainer ==
        this.powerGroupBox || this._activeContainer == this.categoriesBox) {
        // Simulate button click
        if (index >= children.length) {
          return false;
        } else {
          let item_actor = children[this._selectedItemIndex];
          item_actor._delegate.click();
        }
        return true;
      } else {
        return false;
      }
    } else {
      if ((code && code == 23) || isFromSearch) {
        // Continue
        index = 0;
      } else {
        return false;
      }
    }


    // Check if position reached its end
    if (index >= children.length) {
      if (this._activeContainer == this.powerGroupBox) {
        // allow index to be 1 greater to accommodate pref button
        index = children.length;
      } else {
        index = children.length - 1;
      }
    }

    // All good .. now get item actor in container
    this._selectedItemIndex = index;
    let itemActor = children[this._selectedItemIndex];

    // Check if item actor is valid
    if (!itemActor || itemActor === this.searchEntry) {
      if (this._activeContainer !== this.powerGroupBox) {
        return false;
      }
    }

    // Clear out container and select item actor
    this._clearActiveContainerSelections(itemActor);

    // Set selected app name/description
    if (this._activeContainer == this.shortcutsBox || this._activeContainer == this.applicationsListBox || this._activeContainer ==
      this.applicationsGridBox) {
      if (itemActor._delegate._type == ApplicationType.APPLICATION) {
        this.selectedAppTitle.set_text(itemActor._delegate._app.get_name());
        if (itemActor._delegate._app.get_description()) {
          this.selectedAppDescription.set_text(itemActor._delegate._app.get_description());
        } else {
          this.selectedAppDescription.set_text('');
        }
      } else if (itemActor._delegate._type == ApplicationType.PLACE) {
        this.selectedAppTitle.set_text(itemActor._delegate._app.name);
        if (itemActor._delegate._app.description) {
          this.selectedAppDescription.set_text(itemActor._delegate._app.description);
        } else {
          this.selectedAppDescription.set_text('');
        }
      } else if (itemActor._delegate._type == ApplicationType.RECENT) {
        this.selectedAppTitle.set_text(itemActor._delegate._app.name);
        if (itemActor._delegate._app.description) {
          this.selectedAppDescription.set_text(itemActor._delegate._app.description);
        } else {
          this.selectedAppDescription.set_text('');
        }
      }

      // Scroll to item actor if hidden from view
      this._scrollToActiveContainerButton(itemActor);
    }

    return true;
  },

  resetSearch: function() {
    this.searchEntry.set_text('');
    this.searchActive = false;
  },

  resetSearchWithFocus: function() {
    global.stage.set_key_focus(this.searchEntry);
    this.searchEntry.set_text('');
    this.searchActive = false;
  },

  _onSearchTextChanged: function(se, prop) {
    if (this.searchActive) {
      if (this.searchEntry.get_text() === '') {
        this._resetDisplayApplicationsToStartup();
      } else {
        this._clearCategorySelections(this.categoriesBox);
      }
    }
    this._clearActiveContainerSelections();
    this.selectedAppTitle.set_text('');
    this.selectedAppDescription.set_text('');


    this.searchActive = this.searchEntry.get_text().length > 0;
    if (this.searchActive) {

      this.searchEntry.set_secondary_icon(this._searchActiveIcon);

      if (this._searchIconClickedId === 0) {
        this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked', Lang.bind(this, function() {
          this.resetSearchWithFocus();
          this._resetDisplayApplicationsToStartup();
        }));
      }
    } else {
      if (this._searchIconClickedId > 0) {
        this.searchEntry.disconnect(this._searchIconClickedId);
      }

      this._searchIconClickedId = 0;
      this.searchEntry.set_secondary_icon(null);
    }
    if (!this.searchActive) {
      if (this._searchTimeoutId > 0) {
        Mainloop.source_remove(this._searchTimeoutId);
        this._searchTimeoutId = 0;
      }
      return;
    }
    if (this._searchTimeoutId > 0) {
      return;
    }

    this._searchTimeoutId = Mainloop.timeout_add(150, Lang.bind(this, this._doSearch));
  },

  _doSearch: function() {
    this._searchTimeoutId = 0;
    let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
    if (pattern === this._previousSearchPattern) {
      return false;
    }
    this._previousSearchPattern = pattern;

    this._activeContainer = null;
    this._selectedItemIndex = -1;
    this._previousSelectedItemIndex = null;
    this._clearTabFocusSelections();

    // _listApplications returns all the applications when the search
    // string is zero length. This will happend if you type a space
    // in the search entry.
    if (pattern.length === 0) {
      return false;
    }

    let appResults = this._listApplications(null, pattern);

    let placesResults = [];

    let places = this._listPlaces(pattern);

    for (let i = 0, len = places.length; i < len; i++) {
      placesResults.push(places[i]);
    }

    //let bookmarks = this._listBookmarks(pattern);
    //for (var i in bookmarks) placesResults.push(bookmarks[i]);

    let webBookmarks = this._listWebBookmarks(pattern);

    for (let i = 0, len = webBookmarks.length; i < len; i++) {
      placesResults.push(webBookmarks[i]);
    }

    //let devices = this._listDevices(pattern);
    //for (var i in devices) placesResults.push(devices[i]);

    let recentResults = this._listRecent(pattern);


    this._clearApplicationsBox();
    this._displayApplications(appResults, placesResults, recentResults);

    this._activeContainer = (this._applicationsViewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox :
      this.applicationsGridBox;
    this.selectActiveContainerItem(null, null, true);

    return false;
  },

  _display: function() {
    let recentEnabled = this._applet.privacy_settings.get_boolean(REMEMBER_RECENT_KEY);

    // popupMenuSection holds the mainbox
    let section = new PopupMenu.PopupMenuSection();
    this._dummySeparator = new PopupMenu.PopupSeparatorMenuItem();
    this._dummySeparator.opacity = 0;
    this._dummyButton = new St.Button({
      style_class: 'button'
    });
    this._dummyButton.opacity = 0;
    this._dummyButton.set_size(0, 0);
    this._dummyButton2 = new St.Button({
      style_class: 'system-menu-action'
    });
    this._dummyButton2.opacity = 0;
    this._dummyButton2.set_size(0, 0);


    // mainbox holds the topPane and bottomPane
    this.mainBox = new St.BoxLayout({
      style_class: 'menu-applications-inner-box',
      vertical: true
    }); // menu

    // Top pane holds user group, view mode, and search (packed horizonally)
    this.topPane = new St.BoxLayout({
      style_class: ''
    });

    // Middle pane holds shortcuts, categories/places/power, applications, workspaces (packed horizontally)
    let middlePane = new St.BoxLayout({
      style_class: ''
    });

    // Bottom pane holds power group and selected app description (packed horizontally)
    this.bottomPane = new St.BoxLayout({
      style_class: ''
    });

    // groupCategoriesWorkspacesWrapper bin wraps categories and workspaces
    this.groupCategoriesWorkspacesWrapper = new St.BoxLayout({
      style_class: 'cinnamenu-categories-workspaces-wrapper',
      vertical: true
    });

    // groupCategoriesWorkspacesScrollBox allows categories or workspaces to scroll vertically
    this.groupCategoriesWorkspacesScrollBox = new St.ScrollView({
      x_fill: true,
      y_fill: false,
      height: 600,
      y_align: St.Align.START,
      style_class: 'vfade cinnamenu-categories-workspaces-scrollbox'
    });
    let vscrollCategories = this.groupCategoriesWorkspacesScrollBox.get_vscroll_bar();
    vscrollCategories.connect('scroll-start', Lang.bind(this, function() {
      this.menu.passEvents = true;
    }));
    vscrollCategories.connect('scroll-stop', Lang.bind(this, function() {
      this.menu.passEvents = false;
    }));
    this.groupCategoriesWorkspacesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
    this.groupCategoriesWorkspacesScrollBox.set_mouse_scrolling(true);
    /*this.groupCategoriesWorkspacesScrollBox.connect('button-release-event', Lang.bind(this, function(actor, event) {
      let button = event.get_button();
      if (button == 3) { //right click
        // This was for showing workspace thumbnails, but serves no function on Cinnamon. Whether to use this signal or not TBD.
      }
    }));*/

    // selectedAppBox
    this.selectedAppBox = new St.BoxLayout({
      style_class: 'menu-selected-app-box',
      vertical: true
    });
    this.selectedAppTitle = new St.Label({
      style_class: 'menu-selected-app-title',
      text: ''
    });
    this.selectedAppBox.add_actor(this.selectedAppTitle);
    this.selectedAppDescription = new St.Label({
      style_class: 'menu-selected-app-description',
      text: ''
    });
    this.selectedAppBox.add_actor(this.selectedAppDescription);

    // ViewModeBox
    let viewModeButtonIcon = 'view-grid-symbolic';
    if (this._applicationsViewMode == ApplicationsViewMode.LIST) {
      viewModeButtonIcon = 'view-list-symbolic';
    }

    let viewModeButtonIconSize = 16;

    let viewModeAdditionalStyle = '';
    if (this._applet.hideUserOptions) {
      viewModeAdditionalStyle = ' no-useroptions';
    }

    this.viewModeBoxWrapper = new St.BoxLayout({
      style_class: 'cinnamenu-view-mode-box-wrapper' + viewModeAdditionalStyle
    });
    this.viewModeBox = new St.BoxLayout({
      style_class: 'cinnamenu-view-mode-box' + viewModeAdditionalStyle
    });

    this.toggleListGridView = new GroupButton(this, viewModeButtonIcon, viewModeButtonIconSize, null, {
      style_class: 'menu-category-button'
    });
    this.toggleListGridView.setButtonEnterCallback(Lang.bind(this, function() {
      this.toggleListGridView.actor.add_style_class_name('menu-category-button-selected');
      this.selectedAppTitle.set_text(_('List View'));
      this.selectedAppDescription.set_text('');
    }));
    this.toggleListGridView.setButtonLeaveCallback(Lang.bind(this, function() {
      this.toggleListGridView.actor.remove_style_class_name('menu-category-button-selected');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
    }));
    this.toggleListGridView.setButtonPressCallback(Lang.bind(this, function() {
      this.toggleListGridView.actor.add_style_pseudo_class('pressed');
    }));
    this.toggleListGridView.setButtonReleaseCallback(Lang.bind(this, function() {
      this.toggleListGridView.actor.remove_style_pseudo_class('pressed');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
      if (this._applicationsViewMode == ApplicationsViewMode.LIST) {
        this.toggleListGridView.setIcon('view-list-symbolic');
        this._switchApplicationsView(ApplicationsViewMode.GRID);
        this._applet.settings.setValue('startup-view-mode', 1);
      } else {
        this.toggleListGridView.setIcon('view-grid-symbolic');
        this._switchApplicationsView(ApplicationsViewMode.LIST);
        this._applet.settings.setValue('startup-view-mode', 0);
      }
      // Retrigger an app list render until we figure out why its not rendering anything on toggle.
      this._calculateApplicationsBoxWidth(this._applicationsViewMode === ApplicationsViewMode.LIST);
      this[this._currentSelectKey](this._currentCategoryButton);
    }));

    this.viewModeBox.add(this.toggleListGridView.actor, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this.viewModeBoxWrapper.add(this.viewModeBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });

    // SearchBox
    let searchEntryAdditionalStyle = '';
    if (this._applet.appsGridIconSize == 16) {
      searchEntryAdditionalStyle += ' x16';
    } else if (this._applet.appsGridIconSize == 22) {
      searchEntryAdditionalStyle += ' x22';
    } else if (this._applet.appsGridIconSize == 24) {
      searchEntryAdditionalStyle += ' x24';
    } else if (this._applet.appsGridIconSize == 32) {
      searchEntryAdditionalStyle += ' x32';
    } else if (this._applet.appsGridIconSize == 48) {
      searchEntryAdditionalStyle += ' x48';
    } else if (this._applet.appsGridIconSize == 64) {
      searchEntryAdditionalStyle += ' x64';
    }
    if (this._applet.hideUserOptions) {
      searchEntryAdditionalStyle += ' no-useroptions';
    }

    this._searchInactiveIcon = new St.Icon({
      style_class: 'menu-search-entry-icon',
      icon_name: 'edit-find'
    });
    this._searchActiveIcon = new St.Icon({
      style_class: 'menu-search-entry-icon',
      icon_name: 'edit-clear'
    });
    this.searchBox = new St.BoxLayout({
      style_class: 'menu-search-box' + searchEntryAdditionalStyle
    });
    this.searchEntry = new St.Entry({
      name: 'menu-search-entry',
      style_class: 'menu-search-entry' + searchEntryAdditionalStyle,
      hint_text: _('Type to search...'),
      track_hover: true,
      can_focus: true
    });

    this.searchEntry.set_primary_icon(this._searchInactiveIcon);
    this.searchBox.add(this.searchEntry, {
      expand: true,
      x_align: St.Align.START,
      y_align: St.Align.START
    });
    this.searchActive = false;
    this.searchEntryText = this.searchEntry.clutter_text;
    this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
    this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
    this._previousSearchPattern = '';


    // ShortcutsBox
    this.shortcutsBox = new St.BoxLayout({
      style_class: 'menu-places-box',
      vertical: true
    });
    this.shortcutsScrollBox = new St.ScrollView({
      x_fill: true,
      y_fill: false,
      y_align: St.Align.START,
      style_class: 'vfade menu-applications-scrollbox'
    });
    let vscrollShortcuts = this.shortcutsScrollBox.get_vscroll_bar();
    vscrollShortcuts.connect('scroll-start', Lang.bind(this, function() {
      this.menu.passEvents = true;
    }));
    vscrollShortcuts.connect('scroll-stop', Lang.bind(this, function() {
      this.menu.passEvents = false;
    }));
    this.shortcutsScrollBox.add_actor(this.shortcutsBox);
    this.shortcutsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
    this.shortcutsScrollBox.set_mouse_scrolling(true);

    if (this._applet.hideShortcuts) {
      this._widthShortcutsBox = 0;
      this.shortcutsScrollBox.hide();
    }

    //Load Favorites
    this.favorites = [];
    let launchers = global.settings.get_strv('favorite-apps');
    for (let i = 0, len = launchers.length; i < len; i++) {
      let app = this._applet.appSystem.lookup_app(launchers[i]);
      if (app) {
        this.favorites.push(app);
      }
    }

    // Load Frequent Apps
    // TBD - Cinnamon does not have AppUsage, so we need to find a way to simulate it.
    /*let mostUsed = this._applet.appSystem.get_all();
    for (let i=0; i<mostUsed.length; i++) {
        if (mostUsed[i].get_app_info().should_show())
            this.frequentApps.push(mostUsed[i]);
    }*/

    // Load Places
    if (PlaceDisplay) {
      if (this._applet.shortcutsDisplay == ShortcutsDisplay.PLACES) {
        this.placesManager = new PlaceDisplay.PlacesManager(true);
      } else {
        this.placesManager = new PlaceDisplay.PlacesManager(false);
      }
    } else {
      this.placesManager = null;
    }

    // Load Shortcuts Panel
    /*let shortcuts = [];
    let shortcutType;
    if (this._applet.shortcutsDisplay === ShortcutsDisplay.PLACES) {
      let places = this._listPlaces();
      let bookmarks = this._listBookmarks();
      let devices = this._listDevices();
      let allPlaces = places.concat(bookmarks.concat(devices));
      shortcuts = allPlaces;
      shortcutType = ApplicationType.PLACE;
    } else {
      shortcuts = this.favorites;
      shortcutType = ApplicationType.APPLICATION;
    }

    let shortcutButtonEnterEvent = (shortcutButton)=>{
      shortcutButton.actor.connect('enter-event', Lang.bind(this, function() {
        shortcutButton.actor.add_style_class_name('selected');
        if (this._applet.shortcutsDisplay == ShortcutsDisplay.PLACES) {
          this.selectedAppTitle.set_text(shortcutButton._app.name);
          this.selectedAppDescription.set_text('');
        } else {
          this.selectedAppTitle.set_text(shortcutButton._app.get_name());
          if (shortcutButton._app.get_description()) {
            this.selectedAppDescription.set_text(shortcutButton._app.get_description());
          } else {
            this.selectedAppDescription.set_text('');
          }
        }
      }));
    };

    let shortcutButtonLeaveEvent = (shortcutButton)=>{
      shortcutButton.actor.connect('leave-event', Lang.bind(this, function() {
        shortcutButton.actor.remove_style_class_name('selected');
        this.selectedAppTitle.set_text('');
        this.selectedAppDescription.set_text('');
      }));
    };

    let shortcutButtonPressEvent = (shortcutButton)=>{
      shortcutButton.actor.connect('button-press-event', Lang.bind(this, function() {
        shortcutButton.actor.add_style_pseudo_class('pressed');
      }));
    };

    let shortcutButtonReleaseEvent = (shortcutButton, app)=>{
      shortcutButton.actor.connect('button-release-event', Lang.bind(this, function() {
        shortcutButton.actor.remove_style_pseudo_class('pressed');
        shortcutButton.actor.remove_style_class_name('selected');
        this.selectedAppTitle.set_text('');
        this.selectedAppDescription.set_text('');
        if (this._applet.shortcutsDisplay == ShortcutsDisplay.PLACES) {
          if (app.uri) {
            shortcutButton._app.app.launch_uris([app.uri], null);
          } else {
            shortcutButton._app.launch();
          }
        } else {
          shortcutButton._app.open_new_window(-1);
        }
        this.menu.close();
      }));
    };

    for (let i = 0, len = shortcuts.length; i < len; i++) {
      let app = shortcuts[i];
      let shortcutButton = new ShortcutButton(this, app, shortcutType);
      this.shortcutsBox.add_actor(shortcutButton.actor);
      shortcutButtonEnterEvent(shortcutButton);
      shortcutButtonLeaveEvent(shortcutButton);
      shortcutButtonPressEvent(shortcutButton);
      shortcutButtonReleaseEvent(shortcutButton, app);
    }*/

    // CategoriesBox
    this.categoriesBox = new St.BoxLayout({
      style_class: 'menu-categories-box',
      vertical: true
    });

    // Initialize application categories
    this.applicationsByCategory = {};

    // Load 'all applications' category
    let allAppCategory = new CategoryListButton('all', _('All Applications'), 'computer');
    this.allAppCategory = allAppCategory;
    allAppCategory.setButtonEnterCallback(Lang.bind(this, function() {
      allAppCategory.actor.add_style_pseudo_class('hover');
      this.selectedAppTitle.set_text(allAppCategory.label.get_text());
      this.selectedAppDescription.set_text('');

      if (allAppCategory._ignoreHoverSelect) {
        return;
      }

      if (this._applet.categorySelectionMethod == SelectMethod.HOVER) {
        let hoverDelay = this._applet.categoryHoverDelay;
        this._hoverTimeoutId = Mainloop.timeout_add((hoverDelay > 0) ? hoverDelay : 0, Lang.bind(this,
          function() {
            this._selectCategory(allAppCategory);
            this._hoverTimeoutId = 0;
          }));
      }
    }));
    allAppCategory.setButtonLeaveCallback(Lang.bind(this, function() {
      allAppCategory.actor.remove_style_pseudo_class('hover');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');

      if (this._applet.categorySelectionMethod == SelectMethod.HOVER) {
        if (this._hoverTimeoutId > 0) {
          Mainloop.source_remove(this._hoverTimeoutId);
        }
      }
    }));
    allAppCategory.setButtonReleaseCallback(Lang.bind(this, function() {
      this._selectCategory(allAppCategory);
      this.selectedAppTitle.set_text(allAppCategory.label.get_text());
      this.selectedAppDescription.set_text('');
    }));
    this.categoriesBox.add_actor(allAppCategory.actor);

    // Load 'frequent applications' category // TBD
    /*let freqAppCategory = new CategoryListButton('frequent', _('Frequent Apps'));
    freqAppCategory.setButtonEnterCallback(Lang.bind(this, function() {
        freqAppCategory.actor.add_style_class_name('selected');
        this.selectedAppTitle.set_text(freqAppCategory.label.get_text());
        this.selectedAppDescription.set_text('');

        if (freqAppCategory._ignoreHoverSelect)
            return;

        if (this._applet.categorySelectionMethod == SelectMethod.HOVER ) {
            let hoverDelay = this._applet.categoryHoverDelay;
            this._hoverTimeoutId = Mainloop.timeout_add((hoverDelay >0) ? hoverDelay : 0, Lang.bind(this, function() {
                this._selectCategory(freqAppCategory);
                this._hoverTimeoutId = 0;
             }));
        }
    }));
    freqAppCategory.setButtonLeaveCallback(Lang.bind(this, function() {
        freqAppCategory.actor.remove_style_class_name('selected');
        this.selectedAppTitle.set_text('');
        this.selectedAppDescription.set_text('');

        if (this._applet.categorySelectionMethod == SelectMethod.HOVER ) {
            if (this._hoverTimeoutId > 0) {
                Mainloop.source_remove(this._hoverTimeoutId);
            }
        }
    }));
    freqAppCategory.setButtonPressCallback(Lang.bind(this, function() {
        freqAppCategory.actor.add_style_pseudo_class('pressed');
    }));
    freqAppCategory.setButtonReleaseCallback(Lang.bind(this, function() {
        freqAppCategory.actor.remove_style_pseudo_class('pressed');
        freqAppCategory.actor.remove_style_class_name('selected');
        this._startupAppsView = StartupAppsDisplay.FREQUENT;
        this._selectCategory(freqAppCategory);
        this.selectedAppTitle.set_text(freqAppCategory.label.get_text());
        this.selectedAppDescription.set_text('');
    }));
    this.categoriesBox.add_actor(freqAppCategory.actor);
    */

    // Load 'favorite applications' category
    let favAppCategory = new CategoryListButton('favorites', _('Favorite Apps'), 'address-book-new');
    this.favAppCategory = favAppCategory;
    favAppCategory.setButtonEnterCallback(Lang.bind(this, function() {
      favAppCategory.actor.add_style_pseudo_class('hover');
      this.selectedAppTitle.set_text(favAppCategory.label.get_text());
      this.selectedAppDescription.set_text('');

      if (favAppCategory._ignoreHoverSelect) {
        return;
      }

      if (this._applet.categorySelectionMethod == SelectMethod.HOVER) {
        let hoverDelay = this._applet.categoryHoverDelay;
        this._hoverTimeoutId = Mainloop.timeout_add((hoverDelay > 0) ? hoverDelay : 0, Lang.bind(this,
          function() {
            this._selectCategory(favAppCategory);
            this._hoverTimeoutId = 0;
          }));
      }
    }));
    favAppCategory.setButtonLeaveCallback(Lang.bind(this, function() {
      favAppCategory.actor.remove_style_pseudo_class('hover');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');

      if (this._applet.categorySelectionMethod == SelectMethod.HOVER) {
        if (this._hoverTimeoutId > 0) {
          Mainloop.source_remove(this._hoverTimeoutId);
        }
      }
    }));
    favAppCategory.setButtonReleaseCallback(Lang.bind(this, function() {
      this._selectCategory(favAppCategory);
      this.selectedAppTitle.set_text(favAppCategory.label.get_text());
      this.selectedAppDescription.set_text('');
    }));
    this.categoriesBox.add_actor(favAppCategory.actor);

    // Load rest of categories

    let sortDirs = (dirs) => {
      dirs.sort(function(a, b) {
        let prefCats = ['administration', 'preferences'];
        let menuIdA = a.get_menu_id().toLowerCase();
        let menuIdB = b.get_menu_id().toLowerCase();

        let prefIdA = prefCats.indexOf(menuIdA);
        let prefIdB = prefCats.indexOf(menuIdB);

        if (prefIdA < 0 && prefIdB >= 0) {
          return -1;
        }
        if (prefIdA >= 0 && prefIdB < 0) {
          return 1;
        }

        let nameA = a.get_name().toLowerCase();
        let nameB = b.get_name().toLowerCase();

        if (nameA > nameB) {
          return 1;
        }
        if (nameA < nameB) {
          return -1;
        }
        return 0;
      });
      return dirs;
    };

    let appCategoryButtonEnterEvent = (appCategory)=>{
      appCategory.setButtonEnterCallback(Lang.bind(this, function() {
          appCategory.actor.add_style_pseudo_class('hover');
          this.selectedAppTitle.set_text(appCategory.label.get_text());
          this.selectedAppDescription.set_text('');

          if (appCategory._ignoreHoverSelect) {
            return;
          }

          if (this._applet.categorySelectionMethod == SelectMethod.HOVER) {
            let hoverDelay = this._applet.categoryHoverDelay;
            this._hoverTimeoutId = Mainloop.timeout_add((hoverDelay > 0) ? hoverDelay : 0, Lang.bind(this,
              function() {
                this._selectCategory(appCategory);
                this._hoverTimeoutId = 0;
              }));
          }
        }));
    };

    let appCategoryButtonLeaveEvent = (appCategory)=>{
      appCategory.setButtonLeaveCallback(Lang.bind(this, function() {
        appCategory.actor.remove_style_pseudo_class('hover');
        this.selectedAppTitle.set_text('');
        this.selectedAppDescription.set_text('');

        if (this._applet.categorySelectionMethod == SelectMethod.HOVER) {
          if (this._hoverTimeoutId > 0) {
            Mainloop.source_remove(this._hoverTimeoutId);
          }
        }
      }));
    };

    let appCategoryButtonReleaseEvent = (appCategory)=>{
      appCategory.setButtonReleaseCallback(Lang.bind(this, function() {
        this._selectCategory(appCategory);
        this.selectedAppTitle.set_text(appCategory.label.get_text());
        this.selectedAppDescription.set_text('');
      }));
    };


    let trees = [this._applet.appSystem.get_tree()];
    for (let i = 0, len = trees.length; i < len; i++) {
      let tree = trees[i];
      let root = tree.get_root_directory();
      let dirs = [];
      let iter = root.iter();
      let nextType;

      while ((nextType = iter.next()) != CMenu.TreeItemType.INVALID) {
        if (nextType == CMenu.TreeItemType.DIRECTORY) {
          dirs.push(iter.get_directory());
        }
      }

      dirs = sortDirs(dirs)

      for (let i = 0, len = dirs.length; i < len; i++) {
        let dir = dirs[i];
        if (dir.get_is_nodisplay()) {
          continue;
        }
        this.applicationsByCategory[dir.get_menu_id()] = [];
        this._loadCategories(dir);
        if (this.applicationsByCategory[dir.get_menu_id()].length > 0) {
          let appCategory = new CategoryListButton(dir);
          appCategoryButtonEnterEvent(appCategory);
          appCategoryButtonLeaveEvent(appCategory);
          appCategoryButtonReleaseEvent(appCategory);
          this.categoriesBox.add_actor(appCategory.actor);
        }
      }
    }

    // Load 'places' category
    this.placesCategory = new CategoryListButton('places', _('Places'), 'folder');
    this.placesCategory.setButtonEnterCallback(Lang.bind(this, function() {
      this.placesCategory.actor.add_style_pseudo_class('hover');
      this.selectedAppTitle.set_text(this.placesCategory.label.get_text());
      this.selectedAppDescription.set_text('');

      if (this.placesCategory._ignoreHoverSelect) {
        return;
      }

      if (this._applet.categorySelectionMethod == SelectMethod.HOVER) {
        let hoverDelay = this._applet.categoryHoverDelay;
        this._hoverTimeoutId = Mainloop.timeout_add((hoverDelay > 0) ? hoverDelay : 0, Lang.bind(this,
          function() {
            this._selectAllPlaces(this.placesCategory);
            this._hoverTimeoutId = 0;
          }));
      }
    }));
    this.placesCategory.setButtonLeaveCallback(Lang.bind(this, function() {
      this.placesCategory.actor.remove_style_pseudo_class('hover');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');

      if (this._applet.categorySelectionMethod == SelectMethod.HOVER) {
        if (this._hoverTimeoutId > 0) {
          Mainloop.source_remove(this._hoverTimeoutId);
        }
      }
    }));
    this.placesCategory.setButtonReleaseCallback(Lang.bind(this, function() {
      this._selectAllPlaces(this.placesCategory);
      this.selectedAppTitle.set_text(this.placesCategory.label.get_text());
      this.selectedAppDescription.set_text('');
    }));
    this.categoriesBox.add_actor(this.placesCategory.actor);

    // Load 'recent' category
    if (recentEnabled) {
      this.recentCategory = new CategoryListButton('recent', _('Recent'), 'folder-recent');
      this.recentCategory.setButtonEnterCallback(Lang.bind(this, function() {
        this.recentCategory.actor.add_style_pseudo_class('hover');
        this.selectedAppTitle.set_text(this.recentCategory.label.get_text());
        this.selectedAppDescription.set_text('');

        if (this.recentCategory._ignoreHoverSelect) {
          return;
        }

        if (this._applet.categorySelectionMethod == SelectMethod.HOVER) {
          let hoverDelay = this._applet.categoryHoverDelay;
          this._hoverTimeoutId = Mainloop.timeout_add((hoverDelay > 0) ? hoverDelay : 0, Lang.bind(this,
            function() {
              this._selectRecent(this.recentCategory);
              this._hoverTimeoutId = 0;
            }));
        }
      }));
      this.recentCategory.setButtonLeaveCallback(Lang.bind(this, function() {
        this.recentCategory.actor.remove_style_pseudo_class('hover');
        this.selectedAppTitle.set_text('');
        this.selectedAppDescription.set_text('');

        if (this._applet.categorySelectionMethod == SelectMethod.HOVER) {
          if (this._hoverTimeoutId > 0) {
            Mainloop.source_remove(this._hoverTimeoutId);
          }
        }
      }));
      this.recentCategory.setButtonPressCallback(Lang.bind(this, function() {
        this.recentCategory.actor.add_style_class_name('menu-category-button-selected');
      }));
      this.recentCategory.setButtonReleaseCallback(Lang.bind(this, function() {
        this.recentCategory.actor.remove_style_class_name('menu-category-button-selected');
        this._selectRecent(this.recentCategory);
        this.selectedAppTitle.set_text(this.recentCategory.label.get_text());
        this.selectedAppDescription.set_text('');
      }));
      this.categoriesBox.add_actor(this.recentCategory.actor);
    }

    // Load 'bookmarks' category
    this.webBookmarksCategory = new CategoryListButton('bookmarks', _('Bookmarks'), 'emblem-favorite');
    this.webBookmarksCategory.setButtonEnterCallback(Lang.bind(this, function() {
      this.webBookmarksCategory.actor.add_style_pseudo_class('hover');
      this.selectedAppTitle.set_text(this.webBookmarksCategory.label.get_text());
      this.selectedAppDescription.set_text('');

      if (this.webBookmarksCategory._ignoreHoverSelect) {
        return;
      }

      if (this._applet.categorySelectionMethod == SelectMethod.HOVER) {
        let hoverDelay = this._applet.categoryHoverDelay;
        this._hoverTimeoutId = Mainloop.timeout_add((hoverDelay > 0) ? hoverDelay : 0, Lang.bind(this,
          function() {
            this._selectWebBookmarks(this.webBookmarksCategory);
            this._hoverTimeoutId = 0;
          }));
      }
    }));
    this.webBookmarksCategory.setButtonLeaveCallback(Lang.bind(this, function() {
      this.webBookmarksCategory.actor.remove_style_pseudo_class('hover');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');

      if (this._applet.categorySelectionMethod == SelectMethod.HOVER) {
        if (this._hoverTimeoutId > 0) {
          Mainloop.source_remove(this._hoverTimeoutId);
        }
      }
    }));
    this.webBookmarksCategory.setButtonPressCallback(Lang.bind(this, function() {
      this.webBookmarksCategory.actor.add_style_class_name('menu-category-button-selected');
    }));
    this.webBookmarksCategory.setButtonReleaseCallback(Lang.bind(this, function() {
      this.webBookmarksCategory.actor.remove_style_class_name('menu-category-button-selected');
      this._selectWebBookmarks(this.webBookmarksCategory);
      this.selectedAppTitle.set_text(this.webBookmarksCategory.label.get_text());
      this.selectedAppDescription.set_text('');
    }));
    this.categoriesBox.add_actor(this.webBookmarksCategory.actor);

    // PowerGroupBox
    this.powerGroupBox = new St.BoxLayout({
      style_class: ''
    });

    let lockScreen = new GroupButton(this, 'system-lock-screen', 16, null, {
      style_class: 'menu-favorites-button'
    });
    lockScreen.setButtonEnterCallback(Lang.bind(this, function() {
      lockScreen.actor.add_style_class_name('selected');
      this.selectedAppTitle.set_text(_('Lock Screen'));
      this.selectedAppDescription.set_text('');
    }));
    lockScreen.setButtonLeaveCallback(Lang.bind(this, function() {
      lockScreen.actor.remove_style_class_name('selected');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
    }));
    lockScreen.setButtonPressCallback(Lang.bind(this, function() {
      lockScreen.actor.add_style_pseudo_class('pressed');
    }));
    lockScreen.setButtonReleaseCallback(Lang.bind(this, function() {
      this.menu.close();

      let screensaver_settings = new Gio.Settings({
        schema_id: 'org.cinnamon.desktop.screensaver'
      });
      let screensaver_dialog = Gio.file_new_for_path('/usr/bin/cinnamon-screensaver-command');
      if (screensaver_dialog.query_exists(null)) {
        if (screensaver_settings.get_boolean('ask-for-away-message')) {
          Util.spawnCommandLine('cinnamon-screensaver-lock-dialog');
        } else {
          Util.spawnCommandLine('cinnamon-screensaver-command --lock');
        }
      } else {
        this._screenSaverProxy.LockRemote('');
      }
    }));
    let logoutUser = new GroupButton(this, 'application-exit', 16, null, {
      style_class: 'menu-favorites-button'
    });
    logoutUser.setButtonEnterCallback(Lang.bind(this, function() {
      logoutUser.actor.add_style_class_name('selected');
      this.selectedAppTitle.set_text(_('Logout User'));
      this.selectedAppDescription.set_text('');
    }));
    logoutUser.setButtonLeaveCallback(Lang.bind(this, function() {
      logoutUser.actor.remove_style_class_name('selected');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
    }));
    logoutUser.setButtonPressCallback(Lang.bind(this, function() {
      logoutUser.actor.add_style_pseudo_class('pressed');
    }));
    logoutUser.setButtonReleaseCallback(Lang.bind(this, function() {
      // code to logout user
      logoutUser.actor.remove_style_pseudo_class('pressed');
      logoutUser.actor.remove_style_class_name('selected');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
      this.menu.close();
      this._session.LogoutRemote(0);
    }));
    let systemShutdown = new GroupButton(this, 'system-shutdown', 16, null, {
      style_class: 'menu-favorites-button'
    });
    systemShutdown.setButtonEnterCallback(Lang.bind(this, function() {
      systemShutdown.actor.add_style_class_name('selected');
      this.selectedAppTitle.set_text(_('Shutdown'));
      this.selectedAppDescription.set_text('');
    }));
    systemShutdown.setButtonLeaveCallback(Lang.bind(this, function() {
      systemShutdown.actor.remove_style_class_name('selected');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
    }));
    systemShutdown.setButtonPressCallback(Lang.bind(this, function() {
      systemShutdown.actor.add_style_pseudo_class('pressed');
    }));
    systemShutdown.setButtonReleaseCallback(Lang.bind(this, function() {
      // code to shutdown (power off)
      // ToDo: GS38 itterates through SystemLoginSession to check for open sessions
      // and displays an openSessionWarnDialog
      systemShutdown.actor.remove_style_pseudo_class('pressed');
      systemShutdown.actor.remove_style_class_name('selected');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
      this.menu.close();
      this._session.ShutdownRemote();
    }));

    this.powerGroupBox.add(lockScreen.actor, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this.powerGroupBox.add(logoutUser.actor, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this.powerGroupBox.add(systemShutdown.actor, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    // ApplicationsBox (ListView / GridView)
    this.applicationsScrollBox = new St.ScrollView({
      x_fill: true,
      y_fill: false,
      y_align: St.Align.START,
      style_class: 'vfade menu-applications-scrollbox'
    });
    let vscrollApplications = this.applicationsScrollBox.get_vscroll_bar();
    vscrollApplications.connect('scroll-start', Lang.bind(this, function() {
      this.menu.passEvents = true;
    }));
    vscrollApplications.connect('scroll-stop', Lang.bind(this, function() {
      this.menu.passEvents = false;
    }));

    this.applicationsListBox = new St.BoxLayout({
      style_class: '',
      vertical: true,
      x_expand: true
    }); // TBD
    this.applicationsGridBox = new St.Widget({
      layout_manager: new Clutter.TableLayout(),
      reactive: true,
      style_class: ''
    }); //cinnamenu-applications-grid-box
    this.applicationsBoxWrapper = new St.BoxLayout({
      style_class: ''
    }); // TBD
    this.applicationsBoxWrapper.add(this.applicationsGridBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });
    this.applicationsBoxWrapper.add(this.applicationsListBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });
    this.applicationsScrollBox.add_actor(this.applicationsBoxWrapper);
    this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
    this.applicationsScrollBox.set_mouse_scrolling(true);

    // Place boxes in proper containers. The order added determines position
    // ----------------------------------------------------------------------

    // topPane packs horizontally
    this.topPane.add(this.searchBox, {
      expand: false,
      x_align: St.Align.END,
      y_align: St.Align.MIDDLE
    });
    this.topPane.add(this.viewModeBoxWrapper, {
      x_align: St.Align.START,
      y_align: St.Align.MIDDLE
    });

    this.groupCategoriesWorkspacesWrapper.add(this.categoriesBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });
    this.groupCategoriesWorkspacesScrollBox.add_actor(this.groupCategoriesWorkspacesWrapper);

    if (this._applet.hideCategories) {
      this.groupCategoriesWorkspacesWrapper.hide();

    }

    // middlePane packs horizontally
    middlePane.add(this.groupCategoriesWorkspacesScrollBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });
    middlePane.add(this.applicationsScrollBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });
    middlePane.add(this.shortcutsScrollBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });

    // bottomPane packs horizontally
    let bottomPaneSpacer1 = new St.Label({
      text: ''
    });
    this.bottomPane.add(this._dummyButton);
    this.bottomPane.add(this._dummyButton2);
    this.bottomPane.add(this.powerGroupBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });
    this.bottomPane.add(bottomPaneSpacer1, {
      expand: true,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this.bottomPane.add(this.selectedAppBox, {
      expand: true,
      x_align: St.Align.END,
      y_align: St.Align.MIDDLE
    });

    // mainbox packs vertically
    this.mainBox.add_actor(this.topPane);
    this.mainBox.add_actor(middlePane);
    this.mainBox.add_actor(this.bottomPane);

    // add all to section
    section.actor.add_actor(this.mainBox);

    // add section as menu item
    this.menu.addMenuItem(section);
    this.menu.addMenuItem(this._dummySeparator);

    // Set height constraints on scrollboxes (we also set height when menu toggle)
    /*this.applicationsScrollBox.add_constraint(new Clutter.BindConstraint({
      name: 'appScrollBoxConstraint',
      source: this.groupCategoriesWorkspacesScrollBox,
      coordinate: Clutter.BindCoordinate.HEIGHT,
      offset: 0
    }));
    this.shortcutsScrollBox.add_constraint(new Clutter.BindConstraint({
      name: 'shortcutsScrollBoxConstraint',
      source: this.groupCategoriesWorkspacesScrollBox,
      coordinate: Clutter.BindCoordinate.HEIGHT,
      offset: 0
    }));
*/
    this._widthCategoriesBox = this.categoriesBox.width;
  }
};

/* =========================================================================
/* name:    CinnamenuButton
 * @desc    The main panel object that holds view/apps/menu buttons
 * ========================================================================= */

function CinnamenuButton(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id)
}

CinnamenuButton.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _init: function(metadata, orientation, panel_height, instance_id) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
    this.state = {};
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    this.orientation = orientation;
    this._uuid = metadata.uuid;
    this.settings = new Settings.AppletSettings(this, this._uuid, instance_id);

    this._appletEnterEventId = 0;
    this._appletLeaveEventId = 0;
    this._appletHoverDelayId = 0;

    this.appSystem = Cinnamon.AppSystem.get_default();

    this.privacy_settings = new Gio.Settings({
      schema_id: PRIVACY_SCHEMA
    });
    this.privacy_settings.connect('changed::' + REMEMBER_RECENT_KEY, Lang.bind(this, this.refresh));

    // Bind Preference Settings
    this._bindSettingsChanges();

    this._updateActivateOnHover();

    this._updateKeybinding();

    Main.themeManager.connect('theme-set', Lang.bind(this, this._updateIconAndLabel));
    this._updateIconAndLabel();

    // Connect gtk icontheme for when icons change
    this._iconsChangedId = IconTheme.get_default().connect('changed', Lang.bind(this, this._onIconsChanged));

    // Connect to AppSys for when new application installed
    this._installedChangedId = this.appSystem.connect('installed-changed', Lang.bind(this, this._onAppInstalledChanged));

    // Connect to AppFavorites for when favorites change
    this._favoritesChangedId = AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._onFavoritesChanged));

    this._setHotSpotTimeoutId = 0;
    this._display();
  },

  update_label_visible: function() {
    if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
      this.hide_applet_label(true);
    } else {
      this.hide_applet_label(false);
    }
  },

  on_orientation_changed: function(orientation) {
    this.orientation = orientation;

    this.update_label_visible();

    this.appsMenuButton.menu.destroy();
    this.refresh();
    this._updateIconAndLabel();
  },

  on_applet_removed_from_panel: function() {
    Main.keybindingManager.removeHotKey('overlay-key-' + this.instance_id)
  },

  on_applet_clicked: function(event) {
    this.menu.toggle_with_options(this.enableAnimation);
  },

  _updateKeybinding: function() {
    Main.keybindingManager.addHotKey('overlay-key-' + this.instance_id, this.overlayKey, Lang.bind(this, function() {
      if (!Main.overview.visible && !Main.expo.visible) {
        this.menu.toggle_with_options(this.enableAnimation);
      }
    }));
  },

  _updateIconAndLabel: function() {
    try {
      if (this.menuIconCustom) {
        if (this.menuIcon === '') {
          this.set_applet_icon_name('');
        } else if (GLib.path_is_absolute(this.menuIcon) && GLib.file_test(this.menuIcon, GLib.FileTest.EXISTS)) {
          if (this.menuIcon.search('-symbolic') != -1) {
            this.set_applet_icon_symbolic_path(this.menuIcon);
          } else {
            this.set_applet_icon_path(this.menuIcon);
          }
        } else if (Gtk.IconTheme.get_default().has_icon(this.menuIcon)) {
          if (this.menuIcon.search('-symbolic') != -1) {
            this.set_applet_icon_symbolic_name(this.menuIcon);
          } else {
            this.set_applet_icon_name(this.menuIcon);
          }
        }
      } else {
        this._set_default_menu_icon();
      }
    } catch (e) {
      global.logWarning('Could not load icon file ' + this.menuIcon + ' for menu button');
    }

    if (this.menuIconCustom && this.menuIcon === '') {
      this._applet_icon_box.hide();
    } else {
      this._applet_icon_box.show();
    }

    if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) // no menu label if in a vertical panel
    {
      this.set_applet_label('');
    } else {
      if (this.panelMenuLabelText !== '') {
        this.set_applet_label(_(this.menuLabel)); // TBD
      } else {
        this.set_applet_label('');
      }
    }
  },

  _set_default_menu_icon: function() {
    let path = global.datadir + '/theme/menu.svg';
    if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
      this.set_applet_icon_path(path);
      return;
    }

    path = global.datadir + '/theme/menu-symbolic.svg';
    if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
      this.set_applet_icon_symbolic_path(path);
      return;
    }
    /* If all else fails, this will yield no icon */
    this.set_applet_icon_path('');
  },

  refresh: function() {
    this._clearAll();
    this._display();
  },

  _clearAll: function() {
    if (this.appsMenuButton) {
      this.actor.remove_actor(this.appsMenuButton.actor);
    }

    if (this.appsMenuButton) {
      this.appsMenuButton.destroy();
    }
    this.appsMenuButton = null;
  },

  _display: function() {
    // Initialize apps menu button
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, this.orientation);
    this.menuManager.addMenu(this.menu);
    this.menu.setCustomStyleClass('menu-background');
    this.appsMenuButton = new PanelMenuButton(this);
  },

  openMenu: function() {
    if (!this._applet_context_menu.isOpen) {
      this.menu.open(this.enableAnimation);
    }
  },

  _clearDelayCallbacks: function() {
    if (this._appletHoverDelayId > 0) {
      Mainloop.source_remove(this._appletHoverDelayId);
      this._appletHoverDelayId = 0;
    }
    if (this._appletLeaveEventId > 0) {
      this.actor.disconnect(this._appletLeaveEventId);
      this._appletLeaveEventId = 0;
    }

    return false;
  },

  _updateActivateOnHover: function() {
    if (this._appletEnterEventId > 0) {
      this.actor.disconnect(this._appletEnterEventId);
      this._appletEnterEventId = 0;
    }

    this._clearDelayCallbacks();

    if (this.activateOnHover) {
      this._appletEnterEventId = this.actor.connect('enter-event', Lang.bind(this, function() {
        if (this.hover_delay_ms > 0) {
          this._appletLeaveEventId = this.actor.connect('leave-event', Lang.bind(this, this._clearDelayCallbacks));
          this._appletHoverDelayId = Mainloop.timeout_add(this.hover_delay_ms,
            Lang.bind(this, function() {
              this.openMenu();
              this._clearDelayCallbacks();
            }));
        } else {
          this.openMenu();
        }
      }));
    }
  },

  // handler for when new application installed
  _onAppInstalledChanged: function() {
    if (this.appsMenuButton) {
      this.appsMenuButton.refresh();
    }
  },

  // handler for when favorites change
  _onFavoritesChanged: function() {
    if (this.appsMenuButton) {
      this.appsMenuButton.refresh();
    }
  },

  // handler for when icons change
  _onIconsChanged: function() {
    if (this.appsMenuButton) {
      this.appsMenuButton.refresh();
    }
  },

  // function to bind preference setting changes
  _bindSettingsChanges: function() {
    var settingsProps = [{
        key: 'menu-icon-custom',
        value: 'menuIconCustom',
        cb: this._updateIconAndLabel
      },
      {
        key: 'menu-icon',
        value: 'menuIcon',
        cb: this._updateIconAndLabel
      },
      {
        key: 'activate-on-hover',
        value: 'activateOnHover',
        cb: this._updateActivateOnHover
      },
      {
        key: 'hover-delay',
        value: 'hover_delay_ms',
        cb: this._updateActivateOnHover
      },
      {
        key: 'overlay-key',
        value: 'overlayKey',
        cb: this._updateKeybinding
      },
      {
        key: 'enable-animation',
        value: 'enableAnimation',
        cb: null
      },
      {
        key: 'menu-label',
        value: 'menuLabel',
        cb: this._updateIconAndLabel
      },
      {
        key: 'hide-useroptions',
        value: 'hideUserOptions',
        cb: Lang.bind(this, function() {
          if (this.appsMenuButton) {
            this.appsMenuButton.refresh();
          }
        })
      },
      {
        key: 'hide-shortcuts',
        value: 'hideShortcuts',
        cb: Lang.bind(this, function() {
          if (this.appsMenuButton) {
            this.appsMenuButton.refresh();
          }
        })
      },
      {
        key: 'shortcuts-display',
        value: 'shortcutsDisplay',
        cb: Lang.bind(this, function() {
          if (this.appsMenuButton) {
            this.appsMenuButton.refresh();
          }
        })
      },
      {
        key: 'startup-view-mode',
        value: 'startupViewMode',
        cb: null
      },
      {
        key: 'apps-grid-column-count',
        value: 'appsGridColumnCount',
        cb: Lang.bind(this, function() {
          if (this.appsMenuButton) {
            this.appsMenuButton.refresh();
          }
        })
      },
      {
        key: 'hide-categories',
        value: 'hideCategories',
        cb: Lang.bind(this, function() {
          if (this.appsMenuButton) {
            this.appsMenuButton.refresh();
          }
        })
      },
      {
        key: 'category-selection-method',
        value: 'categorySelectionMethod',
        cb: Lang.bind(this, function() {
          if (this.appsMenuButton) {
            this.appsMenuButton.refresh();
          }
        })
      },
      {
        key: 'category-hover-delay',
        value: 'categoryHoverDelay',
        cb: null
      },
      {
        key: 'shortcuts-icon-size',
        value: 'shortcutsIconSize',
        cb: Lang.bind(this, function() {
          if (this.appsMenuButton) {
            this.appsMenuButton.refresh();
          }
        })
      },
      {
        key: 'shortcuts-label',
        value: 'shortcutsLabel',
        cb: Lang.bind(this, function() {
          if (this.appsMenuButton) {
            this.appsMenuButton.refresh();
          }
        })
      },
      {
        key: 'apps-list-icon-size',
        value: 'appsListIconSize',
        cb: null
      },
      {
        key: 'apps-grid-icon-size',
        value: 'appsGridIconSize',
        cb: null
      },
      {
        key: 'apps-grid-label-width',
        value: 'appsGridLabelWidth',
        cb: null
      },
    ]

    for (let i = 0, len = settingsProps.length; i < len; i++) {
      this.settings.bind(settingsProps[i].key, settingsProps[i].value, settingsProps[i].cb);
    }
  },

  // function to destroy CinnamenuButton
  destroy: function() {
    // Disconnect global signals
    if (this._installedChangedId) {
      this.appSystem.disconnect(this._installedChangedId);
    }

    if (this._favoritesChangedId) {
      AppFavorites.getAppFavorites().disconnect(this._favoritesChangedId);
    }

    if (this._iconsChangedId) {
      IconTheme.get_default().disconnect(this._iconsChangedId);
    }

    if (this._themeChangedId) {
      St.ThemeContext.get_for_stage(global.stage).disconnect(this._themeChangedId);
    }

    if (this._overviewShownId) {
      Main.overview.disconnect(this._overviewShownId);
    }

    if (this._overviewHiddenId) {
      Main.overview.disconnect(this._overviewHiddenId);
    }

    if (this._overviewPageChangedId) {
      Main.overview.disconnect(this._overviewPageChangedId);
    }

    // Destroy main clutter actor: this should be sufficient
    // From clutter documentation:
    // If the actor is inside a container, the actor will be removed.
    // When you destroy a container, its children will be destroyed as well.
    this.actor.destroy();
  }

};

function main(metadata, orientation, panel_height, instance_id) {
  return new CinnamenuButton(metadata, orientation, panel_height, instance_id);
}