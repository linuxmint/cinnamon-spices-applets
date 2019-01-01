const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const {Clone, BinLayout, ActorAlign} = imports.gi.Clutter;
const {
  TextureCache,
  Icon,
  IconType,
  Label,
  Align,
  BoxLayout,
  Widget,
} = imports.gi.St;
const {AppState} = imports.gi.Cinnamon;
const {EllipsizeMode} = imports.gi.Pango;
const {UserManager} = imports.gi.AccountsService;
const Main = imports.ui.main;
const {PopupBaseMenuItem, PopupSubMenu} = imports.ui.popupMenu;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;
const {getUserDesktopDir, changeModeGFile} = imports.misc.fileUtils;
const {SignalManager} = imports.misc.signalManager;
const {spawnCommandLine, spawn, unref} = imports.misc.util;
const {createStore} = imports.misc.state;

const {_, ApplicationType, stripMarkupRegex} = require('./constants');
const {tryFn} = require('./utils');

const USER_DESKTOP_PATH = getUserDesktopDir();
const canUninstall = GLib.file_test('/usr/bin/cinnamon-remove-application', GLib.FileTest.EXISTS);

const wordWrap = function(text, limit) {
  let regex = '.{1,' + limit + '}(\\s|$)|\\S+?(\\s|$)';
  return text.match(RegExp(regex, 'g')).join('\n');
};

class CategoryListButton extends PopupBaseMenuItem {
  constructor(state, dir, altNameText, altIconName, selectorMethod) {
    super({
      hover: false,
      activate: false
    });
    this.state = state;
    this.connectIds = [
      this.state.connect({
        menuOpened: () => {
          if (this.id === this.state.settings.currentCategory) {
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
    this.signals = new SignalManager(null);
    if (!selectorMethod) {
      selectorMethod = 'selectCategory';
    }
    this.selectorMethod = selectorMethod;

    this.index = -1;
    let isStrDir = typeof dir === 'string';
    let dirName = !isStrDir ? dir.get_name() : null;
    this.id = typeof dir === 'string' || dir instanceof String ? dir : altNameText;
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
          this.icon = TextureCache.get_default().load_gicon(null, icon, this.state.settings.categoryIconSize);
        } else {
          icon = dir.get_icon() && typeof dir.get_icon().get_names === 'function' ? dir.get_icon().get_names().toString() : 'error';
          this.icon = new Icon({
            icon_name: icon,
            icon_size: this.state.settings.categoryIconSize
          });
        }
      } else {
        this.icon_name = altIconName;
        icon = altIconName;
        this.icon = new Icon({
          icon_name: icon,
          icon_size: this.state.settings.categoryIconSize,
          icon_type: IconType.FULLCOLOR
        });
      }
      this.addActor(this.icon);
    }

    this.categoryNameText = categoryNameText;
    this.label = new Label({
      text: this.categoryNameText,
      style_class: 'menu-category-button-label'
    });
    this.addActor(this.label);
    this.label.realize();

    this.actor._delegate = {
      handleDragOver: (source, /* actor, x, y, time */) => {
        if (!source.index
          || source.index === this.index) {
          return DragMotionResult.NO_DROP;
        }
        this.state.set({dragIndex: this.index});
        this.actor.set_opacity(50);
        return DragMotionResult.MOVE_DROP;
      },
      acceptDrop: (source, /* actor, x, y, time */) => {
        if (!source.index
          || source.index === this.index) {
          this.state.set({dragIndex: -1});
          return DragMotionResult.NO_DROP;
        }
        this.state.trigger('moveCategoryToPos', source.id, this.id);
        return true;
      },
      getDragActorSource: () => this.actor,
      _getDragActor: () => new Clone({source: this.actor}),
      getDragActor: () => new Clone({source: this.icon}),
      isDraggableApp: false,
      index: this.index,
      id: this.id
    };

    this.draggable = makeDraggable(this.actor);

    // Connect signals
    this.signals.connect(this.draggable, 'drag-begin', (...args) => this.onDragBegin(...args));
    this.signals.connect(this.draggable, 'drag-cancelled', (...args) => this.onDragCancelled(...args));
    this.signals.connect(this.draggable, 'drag-end', (...args) => this.onDragEnd(...args));
    this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
    this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
    this.signals.connect(this.actor, 'button-release-event', (...args) => this.handleButtonRelease(...args));
  }

  onDragBegin() {
    this.actor.set_opacity(51);
    this.state.set({categoryDragged: true});
  }

  onDragCancelled() {
    this.actor.set_opacity(255);
    this.state.set({categoryDragged: false});
  }

  onDragEnd() {
    this.actor.set_opacity(255);
    setTimeout(() => this.state.set({categoryDragged: false}), 0);
  }

  _clearDragPlaceholder() {
    if (this.state.dragPlaceholder) {
      this.state.dragPlaceholder.destroy();
      this.state.dragPlaceholder = null;
    }
  }

  selectCategory() {
    if (this.disabled) {
      return false;
    }
    if (this.id) {
      this.state.set({currentCategory: this.id});
    }
  }

  handleEnter(actor, event) {
    if (this.disabled) {
      return false;
    }

    if (event) {
      this.state.trigger('clearEnteredActors');
      if (!this.state.settings.categoryClick) {
        setTimeout(() => this.state.trigger('makeVectorBox', this.actor), 0);
      }
    } else {
      this.state.trigger('scrollToButton', this, true);
    }

    this.entered = true;
    if (this.state.settings.categoryClick) {
      this.actor.set_style_class_name('menu-category-button-selected');
      return;
    }
    this.selectCategory();
    return true;
  }

  handleLeave(actor, event) {
    if (this.disabled) {
      return false;
    }
    this.entered = null;
    if ((!event || this.state.settings.categoryClick) && this.state.currentCategory !== this.id) {
      this.actor.set_style_class_name('menu-category-button');
    }
  }

  handleButtonRelease(actor, event) {
    if (this.disabled
      || (event && event.get_button() > 1)
      || !this.state.settings.categoryClick) {
      return;
    }
    this.selectCategory();
  }

  disable() {
    if (this.actor.has_style_class_name('menu-category-button-greyed')) {
      return false;
    }

    this.actor.set_style_class_name('menu-category-button-greyed');
    this.disabled = true;
    this.entered = null;
  }

  enable() {
    this.actor.set_style_class_name('menu-category-button');
    this.disabled = false;
  }

  _onKeyFocusIn() {
    this.state.trigger('setKeyFocus');
  }

  destroy() {
    for (let i = 0; i < this.connectIds.length; i++) {
      this.state.disconnect(this.connectIds[i]);
    }
    this.signals.disconnectAllSignals();
    this.label.destroy();
    if (this.icon) {
      this.icon.destroy();
    }
    PopupBaseMenuItem.prototype.destroy.call(this);
    unref(this);
  }
};

class ApplicationContextMenuItem extends PopupBaseMenuItem {
  constructor(state, buttonState, label, action, iconName) {
    super({focusOnHover: false});

    this.state = state;
    this.buttonState = buttonState;
    this.signals = new SignalManager(null);
    this.action = action;
    this.label = new Label({
      text: label,
      style: 'font-size: 11px;'
    });
    if (iconName !== null) {
      this.icon = new Icon({
        icon_name: iconName,
        icon_size: 12,
        icon_type: IconType.SYMBOLIC
      });
      if (this.icon) {
        this.addActor(this.icon);
        this.icon.realize();
      }
    }
    this.addActor(this.label);
    this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
    this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
    // Override padding to help prevent label truncation, the menu container width is restricted to the column width,
    // so unless we turn the context menu into a modal somehow (not likely since it will fight for input with the parent),
    // this is the most practical solution for the grid.
    this.actor.set_style('padding-left: 6px !important; padding-right: 0px !important; width: 215px !important;');
    this.setColumnWidths([8, 132])
  }

  handleEnter() {
    this.entered = true;
    this.actor.add_style_pseudo_class('active');
  }

  handleLeave() {
    this.entered = null;
    this.actor.remove_style_pseudo_class('active');
  }

  _onKeyFocusIn() {
    this.state.trigger('setKeyFocus');
  }

  activate(event) {
    if (!this.state || !this.buttonState) {
      return false;
    }
    if (event && event.get_button() === 3) {
      this.buttonState.trigger('toggleMenu');
      return false;
    }
    let destFile;
    switch (this.action) {
      case 'add_to_panel':
        if (!Main.AppletManager.get_role_provider_exists(Main.AppletManager.Roles.PANEL_LAUNCHER)) {
          let new_applet_id = global.settings.get_int('next-applet-id');
          global.settings.set_int('next-applet-id', (new_applet_id + 1));
          let enabled_applets = global.settings.get_strv('enabled-applets');
          enabled_applets.push('panel1:right:0:panel-launchers@cinnamon.org:' + new_applet_id);
          global.settings.set_strv('enabled-applets', enabled_applets);
        }

        Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER)
          .acceptNewLauncher(this.buttonState.app.get_id());

        this.buttonState.trigger('toggleMenu');
        if (this.state) {
          this.state.trigger('openMenu');
        }
        break;
      case 'add_to_desktop':
        destFile = Gio.file_new_for_path(USER_DESKTOP_PATH + '/' + this.buttonState.app.get_id());
        tryFn(() => {
          Gio.file_new_for_path(this.buttonState.app.get_app_info().get_filename())
            .copy(
              Gio.file_new_for_path(USER_DESKTOP_PATH + '/' + this.buttonState.app.get_id()),
              0,
              null,
              null
          );
          changeModeGFile(destFile, 755);
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
        spawnCommandLine('/usr/bin/cinnamon-remove-application \'' + this.buttonState.app.get_app_info().get_filename() + '\'');
        this.state.trigger('closeMenu');
        break;
      case 'run_with_nvidia_gpu':
        spawnCommandLine('optirun gtk-launch ' + this.buttonState.app.get_id());
        this.state.trigger('closeMenu');
        break;
    }
    return false;
  }

  destroy() {
    this.signals.disconnectAllSignals();
    PopupBaseMenuItem.prototype.destroy.call(this);
    unref(this);
  }
};

const addMenuItem = function(t, instance) {
  t.contextMenuButtons.push(instance);
  t.menu.addMenuItem(t.contextMenuButtons[t.contextMenuButtons.length - 1]);
};

class AppListGridButton extends PopupBaseMenuItem {
  constructor(state, app, appType, appIndex, appListLength) {
    super({
      hover: false,
      activate: false
    });
    this.state = state;
    this.connectId = this.state.connect({
      dragIndex: () => {
        if (this.state.dragIndex !== this.buttonState.appIndex
          && this.actor.opacity === 50) {
          this.actor.set_opacity(255);
        }
      },
      searchActive: () => {
        if (!this.state) return;
        // Ensure the reset view is markup-free
        if (this.state.searchActive) {
          this.nameUnformatted = this.buttonState.app.name;
        } else if (this.nameUnformatted) {
          this.buttonState.app.name = this.nameUnformatted;
          this.nameUnformatted = undefined;
        }
      }
    });
    this.buttonState = createStore({
      app: app,
      appType: appType,
      appIndex: appIndex,
      appListLength: appListLength,
      column: -1
    });
    this.buttonState.connect({
      toggleMenu: () => this.toggleMenu()
    });

    this.actor.set_style_class_name('menu-application-button');
    this.actor.set_style('padding-left: 0px; padding-right: 0px;')
    this.actor.x_align = this.state.isListView ? Align.START : Align.MIDDLE;
    this.actor.y_align = Align.MIDDLE;

    if (!this.state.isListView) {
      this.actor.width = this.state.trigger('getAppsGridBoxWidth') / this.state.settings.appsGridColumnCount;
    }

    // DND
    this.actor._delegate = {
      handleDragOver: (source, /* actor, x, y, time */) => {
        if (!source.appIndex
          || source.appIndex === this.buttonState.appIndex
          || this.state.currentCategory !== 'favorites') {
          return DragMotionResult.NO_DROP;
        }
        this.state.set({dragIndex: this.buttonState.appIndex});
        // TODO: We need to set a real placeholder, but to do so, the actor must be attached
        // to applicationsGridBox, or inserted into applicationsListBox.
        this.actor.set_opacity(50);
        return DragMotionResult.MOVE_DROP;
      },
      acceptDrop: (source, /* actor, x, y, time */) => {
        if (!source.appIndex
          || source.appIndex === this.buttonState.appIndex
          || this.state.currentCategory !== 'favorites') {
          this.state.set({dragIndex: -1});
          return DragMotionResult.NO_DROP;
        }
        this.state.trigger('moveFavoriteToPos', source.get_app_id(), this.buttonState.appIndex);
        return true;
      },
      getDragActorSource: () => this.actor,
      _getDragActor: () => new Clone({source: this.actor}),
      getDragActor: () => new Clone({source: this.icon}),
      get_app_id: () => this.buttonState.app.get_id(),
      appIndex: this.buttonState.appIndex
    };

    this.signals = new SignalManager(null);
    this.contextMenuButtons = [];
    this.description = '';
    this.entered = null;

    this.iconContainer = new BoxLayout();

    // appType 0 = application, appType 1 = place, appType 2 = recent
    // Filesystem autocompletion
    if (appType === ApplicationType._completions) {
      this.buttonState.appType = ApplicationType._places;
      this.file = Gio.file_new_for_path(this.buttonState.app.name);
      tryFn(
        () => this.handler = this.file.query_default_handler(null),
        () => this.handler = null
      );
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
          iconObj.icon_type = IconType.FULLCOLOR;
        } else {
          iconObj.gicon = this.buttonState.app.icon;
        }
        this.icon = new Icon(iconObj);
      } else if (this.buttonState.appType === ApplicationType._recent) {
        if (this.buttonState.app.clearList) {
          this.icon = this.buttonState.app.icon;
          this.icon.set_icon_size(this.state.iconSize);
        } else {
          this.icon = new Icon({
            gicon: this.buttonState.app.icon,
            icon_size: this.state.iconSize
          });
        }
      } else if (this.buttonState.appType === ApplicationType._providers) {
        this.icon = this.buttonState.app.icon;
      }
      if (!this.icon) {
        this.icon = new Icon({
          icon_name: 'error',
          icon_size: this.state.iconSize,
          icon_type: IconType.FULLCOLOR
        });
      }
    }

    this.label = new Label({
      text: this.buttonState.app.name,
      style_class: 'menu-application-button-label'
    });

    this.dot = new Widget({
      style: 'width: 4px; height: 4px; background-color: '
        + this.state.theme.foregroundColor
        + '; margin-bottom: 2px; border-radius: 128px;',
      layout_manager: new BinLayout(),
      x_expand: true,
      y_expand: false,
      x_align: ActorAlign.CENTER,
      y_align: ActorAlign.END
    });

    this.buttonBox = new BoxLayout({
      vertical: !this.state.isListView,
      width: 240 * global.ui_scale,
      y_expand: false
    });

    if (this.icon) {
      this.iconContainer.add(this.icon, {
        x_fill: false,
        y_fill: false,
        x_align: this.state.isListView ? Align.END : Align.MIDDLE,
        y_align: this.state.isListView ? Align.END : Align.START
      });
    }

    this.buttonBox.add(this.iconContainer, {
      x_fill: false,
      y_fill: false,
      x_align: this.state.isListView ? Align.START : Align.MIDDLE,
      y_align: Align.MIDDLE
    });
    this.buttonBox.add(this.label, {
      x_fill: false,
      y_fill: false,
      x_align: this.state.isListView ? Align.START : Align.MIDDLE,
      y_align: Align.MIDDLE
    });
    this.iconContainer.add(this.dot, {
      x_fill: false,
      y_fill: true,
      x_align: this.state.isListView ? Align.END : Align.MIDDLE,
      y_align: this.state.isListView ? Align.END : Align.START
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
      this.menu = new PopupSubMenu(this.actor);
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
    if (this.state.settings.descriptionPlacement === 2
      || this.buttonState.app.shouldHighlight) {
      this.formatLabel({});
    }

    // Connect signals
    if (this.buttonState.appType === ApplicationType._applications) {
      this.actor._delegate.isDraggableApp = true;
      this.draggable = makeDraggable(this.actor);
      this.signals.connect(this.buttonState.app, 'notify::state', (...args) => this.onStateChanged(...args));
      this.signals.connect(this.draggable, 'drag-begin', (...args) => this.onDragBegin(...args));
      this.signals.connect(this.draggable, 'drag-cancelled', (...args) => this.onDragCancelled(...args));
      this.signals.connect(this.draggable, 'drag-end', (...args) => this.onDragEnd(...args));
    }

    // Check if running state
    this.dot.opacity = 0;
    this.onStateChanged();

    this.signals.connect(this.actor, 'button-press-event', (...args) => this.handleButtonPress(...args));
    this.signals.connect(this.actor, 'button-release-event', (...args) => this.handleButtonRelease(...args));
    this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
    this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
    this.signals.connect(this.actor, 'parent-set', (...args) => this.handleParentChange(...args));
  }

  onDragBegin() {
    this.actor.set_opacity(51);
  }

  onDragCancelled() {
    this.actor.set_opacity(255);
  }

  onDragEnd() {
    this.actor.set_opacity(255);
  }

  _clearDragPlaceholder() {
    if (this.state.dragPlaceholder) {
      this.state.dragPlaceholder.destroy();
      this.state.dragPlaceholder = null;
    }
  }

  handleParentChange() {
    if (this.state.settings.descriptionPlacement === 2
      || this.buttonState.app.shouldHighlight
      || this.state.searchActive) {
      this.formatLabel({});
    }
    if (!this.buttonState.app.description && this.buttonState.appType === ApplicationType._applications) {
      this.buttonState.app.description = this.state.fallbackDescription;
    }
  }

  formatLabel(opts) {
    let limit = this.state.isListView ? 80 : 300;
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
    if (this.state.settings.descriptionPlacement === 2) {
      if (!this.state.isListView) {
        let width = this.description ? this.description.length : description ? description.length : 0;
        this.label.set_style('text-align: center;min-width: ' + width.toString() + 'px;');
      }
      markup += '\n<span size="small">' + description + '</span>';
    }
    let tooltipMarkup;
    let tooltipShouldShowName = this.buttonState.appType !== ApplicationType._applications;
    if (this.state.settings.descriptionPlacement === 1 && opts.tooltipFormat) {
      if (tooltipShouldShowName) {
        let tooltipName = name;
        if (tooltipName.length > limit) {
          tooltipName = wordWrap(name, limit);
        }
        tooltipMarkup = '<span>' + tooltipName + '</span>';
      }
      if (description.length > 0) {
        let tooltipDescription = description;
        if (description.length > limit) {
          tooltipDescription = wordWrap(description, limit);
        }
        if (tooltipShouldShowName) {
          tooltipMarkup += '\n<span size="small">' + tooltipDescription + '</span>';
        } else {
          tooltipMarkup = tooltipDescription;
        }
      }
    } else if (this.state.settings.descriptionPlacement > 1) {
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
      && (this.state.settings.descriptionPlacement === 2
        || this.state.searchActive
        || this.buttonState.app.shouldHighlight)
        || opts.removeFormatting) {
      clutterText.set_markup(markup);
      clutterText.ellipsize = EllipsizeMode.END;
    }
  }

  clearMarqueeTimer() {
    if (this.marqueeTimer) {
      clearTimeout(this.marqueeTimer);
      this.marqueeTimer = 0;
    }
  }

  handleMarquee(opts) {
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
  }

  _onKeyFocusIn() {
    this.state.trigger('setKeyFocus');
  }

  handleEnter(actor, event) {
    if (this.state.contextMenuIsOpen != null || this.menu.isOpen || this.state.dragIndex > -1) {
      return false;
    }

    if (event) {
      this.state.trigger('clearEnteredActors');
      if (this.state.settings.descriptionPlacement === 3 && (this.state.isListView || this.state.settings.appsGridColumnCount < 3)) {
        this.state.trigger('toggleSearchVisibility', false);
      }
    } else {
      this.state.trigger('scrollToButton', this);
    }

    this.entered = true;
    this.state.set({itemEntered: true});
    this.actor.set_style_class_name('menu-application-button-selected');

    // Check marquee conditions, and set it up
    let labelWidth, actorWidth, allocatedTextLength;
    if (this.state.settings.descriptionPlacement === 2) {
      labelWidth = this.label.get_size()[0];
      actorWidth = this.actor.get_size()[0];
      allocatedTextLength = this.state.isListView ? 80 : (this.state.settings.appsGridColumnCount * 8);
    } else {
      this.formatLabel({});
      labelWidth = this.buttonState.app.description ? this.buttonState.app.description.length
        : this.buttonState.app.name ? this.buttonState.app.name
        : 16;
      actorWidth = 16;
      allocatedTextLength = 16;
    }
    if (labelWidth > actorWidth && !this.marqueeTimer && this.state.settings.descriptionPlacement > 1) {
      this.description = this.buttonState.app.description.replace(stripMarkupRegex, '');
      this.marqueeTimer = setTimeout(()=>this.handleMarquee({
        start: 0,
        end: allocatedTextLength,
        firstRecursion: true,
        reset: 0
      }), 1000);
    } else {
      this.formatLabel({tooltipFormat: true});
      if (this.state.settings.descriptionPlacement === 1) {
        let {width, height} = this.actor;
        this.state.trigger('setTooltip', this.actor.get_transformed_position(), width, height, this.tooltipMarkup);
      }
    }
    return false;
  }

  handleLeave(actor, event) {
    if (this.state.contextMenuIsOpen === this.buttonState.appIndex && this.menu.isOpen || this.state.dragIndex > -1) {
      return false;
    }

    if (event && this.state.settings.descriptionPlacement === 3 && (this.state.isListView || this.state.settings.appsGridColumnCount < 3)) {
      this.state.trigger('toggleSearchVisibility', true);
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
    if (this.state.settings.descriptionPlacement === 1) {
      this.state.trigger('setTooltip');
    } else if (this.state.settings.descriptionPlacement !== 2) {
      this.state.trigger('setSelectedTitleText', '');
      this.state.trigger('setSelectedDescriptionText', '');
    }
  }

  handleButtonPress() {
    this.state.set({categoryDragged: true});
  }

  handleButtonRelease(actor, e) {
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
  }

  activate() {
    if (this.file) {
      if (this.handler) {
        this.handler.launch([this.file], null);
      } else {
        tryFn(
          () => spawn(['gvfs-open', this.buttonState.app.uri]),
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
  }

  activateContextMenus(event, closeAll) {
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
  }

  onStateChanged() {
    if (!this.buttonState.app || this.dot.is_finalized()) {
      return false;
    }
    if (this.buttonState.appType === ApplicationType._applications) {
      if (this.buttonState.app.state !== AppState.STOPPED) {
        this.dot.opacity = 255;
      } else {
        this.dot.opacity = 0;
      }
    }
    return true;
  }

  closeMenu() {
    if (this.buttonState.appType !== ApplicationType._applications) {
      return;
    }
    this.menu.close();
    this.clearMarqueeTimer();
    if (this.state.isListView) this.label.show();
  }

  prepareContextMenu() {
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
  }

  toggleMenu() {
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
      if (this.state.isBumblebeeInstalled) {
        addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState, _('Run with NVIDIA GPU'), 'run_with_nvidia_gpu', 'cpu'));
      }

      if (this.state.isListView) {
        this.label.hide();
      } else {
        // In grid mode we will ensure our menu isn't overlapped by any other actors.
        let parent = this.actor.get_parent();
        if (!parent) return true; // Favorite change
        this.actor.get_parent().set_child_above_sibling(this.actor, null);

      }
    }
    this.menu.toggle_with_options(this.state.settings.enableAnimation);
    return true
  }

  clearSearchFormatting() {
    this.formatLabel({
      removeFormatting: true
    });
  }

  destroy(skipDestroy) {
    this.clearMarqueeTimer();
    this.state.disconnect(this.connectId);
    this.signals.disconnectAllSignals();

    if (!skipDestroy) {
      this.dot.destroy();
      this.label.destroy();
      if (this.icon) {
        this.icon.destroy();
      }
      if (this.iconContainer) {
        this.iconContainer.destroy();
      }
      this.buttonBox.destroy();
    }
    PopupBaseMenuItem.prototype.destroy.call(this);
    unref(this);
  }
};

class GroupButton extends PopupBaseMenuItem {
  constructor(state, iconName, iconSize, name, description, callback) {
    super({
      hover: false,
      activate: false
    });
    this.state = state;
    this.signals = new SignalManager(null);
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
        icon_type: adjustedIconSize <= 25 ? IconType.SYMBOLIC : IconType.FULLCOLOR
      };
      if (iconName === 'user') {
        this.defaultAvatar = new Gio.ThemedIcon({
          name: 'avatar-default'
        });
        iconObj.gicon = this.defaultAvatar;
        this.name = GLib.get_user_name();
        this.user = UserManager.get_default().get_user(this.name);
        this.signals.connect(this.user, 'notify::is_loaded', (...args) => this.onUserChanged(...args));
        this.signals.connect(this.user, 'changed', (...args) => this.onUserChanged(...args));
        setTimeout(() => this.onUserChanged(), 0);
      } else {
        iconObj.icon_name = iconName;
      }
      this.iconSize = adjustedIconSize;
      this.icon = new Icon(iconObj);
      this.addActor(this.icon);
      this.icon.realize();
    }
    this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
    this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
    this.signals.connect(this.actor, 'button-release-event', (...args) => this.handleButtonRelease(...args));
  }

  onUserChanged() {
    if (!this.user || !this.user.is_loaded || this.icon.is_finalized()) {
      return;
    }
    this.name = this.user.get_real_name();
    if (this.icon) {
      let iconFileName = this.user.get_icon_file();
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

  handleButtonRelease(actor, event) {
    if (event && event.get_button() > 1) {
      return;
    }
    if (this.user || this.icon.icon_name.indexOf('view') === -1) {
      this.state.trigger('closeMenu');
    }
    if (this.icon.icon_name && this.icon.icon_name.indexOf('view') > -1) {
      this.toggleViewMode();
    } else if (this.callback) {
      this.callback();
    }
    return true;
  }

  handleEnter(actor) {
    if (actor) {
      this.state.trigger('clearEnteredActors');
    }
    this.entered = true;
    if (!this.actor) return;
    this.actor.add_style_pseudo_class('hover');
    if (this.state.settings.descriptionPlacement === 1) {
      let [x, y] = this.actor.get_transformed_position();
      y -= ((this.actor.height * 2) + 8);
      x -= (this.actor.width / 2) - 8;
      if (global.ui_scale > 1) {
        y += 12;
        x += 20;
      }
      this.state.trigger(
        'setTooltip',
        [x, y],
        0,
        0,
        `<span>${this.name}${this.description ? '\n<span size="small">' + this.description + '</span>' : ''}</span>`
      );
    } else {
      this.state.trigger('setSelectedTitleText', this.name);
      if (this.description) {
        this.state.trigger('setSelectedDescriptionText', this.description);
      }
    }
  }

  handleLeave() {
    this.entered = null;
    this.actor.remove_style_pseudo_class('hover');
    if (this.state.settings.descriptionPlacement === 1) {
      this.state.trigger('setTooltip');
    } else {
      this.state.trigger('setSelectedTitleText', '');
      if (this.description) {
        this.state.trigger('setSelectedDescriptionText', '');
      }
    }
  }

  setIcon(iconName) {
    this.removeActor(this.icon);
    this.icon.destroy();
    this.icon = this.icon = new Icon({
      icon_name: iconName,
      icon_size: this.iconSize,
      icon_type: IconType.FULLCOLOR
    });
    this.addActor(this.icon);
    this.icon.realize();
  }

  toggleViewMode() {
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
    this.handleLeave();
    setTimeout(() => this.handleEnter(), 300);
  }

  destroy() {
    this.signals.disconnectAllSignals();

    if (this.icon) {
      this.icon.destroy();
    }

    super.destroy();
    unref(this);
  }
};

module.exports = {CategoryListButton, AppListGridButton, GroupButton};