import math
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('PangoCairo', '1.0')
from gi.repository import Gtk, Gdk, Pango, PangoCairo
import cairo
from annotations import Annotation
from config import AppState, _
from utils import create_tool_icon

# Maximum number of annotations kept in undo history
MAX_UNDO_HISTORY = 50
# Minimum squared distance between freehand points (px²)
FREEHAND_MIN_DIST_SQ = 4
# Accent color used throughout the UI (Dodger Blue)
ACCENT_BLUE = (52 / 255.0, 152 / 255.0, 219 / 255.0)
# Grace margin (px) for click/hover hit detection on annotations and crop handles
HIT_MARGIN = 15
# Half-size (px) of crop-frame resize handles
HANDLE_HALF = 4

class CanvasMixin:

    def _invalidate_bg_cache(self):
        """Call whenever full_pixbuf changes to force a surface rebuild."""
        old = getattr(self, '_bg_surface', None)
        if old is not None:
            old.finish()
        self._bg_surface = None

    def _get_bg_surface(self):
        """Return a cached cairo surface for the background screenshot pixbuf."""
        if getattr(self, '_bg_surface', None) is None and self.full_pixbuf:
            self._bg_surface = Gdk.cairo_surface_create_from_pixbuf(
                self.full_pixbuf, self.scale, self.get_window()
            )
        return self._bg_surface

    def on_draw(self, widget, cr):
        """Main paint callback: background, selection overlay, crop frame, annotations."""
        allocation = widget.get_allocation()
        
        # Black base, then paint the frozen screenshot on top
        cr.set_source_rgb(0, 0, 0)
        cr.paint()
        
        surface = self._get_bg_surface()
        if surface:
            cr.set_source_surface(surface, 0, 0)
            cr.paint()

        if self.state == AppState.SELECTING:
            # Dim everything, then clip the selection to reveal full brightness
            cr.set_source_rgba(0, 0, 0, 0.5)
            cr.paint()

            if self.selection_start and self.selection_end:
                # Reveal the selected area at full brightness
                x, y, w, h = self._get_rect(self.selection_start, self.selection_end)
                
                cr.save()
                cr.rectangle(x, y, w, h)
                cr.clip()
                cr.set_source_surface(surface, 0, 0)
                cr.paint()
                cr.restore()
                
                # Selection border
                cr.set_source_rgba(*ACCENT_BLUE, 0.8)
                cr.set_line_width(1)
                cr.rectangle(x, y, w, h)
                cr.stroke()
            else:
                # "Click and Drag" hint text
                cr.set_font_size(20)
                hint = "Click and Drag to select area"
                ext = cr.text_extents(hint)
                cr.move_to(allocation.width/2 - ext.width/2, 180)
                
                # Blue outline for visibility on light backgrounds
                cr.text_path(hint)
                cr.set_source_rgba(*ACCENT_BLUE, 0.8)
                cr.set_line_width(0.8)
                cr.stroke_preserve()
                
                cr.set_source_rgba(1, 1, 1, 1)
                cr.fill()
        
        elif self.state == AppState.ANNOTATING:
            x, y, w, h = self.rect
            # Even-Odd fill: dim everything except the crop rectangle
            cr.save()
            cr.set_fill_rule(cairo.FillRule.EVEN_ODD)
            cr.set_source_rgba(0, 0, 0, 0.4)
            cr.rectangle(0, 0, allocation.width, allocation.height)
            cr.rectangle(x, y, w, h)
            cr.fill()
            cr.restore()
            
            # Crop frame border
            cr.set_source_rgb(0, 0.6, 1.0)
            cr.set_line_width(1)
            cr.rectangle(x, y, w, h)
            cr.stroke()
            
            # Corner and edge resize handles
            hs = HANDLE_HALF  # half-size of each square handle
            def draw_handle(hx, hy):
                cr.set_source_rgb(1, 1, 1)
                cr.rectangle(hx - hs, hy - hs, hs * 2, hs * 2)
                cr.fill()
                cr.set_source_rgb(*ACCENT_BLUE)
                cr.set_line_width(1)
                cr.rectangle(hx - hs, hy - hs, hs * 2, hs * 2)
                cr.stroke()
            
            draw_handle(x, y)
            draw_handle(x + w/2, y)
            draw_handle(x + w, y)
            draw_handle(x, y + h/2)
            draw_handle(x + w, y + h/2)
            draw_handle(x, y + h)
            draw_handle(x + w/2, y + h)
            draw_handle(x + w, y + h)

            # Draw all committed annotations
            for ann in self.annotations:
                self._draw_annotation(cr, ann)
            
            # Live preview of the shape being drawn right now
            if self.current_ann:
                self._draw_annotation(cr, self.current_ann)


    # --- Geometry & hit detection ---

    def _get_rect(self, start, end, force_square=False, ann=None):
        """Normalize two points into (x, y, w, h). For text, uses Pango layout size."""
        x1, y1 = start
        x2, y2 = end
        
        # Text: use start/end directly (set at creation, updated by resize)
        if ann and ann.type == 'text':
            return (x1, y1, abs(x2 - x1), abs(y2 - y1))

        # Draw uses bounding box of its points list
        if ann and ann.type == 'draw' and ann.points:
            xs = [p[0] for p in ann.points]
            ys = [p[1] for p in ann.points]
            mx, my = min(xs), min(ys)
            return (mx, my, max(xs) - mx, max(ys) - my)


        x = min(x1, x2)
        y = min(y1, y2)
        w = abs(x1 - x2)
        h = abs(y1 - y2)
        

        if force_square:
            size = max(w, h)
            w = size
            h = size
            
        return (x, y, w, h)

    def _undo(self):
        """Pop the last annotation onto the redo stack."""
        if self.annotations:
            ann = self.annotations.pop()
            if not hasattr(self, 'redo_stack'):
                self.redo_stack = []
            self.redo_stack.append(ann)
            self.queue_draw()

    def _redo(self):
        """Restore the last undone annotation."""
        if getattr(self, 'redo_stack', None):
            ann = self.redo_stack.pop()
            self.annotations.append(ann)
            self.queue_draw()

    def _find_ann_at(self, x, y):
        """Find the topmost annotation at (x, y), using HIT_MARGIN grace area."""
        m = HIT_MARGIN
        for ann in reversed(self.annotations):
            ax, ay, aw, ah = self._get_rect(ann.start, ann.end, force_square=False, ann=ann)
            if ax - m <= x <= ax + aw + m and ay - m <= y <= ay + ah + m:
                return ann
        return None

    def _get_crop_handle_at(self, x, y):
        """Return which resize handle ('nw','n','ne',...) the mouse is near, or None."""
        if not self.rect: return None
        rx, ry, rw, rh = self.rect
        margin = HIT_MARGIN
        
        # Corners first (higher priority)
        if abs(x - rx) <= margin and abs(y - ry) <= margin: return 'nw'
        if abs(x - (rx + rw)) <= margin and abs(y - ry) <= margin: return 'ne'
        if abs(x - rx) <= margin and abs(y - (ry + rh)) <= margin: return 'sw'
        if abs(x - (rx + rw)) <= margin and abs(y - (ry + rh)) <= margin: return 'se'
        
        # Edges
        if ry - margin <= y <= ry + margin and rx <= x <= rx + rw: return 'n'
        if (ry + rh) - margin <= y <= (ry + rh) + margin and rx <= x <= rx + rw: return 's'
        if rx - margin <= x <= rx + margin and ry <= y <= ry + rh: return 'w'
        if (rx + rw) - margin <= x <= (rx + rw) + margin and ry <= y <= ry + rh: return 'e'
        
        return None

    def _update_cursor(self):
        """Set the appropriate resize/move cursor based on what's hovered."""
        window = self.get_window()
        if not window: return
        display = window.get_display()
        cursor_name = "default"
        
        handle = getattr(self, 'hovered_crop_handle', None)
        outside = getattr(self, 'hovered_crop_outside', False)
        

        if handle:
            if handle in ['nw', 'se']: cursor_name = "nwse-resize"
            elif handle in ['ne', 'sw']: cursor_name = "nesw-resize"
            elif handle in ['n', 's']: cursor_name = "ns-resize"
            elif handle in ['e', 'w']: cursor_name = "ew-resize"
        elif outside:
            cursor_name = "move"
        
        cursor = Gdk.Cursor.new_from_name(display, cursor_name)
        window.set_cursor(cursor)

    # --- Context toolbar (per-annotation floating buttons) ---

    def _draw_context_toolbar(self, cr, ann):
        """Draw the small Resize/Rotate/Delete/Edit toolbar above a selected annotation."""
        ax, ay, aw, ah = self._get_rect(ann.start, ann.end, force_square=False, ann=ann)
        cx = ax + aw/2
        ty = ay - 42
        
        is_text = (ann.type == 'text')
        n_buttons = 4 if is_text else 3
        btn_spacing = 24
        width = n_buttons * btn_spacing + 16
        icon_size = 16
        
        cr.save()
        cr.identity_matrix()  # toolbar shouldn't rotate with the object
        
        # Dark bubble background
        cr.set_source_rgba(0.1, 0.1, 0.1, 0.95)
        cr.rectangle(cx - width/2, ty, width, 28)
        cr.fill()
        
        # Blue accent border
        cr.set_source_rgba(*ACCENT_BLUE, 0.8)
        cr.set_line_width(1.5)
        cr.rectangle(cx - width/2, ty, width, 28)
        cr.stroke()
        
        # Tool icons
        icon_y = ty + 14
        if is_text:
            # 4 buttons: resize, edit, delete, rotate
            half = btn_spacing * 1.5
            self._draw_mini_icon(cr, cx - half, icon_y, 'resize', self.edit_mode == 'resize', icon_size)
            self._draw_mini_icon(cr, cx - btn_spacing/2, icon_y, 'edit', self.edit_mode == 'edit', icon_size)
            self._draw_mini_icon(cr, cx + btn_spacing/2, icon_y, 'delete', False, icon_size)
            self._draw_mini_icon(cr, cx + half, icon_y, 'rotate', self.edit_mode == 'rotate', icon_size)
        else:
            # 3 buttons: resize, delete, rotate
            self._draw_mini_icon(cr, cx - btn_spacing, icon_y, 'resize', self.edit_mode == 'resize', icon_size)
            self._draw_mini_icon(cr, cx, icon_y, 'delete', False, icon_size)
            self._draw_mini_icon(cr, cx + btn_spacing, icon_y, 'rotate', self.edit_mode == 'rotate', icon_size)
        cr.restore()

    def _draw_mini_icon(self, cr, x, y, type, active, size=20):
        pix = create_tool_icon(type, size=size, active=active)
        cr.save()
        Gdk.cairo_set_source_pixbuf(cr, pix, x - size//2, y - size//2)
        cr.paint()
        cr.restore()

    def _get_context_btn_at(self, ann, x, y):
        """Check if (x, y) is over one of the context toolbar buttons."""
        ax, ay, aw, ah = self._get_rect(ann.start, ann.end, force_square=False, ann=ann)
        cx = ax + aw/2
        ty = ay - 42
        btn_spacing = 24
        
        if ty <= y <= ty + 28:
            is_text = (ann.type == 'text')
            if is_text:
                # 4 buttons: resize, edit, delete, rotate
                half = btn_spacing * 1.5
                if abs(x - (cx - half)) <= 12: return 'resize'
                if abs(x - (cx - btn_spacing/2)) <= 12: return 'edit'
                if abs(x - (cx + btn_spacing/2)) <= 12: return 'delete'
                if abs(x - (cx + half)) <= 12: return 'rotate'
            else:
                # 3 buttons: resize, delete, rotate
                if abs(x - (cx - btn_spacing)) <= 12: return 'resize'
                if abs(x - cx) <= 12: return 'delete'
                if abs(x - (cx + btn_spacing)) <= 12: return 'rotate'
        return None

    # --- Annotation rendering ---

    def _draw_annotation(self, cr, ann, is_export=False):
        """Render a single annotation: rotation, hover glow, selection frame, and shape."""
        ax, ay, aw, ah = self._get_rect(ann.start, ann.end, force_square=False, ann=ann)
        cx = ax + aw/2
        cy = ay + ah/2

        # Hover glow (faint blue outline)
        if not is_export and ann == self.hovered_ann and ann != self.selected_ann:
            cr.save()
            try:
                cr.translate(cx, cy)
                cr.rotate(ann.angle)
                cr.translate(-cx, -cy)
                cr.set_source_rgba(*ACCENT_BLUE, 0.15)
                cr.set_line_width(ann.width + 6)
                if ann.type == 'rect': cr.rectangle(ax, ay, aw, ah)
                elif ann.type == 'ellipse':
                    if aw > 0 and ah > 0:
                        cr.save()
                        cr.translate(ax + aw/2, ay + ah/2)
                        cr.scale(aw/2, ah/2)
                        cr.arc(0, 0, 1, 0, 2*math.pi)
                        cr.restore()
                cr.stroke()
            finally:
                cr.restore()

        # Selected: show context toolbar + dashed border
        if not is_export and ann == self.selected_ann:
            self._draw_context_toolbar(cr, ann)
            
            cr.save()
            try:
                cr.translate(cx, cy)
                cr.rotate(ann.angle)
                cr.translate(-cx, -cy)
                
                # Selection tint
                cr.set_source_rgba(0.2, 0.6, 1.0, 0.1)
                cr.rectangle(ax-4, ay-4, aw+8, ah+8)
                cr.fill()
                
                # Dashed border
                cr.set_source_rgba(0.2, 0.6, 1.0, 0.8)
                cr.set_dash([4, 4])
                cr.set_line_width(1.5)
                cr.rectangle(ax-4, ay-4, aw+8, ah+8)
                cr.stroke()
            finally:
                cr.restore()

        # Draw the actual shape (try/finally ensures cr.restore even if drawing throws)
        cr.save()
        try:
            cr.translate(cx, cy)
            cr.rotate(ann.angle)
            cr.translate(-cx, -cy)

            cr.set_source_rgb(*ann.color)
            cr.set_line_width(ann.width)

            if ann.type == 'rect':
                cr.rectangle(ax, ay, aw, ah)
                cr.stroke()
            elif ann.type == 'arrow':
                self._draw_arrow(cr, ann.start[0], ann.start[1], ann.end[0], ann.end[1])
            elif ann.type == 'ellipse':
                if aw > 0 and ah > 0:
                    cr.save()
                    cr.translate(ax + aw/2, ay + ah/2)
                    cr.scale(aw/2, ah/2)
                    cr.arc(0, 0, 1, 0, 2*math.pi)
                    cr.restore()
                    cr.stroke()
            elif ann.type == 'text':
                if hasattr(ann, 'text'):
                    # Cache layout on the annotation to avoid recreating every draw
                    cache_key = (ann.text, ann.width)
                    if getattr(ann, '_layout_cache_key', None) != cache_key:
                        ann._cached_layout = self.create_pango_layout(ann.text)
                        font_size = 10 + (ann.width * 3)
                        font = Pango.FontDescription(f"Sans Bold {font_size}")
                        ann._cached_layout.set_font_description(font)
                        ann._layout_cache_key = cache_key
                    layout = ann._cached_layout
                    # Scale text to fit the bounding box if it's been resized
                    nat_w, nat_h = layout.get_pixel_size()
                    if nat_w > 0 and nat_h > 0 and aw > 0 and ah > 0:
                        sx = aw / nat_w
                        sy = ah / nat_h
                        cr.save()
                        cr.translate(ax, ay)
                        cr.scale(sx, sy)
                        PangoCairo.show_layout(cr, layout)
                        cr.restore()
                    else:
                        cr.move_to(ax, ay)
                        PangoCairo.show_layout(cr, layout)
            elif ann.type == 'draw':
                # Freehand path through all collected points
                if ann.points and len(ann.points) > 1:
                    cr.move_to(*ann.points[0])
                    for pt in ann.points[1:]:
                        cr.line_to(*pt)
                    cr.stroke()
            elif ann.type == 'highlight':
                # Semi-transparent filled rectangle
                r, g, b = ann.color
                cr.set_source_rgba(r, g, b, 0.35)
                cr.rectangle(ax, ay, aw, ah)
                cr.fill()
        finally:
            cr.restore()

    # --- Arrow drawing ---

    def _draw_arrow(self, cr, x1, y1, x2, y2):
        """Draw an arrow line with a solid triangular head scaled to width."""
        angle = math.atan2(y2 - y1, x2 - x1)
        # Scale arrow head so it always dominates the line thickness
        lw = cr.get_line_width()
        arrow_len = 10 + (lw * 3)
        arrow_half_w = arrow_len / 3

        # Stop the shaft at the arrowhead base so the thick line
        # doesn't cover the pointy tip
        shaft_x = x2 - math.cos(angle) * arrow_len
        shaft_y = y2 - math.sin(angle) * arrow_len

        cr.move_to(x1, y1)
        cr.line_to(shaft_x, shaft_y)
        cr.stroke()

        # Solid triangular head — tip at (x2, y2)
        cr.save()
        cr.translate(x2, y2)
        cr.rotate(angle)
        cr.move_to(0, 0)
        cr.line_to(-arrow_len, arrow_half_w)
        cr.line_to(-arrow_len, -arrow_half_w)
        cr.close_path()
        cr.fill()
        cr.restore()

    def _prompt_text(self, x, y, ann=None):
        """Show a dialog to enter/edit annotation text."""
        dialog = Gtk.MessageDialog(
            transient_for=self,
            flags=0,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.OK_CANCEL,
            text=_("Edit Text:") if ann else _("Enter text to insert:")
        )
        entry = Gtk.Entry()
        if ann: entry.set_text(ann.text)
        entry.set_activates_default(True)
        dialog.get_content_area().add(entry)
        dialog.show_all()
        
        response = dialog.run()
        if response == Gtk.ResponseType.OK:
            text = entry.get_text()
            if text.strip():
                if ann:
                    ann.text = text
                    self._update_text_bounds(ann)
                else:
                    if self.state == AppState.ANNOTATING:
                        new_ann = Annotation('text', (x, y), (x+10, y+10), self.current_color, self.line_width)
                        new_ann.text = text
                        self._update_text_bounds(new_ann)
                        self.annotations.append(new_ann)
                        
                        # Switch back to pointer tool after entering text
                        self.current_tool = 'select'
                        if 'select' in self.tool_buttons:
                            self.tool_buttons['select'].set_active(True)
                self.queue_draw()
        dialog.destroy()


    # --- Mouse handlers ---

    def on_button_press(self, widget, event):
        """Handle left-click: start selection, pick annotation, or begin drawing."""
        if event.button != 1: return


        if self.state == AppState.SELECTING:
            self.selection_start = (event.x, event.y)
            return


        if self.state == AppState.ANNOTATING:
            # Check crop handles first
            handle = getattr(self, 'hovered_crop_handle', None)
            outside = getattr(self, 'hovered_crop_outside', False)
            
            if handle and not self.selected_ann:
                self.active_crop_handle = handle
                self.crop_drag_start_rect = self.rect
                self.crop_drag_start_pos = (event.x, event.y)
                return
            elif outside and not self.selected_ann:
                # Clicking outside crop area = move the whole frame
                self.active_crop_handle = 'move'
                self.crop_drag_start_rect = self.rect
                self.crop_drag_start_pos = (event.x, event.y)
                return
                
            # Check context toolbar buttons (resize/rotate/edit/delete)
            if self.selected_ann:
                btn = self._get_context_btn_at(self.selected_ann, event.x, event.y)
                if btn:
                    if btn == 'delete':
                        if self.selected_ann in self.annotations:
                            self.annotations.remove(self.selected_ann)
                        self.selected_ann = None
                        self.queue_draw()
                        return
                    elif btn == 'edit' and self.selected_ann.type == 'text':
                        self._prompt_text(event.x, event.y, ann=self.selected_ann)
                    elif btn == 'resize':
                        self.active_handle = 'resize_icon'
                    elif btn == 'rotate':
                        self.active_handle = 'rot'
                    
                    self.drag_start_pos = (event.x, event.y)
                    self.ann_original_pos = (self.selected_ann.start, self.selected_ann.end)
                    if self.selected_ann.type == 'draw':
                        self._ann_original_points = list(self.selected_ann.points)
                    self.queue_draw()
                    return

            # Click on an existing annotation to select/move it
            found = self._find_ann_at(event.x, event.y)
            if found:
                self.selected_ann = found
                self.active_handle = 'move'
                # Slider reflects the selected annotation's size
                if hasattr(self, 'size_scale'):
                    self.size_scale.set_value(found.width)
                self.drag_start_pos = (event.x, event.y)
                self.ann_original_pos = (found.start, found.end)
                if found.type == 'draw':
                    self._ann_original_points = list(found.points)
                self.queue_draw()
                return
            else:
                self.selected_ann = None

            # Nothing was clicked — start a new drawing or re-select area
            if self.current_tool == 'select':
                # Standard behavior: click background = deselect current annotation.
                # We don't start a brand new selection box here to avoid accidental 'resets'.
                # The user can still move/resize the existing box via handles or 'Reset'.
                self.selected_ann = None
                if hasattr(self, 'size_scale'):
                    self.size_scale.set_value(self.base_line_width)
                self.queue_draw()
                return 

            elif self.current_tool == 'text':
                self._prompt_text(event.x, event.y)
            elif self.current_tool == 'draw':
                # Freehand: start collecting points
                ann = Annotation('draw', (event.x, event.y), (event.x, event.y), self.current_color, self.line_width)
                ann.points = [(event.x, event.y)]
                self.current_ann = ann
            else:
                self.current_ann = Annotation(self.current_tool, (event.x, event.y), (event.x, event.y), self.current_color, self.line_width)
            
            self.queue_draw()
            return



    def on_button_release(self, widget, event):
        """Finalize any drag, resize, or drawing in progress."""
        if event.button == 1:
            # Clear crop-drag state
            if getattr(self, 'active_crop_handle', None):
                self.active_crop_handle = None
                self.crop_drag_start_rect = None
                self.crop_drag_start_pos = None
                self.queue_draw()
                return
                
            if hasattr(self, 'active_handle'):
                delattr(self, 'active_handle')
                if hasattr(self, 'drag_start_pos'):
                    delattr(self, 'drag_start_pos')
                return
            if hasattr(self, 'drag_start_pos'):
                delattr(self, 'drag_start_pos')
                return
                
            # Finalize capture rect after drag
            if self.state == AppState.SELECTING or (self.state == AppState.ANNOTATING and self.current_tool == 'select' and self.selection_start):
                is_reselect = (self.state == AppState.ANNOTATING)
                if self.selection_start:
                    x, y, w, h = self._get_rect(self.selection_start, (event.x, event.y))
                    
                    # Ignore tiny accidental drags when re-selecting
                    if is_reselect and w < 10 and h < 10:
                        pass 
                    else:
                        self.rect = (x, y, max(w, 1), max(h, 1))
                

                if (self.rect and self.rect[2] > 20 and self.rect[3] > 20) or is_reselect:
                    if self.state == AppState.SELECTING:
                        self.annotations = []
                    
                    self.state = AppState.ANNOTATING
                    if self.toolbar_box: self.toolbar_box.show_all()
                else:
                    # Tiny click in initial selection mode — ignore it
                    self.state = AppState.SELECTING
                    self.rect = None

                self.selection_start = None
                self.queue_draw()
            elif self.state == AppState.ANNOTATING:
                # Commit the current drawing to the list
                if self.current_ann:
                    # For draw: compute bounding box from collected points
                    if self.current_ann.type == 'draw' and self.current_ann.points:
                        xs = [p[0] for p in self.current_ann.points]
                        ys = [p[1] for p in self.current_ann.points]
                        self.current_ann.start = (min(xs), min(ys))
                        self.current_ann.end = (max(xs), max(ys))
                    
                    # Prevent tiny accidental shapes (less than 5px drag)
                    # Text is always allowed as it's from a dialog
                    x1, y1 = self.current_ann.start
                    x2, y2 = self.current_ann.end
                    dist = math.sqrt((x2-x1)**2 + (y2-y1)**2)
                    
                    if self.current_ann.type == 'text' or dist > 5:
                        self.annotations.append(self.current_ann)
                        # Clear redo stack on new annotation (standard undo/redo semantics)
                        if hasattr(self, 'redo_stack'):
                            self.redo_stack.clear()
                        # Cap undo history to prevent unbounded memory growth
                        if len(self.annotations) > MAX_UNDO_HISTORY:
                            self.annotations.pop(0)
                        
                    self.current_ann = None
                    if self.toolbar_box: self.toolbar_box.show_all()
                    self.queue_draw()

    def on_motion_notify(self, widget, event):
        """Update geometry while dragging: live feedback for selection, drawing, resizing."""
        self.mouse_pos = (event.x, event.y)
        
        # Resizing/moving the crop rectangle
        if getattr(self, 'active_crop_handle', None):
            dx = event.x - self.crop_drag_start_pos[0]
            dy = event.y - self.crop_drag_start_pos[1]
            rx, ry, rw, rh = self.crop_drag_start_rect
            
            h = self.active_crop_handle
            
            if h == 'move':
                new_rx = max(0, min(self.width - rw, rx + dx))
                new_ry = max(0, min(self.height - rh, ry + dy))
                self.rect = (new_rx, new_ry, rw, rh)
                self.queue_draw()
                return

            new_rx, new_ry, new_rw, new_rh = rx, ry, rw, rh
            
            min_size = 50  # don't collapse to nothing
            if 'n' in h:
                new_ry = min(ry + dy, ry + rh - min_size)
                new_rh = ry + rh - new_ry
            if 's' in h:
                new_rh = max(rh + dy, min_size)
            if 'w' in h:
                new_rx = min(rx + dx, rx + rw - min_size)
                new_rw = rx + rw - new_rx
            if 'e' in h:
                new_rw = max(rw + dx, min_size)
                
            self.rect = (new_rx, new_ry, new_rw, new_rh)
            self.queue_draw()
            return
        
        # Manipulating an existing annotation (move/resize/rotate)
        if self.selected_ann and hasattr(self, 'active_handle'):
            if self.active_handle == 'rot':
                ax, ay, aw, ah = self._get_rect(self.selected_ann.start, self.selected_ann.end, force_square=False, ann=self.selected_ann)
                cx, cy = ax + aw/2, ay + ah/2
                # Calculate angle from center to mouse
                self.selected_ann.angle = math.atan2(event.y - cy, event.x - cx) + math.pi/2
                self.queue_draw()
                return
            
            if self.active_handle == 'resize_icon':
                dx = event.x - self.drag_start_pos[0]
                dy = event.y - self.drag_start_pos[1]
                (s_old, e_old) = self.ann_original_pos
                new_end = (e_old[0] + dx, e_old[1] + dy)
                self.selected_ann.end = new_end
                
                # For text: calculate and store the new scaling factor relative to natural size
                if self.selected_ann.type == 'text':
                    layout = self.create_pango_layout(self.selected_ann.text)
                    fs = 10 + (self.selected_ann.width * 3)
                    layout.set_font_description(Pango.FontDescription(f"Sans Bold {fs}"))
                    nat_w, nat_h = layout.get_pixel_size()
                    aw = self.selected_ann.end[0] - self.selected_ann.start[0]
                    ah = self.selected_ann.end[1] - self.selected_ann.start[1]
                    if nat_w > 0 and nat_h > 0:
                        self.selected_ann.sx = aw / nat_w
                        self.selected_ann.sy = ah / nat_h
                # For draw: scale all points to match the new bounding box
                if self.selected_ann.type == 'draw' and hasattr(self, '_ann_original_points'):
                    orig_pts = self._ann_original_points
                    ox, oy = s_old
                    ow = e_old[0] - s_old[0]
                    oh = e_old[1] - s_old[1]
                    nw = new_end[0] - s_old[0]
                    nh = new_end[1] - s_old[1]
                    if abs(ow) > 1 and abs(oh) > 1:
                        sx = nw / ow
                        sy = nh / oh
                        self.selected_ann.points = [(ox + (px - ox) * sx, oy + (py - oy) * sy) for px, py in orig_pts]
                self.queue_draw()
                return

            # Default: move the whole object
            dx = event.x - self.drag_start_pos[0]
            dy = event.y - self.drag_start_pos[1]
            (s_old, e_old) = self.ann_original_pos
            self.selected_ann.start = (s_old[0] + dx, s_old[1] + dy)
            self.selected_ann.end = (e_old[0] + dx, e_old[1] + dy)
            # For draw: offset all points too
            if self.selected_ann.type == 'draw' and hasattr(self, '_ann_original_points'):
                self.selected_ann.points = [(px + dx, py + dy) for px, py in self._ann_original_points]
            self.queue_draw()
            return

        # Dragging a new selection or shape
        if self.state == AppState.SELECTING or (self.state == AppState.ANNOTATING and self.current_tool == 'select' and self.selection_start):
            if self.selection_start:
                self.selection_end = (event.x, event.y)
                if self.state == AppState.ANNOTATING:
                    self.rect = self._get_rect(self.selection_start, self.selection_end)
            self.queue_draw()
            return

        if getattr(self, 'current_ann', None):
            if self.current_ann.type == 'draw':
                # Freehand: append point only if far enough from last (distance throttle)
                last = self.current_ann.points[-1]
                dx_pt = event.x - last[0]
                dy_pt = event.y - last[1]
                if dx_pt * dx_pt + dy_pt * dy_pt >= FREEHAND_MIN_DIST_SQ:
                    self.current_ann.points.append((event.x, event.y))
                self.current_ann.end = (event.x, event.y)
            else:
                self.current_ann.end = (event.x, event.y)
            self.queue_draw()
            return

        # Hover detection (no drag active)
        if self.state == AppState.ANNOTATING:
            new_hover = self._find_ann_at(event.x, event.y)
            hover_changed = (new_hover != self.hovered_ann)
            if hover_changed:
                self.hovered_ann = new_hover
            
            cursor_changed = False
            # Update cursor only when idle (no active drag)
            if not getattr(self, 'current_ann', None) and not hasattr(self, 'active_handle') and not hasattr(self, 'drag_start_pos') and not getattr(self, 'active_crop_handle', None):
                if not new_hover:
                    handle = self._get_crop_handle_at(event.x, event.y)
                    if handle != getattr(self, 'hovered_crop_handle', None):
                        self.hovered_crop_handle = handle
                        self.hovered_crop_outside = False
                        self._update_cursor()
                        cursor_changed = True
                    elif not handle:
                        # Is the mouse outside the active crop area?
                        rx, ry, rw, rh = self.rect
                        margin = HIT_MARGIN
                        is_outside = not (rx - margin <= event.x <= rx + rw + margin and ry - margin <= event.y <= ry + rh + margin)
                        if is_outside != getattr(self, 'hovered_crop_outside', False):
                            self.hovered_crop_outside = is_outside
                            self._update_cursor()
                            cursor_changed = True
                else:
                    # Clear crop handles when hovering over an annotation
                    if getattr(self, 'hovered_crop_handle', None) or getattr(self, 'hovered_crop_outside', False):
                        self.hovered_crop_handle = None
                        self.hovered_crop_outside = False
                        self._update_cursor()
                        cursor_changed = True

            # Only repaint when hover state actually changed (avoids needless full redraws)
            if hover_changed or cursor_changed:
                self.queue_draw()

    # --- Toolbar ---

    def on_key_press(self, widget, event):
        """Handle keyboard shortcuts: Esc, Ctrl+Z/Y, Ctrl+S, Ctrl+C."""
        ctrl = event.state & Gdk.ModifierType.CONTROL_MASK
        shift = event.state & Gdk.ModifierType.SHIFT_MASK

        if event.keyval == Gdk.KEY_Escape:
            Gtk.main_quit()
        elif event.keyval == Gdk.KEY_Delete:
            if self.selected_ann and self.selected_ann in self.annotations:
                self.annotations.remove(self.selected_ann)
                self.selected_ann = None
                self.queue_draw()
        elif ctrl and not shift and event.keyval == Gdk.KEY_z:
            self._undo()
        elif ctrl and (event.keyval == Gdk.KEY_y or (shift and event.keyval == Gdk.KEY_z)):
            self._redo()
        elif ctrl and event.keyval == Gdk.KEY_s:
            self._save_screenshot(show_dialog=True)
        elif ctrl and event.keyval == Gdk.KEY_c:
            self._save_screenshot(only_clipboard=True)
