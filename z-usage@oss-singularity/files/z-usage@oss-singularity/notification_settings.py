#!/usr/bin/python3
"""Native notification settings rows with visible dependent controls."""

from JsonSettingsWidgets import JSONSettingsSpinButton, JSONSettingsSwitch


class _DependencyMixin:
    def _watch_dependency(self, info, settings):
        self._dependency_key = info["dependency-key"]
        self._dependency_invert = bool(info.get("dependency-invert", False))
        self._dependency_value = settings.get_value(self._dependency_key)
        settings.listen(self._dependency_key, self._dependency_changed)
        self._dependency_changed(self._dependency_key, settings.get_value(self._dependency_key))

    def _dependency_changed(self, _key, value):
        self._dependency_value = value
        enabled = bool(value)
        if self._dependency_invert:
            enabled = not enabled
        self.set_sensitive(enabled)
        self._dependency_state_changed()

    def _dependency_state_changed(self):
        pass


class NotificationSwitchWidget(_DependencyMixin, JSONSettingsSwitch):
    def __init__(self, info, _key, settings):
        JSONSettingsSwitch.__init__(self, info["setting-key"], settings, info)
        self._display_update = False
        # The effective "all resets" state can be on while the stored
        # per-model value is off. Keep the native binding for reads, but
        # handle writes ourselves so the visual effective state is not saved.
        self._detach_setting_writer()
        self.content_widget.connect("notify::active", self._active_changed)
        settings.listen(self.key, self._setting_changed)
        self._watch_dependency(info, settings)

    def _detach_setting_writer(self):
        for binding in self.settings.bindings.get(self.key, []):
            if binding["obj"] is self.content_widget:
                object_id = binding.pop("oid", None)
                if object_id is not None:
                    self.content_widget.disconnect(object_id)
                return

    def _active_changed(self, *_args):
        if self._display_update or not self.is_sensitive():
            return
        self.settings.set_value(self.key, self.content_widget.get_active())

    def _setting_changed(self, *_args):
        self._refresh_active_state()

    def _dependency_state_changed(self):
        self._refresh_active_state()

    def _refresh_active_state(self):
        active = bool(self.settings.get_value(self.key))
        if self._dependency_invert and bool(self._dependency_value):
            active = True
        self._display_update = True
        try:
            self.content_widget.set_active(active)
        finally:
            self._display_update = False


class NotificationThresholdWidget(_DependencyMixin, JSONSettingsSpinButton):
    def __init__(self, info, _key, settings):
        JSONSettingsSpinButton.__init__(self, info["setting-key"], settings, info)
        self._watch_dependency(info, settings)
