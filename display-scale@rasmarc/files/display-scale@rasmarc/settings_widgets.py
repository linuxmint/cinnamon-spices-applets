"""Native settings controls for dependent switches and optional numbers."""

import re
import runpy
from html import escape
from math import pi
from pathlib import Path

from gi.repository import Gdk, Gio, Gtk
from JsonSettingsWidgets import JSONSettingsComboBox, JSONSettingsEntry, JSONSettingsRange, JSONSettingsSwitch
from xapp.GSettingsWidgets import GSettingsComboBox
from xapp.SettingsWidgets import SettingsWidget
_ = runpy.run_path(str(Path(__file__).with_name("i18n.py")),
    run_name="display_scale_i18n")["_"]
# Cinnamon loads this widget module by file path, without adding its directory
# to sys.path. Load the adjacent helper explicitly and share its watcher.
watch_availability = runpy.run_path(str(Path(__file__).with_name("extension_status.py")),
    run_name="display_scale_extension_status")["watch_availability"]


def valid_stage(text):
    return re.fullmatch(r"1[0-9]{2}", text) is not None and text != "100"


def stage_prefix(text):
    # Partial numbers are editing drafts, never applet settings.
    return text == "" or re.fullmatch(r"1[0-9]?", text) is not None or valid_stage(text)


def switch_point_color(earlier, dark):
    # Same semantic palette as switchPointColor() in scale-slider.js.
    rgb = ((109, 180, 66) if earlier else (224, 116, 107)) if dark else (
        (46, 125, 61) if earlier else (182, 67, 59))
    return tuple(channel / 255 for channel in rgb)


def forward_settings_scroll(widget, event):
    """Bypass the control's default handler and scroll its containing page."""
    parent = widget.get_parent()
    while parent is not None:
        if isinstance(parent, Gtk.ScrolledWindow):
            parent.event(event)
            break
        parent = parent.get_parent()
    return True


def make_scroll_independent(widget):
    # The generic signal precedes GtkRange/GtkComboBox/GtkSpinButton default
    # scroll handling, including handlers installed by xapp itself.
    def before_event(control, event):
        if event.type == Gdk.EventType.SCROLL:
            return forward_settings_scroll(control, event)
        return False
    widget.connect("event", before_event)


class WheelSafeComboBox(JSONSettingsComboBox):
    def __init__(self, properties, key, settings):
        super().__init__(properties.get("setting-key", key), settings, properties)
        make_scroll_independent(self.content_widget)


class OnboardKeyboardMode(WheelSafeComboBox):
    def __init__(self, properties, key, settings):
        super().__init__(properties, "onboard-adjustment-method", settings)
        self.set_margin_start(self.get_margin_start() + properties.get("indent", 18))
        settings.bind("onboard-adjustment-enabled", self, "sensitive", Gio.SettingsBindFlags.GET)


class ScreenSwitchPoint(JSONSettingsRange):
    bind_dir = None

    def __init__(self, properties, key, settings):
        self._pointer_down = False
        self._updating = False
        self._switch_point_tooltip = properties.get("tooltip", "")
        super().__init__("screen-switch-point", settings, properties)
        self._endpoint_labels = {
            50: "<i><small>%s</small></i>" % escape(_("Half a step earlier")),
            150: "<i><small>%s</small></i>" % escape(_("Half a step later")),
        }
        scale = self.content_widget
        make_scroll_independent(scale)
        control_box = scale.get_parent()
        self.set_orientation(Gtk.Orientation.HORIZONTAL)
        self.set_spacing(20)
        self.label.set_halign(Gtk.Align.START)
        self.label.set_valign(Gtk.Align.CENTER)
        self.label.set_alignment(0.0, 0.5)
        self.set_child_packing(self.label, True, True, 0, Gtk.PackType.START)
        self.set_child_packing(control_box, False, False, 0, Gtk.PackType.START)
        control_box.set_orientation(Gtk.Orientation.HORIZONTAL)
        control_box.set_spacing(6)
        control_box.set_valign(Gtk.Align.CENTER)
        for label in (self.min_label, self.max_label):
            control_box.remove(label)
        self._endpoint_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._middle_label = Gtk.Label()
        labels = ((self.max_label, self._endpoint_labels[150]),
                  (self._middle_label, "<i><small>%s</small></i>" % escape(_("Regular"))),
                  (self.min_label, self._endpoint_labels[50]))
        for index, (label, markup) in enumerate(labels):
            label.set_markup(markup)
            label.set_alignment(1.0, 0.5)
            label.set_halign(Gtk.Align.FILL)
            label.set_margin_left(0)
            label.set_margin_right(0)
            self._endpoint_box.pack_start(label, False, False, 0)
            if index < len(labels) - 1:
                self._endpoint_box.pack_start(Gtk.Box(), True, True, 0)
        control_box.pack_start(self._endpoint_box, False, False, 0)
        control_box.reorder_child(self._endpoint_box, 0)
        # Keep native pointer direction; paint the highlight from the neutral
        # centre because GTK 3's own highlight always starts at an endpoint.
        scale.set_orientation(Gtk.Orientation.VERTICAL)
        scale.set_inverted(False)
        scale.set_has_origin(False)
        scale.connect_after("draw", self._draw_center_highlight)
        scale.set_size_request(-1, 128)
        scale.set_halign(Gtk.Align.CENTER)
        scale.set_hexpand(False)
        scale.set_vexpand(False)
        control_box.set_child_packing(scale, False, False, 0, Gtk.PackType.START)
        scale.connect("size-allocate", self._align_endpoint_labels)
        context = scale.get_style_context()
        context.add_class("display-scale-switch-point")
        self._mark_css = Gtk.CssProvider()
        self._mark_css.load_from_data(b"""
            scale.display-scale-switch-point marks mark indicator {
                min-height: 1px;
                min-width: 10px;
                color: @theme_fg_color;
            }
        """)
        context.add_provider(self._mark_css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
        self._mode_changed()

    @staticmethod
    def _center_highlight_span(scale, slider_margin=None):
        rect = scale.get_range_rect()
        slider_start, slider_end = scale.get_slider_range()
        if slider_margin is not None:
            # GTK returns the margin box; themes can use negative margins to
            # make the visible handle larger than that box.
            slider_start += slider_margin.top
            slider_end -= slider_margin.bottom
        origin = rect.y + rect.height / 2
        thumb = (slider_start + slider_end) / 2
        # The native thumb has already been drawn. Stop at its edge so this
        # after-draw callback never paints over the handle or its focus ring.
        top, bottom = ((slider_end, origin) if thumb < origin else
                       (origin, slider_start))
        if bottom <= top:
            return None
        return (rect.x + rect.width / 2, top, bottom - top)

    @staticmethod
    def _child_style_context(parent, name, state):
        path = parent.get_path().copy()
        position = path.append_type(Gtk.Widget)
        path.iter_set_object_name(position, name)
        context = Gtk.StyleContext()
        context.set_parent(parent)
        context.set_path(path)
        context.set_state(state)
        return context

    def _draw_center_highlight(self, scale, cr):
        if scale.get_value() == 100:
            return False
        # Resolve real theme nodes, including the handle's visible border box.
        state = scale.get_state_flags()
        trough = self._child_style_context(scale.get_style_context(), "trough", state)
        slider = self._child_style_context(trough, "slider", state)
        span = self._center_highlight_span(scale, slider.get_margin(state))
        if span is None:
            return False
        # Mint-Y leaves CSS min-width at zero and derives the trough width
        # from its other nodes. Use the actual allocation, not that minimum.
        width = max(1, scale.get_range_rect().width)
        center, top, height = span
        background = trough.get_background_color(state)
        widget = scale
        while background.alpha < 0.5 and widget is not None:
            background = widget.get_style_context().get_background_color(widget.get_state_flags())
            widget = widget.get_parent()
        brightness = 0.2126 * background.red + 0.7152 * background.green + 0.0722 * background.blue
        if background.alpha < 0.5:
            foreground = scale.get_style_context().get_color(state)
            brightness = 1 - (0.2126 * foreground.red + 0.7152 * foreground.green + 0.0722 * foreground.blue)
        color = switch_point_color(scale.get_value() > 100, brightness < 0.5)
        radius = min(2.5, width / 2, height / 2)
        left, right, bottom = center - width / 2, center + width / 2, top + height
        cr.save()
        cr.new_path()
        cr.arc(right - radius, top + radius, radius, -pi / 2, 0)
        cr.arc(right - radius, bottom - radius, radius, 0, pi / 2)
        cr.arc(left + radius, bottom - radius, radius, pi / 2, pi)
        cr.arc(left + radius, top + radius, radius, pi, 3 * pi / 2)
        cr.close_path()
        cr.set_source_rgba(*color, 1 if scale.is_sensitive() else 0.45)
        cr.fill()
        cr.restore()
        return False

    def _align_endpoint_labels(self, scale, allocation):
        # Keep a shared right edge while following the native trough's
        # endpoints when font size, theme padding or the allocation changes.
        rect = scale.get_range_rect()
        upper_height = self.max_label.get_preferred_height()[1]
        lower_height = self.min_label.get_preferred_height()[1]
        top = max(0, round(rect.y - upper_height / 2))
        bottom = max(0, round(allocation.height - rect.y - rect.height - lower_height / 2))
        self._endpoint_box.set_margin_top(top)
        self._endpoint_box.set_margin_bottom(bottom)

    def _snap(self, value):
        return min(150, max(50, 50 + round((value - 50) / 25) * 25))

    def on_setting_changed(self, *args):
        raw = self.get_value()
        value = self._snap(raw)
        self._updating = True
        try:
            self.content_widget.set_value(200 - value)
        finally:
            self._updating = False
        if raw != value:
            self.set_value(value)

    def connect_widget_handlers(self):
        scale = self.content_widget
        # GtkRange's gestures may consume the specific button signals. The
        # generic event signal runs first; event-after also runs for consumed
        # releases and observes the final value after native processing.
        scale.connect("event", self._pointer_event)
        scale.connect("event-after", self._pointer_event_after)
        scale.connect("grab-broken-event", self._cancel_pointer)
        self.connect("unmap", self._cancel_pointer)

    def _mode_changed(self, *args):
        self._pointer_down = False
        self.step = 25
        scale = self.content_widget
        scale.set_increments(self.step, self.step)
        scale.clear_marks()
        for point in (50, 75, 100, 125, 150):
            for side in (Gtk.PositionType.LEFT, Gtk.PositionType.RIGHT):
                scale.add_mark(point, side, None)
        self.set_tooltip_text(self._switch_point_tooltip)
        self.on_setting_changed()

    def _pointer_event(self, scale, event):
        if event.type == Gdk.EventType.BUTTON_PRESS and event.button == 1:
            self._pointer_down = True
        return False

    def _pointer_event_after(self, scale, event):
        if (event.type == Gdk.EventType.BUTTON_RELEASE and event.button == 1 and
                self._pointer_down):
            self._pointer_down = False
            self._commit()
        return False

    def _cancel_pointer(self, *args):
        if self._pointer_down:
            self._pointer_down = False
            self.on_setting_changed()
        return False

    def _commit(self):
        value = self._snap(200 - self.content_widget.get_value())
        if value != self.get_value():
            self.set_value(value)

    def on_scroll_event(self, scale, event):
        return forward_settings_scroll(scale, event)

    def apply_later(self, scale):
        # Pointer motion is only a preview. Keyboard changes can
        # commit immediately; a held pointer commits once on release.
        if self._updating:
            return
        value = 200 - self._snap(200 - scale.get_value())
        if scale.get_value() != value:
            self._updating = True
            try:
                scale.set_value(value)
            finally:
                self._updating = False
        if not self._pointer_down:
            self._commit()


class SwitchPointMenuSwitch(JSONSettingsSwitch):
    def __init__(self, properties, key, settings):
        super().__init__("switch-point-in-menu", settings, properties)
        self.set_margin_start(self.get_margin_start() + properties.get("indent", 18))
        settings.bind("shade-screen-stages", self, "sensitive", Gio.SettingsBindFlags.GET)


class KeepSwitchPointMenuOpenSwitch(JSONSettingsSwitch):
    def __init__(self, properties, key, settings):
        super().__init__("keep-switch-point-menu-open", settings, properties)
        self.set_margin_start(self.get_margin_start() + properties.get("indent", 36))
        settings.listen("shade-screen-stages", self._sync_sensitivity)
        settings.listen("switch-point-in-menu", self._sync_sensitivity)
        self._sync_sensitivity()

    def _sync_sensitivity(self, *args):
        self.set_property("sensitive", bool(
            self.settings.get_value("shade-screen-stages") and
            self.settings.get_value("switch-point-in-menu")))


class ExtensionSwitch(JSONSettingsSwitch):
    def __init__(self, properties, key, settings):
        self._extension_available = False
        self._parent_key = properties.get("parent-key")
        super().__init__(properties["setting-key"], settings, properties)
        self.set_margin_start(self.get_margin_start() + properties.get("indent", 0))
        if self._parent_key:
            settings.bind(self._parent_key, self, "sensitive", Gio.SettingsBindFlags.GET,
                          map_get=lambda active: bool(active) and self._extension_available)
        watch_availability(self, self._availability_changed)

    def _availability_changed(self, available):
        self._extension_available = available
        parent = not self._parent_key or bool(self.settings.get_value(self._parent_key))
        self.set_property("sensitive", available and parent)


class PanelTextSwitch(ExtensionSwitch):
    def __init__(self, properties, key, settings):
        super().__init__({**properties, "setting-key": "grow-panel-text",
                          "parent-key": "keep-panel-height"}, key, settings)


class ExtensionNotice(SettingsWidget):
    def __init__(self, properties, key, settings):
        super().__init__()
        self.set_spacing(12)
        self.set_margin_start(20)
        self.set_margin_end(20)
        self.set_margin_top(6)
        self.set_margin_bottom(6)
        description = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        self._title = Gtk.Label(label=properties["description"], xalign=0)
        description.pack_start(self._title, False, False, 0)
        self._label = Gtk.Label(xalign=0)
        self._label.set_line_wrap(True)
        self._label.set_max_width_chars(52)
        self._label.get_style_context().add_class("dim-label")
        description.pack_start(self._label, False, False, 0)
        self.pack_start(description, True, True, 0)
        button = Gtk.Button(label=_("Open Extensions"))
        button.set_valign(Gtk.Align.CENTER)
        button.connect("clicked", lambda *args: Gio.Subprocess.new(
            ["cinnamon-settings", "extensions"], Gio.SubprocessFlags.NONE))
        self.pack_start(button, False, False, 0)
        watch_availability(self, self._availability_changed)

    def _availability_changed(self, available):
        name = _("Display Scale - Additional Features")
        self._label.set_text(_("“%s” is enabled.") % name if available else
            _("Requires the enabled extension “%s”. It is currently disabled.") % name)


class CustomStageEntry(JSONSettingsEntry):
    bind_dir = None

    def __init__(self, properties, key, settings):
        self._updating = False
        self._committed = ""
        super().__init__(properties["setting-key"], settings, properties)
        entry = self.content_widget
        entry.set_input_purpose(Gtk.InputPurpose.DIGITS)
        entry.set_max_length(3)
        entry.set_width_chars(3)
        entry.set_max_width_chars(3)
        entry.set_placeholder_text("—")

    def _set_text(self, text):
        self._updating = True
        try:
            if self.content_widget.get_text() != text:
                self.content_widget.set_text(text)
        finally:
            self._updating = False

    def on_setting_changed(self, *args):
        raw = self.get_value()
        self._committed = raw if isinstance(raw, str) and valid_stage(raw) else ""
        self._set_text(self._committed)

    def connect_widget_handlers(self, *args):
        entry = self.content_widget
        entry.connect("insert-text", self._filter_insert)
        entry.connect("changed", self._changed)
        entry.connect("focus-out-event", self._finish)
        entry.connect("activate", self._finish)
        self.connect("unmap", self._finish)

    def _filter_insert(self, entry, text, length, position):
        if self._updating:
            return
        current = entry.get_text()
        bounds = entry.get_selection_bounds()
        if bounds:
            start, end = bounds
            current = current[:start] + current[end:]
            position = start
        else:
            # GtkEditable's insert-text position is an in/out pointer in GTK3;
            # use the public caret position instead of its signal marshalling.
            position = entry.get_position()
        candidate = current[:position] + text + current[position:]
        if not stage_prefix(candidate):
            entry.stop_emission_by_name("insert-text")

    def _changed(self, entry):
        if self._updating:
            return
        text = entry.get_text()
        if (text == "" or valid_stage(text)) and text != self._committed:
            self._committed = text
            self.set_value(text)

    def _finish(self, *args):
        text = self.content_widget.get_text()
        if text == "" or valid_stage(text):
            if text != self._committed:
                self._committed = text
                self.set_value(text)
        else:
            self._set_text(self._committed)
        return False


class BackgroundStyleChooser(GSettingsComboBox):
    def __init__(self, properties, key, settings):
        options = [
            ("none", _("No picture")), ("wallpaper", _("Tiled")),
            ("centered", _("Centered")), ("scaled", _("Scaled")),
            ("stretched", _("Stretched")), ("zoom", _("Zoom")),
            ("spanned", _("Spanned across screens")),
        ]
        super().__init__(properties["description"], "org.cinnamon.desktop.background",
                         "picture-options", options, tooltip=properties.get("tooltip", ""))
        make_scroll_independent(self.content_widget)
