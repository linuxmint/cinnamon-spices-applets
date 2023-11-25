const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Soup = imports.gi.Soup;
const Util = imports.misc.util;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const UUID = "duolingo-helper@nodeengineer.com";
const Lang = imports.lang;

const APPLET_PATH = global.userdatadir + "/applets/" + UUID;

const soupASyncSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(soupASyncSession, new Soup.ProxyResolverDefault());

const Secret = imports.gi.Secret;
const PASSWORD_SCHEMA = new Secret.Schema("org.freedesktop.Secret.Generic",
    Secret.SchemaFlags.NONE,
    {
        "site": Secret.SchemaAttributeType.STRING
    }
);
let credentials = "";
this.token = "";

function MyApplet(orientation, panelHeight, instanceId) {
  this._init(orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _init: function(orientation, panelHeight, instanceId) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

    try {
      this.set_applet_icon_name("duolingo");
      this.set_applet_label("");
      this.set_applet_tooltip("Practise with Duolingo");

      this.credentials_search();

      this.menuManager = new PopupMenu.PopupMenuManager(this);

      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);

      this.box = new St.BoxLayout({ height: 30, width: 300 });
      this.menu.addActor(this.box);

      this.crownBox = new St.BoxLayout({ style_class: "top-box" });
      this.crownIcon = new St.Icon({ gicon: Gio.icon_new_for_string(APPLET_PATH + "/crown.png"), style_class: "icon" });
      this.crownLabel = new St.Label({ style_class: "label", y_align: 2 });
      this.crownBox.add(this.crownIcon);
      this.crownBox.add(this.crownLabel);
      this.box.add(this.crownBox);

      this.streakBox = new St.BoxLayout({ style_class: "top-box" });
      this.streakIcon = new St.Icon({ gicon: Gio.icon_new_for_string(APPLET_PATH + "/flame.png"), style_class: "icon" });
      this.streakLabel = new St.Label({ style_class: "label", y_align: 2 });
      this.streakBox.add(this.streakIcon);
      this.streakBox.add(this.streakLabel);
      this.box.add(this.streakBox);

      this.lingotBox = new St.BoxLayout({ style_class: "top-box" });
      this.lingotIcon = new St.Icon({ gicon: Gio.icon_new_for_string(APPLET_PATH + "/diamond.png"), style_class: "icon" });
      this.lingotLabel = new St.Label({ style_class: "label", y_align: 2 });
      this.lingotBox.add(this.lingotIcon);
      this.lingotBox.add(this.lingotLabel);
      this.box.add(this.lingotBox);

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this.bottomBox = new St.BoxLayout( { style_class: "bottom-box" } );
      this.menu.addActor(this.bottomBox);

      this.button = new St.Button({ style_class: "button", label: "Practise", hover: true});
      this.button.connect('clicked', function() { GLib.spawn_command_line_async("xdg-open 'https://duolingo.com'"); } );
      this.bottomBox.add(this.button);


    }
    catch (e) {
      global.log("DUO error: " + e);
    }
  },

  on_applet_clicked: function(event) {
    this.credentials_search();
    this.menu.toggle();
  },

  credentials_search: function() {
    let self = this;
    Secret.password_lookup(PASSWORD_SCHEMA, { "site": "duolingo.com" },
                       null, self.on_credentials_lookup.bind(self));
  },

  on_credentials_lookup: function (source, result) {
    let self = this;
    this.credentials = Secret.password_lookup_finish(result);
    if (this.credentials == null){
      self.set_applet_label("Unauthorized");
      self.store_credentials();
      this.credentials = Secret.password_lookup_finish(result);
    }
    this.login(self.credentials, self.getData.bind(self));
  },

  store_credentials: function () {

    let loop = GLib.MainLoop.new(null, false);

    // A simple asynchronous read loop
    function readOutput(stream, lineBuffer) {
        stream.read_line_async(0, null, (stream, res) => {
            try {
                let line = stream.read_line_finish_utf8(res)[0];

                if (line !== null) {
                    lineBuffer.push(line);
                    readOutput(stream, lineBuffer);
                }
            } catch (e) {
                logError(e);
            }
        });
    }

    try {
        let [, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
            // Working directory, passing %null to use the parent's
            null,
            // An array of arguments
            ["zenity", "--username", "--password", "--title=Please enter your Duolingo credentials"],
            // Process ENV, passing %null to use the parent's
            null,
            // Flags; we need to use PATH so `ls` can be found and also need to know
            // when the process has finished to check the output and status.
            GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
            // Child setup function
            null
        );

        // Any unsused streams still have to be closed explicitly, otherwise the
        // file descriptors may be left open
        GLib.close(stdin);

        // Okay, now let's get output stream for `stdout`
        let stdoutStream = new Gio.DataInputStream({
            base_stream: new Gio.UnixInputStream({
                fd: stdout,
                close_fd: true
            }),
            close_base_stream: true
        });

        // We'll read the output asynchronously to avoid blocking the main thread
        let stdoutLines = [];
        readOutput(stdoutStream, stdoutLines);

        // We want the real error from `stderr`, so we'll have to do the same here
        let stderrStream = new Gio.DataInputStream({
            base_stream: new Gio.UnixInputStream({
                fd: stderr,
                close_fd: true
            }),
            close_base_stream: true
        });

        let stderrLines = [];
        readOutput(stderrStream, stderrLines);

        // Watch for the process to finish, being sure to set a lower priority than
        // we set for the read loop, so we get all the output
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT_IDLE, pid, (pid, status) => {
            if (status === 0) {
                let self = this;
                Secret.password_store(PASSWORD_SCHEMA, {"site": "duolingo.com"}, Secret.COLLECTION_DEFAULT,
                  "Duolingo", stdoutLines.join('\n'), null, self.credentials_search.bind(self));

            } else {
                logError(new Error(stderrLines.join('\n')));
            }

            // Ensure we close the remaining streams and process
            stdoutStream.close(null);
            stderrStream.close(null);
            GLib.spawn_close_pid(pid);

            loop.quit();
        });
    } catch (e) {
        logError(e);
        loop.quit();
    }

    loop.run();
  },

  login: function (password, callback) {
    let self = this;

    if ( typeof self.token == 'undefined' || self.token == null ){
      let request = Soup.Message.new("POST", "https://www.duolingo.com/login");
    
      let credentials_json = `{"login": "${self.credentials.split("|")[0]}", "password": "${self.credentials.split("|")[1]}"}`;
      request.set_request("application/json", 2, credentials_json);
    
      soupASyncSession.queue_message(request, function(soupASyncSession, message){
        if (message.status_code !== 200) {
          self.set_applet_label("Connerror");
          return;
        };
        self.token = message.response_headers.get_one("jwt");
      callback(self.token);
      });
    } else {
      callback(self.token);
    }
  },

  getData: function(token) {

    let request = Soup.Message.new("GET", `https://www.duolingo.com/users/${this.credentials.split("|")[0]}`);
    request.request_headers.append('Authorization', `Bearer ${token}`);
    request.request_headers.set_content_type("application/json", null);

    let self = this;
    
    soupASyncSession.queue_message(request, function(soupASyncSession, message) {
      if (message.status_code !== 200) {
        if (message.status_code == 401) {
          self.set_applet_label("Unauthorized");
          Secret.password_clear(PASSWORD_SCHEMA, { "site": "duolingo.com" },
                              null, self.credentials_search.bind(self));
          global.log("DUO 'unauthorized' error: " + message.status + " " + request.response_body.data);
        }
        return;
      };
      let responseParsed = JSON.parse(request.response_body.data);

      let language_one = Object.keys(responseParsed.language_data)[0];

      ////////// Crowns //////////
      let skills = responseParsed.language_data[language_one].skills;

      let crowns = 0;
      for (let skill of skills){
        crowns += skill.skill_progress.level;
      }
      self.crownLabel.set_text(crowns.toString());

      ////////// Streak //////////
      self.streakLabel.set_text((responseParsed.language_data[language_one].streak).toString());

      ////////// Lingots //////////
      self.lingotLabel.set_text((responseParsed.rupees).toString());

      ////////// XP //////////
      let daily_goal = responseParsed.daily_goal.toString();

      // calculate epoch of last midnight
      let d = new Date();
      let midnight = d.getTime() - (d.getHours() * 3600 * 1000) - (d.getMinutes() * 60 * 1000) - (d.getSeconds() * 1000);

      // collect exercises done since midnight into an array
      let exercises_today = new Array();
      for (let exercise of responseParsed.calendar) {
        if (exercise.datetime > midnight) {
          exercises_today.push(exercise);
        };
      };

      // calculate XP gained since midnight
      let xp_today = 0;
      for (let exercise of exercises_today){
        xp_today += exercise.improvement;
      };

      // set icon color, display XP values
      if (xp_today < daily_goal) {
        self.set_applet_icon_path(APPLET_PATH + "/icon_red.png");
      } else {
        self.set_applet_icon_path(APPLET_PATH + "/icon.png");
      }
      self.set_applet_label(xp_today + "/" + daily_goal);

      setTimeout(self.credentials_search.bind(self), 30000);

    });
  },

};

function main(metadata, orientation, panelHeight, instanceId) {
  let myApplet = new MyApplet(orientation, panelHeight, instanceId);
  return myApplet;
}
