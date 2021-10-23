declare namespace imports.gi.cairo {

    class Context {

        /**
         * Sets the source pattern within Context to source. This pattern will then be used for any subsequent drawing operation until a new source pattern is set.
         * 
         * Note: The pattern’s transformation matrix will be locked to the user space in effect at the time of setSource(). This means that further modifications of the current transformation matrix will not affect the source pattern. See Pattern.setMatrix()
         * 
         * The default source pattern is a solid pattern that is opaque black, (that is, it is equivalent to setSourceRGB(0.0, 0.0, 0.0)
         * 
         * @param source  a Pattern to be used as the source for subsequent drawing operations.
         */
        setSource(source: Pattern): void


        /**
         * Sets the source pattern within Context to a translucent color. This color will then be used for any subsequent drawing operation until a new source pattern is set.
         * 
         * The color and alpha components are floating point numbers in the range 0 to 1. If the values passed in are outside that range, they will be clamped.
         * 
         * The default source pattern is opaque black, (that is, it is equivalent to setSourceRGBA(0.0, 0.0, 0.0, 1.0)
         * 
         * @param red red component of color
         * @param green green component of color
         * @param blue blue component of color
         * @param alpha  alpha component of color
         */
        setSourceRGBA(red: number, green: number, blue: number, alpha: number): void

        /**
         * Adds a circular arc of the given radius to the current path. The arc is centered at (xc, yc), begins at angle1 and proceeds in the direction of increasing angles to end at angle2. If angle2 is less than angle1 it will be progressively increased by 2*PI until it is greater than angle1.
         * 
         * If there is a current point, an initial line segment will be added to the path to connect the current point to the beginning of the arc. If this initial line is undesired, it can be avoided by calling Context.new_sub_path() before calling Context.arc().
         * 
         * Angles are measured in radians. An angle of 0.0 is in the direction of the positive X axis (in user space). An angle of PI/2.0 radians (90 degrees) is in the direction of the positive Y axis (in user space). Angles increase in the direction from the positive X axis toward the positive Y axis. So with the default transformation matrix, angles increase in a clockwise direction. 
         * 
         * To convert from degrees to radians, use degrees * (math.pi / 180).
         * 
         * This function gives the arc in the direction of increasing angles; see Context.arc_negative() to get the arc in the direction of decreasing angles.
         * 
         * The arc is circular in user space. To achieve an elliptical arc, you can scale the current transformation matrix by different amounts in the X and Y directions. For example, to draw an ellipse in the box given by x, y, width, height:
         * 
         * @param xc  X position of the center of the arc
         * @param yc  Y position of the center of the arc
         * @param radius the radius of the arc
         * @param angle1 the start angle, in radians
         * @param angle2 the end angle, in radians
         */
        arc(xc: number, yc: number, radius: number, angle1: number, angle2: number): void



        /**
         * Adds a closed sub-path rectangle of the given size to the current path at position (x, y) in user-space coordinates.
         * 
         * 
         * @param x  the X coordinate of the top left corner of the rectangle
         * @param y  the Y coordinate to the top left corner of the rectangle
         * @param width the width of the rectangle
         * @param height the height of the rectangle
         */
        rectangle(x: number, y: number, width: number, height: number): void

        /**
         * A drawing operator that fills the current path according to the current fill rule, (each sub-path is implicitly closed before being filled). After fill(), the current path will be cleared from the Context. See Context.set_fill_rule() and Context.fill_preserve().
         * 
         */
        fill(): void

        /**
         * A drawing operator that fills the current path according to the current fill rule, (each sub-path is implicitly closed before being filled). Unlike Context.fill(), fillPreserve() preserves the path within the Context
         */
        fillPreserve(): void

        /**
         * Adds a line to the path from the current point to position (x, y) in user-space coordinates. After this call the current point will be (x, y).
         * 
         * If there is no current point before the call to line_to() this function will behave as ctx.moveTo(x, y)
         * 
         * @param x the X coordinate of the end of the new line
         * @param y the Y coordinate of the end of the new line
         */
        lineTo(x: number, y: number): void


        /**
         * Sets the current line width within the Context. The line width value specifies the diameter of a pen that is circular in user space, (though device-space pen may be an ellipse in general due to scaling/shear/rotation of the CTM).
         * 
         * Note: When the description above refers to user space and CTM it refers to the user space and CTM in effect at the time of the stroking operation, not the user space and CTM in effect at the time of the call to set_line_width(). The simplest usage makes both of these spaces identical. That is, if there is no change to the CTM between a call to set_line_width() and the stroking operation, then one can just pass user-space values to set_line_width() and ignore this note.
         * 
         * As with the other stroke parameters, the current line width is examined by stroke(), stroke_extents(), and stroke_to_path(), but does not have any effect during path construction.
         * 
         * The default line width value is 2.0.
         * 
         * @param width a line width;
         */
        setLineWidth(width: number): void


        /**
         * A drawing operator that strokes the current path according to the current line width, line join, line cap, and dash settings. After stroke(), the current path will be cleared from the cairo context. See set_line_width(), set_line_join(), set_line_cap(), set_dash(), and stroke_preserve().
         * 
         * Note: Degenerate segments and sub-paths are treated specially and provide a useful result. These can result in two different situations:
         * 
         * 1. Zero-length “on” segments set in set_dash(). If the cap style is cairo.LineCap.ROUND or cairo.LineCap.SQUARE then these segments will be drawn as circular dots or squares respectively. In the case of cairo.LineCap.SQUARE, the orientation of the squares is determined by the direction of the underlying path.
         * 
         * 2. A sub-path created by move_to() followed by either a close_path() or one or more calls to line_to() to the same coordinate as the move_to(). If the cap style is cairo.LineCap.ROUND then these sub-paths will be drawn as circular dots. Note that in the case of cairo.LineCap.SQUARE a degenerate sub-path will not be drawn at all, (since the correct orientation is indeterminate).
         * 
         * In no case will a cap style of cairo.LineCap.BUTT cause anything to be drawn in the case of either degenerate segments or sub-paths
         */
        stroke(): void

        $dispose(): void

    }



    class Device {


    }



    class Surface {


    }



    class Matrix {


    }



    class Pattern {


    }



    class Region {


    }



    class FontOptions {


    }



    class FontFace {


    }



    class ScaledFont {


    }



    class Path {


    }



    class Rectangle {
        public x: number;
        public y: number;
        public width: number;
        public height: number;


    }

    class RectangleInt {
        public x: number;
        public y: number;
        public width: number;
        public height: number;
    }

    class Gradient extends Pattern {

        /**
         * Adds a translucent color stop to a gradient pattern.
         * 
         * The offset specifies the location along the gradient's control vector. For example, a linear gradient's control vector is from (x0,y0) to (x1,y1) while a radial gradient's control vector is from any point on the start circle to the corresponding point on the end circle.
         * 
         * The color is specified in the same way as in Context::set_source_rgba().
         * 
         * If two (or more) stops are specified with identical offset values, they will be sorted according to the order in which the stops are added, (stops added earlier will compare less than stops added later). This can be useful for reliably making sharp color transitions instead of the typical blend.
         * 
         * @param offset an offset in the range [0.0 .. 1.0];
         * @param red 	red component of color
         * @param green green component of color
         * @param blue blue component of color
         * @param alpha alpha component of color
         */
        addColorStopRGBA(offset: number, red: number, green: number, blue: number, alpha: number): void

    }

    class LinearGradient extends Gradient {
        /**
         * Create a new linear gradient along the line defined by (x0, y0) and (x1, y1).
         * 
         * Before using the gradient pattern, a number of color stops should be defined 
         * using addColorStopRGB() or addColorStopRGBA().
         * 
         * Note: The coordinates here are in pattern space. For a new pattern, pattern space is 
         * identical to user space, but the relationship between the spaces can be changed with 
         * Cairo::Pattern::set_matrix().
         * 
         * @param x0 x coordinate of the start point
         * @param y0 y coordinate of the start point
         * @param x1 x coordinate of the end point
         * @param y1 y coordinate of the end point
         */
        constructor(x0: number, y0: number, x1: number, y1: number)

    }

    enum Status {
        SUCCESS = 0,
        NO_MEMORY = 1,
        INVALID_RESTORE = 2,
        INVALID_POP_GROUP = 3,
        NO_CURRENT_POINT = 4,
        INVALID_MATRIX = 5,
        INVALID_STATUS = 6,
        NULL_POINTER = 7,
        INVALID_STRING = 8,
        INVALID_PATH_DATA = 9,
        READ_ERROR = 10,
        WRITE_ERROR = 11,
        SURFACE_FINISHED = 12,
        SURFACE_TYPE_MISMATCH = 13,
        PATTERN_TYPE_MISMATCH = 14,
        INVALID_CONTENT = 15,
        INVALID_FORMAT = 16,
        INVALID_VISUAL = 17,
        FILE_NOT_FOUND = 18,
        INVALID_DASH = 19,
        INVALID_DSC_COMMENT = 20,
        INVALID_INDEX = 21,
        CLIP_NOT_REPRESENTABLE = 22,
        TEMP_FILE_ERROR = 23,
        INVALID_STRIDE = 24,
        FONT_TYPE_MISMATCH = 25,
        USER_FONT_IMMUTABLE = 26,
        USER_FONT_ERROR = 27,
        NEGATIVE_COUNT = 28,
        INVALID_CLUSTERS = 29,
        INVALID_SLANT = 30,
        INVALID_WEIGHT = 31,
        INVALID_SIZE = 32,
        USER_FONT_NOT_IMPLEMENTED = 33,
        DEVICE_TYPE_MISMATCH = 34,
        DEVICE_ERROR = 35,
        INVALID_MESH_CONSTRUCTION = 36,
        DEVICE_FINISHED = 37,
        JBIG2_GLOBAL_MISSING = 38
    }



    enum Content {
        COLOR = 4096,
        ALPHA = 8192,
        COLOR_ALPHA = 12288
    }



    enum Operator {
        CLEAR = 0,
        SOURCE = 1,
        OVER = 2,
        IN = 3,
        OUT = 4,
        ATOP = 5,
        DEST = 6,
        DEST_OVER = 7,
        DEST_IN = 8,
        DEST_OUT = 9,
        DEST_ATOP = 10,
        XOR = 11,
        ADD = 12,
        SATURATE = 13,
        MULTIPLY = 14,
        SCREEN = 15,
        OVERLAY = 16,
        DARKEN = 17,
        LIGHTEN = 18,
        COLOR_DODGE = 19,
        COLOR_BURN = 20,
        HARD_LIGHT = 21,
        SOFT_LIGHT = 22,
        DIFFERENCE = 23,
        EXCLUSION = 24,
        HSL_HUE = 25,
        HSL_SATURATION = 26,
        HSL_COLOR = 27,
        HSL_LUMINOSITY = 28
    }



    enum Antialias {
        DEFAULT = 0,
        NONE = 1,
        GRAY = 2,
        SUBPIXEL = 3,
        FAST = 4,
        GOOD = 5,
        BEST = 6
    }



    enum FillRule {
        WINDING = 0,
        EVEN_ODD = 1
    }



    enum LineCap {
        BUTT = 0,
        ROUND = 1,
        SQUARE = 2
    }



    enum LineJoin {
        MITER = 0,
        ROUND = 1,
        BEVEL = 2
    }



    enum TextClusterFlags {
        BACKWARD = 1
    }



    enum FontSlant {
        NORMAL = 0,
        ITALIC = 1,
        OBLIQUE = 2
    }



    enum FontWeight {
        NORMAL = 0,
        BOLD = 1
    }



    enum SubpixelOrder {
        DEFAULT = 0,
        RGB = 1,
        BGR = 2,
        VRGB = 3,
        VBGR = 4
    }



    enum HintStyle {
        DEFAULT = 0,
        NONE = 1,
        SLIGHT = 2,
        MEDIUM = 3,
        FULL = 4
    }



    enum HintMetrics {
        DEFAULT = 0,
        OFF = 1,
        ON = 2
    }



    enum FontType {
        TOY = 0,
        FT = 1,
        WIN32 = 2,
        QUARTZ = 3,
        USER = 4
    }



    enum PathDataType {
        MOVE_TO = 0,
        LINE_TO = 1,
        CURVE_TO = 2,
        CLOSE_PATH = 3
    }



    enum DeviceType {
        DRM = 0,
        GL = 1,
        SCRIPT = 2,
        XCB = 3,
        XLIB = 4,
        XML = 5,
        COGL = 6,
        WIN32 = 7,
        INVALID = -1
    }



    enum SurfaceType {
        IMAGE = 0,
        PDF = 1,
        PS = 2,
        XLIB = 3,
        XCB = 4,
        GLITZ = 5,
        QUARTZ = 6,
        WIN32 = 7,
        BEOS = 8,
        DIRECTFB = 9,
        SVG = 10,
        OS2 = 11,
        WIN32_PRINTING = 12,
        QUARTZ_IMAGE = 13,
        SCRIPT = 14,
        QT = 15,
        RECORDING = 16,
        VG = 17,
        GL = 18,
        DRM = 19,
        TEE = 20,
        XML = 21,
        SKIA = 22,
        SUBSURFACE = 23,
        COGL = 24
    }



    enum Format {
        INVALID = -1,
        ARGB32 = 0,
        RGB24 = 1,
        A8 = 2,
        A1 = 3,
        RGB16_565 = 4,
        RGB30 = 5
    }



    enum PatternType {
        SOLID = 0,
        SURFACE = 1,
        LINEAR = 2,
        RADIAL = 3,
        MESH = 4,
        RASTER_SOURCE = 5
    }



    enum Extend {
        NONE = 0,
        REPEAT = 1,
        REFLECT = 2,
        PAD = 3
    }



    enum Filter {
        FAST = 0,
        GOOD = 1,
        BEST = 2,
        NEAREST = 3,
        BILINEAR = 4,
        GAUSSIAN = 5
    }



    enum RegionOverlap {
        IN = 0,
        OUT = 1,
        PART = 2
    }



    function image_surface_create (): void;

}