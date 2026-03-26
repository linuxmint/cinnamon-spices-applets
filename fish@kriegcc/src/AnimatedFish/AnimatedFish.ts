import { Animation, AnimationProps, AnimationRotation, RenderOptions } from "AnimatedFish"
import { isAnimationSpeedValid } from "utils/common"
import { logger } from "utils/logging"

const { Gio, St, GObject } = imports.gi

export class AnimatedFishError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AnimatedFishError"
  }
}

export type AnimatedFishProps = {
  imagePath: string
  frames: number
  pausePerFrameInMs: number
  renderOptions?: RenderOptions
  isFoolsDay?: boolean
}

// wrapper and container (St.Bin) for animation
// extensions of St classes require registration
export const AnimatedFish = GObject.registerClass(
  class AnimatedFish extends St.Bin {
    private animation: Animation | undefined
    private props: AnimatedFishProps

    constructor(props: AnimatedFishProps) {
      super()
      this.props = props
      this.set_style_class_name("animated-fish")
      this.initAnimation()
    }

    public update(props: AnimatedFishProps): void {
      this.props = props
      // create new one
      this.initAnimation()
    }

    public updateImage(imagePath: string): void {
      // requires new animation object
      this.cleanUp()
      this.props.imagePath = imagePath
      this.initAnimation()
    }

    public updateFrames(frames: number): void {
      // requires new animation object
      this.cleanUp()
      this.props.frames = frames
      this.initAnimation()
    }

    public updatePause(pausePerFrameInMs: number): void {
      if (!this.animation) {
        throw new AnimatedFishError("Animation has not been initialized.")
      }
      if (!isAnimationSpeedValid(pausePerFrameInMs)) {
        throw new AnimatedFishError(`Invalid frame pause (animation speed). Value: ${pausePerFrameInMs}`)
      }

      this.props.pausePerFrameInMs = pausePerFrameInMs
      this.animation.setSpeed(pausePerFrameInMs)
    }

    // Update method could be used instead by caller. This is just a convenience method.
    public updateRotate(rotation: AnimationRotation): void {
      if (!this.animation) {
        throw new AnimatedFishError("Animation has not been initialized.")
      }

      const updatedProps = { ...this.props }
      const currentRotation = updatedProps.renderOptions?.rotation ?? 0

      if (currentRotation === rotation) {
        logger.logDebug(`Animation is already rotated. There is nothing to do.`)
        return
      }

      updatedProps.renderOptions = {
        ...updatedProps.renderOptions,
        rotation,
      }

      this.update(updatedProps)
    }

    public updateRenderOptions(renderOptions?: RenderOptions): void {
      // requires new animation object
      this.cleanUp()
      this.props.renderOptions = renderOptions
      this.initAnimation()
    }

    public enableIsFoolsDay(): void {
      const hastChanged = !this.props.isFoolsDay
      this.props.isFoolsDay = true
      // Was just enabled now. Need to re-init animation to apply jokes.
      if (hastChanged) {
        this.initAnimation()
      }
    }

    public disableIsFoolsDay(): void {
      const hastChanged = this.props.isFoolsDay
      this.props.isFoolsDay = false
      // Was just disabled now. Need to re-init animation to remove jokes.
      if (hastChanged) {
        this.initAnimation()
      }
    }

    private initAnimation(): void {
      if (this.props.isFoolsDay) {
        this.initAnimationOnFoolsDay()
      } else {
        this.initRegularAnimation()
      }
    }

    private initRegularAnimation(): void {
      this.cleanUp()

      const imageFile = Gio.file_new_for_path(this.props.imagePath)
      if (!imageFile.query_exists(null)) {
        throw new AnimatedFishError(`Image does not exist: ${this.props.imagePath}`)
      }

      try {
        this.animation = new Animation({
          file: imageFile,
          frames: this.props.frames,
          speed: this.props.pausePerFrameInMs,
          renderOptions: this.props.renderOptions,
        })
        this.animation.play()
      } catch (error) {
        throw new AnimatedFishError(`Could not create an animation from configuration: ${error}`)
      }

      // place the animation inside this container (St.Bin)
      this.set_child(this.animation)
    }

    // TODO: Maybe do joke adjustments in the animation class itself, which would allow to enable more possibilities using Cairo.
    private initAnimationOnFoolsDay(): void {
      this.cleanUp()

      const imageFile = Gio.file_new_for_path(this.props.imagePath)
      if (!imageFile.query_exists(null)) {
        throw new AnimatedFishError(`Image does not exist: ${this.props.imagePath}`)
      }

      // turn image by 180° (on vertical and horizontal panel)
      const currentRotation = this.props.renderOptions?.rotation ?? 0
      const newRotation = ((currentRotation + 180) % 360) as AnimationRotation

      const foolsDayRenderOptions: RenderOptions = {
        ...this.props.renderOptions,
        rotation: newRotation,
      }

      const animationProps: AnimationProps = {
        file: imageFile,
        frames: this.props.frames,
        speed: this.props.pausePerFrameInMs,
        renderOptions: foolsDayRenderOptions,
      }

      // TODO: make some more funny changes.

      try {
        this.animation = new Animation(animationProps)
        this.animation.pause()
      } catch (error) {
        throw new AnimatedFishError(`Could not create an animation from configuration: ${error}`)
      }

      // place the animation inside this container (St.Bin)
      this.set_child(this.animation)
    }

    private cleanUp(): void {
      if (this.animation) {
        this.animation.destroy()
      }
    }
  },
)

export type AnimatedFish = InstanceType<typeof AnimatedFish>
