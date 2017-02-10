#!/usr/bin/env python

import pygtk
pygtk.require('2.0')
from gi.repository import Gio, Gtk, Gdk, GObject
from gi.repository.GdkPixbuf import Pixbuf
import os
import sys

def copy_image(f):
    assert os.path.exists(f), "File does not exist: %s" % f
    image = Pixbuf.new_from_file(f)

    atom = Gdk.atom_intern('CLIPBOARD', True)
    clipboard = Gtk.Clipboard.get(atom)
    clipboard.set_image(image)
    clipboard.store()
    sys.exit(1)

if len(sys.argv) > 1:
   copy_image(sys.argv[1]);
else:
   print "Argument required: file path to copy to clipboard."
   sys.exit(0)