const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const Util = imports.misc.util;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;

Gettext.bindtextdomain('theme-editor@fredcw', GLib.get_home_dir() + '/.local/share/locale');
function _(str) {
    let cinnamonTranslation = Gettext.gettext(str);
    if (cinnamonTranslation !== str) {
        return cinnamonTranslation;
    }
    return Gettext.dgettext('theme-editor@fredcw', str);
}

class ThemeEditorApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_applet_tooltip(_("Cinnamon Theme Editor"));
        this.set_applet_icon_path(__meta.path + '/icon.png');

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        let menuItem = new PopupMenu.PopupMenuItem(_("Open Cinnamon Theme Editor"));
        
        menuItem.connect('activate', () => {
            const scriptName = "theme_editor.py";
            const scriptPath = __meta.path + "/" + scriptName;
            // This returns '0' if found, '1' if not.
            let [success, stdout, stderr, exitStatus] = GLib.spawn_command_line_sync(`pgrep -f ${scriptName}`);

            if (exitStatus === 0) {
                // Script is already running! Show a notification.
                Util.spawnCommandLine(`notify-send "${_("Cinnamon Theme Editor")}" "${_("The editor is already running.")}"`);
            } else {
                let [success, argv] = GLib.shell_parse_argv(scriptPath);
                let [success2, pid] = GLib.spawn_async(__meta.path, argv, null, 0, null);
            }
        });

        this.menu.addMenuItem(menuItem);
    }

    // Open the menu when the applet is clicked
    on_applet_clicked(event) {
        this.menu.toggle();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new ThemeEditorApplet(metadata, orientation, panel_height, instance_id);
}