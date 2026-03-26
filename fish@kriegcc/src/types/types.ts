export type Metadata = imports.ui.applet.AppletMetadata

// representation of setting keys defined in settings-schema.json.
export type AppletSettingsProps = {
  // general settings
  name: string
  command: string
  // animation specific settings
  imagePath: string
  frames: number
  pausePerFrameInSeconds: number
  flipSidewaysOnVerticalPanel: boolean
  // advanced settings
  // animation
  animationScalingMode: string
  autoAnimationMargin: boolean
  customAnimationMargin: number
  customAnimationHeight: number
  customAnimationWidth: number
  preserveAnimationAspectRatio: boolean
  animationRotation: number
  // developer options
  developerOptionsEnabled: boolean
  logLevel: string
  forceFoolsDay: boolean
}
