import { AnimatedFish, AnimatedFishProps, AnimationRotation, RenderOptions } from "AnimatedFish"
import { FishMessagePopupMenu, ErrorPopupMenu, FoolsDayPopupMenu } from "PopupMenu"

import { Metadata, AppletSettingsProps } from "types"

import { ErrorIcon } from "utils/icons"
import { expandHomeDir, isFoolsDay, isHorizontalOriented, openWebsite, runCommandAsyncIO } from "utils/common"
import { logger } from "utils/logging"
import { NotificationButton, showNotification } from "utils/notification"
import { _ } from "utils/translation"

import { ErrorLocation, FishAppletError, FishAppletErrorManager } from "./ErrorManager"

import { FISH_APPLET_CINNAMON_SPICES_WEBSITE, KNOWN_USEFUL_PROGRAMS, REPORT_BUGS_INSTRUCTIONS_WEBSITE } from "consts"

const { Applet } = imports.ui.applet
const { AppletSettings } = imports.ui.settings
const { PopupMenuManager } = imports.ui.popupMenu
const { GLib } = imports.gi
const Mainloop = imports.mainloop

const FOOLS_DAY_CHECK_INTERVAL_IN_MS = 60000 // 1 minute
// Margins around the animation in px. Hard-coded for now. See: determineAnimationRenderOptions method
const ANIMATION_MARGIN = 8
const FORTUNE_COMMAND = "fortune"

export class FishApplet extends Applet {
  private metadata: Metadata
  private uuid: string
  private orientation: imports.gi.St.Side
  private panelHeight: number
  private instanceId: number

  private isFoolsDay: boolean
  private foolsDayTimeoutId: number

  private errorManager: FishAppletErrorManager

  // initialized in helper function bindSettings()
  private settings!: imports.ui.settings.AppletSettings
  // props of this object are initialized and bound by AppletSetting
  private settingsObject = {} as AppletSettingsProps
  private animatedFish: AnimatedFish | undefined

  // popup menu
  // initialized in helper function initPopupMenu()
  private menuManager!: imports.ui.popupMenu.PopupMenuManager
  // either shows fortune message or error (or a special popup on fools day)
  private messagePopup!: imports.ui.applet.AppletPopupMenu

  constructor(metadata: Metadata, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
    super(orientation, panelHeight, instanceId)

    this.metadata = metadata
    this.uuid = metadata.uuid
    this.orientation = orientation
    this.panelHeight = panelHeight
    this.instanceId = instanceId

    // add instead of set to not remove the default applet-box style
    this.actor.add_style_class_name("fish-applet")

    // setup fools day check
    this.isFoolsDay = false
    this.foolsDayTimeoutId = 0
    this.startPeriodicFoolsDayCheck()

    this.errorManager = new FishAppletErrorManager()

    this.bindSettings()
    this.initApplet()
  }

  public override on_panel_height_changed(): void {
    this.panelHeight = this._panelHeight
    this.initAnimation()
  }

  public override on_applet_removed_from_panel(): void {
    this.animatedFish?.destroy()
    this.stopPeriodicFoolsDayCheck()
  }

  public override on_applet_clicked(_: imports.gi.Clutter.Event): boolean {
    this.messagePopup.toggle()

    // no need to continue the emission
    return false
  }

  public override on_orientation_changed(orientation: imports.gi.St.Side): void {
    this.orientation = orientation
    const isRotated = this.settingsObject.rotate
    this.updateRotate(isRotated)
  }

  private initApplet(): void {
    // adjust path to support tilde (~) (default value also replaces home dir with a tilde)
    const expandedPath = expandHomeDir(this.settings.getValue("keyImagePath"))
    this.settings.setValue("keyImagePath", expandedPath)

    // need to manually init this property because there is no proper binding (see TODO in bindSetting)
    this.settingsObject.imagePath = this.settings.getValue("keyImagePath")

    this.initAnimation()
    this.updateMessagePopup()
    this.updateName() // MessagePopup needs to be initialized before!

    // TODO: the call here is to check at startup the defined command.
    // However the "useful command" warning is always shown then if one of it is in use.
    // Might be a bit annoying. Fix?
    this.updateCommand()
  }

  // decides which popup type to set: error or "fortune" message
  private updateMessagePopup(): void {
    if (this.errorManager.hasErrors()) {
      this.setActiveErrorPopup()
    } else {
      if (this.isFoolsDay) {
        this.setActiveFoolsDayPopup()
      } else {
        this.setActiveMessagePopup()
      }
    }
  }

  private setActiveMessagePopup(): void {
    if (this.messagePopup && this.messagePopup instanceof FishMessagePopupMenu) {
      // message popup is already active - nothing to do
      return
    }
    // reset menu manager and add fish message
    if (this.menuManager) {
      this.menuManager.destroy()
    }
    this.menuManager = new PopupMenuManager(this)

    this.messagePopup = new FishMessagePopupMenu({
      launcher: this,
      orientation: this.orientation,
      name: this.settingsObject.name,
      onSpeakAgain: this.runCommand.bind(this),
      onClose: () => this.messagePopup.close(true),
    })
    // need to run command so that its result will be shown in the popup
    this.runCommand()
    this.menuManager.addMenu(this.messagePopup)
  }

  private setActiveFoolsDayPopup(): void {
    if (this.messagePopup && this.messagePopup instanceof FoolsDayPopupMenu) {
      // fools day popup is already active - nothing to do
      return
    }
    // reset menu manager and add fish message
    if (this.menuManager) {
      this.menuManager.destroy()
    }
    this.menuManager = new PopupMenuManager(this)

    this.messagePopup = new FoolsDayPopupMenu({
      launcher: this,
      orientation: this.orientation,
    })
    this.menuManager.addMenu(this.messagePopup)
  }

  private setActiveErrorPopup(): void {
    if (!this.errorManager.hasErrors()) {
      // applet has no errors, so do not show the error popup
      return
    }
    if (this.messagePopup && this.messagePopup instanceof ErrorPopupMenu) {
      // error popup is already active - nothing to do
      return
    }
    // reset menu manager and add error message popup
    if (this.menuManager) {
      this.menuManager.destroy()
    }
    this.menuManager = new PopupMenuManager(this)

    this.messagePopup = new ErrorPopupMenu({
      launcher: this,
      orientation: this.orientation,
      name: this.settingsObject.name,
      errors: this.errorManager.getAllErrors(),
      onOpenPreferences: () => {
        this.messagePopup.close(true)
        this.configureApplet()
      },
    })

    this.menuManager.addMenu(this.messagePopup)
  }

  // asynchronously updates the message in the popup
  private runCommand(): void {
    if (this.errorManager.hasError("command")) {
      // don't event try to run the given command when there was an error encountered before
      return
    }

    // delete previous error if there were any
    this.errorManager.deleteError("commandExecution")

    const command = this.settingsObject.command
    runCommandAsyncIO(
      command,
      (message) => {
        if (this.messagePopup instanceof FishMessagePopupMenu) {
          this.messagePopup.updateMessage(message)
        }
      },
      (error) => {
        this.handleError(error, "commandExecution")
      },
    )
  }

  private bindSettings() {
    // applet settings setup (settings menu)
    // properties are defined in settings-schema.json
    // See: https://projects.linuxmint.com/reference/git/cinnamon-tutorials/xlet-settings.html
    this.settings = new AppletSettings(this.settingsObject, this.uuid, this.instanceId)

    this.settings.bind("keyNameOfFish", "name", this.updateName.bind(this))
    this.settings.bind("keyCommand", "command", this.updateCommand.bind(this))
    this.settings.bind<number>("keyFrames", "frames", this.updateAnimationFrames.bind(this))
    this.settings.bind<number>(
      "keyPausePerFrameInSeconds",
      "pausePerFrameInSeconds",
      this.updateAnimationPause.bind(this),
    )
    this.settings.bind<boolean>("keyRotate", "rotate", this.updateRotate.bind(this))
    // TODO: the line below does not work. See TODO in ImageChooser.py
    // this.settings.bind<string>("keyImagePath", "imagePath", this.updateAnimationImage.bind(this))
    // workaround:
    this.settings.connect("changed::keyImagePath", () => {
      const newValue: string = this.settings.getValue("keyImagePath")
      this.settingsObject.imagePath = newValue
      this.updateAnimationImage(newValue)
    })
  }

  // -------------------------------------------------------------------------------------------------
  // Callbacks which are used by settings (buttons in settings-schema.json). Don't delete them please.

  private openCinnamonSpicesWebsite(): void {
    openWebsite(FISH_APPLET_CINNAMON_SPICES_WEBSITE)
  }

  private openReportBugsInstructions(): void {
    openWebsite(REPORT_BUGS_INSTRUCTIONS_WEBSITE)
  }

  // -------------------------------------------------------------------------------------------------

  private updateName(): void {
    const tooltipText = _("%s the Fish, the fortune teller").format(this.settingsObject.name)
    this.set_applet_tooltip(tooltipText)
    if (this.messagePopup instanceof FishMessagePopupMenu) {
      this.messagePopup.updateName(this.settingsObject.name)
    }
  }

  private updateCommand(): void {
    const commandLine = this.settingsObject.command
    const name = this.settingsObject.name

    // delete previous error if there were any
    this.errorManager.deleteError("command")

    try {
      const [success, argv] = GLib.shell_parse_argv(commandLine)
      if (!success || !argv) {
        throw new Error(`Could not parse command. Command: ${commandLine}`)
      }
      const program = argv[0]

      if (KNOWN_USEFUL_PROGRAMS.includes(program)) {
        const commandWarningMessage =
          // Do not indent. Tabs would be applied on the string as well (template literal).
          _(`Warning: The command appears to be something actually useful. 
Since this is a useless applet, you may not want to do this. 
We strongly advise you against using %s for anything which would make the applet "practical" or useful.`).format(name)
        logger.logWarning(commandWarningMessage)
        // TODO: instead of showing the warning in a notification, show it directly inside the preferences window. But how?
        showNotification({ message: commandWarningMessage, type: "Warning", isPersistent: true })
      }

      if (GLib.find_program_in_path(program) == null) {
        // show a dedicated error message with instruction on how to solve it for the default "fortune" command
        if (program === FORTUNE_COMMAND) {
          const fortuneNotInstalledMessage =
            // Do not indent. Tabs would be applied on the string as well (template literal).
            _(`Normally, the Fish's wisdom is derived from the 'fortune' command-line utility. 
It seems that this dependency is missing on your system.
However, it should be available for most distributions. 
Please refer to the documentation for instructions on how to install it. 
If you prefer not to install any additional packages, you can change the command in the applet's settings.`)
          logger.logError(fortuneNotInstalledMessage)
          const buttons: NotificationButton[] = [
            {
              label: _("Open Documentation"),
              callback: () => openWebsite(FISH_APPLET_CINNAMON_SPICES_WEBSITE),
            },
            {
              label: _("Open Preferences"),
              callback: () => this.configureApplet(),
            },
          ]
          showNotification({ message: fortuneNotInstalledMessage, type: "Warning", isPersistent: true, buttons })
          throw new Error(
            "The 'fortune' command-line utility is missing. Please install it or update the applet's settings.",
          )
        } else {
          throw new Error("Unable to locate the command to execute")
        }
      }

      this.updateApplet()
      // run the command already once so that popup menu shows respective message of the new command
      this.runCommand()
    } catch (error) {
      this.handleError(error, "command")
    }
  }

  // Sets the size of the animation to fit into the panel
  private determineAnimationRenderOptions(): RenderOptions {
    // TODO: try to read margins from the theme
    //
    // The call below causes an error in console: "st_widget_get_theme_node called on the widget [0x5d15a2aab6c0 StBoxLayout.applet-box] which is not in the stage."
    // const themeNode = this.actor.get_theme_node()
    // const margin = themeNode.get_horizontal_padding() + themeNode.get_border_width(St.Side.TOP) +  themeNode.get_border_width(St.Side.BOTTOM);
    // global.log("margin: ", margin)
    //
    // With signal "style-changed" it would work, but the signal is triggered with every hover over the applet.
    // this.actor.connect("style-changed", (actor) => {
    //   global.log("--> style changed")
    //   const themeNode = actor.get_theme_node()
    //   global.log("--> themeNode: ", themeNode)
    //   const margin = themeNode.get_horizontal_padding() + themeNode.get_border_width(St.Side.TOP) +  themeNode.get_border_width(St.Side.BOTTOM);
    //   global.log("--> margin: ", margin)
    // })

    let isRotated = this.settingsObject.rotate
    // Guard to allow rotation only on vertical panel (as stated in setting's description). Maybe remove in future.
    if (isRotated && isHorizontalOriented(this.orientation)) {
      isRotated = false
    }

    let height = undefined
    let width = undefined
    let rotation: AnimationRotation | undefined = undefined

    const isInHorizontalPanel = isHorizontalOriented(this.orientation)

    if (isInHorizontalPanel) {
      if (isRotated) {
        width = this.panelHeight - ANIMATION_MARGIN
        height = undefined
      } else {
        width = undefined
        height = this.panelHeight - ANIMATION_MARGIN
      }
    } else {
      // on a vertical panel
      if (isRotated) {
        width = undefined
        height = this.panelHeight - ANIMATION_MARGIN
      } else {
        width = this.panelHeight - ANIMATION_MARGIN
        height = undefined
      }
    }

    if (isRotated) {
      rotation = 90
    }

    const renderOptions: RenderOptions = {
      height,
      width,
      rotation,
    }
    return renderOptions
  }

  private initAnimation(): void {
    const configuration: AnimatedFishProps = {
      imagePath: this.settingsObject.imagePath,
      frames: this.settingsObject.frames,
      pausePerFrameInMs: Math.floor(this.settingsObject.pausePerFrameInSeconds * 1000),
      renderOptions: this.determineAnimationRenderOptions(),
      isFoolsDay: this.isFoolsDay,
    }

    // delete previous error if there were any
    this.errorManager.deleteError("animation")

    try {
      if (this.animatedFish === undefined) {
        this.animatedFish = new AnimatedFish(configuration)
      } else {
        this.animatedFish.update(configuration)
      }
    } catch (error) {
      this.handleError(error, "animation")
    }
  }

  private updateAnimationImage(imagePath: string): void {
    // delete previous error if there were any
    this.errorManager.deleteError("animation")

    try {
      if (!this.animatedFish) {
        // Initialization must have been failed before. Try again with the changed setting.
        // initAnimation() uses the updated image since the settingsObject has always the latest config.
        this.initAnimation()
      } else {
        this.animatedFish.updateImage(imagePath)
      }
      this.updateApplet()
    } catch (error) {
      this.handleError(error, "animation")
    }
  }

  private updateAnimationFrames(frames: number): void {
    // delete previous errors if there were any
    this.errorManager.deleteError("animation")

    try {
      if (!this.animatedFish) {
        this.initAnimation()
      } else {
        this.animatedFish.updateFrames(frames)
      }
      this.updateApplet()
    } catch (error) {
      this.handleError(error, "animation")
    }
  }

  private updateAnimationPause(pauseInSeconds: number): void {
    // delete previous errors if there were any
    this.errorManager.deleteError("animation")

    try {
      if (!this.animatedFish) {
        this.initAnimation()
      } else {
        const pauseInMilliseconds = Math.floor(pauseInSeconds * 1000)
        this.animatedFish.updatePause(pauseInMilliseconds)
      }
      this.updateApplet()
    } catch (error) {
      this.handleError(error, "animation")
    }
  }

  private updateRotate(rotate: boolean): void {
    // Guard to allow rotation only on vertical panel (as stated in setting's description). Maybe remove in future.
    if (rotate && isHorizontalOriented(this.orientation)) {
      logger.logWarning("Rotation works only when the applet is placed on a vertical panel.")
      return
    }

    // delete previous errors if there were any
    this.errorManager.deleteError("animation")

    try {
      if (!this.animatedFish) {
        this.initAnimation()
      } else {
        const updatedRenderOptions = this.determineAnimationRenderOptions()
        this.animatedFish.updateRenderOptions(updatedRenderOptions)
      }
      this.updateApplet()
    } catch (error) {
      this.handleError(error, "animation")
    }
  }

  // Applet is in a normal state. Show the fish.
  private updateApplet(): void {
    if (this.errorManager.hasErrors()) {
      return
    }
    // remove potential error icon
    this.actor.remove_all_children()
    if (this.animatedFish) {
      this.actor.add_child(this.animatedFish)
    }
    // show the normal fortune popup message again
    this.updateMessagePopup()
  }

  // Logs an error and shows error icon in applet instead of animated fish.
  private handleError(error: unknown, location: ErrorLocation): void {
    let message = ""
    if (error instanceof Error) {
      message = error.message
    } else {
      message = "Unknown error"
    }
    logger.logError(message, error)
    const fishAppletError: FishAppletError = {
      type: "Error",
      location: location,
      message: message,
    }
    this.errorManager.addError(fishAppletError)

    // remove (maybe broken) animation container or previous error icon
    this.actor.remove_all_children()

    // instead of a fish, show an error icon in the panel
    // TODO: maybe use a nice looking custom icon instead in the future
    const errorIcon = ErrorIcon()
    this.actor.add_child(errorIcon)

    // replace the fortune popup message with a popup error message
    this.updateMessagePopup()
  }

  private async checkIfFoolsDay(): Promise<void> {
    const prev = this.isFoolsDay
    this.isFoolsDay = await isFoolsDay()
    // Fools day has just began or is now over. Need to re-init animation and popup.
    if (prev !== this.isFoolsDay) {
      if (this.isFoolsDay) {
        this.animatedFish?.enableIsFoolsDay()
      } else {
        this.animatedFish?.disableIsFoolsDay()
      }
      this.updateMessagePopup()
    }
  }

  private startPeriodicFoolsDayCheck(): void {
    // check immediately
    this.checkIfFoolsDay()
    // TODO: Mainloop is marked as "deprecated". What to use instead?
    // Use GLib functions directly (like in Animation.ts)?
    // GLib.timeout_add(GLib.PRIORITY_DEFAULT, FOOLS_DAY_CHECK_INTERVAL_IN_MS, () => {
    //   this.checkIfFoolsDay()
    //   return GLib.SOURCE_CONTINUE
    // })
    this.foolsDayTimeoutId = Mainloop.timeout_add(FOOLS_DAY_CHECK_INTERVAL_IN_MS, () => {
      this.checkIfFoolsDay()
      return true // return true to keep the timeout active
    })
  }

  private stopPeriodicFoolsDayCheck(): void {
    // stop interval
    if (this.foolsDayTimeoutId > 0) {
      Mainloop.source_remove(this.foolsDayTimeoutId)
      this.foolsDayTimeoutId = 0
    }
  }
}
