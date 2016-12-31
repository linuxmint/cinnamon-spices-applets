#!/usr/bin/env python

import gobject
import sys
import signal
import dbus
import dbus.service
import dbus.mainloop.glib

SHUTDOWN_DBUS_NAME = "info.Lusito.ShutdownListener"
SHUTDOWN_DBUS_PATH = "/info/Lusito/ShutdownListener"

class ShutdownListener(dbus.service.Object):
    def __init__(self, conn, object_path=SHUTDOWN_DBUS_PATH):
        dbus.service.Object.__init__(self, conn, object_path)

        signal.signal(signal.SIGTERM, self.signalHandler)
        signal.signal(signal.SIGINT, self.signalHandler)

    @dbus.service.signal(SHUTDOWN_DBUS_NAME)
    def Shutdown(self):
        print "emitted"
        gobject.timeout_add(50, sys.exit)
        pass
        
    def signalHandler(self, signum, frame):
        try:
            self.Shutdown()
        except Exception as e:
            print(e)
        return False

if __name__ == '__main__':
    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)

    session_bus = dbus.SessionBus()
    request = session_bus.request_name(SHUTDOWN_DBUS_NAME, dbus.bus.NAME_FLAG_DO_NOT_QUEUE)
    if request != dbus.bus.REQUEST_NAME_REPLY_EXISTS:
        name = dbus.service.BusName(SHUTDOWN_DBUS_NAME, session_bus)
        object = ShutdownListener(session_bus)

        loop = gobject.MainLoop()
        print "Running shutdown listener"
        loop.run()
    else:
        print "Shutdown listener already running"
