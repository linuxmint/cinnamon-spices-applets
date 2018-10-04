const Applet = imports.ui.applet;
const Util = imports.misc.util;

const Lang = imports.lang
// http://developer.gnome.org/glib/unstable/glib-The-Main-Event-Loop.html
const Mainloop = imports.mainloop
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk
const Json = imports.gi.Json

const PopupMenu = imports.ui.popupMenu
const Settings = imports.ui.settings

// http://developer.gnome.org/st/stable/
const St = imports.gi.St

// http://developer.gnome.org/libsoup/stable/libsoup-client-howto.html
const Soup = imports.gi.Soup

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;

const UUID = "jenkins@backuity.org"


// Settings keys
//----------------------------------

const JENKINS_REFRESH_INTERVAL = 'refreshInterval'
const JENKINS_SSL_STRICT = 'sslStrict'
const JENKINS_URL = 'jenkinsUrl'
const JENKINS_FILTER = 'jenkinsFilter'
const JENKINS_USERNAME = 'jenkinsUsername'
const JENKINS_PASSWORD = 'jenkinsPassword'
const JENKINS_MAX_NUMBER_OF_JOBS = 'maxNumberOfJobs'
const JENKINS_HIDE_SUCCESSFUL_JOBS = 'hideSuccessfulJobs'
const JENKINS_HIDE_DISABLED_JOBS = 'hideDisabledJobs'
const JENKINS_SHOW_NOTIFICATION_FOR_FAILED_JOBS = 'showNotificationForFailedJobs'

const KEYS = [
  JENKINS_REFRESH_INTERVAL,
  JENKINS_MAX_NUMBER_OF_JOBS,
  JENKINS_HIDE_SUCCESSFUL_JOBS,
  JENKINS_HIDE_DISABLED_JOBS,
  JENKINS_SHOW_NOTIFICATION_FOR_FAILED_JOBS,
  JENKINS_SSL_STRICT,
  JENKINS_URL,
  JENKINS_FILTER,
  JENKINS_USERNAME,
  JENKINS_PASSWORD
]

// Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64)
const _httpSession = new Soup.Session()
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault())

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this.settings = new Settings.AppletSettings(this, UUID, instance_id);
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        Gtk.IconTheme.get_default().append_search_path(metadata.path);

        // Interface: TextIconApplet
        this.set_applet_icon_name('jenkins-grey');
        this.set_applet_label('...');
        this.set_applet_tooltip(_('Jenkins status'));

        this.lastCheckJobSuccess = {};

        this.assignMessageSource();

        // bind settings
        //----------------------------------

        for (let k in KEYS) {
            let key = KEYS[k]
            let keyProp = "_" + key
            this.settings.bindProperty(Settings.BindingDirection.IN, key, keyProp,
                                       this.refreshAndRebuild, null)
        }

        // http auth if needed
        //----------------------------------

        let applet = this;
        _httpSession.connect("authenticate",function(session,message,auth,retrying) {
            global.log("Authenticating with " + applet._jenkinsUsername);
            auth.authenticate(applet._jenkinsUsername, applet._jenkinsPassword);
        });

        // PopupMenu
        //----------------------------------

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.initialMenuItem = new PopupMenu.PopupMenuItem(_('Loading jobs...'));
        this.menu.addMenuItem(this.initialMenuItem);
      }

    , assignMessageSource: function() {
        if (!this.messageSource) {
            this.messageSource = new MessageTray.SystemNotificationSource();
            if (Main.messageTray) Main.messageTray.add(this.messageSource);
        }
    }

    , pinFailNotification: function(jobName) {
        let icon = new St.Icon({ icon_name: 'dialog-error',
                             icon_type: St.IconType.FULLCOLOR,
                             icon_size: 36 });
        let notification = new MessageTray.Notification(this.messageSource, 'Jenkins-Job failed', 'The job ' + jobName + ', which has been successful last check, failed.', { icon: icon });
        notification.setTransient(false);
        notification.setResident(true);
        notification.setUrgency(MessageTray.Urgency.CRITICAL);
        this.messageSource.notify(notification);
    }

    , on_applet_clicked: function() {
        this.menu.toggle();
    }

    , on_applet_added_to_panel: function() {
        this.running = true;
        Mainloop.timeout_add_seconds(3, Lang.bind(this, function mainloopTimeout() {
          this.refreshBuildStatuses(true)
        }))

    }

    , on_applet_removed_from_panel: function() {
        this.running = false;
    }

    , refreshAndRebuild: function() {
        refreshBuildStatuses(false);
    }

    , refreshBuildStatuses: function(recurse) {
        if (!this.running) {
            return;
        }

        let applet = this;
        this.loadJsonAsync(this.jenkinsUrl(), function(json) {
            applet.destroyMenu();
            try {
                let maxJobs = applet._maxNumberOfJobs;
                let jobs = json.get_array_member('jobs').get_elements();
                let displayedJobs = 0;

                let filteredJobs = [];
                for (let i = 0; i < jobs.length && displayedJobs < maxJobs; i++) {
                    let job = jobs[i].get_object();

                    let color = job.get_string_member('color');

                    let success = this.helpers().isColorSuccess(color);
                    let hideSuccessfulJobs = applet._hideSuccessfulJobs;
                    if (success && hideSuccessfulJobs) {
                        continue;
                    }

                    let disabled = this.helpers().isColorDisabled(color);
                    let hideDisabledJobs = applet._hideDisabledJobs;
                    if (disabled && hideDisabledJobs) {
                        continue;
                    }

                    let jobName = job.get_string_member('name');
                    let url = job.get_string_member('url');

                    var regex = RegExp(this._jenkinsFilter);
                    if(regex.exec(jobName)) {
                        filteredJobs.push(jobs[i]);
                        applet.menu.addMenuItem(new JobMenuItem(jobName, color, url));
                        displayedJobs++;
                    }
                }
                let success = applet.countSuccesses(filteredJobs);
                let failure = filteredJobs.length - success;

                applet.updateAppletLabel(failure, success);

                if (success < filteredJobs.length) {
                    applet.set_applet_icon_name('jenkins-red');
                } else {
                    applet.set_applet_icon_name('jenkins-green');
                }


                applet.displayNewlyFailedJobs(filteredJobs);

            } catch(error) {
                applet.set_applet_icon_name('jenkins-grey');
                applet.set_applet_label('!');
                global.logError(error.message)
                applet.menu.addMenuItem(new PopupMenu.PopupMenuItem(error.message));
            }
        })

        if (recurse) {
            Mainloop.timeout_add_seconds(this._refreshInterval, Lang.bind(this, function() {
                this.refreshBuildStatuses(true)
            }))
        }
    }

    , displayNewlyFailedJobs: function(jobs) {
        if (!this._showNotificationForFailedJobs) {
            return;
        }

        for (let i = 0; i < jobs.length; i ++) {
            let job = jobs[i].get_object();

            let color = job.get_string_member('color');
            let success = this.helpers().isColorSuccess(color);
            let jobName = job.get_string_member('name');

            if (success) {
                this.lastCheckJobSuccess[jobName] = true;
                continue;
            }

            if (jobName in this.lastCheckJobSuccess && this.lastCheckJobSuccess[jobName]) {
                this.pinFailNotification(jobName);
            }
            this.lastCheckJobSuccess[jobName] = false;
        }
    }

    , countSuccesses: function(jobs) {
        let success = 0;
        for (let i = 0; i < jobs.length; i ++) {
            let color = jobs[i].get_object().get_string_member('color');
            if (this.helpers().isColorSuccess(color)) {
                success += 1;
            }
        }
        return success;
    }

    , helpers: function() {
        return new Helpers()
    }

    , updateAppletLabel: function(failure, success) {
        let appletLabel = '';
        let appletTooltip = '';

        if( failure > 0 ) {
            appletLabel += failure + '\u2717'
            appletTooltip += failure + " failing jobs"
        }
        if( success > 0 && failure > 0 ) {
            appletLabel += ' '
            appletTooltip += ' / '
        }
        if( success > 0 ) {
            appletLabel += success + '\u2713'
            appletTooltip += success + " successful jobs"
        }

        this.set_applet_label(appletLabel);
        this.set_applet_tooltip(appletTooltip);
    }

    , destroyMenu: function() {
        this.menu.removeAll();
    }

    , jenkinsUrl: function() {
        let output =  this._jenkinsUrl + '/api/json';
        return output;
    }

    , loadJsonAsync: function(url, callback) {
        let applet = this;
        let message = Soup.Message.new('GET', url);
        if (this._jenkinsUsername && this._jenkinsPassword) {
          let encoded = GLib.base64_encode(this._jenkinsUsername + ':' + this._jenkinsPassword);
          message.request_headers.append('Authorization', 'Basic ' + encoded);
        }
        _httpSession.ssl_strict = this._sslStrict;
        if (!message) {
            if (this.initialMenuItem) this.initialMenuItem.label.set_text(_('No jobs'));
            return;
        }
        _httpSession.queue_message(message, function soupQueue(session, message) {

            if( message.status_code != 200 ) {
                global.logError("Got status " + message.status_code + " " + message.response_body.data);
                applet.destroyMenu();
                this.initialMenuItem = null;
                applet.set_applet_label('!');
                applet.set_applet_icon_name('jenkins-grey');

                let errorMsg = message.reason_phrase || '';
                if( message.reason_phrase && message.response_body.data ) {
                    errorMsg += '\n\n';
                }
                errorMsg += message.response_body.data || '';
                errorMsg = errorMsg || _('Unknown error');
                applet.menu.addMenuItem(new PopupMenu.PopupMenuItem(errorMsg));
            } else {
                let jp = new Json.Parser()
                jp.load_from_data(message.response_body.data, -1)
                callback.call(applet, jp.get_root().get_object())
            }
        })
    }
};


function JobMenuItem(name, color, url) {
    this._init(name, color, url);
}

JobMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    helpers: function () {
        return new Helpers();
    },

    _init: function(name, color, url) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.label = new St.Label({ text: name });
        this.addActor(this.label);

        let iconName = this.helpers().getIconName(color)
        let statusIcon = new St.Icon({ icon_name: iconName, icon_type: St.IconType.FULLCOLOR, style_class: 'popup-menu-icon' });
        this.addActor(statusIcon);

        this.connect('activate', Lang.bind(this, function (menuItem, event) {
            Util.spawnCommandLine("xdg-open " + url);
        }));
    }
};


function Helpers() {}
Helpers.prototype = {

    isColorSuccess: function (color) {
        return color == 'blue' || color == 'blue_anime';
    },

    isColorFailure: function (color) {
        return color == 'red' || color == 'red_anime';
    },

    isColorDisabled: function (color) {
        return color == 'disabled' || color == 'disabled_anime';
    },

    isColorAborted: function (color) {
        return color == 'aborted' || color == 'aborted_anime';
    },

    getIconName: function(color) {
        if (this.isColorSuccess(color)) {
            return 'jenkins-green'
        } else if (this.isColorFailure(color)) {
            return 'jenkins-red'
        } else if (this.isColorDisabled(color)) {
            return 'jenkins-grey'
        } else if (this.isColorAborted(color)) {
            return 'jenkins-abort'
        } else { // unknown status
            return 'jenkins-grey'
        }
    }

}

// Entry point
//----------------------------------------------------------------------

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
