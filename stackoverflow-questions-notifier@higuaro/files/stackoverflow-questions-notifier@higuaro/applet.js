
// Allows importing other files using the following:
//   const StackExchange = imports.stackexchange; // imports file "stackexchange.js"
 imports.searchPath.push( imports.ui.appletManager.appletMeta["stackoverflow-questions-notifier@higuaro"].path );

const Mainloop = imports.mainloop;
const Lang = imports.lang;

// gettext support (although is not used)
const Gettext = imports.gettext.domain('cinnamon-applets');
const _ = Gettext.gettext;

const Applet = imports.ui.applet;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;

const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;

const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;

const StackExchange = imports.stackexchange;

const APPLET_ICON = global.userdatadir + '/applets/stackoverflow-questions-notifier@higuaro/icon.png';
const DISABLED_APPLET_ICON = global.userdatadir + '/applets/stackoverflow-questions-notifier@higuaro/icon_disabled.png';
const WAITING_APPLET_ICON = global.userdatadir + '/applets/stackoverflow-questions-notifier@higuaro/icon_waiting.png';
const ERROR_APPLET_ICON = global.userdatadir + '/applets/stackoverflow-questions-notifier@higuaro/icon_error.png';
const TAG_SEPARATOR = ',';
const MINUTE  = 60000;
const KEY = 'd*vHvq4QJPzmX32nQWspOw((';

/* Main */
function main(metadata, orientation, instance_id) {
    return new MyApplet(metadata, orientation, instance_id);
}

/* Constructor */
function MyApplet(metadata, orientation, instance_id) {
    this._debugEnabled = false;
    this._checkForQuestions = true;
    this._cooldownMode = false;
    this._init(metadata, orientation, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, instance_id);

        this._stackoverflow = this._createStackOverflowApiObject();

        this._bindSettings(metadata, instance_id);
        this._readSettingsValues();
        
        try {
            this.enableApplet();
            this.startTimer();
        } catch (e) {
            global.logError(e);
        }
    },
    
    _bindSettings: function(metadata, instance_id) {
        // Create the settings object 
        this._settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        
        // Full description of the BindingDirection can be found at:
        // https://github.com/linuxmint/Cinnamon/wiki/Applet,-Desklet-and-Extension-Settings-Reference    
    
        this._settings.bindProperty(Settings.BindingDirection.IN,   // The binding direction - IN means we only listen for changes from this applet
                         'txtTagList',                              // The key of the UI control associated with the setting in the "settings-schema.json" file
                         'txtTagList',                              // name that is going to be used as the applet property
                         this.onSettingsChanged,
                         null);
    
        this._settings.bindProperty(Settings.BindingDirection.IN,
                         'scaQueryFrecuency',
                         'scaQueryFrecuency',
                         this.onSettingsChanged,
                         null);                                                                        
    },    
    
    _createStackOverflowApiObject: function() {
        try {
            var options = {};
            options.site = 'stackoverflow';
            options.debug = this._debugEnabled;
            options.key = KEY;

            return new StackExchange.StackExchange(options);
        } catch(e) {
            this.onGeneralError(e);
        }
    },   
    
    _log: function(msg) {
        if (this._debugEnabled) { 
            global.log(msg);
        }
    },
    
    _getTimeoutSetting: function() {
        return parseInt(this._settings.getValue('scaQueryFrecuency'), 10) || 5;
    },

    _readSettingsValues: function() {
        this._log('Reading settings...');
        let txtTagList = this._settings.getValue('txtTagList');

        let tags = txtTagList.split(TAG_SEPARATOR).map(function(tag) { 
             return tag.trim();
        });

        // Remove duplicated tags
        tags = tags.reduce(function(prev, current) {
            let exists = false;
            let size = prev.length;
            for (let i = 0; i < size; i++) {
                if (prev[i] === current) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                prev.push(current);   
            }
            return prev;
        }, []);

        this._log('The new tag list is: ' + tags);
        this._stackoverflow.setTagList(tags);

        let timeout = this._getTimeoutSetting();
        this._stackoverflow.setTimeout(timeout);
        this._log('The new timeout is:' + timeout);
    },
    
    _openUrlInBrowser: function(url) {
        Util.spawnCommandLine('xdg-open ' + url);
    },

    _getTimeoutString: function(minutes) {
        let hours = Math.floor(minutes / 60);
        if (hours) {
            let minutesAfterHour = minutes % 60;
            return hours + 'h ' + minutesAfterHour + 'min';
        }
        return minutes + 'min';
    },

    on_applet_removed_from_panel: function(event) {
        this._log('Removing the applet from the panel');
        this.stopTimer();
    },

    disableApplet: function() {
        this.set_applet_icon_path(DISABLED_APPLET_ICON);
        this.set_applet_tooltip(_('Click here to turn \nquestion notifications on'));
    },

    enableApplet: function() {
        this.set_applet_icon_path(APPLET_ICON);
        this.set_applet_tooltip(_('Click here to turn\nquestion notifications off'));
    },

    on_applet_clicked: function(event) {
        if (this._cooldownMode) {
            this._log('Click event ignored as cooldown mode is active');
            return;
        }
    
        this._checkForQuestions = !this._checkForQuestions;

        this.stopTimer();
        if (this._checkForQuestions) {
            this._log('Questions checking enabled');
            this.enableApplet();

            this.startTimer();
        } else {
            this._log('Questions checking disabled');
            this.disableApplet();
        }
    },
    
    onGeneralError: function(e) {
        this._log('An error ocurred: ' + e);
        this.stopTimer();
        
        if (this._checkForQuestions) {
            this._checkForQuestions = false;
            this.set_applet_icon_path(ERROR_APPLET_ICON);
            global.logError(e);
            this.set_applet_tooltip(_('An error ocurred, click to start checking questions again'));
            Util.spawnCommandLine('notify-send -t 5 --icon=error "Stackoverflow Notifier Applet - Unexpected Error" "Error details:\n' + e + '"');
        }
    },

    onThrottleError: function(timeout) {
        this._cooldownMode = true;
        this.set_applet_icon_path(WAITING_APPLET_ICON);
        this._log('Got ' + timeout + ' timeout seconds');
        let minutes = Math.round(timeout / MINUTE) + 1;
        this._log('Have to wait ' + minutes + ' minutes before next API call');
        this.startCooldownTimer(minutes);
    },

    startCooldownTimer: function(timeout) {
        this._throttleTimeout = timeout;
        
        this.set_applet_tooltip(_('Max # of API calls reached, service will be back after ' + 
                                   this._getTimeoutString(this._throttleTimeout)));

        let timerCallback = Lang.bind(this, function() {
            this.onCooldownTimer();
        });
        
        this._timerId = Mainloop.timeout_add(MINUTE, timerCallback);
    },

    onCooldownTimer: function() {
        this.stopTimer();
        
        if (this._throttleTimeout <= 1) {
            this._cooldownMode = false;
            this.enableApplet();
            this.startTimer();
        } else {
            this.startCooldownTimer(this._throttleTimeout - 1);
        }
    },

    startTimer: function() {
        this._log('Starting timer...');

        let timeout = this._getTimeoutSetting();
        let timerCallback = Lang.bind(this, function() {
            this.onTimer();
        });
        this._timerId = Mainloop.timeout_add(timeout * MINUTE, timerCallback);
    },

    stopTimer: function() {
        if (this._timerId) {
            // stop the current running timer
            this._log('Stopping timer...');
            Mainloop.source_remove(this._timerId);
            this._timerId = 0;
        }        
    },

    onTimer: function() {
        this.checkNewQuestions();
    },

    checkNewQuestions: function() {
        let successCallback = Lang.bind(this, function(questions) {
            this.showNewQuestions(questions);
        });
        
        let errorCallback = Lang.bind(this, function(e) {
            this.onGeneralError(e);
        });
        
        let throttleErrorCallback = Lang.bind(this, function(timeout) {
            this.onThrottleError(timeout);
        });

        this._stackoverflow.loadNewQuestions(successCallback, errorCallback, throttleErrorCallback);        
    },
    
    showNewQuestions: function(questions) {
        let showQuestionPopup = Lang.bind(this, function(question) {
            // Show a notification box for every new question
            let command = StackExchange.StackExchange.getQuestionPopupCommand(APPLET_ICON, question);
            this._log('Command: ' + command);
            Util.spawnCommandLine(command);
        });

        questions.forEach(showQuestionPopup);
        this.stopTimer();
        this.startTimer();
    },

    onSettingsChanged: function() {
        this._log('Settings have changed!');
        if (this._checkForQuestions) {
            this.stopTimer();
            this._readSettingsValues();
            this.startTimer();
        }
    },

    onOpenStackoverflowPressed: function(event)  {
        this._openUrlInBrowser('http://stackoverflow.com/');
    },

    onOpenCinnamonHomePressed: function(event) { 
        this._openUrlInBrowser('http://cinnamon-spices.linuxmint.com/applets/view/224');
    },

    onOpenDevPagePressed: function(event) {
        this._openUrlInBrowser('http://geekofficedog.blogspot.com/');
    }
};
