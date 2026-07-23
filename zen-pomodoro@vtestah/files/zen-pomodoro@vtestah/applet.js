const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Applet = imports.ui.applet;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const CinnamonEntry = imports.ui.cinnamonEntry;
const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Dialog = imports.ui.dialog;
const Meta = imports.gi.Meta;
const MessageTray = imports.ui.messageTray;

const UUID = "zen-pomodoro@vtestah";

let TimerModule, SoundModule, DialogsModule, MenuModule, ConstantsModule, VisualModule, FeaturesModule, SoundFxModule, FlowModule;

if (typeof require !== 'undefined') {
    TimerModule = require('./timer');
    SoundModule = require('./sound');
    DialogsModule = require('./dialogs');
    MenuModule = require('./menu');
    ConstantsModule = require('./constants');
    VisualModule = require('./visual');
    FeaturesModule = require('./features');
    SoundFxModule = require('./soundfx');
    FlowModule = require('./flow');
} else {
    const AppletDir = imports.ui.appletManager.applets[UUID];
    TimerModule = AppletDir.timer;
    SoundModule = AppletDir.sound;
    DialogsModule = AppletDir.dialogs;
    MenuModule = AppletDir.menu;
    ConstantsModule = AppletDir.constants;
    VisualModule = AppletDir.visual;
    FeaturesModule = AppletDir.features;
    SoundFxModule = AppletDir.soundfx;
    FlowModule = AppletDir.flow;
}

const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

const {
    POMODORO_STATE_FILE,
    POMODORO_STATE_MAX_AGE_MS,
    POMODORO_STATS_FILE,
    POMODORO_FOCUS_FRAME_BOTTOM_SAFE,
    POMODORO_FOCUS_FRAME_NORMAL_STYLE,
    POMODORO_FOCUS_FRAME_WARNING_STYLE,
    POMODORO_BREAK_OVER_FRAME_STYLE,
    POMODORO_FOCUS_FRAME_PULSE_INTERVAL_MS,
    POMODORO_FOCUS_FRAME_TRANSITION,
    POMODORO_FOCUS_FRAME_PULSE_STYLES,
    POMODORO_BREAK_FRAME_PULSE_STYLES,
    POMODORO_FOCUS_FRAME_STYLE,
    POMODORO_PANEL_FOCUS_CUE_STYLE,
    POMODORO_PANEL_BREAK_CUE_STYLE,
    POMODORO_PANEL_FOCUS_LABEL_STYLE,
    POMODORO_PANEL_BREAK_LABEL_STYLE,
    POMODORO_PANEL_FOCUS_CUE_STYLE_LIGHT,
    POMODORO_PANEL_BREAK_CUE_STYLE_LIGHT,
    POMODORO_PANEL_FOCUS_LABEL_STYLE_LIGHT,
    POMODORO_PANEL_BREAK_LABEL_STYLE_LIGHT,
    POMODORO_FOCUS_TASK_CHIP_STYLE,
    POMODORO_FOCUS_TASK_CHIP_PAUSED_STYLE,
    POMODORO_FOCUS_CHIP_MARGIN,
    POMODORO_FOCUS_RITUAL_STYLE,
    POMODORO_FOCUS_RITUAL_FADE_IN_MS,
    POMODORO_FOCUS_RITUAL_HOLD_MS,
    POMODORO_FOCUS_RITUAL_FADE_OUT_MS,
    POMODORO_FOCUS_RITUAL_FRAME_FADE_MS,
    POMODORO_FOCUS_RITUAL_STEP_MS,
    POMODORO_FOCUS_GLOW_FOCUS_RGB,
    POMODORO_FOCUS_GLOW_FOCUS_END_RGB,
    POMODORO_FOCUS_GLOW_BREAK_RGB,
    POMODORO_FOCUS_GLOW_END_SHIFT_START,
    POMODORO_FOCUS_GLOW_DEPTH_RATIO,
    POMODORO_FOCUS_GLOW_DEPTH_MAX,
    POMODORO_FOCUS_GLOW_DEPTH_MIN,
    POMODORO_FOCUS_GLOW_MAX_ALPHA,
    POMODORO_FOCUS_GLOW_PROGRESS_WIDTH,
    POMODORO_FOCUS_GLOW_PROGRESS_ALPHA,
    POMODORO_FOCUS_GLOW_TRACK_ALPHA,
    POMODORO_FOCUS_GLOW_TICK_ALPHA,
    POMODORO_FOCUS_GLOW_TICK_RADIUS,
    POMODORO_FOCUS_GLOW_BREATH_BOOST,
    POMODORO_FOCUS_GLOW_BREATH_MS
} = ConstantsModule;

function _(str) {
    return Gettext.dgettext(UUID, str);
}

// this function is useful for development of the applet
// as we can quickly disable long running settings for quick tuning
// i.e a setting of 25 in the options can mean 25 seconds if we comment out the '* 60'
// makes it easy to test all of the timers quickly
function convertMinutesToSeconds(minutes) {
    // Guard a corrupted/non-numeric setting: setTimerLimit throws on anything
    // below 1, so clamp to a sane 1-minute floor instead of crashing the timer.
    let m = Number(minutes);
    if (!isFinite(m) || m < 1) { m = 1; }
    return Math.round(m * 60);
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new PomodoroApplet(metadata, orientation, panelHeight, instanceId);
}

class PomodoroApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this._metadata = metadata;
        this._orientation = orientation;

        // 'pomodoro', 'pomodoro-stop', 'short-break', 'long-break', 'break-over', '*-paused'
        this._currentState = 'pomodoro-stop';
        this._focusFrame = null;
        this._focusFrames = [];
        this._focusTaskChip = null;
        this._focusTaskChipLabel = null;
        this._focusRitualLabel = null;
        this._focusRitualTimeouts = [];
        this._focusGlowFrames = [];
        this._glowBreakish = false;
        this._glowProgress = 0;
        this._glowCurrentElapsed = 0;
        this._glowSegments = 0;
        this._glowBreathBoost = 0;
        this._glowBreathedForTimer = false;
        this._glowBreathTimeouts = [];
        this._appearancePreviewTimeout = 0;
        this._breathingPreviewTimeout = 0;
        this._focusFrameMonitorsChangedId = null;
        this._focusFramePulseSourceId = null;
        this._focusFrameLastTicks = null;
        this._currentFocusTask = "";
        this._taskSelectOnly = false;
        this._breakOverFrom = "";
        this._timerPauseInProgress = false;
        this._pausedState = "";

        // Number of finished pomodori in the current set.
        this._numPomodoriFinished = 0;
        // Number of finished sets.
        this._numPomodoroSetFinished = 0;
        // Set when the current pomodoro is skipped, so the next phase doesn't
        // record it as a completed pomodoro (which would inflate the stats).
        this._skippedPomodoro = false;
        // Armed at focus start; the pre-end warning fires once when the remaining
        // time first crosses the threshold (robust to a skipped/drifted tick).
        this._warnArmed = false;
        this._pushReminderArmed = false;   // pre-end Pushover reminder, armed at focus start
        this._setTimerLabel(0);
        this._updatePanelFocusCue();

        // option settings, values are bound in _bindSettings
        // using _opt prefix to make them easy to identify
        this._opt_pomodoroTimeMinutes = null;
        this._opt_shortBreakTimeMinutes = null;
        this._opt_longBreakTimeMinutes = null;
        this._opt_pomodoriNumber = null;
        this._opt_startAutomaticallyOnLoad = null;
        this._opt_showDialogMessages = null;
        this._opt_autoStartBreak = null;
        this._opt_autoStartPomodoro = null;
        this._opt_panelIconStyle = null;
        this._opt_panelCustomIcon = null;
        this._opt_showTimerInPanel = null;
        this._opt_showSeconds = null;
        this._opt_hotkey = null;
        this._opt_hotkeyToggle = null;
        this._opt_hotkeySkip = null;
        this._opt_hotkeyDistraction = null;
        this._opt_startOnClick = null;
        this._opt_panelScrollControl = null;
        this._opt_scrollAction = null;
        this._opt_strictFocus = null;
        this._opt_playTickerSound = null;
        this._opt_tickerSoundPath = null;
        this._opt_tickerSoundVolume = null;
        this._opt_playBreakSound = null;
        this._opt_breakSoundPath = null;
        this._opt_breakSoundVolume = null;
        this._opt_playWarnSound = null;
        this._opt_warnSoundDelay = null;
        this._opt_warnSoundPath = null;
        this._opt_warnSoundVolume = null;
        this._opt_playStartSound = null;
        this._opt_startSoundPath = null;
        this._opt_startSoundVolume = null;
        this._opt_intervalChime = null;
        this._opt_intervalChimeSeconds = null;
        this._opt_intervalChimeFile = null;
        this._opt_intervalChimeVolume = null;
        this._opt_focusShowTaskChip = null;
        this._opt_focusStartRitual = null;
        this._opt_customPresets = null;
        this._opt_requireFocusTask = null;
        this._opt_promptFocusTask = null;
        this._opt_themePreset = null;
        this._opt_accentFocusColor = null;
        this._opt_accentBreakColor = null;
        this._opt_frameStyle = null;
        this._opt_glowIntensity = null;
        this._opt_breathingPattern = null;
        this._opt_chipPosition = null;
        this._opt_reduceMotion = null;
        this._opt_menuFontScale = null;
        this._opt_sessionRecovery = null;
        this._opt_dailyGoal = null;
        this._opt_taskCelebration = null;
        this._confettiArea = null;
        this._confettiTimeout = 0;
        this._confettiParts = null;
        this._opt_autoPauseIdle = null;
        this._opt_autoPauseIdleMinutes = null;
        this._opt_autoResumeOnActivity = null;
        this._opt_flowExtend = null;
        this._opt_flowExtendMinutes = null;
        this._opt_flowSoftLanding = null;
        this._opt_flowSoftLandingBehavior = null;
        this._opt_focusAmbientSound = null;
        this._opt_focusAmbientChoice = null;
        this._opt_ambientMigrated = null;
        this._ambientLastChoice = 'brown';
        this._opt_focusDnd = null;
        this._opt_pauseMedia = null;
        this._pausedMediaPlayers = [];
        this._mediaPauseInFlight = false;
        this._opt_runCommandEnabled = null;
        this._opt_breakLockEnabled = null;
        this._opt_breakLockLongOnly = null;
        this._breakLockTimeoutId = 0;
        // Set only while the screen is locked because of one of OUR breaks
        // (never for a lock the user triggers themselves); cleared the moment
        // the screensaver reports it deactivated, i.e. after real
        // authentication has already happened. Never used to trigger or
        // shortcut unlocking — purely a courtesy "welcome back" cue.
        this._breakLockActive = false;
        this._screensaverProxy = null;
        this._screensaverSignalId = 0;
        this._opt_focusStartCommand = null;
        this._opt_breakStartCommand = null;
        this._opt_goalCommand = null;
        this._opt_pushoverEnabled = null;
        this._opt_pushoverCustomize = null;
        this._opt_pushoverUserKey = null;
        this._opt_pushoverAppToken = null;
        this._opt_pushoverTitle = null;
        this._opt_pushoverMsgShortBreak = null;
        this._opt_pushoverMsgLongBreak = null;
        this._opt_pushoverMsgGoal = null;
        this._opt_pushoverMsgResume = null;
        this._opt_pushoverMsgFocus = null;
        this._opt_pushoverSound = null;
        this._opt_pushoverPriority = null;
        this._opt_pushoverReminder = null;
        this._opt_pushoverReminderMinutes = null;
        this._opt_pushoverMsgReminder = null;
        this._opt_pushoverReminderPhase = null;
        this._opt_blockDomains = null;
        this._opt_enableBlocking = null;
        this._opt_blockingAuthMode = null;
        this._opt_onboardingDone = null;
        this._dndActive = false;
        this._dndPrevValue = null;
        this._notificationSettings = null;
        this._opt_focusAmbientVolume = null;
        this._opt_focusAmbientFile = null;
        this._opt_breakBreathing = null;
        this._opt_zenModeEnabled = null;
        this._opt_zenDimStrength = null;
        this._opt_zenDimDesktop = null;
        this._dailyCount = 0;
        this._dailyStreak = 0;
        this._dailyStatsData = null;
        this._idleMonitor = null;
        this._idleWatchId = 0;
        this._activeWatchId = 0;
        // Flow Soft Landing: pause-watch + cap-timeout source ids, and the
        // timestamp the current overrun (grace period) started at.
        this._flowPauseWatchId = 0;
        this._flowCapTimeoutId = 0;
        this._flowGraceStartMs = null;
        this._ambientSound = null;
        this._ambientSoundPath = null;
        this._ambientVolTimeout = 0;
        this._zenOverlay = null;
        this._zenHud = null;
        this._zenFocusSignal = 0;
        this._zenTimeLabel = null;
        this._zenTaskLabel = null;
        this._zenActive = false;
        this._breathOverlay = null;
        this._breathArea = null;
        this._breathSourceId = 0;
        this._breathStartMs = 0;

        this._settingsProvider = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this._bindSettings();

        // sounds/ lives at the UUID root; depending on whether the applet was
        // loaded from a versioned subdirectory (e.g. 6.4/) or from a flattened
        // package, that is either inside metadata.path or one level above it.
        this._defaultSoundPath = metadata.path + '/sounds';
        if (!GLib.file_test(this._defaultSoundPath, GLib.FileTest.IS_DIR) &&
            GLib.file_test(metadata.path + '/../sounds', GLib.FileTest.IS_DIR)) {
            this._defaultSoundPath = metadata.path + '/../sounds';
        }
        this._sounds = {};
        this._loadSoundEffects();

        this._timers = {
            pomodoro: new TimerModule.Timer({ timerLimit: convertMinutesToSeconds(this._opt_pomodoroTimeMinutes) }),
            shortBreak: new TimerModule.Timer({ timerLimit: convertMinutesToSeconds(this._opt_shortBreakTimeMinutes) }),
            longBreak: new TimerModule.Timer({ timerLimit: convertMinutesToSeconds(this._opt_longBreakTimeMinutes) })
        };

        this._timerQueue = new TimerModule.TimerQueue();
        this._resetPomodoroTimerQueue();

        this._createLongBreakDialog();
        this._createShortBreakDialog();
        this._createPomodoroFinishedDialog();
        this._createFocusTaskDialog();
        
        this._appletMenu = this._createMenu(orientation);
        // Refresh the runtime when the menu opens, so the blocking row reflects
        // the real /etc/hosts state (read only while the menu is open).
        this._appletMenu.connect('open-state-changed', (m, open) => {
            if (open) {
                try {
                    // Appearance bindings can fire before the bound option updates,
                    // so re-sync the menu font scale to the current setting on open.
                    this._appletMenu.setFontScale(this._opt_menuFontScale || 100);
                    this._updateMenuRuntime();
                } catch (e) {}
            }
        });
        this._updatePresetIndicator();
        this._createFocusFrame();

        this._connectTimerSignals();

        // Quick panel interactions: scroll to start/pause, middle-click to skip.
        this._setupPanelInteractions();

        // Trigger for initial setting
        this._onAppletIconChanged();
        this._onShowTimerChanged();

        // Initial setup of the hotkey
        this._updateHotkey();

        // Recover an in-progress focus session that survived a Cinnamon restart.
        this._refreshDailyStatsCache();
        this._loadTasksAsync(() => {
            // Keep the header in sync with the list's current task on load.
            let cur = this._currentTask();
            if (cur && !this._currentFocusTask) { this._currentFocusTask = cur.title; }
            this._refreshTasksMenu();
            this._refreshDistractions();
        });
        this._restoreSessionState();

        // start timer automatically
        if (this._opt_startAutomaticallyOnLoad && this._currentState === 'pomodoro-stop') {
            this._appletMenu.toggleTimerState(true);
            this._startTimerFromMenu();
        }
    }

    _bindSettings() {
        const emptyCallback = () => {};
    
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "pomodoro_duration",
            "_opt_pomodoroTimeMinutes",
            () => {
                this._onDurationSettingsChanged();
            }
        );
    
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "short_break_duration",
            "_opt_shortBreakTimeMinutes",
            () => {
                this._onDurationSettingsChanged();
            }
        );
    
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "long_break_duration",
            "_opt_longBreakTimeMinutes",
            () => {
                this._onDurationSettingsChanged();
            }
        );
    
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "pomodori_number",
            "_opt_pomodoriNumber",
            () => {
                this._updatePresetIndicator();
                // only take effect if the timer isn't currently running
                // otherwise wait until next pomodoro to take effect
                if (this._timerQueue.isRunning()) {
                    this.__pomodoriNumberChangedWhileRunning = true;
                    return;
                }
                this._resetPomodoroTimerQueue();
            }
        );

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "custom_presets", "_opt_customPresets", () => { this._updatePresetIndicator(); });

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "hotkey",
            "_opt_hotkey",
            () => {
                this._updateHotkey();
            }
        );
    
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "start_automatically_on_load", "_opt_startAutomaticallyOnLoad", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "session_recovery", "_opt_sessionRecovery", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "daily_goal", "_opt_dailyGoal", () => { this._updateMenuRuntime(); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "task_celebration", "_opt_taskCelebration", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "auto_pause_idle", "_opt_autoPauseIdle", this._updateIdleWatch.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "auto_pause_idle_minutes", "_opt_autoPauseIdleMinutes", this._updateIdleWatch.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "auto_resume_on_activity", "_opt_autoResumeOnActivity", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "flow_extend", "_opt_flowExtend", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "flow_extend_minutes", "_opt_flowExtendMinutes", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "flow_soft_landing", "_opt_flowSoftLanding", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "flow_soft_landing_behavior", "_opt_flowSoftLandingBehavior", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "focus_ambient_sound", "_opt_focusAmbientSound", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "focus_ambient_choice", "_opt_focusAmbientChoice", this._onAmbientChoiceChanged.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "ambient_migrated", "_opt_ambientMigrated", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "focus_dnd", "_opt_focusDnd", () => this._updateDnd());
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pause_media", "_opt_pauseMedia", () => this._updateMediaPause());
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "run_command_enabled", "_opt_runCommandEnabled", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "break_lock_enabled", "_opt_breakLockEnabled", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "break_lock_long_only", "_opt_breakLockLongOnly", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "focus_start_command", "_opt_focusStartCommand", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "break_start_command", "_opt_breakStartCommand", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "goal_command", "_opt_goalCommand", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_enabled", "_opt_pushoverEnabled", () => {
            // When Pushover is turned off, collapse the advanced sections so they
            // don't linger as empty groups.
            if (!this._opt_pushoverEnabled && this._opt_pushoverCustomize) {
                try { this._settingsProvider.setValue('pushover_customize', false); } catch (e) {}
            }
        });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_customize", "_opt_pushoverCustomize", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_user_key", "_opt_pushoverUserKey", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_app_token", "_opt_pushoverAppToken", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_title", "_opt_pushoverTitle", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_msg_short_break", "_opt_pushoverMsgShortBreak", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_msg_long_break", "_opt_pushoverMsgLongBreak", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_msg_goal", "_opt_pushoverMsgGoal", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_msg_resume", "_opt_pushoverMsgResume", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_msg_focus", "_opt_pushoverMsgFocus", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_sound", "_opt_pushoverSound", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_priority", "_opt_pushoverPriority", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_reminder", "_opt_pushoverReminder", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_reminder_minutes", "_opt_pushoverReminderMinutes", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_msg_reminder", "_opt_pushoverMsgReminder", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "pushover_reminder_phase", "_opt_pushoverReminderPhase", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "block_domains", "_opt_blockDomains", this._onBlockDomainsChanged.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "enable_blocking", "_opt_enableBlocking", this._onBlockDomainsChanged.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "blocking_auth_mode", "_opt_blockingAuthMode", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "onboarding_done", "_opt_onboardingDone", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "focus_ambient_volume", "_opt_focusAmbientVolume", this._restartAmbientLive.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "focus_ambient_file", "_opt_focusAmbientFile", this._restartAmbientLive.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "break_breathing", "_opt_breakBreathing", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "zen_mode_enabled", "_opt_zenModeEnabled", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "zen_dim_strength", "_opt_zenDimStrength", () => this._reapplyZenDim());
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "zen_dim_desktop", "_opt_zenDimDesktop", () => this._reapplyZenDim());
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "show_dialog_messages", "_opt_showDialogMessages", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "auto_start_break", "_opt_autoStartBreak", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "auto_start_pomodoro", "_opt_autoStartPomodoro", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "focus_show_task_chip", "_opt_focusShowTaskChip", () => { this._updateFocusFrame(); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "focus_start_ritual", "_opt_focusStartRitual", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "require_focus_task", "_opt_requireFocusTask", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "prompt_focus_task", "_opt_promptFocusTask", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "theme_preset", "_opt_themePreset", () => { this._applyAppearance(); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "accent_focus_color", "_opt_accentFocusColor", () => { this._applyAppearance(); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "accent_break_color", "_opt_accentBreakColor", () => { this._applyAppearance(); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "frame_style", "_opt_frameStyle", () => { this._updateFocusFrame(); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "glow_intensity", "_opt_glowIntensity", () => { this._updateFocusFrame(); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "breathing_pattern", "_opt_breathingPattern", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "chip_position", "_opt_chipPosition", () => { this._updateFocusFrame(); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "reduce_motion", "_opt_reduceMotion", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "menu_font_scale", "_opt_menuFontScale", () => { this._applyAppearance(); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "panel_icon_style", "_opt_panelIconStyle", this._onAppletIconChanged.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "panel_custom_icon", "_opt_panelCustomIcon", this._onAppletIconChanged.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "show_timer", "_opt_showTimerInPanel", this._onShowTimerChanged.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "show_seconds", "_opt_showSeconds", this._onShowTimerChanged.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "hotkey_toggle", "_opt_hotkeyToggle", this._updateHotkey.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "hotkey_skip", "_opt_hotkeySkip", this._updateHotkey.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "hotkey_distraction", "_opt_hotkeyDistraction", this._updateHotkey.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "start_on_click", "_opt_startOnClick", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "panel_scroll_control", "_opt_panelScrollControl", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "scroll_action", "_opt_scrollAction", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "strict_focus", "_opt_strictFocus", () => { this._updateMenuRuntime(); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "timer_sound", "_opt_playTickerSound", this._onPlayTickedSoundChanged.bind(this));

        // Binding properties that require updating or recalculating other settings
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "timer_sound_file",
            "_opt_tickerSoundPath",
            () => {
                this._loadSoundEffects();
                if (this._tickerPreview) { this._previewTimerSound(); return; }
                if (this._onPlayTickedSoundChanged() === false) {
                    this._playTickerSound(true); // idle: short preview of the new file
                }
            }
        );
    
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "timer_sound_volume",
            "_opt_tickerSoundVolume",
            () => {
                if (this._tickerPreviewLiveVolume()) { return; }
                // In a real focus session, re-apply to the gapless loop (live, seamless).
                if (this._opt_playTickerSound && this._currentState === 'pomodoro') { this._playTickerSound(); return; }
                if (this._onPlayTickedSoundChanged() === false) {
                    this._playTickerSound(true); // If not playing, play a preview
                }
            }
        );
    
        // Continuing with additional settings properties
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "break_sound", "_opt_playBreakSound", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "break_sound_file", "_opt_breakSoundPath", () => { this._loadSoundEffects(); this._playBreakSound(true); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "break_sound_volume", "_opt_breakSoundVolume", () => this._playBreakSound(true));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "warn_sound", "_opt_playWarnSound", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "warn_sound_delay", "_opt_warnSoundDelay", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "warn_sound_file", "_opt_warnSoundPath", () => { this._loadSoundEffects(); this._playWarnSound(true); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "warn_sound_volume", "_opt_warnSoundVolume", () => this._playWarnSound(true));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "start_sound", "_opt_playStartSound", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "start_sound_file", "_opt_startSoundPath", () => { this._loadSoundEffects(); this._playStartSound(true); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "start_sound_volume", "_opt_startSoundVolume", () => this._playStartSound(true));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "interval_chime", "_opt_intervalChime", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "interval_chime_seconds", "_opt_intervalChimeSeconds", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "interval_chime_file", "_opt_intervalChimeFile", () => { this._loadSoundEffects(); this._playIntervalChime(true); });
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "interval_chime_volume", "_opt_intervalChimeVolume", () => this._playIntervalChime(true));
    
        // Show the "no sound backend" hint only when neither GSound nor a
        // fallback player (paplay / canberra-gtk-play / play) is available.
        this._settingsProvider.setValue('show_sox_info', !SoundModule.isPlayable());

        // Apply initial appearance (accent colours / font scale / frame style).
        this._applyAppearance();

        // Push the loaded presets to the menu now that settings are bound.
        this._updatePresetIndicator();


        // One-time migration: the old on/off bool becomes a sound choice. Read
        // the stored value directly — the bound _opt_ may not have loaded yet.
        if (!this._opt_ambientMigrated) {
            try {
                let wasOn = this._settingsProvider.getValue('focus_ambient_sound');
                this._settingsProvider.setValue('focus_ambient_choice', wasOn ? 'brown' : 'off');
                this._settingsProvider.setValue('ambient_migrated', true);
            } catch (e) {}
        }

        // First-run onboarding wizard.
        if (!this._opt_onboardingDone) {
            this._onboardingTimeoutId = imports.gi.GLib.timeout_add(imports.gi.GLib.PRIORITY_DEFAULT, 2500, () => {
                this._onboardingTimeoutId = 0;
                try { this._showOnboardingWizard(); } catch (e) { global.logError("Zen Pomodoro onboarding: " + e); }
                return false;
            });
        }

        // Clear a stale block left by a crash/reload (passwordless only — never
        // prompts). Deferred so any session recovery runs first.
        this._blockReconcileTimeoutId = imports.gi.GLib.timeout_add(imports.gi.GLib.PRIORITY_DEFAULT, 3000, () => {
            this._blockReconcileTimeoutId = 0;
            try { this._syncBlockListFromHosts(); this._syncBlocking(false); this._blockingReady = true; } catch (e) { global.logError("Zen Pomodoro reconcile: " + e); }
            return false;
        });
    }

    _updateHotkey() {
        Main.keybindingManager.removeHotKey(UUID);
        Main.keybindingManager.removeHotKey(UUID + "-toggle");
        Main.keybindingManager.removeHotKey(UUID + "-skip");
        Main.keybindingManager.removeHotKey(UUID + "-distraction");

        if (this._opt_hotkey) {
            Main.keybindingManager.addHotKey(UUID, this._opt_hotkey, () => {
                this._appletMenu.toggle();
            });
        }
        if (this._opt_hotkeyToggle) {
            Main.keybindingManager.addHotKey(UUID + "-toggle", this._opt_hotkeyToggle, () => {
                this._toggleTimerFromHotkey();
            });
        }
        if (this._opt_hotkeySkip) {
            Main.keybindingManager.addHotKey(UUID + "-skip", this._opt_hotkeySkip, () => {
                if (this._appletMenu) {
                    this._appletMenu.emit('skip-timer');
                }
            });
        }
        if (this._opt_hotkeyDistraction) {
            Main.keybindingManager.addHotKey(UUID + "-distraction", this._opt_hotkeyDistraction, () => {
                this._showDistractionCapture();
            });
        }
    }

    _toggleTimerFromHotkey() {
        let timer = this._timerQueue ? this._timerQueue.getCurrentTimer() : null;
        if (timer && timer.isRunning()) {
            this._appletMenu.emit('stop-timer');
        } else {
            this._appletMenu.emit('start-timer');
        }
    }

    // Strict ("commit") focus mode: while a focus block is running, casual
    // pause/skip is blocked so you stay with it. Reset (abandon) is still
    // available as a deliberate action, so it's never a hard lockout.
    _strictFocusBlocks() {
        if (!this._opt_strictFocus) {
            return false;
        }
        if (this._currentState !== 'pomodoro') {
            return false;
        }
        let timer = this._timerQueue ? this._timerQueue.getCurrentTimer() : null;
        return Boolean(timer && timer.isRunning());
    }

    _strictFocusNotice() {
        Main.notify(_("Strict focus is on"), _("Stay with it — finish the block, or reset to start over."));
    }

    // Show a desktop notification with optional action buttons. Each action is
    // { id, label, fn }. Falls back to a plain notification on any error.
    _notifyWithActions(title, body, actions) {
        actions = actions || [];
        try {
            let source = new MessageTray.SystemNotificationSource();
            Main.messageTray.add(source);
            let notification = new MessageTray.Notification(source, title, body);
            notification.setTransient(true);
            actions.forEach((a) => notification.addButton(a.id, a.label));
            if (actions.length) {
                notification.connect('action-invoked', (notif, id) => {
                    let act = actions.find((x) => x.id === id);
                    if (act && typeof act.fn === 'function') {
                        try { act.fn(); } catch (e) { global.logError("Zen Pomodoro: notification action: " + e); }
                    }
                    try { notif.destroy(); } catch (e) {}
                });
            }
            source.notify(notification);
        } catch (e) {
            global.logError("Zen Pomodoro: actionable notification failed: " + e);
            try { Main.notify(title, body); } catch (e2) {}
        }
    }

    // Quick mouse interactions on the panel widget, so common actions don't
    // require opening the menu:
    //   • scroll up   → start / resume focus
    //   • scroll down → pause
    //   • middle-click → skip to the next phase (or start focus when idle)
    _setupPanelInteractions() {
        if (!this.actor) {
            return;
        }

        this.actor.connect('scroll-event', (actor, event) => {
            if (!this._opt_panelScrollControl) {
                return Clutter.EVENT_PROPAGATE;
            }
            let dir = event.get_scroll_direction();
            let up = false, down = false;
            if (dir === Clutter.ScrollDirection.UP) {
                up = true;
            } else if (dir === Clutter.ScrollDirection.DOWN) {
                down = true;
            } else if (dir === Clutter.ScrollDirection.SMOOTH) {
                let [, dy] = event.get_scroll_delta();
                if (dy < -0.01) { up = true; }
                else if (dy > 0.01) { down = true; }
            }
            if (!up && !down) {
                return Clutter.EVENT_PROPAGATE;
            }

            if (this._opt_scrollAction === 'focus_length') {
                // Adjust the focus length — only when idle (no running/paused timer).
                if (this._currentState === 'pomodoro-stop' || this._currentState === 'break-over' || this._currentState === 'focus-over') {
                    let cur = this._opt_pomodoroTimeMinutes || 25;
                    let next = Math.max(1, Math.min(60, cur + (up ? 5 : -5)));
                    if (next !== cur) {
                        this._settingsProvider.setValue('pomodoro_duration', next);
                        this._updateMenuRuntime();
                        Main.notify(_("Focus length: %d min").format(next));
                    }
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            }

            // Default: start / pause.
            let timer = this._timerQueue ? this._timerQueue.getCurrentTimer() : null;
            let running = Boolean(timer && timer.isRunning());
            if (up && !running) {
                this._appletMenu.emit('start-timer');
                return Clutter.EVENT_STOP;
            }
            if (down && running) {
                this._appletMenu.emit('stop-timer');
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.actor.connect('button-press-event', (actor, event) => {
            if (!this._opt_panelScrollControl) {
                return Clutter.EVENT_PROPAGATE;
            }
            if (event.get_button() !== 2) {
                return Clutter.EVENT_PROPAGATE; // leave left/right click to default handling
            }
            if (this._currentState === 'pomodoro-stop' || this._currentState === 'break-over' || this._currentState === 'focus-over') {
                this._startTimerFromMenu();
            } else {
                this._appletMenu.emit('skip-timer');
            }
            return Clutter.EVENT_STOP;
        });
    }
    
    _setTimerLabel(ticks) {
        let timeLeft = this._getFormattedTimeLeft(ticks);
        if (timeLeft === undefined) {
            return;
        }
    
        let timerText = this._getPanelStateLabel();
    
        if (this._currentState !== 'pomodoro-stop' && this._currentState !== 'break-over' && this._currentState !== 'focus-over' && this._opt_showTimerInPanel) {
            let panelTime = (this._opt_showSeconds === false) ? `${Math.max(0, Math.ceil(ticks / 60))}m` : timeLeft;
            timerText += ` ${panelTime}`;
        }

        if (this._numPomodoroSetFinished > 0) {
            timerText += ` \u00B7 ${this._numPomodoroSetFinished}`;
        }

        let focusTask = this._getPanelFocusTask();
        if (focusTask) {
            timerText += ` \u00B7 ${focusTask}`;
        }
    
        let vertical = (this._orientation === St.Side.LEFT || this._orientation === St.Side.RIGHT);
        if (this._currentState === 'pomodoro-stop') {
            // Idle: show just the tomato — no label — for a clean, calm panel.
            // The state is still in the tooltip and the menu.
            this.set_applet_label("");
            if (typeof this.hide_applet_label === 'function') { this.hide_applet_label(true); }
        } else if (vertical) {
            // Vertical panels are narrow: show only the remaining minutes (the
            // icon + progress ring carry the rest).
            if (typeof this.hide_applet_label === 'function') { this.hide_applet_label(false); }
            let compact = "";
            if (this._currentState !== 'break-over' &&
                this._opt_showTimerInPanel && typeof ticks === 'number') {
                compact = `${Math.max(0, Math.ceil(ticks / 60))}`;
            }
            this.set_applet_label(compact);
        } else {
            if (typeof this.hide_applet_label === 'function') { this.hide_applet_label(false); }
            this.set_applet_label(timerText);
        }
        this._updateMenuRuntime(ticks);
        if (this._panelProgressArea && this._panelProgressArea.visible) {
            this._panelProgressArea.queue_repaint();
        }
    }

    _updateMenuRuntime(ticks = null) {
        if (!this._appletMenu || typeof this._appletMenu.updateRuntimeState !== 'function') {
            return;
        }
        // The menu's runtime state only matters while it's visible; open-state-changed
        // refreshes it on open, so skip the recompute (incl. _computeStats) when closed.
        // (The panel label and ring are updated by _setTimerLabel regardless.)
        if (!this._appletMenu.isOpen) {
            return;
        }

        if (ticks === null && this._timerQueue) {
            let timer = this._timerQueue.getCurrentTimer();
            if (timer) {
                ticks = timer.getTicksRemaining();
            }
        }

        let timer = this._timerQueue ? this._timerQueue.getCurrentTimer() : null;
        let progressPercent = this._getTimerProgressPercent(ticks);
        let activePreset = "unknown";
        if (this._opt_pomodoroTimeMinutes !== null && this._opt_shortBreakTimeMinutes !== null &&
            this._opt_longBreakTimeMinutes !== null && this._opt_pomodoriNumber !== null) {
            activePreset = this._getActivePresetLabel();
        }

        let endTime = "";
        if (timer && timer.isRunning() && typeof ticks === "number" && ticks > 0) {
            let end = new Date(Date.now() + ticks * 1000);
            endTime = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
        }

        let finishEstimate = null;
        try {
            let est = this._estimateFinish();
            if (est) { finishEstimate = { time: est.time, remaining: est.remaining }; }
        } catch (e) {}

        let bstat = this._menuBlockStatus();
        this._appletMenu.updateRuntimeState({
            state: this._currentState,
            stateLabel: this._getPanelStateLabel(),
            focusMinutes: this._opt_pomodoroTimeMinutes || 25,
            timeLeft: this._getFormattedTimeLeft(ticks),
            progressPercent: progressPercent,
            endTime: endTime,
            finishEstimate: finishEstimate,
            strictFocus: Boolean(this._opt_strictFocus),
            focusLength: this._opt_pomodoroTimeMinutes || 25,
            ambientOn: this._ambientEnabled(),
            task: this._getPanelFocusTask(),
            selectedTask: this._currentFocusTask || "",
            activePreset: activePreset,
            timerRunning: Boolean(timer && timer.isRunning()),
            timerPaused: this._isPausedState(),
            blockedSitesCount: this._getBlockedSitesCount(),
            blockingEnabled: Boolean(this._opt_enableBlocking),
            blockingSectionActive: bstat.sectionActive,
            blockingHostsCount: bstat.hostsCount,
            hotkey: this._opt_hotkey || "",
            pomodoriTotal: this._opt_pomodoriNumber || 4,
            pomodoriDone: this._numPomodoriFinished || 0,
            setsDone: this._numPomodoroSetFinished || 0,
            dailyGoal: this._opt_dailyGoal || 0,
            dailyCount: this._dailyCount || 0,
            streak: this._dailyStreak || 0,
            stats: this._computeStats(),
            zenEnabled: Boolean(this._opt_zenModeEnabled),
            zenActive: Boolean(this._zenActive)
        });
    }

    _getBlockedSitesCount() {
        try {
            return this._collectBlockDomains().length;
        } catch (e) {
            return 0;
        }
    }

    _writeJsonAsync(path, obj) {
        let data;
        try {
            data = JSON.stringify(obj);
        } catch (e) {
            return;
        }
        try {
            GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
            let file = Gio.File.new_for_path(path);
            let bytes = GLib.Bytes.new(ByteArray.fromString(data));
            file.replace_contents_bytes_async(bytes, null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null, (f, res) => {
                    try {
                        f.replace_contents_finish(res);
                    } catch (e) {
                        // Persisting is best-effort; ignore failures.
                    }
                });
        } catch (e) {
            // best effort
        }
    }

    _readJsonAsync(path, onResult) {
        let file = Gio.File.new_for_path(path);
        file.load_contents_async(null, (f, res) => {
            let obj = null;
            try {
                let [ok, contents] = f.load_contents_finish(res);
                if (ok) {
                    obj = JSON.parse(ByteArray.toString(contents));
                }
            } catch (e) {
                obj = null;
            }
            try { onResult(obj); } catch (e) { global.logError("Zen Pomodoro: JSON result handler failed: " + e.message); }
        });
    }

    _persistSessionState(force = false) {
        if (!this._opt_sessionRecovery) {
            return;
        }

        let now = GLib.get_monotonic_time();
        if (!force && this.__stateSavedAt && (now - this.__stateSavedAt) < 5000000) {
            return;
        }
        this.__stateSavedAt = now;

        let ticksRemaining = null;
        if (this._timerQueue) {
            let timer = this._timerQueue.getCurrentTimer();
            if (timer) {
                ticksRemaining = timer.getTicksRemaining();
            }
        }

        let data = {
            state: this._currentState,
            ticksRemaining: ticksRemaining,
            focusTask: this._currentFocusTask || "",
            pomodoriDone: this._numPomodoriFinished || 0,
            setsDone: this._numPomodoroSetFinished || 0,
            savedAt: Date.now()
        };

        this._writeJsonAsync(POMODORO_STATE_FILE, data);
    }

    _clearSessionState() {
        try {
            if (GLib.file_test(POMODORO_STATE_FILE, GLib.FileTest.EXISTS)) {
                GLib.unlink(POMODORO_STATE_FILE);
            }
        } catch (e) {
            // ignore
        }
        this.__stateSavedAt = null;
    }

    _restoreSessionState() {
        if (!this._opt_sessionRecovery) {
            return;
        }
        this._readJsonAsync(POMODORO_STATE_FILE, (data) => this._applyRestoredSessionState(data));
    }

    _applyRestoredSessionState(data) {
        if (!data || typeof data !== "object") {
            return;
        }
        // Stale state is ignored.
        if (typeof data.savedAt !== "number" || (Date.now() - data.savedAt) > POMODORO_STATE_MAX_AGE_MS) {
            this._clearSessionState();
            return;
        }

        let wasFocus = (data.state === "pomodoro" || data.state === "pomodoro-paused");
        if (!wasFocus) {
            // Only an in-progress focus session is worth restoring; otherwise drop it.
            this._clearSessionState();
            return;
        }

        try {
            let total = this._opt_pomodoriNumber || 4;
            let done = Math.max(0, Math.min(total - 1, parseInt(data.pomodoriDone) || 0));

            this._numPomodoroSetFinished = Math.max(0, parseInt(data.setsDone) || 0);
            this._numPomodoriFinished = done;
            this._setCurrentFocusTask(data.focusTask || "");

            // Position the queue at the current (in-progress) pomodoro and load
            // its remaining time, leaving everything PAUSED — the user resumes
            // manually so we never silently re-apply the hosts block / DND.
            let pos = done * 2;
            let positioned = this._timerQueue.setPosition(pos);
            let timer = this._timerQueue.getCurrentTimer();
            let remaining = parseInt(data.ticksRemaining);
            if (positioned && timer === this._timers.pomodoro && !isNaN(remaining) && remaining > 0) {
                this._timerQueue.preventStart(false);
                timer.setRemaining(remaining);
                this._pausedState = "pomodoro";
                this._setCurrentState("pomodoro-paused");
                this._appletMenu.toggleTimerState(false);
                this._appletMenu.updateCounts(this._numPomodoroSetFinished, this._numPomodoriFinished);
                this._setTimerLabel(remaining);
                this._setAppletTooltip(remaining);
                Main.notify(_("Focus session restored — resume when ready"));
            } else {
                // Could not cleanly restore the timer; keep only the counts/task.
                this._appletMenu.updateCounts(this._numPomodoroSetFinished, this._numPomodoriFinished);
            }
        } catch (e) {
            global.logError(`Pomodoro session restore failed: ${e.message}`);
        }
    }
    _updatePanelFocusCue() {
        let actorStyle = "";
        let labelStyle = "";
        let dark = this._panelIsDark();

        if (this._currentState === 'pomodoro' || this._currentState === 'pomodoro-paused' || this._currentState === 'pomodoro-overrun') {
            actorStyle = dark ? POMODORO_PANEL_FOCUS_CUE_STYLE : POMODORO_PANEL_FOCUS_CUE_STYLE_LIGHT;
            labelStyle = dark ? POMODORO_PANEL_FOCUS_LABEL_STYLE : POMODORO_PANEL_FOCUS_LABEL_STYLE_LIGHT;
        } else if (this._currentState === 'short-break' || this._currentState === 'long-break' ||
            this._currentState === 'short-break-paused' || this._currentState === 'long-break-paused' ||
            this._currentState === 'break-over' || this._currentState === 'focus-over') {
            actorStyle = dark ? POMODORO_PANEL_BREAK_CUE_STYLE : POMODORO_PANEL_BREAK_CUE_STYLE_LIGHT;
            labelStyle = dark ? POMODORO_PANEL_BREAK_LABEL_STYLE : POMODORO_PANEL_BREAK_LABEL_STYLE_LIGHT;
        }

        if (this.actor && typeof this.actor.set_style === 'function') {
            this.actor.set_style(actorStyle);
        }

        if (this._applet_label && typeof this._applet_label.set_style === 'function') {
            this._applet_label.set_style(labelStyle);
        }
    }

    _getPanelStateLabel() {
        switch (this._currentState) {
        case 'pomodoro-overrun':
        case 'pomodoro':
            return _('FOCUS');
        case 'pomodoro-paused':
            return _('PAUSED FOCUS');
        case 'short-break':
        case 'long-break':
            return _('BREAK');
        case 'short-break-paused':
        case 'long-break-paused':
            return _('PAUSED BREAK');
        case 'break-over':
            return _('BREAK OVER');
        case 'focus-over':
            return _('FOCUS OVER');
        case 'pomodoro-stop':
        default:
            return _('Ready to focus');
        }
    }
    
    _setAppletTooltip(ticks) {
        let timeLeft = this._getFormattedTimeLeft(ticks);
        let timeLeftExtension = "";
        if (timeLeft !== undefined) {
            timeLeftExtension = ` (${timeLeft})`;
        }
        let focusTaskExtension = "";
        if (this._currentState === 'pomodoro' && this._currentFocusTask) {
            focusTaskExtension = `: ${this._currentFocusTask}`;
        }
    
        let message;
        switch (this._currentState) {
        case 'short-break':
            message = _("Short break running") + timeLeftExtension;
            break;
        case 'short-break-paused':
            message = _("Short break paused") + timeLeftExtension;
            break;
        case 'long-break':
            message = _("Long break running") + timeLeftExtension;
            break;
        case 'long-break-paused':
            message = _("Long break paused") + timeLeftExtension;
            break;
        case 'break-over':
            message = _("Break ended");
            break;
        case 'focus-over':
            message = _("Focus finished — Break ready");
            break;
        case 'pomodoro': {
            message = _("Pomodori %d, set %d running").format(
                this._numPomodoriFinished + 1, this._numPomodoroSetFinished + 1
            ) + focusTaskExtension + timeLeftExtension;
            let est = this._estimateFinish();
            if (est) {
                message += "\n" + _("\u2248 finish %s \u00b7 %d \ud83c\udf45 left").format(est.time, est.remaining);
            }
            break;
        }
        case 'pomodoro-paused':
            message = _("Pomodoro paused") + focusTaskExtension + timeLeftExtension;
            break;
        case 'pomodoro-stop':
            // Tailor the start hint to the controls that are actually enabled,
            // so it never promises a gesture the user hasn't turned on.
            if (this._opt_panelScrollControl && this._opt_scrollAction !== 'focus_length') {
                message = _("Ready to focus — scroll or middle-click to start");
            } else if (this._opt_panelScrollControl) {
                message = _("Ready to focus — middle-click to start");
            } else if (this._opt_startOnClick) {
                message = _("Ready to focus — click to start");
            } else {
                message = _("Ready to focus");
            }
            break;
        default:
            message = "";
            break;
        }
    
        let tooltipMsg = message;
        if (this._opt_panelScrollControl && this._currentState !== 'pomodoro-stop' && this._currentState !== 'break-over' && this._currentState !== 'focus-over') {
            // Surface the active-session gestures on hover (kept out of the a11y
            // name below, which stays concise for screen readers).
            tooltipMsg += "\n" + ((this._opt_scrollAction === 'focus_length')
                ? _("Middle-click to skip")
                : _("Scroll to pause · middle-click to skip"));
        }
        this.set_applet_tooltip(tooltipMsg);
        // Expose the timer state to assistive technologies (the panel may be
        // icon-only, so the visible label isn't always available to readers).
        // Throttle to state / whole-minute changes so a screen reader isn't
        // re-announced every second — the tooltip above keeps live seconds.
        try {
            if (this.actor && typeof this.actor.get_accessible === 'function') {
                let acc = this.actor.get_accessible();
                if (acc && typeof acc.set_name === 'function') {
                    let accKey = this._currentState + "|" + Math.max(0, Math.ceil((ticks || 0) / 60));
                    if (accKey !== this._lastA11yKey) {
                        this._lastA11yKey = accKey;
                        let accMsg = (message && message.trim()) ? message : _("Ready to focus");
                        acc.set_name("Zen Pomodoro: " + accMsg.replace(/\n/g, " \u00b7 "));
                    }
                }
            }
        } catch (e) {}
    }

    _normalizeFocusTask(task) {
        if (typeof task !== "string") {
            return "";
        }

        return task.replace(/\s+/g, " ").trim();
    }

    _setCurrentFocusTask(task) {
        let norm = this._normalizeFocusTask(task);
        this._currentFocusTask = norm;
        // Unify with the task list: the focus task IS the list's current task,
        // so each pomodoro's progress tracks exactly what's shown. Find it by
        // title or add it, then make it the current task.
        if (!this._tasksData) { return; }
        if (!norm) {
            this._tasksData.currentId = "";
        } else {
            let existing = this._tasksData.tasks.find((t) => t.title === norm);
            if (existing) {
                this._tasksData.currentId = existing.id;
            } else {
                let t = {
                    id: this._newTaskId(), title: norm.slice(0, 120),
                    est: 0, done: 0, doneToday: 0, completed: false,
                    preset: this._currentPresetSnapshot()
                };
                this._tasksData.tasks.push(t);
                this._tasksData.currentId = t.id;
            }
        }
        this._saveTasks();
        this._refreshTasksMenu();
    }

    _clearCurrentFocusTask() {
        this._currentFocusTask = "";
    }

    _getPanelFocusTask() {
        if ((this._currentState !== 'pomodoro' && this._currentState !== 'pomodoro-paused') || !this._currentFocusTask) {
            return "";
        }

        const maxLength = 24;
        if (this._currentFocusTask.length <= maxLength) {
            return this._currentFocusTask;
        }

        return `${this._currentFocusTask.slice(0, maxLength - 3)}...`;
    }
    
    _clearAppletTooltip() {
        this.set_applet_tooltip("");
    }
    
    _getFormattedTimeLeft(ticks) {
        if (typeof ticks !== "number" || isNaN(ticks) || ticks < 0) {
            return;
        }
    
        let minutes = parseInt(ticks / 60);
        let seconds = parseInt(ticks % 60);
    
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    _getCurrentTimerLimitSeconds() {
        switch (this._currentState) {
        case 'pomodoro':
        case 'pomodoro-paused':
            return convertMinutesToSeconds(this._opt_pomodoroTimeMinutes);
        case 'short-break':
        case 'short-break-paused':
            return convertMinutesToSeconds(this._opt_shortBreakTimeMinutes);
        case 'long-break':
        case 'long-break-paused':
            return convertMinutesToSeconds(this._opt_longBreakTimeMinutes);
        default:
            return null;
        }
    }

    _getTimerProgressPercent(ticks) {
        let timerLimit = this._getCurrentTimerLimitSeconds();
        if (timerLimit === null || typeof ticks !== "number" || isNaN(ticks)) {
            return null;
        }

        let elapsed = Math.max(0, Math.min(timerLimit, timerLimit - ticks));
        return Math.round((elapsed / timerLimit) * 100);
    }

    _getTimerRemainingRatio(ticks) {
        let timerLimit = this._getCurrentTimerLimitSeconds();
        if (timerLimit === null || typeof ticks !== "number" || isNaN(ticks) || timerLimit <= 0) {
            return null;
        }

        return Math.max(0, Math.min(1, ticks / timerLimit));
    }

    _onDurationSettingsChanged() {
        if (this._timers) {
            this._syncTimerLimitsFromOptions();
        }
        this._updatePresetIndicator();
    }

    _syncTimerLimitsFromOptions() {
        this._timers.pomodoro.setTimerLimit(convertMinutesToSeconds(this._opt_pomodoroTimeMinutes));
        this._timers.shortBreak.setTimerLimit(convertMinutesToSeconds(this._opt_shortBreakTimeMinutes));
        this._timers.longBreak.setTimerLimit(convertMinutesToSeconds(this._opt_longBreakTimeMinutes));
    }

    _presetMatches(workMinutes, breakMinutes, longBreakMinutes = breakMinutes, pomodoriNumber = 4) {
        return this._opt_pomodoroTimeMinutes === workMinutes &&
            this._opt_shortBreakTimeMinutes === breakMinutes &&
            this._opt_longBreakTimeMinutes === longBreakMinutes &&
            this._opt_pomodoriNumber === pomodoriNumber;
    }

    _presetList() {
        let out = [];
        let arr = this._opt_customPresets;
        if (Array.isArray(arr)) {
            for (let p of arr) {
                if (!p) {
                    continue;
                }
                let pom = parseInt(p.pomodoro) || 0;
                let sb = parseInt(p.short_break) || 0;
                let lb = parseInt(p.long_break) || 0;
                let num = parseInt(p.pomodori) || 0;
                if (pom > 0 && sb > 0 && lb > 0 && num > 0) {
                    let name = (p.name || "").toString().trim();
                    // Normalize like _addPreset, so a hand-edited custom_presets
                    // entry can't carry out-of-range durations.
                    out.push(this._normPreset(name || `${pom}/${sb}/${lb} x${num}`, pom, sb, lb, num));
                }
            }
        }
        if (out.length === 0) {
            out.push({ name: _("Classic"), pomodoro: 25, short_break: 5, long_break: 15, pomodori: 4 });
            out.push({ name: _("Long focus"), pomodoro: 50, short_break: 10, long_break: 20, pomodori: 4 });
        }
        return out;
    }

    _getActivePresetLabel() {
        let list = this._presetList();
        for (let p of list) {
            if (this._presetMatches(p.pomodoro, p.short_break, p.long_break, p.pomodori)) {
                return p.name;
            }
        }

        return `${this._opt_pomodoroTimeMinutes}/${this._opt_shortBreakTimeMinutes}/${this._opt_longBreakTimeMinutes} x${this._opt_pomodoriNumber}`;
    }

    _updatePresetIndicator() {
        if (!this._appletMenu || typeof this._appletMenu.setPresets !== 'function') {
            return;
        }

        this._appletMenu.setPresets(this._presetList(), this._getActivePresetLabel());
        this._updateMenuRuntime();
    }
    
    _resetPomodoroTimerQueue() {
        this._timerQueue.clear();
    
        for (let i = 1; i <= this._opt_pomodoriNumber; i++) {
            this._timerQueue.addTimer(this._timers.pomodoro);
            if (i === this._opt_pomodoriNumber) {
                this._timerQueue.addTimer(this._timers.longBreak);
            } else {
                this._timerQueue.addTimer(this._timers.shortBreak);
            }
        }
    }
    
    _setCurrentState(newState) {
        this._currentState = newState;
        if (newState !== 'break-over') {
            this._breakOverFrom = "";
        }
        this._updatePanelFocusCue();
        this._onAppletIconChanged();
        this._updateFocusFrame();
        if (this._timerQueue) {
            let timer = this._timerQueue.getCurrentTimer();
            if (timer) {
                this._setTimerLabel(timer.getTicksRemaining());
            }
        }
        if (newState === 'pomodoro-stop' || newState === 'focus-over') {
            this._clearSessionState();
        } else {
            this._persistSessionState(true);
        }
        this._updateIdleWatch();
        this._updateAmbientSound();
        this._updateDnd();
        this._updateMediaPause();
        this._updateBreathingGuide();
        this._updateZenOverlay();
        this._maybeLockForBreak();
    }

    _setBreakOverState(fromState) {
        this._currentState = 'break-over';
        this._breakOverFrom = fromState || "";
        this._appletMenu.toggleTimerState(false);
        this._updatePanelFocusCue();
        this._onAppletIconChanged();
        this._setTimerLabel(0);
        this._setAppletTooltip(0);
        this._updateFocusFrame(0);
        this._sendPushover(this._opt_pushoverMsgResume);
    }

    _setFocusOverState() {
        this._currentState = 'focus-over';
        this._appletMenu.toggleTimerState(false);
        this._updatePanelFocusCue();
        this._onAppletIconChanged();
        this._setTimerLabel(0);
        this._setAppletTooltip(0);
        this._updateFocusFrame(0);
    }

    _isPausedState(state = this._currentState) {
        return state === 'pomodoro-paused' || state === 'short-break-paused' || state === 'long-break-paused';
    }

    _getPausedState(activeState) {
        switch (activeState) {
        case 'pomodoro':
            return 'pomodoro-paused';
        case 'short-break':
            return 'short-break-paused';
        case 'long-break':
            return 'long-break-paused';
        default:
            return activeState;
        }
    }

    _getActiveStateFromPaused(pausedState) {
        switch (pausedState) {
        case 'pomodoro-paused':
            return 'pomodoro';
        case 'short-break-paused':
            return 'short-break';
        case 'long-break-paused':
            return 'long-break';
        default:
            return pausedState;
        }
    }

    _handleTimerStoppedForPause(timer, activeState) {
        if (!this._timerPauseInProgress) {
            return false;
        }

        this._pausedState = activeState;
        this._setCurrentState(this._getPausedState(activeState));
        this._setTimerLabel(timer.getTicksRemaining());
        this._setAppletTooltip(timer.getTicksRemaining());
        this._updateFocusFrame(timer.getTicksRemaining());
        return true;
    }

    // Resolve the accent colour [r,g,b] for the current theme preset (or custom).

    // Parse "rgb(r,g,b)" / "rgba(...)" / "#rrggbb" into [r,g,b], with a safe fallback.

    // Preset focus tasks from settings (list of {task}) -> array of strings.
    // Push accent colours / font scale to the menu and refresh frame + menu.

    _isSessionActive() {
        let s = this._currentState;
        return (s === 'pomodoro' || s === 'pomodoro-paused' || s === 'pomodoro-overrun' ||
            s === 'short-break' || s === 'long-break' ||
            s === 'short-break-paused' || s === 'long-break-paused' ||
            s === 'break-over');
    }

    // Settings button: briefly show the focus frame + a sample chip using the
    // current appearance, so the user can tune visuals without a timer.

    // Settings button: briefly show the breathing guide with the selected pattern.

    _playCompletionFlourish(text) {
        // Quick celebratory cue when a pomodoro / set completes.
        this._playGlowBreath();
        if (this._opt_focusStartRitual) { this._flashRitualLabel(text); }
    }

    // Flash the centred "✓ <text>" chip (fade in, hold, fade out). Used by the
    // pomodoro flourish and the task-done celebration; works regardless of the
    // start-ritual setting (callers decide when to show it).
    _flashRitualLabel(text) {
        if (!this._focusRitualLabel) {
            return;
        }
        this._cancelFocusRitual();
        this._focusRitualLabel.set_text("\u2713  " + text);

        let primary = Main.layoutManager ? (Main.layoutManager.focusMonitor || Main.layoutManager.primaryMonitor) : null;
        if (primary) {
            let [, natW] = this._focusRitualLabel.get_preferred_width(-1);
            let [, natH] = this._focusRitualLabel.get_preferred_height(natW);
            let x = primary.x + Math.round((primary.width - natW) / 2);
            let y = primary.y + Math.round((primary.height - natH) / 2.4);
            this._focusRitualLabel.set_position(x, y);
        }
        if (typeof this._focusRitualLabel.raise_top === 'function') {
            this._focusRitualLabel.raise_top();
        }
        this._focusRitualLabel.show();

        this._animateActorOpacity(this._focusRitualLabel, 0, 255, 250, () => {
            let holdId = Mainloop.timeout_add(700, () => {
                let idx = this._focusRitualTimeouts.indexOf(holdId);
                if (idx >= 0) {
                    this._focusRitualTimeouts.splice(idx, 1);
                }
                this._animateActorOpacity(this._focusRitualLabel, 255, 0, 400, () => {
                    if (this._focusRitualLabel) {
                        this._focusRitualLabel.hide();
                    }
                });
                return false;
            });
            this._focusRitualTimeouts.push(holdId);
        });
    }

    // Celebrate a completed task per the user's setting (Off/Subtle/Confetti).
    // "Meaningful-only" is decided by the caller; reduce-motion downgrades
    // Confetti to the Subtle glow.
    _celebrateTaskDone(task) {
        let mode = this._opt_taskCelebration || 'confetti';
        if (mode === 'off') {
            return;
        }
        let text = (task && task.title) ? task.title : _("Task complete");
        if (mode === 'confetti' && !this._opt_reduceMotion) {
            this._playConfetti();
            this._flashRitualLabel(text);
        } else {
            this._playGlowBreath();
            this._flashRitualLabel(text);
        }
    }

    // Short, soft confetti burst on the primary monitor — a non-reactive overlay
    // (never blocks input), animated for ~1.2s, then torn down. No sound.
    _playConfetti() {
        let primary = Main.layoutManager ? (Main.layoutManager.focusMonitor || Main.layoutManager.primaryMonitor) : null;
        if (!primary) {
            return;
        }
        this._stopConfetti();

        let area = new St.DrawingArea({ reactive: false });
        area.set_position(primary.x, primary.y);
        area.set_size(primary.width, primary.height);
        area.connect('repaint', (a) => this._repaintConfetti(a));
        Main.uiGroup.add_actor(area);
        if (typeof area.raise_top === 'function') { area.raise_top(); }
        this._confettiArea = area;

        let palette = [
            [0.89, 0.35, 0.30], [0.92, 0.69, 0.29], [0.47, 0.80, 0.55],
            [0.95, 0.78, 0.30], [0.40, 0.62, 0.92], [0.82, 0.52, 0.86]
        ];
        let cx = primary.width / 2, cy = primary.height * 0.42;
        let parts = [];
        for (let i = 0; i < 28; i++) {
            let ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
            let spd = 7 + Math.random() * 9;
            parts.push({
                x: cx + (Math.random() - 0.5) * 70, y: cy,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - (3 + Math.random() * 4),
                size: 4 + Math.random() * 5, rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 0.5, color: palette[i % palette.length]
            });
        }
        this._confettiParts = parts;

        let start = Date.now();
        let DUR = 1200;
        this._confettiTimeout = Mainloop.timeout_add(16, () => {
            let elapsed = Date.now() - start;
            for (let p of parts) {
                p.vy += 0.9;      // gravity
                p.vx *= 0.99;
                p.x += p.vx; p.y += p.vy; p.rot += p.vr;
            }
            let fade = (elapsed > DUR * 0.6) ? (1 - (elapsed - DUR * 0.6) / (DUR * 0.4)) : 1;
            if (this._confettiArea) {
                this._confettiArea.opacity = Math.round(255 * Math.max(0, Math.min(1, fade)));
                this._confettiArea.queue_repaint();
            }
            if (elapsed >= DUR) { this._confettiTimeout = 0; this._stopConfetti(); return false; }
            return true;
        });
    }

    _repaintConfetti(area) {
        let cr = area.get_context();
        try {
            let parts = this._confettiParts || [];
            for (let p of parts) {
                cr.save();
                cr.translate(p.x, p.y);
                cr.rotate(p.rot);
                cr.setSourceRGBA(p.color[0], p.color[1], p.color[2], 0.92);
                cr.rectangle(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
                cr.fill();
                cr.restore();
            }
        } finally {
            cr.$dispose();
        }
    }

    _stopConfetti() {
        if (this._confettiTimeout) {
            Mainloop.source_remove(this._confettiTimeout);
            this._confettiTimeout = 0;
        }
        if (this._confettiArea) {
            this._confettiArea.destroy();
            this._confettiArea = null;
        }
        this._confettiParts = null;
    }

    // Settings button: play the celebration once so the user can see it.
    _previewCelebration() {
        if (this._opt_taskCelebration === 'subtle' || this._opt_reduceMotion) {
            this._playGlowBreath();
        } else {
            this._playConfetti();
        }
        this._flashRitualLabel(_("Preview"));
    }

    
    _connectTimerSignals() {
        let timerQueue = this._timerQueue;
        let pomodoroTimer = this._timers.pomodoro;
        let shortBreakTimer = this._timers.shortBreak;
        let longBreakTimer = this._timers.longBreak;
    
        // Connect the timer queue signals

        timerQueue.connect('timer-queue-started', () => {
            this._appletMenu.showPomodoroInProgress(this._opt_pomodoriNumber);
            Main.notify(_("Pomodoro started"));
        });
    
        timerQueue.connect('timer-queue-finished', () => {
            this._numPomodoriFinished = 0;
            this._numPomodoroSetFinished++;
            this._appletMenu.updateCounts(this._numPomodoroSetFinished, this._numPomodoriFinished);
    
            if (this._opt_autoStartPomodoro) {
                if (this._longBreakdialog.state === ModalDialog.State.OPENED) {
                    this._longBreakdialog.close();
                }
                this._startNewTimerQueue();
            } else if (this._opt_showDialogMessages) {
                this._resetTimerQueueState();
                this._setBreakOverState('long-break');
                this._longBreakdialog.open();
            } else {
                this._resetTimerQueueState();
                this._setBreakOverState('long-break');
                this._playStartSound();
                this._playCompletionFlourish(_("Break ended"));
                Main.notify(_("Break ended"));
            }
        });
    
        timerQueue.connect('timer-queue-reset', () => {
            this._setTimerLabel(0);
        });
    
        timerQueue.connect('timer-queue-before-next-timer', () => {
            let timer = timerQueue.getCurrentTimer();
            if (!this._opt_autoStartBreak && timer === shortBreakTimer) {
                timerQueue.preventStart(true);
                timerQueue.stop();
                this._appletMenu.toggleTimerState(false);
                this._setAppletTooltip(0);
                if (this._maybeSoftLanding()) {
                    return; // soft landing deferred the break; it will prompt later
                }
                this._openPomodoroFinishedPrompt();
            }
            else if (!this._opt_autoStartPomodoro && timer === pomodoroTimer) {
                timerQueue.preventStart(true);
                timerQueue.stop();
                this._setBreakOverState('short-break');
                if (this._opt_showDialogMessages) {
                    this._playStartSound();
                    this._shortBreakdialog.open();
                } else {
                    // Same silent-boundary gap as the focus->break case: without
                    // this, the panel just shows a static 0:00 with no hint that
                    // focus is waiting on a manual start.
                    this._playStartSound();
                    this._playCompletionFlourish(_("Break finished"));
                    Main.notify(_("Break finished"), _("Focus ready — open the menu to start it."));
                }
            }
        });

        // Connect the pomodoro timer signals

        pomodoroTimer.connect('timer-tick', (timer) => {
            this._timerTickUpdate(timer);
            let rem = timer.getTicksRemaining();
            // Warn once when the remaining time first crosses the threshold, so a
            // skipped/drifted tick can't make it miss the exact second.
            if (this._warnArmed && this._opt_warnSoundDelay > 0 && rem > 0 && rem <= this._opt_warnSoundDelay) {
                this._warnArmed = false;
                this._playWarnSound();
            }
            // Chime on elapsed interval boundaries — never at the very start, even
            // when the focus length is an exact multiple of the chime interval.
            if (this._opt_intervalChime && this._opt_intervalChimeSeconds > 0 && rem > 0) {
                let elapsed = (timer.getTimerLimit() || 0) - rem;
                if (elapsed > 0 && (elapsed % this._opt_intervalChimeSeconds) === 0) {
                    this._playIntervalChime();
                }
            }
        });
    
        pomodoroTimer.connect('timer-running', () => {
            this._setCurrentState('pomodoro');
            this._playTickerSound();
            if (this._opt_enableBlocking) this._startFocusBlockIfNeeded();
        });
    
        pomodoroTimer.connect('timer-started', () => {
            this._glowBreathedForTimer = false;
            this._skippedPomodoro = false;   // fresh focus block — clear any stale skip flag
            this._warnArmed = true;          // arm the pre-end warning for this block
            this._pushReminderArmed = true;  // arm the pre-end Pushover reminder for this block
            // Show the start toast before _setCurrentState enables Focus DND,
            // otherwise our own notification gets suppressed by the DND we just set.
            Main.notify(_("Let's go to work!"));
            this._setCurrentState('pomodoro');
            this._playStartSound();
            this._playFocusStartRitual();
            this._runEventCommand('focus');
            this._sendPushover(this._opt_pushoverMsgFocus);
        });
    
        pomodoroTimer.connect('timer-stopped', () => {
            if (this._handleTimerStoppedForPause(pomodoroTimer, 'pomodoro')) {
                this._stopTickerSound();
                return;
            }

            this._setCurrentState('pomodoro-stop');
            this._stopTickerSound();
            this._stopFocusBlockIfNeeded();
            // Keep the focus task across a natural finish (the set continues to the
            // break and next pomodoro); only a real stop (time still left) clears it.
            // Reset / turn-off clear it explicitly elsewhere.
            if (pomodoroTimer.getTicksRemaining() > 0) { this._clearCurrentFocusTask(); }
        });

        // connect the short break timer signals

        shortBreakTimer.connect('timer-tick', this._timerTickUpdate.bind(this));
        
        shortBreakTimer.connect('timer-started', () => {
            this._setCurrentState('short-break');
            this._pushReminderArmed = true;   // arm the pre-end reminder for this break
            this._playBreakSound();
            this._numPomodoriFinished++;
            this._appletMenu.updateCounts(this._numPomodoroSetFinished, this._numPomodoriFinished);
            this._appletMenu.showPomodoroInProgress(this._opt_pomodoriNumber);
            this._playCompletionFlourish(_("Pomodoro done"));
            if (this._skippedPomodoro) { this._skippedPomodoro = false; } else { this._recordPomodoroCompleted(); }
            this._notifyWithActions(_("Take a short break"), this._restTip(false), [
                { id: 'extend', label: _("+%d min").format(5), fn: () => this._extendBreak(5) },
                { id: 'skip', label: _("Skip break"), fn: () => this._appletMenu.emit('skip-timer') }
            ]);
            this._runEventCommand('break');
            this._sendPushover(this._opt_pushoverMsgShortBreak);
        });
    
        shortBreakTimer.connect('timer-stopped', () => {
            if (this._handleTimerStoppedForPause(shortBreakTimer, 'short-break')) {
                return;
            }

            this._setCurrentState('pomodoro-stop');
        });
    
        shortBreakTimer.connect('timer-running', () => {
            this._setCurrentState('short-break');
        });

        longBreakTimer.connect('timer-tick', this._timerTickUpdate.bind(this));
        longBreakTimer.connect('timer-tick', this._longBreakdialog.setTimeRemaining.bind(this._longBreakdialog));
    
        longBreakTimer.connect('timer-started', () => {
            this._setCurrentState('long-break');
            this._pushReminderArmed = true;   // arm the pre-end reminder for this break
            this._playBreakSound();
            this._playCompletionFlourish(_("Set complete!"));
            if (this._skippedPomodoro) { this._skippedPomodoro = false; } else { this._recordPomodoroCompleted(); }
            if (this._opt_showDialogMessages) {
                this._longBreakdialog.open();
            } else {
                this._notifyWithActions(_("Take a long break"), this._restTip(true), [
                    { id: 'extend', label: _("+%d min").format(5), fn: () => this._extendBreak(5) },
                    { id: 'skip', label: _("Skip break"), fn: () => this._appletMenu.emit('skip-timer') }
                ]);
            }
            this._runEventCommand('break');
            this._sendPushover(this._opt_pushoverMsgLongBreak);
        });
    
        longBreakTimer.connect('timer-stopped', () => {
            if (this._handleTimerStoppedForPause(longBreakTimer, 'long-break')) {
                return;
            }

            this._setCurrentState('pomodoro-stop');
        });
    
        longBreakTimer.connect('timer-running', () => {
            this._setCurrentState('long-break');
        });
    }
    
    _startNewTimerQueue() {
        this._numPomodoriFinished = 0;
        this._resetTimerQueueState();
        this._timerQueue.start();
    }
    
    _resetTimerQueueState() {
        if (!this.__pomodoriNumberChangedWhileRunning) {
            this._timerQueue.reset();
        } else {
            this._resetPomodoroTimerQueue();
            delete this.__pomodoriNumberChangedWhileRunning;
        }
        this._longBreakdialog.setDefaultLabels();
    }
    
    _turnOff() {
        this._cancelSoftLanding();
        this._stopFocusBlockIfNeeded();
        this._clearCurrentFocusTask();
        this._resetTimerQueueState();
        this._appletMenu.toggleTimerState(false);
        this._setCurrentState('pomodoro-stop');
        this._setTimerLabel(0);
        this._clearAppletTooltip();
        Main.notify(_("Pomodoro ended"));
    }
    
    _timerTickUpdate(timer) {
        this._setTimerLabel(timer.getTicksRemaining());   // also refreshes the menu runtime state
        this._setAppletTooltip(timer.getTicksRemaining());
        this._updateFocusFrame(timer.getTicksRemaining());
        this._maybePushReminder(timer);
        this._persistSessionState();
        this._refreshZenLabels();
    }

    // Fire the pre-end Pushover reminder once per phase, for the phase(s) the
    // user chose (focus / breaks / both). Armed at each phase start; runs for
    // every timer because all ticks route through _timerTickUpdate.
    _maybePushReminder(timer) {
        if (!this._pushReminderArmed || !this._opt_pushoverReminder || !(this._opt_pushoverReminderMinutes > 0)) {
            return;
        }
        let threshold = this._opt_pushoverReminderMinutes * 60;
        let rem = timer.getTicksRemaining();
        if (!(rem > 0) || rem > threshold) {
            return;
        }
        // Skip when the phase is no longer than the reminder window — it would
        // fire at the very start, which isn't a useful "ending soon" cue.
        if (timer.getTimerLimit() <= threshold) {
            return;
        }
        let isBreak = (timer === this._timers.shortBreak || timer === this._timers.longBreak);
        let mode = this._opt_pushoverReminderPhase || "breaks";
        let phaseOk = (mode === "both") || (isBreak ? (mode === "breaks") : (mode === "focus"));
        if (!phaseOk) {
            return;
        }
        this._pushReminderArmed = false;
        this._sendPushover(this._opt_pushoverMsgReminder);
    }
    

    

    

    

    

    
    _loadSoundEffect(soundEffectInstance, soundPath) {
        soundPath = SoundModule.addPathIfRelative(soundPath, this._defaultSoundPath);
        if (!soundEffectInstance) {
            soundEffectInstance = new SoundModule.SoundEffect(soundPath);
        } else {
            soundEffectInstance.setSoundPath(soundPath);
        }
        return soundEffectInstance;
    }
    

    _startFocusBlockIfNeeded() {
        // Blocking is driven by the toggle now (blocked while it's on), not by
        // the focus state, so there's nothing to do on focus start.
        return false;
    }

    _stopFocusBlockIfNeeded() {
        // Toggle-driven blocking persists regardless of focus; nothing to do.
        return false;
    }

    _pauseTimerFromMenu() {
        this._cancelSoftLanding();
        let timer = this._timerQueue.getCurrentTimer();
        if (!timer || !timer.isRunning()) {
            return;
        }

        if (this._currentState === 'pomodoro') {
            this._recordInterruption();
        }

        this._timerPauseInProgress = true;
        this._pausedState = this._currentState;
        this._timerQueue.stop();
        this._timerPauseInProgress = false;
        this._appletMenu.toggleTimerState(false);
        this._setTimerLabel(timer.getTicksRemaining());
        this._setAppletTooltip(timer.getTicksRemaining());
        this._updateFocusFrame(timer.getTicksRemaining());
    }

    _resumePausedTimerFromMenu() {
        if (!this._isPausedState()) {
            return false;
        }

        this._timerQueue.preventStart(false);
        this._setCurrentState(this._getActiveStateFromPaused(this._currentState));
        this._appletMenu.toggleTimerState(true);
        this._timerQueue.start();
        return true;
    }
    
    _createMenu(orientation) {
        let menuManager = new PopupMenu.PopupMenuManager(this);
        let menu = new MenuModule.PomodoroMenu(this, orientation);
    
        menu.connect('start-timer', () => {
            this._startTimerFromMenu();
        });
    
        menu.connect('stop-timer', () => {
            if (this._strictFocusBlocks()) { this._strictFocusNotice(); return; }
            this._pauseTimerFromMenu();
        });
    
        menu.connect('reset-timer', () => {
            this._cancelSoftLanding();
            this._timerQueue.reset();
            this._stopFocusBlockIfNeeded();
            this._clearCurrentFocusTask();
            this._setCurrentState('pomodoro-stop');
            this._setTimerLabel(0);
            this._clearAppletTooltip();
        });
    
        menu.connect('reset-counts', () => {
            this._numPomodoriFinished = 0;
            this._numPomodoroSetFinished = 0;
            this._appletMenu.updateCounts(0, 0);
        });

        menu.connect('choose-task', () => {
            this._chooseFocusTaskFromMenu();
        });

        menu.connect('toggle-zen', (m, state) => {
            this._toggleZenMode(state);
        });

        menu.connect('apply-preset', (m, preset) => {
            if (this._applyDurationPreset(preset.pomodoro, preset.short_break, preset.long_break, preset.pomodori)) {
                this._saveCurrentTaskPreset(preset);
            }
        });
        menu.connect('preset-add', () => {
            this._showPresetDialog(null, -1);
        });
        menu.connect('preset-edit', (m, index) => {
            let list = this._presetList();
            if (list[index]) { this._showPresetDialog(list[index], index); }
        });
        menu.connect('preset-delete', (m, index) => {
            this._deletePreset(index);
        });
        menu.connect('reorder-presets', () => {
            this._openReorderPresets();
        });

        menu.connect('set-ambient', (m, state) => {
            let choice = state ? (this._ambientLastChoice || 'brown') : 'off';
            this._opt_focusAmbientChoice = choice;
            if (state) { this._ambientLastChoice = choice; }
            // Apply immediately so the loop starts/stops the moment you toggle,
            // instead of waiting on the settings-binding callback.
            this._updateAmbientSound();
            this._updateMenuRuntime();
            try { this._settingsProvider.setValue('focus_ambient_choice', choice); } catch (e) {}
        });

        menu.connect('open-stats', () => {
            this._showStatsDashboard();
        });
        menu.connect('open-blocking-settings', () => {
            // Open settings on the Advanced page (tab index 6 per the
            // settings-schema layout: timer, panel, appearance, focus, sounds,
            // notifications, advanced), where the site-blocking section lives.
            try { this.configureApplet(6); } catch (e) { global.logError('Zen Pomodoro: open settings failed: ' + e.message); }
        });
        menu.connect('open-onboarding', () => {
            this._showOnboardingWizard();
        });

        menu.connect('add-task', () => {
            this._showAddTaskDialog();
        });
        menu.connect('reorder-tasks', () => {
            this._openReorderTasks();
        });
        menu.connect('add-distraction', (m, text) => {
            this._addDistraction(text);
        });
        menu.connect('delete-distraction', (m, id) => {
            this._deleteDistraction(id);
        });
        menu.connect('clear-distractions', () => {
            this._clearDistractions();
        });
        menu.connect('select-task', (m, id) => {
            this._setCurrentTaskId(id);
        });
        menu.connect('task-complete', (m, id) => {
            this._toggleTaskCompleted(id);
        });
        menu.connect('task-delete', (m, id) => {
            this._deleteTask(id);
        });
        menu.connect('task-edit', (m, id) => {
            let t = this._tasksData && this._tasksData.tasks.find((x) => x.id === id);
            if (t) { this._showAddTaskDialog(t); }
        });

        menu.connect('skip-timer', () => {
            if (this._strictFocusBlocks()) { this._strictFocusNotice(); return; }
            this._cancelSoftLanding();
            let timer = this._timerQueue.getCurrentTimer();
            // Skipping a running focus block must not count it as a completed pomodoro.
            // Only arm the flag when skip() will actually act (it no-ops unless running),
            // otherwise a skip while paused poisons the flag and the NEXT completed
            // pomodoro gets swallowed at the record gate.
            if (timer === this._timers.pomodoro && timer.isRunning()) { this._skippedPomodoro = true; }
            this._timerQueue.skip();
            if (timer === this._timers.longBreak) {
                if (!this._opt_autoStartPomodoro) {
                    this._longBreakdialog.close();
                    this._startNewTimerQueue();
                }
            }
        });
    
        menuManager.addMenu(menu);
    
        return menu;
    }

    _startTimerFromMenu() {
        this._cancelSoftLanding();
        this._timerQueue.preventStart(false);
        if (this._resumePausedTimerFromMenu()) {
            return;
        }

        let timer = this._timerQueue.getCurrentTimer();

        if (timer === this._timers.pomodoro && !timer.isRunning()) {
            this._promptFocusTaskBeforeStart();
            return;
        }

        this._timerQueue.start();
    }

    // Effective focus accent (theme preset or the user's custom colour) as an
    // [r, g, b] array, for the focus-task dialog's selection highlight.
    _focusAccentRgb() {
        try { return this._accentRgb(false); } catch (e) { return [227, 90, 60]; }
    }

    _promptFocusTaskBeforeStart() {
        if (!this._focusTaskDialog) {
            this._startTimerAfterFocusTask("");
            return;
        }

        // If the user turned the task prompt off, start straight away with the
        // current task — unless a task is required and none is set yet.
        let prompt = (this._opt_promptFocusTask === null) ? true : Boolean(this._opt_promptFocusTask);
        if (!prompt && (this._currentFocusTask || !this._opt_requireFocusTask)) {
            this._startTimerAfterFocusTask(this._currentFocusTask || "");
            return;
        }

        this._focusTaskDialog.setTaskList(this._taskList(), this._currentFocusTask, Boolean(this._opt_requireFocusTask), false, false, this._focusAccentRgb());
        this._focusTaskDialog.open();
    }

    _chooseFocusTaskFromMenu() {
        if (!this._focusTaskDialog) {
            return;
        }

        this._taskSelectOnly = true;
        let cur = this._timerQueue ? this._timerQueue.getCurrentTimer() : null;
        let focusRunning = Boolean(cur && cur === this._timers.pomodoro && cur.isRunning());
        this._focusTaskDialog.setTaskList(this._taskList(), this._currentFocusTask, Boolean(this._opt_requireFocusTask), true, focusRunning, this._focusAccentRgb());
        this._focusTaskDialog.open();
    }

    _startTimerAfterFocusTask(task) {
        this._setCurrentFocusTask(task);
        this._applyTaskPreset(this._currentTask());
        this._timerQueue.preventStart(false);
        this._timerQueue.start();
    }

    _applyDurationPreset(workMinutes, breakMinutes, longBreakMinutes = breakMinutes, pomodoriNumber = 4, silent = false) {
        if (this._timerQueue.isRunning() || this._isPausedState()) {
            Main.notify(_("Stop the timer before changing Pomodoro preset"));
            return false;
        }

        this._opt_pomodoroTimeMinutes = workMinutes;
        this._opt_shortBreakTimeMinutes = breakMinutes;
        this._opt_longBreakTimeMinutes = longBreakMinutes;
        this._opt_pomodoriNumber = pomodoriNumber;
        this._settingsProvider.setValue("pomodoro_duration", workMinutes);
        this._settingsProvider.setValue("short_break_duration", breakMinutes);
        this._settingsProvider.setValue("long_break_duration", longBreakMinutes);
        this._settingsProvider.setValue("pomodori_number", pomodoriNumber);
        this._syncTimerLimitsFromOptions();
        this._resetTimerQueueState();
        this._setTimerLabel(0);
        this._clearAppletTooltip();
        this._updatePresetIndicator();
        if (!silent) {
            Main.notify(_("Pomodoro preset %s applied").format(this._getActivePresetLabel()));
        }
        return true;
    }

    _normPreset(name, p, s, l, n) {
        return {
            name: (name || "").toString().slice(0, 80) || _("Preset"),
            pomodoro: Math.max(1, Math.min(180, parseInt(p) || 25)),
            short_break: Math.max(1, Math.min(120, parseInt(s) || 5)),
            long_break: Math.max(1, Math.min(180, parseInt(l) || 15)),
            pomodori: Math.max(1, Math.min(16, parseInt(n) || 4))
        };
    }

    _addPreset(name, p, s, l, n) {
        let list = this._presetList();
        list.push(this._normPreset(name, p, s, l, n));
        this._settingsProvider.setValue("custom_presets", list);
        this._updatePresetIndicator();
    }

    _editPreset(index, name, p, s, l, n) {
        let list = this._presetList();
        if (index < 0 || index >= list.length) { return; }
        list[index] = this._normPreset(name, p, s, l, n);
        this._settingsProvider.setValue("custom_presets", list);
        this._updatePresetIndicator();
    }

    _deletePreset(index) {
        let list = this._presetList();
        if (index < 0 || index >= list.length) { return; }
        if (list.length <= 1) { Main.notify(_("Keep at least one preset")); return; }
        list.splice(index, 1);
        this._settingsProvider.setValue("custom_presets", list);
        this._updatePresetIndicator();
    }

    // Extend the current break by N minutes (from the break notification).
    _extendBreak(mins) {
        mins = parseInt(mins, 10) || 5;
        let timer = this._timerQueue ? this._timerQueue.getCurrentTimer() : null;
        let isBreak = (this._currentState === "short-break" || this._currentState === "long-break");
        if (!timer || !isBreak || !timer.isRunning()) {
            return;
        }
        timer.addTime(mins * 60);
        this._pushReminderArmed = true;   // re-arm so the reminder can fire before the extended break ends
        Main.notify(_("Break extended by %d min").format(mins));
    }
    
    _createLongBreakDialog() {
        this._longBreakdialog = new DialogsModule.PomodoroSetFinishedDialog();
        this._scaleDialogOnOpen(this._longBreakdialog);
    
        this._longBreakdialog.connect('switch-off-pomodoro', () => {
            if (!this._timerQueue.isRunning() && !this._opt_autoStartPomodoro) {
                this._turnOff();
            } else {
                this._timerQueue.stop();
                this._appletMenu.toggleTimerState(false);
                this._clearAppletTooltip();
            }
            this._longBreakdialog.close();
        });
    
        this._longBreakdialog.connect('start-new-pomodoro', () => {
            this._timerQueue.skip();
            if (!this._opt_autoStartPomodoro) {
                this._longBreakdialog.close();
                this._startNewTimerQueue();
            }
        });
    
        this._longBreakdialog.connect('hide-pomodoro-modal', () => {
            if (!this._timerQueue.isRunning() && !this._opt_autoStartPomodoro) {
                this._turnOff();
            }
            this._longBreakdialog.close();
        });
    }
    
    _createShortBreakDialog() {
        this._shortBreakdialog = new DialogsModule.PomodoroShortBreakFinishedDialog();
        this._scaleDialogOnOpen(this._shortBreakdialog);
    
        this._shortBreakdialog.connect('continue-current-pomodoro', () => {
            this._shortBreakdialog.close();
            this._timerQueue.preventStart(false);
            this._appletMenu.toggleTimerState(true);
            this._timerQueue.start();
        });
    
        this._shortBreakdialog.connect('pause-pomodoro', () => {
            this._timerQueue.stop();
            this._appletMenu.toggleTimerState(false);
            this._shortBreakdialog.close();
        });
    }

    _createPomodoroFinishedDialog() {
        this._pomodoroFinishedDialog = new DialogsModule.PomodoroFinishedDialog();
        this._scaleDialogOnOpen(this._pomodoroFinishedDialog);
    
        this._pomodoroFinishedDialog.connect('continue-current-pomodoro', () => {
            this._pomodoroFinishedDialog.close();
            this._timerQueue.preventStart(false);
            this._appletMenu.toggleTimerState(true);
            this._timerQueue.start();
        });
    
        this._pomodoroFinishedDialog.connect('pause-pomodoro', () => {
            this._timerQueue.stop();
            this._appletMenu.toggleTimerState(false);
            this._pomodoroFinishedDialog.close();
        });

        this._pomodoroFinishedDialog.connect('extend-pomodoro', () => {
            this._pomodoroFinishedDialog.close();
            this._extendFocusFromDialog();
        });
    }

    _createFocusTaskDialog() {
        this._focusTaskDialog = new DialogsModule.PomodoroFocusTaskDialog();
        this._scaleDialogOnOpen(this._focusTaskDialog);

        this._focusTaskDialog.connect('focus-task-confirmed', (_dialog, task) => {
            if (this._taskSelectOnly) {
                this._taskSelectOnly = false;
                this._setCurrentFocusTask(task);
                this._applyTaskPreset(this._currentTask());
                this._updateMenuRuntime();
                return;
            }
            this._startTimerAfterFocusTask(task);
        });

        this._focusTaskDialog.connect('focus-task-cancelled', () => {
            if (this._taskSelectOnly) {
                this._taskSelectOnly = false;
                return;
            }
            this._appletMenu.toggleTimerState(false);
        });
    }

    _removeDialogs() {
        if (this._focusTaskDialog) {
            this._focusTaskDialog.close();
            this._focusTaskDialog.destroy();
            this._focusTaskDialog = null;
        }
        if (this._longBreakdialog) {
            this._longBreakdialog.close();
            this._longBreakdialog.destroy();
            this._longBreakdialog = null;
        }
        if (this._shortBreakdialog) {
            this._shortBreakdialog.close();
            this._shortBreakdialog.destroy();
            this._shortBreakdialog = null;
        }
        if (this._pomodoroFinishedDialog) {
            this._pomodoroFinishedDialog.close();
            this._pomodoroFinishedDialog.destroy();
            this._pomodoroFinishedDialog = null;
        }
    }

    _onAppletIconChanged() {
        let style = this._opt_panelIconStyle || "ring";
        if (style === "symbolic") {
            this._applet_icon_box.show();
            // One symbolic glyph for every state; the status class recolours it.
            let appletIconStatus = 'system-status-icon';
            if (this._currentState === 'short-break' || this._currentState === 'long-break' ||
                this._currentState === 'short-break-paused' || this._currentState === 'long-break-paused') {
                appletIconStatus = 'system-status-icon success';
            } else if (this._currentState === 'pomodoro' || this._currentState === 'pomodoro-paused') {
                appletIconStatus = 'system-status-icon error';
            }
            this.set_applet_icon_symbolic_path(`${this._metadata.path}/../pomodoro-symbolic.svg`);
            this._applet_icon.set_style_class_name(appletIconStatus);
        } else if (style === "own") {
            this._applet_icon_box.show();
            let ic = (this._opt_panelCustomIcon || "").trim();
            if (!ic) {
                // No icon picked yet — fall back to the symbolic tomato.
                this.set_applet_icon_symbolic_path(`${this._metadata.path}/../pomodoro-symbolic.svg`);
                this._applet_icon.set_style_class_name('system-status-icon');
            } else if (ic.charAt(0) === '/') {
                this.set_applet_icon_path(ic);
            } else {
                this.set_applet_icon_name(ic);
            }
        } else if (this._applet_icon_box.child) {
            this._applet_icon_box.hide();
        }

        this._updatePanelProgressIcon();
    }

    _updatePanelProgressIcon() {
        if ((this._opt_panelIconStyle || "ring") === "ring") {
            if (!this._panelProgressArea) {
                let size = Math.max(16, Math.min(28, this._panelHeight || 22));
                this._panelProgressArea = new St.DrawingArea({ reactive: false });
                this._panelProgressArea.set_width(size);
                this._panelProgressArea.set_height(size);
                this._panelProgressArea.connect('repaint', (area) => {
                    this._repaintPanelProgress(area);
                });
                this.actor.insert_child_at_index(this._panelProgressArea, 0);
                if (!this._panelHoverConnected) {
                    this.actor.connect('enter-event', () => {
                        this._panelHover = true;
                        if (this._panelProgressArea && this._panelProgressArea.visible) { this._panelProgressArea.queue_repaint(); }
                    });
                    this.actor.connect('leave-event', () => {
                        this._panelHover = false;
                        if (this._panelProgressArea && this._panelProgressArea.visible) { this._panelProgressArea.queue_repaint(); }
                    });
                    this._panelHoverConnected = true;
                }
            }
            this._applet_icon_box.hide();
            this._panelProgressArea.show();
            this._panelProgressArea.queue_repaint();
        } else if (this._panelProgressArea) {
            this._panelProgressArea.hide();
        }
    }

    _paintPauseBars(cr, cx, cy, r, rgb) {
        let bw = Math.max(1.5, r * 0.42);
        let bh = r * 1.6;
        let gap = r * 0.5;
        cr.setSourceRGBA(rgb[0], rgb[1], rgb[2], 0.98);
        cr.rectangle(Math.round(cx - gap / 2 - bw), Math.round(cy - bh / 2), Math.round(bw), Math.round(bh));
        cr.fill();
        cr.rectangle(Math.round(cx + gap / 2), Math.round(cy - bh / 2), Math.round(bw), Math.round(bh));
        cr.fill();
    }

    // The idle "ready" tomato. Filled silhouettes read far better than an
    // outline at panel size. Three variants are switchable at runtime via
    // this._tomatoVariant (1 natural / 2 flat-icon / 3 soft-depth); 2 is the
    // default as it stays clearest and calmest at ~22px.
    _paintPanelTomato(cr, cx, cy, R, darkP) {
        let v = this._tomatoVariant || 2;
        if (v === 2) { this._paintTomatoFlat(cr, cx, cy, R, darkP); }
        else if (v === 3) { this._paintTomatoSoft(cr, cx, cy, R, darkP); }
        else { this._paintTomatoNatural(cr, cx, cy, R, darkP); }
    }

    _tomatoColors(darkP) {
        // Gently brighten on hover so the icon visibly responds to the pointer.
        let m = this._panelHover ? 1.15 : 1.0;
        let c = (v) => Math.min(1, v * m);
        return {
            br: c(darkP ? 0.86 : 0.75), bg: c(darkP ? 0.26 : 0.20), bb: c(darkP ? 0.20 : 0.16),
            lr: c(darkP ? 0.46 : 0.33), lg: c(darkP ? 0.78 : 0.57), lb: c(darkP ? 0.42 : 0.29)
        };
    }

    _tomatoCalyx(cr, cx, topY, R, c, leaves, llen, lwid, spread) {
        cr.setSourceRGBA(c.lr, c.lg, c.lb, 0.98);
        cr.save();
        cr.translate(cx, topY);
        for (let i = 0; i < leaves; i++) {
            let ang = (i - (leaves - 1) / 2) * spread;
            cr.save();
            cr.rotate(ang);
            cr.moveTo(0, lwid * 0.12);
            cr.lineTo(-lwid / 2, -llen * 0.5);
            cr.lineTo(0, -llen);
            cr.lineTo(lwid / 2, -llen * 0.5);
            cr.closePath();
            cr.fill();
            cr.restore();
        }
        cr.restore();
    }

    // Variant 1 — natural: a filled body a touch wider than tall, with a green
    // calyx draping over the shoulders. Matte (no gloss).
    _paintTomatoNatural(cr, cx, cy, R, darkP) {
        let c = this._tomatoColors(darkP);
        let bw = R * 0.92, bh = R * 0.80, byc = cy + R * 0.14;
        cr.save();
        cr.translate(cx, byc);
        cr.scale(bw, bh);
        cr.setSourceRGBA(c.br, c.bg, c.bb, 0.98);
        cr.arc(0, 0, 1, 0, 2 * Math.PI);
        cr.fill();
        cr.restore();
        this._tomatoCalyx(cr, cx, byc - bh * 0.60, R, c, 5, R * 0.60, R * 0.32, 0.72);
    }

    // Variant 2 — flat icon: a rounder, bolder body with a compact 3-leaf cap
    // and a short stem; clean emoji-like flat colours.
    _paintTomatoFlat(cr, cx, cy, R, darkP) {
        let c = this._tomatoColors(darkP);
        // Wider than tall (oblate) so it reads as a tomato, not a circle.
        let bw = R * 0.96, bh = R * 0.74, byc = cy + R * 0.12;
        cr.save();
        cr.translate(cx, byc);
        cr.scale(bw, bh);
        cr.setSourceRGBA(c.br, c.bg, c.bb, 0.99);
        cr.arc(0, 0, 1, 0, 2 * Math.PI);
        cr.fill();
        cr.restore();
        let topY = byc - bh * 0.70;
        this._tomatoCalyx(cr, cx, topY, R, c, 3, R * 0.50, R * 0.44, 0.92);
        cr.setSourceRGBA(c.lr * 0.8, c.lg * 0.8, c.lb * 0.8, 0.99);
        cr.setLineWidth(Math.max(1.3, R * 0.18));
        cr.moveTo(cx, topY);
        cr.lineTo(cx, topY - R * 0.3);
        cr.stroke();
    }

    // Variant 3 — soft depth: filled body with a subtle darker lower shading
    // (matte, no white gloss) for a calm, ripe roundness.
    _paintTomatoSoft(cr, cx, cy, R, darkP) {
        let c = this._tomatoColors(darkP);
        let bw = R * 0.92, bh = R * 0.80, byc = cy + R * 0.14;
        cr.save();
        cr.translate(cx, byc);
        cr.scale(bw, bh);
        cr.setSourceRGBA(c.br, c.bg, c.bb, 0.98);
        cr.arc(0, 0, 1, 0, 2 * Math.PI);
        cr.fill();
        cr.restore();
        cr.save();
        cr.translate(cx, byc + bh * 0.20);
        cr.scale(bw * 0.84, bh * 0.66);
        cr.setSourceRGBA(c.br * 0.74, c.bg * 0.70, c.bb * 0.68, 0.5);
        cr.arc(0, 0, 1, 0, 2 * Math.PI);
        cr.fill();
        cr.restore();
        this._tomatoCalyx(cr, cx, byc - bh * 0.60, R, c, 5, R * 0.58, R * 0.30, 0.72);
    }

    _panelIsDark() {
        // On a light panel the warm/light ring colours wash out. Detect the
        // panel brightness from the applet's foreground (text) colour: light
        // text implies a dark panel, dark text implies a light panel.
        try {
            let c = this.actor.get_theme_node().get_foreground_color();
            let lum = (0.2126 * c.red + 0.7152 * c.green + 0.0722 * c.blue) / 255;
            return lum > 0.5;
        } catch (e) {
            return true;
        }
    }

    _repaintPanelProgress(area) {
        let cr = area.get_context();
        try {
            let [w, h] = area.get_surface_size();
            let cx = w / 2, cy = h / 2;
            let radius = Math.min(w, h) / 2 - 2;
            if (radius <= 1) {
                return;
            }

            // Ready state: replace the empty grey ring with a meaningful brand
            // mark — a faint track, today's progress toward the daily goal, and
            // a centred "tomato" dot that reads as "ready to start".
            if (this._currentState === 'pomodoro-stop') {
                let goal = this._opt_dailyGoal || 0;
                let done = this._dailyCount || 0;
                let met = (goal > 0 && done >= goal);
                let darkP = this._panelIsDark();
                let ar, ag, ab;
                if (met) { ar = darkP ? 0.42 : 0.16; ag = darkP ? 0.88 : 0.60; ab = darkP ? 0.58 : 0.36; }
                else { ar = darkP ? 1.0 : 0.80; ag = darkP ? 0.69 : 0.47; ab = darkP ? 0.32 : 0.08; }
                // When a daily goal is set, keep a faint track + today's progress
                // arc hugging the tomato; otherwise show just the clean tomato.
                if (goal > 0) {
                    cr.setLineWidth(2.5);
                    cr.setSourceRGBA(ar, ag, ab, darkP ? 0.22 : 0.34);
                    cr.arc(cx, cy, radius, 0, 2 * Math.PI);
                    cr.stroke();
                    if (done > 0) {
                        let f = Math.min(1, done / goal);
                        let start = -Math.PI / 2;
                        cr.setSourceRGBA(ar, ag, ab, 0.95);
                        cr.arc(cx, cy, radius, start, start + 2 * Math.PI * f);
                        cr.stroke();
                    }
                }
                // Brand mark: a clean little tomato that reads as "ready to focus".
                this._paintPanelTomato(cr, cx, cy, (goal > 0) ? radius * 0.64 : radius * 0.92, darkP);
                return;
            }

            let breakish = (this._currentState === 'short-break' || this._currentState === 'long-break' ||
                this._currentState === 'short-break-paused' || this._currentState === 'long-break-paused' ||
                this._currentState === 'break-over' || this._currentState === 'focus-over');
            let paused = (this._currentState.indexOf('-paused') !== -1);
            let darkP = this._panelIsDark();
            let r, g, b;
            if (this._currentState === 'pomodoro' || this._currentState === 'pomodoro-paused') {
                r = darkP ? 1.0 : 0.80; g = darkP ? 0.69 : 0.47; b = darkP ? 0.32 : 0.08;
            } else if (breakish) {
                r = darkP ? 0.42 : 0.16; g = darkP ? 0.88 : 0.60; b = darkP ? 0.58 : 0.36;
            } else {
                r = darkP ? 0.6 : 0.38; g = darkP ? 0.6 : 0.38; b = darkP ? 0.6 : 0.38;
            }

            let timer = this._timerQueue ? this._timerQueue.getCurrentTimer() : null;
            let ticks = timer ? timer.getTicksRemaining() : null;
            let pct = this._getTimerProgressPercent(ticks);
            let frac = (typeof pct === "number") ? Math.max(0, Math.min(1, pct / 100)) : 0;

            cr.setLineWidth(2.5);
            cr.setSourceRGBA(r, g, b, darkP ? (paused ? 0.14 : 0.25) : (paused ? 0.24 : 0.36));
            cr.arc(cx, cy, radius, 0, 2 * Math.PI);
            cr.stroke();

            if (frac > 0) {
                let start = -Math.PI / 2;
                cr.setSourceRGBA(r, g, b, paused ? 0.5 : 0.95);
                cr.arc(cx, cy, radius, start, start + 2 * Math.PI * frac);
                cr.stroke();
            }

            // Centre: a pause glyph while paused; otherwise the tomato sits
            // inside the progress ring so it never reads as an empty ring.
            if (paused) {
                this._paintPauseBars(cr, cx, cy, radius * 0.5, [r, g, b]);
            } else {
                this._paintPanelTomato(cr, cx, cy, radius * 0.64, darkP);
            }
        } finally {
            cr.$dispose();
        }
    }
    
    _onShowTimerChanged() {
        this._setTimerLabel(this._timerQueue.getCurrentTimer().getTicksRemaining());
    }
    
    _onPlayTickedSoundChanged() {
        if (!this._timers.pomodoro.isRunning()) {
            return false;
        }
    
        if (this._opt_playTickerSound) {
            this._playTickerSound();
        } else {
            this._stopTickerSound();
        }
    
        return true;
    }
    
    on_orientation_changed(orientation) {
        this._orientation = orientation;
        let timer = this._timerQueue ? this._timerQueue.getCurrentTimer() : null;
        this._setTimerLabel(timer ? timer.getTicksRemaining() : 0);
    }

    on_panel_height_changed() {
        // Keep the panel progress ring sized to the (live) panel height; without
        // this it kept its original size until the next Cinnamon restart.
        if (this._panelProgressArea) {
            let size = Math.max(16, Math.min(28, this._panelHeight || 22));
            this._panelProgressArea.set_width(size);
            this._panelProgressArea.set_height(size);
            this._panelProgressArea.queue_repaint();
        }
    }

    on_applet_clicked() {
        if (this._opt_startOnClick && (this._currentState === 'pomodoro-stop' || this._currentState === 'break-over' || this._currentState === 'focus-over')) {
            this._startTimerFromMenu();
            return;
        }
        this._appletMenu.toggle();
    }
    
    on_applet_removed_from_panel() {
        Main.keybindingManager.removeHotKey(UUID);
        Main.keybindingManager.removeHotKey(UUID + "-toggle");
        Main.keybindingManager.removeHotKey(UUID + "-skip");
        Main.keybindingManager.removeHotKey(UUID + "-distraction");
        this._reconcileStaleBlock();
        this._stopFocusBlockIfNeeded();
        this._cancelAppearancePreview();
        this._cancelBreathingPreview();
        this._stopConfetti();
        if (this._capturePopover) {
            try { Main.popModal(this._capturePopover); } catch (e) {}
            try { this._capturePopover.destroy(); } catch (e) {}
            this._capturePopover = null;
            this._captureEntry = null;
        }
        if (this._reorderDialog) {
            try { this._reorderDialog.destroy(); } catch (e) {}
            this._reorderDialog = null;
        }
        if (this._onboardingTimeoutId) { try { imports.gi.GLib.source_remove(this._onboardingTimeoutId); } catch (e) {} this._onboardingTimeoutId = 0; }
        if (this._blockReconcileTimeoutId) { try { imports.gi.GLib.source_remove(this._blockReconcileTimeoutId); } catch (e) {} this._blockReconcileTimeoutId = 0; }
        this._clearIdleWatches();
        this._disarmSoftLanding();
        this._stopAllSounds();
        this._stopTimerPreview();
        this._stopAmbientPreview();
        this._disableDnd();
        this._resumePausedMedia();
        this._stopBreathing();
        if (this._breakLockTimeoutId) {
            try { GLib.source_remove(this._breakLockTimeoutId); } catch (e) {}
            this._breakLockTimeoutId = 0;
        }
        this._disarmScreensaverWatch();
        this._teardownZenSpotlight();
        if (this._zenTopStrip) {
            try { Main.layoutManager.removeChrome(this._zenTopStrip); } catch (e) {}
            try { this._zenTopStrip.destroy(); } catch (e) {}
            this._zenTopStrip = null;
        }
        if (this._zenHud) {
            this._zenHud.destroy();
            this._zenHud = null;
        }
        if (this._zenOverlay) {
            this._zenOverlay.destroy();
            this._zenOverlay = null;
        }
        if (this._breathOverlay) {
            this._breathOverlay.destroy();
            this._breathOverlay = null;
        }
        try { this._destroyFocusFrame(); } catch (e) {}
        try { this._clearCurrentFocusTask(); } catch (e) {}
        try { this._resetTimerQueueState(); } catch (e) {}
        try { this._settingsProvider.finalize(); } catch (e) {}
        try { this._removeDialogs(); } catch (e) {}
    }    
}

VisualModule.install(PomodoroApplet.prototype);
FeaturesModule.install(PomodoroApplet.prototype);
SoundFxModule.install(PomodoroApplet.prototype);
