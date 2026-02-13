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

const BUTTON_TOOLTIPS = {
    START: _('Start'),
    RESUME: _('Resume'),
    PAUSE: _('Pause'),
    RESET: _('Reset'),
    CLEAR: _('Clear')
};

// Found in /usr/share/icons/<theme-name>/symbolic/
const ICON_NAMES = {
    START: 'media-playback-start-symbolic',
    PAUSE: 'media-playback-pause-symbolic',
    STOP: 'media-playback-stop-symbolic',
    INCR: 'go-up-symbolic',
    DECR: 'go-down-symbolic',
    RESET: 'object-rotate-right-symbolic',
    CLEAR: 'user-trash-symbolic'
};

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

const CLOCK_STYLES = {
    DEFAULT: 'margin: 0 10px 10px 10px;',
    ACTIVE: 'margin: 10px 10px 20px 10px;',
    DIGIT_DEFAULT: 'margin: 0 10px 10px 10px;',
    DIGIT_ACTIVE: 'margin: 10px 10px 20px 10px;',
    BUTTON: 'width: 20px; padding: 10px 0;'
}

const CONTROL_BUTTON_STYLE = 'width: 40px; padding: 10px;';
const FONT_SIZE = '24px';

const APPLET_ICON_NAME = 'alarm';
const APPLET_ICON_GREEN = '#00d173';
const APPLET_ICON_TOOLTIP = _('Simple Timer');