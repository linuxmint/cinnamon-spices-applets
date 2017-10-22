import sys
from gi.repository import Gtk, Gdk

clipboard = Gtk.Clipboard.get(Gdk.SELECTION_PRIMARY)
text = clipboard.wait_for_text()
if text == None:
    print ""
else:
	print text
sys.exit(0)



