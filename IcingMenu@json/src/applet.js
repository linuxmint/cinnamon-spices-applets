const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const CMenu = imports.gi.CMenu;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Gio = imports.gi.Gio;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const Util = imports.misc.util;
const Meta = imports.gi.Meta;
const DocInfo = imports.misc.docInfo;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const SearchProviderManager = imports.ui.searchProviderManager;
const ajax = imports.applet.ajax
const setTimeout = imports.applet.setTimeout
const clog = imports.applet.clog


const AppletDir = imports.ui.appletManager.applets['IcingMenu@json']
const kmp = AppletDir.kmp.kmp
const TransientButton = AppletDir.buttons.TransientButton
const ApplicationButton = AppletDir.buttons.ApplicationButton
const SearchProviderResultButton = AppletDir.buttons.SearchProviderResultButton
const PlaceButton = AppletDir.buttons.PlaceButton
const RecentButton = AppletDir.buttons.RecentButton
const RecentClearButton = AppletDir.buttons.RecentClearButton
const CategoryButton = AppletDir.buttons.CategoryButton
const PlaceCategoryButton = AppletDir.buttons.PlaceCategoryButton
const RecentCategoryButton = AppletDir.buttons.RecentCategoryButton
const FavoritesButton = AppletDir.buttons.FavoritesButton
const SystemButton = AppletDir.buttons.SystemButton
const CategoriesApplicationsBox = AppletDir.buttons.CategoriesApplicationsBox
const FavoritesBox = AppletDir.buttons.FavoritesBox
const NoRecentDocsButton = AppletDir.buttons.NoRecentDocsButton

const MAX_RECENT_FILES = 20;

const INITIAL_BUTTON_LOAD = 30;

const PRIVACY_SCHEMA = 'org.cinnamon.desktop.privacy';
const REMEMBER_RECENT_KEY = 'remember-recent-files';

let appsys = Cinnamon.AppSystem.get_default();

/* VisibleChildIterator takes a container (boxlayout, etc.)
 * and creates an array of its visible children and their index
 * positions.  We can then work through that list without
 * mucking about with positions and math, just give a
 * child, and it'll give you the next or previous, or first or
 * last child in the list.
 *
 * We could have this object regenerate off a signal
 * every time the visibles have changed in our applicationBox,
 * but we really only need it when we start keyboard
 * navigating, so increase speed, we reload only when we
 * want to use it.
 */

function VisibleChildIterator(container) {
  this._init(container);
}

VisibleChildIterator.prototype = {
  _init: function(container) {
    this.container = container;
    this.reloadVisible();
  },

  reloadVisible: function() {
    this.array = this.container.get_focus_chain()
      .filter(x => !(x._delegate instanceof PopupMenu.PopupSeparatorMenuItem));
  },

  getNextVisible: function(curChild) {
    return this.getVisibleItem(this.array.indexOf(curChild) + 1);
  },

  getPrevVisible: function(curChild) {
    return this.getVisibleItem(this.array.indexOf(curChild) - 1);
  },

  getFirstVisible: function() {
    return this.array[0];
  },

  getLastVisible: function() {
    return this.array[this.array.length - 1];
  },

  getVisibleIndex: function(curChild) {
    return this.array.indexOf(curChild);
  },

  getVisibleItem: function(index) {
    let len = this.array.length;
    index = ((index % len) + len) % len;
    return this.array[index];
  },

  getNumVisibleChildren: function() {
    return this.array.length;
  },

  getAbsoluteIndexOfChild: function(child) {
    return this.container.get_children().indexOf(child);
  }
};

function MyApplet(orientation, panel_height, instance_id) {
  this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _init: function (orientation, panel_height, instance_id) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    this.c32 = true
    try {
      this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    } catch (e) {
      this.c32 = null
    }
    this.initializing = true;

    this.initial_load_done = false;

    this.set_applet_tooltip(_('Menu'));
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.orientation = orientation;

    this.actor.connect('key-press-event', (actor, event)=>this._onSourceKeyPress(actor, event));

    this.settings = new Settings.AppletSettings(this, 'IcingMenu@json', instance_id);

    this._appletEnterEventId = 0;
    this._appletLeaveEventId = 0;
    this._appletHoverDelayId = 0;
    
    if (this.c32) {
      this.menu.setCustomStyleClass('menu-background');
    } else {
      this.menu.actor.add_style_class_name('menu-background')
    }
    this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));

    var settingsProps = [
      {key: 'autoUpdate', value: 'autoUpdate', cb: this.handleUpdate},
      {key: 'show-places', value: 'showPlaces', cb: this._refreshBelowApps},
      {key: 'hover-delay', value: 'hover_delay_ms', cb: this._updateActivateOnHover},
      {key: 'activate-on-hover', value: 'activateOnHover', cb: this._updateActivateOnHover},
      {key: 'menu-icon-custom', value: 'menuIconCustom', cb: this._updateIconAndLabel},
      {key: 'menu-icon', value: 'menuIcon', cb: this._updateIconAndLabel},
      {key: 'menu-label', value: 'menuLabel', cb: this._updateIconAndLabel},
      {key: 'overlay-key', value: 'overlayKey', cb: this._updateKeybinding},
      {key: 'menu-height', value: 'menuHeight', cb: this._recalc_height},
      {key: 'menu-width', value: 'menuWidth', cb: this._refreshMenu},
      {key: 'search-position', value: 'searchPosition', cb: this._refreshMenu},
      {key: 'appInfo-position', value: 'appInfoPosition', cb: this._refreshMenu},
      {key: 'show-scrollbar', value: 'showScrollbar', cb: this._refreshMenu},
      {key: 'show-category-icons', value: 'showCategoryIcons', cb: this._refreshAll},
      {key: 'show-application-icons', value: 'showApplicationIcons', cb: this._refreshAll},
      {key: 'favbox-show', value: 'favBoxShow', cb: this._reloadApp},
      {key: 'enable-animation', value: 'enableAnimation', cb: null}
    ];

    if (this.c32) {
      for (let i = 0, len = settingsProps.length; i < len; i++) {
        this.settings.bind(settingsProps[i].key, settingsProps[i].value, settingsProps[i].cb);
      }
    } else {
      for (let i = 0, len = settingsProps.length; i < len; i++) {
        this.settings.bindProperty(Settings.BindingDirection.IN, settingsProps[i].key, settingsProps[i].value, settingsProps[i].cb, null)
      }
    }

    this._updateActivateOnHover();

    this._updateKeybinding();

    Main.themeManager.connect('theme-set', Lang.bind(this, this._updateIconAndLabel));
    this._updateIconAndLabel();

    this._searchInactiveIcon = new St.Icon({
      style_class: 'menu-search-entry-icon',
      icon_name: 'edit-find',
      icon_type: St.IconType.SYMBOLIC
    });
    this._searchActiveIcon = new St.Icon({
      style_class: 'menu-search-entry-icon',
      icon_name: 'edit-clear',
      icon_type: St.IconType.SYMBOLIC
    });
    this._searchIconClickedId = 0;
    this._applicationsButtons = [];
    this._applicationsButtonFromApp = {};
    this._favoritesButtons = [];
    this._placesButtons = [];
    this._transientButtons = [];
    this.recentButton = null;
    this._recentButtons = [];
    this._categoryButtons = [];
    this._searchProviderButtons = [];
    this._selectedItemIndex = null;
    this._previousSelectedActor = null;
    this._previousVisibleIndex = null;
    this._previousTreeSelectedActor = null;
    this._activeContainer = null;
    this._activeActor = null;
    this._applicationsBoxWidth = 0;
    this.menuIsOpening = false;
    this._knownApps = []; // Used to keep track of apps that are already installed, so we can highlight newly installed ones
    this._appsWereRefreshed = false;
    this._canUninstallApps = GLib.file_test('/usr/bin/cinnamon-remove-application', GLib.FileTest.EXISTS);
    this._isBumblebeeInstalled = GLib.file_test('/usr/bin/optirun', GLib.FileTest.EXISTS);
    this.RecentManager = new DocInfo.DocManager();
    this.privacy_settings = new Gio.Settings({
      schema_id: PRIVACY_SCHEMA
    });
    this.noRecentDocuments = true;
    this._activeContextMenuParent = null;
    this._activeContextMenuItem = null;
    this._display();
    appsys.connect('installed-changed', Lang.bind(this, this.onAppSysChanged));
    AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._refreshFavs));
    Main.placesManager.connect('places-updated', Lang.bind(this, this._refreshBelowApps));
    this.RecentManager.connect('changed', Lang.bind(this, this._refreshRecent));
    this.privacy_settings.connect('changed::' + REMEMBER_RECENT_KEY, Lang.bind(this, this._refreshRecent));
    this._fileFolderAccessActive = false;
    this._pathCompleter = new Gio.FilenameCompleter();
    this._pathCompleter.set_dirs_only(false);
    this.lastAcResults = [];

    if (typeof this.settings.bind === 'function') {
      this.settings.bind('search-filesystem', 'searchFilesystem');
    } else {
      this.settings.bindProperty(Settings.BindingDirection.IN, 'search-filesystem', 'searchFilesystem', null, null);
    }

    this.refreshing = false; // used as a flag to know if we're currently refreshing (so we don't do it more than once concurrently)

    this.recentContextMenu = null;
    this.appsContextMenu = null;

    // We shouldn't need to call refreshAll() here... since we get a 'icon-theme-changed' signal when CSD starts.
    // The reason we do is in case the Cinnamon icon theme is the same as the one specificed in GTK itself (in .config)
    // In that particular case we get no signal at all.
    this._refreshAll(this.initializing);

    St.TextureCache.get_default().connect('icon-theme-changed', Lang.bind(this, this.onIconThemeChanged));
    this._recalc_height();

    this.update_label_visible();

    // Wait 3s, as Cinnamon doesn't populate Applet._meta until after the applet loads.
    setTimeout(()=>this.handleUpdate(), 3000)
  },

  handleUpdate(){
    if (this.autoUpdate) {
      this.version = `v${this._meta.version}`
      // Parse out the HTML response instead of using the API endpoint to work around Github's API limit.
      ajax({method: 'GET', url: 'https://github.com/jaszhix/icingmenu/releases/latest', json: false}).then((res)=>{
        let split = '/jaszhix/icingmenu/releases/download/'
        let end = res.split(split)[1].split('.zip')[0]
        let version = end.split('/')[0]
        let file = `https://github.com${split}${end}.zip`
        if (version !== this.version) {
          let now = Date.now()
          Main.notify('Icing Menu is updating...', 'Go to settings if you wish to disable automatic updates.')
          Util.trySpawnCommandLine(`bash -c 'wget -O /tmp/IcingMenu-${now}.zip ${file}'`)
          // Defer for conservative durations due to lack of callback from Utils CLI methods
          setTimeout(()=>{
            Util.trySpawnCommandLine(`bash -c 'unzip -o /tmp/IcingMenu-${now}.zip -d ~/.local/share/cinnamon/applets/IcingMenu@json/'`)
            setTimeout(()=>this._reloadApp(), 10000)
          }, 10000)
        }
      }).catch((e)=>{
        return null
      })
    }
  },

  _reloadApp: function () {
    Util.trySpawnCommandLine(`bash -c "python ~/.local/share/cinnamon/applets/IcingMenu@json/utils.py reload"`)
  },


  _updateKeybinding: function () {
    Main.keybindingManager.addHotKey('overlay-key-' + this.instance_id, this.overlayKey, Lang.bind(this, function () {
      if (!Main.overview.visible && !Main.expo.visible) {
        this.menu.toggle_with_options(this.enableAnimation);
      }
    }));
  },

  onIconThemeChanged: function () {
    if (!this.refreshing && !this.initializing) {
      this.refreshing = true;
      Mainloop.timeout_add_seconds(1, Lang.bind(this, this._refreshAll));
    }
  },

  onAppSysChanged: function () {
    if (!this.refreshing) {
      this.refreshing = true;
      Mainloop.timeout_add_seconds(1, Lang.bind(this, this._refreshAll));
    }
  },

  _refreshAll: function (init=null) {
    try {
      this._refreshApps();
      this._refreshFavs();
      this._refreshPlaces();
      this._refreshRecent(init);
    } catch (exception) {
      global.log(exception);
    }
    this.refreshing = false;
  },

  _refreshBelowApps: function () {
    this._refreshPlaces();
    this._refreshRecent();
  },

  openMenu: function () {
    if (!this._applet_context_menu.isOpen) {
      this.menu.open(this.enableAnimation);
    }
  },

  _clearDelayCallbacks: function () {
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

  _updateActivateOnHover: function () {
    if (this._appletEnterEventId > 0) {
      this.actor.disconnect(this._appletEnterEventId);
      this._appletEnterEventId = 0;
    }

    this._clearDelayCallbacks();

    if (this.activateOnHover) {
      this._appletEnterEventId = this.actor.connect('enter-event', Lang.bind(this, function () {
        if (this.hover_delay_ms > 0) {
          this._appletLeaveEventId = this.actor.connect('leave-event', Lang.bind(this, this._clearDelayCallbacks));
          this._appletHoverDelayId = Mainloop.timeout_add(this.hover_delay_ms,
            Lang.bind(this, function () {
              this.openMenu();
              this._clearDelayCallbacks();
            }));
        } else {
          this.openMenu();
        }
      }));
    }
  },

  _recalc_height: function () {
    //let scrollBoxHeight = (this.leftBox.get_allocation_box().y2 - this.leftBox.get_allocation_box().y1) - (this.searchBox.get_allocation_box().y2 - this.searchBox.get_allocation_box().y1) / global.ui_scale;
    this.applicationsScrollBox.style = `height: ${this.menuHeight}px; width: ${this.menuWidth}px;`;
  },

  update_label_visible: function () {
    if (this.c32) {
      if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
        this.hide_applet_label(true);
      } else {
        this.hide_applet_label(false);
      }
    }
  },

  _refreshMenu(){
    this.on_orientation_changed(this.orientation)
  },

  on_orientation_changed: function (orientation) {
    this.orientation = orientation;

    this.update_label_visible();

    this.menu.destroy();
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    if (this.c32) {
      this.menu.setCustomStyleClass('menu-background');
    } else {
      this.menu.actor.add_style_class_name('menu-background');
    }
    this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));
    this._display();

    if (this.initial_load_done) {
      this._refreshAll();
    }
    this._updateIconAndLabel();
  },

  on_applet_added_to_panel: function () {
    this.initial_load_done = true;
  },

  on_applet_removed_from_panel: function () {
    Main.keybindingManager.removeHotKey('overlay-key-' + this.instance_id)
  },

  _launch_editor: function () {
    Util.spawnCommandLine('cinnamon-menu-editor');
  },

  on_applet_clicked: function (event) {
    this.menu.toggle_with_options(this.enableAnimation);
  },

  _onSourceKeyPress: function (actor, event) {
    let symbol = event.get_key_symbol();

    if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
      this.menu.toggle();
      return true;
    } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
      this.menu.close();
      return true;
    } else if (symbol == Clutter.KEY_Down) {
      if (!this.menu.isOpen) {
        this.menu.toggle();
      }
      this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
      return true;
    } else {
      return false;
    }
  },

  _onOpenStateChanged: function (menu, open) {
    if (open) {
      if (this._appletEnterEventId > 0) {
        this.actor.handler_block(this._appletEnterEventId);
      }
      this.menuIsOpening = true;
      this.actor.add_style_pseudo_class('active');

      if (this.searchPosition !== 'none') {
        global.stage.set_key_focus(this.searchEntry);
      }

      this._selectedItemIndex = null;
      this._activeContainer = null;
      this._activeActor = null;


      let n = Math.min(this._applicationsButtons.length,
        INITIAL_BUTTON_LOAD);
      for (let i = 0; i < n; i++) {
        this._applicationsButtons[i].actor.show();
      }
      this._allAppsCategoryButton.actor.style_class = 'menu-category-button-selected';
      Mainloop.idle_add(Lang.bind(this, this._initial_cat_selection, n));
    } else {
      if (this._appletEnterEventId > 0) {
        this.actor.handler_unblock(this._appletEnterEventId);
      }

      this.actor.remove_style_pseudo_class('active');
      if (this.searchActive) {
        this.resetSearch();
      }
      
      if (this.appInfoPosition !== 'none') {
        this.selectedAppTitle.set_text('');
        this.selectedAppDescription.set_text('');
      }

      this._previousTreeSelectedActor = null;
      this._previousSelectedActor = null;
      this.closeContextMenus(null, false);

      this._clearAllSelections(true);
      this.destroyVectorBox();
    }
  },

  _initial_cat_selection: function (start_index) {
    let n = this._applicationsButtons.length;
    for (let i = start_index; i < n; i++) {
      this._applicationsButtons[i].actor.show();
    }
  },

  destroy: function () {
    this.actor._delegate = null;
    this.menu.destroy();
    this.actor.destroy();
    this.emit('destroy');
  },

  _set_default_menu_icon: function () {
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

  _favboxtoggle: function () {
    if (!this.favBoxShow) {
      this.leftPane.hide();
    } else {
      this.leftPane.show();
    }
  },

  _updateIconAndLabel: function () {
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
      global.logWarning(`Could not load icon file ${this.menuIcon} for menu button`);
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
      if (this.menuLabel !== '') {
        this.set_applet_label(_(this.menuLabel)); // TBD
      } else {
        this.set_applet_label('');
      }
    }
  },

  _navigateContextMenu: function (actor, symbol, ctrlKey) {
    if (symbol === Clutter.KEY_Menu || symbol === Clutter.Escape ||
      (ctrlKey && (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter))) {
      actor.activateContextMenus();
      return;
    }

    let goUp = symbol === Clutter.KEY_Up;
    let nextActive = null;
    let menuItems = actor.menu._getMenuItems(); // The context menu items

    // The first context menu item of a RecentButton is used just as a label.
    // So remove it from the iteration.
    if (actor instanceof RecentButton) {
      menuItems.shift();
    }

    let menuItemsLength = menuItems.length;

    switch (symbol) {
    case Clutter.KEY_Page_Up:
      this._activeContextMenuItem = menuItems[0];
      this._activeContextMenuItem.setActive(true);
      return;
    case Clutter.KEY_Page_Down:
      this._activeContextMenuItem = menuItems[menuItemsLength - 1];
      this._activeContextMenuItem.setActive(true);
      return;
    }

    if (!this._activeContextMenuItem) {
      if (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter) {
        actor.activate();
      } else {
        this._activeContextMenuItem = menuItems[goUp ? menuItemsLength - 1 : 0];
        this._activeContextMenuItem.setActive(true);
      }
      return;
    } else if (this._activeContextMenuItem &&
      (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter)) {
      this._activeContextMenuItem.activate();
      this._activeContextMenuItem = null;
      return;
    }

    let i = 0;
    for (; i < menuItemsLength; i++) {
      if (menuItems[i] === this._activeContextMenuItem) {
        nextActive = goUp ? (menuItems[i - 1] || null) : (menuItems[i + 1] || null);
        break;
      }
    }

    if (!nextActive) {
      nextActive = goUp ? menuItems[menuItemsLength - 1] : menuItems[0];
    }

    nextActive.setActive(true);
    this._activeContextMenuItem = nextActive;
  },

  _onMenuKeyPress: function (actor, event) {
    let symbol = event.get_key_symbol();
    let item_actor;
    let index = 0;
    this.appBoxIter.reloadVisible();
    this.catBoxIter.reloadVisible();
    this.favBoxIter.reloadVisible();

    let keyCode = event.get_key_code();
    let modifierState = Cinnamon.get_event_state(event);

    /* check for a keybinding and quit early, otherwise we get a double hit
       of the keybinding callback */
    let action = global.display.get_keybinding_action(keyCode, modifierState);

    if (action == Meta.KeyBindingAction.CUSTOM) {
      return true;
    }

    index = this._selectedItemIndex;

    let ctrlKey = modifierState & Clutter.ModifierType.CONTROL_MASK;

    // If a context menu is open, hijack keyboard navigation and concentrate on the context menu.
    if (this._activeContextMenuParent && this._activeContextMenuParent._contextIsOpen &&
      this._activeContainer === this.applicationsBox &&
      (this._activeContextMenuParent instanceof ApplicationButton ||
        this._activeContextMenuParent instanceof RecentButton)) {
      let continueNavigation = false;
      switch (symbol) {
      case Clutter.KEY_Up:
      case Clutter.KEY_Down:
      case Clutter.KEY_Return:
      case Clutter.KP_Enter:
      case Clutter.KEY_Menu:
      case Clutter.KEY_Page_Up:
      case Clutter.KEY_Page_Down:
      case Clutter.Escape:
        this._navigateContextMenu(this._activeContextMenuParent, symbol, ctrlKey);
        break;
      case Clutter.KEY_Right:
      case Clutter.KEY_Left:
      case Clutter.Tab:
      case Clutter.ISO_Left_Tab:
        continueNavigation = true;
        break;
      }
      if (!continueNavigation) {
        return true;
      }
    }

    let navigationKey = true;
    let whichWay = 'none';

    switch (symbol) {
    case Clutter.KEY_Up:
      whichWay = 'up';
      if (this._activeContainer === this.favoritesBox && ctrlKey &&
        (this.favoritesBox.get_child_at_index(index))._delegate instanceof FavoritesButton) {
        navigationKey = false;
      }
      break;
    case Clutter.KEY_Down:
      whichWay = 'down';
      if (this._activeContainer === this.favoritesBox && ctrlKey &&
        (this.favoritesBox.get_child_at_index(index))._delegate instanceof FavoritesButton) {
        navigationKey = false;
      }
      break;
    case Clutter.KEY_Page_Up:
      whichWay = 'top';
      break;
    case Clutter.KEY_Page_Down:
      whichWay = 'bottom';
      break;
    case Clutter.KEY_Right:
      if (!this.searchActive) {
        whichWay = 'right';
      }
      if (this._activeContainer === this.applicationsBox) {
        whichWay = 'none';
      }
      else if (this._activeContainer === this.categoriesBox && this.noRecentDocuments 
        && (this.categoriesBox.get_child_at_index(index))._delegate instanceof RecentCategoryButton) {
        whichWay = 'none';
      }
      break;
    case Clutter.KEY_Left:
      if (!this.searchActive) {
        whichWay = 'left';
      }
      if (this._activeContainer === this.favoritesBox) {
        whichWay = 'none';
      }
      else if (!this.favBoxShow &&
        (this._activeContainer === this.categoriesBox || this._activeContainer === null)) {
        whichWay = 'none';
      }
      break;
    case Clutter.Tab:
      if (!this.searchActive) {
        whichWay = 'right';
      } else {
        navigationKey = false;
      }
      break;
    case Clutter.ISO_Left_Tab:
      if (!this.searchActive) {
        whichWay = 'left';
      } else {
        navigationKey = false;
      }
      break;
    default:
      navigationKey = false;
    }

    if (navigationKey) {
      switch (this._activeContainer) {
      case null:
        switch (whichWay) {
        case 'up':
          this._activeContainer = this.categoriesBox;
          item_actor = this.catBoxIter.getLastVisible();
          this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
          break;
        case 'down':
          this._activeContainer = this.categoriesBox;
          item_actor = this.catBoxIter.getFirstVisible();
          item_actor = this.catBoxIter.getNextVisible(item_actor);
          this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
          break;
        case 'right':
          this._activeContainer = this.applicationsBox;
          item_actor = this.appBoxIter.getFirstVisible();
          this._scrollToButton(item_actor._delegate);
          break;
        case 'left':
          if (this.favBoxShow) {
            this._activeContainer = this.favoritesBox;
            item_actor = this.favBoxIter.getFirstVisible();
          } else {
            this._activeContainer = this.applicationsBox;
            item_actor = this.appBoxIter.getFirstVisible();
            this._scrollToButton(item_actor._delegate);
          }
          break;
        case 'top':
          this._activeContainer = this.categoriesBox;
          item_actor = this.catBoxIter.getFirstVisible();
          this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
          break;
        case 'bottom':
          this._activeContainer = this.categoriesBox;
          item_actor = this.catBoxIter.getLastVisible();
          this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
          break;
        }
        break;
      case this.categoriesBox:
        switch (whichWay) {
        case 'up':
          this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
          this._previousTreeSelectedActor._delegate.isHovered = false;
          item_actor = this.catBoxIter.getPrevVisible(this._activeActor);
          this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
          break;
        case 'down':
          this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
          this._previousTreeSelectedActor._delegate.isHovered = false;
          item_actor = this.catBoxIter.getNextVisible(this._activeActor);
          this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
          break;
        case 'right':
          if ((this.categoriesBox.get_child_at_index(index))._delegate instanceof RecentCategoryButton &&
            this.noRecentDocuments) {
            if (this.favBoxShow) {
              this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
              item_actor = this.favBoxIter.getFirstVisible();
            }
          } else {
            item_actor = (this._previousVisibleIndex !== null) ?
              this.appBoxIter.getVisibleItem(this._previousVisibleIndex) :
              this.appBoxIter.getFirstVisible();
          }
          break;
        case 'left':
          if (this.favBoxShow) {
            this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
            item_actor = this.favBoxIter.getFirstVisible();
          } else {
            if ((this.categoriesBox.get_child_at_index(index))._delegate instanceof RecentCategoryButton &&
              this.noRecentDocuments) {
              item_actor = this.categoriesBox.get_child_at_index(index);
            } else {
              item_actor = (this._previousVisibleIndex !== null) ?
                this.appBoxIter.getVisibleItem(this._previousVisibleIndex) :
                this.appBoxIter.getFirstVisible();
            }
          }
          break;
        case 'top':
          this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
          this._previousTreeSelectedActor._delegate.isHovered = false;
          item_actor = this.catBoxIter.getFirstVisible();
          this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
          break;
        case 'bottom':
          this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
          this._previousTreeSelectedActor._delegate.isHovered = false;
          item_actor = this.catBoxIter.getLastVisible();
          this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
          break;
        }
        break;
      case this.applicationsBox:
        switch (whichWay) {
        case 'up':
          this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
          item_actor = this.appBoxIter.getPrevVisible(this._previousSelectedActor);
          this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
          this._scrollToButton(item_actor._delegate);
          break;
        case 'down':
          this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
          item_actor = this.appBoxIter.getNextVisible(this._previousSelectedActor);
          this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
          this._scrollToButton(item_actor._delegate);
          break;
        case 'right':
          this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
          item_actor = (this._previousTreeSelectedActor !== null) ?
            this._previousTreeSelectedActor :
            this.catBoxIter.getFirstVisible();
          this._previousTreeSelectedActor = item_actor;
          index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);

          if (this.favBoxShow) {
            item_actor._delegate.emit('enter-event');
            this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
            item_actor = this.favBoxIter.getFirstVisible();
          }
          break;
        case 'left':
          this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
          item_actor = (this._previousTreeSelectedActor !== null) ?
            this._previousTreeSelectedActor :
            this.catBoxIter.getFirstVisible();
          this._previousTreeSelectedActor = item_actor;
          break;
        case 'top':
          item_actor = this.appBoxIter.getFirstVisible();
          this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
          this._scrollToButton(item_actor._delegate);
          break;
        case 'bottom':
          item_actor = this.appBoxIter.getLastVisible();
          this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
          this._scrollToButton(item_actor._delegate);
          break;
        }
        break;
      case this.favoritesBox:
        switch (whichWay) {
        case 'up':
          this._previousSelectedActor = this.favoritesBox.get_child_at_index(index);
          item_actor = this.favBoxIter.getPrevVisible(this._previousSelectedActor);
          break;
        case 'down':
          this._previousSelectedActor = this.favoritesBox.get_child_at_index(index);
          item_actor = this.favBoxIter.getNextVisible(this._previousSelectedActor);
          break;
        case 'right':
          item_actor = (this._previousTreeSelectedActor !== null) ?
            this._previousTreeSelectedActor :
            this.catBoxIter.getFirstVisible();
          this._previousTreeSelectedActor = item_actor;
          break;
        case 'left':
          item_actor = (this._previousTreeSelectedActor !== null) ?
            this._previousTreeSelectedActor :
            this.catBoxIter.getFirstVisible();
          this._previousTreeSelectedActor = item_actor;
          index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);

          item_actor._delegate.emit('enter-event');
          item_actor = (this._previousVisibleIndex !== null) ?
            this.appBoxIter.getVisibleItem(this._previousVisibleIndex) :
            this.appBoxIter.getFirstVisible();
          break;
        case 'top':
          item_actor = this.favBoxIter.getFirstVisible();
          break;
        case 'bottom':
          item_actor = this.favBoxIter.getLastVisible();
          break;
        }
        break;
      default:
        break;
      }
      if (!item_actor) {
        return false;
      }
      index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);
    } else {
      if (this._activeContainer !== this.categoriesBox && (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter)) {
        if (!ctrlKey) {
          item_actor = this._activeContainer.get_child_at_index(this._selectedItemIndex);
          item_actor._delegate.activate();
        } else if (ctrlKey && this._activeContainer === this.applicationsBox) {
          item_actor = this.applicationsBox.get_child_at_index(this._selectedItemIndex);
          if (item_actor._delegate instanceof ApplicationButton || item_actor._delegate instanceof RecentButton) {
            item_actor._delegate.activateContextMenus();
          }
        }
        return true;
      } else if (this._activeContainer === this.applicationsBox && symbol === Clutter.KEY_Menu) {
        item_actor = this.applicationsBox.get_child_at_index(this._selectedItemIndex);
        if (item_actor._delegate instanceof ApplicationButton || item_actor._delegate instanceof RecentButton) {
          item_actor._delegate.activateContextMenus();
        }
        return true;
      } else if (this._activeContainer === this.favoritesBox && symbol === Clutter.Delete) {
        item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
        if (item_actor._delegate instanceof FavoritesButton) {
          let favorites = AppFavorites.getAppFavorites().getFavorites();
          let numFavorites = favorites.length;
          AppFavorites.getAppFavorites().removeFavorite(item_actor._delegate.app.get_id());
          item_actor._delegate.toggleMenu();
          if (this._selectedItemIndex == (numFavorites - 1)) {
            item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex - 1);
          } else {
            item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
          }
        }
      } else if (this._activeContainer === this.favoritesBox &&
        (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_Up) && ctrlKey &&
        (this.favoritesBox.get_child_at_index(index))._delegate instanceof FavoritesButton) {
        item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
        let id = item_actor._delegate.app.get_id();
        let appFavorites = AppFavorites.getAppFavorites();
        let favorites = appFavorites.getFavorites();
        let numFavorites = favorites.length;
        let favPos = 0;
        if (this._selectedItemIndex == (numFavorites - 1) && symbol === Clutter.KEY_Down) {
          favPos = 0;
        } else if (this._selectedItemIndex === 0 && symbol === Clutter.KEY_Up) {
          favPos = numFavorites - 1;
        } else if (symbol === Clutter.KEY_Down) {
          favPos = this._selectedItemIndex + 1;
        } else {
          favPos = this._selectedItemIndex - 1;
        }
        appFavorites.moveFavoriteToPos(id, favPos);
        item_actor = this.favoritesBox.get_child_at_index(favPos);
      } else if (this.searchFilesystem && (this._fileFolderAccessActive || symbol === Clutter.slash)) {
        if (symbol === Clutter.Return || symbol === Clutter.KP_Enter) {
          if (this._run(this.searchEntry.get_text())) {
            this.menu.close();
          }
          return true;
        }
        if (symbol === Clutter.Escape) {
          this.searchEntry.set_text('');
          this._fileFolderAccessActive = false;
        }
        if (symbol === Clutter.slash) {
          // Need preload data before get completion. GFilenameCompleter load content of parent directory.
          // Parent directory for /usr/include/ is /usr/. So need to add fake name('a').
          let text = this.searchEntry.get_text().concat('/a');
          let prefix;
          if (text.lastIndexOf(' ') === -1) {
            prefix = text;
          } else {
            prefix = text.substr(text.lastIndexOf(' ') + 1);
          }
          this._getCompletion(prefix);

          return false;
        }
        if (symbol === Clutter.Tab) {
          let text = actor.get_text();
          let prefix;
          if (text.lastIndexOf(' ') == -1) {
            prefix = text;
          } else {
            prefix = text.substr(text.lastIndexOf(' ') + 1);
          }
          let postfix = this._getCompletion(prefix);
          if (postfix !== null && postfix.length > 0) {
            actor.insert_text(postfix, -1);
            actor.set_cursor_position(text.length + postfix.length);
            if (postfix[postfix.length - 1] == '/') {
              this._getCompletion(text + postfix + 'a');
            }
          }
          return true;
        }
        if (symbol === Clutter.ISO_Left_Tab) {
          return true;
        }
        return false;
      } else if (symbol === Clutter.Tab || symbol === Clutter.ISO_Left_Tab) {
        return true;
      } else {
        return false;
      }
    }

    if (this.appInfoPosition !== 'none') {
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
    }

    this._selectedItemIndex = index;
    if (!item_actor || item_actor === this.searchEntry) {
      return false;
    }
    item_actor._delegate.emit('enter-event');
    return true;
  },

  _addEnterEvent: function (button, callback) {
    let _callback = Lang.bind(this, function () {
      let parent = button.actor.get_parent();
      if (this._activeContainer === this.categoriesBox && parent !== this._activeContainer) {
        this._previousTreeSelectedActor = this._activeActor;
        this._previousSelectedActor = null;
      }
      if (this._previousTreeSelectedActor && this._activeContainer !== this.categoriesBox &&
        parent !== this._activeContainer && button !== this._previousTreeSelectedActor && !this.searchActive) {
        this._previousTreeSelectedActor.style_class = 'menu-category-button';
      }
      if (parent != this._activeContainer) {
        parent._vis_iter.reloadVisible();
      }
      let _maybePreviousActor = this._activeActor;
      if (_maybePreviousActor && this._activeContainer !== this.categoriesBox) {
        this._previousSelectedActor = _maybePreviousActor;
        this._clearPrevSelection();
      }
      if (parent === this.categoriesBox && !this.searchActive) {
        this._previousSelectedActor = _maybePreviousActor;
        this._clearPrevCatSelection();
      }
      this._activeContainer = parent;
      this._activeActor = button.actor;
      this._selectedItemIndex = this._activeContainer._vis_iter.getAbsoluteIndexOfChild(this._activeActor);
      callback();
    });
    button.connect('enter-event', _callback);
    button.actor.connect('enter-event', _callback);
  },

  _clearPrevSelection: function (actor) {
    if (this._previousSelectedActor && this._previousSelectedActor != actor) {
      if (this._previousSelectedActor._delegate instanceof ApplicationButton ||
        this._previousSelectedActor._delegate instanceof RecentButton ||
        this._previousSelectedActor._delegate instanceof SearchProviderResultButton ||
        this._previousSelectedActor._delegate instanceof PlaceButton ||
        this._previousSelectedActor._delegate instanceof RecentClearButton ||
        this._previousSelectedActor._delegate instanceof TransientButton) {

        this._previousSelectedActor.style_class = 'menu-application-button';
      }
      else if (this._previousSelectedActor._delegate instanceof FavoritesButton ||
        this._previousSelectedActor._delegate instanceof SystemButton) {

        this._previousSelectedActor.remove_style_pseudo_class('hover');
      }
    }
  },

  _clearPrevCatSelection: function (actor) {
    if (this._previousTreeSelectedActor && this._previousTreeSelectedActor != actor) {
      this._previousTreeSelectedActor.style_class = 'menu-category-button';

      if (this._previousTreeSelectedActor._delegate) {
        this._previousTreeSelectedActor._delegate.emit('leave-event');
      }

      if (actor !== undefined) {
        this._previousVisibleIndex = null;
        this._previousTreeSelectedActor = actor;
      }
    } else {
      var children = this.categoriesBox.get_children();

      for (let i = 0, len = children.length; i < len; i++) {
        children[i].style_class = 'menu-category-button';
      }
    }
  },

  makeVectorBox: function (actor) {
    this.destroyVectorBox(actor);
    let [mx, my, mask] = global.get_pointer();
    let [bx, by] = this.categoriesApplicationsBox.actor.get_transformed_position();
    let [bw, bh] = this.categoriesApplicationsBox.actor.get_transformed_size();
    let [aw, ah] = actor.get_transformed_size();
    let [ax, ay] = actor.get_transformed_position();
    let [appbox_x, appbox_y] = this.applicationsBox.get_transformed_position();

    let right_x = appbox_x - bx;
    let xformed_mouse_x = mx - bx;
    let xformed_mouse_y = my - by;
    let w = Math.max(right_x - xformed_mouse_x, 0);

    let ulc_y = xformed_mouse_y + 0;
    let llc_y = xformed_mouse_y + 0;

    this.vectorBox = new St.Polygon({
      debug: false,
      width: w,
      height: bh,
      ulc_x: 0,
      ulc_y: ulc_y,
      llc_x: 0,
      llc_y: llc_y,
      urc_x: w,
      urc_y: 0,
      lrc_x: w,
      lrc_y: bh
    });

    this.categoriesApplicationsBox.actor.add_actor(this.vectorBox);
    this.vectorBox.set_position(xformed_mouse_x, 0);

    this.vectorBox.show();
    this.vectorBox.set_reactive(true);
    this.vectorBox.raise_top();

    this.vectorBox.connect('leave-event', Lang.bind(this, this.destroyVectorBox));
    this.vectorBox.connect('motion-event', Lang.bind(this, this.maybeUpdateVectorBox));
    this.actor_motion_id = actor.connect('motion-event', Lang.bind(this, this.maybeUpdateVectorBox));
    this.current_motion_actor = actor;
  },

  maybeUpdateVectorBox: function () {
    if (this.vector_update_loop) {
      Mainloop.source_remove(this.vector_update_loop);
      this.vector_update_loop = 0;
    }
    this.vector_update_loop = Mainloop.timeout_add(35, Lang.bind(this, this.updateVectorBox));
  },

  updateVectorBox: function (actor) {
    if (this.vectorBox) {
      let [mx, my, mask] = global.get_pointer();
      let [bx, by] = this.categoriesApplicationsBox.actor.get_transformed_position();
      let xformed_mouse_x = mx - bx;
      let [appbox_x, appbox_y] = this.applicationsBox.get_transformed_position();
      let right_x = appbox_x - bx;
      if ((right_x - xformed_mouse_x) > 0) {
        this.vectorBox.width = Math.max(right_x - xformed_mouse_x, 0);
        this.vectorBox.set_position(xformed_mouse_x, 0);
        this.vectorBox.urc_x = this.vectorBox.width;
        this.vectorBox.lrc_x = this.vectorBox.width;
        this.vectorBox.queue_repaint();
      } else {
        this.destroyVectorBox(actor);
      }
    }
    this.vector_update_loop = 0;
    return false;
  },

  destroyVectorBox: function (actor) {
    if (this.vectorBox !== null) {
      this.vectorBox.destroy();
      this.vectorBox = null;
    }
    if (this.actor_motion_id > 0 && this.current_motion_actor !== null) {
      this.current_motion_actor.disconnect(this.actor_motion_id);
      this.actor_motion_id = 0;
      this.current_motion_actor = null;
    }
  },

  _refreshPlaces: function () {
    for (let i = 0, len = this._placesButtons.length; i < len; i++) {
      this._placesButtons[i].actor.destroy();
    }

    this._placesButtons = [];

    for (let i = 0, len = this._categoryButtons.length; i < len; i++) {
      if (this._categoryButtons[i] instanceof PlaceCategoryButton) {
        this._categoryButtons[i].destroy();
        this._categoryButtons.splice(i, 1);
        this.placesButton = null;
        break;
      }
    }
    this._placesButtons = [];

    // Now generate Places category and places buttons and add to the list
    if (this.showPlaces) {
      this.placesButton = new PlaceCategoryButton(null, this.showCategoryIcons);
      this._addEnterEvent(this.placesButton, ()=>{
        if (!this.searchActive) {
          this.placesButton.isHovered = true;
          this._clearPrevCatSelection(this.placesButton);
          this.placesButton.actor.style_class = 'menu-category-button-selected';
          this.closeContextMenus(null, false);
          this._displayButtons(null, -1);
          this.makeVectorBox(this.placesButton.actor);
        }
      });
      this.placesButton.actor.connect('leave-event', ()=>{
        if (this._previousTreeSelectedActor === null) {
          this._previousTreeSelectedActor = this.placesButton.actor;
        } else {
          let prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
          let nextIdx = this.catBoxIter.getVisibleIndex(this.placesButton.actor);
          let idxDiff = Math.abs(prevIdx - nextIdx);
          if (idxDiff <= 1 || Math.min(prevIdx, nextIdx) < 0) {
            this._previousTreeSelectedActor = this.placesButton.actor;
          }
        }

        this.placesButton.isHovered = false;
      });

      this._categoryButtons.push(this.placesButton);
      this.categoriesBox.add_actor(this.placesButton.actor);

      let bookmarks = this._listBookmarks();
      let devices = this._listDevices();
      let places = bookmarks.concat(devices);

      let handleEnterEvent = (button)=>{
        this._addEnterEvent(button, ()=>{
          this._clearPrevSelection(button.actor);
          button.actor.style_class = 'menu-application-button-selected';
          if (this.appInfoPosition !== 'none') {
            this.selectedAppTitle.set_text('');
            let selectedAppId = button.place.idDecoded;
            selectedAppId = selectedAppId.substr(selectedAppId.indexOf(':') + 1);
            let fileIndex = selectedAppId.indexOf('file:///');
            if (fileIndex !== -1) {
              selectedAppId = selectedAppId.substr(fileIndex + 7);
            }
            this.selectedAppDescription.set_text(selectedAppId);
          }
        });
      };

      let handleLeaveEvent = (button)=>{
        button.actor.connect('leave-event', Lang.bind(this, function () {
          this._previousSelectedActor = button.actor;
          if (this.appInfoPosition !== 'none') {
            this.selectedAppTitle.set_text('');
            this.selectedAppDescription.set_text('');
          }
        }));
      };

      for (let i = 0, len = places.length; i < len; i++) {
        let place = places[i];
        let button = new PlaceButton(this, place, place.name, this.showApplicationIcons);
        
        handleEnterEvent(button);

        handleLeaveEvent(button);

        this._placesButtons.push(button);
        this.applicationsBox.add_actor(button.actor);
      }
    }

    this._setCategoriesButtonActive(!this.searchActive);

    this._recalc_height();
    this._resizeApplicationsBox();
  },

  _refreshRecent: function(init=null) {
    if (this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)) {
      if (!this.recentButton) {
        this.recentButton = new RecentCategoryButton(null, this.showCategoryIcons);
        this._addEnterEvent(this.recentButton, Lang.bind(this, function() {
          if (!this.searchActive) {
            this.recentButton.isHovered = true;

            Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, Lang.bind(this, function() {
              if (this.recentButton.isHovered) {
                this._clearPrevCatSelection(this.recentButton.actor);
                this.recentButton.actor.style_class = "menu-category-button-selected";
                this.closeContextMenus(null, false);
                this._displayButtons(null, null, -1);
              } else {
                this.recentButton.actor.style_class = "menu-category-button";
              }
            }))

            this.makeVectorBox(this.recentButton.actor);
          }
        }));
        this.recentButton.actor.connect('leave-event', Lang.bind(this, function() {

          if (this._previousTreeSelectedActor === null) {
            this._previousTreeSelectedActor = this.recentButton.actor;
          } else {
            let prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
            let nextIdx = this.catBoxIter.getVisibleIndex(this.recentButton.actor);

            if (Math.abs(prevIdx - nextIdx) <= 1) {
              this._previousTreeSelectedActor = this.recentButton.actor;
            }
          }

          this.recentButton.isHovered = false;
        }));

        this._categoryButtons.push(this.recentButton);
      }

      /* Make sure the recent category is at the bottom (can happen when refreshing places
       * or apps, since we don't destroy the recent category button each time we refresh recents,
       * as it happens a lot) */

      let parent = this.recentButton.actor.get_parent();

      if (parent !== null) {
        parent.remove_child(this.recentButton.actor);
      }

      this.categoriesBox.add_actor(this.recentButton.actor);
      this._categoryButtons.splice(this._categoryButtons.indexOf(this.recentButton), 1);
      this._categoryButtons.push(this.recentButton);

      let new_recents = [];

      let handleEnterEvent = (button)=>{
        this._addEnterEvent(button, Lang.bind(this, function() {
          this._clearPrevSelection(button.actor);
          button.actor.style_class = "menu-application-button-selected";
          if (this.appInfoPosition !== 'none') {

            this.selectedAppTitle.set_text("");
            let selectedAppUri = button.uriDecoded;
            let fileIndex = selectedAppUri.indexOf("file:///");
            if (fileIndex !== -1) {
              selectedAppUri = selectedAppUri.substr(fileIndex + 7);
            }
            this.selectedAppDescription.set_text(selectedAppUri);
          }
        }));
      };

      let handleLeaveEvent = (button)=>{
        button.actor.connect('leave-event', Lang.bind(this, function() {
          button.actor.style_class = "menu-application-button";
          this._previousSelectedActor = button.actor;
          if (this.appInfoPosition !== 'none') {

            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
          }
        }));
      };

      let handleNewButton = (id) => {
        let uri = this.RecentManager._infosByTimestamp[id].uri;
        return this._recentButtons.find(button => ((button instanceof RecentButton) && (button.uri) && (button.uri == uri)));
      };

      if (this.RecentManager._infosByTimestamp.length > 0) {
        let id = 0;
        while (id < this.RecentManager._infosByTimestamp.length) {
          let new_button = handleNewButton(id);

          if (new_button === undefined) {
            let button = new RecentButton(this, this.RecentManager._infosByTimestamp[id], this.showApplicationIcons);
            handleEnterEvent(button);
            handleLeaveEvent(button);

            new_button = button
          }

          new_recents.push(new_button);

          id++;
        }

        let recent_clear_button = null;

        recent_clear_button = this._recentButtons.find(button => (button instanceof RecentClearButton));

        if (recent_clear_button === undefined) {
          let button = new RecentClearButton(this);
          this._addEnterEvent(button, Lang.bind(this, function() {
            this._clearPrevSelection(button.actor);
            button.actor.style_class = "menu-application-button-selected";
          }));
          button.actor.connect('leave-event', Lang.bind(this, function() {
            button.actor.style_class = "menu-application-button";
            this._previousSelectedActor = button.actor;
          }));

          recent_clear_button = button;
        }

        new_recents.push(recent_clear_button);

        this.noRecentDocuments = false;
      } else {
        let new_button = null;

        for (let existing_button in this._recentButtons) {
          let button = this._recentButtons[existing_button];

          if (button instanceof NoRecentDocsButton) {
            new_button = button;
            break;
          }
        }

        if (new_button === null) {
          new_button = new NoRecentDocsButton();
        }

        this.noRecentDocuments = true;
        new_recents.push(new_button);
      }

      let to_remove = [];

      /* Remove no-longer-valid items */
      for (let i = 0; i < this._recentButtons.length; i++) {
        let button = this._recentButtons[i];

        if (button instanceof NoRecentDocsButton && !this.noRecentDocuments) {
          to_remove.push(button);
        } else if (button instanceof RecentButton) {
          if (new_recents.indexOf(button) == -1) {
            to_remove.push(button);
          }
        }
      }

      if (to_remove.length > 0) {
        for (let i in to_remove) {
          to_remove[i].destroy();
          this._recentButtons.splice(this._recentButtons.indexOf(to_remove[i]), 1);
        }
      }

      to_remove = [];

      /* Now, add new actors, shuffle existing actors */

      let placeholder = null;

      /* Find the first occurrence of a RecentButton, if it exists */
      let children = this.applicationsBox.get_children();
      for (let i = children.length - 1; i > 0; i--) {
        if ((children[i]._delegate instanceof RecentButton) ||
          (children[i]._delegate instanceof RecentClearButton) ||
          (i == children.length - 1)) {
          placeholder = children[i - 1];
          break;
        }
      }

      children = null;

      for (let i = 0; i < new_recents.length; i++) {
        let actor = new_recents[i].actor;

        let parent = actor.get_parent();
        if (parent !== null) {
          parent.remove_child(actor);
        }

        this.applicationsBox.insert_child_above(actor, placeholder);
        placeholder = actor;
      }

      this._recentButtons = new_recents;
    } else {
      for (let i = 0; i < this._recentButtons.length; i++) {
        this._recentButtons[i].destroy();
      }

      this._recentButtons = [];

      for (let i = 0; i < this._categoryButtons.length; i++) {
        if (this._categoryButtons[i] instanceof RecentCategoryButton) {
          this._categoryButtons[i].destroy();
          this._categoryButtons.splice(i, 1);
          this.recentButton = null;
          break;
        }
      }

      this._recentButtons = [];
    }

    this._setCategoriesButtonActive(!this.searchActive);

    this._recalc_height();
    this._resizeApplicationsBox();
    if (init) {
      setTimeout(()=>this.initializing = false, 4000)
    }
  },

  _refreshApps: function () {
    /* iterate in reverse, so multiple splices will not upset 
     * the remaining elements */
    for (let i = this._categoryButtons.length - 1; i > -1; i--) {
      if (this._categoryButtons[i] instanceof CategoryButton) {
        this._categoryButtons[i].destroy();
        this._categoryButtons.splice(i, 1);
      }
    }

    this.applicationsBox.destroy_all_children();
    this._applicationsButtons = [];
    this._transientButtons = [];
    this._applicationsButtonFromApp = {};
    this._applicationsBoxWidth = 0;

    this._allAppsCategoryButton = new CategoryButton(null);
    this._addEnterEvent(this._allAppsCategoryButton, Lang.bind(this, function () {
      if (!this.searchActive) {
        this._allAppsCategoryButton.isHovered = true;
        this._clearPrevCatSelection(this._allAppsCategoryButton.actor);
        this._allAppsCategoryButton.actor.style_class = 'menu-category-button-selected';
        this._select_category(null, this._allAppsCategoryButton);
        this.makeVectorBox(this._allAppsCategoryButton.actor);
      }
    }));
    this._allAppsCategoryButton.actor.connect('leave-event', Lang.bind(this, function () {
      this._previousSelectedActor = this._allAppsCategoryButton.actor;
      this._allAppsCategoryButton.isHovered = false;
    }));
    this.categoriesBox.add_actor(this._allAppsCategoryButton.actor);

    let trees = [appsys.get_tree()];

    let handleEnterEvent = (categoryButton, dir)=>{
      this._addEnterEvent(categoryButton, ()=> {
        if (!this.searchActive) {
          categoryButton.isHovered = true;
          this._clearPrevCatSelection(categoryButton.actor);
          categoryButton.actor.style_class = 'menu-category-button-selected';
          this._select_category(dir, categoryButton);
          this.makeVectorBox(categoryButton.actor);
        }
      });
    };

    let handleLeaveEvent = (categoryButton)=>{
      categoryButton.actor.connect('leave-event', Lang.bind(this, function () {
        if (this._previousTreeSelectedActor === null) {
          this._previousTreeSelectedActor = categoryButton.actor;
        } else {
          let prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
          let nextIdx = this.catBoxIter.getVisibleIndex(categoryButton.actor);
          if (Math.abs(prevIdx - nextIdx) <= 1) {
            this._previousTreeSelectedActor = categoryButton.actor;
          }
        }
        categoryButton.isHovered = false;
      }));
    };

    let sortDirs = (dirs)=>{
      dirs.sort(function (a, b) {
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
        if (this._loadCategory(dir)) {
          let categoryButton = new CategoryButton(dir, this.showCategoryIcons);

          handleEnterEvent(categoryButton, dir);
          
          handleLeaveEvent(categoryButton);

          this.categoriesBox.add_actor(categoryButton.actor);
        }
      }
    }
    // Sort apps and add to applicationsBox
    this._applicationsButtons.sort(function (a, b) {
      a = Util.latinise(a.app.get_name().toLowerCase());
      b = Util.latinise(b.app.get_name().toLowerCase());
      return a > b;
    });

    for (let i = 0, len = this._applicationsButtons.length; i < len; i++) {
      this.applicationsBox.add_actor(this._applicationsButtons[i].actor);
      this.applicationsBox.add_actor(this._applicationsButtons[i].menu.actor);
    }

    this._appsWereRefreshed = true;
  },

  _favEnterEvent: function (button) {
    button.actor.add_style_pseudo_class('hover');

    if (this.appInfoPosition === 'none') {
      return;
    }
    if (button instanceof FavoritesButton) {
      this.selectedAppTitle.set_text(button.app.get_name());
      if (button.app.get_description()) {
        this.selectedAppDescription.set_text(button.app.get_description().split('\n')[0]);
      } else {
        this.selectedAppDescription.set_text('');
      }
    } else {
      this.selectedAppTitle.set_text(button.name);
      this.selectedAppDescription.set_text(button.desc);
    }
  },

  _favLeaveEvent: function (widget, event, button) {
    this._previousSelectedActor = button.actor;
    button.actor.remove_style_pseudo_class('hover');

    if (this.appInfoPosition === 'none') {
      return;
    }
    this.selectedAppTitle.set_text('');
    this.selectedAppDescription.set_text('');
  },

  _refreshFavs: function () {
    //Remove all favorites
    this.favoritesBox.destroy_all_children();

    //Load favorites again
    this._favoritesButtons = [];
    let launchers = global.settings.get_strv('favorite-apps');
    let appSys = Cinnamon.AppSystem.get_default();
    let j = 0;
    for (let i = 0, len = launchers.length; i < len; i++) {
      let app = appSys.lookup_app(launchers[i]);
      if (app) {
        let button = new FavoritesButton(this, app, launchers.length + 3); // + 3 because we're adding 3 system buttons at the bottom
        this._favoritesButtons[app] = button;
        this.favoritesBox.add_actor(button.actor, {
          y_align: St.Align.END,
          y_fill: false
        });

        this._addEnterEvent(button, Lang.bind(this, this._favEnterEvent, button));
        button.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, button));

        ++j;
      }
    }

    //Separator
    if (launchers.length !== 0) {
      let separator = new PopupMenu.PopupSeparatorMenuItem();
      this.favoritesBox.add_actor(separator.actor, {
        y_align: St.Align.END,
        y_fill: false
      });
    }

    //Lock screen
    let button = new SystemButton(this, 'system-lock-screen', launchers.length + 3,
      _('Lock screen'),
      _('Lock the screen'));

    this._addEnterEvent(button, Lang.bind(this, this._favEnterEvent, button));
    button.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, button));

    button.activate = Lang.bind(this, function () {
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
    });

    this.favoritesBox.add_actor(button.actor, {
      y_align: St.Align.END,
      y_fill: false
    });

    //Logout button
    button = new SystemButton(this, 'system-log-out', launchers.length + 3,
      _('Logout'),
      _('Leave the session'));

    this._addEnterEvent(button, Lang.bind(this, this._favEnterEvent, button));
    button.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, button));

    button.activate = Lang.bind(this, function () {
      this.menu.close();
      this._session.LogoutRemote(0);
    });

    this.favoritesBox.add_actor(button.actor, {
      y_align: St.Align.END,
      y_fill: false
    });

    //Shutdown button
    button = new SystemButton(this, 'system-shutdown', launchers.length + 3,
      _('Quit'),
      _('Shutdown the computer'));

    this._addEnterEvent(button, Lang.bind(this, this._favEnterEvent, button));
    button.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, button));

    button.activate = Lang.bind(this, function () {
      this.menu.close();
      this._session.ShutdownRemote();
    });

    this.favoritesBox.add_actor(button.actor, {
      y_align: St.Align.END,
      y_fill: false
    });

    this._recalc_height();
  },

  _loadCategory: function (dir, top_dir) {
    var iter = dir.iter();
    var has_entries = false;
    var nextType;
    if (!top_dir) {
      top_dir = dir;
    }

    var handleCategoryEvents = (applicationButton)=>{
      applicationButton.actor.connect('leave-event', (a, b)=>this._appLeaveEvent(a, b, applicationButton));
      this._addEnterEvent(applicationButton, ()=>this._appEnterEvent(applicationButton));
    };

    while ((nextType = iter.next()) != CMenu.TreeItemType.INVALID) {
      if (nextType == CMenu.TreeItemType.ENTRY) {
        var entry = iter.get_entry();
        if (!entry.get_app_info().get_nodisplay()) {
          has_entries = true;
          var app = appsys.lookup_app_by_tree_entry(entry);
          if (!app) {
            app = appsys.lookup_settings_app_by_tree_entry(entry);
          }
          var app_key = app.get_id()
          if (app_key === null) {
            app_key = `${app.get_name()}:${app.get_description()}`;
          }
          if (!(app_key in this._applicationsButtonFromApp)) {

            let applicationButton = new ApplicationButton(this, app, this.showApplicationIcons);

            var app_is_known = false;
            for (let i = 0, len = this._knownApps.length; i < len; i++) {
              if (this._knownApps[i] == app_key) {
                app_is_known = true;
              }
            }
            if (!app_is_known) {
              if (this._appsWereRefreshed) {
                applicationButton.highlight();
              } else {
                this._knownApps.push(app_key);
              }
            }

            handleCategoryEvents(applicationButton)

            this._applicationsButtons.push(applicationButton);
            applicationButton.category.push(top_dir.get_menu_id());
            this._applicationsButtonFromApp[app_key] = applicationButton;
          } else {
            this._applicationsButtonFromApp[app_key].category.push(dir.get_menu_id());
          }
        }
      } else if (nextType == CMenu.TreeItemType.DIRECTORY) {
        let subdir = iter.get_directory();
        if (this._loadCategory(subdir, top_dir)) {
          has_entries = true;
        }
      }
    }
    return has_entries;
  },

  _appLeaveEvent: function (a, b, applicationButton) {
    this._previousSelectedActor = applicationButton.actor;
    applicationButton.actor.style_class = 'menu-application-button';

    if (this.appInfoPosition === 'none') {
      return;
    }
    this.selectedAppTitle.set_text('');
    this.selectedAppDescription.set_text('');
  },

  _appEnterEvent: function (applicationButton) {
    this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(applicationButton.actor);
    this._clearPrevSelection(applicationButton.actor);
    applicationButton.actor.style_class = 'menu-application-button-selected';

    if (this.appInfoPosition === 'none') {
      return;
    }
    this.selectedAppTitle.set_text(applicationButton.app.get_name());
    if (applicationButton.app.get_description()) {
      this.selectedAppDescription.set_text(applicationButton.app.get_description());
    } else {
      this.selectedAppDescription.set_text('');
    }
  },

  _scrollToButton: function (button) {
    var current_scroll_value = this.applicationsScrollBox.get_vscroll_bar().get_adjustment().get_value();
    var box_height = this.applicationsScrollBox.get_allocation_box().y2 - this.applicationsScrollBox.get_allocation_box().y1;
    var new_scroll_value = current_scroll_value;
    if (current_scroll_value > button.actor.get_allocation_box().y1 - 10) {
      new_scroll_value = button.actor.get_allocation_box().y1 - 10;
    }
    if (box_height + current_scroll_value < button.actor.get_allocation_box().y2 + 10) {
      new_scroll_value = button.actor.get_allocation_box().y2 - box_height + 10;
    }
    if (new_scroll_value != current_scroll_value) {
      this.applicationsScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    }
  },

  _display: function () {
    this._activeContainer = null;
    this._activeActor = null;
    this.vectorBox = null;
    this.actor_motion_id = 0;
    this.vector_update_loop = null;
    this.current_motion_actor = null;
    let section = new PopupMenu.PopupMenuSection();
    this.menu.addMenuItem(section);

    this.leftPane = new St.BoxLayout({
      vertical: false
    });

    this.leftBox = new St.BoxLayout({
      style_class: 'menu-favorites-box',
      vertical: false
    });

    this._session = new GnomeSession.SessionManager();
    this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

    this.leftPane.add_actor(this.leftBox, {
      y_align: St.Align.END,
      y_fill: false
    });
    this._favboxtoggle();

    let rightPane = new St.BoxLayout({
      vertical: true
    });

    if (this.appInfoPosition !== 'none') {
      this.selectedAppTitle = new St.Label({
        style_class: 'menu-selected-app-title',
        text: '',
        style: this.appInfoPosition === 'bottom' ? 'padding-top: 4px;' : 'padding-left: 22px;'
      });
      this.selectedAppDescription = new St.Label({
        style_class: 'menu-selected-app-description',
        text: '',
        style: this.appInfoPosition === 'top' ? 'padding-left: 22px;' : null
      });

      if (this.appInfoPosition === 'top') {
        rightPane.add_actor(this.selectedAppTitle);
        rightPane.add_actor(this.selectedAppDescription);
      }
    }

    this.searchActive = false;

    if (this.searchPosition !== 'none') {
      this.searchBox = new St.BoxLayout({
        style_class: 'menu-search-box'
      });

      if (this.searchPosition === 'top') {
        rightPane.add_actor(this.searchBox);
      }

      this.searchEntry = new St.Entry({
        name: 'menu-search-entry',
        hint_text: _('Type to search...'),
        track_hover: true,
        can_focus: true
      });
      this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
      this.searchBox.add_actor(this.searchEntry);
      this.searchEntryText = this.searchEntry.clutter_text;
      this.searchEntryText.connect('text-changed', (se, prop)=>this._onSearchTextChanged(se, prop));
      this.searchEntryText.connect('key-press-event', (actor, event)=>this._onMenuKeyPress(actor, event));
      this._previousSearchPattern = '';
    }

    this.categoriesApplicationsBox = new CategoriesApplicationsBox();
    rightPane.add_actor(this.categoriesApplicationsBox.actor);
    this.categoriesBox = new St.BoxLayout({
      style_class: 'menu-categories-box',
      vertical: true,
      accessible_role: Atk.Role.LIST
    });
    this.applicationsScrollBox = new St.ScrollView({
      x_fill: true,
      y_fill: false,
      y_align: St.Align.START,
      style_class: 'vfade menu-applications-scrollbox'
    });

    var appScrollBoxWidth = this.favBoxShow ? this.menuWidth : this.menuWidth + 55
    this.applicationsScrollBox.set_width(appScrollBoxWidth)

    this.a11y_settings = new Gio.Settings({
      schema_id: 'org.cinnamon.desktop.a11y.applications'
    });
    this.a11y_settings.connect('changed::screen-magnifier-enabled', ()=>this._updateVFade());
    this.a11y_mag_settings = new Gio.Settings({
      schema_id: 'org.cinnamon.desktop.a11y.magnifier'
    });
    this.a11y_mag_settings.connect('changed::mag-factor', ()=>this._updateVFade());

    this._updateVFade();

    if (typeof this.settings.bind === 'function') {
      this.settings.bind('enable-autoscroll', 'autoscroll_enabled', this._update_autoscroll);
    } else {
      this.settings.bindProperty(Settings.BindingDirection.IN, 'enable-autoscroll', 'autoscroll_enabled', this._update_autoscroll, null);
    }
    this._update_autoscroll();

    let vscroll = this.applicationsScrollBox.get_vscroll_bar();
    vscroll.connect('scroll-start', ()=>{
      this.menu.passEvents = true;
    });
    vscroll.connect('scroll-stop', ()=>{
      this.menu.passEvents = false;
    });

    this.applicationsBox = new St.BoxLayout({
      style_class: 'menu-applications-inner-box',
      vertical: true
    });
    this.applicationsBox.add_style_class_name('menu-applications-box'); //this is to support old themes
    this.applicationsScrollBox.add_actor(this.applicationsBox);
    this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType[this.showScrollbar ? 'AUTOMATIC' : 'NEVER']);
    this.categoriesApplicationsBox.actor.add_actor(this.categoriesBox);
    this.categoriesApplicationsBox.actor.add_actor(this.applicationsScrollBox);

    let fav_obj = new FavoritesBox();
    this.favoritesBox = fav_obj.actor;
    this.leftBox.add_actor(this.favoritesBox, {
      y_align: St.Align.END,
      y_fill: false
    });

    this.mainBox = new St.BoxLayout({
      style_class: 'menu-applications-outer-box',
      vertical: false
    });
    this.mainBox.add_style_class_name('menu-applications-box'); //this is to support old themes

    this.mainBox.add_actor(this.leftPane, {
      span: 1
    });
    this.mainBox.add_actor(rightPane, {
      span: 1
    });

    section.actor.add_actor(this.mainBox);

    this.selectedAppBox = new St.BoxLayout({
      style_class: 'menu-selected-app-box',
      vertical: true
    });

    if (this.selectedAppBox.peek_theme_node() === null 
      || this.selectedAppBox.get_theme_node().get_length('height') === 0) {
      var appBoxHeight = this.searchPosition === 'bottom' && this.appInfoPosition !== 'none' ? 60 : this.appInfoPosition !== 'bottom' && this.searchPosition !== 'bottom' ? 0 : 30;
      this.selectedAppBox.set_height(appBoxHeight * global.ui_scale);
    }

    if (this.appInfoPosition === 'bottom') {
      this.selectedAppBox.add_actor(this.selectedAppTitle);
      this.selectedAppBox.add_actor(this.selectedAppDescription);
    }

    if (this.searchPosition === 'bottom') {
      this.searchBox.style = `padding-left: ${this.menuWidth - 96}px; padding-top: 4px;`
      this.selectedAppBox.add_actor(this.searchBox);
    }

    section.actor.add_actor(this.selectedAppBox);
    this.appBoxIter = new VisibleChildIterator(this.applicationsBox);
    this.applicationsBox._vis_iter = this.appBoxIter;
    this.catBoxIter = new VisibleChildIterator(this.categoriesBox);
    this.categoriesBox._vis_iter = this.catBoxIter;
    this.favBoxIter = new VisibleChildIterator(this.favoritesBox);
    this.favoritesBox._vis_iter = this.favBoxIter;
    Mainloop.idle_add(()=>{
      this._clearAllSelections(true);
    });
  },

  _updateVFade: function () {
    let mag_on = this.a11y_settings.get_boolean('screen-magnifier-enabled') &&
      this.a11y_mag_settings.get_double('mag-factor') > 1.0;
    if (mag_on) {
      this.applicationsScrollBox.style_class = 'menu-applications-scrollbox';
    } else {
      this.applicationsScrollBox.style_class = 'vfade menu-applications-scrollbox';
    }
  },

  _update_autoscroll: function () {
    this.applicationsScrollBox.set_auto_scrolling(this.autoscroll_enabled);
  },

  _clearAllSelections: function (hide_apps) {
    let actors = this.applicationsBox.get_children();
    for (let i = 0, len = actors.length; i < len; i++) {
      let actor = actors[i];
      actor.style_class = 'menu-application-button';
      if (hide_apps) {
        actor.hide();
      }
    }
    actors = this.categoriesBox.get_children();
    for (let i = 0, len = actors.length; i < len; i++) {
      let actor = actors[i];
      actor.style_class = 'menu-category-button';
      actor.show();
    }
    actors = this.favoritesBox.get_children();
    for (let i = 0, len = actors.length; i < len; i++) {
      let actor = actors[i];
      actor.remove_style_pseudo_class('hover');
      actor.show();
    }
  },

  _select_category: function (dir, categoryButton) {
    if (dir) {
      this._displayButtons(this._listApplications(dir.get_menu_id()));
    } else {
      this._displayButtons(this._listApplications(null));
    }
    this.closeContextMenus(null, false);
  },

  closeContextMenus: function (excluded, animate) {
    for (var app in this._applicationsButtons) { // TBD
      if (app != excluded && this._applicationsButtons[app].menu.isOpen) {
        if (animate) {
          this._applicationsButtons[app].toggleMenu();
        } else {
          this._applicationsButtons[app].closeMenu();
        }
      }
    }

    if (excluded != this._activeContextMenuItem) {
      if (this.recentContextMenu && this.recentContextMenu.isOpen) {
        if (animate) {
          this.recentContextMenu.sourceActor._delegate.toggleMenu();
        } else {
          this.recentContextMenu.sourceActor._delegate.closeMenu();
        }
      }
    }
  },

  _resize_actor_iter: function (actor) {
    let [min, nat] = actor.get_preferred_width(-1.0);
    if (nat > this._applicationsBoxWidth) {
      this._applicationsBoxWidth = nat;
      this.applicationsBox.set_width(this._applicationsBoxWidth + 42); // The answer to life...
    }
  },

  _resizeApplicationsBox: function () {
    this._applicationsBoxWidth = 0;
    this.applicationsBox.set_width(-1);
    let child = this.applicationsBox.get_first_child();
    this._resize_actor_iter(child);

    while ((child = child.get_next_sibling()) !== null) {
      this._resize_actor_iter(child);
    }
  },

  _displayButtons: function (appCategory, places, recent, apps, autocompletes) {
    if (appCategory) {
      if (appCategory == 'all') {
        for (let i = 0, len = this._applicationsButtons.length; i < len; i++) {
          this._applicationsButtons[i].actor.show();
        }
      } else {
        for (let i = 0, len = this._applicationsButtons.length; i < len; i++) {
          if (this._applicationsButtons[i].category.indexOf(appCategory) != -1) {
            this._applicationsButtons[i].actor.show();
          } else {
            this._applicationsButtons[i].actor.hide();
          }
        }
      }
    } else if (apps) {
      for (let i = 0, len = this._applicationsButtons.length; i < len; i++) {
        if (apps.indexOf(this._applicationsButtons[i].app.get_id()) != -1) {
          this._applicationsButtons[i].actor.show();
        } else {
          this._applicationsButtons[i].actor.hide();
        }
      }
    } else {
      for (let i = 0, len = this._applicationsButtons.length; i < len; i++) {
        this._applicationsButtons[i].actor.hide();
      }
    }
    if (places) {
      if (places == -1) {
        for (let i = 0, len = this._placesButtons.length; i < len; i++) {
          this._placesButtons[i].actor.show();
        }
      } else {
        for (let i = 0, len = this._placesButtons.length; i < len; i++) {
          if (places.indexOf(this._placesButtons[i].button_name) !== -1) {
            this._placesButtons[i].actor.show();
          } else {
            this._placesButtons[i].actor.hide();
          }
        }
      }
    } else {
      for (let i = 0, len = this._placesButtons.length; i < len; i++) {
        this._placesButtons[i].actor.hide();
      }
    }
    if (recent) {
      if (recent === -1) {
        for (let i = 0, len = this._recentButtons.length; i < len; i++) {
          this._recentButtons[i].actor.show();
        }
      } else {
        for (let i = 0, len = this._recentButtons.length; i < len; i++) {
          if (recent.indexOf(this._recentButtons[i].button_name) != -1) {
            this._recentButtons[i].actor.show();
          } else {
            this._recentButtons[i].actor.hide();
          }
        }
      }
    } else {
      for (let i = 0, len = this._recentButtons.length; i < len; i++) {
        this._recentButtons[i].actor.hide();
      }
    }
    if (autocompletes) {
      for (let i = 0, len = this._transientButtons.length; i < len; i++) {
        this._transientButtons[i].actor.destroy();
      }
      this._transientButtons = [];

      for (let i = 0, len = autocompletes.length; i < len; i++) {
        let button = new TransientButton(this, autocompletes[i]);
        button.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, button));
        this._addEnterEvent(button, Lang.bind(this, this._appEnterEvent, button));
        this._transientButtons.push(button);
        this.applicationsBox.add_actor(button.actor);
        button.actor.realize();
      }
    }

    for (let i = 0, len = this._searchProviderButtons.length; i < len; i++) {
      if (this._searchProviderButtons[i].actor.visible) {
        this._searchProviderButtons[i].actor.hide();
      }
    }
  },

  _setCategoriesButtonActive: function (active) {
    try {
      let categoriesButtons = this.categoriesBox.get_children();
      for (let i = 0, len = categoriesButtons.length; i < len; i++) {
        if (active) {
          categoriesButtons[i].set_style_class_name('menu-category-button');
        } else {
          categoriesButtons[i].set_style_class_name('menu-category-button-greyed');
        }
      }
    } catch (e) {
      global.log(e);
    }
  },

  resetSearch: function () {
    this.searchEntry.set_text('');
    this._previousSearchPattern = '';
    this.searchActive = false;
    this._clearAllSelections(true);
    this._setCategoriesButtonActive(true);
    global.stage.set_key_focus(this.searchEntry);
  },

  _onSearchTextChanged: function (se, prop) {
    if (this.menuIsOpening) {
      this.menuIsOpening = false;
      return;
    } else {
      let searchString = this.searchEntry.get_text();
      if (searchString === '' && !this.searchActive) {
        return;
      }
      this.searchActive = searchString !== '';
      this._fileFolderAccessActive = this.searchActive && this.searchFilesystem;
      this._clearAllSelections();

      if (this.searchActive) {
        this.searchEntry.set_secondary_icon(this._searchActiveIcon);
        if (this._searchIconClickedId === 0) {
          this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked', ()=>{
            this.resetSearch();
            this._select_category(null, this._allAppsCategoryButton);
          });
        }
        this._setCategoriesButtonActive(false);
        this._doSearch();
      } else {
        if (this._searchIconClickedId > 0) {
          this.searchEntry.disconnect(this._searchIconClickedId);
        }
        this._searchIconClickedId = 0;
        this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        this._previousSearchPattern = '';
        this._setCategoriesButtonActive(true);
        this._select_category(null, this._allAppsCategoryButton);
        this._allAppsCategoryButton.actor.style_class = 'menu-category-button-selected';
        this._activeContainer = null;
        
        if (this.appInfoPosition !== 'none') {
          this.selectedAppTitle.set_text('');
          this.selectedAppDescription.set_text('');
        }
      }
      return;
    }
  },

  _listBookmarks: function (pattern) {
    let bookmarks = Main.placesManager.getBookmarks();
    var res = [];
    for (let i = 0, len = bookmarks.length; i < len; i++) {
      if (!pattern || bookmarks[i].name.toLowerCase().indexOf(pattern) !== -1) {
        res.push(bookmarks[i]);
      }
    }
    return res;
  },

  _listDevices: function (pattern) {
    let devices = Main.placesManager.getMounts();
    var res = [];
    for (let i = 0, len = devices.length; i < len; i++) {
      if (!pattern || devices[i].name.toLowerCase().indexOf(pattern) !== -1) {
        res.push(devices[i]);
      }
    }
    return res;
  },

  _listApplications: function (category_menu_id, pattern) {
    var applist = [];
    if (category_menu_id) {
      applist = category_menu_id;
    } else {
      applist = 'all';
    }
    if (pattern) {
      var res = [];
      for (let i = 0, len = this._applicationsButtons.length; i < len; i++) {
        let app = this._applicationsButtons[i].app;
        if (kmp(Util.latinise(app.get_name().toLowerCase()), pattern) !== -1) {
          res.push(app.get_id());
        }
      }
    } else {
      res = applist;
    }
    return res;
  },

  _doSearch: function () {
    this._searchTimeoutId = 0;
    let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
    pattern = Util.latinise(pattern);
    if (pattern == this._previousSearchPattern) {
      return false;
    }
    this._previousSearchPattern = pattern;
    this._activeContainer = null;
    this._activeActor = null;
    this._selectedItemIndex = null;
    this._previousTreeSelectedActor = null;
    this._previousSelectedActor = null;

    // _listApplications returns all the applications when the search
    // string is zero length. This will happened if you type a space
    // in the search entry.
    if (pattern.length === 0) {
      return false;
    }

    var appResults = this._listApplications(null, pattern);
    var placesResults = [];
    var bookmarks = this._listBookmarks(pattern);
    for (let i = 0, len = bookmarks.length; i < len; i++) {
      placesResults.push(bookmarks[i].name);
    }
    var devices = this._listDevices(pattern);
    for (let i = 0, len = devices.length; i < len; i++) {
      placesResults.push(devices[i].name);
    }
    var recentResults = [];
    for (let i = 0, len = this._recentButtons.length; i < len; i++) {
      if (!(this._recentButtons[i] instanceof RecentClearButton) && this._recentButtons[i].button_name.toLowerCase().indexOf(pattern) != -1) {
        recentResults.push(this._recentButtons[i].button_name);
      }
    }

    var acResults = []; // search box autocompletion results
    if (this.searchFilesystem) {
      // Don't use the pattern here, as filesystem is case sensitive
      acResults = this._getCompletions(this.searchEntryText.get_text());
    }

    this._displayButtons(null, placesResults, recentResults, appResults, acResults);

    this.appBoxIter.reloadVisible();
    if (this.appBoxIter.getNumVisibleChildren() > 0) {
      let item_actor = this.appBoxIter.getFirstVisible();
      this._selectedItemIndex = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
      this._activeContainer = this.applicationsBox;
      if (item_actor && item_actor !== this.searchEntry) {
        item_actor._delegate.emit('enter-event');
      }
    } else {
      if (this.appInfoPosition !== 'none') {
        this.selectedAppTitle.set_text('');
        this.selectedAppDescription.set_text('');
      }
    }

    var handleAddSearchEvents = (button)=>{
      button.actor.connect('leave-event', (a, b)=>this._appLeaveEvent(a, b, button));
      this._addEnterEvent(button, ()=>this._appEnterEvent(button));
    };

    SearchProviderManager.launch_all(pattern, Lang.bind(this, function (provider, results) {
      try {
        for (let i = 0, len = results.length; i < len; i++) {
          if (results[i].type !== 'software') {
            let button = new SearchProviderResultButton(this, provider, results[i]);
            
            handleAddSearchEvents(button)

            this._searchProviderButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.realize();
          }
        }
      } catch (e) {
        global.log(e);
      }
    }));

    return false;
  },

  _getCompletion: function (text) {
    if (text.indexOf('/') !== -1) {
      if (text.substr(text.length - 1) === '/') {
        return '';
      } else {
        return this._pathCompleter.get_completion_suffix(text);
      }
    } else {
      return false;
    }
  },

  _getCompletions: function (text) {
    if (text.indexOf('/') !== -1) {
      return this._pathCompleter.get_completions(text);
    } else {
      return [];
    }
  },

  _run: function (input) {

    this._commandError = false;
    if (input) {
      let path = null;
      if (input.charAt(0) == '/') {
        path = input;
      } else {
        if (input.charAt(0) == '~') {
          input = input.slice(1);
        }
        path = GLib.get_home_dir() + '/' + input;
      }

      if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
        let file = Gio.file_new_for_path(path);
        try {
          Gio.app_info_launch_default_for_uri(file.get_uri(),
            global.create_app_launch_context());
        } catch (e) {
          // The exception from gjs contains an error string like:
          //     Error invoking Gio.app_info_launch_default_for_uri: No application
          //     is registered as handling this file
          // We are only interested in the part after the first colon.
          //let message = e.message.replace(/[^:]*: *(.+)/, '$1');
          return false;
        }
      } else {
        return false;
      }
    }

    return true;
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  let myApplet = new MyApplet(orientation, panel_height, instance_id);
  return myApplet;
}