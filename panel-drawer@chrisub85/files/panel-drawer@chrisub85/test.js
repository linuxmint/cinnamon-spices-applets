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
    assertEq(Drawer.trayKey({ name: "blueman", comm: "blueman-tray", tooltip: "Bluetooth" }),
             "xapp:blueman", "trayKey: app-provided name wins");
    assertEq(Drawer.trayKey({ name: ":1.206", comm: "signal-desktop", tooltip: "Signal Desktop" }),
             "xapp:signal-desktop", "trayKey: bus address falls back to the process");
    assertEq(Drawer.trayKey({ name: ":1.204", comm: "slack", tooltip: "You have unread messages" }),
             "xapp:slack", "trayKey: process beats a tooltip that changes");
    assertEq(Drawer.trayKey({ name: ":1.2124", comm: "xdg-dbus-proxy", tooltip: "Microsoft Teams (2)" }),
             "xapp:Microsoft Teams", "trayKey: flatpak proxy falls back to the tooltip");
    assertEq(Drawer.trayKey({ name: ":1.99", comm: null, tooltip: "" }),
             "xapp::1.99", "trayKey: nothing stable left");
    assertEq(Drawer.normalizeTooltip("Nextcloud - 3 files\nsyncing"), "Nextcloud - 3 files",
             "normalizeTooltip: first line only");
    assertEq(Drawer.normalizeTooltip("Thunderbird [12]"), "Thunderbird",
             "normalizeTooltip: drops the counter");
}

print("all tests passed");
