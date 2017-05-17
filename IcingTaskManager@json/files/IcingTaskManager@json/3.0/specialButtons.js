'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var Clutter = imports.gi.Clutter;
var Lang = imports.lang;
var Cinnamon = imports.gi.Cinnamon;
var St = imports.gi.St;
var Tweener = imports.ui.tweener;
var DND = imports.ui.dnd;
var _ = imports.applet._;
var clog = imports.applet.clog;
var setTimeout = imports.applet.setTimeout;

var BUTTON_BOX_ANIMATION_TIME = 0.5;
var MAX_BUTTON_WIDTH = 150; // Pixels
var FLASH_INTERVAL = 500;

var TitleDisplay = {
  None: 1,
  App: 2,
  Title: 3,
  Focused: 4
};

// Creates a button with an icon and a label.
// The label text must be set with setText
// @icon: the icon to be displayed

function IconLabelButton() {
  this._init.apply(this, arguments);
}

IconLabelButton.prototype = {
  _init: function _init(parent) {
    if (parent.icon === null) {
      throw 'IconLabelButton icon argument must be non-null';
    }
    this._parent = parent;
    this._applet = parent._applet;
    this._icon = parent.icon;
    this.actor = new St.Bin({
      style_class: 'window-list-item-box app-list-item-box',
      reactive: true,
      can_focus: true,
      x_fill: true,
      y_fill: false,
      track_hover: true
    });
    this.actor.height = parent._applet._panelHeight;
    this.actor._delegate = this;
    this.metaWorkspaces = [];

    // We do a fancy layout with icons and labels, so we'd like to do our own allocation
    // in a Cinnamon.GenericContainer
    this._container = new Cinnamon.GenericContainer({
      name: 'iconLabelButton'
    });

    if (this._applet.orientation == St.Side.TOP) {
      this.actor.add_style_class_name('top');
    } else if (this._applet.orientation == St.Side.BOTTOM) {
      this.actor.add_style_class_name('bottom');
    } else if (this._applet.orientation == St.Side.LEFT) {
      this.actor.add_style_class_name('left');
    } else if (this._applet.orientation == St.Side.RIGHT) {
      this.actor.add_style_class_name('right');
    }
    this.actor.set_child(this._container);
    this._container.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
    this._container.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
    this._container.connect('allocate', Lang.bind(this, this._allocate));

    this._label = new St.Label({
      style_class: 'app-button-label'
    });
    this._numLabel = new St.Label({
      style_class: 'window-list-item-label window-icon-list-numlabel'
    });

    this._container.add_actor(this._icon);
    this._container.add_actor(this._label);
    this._container.add_actor(this._numLabel);

    this.setIconPadding();
    this.setIconSize();

    global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
    this._applet.settings.connect('changed::icon-padding', Lang.bind(this, this.setIconPadding));
    this._applet.settings.connect('changed::icon-size', Lang.bind(this, this.setIconSize));
    this._applet.settings.connect('changed::enable-iconSize', Lang.bind(this, this.setIconSize));
  },

  on_panel_edit_mode_changed: function on_panel_edit_mode_changed() {
    this.actor.reactive = !global.settings.get_boolean('panel-edit-mode');
  },

  setIconPadding: function setIconPadding() {
    if (this._applet.orientation === St.Side.TOP || this._applet.orientation == St.Side.BOTTOM) {
      var padding = this._applet.iconPadding <= 5 ? ['6px', '0px'] : [this._applet.iconPadding + 'px', this._applet.iconPadding - 5 + 'px'];
      this.actor.style = 'padding-bottom: 0px;padding-top:0px; padding-left: ' + padding[0] + ';padding-right: ' + padding[1] + ';';
    }
  },

  setIconSize: function setIconSize() {
    var size = this._applet.iconSize;
    if (this._applet.enableIconSize) {
      this._icon.set_size(size, size);
    }
  },

  setText: function setText(text) {
    if (text) {
      this._label.text = text;
    }
  },

  setStyle: function setStyle(name) {
    if (name) {
      this.actor.set_style_class_name(name);
    }
  },

  getAttention: function getAttention() {
    if (this._needsAttention) {
      return false;
    }

    this._needsAttention = true;
    var counter = 0;
    this._flashButton(counter);
    return true;
  },

  _flashButton: function _flashButton(counter) {
    var _this = this;

    if (!this._needsAttention) {
      return;
    }

    this.actor.add_style_class_name('window-list-item-demands-attention');
    if (counter < 4) {
      setTimeout(function () {
        if (_this.actor.has_style_class_name('window-list-item-demands-attention')) {
          _this.actor.remove_style_class_name('window-list-item-demands-attention');
        }
        setTimeout(function () {
          _this._flashButton(++counter);
        }, FLASH_INTERVAL);
      }, FLASH_INTERVAL);
    }
  },

  _getPreferredWidth: function _getPreferredWidth(actor, forHeight, alloc) {
    var _icon$get_preferred_w = this._icon.get_preferred_width(forHeight),
        _icon$get_preferred_w2 = _slicedToArray(_icon$get_preferred_w, 2),
        iconMinSize = _icon$get_preferred_w2[0],
        iconNaturalSize = _icon$get_preferred_w2[1];

    var _label$get_preferred_ = this._label.get_preferred_width(forHeight),
        _label$get_preferred_2 = _slicedToArray(_label$get_preferred_, 2),
        labelMinSize = _label$get_preferred_2[0],
        labelNaturalSize = _label$get_preferred_2[1];
    // The label text is starts in the center of the icon, so we should allocate the space
    // needed for the icon plus the space needed for(label - icon/2)


    alloc.min_size = iconMinSize;
    if (this._applet.titleDisplay == 3 && !this._parent.isFavapp) {
      alloc.natural_size = MAX_BUTTON_WIDTH;
    } else {
      alloc.natural_size = Math.min(iconNaturalSize + Math.max(0, labelNaturalSize), MAX_BUTTON_WIDTH);
    }
  },

  _getPreferredHeight: function _getPreferredHeight(actor, forWidth, alloc) {
    var _icon$get_preferred_h = this._icon.get_preferred_height(forWidth),
        _icon$get_preferred_h2 = _slicedToArray(_icon$get_preferred_h, 2),
        iconMinSize = _icon$get_preferred_h2[0],
        iconNaturalSize = _icon$get_preferred_h2[1];

    var _label$get_preferred_3 = this._label.get_preferred_height(forWidth),
        _label$get_preferred_4 = _slicedToArray(_label$get_preferred_3, 2),
        labelMinSize = _label$get_preferred_4[0],
        labelNaturalSize = _label$get_preferred_4[1];

    alloc.min_size = Math.min(iconMinSize, labelMinSize);
    alloc.natural_size = Math.max(iconNaturalSize, labelNaturalSize);
  },

  _allocate: function _allocate(actor, box, flags) {
    // returns [x1,x2] so that the area between x1 and x2 is
    // centered in length

    function center(length, naturalLength) {
      var maxLength = Math.min(length, naturalLength);
      var x1 = Math.max(0, Math.floor((length - maxLength) / 2));
      var x2 = Math.min(length, x1 + maxLength);
      return [x1, x2];
    }
    var allocWidth = box.x2 - box.x1;
    var allocHeight = box.y2 - box.y1;
    var childBox = new Clutter.ActorBox();
    var direction = this.actor.get_text_direction();

    // Set the icon to be left-justified (or right-justified) and centered vertically

    var _icon$get_preferred_s = this._icon.get_preferred_size(),
        _icon$get_preferred_s2 = _slicedToArray(_icon$get_preferred_s, 2),
        iconNaturalWidth = _icon$get_preferred_s2[0],
        iconNaturalHeight = _icon$get_preferred_s2[1];

    var _center = center(allocHeight, iconNaturalHeight);

    var _center2 = _slicedToArray(_center, 2);

    childBox.y1 = _center2[0];
    childBox.y2 = _center2[1];

    if (direction == Clutter.TextDirection.LTR) {
      var _ref = [0, Math.min(iconNaturalWidth, allocWidth)];
      childBox.x1 = _ref[0];
      childBox.x2 = _ref[1];
    } else {
      var _ref2 = [Math.max(0, allocWidth - iconNaturalWidth), allocWidth];
      childBox.x1 = _ref2[0];
      childBox.x2 = _ref2[1];
    }
    this._icon.allocate(childBox, flags);

    // Set the label to start its text in the left of the icon
    var iconWidth = childBox.x2 - childBox.x1;

    var _label$get_preferred_5 = this._label.get_preferred_size(),
        _label$get_preferred_6 = _slicedToArray(_label$get_preferred_5, 2),
        naturalWidth = _label$get_preferred_6[0],
        naturalHeight = _label$get_preferred_6[1];

    var _center3 = center(allocHeight, naturalHeight);

    var _center4 = _slicedToArray(_center3, 2);

    childBox.y1 = _center4[0];
    childBox.y2 = _center4[1];

    if (direction == Clutter.TextDirection.LTR) {
      childBox.x1 = iconWidth;
      childBox.x2 = Math.min(allocWidth, MAX_BUTTON_WIDTH);
    } else {
      childBox.x2 = Math.min(allocWidth - iconWidth, MAX_BUTTON_WIDTH);
      childBox.x1 = Math.max(0, childBox.x2 - naturalWidth);
    }
    this._label.allocate(childBox, flags);
    if (direction == Clutter.TextDirection.LTR) {
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
  },
  showLabel: function showLabel(animate, targetWidth) {
    // need to turn width back to preferred.
    var setToZero;
    if (this._label.width < 2) {
      this._label.set_width(-1);
      setToZero = true;
    } else if (this._label.width < this._label.text.length * 7 - 5 || this._label.width > this._label.text.length * 7 + 5) {
      this._label.set_width(-1);
    }
    var naturalWidth = this._label.get_preferred_width(-1);
    var width = Math.min(targetWidth || naturalWidth, 150);
    if (setToZero) {
      this._label.width = 1;
    }
    if (!animate) {
      this._label.width = width;
      return;
    }
    this._label.show();
    Tweener.addTween(this._label, {
      width: width,
      time: BUTTON_BOX_ANIMATION_TIME,
      transition: 'easeOutQuad'
    });
  },

  hideLabel: function hideLabel(animate) {
    if (!animate) {
      this._label.width = 1;
      this._label.hide();
      return;
    }

    Tweener.addTween(this._label, {
      width: 1,
      time: BUTTON_BOX_ANIMATION_TIME,
      transition: 'easeOutQuad',
      onCompleteScope: this,
      onComplete: function onComplete() {
        this._label.hide();
      }
    });
  }
};

// Button with icon and label.  Click events
// need to be attached manually, but automatically
// highlight when a window of app has focus.

function AppButton() {
  this._init.apply(this, arguments);
}

AppButton.prototype = {
  __proto__: IconLabelButton.prototype,

  _init: function _init(parent) {
    this.icon_size = Math.floor(parent._applet._panelHeight - 4);
    this.app = parent.app;
    this.icon = this.app.create_icon_texture(this.icon_size);
    this._applet = parent._applet;
    this._parent = parent;
    this.isFavapp = parent.isFavapp;
    IconLabelButton.prototype._init.call(this, this);

    if (this.isFavapp) {
      this._isFavorite(true);
    }

    this._trackerSignal = this._applet.tracker.connect('notify::focus-app', Lang.bind(this, this._onFocusChange));
    this._updateAttentionGrabber(null, null, this._applet.showAlerts);
    this._applet.settings.connect('changed::show-alerts', Lang.bind(this, this._updateAttentionGrabber));
  },

  _onFocusChange: function _onFocusChange() {
    // If any of the windows associated with our app have focus,
    // we should set ourselves to active
    if (this._hasFocus()) {
      this.actor.add_style_pseudo_class('focus');
      this.actor.remove_style_class_name('window-list-item-demands-attention');
      this.actor.remove_style_class_name('window-list-item-demands-attention-top');
      this._needsAttention = false;
    } else {
      this.actor.remove_style_pseudo_class('focus');
    }
  },

  _setWatchedWorkspaces: function _setWatchedWorkspaces(workspaces) {
    this.metaWorkspaces = workspaces;
  },

  _hasFocus: function _hasFocus() {
    var workspaceIds = [];

    for (var i = 0, len = this.metaWorkspaces.length; i < len; i++) {
      workspaceIds.push(this.metaWorkspaces[i].workspace.index());
    }

    var windows = _.filter(this.app.get_windows(), function (win) {
      return workspaceIds.indexOf(win.get_workspace().index()) >= 0;
    });

    var hasTransient = false;
    var handleTransient = function handleTransient(transient) {
      if (transient.has_focus()) {
        hasTransient = true;
        return false;
      }
      return true;
    };

    for (var _i = 0, _len = windows.length; _i < _len; _i++) {
      if (windows[_i].minimized) {
        continue;
      }
      if (windows[_i].has_focus()) {
        return true;
      }
      windows[_i].foreach_transient(handleTransient);
    }
    return hasTransient;
  },

  _updateAttentionGrabber: function _updateAttentionGrabber(obj, oldVal, newVal) {
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

  _onWindowDemandsAttention: function _onWindowDemandsAttention(display, window) {
    var windows = this.app.get_windows();
    for (var i = 0, len = windows.length; i < len; i++) {
      if (_.isEqual(windows[i], window)) {
        this.getAttention();
        return true;
      }
    }
    return false;
  },

  _isFavorite: function _isFavorite(isFav) {
    this.isFavapp = isFav;
    if (isFav) {
      if (this._applet.orientation === St.Side.LEFT || this._applet.orientation === St.Side.RIGHT) {
        this.setStyle('panel-launcher-vertical');
      } else {
        this.setStyle('panel-launcher');
      }
      this._label.text = '';
    } else {
      this.setStyle('window-list-item-box app-list-item-box');
      if (this._applet.orientation == St.Side.TOP) {
        this.actor.add_style_class_name('window-list-item-box-top');
      } else if (this._applet.orientation == St.Side.BOTTOM) {
        this.actor.add_style_class_name('window-list-item-box-bottom');
      } else if (this._applet.orientation == St.Side.LEFT) {
        this.actor.add_style_class_name('window-list-item-box-left');
      } else if (this._applet.orientation == St.Side.RIGHT) {
        this.actor.add_style_class_name('window-list-item-box-right');
      }
    }
  },

  destroy: function destroy() {
    this._applet.tracker.disconnect(this._trackerSignal);
    this._container.destroy_children();
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

function _Draggable(actor, params) {
  this._init(actor, params);
}

_Draggable.prototype = {
  __proto__: DND._Draggable.prototype,

  _grabActor: function _grabActor() {
    // Clutter.grab_pointer(this.actor);
    this._onEventId = this.actor.connect('event', Lang.bind(this, this._onEvent));
  },
  _onButtonPress: function _onButtonPress(actor, event) {
    if (this.inhibit) {
      return false;
    }

    if (event.get_button() != 2) {
      return false;
    }

    if (Tweener.getTweenCount(actor)) {
      return false;
    }

    this._buttonDown = true;
    this._grabActor();

    var _event$get_coords = event.get_coords(),
        _event$get_coords2 = _slicedToArray(_event$get_coords, 2),
        stageX = _event$get_coords2[0],
        stageY = _event$get_coords2[1];

    this._dragStartX = stageX;
    this._dragStartY = stageY;

    return false;
  }
};

function makeDraggable(actor, params) {
  return new _Draggable(actor, params);
}