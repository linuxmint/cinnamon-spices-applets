const Main = imports.ui.main;
const Applet = imports.ui.applet;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const UUID = "pomodoro@gregfreeman.org";

const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

// set in main()
let TimerModule;
let SoundModule;

// this function is useful for development of the applet
// as we can quickly disable long running settings for quick tuning
// i.e a setting of 25 in the options can mean 25 seconds if we comment out the '* 60'
// makes it easy to test all of the timers quickly
function convertMinutesToSeconds(minutes) {
    return minutes * 60;
}

function main(metadata, orientation, panelHeight, instanceId) {
    if (typeof require !== 'undefined') {
        TimerModule = require('./timer');
        SoundModule = require('./sound');
    } else {
        let myModule = imports.ui.appletManager.applets[metadata.uuid];
        TimerModule = myModule.timer;
        SoundModule = myModule.sound;
    }

    let myApplet = new PomodoroApplet(metadata, orientation, panelHeight, instanceId);

    return myApplet;
}

function PomodoroApplet(metadata, orientation, panelHeight, instanceId) {
    this._init.call(this, metadata, orientation, panelHeight, instanceId);
}

PomodoroApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

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
        this._opt_showDialogMessages = null;
        this._opt_autoStartNewAfterFinish = null;
        this._opt_displayIconInPanel = null;
        this._opt_showTimerInPanel = null;
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

        this._settingsProvider = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this._bindSettings();

        this._defaultSoundPath = metadata.path + '/sounds';

        this._sounds = {};
        this._loadSoundEffects();

        // If cinnamon crashes or restarts, we want to make sure no zombie sounds are still looping
        let killLoopingSoundCommand = 'python3 %s %s'.format(metadata.path + '/bin/kill-looping-sound.py', this._sounds.tick.getSoundPath());
        Util.trySpawnCommandLine(killLoopingSoundCommand);

        this._timers = {
            pomodoro: new TimerModule.Timer({ timerLimit: convertMinutesToSeconds(this._opt_pomodoroTimeMinutes) }),
            shortBreak: new TimerModule.Timer({ timerLimit: convertMinutesToSeconds(this._opt_shortBreakTimeMinutes) }),
            longBreak: new TimerModule.Timer({ timerLimit: convertMinutesToSeconds(this._opt_longBreakTimeMinutes) })
        };

        this._timerQueue = new TimerModule.TimerQueue();
        this._resetPomodoroTimerQueue();

        this._longBreakdialog = this._createLongBreakDialog();
        this._shortBreakdialog = this._createShortBreakDialog()
        this._appletMenu = this._createMenu(orientation);

        this._connectTimerSignals();

        // trigger for initial setting
        this._onAppletIconChanged();
        this._onShowTimerChanged();
    },

    _bindSettings: function() {
        let emptyCallback = function() {}; // for cinnamon 1.8

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "pomodoro_duration",
            "_opt_pomodoroTimeMinutes",
            function() {
                let timeInSeconds = convertMinutesToSeconds(this._opt_pomodoroTimeMinutes);
                this._timers.pomodoro.setTimerLimit(timeInSeconds);
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "short_break_duration",
            "_opt_shortBreakTimeMinutes",
            function() {
                let timeInSeconds = convertMinutesToSeconds(this._opt_shortBreakTimeMinutes);
                this._timers.shortBreak.setTimerLimit(timeInSeconds);
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "long_break_duration",
            "_opt_longBreakTimeMinutes",
            function() {
                let timeInSeconds = convertMinutesToSeconds(this._opt_longBreakTimeMinutes);
                this._timers.longBreak.setTimerLimit(timeInSeconds);
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "pomodori_number",
            "_opt_pomodoriNumber",
            function() {
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
            "show_dialog_messages",
            "_opt_showDialogMessages",
            emptyCallback
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "auto_start_after_short_break_ends",
            "_opt_autoContinueAfterShortBreak",
            emptyCallback
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "auto_start_after_break_ends",
            "_opt_autoStartNewAfterFinish",
            emptyCallback
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "display_icon",
            "_opt_displayIconInPanel",
            this._onAppletIconChanged
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "use_symbolic_icon",
            "_opt_useSymbolicIconInPanel",
            this._onAppletIconChanged
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "show_timer",
            "_opt_showTimerInPanel",
            this._onShowTimerChanged
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "timer_sound",
            "_opt_playTickerSound",
            this._onPlayTickedSoundChanged
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "timer_sound_file",
            "_opt_tickerSoundPath",
            function() {
                this._loadSoundEffects();
                this._onPlayTickedSoundChanged();
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "timer_sound_volume",
            "_opt_tickerSoundVolume",
            function() {
                // If not playing, play a preview
                if (this._onPlayTickedSoundChanged() === false) {
                    this._playTickerSound(true);
                }
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "break_sound",
            "_opt_playBreakSound",
            emptyCallback
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "break_sound_file",
            "_opt_breakSoundPath",
            function() {
                this._loadSoundEffects();
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "break_sound_volume",
            "_opt_breakSoundVolume",
            function() {
                this._playBreakSound(true);
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "warn_sound",
            "_opt_playWarnSound",
            emptyCallback
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "warn_sound_delay",
            "_opt_warnSoundDelay",
            emptyCallback
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "warn_sound_file",
            "_opt_warnSoundPath",
            function() {
                this._loadSoundEffects();
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "warn_sound_volume",
            "_opt_warnSoundVolume",
            function() {
                this._playWarnSound(true);
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "start_sound",
            "_opt_playStartSound",
            emptyCallback
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "start_sound_file",
            "_opt_startSoundPath",
            function() {
                this._loadSoundEffects();
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "start_sound_volume",
            "_opt_startSoundVolume",
            function() {
                this._playStartSound(true);
            }
        );

        let showSoxInfo = true;
        if (Gio.file_new_for_path("/usr/bin/sox").query_exists(null)) {
            showSoxInfo = false;
        }
        this._settingsProvider.setValue('show_sox_info', showSoxInfo);
    },

    _setTimerLabel: function(ticks) {
        ticks = ticks || 0;

        let minutes, seconds;
        minutes = seconds = 0;

        if (ticks > 0) {
            minutes = parseInt(ticks / 60);
            seconds = parseInt(ticks % 60);
        }

        let timerText = "%d".format(this._numPomodoroSetFinished);

        if (this._opt_showTimerInPanel) {
            timerText += " \u00B7 "; // Separator
            timerText += "%02d:%02d".format(Math.abs(minutes), Math.abs(seconds));
        }

        this.set_applet_label(timerText);
    },

    /**
     * Adds all of the timers to a queue,
     * takes into account the number of pomodori per set,
     * is called every time a new pomodoro set is started.
     * @private
     */
    _resetPomodoroTimerQueue: function() {
        this._timerQueue.clear();

        for (let i = 1; i < this._opt_pomodoriNumber + 1; i++) {
            this._timerQueue.addTimer(this._timers.pomodoro);

            if (i == this._opt_pomodoriNumber) {
                this._timerQueue.addTimer(this._timers.longBreak);
            } else {
                this._timerQueue.addTimer(this._timers.shortBreak);
            }
        }
    },

    /**
     * @param {string} newState 'pomodoro' | 'short-break' | 'long-break'
     * @private
     */
    _setCurrentState: function(newState) {
        this._currentState = newState;
        this._onAppletIconChanged();
    },

    _connectTimerSignals: function() {
        let timerQueue = this._timerQueue;
        let pomodoroTimer = this._timers.pomodoro;
        let shortBreakTimer = this._timers.shortBreak;
        let longBreakTimer = this._timers.longBreak;

        timerQueue.connect('timer-queue-started', Lang.bind(this, function() {
            this._appletMenu.showPomodoroInProgress(this._opt_pomodoriNumber);
            Main.notify(_("Pomodoro started"));
        }));

        timerQueue.connect('timer-queue-finished', Lang.bind(this, function() {
            this._numPomodoriFinished = 0;
            this._numPomodoroSetFinished++;
            this._appletMenu.updateCounts(this._numPomodoroSetFinished, this._numPomodoriFinished);

            if (this._opt_autoStartNewAfterFinish) {
                if (this._longBreakdialog.state == ModalDialog.State.OPENED) {
                    this._longBreakdialog.close();
                }

                this._startNewTimerQueue();
            } else if (this._opt_showDialogMessages) {
                this._longBreakdialog.open();
            } else {
                // user is not auto starting a new one and has dialog disabled
                // so we'll disable the applet
                this._turnOff();
            }
        }));

        timerQueue.connect('timer-queue-reset', Lang.bind(this, function() {
            this._setTimerLabel(0);
        }));

        pomodoroTimer.connect('timer-tick', Lang.bind(this, function(timer) {
            this._timerTickUpdate(timer);

            if (timer.getTicksRemaining() == this._opt_warnSoundDelay) {
                this._playWarnSound();
            }
        }));

        timerQueue.connect('timer-queue-before-next-timer', Lang.bind(this, function() {

            let timer = timerQueue.getCurrentTimer();

            if (!this._opt_autoContinueAfterShortBreak && timer === pomodoroTimer) {
                timerQueue.preventStart(true);
                timerQueue.stop();
                this._appletMenu.toggleTimerState(false);
                this.set_applet_tooltip(_("Waiting to start"));

                if (this._opt_showDialogMessages) {
                    this._playStartSound();
                    this._shortBreakdialog.open();
                }
            }

        }));

        shortBreakTimer.connect('timer-tick', Lang.bind(this, this._timerTickUpdate));

        longBreakTimer.connect('timer-tick', Lang.bind(this, this._timerTickUpdate));
        longBreakTimer.connect('timer-tick', Lang.bind(this._longBreakdialog, this._longBreakdialog.setTimeRemaining));

        pomodoroTimer.connect('timer-running', Lang.bind(this, function() {
            this._setCurrentState('pomodoro');
            this._playTickerSound();
            this.set_applet_tooltip(_("Pomodori %d, set %d running").format(this._numPomodoriFinished + 1, this._numPomodoroSetFinished + 1));
        }));

        pomodoroTimer.connect('timer-started', Lang.bind(this, function() {
            this._setCurrentState('pomodoro');

            this._playStartSound();
            Main.notify(_("Let's go to work!"));
        }));

        pomodoroTimer.connect('timer-stopped', Lang.bind(this, function() {
            this._setCurrentState('pomodoro-stop');
            this._stopTickerSound();
        }));

        shortBreakTimer.connect('timer-started', Lang.bind(this, function() {
            this._setCurrentState('short-break');

            this._playBreakSound();
            this._numPomodoriFinished++;
            this._appletMenu.updateCounts(this._numPomodoroSetFinished, this._numPomodoriFinished);
            this._appletMenu.showPomodoroInProgress(this._opt_pomodoriNumber);
            Main.notify(_("Take a short break"));
            this.set_applet_tooltip(_("Short break running"));
        }));

        shortBreakTimer.connect('timer-stopped', Lang.bind(this, function() {
            this._setCurrentState('pomodoro-stop');
        }));

        shortBreakTimer.connect('timer-running', Lang.bind(this, function() {
            this._setCurrentState('short-break');
        }));

        longBreakTimer.connect('timer-started', Lang.bind(this, function() {
            this._setCurrentState('long-break');

            this._playBreakSound();

            if (this._opt_showDialogMessages) {
                this._longBreakdialog.open();
            } else {
                Main.notify(_("Take a long break"));
            }
            this.set_applet_tooltip(_("Long break running"));
        }));

        longBreakTimer.connect('timer-stopped', Lang.bind(this, function() {
            this._setCurrentState('pomodoro-stop');
        }));

        longBreakTimer.connect('timer-running', Lang.bind(this, function() {
            this._setCurrentState('long-break');
        }));
    },

    _startNewTimerQueue: function() {
        this._numPomodoriFinished = 0;
        this._resetTimerQueueState();
        this._timerQueue.start();
    },

    _resetTimerQueueState: function() {
        if (!this.__pomodoriNumberChangedWhileRunning) {
            this._timerQueue.reset();
        } else {
            this._resetPomodoroTimerQueue();
            delete this.__pomodoriNumberChangedWhileRunning;
        }

        this._longBreakdialog.setDefaultLabels();
    },

    _turnOff: function() {
        this._resetTimerQueueState();
        this._appletMenu.toggleTimerState(false);
        this.set_applet_tooltip("");

        Main.notify(_("Pomodoro ended"));
    },

    /**
     *
     * @param {imports.timer.Timer} timer
     * @private
     */
    _timerTickUpdate: function(timer) {
        this._setTimerLabel(timer.getTicksRemaining());
    },

    /**
     *
     * @param {boolean} [previewOnly=false] only play a preview of the sound?
     * @private
     */
    _playTickerSound: function(previewOnly) {
        previewOnly = previewOnly || false;

        if (this._opt_playTickerSound) {
            this._sounds.tick.play({ loop: true, volume: this._opt_tickerSoundVolume / 100, preview: previewOnly });
        }
    },

    _stopTickerSound: function() {
        this._sounds.tick.stop();
    },

    /**
     *
     * @param {boolean} [previewOnly=false] only play a preview of the sound?
     * @private
     */
    _playBreakSound: function(previewOnly) {
        previewOnly = previewOnly || false;

        if (this._opt_playBreakSound) {
            this._sounds.break.play({ volume: this._opt_breakSoundVolume / 100, preview: previewOnly });
        }
    },

    /**
     *
     * @param {boolean} [previewOnly=false] only play a preview of the sound?
     * @private
     */
    _playWarnSound: function(previewOnly) {
        previewOnly = previewOnly || false;

        if (this._opt_playWarnSound) {
            this._sounds.warn.play({ volume: this._opt_warnSoundVolume / 100, preview: previewOnly });
        }
    },

    /**
     *
     * @param {boolean} [previewOnly=false] only play a preview of the sound?
     * @private
     */
    _playStartSound: function(previewOnly) {
        previewOnly = previewOnly || false;

        if (this._opt_playStartSound) {
            this._sounds.start.play({ volume: this._opt_startSoundVolume / 100, preview: previewOnly });
        }
    },

    /**
     *
     * @param {(SoundModule.SoundEffect|undefined|null)} soundEffectInstance original SoundEffect instance
     * @param {string} soundPath
     * @returns {SoundModule.SoundEffect}
     * @private
     */
    _loadSoundEffect: function(soundEffectInstance, soundPath) {
        soundPath = SoundModule.addPathIfRelative(soundPath, this._defaultSoundPath);
        if (typeof soundEffectInstance === 'undefined' || soundEffectInstance === null) {
            soundEffectInstance = new SoundModule.SoundEffect(soundPath);
        } else {
            soundEffectInstance.setSoundPath(soundPath);
        }

        return soundEffectInstance;
    },

    _loadSoundEffects: function() {
        if (!SoundModule.isPlayable()) {
            global.logError("Unable to play sound, make sure 'play' is available on your path");
        }

        this._sounds = this._sounds || {};

        this._sounds.tick = this._loadSoundEffect(this._sounds.tick, this._opt_tickerSoundPath);
        this._sounds.break = this._loadSoundEffect(this._sounds.break, this._opt_breakSoundPath);
        this._sounds.warn = this._loadSoundEffect(this._sounds.warn, this._opt_warnSoundPath);
        this._sounds.start = this._loadSoundEffect(this._sounds.start, this._opt_startSoundPath);
    },

    /**
     *
     * @returns {PomodoroMenu}
     * @private
     */
    _createMenu: function(orientation) {
        let menuManager = new PopupMenu.PopupMenuManager(this);
        let menu = new PomodoroMenu(this, orientation);

        menu.connect('start-timer', Lang.bind(this, function() {
            this._timerQueue.preventStart(false);
            this._timerQueue.start();
        }));

        menu.connect('stop-timer', Lang.bind(this, function() {
            this._timerQueue.stop();
            this.set_applet_tooltip("");
        }));

        menu.connect('reset-timer', Lang.bind(this, function() {
            this._timerQueue.reset();
            this._setTimerLabel(0);
            this.set_applet_tooltip("");
        }));

        menu.connect('reset-counts', Lang.bind(this, function() {
            this._numPomodoriFinished = 0;
            this._numPomodoroSetFinished = 0;
            this._appletMenu.updateCounts(0, 0);
            this.set_applet_tooltip("");
        }));

        menu.connect('what-is-this', Lang.bind(this, function() {
            let command = "xdg-open '%s'".format(_("http://en.wikipedia.org/wiki/Pomodoro_Technique"));
            Util.trySpawnCommandLine(command);
        }));

        menuManager.addMenu(menu);

        return menu;
    },

    /**
     *
     * @returns {PomodoroSetFinishedDialog}
     * @private
     */
    _createLongBreakDialog: function() {
        let dialog = new PomodoroSetFinishedDialog();

        dialog.connect('switch-off-pomodoro', Lang.bind(this, function() {
            if (!this._timerQueue.isRunning() && !this._opt_autoStartNewAfterFinish) {
                this._turnOff();
            } else {
                this._timerQueue.stop();
                this._appletMenu.toggleTimerState(false);
                this.set_applet_tooltip("");
            }

            this._longBreakdialog.close();
        }));

        dialog.connect('start-new-pomodoro', Lang.bind(this, function() {
            // skipping the timer will make the timer-queue-finished event fire
            this._timerQueue.skip();

            // if auto start is enabled, the timer will be restarted automatically after the skip
            // so we only need to start new one if it's disabled and the user specifically requested it
            if (!this._opt_autoStartNewAfterFinish) {
                this._longBreakdialog.close();
                this._startNewTimerQueue();
            }
        }));

        dialog.connect('hide', Lang.bind(this, function() {
            if (!this._timerQueue.isRunning() && !this._opt_autoStartNewAfterFinish) {
                // we are not auto starting a new timer and the timer is finished
                // so we'll reset it and turn it off
                this._turnOff();
            }

            this._longBreakdialog.close();
        }));

        return dialog;
    },

    /**
     *
     * @returns {PomodoroBreakFinishedDialog}
     * @private
     */
    _createShortBreakDialog: function() {
        let dialog = new PomodoroBreakFinishedDialog();

        dialog.connect('continue-current-pomodoro', Lang.bind(this, function() {
            this._shortBreakdialog.close();
            this._timerQueue.preventStart(false);
            this._appletMenu.toggleTimerState(true);
            this._timerQueue.start();
        }));

        dialog.connect('pause-pomodoro', Lang.bind(this, function() {
            this._timerQueue.stop();
            this._appletMenu.toggleTimerState(false);
            this.set_applet_tooltip(_("Waiting to start"));

            this._shortBreakdialog.close();
        }));

        return dialog;
    },

    // Setting listeners

    _onAppletIconChanged: function() {
        if (this._opt_displayIconInPanel) {
            this._applet_icon_box.show();
            let appletIconPath = '';
            let appletIconStatus = '';
            switch (this._currentState) {
            case 'pomodoro-stop':
                appletIconPath = this._metadata.path + "/pomodoro-stop";
                appletIconStatus = 'system-status-icon';
                break;
            case 'short-break':
            case 'long-break':
                appletIconPath = this._metadata.path + "/pomodoro-break";
                appletIconStatus = 'system-status-icon success';
                break;
            case 'pomodoro':
            default:
                appletIconPath = this._metadata.path + "/pomodoro";
                appletIconStatus = 'system-status-icon error';
                break;
            }
            if (this._opt_useSymbolicIconInPanel) {
                this.set_applet_icon_symbolic_path(appletIconPath + "-symbolic.svg");
                this._applet_icon.set_style_class_name(appletIconStatus);
            } else {
                this.set_applet_icon_path(appletIconPath + ".png");
            }
        }
        else if (this._applet_icon_box.child) {
            this._applet_icon_box.hide();
        }
    },

    _onShowTimerChanged: function() {
        this._setTimerLabel(this._timerQueue.getCurrentTimer().getTicksRemaining());
    },

    /**
     *
     * @returns {boolean} true if the ticker sound was playing, false otherwise
     * @private
     */
    _onPlayTickedSoundChanged: function() {
        if (!this._timers.pomodoro.isRunning()) {
            return false;
        }

        if (this._opt_playTickerSound) {
            this._playTickerSound();
        }
        else {
            this._stopTickerSound();
        }

        return true;
    },

    // Applet listeners

    on_applet_clicked: function() {
        this._appletMenu.toggle();
    },

    on_applet_removed_from_panel: function() {
        this._resetTimerQueueState();
        this._settingsProvider.finalize();
    }
};

function PomodoroMenu(launcher, orientation) {
    this._init.call(this, launcher, orientation);
}

PomodoroMenu.prototype = {
    __proto__: Applet.AppletPopupMenu.prototype,

    _init: function(launcher, orientation) {
        Applet.AppletPopupMenu.prototype._init.call(this, launcher, orientation);

        this._pomodoroCount = 0;
        this._pomodoroSetCount = 0;

        this._addMenuItems();
        this.updateCounts(0, 0);
    },

    _addMenuItems: function() {

        // "Pomodoro Timer"

        let onoff = new PopupMenu.PopupSwitchMenuItem(_("Pomodoro Timer"), false);
        this._timerToggle = onoff;

        onoff.connect("toggled", Lang.bind(this, function(menuItem, state) {
            state ? this.emit('start-timer') : this.emit('stop-timer');
        }));

        this.addMenuItem(onoff);

        // "Completed"

        let completed = new PopupMenu.PopupMenuItem(_("Completed"), { reactive: false });

        let bin = new St.Bin({ x_align: St.Align.END });

        this._pomodoriCountLabel = new St.Label();
        bin.add_actor(this._pomodoriCountLabel);

        completed.addActor(bin, { expand: true, span: -1, align: St.Align.END });

        this.addMenuItem(completed);

        // "Reset Timer"

        let reset = new PopupMenu.PopupMenuItem(_("Reset Timer"));

        reset.connect('activate', Lang.bind(this, function() {
            this.toggleTimerState(false);

            this.emit('reset-timer');
        }));

        this.addMenuItem(reset);

        // "Reset Counts and Timer"

        let resetAll = new PopupMenu.PopupMenuItem(_("Reset Counts and Timer"));

        resetAll.connect('activate', Lang.bind(this, function() {
            this.toggleTimerState(false);

            this.emit('reset-timer');
            this.emit('reset-counts');
        }));

        this.addMenuItem(resetAll);

        // "What is this?"

        let whatisthis = new PopupMenu.PopupMenuItem(_("What is this?"));

        whatisthis.connect("activate", Lang.bind(this, function() {
            this.emit('what-is-this');
        }));

        this.addMenuItem(whatisthis);
    },

    toggleTimerState: function(state) {
        this._timerToggle.setToggleState(Boolean(state));
    },

    showPomodoroInProgress: function(pomodoriNumber) {
        let text = '';

        if (this._pomodoroSetCount > 0) {
            text = this._pomodoriCountLabel.text;
        }

        if (pomodoriNumber == 4) {
            if (this._pomodoroCount == 0) {
                // \u25cb = white circle
                text += '\u25cb';
            }
            else if (this._pomodoroCount == 1) {
                // \u25d4 = circle with upper right quadrant black
                text += '\u25d4';
            }
            else if (this._pomodoroCount == 2) {
                // \u25d1 = circle with right half black
                text += '\u25d1';
            }
            else if (this._pomodoroCount == 3) {
                // \u25d5 = circle with all but upper left quadrant black
                text += '\u25d5';
            }
            else {
                // \u25cf = black circle
                text += '\u25cf';
            }
        }
        else {
            // \u25d6 = left half black circle
            text += '\u25d6';
        }

        this._pomodoriCountLabel.text = text;
    },

    updateCounts: function(setCount, pomodoroCount) {
        let text;

        this._pomodoroCount = pomodoroCount;
        this._pomodoroSetCount = setCount;

        if (setCount == 0) {
            text = _("None");
        } else {
            // \u25cf = black circle
            text = Array(setCount + 1).join('\u25cf');
        }

        this._pomodoriCountLabel.text = text;
    }
};

function PomodoroSetFinishedDialog() {
    this._init.call(this);
}

PomodoroSetFinishedDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function() {
        ModalDialog.ModalDialog.prototype._init.call(this);

        this._subjectLabel = new St.Label();

        this.contentLayout.add(this._subjectLabel);

        this._timeLabel = new St.Label();

        this.contentLayout.add(this._timeLabel);

        this.setButtons([
            {
                label: _("Switch Off Pomodoro"),
                action: Lang.bind(this, function() {
                    this.emit('switch-off-pomodoro');
                })
            },
            {
                label: _("Start a new Pomodoro"),
                action: Lang.bind(this, function() {
                    this.emit('start-new-pomodoro')
                })
            },
            {
                label: _("Hide"),
                action: Lang.bind(this, function() {
                    this.emit('hide');
                }),
                key: Clutter.Escape
            }
        ]);

        this.setDefaultLabels();
    },

    setDefaultLabels: function() {
        this._subjectLabel.set_text(_("Pomodoro set finished, you deserve a break!") + "\n");
        this._timeLabel.text = '';
    },

    setTimeRemaining: function(timer) {
        let tickCount = timer.getTicksRemaining();

        if (tickCount == 0) {
            this._subjectLabel.text = _("Your break is over, start another pomodoro!") + "\n";
            this._timeLabel.text = '';
            return;
        }

        this._setTimeLabelText(_("A new pomodoro begins in %s.").format(this._getTimeString(tickCount))) + "\n"
    },

    _setTimeLabelText: function(label) {
        this._timeLabel.set_text(label + "\n");
    },

    _getTimeString: function(totalSeconds) {
        let minutes = parseInt(totalSeconds / 60);
        let seconds = parseInt(totalSeconds % 60);

        let min = Gettext.dngettext(UUID, "%d minute", "%d minutes", minutes).format(minutes);
        let sec = Gettext.dngettext(UUID, "%d second", "%d seconds", seconds).format(seconds);

        return _("%s and %s").format(min, sec);
    }
};

function PomodoroBreakFinishedDialog() {
    this._init.call(this);
}

PomodoroBreakFinishedDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function() {
        ModalDialog.ModalDialog.prototype._init.call(this);

        this._subjectLabel = new St.Label();

        this.contentLayout.add(this._subjectLabel);

        this._timeLabel = new St.Label();

        this.contentLayout.add(this._timeLabel);

        this.setButtons([
            {
                label: _("Continue Current Pomodoro"),
                action: Lang.bind(this, function() {
                    this.emit('continue-current-pomodoro')
                })
            },
            {
                label: _("Pause Pomodoro"),
                action: Lang.bind(this, function() {
                    this.emit('pause-pomodoro');
                })
            }
        ]);

        this.setDefaultLabels();
    },

    setDefaultLabels: function() {
        this._subjectLabel.set_text(_("Short break finished, ready to continue?") + "\n");
        this._timeLabel.text = '';
    }
};
