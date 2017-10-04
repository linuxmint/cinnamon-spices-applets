const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Pango = imports.gi.Pango;
const AccountsService = imports.gi.AccountsService;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const SignalManager = imports.misc.signalManager;
const Mainloop = imports.mainloop;
const AppletDir = imports.ui.appletManager.applets['Cinnamenu@json'];
const store = AppletDir.store;
const setTimeout = AppletDir.utils.setTimeout;
const clearTimeout = AppletDir.utils.clearTimeout;
const isString = AppletDir.utils.isString;
const unref = AppletDir.utils.unref;
const _ = AppletDir.constants._;
const ApplicationType = AppletDir.constants.ApplicationType;

const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();

/**
 * @name CategoryListButton
 * @description A button with an icon that holds category info
 *
 * @param {object} state
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

  _init: function(state, dir, altNameText, altIconName, selectorMethod) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false,
      activate: false
    });
    this.state = state;
    this.signals = new SignalManager.SignalManager(null);
    if (!selectorMethod) {
      selectorMethod = '_selectCategory';
    }
    this.selectorMethod = selectorMethod;
    this.actor.set_style_class_name('menu-category-button');

    this._dir = dir;
    let isStrDir = typeof dir === 'string';
    let dirName = !isStrDir ? dir.get_name() : null;
    let categoryNameText = isStrDir ? altNameText : dirName ? dirName : '';
    this.disabled = false;
    this.entered = null;

    if (this.state.settings.showCategoryIcons) { // SETTING
      let icon;
      if (!isStrDir) {
        icon = dir.get_icon();
        if (icon && icon.get_names) {
          this.icon_name = icon.get_names().toString();
        } else {
          this.icon_name = '';
        }
        if (this.icon_name) {
          this.icon = St.TextureCache.get_default().load_gicon(null, icon, this.state.settings.categoryIconSize);
        } else {
          icon = dir.get_icon() && typeof dir.get_icon().get_names === 'function' ? dir.get_icon().get_names().toString() : 'error';
          this.icon = new St.Icon({
            icon_name: icon,
            icon_size: this.state.settings.categoryIconSize
          });
        }
      } else {
        this.icon_name = altIconName;
        icon = altIconName;
        this.icon = new St.Icon({
          icon_name: icon,
          icon_size: this.state.settings.categoryIconSize,
          icon_type: St.IconType.FULLCOLOR
        });
      }
      this.addActor(this.icon);
    }

    this.categoryNameText = categoryNameText;
    this.label = new St.Label({
      text: this.categoryNameText,
      style_class: 'menu-category-button-label'
    });
    this.addActor(this.label);
    this.label.realize();

    // Connect signals
    this.signals.connect(this.actor, 'enter-event', Lang.bind(this, this.handleEnter));
    this.signals.connect(this.actor, 'leave-event', Lang.bind(this, this.handleLeave));
    this.signals.connect(this.actor, 'button-release-event', Lang.bind(this, this.handleButtonRelease));
  },

  selectCategory: function() {
    let id = isString(this._dir) ? this._dir : this._dir.get_menu_id();
    this.state.trigger('selectorMethod', this.selectorMethod, id);
  },

  handleEnter: function (actor, event) {
    if (this.disabled) {
      return false;
    }

    if (event) {
      this.state.trigger('clearEnteredActors');
    }

    this.entered = true;
    this.state.set({currentCategory: this.categoryNameText});
    this.actor.set_style_class_name('menu-category-button-selected');

    if (!this.state.settings.showAppDescriptionsOnButtons) {
      this.state.trigger('setSelectedTitleText', this.categoryNameText);
      this.state.trigger('setSelectedDescriptionText', '');
    }

    Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, Lang.bind(this, function() {
      this.selectCategory();
    }));
    return true;
  },

  handleLeave: function () {
    if (this.disabled) {
      return false;
    }
    this.entered = null;
    this.actor.set_style_class_name('menu-category-button');
    this.state.trigger('setSelectedTitleText', '');
    this.state.trigger('setSelectedDescriptionText', '');
  },

  handleButtonRelease: function () {
    if (this.disabled) {
      return false;
    }

    this.state.trigger('setSelectedTitleText', this.categoryNameText);
    this.state.trigger('setSelectedDescriptionText', '');
    this.selectCategory();
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
    this.state.trigger('setKeyFocus');
  },

  destroy: function() {
    this.signals.disconnectAllSignals();
    this.actor._delegate = null;
    this.label.destroy();
    if (this.icon) {
      this.icon.destroy();
    }

    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
    unref(this);
  },
};

/**
* @name ApplicationContextMenuItem
* @description Context menu class based on the one found in the default Cinnamon applet.
*
* @param {object} state
* @param {string} label
* @param {boolean} action
* @param {string} iconName
*/

function ApplicationContextMenuItem() {
  this._init.apply(this, arguments);
}

ApplicationContextMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function(state, buttonState, label, action, iconName) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      focusOnHover: false,
    });
    this.state = state;
    this.buttonState = buttonState;
    this.signals = new SignalManager.SignalManager(null);
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
    this.signals.connect(this.actor, 'enter-event', Lang.bind(this, this.handleEnter));
    this.signals.connect(this.actor, 'leave-event', Lang.bind(this, this.handleLeave));
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
    this.state.trigger('setKeyFocus');
  },

  activate: function(event) {
    if (!this.state || !this.buttonState) {
      return false;
    }
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
        launcherApplet.acceptNewLauncher(this.buttonState.app.get_id());

        this.buttonState.trigger('toggleMenu');
        if (this.state) {
          this.state.trigger('openMenu');
        }
        break;
      case 'add_to_desktop':
        let file = Gio.file_new_for_path(this.buttonState.app.get_app_info().get_filename());
        let destFile = Gio.file_new_for_path(USER_DESKTOP_PATH + '/' + this.buttonState.app.get_id());
        try {
          file.copy(destFile, 0, null, function() {});
          FileUtils.changeModeGFile(destFile, 755);
        } catch (e) {
          global.log(e);
        }
        this.buttonState.trigger('toggleMenu');
        break;
      case 'add_to_favorites':
        this.state.trigger('addFavorite', this.buttonState.app.get_id());
        break;
      case 'remove_from_favorites':
        this.state.trigger('removeFavorite', this.buttonState.app.get_id());
        break;
      case 'uninstall':
        Util.spawnCommandLine('gksu -m \'' + _('Please provide your password to uninstall this application')
          + '\' /usr/bin/cinnamon-remove-application \'' + this.buttonState.app.get_app_info().get_filename() + '\'');
        this.state.trigger('closeMenu');
        break;
      case 'run_with_nvidia_gpu':
        Util.spawnCommandLine('optirun gtk-launch ' + this.buttonState.app.get_id());
        this.state.trigger('closeMenu');
        break;
    }
    return false;
  },

  destroy: function() {
    this.signals.disconnectAllSignals();
    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
    unref(this);
  }
};

const addMenuItem = function(t, instance) {
  t.contextMenuButtons.push(instance);
  t.menu.addMenuItem(t.contextMenuButtons[t.contextMenuButtons.length - 1]);
};

/**
 * @name AppListGridButton
 * @description A button container with an icon, label, and dot responsible for
 * @description handling both list and grid views.
 *
 * @param {object} state
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

  _init: function(state, app, appType, appIndex, appListLength) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false,
      activate: false
    });

    this.state = state;
    this.buttonState = store.init({
      app: app,
      appType: appType,
      appIndex: appIndex,
      appListLength: appListLength
    });
    this.buttonState.connect({
      toggleMenu: () => this.toggleMenu()
    });
    this.signals = new SignalManager.SignalManager(null);
    this.contextMenuButtons = [];
    this.description = '';
    this.isStrApp = typeof app === 'string';
    this.column = null;
    let className = 'menu-application-button';
    this.entered = null;
    if (this.state.isListView) {
      this._iconContainer = new St.BoxLayout({
        vertical: true
      });
    }
    this.actor.set_style_class_name(className);
    this.actor.x_align = this.state.isListView ? St.Align.START : St.Align.MIDDLE;
    this.actor.y_align = St.Align.MIDDLE;

    if (!this.state.isListView) {
      this.actor.width = this.state.trigger('getAppsGridBoxWidth') / this.state.settings.appsGridColumnCount;
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
      this.buttonState.app = {
        name: name,
        description: name,
        uri: name,
        icon: Gio.content_type_get_icon(contentType[0])
      };
      this.buttonState.appType = ApplicationType._places;
      this.file = Gio.file_new_for_path(this.buttonState.app.name);
      try {
        this.handler = this.file.query_default_handler(null);
      } catch (e) {
        this.handler = null;
      }
    }
    // Don't show protocol handlers
    if (this.buttonState.app.description) {
      let slice = this.buttonState.app.description.slice(0, 7);
      if (slice === 'https://' || slice === 'http://' || slice === 'file://') {
        this.buttonState.app.description = this.buttonState.app.description.slice(7);
      }
      if (this.buttonState.app.description.slice(-1) === '/') {
        this.buttonState.app.description = this.buttonState.app.description.slice(0, -1);
      }
    } else {
      this.buttonState.app.description = this.state.fallbackDescription;
    }
    // Icons
    if (this.state.settings.showApplicationIcons) {
      if (this.buttonState.appType === ApplicationType._applications) {
        this.icon = this.buttonState.app.create_icon_texture(this.state.iconSize);
      } else if (this.buttonState.appType === ApplicationType._windows) {
        // Used instead of metaWindow.icon because create_icon_texture creates
        // higher resolution icons.
        this.icon = this.buttonState.app._icon;
        this.buttonState.app._icon = null;
      } else if (this.buttonState.appType === ApplicationType._places) {
        let iconObj = {
          icon_size: this.state.iconSize
        };
        if (this.file) {
          iconObj.icon_name = this.buttonState.app.icon === undefined ? 'unknown' : 'folder';
          iconObj.icon_type = St.IconType.FULLCOLOR;
        } else {
          iconObj.gicon = this.buttonState.app.icon;
        }
        this.icon = new St.Icon(iconObj);
      } else if (this.buttonState.appType === ApplicationType._recent) {
        if (this.buttonState.app.clearList) {
          this.icon = this.buttonState.app.icon;
          this.icon.set_icon_size(this.state.iconSize);
        } else {
          this.icon = new St.Icon({
            gicon: this.buttonState.app.icon,
            icon_size: this.state.iconSize
          });
        }
      } else if (this.buttonState.appType === ApplicationType._providers) {
        this.icon = this.buttonState.app.icon;
      }
      if (!this.icon) {
        this.icon = new St.Icon({
          icon_name: 'error',
          icon_size: this.state.iconSize,
          icon_type: St.IconType.FULLCOLOR
        });
      }
    }

    this.label = new St.Label({
      text: this.buttonState.app.name,
      style_class: 'menu-application-button-label'
    });

    this.dot = new St.Widget({
      style: 'width: 5px; height: 5px; background-color: ' + this.state.theme.mainBoxBorderColor + '; margin-bottom: 2px; border-radius: 128px;',
      layout_manager: new Clutter.BinLayout(),
      x_expand: true,
      y_expand: false,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.END
    });

    this.buttonBox = new St.BoxLayout({
      vertical: !this.state.isListView,
      width: 240
    });
    let iconDotContainer = this.state.isListView ? '_iconContainer' : 'buttonBox';
    if (this.icon) {
      this[iconDotContainer].add(this.icon, {
        x_fill: false,
        y_fill: false,
        x_align: this.state.isListView ? St.Align.END : St.Align.MIDDLE,
        y_align: this.state.isListView ? St.Align.END : St.Align.START
      });
    }
    if (this.state.isListView) {
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
      x_align: this.state.isListView ? St.Align.START : St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this[iconDotContainer].add(this.dot, {
      x_fill: false,
      y_fill: true,
      x_align: this.state.isListView ? St.Align.END : St.Align.MIDDLE,
      y_align: this.state.isListView ? St.Align.END : St.Align.START
    });
    // Context menu
    if (this.buttonState.appType === ApplicationType._applications) {
      this.menu = new PopupMenu.PopupSubMenu(this.actor);
      this.menu.actor.set_style_class_name('menu-context-menu');
      if (this.state.theme) {
        this.menu.box.set_style('background-color: ' + this.state.theme.backgroundColor + '; border: 1px solid' + this.state.theme.borderColor
        + '; border-radius: ' + this.state.theme.borderRadius + 'px; padding-top: ' + this.state.theme.padding + 'px; padding-bottom: ' + this.state.theme.padding + 'px;');
      }
      this.menu.isOpen = false;
      this.buttonBox.add_actor(this.menu.actor);
    } else {
      this.menu = {
        isOpen: false
      };
    }
    this.addActor(this.buttonBox);

    if (this.icon) {
      this.icon.realize();
    }
    if (this.state.settings.showAppDescriptionsOnButtons
      || this.buttonState.app.shouldHighlight) {
      this.formatLabel({});
    }

    // Connect signals
    if (this.buttonState.appType === ApplicationType._applications) {
      this.signals.connect(this.buttonState.app, 'notify::state', Lang.bind(this, this._onStateChanged));
    }

    // Check if running state
    this.dot.opacity = 0;
    this._onStateChanged();

    this.signals.connect(this.actor, 'button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
    this.signals.connect(this.actor, 'enter-event', Lang.bind(this, this.handleEnter));
    this.signals.connect(this.actor, 'leave-event', Lang.bind(this, this.handleLeave));
    this.signals.connect(this.actor, 'parent-set', Lang.bind(this, this.handleParentChange));
  },

  handleParentChange: function (actor) {
    if (this.state.settings.showAppDescriptionsOnButtons
      || this.buttonState.app.shouldHighlight
      || this.state.searchActive) {
      this.formatLabel({});
    }
    if (!this.buttonState.app.description) {
      this.buttonState.app.description = this.state.fallbackDescription;
    }
  },

  formatLabel: function (opts) {
    let description = this.buttonState.app.description ? this.buttonState.app.description : '';
    if (this.description) {
      let diff = this.description.length - description.length;
      diff = Array(Math.abs(Math.ceil(diff))).join(' ');
      description = description + diff;
    }

    if (opts.removeFormatting && this.buttonState.app.description) {
      this.buttonState.app.name = this.buttonState.app.name.replace(/<[^>]*>/g, '');
      this.buttonState.app.description = this.buttonState.app.description.replace(/<[^>]*>/g, '');
    }

    let markup = '<span>' + this.buttonState.app.name.replace(/&/g, '&amp;') + '</span>';

    if (this.state.settings.showAppDescriptionsOnButtons) {
      markup += '\n<span size="small">' + description.replace(/&/g, '&amp;') + '</span>';
      if (!this.state.isListView) {
        let width = this.description ? this.description.length : this.buttonState.app.description ? this.buttonState.app.description.length : 0;
        this.label.set_style('text-align: center;min-width: ' + width.toString() + 'px;');
      }
    } else {
      if (this.state.searchActive) {
        let nameClutterText = this.state.trigger('getSelectedTitleClutterText');
        if (nameClutterText) {
          nameClutterText.set_markup(this.buttonState.app.name.replace(/&/g, '&amp;'));
        }
        let descriptionClutterText = this.state.trigger('getSelectedDescriptionClutterText');
        if (descriptionClutterText) {
          descriptionClutterText.set_markup(description.replace(/&/g, '&amp;'));
        }
      } else {
        this.state.trigger('setSelectedTitleText', this.buttonState.app.name.replace(/<[^>]*>/g, ''));
        this.state.trigger('setSelectedDescriptionText', description.replace(/<[^>]*>/g, ''));
      }
    }

    if (this.buttonState.app.shouldHighlight) {
      markup = '<b>' + markup + '</b>';
    }
    let clutterText = this.label.get_clutter_text();
    if (clutterText
      && (this.state.settings.showAppDescriptionsOnButtons
        || this.state.searchActive
        || this.buttonState.app.shouldHighlight)
        || opts.removeFormatting) {
      clutterText.set_markup(markup);
      clutterText.ellipsize = Pango.EllipsizeMode.END;
    }
  },

  handleMarquee: function (opts) {
    // TODO - Figure out how to do this in RTL locales
    if (!this.buttonState || !this.buttonState.app || !this.description || this.state.searchActive) {
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

    //log([opts.start, opts.end, opts.limit, this.buttonState.app.description.length, this.description.length])

    if (opts.reset === 1) {
      opts.start = 0;
      opts.end = opts.limit;
      this.buttonState.app.description = this.description;
      opts.reset = 2;
    } else if (Math.floor(opts.end) === this.description.length) {
      opts.reset = 1;
    } else {
      ++opts.start;
      ++opts.end;
      this.buttonState.app.description = this.description.substr(opts.start, opts.end);
    }

    this.formatLabel(opts);

    let interval = opts.reset > 0 ? 1000 : 75;

    this.marqueeTimer = setTimeout(()=>this.handleMarquee(opts), interval);
  },

  _onKeyFocusIn: function () {
    this.state.trigger('setKeyFocus');
  },

  handleEnter: function (actor, event) {
    if (this.state.menuIsOpen || this.menu.isOpen) {
      return false;
    }

    if (event) {
      this.state.trigger('clearEnteredActors');
    } else {
      this.state.trigger('scrollToButton', this);
    }

    this.entered = true;

    this.actor.set_style_class_name('menu-application-button-selected');

    // Check marquee conditions, and set it up
    let labelWidth, actorWidth, allocatedTextLength;
    this.state.trigger('toggleSelectedTitleText', this.buttonState.appType !== ApplicationType._windows);
    if (this.state.settings.showAppDescriptionsOnButtons) {
      labelWidth = this.label.get_size()[0];
      actorWidth = this.actor.get_size()[0];
      allocatedTextLength = this.state.isListView ? 41 : actorWidth / (this.state.settings.appsGridColumnCount * 2);
    } else {
      this.formatLabel({});
      labelWidth = this.buttonState.app.description.length;
      actorWidth = 16;
      allocatedTextLength = 16;
    }
    if (labelWidth > actorWidth && !this.searchActive) {
      this.description = this.buttonState.app.description;
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
    if (this.state.menuIsOpen === this.buttonState.appIndex && this.menu.isOpen) {
      return false;
    }

    this.entered = null;
    this.actor.set_style_class_name('menu-application-button');
    if (this.description) {
      this.buttonState.app.description = this.description;
      this.formatLabel({});
      if (!this.state.menuIsOpen && !this.state.searchActive && this.marqueeTimer) {
        clearTimeout(this.marqueeTimer);
        this.marqueeTimer = null;
      }
    }
    if (!this.state.settings.showAppDescriptionsOnButtons) {
      this.state.trigger('setSelectedTitleText', '');
      this.state.trigger('setSelectedDescriptionText', '');
    }
  },

  _onButtonReleaseEvent: function(actor, e){
    let button = e.get_button();
    if (button === 1) {
      if (this.state.menuIsOpen) {
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
      if (!this.state.isListView
        && this.state.trigger('isNotInScrollView', this)
        && this.buttonState.appType === ApplicationType._applications) {
        let y = this.menu.actor.get_position()[1];
        y = -100;
        this.menu.actor.set_position(this.x, y);
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
          Util.spawn(['gvfs-open', this.buttonState.app.uri])
        } catch (e) {
          global.logError('No handler available to open ' + this.buttonState.app.uri);
        }
      }
    } else if (this.buttonState.appType === ApplicationType._applications) {
      this.buttonState.app.open_new_window(-1);
    } else if (this.buttonState.appType === ApplicationType._places) {
      if (this.buttonState.app.uri) {
        this.buttonState.app.app.launch_uris([this.buttonState.app.uri], null);
      } else {
        this.buttonState.app.launch();
      }
    } else if (this.buttonState.appType === ApplicationType._recent) {
      if (this.buttonState.app.clearList) {
        this.state.trigger('purgeRecentItems');
      } else {
        Gio.app_info_launch_default_for_uri(this.buttonState.app.uri, global.create_app_launch_context());
      }
    } else if (this.buttonState.appType === ApplicationType._windows) {
      Main.activateWindow(this.buttonState.app, global.get_current_time());
    } else if (this.buttonState.appType === ApplicationType._providers) {
      this.buttonState.app.activate(this.buttonState.app);
    }
    this.state.trigger('closeMenu');
  },

  activateContextMenus: function (event) {
    if (!this.menu.isOpen) {
      // Make sure all other context menus are closed before toggle.
      let buttons = this.state.trigger('getActiveButtons');
      for (let i = 0, len = buttons.length; i < len; i++) {
        if (buttons[i].buttonState.appIndex !== this.buttonState.appIndex) {
          buttons[i].closeMenu();
          buttons[i].handleLeave(true);
        }
      }
    }
    this.toggleMenu();
  },

  setColumn: function(column) {
    if (!this.menu.actor) {
      return false;
    }
    this.column = column;
    let x = 45, y = 50;
    if ((column === 0 || column === this.buttonState.appListLength)
      && this.buttonState.appListLength > 1) {
      x = -90
    }
    this.x = x;
    this.menu.actor.set_position(x, y);
  },

  _onStateChanged: function () {
    if (!this.buttonState.app) {
      return false;
    }
    if (this.buttonState.appType === ApplicationType._applications) {
      if (this.buttonState.app.state !== Cinnamon.AppState.STOPPED) {
        this.dot.opacity = 255;
      } else {
        this.dot.opacity = 0;
      }
    }
    return true;
  },

  closeMenu: function () {
    if (this.buttonState.appType !== ApplicationType._applications) {
      return;
    }
    this.menu.close();
  },

  toggleMenu: function () {
    if (this.buttonState.appType !== ApplicationType._applications || !this.menu) {
      return false;
    }

    if (!this.menu.isOpen) {
      for (let i = 0; i < this.contextMenuButtons.length; i++) {
        this.contextMenuButtons[i].destroy();
        this.contextMenuButtons[i] = null;
      }
      this.contextMenuButtons = [];
      this.state.set({menuIsOpen: this.buttonState.appIndex});
      this.actor.set_style_class_name('menu-application-button-selected');

      addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Add to panel'), 'add_to_panel', 'list-add'));
      if (USER_DESKTOP_PATH) {
        addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Add to desktop'), 'add_to_desktop', 'computer'));
      }
      if (this.state.trigger('isFavorite', this.buttonState.app.get_id())) {
        addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Remove from favorites'), 'remove_from_favorites', 'starred'));
      } else {
        addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Add to favorites'), 'add_to_favorites', 'non-starred'));
      }
      addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Uninstall'), 'uninstall', 'edit-delete'));
      if (this.state.isBumblebeeInstalled) {
        addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Run with NVIDIA GPU'), 'run_with_nvidia_gpu', 'cpu'));
      }

      // In grid mode we will ensure our menu isn't overlapped by any other actors.
      if (!this.state.isListView) {
        this.actor.raise_top();
      }
    } else {
      // Allow other buttons hover functions to take effect.
      this.state.set({menuIsOpen: false});
    }
    this.menu.toggle_with_options(this.state.settings.enableAnimation);
    return true
  },

  clearSearchFormatting: function () {
    this.formatLabel({
      removeFormatting: true
    });
  },

  destroy: function () {
    this.signals.disconnectAllSignals();

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
    unref(this);
  }
};

/**
 * @name GroupButton
 * @description A generic icon button used for user/power group buttons
 *
 * @param {object} state
 * @param {string} iconName
 * @param {number} iconSize
 * @param {string} name
 * @param {string} description
 */

function GroupButton() {
  this._init.apply(this, arguments);
}

GroupButton.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,


  _init: function (state, iconName, iconSize, name, description) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false,
      activate: false
    });
    this.state = state;
    this.signals = new SignalManager.SignalManager(null);
    this.name = name;
    this.description = description;

    let monitorHeight = Main.layoutManager.primaryMonitor.height;
    let realSize = (0.7 * monitorHeight) / 4;
    let adjustedIconSize = 0.6 * realSize / global.ui_scale;
    if (adjustedIconSize > iconSize) {
      adjustedIconSize = iconSize;
    }
    this.actor.style = 'padding-top: ' + (adjustedIconSize / 3) + 'px;padding-bottom: ' + (adjustedIconSize / 3) + 'px;';
    this.actor.set_style_class_name('menu-favorites-button');
    this.entered = null;

    if (iconName && iconSize) {
      let iconObj = {
        icon_size: adjustedIconSize,
        icon_type: adjustedIconSize <= 25 ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR
      };
      if (iconName === 'user') {
        this.defaultAvatar = new Gio.ThemedIcon({
          name: 'avatar-default'
        });
        iconObj.gicon = this.defaultAvatar;
        this.name = GLib.get_user_name();
        this._user = AccountsService.UserManager.get_default().get_user(this.name);
        this.signals.connect(this._user, 'notify::is_loaded', Lang.bind(this, this._onUserChanged));
        this.signals.connect(this._user, 'changed', Lang.bind(this, this._onUserChanged));
        setTimeout(Lang.bind(this, this._onUserChanged), 0);
      } else {
        iconObj.icon_name = iconName;
      }
      this.iconSize = adjustedIconSize;
      this.icon = new St.Icon(iconObj);
      this.addActor(this.icon);
      this.icon.realize();
    }
    this.signals.connect(this.actor, 'enter-event', Lang.bind(this, this.handleEnter));
    this.signals.connect(this.actor, 'leave-event', Lang.bind(this, this.handleLeave));
    this.signals.connect(this.actor, 'button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
  },

  _onUserChanged: function() {
    if (this._user.is_loaded) {
      this.name = this._user.get_real_name();
      this.state.trigger('setSelectedTitleText', this.name);
      this.state.trigger('setSelectedDescriptionText', this.description);
      if (this.icon) {
        let iconFileName = this._user.get_icon_file();
        let iconFile = Gio.file_new_for_path(iconFileName);
        let icon;
        if (iconFile.query_exists(null)) {
          icon = new Gio.FileIcon({
            file: iconFile
          });
        } else {
          icon = this.defaultAvatar;
        }
        this.icon.set_gicon(icon);
        this.icon.realize();
      }
    }
  },

  _onButtonReleaseEvent: function () {
    if (this._user || this.icon.icon_name.indexOf('view') === -1) {
      this.state.trigger('closeMenu')
    }
    if (this.icon.icon_name.indexOf('view') > -1) {
      this.toggleViewMode();
    }
    return true;
  },

  handleEnter: function (actor) {
    if (actor) {
      this.state.trigger('clearEnteredActors');
    }
    this.entered = true;
    this.actor.add_style_pseudo_class('hover');
    this.state.trigger('setSelectedTitleText', this.name);
    this.state.trigger('setSelectedDescriptionText', this.description);
  },

  handleLeave: function () {
    this.entered = null;
    this.actor.remove_style_pseudo_class('hover');
    this.state.trigger('setSelectedTitleText', '');
    this.state.trigger('setSelectedDescriptionText', '');
  },

  setIcon: function(iconName) {
    this.removeActor(this.icon);
    this.icon.destroy();
    this.icon = this.icon = new St.Icon({
      icon_name: iconName,
      icon_size: this.iconSize,
      icon_type: St.IconType.FULLCOLOR
    });
    this.addActor(this.icon);
    this.icon.realize();
  },

  toggleViewMode: function() {
    if (this.state.isListView) {
      this.state.set({isListView: false});
      this.setIcon('view-list-symbolic');
      this.name = _('List View');
      this.description = _('Switch to list view');
      this.state.trigger('setSettingsValue', 'startup-view-mode', 1);
    } else {
      this.state.set({isListView: true});
      this.setIcon('view-grid-symbolic');
      this.name = _('Grid View');
      this.description = _('Switch to grid view');
      this.state.trigger('setSettingsValue', 'startup-view-mode', 0);
    }
    this.state.trigger('switchApplicationsView', true);
    this.handleEnter();
  },

  destroy: function() {
    this.signals.disconnectAllSignals();

    if (this.icon) {
      this.icon.destroy();
    }

    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
    unref(this);
  },
};
