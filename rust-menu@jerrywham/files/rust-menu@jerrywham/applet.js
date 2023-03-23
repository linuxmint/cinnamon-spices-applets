const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gettext = imports.gettext;
const UUID = "rust-menu@jerrywham";
const Util = imports.misc.util;
const Lang = imports.lang;
const Settings = imports.ui.settings;  // Needed for settings API
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;
const HOME = GLib.get_home_dir();

//applet command constants
var CommandConstants = new function() {
  this.COMMAND_COOKBOOK = "xdg-open file://" + HOME + "/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/html/book/title-page.html";
  this.COMMAND_OPEN_DIR_PROJECTS = "nemo ";

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

function MyApplet(orientation, metadata, panelHeight,  instance_id){
  this._init(orientation, metadata, panelHeight,  instance_id);
}

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function(orientation, metadata, panelHeight,  instance_id){
    Applet.IconApplet.prototype._init.call(this, orientation, panelHeight,  instance_id);

    this.instance_id = instance_id;

    try {

      this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id)

      this.settings.bindProperty(
        Settings.BindingDirection.IN,
        "use-custom-directory",
        "use_custom_directory",
        this.on_settings_changed,
        null);
      this.settings.bindProperty(
      Settings.BindingDirection.IN,
        "custom-directory",
        "custom_directory",
        null,
        null);
      this.settings.bindProperty(
        Settings.BindingDirection.IN,
          "keybinding-project",
          "keybinding_project",
          this.on_keybinding_project_changed,
          null);
      this.settings.bindProperty(
        Settings.BindingDirection.IN,
          "keybinding-documentation",
          "keybinding_documentation",
          this.on_keybinding_doc_changed,
          null);

      this.set_applet_icon_path(AppletDir + '/icon.svg');
      this.set_applet_tooltip("Rust Menu");

      this.on_keybinding_doc_changed();
      this.on_keybinding_project_changed();
      this.on_setting_changed();

    }
    catch (e) {
        global.logError(e);
    }

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
        Util.spawnCommandLine(CommandConstants.COMMAND_OPEN_DIR_PROJECTS + "\""+ this.custom_directory + "\"");
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
  on_settings_changed: function() {
    if (this.use_custom_directory) {
        this.settings.bindProperty(
        Settings.BindingDirection.IN,
        "custom-directory",
        "custom_directory",
        null,
        null);
    } else {
        this.settings.setValue('custom-directory', this.settings.getDefaultValue('custom-directory'));
    }
  },
   on_keybinding_doc_changed: function() {
      Main.keybindingManager.addHotKey("hotkey-doc", this.keybinding_documentation, Lang.bind(this, this.on_hotkey_doc_triggered));
   },
   on_keybinding_project_changed: function() {
      Main.keybindingManager.addHotKey("hotkey-project", this.keybinding_project, Lang.bind(this, this.on_hotkey_project_triggered));
   },
   on_hotkey_doc_triggered: function() {
      Util.spawnCommandLine(CommandConstants.COMMAND_COOKBOOK);
  },
   on_hotkey_project_triggered: function() {
      Util.spawnCommandLine(CommandConstants.COMMAND_OPEN_DIR_PROJECTS + "\""+ this.custom_directory + "\"");
  },
  on_applet_clicked: function(){
    this.menu.toggle();
  },
  on_applet_removed_from_panel() {
      this.settings.finalize();    // This is called when a user removes the applet from the panel.. we want to
                                   // Remove any connections and file listeners here, which our settings object
                                   // has a few of
  }
}

function main(metadata, orientation, panelHeight,  instance_id){
  let myApplet = new MyApplet(orientation, metadata, panelHeight,  instance_id);
  return myApplet;
}
