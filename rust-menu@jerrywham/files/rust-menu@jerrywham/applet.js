const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gettext = imports.gettext;
const UUID = "rust-menu@jerrywham";
const Util = imports.misc.util;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;
const HOME = GLib.get_home_dir();

//applet command constants
var CommandConstants = new function() {
  this.COMMAND_COOKBOOK = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/book/title-page.html";
  this.COMMAND_OPEN_DIR_PROJECTS = "nemo " + HOME + "\"/RUST PROJETS\"";

  this.COMMAND_BOOK_FIRST_EDITION = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/book/first-edition/index.html";
  this.COMMAND_RUST_BY_EXAMPLE = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/rust-by-example/index.html";
  this.COMMAND_CARGO_BOOK = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/cargo/index.html";
  this.COMMAND_RUSTC_BOOK = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/rustc/index.html";
  this.COMMAND_RUSTDOC_BOOK = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/rustdoc/index.html";

  this.COMMAND_STD = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/std/index.html";
  this.COMMAND_ALLOC = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/alloc/index.html";
  this.COMMAND_CORE = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/core/index.html";
  this.COMMAND_PROC_MACRO = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/proc_macro/index.html";
  this.COMMAND_TEST = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/test/index.html";

  this.COMMAND_EDITION_GUIDE = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/edition-guide/index.html";
  this.COMMAND_REFERENCE_GUIDE = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/reference/index.html";
  this.COMMAND_EMBEDDED_BOOK = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/embedded-book/index.html";
  this.COMMAND_RUSTONOMICON_BOOK = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/nomicon/index.html";
  this.COMMAND_UNSTABLE_BOOK = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/unstable-book/index.html";

  this.COMMAND_NURSERY = "xdg-open https://rust-lang-nursery.github.io/rust-cookbook/intro.html";
}


Gettext.bindtextdomain(UUID, HOME + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function checkService(service) {
  let s=GLib.spawn_async_with_pipes(null, ["pgrep",service], null, GLib.SpawnFlags.SEARCH_PATH,null)
  let c=GLib.IOChannel.unix_new(s[3])

  let [res, pid, in_fd, out_fd, err_fd] =
    GLib.spawn_async_with_pipes(null, ["pgrep",service], null, GLib.SpawnFlags.SEARCH_PATH, null);

  let out_reader = new Gio.DataInputStream({ base_stream: new Gio.UnixInputStream({fd: out_fd}) });

  let [out, size] = out_reader.read_line(null);

  var result = false;
  if(out != null) {
    result = true;
  }

  return result;
}


function MyApplet(orientation){
  this._init(orientation);
}

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function(orientation){
    Applet.IconApplet.prototype._init.call(this, orientation);
    this.set_applet_icon_path(AppletDir + '/icon2.svg');
    this.set_applet_tooltip("Rust Menu");

    //setup a new menuManager and add the main context main to the manager

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    let item = new PopupMenu.PopupIconMenuItem(_("Open cook book"), "accessories-dictionary", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_COOKBOOK);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Open projects directory"), "folder", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_OPEN_DIR_PROJECTS);
    }));
    this.menu.addMenuItem(item);

    //add a separator to separate the toggle buttons and actions
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = new PopupMenu.PopupIconMenuItem(_("First edition of cook book"), "accessories-dictionary", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_BOOK_FIRST_EDITION);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Rust by example"), "accessories-dictionary", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_RUST_BY_EXAMPLE);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Cargo book"), "package-x-generic", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_CARGO_BOOK);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Rustc book"), "accessories-dictionary", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_RUSTC_BOOK);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Rustdoc book"), "accessories-dictionary", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_RUSTDOC_BOOK);
    }));
    this.menu.addMenuItem(item);

    //add a separator to separate the toggle buttons and actions
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = new PopupMenu.PopupIconMenuItem(_("Create std"), "application-x-executable", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_STD);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Create alloc"), "application-x-executable", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_ALLOC);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Create core"), "application-x-executable", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_CORE);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Create proc_macro"), "application-x-executable", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_PROC_MACRO);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Create test"), "application-x-executable", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_TEST);
    }));
    this.menu.addMenuItem(item);

    //add a separator to separate the toggle buttons and actions
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


    item = new PopupMenu.PopupIconMenuItem(_("Edition guide"), "x-office-document", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_EDITION_GUIDE);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Reference guide"), "x-office-document", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_REFERENCE_GUIDE);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Embedded book"), "x-office-document", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_EMBEDDED_BOOK);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Rustonomicon book"), "x-office-document", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_RUSTONOMICON_BOOK);
    }));
    this.menu.addMenuItem(item);

    item = new PopupMenu.PopupIconMenuItem(_("Unstable book"), "x-office-document", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_UNSTABLE_BOOK);
    }));
    this.menu.addMenuItem(item);

    //add a separator to separate the toggle buttons and actions
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    item = new PopupMenu.PopupIconMenuItem(_("Launch Nursery"), "network-workgroup", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        Util.spawnCommandLine(CommandConstants.COMMAND_NURSERY);
    }));
    this.menu.addMenuItem(item);

  },

  on_applet_clicked: function(){
    this.menu.toggle();
  },
}


function main(metadata, orientation){
  let myApplet = new MyApplet(orientation);
  return myApplet;
}
