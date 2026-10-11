"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/applet.ts
var applet_exports = {};
__export(applet_exports, {
  main: () => main
});
module.exports = __toCommonJS(applet_exports);

// src/timeout.ts
var {
  gi: { GLib }
} = imports;
function timeout_add_once(interval, callback) {
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
    callback();
    return GLib.SOURCE_REMOVE;
  });
}
function timeout_add_seconds_once(interval, callback) {
  return GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
    callback();
    return GLib.SOURCE_REMOVE;
  });
}

// src/gio_async.ts
var {
  gi: { Gio }
} = imports;
function settle(resolve, reject, finish) {
  try {
    resolve(finish());
  } catch (error) {
    reject(error);
  }
}
function matches_io_error(error, code) {
  const glib_error = error;
  return typeof glib_error.matches === "function" && glib_error.matches(Gio.IOErrorEnum, code);
}
function load_contents_async(file) {
  return new Promise((resolve, reject) => {
    file.load_contents_async(null, (_source, result) => {
      settle(resolve, reject, () => file.load_contents_finish(result)[1]);
    });
  });
}
async function query_exists_async(file) {
  try {
    await load_contents_async(file);
    return true;
  } catch (error) {
    if (matches_io_error(error, Gio.IOErrorEnum.NOT_FOUND)) {
      return false;
    }
    throw error;
  }
}

// src/icon_config.ts
var {
  gi: {
    St,
    Gtk,
    Gio: Gio2,
    GdkPixbuf: { Pixbuf },
    GLib: GLib2
  },
  ui: {
    popupMenu: { PopupSwitchMenuItem, PopupSwitchIconMenuItem }
  }
} = imports;
var ICON_SWITCH_STORE_DURATION = 7 * 24 * 60 * 60 * 1e3;
function common_prefix(current, next) {
  let length = 0;
  while (length < current.length && length < next.length && current[length] === next[length]) {
    length++;
  }
  return length === 0 ? next : current.slice(0, length).trim();
}
async function hash_icon(file, checksumType = GLib2.ChecksumType.SHA256) {
  return GLib2.compute_checksum_for_bytes(
    checksumType,
    GLib2.Bytes.new(await load_contents_async(file))
  );
}
var IconConfig = class _IconConfig {
  icons;
  icons_dir;
  persist;
  constructor(metadata_path, initial_value, persist) {
    this.icons = initial_value ?? {};
    this.persist = persist;
    Gtk.IconTheme.get_default().append_search_path(metadata_path);
    this.icons_dir = Gio2.File.new_for_path(metadata_path + "/icons");
    try {
      this.icons_dir.make_directory_with_parents(null);
    } catch (error) {
      if (!matches_io_error(error, Gio2.IOErrorEnum.EXISTS)) {
        throw error;
      }
    }
    Gtk.IconTheme.get_default().append_search_path(this.icons_dir.get_path());
  }
  async ensure_local_icon(icon_name) {
    if (!icon_name.includes("/") || !icon_name.includes(".")) {
      return icon_name;
    }
    try {
      const source_file = Gio2.File.new_for_path(icon_name);
      const dest_name = await hash_icon(source_file) + ".png";
      const dest_file = this.icons_dir.get_child(dest_name);
      const file_extension = icon_name.split(".").at(-1);
      if (!await query_exists_async(dest_file)) {
        if (file_extension !== "png") {
          const pixbuf = Pixbuf.new_from_file(icon_name);
          pixbuf?.savev(dest_file.get_path(), "png", null, null);
        } else {
          source_file.copy(dest_file, Gio2.FileCopyFlags.NONE, null, null);
        }
      }
      return dest_name.replace(/\.[^.]+$/u, "");
    } catch (error) {
      global.logError(error);
      return void 0;
    }
  }
  // `name` is excluded from the key when an icon is available, since
  // some apps embed volatile data (e.g. progress) in their icon name.
  static get_icon_key({ owner_uuid, name, icon_name }) {
    return owner_uuid + (icon_name ?? name);
  }
  async extract_icon_infos(child) {
    const applet = child._applet;
    if (applet._uuid === "xapp-status@cinnamon.org") {
      const ensured_icon_names = Object.fromEntries(
        await Promise.all(
          Object.values(applet.statusIcons).map(
            async ({ iconName: icon_name }) => [
              icon_name,
              await this.ensure_local_icon(icon_name)
            ]
          )
        )
      );
      return Object.values(applet.statusIcons).map((icon2) => {
        const { name: name2, icon_name, visible } = icon2.proxy;
        if (name2.trim() === "" || icon_name.trim() === "") {
          return void 0;
        }
        return {
          owner_uuid: applet._uuid,
          name: name2.startsWith(":") ? "<no name>" : name2,
          icon_name: ensured_icon_names[icon_name],
          visible,
          hideable_object: icon2.actor
        };
      }).filter((icon2) => icon2 !== void 0);
    } else if (applet._uuid === "systray@cinnamon.org") {
      return child.get_first_child().get_children().map((systray_icon) => {
        const { title, visible } = systray_icon.get_child();
        return {
          owner_uuid: applet._uuid,
          name: title,
          visible,
          hideable_object: systray_icon
        };
      });
    }
    const { uuid, name, icon } = applet._meta;
    return [
      {
        owner_uuid: uuid,
        name,
        icon_name: icon,
        visible: child.visible,
        hideable_object: child
      }
    ];
  }
  // Collects/refreshes the icon state from the given panel zone children,
  // prunes stale entries, keeps xapp-status icons at the bottom and persists.
  async update(eligible_children) {
    await Promise.all(
      eligible_children.map(async (child) => {
        (await this.extract_icon_infos(child)).forEach((icon_info) => {
          const { owner_uuid, name, icon_name } = icon_info;
          const key = _IconConfig.get_icon_key(icon_info);
          const icon = this.icons[key];
          if (icon) {
            icon.name = common_prefix(icon.name, name);
            icon.last_seen = Date.now();
          } else {
            this.icons[key] = {
              owner_uuid,
              name,
              last_seen: Date.now(),
              show: true,
              icon_name
            };
          }
        });
      })
    );
    Object.entries(this.icons).forEach(([key, icon]) => {
      if (Date.now() - icon.last_seen > ICON_SWITCH_STORE_DURATION) {
        delete this.icons[key];
      }
    });
    this.persist(this.icons);
  }
  // Rebuilds the icon list from scratch while preserving each icon's `show` state.
  async reset(eligible_children) {
    const iconsBackup = JSON.parse(
      JSON.stringify(this.icons)
    );
    this.icons = {};
    await this.update(eligible_children);
    Object.entries(iconsBackup).forEach(([key, { show }]) => {
      if (this.icons[key]) {
        this.icons[key].show = show;
      }
    });
  }
  // Builds a switch menu item for each stored icon.
  create_menu_items(on_toggle) {
    return Object.values(this.icons).map((icon) => {
      const { name, show, icon_name } = icon;
      const iconToggle = icon_name ? new PopupSwitchIconMenuItem(
        name,
        show,
        icon_name,
        icon_name.includes("/") ? St.IconType.FULLCOLOR : St.IconType.SYMBOLIC
      ) : new PopupSwitchMenuItem(name, show);
      iconToggle.connect("toggled", () => {
        icon.show = !icon.show;
        this.persist(this.icons);
        on_toggle();
      });
      return iconToggle;
    });
  }
};

// src/applet.ts
var {
  gettext,
  gi: { St: St2, GLib: GLib3 },
  ui: {
    applet: { IconApplet },
    popupMenu: {
      PopupMenuSection,
      PopupSeparatorMenuItem,
      PopupMenuItem,
      PopupSwitchMenuItem: PopupSwitchMenuItem2
    },
    settings: { AppletSettings }
  }
} = imports;
var UUID = "show-hide-applets@mohammad-sn";
gettext.bindtextdomain(UUID, GLib3.get_user_data_dir() + "/locale");
function _(str) {
  return gettext.dgettext(UUID, str);
}
var MyApplet = class extends IconApplet {
  // Settings-bound properties
  do_autohide;
  hover_activates;
  hover_activates_hide;
  hide_time;
  hover_time;
  autohideReshowing;
  hide_until_separator;
  // Runtime state
  do_hide;
  hidden_by_us;
  last_toggle_hiding_end;
  last_toggle_hiding_start;
  loaded_panel;
  icon_config;
  orientation;
  settings;
  // Menu items
  menu_item_auto_hide;
  menu_item_panel_edit_mode;
  menu_items_icon_section;
  // Connected signals
  connected_on_panel_edit_mode_changed;
  connected_on_entered;
  connected_on_allocation_changed;
  connected_on_queue_relayout;
  // Timeout IDs
  hide_timeout_id = null;
  reshowing_hide_timeout_id = null;
  update_icons_timeout_id = null;
  update_popup_menu_timeout_id = null;
  queue_relayout_timeout_id = null;
  constructor(metadata, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
    this.orientation = orientation;
    this.hide_timeout_id = null;
    this.reshowing_hide_timeout_id = null;
    this.update_icons_timeout_id = null;
    this.last_toggle_hiding_start = 0;
    this.last_toggle_hiding_end = 0;
    this.do_hide = true;
    this.hidden_by_us = /* @__PURE__ */ new Set();
    try {
      this.bind_settings();
      this.icon_config = new IconConfig(
        metadata.path,
        this.settings.getValue("icons"),
        (icons) => this.settings.setValue("icons", icons)
      );
      this.loaded_panel = this.panel;
      this.update_our_icon();
      this.update_autohide_tooltip();
      this.connected_on_panel_edit_mode_changed = global.settings.connect(
        "changed::panel-edit-mode",
        () => this.on_panel_edit_mode_changed()
      );
      this.connected_on_entered = this.actor.connect(
        // "enter-event" works but I can't find it in the cinnamon repo: https://github.com/search?q=repo%3Alinuxmint%2Fcinnamon%20enter-event&type=code
        // @ts-expect-error types are wrong
        "enter-event",
        () => this.on_entered()
      );
      void this.refresh_icons();
      this.connected_on_allocation_changed = this.get_our_panel_zone().connect(
        "allocation-changed",
        () => {
          this.on_applets_changed();
        }
      );
      this.connected_on_queue_relayout = this.get_our_panel_zone().connect(
        "queue-relayout",
        () => {
          if (this.queue_relayout_timeout_id) {
            GLib3.source_remove(this.queue_relayout_timeout_id);
          }
          this.queue_relayout_timeout_id = timeout_add_once(200, () => {
            this.queue_relayout_timeout_id = null;
            this.on_applets_changed();
          });
        }
      );
      if (this.do_autohide) {
        this.hide_timeout_id = timeout_add_seconds_once(this.hide_time, () => {
          this.hide_timeout_id = null;
          this.auto_hide();
        });
      }
    } catch (error) {
      global.logError(error);
    }
  }
  auto_hide() {
    if (this.hide_timeout_id || !this.do_autohide) {
      return;
    }
    let postpone = this.actor.hover;
    const children = this.get_zone_children();
    const p = children.indexOf(this.actor);
    for (let i = 0; i < p && !postpone; i++) {
      postpone ||= children[i].hover;
      if (children[i]._applet._menuManager) {
        postpone ||= children[i]._applet._menuManager._activeMenu;
      } else if (children[i]._applet.menuManager) {
        postpone ||= children[i]._applet.menuManager._activeMenu;
      }
    }
    if (postpone) {
      this.hide_timeout_id = timeout_add_seconds_once(this.hide_time, () => {
        this.hide_timeout_id = null;
        this.auto_hide();
      });
    } else if (this.do_hide && !global.settings.get_boolean("panel-edit-mode")) {
      void this.toggle_hiding();
    }
  }
  bind_settings() {
    try {
      this.settings = new AppletSettings(
        this,
        "devtest-show-hide-applets@mohammad-sn",
        this.instance_id
      );
      this.settings.bind("autohiders", "autohideReshowing", () => {
        this.refresh_if_hidden();
      });
      this.settings.bind("do_autohide", "do_autohide", () => {
        if (this.hide_timeout_id && !this.do_autohide) {
          GLib3.source_remove(this.hide_timeout_id);
          this.hide_timeout_id = null;
        } else if (this.do_autohide && this.do_hide) {
          this.auto_hide();
        }
        if (this.menu_item_auto_hide) {
          this.menu_item_auto_hide["_switch"].setToggleState(this.do_autohide);
        }
        this.update_autohide_tooltip();
      });
      this.settings.bind("hoveractivates", "hover_activates");
      this.settings.bind("hoveractivateshide", "hover_activates_hide");
      this.settings.bind("hidetime", "hide_time");
      this.settings.bind("hovertime", "hover_time");
      this.settings.bind("hideuntilseparator", "hide_until_separator");
    } catch (error) {
      global.logError(error);
    }
  }
  get_eligible_children() {
    const children = this.get_zone_children();
    const our_index = children.indexOf(this.actor);
    const eligible = [];
    if (this.do_hide) {
      for (let i = our_index - 1; i > -1; i--) {
        if (this.hide_until_separator && children[i]._applet._uuid === "separator@cinnamon.org") {
          break;
        }
        eligible.push(children[i]);
      }
    } else {
      for (let i = 0; i < our_index; i++) {
        if (this.hide_until_separator && children[i]._applet._uuid === "separator@cinnamon.org") {
          break;
        }
        eligible.push(children[i]);
      }
    }
    return this.do_hide ? eligible : eligible.reverse();
  }
  get_our_panel_zone() {
    if (this.locationLabel === "right") {
      return this.loaded_panel["_rightBox"];
    } else if (this.locationLabel === "left") {
      return this.loaded_panel["_leftBox"];
    }
    return this.loaded_panel["_centerBox"];
  }
  // logs say these children are `StBoxLayout` but `StBoxLayout` type has no `_applet`, even though it exists...
  // So we return `any`, even though it should be `StBoxLayout`.
  get_zone_children() {
    try {
      return (
        // oxlint-disable-next-line typescript/no-unnecessary-type-assertion
        this.get_our_panel_zone().get_children()
      );
    } catch (error) {
      global.logError(error);
      return [];
    }
  }
  is_vertical() {
    return this.orientation === St2.Side.LEFT || this.orientation === St2.Side.RIGHT;
  }
  // This is mostly about the xapps icon tray regularly "showing" its icons.
  on_applets_changed() {
    const now = GLib3.get_monotonic_time();
    if (
      // 50ms
      now - this.last_toggle_hiding_end < 5e4 || now - this.last_toggle_hiding_start < 5e4
    ) {
      return;
    }
    void this.refresh_icons();
    if (this.autohideReshowing) {
      timeout_add_once(50, () => {
        this.refresh_if_hidden();
      });
      this.refresh_if_hidden();
    }
  }
  on_applet_clicked() {
    void this.toggle_hiding();
    return true;
  }
  on_applet_removed_from_panel() {
    if (!this.do_hide) {
      void this.toggle_hiding();
    }
    if (this.connected_on_panel_edit_mode_changed) {
      global.settings.disconnect(this.connected_on_panel_edit_mode_changed);
    }
    if (this.connected_on_entered) {
      this.actor.disconnect(this.connected_on_entered);
    }
    if (this.connected_on_allocation_changed) {
      this.get_our_panel_zone().disconnect(
        this.connected_on_allocation_changed
      );
    }
    if (this.connected_on_queue_relayout) {
      this.get_our_panel_zone().disconnect(this.connected_on_queue_relayout);
    }
    for (const id of [
      this.update_icons_timeout_id,
      this.update_popup_menu_timeout_id,
      this.reshowing_hide_timeout_id,
      this.hide_timeout_id,
      this.queue_relayout_timeout_id
    ]) {
      if (id) {
        GLib3.source_remove(id);
      }
    }
  }
  on_applet_middle_clicked() {
    this.do_autohide = !this.do_autohide;
    if (this.menu_item_auto_hide) {
      this.menu_item_auto_hide["_switch"].setToggleState(this.do_autohide);
    }
    void this.toggle_hiding();
    return true;
  }
  on_entered() {
    if (!this.actor.hover && this.hover_activates && !global.settings.get_boolean("panel-edit-mode")) {
      timeout_add_once(this.hover_time, () => {
        if (this.actor.hover && (this.hover_activates_hide || !this.do_hide)) {
          void this.toggle_hiding();
        }
      });
    }
  }
  on_panel_edit_mode_changed() {
    this.menu_item_panel_edit_mode.setToggleState(
      global.settings.get_boolean("panel-edit-mode")
    );
    if (global.settings.get_boolean("panel-edit-mode")) {
      if (!this.do_hide) {
        void this.toggle_hiding();
      }
    } else if (this.do_hide) {
      void this.toggle_hiding();
    }
  }
  on_orientation_changed(orientation) {
    this.orientation = orientation;
  }
  async refresh_icons() {
    try {
      await this.icon_config.update(this.get_eligible_children());
      this.update_popup_menu();
    } catch (error) {
      global.logError(error);
    }
  }
  refresh_if_hidden() {
    if (!this.do_hide) {
      this.do_hide = true;
      void this.toggle_hiding();
    }
  }
  async reset_icons() {
    this._applet_context_menu.close(false);
    try {
      await this.icon_config.reset(this.get_eligible_children());
      this.update_popup_menu();
      timeout_add_once(10, () => {
        this._applet_context_menu.open(false);
      });
    } catch (error) {
      global.logError(error);
    }
  }
  async toggle_hiding() {
    try {
      if (this.hide_timeout_id) {
        GLib3.source_remove(this.hide_timeout_id);
        this.hide_timeout_id = null;
      }
      this.last_toggle_hiding_start = GLib3.get_monotonic_time();
      this.update_our_icon();
      await Promise.all(
        this.get_eligible_children().map(async (child) => {
          (await this.icon_config.extract_icon_infos(child)).forEach(
            (icon_info) => {
              const { visible, hideable_object } = icon_info;
              if (this.do_hide) {
                if (!visible && !this.hidden_by_us.has(hideable_object)) {
                  return;
                }
                const key = IconConfig.get_icon_key(icon_info);
                if (!this.icon_config.icons[key]?.show) {
                  hideable_object.hide();
                  this.hidden_by_us.add(hideable_object);
                } else if (this.hidden_by_us.delete(hideable_object)) {
                  hideable_object.show();
                }
              } else if (this.hidden_by_us.has(hideable_object)) {
                hideable_object.show();
              }
            }
          );
        })
      );
      if (!this.do_hide) {
        this.hidden_by_us.clear();
      }
      if (!this.do_hide && this.do_autohide && !global.settings.get_boolean("panel-edit-mode")) {
        this.hide_timeout_id = timeout_add_seconds_once(this.hide_time, () => {
          this.hide_timeout_id = null;
          this.auto_hide();
        });
      }
      this.do_hide = !this.do_hide;
      this.last_toggle_hiding_end = GLib3.get_monotonic_time();
    } catch (error) {
      global.logError(error);
    }
  }
  update_autohide_tooltip() {
    if (this.do_autohide) {
      this.set_applet_tooltip(_("Autohide ON"));
    } else {
      this.set_applet_tooltip(_("Autohide OFF"));
    }
  }
  update_our_icon() {
    if (this.do_hide) {
      if (this.is_vertical()) {
        this.set_applet_icon_symbolic_name("2v");
      } else {
        this.set_applet_icon_symbolic_name("2");
      }
    } else {
      if (this.is_vertical()) {
        this.set_applet_icon_symbolic_name("1v");
      } else {
        this.set_applet_icon_symbolic_name("1");
      }
    }
  }
  update_popup_menu() {
    if (!this._applet_context_menu.isOpen) {
      if (!this.menu_items_icon_section) {
        this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem(), 0);
        const menu_item_reset_icons_list = new PopupMenuItem(
          _("Reset icons list")
        );
        menu_item_reset_icons_list.connect("activate", () => {
          void this.reset_icons();
        });
        this._applet_context_menu.addMenuItem(menu_item_reset_icons_list, 0);
        this.menu_item_panel_edit_mode = new PopupSwitchMenuItem2(
          _("Panel Edit mode"),
          global.settings.get_boolean("panel-edit-mode")
        );
        this.menu_item_panel_edit_mode.connect("toggled", (item) => {
          global.settings.set_boolean("panel-edit-mode", item.state);
        });
        this._applet_context_menu.addMenuItem(
          this.menu_item_panel_edit_mode,
          0
        );
        this.menu_item_auto_hide = new PopupSwitchMenuItem2(
          _("Autohide"),
          this.do_autohide
        );
        this.menu_item_auto_hide.connect("toggled", () => {
          this.do_autohide = !this.do_autohide;
          this.update_autohide_tooltip();
        });
        this._applet_context_menu.addMenuItem(this.menu_item_auto_hide, 0);
        this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem(), 0);
        this.menu_items_icon_section = new PopupMenuSection();
        this._applet_context_menu.addMenuItem(this.menu_items_icon_section, 0);
      }
      this.menu_items_icon_section.removeAll();
      this.icon_config.create_menu_items(async () => {
        if (!this.do_hide) {
          await this.toggle_hiding();
          void this.toggle_hiding();
        }
      }).forEach((icon_toggle) => {
        this.menu_items_icon_section.addMenuItem(icon_toggle);
      });
    }
  }
};
function main(metadata, orientation, panel_height, instance_id) {
  return new MyApplet(metadata, orientation, panel_height, instance_id);
}
