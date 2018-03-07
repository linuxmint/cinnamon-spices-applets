const Applet = imports.ui.applet;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
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
    this.menu.connect('open-state-changed', Lang.bind(this, this.onMenuToggled));

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
    this.printers = [];
    this.setIcon('printer-printing');
    this.onSettingsChanged();
  },

  on_applet_clicked: function() {
    this.menu.toggle();
  },

  on_applet_removed_from_panel: function() {
    this.settings.finalize();
  },

  onCupsSignal: function() {
    if(this.printWarning) return;
    this.printWarning = true;
    Mainloop.timeout_add_seconds(3, Lang.bind(this, this.warningTimeout));
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

  onMenuToggled: function() {
    if(!this.printWarning) this.update();
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

  update: function() {
    if(this.updating || this.menu.isOpen) return;
    this.updating = true;
    this.jobsCount = 0;
    this.printersCount = 0;
    this.menu.removeAll();
    let printers = new PopupMenu.PopupIconMenuItem(_('Printers'), 'printer-printing', this.iconType);
    printers.connect('activate', Lang.bind(this, this.onShowPrintersClicked));
    this.menu.addMenuItem(printers);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);
//Add Printers
    Util.spawn_async(['python', APPLET_PATH + '/lpstat-a.py'], Lang.bind(this, function(out) {
      this.printers = [];
      Util.spawn_async(['/usr/bin/lpstat', '-d'], Lang.bind(this, function(out2) {//To check default printer
        if(out2.split(': ')[1] != undefined) out2 = out2.split(': ')[1].trim();
        else out2 = 'no default';
        out = out.split('\n');
        this.printersCount = out.length - 2;
        for(var n = 0; n < this.printersCount; n++) {
          let printer = out[n].split(' ')[0].trim();
          this.printers.push(printer);
          let printerItem = new PopupMenu.PopupIconMenuItem(printer, 'emblem-documents', this.iconType);
          if(out2.toString() == printer.toString()) printerItem.addActor(new St.Icon({ style_class: 'popup-menu-icon',icon_name: 'emblem-default', icon_type: this.iconType }));
          printerItem.connect('activate', Lang.bind(printerItem, this.onShowJobsClicked));
          this.menu.addMenuItem(printerItem);
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);
//Add Jobs
        Util.spawn_async(['/usr/bin/lpstat', '-o'], Lang.bind(this, function(out) {
//Cancel all Jobs
          if(out.length > 0) {
            let cancelAll = new PopupMenu.PopupIconMenuItem(_('Cancel all jobs'), 'edit-delete', this.iconType);
            cancelAll.connect('activate', Lang.bind(this, this.onCancelAllJobsClicked));
            this.menu.addMenuItem(cancelAll);
          }
//Cancel Job
          out = out.split(/\n/);
          this.jobsCount = out.length - 1
          Util.spawn_async(['/usr/bin/lpq', '-a'], Lang.bind(this, function(out2) {
            out2 = out2.replace(/\n/g, ' ').split(/\s+/);
            let sendJobs = [];
            for(var n = 0; n < out.length - 1; n++) {
              let line = out[n].split(' ')[0].split('-');
              let job = line.slice(-1)[0];
              let printer = line.slice(0, -1).join('-');
              let doc = out2[out2.indexOf(job) + 1];
              for(var m = out2.indexOf(job) + 2; m < out2.length - 1; m++) {
                if(isNaN(out2[m]) || out2[m + 1] != 'bytes') doc = doc + ' ' + out2[m];
                else break;
              }
              if(doc.length > 30) doc = doc + '...';
              let text = doc;
              if(this.job_number) text += ' (' + job + ')';
              text += ' ' + _('at') + ' ' + printer;
              let jobItem = new PopupMenu.PopupIconMenuItem(text, 'edit-delete', this.iconType);
              if(out2[out2.indexOf(job) - 2] == 'active') jobItem.addActor(new St.Icon({ style_class: 'popup-menu-icon',icon_name: 'emblem-default', icon_type: this.iconType }));
              jobItem.job = job;
              jobItem.connect('activate', Lang.bind(jobItem, this.onCancelJobClicked));
              this.menu.addMenuItem(jobItem);
              if(this.send_to_front && out2[out2.indexOf(job) - 2] != 'active' && out2[out2.indexOf(job) - 2] != '1st') {
                sendJobs.push(new PopupMenu.PopupIconMenuItem(text, 'go-up', this.iconType));
                sendJobs[sendJobs.length - 1].job = job;
                sendJobs[sendJobs.length - 1].connect('activate', Lang.bind(sendJobs[sendJobs.length - 1], this.onSendToFrontClicked));
              }
            }
//Send to Front
            if(this.send_to_front && sendJobs.length > 0) {
              let subMenu = new PopupMenu.PopupSubMenuMenuItem(_('Send to front'));
              for(var n = 0; n < sendJobs.length; n++) subMenu.menu.addMenuItem(sendJobs[n]);
              this.menu.addMenuItem(subMenu);
            }
            this.updating = false;
//Update Icon
            if(this.jobsCount > 0 && this.show_jobs) this.set_applet_label(this.jobsCount.toString());
            else this.set_applet_label('');
            this.set_applet_enabled(this.show_icon == 'always' || (this.show_icon == 'printers' && this.printersCount > 0) || (this.show_icon == 'jobs' && this.jobsCount > 0));
            Util.spawn_async(['/usr/bin/lpstat', '-l'], Lang.bind(this, function(out) {
              this.printError = out.indexOf('Unable') >= 0 || out.indexOf(' not ') >= 0 || out.indexOf(' failed') >= 0;
              if(this.printWarning) this.setIcon('printer-warning');
              else if(this.show_error && this.printError) this.setIcon('printer-error');
              else this.setIcon('printer-printing');
            }));
          }))
        }))
      }))
    }))
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
  return myApplet;
}
