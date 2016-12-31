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

    this._cupsSignal = Gio.DBus.system.signal_subscribe(null, 'org.cups.cupsd.Notifier', null, '/org/cups/cupsd/Notifier', null, Gio.DBusSignalFlags.NONE, this.cups_signal.bind(this));

    this.set_applet_tooltip(_('Printers'));

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    this.settings = new Settings.AppletSettings(this, 'printers@linux-man', instance_id);

    this.settings.bindProperty(Settings.BindingDirection.IN, 'always-show-icon', 'always_show_icon', this.on_settings_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'show-error', 'show_error', this.on_settings_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'show-jobs', 'show_jobs', this.on_settings_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'job-number', 'job_number', this.on_settings_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'send-to-front', 'send_to_front', this.on_settings_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, 'symbolic-icons', 'symbolic_icons', this.on_settings_changed, null);

    this.jobCount = 0;
    this.printError = false;
    this.printWarning = false;
    this.printers = [];
    this.on_settings_changed();
    this.update();
  },

  on_show_printers_clicked: function() {
    Util.spawn(['system-config-printer']);
  },

  on_show_jobs_clicked: function(item) {
    Util.spawn(['system-config-printer', '--show-jobs', item.label.text]);
  },

  on_cancel_all_jobs_clicked: function() {
    for(var n = 0; n < this.printers.length; n++) {
      Util.spawn(['cancel', '-a', this.printers[n]]);
    }
  },

  on_cancel_job_clicked: function(item) {
    Util.spawn(['cancel', item.job]);
  },

  on_send_to_front_clicked: function(item) {
    Util.spawn(['lp', '-i', item.job, '-q 100']);
  },

  cups_signal: function () {
    this.printWarning = true;
    Mainloop.timeout_add_seconds(3, Lang.bind(this, function(){this.printWarning = false; this.update()}));
    this.update();
  },

  update_icon: function() {
    if(this.printWarning) {
      if (this.symbolic_icons) this.set_applet_icon_symbolic_name('printer-warning');
      else this.set_applet_icon_name('printer-warning');
    }
    else if(this.show_error && this.printError) {
      if (this.symbolic_icons) this.set_applet_icon_symbolic_name('printer-error');
      else this.set_applet_icon_name('printer-error');
    }
    else {
      if (this.symbolic_icons) this.set_applet_icon_symbolic_name('printer-printing');
      else this.set_applet_icon_name('printer-printing');
    }
  },

  update: function() {
    Util.spawn_async(['/usr/bin/lpstat', '-l'], Lang.bind(this, function(command) {
      var out = command;
      this.printError = out.indexOf('Unable') >= 0 || out.indexOf(' not ') >= 0;
      this.update_icon();
      Util.spawn_async(['/usr/bin/lpstat', '-o'], Lang.bind(this, function(command){
        out = command.split(/\n/);
        this.jobCount = out.length - 1
        if(this.jobCount > 0 && this.show_jobs) this.set_applet_label(this.jobCount.toString());
        else this.set_applet_label('');
        this.set_applet_enabled(this.always_show_icon || this.jobCount > 0);
      }))
    }))
  },

  on_settings_changed: function() {
    if (this.symbolic_icons) this.icontype = St.IconType.SYMBOLIC;
    else this.icontype = St.IconType.FULLCOLOR;
    this.printError = false;
    this.update();
  },

  on_applet_clicked: function(event) {
    this.update();
    if(!this.menu.isOpen) {
      this.menu.removeAll();
      let printers = new PopupMenu.PopupIconMenuItem(_('Printers'), 'printer-printing', this.icontype);
      printers.connect('activate', Lang.bind(this, this.on_show_printers_clicked));
      this.menu.addMenuItem(printers);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);
//Add Printers
      Util.spawn_async(['python', APPLET_PATH + '/lpstat-a.py'], Lang.bind(this, function(command) {
        var out = command;
        this.printers = [];
        Util.spawn_async(['/usr/bin/lpstat', '-d'], Lang.bind(this, function(command) {//To check default printer
          if(command.substring(0, 2) != 'no') var out2 = command.split(': ')[1].trim();
		  else var out2 = 'no default';
          out = out.split('\n');
          for(var n = 0; n < out.length - 2; n++) {
            let printer = out[n].split(' ')[0].trim();
            this.printers.push(printer);
            let printerItem = new PopupMenu.PopupIconMenuItem(printer, 'emblem-documents', this.icontype);
            if(out2.toString() == printer.toString()) printerItem.addActor(new St.Icon({ style_class: 'popup-menu-icon',icon_name: 'emblem-default', icon_type: this.icontype }));
            printerItem.connect('activate', Lang.bind(printerItem, this.on_show_jobs_clicked));
            this.menu.addMenuItem(printerItem);
          }
          this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);
//Add Jobs
          Util.spawn_async(['/usr/bin/lpstat', '-o'], Lang.bind(this, function(command) {
            out = command;
            if(out.length > 0) {//If there are jobs
//Cancel all Jobs
              let cancelItem = new PopupMenu.PopupIconMenuItem(_('Cancel all jobs'), 'edit-delete', this.icontype);
              cancelItem.connect('activate', Lang.bind(this, this.on_cancel_all_jobs_clicked));
              this.menu.addMenuItem(cancelItem);
//Cancel Job
              out = out.split(/\n/);
              Util.spawn_async(['/usr/bin/lpq', '-a'], Lang.bind(this, function(command) {
                out2 = command.replace(/\n/g, ' ').split(/\s+/);
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
                  let jobItem = new PopupMenu.PopupIconMenuItem(text, 'edit-delete', this.icontype);
                  if(out2[out2.indexOf(job) - 2] == 'active') jobItem.addActor(new St.Icon({ style_class: 'popup-menu-icon',icon_name: 'emblem-default', icon_type: this.icontype }));
                  jobItem.job = job;
                  jobItem.connect('activate', Lang.bind(jobItem, this.on_cancel_job_clicked));
                  this.menu.addMenuItem(jobItem);
                  if(this.send_to_front && out2[out2.indexOf(job) - 2] != 'active' && out2[out2.indexOf(job) - 2] != '1st') {
                    sendJobs.push(new PopupMenu.PopupIconMenuItem(text, 'go-up', this.icontype));
                    sendJobs[sendJobs.length - 1].job = job;
                    sendJobs[sendJobs.length - 1].connect('activate', Lang.bind(sendJobs[sendJobs.length - 1], this.on_send_to_front_clicked));
                  }
                }
//Send to Front
                if(this.send_to_front && sendJobs.length > 0) {
                  let subMenu = new PopupMenu.PopupSubMenuMenuItem(_('Send to front'));
                  for(var n = 0; n < sendJobs.length; n++) {
                    subMenu.menu.addMenuItem(sendJobs[n]);
                  }
                  this.menu.addMenuItem(subMenu);
                  this.menu.toggle();
                }
                else this.menu.toggle();
              }))
            }
            else this.menu.toggle();
          }))
        }))
      }))
    }
    else this.menu.toggle();
  },

  on_applet_removed_from_panel: function() {
    this.settings.finalize();
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
  return myApplet;
}
