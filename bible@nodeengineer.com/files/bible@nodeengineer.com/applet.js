const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const Soup = imports.gi.Soup;
const ByteArray = imports.byteArray;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Signals = imports.signals;

const UUID = 'bible@nodeengineer.com';

const QUtils = require('./js/QUtils.js');
const QPopupSwitch = QUtils.QPopupSwitch;

let soupASyncSession;
if (Soup.MAJOR_VERSION == 2) {
  soupASyncSession = new Soup.SessionAsync();
  Soup.Session.prototype.add_feature.call(soupASyncSession, new Soup.ProxyResolverDefault());
} else if (Soup.MAJOR_VERSION == 3) {
  soupASyncSession = new Soup.Session();
}

function MyApplet(orientation, panelHeight, instanceId) {
  this._init(orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function(orientation, panelHeight, instanceId) {
    Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

    try {
      this.set_applet_icon_name("cross");
      this.set_applet_tooltip("Get a verse from the Bible");

      this.menuManager = new PopupMenu.PopupMenuManager(this);

      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);

      this.box = new St.BoxLayout();
      this.box.set_height(100);
      this.box.set_width(300);

      this.menu.addActor(this.box);

      this.verseLabel = new St.Label();
      this.box.add(this.verseLabel);
      this.verseLabel.clutter_text.set_line_wrap(true);

      //////////////////////////////////////////
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this.bottomBox = new St.BoxLayout();
      this.menu.addActor(this.bottomBox);
      this.bottomBox.set_height(13);
      this.bottomBox.set_width(300);

      this.testamentSwitcher = new QPopupSwitch({
        label: _("Old Testament"),
        active: true
      });

      this.testamentSwitcher.connect('toggled', this.switchTestament.bind(this));
      this.testamentSwitcher.setToggleState(false);
      this.testamentSwitcher.actor.add_style_class_name('q-icon');

      this.menu.addMenuItem(this.testamentSwitcher);
    }
    catch (e) {
      global.logError(e);
    }
  },

  switchTestament: function(switcher, value) {
    if (value) {
      this.getVerse(0, this.displayVerse.bind(this));
    } else {
      this.getVerse(1, this.displayVerse.bind(this));
    }
  },

  getVerse: function (testament, callback) {
    let request = Soup.Message.new('GET', "https://devotionalium.com/api/v2?lang=en");
    if (Soup.MAJOR_VERSION === 2) {
      soupASyncSession.queue_message(request, (soupASyncSession, response) => {
        if (response.status_code !== 200) {
          var return_message = "Connection error.";
          callback(return_message);
          return;
        }

        var responseParsed = JSON.parse(response.response_body.data);
        var verse = responseParsed[testament].text;

        callback(verse);
      });
    } else { //version 3
      soupASyncSession.send_and_read_async(request, Soup.MessagePriority.NORMAL, null, (soupASyncSession, response) => {
        if (request.get_status() !== 200) {
          var return_message = "Connection error.";
          callback(return_message);
          return;
        }

        const bytes = soupASyncSession.send_and_read_finish(response);
        var responseParsed = JSON.parse(ByteArray.toString(bytes.get_data()));
        var verse = responseParsed[testament].text;

        callback(verse);
      });
    }
  },

  displayVerse: function(verseReturned) { 
    this.verseLabel.set_text(verseReturned);
  },

  on_applet_clicked: function(event) {
    // this.getVerse(1, this.displayVerse.bind(this));
    this.getVerse(1, this.displayVerse.bind(this));
    this.menu.toggle();
  }
};

function main(metadata, orientation, panelHeight, instanceId) {
  let myApplet = new MyApplet(orientation, panelHeight, instanceId);
  return myApplet;
}
