const Applet = imports.ui.applet;
const Mainloop = imports.mainloop; // Needed for timer update loop
const Soup = imports.gi.Soup;
const Settings = imports.ui.settings;

const _httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

function NightscoutApplet(metadata, orientation, panelHeight, instance_id) {
  this._init(metadata, orientation, panelHeight, instance_id);
}

const logging = false;

const log = function(message) {
  if (logging) global.log(`[nightscout@ranneft]: ${message}`);
}

const makeHttpRequest = function(method, uri, cb) {
  return new Promise((resolve, reject) => {
    const request = Soup.Message.new(method, uri);
    request.request_headers.append('accept', 'application/json');
    _httpSession.queue_message(request, (_httpSession, message) => {
      if (message.status_code === 200) {
        cb(resolve, message);
      } else {
        log(`Failed to acquire request (${message.status_code})`);
        reject(`Failed to acquire request (${message.status_code})`);
      }
    });
  });
}

const roundUsing = function(func, prec, value){
  var temp = value * Math.pow(10, prec)
  temp = func(temp);
  return temp / Math.pow(10, prec)
}

NightscoutApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype, // Now TextIcon Applet

  last: null,
  applyAlert: false,
  alerting: null,

  _init: function (metadata, orientation, panelHeight, instance_id) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
    this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

    this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
      "usemmol", // The setting key
      "usemmol", // The property to manage (this.refreshInterval)
      this.on_settings_changed, // Callback when value changes
      null); // Optional callback data

    this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
      "refreshInterval", // The setting key
      "refreshInterval", // The property to manage (this.refreshInterval)
      this.on_settings_changed, // Callback when value changes
      null); // Optional callback data

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "host",
      "host",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "showMissing",
      "showMissing",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "showMissingInterval",
      "showMissingInterval",
      this.on_settings_changed,
      null);

    this.settings.bindProperty(Settings.BindingDirection.IN,
      "showiob",
      "showiob",
      this.on_settings_changed,
      null);

    try {
      // Set initial value
      this.set_applet_icon_path(metadata.path + '/icons/nightscout.png')
      this.set_applet_label("Loading...");
      this.set_applet_tooltip("Nightscout");
      this.startUp(true);
    } catch (e) {
      global.logError(e);
    }
  },


  on_settings_changed: function(event) {
    this.startUp(false);
  },

  on_applet_clicked: function(event) {
    this.updateUI();
  },

  startUp: function(setupLoop) {
    if(setupLoop) {
      this.updateLoop(true);
    } else {
      this.updateUI();
    }
  },

  makeBGstring(current, status) {
    let bgString  = "BG: ";
    const bgValue = this.usemmol ? roundUsing(Math.ceil, 1, current.sgv * 0.0555).toFixed(1) : current.sgv;
    bgString += bgValue;
    switch(current.direction) {
      case 'Flat':
        bgString += ' →';
        break;
      case 'SingleDown':
        bgString += ' ↓';
        break;
      case 'DoubleDown':
        bgString += ' ↓↓';
        break;
      case 'TripleDown':
        bgString += ' ↓↓↓';
        break;
      case 'SingleUp':
        bgString += ' ↑';
        break;
      case 'DoubleUp':
        bgString += ' ↑↑';
        break;
      case 'TripleUp':
        bgString += ' ↑↑↑';
        break;
      default:
        break;
    }
    if(this.showiob) {
      bgString += "  (IoB: " + status.pump.iob.bolusiob + "U)";
    }
    if(this.showMissing && this.last) {
      const lastDate = this.last.date;
      const currentDate = Date.now();
      const minutesAgo = Math.floor((currentDate - lastDate) / 60 / 1000);
      if(minutesAgo > this.showMissingInterval) {
        bgString = "!Last " + minutesAgo + " m ago!   " + bgString;
      }
    }
    this.set_applet_label(bgString);
  },

  requestCurrentBg() {
    return makeHttpRequest('GET', `${this.host}/api/v1/entries/current`, (resolve, message) => {
      let current = {};
      log('Requested current state' + message.response_body.data);
      const entries = JSON.parse(message.response_body.data);
      if(entries.length > 0) {
        current = entries[0];
      }
      resolve(current)
    });
  },

  requestDeviceStatus() {
    return makeHttpRequest('GET', `${this.host}/api/v1/devicestatus?count=1`, (resolve, message) => {
      let status = {};
      log('Requested device status' + message.response_body.data);
      const statuses = JSON.parse(message.response_body.data);
      if(statuses.length > 0) {
        status = statuses[0];
      }
      resolve(status);
    });
  },

  makeTooltip(status) {
    let tooltip = "";
    if(this.last) {
      const date = new Date();
      date.setTime(this.last.date);
      tooltip += "Last update: " + date.toUTCString() + "\n";
    }
    this.set_applet_tooltip(tooltip +
      "IOB: " + status.pump.iob.bolusiob + "U\n" +
      "Bat: " + status.pump.battery.percent + "%\n" +
      "UpBat: " + status.uploaderBattery + "%\n" +
      "Reservoir: " + status.pump.reservoir + "U"
    );
  },

  // This updates the numerical display in the applet and in the tooltip
  updateUI: function() {
    try {
      Promise.all([this.requestCurrentBg(), this.requestDeviceStatus()]).then(values => {
        if(!this.last) {
          this.last = values[0];
        }
        this.makeBGstring(values[0], values[1]);
        this.makeTooltip(values[1]);
        if(values[0] && values[0]._id && (this.last._id !== values[0]._id)) {
          this.last = values[0];
        }
      });

    } catch (e) {
      global.logError(e);
    }
  },

  // This is the loop run at refreshInterval rate to call updateUI() to update the display in the applet and tooltip
  updateLoop: function() {
    this.updateUI();
    Mainloop.timeout_add_seconds(this.refreshInterval * 60, this.updateLoop.bind(this));
  },
};

function main(metadata, orientation, panelHeight, instance_id) {
  let nightscoutApplet = new NightscoutApplet(metadata, orientation, panelHeight, instance_id);
  return nightscoutApplet;
}
