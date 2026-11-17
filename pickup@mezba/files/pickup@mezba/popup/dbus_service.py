# -*- coding: utf-8 -*-
"""D-Bus plumbing shared by the applet and the popup.

Communication model (deliberately the simplest reliable thing that works):

    applet  --Toggle()-->  popup        the *only* call the applet ever makes;
                                        the popup answers by closing itself
    popup   --StateChanged(s)-->  applet  pushed whenever the shelf changes

Why D-Bus on the *session* bus instead of a unix socket:
  * GJS can call it with Gio.DBusProxy in ~20 lines and no line-protocol code.
  * The bus handles "is the popup already running?" for us: the popup owns
    org.pickup.Popup, so a second launch fails to acquire the name. The popup
    then forwards the existing instance instead of starting a duplicate.
  * Signals give the applet its badge count without polling, and the applet
    stays completely idle when the popup is not running.

The applet subscribes to StateChanged by bus name, so it keeps working across
popup restarts. It reads state.json exactly once at load to seed the count.
"""

BUS_NAME = "org.pickup.Popup"
OBJECT_PATH = "/org/pickup/Popup"
INTERFACE = "org.pickup.Popup"

XML = """
<node>
  <interface name="org.pickup.Popup">
    <!-- Called by the applet on left click. Takes no arguments: arguments are
         what would force the applet to parse the state file. -->
    <method name="Toggle"/>
    <!-- Called once when an applet instance loads so the badge is correct
         before the popup is ever opened. -->
    <method name="Show"/>
    <method name="Quit"/>
    <!-- Item count for the panel badge. -->
    <method name="Count">
      <arg type="i" direction="out" name="count"/>
    </method>
    <signal name="StateChanged">
      <arg type="i" name="count"/>
    </signal>
  </interface>
</node>
"""


def build_interface():
    """Return the Gio.DBusNodeInfo for the interface above (Python side)."""
    import gi

    gi.require_version("Gio", "2.0")
    from gi.repository import Gio

    return Gio.DBusNodeInfo.new_for_xml(XML).interfaces[0]
