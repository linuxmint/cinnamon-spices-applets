"""Event-driven availability of the extension in Cinnamon's running xlets."""

from gi.repository import Gio, GLib


EXTENSION_UUID = "display-scale-extension@rasmarc"
_watcher = None


class ExtensionAvailability:
    def __init__(self):
        self.available = False
        self._listeners = {}
        self._next_id = 0
        self._closed = False
        self._serial = 0
        self._proxy = None
        self._proxy_signals = []
        self._cancellable = Gio.Cancellable()
        self._settings = Gio.Settings.new("org.cinnamon")
        self._settings_id = self._settings.connect("changed::enabled-extensions", self._query)
        Gio.DBusProxy.new_for_bus(
            Gio.BusType.SESSION,
            Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES | Gio.DBusProxyFlags.DO_NOT_AUTO_START,
            None, "org.Cinnamon", "/org/Cinnamon", "org.Cinnamon",
            self._cancellable, self._proxy_ready, None)

    def add(self, callback):
        self._next_id += 1
        token = self._next_id
        self._listeners[token] = callback
        callback(self.available)
        return token

    def remove(self, token):
        self._listeners.pop(token, None)
        if not self._listeners:
            self.close()

    def _publish(self, available):
        if self._closed or self.available == available:
            return
        self.available = available
        for callback in list(self._listeners.values()):
            callback(available)

    def _proxy_ready(self, source, result, *args):
        try:
            proxy = Gio.DBusProxy.new_for_bus_finish(result)
        except GLib.Error:
            return
        if self._closed:
            return
        self._proxy = proxy
        self._proxy_signals = [
            proxy.connect("g-signal", self._signal),
            proxy.connect("notify::g-name-owner", self._query),
        ]
        self._query()

    def _signal(self, proxy, sender, name, parameters):
        if name == "XletsLoadedComplete":
            self._query()

    def _query(self, *args):
        if self._closed:
            return
        self._serial += 1
        serial = self._serial
        enabled = self._settings.get_strv("enabled-extensions")
        if not any(value in (EXTENSION_UUID, "!" + EXTENSION_UUID) for value in enabled):
            self._publish(False)
            return
        if not self._proxy or not self._proxy.get_name_owner():
            self._publish(False)
            return
        self._proxy.call("GetRunningXletUUIDs", GLib.Variant("(s)", ("extension",)),
                         Gio.DBusCallFlags.NO_AUTO_START, 2000, self._cancellable,
                         self._queried, serial)

    def _queried(self, proxy, result, serial):
        try:
            available = EXTENSION_UUID in proxy.call_finish(result).unpack()[0]
        except GLib.Error:
            available = False
        if not self._closed and serial == self._serial:
            self._publish(available)

    def close(self):
        if self._closed:
            return
        self._closed = True
        self._cancellable.cancel()
        self._settings.disconnect(self._settings_id)
        if self._proxy:
            for signal in self._proxy_signals:
                self._proxy.disconnect(signal)
        self._proxy_signals = []
        self._listeners.clear()


def watch_availability(widget, callback):
    global _watcher
    if _watcher is None or _watcher._closed:
        _watcher = ExtensionAvailability()
    watcher = _watcher
    token = watcher.add(callback)
    widget.connect("destroy", lambda *args: watcher.remove(token))
