const Cairo = imports.cairo;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const St = imports.gi.St;
const Atk = imports.gi.Atk;
const Gio = imports.gi.Gio;

const BoxPointer = imports.ui.boxpointer;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const SignalManager = imports.misc.signalManager;
const Tweener = imports.ui.tweener;
const CheckBox = imports.ui.checkBox;
const RadioButton = imports.ui.radioButton;

const Util = imports.misc.util;

const PopupMenu = imports.ui.popupMenu;

/** @exports Utils.LOG */
function LOG(msg, ...data) {
  if (global.DEBUG == false) return;

  let str = `\n${msg}: `;

  if (data.length > 0) {
    let tmp = [];
    data.forEach((value) => {
      tmp.push(formatLogArgument(value));
    });
    str += tmp.join(", ");
    // str += formatLogArgument(data);
  } else {
    str = JSON.stringify(msg, null, 4);
  }

  // global.logWarning(str);

  global.logWarning(str);

  function formatLogArgument(arg = "", recursion = 0, depth = 4) {
    const GObject = imports.gi.GObject;
    // Make sure falsey values are clearly indicated.
    if (arg === null) {
      arg = "null";
    } else if (arg === undefined) {
      arg = "undefined";
      // Ensure strings are distinguishable.
    } else if (typeof arg === "string" && recursion > 0) {
      arg = "'" + arg + "'";
    }
    // Check if we reached the depth threshold
    if (recursion + 1 > depth) {
      try {
        arg = JSON.stringify(arg);
      } catch (e) {
        arg = arg.toString();
      }
      return arg;
    }
    let isGObject = arg instanceof GObject.Object;
    let space = "";
    for (let i = 0; i < recursion + 1; i++) {
      space += "    ";
    }
    if (typeof arg === "object") {
      let isArray = Array.isArray(arg);
      let brackets = isArray ? ["[", "]"] : ["{", "}"];
      if (isGObject) {
        arg = Util.getGObjectPropertyValues(arg);
        if (Object.keys(arg).length === 0) {
          return arg.toString();
        }
      }
      let array = isArray ? arg : Object.keys(arg);
      // Add beginning bracket with indentation
      let string = brackets[0] + (recursion + 1 > depth ? "" : "\n");
      for (let j = 0, len = array.length; j < len; j++) {
        if (isArray) {
          string +=
            space + formatLogArgument(arg[j], recursion + 1, depth) + ",\n";
        } else {
          string +=
            space +
            array[j] +
            ": " +
            formatLogArgument(arg[array[j]], recursion + 1, depth) +
            ",\n";
        }
      }
      // Remove one level of indentation and add the closing bracket.
      space = space.substr(4, space.length);
      arg = string + space + brackets[1];
      // Functions, numbers, etc.
    } else if (typeof arg === "function") {
      let array = arg.toString().split("\n");
      for (let i = 0; i < array.length; i++) {
        if (i === 0) continue;
        array[i] = space + array[i];
      }
      arg = array.join("\n");
    } else if (typeof arg !== "string" || isGObject) {
      arg = arg.toString();
    }
    return arg;
  }
}

/** @exports Utils.Icon */
class Icon {
  static get FULLCOLOR() {
    return St.IconType.FULLCOLOR;
  }

  static get SYMBOLIC() {
    return St.IconType.SYMBOLIC;
  }

  constructor({
    style_class = null,
    icon_name = null,
    icon_path = null,
    icon_size = 32,
    icon_type = null,
    reactive = false,
    activate = false,
    hover = true,
    can_focus = true,
    focusOnHover = true,
  } = {}) {
    this._stIcon = new St.Icon({
      style_class,
      icon_name,
      icon_type,
      icon_size,
      reactive,
      hover,
      can_focus,
      track_hover: true,
    });

    this.active = false;
    this.focusOnHover = focusOnHover;

    if (icon_path != null) this.iconPath = icon_path;

    if (activate) {
      this._stIcon.connect("button-release-event", (actor, event) => {
        let button = event.get_button();
        if (button == 1) this.activate(event, false);
        if (button == 3) this.emit("right-click", event, false);
      });
    }

    if (reactive && hover) {
      this._stIcon.connect("notify::hover", (actor) => {
        this.setActive(actor.hover);
      });
    }
    if (reactive) {
      this._stIcon.connect("key-focus-in", (actor) => {
        this.setActive(true);
      });
      this._stIcon.connect("key-focus-out", (actor) => {
        this.setActive(false);
      });
    }
  }

  set iconPath(icon_path) {
    try {
      let file = Gio.file_new_for_path(icon_path);
      let ficon = new Gio.FileIcon({ file: file });
      this._stIcon.set_gicon(ficon);
    } catch (e) {
      global.log(e);
    }
  }

  get iconName() {
    return this._stIcon.get_icon_name();
  }

  set iconName(name) {
    this._stIcon.set_icon_name(name);
  }

  get iconSize() {
    return this._stIcon.get_icon_size();
  }

  set iconSize(size) {
    this._stIcon.set_icon_size(size);
  }

  /** @returns {Gio.Icon} */
  get stIcon() {
    return this._stIcon;
  }

  /** @returns {Gio.Icon} */
  get actor() {
    return this._stIcon;
  }

  /** @param {Icon.FULLCOLOR|Icon.SYMBOLIC}  type */
  setIconType(type) {
    this._stIcon.set_icon_type(type);
  }

  set_style(style) {
    this._stIcon.set_style(style);
  }

  add_style_class_name(class_name) {
    this._stIcon.add_style_class_name(class_name);
  }

  // Events

  setActive(active) {
    if (active != this.active) {
      this.active = active;
      this._stIcon.change_style_pseudo_class("active", active);
      if (this.focusOnHover && this.active) this._stIcon.grab_key_focus();
      this.emit("active-changed", active);
    }
  }

  activate(event, keepMenu) {
    this.emit("activate", event, keepMenu);
  }
}

Signals.addSignalMethods(Icon.prototype);

/** @exports Utils.PopupItem */
class PopupItem extends PopupMenu.PopupBaseMenuItem {
  constructor({
    reactive = true,
    activate = false,
    sensitive = true,
    hover = true,
    focusOnHover = true,
    style_class = null,
    replace_class = false,
  } = {}) {
    super({ reactive, activate, sensitive, hover, focusOnHover, style_class });

    if (style_class && replace_class) this.actor.style_class = style_class;
  }
}

/** @exports Utils.PopupLabel */
class PopupLabel extends PopupItem {
  constructor({ label = "" }) {
    super({ reactive: false });

    this._label = new St.Label({ text: label });
    this.addActor(this._label, { span: 0, expand: false });
  }

  setLabel(text = "") {
    this._label.set_text(text);
  }
}

/** @exports Utils.PopupSwitch */
class PopupSwitch extends PopupItem {
  constructor({ label = "", active = false, reactive = true } = {}) {
    super({ reactive: reactive, activate: true });

    this.label = new St.Label({ text: label });
    this._statusLabel = new St.Label({
      text: "",
    });

    this._switch = new PopupMenu.Switch(active);

    this.addActor(this.label, { span: 0, expand: false });
    this.addActor(this._statusLabel, { span: 0, expand: false });

    this._statusBin = new St.Bin();
    this.addActor(this._statusBin, {
      span: -1,
      expand: false,
      align: St.Align.END,
    });
    this._statusBin.child = this._switch.actor;
  }

  setStatus(text) {
    if (text != null) {
      this._statusLabel.set_text(text);
    } else {
      this._statusLabel.set_text("");
    }
  }

  activate(event) {
    if (this._switch.actor.mapped) {
      this.toggle();
    }

    this.emit("activate", event, true);
  }

  toggle() {
    this._switch.toggle();
    this.emit("toggled", this._switch.state);
  }

  get state() {
    return this._switch.state;
  }

  setToggleState(state) {
    this._switch.setToggleState(state);
  }
}

/** @exports Utils.PopupHeader */
class PopupHeader extends PopupItem {
  constructor({ title = "" }) {
    super({ reactive: false });

    this.title = new St.Label({ text: title });
    this.addActor(this.title, { span: 0, expand: false });
    this.title.set_style("font-size:130%;font-weight:bold");

    this.button = new PopupItem({
      replace_class: true,
      reactive: true,
      activate: true,
      hover: true,
    });
    this.addActor(this.button.actor, {
      span: -1,
      expand: false,
      align: St.Align.END,
    });
  }

  setTitle(text = "") {
    this.title.set_text(text);
  }

  setButton(item) {
    this.button.addActor(item.actor, { span: 0, expand: false });
  }
}
