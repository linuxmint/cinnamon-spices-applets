declare namespace imports.gi.Pango {

    interface Context extends GObject.Object {
        changed () : void;
        get_base_dir () : Direction;
        get_base_gravity () : Gravity;
        get_font_description () : FontDescription;
        get_font_map () : FontMap;
        get_gravity () : Gravity;
        get_gravity_hint () : GravityHint;
        get_language () : Language;
        get_matrix () : Matrix;
        get_metrics (desc: FontDescription, language: Language) : FontMetrics;
        get_round_glyph_positions () : boolean;
        get_serial () : number;
        list_families (families: FontFamily[], n_families: number) : void;
        load_font (desc: FontDescription) : Font;
        load_fontset (desc: FontDescription, language: Language) : Fontset;
        set_base_dir (direction: Direction) : void;
        set_base_gravity (gravity: Gravity) : void;
        set_font_description (desc: FontDescription) : void;
        set_font_map (font_map: FontMap) : void;
        set_gravity_hint (hint: GravityHint) : void;
        set_language (language: Language) : void;
        set_matrix (matrix: Matrix) : void;
        set_round_glyph_positions (round_positions: boolean) : void;
    }
    
    var Context: {
        new () : Context;
        
    }
    
    
    
    
    interface Coverage extends GObject.Object {
        copy () : Coverage;
        get (index_: number) : CoverageLevel;
        max (other: Coverage) : void;
        ref () : Coverage;
        set (index_: number, level: CoverageLevel) : void;
        to_bytes (bytes: number[], n_bytes: number) : void;
        unref () : void;
    }
    
    var Coverage: {
        new () : Coverage;
        from_bytes (bytes: number[], n_bytes: number) : Coverage;
    }
    
    
    
    
    interface Engine extends GObject.Object {
        
    }
    
    var Engine: {
        
        
    }
    
    
    
    
    interface EngineLang extends Engine {
        
    }
    
    var EngineLang: {
        
        
    }
    
    
    
    
    interface EngineShape extends Engine {
        
    }
    
    var EngineShape: {
        
        
    }
    
    
    
    
    interface Font extends GObject.Object {
        describe () : FontDescription;
        describe_with_absolute_size () : FontDescription;
        find_shaper (language: Language, _ch: number) : EngineShape;
        get_coverage (language: Language) : Coverage;
        get_features (features: undefined[], len: number, num_features: number) : void;
        get_font_map () : FontMap;
        get_glyph_extents (glyph: Glyph, ink_rect: Rectangle, logical_rect: Rectangle) : void;
        get_hb_font () : undefined;
        get_metrics (language: Language) : FontMetrics;
        has_char (wc: string) : boolean;
    }
    
    var Font: {
        
        descriptions_free (descs: FontDescription[], n_descs: number) : void;
    }
    
    
    
    
    interface FontFace extends GObject.Object {
        describe () : FontDescription;
        get_face_name () : string;
        is_synthesized () : boolean;
        list_sizes (sizes: number[], n_sizes: number) : void;
    }
    
    var FontFace: {
        
        
    }
    
    
    
    
    interface FontFamily extends GObject.Object {
        get_name () : string;
        is_monospace () : boolean;
        is_variable () : boolean;
        list_faces (faces: FontFace[], n_faces: number) : void;
    }
    
    var FontFamily: {
        
        
    }
    
    
    
    
    interface FontMap extends GObject.Object {
        changed () : void;
        create_context () : Context;
        get_serial () : number;
        list_families (families: FontFamily[], n_families: number) : void;
        load_font (context: Context, desc: FontDescription) : Font;
        load_fontset (context: Context, desc: FontDescription, language: Language) : Fontset;
    }
    
    var FontMap: {
        
        
    }
    
    
    
    
    interface Fontset extends GObject.Object {
        foreach (_func: FontsetForeachFunc, data: any) : void;
        get_font (wc: number) : Font;
        get_metrics () : FontMetrics;
    }
    
    var Fontset: {
        
        
    }
    
    
    
    
    interface Layout extends GObject.Object {
        context_changed () : void;
        copy () : Layout;
        get_alignment () : Alignment;
        get_attributes () : AttrList;
        get_auto_dir () : boolean;
        get_baseline () : number;
        get_character_count () : number;
        get_context () : Context;
        get_cursor_pos (index_: number, strong_pos: Rectangle, weak_pos: Rectangle) : void;
        get_ellipsize () : EllipsizeMode;
        get_extents (ink_rect: Rectangle, logical_rect: Rectangle) : void;
        get_font_description () : FontDescription;
        get_height () : number;
        get_indent () : number;
        get_iter () : LayoutIter;
        get_justify () : boolean;
        get_line (line: number) : LayoutLine;
        get_line_count () : number;
        get_line_readonly (line: number) : LayoutLine;
        get_line_spacing () : number;
        get_lines () : GLib.SList;
        get_lines_readonly () : GLib.SList;
        get_log_attrs (attrs: LogAttr[], n_attrs: number) : void;
        get_log_attrs_readonly (n_attrs: number) : LogAttr[];
        get_pixel_extents (ink_rect: Rectangle, logical_rect: Rectangle) : void;
        get_pixel_size (width: number, height: number) : void;
        get_serial () : number;
        get_single_paragraph_mode () : boolean;
        get_size (width: number, height: number) : void;
        get_spacing () : number;
        get_tabs () : TabArray;
        get_text () : string;
        get_unknown_glyphs_count () : number;
        get_width () : number;
        get_wrap () : WrapMode;
        index_to_line_x (index_: number, trailing: boolean, line: number, x_pos: number) : void;
        index_to_pos (index_: number, pos: Rectangle) : void;
        is_ellipsized () : boolean;
        is_wrapped () : boolean;
        move_cursor_visually (strong: boolean, old_index: number, old_trailing: number, direction: number, new_index: number, new_trailing: number) : void;
        set_alignment (alignment: Alignment) : void;
        set_attributes (attrs: AttrList) : void;
        set_auto_dir (auto_dir: boolean) : void;
        set_ellipsize (ellipsize: EllipsizeMode) : void;
        set_font_description (desc: FontDescription) : void;
        set_height (height: number) : void;
        set_indent (indent: number) : void;
        set_justify (justify: boolean) : void;
        set_line_spacing (factor: number) : void;
        set_markup (markup: string, length: number) : void;
        set_markup_with_accel (markup: string, length: number, accel_marker: string, accel_char: string) : void;
        set_single_paragraph_mode (setting: boolean) : void;
        set_spacing (spacing: number) : void;
        set_tabs (tabs: TabArray) : void;
        set_text (text: string, length: number) : void;
        set_width (width: number) : void;
        set_wrap (wrap: WrapMode) : void;
        xy_to_index (_x: number, _y: number, index_: number, trailing: number) : boolean;
    }
    
    var Layout: {
        new (context: Context) : Layout;
        
    }
    
    
    
    
    interface Renderer extends GObject.Object {
        activate () : void;
        deactivate () : void;
        draw_error_underline (_x: number, _y: number, width: number, height: number) : void;
        draw_glyph (font: Font, glyph: Glyph, _x: number, _y: number) : void;
        draw_glyph_item (text: string, glyph_item: GlyphItem, _x: number, _y: number) : void;
        draw_glyphs (font: Font, glyphs: GlyphString, _x: number, _y: number) : void;
        draw_layout (layout: Layout, _x: number, _y: number) : void;
        draw_layout_line (line: LayoutLine, _x: number, _y: number) : void;
        draw_rectangle (part: RenderPart, _x: number, _y: number, width: number, height: number) : void;
        draw_trapezoid (part: RenderPart, y1_: number, x11: number, x21: number, y2: number, x12: number, x22: number) : void;
        get_alpha (part: RenderPart) : number;
        get_color (part: RenderPart) : Color;
        get_layout () : Layout;
        get_layout_line () : LayoutLine;
        get_matrix () : Matrix;
        part_changed (part: RenderPart) : void;
        set_alpha (part: RenderPart, alpha: number) : void;
        set_color (part: RenderPart, color: Color) : void;
        set_matrix (matrix: Matrix) : void;
    }
    
    var Renderer: {
        
        
    }
    
    
    
    
    class Analysis {
        public shape_engine: EngineShape;
        public lang_engine: EngineLang;
        public font: Font;
        public level: number;
        public gravity: number;
        public flags: number;
        public script: number;
        public language: Language;
        public extra_attrs: GLib.SList;
    
    
    }
    
    
    
    class AttrClass {
        public type: AttrType;
    
        copy : {(attr: Attribute) : Attribute;};
        destroy : {(attr: Attribute) : void;};
        equal : {(attr1: Attribute, attr2: Attribute) : boolean;};
    
    }
    
    
    
    class AttrColor {
        public attr: Attribute;
        public color: Color;
    
    
    }
    
    
    
    class AttrFloat {
        public attr: Attribute;
        public value: number;
    
    
    }
    
    
    
    class AttrFontDesc {
        public attr: Attribute;
        public desc: FontDescription;
    
    
    }
    
    
    
    class AttrFontFeatures {
        public attr: Attribute;
        public features: string;
    
    
    }
    
    
    
    class AttrInt {
        public attr: Attribute;
        public value: number;
    
    
    }
    
    
    
    class AttrIterator {
    
    
        public copy () : AttrIterator;
        public destroy () : void;
        public get (_type: AttrType) : Attribute;
        public get_attrs () : GLib.SList;
        public get_font (desc: FontDescription, language: Language, extra_attrs: GLib.SList) : void;
        public next () : boolean;
        public range (start: number, _end: number) : void;
    }
    
    
    
    class AttrLanguage {
        public attr: Attribute;
        public value: Language;
    
    
    }
    
    
    
    class AttrList {
    
    
        public change (attr: Attribute) : void;
        public copy () : AttrList;
        public filter (_func: AttrFilterFunc, data: any) : AttrList;
        public get_attributes () : GLib.SList;
        public get_iterator () : AttrIterator;
        public insert (attr: Attribute) : void;
        public insert_before (attr: Attribute) : void;
        public ref () : AttrList;
        public splice (other: AttrList, pos: number, len: number) : void;
        public unref () : void;
        public update (pos: number, remove: number, add: number) : void;
    }
    
    
    
    class AttrShape {
        public attr: Attribute;
        public ink_rect: Rectangle;
        public logical_rect: Rectangle;
        public data: any;
        public copy_func: AttrDataCopyFunc;
        public destroy_func: GLib.DestroyNotify;
    
    
    }
    
    
    
    class AttrSize {
        public attr: Attribute;
        public size: number;
        public absolute: number;
    
    
    }
    
    
    
    class AttrString {
        public attr: Attribute;
        public value: string;
    
    
    }
    
    
    
    class Attribute {
        public klass: AttrClass;
        public start_index: number;
        public end_index: number;
    
    
        public copy () : Attribute;
        public destroy () : void;
        public equal (attr2: Attribute) : boolean;
        public init (klass: AttrClass) : void;
    }
    
    
    
    class Color {
        public red: number;
        public green: number;
        public blue: number;
    
    
        public copy () : Color;
        public free () : void;
        public parse (spec: string) : boolean;
        public to_string () : string;
    }
    
    
    
    class ContextClass {
    
    
    }
    
    
    
    class EngineClass {
        public parent_class: GObject.ObjectClass;
    
    
    }
    
    
    
    class EngineInfo {
        public id: string;
        public engine_type: string;
        public render_type: string;
        public scripts: EngineScriptInfo;
        public n_scripts: number;
    
    
    }
    
    
    
    class EngineLangClass {
        public parent_class: EngineClass;
    
        script_break : {(engine: EngineLang, text: string, len: number, analysis: Analysis, attrs: LogAttr, attrs_len: number) : void;};
    
    }
    
    
    
    class EngineScriptInfo {
        public script: Script;
        public langs: string;
    
    
    }
    
    
    
    class EngineShapeClass {
        public parent_class: EngineClass;
    
        script_shape : {(engine: EngineShape, font: Font, item_text: string, item_length: number, analysis: Analysis, glyphs: GlyphString, paragraph_text: string, paragraph_length: number) : void;};
        covers : {(engine: EngineShape, font: Font, language: Language, wc: string) : CoverageLevel;};
    
    }
    
    
    
    class FontDescription {
    
    
        public better_match (old_match: FontDescription, new_match: FontDescription) : boolean;
        public copy () : FontDescription;
        public copy_static () : FontDescription;
        public equal (desc2: FontDescription) : boolean;
        public free () : void;
        public get_family () : string;
        public get_gravity () : Gravity;
        public get_set_fields () : FontMask;
        public get_size () : number;
        public get_size_is_absolute () : boolean;
        public get_stretch () : Stretch;
        public get_style () : Style;
        public get_variant () : Variant;
        public get_variations () : string;
        public get_weight () : Weight;
        public hash () : number;
        public merge (desc_to_merge: FontDescription, replace_existing: boolean) : void;
        public merge_static (desc_to_merge: FontDescription, replace_existing: boolean) : void;
        public set_absolute_size (size: number) : void;
        public set_family (family: string) : void;
        public set_family_static (family: string) : void;
        public set_gravity (gravity: Gravity) : void;
        public set_size (size: number) : void;
        public set_stretch (stretch: Stretch) : void;
        public set_style (style: Style) : void;
        public set_variant (variant: Variant) : void;
        public set_variations (variations: string) : void;
        public set_variations_static (variations: string) : void;
        public set_weight (weight: Weight) : void;
        public to_filename () : string;
        public to_string () : string;
        public unset_fields (to_unset: FontMask) : void;
    }
    
    
    
    class FontMapClass {
        public parent_class: GObject.ObjectClass;
        public shape_engine_type: string;
    
        load_font : {(fontmap: FontMap, context: Context, desc: FontDescription) : Font;};
        list_families : {(fontmap: FontMap, families: FontFamily[], n_families: number) : void;};
        load_fontset : {(fontmap: FontMap, context: Context, desc: FontDescription, language: Language) : Fontset;};
        get_serial : {(fontmap: FontMap) : number;};
        changed : {(fontmap: FontMap) : void;};
        _pango_reserved1 : {() : void;};
        _pango_reserved2 : {() : void;};
    
    }
    
    
    
    class FontMetrics {
    
    
        public get_approximate_char_width () : number;
        public get_approximate_digit_width () : number;
        public get_ascent () : number;
        public get_descent () : number;
        public get_height () : number;
        public get_strikethrough_position () : number;
        public get_strikethrough_thickness () : number;
        public get_underline_position () : number;
        public get_underline_thickness () : number;
        public ref () : FontMetrics;
        public unref () : void;
    }
    
    
    
    class GlyphGeometry {
        public width: GlyphUnit;
        public x_offset: GlyphUnit;
        public y_offset: GlyphUnit;
    
    
    }
    
    
    
    class GlyphInfo {
        public glyph: Glyph;
        public geometry: GlyphGeometry;
        public attr: GlyphVisAttr;
    
    
    }
    
    
    
    class GlyphItem {
        public item: Item;
        public glyphs: GlyphString;
    
    
        public apply_attrs (text: string, list: AttrList) : GLib.SList;
        public copy () : GlyphItem;
        public free () : void;
        public get_logical_widths (text: string, logical_widths: number[]) : void;
        public letter_space (text: string, log_attrs: LogAttr[], letter_spacing: number) : void;
        public split (text: string, split_index: number) : GlyphItem;
    }
    
    
    
    class GlyphItemIter {
        public glyph_item: GlyphItem;
        public text: string;
        public start_glyph: number;
        public start_index: number;
        public start_char: number;
        public end_glyph: number;
        public end_index: number;
        public end_char: number;
    
    
        public copy () : GlyphItemIter;
        public free () : void;
        public init_end (glyph_item: GlyphItem, text: string) : boolean;
        public init_start (glyph_item: GlyphItem, text: string) : boolean;
        public next_cluster () : boolean;
        public prev_cluster () : boolean;
    }
    
    
    
    class GlyphString {
        public num_glyphs: number;
        public glyphs: GlyphInfo[];
        public log_clusters: number;
        public space: number;
    
    
        public copy () : GlyphString;
        public extents (font: Font, ink_rect: Rectangle, logical_rect: Rectangle) : void;
        public extents_range (start: number, _end: number, font: Font, ink_rect: Rectangle, logical_rect: Rectangle) : void;
        public free () : void;
        public get_logical_widths (text: string, length: number, embedding_level: number, logical_widths: number[]) : void;
        public get_width () : number;
        public index_to_x (text: string, length: number, analysis: Analysis, index_: number, trailing: boolean, x_pos: number) : void;
        public set_size (new_len: number) : void;
        public x_to_index (text: string, length: number, analysis: Analysis, x_pos: number, index_: number, trailing: number) : void;
    }
    
    
    
    class GlyphVisAttr {
        public is_cluster_start: number;
    
    
    }
    
    
    
    class IncludedModule {
    
        list : {(engines: EngineInfo, n_engines: number) : void;};
        init : {(module: GObject.TypeModule) : void;};
        exit : {() : void;};
        create : {(_id: string) : Engine;};
    
    }
    
    
    
    class Item {
        public offset: number;
        public length: number;
        public num_chars: number;
        public analysis: Analysis;
    
    
        public apply_attrs (iter: AttrIterator) : void;
        public copy () : Item;
        public free () : void;
        public split (split_index: number, split_offset: number) : Item;
    }
    
    
    
    class Language {
    
    
        public get_sample_string () : string;
        public get_scripts (num_scripts: number) : Script[];
        public includes_script (script: Script) : boolean;
        public matches (range_list: string) : boolean;
        public to_string () : string;
    }
    
    
    
    class LayoutClass {
    
    
    }
    
    
    
    class LayoutIter {
    
    
        public at_last_line () : boolean;
        public copy () : LayoutIter;
        public free () : void;
        public get_baseline () : number;
        public get_char_extents (logical_rect: Rectangle) : void;
        public get_cluster_extents (ink_rect: Rectangle, logical_rect: Rectangle) : void;
        public get_index () : number;
        public get_layout () : Layout;
        public get_layout_extents (ink_rect: Rectangle, logical_rect: Rectangle) : void;
        public get_line () : LayoutLine;
        public get_line_extents (ink_rect: Rectangle, logical_rect: Rectangle) : void;
        public get_line_readonly () : LayoutLine;
        public get_line_yrange (y0_: number, y1_: number) : void;
        public get_run () : LayoutRun;
        public get_run_extents (ink_rect: Rectangle, logical_rect: Rectangle) : void;
        public get_run_readonly () : LayoutRun;
        public next_char () : boolean;
        public next_cluster () : boolean;
        public next_line () : boolean;
        public next_run () : boolean;
    }
    
    
    
    class LayoutLine {
        public layout: Layout;
        public start_index: number;
        public length: number;
        public runs: GLib.SList;
        public is_paragraph_start: number;
        public resolved_dir: number;
    
    
        public get_extents (ink_rect: Rectangle, logical_rect: Rectangle) : void;
        public get_height (height: number) : void;
        public get_pixel_extents (ink_rect: Rectangle, logical_rect: Rectangle) : void;
        public get_x_ranges (start_index: number, end_index: number, ranges: number[], n_ranges: number) : void;
        public index_to_x (index_: number, trailing: boolean, x_pos: number) : void;
        public ref () : LayoutLine;
        public unref () : void;
        public x_to_index (x_pos: number, index_: number, trailing: number) : boolean;
    }
    
    
    
    class LogAttr {
        public is_line_break: number;
        public is_mandatory_break: number;
        public is_char_break: number;
        public is_white: number;
        public is_cursor_position: number;
        public is_word_start: number;
        public is_word_end: number;
        public is_sentence_boundary: number;
        public is_sentence_start: number;
        public is_sentence_end: number;
        public backspace_deletes_character: number;
        public is_expandable_space: number;
        public is_word_boundary: number;
    
    
    }
    
    
    
    class Map {
    
    
        public get_engine (script: Script) : Engine;
        public get_engines (script: Script, exact_engines: GLib.SList, fallback_engines: GLib.SList) : void;
    }
    
    
    
    class MapEntry {
    
    
    }
    
    
    
    class Matrix {
        public xx: number;
        public xy: number;
        public yx: number;
        public yy: number;
        public x0: number;
        public y0: number;
    
    
        public concat (new_matrix: Matrix) : void;
        public copy () : Matrix;
        public free () : void;
        public get_font_scale_factor () : number;
        public get_font_scale_factors (xscale: number, yscale: number) : void;
        public rotate (degrees: number) : void;
        public scale (scale_x: number, scale_y: number) : void;
        public transform_distance (dx: number, dy: number) : void;
        public transform_pixel_rectangle (rect: Rectangle) : void;
        public transform_point (_x: number, _y: number) : void;
        public transform_rectangle (rect: Rectangle) : void;
        public translate (tx: number, _ty: number) : void;
    }
    
    
    
    class Rectangle {
        public x: number;
        public y: number;
        public width: number;
        public height: number;
    
    
    }
    
    
    
    class RendererClass {
        public parent_class: GObject.ObjectClass;
    
        draw_glyphs : {(renderer: Renderer, font: Font, glyphs: GlyphString, _x: number, _y: number) : void;};
        draw_rectangle : {(renderer: Renderer, part: RenderPart, _x: number, _y: number, width: number, height: number) : void;};
        draw_error_underline : {(renderer: Renderer, _x: number, _y: number, width: number, height: number) : void;};
        draw_shape : {(renderer: Renderer, attr: AttrShape, _x: number, _y: number) : void;};
        draw_trapezoid : {(renderer: Renderer, part: RenderPart, y1_: number, x11: number, x21: number, y2: number, x12: number, x22: number) : void;};
        draw_glyph : {(renderer: Renderer, font: Font, glyph: Glyph, _x: number, _y: number) : void;};
        part_changed : {(renderer: Renderer, part: RenderPart) : void;};
        begin : {(renderer: Renderer) : void;};
        end : {(renderer: Renderer) : void;};
        prepare_run : {(renderer: Renderer, run: LayoutRun) : void;};
        draw_glyph_item : {(renderer: Renderer, text: string, glyph_item: GlyphItem, _x: number, _y: number) : void;};
        _pango_reserved2 : {() : void;};
        _pango_reserved3 : {() : void;};
        _pango_reserved4 : {() : void;};
    
    }
    
    
    
    class RendererPrivate {
    
    
    }
    
    
    
    class ScriptIter {
    
    
        public free () : void;
        public get_range (start: string, _end: string, script: Script) : void;
        public next () : boolean;
    }
    
    
    
    class TabArray {
    
    
        public copy () : TabArray;
        public free () : void;
        public get_positions_in_pixels () : boolean;
        public get_size () : number;
        public get_tab (tab_index: number, alignment: TabAlign, location: number) : void;
        public get_tabs (alignments: TabAlign, locations: number[]) : void;
        public resize (new_size: number) : void;
        public set_tab (tab_index: number, alignment: TabAlign, location: number) : void;
    }
    
    
    
    enum Alignment {
        LEFT = 0,
        CENTER = 1,
        RIGHT = 2
    }
    
    
    
    enum AttrType {
        invalid = 0,
        language = 1,
        family = 2,
        style = 3,
        weight = 4,
        variant = 5,
        stretch = 6,
        size = 7,
        font_desc = 8,
        foreground = 9,
        background = 10,
        underline = 11,
        strikethrough = 12,
        rise = 13,
        shape = 14,
        scale = 15,
        fallback = 16,
        letter_spacing = 17,
        underline_color = 18,
        strikethrough_color = 19,
        absolute_size = 20,
        gravity = 21,
        gravity_hint = 22,
        font_features = 23,
        foreground_alpha = 24,
        background_alpha = 25,
        allow_breaks = 26,
        show = 27,
        insert_hyphens = 28
    }
    
    
    
    enum BidiType {
        l = 0,
        lre = 1,
        lro = 2,
        r = 3,
        al = 4,
        rle = 5,
        rlo = 6,
        pdf = 7,
        en = 8,
        es = 9,
        et = 10,
        an = 11,
        cs = 12,
        nsm = 13,
        bn = 14,
        b = 15,
        s = 16,
        ws = 17,
        on = 18
    }
    
    
    
    enum CoverageLevel {
        none = 0,
        fallback = 1,
        approximate = 2,
        exact = 3
    }
    
    
    
    enum Direction {
        LTR = 0,
        RTL = 1,
        TTB_LTR = 2,
        TTB_RTL = 3,
        WEAK_LTR = 4,
        WEAK_RTL = 5,
        NEUTRAL = 6
    }
    
    
    
    enum EllipsizeMode {
        NONE = 0,
        START = 1,
        MIDDLE = 2,
        END = 3
    }
    
    
    
    enum Gravity {
        south = 0,
        east = 1,
        north = 2,
        west = 3,
        auto = 4
    }
    
    
    
    enum GravityHint {
        natural = 0,
        strong = 1,
        line = 2
    }
    
    
    
    enum RenderPart {
        foreground = 0,
        background = 1,
        underline = 2,
        strikethrough = 3
    }
    
    
    
    enum Script {
        invalid_code = -1,
        common = 0,
        inherited = 1,
        arabic = 2,
        armenian = 3,
        bengali = 4,
        bopomofo = 5,
        cherokee = 6,
        coptic = 7,
        cyrillic = 8,
        deseret = 9,
        devanagari = 10,
        ethiopic = 11,
        georgian = 12,
        gothic = 13,
        greek = 14,
        gujarati = 15,
        gurmukhi = 16,
        han = 17,
        hangul = 18,
        hebrew = 19,
        hiragana = 20,
        kannada = 21,
        katakana = 22,
        khmer = 23,
        lao = 24,
        latin = 25,
        malayalam = 26,
        mongolian = 27,
        myanmar = 28,
        ogham = 29,
        old_italic = 30,
        oriya = 31,
        runic = 32,
        sinhala = 33,
        syriac = 34,
        tamil = 35,
        telugu = 36,
        thaana = 37,
        thai = 38,
        tibetan = 39,
        canadian_aboriginal = 40,
        yi = 41,
        tagalog = 42,
        hanunoo = 43,
        buhid = 44,
        tagbanwa = 45,
        braille = 46,
        cypriot = 47,
        limbu = 48,
        osmanya = 49,
        shavian = 50,
        linear_b = 51,
        tai_le = 52,
        ugaritic = 53,
        new_tai_lue = 54,
        buginese = 55,
        glagolitic = 56,
        tifinagh = 57,
        syloti_nagri = 58,
        old_persian = 59,
        kharoshthi = 60,
        unknown = 61,
        balinese = 62,
        cuneiform = 63,
        phoenician = 64,
        phags_pa = 65,
        nko = 66,
        kayah_li = 67,
        lepcha = 68,
        rejang = 69,
        sundanese = 70,
        saurashtra = 71,
        cham = 72,
        ol_chiki = 73,
        vai = 74,
        carian = 75,
        lycian = 76,
        lydian = 77,
        batak = 78,
        brahmi = 79,
        mandaic = 80,
        chakma = 81,
        meroitic_cursive = 82,
        meroitic_hieroglyphs = 83,
        miao = 84,
        sharada = 85,
        sora_sompeng = 86,
        takri = 87,
        bassa_vah = 88,
        caucasian_albanian = 89,
        duployan = 90,
        elbasan = 91,
        grantha = 92,
        khojki = 93,
        khudawadi = 94,
        linear_a = 95,
        mahajani = 96,
        manichaean = 97,
        mende_kikakui = 98,
        modi = 99,
        mro = 100,
        nabataean = 101,
        old_north_arabian = 102,
        old_permic = 103,
        pahawh_hmong = 104,
        palmyrene = 105,
        pau_cin_hau = 106,
        psalter_pahlavi = 107,
        siddham = 108,
        tirhuta = 109,
        warang_citi = 110,
        ahom = 111,
        anatolian_hieroglyphs = 112,
        hatran = 113,
        multani = 114,
        old_hungarian = 115,
        signwriting = 116
    }
    
    
    
    enum Stretch {
        ultra_condensed = 0,
        extra_condensed = 1,
        condensed = 2,
        semi_condensed = 3,
        normal = 4,
        semi_expanded = 5,
        expanded = 6,
        extra_expanded = 7,
        ultra_expanded = 8
    }
    
    
    
    enum Style {
        normal = 0,
        oblique = 1,
        italic = 2
    }
    
    
    
    enum TabAlign {
        left = 0
    }
    
    
    
    enum Underline {
        none = 0,
        single = 1,
        double = 2,
        low = 3,
        error = 4
    }
    
    
    
    enum Variant {
        normal = 0,
        small_caps = 1
    }
    
    
    
    enum Weight {
        thin = 100,
        ultralight = 200,
        light = 300,
        semilight = 350,
        book = 380,
        normal = 400,
        medium = 500,
        semibold = 600,
        bold = 700,
        ultrabold = 800,
        heavy = 900,
        ultraheavy = 1000
    }
    
    
    
    enum WrapMode {
        WORD = 0,
        CHAR = 1,
        WORD_CHAR = 2
    }
    
    
    
    enum FontMask {
        family = 1,
        style = 2,
        variant = 4,
        weight = 8,
        stretch = 16,
        size = 32,
        gravity = 64,
        variations = 128
    }
    
    
    
    enum ShapeFlags {
        none = 0,
        round_positions = 1
    }
    
    
    
    enum ShowFlags {
        none = 0,
        spaces = 1,
        line_breaks = 2,
        ignorables = 4
    }
    
    
    
    interface AttrDataCopyFunc {
        (user_data: any) : any;
    }
    
    
    
    interface AttrFilterFunc {
        (attribute: Attribute, user_data: any) : boolean;
    }
    
    
    
    interface FontsetForeachFunc {
        (fontset: Fontset, font: Font, user_data: any) : boolean;
    }
    
    
    
    type Glyph = number;
    
    
    
    type GlyphUnit = number;
    
    
    
    type LayoutRun = GlyphItem;
    
    
    
    function attr_allow_breaks_new (allow_breaks: boolean): Attribute;
    
    
    
    function attr_background_alpha_new (alpha: number): Attribute;
    
    
    
    function attr_background_new (red: number, green: number, blue: number): Attribute;
    
    
    
    function attr_fallback_new (enable_fallback: boolean): Attribute;
    
    
    
    function attr_family_new (family: string): Attribute;
    
    
    
    function attr_font_desc_new (desc: FontDescription): Attribute;
    
    
    
    function attr_font_features_new (features: string): Attribute;
    
    
    
    function attr_foreground_alpha_new (alpha: number): Attribute;
    
    
    
    function attr_foreground_new (red: number, green: number, blue: number): Attribute;
    
    
    
    function attr_gravity_hint_new (hint: GravityHint): Attribute;
    
    
    
    function attr_gravity_new (gravity: Gravity): Attribute;
    
    
    
    function attr_insert_hyphens_new (insert_hyphens: boolean): Attribute;
    
    
    
    function attr_language_new (language: Language): Attribute;
    
    
    
    function attr_letter_spacing_new (letter_spacing: number): Attribute;
    
    
    
    function attr_rise_new (rise: number): Attribute;
    
    
    
    function attr_scale_new (scale_factor: number): Attribute;
    
    
    
    function attr_shape_new (ink_rect: Rectangle, logical_rect: Rectangle): Attribute;
    
    
    
    function attr_shape_new_with_data (ink_rect: Rectangle, logical_rect: Rectangle, data: any, copy_func: AttrDataCopyFunc, destroy_func: GLib.DestroyNotify): Attribute;
    
    
    
    function attr_show_new (flags: ShowFlags): Attribute;
    
    
    
    function attr_size_new (size: number): Attribute;
    
    
    
    function attr_size_new_absolute (size: number): Attribute;
    
    
    
    function attr_stretch_new (stretch: Stretch): Attribute;
    
    
    
    function attr_strikethrough_color_new (red: number, green: number, blue: number): Attribute;
    
    
    
    function attr_strikethrough_new (strikethrough: boolean): Attribute;
    
    
    
    function attr_style_new (style: Style): Attribute;
    
    
    
    function attr_type_get_name (_type: AttrType): string;
    
    
    
    function attr_type_register (name: string): AttrType;
    
    
    
    function attr_underline_color_new (red: number, green: number, blue: number): Attribute;
    
    
    
    function attr_underline_new (underline: Underline): Attribute;
    
    
    
    function attr_variant_new (variant: Variant): Attribute;
    
    
    
    function attr_weight_new (weight: Weight): Attribute;
    
    
    
    function bidi_type_for_unichar (_ch: string): BidiType;
    
    
    
    //function break (text: string, length: number, analysis: Analysis, attrs: LogAttr[], attrs_len: number): void;
    
    
    
    function default_break (text: string, length: number, analysis: Analysis, attrs: LogAttr, attrs_len: number): void;
    
    
    
    function extents_to_pixels (inclusive: Rectangle, nearest: Rectangle): void;
    
    
    
    function find_base_dir (text: string, length: number): Direction;
    
    
    
    function find_map (language: Language, engine_type_id: number, render_type_id: number): Map;
    
    
    
    function find_paragraph_boundary (text: string, length: number, paragraph_delimiter_index: number, next_paragraph_start: number): void;
    
    
    
    function font_description_from_string (_str: string): FontDescription;
    
    
    
    function get_log_attrs (text: string, length: number, level: number, language: Language, log_attrs: LogAttr[], attrs_len: number): void;
    
    
    
    function get_mirror_char (_ch: string, mirrored_ch: string): boolean;
    
    
    
    function gravity_get_for_matrix (matrix: Matrix): Gravity;
    
    
    
    function gravity_get_for_script (script: Script, base_gravity: Gravity, hint: GravityHint): Gravity;
    
    
    
    function gravity_get_for_script_and_width (script: Script, wide: boolean, base_gravity: Gravity, hint: GravityHint): Gravity;
    
    
    
    function gravity_to_rotation (gravity: Gravity): number;
    
    
    
    function is_zero_width (_ch: string): boolean;
    
    
    
    function itemize (context: Context, text: string, start_index: number, length: number, attrs: AttrList, cached_iter: AttrIterator): GLib.List;
    
    
    
    function itemize_with_base_dir (context: Context, base_dir: Direction, text: string, start_index: number, length: number, attrs: AttrList, cached_iter: AttrIterator): GLib.List;
    
    
    
    function language_from_string (language: string): Language;
    
    
    
    function language_get_default (): Language;
    
    
    
    function log2vis_get_embedding_levels (text: string, length: number, pbase_dir: Direction): number;
    
    
    
    function markup_parser_finish (context: GLib.MarkupParseContext, attr_list: AttrList, text: string, accel_char: string): boolean;
    
    
    
    function markup_parser_new (accel_marker: string): GLib.MarkupParseContext;
    
    
    
    function module_register (module: IncludedModule): void;
    
    
    
    function parse_enum (_type: GObject.Type, _str: string, value: number, warn: boolean, possible_values: string): boolean;
    
    
    
    function parse_markup(markup_text: string, length: number, accel_marker: string): boolean;
    
    
    
    function parse_stretch (_str: string, stretch: Stretch, warn: boolean): boolean;
    
    
    
    function parse_style (_str: string, style: Style, warn: boolean): boolean;
    
    
    
    function parse_variant (_str: string, variant: Variant, warn: boolean): boolean;
    
    
    
    function parse_weight (_str: string, weight: Weight, warn: boolean): boolean;
    
    
    
    function quantize_line_geometry (thickness: number, position: number): void;
    
    
    
    function read_line (stream: any, _str: GLib.String): number;
    
    
    
    function reorder_items (logical_items: GLib.List): GLib.List;
    
    
    
    function scan_int (pos: string, out: number): boolean;
    
    
    
    function scan_string (pos: string, out: GLib.String): boolean;
    
    
    
    function scan_word (pos: string, out: GLib.String): boolean;
    
    
    
    function script_for_unichar (_ch: string): Script;
    
    
    
    function script_get_sample_language (script: Script): Language;
    
    
    
    function shape (text: string, length: number, analysis: Analysis, glyphs: GlyphString): void;
    
    
    
    function shape_full (item_text: string, item_length: number, paragraph_text: string, paragraph_length: number, analysis: Analysis, glyphs: GlyphString): void;
    
    
    
    function shape_with_flags (item_text: string, item_length: number, paragraph_text: string, paragraph_length: number, analysis: Analysis, glyphs: GlyphString, flags: ShapeFlags): void;
    
    
    
    function skip_space (pos: string): boolean;
    
    
    
    function split_file_list (_str: string): string[];
    
    
    
    function tailor_break (text: string, length: number, analysis: Analysis, offset: number, log_attrs: LogAttr[], log_attrs_len: number): void;
    
    
    
    function trim_string (_str: string): string;
    
    
    
    function unichar_direction (_ch: string): Direction;
    
    
    
    function units_from_double (_d: number): number;
    
    
    
    function units_to_double (_i: number): number;
    
    
    
    function version (): number;
    
    
    
    function version_check (required_major: number, required_minor: number, required_micro: number): string;
    
    
    
    function version_string (): string;
    
    }