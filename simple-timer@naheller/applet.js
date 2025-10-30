const Lang = imports.lang;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Tooltips = imports.ui.tooltips;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = 'simple-timer@naheller';

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

function _(str) {
    return Gettext.dgettext(UUID, str);
}

const TIMER_INTERVAL_MS = 1000;

const ONE_MIN_IN_SECONDS = 60;
const ONE_HOUR_IN_SECONDS = ONE_MIN_IN_SECONDS * 60;
const ONE_DAY_IN_SECONDS = ONE_HOUR_IN_SECONDS * 24;

const BUTTON_TOOLTIP_START = _('Start');
const BUTTON_TOOLTIP_RESUME = _('Resume');
const BUTTON_TOOLTIP_PAUSE = _('Pause');
const BUTTON_TOOLTIP_RESET = _('Reset');
const BUTTON_TOOLTIP_CLEAR = _('Clear');

// Found in /usr/share/icons/<theme-name>/symbolic/
const ICON_NAME_START = 'media-playback-start-symbolic';
const ICON_NAME_PAUSE = 'media-playback-pause-symbolic';
const ICON_NAME_STOP = 'media-playback-stop-symbolic';
const ICON_NAME_INCR = 'go-up-symbolic';
const ICON_NAME_DECR = 'go-down-symbolic';
const ICON_NAME_RESET = 'object-rotate-right-symbolic';
const ICON_NAME_CLEAR = 'user-trash-symbolic';

const ICON_SIZE_LG = 20;
const ICON_SIZE_SM = 12;

const NOTIFICATION_TITLE = _('Timer');
const NOTIFICATION_MSG = _('Your timer is finished');

const DIGIT_NAMES = {
    SECOND_TENS: 'SECOND_TENS',
    SECOND_ONES: 'SECOND_ONES',
    MINUTE_TENS: 'MINUTE_TENS',
    MINUTE_ONES: 'MINUTE_ONES',
    HOUR_TENS: 'HOUR_TENS',
    HOUR_ONES: 'HOUR_ONES'
};

const CLOCK_INCREMENT = 'INCREMENT';
const CLOCK_DECREMENT = 'DECREMENT';

const CLOCK_STYLE = 'margin: 0 10px 10px 10px;'
const CLOCK_STYLE_ACTIVE = 'margin: 10px 10px 20px 10px;';
const CLOCK_DIGIT_STYLE = 'margin: 0 10px 10px 10px;'
const CLOCK_DIGIT_STYLE_ACTIVE = 'margin: 10px 10px 20px 10px;';
const CLOCK_BUTTON_STYLE = 'width: 20px; padding: 10px 0;';
const CONTROL_BUTTON_STYLE = 'width: 40px; padding: 10px;';
const FONT_SIZE = '22px';


function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        try {
            this.set_applet_icon_symbolic_name('alarm');
            this.set_applet_tooltip(_('Simple Timer'));

            this.timerId = null;
            this.timerInitialSec = this.timerCurrentSec = 0;

            this.notificationSource = null;
            this.addNotificationSource();

            this.buildPopupMenu();
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked(event) {
        this.menu.toggle();
    },

    on_applet_removed_from_panel() {
        if (!!this.timerId) {
            this.clearTimerInterval();
        }
    },

    buildPopupMenu() {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this._orientation);

        const menuSection = new PopupMenu.PopupMenuSection({ style_class: 'popup-menu-section' });

        this.clock = this.getClock();
        this.controlBar = this.getControlBar();
        
        menuSection.actor.add_actor(this.clock);
        menuSection.actor.add_actor(this.controlBar);
        
        this.menu.addMenuItem(menuSection);

        this.menuManager.addMenu(this.menu);
    },

    getClock() {
        const {
            secondTensColumn,
            secondOnesColumn,
            minuteOnesColumn,
            minuteTensColumn,
            hourOnesColumn,
            hourTensColumn
        } = this.getClockElements();

        const clockBox = new St.BoxLayout({
            name: 'clock',
            x_align: Clutter.ActorAlign.CENTER,
            style: CLOCK_STYLE
        });

        clockBox.add_child(hourTensColumn);
        clockBox.add_child(hourOnesColumn);
        clockBox.add_child(getClockDigit(':'));
        clockBox.add_child(minuteTensColumn);
        clockBox.add_child(minuteOnesColumn);
        clockBox.add_child(getClockDigit(':'));
        clockBox.add_child(secondTensColumn);
        clockBox.add_child(secondOnesColumn);

        return clockBox;
    },

    getClockElements() {
        const {
            SECOND_TENS,
            SECOND_ONES,
            MINUTE_TENS,
            MINUTE_ONES,
            HOUR_TENS,
            HOUR_ONES
        } = DIGIT_NAMES;

        const {
            secondOnes,
            secondTens,
            minuteOnes,
            minuteTens,
            hourOnes,
            hourTens
        } = getClockValuesFromSeconds(this.timerInitialSec);

        const secondTensColumn = this.getClockColumn(SECOND_TENS, secondTens);
        const secondOnesColumn = this.getClockColumn(SECOND_ONES, secondOnes);
        const minuteTensColumn = this.getClockColumn(MINUTE_TENS, minuteTens);
        const minuteOnesColumn = this.getClockColumn(MINUTE_ONES, minuteOnes);
        const hourTensColumn = this.getClockColumn(HOUR_TENS, hourTens);
        const hourOnesColumn = this.getClockColumn(HOUR_ONES, hourOnes);

        return {
            secondTensColumn,
            secondOnesColumn,
            minuteOnesColumn,
            minuteTensColumn,
            hourOnesColumn,
            hourTensColumn
        }
    },

    getClockColumn(digitName, digitValue) {

        const iconIncrement = getIcon(ICON_NAME_INCR, ICON_SIZE_SM);
        const iconDecrement = getIcon(ICON_NAME_DECR, ICON_SIZE_SM);

        const incrementButtonName = `${DIGIT_NAMES[digitName]}_INC`;
        const decrementButtonName = `${DIGIT_NAMES[digitName]}_DEC`;

        // Set buttons instance level so they can be shown/hidden later
        this[incrementButtonName] = getButton(iconIncrement, CLOCK_BUTTON_STYLE);
        this[incrementButtonName].connect('clicked', () => {
            this.adjustClockDigit(CLOCK_INCREMENT, digitName);
        });

        this[decrementButtonName] = getButton(iconDecrement, CLOCK_BUTTON_STYLE);
        this[decrementButtonName].connect('clicked', () => {
            this.adjustClockDigit(CLOCK_DECREMENT, digitName);
        });

        // Set digit on instance level so it can be updated later
        this[digitName] = getClockDigit(`${digitValue}`);

        const column = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        column.add_child(this[incrementButtonName]);
        column.add_child(this[digitName]);
        column.add_child(this[decrementButtonName]);

        return column;
    },

    getControlBar() {
        const iconStart = getIcon(ICON_NAME_START, ICON_SIZE_LG);
        const iconClear = getIcon(ICON_NAME_CLEAR, ICON_SIZE_LG);
        const iconReset = getIcon(ICON_NAME_RESET, ICON_SIZE_LG);

        this.startPauseButton = getButton(iconStart, CONTROL_BUTTON_STYLE, true);
        this.resetButton = getButton(iconReset, CONTROL_BUTTON_STYLE);
        this.clearButton = getButton(iconClear, CONTROL_BUTTON_STYLE);

        // Click behavior

        this.startPauseButton.connect('clicked', (button) => {
            if (button.checked) {
                this.startTimer();
            } else {
                this.pauseTimer();
            }
        });

        this.resetButton.connect('clicked', (button) => {
            this.resetTimer();
        });

        this.clearButton.connect('clicked', (button) => {
            this.clearTimer();
        });

        // Tooltips

        this.startPauseButton.tooltip = new Tooltips.Tooltip(this.startPauseButton)
        this.startPauseButton.tooltip.set_text(BUTTON_TOOLTIP_START)

        this.resetButton.tooltip = new Tooltips.Tooltip(this.resetButton)
        this.resetButton.tooltip.set_text(BUTTON_TOOLTIP_RESET)

        this.clearButton.tooltip = new Tooltips.Tooltip(this.clearButton)
        this.clearButton.tooltip.set_text(BUTTON_TOOLTIP_CLEAR)

        const controlBar = new St.BoxLayout({
            x_align: Clutter.ActorAlign.CENTER
        });

        controlBar.add_child(this.startPauseButton);
        controlBar.add_child(this.resetButton);
        controlBar.add_child(this.clearButton);

        return controlBar;
    },

    showAllClockAdjustButtons() {
        Object.keys(DIGIT_NAMES).forEach(digitName => {
            this[`${digitName}_INC`].show();
            this[`${digitName}_DEC`].show();
        });
    },

    hideAllClockAdjustButtons() {
        Object.keys(DIGIT_NAMES).forEach(digitName => {
            this[`${digitName}_INC`].hide();
            this[`${digitName}_DEC`].hide();
        });
    },

    addNotificationSource() {
        this.notificationSource = new MessageTray.SystemNotificationSource();
        Main.messageTray.add(this.notificationSource);
    },

    showNotification(msg) {
        let notification = new MessageTray.Notification(this.notificationSource, NOTIFICATION_TITLE, msg);
        this.notificationSource.notify(notification);
    },

    startTimer() {
        if (this.timerId !== null) return;

        this.timerId = setInterval(
            () => {
                if (this.timerCurrentSec > 0) {
                    this.tickTimer();
                } else {
                    this.resetTimer();
                    this.showNotification(NOTIFICATION_MSG);
                }
            },
            TIMER_INTERVAL_MS
        );

        this.startPauseButton.child.set_icon_name(ICON_NAME_PAUSE);
        this.clock.set_style(CLOCK_STYLE_ACTIVE);
        this.startPauseButton.tooltip.set_text(BUTTON_TOOLTIP_PAUSE);
        this.hideAllClockAdjustButtons();
    },

    pauseTimer() {
        if (this.timerId === null) {
            return;
        }

        this.clearTimerInterval();
        this.startPauseButton.child.set_icon_name(ICON_NAME_START);
        this.clock.set_style(CLOCK_STYLE)
        this.showAllClockAdjustButtons();
        this.startPauseButton.tooltip.set_text(BUTTON_TOOLTIP_RESUME)
    },

    resetTimer() {
        if (this.timerId !== null) {
            this.clearTimerInterval();
        }

        this.timerCurrentSec = this.timerInitialSec;

        this.updateClockText();
        this.startPauseButton.set_checked(false);
        this.startPauseButton.child.set_icon_name(ICON_NAME_START);
        this.clock.set_style(CLOCK_STYLE)
        this.showAllClockAdjustButtons();
        this.startPauseButton.tooltip.set_text(BUTTON_TOOLTIP_START)
    },

    clearTimer() {
        this.timerCurrentSec = this.timerInitialSec = 0;
        this.resetTimer();
    },

    tickTimer() {
        --this.timerCurrentSec;
        this.updateClockText();
    },

    clearTimerInterval() {
        clearInterval(this.timerId);
        this.timerId = null;
    },

    updateClockText() {
        const clockString = getClockStringFromSeconds(this.timerCurrentSec);
        this.set_applet_tooltip(clockString);

        const {
            SECOND_TENS,
            SECOND_ONES,
            MINUTE_TENS,
            MINUTE_ONES,
            HOUR_TENS,
            HOUR_ONES
        } = DIGIT_NAMES;

        const {
            secondOnes,
            secondTens,
            minuteOnes,
            minuteTens,
            hourOnes,
            hourTens
        } = getClockValuesFromSeconds(this.timerCurrentSec);

        this[HOUR_TENS].child.set_text(`${hourTens}`);
        this[HOUR_ONES].child.set_text(`${hourOnes}`);
        this[MINUTE_TENS].child.set_text(`${minuteTens}`);
        this[MINUTE_ONES].child.set_text(`${minuteOnes}`);
        this[SECOND_TENS].child.set_text(`${secondTens}`);
        this[SECOND_ONES].child.set_text(`${secondOnes}`);

        // Disable startPauseButton when timer is at 0
        this.startPauseButton.reactive = this.timerCurrentSec != 0;
    },

    adjustClockDigit(adjustmentType, digitName) {
        const {
            SECOND_TENS,
            SECOND_ONES,
            MINUTE_TENS,
            MINUTE_ONES,
            HOUR_TENS,
            HOUR_ONES
        } = DIGIT_NAMES;

        const digitToSeconds = {
            [HOUR_TENS]: ONE_HOUR_IN_SECONDS * 10,
            [HOUR_ONES]: ONE_HOUR_IN_SECONDS,
            [MINUTE_TENS]: ONE_MIN_IN_SECONDS * 10,
            [MINUTE_ONES]: ONE_MIN_IN_SECONDS,
            [SECOND_TENS]: 10,
            [SECOND_ONES]: 1
        };

        const secondsDelta = digitToSeconds[DIGIT_NAMES[digitName]];

        if (adjustmentType === CLOCK_INCREMENT) {
            const newSecondsValue = this.timerCurrentSec + secondsDelta;
            if (newSecondsValue <= ONE_DAY_IN_SECONDS) {
                this.timerCurrentSec = this.timerInitialSec = newSecondsValue;
            }
        } else if (adjustmentType === CLOCK_DECREMENT) {
            const newSecondsValue = this.timerCurrentSec - secondsDelta;
            if (newSecondsValue >= 0) {
                this.timerCurrentSec = this.timerInitialSec = newSecondsValue;
            }
        }

        this.updateClockText();
    }
};

function getClockStringFromSeconds(totalSeconds) {
    let [hourStr, minStr, secStr] = ['', '00:', '00'];
    let remainder = totalSeconds;

    if (remainder >= ONE_HOUR_IN_SECONDS) {
        const quotient = Math.floor(remainder / ONE_HOUR_IN_SECONDS);
        remainder %= ONE_HOUR_IN_SECONDS;
        hourStr = `${quotient}:`;
    }

    if (remainder >= ONE_MIN_IN_SECONDS) {
        const quotient = Math.floor(remainder / ONE_MIN_IN_SECONDS);
        const padding = (!!hourStr && quotient < 10) ? '0' : '';
        remainder %= ONE_MIN_IN_SECONDS;
        minStr = `${padding}${quotient}:`;
    }

    if (remainder >= 0) {
        const padding = (!!minStr && remainder < 10) ? '0' : '';
        secStr = `${padding}${remainder}`;
    }

    return hourStr + minStr + secStr;
}

function getClockValuesFromSeconds(totalSeconds) {
    let [
        secondOnes,
        secondTens,
        minuteOnes,
        minuteTens,
        hourOnes,
        hourTens
    ] = [0, 0, 0, 0, 0, 0];

    let remainder = totalSeconds;

    if (remainder >= ONE_HOUR_IN_SECONDS) {
        const quotient = Math.floor(remainder / ONE_HOUR_IN_SECONDS);
        remainder %= ONE_HOUR_IN_SECONDS;

        if (quotient > 9) {
            const numString = String(quotient);
            hourTens = Number(numString[0]);
            hourOnes = Number(numString[1]);
        } else {
            hourOnes = quotient;
        }
    }

    if (remainder >= ONE_MIN_IN_SECONDS) {
        const quotient = Math.floor(remainder / ONE_MIN_IN_SECONDS);
        remainder %= ONE_MIN_IN_SECONDS;
        
        if (quotient > 9) {
            const numString = String(quotient);
            minuteTens = Number(numString[0]);
            minuteOnes = Number(numString[1]);
        } else {
            minuteOnes = quotient;
        }
    }

    if (remainder >= 0) {
        if (remainder > 9) {
            const numString = String(remainder);
            secondTens = Number(numString[0]);
            secondOnes = Number(numString[1]);
        } else {
            secondOnes = remainder;
        }
    }

    return {
        secondOnes,
        secondTens,
        minuteOnes,
        minuteTens,
        hourOnes,
        hourTens
    };
}

function getSecondsFromClockString(hourStr, minStr, secStr) {
    const hourSeconds = Number(hourStr) * ONE_HOUR_IN_SECONDS;
    const minSeconds = Number(minStr) * ONE_MIN_IN_SECONDS;
    const seconds = Number(secStr);

    return hourSeconds + minSeconds + seconds;
}

function setInterval(callback, ms) {
    let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        callback.call(null);
        return true;
    });
    return id;
}

function clearInterval(id) {
    if (id) {
      GLib.source_remove(id);
    }
};

function getIcon(name, size) {
    return new St.Icon({
        icon_type: St.IconType.SYMBOLIC,
        icon_name: name,
        icon_size: size,
    })
}

function getButton(iconName, style = '', isToggle = false) {
    const button = new St.Button({
        toggle_mode: isToggle,
        reactive: true,
        can_focus: true,
        track_hover: true,
        style_class: 'popup-menu-item',
        style,
        child: iconName
    });

    return button;
}

function getClockDigit(text) {
    const label = new St.Label({
        text,
        style: 'font-size: 22px;',
    });

    const bin = new St.Bin({
        style: 'width: 15px;',
    });
    bin.set_child(label);

    return bin;
}

function getClockColon() {
    const label = new St.Label({
        text: ':',
        style: `font-size: ${FONT_SIZE};`,
    });

    const bin = new St.Bin();
    bin.set_child(label);

    return bin;
}

function main(metadata, orientation, panelHeight, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instanceId);
    return myApplet;
}