# -*- coding: utf-8 -*-
"""Item card widgets for the Pickup popup.

Two presentations of the same data:

  GridCard  -- large thumbnail/icon tile, used by the grid layout.
  ListRow   -- compact row with a small icon plus name, size and badge.

Both expose the same small surface so the window code does not care which is
mounted:

    widget            the Gtk.Widget to pack
    item              the backing dict
    set_selected(b)   reflect selection state
    refresh()         re-read name/size/missing state

Drag-out is armed through ``enable_drag(payload_provider)``. The provider
resolves the *current* drag set at drag time, so "selected items drag together"
works without rebuilding widgets. Nothing here opens files: cards are press and
drag targets only. The only click behaviour is the selection checkbox.
"""

import os

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, GdkPixbuf, GObject, Gtk, Pango  # noqa: E402

import thumbnails  # noqa: E402
from store import KIND_TEXT, human_size, item_size, path_to_uri  # noqa: E402

# Offer URIs first: file managers and browsers prefer it. text/plain is the
# fallback that makes dragging into text fields work.
# --------------------------------------------------------------- file icons --
_ICON_BY_EXT = {
    "package-x-generic-symbolic": "zip tar gz tgz xz bz2 7z rar zst deb rpm apk jar whl",
    "x-office-document-symbolic": "pdf doc docx odt rtf epub",
    "x-office-spreadsheet-symbolic": "xls xlsx ods csv tsv",
    "x-office-presentation-symbolic": "ppt pptx odp key",
    "text-x-script-symbolic": (
        "py js ts jsx tsx sh bash zsh json html htm css scss c h cpp hpp cc java "
        "rs go rb php sql xml yml yaml toml ini cfg conf lua pl kt swift"
    ),
    "text-x-generic-symbolic": "txt md markdown log rst tex",
    "application-x-executable-symbolic": "appimage exe msi bin run",
    "font-x-generic-symbolic": "ttf otf woff woff2",
    "media-optical-symbolic": "iso img",
}
_EXT_TO_ICON = {
    ext: icon for icon, exts in _ICON_BY_EXT.items() for ext in exts.split()
}
_ICON_FALLBACKS = {
    "package-x-generic-symbolic": ("package-x-generic-symbolic", "folder-symbolic"),
    "x-office-spreadsheet-symbolic": ("x-office-spreadsheet-symbolic", "x-office-document-symbolic"),
    "x-office-presentation-symbolic": ("x-office-presentation-symbolic", "x-office-document-symbolic"),
    "text-x-script-symbolic": ("text-x-script-symbolic", "text-x-generic-symbolic"),
    "application-x-executable-symbolic": ("application-x-executable-symbolic", "system-run-symbolic", "text-x-generic-symbolic"),
    "font-x-generic-symbolic": ("font-x-generic-symbolic", "text-x-generic-symbolic"),
    "media-optical-symbolic": ("media-optical-symbolic", "drive-harddisk-symbolic", "text-x-generic-symbolic"),
}


def type_icon_name(item):
    """Symbolic icon that best matches this item (same for grid and list)."""
    if item.get("kind") == KIND_TEXT:
        wanted = "text-x-generic-symbolic"
    elif item.get("is_dir"):
        wanted = "folder-symbolic"
    else:
        mime = thumbnails.item_mime(item)
        ext = os.path.splitext(item.get("path") or "")[1].lower().lstrip(".")
        if mime.startswith("image/"):
            wanted = "image-x-generic-symbolic"
        elif mime.startswith("video/"):
            wanted = "video-x-generic-symbolic"
        elif mime.startswith("audio/"):
            wanted = "audio-x-generic-symbolic"
        else:
            wanted = _EXT_TO_ICON.get(ext, "text-x-generic-symbolic")
    theme_icons = Gtk.IconTheme.get_default()
    for name in _ICON_FALLBACKS.get(wanted, (wanted, "text-x-generic-symbolic")):
        if theme_icons.lookup_icon(name, 16, 0) is not None:
            return name
    return "text-x-generic-symbolic"


# ---------------------------------------------------------------- checkbox --
class SelectBox(Gtk.DrawingArea):
    """Selection checkbox, drawn so the corners and tick are always crisp.

    Same API the cards used with Gtk.CheckButton: get_active / set_active and
    a "toggled" signal. Colours come from the .pickup-check CSS rule.
    """

    __gsignals__ = {"toggled": (GObject.SignalFlags.RUN_FIRST, None, ())}

    HIT = 24   # clickable area
    BOX = 18   # visible box
    RADIUS = 5.0

    def __init__(self):
        super().__init__()
        self._active = False
        self._hover = False
        self.set_size_request(self.HIT, self.HIT)
        self.get_style_context().add_class("pickup-check")
        self.add_events(
            Gdk.EventMask.BUTTON_PRESS_MASK
            | Gdk.EventMask.ENTER_NOTIFY_MASK
            | Gdk.EventMask.LEAVE_NOTIFY_MASK
        )
        self.connect("draw", self._on_draw)
        self.connect("button-press-event", self._on_press)
        self.connect("enter-notify-event", self._on_hover, True)
        self.connect("leave-notify-event", self._on_hover, False)
        self.connect("style-updated", lambda *_: self.queue_draw())

    def get_active(self):
        return self._active

    def set_active(self, value):
        value = bool(value)
        if value == self._active:
            return
        self._active = value
        self.queue_draw()
        self.emit("toggled")

    def _on_press(self, widget, event):
        if event.button == 1:
            self.set_active(not self._active)
            return True
        return False

    def _on_hover(self, widget, event, inside):
        self._hover = inside
        self.queue_draw()
        return False

    def _colors(self):
        context = self.get_style_context()
        state = Gtk.StateFlags.NORMAL
        try:
            accent = context.get_color(state)
            fill = context.get_property("background-color", state)
            edge = context.get_property("border-top-color", state)
        except Exception:
            accent = Gdk.RGBA(0.2, 0.45, 0.8, 1.0)
            fill = Gdk.RGBA(0.1, 0.1, 0.1, 0.9)
            edge = Gdk.RGBA(0.6, 0.6, 0.6, 1.0)
        return accent, fill, edge

    def _on_draw(self, widget, cr):
        accent, fill, edge = self._colors()
        width = self.get_allocated_width()
        height = self.get_allocated_height()
        size = float(self.BOX)
        x = (width - size) / 2.0 + 0.5
        y = (height - size) / 2.0 + 0.5
        w = h = size - 1.0
        r = self.RADIUS

        cr.new_sub_path()
        cr.arc(x + w - r, y + r, r, -1.5708, 0)
        cr.arc(x + w - r, y + h - r, r, 0, 1.5708)
        cr.arc(x + r, y + h - r, r, 1.5708, 3.14159)
        cr.arc(x + r, y + r, r, 3.14159, 4.71239)
        cr.close_path()

        if self._active:
            cr.set_source_rgba(accent.red, accent.green, accent.blue, 1.0)
            cr.fill()
            # tick
            cr.set_source_rgba(1, 1, 1, 1)
            cr.set_line_width(2.0)
            cr.set_line_cap(1)
            cr.set_line_join(1)
            cr.move_to(x + w * 0.26, y + h * 0.53)
            cr.line_to(x + w * 0.43, y + h * 0.70)
            cr.line_to(x + w * 0.76, y + h * 0.32)
            cr.stroke()
        else:
            cr.set_source_rgba(fill.red, fill.green, fill.blue, fill.alpha)
            cr.fill_preserve()
            if self._hover:
                cr.set_source_rgba(accent.red, accent.green, accent.blue, 1.0)
            else:
                cr.set_source_rgba(edge.red, edge.green, edge.blue, max(edge.alpha, 0.8))
            cr.set_line_width(1.5)
            cr.stroke()
        return False


class PinIcon(Gtk.DrawingArea):
    """A small drawn push-pin (11px), tinted with the theme accent.

    Drawn instead of using a theme icon so it stays small and looks the same
    in every icon theme.
    """

    SIZE = 11

    def __init__(self):
        super().__init__()
        self.set_size_request(self.SIZE, self.SIZE)
        self.get_style_context().add_class("pickup-pin")
        self.connect("draw", self._on_draw)

    def _on_draw(self, widget, cr):
        context = widget.get_style_context()
        color = context.get_color(Gtk.StateFlags.NORMAL)
        cr.set_source_rgba(color.red, color.green, color.blue, color.alpha)
        size = float(self.SIZE)
        cr.translate(size / 2.0, size / 2.0)
        cr.rotate(0.6)  # a slight tilt, like a pin pressed into a board
        s = size / 12.0
        # head
        cr.rectangle(-2.4 * s, -5.2 * s, 4.8 * s, 1.6 * s)
        cr.fill()
        # body
        cr.move_to(-1.6 * s, -3.6 * s)
        cr.line_to(1.6 * s, -3.6 * s)
        cr.line_to(2.2 * s, 0.6 * s)
        cr.line_to(-2.2 * s, 0.6 * s)
        cr.close_path()
        cr.fill()
        # cross bar
        cr.rectangle(-3.2 * s, 0.6 * s, 6.4 * s, 1.1 * s)
        cr.fill()
        # needle
        cr.set_line_width(max(1.0, 1.0 * s))
        cr.move_to(0, 1.7 * s)
        cr.line_to(0, 5.6 * s)
        cr.stroke()
        return False


DRAG_TARGETS = [
    Gtk.TargetEntry.new("text/uri-list", 0, 0),
    Gtk.TargetEntry.new("text/plain;charset=utf-8", 0, 1),
    Gtk.TargetEntry.new("text/plain", 0, 2),
]
# Text items have no URI, so they must not advertise text/uri-list at all
# (otherwise a drop target may pick it and receive nothing).
TEXT_DRAG_TARGETS = [
    Gtk.TargetEntry.new("text/plain;charset=utf-8", 0, 1),
    Gtk.TargetEntry.new("text/plain", 0, 2),
    Gtk.TargetEntry.new("UTF8_STRING", 0, 1),
]


def _escape(text):
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def ellipsize(text, limit=60):
    text = " ".join(str(text).split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "\u2026"


def display_name(item):
    if item.get("kind") == KIND_TEXT:
        return ellipsize(item.get("preview") or "(empty)", 46)
    path = item.get("path") or ""
    name = os.path.basename(path.rstrip("/")) or path
    return ellipsize(name, 46)


def subtitle(item):
    """Second line: size for files, character count for text."""
    if item.get("kind") == KIND_TEXT:
        label = "%s chars" % format(item.get("chars") or 0, ",")
        if item.get("truncated"):
            label += " \u00b7 trimmed"
        return label
    if item.get("missing"):
        return "missing \u00b7 " + (os.path.basename(item.get("path") or "") or "file")
    if item.get("is_dir"):
        return "folder"
    size = item_size(item)
    return human_size(size) if size is not None else "file"


def tooltip(item):
    if item.get("kind") == KIND_TEXT:
        preview = item.get("preview") or ""
        return _escape(preview) if preview else "Text item"
    return _escape(item.get("path") or "")


def drag_payload(item, store):
    """(uris, text) for a single item dragged out of the shelf."""
    if item.get("kind") == KIND_TEXT:
        return [], store.get_text(item)
    uri = item.get("uri") or path_to_uri(item.get("path") or "")
    return ([uri] if uri else []), uri


class _CardBase:
    """Shared selection, context-menu and drag-source behaviour."""

    def __init__(self, item, store, on_context, on_select_changed):
        self.item = item
        self.store = store
        self.on_context = on_context
        self.on_select_changed = on_select_changed
        self.selected = False
        self._silent_check = True
        self._drag_active = False
        self.on_drag_state = None
        self._payload_provider = None

    # -- drag-out ------------------------------------------------------------
    def enable_drag(self, payload_provider):
        """Arm drag-out on ``self.widget``.

        ``payload_provider(item)`` returns (uris, text) for a drag starting on
        this card. It is called at drag-begin so multi-select is resolved using
        the live selection rather than the state at build time.
        """
        self._payload_provider = payload_provider
        targets = TEXT_DRAG_TARGETS if self.item.get("kind") == KIND_TEXT else DRAG_TARGETS
        self.widget.drag_source_set(
            Gdk.ModifierType.BUTTON1_MASK, targets, Gdk.DragAction.COPY
        )
        # Re-assert the target list: drag_source_set() alone can leave the
        # default text targets in place depending on GTK version.
        self.widget.drag_source_set_target_list(targets)
        self.widget.connect("drag-begin", self._on_drag_begin)
        self.widget.connect("drag-data-get", self._on_drag_data_get)
        self.widget.connect("drag-end", self._on_drag_end)

    def _on_drag_begin(self, widget, context):
        # The drag icon is supplied by GTK from the widget itself; dim the source
        # slightly so it is obvious the drag started.
        self._drag_active = True
        if self.on_drag_state:
            self.on_drag_state(True)

    def _on_drag_data_get(self, widget, context, selection, info, when):
        if not self._payload_provider:
            return
        uris, text = self._payload_provider(self.item)
        if info == 0 and uris:
            selection.set_uris(uris)
        else:
            selection.set_text(text or "", -1)

    def _on_drag_end(self, widget, context):
        self._drag_active = False
        if self.on_drag_state:
            self.on_drag_state(False)

    # -- selection -----------------------------------------------------------
    def set_selected(self, selected):
        self.selected = bool(selected)
        self._sync_selection_style()
        self._silent_check = True
        self.check.set_active(self.selected)
        self._silent_check = False

    def _on_check_toggled(self, check):
        if self._silent_check:
            return
        self.selected = check.get_active()
        self._sync_selection_style()
        if self.on_select_changed:
            self.on_select_changed(self, self.selected)

    def _sync_selection_style(self):
        context = self.widget.get_style_context()
        if self.selected:
            context.add_class("pickup-selected")
        else:
            context.remove_class("pickup-selected")

    # -- pointer -------------------------------------------------------------
    def _on_press(self, widget, event):
        if event.button == 3:
            if self.on_context:
                self.on_context(self, event)
            return True
        return False

    # -- shared refresh ------------------------------------------------------
    def _refresh_labels(self, name_label, meta_label):
        name_label.set_text(display_name(self.item))
        name_label.set_tooltip_markup(tooltip(self.item))
        meta_label.set_text(subtitle(self.item))
        self.pin.set_visible(bool(self.item.get("pinned")))

    def _refresh_state_styles(self, labels=()):
        context = self.widget.get_style_context()
        missing = bool(self.item.get("missing"))
        if missing:
            context.add_class("pickup-missing")
        else:
            context.remove_class("pickup-missing")
        for label in labels:
            label_context = label.get_style_context()
            if missing:
                label_context.add_class("pickup-missing-label")
            else:
                label_context.remove_class("pickup-missing-label")


class GridCard(_CardBase):
    """Tile with a thumbnail (or extension badge) and a two-line caption."""

    THUMB = 104
    WIDTH = 152

    def __init__(self, item, store, on_context, on_select_changed):
        super().__init__(item, store, on_context, on_select_changed)
        self.widget = Gtk.EventBox()
        self.widget.set_visible_window(False)
        self.widget.get_style_context().add_class("pickup-card")
        self.widget.set_size_request(self.WIDTH, -1)

        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)

        overlay = Gtk.Overlay()
        self._thumb_holder = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._thumb_holder.set_halign(Gtk.Align.CENTER)
        self._thumb_holder.set_valign(Gtk.Align.CENTER)
        self._thumb_holder.set_size_request(self.WIDTH - 20, self.THUMB)
        overlay.add(self._thumb_holder)

        self.check = SelectBox()
        self.check.set_halign(Gtk.Align.START)
        self.check.set_valign(Gtk.Align.START)
        self.check.set_margin_top(1)
        self.check.set_margin_start(1)
        self.check.set_tooltip_text("Select")
        self.check.connect("toggled", self._on_check_toggled)
        overlay.add_overlay(self.check)

        self.pin = PinIcon()
        self.pin.set_halign(Gtk.Align.END)
        self.pin.set_valign(Gtk.Align.START)
        self.pin.set_margin_top(6)
        self.pin.set_margin_end(6)
        self.pin.set_no_show_all(True)
        overlay.add_overlay(self.pin)

        outer.pack_start(overlay, False, False, 8)

        self.name_label = Gtk.Label()
        self.name_label.get_style_context().add_class("pickup-name")
        self.name_label.set_ellipsize(Pango.EllipsizeMode.END)
        self.name_label.set_xalign(0.0)
        self.name_label.set_line_wrap(False)
        self.name_label.set_max_width_chars(1)

        self.meta_label = Gtk.Label()
        self.meta_label.get_style_context().add_class("pickup-meta")
        self.meta_label.set_xalign(0.0)
        self.meta_label.set_ellipsize(Pango.EllipsizeMode.END)
        self.meta_label.set_max_width_chars(1)

        caption = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=1)
        caption.set_margin_start(9)
        caption.set_margin_end(9)
        caption.set_margin_bottom(8)
        caption.pack_start(self.name_label, False, False, 0)
        caption.pack_start(self.meta_label, False, False, 0)
        outer.pack_start(caption, False, False, 0)

        self.widget.add(outer)
        self.widget.connect("button-press-event", self._on_press)
        self._render_thumb()
        self._silent_check = False
        self.refresh()

    def _render_thumb(self):
        for child in self._thumb_holder.get_children():
            self._thumb_holder.remove(child)
        pixbuf = None
        if thumbnails.has_source(self.item) and not self.item.get("missing"):
            pixbuf = thumbnails.cached_thumbnail(self.item)
            if pixbuf is None:
                self._request_thumb()
        if pixbuf is not None:
            image = Gtk.Image.new_from_pixbuf(pixbuf)
            image.get_style_context().add_class("pickup-thumb")
            self._thumb_holder.pack_start(image, True, False, 0)
            return
        icon_name = type_icon_name(self.item)
        if self.item.get("kind") == KIND_TEXT:
            label = "TEXT"
        elif self.item.get("is_dir"):
            label = "DIR"
        else:
            label = thumbnails.extension_label(self.item.get("path") or "")
        self._thumb_holder.pack_start(self._make_glyph(icon_name, label), True, True, 0)

    def _request_thumb(self):
        if getattr(self, "_thumb_requested", False):
            return
        self._thumb_requested = True

        def ready(pixbuf):
            # The card may have been rebuilt (layout switch) while we waited.
            if pixbuf is None or not self._thumb_holder.get_realized() and not self._thumb_holder.get_parent():
                return
            try:
                self._render_thumb()
                self._thumb_holder.show_all()
            except Exception:
                pass

        thumbnails.request_thumbnail(self.item, ready)

    def _make_glyph(self, icon_name, label):
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
        box.get_style_context().add_class("pickup-thumb-empty")
        box.set_halign(Gtk.Align.CENTER)
        box.set_valign(Gtk.Align.CENTER)
        box.set_size_request(76, 76)
        icon = Gtk.Image.new_from_icon_name(icon_name, Gtk.IconSize.DIALOG)
        icon.get_style_context().add_class("pickup-ext-dim")
        box.pack_start(icon, True, True, 0)
        if label:
            text = Gtk.Label(label=label)
            text.get_style_context().add_class("pickup-ext")
            text.set_ellipsize(Pango.EllipsizeMode.END)
            text.set_max_width_chars(7)
            box.pack_start(text, False, False, 0)
        return box

    def refresh(self):
        self._refresh_labels(self.name_label, self.meta_label)
        # Only the meta line gets the red "missing" treatment; the name is
        # greyed out through the .pickup-missing .pickup-name CSS rule.
        self._refresh_state_styles((self.meta_label,))
        self._silent_check = True
        self.check.set_active(self.selected)
        self._silent_check = False


class ListRow(_CardBase):
    """Compact row: icon, name, subtitle, pin, checkbox."""

    ICON = 38

    def __init__(self, item, store, on_context, on_select_changed):
        super().__init__(item, store, on_context, on_select_changed)
        self.widget = Gtk.EventBox()
        self.widget.set_visible_window(False)
        context = self.widget.get_style_context()
        context.add_class("pickup-card")
        context.add_class("pickup-row")

        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=9)
        row.set_margin_top(5)
        row.set_margin_bottom(5)
        row.set_margin_start(8)
        row.set_margin_end(6)

        self._icon_holder = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._icon_holder.set_size_request(self.ICON, self.ICON)
        self._icon_holder.set_valign(Gtk.Align.CENTER)
        row.pack_start(self._icon_holder, False, False, 0)

        text_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        text_box.set_valign(Gtk.Align.CENTER)
        self.name_label = Gtk.Label()
        self.name_label.get_style_context().add_class("pickup-name")
        self.name_label.set_ellipsize(Pango.EllipsizeMode.END)
        self.name_label.set_xalign(0.0)
        self.name_label.set_max_width_chars(1)
        self.meta_label = Gtk.Label()
        self.meta_label.get_style_context().add_class("pickup-meta")
        self.meta_label.set_xalign(0.0)
        self.meta_label.set_ellipsize(Pango.EllipsizeMode.END)
        self.meta_label.set_max_width_chars(1)
        text_box.pack_start(self.name_label, False, False, 0)
        text_box.pack_start(self.meta_label, False, False, 0)
        row.pack_start(text_box, True, True, 0)

        self.check = SelectBox()
        self.check.set_valign(Gtk.Align.CENTER)
        self.check.set_tooltip_text("Select")
        self.check.connect("toggled", self._on_check_toggled)

        self.pin = PinIcon()
        self.pin.set_valign(Gtk.Align.CENTER)
        self.pin.set_no_show_all(True)

        row.pack_end(self.check, False, False, 0)
        row.pack_end(self.pin, False, False, 2)

        self.widget.add(row)
        self.widget.connect("button-press-event", self._on_press)
        self._render_icon()
        self._silent_check = False
        self.refresh()

    def _render_icon(self):
        for child in self._icon_holder.get_children():
            self._icon_holder.remove(child)
        pixbuf = None
        if thumbnails.has_source(self.item) and not self.item.get("missing"):
            pixbuf = thumbnails.cached_thumbnail(self.item)
            if pixbuf is None:
                self._request_icon()
        if pixbuf is not None:
            # The cached thumbnail is grid-sized; shrink it to fit the row icon.
            width, height = pixbuf.get_width(), pixbuf.get_height()
            if width > 0 and height > 0:
                ratio = min(self.ICON / float(width), self.ICON / float(height))
                if ratio < 1.0:
                    scaled = pixbuf.scale_simple(
                        max(1, int(width * ratio)), max(1, int(height * ratio)),
                        GdkPixbuf.InterpType.BILINEAR,
                    )
                    pixbuf = scaled or pixbuf
            image = Gtk.Image.new_from_pixbuf(pixbuf)
            image.set_size_request(self.ICON, self.ICON)
            self._icon_holder.pack_start(image, True, True, 0)
            return
        image = Gtk.Image.new_from_icon_name(type_icon_name(self.item), Gtk.IconSize.DND)
        # Symbolic icons take their colour from CSS. Without this they used the
        # *system* theme's foreground, which is near-white on a dark system
        # theme and so vanished against the light palette.
        image.get_style_context().add_class("pickup-ext-dim")
        if self.item.get("missing"):
            image.set_opacity(0.4)
        self._icon_holder.pack_start(image, True, True, 0)

    def _request_icon(self):
        if getattr(self, "_thumb_requested", False):
            return
        self._thumb_requested = True

        def ready(pixbuf):
            if pixbuf is None or self._icon_holder.get_parent() is None:
                return
            try:
                self._render_icon()
                self._icon_holder.show_all()
            except Exception:
                pass

        thumbnails.request_thumbnail(self.item, ready)

    def refresh(self):
        self._refresh_labels(self.name_label, self.meta_label)
        self._refresh_state_styles((self.meta_label,))
        self._silent_check = True
        self.check.set_active(self.selected)
        self._silent_check = False
