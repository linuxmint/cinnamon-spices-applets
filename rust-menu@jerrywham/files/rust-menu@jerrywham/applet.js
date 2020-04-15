const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
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
  //this.COMMAND_BOOK_FIRST_EDITION = "xdg-open https://doc.rust-lang.org/1.18.0/book/first-edition/README.html";

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
    // this.set_applet_icon_symbolic_name("folder-symbolic");
    this.set_applet_icon_path(AppletDir + '/icon2.svg');
    this.set_applet_tooltip("Rust Menu");

    //setup a new menuManager and add the main context main to the manager

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    this.menu.addAction(_("Open cook book"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_COOKBOOK);
    });

    this.menu.addAction(_("Open projects directory"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_OPEN_DIR_PROJECTS);
    });

    //add a separator to separate the toggle buttons and actions
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this.menu.addAction(_("First edition of cook book"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_BOOK_FIRST_EDITION);
    });
    this.menu.addAction(_("Rust by example"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_RUST_BY_EXAMPLE);
    });
    this.menu.addAction(_("Cargo book"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_CARGO_BOOK);
    });
    this.menu.addAction(_("Rustc book"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_RUSTC_BOOK);
    });
    this.menu.addAction(_("Rustdoc book"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_RUSTDOC_BOOK);
    });

    //add a separator to separate the toggle buttons and actions
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this.menu.addAction(_("Create std"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_STD);
    });
    this.menu.addAction(_("Create alloc"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_ALLOC);
    });
    this.menu.addAction(_("Create core"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_CORE);
    });
    this.menu.addAction(_("Create proc_macro"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_PROC_MACRO);
    });
    this.menu.addAction(_("Create test"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_TEST);
    });

    //add a separator to separate the toggle buttons and actions
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this.menu.addAction(_("Edition guide"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_EDITION_GUIDE);
    });
    this.menu.addAction(_("Reference guide"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_REFERENCE_GUIDE);
    });
    this.menu.addAction(_("Embedded book"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_EMBEDDED_BOOK);
    });
    this.menu.addAction(_("Rustonomicon book"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_RUSTONOMICON_BOOK);
    });
    this.menu.addAction(_("Unstable book"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_UNSTABLE_BOOK);
    });
    
    //add a separator to separate the toggle buttons and actions
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this.menu.addAction(_("Launch Nursery"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_NURSERY);
    });

  },

  on_applet_clicked: function(){
    this.menu.toggle();
  },
}


function main(metadata, orientation){
  let myApplet = new MyApplet(orientation);
  return myApplet;
}
