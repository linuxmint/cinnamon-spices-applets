#!/usr/bin/cjs
// Run: cjs test.js   (from this directory)
imports.searchPath.unshift(".");
const Drawer = imports.drawer;

function assertEq(actual, expected, what) {
    let a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e)
        throw new Error(what + ": got " + a + ", want " + e);
    print("ok - " + what);
}

const applet = (key, visible) => ({ key: key, visible: visible !== false });

// 1. collapsing hides drawer members only
{
    let p = Drawer.plan([applet("a:1"), applet("b:2"), applet("c:3")], ["a:1", "c:3"], [], true);
    assertEq(p.toHide, ["a:1", "c:3"], "collapse: hides members");
    assertEq(p.toShow, [], "collapse: shows nothing");
}

// 2. an applet already hidden by someone else is left alone, and never shown by us
{
    let p = Drawer.plan([applet("a:1", false), applet("b:2")], ["a:1", "b:2"], [], true);
    assertEq(p.toHide, ["b:2"], "collapse: skips foreign-hidden applet");
    let back = Drawer.plan([applet("a:1", false), applet("b:2", false)], ["a:1", "b:2"], ["b:2"], false);
    assertEq(back.toShow, ["b:2"], "expand: shows only what we hid");
}

// 3. expanding shows what we hid; collapsing again re-hides it
{
    let expanded = Drawer.plan([applet("a:1", false)], ["a:1"], ["a:1"], false);
    assertEq(expanded.toShow, ["a:1"], "expand: shows our applet");
    let again = Drawer.plan([applet("a:1")], ["a:1"], [], true);
    assertEq(again.toHide, ["a:1"], "collapse again: hides it back");
}

// 4. taking an applet out of the drawer while collapsed shows it immediately
{
    let p = Drawer.plan([applet("a:1", false), applet("b:2", false)], ["b:2"], ["a:1", "b:2"], true);
    assertEq(p.toShow, ["a:1"], "unset member: shown while still collapsed");
    assertEq(p.toHide, [], "unset member: nothing new to hide");
}

// 5. an applet removed from the panel while we had it hidden is simply forgotten
{
    let p = Drawer.plan([applet("b:2", false)], ["a:1", "b:2"], ["a:1", "b:2"], false);
    assertEq(p.toShow, ["b:2"], "expand: gone applet produces no work");
}

// 6. nothing to do twice - a second collapse is a no-op
{
    let p = Drawer.plan([applet("a:1", false)], ["a:1"], ["a:1"], true);
    assertEq(p.toHide, [], "collapse twice: idempotent");
    assertEq(p.toShow, [], "collapse twice: nothing shown");
}

assertEq(Drawer.keyFor("sound@cinnamon.org", 11), "sound@cinnamon.org:11", "keyFor");

// 7. tray icon keys - real cases from a live panel
{
    assertEq(Drawer.trayKey({ name: "blueman", id: "blueman", tooltip: "Bluetooth" }),
             "xapp:blueman", "trayKey: app-provided name wins");
    assertEq(Drawer.trayKey({ name: ":1.3196", id: "Signal_status_icon_1", tooltip: "Signal Desktop" }),
             "xapp:signal", "trayKey: bus address falls back to the StatusNotifier Id");
    assertEq(Drawer.trayKey({ name: ":1.204", id: "Slack_status_icon_1", tooltip: "You have unread messages" }),
             "xapp:slack", "trayKey: Id beats a tooltip that changes");
    // The case that started all this: a flatpak, so the process behind the bus
    // name is only ever xdg-dbus-proxy - the Id still names the app.
    assertEq(Drawer.trayKey({ name: ":1.3847", id: "teams-for-linux_status_icon_1",
                             tooltip: "Microsoft Teams (2)" }),
             "xapp:teams-for-linux", "trayKey: flatpak keyed by Id, not by tooltip");
    assertEq(Drawer.trayKey({ name: ":1.2124", id: null, tooltip: "Microsoft Teams (2)" }),
             "xapp:Microsoft Teams", "trayKey: no Id yet, tooltip holds the place");
    assertEq(Drawer.trayKey({ name: ":1.99", id: null, tooltip: "" }),
             "xapp::1.99", "trayKey: nothing stable left");
    assertEq(Drawer.normalizeId("openrgb"), "openrgb", "normalizeId: plain id kept");
    assertEq(Drawer.normalizeId("Bitwarden_status_icon_1"), "bitwarden",
             "normalizeId: drops the electron counter");
    assertEq(Drawer.normalizeId("app_status_icon_2_pro"), "app_status_icon_2_pro",
             "normalizeId: only a trailing counter counts");
    assertEq(Drawer.normalizeId(""), "", "normalizeId: empty id stays empty");
    assertEq(Drawer.normalizeTooltip("Nextcloud - 3 files\nsyncing"), "Nextcloud - 3 files",
             "normalizeTooltip: first line only");
    assertEq(Drawer.normalizeTooltip("Thunderbird [12]"), "Thunderbird",
             "normalizeTooltip: drops the counter");
}

// 8. what the menu shows - the app's own spelling, never a status text
{
    assertEq(Drawer.trayLabel({ name: "openrgb", id: null, tooltip: "OpenRGB" }),
             "openrgb", "trayLabel: the name the app gave XApp");
    assertEq(Drawer.trayLabel({ name: ":1.204", id: "Slack_status_icon_1",
                               tooltip: "You have unread messages" }),
             "Slack", "trayLabel: no name, so the Id - and not the status tooltip");
    assertEq(Drawer.trayLabel({ name: ":1.3847", id: "teams-for-linux_status_icon_1",
                               tooltip: "Microsoft Teams (2)" }),
             "teams-for-linux", "trayLabel: Id keeps its own spelling, unlike the key");
    assertEq(Drawer.trayLabel({ name: ":1.2124", id: null, tooltip: "Microsoft Teams (2)" }),
             "Microsoft Teams", "trayLabel: nothing but a tooltip until the Id lands");
    assertEq(Drawer.trayLabel({ name: ":1.99", id: null, tooltip: "" }),
             ":1.99", "trayLabel: nothing to call it but its bus address");
    assertEq(Drawer.appName("Bitwarden_status_icon_1"), "Bitwarden",
             "appName: counter off, case kept");
}

print("all tests passed");
