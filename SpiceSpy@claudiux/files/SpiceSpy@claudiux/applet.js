const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;
const Clutter = imports.gi.Clutter;

var Util = imports.misc.util;

const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Lang = imports.lang;

const {
  reloadExtension,
  Type
} = imports.ui.extension; //Extension

const { HttpLib } = require("./lib/httpLib");
const { to_string } = require("./lib/to-string");
//mainloopTools:
const { _sourceIds, timeout_add_seconds, timeout_add, setTimeout, clearTimeout, setInterval, clearInterval, source_exists, source_remove, remove_all_sources } = require("./lib/mainloopTools");

const UUID = "SpiceSpy@claudiux";

const HOME_DIR = GLib.get_home_dir();

const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const SCRIPTS_DIR = APPLET_DIR + "/scripts";
const CACHE_UPDATER = SCRIPTS_DIR + "/spices-cache-updater.py";
const CACHE_INIT = SCRIPTS_DIR + "/spices-cache-init.sh";

const TYPES = ["actions", "applets", "desklets", "extensions", "themes"];
const SPICES_URL = "https://cinnamon-spices.linuxmint.com";
const HTML_COUNT_ID = "count";

// <h3 class="cs-comments-amount"><span id="count">173</span> Comments</h3>
//~ const COMMENTS_REGEX = new RegExp(`<[a-z]+ id="${HTML_COUNT_ID}">([0-9]+)</[a-z]+>`);
const COMMENTS_REGEX = new RegExp(`<span id="${HTML_COUNT_ID}">([0-9]+)</span>`);
const ISSUES_REGEX = new RegExp(`([0-9]+) Open`);

const DIR_MAP = {
  "applets": HOME_DIR + "/.local/share/cinnamon/applets",
  "themes": HOME_DIR + "/.themes",
  "desklets": HOME_DIR + "/.local/share/cinnamon/desklets",
  "extensions": HOME_DIR + "/.local/share/cinnamon/extensions",
  "actions": HOME_DIR + "/.local/share/nemo/actions"
}

const Gettext = imports.gettext;
//~ Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");

function _(str, uuid=UUID) {
  if (str == null) return "";
  Gettext.bindtextdomain(uuid, HOME_DIR + "/.local/share/locale");
  let _str = Gettext.dgettext(uuid, str);
  if (_str !== str)
    return _str;
  // If the text was not found locally then try with system-wide translations:
  return Gettext.gettext(str);
}

const DEBUG = false;
/**
 * Usage of log and logError:
 * log("Any message here") to log the message only if DEBUG() returns true.
 * log("Any message here", true) to log the message even if DEBUG() returns false.
 * logError("Any error message") to log the error message regardless of the DEBUG() return.
 */
function log(message, alwaysLog=false) {
  if (DEBUG || alwaysLog) Main._logInfo("[" + UUID + "]: " + message);
}

function logDebug(message) {
  log(message, true)
}

function logError(error) {
  global.logError("\n[" + UUID + "]: " + error + "\n")
}

var SpiceSpyPopupSubMenuMenuItem = class SpiceSpyPopupSubMenuMenuItem extends PopupMenu.PopupSubMenuMenuItem {
  _init(text, needScrollbar=true) {

    super._init.call(this);

    this.needScrollbar = needScrollbar;

    let icon_box = new St.BoxLayout({ style: 'spacing: .25em;' });
    //~ logDebug("icon_box: "+icon_box);

    let cinnamon_icon = new St.Icon({ icon_name: 'cinnamon-symbolic', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
    icon_box.add_actor(cinnamon_icon);
    this.addActor(icon_box, { expand: false, span: 1, align: St.Align.MIDDLE });
    //~ this.addActor(icon_box);

    this._triangle = null;

    // This check allows PopupSubMenu to be used as a generic scrollable container.
    if (typeof text === 'string') {
      this.actor.add_style_class_name('popup-submenu-menu-item');

      this.label = new St.Label({ text: text,
                                  y_expand: true,
                                  y_align: Clutter.ActorAlign.CENTER });
      //~ this.label = new St.Label({ text: text });
      //~ this.addActor(this.label);
      this.addActor(this.label, { expand: true,
                                         span: 0,
                                         align: St.Align.START });
      this.actor.label_actor = this.label;

      this._triangleBin = new St.Bin({ x_align: St.Align.END });
      this.addActor(this._triangleBin, { expand: true,
                                         span: -1,
                                         align: St.Align.END });

      this._triangle = PopupMenu.arrowIcon(St.Side.RIGHT);
      this._triangle.pivot_point = new Clutter.Point({ x: 0.5, y: 0.5 });
      this._triangleBin.child = this._triangle;
    }

    this.menu = new PopupMenu.PopupSubMenu(this.actor, this._triangle);
    //~ this._signals.connect(this.menu, 'open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
    this._signals.connect(this.menu, 'open-state-changed', () => { this._subMenuOpenStateChanged(); });
  }

  _subMenuOpenStateChanged(menu, open) {
        if (this.actor.get_stage() == null) return;
        this.actor.change_style_pseudo_class('open', open);
    }

  _needsScrollbar() {
    return this.needScrollbar;
    //~ if (!this.needScrollbar) return false;

    //~ let topMenu = this._getTopMenu();
    //~ if(!topMenu)
      //~ return false;
    //~ if(!topMenu.actor)
      //~ return false;
    //~ if(!topMenu.actor.get_layout_manager())
      //~ return false;
    //~ let [topMinHeight, topNaturalHeight] = topMenu.actor.get_preferred_height(-1);
    //~ let topThemeNode = null;

    //~ try {
      //~ topThemeNode = topMenu.actor.get_theme_node();
    //~ } catch(e) {
      //~ topThemeNode = null;
    //~ }
    //~ if (!topThemeNode) return false;

    //~ let topMaxHeight = topThemeNode.get_max_height();
    //~ return topMaxHeight >= 0 && topNaturalHeight >= topMaxHeight;
  }

  _boxGetPreferredWidth (actor, forHeight, alloc) {
        let columnWidths = this.getColumnWidths();
        this.setColumnWidths(columnWidths);

        // Now they will request the right sizes
        [alloc.min_size, alloc.natural_size] = this.box.get_preferred_width(forHeight || 0);
    }

    _boxGetPreferredHeight (actor, forWidth, alloc) {
        [alloc.min_size, alloc.natural_size] = this.box.get_preferred_height(forWidth || 0);
    }
}

var SpiceMenuItem = class SpiceMenuItem extends PopupMenu.PopupBaseMenuItem {
  constructor(parent, spice, new_stars, new_comments, new_translations, params) {
    super(params);
    this.parent = parent;
    this.spice = spice;
    this.new_stars = new_stars; // boolean
    this.new_comments = new_comments; // boolean
    this.new_translations = new_translations; // boolean
    this.url = this.spice.url;

    let label_text;
    if (parent.show_uuid) {
      label_text = spice.uuid;
    } else {
      if (parent.translate_name)
        label_text = _(spice.name, spice.uuid);
      else
        label_text = spice.name;
    }
    let label = new St.Label({ text: label_text, reactive: true, track_hover: true });

    let label_box = new St.BoxLayout({ style: "spacing: .25em;", reactive: true, track_hover: true });
    label_box.add_actor(label);
    label_box.connect("enter-event", () => { this.url = this.spice.url });
    this.addActor(label_box);



    let stars_box = new St.BoxLayout({ style: "spacing: .25em;" , reactive: true, track_hover: true, can_focus: true });
    let star_icon = new St.Icon({ icon_name: "starred", icon_type: St.IconType.SYMBOLIC, style_class: "popup-menu-icon" });
    let star_count = new St.Label({ text: spice.score.toString() });
    stars_box.add_actor(star_icon);
    stars_box.add_actor(star_count);
    let stars_tooltip = new Tooltips.Tooltip(stars_box, _("score"));
    stars_box.connect("enter-event", () => { this.url = this.spice.url });
    this.addActor(stars_box);
    stars_box.opacity = (this.new_stars) ? 255 : this.parent.standard_opacity;
    if (this.new_stars) stars_box.set_style("color: %s;".format(this.parent.color_on_change));


    this.comments_box = new St.BoxLayout({ style: "spacing: .25em;", reactive: true, track_hover: true, can_focus: true });
    let comments_icon = new St.Icon({ icon_name: "user-available", icon_type: St.IconType.SYMBOLIC, style_class: "popup-menu-icon" });
    this.comments_label = new St.Label({ text:  spice.comments.toString()});
    this.comments_box.add_actor(comments_icon);
    this.comments_box.add_actor(this.comments_label);
    let comments_tooltip = new Tooltips.Tooltip(this.comments_box, _("comments"));
    //~ this.comments_box.track_hover = true;
    this.comments_box.connect("enter-event", () => { this.url = this.spice.url+"#count" });
    this.addActor(this.comments_box);
    this.comments_box.opacity = (this.new_comments) ? 255 : this.parent.standard_opacity;
    if (this.new_comments) this.comments_box.set_style("color: %s;".format(this.parent.color_on_change));

    if (this.parent.show_issues) {
      let issues_box = new St.BoxLayout({ style: "spacing: .25em;", reactive: true, track_hover: true, can_focus: true });
      let issues_icon = new St.Icon({ icon_name: "nb-issues", icon_type: St.IconType.SYMBOLIC, style_class: "popup-menu-icon" });
      let issues_count = new St.Label({ text: spice.issues.toString() });
      issues_box.add_actor(issues_icon);
      issues_box.add_actor(issues_count);
      let issues_tooltip = new Tooltips.Tooltip(issues_box, _("recent issues"));
      issues_box.connect("enter-event", () => { this.url = "https://github.com/linuxmint/cinnamon-spices-"+this.spice.type+"/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aopen+"+this.spice.uuid; });
      this.addActor(issues_box);
      issues_box.opacity = (parseInt(spice.issues) != 0) ? 255 : this.parent.standard_opacity;
    }
    let translations_box, translations_icon, translations_count;
    if (this.parent.show_translations && this.spice.type != "themes") {
      translations_box = new St.BoxLayout({ style: "spacing: .25em;", reactive: true, track_hover: true, can_focus: true });
      translations_icon = new St.Icon({ icon_name: "nb-translations", icon_type: St.IconType.SYMBOLIC, style_class: "popup-menu-icon" });
      translations_count = new St.Label({ text: spice.translations.toString() });
      translations_box.add_actor(translations_icon);
      translations_box.add_actor(translations_count);
      let translations_tooltip = new Tooltips.Tooltip(translations_box, _("translations"));
      translations_box.connect("enter-event", () => { this.url = "https://github.com/linuxmint/cinnamon-spices-%s/blob/translation-status-tables/.translation-tables/tables/%s.md".format(this.spice.type, this.spice.uuid) });
      this.addActor(translations_box);
      translations_box.opacity = (this.new_translations) ? 255 : this.parent.standard_opacity;
      if (this.new_translations) translations_box.set_style("color: %s;".format(this.parent.color_on_change));
    }
    if (this.parent.show_translations && this.spice.type === "themes") {
      translations_box = new St.BoxLayout({ style: "spacing: .25em;", reactive: false, track_hover: false, can_focus: false });
      translations_icon = new St.Icon({ icon_name: "empty", icon_type: St.IconType.SYMBOLIC, style_class: "popup-menu-icon" });
      translations_count = new St.Label({ text: "" });
      translations_box.add_actor(translations_icon);
      translations_box.add_actor(translations_count);
      translations_box.opacity = 0;
      this.addActor(translations_box);
    }

    if (this.parent.show_icon_in_menu) {
      let icon_box = new St.BoxLayout({ style: "spacing: .25em;", reactive: true, track_hover: true });
      let icon_path = HOME_DIR+"/.cache/cinnamon/spices/"+spice.type.slice(0,-1)+"/"+spice.uuid+".png";
      let icon_file = Gio.file_new_for_path(icon_path);
      let icon;
      if (icon_file.query_exists(null)) {
        let gicon = Gio.icon_new_for_string(icon_path);
        icon = new St.Icon({ gicon: gicon, icon_type: St.IconType.FULLCOLOR, icon_size: this.parent.icon_size });
      } else {
        let icon_name = "spices-"+spice.type;
        //~ icon_file = Gio.file_new_for_path(icon_path);
        icon = new St.Icon({ icon_name, icon_type: St.IconType.SYMBOLIC, icon_size: this.parent.icon_size });
      }
      icon_box.add_actor(icon);
      icon_box.connect("enter-event", () => { this.url = this.spice.url });
      this.addActor(icon_box);
    }
  }

  activate() {
    Util.spawn(["xdg-open", this.url]);
    this.update_comment_count(0);
    super.activate();
  }

  update_comment_count(count) {
    if (!this.comments_label || !this.comments_box)
      return;

    this.comments_label.set_text(count.toString());
    if (count > 0) {
      this.comments_box.opacity = 255;
      //this.parent.add_unread(count);
    } else {
      this.comments_box.opacity = 128;
      this.parent.mark_as_read(this.spice);
    }
  }

  _boxGetPreferredWidth (actor, forHeight, alloc) {
    let columnWidths = this.getColumnWidths();
    this.setColumnWidths(columnWidths);

    // Now they will request the right sizes
    [alloc.min_size, alloc.natural_size] = this.box.get_preferred_width(forHeight || 0);
    }

    _boxGetPreferredHeight (actor, forWidth, alloc) {
        [alloc.min_size, alloc.natural_size] = this.box.get_preferred_height(forWidth || 0);
    }

  //~ destroy() {
    //~ this.comments_label = null;
    //~ this.comments_box = null;
    //~ super.destroy();
  //~ }
};

class TitleSeparatorMenuItem extends PopupMenu.PopupBaseMenuItem {
  constructor(title, icon_name) {
    super({ reactive: false });
    if (typeof icon_name === "string") {
      let icon = new St.Icon({ icon_name, icon_type: St.IconType.SYMBOLIC, style_class: "popup-menu-icon" });
      //~ this.addActor(icon, { span: 0 });
      this.addActor(icon);
    }
    this.label = new St.Label({ text: title, style_class: "popup-subtitle-menu-item" });
    this.addActor(this.label);
  }
}

const STAR_CHAR = "★";
const MESSAGE_CHAR = "✉";
const FLAG_CHAR = "⚑";

class SpiceSpy extends Applet.TextIconApplet {
  constructor(metadata, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
    this.metadata = metadata;
    this.orientation = orientation;
    this.set_applet_icon_symbolic_name("cinnamon");
    this.set_applet_label("");
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    //~ this.menu = new PopupMenu.PopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    this.issuesJsonLoopId = null;
    this.authors = [];
    this.uuids = [];
    this.commentsJobsList = []; // contains array items: [type, spice, page].
    this.issuesJobsList = [];

    this.fistTime = true;
    this.loopId = null;
    this.jobsLoopId = null;
    this.issuesLoopId = null;
    this.is_looping = true;

    this.settings = new Settings.AppletSettings(this, UUID, instance_id);

  } // End of constructor

  get_user_settings() {
    this.settings.bind("update-interval-hours", "update_interval", () => { this.update_interval_value() });
    if (this.settings.getValue("update-interval") > 0) {
      // Converts old "update-interval" in minutes to new this.update_interval in hours.
      this.update_interval = 0.5 * Math.round(this.settings.getValue("update-interval") / 30);
      this.settings.setValue("update-interval", -1);
    }
    //~ this.settings.bind("standard-opacity", "standard_opacity", this.make_menu.bind(this));
    this.settings.bind("standard-opacity", "standard_opacity");
    //~ this.settings.bind("color-on-change", "color_on_change", this.make_menu.bind(this));
    this.settings.bind("color-on-change", "color_on_change", () => { this.make_menu() });
    //~ this.settings.bind("show-icon-in-menu", "show_icon_in_menu");
    this.show_icon_in_menu = true;
    this.settings.bind("icon-size", "icon_size");
    //~ this.settings.bind("show-translations", "show_translations");
    this.show_translations = true;
    this.settings.bind("show-issues", "show_issues");
    this.show_issues = true;
    this.settings.bind("sort-by", "sort_by");
    this.settings.bind("show-uuid", "show_uuid");
    this.settings.bind("translate-name", "translate_name");
    //~ this.settings.bind("display-on-panel", "display_on_panel", this.make_menu.bind(this));
    this.settings.bind("display-on-panel", "display_on_panel");
    //~ this.settings.bind("useful-only", "useful_only", this.make_menu.bind(this));
    this.settings.bind("useful-only", "useful_only", () => { this.make_menu() });
    this.settings.bind("author-list", "author_list", () => { this.update_authors() });
    this.settings.bind("uuid-list", "uuid_list", () => { this.update_uuids() });
    this.settings.bind("spices_to_spy", "spices_to_spy");
    this.settings.bind("old_spices_to_spy", "old_spices_to_spy");
  } // End of get_user_settings

  update_interval_value() {
    //~ this.update_interval = 0.5 * Math.round(this.update_interval * 2);
    const sec = Math.round(this.update_interval * 3600); // From hours to seconds.
    if (this.loopId != null) {
      let id = this.loopId;
      source_remove(id);
    }
    this.loopId = null;
    this.is_looping = true;
    this.loopId = timeout_add_seconds(sec, () => { this.loop() });
  }

  _add_user_Spices() { ///Used by the "Add all the Spices I use" button in settings.
    var userSpices = [];
    let gsettings;
    let children, info, file_type;
    var name;

    for (let type of TYPES) {
      let index = (type == "applets") ? 3 : 0;
      let dir = Gio.file_new_for_path(DIR_MAP[type]);
      if (!dir.query_exists(null)) continue;
      switch (type) {
        case "actions":
          let disabled_actions = [];
          gsettings = Gio.Settings.new("org.nemo.plugins");
          disabled_actions = gsettings.get_strv("disabled-actions");
          let enabled_actions = [];
          children = dir.enumerate_children("standard::name,standard::type,standard::icon", Gio.FileQueryInfoFlags.NONE, null);

          while ((info = children.next_file(null)) != null) {
            file_type = info.get_file_type();
            if (file_type !== Gio.FileType.DIRECTORY) {
              name = info.get_name();
              if (userSpices.indexOf(name) < 0 && disabled_actions.indexOf(name) < 0) {
                userSpices.push(name.slice(0, - ".nemo_action".length));
              }
            }
          }
          children.close(null);
          break;
        case "applets":
        case "desklets":
        case "extensions":
          let enabled = [];
          gsettings = Gio.Settings.new("org.cinnamon");
          enabled = gsettings.get_strv("enabled-%s".format(type));
          for (let e of enabled) {
            let _name = e.split(":")[index];
            if (_name && !_name.endsWith("@cinnamon.org")) {
              userSpices.push(_name);
            }
          }
          break;
        case "themes":
          gsettings = Gio.Settings.new("org.cinnamon.theme");
          let theme_name = gsettings.get_string("name");
          children = dir.enumerate_children("standard::name,standard::type,standard::icon", Gio.FileQueryInfoFlags.NONE, null);
          while ((info = children.next_file(null)) != null) {
            file_type = info.get_file_type();
            if (file_type === Gio.FileType.DIRECTORY) {
              name = info.get_name();
              if (name === theme_name) {
                userSpices.push(name);
              }
            }
          }
          children.close(null);
      }
    }
    if (userSpices.length > 0) {
      var _uuid_list = this.uuid_list;
      for (let s of userSpices) {
        if (this.uuids.indexOf(s) < 0) {
          _uuid_list.push({ 'uuid': s });
        }
      }
      this.settings.setValue("uuid-list", _uuid_list);

      // Loop next tick (value 0) to ensure that this.actor is on stage:
      setTimeout(() => this.loop(), 0);
    }
  } // End of _add_user_Spices

  nothing_to_spy() {
    return (this.authors.length === 0 && this.uuids.length === 0);
  } // End of nothing_to_spy

  is_empty() {
    const keys_spices_to_spy = Object.keys(this.spices_to_spy);
    return (keys_spices_to_spy.length < 5);
  } // End of is_empty

  updateUI(score=0, comments=0, translations=0) {
    let _label;
    //~ if (this.show_translations)
      //~ _label = "%s %s\n%s %s\n%s %s".format(STAR_CHAR, score.toString(), MESSAGE_CHAR, comments.toString(), FLAG_CHAR, translations.toString());
    //~ else
      //~ _label = "%s %s\n%s %s".format(STAR_CHAR, score.toString(), MESSAGE_CHAR, comments.toString());
    //~ this.set_applet_label(_label);
    if (score==0 && comments==0 && translations==0) {
      if (this.display_on_panel === "normal") {
        this.actor.show();
        if (!this.useful_only)
          this.showLabel();
        else
          this.hideLabel();
      } else if (this.display_on_panel === "icon") {
        this.actor.show();
        this.hideLabel();
      } else { // "mask"
        this.hideLabel();
        this.actor.hide();
      }
      this.actor.set_style(null);
      this._applet_label.set_style(null);
    } else {
      let _labels = [];
      if (!this.useful_only || score!=0) _labels.push("%s %s".format(STAR_CHAR, score.toString()));
      if (!this.useful_only || comments!=0) _labels.push("%s %s".format(MESSAGE_CHAR, comments.toString()));
      if (!this.useful_only || (this.show_translations && translations!=0)) _labels.push("%s %s".format(FLAG_CHAR, translations.toString()));
      if (this.is_vertical) {
        _label = ""+_labels.join("\n");
      } else {
        if (_labels.length * 20 <= this._panelHeight)
          _label = ""+_labels.join("\n");
        else
          _label = ""+_labels.join("  ");
      }
      this.set_applet_label(_label);
      this.actor.show();
      this.showLabel();
      this.actor.set_style("color: %s;".format(this.color_on_change));
      this._applet_label.set_style("color: %s;".format(this.color_on_change));
    }

  } // End of updateUI

  issuesJobs_loop() {
    //~ logDebug("issuesJobs_loop()\n");
    if (this.issuesJobsList.length > 0) {
      const [type, uuid] = this.issuesJobsList.shift();
      this.do_issuesJob(type, uuid);
    }
  } // End of issuesJobs_loop

  do_issuesJob(type, uuid) {
    const jsonFilePath = `${HOME_DIR}/.config/cinnamon/spices/SpiceSpy@claudiux/issues/issues-${type}.json`
    const jsonFile = Gio.file_new_for_path(jsonFilePath);
    if (!jsonFile.query_exists(null)) return;

    const [success, jsonFileContents] = GLib.file_get_contents(jsonFilePath);
    if (!success) return;

    //~ const data = JSON.parse(JSON.stringify(jsonFileContents, null, "\t"));
    const data = eval(to_string(jsonFileContents).replace(/\n/g, "")); //.replace(/\}\]\[\{/g, "},{"));
    const fullName = uuid;
    //~ const nickName = fullName.split("@")[0];
    var issuesNumber = 0;

    for (let d of data) {
      //~ logDebug("do_issuesJob 434: "+d["title"]);
      if ((d["title"] && d["title"].includes(fullName)) || (d["body"] && d["body"].includes(fullName))) {
        issuesNumber += 1;
      }
    }
    //~ logDebug("do_issuesJob: "+type+" "+uuid+": "+issuesNumber+" issues.");
    if (this.spices_to_spy[type][uuid])
      this.spices_to_spy[type][uuid]["issues"] = issuesNumber;
    this.make_menu();
  } // End of do_issuesJob

  do_issuesJob_OLD(type, spice, command) {
    //~ logDebug("do_issuesJob type: "+type+" spice: "+spice+" command: "+command);
    if (!this.spices_to_spy[type] || !this.spices_to_spy[type][spice]) {
      this.issuesJobsList.push([type, spice, command]);
      return
    }
    let subProcess = Util.spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
      if (exitCode == 0) {
        //~ logDebug("exitCode: 0");
        let _nb_issues = parseInt(stdout);
        if (_nb_issues == null || isNaN(_nb_issues)) _nb_issues = 0;
        this.spices_to_spy[type][spice]['issues'] = _nb_issues
      } else if (exitCode == 1) {
        //~ logDebug("exitCode: 1");
        this.spices_to_spy[type][spice]['issues'] = 0;
      }
      this.make_menu(); //???
      subProcess.send_signal(9);
    });
  } // End of do_issuesJob_OLD

  commentsJobs_loop() {
    //~ if (!this.is_looping) {
      //~ this.commentsJobsList = [];
      //~ return false;
    //~ }

    if (this.commentsJobsList.length > 0) {
      const [type, spice, page] = this.commentsJobsList.shift();
      this.do_commentsJob(type, spice, page);
    }

    //~ return this.is_looping;
  } // End of commentsJobs_loop

  async do_commentsJob(type, spice, page) {
    //~ logDebug(`do_commentsJob(${type}, ${spice}, ${page})`);
    if (!this.spices_to_spy[type] || !this.spices_to_spy[type][spice]) {
      this.commentsJobsList.push([type, spice, page]);
      //~ logDebug("Re-inserted at the end of the list.")
      return
    }
    var http = new HttpLib();
    let response = await http.LoadAsync(page.slice(0, -6));
    if (response.Success) {
      //~ logDebug("Success");
      let result = COMMENTS_REGEX.exec(response.Data);
      //~ logDebug("result: "+result);
      if (result && result[1]) {
        let count = parseInt(result[1]);
        //~ logDebug("count: "+count);
        this.spices_to_spy[type][spice]['comments'] = count;
        //~ this.make_menu();
      } else {
        global.logWarning(spices[spice]['uuid'] + ": This spice is cached in the "
        + ".json file but doesn't actually exist in the "
        + "Spices now OR the Cinnamon Spices changed the ID "
        + "(please report if there are 0 items)");
      }
    } else {
      //~ logDebug("Check and mate");
    }
    this.make_menu();
  } // End of do_commentsJob

  loop() {
    //~ logDebug("loop() this.fistTime:"+this.fistTime+" this.is_looping:"+this.is_looping);
    //~ if (!this.is_looping) return false;
    let id;
    if (this.loopId != null ) {
      id = this.loopId;
      source_remove(id);
    }
    this.loopId = null;

    // Initialization (first time this applet is launched):
    const old_keys = Object.keys(this.old_spices_to_spy);
    if (old_keys.length < 5) {
      //~ this.settings.setValue("old_spices_to_spy", this.spices_to_spy);
      this.old_spices_to_spy = this.spices_to_spy;
    }

    this.renew_caches();

    if (!this.fistTime) {
      this.update_authors();
      this.update_uuids();
      this.get_spices_to_spy();
      this.update_issues();
      this.update_comments();

      this.settings.setValue("spices_to_spy", this.spices_to_spy);
      this.settings.setValue("old_spices_to_spy", this.old_spices_to_spy);
    }
    this.fistTime = false;
    this.set_applet_tooltip(this.metadata.name);
    this.make_menu();

    if (!this.loopId) {
      let sec = Math.round(this.update_interval * 3600);
      this.loopId = timeout_add_seconds(sec, () => { this.loop() });
    }
    if (this.issuesLoopId) {
      id = this.issuesLoopId;
      source_remove(id);
    }
    this.issuesLoopId = null;
    this.issuesLoopId = timeout_add_seconds(5, () => { this.issuesJobs_loop(); return (this.issuesJobsList.length > 0 && this.is_looping); });

    return this.is_looping;
  } // End of loop

  update_authors() {
    //FIXME: removing all spices of an author from this.spices_to_spy.
    var _authors = [];
    for (let author of this.author_list) {
      _authors.push(author["author"].toLowerCase());
    }
    this.authors = _authors;
  } // End of update_authors

  update_uuids() {
    //FIXME: removing an uuid from this.spices_to_spy.
    var _uuids = [];
    for (let uuid of this.uuid_list) {
      _uuids.push(""+uuid['uuid']);
    }
    this.uuids = _uuids;
  } // End of update_uuids

  /**
   * renew_caches():
   * Check if the local caches are older than 15 minutes.
   * If this is the case, local caches are renewed using CACHE_UPDATER.
   */
  renew_caches() {
    for (let type of TYPES) {
      const INDEX_DIR = HOME_DIR + "/.cache/cinnamon/spices/" + type.slice(0, -1);
      const INDEX = INDEX_DIR + "/index.json";
      const jsonFile = Gio.file_new_for_path(INDEX);

      if (jsonFile.query_exists(null)) {
        const jsonModifTime = parseInt(jsonFile.query_info("time::modified", Gio.FileQueryInfoFlags.NONE, null).get_modification_date_time().to_unix());
        const currentTime = parseInt(new Date / 1000);
        const difference = currentTime - jsonModifTime;
        if (difference >= 900) { // 900s = 15 min.
          Util.spawnCommandLineAsync(CACHE_UPDATER+" --update-all");
        }
      } else {
        Util.spawnCommandLineAsync(CACHE_INIT);
        break // CACHE_INIT calls CACHE_UPDATER --update-all.
      }
    }
  } // End of renew_caches

  get_spices_to_spy() {
    var _spices_to_spy = {};

    for (let type of TYPES) {
      _spices_to_spy[type] = {};
      const INDEX = HOME_DIR + "/.cache/cinnamon/spices/" + type.slice(0, -1) + "/index.json";
      const jsonFile = Gio.file_new_for_path(INDEX);

      if (jsonFile.query_exists(null)) {
        let [success, array_chars] = GLib.file_get_contents(INDEX);
        if (success) {
          const spices = JSON.parse(to_string(array_chars));
          for (let spice of Object.keys(spices)) {
            let _uuid = (type!="themes") ? ""+spices[spice]["uuid"] : ""+spices[spice]["name"];

            if (this.uuids.indexOf(_uuid) > -1 || this.authors.indexOf(spices[spice]["author_user"]) > -1) {
              let _nb_translations = 0;
              if (type!="themes") { // No translations for themes.
                var list_translations = [];
                let _nb_translations_keys = Object.keys(spices[spice]["translations"]);
                for (let tKey of _nb_translations_keys) {
                  let t = tKey.slice(tKey.indexOf("_")+1);
                  if (list_translations.indexOf(t) < 0)
                    list_translations.push(t);
                }
                _nb_translations = list_translations.length;
              }
              _spices_to_spy[type][_uuid] = {
                "type": type,
                "uuid": _uuid,
                "name": spices[spice]["name"],
                "score": spices[spice]["score"],
                "translations": _nb_translations,
                "url": "https://cinnamon-spices.linuxmint.com/"+type+"/view/"+spices[spice]["spices-id"],
                "comments": ( this.spices_to_spy[type] &&
                              this.spices_to_spy[type][""+spices[spice]["uuid"]] &&
                              this.spices_to_spy[type][""+spices[spice]["uuid"]]["comments"]
                            ) ? this.spices_to_spy[type][""+spices[spice]["uuid"]]["comments"] : 0,
                "issues": ( this.spices_to_spy[type] &&
                              this.spices_to_spy[type][""+spices[spice]["uuid"]] &&
                              this.spices_to_spy[type][""+spices[spice]["uuid"]]["issues"] != null
                            ) ? this.spices_to_spy[type][""+spices[spice]["uuid"]]["issues"] : 0,
              }
            }
          }
        }
      }
    }
    //~ this.settings.setValue("spices_to_spy", _spices_to_spy);
    this.spices_to_spy = _spices_to_spy;
  } // End of get_spices_to_spy

  update_comments() {
    for (let type of TYPES) {
      let spices = this.spices_to_spy[type];
      for (let spice of Object.keys(spices)) {
        const page = spices[spice]['url']+`#${HTML_COUNT_ID}`;
        this.commentsJobsList.push([type, spice, page]);
      }
    }
  } // End of update_comments

  update_issues_json() {
    const GET_ISSUES_JSON_SCRIPT = SCRIPTS_DIR + "/get_issues_json.sh";
    Util.spawnCommandLineAsync(GET_ISSUES_JSON_SCRIPT);
    const interval = 1200; // 1200 s = 20 min.
    this.issuesJsonLoopId = timeout_add_seconds(interval, () => { Util.spawnCommandLineAsync(GET_ISSUES_JSON_SCRIPT) ; return this.is_looping; });
  } // End of update_issues_json

  update_issues() {
    for (let type of TYPES) {
      let spices = this.spices_to_spy[type];
      for (let uuid of Object.keys(spices)) {
        this.issuesJobsList.push([type, uuid]);
      }
    }
    //~ logDebug("update_issues() this.issuesJobsList: "+this.issuesJobsList.join("\n"));
  } // End of update_issues

  update_issues_OLD() {
    const GET_ISSUES_SCRIPT = SCRIPTS_DIR+"/get-issues.sh"
    const interval = 5000; //ms = 5 seconds.
    //~ var index = 0;
    for (let type of TYPES) {
      let spices = this.spices_to_spy[type];
      for (let spice of Object.keys(spices)) {
        //~ let id = setTimeout( () => { //old: async () => {
          //~ clearTimeout(id);
          let command = ""+GET_ISSUES_SCRIPT+" "+type+" "+spices[spice]['uuid'];
          this.issuesJobsList.push(type, spice, command);
          //~ let subProcess = Util.spawnCommandLineAsyncIO(command, Lang.bind(this, function(stdout, stderr, exitCode) {
            //~ if (exitCode == 0) {
              //~ let _nb_issues = parseInt(stdout);

              //~ if (_nb_issues == null || isNaN(_nb_issues)) _nb_issues = 0;
              //~ this.spices_to_spy[type][spice]['issues'] = _nb_issues;
              //~ this.make_menu();
            //~ } else if (exitCode == 1) {
              //~ this.spices_to_spy[type][spice]['issues'] = 0;
              //~ this.make_menu();
            //~ }
            //~ subProcess.send_signal(9);
          //~ }));
        //~ }, index*interval);
        //~ index += 1;
      }
    }
  } // End of update_issues_OLD

  make_menu() {
    var total_diff_score = 0;
    var total_diff_comments = 0;
    var total_diff_translations = 0;

    //~ if (this.nothing_to_spy())
      //~ this.set_applet_tooltip(_("No Spice to spy.\nPlease configure me!"));
    //~ else if (this.is_empty())
      //~ this.set_applet_tooltip(_("Please wait..."));
    //~ else
      //~ this.set_applet_tooltip(this.metadata.name);
    //~ this.fistTime = true;

    if (this.menu) {
      this.menu.removeAll();
    } else {
      this.menu = new Applet.AppletPopupMenu(this, this.orientation);
      //~ this.menu = new PopupMenu.PopupMenu(this, this.orientation);
      this.menuManager.addMenu(this.menu);
    }

    //~ this.spicesSection = new PopupMenu.PopupSubMenuMenuItem(_("Spices"));
    this.spicesSection = new SpiceSpyPopupSubMenuMenuItem(_("Spices"));
    //~ this.spicesSection = new PopupMenu.PopupSubMenu(this.actor, null);
    this.spicesSection.menu.actor.vscrollbar_policy = St.PolicyType.ALLWAYS;
    this.spicesSection.menu.actor.hscrollbar_policy = St.PolicyType.NEVER;
    this.spicesSection.menu._needsScrollbar = function() {
      return true;
    }
    //~ logDebug("global.screen_height: "+global.screen_height);
    //~ this.spicesSection.actor.style = "height: %spx;width: %spx;spacing: 0px;padding:0px;expand: true;".format((1*global.screen_height - 240).toString(), (560+this.icon_size-24).toString());
    this.spicesSection.actor.style = "width: %spx;spacing: 0px;padding:0px;expand: false;".format((560+this.icon_size-24).toString());
    //~ this.spicesSection.menu.open();

    //~ this.spicesSection.box.set_vertical(true);

    this.menu.addMenuItem(this.spicesSection);

    if (this.spices_to_spy) {
      for (let type of TYPES) {
        //if (!this.spices_to_spy || !this.spices_to_spy[type]) continue;
        var menuItems = [];
        const uuids = (this.spices_to_spy[type]) ? Object.keys(this.spices_to_spy[type]) : [];
        if (uuids.length > 0) {
          let title = type[0].toUpperCase() + type.substring(1);
          //this.menu.addMenuItem(new TitleSeparatorMenuItem(_(title), `spices-${type}-symbolic`));
          this.spicesSection.menu.addMenuItem(new TitleSeparatorMenuItem(_(title), `spices-${type}-symbolic`));
          for (let uuid of uuids) {
            let spice = this.spices_to_spy[type][uuid];
            let diff_comments = 0;
            let diff_stars = 0;
            let diff_translations = 0;
            if (this.old_spices_to_spy[type][uuid]) {
              diff_comments = this.spices_to_spy[type][uuid]["comments"] - this.old_spices_to_spy[type][uuid]["comments"];
              if (diff_comments < 0) {
                diff_comments = 0;
                this.spices_to_spy[type][uuid]["comments"] = this.old_spices_to_spy[type][uuid]["comments"];
              }
              diff_stars = this.spices_to_spy[type][uuid]["score"] - this.old_spices_to_spy[type][uuid]["score"];
              diff_translations = this.spices_to_spy[type][uuid]["translations"] - this.old_spices_to_spy[type][uuid]["translations"];
              if (isNaN(diff_translations))
                diff_translations = this.spices_to_spy[type][uuid]["translations"];
            }
            else {
              diff_comments = this.spices_to_spy[type][uuid]["comments"];
              diff_stars = this.spices_to_spy[type][uuid]["score"];
              diff_translations = this.spices_to_spy[type][uuid]["translations"];
            }
            total_diff_score += diff_stars;
            total_diff_comments += diff_comments;
            total_diff_translations += diff_translations;
            //~ spice.comments = diff_comments;
            let menuItem = new SpiceMenuItem(this, spice, diff_stars != 0, diff_comments != 0, diff_translations != 0);
            menuItems.push(menuItem);
          }
          if (menuItems.length > 0) {
            switch (this.sort_by) {
              case "translated":
                menuItems.sort((a,b) => _(a.spice.name, a.spice.uuid) > _(b.spice.name, b.spice.uuid));
                break;
              case "untranslated":
                 menuItems.sort((a,b) => a.spice.name > b.spice.name);
                break;
              case "uuid":
                menuItems.sort((a,b) => a.spice.uuid > b.spice.uuid);
                break;
              case "score":
                menuItems.sort((a,b) => a.spice.score > b.spice.score);
                break;
              case "dscore":
                menuItems.sort((a,b) => a.spice.score < b.spice.score);
                break;
              case "comments":
                menuItems.sort((a,b) => a.spice.comments > b.spice.comments);
                break;
              case "dcomments":
                menuItems.sort((a,b) => a.spice.comments < b.spice.comments);
            }

            for(let item of menuItems)
              this.spicesSection.menu.addMenuItem(item);//this.menu.addMenuItem(item);
          }
        }
      }
      //~ setTimeout( () => { this.spicesSection.menu.open() }, 0);
      //~ this.spicesSection.menu.open();

      let read_all = new PopupMenu.PopupIconMenuItem(_("Mark all as read"), "object-select", St.IconType.SYMBOLIC);
      read_all.connect("activate",
        () => {
          if (this.menu) this.menu.toggle(true);
          this.mark_all_as_read();
        }
      );
      this.menu.addMenuItem(read_all);
    }

    if (this.issuesJobsList.length === 0) {
      let refresh = new PopupMenu.PopupIconMenuItem(_("Refresh"), "", St.IconType.SYMBOLIC);
      refresh.connect("activate",
        () => {
          if (this.menu) this.menu.toggle(true);
          this.is_looping = true;
          this.fistTime = false;
          this.loop();
        }
      );
      this.menu.addMenuItem(refresh);
    } else {
      let refresh_in_progress = new PopupMenu.PopupIconMenuItem(
        _("Refreshing in progress"),
        "view-refresh",
        St.IconType.SYMBOLIC,
        { reactive: false }
      );
      this.menu.addMenuItem(refresh_in_progress);
    }

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    let config_button = new PopupMenu.PopupIconMenuItem(_("Configure..."), "system-run", St.IconType.SYMBOLIC);
    config_button.connect('activate',
      () => {
        if (this.menu) this.menu.toggle(true);
        this.configureApplet();
      }
    );
    this.menu.addMenuItem(config_button);

    //~ this.spicesSection.menu.open();
    this.spicesSection.menu.toggle();
    //~ this.spicesSection.menu.close();

    this.updateUI(total_diff_score, total_diff_comments, total_diff_translations);
  } // End of make_menu

  mark_all_as_read() {
    //~ this.settings.setValue("old_spices_to_spy", this.spices_to_spy);
    this.old_spices_to_spy = this.spices_to_spy;
    //~ this.make_menu();
  } // End of mark_all_as_read

  mark_as_read(spice) {
    if (!spice) return;
    this.old_spices_to_spy[spice.type][spice.uuid] = this.spices_to_spy[spice.type][spice.uuid];
    //~ this.settings.setValue("old_spices_to_spy", this.old_spices_to_spy);
    this.make_menu();
  } // End of mark_as_read

  on_applet_added_to_panel() {
    //~ logDebug("on_applet_added_to_panel()");
    this.is_looping = true;
    this.get_user_settings();

    this.renew_caches();
    //~ this.update_authors();
    //~ this.update_uuids();
    //~ this.get_spices_to_spy();
    //~ this.update_issues();
    //~ this.update_comments();

    this.loopId = timeout_add_seconds(60, () => { this.loop() });
    this.jobsLoopId = timeout_add_seconds(15, () => { this.commentsJobs_loop(); return this.is_looping; });

    this.update_issues_json();
    //~ this.make_menu();
    this.updateUI();
  } // End of on_applet_added_to_panel

  on_applet_clicked() {
    this.settings.setValue("spices_to_spy", this.spices_to_spy);
    if (!this.menu || (this.menu && !this.menu.isOpen))
      this.make_menu();
    if (this.menu) this.menu.toggle();
    //~ try {
      //~ if (this.spicesSection) this.spicesSection.menu.toggle();
    //~ } catch(e) {}
  } // End of on_applet_clicked

  on_applet_removed_from_panel() {
    this.is_looping = false;
    remove_all_sources();
    if (this.menu) this.menu.removeAll();
    this.loopId = null;
    this.jobsLoopId = null;
    this.issuesLoopId = null;
    this.issuesJsonLoopId = null;
  } // End of on_applet_removed_from_panel

  on_panel_height_changed() {
    this.make_menu();
  }

  _reload_this_applet(event=null) {
    reloadExtension(UUID, Type.APPLET)
  } // End of _reload_this_applet

  get is_vertical() {
    return (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
  }
}

function main(metadata, orientation, panel_height, instance_id) {
  return new SpiceSpy(metadata, orientation, panel_height, instance_id);
}
