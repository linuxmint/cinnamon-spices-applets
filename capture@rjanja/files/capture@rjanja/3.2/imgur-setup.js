#!/usr/bin/cjs

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

let Services;

// l10n/translation support
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const UUID = "capture@rjanja";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function initEnvironment() {
  window.getApp = function() {
    return Gio.Application.get_default();
  };
}

const ImgurWizard = new Lang.Class ({
  Name: 'MessageDialog Example',
  _path: null,
  _step: 1,
  _maxSteps: 5,
  _accessToken: null,
  _refreshToken: null,
  _albumId: null,

  _init: function (path, accessToken, refreshToken, albumId) {
    this._path = path;
    this._accessToken = accessToken;
    this._refreshToken = refreshToken;
    this._albumId = albumId;

    this.application = new Gtk.Application ({
      application_id: 'org.example.jsmessagedialog',
      flags: Gio.ApplicationFlags.FLAGS_NONE });

    this.application.connect('activate', Lang.bind(this, this._onActivate));
    this.application.connect('startup', Lang.bind(this, this._onStartup));

    this.imgur = new Services.Imgur(this._accessToken, this._refreshToken, this._albumId, Lang.bind(this, this._onNewToken));
  },

  _onActivate: function () {
    this._window.present ();
  },

  _onStartup: function () {
    this._buildUI();
    if (this._accessToken && this._refreshToken) {
      // activate spinner and show text
      this._step = 4;
      this.showStep(4);
      this._backButton.set_label(_('Log out'));

      // try access token first

      // if success, take to album selection

      // if failure, try to get new token

      // if success, print out (save) new access token, take to album selection

      // if failure, print out (save) blank tokens
    }
  },

  _buildUI: function () {
    let builder = new Gtk.Builder();
    builder.add_from_file(this._path + '/imgur-wizard.ui');
    this._window = builder.get_object('wizWindow');
    this._window.set_title(_('Imgur Wizard'));
    this._topBox = builder.get_object('box1');
    this._logoBox = builder.get_object('box2');
    this._testBox = builder.get_object('box3');
    this._logoBox.override_background_color(Gtk.StateType.NORMAL, new Gdk.RGBA({red:255, green:255, blue: 255, alpha:1}));
    this._introLabel = builder.get_object('introLabel');
    this._contentBox = builder.get_object('contentBox');
    this._backButton = builder.get_object('backButton');
    this._nextButton = builder.get_object('nextButton');
    this._backButton.set_alignment(1.0, 0.5);
    this._nextButton.set_alignment(0.0, 0.5);

    let intro = "<big>" + _("Desktop Capture") + "</big>\n"
     + "<b>" + _("Connection Wizard - Imgur (Screenshots)") + "</b>\n"
     + "<small>" + _("Upload screenshots into an album of your choice!") + "</small>";
    this._introLabel.set_markup(intro);
    this._introLabel.set_line_wrap(true);
    this._introLabel.set_justify(Gtk.Justification.LEFT);
    this._introLabel.set_alignment(0, 0.5);
    this._introLabel.set_padding(5, 0);

    let instructions = _("To upload screenshots to imgur, you need to authorize this applet to use your account.")
    + " " + _("This wizard will guide you through this process.")
    + "\n\n"
    + _("Requirements:") + "\n"
    + " - " + _("internet derp derp") + "\n"
    + " - " + _("you must have an %s").replace(/%s/g, "<a href='http://imgur.com'>" + _("imgur account") + "</a>") + "\n"
    + " - " + _("you may already have an album for screenshots") + "\n";

    this._instructionsLabel = new Gtk.Label({ label: instructions, use_markup: true});
    this._instructionsLabel.set_line_wrap(true);
    this._instructionsLabel.set_justify(Gtk.Justification.LEFT);
    this._instructionsLabel.set_alignment(0, 0);
    this._instructionsLabel.set_padding(10, 10);

    // @todo(Rob): Redo the stack in Glade 3.19
    this._stack = new Gtk.Stack();
    this._stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT);
    this._stack.set_transition_duration(1000);

    this._stack.add_titled(this._instructionsLabel, '1', 'a label');

    let box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
    this._stack.add_titled(box, '2', _('Permission Request'));
    let instructionsText2 = _('Grant permission for Desktop Capture to access your imgur account.');
    let instructionsLabel2 = new Gtk.Label({ label: instructionsText2, use_markup: true});
    instructionsLabel2.set_padding(10, 10);
    instructionsLabel2.set_justify(Gtk.Justification.LEFT);
    instructionsLabel2.set_alignment(0, 0);
    box.pack_start(instructionsLabel2, false, false, 5);
    let launchBrowserButton = new Gtk.Button({ label: _('Launch Browser'), margin: 10 });
    launchBrowserButton.connect("clicked", Lang.bind(this, this.launchBrowser));
    box.pack_start(launchBrowserButton, false, false, 5);
    let instructionsText3 = _('Press Next when you have authorized Desktop Capture and received a PIN.');
    let instructionsLabel3 = new Gtk.Label({ label: instructionsText3, use_markup: true });
    instructionsLabel3.set_justify(Gtk.Justification.CENTER);
    instructionsLabel3.set_alignment(0, 0);
    instructionsLabel3.set_padding(10, 10);
    box.pack_start(instructionsLabel3, false, false, 5);

    let box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
    this._stack.add_titled(box, '3', _('Validate PIN'));
    let instructionsText = _('Enter PIN to validate access and get tokens.');
    let instructionsLabel = new Gtk.Label({ label: instructionsText, use_markup: true});
    instructionsLabel.set_padding(10, 10);
    instructionsLabel.set_justify(Gtk.Justification.LEFT);
    instructionsLabel.set_alignment(0.0, 0.5);
    box.pack_start(instructionsLabel, false, false, 5);
    let labelText = _('Enter PIN');
    let label = new Gtk.Label({ label: labelText });

    let box2 = new Gtk.Box();
    box2.pack_start(new Gtk.Label({ label: '' }), false, true, 20);
    box2.set_spacing(5);
    // this._window.add(box1);
    var pinLabel = new Gtk.Label({ label: 'PIN:' });
    pinLabel.set_justify(Gtk.Justification.RIGHT);
    pinLabel.set_alignment(1.0, 0.5);
    box2.pack_start(pinLabel, false, true, 5);      
    this._pinEntry = new Gtk.Entry();
    this._pinEntry.set_alignment(0.0, 0.5);
    this._pinEntry.set_max_width_chars(32);
    this._pinEntry.set_max_length(32); // 10
    box2.pack_start(this._pinEntry, false, false, 5);
    box2.set_homogeneous(false);
    // box2.set_margin(10);
    box.pack_start(box2, true, true, 5);

    
    let box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
    this._stack.add_titled(box, '4', _('Choose album'));
    let instructionsText = _('Please choose the album for new screenshots.');
    let instructionsLabel = new Gtk.Label({ label: instructionsText, use_markup: true});
    instructionsLabel.set_padding(10, 10);
    instructionsLabel.set_justify(Gtk.Justification.LEFT);
    instructionsLabel.set_alignment(0, 0);
    box.pack_start(instructionsLabel, false, false, 5);

    this.liststore = new Gtk.ListStore();
    this.liststore.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);
    this.liststore.set(this.liststore.append(), [0, 1], ['-1', _('(Loading..)')]);
    var cellRenderer = new Gtk.CellRendererText();

    this.albumSelect = new Gtk.ComboBox();
    this.albumSelect.set_model(this.liststore);
    this.albumSelect.pack_start(cellRenderer, true);
    this.albumSelect.add_attribute(cellRenderer, "text", 1);
    this.albumSelect.set_active(0);
    this.albumSelect.set_margin_left(10);
    this.albumSelect.set_margin_right(10);
    this.albumSelect.connect("changed", Lang.bind(this, this._onAlbumChanged));
    this.albumSelect.set_sensitive(false);
    box.pack_start(this.albumSelect, false, false, 5);
    let subText = '<small>' + _("Manage your albums by visiting your %s.").replace(/%s/g,
                                '<a href="http://imgur.com/">' + _("imgur account") +'</a>') + '</small>';
    let subLabel = new Gtk.Label({ label: subText, use_markup: true });
    subLabel.set_padding(10, 10);
    subLabel.set_justify(Gtk.Justification.LEFT);
    subLabel.set_alignment(0, 0);
    box.pack_start(subLabel, false, false, 5);


    let box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
    this._stack.add_titled(box, '5', _('Finished'));
    let instructionsText = _('All done!');
    let instructionsLabel = new Gtk.Label({ label: instructionsText, use_markup: true});
    instructionsLabel.set_padding(10, 10);
    instructionsLabel.set_justify(Gtk.Justification.LEFT);
    instructionsLabel.set_alignment(0, 0);
    box.pack_start(instructionsLabel, false, false, 5);


    this._topBox.add(this._stack);
    this._logo = builder.get_object('logoImage');
    let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(this._path + '/icon.png',
      64, 64, true);
    this._logo.set_from_pixbuf(pixbuf);
    this._window.set_icon(pixbuf);

    this._backButton.set_label(_('Quit'));
    this._backButton.connect("clicked", Lang.bind(this, this.goBack));
    this._nextButton.set_label(_('Next'));
    this._nextButton.connect("clicked", Lang.bind(this, this.goForward));


    this.application.add_window(this._window);
    this._window.show_all();
    this._backButton.set_visible(false);

    // DEBUG
    // this._step = 4;
    // this.showStep(4);
  },

  _onAlbumChanged: function(combobox) {
    let value = this._getComboValue(combobox, this.liststore);
    if (value) {
      print("album_id=" + value);
    }
  },

  _getComboValue: function(combobox, liststore) {
    var [success, treeiter] = combobox.get_active_iter();

    if (success) {
      return liststore.get_value(treeiter, 0);
    }
    else {
      return '';
    }
  },

  goBack: function() {
    if (this._step <= 1) {
      this._window.destroy();
    }
    else if (this._step == 4 && this._backButton.get_label() == _('Log out')) {
      this._backButton.set_label(_('Back'));
      this._step = 1;
      this.showStep(this._step);
      this.savePrefs('', '', '');
    }
    else {
      this.showStep(--this._step);
    }
  },

  goForward: function() {
    if (this._step == 3) {
      let pin = this._pinEntry.get_text();
      log('pin entered is: ' + pin);
      this.imgur.redeemPinCode(pin, Lang.bind(this, function() {
        this._showPinError(_('Pin Incorrect'));
      }), Lang.bind(this, function(json) {
        this.savePrefs(json['access_token'], json['refresh_token'], '');
        this.showStep(++this._step);
      }));
    }
    else {
      this.showStep(++this._step);
    }
  },

  savePrefs: function(accessToken, refreshToken, albumId) {
    this._accessToken = accessToken;
    this._refreshToken = refreshToken;
    this._albumId = albumId;
    print("access_token=" + accessToken);
    print("refresh_token=" + refreshToken);
    print("album_id=" + albumId);
    this.imgur = new Services.Imgur(this._accessToken, this._refreshToken, this._albumId, Lang.bind(this, this._onNewToken));
  },

  _onNewToken: function(token) {
    this._accessToken = token;
    print("access_token=" + this._accessToken);
  },

  showStep: function(step) {
    this.hideShowButtons();
    this._stack.set_visible_child_name(step.toString());

    if (step == 4) {
      this.imgur.requestAlbumList(function(e) {
        log(JSON.stringify(e));
        log('error! probably a token thang');
      }, Lang.bind(this, function(json) {
        this.liststore.clear();
        var i = 0, exactMatch = false;
        for (let idx in json) {
          let album = json[idx];
          // log('Album ID ' + album['id'] + ': ' + album['title']);
          this.liststore.set(this.liststore.append(), [0, 1], [album['id'], album['title'] + " (" + album['privacy'] + ")"]);
          if ((!this._albumId && album['title'] == 'Screenshots')
           || this._albumId == album['id']) {
            exactMatch = true;
            this.albumSelect.set_active(i);
          }
          i++;
        }
        if (!exactMatch) {
          this.liststore.set(this.liststore.append(), [0, 1], ['-1', _('(Create a new "Screenshots" album)')]);
          this.albumSelect.set_active(i-1);
        }
        this.albumSelect.set_sensitive(true);
      }));
    }
    else if (step == 5) {
      this._albumId = this._getComboValue(this.albumSelect, this.liststore);
      print('album_id=' + this._albumId);
      log('album is ' + this._albumId);
    }
  },

  hideShowButtons: function() {
    if (this._step > 1) {
      this._backButton.set_label(_('Back'));
      this._backButton.set_visible(true);
      if (this._step >= this._maxSteps) {
        this._nextButton.set_sensitive(false);
        this._nextButton.set_visible(false);
      }
      else {
        this._nextButton.set_sensitive(true);
        this._nextButton.set_visible(true);
      }
    }
    else {
      this._backButton.set_label(_('Quit'));
      this._backButton.set_visible(false);
      this._nextButton.set_visible(true);
    }
  },

  launchBrowser: function() {
    this.imgur.requestPinCode();
  },

  verifyPin: function() {
    
  },

  _showPinError: function (errorText) {
    this._messageDialog = new Gtk.MessageDialog ({
      transient_for: this._window,
      modal: true,
      buttons: Gtk.ButtonsType.OK,
      message_type: Gtk.MessageType.WARNING,
      text: errorText });

    this._messageDialog.connect ('response', Lang.bind(this, this._response_cb));
    this._messageDialog.show();
  },

  _response_cb: function (messagedialog, response_id) {
    switch (response_id) {
      case Gtk.ResponseType.OK:
        break;
      case Gtk.ResponseType.CANCEL:
        break;
      case Gtk.ResponseType.DELETE_EVENT:
        break;
    }

    this._messageDialog.destroy();

  }
});

function main(argv) {
  initEnvironment();
  imports.searchPath.push(argv[0]);
  imports.searchPath.push('/usr/share/cinnamon/js');
  
  Services = imports.services;
  // AppUtil = imports.apputil;

  // Me.dir.get_path()
  let [path, token1, token2, album] = argv;

  return (new ImgurWizard(path, token1, token2, album)).application.run(argv);
}

main(ARGV);

// Run the application
// let app = new ImgurWizard();
// app.application.run (ARGV);

// let hash = {
//   "a": 123,
//   "b": 456,
//   "c": "cow"
// };

// for (var key in hash) {
//   print(key);
//   print(hash[key]);
// }

// print(hash);
