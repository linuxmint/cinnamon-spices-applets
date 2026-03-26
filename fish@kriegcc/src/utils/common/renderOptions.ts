import { AnimationRotation, RenderOptions } from "AnimatedFish"

export type AnimationScalingMode = "AutoFit" | "PreserveOriginal" | "Custom"

export type RenderOptionSettings = {
  isInHorizontalPanel: boolean
  panelHeight: number
  scalingMode: AnimationScalingMode
  margin: number
  customHeight: number
  customWidth: number
  isPreserveAspectRatio: boolean
  isFlipSidewaysOnVerticalPanel: boolean
  rotation: AnimationRotation
}

export function mapStringToAnimationScalingMode(mode: string): AnimationScalingMode {
  if (mode === "AutoFit" || mode === "PreserveOriginal" || mode === "Custom") {
    return mode
  }
  throw new Error(`Invalid animation scaling mode value: ${mode}`)
}

export function mapNumberToAnimationRotation(rotation: number): AnimationRotation {
  if (rotation === 0 || rotation === 90 || rotation === 180 || rotation === 270) {
    return rotation
  }
  throw new Error(`Invalid rotation value: ${rotation}`)
}

// Calculates the animation's render options (size and rotation) by taking all settings into account.
export function determineRenderOptionsFromSettings(props: RenderOptionSettings): RenderOptions {
  const {
    isInHorizontalPanel,
    panelHeight,
    scalingMode,
    margin,
    customHeight,
    customWidth,
    isPreserveAspectRatio,
    isFlipSidewaysOnVerticalPanel,
    rotation,
  } = props

  const adjustedRotation = isFlipSidewaysOnVerticalPanel ? getSidewaysFlippedRotation(rotation) : rotation
  // Initialize render options with default values.
  const renderOptions: RenderOptions = {
    height: undefined,
    width: undefined,
    rotation: adjustedRotation,
  }

  switch (scalingMode) {
    case "AutoFit":
      {
        //  Auto-fit:
        //
        // - Original dimensions cannot be preserved.
        // - Aspect ratio is always preserved (implicitly).
        // - Custom height/width values are ignored.
        // - Margins are taken into account.
        //
        // For vertical panels:
        // - `panelHeight` represents the panel's width.
        // - Behavior based on `rotation`:
        //   1. If no rotation (0°) or flipped upside down (180°):
        //      - Set width based on `panelHeight`, leave height undefined.
        //   2. If rotated sideways (90° or 270°):
        //      - Set width based on `panelHeight`, leave height undefined.
        const sizeLimit = panelHeight - margin
        applyAutoFit(renderOptions, sizeLimit, isInHorizontalPanel, adjustedRotation)
      }
      break
    case "PreserveOriginal":
      // Preserve original dimensions:
      //
      // - Auto-fit cannot be applied.
      // - Custom height/width values are ignored.
      // - Aspect ratio is always preserved (implicitly).
      // - Rotation has no influence.
      //
      // For vertical panels:
      // - No additional adjustments needed.
      applyPreserveAnimationOriginalDimensions(renderOptions)
      break
    case "Custom":
      // Use custom dimensions:
      //
      // - Auto-fit cannot be applied.
      // - Original dimensions cannot be preserved.
      // - Aspect ratio can optionally be preserved, overriding custom width values.
      //
      // For vertical panels:
      // - Currently, no adjustments are made. However, `isPreserveAspectRatio`,
      //   `isInHorizontalPanel`, and `rotation` could be used to set either
      //   height or width to undefined in the future (similar to auto-fit option).
      applyCustomDimensions(renderOptions, customHeight, customWidth, isPreserveAspectRatio)
      break
  }

  return renderOptions
}

function getSidewaysFlippedRotation(rotation: AnimationRotation): AnimationRotation {
  switch (rotation) {
    case 0:
      return 90
    case 180:
      return 270
    // Already flipped sideways, no change needed
    case 90:
    case 270:
      return rotation
  }
}

function applyAutoFit(
  renderOptions: RenderOptions,
  limit: number,
  isInHorizontalPanel: boolean,
  rotation: AnimationRotation,
): void {
  const isRotatedSideways = rotation === 90 || rotation === 270

  // Determine which dimension to set based on panel orientation and rotation. Ignore the custom dimensions and uses the provided limit instead.
  const isHeightConstrained = (isInHorizontalPanel && !isRotatedSideways) || (!isInHorizontalPanel && isRotatedSideways)

  renderOptions.height = isHeightConstrained ? limit : undefined
  renderOptions.width = isHeightConstrained ? undefined : limit
}

function applyPreserveAnimationOriginalDimensions(renderOptions: RenderOptions): void {
  // This is achieved by not providing any constraints on dimension. Pixbuf later will then use the original ones.
  renderOptions.height = undefined
  renderOptions.width = undefined
}

function applyCustomDimensions(
  renderOptions: RenderOptions,
  customHeight: number,
  customWidth: number,
  isPreserveAspectRatio: boolean,
): void {
  renderOptions.height = customHeight
  renderOptions.width = customWidth

  // Ignores the provided custom width value.
  if (isPreserveAspectRatio) {
    // This is achieved by simply unsetting width in render options which means it is not constrained then. See: `Pixbuf.new_from_file_at_scale`.
    renderOptions.width = undefined
  }
}
