// original definition, see applet.d.ts (imports.ui.applet, interface AppletMetadata)
export type Metadata = {
  uuid: string
  name: string
  description: string
  "max-instances"?: number
  version?: string
  multiversion?: boolean
  "cinnamon-version"?: string[]
  state?: number
  path: string
  error?: string
  force_loaded: boolean
}

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
