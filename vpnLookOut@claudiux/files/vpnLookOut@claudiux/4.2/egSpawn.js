#!/usr/bin/cjs

/*
CJS/GJS example showing how to build Gtk javascript applications
executing a non blocking command line call, it uses
TextBuffer, TextView, GLib.spawn_async_with_pipes,
Gio.UnixInputStream, Gio.DataInputStream and read_line_async

Run it with:
    gjs egSpawn.js
or  cjs egSpawn.js
*/

const Gio   = imports.gi.Gio;
const GLib  = imports.gi.GLib;
const Gtk   = imports.gi.Gtk;
const Lang  = imports.lang;

const UUID = "vpnLookOut@claudiux";
const LOGFILE = "vpn_activity.log";

// Get application folder and add it into the imports path
function getAppFileInfo() {
    let stack = (new Error()).stack,
        stackLine = stack.split('\n')[1],
        coincidence, path, file;

    if (!stackLine) throw new Error('Could not find current file (1)');

    coincidence = new RegExp('@(.+):\\d+').exec(stackLine);
    if (!coincidence) throw new Error('Could not find current file (2)');

    path = coincidence[1];
    file = Gio.File.new_for_path(path);
    return [file.get_path(), file.get_parent().get_path(), file.get_basename()];
}
const path = getAppFileInfo()[1];
imports.searchPath.push(path);

// Import spawn library
const Spawn = imports.assets.spawn;

const App = function () {

    this.title = 'VPN Look-Out';
    GLib.set_prgname(this.title);
};


App.prototype.run = function (ARGV) {

    this.application = new Gtk.Application();
    this.application.connect('activate', () => { this.onActivate(); });
    this.application.connect('startup', () => { this.onStartup(); });
    this.application.run([]);
};

App.prototype.onActivate = function () {

    this.window.show_all();
};

App.prototype.onStartup = function() {

    this.buildUI();
    this.spawn();
};

App.prototype.buildUI = function() {

    //let scroll;

    this.window = new Gtk.ApplicationWindow({ application: this.application,
                                              title: this.title,
                                              default_height: 200,
                                              default_width: 600,
                                              window_position: Gtk.WindowPosition.CENTER });
    try {
        this.window.set_icon_from_file(path + '/../icon.png');
    } catch (err) {
        this.window.set_icon_name('application-x-executable');
    }

    // Header with Refresh button
    this.window.set_titlebar(this.getHeader());

    // Scrolled view
    this.scroll = new Gtk.ScrolledWindow({ vexpand: true });
    this.buffer = new Gtk.TextBuffer();
    this.view = new Gtk.TextView();
    this.view.set_buffer(this.buffer);

    this.scroll.add(this.view);
    this.window.add(this.scroll);
    // Scroll entirely:
    this.end_iter = this.buffer.get_end_iter();
    this.buffer.place_cursor(this.end_iter);
};

App.prototype.getHeader = function () {

    let headerBar, headerStart, imageRefresh, buttonRefresh;

    headerBar = new Gtk.HeaderBar();
    headerBar.set_title(this.title);
    headerBar.set_subtitle("Activity Log");
    headerBar.set_show_close_button(true);

    headerStart = new Gtk.Grid({ column_spacing: headerBar.spacing });

    imageRefresh = new Gtk.Image ({ icon_name: 'view-refresh-symbolic', icon_size: Gtk.IconSize.SMALL_TOOLBAR });
    buttonRefresh = new Gtk.Button({ image: imageRefresh });
    buttonRefresh.connect ('clicked', () => {
        this.buffer.delete(this.buffer.get_iter_at_line(0), this.buffer.get_end_iter());
        this.end_iter = this.buffer.get_end_iter();
        GLib.spawn_command_line_async("bash -c 'kill -15 "+ this.reader.pid +"'");
        this.spawn();
    });

    headerStart.attach(buttonRefresh, 1, 0, 1, 1);
    headerBar.pack_end(headerStart);

    return headerBar;
};


App.prototype.spawn = function() {

    this.reader = new Spawn.SpawnReader();
    //reader.spawn('./', ['ls', '-ltr', '.'], (line) => {
        //this.buffer.insert_at_cursor(String(line) + '\n', -1);
    //});

    //let d = new Date();
    //let epoch_to_now = Math.round(Date.parse(d) / 1000);
    //this.buffer.insert_at_cursor(epoch_to_now.toString() + '\n', -1);
    ////this.buffer.create_tag("bold", "weight", 700, null);
    let vadj;
    let logFile = GLib.get_home_dir() + "/.cinnamon/configs/" + UUID + "/vpn_activity.log";
    // Example of 'continuous' read with 'tail':
    this.reader.spawn('./', ['tail', '--lines=+1', '-f', logFile], (line) => {
        this.buffer.place_cursor(this.end_iter);
        this.buffer.insert_at_cursor(String(line) + '\n', -1);
        vadj = this.scroll.get_vadjustment();
        vadj.set_value(vadj.get_upper());
        this.end_iter = this.buffer.get_end_iter()
        this.buffer.place_cursor(this.end_iter);
    });

};

//Run the application
let app = new App();
app.run(ARGV);
