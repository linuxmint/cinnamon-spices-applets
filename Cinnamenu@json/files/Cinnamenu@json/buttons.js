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
 * @param {string|object} dir
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

    this.actor.set_style_class_name('menu-category-button');
    this.actor._delegate = this;
    let iconSize = _parent.categoryIconSize;

    this._dir = dir;
    let isStrDir = typeof dir === 'string';
    let dirName = !isStrDir ? dir.get_name() : null;
    let categoryNameText = isStrDir ? altNameText : dirName ? dirName : '';
    this.disabled = false;
    this.entered = null;

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

  handleEnter: function (actor, event) {
    if (this.disabled) {
      return false;
    }

    if (event) {
      this._parent._clearEnteredActors();
    }

    this.entered = true;
    this.actor.set_style_class_name('menu-category-button-selected');

    if (!this._parent.showAppDescriptionsOnButtons) {
      this._parent.selectedAppTitle.set_text(this.categoryNameText);
      this._parent.selectedAppDescription.set_text('');
    }

    Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, Lang.bind(this, function() {
      this._parent[this.selectorMethod](this, null);
    }));
    return true;
  },

  handleLeave: function () {
    if (this.disabled) {
      return false;
    }
    this.entered = null;
    this._parent._currentCategory = this.categoryNameText;
    this.actor.set_style_class_name('menu-category-button');
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
    this.entered = null;
  },

  enable: function () {
    this.actor.set_style_class_name('menu-category-button');
    this.disabled = false;
  },

  _onKeyFocusIn: function () {
    global.stage.set_key_focus(this._parent.searchEntry);
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
      focusOnHover: false,
    });
    this.actor._delegate = this;
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
    this.actor.connect('enter-event', Lang.bind(this, this.handleEnter));
    this.actor.connect('leave-event', Lang.bind(this, this.handleLeave));
  },

  handleEnter: function (actor, event) {
    this.entered = true;
    this.actor.add_style_pseudo_class('active');
  },

  handleLeave: function () {
    this.entered = null;
    this.actor.remove_style_pseudo_class('active');
  },

  _onKeyFocusIn: function () {
    global.stage.set_key_focus(this.appButton._parent.searchEntry);
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
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function(_parent, app, appType, appIndex, appListLength) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false,
      activate: false
    });

    this._parent = _parent;
    this.actor._delegate = this;

    this.app = app;
    this.appType = appType;
    this.appIndex = appIndex;
    this.appListLength = appListLength;
    this.isStrApp = typeof app === 'string';
    this._stateChangedId = 0;
    this.column = null;
    let className = 'menu-application-button';
    this.entered = null;
    this.onStage = null;

    if (this._parent.isListView) {
      this._iconSize = (this._parent.appsListIconSize > 0) ? this._parent.appsListIconSize : 28;
      this._iconContainer = new St.BoxLayout({
        vertical: true
      });
    } else {
      this._iconSize = this._parent.appsGridIconSize > 0 ? this._parent.appsGridIconSize : 64;
    }

    this.actor.set_style_class_name(className);
    this.actor.x_align = this._parent.isListView ? St.Align.START : St.Align.MIDDLE;
    this.actor.y_align = St.Align.MIDDLE;

    if (!this._parent.isListView) {
      this.actor.width = this._parent.applicationsGridBox.width / this._parent.appsGridColumnCount;
    }

    // appType 0 = application, appType 1 = place, appType 2 = recent
    // Filesystem autocompletion
    if (this.isStrApp) {
      if (app.charAt(0) === '~') {
        app = app.slice(1);
        app = GLib.get_home_dir() + app;
      }
      const name = app;
      let contentType = Gio.content_type_guess(name, null);
      this.isPath = app[0] === '/';
      this.app = {
        name: name,
        description: name,
        uri: name,
        icon: Gio.content_type_get_icon(contentType[0])
      };
      this.appType = ApplicationType._places;
      this.file = Gio.file_new_for_path(this.app.name);
      try {
        this.handler = this.file.query_default_handler(null);
      } catch (e) {
        this.handler = null;
      }
    }
    // Don't show protocol handlers
    if (this.app.description) {
      let slice = this.app.description.slice(0, 7);
      if (slice === 'https://' || slice === 'http://' || slice === 'file://') {
        this.app.description = this.app.description.slice(7);
      }
      if (this.app.description.slice(-1) === '/') {
        this.app.description = this.app.description.slice(0, -1);
      }
    } else {
      this.app.description = this._parent.fallbackDescription;
    }
    // Icons
    if (this._parent.showApplicationIcons) {
      if (this.appType === ApplicationType._applications) {
        this.icon = this.app.create_icon_texture(this._iconSize);
      } else if (this.appType === ApplicationType._places) {
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
      } else if (this.appType === ApplicationType._recent) {
        if (this.app.clearList) {
          this.icon = this.app.icon;
          this.icon.set_icon_size(this._iconSize);
        } else {
          this.icon = new St.Icon({
          gicon: this.app.icon,
          icon_size: this._iconSize
        });
      }

      }
      if (!this.icon) {
        this.icon = new St.Icon({
          icon_name: 'error',
          icon_size: this._iconSize,
          icon_type: St.IconType.FULLCOLOR
        });
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
      vertical: !this._parent.isListView,
      width: 250
    });
    let iconDotContainer = this._parent.isListView ? '_iconContainer' : 'buttonBox';
    if (this.icon) {
      this[iconDotContainer].add(this.icon, {
        x_fill: false,
        y_fill: false,
        x_align: this._parent.isListView ? St.Align.END : St.Align.MIDDLE,
        y_align: this._parent.isListView ? St.Align.END : St.Align.START
      });
    }
    if (this._parent.isListView) {
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
      x_align: this._parent.isListView ? St.Align.START : St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this[iconDotContainer].add(this.dot, {
      x_fill: false,
      y_fill: true,
      x_align: this._parent.isListView ? St.Align.END : St.Align.MIDDLE,
      y_align: this._parent.isListView ? St.Align.END : St.Align.START
    });
    this.addActor(this.buttonBox);

    if (this.icon) {
      this.icon.realize();
    }
    if (this._parent.showAppDescriptionsOnButtons
      || this.app.shouldHighlight) {
      this.formatLabel({});
    }
    //this.label.realize();

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

  handleParentChange: function (actor) {
    this.onStage = true;

    // Context menu
    if (this.appType === ApplicationType._applications) {
      this.menu = new PopupMenu.PopupSubMenu(this.actor);
      this.menu.actor.set_style_class_name('menu-context-menu');
      if (this._parent.theme) {
        this.menu.box.set_style('background-color: ' + this._parent.theme.backgroundColor + '; border: 1px solid' + this._parent.theme.borderColor
        + '; border-radius: ' + this._parent.theme.borderRadius + 'px; padding-top: ' + this._parent.theme.padding + 'px; padding-bottom: ' + this._parent.theme.padding + 'px;');
      }
      this.menu.isOpen = false;
      this.buttonBox.add_child(this.menu.actor);
    } else {
      this.menu = {
        isOpen: false
      };
    }

    if (this._parent.showAppDescriptionsOnButtons
      || this.app.shouldHighlight
      || this._parent.searchActive) {
      this.formatLabel({});
    }
    if (!this.app.description) {
      this.app.description = this._parent.fallbackDescription;
    }
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
      if (!this._parent.isListView) {
        let width = this.description ? this.description.length : this.app.description.length;
        this.label.set_style('text-align: center;min-width: ' + width.toString() + 'px;');
      }
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
    if (clutterText
      && (this._parent.showAppDescriptionsOnButtons
        || this._parent.searchActive
        || this.app.shouldHighlight)
        || opts.removeFormatting) {
      clutterText.set_markup(markup);
      clutterText.ellipsize = Pango.EllipsizeMode.END;
    }
  },

  handleMarquee: function (opts) {
    // TODO - Figure out how to do this in RTL locales
    if (!this.app) {
      if (this.marqueeTimer) {
        clearTimeout(this.marqueeTimer);
      }
      return false;
    }
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

  _onKeyFocusIn: function () {
    global.stage.set_key_focus(this._parent.searchEntry);
  },

  handleEnter: function (actor, event) {
    if (this._parent.menuIsOpen || this.menu.isOpen) {
      return false;
    }

    if (event) {
      this._parent._clearEnteredActors();
    } else {
      this._parent._scrollToButton(this);
    }

    this.entered = true;

    this.actor.set_style_class_name('menu-application-button-selected');

    // Check marquee conditions, and set it up
    let labelWidth, actorWidth, allocatedTextLength;
    if (this._parent.showAppDescriptionsOnButtons) {
      labelWidth = this.label.get_size()[0];
      actorWidth = this.actor.get_size()[0];
      allocatedTextLength = this._parent.isListView ? 41 : actorWidth / (this._parent.appsGridColumnCount * 2);
    } else {
      this.formatLabel({});
      labelWidth = this.app.description.length;
      actorWidth = 16;
      allocatedTextLength = 16;
    }
    if (labelWidth > actorWidth) {
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
    return false;
  },

  handleLeave: function () {
    if (this._parent.menuIsOpen === this.appIndex && this.menu.isOpen) {
      return false;
    }

    this.entered = null;
    this.actor.set_style_class_name('menu-application-button');
    if (this.description) {
      this.app.description = this.description;
      this.formatLabel({});
      if (!this._parent.menuIsOpen && this.marqueeTimer) {
        clearTimeout(this.marqueeTimer);
        this.marqueeTimer = null;
      }
    }
    if (!this._parent.showAppDescriptionsOnButtons) {
      this._parent.selectedAppTitle.set_text('');
      this._parent.selectedAppDescription.set_text('');
    }
  },

  _onButtonReleaseEvent: function(actor, e){
    let button = e.get_button();
    if (button === 1) {
      if (this.menuIsOpen) {
        if (this.menu.isOpen && this.menu._activeMenuItem) {
          this.menu._activeMenuItem.activate();
        } else {
          this.menu.close();
        }
        return false;
      }
      this.activate(e);
    } else if (button === 3) {
      // Prevent the menu from clipping if this button is partially visible.
      if (!this._parent.isListView && this._parent._isNotInScrollView(this)) {
        let [x, y] = this.menu.actor.get_position();
        y = -100;
        this.menu.actor.set_position(x, y);
      }
      this.activateContextMenus(e);
    }
    return true;
  },

  activate: function () {
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
      if (this.app.clearList) {
        this._parent.recentManager.purge_items();
      } else {
        Gio.app_info_launch_default_for_uri(this.app.uri, global.create_app_launch_context());
      }
    }
    this._parent.menu.close();
  },

  activateContextMenus: function (event) {
    if (!this.menu.isOpen) {
      // Make sure all other context menus are closed before toggle.
      let children = this._parent._activeContainer.get_children();
      for (let i = 0, len = children.length; i < len; i++) {
        if (children[i]._delegate.appIndex !== this.appIndex) {
          children[i]._delegate.closeMenu();
          children[i]._delegate.handleLeave(true);
        }
      }
    }
    this.toggleMenu();
  },

  setColumn: function(column) {
    if (this.appType !== ApplicationType._applications) {
      return false;
    }
    this.column = column;
    let x = 0, y = 50;
    if ((column === 0 || column === this.appListLength)
      && this.appListLength > 1) {
      x = -90
    } else if (column === this._parent.appsGridColumnCount) {
      x = 160
    }
    this.menu.actor.set_position(x, y);
  },

  _onStateChanged: function () {
    if (!this.app) {
      return false;
    }
    if (this.appType === ApplicationType._applications) {
      if (this.app.state !== Cinnamon.AppState.STOPPED) {
        this.dot.opacity = 255;
      } else {
        this.dot.opacity = 0;
      }
    }
    return true;
  },

  closeMenu: function () {
    if (this.menu.menuIsOpen) {
      this.menu.toggleMenu();
    }
  },

  toggleMenu: function (fromClear) {
    if (this.appType !== ApplicationType._applications) {
      return false;
    }

    if (!this.menu.isOpen) {
      if (!fromClear) {
        this._parent._clearEnteredActors();
      }
      let children = this.menu.box.get_children();
      for (var i = 0, len = children.length; i < len; i++) {
        this.menu.box.remove_actor(children[i]);
      }
      this._parent.menuIsOpen = this.appIndex;
      this.actor.set_style_class_name('menu-application-button-selected');

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

      // In grid mode we will ensure our menu isn't overlapped by any other actors.
      if (!this._parent.isListView) {
        this.actor.raise_top();
      }
    } else {
      if (!this._parent.isListView) {
        // Reset the actor depth.
        this._parent.applicationsGridBox.set_child_at_index(this.actor, this.appIndex);
      }
      // Allow other buttons hover functions to take effect.
      this._parent.menuIsOpen = null;
      //this.actor.set_style_class_name('menu-application-button');
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
    if (this.menu.box) {
      this.menu.destroy();
    }
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
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,


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
    this.actor.style = 'padding-top: ' + (adjustedIconSize / 3) + 'px;padding-bottom: ' + (adjustedIconSize / 3) + 'px;';
    this.actor.add_style_class_name('menu-favorites-button');
    this.actor._delegate = this;
    this.entered = null;

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
    this.actor.connect('enter-event', Lang.bind(this, this.handleEnter));
    this.actor.connect('leave-event', Lang.bind(this, this.handleLeave));
    this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
  },

  _onButtonReleaseEvent: function () {
    this._parent.menu.close();
    this.buttonReleaseCallback();
  },

  handleEnter: function (actor) {
    if (actor) {
      this._parent._clearEnteredActors();
    }
    this.entered = true;
    this.actor.add_style_pseudo_class('hover');
    this._parent.selectedAppTitle.set_text(this.name);
    this._parent.selectedAppDescription.set_text(this.description);
  },

  handleLeave: function () {
    this.entered = null;
    this.actor.remove_style_pseudo_class('hover');
    this._parent.selectedAppTitle.set_text('');
    this._parent.selectedAppDescription.set_text('');
  },

  destroy: function() {
    this.label.destroy();
    if (this.icon) {
      this.icon.destroy();
    }
    this._parent.selectedAppTitle.set_text('');
    this._parent.selectedAppDescription.set_text('');
    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
  },
};
