const Main = imports.ui.main;
const Applet = imports.ui.applet;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const UUID = "pomodoro@gregfreeman.org";

let TimerModule, SoundModule;

if (typeof require !== 'undefined') {
    TimerModule = require('./timer');
    SoundModule = require('./sound');
} else {
    const AppletDir = imports.ui.appletManager.applets[UUID];
    TimerModule = AppletDir.timer;
    SoundModule = AppletDir.sound;
}

const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

// this function is useful for development of the applet
// as we can quickly disable long running settings for quick tuning
// i.e a setting of 25 in the options can mean 25 seconds if we comment out the '* 60'
// makes it easy to test all of the timers quickly
function convertMinutesToSeconds(minutes) {
    return minutes * 60;
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new PomodoroApplet(metadata, orientation, panelHeight, instanceId);
}

class PomodoroApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this._metadata = metadata;

        // 'pomodoro', 'pomodoro-stop', 'short-break', 'long-break'
        this._currentState = 'pomodoro-stop';

        // Number of finished pomodori in the current set.
        this._numPomodoriFinished = 0;
        // Number of finished sets.
        this._numPomodoroSetFinished = 0;
        this._setTimerLabel(0);

        // option settings, values are bound in _bindSettings
        // using _opt prefix to make them easy to identify
        this._opt_pomodoroTimeMinutes = null;
        this._opt_shortBreakTimeMinutes = null;
        this._opt_longBreakTimeMinutes = null;
        this._opt_pomodoriNumber = null;
        this._opt_startAutomaticallyOnLoad = null;
        this._opt_showDialogMessages = null;
        this._opt_autoContinueAfterPomodoro = null;
        this._opt_autoContinueAfterShortBreak = null;
        this._opt_autoStartNewAfterFinish = null;
        this._opt_displayIconInPanel = null;
        this._opt_showTimerInPanel = null;
        this._opt_hotkey = null;
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
        this._opt_enableScripts = null;
        this._opt_customShortBreakScript = null;
        this._opt_customLongBreakScript = null;

        this._settingsProvider = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this._bindSettings();

        this._defaultSoundPath = metadata.path + '/sounds';
        this._sounds = {};
        this._loadSoundEffects();

        // If cinnamon crashes or restarts, we want to make sure no zombie sounds are still looping
        let killLoopingSoundCommand = `python3 ${metadata.path}/bin/kill-looping-sound.py ${this._sounds.tick.getSoundPath()}`;
        Util.trySpawnCommandLine(killLoopingSoundCommand);

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
        
        this._appletMenu = this._createMenu(orientation);

        this._connectTimerSignals();

        // Trigger for initial setting
        this._onAppletIconChanged();
        this._onShowTimerChanged();

        // Initial setup of the hotkey
        this._updateHotkey();

        // start timer automatically
        if (this._opt_startAutomaticallyOnLoad) {
            this._appletMenu.toggleTimerState(true);
            this._timerQueue.start();
        }
    }

    _bindSettings() {
        const emptyCallback = () => {};
    
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "pomodoro_duration",
            "_opt_pomodoroTimeMinutes",
            () => {
                let timeInSeconds = convertMinutesToSeconds(this._opt_pomodoroTimeMinutes);
                this._timers.pomodoro.setTimerLimit(timeInSeconds);
            }
        );
    
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "short_break_duration",
            "_opt_shortBreakTimeMinutes",
            () => {
                let timeInSeconds = convertMinutesToSeconds(this._opt_shortBreakTimeMinutes);
                this._timers.shortBreak.setTimerLimit(timeInSeconds);
            }
        );
    
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "long_break_duration",
            "_opt_longBreakTimeMinutes",
            () => {
                let timeInSeconds = convertMinutesToSeconds(this._opt_longBreakTimeMinutes);
                this._timers.longBreak.setTimerLimit(timeInSeconds);
            }
        );
    
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "pomodori_number",
            "_opt_pomodoriNumber",
            () => {
                // only take effect if the timer isn't currently running
                // otherwise wait until next pomodoro to take effect
                if (this._timerQueue.isRunning()) {
                    this.__pomodoriNumberChangedWhileRunning = true;
                    return;
                }
                this._resetPomodoroTimerQueue();
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "hotkey",
            "_opt_hotkey",
            () => {
                this._updateHotkey();
            }
        );
    
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "start_automatically_on_load", "_opt_startAutomaticallyOnLoad", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "show_dialog_messages", "_opt_showDialogMessages", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "auto_start_after_pomodoro_ends", "_opt_autoContinueAfterPomodoro", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "auto_start_after_short_break_ends", "_opt_autoContinueAfterShortBreak", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "auto_start_after_break_ends", "_opt_autoStartNewAfterFinish", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "enable_scripts", "_opt_enableScripts", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "custom_short_break_script", "_opt_customShortBreakScript", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "custom_long_break_script", "_opt_customLongBreakScript", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "display_icon", "_opt_displayIconInPanel", this._onAppletIconChanged.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "use_symbolic_icon", "_opt_useSymbolicIconInPanel", this._onAppletIconChanged.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "show_timer", "_opt_showTimerInPanel", this._onShowTimerChanged.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "timer_sound", "_opt_playTickerSound", this._onPlayTickedSoundChanged.bind(this));

        // Binding properties that require updating or recalculating other settings
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "timer_sound_file",
            "_opt_tickerSoundPath",
            () => {
                this._loadSoundEffects();
                this._onPlayTickedSoundChanged();
            }
        );
    
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "timer_sound_volume",
            "_opt_tickerSoundVolume",
            () => {
                if (this._onPlayTickedSoundChanged() === false) {
                    this._playTickerSound(true); // If not playing, play a preview
                }
            }
        );
    
        // Continuing with additional settings properties
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "break_sound", "_opt_playBreakSound", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "break_sound_file", "_opt_breakSoundPath", this._loadSoundEffects.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "break_sound_volume", "_opt_breakSoundVolume", () => this._playBreakSound(true));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "warn_sound", "_opt_playWarnSound", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "warn_sound_delay", "_opt_warnSoundDelay", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "warn_sound_file", "_opt_warnSoundPath", this._loadSoundEffects.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "warn_sound_volume", "_opt_warnSoundVolume", () => this._playWarnSound(true));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "start_sound", "_opt_playStartSound", emptyCallback);
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "start_sound_file", "_opt_startSoundPath", this._loadSoundEffects.bind(this));
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN, "start_sound_volume", "_opt_startSoundVolume", () => this._playStartSound(true));
    
        let showSoxInfo = true;
        if (Gio.file_new_for_path("/usr/bin/sox").query_exists(null)) {
            showSoxInfo = false;
        }
        this._settingsProvider.setValue('show_sox_info', showSoxInfo);
    }

    _updateHotkey() {
        Main.keybindingManager.removeHotKey(UUID);
    
        if (this._opt_hotkey !== null) {
            // Register the new hotkey with the current keybinding setting
            Main.keybindingManager.addHotKey(UUID, this._opt_hotkey, () => {
                this.on_applet_clicked();
            });
        }
    }
    
    _setTimerLabel(ticks) {
        let timeLeft = this._getFormattedTimeLeft(ticks);
        if (timeLeft === undefined) {
            return;
        }
    
        let timerText = `${this._numPomodoroSetFinished}`;
    
        if (this._opt_showTimerInPanel) {
            timerText += ` \u00B7 ${timeLeft}`; // Separator
        }
    
        this.set_applet_label(timerText);
    }
    
    _setAppletTooltip(ticks) {
        let timeLeft = this._getFormattedTimeLeft(ticks);
        let timeLeftExtension = "";
        if (timeLeft !== undefined) {
            timeLeftExtension = ` (${timeLeft})`;
        }
    
        let message;
        switch (this._currentState) {
        case 'short-break':
            message = _("Short break running") + timeLeftExtension;
            break;
        case 'long-break':
            message = _("Long break running") + timeLeftExtension;
            break;
        case 'pomodoro':
            message = _("Pomodori %d, set %d running").format(
                this._numPomodoriFinished + 1, this._numPomodoroSetFinished + 1
            ) + timeLeftExtension;
            break;
        case 'pomodoro-stop':
            message = _("Waiting to start");
            break;
        default:
            message = "";
            break;
        }
    
        this.set_applet_tooltip(message);
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
        this._onAppletIconChanged();
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
    
            if (this._opt_autoStartNewAfterFinish) {
                if (this._longBreakdialog.state === ModalDialog.State.OPENED) {
                    this._longBreakdialog.close();
                }
                this._startNewTimerQueue();
            } else if (this._opt_showDialogMessages) {
                this._longBreakdialog.open();
            } else {
                this._turnOff();
            }
        });
    
        timerQueue.connect('timer-queue-reset', () => {
            this._setTimerLabel(0);
        });
    
        timerQueue.connect('timer-queue-before-next-timer', () => {
            let timer = timerQueue.getCurrentTimer();
            if (!this._opt_autoContinueAfterPomodoro && timer === shortBreakTimer) {
                timerQueue.preventStart(true);
                timerQueue.stop();
                this._appletMenu.toggleTimerState(false);
                this._setAppletTooltip(0);
                if (this._opt_showDialogMessages) {
                    this._playStartSound();
                    this._pomodoroFinishedDialog.open();
                }
            }
            else if (!this._opt_autoContinueAfterShortBreak && timer === pomodoroTimer) {
                timerQueue.preventStart(true);
                timerQueue.stop();
                this._appletMenu.toggleTimerState(false);
                this._setAppletTooltip(0);
                if (this._opt_showDialogMessages) {
                    this._playStartSound();
                    this._shortBreakdialog.open();
                }
            }
        });

        // Connect the pomodoro timer signals

        pomodoroTimer.connect('timer-tick', (timer) => {
            this._timerTickUpdate(timer);
            if (timer.getTicksRemaining() === this._opt_warnSoundDelay) {
                this._playWarnSound();
            }
        });
    
        pomodoroTimer.connect('timer-running', () => {
            this._setCurrentState('pomodoro');
            this._playTickerSound();
        });
    
        pomodoroTimer.connect('timer-started', () => {
            this._setCurrentState('pomodoro');
            this._playStartSound();
            Main.notify(_("Let's go to work!"));
        });
    
        pomodoroTimer.connect('timer-stopped', () => {
            this._setCurrentState('pomodoro-stop');
            this._stopTickerSound();
        });

        // connect the short break timer signals

        shortBreakTimer.connect('timer-tick', this._timerTickUpdate.bind(this));
        
        shortBreakTimer.connect('timer-started', () => {
            this._setCurrentState('short-break');
            this._playBreakSound();
            this._numPomodoriFinished++;
            this._appletMenu.updateCounts(this._numPomodoroSetFinished, this._numPomodoriFinished);
            this._appletMenu.showPomodoroInProgress(this._opt_pomodoriNumber);
            Main.notify(_("Take a short break"));
            if (this._opt_enableScripts && this._opt_customShortBreakScript) {
                this._checkAndExecuteCustomScript(this._opt_customShortBreakScript);
            }
        });
    
        shortBreakTimer.connect('timer-stopped', () => {
            this._setCurrentState('pomodoro-stop');
        });
    
        shortBreakTimer.connect('timer-running', () => {
            this._setCurrentState('short-break');
        });

        longBreakTimer.connect('timer-tick', this._timerTickUpdate.bind(this));
        longBreakTimer.connect('timer-tick', this._longBreakdialog.setTimeRemaining.bind(this._longBreakdialog));
    
        longBreakTimer.connect('timer-started', () => {
            this._setCurrentState('long-break');
            this._playBreakSound();
            if (this._opt_showDialogMessages) {
                this._longBreakdialog.open();
            } else {
                Main.notify(_("Take a long break"));
            }
            if (this._opt_enableScripts && this._opt_customLongBreakScript) {
                this._checkAndExecuteCustomScript(this._opt_customLongBreakScript);
            }
        });
    
        longBreakTimer.connect('timer-stopped', () => {
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
        this._resetTimerQueueState();
        this._appletMenu.toggleTimerState(false);
        this._clearAppletTooltip();
        Main.notify(_("Pomodoro ended"));
    }
    
    _timerTickUpdate(timer) {
        this._setTimerLabel(timer.getTicksRemaining());
        this._setAppletTooltip(timer.getTicksRemaining());
    }
    
    _playTickerSound(previewOnly = false) {
        if (this._opt_playTickerSound) {
            this._sounds.tick.play({ loop: true, volume: this._opt_tickerSoundVolume / 100, preview: previewOnly });
        }
    }
    
    _stopTickerSound() {
        this._sounds.tick.stop();
    }
    
    _playBreakSound(previewOnly = false) {
        if (this._opt_playBreakSound) {
            this._sounds.break.play({ volume: this._opt_breakSoundVolume / 100, preview: previewOnly });
        }
    }
    
    _playWarnSound(previewOnly = false) {
        if (this._opt_playWarnSound) {
            this._sounds.warn.play({ volume: this._opt_warnSoundVolume / 100, preview: previewOnly });
        }
    }
    
    _playStartSound(previewOnly = false) {
        if (this._opt_playStartSound) {
            this._sounds.start.play({ volume: this._opt_startSoundVolume / 100, preview: previewOnly });
        }
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
    
    _loadSoundEffects() {
        if (!SoundModule.isPlayable()) {
            global.logError("Unable to play pomodoro sound, make sure 'play' command is available on your path from the sox package");
        }
    
        this._sounds = this._sounds || {};
        this._sounds.tick = this._loadSoundEffect(this._sounds.tick, this._opt_tickerSoundPath);
        this._sounds.break = this._loadSoundEffect(this._sounds.break, this._opt_breakSoundPath);
        this._sounds.warn = this._loadSoundEffect(this._sounds.warn, this._opt_warnSoundPath);
        this._sounds.start = this._loadSoundEffect(this._sounds.start, this._opt_startSoundPath);
    }

    _checkAndExecuteCustomScript(filePath) {
        if (filePath.startsWith('file://')) {
            filePath = filePath.substr(7);
        }

        const fileExists = GLib.file_test(filePath, GLib.FileTest.EXISTS);
        const isExecutable = GLib.file_test(filePath, GLib.FileTest.IS_EXECUTABLE);

        if (!fileExists) {
            global.logError(`Pomodoro custom script file does not exist: ${filePath}`);
            return false;
        }

        if (!isExecutable) {
            global.logError(`Pomodoro custom script does not have executable permissions: ${filePath}`);
            return false;
        }

        try {
            GLib.spawn_command_line_async(filePath);
            return true;
        } catch (error) {
            global.logError(`Failed to execute Pomodoro custom script file: ${filePath}, error: ${error.message}`);
            return false;
        }
    }
    
    _createMenu(orientation) {
        let menuManager = new PopupMenu.PopupMenuManager(this);
        let menu = new PomodoroMenu(this, orientation);
    
        menu.connect('start-timer', () => {
            this._timerQueue.preventStart(false);
            this._timerQueue.start();
        });
    
        menu.connect('stop-timer', () => {
            this._timerQueue.stop();
            this._clearAppletTooltip();
        });
    
        menu.connect('reset-timer', () => {
            this._timerQueue.reset();
            this._setTimerLabel(0);
            this._clearAppletTooltip();
        });
    
        menu.connect('reset-counts', () => {
            this._numPomodoriFinished = 0;
            this._numPomodoroSetFinished = 0;
            this._appletMenu.updateCounts(0, 0);
        });

        menu.connect('skip-timer', () => {
            let timer = this._timerQueue.getCurrentTimer();
            this._timerQueue.skip();
            if (timer === this._timers.longBreak) {
                if (!this._opt_autoStartNewAfterFinish) {
                    this._longBreakdialog.close();
                    this._startNewTimerQueue();
                }
            }
        });
    
        menu.connect('what-is-this', () => {
            let command = `xdg-open '${_("http://en.wikipedia.org/wiki/Pomodoro_Technique")}'`;
            Util.trySpawnCommandLine(command);
        });
    
        menuManager.addMenu(menu);
    
        return menu;
    }
    
    _createLongBreakDialog() {
        this._longBreakdialog = new PomodoroSetFinishedDialog();
    
        this._longBreakdialog.connect('switch-off-pomodoro', () => {
            if (!this._timerQueue.isRunning() && !this._opt_autoStartNewAfterFinish) {
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
            if (!this._opt_autoStartNewAfterFinish) {
                this._longBreakdialog.close();
                this._startNewTimerQueue();
            }
        });
    
        this._longBreakdialog.connect('hide', () => {
            if (!this._timerQueue.isRunning() && !this._opt_autoStartNewAfterFinish) {
                this._turnOff();
            }
            this._longBreakdialog.close();
        });
    }
    
    _createShortBreakDialog() {
        this._shortBreakdialog = new PomodoroShortBreakFinishedDialog();
    
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
        this._pomodoroFinishedDialog = new PomodoroFinishedDialog();
    
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
    }
    
    _onAppletIconChanged() {
        if (this._opt_displayIconInPanel) {
            this._applet_icon_box.show();
            let appletIconPath = '';
            let appletIconStatus = '';
            switch (this._currentState) {
            case 'pomodoro-stop':
                appletIconPath = `${this._metadata.path}/pomodoro-stop`;
                appletIconStatus = 'system-status-icon';
                break;
            case 'short-break':
            case 'long-break':
                appletIconPath = `${this._metadata.path}/pomodoro-break`;
                appletIconStatus = 'system-status-icon success';
                break;
            case 'pomodoro':
            default:
                appletIconPath = `${this._metadata.path}/pomodoro`;
                appletIconStatus = 'system-status-icon error';
                break;
            }
            if (this._opt_useSymbolicIconInPanel) {
                this.set_applet_icon_symbolic_path(appletIconPath + "-symbolic.svg");
                this._applet_icon.set_style_class_name(appletIconStatus);
            } else {
                this.set_applet_icon_path(appletIconPath + ".png");
            }
        } else if (this._applet_icon_box.child) {
            this._applet_icon_box.hide();
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
    
    on_applet_clicked() {
        this._appletMenu.toggle();
    }
    
    on_applet_removed_from_panel() {
        Main.keybindingManager.removeHotKey(UUID);
        this._resetTimerQueueState();
        this._settingsProvider.finalize();
    }    
}

class PomodoroMenu extends Applet.AppletPopupMenu {
    constructor(launcher, orientation) {
        super(launcher, orientation);
        this._pomodoroCount = 0;
        this._pomodoroSetCount = 0;

        this._addMenuItems();
        this.updateCounts(0, 0);
    }

    _addMenuItems() {
        // "Pomodoro Timer" toggle switch in the menu
        let onoff = new PopupMenu.PopupSwitchMenuItem(_("Pomodoro Timer"), false);
        this._timerToggle = onoff;

        onoff.connect("toggled", (menuItem, state) => {
            this.emit(state ? 'start-timer' : 'stop-timer');
        });
        this.addMenuItem(onoff);

        // "Completed" display menu item
        let completed = new PopupMenu.PopupMenuItem(_("Completed"), { reactive: false });
        let bin = new St.Bin({ x_align: St.Align.END });
        this._pomodoriCountLabel = new St.Label();
        bin.add_actor(this._pomodoriCountLabel);
        completed.addActor(bin, { expand: true, span: -1, align: St.Align.END });
        this.addMenuItem(completed);

        // "Reset Timer" menu item for resetting the current timer
        let reset = new PopupMenu.PopupMenuItem(_("Reset Timer"));
        reset.connect('activate', () => {
            this.toggleTimerState(false);
            this.emit('reset-timer');
        });
        this.addMenuItem(reset);

        // "Reset Counts and Timer" menu item for resetting both the timer and the counts
        let resetAll = new PopupMenu.PopupMenuItem(_("Reset Counts and Timer"));
        resetAll.connect('activate', () => {
            this.toggleTimerState(false);
            this.emit('reset-counts');
            this.emit('reset-timer');
        });
        this.addMenuItem(resetAll);

        // "Skip To Next Timer" menu item for allowing the user to end the current timer early
        let skipTimer = new PopupMenu.PopupMenuItem(_("Skip To Next Timer"));
        skipTimer.connect('activate', () => {
            this.emit('skip-timer');
        });
        this.addMenuItem(skipTimer);

        // "What is this?" menu item for additional information
        let whatisthis = new PopupMenu.PopupMenuItem(_("What is this?"));
        whatisthis.connect("activate", () => {
            this.emit('what-is-this');
        });
        this.addMenuItem(whatisthis);
    }

    toggleTimerState(state) {
        this._timerToggle.setToggleState(Boolean(state));
    }

    showPomodoroInProgress(pomodoriNumber) {
        let text = '';

        if (this._pomodoroSetCount > 0) {
            text = Array(this._pomodoroSetCount + 1).join('\u25cf');
        }

        if (pomodoriNumber == 4) {
            if (this._pomodoroCount == 0) {
                text += '\u25cb'; // white circle
            } else if (this._pomodoroCount == 1) {
                text += '\u25d4'; // circle with upper right quadrant black
            } else if (this._pomodoroCount == 2) {
                text += '\u25d1'; // circle with right half black
            } else if (this._pomodoroCount == 3) {
                text += '\u25d5'; // circle with all but upper left quadrant black
            } else {
                text += '\u25cf'; // black circle
            }
        } else {
            text += '\u25d6'; // left half black circle
        }

        this._pomodoriCountLabel.text = text;
    }

    updateCounts(setCount, pomodoroCount) {
        this._pomodoroCount = pomodoroCount;
        this._pomodoroSetCount = setCount;
        let text = setCount == 0 ? _("None") : Array(setCount + 1).join('\u25cf');

        this._pomodoriCountLabel.text = text;
    }
}

class PomodoroSetFinishedDialog extends ModalDialog.ModalDialog {
    constructor() {
        super();
        this._subjectLabel = new St.Label();
        this.contentLayout.add(this._subjectLabel);

        this._timeLabel = new St.Label();
        this.contentLayout.add(this._timeLabel);

        this.setButtons([
            {
                label: _("Switch Off Pomodoro"),
                action: () => {
                    this.emit('switch-off-pomodoro');
                }
            },
            {
                label: _("Start a new Pomodoro"),
                action: () => {
                    this.emit('start-new-pomodoro');
                }
            },
            {
                label: _("Hide"),
                action: () => {
                    this.emit('hide');
                },
                key: Clutter.Escape
            }
        ]);

        this.setDefaultLabels();
    }

    setDefaultLabels() {
        this._subjectLabel.set_text(_("Pomodoro set finished, you deserve a break!") + "\n");
        // Reset the time label text
        this._timeLabel.text = '';
    }

    setTimeRemaining(timer) {
        let tickCount = timer.getTicksRemaining();

        if (tickCount === 0) {
            this._subjectLabel.text = _("Your break is over, start another pomodoro!") + "\n";
            this._timeLabel.text = '';
            return;
        }

        // Update the time label text based on the time remaining
        this._setTimeLabelText(_("A new pomodoro begins in %s.").format(this._getTimeString(tickCount)));
    }

    _setTimeLabelText(label) {
        this._timeLabel.set_text(label + "\n");
    }

    _getTimeString(totalSeconds) {
        // Convert total seconds to minutes and seconds
        let minutes = parseInt(totalSeconds / 60);
        let seconds = parseInt(totalSeconds % 60);

        let min = Gettext.dngettext(UUID, "%d minute", "%d minutes", minutes).format(minutes);
        let sec = Gettext.dngettext(UUID, "%d second", "%d seconds", seconds).format(seconds);

        return _("%s and %s").format(min, sec);
    }
}

class PomodoroShortBreakFinishedDialog extends ModalDialog.ModalDialog {
    constructor() {
        super();
        this._subjectLabel = new St.Label();
        this.contentLayout.add(this._subjectLabel);

        this._timeLabel = new St.Label();
        this.contentLayout.add(this._timeLabel);

        this.setButtons([
            {
                label: _("Continue Current Pomodoro"),
                action: () => {
                    this.emit('continue-current-pomodoro');
                }
            },
            {
                label: _("Pause Pomodoro"),
                action: () => {
                    this.emit('pause-pomodoro');
                }
            }
        ]);

        this.setDefaultLabels();
    }

    setDefaultLabels() {
        this._subjectLabel.set_text(_("Short break finished, ready to continue?") + "\n");
        this._timeLabel.text = '';
    }
}

class PomodoroFinishedDialog extends ModalDialog.ModalDialog {
    constructor() {
        super();
        this._subjectLabel = new St.Label();
        this.contentLayout.add(this._subjectLabel);

        this._timeLabel = new St.Label();
        this.contentLayout.add(this._timeLabel);

        this.setButtons([
            {
                label: _("Start break"),
                action: () => {
                    this.emit('continue-current-pomodoro');
                }
            },
            {
                label: _("Pause Pomodoro"),
                action: () => {
                    this.emit('pause-pomodoro');
                }
            }
        ]);

        this.setDefaultLabels();
    }

    setDefaultLabels() {
        this._subjectLabel.set_text(_("Pomodoro finished, ready to take a break?") + "\n");
        this._timeLabel.text = '';
    }
}

