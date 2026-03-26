// Copied together from:
// .typescript-declarations
// https://github.com/gjsify/types/blob/c1a8a92/Gjs/cairo-1.0.d.ts
// some manual additions from Cairo API references: https://www.cairographics.org/manual/api-index-all.html
declare namespace imports.gi.cairo {
  // manually added from Cairo reference: https://www.cairographics.org/manual/api-index-all.html
  interface Surface {
    /**
     * Get the width of the image surface in pixels.
     *
     * @returns the width of the surface in pixels.
     */
    getWidth(): number

    /**
     * Get the height of the image surface in pixels.
     *
     * @returns the width of the surface in pixels.
     */
    getHeight(): number
  }

  // manually added from Cairo reference: https://www.cairographics.org/manual/api-index-all.html
  interface Pattern {
    /**
     * Sets the filter to be used for resizing when using this pattern. See cairo_filter_t for details on each filter.
     *
     * Note that you might want to control filtering even when you do not have an explicit cairo_pattern_t object, (for example when using cairo_set_source_surface()). In these cases, it is convenient to use cairo_get_source() to get access to the pattern that cairo creates implicitly. For example:
     * ```c
     * cairo_set_source_surface (cr, image, x, y);
     * cairo_pattern_set_filter (cairo_get_source (cr), CAIRO_FILTER_NEAREST);
     * ```
     * @param filter describing the filter to use for resizing the pattern
     */
    setFilter(filter: Filter)
  }

  /**
   * Enum representing the filtering options for cairo patterns.
   * Used to indicate what filtering should be applied when reading pixel values from patterns.
   * See cairo_pattern_set_filter() for indicating the desired filter to be used with a particular pattern.
   */
  enum Filter {
    /**
     * A high-performance filter, with quality similar to CAIRO_FILTER_NEAREST.
     */
    FAST,

    /**
     * A reasonable-performance filter, with quality similar to CAIRO_FILTER_BILINEAR.
     */
    GOOD,

    /**
     * The highest-quality available, performance may not be suitable for interactive use.
     */
    BEST,

    /**
     * Nearest-neighbor filtering.
     */
    NEAREST,

    /**
     * Linear interpolation in two dimensions.
     */
    BILINEAR,

    /**
     * This filter value is currently unimplemented, and should not be used in current code.
     */
    GAUSSIAN,
  }

  /**
   * Enum representing the compositing operators for cairo drawing operations.
   * Used to set the compositing operator for all cairo drawing operations.
   * The default operator is CAIRO_OPERATOR_OVER.
   *
   * The operators marked as unbounded modify their destination even outside of the mask layer.
   */
  enum Operator {
    /**
     * Clear destination layer (bounded).
     */
    CLEAR,

    /**
     * Replace destination layer (bounded).
     */
    SOURCE,

    /**
     * Draw source layer on top of destination layer (bounded).
     */
    OVER,

    /**
     * Draw source where there was destination content (unbounded).
     */
    IN,

    /**
     * Draw source where there was no destination content (unbounded).
     */
    OUT,

    /**
     * Draw source on top of destination content and only there.
     */
    ATOP,

    /**
     * Ignore the source.
     */
    DEST,

    /**
     * Draw destination on top of source.
     */
    DEST_OVER,

    /**
     * Leave destination only where there was source content (unbounded).
     */
    DEST_IN,

    /**
     * Leave destination only where there was no source content.
     */
    DEST_OUT,

    /**
     * Leave destination on top of source content and only there (unbounded).
     */
    DEST_ATOP,

    /**
     * Source and destination are shown where there is only one of them.
     */
    XOR,

    /**
     * Source and destination layers are accumulated.
     */
    ADD,

    /**
     * Like over, but assuming source and dest are disjoint geometries.
     */
    SATURATE,

    /**
     * Source and destination layers are multiplied.
     */
    MULTIPLY,

    /**
     * Source and destination are complemented and multiplied.
     */
    SCREEN,

    /**
     * Multiplies or screens, depending on the lightness of the destination color.
     */
    OVERLAY,

    /**
     * Replaces the destination with the source if it is darker.
     */
    DARKEN,

    /**
     * Replaces the destination with the source if it is lighter.
     */
    LIGHTEN,

    /**
     * Brightens the destination color to reflect the source color.
     */
    COLOR_DODGE,

    /**
     * Darkens the destination color to reflect the source color.
     */
    COLOR_BURN,

    /**
     * Multiplies or screens, dependent on source color.
     */
    HARD_LIGHT,

    /**
     * Darkens or lightens, dependent on source color.
     */
    SOFT_LIGHT,

    /**
     * Takes the difference of the source and destination color.
     */
    DIFFERENCE,

    /**
     * Produces an effect similar to difference, but with lower contrast.
     */
    EXCLUSION,

    /**
     * Creates a color with the hue of the source and the saturation and luminosity of the target.
     */
    HSL_HUE,

    /**
     * Creates a color with the saturation of the source and the hue and luminosity of the target.
     */
    HSL_SATURATION,

    /**
     * Creates a color with the hue and saturation of the source and the luminosity of the target.
     */
    HSL_COLOR,

    /**
     * Creates a color with the luminosity of the source and the hue and saturation of the target.
     */
    HSL_LUMINOSITY,
  }

  // manually added from Cairo reference: https://www.cairographics.org/manual/api-index-all.html
  interface Context {
    /**
     * Modifies the current transformation matrix (CTM) by rotating the user-space axes by angle radians. The rotation of the axes takes places after any existing transformation of user space. The rotation direction for positive angles is from the positive X axis toward the positive Y axis.
     *
     * @param angle (in radians) by which the user-space axes will be rotated
     */
    rotate(angle: number): void

    /**
     * Modifies the current transformation matrix (CTM) by translating the user-space origin by (tx , ty ). This offset is interpreted as a user-space coordinate according to the CTM in place before the new call to cairo_translate(). In other words, the translation of the user-space origin takes place after any existing transformation.
     *
     * @param tx amount to translate in the X direction
     * @param ty amount to translate in the Y direction
     */
    translate(tx: number, ty: number): void
    /**
     * This is a convenience function for creating a pattern from surface and setting it as the source in cr with cairo_set_source().
     *
     * The x and y parameters give the user-space coordinate at which the surface origin should appear. (The surface origin is its upper-left corner before any transformation has been applied.) The x and y parameters are negated and then set as translation values in the pattern matrix.
     *
     * Other than the initial translation pattern matrix, as described above, all other pattern attributes, (such as its extend mode), are set to the default values as in cairo_pattern_create_for_surface(). The resulting pattern can be queried with cairo_get_source() so that these attributes can be modified if desired, (eg. to create a repeating pattern with cairo_pattern_set_extend()).
     *
     * @param surface a surface to be used to set the source pattern
     * @param x User-space X coordinate for surface origin
     * @param y User-space Y coordinate for surface origin
     */
    setSourceSurface(surface: any, x: number, y: number): void

    /**
     * Sets the compositing operator to be used for all drawing operations. See cairo_operator_t for details on the semantics of each available compositing operator.
     *
     * @param op a compositing operator, specified as a cairo_operator_t
     */
    setOperator(op: Operator): void

    /**
     * A drawing operator that paints the current source everywhere within the current clip region.
     */
    paint(): void

    /**
     * Restores cr to the state saved by a preceding call to cairo_save() and removes that state from the stack of saved states.
     */
    restore(): void

    /**
     * Makes a copy of the current state of cr and saves it on an internal stack of saved states for cr . When cairo_restore() is called, cr will be restored to the saved state. Multiple calls to cairo_save() and cairo_restore() can be nested; each call to cairo_restore() restores the state from the matching paired cairo_save().
     *
     * It isn't necessary to clear all saved states before a cairo_t is freed. If the reference count of a cairo_t drops to zero in response to a call to cairo_destroy(), any saved states will be freed along with the cairo_t.
     */
    save(): void

    /**
     * Modifies the current transformation matrix (CTM) by scaling the X and Y user-space axes by sx and sy respectively. The scaling of the axes takes place after any existing transformation of user space.
     *
     * @param sx scale factor for the X dimension
     * @param sy scale factor for the Y dimension
     */
    scale(sx: number, sy: number): void

    /**
     * Gets the current source pattern for cr.
     *
     * @returns the current source pattern. This object is owned by cairo. To keep a reference to it, you must call cairo_pattern_reference().
     */
    getSource(): Pattern

    // ----------------------------------------

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
     * Begin a new sub-path. After this call the current point will be (x, y). Since 1.0
     * @param x the X coordinate of the new position
     * @param y the Y coordinate of the new position
     */
    moveTo(x: number, y: number): void

    /**
     * Adds a cubic Bézier spline to the path from the current point to position (x3, y3) in user-space coordinates, using (x1, y1) and (x2, y2) as the control points. After this call the current point will be (x3, y3). If there is no current point before the call to cairo_curve_to() this function will behave as if preceded by a call to cairo_move_to(cr, x1, y1). Since 1.0
     * @param x1     the X coordinate of the first control point
     * @param y1     the Y coordinate of the first control point
     * @param x2     the X coordinate of the second control point
     * @param y2     the Y coordinate of the second control point
     * @param x3     the X coordinate of the end of the curve
     * @param y3     the Y coordinate of the end of the curve
     */
    curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void

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
}
