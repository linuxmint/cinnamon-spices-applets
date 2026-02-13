#Cinnamon Applet: Color-Picker v0.2-Beta
#Release Date: 12 March 2014
#Update: 25 December 2015
#Author: Fatih Mete
#
#          Email: fatihmete@live.com
#
# This program is free software:
#
#    You can redistribute it and/or modify it under the terms of the
#    GNU General Public License as published by the Free Software
#    Foundation, either version 3 of the License, or (at your option)
#    any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see <http:#www.gnu.org/licenses/>.
#
import sys
import subprocess
import time
import gi
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk
try:
    import Xlib
    from Xlib import X
    from Xlib import display
except ImportError:
    print("ImportError Xlib")
    sys.exit()


def getPixelColor(x, y):
  w = Gdk.get_default_root_window()
  scale_factor = w.get_scale_factor()
  pb = Gdk.pixbuf_get_from_window(w, x // scale_factor, y // scale_factor, 1, 1)
  return pb.get_pixels()

def mousePixel():
    data = display.Display().screen().root.query_pointer()._data
    return str(data["root_x"]) + "," + str(data["root_y"])

def getColor(ctype):
    pixel = mousePixel()
    pixel = pixel.split(",")
    color = getPixelColor(int(pixel[0]), int(pixel[1]))
    if ctype == 1:
        color = '#%02x%02x%02x' % (color[0], color[1], color[2])
    elif ctype == 2:
        color = '#%02x%02x%02x' % (color[0], color[1], color[2])
        color = color.upper()
    elif ctype == 3:
        color = str(color[0])+','+ str(color[1])+','+ str(color[2])
    elif ctype == 4:
        color = '('+str(color[0])+','+ str(color[1])+','+ str(color[2])+')'

    return color

def copy2Clipboard(text):
    # "primary":
    xclip_proc = subprocess.Popen(['xclip', '-selection', 'primary', '-f'], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    xclip_proc.communicate(text.encode())
    # "clipboard":
    xclip_proc = subprocess.Popen(['xclip', '-selection', 'clipboard', '-f'], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    xclip_proc.communicate(text.encode())

def waitClick():
    display = Xlib.display.Display()
    root = display.screen().root

    while 1:
        # when grab_pointer fails, e.g. because the mouse button is still pressed (code AlreadyGrabbed), retry
        if root.grab_pointer(1, X.ButtonReleaseMask, X.GrabModeAsync, X.GrabModeAsync, X.NONE, X.NONE, X.CurrentTime) == 0:
            break
        time.sleep(0.05)

    while 1:
        event = root.display.next_event()
        if event.type == X.ButtonRelease:

            if len(sys.argv) == 1:
                color = getColor(1)
            else:
                ctype = sys.argv[1]
                color = getColor(int(ctype))

            copy2Clipboard(color)
            print(color)

            sys.exit()
waitClick()
