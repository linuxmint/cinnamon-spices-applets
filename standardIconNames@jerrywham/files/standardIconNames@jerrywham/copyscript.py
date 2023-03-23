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
try:
    import numpy
except ImportError:
    print("ImportError numpy")
    sys.exit()

def copyText2Clipboard(text):
    # "primary":
    xclip_proc = subprocess.Popen(['xclip', '-selection', 'primary', '-f'], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    xclip_proc.communicate(text.encode())
    # "clipboard":
    xclip_proc = subprocess.Popen(['xclip', '-selection', 'clipboard', '-f'], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    xclip_proc.communicate(text.encode())

copyText2Clipboard(sys.argv[1])
print(sys.argv[1])

sys.exit()