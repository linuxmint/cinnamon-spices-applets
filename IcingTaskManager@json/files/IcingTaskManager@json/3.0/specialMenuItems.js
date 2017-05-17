'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

/* jshint moz:true */
var Cinnamon = imports.gi.Cinnamon;
var Lang = imports.lang;
var PopupMenu = imports.ui.popupMenu;
var St = imports.gi.St;
var Gio = imports.gi.Gio;
var Clutter = imports.gi.Clutter;
var Tweener = imports.ui.tweener;
var Tooltips = imports.ui.tooltips;
var Params = imports.misc.params;
var clog = imports.applet.clog;

function RecentMenuItem(menu, item, pinIcon) {
  this._init(menu, item, pinIcon);
}

RecentMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function _init(menu, item, pinIcon) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

    this._menu = menu;
    this._item = item;
    this.uri = this._item.get_uri();
    this.table = new St.Table({
      homogeneous: false,
      reactive: true
    });

    this.label = new St.Label({
      text: item.get_short_name()
    });
    this.label.width = this._menu.AppMenuWidth - 26;
    this.table.width = this._menu.AppMenuWidth;

    this.bin = new St.Bin({
      reactive: true,
      can_focus: true,
      x_fill: true,
      y_fill: false,
      track_hover: true
    });
    this.pinIcon = new St.BoxLayout({
      style_class: 'pin-item',
      reactive: true
    });
    this.bin.set_child(this.pinIcon);

    this.bin.connect('enter-event', Lang.bind(this, function () {
      this.pinRecent = true;
    }));
    this.bin.connect('leave-event', Lang.bind(this, function () {
      this.pinRecent = false;
    }));

    this.icon = this._item.get_gicon();

    if (this.icon) {
      this._icon = new St.Icon({
        gicon: this.icon,
        style_class: 'popup-menu-icon',
        icon_size: 16
      });

      this.table.add(this._icon, {
        row: 0,
        col: 0,
        col_span: 1,
        x_expand: false,
        x_align: St.Align.START
      });
    }

    this.table.add(this.label, {
      row: 0,
      col: 1,
      col_span: 1,
      x_align: St.Align.START
    });

    this.table.add(this.bin, {
      row: 0,
      col: 2,
      col_span: 1,
      x_align: St.Align.END
    });

    this.label.set_margin_left(6.0);

    this.addActor(this.table, {
      expand: true,
      span: 2,
      align: St.Align.START
    });
  },

  activate: function activate(event, keepMenu) {
    if (this.pinRecent) {
      var stored = this._menu._applet.pinnedRecent;
      var appName = this._menu.app.get_name();
      if (stored[appName]) {
        stored[appName].infos[this.uri] = {
          uri: this.uri
        };
      } else {
        stored[appName] = {
          infos: {}
        };
        stored[appName].infos[this.uri] = {
          uri: this.uri
        };
      }
      this._menu._applet.pinnedRecent = stored;
      //this._menu.toggle();
      return;
    }
    this._menu.toggle();
    Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
  }
};

function PlaceMenuItem(menu, place) {
  this._init(menu, place);
}

PlaceMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,
  _init: function _init(menu, place) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

    this._menu = menu;
    this.place = place;
    this.table = new St.Table({
      homogeneous: false,
      reactive: true
    });

    this.label = new St.Label({
      text: place.name
    });
    this.label.width = this._menu.AppMenuWidth - 26;
    this.table.width = this._menu.AppMenuWidth;

    this.icon = place.iconFactory(16);
    if (!this.icon) {
      this.icon = new St.Icon({
        icon_name: "folder",
        icon_size: 16,
        icon_type: St.IconType.FULLCOLOR
      });
    }
    if (this.icon) {
      this.table.add(this.icon, {
        row: 0,
        col: 0,
        col_span: 1,
        x_expand: false,
        x_align: St.Align.START
      });
    }

    this.table.add(this.label, {
      row: 0,
      col: 1,
      col_span: 1,
      x_align: St.Align.START
    });

    this.label.set_margin_left(6.0);

    this.addActor(this.table, {
      expand: true,
      span: 2,
      align: St.Align.START
    });
  },

  activate: function activate(event, keepMenu) {
    this._menu.toggle();
    this.place.launch();
  }

};

function IconMenuItem(menu, text, icon) {
  this._init(menu, text, icon);
}

IconMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function _init(menu, text, icon) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

    this.table = new St.Table({
      homogeneous: false,
      reactive: true
    });

    this.label = new St.Label();
    this.label.text = text;
    this.label.width = menu.AppMenuWidth - 26;
    this.table.width = menu.AppMenuWidth;

    this.table.add(icon, {
      row: 0,
      col: 0,
      col_span: 1,
      x_expand: false,
      x_align: St.Align.START
    });

    this.table.add(this.label, {
      row: 0,
      col: 1,
      col_span: 1,
      x_align: St.Align.START
    });

    this.label.set_margin_left(6.0);

    this.addActor(this.table, {
      expand: true,
      span: 2,
      align: St.Align.START
    });
  }
};

function FirefoxMenuItem(menu, info) {
  this._init(menu, info);
}

FirefoxMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function _init(menu, info) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

    this._menu = menu;
    this.uri = info.uri;
    this.title = info.title;
    this.table = new St.Table({
      homogeneous: false,
      reactive: true
    });

    this.label = new St.Label({
      text: info.title
    });
    var tooltip = new Tooltips.Tooltip(this.actor, info.title);
    this.label.width = this._menu.AppMenuWidth - 26;
    this.table.width = this._menu.AppMenuWidth;

    var bin = new St.Bin({
      reactive: true,
      can_focus: true,
      x_fill: true,
      y_fill: false,
      track_hover: true
    });
    this.pinIcon = new St.BoxLayout({
      style_class: 'pin-item',
      reactive: true
    });
    bin.set_child(this.pinIcon);

    bin.connect('enter-event', Lang.bind(this, function () {
      this.pinRecent = true;
    }));
    bin.connect('leave-event', Lang.bind(this, function () {
      this.pinRecent = false;
    }));

    this.icon = new St.Icon({
      icon_name: "window-new",
      icon_size: 16,
      icon_type: St.IconType.FULLCOLOR
    });
    if (this.icon) {
      this.table.add(this.icon, {
        row: 0,
        col: 0,
        col_span: 1,
        x_expand: false,
        x_align: St.Align.START
      });
    }

    this.table.add(this.label, {
      row: 0,
      col: 1,
      col_span: 1,
      x_align: St.Align.START
    });

    this.table.add(bin, {
      row: 0,
      col: 2,
      col_span: 1,
      x_align: St.Align.END
    });

    this.label.set_margin_left(6.0);

    this.addActor(this.table, {
      expand: true,
      span: 2,
      align: St.Align.START
    });
  },

  activate: function activate(event, keepMenu) {
    if (this.pinRecent) {
      var stored = this._menu._applet.pinnedRecent;
      var appName = this._menu.app.get_name();
      if (stored[appName]) {
        stored[appName].infos[this.uri] = {
          uri: this.uri,
          title: this.title
        };
      } else {
        stored[appName] = {
          infos: {}
        };
        stored[appName].infos[this.uri] = {
          uri: this.uri,
          title: this.title
        };
      }
      this._menu._applet.pinnedRecent = stored;
      //this._menu.toggle();
      return;
    }
    this._menu.toggle();
    Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
  }

};

function IconNameMenuItem(menu, text, icon, iconType) {
  this._init(menu, text, icon, iconType);
}

IconNameMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function _init(menu, text, icon, iconType) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

    this.table = new St.Table({
      homogeneous: false,
      reactive: true
    });

    this.label = new St.Label({
      text: text
    });
    this.label.width = menu.AppMenuWidth - 26;
    this.table.width = menu.AppMenuWidth;

    if (icon) {
      this.icon = new St.Icon({
        icon_name: icon,
        icon_size: 16,
        icon_type: iconType || St.IconType.FULLCOLOR
      });
      this.table.add(this.icon, {
        row: 0,
        col: 0,
        col_span: 1,
        x_expand: false,
        x_align: St.Align.START
      });
      this.label.set_margin_left(6.0);
    }

    this.table.add(this.label, {
      row: 0,
      col: 1,
      col_span: 1,
      x_align: St.Align.START
    });

    this.addActor(this.table, {
      expand: true,
      span: 2,
      align: St.Align.START
    });
  }
};

function SwitchMenuItem(menu, text, active) {
  this._init(menu, text, active);
}

SwitchMenuItem.prototype = {
  __proto__: PopupMenu.PopupSwitchMenuItem.prototype,

  _init: function _init(menu, text, active) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

    this.label = new St.Label({
      text: text
    });
    this._switch = new PopupMenu.Switch(active);

    this.table = new St.Table({
      homogeneous: false,
      reactive: true
    });
    this.table.width = menu.AppMenuWidth - 14;

    this.label = new St.Label({
      text: text
    });
    this.label.width = menu.AppMenuWidth - 74;

    this.table.add(this.label, {
      row: 0,
      col: 0,
      col_span: 1,
      x_align: St.Align.END
    });

    this._statusBin = new St.Bin({
      x_align: St.Align.END
    });
    this.table.add(this._statusBin, {
      row: 0,
      col: 1,
      col_span: 1,
      x_expand: false,
      x_align: St.Align.END
    });

    this._statusLabel = new St.Label({
      text: '',
      style_class: 'popup-inactive-menu-item'
    });
    this._statusBin.child = this._switch.actor;
    this.addActor(this.table, {
      expand: false,
      span: 2,
      align: St.Align.END
    });
  }
};

function SubMenuItem(menu, text) {
  this._init(menu, text);
}

SubMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function _init(menu, text) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});
    var arrow = new St.Icon({
      icon_name: 'go-next',
      style_class: 'popup-menu-icon',
      icon_size: 16
    });
    var icon = new St.Icon({
      icon_name: "preferences-system",
      style_class: 'popup-menu-icon',
      icon_size: 16
    });
    icon.style = 'padding-right: 5px;';
    this.table = new St.Table({
      homogeneous: false,
      reactive: true
    });
    this.table.width = menu.AppMenuWidth;

    this.label = new St.Label({
      text: text
    });
    this.label.width = menu.AppMenuWidth - 26;
    this.menu = new SubMenu(this.actor, arrow);
    //this.menu.actor.set_style_class_name('menu-context-menu');


    this.table.add(icon, {
      row: 0,
      col: 0,
      col_span: 1,
      x_expand: false,
      x_align: St.Align.START
    });

    this.table.add(this.label, {
      row: 0,
      col: 1,
      col_span: 1,
      x_expand: true,
      x_align: St.Align.START
    });

    this.table.add(arrow, {
      row: 0,
      col: 2,
      col_span: 1,
      x_expand: false,
      x_align: St.Align.END
    });

    this.addActor(this.table, {
      expand: false,
      span: 2,
      align: St.Align.START
    });
  },

  activate: function activate() {
    this.menu.toggle();
  },

  destroy: function destroy() {
    this.actor.destroy();
    //this.emit('destroy');
    this.menu.destroy();
  },

  _onButtonReleaseEvent: function _onButtonReleaseEvent(actor, event) {
    if (event.get_button() == 1 | 2) {
      this.activate();
    }
    return true;
  }
};

function SubMenu() {
  this._init.apply(this, arguments);
}

SubMenu.prototype = {
  __proto__: PopupMenu.PopupSubMenu.prototype,

  open: function open(animate) {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;

    this.actor.show();

    this.actor._arrow_rotation = this._arrow.rotation_angle_z;
    this._arrow.set_icon_name('go-up');

    if (animate) {
      var _actor$get_preferred_ = this.actor.get_preferred_height(-1),
          _actor$get_preferred_2 = _slicedToArray(_actor$get_preferred_, 2),
          minHeight = _actor$get_preferred_2[0],
          naturalHeight = _actor$get_preferred_2[1];

      this.actor.height = 0;
      Tweener.addTween(this.actor, {
        _arrow_rotation: 0,
        height: naturalHeight,
        time: 0.25,
        onUpdateScope: this,
        onUpdate: function onUpdate() {
          this._arrow.rotation_angle_z = this.actor._arrow_rotation;
        },
        onCompleteScope: this,
        onComplete: function onComplete() {
          this.actor.set_height(-1);
          this.emit('open-state-changed', true);
        }
      });
    } else {
      this.emit('open-state-changed', true);
    }
  },

  close: function close(animate) {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;

    this.actor._arrow_rotation = this._arrow.rotation_angle_z;
    this._arrow.set_icon_name('go-next');

    if (animate) {
      Tweener.addTween(this.actor, {
        _arrow_rotation: 0,
        height: 0,
        time: 0.25,
        onCompleteScope: this,
        onComplete: function onComplete() {
          this.actor.hide();
          this.actor.set_height(-1);
          this.emit('open-state-changed', false);
        },
        onUpdateScope: this,
        onUpdate: function onUpdate() {
          this._arrow.rotation_angle_z = this.actor._arrow_rotation;
        }
      });
    } else {
      this.actor.hide();

      this.isOpen = false;
      this.emit('open-state-changed', false);
    }
  }

};

function SubSection() {
  this._init.apply(this, arguments);
}

SubSection.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,
  _init: function _init() {
    this.actor = new Cinnamon.GenericContainer({
      reactive: false,
      track_hover: false,
      can_focus: false
    });
    this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
    this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
    this.actor.connect('allocate', Lang.bind(this, this._allocate));
    this.actor._delegate = this;

    this._children = [];
    this._dot = null;
    this._columnWidths = null;
    this._spacing = 0;
    this.active = false;
    this._activatable = false;
    this.sensitive = true;
    this.focusOnHover = true;
    this.actor.connect('notify::hover', Lang.bind(this, this._onHoverChanged));
  },

  _onHoverChanged: function _onHoverChanged(actor) {
    this.setActive(actor.hover);
  },

  setActive: function setActive(active) {
    this.active = active;
    if (active) {
      this.actor.add_style_pseudo_class('active');
      if (this.focusOnHover) this.actor.grab_key_focus();
    } else {
      this.actor.remove_style_pseudo_class('active');
    }
  },

  addActor: function addActor(child, params) {
    params = Params.parse(params, {
      span: -1,
      expand: false,
      align: St.Align.START
    });
    params.actor = child;
    this._children.push(params);
    this.actor.connect('destroy', Lang.bind(this, function () {
      this._removeChild(child);
    }));
    this.actor.add_actor(child);
  },

  _removeChild: function _removeChild(child) {
    for (var i = 0, len = this._children.length; i < len; i++) {
      if (this._children[i].actor == child) {
        this._children.splice(i, 1);
        return;
      }
    }
  },

  removeActor: function removeActor(child) {
    this.actor.remove_actor(child);
    this._removeChild(child);
  },

  getColumnWidths: function getColumnWidths() {
    return 0;
  },

  _getPreferredWidth: function _getPreferredWidth(actor, forHeight, alloc) {
    var width = 0,
        minHeiht = void 0,
        childHeight = void 0;
    for (var i = 0, len = this._children.length; i < len; i++) {
      var child = this._children[i];

      var _child$actor$get_pref = child.actor.get_preferred_height(-1),
          _child$actor$get_pref2 = _slicedToArray(_child$actor$get_pref, 2),
          _minHeiht = _child$actor$get_pref2[0],
          _childHeight = _child$actor$get_pref2[1];

      var _child$actor$get_pref3 = child.actor.get_preferred_width(_childHeight),
          _child$actor$get_pref4 = _slicedToArray(_child$actor$get_pref3, 2),
          min = _child$actor$get_pref4[0],
          natural = _child$actor$get_pref4[1];

      if (natural > width) {
        width = natural;
      }
    }
    alloc.min_size = alloc.natural_size = width;
  },

  _getPreferredHeight: function _getPreferredHeight(actor, forWidth, alloc) {
    var height = 0,
        minWidth = void 0,
        childWidth = void 0;
    for (var i = 0, len = this._children.length; i < len; i++) {
      var child = this._children[i];

      var _child$actor$get_pref5 = child.actor.get_preferred_width(-1);

      var _child$actor$get_pref6 = _slicedToArray(_child$actor$get_pref5, 2);

      minWidth = _child$actor$get_pref6[0];
      childWidth = _child$actor$get_pref6[1];

      var _child$actor$get_pref7 = child.actor.get_preferred_height(childWidth),
          _child$actor$get_pref8 = _slicedToArray(_child$actor$get_pref7, 2),
          min = _child$actor$get_pref8[0],
          natural = _child$actor$get_pref8[1];

      if (natural > height) {
        height = natural;
      }
    }
    alloc.min_size = alloc.natural_size = height;
  },

  _allocate: function _allocate(actor, box, flags) {
    var height = box.y2 - box.y1;
    var direction = this.actor.get_direction();

    var x = void 0;
    if (direction == St.TextDirection.LTR) {
      x = box.x1;
    } else {
      x = box.x2;
    }
    // if direction is ltr, x is the right edge of the last added
    // actor, and it's constantly increasing, whereas if rtl, x is
    // the left edge and it decreases
    for (var i = 0, len = this._children.length; i < len; i++) {
      var child = this._children[i];
      var childBox = new Clutter.ActorBox();

      var _child$actor$get_pref9 = child.actor.get_preferred_width(-1),
          _child$actor$get_pref10 = _slicedToArray(_child$actor$get_pref9, 2),
          minWidth = _child$actor$get_pref10[0],
          naturalWidth = _child$actor$get_pref10[1];

      var availWidth = void 0;
      if (direction == St.TextDirection.LTR) {
        availWidth = box.x2 - x;
      } else {
        availWidth = x - box.x1;
      }

      if (direction == St.TextDirection.LTR) {
        childBox.x1 = x;
        childBox.x2 = x + availWidth;
      } else {
        // align to the right
        childBox.x2 = x;
        childBox.x1 = x - availWidth;
      }

      var _child$actor$get_pref11 = child.actor.get_preferred_height(childBox.x2 - childBox.x1),
          _child$actor$get_pref12 = _slicedToArray(_child$actor$get_pref11, 2),
          minHeight = _child$actor$get_pref12[0],
          naturalHeight = _child$actor$get_pref12[1];

      childBox.y1 = Math.round(box.y1 + (height - naturalHeight) / 2);
      childBox.y2 = childBox.y1 + naturalHeight;

      child.actor.allocate(childBox, flags);
    }
  }
};