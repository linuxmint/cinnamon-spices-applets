const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;
const Lang = imports.lang;

const UUID="VPN-Sentinel@claudiux";
const LOG_FILE_PATH = GLib.get_home_dir() + "/.cinnamon/configs/" + UUID + "/vpn_activity.log";

class ActivityLogging {
  constructor(metadata, nbdays=30, active=true) {
    this.metadata = metadata;
    this.user_language = this._get_user_language;
    //this.uuid = metadata.uuid;
    GLib.spawn_command_line_async("bash -c 'touch "+ LOG_FILE_PATH +"'");
    this.time_options = {
      year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
      hour12: !this._get_system_use24h(), timeZone: this._get_timezone(), timeZoneName: "short"
    };
    this.set_lifetime(nbdays); // to cut logfile
    this.latest_messages_and_timestamps = {};
    this.waiting_messages = [];
    this.set_active(active);
  } // End of constructor

  _get_epoch(d) {
    return Math.round(Date.parse(d)/1000); // timestamp in seconds
  } // End of _get_epoch

  _get_system_use24h() {
    let _SETTINGS_SCHEMA='org.cinnamon.desktop.interface';
    let _SETTINGS_KEY = 'clock-use-24h';
    let _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
    let ret = _interface_settings.get_boolean(_SETTINGS_KEY);
    return ret
  } // End of get_system_icon_theme

  _get_timezone() {
    // Tip found at https://stackoverflow.com/a/34602679/12882809
    // Returns time zone as 'Europe/Paris':
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } // End of _get_timezone

  _get_user_language() {
    return GLib.getenv("LANG").split(".")[0].replace("_","-")
  } // End of get_user_language

  set_active(active) {
    this.is_active = active;
    if (active) {
      // Run the loop!
      Mainloop.timeout_add(600, Lang.bind(this, this.process_waiting_messages));
    }
  } // End of set_active

  set_lifetime(days) {
    this.lifetime = 86400 * days; // 1 day = 86400 seconds
  } // End of set_lifetime

  clear_log_file() {
    if (!this.is_active) return;

    let date = new Date();
    let old_life_time = this.lifetime;
    this.lifetime = 0;
    this.truncate_log_file();
    this.lifetime = old_life_time;
  } // End of clear_log_file

  truncate_log_file() {
    if (!this.is_active) return;

    let date = new Date();
    let limit = this._get_epoch(date)-this.lifetime;

    // Read file contents (async):
    Cinnamon.get_file_contents_utf8(LOG_FILE_PATH, Lang.bind(this, (utf8_contents) => {
      let contents = utf8_contents.split("\n");
      var epoch_date, new_contents = [];
      // keep recent lines:
      for (let line of contents) {
        if (line.length !== 0) {
          epoch_date = eval(line.split("|")[0].valueOf());
          if (epoch_date > limit) new_contents.push(line.trim());
        }
      }

      // Write new contents in log file
      if (new_contents.length !== contents.length) {
        let file = Gio.file_new_for_path(LOG_FILE_PATH);
        let raw = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let out = Gio.BufferedOutputStream.new_sized (raw, 4096);
        for (let line of new_contents) {
          Cinnamon.write_string_to_stream(out, line + "\n")
        }
        out.close(null);
      }
      contents = []; new_contents = [];
    }));
    this.latest_messages_and_timestamps = {};
  } // End of truncate_log_file

  display_logs() {
    let command = `bash -c '%s/scripts/watch-log2.sh'`.format(this.metadata.path);
    GLib.spawn_command_line_async(command);
  } // End of display_logs

  log(s) {
    if (!this.is_active) return;

    let d = new Date();
    let d_epoch = this._get_epoch(d);

    //~ global.log("d_epoch: "+d_epoch);
    //~ global.log("latest_messages_and_timestamps["+s+"]: "+this.latest_messages_and_timestamps[""+s]);

    if (  this.latest_messages_and_timestamps[""+s] !== undefined &&
          d_epoch - this.latest_messages_and_timestamps[""+s] < 15  ) {
      this.latest_messages_and_timestamps[""+s] = d_epoch;
      return;
    }
    this.latest_messages_and_timestamps[""+s] = d_epoch;
    this.waiting_messages.push(""+s)
  } // End of log

  process_waiting_messages() {
    if (this.waiting_messages.length === 0) return this.is_active;

    let s = this.waiting_messages.pop(0);
    //~ global.log("process_waiting_messages: "+s);

    let d_epoch = this.latest_messages_and_timestamps[""+s];
    let date_string = new Intl.DateTimeFormat(
      this.user_language,
      this.time_options
    ).format(1000 * d_epoch);
    let new_string = s.replace(/'/g, "'\\''");
    let command = `echo "%s|%s|%s" >> %s`.format(
      d_epoch,
      date_string,
      //To escape the single quote, close the quoting before it, insert the single quote, and re-open the quoting:
      new_string,
      LOG_FILE_PATH
    );

    GLib.spawn_command_line_async(`bash -c '%s'`.format(command));

    return this.is_active
  } // End of treat_waiting_messages
}; //End of class ActivityLogging

