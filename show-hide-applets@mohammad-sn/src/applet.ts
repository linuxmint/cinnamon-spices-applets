import { timeout_add_once, timeout_add_seconds_once } from "./timeout";
import { IconConfig } from "./icon_config";

const {
  gettext,
  gi: { St, GLib },
  ui: {
    applet: { IconApplet },
    popupMenu: {
      PopupMenuSection,
      PopupSeparatorMenuItem,
      PopupMenuItem,
      PopupSwitchMenuItem,
    },
    settings: { AppletSettings },
  },
} = imports;

const UUID = "show-hide-applets@mohammad-sn";
gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

type Side = imports.gi.St.Side;

function _(str: string): string {
  return gettext.dgettext(UUID, str);
}

// Applet doesn't declare locationLabel, but actually writes to it:
// https://github.com/linuxmint/cinnamon/blob/master/js/ui/applet.js
declare global {
  // oxlint-disable-next-line typescript/no-namespace
  namespace imports.ui.applet {
    // oxlint-disable-next-line typescript/consistent-type-definitions
    interface IconApplet {
      locationLabel: string;
    }
  }
}

// function listAllProps(obj: any): string[] {
//   const seen = new Set();
//   const out = [];

//   while (obj && obj !== Object.prototype) {
//     for (const name of Object.getOwnPropertyNames(obj)) {
//       if (!seen.has(name)) {
//         seen.add(name);
//         out.push(name);
//       }
//     }
//     obj = Object.getPrototypeOf(obj);
//   }

//   return out;
// }

class MyApplet extends IconApplet {
  // Settings-bound properties
  do_autohide!: boolean;
  hover_activates!: boolean;
  hover_activates_hide!: boolean;
  hide_time!: number;
  hover_time!: number;
  autohideReshowing!: boolean;
  hide_until_separator!: boolean;

  // Runtime state
  do_hide!: boolean;
  hidden_by_us!: Set<imports.gi.Clutter.Actor>;
  last_toggle_hiding_end!: number;
  last_toggle_hiding_start!: number;
  loaded_panel!: imports.ui.panel.Panel;
  icon_config!: IconConfig;
  orientation: Side;
  settings!: imports.ui.settings.AppletSettings;

  // Menu items
  menu_item_auto_hide: imports.ui.popupMenu.PopupSwitchMenuItem | undefined;
  menu_item_panel_edit_mode!: imports.ui.popupMenu.PopupSwitchMenuItem;
  menu_items_icon_section: imports.ui.popupMenu.PopupMenuSection | undefined;

  // Connected signals
  connected_on_panel_edit_mode_changed: number | undefined;
  connected_on_entered: number | undefined;
  connected_on_allocation_changed: number | undefined;
  connected_on_queue_relayout: number | undefined;

  // Timeout IDs
  hide_timeout_id: number | null = null;
  reshowing_hide_timeout_id: number | null = null;
  update_icons_timeout_id: number | null = null;
  update_popup_menu_timeout_id: number | null = null;
  queue_relayout_timeout_id: number | null = null;

  constructor(
    metadata: any,
    orientation: Side,
    panel_height: number,
    instance_id: number,
  ) {
    super(orientation, panel_height, instance_id);

    this.orientation = orientation;
    this.hide_timeout_id = null;
    this.reshowing_hide_timeout_id = null;
    this.update_icons_timeout_id = null;
    this.last_toggle_hiding_start = 0;
    this.last_toggle_hiding_end = 0;
    this.do_hide = true;
    this.hidden_by_us = new Set();

    try {
      this.bind_settings();

      this.icon_config = new IconConfig(
        metadata.path,
        this.settings.getValue("icons"),
        (icons) => this.settings.setValue("icons", icons),
      );

      this.loaded_panel = this.panel!;

      this.update_our_icon();
      this.update_autohide_tooltip();

      this.connected_on_panel_edit_mode_changed = global.settings.connect(
        "changed::panel-edit-mode",
        () => this.on_panel_edit_mode_changed(),
      );

      this.connected_on_entered = this.actor.connect(
        // "enter-event" works but I can't find it in the cinnamon repo: https://github.com/search?q=repo%3Alinuxmint%2Fcinnamon%20enter-event&type=code
        // @ts-expect-error types are wrong
        "enter-event",
        () => this.on_entered(),
      );

      // Initial populate + start periodic updaters
      void this.refresh_icons();

      this.connected_on_allocation_changed = this.get_our_panel_zone().connect(
        "allocation-changed",
        () => {
          this.on_applets_changed();
        },
      );

      this.connected_on_queue_relayout = this.get_our_panel_zone().connect(
        "queue-relayout",
        () => {
          if (this.queue_relayout_timeout_id) {
            GLib.source_remove(this.queue_relayout_timeout_id);
          }

          // queue-relayout fires a lot when icons are hovered, so we debounce it to avoid excessive work.
          this.queue_relayout_timeout_id = timeout_add_once(200, () => {
            this.queue_relayout_timeout_id = null;
            this.on_applets_changed();
          });
        },
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
    // another `auto_hide` is already scheduled
    if (this.hide_timeout_id || !this.do_autohide) {
      return;
    }

    // postpone auto hide if any of the eligible applets are hovered or have an active menu
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
    } else if (
      this.do_hide &&
      !global.settings.get_boolean("panel-edit-mode")
    ) {
      void this.toggle_hiding();
    }
  }

  bind_settings() {
    try {
      this.settings = new AppletSettings(
        this,
        "devtest-show-hide-applets@mohammad-sn",
        this.instance_id,
      );

      this.settings.bind("autohiders", "autohideReshowing", () => {
        this.refresh_if_hidden();
      });
      this.settings.bind("do_autohide", "do_autohide", () => {
        if (this.hide_timeout_id && !this.do_autohide) {
          GLib.source_remove(this.hide_timeout_id);
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
    const eligible: any[] = [];

    if (this.do_hide) {
      for (let i = our_index - 1; i > -1; i--) {
        if (
          this.hide_until_separator &&
          children[i]._applet._uuid === "separator@cinnamon.org"
        ) {
          break;
        }

        eligible.push(children[i]);
      }
    } else {
      for (let i = 0; i < our_index; i++) {
        if (
          this.hide_until_separator &&
          children[i]._applet._uuid === "separator@cinnamon.org"
        ) {
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
        (
          this.get_our_panel_zone() as imports.gi.Clutter.Actor
        ).get_children() as any[]
      );
    } catch (error) {
      global.logError(error);
      return [];
    }
  }

  is_vertical() {
    return (
      this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT
    );
  }

  // This is mostly about the xapps icon tray regularly "showing" its icons.
  on_applets_changed() {
    // global.log("on_allocation_changed");

    // Event was probably triggered by us.
    // While this currently wouldn't result in an infinite loop, it's probably a good idea to ignore events that are triggered by us changing the panel content.
    const now = GLib.get_monotonic_time();
    if (
      // 50ms
      now - this.last_toggle_hiding_end < 50_000 ||
      now - this.last_toggle_hiding_start < 50_000
    ) {
      return;
    }

    void this.refresh_icons();

    if (this.autohideReshowing) {
      // Seems like allocation event sometimes fires before the icons are actually shown.
      timeout_add_once(50, () => {
        this.refresh_if_hidden();
      });
      // ... but we also refresh immediately to prevent possible icon flashing.
      this.refresh_if_hidden();
    }
  }

  override on_applet_clicked() {
    void this.toggle_hiding();
    return true;
  }

  override on_applet_removed_from_panel() {
    if (!this.do_hide) {
      void this.toggle_hiding();
    }

    // Disconnect all signals
    if (this.connected_on_panel_edit_mode_changed) {
      global.settings.disconnect(this.connected_on_panel_edit_mode_changed);
    }
    if (this.connected_on_entered) {
      this.actor.disconnect(this.connected_on_entered);
    }
    if (this.connected_on_allocation_changed) {
      this.get_our_panel_zone().disconnect(
        this.connected_on_allocation_changed,
      );
    }
    if (this.connected_on_queue_relayout) {
      this.get_our_panel_zone().disconnect(this.connected_on_queue_relayout);
    }

    // Remove all timeouts
    for (const id of [
      this.update_icons_timeout_id,
      this.update_popup_menu_timeout_id,
      this.reshowing_hide_timeout_id,
      this.hide_timeout_id,
      this.queue_relayout_timeout_id,
    ]) {
      if (id) {
        GLib.source_remove(id);
      }
    }
  }

  override on_applet_middle_clicked() {
    this.do_autohide = !this.do_autohide;
    if (this.menu_item_auto_hide) {
      this.menu_item_auto_hide["_switch"].setToggleState(this.do_autohide);
    }
    void this.toggle_hiding();
    return true;
  }

  on_entered() {
    if (
      !this.actor.hover &&
      this.hover_activates &&
      !global.settings.get_boolean("panel-edit-mode")
    ) {
      timeout_add_once(this.hover_time, () => {
        if (this.actor.hover && (this.hover_activates_hide || !this.do_hide)) {
          void this.toggle_hiding();
        }
      });
    }
  }

  on_panel_edit_mode_changed() {
    this.menu_item_panel_edit_mode.setToggleState(
      global.settings.get_boolean("panel-edit-mode"),
    );
    if (global.settings.get_boolean("panel-edit-mode")) {
      if (!this.do_hide) {
        void this.toggle_hiding();
      }
    } else if (this.do_hide) {
      void this.toggle_hiding();
    }
  }

  override on_orientation_changed(orientation: Side) {
    this.orientation = orientation;
  }

  async refresh_icons() {
    try {
      await this.icon_config.update(this.get_eligible_children());
      this.update_popup_menu();
    } catch (error: unknown) {
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

      // Wait for external close event to be processed before opening the menu again
      timeout_add_once(10, () => {
        this._applet_context_menu.open(false);
      });
    } catch (error: unknown) {
      global.logError(error);
    }
  }

  async toggle_hiding() {
    try {
      if (this.hide_timeout_id) {
        GLib.source_remove(this.hide_timeout_id);
        this.hide_timeout_id = null;
      }

      this.last_toggle_hiding_start = GLib.get_monotonic_time();
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
            },
          );
        }),
      );

      if (!this.do_hide) {
        this.hidden_by_us.clear();
      }

      if (
        !this.do_hide &&
        this.do_autohide &&
        !global.settings.get_boolean("panel-edit-mode")
      ) {
        this.hide_timeout_id = timeout_add_seconds_once(this.hide_time, () => {
          this.hide_timeout_id = null;
          this.auto_hide();
        });
      }

      // global.log("Toggling hiding: " + this.do_hide + " -> " + !this.do_hide);
      this.do_hide = !this.do_hide;
      this.last_toggle_hiding_end = GLib.get_monotonic_time();
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
      // oxlint-disable-next-line no-lonely-if
      if (this.is_vertical()) {
        this.set_applet_icon_symbolic_name("1v");
      } else {
        this.set_applet_icon_symbolic_name("1");
      }
    }
  }

  update_popup_menu() {
    // global.log("update_popup_menu");
    if (!this._applet_context_menu.isOpen) {
      if (!this.menu_items_icon_section) {
        this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem(), 0);

        const menu_item_reset_icons_list = new PopupMenuItem(
          _("Reset icons list"),
        );
        menu_item_reset_icons_list.connect("activate", () => {
          void this.reset_icons();
        });
        this._applet_context_menu.addMenuItem(menu_item_reset_icons_list, 0);

        this.menu_item_panel_edit_mode = new PopupSwitchMenuItem(
          _("Panel Edit mode"),
          global.settings.get_boolean("panel-edit-mode"),
        );
        this.menu_item_panel_edit_mode.connect("toggled", (item) => {
          global.settings.set_boolean("panel-edit-mode", item.state);
        });
        this._applet_context_menu.addMenuItem(
          this.menu_item_panel_edit_mode,
          0,
        );

        this.menu_item_auto_hide = new PopupSwitchMenuItem(
          _("Autohide"),
          this.do_autohide,
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
      this.icon_config
        .create_menu_items(async () => {
          // Update both show AND hide statuses if currently hidden
          if (!this.do_hide) {
            await this.toggle_hiding();
            void this.toggle_hiding();
          }
        })
        .forEach((icon_toggle) => {
          this.menu_items_icon_section!.addMenuItem(icon_toggle);
        });
    }
  }
}

export function main(
  metadata: any,
  orientation: Side,
  panel_height: number,
  instance_id: number,
) {
  return new MyApplet(metadata, orientation, panel_height, instance_id);
}
