const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;

const AppletDir = imports.ui.appletManager.applets['IcingTaskManager@json'];

const _ = AppletDir.lodash._;
const each = AppletDir.each.each;
const constants = AppletDir.constants.constants;
const setTimeout = AppletDir.timers.setTimeout;

// Creates a button with an icon and a label.
// The label text must be set with setText
// @icon: the icon to be displayed
// Button with icon and label.  Click events
// need to be attached manually, but automatically
// highlight when a window of app has focus.

function AppButton () {
  this._init.apply(this, arguments);
}

AppButton.prototype = {

  _init: function (parent) {
    this.app = parent.app;
    this._applet = parent._applet;
    this._parent = parent;
    this.isFavapp = parent.isFavapp;
    this.metaWindow = null;
    this.metaWindows = [];
    this.settings = this._applet.settings;
    this.actor = new St.Bin({
      style_class: 'window-list-item-box',
      reactive: true,
      can_focus: true,
      x_fill: true,
      y_fill: false,
      track_hover: true
    });
    this.actor.height = parent._applet._panelHeight;
    this.actor._delegate = this;

    this.signals = {
      _container: [],
      settings: [],
      actor: []
    };

    // We do a fancy layout with icons and labels, so we'd like to do our own allocation
    // in a Cinnamon.GenericContainer
    this._container = new Cinnamon.GenericContainer({
      name: 'iconLabelButton'
    });

    if (this._applet.orientation === St.Side.TOP) {
      this.actor.add_style_class_name('top');
    } else if (this._applet.orientation === St.Side.BOTTOM) {
      this.actor.add_style_class_name('bottom');
    } else if (this._applet.orientation === St.Side.LEFT) {
      this.actor.add_style_class_name('left');
    } else if (this._applet.orientation === St.Side.RIGHT) {
      this.actor.add_style_class_name('right');
    }

    this.actor.set_child(this._container);
    this.signals._container.push(this._container.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth)));
    this.signals._container.push(this._container.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight)));
    this.signals._container.push(this._container.connect('allocate', Lang.bind(this, this._allocate)));

    this.iconSize = this._applet.enableIconSize ? this._applet.iconSize : 16;
    this.icon = this.app.create_icon_texture(this.iconSize);

    this._label = new St.Label({
      style_class: 'app-button-label',
      text: ''
    });
    this._numLabel = new St.Label({
      style_class: 'window-list-item-label window-icon-list-numlabel'
    });

    this._container.add_actor(this.icon);
    this._container.add_actor(this._label);
    this._container.add_actor(this._numLabel);

    setTimeout(()=>this.setIconPadding(true), 0);

    this.panelEditId = global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
    this.signals.settings.push(this.settings.connect('changed::icon-padding', Lang.bind(this, this.setIconPadding)));
    this.signals.settings.push(this.settings.connect('changed::icon-size', Lang.bind(this, this.setIconSize)));
    this.signals.settings.push(this.settings.connect('changed::enable-iconSize', Lang.bind(this, this.setIconSize)));

    if (this.isFavapp) {
      this._isFavorite(true);
    }

    this._trackerSignal = this._applet.tracker.connect('notify::focus-app', Lang.bind(this, this._onFocusChange));
    this._updateAttentionGrabber(null, null, this._applet.showAlerts);
    this.signals.settings.push(this.settings.connect('changed::show-alerts', Lang.bind(this, this._updateAttentionGrabber)));
    this.signals.actor.push(this.actor.connect('enter-event', Lang.bind(this, this._onEnter)));
    this.signals.actor.push(this.actor.connect('leave-event', Lang.bind(this, this._onLeave)));
  },

  on_panel_edit_mode_changed: function () {
    this.actor.reactive = !global.settings.get_boolean('panel-edit-mode');
  },

  setIconPadding: function (init) {
    // TBD - this method doesn't work across all themes and needs to be fixed or replaced
    if (!this.actor.get_stage() && !init) {
      return false;
    }

    if (init && this._applet.themePadding) {
      this.themeNode = this.actor.peek_theme_node();
      let themePadding = this.themeNode ? this.themeNode.get_horizontal_padding() : 4;
      this.offsetPadding =  themePadding > 10 ? _.round(themePadding / 4) : themePadding > 7 ? _.round(themePadding / 2) : 5;
    }
    if (this._applet.orientation === St.Side.TOP || this._applet.orientation === St.Side.BOTTOM) {
      let padding;
      if (this._applet.themePadding) {
        padding = padding = this._applet.iconPadding <= 5 ? [this.offsetPadding % 2 === 1 ? this.offsetPadding : this.offsetPadding - 1 + 'px', '0px'] : [this._applet.iconPadding + 'px', this._applet.iconPadding - (this.offsetPadding > 0 && this.offsetPadding % 2 === 1 ? 5 : 4) + 'px'];
      } else {
        padding = this._applet.iconPadding <= 5 ? ['6px', '0px'] : [this._applet.iconPadding + 'px', this._applet.iconPadding - 5 + 'px'];
      }
      this.actor.set_style('padding-bottom: 0px;padding-top:0px; padding-left: ' + padding[0] + ';padding-right: ' + padding[1] + ';');
    }
  },

  setIconSize: function () {
    let size = this._applet.iconSize;
    if (this._applet.enableIconSize) {
      this.icon.destroy();
      this.icon = this.app.create_icon_texture(this._applet.iconSize);
      this._container.insert_child_at_index(this.icon, 0);
    }
  },

  setText: function (text) {
    text = text ? text : '';
    if (text && text.length > 0 && text.indexOf('null') === -1) {
      this._label.set_text(text);
      if (text.length > 0) {
        this._label.set_style('padding-right: 4px;');
      }
    }
  },

  setStyle: function (name) {
    if (name) {
      this.actor.set_style_class_name(name);
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
    if (!this._needsAttention) {
      return;
    }
    if (this._applet.showActive) {
      this.actor.remove_style_pseudo_class(_.find(constants.pseudoOptions, {id: this._applet.activePseudoClass}).label);
    }
    this.actor.add_style_class_name('window-list-item-demands-attention');
    if (counter < 4) {
      setTimeout(()=>{
        if (this.actor.has_style_class_name('window-list-item-demands-attention')) {
          this.actor.remove_style_class_name('window-list-item-demands-attention');
          if (this._applet.showActive) {
            this.actor.add_style_pseudo_class(_.find(constants.pseudoOptions, {id: this._applet.activePseudoClass}).label);
          }
        }
        setTimeout(()=>{
          this._flashButton(++counter);
        }, constants.FLASH_INTERVAL);
      }, constants.FLASH_INTERVAL);
    }
  },

  _getPreferredWidth: function (actor, forHeight, alloc) {
    let [iconMinSize, iconNaturalSize] = this.icon.get_preferred_width(forHeight);
    let [labelMinSize, labelNaturalSize] = this._label.get_preferred_width(forHeight);
    // The label text is starts in the center of the icon, so we should allocate the space
    // needed for the icon plus the space needed for(label - icon/2)
    alloc.min_size = iconMinSize;
    if (this._applet.titleDisplay === 3 && !this._parent.isFavapp) {
      alloc.natural_size = constants.MAX_BUTTON_WIDTH;
    }
    else {
      alloc.natural_size = Math.min(iconNaturalSize + Math.max(0, labelNaturalSize), constants.MAX_BUTTON_WIDTH);
    }
  },

  _getPreferredHeight: function (actor, forWidth, alloc) {
    let [iconMinSize, iconNaturalSize] = this.icon.get_preferred_height(forWidth);
    let [labelMinSize, labelNaturalSize] = this._label.get_preferred_height(forWidth);
    alloc.min_size = Math.min(iconMinSize, labelMinSize);
    alloc.natural_size = Math.max(iconNaturalSize, labelNaturalSize);
  },

  _allocate: function (actor, box, flags) {
    // returns [x1,x2] so that the area between x1 and x2 is
    // centered in length

    function center (length, naturalLength) {
      let maxLength = Math.min(length, naturalLength);
      let x1 = Math.max(0, Math.floor((length - maxLength) / 2));
      let x2 = Math.min(length, x1 + maxLength);
      return [x1, x2];
    }
    let allocWidth = box.x2 - box.x1;
    let allocHeight = box.y2 - box.y1;
    let childBox = new Clutter.ActorBox();
    let direction = this.actor.get_text_direction();

    // Set the icon to be left-justified (or right-justified) and centered vertically
    let [iconNaturalWidth, iconNaturalHeight] = this.icon.get_preferred_size();
    [childBox.y1, childBox.y2] = center(allocHeight, iconNaturalHeight);
    if (direction === Clutter.TextDirection.LTR) {
      [childBox.x1, childBox.x2] = [0, Math.min(iconNaturalWidth, allocWidth)];
    } else {
      [childBox.x1, childBox.x2] = [Math.max(0, allocWidth - iconNaturalWidth), allocWidth];
    }
    this.icon.allocate(childBox, flags);

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
      childBox.x1 = -3;
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
    if (this.metaWindows.length > 0 && this._container.get_stage()) {
      let rect = new Meta.Rectangle();
      [rect.x, rect.y] = this._container.get_transformed_position();
      [rect.width, rect.height] = this._container.get_transformed_size();

      each(this.metaWindows, (metaWindow)=>{
        if (metaWindow) {
          metaWindow.set_icon_geometry(rect);
        }
      });
    }
  },
  showLabel: function (animate, targetWidth=constants.MAX_BUTTON_WIDTH) {
    if (!this._label) {
      return false;
    }
    if (!this._label.text) {
      this._label.set_text('');
    }
    // TBD
    /*let setToZero
    if (this._label.width < 2) {
      this._label.set_width(-1)
      setToZero = true
    } else if (this._label.text && this._label.width < (this._label.text.length * 7) - 5 || this._label.width > (this._label.text.length * 7) + 5) {
      this._label.set_width(-1)
    }
    let width = Math.min(targetWidth)
    if (setToZero) {
      this._label.width = 1
    }
    if (!animate) {
      this._label.width = width
      return
    }*/
    this._label.show();
    Tweener.addTween(this._label, {
      width: targetWidth,
      time: constants.BUTTON_BOX_ANIMATION_TIME,
      transition: 'easeOutQuad'
    });
    return false;
  },

  hideLabel: function (animate) {
    if (!this._label) {
      return false;
    }
    if (!this._label.text) {
      this._label.set_text('');
    }
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
      }
    });
    return false;
  },

  _onEnter: function(){
    this.actor.add_style_pseudo_class(_.find(constants.pseudoOptions, {id: this._applet.hoverPseudoClass}).label);
  },

  _onLeave: function(){
    if (this.metaWindows.length > 0 && (this._applet.activePseudoClass === 1 || (this._applet.focusPseudoClass === 1 && this._hasFocus()))) {
      setTimeout(()=>this.actor.add_style_pseudo_class('hover'), 0);
    } else if (this._applet.hoverPseudoClass > 1) {
      if (this._applet.hoverPseudoClass === this._applet.activePseudoClass && this.metaWindows.length > 0) {
        return;
      }
      setTimeout(()=>this.actor.remove_style_pseudo_class(_.find(constants.pseudoOptions, {id: this._applet.hoverPseudoClass}).label), 0);
    }
  },

  setActiveStatus: function(windows){
    if (windows.length > 0) {
      this.actor.add_style_pseudo_class(_.find(constants.pseudoOptions, {id: this._applet.activePseudoClass}).label);
    } else {
      this.actor.remove_style_pseudo_class(_.find(constants.pseudoOptions, {id: this._applet.activePseudoClass}).label);
    }
  },

  setMetaWindow: function (metaWindow, metaWindows) {
    this.metaWindow = metaWindow;
    this.metaWindows = _.map(metaWindows, 'win');
  },

  _onFocusChange: function () {
    // If any of the windows associated with our app have focus,
    // we should set ourselves to active
    if (this._hasFocus()) {
      this.actor.add_style_pseudo_class(_.find(constants.pseudoOptions, {id: this._applet.focusPseudoClass}).label);
      this.actor.remove_style_class_name('window-list-item-demands-attention');
      this.actor.remove_style_class_name('window-list-item-demands-attention-top');
      this._needsAttention = false;
    } else {
      this.actor.remove_style_pseudo_class(_.find(constants.pseudoOptions, {id: this._applet.focusPseudoClass}).label);
      /*if (this._applet.showActive && this.metaWindows.length > 0) {
        this.actor.add_style_pseudo_class('active')
      }*/
    }
  },

  _hasFocus: function () {
    let workspaceIds = [];

    let workspaces = _.map(this._applet.metaWorkspaces, 'ws');

    for (let i = 0, len = workspaces.length; i < len; i++) {
      workspaceIds.push(workspaces[i].index());
    }

    let windows = _.filter(this.metaWindows, (win)=>{
      return workspaceIds.indexOf(this._applet.currentWs) >= 0;
    });

    let hasTransient = false;
    let handleTransient = function(transient){
      if (transient.has_focus()) {
        hasTransient = true;
        return false;
      }
      return true;
    };

    for (let i = 0, len = windows.length; i < len; i++) {
      if (windows[i].minimized) {
        continue;
      }
      if (windows[i].has_focus()) {
        return true;
      }
      windows[i].foreach_transient(handleTransient);
    }
    return hasTransient;
  },

  _updateAttentionGrabber: function (obj, oldVal, newVal) {
    if (newVal) {
      this._urgent_signal = global.display.connect('window-marked-urgent', Lang.bind(this, this._onWindowDemandsAttention));
      this._attention_signal = global.display.connect('window-demands-attention', Lang.bind(this, this._onWindowDemandsAttention));
    } else {
      if (this._urgent_signal) {
        global.display.disconnect(this._urgent_signal);
      }
      if (this._attention_signal) {
        global.display.disconnect(this._attention_signal);
      }
    }
  },

  _onWindowDemandsAttention: function (display, window) {
    let windows = this.app.get_windows();
    for (let i = 0, len = windows.length; i < len; i++) {
      if (_.isEqual(windows[i], window)) {
        this.getAttention();
        return true;
      }
    }
    return false;
  },

  _isFavorite: function (isFav) {
    this.isFavapp = isFav;
    if (isFav && this._applet.panelLauncherClass) {
      if (this._applet.orientation === St.Side.LEFT || this._applet.orientation === St.Side.RIGHT) {
       this.setStyle('panel-launcher-vertical');
      } else {
       this.setStyle('panel-launcher');
      }
      if (this._label) {
        this._label.set_text('');
      }
    } else {
      if (this._applet.panelLauncherClass) {
        this.setStyle('window-list-item-box');
      }
      if (this._applet.orientation === St.Side.TOP) {
       this.actor.add_style_class_name('window-list-item-box-top');
      } else if (this._applet.orientation === St.Side.BOTTOM) {
       this.actor.add_style_class_name('window-list-item-box-bottom');
      } else if (this._applet.orientation === St.Side.LEFT) {
       this.actor.add_style_class_name('window-list-item-box-left');
      } else if (this._applet.orientation === St.Side.RIGHT) {
       this.actor.add_style_class_name('window-list-item-box-right');
      }
    }
  },

  destroy: function () {
    this._applet.tracker.disconnect(this._trackerSignal);
    each(this.signals, (signal, key)=>{
      each(signal, (id)=>{
        this[key].disconnect(id);
      });
    });
    global.settings.disconnect(this.panelEditId);
    try {
      this._container.destroy_children();
    } catch (e) {}
    this._container.destroy();
    this.actor.destroy();
    if (this._urgent_signal) {
      global.display.disconnect(this._urgent_signal);
    }
    if (this._attention_signal) {
      global.display.disconnect(this._attention_signal);
    }
  }
};

function _Draggable (actor, params) {
  this._init(actor, params);
}

_Draggable.prototype = {
  __proto__: DND._Draggable.prototype,

  _grabActor: function () {
        // Clutter.grab_pointer(this.actor);
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