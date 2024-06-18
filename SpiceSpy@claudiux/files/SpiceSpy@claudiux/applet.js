const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const Mainloop = imports.mainloop;
var Util = imports.misc.util;

const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Lang = imports.lang;

const { HttpLib } = require("./lib/httpLib");
const { to_string } = require("./lib/to-string");

const UUID = "SpiceSpy@claudiux";

const HOME_DIR = GLib.get_home_dir();

const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const SCRIPTS_DIR = APPLET_DIR + "/scripts";
const CACHE_UPDATER = SCRIPTS_DIR + "/spices-cache-updater.py";

const TYPES = ["actions", "applets", "desklets", "extensions", "themes"];
const SPICES_URL = "https://cinnamon-spices.linuxmint.com";
const HTML_COUNT_ID = "count";
const COMMENTS_REGEX = new RegExp(`<[a-z]+ id="${HTML_COUNT_ID}">([0-9]+)</[a-z]+>`);

const Gettext = imports.gettext;
//~ Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");

function _(str, uuid=UUID) {
  Gettext.bindtextdomain(uuid, HOME_DIR + "/.local/share/locale");
  let _str = Gettext.dgettext(uuid, str);
  if (_str !== str)
    return _str;
  // If the text was not found locally then try with system-wide translations:
  return Gettext.gettext(str);
}

class SpiceMenuItem extends PopupMenu.PopupBaseMenuItem {
  constructor(parent, spice, new_stars, new_comments, params) {
    super(params);
    this.parent = parent;
    this.spice = spice;
    this.new_stars = new_stars; // boolean
    this.new_comments = new_comments; // boolean

    let label_text;
    if (parent.show_uuid) {
      label_text = spice.uuid;
    } else {
      if (parent.translate_name)
        label_text = _(spice.name, spice.uuid);
      else
        label_text = spice.name;
    }
    let label = new St.Label({ text: label_text });
    this.addActor(label);

    if (this.parent.show_icon_in_menu) {
      let icon_box = new St.BoxLayout({ style: "spacing: .25em;" });
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
      this.addActor(icon_box);
    }

    let stars_box = new St.BoxLayout({ style: "spacing: .25em;" });
    let star_icon = new St.Icon({ icon_name: "starred", icon_type: St.IconType.SYMBOLIC, style_class: "popup-menu-icon" });
    let star_count = new St.Label({ text: spice.score.toString() });
    stars_box.add_actor(star_icon);
    stars_box.add_actor(star_count);
    this.addActor(stars_box);
    stars_box.opacity = (this.new_stars) ? 255 : this.parent.standard_opacity;
    if (this.new_stars) stars_box.set_style("color: %s;".format(this.parent.color_on_change));


    this.comments_box = new St.BoxLayout({ style: "spacing: .25em;" });
    let comments_icon = new St.Icon({ icon_name: "user-available", icon_type: St.IconType.SYMBOLIC, style_class: "popup-menu-icon" });
    this.comments_label = new St.Label({ text:  spice.comments.toString()});
    this.comments_box.add_actor(comments_icon);
    this.comments_box.add_actor(this.comments_label);
    this.addActor(this.comments_box);
    this.comments_box.opacity = (this.new_comments) ? 255 : this.parent.standard_opacity;
    if (this.new_comments) this.comments_box.set_style("color: %s;".format(this.parent.color_on_change));
    //~ this.update_comment_count(spice.comments);
  }

  activate() {
    Util.spawn(["xdg-open", this.spice.url]);
    this.update_comment_count(0);
    super.activate();
  }

  update_comment_count(count) {
    if (!this.comments_label)
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

  destroy() {
    this.comments_label = null;
    this.comments_box = null;
    super.destroy();
  }
};

class TitleSeparatorMenuItem extends PopupMenu.PopupBaseMenuItem {
  constructor(title, icon_name) {
    super({ reactive: false });
    if (typeof icon_name === "string") {
      let icon = new St.Icon({ icon_name, icon_type: St.IconType.SYMBOLIC, style_class: "popup-menu-icon" });
      this.addActor(icon, { span: 0 });
    }
    this.label = new St.Label({ text: title, style_class: "popup-subtitle-menu-item" });
    this.addActor(this.label);
  }
}

const STAR_CHAR = "★";
const MESSAGE_CHAR = "✉";

class SpiceSpy extends Applet.TextIconApplet {
  constructor(metadata, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
    this.metadata = metadata;
    this.set_applet_icon_symbolic_name("cinnamon");
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    //~ this.updateUI();

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    this.authors = [];
    this.uuids = [];
    //~ this.temp_uuids = [];
    this.fistTime = true;
    this.loopId = null;

    this.settings = new Settings.AppletSettings(this, UUID, instance_id);
    this.settings.bind("update-interval", "update_interval");
    this.settings.bind("standard-opacity", "standard_opacity", this.make_menu);
    this.settings.bind("color-on-change", "color_on_change", this.make_menu);
    this.settings.bind("show-icon-in-menu", "show_icon_in_menu");
    this.settings.bind("icon-size", "icon_size");
    this.settings.bind("sort-by", "sort_by");
    this.settings.bind("show-uuid", "show_uuid");
    this.settings.bind("translate-name", "translate_name");
    this.settings.bind("display-on-panel", "display_on_panel", this.make_menu);
    this.settings.bind("author-list", "author_list", this.update_authors.bind(this));
    this.settings.bind("uuid-list", "uuid_list", this.update_uuids.bind(this));
    this.settings.bind("spices_to_spy", "spices_to_spy");
    this.settings.bind("old_spices_to_spy", "old_spices_to_spy");

    this.make_menu();

    this.renew_caches();
    this.update_authors();
    this.update_uuids();
    this.get_spices_to_spy();
    this.update_comments();

    this.loopId = Mainloop.timeout_add(60000, this.loop.bind(this));
  } // End of constructor

  nothing_to_spy() {
    return (this.authors.length === 0 && this.uuids.length === 0);
  }

  is_empty() {
    const keys_spices_to_spy = Object.keys(this.spices_to_spy);
    return (keys_spices_to_spy.length < 5);
  }

  updateUI(score=0, comments=0) {
    this.set_applet_label("%s %s\n%s %s".format(STAR_CHAR, score.toString(), MESSAGE_CHAR, comments.toString()));
    if (score==0 && comments==0) {
      if (this.display_on_panel === "normal") {
        this.actor.show();
        this.showLabel();
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
      this.actor.show();
      this.showLabel();
      this.actor.set_style("color: %s;".format(this.color_on_change));
      this._applet_label.set_style("color: %s;".format(this.color_on_change));
    }

  }

  loop() {
    global.log("Begin looping");
    if (this.loopId) {
      Mainloop.source_remove(this.loopId);
      this.loopId = null;
    }

    // Initialization (first time this applet is launched):
    const old_keys = Object.keys(this.old_spices_to_spy);
    if (old_keys.length < 5) {
      this.settings.setValue("old_spices_to_spy", this.spices_to_spy);
    }

    if (!this.fistTime) {
      this.renew_caches();
      this.update_authors();
      this.update_uuids();
      this.get_spices_to_spy();
      this.update_comments();
      this.settings.setValue("spices_to_spy", this.spices_to_spy);
      this.settings.setValue("old_spices_to_spy", this.old_spices_to_spy);
    }
    this.fistTime = false;

    this.make_menu();
    this.set_applet_tooltip(this.metadata.name);


    global.log("End looping");
    let ms = this.update_interval * 60000;
    this.loopId = Mainloop.timeout_add(ms, this.loop.bind(this));
  } // End of loop

  update_authors() {
    //FIXME: removing all spices of an author from this.spices_to_spy.
    var _authors = [];
    for (let author of this.author_list) {
      _authors.push(author.author.toLowerCase());
    }
    this.authors = _authors;
    //~ global.log("this.authors: "+this.authors);
  } // End of update_authors

  update_uuids() {
    //FIXME: removing an uuid from this.spices_to_spy.
    var _uuids = [];
    for (let uuid of this.uuid_list) {
      _uuids.push(""+uuid['uuid']);
    }
    this.uuids = _uuids;
    //~ global.log("this.uuids: "+this.uuids);
  } // End of update_uuids

  /**
   * renew_caches():
   * Check if the local caches are older than 12 minutes.
   * If this is the case, local caches are renewed using CACHE_UPDATER.
   */
  renew_caches() {
    var is_to_download = false;
    for (let type of TYPES) {
      const INDEX = HOME_DIR + "/.cache/cinnamon/spices/" + type.slice(0, -1) + "/index.json";
      const jsonFile = Gio.file_new_for_path(INDEX);

      if (jsonFile.query_exists(null)) {
        const jsonModifTime = jsonFile.query_info("time::modified", Gio.FileQueryInfoFlags.NONE, null).get_modification_date_time().to_unix();
        const currentTime = parseInt(new Date / 1000);
        const difference = parseInt(currentTime - jsonModifTime);
        is_to_download = (difference > 720); // 720s = 12 min.
      } else {
        is_to_download = true;
      }
      if (is_to_download) break;
    }

    if (is_to_download) {
      Util.spawnCommandLineAsync(CACHE_UPDATER+" --update-all");
    }
    is_to_download = undefined;
  } // End of renew_caches

  get_spices_to_spy() {
    var _spices_to_spy = {};
    //~ var _temp_uuids = [];
    for (let type of TYPES) {
      _spices_to_spy[type] = {};
      const INDEX = HOME_DIR + "/.cache/cinnamon/spices/" + type.slice(0, -1) + "/index.json";
      const jsonFile = Gio.file_new_for_path(INDEX);

      if (jsonFile.query_exists(null)) {
        let [success, array_chars] = GLib.file_get_contents(INDEX);
        if (success) {
          const spices = JSON.parse(to_string(array_chars));
          //~ global.log("spices:\n"+JSON.stringify(spices, null, 4));
          for (let spice of Object.keys(spices)) {
            let _uuid = (type!="themes") ? ""+spices[spice].uuid : ""+spices[spice].name;
            if (this.uuids.indexOf(_uuid) > -1 || this.authors.indexOf(spices[spice].author_user) > -1) {
              _spices_to_spy[type][_uuid] = {
                "type": type,
                "uuid": _uuid,
                "name": spices[spice].name,
                "score": spices[spice].score,
                "url": "https://cinnamon-spices.linuxmint.com/"+type+"/view/"+spices[spice]["spices-id"],
                "comments": ( this.spices_to_spy[type] &&
                              this.spices_to_spy[type][""+spices[spice].uuid] &&
                              this.spices_to_spy[type][""+spices[spice].uuid]["comments"]
                            ) ? this.spices_to_spy[type][""+spices[spice].uuid]["comments"] : 0
              };
              //~ _temp_uuids.push(""+spices[spice].uuid);
            }
          }
        }
      }
    }
    this.settings.setValue("spices_to_spy", _spices_to_spy);
    //~ this.temp_uuids = _temp_uuids;
    //~ global.log("this.spices_to_spy:\n"+JSON.stringify(this.spices_to_spy, null, 4));
    //~ global.log("this.temp_uuids:\n"+this.temp_uuids);
  } // End of get_spices_to_spy

  update_comments() {
    const interval = 13000; //ms = 13 seconds (the spices website accepts a maximum of 5 requests per minute.)
    var index = 0;
    var http = new HttpLib();
    for (let type of TYPES) {
      let spices = this.spices_to_spy[type];
      for (let spice of Object.keys(spices)) {
        const page = spices[spice]['url']+`#${HTML_COUNT_ID}`;
        //~ global.log("page: "+page);
        let id = setTimeout(async () => {
          let response = await http.LoadAsync(page);
          if (response.Success) {
            let result = COMMENTS_REGEX.exec(response.Data);
            if (result && result[1]) {
              let count = parseInt(result[1]);
              this.spices_to_spy[type][spice]['comments'] = count;
              this.make_menu();
            } else {
              global.logWarning(spices[spice]['uuid'] + ": This spice is cached in the "
              + ".json file but doesn't actually exist in the "
              + "Spices now OR the Cinnamon Spices changed the ID "
              + "(please report if there are 0 items)");
            }
          }
          clearTimeout(id);
        }, index*interval);
        index += 1;
      }
    }
  } // End of update_comments

  make_menu() {
    var total_diff_score = 0;
    var total_diff_comments = 0;

    //~ if (this.nothing_to_spy())
      //~ this.set_applet_tooltip(_("No Spice to spy.\nPlease configure me!"));
    //~ else if (this.is_empty())
      //~ this.set_applet_tooltip(_("Please wait..."));
    //~ else
      //~ this.set_applet_tooltip(this.metadata.name);
    //~ this.fistTime = true;

    this.menu.removeAll();

    if (this.spices_to_spy) {
      let read_all = new PopupMenu.PopupIconMenuItem(_("Mark all as read"), "object-select", St.IconType.SYMBOLIC);
      read_all.connect("activate", this.mark_all_as_read.bind(this));
      this.menu.addMenuItem(read_all);

      let refresh = new PopupMenu.PopupIconMenuItem(_("Refresh"), "view-refresh", St.IconType.SYMBOLIC);
      refresh.connect("activate", this.loop.bind(this));
      this.menu.addMenuItem(refresh);

      let section = new PopupMenu.PopupSubMenuMenuItem(_("Spices"));
      //~ section.box.set_vertical(true);
      this.menu.addMenuItem(section);

      for (let type of TYPES) {
        //if (!this.spices_to_spy || !this.spices_to_spy[type]) continue;
        var menuItems = [];
        const uuids = (this.spices_to_spy[type]) ? Object.keys(this.spices_to_spy[type]) : [];
        if (uuids.length > 0) {
          let title = type[0].toUpperCase() + type.substring(1);
          //this.menu.addMenuItem(new TitleSeparatorMenuItem(_(title), `spices-${type}-symbolic`));
          section.menu.addMenuItem(new TitleSeparatorMenuItem(_(title), `spices-${type}-symbolic`));
          for (let uuid of uuids) {
            let spice = this.spices_to_spy[type][uuid];
            let diff_comments = 0;
            let diff_stars = 0;
            if (this.old_spices_to_spy[type][uuid]) {
              diff_comments = this.spices_to_spy[type][uuid]["comments"] - this.old_spices_to_spy[type][uuid]["comments"];
              diff_stars = this.spices_to_spy[type][uuid]["score"] - this.old_spices_to_spy[type][uuid]["score"];
            }
            else {
              diff_comments = this.spices_to_spy[type][uuid]["comments"];
              diff_stars = this.spices_to_spy[type][uuid]["score"];
            }
            total_diff_score += diff_stars;
            total_diff_comments += diff_comments;
            //~ spice.comments = diff_comments;
            let menuItem = new SpiceMenuItem(this, spice, diff_stars != 0, diff_comments != 0);
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
              section.menu.addMenuItem(item);//this.menu.addMenuItem(item);
          }
        }
      }
      section.menu.open();
    }

    let config_button = new PopupMenu.PopupIconMenuItem(_("Configure..."), "system-run", St.IconType.SYMBOLIC);
    config_button.connect('activate', Lang.bind(this, this.configureApplet));
    this.menu.addMenuItem(config_button);

    this.updateUI(total_diff_score, total_diff_comments);
  } // End of make_menu

  mark_all_as_read() {
    global.log("mark_all_as_read");
    this.settings.setValue("old_spices_to_spy", this.spices_to_spy);
    this.make_menu();
  }

  mark_as_read(spice) {
    if (!spice) return;
    this.old_spices_to_spy[spice.type][spice.uuid] = this.spices_to_spy[spice.type][spice.uuid];
    this.settings.setValue("old_spices_to_spy", this.old_spices_to_spy);
    this.make_menu();
  }

  on_applet_clicked() {
    this.settings.setValue("spices_to_spy", this.spices_to_spy);
    //~ global.log("this.spices_to_spy:\n"+JSON.stringify(this.spices_to_spy, null, 4));
    this.make_menu();
    this.menu.toggle();
  } // End of on_applet_clicked

  on_applet_removed_from_panel() {
    if (this.loopId) {
      Mainloop.source_remove(this.loopId);
      this.loopId = null;
    }
  } // End of on_applet_removed_from_panel
}

function main(metadata, orientation, panel_height, instance_id) {
  return new SpiceSpy(metadata, orientation, panel_height, instance_id);
}
