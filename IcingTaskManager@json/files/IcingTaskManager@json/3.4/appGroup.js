const Cinnamon = imports.gi.Cinnamon;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Lang = imports.lang;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;
const SignalManager = imports.misc.signalManager;

let SpecialMenus, each, find, findIndex, isEqual, setTimeout, throttle, getFocusState, constants, unref, store;
if (typeof require !== 'undefined') {
  const utils = require('./utils');
  SpecialMenus = require('./specialMenus');
  constants = require('./constants').constants;
  each = utils.each;
  findIndex = utils.findIndex;
  find = utils.find;
  isEqual = utils.isEqual;
  throttle = utils.throttle;
  setTimeout = utils.setTimeout;
  getFocusState = utils.getFocusState;
  unref = utils.unref;
  store = require('./store');
} else {
  const AppletDir = imports.ui.appletManager.applets['IcingTaskManager@json'];
  SpecialMenus = AppletDir.specialMenus;
  constants = AppletDir.constants.constants;
  each = AppletDir.utils.each;
  findIndex = AppletDir.utils.findIndex;
  find = AppletDir.utils.find;
  isEqual = AppletDir.utils.isEqual;
  throttle = AppletDir.utils.throttle;
  setTimeout = AppletDir.utils.setTimeout;
  getFocusState = AppletDir.utils.getFocusState;
  unref = AppletDir.utils.unref;
  store = AppletDir.store_mozjs24;
}

const ICON_HEIGHT_FACTOR = 0.64;
const VERTICAL_ICON_HEIGHT_FACTOR = 0.75;

// returns [x1,x2] so that the area between x1 and x2 is
// centered in length

function center (length, naturalLength) {
  let maxLength = Math.min(length, naturalLength);
  let x1 = Math.max(0, Math.floor((length - maxLength) / 2));
  let x2 = Math.min(length, x1 + maxLength);
  return [x1, x2];
}

const getPseudoClass = function(pseudoClass) {
  let item = find(constants.pseudoOptions, (item) => item.id === pseudoClass);
  if (item) {
    return item.label;
  }
  return 'outlined';
};

function _Draggable (actor, params) {
  this._init(actor, params);
}

_Draggable.prototype = {
  __proto__: DND._Draggable.prototype,

  _grabActor: function () {
    this._onEventId = this.actor.connect('event', Lang.bind(this, this._onEvent));
  },
  _onButtonPress: function (actor, event) {
    if (this.inhibit) {
      return false;
    }

    if (event.get_button() !== 1) {
      return false;
    }

    if (Tweener.getTweenCount(actor)) {
      return false;
    }

    this._buttonDown = true;
    this._grabActor();

    let [stageX, stageY] = event.get_coords();
    this._dragStartX = stageX;
    this._dragStartY = stageY;

    return false;
  },
};

function makeDraggable (actor, params) {
  return new _Draggable(actor, params);
}

function AppGroup () {
  this._init.apply(this, arguments);
}

AppGroup.prototype = {
  _init: function (params) {
    if (DND.LauncherDraggable) {
      DND.LauncherDraggable.prototype._init.call(this);
    }

    this.state = params.state;
    this.listState = params.listState;
    this.groupState = store.init({
      app: params.app,
      appId: params.appId,
      appName: params.app.get_name(),
      appInfo: params.app.get_app_info(),
      metaWindows: params.metaWindows || [],
      lastFocused: params.metaWindow || null,
      isFavoriteApp: !params.metaWindow ? true : params.isFavoriteApp === true,
      autoStartIndex: findIndex(this.state.autoStartApps, app => app.id === params.appId),
      willUnmount: false,
      tooltip: null,
      groupReady: false
    });

    this.groupState.connect({
      isFavoriteApp: () => this.handleFavorite(true),
      getActor: () => this.actor,
      launchNewInstance: () => this.launchNewInstance()
    });

    this.signals = new SignalManager.SignalManager({});

    // TODO: This needs to be in state so it can be updated more reliably.
    this.labelVisible = this.state.settings.titleDisplay !== constants.TitleDisplay.None && this.state.isHorizontal;
    this._progress = 0;
    this.padding = 0;
    this.wasFavapp = false;
    this.time = params.time;
    this.focusedWindow = false;
    this.title = '';
    this.pseudoClassStash = [];

    this.actor = new St.Bin({
      style_class: 'window-list-item-box',
      reactive: true,
      can_focus: true,
      x_fill: true,
      y_fill: true,
      track_hover: false
    });
    this.actor._delegate = this;
    this._container = new Cinnamon.GenericContainer({
      name: 'iconLabelButton'
    });
    this.actor.set_child(this._container);
    this.progressOverlay = new St.Widget({
      name: 'progressOverlay',
      style_class: 'progress',
      reactive: false,
      important: true,
      show_on_set_parent: false
    });
    this._container.add_actor(this.progressOverlay);

    // Create the app button icon, number label, and text label for titleDisplay
    this._iconBox = new St.Bin({ name: 'appMenuIcon' });
    this._iconBox.connect('style-changed', Lang.bind(this, this._onIconBoxStyleChanged));
    // TBD, may not be needed
    //this._iconBox.connect('notify::allocation', Lang.bind(this, this._updateIconBoxClip));
    this._iconBottomClip = 0;
    this._container.add_actor(this._iconBox);
    this._updateIconBoxClip();
    this.setActorAttributes();
    this._label = new St.Label({
      style_class: 'app-button-label',
      text: '',
      show_on_set_parent: this.state.settings.titleDisplay !== 1 && this.state.settings.titleDisplay !== 4
    });
    this._numLabel = new St.Label({
      style_class: 'window-list-item-label window-icon-list-numlabel',
    });
    this._numLabel.clutter_text.ellipsize = false;

    this._container.add_actor(this._numLabel);
    this._label.x_align = St.Align.START;
    this._container.add_actor(this._label);

    this.groupState.set({tooltip: new Tooltips.PanelItemTooltip({actor: this.actor}, '', this.state.orientation)});

    this.rightClickMenu = new SpecialMenus.AppMenuButtonRightClickMenu({
      state: this.state,
      groupState: this.groupState
    });
    Applet.AppletPopupMenu.prototype._init.call(this.rightClickMenu, {actor: this.actor}, this.state.orientation);

    // Set up the hover menu
    this.hoverMenuManager = new SpecialMenus.HoverMenuController({actor: this.actor});
    this.rightClickMenuManager = new PopupMenu.PopupMenuManager({actor: this.actor});
    this.hoverMenu = new SpecialMenus.AppThumbnailHoverMenu(this.state, this.groupState);
    PopupMenu.PopupMenu.prototype._init.call(this.hoverMenu, this.actor, this.state.orientation, 0.5);
    this.hoverMenu.actor.hide();
    Main.layoutManager.addChrome(this.hoverMenu.actor, {});
    this.hoverMenu._setVerticalSetting();
    this.hoverMenu.actor.set_style_class_name('');
    this.hoverMenu.box.set_style_class_name('switcher-list');

    this.hoverMenuManager.addMenu(this.hoverMenu);
    this.rightClickMenuManager.addMenu(this.rightClickMenu);

    this._draggable = makeDraggable(this.actor);
    this.signals.connect(this.hoverMenu.actor, 'enter-event', Lang.bind(this.hoverMenu, this.hoverMenu._onMenuEnter));
    this.signals.connect(this.hoverMenu.actor, 'leave-event', Lang.bind(this.hoverMenu, this.hoverMenu._onMenuLeave));
    this.signals.connect(this.hoverMenu.actor, 'key-release-event', Lang.bind(this.hoverMenu, this.hoverMenu._onKeyRelease));
    this.signals.connect(this.hoverMenu.actor, 'scroll-event', (c, e) => this.state.trigger('cycleWindows', e, this.actor._delegate));
    this.signals.connect(this.hoverMenu.box, 'key-press-event', Lang.bind(this.hoverMenu, this.hoverMenu._onKeyPress));
    this.signals.connect(this._container, 'get-preferred-width', Lang.bind(this, this._getPreferredWidth));
    this.signals.connect(this._container, 'get-preferred-height', Lang.bind(this, this._getPreferredHeight));
    this.signals.connect(this._container, 'allocate', Lang.bind(this, this._allocate));
    this.signals.connect(this.actor, 'enter-event', Lang.bind(this, this._onEnter));
    this.signals.connect(this.actor, 'leave-event', Lang.bind(this, this._onLeave));
    this.signals.connect(this.actor, 'button-release-event', Lang.bind(this, this._onAppButtonRelease));
    this.signals.connect(this.actor, 'button-press-event', Lang.bind(this, this._onAppButtonPress));
    this.signals.connect(this._draggable, 'drag-begin', Lang.bind(this, this._onDragBegin));
    this.signals.connect(this._draggable, 'drag-cancelled', Lang.bind(this, this._onDragCancelled));
    this.signals.connect(this._draggable, 'drag-end', Lang.bind(this, this._onDragEnd));
    this._calcWindowNumber(this.groupState.metaWindows);

    this.on_orientation_changed(true);
    setTimeout(() => {
      if (!this.groupState.set) {
        return;
      }
      this.groupState.set({groupReady: true});
      this.handleFavorite();
    }, 0);
  },

  on_orientation_changed: function(fromInit) {
    this.actor.set_style_class_name('window-list-item-box');
    if (this.state.orientation === St.Side.TOP) {
      this.actor.add_style_class_name('top');
    } else if (this.state.orientation === St.Side.BOTTOM) {
      this.actor.add_style_class_name('bottom');
    } else if (this.state.orientation === St.Side.LEFT) {
      this.actor.add_style_class_name('left');
    } else if (this.state.orientation === St.Side.RIGHT) {
      this.actor.add_style_class_name('right');
    }

    if (this.state.appletReady && !fromInit) {
      this.setActorAttributes();
    }
  },

  setActorAttributes: function() {
    this.actor.style = null;

    // TODO: Button width should be applied to buttons if they don't have a label set, not based on
    // mode, but not currently sure how to unset the fixed width on the actor so it revert to a
    // resizable state without destroying it. Otherwise, buttons with labels don't have enough padding set.
    if (!this.state.isHorizontal
      || this.state.settings.titleDisplay === 1
      || this.state.settings.titleDisplay === 3 && !this.labelVisible) {
      if (this.state.settings.enableAppButtonWidth) {
        this.actor.width = this.state.settings.appButtonWidth;
      } else {
        this.actor.width = this.state.trigger('getPanelHeight');
      }
    }

    if (this.state.isHorizontal) {
      this.actor.height = this.state.trigger('getPanelHeight');
    }
    this.setIcon();
    this._updateIconBoxClip();
    this.setIconPadding();
    this.setMargin();
    this.setTransitionDuration();
  },

  setIconPadding: function () {
    this.themeNode = this.actor.peek_theme_node();
    this.padding = (this.labelVisible ? 0 : Math.floor((this.actor.width - this.iconSize)) / 2);
    if (global.ui_scale > 1) {
      this.padding = this.padding / global.ui_scale - (Math.ceil(this.padding / 4));
    }
    const rightPadding = 0;
    this.actor.style = 'padding-left: ' + this.padding + 'px;padding-right: ' + rightPadding + 'px;';
  },

  setMargin: function() {
    let direction = this.state.isHorizontal ? 'right' : 'bottom';
    let existingStyle = this.actor.style ? this.actor.style : '';
    this.actor.style = existingStyle + 'margin-' + direction + ': ' + this.state.settings.iconSpacing + 'px;';
  },

  setTransitionDuration: function() {
    if (!this.state.settings.appButtonTransitionDuration) {
      return;
    }
    let existingStyle = this.actor.style ? this.actor.style : '';
    this.actor.style = existingStyle + 'transition-duration: ' + this.state.settings.appButtonTransitionDuration + ';';
  },

  _onIconBoxStyleChanged: function() {
    if (this.state.panelEditMode || this.groupState.metaWindows.length === 0) {
      return;
    }
    let node = this._iconBox.get_theme_node();
    this._iconBottomClip = node.get_length('app-icon-bottom-clip');
    this._updateIconBoxClip();
  },

  _updateIconBoxClip: function() {
    let allocation = this._iconBox.allocation;
    if (this._iconBottomClip > 0) {
      this._iconBox.set_clip(
        0,
        0,
        allocation.x2 - allocation.x1,
        allocation.y2 - allocation.y1 - this._iconBottomClip
      );
    } else {
      this._iconBox.remove_clip();
    }
  },

  setIcon: function () {
    let panelHeight = this.state.trigger('getPanelHeight');
    panelHeight = panelHeight % 2 > 0 ? panelHeight + 1 : panelHeight;
    let height = this.state.settings.enableIconSize ? this.state.settings.iconSize : panelHeight;
    if (this.state.trigger('getScaleMode') && this.labelVisible) {
      this.iconSize = Math.round(height * ICON_HEIGHT_FACTOR / global.ui_scale);
    } else {
      this.iconSize = Math.round(height * VERTICAL_ICON_HEIGHT_FACTOR / global.ui_scale);
    }
    let icon;
    if (this.groupState.app) {
      icon = this.groupState.app.create_icon_texture(this.iconSize);
    } else {
      icon = new St.Icon({
        icon_name: 'application-default-icon',
        icon_type: St.IconType.FULLCOLOR,
        icon_size: this.iconSize
      });
    }

    let oldChild = this._iconBox.get_child();
    this._iconBox.set_child(icon);

    if (oldChild) {
      oldChild.destroy();
    }
  },

  setText: function (text) {
    if (text
      && (typeof text === 'string' || text instanceof String)
      && text.length > 0
      && this._label) {
      this._label.set_text(text);
    }
  },

  getAttention: function () {
    if (this._needsAttention) {
      return false;
    }
    this._needsAttention = true;
    let counter = 0;
    this._flashButton(counter);
    return true;
  },

  _flashButton: function (counter) {
    if (!this._needsAttention || !this.actor) {
      return;
    }
    const activePseudoClass = getPseudoClass(this.state.settings.activePseudoClass);
    if (this.state.settings.showActive) {
      this.actor.remove_style_pseudo_class(activePseudoClass);
    }
    this.actor.add_style_class_name('window-list-item-demands-attention');
    if (counter < 4) {
      setTimeout(()=>{
        if (this.actor && this.actor.has_style_class_name('window-list-item-demands-attention')) {
          this.actor.remove_style_class_name('window-list-item-demands-attention');
          if (this.state.settings.showActive) {
            this.actor.add_style_pseudo_class(activePseudoClass);
          }
        }
        setTimeout(()=>{
          this._flashButton(++counter);
        }, constants.FLASH_INTERVAL);
      }, constants.FLASH_INTERVAL);
    }
  },

  _getPreferredWidth: function (actor, forHeight, alloc) {
    let [iconMinSize, iconNaturalSize] = this._iconBox.get_preferred_width(forHeight);
    let labelNaturalSize = this._label.get_preferred_width(forHeight)[1];
    // The label text starts in the center of the icon, so we should allocate the space
    // needed for the icon plus the space needed for(label - icon/2)
    alloc.min_size = iconMinSize;
    if (this.state.orientation === St.Side.TOP || this.state.orientation === St.Side.BOTTOM ) {
      alloc.natural_size = Math.min(iconNaturalSize + Math.max(0, labelNaturalSize), constants.MAX_BUTTON_WIDTH);
    } else {
      alloc.natural_size = this.state.trigger('getPanelHeight');
    }
  },

  _getPreferredHeight: function (actor, forWidth, alloc) {
    let [iconMinSize, iconNaturalSize] = this._iconBox.get_preferred_height(forWidth);
    let [labelMinSize, labelNaturalSize] = this._label.get_preferred_height(forWidth);
    alloc.min_size = Math.min(iconMinSize, labelMinSize);
    alloc.natural_size = Math.max(iconNaturalSize, labelNaturalSize);
  },

  _allocate: function (actor, box, flags) {
    let allocWidth = box.x2 - box.x1;
    let allocHeight = box.y2 - box.y1;
    let childBox = new Clutter.ActorBox();
    let direction = this.actor.get_text_direction();

    // Set the icon to be left-justified (or right-justified) and centered vertically
    let [iconNaturalWidth, iconNaturalHeight] = this._iconBox.get_preferred_size();
    [childBox.y1, childBox.y2] = center(allocHeight, iconNaturalHeight);
    if (direction === Clutter.TextDirection.LTR) {
      [childBox.x1, childBox.x2] = [0, Math.min(iconNaturalWidth, allocWidth)];
    } else {
      [childBox.x1, childBox.x2] = [Math.max(0, allocWidth - iconNaturalWidth), allocWidth];
    }
    this._iconBox.allocate(childBox, flags);

    // Set the label to start its text in the left of the icon
    let iconWidth = childBox.x2 - childBox.x1;
    let [naturalWidth, naturalHeight] = this._label.get_preferred_size();
    [childBox.y1, childBox.y2] = center(allocHeight, naturalHeight);
    if (direction === Clutter.TextDirection.LTR) {
      childBox.x1 = iconWidth;
      childBox.x2 = Math.min(allocWidth, constants.MAX_BUTTON_WIDTH);
    } else {
      childBox.x2 = Math.min(allocWidth - iconWidth, constants.MAX_BUTTON_WIDTH);
      childBox.x1 = Math.max(0, childBox.x2 - naturalWidth);
    }
    this._label.allocate(childBox, flags);
    if (direction === Clutter.TextDirection.LTR) {
      childBox.x1 = -3 * global.ui_scale;
      childBox.x2 = childBox.x1 + this._numLabel.width;
      childBox.y1 = box.y1 - 2;
      childBox.y2 = box.y2 - 1;
    } else {
      childBox.x1 = -this._numLabel.width;
      childBox.x2 = childBox.x1 + this._numLabel.width;
      childBox.y1 = box.y1;
      childBox.y2 = box.y2 - 1;
    }
    this._numLabel.allocate(childBox, flags);

    // Call set_icon_geometry for support of Cinnamon's minimize animation
    if (this.groupState.metaWindows.length > 0 && this._container.realized) {
      let rect = new Meta.Rectangle();
      [rect.x, rect.y] = this._container.get_transformed_position();
      [rect.width, rect.height] = this._container.get_transformed_size();

      each(this.groupState.metaWindows, (metaWindow)=>{
        if (metaWindow) {
          metaWindow.set_icon_geometry(rect);
        }
      });
    }

    if (this.progressOverlay.visible) {
      childBox.x1 = -this.padding;
      childBox.y1 = 0;
      childBox.y2 = this._container.height;
      childBox.x2 = Math.max(this._container.width * (this._progress / 100.0), 1.0);
      this.progressOverlay.allocate(childBox, flags);
    }
  },
  _showLabel: function () {
    this.labelVisible = true;
    if (this._label.text == null) {
      this._label.set_text('');
    }
    // TODO: This should be set by the theme.
    this._label.set_style('padding-right: 4px;');

    Tweener.addTween(this._label, {
      width: constants.MAX_BUTTON_WIDTH, // Should probably check preferred width
      time: constants.BUTTON_BOX_ANIMATION_TIME,
      transition: 'easeOutQuad',
      onComplete: () => {
        this._label.show();
      }
    });
    return false;
  },

  showLabel: function() {
    if (!this._label
      || !this.state.isHorizontal) {
      return false;
    }

    // Fixes 'st_widget_get_theme_node called on the widget which is not in the stage' warnings
    if (!this._label.realized) {
      setTimeout(() => this._showLabel(), 0);
    } else {
      this._showLabel();
    }
  },

  hideLabel: function (animate) {
    if (!this._label) {
      return false;
    }

    if (this._label.text == null) {
      this._label.set_text('');
    }
    this.labelVisible = false;
    if (!animate) {
      this._label.width = 1;
      this._label.hide();
      return false;
    }

    Tweener.addTween(this._label, {
      width: 1,
      time: constants.BUTTON_BOX_ANIMATION_TIME,
      transition: 'easeOutQuad',
      onCompleteScope: this,
      onComplete: function () {
        this._label.hide();
        this._label.set_style('padding-right: 0px;');
      }
    });
    return false;
  },

  _onEnter: function(){
    if (this.state.panelEditMode) {
      return false;
    }
    let hoverPseudoClass = getPseudoClass(this.state.settings.hoverPseudoClass);

    if (this.actor.has_style_pseudo_class('closed')) {
      this.hadClosedPseudoClass = true;
      this.actor.remove_style_pseudo_class('closed');
    }

    if (!this.actor.has_style_pseudo_class(hoverPseudoClass)) {
      this.actor.add_style_pseudo_class(hoverPseudoClass);
    }

    this.hoverMenu._onMenuEnter();
  },

  _onLeave: function(){
    if (this.state.panelEditMode) {
      return false;
    }

    let hoverPseudoClass = getPseudoClass(this.state.settings.hoverPseudoClass);
    let focusPseudoClass = getPseudoClass(this.state.settings.focusPseudoClass);
    let activePseudoClass = getPseudoClass(this.state.settings.activePseudoClass);
    let focused = false;

    each(this.groupState.metaWindows, function(metaWindow) {
      if (getFocusState(metaWindow)) {
        focused = true;
        return false;
      }
    });

    if (!focused
      && (hoverPseudoClass !== focusPseudoClass || hoverPseudoClass !== activePseudoClass)) {
      this.actor.remove_style_pseudo_class(hoverPseudoClass);
    }

    if (this.hadClosedPseudoClass && this.groupState.metaWindows.length === 0) {
      this.hadClosedPseudoClass = false;
      this.actor.add_style_pseudo_class('closed');
    }

    this._setFavoriteAttributes();
    this.hoverMenu._onMenuLeave();
  },

  setActiveStatus: function(windows){
    let pseudoClass = getPseudoClass(this.state.settings.activePseudoClass);
    if (windows.length > 0 && !this.actor.has_style_pseudo_class(pseudoClass)) {
      this.actor.add_style_pseudo_class(pseudoClass);
    } else {
      this.actor.remove_style_pseudo_class(pseudoClass);
    }
  },

  _onProgressChange: function(metaWindow) {
    if (metaWindow.progress !== this._progress) {
      this._progress = metaWindow.progress;
      if (this._progress > 0) {
        this.progressOverlay.show();
      } else {
        this.progressOverlay.hide();
      }
      this._container.queue_relayout();
    }
  },

  _onFocusChange: function (hasFocus) {
    // If any of the windows associated with our app have focus,
    // we should set ourselves to active
    let focusPseudoClass = getPseudoClass(this.state.settings.focusPseudoClass);
    if (hasFocus) {
      this.listState.trigger('updateFocusState', this.groupState.appId)
      this.actor.add_style_pseudo_class(focusPseudoClass);
      if (this.actor.has_style_class_name('window-list-item-demands-attention')) {
        this.actor.remove_style_class_name('window-list-item-demands-attention');
      }
      if (this.actor.has_style_class_name('window-list-item-demands-attention-top')) {
        this.actor.remove_style_class_name('window-list-item-demands-attention-top');
      }
      this._needsAttention = false;
    } else {
      this.actor.remove_style_pseudo_class(focusPseudoClass);
      // If hover pseudo class is substituted with the active pseudo class, make sure it gets removed.
      if (this.state.settings.hoverPseudoClass === 3) {
        this.actor.remove_style_pseudo_class(getPseudoClass(this.state.settings.hoverPseudoClass));
      }
    }
    if (this.state.settings.showActive && this.groupState.metaWindows.length > 0) {
      this.actor.add_style_pseudo_class(getPseudoClass(this.state.settings.activePseudoClass));
    }
  },

  _onWindowDemandsAttention: function (window) {
    // Prevent apps from indicating attention when they are starting up.
    if (!this.groupState
      || !this.groupState.groupReady
      || this.groupState.willUnmount) {
      return;
    }
    let windows = this.groupState.metaWindows;
    for (let i = 0, len = windows.length; i < len; i++) {
      if (isEqual(windows[i], window)) {
        this.getAttention();
        return true;
      }
    }
    return false;
  },

  _onDragBegin: function() {
    // TBD - breaks dragging on Cinnamon 3.4
    /*if (this.state.isHorizontal) {
      this._draggable._overrideY = this.actor.get_transformed_position()[1];
      this._draggable._overrideX = null;
    } else {
      this._draggable._overrideX = this.actor.get_transformed_position()[0];
      this._draggable._overrideY = null;
    }*/
    this.groupState.trigger('hoverMenuClose');
  },

  _onDragEnd: function () {
    this.rightClickMenu.close(false);
    this.hoverMenu.close(false);
    this.listState.trigger('updateAppGroupIndexes', this.groupState.appId);
    this.state.trigger('_clearDragPlaceholder');
  },

  _onDragCancelled: function () {
    this.rightClickMenu.close(false);
    this.hoverMenu.close(false);
    this.state.trigger('_clearDragPlaceholder');
  },

  handleDragOver: function (source, actor, x, y, time) {
    if (!this.state.settings.enableDragging
      || source instanceof AppGroup
      || (DND.LauncherDraggable && source instanceof DND.LauncherDraggable)
      || this.state.panelEditMode) {
      return DND.DragMotionResult.CONTINUE;
    }
    if (this.groupState.metaWindows.length > 0 && this.groupState.lastFocused) {
      Main.activateWindow(this.groupState.lastFocused, global.get_current_time());
    }
    return true;
  },

  getDragActor: function () {
    return this.groupState.app.create_icon_texture(this.state.trigger('getPanelHeight'));
  },

  // Returns the original actor that should align with the actor
  // we show as the item is being dragged.
  getDragActorSource: function () {
    return this.actor;
  },

  showOrderLabel: function (number) {
    this._numLabel.text = (number + 1).toString();
    this._numLabel.show();
  },

  launchNewInstance: function() {
    this.groupState.app.open_new_window(-1);
    this._animate();
  },

  _onAppButtonRelease: function(actor, event) {
    this.state.trigger('_clearDragPlaceholder');
    let button = event.get_button();

    let shouldStartInstance = ((button === 1 && this.groupState.isFavoriteApp && this.groupState.metaWindows.length === 0 && this.state.settings.leftClickAction === 2)
      || (button === 2 && this.state.settings.middleClickAction === 2));

    let shouldEndInstance = button === 2 && this.state.settings.middleClickAction === 3 && this.groupState.lastFocused;

    if (shouldStartInstance) {
      this.launchNewInstance();
      return;
    }

    if (shouldEndInstance) {
      this.groupState.lastFocused.delete(global.get_current_time());
      return;
    }

    let handleMinimizeToggle = (win)=>{
      if (this.state.settings.onClickThumbs && this.groupState.metaWindows.length > 1) {
        if (this.hoverMenu.isOpen) {
          this.hoverMenu.close();
        } else {
          this.hoverMenu.open();
        }
        if (this.state.overlayPreview) {
          this.hoverMenu.appThumbnails[0].destroyOverlayPreview();
          this.hoverMenu.close(true);
        }
        return;
      }
      if (win.appears_focused) {
        win.minimize();
      } else {
        Main.activateWindow(win, global.get_current_time());
      }
    };

    if (button === 1) {
      if (this.state.settings.leftClickAction === 1) {
        return;
      }
      if (this.state.settings.leftClickAction === 3) {
        this.state.trigger('cycleWindows', null, this.actor._delegate);
        return;
      }
      this.hoverMenu.shouldOpen = false;
      if (this.rightClickMenu.isOpen) {
        this.rightClickMenu.toggle();
      }
      if (this.groupState.metaWindows.length === 1) {
        handleMinimizeToggle(this.groupState.metaWindows[0]);
      } else {
        let actionTaken = false;
        for (let i = 0, len = this.groupState.metaWindows.length; i < len; i++) {
          if (this.groupState.lastFocused && isEqual(this.groupState.metaWindows[i], this.groupState.lastFocused)) {
            handleMinimizeToggle(this.groupState.metaWindows[i]);
            actionTaken = true;
            break;
          }
        }
        if (!actionTaken) {
          handleMinimizeToggle(this.groupState.metaWindows[0]);
        }
      }
    } else if (button === 3) {
      if (!this.rightClickMenu.isOpen) {
        this.listState.trigger('_closeAllRightClickMenus', ()=>{
          this.listState.trigger('_closeAllHoverMenus', ()=>{
            this.rightClickMenu.open();
          });
        });
      } else {
        this.listState.trigger('_closeAllRightClickMenus', this.listState.trigger('_closeAllHoverMenus'));
      }
    }
    this.hoverMenu._onButtonPress();
  },

  _onAppButtonPress: function(actor, event){
    let button = event.get_button();
    if (button === 3) {
      return true;
    }
    return false;
  },

  _onAppKeyPress: function () {
    if (this.groupState.isFavoriteApp && this.groupState.metaWindows.length === 0) {
      this.launchNewInstance();
    } else {
      if (this.groupState.metaWindows.length > 1) {
        this.hoverMenu.open(true);
      } else {
        this.listState.trigger('_closeAllHoverMenus');
      }
      this._windowHandle(false);
    }
  },

  _windowHandle: function () {
    if (this.groupState.lastFocused.appears_focused) {
      if (this.groupState.metaWindows.length > 1) {
        let nextWindow = null;
        for (let i = 0, max = this.groupState.metaWindows.length - 1; i < max; i++) {
          if (isEqual(this.groupState.metaWindows[i], this.groupState.lastFocused)) {
            nextWindow = this.groupState.metaWindows[i + 1];
            break;
          }
        }
        if (nextWindow === null){
          nextWindow = this.groupState.metaWindows[0];
        }
        Main.activateWindow(nextWindow, global.get_current_time());
      } else {
        this.groupState.lastFocused.minimize();
        this.actor.remove_style_pseudo_class('focus');
      }
    } else {
      if (this.groupState.lastFocused.minimized) {
        this.groupState.lastFocused.unminimize();
      }
      let ws = this.groupState.lastFocused.get_workspace().index();
      if (ws !== global.screen.get_active_workspace_index()) {
        global.screen.get_workspace_by_index(ws).activate(global.get_current_time());
      }
      Main.activateWindow(this.groupState.lastFocused, global.get_current_time());
      this.actor.add_style_pseudo_class('focus');
    }
  },

  _windowAdded: function (metaWindow, metaWindows) {
    if (metaWindows) {
      this.groupState.metaWindows = [];
      for (var i = 0; i < metaWindows.length; i++) {
        this.groupState.metaWindows.push(metaWindows[i]);
      }
    }
    let refWindow = findIndex(this.groupState.metaWindows, win => {
      return isEqual(win, metaWindow);
    });
    if (metaWindow) {
      this.signals.connect(metaWindow, 'notify::title', Lang.bind(this, throttle(this._windowTitleChanged, 100, true)));
      this.signals.connect(metaWindow, 'notify::appears-focused', Lang.bind(this, this._focusWindowChange));
      this.signals.connect(metaWindow, 'notify::gtk-application-id', this._onAppChange);
      this.signals.connect(metaWindow, 'notify::wm-class', this._onAppChange);
      if (metaWindow.progress !== undefined) {
        this._progress = metaWindow.progress;
        this.signals.connect(metaWindow, 'notify::progress', () => this._onProgressChange(metaWindow));
      }

      // Set the initial button label as not all windows will get updated via signals initially.
      this._windowTitleChanged(metaWindow);
      if (refWindow === -1) {
        this.groupState.metaWindows.push(metaWindow);
        this.groupState.trigger('addThumbnailToMenu', metaWindow);
      }
      this._calcWindowNumber(this.groupState.metaWindows);
      this._onFocusChange();
    }
    this.groupState.set({
      metaWindows: this.groupState.metaWindows,
      lastFocused: metaWindow,
    });
    this.handleFavorite();
  },

  _windowRemoved: function (metaWorkspace, metaWindow, refWindow, cb) {
    if (refWindow === -1) {
      return false;
    }
    this.signals.disconnect('notify::title', metaWindow);
    this.signals.disconnect('notify::appears-focused', metaWindow);
    this.signals.disconnect('notify::gtk-application-id', metaWindow);
    this.signals.disconnect('notify::wm-class', metaWindow);

    this.groupState.metaWindows.splice(refWindow, 1);
    this._calcWindowNumber(this.groupState.metaWindows);
    if (this.groupState.metaWindows.length > 0 && !this.groupState.willUnmount) {
      if (this.progressOverlay.visible && metaWindow.progress > 0) {
        this._progress = 0;
        this.progressOverlay.visible = false;
      }
      this._windowTitleChanged(this.groupState.lastFocused);
      this.groupState.set({
        metaWindows: this.groupState.metaWindows,
        lastFocused: this.groupState.metaWindows[this.groupState.metaWindows.length - 1]
      }, true);
      this.groupState.trigger('removeThumbnailFromMenu', metaWindow);
    } else {
      // This is the last window, so this group needs to be destroyed. We'll call back _windowRemoved
      // in appList to put the final nail in the coffin.
      if (typeof cb === 'function') {
        cb(this.groupState.appId, this.groupState.isFavoriteApp);
      }
    }
  },

  _onAppChange: function(metaWindow) {
    if (!this.listState) {
      return;
    }
    this.listState.trigger('_windowRemoved', metaWindow);
    this.listState.trigger('_windowAdded', metaWindow);
  },

  _windowTitleChanged: function (metaWindow, refresh) {
    if (this.groupState.willUnmount || !this.state.settings) {
      return;
    }

    let shouldHideLabel = this.state.settings.titleDisplay === constants.TitleDisplay.None || !this.state.isHorizontal;

    if (shouldHideLabel) {
      this.setText('');
    }

    if (!refresh && (!metaWindow
      || !metaWindow.title
      || (this.groupState.metaWindows.length === 0 && this.groupState.isFavoriteApp)
      || !this.state.isHorizontal)) {
      this.hideLabel();
      return;
    }

    if ((metaWindow.lastTitle && metaWindow.lastTitle === metaWindow.title)
      && !refresh && shouldHideLabel) {
      return;
    }
    metaWindow.lastTitle = metaWindow.title;

    each(this.hoverMenu.appThumbnails, (thumbnail)=>{
      if (isEqual(thumbnail.metaWindow, metaWindow)) {
        thumbnail._label.set_text(metaWindow.title);
        return false;
      }
    });

    this.groupState.set({appName: this.groupState.app.get_name()});
    if (this.state.settings.titleDisplay === constants.TitleDisplay.Title) {
      this.setText(metaWindow.title);
      this.showLabel(true);
    } else if (this.state.settings.titleDisplay === constants.TitleDisplay.App) {
      if (this.groupState.appName) {
        this.setText(this.groupState.appName);
        this.showLabel(true);
      }
    }
  },

  _focusWindowChange: function (metaWindow) {
    if (this.groupState.metaWindows.length === 0) {
      return;
    }

    let hasFocus = getFocusState(metaWindow);
    if (hasFocus && this.groupState.hasOwnProperty('lastFocused')) {
      this.listState.set({lastFocusedApp: this.groupState.appId});
      this.groupState.set({lastFocused: metaWindow});
    }
    this._onFocusChange(hasFocus);
    if (this.state.settings.titleDisplay > 1) {
      if (hasFocus) {
        this.setText(metaWindow.title);
        this.showLabel(true);
      } else if (this.state.settings.titleDisplay === constants.TitleDisplay.Focused) {
        this.hideLabel(true);
      }
    }
    if (this.state.settings.sortThumbs) {
      this.hoverMenu.addThumbnail(metaWindow);
    }
  },

  handleFavorite: function (changed) {
    if (changed) {
      setTimeout(() => this.listState.trigger('updateAppGroupIndexes', this.groupState.appId), 0);
    }
    this._setFavoriteAttributes();
    if (this.groupState.metaWindows.length === 0
      && this.state.appletReady) {
      this.hoverMenu.close();
      this._onLeave();
      this.actor.add_style_pseudo_class('closed');
      return;
    } else if (this.actor.has_style_pseudo_class('closed')) {
      this.actor.remove_style_pseudo_class('closed');
    }
    this._windowTitleChanged(this.groupState.lastFocused);
    this._onFocusChange();
  },

  _setFavoriteAttributes: function () {
    let pseudoClasses = ['active', 'focus', 'hover'];
    if ((!this.groupState.app || this.groupState.app.state === 0)
      && this.groupState.isFavoriteApp) {
      for (let i = 0; i < pseudoClasses.length; i++) {
        let pseudoClass = getPseudoClass(this.state.settings[pseudoClasses[i] + 'PseudoClass']);
        if (this.actor.has_style_pseudo_class(pseudoClass)) {
          this.actor.remove_style_pseudo_class(pseudoClass);
        }
      };
    }
  },

  _calcWindowNumber: function () {
    if (this.groupState.willUnmount) {
      return false;
    }

    let windowNum = this.groupState.metaWindows ? this.groupState.metaWindows.length : 0;
    this._numLabel.text = windowNum.toString();
    if (this.state.settings.numDisplay === constants.NumberDisplay.Smart) {
      if (windowNum <= 1) {
        this._numLabel.hide();
      } else {
        this._numLabel.show();
      }
    } else if (this.state.settings.numDisplay === constants.NumberDisplay.Normal) {
      if (windowNum <= 0) {
        this._numLabel.hide();
      }
      else {
        this._numLabel.show();
      }
    } else if (this.state.settings.numDisplay === constants.NumberDisplay.All) {
      this._numLabel.show();
    } else {
      this._numLabel.hide();
    }
  },

  handleTitleDisplayChange: function() {
    each(this.groupState.metaWindows, (win) => {
      this._windowTitleChanged(win, true);
      if (this.state.settings.titleDisplay !== constants.TitleDisplay.Focused
        || getFocusState(win)) {
        this.showLabel();
      }
    });
  },

  _animate: function (step = 0) {
    let effect = this.state.settings.launcherAnimationEffect;
    if (effect === 1) {
      return;
    } else if (effect === 2) {
      this._iconBox.set_z_rotation_from_gravity(0.0, Clutter.Gravity.CENTER);
      Tweener.addTween(this._iconBox, {
        opacity: 70,
        time: 1.0,
        transition: 'linear',
        onCompleteScope: this,
        onComplete: function () {
          Tweener.addTween(this._iconBox, {
            opacity: 255,
            time: 0.5,
            transition: 'linear'
          });
        }
      });
    } else if (effect === 3) {
      // Based on https://github.com/linuxmint/Cinnamon/blob/44b70147be6d68278ef88b758a740ccce92195d0/files/usr/share/cinnamon/applets/panel-launchers%40cinnamon.org/applet.js#L217
      if (step >= 3) {
        return;
      }
      this._iconBox.set_pivot_point(0.5, 0.5);
      Tweener.addTween(this._iconBox, {
        scale_x: 0.7,
        scale_y: 0.7,
        time: 0.2,
        transition: 'easeOutQuad',
        onComplete: () => {
          Tweener.addTween(this._iconBox, {
            scale_x: 1.0,
            scale_y: 1.0,
            time: 0.2,
            transition: 'easeOutQuad',
            onComplete: () => {
              this._animate(step + 1);
            },
          });
        },
      });
    }

  },

  destroy: function (skipRefCleanup) {
    this.signals.disconnectAllSignals();
    this.groupState.set({willUnmount: true});

    if (this.rightClickMenu) {
      if (this.rightClickMenu.isOpen) {
        this.rightClickMenu.close();
      }
      this.rightClickMenu.destroy();
    }
    this.hoverMenu.destroy();
    this.listState.trigger('removeChild', this.actor);
    this._container.destroy();
    this.actor.destroy();

    if (!skipRefCleanup) {
      this.groupState.destroy();
      unref(this);
    }
  }
};

/*let keys = Object.getOwnPropertyNames(AppGroup.prototype);
for (let i = 0; i < keys.length; i++) {
  if (typeof AppGroup.prototype[keys[i]] === 'function') {
    let orig = AppGroup.prototype[keys[i]];
    AppGroup.prototype[keys[i]] = new Proxy(orig, {
      apply: function(target, thisA, args) {
        try {throw new Error(e)} catch (e) {
          let trace = '';
          let split = e.stack.split('\n');
          for (let i = split.length - 1; i >= 0; i--) {
            let fmt = split[i].split('@')[0].trim();
            if (!fmt || split[i].indexOf('keys[i]') > -1) {
              continue;
            }
            trace += `==> ${fmt} `;
          }
          log(`${Date.now()} ${trace}`);
        }
        return target.call(thisA, ...args);
      }
    });
  }
}*/