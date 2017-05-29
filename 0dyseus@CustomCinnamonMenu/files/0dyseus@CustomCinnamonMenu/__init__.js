const appletUUID = "0dyseus@CustomCinnamonMenu";
const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Gio = imports.gi.Gio;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;
const Tooltips = imports.ui.tooltips;
const Gettext = imports.gettext;
const AccountsService = imports.gi.AccountsService;

Gettext.bindtextdomain(appletUUID, GLib.get_home_dir() + "/.local/share/locale");

/**
 * Used by portOverrides.
 * Revisit in the future.
 */
// const Mainloop = imports.mainloop;
// const GObject = imports.gi.GObject;

function _(aStr) {
    let customTrans = Gettext.dgettext(appletUUID, aStr);

    if (customTrans !== aStr && aStr !== "")
        return customTrans;

    return Gettext.gettext(aStr);
}

const CINNAMON_VERSION = GLib.getenv("CINNAMON_VERSION");
const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();

/**
 * Use this function instead of decodeURIComponent
 */
const escapeUnescapeReplacer = {
    escapeHash: {
        _: function(input) {
            let ret = escapeUnescapeReplacer.escapeHash[input];
            if (!ret) {
                if (input.length - 1) {
                    ret = String.fromCharCode(parseInt(input.substring(input.length - 3 ? 2 : 1), 16));
                } else {
                    let code = input.charCodeAt(0);
                    ret = code < 256 ? "%" + (0 + code.toString(16)).slice(-2).toUpperCase() : "%u" + ("000" + code.toString(16)).slice(-4).toUpperCase();
                }
                escapeUnescapeReplacer.escapeHash[ret] = input;
                escapeUnescapeReplacer.escapeHash[input] = ret;
            }
            return ret;
        }
    },

    escape: function(aStr) {
        return aStr.toString().replace(/[^\w @\*\-\+\.\/]/g, function(aChar) {
            return escapeUnescapeReplacer.escapeHash._(aChar);
        });
    },

    unescape: function(aStr) {
        return aStr.toString().replace(/%(u[\da-f]{4}|[\da-f]{2})/gi, function(aSeq) {
            return escapeUnescapeReplacer.escapeHash._(aSeq);
        });
    }
};

/* Overrides needed for retro-compatibility.
 * Mark for deletion on EOL.
 */
// function portOverrides() {
//     if (!Mainloop.hasOwnProperty("PRIORITY_HIGH"))
//         Mainloop.PRIORITY_HIGH = -100; /* G_PRIORITY_HIGH */

//     if (!Mainloop.hasOwnProperty("PRIORITY_DEFAULT"))
//         Mainloop.PRIORITY_DEFAULT = 0; /* G_PRIORITY_DEFAULT */

//     if (!Mainloop.hasOwnProperty("PRIORITY_HIGH_IDLE"))
//         Mainloop.PRIORITY_HIGH_IDLE = 100; /* etc.. */

//     if (!Mainloop.hasOwnProperty("PRIORITY_DEFAULT_IDLE"))
//         Mainloop.PRIORITY_DEFAULT_IDLE = 200;

//     if (!Mainloop.hasOwnProperty("PRIORITY_LOW"))
//         Mainloop.PRIORITY_LOW = 300;

//     if (!Mainloop.hasOwnProperty("idle_add_full")) {
//         Mainloop.idle_add_full = function(priority, handler) {
//             let s = GLib.idle_source_new();
//             GObject.source_set_closure(s, handler);
//             s.set_priority(priority);
//             return s.attach(null);
//         };
//     }
// }

/* VisibleChildIterator takes a container (boxlayout, etc.)
 * and creates an array of its visible children and their index
 * positions.  We can then work through that list without
 * mucking about with positions and math, just give a
 * child, and it'll give you the next or previous, or first or
 * last child in the list.
 *
 * We could have this object regenerate off a signal
 * every time the visibles have changed in our applicationBox,
 * but we really only need it when we start keyboard
 * navigating, so increase speed, we reload only when we
 * want to use it.
 */

/* Note to myself:
 *     I had problems when inserting anything other than
 *     a PopupSeparatorMenuItem into the menu (keyboard nav. broken).
 *     It took me a sweet load of time figuring out why the malfunction!!! /&·$/&%$&%
 *     For future reference, I could add another condition to
 *     reloadVisible so it can filter other elements.
 */

function VisibleChildIterator(container) {
    this._init(container);
}

VisibleChildIterator.prototype = {
    _init: function(container) {
        this.container = container;
        this.reloadVisible();
    },

    reloadVisible: function() {
        this.array = this.container.get_focus_chain()
            .filter(x => !(x._delegate instanceof PopupMenu.PopupSeparatorMenuItem));
    },

    getNextVisible: function(curChild) {
        return this.getVisibleItem(this.array.indexOf(curChild) + 1);
    },

    getPrevVisible: function(curChild) {
        return this.getVisibleItem(this.array.indexOf(curChild) - 1);
    },

    getFirstVisible: function() {
        return this.array[0];
    },

    getLastVisible: function() {
        return this.array[this.array.length - 1];
    },

    getVisibleIndex: function(curChild) {
        return this.array.indexOf(curChild);
    },

    getVisibleItem: function(index) {
        let len = this.array.length;
        index = ((index % len) + len) % len;
        return this.array[index];
    },

    getNumVisibleChildren: function() {
        return this.array.length;
    },

    getAbsoluteIndexOfChild: function(child) {
        return this.container.get_children().indexOf(child);
    }
};

function ApplicationContextMenuItem(appButton, label, action, aIcon) {
    this._init(appButton, label, action, aIcon);
}

ApplicationContextMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appButton, label, action, aIcon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            focusOnHover: false
        });

        this._appButton = appButton;
        this._action = action;
        this.label = new St.Label({
            text: label
        });

        if (this._appButton.appsMenuButton.pref_show_icons_on_context) {
            this.icon_name = aIcon;
            let icon = new St.Icon({
                icon_name: this.icon_name,
                icon_size: 12,
                icon_type: St.IconType.SYMBOLIC
            });
            this.icon = icon;
            if (this.icon) {
                this.addActor(this.icon);
                this.icon.realize();
            }
        }

        this.addActor(this.label);

        this._tooltip = new CustomTooltip(this.actor, "");
    },

    activate: function(event) { // jshint ignore:line
        let pathToDesktopFile = this._appButton.app.get_app_info().get_filename();
        let likelyHasSucceeded = false;
        let cmd = "";

        switch (this._action) {
            case "add_to_panel":
                if (!Main.AppletManager.get_role_provider_exists(Main.AppletManager.Roles.PANEL_LAUNCHER)) {
                    let new_applet_id = global.settings.get_int("next-applet-id");
                    global.settings.set_int("next-applet-id", (new_applet_id + 1));
                    let enabled_applets = global.settings.get_strv("enabled-applets");
                    enabled_applets.push("panel1:right:0:panel-launchers@cinnamon.org:" + new_applet_id);
                    global.settings.set_strv("enabled-applets", enabled_applets);
                }

                let launcherApplet = Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER);
                launcherApplet.acceptNewLauncher(this._appButton.app.get_id());

                this._appButton.toggleMenu();
                break;
            case "add_to_desktop":
                let file = Gio.file_new_for_path(this._appButton.app.get_app_info().get_filename());
                let destFile = Gio.file_new_for_path(USER_DESKTOP_PATH + "/" + this._appButton.app.get_id());
                try {
                    file.copy(destFile, 0, null, function() {});
                    if (FileUtils.hasOwnProperty("changeModeGFile"))
                        FileUtils.changeModeGFile(destFile, 755);
                    else
                        Util.spawnCommandLine("chmod +x \"" + USER_DESKTOP_PATH + "/" + this._appButton.app.get_id() + "\"");
                } catch (e) {
                    global.log(e);
                }
                this._appButton.toggleMenu();
                break;
            case "add_to_favorites":
                AppFavorites.getAppFavorites().addFavorite(this._appButton.app.get_id());
                this._appButton.toggleMenu();
                break;
            case "remove_from_favorites":
                AppFavorites.getAppFavorites().removeFavorite(this._appButton.app.get_id());
                this._appButton.toggleMenu();
                this._appButton.appsMenuButton._refreshFavs();
                break;
            case "uninstall":
                Util.spawnCommandLine("gksu -m '" +
                    // NOTE: This string could be left blank because it's a default string,
                    // so it's already translated by Cinnamon. It's up to the translators.
                    _("Please provide your password to uninstall this application") +
                    "' /usr/bin/cinnamon-remove-application '" +
                    this._appButton.app.get_app_info().get_filename() + "'");
                this._appButton.appsMenuButton.menu.close(this._appButton.appsMenuButton.pref_animate_menu);
                break;
            case "run_with_nvidia_gpu":
                try {
                    Util.spawnCommandLine("optirun gtk-launch " + this._appButton.app.get_id());
                    likelyHasSucceeded = true;
                } catch (aErr) {
                    global.logError(aErr.message);
                    likelyHasSucceeded = false;
                } finally {
                    if (this._appButton.appsMenuButton.pref_remember_recently_used_apps &&
                        this._appButton instanceof ApplicationButton &&
                        likelyHasSucceeded) {
                        this._appButton.appsMenuButton._storeRecentApp(this._appButton.app.get_id());
                    }
                    this._appButton.appsMenuButton.menu.close(this._appButton.appsMenuButton.pref_animate_menu);
                }
                break;
                /**
                 * START mark Odyseus
                 * Custom context menu actions.
                 */
            case "launch_from_terminal":
            case "launch_from_terminal_as_root":
                let elevated = this._action === "launch_from_terminal_as_root" ?
                    this._appButton.appsMenuButton.pref_privilege_elevator + " " :
                    "";

                /**
                 * Without the run_from_terminal.sh script, I would be forced to use different
                 *  methods to keep the terminal open.
                 * Even so, directly using the gtk-launch command after the -e argument
                 *  works whenever it effing wants!!!
                 * Using the run_from_terminal.sh script, gtk-launch command works 100% of
                 *  the time and, for now, seems to do the trick with all terminals that I tested.
                 * http://askubuntu.com/questions/46627/how-can-i-make-a-script-that-opens-terminal-windows-and-executes-commands-in-the
                 */
                cmd = this._appButton.appsMenuButton.pref_terminal_emulator +
                    " -e \"" + this._appButton.appsMenuButton._runFromTerminalScript + " " +
                    elevated + "gtk-launch " + this._appButton.app.get_id().replace(/.desktop$/g, "") + "\"";

                try {
                    let [success, argv] = GLib.shell_parse_argv(cmd); // jshint ignore:line

                    let flags = GLib.SpawnFlags.SEARCH_PATH;
                    GLib.spawn_async(null, argv, null, flags, null);
                    likelyHasSucceeded = true;
                } catch (aErr) {
                    global.logError(aErr.message);
                    likelyHasSucceeded = false;
                } finally {
                    if (this._appButton.appsMenuButton.pref_remember_recently_used_apps &&
                        this._appButton instanceof ApplicationButton &&
                        likelyHasSucceeded) {
                        this._appButton.appsMenuButton._storeRecentApp(this._appButton.app.get_id());
                    }
                    this._appButton.appsMenuButton.menu.close(this._appButton.appsMenuButton.pref_animate_menu);
                }
                break;
            case "open_desktop_file_folder":
                try {
                    Util.spawn_async(["dirname", pathToDesktopFile],
                        Lang.bind(this, function(aOutput) {
                            let dirPath = aOutput.trim();
                            this._openDesktopFileFolder(dirPath);
                        })
                    );
                } catch (aErr) {
                    Main.notify(_(this._appButton.appsMenuButton.metadata.name), aErr.message);
                    global.logError(aErr.message);
                    this._openDesktopFileFolder("");
                }
                break;
            case "run_as_root":
                try {
                    Util.spawnCommandLine(this._appButton.appsMenuButton.pref_privilege_elevator +
                        " gtk-launch " + this._appButton.app.get_id());
                    likelyHasSucceeded = true;
                } catch (aErr) {
                    Main.notify(_(this._appButton.appsMenuButton.metadata.name), aErr.message);
                    global.logError(aErr.message);
                    likelyHasSucceeded = false;
                } finally {
                    if (this._appButton.appsMenuButton.pref_remember_recently_used_apps &&
                        this._appButton instanceof ApplicationButton &&
                        likelyHasSucceeded) {
                        this._appButton.appsMenuButton._storeRecentApp(this._appButton.app.get_id());
                    }
                    this._appButton.appsMenuButton.menu.close(this._appButton.appsMenuButton.pref_animate_menu);
                }
                break;
            case "open_with_text_editor":
                if (this._appButton.appsMenuButton.pref_gain_privileges_on_context) {
                    try {
                        Util.spawn_async(['stat', '-c', '"%U"', pathToDesktopFile],
                            Lang.bind(this, function(aOutput) {
                                let fileOwner = aOutput.replace(/\s+/g, "")
                                    // If I use the literal double quotes inside the RegEx,
                                    // cinnamon-json-makepot with the --js argument breaks.
                                    // SyntaxError: unterminated string literal
                                    .replace(/\u0022/g, "");
                                this._launchDesktopFile(fileOwner);
                            })
                        );
                    } catch (aErr) {
                        this._launchDesktopFile("");
                        global.logError(aErr.message);
                    }
                } else {
                    this._launchDesktopFile("");
                }
                break;
                /**
                 * END
                 */
        }
        return false;
    },

    _openDesktopFileFolder: function(aDirPath) {
        try {
            if (aDirPath !== "")
                GLib.spawn_command_line_async("xdg-open " + "\"" + aDirPath + "\"");
        } catch (aErr) {
            Main.notify(_(this._appButton.appsMenuButton.metadata.name), aErr.message);
            global.logError(aErr.message);
        } finally {
            this._appButton.appsMenuButton.menu.close(this._appButton.appsMenuButton.pref_animate_menu);
        }
    },

    _launchDesktopFile: function(aCurrentUser, aFileOwner) {
        let cmd = "";
        if (this._appButton.appsMenuButton.pref_gain_privileges_on_context &&
            GLib.get_user_name().toString() !== aFileOwner) {
            cmd += this._appButton.appsMenuButton.pref_privilege_elevator;
        }

        let editor = this._appButton.appsMenuButton.pref_custom_editor_for_edit_desktop_file_on_context;
        if (editor !== "")
            cmd += " " + editor + " " + "\"" + this._appButton.app.get_app_info().get_filename() + "\"";
        else
            cmd += " xdg-open " + "\"" + this._appButton.app.get_app_info().get_filename() + "\"";

        try {
            GLib.spawn_command_line_async(cmd);
        } catch (aErr) {
            Main.notify(_(this._appButton.appsMenuButton.metadata.name), aErr.message);
            global.logError(aErr.message);
        } finally {
            this._appButton.appsMenuButton.menu.close(this._appButton.appsMenuButton.pref_animate_menu);
        }
    }
};

function GenericApplicationButton(appsMenuButton, app, withMenu) {
    this._init(appsMenuButton, app, withMenu);
}

GenericApplicationButton.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(appsMenuButton, app, withMenu) {
        this.app = app;
        this.appsMenuButton = appsMenuButton;
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });

        this.withMenu = withMenu;

        if (this.withMenu) {
            this.menu = new PopupMenu.PopupSubMenu(this.actor);
            this.menu.actor.set_style_class_name('menu-context-menu');
            this.menu.connect('open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
        }
    },

    highlight: function() {
        this.actor.add_style_pseudo_class('highlighted');
    },

    unhighlight: function() {
        let app_key = this.app.get_id();

        if (app_key === null) {
            app_key = this.app.get_name() + ":" + this.app.get_description();
        }

        this.appsMenuButton._knownApps.push(app_key);
        this.actor.remove_style_pseudo_class('highlighted');
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            this.activate(event);
        }
        if (event.get_button() == 3) {
            this.activateContextMenus(event);
        }
        return true;
    },

    activateContextMenus: function(event) { // jshint ignore:line
        if (this.withMenu && !this.menu.isOpen)
            this.appsMenuButton.closeContextMenus(this.app, true);
        this.toggleMenu();
    },

    activate: function(event) { // jshint ignore:line
        this.unhighlight();
        let likelyHasSucceeded = false;

        let ctrlKey = (Clutter.ModifierType.CONTROL_MASK & global.get_pointer()[2]) !== 0;
        let shiftKey = (Clutter.ModifierType.SHIFT_MASK & global.get_pointer()[2]) !== 0;
        // let altKey = (Clutter.ModifierType.MOD1_MASK & global.get_pointer()[2]) !== 0;
        // global.logError("ctrlKey " + ctrlKey);
        // global.logError("shiftKey " + shiftKey);
        // global.logError("altKey " + altKey);

        if (ctrlKey && this.appsMenuButton._terminalReady) {
            try {
                let elevated = shiftKey ?
                    this.appsMenuButton.pref_privilege_elevator + " " :
                    "";

                let cmd = this.appsMenuButton.pref_terminal_emulator +
                    " -e \"" + this.appsMenuButton._runFromTerminalScript + " " +
                    elevated + "gtk-launch " + this.app.get_id().replace(/.desktop$/g, "") + "\"";

                let [success, argv] = GLib.shell_parse_argv(cmd); // jshint ignore:line

                let flags = GLib.SpawnFlags.SEARCH_PATH;
                GLib.spawn_async(null, argv, null, flags, null);
                likelyHasSucceeded = true;
            } catch (aErr) {
                global.logError(aErr.message);
                likelyHasSucceeded = false;
            }
        } else if (shiftKey && !ctrlKey) {
            try {
                Util.spawnCommandLine(this.appsMenuButton.pref_privilege_elevator +
                    " gtk-launch " + this.app.get_id());
                likelyHasSucceeded = true;
            } catch (aErr) {
                Main.notify(_(this._appButton.appsMenuButton.metadata.name), aErr.message);
                global.logError(aErr.message);
                likelyHasSucceeded = false;
            }
        } else {
            this.app.open_new_window(-1);
            likelyHasSucceeded = true;
        }

        this.appsMenuButton.menu.close(this.appsMenuButton.pref_animate_menu);
        if (this.appsMenuButton.pref_remember_recently_used_apps &&
            this instanceof ApplicationButton &&
            likelyHasSucceeded) {
            this.appsMenuButton._storeRecentApp(this.app.get_id());
        }
    },

    closeMenu: function() {
        if (this.withMenu)
            this.menu.close(this.appsMenuButton.pref_animate_menu);
    },

    toggleMenu: function() {
        if (!this.withMenu)
            return;

        if (!this.menu.isOpen) {
            let children = this.menu.box.get_children();
            for (let i in children) {
                this.menu.box.remove_actor(children[i]);
            }
            let menuItem;

            if (this.appsMenuButton.pref_show_add_to_panel_on_context) {
                // NOTE: This string could be left blank because it's a default string,
                // so it's already translated by Cinnamon. It's up to the translators.
                menuItem = new ApplicationContextMenuItem(this,
                    _("Add to panel"),
                    "add_to_panel",
                    "list-add");
                menuItem._tooltip.set_text(_("Add this application to the Panel launchers applet."));
                this.menu.addMenuItem(menuItem);
            }

            if (USER_DESKTOP_PATH && this.appsMenuButton.pref_show_add_to_desktop_on_context) {
                // NOTE: This string could be left blank because it's a default string,
                // so it's already translated by Cinnamon. It's up to the translators.
                menuItem = new ApplicationContextMenuItem(this,
                    _("Add to desktop"),
                    "add_to_desktop",
                    "computer");
                menuItem._tooltip.set_text(_("Add this application to the Desktop."));
                this.menu.addMenuItem(menuItem);
            }

            if (this.appsMenuButton.pref_show_add_remove_favorite_on_context) {
                if (AppFavorites.getAppFavorites().isFavorite(this.app.get_id())) {
                    menuItem = new ApplicationContextMenuItem(this,
                        // NOTE: This string could be left blank because it's a default string,
                        // so it's already translated by Cinnamon. It's up to the translators.
                        _("Remove from favorites"),
                        "remove_from_favorites",
                        "non-starred");
                    menuItem._tooltip.set_text(_("Remove application from your favorites."));
                    this.menu.addMenuItem(menuItem);
                } else {
                    menuItem = new ApplicationContextMenuItem(this,
                        // NOTE: This string could be left blank because it's a default string,
                        // so it's already translated by Cinnamon. It's up to the translators.
                        _("Add to favorites"),
                        "add_to_favorites",
                        "starred");
                    menuItem._tooltip.set_text(_("Add application to your favorites."));
                    this.menu.addMenuItem(menuItem);
                }
            }

            // The preference check is done when _canUninstallApps is defined.
            if (this.appsMenuButton._canUninstallApps) {
                menuItem = new ApplicationContextMenuItem(this,
                    // NOTE: This string could be left blank because it's a default string,
                    // so it's already translated by Cinnamon. It's up to the translators.
                    _("Uninstall"),
                    "uninstall",
                    "edit-delete");
                menuItem._tooltip.set_text(_("Uninstall application from your system."));
                this.menu.addMenuItem(menuItem);
            }

            // The preference check is done when _isBumblebeeInstalled is defined.
            if (this.appsMenuButton._isBumblebeeInstalled) {
                menuItem = new ApplicationContextMenuItem(this,
                    // NOTE: This string could be left blank because it's a default string,
                    // so it's already translated by Cinnamon. It's up to the translators.
                    _("Run with NVIDIA GPU"),
                    "run_with_nvidia_gpu",
                    "custom-entypo-swarm");
                menuItem._tooltip.set_text(_("Run application through optirun command (Bumblebee)."));
                this.menu.addMenuItem(menuItem);
            }

            if (this.appsMenuButton.pref_show_run_as_root_on_context) {
                menuItem = new ApplicationContextMenuItem(this,
                    _("Run as root"),
                    "run_as_root",
                    "system-run");
                menuItem._tooltip.set_text(_("Run application as root."));
                this.menu.addMenuItem(menuItem);
            }

            if (this.appsMenuButton.pref_show_edit_desktop_file_on_context) {
                menuItem = new ApplicationContextMenuItem(this,
                    _("Edit .desktop file"),
                    "open_with_text_editor",
                    "custom-entypo-edit");
                menuItem._tooltip.set_text(_("Edit this application .desktop file with a text editor."));
                this.menu.addMenuItem(menuItem);
            }

            if (this.appsMenuButton.pref_show_desktop_file_folder_on_context) {
                menuItem = new ApplicationContextMenuItem(this,
                    _("Open .desktop file folder"),
                    "open_desktop_file_folder",
                    "folder");
                menuItem._tooltip.set_text(_("Open the folder containg this application .desktop file."));
                this.menu.addMenuItem(menuItem);
            }

            if (this.appsMenuButton.pref_show_run_from_terminal_on_context &&
                this.appsMenuButton._terminalReady) {
                menuItem = new ApplicationContextMenuItem(this,
                    _("Run from terminal"),
                    "launch_from_terminal",
                    "custom-terminal");
                menuItem._tooltip.set_text(_("Run application from a terminal."));
                this.menu.addMenuItem(menuItem);
            }

            if (this.appsMenuButton.pref_show_run_from_terminal_as_root_on_context &&
                this.appsMenuButton._terminalReady) {
                menuItem = new ApplicationContextMenuItem(this,
                    _("Run from terminal as root"),
                    "launch_from_terminal_as_root",
                    "custom-terminal");
                menuItem._tooltip.set_text(_("Run application from a terminal as root."));
                this.menu.addMenuItem(menuItem);
            }
        }
        this.menu.toggle(this.appsMenuButton.pref_animate_menu);
    },

    _subMenuOpenStateChanged: function() {
        if (this.menu.isOpen) {
            this.appsMenuButton._activeContextMenuParent = this;
            this.appsMenuButton._scrollToButton(this.menu);
        } else {
            this.appsMenuButton._activeContextMenuItem = null;
            this.appsMenuButton._activeContextMenuParent = null;
        }
    },

    get _contextIsOpen() {
        return this.menu.isOpen;
    }
};

function TransientButton(appsMenuButton, pathOrCommand) {
    this._init(appsMenuButton, pathOrCommand);
}

TransientButton.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(appsMenuButton, pathOrCommand) {
        let displayPath = pathOrCommand;
        if (pathOrCommand.charAt(0) == '~') {
            pathOrCommand = pathOrCommand.slice(1);
            pathOrCommand = GLib.get_home_dir() + pathOrCommand;
        }

        this.isPath = pathOrCommand.substr(pathOrCommand.length - 1) == '/';
        if (this.isPath) {
            this.path = pathOrCommand;
        } else {
            let n = pathOrCommand.lastIndexOf('/');
            if (n != 1) {
                this.path = pathOrCommand.substr(0, n);
            }
        }

        this.pathOrCommand = pathOrCommand;

        this.appsMenuButton = appsMenuButton;
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });

        // We need this fake app to help appEnterEvent/appLeaveEvent
        // work with our search result.
        this.app = {
            get_app_info: {
                get_filename: function() {
                    return pathOrCommand;
                }
            },
            get_id: function() {
                return -1;
            },
            get_description: function() {
                return this.pathOrCommand;
            },
            get_name: function() {
                return '';
            }
        };

        this.file = Gio.file_new_for_path(this.pathOrCommand);

        try {
            this.handler = this.file.query_default_handler(null);
            let contentType = Gio.content_type_guess(this.pathOrCommand, null);
            let themedIcon = Gio.content_type_get_icon(contentType[0]);
            /**
             * START mark Odyseus
             * Just changed the name of the icon size variable.
             */
            this.icon = new St.Icon({
                gicon: themedIcon,
                icon_size: this.appsMenuButton.pref_application_icon_size,
                icon_type: St.IconType.FULLCOLOR
            });
            this.actor.set_style_class_name('menu-application-button');
        } catch (e) {
            this.handler = null;
            let iconName = this.isPath ? 'folder' : 'unknown';
            /**
             * START mark Odyseus
             * Just changed the name of the icon size variable.
             */
            this.icon = new St.Icon({
                icon_name: iconName,
                icon_size: this.appsMenuButton.pref_application_icon_size,
                icon_type: St.IconType.FULLCOLOR,
            });
            // @todo Would be nice to indicate we don't have a handler for this file.
            this.actor.set_style_class_name('menu-application-button');
        }

        this.addActor(this.icon);

        this.label = new St.Label({
            text: displayPath,
            style_class: 'menu-application-button-label'
        });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.label.set_style(this.appsMenuButton.max_width_for_buttons);
        this.addActor(this.label);
        this.isDraggableApp = false;
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            this.activate(event);
        }
        return true;
    },

    activate: function(event) { // jshint ignore:line
        if (this.handler !== null) {
            this.handler.launch([this.file], null);
        } else {
            // Try anyway, even though we probably shouldn't.
            try {
                Util.spawn(['gvfs-open', this.file.get_uri()]);
            } catch (aErr) {
                global.logError("No handler available to open " + this.file.get_uri());
            }

        }

        this.appsMenuButton.menu.close(this.appsMenuButton.pref_animate_menu);
    }
};

function ApplicationButton(appsMenuButton, app, showIcon) {
    this._init(appsMenuButton, app, showIcon);
}

ApplicationButton.prototype = {
    __proto__: GenericApplicationButton.prototype,

    _init: function(appsMenuButton, app, showIcon) {
        GenericApplicationButton.prototype._init.call(this, appsMenuButton, app, true);
        this.category = [];
        this.appsMenuButton = appsMenuButton;
        this.actor.set_style_class_name('menu-application-button');

        if (showIcon) {
            /**
             * START mark Odyseus
             * Just changed the name of the icons size variable.
             */
            this.icon = this.app.create_icon_texture(this.appsMenuButton.pref_application_icon_size);
            this.addActor(this.icon);
        }

        this.name = this.app.get_name();
        this.label = new St.Label({
            text: this.name,
            style_class: 'menu-application-button-label'
        });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.label.set_style(this.appsMenuButton.max_width_for_buttons);
        this.addActor(this.label);
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));
        this.isDraggableApp = true;
        this.actor.label_actor = this.label;

        if (showIcon) {
            this.icon.realize();
        }

        this.label.realize();

        this.tooltip = new CustomTooltip(this.actor, "");
    },

    get_app_id: function() {
        return this.app.get_id();
    },

    getDragActor: function() {
        let favorites = AppFavorites.getAppFavorites().getFavorites();
        let nbFavorites = favorites.length;
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7 * monitorHeight) / nbFavorites;
        let icon_size = 0.6 * real_size / global.ui_scale;
        /**
         * START mark Odyseus
         * Just changed the name of the icon size variable.
         */
        if (icon_size > this.appsMenuButton.pref_max_fav_icon_size)
            icon_size = this.appsMenuButton.pref_max_fav_icon_size;

        return this.app.create_icon_texture(icon_size);
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    },

    _onDragEnd: function() {
        this.appsMenuButton.favoritesBox._delegate._clearDragPlaceholder();
    }
};

function SearchProviderResultButton(appsMenuButton, provider, result) {
    this._init(appsMenuButton, provider, result);
}

SearchProviderResultButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, provider, result) {
        this.provider = provider;
        this.result = result;

        this.appsMenuButton = appsMenuButton;
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.actor.set_style_class_name('menu-application-button');

        // We need this fake app to help appEnterEvent/appLeaveEvent
        // work with our search result.
        this.app = {
            get_app_info: {
                get_filename: function() {
                    return result.id;
                }
            },
            get_id: function() {
                return -1;
            },
            get_description: function() {
                return result.description;
            },
            get_name: function() {
                return result.label;
            }
        };

        this.icon = null;

        if (result.icon) {
            this.icon = result.icon;
        } else if (result.icon_app) {
            /**
             * START mark Odyseus
             * Just changed the name of the icon size variable.
             */
            this.icon = result.icon_app.create_icon_texture(this.appsMenuButton.pref_application_icon_size);
        } else if (result.icon_filename) {
            /**
             * START mark Odyseus
             * Just changed the name of the icon size variable.
             */
            this.icon = new St.Icon({
                gicon: new Gio.FileIcon({
                    file: Gio.file_new_for_path(result.icon_filename)
                }),
                icon_size: this.appsMenuButton.pref_application_icon_size
            });
        }

        if (this.icon) {
            this.addActor(this.icon);
        }

        this.label = new St.Label({
            text: result.label,
            style_class: 'menu-application-button-label'
        });
        this.addActor(this.label);
        this.isDraggableApp = false;

        if (this.icon) {
            this.icon.realize();
        }

        this.label.realize();
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            this.activate(event);
        }
        return true;
    },

    activate: function(event) { // jshint ignore:line
        try {
            this.provider.on_result_selected(this.result);
            this.appsMenuButton.menu.close(this.appsMenuButton.pref_animate_menu);
        } catch (aErr) {
            global.logError(aErr);
        }
    }
};

function PlaceButton(appsMenuButton, place, button_name, showIcon) {
    this._init(appsMenuButton, place, button_name, showIcon);
}

PlaceButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, place, button_name, showIcon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.appsMenuButton = appsMenuButton;
        this.place = place;
        this.button_name = button_name;
        this.actor.set_style_class_name('menu-application-button');
        this.actor._delegate = this;
        this.label = new St.Label({
            text: this.button_name,
            style_class: 'menu-application-button-label'
        });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.label.set_style(this.appsMenuButton.max_width_for_buttons);

        if (showIcon) {
            /**
             * START mark Odyseus
             * Just changed the name of the icon size variable.
             */
            this.icon = place.iconFactory(this.appsMenuButton.pref_application_icon_size);
            if (!this.icon)
            /**
             * START mark Odyseus
             * Just changed the name of the icon size variable.
             */
                this.icon = new St.Icon({
                icon_name: "folder",
                icon_size: this.appsMenuButton.pref_application_icon_size,
                icon_type: St.IconType.FULLCOLOR
            });
            if (this.icon)
                this.addActor(this.icon);
        }

        this.addActor(this.label);

        if (showIcon)
            this.icon.realize();

        this.label.realize();

        let placeURI = decodeURIComponent(this.place.id);
        placeURI = placeURI.substr(placeURI.indexOf(":") + 1);
        let fileIndex = placeURI.indexOf("file:///");

        if (fileIndex !== -1)
            placeURI = placeURI.substr(fileIndex + 7);

        this.tooltip = new CustomTooltip(this.actor, "");
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            this.place.launch();
            this.appsMenuButton.menu.close(this.appsMenuButton.pref_animate_menu);
        }
    },

    activate: function(event) { // jshint ignore:line
        this.place.launch();
        this.appsMenuButton.menu.close(this.appsMenuButton.pref_animate_menu);
    }
};

function RecentContextMenuItem(recentButton, label, is_default, callback) {
    this._init(recentButton, label, is_default, callback);
}

RecentContextMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(recentButton, label, is_default, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            focusOnHover: false
        });

        this._recentButton = recentButton;
        this._callback = callback;
        this.label = new St.Label({
            text: label
        });
        this.addActor(this.label);

        if (is_default)
            this.label.style = "font-weight: bold;";
    },

    activate: function(event) { // jshint ignore:line
        this._callback();
        return false;
    }
};

function RecentButton(appsMenuButton, file, showIcon) {
    this._init(appsMenuButton, file, showIcon);
}

RecentButton.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(appsMenuButton, file, showIcon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.mimeType = file.mimeType;
        this.uri = file.uri;
        this.button_name = file.name;
        this.appsMenuButton = appsMenuButton;
        this.actor.set_style_class_name('menu-application-button');
        this.actor._delegate = this;
        this.label = new St.Label({
            text: this.button_name,
            style_class: 'menu-application-button-label'
        });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.label.set_style(this.appsMenuButton.max_width_for_buttons);

        if (showIcon) {
            this.icon = file.createIcon(this.appsMenuButton.pref_application_icon_size);
            this.addActor(this.icon);
        }

        this.addActor(this.label);

        if (showIcon)
            this.icon.realize();

        this.label.realize();

        this.menu = new PopupMenu.PopupSubMenu(this.actor);
        this.menu.actor.set_style_class_name('menu-context-menu');
        this.menu.connect('open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));

        this.tooltip = new CustomTooltip(this.actor, "");
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            this.activate(event);
        }

        if (event.get_button() == 3) {
            this.activateContextMenus(event);
        }

        return true;
    },

    activateContextMenus: function(event) { // jshint ignore:line
        if (!this.menu.isOpen)
            this.appsMenuButton.closeContextMenus(this, true);

        this.toggleMenu();
    },

    activate: function(event) { // jshint ignore:line
        Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
        this.appsMenuButton.menu.close(this.appsMenuButton.pref_animate_menu);
    },

    closeMenu: function() {
        this.menu.close(this.appsMenuButton.pref_animate_menu);
    },

    hasLocalPath: function(file) {
        return file.is_native() || file.get_path() !== null;
    },

    toggleMenu: function() {
        if (!this.menu.isOpen) {
            let children = this.menu.box.get_children();
            for (let i in children) {
                this.menu.box.remove_actor(children[i]);
            }
            let menuItem;

            // NOTE: This string could be left blank because it's a default string,
            // so it's already translated by Cinnamon. It's up to the translators.
            menuItem = new PopupMenu.PopupMenuItem(_("Open with"), {
                reactive: false
            });
            menuItem.actor.style = "font-weight: bold";
            this.menu.addMenuItem(menuItem);

            let file = Gio.File.new_for_uri(this.uri);
            let default_info = Gio.AppInfo.get_default_for_type(this.mimeType, !this.hasLocalPath(file));

            if (default_info) {
                menuItem = new RecentContextMenuItem(this,
                    default_info.get_display_name(),
                    false,
                    Lang.bind(this, function() {
                        default_info.launch([file], null, null);
                        this.toggleMenu();
                        this.appsMenuButton.menu.close(this.appsMenuButton.pref_animate_menu);
                    }));
                this.menu.addMenuItem(menuItem);
            }

            let infos = Gio.AppInfo.get_all_for_type(this.mimeType);

            let createRecentContextItem = Lang.bind(this, function(info) {
                return new RecentContextMenuItem(this,
                    info.get_display_name(),
                    false,
                    Lang.bind(this, function() {
                        info.launch([file], null, null);
                        this.toggleMenu();
                        this.appsMenuButton.menu.close(this.appsMenuButton.pref_animate_menu);
                    }));
            });

            let i = 0,
                iLen = infos.length;
            for (; i < iLen; i++) {
                let info = infos[i];

                file = Gio.File.new_for_uri(this.uri);

                if (!this.hasLocalPath(file) && !info.supports_uris())
                    continue;

                if (info.equal(default_info))
                    continue;

                let menuItem = createRecentContextItem(info);
                this.menu.addMenuItem(menuItem);
            }

            if (GLib.find_program_in_path("nemo-open-with") !== null) {
                menuItem = new RecentContextMenuItem(this,
                    // NOTE: This string could be left blank because it's a default string,
                    // so it's already translated by Cinnamon. It's up to the translators.
                    _("Other application..."),
                    false,
                    Lang.bind(this, function() {
                        Util.spawnCommandLine("nemo-open-with " + this.uri);
                        this.toggleMenu();
                        this.appsMenuButton.menu.close(this.appsMenuButton.pref_animate_menu);
                    }));
                this.menu.addMenuItem(menuItem);
            }
        }
        this.menu.toggle(this.appsMenuButton.pref_animate_menu);
    },

    _subMenuOpenStateChanged: function() {
        if (this.menu.isOpen) {
            this.appsMenuButton._activeContextMenuParent = this;
            this.appsMenuButton._scrollToButton(this.menu);
        } else {
            this.appsMenuButton._activeContextMenuItem = null;
            this.appsMenuButton._activeContextMenuParent = null;
        }
    },

    get _contextIsOpen() {
        return this.menu.isOpen;
    }
};

function GenericButton(appsMenuButton, label, icon, reactive, callback) {
    this._init(appsMenuButton, label, icon, reactive, callback);
}

GenericButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, label, icon, reactive, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.appsMenuButton = appsMenuButton;
        this.actor.set_style_class_name('menu-application-button');
        this.actor._delegate = this;
        this.button_name = "";

        this.label = new St.Label({
            text: label,
            style_class: 'menu-application-button-label'
        });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.label.set_style(this.appsMenuButton.max_width_for_buttons);

        if (icon !== null) {
            /**
             * START mark Odyseus
             * Just changed the name of the icon size variable.
             */
            let icon_actor = new St.Icon({
                icon_name: icon,
                icon_type: St.IconType.FULLCOLOR,
                icon_size: this.appsMenuButton.pref_application_icon_size
            });
            this.addActor(icon_actor);
        }

        this.addActor(this.label);
        this.label.realize();

        this.actor.reactive = reactive;
        this.callback = callback;

        this.menu = new PopupMenu.PopupSubMenu(this.actor);
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            this.callback();
        }
    }
};

function RecentClearButton(appsMenuButton) {
    this._init(appsMenuButton);
}

RecentClearButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.appsMenuButton = appsMenuButton;
        this.actor.set_style_class_name('menu-application-button');
        // NOTE: This string could be left blank because it's a default string,
        // so it's already translated by Cinnamon. It's up to the translators.
        this.button_name = _("Clear list");
        this.actor._delegate = this;
        this.label = new St.Label({
            text: this.button_name,
            style_class: 'menu-application-button-label'
        });
        /**
         * START mark Odyseus
         * Just changed the name of the icon size variable.
         */
        this.icon = new St.Icon({
            icon_name: 'edit-clear',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: this.appsMenuButton.pref_application_icon_size
        });
        this.addActor(this.icon);
        this.addActor(this.label);

        this.menu = new PopupMenu.PopupSubMenu(this.actor);
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1)
            this.activate(event);
    },

    activate: function(event) { // jshint ignore:line
        this.appsMenuButton.menu.close(this.appsMenuButton.pref_animate_menu);
        let GtkRecent = new Gtk.RecentManager();
        GtkRecent.purge_items();
    }
};

/**
 * This is a "clone" of RecentClearButton.
 */
function RecentAppsClearButton(appsMenuButton) {
    this._init(appsMenuButton);
}

RecentAppsClearButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.appsMenuButton = appsMenuButton;
        this.actor.set_style_class_name('menu-application-button');
        // NOTE: This string could be left blank because it's a default string,
        // so it's already translated by Cinnamon. It's up to the translators.
        this.button_name = _("Clear list");
        this.actor._delegate = this;
        this.label = new St.Label({
            text: this.button_name,
            style_class: 'menu-application-button-label'
        });
        /**
         * START mark Odyseus
         * Just changed the name of the icon size variable.
         */
        this.icon = new St.Icon({
            icon_name: 'edit-clear',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: this.appsMenuButton.pref_application_icon_size
        });
        this.addActor(this.icon);
        this.addActor(this.label);

        this.menu = new PopupMenu.PopupSubMenu(this.actor);
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1)
            this.activate(event);
    },

    activate: function(event) { // jshint ignore:line
        this.appsMenuButton.menu.close(this.appsMenuButton.pref_animate_menu);
        this.appsMenuButton.pref_recently_used_apps = [];
        this.appsMenuButton._refreshRecentApps();
    }
};

function CategoryButton(appsMenuButton, app, showIcon) {
    this._init(appsMenuButton, app, showIcon);
}

CategoryButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, category, showIcon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });

        this.appsMenuButton = appsMenuButton;
        this.actor.set_style_class_name('menu-category-button');
        let label;
        let icon = null;

        if (category) {
            if (showIcon) {
                /**
                 * START mark Odyseus
                 */
                if (category.get_menu_id() === "favorites" ||
                    category.get_menu_id() === "recentApps") {
                    this.icon_name = category.get_icon();
                    icon = new St.Icon({
                        icon_name: this.icon_name,
                        icon_size: this.appsMenuButton.pref_category_icon_size,
                        icon_type: St.IconType.FULLCOLOR
                    });
                } else {
                    /**
                     * END
                     */
                    icon = category.get_icon();
                    if (icon && icon.get_names)
                        this.icon_name = icon.get_names().toString();
                    else
                        this.icon_name = "";
                }
            } else {
                this.icon_name = "";
            }

            label = category.get_name();
        } else
        // NOTE: This string could be left blank because it's a default string,
        // so it's already translated by Cinnamon. It's up to the translators.
            label = _("All Applications");

        this.actor._delegate = this;
        this.label = new St.Label({
            text: label,
            style_class: 'menu-category-button-label'
        });
        if (category && this.icon_name) {
            /**
             * START mark Odyseus
             */
            if (category.get_menu_id() === "favorites" ||
                category.get_menu_id() === "recentApps") {
                this.icon = icon;
            } else {
                this.icon = St.TextureCache.get_default()
                    .load_gicon(null, icon, (this.appsMenuButton.pref_category_icon_size));
            }
            /**
             * END
             */
            if (this.icon) {
                this.addActor(this.icon);
                this.icon.realize();
            }
        }
        this.actor.accessible_role = Atk.Role.LIST_ITEM;
        this.addActor(this.label);
        this.label.realize();
    }
};

function PlaceCategoryButton(appsMenuButton, app, showIcon) {
    this._init(appsMenuButton, app, showIcon);
}

PlaceCategoryButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, category, showIcon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.appsMenuButton = appsMenuButton;
        this.actor.set_style_class_name('menu-category-button');
        this.actor._delegate = this;
        this.label = new St.Label({
            // NOTE: This string could be left blank because it's a default string,
            // so it's already translated by Cinnamon. It's up to the translators.
            text: _("Places"),
            style_class: 'menu-category-button-label'
        });

        if (showIcon) {
            /**
             * START mark Odyseus
             * Just changed the name of the icon size variable.
             */
            this.icon = new St.Icon({
                icon_name: "folder",
                icon_size: this.appsMenuButton.pref_category_icon_size,
                icon_type: St.IconType.FULLCOLOR
            });
            this.addActor(this.icon);
            this.icon.realize();
        } else {
            this.icon = null;
        }

        this.addActor(this.label);
        this.label.realize();
    }
};

function RecentCategoryButton(appsMenuButton, app, showIcon) {
    this._init(appsMenuButton, app, showIcon);
}

RecentCategoryButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, category, showIcon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.appsMenuButton = appsMenuButton;
        this.actor.set_style_class_name('menu-category-button');
        this.actor._delegate = this;
        this.label = new St.Label({
            // NOTE: This string could be left blank because it's a default string,
            // so it's already translated by Cinnamon. It's up to the translators.
            text: _("Recent Files"),
            style_class: 'menu-category-button-label'
        });

        if (showIcon) {
            /**
             * START mark Odyseus
             * Just changed the name of the icon size variable.
             */
            this.icon = new St.Icon({
                icon_name: "folder-recent",
                icon_size: this.appsMenuButton.pref_category_icon_size,
                icon_type: St.IconType.FULLCOLOR
            });
            this.addActor(this.icon);
            this.icon.realize();
        } else {
            this.icon = null;
        }

        this.addActor(this.label);
        this.label.realize();
    }
};

function FavoritesButton(appsMenuButton, app, nbFavorites) {
    this._init(appsMenuButton, app, nbFavorites);
}

FavoritesButton.prototype = {
    __proto__: GenericApplicationButton.prototype,

    _init: function(appsMenuButton, app, nbFavorites) {
        GenericApplicationButton.prototype._init.call(this, appsMenuButton, app);
        this.appsMenuButton = appsMenuButton;
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7 * monitorHeight) / nbFavorites;
        let icon_size = 0.6 * real_size / global.ui_scale;
        /**
         * START mark Odyseus
         * Just changed the name of the icon size variable.
         */
        if (icon_size > this.appsMenuButton.pref_max_fav_icon_size)
            icon_size = this.appsMenuButton.pref_max_fav_icon_size;

        this.actor.style = "padding-top: " + (icon_size / 3) + "px;padding-bottom: " +
            (icon_size / 3) + "px";

        this.actor.add_style_class_name('menu-favorites-button');
        let icon = app.create_icon_texture(icon_size);

        this.addActor(icon);
        icon.realize();

        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));
        this.isDraggableApp = true;

        this.tooltip = new CustomTooltip(this.actor, "");
    },

    _onDragEnd: function() {
        this.actor.get_parent()._delegate._clearDragPlaceholder();
    },

    get_app_id: function() {
        return this.app.get_id();
    },

    getDragActor: function() {
        return new Clutter.Clone({
            source: this.actor
        });
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    }
};

function SystemButton(appsMenuButton, icon, nbFavorites, name, desc) {
    this._init(appsMenuButton, icon, nbFavorites, name, desc);
}

SystemButton.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(appsMenuButton, icon, nbFavorites, name, desc) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.appsMenuButton = appsMenuButton;
        this.name = name;
        this.desc = desc;

        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7 * monitorHeight) / nbFavorites;
        let icon_size = 0.6 * real_size / global.ui_scale;
        /**
         * START mark Odyseus
         * Just changed the name of the icon size variable.
         */
        if (icon_size > this.appsMenuButton.pref_max_fav_icon_size)
            icon_size = this.appsMenuButton.pref_max_fav_icon_size;

        this.actor.style = "padding-top: " + (icon_size / 3) + "px;padding-bottom: " + (icon_size / 3) + "px;";
        this.actor.add_style_class_name('menu-favorites-button');

        let iconObj = new St.Icon({
            icon_name: icon,
            icon_size: icon_size,
            icon_type: St.IconType.FULLCOLOR
        });
        this.addActor(iconObj);
        iconObj.realize();
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            this.activate();
        }
    }
};

function CategoriesApplicationsBox() {
    this._init();
}

CategoriesApplicationsBox.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout();
        this.actor._delegate = this;
    },

    acceptDrop: function(source, actor, x, y, time) { // jshint ignore:line
        if (source instanceof FavoritesButton) {
            source.actor.destroy();
            actor.destroy();
            AppFavorites.getAppFavorites().removeFavorite(source.app.get_id());
            return true;
        }
        return false;
    }
};

function FavoritesBox() {
    this._init();
}

FavoritesBox.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout({
            vertical: true
        });
        this.actor._delegate = this;

        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;
    },

    _clearDragPlaceholder: function() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    },

    handleDragOver: function(source, actor, x, y, time) { // jshint ignore:line
        let app = source.app;

        let favorites = AppFavorites.getAppFavorites().getFavorites();
        let numFavorites = favorites.length;

        let favPos = favorites.indexOf(app);

        let children = this.actor.get_children();
        let numChildren = children.length;
        let boxHeight = this.actor.height;

        // Keep the placeholder out of the index calculation; assuming that
        // the remove target has the same size as "normal" items, we don't
        // need to do the same adjustment there.
        if (this._dragPlaceholder) {
            boxHeight -= this._dragPlaceholder.actor.height;
            numChildren--;
        }

        let pos = Math.round(y * numChildren / boxHeight);

        if (pos != this._dragPlaceholderPos && pos <= numFavorites) {
            if (this._animatingPlaceholdersCount > 0) {
                let appChildren = children.filter(function(actor) {
                    return (actor._delegate instanceof FavoritesButton);
                });
                this._dragPlaceholderPos = children.indexOf(appChildren[pos]);
            } else {
                this._dragPlaceholderPos = pos;
            }

            // Don't allow positioning before or after self
            if (favPos != -1 && (pos == favPos || pos == favPos + 1)) {
                if (this._dragPlaceholder) {
                    this._dragPlaceholder.animateOutAndDestroy();
                    this._animatingPlaceholdersCount++;
                    this._dragPlaceholder.actor.connect('destroy',
                        Lang.bind(this, function() {
                            this._animatingPlaceholdersCount--;
                        }));
                }
                this._dragPlaceholder = null;

                return DND.DragMotionResult.CONTINUE;
            }

            // If the placeholder already exists, we just move
            // it, but if we are adding it, expand its size in
            // an animation
            let fadeIn;
            if (this._dragPlaceholder) {
                this._dragPlaceholder.actor.destroy();
                fadeIn = false;
            } else {
                fadeIn = true;
            }

            this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this._dragPlaceholder.child.set_width(source.actor.height);
            this._dragPlaceholder.child.set_height(source.actor.height);
            this.actor.insert_child_at_index(this._dragPlaceholder.actor,
                this._dragPlaceholderPos);
            if (fadeIn)
                this._dragPlaceholder.animateIn();
        }

        return DND.DragMotionResult.MOVE_DROP;
    },

    // Draggable target interface
    acceptDrop: function(source, actor, x, y, time) { // jshint ignore:line
        let app = source.app;

        let id = app.get_id();

        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        let srcIsFavorite = (id in favorites);

        let favPos = 0;
        let children = this.actor.get_children();
        let i = 0,
            iLen = this._dragPlaceholderPos;
        for (; i < iLen; i++) {
            if (this._dragPlaceholder &&
                children[i] == this._dragPlaceholder.actor)
                continue;

            if (!(children[i]._delegate instanceof FavoritesButton))
                continue;

            let childId = children[i]._delegate.app.get_id();

            if (childId == id)
                continue;

            if (childId in favorites)
                favPos++;
        }

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this,
            function() {
                let appFavorites = AppFavorites.getAppFavorites();

                if (srcIsFavorite)
                    appFavorites.moveFavoriteToPos(id, favPos);
                else
                    appFavorites.addFavoriteAtPos(id, favPos);

                return false;
            }));

        return true;
    }
};

/**
 * START mark Odyseus
 */
function MyCustomCommandButton(appsMenuButton, app, aCallback, aCustomIconSize) {
    this._init(appsMenuButton, app, aCallback, aCustomIconSize);
}

MyCustomCommandButton.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(appsMenuButton, app, aCallback, aCustomIconSize) {
        this.app = app;
        this.appsMenuButton = appsMenuButton;
        this.callback = aCallback;
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.actor.set_style_class_name('menu-application-button');

        let icon_type = (this.app.icon.search("-symbolic") !== -1) ? 0 : 1;
        let iconObj = {
            icon_size: (aCustomIconSize ?
                aCustomIconSize :
                this.appsMenuButton.pref_custom_command_icon_size),
            icon_type: icon_type,
            style_class: "customcommand-button-icon",
        };

        if (this.app.icon.indexOf("/") !== -1)
            iconObj["gicon"] = new Gio.FileIcon({
                file: Gio.file_new_for_path(this.app.icon)
            });
        else
            iconObj["icon_name"] = this.app.icon;

        this.icon = new St.Icon(iconObj);
        this.addActor(this.icon);

        this.name = this.app.label;
        this.isDraggableApp = false;

        this.tooltip = new CustomTooltip(this.actor, "");
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            this.activate(event);
        }
        return true;
    },

    activate: function(event) { // jshint ignore:line
        if (this.callback) {
            this.callback();
        } else {
            let cmd = this.app.command;
            try { // Try to execute
                GLib.spawn_command_line_async(cmd);
            } catch (aErr1) {
                try {
                    if (cmd.indexOf("/") !== -1) // Try to open file if cmd is a path
                        Main.Util.spawnCommandLine("xdg-open " + "\"" + cmd + "\"");
                } catch (aErr2) {
                    Main.notify(_(this._appButton.appsMenuButton.metadata.name), aErr2.message);
                }
            }
        }
        this.actor.set_style_class_name('menu-application-button');
        this.appsMenuButton.menu.close(this.appsMenuButton.pref_animate_menu);
    }
};

function RecentAppsCategoryButton(appsMenuButton, app, showIcon) {
    this._init(appsMenuButton, app, showIcon);
}

RecentAppsCategoryButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, category, showIcon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.appsMenuButton = appsMenuButton;
        this.actor.set_style_class_name('menu-category-button');
        this.actor._delegate = this;
        this.label = new St.Label({
            text: _("Recent Applications"),
            style_class: 'menu-category-button-label'
        });

        if (showIcon) {
            this.icon = new St.Icon({
                icon_name: this.appsMenuButton.pref_recently_used_apps_custom_icon,
                icon_size: this.appsMenuButton.pref_category_icon_size,
                icon_type: St.IconType.FULLCOLOR
            });
            this.addActor(this.icon);
            this.icon.realize();
        } else {
            this.icon = null;
        }

        this.addActor(this.label);
        this.label.realize();
    }
};

function UserPicture(appsMenuButton, iconSize) {
    this._init(appsMenuButton, iconSize);
}

UserPicture.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(appsMenuButton, iconSize) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false,
            focusOnHover: false
        });
        try {
            this.appsMenuButton = appsMenuButton;
            this.iconSize = iconSize;

            this.container = new St.BoxLayout({
                vertical: false
            });
            this.container.add_actor(this.actor);

            if (this.appsMenuButton.pref_user_picture_stylized) {
                this.container.set_style_class_name('menu-favorites-box');
                this.container.add_style_class_name('menu-hover-icon-box');
            }

            this.actor.set_height(this.iconSize);
            this._userIcon = new St.Icon({
                icon_size: this.iconSize
            });
            this.icon = new St.Icon({
                icon_size: this.iconSize,
                icon_type: St.IconType.FULLCOLOR
            });

            this._user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
            this._userLoadedId = this._user.connect('notify::is_loaded',
                Lang.bind(this, this._onUserChanged));
            this._userChangedId = this._user.connect('changed',
                Lang.bind(this, this._onUserChanged));

            this._onUserChanged();
            this.refreshFace();
            this.actor.style = "padding:0;";

            // NOTE: This string could be left blank because it's a default string,
            // so it's already translated by Cinnamon. It's up to the translators.
            this.tooltip = new CustomTooltip(this.actor, _("Account details"));
        } catch (aErr) {
            global.logError(aErr.message);
        }
    },

    destroy: function() {
        PopupMenu.PopupSubMenuMenuItem.prototype.destroy.call(this);
        this.container.destroy();
    },

    setIconSize: function(iconSize) {
        this.iconSize = iconSize;
        if (this._userIcon)
            this._userIcon.set_icon_size(this.iconSize);

        if (this.icon)
            this.icon.set_icon_size(this.iconSize);

        if (this.lastApp)
            this.lastApp.set_icon_size(this.iconSize);

        this.actor.set_height(this.iconSize);
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            this.activate(event);
        }
        return true;
    },

    activate: function(event) { // jshint ignore:line
        this.appsMenuButton.menu.close(false);
        Util.spawnCommandLine("cinnamon-settings user");
    },

    _onUserChanged: function() {
        if (this._user.is_loaded && this._userIcon) {
            let iconFileName = this._user.get_icon_file();
            let iconFile = Gio.file_new_for_path(iconFileName);
            let icon;

            if (iconFile.query_exists(null)) {
                icon = new Gio.FileIcon({
                    file: iconFile
                });
            } else {
                icon = new Gio.ThemedIcon({
                    name: 'avatar-default'
                });
            }

            this._userIcon.set_gicon(icon);
            this._userIcon.show();
        }
    },

    refresh: function(icon) {
        if (this.actor.visible) {
            if (icon && this.icon) {
                this._removeIcon();
                this.icon.set_icon_name(icon);
                this.addActor(this.icon, 0);
            } else {
                this.refreshFace();
            }
        }
    },

    refreshApp: function(app) {
        if (this.actor.visible) {
            this._removeIcon();
            this.lastApp = app.create_icon_texture(this.iconSize);

            if (this.lastApp) {
                this.addActor(this.lastApp, 0);
            }
        }
    },

    refreshPlace: function(place) {
        if (this.actor.visible) {
            this._removeIcon();
            this.lastApp = place.iconFactory(this.iconSize);

            if (this.lastApp) {
                this.addActor(this.lastApp, 0);
            }
        }
    },

    _tryToGetValidIcon: function(aArr) {
        let i = 0,
            iLen = aArr.length;
        for (; i < iLen; i++) {
            if (Gtk.IconTheme.get_default().has_icon(aArr[i]))
                return aArr[i].toString();
        }
        return "bookmark-missing";
    },

    refreshFile: function(file) {
        if (this.actor.visible) {
            this._removeIcon();
            // The following annoyance caused by the recent files object removal. Holly $%&¬½
            try {
                let contentType = Gio.content_type_guess(file.get_path(), null);
                let icon = Gio.content_type_get_icon(contentType[0]);
                let iconName = this._tryToGetValidIcon(icon.get_names());

                if (iconName)
                    this.refresh(iconName);
                else
                    this.refresh("bookmark-missing");
            } catch (aErr) {
                global.logError(aErr);
            }
        }
    },

    refreshFace: function() {
        if (this.actor.visible) {
            this._removeIcon();

            if (this._userIcon) {
                this.addActor(this._userIcon, 0);
            }
        }
    },

    _removeIcon: function() {
        if (this.lastApp) {
            this.removeActor(this.lastApp);
            this.lastApp.destroy();
            this.lastApp = null;
        }

        if (this.icon && this.icon.get_parent() == this.actor)
            this.removeActor(this.icon);

        if ((this._userIcon) && (this._userIcon.get_parent() == this.actor))
            this.removeActor(this._userIcon);
    }
};

function CustomTooltip() {
    this._init.apply(this, arguments);
}

CustomTooltip.prototype = {
    __proto__: Tooltips.Tooltip.prototype,

    _init: function(aActor, aText) {
        Tooltips.Tooltip.prototype._init.call(this, aActor, aText);

        this._tooltip.set_style("text-align: left;width:auto;max-width: 450px;");
        this._tooltip.get_clutter_text().set_line_wrap(true);
        this._tooltip.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this._tooltip.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE; // Just in case

        aActor.connect("destroy", Lang.bind(this, function() {
            this.destroy();
        }));
    },

    destroy: function() {
        Tooltips.Tooltip.prototype.destroy.call(this);
    }
};

/**
 * Compares two software version numbers (e.g. "1.7.1" or "1.2b").
 *
 * This function was born in http://stackoverflow.com/a/6832721.
 *
 * @param {string} v1 The first version to be compared.
 * @param {string} v2 The second version to be compared.
 * @param {object} [options] Optional flags that affect comparison behavior:
 * <ul>
 *     <li>
 *         <tt>lexicographical: true</tt> compares each part of the version strings lexicographically instead of
 *         naturally; this allows suffixes such as "b" or "dev" but will cause "1.10" to be considered smaller than
 *         "1.2".
 *     </li>
 *     <li>
 *         <tt>zeroExtend: true</tt> changes the result if one version string has less parts than the other. In
 *         this case the shorter string will be padded with "zero" parts instead of being considered smaller.
 *     </li>
 * </ul>
 * @returns {number|NaN}
 * <ul>
 *    <li>0 if the versions are equal</li>
 *    <li>a negative integer iff v1 < v2</li>
 *    <li>a positive integer iff v1 > v2</li>
 *    <li>NaN if either version string is in the wrong format</li>
 * </ul>
 *
 * @copyright by Jon Papaioannou (["john", "papaioannou"].join(".") + "@gmail.com")
 * @license This function is in the public domain. Do what you want with it, no strings attached.
 */
function versionCompare(v1, v2, options) {
    let lexicographical = options && options.lexicographical,
        zeroExtend = options && options.zeroExtend,
        v1parts = v1.split('.'),
        v2parts = v2.split('.');

    function isValidPart(x) {
        return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
    }

    if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
        return NaN;
    }

    if (zeroExtend) {
        while (v1parts.length < v2parts.length) v1parts.push("0");
        while (v2parts.length < v1parts.length) v2parts.push("0");
    }

    if (!lexicographical) {
        v1parts = v1parts.map(Number);
        v2parts = v2parts.map(Number);
    }

    for (let i = 0; i < v1parts.length; ++i) {
        if (v2parts.length == i) {
            return 1;
        }

        if (v1parts[i] == v2parts[i]) {
            continue;
        } else if (v1parts[i] > v2parts[i]) {
            return 1;
        } else {
            return -1;
        }
    }

    if (v1parts.length != v2parts.length) {
        return -1;
    }

    return 0;
}

/*
exported CINNAMON_VERSION,
         versionCompare
 */
