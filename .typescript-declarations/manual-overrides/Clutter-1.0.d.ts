declare namespace imports.gi.Clutter {

  /** Write only */
  interface IActor {
    /**
     * 
     * 
 * According to the GJS docs (https://gjs-docs.gnome.org), the Clutter 
 * Actor properties 'x_align' and 'y_align' have the type Clutter.ActorAlign. 
 * However according to the gnome docs (https://developer.gnome.org/st/stable/StBin.html) 
 * and own observations, the St.Bin properties 'x_align' and 'y_align' are 
 * actually of the type St.Align. This means in order to allow St.Bin as well 
 * as  other St classes to implement Clutter.Actor the Clutter.Actor 
 * x_align and y_align props have to be either of type Clutter.
 * ActorAlign or St.Align and each class inheriting from Clutter.Actor 
 * must be speficy the type by it's own. 
* 
*/
    x_align: ActorAlign | St.Align;
    /** See {@link x_align} */
    y_align: ActorAlign | St.Align;
  }

  interface ButtonEvent extends Event {

  }

  interface CrossingEvent extends Event {
    
  }

  interface KeyEvent extends Event {
    
  }

  interface MotionEvent extends Event {
    
  }

  interface ScrollEvent extends Event {
    
  }

  interface AnyEvent extends Event {
    
  }

  interface PointOptions {
    x: number;
    y: number
  }

  interface Color {
    /**
 * Converts a color expressed in HLS (hue, luminance and saturation)
 * values into a Clutter.Color.
 * @param hue hue value, in the 0 .. 360 range
 * @param luminance luminance value, in the 0 .. 1 range
 * @param saturation saturation value, in the 0 .. 1 range
 * @returns return location for a Clutter.Color
 */
    //static from_hls(hue: number, luminance: number, saturation: number): Color;
    /**
     * Converts pixel from the packed representation of a four 8 bit channel
     * color to a Clutter.Color.
     * @param pixel a 32 bit packed integer containing a color
     */
    //static from_pixel(pixel: number): Color;
    /**
     * Parses a string definition of a color, filling the Clutter.Color.red,
     * Clutter.Color.green, Clutter.Color.blue and Clutter.Color.alpha fields
     * of color.
       * 
     * The color is not allocated.
       * 
     * The format of str can be either one of:
       * 
     *     a standard name (as taken from the X11 rgb.txt file)
     *     an hexadecimal value in the form: #rgb, #rrggbb, #rgba, or #rrggbbaa
     *     a RGB color in the form: rgb(r, g, b)
     *     a RGB color in the form: rgba(r, g, b, a)
     *     a HSL color in the form: hsl(h, s, l)
     *     -a HSL color in the form: hsla(h, s, l, a)
       * 
     * where 'r', 'g', 'b' and 'a' are (respectively) the red, green, blue color
     * intensities and the opacity. The 'h', 's' and 'l' are (respectively) the
     * hue, saturation and luminance values.
       * 
     * In the rgb() and rgba() formats, the 'r', 'g', and 'b' values are either
     * integers between 0 and 255, or percentage values in the range between 0%
     * and 100%; the percentages require the '%' character. The 'a' value, if
     * specified, can only be a floating point value between 0.0 and 1.0.
       * 
     * In the hls() and hlsa() formats, the 'h' value (hue) is an angle between
     * 0 and 360.0 degrees; the 'l' and 's' values (luminance and saturation) are
     * percentage values in the range between 0% and 100%. The 'a' value, if specified,
     * can only be a floating point value between 0.0 and 1.0.
       * 
     * Whitespace inside the definitions is ignored; no leading whitespace
     * is allowed.
       * 
     * If the alpha component is not specified then it is assumed to be set to
     * be fully opaque.
     * @param str  a string specifying a color
     * @returns :
     * - ok (Boolean) — true if parsing succeeded, and false otherwise
     * - color (Clutter.Color) — return location for a Clutter.Color
     */
    //static from_string(str: string): any[];
    /**
     * Retrieves a static color for the given color name

     * Static colors are created by Clutter and are guaranteed to always be
     * available and valid
     * @param color the named global color
     * @returns a pointer to a static color; the returned pointer
     * is owned by Clutter and it should never be modified or freed
     */
    //static get_static(color: StaticColor): Color;
    /**
     * Allocates a new, transparent black Clutter.Color.
     * @returns the newly allocated Clutter.Color; use
     * Clutter.Color.free to free its resources
     */
    //static alloc(): Color;
  }

  export interface Clip {
    /** return location for the X offset of
     * the clip rectangle, or null */
    xoff: number;
    /** return location for the Y offset of
     * the clip rectangle, or null */
    yoff: number;
    /** return location for the width of
     * the clip rectangle, or null */
    width: number;
    /** return location for the height of
     * the clip rectangle, or null */
    height: number;
  }

  export interface ContentScalingFilters {
    /**  return location for the minification
     * filter, or null */
    min_filter: ScalingFilter;
    /** return location for the magnification
     * filter, or null */
    mag_filter: ScalingFilter;
  }

  export interface FixedPosition {
    /** true if the fixed position is set, false if it isn't */
    ok: boolean;
    /** return location for the X coordinate, or null */
    x: number;
    /** return location for the Y coordinate, or null */
    y: number;
  }

  export interface PaintBoxResult {
    /** true if a 2D paint box could be determined, else
     * false. */
    ok: boolean;
    /** return location for a Clutter.ActorBox */
    box: ActorBox;
  }

  export interface PivotPointResult {
    /** return location for the normalized X
    coordinate of the pivot point, or null */
    pivot_x: number;
    /** return location for the normalized Y
    coordinate of the pivot point, or null */
    pivot_y: number;
  }

  export enum DebugFlag {

  }

  export enum PickDebugFlag {

  }

  export enum DrawDebugFlag {

  }

  export interface PositionResult {
    /** return location for the X coordinate, or null */
    x: number;
    /** return location for the Y coordinate, or null */
    y: number;
  }

  export class PickContext { }

  export class PaintContext { }

  export enum InputContentPurpose {
    NORMAL = 0,
    ALPHA = 1,
    DIGITS = 2,
    NUMBER = 3,
    PHONE = 4,
    URL = 5,
    EMAIL = 6,
    NAME = 7,
    PASSWORD = 8,
    DATE = 9,
    TIME = 10,
    DATETIME = 11,
    TERMINAL = 12,
  }

  export enum InputContentHintFlags {
    
  }
}