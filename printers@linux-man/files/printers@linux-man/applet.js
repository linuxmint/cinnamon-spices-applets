const { Gio, GLib, St } = imports.gi;

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Config = imports.misc.config;
const Util = imports.misc.util;
const Gettext = imports.gettext;
const APPLET_PATH = imports.ui.appletManager.appletMeta["printers@linux-man"].path;

Gettext.bindtextdomain('printers@linux-man', GLib.get_home_dir() + '/.local/share/locale');

function _(str) {
    let resultConf = Gettext.dgettext('printers@linux-man', str);
    if(resultConf != str) {
        return resultConf;
    }
    return Gettext.gettext(str);
};

function exec_async(args) {
    return new Promise((resolve, reject) => {
        let strOUT = '';
        try {
            let proc = Gio.Subprocess.new(args, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if(proc.get_successful()) strOUT = stdout;
                }
                catch (e) {
                    logError(e);
                }
                finally {
                    resolve(strOUT);
                }
            });
        }
        catch (e) {
            logError(e);
        }
    })
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        if(this.setAllowedLayout) this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._cupsSignal = Gio.DBus.system.signal_subscribe(null, 'org.cups.cupsd.Notifier', null, '/org/cups/cupsd/Notifier', null, Gio.DBusSignalFlags.NONE, this.onCupsSignal.bind(this));

        this.set_applet_tooltip(_('Printers'));

        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menu.connect('open-state-changed', this.onMenuOpened.bind(this));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        this.settings = new Settings.AppletSettings(this, 'printers@linux-man', instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'show-icon', 'show_icon', this.onSettingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'show-error', 'show_error', this.onSettingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'show-jobs', 'show_jobs', this.onSettingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'job-number', 'job_number', this.onSettingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'send-to-front', 'send_to_front', this.onSettingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'symbolic-icons', 'symbolic_icons', this.onSettingsChanged, null);

        this.jobsCount = 0;
        this.printersCount = 0;
        this.printError = false;
        this.printWarning = false;
        this.updating = false;
        this.showLater = false;
        this.printers = [];
        this.setIcon('printer-printing');
        this.onSettingsChanged();
        let cinnamonVersion = Config.PACKAGE_VERSION.split('.');
        let majorVersion = parseInt(cinnamonVersion[0]);
        let minorVersion = parseInt(cinnamonVersion[1]);
        this.pkexec = majorVersion > 3 || (majorVersion == 3 && minorVersion > 7);
    },

    on_reload_button: function() {
        Util.spawnCommandLine("dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'printers@linux-man' string:'APPLET'");
    },

    on_cups_button: function() {
        if(this.pkexec) Util.spawnCommandLine("sh -c 'pkexec systemctl restart cups.service'");
        else Util.spawnCommandLine("gksudo 'systemctl restart cups.service'");
    },

    on_applet_clicked: function() {
        if(!this.menu.isOpen && this.updating) {
            this.showLater = true;
            return;
        }
        this.menu.toggle();
        if(!this.printWarning && !this.menu.isOpen) this.update();
    },

    on_applet_removed_from_panel: function() {
        this.settings.finalize();
    },

    onCupsSignal: function() {
        if(this.printWarning) return;
        this.printWarning = true;
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, this.warningTimeout.bind(this))
        this.update();
    },

    warningTimeout: function() {
        this.printWarning = false;
        this.update();
    },

    setIcon: function(iconName) {
        if (this.symbolic_icons) this.set_applet_icon_symbolic_name(iconName);
        else this.set_applet_icon_name(iconName);
    },

    onMenuOpened: function() {
        if(this.sendSubMenu != null) {
            this.sendSubMenu.close();
            this.sendSubMenu.open();
        }
        this.cancelSubMenu.close();
        this.cancelSubMenu.open();
        if(this.sendSubMenu != null) this.sendSubMenu.close();
    },

    onSettingsChanged: function() {
        if (this.symbolic_icons) this.iconType = St.IconType.SYMBOLIC;
        else this.iconType = St.IconType.FULLCOLOR;
        this.update();
    },

    onShowPrintersClicked: function() {
        Util.spawn(['system-config-printer']);
    },

    onShowJobsClicked: function(item) {
        Util.spawn(['system-config-printer', '--show-jobs', item.label.text]);
    },

    onCancelAllJobsClicked: function() {
        for(var n = 0; n < this.printers.length; n++) {
            Util.spawn(['cancel', '-a', this.printers[n]]);
        }
    },

    onCancelJobClicked: function(item) {
        Util.spawn(['cancel', item.job]);
    },

    onSendToFrontClicked: function(item) {
        Util.spawn(['lp', '-i', item.job, '-q 100']);
    },

    update: async function() {
        if(this.updating || this.menu.isOpen) return;
        this.updating = true;
        this.jobsCount = 0;
        this.printersCount = 0;
        this.menu.removeAll();
        let printers = new PopupMenu.PopupIconMenuItem(_('Printers'), 'printer-printing', this.iconType);
        printers.connect('activate', this.onShowPrintersClicked.bind(this));
        this.menu.addMenuItem(printers);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);
//Add Printers
        let p_list = await exec_async(['/usr/bin/lpstat', '-a']);
        this.printers = [];
        let p_default = await exec_async(['/usr/bin/lpstat', '-d']);//----------------------------------
        if(p_default.split(': ')[1] != undefined) p_default = p_default.split(': ')[1].trim();
        else p_default = 'no default';
        p_list = p_list.split('\n');
        this.printersCount = p_list.length - 2;
        for(var n = 0; n < this.printersCount; n++) {
            let printer = p_list[n].split(' ')[0].trim();
            this.printers.push(printer);
            let printerItem = new PopupMenu.PopupIconMenuItem(printer, 'emblem-documents', this.iconType);
            if(p_default.toString() == printer.toString()) printerItem.addActor(new St.Icon({ style_class: 'popup-menu-icon',icon_name: 'emblem-default', icon_type: this.iconType }));
            printerItem.connect('activate', this.onShowJobsClicked.bind(printerItem));
            this.menu.addMenuItem(printerItem);
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);
//Add Jobs
        let p_jobs = await exec_async(['/usr/bin/lpstat', '-o']);
//Cancel all Jobs
        if(p_jobs.length > 0) {
            let cancelAll = new PopupMenu.PopupIconMenuItem(_('Cancel all jobs'), 'edit-delete', this.iconType);
            cancelAll.connect('activate', this.onCancelAllJobsClicked.bind(this));
            this.menu.addMenuItem(cancelAll);

            let _cancelSubMenu = new PopupMenu.PopupSubMenuMenuItem(null);
            _cancelSubMenu.actor.set_style_class_name('');
            this.cancelSubMenu = _cancelSubMenu.menu;
            this.menu.addMenuItem(_cancelSubMenu);
        }
//Cancel Job
        p_jobs = p_jobs.split(/\n/);
        this.jobsCount = p_jobs.length - 1;
        let p_jobs2 = await exec_async(['/usr/bin/lpq', '-a']);
        p_jobs2 = p_jobs2.replace(/\n/g, ' ').split(/\s+/);
        let sendJobs = [];
        for(var n = 0; n < p_jobs.length - 1; n++) {
            let line = p_jobs[n].split(' ')[0].split('-');
            let job = line.slice(-1)[0];
            let printer = line.slice(0, -1).join('-');
            let doc = p_jobs2[p_jobs2.indexOf(job) + 1];
            for(var m = p_jobs2.indexOf(job) + 2; m < p_jobs2.length - 1; m++) {
                if(isNaN(p_jobs2[m]) || p_jobs2[m + 1] != 'bytes') doc = doc + ' ' + p_jobs2[m];
                else break;
            }
            if(doc.length > 30) doc = doc + '...';
            let text = doc;
            if(this.job_number) text += ' (' + job + ')';
            text += ' ' + _('at') + ' ' + printer;
            let jobItem = new PopupMenu.PopupIconMenuItem(text, 'edit-delete', this.iconType);
            if(p_jobs2[p_jobs2.indexOf(job) - 2] == 'active') jobItem.addActor(new St.Icon({ style_class: 'popup-menu-icon',icon_name: 'emblem-default', icon_type: this.iconType }));
            jobItem.job = job;
            jobItem.connect('activate', this.onCancelJobClicked.bind(jobItem));
            this.cancelSubMenu.addMenuItem(jobItem);
            if(this.send_to_front && p_jobs2[p_jobs2.indexOf(job) - 2] != 'active' && p_jobs2[p_jobs2.indexOf(job) - 2] != '1st') {
                sendJobs.push(new PopupMenu.PopupIconMenuItem(text, 'go-up', this.iconType));
                sendJobs[sendJobs.length - 1].job = job;
                sendJobs[sendJobs.length - 1].connect('activate', this.onSendToFrontClicked.bind(sendJobs[sendJobs.length - 1]));
            }
        }
//Send to Front
        if(this.send_to_front && sendJobs.length > 0) {
            let _sendSubMenu = new PopupMenu.PopupSubMenuMenuItem(_('Send to front'));
            this.sendSubMenu =_sendSubMenu.menu;
            for(var n = 0; n < sendJobs.length; n++) this.sendSubMenu.addMenuItem(sendJobs[n]);
            this.menu.addMenuItem(_sendSubMenu);
        }
        this.updating = false;
        if(this.cancelSubMenu != null) this.cancelSubMenu.open();
        if(this.showLater) {
            this.showLater = false;
            this.menu.open();
        }
//Update Icon
        if(this.jobsCount > 0 && this.show_jobs) this.set_applet_label(this.jobsCount.toString());
        else this.set_applet_label('');
        this.set_applet_enabled(this.show_icon == 'always' || (this.show_icon == 'printers' && this.printersCount > 0) || (this.show_icon == 'jobs' && this.jobsCount > 0));
        let p_error = await exec_async(['/usr/bin/lpstat', '-l']);
        this.printError = p_error.indexOf('Unable') >= 0 || p_error.indexOf(' not ') >= 0 || p_error.indexOf(' failed') >= 0;
        if(this.printWarning) this.setIcon('printer-warning');
        else if(this.show_error && this.printError) this.setIcon('printer-error');
        else this.setIcon('printer-printing');
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
