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
  rotate: boolean
}
