declare namespace imports.gi.GdkPixbuf {

    interface Pixbuf extends GObject.Object, Gio.Icon, Gio.LoadableIcon {
        add_alpha (substitute_color: boolean, _r: number, _g: number, _b: number) : Pixbuf;
        apply_embedded_orientation () : Pixbuf;
        composite (dest: Pixbuf, dest_x: number, dest_y: number, dest_width: number, dest_height: number, offset_x: number, offset_y: number, scale_x: number, scale_y: number, interp_type: InterpType, overall_alpha: number) : void;
        composite_color (dest: Pixbuf, dest_x: number, dest_y: number, dest_width: number, dest_height: number, offset_x: number, offset_y: number, scale_x: number, scale_y: number, interp_type: InterpType, overall_alpha: number, check_x: number, check_y: number, check_size: number, color1: number, color2: number) : void;
        composite_color_simple (dest_width: number, dest_height: number, interp_type: InterpType, overall_alpha: number, check_size: number, color1: number, color2: number) : Pixbuf;
        copy () : Pixbuf;
        copy_area (src_x: number, src_y: number, width: number, height: number, dest_pixbuf: Pixbuf, dest_x: number, dest_y: number) : void;
        copy_options (dest_pixbuf: Pixbuf) : boolean;
        fill (pixel: number) : void;
        flip (horizontal: boolean) : Pixbuf;
        get_bits_per_sample () : number;
        get_byte_length () : number;
        get_colorspace () : Colorspace;
        get_has_alpha () : boolean;
        get_height () : number;
        get_n_channels () : number;
        get_option (key: string) : string;
        get_options () : GLib.HashTable;
        get_pixels () : number[];
        get_pixels_with_length (length: number) : number[];
        get_rowstride () : number;
        get_width () : number;
        new_subpixbuf (src_x: number, src_y: number, width: number, height: number) : Pixbuf;
        read_pixel_bytes () : GLib.Bytes;
        read_pixels () : number;
        ref () : Pixbuf;
        remove_option (key: string) : boolean;
        rotate_simple (angle: PixbufRotation) : Pixbuf;
        saturate_and_pixelate (dest: Pixbuf, saturation: number, pixelate: boolean) : void;
        save (filename: string, _type: string, error: GLib.Error) : boolean;
        save_to_buffer (buffer: number[], buffer_size: number, _type: string, error: GLib.Error) : boolean;
        save_to_bufferv (buffer: number[], buffer_size: number, _type: string, option_keys: string[], option_values: string[]) : boolean;
        save_to_callback (save_func: PixbufSaveFunc, user_data: any, _type: string, error: GLib.Error) : boolean;
        save_to_callbackv (save_func: PixbufSaveFunc, user_data: any, _type: string, option_keys: string[], option_values: string[]) : boolean;
        save_to_stream (stream: Gio.OutputStream, _type: string, cancellable: Gio.Cancellable, error: GLib.Error) : boolean;
        save_to_stream_async (stream: Gio.OutputStream, _type: string, cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any) : void;
        save_to_streamv (stream: Gio.OutputStream, _type: string, option_keys: string[], option_values: string[], cancellable: Gio.Cancellable) : boolean;
        save_to_streamv_async (stream: Gio.OutputStream, _type: string, option_keys: string[], option_values: string[], cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any) : void;
        savev (filename: string, _type: string, option_keys: string[], option_values: string[]) : boolean;
        scale (dest: Pixbuf, dest_x: number, dest_y: number, dest_width: number, dest_height: number, offset_x: number, offset_y: number, scale_x: number, scale_y: number, interp_type: InterpType) : void;
        scale_simple (dest_width: number, dest_height: number, interp_type: InterpType) : Pixbuf;
        set_option (key: string, value: string) : boolean;
        unref () : void;
    }
    
    var Pixbuf: {
        new (colorspace: Colorspace, has_alpha: boolean, bits_per_sample: number, width: number, height: number) : Pixbuf;
        new_from_bytes (data: GLib.Bytes, colorspace: Colorspace, has_alpha: boolean, bits_per_sample: number, width: number, height: number, rowstride: number) : Pixbuf;
        new_from_data (data: number[], colorspace: Colorspace, has_alpha: boolean, bits_per_sample: number, width: number, height: number, rowstride: number, destroy_fn: PixbufDestroyNotify, destroy_fn_data: any) : Pixbuf;
        new_from_file (filename: string) : Pixbuf;
        new_from_file_at_scale (filename: string, width: number, height: number, preserve_aspect_ratio: boolean) : Pixbuf;
        new_from_file_at_size (filename: string, width: number, height: number) : Pixbuf;
        new_from_inline (data_length: number, data: number[], copy_pixels: boolean) : Pixbuf;
        new_from_resource (resource_path: string) : Pixbuf;
        new_from_resource_at_scale (resource_path: string, width: number, height: number, preserve_aspect_ratio: boolean) : Pixbuf;
        new_from_stream (stream: Gio.InputStream, cancellable: Gio.Cancellable) : Pixbuf;
        new_from_stream_at_scale (stream: Gio.InputStream, width: number, height: number, preserve_aspect_ratio: boolean, cancellable: Gio.Cancellable) : Pixbuf;
        new_from_stream_finish (async_result: Gio.AsyncResult) : Pixbuf;
        new_from_xpm_data (data: string[]) : Pixbuf;
        calculate_rowstride (colorspace: Colorspace, has_alpha: boolean, bits_per_sample: number, width: number, height: number) : number;
        get_file_info (filename: string, width: number, height: number) : PixbufFormat;
        get_file_info_async (filename: string, cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any) : void;
        get_file_info_finish (async_result: Gio.AsyncResult, width: number, height: number) : PixbufFormat;
        get_formats () : GLib.SList;
        new_from_stream_async (stream: Gio.InputStream, cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any) : void;
        new_from_stream_at_scale_async (stream: Gio.InputStream, width: number, height: number, preserve_aspect_ratio: boolean, cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any) : void;
        save_to_stream_finish (async_result: Gio.AsyncResult) : boolean;
    }
    
    
    
    
    interface PixbufAnimation extends GObject.Object {
        get_height () : number;
        get_iter (start_time: GLib.TimeVal) : PixbufAnimationIter;
        get_static_image () : Pixbuf;
        get_width () : number;
        is_static_image () : boolean;
        ref () : PixbufAnimation;
        unref () : void;
    }
    
    var PixbufAnimation: {
        new_from_file (filename: string) : PixbufAnimation;
        new_from_resource (resource_path: string) : PixbufAnimation;
        new_from_stream (stream: Gio.InputStream, cancellable: Gio.Cancellable) : PixbufAnimation;
        new_from_stream_finish (async_result: Gio.AsyncResult) : PixbufAnimation;
        new_from_stream_async (stream: Gio.InputStream, cancellable: Gio.Cancellable, callback: Gio.AsyncReadyCallback, user_data: any) : void;
    }
    
    
    
    
    interface PixbufAnimationIter extends GObject.Object {
        advance (current_time: GLib.TimeVal) : boolean;
        get_delay_time () : number;
        get_pixbuf () : Pixbuf;
        on_currently_loading_frame () : boolean;
    }
    
    var PixbufAnimationIter: {
        
        
    }
    
    
    
    
    interface PixbufLoader extends GObject.Object {
        close () : boolean;
        get_animation () : PixbufAnimation;
        get_format () : PixbufFormat;
        get_pixbuf () : Pixbuf;
        set_size (width: number, height: number) : void;
        write (buf: number[], count: number) : boolean;
        write_bytes (buffer: GLib.Bytes) : boolean;
    }
    
    var PixbufLoader: {
        new () : PixbufLoader;
        new_with_mime_type (mime_type: string) : PixbufLoader;
        new_with_type (image_type: string) : PixbufLoader;
        
    }
    
    
    
    
    interface PixbufSimpleAnim extends PixbufAnimation {
        add_frame (pixbuf: Pixbuf) : void;
        get_loop () : boolean;
        set_loop (loop: boolean) : void;
    }
    
    var PixbufSimpleAnim: {
        new (width: number, height: number, rate: number) : PixbufSimpleAnim;
        
    }
    
    
    
    
    interface PixbufSimpleAnimIter extends PixbufAnimationIter {
        
    }
    
    var PixbufSimpleAnimIter: {
        
        
    }
    
    
    
    
    class PixbufFormat {
    
    
        public copy () : PixbufFormat;
        public free () : void;
        public get_description () : string;
        public get_extensions () : string[];
        public get_license () : string;
        public get_mime_types () : string[];
        public get_name () : string;
        public is_disabled () : boolean;
        public is_save_option_supported (option_key: string) : boolean;
        public is_scalable () : boolean;
        public is_writable () : boolean;
        public set_disabled (disabled: boolean) : void;
    }
    
    
    
    class PixbufLoaderClass {
        public parent_class: GObject.ObjectClass;
    
        size_prepared : {(loader: PixbufLoader, width: number, height: number) : void;};
        area_prepared : {(loader: PixbufLoader) : void;};
        area_updated : {(loader: PixbufLoader, _x: number, _y: number, width: number, height: number) : void;};
        closed : {(loader: PixbufLoader) : void;};
    
    }
    
    
    
    class PixbufSimpleAnimClass {
    
    
    }
    
    
    
    enum Colorspace {
        rgb = 0
    }
    
    
    
    enum InterpType {
        nearest = 0,
        tiles = 1,
        bilinear = 2,
        hyper = 3
    }
    
    
    
    enum PixbufAlphaMode {
        bilevel = 0,
        full = 1
    }
    
    
    
    enum PixbufError {
        corrupt_image = 0,
        insufficient_memory = 1,
        bad_option = 2,
        unknown_type = 3,
        unsupported_operation = 4,
        failed = 5,
        incomplete_animation = 6
    }
    
    
    
    enum PixbufRotation {
        none = 0,
        counterclockwise = 90,
        upsidedown = 180,
        clockwise = 270
    }
    
    
    
    interface PixbufDestroyNotify {
        (pixels: number[], data: any) : void;
    }
    
    
    
    interface PixbufSaveFunc {
        (buf: number[], count: number, error: GLib.Error, data: any) : boolean;
    }
    
    
    
    function pixbuf_error_quark (): GLib.Quark;
    
    }