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
const DND = imports.ui.dnd;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const SignalManager = imports.misc.signalManager;
const Mainloop = imports.mainloop;
let store, setTimeout, clearTimeout, isFinalized, isString, unref, tryFn, _, ApplicationType;
if (typeof require !== 'undefined') {
  const utils = require('./utils');
  const constants = require('./constants');
  store = require('./store');
  setTimeout = utils.setTimeout;
  clearTimeout = utils.clearTimeout;
  isFinalized = utils.isFinalized;
  isString = utils.isString;
  unref = utils.unref;
  tryFn = utils.tryFn;
  _ = constants._;
  ApplicationType = constants.ApplicationType;
} else {
  const AppletDir = imports.ui.appletManager.applets['Cinnamenu@json'];
  let storeVersion = typeof Symbol === 'undefined' ? 'store_mozjs24' : 'store';
  store = AppletDir[storeVersion];
  setTimeout = AppletDir.utils.setTimeout;
  clearTimeout = AppletDir.utils.clearTimeout;
  isFinalized = AppletDir.utils.isFinalized;
  isString = AppletDir.utils.isString;
  unref = AppletDir.utils.unref;
  tryFn = AppletDir.utils.tryFn;
  _ = AppletDir.constants._;
  ApplicationType = AppletDir.constants.ApplicationType;
}

const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();
const stripMarkupRegex = /(<([^>]+)>)/ig;
const canUninstall = GLib.file_test('/usr/bin/cinnamon-remove-application', GLib.FileTest.EXISTS);

const wordWrap = function(text, limit) {
  let regex = '.{1,' + limit + '}(\\s|$)|\\S+?(\\s|$)';
  return text.match(RegExp(regex, 'g')).join('\n');
};

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
    this.connectIds = [
      this.state.connect({
        menuOpened: () => {
          if (this.id === 'favorites') {
            this.actor.set_style_class_name('menu-category-button-selected')
          }
        }
      }),
      this.state.connect({
        dragIndex: () => {
          if (this.state.dragIndex !== this.index
            && this.actor.opacity === 50) {
            this.actor.set_opacity(255);
          }
        }
      })
    ];
    this.signals = new SignalManager.SignalManager(null);
    if (!selectorMethod) {
      selectorMethod = '_selectCategory';
    }
    this.selectorMethod = selectorMethod;

    this.index = -1;
    this._dir = dir;
    let isStrDir = typeof dir === 'string';
    let dirName = !isStrDir ? dir.get_name() : null;
    this.id = isString(this._dir) ? this._dir : altNameText;
    let categoryNameText = isStrDir ? altNameText : dirName ? dirName : '';
    this.disabled = false;
    this.entered = null;

    if (this.state.settings.showCategoryIcons) {
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

    this.actor._delegate = {
      handleDragOver: (source, actor, x, y, time) => {
        if (!source.index
          || source.index === this.index) {
          return DND.DragMotionResult.NO_DROP;
        }
        this.state.set({dragIndex: this.index});
        this.actor.set_opacity(50);
        return DND.DragMotionResult.MOVE_DROP;
      },
      acceptDrop: (source, actor, x, y, time) => {
        if (!source.index
          || source.index === this.index) {
          this.state.set({dragIndex: -1});
          return DND.DragMotionResult.NO_DROP;
        }
        this.state.trigger('moveCategoryToPos', source.id, this.id);
        return true;
      },
      getDragActorSource: () => this.actor,
      _getDragActor: () => new Clutter.Clone({source: this.actor}),
      getDragActor: () => new Clutter.Clone({source: this.icon}),
      isDraggableApp: false,
      index: this.index,
      id: this.id
    };

    this._draggable = DND.makeDraggable(this.actor);

    // Connect signals
    this.signals.connect(this._draggable, 'drag-begin', Lang.bind(this, this._onDragBegin));
    this.signals.connect(this._draggable, 'drag-cancelled', Lang.bind(this, this._onDragCancelled));
    this.signals.connect(this._draggable, 'drag-end', Lang.bind(this, this._onDragEnd));
    this.signals.connect(this.actor, 'enter-event', Lang.bind(this, this.handleEnter));
    this.signals.connect(this.actor, 'leave-event', Lang.bind(this, this.handleLeave));
    this.signals.connect(this.actor, 'button-release-event', Lang.bind(this, this.handleButtonRelease));
  },

  _onDragBegin: function() {
    this.actor.set_opacity(51);
  },

  _onDragCancelled: function () {
    this.actor.set_opacity(255);
  },

  _onDragEnd: function() {
    this.actor.set_opacity(255);
  },

  _clearDragPlaceholder: function () {
    if (this.state.dragPlaceholder) {
      this.state.dragPlaceholder.destroy();
      this.state.dragPlaceholder = null;
    }
  },

  selectCategory: function() {
    if (this.disabled) {
      return false;
    }
    if (this.id) {
      this.state.set({currentCategory: this.id});
    }
    Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, () => this.state.trigger('selectorMethod', this.selectorMethod, this.id));
  },

  handleEnter: function (actor, event) {
    if (this.disabled) {
      return false;
    }

    if (event) {
      this.state.trigger('clearEnteredActors');
    }

    this.entered = true;
    if (this.state.settings.categoryClick) {
      this.actor.set_style_class_name('menu-category-button-selected');
      return;
    }
    this.selectCategory();
    return true;
  },

  handleLeave: function (actor, event) {
    if (this.disabled) {
      return false;
    }
    this.entered = null;
    if ((!event || this.state.settings.categoryClick) && this.state.currentCategory !== this.id) {
      this.actor.set_style_class_name('menu-category-button');
    }
  },

  handleButtonRelease: function (actor, event) {
    if (this.disabled
      || (event && event.get_button() > 1)
      || !this.state.settings.categoryClick) {
      return;
    }
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
    for (let i = 0; i < this.connectIds.length; i++) {
      this.state.disconnect(this.connectIds[i]);
    }
    this.signals.disconnectAllSignals();
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
      text: label,
      style: 'font-size: 11px;'
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
    // Override padding to help prevent label truncation, the menu container width is restricted to the column width,
    // so unless we turn the context menu into a modal somehow (not likely since it will fight for input with the parent),
    // this is the most practical solution for the grid.
    this.actor.set_style('padding-left: 6px !important; padding-right: 0px !important; width: 215px !important;');
    this.setColumnWidths([8, 132])
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
    if (event && event.get_button() === 3) {
      this.buttonState.trigger('toggleMenu');
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
        tryFn(function() {
          file.copy(destFile, 0, null, function() {});
          FileUtils.changeModeGFile(destFile, 755);
        }, function(e) {
          global.log(e);
        });
        this.buttonState.trigger('toggleMenu');
        break;
      case 'add_to_favorites':
        this.state.trigger('addFavorite', this.buttonState.app.get_id());
        break;
      case 'remove_from_favorites':
        this.state.trigger('removeFavorite', this.buttonState.app.get_id());
        break;
      case 'uninstall':
        Util.spawnCommandLine('/usr/bin/cinnamon-remove-application \'' + this.buttonState.app.get_app_info().get_filename() + '\'');
        this.state.trigger('closeMenu');
        break;
      case "offload_launch":
        try {
            this.buttonState.app.launch_offloaded(0, [], -1);
        } catch (e) {
            logError(e, "Could not launch app with dedicated gpu: ");
        }
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
    this.state = state;
    this.connectId = this.state.connect({
      dragIndex: () => {
        if (this.state.dragIndex !== this.buttonState.appIndex
          && this.actor.opacity === 50) {
          this.actor.set_opacity(255);
        }
      },
      searchActive: () => {
        // Ensure the reset view is markup-free
        if (this.state.searchActive) {
          this.nameUnformatted = this.buttonState.app.name;
        } else if (this.nameUnformatted) {
          this.buttonState.app.name = this.nameUnformatted;
          this.nameUnformatted = undefined;
        }
      }
    });
    this.buttonState = store.init({
      app: app,
      appType: appType,
      appIndex: appIndex,
      appListLength: appListLength,
      column: -1
    });
    this.buttonState.connect({
      toggleMenu: () => this.toggleMenu()
    });

    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false,
      activate: false
    });

    this.actor.set_style_class_name('menu-application-button');
    this.actor.set_style('padding-left: 0px; padding-right: 0px;')
    this.actor.x_align = this.state.isListView ? St.Align.START : St.Align.MIDDLE;
    this.actor.y_align = St.Align.MIDDLE;

    if (!this.state.isListView) {
      this.actor.width = this.state.trigger('getAppsGridBoxWidth') / this.state.settings.appsGridColumnCount;
    }

    // DND
    this.actor._delegate = {
      handleDragOver: (source, actor, x, y, time) => {
        if (!source.appIndex
          || source.appIndex === this.buttonState.appIndex
          || this.state.currentCategory !== 'favorites') {
          return DND.DragMotionResult.NO_DROP;
        }
        this.state.set({dragIndex: this.buttonState.appIndex});
        // TODO: We need to set a real placeholder, but to do so, the actor must be attached
        // to applicationsGridBox, or inserted into applicationsListBox.
        this.actor.set_opacity(50);
        return DND.DragMotionResult.MOVE_DROP;
      },
      acceptDrop: (source, actor, x, y, time) => {
        if (!source.appIndex
          || source.appIndex === this.buttonState.appIndex
          || this.state.currentCategory !== 'favorites') {
          this.state.set({dragIndex: -1});
          return DND.DragMotionResult.NO_DROP;
        }
        this.state.trigger('moveFavoriteToPos', source.get_app_id(), this.buttonState.appIndex);
        return true;
      },
      getDragActorSource: () => this.actor,
      _getDragActor: () => new Clutter.Clone({source: this.actor}),
      getDragActor: () => new Clutter.Clone({source: this.icon}),
      get_app_id: () => this.buttonState.app.get_id(),
      appIndex: this.buttonState.appIndex
    };

    this.signals = new SignalManager.SignalManager(null);
    this.contextMenuButtons = [];
    this.description = '';
    this.entered = null;

    this._iconContainer = new St.BoxLayout();

    // Don't show protocol handlers
    if (this.buttonState.app.description) {
      let slice = this.buttonState.app.description.slice(0, 7);
      if (slice === 'https://' || slice === 'http://' || slice === 'file://') {
        this.buttonState.app.description = this.buttonState.app.description.slice(7);
      }
      if (this.buttonState.app.description.slice(-1) === '/') {
        this.buttonState.app.description = this.buttonState.app.description.slice(0, -1);
      }
    } else if (this.buttonState.appType === ApplicationType._applications) {
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
      style: 'width: 4px; height: 4px; background-color: '
        + this.state.theme.foregroundColor
        + '; margin-bottom: 2px; border-radius: 128px;',
      layout_manager: new Clutter.BinLayout(),
      x_expand: true,
      y_expand: false,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.END
    });

    this.buttonBox = new St.BoxLayout({
      vertical: !this.state.isListView,
      width: 240 * global.ui_scale,
      y_expand: false
    });

    if (this.icon) {
      this._iconContainer.add(this.icon, {
        x_fill: false,
        y_fill: false,
        x_align: this.state.isListView ? St.Align.END : St.Align.MIDDLE,
        y_align: this.state.isListView ? St.Align.END : St.Align.START
      });
    }

    this.buttonBox.add(this._iconContainer, {
      x_fill: false,
      y_fill: false,
      x_align: this.state.isListView ? St.Align.START : St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this.buttonBox.add(this.label, {
      x_fill: false,
      y_fill: false,
      x_align: this.state.isListView ? St.Align.START : St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this._iconContainer.add(this.dot, {
      x_fill: false,
      y_fill: true,
      x_align: this.state.isListView ? St.Align.END : St.Align.MIDDLE,
      y_align: this.state.isListView ? St.Align.END : St.Align.START
    });

    if (this.state.isListView) {
      // Position the dot diagonally to the bottom right corner of the icon
      this.dot.anchor_y = -4;
      this.dot.anchor_x = 2;
      this.label.set_style('min-width: 230px;');
    } else {
      this.dot.anchor_y = -2;
      this.dot.anchor_x = 4;
    }

    // Context menu
    if (this.buttonState.appType === ApplicationType._applications) {
      this.menu = new PopupMenu.PopupSubMenu(this.actor);
      this.menu.actor.set_style_class_name('menu menu-context-menu menu-background starkmenu-background');
      this.menu.actor.set_style('width: 225px !important;')
      this.menu.actor.set_opacity(245)
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
      this.actor._delegate.isDraggableApp = true;
      this._draggable = DND.makeDraggable(this.actor);
      this.signals.connect(this.buttonState.app, 'notify::state', Lang.bind(this, this._onStateChanged));
      this.signals.connect(this._draggable, 'drag-begin', Lang.bind(this, this._onDragBegin));
      this.signals.connect(this._draggable, 'drag-cancelled', Lang.bind(this, this._onDragCancelled));
      this.signals.connect(this._draggable, 'drag-end', Lang.bind(this, this._onDragEnd));
    }

    // Check if running state
    this.dot.opacity = 0;
    this._onStateChanged();

    this.signals.connect(this.actor, 'button-release-event', Lang.bind(this, this.handleButtonRelease));
    this.signals.connect(this.actor, 'enter-event', Lang.bind(this, this.handleEnter));
    this.signals.connect(this.actor, 'leave-event', Lang.bind(this, this.handleLeave));
    this.signals.connect(this.actor, 'parent-set', Lang.bind(this, this.handleParentChange));
  },

  _onDragBegin: function() {
    this.actor.set_opacity(51);
  },

  _onDragCancelled: function () {
    this.actor.set_opacity(255);
  },

  _onDragEnd: function() {
    this.actor.set_opacity(255);
  },

  _clearDragPlaceholder: function () {
    if (this.state.dragPlaceholder) {
      this.state.dragPlaceholder.destroy();
      this.state.dragPlaceholder = null;
    }
  },

  handleParentChange: function () {
    if (this.state.settings.showAppDescriptionsOnButtons
      || this.buttonState.app.shouldHighlight
      || this.state.searchActive) {
      this.formatLabel({});
    }
    if (!this.buttonState.app.description && this.buttonState.appType === ApplicationType._applications) {
      this.buttonState.app.description = this.state.fallbackDescription;
    }
  },

  formatLabel: function (opts) {
    let name = this.buttonState.app.name.replace(/&/g, '&amp;');
    let description = this.buttonState.app.description ? this.buttonState.app.description.replace(/&/g, '&amp;') : '';
    if (this.description) {
      let diff = this.description.length - description.length;
      diff = Array(Math.abs(Math.ceil(diff))).join(' ');
      description = description + diff;
    }

    if (opts.removeFormatting) {
      this.buttonState.app.name = this.buttonState.app.name.replace(stripMarkupRegex, '');
      if (this.buttonState.app.description) {
        this.buttonState.app.description = this.buttonState.app.description.replace(stripMarkupRegex, '');
      }
      description = description.replace(stripMarkupRegex, '');
    }

    let markup = '<span>' + name + '</span>';
    if (this.state.settings.showAppDescriptionsOnButtons) {
      if (!this.state.isListView) {
        let width = this.description ? this.description.length : description ? description.length : 0;
        this.label.set_style('text-align: center;min-width: ' + width.toString() + 'px;');
      }
      markup += '\n<span size="small">' + description + '</span>';
    }
    let tooltipMarkup;
    let tooltipShouldShowName = this.buttonState.appType !== ApplicationType._applications;
    if (this.state.settings.showTooltips && opts.tooltipFormat) {
      if (tooltipShouldShowName) {
        let tooltipName = name;
        if (tooltipName.length > 80) {
          tooltipName = wordWrap(name, 80);
        }
        tooltipMarkup = '<span>' + tooltipName + '</span>';
      }
      if (description.length > 0) {
        let tooltipDescription = description;
        if (description.length > 80) {
          tooltipDescription = wordWrap(description, 80);
        }
        if (tooltipShouldShowName) {
          tooltipMarkup += '\n<span size="small">' + tooltipDescription + '</span>';
        } else {
          tooltipMarkup = tooltipDescription;
        }
      }
    } else if (!this.state.settings.showTooltips) {
      if (this.state.searchActive) {
        let nameClutterText = this.state.trigger('getSelectedTitleClutterText');
        if (nameClutterText) {
          nameClutterText.set_markup(name);
        }
        let descriptionClutterText = this.state.trigger('getSelectedDescriptionClutterText');
        if (descriptionClutterText) {
          descriptionClutterText.set_markup(description);
        }
      } else {
        this.state.trigger('setSelectedTitleText', name);
        this.state.trigger('setSelectedDescriptionText', description);
      }
    }

    if (this.buttonState.app.shouldHighlight) {
      markup = '<b>' + markup + '</b>';
    }
    this.tooltipMarkup = tooltipMarkup;
    let clutterText = this.label.get_clutter_text();
    if (clutterText
      && (this.state.settings.showAppDescriptionsOnButtons
        || this.state.searchActive
        || this.buttonState.app.shouldHighlight)
        || opts.removeFormatting) {

      // TODO: Determine source cause of this markup occurring.
      if (markup.indexOf('</<') > -1) return;

      clutterText.set_markup(markup);
      clutterText.ellipsize = Pango.EllipsizeMode.END;
    }
  },

  clearMarqueeTimer: function() {
    if (this.marqueeTimer) {
      clearTimeout(this.marqueeTimer);
      this.marqueeTimer = 0;
    }
  },

  handleMarquee: function (opts) {
    this.clearMarqueeTimer();
    // TODO - Figure out how to do this in RTL locales
    if (!this.buttonState
      || !this.buttonState.app
      || !this.description
      || this.state.dragIndex > -1
      || this.state.contextMenuIsOpen != null) {
      return false;
    }
    if (opts.reset === 2) {
      opts.reset = 0;
    }

    if (opts.firstRecursion) {
      opts.firstRecursion = false;
      opts.limit = opts.end;
    }

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
    if (this.state.contextMenuIsOpen != null || this.menu.isOpen || this.state.dragIndex > -1) {
      return false;
    }

    if (event) {
      this.state.trigger('clearEnteredActors');
    } else {
      this.state.trigger('scrollToButton', this);
    }

    this.entered = true;
    this.state.set({itemEntered: true});
    this.actor.set_style_class_name('menu-application-button-selected');

    // Check marquee conditions, and set it up
    let labelWidth, actorWidth, allocatedTextLength;
    if (this.state.settings.showAppDescriptionsOnButtons) {
      labelWidth = this.label.get_size()[0];
      actorWidth = this.actor.get_size()[0];
      allocatedTextLength = this.state.isListView ? 41 : actorWidth / (this.state.settings.appsGridColumnCount * 2);
    } else {
      this.formatLabel({});
      labelWidth = this.buttonState.app.description ? this.buttonState.app.description.length : 16;
      actorWidth = 16;
      allocatedTextLength = 16;
    }
    if (labelWidth > actorWidth && !this.marqueeTimer && !this.state.settings.showTooltips) {
      this.description = this.buttonState.app.description.replace(stripMarkupRegex, '');
      this.marqueeTimer = setTimeout(()=>this.handleMarquee({
        start: 0,
        end: allocatedTextLength,
        firstRecursion: true,
        reset: 0
      }), 1000);
    } else {
      this.formatLabel({tooltipFormat: true});
      if (this.state.settings.showTooltips) {
        this.state.trigger('setTooltip', this.actor.get_transformed_position(), this.actor.height, this.tooltipMarkup);
      }
    }
    return false;
  },

  handleLeave: function () {
    if (this.state.contextMenuIsOpen === this.buttonState.appIndex && this.menu.isOpen || this.state.dragIndex > -1) {
      return false;
    }

    this.entered = null;
    this.state.set({itemEntered: false});
    this.actor.set_style_class_name('menu-application-button');
    if (this.description) {
      this.buttonState.app.description = this.description;
      this.formatLabel({});
      if (this.state.contextMenuIsOpen == null && this.marqueeTimer) {
        this.clearMarqueeTimer();
      }
    }
    if (this.state.settings.showTooltips) {
      this.state.trigger('setTooltip');
    } else if (!this.state.settings.showAppDescriptionsOnButtons) {
      this.state.trigger('setSelectedTitleText', '');
      this.state.trigger('setSelectedDescriptionText', '');
    }
  },

  handleButtonRelease: function(actor, e) {
    let button = !e ? 3 : e.get_button();
    if (button === 1) {
      if (this.state.contextMenuIsOpen != null) {
        if (this.menu.isOpen && this.menu._activeMenuItem) {
          this.menu._activeMenuItem.activate();
        } else {
          this.activateContextMenus(e, true);
          this.state.set({contextMenuIsOpen: null});
        }
        return false;
      }
      this.activate(e);
    } else if (button === 3) {
      if (!this.state.isListView
        && this.buttonState.appType === ApplicationType._applications) {
        this.prepareContextMenu();
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
        tryFn(
          () => Util.spawn(['gvfs-open', this.buttonState.app.uri]),
          () => global.logError('No handler available to open ' + this.buttonState.app.uri)
        );
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
      Main.activateWindow(this.buttonState.app.window, global.get_current_time());
    } else if (this.buttonState.appType === ApplicationType._providers) {
      this.buttonState.app.activate(this.buttonState.app);
    }
    this.state.trigger('closeMenu');
  },

  activateContextMenus: function (event, closeAll) {
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
    if (!closeAll) {
      this.toggleMenu();
    }
  },

  _onStateChanged: function () {
    if (!this.buttonState.app || isFinalized(this.dot)) {
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
    this.clearMarqueeTimer();
    if (this.state.isListView) this.label.show();
  },

  prepareContextMenu: function() {
    this.clearMarqueeTimer();
    this.buttonBox.height = this.buttonBox.get_preferred_size()[1];
    let x = -20, y = 20;
    if (this.buttonState.column === this.state.settings.appsGridColumnCount - 1) {
      x = 20;
    }
    // Due to changes to St in Cinnamon 3.6, the context menu lost its fixed positioning over other actors in the grid view.
    // Using anchor_x/y properties restores it without issue on 3.6, but causes the icon positioning to shift to the right
    // on Cinnamon <= 3.4. Minor workaround here until a better fix is implemented. anchor_x/y is deprecated, but the
    // pivot_point property doesn't seem to do anything in this situation.
    if (!this.state.cinnamon36) {
      this.icon.anchor_x = 0;
      this.icon.anchor_y = 0;
    }
    if (this.state.trigger('isNotInScrollView', this)) {
      y = Math.round(this.actor.height * 1.9);
    }
    this.menu.actor.anchor_x = x;
    this.menu.actor.anchor_y = y;
  },

  toggleMenu: function () {
    if (this.buttonState.appType !== ApplicationType._applications || !this.menu) {
      return false;
    }

    if (this.menu.isOpen) {
      this.clearMarqueeTimer();
      // Allow other buttons hover functions to take effect.
      this.state.set({contextMenuIsOpen: null});
      if (this.state.isListView) this.label.show();
    } else {
      for (let i = 0; i < this.contextMenuButtons.length; i++) {
        this.contextMenuButtons[i].destroy();
        this.contextMenuButtons[i] = null;
      }
      this.contextMenuButtons = [];
      this.state.set({contextMenuIsOpen: this.buttonState.appIndex});
      this.actor.set_style_class_name('menu-application-button-selected');

      if (this.state.gpu_offload_supported) {
        addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Run with NVIDIA GPU'), 'offload_launch', 'cpu'));
      } else if(this.state.isBumblebeeInstalled) {
        addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Run with NVIDIA GPU'), 'run_with_nvidia_gpu', 'cpu'));
      }
      addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Add to panel'), 'add_to_panel', 'list-add'));
      if (USER_DESKTOP_PATH) {
        addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Add to desktop'), 'add_to_desktop', 'computer'));
      }
      if (this.state.trigger('isFavorite', this.buttonState.app.get_id())) {
        addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Remove from favorites'), 'remove_from_favorites', 'starred'));
      } else {
        addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Add to favorites'), 'add_to_favorites', 'non-starred'));
      }
      if (canUninstall) {
        addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Uninstall'), 'uninstall', 'edit-delete'));
      }

      if (this.state.isListView) {
        this.label.hide();
      } else {
        // In grid mode we will ensure our menu isn't overlapped by any other actors.
        this.actor.get_parent().set_child_above_sibling(this.actor, null);
      }
    }
    this.menu.toggle_with_options(this.state.settings.enableAnimation);
    return true
  },

  clearSearchFormatting: function () {
    this.formatLabel({
      removeFormatting: true
    });
  },

  destroy: function (skipDestroy) {
    this.clearMarqueeTimer();
    this.state.disconnect(this.connectId);
    this.signals.disconnectAllSignals();

    if (!skipDestroy) {
      this.dot.destroy();
      this.label.destroy();
      if (this.icon) {
        this.icon.destroy();
      }
      if (this._iconContainer) {
        this._iconContainer.destroy();
      }
      this.buttonBox.destroy();
    }
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


  _init: function (state, iconName, iconSize, name, description, callback) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false,
      activate: false
    });
    this.state = state;
    this.signals = new SignalManager.SignalManager(null);
    this.name = name;
    this.description = description;
    this.callback = callback;

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
    this.signals.connect(this.actor, 'button-release-event', Lang.bind(this, this.handleButtonRelease));
  },

  _onUserChanged: function() {
    if (!this._user || !this._user.is_loaded) {
      return;
    }
    this.name = this._user.get_real_name();
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
  },

  handleButtonRelease: function (actor, event) {
    if (event && event.get_button() > 1) {
      return;
    }
    if (this._user || this.icon.icon_name.indexOf('view') === -1) {
      this.state.trigger('closeMenu');
    }
    if (this.icon.icon_name && this.icon.icon_name.indexOf('view') > -1) {
      this.toggleViewMode();
    } else if (this.callback) {
      this.callback();
    }
    return true;
  },

  handleEnter: function (actor) {
    if (actor) {
      this.state.trigger('clearEnteredActors');
    }
    this.entered = true;
    this.actor.add_style_pseudo_class('hover');
    if (this.state.settings.showTooltips) {
      this.state.trigger(
        'setTooltip',
        this.actor.get_transformed_position(),
        -this.actor.height - 20,
        this.name + (this.description ? '\n<span size="small">' + this.description + '</span>' : '')
      );
    } else {
      this.state.trigger('setSelectedTitleText', this.name);
      if (this.description) {
        this.state.trigger('setSelectedDescriptionText', this.description);
      }
    }
  },

  handleLeave: function () {
    this.entered = null;
    this.actor.remove_style_pseudo_class('hover');
    if (this.state.settings.showTooltips) {
      this.state.trigger('setTooltip');
    } else {
      this.state.trigger('setSelectedTitleText', '');
      if (this.description) {
        this.state.trigger('setSelectedDescriptionText', '');
      }
    }
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
    setTimeout(() => this.handleEnter(), 150);
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
