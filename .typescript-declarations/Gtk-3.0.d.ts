declare namespace imports.gi.Gtk {

    interface AboutDialog extends Dialog, Atk.ImplementorIface, Buildable {
        add_credit_section (section_name: string, people: string[]) : void;
        get_artists () : string[];
        get_authors () : string[];
        get_comments () : string;
        get_copyright () : string;
        get_documenters () : string[];
        get_license () : string;
        get_license_type () : License;
        get_logo () : GdkPixbuf.Pixbuf;
        get_logo_icon_name () : string;
        get_program_name () : string;
        get_translator_credits () : string;
        get_version () : string;
        get_website () : string;
        get_website_label () : string;
        get_wrap_license () : boolean;
        set_artists (artists: string[]) : void;
        set_authors (authors: string[]) : void;
        set_comments (comments: string) : void;
        set_copyright (copyright: string) : void;
        set_documenters (documenters: string[]) : void;
        set_license (license: string) : void;
        set_license_type (license_type: License) : void;
        set_logo (logo: GdkPixbuf.Pixbuf) : void;
        set_logo_icon_name (icon_name: string) : void;
        set_program_name (name: string) : void;
        set_translator_credits (translator_credits: string) : void;
        set_version (version: string) : void;
        set_website (website: string) : void;
        set_website_label (website_label: string) : void;
        set_wrap_license (wrap_license: boolean) : void;
    }
    
    var AboutDialog: {
        new () : Widget;
        
    }
    
    
    
    
    interface AccelGroup extends GObject.Object {
        activate (accel_quark: GLib.Quark, acceleratable: GObject.Object, accel_key: number, accel_mods: Gdk.ModifierType) : boolean;
        //connect (accel_key: number, accel_mods: Gdk.ModifierType, accel_flags: AccelFlags, closure: GObject.Closure) : void;
        connect_by_path (accel_path: string, closure: GObject.Closure) : void;
        disconnect (closure: GObject.Closure) : boolean;
        disconnect_key (accel_key: number, accel_mods: Gdk.ModifierType) : boolean;
        find (find_func: AccelGroupFindFunc, data: any) : AccelKey;
        get_is_locked () : boolean;
        get_modifier_mask () : Gdk.ModifierType;
        lock () : void;
        query (accel_key: number, accel_mods: Gdk.ModifierType, n_entries: number) : AccelGroupEntry[];
        unlock () : void;
    }
    
    var AccelGroup: {
        new () : AccelGroup;
        from_accel_closure (closure: GObject.Closure) : AccelGroup;
    }
    
    
    
    
    interface AccelLabel extends Label, Atk.ImplementorIface, Buildable {
        get_accel (accelerator_key: number, accelerator_mods: Gdk.ModifierType) : void;
        get_accel_widget () : Widget;
        get_accel_width () : number;
        refetch () : boolean;
        set_accel (accelerator_key: number, accelerator_mods: Gdk.ModifierType) : void;
        set_accel_closure (accel_closure: GObject.Closure) : void;
        set_accel_widget (accel_widget: Widget) : void;
    }
    
    var AccelLabel: {
        new (string: string) : Widget;
        
    }
    
    
    
    
    interface AccelMap extends GObject.Object {
        
    }
    
    var AccelMap: {
        
        add_entry (accel_path: string, accel_key: number, accel_mods: Gdk.ModifierType) : void;
        add_filter (filter_pattern: string) : void;
        change_entry (accel_path: string, accel_key: number, accel_mods: Gdk.ModifierType, replace: boolean) : boolean;
        foreach (data: any, foreach_func: AccelMapForeach) : void;
        foreach_unfiltered (data: any, foreach_func: AccelMapForeach) : void;
        get () : AccelMap;
        load (file_name: string) : void;
        load_fd (fd: number) : void;
        load_scanner (scanner: GLib.Scanner) : void;
        lock_path (accel_path: string) : void;
        lookup_entry (accel_path: string, key: AccelKey) : boolean;
        save (file_name: string) : void;
        save_fd (fd: number) : void;
        unlock_path (accel_path: string) : void;
    }
    
    
    
    
    interface Accessible extends Atk.Object {
        connect_widget_destroyed () : void;
        get_widget () : Widget;
        set_widget (widget: Widget) : void;
    }
    
    var Accessible: {
        
        
    }
    
    
    
    
    interface Action extends GObject.Object, Buildable {
        activate () : void;
        block_activate () : void;
        connect_accelerator () : void;
        create_icon (icon_size: number) : Widget;
        create_menu () : Widget;
        create_menu_item () : Widget;
        create_tool_item () : Widget;
        disconnect_accelerator () : void;
        get_accel_closure () : GObject.Closure;
        get_accel_path () : string;
        get_always_show_image () : boolean;
        get_gicon () : Gio.Icon;
        get_icon_name () : string;
        get_is_important () : boolean;
        get_label () : string;
        get_name () : string;
        get_proxies () : GLib.SList;
        get_sensitive () : boolean;
        get_short_label () : string;
        get_stock_id () : string;
        get_tooltip () : string;
        get_visible () : boolean;
        get_visible_horizontal () : boolean;
        get_visible_vertical () : boolean;
        is_sensitive () : boolean;
        is_visible () : boolean;
        set_accel_group (accel_group: AccelGroup) : void;
        set_accel_path (accel_path: string) : void;
        set_always_show_image (always_show: boolean) : void;
        set_gicon (icon: Gio.Icon) : void;
        set_icon_name (icon_name: string) : void;
        set_is_important (is_important: boolean) : void;
        set_label (label: string) : void;
        set_sensitive (sensitive: boolean) : void;
        set_short_label (short_label: string) : void;
        set_stock_id (stock_id: string) : void;
        set_tooltip (tooltip: string) : void;
        set_visible (visible: boolean) : void;
        set_visible_horizontal (visible_horizontal: boolean) : void;
        set_visible_vertical (visible_vertical: boolean) : void;
        unblock_activate () : void;
    }
    
    var Action: {
        new (name: string, label: string, tooltip: string, stock_id: string) : Action;
        
    }
    
    
    
    
    interface ActionBar extends Bin, Atk.ImplementorIface, Buildable {
        get_center_widget () : Widget;
        pack_end (child: Widget) : void;
        pack_start (child: Widget) : void;
        set_center_widget (center_widget: Widget) : void;
    }
    
    var ActionBar: {
        new () : Widget;
        
    }
    
    
    
    
    interface ActionGroup extends GObject.Object, Buildable {
        add_action (action: Action) : void;
        add_action_with_accel (action: Action, accelerator: string) : void;
        add_actions (entries: ActionEntry[], n_entries: number, user_data: any) : void;
        add_actions_full (entries: ActionEntry[], n_entries: number, user_data: any, destroy: GLib.DestroyNotify) : void;
        add_radio_actions (entries: RadioActionEntry[], n_entries: number, value: number, on_change: GObject.Callback, user_data: any) : void;
        add_radio_actions_full (entries: RadioActionEntry[], n_entries: number, value: number, on_change: GObject.Callback, user_data: any, destroy: GLib.DestroyNotify) : void;
        add_toggle_actions (entries: ToggleActionEntry[], n_entries: number, user_data: any) : void;
        add_toggle_actions_full (entries: ToggleActionEntry[], n_entries: number, user_data: any, destroy: GLib.DestroyNotify) : void;
        get_accel_group () : AccelGroup;
        get_action (action_name: string) : Action;
        get_name () : string;
        get_sensitive () : boolean;
        get_visible () : boolean;
        list_actions () : GLib.List;
        remove_action (action: Action) : void;
        set_accel_group (accel_group: AccelGroup) : void;
        set_sensitive (sensitive: boolean) : void;
        set_translate_func (_func: TranslateFunc, data: any, notify: GLib.DestroyNotify) : void;
        set_translation_domain (domain: string) : void;
        set_visible (visible: boolean) : void;
        translate_string (string: string) : string;
    }
    
    var ActionGroup: {
        new (name: string) : ActionGroup;
        
    }
    
    
    
    
    interface Adjustment extends GObject.InitiallyUnowned {
        changed () : void;
        clamp_page (lower: number, upper: number) : void;
        configure (value: number, lower: number, upper: number, step_increment: number, page_increment: number, page_size: number) : void;
        get_lower () : number;
        get_minimum_increment () : number;
        get_page_increment () : number;
        get_page_size () : number;
        get_step_increment () : number;
        get_upper () : number;
        get_value () : number;
        set_lower (lower: number) : void;
        set_page_increment (page_increment: number) : void;
        set_page_size (page_size: number) : void;
        set_step_increment (step_increment: number) : void;
        set_upper (upper: number) : void;
        set_value (value: number) : void;
        value_changed () : void;
    }
    
    var Adjustment: {
        new (value: number, lower: number, upper: number, step_increment: number, page_increment: number, page_size: number) : Adjustment;
        
    }
    
    
    
    
    interface Alignment extends Bin, Atk.ImplementorIface, Buildable {
        get_padding (padding_top: number, padding_bottom: number, padding_left: number, padding_right: number) : void;
        set (xalign: number, yalign: number, xscale: number, yscale: number) : void;
        set_padding (padding_top: number, padding_bottom: number, padding_left: number, padding_right: number) : void;
    }
    
    var Alignment: {
        new (xalign: number, yalign: number, xscale: number, yscale: number) : Widget;
        
    }
    
    
    
    
    interface AppChooserButton extends ComboBox, Atk.ImplementorIface, AppChooser, Buildable, CellEditable, CellLayout {
        append_custom_item (name: string, label: string, icon: Gio.Icon) : void;
        append_separator () : void;
        get_heading () : string;
        get_show_default_item () : boolean;
        get_show_dialog_item () : boolean;
        set_active_custom_item (name: string) : void;
        set_heading (heading: string) : void;
        set_show_default_item (setting: boolean) : void;
        set_show_dialog_item (setting: boolean) : void;
    }
    
    var AppChooserButton: {
        new (content_type: string) : Widget;
        
    }
    
    
    
    
    interface AppChooserDialog extends Dialog, Atk.ImplementorIface, AppChooser, Buildable {
        get_heading () : string;
        get_widget () : Widget;
        set_heading (heading: string) : void;
    }
    
    var AppChooserDialog: {
        new (parent: Window, flags: DialogFlags, file: Gio.File) : Widget;
        new_for_content_type (parent: Window, flags: DialogFlags, content_type: string) : Widget;
        
    }
    
    
    
    
    interface AppChooserWidget extends Box, Atk.ImplementorIface, AppChooser, Buildable, Orientable {
        get_default_text () : string;
        get_show_all () : boolean;
        get_show_default () : boolean;
        get_show_fallback () : boolean;
        get_show_other () : boolean;
        get_show_recommended () : boolean;
        set_default_text (text: string) : void;
        set_show_all (setting: boolean) : void;
        set_show_default (setting: boolean) : void;
        set_show_fallback (setting: boolean) : void;
        set_show_other (setting: boolean) : void;
        set_show_recommended (setting: boolean) : void;
    }
    
    var AppChooserWidget: {
        new (content_type: string) : Widget;
        
    }
    
    
    
    
    interface Application extends Gio.Application, Gio.ActionGroup, Gio.ActionMap {
        add_accelerator (accelerator: string, action_name: string, parameter: GLib.Variant) : void;
        add_window (window: Window) : void;
        get_accels_for_action (detailed_action_name: string) : string[];
        get_actions_for_accel (accel: string) : string[];
        get_active_window () : Window;
        get_app_menu () : Gio.MenuModel;
        get_menu_by_id (_id: string) : Gio.Menu;
        get_menubar () : Gio.MenuModel;
        get_window_by_id (_id: number) : Window;
        get_windows () : GLib.List;
        inhibit (window: Window, flags: ApplicationInhibitFlags, reason: string) : number;
        is_inhibited (flags: ApplicationInhibitFlags) : boolean;
        list_action_descriptions () : string[];
        prefers_app_menu () : boolean;
        remove_accelerator (action_name: string, parameter: GLib.Variant) : void;
        remove_window (window: Window) : void;
        set_accels_for_action (detailed_action_name: string, accels: string[]) : void;
        set_app_menu (app_menu: Gio.MenuModel) : void;
        set_menubar (menubar: Gio.MenuModel) : void;
        uninhibit (cookie: number) : void;
    }
    
    var Application: {
        new (application_id: string, flags: Gio.ApplicationFlags) : Application;
        
    }
    
    
    
    
    interface ApplicationWindow extends Window, Atk.ImplementorIface, Gio.ActionGroup, Gio.ActionMap, Buildable {
        get_help_overlay () : ShortcutsWindow;
        get_id () : number;
        get_show_menubar () : boolean;
        set_help_overlay (help_overlay: ShortcutsWindow) : void;
        set_show_menubar (show_menubar: boolean) : void;
    }
    
    var ApplicationWindow: {
        new (application: Application) : Widget;
        
    }
    
    
    
    
    interface Arrow extends Misc, Atk.ImplementorIface, Buildable {
        set (arrow_type: ArrowType, shadow_type: ShadowType) : void;
    }
    
    var Arrow: {
        new (arrow_type: ArrowType, shadow_type: ShadowType) : Widget;
        
    }
    
    
    
    
    interface ArrowAccessible extends WidgetAccessible, Atk.Component, Atk.Image {
        
    }
    
    var ArrowAccessible: {
        
        
    }
    
    
    
    
    interface AspectFrame extends Frame, Atk.ImplementorIface, Buildable {
        set (xalign: number, yalign: number, ratio: number, obey_child: boolean) : void;
    }
    
    var AspectFrame: {
        new (label: string, xalign: number, yalign: number, ratio: number, obey_child: boolean) : Widget;
        
    }
    
    
    
    
    interface Assistant extends Window, Atk.ImplementorIface, Buildable {
        add_action_widget (child: Widget) : void;
        append_page (page: Widget) : number;
        commit () : void;
        get_current_page () : number;
        get_n_pages () : number;
        get_nth_page (page_num: number) : Widget;
        get_page_complete (page: Widget) : boolean;
        get_page_has_padding (page: Widget) : boolean;
        get_page_header_image (page: Widget) : GdkPixbuf.Pixbuf;
        get_page_side_image (page: Widget) : GdkPixbuf.Pixbuf;
        get_page_title (page: Widget) : string;
        get_page_type (page: Widget) : AssistantPageType;
        insert_page (page: Widget, position: number) : number;
        next_page () : void;
        prepend_page (page: Widget) : number;
        previous_page () : void;
        remove_action_widget (child: Widget) : void;
        remove_page (page_num: number) : void;
        set_current_page (page_num: number) : void;
        set_forward_page_func (page_func: AssistantPageFunc, data: any, destroy: GLib.DestroyNotify) : void;
        set_page_complete (page: Widget, complete: boolean) : void;
        set_page_has_padding (page: Widget, has_padding: boolean) : void;
        set_page_header_image (page: Widget, pixbuf: GdkPixbuf.Pixbuf) : void;
        set_page_side_image (page: Widget, pixbuf: GdkPixbuf.Pixbuf) : void;
        set_page_title (page: Widget, title: string) : void;
        set_page_type (page: Widget, _type: AssistantPageType) : void;
        update_buttons_state () : void;
    }
    
    var Assistant: {
        new () : Widget;
        
    }
    
    
    
    
    interface Bin extends Container, Atk.ImplementorIface, Buildable {
        get_child () : Widget;
    }
    
    var Bin: {
        
        
    }
    
    
    
    
    interface BooleanCellAccessible extends RendererCellAccessible, Atk.Action, Atk.Component, Atk.TableCell {
        
    }
    
    var BooleanCellAccessible: {
        
        
    }
    
    
    
    
    interface Box extends Container, Atk.ImplementorIface, Buildable, Orientable {
        get_baseline_position () : BaselinePosition;
        get_center_widget () : Widget;
        get_homogeneous () : boolean;
        get_spacing () : number;
        pack_end (child: Widget, expand: boolean, fill: boolean, padding: number) : void;
        pack_start (child: Widget, expand: boolean, fill: boolean, padding: number) : void;
        query_child_packing (child: Widget, expand: boolean, fill: boolean, padding: number, pack_type: PackType) : void;
        reorder_child (child: Widget, position: number) : void;
        set_baseline_position (position: BaselinePosition) : void;
        set_center_widget (widget: Widget) : void;
        set_child_packing (child: Widget, expand: boolean, fill: boolean, padding: number, pack_type: PackType) : void;
        set_homogeneous (homogeneous: boolean) : void;
        set_spacing (spacing: number) : void;
    }
    
    var Box: {
        new (orientation: Orientation, spacing: number) : Widget;
        
    }
    
    
    
    
    interface Builder extends GObject.Object {
        add_callback_symbol (callback_name: string, callback_symbol: GObject.Callback) : void;
        add_callback_symbols (first_callback_name: string, first_callback_symbol: GObject.Callback) : void;
        add_from_file (filename: string) : number;
        add_from_resource (resource_path: string) : number;
        add_from_string (buffer: string, length: number) : number;
        add_objects_from_file (filename: string, object_ids: string[]) : number;
        add_objects_from_resource (resource_path: string, object_ids: string[]) : number;
        add_objects_from_string (buffer: string, length: number, object_ids: string[]) : number;
        connect_signals (user_data: any) : void;
        connect_signals_full (_func: BuilderConnectFunc, user_data: any) : void;
        expose_object (name: string, object: GObject.Object) : void;
        extend_with_template (widget: Widget, template_type: GObject.Type, buffer: string, length: number) : number;
        get_application () : Application;
        get_object (name: string) : GObject.Object;
        get_objects () : GLib.SList;
        get_translation_domain () : string;
        get_type_from_name (type_name: string) : GObject.Type;
        lookup_callback_symbol (callback_name: string) : GObject.Callback;
        set_application (application: Application) : void;
        set_translation_domain (domain: string) : void;
        value_from_string (pspec: GObject.ParamSpec, string: string, value: GObject.Value) : boolean;
        value_from_string_type (_type: GObject.Type, string: string, value: GObject.Value) : boolean;
    }
    
    var Builder: {
        new () : Builder;
        new_from_file (filename: string) : Builder;
        new_from_resource (resource_path: string) : Builder;
        new_from_string (string: string, length: number) : Builder;
        
    }
    
    
    
    
    interface Button extends Bin, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        clicked () : void;
        enter () : void;
        get_alignment (xalign: number, yalign: number) : void;
        get_always_show_image () : boolean;
        get_event_window () : Gdk.Window;
        get_focus_on_click () : boolean;
        get_image () : Widget;
        get_image_position () : PositionType;
        get_label () : string;
        get_relief () : ReliefStyle;
        get_use_stock () : boolean;
        get_use_underline () : boolean;
        leave () : void;
        pressed () : void;
        released () : void;
        set_alignment (xalign: number, yalign: number) : void;
        set_always_show_image (always_show: boolean) : void;
        set_focus_on_click (focus_on_click: boolean) : void;
        set_image (image: Widget) : void;
        set_image_position (position: PositionType) : void;
        set_label (label: string) : void;
        set_relief (relief: ReliefStyle) : void;
        set_use_stock (use_stock: boolean) : void;
        set_use_underline (use_underline: boolean) : void;
    }
    
    var Button: {
        new () : Widget;
        new_from_icon_name (icon_name: string, size: number) : Widget;
        new_from_stock (stock_id: string) : Widget;
        new_with_label (label: string) : Widget;
        new_with_mnemonic (label: string) : Widget;
        
    }
    
    
    
    
    interface ButtonAccessible extends ContainerAccessible, Atk.Action, Atk.Component, Atk.Image {
        
    }
    
    var ButtonAccessible: {
        
        
    }
    
    
    
    
    interface ButtonBox extends Box, Atk.ImplementorIface, Buildable, Orientable {
        get_child_non_homogeneous (child: Widget) : boolean;
        get_child_secondary (child: Widget) : boolean;
        get_layout () : ButtonBoxStyle;
        set_child_non_homogeneous (child: Widget, non_homogeneous: boolean) : void;
        set_child_secondary (child: Widget, is_secondary: boolean) : void;
        set_layout (layout_style: ButtonBoxStyle) : void;
    }
    
    var ButtonBox: {
        new (orientation: Orientation) : Widget;
        
    }
    
    
    
    
    interface Calendar extends Widget, Atk.ImplementorIface, Buildable {
        clear_marks () : void;
        get_date (year: number, month: number, day: number) : void;
        get_day_is_marked (day: number) : boolean;
        get_detail_height_rows () : number;
        get_detail_width_chars () : number;
        get_display_options () : CalendarDisplayOptions;
        mark_day (day: number) : void;
        select_day (day: number) : void;
        select_month (month: number, year: number) : void;
        set_detail_func (_func: CalendarDetailFunc, data: any, destroy: GLib.DestroyNotify) : void;
        set_detail_height_rows (_rows: number) : void;
        set_detail_width_chars (chars: number) : void;
        set_display_options (flags: CalendarDisplayOptions) : void;
        unmark_day (day: number) : void;
    }
    
    var Calendar: {
        new () : Widget;
        
    }
    
    
    
    
    interface CellAccessible extends Accessible, Atk.Action, Atk.Component, Atk.TableCell {
        
    }
    
    var CellAccessible: {
        
        
    }
    
    
    
    
    interface CellArea extends GObject.InitiallyUnowned, Buildable, CellLayout {
        activate (context: CellAreaContext, widget: Widget, cell_area: Gdk.Rectangle, flags: CellRendererState, edit_only: boolean) : boolean;
        activate_cell (widget: Widget, renderer: CellRenderer, event: Gdk.Event, cell_area: Gdk.Rectangle, flags: CellRendererState) : boolean;
        add (renderer: CellRenderer) : void;
        add_focus_sibling (renderer: CellRenderer, sibling: CellRenderer) : void;
        add_with_properties (renderer: CellRenderer, first_prop_name: string) : void;
        apply_attributes (tree_model: TreeModel, iter: TreeIter, is_expander: boolean, is_expanded: boolean) : void;
        attribute_connect (renderer: CellRenderer, attribute: string, column: number) : void;
        attribute_disconnect (renderer: CellRenderer, attribute: string) : void;
        attribute_get_column (renderer: CellRenderer, attribute: string) : number;
        cell_get (renderer: CellRenderer, first_prop_name: string) : void;
        cell_get_property (renderer: CellRenderer, property_name: string, value: GObject.Value) : void;
        cell_get_valist (renderer: CellRenderer, first_property_name: string, var_args: any[]) : void;
        cell_set (renderer: CellRenderer, first_prop_name: string) : void;
        cell_set_property (renderer: CellRenderer, property_name: string, value: GObject.Value) : void;
        cell_set_valist (renderer: CellRenderer, first_property_name: string, var_args: any[]) : void;
        copy_context (context: CellAreaContext) : CellAreaContext;
        create_context () : CellAreaContext;
        event (context: CellAreaContext, widget: Widget, event: Gdk.Event, cell_area: Gdk.Rectangle, flags: CellRendererState) : number;
        focus (direction: DirectionType) : boolean;
        foreach (callback: CellCallback, callback_data: any) : void;
        foreach_alloc (context: CellAreaContext, widget: Widget, cell_area: Gdk.Rectangle, background_area: Gdk.Rectangle, callback: CellAllocCallback, callback_data: any) : void;
        get_cell_allocation (context: CellAreaContext, widget: Widget, renderer: CellRenderer, cell_area: Gdk.Rectangle, allocation: Gdk.Rectangle) : void;
        get_cell_at_position (context: CellAreaContext, widget: Widget, cell_area: Gdk.Rectangle, _x: number, _y: number, alloc_area: Gdk.Rectangle) : CellRenderer;
        get_current_path_string () : string;
        get_edit_widget () : CellEditable;
        get_edited_cell () : CellRenderer;
        get_focus_cell () : CellRenderer;
        get_focus_from_sibling (renderer: CellRenderer) : CellRenderer;
        get_focus_siblings (renderer: CellRenderer) : GLib.List;
        get_preferred_height (context: CellAreaContext, widget: Widget, minimum_height: number, natural_height: number) : void;
        get_preferred_height_for_width (context: CellAreaContext, widget: Widget, width: number, minimum_height: number, natural_height: number) : void;
        get_preferred_width (context: CellAreaContext, widget: Widget, minimum_width: number, natural_width: number) : void;
        get_preferred_width_for_height (context: CellAreaContext, widget: Widget, height: number, minimum_width: number, natural_width: number) : void;
        get_request_mode () : SizeRequestMode;
        has_renderer (renderer: CellRenderer) : boolean;
        inner_cell_area (widget: Widget, cell_area: Gdk.Rectangle, inner_area: Gdk.Rectangle) : void;
        is_activatable () : boolean;
        is_focus_sibling (renderer: CellRenderer, sibling: CellRenderer) : boolean;
        remove (renderer: CellRenderer) : void;
        remove_focus_sibling (renderer: CellRenderer, sibling: CellRenderer) : void;
        render (context: CellAreaContext, widget: Widget, cr: cairo.Context, background_area: Gdk.Rectangle, cell_area: Gdk.Rectangle, flags: CellRendererState, paint_focus: boolean) : void;
        request_renderer (renderer: CellRenderer, orientation: Orientation, widget: Widget, for_size: number, minimum_size: number, natural_size: number) : void;
        set_focus_cell (renderer: CellRenderer) : void;
        stop_editing (canceled: boolean) : void;
    }
    
    var CellArea: {
        
        
    }
    
    
    
    
    interface CellAreaBox extends CellArea, Buildable, CellLayout, Orientable {
        get_spacing () : number;
        // pack_end (renderer: CellRenderer, expand: boolean, align: boolean, fixed: boolean) : void;
        // pack_start (renderer: CellRenderer, expand: boolean, align: boolean, fixed: boolean) : void;
        set_spacing (spacing: number) : void;
    }
    
    var CellAreaBox: {
        new () : CellArea;
        
    }
    
    
    
    
    interface CellAreaContext extends GObject.Object {
        allocate (width: number, height: number) : void;
        get_allocation (width: number, height: number) : void;
        get_area () : CellArea;
        get_preferred_height (minimum_height: number, natural_height: number) : void;
        get_preferred_height_for_width (width: number, minimum_height: number, natural_height: number) : void;
        get_preferred_width (minimum_width: number, natural_width: number) : void;
        get_preferred_width_for_height (height: number, minimum_width: number, natural_width: number) : void;
        push_preferred_height (minimum_height: number, natural_height: number) : void;
        push_preferred_width (minimum_width: number, natural_width: number) : void;
        reset () : void;
    }
    
    var CellAreaContext: {
        
        
    }
    
    
    
    
    interface CellRenderer extends GObject.InitiallyUnowned {
        activate (event: Gdk.Event, widget: Widget, path: string, background_area: Gdk.Rectangle, cell_area: Gdk.Rectangle, flags: CellRendererState) : boolean;
        get_aligned_area (widget: Widget, flags: CellRendererState, cell_area: Gdk.Rectangle, aligned_area: Gdk.Rectangle) : void;
        get_alignment (xalign: number, yalign: number) : void;
        get_fixed_size (width: number, height: number) : void;
        get_padding (xpad: number, ypad: number) : void;
        get_preferred_height (widget: Widget, minimum_size: number, natural_size: number) : void;
        get_preferred_height_for_width (widget: Widget, width: number, minimum_height: number, natural_height: number) : void;
        get_preferred_size (widget: Widget, minimum_size: Requisition, natural_size: Requisition) : void;
        get_preferred_width (widget: Widget, minimum_size: number, natural_size: number) : void;
        get_preferred_width_for_height (widget: Widget, height: number, minimum_width: number, natural_width: number) : void;
        get_request_mode () : SizeRequestMode;
        get_sensitive () : boolean;
        get_size (widget: Widget, cell_area: Gdk.Rectangle, x_offset: number, y_offset: number, width: number, height: number) : void;
        get_state (widget: Widget, cell_state: CellRendererState) : StateFlags;
        get_visible () : boolean;
        is_activatable () : boolean;
        render (cr: cairo.Context, widget: Widget, background_area: Gdk.Rectangle, cell_area: Gdk.Rectangle, flags: CellRendererState) : void;
        set_alignment (xalign: number, yalign: number) : void;
        set_fixed_size (width: number, height: number) : void;
        set_padding (xpad: number, ypad: number) : void;
        set_sensitive (sensitive: boolean) : void;
        set_visible (visible: boolean) : void;
        start_editing (event: Gdk.Event, widget: Widget, path: string, background_area: Gdk.Rectangle, cell_area: Gdk.Rectangle, flags: CellRendererState) : CellEditable;
        stop_editing (canceled: boolean) : void;
    }
    
    var CellRenderer: {
        
        
    }
    
    
    
    
    interface CellRendererAccel extends CellRendererText {
        
    }
    
    var CellRendererAccel: {
        new () : CellRenderer;
        
    }
    
    
    
    
    interface CellRendererCombo extends CellRendererText {
        
    }
    
    var CellRendererCombo: {
        new () : CellRenderer;
        
    }
    
    
    
    
    interface CellRendererPixbuf extends CellRenderer {
        
    }
    
    var CellRendererPixbuf: {
        new () : CellRenderer;
        
    }
    
    
    
    
    interface CellRendererProgress extends CellRenderer, Orientable {
        
    }
    
    var CellRendererProgress: {
        new () : CellRenderer;
        
    }
    
    
    
    
    interface CellRendererSpin extends CellRendererText {
        
    }
    
    var CellRendererSpin: {
        new () : CellRenderer;
        
    }
    
    
    
    
    interface CellRendererSpinner extends CellRenderer {
        
    }
    
    var CellRendererSpinner: {
        new () : CellRenderer;
        
    }
    
    
    
    
    interface CellRendererText extends CellRenderer {
        set_fixed_height_from_font (number_of_rows: number) : void;
    }
    
    var CellRendererText: {
        new () : CellRenderer;
        
    }
    
    
    
    
    interface CellRendererToggle extends CellRenderer {
        get_activatable () : boolean;
        get_active () : boolean;
        get_radio () : boolean;
        set_activatable (setting: boolean) : void;
        set_active (setting: boolean) : void;
        set_radio (radio: boolean) : void;
    }
    
    var CellRendererToggle: {
        new () : CellRenderer;
        
    }
    
    
    
    
    interface CellView extends Widget, Atk.ImplementorIface, Buildable, CellLayout, Orientable {
        get_displayed_row () : TreePath;
        get_draw_sensitive () : boolean;
        get_fit_model () : boolean;
        get_model () : TreeModel;
        get_size_of_row (path: TreePath, requisition: Requisition) : boolean;
        set_background_color (color: Gdk.Color) : void;
        set_background_rgba (rgba: Gdk.RGBA) : void;
        set_displayed_row (path: TreePath) : void;
        set_draw_sensitive (draw_sensitive: boolean) : void;
        set_fit_model (fit_model: boolean) : void;
        set_model (model: TreeModel) : void;
    }
    
    var CellView: {
        new () : Widget;
        new_with_context (area: CellArea, context: CellAreaContext) : Widget;
        new_with_markup (markup: string) : Widget;
        new_with_pixbuf (pixbuf: GdkPixbuf.Pixbuf) : Widget;
        new_with_text (text: string) : Widget;
        
    }
    
    
    
    
    interface CheckButton extends ToggleButton, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        
    }
    
    var CheckButton: {
        new () : Widget;
        new_with_label (label: string) : Widget;
        new_with_mnemonic (label: string) : Widget;
        
    }
    
    
    
    
    interface CheckMenuItem extends MenuItem, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_active () : boolean;
        get_draw_as_radio () : boolean;
        get_inconsistent () : boolean;
        set_active (is_active: boolean) : void;
        set_draw_as_radio (draw_as_radio: boolean) : void;
        set_inconsistent (setting: boolean) : void;
        toggled () : void;
    }
    
    var CheckMenuItem: {
        new () : Widget;
        new_with_label (label: string) : Widget;
        new_with_mnemonic (label: string) : Widget;
        
    }
    
    
    
    
    interface CheckMenuItemAccessible extends MenuItemAccessible, Atk.Action, Atk.Component, Atk.Selection {
        
    }
    
    var CheckMenuItemAccessible: {
        
        
    }
    
    
    
    
    interface Clipboard extends GObject.Object {
        clear () : void;
        get_display () : Gdk.Display;
        get_owner () : GObject.Object;
        get_selection () : Gdk.Atom;
        request_contents (target: Gdk.Atom, callback: ClipboardReceivedFunc, user_data: any) : void;
        request_image (callback: ClipboardImageReceivedFunc, user_data: any) : void;
        request_rich_text (buffer: TextBuffer, callback: ClipboardRichTextReceivedFunc, user_data: any) : void;
        request_targets (callback: ClipboardTargetsReceivedFunc, user_data: any) : void;
        request_text (callback: ClipboardTextReceivedFunc, user_data: any) : void;
        request_uris (callback: ClipboardURIReceivedFunc, user_data: any) : void;
        set_can_store (targets: TargetEntry[], n_targets: number) : void;
        set_image (pixbuf: GdkPixbuf.Pixbuf) : void;
        set_text (text: string, len: number) : void;
        set_with_data (targets: TargetEntry[], n_targets: number, get_func: ClipboardGetFunc, clear_func: ClipboardClearFunc, user_data: any) : boolean;
        set_with_owner (targets: TargetEntry[], n_targets: number, get_func: ClipboardGetFunc, clear_func: ClipboardClearFunc, owner: GObject.Object) : boolean;
        store () : void;
        wait_for_contents (target: Gdk.Atom) : SelectionData;
        wait_for_image () : GdkPixbuf.Pixbuf;
        wait_for_rich_text (buffer: TextBuffer, format: Gdk.Atom, length: number) : number[];
        wait_for_targets (targets: Gdk.Atom[], n_targets: number) : boolean;
        wait_for_text () : string;
        wait_for_uris () : string[];
        wait_is_image_available () : boolean;
        wait_is_rich_text_available (buffer: TextBuffer) : boolean;
        wait_is_target_available (target: Gdk.Atom) : boolean;
        wait_is_text_available () : boolean;
        wait_is_uris_available () : boolean;
    }
    
    var Clipboard: {
        
        get (selection: Gdk.Atom) : Clipboard;
        get_default (display: Gdk.Display) : Clipboard;
        get_for_display (display: Gdk.Display, selection: Gdk.Atom) : Clipboard;
    }
    
    
    
    
    interface ColorButton extends Button, Atk.ImplementorIface, Actionable, Activatable, Buildable, ColorChooser {
        get_alpha () : number;
        get_color (color: Gdk.Color) : void;
        get_rgba (rgba: Gdk.RGBA) : void;
        get_title () : string;
        get_use_alpha () : boolean;
        set_alpha (alpha: number) : void;
        set_color (color: Gdk.Color) : void;
        set_rgba (rgba: Gdk.RGBA) : void;
        set_title (title: string) : void;
        set_use_alpha (use_alpha: boolean) : void;
    }
    
    var ColorButton: {
        new () : Widget;
        new_with_color (color: Gdk.Color) : Widget;
        new_with_rgba (rgba: Gdk.RGBA) : Widget;
        
    }
    
    
    
    
    interface ColorChooserDialog extends Dialog, Atk.ImplementorIface, Buildable, ColorChooser {
        
    }
    
    var ColorChooserDialog: {
        new (title: string, parent: Window) : Widget;
        
    }
    
    
    
    
    interface ColorChooserWidget extends Box, Atk.ImplementorIface, Buildable, ColorChooser, Orientable {
        
    }
    
    var ColorChooserWidget: {
        new () : Widget;
        
    }
    
    
    
    
    interface ColorSelection extends Box, Atk.ImplementorIface, Buildable, Orientable {
        get_current_alpha () : number;
        get_current_color (color: Gdk.Color) : void;
        get_current_rgba (rgba: Gdk.RGBA) : void;
        get_has_opacity_control () : boolean;
        get_has_palette () : boolean;
        get_previous_alpha () : number;
        get_previous_color (color: Gdk.Color) : void;
        get_previous_rgba (rgba: Gdk.RGBA) : void;
        is_adjusting () : boolean;
        set_current_alpha (alpha: number) : void;
        set_current_color (color: Gdk.Color) : void;
        set_current_rgba (rgba: Gdk.RGBA) : void;
        set_has_opacity_control (has_opacity: boolean) : void;
        set_has_palette (has_palette: boolean) : void;
        set_previous_alpha (alpha: number) : void;
        set_previous_color (color: Gdk.Color) : void;
        set_previous_rgba (rgba: Gdk.RGBA) : void;
    }
    
    var ColorSelection: {
        new () : Widget;
        palette_from_string (_str: string, colors: Gdk.Color[], n_colors: number) : boolean;
        palette_to_string (colors: Gdk.Color[], n_colors: number) : string;
        set_change_palette_with_screen_hook (_func: ColorSelectionChangePaletteWithScreenFunc) : ColorSelectionChangePaletteWithScreenFunc;
    }
    
    
    
    
    interface ColorSelectionDialog extends Dialog, Atk.ImplementorIface, Buildable {
        get_color_selection () : Widget;
    }
    
    var ColorSelectionDialog: {
        new (title: string) : Widget;
        
    }
    
    
    
    
    interface ComboBox extends Bin, Atk.ImplementorIface, Buildable, CellEditable, CellLayout {
        get_active () : number;
        get_active_id () : string;
        get_active_iter (iter: TreeIter) : boolean;
        get_add_tearoffs () : boolean;
        get_button_sensitivity () : SensitivityType;
        get_column_span_column () : number;
        get_entry_text_column () : number;
        get_focus_on_click () : boolean;
        get_has_entry () : boolean;
        get_id_column () : number;
        get_model () : TreeModel;
        get_popup_accessible () : Atk.Object;
        get_popup_fixed_width () : boolean;
        get_row_separator_func () : TreeViewRowSeparatorFunc;
        get_row_span_column () : number;
        get_title () : string;
        get_wrap_width () : number;
        popdown () : void;
        popup () : void;
        popup_for_device (device: Gdk.Device) : void;
        set_active (index_: number) : void;
        set_active_id (active_id: string) : boolean;
        set_active_iter (iter: TreeIter) : void;
        set_add_tearoffs (add_tearoffs: boolean) : void;
        set_button_sensitivity (sensitivity: SensitivityType) : void;
        set_column_span_column (column_span: number) : void;
        set_entry_text_column (text_column: number) : void;
        set_focus_on_click (focus_on_click: boolean) : void;
        set_id_column (id_column: number) : void;
        set_model (model: TreeModel) : void;
        set_popup_fixed_width (fixed: boolean) : void;
        set_row_separator_func (_func: TreeViewRowSeparatorFunc, data: any, destroy: GLib.DestroyNotify) : void;
        set_row_span_column (row_span: number) : void;
        set_title (title: string) : void;
        set_wrap_width (width: number) : void;
    }
    
    var ComboBox: {
        new () : Widget;
        new_with_area (area: CellArea) : Widget;
        new_with_area_and_entry (area: CellArea) : Widget;
        new_with_entry () : Widget;
        new_with_model (model: TreeModel) : Widget;
        new_with_model_and_entry (model: TreeModel) : Widget;
        
    }
    
    
    
    
    interface ComboBoxAccessible extends ContainerAccessible, Atk.Action, Atk.Component, Atk.Selection {
        
    }
    
    var ComboBoxAccessible: {
        
        
    }
    
    
    
    
    interface ComboBoxText extends ComboBox, Atk.ImplementorIface, Buildable, CellEditable, CellLayout {
        append (_id: string, text: string) : void;
        append_text (text: string) : void;
        get_active_text () : string;
        insert (position: number, _id: string, text: string) : void;
        insert_text (position: number, text: string) : void;
        prepend (_id: string, text: string) : void;
        prepend_text (text: string) : void;
        remove (position: number) : void;
        remove_all () : void;
    }
    
    var ComboBoxText: {
        new () : Widget;
        new_with_entry () : Widget;
        
    }
    
    
    
    
    interface Container extends Widget, Atk.ImplementorIface, Buildable {
        add (widget: Widget) : void;
        add_with_properties (widget: Widget, first_prop_name: string) : void;
        check_resize () : void;
        child_get (child: Widget, first_prop_name: string) : void;
        child_get_property (child: Widget, property_name: string, value: GObject.Value) : void;
        child_get_valist (child: Widget, first_property_name: string, var_args: any[]) : void;
        child_notify (child: Widget, child_property: string) : void;
        child_notify_by_pspec (child: Widget, pspec: GObject.ParamSpec) : void;
        child_set (child: Widget, first_prop_name: string) : void;
        child_set_property (child: Widget, property_name: string, value: GObject.Value) : void;
        child_set_valist (child: Widget, first_property_name: string, var_args: any[]) : void;
        child_type () : GObject.Type;
        forall (callback: Callback, callback_data: any) : void;
        foreach (callback: Callback, callback_data: any) : void;
        get_border_width () : number;
        get_children () : GLib.List;
        get_focus_chain (focusable_widgets: GLib.List) : boolean;
        get_focus_child () : Widget;
        get_focus_hadjustment () : Adjustment;
        get_focus_vadjustment () : Adjustment;
        get_path_for_child (child: Widget) : WidgetPath;
        get_resize_mode () : ResizeMode;
        propagate_draw (child: Widget, cr: cairo.Context) : void;
        // remove (widget: Widget) : void;
        resize_children () : void;
        set_border_width (border_width: number) : void;
        set_focus_chain (focusable_widgets: GLib.List) : void;
        set_focus_child (child: Widget) : void;
        set_focus_hadjustment (adjustment: Adjustment) : void;
        set_focus_vadjustment (adjustment: Adjustment) : void;
        set_reallocate_redraws (needs_redraws: boolean) : void;
        set_resize_mode (resize_mode: ResizeMode) : void;
        unset_focus_chain () : void;
    }
    
    var Container: {
        
        
    }
    
    
    
    
    interface ContainerAccessible extends WidgetAccessible, Atk.Component {
        
    }
    
    var ContainerAccessible: {
        
        
    }
    
    
    
    
    interface ContainerCellAccessible extends CellAccessible, Atk.Action, Atk.Component, Atk.TableCell {
        add_child (child: CellAccessible) : void;
        get_children () : GLib.List;
        remove_child (child: CellAccessible) : void;
    }
    
    var ContainerCellAccessible: {
        new () : ContainerCellAccessible;
        
    }
    
    
    
    
    interface CssProvider extends GObject.Object, StyleProvider {
        load_from_data (data: number[], length: number) : boolean;
        load_from_file (file: Gio.File) : boolean;
        load_from_path (path: string) : boolean;
        load_from_resource (resource_path: string) : void;
        to_string () : string;
    }
    
    var CssProvider: {
        new () : CssProvider;
        get_default () : CssProvider;
        get_named (name: string, variant: string) : CssProvider;
    }
    
    
    
    
    interface Dialog extends Window, Atk.ImplementorIface, Buildable {
        add_action_widget (child: Widget, response_id: number) : void;
        add_button (button_text: string, response_id: number) : Widget;
        add_buttons (first_button_text: string) : void;
        get_action_area () : Widget;
        get_content_area () : Box;
        get_header_bar () : Widget;
        get_response_for_widget (widget: Widget) : number;
        get_widget_for_response (response_id: number) : Widget;
        response (response_id: number) : void;
        run () : number;
        set_alternative_button_order (first_response_id: number) : void;
        set_alternative_button_order_from_array (n_params: number, new_order: number[]) : void;
        set_default_response (response_id: number) : void;
        set_response_sensitive (response_id: number, setting: boolean) : void;
    }
    
    var Dialog: {
        new () : Widget;
        new_with_buttons (title: string, parent: Window, flags: DialogFlags, first_button_text: string) : Widget;
        
    }
    
    
    
    
    interface DrawingArea extends Widget, Atk.ImplementorIface, Buildable {
        
    }
    
    var DrawingArea: {
        new () : Widget;
        
    }
    
    
    
    
    interface Entry extends Widget, Atk.ImplementorIface, Buildable, CellEditable, Editable {
        get_activates_default () : boolean;
        get_alignment () : number;
        get_attributes () : Pango.AttrList;
        get_buffer () : EntryBuffer;
        get_completion () : EntryCompletion;
        get_current_icon_drag_source () : number;
        get_cursor_hadjustment () : Adjustment;
        get_has_frame () : boolean;
        get_icon_activatable (icon_pos: EntryIconPosition) : boolean;
        get_icon_area (icon_pos: EntryIconPosition, icon_area: Gdk.Rectangle) : void;
        get_icon_at_pos (_x: number, _y: number) : number;
        get_icon_gicon (icon_pos: EntryIconPosition) : Gio.Icon;
        get_icon_name (icon_pos: EntryIconPosition) : string;
        get_icon_pixbuf (icon_pos: EntryIconPosition) : GdkPixbuf.Pixbuf;
        get_icon_sensitive (icon_pos: EntryIconPosition) : boolean;
        get_icon_stock (icon_pos: EntryIconPosition) : string;
        get_icon_storage_type (icon_pos: EntryIconPosition) : ImageType;
        get_icon_tooltip_markup (icon_pos: EntryIconPosition) : string;
        get_icon_tooltip_text (icon_pos: EntryIconPosition) : string;
        get_inner_border () : Border;
        get_input_hints () : InputHints;
        get_input_purpose () : InputPurpose;
        get_invisible_char () : string;
        get_layout () : Pango.Layout;
        get_layout_offsets (_x: number, _y: number) : void;
        get_max_length () : number;
        get_max_width_chars () : number;
        get_overwrite_mode () : boolean;
        get_placeholder_text () : string;
        get_progress_fraction () : number;
        get_progress_pulse_step () : number;
        get_tabs () : Pango.TabArray;
        get_text () : string;
        get_text_area (text_area: Gdk.Rectangle) : void;
        get_text_length () : number;
        get_visibility () : boolean;
        get_width_chars () : number;
        grab_focus_without_selecting () : void;
        im_context_filter_keypress (event: Gdk.EventKey) : boolean;
        layout_index_to_text_index (layout_index: number) : number;
        progress_pulse () : void;
        reset_im_context () : void;
        set_activates_default (setting: boolean) : void;
        set_alignment (xalign: number) : void;
        set_attributes (attrs: Pango.AttrList) : void;
        set_buffer (buffer: EntryBuffer) : void;
        set_completion (completion: EntryCompletion) : void;
        set_cursor_hadjustment (adjustment: Adjustment) : void;
        set_has_frame (setting: boolean) : void;
        set_icon_activatable (icon_pos: EntryIconPosition, activatable: boolean) : void;
        set_icon_drag_source (icon_pos: EntryIconPosition, target_list: TargetList, actions: Gdk.DragAction) : void;
        set_icon_from_gicon (icon_pos: EntryIconPosition, icon: Gio.Icon) : void;
        set_icon_from_icon_name (icon_pos: EntryIconPosition, icon_name: string) : void;
        set_icon_from_pixbuf (icon_pos: EntryIconPosition, pixbuf: GdkPixbuf.Pixbuf) : void;
        set_icon_from_stock (icon_pos: EntryIconPosition, stock_id: string) : void;
        set_icon_sensitive (icon_pos: EntryIconPosition, sensitive: boolean) : void;
        set_icon_tooltip_markup (icon_pos: EntryIconPosition, tooltip: string) : void;
        set_icon_tooltip_text (icon_pos: EntryIconPosition, tooltip: string) : void;
        set_inner_border (border: Border) : void;
        set_input_hints (hints: InputHints) : void;
        set_input_purpose (purpose: InputPurpose) : void;
        set_invisible_char (_ch: string) : void;
        set_max_length (max: number) : void;
        set_max_width_chars (n_chars: number) : void;
        set_overwrite_mode (overwrite: boolean) : void;
        set_placeholder_text (text: string) : void;
        set_progress_fraction (fraction: number) : void;
        set_progress_pulse_step (fraction: number) : void;
        set_tabs (tabs: Pango.TabArray) : void;
        set_text (text: string) : void;
        set_visibility (visible: boolean) : void;
        set_width_chars (n_chars: number) : void;
        text_index_to_layout_index (text_index: number) : number;
        unset_invisible_char () : void;
    }
    
    var Entry: {
        new () : Widget;
        new_with_buffer (buffer: EntryBuffer) : Widget;
        
    }
    
    
    
    
    interface EntryAccessible extends WidgetAccessible, Atk.Action, Atk.Component, Atk.EditableText, Atk.Text {
        
    }
    
    var EntryAccessible: {
        
        
    }
    
    
    
    
    interface EntryBuffer extends GObject.Object {
        delete_text (position: number, n_chars: number) : number;
        emit_deleted_text (position: number, n_chars: number) : void;
        emit_inserted_text (position: number, chars: string, n_chars: number) : void;
        get_bytes () : number;
        get_length () : number;
        get_max_length () : number;
        get_text () : string;
        insert_text (position: number, chars: string, n_chars: number) : number;
        set_max_length (max_length: number) : void;
        set_text (chars: string, n_chars: number) : void;
    }
    
    var EntryBuffer: {
        new (initial_chars: string, n_initial_chars: number) : EntryBuffer;
        
    }
    
    
    
    
    interface EntryCompletion extends GObject.Object, Buildable, CellLayout {
        complete () : void;
        compute_prefix (key: string) : string;
        delete_action (index_: number) : void;
        get_completion_prefix () : string;
        get_entry () : Widget;
        get_inline_completion () : boolean;
        get_inline_selection () : boolean;
        get_minimum_key_length () : number;
        get_model () : TreeModel;
        get_popup_completion () : boolean;
        get_popup_set_width () : boolean;
        get_popup_single_match () : boolean;
        get_text_column () : number;
        insert_action_markup (index_: number, markup: string) : void;
        insert_action_text (index_: number, text: string) : void;
        insert_prefix () : void;
        set_inline_completion (inline_completion: boolean) : void;
        set_inline_selection (inline_selection: boolean) : void;
        set_match_func (_func: EntryCompletionMatchFunc, func_data: any, func_notify: GLib.DestroyNotify) : void;
        set_minimum_key_length (length: number) : void;
        set_model (model: TreeModel) : void;
        set_popup_completion (popup_completion: boolean) : void;
        set_popup_set_width (popup_set_width: boolean) : void;
        set_popup_single_match (popup_single_match: boolean) : void;
        set_text_column (column: number) : void;
    }
    
    var EntryCompletion: {
        new () : EntryCompletion;
        new_with_area (area: CellArea) : EntryCompletion;
        
    }
    
    
    
    
    interface EntryIconAccessible extends Atk.Object, Atk.Action, Atk.Component {
        
    }
    
    var EntryIconAccessible: {
        
        
    }
    
    
    
    
    interface EventBox extends Bin, Atk.ImplementorIface, Buildable {
        get_above_child () : boolean;
        get_visible_window () : boolean;
        set_above_child (above_child: boolean) : void;
        set_visible_window (visible_window: boolean) : void;
    }
    
    var EventBox: {
        new () : Widget;
        
    }
    
    
    
    
    interface EventController extends GObject.Object {
        get_propagation_phase () : PropagationPhase;
        get_widget () : Widget;
        handle_event (event: Gdk.Event) : boolean;
        reset () : void;
        set_propagation_phase (phase: PropagationPhase) : void;
    }
    
    var EventController: {
        
        
    }
    
    
    
    
    interface EventControllerKey extends EventController {
        forward (widget: Widget) : boolean;
        get_group () : number;
        get_im_context () : IMContext;
        set_im_context (im_context: IMContext) : void;
    }
    
    var EventControllerKey: {
        new (widget: Widget) : EventController;
        
    }
    
    
    
    
    interface EventControllerMotion extends EventController {
        
    }
    
    var EventControllerMotion: {
        new (widget: Widget) : EventController;
        
    }
    
    
    
    
    interface EventControllerScroll extends EventController {
        get_flags () : EventControllerScrollFlags;
        set_flags (flags: EventControllerScrollFlags) : void;
    }
    
    var EventControllerScroll: {
        new (widget: Widget, flags: EventControllerScrollFlags) : EventController;
        
    }
    
    
    
    
    interface Expander extends Bin, Atk.ImplementorIface, Buildable {
        get_expanded () : boolean;
        get_label () : string;
        get_label_fill () : boolean;
        get_label_widget () : Widget;
        get_resize_toplevel () : boolean;
        get_spacing () : number;
        get_use_markup () : boolean;
        get_use_underline () : boolean;
        set_expanded (expanded: boolean) : void;
        set_label (label: string) : void;
        set_label_fill (label_fill: boolean) : void;
        set_label_widget (label_widget: Widget) : void;
        set_resize_toplevel (resize_toplevel: boolean) : void;
        set_spacing (spacing: number) : void;
        set_use_markup (use_markup: boolean) : void;
        set_use_underline (use_underline: boolean) : void;
    }
    
    var Expander: {
        new (label: string) : Widget;
        new_with_mnemonic (label: string) : Widget;
        
    }
    
    
    
    
    interface ExpanderAccessible extends ContainerAccessible, Atk.Action, Atk.Component {
        
    }
    
    var ExpanderAccessible: {
        
        
    }
    
    
    
    
    interface FileChooserButton extends Box, Atk.ImplementorIface, Buildable, FileChooser, Orientable {
        get_focus_on_click () : boolean;
        get_title () : string;
        get_width_chars () : number;
        set_focus_on_click (focus_on_click: boolean) : void;
        set_title (title: string) : void;
        set_width_chars (n_chars: number) : void;
    }
    
    var FileChooserButton: {
        new (title: string, action: FileChooserAction) : Widget;
        new_with_dialog (dialog: Dialog) : Widget;
        
    }
    
    
    
    
    interface FileChooserDialog extends Dialog, Atk.ImplementorIface, Buildable, FileChooser {
        
    }
    
    var FileChooserDialog: {
        new (title: string, parent: Window, action: FileChooserAction, first_button_text: string) : Widget;
        
    }
    
    
    
    
    interface FileChooserNative extends NativeDialog, FileChooser {
        get_accept_label () : string;
        get_cancel_label () : string;
        set_accept_label (accept_label: string) : void;
        set_cancel_label (cancel_label: string) : void;
    }
    
    var FileChooserNative: {
        new (title: string, parent: Window, action: FileChooserAction, accept_label: string, cancel_label: string) : FileChooserNative;
        
    }
    
    
    
    
    interface FileChooserWidget extends Box, Atk.ImplementorIface, Buildable, FileChooser, Orientable {
        
    }
    
    var FileChooserWidget: {
        new (action: FileChooserAction) : Widget;
        
    }
    
    
    
    
    interface FileFilter extends GObject.InitiallyUnowned, Buildable {
        add_custom (needed: FileFilterFlags, _func: FileFilterFunc, data: any, notify: GLib.DestroyNotify) : void;
        add_mime_type (mime_type: string) : void;
        add_pattern (pattern: string) : void;
        add_pixbuf_formats () : void;
        filter (filter_info: FileFilterInfo) : boolean;
        get_name () : string;
        get_needed () : FileFilterFlags;
        set_name (name: string) : void;
        to_gvariant () : GLib.Variant;
    }
    
    var FileFilter: {
        new () : FileFilter;
        new_from_gvariant (variant: GLib.Variant) : FileFilter;
        
    }
    
    
    
    
    interface Fixed extends Container, Atk.ImplementorIface, Buildable {
        move (widget: Widget, _x: number, _y: number) : void;
        put (widget: Widget, _x: number, _y: number) : void;
    }
    
    var Fixed: {
        new () : Widget;
        
    }
    
    
    
    
    interface FlowBox extends Container, Atk.ImplementorIface, Buildable, Orientable {
        bind_model (model: Gio.ListModel, create_widget_func: FlowBoxCreateWidgetFunc, user_data: any, user_data_free_func: GLib.DestroyNotify) : void;
        get_activate_on_single_click () : boolean;
        get_child_at_index (idx: number) : FlowBoxChild;
        get_child_at_pos (_x: number, _y: number) : FlowBoxChild;
        get_column_spacing () : number;
        get_homogeneous () : boolean;
        get_max_children_per_line () : number;
        get_min_children_per_line () : number;
        get_row_spacing () : number;
        get_selected_children () : GLib.List;
        get_selection_mode () : SelectionMode;
        insert (widget: Widget, position: number) : void;
        invalidate_filter () : void;
        invalidate_sort () : void;
        select_all () : void;
        select_child (child: FlowBoxChild) : void;
        selected_foreach (_func: FlowBoxForeachFunc, data: any) : void;
        set_activate_on_single_click (single: boolean) : void;
        set_column_spacing (spacing: number) : void;
        set_filter_func (filter_func: FlowBoxFilterFunc, user_data: any, destroy: GLib.DestroyNotify) : void;
        set_hadjustment (adjustment: Adjustment) : void;
        set_homogeneous (homogeneous: boolean) : void;
        set_max_children_per_line (n_children: number) : void;
        set_min_children_per_line (n_children: number) : void;
        set_row_spacing (spacing: number) : void;
        set_selection_mode (mode: SelectionMode) : void;
        set_sort_func (sort_func: FlowBoxSortFunc, user_data: any, destroy: GLib.DestroyNotify) : void;
        set_vadjustment (adjustment: Adjustment) : void;
        unselect_all () : void;
        unselect_child (child: FlowBoxChild) : void;
    }
    
    var FlowBox: {
        new () : Widget;
        
    }
    
    
    
    
    interface FlowBoxAccessible extends ContainerAccessible, Atk.Component, Atk.Selection {
        
    }
    
    var FlowBoxAccessible: {
        
        
    }
    
    
    
    
    interface FlowBoxChild extends Bin, Atk.ImplementorIface, Buildable {
        changed () : void;
        get_index () : number;
        is_selected () : boolean;
    }
    
    var FlowBoxChild: {
        new () : Widget;
        
    }
    
    
    
    
    interface FlowBoxChildAccessible extends ContainerAccessible, Atk.Component {
        
    }
    
    var FlowBoxChildAccessible: {
        
        
    }
    
    
    
    
    interface FontButton extends Button, Atk.ImplementorIface, Actionable, Activatable, Buildable, FontChooser {
        get_font_name () : string;
        get_show_size () : boolean;
        get_show_style () : boolean;
        get_title () : string;
        get_use_font () : boolean;
        get_use_size () : boolean;
        set_font_name (fontname: string) : boolean;
        set_show_size (show_size: boolean) : void;
        set_show_style (show_style: boolean) : void;
        set_title (title: string) : void;
        set_use_font (use_font: boolean) : void;
        set_use_size (use_size: boolean) : void;
    }
    
    var FontButton: {
        new () : Widget;
        new_with_font (fontname: string) : Widget;
        
    }
    
    
    
    
    interface FontChooserDialog extends Dialog, Atk.ImplementorIface, Buildable, FontChooser {
        
    }
    
    var FontChooserDialog: {
        new (title: string, parent: Window) : Widget;
        
    }
    
    
    
    
    interface FontChooserWidget extends Box, Atk.ImplementorIface, Buildable, FontChooser, Orientable {
        
    }
    
    var FontChooserWidget: {
        new () : Widget;
        
    }
    
    
    
    
    interface FontSelection extends Box, Atk.ImplementorIface, Buildable, Orientable {
        get_face () : Pango.FontFace;
        get_face_list () : Widget;
        get_family () : Pango.FontFamily;
        get_family_list () : Widget;
        get_font_name () : string;
        get_preview_entry () : Widget;
        get_preview_text () : string;
        get_size () : number;
        get_size_entry () : Widget;
        get_size_list () : Widget;
        set_font_name (fontname: string) : boolean;
        set_preview_text (text: string) : void;
    }
    
    var FontSelection: {
        new () : Widget;
        
    }
    
    
    
    
    interface FontSelectionDialog extends Dialog, Atk.ImplementorIface, Buildable {
        get_cancel_button () : Widget;
        get_font_name () : string;
        get_font_selection () : Widget;
        get_ok_button () : Widget;
        get_preview_text () : string;
        set_font_name (fontname: string) : boolean;
        set_preview_text (text: string) : void;
    }
    
    var FontSelectionDialog: {
        new (title: string) : Widget;
        
    }
    
    
    
    
    interface Frame extends Bin, Atk.ImplementorIface, Buildable {
        get_label () : string;
        get_label_align (xalign: number, yalign: number) : void;
        get_label_widget () : Widget;
        get_shadow_type () : ShadowType;
        set_label (label: string) : void;
        set_label_align (xalign: number, yalign: number) : void;
        set_label_widget (label_widget: Widget) : void;
        set_shadow_type (_type: ShadowType) : void;
    }
    
    var Frame: {
        new (label: string) : Widget;
        
    }
    
    
    
    
    interface FrameAccessible extends ContainerAccessible, Atk.Component {
        
    }
    
    var FrameAccessible: {
        
        
    }
    
    
    
    
    interface GLArea extends Widget, Atk.ImplementorIface, Buildable {
        attach_buffers () : void;
        get_auto_render () : boolean;
        get_context () : Gdk.GLContext;
        get_error () : GLib.Error;
        get_has_alpha () : boolean;
        get_has_depth_buffer () : boolean;
        get_has_stencil_buffer () : boolean;
        get_required_version (major: number, minor: number) : void;
        get_use_es () : boolean;
        make_current () : void;
        queue_render () : void;
        set_auto_render (auto_render: boolean) : void;
        set_error (error: GLib.Error) : void;
        set_has_alpha (has_alpha: boolean) : void;
        set_has_depth_buffer (has_depth_buffer: boolean) : void;
        set_has_stencil_buffer (has_stencil_buffer: boolean) : void;
        set_required_version (major: number, minor: number) : void;
        set_use_es (use_es: boolean) : void;
    }
    
    var GLArea: {
        new () : Widget;
        
    }
    
    
    
    
    interface Gesture extends EventController {
        get_bounding_box (rect: Gdk.Rectangle) : boolean;
        get_bounding_box_center (_x: number, _y: number) : boolean;
        get_device () : Gdk.Device;
        get_group () : GLib.List;
        get_last_event (sequence: Gdk.EventSequence) : Gdk.Event;
        get_last_updated_sequence () : Gdk.EventSequence;
        get_point (sequence: Gdk.EventSequence, _x: number, _y: number) : boolean;
        get_sequence_state (sequence: Gdk.EventSequence) : EventSequenceState;
        get_sequences () : GLib.List;
        get_window () : Gdk.Window;
        group (gesture: Gesture) : void;
        handles_sequence (sequence: Gdk.EventSequence) : boolean;
        is_active () : boolean;
        is_grouped_with (other: Gesture) : boolean;
        is_recognized () : boolean;
        set_sequence_state (sequence: Gdk.EventSequence, state: EventSequenceState) : boolean;
        set_state (state: EventSequenceState) : boolean;
        set_window (window: Gdk.Window) : void;
        ungroup () : void;
    }
    
    var Gesture: {
        
        
    }
    
    
    
    
    interface GestureDrag extends GestureSingle {
        get_offset (_x: number, _y: number) : boolean;
        get_start_point (_x: number, _y: number) : boolean;
    }
    
    var GestureDrag: {
        new (widget: Widget) : Gesture;
        
    }
    
    
    
    
    interface GestureLongPress extends GestureSingle {
        
    }
    
    var GestureLongPress: {
        new (widget: Widget) : Gesture;
        
    }
    
    
    
    
    interface GestureMultiPress extends GestureSingle {
        get_area (rect: Gdk.Rectangle) : boolean;
        set_area (rect: Gdk.Rectangle) : void;
    }
    
    var GestureMultiPress: {
        new (widget: Widget) : Gesture;
        
    }
    
    
    
    
    interface GesturePan extends GestureDrag {
        get_orientation () : Orientation;
        set_orientation (orientation: Orientation) : void;
    }
    
    var GesturePan: {
        new (widget: Widget, orientation: Orientation) : Gesture;
        
    }
    
    
    
    
    interface GestureRotate extends Gesture {
        get_angle_delta () : number;
    }
    
    var GestureRotate: {
        new (widget: Widget) : Gesture;
        
    }
    
    
    
    
    interface GestureSingle extends Gesture {
        get_button () : number;
        get_current_button () : number;
        get_current_sequence () : Gdk.EventSequence;
        get_exclusive () : boolean;
        get_touch_only () : boolean;
        set_button (button: number) : void;
        set_exclusive (exclusive: boolean) : void;
        set_touch_only (touch_only: boolean) : void;
    }
    
    var GestureSingle: {
        
        
    }
    
    
    
    
    interface GestureStylus extends GestureSingle {
        get_axes (axes: Gdk.AxisUse[], values: number[]) : boolean;
        get_axis (axis: Gdk.AxisUse, value: number) : boolean;
        get_device_tool () : Gdk.DeviceTool;
    }
    
    var GestureStylus: {
        new (widget: Widget) : Gesture;
        
    }
    
    
    
    
    interface GestureSwipe extends GestureSingle {
        get_velocity (velocity_x: number, velocity_y: number) : boolean;
    }
    
    var GestureSwipe: {
        new (widget: Widget) : Gesture;
        
    }
    
    
    
    
    interface GestureZoom extends Gesture {
        get_scale_delta () : number;
    }
    
    var GestureZoom: {
        new (widget: Widget) : Gesture;
        
    }
    
    
    
    
    interface Grid extends Container, Atk.ImplementorIface, Buildable, Orientable {
        attach (child: Widget, left: number, top: number, width: number, height: number) : void;
        attach_next_to (child: Widget, sibling: Widget, side: PositionType, width: number, height: number) : void;
        get_baseline_row () : number;
        get_child_at (left: number, top: number) : Widget;
        get_column_homogeneous () : boolean;
        get_column_spacing () : number;
        get_row_baseline_position (_row: number) : BaselinePosition;
        get_row_homogeneous () : boolean;
        get_row_spacing () : number;
        insert_column (position: number) : void;
        insert_next_to (sibling: Widget, side: PositionType) : void;
        insert_row (position: number) : void;
        remove_column (position: number) : void;
        remove_row (position: number) : void;
        set_baseline_row (_row: number) : void;
        set_column_homogeneous (homogeneous: boolean) : void;
        set_column_spacing (spacing: number) : void;
        set_row_baseline_position (_row: number, pos: BaselinePosition) : void;
        set_row_homogeneous (homogeneous: boolean) : void;
        set_row_spacing (spacing: number) : void;
    }
    
    var Grid: {
        new () : Widget;
        
    }
    
    
    
    
    interface HBox extends Box, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var HBox: {
        new (homogeneous: boolean, spacing: number) : Widget;
        
    }
    
    
    
    
    interface HButtonBox extends ButtonBox, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var HButtonBox: {
        new () : Widget;
        
    }
    
    
    
    
    interface HPaned extends Paned, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var HPaned: {
        new () : Widget;
        
    }
    
    
    
    
    interface HSV extends Widget, Atk.ImplementorIface, Buildable {
        get_color (_h: number, _s: number, _v: number) : void;
        get_metrics (size: number, ring_width: number) : void;
        is_adjusting () : boolean;
        set_color (_h: number, _s: number, _v: number) : void;
        set_metrics (size: number, ring_width: number) : void;
    }
    
    var HSV: {
        new () : Widget;
        to_rgb (_h: number, _s: number, _v: number, _r: number, _g: number, _b: number) : void;
    }
    
    
    
    
    interface HScale extends Scale, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var HScale: {
        new (adjustment: Adjustment) : Widget;
        new_with_range (min: number, max: number, step: number) : Widget;
        
    }
    
    
    
    
    interface HScrollbar extends Scrollbar, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var HScrollbar: {
        new (adjustment: Adjustment) : Widget;
        
    }
    
    
    
    
    interface HSeparator extends Separator, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var HSeparator: {
        new () : Widget;
        
    }
    
    
    
    
    interface HandleBox extends Bin, Atk.ImplementorIface, Buildable {
        get_child_detached () : boolean;
        get_handle_position () : PositionType;
        get_shadow_type () : ShadowType;
        get_snap_edge () : PositionType;
        set_handle_position (position: PositionType) : void;
        set_shadow_type (_type: ShadowType) : void;
        set_snap_edge (edge: PositionType) : void;
    }
    
    var HandleBox: {
        new () : Widget;
        
    }
    
    
    
    
    interface HeaderBar extends Container, Atk.ImplementorIface, Buildable {
        get_custom_title () : Widget;
        get_decoration_layout () : string;
        get_has_subtitle () : boolean;
        get_show_close_button () : boolean;
        get_subtitle () : string;
        get_title () : string;
        pack_end (child: Widget) : void;
        pack_start (child: Widget) : void;
        set_custom_title (title_widget: Widget) : void;
        set_decoration_layout (layout: string) : void;
        set_has_subtitle (setting: boolean) : void;
        set_show_close_button (setting: boolean) : void;
        set_subtitle (subtitle: string) : void;
        set_title (title: string) : void;
    }
    
    var HeaderBar: {
        new () : Widget;
        
    }
    
    
    
    
    interface IMContext extends GObject.Object {
        delete_surrounding (offset: number, n_chars: number) : boolean;
        filter_keypress (event: Gdk.EventKey) : boolean;
        focus_in () : void;
        focus_out () : void;
        get_preedit_string (_str: string, attrs: Pango.AttrList, cursor_pos: number) : void;
        get_surrounding (text: string, cursor_index: number) : boolean;
        reset () : void;
        set_client_window (window: Gdk.Window) : void;
        set_cursor_location (area: Gdk.Rectangle) : void;
        set_surrounding (text: string, len: number, cursor_index: number) : void;
        set_use_preedit (use_preedit: boolean) : void;
    }
    
    var IMContext: {
        
        
    }
    
    
    
    
    interface IMContextSimple extends IMContext {
        add_compose_file (compose_file: string) : void;
        add_table (data: number[], max_seq_len: number, n_seqs: number) : void;
    }
    
    var IMContextSimple: {
        new () : IMContext;
        
    }
    
    
    
    
    interface IMMulticontext extends IMContext {
        append_menuitems (menushell: MenuShell) : void;
        get_context_id () : string;
        set_context_id (context_id: string) : void;
    }
    
    var IMMulticontext: {
        new () : IMContext;
        
    }
    
    
    
    
    interface IconFactory extends GObject.Object, Buildable {
        add (stock_id: string, icon_set: IconSet) : void;
        add_default () : void;
        lookup (stock_id: string) : IconSet;
        remove_default () : void;
    }
    
    var IconFactory: {
        new () : IconFactory;
        lookup_default (stock_id: string) : IconSet;
    }
    
    
    
    
    interface IconInfo extends GObject.Object {
        copy () : IconInfo;
        free () : void;
        get_attach_points (points: Gdk.Point[], n_points: number) : boolean;
        get_base_scale () : number;
        get_base_size () : number;
        get_builtin_pixbuf () : GdkPixbuf.Pixbuf;
        get_display_name () : string;
        get_embedded_rect (rectangle: Gdk.Rectangle) : boolean;
        get_filename () : string;
        is_symbolic () : boolean;
        load_icon () : GdkPixbuf.Pixbuf;
        load_icon_async (cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any) : void;
        load_icon_finish (res: Gio.AsyncResult) : GdkPixbuf.Pixbuf;
        load_surface (for_window: Gdk.Window) : cairo.Surface;
        load_symbolic (fg: Gdk.RGBA, success_color: Gdk.RGBA, warning_color: Gdk.RGBA, error_color: Gdk.RGBA, was_symbolic: boolean) : GdkPixbuf.Pixbuf;
        load_symbolic_async (fg: Gdk.RGBA, success_color: Gdk.RGBA, warning_color: Gdk.RGBA, error_color: Gdk.RGBA, cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any) : void;
        load_symbolic_finish (res: Gio.AsyncResult, was_symbolic: boolean) : GdkPixbuf.Pixbuf;
        load_symbolic_for_context (context: StyleContext, was_symbolic: boolean) : GdkPixbuf.Pixbuf;
        load_symbolic_for_context_async (context: StyleContext, cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any) : void;
        load_symbolic_for_context_finish (res: Gio.AsyncResult, was_symbolic: boolean) : GdkPixbuf.Pixbuf;
        load_symbolic_for_style (style: Style, state: StateType, was_symbolic: boolean) : GdkPixbuf.Pixbuf;
        set_raw_coordinates (raw_coordinates: boolean) : void;
    }
    
    var IconInfo: {
        new_for_pixbuf (icon_theme: IconTheme, pixbuf: GdkPixbuf.Pixbuf) : IconInfo;
        
    }
    
    
    
    
    interface IconTheme extends GObject.Object {
        add_resource_path (path: string) : void;
        append_search_path (path: string) : void;
        choose_icon (icon_names: string[], size: number, flags: IconLookupFlags) : IconInfo;
        choose_icon_for_scale (icon_names: string[], size: number, scale: number, flags: IconLookupFlags) : IconInfo;
        get_example_icon_name () : string;
        get_icon_sizes (icon_name: string) : number[];
        get_search_path (path: string[], n_elements: number) : void;
        has_icon (icon_name: string) : boolean;
        list_contexts () : GLib.List;
        list_icons (context: string) : GLib.List;
        load_icon (icon_name: string, size: number, flags: IconLookupFlags) : GdkPixbuf.Pixbuf;
        load_icon_for_scale (icon_name: string, size: number, scale: number, flags: IconLookupFlags) : GdkPixbuf.Pixbuf;
        load_surface (icon_name: string, size: number, scale: number, for_window: Gdk.Window, flags: IconLookupFlags) : cairo.Surface;
        lookup_by_gicon (icon: Gio.Icon, size: number, flags: IconLookupFlags) : IconInfo;
        lookup_by_gicon_for_scale (icon: Gio.Icon, size: number, scale: number, flags: IconLookupFlags) : IconInfo;
        lookup_icon (icon_name: string, size: number, flags: IconLookupFlags) : IconInfo;
        lookup_icon_for_scale (icon_name: string, size: number, scale: number, flags: IconLookupFlags) : IconInfo;
        prepend_search_path (path: string) : void;
        rescan_if_needed () : boolean;
        set_custom_theme (theme_name: string) : void;
        set_screen (screen: Gdk.Screen) : void;
        set_search_path (path: string[], n_elements: number) : void;
    }
    
    var IconTheme: {
        new () : IconTheme;
        add_builtin_icon (icon_name: string, size: number, pixbuf: GdkPixbuf.Pixbuf) : void;
        get_default () : IconTheme;
        get_for_screen (screen: Gdk.Screen) : IconTheme;
    }
    
    
    
    
    interface IconView extends Container, Atk.ImplementorIface, Buildable, CellLayout, Scrollable {
        convert_widget_to_bin_window_coords (wx: number, wy: number, bx: number, _by: number) : void;
        create_drag_icon (path: TreePath) : cairo.Surface;
        enable_model_drag_dest (targets: TargetEntry[], n_targets: number, actions: Gdk.DragAction) : void;
        enable_model_drag_source (start_button_mask: Gdk.ModifierType, targets: TargetEntry[], n_targets: number, actions: Gdk.DragAction) : void;
        get_activate_on_single_click () : boolean;
        get_cell_rect (path: TreePath, cell: CellRenderer, rect: Gdk.Rectangle) : boolean;
        get_column_spacing () : number;
        get_columns () : number;
        get_cursor (path: TreePath, cell: CellRenderer) : boolean;
        get_dest_item_at_pos (drag_x: number, drag_y: number, path: TreePath, pos: IconViewDropPosition) : boolean;
        get_drag_dest_item (path: TreePath, pos: IconViewDropPosition) : void;
        get_item_at_pos (_x: number, _y: number, path: TreePath, cell: CellRenderer) : boolean;
        get_item_column (path: TreePath) : number;
        get_item_orientation () : Orientation;
        get_item_padding () : number;
        get_item_row (path: TreePath) : number;
        get_item_width () : number;
        get_margin () : number;
        get_markup_column () : number;
        get_model () : TreeModel;
        get_path_at_pos (_x: number, _y: number) : TreePath;
        get_pixbuf_column () : number;
        get_reorderable () : boolean;
        get_row_spacing () : number;
        get_selected_items () : GLib.List;
        get_selection_mode () : SelectionMode;
        get_spacing () : number;
        get_text_column () : number;
        get_tooltip_column () : number;
        get_tooltip_context (_x: number, _y: number, keyboard_tip: boolean, model: TreeModel, path: TreePath, iter: TreeIter) : boolean;
        get_visible_range (start_path: TreePath, end_path: TreePath) : boolean;
        item_activated (path: TreePath) : void;
        path_is_selected (path: TreePath) : boolean;
        scroll_to_path (path: TreePath, use_align: boolean, row_align: number, col_align: number) : void;
        select_all () : void;
        select_path (path: TreePath) : void;
        selected_foreach (_func: IconViewForeachFunc, data: any) : void;
        set_activate_on_single_click (single: boolean) : void;
        set_column_spacing (column_spacing: number) : void;
        set_columns (columns: number) : void;
        set_cursor (path: TreePath, cell: CellRenderer, start_editing: boolean) : void;
        set_drag_dest_item (path: TreePath, pos: IconViewDropPosition) : void;
        set_item_orientation (orientation: Orientation) : void;
        set_item_padding (item_padding: number) : void;
        set_item_width (item_width: number) : void;
        set_margin (margin: number) : void;
        set_markup_column (column: number) : void;
        set_model (model: TreeModel) : void;
        set_pixbuf_column (column: number) : void;
        set_reorderable (reorderable: boolean) : void;
        set_row_spacing (row_spacing: number) : void;
        set_selection_mode (mode: SelectionMode) : void;
        set_spacing (spacing: number) : void;
        set_text_column (column: number) : void;
        set_tooltip_cell (tooltip: Tooltip, path: TreePath, cell: CellRenderer) : void;
        set_tooltip_column (column: number) : void;
        set_tooltip_item (tooltip: Tooltip, path: TreePath) : void;
        unselect_all () : void;
        unselect_path (path: TreePath) : void;
        unset_model_drag_dest () : void;
        unset_model_drag_source () : void;
    }
    
    var IconView: {
        new () : Widget;
        new_with_area (area: CellArea) : Widget;
        new_with_model (model: TreeModel) : Widget;
        
    }
    
    
    
    
    interface IconViewAccessible extends ContainerAccessible, Atk.Component, Atk.Selection {
        
    }
    
    var IconViewAccessible: {
        
        
    }
    
    
    
    
    interface Image extends Misc, Atk.ImplementorIface, Buildable {
        clear () : void;
        get_animation () : GdkPixbuf.PixbufAnimation;
        get_gicon (gicon: Gio.Icon, size: number) : void;
        get_icon_name (icon_name: string, size: number) : void;
        get_icon_set (icon_set: IconSet, size: number) : void;
        get_pixbuf () : GdkPixbuf.Pixbuf;
        get_pixel_size () : number;
        get_stock (stock_id: string, size: number) : void;
        get_storage_type () : ImageType;
        set_from_animation (animation: GdkPixbuf.PixbufAnimation) : void;
        set_from_file (filename: string) : void;
        set_from_gicon (icon: Gio.Icon, size: number) : void;
        set_from_icon_name (icon_name: string, size: number) : void;
        set_from_icon_set (icon_set: IconSet, size: number) : void;
        set_from_pixbuf (pixbuf: GdkPixbuf.Pixbuf) : void;
        set_from_resource (resource_path: string) : void;
        set_from_stock (stock_id: string, size: number) : void;
        set_from_surface (surface: cairo.Surface) : void;
        set_pixel_size (pixel_size: number) : void;
    }
    
    var Image: {
        new () : Widget;
        new_from_animation (animation: GdkPixbuf.PixbufAnimation) : Widget;
        new_from_file (filename: string) : Widget;
        new_from_gicon (icon: Gio.Icon, size: number) : Widget;
        new_from_icon_name (icon_name: string, size: number) : Widget;
        new_from_icon_set (icon_set: IconSet, size: number) : Widget;
        new_from_pixbuf (pixbuf: GdkPixbuf.Pixbuf) : Widget;
        new_from_resource (resource_path: string) : Widget;
        new_from_stock (stock_id: string, size: number) : Widget;
        new_from_surface (surface: cairo.Surface) : Widget;
        
    }
    
    
    
    
    interface ImageAccessible extends WidgetAccessible, Atk.Component, Atk.Image {
        
    }
    
    var ImageAccessible: {
        
        
    }
    
    
    
    
    interface ImageCellAccessible extends RendererCellAccessible, Atk.Action, Atk.Component, Atk.Image, Atk.TableCell {
        
    }
    
    var ImageCellAccessible: {
        
        
    }
    
    
    
    
    interface ImageMenuItem extends MenuItem, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_always_show_image () : boolean;
        get_image () : Widget;
        get_use_stock () : boolean;
        set_accel_group (accel_group: AccelGroup) : void;
        set_always_show_image (always_show: boolean) : void;
        set_image (image: Widget) : void;
        set_use_stock (use_stock: boolean) : void;
    }
    
    var ImageMenuItem: {
        new () : Widget;
        new_from_stock (stock_id: string, accel_group: AccelGroup) : Widget;
        new_with_label (label: string) : Widget;
        new_with_mnemonic (label: string) : Widget;
        
    }
    
    
    
    
    interface InfoBar extends Box, Atk.ImplementorIface, Buildable, Orientable {
        add_action_widget (child: Widget, response_id: number) : void;
        add_button (button_text: string, response_id: number) : Button;
        add_buttons (first_button_text: string) : void;
        get_action_area () : Widget;
        get_content_area () : Widget;
        get_message_type () : MessageType;
        get_revealed () : boolean;
        get_show_close_button () : boolean;
        response (response_id: number) : void;
        set_default_response (response_id: number) : void;
        set_message_type (message_type: MessageType) : void;
        set_response_sensitive (response_id: number, setting: boolean) : void;
        set_revealed (revealed: boolean) : void;
        set_show_close_button (setting: boolean) : void;
    }
    
    var InfoBar: {
        new () : Widget;
        new_with_buttons (first_button_text: string) : Widget;
        
    }
    
    
    
    
    interface Invisible extends Widget, Atk.ImplementorIface, Buildable {
        get_screen () : Gdk.Screen;
        set_screen (screen: Gdk.Screen) : void;
    }
    
    var Invisible: {
        new () : Widget;
        new_for_screen (screen: Gdk.Screen) : Widget;
        
    }
    
    
    
    
    interface Label extends Misc, Atk.ImplementorIface, Buildable {
        get_angle () : number;
        get_attributes () : Pango.AttrList;
        get_current_uri () : string;
        get_ellipsize () : Pango.EllipsizeMode;
        get_justify () : Justification;
        get_label () : string;
        get_layout () : Pango.Layout;
        get_layout_offsets (_x: number, _y: number) : void;
        get_line_wrap () : boolean;
        get_line_wrap_mode () : Pango.WrapMode;
        get_lines () : number;
        get_max_width_chars () : number;
        get_mnemonic_keyval () : number;
        get_mnemonic_widget () : Widget;
        get_selectable () : boolean;
        get_selection_bounds (start: number, _end: number) : boolean;
        get_single_line_mode () : boolean;
        get_text () : string;
        get_track_visited_links () : boolean;
        get_use_markup () : boolean;
        get_use_underline () : boolean;
        get_width_chars () : number;
        get_xalign () : number;
        get_yalign () : number;
        select_region (start_offset: number, end_offset: number) : void;
        set_angle (angle: number) : void;
        set_attributes (attrs: Pango.AttrList) : void;
        set_ellipsize (mode: Pango.EllipsizeMode) : void;
        set_justify (jtype: Justification) : void;
        set_label (_str: string) : void;
        set_line_wrap (wrap: boolean) : void;
        set_line_wrap_mode (wrap_mode: Pango.WrapMode) : void;
        set_lines (lines: number) : void;
        set_markup (_str: string) : void;
        set_markup_with_mnemonic (_str: string) : void;
        set_max_width_chars (n_chars: number) : void;
        set_mnemonic_widget (widget: Widget) : void;
        set_pattern (pattern: string) : void;
        set_selectable (setting: boolean) : void;
        set_single_line_mode (single_line_mode: boolean) : void;
        set_text (_str: string) : void;
        set_text_with_mnemonic (_str: string) : void;
        set_track_visited_links (track_links: boolean) : void;
        set_use_markup (setting: boolean) : void;
        set_use_underline (setting: boolean) : void;
        set_width_chars (n_chars: number) : void;
        set_xalign (xalign: number) : void;
        set_yalign (yalign: number) : void;
    }
    
    var Label: {
        new (_str: string) : Widget;
        new_with_mnemonic (_str: string) : Widget;
        
    }
    
    
    
    
    interface LabelAccessible extends WidgetAccessible, Atk.Component, Atk.Hypertext, Atk.Text {
        
    }
    
    var LabelAccessible: {
        
        
    }
    
    
    
    
    interface Layout extends Container, Atk.ImplementorIface, Buildable, Scrollable {
        get_bin_window () : Gdk.Window;
        get_hadjustment () : Adjustment;
        get_size (width: number, height: number) : void;
        get_vadjustment () : Adjustment;
        move (child_widget: Widget, _x: number, _y: number) : void;
        put (child_widget: Widget, _x: number, _y: number) : void;
        set_hadjustment (adjustment: Adjustment) : void;
        set_size (width: number, height: number) : void;
        set_vadjustment (adjustment: Adjustment) : void;
    }
    
    var Layout: {
        new (hadjustment: Adjustment, vadjustment: Adjustment) : Widget;
        
    }
    
    
    
    
    interface LevelBar extends Widget, Atk.ImplementorIface, Buildable, Orientable {
        add_offset_value (name: string, value: number) : void;
        get_inverted () : boolean;
        get_max_value () : number;
        get_min_value () : number;
        get_mode () : LevelBarMode;
        get_offset_value (name: string, value: number) : boolean;
        get_value () : number;
        remove_offset_value (name: string) : void;
        set_inverted (inverted: boolean) : void;
        set_max_value (value: number) : void;
        set_min_value (value: number) : void;
        set_mode (mode: LevelBarMode) : void;
        set_value (value: number) : void;
    }
    
    var LevelBar: {
        new () : Widget;
        new_for_interval (min_value: number, max_value: number) : Widget;
        
    }
    
    
    
    
    interface LevelBarAccessible extends WidgetAccessible, Atk.Component, Atk.Value {
        
    }
    
    var LevelBarAccessible: {
        
        
    }
    
    
    
    
    interface LinkButton extends Button, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_uri () : string;
        get_visited () : boolean;
        set_uri (uri: string) : void;
        set_visited (visited: boolean) : void;
    }
    
    var LinkButton: {
        new (uri: string) : Widget;
        new_with_label (uri: string, label: string) : Widget;
        
    }
    
    
    
    
    interface LinkButtonAccessible extends ButtonAccessible, Atk.Action, Atk.Component, Atk.HyperlinkImpl, Atk.Image {
        
    }
    
    var LinkButtonAccessible: {
        
        
    }
    
    
    
    
    interface ListBox extends Container, Atk.ImplementorIface, Buildable {
        bind_model (model: Gio.ListModel, create_widget_func: ListBoxCreateWidgetFunc, user_data: any, user_data_free_func: GLib.DestroyNotify) : void;
        drag_highlight_row (_row: ListBoxRow) : void;
        drag_unhighlight_row () : void;
        get_activate_on_single_click () : boolean;
        get_adjustment () : Adjustment;
        get_row_at_index (index_: number) : ListBoxRow;
        get_row_at_y (_y: number) : ListBoxRow;
        get_selected_row () : ListBoxRow;
        get_selected_rows () : GLib.List;
        get_selection_mode () : SelectionMode;
        insert (child: Widget, position: number) : void;
        invalidate_filter () : void;
        invalidate_headers () : void;
        invalidate_sort () : void;
        prepend (child: Widget) : void;
        select_all () : void;
        select_row (_row: ListBoxRow) : void;
        selected_foreach (_func: ListBoxForeachFunc, data: any) : void;
        set_activate_on_single_click (single: boolean) : void;
        set_adjustment (adjustment: Adjustment) : void;
        set_filter_func (filter_func: ListBoxFilterFunc, user_data: any, destroy: GLib.DestroyNotify) : void;
        set_header_func (update_header: ListBoxUpdateHeaderFunc, user_data: any, destroy: GLib.DestroyNotify) : void;
        set_placeholder (placeholder: Widget) : void;
        set_selection_mode (mode: SelectionMode) : void;
        set_sort_func (sort_func: ListBoxSortFunc, user_data: any, destroy: GLib.DestroyNotify) : void;
        unselect_all () : void;
        unselect_row (_row: ListBoxRow) : void;
    }
    
    var ListBox: {
        new () : Widget;
        
    }
    
    
    
    
    interface ListBoxAccessible extends ContainerAccessible, Atk.Component, Atk.Selection {
        
    }
    
    var ListBoxAccessible: {
        
        
    }
    
    
    
    
    interface ListBoxRow extends Bin, Atk.ImplementorIface, Actionable, Buildable {
        changed () : void;
        get_activatable () : boolean;
        get_header () : Widget;
        get_index () : number;
        get_selectable () : boolean;
        is_selected () : boolean;
        set_activatable (activatable: boolean) : void;
        set_header (header: Widget) : void;
        set_selectable (selectable: boolean) : void;
    }
    
    var ListBoxRow: {
        new () : Widget;
        
    }
    
    
    
    
    interface ListBoxRowAccessible extends ContainerAccessible, Atk.Component {
        
    }
    
    var ListBoxRowAccessible: {
        
        
    }
    
    
    
    
    interface ListStore extends GObject.Object, Buildable, TreeDragDest, TreeDragSource, TreeModel, TreeSortable {
        append (iter: TreeIter) : void;
        clear () : void;
        insert (iter: TreeIter, position: number) : void;
        insert_after (iter: TreeIter, sibling: TreeIter) : void;
        insert_before (iter: TreeIter, sibling: TreeIter) : void;
        insert_with_values (iter: TreeIter, position: number) : void;
        insert_with_valuesv (iter: TreeIter, position: number, columns: number[], values: GObject.Value[], n_values: number) : void;
        iter_is_valid (iter: TreeIter) : boolean;
        move_after (iter: TreeIter, position: TreeIter) : void;
        move_before (iter: TreeIter, position: TreeIter) : void;
        prepend (iter: TreeIter) : void;
        remove (iter: TreeIter) : boolean;
        reorder (new_order: number[]) : void;
        set (iter: TreeIter) : void;
        set_column_types (n_columns: number, types: GObject.Type[]) : void;
        set_valist (iter: TreeIter, var_args: any[]) : void;
        set_value (iter: TreeIter, column: number, value: GObject.Value) : void;
        set_valuesv (iter: TreeIter, columns: number[], values: GObject.Value[], n_values: number) : void;
        swap (_a: TreeIter, _b: TreeIter) : void;
    }
    
    var ListStore: {
        new (n_columns: number) : ListStore;
        newv (n_columns: number, types: GObject.Type[]) : ListStore;
        
    }
    
    
    
    
    interface LockButton extends Button, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_permission () : Gio.Permission;
        set_permission (permission: Gio.Permission) : void;
    }
    
    var LockButton: {
        new (permission: Gio.Permission) : Widget;
        
    }
    
    
    
    
    interface LockButtonAccessible extends ButtonAccessible, Atk.Action, Atk.Component, Atk.Image {
        
    }
    
    var LockButtonAccessible: {
        
        
    }
    
    
    
    
    interface Menu extends MenuShell, Atk.ImplementorIface, Buildable {
        attach (child: Widget, left_attach: number, right_attach: number, top_attach: number, bottom_attach: number) : void;
        attach_to_widget (attach_widget: Widget, detacher: MenuDetachFunc) : void;
        detach () : void;
        get_accel_group () : AccelGroup;
        get_accel_path () : string;
        get_active () : Widget;
        get_attach_widget () : Widget;
        get_monitor () : number;
        get_reserve_toggle_size () : boolean;
        get_tearoff_state () : boolean;
        get_title () : string;
        place_on_monitor (monitor: Gdk.Monitor) : void;
        popdown () : void;
        popup (parent_menu_shell: Widget, parent_menu_item: Widget, _func: MenuPositionFunc, data: any, button: number, activate_time: number) : void;
        popup_at_pointer (trigger_event: Gdk.Event) : void;
        popup_at_rect (rect_window: Gdk.Window, rect: Gdk.Rectangle, rect_anchor: Gdk.Gravity, menu_anchor: Gdk.Gravity, trigger_event: Gdk.Event) : void;
        popup_at_widget (widget: Widget, widget_anchor: Gdk.Gravity, menu_anchor: Gdk.Gravity, trigger_event: Gdk.Event) : void;
        popup_for_device (device: Gdk.Device, parent_menu_shell: Widget, parent_menu_item: Widget, _func: MenuPositionFunc, data: any, destroy: GLib.DestroyNotify, button: number, activate_time: number) : void;
        reorder_child (child: Widget, position: number) : void;
        reposition () : void;
        set_accel_group (accel_group: AccelGroup) : void;
        set_accel_path (accel_path: string) : void;
        set_active (index: number) : void;
        set_monitor (monitor_num: number) : void;
        set_reserve_toggle_size (reserve_toggle_size: boolean) : void;
        set_screen (screen: Gdk.Screen) : void;
        set_tearoff_state (torn_off: boolean) : void;
        set_title (title: string) : void;
    }
    
    var Menu: {
        new () : Widget;
        new_from_model (model: Gio.MenuModel) : Widget;
        get_for_attach_widget (widget: Widget) : GLib.List;
    }
    
    
    
    
    interface MenuAccessible extends MenuShellAccessible, Atk.Component, Atk.Selection {
        
    }
    
    var MenuAccessible: {
        
        
    }
    
    
    
    
    interface MenuBar extends MenuShell, Atk.ImplementorIface, Buildable {
        get_child_pack_direction () : PackDirection;
        get_pack_direction () : PackDirection;
        set_child_pack_direction (child_pack_dir: PackDirection) : void;
        set_pack_direction (pack_dir: PackDirection) : void;
    }
    
    var MenuBar: {
        new () : Widget;
        new_from_model (model: Gio.MenuModel) : Widget;
        
    }
    
    
    
    
    interface MenuButton extends ToggleButton, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_align_widget () : Widget;
        get_direction () : ArrowType;
        get_menu_model () : Gio.MenuModel;
        get_popover () : Popover;
        get_popup () : Menu;
        get_use_popover () : boolean;
        set_align_widget (align_widget: Widget) : void;
        set_direction (direction: ArrowType) : void;
        set_menu_model (menu_model: Gio.MenuModel) : void;
        set_popover (popover: Widget) : void;
        set_popup (menu: Widget) : void;
        set_use_popover (use_popover: boolean) : void;
    }
    
    var MenuButton: {
        new () : Widget;
        
    }
    
    
    
    
    interface MenuButtonAccessible extends ToggleButtonAccessible, Atk.Action, Atk.Component, Atk.Image {
        
    }
    
    var MenuButtonAccessible: {
        
        
    }
    
    
    
    
    interface MenuItem extends Bin, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        activate () : void;
        deselect () : void;
        get_accel_path () : string;
        get_label () : string;
        get_reserve_indicator () : boolean;
        get_right_justified () : boolean;
        get_submenu () : Widget;
        get_use_underline () : boolean;
        select () : void;
        set_accel_path (accel_path: string) : void;
        set_label (label: string) : void;
        set_reserve_indicator (reserve: boolean) : void;
        set_right_justified (right_justified: boolean) : void;
        set_submenu (submenu: Menu) : void;
        set_use_underline (setting: boolean) : void;
        toggle_size_allocate (allocation: number) : void;
        toggle_size_request (requisition: number) : void;
    }
    
    var MenuItem: {
        new () : Widget;
        new_with_label (label: string) : Widget;
        new_with_mnemonic (label: string) : Widget;
        
    }
    
    
    
    
    interface MenuItemAccessible extends ContainerAccessible, Atk.Action, Atk.Component, Atk.Selection {
        
    }
    
    var MenuItemAccessible: {
        
        
    }
    
    
    
    
    interface MenuShell extends Container, Atk.ImplementorIface, Buildable {
        activate_item (menu_item: Widget, force_deactivate: boolean) : void;
        append (child: MenuItem) : void;
        bind_model (model: Gio.MenuModel, action_namespace: string, with_separators: boolean) : void;
        cancel () : void;
        deactivate () : void;
        deselect () : void;
        get_parent_shell () : Widget;
        get_selected_item () : Widget;
        get_take_focus () : boolean;
        insert (child: Widget, position: number) : void;
        prepend (child: Widget) : void;
        select_first (search_sensitive: boolean) : void;
        select_item (menu_item: Widget) : void;
        set_take_focus (take_focus: boolean) : void;
    }
    
    var MenuShell: {
        
        
    }
    
    
    
    
    interface MenuShellAccessible extends ContainerAccessible, Atk.Component, Atk.Selection {
        
    }
    
    var MenuShellAccessible: {
        
        
    }
    
    
    
    
    interface MenuToolButton extends ToolButton, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_menu () : Widget;
        set_arrow_tooltip_markup (markup: string) : void;
        set_arrow_tooltip_text (text: string) : void;
        set_menu (menu: Widget) : void;
    }
    
    var MenuToolButton: {
        new (icon_widget: Widget, label: string) : ToolItem;
        new_from_stock (stock_id: string) : ToolItem;
        
    }
    
    
    
    
    interface MessageDialog extends Dialog, Atk.ImplementorIface, Buildable {
        format_secondary_markup (message_format: string) : void;
        format_secondary_text (message_format: string) : void;
        get_image () : Widget;
        get_message_area () : Widget;
        set_image (image: Widget) : void;
        set_markup (_str: string) : void;
    }
    
    var MessageDialog: {
        new (parent: Window, flags: DialogFlags, _type: MessageType, buttons: ButtonsType, message_format: string) : Widget;
        new_with_markup (parent: Window, flags: DialogFlags, _type: MessageType, buttons: ButtonsType, message_format: string) : Widget;
        
    }
    
    
    
    
    interface Misc extends Widget, Atk.ImplementorIface, Buildable {
        get_alignment (xalign: number, yalign: number) : void;
        get_padding (xpad: number, ypad: number) : void;
        set_alignment (xalign: number, yalign: number) : void;
        set_padding (xpad: number, ypad: number) : void;
    }
    
    var Misc: {
        
        
    }
    
    
    
    
    interface ModelButton extends Button, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        
    }
    
    var ModelButton: {
        new () : Widget;
        
    }
    
    
    
    
    interface MountOperation extends Gio.MountOperation {
        get_parent () : Window;
        get_screen () : Gdk.Screen;
        is_showing () : boolean;
        set_parent (parent: Window) : void;
        set_screen (screen: Gdk.Screen) : void;
    }
    
    var MountOperation: {
        new (parent: Window) : Gio.MountOperation;
        
    }
    
    
    
    
    interface NativeDialog extends GObject.Object {
        destroy () : void;
        get_modal () : boolean;
        get_title () : string;
        get_transient_for () : Window;
        get_visible () : boolean;
        hide () : void;
        run () : number;
        set_modal (modal: boolean) : void;
        set_title (title: string) : void;
        set_transient_for (parent: Window) : void;
        show () : void;
    }
    
    var NativeDialog: {
        
        
    }
    
    
    
    
    interface Notebook extends Container, Atk.ImplementorIface, Buildable {
        append_page (child: Widget, tab_label: Widget) : number;
        append_page_menu (child: Widget, tab_label: Widget, menu_label: Widget) : number;
        detach_tab (child: Widget) : void;
        get_action_widget (pack_type: PackType) : Widget;
        get_current_page () : number;
        get_group_name () : string;
        get_menu_label (child: Widget) : Widget;
        get_menu_label_text (child: Widget) : string;
        get_n_pages () : number;
        get_nth_page (page_num: number) : Widget;
        get_scrollable () : boolean;
        get_show_border () : boolean;
        get_show_tabs () : boolean;
        get_tab_detachable (child: Widget) : boolean;
        get_tab_hborder () : number;
        get_tab_label (child: Widget) : Widget;
        get_tab_label_text (child: Widget) : string;
        get_tab_pos () : PositionType;
        get_tab_reorderable (child: Widget) : boolean;
        get_tab_vborder () : number;
        insert_page (child: Widget, tab_label: Widget, position: number) : number;
        insert_page_menu (child: Widget, tab_label: Widget, menu_label: Widget, position: number) : number;
        next_page () : void;
        page_num (child: Widget) : number;
        popup_disable () : void;
        popup_enable () : void;
        prepend_page (child: Widget, tab_label: Widget) : number;
        prepend_page_menu (child: Widget, tab_label: Widget, menu_label: Widget) : number;
        prev_page () : void;
        remove_page (page_num: number) : void;
        reorder_child (child: Widget, position: number) : void;
        set_action_widget (widget: Widget, pack_type: PackType) : void;
        set_current_page (page_num: number) : void;
        set_group_name (group_name: string) : void;
        set_menu_label (child: Widget, menu_label: Widget) : void;
        set_menu_label_text (child: Widget, menu_text: string) : void;
        set_scrollable (scrollable: boolean) : void;
        set_show_border (show_border: boolean) : void;
        set_show_tabs (show_tabs: boolean) : void;
        set_tab_detachable (child: Widget, detachable: boolean) : void;
        set_tab_label (child: Widget, tab_label: Widget) : void;
        set_tab_label_text (child: Widget, tab_text: string) : void;
        set_tab_pos (pos: PositionType) : void;
        set_tab_reorderable (child: Widget, reorderable: boolean) : void;
    }
    
    var Notebook: {
        new () : Widget;
        
    }
    
    
    
    
    interface NotebookAccessible extends ContainerAccessible, Atk.Component, Atk.Selection {
        
    }
    
    var NotebookAccessible: {
        
        
    }
    
    
    
    
    interface NotebookPageAccessible extends Atk.Object, Atk.Component {
        invalidate () : void;
    }
    
    var NotebookPageAccessible: {
        new (notebook: NotebookAccessible, child: Widget) : Atk.Object;
        
    }
    
    
    
    
    interface NumerableIcon extends Gio.EmblemedIcon, Gio.Icon {
        get_background_gicon () : Gio.Icon;
        get_background_icon_name () : string;
        get_count () : number;
        get_label () : string;
        get_style_context () : StyleContext;
        set_background_gicon (icon: Gio.Icon) : void;
        set_background_icon_name (icon_name: string) : void;
        set_count (count: number) : void;
        set_label (label: string) : void;
        set_style_context (style: StyleContext) : void;
    }
    
    var NumerableIcon: {
        
        new (base_icon: Gio.Icon) : Gio.Icon;
        new_with_style_context (base_icon: Gio.Icon, context: StyleContext) : Gio.Icon;
    }
    
    
    
    
    interface OffscreenWindow extends Window, Atk.ImplementorIface, Buildable {
        get_pixbuf () : GdkPixbuf.Pixbuf;
        get_surface () : cairo.Surface;
    }
    
    var OffscreenWindow: {
        new () : Widget;
        
    }
    
    
    
    
    interface Overlay extends Bin, Atk.ImplementorIface, Buildable {
        add_overlay (widget: Widget) : void;
        get_overlay_pass_through (widget: Widget) : boolean;
        reorder_overlay (child: Widget, index_: number) : void;
        set_overlay_pass_through (widget: Widget, pass_through: boolean) : void;
    }
    
    var Overlay: {
        new () : Widget;
        
    }
    
    
    
    
    interface PadController extends EventController {
        set_action (_type: PadActionType, index: number, mode: number, label: string, action_name: string) : void;
        set_action_entries (entries: PadActionEntry[], n_entries: number) : void;
    }
    
    var PadController: {
        new (window: Window, group: Gio.ActionGroup, pad: Gdk.Device) : PadController;
        
    }
    
    
    
    
    interface PageSetup extends GObject.Object {
        copy () : PageSetup;
        get_bottom_margin (unit: Unit) : number;
        get_left_margin (unit: Unit) : number;
        get_orientation () : PageOrientation;
        get_page_height (unit: Unit) : number;
        get_page_width (unit: Unit) : number;
        get_paper_height (unit: Unit) : number;
        get_paper_size () : PaperSize;
        get_paper_width (unit: Unit) : number;
        get_right_margin (unit: Unit) : number;
        get_top_margin (unit: Unit) : number;
        load_file (file_name: string) : boolean;
        load_key_file (key_file: GLib.KeyFile, group_name: string) : boolean;
        set_bottom_margin (margin: number, unit: Unit) : void;
        set_left_margin (margin: number, unit: Unit) : void;
        set_orientation (orientation: PageOrientation) : void;
        set_paper_size (size: PaperSize) : void;
        set_paper_size_and_default_margins (size: PaperSize) : void;
        set_right_margin (margin: number, unit: Unit) : void;
        set_top_margin (margin: number, unit: Unit) : void;
        to_file (file_name: string) : boolean;
        to_gvariant () : GLib.Variant;
        to_key_file (key_file: GLib.KeyFile, group_name: string) : void;
    }
    
    var PageSetup: {
        new () : PageSetup;
        new_from_file (file_name: string) : PageSetup;
        new_from_gvariant (variant: GLib.Variant) : PageSetup;
        new_from_key_file (key_file: GLib.KeyFile, group_name: string) : PageSetup;
        
    }
    
    
    
    
    interface Paned extends Container, Atk.ImplementorIface, Buildable, Orientable {
        add1 (child: Widget) : void;
        add2 (child: Widget) : void;
        get_child1 () : Widget;
        get_child2 () : Widget;
        get_handle_window () : Gdk.Window;
        get_position () : number;
        get_wide_handle () : boolean;
        pack1 (child: Widget, resize: boolean, shrink: boolean) : void;
        pack2 (child: Widget, resize: boolean, shrink: boolean) : void;
        set_position (position: number) : void;
        set_wide_handle (wide: boolean) : void;
    }
    
    var Paned: {
        new (orientation: Orientation) : Widget;
        
    }
    
    
    
    
    interface PanedAccessible extends ContainerAccessible, Atk.Component, Atk.Value {
        
    }
    
    var PanedAccessible: {
        
        
    }
    
    
    
    
    interface PlacesSidebar extends ScrolledWindow, Atk.ImplementorIface, Buildable {
        add_shortcut (location: Gio.File) : void;
        get_local_only () : boolean;
        get_location () : Gio.File;
        get_nth_bookmark (_n: number) : Gio.File;
        get_open_flags () : PlacesOpenFlags;
        get_show_connect_to_server () : boolean;
        get_show_desktop () : boolean;
        get_show_enter_location () : boolean;
        get_show_other_locations () : boolean;
        get_show_recent () : boolean;
        get_show_starred_location () : boolean;
        get_show_trash () : boolean;
        list_shortcuts () : GLib.SList;
        remove_shortcut (location: Gio.File) : void;
        set_drop_targets_visible (visible: boolean, context: Gdk.DragContext) : void;
        set_local_only (local_only: boolean) : void;
        set_location (location: Gio.File) : void;
        set_open_flags (flags: PlacesOpenFlags) : void;
        set_show_connect_to_server (show_connect_to_server: boolean) : void;
        set_show_desktop (show_desktop: boolean) : void;
        set_show_enter_location (show_enter_location: boolean) : void;
        set_show_other_locations (show_other_locations: boolean) : void;
        set_show_recent (show_recent: boolean) : void;
        set_show_starred_location (show_starred_location: boolean) : void;
        set_show_trash (show_trash: boolean) : void;
    }
    
    var PlacesSidebar: {
        new () : Widget;
        
    }
    
    
    
    
    interface Plug extends Window, Atk.ImplementorIface, Buildable {
        construct (socket_id: xlib.Window) : void;
        construct_for_display (display: Gdk.Display, socket_id: xlib.Window) : void;
        get_embedded () : boolean;
        get_id () : xlib.Window;
        get_socket_window () : Gdk.Window;
    }
    
    var Plug: {
        new (socket_id: xlib.Window) : Widget;
        new_for_display (display: Gdk.Display, socket_id: xlib.Window) : Widget;
        
    }
    
    
    
    
    interface Popover extends Bin, Atk.ImplementorIface, Buildable {
        bind_model (model: Gio.MenuModel, action_namespace: string) : void;
        get_constrain_to () : PopoverConstraint;
        get_default_widget () : Widget;
        get_modal () : boolean;
        get_pointing_to (rect: Gdk.Rectangle) : boolean;
        get_position () : PositionType;
        get_relative_to () : Widget;
        get_transitions_enabled () : boolean;
        popdown () : void;
        popup () : void;
        set_constrain_to (constraint: PopoverConstraint) : void;
        set_default_widget (widget: Widget) : void;
        set_modal (modal: boolean) : void;
        set_pointing_to (rect: Gdk.Rectangle) : void;
        set_position (position: PositionType) : void;
        set_relative_to (relative_to: Widget) : void;
        set_transitions_enabled (transitions_enabled: boolean) : void;
    }
    
    var Popover: {
        new (relative_to: Widget) : Widget;
        new_from_model (relative_to: Widget, model: Gio.MenuModel) : Widget;
        
    }
    
    
    
    
    interface PopoverAccessible extends ContainerAccessible, Atk.Component {
        
    }
    
    var PopoverAccessible: {
        
        
    }
    
    
    
    
    interface PopoverMenu extends Popover, Atk.ImplementorIface, Buildable {
        open_submenu (name: string) : void;
    }
    
    var PopoverMenu: {
        new () : Widget;
        
    }
    
    
    
    
    interface PrintContext extends GObject.Object {
        create_pango_context () : Pango.Context;
        create_pango_layout () : Pango.Layout;
        get_cairo_context () : cairo.Context;
        get_dpi_x () : number;
        get_dpi_y () : number;
        get_hard_margins (top: number, bottom: number, left: number, right: number) : boolean;
        get_height () : number;
        get_page_setup () : PageSetup;
        get_pango_fontmap () : Pango.FontMap;
        get_width () : number;
        set_cairo_context (cr: cairo.Context, dpi_x: number, dpi_y: number) : void;
    }
    
    var PrintContext: {
        
        
    }
    
    
    
    
    interface PrintOperation extends GObject.Object, PrintOperationPreview {
        cancel () : void;
        draw_page_finish () : void;
        get_default_page_setup () : PageSetup;
        get_embed_page_setup () : boolean;
        get_error () : void;
        get_has_selection () : boolean;
        get_n_pages_to_print () : number;
        get_print_settings () : PrintSettings;
        get_status () : PrintStatus;
        get_status_string () : string;
        get_support_selection () : boolean;
        is_finished () : boolean;
        run (action: PrintOperationAction, parent: Window) : PrintOperationResult;
        set_allow_async (allow_async: boolean) : void;
        set_current_page (current_page: number) : void;
        set_custom_tab_label (label: string) : void;
        set_default_page_setup (default_page_setup: PageSetup) : void;
        set_defer_drawing () : void;
        set_embed_page_setup (embed: boolean) : void;
        set_export_filename (filename: string) : void;
        set_has_selection (has_selection: boolean) : void;
        set_job_name (job_name: string) : void;
        set_n_pages (n_pages: number) : void;
        set_print_settings (print_settings: PrintSettings) : void;
        set_show_progress (show_progress: boolean) : void;
        set_support_selection (support_selection: boolean) : void;
        set_track_print_status (track_status: boolean) : void;
        set_unit (unit: Unit) : void;
        set_use_full_page (full_page: boolean) : void;
    }
    
    var PrintOperation: {
        new () : PrintOperation;
        
    }
    
    
    
    
    interface PrintSettings extends GObject.Object {
        copy () : PrintSettings;
        foreach (_func: PrintSettingsFunc, user_data: any) : void;
        get (key: string) : string;
        get_bool (key: string) : boolean;
        get_collate () : boolean;
        get_default_source () : string;
        get_dither () : string;
        get_double (key: string) : number;
        get_double_with_default (key: string, _def: number) : number;
        get_duplex () : PrintDuplex;
        get_finishings () : string;
        get_int (key: string) : number;
        get_int_with_default (key: string, _def: number) : number;
        get_length (key: string, unit: Unit) : number;
        get_media_type () : string;
        get_n_copies () : number;
        get_number_up () : number;
        get_number_up_layout () : NumberUpLayout;
        get_orientation () : PageOrientation;
        get_output_bin () : string;
        get_page_ranges (num_ranges: number) : PageRange[];
        get_page_set () : PageSet;
        get_paper_height (unit: Unit) : number;
        get_paper_size () : PaperSize;
        get_paper_width (unit: Unit) : number;
        get_print_pages () : PrintPages;
        get_printer () : string;
        get_printer_lpi () : number;
        get_quality () : PrintQuality;
        get_resolution () : number;
        get_resolution_x () : number;
        get_resolution_y () : number;
        get_reverse () : boolean;
        get_scale () : number;
        get_use_color () : boolean;
        has_key (key: string) : boolean;
        load_file (file_name: string) : boolean;
        load_key_file (key_file: GLib.KeyFile, group_name: string) : boolean;
        set (key: string, value: string) : void;
        set_bool (key: string, value: boolean) : void;
        set_collate (collate: boolean) : void;
        set_default_source (default_source: string) : void;
        set_dither (dither: string) : void;
        set_double (key: string, value: number) : void;
        set_duplex (duplex: PrintDuplex) : void;
        set_finishings (finishings: string) : void;
        set_int (key: string, value: number) : void;
        set_length (key: string, value: number, unit: Unit) : void;
        set_media_type (media_type: string) : void;
        set_n_copies (num_copies: number) : void;
        set_number_up (number_up: number) : void;
        set_number_up_layout (number_up_layout: NumberUpLayout) : void;
        set_orientation (orientation: PageOrientation) : void;
        set_output_bin (output_bin: string) : void;
        set_page_ranges (page_ranges: PageRange[], num_ranges: number) : void;
        set_page_set (page_set: PageSet) : void;
        set_paper_height (height: number, unit: Unit) : void;
        set_paper_size (paper_size: PaperSize) : void;
        set_paper_width (width: number, unit: Unit) : void;
        set_print_pages (pages: PrintPages) : void;
        set_printer (printer: string) : void;
        set_printer_lpi (lpi: number) : void;
        set_quality (quality: PrintQuality) : void;
        set_resolution (resolution: number) : void;
        set_resolution_xy (resolution_x: number, resolution_y: number) : void;
        set_reverse (reverse: boolean) : void;
        set_scale (scale: number) : void;
        set_use_color (use_color: boolean) : void;
        to_file (file_name: string) : boolean;
        to_gvariant () : GLib.Variant;
        to_key_file (key_file: GLib.KeyFile, group_name: string) : void;
        unset (key: string) : void;
    }
    
    var PrintSettings: {
        new () : PrintSettings;
        new_from_file (file_name: string) : PrintSettings;
        new_from_gvariant (variant: GLib.Variant) : PrintSettings;
        new_from_key_file (key_file: GLib.KeyFile, group_name: string) : PrintSettings;
        
    }
    
    
    
    
    interface ProgressBar extends Widget, Atk.ImplementorIface, Buildable, Orientable {
        get_ellipsize () : Pango.EllipsizeMode;
        get_fraction () : number;
        get_inverted () : boolean;
        get_pulse_step () : number;
        get_show_text () : boolean;
        get_text () : string;
        pulse () : void;
        set_ellipsize (mode: Pango.EllipsizeMode) : void;
        set_fraction (fraction: number) : void;
        set_inverted (inverted: boolean) : void;
        set_pulse_step (fraction: number) : void;
        set_show_text (show_text: boolean) : void;
        set_text (text: string) : void;
    }
    
    var ProgressBar: {
        new () : Widget;
        
    }
    
    
    
    
    interface ProgressBarAccessible extends WidgetAccessible, Atk.Component, Atk.Value {
        
    }
    
    var ProgressBarAccessible: {
        
        
    }
    
    
    
    
    interface RadioAction extends ToggleAction, Buildable {
        get_current_value () : number;
        get_group () : GLib.SList;
        join_group (group_source: RadioAction) : void;
        set_current_value (current_value: number) : void;
        set_group (group: GLib.SList) : void;
    }
    
    var RadioAction: {
        new (name: string, label: string, tooltip: string, stock_id: string, value: number) : RadioAction;
        
    }
    
    
    
    
    interface RadioButton extends CheckButton, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_group () : GLib.SList;
        join_group (group_source: RadioButton) : void;
        set_group (group: GLib.SList) : void;
    }
    
    var RadioButton: {
        new (group: GLib.SList) : Widget;
        new_from_widget (radio_group_member: RadioButton) : Widget;
        new_with_label (group: GLib.SList, label: string) : Widget;
        new_with_label_from_widget (radio_group_member: RadioButton, label: string) : Widget;
        new_with_mnemonic (group: GLib.SList, label: string) : Widget;
        new_with_mnemonic_from_widget (radio_group_member: RadioButton, label: string) : Widget;
        
    }
    
    
    
    
    interface RadioButtonAccessible extends ToggleButtonAccessible, Atk.Action, Atk.Component, Atk.Image {
        
    }
    
    var RadioButtonAccessible: {
        
        
    }
    
    
    
    
    interface RadioMenuItem extends CheckMenuItem, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_group () : GLib.SList;
        join_group (group_source: RadioMenuItem) : void;
        set_group (group: GLib.SList) : void;
    }
    
    var RadioMenuItem: {
        new (group: GLib.SList) : Widget;
        new_from_widget (group: RadioMenuItem) : Widget;
        new_with_label (group: GLib.SList, label: string) : Widget;
        new_with_label_from_widget (group: RadioMenuItem, label: string) : Widget;
        new_with_mnemonic (group: GLib.SList, label: string) : Widget;
        new_with_mnemonic_from_widget (group: RadioMenuItem, label: string) : Widget;
        
    }
    
    
    
    
    interface RadioMenuItemAccessible extends CheckMenuItemAccessible, Atk.Action, Atk.Component, Atk.Selection {
        
    }
    
    var RadioMenuItemAccessible: {
        
        
    }
    
    
    
    
    interface RadioToolButton extends ToggleToolButton, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_group () : GLib.SList;
        set_group (group: GLib.SList) : void;
    }
    
    var RadioToolButton: {
        new (group: GLib.SList) : ToolItem;
        new_from_stock (group: GLib.SList, stock_id: string) : ToolItem;
        new_from_widget (group: RadioToolButton) : ToolItem;
        new_with_stock_from_widget (group: RadioToolButton, stock_id: string) : ToolItem;
        
    }
    
    
    
    
    interface Range extends Widget, Atk.ImplementorIface, Buildable, Orientable {
        get_adjustment () : Adjustment;
        get_fill_level () : number;
        get_flippable () : boolean;
        get_inverted () : boolean;
        get_lower_stepper_sensitivity () : SensitivityType;
        get_min_slider_size () : number;
        get_range_rect (range_rect: Gdk.Rectangle) : void;
        get_restrict_to_fill_level () : boolean;
        get_round_digits () : number;
        get_show_fill_level () : boolean;
        get_slider_range (slider_start: number, slider_end: number) : void;
        get_slider_size_fixed () : boolean;
        get_upper_stepper_sensitivity () : SensitivityType;
        get_value () : number;
        set_adjustment (adjustment: Adjustment) : void;
        set_fill_level (fill_level: number) : void;
        set_flippable (flippable: boolean) : void;
        set_increments (step: number, page: number) : void;
        set_inverted (setting: boolean) : void;
        set_lower_stepper_sensitivity (sensitivity: SensitivityType) : void;
        set_min_slider_size (min_size: number) : void;
        set_range (min: number, max: number) : void;
        set_restrict_to_fill_level (restrict_to_fill_level: boolean) : void;
        set_round_digits (round_digits: number) : void;
        set_show_fill_level (show_fill_level: boolean) : void;
        set_slider_size_fixed (size_fixed: boolean) : void;
        set_upper_stepper_sensitivity (sensitivity: SensitivityType) : void;
        set_value (value: number) : void;
    }
    
    var Range: {
        
        
    }
    
    
    
    
    interface RangeAccessible extends WidgetAccessible, Atk.Component, Atk.Value {
        
    }
    
    var RangeAccessible: {
        
        
    }
    
    
    
    
    interface RcStyle extends GObject.Object {
        copy () : RcStyle;
    }
    
    var RcStyle: {
        new () : RcStyle;
        
    }
    
    
    
    
    interface RecentAction extends Action, Buildable, RecentChooser {
        get_show_numbers () : boolean;
        set_show_numbers (show_numbers: boolean) : void;
    }
    
    var RecentAction: {
        new (name: string, label: string, tooltip: string, stock_id: string) : Action;
        new_for_manager (name: string, label: string, tooltip: string, stock_id: string, manager: RecentManager) : Action;
        
    }
    
    
    
    
    interface RecentChooserDialog extends Dialog, Atk.ImplementorIface, Buildable, RecentChooser {
        
    }
    
    var RecentChooserDialog: {
        new (title: string, parent: Window, first_button_text: string) : Widget;
        new_for_manager (title: string, parent: Window, manager: RecentManager, first_button_text: string) : Widget;
        
    }
    
    
    
    
    interface RecentChooserMenu extends Menu, Atk.ImplementorIface, Activatable, Buildable, RecentChooser {
        get_show_numbers () : boolean;
        set_show_numbers (show_numbers: boolean) : void;
    }
    
    var RecentChooserMenu: {
        new () : Widget;
        new_for_manager (manager: RecentManager) : Widget;
        
    }
    
    
    
    
    interface RecentChooserWidget extends Box, Atk.ImplementorIface, Buildable, Orientable, RecentChooser {
        
    }
    
    var RecentChooserWidget: {
        new () : Widget;
        new_for_manager (manager: RecentManager) : Widget;
        
    }
    
    
    
    
    interface RecentFilter extends GObject.InitiallyUnowned, Buildable {
        add_age (days: number) : void;
        add_application (application: string) : void;
        add_custom (needed: RecentFilterFlags, _func: RecentFilterFunc, data: any, data_destroy: GLib.DestroyNotify) : void;
        add_group (group: string) : void;
        add_mime_type (mime_type: string) : void;
        add_pattern (pattern: string) : void;
        add_pixbuf_formats () : void;
        filter (filter_info: RecentFilterInfo) : boolean;
        get_name () : string;
        get_needed () : RecentFilterFlags;
        set_name (name: string) : void;
    }
    
    var RecentFilter: {
        new () : RecentFilter;
        
    }
    
    
    
    
    interface RecentManager extends GObject.Object {
        add_full (uri: string, recent_data: RecentData) : boolean;
        add_item (uri: string) : boolean;
        get_items () : GLib.List;
        has_item (uri: string) : boolean;
        lookup_item (uri: string) : RecentInfo;
        move_item (uri: string, new_uri: string) : boolean;
        purge_items () : number;
        remove_item (uri: string) : boolean;
    }
    
    var RecentManager: {
        new () : RecentManager;
        get_default () : RecentManager;
    }
    
    
    
    
    interface RendererCellAccessible extends CellAccessible, Atk.Action, Atk.Component, Atk.TableCell {
        
    }
    
    var RendererCellAccessible: {
        new (renderer: CellRenderer) : Atk.Object;
        
    }
    
    
    
    
    interface Revealer extends Bin, Atk.ImplementorIface, Buildable {
        get_child_revealed () : boolean;
        get_reveal_child () : boolean;
        get_transition_duration () : number;
        get_transition_type () : RevealerTransitionType;
        set_reveal_child (reveal_child: boolean) : void;
        set_transition_duration (duration: number) : void;
        set_transition_type (transition: RevealerTransitionType) : void;
    }
    
    var Revealer: {
        new () : Widget;
        
    }
    
    
    
    
    interface Scale extends Range, Atk.ImplementorIface, Buildable, Orientable {
        add_mark (value: number, position: PositionType, markup: string) : void;
        clear_marks () : void;
        get_digits () : number;
        get_draw_value () : boolean;
        get_has_origin () : boolean;
        get_layout () : Pango.Layout;
        get_layout_offsets (_x: number, _y: number) : void;
        get_value_pos () : PositionType;
        set_digits (digits: number) : void;
        set_draw_value (draw_value: boolean) : void;
        set_has_origin (has_origin: boolean) : void;
        set_value_pos (pos: PositionType) : void;
    }
    
    var Scale: {
        new (orientation: Orientation, adjustment: Adjustment) : Widget;
        new_with_range (orientation: Orientation, min: number, max: number, step: number) : Widget;
        
    }
    
    
    
    
    interface ScaleAccessible extends RangeAccessible, Atk.Component, Atk.Value {
        
    }
    
    var ScaleAccessible: {
        
        
    }
    
    
    
    
    interface ScaleButton extends Button, Atk.ImplementorIface, Actionable, Activatable, Buildable, Orientable {
        get_adjustment () : Adjustment;
        get_minus_button () : Button;
        get_plus_button () : Button;
        get_popup () : Widget;
        get_value () : number;
        set_adjustment (adjustment: Adjustment) : void;
        set_icons (icons: string[]) : void;
        set_value (value: number) : void;
    }
    
    var ScaleButton: {
        new (size: number, min: number, max: number, step: number, icons: string[]) : Widget;
        
    }
    
    
    
    
    interface ScaleButtonAccessible extends ButtonAccessible, Atk.Action, Atk.Component, Atk.Image, Atk.Value {
        
    }
    
    var ScaleButtonAccessible: {
        
        
    }
    
    
    
    
    interface Scrollbar extends Range, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var Scrollbar: {
        new (orientation: Orientation, adjustment: Adjustment) : Widget;
        
    }
    
    
    
    
    interface ScrolledWindow extends Bin, Atk.ImplementorIface, Buildable {
        add_with_viewport (child: Widget) : void;
        get_capture_button_press () : boolean;
        get_hadjustment () : Adjustment;
        get_hscrollbar () : Widget;
        get_kinetic_scrolling () : boolean;
        get_max_content_height () : number;
        get_max_content_width () : number;
        get_min_content_height () : number;
        get_min_content_width () : number;
        get_overlay_scrolling () : boolean;
        get_placement () : CornerType;
        get_policy (hscrollbar_policy: PolicyType, vscrollbar_policy: PolicyType) : void;
        get_propagate_natural_height () : boolean;
        get_propagate_natural_width () : boolean;
        get_shadow_type () : ShadowType;
        get_vadjustment () : Adjustment;
        get_vscrollbar () : Widget;
        set_capture_button_press (capture_button_press: boolean) : void;
        set_hadjustment (hadjustment: Adjustment) : void;
        set_kinetic_scrolling (kinetic_scrolling: boolean) : void;
        set_max_content_height (height: number) : void;
        set_max_content_width (width: number) : void;
        set_min_content_height (height: number) : void;
        set_min_content_width (width: number) : void;
        set_overlay_scrolling (overlay_scrolling: boolean) : void;
        set_placement (window_placement: CornerType) : void;
        set_policy (hscrollbar_policy: PolicyType, vscrollbar_policy: PolicyType) : void;
        set_propagate_natural_height (propagate: boolean) : void;
        set_propagate_natural_width (propagate: boolean) : void;
        set_shadow_type (_type: ShadowType) : void;
        set_vadjustment (vadjustment: Adjustment) : void;
        unset_placement () : void;
    }
    
    var ScrolledWindow: {
        new (hadjustment: Adjustment, vadjustment: Adjustment) : Widget;
        
    }
    
    
    
    
    interface ScrolledWindowAccessible extends ContainerAccessible, Atk.Component {
        
    }
    
    var ScrolledWindowAccessible: {
        
        
    }
    
    
    
    
    interface SearchBar extends Bin, Atk.ImplementorIface, Buildable {
        connect_entry (entry: Entry) : void;
        get_search_mode () : boolean;
        get_show_close_button () : boolean;
        handle_event (event: Gdk.Event) : boolean;
        set_search_mode (search_mode: boolean) : void;
        set_show_close_button (visible: boolean) : void;
    }
    
    var SearchBar: {
        new () : Widget;
        
    }
    
    
    
    
    interface SearchEntry extends Entry, Atk.ImplementorIface, Buildable, CellEditable, Editable {
        handle_event (event: Gdk.Event) : boolean;
    }
    
    var SearchEntry: {
        new () : Widget;
        
    }
    
    
    
    
    interface Separator extends Widget, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var Separator: {
        new (orientation: Orientation) : Widget;
        
    }
    
    
    
    
    interface SeparatorMenuItem extends MenuItem, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        
    }
    
    var SeparatorMenuItem: {
        new () : Widget;
        
    }
    
    
    
    
    interface SeparatorToolItem extends ToolItem, Atk.ImplementorIface, Activatable, Buildable {
        get_draw () : boolean;
        set_draw (draw: boolean) : void;
    }
    
    var SeparatorToolItem: {
        new () : ToolItem;
        
    }
    
    
    
    
    interface Settings extends GObject.Object, StyleProvider {
        reset_property (name: string) : void;
        set_double_property (name: string, v_double: number, origin: string) : void;
        set_long_property (name: string, v_long: number, origin: string) : void;
        set_property_value (name: string, svalue: SettingsValue) : void;
        set_string_property (name: string, v_string: string, origin: string) : void;
    }
    
    var Settings: {
        
        get_default () : Settings;
        get_for_screen (screen: Gdk.Screen) : Settings;
        install_property (pspec: GObject.ParamSpec) : void;
        install_property_parser (pspec: GObject.ParamSpec, parser: RcPropertyParser) : void;
    }
    
    
    
    
    interface ShortcutLabel extends Box, Atk.ImplementorIface, Buildable, Orientable {
        get_accelerator () : string;
        get_disabled_text () : string;
        set_accelerator (accelerator: string) : void;
        set_disabled_text (disabled_text: string) : void;
    }
    
    var ShortcutLabel: {
        new (accelerator: string) : Widget;
        
    }
    
    
    
    
    interface ShortcutsGroup extends Box, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var ShortcutsGroup: {
        
        
    }
    
    
    
    
    interface ShortcutsSection extends Box, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var ShortcutsSection: {
        
        
    }
    
    
    
    
    interface ShortcutsShortcut extends Box, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var ShortcutsShortcut: {
        
        
    }
    
    
    
    
    interface ShortcutsWindow extends Window, Atk.ImplementorIface, Buildable {
        
    }
    
    var ShortcutsWindow: {
        
        
    }
    
    
    
    
    interface SizeGroup extends GObject.Object, Buildable {
        add_widget (widget: Widget) : void;
        get_ignore_hidden () : boolean;
        get_mode () : SizeGroupMode;
        get_widgets () : GLib.SList;
        remove_widget (widget: Widget) : void;
        set_ignore_hidden (ignore_hidden: boolean) : void;
        set_mode (mode: SizeGroupMode) : void;
    }
    
    var SizeGroup: {
        new (mode: SizeGroupMode) : SizeGroup;
        
    }
    
    
    
    
    interface Socket extends Container, Atk.ImplementorIface, Buildable {
        add_id (window: xlib.Window) : void;
        get_id () : xlib.Window;
        get_plug_window () : Gdk.Window;
    }
    
    var Socket: {
        new () : Widget;
        
    }
    
    
    
    
    interface SpinButton extends Entry, Atk.ImplementorIface, Buildable, CellEditable, Editable, Orientable {
        configure (adjustment: Adjustment, climb_rate: number, digits: number) : void;
        get_adjustment () : Adjustment;
        get_digits () : number;
        get_increments (step: number, page: number) : void;
        get_numeric () : boolean;
        get_range (min: number, max: number) : void;
        get_snap_to_ticks () : boolean;
        get_update_policy () : SpinButtonUpdatePolicy;
        get_value () : number;
        get_value_as_int () : number;
        get_wrap () : boolean;
        set_adjustment (adjustment: Adjustment) : void;
        set_digits (digits: number) : void;
        set_increments (step: number, page: number) : void;
        set_numeric (numeric: boolean) : void;
        set_range (min: number, max: number) : void;
        set_snap_to_ticks (snap_to_ticks: boolean) : void;
        set_update_policy (policy: SpinButtonUpdatePolicy) : void;
        set_value (value: number) : void;
        set_wrap (wrap: boolean) : void;
        spin (direction: SpinType, increment: number) : void;
        update () : void;
    }
    
    var SpinButton: {
        new (adjustment: Adjustment, climb_rate: number, digits: number) : Widget;
        new_with_range (min: number, max: number, step: number) : Widget;
        
    }
    
    
    
    
    interface SpinButtonAccessible extends EntryAccessible, Atk.Action, Atk.Component, Atk.EditableText, Atk.Text, Atk.Value {
        
    }
    
    var SpinButtonAccessible: {
        
        
    }
    
    
    
    
    interface Spinner extends Widget, Atk.ImplementorIface, Buildable {
        start () : void;
        stop () : void;
    }
    
    var Spinner: {
        new () : Widget;
        
    }
    
    
    
    
    interface SpinnerAccessible extends WidgetAccessible, Atk.Component, Atk.Image {
        
    }
    
    var SpinnerAccessible: {
        
        
    }
    
    
    
    
    interface Stack extends Container, Atk.ImplementorIface, Buildable {
        add_named (child: Widget, name: string) : void;
        add_titled (child: Widget, name: string, title: string) : void;
        get_child_by_name (name: string) : Widget;
        get_hhomogeneous () : boolean;
        get_homogeneous () : boolean;
        get_interpolate_size () : boolean;
        get_transition_duration () : number;
        get_transition_running () : boolean;
        get_transition_type () : StackTransitionType;
        get_vhomogeneous () : boolean;
        get_visible_child () : Widget;
        get_visible_child_name () : string;
        set_hhomogeneous (hhomogeneous: boolean) : void;
        set_homogeneous (homogeneous: boolean) : void;
        set_interpolate_size (interpolate_size: boolean) : void;
        set_transition_duration (duration: number) : void;
        set_transition_type (transition: StackTransitionType) : void;
        set_vhomogeneous (vhomogeneous: boolean) : void;
        set_visible_child (child: Widget) : void;
        set_visible_child_full (name: string, transition: StackTransitionType) : void;
        set_visible_child_name (name: string) : void;
    }
    
    var Stack: {
        new () : Widget;
        
    }
    
    
    
    
    interface StackAccessible extends ContainerAccessible, Atk.Component {
        
    }
    
    var StackAccessible: {
        
        
    }
    
    
    
    
    interface StackSidebar extends Bin, Atk.ImplementorIface, Buildable {
        get_stack () : Stack;
        set_stack (stack: Stack) : void;
    }
    
    var StackSidebar: {
        new () : Widget;
        
    }
    
    
    
    
    interface StackSwitcher extends Box, Atk.ImplementorIface, Buildable, Orientable {
        get_stack () : Stack;
        set_stack (stack: Stack) : void;
    }
    
    var StackSwitcher: {
        new () : Widget;
        
    }
    
    
    
    
    interface StatusIcon extends GObject.Object {
        get_geometry (screen: Gdk.Screen, area: Gdk.Rectangle, orientation: Orientation) : boolean;
        get_gicon () : Gio.Icon;
        get_has_tooltip () : boolean;
        get_icon_name () : string;
        get_pixbuf () : GdkPixbuf.Pixbuf;
        get_screen () : Gdk.Screen;
        get_size () : number;
        get_stock () : string;
        get_storage_type () : ImageType;
        get_title () : string;
        get_tooltip_markup () : string;
        get_tooltip_text () : string;
        get_visible () : boolean;
        get_x11_window_id () : number;
        is_embedded () : boolean;
        set_from_file (filename: string) : void;
        set_from_gicon (icon: Gio.Icon) : void;
        set_from_icon_name (icon_name: string) : void;
        set_from_pixbuf (pixbuf: GdkPixbuf.Pixbuf) : void;
        set_from_stock (stock_id: string) : void;
        set_has_tooltip (has_tooltip: boolean) : void;
        set_name (name: string) : void;
        set_screen (screen: Gdk.Screen) : void;
        set_title (title: string) : void;
        set_tooltip_markup (markup: string) : void;
        set_tooltip_text (text: string) : void;
        set_visible (visible: boolean) : void;
    }
    
    var StatusIcon: {
        new () : StatusIcon;
        new_from_file (filename: string) : StatusIcon;
        new_from_gicon (icon: Gio.Icon) : StatusIcon;
        new_from_icon_name (icon_name: string) : StatusIcon;
        new_from_pixbuf (pixbuf: GdkPixbuf.Pixbuf) : StatusIcon;
        new_from_stock (stock_id: string) : StatusIcon;
        position_menu (menu: Menu, _x: number, _y: number, push_in: boolean, user_data: StatusIcon) : void;
    }
    
    
    
    
    interface Statusbar extends Box, Atk.ImplementorIface, Buildable, Orientable {
        get_context_id (context_description: string) : number;
        get_message_area () : Box;
        pop (context_id: number) : void;
        push (context_id: number, text: string) : number;
        remove (context_id: number, message_id: number) : void;
        remove_all (context_id: number) : void;
    }
    
    var Statusbar: {
        new () : Widget;
        
    }
    
    
    
    
    interface StatusbarAccessible extends ContainerAccessible, Atk.Component {
        
    }
    
    var StatusbarAccessible: {
        
        
    }
    
    
    
    
    interface Style extends GObject.Object {
        apply_default_background (cr: cairo.Context, window: Gdk.Window, state_type: StateType, _x: number, _y: number, width: number, height: number) : void;
        attach (window: Gdk.Window) : Style;
        copy () : Style;
        detach () : void;
        get (widget_type: GObject.Type, first_property_name: string) : void;
        get_style_property (widget_type: GObject.Type, property_name: string, value: GObject.Value) : void;
        get_valist (widget_type: GObject.Type, first_property_name: string, var_args: any[]) : void;
        has_context () : boolean;
        lookup_color (color_name: string, color: Gdk.Color) : boolean;
        lookup_icon_set (stock_id: string) : IconSet;
        render_icon (source: IconSource, direction: TextDirection, state: StateType, size: number, widget: Widget, detail: string) : GdkPixbuf.Pixbuf;
        set_background (window: Gdk.Window, state_type: StateType) : void;
    }
    
    var Style: {
        new () : Style;
        
    }
    
    
    
    
    interface StyleContext extends GObject.Object {
        add_class (class_name: string) : void;
        add_provider (provider: StyleProvider, priority: number) : void;
        add_region (region_name: string, flags: RegionFlags) : void;
        cancel_animations (region_id: any) : void;
        get (state: StateFlags) : void;
        get_background_color (state: StateFlags, color: Gdk.RGBA) : void;
        get_border (state: StateFlags, border: Border) : void;
        get_border_color (state: StateFlags, color: Gdk.RGBA) : void;
        get_color (state: StateFlags, color: Gdk.RGBA) : void;
        get_direction () : TextDirection;
        get_font (state: StateFlags) : Pango.FontDescription;
        get_frame_clock () : Gdk.FrameClock;
        get_junction_sides () : JunctionSides;
        get_margin (state: StateFlags, margin: Border) : void;
        get_padding (state: StateFlags, padding: Border) : void;
        get_parent () : StyleContext;
        get_path () : WidgetPath;
        get_property (property: string, state: StateFlags, value: GObject.Value) : void;
        get_scale () : number;
        get_screen () : Gdk.Screen;
        get_section (property: string) : CssSection;
        get_state () : StateFlags;
        get_style () : void;
        get_style_property (property_name: string, value: GObject.Value) : void;
        get_style_valist (args: any[]) : void;
        get_valist (state: StateFlags, args: any[]) : void;
        has_class (class_name: string) : boolean;
        has_region (region_name: string, flags_return: RegionFlags) : boolean;
        invalidate () : void;
        list_classes () : GLib.List;
        list_regions () : GLib.List;
        lookup_color (color_name: string, color: Gdk.RGBA) : boolean;
        lookup_icon_set (stock_id: string) : IconSet;
        notify_state_change (window: Gdk.Window, region_id: any, state: StateType, state_value: boolean) : void;
        pop_animatable_region () : void;
        push_animatable_region (region_id: any) : void;
        remove_class (class_name: string) : void;
        remove_provider (provider: StyleProvider) : void;
        remove_region (region_name: string) : void;
        restore () : void;
        save () : void;
        scroll_animations (window: Gdk.Window, dx: number, dy: number) : void;
        set_background (window: Gdk.Window) : void;
        set_direction (direction: TextDirection) : void;
        set_frame_clock (frame_clock: Gdk.FrameClock) : void;
        set_junction_sides (sides: JunctionSides) : void;
        set_parent (parent: StyleContext) : void;
        set_path (path: WidgetPath) : void;
        set_scale (scale: number) : void;
        set_screen (screen: Gdk.Screen) : void;
        set_state (flags: StateFlags) : void;
        state_is_running (state: StateType, progress: number) : boolean;
        to_string (flags: StyleContextPrintFlags) : string;
    }
    
    var StyleContext: {
        new () : StyleContext;
        add_provider_for_screen (screen: Gdk.Screen, provider: StyleProvider, priority: number) : void;
        remove_provider_for_screen (screen: Gdk.Screen, provider: StyleProvider) : void;
        reset_widgets (screen: Gdk.Screen) : void;
    }
    
    
    
    
    interface StyleProperties extends GObject.Object, StyleProvider {
        clear () : void;
        get (state: StateFlags) : void;
        get_property (property: string, state: StateFlags, value: GObject.Value) : boolean;
        get_valist (state: StateFlags, args: any[]) : void;
        lookup_color (name: string) : SymbolicColor;
        map_color (name: string, color: SymbolicColor) : void;
        merge (props_to_merge: StyleProperties, replace: boolean) : void;
        set (state: StateFlags) : void;
        set_property (property: string, state: StateFlags, value: GObject.Value) : void;
        set_valist (state: StateFlags, args: any[]) : void;
        unset_property (property: string, state: StateFlags) : void;
    }
    
    var StyleProperties: {
        new () : StyleProperties;
        lookup_property (property_name: string, parse_func: StylePropertyParser, pspec: GObject.ParamSpec) : boolean;
        register_property (parse_func: StylePropertyParser, pspec: GObject.ParamSpec) : void;
    }
    
    
    
    
    interface Switch extends Widget, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_active () : boolean;
        get_state () : boolean;
        set_active (is_active: boolean) : void;
        set_state (state: boolean) : void;
    }
    
    var Switch: {
        new () : Widget;
        
    }
    
    
    
    
    interface SwitchAccessible extends WidgetAccessible, Atk.Action, Atk.Component {
        
    }
    
    var SwitchAccessible: {
        
        
    }
    
    
    
    
    interface Table extends Container, Atk.ImplementorIface, Buildable {
        attach (child: Widget, left_attach: number, right_attach: number, top_attach: number, bottom_attach: number, xoptions: AttachOptions, yoptions: AttachOptions, xpadding: number, ypadding: number) : void;
        attach_defaults (widget: Widget, left_attach: number, right_attach: number, top_attach: number, bottom_attach: number) : void;
        get_col_spacing (column: number) : number;
        get_default_col_spacing () : number;
        get_default_row_spacing () : number;
        get_homogeneous () : boolean;
        get_row_spacing (_row: number) : number;
        get_size (_rows: number, columns: number) : void;
        resize (_rows: number, columns: number) : void;
        set_col_spacing (column: number, spacing: number) : void;
        set_col_spacings (spacing: number) : void;
        set_homogeneous (homogeneous: boolean) : void;
        set_row_spacing (_row: number, spacing: number) : void;
        set_row_spacings (spacing: number) : void;
    }
    
    var Table: {
        new (_rows: number, columns: number, homogeneous: boolean) : Widget;
        
    }
    
    
    
    
    interface TearoffMenuItem extends MenuItem, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        
    }
    
    var TearoffMenuItem: {
        new () : Widget;
        
    }
    
    
    
    
    interface TextBuffer extends GObject.Object {
        add_mark (mark: TextMark, where: TextIter) : void;
        add_selection_clipboard (clipboard: Clipboard) : void;
        apply_tag (tag: TextTag, start: TextIter, _end: TextIter) : void;
        apply_tag_by_name (name: string, start: TextIter, _end: TextIter) : void;
        backspace (iter: TextIter, interactive: boolean, default_editable: boolean) : boolean;
        begin_user_action () : void;
        copy_clipboard (clipboard: Clipboard) : void;
        create_child_anchor (iter: TextIter) : TextChildAnchor;
        create_mark (mark_name: string, where: TextIter, left_gravity: boolean) : TextMark;
        create_tag (tag_name: string, first_property_name: string) : TextTag;
        cut_clipboard (clipboard: Clipboard, default_editable: boolean) : void;
        delete (start: TextIter, _end: TextIter) : void;
        delete_interactive (start_iter: TextIter, end_iter: TextIter, default_editable: boolean) : boolean;
        delete_mark (mark: TextMark) : void;
        delete_mark_by_name (name: string) : void;
        delete_selection (interactive: boolean, default_editable: boolean) : boolean;
        deserialize (content_buffer: TextBuffer, format: Gdk.Atom, iter: TextIter, data: number[], length: number) : boolean;
        deserialize_get_can_create_tags (format: Gdk.Atom) : boolean;
        deserialize_set_can_create_tags (format: Gdk.Atom, can_create_tags: boolean) : void;
        end_user_action () : void;
        get_bounds (start: TextIter, _end: TextIter) : void;
        get_char_count () : number;
        get_copy_target_list () : TargetList;
        get_deserialize_formats (n_formats: number) : Gdk.Atom[];
        get_end_iter (iter: TextIter) : void;
        get_has_selection () : boolean;
        get_insert () : TextMark;
        get_iter_at_child_anchor (iter: TextIter, anchor: TextChildAnchor) : void;
        get_iter_at_line (iter: TextIter, line_number: number) : void;
        get_iter_at_line_index (iter: TextIter, line_number: number, byte_index: number) : void;
        get_iter_at_line_offset (iter: TextIter, line_number: number, char_offset: number) : void;
        get_iter_at_mark (iter: TextIter, mark: TextMark) : void;
        get_iter_at_offset (iter: TextIter, char_offset: number) : void;
        get_line_count () : number;
        get_mark (name: string) : TextMark;
        get_modified () : boolean;
        get_paste_target_list () : TargetList;
        get_selection_bound () : TextMark;
        get_selection_bounds (start: TextIter, _end: TextIter) : boolean;
        get_serialize_formats (n_formats: number) : Gdk.Atom[];
        get_slice (start: TextIter, _end: TextIter, include_hidden_chars: boolean) : string;
        get_start_iter (iter: TextIter) : void;
        get_tag_table () : TextTagTable;
        get_text (start: TextIter, _end: TextIter, include_hidden_chars: boolean) : string;
        insert (iter: TextIter, text: string, len: number) : void;
        insert_at_cursor (text: string, len: number) : void;
        insert_child_anchor (iter: TextIter, anchor: TextChildAnchor) : void;
        insert_interactive (iter: TextIter, text: string, len: number, default_editable: boolean) : boolean;
        insert_interactive_at_cursor (text: string, len: number, default_editable: boolean) : boolean;
        insert_markup (iter: TextIter, markup: string, len: number) : void;
        insert_pixbuf (iter: TextIter, pixbuf: GdkPixbuf.Pixbuf) : void;
        insert_range (iter: TextIter, start: TextIter, _end: TextIter) : void;
        insert_range_interactive (iter: TextIter, start: TextIter, _end: TextIter, default_editable: boolean) : boolean;
        insert_with_tags (iter: TextIter, text: string, len: number, first_tag: TextTag) : void;
        insert_with_tags_by_name (iter: TextIter, text: string, len: number, first_tag_name: string) : void;
        move_mark (mark: TextMark, where: TextIter) : void;
        move_mark_by_name (name: string, where: TextIter) : void;
        paste_clipboard (clipboard: Clipboard, override_location: TextIter, default_editable: boolean) : void;
        place_cursor (where: TextIter) : void;
        register_deserialize_format (mime_type: string, _function: TextBufferDeserializeFunc, user_data: any, user_data_destroy: GLib.DestroyNotify) : Gdk.Atom;
        register_deserialize_tagset (tagset_name: string) : Gdk.Atom;
        register_serialize_format (mime_type: string, _function: TextBufferSerializeFunc, user_data: any, user_data_destroy: GLib.DestroyNotify) : Gdk.Atom;
        register_serialize_tagset (tagset_name: string) : Gdk.Atom;
        remove_all_tags (start: TextIter, _end: TextIter) : void;
        remove_selection_clipboard (clipboard: Clipboard) : void;
        remove_tag (tag: TextTag, start: TextIter, _end: TextIter) : void;
        remove_tag_by_name (name: string, start: TextIter, _end: TextIter) : void;
        select_range (_ins: TextIter, bound: TextIter) : void;
        serialize (content_buffer: TextBuffer, format: Gdk.Atom, start: TextIter, _end: TextIter, length: number) : number[];
        set_modified (setting: boolean) : void;
        set_text (text: string, len: number) : void;
        unregister_deserialize_format (format: Gdk.Atom) : void;
        unregister_serialize_format (format: Gdk.Atom) : void;
    }
    
    var TextBuffer: {
        new (table: TextTagTable) : TextBuffer;
        
    }
    
    
    
    
    interface TextCellAccessible extends RendererCellAccessible, Atk.Action, Atk.Component, Atk.TableCell, Atk.Text {
        
    }
    
    var TextCellAccessible: {
        
        
    }
    
    
    
    
    interface TextChildAnchor extends GObject.Object {
        get_deleted () : boolean;
        get_widgets () : GLib.List;
    }
    
    var TextChildAnchor: {
        new () : TextChildAnchor;
        
    }
    
    
    
    
    interface TextMark extends GObject.Object {
        get_buffer () : TextBuffer;
        get_deleted () : boolean;
        get_left_gravity () : boolean;
        get_name () : string;
        get_visible () : boolean;
        set_visible (setting: boolean) : void;
    }
    
    var TextMark: {
        new (name: string, left_gravity: boolean) : TextMark;
        
    }
    
    
    
    
    interface TextTag extends GObject.Object {
        changed (size_changed: boolean) : void;
        event (event_object: GObject.Object, event: Gdk.Event, iter: TextIter) : boolean;
        get_priority () : number;
        set_priority (priority: number) : void;
    }
    
    var TextTag: {
        new (name: string) : TextTag;
        
    }
    
    
    
    
    interface TextTagTable extends GObject.Object, Buildable {
        add (tag: TextTag) : boolean;
        foreach (_func: TextTagTableForeach, data: any) : void;
        get_size () : number;
        lookup (name: string) : TextTag;
        remove (tag: TextTag) : void;
    }
    
    var TextTagTable: {
        new () : TextTagTable;
        
    }
    
    
    
    
    interface TextView extends Container, Atk.ImplementorIface, Buildable, Scrollable {
        add_child_at_anchor (child: Widget, anchor: TextChildAnchor) : void;
        add_child_in_window (child: Widget, which_window: TextWindowType, xpos: number, ypos: number) : void;
        backward_display_line (iter: TextIter) : boolean;
        backward_display_line_start (iter: TextIter) : boolean;
        buffer_to_window_coords (win: TextWindowType, buffer_x: number, buffer_y: number, window_x: number, window_y: number) : void;
        forward_display_line (iter: TextIter) : boolean;
        forward_display_line_end (iter: TextIter) : boolean;
        get_accepts_tab () : boolean;
        get_border_window_size (_type: TextWindowType) : number;
        get_bottom_margin () : number;
        get_buffer () : TextBuffer;
        get_cursor_locations (iter: TextIter, strong: Gdk.Rectangle, weak: Gdk.Rectangle) : void;
        get_cursor_visible () : boolean;
        get_default_attributes () : TextAttributes;
        get_editable () : boolean;
        get_hadjustment () : Adjustment;
        get_indent () : number;
        get_input_hints () : InputHints;
        get_input_purpose () : InputPurpose;
        get_iter_at_location (iter: TextIter, _x: number, _y: number) : boolean;
        get_iter_at_position (iter: TextIter, trailing: number, _x: number, _y: number) : boolean;
        get_iter_location (iter: TextIter, location: Gdk.Rectangle) : void;
        get_justification () : Justification;
        get_left_margin () : number;
        get_line_at_y (target_iter: TextIter, _y: number, line_top: number) : void;
        get_line_yrange (iter: TextIter, _y: number, height: number) : void;
        get_monospace () : boolean;
        get_overwrite () : boolean;
        get_pixels_above_lines () : number;
        get_pixels_below_lines () : number;
        get_pixels_inside_wrap () : number;
        get_right_margin () : number;
        get_tabs () : Pango.TabArray;
        get_top_margin () : number;
        get_vadjustment () : Adjustment;
        get_visible_rect (visible_rect: Gdk.Rectangle) : void;
        get_window (win: TextWindowType) : Gdk.Window;
        get_window_type (window: Gdk.Window) : TextWindowType;
        get_wrap_mode () : WrapMode;
        im_context_filter_keypress (event: Gdk.EventKey) : boolean;
        move_child (child: Widget, xpos: number, ypos: number) : void;
        move_mark_onscreen (mark: TextMark) : boolean;
        move_visually (iter: TextIter, count: number) : boolean;
        place_cursor_onscreen () : boolean;
        reset_cursor_blink () : void;
        reset_im_context () : void;
        scroll_mark_onscreen (mark: TextMark) : void;
        scroll_to_iter (iter: TextIter, within_margin: number, use_align: boolean, xalign: number, yalign: number) : boolean;
        scroll_to_mark (mark: TextMark, within_margin: number, use_align: boolean, xalign: number, yalign: number) : void;
        set_accepts_tab (accepts_tab: boolean) : void;
        set_border_window_size (_type: TextWindowType, size: number) : void;
        set_bottom_margin (bottom_margin: number) : void;
        set_buffer (buffer: TextBuffer) : void;
        set_cursor_visible (setting: boolean) : void;
        set_editable (setting: boolean) : void;
        set_indent (indent: number) : void;
        set_input_hints (hints: InputHints) : void;
        set_input_purpose (purpose: InputPurpose) : void;
        set_justification (justification: Justification) : void;
        set_left_margin (left_margin: number) : void;
        set_monospace (monospace: boolean) : void;
        set_overwrite (overwrite: boolean) : void;
        set_pixels_above_lines (pixels_above_lines: number) : void;
        set_pixels_below_lines (pixels_below_lines: number) : void;
        set_pixels_inside_wrap (pixels_inside_wrap: number) : void;
        set_right_margin (right_margin: number) : void;
        set_tabs (tabs: Pango.TabArray) : void;
        set_top_margin (top_margin: number) : void;
        set_wrap_mode (wrap_mode: WrapMode) : void;
        starts_display_line (iter: TextIter) : boolean;
        window_to_buffer_coords (win: TextWindowType, window_x: number, window_y: number, buffer_x: number, buffer_y: number) : void;
    }
    
    var TextView: {
        new () : Widget;
        new_with_buffer (buffer: TextBuffer) : Widget;
        
    }
    
    
    
    
    interface TextViewAccessible extends ContainerAccessible, Atk.Component, Atk.EditableText, Atk.StreamableContent, Atk.Text {
        
    }
    
    var TextViewAccessible: {
        
        
    }
    
    
    
    
    interface ThemingEngine extends GObject.Object {
        get (state: StateFlags) : void;
        get_background_color (state: StateFlags, color: Gdk.RGBA) : void;
        get_border (state: StateFlags, border: Border) : void;
        get_border_color (state: StateFlags, color: Gdk.RGBA) : void;
        get_color (state: StateFlags, color: Gdk.RGBA) : void;
        get_direction () : TextDirection;
        get_font (state: StateFlags) : Pango.FontDescription;
        get_junction_sides () : JunctionSides;
        get_margin (state: StateFlags, margin: Border) : void;
        get_padding (state: StateFlags, padding: Border) : void;
        get_path () : WidgetPath;
        get_property (property: string, state: StateFlags, value: GObject.Value) : void;
        get_screen () : Gdk.Screen;
        get_state () : StateFlags;
        get_style () : void;
        get_style_property (property_name: string, value: GObject.Value) : void;
        get_style_valist (args: any[]) : void;
        get_valist (state: StateFlags, args: any[]) : void;
        has_class (style_class: string) : boolean;
        has_region (style_region: string, flags: RegionFlags) : boolean;
        lookup_color (color_name: string, color: Gdk.RGBA) : boolean;
        state_is_running (state: StateType, progress: number) : boolean;
    }
    
    var ThemingEngine: {
        
        load (name: string) : ThemingEngine;
        register_property (name_space: string, parse_func: StylePropertyParser, pspec: GObject.ParamSpec) : void;
    }
    
    
    
    
    interface ToggleAction extends Action, Buildable {
        get_active () : boolean;
        get_draw_as_radio () : boolean;
        set_active (is_active: boolean) : void;
        set_draw_as_radio (draw_as_radio: boolean) : void;
        toggled () : void;
    }
    
    var ToggleAction: {
        new (name: string, label: string, tooltip: string, stock_id: string) : ToggleAction;
        
    }
    
    
    
    
    interface ToggleButton extends Button, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_active () : boolean;
        get_inconsistent () : boolean;
        get_mode () : boolean;
        set_active (is_active: boolean) : void;
        set_inconsistent (setting: boolean) : void;
        set_mode (draw_indicator: boolean) : void;
        toggled () : void;
    }
    
    var ToggleButton: {
        new () : Widget;
        new_with_label (label: string) : Widget;
        new_with_mnemonic (label: string) : Widget;
        
    }
    
    
    
    
    interface ToggleButtonAccessible extends ButtonAccessible, Atk.Action, Atk.Component, Atk.Image {
        
    }
    
    var ToggleButtonAccessible: {
        
        
    }
    
    
    
    
    interface ToggleToolButton extends ToolButton, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_active () : boolean;
        set_active (is_active: boolean) : void;
    }
    
    var ToggleToolButton: {
        new () : ToolItem;
        new_from_stock (stock_id: string) : ToolItem;
        
    }
    
    
    
    
    interface ToolButton extends ToolItem, Atk.ImplementorIface, Actionable, Activatable, Buildable {
        get_icon_name () : string;
        get_icon_widget () : Widget;
        get_label () : string;
        get_label_widget () : Widget;
        get_stock_id () : string;
        get_use_underline () : boolean;
        set_icon_name (icon_name: string) : void;
        set_icon_widget (icon_widget: Widget) : void;
        set_label (label: string) : void;
        set_label_widget (label_widget: Widget) : void;
        set_stock_id (stock_id: string) : void;
        set_use_underline (use_underline: boolean) : void;
    }
    
    var ToolButton: {
        new (icon_widget: Widget, label: string) : ToolItem;
        new_from_stock (stock_id: string) : ToolItem;
        
    }
    
    
    
    
    interface ToolItem extends Bin, Atk.ImplementorIface, Activatable, Buildable {
        get_ellipsize_mode () : Pango.EllipsizeMode;
        get_expand () : boolean;
        get_homogeneous () : boolean;
        get_icon_size () : number;
        get_is_important () : boolean;
        get_orientation () : Orientation;
        get_proxy_menu_item (menu_item_id: string) : Widget;
        get_relief_style () : ReliefStyle;
        get_text_alignment () : number;
        get_text_orientation () : Orientation;
        get_text_size_group () : SizeGroup;
        get_toolbar_style () : ToolbarStyle;
        get_use_drag_window () : boolean;
        get_visible_horizontal () : boolean;
        get_visible_vertical () : boolean;
        rebuild_menu () : void;
        retrieve_proxy_menu_item () : Widget;
        set_expand (expand: boolean) : void;
        set_homogeneous (homogeneous: boolean) : void;
        set_is_important (is_important: boolean) : void;
        set_proxy_menu_item (menu_item_id: string, menu_item: Widget) : void;
        set_tooltip_markup (markup: string) : void;
        set_tooltip_text (text: string) : void;
        set_use_drag_window (use_drag_window: boolean) : void;
        set_visible_horizontal (visible_horizontal: boolean) : void;
        set_visible_vertical (visible_vertical: boolean) : void;
        toolbar_reconfigured () : void;
    }
    
    var ToolItem: {
        new () : ToolItem;
        
    }
    
    
    
    
    interface ToolItemGroup extends Container, Atk.ImplementorIface, Buildable, ToolShell {
        get_collapsed () : boolean;
        get_drop_item (_x: number, _y: number) : ToolItem;
        get_ellipsize () : Pango.EllipsizeMode;
        get_header_relief () : ReliefStyle;
        get_item_position (item: ToolItem) : number;
        get_label () : string;
        get_label_widget () : Widget;
        get_n_items () : number;
        get_nth_item (index: number) : ToolItem;
        insert (item: ToolItem, position: number) : void;
        set_collapsed (collapsed: boolean) : void;
        set_ellipsize (ellipsize: Pango.EllipsizeMode) : void;
        set_header_relief (style: ReliefStyle) : void;
        set_item_position (item: ToolItem, position: number) : void;
        set_label (label: string) : void;
        set_label_widget (label_widget: Widget) : void;
    }
    
    var ToolItemGroup: {
        new (label: string) : Widget;
        
    }
    
    
    
    
    interface ToolPalette extends Container, Atk.ImplementorIface, Buildable, Orientable, Scrollable {
        add_drag_dest (widget: Widget, flags: DestDefaults, targets: ToolPaletteDragTargets, actions: Gdk.DragAction) : void;
        get_drag_item (selection: SelectionData) : Widget;
        get_drop_group (_x: number, _y: number) : ToolItemGroup;
        get_drop_item (_x: number, _y: number) : ToolItem;
        get_exclusive (group: ToolItemGroup) : boolean;
        get_expand (group: ToolItemGroup) : boolean;
        get_group_position (group: ToolItemGroup) : number;
        get_hadjustment () : Adjustment;
        get_icon_size () : number;
        get_style () : ToolbarStyle;
        get_vadjustment () : Adjustment;
        set_drag_source (targets: ToolPaletteDragTargets) : void;
        set_exclusive (group: ToolItemGroup, exclusive: boolean) : void;
        set_expand (group: ToolItemGroup, expand: boolean) : void;
        set_group_position (group: ToolItemGroup, position: number) : void;
        set_icon_size (icon_size: number) : void;
        set_style (style: ToolbarStyle) : void;
        unset_icon_size () : void;
        unset_style () : void;
    }
    
    var ToolPalette: {
        new () : Widget;
        get_drag_target_group () : TargetEntry;
        get_drag_target_item () : TargetEntry;
    }
    
    
    
    
    interface Toolbar extends Container, Atk.ImplementorIface, Buildable, Orientable, ToolShell {
        get_drop_index (_x: number, _y: number) : number;
        get_icon_size () : IconSize;
        get_item_index (item: ToolItem) : number;
        get_n_items () : number;
        get_nth_item (_n: number) : ToolItem;
        get_relief_style () : ReliefStyle;
        get_show_arrow () : boolean;
        get_style () : ToolbarStyle;
        insert (item: ToolItem, pos: number) : void;
        set_drop_highlight_item (tool_item: ToolItem, index_: number) : void;
        set_icon_size (icon_size: IconSize) : void;
        set_show_arrow (show_arrow: boolean) : void;
        set_style (style: ToolbarStyle) : void;
        unset_icon_size () : void;
        unset_style () : void;
    }
    
    var Toolbar: {
        new () : Widget;
        
    }
    
    
    
    
    interface Tooltip extends GObject.Object {
        set_custom (custom_widget: Widget) : void;
        set_icon (pixbuf: GdkPixbuf.Pixbuf) : void;
        set_icon_from_gicon (gicon: Gio.Icon, size: number) : void;
        set_icon_from_icon_name (icon_name: string, size: number) : void;
        set_icon_from_stock (stock_id: string, size: number) : void;
        set_markup (markup: string) : void;
        set_text (text: string) : void;
        set_tip_area (rect: Gdk.Rectangle) : void;
    }
    
    var Tooltip: {
        
        trigger_tooltip_query (display: Gdk.Display) : void;
    }
    
    
    
    
    interface ToplevelAccessible extends Atk.Object {
        get_children () : GLib.List;
    }
    
    var ToplevelAccessible: {
        
        
    }
    
    
    
    
    interface TreeModelFilter extends GObject.Object, TreeDragSource, TreeModel {
        clear_cache () : void;
        convert_child_iter_to_iter (filter_iter: TreeIter, child_iter: TreeIter) : boolean;
        convert_child_path_to_path (child_path: TreePath) : TreePath;
        convert_iter_to_child_iter (child_iter: TreeIter, filter_iter: TreeIter) : void;
        convert_path_to_child_path (filter_path: TreePath) : TreePath;
        get_model () : TreeModel;
        refilter () : void;
        set_modify_func (n_columns: number, types: GObject.Type[], _func: TreeModelFilterModifyFunc, data: any, destroy: GLib.DestroyNotify) : void;
        set_visible_column (column: number) : void;
        set_visible_func (_func: TreeModelFilterVisibleFunc, data: any, destroy: GLib.DestroyNotify) : void;
    }
    
    var TreeModelFilter: {
        
        
    }
    
    
    
    
    interface TreeModelSort extends GObject.Object, TreeDragSource, TreeModel, TreeSortable {
        clear_cache () : void;
        convert_child_iter_to_iter (sort_iter: TreeIter, child_iter: TreeIter) : boolean;
        convert_child_path_to_path (child_path: TreePath) : TreePath;
        convert_iter_to_child_iter (child_iter: TreeIter, sorted_iter: TreeIter) : void;
        convert_path_to_child_path (sorted_path: TreePath) : TreePath;
        get_model () : TreeModel;
        iter_is_valid (iter: TreeIter) : boolean;
        reset_default_sort_func () : void;
    }
    
    var TreeModelSort: {
        
        
    }
    
    
    
    
    interface TreeSelection extends GObject.Object {
        count_selected_rows () : number;
        get_mode () : SelectionMode;
        get_select_function () : TreeSelectionFunc;
        get_selected (model: TreeModel, iter: TreeIter) : boolean;
        get_selected_rows (model: TreeModel) : GLib.List;
        get_tree_view () : TreeView;
        get_user_data () : any;
        iter_is_selected (iter: TreeIter) : boolean;
        path_is_selected (path: TreePath) : boolean;
        select_all () : void;
        select_iter (iter: TreeIter) : void;
        select_path (path: TreePath) : void;
        select_range (start_path: TreePath, end_path: TreePath) : void;
        selected_foreach (_func: TreeSelectionForeachFunc, data: any) : void;
        set_mode (_type: SelectionMode) : void;
        set_select_function (_func: TreeSelectionFunc, data: any, destroy: GLib.DestroyNotify) : void;
        unselect_all () : void;
        unselect_iter (iter: TreeIter) : void;
        unselect_path (path: TreePath) : void;
        unselect_range (start_path: TreePath, end_path: TreePath) : void;
    }
    
    var TreeSelection: {
        
        
    }
    
    
    
    
    interface TreeStore extends GObject.Object, Buildable, TreeDragDest, TreeDragSource, TreeModel, TreeSortable {
        append (iter: TreeIter, parent: TreeIter) : void;
        clear () : void;
        insert (iter: TreeIter, parent: TreeIter, position: number) : void;
        insert_after (iter: TreeIter, parent: TreeIter, sibling: TreeIter) : void;
        insert_before (iter: TreeIter, parent: TreeIter, sibling: TreeIter) : void;
        insert_with_values (iter: TreeIter, parent: TreeIter, position: number) : void;
        insert_with_valuesv (iter: TreeIter, parent: TreeIter, position: number, columns: number[], values: GObject.Value[], n_values: number) : void;
        is_ancestor (iter: TreeIter, descendant: TreeIter) : boolean;
        iter_depth (iter: TreeIter) : number;
        iter_is_valid (iter: TreeIter) : boolean;
        move_after (iter: TreeIter, position: TreeIter) : void;
        move_before (iter: TreeIter, position: TreeIter) : void;
        prepend (iter: TreeIter, parent: TreeIter) : void;
        remove (iter: TreeIter) : boolean;
        reorder (parent: TreeIter, new_order: number[]) : void;
        set (iter: TreeIter) : void;
        set_column_types (n_columns: number, types: GObject.Type[]) : void;
        set_valist (iter: TreeIter, var_args: any[]) : void;
        set_value (iter: TreeIter, column: number, value: GObject.Value) : void;
        set_valuesv (iter: TreeIter, columns: number[], values: GObject.Value[], n_values: number) : void;
        swap (_a: TreeIter, _b: TreeIter) : void;
    }
    
    var TreeStore: {
        new (n_columns: number) : TreeStore;
        newv (n_columns: number, types: GObject.Type[]) : TreeStore;
        
    }
    
    
    
    
    interface TreeView extends Container, Atk.ImplementorIface, Buildable, Scrollable {
        append_column (column: TreeViewColumn) : number;
        collapse_all () : void;
        collapse_row (path: TreePath) : boolean;
        columns_autosize () : void;
        convert_bin_window_to_tree_coords (bx: number, _by: number, tx: number, _ty: number) : void;
        convert_bin_window_to_widget_coords (bx: number, _by: number, wx: number, wy: number) : void;
        convert_tree_to_bin_window_coords (tx: number, _ty: number, bx: number, _by: number) : void;
        convert_tree_to_widget_coords (tx: number, _ty: number, wx: number, wy: number) : void;
        convert_widget_to_bin_window_coords (wx: number, wy: number, bx: number, _by: number) : void;
        convert_widget_to_tree_coords (wx: number, wy: number, tx: number, _ty: number) : void;
        create_row_drag_icon (path: TreePath) : cairo.Surface;
        enable_model_drag_dest (targets: TargetEntry[], n_targets: number, actions: Gdk.DragAction) : void;
        enable_model_drag_source (start_button_mask: Gdk.ModifierType, targets: TargetEntry[], n_targets: number, actions: Gdk.DragAction) : void;
        expand_all () : void;
        expand_row (path: TreePath, open_all: boolean) : boolean;
        expand_to_path (path: TreePath) : void;
        get_activate_on_single_click () : boolean;
        get_background_area (path: TreePath, column: TreeViewColumn, rect: Gdk.Rectangle) : void;
        get_bin_window () : Gdk.Window;
        get_cell_area (path: TreePath, column: TreeViewColumn, rect: Gdk.Rectangle) : void;
        get_column (_n: number) : TreeViewColumn;
        get_columns () : GLib.List;
        get_cursor (path: TreePath, focus_column: TreeViewColumn) : void;
        get_dest_row_at_pos (drag_x: number, drag_y: number, path: TreePath, pos: TreeViewDropPosition) : boolean;
        get_drag_dest_row (path: TreePath, pos: TreeViewDropPosition) : void;
        get_enable_search () : boolean;
        get_enable_tree_lines () : boolean;
        get_expander_column () : TreeViewColumn;
        get_fixed_height_mode () : boolean;
        get_grid_lines () : TreeViewGridLines;
        get_hadjustment () : Adjustment;
        get_headers_clickable () : boolean;
        get_headers_visible () : boolean;
        get_hover_expand () : boolean;
        get_hover_selection () : boolean;
        get_level_indentation () : number;
        get_model () : TreeModel;
        get_n_columns () : number;
        get_path_at_pos (_x: number, _y: number, path: TreePath, column: TreeViewColumn, cell_x: number, cell_y: number) : boolean;
        get_reorderable () : boolean;
        get_row_separator_func () : TreeViewRowSeparatorFunc;
        get_rubber_banding () : boolean;
        get_rules_hint () : boolean;
        get_search_column () : number;
        get_search_entry () : Entry;
        get_search_equal_func () : TreeViewSearchEqualFunc;
        get_search_position_func () : TreeViewSearchPositionFunc;
        get_selection () : TreeSelection;
        get_show_expanders () : boolean;
        get_tooltip_column () : number;
        get_tooltip_context (_x: number, _y: number, keyboard_tip: boolean, model: TreeModel, path: TreePath, iter: TreeIter) : boolean;
        get_vadjustment () : Adjustment;
        get_visible_range (start_path: TreePath, end_path: TreePath) : boolean;
        get_visible_rect (visible_rect: Gdk.Rectangle) : void;
        insert_column (column: TreeViewColumn, position: number) : number;
        insert_column_with_attributes (position: number, title: string, cell: CellRenderer) : number;
        insert_column_with_data_func (position: number, title: string, cell: CellRenderer, _func: TreeCellDataFunc, data: any, dnotify: GLib.DestroyNotify) : number;
        is_blank_at_pos (_x: number, _y: number, path: TreePath, column: TreeViewColumn, cell_x: number, cell_y: number) : boolean;
        is_rubber_banding_active () : boolean;
        map_expanded_rows (_func: TreeViewMappingFunc, data: any) : void;
        move_column_after (column: TreeViewColumn, base_column: TreeViewColumn) : void;
        remove_column (column: TreeViewColumn) : number;
        row_activated (path: TreePath, column: TreeViewColumn) : void;
        row_expanded (path: TreePath) : boolean;
        scroll_to_cell (path: TreePath, column: TreeViewColumn, use_align: boolean, row_align: number, col_align: number) : void;
        scroll_to_point (tree_x: number, tree_y: number) : void;
        set_activate_on_single_click (single: boolean) : void;
        set_column_drag_function (_func: TreeViewColumnDropFunc, user_data: any, destroy: GLib.DestroyNotify) : void;
        set_cursor (path: TreePath, focus_column: TreeViewColumn, start_editing: boolean) : void;
        set_cursor_on_cell (path: TreePath, focus_column: TreeViewColumn, focus_cell: CellRenderer, start_editing: boolean) : void;
        set_destroy_count_func (_func: TreeDestroyCountFunc, data: any, destroy: GLib.DestroyNotify) : void;
        set_drag_dest_row (path: TreePath, pos: TreeViewDropPosition) : void;
        set_enable_search (enable_search: boolean) : void;
        set_enable_tree_lines (enabled: boolean) : void;
        set_expander_column (column: TreeViewColumn) : void;
        set_fixed_height_mode (enable: boolean) : void;
        set_grid_lines (grid_lines: TreeViewGridLines) : void;
        set_hadjustment (adjustment: Adjustment) : void;
        set_headers_clickable (setting: boolean) : void;
        set_headers_visible (headers_visible: boolean) : void;
        set_hover_expand (expand: boolean) : void;
        set_hover_selection (hover: boolean) : void;
        set_level_indentation (indentation: number) : void;
        set_model (model: TreeModel) : void;
        set_reorderable (reorderable: boolean) : void;
        set_row_separator_func (_func: TreeViewRowSeparatorFunc, data: any, destroy: GLib.DestroyNotify) : void;
        set_rubber_banding (enable: boolean) : void;
        set_rules_hint (setting: boolean) : void;
        set_search_column (column: number) : void;
        set_search_entry (entry: Entry) : void;
        set_search_equal_func (search_equal_func: TreeViewSearchEqualFunc, search_user_data: any, search_destroy: GLib.DestroyNotify) : void;
        set_search_position_func (_func: TreeViewSearchPositionFunc, data: any, destroy: GLib.DestroyNotify) : void;
        set_show_expanders (enabled: boolean) : void;
        set_tooltip_cell (tooltip: Tooltip, path: TreePath, column: TreeViewColumn, cell: CellRenderer) : void;
        set_tooltip_column (column: number) : void;
        set_tooltip_row (tooltip: Tooltip, path: TreePath) : void;
        set_vadjustment (adjustment: Adjustment) : void;
        unset_rows_drag_dest () : void;
        unset_rows_drag_source () : void;
    }
    
    var TreeView: {
        new () : Widget;
        new_with_model (model: TreeModel) : Widget;
        
    }
    
    
    
    
    interface TreeViewAccessible extends ContainerAccessible, Atk.Component, Atk.Selection, Atk.Table, CellAccessibleParent {
        
    }
    
    var TreeViewAccessible: {
        
        
    }
    
    
    
    
    interface TreeViewColumn extends GObject.InitiallyUnowned, Buildable, CellLayout {
        add_attribute (cell_renderer: CellRenderer, attribute: string, column: number) : void;
        cell_get_position (cell_renderer: CellRenderer, x_offset: number, width: number) : boolean;
        cell_get_size (cell_area: Gdk.Rectangle, x_offset: number, y_offset: number, width: number, height: number) : void;
        cell_is_visible () : boolean;
        cell_set_cell_data (tree_model: TreeModel, iter: TreeIter, is_expander: boolean, is_expanded: boolean) : void;
        clear () : void;
        clear_attributes (cell_renderer: CellRenderer) : void;
        clicked () : void;
        focus_cell (cell: CellRenderer) : void;
        get_alignment () : number;
        get_button () : Widget;
        get_clickable () : boolean;
        get_expand () : boolean;
        get_fixed_width () : number;
        get_max_width () : number;
        get_min_width () : number;
        get_reorderable () : boolean;
        get_resizable () : boolean;
        get_sizing () : TreeViewColumnSizing;
        get_sort_column_id () : number;
        get_sort_indicator () : boolean;
        get_sort_order () : SortType;
        get_spacing () : number;
        get_title () : string;
        get_tree_view () : Widget;
        get_visible () : boolean;
        get_widget () : Widget;
        get_width () : number;
        get_x_offset () : number;
        pack_end (cell: CellRenderer, expand: boolean) : void;
        pack_start (cell: CellRenderer, expand: boolean) : void;
        queue_resize () : void;
        set_alignment (xalign: number) : void;
        set_attributes (cell_renderer: CellRenderer) : void;
        set_cell_data_func (cell_renderer: CellRenderer, _func: TreeCellDataFunc, func_data: any, destroy: GLib.DestroyNotify) : void;
        set_clickable (clickable: boolean) : void;
        set_expand (expand: boolean) : void;
        set_fixed_width (fixed_width: number) : void;
        set_max_width (max_width: number) : void;
        set_min_width (min_width: number) : void;
        set_reorderable (reorderable: boolean) : void;
        set_resizable (resizable: boolean) : void;
        set_sizing (_type: TreeViewColumnSizing) : void;
        set_sort_column_id (sort_column_id: number) : void;
        set_sort_indicator (setting: boolean) : void;
        set_sort_order (order: SortType) : void;
        set_spacing (spacing: number) : void;
        set_title (title: string) : void;
        set_visible (visible: boolean) : void;
        set_widget (widget: Widget) : void;
    }
    
    var TreeViewColumn: {
        new () : TreeViewColumn;
        new_with_area (area: CellArea) : TreeViewColumn;
        new_with_attributes (title: string, cell: CellRenderer) : TreeViewColumn;
        
    }
    
    
    
    
    interface UIManager extends GObject.Object, Buildable {
        add_ui (merge_id: number, path: string, name: string, action: string, _type: UIManagerItemType, top: boolean) : void;
        add_ui_from_file (filename: string) : number;
        add_ui_from_resource (resource_path: string) : number;
        add_ui_from_string (buffer: string, length: number) : number;
        ensure_update () : void;
        get_accel_group () : AccelGroup;
        get_action (path: string) : Action;
        get_action_groups () : GLib.List;
        get_add_tearoffs () : boolean;
        get_toplevels (types: UIManagerItemType) : GLib.SList;
        get_ui () : string;
        get_widget (path: string) : Widget;
        insert_action_group (action_group: ActionGroup, pos: number) : void;
        new_merge_id () : number;
        remove_action_group (action_group: ActionGroup) : void;
        remove_ui (merge_id: number) : void;
        set_add_tearoffs (add_tearoffs: boolean) : void;
    }
    
    var UIManager: {
        new () : UIManager;
        
    }
    
    
    
    
    interface VBox extends Box, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var VBox: {
        new (homogeneous: boolean, spacing: number) : Widget;
        
    }
    
    
    
    
    interface VButtonBox extends ButtonBox, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var VButtonBox: {
        new () : Widget;
        
    }
    
    
    
    
    interface VPaned extends Paned, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var VPaned: {
        new () : Widget;
        
    }
    
    
    
    
    interface VScale extends Scale, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var VScale: {
        new (adjustment: Adjustment) : Widget;
        new_with_range (min: number, max: number, step: number) : Widget;
        
    }
    
    
    
    
    interface VScrollbar extends Scrollbar, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var VScrollbar: {
        new (adjustment: Adjustment) : Widget;
        
    }
    
    
    
    
    interface VSeparator extends Separator, Atk.ImplementorIface, Buildable, Orientable {
        
    }
    
    var VSeparator: {
        new () : Widget;
        
    }
    
    
    
    
    interface Viewport extends Bin, Atk.ImplementorIface, Buildable, Scrollable {
        get_bin_window () : Gdk.Window;
        get_hadjustment () : Adjustment;
        get_shadow_type () : ShadowType;
        get_vadjustment () : Adjustment;
        get_view_window () : Gdk.Window;
        set_hadjustment (adjustment: Adjustment) : void;
        set_shadow_type (_type: ShadowType) : void;
        set_vadjustment (adjustment: Adjustment) : void;
    }
    
    var Viewport: {
        new (hadjustment: Adjustment, vadjustment: Adjustment) : Widget;
        
    }
    
    
    
    
    interface VolumeButton extends ScaleButton, Atk.ImplementorIface, Actionable, Activatable, Buildable, Orientable {
        
    }
    
    var VolumeButton: {
        new () : Widget;
        
    }
    
    
    
    
    interface Widget extends GObject.InitiallyUnowned, Atk.ImplementorIface, Buildable {
        // activate () : boolean;
        add_accelerator (accel_signal: string, accel_group: AccelGroup, accel_key: number, accel_mods: Gdk.ModifierType, accel_flags: AccelFlags) : void;
        add_device_events (device: Gdk.Device, events: Gdk.EventMask) : void;
        add_events (events: number) : void;
        add_mnemonic_label (label: Widget) : void;
        add_tick_callback (callback: TickCallback, user_data: any, notify: GLib.DestroyNotify) : number;
        can_activate_accel (signal_id: number) : boolean;
        child_focus (direction: DirectionType) : boolean;
        // child_notify (child_property: string) : void;
        class_path (path_length: number, path: string, path_reversed: string) : void;
        compute_expand (orientation: Orientation) : boolean;
        create_pango_context () : Pango.Context;
        create_pango_layout (text: string) : Pango.Layout;
        destroy () : void;
        destroyed (widget_pointer: Widget) : void;
        device_is_shadowed (device: Gdk.Device) : boolean;
        drag_begin (targets: TargetList, actions: Gdk.DragAction, button: number, event: Gdk.Event) : Gdk.DragContext;
        drag_begin_with_coordinates (targets: TargetList, actions: Gdk.DragAction, button: number, event: Gdk.Event, _x: number, _y: number) : Gdk.DragContext;
        drag_check_threshold (start_x: number, start_y: number, current_x: number, current_y: number) : boolean;
        drag_dest_add_image_targets () : void;
        drag_dest_add_text_targets () : void;
        drag_dest_add_uri_targets () : void;
        drag_dest_find_target (context: Gdk.DragContext, target_list: TargetList) : Gdk.Atom;
        drag_dest_get_target_list () : TargetList;
        drag_dest_get_track_motion () : boolean;
        drag_dest_set (flags: DestDefaults, targets: TargetEntry[], n_targets: number, actions: Gdk.DragAction) : void;
        drag_dest_set_proxy (proxy_window: Gdk.Window, protocol: Gdk.DragProtocol, use_coordinates: boolean) : void;
        drag_dest_set_target_list (target_list: TargetList) : void;
        drag_dest_set_track_motion (track_motion: boolean) : void;
        drag_dest_unset () : void;
        drag_get_data (context: Gdk.DragContext, target: Gdk.Atom, time_: number) : void;
        drag_highlight () : void;
        drag_source_add_image_targets () : void;
        drag_source_add_text_targets () : void;
        drag_source_add_uri_targets () : void;
        drag_source_get_target_list () : TargetList;
        drag_source_set (start_button_mask: Gdk.ModifierType, targets: TargetEntry[], n_targets: number, actions: Gdk.DragAction) : void;
        drag_source_set_icon_gicon (icon: Gio.Icon) : void;
        drag_source_set_icon_name (icon_name: string) : void;
        drag_source_set_icon_pixbuf (pixbuf: GdkPixbuf.Pixbuf) : void;
        drag_source_set_icon_stock (stock_id: string) : void;
        drag_source_set_target_list (target_list: TargetList) : void;
        drag_source_unset () : void;
        drag_unhighlight () : void;
        draw (cr: cairo.Context) : void;
        ensure_style () : void;
        error_bell () : void;
        event (event: Gdk.Event) : boolean;
        freeze_child_notify () : void;
        get_accessible () : Atk.Object;
        get_action_group (prefix: string) : Gio.ActionGroup;
        get_allocated_baseline () : number;
        get_allocated_height () : number;
        get_allocated_size (allocation: Allocation, baseline: number) : void;
        get_allocated_width () : number;
        get_allocation (allocation: Allocation) : void;
        get_ancestor (widget_type: GObject.Type) : Widget;
        get_app_paintable () : boolean;
        get_can_default () : boolean;
        get_can_focus () : boolean;
        get_child_requisition (requisition: Requisition) : void;
        get_child_visible () : boolean;
        get_clip (clip: Allocation) : void;
        get_clipboard (selection: Gdk.Atom) : Clipboard;
        get_composite_name () : string;
        get_device_enabled (device: Gdk.Device) : boolean;
        get_device_events (device: Gdk.Device) : Gdk.EventMask;
        // get_direction () : TextDirection;
        get_display () : Gdk.Display;
        get_double_buffered () : boolean;
        get_events () : number;
        get_focus_on_click () : boolean;
        get_font_map () : Pango.FontMap;
        get_font_options () : cairo.FontOptions;
        get_frame_clock () : Gdk.FrameClock;
        get_halign () : Align;
        get_has_tooltip () : boolean;
        get_has_window () : boolean;
        get_hexpand () : boolean;
        get_hexpand_set () : boolean;
        get_mapped () : boolean;
        get_margin_bottom () : number;
        get_margin_end () : number;
        get_margin_left () : number;
        get_margin_right () : number;
        get_margin_start () : number;
        get_margin_top () : number;
        get_modifier_mask (intent: Gdk.ModifierIntent) : Gdk.ModifierType;
        get_modifier_style () : RcStyle;
        get_name () : string;
        get_no_show_all () : boolean;
        get_opacity () : number;
        get_pango_context () : Pango.Context;
        get_parent () : Widget;
        get_parent_window () : Gdk.Window;
        get_path () : WidgetPath;
        get_pointer (_x: number, _y: number) : void;
        get_preferred_height (minimum_height: number, natural_height: number) : void;
        get_preferred_height_and_baseline_for_width (width: number, minimum_height: number, natural_height: number, minimum_baseline: number, natural_baseline: number) : void;
        get_preferred_height_for_width (width: number, minimum_height: number, natural_height: number) : void;
        get_preferred_size (minimum_size: Requisition, natural_size: Requisition) : void;
        get_preferred_width (minimum_width: number, natural_width: number) : void;
        get_preferred_width_for_height (height: number, minimum_width: number, natural_width: number) : void;
        get_realized () : boolean;
        get_receives_default () : boolean;
        get_request_mode () : SizeRequestMode;
        get_requisition (requisition: Requisition) : void;
        get_root_window () : Gdk.Window;
        get_scale_factor () : number;
        get_screen () : Gdk.Screen;
        get_sensitive () : boolean;
        get_settings () : Settings;
        get_size_request (width: number, height: number) : void;
        // get_state () : StateType;
        get_state_flags () : StateFlags;
        // get_style () : Style;
        get_style_context () : StyleContext;
        get_support_multidevice () : boolean;
        get_template_child (widget_type: GObject.Type, name: string) : GObject.Object;
        get_tooltip_markup () : string;
        get_tooltip_text () : string;
        get_tooltip_window () : Window;
        get_toplevel () : Widget;
        get_valign () : Align;
        get_valign_with_baseline () : Align;
        get_vexpand () : boolean;
        get_vexpand_set () : boolean;
        get_visible () : boolean;
        get_visual () : Gdk.Visual;
        // get_window () : Gdk.Window;
        grab_add () : void;
        grab_default () : void;
        // grab_focus () : void;
        grab_remove () : void;
        has_default () : boolean;
        has_focus () : boolean;
        has_grab () : boolean;
        has_rc_style () : boolean;
        has_screen () : boolean;
        has_visible_focus () : boolean;
        hide () : void;
        hide_on_delete () : boolean;
        in_destruction () : boolean;
        init_template () : void;
        input_shape_combine_region (region: cairo.Region) : void;
        insert_action_group (name: string, group: Gio.ActionGroup) : void;
        intersect (area: Gdk.Rectangle, intersection: Gdk.Rectangle) : boolean;
        is_ancestor (ancestor: Widget) : boolean;
        is_composited () : boolean;
        is_drawable () : boolean;
        is_focus () : boolean;
        is_sensitive () : boolean;
        is_toplevel () : boolean;
        is_visible () : boolean;
        keynav_failed (direction: DirectionType) : boolean;
        list_accel_closures () : GLib.List;
        list_action_prefixes () : string[];
        list_mnemonic_labels () : GLib.List;
        map () : void;
        // mnemonic_activate (group_cycling: boolean) : boolean;
        modify_base (state: StateType, color: Gdk.Color) : void;
        modify_bg (state: StateType, color: Gdk.Color) : void;
        modify_cursor (primary: Gdk.Color, secondary: Gdk.Color) : void;
        modify_fg (state: StateType, color: Gdk.Color) : void;
        modify_font (font_desc: Pango.FontDescription) : void;
        modify_style (style: RcStyle) : void;
        modify_text (state: StateType, color: Gdk.Color) : void;
        override_background_color (state: StateFlags, color: Gdk.RGBA) : void;
        override_color (state: StateFlags, color: Gdk.RGBA) : void;
        override_cursor (cursor: Gdk.RGBA, secondary_cursor: Gdk.RGBA) : void;
        override_font (font_desc: Pango.FontDescription) : void;
        override_symbolic_color (name: string, color: Gdk.RGBA) : void;
        path (path_length: number, path: string, path_reversed: string) : void;
        queue_allocate () : void;
        queue_compute_expand () : void;
        queue_draw () : void;
        queue_draw_area (_x: number, _y: number, width: number, height: number) : void;
        queue_draw_region (region: cairo.Region) : void;
        queue_resize () : void;
        queue_resize_no_redraw () : void;
        realize () : void;
        region_intersect (region: cairo.Region) : cairo.Region;
        register_window (window: Gdk.Window) : void;
        remove_accelerator (accel_group: AccelGroup, accel_key: number, accel_mods: Gdk.ModifierType) : boolean;
        remove_mnemonic_label (label: Widget) : void;
        remove_tick_callback (_id: number) : void;
        render_icon (stock_id: string, size: number, detail: string) : GdkPixbuf.Pixbuf;
        render_icon_pixbuf (stock_id: string, size: number) : GdkPixbuf.Pixbuf;
        reparent (new_parent: Widget) : void;
        reset_rc_styles () : void;
        reset_style () : void;
        send_expose (event: Gdk.Event) : number;
        send_focus_change (event: Gdk.Event) : boolean;
        set_accel_path (accel_path: string, accel_group: AccelGroup) : void;
        set_allocation (allocation: Allocation) : void;
        set_app_paintable (app_paintable: boolean) : void;
        set_can_default (can_default: boolean) : void;
        set_can_focus (can_focus: boolean) : void;
        set_child_visible (is_visible: boolean) : void;
        set_clip (clip: Allocation) : void;
        set_composite_name (name: string) : void;
        set_device_enabled (device: Gdk.Device, enabled: boolean) : void;
        set_device_events (device: Gdk.Device, events: Gdk.EventMask) : void;
        // set_direction (dir: TextDirection) : void;
        set_double_buffered (double_buffered: boolean) : void;
        set_events (events: number) : void;
        set_focus_on_click (focus_on_click: boolean) : void;
        set_font_map (font_map: Pango.FontMap) : void;
        set_font_options (options: cairo.FontOptions) : void;
        set_halign (align: Align) : void;
        set_has_tooltip (has_tooltip: boolean) : void;
        set_has_window (has_window: boolean) : void;
        set_hexpand (expand: boolean) : void;
        set_hexpand_set (set: boolean) : void;
        set_mapped (mapped: boolean) : void;
        set_margin_bottom (margin: number) : void;
        set_margin_end (margin: number) : void;
        set_margin_left (margin: number) : void;
        set_margin_right (margin: number) : void;
        set_margin_start (margin: number) : void;
        set_margin_top (margin: number) : void;
        set_name (name: string) : void;
        set_no_show_all (no_show_all: boolean) : void;
        set_opacity (opacity: number) : void;
        set_parent (parent: Widget) : void;
        set_parent_window (parent_window: Gdk.Window) : void;
        set_realized (realized: boolean) : void;
        set_receives_default (receives_default: boolean) : void;
        set_redraw_on_allocate (redraw_on_allocate: boolean) : void;
        set_sensitive (sensitive: boolean) : void;
        set_size_request (width: number, height: number) : void;
        // set_state (state: StateType) : void;
        set_state_flags (flags: StateFlags, clear: boolean) : void;
        // set_style (style: Style) : void;
        set_support_multidevice (support_multidevice: boolean) : void;
        set_tooltip_markup (markup: string) : void;
        set_tooltip_text (text: string) : void;
        set_tooltip_window (custom_window: Window) : void;
        set_valign (align: Align) : void;
        set_vexpand (expand: boolean) : void;
        set_vexpand_set (set: boolean) : void;
        set_visible (visible: boolean) : void;
        set_visual (visual: Gdk.Visual) : void;
        set_window (window: Gdk.Window) : void;
        shape_combine_region (region: cairo.Region) : void;
        show () : void;
        show_all () : void;
        show_now () : void;
        size_allocate (allocation: Allocation) : void;
        size_allocate_with_baseline (allocation: Allocation, baseline: number) : void;
        size_request (requisition: Requisition) : void;
        style_attach () : void;
        style_get (first_property_name: string) : void;
        style_get_property (property_name: string, value: GObject.Value) : void;
        style_get_valist (first_property_name: string, var_args: any[]) : void;
        thaw_child_notify () : void;
        translate_coordinates (dest_widget: Widget, src_x: number, src_y: number, dest_x: number, dest_y: number) : boolean;
        trigger_tooltip_query () : void;
        unmap () : void;
        unparent () : void;
        unrealize () : void;
        unregister_window (window: Gdk.Window) : void;
        unset_state_flags (flags: StateFlags) : void;
    }
    
    var Widget: {
        new (_type: GObject.Type, first_property_name: string) : Widget;
        get_default_direction () : TextDirection;
        get_default_style () : Style;
        pop_composite_child () : void;
        push_composite_child () : void;
        set_default_direction (dir: TextDirection) : void;
    }
    
    
    
    
    interface WidgetAccessible extends Accessible, Atk.Component {
        
    }
    
    var WidgetAccessible: {
        
        
    }
    
    
    
    
    interface Window extends Bin, Atk.ImplementorIface, Buildable {
        activate_default () : boolean;
        activate_focus () : boolean;
        activate_key (event: Gdk.EventKey) : boolean;
        add_accel_group (accel_group: AccelGroup) : void;
        add_mnemonic (keyval: number, target: Widget) : void;
        begin_move_drag (button: number, root_x: number, root_y: number, timestamp: number) : void;
        begin_resize_drag (edge: Gdk.WindowEdge, button: number, root_x: number, root_y: number, timestamp: number) : void;
        close () : void;
        deiconify () : void;
        fullscreen () : void;
        fullscreen_on_monitor (screen: Gdk.Screen, monitor: number) : void;
        get_accept_focus () : boolean;
        get_application () : Application;
        get_attached_to () : Widget;
        get_decorated () : boolean;
        get_default_size (width: number, height: number) : void;
        get_default_widget () : Widget;
        get_deletable () : boolean;
        get_destroy_with_parent () : boolean;
        get_focus () : Widget;
        get_focus_on_map () : boolean;
        get_focus_visible () : boolean;
        get_gravity () : Gdk.Gravity;
        get_group () : WindowGroup;
        get_has_resize_grip () : boolean;
        get_hide_titlebar_when_maximized () : boolean;
        get_icon () : GdkPixbuf.Pixbuf;
        get_icon_list () : GLib.List;
        get_icon_name () : string;
        get_mnemonic_modifier () : Gdk.ModifierType;
        get_mnemonics_visible () : boolean;
        get_modal () : boolean;
        get_opacity () : number;
        get_position (root_x: number, root_y: number) : void;
        get_resizable () : boolean;
        get_resize_grip_area (rect: Gdk.Rectangle) : boolean;
        get_role () : string;
        get_screen () : Gdk.Screen;
        get_size (width: number, height: number) : void;
        get_skip_pager_hint () : boolean;
        get_skip_taskbar_hint () : boolean;
        get_title () : string;
        get_titlebar () : Widget;
        get_transient_for () : Window;
        get_type_hint () : Gdk.WindowTypeHint;
        get_urgency_hint () : boolean;
        get_window_type () : WindowType;
        has_group () : boolean;
        has_toplevel_focus () : boolean;
        iconify () : void;
        is_active () : boolean;
        is_maximized () : boolean;
        maximize () : void;
        mnemonic_activate (keyval: number, modifier: Gdk.ModifierType) : boolean;
        move (_x: number, _y: number) : void;
        parse_geometry (geometry: string) : boolean;
        present () : void;
        present_with_time (timestamp: number) : void;
        propagate_key_event (event: Gdk.EventKey) : boolean;
        remove_accel_group (accel_group: AccelGroup) : void;
        remove_mnemonic (keyval: number, target: Widget) : void;
        reshow_with_initial_size () : void;
        resize (width: number, height: number) : void;
        resize_grip_is_visible () : boolean;
        resize_to_geometry (width: number, height: number) : void;
        set_accept_focus (setting: boolean) : void;
        set_application (application: Application) : void;
        set_attached_to (attach_widget: Widget) : void;
        set_decorated (setting: boolean) : void;
        set_default (default_widget: Widget) : void;
        set_default_geometry (width: number, height: number) : void;
        set_default_size (width: number, height: number) : void;
        set_deletable (setting: boolean) : void;
        set_destroy_with_parent (setting: boolean) : void;
        set_focus (focus: Widget) : void;
        set_focus_on_map (setting: boolean) : void;
        set_focus_visible (setting: boolean) : void;
        set_geometry_hints (geometry_widget: Widget, geometry: Gdk.Geometry, geom_mask: Gdk.WindowHints) : void;
        set_gravity (gravity: Gdk.Gravity) : void;
        set_has_resize_grip (value: boolean) : void;
        set_has_user_ref_count (setting: boolean) : void;
        set_hide_titlebar_when_maximized (setting: boolean) : void;
        set_icon (icon: GdkPixbuf.Pixbuf) : void;
        set_icon_from_file (filename: string) : boolean;
        set_icon_list (list: GLib.List) : void;
        set_icon_name (name: string) : void;
        set_keep_above (setting: boolean) : void;
        set_keep_below (setting: boolean) : void;
        set_mnemonic_modifier (modifier: Gdk.ModifierType) : void;
        set_mnemonics_visible (setting: boolean) : void;
        set_modal (modal: boolean) : void;
        set_opacity (opacity: number) : void;
        set_position (position: WindowPosition) : void;
        set_resizable (resizable: boolean) : void;
        set_role (role: string) : void;
        set_screen (screen: Gdk.Screen) : void;
        set_skip_pager_hint (setting: boolean) : void;
        set_skip_taskbar_hint (setting: boolean) : void;
        set_startup_id (startup_id: string) : void;
        set_title (title: string) : void;
        set_titlebar (titlebar: Widget) : void;
        set_transient_for (parent: Window) : void;
        set_type_hint (hint: Gdk.WindowTypeHint) : void;
        set_urgency_hint (setting: boolean) : void;
        set_wmclass (wmclass_name: string, wmclass_class: string) : void;
        stick () : void;
        unfullscreen () : void;
        unmaximize () : void;
        unstick () : void;
    }
    
    var Window: {
        new (_type: WindowType) : Widget;
        get_default_icon_list () : GLib.List;
        get_default_icon_name () : string;
        list_toplevels () : GLib.List;
        set_auto_startup_notification (setting: boolean) : void;
        set_default_icon (icon: GdkPixbuf.Pixbuf) : void;
        set_default_icon_from_file (filename: string) : boolean;
        set_default_icon_list (list: GLib.List) : void;
        set_default_icon_name (name: string) : void;
        set_interactive_debugging (enable: boolean) : void;
    }
    
    
    
    
    interface WindowAccessible extends ContainerAccessible, Atk.Component, Atk.Window {
        
    }
    
    var WindowAccessible: {
        
        
    }
    
    
    
    
    interface WindowGroup extends GObject.Object {
        add_window (window: Window) : void;
        get_current_device_grab (device: Gdk.Device) : Widget;
        get_current_grab () : Widget;
        list_windows () : GLib.List;
        remove_window (window: Window) : void;
    }
    
    var WindowGroup: {
        new () : WindowGroup;
        
    }
    
    
    
    
    class AboutDialogClass {
        public parent_class: DialogClass;
    
        activate_link : {(dialog: AboutDialog, uri: string) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class AboutDialogPrivate {
    
    
    }
    
    
    
    class AccelGroupClass {
        public parent_class: GObject.ObjectClass;
    
        accel_changed : {(accel_group: AccelGroup, keyval: number, modifier: Gdk.ModifierType, accel_closure: GObject.Closure) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class AccelGroupEntry {
        public key: AccelKey;
        public closure: GObject.Closure;
        public accel_path_quark: GLib.Quark;
    
    
    }
    
    
    
    class AccelGroupPrivate {
    
    
    }
    
    
    
    class AccelKey {
        public accel_key: number;
        public accel_mods: Gdk.ModifierType;
        public accel_flags: number;
    
    
    }
    
    
    
    class AccelLabelClass {
        public parent_class: LabelClass;
        public signal_quote1: string;
        public signal_quote2: string;
        public mod_name_shift: string;
        public mod_name_control: string;
        public mod_name_alt: string;
        public mod_separator: string;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class AccelLabelPrivate {
    
    
    }
    
    
    
    class AccelMapClass {
    
    
    }
    
    
    
    class AccessibleClass {
        public parent_class: Atk.ObjectClass;
    
        connect_widget_destroyed : {(accessible: Accessible) : void;};
        widget_set : {(accessible: Accessible) : void;};
        widget_unset : {(accessible: Accessible) : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class AccessiblePrivate {
    
    
    }
    
    
    
    class ActionBarClass {
        public parent_class: BinClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ActionBarPrivate {
    
    
    }
    
    
    
    class ActionClass {
        public parent_class: GObject.ObjectClass;
        public menu_item_type: GObject.Type;
        public toolbar_item_type: GObject.Type;
    
        activate : {(action: Action) : void;};
        create_menu_item : {(action: Action) : Widget;};
        create_tool_item : {(action: Action) : Widget;};
        connect_proxy : {(action: Action, proxy: Widget) : void;};
        disconnect_proxy : {(action: Action, proxy: Widget) : void;};
        create_menu : {(action: Action) : Widget;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ActionEntry {
        public name: string;
        public stock_id: string;
        public label: string;
        public accelerator: string;
        public tooltip: string;
        public callback: GObject.Callback;
    
    
    }
    
    
    
    class ActionGroupClass {
        public parent_class: GObject.ObjectClass;
    
        get_action : {(action_group: ActionGroup, action_name: string) : Action;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ActionGroupPrivate {
    
    
    }
    
    
    
    class ActionPrivate {
    
    
    }
    
    
    
    class ActionableInterface {
        public g_iface: GObject.TypeInterface;
    
        get_action_name : {(actionable: Actionable) : string;};
        set_action_name : {(actionable: Actionable, action_name: string) : void;};
        get_action_target_value : {(actionable: Actionable) : GLib.Variant;};
        set_action_target_value : {(actionable: Actionable, target_value: GLib.Variant) : void;};
    
    }
    
    
    
    class ActivatableIface {
        public g_iface: GObject.TypeInterface;
    
        update : {(activatable: Activatable, action: Action, property_name: string) : void;};
        sync_action_properties : {(activatable: Activatable, action: Action) : void;};
    
    }
    
    
    
    class AdjustmentClass {
        public parent_class: GObject.InitiallyUnownedClass;
    
        changed : {(adjustment: Adjustment) : void;};
        value_changed : {(adjustment: Adjustment) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class AdjustmentPrivate {
    
    
    }
    
    
    
    class AlignmentClass {
        public parent_class: BinClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class AlignmentPrivate {
    
    
    }
    
    
    
    class AppChooserButtonClass {
        public parent_class: ComboBoxClass;
        public padding: any[];
    
        custom_item_activated : {(self: AppChooserButton, item_name: string) : void;};
    
    }
    
    
    
    class AppChooserButtonPrivate {
    
    
    }
    
    
    
    class AppChooserDialogClass {
        public parent_class: DialogClass;
        public padding: any[];
    
    
    }
    
    
    
    class AppChooserDialogPrivate {
    
    
    }
    
    
    
    class AppChooserWidgetClass {
        public parent_class: BoxClass;
        public padding: any[];
    
        application_selected : {(self: AppChooserWidget, app_info: Gio.AppInfo) : void;};
        application_activated : {(self: AppChooserWidget, app_info: Gio.AppInfo) : void;};
        populate_popup : {(self: AppChooserWidget, menu: Menu, app_info: Gio.AppInfo) : void;};
    
    }
    
    
    
    class AppChooserWidgetPrivate {
    
    
    }
    
    
    
    class ApplicationClass {
        public parent_class: Gio.ApplicationClass;
        public padding: any[];
    
        window_added : {(application: Application, window: Window) : void;};
        window_removed : {(application: Application, window: Window) : void;};
    
    }
    
    
    
    class ApplicationPrivate {
    
    
    }
    
    
    
    class ApplicationWindowClass {
        public parent_class: WindowClass;
        public padding: any[];
    
    
    }
    
    
    
    class ApplicationWindowPrivate {
    
    
    }
    
    
    
    class ArrowAccessibleClass {
        public parent_class: WidgetAccessibleClass;
    
    
    }
    
    
    
    class ArrowAccessiblePrivate {
    
    
    }
    
    
    
    class ArrowClass {
        public parent_class: MiscClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ArrowPrivate {
    
    
    }
    
    
    
    class AspectFrameClass {
        public parent_class: FrameClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class AspectFramePrivate {
    
    
    }
    
    
    
    class AssistantClass {
        public parent_class: WindowClass;
    
        prepare : {(assistant: Assistant, page: Widget) : void;};
        apply : {(assistant: Assistant) : void;};
        close : {(assistant: Assistant) : void;};
        cancel : {(assistant: Assistant) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
    
    }
    
    
    
    class AssistantPrivate {
    
    
    }
    
    
    
    class BinClass {
        public parent_class: ContainerClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class BinPrivate {
    
    
    }
    
    
    
    class BindingArg {
        public arg_type: GObject.Type;
    
    
    }
    
    
    
    class BindingEntry {
        public keyval: number;
        public modifiers: Gdk.ModifierType;
        public binding_set: BindingSet;
        public destroyed: number;
        public in_emission: number;
        public marks_unbound: number;
        public set_next: BindingEntry;
        public hash_next: BindingEntry;
        public signals: BindingSignal;
    
    
    }
    
    
    
    class BindingSet {
        public set_name: string;
        public priority: number;
        public widget_path_pspecs: GLib.SList;
        public widget_class_pspecs: GLib.SList;
        public class_branch_pspecs: GLib.SList;
        public entries: BindingEntry;
        public current: BindingEntry;
        public parsed: number;
    
    
        public activate (keyval: number, modifiers: Gdk.ModifierType, object: GObject.Object) : boolean;
        public add_path (path_type: PathType, path_pattern: string, priority: PathPriorityType) : void;
    }
    
    
    
    class BindingSignal {
        public next: BindingSignal;
        public signal_name: string;
        public n_args: number;
        public args: BindingArg[];
    
    
    }
    
    
    
    class BooleanCellAccessibleClass {
        public parent_class: RendererCellAccessibleClass;
    
    
    }
    
    
    
    class BooleanCellAccessiblePrivate {
    
    
    }
    
    
    
    class Border {
        public left: number;
        public right: number;
        public top: number;
        public bottom: number;
    
    
        public copy () : Border;
        public free () : void;
    }
    
    
    
    class BoxClass {
        public parent_class: ContainerClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class BoxPrivate {
    
    
    }
    
    
    
    class BuildableIface {
        public g_iface: GObject.TypeInterface;
    
        set_name : {(buildable: Buildable, name: string) : void;};
        get_name : {(buildable: Buildable) : string;};
        add_child : {(buildable: Buildable, builder: Builder, child: GObject.Object, _type: string) : void;};
        set_buildable_property : {(buildable: Buildable, builder: Builder, name: string, value: GObject.Value) : void;};
        construct_child : {(buildable: Buildable, builder: Builder, name: string) : GObject.Object;};
        custom_tag_start : {(buildable: Buildable, builder: Builder, child: GObject.Object, tagname: string, parser: GLib.MarkupParser, data: any) : boolean;};
        custom_tag_end : {(buildable: Buildable, builder: Builder, child: GObject.Object, tagname: string, data: any) : void;};
        custom_finished : {(buildable: Buildable, builder: Builder, child: GObject.Object, tagname: string, data: any) : void;};
        parser_finished : {(buildable: Buildable, builder: Builder) : void;};
        get_internal_child : {(buildable: Buildable, builder: Builder, childname: string) : GObject.Object;};
    
    }
    
    
    
    class BuilderClass {
        public parent_class: GObject.ObjectClass;
    
        get_type_from_name : {(builder: Builder, type_name: string) : GObject.Type;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
    }
    
    
    
    class BuilderPrivate {
    
    
    }
    
    
    
    class ButtonAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class ButtonAccessiblePrivate {
    
    
    }
    
    
    
    class ButtonBoxClass {
        public parent_class: BoxClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ButtonBoxPrivate {
    
    
    }
    
    
    
    class ButtonClass {
        public parent_class: BinClass;
    
        pressed : {(button: Button) : void;};
        released : {(button: Button) : void;};
        clicked : {(button: Button) : void;};
        enter : {(button: Button) : void;};
        leave : {(button: Button) : void;};
        activate : {(button: Button) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ButtonPrivate {
    
    
    }
    
    
    
    class CalendarClass {
        public parent_class: WidgetClass;
    
        month_changed : {(calendar: Calendar) : void;};
        day_selected : {(calendar: Calendar) : void;};
        day_selected_double_click : {(calendar: Calendar) : void;};
        prev_month : {(calendar: Calendar) : void;};
        next_month : {(calendar: Calendar) : void;};
        prev_year : {(calendar: Calendar) : void;};
        next_year : {(calendar: Calendar) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CalendarPrivate {
    
    
    }
    
    
    
    class CellAccessibleClass {
        public parent_class: AccessibleClass;
    
        update_cache : {(cell: CellAccessible, emit_signal: boolean) : void;};
    
    }
    
    
    
    class CellAccessibleParentIface {
        public parent: GObject.TypeInterface;
    
        get_cell_extents : {(parent: CellAccessibleParent, cell: CellAccessible, _x: number, _y: number, width: number, height: number, coord_type: Atk.CoordType) : void;};
        get_cell_area : {(parent: CellAccessibleParent, cell: CellAccessible, cell_rect: Gdk.Rectangle) : void;};
        grab_focus : {(parent: CellAccessibleParent, cell: CellAccessible) : boolean;};
        get_child_index : {(parent: CellAccessibleParent, cell: CellAccessible) : number;};
        get_renderer_state : {(parent: CellAccessibleParent, cell: CellAccessible) : CellRendererState;};
        expand_collapse : {(parent: CellAccessibleParent, cell: CellAccessible) : void;};
        activate : {(parent: CellAccessibleParent, cell: CellAccessible) : void;};
        edit : {(parent: CellAccessibleParent, cell: CellAccessible) : void;};
        update_relationset : {(parent: CellAccessibleParent, cell: CellAccessible, relationset: Atk.RelationSet) : void;};
        get_cell_position : {(parent: CellAccessibleParent, cell: CellAccessible, _row: number, column: number) : void;};
        get_column_header_cells : {(parent: CellAccessibleParent, cell: CellAccessible) : Atk.Object[];};
        get_row_header_cells : {(parent: CellAccessibleParent, cell: CellAccessible) : Atk.Object[];};
    
    }
    
    
    
    class CellAccessiblePrivate {
    
    
    }
    
    
    
    class CellAreaBoxClass {
        public parent_class: CellAreaClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CellAreaBoxPrivate {
    
    
    }
    
    
    
    class CellAreaClass {
        public parent_class: GObject.InitiallyUnownedClass;
    
        add : {(area: CellArea, renderer: CellRenderer) : void;};
        remove : {(area: CellArea, renderer: CellRenderer) : void;};
        foreach : {(area: CellArea, callback: CellCallback, callback_data: any) : void;};
        foreach_alloc : {(area: CellArea, context: CellAreaContext, widget: Widget, cell_area: Gdk.Rectangle, background_area: Gdk.Rectangle, callback: CellAllocCallback, callback_data: any) : void;};
        event : {(area: CellArea, context: CellAreaContext, widget: Widget, event: Gdk.Event, cell_area: Gdk.Rectangle, flags: CellRendererState) : number;};
        render : {(area: CellArea, context: CellAreaContext, widget: Widget, cr: cairo.Context, background_area: Gdk.Rectangle, cell_area: Gdk.Rectangle, flags: CellRendererState, paint_focus: boolean) : void;};
        apply_attributes : {(area: CellArea, tree_model: TreeModel, iter: TreeIter, is_expander: boolean, is_expanded: boolean) : void;};
        create_context : {(area: CellArea) : CellAreaContext;};
        copy_context : {(area: CellArea, context: CellAreaContext) : CellAreaContext;};
        get_request_mode : {(area: CellArea) : SizeRequestMode;};
        get_preferred_width : {(area: CellArea, context: CellAreaContext, widget: Widget, minimum_width: number, natural_width: number) : void;};
        get_preferred_height_for_width : {(area: CellArea, context: CellAreaContext, widget: Widget, width: number, minimum_height: number, natural_height: number) : void;};
        get_preferred_height : {(area: CellArea, context: CellAreaContext, widget: Widget, minimum_height: number, natural_height: number) : void;};
        get_preferred_width_for_height : {(area: CellArea, context: CellAreaContext, widget: Widget, height: number, minimum_width: number, natural_width: number) : void;};
        set_cell_property : {(area: CellArea, renderer: CellRenderer, property_id: number, value: GObject.Value, pspec: GObject.ParamSpec) : void;};
        get_cell_property : {(area: CellArea, renderer: CellRenderer, property_id: number, value: GObject.Value, pspec: GObject.ParamSpec) : void;};
        focus : {(area: CellArea, direction: DirectionType) : boolean;};
        is_activatable : {(area: CellArea) : boolean;};
        activate : {(area: CellArea, context: CellAreaContext, widget: Widget, cell_area: Gdk.Rectangle, flags: CellRendererState, edit_only: boolean) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
        public find_cell_property (property_name: string) : GObject.ParamSpec;
        public install_cell_property (property_id: number, pspec: GObject.ParamSpec) : void;
        public list_cell_properties (n_properties: number) : GObject.ParamSpec[];
    }
    
    
    
    class CellAreaContextClass {
        public parent_class: GObject.ObjectClass;
    
        allocate : {(context: CellAreaContext, width: number, height: number) : void;};
        reset : {(context: CellAreaContext) : void;};
        get_preferred_height_for_width : {(context: CellAreaContext, width: number, minimum_height: number, natural_height: number) : void;};
        get_preferred_width_for_height : {(context: CellAreaContext, height: number, minimum_width: number, natural_width: number) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
    
    }
    
    
    
    class CellAreaContextPrivate {
    
    
    }
    
    
    
    class CellAreaPrivate {
    
    
    }
    
    
    
    class CellEditableIface {
        public g_iface: GObject.TypeInterface;
    
        editing_done : {(cell_editable: CellEditable) : void;};
        remove_widget : {(cell_editable: CellEditable) : void;};
        start_editing : {(cell_editable: CellEditable, event: Gdk.Event) : void;};
    
    }
    
    
    
    class CellLayoutIface {
        public g_iface: GObject.TypeInterface;
    
        pack_start : {(cell_layout: CellLayout, cell: CellRenderer, expand: boolean) : void;};
        pack_end : {(cell_layout: CellLayout, cell: CellRenderer, expand: boolean) : void;};
        clear : {(cell_layout: CellLayout) : void;};
        add_attribute : {(cell_layout: CellLayout, cell: CellRenderer, attribute: string, column: number) : void;};
        set_cell_data_func : {(cell_layout: CellLayout, cell: CellRenderer, _func: CellLayoutDataFunc, func_data: any, destroy: GLib.DestroyNotify) : void;};
        clear_attributes : {(cell_layout: CellLayout, cell: CellRenderer) : void;};
        reorder : {(cell_layout: CellLayout, cell: CellRenderer, position: number) : void;};
        get_cells : {(cell_layout: CellLayout) : GLib.List;};
        get_area : {(cell_layout: CellLayout) : CellArea;};
    
    }
    
    
    
    class CellRendererAccelClass {
        public parent_class: CellRendererTextClass;
    
        accel_edited : {(accel: CellRendererAccel, path_string: string, accel_key: number, accel_mods: Gdk.ModifierType, hardware_keycode: number) : void;};
        accel_cleared : {(accel: CellRendererAccel, path_string: string) : void;};
        _gtk_reserved0 : {() : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CellRendererAccelPrivate {
    
    
    }
    
    
    
    class CellRendererClass {
        public parent_class: GObject.InitiallyUnownedClass;
        public priv: CellRendererClassPrivate;
    
        get_request_mode : {(cell: CellRenderer) : SizeRequestMode;};
        get_preferred_width : {(cell: CellRenderer, widget: Widget, minimum_size: number, natural_size: number) : void;};
        get_preferred_height_for_width : {(cell: CellRenderer, widget: Widget, width: number, minimum_height: number, natural_height: number) : void;};
        get_preferred_height : {(cell: CellRenderer, widget: Widget, minimum_size: number, natural_size: number) : void;};
        get_preferred_width_for_height : {(cell: CellRenderer, widget: Widget, height: number, minimum_width: number, natural_width: number) : void;};
        get_aligned_area : {(cell: CellRenderer, widget: Widget, flags: CellRendererState, cell_area: Gdk.Rectangle, aligned_area: Gdk.Rectangle) : void;};
        get_size : {(cell: CellRenderer, widget: Widget, cell_area: Gdk.Rectangle, x_offset: number, y_offset: number, width: number, height: number) : void;};
        render : {(cell: CellRenderer, cr: cairo.Context, widget: Widget, background_area: Gdk.Rectangle, cell_area: Gdk.Rectangle, flags: CellRendererState) : void;};
        activate : {(cell: CellRenderer, event: Gdk.Event, widget: Widget, path: string, background_area: Gdk.Rectangle, cell_area: Gdk.Rectangle, flags: CellRendererState) : boolean;};
        start_editing : {(cell: CellRenderer, event: Gdk.Event, widget: Widget, path: string, background_area: Gdk.Rectangle, cell_area: Gdk.Rectangle, flags: CellRendererState) : CellEditable;};
        editing_canceled : {(cell: CellRenderer) : void;};
        editing_started : {(cell: CellRenderer, editable: CellEditable, path: string) : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
        public set_accessible_type (_type: GObject.Type) : void;
    }
    
    
    
    class CellRendererClassPrivate {
    
    
    }
    
    
    
    class CellRendererComboClass {
        public parent: CellRendererTextClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CellRendererComboPrivate {
    
    
    }
    
    
    
    class CellRendererPixbufClass {
        public parent_class: CellRendererClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CellRendererPixbufPrivate {
    
    
    }
    
    
    
    class CellRendererPrivate {
    
    
    }
    
    
    
    class CellRendererProgressClass {
        public parent_class: CellRendererClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CellRendererProgressPrivate {
    
    
    }
    
    
    
    class CellRendererSpinClass {
        public parent: CellRendererTextClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CellRendererSpinPrivate {
    
    
    }
    
    
    
    class CellRendererSpinnerClass {
        public parent_class: CellRendererClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CellRendererSpinnerPrivate {
    
    
    }
    
    
    
    class CellRendererTextClass {
        public parent_class: CellRendererClass;
    
        edited : {(cell_renderer_text: CellRendererText, path: string, new_text: string) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CellRendererTextPrivate {
    
    
    }
    
    
    
    class CellRendererToggleClass {
        public parent_class: CellRendererClass;
    
        toggled : {(cell_renderer_toggle: CellRendererToggle, path: string) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CellRendererTogglePrivate {
    
    
    }
    
    
    
    class CellViewClass {
        public parent_class: WidgetClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CellViewPrivate {
    
    
    }
    
    
    
    class CheckButtonClass {
        public parent_class: ToggleButtonClass;
    
        draw_indicator : {(check_button: CheckButton, cr: cairo.Context) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CheckMenuItemAccessibleClass {
        public parent_class: MenuItemAccessibleClass;
    
    
    }
    
    
    
    class CheckMenuItemAccessiblePrivate {
    
    
    }
    
    
    
    class CheckMenuItemClass {
        public parent_class: MenuItemClass;
    
        toggled : {(check_menu_item: CheckMenuItem) : void;};
        draw_indicator : {(check_menu_item: CheckMenuItem, cr: cairo.Context) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CheckMenuItemPrivate {
    
    
    }
    
    
    
    class ColorButtonClass {
        public parent_class: ButtonClass;
    
        color_set : {(cp: ColorButton) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ColorButtonPrivate {
    
    
    }
    
    
    
    class ColorChooserDialogClass {
        public parent_class: DialogClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ColorChooserDialogPrivate {
    
    
    }
    
    
    
    class ColorChooserInterface {
        public base_interface: GObject.TypeInterface;
        public padding: any[];
    
        get_rgba : {(chooser: ColorChooser, color: Gdk.RGBA) : void;};
        set_rgba : {(chooser: ColorChooser, color: Gdk.RGBA) : void;};
        add_palette : {(chooser: ColorChooser, orientation: Orientation, colors_per_line: number, n_colors: number, colors: Gdk.RGBA[]) : void;};
        color_activated : {(chooser: ColorChooser, color: Gdk.RGBA) : void;};
    
    }
    
    
    
    class ColorChooserWidgetClass {
        public parent_class: BoxClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
    }
    
    
    
    class ColorChooserWidgetPrivate {
    
    
    }
    
    
    
    class ColorSelectionClass {
        public parent_class: BoxClass;
    
        color_changed : {(color_selection: ColorSelection) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ColorSelectionDialogClass {
        public parent_class: DialogClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ColorSelectionDialogPrivate {
    
    
    }
    
    
    
    class ColorSelectionPrivate {
    
    
    }
    
    
    
    class ComboBoxAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class ComboBoxAccessiblePrivate {
    
    
    }
    
    
    
    class ComboBoxClass {
        public parent_class: BinClass;
    
        changed : {(combo_box: ComboBox) : void;};
        format_entry_text : {(combo_box: ComboBox, path: string) : string;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
    
    }
    
    
    
    class ComboBoxPrivate {
    
    
    }
    
    
    
    class ComboBoxTextClass {
        public parent_class: ComboBoxClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ComboBoxTextPrivate {
    
    
    }
    
    
    
    class ContainerAccessibleClass {
        public parent_class: WidgetAccessibleClass;
    
        add_gtk : {(container: Container, widget: Widget, data: any) : number;};
        remove_gtk : {(container: Container, widget: Widget, data: any) : number;};
    
    }
    
    
    
    class ContainerAccessiblePrivate {
    
    
    }
    
    
    
    class ContainerCellAccessibleClass {
        public parent_class: CellAccessibleClass;
    
    
    }
    
    
    
    class ContainerCellAccessiblePrivate {
    
    
    }
    
    
    
    class ContainerClass {
        public parent_class: WidgetClass;
        public _handle_border_width: number;
    
        add : {(container: Container, widget: Widget) : void;};
        remove : {(container: Container, widget: Widget) : void;};
        check_resize : {(container: Container) : void;};
        forall : {(container: Container, include_internals: boolean, callback: Callback, callback_data: any) : void;};
        set_focus_child : {(container: Container, child: Widget) : void;};
        child_type : {(container: Container) : GObject.Type;};
        composite_name : {(container: Container, child: Widget) : string;};
        set_child_property : {(container: Container, child: Widget, property_id: number, value: GObject.Value, pspec: GObject.ParamSpec) : void;};
        get_child_property : {(container: Container, child: Widget, property_id: number, value: GObject.Value, pspec: GObject.ParamSpec) : void;};
        get_path_for_child : {(container: Container, child: Widget) : WidgetPath;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
        public find_child_property (property_name: string) : GObject.ParamSpec;
        public handle_border_width () : void;
        public install_child_properties (n_pspecs: number, pspecs: GObject.ParamSpec[]) : void;
        public install_child_property (property_id: number, pspec: GObject.ParamSpec) : void;
        public list_child_properties (n_properties: number) : GObject.ParamSpec[];
    }
    
    
    
    class ContainerPrivate {
    
    
    }
    
    
    
    class CssProviderClass {
        public parent_class: GObject.ObjectClass;
    
        parsing_error : {(provider: CssProvider, section: CssSection, error: GLib.Error) : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class CssProviderPrivate {
    
    
    }
    
    
    
    class CssSection {
    
    
        public get_end_line () : number;
        public get_end_position () : number;
        public get_file () : Gio.File;
        public get_parent () : CssSection;
        public get_section_type () : CssSectionType;
        public get_start_line () : number;
        public get_start_position () : number;
        public ref () : CssSection;
        public unref () : void;
    }
    
    
    
    class DialogClass {
        public parent_class: WindowClass;
    
        response : {(dialog: Dialog, response_id: number) : void;};
        close : {(dialog: Dialog) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class DialogPrivate {
    
    
    }
    
    
    
    class DrawingAreaClass {
        public parent_class: WidgetClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class EditableInterface {
        public base_iface: GObject.TypeInterface;
    
        insert_text : {(editable: Editable, new_text: string, new_text_length: number, position: number) : void;};
        delete_text : {(editable: Editable, start_pos: number, end_pos: number) : void;};
        changed : {(editable: Editable) : void;};
        do_insert_text : {(editable: Editable, new_text: string, new_text_length: number, position: number) : void;};
        do_delete_text : {(editable: Editable, start_pos: number, end_pos: number) : void;};
        get_chars : {(editable: Editable, start_pos: number, end_pos: number) : string;};
        set_selection_bounds : {(editable: Editable, start_pos: number, end_pos: number) : void;};
        get_selection_bounds : {(editable: Editable, start_pos: number, end_pos: number) : boolean;};
        set_position : {(editable: Editable, position: number) : void;};
        get_position : {(editable: Editable) : number;};
    
    }
    
    
    
    class EntryAccessibleClass {
        public parent_class: WidgetAccessibleClass;
    
    
    }
    
    
    
    class EntryAccessiblePrivate {
    
    
    }
    
    
    
    class EntryBufferClass {
        public parent_class: GObject.ObjectClass;
    
        inserted_text : {(buffer: EntryBuffer, position: number, chars: string, n_chars: number) : void;};
        deleted_text : {(buffer: EntryBuffer, position: number, n_chars: number) : void;};
        get_text : {(buffer: EntryBuffer, n_bytes: number) : string;};
        get_length : {(buffer: EntryBuffer) : number;};
        insert_text : {(buffer: EntryBuffer, position: number, chars: string, n_chars: number) : number;};
        delete_text : {(buffer: EntryBuffer, position: number, n_chars: number) : number;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
    }
    
    
    
    class EntryBufferPrivate {
    
    
    }
    
    
    
    class EntryClass {
        public parent_class: WidgetClass;
    
        populate_popup : {(entry: Entry, popup: Widget) : void;};
        activate : {(entry: Entry) : void;};
        move_cursor : {(entry: Entry, step: MovementStep, count: number, extend_selection: boolean) : void;};
        insert_at_cursor : {(entry: Entry, _str: string) : void;};
        delete_from_cursor : {(entry: Entry, _type: DeleteType, count: number) : void;};
        backspace : {(entry: Entry) : void;};
        cut_clipboard : {(entry: Entry) : void;};
        copy_clipboard : {(entry: Entry) : void;};
        paste_clipboard : {(entry: Entry) : void;};
        toggle_overwrite : {(entry: Entry) : void;};
        get_text_area_size : {(entry: Entry, _x: number, _y: number, width: number, height: number) : void;};
        get_frame_size : {(entry: Entry, _x: number, _y: number, width: number, height: number) : void;};
        insert_emoji : {(entry: Entry) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
    
    }
    
    
    
    class EntryCompletionClass {
        public parent_class: GObject.ObjectClass;
    
        match_selected : {(completion: EntryCompletion, model: TreeModel, iter: TreeIter) : boolean;};
        action_activated : {(completion: EntryCompletion, index_: number) : void;};
        insert_prefix : {(completion: EntryCompletion, prefix: string) : boolean;};
        cursor_on_match : {(completion: EntryCompletion, model: TreeModel, iter: TreeIter) : boolean;};
        no_matches : {(completion: EntryCompletion) : void;};
        _gtk_reserved0 : {() : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
    
    }
    
    
    
    class EntryCompletionPrivate {
    
    
    }
    
    
    
    class EntryPrivate {
    
    
    }
    
    
    
    class EventBoxClass {
        public parent_class: BinClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class EventBoxPrivate {
    
    
    }
    
    
    
    class EventControllerClass {
    
    
    }
    
    
    
    class EventControllerKeyClass {
    
    
    }
    
    
    
    class EventControllerMotionClass {
    
    
    }
    
    
    
    class EventControllerScrollClass {
    
    
    }
    
    
    
    class ExpanderAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class ExpanderAccessiblePrivate {
    
    
    }
    
    
    
    class ExpanderClass {
        public parent_class: BinClass;
    
        activate : {(expander: Expander) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ExpanderPrivate {
    
    
    }
    
    
    
    class FileChooserButtonClass {
        public parent_class: BoxClass;
    
        file_set : {(fc: FileChooserButton) : void;};
        __gtk_reserved1 : {() : void;};
        __gtk_reserved2 : {() : void;};
        __gtk_reserved3 : {() : void;};
        __gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class FileChooserButtonPrivate {
    
    
    }
    
    
    
    class FileChooserDialogClass {
        public parent_class: DialogClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class FileChooserDialogPrivate {
    
    
    }
    
    
    
    class FileChooserNativeClass {
        public parent_class: NativeDialogClass;
    
    
    }
    
    
    
    class FileChooserWidgetClass {
        public parent_class: BoxClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class FileChooserWidgetPrivate {
    
    
    }
    
    
    
    class FileFilterInfo {
        public contains: FileFilterFlags;
        public filename: string;
        public uri: string;
        public display_name: string;
        public mime_type: string;
    
    
    }
    
    
    
    class FixedChild {
        public widget: Widget;
        public x: number;
        public y: number;
    
    
    }
    
    
    
    class FixedClass {
        public parent_class: ContainerClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class FixedPrivate {
    
    
    }
    
    
    
    class FlowBoxAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class FlowBoxAccessiblePrivate {
    
    
    }
    
    
    
    class FlowBoxChildAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class FlowBoxChildClass {
        public parent_class: BinClass;
    
        activate : {(child: FlowBoxChild) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
    
    }
    
    
    
    class FlowBoxClass {
        public parent_class: ContainerClass;
    
        child_activated : {(box: FlowBox, child: FlowBoxChild) : void;};
        selected_children_changed : {(box: FlowBox) : void;};
        activate_cursor_child : {(box: FlowBox) : void;};
        toggle_cursor_child : {(box: FlowBox) : void;};
        move_cursor : {(box: FlowBox, step: MovementStep, count: number) : boolean;};
        select_all : {(box: FlowBox) : void;};
        unselect_all : {(box: FlowBox) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
    
    }
    
    
    
    class FontButtonClass {
        public parent_class: ButtonClass;
    
        font_set : {(gfp: FontButton) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class FontButtonPrivate {
    
    
    }
    
    
    
    class FontChooserDialogClass {
        public parent_class: DialogClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class FontChooserDialogPrivate {
    
    
    }
    
    
    
    class FontChooserIface {
        public base_iface: GObject.TypeInterface;
        public padding: any[];
    
        get_font_family : {(fontchooser: FontChooser) : Pango.FontFamily;};
        get_font_face : {(fontchooser: FontChooser) : Pango.FontFace;};
        get_font_size : {(fontchooser: FontChooser) : number;};
        set_filter_func : {(fontchooser: FontChooser, filter: FontFilterFunc, user_data: any, destroy: GLib.DestroyNotify) : void;};
        font_activated : {(chooser: FontChooser, fontname: string) : void;};
        set_font_map : {(fontchooser: FontChooser, fontmap: Pango.FontMap) : void;};
        get_font_map : {(fontchooser: FontChooser) : Pango.FontMap;};
    
    }
    
    
    
    class FontChooserWidgetClass {
        public parent_class: BoxClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
    }
    
    
    
    class FontChooserWidgetPrivate {
    
    
    }
    
    
    
    class FontSelectionClass {
        public parent_class: BoxClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class FontSelectionDialogClass {
        public parent_class: DialogClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class FontSelectionDialogPrivate {
    
    
    }
    
    
    
    class FontSelectionPrivate {
    
    
    }
    
    
    
    class FrameAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class FrameAccessiblePrivate {
    
    
    }
    
    
    
    class FrameClass {
        public parent_class: BinClass;
    
        compute_child_allocation : {(frame: Frame, allocation: Allocation) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class FramePrivate {
    
    
    }
    
    
    
    class GLAreaClass {
        public parent_class: WidgetClass;
        public _padding: any[];
    
        render : {(area: GLArea, context: Gdk.GLContext) : boolean;};
        resize : {(area: GLArea, width: number, height: number) : void;};
        create_context : {(area: GLArea) : Gdk.GLContext;};
    
    }
    
    
    
    class GestureClass {
    
    
    }
    
    
    
    class GestureDragClass {
    
    
    }
    
    
    
    class GestureLongPressClass {
    
    
    }
    
    
    
    class GestureMultiPressClass {
    
    
    }
    
    
    
    class GesturePanClass {
    
    
    }
    
    
    
    class GestureRotateClass {
    
    
    }
    
    
    
    class GestureSingleClass {
    
    
    }
    
    
    
    class GestureStylusClass {
    
    
    }
    
    
    
    class GestureSwipeClass {
    
    
    }
    
    
    
    class GestureZoomClass {
    
    
    }
    
    
    
    class Gradient {
    
    
        public add_color_stop (offset: number, color: SymbolicColor) : void;
        public ref () : Gradient;
        public resolve (props: StyleProperties, resolved_gradient: cairo.Pattern) : boolean;
        public resolve_for_context (context: StyleContext) : cairo.Pattern;
        public to_string () : string;
        public unref () : void;
    }
    
    
    
    class GridClass {
        public parent_class: ContainerClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
    }
    
    
    
    class GridPrivate {
    
    
    }
    
    
    
    class HBoxClass {
        public parent_class: BoxClass;
    
    
    }
    
    
    
    class HButtonBoxClass {
        public parent_class: ButtonBoxClass;
    
    
    }
    
    
    
    class HPanedClass {
        public parent_class: PanedClass;
    
    
    }
    
    
    
    class HSVClass {
        public parent_class: WidgetClass;
    
        changed : {(hsv: HSV) : void;};
        move : {(hsv: HSV, _type: DirectionType) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class HSVPrivate {
    
    
    }
    
    
    
    class HScaleClass {
        public parent_class: ScaleClass;
    
    
    }
    
    
    
    class HScrollbarClass {
        public parent_class: ScrollbarClass;
    
    
    }
    
    
    
    class HSeparatorClass {
        public parent_class: SeparatorClass;
    
    
    }
    
    
    
    class HandleBoxClass {
        public parent_class: BinClass;
    
        child_attached : {(handle_box: HandleBox, child: Widget) : void;};
        child_detached : {(handle_box: HandleBox, child: Widget) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class HandleBoxPrivate {
    
    
    }
    
    
    
    class HeaderBarClass {
        public parent_class: ContainerClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class HeaderBarPrivate {
    
    
    }
    
    
    
    class IMContextClass {
        public parent_class: GObject.ObjectClass;
    
        preedit_start : {(context: IMContext) : void;};
        preedit_end : {(context: IMContext) : void;};
        preedit_changed : {(context: IMContext) : void;};
        commit : {(context: IMContext, _str: string) : void;};
        retrieve_surrounding : {(context: IMContext) : boolean;};
        delete_surrounding : {(context: IMContext, offset: number, n_chars: number) : boolean;};
        set_client_window : {(context: IMContext, window: Gdk.Window) : void;};
        get_preedit_string : {(context: IMContext, _str: string, attrs: Pango.AttrList, cursor_pos: number) : void;};
        filter_keypress : {(context: IMContext, event: Gdk.EventKey) : boolean;};
        focus_in : {(context: IMContext) : void;};
        focus_out : {(context: IMContext) : void;};
        reset : {(context: IMContext) : void;};
        set_cursor_location : {(context: IMContext, area: Gdk.Rectangle) : void;};
        set_use_preedit : {(context: IMContext, use_preedit: boolean) : void;};
        set_surrounding : {(context: IMContext, text: string, len: number, cursor_index: number) : void;};
        get_surrounding : {(context: IMContext, text: string, cursor_index: number) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
    
    }
    
    
    
    class IMContextInfo {
        public context_id: string;
        public context_name: string;
        public domain: string;
        public domain_dirname: string;
        public default_locales: string;
    
    
    }
    
    
    
    class IMContextSimpleClass {
        public parent_class: IMContextClass;
    
    
    }
    
    
    
    class IMContextSimplePrivate {
    
    
    }
    
    
    
    class IMMulticontextClass {
        public parent_class: IMContextClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class IMMulticontextPrivate {
    
    
    }
    
    
    
    class IconFactoryClass {
        public parent_class: GObject.ObjectClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class IconFactoryPrivate {
    
    
    }
    
    
    
    class IconInfoClass {
    
    
    }
    
    
    
    class IconSet {
    
    
        public add_source (source: IconSource) : void;
        public copy () : IconSet;
        public get_sizes (sizes: number[], n_sizes: number) : void;
        public ref () : IconSet;
        public render_icon (style: Style, direction: TextDirection, state: StateType, size: number, widget: Widget, detail: string) : GdkPixbuf.Pixbuf;
        public render_icon_pixbuf (context: StyleContext, size: number) : GdkPixbuf.Pixbuf;
        public render_icon_surface (context: StyleContext, size: number, scale: number, for_window: Gdk.Window) : cairo.Surface;
        public unref () : void;
    }
    
    
    
    class IconSource {
    
    
        public copy () : IconSource;
        public free () : void;
        public get_direction () : TextDirection;
        public get_direction_wildcarded () : boolean;
        public get_filename () : string;
        public get_icon_name () : string;
        public get_pixbuf () : GdkPixbuf.Pixbuf;
        public get_size () : number;
        public get_size_wildcarded () : boolean;
        public get_state () : StateType;
        public get_state_wildcarded () : boolean;
        public set_direction (direction: TextDirection) : void;
        public set_direction_wildcarded (setting: boolean) : void;
        public set_filename (filename: string) : void;
        public set_icon_name (icon_name: string) : void;
        public set_pixbuf (pixbuf: GdkPixbuf.Pixbuf) : void;
        public set_size (size: number) : void;
        public set_size_wildcarded (setting: boolean) : void;
        public set_state (state: StateType) : void;
        public set_state_wildcarded (setting: boolean) : void;
    }
    
    
    
    class IconThemeClass {
        public parent_class: GObject.ObjectClass;
    
        changed : {(icon_theme: IconTheme) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class IconThemePrivate {
    
    
    }
    
    
    
    class IconViewAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class IconViewAccessiblePrivate {
    
    
    }
    
    
    
    class IconViewClass {
        public parent_class: ContainerClass;
    
        item_activated : {(icon_view: IconView, path: TreePath) : void;};
        selection_changed : {(icon_view: IconView) : void;};
        select_all : {(icon_view: IconView) : void;};
        unselect_all : {(icon_view: IconView) : void;};
        select_cursor_item : {(icon_view: IconView) : void;};
        toggle_cursor_item : {(icon_view: IconView) : void;};
        move_cursor : {(icon_view: IconView, step: MovementStep, count: number) : boolean;};
        activate_cursor_item : {(icon_view: IconView) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class IconViewPrivate {
    
    
    }
    
    
    
    class ImageAccessibleClass {
        public parent_class: WidgetAccessibleClass;
    
    
    }
    
    
    
    class ImageAccessiblePrivate {
    
    
    }
    
    
    
    class ImageCellAccessibleClass {
        public parent_class: RendererCellAccessibleClass;
    
    
    }
    
    
    
    class ImageCellAccessiblePrivate {
    
    
    }
    
    
    
    class ImageClass {
        public parent_class: MiscClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ImageMenuItemClass {
        public parent_class: MenuItemClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ImageMenuItemPrivate {
    
    
    }
    
    
    
    class ImagePrivate {
    
    
    }
    
    
    
    class InfoBarClass {
        public parent_class: BoxClass;
    
        response : {(info_bar: InfoBar, response_id: number) : void;};
        close : {(info_bar: InfoBar) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class InfoBarPrivate {
    
    
    }
    
    
    
    class InvisibleClass {
        public parent_class: WidgetClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class InvisiblePrivate {
    
    
    }
    
    
    
    class LabelAccessibleClass {
        public parent_class: WidgetAccessibleClass;
    
    
    }
    
    
    
    class LabelAccessiblePrivate {
    
    
    }
    
    
    
    class LabelClass {
        public parent_class: MiscClass;
    
        move_cursor : {(label: Label, step: MovementStep, count: number, extend_selection: boolean) : void;};
        copy_clipboard : {(label: Label) : void;};
        populate_popup : {(label: Label, menu: Menu) : void;};
        activate_link : {(label: Label, uri: string) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
    }
    
    
    
    class LabelPrivate {
    
    
    }
    
    
    
    class LabelSelectionInfo {
    
    
    }
    
    
    
    class LayoutClass {
        public parent_class: ContainerClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class LayoutPrivate {
    
    
    }
    
    
    
    class LevelBarAccessibleClass {
        public parent_class: WidgetAccessibleClass;
    
    
    }
    
    
    
    class LevelBarAccessiblePrivate {
    
    
    }
    
    
    
    class LevelBarClass {
        public parent_class: WidgetClass;
        public padding: any[];
    
        offset_changed : {(self: LevelBar, name: string) : void;};
    
    }
    
    
    
    class LevelBarPrivate {
    
    
    }
    
    
    
    class LinkButtonAccessibleClass {
        public parent_class: ButtonAccessibleClass;
    
    
    }
    
    
    
    class LinkButtonAccessiblePrivate {
    
    
    }
    
    
    
    class LinkButtonClass {
        public parent_class: ButtonClass;
    
        activate_link : {(button: LinkButton) : boolean;};
        _gtk_padding1 : {() : void;};
        _gtk_padding2 : {() : void;};
        _gtk_padding3 : {() : void;};
        _gtk_padding4 : {() : void;};
    
    }
    
    
    
    class LinkButtonPrivate {
    
    
    }
    
    
    
    class ListBoxAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class ListBoxAccessiblePrivate {
    
    
    }
    
    
    
    class ListBoxClass {
        public parent_class: ContainerClass;
    
        row_selected : {(box: ListBox, _row: ListBoxRow) : void;};
        row_activated : {(box: ListBox, _row: ListBoxRow) : void;};
        activate_cursor_row : {(box: ListBox) : void;};
        toggle_cursor_row : {(box: ListBox) : void;};
        move_cursor : {(box: ListBox, step: MovementStep, count: number) : void;};
        selected_rows_changed : {(box: ListBox) : void;};
        select_all : {(box: ListBox) : void;};
        unselect_all : {(box: ListBox) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
    
    }
    
    
    
    class ListBoxRowAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class ListBoxRowClass {
        public parent_class: BinClass;
    
        activate : {(_row: ListBoxRow) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
    
    }
    
    
    
    class ListStoreClass {
        public parent_class: GObject.ObjectClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ListStorePrivate {
    
    
    }
    
    
    
    class LockButtonAccessibleClass {
        public parent_class: ButtonAccessibleClass;
    
    
    }
    
    
    
    class LockButtonAccessiblePrivate {
    
    
    }
    
    
    
    class LockButtonClass {
        public parent_class: ButtonClass;
    
        reserved0 : {() : void;};
        reserved1 : {() : void;};
        reserved2 : {() : void;};
        reserved3 : {() : void;};
        reserved4 : {() : void;};
        reserved5 : {() : void;};
        reserved6 : {() : void;};
        reserved7 : {() : void;};
    
    }
    
    
    
    class LockButtonPrivate {
    
    
    }
    
    
    
    class MenuAccessibleClass {
        public parent_class: MenuShellAccessibleClass;
    
    
    }
    
    
    
    class MenuAccessiblePrivate {
    
    
    }
    
    
    
    class MenuBarClass {
        public parent_class: MenuShellClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class MenuBarPrivate {
    
    
    }
    
    
    
    class MenuButtonAccessibleClass {
        public parent_class: ToggleButtonAccessibleClass;
    
    
    }
    
    
    
    class MenuButtonAccessiblePrivate {
    
    
    }
    
    
    
    class MenuButtonClass {
        public parent_class: ToggleButtonClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class MenuButtonPrivate {
    
    
    }
    
    
    
    class MenuClass {
        public parent_class: MenuShellClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class MenuItemAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class MenuItemAccessiblePrivate {
    
    
    }
    
    
    
    class MenuItemClass {
        public parent_class: BinClass;
        public hide_on_activate: number;
    
        activate : {(menu_item: MenuItem) : void;};
        activate_item : {(menu_item: MenuItem) : void;};
        toggle_size_request : {(menu_item: MenuItem, requisition: number) : void;};
        toggle_size_allocate : {(menu_item: MenuItem, allocation: number) : void;};
        set_label : {(menu_item: MenuItem, label: string) : void;};
        get_label : {(menu_item: MenuItem) : string;};
        select : {(menu_item: MenuItem) : void;};
        deselect : {(menu_item: MenuItem) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class MenuItemPrivate {
    
    
    }
    
    
    
    class MenuPrivate {
    
    
    }
    
    
    
    class MenuShellAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class MenuShellAccessiblePrivate {
    
    
    }
    
    
    
    class MenuShellClass {
        public parent_class: ContainerClass;
        public submenu_placement: number;
    
        deactivate : {(menu_shell: MenuShell) : void;};
        selection_done : {(menu_shell: MenuShell) : void;};
        move_current : {(menu_shell: MenuShell, direction: MenuDirectionType) : void;};
        activate_current : {(menu_shell: MenuShell, force_hide: boolean) : void;};
        cancel : {(menu_shell: MenuShell) : void;};
        select_item : {(menu_shell: MenuShell, menu_item: Widget) : void;};
        insert : {(menu_shell: MenuShell, child: Widget, position: number) : void;};
        get_popup_delay : {(menu_shell: MenuShell) : number;};
        move_selected : {(menu_shell: MenuShell, distance: number) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class MenuShellPrivate {
    
    
    }
    
    
    
    class MenuToolButtonClass {
        public parent_class: ToolButtonClass;
    
        show_menu : {(button: MenuToolButton) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class MenuToolButtonPrivate {
    
    
    }
    
    
    
    class MessageDialogClass {
        public parent_class: DialogClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class MessageDialogPrivate {
    
    
    }
    
    
    
    class MiscClass {
        public parent_class: WidgetClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class MiscPrivate {
    
    
    }
    
    
    
    class MountOperationClass {
        public parent_class: Gio.MountOperationClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class MountOperationPrivate {
    
    
    }
    
    
    
    class NativeDialogClass {
        public parent_class: GObject.ObjectClass;
    
        response : {(self: NativeDialog, response_id: number) : void;};
        show : {(self: NativeDialog) : void;};
        hide : {(self: NativeDialog) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class NotebookAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class NotebookAccessiblePrivate {
    
    
    }
    
    
    
    class NotebookClass {
        public parent_class: ContainerClass;
    
        switch_page : {(notebook: Notebook, page: Widget, page_num: number) : void;};
        select_page : {(notebook: Notebook, move_focus: boolean) : boolean;};
        focus_tab : {(notebook: Notebook, _type: NotebookTab) : boolean;};
        change_current_page : {(notebook: Notebook, offset: number) : boolean;};
        move_focus_out : {(notebook: Notebook, direction: DirectionType) : void;};
        reorder_tab : {(notebook: Notebook, direction: DirectionType, move_to_last: boolean) : boolean;};
        insert_page : {(notebook: Notebook, child: Widget, tab_label: Widget, menu_label: Widget, position: number) : number;};
        create_window : {(notebook: Notebook, page: Widget, _x: number, _y: number) : Notebook;};
        page_reordered : {(notebook: Notebook, child: Widget, page_num: number) : void;};
        page_removed : {(notebook: Notebook, child: Widget, page_num: number) : void;};
        page_added : {(notebook: Notebook, child: Widget, page_num: number) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
    }
    
    
    
    class NotebookPageAccessibleClass {
        public parent_class: Atk.ObjectClass;
    
    
    }
    
    
    
    class NotebookPageAccessiblePrivate {
    
    
    }
    
    
    
    class NotebookPrivate {
    
    
    }
    
    
    
    class NumerableIconClass {
        public parent_class: Gio.EmblemedIconClass;
        public padding: any[];
    
    
    }
    
    
    
    class NumerableIconPrivate {
    
    
    }
    
    
    
    class OffscreenWindowClass {
        public parent_class: WindowClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class OrientableIface {
        public base_iface: GObject.TypeInterface;
    
    
    }
    
    
    
    class OverlayClass {
        public parent_class: BinClass;
    
        get_child_position : {(overlay: Overlay, widget: Widget, allocation: Allocation) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
    }
    
    
    
    class OverlayPrivate {
    
    
    }
    
    
    
    class PadActionEntry {
        public type: PadActionType;
        public index: number;
        public mode: number;
        public label: string;
        public action_name: string;
    
    
    }
    
    
    
    class PadControllerClass {
    
    
    }
    
    
    
    class PageRange {
        public start: number;
        public end: number;
    
    
    }
    
    
    
    class PanedAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class PanedAccessiblePrivate {
    
    
    }
    
    
    
    class PanedClass {
        public parent_class: ContainerClass;
    
        cycle_child_focus : {(paned: Paned, reverse: boolean) : boolean;};
        toggle_handle_focus : {(paned: Paned) : boolean;};
        move_handle : {(paned: Paned, scroll: ScrollType) : boolean;};
        cycle_handle_focus : {(paned: Paned, reverse: boolean) : boolean;};
        accept_position : {(paned: Paned) : boolean;};
        cancel_position : {(paned: Paned) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class PanedPrivate {
    
    
    }
    
    
    
    class PaperSize {
    
    
        public copy () : PaperSize;
        public free () : void;
        public get_default_bottom_margin (unit: Unit) : number;
        public get_default_left_margin (unit: Unit) : number;
        public get_default_right_margin (unit: Unit) : number;
        public get_default_top_margin (unit: Unit) : number;
        public get_display_name () : string;
        public get_height (unit: Unit) : number;
        public get_name () : string;
        public get_ppd_name () : string;
        public get_width (unit: Unit) : number;
        public is_custom () : boolean;
        public is_equal (size2: PaperSize) : boolean;
        public is_ipp () : boolean;
        public set_size (width: number, height: number, unit: Unit) : void;
        public to_gvariant () : GLib.Variant;
        public to_key_file (key_file: GLib.KeyFile, group_name: string) : void;
    }
    
    
    
    class PlacesSidebarClass {
    
    
    }
    
    
    
    class PlugClass {
        public parent_class: WindowClass;
    
        embedded : {(plug: Plug) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class PlugPrivate {
    
    
    }
    
    
    
    class PopoverAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class PopoverClass {
        public parent_class: BinClass;
        public reserved: any[];
    
        closed : {(popover: Popover) : void;};
    
    }
    
    
    
    class PopoverMenuClass {
        public parent_class: PopoverClass;
        public reserved: any[];
    
    
    }
    
    
    
    class PopoverPrivate {
    
    
    }
    
    
    
    class PrintOperationClass {
        public parent_class: GObject.ObjectClass;
    
        done : {(operation: PrintOperation, result: PrintOperationResult) : void;};
        begin_print : {(operation: PrintOperation, context: PrintContext) : void;};
        paginate : {(operation: PrintOperation, context: PrintContext) : boolean;};
        request_page_setup : {(operation: PrintOperation, context: PrintContext, page_nr: number, setup: PageSetup) : void;};
        draw_page : {(operation: PrintOperation, context: PrintContext, page_nr: number) : void;};
        end_print : {(operation: PrintOperation, context: PrintContext) : void;};
        status_changed : {(operation: PrintOperation) : void;};
        create_custom_widget : {(operation: PrintOperation) : Widget;};
        custom_widget_apply : {(operation: PrintOperation, widget: Widget) : void;};
        preview : {(operation: PrintOperation, preview: PrintOperationPreview, context: PrintContext, parent: Window) : boolean;};
        update_custom_widget : {(operation: PrintOperation, widget: Widget, setup: PageSetup, settings: PrintSettings) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
    }
    
    
    
    class PrintOperationPreviewIface {
        public g_iface: GObject.TypeInterface;
    
        ready : {(preview: PrintOperationPreview, context: PrintContext) : void;};
        got_page_size : {(preview: PrintOperationPreview, context: PrintContext, page_setup: PageSetup) : void;};
        render_page : {(preview: PrintOperationPreview, page_nr: number) : void;};
        is_selected : {(preview: PrintOperationPreview, page_nr: number) : boolean;};
        end_preview : {(preview: PrintOperationPreview) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
    }
    
    
    
    class PrintOperationPrivate {
    
    
    }
    
    
    
    class ProgressBarAccessibleClass {
        public parent_class: WidgetAccessibleClass;
    
    
    }
    
    
    
    class ProgressBarAccessiblePrivate {
    
    
    }
    
    
    
    class ProgressBarClass {
        public parent_class: WidgetClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ProgressBarPrivate {
    
    
    }
    
    
    
    class RadioActionClass {
        public parent_class: ToggleActionClass;
    
        changed : {(action: RadioAction, current: RadioAction) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class RadioActionEntry {
        public name: string;
        public stock_id: string;
        public label: string;
        public accelerator: string;
        public tooltip: string;
        public value: number;
    
    
    }
    
    
    
    class RadioActionPrivate {
    
    
    }
    
    
    
    class RadioButtonAccessibleClass {
        public parent_class: ToggleButtonAccessibleClass;
    
    
    }
    
    
    
    class RadioButtonAccessiblePrivate {
    
    
    }
    
    
    
    class RadioButtonClass {
        public parent_class: CheckButtonClass;
    
        group_changed : {(radio_button: RadioButton) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class RadioButtonPrivate {
    
    
    }
    
    
    
    class RadioMenuItemAccessibleClass {
        public parent_class: CheckMenuItemAccessibleClass;
    
    
    }
    
    
    
    class RadioMenuItemAccessiblePrivate {
    
    
    }
    
    
    
    class RadioMenuItemClass {
        public parent_class: CheckMenuItemClass;
    
        group_changed : {(radio_menu_item: RadioMenuItem) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class RadioMenuItemPrivate {
    
    
    }
    
    
    
    class RadioToolButtonClass {
        public parent_class: ToggleToolButtonClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class RangeAccessibleClass {
        public parent_class: WidgetAccessibleClass;
    
    
    }
    
    
    
    class RangeAccessiblePrivate {
    
    
    }
    
    
    
    class RangeClass {
        public parent_class: WidgetClass;
        public slider_detail: string;
        public stepper_detail: string;
    
        value_changed : {(range: Range) : void;};
        adjust_bounds : {(range: Range, new_value: number) : void;};
        move_slider : {(range: Range, scroll: ScrollType) : void;};
        get_range_border : {(range: Range, border_: Border) : void;};
        change_value : {(range: Range, scroll: ScrollType, new_value: number) : boolean;};
        get_range_size_request : {(range: Range, orientation: Orientation, minimum: number, natural: number) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
    
    }
    
    
    
    class RangePrivate {
    
    
    }
    
    
    
    class RcContext {
    
    
    }
    
    
    
    class RcProperty {
        public type_name: GLib.Quark;
        public property_name: GLib.Quark;
        public origin: string;
        public value: GObject.Value;
    
    
    }
    
    
    
    class RcStyleClass {
        public parent_class: GObject.ObjectClass;
    
        create_rc_style : {(rc_style: RcStyle) : RcStyle;};
        parse : {(rc_style: RcStyle, settings: Settings, scanner: GLib.Scanner) : number;};
        merge : {(dest: RcStyle, src: RcStyle) : void;};
        create_style : {(rc_style: RcStyle) : Style;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class RecentActionClass {
        public parent_class: ActionClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class RecentActionPrivate {
    
    
    }
    
    
    
    class RecentChooserDialogClass {
        public parent_class: DialogClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class RecentChooserDialogPrivate {
    
    
    }
    
    
    
    class RecentChooserIface {
        public base_iface: GObject.TypeInterface;
    
        set_current_uri : {(chooser: RecentChooser, uri: string) : boolean;};
        get_current_uri : {(chooser: RecentChooser) : string;};
        select_uri : {(chooser: RecentChooser, uri: string) : boolean;};
        unselect_uri : {(chooser: RecentChooser, uri: string) : void;};
        select_all : {(chooser: RecentChooser) : void;};
        unselect_all : {(chooser: RecentChooser) : void;};
        get_items : {(chooser: RecentChooser) : GLib.List;};
        get_recent_manager : {(chooser: RecentChooser) : RecentManager;};
        add_filter : {(chooser: RecentChooser, filter: RecentFilter) : void;};
        remove_filter : {(chooser: RecentChooser, filter: RecentFilter) : void;};
        list_filters : {(chooser: RecentChooser) : GLib.SList;};
        set_sort_func : {(chooser: RecentChooser, sort_func: RecentSortFunc, sort_data: any, data_destroy: GLib.DestroyNotify) : void;};
        item_activated : {(chooser: RecentChooser) : void;};
        selection_changed : {(chooser: RecentChooser) : void;};
    
    }
    
    
    
    class RecentChooserMenuClass {
        public parent_class: MenuClass;
    
        gtk_recent1 : {() : void;};
        gtk_recent2 : {() : void;};
        gtk_recent3 : {() : void;};
        gtk_recent4 : {() : void;};
    
    }
    
    
    
    class RecentChooserMenuPrivate {
    
    
    }
    
    
    
    class RecentChooserWidgetClass {
        public parent_class: BoxClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class RecentChooserWidgetPrivate {
    
    
    }
    
    
    
    class RecentData {
        public display_name: string;
        public description: string;
        public mime_type: string;
        public app_name: string;
        public app_exec: string;
        public groups: string[];
        public is_private: boolean;
    
    
    }
    
    
    
    class RecentFilterInfo {
        public contains: RecentFilterFlags;
        public uri: string;
        public display_name: string;
        public mime_type: string;
        public applications: string[];
        public groups: string[];
        public age: number;
    
    
    }
    
    
    
    class RecentInfo {
    
    
        public create_app_info (app_name: string) : Gio.AppInfo;
        public exists () : boolean;
        public get_added () : number;
        public get_age () : number;
        public get_application_info (app_name: string, app_exec: string, count: number, time_: number) : boolean;
        public get_applications (length: number) : string[];
        public get_description () : string;
        public get_display_name () : string;
        public get_gicon () : Gio.Icon;
        public get_groups (length: number) : string[];
        public get_icon (size: number) : GdkPixbuf.Pixbuf;
        public get_mime_type () : string;
        public get_modified () : number;
        public get_private_hint () : boolean;
        public get_short_name () : string;
        public get_uri () : string;
        public get_uri_display () : string;
        public get_visited () : number;
        public has_application (app_name: string) : boolean;
        public has_group (group_name: string) : boolean;
        public is_local () : boolean;
        public last_application () : string;
        public match (info_b: RecentInfo) : boolean;
        public ref () : RecentInfo;
        public unref () : void;
    }
    
    
    
    class RecentManagerClass {
        public parent_class: GObject.ObjectClass;
    
        changed : {(manager: RecentManager) : void;};
        _gtk_recent1 : {() : void;};
        _gtk_recent2 : {() : void;};
        _gtk_recent3 : {() : void;};
        _gtk_recent4 : {() : void;};
    
    }
    
    
    
    class RecentManagerPrivate {
    
    
    }
    
    
    
    class RendererCellAccessibleClass {
        public parent_class: CellAccessibleClass;
    
    
    }
    
    
    
    class RendererCellAccessiblePrivate {
    
    
    }
    
    
    
    class RequestedSize {
        public data: any;
        public minimum_size: number;
        public natural_size: number;
    
    
    }
    
    
    
    class Requisition {
        public width: number;
        public height: number;
    
    
        public copy () : Requisition;
        public free () : void;
    }
    
    
    
    class RevealerClass {
        public parent_class: BinClass;
    
    
    }
    
    
    
    class ScaleAccessibleClass {
        public parent_class: RangeAccessibleClass;
    
    
    }
    
    
    
    class ScaleAccessiblePrivate {
    
    
    }
    
    
    
    class ScaleButtonAccessibleClass {
        public parent_class: ButtonAccessibleClass;
    
    
    }
    
    
    
    class ScaleButtonAccessiblePrivate {
    
    
    }
    
    
    
    class ScaleButtonClass {
        public parent_class: ButtonClass;
    
        value_changed : {(button: ScaleButton, value: number) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ScaleButtonPrivate {
    
    
    }
    
    
    
    class ScaleClass {
        public parent_class: RangeClass;
    
        format_value : {(scale: Scale, value: number) : string;};
        draw_value : {(scale: Scale) : void;};
        get_layout_offsets : {(scale: Scale, _x: number, _y: number) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ScalePrivate {
    
    
    }
    
    
    
    class ScrollableInterface {
        public base_iface: GObject.TypeInterface;
    
        get_border : {(scrollable: Scrollable, border: Border) : boolean;};
    
    }
    
    
    
    class ScrollbarClass {
        public parent_class: RangeClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ScrolledWindowAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class ScrolledWindowAccessiblePrivate {
    
    
    }
    
    
    
    class ScrolledWindowClass {
        public parent_class: BinClass;
        public scrollbar_spacing: number;
    
        scroll_child : {(scrolled_window: ScrolledWindow, scroll: ScrollType, horizontal: boolean) : boolean;};
        move_focus_out : {(scrolled_window: ScrolledWindow, direction: DirectionType) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ScrolledWindowPrivate {
    
    
    }
    
    
    
    class SearchBarClass {
        public parent_class: BinClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class SearchEntryClass {
        public parent_class: EntryClass;
    
        search_changed : {(entry: SearchEntry) : void;};
        next_match : {(entry: SearchEntry) : void;};
        previous_match : {(entry: SearchEntry) : void;};
        stop_search : {(entry: SearchEntry) : void;};
    
    }
    
    
    
    class SelectionData {
    
    
        public copy () : SelectionData;
        public free () : void;
        public get_data () : number[];
        public get_data_type () : Gdk.Atom;
        public get_data_with_length (length: number) : number[];
        public get_display () : Gdk.Display;
        public get_format () : number;
        public get_length () : number;
        public get_pixbuf () : GdkPixbuf.Pixbuf;
        public get_selection () : Gdk.Atom;
        public get_target () : Gdk.Atom;
        public get_targets (targets: Gdk.Atom[], n_atoms: number) : boolean;
        public get_text () : string;
        public get_uris () : string[];
        public set (_type: Gdk.Atom, format: number, data: number[], length: number) : void;
        public set_pixbuf (pixbuf: GdkPixbuf.Pixbuf) : boolean;
        public set_text (_str: string, len: number) : boolean;
        public set_uris (uris: string[]) : boolean;
        public targets_include_image (writable: boolean) : boolean;
        public targets_include_rich_text (buffer: TextBuffer) : boolean;
        public targets_include_text () : boolean;
        public targets_include_uri () : boolean;
    }
    
    
    
    class SeparatorClass {
        public parent_class: WidgetClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class SeparatorMenuItemClass {
        public parent_class: MenuItemClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class SeparatorPrivate {
    
    
    }
    
    
    
    class SeparatorToolItemClass {
        public parent_class: ToolItemClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class SeparatorToolItemPrivate {
    
    
    }
    
    
    
    class SettingsClass {
        public parent_class: GObject.ObjectClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class SettingsPrivate {
    
    
    }
    
    
    
    class SettingsValue {
        public origin: string;
        public value: GObject.Value;
    
    
    }
    
    
    
    class ShortcutLabelClass {
    
    
    }
    
    
    
    class ShortcutsGroupClass {
    
    
    }
    
    
    
    class ShortcutsSectionClass {
    
    
    }
    
    
    
    class ShortcutsShortcutClass {
    
    
    }
    
    
    
    class ShortcutsWindowClass {
        public parent_class: WindowClass;
    
        close : {(self: ShortcutsWindow) : void;};
        search : {(self: ShortcutsWindow) : void;};
    
    }
    
    
    
    class SizeGroupClass {
        public parent_class: GObject.ObjectClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class SizeGroupPrivate {
    
    
    }
    
    
    
    class SocketClass {
        public parent_class: ContainerClass;
    
        plug_added : {(socket_: Socket) : void;};
        plug_removed : {(socket_: Socket) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class SocketPrivate {
    
    
    }
    
    
    
    class SpinButtonAccessibleClass {
        public parent_class: EntryAccessibleClass;
    
    
    }
    
    
    
    class SpinButtonAccessiblePrivate {
    
    
    }
    
    
    
    class SpinButtonClass {
        public parent_class: EntryClass;
    
        input : {(spin_button: SpinButton, new_value: number) : number;};
        output : {(spin_button: SpinButton) : number;};
        value_changed : {(spin_button: SpinButton) : void;};
        change_value : {(spin_button: SpinButton, scroll: ScrollType) : void;};
        wrapped : {(spin_button: SpinButton) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class SpinButtonPrivate {
    
    
    }
    
    
    
    class SpinnerAccessibleClass {
        public parent_class: WidgetAccessibleClass;
    
    
    }
    
    
    
    class SpinnerAccessiblePrivate {
    
    
    }
    
    
    
    class SpinnerClass {
        public parent_class: WidgetClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class SpinnerPrivate {
    
    
    }
    
    
    
    class StackAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class StackClass {
        public parent_class: ContainerClass;
    
    
    }
    
    
    
    class StackSidebarClass {
        public parent_class: BinClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class StackSidebarPrivate {
    
    
    }
    
    
    
    class StackSwitcherClass {
        public parent_class: BoxClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class StatusIconClass {
        public parent_class: GObject.ObjectClass;
    
        activate : {(status_icon: StatusIcon) : void;};
        popup_menu : {(status_icon: StatusIcon, button: number, activate_time: number) : void;};
        size_changed : {(status_icon: StatusIcon, size: number) : boolean;};
        button_press_event : {(status_icon: StatusIcon, event: Gdk.EventButton) : boolean;};
        button_release_event : {(status_icon: StatusIcon, event: Gdk.EventButton) : boolean;};
        scroll_event : {(status_icon: StatusIcon, event: Gdk.EventScroll) : boolean;};
        query_tooltip : {(status_icon: StatusIcon, _x: number, _y: number, keyboard_mode: boolean, tooltip: Tooltip) : boolean;};
        __gtk_reserved1 : {() : void;};
        __gtk_reserved2 : {() : void;};
        __gtk_reserved3 : {() : void;};
        __gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class StatusIconPrivate {
    
    
    }
    
    
    
    class StatusbarAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class StatusbarAccessiblePrivate {
    
    
    }
    
    
    
    class StatusbarClass {
        public parent_class: BoxClass;
        public reserved: any;
    
        text_pushed : {(statusbar: Statusbar, context_id: number, text: string) : void;};
        text_popped : {(statusbar: Statusbar, context_id: number, text: string) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class StatusbarPrivate {
    
    
    }
    
    
    
    class StockItem {
        public stock_id: string;
        public label: string;
        public modifier: Gdk.ModifierType;
        public keyval: number;
        public translation_domain: string;
    
    
        public copy () : StockItem;
        public free () : void;
    }
    
    
    
    class StyleClass {
        public parent_class: GObject.ObjectClass;
    
        realize : {(style: Style) : void;};
        unrealize : {(style: Style) : void;};
        copy : {(style: Style, src: Style) : void;};
        clone : {(style: Style) : Style;};
        init_from_rc : {(style: Style, rc_style: RcStyle) : void;};
        set_background : {(style: Style, window: Gdk.Window, state_type: StateType) : void;};
        render_icon : {(style: Style, source: IconSource, direction: TextDirection, state: StateType, size: number, widget: Widget, detail: string) : GdkPixbuf.Pixbuf;};
        draw_hline : {(style: Style, cr: cairo.Context, state_type: StateType, widget: Widget, detail: string, x1: number, x2: number, _y: number) : void;};
        draw_vline : {(style: Style, cr: cairo.Context, state_type: StateType, widget: Widget, detail: string, y1_: number, y2_: number, _x: number) : void;};
        draw_shadow : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number) : void;};
        draw_arrow : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, arrow_type: ArrowType, fill: boolean, _x: number, _y: number, width: number, height: number) : void;};
        draw_diamond : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number) : void;};
        draw_box : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number) : void;};
        draw_flat_box : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number) : void;};
        draw_check : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number) : void;};
        draw_option : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number) : void;};
        draw_tab : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number) : void;};
        draw_shadow_gap : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number, gap_side: PositionType, gap_x: number, gap_width: number) : void;};
        draw_box_gap : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number, gap_side: PositionType, gap_x: number, gap_width: number) : void;};
        draw_extension : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number, gap_side: PositionType) : void;};
        draw_focus : {(style: Style, cr: cairo.Context, state_type: StateType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number) : void;};
        draw_slider : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number, orientation: Orientation) : void;};
        draw_handle : {(style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number, orientation: Orientation) : void;};
        draw_expander : {(style: Style, cr: cairo.Context, state_type: StateType, widget: Widget, detail: string, _x: number, _y: number, expander_style: ExpanderStyle) : void;};
        draw_layout : {(style: Style, cr: cairo.Context, state_type: StateType, use_text: boolean, widget: Widget, detail: string, _x: number, _y: number, layout: Pango.Layout) : void;};
        draw_resize_grip : {(style: Style, cr: cairo.Context, state_type: StateType, widget: Widget, detail: string, edge: Gdk.WindowEdge, _x: number, _y: number, width: number, height: number) : void;};
        draw_spinner : {(style: Style, cr: cairo.Context, state_type: StateType, widget: Widget, detail: string, step: number, _x: number, _y: number, width: number, height: number) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
        _gtk_reserved9 : {() : void;};
        _gtk_reserved10 : {() : void;};
        _gtk_reserved11 : {() : void;};
    
    }
    
    
    
    class StyleContextClass {
        public parent_class: GObject.ObjectClass;
    
        changed : {(context: StyleContext) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class StyleContextPrivate {
    
    
    }
    
    
    
    class StylePropertiesClass {
        public parent_class: GObject.ObjectClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class StylePropertiesPrivate {
    
    
    }
    
    
    
    class StyleProviderIface {
        public g_iface: GObject.TypeInterface;
    
        get_style : {(provider: StyleProvider, path: WidgetPath) : StyleProperties;};
        get_style_property : {(provider: StyleProvider, path: WidgetPath, state: StateFlags, pspec: GObject.ParamSpec, value: GObject.Value) : boolean;};
        get_icon_factory : {(provider: StyleProvider, path: WidgetPath) : IconFactory;};
    
    }
    
    
    
    class SwitchAccessibleClass {
        public parent_class: WidgetAccessibleClass;
    
    
    }
    
    
    
    class SwitchAccessiblePrivate {
    
    
    }
    
    
    
    class SwitchClass {
        public parent_class: WidgetClass;
    
        activate : {(_sw: Switch) : void;};
        state_set : {(_sw: Switch, state: boolean) : boolean;};
        _switch_padding_1 : {() : void;};
        _switch_padding_2 : {() : void;};
        _switch_padding_3 : {() : void;};
        _switch_padding_4 : {() : void;};
        _switch_padding_5 : {() : void;};
    
    }
    
    
    
    class SwitchPrivate {
    
    
    }
    
    
    
    class SymbolicColor {
    
    
        public ref () : SymbolicColor;
        public resolve (props: StyleProperties, resolved_color: Gdk.RGBA) : boolean;
        public to_string () : string;
        public unref () : void;
    }
    
    
    
    class TableChild {
        public widget: Widget;
        public left_attach: number;
        public right_attach: number;
        public top_attach: number;
        public bottom_attach: number;
        public xpadding: number;
        public ypadding: number;
        public xexpand: number;
        public yexpand: number;
        public xshrink: number;
        public yshrink: number;
        public xfill: number;
        public yfill: number;
    
    
    }
    
    
    
    class TableClass {
        public parent_class: ContainerClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TablePrivate {
    
    
    }
    
    
    
    class TableRowCol {
        public requisition: number;
        public allocation: number;
        public spacing: number;
        public need_expand: number;
        public need_shrink: number;
        public expand: number;
        public shrink: number;
        public empty: number;
    
    
    }
    
    
    
    class TargetEntry {
        public target: string;
        public flags: number;
        public info: number;
    
    
        public copy () : TargetEntry;
        public free () : void;
    }
    
    
    
    class TargetList {
    
    
        public add (target: Gdk.Atom, flags: number, info: number) : void;
        public add_image_targets (info: number, writable: boolean) : void;
        public add_rich_text_targets (info: number, deserializable: boolean, buffer: TextBuffer) : void;
        public add_table (targets: TargetEntry[], ntargets: number) : void;
        public add_text_targets (info: number) : void;
        public add_uri_targets (info: number) : void;
        public find (target: Gdk.Atom, info: number) : boolean;
        public ref () : TargetList;
        public remove (target: Gdk.Atom) : void;
        public unref () : void;
    }
    
    
    
    class TargetPair {
        public target: Gdk.Atom;
        public flags: number;
        public info: number;
    
    
    }
    
    
    
    class TearoffMenuItemClass {
        public parent_class: MenuItemClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TearoffMenuItemPrivate {
    
    
    }
    
    
    
    class TextAppearance {
        public bg_color: Gdk.Color;
        public fg_color: Gdk.Color;
        public rise: number;
        public underline: number;
        public strikethrough: number;
        public draw_bg: number;
        public inside_selection: number;
        public is_text: number;
    
    
    }
    
    
    
    class TextAttributes {
        public refcount: number;
        public appearance: TextAppearance;
        public justification: Justification;
        public direction: TextDirection;
        public font: Pango.FontDescription;
        public font_scale: number;
        public left_margin: number;
        public right_margin: number;
        public indent: number;
        public pixels_above_lines: number;
        public pixels_below_lines: number;
        public pixels_inside_wrap: number;
        public tabs: Pango.TabArray;
        public wrap_mode: WrapMode;
        public language: Pango.Language;
        public pg_bg_color: Gdk.Color;
        public invisible: number;
        public bg_full_height: number;
        public editable: number;
        public no_fallback: number;
        public pg_bg_rgba: Gdk.RGBA;
        public letter_spacing: number;
    
    
        public copy () : TextAttributes;
        public copy_values (dest: TextAttributes) : void;
        public ref () : TextAttributes;
        public unref () : void;
    }
    
    
    
    class TextBTree {
    
    
    }
    
    
    
    class TextBufferClass {
        public parent_class: GObject.ObjectClass;
    
        insert_text : {(buffer: TextBuffer, pos: TextIter, new_text: string, new_text_length: number) : void;};
        insert_pixbuf : {(buffer: TextBuffer, iter: TextIter, pixbuf: GdkPixbuf.Pixbuf) : void;};
        insert_child_anchor : {(buffer: TextBuffer, iter: TextIter, anchor: TextChildAnchor) : void;};
        delete_range : {(buffer: TextBuffer, start: TextIter, _end: TextIter) : void;};
        changed : {(buffer: TextBuffer) : void;};
        modified_changed : {(buffer: TextBuffer) : void;};
        mark_set : {(buffer: TextBuffer, location: TextIter, mark: TextMark) : void;};
        mark_deleted : {(buffer: TextBuffer, mark: TextMark) : void;};
        apply_tag : {(buffer: TextBuffer, tag: TextTag, start: TextIter, _end: TextIter) : void;};
        remove_tag : {(buffer: TextBuffer, tag: TextTag, start: TextIter, _end: TextIter) : void;};
        begin_user_action : {(buffer: TextBuffer) : void;};
        end_user_action : {(buffer: TextBuffer) : void;};
        paste_done : {(buffer: TextBuffer, clipboard: Clipboard) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TextBufferPrivate {
    
    
    }
    
    
    
    class TextCellAccessibleClass {
        public parent_class: RendererCellAccessibleClass;
    
    
    }
    
    
    
    class TextCellAccessiblePrivate {
    
    
    }
    
    
    
    class TextChildAnchorClass {
        public parent_class: GObject.ObjectClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TextIter {
        public dummy1: any;
        public dummy2: any;
        public dummy3: number;
        public dummy4: number;
        public dummy5: number;
        public dummy6: number;
        public dummy7: number;
        public dummy8: number;
        public dummy9: any;
        public dummy10: any;
        public dummy11: number;
        public dummy12: number;
        public dummy13: number;
        public dummy14: any;
    
    
        public assign (other: TextIter) : void;
        public backward_char () : boolean;
        public backward_chars (count: number) : boolean;
        public backward_cursor_position () : boolean;
        public backward_cursor_positions (count: number) : boolean;
        public backward_find_char (pred: TextCharPredicate, user_data: any, limit: TextIter) : boolean;
        public backward_line () : boolean;
        public backward_lines (count: number) : boolean;
        public backward_search (_str: string, flags: TextSearchFlags, match_start: TextIter, match_end: TextIter, limit: TextIter) : boolean;
        public backward_sentence_start () : boolean;
        public backward_sentence_starts (count: number) : boolean;
        public backward_to_tag_toggle (tag: TextTag) : boolean;
        public backward_visible_cursor_position () : boolean;
        public backward_visible_cursor_positions (count: number) : boolean;
        public backward_visible_line () : boolean;
        public backward_visible_lines (count: number) : boolean;
        public backward_visible_word_start () : boolean;
        public backward_visible_word_starts (count: number) : boolean;
        public backward_word_start () : boolean;
        public backward_word_starts (count: number) : boolean;
        public begins_tag (tag: TextTag) : boolean;
        public can_insert (default_editability: boolean) : boolean;
        public compare (rhs: TextIter) : number;
        public copy () : TextIter;
        public editable (default_setting: boolean) : boolean;
        public ends_line () : boolean;
        public ends_sentence () : boolean;
        public ends_tag (tag: TextTag) : boolean;
        public ends_word () : boolean;
        public equal (rhs: TextIter) : boolean;
        public forward_char () : boolean;
        public forward_chars (count: number) : boolean;
        public forward_cursor_position () : boolean;
        public forward_cursor_positions (count: number) : boolean;
        public forward_find_char (pred: TextCharPredicate, user_data: any, limit: TextIter) : boolean;
        public forward_line () : boolean;
        public forward_lines (count: number) : boolean;
        public forward_search (_str: string, flags: TextSearchFlags, match_start: TextIter, match_end: TextIter, limit: TextIter) : boolean;
        public forward_sentence_end () : boolean;
        public forward_sentence_ends (count: number) : boolean;
        public forward_to_end () : void;
        public forward_to_line_end () : boolean;
        public forward_to_tag_toggle (tag: TextTag) : boolean;
        public forward_visible_cursor_position () : boolean;
        public forward_visible_cursor_positions (count: number) : boolean;
        public forward_visible_line () : boolean;
        public forward_visible_lines (count: number) : boolean;
        public forward_visible_word_end () : boolean;
        public forward_visible_word_ends (count: number) : boolean;
        public forward_word_end () : boolean;
        public forward_word_ends (count: number) : boolean;
        public free () : void;
        public get_attributes (values: TextAttributes) : boolean;
        public get_buffer () : TextBuffer;
        public get_bytes_in_line () : number;
        public get_char () : string;
        public get_chars_in_line () : number;
        public get_child_anchor () : TextChildAnchor;
        public get_language () : Pango.Language;
        public get_line () : number;
        public get_line_index () : number;
        public get_line_offset () : number;
        public get_marks () : GLib.SList;
        public get_offset () : number;
        public get_pixbuf () : GdkPixbuf.Pixbuf;
        public get_slice (_end: TextIter) : string;
        public get_tags () : GLib.SList;
        public get_text (_end: TextIter) : string;
        public get_toggled_tags (toggled_on: boolean) : GLib.SList;
        public get_visible_line_index () : number;
        public get_visible_line_offset () : number;
        public get_visible_slice (_end: TextIter) : string;
        public get_visible_text (_end: TextIter) : string;
        public has_tag (tag: TextTag) : boolean;
        public in_range (start: TextIter, _end: TextIter) : boolean;
        public inside_sentence () : boolean;
        public inside_word () : boolean;
        public is_cursor_position () : boolean;
        public is_end () : boolean;
        public is_start () : boolean;
        public order (second: TextIter) : void;
        public set_line (line_number: number) : void;
        public set_line_index (byte_on_line: number) : void;
        public set_line_offset (char_on_line: number) : void;
        public set_offset (char_offset: number) : void;
        public set_visible_line_index (byte_on_line: number) : void;
        public set_visible_line_offset (char_on_line: number) : void;
        public starts_line () : boolean;
        public starts_sentence () : boolean;
        public starts_tag (tag: TextTag) : boolean;
        public starts_word () : boolean;
        public toggles_tag (tag: TextTag) : boolean;
    }
    
    
    
    class TextMarkClass {
        public parent_class: GObject.ObjectClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TextTagClass {
        public parent_class: GObject.ObjectClass;
    
        event : {(tag: TextTag, event_object: GObject.Object, event: Gdk.Event, iter: TextIter) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TextTagPrivate {
    
    
    }
    
    
    
    class TextTagTableClass {
        public parent_class: GObject.ObjectClass;
    
        tag_changed : {(table: TextTagTable, tag: TextTag, size_changed: boolean) : void;};
        tag_added : {(table: TextTagTable, tag: TextTag) : void;};
        tag_removed : {(table: TextTagTable, tag: TextTag) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TextTagTablePrivate {
    
    
    }
    
    
    
    class TextViewAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class TextViewAccessiblePrivate {
    
    
    }
    
    
    
    class TextViewClass {
        public parent_class: ContainerClass;
    
        populate_popup : {(text_view: TextView, popup: Widget) : void;};
        move_cursor : {(text_view: TextView, step: MovementStep, count: number, extend_selection: boolean) : void;};
        set_anchor : {(text_view: TextView) : void;};
        insert_at_cursor : {(text_view: TextView, _str: string) : void;};
        delete_from_cursor : {(text_view: TextView, _type: DeleteType, count: number) : void;};
        backspace : {(text_view: TextView) : void;};
        cut_clipboard : {(text_view: TextView) : void;};
        copy_clipboard : {(text_view: TextView) : void;};
        paste_clipboard : {(text_view: TextView) : void;};
        toggle_overwrite : {(text_view: TextView) : void;};
        create_buffer : {(text_view: TextView) : TextBuffer;};
        draw_layer : {(text_view: TextView, layer: TextViewLayer, cr: cairo.Context) : void;};
        extend_selection : {(text_view: TextView, granularity: TextExtendSelection, location: TextIter, start: TextIter, _end: TextIter) : boolean;};
        insert_emoji : {(text_view: TextView) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TextViewPrivate {
    
    
    }
    
    
    
    class ThemeEngine {
    
    
    }
    
    
    
    class ThemingEngineClass {
        public parent_class: GObject.ObjectClass;
        public padding: any[];
    
        render_line : {(engine: ThemingEngine, cr: cairo.Context, x0: number, y0: number, x1: number, y1: number) : void;};
        render_background : {(engine: ThemingEngine, cr: cairo.Context, _x: number, _y: number, width: number, height: number) : void;};
        render_frame : {(engine: ThemingEngine, cr: cairo.Context, _x: number, _y: number, width: number, height: number) : void;};
        render_frame_gap : {(engine: ThemingEngine, cr: cairo.Context, _x: number, _y: number, width: number, height: number, gap_side: PositionType, xy0_gap: number, xy1_gap: number) : void;};
        render_extension : {(engine: ThemingEngine, cr: cairo.Context, _x: number, _y: number, width: number, height: number, gap_side: PositionType) : void;};
        render_check : {(engine: ThemingEngine, cr: cairo.Context, _x: number, _y: number, width: number, height: number) : void;};
        render_option : {(engine: ThemingEngine, cr: cairo.Context, _x: number, _y: number, width: number, height: number) : void;};
        render_arrow : {(engine: ThemingEngine, cr: cairo.Context, angle: number, _x: number, _y: number, size: number) : void;};
        render_expander : {(engine: ThemingEngine, cr: cairo.Context, _x: number, _y: number, width: number, height: number) : void;};
        render_focus : {(engine: ThemingEngine, cr: cairo.Context, _x: number, _y: number, width: number, height: number) : void;};
        render_layout : {(engine: ThemingEngine, cr: cairo.Context, _x: number, _y: number, layout: Pango.Layout) : void;};
        render_slider : {(engine: ThemingEngine, cr: cairo.Context, _x: number, _y: number, width: number, height: number, orientation: Orientation) : void;};
        render_handle : {(engine: ThemingEngine, cr: cairo.Context, _x: number, _y: number, width: number, height: number) : void;};
        render_activity : {(engine: ThemingEngine, cr: cairo.Context, _x: number, _y: number, width: number, height: number) : void;};
        render_icon_pixbuf : {(engine: ThemingEngine, source: IconSource, size: IconSize) : GdkPixbuf.Pixbuf;};
        render_icon : {(engine: ThemingEngine, cr: cairo.Context, pixbuf: GdkPixbuf.Pixbuf, _x: number, _y: number) : void;};
        render_icon_surface : {(engine: ThemingEngine, cr: cairo.Context, surface: cairo.Surface, _x: number, _y: number) : void;};
    
    }
    
    
    
    class ThemingEnginePrivate {
    
    
    }
    
    
    
    class ToggleActionClass {
        public parent_class: ActionClass;
    
        toggled : {(action: ToggleAction) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ToggleActionEntry {
        public name: string;
        public stock_id: string;
        public label: string;
        public accelerator: string;
        public tooltip: string;
        public callback: GObject.Callback;
        public is_active: boolean;
    
    
    }
    
    
    
    class ToggleActionPrivate {
    
    
    }
    
    
    
    class ToggleButtonAccessibleClass {
        public parent_class: ButtonAccessibleClass;
    
    
    }
    
    
    
    class ToggleButtonAccessiblePrivate {
    
    
    }
    
    
    
    class ToggleButtonClass {
        public parent_class: ButtonClass;
    
        toggled : {(toggle_button: ToggleButton) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ToggleButtonPrivate {
    
    
    }
    
    
    
    class ToggleToolButtonClass {
        public parent_class: ToolButtonClass;
    
        toggled : {(button: ToggleToolButton) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ToggleToolButtonPrivate {
    
    
    }
    
    
    
    class ToolButtonClass {
        public parent_class: ToolItemClass;
        public button_type: GObject.Type;
    
        clicked : {(tool_item: ToolButton) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ToolButtonPrivate {
    
    
    }
    
    
    
    class ToolItemClass {
        public parent_class: BinClass;
    
        create_menu_proxy : {(tool_item: ToolItem) : boolean;};
        toolbar_reconfigured : {(tool_item: ToolItem) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ToolItemGroupClass {
        public parent_class: ContainerClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ToolItemGroupPrivate {
    
    
    }
    
    
    
    class ToolItemPrivate {
    
    
    }
    
    
    
    class ToolPaletteClass {
        public parent_class: ContainerClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ToolPalettePrivate {
    
    
    }
    
    
    
    class ToolShellIface {
        public g_iface: GObject.TypeInterface;
    
        get_icon_size : {(shell: ToolShell) : IconSize;};
        get_orientation : {(shell: ToolShell) : Orientation;};
        get_style : {(shell: ToolShell) : ToolbarStyle;};
        get_relief_style : {(shell: ToolShell) : ReliefStyle;};
        rebuild_menu : {(shell: ToolShell) : void;};
        get_text_orientation : {(shell: ToolShell) : Orientation;};
        get_text_alignment : {(shell: ToolShell) : number;};
        get_ellipsize_mode : {(shell: ToolShell) : Pango.EllipsizeMode;};
        get_text_size_group : {(shell: ToolShell) : SizeGroup;};
    
    }
    
    
    
    class ToolbarClass {
        public parent_class: ContainerClass;
    
        orientation_changed : {(toolbar: Toolbar, orientation: Orientation) : void;};
        style_changed : {(toolbar: Toolbar, style: ToolbarStyle) : void;};
        popup_context_menu : {(toolbar: Toolbar, _x: number, _y: number, button_number: number) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ToolbarPrivate {
    
    
    }
    
    
    
    class ToplevelAccessibleClass {
        public parent_class: Atk.ObjectClass;
    
    
    }
    
    
    
    class ToplevelAccessiblePrivate {
    
    
    }
    
    
    
    class TreeDragDestIface {
        public g_iface: GObject.TypeInterface;
    
        drag_data_received : {(drag_dest: TreeDragDest, dest: TreePath, selection_data: SelectionData) : boolean;};
        row_drop_possible : {(drag_dest: TreeDragDest, dest_path: TreePath, selection_data: SelectionData) : boolean;};
    
    }
    
    
    
    class TreeDragSourceIface {
        public g_iface: GObject.TypeInterface;
    
        row_draggable : {(drag_source: TreeDragSource, path: TreePath) : boolean;};
        drag_data_get : {(drag_source: TreeDragSource, path: TreePath, selection_data: SelectionData) : boolean;};
        drag_data_delete : {(drag_source: TreeDragSource, path: TreePath) : boolean;};
    
    }
    
    
    
    class TreeIter {
        public stamp: number;
        public user_data: any;
        public user_data2: any;
        public user_data3: any;
    
    
        public copy () : TreeIter;
        public free () : void;
    }
    
    
    
    class TreeModelFilterClass {
        public parent_class: GObject.ObjectClass;
    
        visible : {(self: TreeModelFilter, child_model: TreeModel, iter: TreeIter) : boolean;};
        modify : {(self: TreeModelFilter, child_model: TreeModel, iter: TreeIter, value: GObject.Value, column: number) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TreeModelFilterPrivate {
    
    
    }
    
    
    
    class TreeModelIface {
        public g_iface: GObject.TypeInterface;
    
        row_changed : {(tree_model: TreeModel, path: TreePath, iter: TreeIter) : void;};
        row_inserted : {(tree_model: TreeModel, path: TreePath, iter: TreeIter) : void;};
        row_has_child_toggled : {(tree_model: TreeModel, path: TreePath, iter: TreeIter) : void;};
        row_deleted : {(tree_model: TreeModel, path: TreePath) : void;};
        rows_reordered : {(tree_model: TreeModel, path: TreePath, iter: TreeIter, new_order: number) : void;};
        get_flags : {(tree_model: TreeModel) : TreeModelFlags;};
        get_n_columns : {(tree_model: TreeModel) : number;};
        get_column_type : {(tree_model: TreeModel, index_: number) : GObject.Type;};
        get_iter : {(tree_model: TreeModel, iter: TreeIter, path: TreePath) : boolean;};
        get_path : {(tree_model: TreeModel, iter: TreeIter) : TreePath;};
        get_value : {(tree_model: TreeModel, iter: TreeIter, column: number, value: GObject.Value) : void;};
        iter_next : {(tree_model: TreeModel, iter: TreeIter) : boolean;};
        iter_previous : {(tree_model: TreeModel, iter: TreeIter) : boolean;};
        iter_children : {(tree_model: TreeModel, iter: TreeIter, parent: TreeIter) : boolean;};
        iter_has_child : {(tree_model: TreeModel, iter: TreeIter) : boolean;};
        iter_n_children : {(tree_model: TreeModel, iter: TreeIter) : number;};
        iter_nth_child : {(tree_model: TreeModel, iter: TreeIter, parent: TreeIter, _n: number) : boolean;};
        iter_parent : {(tree_model: TreeModel, iter: TreeIter, child: TreeIter) : boolean;};
        ref_node : {(tree_model: TreeModel, iter: TreeIter) : void;};
        unref_node : {(tree_model: TreeModel, iter: TreeIter) : void;};
    
    }
    
    
    
    class TreeModelSortClass {
        public parent_class: GObject.ObjectClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TreeModelSortPrivate {
    
    
    }
    
    
    
    class TreePath {
    
    
        public append_index (index_: number) : void;
        public compare (_b: TreePath) : number;
        public copy () : TreePath;
        public down () : void;
        public free () : void;
        public get_depth () : number;
        public get_indices () : number;
        public get_indices_with_depth (depth: number) : number[];
        public is_ancestor (descendant: TreePath) : boolean;
        public is_descendant (ancestor: TreePath) : boolean;
        public next () : void;
        public prepend_index (index_: number) : void;
        public prev () : boolean;
        public to_string () : string;
        public up () : boolean;
    }
    
    
    
    class TreeRowReference {
    
    
        public copy () : TreeRowReference;
        public free () : void;
        public get_model () : TreeModel;
        public get_path () : TreePath;
        public valid () : boolean;
    }
    
    
    
    class TreeSelectionClass {
        public parent_class: GObject.ObjectClass;
    
        changed : {(selection: TreeSelection) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TreeSelectionPrivate {
    
    
    }
    
    
    
    class TreeSortableIface {
        public g_iface: GObject.TypeInterface;
    
        sort_column_changed : {(sortable: TreeSortable) : void;};
        get_sort_column_id : {(sortable: TreeSortable, sort_column_id: number, order: SortType) : boolean;};
        set_sort_column_id : {(sortable: TreeSortable, sort_column_id: number, order: SortType) : void;};
        set_sort_func : {(sortable: TreeSortable, sort_column_id: number, sort_func: TreeIterCompareFunc, user_data: any, destroy: GLib.DestroyNotify) : void;};
        set_default_sort_func : {(sortable: TreeSortable, sort_func: TreeIterCompareFunc, user_data: any, destroy: GLib.DestroyNotify) : void;};
        has_default_sort_func : {(sortable: TreeSortable) : boolean;};
    
    }
    
    
    
    class TreeStoreClass {
        public parent_class: GObject.ObjectClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TreeStorePrivate {
    
    
    }
    
    
    
    class TreeViewAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class TreeViewAccessiblePrivate {
    
    
    }
    
    
    
    class TreeViewClass {
        public parent_class: ContainerClass;
    
        row_activated : {(tree_view: TreeView, path: TreePath, column: TreeViewColumn) : void;};
        test_expand_row : {(tree_view: TreeView, iter: TreeIter, path: TreePath) : boolean;};
        test_collapse_row : {(tree_view: TreeView, iter: TreeIter, path: TreePath) : boolean;};
        row_expanded : {(tree_view: TreeView, iter: TreeIter, path: TreePath) : void;};
        row_collapsed : {(tree_view: TreeView, iter: TreeIter, path: TreePath) : void;};
        columns_changed : {(tree_view: TreeView) : void;};
        cursor_changed : {(tree_view: TreeView) : void;};
        move_cursor : {(tree_view: TreeView, step: MovementStep, count: number) : boolean;};
        select_all : {(tree_view: TreeView) : boolean;};
        unselect_all : {(tree_view: TreeView) : boolean;};
        select_cursor_row : {(tree_view: TreeView, start_editing: boolean) : boolean;};
        toggle_cursor_row : {(tree_view: TreeView) : boolean;};
        expand_collapse_cursor_row : {(tree_view: TreeView, logical: boolean, expand: boolean, open_all: boolean) : boolean;};
        select_cursor_parent : {(tree_view: TreeView) : boolean;};
        start_interactive_search : {(tree_view: TreeView) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
        _gtk_reserved5 : {() : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
        _gtk_reserved8 : {() : void;};
    
    }
    
    
    
    class TreeViewColumnClass {
        public parent_class: GObject.InitiallyUnownedClass;
    
        clicked : {(tree_column: TreeViewColumn) : void;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class TreeViewColumnPrivate {
    
    
    }
    
    
    
    class TreeViewPrivate {
    
    
    }
    
    
    
    class UIManagerClass {
        public parent_class: GObject.ObjectClass;
    
        add_widget : {(manager: UIManager, widget: Widget) : void;};
        actions_changed : {(manager: UIManager) : void;};
        connect_proxy : {(manager: UIManager, action: Action, proxy: Widget) : void;};
        disconnect_proxy : {(manager: UIManager, action: Action, proxy: Widget) : void;};
        pre_activate : {(manager: UIManager, action: Action) : void;};
        post_activate : {(manager: UIManager, action: Action) : void;};
        get_widget : {(manager: UIManager, path: string) : Widget;};
        get_action : {(manager: UIManager, path: string) : Action;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class UIManagerPrivate {
    
    
    }
    
    
    
    class VBoxClass {
        public parent_class: BoxClass;
    
    
    }
    
    
    
    class VButtonBoxClass {
        public parent_class: ButtonBoxClass;
    
    
    }
    
    
    
    class VPanedClass {
        public parent_class: PanedClass;
    
    
    }
    
    
    
    class VScaleClass {
        public parent_class: ScaleClass;
    
    
    }
    
    
    
    class VScrollbarClass {
        public parent_class: ScrollbarClass;
    
    
    }
    
    
    
    class VSeparatorClass {
        public parent_class: SeparatorClass;
    
    
    }
    
    
    
    class ViewportClass {
        public parent_class: BinClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class ViewportPrivate {
    
    
    }
    
    
    
    class VolumeButtonClass {
        public parent_class: ScaleButtonClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class WidgetAccessibleClass {
        public parent_class: AccessibleClass;
    
        notify_gtk : {(object: GObject.Object, pspec: GObject.ParamSpec) : void;};
    
    }
    
    
    
    class WidgetAccessiblePrivate {
    
    
    }
    
    
    
    class WidgetClass {
        public parent_class: GObject.InitiallyUnownedClass;
        public activate_signal: number;
        public priv: WidgetClassPrivate;
    
        dispatch_child_properties_changed : {(widget: Widget, n_pspecs: number, pspecs: GObject.ParamSpec) : void;};
        destroy : {(widget: Widget) : void;};
        show : {(widget: Widget) : void;};
        show_all : {(widget: Widget) : void;};
        hide : {(widget: Widget) : void;};
        map : {(widget: Widget) : void;};
        unmap : {(widget: Widget) : void;};
        realize : {(widget: Widget) : void;};
        unrealize : {(widget: Widget) : void;};
        size_allocate : {(widget: Widget, allocation: Allocation) : void;};
        state_changed : {(widget: Widget, previous_state: StateType) : void;};
        state_flags_changed : {(widget: Widget, previous_state_flags: StateFlags) : void;};
        parent_set : {(widget: Widget, previous_parent: Widget) : void;};
        hierarchy_changed : {(widget: Widget, previous_toplevel: Widget) : void;};
        style_set : {(widget: Widget, previous_style: Style) : void;};
        direction_changed : {(widget: Widget, previous_direction: TextDirection) : void;};
        grab_notify : {(widget: Widget, was_grabbed: boolean) : void;};
        child_notify : {(widget: Widget, child_property: GObject.ParamSpec) : void;};
        draw : {(widget: Widget, cr: cairo.Context) : boolean;};
        get_request_mode : {(widget: Widget) : SizeRequestMode;};
        get_preferred_height : {(widget: Widget, minimum_height: number, natural_height: number) : void;};
        get_preferred_width_for_height : {(widget: Widget, height: number, minimum_width: number, natural_width: number) : void;};
        get_preferred_width : {(widget: Widget, minimum_width: number, natural_width: number) : void;};
        get_preferred_height_for_width : {(widget: Widget, width: number, minimum_height: number, natural_height: number) : void;};
        mnemonic_activate : {(widget: Widget, group_cycling: boolean) : boolean;};
        grab_focus : {(widget: Widget) : void;};
        focus : {(widget: Widget, direction: DirectionType) : boolean;};
        move_focus : {(widget: Widget, direction: DirectionType) : void;};
        keynav_failed : {(widget: Widget, direction: DirectionType) : boolean;};
        event : {(widget: Widget, event: Gdk.Event) : boolean;};
        button_press_event : {(widget: Widget, event: Gdk.EventButton) : boolean;};
        button_release_event : {(widget: Widget, event: Gdk.EventButton) : boolean;};
        scroll_event : {(widget: Widget, event: Gdk.EventScroll) : boolean;};
        motion_notify_event : {(widget: Widget, event: Gdk.EventMotion) : boolean;};
        delete_event : {(widget: Widget, event: Gdk.EventAny) : boolean;};
        destroy_event : {(widget: Widget, event: Gdk.EventAny) : boolean;};
        key_press_event : {(widget: Widget, event: Gdk.EventKey) : boolean;};
        key_release_event : {(widget: Widget, event: Gdk.EventKey) : boolean;};
        enter_notify_event : {(widget: Widget, event: Gdk.EventCrossing) : boolean;};
        leave_notify_event : {(widget: Widget, event: Gdk.EventCrossing) : boolean;};
        configure_event : {(widget: Widget, event: Gdk.EventConfigure) : boolean;};
        focus_in_event : {(widget: Widget, event: Gdk.EventFocus) : boolean;};
        focus_out_event : {(widget: Widget, event: Gdk.EventFocus) : boolean;};
        map_event : {(widget: Widget, event: Gdk.EventAny) : boolean;};
        unmap_event : {(widget: Widget, event: Gdk.EventAny) : boolean;};
        property_notify_event : {(widget: Widget, event: Gdk.EventProperty) : boolean;};
        selection_clear_event : {(widget: Widget, event: Gdk.EventSelection) : boolean;};
        selection_request_event : {(widget: Widget, event: Gdk.EventSelection) : boolean;};
        selection_notify_event : {(widget: Widget, event: Gdk.EventSelection) : boolean;};
        proximity_in_event : {(widget: Widget, event: Gdk.EventProximity) : boolean;};
        proximity_out_event : {(widget: Widget, event: Gdk.EventProximity) : boolean;};
        visibility_notify_event : {(widget: Widget, event: Gdk.EventVisibility) : boolean;};
        window_state_event : {(widget: Widget, event: Gdk.EventWindowState) : boolean;};
        damage_event : {(widget: Widget, event: Gdk.EventExpose) : boolean;};
        grab_broken_event : {(widget: Widget, event: Gdk.EventGrabBroken) : boolean;};
        selection_get : {(widget: Widget, selection_data: SelectionData, info: number, time_: number) : void;};
        selection_received : {(widget: Widget, selection_data: SelectionData, time_: number) : void;};
        drag_begin : {(widget: Widget, context: Gdk.DragContext) : void;};
        drag_end : {(widget: Widget, context: Gdk.DragContext) : void;};
        drag_data_get : {(widget: Widget, context: Gdk.DragContext, selection_data: SelectionData, info: number, time_: number) : void;};
        drag_data_delete : {(widget: Widget, context: Gdk.DragContext) : void;};
        drag_leave : {(widget: Widget, context: Gdk.DragContext, time_: number) : void;};
        drag_motion : {(widget: Widget, context: Gdk.DragContext, _x: number, _y: number, time_: number) : boolean;};
        drag_drop : {(widget: Widget, context: Gdk.DragContext, _x: number, _y: number, time_: number) : boolean;};
        drag_data_received : {(widget: Widget, context: Gdk.DragContext, _x: number, _y: number, selection_data: SelectionData, info: number, time_: number) : void;};
        drag_failed : {(widget: Widget, context: Gdk.DragContext, result: DragResult) : boolean;};
        popup_menu : {(widget: Widget) : boolean;};
        show_help : {(widget: Widget, help_type: WidgetHelpType) : boolean;};
        get_accessible : {(widget: Widget) : Atk.Object;};
        screen_changed : {(widget: Widget, previous_screen: Gdk.Screen) : void;};
        can_activate_accel : {(widget: Widget, signal_id: number) : boolean;};
        composited_changed : {(widget: Widget) : void;};
        query_tooltip : {(widget: Widget, _x: number, _y: number, keyboard_tooltip: boolean, tooltip: Tooltip) : boolean;};
        compute_expand : {(widget: Widget, hexpand_p: boolean, vexpand_p: boolean) : void;};
        adjust_size_request : {(widget: Widget, orientation: Orientation, minimum_size: number, natural_size: number) : void;};
        adjust_size_allocation : {(widget: Widget, orientation: Orientation, minimum_size: number, natural_size: number, allocated_pos: number, allocated_size: number) : void;};
        style_updated : {(widget: Widget) : void;};
        touch_event : {(widget: Widget, event: Gdk.EventTouch) : boolean;};
        get_preferred_height_and_baseline_for_width : {(widget: Widget, width: number, minimum_height: number, natural_height: number, minimum_baseline: number, natural_baseline: number) : void;};
        adjust_baseline_request : {(widget: Widget, minimum_baseline: number, natural_baseline: number) : void;};
        adjust_baseline_allocation : {(widget: Widget, baseline: number) : void;};
        queue_draw_region : {(widget: Widget, region: cairo.Region) : void;};
        _gtk_reserved6 : {() : void;};
        _gtk_reserved7 : {() : void;};
    
        public bind_template_callback_full (callback_name: string, callback_symbol: GObject.Callback) : void;
        public bind_template_child_full (name: string, internal_child: boolean, struct_offset: number) : void;
        public find_style_property (property_name: string) : GObject.ParamSpec;
        public get_css_name () : string;
        public install_style_property (pspec: GObject.ParamSpec) : void;
        public install_style_property_parser (pspec: GObject.ParamSpec, parser: RcPropertyParser) : void;
        public list_style_properties (n_properties: number) : GObject.ParamSpec[];
        public set_accessible_role (role: Atk.Role) : void;
        public set_accessible_type (_type: GObject.Type) : void;
        public set_connect_func (connect_func: BuilderConnectFunc, connect_data: any, connect_data_destroy: GLib.DestroyNotify) : void;
        public set_css_name (name: string) : void;
        public set_template (template_bytes: GLib.Bytes) : void;
        public set_template_from_resource (resource_name: string) : void;
    }
    
    
    
    class WidgetClassPrivate {
    
    
    }
    
    
    
    class WidgetPath {
    
    
        public append_for_widget (widget: Widget) : number;
        public append_type (_type: GObject.Type) : number;
        public append_with_siblings (siblings: WidgetPath, sibling_index: number) : number;
        public copy () : WidgetPath;
        public free () : void;
        public get_object_type () : GObject.Type;
        public has_parent (_type: GObject.Type) : boolean;
        public is_type (_type: GObject.Type) : boolean;
        public iter_add_class (pos: number, name: string) : void;
        public iter_add_region (pos: number, name: string, flags: RegionFlags) : void;
        public iter_clear_classes (pos: number) : void;
        public iter_clear_regions (pos: number) : void;
        public iter_get_name (pos: number) : string;
        public iter_get_object_name (pos: number) : string;
        public iter_get_object_type (pos: number) : GObject.Type;
        public iter_get_sibling_index (pos: number) : number;
        public iter_get_siblings (pos: number) : WidgetPath;
        public iter_get_state (pos: number) : StateFlags;
        public iter_has_class (pos: number, name: string) : boolean;
        public iter_has_name (pos: number, name: string) : boolean;
        public iter_has_qclass (pos: number, qname: GLib.Quark) : boolean;
        public iter_has_qname (pos: number, qname: GLib.Quark) : boolean;
        public iter_has_qregion (pos: number, qname: GLib.Quark, flags: RegionFlags) : boolean;
        public iter_has_region (pos: number, name: string, flags: RegionFlags) : boolean;
        public iter_list_classes (pos: number) : GLib.SList;
        public iter_list_regions (pos: number) : GLib.SList;
        public iter_remove_class (pos: number, name: string) : void;
        public iter_remove_region (pos: number, name: string) : void;
        public iter_set_name (pos: number, name: string) : void;
        public iter_set_object_name (pos: number, name: string) : void;
        public iter_set_object_type (pos: number, _type: GObject.Type) : void;
        public iter_set_state (pos: number, state: StateFlags) : void;
        public length () : number;
        public prepend_type (_type: GObject.Type) : void;
        public ref () : WidgetPath;
        public to_string () : string;
        public unref () : void;
    }
    
    
    
    class WidgetPrivate {
    
    
    }
    
    
    
    class WindowAccessibleClass {
        public parent_class: ContainerAccessibleClass;
    
    
    }
    
    
    
    class WindowAccessiblePrivate {
    
    
    }
    
    
    
    class WindowClass {
        public parent_class: BinClass;
    
        set_focus : {(window: Window, focus: Widget) : void;};
        activate_focus : {(window: Window) : void;};
        activate_default : {(window: Window) : void;};
        keys_changed : {(window: Window) : void;};
        enable_debugging : {(window: Window, toggle: boolean) : boolean;};
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
    
    }
    
    
    
    class WindowGeometryInfo {
    
    
    }
    
    
    
    class WindowGroupClass {
        public parent_class: GObject.ObjectClass;
    
        _gtk_reserved1 : {() : void;};
        _gtk_reserved2 : {() : void;};
        _gtk_reserved3 : {() : void;};
        _gtk_reserved4 : {() : void;};
    
    }
    
    
    
    class WindowGroupPrivate {
    
    
    }
    
    
    
    class WindowPrivate {
    
    
    }
    
    
    
    class _MountOperationHandler {
    
    
    }
    
    
    
    class _MountOperationHandlerIface {
        public parent_iface: GObject.TypeInterface;
    
        handle_ask_password : {(object: undefined, invocation: Gio.DBusMethodInvocation, arg_id: string, arg_message: string, arg_icon_name: string, arg_default_user: string, arg_default_domain: string, arg_flags: number) : boolean;};
        handle_ask_question : {(object: undefined, invocation: Gio.DBusMethodInvocation, arg_id: string, arg_message: string, arg_icon_name: string, arg_choices: string) : boolean;};
        handle_close : {(object: undefined, invocation: Gio.DBusMethodInvocation) : boolean;};
        handle_show_processes : {(object: undefined, invocation: Gio.DBusMethodInvocation, arg_id: string, arg_message: string, arg_icon_name: string, arg_application_pids: GLib.Variant, arg_choices: string) : boolean;};
    
    }
    
    
    
    class _MountOperationHandlerProxy {
        public parent_instance: Gio.DBusProxy;
        public priv: undefined;
    
    
    }
    
    
    
    class _MountOperationHandlerProxyClass {
        public parent_class: Gio.DBusProxyClass;
    
    
    }
    
    
    
    class _MountOperationHandlerProxyPrivate {
    
    
    }
    
    
    
    class _MountOperationHandlerSkeleton {
        public parent_instance: Gio.DBusInterfaceSkeleton;
        public priv: undefined;
    
    
    }
    
    
    
    class _MountOperationHandlerSkeletonClass {
        public parent_class: Gio.DBusInterfaceSkeletonClass;
    
    
    }
    
    
    
    class _MountOperationHandlerSkeletonPrivate {
    
    
    }
    
    
    
    interface Actionable {
        get_action_name () : string;
        get_action_target_value () : GLib.Variant;
        set_action_name (action_name: string) : void;
        set_action_target (format_string: string) : void;
        set_action_target_value (target_value: GLib.Variant) : void;
        set_detailed_action_name (detailed_action_name: string) : void;
    }
    
    var Actionable: {
        
        
    }
    
    
    
    
    interface Activatable {
        do_set_related_action (action: Action) : void;
        get_related_action () : Action;
        get_use_action_appearance () : boolean;
        set_related_action (action: Action) : void;
        set_use_action_appearance (use_appearance: boolean) : void;
        sync_action_properties (action: Action) : void;
    }
    
    var Activatable: {
        
        
    }
    
    
    
    
    interface AppChooser {
        get_app_info () : Gio.AppInfo;
        get_content_type () : string;
        refresh () : void;
    }
    
    var AppChooser: {
        
        
    }
    
    
    
    
    interface Buildable {
        add_child (builder: Builder, child: GObject.Object, _type: string) : void;
        construct_child (builder: Builder, name: string) : GObject.Object;
        custom_finished (builder: Builder, child: GObject.Object, tagname: string, data: any) : void;
        custom_tag_end (builder: Builder, child: GObject.Object, tagname: string, data: any) : void;
        custom_tag_start (builder: Builder, child: GObject.Object, tagname: string, parser: GLib.MarkupParser, data: any) : boolean;
        get_internal_child (builder: Builder, childname: string) : GObject.Object;
        get_name () : string;
        parser_finished (builder: Builder) : void;
        set_buildable_property (builder: Builder, name: string, value: GObject.Value) : void;
        set_name (name: string) : void;
    }
    
    var Buildable: {
        
        
    }
    
    
    
    
    interface CellAccessibleParent {
        activate (cell: CellAccessible) : void;
        edit (cell: CellAccessible) : void;
        expand_collapse (cell: CellAccessible) : void;
        get_cell_area (cell: CellAccessible, cell_rect: Gdk.Rectangle) : void;
        get_cell_extents (cell: CellAccessible, _x: number, _y: number, width: number, height: number, coord_type: Atk.CoordType) : void;
        get_cell_position (cell: CellAccessible, _row: number, column: number) : void;
        get_child_index (cell: CellAccessible) : number;
        get_column_header_cells (cell: CellAccessible) : Atk.Object[];
        get_renderer_state (cell: CellAccessible) : CellRendererState;
        get_row_header_cells (cell: CellAccessible) : Atk.Object[];
        grab_focus (cell: CellAccessible) : boolean;
        update_relationset (cell: CellAccessible, relationset: Atk.RelationSet) : void;
    }
    
    var CellAccessibleParent: {
        
        
    }
    
    
    
    
    interface CellEditable {
        editing_done () : void;
        remove_widget () : void;
        start_editing (event: Gdk.Event) : void;
    }
    
    var CellEditable: {
        
        
    }
    
    
    
    
    interface CellLayout {
        add_attribute (cell: CellRenderer, attribute: string, column: number) : void;
        clear () : void;
        clear_attributes (cell: CellRenderer) : void;
        get_area () : CellArea;
        get_cells () : GLib.List;
        pack_end (cell: CellRenderer, expand: boolean) : void;
        pack_start (cell: CellRenderer, expand: boolean) : void;
        reorder (cell: CellRenderer, position: number) : void;
        set_attributes (cell: CellRenderer) : void;
        set_cell_data_func (cell: CellRenderer, _func: CellLayoutDataFunc, func_data: any, destroy: GLib.DestroyNotify) : void;
    }
    
    var CellLayout: {
        
        
    }
    
    
    
    
    interface ColorChooser {
        add_palette (orientation: Orientation, colors_per_line: number, n_colors: number, colors: Gdk.RGBA[]) : void;
        get_rgba (color: Gdk.RGBA) : void;
        get_use_alpha () : boolean;
        set_rgba (color: Gdk.RGBA) : void;
        set_use_alpha (use_alpha: boolean) : void;
    }
    
    var ColorChooser: {
        
        
    }
    
    
    
    
    interface Editable {
        copy_clipboard () : void;
        cut_clipboard () : void;
        delete_selection () : void;
        delete_text (start_pos: number, end_pos: number) : void;
        get_chars (start_pos: number, end_pos: number) : string;
        get_editable () : boolean;
        get_position () : number;
        get_selection_bounds (start_pos: number, end_pos: number) : boolean;
        insert_text (new_text: string, new_text_length: number, position: number) : void;
        paste_clipboard () : void;
        select_region (start_pos: number, end_pos: number) : void;
        set_editable (is_editable: boolean) : void;
        set_position (position: number) : void;
    }
    
    var Editable: {
        
        
    }
    
    
    
    
    interface FileChooser {
        add_choice (_id: string, label: string, options: string[], option_labels: string[]) : void;
        add_filter (filter: FileFilter) : void;
        add_shortcut_folder (folder: string) : boolean;
        add_shortcut_folder_uri (uri: string) : boolean;
        get_action () : FileChooserAction;
        get_choice (_id: string) : string;
        get_create_folders () : boolean;
        get_current_folder () : string;
        get_current_folder_file () : Gio.File;
        get_current_folder_uri () : string;
        get_current_name () : string;
        get_do_overwrite_confirmation () : boolean;
        get_extra_widget () : Widget;
        get_file () : Gio.File;
        get_filename () : string;
        get_filenames () : GLib.SList;
        get_files () : GLib.SList;
        get_filter () : FileFilter;
        get_local_only () : boolean;
        get_preview_file () : Gio.File;
        get_preview_filename () : string;
        get_preview_uri () : string;
        get_preview_widget () : Widget;
        get_preview_widget_active () : boolean;
        get_select_multiple () : boolean;
        get_show_hidden () : boolean;
        get_uri () : string;
        get_uris () : GLib.SList;
        get_use_preview_label () : boolean;
        list_filters () : GLib.SList;
        list_shortcut_folder_uris () : GLib.SList;
        list_shortcut_folders () : GLib.SList;
        remove_choice (_id: string) : void;
        remove_filter (filter: FileFilter) : void;
        remove_shortcut_folder (folder: string) : boolean;
        remove_shortcut_folder_uri (uri: string) : boolean;
        select_all () : void;
        select_file (file: Gio.File) : boolean;
        select_filename (filename: string) : boolean;
        select_uri (uri: string) : boolean;
        set_action (action: FileChooserAction) : void;
        set_choice (_id: string, option: string) : void;
        set_create_folders (create_folders: boolean) : void;
        set_current_folder (filename: string) : boolean;
        set_current_folder_file (file: Gio.File) : boolean;
        set_current_folder_uri (uri: string) : boolean;
        set_current_name (name: string) : void;
        set_do_overwrite_confirmation (do_overwrite_confirmation: boolean) : void;
        set_extra_widget (extra_widget: Widget) : void;
        set_file (file: Gio.File) : boolean;
        set_filename (filename: string) : boolean;
        set_filter (filter: FileFilter) : void;
        set_local_only (local_only: boolean) : void;
        set_preview_widget (preview_widget: Widget) : void;
        set_preview_widget_active (active: boolean) : void;
        set_select_multiple (select_multiple: boolean) : void;
        set_show_hidden (show_hidden: boolean) : void;
        set_uri (uri: string) : boolean;
        set_use_preview_label (use_label: boolean) : void;
        unselect_all () : void;
        unselect_file (file: Gio.File) : void;
        unselect_filename (filename: string) : void;
        unselect_uri (uri: string) : void;
    }
    
    var FileChooser: {
        
        
    }
    
    
    
    
    interface FontChooser {
        get_font () : string;
        get_font_desc () : Pango.FontDescription;
        get_font_face () : Pango.FontFace;
        get_font_family () : Pango.FontFamily;
        get_font_features () : string;
        get_font_map () : Pango.FontMap;
        get_font_size () : number;
        get_language () : string;
        get_level () : FontChooserLevel;
        get_preview_text () : string;
        get_show_preview_entry () : boolean;
        set_filter_func (filter: FontFilterFunc, user_data: any, destroy: GLib.DestroyNotify) : void;
        set_font (fontname: string) : void;
        set_font_desc (font_desc: Pango.FontDescription) : void;
        set_font_map (fontmap: Pango.FontMap) : void;
        set_language (language: string) : void;
        set_level (level: FontChooserLevel) : void;
        set_preview_text (text: string) : void;
        set_show_preview_entry (show_preview_entry: boolean) : void;
    }
    
    var FontChooser: {
        
        
    }
    
    
    
    
    interface Orientable {
        get_orientation () : Orientation;
        set_orientation (orientation: Orientation) : void;
    }
    
    var Orientable: {
        
        
    }
    
    
    
    
    interface PrintOperationPreview {
        end_preview () : void;
        is_selected (page_nr: number) : boolean;
        render_page (page_nr: number) : void;
    }
    
    var PrintOperationPreview: {
        
        
    }
    
    
    
    
    interface RecentChooser {
        add_filter (filter: RecentFilter) : void;
        get_current_item () : RecentInfo;
        get_current_uri () : string;
        get_filter () : RecentFilter;
        get_items () : GLib.List;
        get_limit () : number;
        get_local_only () : boolean;
        get_select_multiple () : boolean;
        get_show_icons () : boolean;
        get_show_not_found () : boolean;
        get_show_private () : boolean;
        get_show_tips () : boolean;
        get_sort_type () : RecentSortType;
        get_uris (length: number) : string[];
        list_filters () : GLib.SList;
        remove_filter (filter: RecentFilter) : void;
        select_all () : void;
        select_uri (uri: string) : boolean;
        set_current_uri (uri: string) : boolean;
        set_filter (filter: RecentFilter) : void;
        set_limit (limit: number) : void;
        set_local_only (local_only: boolean) : void;
        set_select_multiple (select_multiple: boolean) : void;
        set_show_icons (show_icons: boolean) : void;
        set_show_not_found (show_not_found: boolean) : void;
        set_show_private (show_private: boolean) : void;
        set_show_tips (show_tips: boolean) : void;
        set_sort_func (sort_func: RecentSortFunc, sort_data: any, data_destroy: GLib.DestroyNotify) : void;
        set_sort_type (sort_type: RecentSortType) : void;
        unselect_all () : void;
        unselect_uri (uri: string) : void;
    }
    
    var RecentChooser: {
        
        
    }
    
    
    
    
    interface Scrollable {
        get_border (border: Border) : boolean;
        get_hadjustment () : Adjustment;
        get_hscroll_policy () : ScrollablePolicy;
        get_vadjustment () : Adjustment;
        get_vscroll_policy () : ScrollablePolicy;
        set_hadjustment (hadjustment: Adjustment) : void;
        set_hscroll_policy (policy: ScrollablePolicy) : void;
        set_vadjustment (vadjustment: Adjustment) : void;
        set_vscroll_policy (policy: ScrollablePolicy) : void;
    }
    
    var Scrollable: {
        
        
    }
    
    
    
    
    interface StyleProvider {
        get_icon_factory (path: WidgetPath) : IconFactory;
        get_style (path: WidgetPath) : StyleProperties;
        get_style_property (path: WidgetPath, state: StateFlags, pspec: GObject.ParamSpec, value: GObject.Value) : boolean;
    }
    
    var StyleProvider: {
        
        
    }
    
    
    
    
    interface ToolShell {
        get_ellipsize_mode () : Pango.EllipsizeMode;
        get_icon_size () : number;
        get_orientation () : Orientation;
        get_relief_style () : ReliefStyle;
        get_style () : ToolbarStyle;
        get_text_alignment () : number;
        get_text_orientation () : Orientation;
        get_text_size_group () : SizeGroup;
        rebuild_menu () : void;
    }
    
    var ToolShell: {
        
        
    }
    
    
    
    
    interface TreeDragDest {
        drag_data_received (dest: TreePath, selection_data: SelectionData) : boolean;
        row_drop_possible (dest_path: TreePath, selection_data: SelectionData) : boolean;
    }
    
    var TreeDragDest: {
        
        
    }
    
    
    
    
    interface TreeDragSource {
        drag_data_delete (path: TreePath) : boolean;
        drag_data_get (path: TreePath, selection_data: SelectionData) : boolean;
        row_draggable (path: TreePath) : boolean;
    }
    
    var TreeDragSource: {
        
        
    }
    
    
    
    
    interface TreeModel {
        filter_new (root: TreePath) : TreeModel;
        foreach (_func: TreeModelForeachFunc, user_data: any) : void;
        get (iter: TreeIter) : void;
        get_column_type (index_: number) : GObject.Type;
        get_flags () : TreeModelFlags;
        get_iter (iter: TreeIter, path: TreePath) : boolean;
        get_iter_first (iter: TreeIter) : boolean;
        get_iter_from_string (iter: TreeIter, path_string: string) : boolean;
        get_n_columns () : number;
        get_path (iter: TreeIter) : TreePath;
        get_string_from_iter (iter: TreeIter) : string;
        get_valist (iter: TreeIter, var_args: any[]) : void;
        get_value (iter: TreeIter, column: number, value: GObject.Value) : void;
        iter_children (iter: TreeIter, parent: TreeIter) : boolean;
        iter_has_child (iter: TreeIter) : boolean;
        iter_n_children (iter: TreeIter) : number;
        iter_next (iter: TreeIter) : boolean;
        iter_nth_child (iter: TreeIter, parent: TreeIter, _n: number) : boolean;
        iter_parent (iter: TreeIter, child: TreeIter) : boolean;
        iter_previous (iter: TreeIter) : boolean;
        ref_node (iter: TreeIter) : void;
        row_changed (path: TreePath, iter: TreeIter) : void;
        row_deleted (path: TreePath) : void;
        row_has_child_toggled (path: TreePath, iter: TreeIter) : void;
        row_inserted (path: TreePath, iter: TreeIter) : void;
        rows_reordered (path: TreePath, iter: TreeIter, new_order: number) : void;
        rows_reordered_with_length (path: TreePath, iter: TreeIter, new_order: number[], length: number) : void;
        sort_new_with_model () : TreeModel;
        unref_node (iter: TreeIter) : void;
    }
    
    var TreeModel: {
        
        
    }
    
    
    
    
    interface TreeSortable {
        get_sort_column_id (sort_column_id: number, order: SortType) : boolean;
        has_default_sort_func () : boolean;
        set_default_sort_func (sort_func: TreeIterCompareFunc, user_data: any, destroy: GLib.DestroyNotify) : void;
        set_sort_column_id (sort_column_id: number, order: SortType) : void;
        set_sort_func (sort_column_id: number, sort_func: TreeIterCompareFunc, user_data: any, destroy: GLib.DestroyNotify) : void;
        sort_column_changed () : void;
    }
    
    var TreeSortable: {
        
        
    }
    
    
    
    
    enum Align {
        fill = 0,
        start = 1,
        end = 2,
        center = 3,
        baseline = 4
    }
    
    
    
    enum ArrowPlacement {
        both = 0,
        start = 1,
        end = 2
    }
    
    
    
    enum ArrowType {
        up = 0,
        down = 1,
        left = 2,
        right = 3,
        none = 4
    }
    
    
    
    enum AssistantPageType {
        content = 0,
        intro = 1,
        confirm = 2,
        summary = 3,
        progress = 4,
        custom = 5
    }
    
    
    
    enum BaselinePosition {
        top = 0,
        center = 1,
        bottom = 2
    }
    
    
    
    enum BorderStyle {
        none = 0,
        solid = 1,
        inset = 2,
        outset = 3,
        hidden = 4,
        dotted = 5,
        dashed = 6,
        double = 7,
        groove = 8,
        ridge = 9
    }
    
    
    
    enum BuilderError {
        invalid_type_function = 0,
        unhandled_tag = 1,
        missing_attribute = 2,
        invalid_attribute = 3,
        invalid_tag = 4,
        missing_property_value = 5,
        invalid_value = 6,
        version_mismatch = 7,
        duplicate_id = 8,
        object_type_refused = 9,
        template_mismatch = 10,
        invalid_property = 11,
        invalid_signal = 12,
        invalid_id = 13
    }
    
    
    
    enum ButtonBoxStyle {
        spread = 1,
        edge = 2,
        start = 3,
        end = 4,
        center = 5,
        expand = 6
    }
    
    
    
    enum ButtonRole {
        normal = 0,
        check = 1,
        radio = 2
    }
    
    
    
    enum ButtonsType {
        none = 0,
        ok = 1,
        close = 2,
        cancel = 3,
        yes_no = 4,
        ok_cancel = 5
    }
    
    
    
    enum CellRendererAccelMode {
        gtk = 0,
        other = 1
    }
    
    
    
    enum CellRendererMode {
        inert = 0,
        activatable = 1,
        editable = 2
    }
    
    
    
    enum CornerType {
        top_left = 0,
        bottom_left = 1,
        top_right = 2,
        bottom_right = 3
    }
    
    
    
    enum CssProviderError {
        failed = 0,
        syntax = 1,
        import = 2,
        name = 3,
        deprecated = 4,
        unknown_value = 5
    }
    
    
    
    enum CssSectionType {
        document = 0,
        import = 1,
        color_definition = 2,
        binding_set = 3,
        ruleset = 4,
        selector = 5,
        declaration = 6,
        value = 7,
        keyframes = 8
    }
    
    
    
    enum DeleteType {
        chars = 0,
        word_ends = 1,
        words = 2,
        display_lines = 3,
        display_line_ends = 4,
        paragraph_ends = 5,
        paragraphs = 6,
        whitespace = 7
    }
    
    
    
    enum DirectionType {
        TAB_FORWARD = 0,
        TAB_BACKWARD = 1,
        UP = 2,
        DOWN = 3,
        LEFT = 4,
        RIGHT = 5
    }
    
    
    
    enum DragResult {
        success = 0,
        no_target = 1,
        user_cancelled = 2,
        timeout_expired = 3,
        grab_broken = 4,
        error = 5
    }
    
    
    
    enum EntryIconPosition {
        primary = 0,
        secondary = 1
    }
    
    
    
    enum EventSequenceState {
        none = 0,
        claimed = 1,
        denied = 2
    }
    
    
    
    enum ExpanderStyle {
        collapsed = 0,
        semi_collapsed = 1,
        semi_expanded = 2,
        expanded = 3
    }
    
    
    
    enum FileChooserAction {
        open = 0,
        save = 1,
        select_folder = 2,
        create_folder = 3
    }
    
    
    
    enum FileChooserConfirmation {
        confirm = 0,
        accept_filename = 1,
        select_again = 2
    }
    
    
    
    enum FileChooserError {
        nonexistent = 0,
        bad_filename = 1,
        already_exists = 2,
        incomplete_hostname = 3
    }
    
    
    
    enum IMPreeditStyle {
        nothing = 0,
        callback = 1,
        none = 2
    }
    
    
    
    enum IMStatusStyle {
        nothing = 0,
        callback = 1,
        none = 2
    }
    
    
    
    enum IconSize {
        invalid = 0,
        menu = 1,
        small_toolbar = 2,
        large_toolbar = 3,
        button = 4,
        dnd = 5,
        dialog = 6
    }
    
    
    
    enum IconThemeError {
        not_found = 0,
        failed = 1
    }
    
    
    
    enum IconViewDropPosition {
        no_drop = 0,
        drop_into = 1,
        drop_left = 2,
        drop_right = 3,
        drop_above = 4,
        drop_below = 5
    }
    
    
    
    enum ImageType {
        empty = 0,
        pixbuf = 1,
        stock = 2,
        icon_set = 3,
        animation = 4,
        icon_name = 5,
        gicon = 6,
        surface = 7
    }
    
    
    
    enum InputPurpose {
        free_form = 0,
        alpha = 1,
        digits = 2,
        number = 3,
        phone = 4,
        url = 5,
        email = 6,
        name = 7,
        password = 8,
        pin = 9
    }
    
    
    
    enum Justification {
        left = 0,
        right = 1,
        center = 2,
        fill = 3
    }
    
    
    
    enum LevelBarMode {
        continuous = 0,
        discrete = 1
    }
    
    
    
    enum License {
        unknown = 0,
        custom = 1,
        gpl_2_0 = 2,
        gpl_3_0 = 3,
        lgpl_2_1 = 4,
        lgpl_3_0 = 5,
        bsd = 6,
        mit_x11 = 7,
        artistic = 8,
        gpl_2_0_only = 9,
        gpl_3_0_only = 10,
        lgpl_2_1_only = 11,
        lgpl_3_0_only = 12,
        agpl_3_0 = 13,
        agpl_3_0_only = 14
    }
    
    
    
    enum MenuDirectionType {
        parent = 0,
        child = 1,
        next = 2,
        prev = 3
    }
    
    
    
    enum MessageType {
        info = 0,
        warning = 1,
        question = 2,
        error = 3,
        other = 4
    }
    
    
    
    enum MovementStep {
        logical_positions = 0,
        visual_positions = 1,
        words = 2,
        display_lines = 3,
        display_line_ends = 4,
        paragraphs = 5,
        paragraph_ends = 6,
        pages = 7,
        buffer_ends = 8,
        horizontal_pages = 9
    }
    
    
    
    enum NotebookTab {
        first = 0,
        last = 1
    }
    
    
    
    enum NumberUpLayout {
        lrtb = 0,
        lrbt = 1,
        rltb = 2,
        rlbt = 3,
        tblr = 4,
        tbrl = 5,
        btlr = 6,
        btrl = 7
    }
    
    
    
    enum Orientation {
        horizontal = 0,
        vertical = 1
    }
    
    
    
    enum PackDirection {
        ltr = 0,
        rtl = 1,
        ttb = 2,
        btt = 3
    }
    
    
    
    enum PackType {
        start = 0,
        end = 1
    }
    
    
    
    enum PadActionType {
        button = 0,
        ring = 1,
        strip = 2
    }
    
    
    
    enum PageOrientation {
        portrait = 0,
        landscape = 1,
        reverse_portrait = 2,
        reverse_landscape = 3
    }
    
    
    
    enum PageSet {
        all = 0,
        even = 1,
        odd = 2
    }
    
    
    
    enum PanDirection {
        left = 0,
        right = 1,
        up = 2,
        down = 3
    }
    
    
    
    enum PathPriorityType {
        lowest = 0,
        gtk = 4,
        application = 8,
        theme = 10,
        rc = 12,
        highest = 15
    }
    
    
    
    enum PathType {
        widget = 0,
        widget_class = 1,
        class = 2
    }
    
    
    
    enum PolicyType {
        ALWAYS = 0,
        AUTOMATIC = 1,
        NEVER = 2,
        EXTERNAL = 3
    }
    
    
    
    enum PopoverConstraint {
        none = 0,
        window = 1
    }
    
    
    
    enum PositionType {
        left = 0,
        right = 1,
        top = 2,
        bottom = 3
    }
    
    
    
    enum PrintDuplex {
        simplex = 0,
        horizontal = 1,
        vertical = 2
    }
    
    
    
    enum PrintError {
        general = 0,
        internal_error = 1,
        nomem = 2,
        invalid_file = 3
    }
    
    
    
    enum PrintOperationAction {
        print_dialog = 0,
        print = 1,
        preview = 2,
        export = 3
    }
    
    
    
    enum PrintOperationResult {
        error = 0,
        apply = 1,
        cancel = 2,
        in_progress = 3
    }
    
    
    
    enum PrintPages {
        all = 0,
        current = 1,
        ranges = 2,
        selection = 3
    }
    
    
    
    enum PrintQuality {
        low = 0,
        normal = 1,
        high = 2,
        draft = 3
    }
    
    
    
    enum PrintStatus {
        initial = 0,
        preparing = 1,
        generating_data = 2,
        sending_data = 3,
        pending = 4,
        pending_issue = 5,
        printing = 6,
        finished = 7,
        finished_aborted = 8
    }
    
    
    
    enum PropagationPhase {
        none = 0,
        capture = 1,
        bubble = 2,
        target = 3
    }
    
    
    
    enum RcTokenType {
        invalid = 270,
        include = 271,
        normal = 272,
        active = 273,
        prelight = 274,
        selected = 275,
        insensitive = 276,
        fg = 277,
        bg = 278,
        text = 279,
        base = 280,
        xthickness = 281,
        ythickness = 282,
        font = 283,
        fontset = 284,
        font_name = 285,
        bg_pixmap = 286,
        pixmap_path = 287,
        style = 288,
        binding = 289,
        bind = 290,
        widget = 291,
        widget_class = 292,
        class = 293,
        lowest = 294,
        gtk = 295,
        application = 296,
        theme = 297,
        rc = 298,
        highest = 299,
        engine = 300,
        module_path = 301,
        im_module_path = 302,
        im_module_file = 303,
        stock = 304,
        ltr = 305,
        rtl = 306,
        color = 307,
        unbind = 308,
        last = 309
    }
    
    
    
    enum RecentChooserError {
        not_found = 0,
        invalid_uri = 1
    }
    
    
    
    enum RecentManagerError {
        not_found = 0,
        invalid_uri = 1,
        invalid_encoding = 2,
        not_registered = 3,
        read = 4,
        write = 5,
        unknown = 6
    }
    
    
    
    enum RecentSortType {
        none = 0,
        mru = 1,
        lru = 2,
        custom = 3
    }
    
    
    
    enum ReliefStyle {
        normal = 0,
        half = 1,
        none = 2
    }
    
    
    
    enum ResizeMode {
        parent = 0,
        queue = 1,
        immediate = 2
    }
    
    
    
    enum ResponseType {
        none = -1,
        reject = -2,
        accept = -3,
        delete_event = -4,
        ok = -5,
        cancel = -6,
        close = -7,
        yes = -8,
        no = -9,
        apply = -10,
        help = -11
    }
    
    
    
    enum RevealerTransitionType {
        none = 0,
        crossfade = 1,
        slide_right = 2,
        slide_left = 3,
        slide_up = 4,
        slide_down = 5
    }
    
    
    
    enum ScrollStep {
        steps = 0,
        pages = 1,
        ends = 2,
        horizontal_steps = 3,
        horizontal_pages = 4,
        horizontal_ends = 5
    }
    
    
    
    enum ScrollType {
        none = 0,
        jump = 1,
        step_backward = 2,
        step_forward = 3,
        page_backward = 4,
        page_forward = 5,
        step_up = 6,
        step_down = 7,
        page_up = 8,
        page_down = 9,
        step_left = 10,
        step_right = 11,
        page_left = 12,
        page_right = 13,
        start = 14,
        end = 15
    }
    
    
    
    enum ScrollablePolicy {
        minimum = 0,
        natural = 1
    }
    
    
    
    enum SelectionMode {
        none = 0,
        single = 1,
        browse = 2,
        multiple = 3
    }
    
    
    
    enum SensitivityType {
        auto = 0,
        on = 1,
        off = 2
    }
    
    
    
    enum ShadowType {
        none = 0,
        in = 1,
        out = 2,
        etched_in = 3,
        etched_out = 4
    }
    
    
    
    enum ShortcutType {
        accelerator = 0,
        gesture_pinch = 1,
        gesture_stretch = 2,
        gesture_rotate_clockwise = 3,
        gesture_rotate_counterclockwise = 4,
        gesture_two_finger_swipe_left = 5,
        gesture_two_finger_swipe_right = 6,
        gesture = 7
    }
    
    
    
    enum SizeGroupMode {
        none = 0,
        horizontal = 1,
        vertical = 2,
        both = 3
    }
    
    
    
    enum SizeRequestMode {
        height_for_width = 0,
        width_for_height = 1,
        constant_size = 2
    }
    
    
    
    enum SortType {
        ascending = 0,
        descending = 1
    }
    
    
    
    enum SpinButtonUpdatePolicy {
        always = 0,
        if_valid = 1
    }
    
    
    
    enum SpinType {
        step_forward = 0,
        step_backward = 1,
        page_forward = 2,
        page_backward = 3,
        home = 4,
        end = 5,
        user_defined = 6
    }
    
    
    
    enum StackTransitionType {
        none = 0,
        crossfade = 1,
        slide_right = 2,
        slide_left = 3,
        slide_up = 4,
        slide_down = 5,
        slide_left_right = 6,
        slide_up_down = 7,
        over_up = 8,
        over_down = 9,
        over_left = 10,
        over_right = 11,
        under_up = 12,
        under_down = 13,
        under_left = 14,
        under_right = 15,
        over_up_down = 16,
        over_down_up = 17,
        over_left_right = 18,
        over_right_left = 19
    }
    
    
    
    enum StateType {
        normal = 0,
        active = 1,
        prelight = 2,
        selected = 3,
        insensitive = 4,
        inconsistent = 5,
        focused = 6
    }
    
    
    
    enum TextBufferTargetInfo {
        buffer_contents = -1,
        rich_text = -2,
        text = -3
    }
    
    
    
    enum TextDirection {
        none = 0,
        ltr = 1,
        rtl = 2
    }
    
    
    
    enum TextExtendSelection {
        word = 0,
        line = 1
    }
    
    
    
    enum TextViewLayer {
        below = 0,
        above = 1,
        below_text = 2,
        above_text = 3
    }
    
    
    
    enum TextWindowType {
        private = 0,
        widget = 1,
        text = 2,
        left = 3,
        right = 4,
        top = 5,
        bottom = 6
    }
    
    
    
    enum ToolbarSpaceStyle {
        empty = 0,
        line = 1
    }
    
    
    
    enum ToolbarStyle {
        icons = 0,
        text = 1,
        both = 2,
        both_horiz = 3
    }
    
    
    
    enum TreeViewColumnSizing {
        grow_only = 0,
        autosize = 1,
        fixed = 2
    }
    
    
    
    enum TreeViewDropPosition {
        before = 0,
        after = 1,
        into_or_before = 2,
        into_or_after = 3
    }
    
    
    
    enum TreeViewGridLines {
        none = 0,
        horizontal = 1,
        vertical = 2,
        both = 3
    }
    
    
    
    enum Unit {
        none = 0,
        points = 1,
        inch = 2,
        mm = 3
    }
    
    
    
    enum WidgetHelpType {
        tooltip = 0,
        whats_this = 1
    }
    
    
    
    enum WindowPosition {
        none = 0,
        center = 1,
        mouse = 2,
        center_always = 3,
        center_on_parent = 4
    }
    
    
    
    enum WindowType {
        toplevel = 0,
        popup = 1
    }
    
    
    
    enum WrapMode {
        none = 0,
        char = 1,
        word = 2,
        word_char = 3
    }
    
    
    
    enum AccelFlags {
        visible = 1,
        locked = 2,
        mask = 7
    }
    
    
    
    enum ApplicationInhibitFlags {
        logout = 1,
        switch = 2,
        suspend = 4,
        idle = 8
    }
    
    
    
    enum AttachOptions {
        expand = 1,
        shrink = 2,
        fill = 4
    }
    
    
    
    enum CalendarDisplayOptions {
        show_heading = 1,
        show_day_names = 2,
        no_month_change = 4,
        show_week_numbers = 8,
        show_details = 32
    }
    
    
    
    enum CellRendererState {
        selected = 1,
        prelit = 2,
        insensitive = 4,
        sorted = 8,
        focused = 16,
        expandable = 32,
        expanded = 64
    }
    
    
    
    enum DebugFlag {
        misc = 1,
        plugsocket = 2,
        text = 4,
        tree = 8,
        updates = 16,
        keybindings = 32,
        multihead = 64,
        modules = 128,
        geometry = 256,
        icontheme = 512,
        printing = 1024,
        builder = 2048,
        size_request = 4096,
        no_css_cache = 8192,
        baselines = 16384,
        pixel_cache = 32768,
        no_pixel_cache = 65536,
        interactive = 131072,
        touchscreen = 262144,
        actions = 524288,
        resize = 1048576,
        layout = 2097152
    }
    
    
    
    enum DestDefaults {
        motion = 1,
        highlight = 2,
        drop = 4,
        all = 7
    }
    
    
    
    enum DialogFlags {
        modal = 1,
        destroy_with_parent = 2,
        use_header_bar = 4
    }
    
    
    
    enum EventControllerScrollFlags {
        none = 0,
        vertical = 1,
        horizontal = 2,
        discrete = 4,
        kinetic = 8,
        both_axes = 3
    }
    
    
    
    enum FileFilterFlags {
        filename = 1,
        uri = 2,
        display_name = 4,
        mime_type = 8
    }
    
    
    
    enum FontChooserLevel {
        family = 0,
        style = 1,
        size = 2,
        variations = 4,
        features = 8
    }
    
    
    
    enum IconLookupFlags {
        no_svg = 1,
        force_svg = 2,
        use_builtin = 4,
        generic_fallback = 8,
        force_size = 16,
        force_regular = 32,
        force_symbolic = 64,
        dir_ltr = 128,
        dir_rtl = 256
    }
    
    
    
    enum InputHints {
        none = 0,
        spellcheck = 1,
        no_spellcheck = 2,
        word_completion = 4,
        lowercase = 8,
        uppercase_chars = 16,
        uppercase_words = 32,
        uppercase_sentences = 64,
        inhibit_osk = 128,
        vertical_writing = 256,
        emoji = 512,
        no_emoji = 1024
    }
    
    
    
    enum JunctionSides {
        none = 0,
        corner_topleft = 1,
        corner_topright = 2,
        corner_bottomleft = 4,
        corner_bottomright = 8,
        top = 3,
        bottom = 12,
        left = 5,
        right = 10
    }
    
    
    
    enum PlacesOpenFlags {
        normal = 1,
        new_tab = 2,
        new_window = 4
    }
    
    
    
    enum RcFlags {
        fg = 1,
        bg = 2,
        text = 4,
        base = 8
    }
    
    
    
    enum RecentFilterFlags {
        uri = 1,
        display_name = 2,
        mime_type = 4,
        application = 8,
        group = 16,
        age = 32
    }
    
    
    
    enum RegionFlags {
        even = 1,
        odd = 2,
        first = 4,
        last = 8,
        only = 16,
        sorted = 32
    }
    
    
    
    enum StateFlags {
        normal = 0,
        active = 1,
        prelight = 2,
        selected = 4,
        insensitive = 8,
        inconsistent = 16,
        focused = 32,
        backdrop = 64,
        dir_ltr = 128,
        dir_rtl = 256,
        link = 512,
        visited = 1024,
        checked = 2048,
        drop_active = 4096
    }
    
    
    
    enum StyleContextPrintFlags {
        none = 0,
        recurse = 1,
        show_style = 2
    }
    
    
    
    enum TargetFlags {
        same_app = 1,
        same_widget = 2,
        other_app = 4,
        other_widget = 8
    }
    
    
    
    enum TextSearchFlags {
        visible_only = 1,
        text_only = 2,
        case_insensitive = 4
    }
    
    
    
    enum ToolPaletteDragTargets {
        items = 1,
        groups = 2
    }
    
    
    
    enum TreeModelFlags {
        iters_persist = 1,
        list_only = 2
    }
    
    
    
    enum UIManagerItemType {
        auto = 0,
        menubar = 1,
        menu = 2,
        toolbar = 4,
        placeholder = 8,
        popup = 16,
        menuitem = 32,
        toolitem = 64,
        separator = 128,
        accelerator = 256,
        popup_with_accels = 512
    }
    
    
    
    interface AccelGroupActivate {
        (accel_group: AccelGroup, acceleratable: GObject.Object, keyval: number, modifier: Gdk.ModifierType) : boolean;
    }
    
    
    
    interface AccelGroupFindFunc {
        (key: AccelKey, closure: GObject.Closure, data: any) : boolean;
    }
    
    
    
    interface AccelMapForeach {
        (data: any, accel_path: string, accel_key: number, accel_mods: Gdk.ModifierType, changed: boolean) : void;
    }
    
    
    
    interface AssistantPageFunc {
        (current_page: number, data: any) : number;
    }
    
    
    
    interface BuilderConnectFunc {
        (builder: Builder, object: GObject.Object, signal_name: string, handler_name: string, connect_object: GObject.Object, flags: GObject.ConnectFlags, user_data: any) : void;
    }
    
    
    
    interface CalendarDetailFunc {
        (calendar: Calendar, year: number, month: number, day: number, user_data: any) : string;
    }
    
    
    
    interface Callback {
        (widget: Widget, data: any) : void;
    }
    
    
    
    interface CellAllocCallback {
        (renderer: CellRenderer, cell_area: Gdk.Rectangle, cell_background: Gdk.Rectangle, data: any) : boolean;
    }
    
    
    
    interface CellCallback {
        (renderer: CellRenderer, data: any) : boolean;
    }
    
    
    
    interface CellLayoutDataFunc {
        (cell_layout: CellLayout, cell: CellRenderer, tree_model: TreeModel, iter: TreeIter, data: any) : void;
    }
    
    
    
    interface ClipboardClearFunc {
        (clipboard: Clipboard, user_data_or_owner: any) : void;
    }
    
    
    
    interface ClipboardGetFunc {
        (clipboard: Clipboard, selection_data: SelectionData, info: number, user_data_or_owner: any) : void;
    }
    
    
    
    interface ClipboardImageReceivedFunc {
        (clipboard: Clipboard, pixbuf: GdkPixbuf.Pixbuf, data: any) : void;
    }
    
    
    
    interface ClipboardReceivedFunc {
        (clipboard: Clipboard, selection_data: SelectionData, data: any) : void;
    }
    
    
    
    interface ClipboardRichTextReceivedFunc {
        (clipboard: Clipboard, format: Gdk.Atom, text: string, length: number, data: any) : void;
    }
    
    
    
    interface ClipboardTargetsReceivedFunc {
        (clipboard: Clipboard, atoms: Gdk.Atom[], n_atoms: number, data: any) : void;
    }
    
    
    
    interface ClipboardTextReceivedFunc {
        (clipboard: Clipboard, text: string, data: any) : void;
    }
    
    
    
    interface ClipboardURIReceivedFunc {
        (clipboard: Clipboard, uris: string[], data: any) : void;
    }
    
    
    
    interface ColorSelectionChangePaletteFunc {
        (colors: Gdk.Color[], n_colors: number) : void;
    }
    
    
    
    interface ColorSelectionChangePaletteWithScreenFunc {
        (screen: Gdk.Screen, colors: Gdk.Color[], n_colors: number) : void;
    }
    
    
    
    interface EntryCompletionMatchFunc {
        (completion: EntryCompletion, key: string, iter: TreeIter, user_data: any) : boolean;
    }
    
    
    
    interface FileFilterFunc {
        (filter_info: FileFilterInfo, data: any) : boolean;
    }
    
    
    
    interface FlowBoxCreateWidgetFunc {
        (item: GObject.Object, user_data: any) : Widget;
    }
    
    
    
    interface FlowBoxFilterFunc {
        (child: FlowBoxChild, user_data: any) : boolean;
    }
    
    
    
    interface FlowBoxForeachFunc {
        (box: FlowBox, child: FlowBoxChild, user_data: any) : void;
    }
    
    
    
    interface FlowBoxSortFunc {
        (child1: FlowBoxChild, child2: FlowBoxChild, user_data: any) : number;
    }
    
    
    
    interface FontFilterFunc {
        (family: Pango.FontFamily, _face: Pango.FontFace, data: any) : boolean;
    }
    
    
    
    interface IconViewForeachFunc {
        (icon_view: IconView, path: TreePath, data: any) : void;
    }
    
    
    
    interface KeySnoopFunc {
        (grab_widget: Widget, event: Gdk.EventKey, func_data: any) : number;
    }
    
    
    
    interface ListBoxCreateWidgetFunc {
        (item: GObject.Object, user_data: any) : Widget;
    }
    
    
    
    interface ListBoxFilterFunc {
        (_row: ListBoxRow, user_data: any) : boolean;
    }
    
    
    
    interface ListBoxForeachFunc {
        (box: ListBox, _row: ListBoxRow, user_data: any) : void;
    }
    
    
    
    interface ListBoxSortFunc {
        (row1: ListBoxRow, row2: ListBoxRow, user_data: any) : number;
    }
    
    
    
    interface ListBoxUpdateHeaderFunc {
        (_row: ListBoxRow, before: ListBoxRow, user_data: any) : void;
    }
    
    
    
    interface MenuDetachFunc {
        (attach_widget: Widget, menu: Menu) : void;
    }
    
    
    
    interface MenuPositionFunc {
        (menu: Menu, _x: number, _y: number, push_in: boolean, user_data: any) : void;
    }
    
    
    
    interface ModuleDisplayInitFunc {
        (display: Gdk.Display) : void;
    }
    
    
    
    interface ModuleInitFunc {
        (argc: number, argv: string[]) : void;
    }
    
    
    
    interface PageSetupDoneFunc {
        (page_setup: PageSetup, data: any) : void;
    }
    
    
    
    interface PrintSettingsFunc {
        (key: string, value: string, user_data: any) : void;
    }
    
    
    
    interface RcPropertyParser {
        (pspec: GObject.ParamSpec, rc_string: GLib.String, property_value: GObject.Value) : boolean;
    }
    
    
    
    interface RecentFilterFunc {
        (filter_info: RecentFilterInfo, user_data: any) : boolean;
    }
    
    
    
    interface RecentSortFunc {
        (_a: RecentInfo, _b: RecentInfo, user_data: any) : number;
    }
    
    
    
    interface StylePropertyParser {
        (string: string, value: GObject.Value) : boolean;
    }
    
    
    
    interface TextBufferDeserializeFunc {
        (register_buffer: TextBuffer, content_buffer: TextBuffer, iter: TextIter, data: number[], length: number, create_tags: boolean, user_data: any) : boolean;
    }
    
    
    
    interface TextBufferSerializeFunc {
        (register_buffer: TextBuffer, content_buffer: TextBuffer, start: TextIter, _end: TextIter, length: number, user_data: any) : number;
    }
    
    
    
    interface TextCharPredicate {
        (_ch: string, user_data: any) : boolean;
    }
    
    
    
    interface TextTagTableForeach {
        (tag: TextTag, data: any) : void;
    }
    
    
    
    interface TickCallback {
        (widget: Widget, frame_clock: Gdk.FrameClock, user_data: any) : boolean;
    }
    
    
    
    interface TranslateFunc {
        (path: string, func_data: any) : string;
    }
    
    
    
    interface TreeCellDataFunc {
        (tree_column: TreeViewColumn, cell: CellRenderer, tree_model: TreeModel, iter: TreeIter, data: any) : void;
    }
    
    
    
    interface TreeDestroyCountFunc {
        (tree_view: TreeView, path: TreePath, children: number, user_data: any) : void;
    }
    
    
    
    interface TreeIterCompareFunc {
        (model: TreeModel, _a: TreeIter, _b: TreeIter, user_data: any) : number;
    }
    
    
    
    interface TreeModelFilterModifyFunc {
        (model: TreeModel, iter: TreeIter, value: GObject.Value, column: number, data: any) : void;
    }
    
    
    
    interface TreeModelFilterVisibleFunc {
        (model: TreeModel, iter: TreeIter, data: any) : boolean;
    }
    
    
    
    interface TreeModelForeachFunc {
        (model: TreeModel, path: TreePath, iter: TreeIter, data: any) : boolean;
    }
    
    
    
    interface TreeSelectionForeachFunc {
        (model: TreeModel, path: TreePath, iter: TreeIter, data: any) : void;
    }
    
    
    
    interface TreeSelectionFunc {
        (selection: TreeSelection, model: TreeModel, path: TreePath, path_currently_selected: boolean, data: any) : boolean;
    }
    
    
    
    interface TreeViewColumnDropFunc {
        (tree_view: TreeView, column: TreeViewColumn, prev_column: TreeViewColumn, next_column: TreeViewColumn, data: any) : boolean;
    }
    
    
    
    interface TreeViewMappingFunc {
        (tree_view: TreeView, path: TreePath, user_data: any) : void;
    }
    
    
    
    interface TreeViewRowSeparatorFunc {
        (model: TreeModel, iter: TreeIter, data: any) : boolean;
    }
    
    
    
    interface TreeViewSearchEqualFunc {
        (model: TreeModel, column: number, key: string, iter: TreeIter, search_data: any) : boolean;
    }
    
    
    
    interface TreeViewSearchPositionFunc {
        (tree_view: TreeView, search_dialog: Widget, user_data: any) : void;
    }
    
    
    
    type Allocation = Gdk.Rectangle;
    
    
    
    type Stock = string;
    
    
    
    function accel_groups_activate (object: GObject.Object, accel_key: number, accel_mods: Gdk.ModifierType): boolean;
    
    
    
    function accel_groups_from_object (object: GObject.Object): GLib.SList;
    
    
    
    function accelerator_get_default_mod_mask (): Gdk.ModifierType;
    
    
    
    function accelerator_get_label (accelerator_key: number, accelerator_mods: Gdk.ModifierType): string;
    
    
    
    function accelerator_get_label_with_keycode (display: Gdk.Display, accelerator_key: number, keycode: number, accelerator_mods: Gdk.ModifierType): string;
    
    
    
    function accelerator_name (accelerator_key: number, accelerator_mods: Gdk.ModifierType): string;
    
    
    
    function accelerator_name_with_keycode (display: Gdk.Display, accelerator_key: number, keycode: number, accelerator_mods: Gdk.ModifierType): string;
    
    
    
    function accelerator_parse (accelerator: string, accelerator_key: number, accelerator_mods: Gdk.ModifierType): void;
    
    
    
    function accelerator_parse_with_keycode (accelerator: string, accelerator_key: number, accelerator_codes: number[], accelerator_mods: Gdk.ModifierType): void;
    
    
    
    function accelerator_set_default_mod_mask (default_mod_mask: Gdk.ModifierType): void;
    
    
    
    function accelerator_valid (keyval: number, modifiers: Gdk.ModifierType): boolean;
    
    
    
    function alternative_dialog_button_order (screen: Gdk.Screen): boolean;
    
    
    
    function binding_entry_add_signal_from_string (binding_set: BindingSet, signal_desc: string): GLib.TokenType;
    
    
    
    function binding_entry_add_signall (binding_set: BindingSet, keyval: number, modifiers: Gdk.ModifierType, signal_name: string, binding_args: GLib.SList): void;
    
    
    
    function binding_entry_remove (binding_set: BindingSet, keyval: number, modifiers: Gdk.ModifierType): void;
    
    
    
    function binding_entry_skip (binding_set: BindingSet, keyval: number, modifiers: Gdk.ModifierType): void;
    
    
    
    function binding_set_by_class (object_class: any): BindingSet;
    
    
    
    function binding_set_find (set_name: string): BindingSet;
    
    
    
    function binding_set_new (set_name: string): BindingSet;
    
    
    
    function bindings_activate (object: GObject.Object, keyval: number, modifiers: Gdk.ModifierType): boolean;
    
    
    
    function bindings_activate_event (object: GObject.Object, event: Gdk.EventKey): boolean;
    
    
    
    function builder_error_quark (): GLib.Quark;
    
    
    
    function cairo_should_draw_window (cr: cairo.Context, window: Gdk.Window): boolean;
    
    
    
    function cairo_transform_to_window (cr: cairo.Context, widget: Widget, window: Gdk.Window): void;
    
    
    
    function check_version (required_major: number, required_minor: number, required_micro: number): string;
    
    
    
    function css_provider_error_quark (): GLib.Quark;
    
    
    
    function device_grab_add (widget: Widget, device: Gdk.Device, block_others: boolean): void;
    
    
    
    function device_grab_remove (widget: Widget, device: Gdk.Device): void;
    
    
    
    function disable_setlocale (): void;
    
    
    
    function distribute_natural_allocation (extra_space: number, n_requested_sizes: number, sizes: RequestedSize): number;
    
    
    
    function drag_cancel (context: Gdk.DragContext): void;
    
    
    
    function drag_finish (context: Gdk.DragContext, success: boolean, _del: boolean, time_: number): void;
    
    
    
    function drag_get_source_widget (context: Gdk.DragContext): Widget;
    
    
    
    function drag_set_icon_default (context: Gdk.DragContext): void;
    
    
    
    function drag_set_icon_gicon (context: Gdk.DragContext, icon: Gio.Icon, hot_x: number, hot_y: number): void;
    
    
    
    function drag_set_icon_name (context: Gdk.DragContext, icon_name: string, hot_x: number, hot_y: number): void;
    
    
    
    function drag_set_icon_pixbuf (context: Gdk.DragContext, pixbuf: GdkPixbuf.Pixbuf, hot_x: number, hot_y: number): void;
    
    
    
    function drag_set_icon_stock (context: Gdk.DragContext, stock_id: string, hot_x: number, hot_y: number): void;
    
    
    
    function drag_set_icon_surface (context: Gdk.DragContext, surface: cairo.Surface): void;
    
    
    
    function drag_set_icon_widget (context: Gdk.DragContext, widget: Widget, hot_x: number, hot_y: number): void;
    
    
    
    function draw_insertion_cursor (widget: Widget, cr: cairo.Context, location: Gdk.Rectangle, is_primary: boolean, direction: TextDirection, draw_arrow: boolean): void;
    
    
    
    function events_pending (): boolean;
    
    
    
    // function false (): boolean;
    
    
    
    function file_chooser_error_quark (): GLib.Quark;
    
    
    
    function get_binary_age (): number;
    
    
    
    function get_current_event (): Gdk.Event;
    
    
    
    function get_current_event_device (): Gdk.Device;
    
    
    
    function get_current_event_state (state: Gdk.ModifierType): boolean;
    
    
    
    function get_current_event_time (): number;
    
    
    
    function get_debug_flags (): number;
    
    
    
    function get_default_language (): Pango.Language;
    
    
    
    function get_event_widget (event: Gdk.Event): Widget;
    
    
    
    function get_interface_age (): number;
    
    
    
    function get_locale_direction (): TextDirection;
    
    
    
    function get_major_version (): number;
    
    
    
    function get_micro_version (): number;
    
    
    
    function get_minor_version (): number;
    
    
    
    function get_option_group (open_default_display: boolean): GLib.OptionGroup;
    
    
    
    function grab_get_current (): Widget;
    
    
    
    function icon_size_from_name (name: string): number;
    
    
    
    function icon_size_get_name (size: number): string;
    
    
    
    function icon_size_lookup (size: number, width: number, height: number): boolean;
    
    
    
    function icon_size_lookup_for_settings (settings: Settings, size: number, width: number, height: number): boolean;
    
    
    
    function icon_size_register (name: string, width: number, height: number): number;
    
    
    
    function icon_size_register_alias (alias: string, target: number): void;
    
    
    
    function icon_theme_error_quark (): GLib.Quark;
    
    
    
    function init (argc: number, argv: string[]): void;
    
    
    
    function init_check (argc: number, argv: string[]): boolean;
    
    
    
    function init_with_args (argc: number, argv: string[], parameter_string: string, entries: GLib.OptionEntry[], translation_domain: string): boolean;
    
    
    
    function key_snooper_install (snooper: KeySnoopFunc, func_data: any): number;
    
    
    
    function key_snooper_remove (snooper_handler_id: number): void;
    
    
    
    function main (): void;
    
    
    
    function main_do_event (event: Gdk.Event): void;
    
    
    
    function main_iteration (): boolean;
    
    
    
    function main_iteration_do (blocking: boolean): boolean;
    
    
    
    function main_level (): number;
    
    
    
    function main_quit (): void;
    
    
    
    function paint_arrow (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, arrow_type: ArrowType, fill: boolean, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function paint_box (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function paint_box_gap (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number, gap_side: PositionType, gap_x: number, gap_width: number): void;
    
    
    
    function paint_check (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function paint_diamond (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function paint_expander (style: Style, cr: cairo.Context, state_type: StateType, widget: Widget, detail: string, _x: number, _y: number, expander_style: ExpanderStyle): void;
    
    
    
    function paint_extension (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number, gap_side: PositionType): void;
    
    
    
    function paint_flat_box (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function paint_focus (style: Style, cr: cairo.Context, state_type: StateType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function paint_handle (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number, orientation: Orientation): void;
    
    
    
    function paint_hline (style: Style, cr: cairo.Context, state_type: StateType, widget: Widget, detail: string, x1: number, x2: number, _y: number): void;
    
    
    
    function paint_layout (style: Style, cr: cairo.Context, state_type: StateType, use_text: boolean, widget: Widget, detail: string, _x: number, _y: number, layout: Pango.Layout): void;
    
    
    
    function paint_option (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function paint_resize_grip (style: Style, cr: cairo.Context, state_type: StateType, widget: Widget, detail: string, edge: Gdk.WindowEdge, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function paint_shadow (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function paint_shadow_gap (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number, gap_side: PositionType, gap_x: number, gap_width: number): void;
    
    
    
    function paint_slider (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number, orientation: Orientation): void;
    
    
    
    function paint_spinner (style: Style, cr: cairo.Context, state_type: StateType, widget: Widget, detail: string, step: number, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function paint_tab (style: Style, cr: cairo.Context, state_type: StateType, shadow_type: ShadowType, widget: Widget, detail: string, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function paint_vline (style: Style, cr: cairo.Context, state_type: StateType, widget: Widget, detail: string, y1_: number, y2_: number, _x: number): void;
    
    
    
    function paper_size_get_default (): string;
    
    
    
    function paper_size_get_paper_sizes (include_custom: boolean): GLib.List;
    
    
    
    function parse_args (argc: number, argv: string[]): boolean;
    
    
    
    function print_error_quark (): GLib.Quark;
    
    
    
    function print_run_page_setup_dialog (parent: Window, page_setup: PageSetup, settings: PrintSettings): PageSetup;
    
    
    
    function print_run_page_setup_dialog_async (parent: Window, page_setup: PageSetup, settings: PrintSettings, done_cb: PageSetupDoneFunc, data: any): void;
    
    
    
    function propagate_event (widget: Widget, event: Gdk.Event): void;
    
    
    
    function rc_add_default_file (filename: string): void;
    
    
    
    function rc_find_module_in_path (module_file: string): string;
    
    
    
    function rc_find_pixmap_in_path (settings: Settings, scanner: GLib.Scanner, pixmap_file: string): string;
    
    
    
    function rc_get_default_files (): string[];
    
    
    
    function rc_get_im_module_file (): string;
    
    
    
    function rc_get_im_module_path (): string;
    
    
    
    function rc_get_module_dir (): string;
    
    
    
    function rc_get_style (widget: Widget): Style;
    
    
    
    function rc_get_style_by_paths (settings: Settings, widget_path: string, class_path: string, _type: GObject.Type): Style;
    
    
    
    function rc_get_theme_dir (): string;
    
    
    
    function rc_parse (filename: string): void;
    
    
    
    function rc_parse_color (scanner: GLib.Scanner, color: Gdk.Color): number;
    
    
    
    function rc_parse_color_full (scanner: GLib.Scanner, style: RcStyle, color: Gdk.Color): number;
    
    
    
    function rc_parse_priority (scanner: GLib.Scanner, priority: PathPriorityType): number;
    
    
    
    function rc_parse_state (scanner: GLib.Scanner, state: StateType): number;
    
    
    
    function rc_parse_string (rc_string: string): void;
    
    
    
    function rc_property_parse_border (pspec: GObject.ParamSpec, gstring: GLib.String, property_value: GObject.Value): boolean;
    
    
    
    function rc_property_parse_color (pspec: GObject.ParamSpec, gstring: GLib.String, property_value: GObject.Value): boolean;
    
    
    
    function rc_property_parse_enum (pspec: GObject.ParamSpec, gstring: GLib.String, property_value: GObject.Value): boolean;
    
    
    
    function rc_property_parse_flags (pspec: GObject.ParamSpec, gstring: GLib.String, property_value: GObject.Value): boolean;
    
    
    
    function rc_property_parse_requisition (pspec: GObject.ParamSpec, gstring: GLib.String, property_value: GObject.Value): boolean;
    
    
    
    function rc_reparse_all (): boolean;
    
    
    
    function rc_reparse_all_for_settings (settings: Settings, force_load: boolean): boolean;
    
    
    
    function rc_reset_styles (settings: Settings): void;
    
    
    
    function rc_scanner_new (): GLib.Scanner;
    
    
    
    function rc_set_default_files (filenames: string[]): void;
    
    
    
    function recent_chooser_error_quark (): GLib.Quark;
    
    
    
    function recent_manager_error_quark (): GLib.Quark;
    
    
    
    function render_activity (context: StyleContext, cr: cairo.Context, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function render_arrow (context: StyleContext, cr: cairo.Context, angle: number, _x: number, _y: number, size: number): void;
    
    
    
    function render_background (context: StyleContext, cr: cairo.Context, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function render_background_get_clip (context: StyleContext, _x: number, _y: number, width: number, height: number, out_clip: Gdk.Rectangle): void;
    
    
    
    function render_check (context: StyleContext, cr: cairo.Context, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function render_expander (context: StyleContext, cr: cairo.Context, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function render_extension (context: StyleContext, cr: cairo.Context, _x: number, _y: number, width: number, height: number, gap_side: PositionType): void;
    
    
    
    function render_focus (context: StyleContext, cr: cairo.Context, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function render_frame (context: StyleContext, cr: cairo.Context, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function render_frame_gap (context: StyleContext, cr: cairo.Context, _x: number, _y: number, width: number, height: number, gap_side: PositionType, xy0_gap: number, xy1_gap: number): void;
    
    
    
    function render_handle (context: StyleContext, cr: cairo.Context, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function render_icon (context: StyleContext, cr: cairo.Context, pixbuf: GdkPixbuf.Pixbuf, _x: number, _y: number): void;
    
    
    
    function render_icon_pixbuf (context: StyleContext, source: IconSource, size: number): GdkPixbuf.Pixbuf;
    
    
    
    function render_icon_surface (context: StyleContext, cr: cairo.Context, surface: cairo.Surface, _x: number, _y: number): void;
    
    
    
    function render_insertion_cursor (context: StyleContext, cr: cairo.Context, _x: number, _y: number, layout: Pango.Layout, index: number, direction: Pango.Direction): void;
    
    
    
    function render_layout (context: StyleContext, cr: cairo.Context, _x: number, _y: number, layout: Pango.Layout): void;
    
    
    
    function render_line (context: StyleContext, cr: cairo.Context, x0: number, y0: number, x1: number, y1: number): void;
    
    
    
    function render_option (context: StyleContext, cr: cairo.Context, _x: number, _y: number, width: number, height: number): void;
    
    
    
    function render_slider (context: StyleContext, cr: cairo.Context, _x: number, _y: number, width: number, height: number, orientation: Orientation): void;
    
    
    
    function rgb_to_hsv (_r: number, _g: number, _b: number, _h: number, _s: number, _v: number): void;
    
    
    
    function selection_add_target (widget: Widget, selection: Gdk.Atom, target: Gdk.Atom, info: number): void;
    
    
    
    function selection_add_targets (widget: Widget, selection: Gdk.Atom, targets: TargetEntry[], ntargets: number): void;
    
    
    
    function selection_clear_targets (widget: Widget, selection: Gdk.Atom): void;
    
    
    
    function selection_convert (widget: Widget, selection: Gdk.Atom, target: Gdk.Atom, time_: number): boolean;
    
    
    
    function selection_owner_set (widget: Widget, selection: Gdk.Atom, time_: number): boolean;
    
    
    
    function selection_owner_set_for_display (display: Gdk.Display, widget: Widget, selection: Gdk.Atom, time_: number): boolean;
    
    
    
    function selection_remove_all (widget: Widget): void;
    
    
    
    function set_debug_flags (flags: number): void;
    
    
    
    function show_about_dialog (parent: Window, first_property_name: string): void;
    
    
    
    function show_uri (screen: Gdk.Screen, uri: string, timestamp: number): boolean;
    
    
    
    function show_uri_on_window (parent: Window, uri: string, timestamp: number): boolean;
    
    
    
    function stock_add (items: StockItem[], n_items: number): void;
    
    
    
    function stock_add_static (items: StockItem[], n_items: number): void;
    
    
    
    function stock_list_ids (): GLib.SList;
    
    
    
    function stock_lookup (stock_id: string, item: StockItem): boolean;
    
    
    
    function stock_set_translate_func (domain: string, _func: TranslateFunc, data: any, notify: GLib.DestroyNotify): void;
    
    
    
    function target_table_free (targets: TargetEntry[], n_targets: number): void;
    
    
    
    function target_table_new_from_list (list: TargetList, n_targets: number): TargetEntry[];
    
    
    
    function targets_include_image (targets: Gdk.Atom[], n_targets: number, writable: boolean): boolean;
    
    
    
    function targets_include_rich_text (targets: Gdk.Atom[], n_targets: number, buffer: TextBuffer): boolean;
    
    
    
    function targets_include_text (targets: Gdk.Atom[], n_targets: number): boolean;
    
    
    
    function targets_include_uri (targets: Gdk.Atom[], n_targets: number): boolean;
    
    
    
    function test_create_simple_window (window_title: string, dialog_text: string): Widget;
    
    
    
    function test_create_widget (widget_type: GObject.Type, first_property_name: string): Widget;
    
    
    
    function test_display_button_window (window_title: string, dialog_text: string): Widget;
    
    
    
    function test_find_label (widget: Widget, label_pattern: string): Widget;
    
    
    
    function test_find_sibling (base_widget: Widget, widget_type: GObject.Type): Widget;
    
    
    
    function test_find_widget (widget: Widget, label_pattern: string, widget_type: GObject.Type): Widget;
    
    
    
    function test_init (argcp: number, argvp: string[]): void;
    
    
    
    function test_list_all_types (n_types: number): GObject.Type[];
    
    
    
    function test_register_all_types (): void;
    
    
    
    function test_slider_get_value (widget: Widget): number;
    
    
    
    function test_slider_set_perc (widget: Widget, percentage: number): void;
    
    
    
    function test_spin_button_click (spinner: SpinButton, button: number, upwards: boolean): boolean;
    
    
    
    function test_text_get (widget: Widget): string;
    
    
    
    function test_text_set (widget: Widget, string: string): void;
    
    
    
    function test_widget_click (widget: Widget, button: number, modifiers: Gdk.ModifierType): boolean;
    
    
    
    function test_widget_send_key (widget: Widget, keyval: number, modifiers: Gdk.ModifierType): boolean;
    
    
    
    function test_widget_wait_for_draw (widget: Widget): void;
    
    
    
    function tree_get_row_drag_data (selection_data: SelectionData, tree_model: TreeModel, path: TreePath): boolean;
    
    
    
    function tree_row_reference_deleted (proxy: GObject.Object, path: TreePath): void;
    
    
    
    function tree_row_reference_inserted (proxy: GObject.Object, path: TreePath): void;
    
    
    
    function tree_row_reference_reordered (proxy: GObject.Object, path: TreePath, iter: TreeIter, new_order: number[]): void;
    
    
    
    function tree_set_row_drag_data (selection_data: SelectionData, tree_model: TreeModel, path: TreePath): boolean;
    
    
    
    // function true (): boolean;
    
    }