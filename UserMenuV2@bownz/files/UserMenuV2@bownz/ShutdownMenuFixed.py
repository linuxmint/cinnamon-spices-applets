#!/usr/bin/env python
from gi.repository import Gtk
import os

class ButtonWindow(Gtk.Window):

    def __init__(self):
        Gtk.Window.__init__(self, title="Shut Down this system?")
	self.set_position(Gtk.WindowPosition.CENTER)
        self.set_border_width(15)
	
        hbox = Gtk.HBox(spacing=10)
        self.add(hbox)

	

        button = Gtk.Button("Suspend")
        button.connect("clicked", self.on_suspend_clicked)
        hbox.pack_start(button, True, True, 0)

        button = Gtk.Button("Hibernate")
        button.connect("clicked", self.on_hibernate_clicked)
        hbox.pack_start(button, True, True, 0)

	button = Gtk.Button("Restart")
        button.connect("clicked", self.on_restart_clicked)
        hbox.pack_start(button, True, True, 0)

        button = Gtk.Button("_Cancel", use_underline=True)
        button.connect("clicked", self.on_close_clicked)
        hbox.pack_start(button, True, True, 0)

	button = Gtk.Button("Shut Down")
        button.connect("clicked", self.on_shutdown_clicked)
        hbox.pack_start(button, True, True, 0)

    def on_shutdown_clicked(self, button):
       os.system("dbus-send --system --print-reply --system --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Stop")

    def on_restart_clicked(self, button):
       os.system("dbus-send --system --print-reply --system --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Restart")

    def on_hibernate_clicked(self, button):
       os.system("dbus-send --print-reply --system --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Suspend")

    def on_suspend_clicked(self, button):
       os.system("dbus-send --print-reply --system --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Suspend")

    def on_close_clicked(self, button):
        Gtk.main_quit()

win = ButtonWindow()
win.connect("delete-event", Gtk.main_quit)
win.show_all()
Gtk.main()

