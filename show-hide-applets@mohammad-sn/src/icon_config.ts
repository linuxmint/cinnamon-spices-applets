// ====================================
// TRAY STRUCTURE:
// eligible zone children (St.BoxLayout[]) -> child (St.BoxLayout) -> child._applet (Applet) => icon data either via the Applet (xapp status icons or other applets) or BoxLayout (systray).
// ====================================

const {
  gi: {
    St,
    Gtk,
    Gio,
    GdkPixbuf: { Pixbuf },
    GLib,
  },
  ui: {
    popupMenu: { PopupSwitchMenuItem, PopupSwitchIconMenuItem },
  },
} = imports;

// `applet._meta` example:
// {"uuid":"network@cinnamon.org","name":"Network Manager","description":"Network manager applet","icon":"cs-network","state":1,"path":"/usr/share/cinnamon/applets/network@cinnamon.org","error":"","force_loaded":false}
export type AppletMeta = {
  uuid: string;
  name: string;
  description: string;
  icon: string;
  state: number;
  path: string;
  error: string;
  force_loaded: boolean;
};

type StatusIconInterfaceProxy = imports.gi.XApp.StatusIconInterfaceProxy;

export type IconsConfigData = Record<
  string,
  {
    owner_uuid: string;
    name: string;
    last_seen: number;
    show: boolean;

    icon_name?: string;
  }
>;

type IconInfo = {
  owner_uuid: string;
  name: string;
  visible: boolean;
  hideable_object: any;

  icon_name?: string;
};

// 7 days, since some apps use multiple distinct icons but only one at the time. It's not possible to identify correlated icons by app name (multiple apps can have the same name), so users unfortunately sometimes have to toggle different icon states "on" if that is an app that they always want to see.
const ICON_SWITCH_STORE_DURATION = 7 * 24 * 60 * 60 * 1000;

// Some apps embed volatile data in their icon title (e.g. SABnzbd progress), so only
// the stable part of the name is kept across sightings.
function common_prefix(current: string, next: string) {
  let length = 0;
  while (
    length < current.length &&
    length < next.length &&
    current[length] === next[length]
  ) {
    length++;
  }

  return length === 0 ? next : current.slice(0, length).trim();
}

function hash_icon(
  file: imports.gi.Gio.File,
  checksumType = GLib.ChecksumType.SHA256,
) {
  const [ok, contents] = file.load_contents(null);
  if (!ok) {
    return;
  }
  return (
    // @ts-expect-error Works at runtime. Opus explains: "At runtime, cjs/gjs marshals a Uint8Array into that parameter perfectly fine — a Uint8Array is an array of byte-sized numbers. The number[] type is just an imprecise representation; you don't need to convert to a plain JS array."
    GLib.compute_checksum_for_bytes(checksumType, GLib.Bytes.new(contents))
  );
}

// Keeps track of the icons seen in the panel zone, persists that state and
// copies file-based icons into an applet-local directory.
export class IconConfig {
  icons: IconsConfigData;

  private readonly icons_dir: imports.gi.Gio.File;
  private readonly persist: (icons: IconsConfigData) => void;

  constructor(
    metadata_path: string,
    initial_value: IconsConfigData | undefined,
    persist: (icons: IconsConfigData) => void,
  ) {
    this.icons = initial_value ?? {};
    this.persist = persist;

    Gtk.IconTheme.get_default().append_search_path(metadata_path);
    this.icons_dir = Gio.File.new_for_path(metadata_path + "/icons");
    if (!this.icons_dir.query_exists(null)) {
      this.icons_dir.make_directory_with_parents(null);
    }
    Gtk.IconTheme.get_default().append_search_path(this.icons_dir.get_path()!);
  }

  ensure_local_icon(icon_name: string) {
    if (!icon_name.includes("/") || !icon_name.includes(".")) {
      return icon_name;
    }

    try {
      const source_file = Gio.File.new_for_path(icon_name);
      if (!source_file.query_exists(null)) {
        return undefined;
      }

      const file_extension = icon_name.split(".").at(-1)!;
      const dest_name = hash_icon(source_file) + ".png";
      const dest_file = this.icons_dir.get_child(dest_name);
      if (!dest_file.query_exists(null)) {
        if (file_extension !== "png") {
          const pixbuf = Pixbuf.new_from_file(icon_name);
          pixbuf?.savev(dest_file.get_path()!, "png", null, null);
        } else {
          source_file.copy(dest_file, Gio.FileCopyFlags.NONE, null, null);
        }
      }

      // Get rid of the extension
      return dest_name.replace(/\.[^.]+$/u, "");
    } catch (error) {
      global.logError(error);
      return undefined;
    }
  }

  // `name` is excluded from the key when an icon is available, since
  // some apps embed volatile data (e.g. progress) in their icon name.
  static get_icon_key({ owner_uuid, name, icon_name }: IconInfo) {
    return owner_uuid + (icon_name ?? name);
  }

  extract_icon_infos(child: any): IconInfo[] {
    const applet = child._applet;
    if (applet._uuid === "xapp-status@cinnamon.org") {
      return Object.values(applet.statusIcons as Record<string, any>)
        .map((icon) => {
          // `icon` is a XAppStatusIcon, NOT imports.gi.XApp.StatusIcon
          // https://github.com/linuxmint/cinnamon/blob/96cf2909241b1ce8a92577afcb66618e91b25d03/files/usr/share/cinnamon/applets/xapp-status%40cinnamon.org/applet.js#L106
          // Object.keys(icon):
          // name, applet, proxy, iconName, actor, icon_holder, iconSize, label, _tooltip, _proxy_prop_change_id, show_label
          const { name, icon_name, visible } =
            icon.proxy as StatusIconInterfaceProxy;

          // xapp-status@cinnamon.org only renders proxies that have a name AND icon_name! (But icon_name seems to be a space when it's "empty".)
          if (name.trim() === "" || icon_name.trim() === "") {
            return undefined;
          }

          return {
            owner_uuid: applet._uuid,
            name: name.startsWith(":") ? "<no name>" : name,
            icon_name: this.ensure_local_icon(icon_name),
            visible,
            hideable_object: icon.actor,
          } satisfies IconInfo;
        })
        .filter((icon) => icon !== undefined);
    } else if (applet._uuid === "systray@cinnamon.org") {
      // The children are St.Bin[], the buttons created here: https://github.com/linuxmint/cinnamon/blob/96cf2909241b1ce8a92577afcb66618e91b25d03/files/usr/share/cinnamon/applets/systray%40cinnamon.org/applet.js#L147

      return child
        .get_first_child() // button_box
        .get_children()
        .map((systray_icon: any) => {
          // No names/paths for the icons that I could find
          const { title, visible } =
            systray_icon.get_child() as imports.gi.Cinnamon.TrayIcon;
          return {
            owner_uuid: applet._uuid,
            name: title,
            visible,
            hideable_object: systray_icon,
          } satisfies IconInfo;
        });
    }

    const { uuid, name, icon } = applet._meta as AppletMeta;
    return [
      {
        owner_uuid: uuid,
        name,
        icon_name: icon,
        visible: child.visible,
        hideable_object: child,
      },
    ];
  }

  // Collects/refreshes the icon state from the given panel zone children,
  // prunes stale entries, keeps xapp-status icons at the bottom and persists.
  update(eligible_children: any[]) {
    for (const child of eligible_children) {
      this.extract_icon_infos(child).forEach((icon_info) => {
        const { owner_uuid, name, icon_name } = icon_info;
        const key = IconConfig.get_icon_key(icon_info);

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
            icon_name,
          };
        }
      });
    }

    Object.entries(this.icons).forEach(([key, icon]) => {
      if (Date.now() - icon.last_seen > ICON_SWITCH_STORE_DURATION) {
        // oxlint-disable-next-line typescript/no-dynamic-delete
        delete this.icons[key];
      }
    });

    this.persist(this.icons);
  }

  // Rebuilds the icon list from scratch while preserving each icon's `show` state.
  reset(eligible_children: any[]) {
    const iconsBackup = JSON.parse(
      JSON.stringify(this.icons),
    ) as IconsConfigData;
    this.icons = {};
    this.update(eligible_children);
    // Restore `show` status
    Object.entries(iconsBackup).forEach(([key, { show }]) => {
      if (this.icons[key]) {
        this.icons[key].show = show;
      }
    });
  }

  // Builds a switch menu item for each stored icon.
  create_menu_items(on_toggle: () => void) {
    return Object.values(this.icons).map((icon) => {
      const { name, show, icon_name } = icon;

      const iconToggle = icon_name
        ? new PopupSwitchIconMenuItem(
            name,
            show,
            icon_name,
            icon_name.includes("/")
              ? St.IconType.FULLCOLOR
              : St.IconType.SYMBOLIC,
          )
        : new PopupSwitchMenuItem(name, show);

      // @ts-expect-error types are wrong
      iconToggle.connect("toggled", () => {
        icon.show = !icon.show;
        this.persist(this.icons);
        on_toggle();
      });

      return iconToggle;
    });
  }
}
