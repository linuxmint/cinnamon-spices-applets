#!/usr/bin/python3
#This is a modified version of /usr/lib/linuxmint/common/mint-remove-application.py it can
#be removed once these changes have been merged into cinnamon.
import gettext
import os
import subprocess
import sys

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk

import mintcommon.aptdaemon

# i18n
gettext.install("Cinnamenu@json", os.environ['HOME'] + "/.local/share/locale")

class MintRemoveWindow:

    def __init__(self, desktopFile):

        #find deb package
        self.desktopFile = desktopFile
        process = subprocess.run(["dpkg", "-S", self.desktopFile], stdout=subprocess.PIPE)
        output = process.stdout.decode("utf-8")
        package = output[:output.find(":")].split(",")[0]

        if process.returncode != 0: #deb package not found, try remove flatpack
            if not self.try_remove_flatpak(desktopFile):
                warnDlg = Gtk.MessageDialog(parent=None,
                                            flags=0,
                                            message_type=Gtk.MessageType.WARNING,
                                            buttons=Gtk.ButtonsType.YES_NO,
                                            text=_("This menu item is not associated to any package. Do you want to remove it from the menu anyway?"))
                warnDlg.set_keep_above(True)

                warnDlg.get_widget_for_response(Gtk.ResponseType.YES).grab_focus()
                warnDlg.vbox.set_spacing(10)
                response = warnDlg.run()
                if response == Gtk.ResponseType.YES:
                    print ("removing '%s'" % self.desktopFile)
                    subprocess.run(["rm", "-f", self.desktopFile])
                    subprocess.run(["rm", "-f", "%s.desktop" % self.desktopFile])
                warnDlg.destroy()

            sys.exit(0)

        #get package + dependents (reverse dependencies)
        rdependencies = subprocess.getoutput("apt-get -s -q remove " + package + " | grep Remv")
        rdependencies = rdependencies.split("\n")

        if len(rdependencies) == 1: #no dependents
            self.remove_dialog(package, rdependencies)
        else:
            self.no_remove_dialog(package, rdependencies)

    def try_remove_flatpak(self, desktopFile):
        if not "flatpak" in desktopFile:
            return False

        if not os.path.exists('/usr/bin/mintinstall-remove-app'):
            return False

        flatpak_remover = subprocess.Popen(['/usr/bin/mintinstall-remove-app', desktopFile])
        retcode = flatpak_remover.wait()

        return retcode == 0

    def remove_dialog(self, package, rdependencies):
        #create dialogue
        warnDlg = Gtk.MessageDialog(parent=None,
                                    flags=0,
                                    message_type=Gtk.MessageType.WARNING,
                                    buttons=Gtk.ButtonsType.OK_CANCEL,
                                    text=_("The following packages will be removed:"))
        warnDlg.set_keep_above(True)

        warnDlg.get_widget_for_response(Gtk.ResponseType.OK).grab_focus()
        warnDlg.vbox.set_spacing(10)

        treeview = Gtk.TreeView()
        column1 = Gtk.TreeViewColumn(_("Packages to be removed"))
        renderer = Gtk.CellRendererText()
        column1.pack_start(renderer, False)
        column1.add_attribute(renderer, "text", 0)
        treeview.append_column(column1)

        packages_to_remove = [package] + self.get_autoremovable_dependencies(package)
        model = Gtk.ListStore(str)
        for item in packages_to_remove:
            model.append([item])

        treeview.set_model(model)
        treeview.show()

        scrolledwindow = Gtk.ScrolledWindow()
        scrolledwindow.set_shadow_type(Gtk.ShadowType.ETCHED_OUT)
        scrolledwindow.set_size_request(150, 150)
        scrolledwindow.add(treeview)
        scrolledwindow.show()

        warnDlg.get_content_area().add(scrolledwindow)

        self.apt = mintcommon.aptdaemon.APT(warnDlg)

        response = warnDlg.run()
        if response == Gtk.ResponseType.OK:
            self.apt.set_finished_callback(self.on_finished)
            self.apt.remove_packages(packages_to_remove)
        elif response == Gtk.ResponseType.CANCEL:
            sys.exit(0)

        warnDlg.destroy()

    def get_autoremovable_dependencies(self, package):
        #Find autoremovable packages before removal of package
        output = subprocess.getoutput("apt-get -s -q autoremove | grep Remv")
        unreq_before = []
        if len(output) > 1:
            output = output.split("\n")
            for line in output:
                line = line.replace("Remv ", "")
                unreq_before.append(line.split()[0])

        #Find autoremovable packages after removal of package
        output = subprocess.getoutput("LC_ALL=C apt-get -s remove " + package)
        unreq_after = []
        begin = output.find("installed and are no longer required:")
        if begin > 0:
            output = output[begin + 37:output.find("Use '")]
            unreq_after = output.split()

        #find autoremovable packages due to removal of package
        additional_unreq = [item for item in unreq_after if item not in unreq_before]

        return additional_unreq

    def no_remove_dialog(self, package, rdependencies):
        warnDlg = Gtk.MessageDialog(parent=None,
                                    flags=0,
                                    message_type=Gtk.MessageType.ERROR,
                                    buttons=Gtk.ButtonsType.CLOSE,
                                    text=_("Cannot remove package %s as it is required by other packages.") % package)
        warnDlg.set_keep_above(True)
        warnDlg.get_widget_for_response(Gtk.ResponseType.CLOSE).grab_focus()
        warnDlg.vbox.set_spacing(10)

        treeview = Gtk.TreeView()
        column1 = Gtk.TreeViewColumn(_("Package %s is a dependency of the following packages:") % package)
        renderer = Gtk.CellRendererText()
        column1.pack_start(renderer, False)
        column1.add_attribute(renderer, "text", 0)
        treeview.append_column(column1)

        model = Gtk.ListStore(str)
        for rdependency in rdependencies:
            rdependency = rdependency.replace("Remv ", "")
            if package != rdependency.split()[0]:
                model.append([rdependency])

        treeview.set_model(model)
        treeview.show()

        scrolledwindow = Gtk.ScrolledWindow()
        scrolledwindow.set_shadow_type(Gtk.ShadowType.ETCHED_OUT)
        scrolledwindow.set_size_request(150, 150)
        scrolledwindow.add(treeview)
        scrolledwindow.show()

        warnDlg.get_content_area().add(scrolledwindow)

        response = warnDlg.run()
        sys.exit(0)

    def on_finished(self, transaction=None, exit_state=None):
        sys.exit(0)

if __name__ == "__main__":

    # Exit if the given path does not exist
    if len(sys.argv) < 2 or not os.path.exists(sys.argv[1]):
        print("No argument or file not found")
        sys.exit(1)

    mainwin = MintRemoveWindow(sys.argv[1])
    Gtk.main()
