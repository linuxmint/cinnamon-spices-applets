declare namespace imports.gi.Atk {

    interface GObjectAccessible extends Object {
        get_object () : GObject.Object;
    }
    
    var GObjectAccessible: {
        
        for_object (obj: GObject.Object) : Object;
    }
    
    
    
    
    interface Hyperlink extends GObject.Object, Action {
        get_end_index () : number;
        get_n_anchors () : number;
        get_object (_i: number) : Object;
        get_start_index () : number;
        get_uri (_i: number) : string;
        is_inline () : boolean;
        is_selected_link () : boolean;
        is_valid () : boolean;
    }
    
    var Hyperlink: {
        
        
    }
    
    
    
    
    interface Misc extends GObject.Object {
        threads_enter () : void;
        threads_leave () : void;
    }
    
    var Misc: {
        
        get_instance () : Misc;
    }
    
    
    
    
    // interface NoOpObject extends Object, Action, Component, Document, EditableText, Hypertext, Image, Selection, Table, TableCell, Text, Value, Window {
        
    // }
    
    var NoOpObject: {
        new (obj: GObject.Object) : Object;
        
    }
    
    
    
    
    interface NoOpObjectFactory extends ObjectFactory {
        
    }
    
    var NoOpObjectFactory: {
        new () : ObjectFactory;
        
    }
    
    
    
    
    interface Object extends GObject.Object {
        add_relationship (relationship: RelationType, target: Object) : boolean;
        connect_property_change_handler (handler: PropertyChangeHandler) : number;
        get_attributes () : AttributeSet;
        // get_description () : string;
        get_index_in_parent () : number;
        get_layer () : Layer;
        get_mdi_zorder () : number;
        get_n_accessible_children () : number;
        get_name () : string;
        get_object_locale () : string;
        get_parent () : Object;
        get_role () : Role;
        initialize (data: any) : void;
        notify_state_change (state: State, value: boolean) : void;
        peek_parent () : Object;
        ref_accessible_child (_i: number) : Object;
        ref_relation_set () : RelationSet;
        ref_state_set () : StateSet;
        remove_property_change_handler (handler_id: number) : void;
        remove_relationship (relationship: RelationType, target: Object) : boolean;
        set_description (description: string) : void;
        set_name (name: string) : void;
        set_parent (parent: Object) : void;
        set_role (role: Role) : void;
    }
    
    var Object: {
        
        
    }
    
    
    
    
    interface ObjectFactory extends GObject.Object {
        create_accessible (obj: GObject.Object) : Object;
        get_accessible_type () : GObject.Type;
        invalidate () : void;
    }
    
    var ObjectFactory: {
        
        
    }
    
    
    
    
    interface Plug extends Object, Component {
        get_id () : string;
    }
    
    var Plug: {
        new () : Object;
        
    }
    
    
    
    
    interface Registry extends GObject.Object {
        get_factory (_type: GObject.Type) : ObjectFactory;
        get_factory_type (_type: GObject.Type) : GObject.Type;
        set_factory_type (_type: GObject.Type, factory_type: GObject.Type) : void;
    }
    
    var Registry: {
        
        
    }
    
    
    
    
    interface Relation extends GObject.Object {
        add_target (target: Object) : void;
        get_relation_type () : RelationType;
        get_target () : Object[];
        remove_target (target: Object) : boolean;
    }
    
    var Relation: {
        new (targets: Object[], n_targets: number, relationship: RelationType) : Relation;
        
    }
    
    
    
    
    interface RelationSet extends GObject.Object {
        add (relation: Relation) : void;
        add_relation_by_type (relationship: RelationType, target: Object) : void;
        contains (relationship: RelationType) : boolean;
        contains_target (relationship: RelationType, target: Object) : boolean;
        get_n_relations () : number;
        get_relation (_i: number) : Relation;
        get_relation_by_type (relationship: RelationType) : Relation;
        remove (relation: Relation) : void;
    }
    
    var RelationSet: {
        new () : RelationSet;
        
    }
    
    
    
    
    interface Socket extends Object, Component {
        embed (plug_id: string) : void;
        is_occupied () : boolean;
    }
    
    var Socket: {
        new () : Object;
        
    }
    
    
    
    
    interface StateSet extends GObject.Object {
        add_state (_type: StateType) : boolean;
        add_states (types: StateType[], n_types: number) : void;
        and_sets (compare_set: StateSet) : StateSet;
        clear_states () : void;
        contains_state (_type: StateType) : boolean;
        contains_states (types: StateType[], n_types: number) : boolean;
        is_empty () : boolean;
        or_sets (compare_set: StateSet) : StateSet;
        remove_state (_type: StateType) : boolean;
        xor_sets (compare_set: StateSet) : StateSet;
    }
    
    var StateSet: {
        new () : StateSet;
        
    }
    
    
    
    
    interface Util extends GObject.Object {
        
    }
    
    var Util: {
        
        
    }
    
    
    
    
    class ActionIface {
        public parent: GObject.TypeInterface;
    
        do_action : {(action: Action, _i: number) : boolean;};
        get_n_actions : {(action: Action) : number;};
        get_description : {(action: Action, _i: number) : string;};
        get_name : {(action: Action, _i: number) : string;};
        get_keybinding : {(action: Action, _i: number) : string;};
        set_description : {(action: Action, _i: number, desc: string) : boolean;};
        get_localized_name : {(action: Action, _i: number) : string;};
    
    }
    
    
    
    class Attribute {
        public name: string;
        public value: string;
    
    
    }
    
    
    
    class ComponentIface {
        public parent: GObject.TypeInterface;
    
        add_focus_handler : {(component: Component, handler: FocusHandler) : number;};
        contains : {(component: Component, _x: number, _y: number, coord_type: CoordType) : boolean;};
        ref_accessible_at_point : {(component: Component, _x: number, _y: number, coord_type: CoordType) : Object;};
        get_extents : {(component: Component, _x: number, _y: number, width: number, height: number, coord_type: CoordType) : void;};
        get_position : {(component: Component, _x: number, _y: number, coord_type: CoordType) : void;};
        get_size : {(component: Component, width: number, height: number) : void;};
        grab_focus : {(component: Component) : boolean;};
        remove_focus_handler : {(component: Component, handler_id: number) : void;};
        set_extents : {(component: Component, _x: number, _y: number, width: number, height: number, coord_type: CoordType) : boolean;};
        set_position : {(component: Component, _x: number, _y: number, coord_type: CoordType) : boolean;};
        set_size : {(component: Component, width: number, height: number) : boolean;};
        get_layer : {(component: Component) : Layer;};
        get_mdi_zorder : {(component: Component) : number;};
        bounds_changed : {(component: Component, bounds: Rectangle) : void;};
        get_alpha : {(component: Component) : number;};
        scroll_to : {(component: Component, _type: ScrollType) : boolean;};
        scroll_to_point : {(component: Component, coords: CoordType, _x: number, _y: number) : boolean;};
    
    }
    
    
    
    class DocumentIface {
        public parent: GObject.TypeInterface;
    
        get_document_type : {(document: Document) : string;};
        get_document : {(document: Document) : any;};
        get_document_locale : {(document: Document) : string;};
        get_document_attributes : {(document: Document) : AttributeSet;};
        get_document_attribute_value : {(document: Document, attribute_name: string) : string;};
        set_document_attribute : {(document: Document, attribute_name: string, attribute_value: string) : boolean;};
        get_current_page_number : {(document: Document) : number;};
        get_page_count : {(document: Document) : number;};
    
    }
    
    
    
    class EditableTextIface {
        public parent_interface: GObject.TypeInterface;
    
        set_run_attributes : {(text: EditableText, attrib_set: AttributeSet, start_offset: number, end_offset: number) : boolean;};
        set_text_contents : {(text: EditableText, string: string) : void;};
        insert_text : {(text: EditableText, string: string, length: number, position: number) : void;};
        copy_text : {(text: EditableText, start_pos: number, end_pos: number) : void;};
        cut_text : {(text: EditableText, start_pos: number, end_pos: number) : void;};
        delete_text : {(text: EditableText, start_pos: number, end_pos: number) : void;};
        paste_text : {(text: EditableText, position: number) : void;};
    
    }
    
    
    
    class GObjectAccessibleClass {
        public parent_class: ObjectClass;
        public pad1: Function;
        public pad2: Function;
    
    
    }
    
    
    
    class HyperlinkClass {
        public parent: GObject.ObjectClass;
        public pad1: Function;
    
        get_uri : {(link_: Hyperlink, _i: number) : string;};
        get_object : {(link_: Hyperlink, _i: number) : Object;};
        get_end_index : {(link_: Hyperlink) : number;};
        get_start_index : {(link_: Hyperlink) : number;};
        is_valid : {(link_: Hyperlink) : boolean;};
        get_n_anchors : {(link_: Hyperlink) : number;};
        link_state : {(link_: Hyperlink) : number;};
        is_selected_link : {(link_: Hyperlink) : boolean;};
        link_activated : {(link_: Hyperlink) : void;};
    
    }
    
    
    
    class HyperlinkImplIface {
        public parent: GObject.TypeInterface;
    
        get_hyperlink : {(_impl: HyperlinkImpl) : Hyperlink;};
    
    }
    
    
    
    class HypertextIface {
        public parent: GObject.TypeInterface;
    
        get_link : {(hypertext: Hypertext, link_index: number) : Hyperlink;};
        get_n_links : {(hypertext: Hypertext) : number;};
        get_link_index : {(hypertext: Hypertext, char_index: number) : number;};
        link_selected : {(hypertext: Hypertext, link_index: number) : void;};
    
    }
    
    
    
    class ImageIface {
        public parent: GObject.TypeInterface;
    
        get_image_position : {(image: Image, _x: number, _y: number, coord_type: CoordType) : void;};
        get_image_description : {(image: Image) : string;};
        get_image_size : {(image: Image, width: number, height: number) : void;};
        set_image_description : {(image: Image, description: string) : boolean;};
        get_image_locale : {(image: Image) : string;};
    
    }
    
    
    
    class Implementor {
    
    
        public ref_accessible () : Object;
    }
    
    
    
    class KeyEventStruct {
        public type: number;
        public state: number;
        public keyval: number;
        public length: number;
        public string: string;
        public keycode: number;
        public timestamp: number;
    
    
    }
    
    
    
    class MiscClass {
        public parent: GObject.ObjectClass;
        public vfuncs: any[];
    
        threads_enter : {(misc: Misc) : void;};
        threads_leave : {(misc: Misc) : void;};
    
    }
    
    
    
    class NoOpObjectClass {
        public parent_class: ObjectClass;
    
    
    }
    
    
    
    class NoOpObjectFactoryClass {
        public parent_class: ObjectFactoryClass;
    
    
    }
    
    
    
    class ObjectClass {
        public parent: GObject.ObjectClass;
        public pad1: Function;
    
        get_name : {(accessible: Object) : string;};
        get_description : {(accessible: Object) : string;};
        get_parent : {(accessible: Object) : Object;};
        get_n_children : {(accessible: Object) : number;};
        ref_child : {(accessible: Object, _i: number) : Object;};
        get_index_in_parent : {(accessible: Object) : number;};
        ref_relation_set : {(accessible: Object) : RelationSet;};
        get_role : {(accessible: Object) : Role;};
        get_layer : {(accessible: Object) : Layer;};
        get_mdi_zorder : {(accessible: Object) : number;};
        ref_state_set : {(accessible: Object) : StateSet;};
        set_name : {(accessible: Object, name: string) : void;};
        set_description : {(accessible: Object, description: string) : void;};
        set_parent : {(accessible: Object, parent: Object) : void;};
        set_role : {(accessible: Object, role: Role) : void;};
        connect_property_change_handler : {(accessible: Object, handler: PropertyChangeHandler) : number;};
        remove_property_change_handler : {(accessible: Object, handler_id: number) : void;};
        initialize : {(accessible: Object, data: any) : void;};
        children_changed : {(accessible: Object, change_index: number, changed_child: any) : void;};
        focus_event : {(accessible: Object, focus_in: boolean) : void;};
        property_change : {(accessible: Object, values: PropertyValues) : void;};
        state_change : {(accessible: Object, name: string, state_set: boolean) : void;};
        visible_data_changed : {(accessible: Object) : void;};
        active_descendant_changed : {(accessible: Object, child: any) : void;};
        get_attributes : {(accessible: Object) : AttributeSet;};
        get_object_locale : {(accessible: Object) : string;};
    
    }
    
    
    
    class ObjectFactoryClass {
        public parent_class: GObject.ObjectClass;
        public pad1: Function;
        public pad2: Function;
    
        create_accessible : {(obj: GObject.Object) : Object;};
        invalidate : {(factory: ObjectFactory) : void;};
        get_accessible_type : {() : GObject.Type;};
    
    }
    
    
    
    class PlugClass {
        public parent_class: ObjectClass;
    
        get_object_id : {(obj: Plug) : string;};
    
    }
    
    
    
    class PropertyValues {
        public property_name: string;
        public old_value: GObject.Value;
        public new_value: GObject.Value;
    
    
    }
    
    
    
    class Range {
    
    
        public copy () : Range;
        public free () : void;
        public get_description () : string;
        public get_lower_limit () : number;
        public get_upper_limit () : number;
    }
    
    
    
    class Rectangle {
        public x: number;
        public y: number;
        public width: number;
        public height: number;
    
    
    }
    
    
    
    class RegistryClass {
        public parent_class: GObject.ObjectClass;
    
    
    }
    
    
    
    class RelationClass {
        public parent: GObject.ObjectClass;
    
    
    }
    
    
    
    class RelationSetClass {
        public parent: GObject.ObjectClass;
        public pad1: Function;
        public pad2: Function;
    
    
    }
    
    
    
    class SelectionIface {
        public parent: GObject.TypeInterface;
    
        add_selection : {(selection: Selection, _i: number) : boolean;};
        clear_selection : {(selection: Selection) : boolean;};
        ref_selection : {(selection: Selection, _i: number) : Object;};
        get_selection_count : {(selection: Selection) : number;};
        is_child_selected : {(selection: Selection, _i: number) : boolean;};
        remove_selection : {(selection: Selection, _i: number) : boolean;};
        select_all_selection : {(selection: Selection) : boolean;};
        selection_changed : {(selection: Selection) : void;};
    
    }
    
    
    
    class SocketClass {
        public parent_class: ObjectClass;
    
        embed : {(obj: Socket, plug_id: string) : void;};
    
    }
    
    
    
    class StateSetClass {
        public parent: GObject.ObjectClass;
    
    
    }
    
    
    
    class StreamableContentIface {
        public parent: GObject.TypeInterface;
        public pad1: Function;
        public pad2: Function;
        public pad3: Function;
    
        get_n_mime_types : {(streamable: StreamableContent) : number;};
        get_mime_type : {(streamable: StreamableContent, _i: number) : string;};
        get_stream : {(streamable: StreamableContent, mime_type: string) : GLib.IOChannel;};
        get_uri : {(streamable: StreamableContent, mime_type: string) : string;};
    
    }
    
    
    
    class TableCellIface {
        public parent: GObject.TypeInterface;
    
        get_column_span : {(cell: TableCell) : number;};
        get_column_header_cells : {(cell: TableCell) : Object[];};
        get_position : {(cell: TableCell, _row: number, column: number) : boolean;};
        get_row_span : {(cell: TableCell) : number;};
        get_row_header_cells : {(cell: TableCell) : Object[];};
        get_row_column_span : {(cell: TableCell, _row: number, column: number, row_span: number, column_span: number) : boolean;};
        get_table : {(cell: TableCell) : Object;};
    
    }
    
    
    
    class TableIface {
        public parent: GObject.TypeInterface;
    
        ref_at : {(table: Table, _row: number, column: number) : Object;};
        get_index_at : {(table: Table, _row: number, column: number) : number;};
        get_column_at_index : {(table: Table, index_: number) : number;};
        get_row_at_index : {(table: Table, index_: number) : number;};
        get_n_columns : {(table: Table) : number;};
        get_n_rows : {(table: Table) : number;};
        get_column_extent_at : {(table: Table, _row: number, column: number) : number;};
        get_row_extent_at : {(table: Table, _row: number, column: number) : number;};
        get_caption : {(table: Table) : Object;};
        get_column_description : {(table: Table, column: number) : string;};
        get_column_header : {(table: Table, column: number) : Object;};
        get_row_description : {(table: Table, _row: number) : string;};
        get_row_header : {(table: Table, _row: number) : Object;};
        get_summary : {(table: Table) : Object;};
        set_caption : {(table: Table, caption: Object) : void;};
        set_column_description : {(table: Table, column: number, description: string) : void;};
        set_column_header : {(table: Table, column: number, header: Object) : void;};
        set_row_description : {(table: Table, _row: number, description: string) : void;};
        set_row_header : {(table: Table, _row: number, header: Object) : void;};
        set_summary : {(table: Table, accessible: Object) : void;};
        get_selected_columns : {(table: Table, selected: number) : number;};
        get_selected_rows : {(table: Table, selected: number) : number;};
        is_column_selected : {(table: Table, column: number) : boolean;};
        is_row_selected : {(table: Table, _row: number) : boolean;};
        is_selected : {(table: Table, _row: number, column: number) : boolean;};
        add_row_selection : {(table: Table, _row: number) : boolean;};
        remove_row_selection : {(table: Table, _row: number) : boolean;};
        add_column_selection : {(table: Table, column: number) : boolean;};
        remove_column_selection : {(table: Table, column: number) : boolean;};
        row_inserted : {(table: Table, _row: number, num_inserted: number) : void;};
        column_inserted : {(table: Table, column: number, num_inserted: number) : void;};
        row_deleted : {(table: Table, _row: number, num_deleted: number) : void;};
        column_deleted : {(table: Table, column: number, num_deleted: number) : void;};
        row_reordered : {(table: Table) : void;};
        column_reordered : {(table: Table) : void;};
        model_changed : {(table: Table) : void;};
    
    }
    
    
    
    class TextIface {
        public parent: GObject.TypeInterface;
    
        get_text : {(text: Text, start_offset: number, end_offset: number) : string;};
        get_text_after_offset : {(text: Text, offset: number, boundary_type: TextBoundary, start_offset: number, end_offset: number) : string;};
        get_text_at_offset : {(text: Text, offset: number, boundary_type: TextBoundary, start_offset: number, end_offset: number) : string;};
        get_character_at_offset : {(text: Text, offset: number) : string;};
        get_text_before_offset : {(text: Text, offset: number, boundary_type: TextBoundary, start_offset: number, end_offset: number) : string;};
        get_caret_offset : {(text: Text) : number;};
        get_run_attributes : {(text: Text, offset: number, start_offset: number, end_offset: number) : AttributeSet;};
        get_default_attributes : {(text: Text) : AttributeSet;};
        get_character_extents : {(text: Text, offset: number, _x: number, _y: number, width: number, height: number, coords: CoordType) : void;};
        get_character_count : {(text: Text) : number;};
        get_offset_at_point : {(text: Text, _x: number, _y: number, coords: CoordType) : number;};
        get_n_selections : {(text: Text) : number;};
        get_selection : {(text: Text, selection_num: number, start_offset: number, end_offset: number) : string;};
        add_selection : {(text: Text, start_offset: number, end_offset: number) : boolean;};
        remove_selection : {(text: Text, selection_num: number) : boolean;};
        set_selection : {(text: Text, selection_num: number, start_offset: number, end_offset: number) : boolean;};
        set_caret_offset : {(text: Text, offset: number) : boolean;};
        text_changed : {(text: Text, position: number, length: number) : void;};
        text_caret_moved : {(text: Text, location: number) : void;};
        text_selection_changed : {(text: Text) : void;};
        text_attributes_changed : {(text: Text) : void;};
        get_range_extents : {(text: Text, start_offset: number, end_offset: number, coord_type: CoordType, rect: TextRectangle) : void;};
        get_bounded_ranges : {(text: Text, rect: TextRectangle, coord_type: CoordType, x_clip_type: TextClipType, y_clip_type: TextClipType) : TextRange[];};
        get_string_at_offset : {(text: Text, offset: number, granularity: TextGranularity, start_offset: number, end_offset: number) : string;};
        scroll_substring_to : {(text: Text, start_offset: number, end_offset: number, _type: ScrollType) : boolean;};
        scroll_substring_to_point : {(text: Text, start_offset: number, end_offset: number, coords: CoordType, _x: number, _y: number) : boolean;};
    
    }
    
    
    
    class TextRange {
        public bounds: TextRectangle;
        public start_offset: number;
        public end_offset: number;
        public content: string;
    
    
    }
    
    
    
    class TextRectangle {
        public x: number;
        public y: number;
        public width: number;
        public height: number;
    
    
    }
    
    
    
    class UtilClass {
        public parent: GObject.ObjectClass;
    
        add_global_event_listener : {(listener: GObject.SignalEmissionHook, event_type: string) : number;};
        remove_global_event_listener : {(listener_id: number) : void;};
        add_key_event_listener : {(listener: KeySnoopFunc, data: any) : number;};
        remove_key_event_listener : {(listener_id: number) : void;};
        get_root : {() : Object;};
        get_toolkit_name : {() : string;};
        get_toolkit_version : {() : string;};
    
    }
    
    
    
    class ValueIface {
        public parent: GObject.TypeInterface;
    
        get_current_value : {(obj: Value, value: GObject.Value) : void;};
        get_maximum_value : {(obj: Value, value: GObject.Value) : void;};
        get_minimum_value : {(obj: Value, value: GObject.Value) : void;};
        set_current_value : {(obj: Value, value: GObject.Value) : boolean;};
        get_minimum_increment : {(obj: Value, value: GObject.Value) : void;};
        get_value_and_text : {(obj: Value, value: number, text: string) : void;};
        get_range : {(obj: Value) : Range;};
        get_increment : {(obj: Value) : number;};
        get_sub_ranges : {(obj: Value) : GLib.SList;};
        set_value : {(obj: Value, new_value: number) : void;};
    
    }
    
    
    
    class WindowIface {
        public parent: GObject.TypeInterface;
    
    
    }
    
    
    
    interface Action {
        // do_action (_i: number) : boolean;
        // get_description (_i: number) : string;
        // get_keybinding (_i: number) : string;
        // get_localized_name (_i: number) : string;
        // get_n_actions () : number;
        // get_name (_i: number) : string;
        // set_description (_i: number, desc: string) : boolean;
    }
    
    var Action: {
        
        
    }
    
    
    
    
    interface Component {
        add_focus_handler (handler: FocusHandler) : number;
        contains (_x: number, _y: number, coord_type: CoordType) : boolean;
        get_alpha () : number;
        get_extents (_x: number, _y: number, width: number, height: number, coord_type: CoordType) : void;
        get_layer () : Layer;
        get_mdi_zorder () : number;
        // get_position (_x: number, _y: number, coord_type: CoordType) : void;
        get_size (width: number, height: number) : void;
        // grab_focus () : boolean;
        ref_accessible_at_point (_x: number, _y: number, coord_type: CoordType) : Object;
        remove_focus_handler (handler_id: number) : void;
        scroll_to (_type: ScrollType) : boolean;
        scroll_to_point (coords: CoordType, _x: number, _y: number) : boolean;
        set_extents (_x: number, _y: number, width: number, height: number, coord_type: CoordType) : boolean;
        set_position (_x: number, _y: number, coord_type: CoordType) : boolean;
        set_size (width: number, height: number) : boolean;
    }
    
    var Component: {
        
        
    }
    
    
    
    
    interface Document {
        get_attribute_value (attribute_name: string) : string;
        get_attributes () : AttributeSet;
        get_current_page_number () : number;
        get_document () : any;
        get_document_type () : string;
        get_locale () : string;
        get_page_count () : number;
        set_attribute_value (attribute_name: string, attribute_value: string) : boolean;
    }
    
    var Document: {
        
        
    }
    
    
    
    
    interface EditableText {
        copy_text (start_pos: number, end_pos: number) : void;
        cut_text (start_pos: number, end_pos: number) : void;
        delete_text (start_pos: number, end_pos: number) : void;
        insert_text (string: string, length: number, position: number) : void;
        paste_text (position: number) : void;
        set_run_attributes (attrib_set: AttributeSet, start_offset: number, end_offset: number) : boolean;
        set_text_contents (string: string) : void;
    }
    
    var EditableText: {
        
        
    }
    
    
    
    
    interface HyperlinkImpl {
        get_hyperlink () : Hyperlink;
    }
    
    var HyperlinkImpl: {
        
        
    }
    
    
    
    
    interface Hypertext {
        get_link (link_index: number) : Hyperlink;
        get_link_index (char_index: number) : number;
        get_n_links () : number;
    }
    
    var Hypertext: {
        
        
    }
    
    
    
    
    interface Image {
        get_image_description () : string;
        get_image_locale () : string;
        get_image_position (_x: number, _y: number, coord_type: CoordType) : void;
        get_image_size (width: number, height: number) : void;
        set_image_description (description: string) : boolean;
    }
    
    var Image: {
        
        
    }
    
    
    
    
    interface ImplementorIface {
        
    }
    
    var ImplementorIface: {
        
        
    }
    
    
    
    
    interface Selection {
        add_selection (_i: number) : boolean;
        clear_selection () : boolean;
        get_selection_count () : number;
        is_child_selected (_i: number) : boolean;
        ref_selection (_i: number) : Object;
        remove_selection (_i: number) : boolean;
        select_all_selection () : boolean;
    }
    
    var Selection: {
        
        
    }
    
    
    
    
    interface StreamableContent {
        get_mime_type (_i: number) : string;
        get_n_mime_types () : number;
        get_stream (mime_type: string) : GLib.IOChannel;
        get_uri (mime_type: string) : string;
    }
    
    var StreamableContent: {
        
        
    }
    
    
    
    
    interface Table {
        add_column_selection (column: number) : boolean;
        add_row_selection (_row: number) : boolean;
        get_caption () : Object;
        get_column_at_index (index_: number) : number;
        get_column_description (column: number) : string;
        get_column_extent_at (_row: number, column: number) : number;
        get_column_header (column: number) : Object;
        get_index_at (_row: number, column: number) : number;
        get_n_columns () : number;
        get_n_rows () : number;
        get_row_at_index (index_: number) : number;
        get_row_description (_row: number) : string;
        get_row_extent_at (_row: number, column: number) : number;
        get_row_header (_row: number) : Object;
        get_selected_columns (selected: number) : number;
        get_selected_rows (selected: number) : number;
        get_summary () : Object;
        is_column_selected (column: number) : boolean;
        is_row_selected (_row: number) : boolean;
        is_selected (_row: number, column: number) : boolean;
        ref_at (_row: number, column: number) : Object;
        remove_column_selection (column: number) : boolean;
        remove_row_selection (_row: number) : boolean;
        set_caption (caption: Object) : void;
        set_column_description (column: number, description: string) : void;
        set_column_header (column: number, header: Object) : void;
        set_row_description (_row: number, description: string) : void;
        set_row_header (_row: number, header: Object) : void;
        set_summary (accessible: Object) : void;
    }
    
    var Table: {
        
        
    }
    
    
    
    
    interface TableCell {
        get_column_header_cells () : Object[];
        get_column_span () : number;
        get_position (_row: number, column: number) : boolean;
        get_row_column_span (_row: number, column: number, row_span: number, column_span: number) : boolean;
        get_row_header_cells () : Object[];
        get_row_span () : number;
        get_table () : Object;
    }
    
    var TableCell: {
        
        
    }
    
    
    
    
    interface Text {
        add_selection (start_offset: number, end_offset: number) : boolean;
        get_bounded_ranges (rect: TextRectangle, coord_type: CoordType, x_clip_type: TextClipType, y_clip_type: TextClipType) : TextRange[];
        get_caret_offset () : number;
        get_character_at_offset (offset: number) : string;
        get_character_count () : number;
        get_character_extents (offset: number, _x: number, _y: number, width: number, height: number, coords: CoordType) : void;
        get_default_attributes () : AttributeSet;
        get_n_selections () : number;
        get_offset_at_point (_x: number, _y: number, coords: CoordType) : number;
        get_range_extents (start_offset: number, end_offset: number, coord_type: CoordType, rect: TextRectangle) : void;
        get_run_attributes (offset: number, start_offset: number, end_offset: number) : AttributeSet;
        get_selection (selection_num: number, start_offset: number, end_offset: number) : string;
        get_string_at_offset (offset: number, granularity: TextGranularity, start_offset: number, end_offset: number) : string;
        get_text (start_offset: number, end_offset: number) : string;
        get_text_after_offset (offset: number, boundary_type: TextBoundary, start_offset: number, end_offset: number) : string;
        get_text_at_offset (offset: number, boundary_type: TextBoundary, start_offset: number, end_offset: number) : string;
        get_text_before_offset (offset: number, boundary_type: TextBoundary, start_offset: number, end_offset: number) : string;
        remove_selection (selection_num: number) : boolean;
        scroll_substring_to (start_offset: number, end_offset: number, _type: ScrollType) : boolean;
        scroll_substring_to_point (start_offset: number, end_offset: number, coords: CoordType, _x: number, _y: number) : boolean;
        set_caret_offset (offset: number) : boolean;
        set_selection (selection_num: number, start_offset: number, end_offset: number) : boolean;
    }
    
    var Text: {
        
        free_ranges (ranges: TextRange[]) : void;
    }
    
    
    
    
    interface Value {
        get_current_value (value: GObject.Value) : void;
        get_increment () : number;
        get_maximum_value (value: GObject.Value) : void;
        get_minimum_increment (value: GObject.Value) : void;
        get_minimum_value (value: GObject.Value) : void;
        get_range () : Range;
        get_sub_ranges () : GLib.SList;
        get_value_and_text (value: number, text: string) : void;
        set_current_value (value: GObject.Value) : boolean;
        set_value (new_value: number) : void;
    }
    
    var Value: {
        
        
    }
    
    
    
    
    interface Window {
        
    }
    
    var Window: {
        
        
    }
    
    
    
    
    enum CoordType {
        screen = 0,
        window = 1,
        parent = 2
    }
    
    
    
    enum KeyEventType {
        press = 0,
        release = 1,
        last_defined = 2
    }
    
    
    
    enum Layer {
        invalid = 0,
        background = 1,
        canvas = 2,
        widget = 3,
        mdi = 4,
        popup = 5,
        overlay = 6,
        window = 7
    }
    
    
    
    enum RelationType {
        null = 0,
        controlled_by = 1,
        controller_for = 2,
        label_for = 3,
        labelled_by = 4,
        member_of = 5,
        node_child_of = 6,
        flows_to = 7,
        flows_from = 8,
        subwindow_of = 9,
        embeds = 10,
        embedded_by = 11,
        popup_for = 12,
        parent_window_of = 13,
        described_by = 14,
        description_for = 15,
        node_parent_of = 16,
        details = 17,
        details_for = 18,
        error_message = 19,
        error_for = 20,
        last_defined = 21
    }
    
    
    
    enum Role {
        invalid = 0,
        accelerator_label = 1,
        alert = 2,
        animation = 3,
        arrow = 4,
        calendar = 5,
        canvas = 6,
        check_box = 7,
        check_menu_item = 8,
        color_chooser = 9,
        column_header = 10,
        combo_box = 11,
        date_editor = 12,
        desktop_icon = 13,
        desktop_frame = 14,
        dial = 15,
        dialog = 16,
        directory_pane = 17,
        drawing_area = 18,
        file_chooser = 19,
        filler = 20,
        font_chooser = 21,
        frame = 22,
        glass_pane = 23,
        html_container = 24,
        icon = 25,
        image = 26,
        internal_frame = 27,
        label = 28,
        layered_pane = 29,
        list = 30,
        list_item = 31,
        menu = 32,
        menu_bar = 33,
        menu_item = 34,
        option_pane = 35,
        page_tab = 36,
        page_tab_list = 37,
        panel = 38,
        password_text = 39,
        popup_menu = 40,
        progress_bar = 41,
        push_button = 42,
        radio_button = 43,
        radio_menu_item = 44,
        root_pane = 45,
        row_header = 46,
        scroll_bar = 47,
        scroll_pane = 48,
        separator = 49,
        slider = 50,
        split_pane = 51,
        spin_button = 52,
        statusbar = 53,
        table = 54,
        table_cell = 55,
        table_column_header = 56,
        table_row_header = 57,
        tear_off_menu_item = 58,
        terminal = 59,
        text = 60,
        toggle_button = 61,
        tool_bar = 62,
        tool_tip = 63,
        tree = 64,
        tree_table = 65,
        unknown = 66,
        viewport = 67,
        window = 68,
        header = 69,
        footer = 70,
        paragraph = 71,
        ruler = 72,
        application = 73,
        autocomplete = 74,
        edit_bar = 75,
        embedded = 76,
        entry = 77,
        chart = 78,
        caption = 79,
        document_frame = 80,
        heading = 81,
        page = 82,
        section = 83,
        redundant_object = 84,
        form = 85,
        link = 86,
        input_method_window = 87,
        table_row = 88,
        tree_item = 89,
        document_spreadsheet = 90,
        document_presentation = 91,
        document_text = 92,
        document_web = 93,
        document_email = 94,
        comment = 95,
        list_box = 96,
        grouping = 97,
        image_map = 98,
        notification = 99,
        info_bar = 100,
        level_bar = 101,
        title_bar = 102,
        block_quote = 103,
        audio = 104,
        video = 105,
        definition = 106,
        article = 107,
        landmark = 108,
        log = 109,
        marquee = 110,
        math = 111,
        rating = 112,
        timer = 113,
        description_list = 114,
        description_term = 115,
        description_value = 116,
        static = 117,
        math_fraction = 118,
        math_root = 119,
        subscript = 120,
        superscript = 121,
        footnote = 122,
        last_defined = 123
    }
    
    
    
    enum ScrollType {
        top_left = 0,
        bottom_right = 1,
        top_edge = 2,
        bottom_edge = 3,
        left_edge = 4,
        right_edge = 5,
        anywhere = 6
    }
    
    
    
    enum StateType {
        invalid = 0,
        active = 1,
        armed = 2,
        busy = 3,
        checked = 4,
        defunct = 5,
        editable = 6,
        enabled = 7,
        expandable = 8,
        expanded = 9,
        focusable = 10,
        focused = 11,
        horizontal = 12,
        iconified = 13,
        modal = 14,
        multi_line = 15,
        multiselectable = 16,
        opaque = 17,
        pressed = 18,
        resizable = 19,
        selectable = 20,
        selected = 21,
        sensitive = 22,
        showing = 23,
        single_line = 24,
        stale = 25,
        transient = 26,
        vertical = 27,
        visible = 28,
        manages_descendants = 29,
        indeterminate = 30,
        truncated = 31,
        required = 32,
        invalid_entry = 33,
        supports_autocompletion = 34,
        selectable_text = 35,
        default = 36,
        animated = 37,
        visited = 38,
        checkable = 39,
        has_popup = 40,
        has_tooltip = 41,
        read_only = 42,
        last_defined = 43
    }
    
    
    
    enum TextAttribute {
        invalid = 0,
        left_margin = 1,
        right_margin = 2,
        indent = 3,
        invisible = 4,
        editable = 5,
        pixels_above_lines = 6,
        pixels_below_lines = 7,
        pixels_inside_wrap = 8,
        bg_full_height = 9,
        rise = 10,
        underline = 11,
        strikethrough = 12,
        size = 13,
        scale = 14,
        weight = 15,
        language = 16,
        family_name = 17,
        bg_color = 18,
        fg_color = 19,
        bg_stipple = 20,
        fg_stipple = 21,
        wrap_mode = 22,
        direction = 23,
        justification = 24,
        stretch = 25,
        variant = 26,
        style = 27,
        last_defined = 28
    }
    
    
    
    enum TextBoundary {
        char = 0,
        word_start = 1,
        word_end = 2,
        sentence_start = 3,
        sentence_end = 4,
        line_start = 5,
        line_end = 6
    }
    
    
    
    enum TextClipType {
        none = 0,
        min = 1,
        max = 2,
        both = 3
    }
    
    
    
    enum TextGranularity {
        char = 0,
        word = 1,
        sentence = 2,
        line = 3,
        paragraph = 4
    }
    
    
    
    enum ValueType {
        very_weak = 0,
        weak = 1,
        acceptable = 2,
        strong = 3,
        very_strong = 4,
        very_low = 5,
        low = 6,
        medium = 7,
        high = 8,
        very_high = 9,
        very_bad = 10,
        bad = 11,
        good = 12,
        very_good = 13,
        best = 14,
        last_defined = 15
    }
    
    
    
    enum HyperlinkStateFlags {
        inline = 1
    }
    
    
    
    interface EventListener {
        (obj: Object) : void;
    }
    
    
    
    interface EventListenerInit {
        () : void;
    }
    
    
    
    interface FocusHandler {
        (object: Object, focus_in: boolean) : void;
    }
    
    
    
    interface Function {
        (user_data: any) : boolean;
    }
    
    
    
    interface KeySnoopFunc {
        (event: KeyEventStruct, user_data: any) : number;
    }
    
    
    
    interface PropertyChangeHandler {
        (obj: Object, vals: PropertyValues) : void;
    }
    
    
    
    type AttributeSet = GLib.SList;
    
    
    
    type State = number;
    
    
    
    function add_focus_tracker (focus_tracker: EventListener): number;
    
    
    
    function add_global_event_listener (listener: GObject.SignalEmissionHook, event_type: string): number;
    
    
    
    function add_key_event_listener (listener: KeySnoopFunc, data: any): number;
    
    
    
    function attribute_set_free (attrib_set: AttributeSet): void;
    
    
    
    function focus_tracker_init (init: EventListenerInit): void;
    
    
    
    function focus_tracker_notify (object: Object): void;
    
    
    
    function get_binary_age (): number;
    
    
    
    function get_default_registry (): Registry;
    
    
    
    function get_focus_object (): Object;
    
    
    
    function get_interface_age (): number;
    
    
    
    function get_major_version (): number;
    
    
    
    function get_micro_version (): number;
    
    
    
    function get_minor_version (): number;
    
    
    
    function get_root (): Object;
    
    
    
    function get_toolkit_name (): string;
    
    
    
    function get_toolkit_version (): string;
    
    
    
    function get_version (): string;
    
    
    
    function relation_type_for_name (name: string): RelationType;
    
    
    
    function relation_type_get_name (_type: RelationType): string;
    
    
    
    function relation_type_register (name: string): RelationType;
    
    
    
    function remove_focus_tracker (tracker_id: number): void;
    
    
    
    function remove_global_event_listener (listener_id: number): void;
    
    
    
    function remove_key_event_listener (listener_id: number): void;
    
    
    
    function role_for_name (name: string): Role;
    
    
    
    function role_get_localized_name (role: Role): string;
    
    
    
    function role_get_name (role: Role): string;
    
    
    
    function role_register (name: string): Role;
    
    
    
    function state_type_for_name (name: string): StateType;
    
    
    
    function state_type_get_name (_type: StateType): string;
    
    
    
    function state_type_register (name: string): StateType;
    
    
    
    function text_attribute_for_name (name: string): TextAttribute;
    
    
    
    function text_attribute_get_name (attr: TextAttribute): string;
    
    
    
    function text_attribute_get_value (attr: TextAttribute, index_: number): string;
    
    
    
    function text_attribute_register (name: string): TextAttribute;
    
    
    
    function text_free_ranges (ranges: TextRange[]): void;
    
    
    
    function value_type_get_localized_name (value_type: ValueType): string;
    
    
    
    function value_type_get_name (value_type: ValueType): string;
    
    }