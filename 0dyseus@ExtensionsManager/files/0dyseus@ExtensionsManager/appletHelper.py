#!/usr/bin/python3

import os
import argparse
import gettext
import gi
import re
import json
import sys
gi.require_version("Gtk", "3.0")
from gi.repository import Gio, Gtk, GLib

home = os.path.expanduser("~")
APPLICATION_ID = "org.cinnamon.applets.odyseus.extensions-manager-debugger"
SETTING_TYPE_NONE = 0
SETTING_TYPE_INTERNAL = 1
SETTING_TYPE_EXTERNAL = 2
curr_ver = GLib.getenv("CINNAMON_VERSION")
debug = False
translations = {}
XLET_DIR = os.path.dirname(os.path.abspath(__file__))
XLET_UUID = str(os.path.basename(XLET_DIR))


def cmp(x, y):
    """
    cmp(x, y) -> integer

    Return negative if x<y, zero if x==y, positive if x>y.
    """
    return (x > y) - (x < y)


def find_extension_subdir(directory):
    largest = [0]
    curr_a = list(map(int, curr_ver.split(".")))

    for subdir in os.listdir(directory):
        if not os.path.isdir(os.path.join(directory, subdir)):
            continue

        if not re.match(r'^[1-9][0-9]*\.[0-9]+(\.[0-9]+)?$', subdir):
            continue

        subdir_a = list(map(int, subdir.split(".")))

        # FIXME: Keeping an eye on this to do it the "Python 3 way" in the future.
        # Re-implementing cmp() will have to do for the moment.
        if cmp(subdir_a, curr_a) <= 0 and cmp(largest, subdir_a) <= 0:
            largest = subdir_a

        if len(largest) == 1:
            return directory
        else:
            return os.path.join(directory, ".".join(list(map(str, largest))))


def _(string):
    return translate(XLET_UUID, string)


def translate(uuid, string):
    if uuid not in translations:
        try:
            translations[uuid] = gettext.translation(uuid, home + "/.local/share/locale").gettext
        except IOError:
            try:
                translations[uuid] = gettext.translation(uuid, "/usr/share/locale").gettext
            except IOError:
                translations[uuid] = None

    # Do not translate white spaces
    if not string.strip():
        return string

    if translations[uuid]:
        result = translations[uuid](string)

        try:
            result = result.decode("UTF-8")
        except:
            result = result

        if result != string:
            return result

    return gettext.gettext(string)


class ExtensionsManager:

    def __init__(self):
        self.settings = Gio.Settings.new("org.cinnamon")
        self.enabled_extensions = self.settings.get_strv("enabled-extensions")
        self.all_extensions = {}

    def list_extensions(self):
        self.load_extensions_in(directory=('/usr/share/cinnamon/extensions'), do_return=False)
        self.load_extensions_in(
            directory=('%s/.local/share/cinnamon/extensions') % (home), do_return=True)

    def load_extensions_in(self, directory=False, do_return=False):
        if not (os.path.exists(directory) and os.path.isdir(directory)):
            return

        try:
            extensions = os.listdir(directory)
            for extension in extensions:
                extension_dir = "%s/%s" % (directory, extension)
                try:
                    if not (os.path.exists("%s/metadata.json" % extension_dir)):
                        continue

                    json_data = open("%s/metadata.json" % extension_dir).read()
                    setting_type = 0
                    data = json.loads(json_data)
                    extension_uuid = data["uuid"]
                    extension_name = translate(data["uuid"], data["name"])
                    extension_description = translate(data["uuid"], data["description"])

                    # Not used for now.
                    # try:
                    #     extension_role = data["role"]
                    # except KeyError:
                    #     extension_role = None
                    # except ValueError:
                    #     extension_role = None

                    try:
                        hide_config_button = data["hide-configuration"]
                    except KeyError:
                        hide_config_button = False
                    except ValueError:
                        hide_config_button = False

                    if "multiversion" in data and data["multiversion"]:
                        extension_dir = str(find_extension_subdir(extension_dir))

                    try:
                        ext_config_app = os.path.join(
                            extension_dir, data["external-configuration-app"])
                        setting_type = SETTING_TYPE_EXTERNAL
                    except KeyError:
                        ext_config_app = ""
                    except ValueError:
                        ext_config_app = ""

                    if os.path.exists("%s/settings-schema.json" % extension_dir):
                        setting_type = SETTING_TYPE_INTERNAL

                    # Not used for now.
                    # try:
                    #     last_edited = data["last-edited"]
                    # except KeyError:
                    #     last_edited = -1
                    # except ValueError:
                    #     last_edited = -1

                    # Not used for now.
                    # try:
                    #     schema_filename = data["schema-file"]
                    # except KeyError:
                    #     schema_filename = ""
                    # except ValueError:
                    #     schema_filename = ""

                    version_supported = False
                    try:
                        version_supported = curr_ver in data["cinnamon-version"] or curr_ver.rsplit(
                            ".", 1)[0] in data["cinnamon-version"]
                    except KeyError:
                        version_supported = True  # Don't check version if not specified.
                    except ValueError:
                        version_supported = True

                    if ext_config_app != "" and not os.path.exists(ext_config_app):
                        ext_config_app = ""

                    extension_image = None
                    if "icon" in data:
                        extension_icon = data["icon"]
                        theme = Gtk.IconTheme.get_default()
                        if theme.has_icon(extension_icon):
                            extension_image = extension_icon
                    elif os.path.exists("%s/icon.png" % extension_dir):
                        try:
                            extension_image = "%s/icon.png" % extension_dir
                        except:
                            extension_image = None

                    if extension_image is None:
                        theme = Gtk.IconTheme.get_default()
                        if theme.has_icon("cs-extensions"):
                            extension_image = "cs-extensions"

                    self.all_extensions[extension_uuid] = {
                        "name": extension_name,
                        "uuid": extension_uuid,
                        "description": extension_description,
                        "image": extension_image,
                        "hide_config_button": hide_config_button,
                        "ext_config_app": ext_config_app,
                        # "schema_filename": schema_filename,  # Not used for now.
                        "setting_type": setting_type,
                        # "last_edited": last_edited,  # Not used for now.
                        "version_supported": version_supported,
                        "extension_dir": extension_dir
                    }
                except Exception as detail:
                    if debug:
                        print("Failed to load extension %s: %s" % (extension, detail))
                    continue
        finally:
            if do_return and not debug:
                print(json.dumps(self.all_extensions))


class InfoLabel(Gtk.Label):

    def __init__(self, text=None, markup=None):
        Gtk.Label.__init__(self)
        if text:
            self.set_label(text)

        if markup:
            self.set_markup(markup)

        self.set_property("xpad", 5)
        self.set_alignment(0.0, 0.5)
        self.set_line_wrap(True)

    def set_label_text(self, text):
        self.set_label(text)

    def set_label_markup(self, markup):
        self.set_markup(markup)


class TerminalWindow(Gtk.ApplicationWindow):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        gi.require_version("Vte", "2.91")
        from gi.repository import Vte

        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_icon_from_file(os.path.join(XLET_DIR, "icon.png"))
        self.set_default_size(640, 400)
        # Vte.Terminal handling based on:
        # http://stackoverflow.com/a/25265794/4147432
        self.terminal = Vte.Terminal()
        self.terminal.spawn_sync(
            Vte.PtyFlags.DEFAULT,  # pty_flags
            XLET_DIR,  # working_directory
            ["/bin/bash"],  # argv
            [],  # envv
            GLib.SpawnFlags.DO_NOT_REAP_CHILD,  # spawn_flags
            None,  # child_setup
            None,  # child_setup_data
            None,  # cancellable
        )

        # Set up a button to click and run the command
        self.button = Gtk.Button("Debug")
        self.command = "echo -e \"$(tput bold)\" ; ./appletHelper.py --debug\n"
        info_label = InfoLabel(markup="<b><i>%s</i></b>" % _(
            "This terminal will list the errors of extensions that couldn't be loaded by Extensions Manager."),)
        self.button.connect("clicked", self.InputToTerm)

        grid = Gtk.Grid(orientation=Gtk.Orientation.VERTICAL)
        grid.attach(self.button, 0, 0, 1, 1)
        grid.attach(info_label, 0, 1, 1, 1)
        scroller = Gtk.ScrolledWindow()
        scroller.set_hexpand(True)
        scroller.set_vexpand(True)
        scroller.add(self.terminal)
        grid.attach(scroller, 0, 2, 1, 1)
        self.add(grid)

    def InputToTerm(self, clicker):
        length = len(self.command)
        self.terminal.feed_child(self.command, length)


class TerminalApplication(Gtk.Application):

    def __init__(self, *args, **kwargs):
        GLib.set_application_name(_("Extensions Manager debugger"))
        super().__init__(*args,
                         application_id=APPLICATION_ID,
                         flags=Gio.ApplicationFlags.FLAGS_NONE,
                         **kwargs)
        self.application = Gtk.Application()
        self.application.connect("activate", self.do_activate)
        self.application.connect("startup", self.do_startup)

    def do_activate(self, data=None):
        self.window.present()

    def do_startup(self, data=None):
        Gtk.Application.do_startup(self)
        self._buildUI()

    def _buildUI(self):
        try:
            self.window = TerminalWindow(
                application=self, title=_("Extensions Manager debugger"))

            self.window.connect("destroy", self.on_quit)
            self.window.show_all()

            self.window.InputToTerm(None)
        except Exception as detail:
            print(detail)

    def on_quit(self, action):
        self.quit()


def main(argv=None):
    parser = argparse.ArgumentParser(description=_(
        "Helper script for Extensions Manager applet for Cinnamon."))
    group = parser.add_mutually_exclusive_group(required=False)
    group.add_argument("--list",
                       dest="list",
                       action="store_true",
                       help=_("Returns a JSON string with a list of all installed extensions."))
    group.add_argument("--debug",
                       dest="debug",
                       action="store_true",
                       help=_("Process all extensions, but it will only display possible errors."))
    group.add_argument("--debug-window",
                       dest="debug_window",
                       action="store_true",
                       help=_("Launch the debug process from a virtual terminal."))

    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(1)

    args = parser.parse_args()
    if args.list:
        ExtensionsManager().list_extensions()
    elif args.debug:
        global debug
        debug = True
        ExtensionsManager().list_extensions()
    elif args.debug_window:
        app = TerminalApplication()
        app.run()


if __name__ == '__main__':
    main()
