#!/usr/bin/env python3

import sys
import os
import json
import gi
import signal
import argparse

gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib, Gdk #, Pango

class MonitorNav:
    def __init__(self):
        self.history = []
        self.max_history = 120 # Keep 2 minutes of history @ 1s interval (adjustable)
        
        # Parse Args
        parser = argparse.ArgumentParser()
        parser.add_argument("--x", type=float, default=0)
        parser.add_argument("--y", type=float, default=0)
        parser.add_argument("--width", type=float, default=0)
        parser.add_argument("--height", type=float, default=0)
        parser.add_argument("--orientation", type=int, default=1) # Default BOTTOM
        # Settings Args
        parser.add_argument("--interval", type=float, default=1.5)
        parser.add_argument("--color-gpu", type=str, default="#0ed815")
        parser.add_argument("--color-mem", type=str, default="#fbff07")
        parser.add_argument("--color-temp", type=str, default="#f51717")
        parser.add_argument("--color-fan", type=str, default="#7805e4")
        parser.add_argument("--color-bg", type=str, default="#000000")
        parser.add_argument("--color-axis-temp", type=str, default="#ffffff")
        parser.add_argument("--color-axis-pct", type=str, default="#ffffff")
        parser.add_argument("--color-axis-x", type=str, default="#ffffff")
        parser.add_argument("--color-grid", type=str, default="rgba(255,255,255,0.3)")
        parser.add_argument("--ysteps", type=int, default=3)
        parser.add_argument("--temp-unit", type=str, default="C")
        parser.add_argument("--xsteps", type=int, default=3)
        parser.add_argument("--xunit", type=str, default="seconds")
        parser.add_argument("--xlength", type=float, default=60)
        
        self.args = parser.parse_args()

        # Config derived from args
        self.interval = max(0.5, self.args.interval)
        self.max_history = int(self.args.xlength / self.interval) if self.args.xunit == 'seconds' else \
                           int((self.args.xlength * 60) / self.interval) if self.args.xunit == 'minutes' else \
                           int((self.args.xlength * 3600) / self.interval)
        
        self.colors = {
            'gpu': self.hex_to_rgb(self.args.color_gpu),
            'mem': self.hex_to_rgb(self.args.color_mem),
            'temp': self.hex_to_rgb(self.args.color_temp),
            'fan': self.hex_to_rgb(self.args.color_fan),
            'bg': self.hex_to_rgb(self.args.color_bg),
            'axis_temp': self.hex_to_rgb(self.args.color_axis_temp),
            'axis_pct': self.hex_to_rgb(self.args.color_axis_pct),
            'axis_x': self.hex_to_rgb(self.args.color_axis_x),
            'grid': self.hex_to_rgb(self.args.color_grid)
        }

        # Visibility states (default all true)
        self.show_gpu = True
        self.show_mem = True
        self.show_temp = True
        self.show_fan = True
        
        # Load UI
        curr_dir = os.path.dirname(os.path.realpath(__file__))
        glade_file = os.path.join(curr_dir, "../ui/monitor_window.glade")
        
        self.builder = Gtk.Builder()
        self.builder.add_from_file(glade_file)
        
        self.window = self.builder.get_object("monitor_window")
        self.graph_area = self.builder.get_object("graph_area")
        labels: list[str] = ["label_gpu","label_mem","label_temp","label_fan"]
        for lbl_name in labels:
            lbl =self.builder.get_object(lbl_name)
            setattr(self, lbl_name, lbl)
            lbl.set_name(lbl_name) # For CSS targeting
            lbl.set_attributes(None) # Clear Glade attributes to allow markup updates

        # Position Window
        self.setup_window_position(self.args)

        # Add toggle controls
        self.add_controls()

        # Connect signals
        self.builder.connect_signals(self)
        self.window.connect("destroy", Gtk.main_quit)
        self.graph_area.connect("draw", self.on_draw)
        
        # Tooltip interactions
        self.graph_area.add_events(Gdk.EventMask.POINTER_MOTION_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK)
        self.graph_area.connect("motion-notify-event", self.on_mouse_move)
        self.graph_area.connect("leave-notify-event", self.on_mouse_leave)
        self.tooltip_idx = -1
        
        # Setup stdin reading
        io_channel = GLib.IOChannel(sys.stdin.fileno())
        GLib.io_add_watch(io_channel, GLib.PRIORITY_DEFAULT, GLib.IOCondition.IN | GLib.IOCondition.HUP, self.on_stdin_data)

        self.window.show_all()

    def hex_to_rgb(self, color_str):
        # Unified robust color parser
        try:
            c = color_str.strip("'\" ")
            # Handle hex
            if c.startswith("#"):
                hex_s = c.lstrip("#")
                if len(hex_s) == 3: hex_s = "".join(x*2 for x in hex_s)
                if len(hex_s) >= 6:
                    r = int(hex_s[0:2], 16) / 255.0
                    g = int(hex_s[2:4], 16) / 255.0
                    b = int(hex_s[4:6], 16) / 255.0
                    a = 1.0
                    if len(hex_s) == 8: a = int(hex_s[6:8], 16) / 255.0
                    return (r, g, b, a)
            
            # Handle rgb/rgba
            elif c.startswith("rgb"):
                content = c.split('(')[1].split(')')[0]
                parts = [x.strip() for x in content.split(',')]
                if len(parts) >= 3:
                     vals = [float(x) for x in parts]
                     r, g, b = vals[0], vals[1], vals[2]
                     a = vals[3] if len(vals) > 3 else 1.0
                     # Normalize if 0-255 range
                     if r > 1.0 or g > 1.0 or b > 1.0:
                         r /= 255.0; g /= 255.0; b /= 255.0
                     return (r, g, b, a)
        except Exception as e:
            print(f"Error parsing color '{color_str}': {e}", file=sys.stderr)
            return (1.0, 0.0, 1.0, 1.0) # Error magenta

        return (1.0, 1.0, 1.0, 1.0) # Fallback white

    def parse_to_pango_hex(self, color_str):
        """Converts rgba/rgb string to Pango hex color #RRGGBBAA using consistent parser"""
        r, g, b, a = self.hex_to_rgb(color_str)
        return "#%02x%02x%02x%02x" % (int(r*255), int(g*255), int(b*255), int(a*255))
        
    def get_inverse_color(self, hex_bg):
        r, g, b = self.hex_to_rgb(hex_bg)
        luminance = (0.299 * r + 0.587 * g + 0.114 * b)
        return (0, 0, 0) if luminance > 0.5 else (1, 1, 1)

    def add_controls(self):
        # Insert a new HBox at the top of the window vbox for toggles
        # Glade structure: window -> box_main -> (box_header, graph_area, ...)
        # We will insert between header and graph or just append to graph area
        pass
        # Since I can't easily see the GLADE structure ID names, I'll try to find the parent of graph_area
        parent = self.graph_area.get_parent()
        if isinstance(parent, Gtk.Box):
            ctrl_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
            ctrl_box.set_halign(Gtk.Align.CENTER)
            
            # Helper to create styled checkbox
            def create_chk(label, key, color):
                chk = Gtk.CheckButton.new_with_label(label)
                chk.set_active(True)
                chk.connect("toggled", self.on_toggle_visibility, key)
                # Try to colorize (limited in standard GTK3 without custom CSS provider)
                # We can wrap the label in a colored markup if we want, but keeping it simple for now.
                return chk

            self.chk_gpu = create_chk("GPU", 'gpu', self.colors['gpu'])
            self.chk_mem = create_chk("RAM", 'mem', self.colors['mem'])
            self.chk_temp = create_chk("Temp", 'temp', self.colors['temp'])
            self.chk_fan = create_chk("Fan", 'fan', self.colors['fan'])
            
            ctrl_box.pack_start(self.chk_gpu, False, False, 0)
            ctrl_box.pack_start(self.chk_mem, False, False, 0)
            ctrl_box.pack_start(self.chk_temp, False, False, 0)
            ctrl_box.pack_start(self.chk_fan, False, False, 0)
            
            # Find index of graph_area to insert before/after
            # Not crucial, just pack at start (top) or end (bottom)
            # Parent is likely vertical box. Let's put it at the bottom.
            parent.pack_start(ctrl_box, False, False, 0)

    def on_toggle_visibility(self, button, name):
        if name == 'gpu': self.show_gpu = button.get_active()
        elif name == 'mem': self.show_mem = button.get_active()
        elif name == 'temp': self.show_temp = button.get_active()
        elif name == 'fan': self.show_fan = button.get_active()
        self.graph_area.queue_draw()

    def on_mouse_leave(self, widget, event):
        self.tooltip_idx = -1
        widget.queue_draw()

    def on_mouse_move(self, widget, event):
        rect = widget.get_allocation()
        x = event.x
        
        if len(self.history) < 2:
            return
            
        # Determine index corresponding to X
        # Width per data point
        points_to_show = min(len(self.history), self.max_history)
        if points_to_show < 2: return
        
        step_x = rect.width / (self.max_history - 1)
        
        # Cursor X relative to right edge (since graph moves left)
        # But we render from right to left? No, usually left to right for history or right-anchored.
        # Let's check draw logic. Assuming standard time graph: T-max ... T-0
        # If we draw newest at right:
        # data[0] is oldest?
        
        # Let's rely on on_draw to confirm order.
        # For now, just calculate step and trigger redraw with mouse pos
        self.mouse_x = x
        self.graph_area.queue_draw()

    def setup_window_position(self, args):
        # We need the window size to calculate position properly, 
        # but window isn't realized/sized yet.
        # We can use default size from glade for initial calc
        win_w = 600
        win_h = 350
        
        # Args: applet position and size
        x_applet = args.x
        y_applet = args.y
        w_applet = args.width
        h_applet = args.height
        orientation = args.orientation

        # Cinnamon Side: TOP=0, BOTTOM=1, LEFT=2, RIGHT=3
        target_x = 0
        target_y = 0

        screen = Gdk.Screen.get_default()
        screen_w = screen.get_width()
        screen_h = screen.get_height()

        if orientation == 0: # TOP
            target_x = x_applet + (w_applet / 2) - (win_w / 2)
            target_y = y_applet + h_applet + 5 # Little margin
        elif orientation == 1: # BOTTOM
            target_x = x_applet + (w_applet / 2) - (win_w / 2)
            target_y = y_applet - win_h - 5
        elif orientation == 2: # LEFT
            target_x = x_applet + w_applet + 5
            target_y = y_applet + (h_applet / 2) - (win_h / 2)
        elif orientation == 3: # RIGHT
            target_x = x_applet - win_w - 5
            target_y = y_applet + (h_applet / 2) - (win_h / 2)
        
        # Clamp to screen
        target_x = max(0, min(target_x, screen_w - win_w))
        target_y = max(0, min(target_y, screen_h - win_h))

        self.window.move(int(target_x), int(target_y))
        
        # Ensure it's not behind panel if possible?
        # self.window.set_keep_above(True)

    def on_delete_event(self, *args):
        Gtk.main_quit()
        return True

    def on_stdin_data(self, source, condition):
        if condition & GLib.IOCondition.HUP:
            print("Parent closed pipe, exiting...", file=sys.stderr)
            Gtk.main_quit()
            return False

        try:
            # GLib.IOChannel.read_line returns (status, line, length, terminator_pos)
            # We need to unpack 4 values
            result = source.read_line()
            if len(result) == 4:
                status, line, length, terminator_pos = result
            elif len(result) == 3:
                status, line, terminator_pos = result
            else:
                 # Fallback if unsure
                 status = result[0]
                 line = result[1]

            if status == GLib.IOStatus.NORMAL and line:
                self.process_data(line)
        except Exception as e:
            print(f"Error reading stdin: {e}", file=sys.stderr)
            
        return True # Continue watching

    def process_data(self, line):
        try:
            data = json.loads(line)
            
            # Handle commands
            if 'command' in data:
                cmd = data['command']
                if cmd == 'present':
                    self.window.present()
                return

            # Expected format: {"gpu": float, "mem": float, "temp": float, "fan": float, "ts": str}
            
            self.history.append(data)
            # print(f"DEBUG DATA: {data}", file=sys.stderr)
            if len(self.history) > self.max_history:
                self.history.pop(0)
            
            # Update labels with dynamic colors
            def set_lbl(lbl, text, color_raw):
                color_hex = self.parse_to_pango_hex(color_raw)
                lbl.set_markup(f"<span color='{color_hex}'>{text}</span>")

            set_lbl(self.label_gpu, f"GPU: {data.get('gpu', 0):.0f}%", self.args.color_gpu)
            set_lbl(self.label_mem, f"Mem: {data.get('mem', 0):.0f}%", self.args.color_mem)
            
            t_val = data.get('temp', 0)
            t_str = f"{t_val:.0f}°C"
            if self.args.temp_unit == 'F':
                t_str = f"{(t_val*9/5)+32:.0f}°F"
            set_lbl(self.label_temp, f"Temp: {t_str}", self.args.color_temp)
            
            set_lbl(self.label_fan, f"Fan: {data.get('fan', 0):.0f}%", self.args.color_fan)
            self.graph_area.queue_draw()
            
        except json.JSONDecodeError:
            pass # Ignore partial lines
        except Exception as e:
            print(f"Error processing data: {e}", file=sys.stderr)

    def on_draw(self, widget, cr):
        width = widget.get_allocated_width()
        height = widget.get_allocated_height()
        
        # Background
        cr.set_source_rgba(*self.colors['bg'])
        cr.rectangle(0, 0, width, height)
        cr.fill()

        # Axes & Labels Config
        margin_left = 40  # For Temp labels
        margin_right = 40 # For % labels
        margin_bottom = 20 # For Time axis
        margin_top = 10
        
        graph_w = width - margin_left - margin_right
        graph_h = height - margin_bottom - margin_top
        
        if graph_w <= 0 or graph_h <= 0: return # Too small

        self.draw_grid_and_labels(cr, width, height, graph_h, margin_left, margin_right, margin_top, margin_bottom)
        
        coords = self.calculate_coords(width, height, graph_w, graph_h, margin_top, margin_right)
        if not coords: return

        self.draw_data_lines(cr, coords)
        self.draw_tooltip(cr, width, height, margin_top, margin_bottom, coords)

    def draw_grid_and_labels(self, cr, width, height, graph_h, margin_left, margin_right, margin_top, margin_bottom):
        # Colors from settings
        col_axis_temp = self.colors['axis_temp']
        col_axis_pct = self.colors['axis_pct']
        col_axis_x = self.colors['axis_x']
        col_grid = self.colors['grid']

        # Helper to draw text
        cr.set_font_size(10)
        def draw_text(text, x, y, align_right=True, color=col_axis_temp): # careful with default arg
            cr.set_source_rgba(*color)
            extents = cr.text_extents(text)
            text_x = x - extents.width - 2 if align_right else x + 2
            text_y = y + extents.height / 2
            cr.move_to(text_x, text_y)
            cr.show_text(text)

        # Draw Y-Axis Grid & Labels
        cr.set_line_width(1)
        # Determine if we show axes
        show_pct_axis = self.show_gpu or self.show_mem or self.show_fan
        show_temp_axis = self.show_temp

        ysteps = max(1, self.args.ysteps)
        
        for i in range(ysteps + 1):
            ratio = i / float(ysteps)
            y = margin_top + graph_h * (1 - ratio) # 0 at bottom
            
            # Grid Line (Horizontal)
            cr.set_source_rgba(*col_grid)
            cr.move_to(margin_left, y)
            cr.line_to(width - margin_right, y)
            cr.stroke()
            
            # Labels
            # Left: Temp (0 - 110 C)
            if show_temp_axis:
                max_temp = 110
                temp_val_c = int(ratio * max_temp)
                
                label_val = f"{temp_val_c}°C"
                if self.args.temp_unit == "F":
                    temp_val_f = int((temp_val_c * 9/5) + 32)
                    label_val = f"{temp_val_f}°F"

                draw_text(label_val, margin_left, y, align_right=True, color=col_axis_temp)
            
            # Right: Unit % (0 - 100 %)
            if show_pct_axis:
                pct_val = int(ratio * 100)
                draw_text(f"{pct_val}%", width - margin_right, y, align_right=False, color=col_axis_pct)

        # X-Axis Grid & Labels
        # xsteps: number of intervals. e.g. 2 means 3 lines (0, 50, 100) or just internal lines?
        # Usually steps means subdivisions.
        xsteps = max(1, self.args.xsteps) if hasattr(self.args, 'xsteps') else 1

        graph_w = width - margin_left - margin_right 

        for i in range(xsteps + 1):
            ratio = i / float(xsteps)
             # x goes right to left in time? 
             # "Now" is at width - margin_right. 
             # "Oldest" is at margin_left.
             # So 0% (oldest) is left, 100% (now) is right.
            x = margin_left + graph_w * ratio

            # Grid Line (Vertical) - Optional? Plan says "guide labels ... similar to Y-axis lines"
            # If xsteps > 1 or explicitly requested. Let's draw vertical grid lines for intermediate points
            if 0 < i < xsteps: # Don't draw borders if redundant, but here borders are useful
                cr.set_source_rgba(*col_grid)
                cr.move_to(x, margin_top)
                cr.line_to(x, height - margin_bottom)
                cr.stroke()
            
            # Label
            # If ratio=1 -> Now (0s ago). If ratio=0 -> Max Time ago.
            # Time ago = xlength * (1 - ratio)
            
            # We want to label specific points.
            # e.g. if xlength=60s. ratio=0 -> 60s. ratio=0.5 -> 30s. ratio=1 -> 0s.
            time_val = self.args.xlength * (1 - ratio)
            unit_char = self.args.xunit[0]
            
            label_text = ""
            if i == xsteps:
                label_text = "Now"
            else:
                # Format logic
                if unit_char == 's':
                    label_text = f"{int(time_val)}s"
                elif unit_char == 'm': # minutes, maybe show decimals if small?
                    if time_val < 1: label_text = f"{int(time_val*60)}s"
                    else: label_text = f"{time_val:.1f}m".replace('.0m','m')
                else: # hours
                     label_text = f"{time_val:.1f}h".replace('.0h','h')
            
            # Don't draw over Y-axis labels if at edges?
            # At i=0 (left), we might clash with Temp label if it's at bottom?
            # Labels for X axis are usually below the graph.
            
            # Alignment: Center for mid points. Left for left edge? Right for Right edge?
            # Let's just put them at y = height - 5
            
            # For i=0 (Left edge), we already have code drawing start time.
            # For i=xsteps (Right edge), we have code drawing "Now".
            # The original code drew them explicitly outside loop.
            # Now we loop.
            
            tx = x
            if i == 0: tx += 2; align_r = False
            elif i == xsteps: tx -= 2; align_r = True
            else: align_r = False; tx -= 10 # approximate centering? draw_text doesn't center.
            # My draw_text helper only supports align_right or left of x.
            # Let's adjust tx to be center if not edge.
            
            # Actually, let's keep it simple.
            # If i=0, align_right=False (Left aligned to x)
            # If i=xsteps, align_right=True (Right aligned to x)
            # Else, maybe Center?
            
            if 0 < i < xsteps:
                # Manual centering hack
                cr.set_source_rgba(*col_axis_x)
                ext = cr.text_extents(label_text)
                cur_x = x - ext.width/2
                cur_y = height - 5 + ext.height/2
                cr.move_to(cur_x, cur_y)
                cr.show_text(label_text)
            else:
                 draw_text(label_text, x, height - 5, align_right=(i==xsteps), color=col_axis_x)

    def calculate_coords(self, width, height, graph_w, graph_h, margin_top, margin_right):
        if not self.history: return []

        # How many points fit?
        # self.max_history is the capacity for the visible window
        step_x = float(graph_w) / (self.max_history - 1) if self.max_history > 1 else graph_w
        points_to_draw = min(len(self.history), self.max_history)
        
        coords = []
        for i in range(points_to_draw):
            data_idx = len(self.history) - 1 - i
            data = self.history[data_idx]
            
            x = (width - margin_right) - (i * step_x)
            
            def get_y(val, max_val=100.0):
                return margin_top + graph_h * (1 - (val / max_val))
            
            coords.append({
                'x': x,
                'gpu': get_y(data.get('gpu', 0)),
                'mem': get_y(data.get('mem', 0)),
                'temp': get_y(data.get('temp', 0), 110.0), # Temp max 110
                'fan': get_y(data.get('fan', 0)),
                'raw': data,
                'step_x': step_x 
            })
        return coords

    def draw_data_lines(self, cr, coords):
        # Draw Paths
        def draw_line(key, color):
            cr.set_source_rgba(*color)
            cr.set_line_width(2)
            first = True
            for pt in coords:
                if first:
                    cr.move_to(pt['x'], pt[key])
                    first = False
                else:
                    cr.line_to(pt['x'], pt[key])
            cr.stroke()

        if self.show_gpu: draw_line('gpu', self.colors['gpu'])
        if self.show_mem: draw_line('mem', self.colors['mem'])
        if self.show_temp: draw_line('temp', self.colors['temp'])
        if self.show_fan: draw_line('fan', self.colors['fan'])

    def draw_tooltip(self, cr, width, height, margin_top, margin_bottom, coords):
        # Tooltip / Hover Cursor
        if hasattr(self, 'mouse_x') and coords:
             # Need step_x value which we stored in coords
            step_x = coords[0]['step_x']
            margin_right = width - coords[0]['x'] # approx
            # Better: recalculate or check range
            # Range check:
            min_x = coords[-1]['x']
            max_x = coords[0]['x']

            if min_x <= self.mouse_x <= max_x:
                # Find closest point
                # Simple distance check or index calc
                # We can reuse the index calc logic but coords are inverted order in list vs screen X
                # Let's just search closest X
                closest_pt = min(coords, key=lambda pt: abs(pt['x'] - self.mouse_x))
                
                # Draw vertical line
                cr.set_source_rgba(1, 1, 1, 0.5)
                cr.set_line_width(1)
                cr.move_to(closest_pt['x'], margin_top)
                cr.line_to(closest_pt['x'], height - margin_bottom)
                cr.stroke()
                
                # Draw Info Box
                lines = []
                data = closest_pt['raw']
                
                # Time
                ts_str = data.get('ts', '') # e.g. 2024/02/02_12:00:00.000
                if ts_str:
                    # Clean format. Assuming YYYY/MM/DD_HH:MM:SS.msec
                    # Extract HH:MM:SS
                    try:
                        time_part = ts_str.split('_')[1].split('.')[0]
                        lines.append((f"Time: {time_part}", self.colors['axis_x']))
                    except:
                        lines.append((f"Time: {ts_str}", self.colors['axis_x']))
                
                if self.show_gpu: lines.append((f"GPU: {data.get('gpu', 0):.1f}%", self.colors['gpu']))
                if self.show_mem: lines.append((f"MEM: {data.get('mem', 0):.1f}%", self.colors['mem']))
                if self.show_temp: 
                    t_val = data.get('temp', 0)
                    t_s = f"{t_val:.1f}°C"
                    if self.args.temp_unit == 'F':
                        t_s = f"{(t_val*9/5)+32:.1f}°F"
                    lines.append((f"TMP: {t_s}", self.colors['temp']))
                if self.show_fan: lines.append((f"FAN: {data.get('fan', 0):.1f}%", self.colors['fan']))
                
                # Box dims
                box_w = 100
                box_h = len(lines) * 15 + 10
                box_x = closest_pt['x'] + 10
                box_y = margin_top + 10
                
                # Flip if too close to edge
                if box_x + box_w > width:
                    box_x = closest_pt['x'] - box_w - 10
                
                # Box BG
                cr.set_source_rgba(0, 0, 0, 0.8)
                cr.rectangle(box_x, box_y, box_w, box_h)
                cr.fill()
                cr.set_source_rgb(1, 1, 1)
                cr.rectangle(box_x, box_y, box_w, box_h)
                cr.stroke()
                
                # Text
                ty = box_y + 12
                for text, col in lines:
                    cr.set_source_rgba(*col)
                    cr.move_to(box_x + 5, ty)
                    cr.show_text(text)
                    ty += 15


if __name__ == "__main__":
    # Handle Ctrl+C
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    
    app = MonitorNav()
    Gtk.main()
