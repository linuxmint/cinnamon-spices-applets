import { isAnimationSpeedValid } from "utils/common"

const { St, Clutter, GLib, GObject } = imports.gi
export class AnimationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AnimationError"
  }
}

// Currently unused!
//
// Animation approach using St.TextureCache's load_sliced_image_file method:
// The sliced image method seems well-suited for animations:
// https://gjs-docs.gnome.org/st13~13/st.texturecache#method-load_sliced_image
// In GNOME Shell and Cinnamon, it is used, for example, for animating icons.
//
// However, I did not succeed in scaling the source animation image to properly fit in the panel.
// It works fine when the original size is used (like with the applet's supplied animation images).
// It becomes a problem, though, when the user loads a custom animation image with high resolution or when the panel height varies widely from the animation image height.
// Furthermore, the load_sliced_image_file method is quite particular about the passed dimensions and tends to crash Cinnamon when they don't match up (see TODO below).
//
// Therefore, at the moment, the applet uses another approach with a Cairo surface (see the other Animation.ts file).
// In terms of performance, I don't know how they compare to each other.
//
// The implementation below was taken from GNOME Shell with a few adjustments
// Source: https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/animation.js
export const Animation = GObject.registerClass(
  class Animation extends St.Bin {
    private file: imports.gi.Gio.File
    private speed: number

    private isLoaded: boolean
    private isPlaying: boolean
    private isPaused: boolean
    private timeoutId: number
    private frame: number

    // Bin size
    private scaleFactor: number
    private initialWidth: number
    private initialHeight: number

    private animations: imports.gi.Clutter.Actor | undefined

    constructor(file: imports.gi.Gio.File, width: number, height: number, speed: number) {
      // init St.Bin
      super()

      if (!isAnimationSpeedValid(speed)) {
        throw new AnimationError(`Animation speed is invalid. Value: ${speed}`)
      }
      this.speed = speed

      this.file = file

      // seize of St.Bin
      this.width = width
      this.height = height

      // need to keep track of the original size for scaling changes
      this.initialWidth = width
      this.initialHeight = height

      this.isLoaded = false
      this.isPlaying = false
      this.isPaused = false
      this.timeoutId = 0
      this.frame = 0

      this.connect("destroy", () => this.onDestroy())

      // Handle scaling changes (HiDPI). For example when you change the display scaling, the signal below gets triggered.
      // However fractional scaling does not seem to be support. The returned scale factor is an integer.

      // TODO: In original source, the signal "resource-scale-changed" is used.
      // Is is not available here and if added, it causes a crash.
      // this.connect("resource-scale-changed", () => this.loadFile())
      // The signal below is always triggered and causes that loadFile is called twice.
      this.connect("notify::resource-scale", () => {
        global.log("--> resource scale changed:", this.get_resource_scale())
        // this.loadFile()
      })

      const themeContext = St.ThemeContext.get_for_stage(global.stage)
      this.scaleFactor = themeContext.scale_factor
      // Handle display scaling changes.
      // TODO: In original source, "connectObject" method is used which is not available on ThemeContext here.
      // I think there is a bug in the original: the original width and height members are getting overwritten with each call.
      themeContext.connect("notify::scale-factor", () => {
        // store updated scale factor
        this.scaleFactor = themeContext.scale_factor

        this.stop()

        // This is wrong in the original source, I guess.
        // It overwrites width and height. There is no chance to decrease scale then again.
        this.set_size(this.initialWidth * themeContext.scale_factor, this.initialHeight * themeContext.scale_factor)
        this.loadFile()

        this.play()
      })

      this.loadFile()
    }

    public play() {
      if (this.isLoaded && this.isPaused) {
        this.showFrame(0)
        return
      }

      if (this.isLoaded && this.timeoutId === 0) {
        // TODO: is that correct?
        if (this.frame === 0) {
          this.showFrame(0)
        }
        this.timeoutId = GLib.timeout_add(GLib.PRIORITY_LOW, this.speed, this.update.bind(this))
        GLib.Source.set_name_by_id(this.timeoutId, `[cinnamon] this.update`)
      }

      this.isPlaying = true
    }

    public stop() {
      if (this.timeoutId > 0) {
        GLib.source_remove(this.timeoutId)
        this.timeoutId = 0
      }

      this.isPlaying = false
    }

    public pause() {
      this.isPaused = true
      // stop timeout
      if (this.timeoutId > 0) {
        GLib.source_remove(this.timeoutId)
        this.timeoutId = 0
      }
    }

    public resume() {
      this.isPaused = false
      this.play()
    }

    public setSpeed(speed: number): void {
      if (!isAnimationSpeedValid(speed)) {
        throw new AnimationError(`Animation speed is invalid. Value: ${speed}`)
      }
      this.stop()
      this.speed = speed
      this.play()
    }

    private loadFile() {
      // TODO: isResourceScaleSet is always false. Is there any use for it?
      const [isResourceScaleSet, initialResourceScale] = this.get_resource_scale()
      let resourceScale = initialResourceScale

      if (!isResourceScaleSet) {
        global.log("--> isResourceScaleSet is false")
        resourceScale = 1
      }

      const wasPlaying = this.isPlaying
      if (this.isPlaying) {
        this.stop()
      }

      this.isLoaded = false
      this.destroy_all_children()

      const textureCache = St.TextureCache.get_default()

      // Does not throw an error but fails and crashes Cinnamon if provided dimension are wrong.
      // TODO: can an error be caught?
      this.animations = textureCache.load_sliced_image_file(
        this.file,
        this.initialWidth,
        this.initialHeight,
        this.scaleFactor,
        resourceScale, // this should be a float, might be used for proper scaling?
        () => this.loadFinished(),
      )

      if (!this.animations) {
        throw new AnimationError("Failed to load sliced image file.")
      }

      this.animations.set({
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
      })

      this.set_child(this.animations)

      if (wasPlaying) {
        this.play()
      }
    }

    private loadFinished() {
      this.isLoaded = this.animations !== undefined && this.animations.get_n_children() > 0

      if (this.isLoaded && this.isPlaying) {
        this.play()
      }
    }

    private showFrame(frame: number) {
      // Actually the animations object cannot be undefined here since callers check for "isLoaded".
      // The type guard here is for the linter rule "Forbidden non-null assertion".
      if (!this.animations) {
        throw new AnimationError("Animation is undefined.")
      }
      const oldFrameActor = this.animations.get_child_at_index(this.frame)
      if (oldFrameActor) {
        oldFrameActor.hide()
      }

      this.frame = frame % this.animations.get_n_children()

      const newFrameActor = this.animations.get_child_at_index(this.frame)
      if (newFrameActor) {
        newFrameActor.show()
      }
    }

    private update(): boolean {
      this.showFrame(this.frame + 1)
      return GLib.SOURCE_CONTINUE
    }

    private onDestroy() {
      this.stop()
    }
  },
)

export type Animation = InstanceType<typeof Animation>
