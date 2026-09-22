import { describe, expect, it, vi } from "vitest";
import { IconConfig, type IconsConfigData } from "../src/icon_config";
import {
  copyCalls,
  fileHash,
  MockPopupSwitchIconMenuItem,
  MockPopupSwitchMenuItem,
  mkdirCalls,
  pixbufSavev,
  logError,
  searchPaths,
  vfs,
} from "./gjs-mock";

const META_PATH = "/meta";
const ICONS_DIR = META_PATH + "/icons";

function make_store(
  initial?: IconsConfigData,
  persist: (icons: IconsConfigData) => void = () => undefined,
) {
  return new IconConfig(META_PATH, initial, persist);
}

function regular_child(uuid: string, name: string, icon: string) {
  return { _applet: { _uuid: uuid, _meta: { uuid, name, icon } } };
}

function xapp_child(icons: { name: string; icon_name: string }[]) {
  const statusIcons: Record<string, any> = {};
  icons.forEach((icon, i) => {
    statusIcons["k" + i] = {
      proxy: { name: icon.name, icon_name: icon.icon_name },
    };
  });
  return { _applet: { _uuid: "xapp-status@cinnamon.org", statusIcons } };
}

function systray_child(titles: string[]) {
  const children = titles.map((title) => ({ get_child: () => ({ title }) }));
  return {
    _applet: { _uuid: "systray@cinnamon.org" },
    get_first_child: () => ({ get_children: () => children }),
  };
}

describe("constructor", () => {
  it("registers the metadata path and icons dir as icon search paths", () => {
    make_store();

    expect(searchPaths).toContain(META_PATH);
    expect(searchPaths).toContain(ICONS_DIR);
  });

  it("creates the icons directory when it does not exist", () => {
    make_store();

    expect(mkdirCalls).toContain(ICONS_DIR);
    expect(vfs.has(ICONS_DIR)).toBe(true);
  });

  it("does not recreate the icons directory when it already exists", () => {
    vfs.add(ICONS_DIR);

    make_store();

    expect(mkdirCalls).not.toContain(ICONS_DIR);
  });

  it("defaults to an empty icon record when no initial value is given", () => {
    const store = make_store();

    expect(store.icons).toStrictEqual({});
  });

  it("uses the provided initial value", () => {
    const initial: IconsConfigData = {
      key: { owner_uuid: "u", name: "n", last_seen: 1, show: true },
    };

    const store = make_store(initial);

    expect(store.icons).toBe(initial);
  });
});

describe("ensure_local_icon", () => {
  it("returns theme icon names (without a slash) unchanged", () => {
    const store = make_store();

    expect(store.ensure_local_icon("dialog-information")).toBe(
      "dialog-information",
    );
    expect(copyCalls).toHaveLength(0);
  });

  it("copies a file-based icon into the icons dir and returns the content hash name", () => {
    const store = make_store();
    vfs.add("/usr/share/foo.png");
    const hash = fileHash("/usr/share/foo.png");

    const result = store.ensure_local_icon("/usr/share/foo.png");

    expect(result).toBe(hash);
    expect(copyCalls).toStrictEqual([
      { from: "/usr/share/foo.png", to: ICONS_DIR + "/" + hash + ".png" },
    ]);
  });

  it("reuses the same name for files with identical contents", () => {
    const store = make_store();
    vfs.add("/usr/share/foo.png", "same-bytes");
    vfs.add("/usr/share/copy.png", "same-bytes");

    const first = store.ensure_local_icon("/usr/share/foo.png");
    const second = store.ensure_local_icon("/usr/share/copy.png");

    expect(second).toBe(first);
    expect(copyCalls).toHaveLength(1);
  });

  it("does not copy again when the destination already exists", () => {
    const store = make_store();
    vfs.add("/usr/share/foo.png");
    const hash = fileHash("/usr/share/foo.png");
    vfs.add(ICONS_DIR + "/" + hash + ".png");

    const result = store.ensure_local_icon("/usr/share/foo.png");

    expect(result).toBe(hash);
    expect(copyCalls).toHaveLength(0);
  });

  it("returns undefined when the source file is missing", () => {
    const store = make_store();

    const result = store.ensure_local_icon("/does/not/exist.png");

    expect(result).toBeUndefined();
    expect(copyCalls).toHaveLength(0);
  });

  it("converts .ico files to png via pixbuf", () => {
    const store = make_store();
    vfs.add("/opt/app.ico");
    const hash = fileHash("/opt/app.ico");

    const result = store.ensure_local_icon("/opt/app.ico");

    expect(result).toBe(hash);
    expect(pixbufSavev).toHaveBeenCalledWith(
      ICONS_DIR + "/" + hash + ".png",
      "png",
      null,
      null,
    );
    expect(copyCalls).toHaveLength(0);
  });

  it("logs and returns undefined when conversion throws", () => {
    const store = make_store();
    vfs.add("/opt/app.ico");
    pixbufSavev.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const result = store.ensure_local_icon("/opt/app.ico");

    expect(result).toBeUndefined();
    // oxlint-disable-next-line vitest/prefer-called-times -- conflicts with prefer-called-once
    expect(logError).toHaveBeenCalledOnce();
  });
});

describe("update", () => {
  it("records a regular applet keyed by uuid + icon", () => {
    const store = make_store();

    store.update([regular_child("foo@bar", "Foo", "foo-icon")]);

    expect(store.icons["foo@barfoo-icon"]).toMatchObject({
      owner_uuid: "foo@bar",
      name: "Foo",
      icon_name: "foo-icon",
      show: true,
    });
  });

  it("records xapp-status icons and skips empty name or icon_name", () => {
    const store = make_store();

    store.update([
      xapp_child([
        { name: "Vol", icon_name: "audio-volume" },
        { name: "  ", icon_name: "x" },
        { name: "y", icon_name: " " },
      ]),
    ]);

    const keys = Object.keys(store.icons);
    expect(keys).toStrictEqual(["xapp-status@cinnamon.orgaudio-volume"]);
    expect(store.icons[keys[0]!]).toMatchObject({
      owner_uuid: "xapp-status@cinnamon.org",
      name: "Vol",
      icon_name: "audio-volume",
    });
  });

  it("records systray icons keyed by title, without an icon name", () => {
    const store = make_store();

    store.update([systray_child(["Discord"])]);

    expect(store.icons["systray@cinnamon.orgDiscord"]).toMatchObject({
      owner_uuid: "systray@cinnamon.org",
      name: "Discord",
    });
    expect(
      store.icons["systray@cinnamon.orgDiscord"]!.icon_name,
    ).toBeUndefined();
  });

  it("refreshes last_seen without clobbering the show state on repeat", () => {
    vi.useFakeTimers();
    try {
      const store = make_store();
      vi.setSystemTime(new Date(1000));
      store.update([regular_child("foo@bar", "Foo", "foo-icon")]);
      store.icons["foo@barfoo-icon"]!.show = true;

      vi.setSystemTime(new Date(5000));
      store.update([regular_child("foo@bar", "Foo", "foo-icon")]);

      expect(store.icons["foo@barfoo-icon"]!.last_seen).toBe(5000);
      expect(store.icons["foo@barfoo-icon"]!.show).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("prunes entries not seen within the retention window", () => {
    vi.useFakeTimers();
    try {
      const store = make_store();
      vi.setSystemTime(new Date(0));
      store.update([regular_child("foo@bar", "Foo", "foo-icon")]);

      vi.setSystemTime(new Date(8 * 24 * 60 * 60 * 1000));
      store.update([]);

      expect(store.icons).toStrictEqual({});
    } finally {
      vi.useRealTimers();
    }
  });

  it("persists after updating", () => {
    const persist = vi.fn<(icons: IconsConfigData) => void>();
    const store = make_store(undefined, persist);

    store.update([regular_child("foo@bar", "Foo", "foo-icon")]);

    expect(persist).toHaveBeenCalledWith(store.icons);
  });
});

describe("reset", () => {
  it("rebuilds the list while preserving the show state", () => {
    const store = make_store();
    store.update([regular_child("foo@bar", "Foo", "foo-icon")]);
    store.icons["foo@barfoo-icon"]!.show = true;

    store.reset([regular_child("foo@bar", "Foo", "foo-icon")]);

    expect(store.icons["foo@barfoo-icon"]!.show).toBe(true);
  });

  it("drops entries that are no longer present", () => {
    const store = make_store();
    store.update([
      regular_child("foo@bar", "Foo", "foo-icon"),
      regular_child("baz@qux", "Baz", "baz-icon"),
    ]);

    store.reset([regular_child("foo@bar", "Foo", "foo-icon")]);

    expect(Object.keys(store.icons)).toStrictEqual(["foo@barfoo-icon"]);
  });
});

describe("create_menu_items", () => {
  it("creates a plain switch item for icons without an icon name", () => {
    const store = make_store({
      key: { owner_uuid: "u", name: "Plain", last_seen: 0, show: true },
    });

    const [item] = store.create_menu_items(
      () => undefined,
    ) as unknown as MockPopupSwitchMenuItem[];

    expect(item).toBeInstanceOf(MockPopupSwitchMenuItem);
    expect(item).not.toBeInstanceOf(MockPopupSwitchIconMenuItem);
    expect(item!.label).toBe("Plain");
    expect(item!.state).toBe(true);
  });

  it("uses a symbolic icon item for theme icon names", () => {
    const store = make_store({
      key: {
        owner_uuid: "u",
        name: "Themed",
        icon_name: "audio-volume",
        last_seen: 0,
        show: false,
      },
    });

    const [item] = store.create_menu_items(
      () => undefined,
    ) as unknown as MockPopupSwitchIconMenuItem[];

    expect(item).toBeInstanceOf(MockPopupSwitchIconMenuItem);
    expect(item!.iconName).toBe("audio-volume");
    expect(item!.iconType).toBe("SYMBOLIC");
  });

  it("uses a full-color icon item for file-path icon names", () => {
    const store = make_store({
      key: {
        owner_uuid: "u",
        name: "File",
        icon_name: "/path/to/icon.png",
        last_seen: 0,
        show: false,
      },
    });

    const [item] = store.create_menu_items(
      () => undefined,
    ) as unknown as MockPopupSwitchIconMenuItem[];

    expect(item!.iconType).toBe("FULLCOLOR");
  });

  it("toggles show, persists and calls back when switched", () => {
    const persist = vi.fn<(icons: IconsConfigData) => void>();
    const on_toggle = vi.fn<() => void>();
    const store = make_store(
      { key: { owner_uuid: "u", name: "Plain", last_seen: 0, show: false } },
      persist,
    );

    const [item] = store.create_menu_items(
      on_toggle,
    ) as unknown as MockPopupSwitchMenuItem[];
    item!.emit("toggled");

    expect(store.icons["key"]!.show).toBe(true);
    expect(persist).toHaveBeenCalledWith(store.icons);
    // oxlint-disable-next-line vitest/prefer-called-times -- conflicts with prefer-called-once
    expect(on_toggle).toHaveBeenCalledOnce();
  });
});
