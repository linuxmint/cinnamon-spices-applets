import { isAnimationSpeedValid } from "utils/common"
import { getPixbufFromFileAtScale } from "utils/pixbuf"

const { St, GLib, GObject, Gdk } = imports.gi

export class AnimationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AnimationError"
  }
}

// The Animation class uses its own dedicated rotation type in its interface, rather than an existing type (e.g., PixbufRotation), to maintain library agnosticism from the outside.
// The internal rotation implementation might change in the future; for example, it could be realized with Cairo.
export type AnimationRotation = 0 | 90 | 180 | 270
export type RenderOptions = {
  width?: number
  height?: number
  rotation?: AnimationRotation
}

export type AnimationProps = {
  file: imports.gi.Gio.File
  frames: number
  speed: number
  renderOptions?: RenderOptions
}

// used internally; holds the information which is required in the paint method (Cairo)
type RenderData = {
  // original image converted to a Cairo surface
  surface: imports.gi.cairo.Surface
  frameWidth: number
  frameHeight: number
  rotation: AnimationRotation
}

// Animation approach using a Cairo surface:
// The animation image containing all frames is loaded as a Pixbuf.
// The Pixbuf is then converted into a Cairo surface and painted onto an St.DrawingArea.
// During painting, an offset on the x-axis is set to display only one frame of the animation image.
// A timeout repeatedly calls an update method, which updates the offset value to show the next frame and enqueues a repaint.
export const Animation = GObject.registerClass(
  class Animation extends St.Bin {
    private file: imports.gi.Gio.File
    private frames: number
    private speed: number
    private renderOptions: RenderOptions | undefined

    // is initialized in helper method "loadAnimationData"
    private renderData!: RenderData
    private drawingArea: imports.gi.St.DrawingArea

    private timeoutId: number
    private isLoaded: boolean
    // currently displayed frame
    private frame: number

    constructor(animationProps: AnimationProps) {
      const { file, frames, speed, renderOptions } = animationProps
      // init St.Bin
      super()

      this.set_style_class_name("animation")

      this.file = file
      if (frames < 1 || !Number.isInteger(frames)) {
        throw new AnimationError(`Invalid frame count. Value: ${frames}`)
      }
      this.frames = frames
      if (!isAnimationSpeedValid(speed)) {
        throw new AnimationError(`Animation speed is invalid. Value: ${speed}`)
      }
      this.speed = speed
      this.renderOptions = renderOptions

      this.timeoutId = 0
      this.frame = 0

      // Initializes the data required for painting and box sizing, taking into account the specified rendering options (if any).
      // The method for reading the image into a Pixbuf (see utility function) can throw an error if the provided parameters are invalid.
      // For example, an error may occur if the dimensions become negative due to excessively large margin.
      try {
        this.loadRenderData()
      } catch (error) {
        throw new AnimationError(`Could not load image data: ${error}`)
      }
      // DrawingArea is a container where the animation frame will be painted onto (using Cairo).
      this.drawingArea = new St.DrawingArea()
      this.drawingArea.set_size(this.renderData.frameWidth, this.renderData.frameHeight)
      this.drawingArea.connect("repaint", this.onRepaint.bind(this))
      this.set_child(this.drawingArea)

      this.connect("destroy", () => this.onDestroy())
      this.isLoaded = true
    }

    public setSpeed(speed: number): void {
      if (!isAnimationSpeedValid(speed)) {
        throw new AnimationError(`Animation speed is invalid. Value: ${speed}`)
      }
      this.stop()
      this.speed = speed
      this.play()
    }

    public play() {
      if (this.isLoaded && this.timeoutId === 0) {
        if (this.frame === 0) {
          this.showFrame(0)
        }
        this.timeoutId = GLib.timeout_add(GLib.PRIORITY_LOW, this.speed, this.update.bind(this))
        GLib.Source.set_name_by_id(this.timeoutId, `[cinnamon] this.update`)
      }
    }

    public stop() {
      if (this.timeoutId > 0) {
        GLib.source_remove(this.timeoutId)
        this.timeoutId = 0
      }
    }

    public pause() {
      // stop timeout
      if (this.timeoutId > 0) {
        GLib.source_remove(this.timeoutId)
        this.timeoutId = 0
      }
    }

    public resume() {
      this.play()
    }

    private showFrame(frame: number) {
      this.frame = frame % this.frames
    }

    private update(): boolean {
      // show next animation frame
      this.showFrame(this.frame + 1)
      this.drawingArea.queue_repaint()
      return GLib.SOURCE_CONTINUE
    }

    private loadRenderData(): void {
      // Reads the image file into a Pixbuf:
      // If render options are specified, load the image with a specific scale to fit into place.
      // Otherwise, load the image with its original dimensions. This might cause issues if the image is too large.

      // parameters for Pixbuf function below
      let pixbufWidth: number
      let pixbufHeight: number
      let preserveAspectRatio: boolean
      let pixbufRotation: imports.gi.GdkPixbuf.PixbufRotation | undefined

      if (!this.renderOptions) {
        // use original dimension
        pixbufWidth = -1
        pixbufHeight = -1
        preserveAspectRatio = true
        pixbufRotation = undefined
      } else {
        // scale image to fit specified options
        pixbufWidth = this.renderOptions.width ? this.renderOptions.width * this.frames : -1
        pixbufHeight = this.renderOptions.height ?? -1
        preserveAspectRatio = this.renderOptions.width === undefined || this.renderOptions.height === undefined
        pixbufRotation =
          this.renderOptions.rotation !== undefined
            ? mapAnimationRotationToPixbufRotation(this.renderOptions.rotation)
            : undefined
      }

      let rotation: AnimationRotation
      if (this.renderOptions && this.renderOptions.rotation) {
        rotation = this.renderOptions.rotation
      } else {
        rotation = 0
      }

      // This call can throw an error.
      let pixbuf = getPixbufFromFileAtScale(this.file, pixbufWidth, pixbufHeight, preserveAspectRatio)
      // apply rotation on loaded image
      if (pixbufRotation) {
        const rotated_pixbuf = pixbuf.rotate_simple(pixbufRotation)
        if (rotated_pixbuf) {
          pixbuf = rotated_pixbuf
        } else {
          throw new AnimationError(`Image rotation failed.`)
        }
      }
      const surface = Gdk.cairo_surface_create_from_pixbuf(pixbuf, 1, null)

      let frameWidth: number
      let frameHeight: number
      switch (rotation) {
        case 0:
        case 180:
          frameWidth = Math.round(pixbuf.get_width() / this.frames)
          frameHeight = pixbuf.get_height()
          break
        case 90:
        case 270:
          frameWidth = pixbuf.get_width()
          frameHeight = Math.round(pixbuf.get_height() / this.frames)
          break
        default:
          throw new AnimationError(`Invalid rotation value: ${rotation}`)
      }

      const renderData: RenderData = {
        surface,
        frameWidth,
        frameHeight,
        rotation,
      }
      this.renderData = renderData
    }

    // paints the fish onto the drawing area using Cairo (cr)
    private onRepaint(area: imports.gi.St.DrawingArea): void {
      const cr = area.get_context()
      cr.save()

      // // alternative approach of rotation using Cairo:
      // const rotationAngle = Math.PI / 2;
      // // Move the context to the center of the frame
      // cr.translate(this.renderData.frameWidth / 2, this.renderData.frameHeight / 2)
      // // Rotate the context by 180 degrees (PI radians)
      // cr.rotate(rotationAngle)
      // // Move the context back
      // cr.translate(-this.renderData.frameWidth / 2, -this.renderData.frameHeight / 2)

      // shift image to the current animation frame in consideration of orientation
      let imageOffset
      switch (this.renderData.rotation) {
        case 0:
          imageOffset = this.frame * this.renderData.frameWidth
          cr.setSourceSurface(this.renderData.surface, -imageOffset, 0)
          break
        case 180:
          {
            // The image is turned upside down. The animations needs to run "backwards".
            const currentFrame = this.frames - 1 - this.frame
            imageOffset = currentFrame * this.renderData.frameWidth
            cr.setSourceSurface(this.renderData.surface, -imageOffset, 0)
          }
          break
        case 90:
          imageOffset = this.frame * this.renderData.frameHeight
          cr.setSourceSurface(this.renderData.surface, 0, -imageOffset)
          break
        case 270:
          {
            // The image is turned upside down. The animations needs to run "backwards".
            const currentFrame = this.frames - 1 - this.frame
            imageOffset = currentFrame * this.renderData.frameHeight
            cr.setSourceSurface(this.renderData.surface, 0, -imageOffset)
          }
          break
        default:
          throw new AnimationError(`Invalid rotation value: ${this.renderData.rotation}`)
      }

      cr.getSource().setFilter(imports.gi.cairo.Filter.BEST)
      cr.setOperator(imports.gi.cairo.Operator.SOURCE)
      cr.paint()
      cr.restore()
      cr.$dispose()
    }

    private onDestroy() {
      this.stop()
    }
  },
)

export type Animation = InstanceType<typeof Animation>

// Helper function to convert the generic rotation type into the implementation specific rotation type.
function mapAnimationRotationToPixbufRotation(rotation: AnimationRotation): imports.gi.GdkPixbuf.PixbufRotation {
  switch (rotation) {
    case 0:
      return imports.gi.GdkPixbuf.PixbufRotation.NONE
    case 90:
      return imports.gi.GdkPixbuf.PixbufRotation.COUNTERCLOCKWISE
    case 180:
      return imports.gi.GdkPixbuf.PixbufRotation.UPSIDEDOWN
    case 270:
      return imports.gi.GdkPixbuf.PixbufRotation.CLOCKWISE
    default:
      throw new Error(`Invalid rotation value: ${rotation}`)
  }
}
