#!/usr/bin/env python

try:
     import pygtk
     pygtk.require("2.0")
except:
      pass
try:
    import sys
    import string
    import gtk
    import gtk.glade
    import os
    import commands
    import threading
    import tempfile
    import gettext

except Exception, detail:
    print detail
    sys.exit(1)

from subprocess import Popen, PIPE

gtk.gdk.threads_init()

# i18n
gettext.install("mintmenu", "/usr/share/linuxmint/locale")

class RemoveExecuter(threading.Thread):

    def __init__(self, window_id, package):
	threading.Thread.__init__(self)
	self.window_id = window_id
	self.package = package
    
    def execute(self, command):
	#print "Executing: " + command
	os.system(command)
	ret = commands.getoutput("echo $?")
	return ret

    def run(self):	
	removePackages = string.split(self.package)
	cmd = ["sudo", "/usr/sbin/synaptic", "--hide-main-window",  \
	        "--non-interactive", "--parent-window-id", self.window_id]
	cmd.append("--progress-str")
	cmd.append("\"" + _("Please wait, this can take some time") + "\"")
	cmd.append("--finish-str")
	cmd.append("\"" + _("Application removed successfully") + "\"")
	f = tempfile.NamedTemporaryFile()
	for pkg in removePackages:
            f.write("%s\tdeinstall\n" % pkg)
        cmd.append("--set-selections-file")
        cmd.append("%s" % f.name)
        f.flush()
        comnd = Popen(' '.join(cmd), shell=True)
	returnCode = comnd.wait()
	f.close()
	gtk.main_quit()
	sys.exit(0)
		
class mintRemoveWindow:

    def __init__(self, desktopFile):
	self.desktopFile = desktopFile	

        #Set the Glade file
        self.gladefile = "/usr/lib/linuxmint/mintMenu/mintRemove.glade"
        wTree = gtk.glade.XML(self.gladefile,"main_window")
	wTree.get_widget("main_window").set_icon_from_file("/usr/lib/linuxmint/mintMenu/icon.svg")
	wTree.get_widget("main_window").set_title("")
	wTree.get_widget("main_window").connect("destroy", self.giveUp)

	# Get the window socket (needed for synaptic later on)
	vbox = wTree.get_widget("vbox1")
	socket = gtk.Socket()
	vbox.pack_start(socket)
	socket.show()
	window_id = repr(socket.get_id())
        
	
	
	package = commands.getoutput("dpkg -S " + self.desktopFile)
	package = package[:package.find(":")]
	if package == "dpkg":
		warnDlg = gtk.Dialog(title="MintMenu", parent=None, flags=0, buttons=(gtk.STOCK_CANCEL, gtk.RESPONSE_CANCEL))
		warnDlg.add_button(gtk.STOCK_REMOVE, gtk.RESPONSE_OK)
		warnDlg.vbox.set_spacing(10)
		warnDlg.set_icon_from_file("/usr/share/linuxmint/logo.png")
		labelSpc = gtk.Label(" ")
		warnDlg.vbox.pack_start(labelSpc)	
		labelSpc.show()
		warnText = "<b>" + _("No matching package found") + "</b>"
		infoText = _("Do you want to remove this menu entry?") + " (" + self.desktopFile + ")"
		label = gtk.Label(warnText)
		lblInfo = gtk.Label(infoText)
		label.set_use_markup(True)
		lblInfo.set_use_markup(True)
		warnDlg.vbox.pack_start(label)
		warnDlg.vbox.pack_start(lblInfo)
		label.show()
		lblInfo.show()
		response = warnDlg.run()
		if response == gtk.RESPONSE_OK :
			print "removing " + self.desktopFile + "*.desktop"
			os.system("rm -f " + self.desktopFile)
			os.system("rm -f " + self.desktopFile + "*.desktop")
		warnDlg.destroy()
		gtk.main_quit()
		sys.exit(0)		

	wTree.get_widget("txt_name").set_text("<big><b>" + _("Remove %s?") % package + "</b></big>")
	wTree.get_widget("txt_name").set_use_markup(True)
		
	wTree.get_widget("txt_guidance").set_text(_("The following packages will be removed:"))
	
	treeview = wTree.get_widget("tree")
	column1 = gtk.TreeViewColumn(_("Packages to be removed"))
	renderer = gtk.CellRendererText()
	column1.pack_start(renderer, False)
	column1.set_attributes(renderer, text = 0)
	treeview.append_column(column1)

	model = gtk.ListStore(str)
	dependenciesString = commands.getoutput("apt-get -s -q remove " + package + " | grep Remv")
	dependencies = string.split(dependenciesString, "\n")
	for dependency in dependencies:
		dependency = dependency.replace("Remv ", "")
		model.append([dependency])
	treeview.set_model(model)
	treeview.show()		

        dic = {"on_remove_button_clicked" : (self.MainButtonClicked, window_id, package, wTree),
               "on_cancel_button_clicked" : (self.giveUp) }
        wTree.signal_autoconnect(dic)

	wTree.get_widget("main_window").show()


    def MainButtonClicked(self, widget, window_id, package, wTree):
	wTree.get_widget("main_window").window.set_cursor(gtk.gdk.Cursor(gtk.gdk.WATCH))
	wTree.get_widget("main_window").set_sensitive(False)
	executer = RemoveExecuter(window_id, package)
	executer.start()
	return True

    def giveUp(self, widget):
	gtk.main_quit()
	sys.exit(0)

if __name__ == "__main__":
    mainwin = mintRemoveWindow(sys.argv[1])
    gtk.main()
    
