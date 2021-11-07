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