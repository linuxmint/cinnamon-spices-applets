declare namespace imports.gi.Gdk {

    interface AppLaunchContext extends Gio.AppLaunchContext {
        set_desktop (desktop: number) : void;
        set_display (display: Display) : void;
        set_icon (icon: Gio.Icon) : void;
        set_icon_name (icon_name: string) : void;
        set_screen (screen: Screen) : void;
        set_timestamp (timestamp: number) : void;
    }
    
    var AppLaunchContext: {
        new () : AppLaunchContext;
        
    }
    
    
    
    
    interface Cursor extends GObject.Object {
        get_cursor_type () : CursorType;
        get_display () : Display;
        get_image () : GdkPixbuf.Pixbuf;
        get_surface (x_hot: number, y_hot: number) : cairo.Surface;
        ref () : Cursor;
        unref () : void;
    }
    
    var Cursor: {
        new (cursor_type: CursorType) : Cursor;
        new_for_display (display: Display, cursor_type: CursorType) : Cursor;
        new_from_name (display: Display, name: string) : Cursor;
        new_from_pixbuf (display: Display, pixbuf: GdkPixbuf.Pixbuf, _x: number, _y: number) : Cursor;
        new_from_surface (display: Display, surface: cairo.Surface, _x: number, _y: number) : Cursor;
        
    }
    
    
    
    
    interface Device extends GObject.Object {
        get_associated_device () : Device;
        get_axes () : AxisFlags;
        get_axis (axes: number[], use: AxisUse, value: number) : boolean;
        get_axis_use (index_: number) : AxisUse;
        get_axis_value (axes: number[], axis_label: Atom, value: number) : boolean;
        get_device_type () : DeviceType;
        get_display () : Display;
        get_has_cursor () : boolean;
        get_history (window: Window, start: number, stop: number, events: TimeCoord[], n_events: number) : boolean;
        get_key (index_: number, keyval: number, modifiers: ModifierType) : boolean;
        get_last_event_window () : Window;
        get_mode () : InputMode;
        get_n_axes () : number;
        get_n_keys () : number;
        get_name () : string;
        get_position (screen: Screen, _x: number, _y: number) : void;
        get_position_double (screen: Screen, _x: number, _y: number) : void;
        get_product_id () : string;
        get_seat () : Seat;
        get_source () : InputSource;
        get_state (window: Window, axes: number[], mask: ModifierType) : void;
        get_vendor_id () : string;
        get_window_at_position (win_x: number, win_y: number) : Window;
        get_window_at_position_double (win_x: number, win_y: number) : Window;
        grab (window: Window, grab_ownership: GrabOwnership, owner_events: boolean, event_mask: EventMask, cursor: Cursor, time_: number) : GrabStatus;
        list_axes () : GLib.List;
        list_slave_devices () : GLib.List;
        set_axis_use (index_: number, use: AxisUse) : void;
        set_key (index_: number, keyval: number, modifiers: ModifierType) : void;
        set_mode (mode: InputMode) : boolean;
        ungrab (time_: number) : void;
        warp (screen: Screen, _x: number, _y: number) : void;
    }
    
    var Device: {
        
        free_history (events: TimeCoord[], n_events: number) : void;
        grab_info_libgtk_only (display: Display, device: Device, grab_window: Window, owner_events: boolean) : boolean;
    }
    
    
    
    
    interface DeviceManager extends GObject.Object {
        get_client_pointer () : Device;
        get_display () : Display;
        list_devices (_type: DeviceType) : GLib.List;
    }
    
    var DeviceManager: {
        
        
    }
    
    
    
    
    interface DeviceTool extends GObject.Object {
        get_hardware_id () : number;
        get_serial () : number;
        get_tool_type () : DeviceToolType;
    }
    
    var DeviceTool: {
        
        
    }
    
    
    
    
    interface Display extends GObject.Object {
        beep () : void;
        close () : void;
        device_is_grabbed (device: Device) : boolean;
        flush () : void;
        get_app_launch_context () : AppLaunchContext;
        get_default_cursor_size () : number;
        get_default_group () : Window;
        get_default_screen () : Screen;
        get_default_seat () : Seat;
        get_device_manager () : DeviceManager;
        get_event () : Event;
        get_maximal_cursor_size (width: number, height: number) : void;
        get_monitor (monitor_num: number) : Monitor;
        get_monitor_at_point (_x: number, _y: number) : Monitor;
        get_monitor_at_window (window: Window) : Monitor;
        get_n_monitors () : number;
        get_n_screens () : number;
        get_name () : string;
        get_pointer (screen: Screen, _x: number, _y: number, mask: ModifierType) : void;
        get_primary_monitor () : Monitor;
        get_screen (screen_num: number) : Screen;
        get_window_at_pointer (win_x: number, win_y: number) : Window;
        has_pending () : boolean;
        is_closed () : boolean;
        keyboard_ungrab (time_: number) : void;
        list_devices () : GLib.List;
        list_seats () : GLib.List;
        notify_startup_complete (startup_id: string) : void;
        peek_event () : Event;
        pointer_is_grabbed () : boolean;
        pointer_ungrab (time_: number) : void;
        put_event (event: Event) : void;
        request_selection_notification (selection: Atom) : boolean;
        set_double_click_distance (distance: number) : void;
        set_double_click_time (msec: number) : void;
        store_clipboard (clipboard_window: Window, time_: number, targets: Atom[], n_targets: number) : void;
        supports_clipboard_persistence () : boolean;
        supports_composite () : boolean;
        supports_cursor_alpha () : boolean;
        supports_cursor_color () : boolean;
        supports_input_shapes () : boolean;
        supports_selection_notification () : boolean;
        supports_shapes () : boolean;
        sync () : void;
        warp_pointer (screen: Screen, _x: number, _y: number) : void;
    }
    
    var Display: {
        
        get_default () : Display;
        open (display_name: string) : Display;
        open_default_libgtk_only () : Display;
    }
    
    
    
    
    interface DisplayManager extends GObject.Object {
        get_default_display () : Display;
        list_displays () : GLib.SList;
        open_display (name: string) : Display;
        set_default_display (display: Display) : void;
    }
    
    var DisplayManager: {
        
        get () : DisplayManager;
    }
    
    
    
    
    interface DragContext extends GObject.Object {
        get_actions () : DragAction;
        get_dest_window () : Window;
        get_device () : Device;
        get_drag_window () : Window;
        get_protocol () : DragProtocol;
        get_selected_action () : DragAction;
        get_source_window () : Window;
        get_suggested_action () : DragAction;
        list_targets () : GLib.List;
        manage_dnd (ipc_window: Window, actions: DragAction) : boolean;
        set_device (device: Device) : void;
        set_hotspot (hot_x: number, hot_y: number) : void;
    }
    
    var DragContext: {
        
        
    }
    
    
    
    
    interface DrawingContext extends GObject.Object {
        get_cairo_context () : cairo.Context;
        get_clip () : cairo.Region;
        get_window () : Window;
        is_valid () : boolean;
    }
    
    var DrawingContext: {
        
        
    }
    
    
    
    
    interface FrameClock extends GObject.Object {
        begin_updating () : void;
        end_updating () : void;
        get_current_timings () : FrameTimings;
        get_frame_counter () : number;
        get_frame_time () : number;
        get_history_start () : number;
        get_refresh_info (base_time: number, refresh_interval_return: number, presentation_time_return: number) : void;
        get_timings (frame_counter: number) : FrameTimings;
        request_phase (phase: FrameClockPhase) : void;
    }
    
    var FrameClock: {
        
        
    }
    
    
    
    
    interface GLContext extends GObject.Object {
        get_debug_enabled () : boolean;
        get_display () : Display;
        get_forward_compatible () : boolean;
        get_required_version (major: number, minor: number) : void;
        get_shared_context () : GLContext;
        get_use_es () : boolean;
        get_version (major: number, minor: number) : void;
        get_window () : Window;
        is_legacy () : boolean;
        make_current () : void;
        realize () : boolean;
        set_debug_enabled (enabled: boolean) : void;
        set_forward_compatible (compatible: boolean) : void;
        set_required_version (major: number, minor: number) : void;
        set_use_es (use_es: number) : void;
    }
    
    var GLContext: {
        
        clear_current () : void;
        get_current () : GLContext;
    }
    
    
    
    
    interface Keymap extends GObject.Object {
        add_virtual_modifiers (state: ModifierType) : void;
        get_caps_lock_state () : boolean;
        get_direction () : Pango.Direction;
        get_entries_for_keycode (hardware_keycode: number, keys: KeymapKey[], keyvals: number[], n_entries: number) : boolean;
        get_entries_for_keyval (keyval: number, keys: KeymapKey[], n_keys: number) : boolean;
        get_modifier_mask (intent: ModifierIntent) : ModifierType;
        get_modifier_state () : number;
        get_num_lock_state () : boolean;
        get_scroll_lock_state () : boolean;
        have_bidi_layouts () : boolean;
        lookup_key (key: KeymapKey) : number;
        map_virtual_modifiers (state: ModifierType) : boolean;
        translate_keyboard_state (hardware_keycode: number, state: ModifierType, group: number, keyval: number, effective_group: number, level: number, consumed_modifiers: ModifierType) : boolean;
    }
    
    var Keymap: {
        
        get_default () : Keymap;
        get_for_display (display: Display) : Keymap;
    }
    
    
    
    
    interface Monitor extends GObject.Object {
        get_display () : Display;
        get_geometry (geometry: Rectangle) : void;
        get_height_mm () : number;
        get_manufacturer () : string;
        get_model () : string;
        get_refresh_rate () : number;
        get_scale_factor () : number;
        get_subpixel_layout () : SubpixelLayout;
        get_width_mm () : number;
        get_workarea (workarea: Rectangle) : void;
        is_primary () : boolean;
    }
    
    var Monitor: {
        
        
    }
    
    
    
    
    interface Screen extends GObject.Object {
        get_active_window () : Window;
        get_display () : Display;
        get_font_options () : cairo.FontOptions;
        get_height () : number;
        get_height_mm () : number;
        get_monitor_at_point (_x: number, _y: number) : number;
        get_monitor_at_window (window: Window) : number;
        get_monitor_geometry (monitor_num: number, dest: Rectangle) : void;
        get_monitor_height_mm (monitor_num: number) : number;
        get_monitor_plug_name (monitor_num: number) : string;
        get_monitor_scale_factor (monitor_num: number) : number;
        get_monitor_width_mm (monitor_num: number) : number;
        get_monitor_workarea (monitor_num: number, dest: Rectangle) : void;
        get_n_monitors () : number;
        get_number () : number;
        get_primary_monitor () : number;
        get_resolution () : number;
        get_rgba_visual () : Visual;
        get_root_window () : Window;
        get_setting (name: string, value: GObject.Value) : boolean;
        get_system_visual () : Visual;
        get_toplevel_windows () : GLib.List;
        get_width () : number;
        get_width_mm () : number;
        get_window_stack () : GLib.List;
        is_composited () : boolean;
        list_visuals () : GLib.List;
        make_display_name () : string;
        set_font_options (options: cairo.FontOptions) : void;
        set_resolution (dpi: number) : void;
    }
    
    var Screen: {
        
        get_default () : Screen;
        height () : number;
        height_mm () : number;
        width () : number;
        width_mm () : number;
    }
    
    
    
    
    interface Seat extends GObject.Object {
        get_capabilities () : SeatCapabilities;
        get_display () : Display;
        get_keyboard () : Device;
        get_pointer () : Device;
        get_slaves (capabilities: SeatCapabilities) : GLib.List;
        grab (window: Window, capabilities: SeatCapabilities, owner_events: boolean, cursor: Cursor, event: Event, prepare_func: SeatGrabPrepareFunc, prepare_func_data: any) : GrabStatus;
        ungrab () : void;
    }
    
    var Seat: {
        
        
    }
    
    
    
    
    interface Visual extends GObject.Object {
        get_bits_per_rgb () : number;
        get_blue_pixel_details (mask: number, shift: number, precision: number) : void;
        get_byte_order () : ByteOrder;
        get_colormap_size () : number;
        get_depth () : number;
        get_green_pixel_details (mask: number, shift: number, precision: number) : void;
        get_red_pixel_details (mask: number, shift: number, precision: number) : void;
        get_screen () : Screen;
        get_visual_type () : VisualType;
    }
    
    var Visual: {
        
        get_best () : Visual;
        get_best_depth () : number;
        get_best_type () : VisualType;
        get_best_with_both (depth: number, visual_type: VisualType) : Visual;
        get_best_with_depth (depth: number) : Visual;
        get_best_with_type (visual_type: VisualType) : Visual;
        get_system () : Visual;
    }
    
    
    
    
    interface Window extends GObject.Object {
        add_filter (_function: FilterFunc, data: any) : void;
        beep () : void;
        begin_draw_frame (region: cairo.Region) : DrawingContext;
        begin_move_drag (button: number, root_x: number, root_y: number, timestamp: number) : void;
        begin_move_drag_for_device (device: Device, button: number, root_x: number, root_y: number, timestamp: number) : void;
        begin_paint_rect (rectangle: Rectangle) : void;
        begin_paint_region (region: cairo.Region) : void;
        begin_resize_drag (edge: WindowEdge, button: number, root_x: number, root_y: number, timestamp: number) : void;
        begin_resize_drag_for_device (edge: WindowEdge, device: Device, button: number, root_x: number, root_y: number, timestamp: number) : void;
        configure_finished () : void;
        coords_from_parent (parent_x: number, parent_y: number, _x: number, _y: number) : void;
        coords_to_parent (_x: number, _y: number, parent_x: number, parent_y: number) : void;
        create_gl_context () : GLContext;
        create_similar_image_surface (format: number, width: number, height: number, scale: number) : cairo.Surface;
        create_similar_surface (content: cairo.Content, width: number, height: number) : cairo.Surface;
        deiconify () : void;
        destroy () : void;
        destroy_notify () : void;
        enable_synchronized_configure () : void;
        end_draw_frame (context: DrawingContext) : void;
        end_paint () : void;
        ensure_native () : boolean;
        flush () : void;
        focus (timestamp: number) : void;
        freeze_toplevel_updates_libgtk_only () : void;
        freeze_updates () : void;
        fullscreen () : void;
        fullscreen_on_monitor (monitor: number) : void;
        geometry_changed () : void;
        get_accept_focus () : boolean;
        get_background_pattern () : cairo.Pattern;
        get_children () : GLib.List;
        get_children_with_user_data (user_data: any) : GLib.List;
        get_clip_region () : cairo.Region;
        get_composited () : boolean;
        get_cursor () : Cursor;
        get_decorations (decorations: WMDecoration) : boolean;
        get_device_cursor (device: Device) : Cursor;
        get_device_events (device: Device) : EventMask;
        get_device_position (device: Device, _x: number, _y: number, mask: ModifierType) : Window;
        get_device_position_double (device: Device, _x: number, _y: number, mask: ModifierType) : Window;
        get_display () : Display;
        get_drag_protocol (target: Window) : DragProtocol;
        get_effective_parent () : Window;
        get_effective_toplevel () : Window;
        get_event_compression () : boolean;
        get_events () : EventMask;
        get_focus_on_map () : boolean;
        get_frame_clock () : FrameClock;
        get_frame_extents (rect: Rectangle) : void;
        get_fullscreen_mode () : FullscreenMode;
        get_geometry (_x: number, _y: number, width: number, height: number) : void;
        get_group () : Window;
        get_height () : number;
        get_modal_hint () : boolean;
        get_origin (_x: number, _y: number) : number;
        get_parent () : Window;
        get_pass_through () : boolean;
        get_pointer (_x: number, _y: number, mask: ModifierType) : Window;
        get_position (_x: number, _y: number) : void;
        get_root_coords (_x: number, _y: number, root_x: number, root_y: number) : void;
        get_root_origin (_x: number, _y: number) : void;
        get_scale_factor () : number;
        get_screen () : Screen;
        get_source_events (source: InputSource) : EventMask;
        get_state () : WindowState;
        get_support_multidevice () : boolean;
        get_toplevel () : Window;
        get_type_hint () : WindowTypeHint;
        get_update_area () : cairo.Region;
        get_user_data (data: any) : void;
        get_visible_region () : cairo.Region;
        get_visual () : Visual;
        get_width () : number;
        get_window_type () : WindowType;
        has_native () : boolean;
        hide () : void;
        iconify () : void;
        input_shape_combine_region (shape_region: cairo.Region, offset_x: number, offset_y: number) : void;
        invalidate_maybe_recurse (region: cairo.Region, child_func: WindowChildFunc, user_data: any) : void;
        invalidate_rect (rect: Rectangle, invalidate_children: boolean) : void;
        invalidate_region (region: cairo.Region, invalidate_children: boolean) : void;
        is_destroyed () : boolean;
        is_input_only () : boolean;
        is_shaped () : boolean;
        is_viewable () : boolean;
        is_visible () : boolean;
        lower () : void;
        mark_paint_from_clip (cr: cairo.Context) : void;
        maximize () : void;
        merge_child_input_shapes () : void;
        merge_child_shapes () : void;
        move (_x: number, _y: number) : void;
        move_region (region: cairo.Region, dx: number, dy: number) : void;
        move_resize (_x: number, _y: number, width: number, height: number) : void;
        move_to_rect (rect: Rectangle, rect_anchor: Gravity, window_anchor: Gravity, anchor_hints: AnchorHints, rect_anchor_dx: number, rect_anchor_dy: number) : void;
        peek_children () : GLib.List;
        process_updates (update_children: boolean) : void;
        raise () : void;
        register_dnd () : void;
        remove_filter (_function: FilterFunc, data: any) : void;
        reparent (new_parent: Window, _x: number, _y: number) : void;
        resize (width: number, height: number) : void;
        restack (sibling: Window, above: boolean) : void;
        scroll (dx: number, dy: number) : void;
        set_accept_focus (accept_focus: boolean) : void;
        set_background (color: Color) : void;
        set_background_pattern (pattern: cairo.Pattern) : void;
        set_background_rgba (rgba: RGBA) : void;
        set_child_input_shapes () : void;
        set_child_shapes () : void;
        set_composited (composited: boolean) : void;
        set_cursor (cursor: Cursor) : void;
        set_decorations (decorations: WMDecoration) : void;
        set_device_cursor (device: Device, cursor: Cursor) : void;
        set_device_events (device: Device, event_mask: EventMask) : void;
        set_event_compression (event_compression: boolean) : void;
        set_events (event_mask: EventMask) : void;
        set_focus_on_map (focus_on_map: boolean) : void;
        set_fullscreen_mode (mode: FullscreenMode) : void;
        set_functions (functions: WMFunction) : void;
        set_geometry_hints (geometry: Geometry, geom_mask: WindowHints) : void;
        set_group (leader: Window) : void;
        set_icon_list (pixbufs: GLib.List) : void;
        set_icon_name (name: string) : void;
        set_invalidate_handler (handler: WindowInvalidateHandlerFunc) : void;
        set_keep_above (setting: boolean) : void;
        set_keep_below (setting: boolean) : void;
        set_modal_hint (modal: boolean) : void;
        set_opacity (opacity: number) : void;
        set_opaque_region (region: cairo.Region) : void;
        set_override_redirect (override_redirect: boolean) : void;
        set_pass_through (pass_through: boolean) : void;
        set_role (role: string) : void;
        set_shadow_width (left: number, right: number, top: number, bottom: number) : void;
        set_skip_pager_hint (skips_pager: boolean) : void;
        set_skip_taskbar_hint (skips_taskbar: boolean) : void;
        set_source_events (source: InputSource, event_mask: EventMask) : void;
        set_startup_id (startup_id: string) : void;
        set_static_gravities (use_static: boolean) : boolean;
        set_support_multidevice (support_multidevice: boolean) : void;
        set_title (title: string) : void;
        set_transient_for (parent: Window) : void;
        set_type_hint (hint: WindowTypeHint) : void;
        set_urgency_hint (urgent: boolean) : void;
        set_user_data (user_data: GObject.Object) : void;
        shape_combine_region (shape_region: cairo.Region, offset_x: number, offset_y: number) : void;
        show () : void;
        show_unraised () : void;
        show_window_menu (event: Event) : boolean;
        stick () : void;
        thaw_toplevel_updates_libgtk_only () : void;
        thaw_updates () : void;
        unfullscreen () : void;
        unmaximize () : void;
        unstick () : void;
        withdraw () : void;
    }
    
    var Window: {
        new (parent: Window, attributes: WindowAttr, attributes_mask: WindowAttributesType) : Window;
        at_pointer (win_x: number, win_y: number) : Window;
        constrain_size (geometry: Geometry, flags: WindowHints, width: number, height: number, new_width: number, new_height: number) : void;
        process_all_updates () : void;
        set_debug_updates (setting: boolean) : void;
    }
    
    
    
    
    class Atom {
    
    
        public name () : string;
    }
    
    
    
    class Color {
        public pixel: number;
        public red: number;
        public green: number;
        public blue: number;
    
    
        public copy () : Color;
        public equal (colorb: Color) : boolean;
        public free () : void;
        public hash () : number;
        public to_string () : string;
    }
    
    
    
    class DevicePadInterface {
    
    
    }
    
    
    
    class DrawingContextClass {
    
    
    }
    
    
    
    class EventAny {
        public type: EventType;
        public window: Window;
        public send_event: number;
    
    
    }
    
    
    
    class EventButton {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public time: number;
        public x: number;
        public y: number;
        public axes: number;
        public state: ModifierType;
        public button: number;
        public device: Device;
        public x_root: number;
        public y_root: number;
    
    
    }
    
    
    
    class EventConfigure {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public x: number;
        public y: number;
        public width: number;
        public height: number;
    
    
    }
    
    
    
    class EventCrossing {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public subwindow: Window;
        public time: number;
        public x: number;
        public y: number;
        public x_root: number;
        public y_root: number;
        public mode: CrossingMode;
        public detail: NotifyType;
        public focus: boolean;
        public state: ModifierType;
    
    
    }
    
    
    
    class EventDND {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public context: DragContext;
        public time: number;
        public x_root: number;
        public y_root: number;
    
    
    }
    
    
    
    class EventExpose {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public area: Rectangle;
        public region: cairo.Region;
        public count: number;
    
    
    }
    
    
    
    class EventFocus {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public in: number;
    
    
    }
    
    
    
    class EventGrabBroken {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public keyboard: boolean;
        public implicit: boolean;
        public grab_window: Window;
    
    
    }
    
    
    
    class EventKey {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public time: number;
        public state: ModifierType;
        public keyval: number;
        public length: number;
        public string: string;
        public hardware_keycode: number;
        public group: number;
        public is_modifier: number;
    
    
    }
    
    
    
    class EventMotion {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public time: number;
        public x: number;
        public y: number;
        public axes: number;
        public state: ModifierType;
        public is_hint: number;
        public device: Device;
        public x_root: number;
        public y_root: number;
    
    
    }
    
    
    
    class EventOwnerChange {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public owner: Window;
        public reason: OwnerChange;
        public selection: Atom;
        public time: number;
        public selection_time: number;
    
    
    }
    
    
    
    class EventPadAxis {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public time: number;
        public group: number;
        public index: number;
        public mode: number;
        public value: number;
    
    
    }
    
    
    
    class EventPadButton {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public time: number;
        public group: number;
        public button: number;
        public mode: number;
    
    
    }
    
    
    
    class EventPadGroupMode {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public time: number;
        public group: number;
        public mode: number;
    
    
    }
    
    
    
    class EventProperty {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public atom: Atom;
        public time: number;
        public state: PropertyState;
    
    
    }
    
    
    
    class EventProximity {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public time: number;
        public device: Device;
    
    
    }
    
    
    
    class EventScroll {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public time: number;
        public x: number;
        public y: number;
        public state: ModifierType;
        public direction: ScrollDirection;
        public device: Device;
        public x_root: number;
        public y_root: number;
        public delta_x: number;
        public delta_y: number;
        public is_stop: number;
    
    
    }
    
    
    
    class EventSelection {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public selection: Atom;
        public target: Atom;
        public property: Atom;
        public time: number;
        public requestor: Window;
    
    
    }
    
    
    
    class EventSequence {
    
    
    }
    
    
    
    class EventSetting {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public action: SettingAction;
        public name: string;
    
    
    }
    
    
    
    class EventTouch {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public time: number;
        public x: number;
        public y: number;
        public axes: number;
        public state: ModifierType;
        public sequence: EventSequence;
        public emulating_pointer: boolean;
        public device: Device;
        public x_root: number;
        public y_root: number;
    
    
    }
    
    
    
    class EventTouchpadPinch {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public phase: number;
        public n_fingers: number;
        public time: number;
        public x: number;
        public y: number;
        public dx: number;
        public dy: number;
        public angle_delta: number;
        public scale: number;
        public x_root: number;
        public y_root: number;
        public state: ModifierType;
    
    
    }
    
    
    
    class EventTouchpadSwipe {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public phase: number;
        public n_fingers: number;
        public time: number;
        public x: number;
        public y: number;
        public dx: number;
        public dy: number;
        public x_root: number;
        public y_root: number;
        public state: ModifierType;
    
    
    }
    
    
    
    class EventVisibility {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public state: VisibilityState;
    
    
    }
    
    
    
    class EventWindowState {
        public type: EventType;
        public window: Window;
        public send_event: number;
        public changed_mask: WindowState;
        public new_window_state: WindowState;
    
    
    }
    
    
    
    class FrameClockClass {
    
    
    }
    
    
    
    class FrameClockPrivate {
    
    
    }
    
    
    
    class FrameTimings {
    
    
        public get_complete () : boolean;
        public get_frame_counter () : number;
        public get_frame_time () : number;
        public get_predicted_presentation_time () : number;
        public get_presentation_time () : number;
        public get_refresh_interval () : number;
        public ref () : FrameTimings;
        public unref () : void;
    }
    
    
    
    class Geometry {
        public min_width: number;
        public min_height: number;
        public max_width: number;
        public max_height: number;
        public base_width: number;
        public base_height: number;
        public width_inc: number;
        public height_inc: number;
        public min_aspect: number;
        public max_aspect: number;
        public win_gravity: Gravity;
    
    
    }
    
    
    
    class KeymapKey {
        public keycode: number;
        public group: number;
        public level: number;
    
    
    }
    
    
    
    class MonitorClass {
    
    
    }
    
    
    
    class Point {
        public x: number;
        public y: number;
    
    
    }
    
    
    
    class RGBA {
        public red: number;
        public green: number;
        public blue: number;
        public alpha: number;
    
    
        public copy () : RGBA;
        public equal (p2: RGBA) : boolean;
        public free () : void;
        public hash () : number;
        public parse (spec: string) : boolean;
        public to_string () : string;
    }
    
    
    
    class Rectangle {
        public x: number;
        public y: number;
        public width: number;
        public height: number;
    
    
        public equal (rect2: Rectangle) : boolean;
        public intersect (src2: Rectangle, dest: Rectangle) : boolean;
        public union (src2: Rectangle, dest: Rectangle) : void;
    }
    
    
    
    class TimeCoord {
        public time: number;
        public axes: number[];
    
    
    }
    
    
    
    class WindowAttr {
        public title: string;
        public event_mask: number;
        public x: number;
        public y: number;
        public width: number;
        public height: number;
        public wclass: WindowWindowClass;
        public visual: Visual;
        public window_type: WindowType;
        public cursor: Cursor;
        public wmclass_name: string;
        public wmclass_class: string;
        public override_redirect: boolean;
        public type_hint: WindowTypeHint;
    
    
    }
    
    
    
    class WindowClass {
        public parent_class: GObject.ObjectClass;
    
        pick_embedded_child : {(window: Window, _x: number, _y: number) : Window;};
        to_embedder : {(window: Window, offscreen_x: number, offscreen_y: number, embedder_x: number, embedder_y: number) : void;};
        from_embedder : {(window: Window, embedder_x: number, embedder_y: number, offscreen_x: number, offscreen_y: number) : void;};
        create_surface : {(window: Window, width: number, height: number) : cairo.Surface;};
        _gdk_reserved1 : {() : void;};
        _gdk_reserved2 : {() : void;};
        _gdk_reserved3 : {() : void;};
        _gdk_reserved4 : {() : void;};
        _gdk_reserved5 : {() : void;};
        _gdk_reserved6 : {() : void;};
        _gdk_reserved7 : {() : void;};
        _gdk_reserved8 : {() : void;};
    
    }
    
    
    
    class WindowRedirect {
    
    
    }
    
    
    
    interface DevicePad {
        get_feature_group (feature: DevicePadFeature, feature_idx: number) : number;
        get_group_n_modes (group_idx: number) : number;
        get_n_features (feature: DevicePadFeature) : number;
        get_n_groups () : number;
    }
    
    var DevicePad: {
        
        
    }
    
    
    
    
    enum AxisUse {
        ignore = 0,
        x = 1,
        y = 2,
        pressure = 3,
        xtilt = 4,
        ytilt = 5,
        wheel = 6,
        distance = 7,
        rotation = 8,
        slider = 9,
        last = 10
    }
    
    
    
    enum ByteOrder {
        lsb_first = 0,
        msb_first = 1
    }
    
    
    
    enum CrossingMode {
        normal = 0,
        grab = 1,
        ungrab = 2,
        gtk_grab = 3,
        gtk_ungrab = 4,
        state_changed = 5,
        touch_begin = 6,
        touch_end = 7,
        device_switch = 8
    }
    
    
    
    enum CursorType {
        x_cursor = 0,
        arrow = 2,
        based_arrow_down = 4,
        based_arrow_up = 6,
        boat = 8,
        bogosity = 10,
        bottom_left_corner = 12,
        bottom_right_corner = 14,
        bottom_side = 16,
        bottom_tee = 18,
        box_spiral = 20,
        center_ptr = 22,
        circle = 24,
        clock = 26,
        coffee_mug = 28,
        cross = 30,
        cross_reverse = 32,
        crosshair = 34,
        diamond_cross = 36,
        dot = 38,
        dotbox = 40,
        double_arrow = 42,
        draft_large = 44,
        draft_small = 46,
        draped_box = 48,
        exchange = 50,
        fleur = 52,
        gobbler = 54,
        gumby = 56,
        hand1 = 58,
        hand2 = 60,
        heart = 62,
        icon = 64,
        iron_cross = 66,
        left_ptr = 68,
        left_side = 70,
        left_tee = 72,
        leftbutton = 74,
        ll_angle = 76,
        lr_angle = 78,
        man = 80,
        middlebutton = 82,
        mouse = 84,
        pencil = 86,
        pirate = 88,
        plus = 90,
        question_arrow = 92,
        right_ptr = 94,
        right_side = 96,
        right_tee = 98,
        rightbutton = 100,
        rtl_logo = 102,
        sailboat = 104,
        sb_down_arrow = 106,
        sb_h_double_arrow = 108,
        sb_left_arrow = 110,
        sb_right_arrow = 112,
        sb_up_arrow = 114,
        sb_v_double_arrow = 116,
        shuttle = 118,
        sizing = 120,
        spider = 122,
        spraycan = 124,
        star = 126,
        target = 128,
        tcross = 130,
        top_left_arrow = 132,
        top_left_corner = 134,
        top_right_corner = 136,
        top_side = 138,
        top_tee = 140,
        trek = 142,
        ul_angle = 144,
        umbrella = 146,
        ur_angle = 148,
        watch = 150,
        xterm = 152,
        last_cursor = 153,
        blank_cursor = -2,
        cursor_is_pixmap = -1
    }
    
    
    
    enum DevicePadFeature {
        button = 0,
        ring = 1,
        strip = 2
    }
    
    
    
    enum DeviceToolType {
        unknown = 0,
        pen = 1,
        eraser = 2,
        brush = 3,
        pencil = 4,
        airbrush = 5,
        mouse = 6,
        lens = 7
    }
    
    
    
    enum DeviceType {
        master = 0,
        slave = 1,
        floating = 2
    }
    
    
    
    enum DragCancelReason {
        no_target = 0,
        user_cancelled = 1,
        error = 2
    }
    
    
    
    enum DragProtocol {
        none = 0,
        motif = 1,
        xdnd = 2,
        rootwin = 3,
        win32_dropfiles = 4,
        ole2 = 5,
        local = 6,
        wayland = 7
    }
    
    
    
    enum EventType {
        nothing = -1,
        delete = 0,
        destroy = 1,
        expose = 2,
        motion_notify = 3,
        button_press = 4,
        _2button_press = 5,
        double_button_press = 5,
        _3button_press = 6,
        triple_button_press = 6,
        button_release = 7,
        key_press = 8,
        key_release = 9,
        enter_notify = 10,
        leave_notify = 11,
        focus_change = 12,
        configure = 13,
        map = 14,
        unmap = 15,
        property_notify = 16,
        selection_clear = 17,
        selection_request = 18,
        selection_notify = 19,
        proximity_in = 20,
        proximity_out = 21,
        drag_enter = 22,
        drag_leave = 23,
        drag_motion = 24,
        drag_status = 25,
        drop_start = 26,
        drop_finished = 27,
        client_event = 28,
        visibility_notify = 29,
        scroll = 31,
        window_state = 32,
        setting = 33,
        owner_change = 34,
        grab_broken = 35,
        damage = 36,
        touch_begin = 37,
        touch_update = 38,
        touch_end = 39,
        touch_cancel = 40,
        touchpad_swipe = 41,
        touchpad_pinch = 42,
        pad_button_press = 43,
        pad_button_release = 44,
        pad_ring = 45,
        pad_strip = 46,
        pad_group_mode = 47,
        event_last = 48
    }
    
    
    
    enum FilterReturn {
        continue = 0,
        translate = 1,
        remove = 2
    }
    
    
    
    enum FullscreenMode {
        current_monitor = 0,
        all_monitors = 1
    }
    
    
    
    enum GLError {
        not_available = 0,
        unsupported_format = 1,
        unsupported_profile = 2
    }
    
    
    
    enum GrabOwnership {
        none = 0,
        window = 1,
        application = 2
    }
    
    
    
    enum GrabStatus {
        success = 0,
        already_grabbed = 1,
        invalid_time = 2,
        not_viewable = 3,
        frozen = 4,
        failed = 5
    }
    
    
    
    enum Gravity {
        north_west = 1,
        north = 2,
        north_east = 3,
        west = 4,
        center = 5,
        east = 6,
        south_west = 7,
        south = 8,
        south_east = 9,
        static = 10
    }
    
    
    
    enum InputMode {
        disabled = 0,
        screen = 1,
        window = 2
    }
    
    
    
    enum InputSource {
        mouse = 0,
        pen = 1,
        eraser = 2,
        cursor = 3,
        keyboard = 4,
        touchscreen = 5,
        touchpad = 6,
        trackpoint = 7,
        tablet_pad = 8
    }
    
    
    
    enum ModifierIntent {
        primary_accelerator = 0,
        context_menu = 1,
        extend_selection = 2,
        modify_selection = 3,
        no_text_input = 4,
        shift_group = 5,
        default_mod_mask = 6
    }
    
    
    
    enum NotifyType {
        ancestor = 0,
        virtual = 1,
        inferior = 2,
        nonlinear = 3,
        nonlinear_virtual = 4,
        unknown = 5
    }
    
    
    
    enum OwnerChange {
        new_owner = 0,
        destroy = 1,
        close = 2
    }
    
    
    
    enum PropMode {
        replace = 0,
        prepend = 1,
        append = 2
    }
    
    
    
    enum PropertyState {
        new_value = 0,
        delete = 1
    }
    
    
    
    enum ScrollDirection {
        up = 0,
        down = 1,
        left = 2,
        right = 3,
        smooth = 4
    }
    
    
    
    enum SettingAction {
        new = 0,
        changed = 1,
        deleted = 2
    }
    
    
    
    enum Status {
        ok = 0,
        error = -1,
        error_param = -2,
        error_file = -3,
        error_mem = -4
    }
    
    
    
    enum SubpixelLayout {
        unknown = 0,
        none = 1,
        horizontal_rgb = 2,
        horizontal_bgr = 3,
        vertical_rgb = 4,
        vertical_bgr = 5
    }
    
    
    
    enum TouchpadGesturePhase {
        begin = 0,
        update = 1,
        end = 2,
        cancel = 3
    }
    
    
    
    enum VisibilityState {
        unobscured = 0,
        partial = 1,
        fully_obscured = 2
    }
    
    
    
    enum VisualType {
        static_gray = 0,
        grayscale = 1,
        static_color = 2,
        pseudo_color = 3,
        true_color = 4,
        direct_color = 5
    }
    
    
    
    enum WindowEdge {
        north_west = 0,
        north = 1,
        north_east = 2,
        west = 3,
        east = 4,
        south_west = 5,
        south = 6,
        south_east = 7
    }
    
    
    
    enum WindowType {
        root = 0,
        toplevel = 1,
        child = 2,
        temp = 3,
        foreign = 4,
        offscreen = 5,
        subsurface = 6
    }
    
    
    
    enum WindowTypeHint {
        normal = 0,
        dialog = 1,
        menu = 2,
        toolbar = 3,
        splashscreen = 4,
        utility = 5,
        dock = 6,
        desktop = 7,
        dropdown_menu = 8,
        popup_menu = 9,
        tooltip = 10,
        notification = 11,
        combo = 12,
        dnd = 13
    }
    
    
    
    enum WindowWindowClass {
        input_output = 0,
        input_only = 1
    }
    
    
    
    enum AnchorHints {
        flip_x = 1,
        flip_y = 2,
        slide_x = 4,
        slide_y = 8,
        resize_x = 16,
        resize_y = 32,
        flip = 3,
        slide = 12,
        resize = 48
    }
    
    
    
    enum AxisFlags {
        x = 2,
        y = 4,
        pressure = 8,
        xtilt = 16,
        ytilt = 32,
        wheel = 64,
        distance = 128,
        rotation = 256,
        slider = 512
    }
    
    
    
    enum DragAction {
        default = 1,
        copy = 2,
        move = 4,
        link = 8,
        private = 16,
        ask = 32
    }
    
    
    
    enum EventMask {
        exposure_mask = 2,
        pointer_motion_mask = 4,
        pointer_motion_hint_mask = 8,
        button_motion_mask = 16,
        button1_motion_mask = 32,
        button2_motion_mask = 64,
        button3_motion_mask = 128,
        button_press_mask = 256,
        button_release_mask = 512,
        key_press_mask = 1024,
        key_release_mask = 2048,
        enter_notify_mask = 4096,
        leave_notify_mask = 8192,
        focus_change_mask = 16384,
        structure_mask = 32768,
        property_change_mask = 65536,
        visibility_notify_mask = 131072,
        proximity_in_mask = 262144,
        proximity_out_mask = 524288,
        substructure_mask = 1048576,
        scroll_mask = 2097152,
        touch_mask = 4194304,
        smooth_scroll_mask = 8388608,
        touchpad_gesture_mask = 16777216,
        tablet_pad_mask = 33554432,
        all_events_mask = 67108862
    }
    
    
    
    enum FrameClockPhase {
        none = 0,
        flush_events = 1,
        before_paint = 2,
        update = 4,
        layout = 8,
        paint = 16,
        resume_events = 32,
        after_paint = 64
    }
    
    
    
    enum ModifierType {
        shift_mask = 1,
        lock_mask = 2,
        control_mask = 4,
        mod1_mask = 8,
        mod2_mask = 16,
        mod3_mask = 32,
        mod4_mask = 64,
        mod5_mask = 128,
        button1_mask = 256,
        button2_mask = 512,
        button3_mask = 1024,
        button4_mask = 2048,
        button5_mask = 4096,
        modifier_reserved_13_mask = 8192,
        modifier_reserved_14_mask = 16384,
        modifier_reserved_15_mask = 32768,
        modifier_reserved_16_mask = 65536,
        modifier_reserved_17_mask = 131072,
        modifier_reserved_18_mask = 262144,
        modifier_reserved_19_mask = 524288,
        modifier_reserved_20_mask = 1048576,
        modifier_reserved_21_mask = 2097152,
        modifier_reserved_22_mask = 4194304,
        modifier_reserved_23_mask = 8388608,
        modifier_reserved_24_mask = 16777216,
        modifier_reserved_25_mask = 33554432,
        super_mask = 67108864,
        hyper_mask = 134217728,
        meta_mask = 268435456,
        modifier_reserved_29_mask = 536870912,
        release_mask = 1073741824,
        modifier_mask = 1543512063
    }
    
    
    
    enum SeatCapabilities {
        none = 0,
        pointer = 1,
        touch = 2,
        tablet_stylus = 4,
        keyboard = 8,
        all_pointing = 7,
        all = 15
    }
    
    
    
    enum WMDecoration {
        all = 1,
        border = 2,
        resizeh = 4,
        title = 8,
        menu = 16,
        minimize = 32,
        maximize = 64
    }
    
    
    
    enum WMFunction {
        all = 1,
        resize = 2,
        move = 4,
        minimize = 8,
        maximize = 16,
        close = 32
    }
    
    
    
    enum WindowAttributesType {
        title = 2,
        x = 4,
        y = 8,
        cursor = 16,
        visual = 32,
        wmclass = 64,
        noredir = 128,
        type_hint = 256
    }
    
    
    
    enum WindowHints {
        pos = 1,
        min_size = 2,
        max_size = 4,
        base_size = 8,
        aspect = 16,
        resize_inc = 32,
        win_gravity = 64,
        user_pos = 128,
        user_size = 256
    }
    
    
    
    enum WindowState {
        withdrawn = 1,
        iconified = 2,
        maximized = 4,
        sticky = 8,
        fullscreen = 16,
        above = 32,
        below = 64,
        focused = 128,
        tiled = 256,
        top_tiled = 512,
        top_resizable = 1024,
        right_tiled = 2048,
        right_resizable = 4096,
        bottom_tiled = 8192,
        bottom_resizable = 16384,
        left_tiled = 32768,
        left_resizable = 65536
    }
    
    
    
    interface EventFunc {
        (event: Event, data: any) : void;
    }
    
    
    
    interface FilterFunc {
        (xevent: XEvent, event: Event, data: any) : FilterReturn;
    }
    
    
    
    interface SeatGrabPrepareFunc {
        (seat: Seat, window: Window, user_data: any) : void;
    }
    
    
    
    interface WindowChildFunc {
        (window: Window, user_data: any) : boolean;
    }
    
    
    
    interface WindowInvalidateHandlerFunc {
        (window: Window, region: cairo.Region) : void;
    }
    
    
    
    interface Event {}
    
    
    
    type XEvent = void;
    
    
    
    function add_option_entries_libgtk_only (group: GLib.OptionGroup): void;
    
    
    
    function atom_intern (atom_name: string, only_if_exists: boolean): Atom;
    
    
    
    function atom_intern_static_string (atom_name: string): Atom;
    
    
    
    function beep (): void;
    
    
    
    function cairo_create (window: Window): cairo.Context;
    
    
    
    function cairo_draw_from_gl (cr: cairo.Context, window: Window, source: number, source_type: number, buffer_scale: number, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function cairo_get_clip_rectangle (cr: cairo.Context, rect: Rectangle): boolean;
    
    
    
    function cairo_get_drawing_context (cr: cairo.Context): DrawingContext;
    
    
    
    function cairo_rectangle (cr: cairo.Context, rectangle: Rectangle): void;
    
    
    
    function cairo_region (cr: cairo.Context, region: cairo.Region): void;
    
    
    
    function cairo_region_create_from_surface (surface: cairo.Surface): cairo.Region;
    
    
    
    function cairo_set_source_color (cr: cairo.Context, color: Color): void;
    
    
    
    function cairo_set_source_pixbuf (cr: cairo.Context, pixbuf: GdkPixbuf.Pixbuf, pixbuf_x: number, pixbuf_y: number): void;
    
    
    
    function cairo_set_source_rgba (cr: cairo.Context, rgba: RGBA): void;
    
    
    
    function cairo_set_source_window (cr: cairo.Context, window: Window, _x: number, _y: number): void;
    
    
    
    function cairo_surface_create_from_pixbuf (pixbuf: GdkPixbuf.Pixbuf, scale: number, for_window: Window): cairo.Surface;
    
    
    
    function color_parse (spec: string, color: Color): boolean;
    
    
    
    function disable_multidevice (): void;
    
    
    
    function drag_abort (context: DragContext, time_: number): void;
    
    
    
    function drag_begin (window: Window, targets: GLib.List): DragContext;
    
    
    
    function drag_begin_for_device (window: Window, device: Device, targets: GLib.List): DragContext;
    
    
    
    function drag_begin_from_point (window: Window, device: Device, targets: GLib.List, x_root: number, y_root: number): DragContext;
    
    
    
    function drag_drop (context: DragContext, time_: number): void;
    
    
    
    function drag_drop_done (context: DragContext, success: boolean): void;
    
    
    
    function drag_drop_succeeded (context: DragContext): boolean;
    
    
    
    function drag_find_window_for_screen (context: DragContext, drag_window: Window, screen: Screen, x_root: number, y_root: number, dest_window: Window, protocol: DragProtocol): void;
    
    
    
    function drag_get_selection (context: DragContext): Atom;
    
    
    
    function drag_motion (context: DragContext, dest_window: Window, protocol: DragProtocol, x_root: number, y_root: number, suggested_action: DragAction, possible_actions: DragAction, time_: number): boolean;
    
    
    
    function drag_status (context: DragContext, action: DragAction, time_: number): void;
    
    
    
    function drop_finish (context: DragContext, success: boolean, time_: number): void;
    
    
    
    function drop_reply (context: DragContext, accepted: boolean, time_: number): void;
    
    
    
    function error_trap_pop (): number;
    
    
    
    function error_trap_pop_ignored (): void;
    
    
    
    function error_trap_push (): void;
    
    
    
    function event_get (): Event;
    
    
    
    function event_handler_set (_func: EventFunc, data: any, notify: GLib.DestroyNotify): void;
    
    
    
    function event_peek (): Event;
    
    
    
    function event_request_motions (event: EventMotion): void;
    
    
    
    function events_get_angle (event1: Event, event2: Event, angle: number): boolean;
    
    
    
    function events_get_center (event1: Event, event2: Event, _x: number, _y: number): boolean;
    
    
    
    function events_get_distance (event1: Event, event2: Event, distance: number): boolean;
    
    
    
    function events_pending (): boolean;
    
    
    
    function flush (): void;
    
    
    
    function get_default_root_window (): Window;
    
    
    
    function get_display (): string;
    
    
    
    function get_display_arg_name (): string;
    
    
    
    function get_program_class (): string;
    
    
    
    function get_show_events (): boolean;
    
    
    
    function gl_error_quark (): GLib.Quark;
    
    
    
    function init (argc: number, argv: string[]): void;
    
    
    
    function init_check (argc: number, argv: string[]): boolean;
    
    
    
    function keyboard_grab (window: Window, owner_events: boolean, time_: number): GrabStatus;
    
    
    
    function keyboard_ungrab (time_: number): void;
    
    
    
    function keyval_convert_case (symbol: number, lower: number, upper: number): void;
    
    
    
    function keyval_from_name (keyval_name: string): number;
    
    
    
    function keyval_is_lower (keyval: number): boolean;
    
    
    
    function keyval_is_upper (keyval: number): boolean;
    
    
    
    function keyval_name (keyval: number): string;
    
    
    
    function keyval_to_lower (keyval: number): number;
    
    
    
    function keyval_to_unicode (keyval: number): number;
    
    
    
    function keyval_to_upper (keyval: number): number;
    
    
    
    function list_visuals (): GLib.List;
    
    
    
    function notify_startup_complete (): void;
    
    
    
    function notify_startup_complete_with_id (startup_id: string): void;
    
    
    
    function offscreen_window_get_embedder (window: Window): Window;
    
    
    
    function offscreen_window_get_surface (window: Window): cairo.Surface;
    
    
    
    function offscreen_window_set_embedder (window: Window, embedder: Window): void;
    
    
    
    function pango_context_get (): Pango.Context;
    
    
    
    function pango_context_get_for_display (display: Display): Pango.Context;
    
    
    
    function pango_context_get_for_screen (screen: Screen): Pango.Context;
    
    
    
    function pango_layout_get_clip_region (layout: Pango.Layout, x_origin: number, y_origin: number, index_ranges: number, n_ranges: number): cairo.Region;
    
    
    
    function pango_layout_line_get_clip_region (line: Pango.LayoutLine, x_origin: number, y_origin: number, index_ranges: number[], n_ranges: number): cairo.Region;
    
    
    
    function parse_args (argc: number, argv: string[]): void;
    
    
    
    function pixbuf_get_from_surface (surface: cairo.Surface, src_x: number, src_y: number, width: number, height: number): GdkPixbuf.Pixbuf;
    
    
    
    function pixbuf_get_from_window (window: Window, src_x: number, src_y: number, width: number, height: number): GdkPixbuf.Pixbuf;
    
    
    
    function pointer_grab (window: Window, owner_events: boolean, event_mask: EventMask, confine_to: Window, cursor: Cursor, time_: number): GrabStatus;
    
    
    
    function pointer_is_grabbed (): boolean;
    
    
    
    function pointer_ungrab (time_: number): void;
    
    
    
    function pre_parse_libgtk_only (): void;
    
    
    
    function property_change (window: Window, property: Atom, _type: Atom, format: number, mode: PropMode, data: number, nelements: number): void;
    
    
    
    function property_delete (window: Window, property: Atom): void;
    
    
    
    function property_get (window: Window, property: Atom, _type: Atom, offset: number, length: number, pdelete: number, actual_property_type: Atom, actual_format: number, actual_length: number, data: number[]): boolean;
    
    
    
    function query_depths (depths: number[], count: number): void;
    
    
    
    function query_visual_types (visual_types: VisualType[], count: number): void;
    
    
    
    function selection_convert (requestor: Window, selection: Atom, target: Atom, time_: number): void;
    
    
    
    function selection_owner_get (selection: Atom): Window;
    
    
    
    function selection_owner_get_for_display (display: Display, selection: Atom): Window;
    
    
    
    function selection_owner_set (owner: Window, selection: Atom, time_: number, send_event: boolean): boolean;
    
    
    
    function selection_owner_set_for_display (display: Display, owner: Window, selection: Atom, time_: number, send_event: boolean): boolean;
    
    
    
    function selection_property_get (requestor: Window, data: number, prop_type: Atom, prop_format: number): number;
    
    
    
    function selection_send_notify (requestor: Window, selection: Atom, target: Atom, property: Atom, time_: number): void;
    
    
    
    function selection_send_notify_for_display (display: Display, requestor: Window, selection: Atom, target: Atom, property: Atom, time_: number): void;
    
    
    
    function set_allowed_backends (backends: string): void;
    
    
    
    function set_double_click_time (msec: number): void;
    
    
    
    function set_program_class (program_class: string): void;
    
    
    
    function set_show_events (show_events: boolean): void;
    
    
    
    function setting_get (name: string, value: GObject.Value): boolean;
    
    
    
    function synthesize_window_state (window: Window, unset_flags: WindowState, set_flags: WindowState): void;
    
    
    
    function test_render_sync (window: Window): void;
    
    
    
    function test_simulate_button (window: Window, _x: number, _y: number, button: number, modifiers: ModifierType, button_pressrelease: EventType): boolean;
    
    
    
    function test_simulate_key (window: Window, _x: number, _y: number, keyval: number, modifiers: ModifierType, key_pressrelease: EventType): boolean;
    
    
    
    function text_property_to_utf8_list_for_display (display: Display, encoding: Atom, format: number, text: number[], length: number, list: string[]): number;
    
    
    
    function threads_add_idle (_function: GLib.SourceFunc, data: any): number;
    
    
    
    function threads_add_idle_full (priority: number, _function: GLib.SourceFunc, data: any, notify: GLib.DestroyNotify): number;
    
    
    
    function threads_add_timeout (interval: number, _function: GLib.SourceFunc, data: any): number;
    
    
    
    function threads_add_timeout_full (priority: number, interval: number, _function: GLib.SourceFunc, data: any, notify: GLib.DestroyNotify): number;
    
    
    
    function threads_add_timeout_seconds (interval: number, _function: GLib.SourceFunc, data: any): number;
    
    
    
    function threads_add_timeout_seconds_full (priority: number, interval: number, _function: GLib.SourceFunc, data: any, notify: GLib.DestroyNotify): number;
    
    
    
    function threads_enter (): void;
    
    
    
    function threads_init (): void;
    
    
    
    function threads_leave (): void;
    
    
    
    function threads_set_lock_functions (enter_fn: GObject.Callback, leave_fn: GObject.Callback): void;
    
    
    
    function unicode_to_keyval (wc: number): number;
    
    
    
    function utf8_to_string_target (_str: string): string;
    
    }