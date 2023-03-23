import sys
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk

clipboard = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
text = clipboard.wait_for_text()
if text == None:
    print("")
else:
	print(text)
sys.exit(0)

