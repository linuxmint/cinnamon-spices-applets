import { AnimatedFish, AnimatedFishProps, RenderOptions } from "AnimatedFish"
import {
  FishMessagePopupMenu,
  BasePopupMenu,
  PopupMenuType,
  PopupMenuProps,
  PopupMenuFactory,
  FoolsDayPopupMenu,
  ErrorPopupMenu,
} from "PopupMenu"

import { Metadata, AppletSettingsProps } from "types"

import { ErrorIcon } from "utils/icons"
import {
  determineRenderOptionsFromSettings,
  expandHomeDir,
  getMargin,
  getThemeAppearance,
  isFoolsDay,
  isHorizontalOriented,
  mapNumberToAnimationRotation,
  mapStringToAnimationScalingMode,
  openWebsite,
  runCommandAsyncIO,
} from "utils/common"
import { logger, mapStringToLogLevel } from "utils/logging"
import { NotificationButton, showNotification } from "utils/notification"
import { _ } from "utils/translation"

import { ErrorLocation, FishAppletError, FishAppletErrorManager } from "./ErrorManager"

import { FISH_APPLET_CINNAMON_SPICES_WEBSITE, KNOWN_USEFUL_PROGRAMS, REPORT_BUGS_INSTRUCTIONS_WEBSITE } from "consts"

const { Applet, AllowedLayout } = imports.ui.applet
const { AppletSettings } = imports.ui.settings
const { PopupMenuManager } = imports.ui.popupMenu
const { SignalManager } = imports.misc.signalManager
const { themeManager } = imports.ui.main
const { GLib } = imports.gi
const Mainloop = imports.mainloop

const FOOLS_DAY_CHECK_INTERVAL_IN_MS = 60000 // 1 minute
const FORTUNE_COMMAND = "fortune"
const DEFAULT_APPLET_CLASS_NAME = "applet-box"

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

  // signal manager, used for listening for theme changes
  // initialized in helper function initApplet()
  private signalManager!: imports.misc.signalManager.SignalManager

  // popup menu
  // initialized in helper function initApplet()
  private menuManager!: imports.ui.popupMenu.PopupMenuManager
  // either shows fortune message or error (or a special popup on Fool's Day)
  private messagePopup!: BasePopupMenu

  private lastCommandOutput: string

  constructor(metadata: Metadata, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
    super(orientation, panelHeight, instanceId)

    this.metadata = metadata
    this.uuid = metadata.uuid
    this.orientation = orientation
    this.panelHeight = panelHeight
    this.instanceId = instanceId

    // allow applet to be also placed on vertical panel
    this.setAllowedLayout(AllowedLayout.BOTH)

    // add instead of set to not remove the default applet-box style
    this.actor.add_style_class_name("fish-applet")

    // setup Fool's Day check
    this.isFoolsDay = false
    this.foolsDayTimeoutId = 0
    this.startPeriodicFoolsDayCheck()

    this.errorManager = new FishAppletErrorManager()

    this.lastCommandOutput = ""

    this.bindSettings()
    this.updateLogLevel()
    this.initApplet()
  }

  public override on_panel_height_changed(): void {
    this.panelHeight = this._panelHeight
    this.initAnimation()
    this.updateApplet()
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
    const isFlipSidewaysOnVerticalPanel = this.settingsObject.flipSidewaysOnVerticalPanel
    this.updateFlipSidewaysOnVerticalPanel(isFlipSidewaysOnVerticalPanel)
  }

  private initApplet(): void {
    // adjust path to support tilde (~) (default value also replaces home dir with a tilde)
    const expandedPath = expandHomeDir(this.settings.getValue("keyImagePath"))
    this.settings.setValue("keyImagePath", expandedPath)

    // need to manually init this property because there is no proper binding (see TODO in bindSetting)
    this.settingsObject.imagePath = this.settings.getValue("keyImagePath")

    // signaling setup
    this.signalManager = new SignalManager()
    // Subscribe to theme changes to adjust the applet's own theme accordingly (dark / light mode styles).
    this.signalManager.connect(themeManager, "theme-set", this.changeTheme.bind(this), this)

    this.initAnimation()

    this.menuManager = new PopupMenuManager(this)
    this.updateMessagePopup()

    // inits the tooltip
    this.updateName()

    // TODO: the call here is to check at startup the defined command.
    // However the "useful command" warning is always shown then if one of it is in use.
    // Might be a bit annoying. Fix?
    this.updateCommand()
  }

  // decides which popup type to set: error or "fortune" message (or Fool's Day)
  private updateMessagePopup(): void {
    let popupMenuType: PopupMenuType

    if (this.errorManager.hasErrors()) {
      popupMenuType = "Error"
    } else if (this.isFoolsDay) {
      popupMenuType = "FoolsDay"
    } else {
      popupMenuType = "FishMessage"
    }
    this.setActivePopup(popupMenuType)
  }

  private setActivePopup(popupMenuType: PopupMenuType): void {
    if (popupMenuType === "Error" && !this.errorManager.hasErrors()) {
      // The Applet has no errors, so do not show the error popup!
      return
    }

    if (this.isTargetPopupMenuAlreadyActive(popupMenuType)) {
      // Correct popup menu is already active, so there is nothing to do!
      return
    }

    // set correct init props for respective popup menu type:
    let popupMenuProps: PopupMenuProps
    switch (popupMenuType) {
      case "FishMessage":
        popupMenuProps = {
          popupMenuType: "FishMessage",
          popupMenuProps: {
            launcher: this,
            orientation: this.orientation,
            name: this.settingsObject.name,
            message: this.lastCommandOutput,
            onSpeakAgain: this.runCommand.bind(this),
            onClose: () => this.messagePopup.close(true),
          },
        }
        break
      case "FoolsDay":
        popupMenuProps = {
          popupMenuType: "FoolsDay",
          popupMenuProps: {
            launcher: this,
            orientation: this.orientation,
          },
        }
        break
      case "Error":
        popupMenuProps = {
          popupMenuType: "Error",
          popupMenuProps: {
            launcher: this,
            orientation: this.orientation,
            errors: this.errorManager.getAllErrors(),
            onOpenPreferences: () => {
              this.messagePopup.close(true)
              this.configureApplet()
            },
          },
        }
        break
      default:
        throw new Error("Unknown popup menu type")
    }

    // directly init popup menu with correct style class
    // this is passed in the options props member
    if (this.isDarkMode()) {
      const styleClassName = "dark"
      popupMenuProps.popupMenuOptions = {
        ...popupMenuProps.popupMenuOptions,
        styleClassName,
      }
    }

    // remove old popup menu
    if (this.messagePopup) {
      this.menuManager.removeMenu(this.messagePopup)
      this.messagePopup.destroy()
    }

    // create and add the new one
    this.messagePopup = PopupMenuFactory.createPopupMenu(popupMenuProps)
    this.menuManager.addMenu(this.messagePopup)
  }

  private isTargetPopupMenuAlreadyActive(targetPopupMenuTyp: PopupMenuType): boolean {
    switch (targetPopupMenuTyp) {
      case "FishMessage":
        if (this.messagePopup instanceof FishMessagePopupMenu) {
          return true
        } else {
          return false
        }
      case "FoolsDay":
        if (this.messagePopup instanceof FoolsDayPopupMenu) {
          return true
        } else {
          return false
        }
      case "Error":
        if (this.messagePopup instanceof ErrorPopupMenu) {
          return true
        } else {
          return false
        }
      default:
        throw new Error("Unknown popup menu type")
    }
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
        this.lastCommandOutput = message
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
    this.settings.bind<boolean>(
      "keyFlipSidewaysOnVerticalPanel",
      "flipSidewaysOnVerticalPanel",
      this.updateFlipSidewaysOnVerticalPanel.bind(this),
    )
    // TODO: the line below does not work. See TODO in ImageChooser.py
    // this.settings.bind<string>("keyImagePath", "imagePath", this.updateAnimationImage.bind(this))
    // workaround:
    this.settings.connect("changed::keyImagePath", () => {
      const newValue: string = this.settings.getValue("keyImagePath")
      this.settingsObject.imagePath = newValue
      this.updateAnimationImage(newValue)
    })

    // advanced settings
    // animation
    this.settings.bind("keyAnimationScalingMode", "animationScalingMode", this.updateAnimationScalingMode.bind(this))
    this.settings.bind("keyAnimationAutoMargin", "autoAnimationMargin", this.updateAnimationAutoMargin.bind(this))
    this.settings.bind("keyAnimationMargin", "customAnimationMargin", this.updateAnimationMargin.bind(this))
    this.settings.bind("keyAnimationHeight", "customAnimationHeight", this.updateCustomAnimationHeight.bind(this))
    this.settings.bind("keyAnimationWidth", "customAnimationWidth", this.updateCustomAnimationWidth.bind(this))
    this.settings.bind(
      "keyAnimationPreserveAspectRatio",
      "preserveAnimationAspectRatio",
      this.updatePreserveAnimationAspectRatio.bind(this),
    )
    this.settings.bind("keyAnimationRotation", "animationRotation", this.updateAnimationRotation.bind(this))
    // developer options
    this.settings.bind("keyDeveloperOptionsEnabled", "developerOptionsEnabled")
    this.settings.bind("keyLogLevel", "logLevel", this.updateLogLevel.bind(this))
    this.settings.bind("keyForceFoolsDay", "forceFoolsDay", this.updateForceFoolsDay.bind(this))
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

  private determineAnimationRenderOptions(): RenderOptions {
    return determineRenderOptionsFromSettings({
      isInHorizontalPanel: isHorizontalOriented(this.orientation),
      panelHeight: this.panelHeight,
      scalingMode: mapStringToAnimationScalingMode(this.settingsObject.animationScalingMode),
      margin: this.getAppletMargin(),
      customHeight: this.settingsObject.customAnimationHeight,
      customWidth: this.settingsObject.customAnimationWidth,
      isPreserveAspectRatio: this.settingsObject.preserveAnimationAspectRatio,
      isFlipSidewaysOnVerticalPanel: this.settingsObject.flipSidewaysOnVerticalPanel,
      rotation: mapNumberToAnimationRotation(this.settingsObject.animationRotation),
    })
  }

  private initAnimation(): void {
    try {
      // delete previous error if there were any
      this.errorManager.deleteError("animation")

      const configuration: AnimatedFishProps = {
        imagePath: this.settingsObject.imagePath,
        frames: this.settingsObject.frames,
        pausePerFrameInMs: Math.floor(this.settingsObject.pausePerFrameInSeconds * 1000),
        renderOptions: this.determineAnimationRenderOptions(),
        isFoolsDay: this.isFoolsDay,
      }

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

  private updateFlipSidewaysOnVerticalPanel(isFlipSidewaysOnVerticalPanel: boolean): void {
    // Maybe remove this option in future. There is now a dedicated rotation option in advance settings.
    if (isFlipSidewaysOnVerticalPanel && isHorizontalOriented(this.orientation)) {
      logger.logWarning("Flip sideways option works only when the applet is placed on a vertical panel.")
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

  // -------------------------------------------------------------------------------------------------
  // Callback functions of advanced settings:
  // Mostly, the changes are applied via a re-init (call of initAnimation).
  // Some advanced settings depend on each other, e.g. it does not make sense to adjust the margin value when auto margin is enabled.
  // The updated settings values (e.g. height, width) will be used then (inside "determineRenderOptions" method).
  // Afterwards, an updateApplet is necessary to clear any possible error states (e.g. recover from invalid values) and to update the popup menu.
  // TODO: Consider consolidating most functions here because they do essentially the same (init and update call).

  private updateAnimationScalingMode(): void {
    this.initAnimation()
    this.updateApplet()
  }

  private updateAnimationAutoMargin(): void {
    // This guard should not be necessary, as the option is hidden in the settings menu when auto-fit is not selected.
    const scalingMode = mapStringToAnimationScalingMode(this.settingsObject.animationScalingMode)
    if (scalingMode !== "AutoFit") {
      logger.logDebug("Margin options only apply when the 'auto-fit' animation scaling option is enabled.")
    } else {
      this.initAnimation()
      this.updateApplet()
    }
  }

  private updateAnimationMargin(): void {
    // The guards here should not be necessary as well.
    const scalingMode = mapStringToAnimationScalingMode(this.settingsObject.animationScalingMode)
    if (scalingMode !== "AutoFit") {
      logger.logDebug("Margin options only apply when the 'auto-fit' animation scaling option is enabled.")
    } else if (this.settingsObject.autoAnimationMargin) {
      // This should already be handled by the dependency option of the related spinbutton setting widget (see: settings-schema.json -> keyAnimationMargin).
      logger.logDebug("The 'auto-margin' option is turned on, so the custom margin value is ignored.")
    } else {
      this.initAnimation()
      this.updateApplet()
    }
  }

  private updateCustomAnimationHeight(): void {
    // This guard should not be necessary, as the option is hidden in the settings menu when not applicable.
    const scalingMode = mapStringToAnimationScalingMode(this.settingsObject.animationScalingMode)
    if (scalingMode !== "Custom") {
      logger.logDebug("Custom height options only apply when the 'custom' animation scaling option is enabled.")
    } else {
      this.initAnimation()
      this.updateApplet()
    }
  }

  private updateCustomAnimationWidth(): void {
    // This guard should not be necessary, as the option is hidden in the settings menu when not applicable.
    const scalingMode = mapStringToAnimationScalingMode(this.settingsObject.animationScalingMode)
    if (scalingMode !== "Custom") {
      logger.logDebug("Custom width options only apply when the 'custom' animation scaling option is enabled.")
    } else {
      this.initAnimation()
      this.updateApplet()
    }
  }

  private updatePreserveAnimationAspectRatio(): void {
    // This guard should not be necessary, as the option is hidden in the settings menu when not applicable.
    const scalingMode = mapStringToAnimationScalingMode(this.settingsObject.animationScalingMode)
    if (scalingMode !== "Custom") {
      logger.logDebug(
        "The 'Preserve aspect ratio' option only apply when the 'custom' animation scaling option is used.",
      )
    } else {
      this.initAnimation()
      this.updateApplet()
    }
  }

  private updateAnimationRotation(): void {
    this.initAnimation()
    this.updateApplet()
  }

  // developer options
  private updateLogLevel(): void {
    const logLevel = mapStringToLogLevel(this.settingsObject.logLevel)
    logger.setLogLevel(logLevel)
  }
  private updateForceFoolsDay(): void {
    const isActivated = this.settingsObject.forceFoolsDay
    if (isActivated) {
      this.stopPeriodicFoolsDayCheck()
      this.isFoolsDay = true
      // need to re-init applet with Fool's Day animation and popup
      this.initAnimation()
      this.updateApplet()
    } else {
      // function will once directly do a check and re-inits the applet correctly again
      this.startPeriodicFoolsDayCheck()
    }
  }

  // -------------------------------------------------------------------------------------------------

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
    // Fool's Day has just began or is now over. Need to re-init animation and popup.
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
    // before starting a new timeout, stop previous if any
    this.stopPeriodicFoolsDayCheck()
    // check once immediately
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

  private setThemeStyleClasses(): void {
    if (this.isDarkMode()) {
      this.actor.add_style_class_name("dark")
      if (this.messagePopup) {
        this.messagePopup.addStyleClassName("dark")
      }
    } else {
      this.actor.remove_style_class_name("dark")
      if (this.messagePopup) {
        this.messagePopup.removeStyleClassName("dark")
      }
    }
  }

  private changeTheme(): void {
    this.setThemeStyleClasses()
  }

  private isDarkMode(): boolean {
    return getThemeAppearance(DEFAULT_APPLET_CLASS_NAME) === "Dark" ? true : false
  }

  private getAppletMargin(): number {
    if (this.settingsObject.autoAnimationMargin) {
      return getMargin(DEFAULT_APPLET_CLASS_NAME)
    }
    return this.settingsObject.customAnimationMargin
  }
}
