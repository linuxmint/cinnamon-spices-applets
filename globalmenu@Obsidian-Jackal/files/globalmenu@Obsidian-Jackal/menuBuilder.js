// @ts-check
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Extension = imports.ui.extension;

const UUID = "globalmenu@Obsidian-Jackal";

let Me = null;
if (typeof Extension.getCurrentExtension === "function")
    Me = Extension.getCurrentExtension();
if (!Me || !Me.imports) {
    let path = imports.ui.appletManager.appletMeta[UUID].path;
    if (imports.searchPath.indexOf(path) < 0)
        imports.searchPath.unshift(path);
    Me = { imports: imports };
}

const menuSource = Me.imports.menuSource;

function _variantToString(v) {
    if (!v)
        return null;
    try {
        return v.get_string()[0];
    } catch (err) {
        try {
            return v.unpack();
        } catch (innerErr) {
            return null;
        }
    }
}

function _getAttr(model, index, name, typeStr) {
    try {
        let v = model.get_item_attribute_value(index, name, GLib.VariantType.new(typeStr));
        return v;
    } catch (err) {
        return null;
    }
}

function _activateAction(actionName, targetVariant, actionGroups) {
    if (!actionName)
        return;
    let dot = actionName.indexOf(".");
    if (dot < 0)
        return;
    let ns = actionName.substring(0, dot);
    let name = actionName.substring(dot + 1);
    let group = actionGroups[ns];
    let has = false;
    if (group) {
        try { has = group.has_action(name); } catch (err) { has = false; }
    }
    if (group && !has) {
        try {
            let acts = group.list_actions();
            let compact = name.replace(/-/g, "").toLowerCase();
            for (let i = 0; i < acts.length; i++) {
                if (acts[i].replace(/-/g, "").toLowerCase() === compact) {
                    name = acts[i];
                    has = true;
                    break;
                }
            }
        } catch (err) {}
    }

    let gtk = actionGroups && actionGroups._gtk;
    let dbusPath = null;
    if (gtk && gtk.busName) {
        if (ns === "win")
            dbusPath = gtk.winPath;
        else if (ns === "app")
            dbusPath = gtk.appPath;
        else if (ns === "unity")
            dbusPath = gtk.unityPath;
    }

    if (dbusPath) {
        let doActivate = (resolvedName) => {
            try {
                let body = GLib.Variant.new_tuple([
                    GLib.Variant.new_string(resolvedName),
                    GLib.Variant.new_array(
                        GLib.VariantType.new("v"),
                        targetVariant ? [GLib.Variant.new_variant(targetVariant)] : []
                    ),
                    GLib.Variant.new("a{sv}", {})
                ]);
                Gio.DBus.session.call(
                    gtk.busName,
                    dbusPath,
                    "org.gtk.Actions",
                    "Activate",
                    body,
                    null,
                    Gio.DBusCallFlags.NONE,
                    -1,
                    null,
                    null
                );
            } catch (err) {
                global.logWarning("globalmenu dbus Activate(" + actionName + "): " + err);
            }
        };

        if (has) {
            doActivate(name);
            return;
        }

        try {
            Gio.DBus.session.call(
                gtk.busName,
                dbusPath,
                "org.gtk.Actions",
                "DescribeAll",
                null,
                GLib.VariantType.new("(a{s(bgav)})"),
                Gio.DBusCallFlags.NONE,
                1000,
                null,
                (conn, res) => {
                    let resolvedName = name;
                    try {
                        let desc = conn.call_finish(res);
                        let map = desc.deep_unpack()[0];
                        let keys = Object.keys(map);
                        let compact = name.replace(/-/g, "").toLowerCase();
                        for (let i = 0; i < keys.length; i++) {
                            if (keys[i].replace(/-/g, "").toLowerCase() === compact) {
                                resolvedName = keys[i];
                                break;
                            }
                        }
                    } catch (err) {}
                    doActivate(resolvedName);
                }
            );
            return;
        } catch (err) {
            global.logWarning("globalmenu dbus Activate(" + actionName + "): " + err);
        }
    }

    if (!group) {
        group = actionGroups["unity"] || actionGroups["dbusmenu"] || actionGroups["app"] || actionGroups["win"];
        if (group && ns !== "dbusmenu" && ns !== "unity") {
            try {
                group.activate_action(actionName, targetVariant);
                return;
            } catch (err) {}
        }
    }
    if (!group)
        return;
    try {
        group.activate_action(name, targetVariant);
    } catch (err) {
        global.logWarning("globalmenu activate_action(" + actionName + "): " + err);
    }
}

function _stripMnemonic(label) {
    if (!label)
        return "";
    return String(label).replace(/_/g, "");
}

/**
 * Lazy-fill a popup from a Gio.DBusMenuModel submenu link.
 */
function _attachLazyGtkSubmenuFill(menu, parentModel, itemIndex, fallbackSubmenu, actionGroups, label, submenuAction) {
    let subChangedId = 0;
    let parentChangedId = 0;
    let sectionWatches = [];
    let watchedSub = null;
    let clearWatches = () => {
        if (subChangedId && watchedSub) {
            try { watchedSub.disconnect(subChangedId); } catch (err) {}
        }
        if (parentChangedId && parentModel) {
            try { parentModel.disconnect(parentChangedId); } catch (err) {}
        }
        for (let s = 0; s < sectionWatches.length; s++) {
            try { sectionWatches[s].model.disconnect(sectionWatches[s].id); } catch (err) {}
        }
        subChangedId = 0;
        parentChangedId = 0;
        sectionWatches = [];
        watchedSub = null;
    };
    menu.connect("open-state-changed", (m, open) => {
        if (!open) {
            clearWatches();
            return;
        }
        try {
            if (submenuAction)
                _activateAction(submenuAction, null, actionGroups);

            let bindSub = (live) => {
                if (subChangedId && watchedSub) {
                    try { watchedSub.disconnect(subChangedId); } catch (err) {}
                }
                subChangedId = 0;
                watchedSub = live || null;
                if (!watchedSub)
                    return;
                subChangedId = watchedSub.connect("items-changed", () => {
                    try { sync(); } catch (err) {}
                });
            };
            let watchSections = (live) => {
                for (let s = 0; s < sectionWatches.length; s++) {
                    try { sectionWatches[s].model.disconnect(sectionWatches[s].id); } catch (err) {}
                }
                sectionWatches = [];
                if (!live)
                    return;
                let sn = 0;
                try { sn = live.get_n_items(); } catch (err) { sn = 0; }
                for (let j = 0; j < sn; j++) {
                    let sec = null;
                    try { sec = live.get_item_link(j, Gio.MENU_LINK_SECTION); } catch (err) { sec = null; }
                    if (!sec)
                        continue;
                    let id = sec.connect("items-changed", () => {
                        try { sync(); } catch (err) {}
                    });
                    sectionWatches.push({ model: sec, id: id });
                }
            };
            let sync = () => {
                let live = null;
                try {
                    live = parentModel.get_item_link(itemIndex, Gio.MENU_LINK_SUBMENU);
                } catch (err) { live = null; }
                if (!live)
                    live = fallbackSubmenu;
                m.removeAll();
                fillPopupFromModel(m, live, actionGroups);
                if (live !== watchedSub)
                    bindSub(live);
                watchSections(live);
                return live;
            };
            sync();
            if (parentChangedId) {
                try { parentModel.disconnect(parentChangedId); } catch (err) {}
                parentChangedId = 0;
            }
            parentChangedId = parentModel.connect("items-changed", () => {
                try { sync(); } catch (err) {}
            });
        } catch (err) {
            global.logWarning("globalmenu fill submenu(" + label + "): " + err);
        }
    });
}

/**
 * Fill a PopupMenu from a GMenuModel (recursive).
 * @param {any} menu
 * @param {any} model
 * @param {import('./menuSource').ActionGroups|object} actionGroups
 */
function fillPopupFromModel(menu, model, actionGroups) {
    if (!model)
        return;

    let n = model.get_n_items();
    for (let i = 0; i < n; i++) {
        let section = model.get_item_link(i, Gio.MENU_LINK_SECTION);
        let submenu = model.get_item_link(i, Gio.MENU_LINK_SUBMENU);

        if (section) {
            if (menu._getMenuItems && menu._getMenuItems().length > 0)
                menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            fillPopupFromModel(menu, section, actionGroups);
            continue;
        }

        let labelVar = _getAttr(model, i, Gio.MENU_ATTRIBUTE_LABEL, "s");
        let label = _stripMnemonic(_variantToString(labelVar)) || "";

        if (submenu) {
            let subItem = new PopupMenu.PopupSubMenuMenuItem(label);
            let submenuAction = _variantToString(_getAttr(model, i, "submenu-action", "s"));
            _attachLazyGtkSubmenuFill(
                subItem.menu, model, i, submenu, actionGroups, label, submenuAction
            );
            menu.addMenuItem(subItem);
            continue;
        }

        let actionVar = _getAttr(model, i, Gio.MENU_ATTRIBUTE_ACTION, "s");
        let actionName = _variantToString(actionVar);
        let targetVar = null;
        try {
            targetVar = model.get_item_attribute_value(
                i, Gio.MENU_ATTRIBUTE_TARGET, GLib.VariantType.new("*")
            );
        } catch (err) {
            targetVar = null;
        }

        let hiddenVar = _getAttr(model, i, "hidden-when", "s");
        let hiddenWhen = _variantToString(hiddenVar);
        if (hiddenWhen === "action-missing" && actionName) {
            let d = actionName.indexOf(".");
            let nsp = d >= 0 ? actionName.substring(0, d) : null;
            let an = d >= 0 ? actionName.substring(d + 1) : actionName;
            let grp = (nsp && actionGroups[nsp]) || actionGroups["dbusmenu"];
            let gtk = actionGroups && actionGroups._gtk;
            let canDbus = gtk && gtk.busName && (
                (nsp === "win" && gtk.winPath) ||
                (nsp === "app" && gtk.appPath) ||
                (nsp === "unity" && gtk.unityPath)
            );
            if (!canDbus && grp && !grp.has_action(an) && !grp.has_action(actionName))
                continue;
        }

        if (!label && !actionName)
            continue;

        let item = new PopupMenu.PopupMenuItem(label || actionName || "");
        let enabledVar = _getAttr(model, i, "action-enabled", "b");
        if (enabledVar) {
            try {
                item.setSensitive(enabledVar.get_boolean());
            } catch (err) {}
        }

        item.connect("activate", () => {
            try {
                let win = global.display.get_focus_window();
                if (win)
                    Main.activateWindow(win);
            } catch (err) {}
            _activateAction(actionName, targetVar, actionGroups);
        });
        menu.addMenuItem(item);
    }
}

/**
 * Build top-level panel buttons from a root GMenuModel.
 * @returns {{actor: any, menu: any, destroy: Function}[]}
 */
function buildPanelMenus(parentActor, menuManager, orientation, model, actionGroups) {
    let entries = [];
    if (!model)
        return entries;

    let n = model.get_n_items();
    for (let i = 0; i < n; i++) {
        let section = model.get_item_link(i, Gio.MENU_LINK_SECTION);
        if (section) {
            entries = entries.concat(
                buildPanelMenus(parentActor, menuManager, orientation, section, actionGroups)
            );
            continue;
        }

        let submenu = model.get_item_link(i, Gio.MENU_LINK_SUBMENU);
        let labelVar = _getAttr(model, i, Gio.MENU_ATTRIBUTE_LABEL, "s");
        let label = _stripMnemonic(_variantToString(labelVar));
        if (!label)
            continue;

        let button = new St.Button({
            style_class: "applet-box globalmenu-button",
            reactive: true,
            can_focus: true,
            track_hover: true,
            label: label
        });
        button.set_y_align(Clutter.ActorAlign.CENTER);

        let menu = new PopupMenu.PopupMenu(button, orientation);
        Main.uiGroup.add_actor(menu.actor);
        menu.actor.hide();
        menuManager.addMenu(menu);

        try {
            let keys = ["app", "win", "unity", "dbusmenu"];
            for (let k = 0; k < keys.length; k++) {
                if (actionGroups && actionGroups[keys[k]])
                    menu.actor.insert_action_group(keys[k], actionGroups[keys[k]]);
            }
        } catch (err) {}

        if (submenu) {
            let submenuAction = _variantToString(_getAttr(model, i, "submenu-action", "s"));
            _attachLazyGtkSubmenuFill(
                menu, model, i, submenu, actionGroups, label, submenuAction
            );
        } else {
            let actionVar = _getAttr(model, i, Gio.MENU_ATTRIBUTE_ACTION, "s");
            let actionName = _variantToString(actionVar);
            let item = new PopupMenu.PopupMenuItem(label);
            item.connect("activate", () => {
                _activateAction(actionName, null, actionGroups);
            });
            menu.addMenuItem(item);
        }

        button.connect("button-press-event", (actor, event) => {
            if (event.get_button() !== 1)
                return Clutter.EVENT_PROPAGATE;
            menu.toggle();
            return Clutter.EVENT_STOP;
        });

        parentActor.add_actor(button);
        entries.push({
            actor: button,
            menu: menu,
            destroy: () => {
                menuManager.removeMenu(menu);
                menu.destroy();
                button.destroy();
            }
        });
    }

    return entries;
}

function _dbusProp(props, key, fallback) {
    if (!props || props[key] === undefined || props[key] === null)
        return fallback;
    let v = props[key];
    try {
        if (v instanceof GLib.Variant)
            return v.deep_unpack();
    } catch (err) {}
    return v;
}

function fillPopupFromDbusChildren(menu, proxy, children) {
    if (!menu || !children)
        return;
    for (let i = 0; i < children.length; i++) {
        let node = children[i];
        if (!node || node.length < 2)
            continue;
        let id = node[0];
        let props = node[1] || {};
        let kids = node[2] || [];
        if (_dbusProp(props, "visible", true) === false)
            continue;
        let typ = _dbusProp(props, "type", "standard");
        if (typ === "separator") {
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            continue;
        }
        let label = _stripMnemonic(_dbusProp(props, "label", "") || "");
        let childDisp = _dbusProp(props, "children-display", "");
        let enabled = _dbusProp(props, "enabled", true) !== false;

        if (childDisp === "submenu" || (kids && kids.length)) {
            let subItem = new PopupMenu.PopupSubMenuMenuItem(label || " ");
            if (!enabled)
                subItem.setSensitive(false);
            if (kids && kids.length)
                fillPopupFromDbusChildren(subItem.menu, proxy, kids);
            else {
                subItem.menu.connect("open-state-changed", (m, open) => {
                    if (!open)
                        return;
                    m.removeAll();
                    menuSource.fetchDbusMenuLayoutAsync(proxy, id, -1, (layout) => {
                        if (layout && layout.children)
                            fillPopupFromDbusChildren(m, proxy, layout.children);
                    });
                });
            }
            menu.addMenuItem(subItem);
            continue;
        }

        if (!label)
            continue;
        let item = new PopupMenu.PopupMenuItem(label);
        if (!enabled)
            item.setSensitive(false);
        item.connect("activate", () => {
            try {
                let win = global.display.get_focus_window();
                if (win)
                    Main.activateWindow(win);
            } catch (err) {}
            menuSource.dbusMenuEvent(proxy, id);
        });
        menu.addMenuItem(item);
    }
}

/**
 * Build panel menus from com.canonical.dbusmenu GetLayout (async).
 * @param {(entries: {actor: any, menu: any, destroy: Function}[]) => void} onDone
 */
function buildPanelFromDbusmenu(parentActor, menuManager, orientation, proxy, onDone) {
    if (!proxy) {
        onDone([]);
        return;
    }

    menuSource.fetchDbusMenuLayoutAsync(proxy, 0, 1, (layout) => {
        let entries = [];
        if (!layout || !layout.children || !layout.children.length) {
            onDone(entries);
            return;
        }

        for (let i = 0; i < layout.children.length; i++) {
            let node = layout.children[i];
            if (!node || node.length < 2)
                continue;
            let id = node[0];
            let props = node[1] || {};
            if (_dbusProp(props, "visible", true) === false)
                continue;
            if (_dbusProp(props, "type", "standard") === "separator")
                continue;
            let label = _stripMnemonic(_dbusProp(props, "label", "") || "");
            if (!label)
                continue;

            let button = new St.Button({
                style_class: "applet-box globalmenu-button",
                reactive: true,
                can_focus: true,
                track_hover: true,
                label: label
            });
            button.set_y_align(Clutter.ActorAlign.CENTER);

            let menu = new PopupMenu.PopupMenu(button, orientation);
            Main.uiGroup.add_actor(menu.actor);
            menu.actor.hide();
            menuManager.addMenu(menu);

            let itemId = id;
            menu.connect("open-state-changed", (m, open) => {
                if (!open)
                    return;
                m.removeAll();
                menuSource.fetchDbusMenuLayoutAsync(proxy, itemId, -1, (sub) => {
                    if (sub && sub.children)
                        fillPopupFromDbusChildren(m, proxy, sub.children);
                });
            });

            button.connect("button-press-event", (actor, event) => {
                if (event.get_button() !== 1)
                    return Clutter.EVENT_PROPAGATE;
                menu.toggle();
                return Clutter.EVENT_STOP;
            });

            parentActor.add_actor(button);
            entries.push({
                actor: button,
                menu: menu,
                destroy: () => {
                    menuManager.removeMenu(menu);
                    menu.destroy();
                    button.destroy();
                }
            });
        }

        onDone(entries);
    });
}
