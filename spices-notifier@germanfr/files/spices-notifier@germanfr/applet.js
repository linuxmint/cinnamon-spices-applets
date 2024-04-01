const St = imports.gi.St;

const Lang = imports.lang;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const Mainloop = imports.mainloop;
var Util = imports.misc.util;

var { HttpLib } = require("./lib/httpLib");
const http = new HttpLib();

const UUID = 'spices-notifier@germanfr';

const _TYPES = ['applets', 'desklets', 'extensions', 'themes'];
const SPICES_URL = 'https://cinnamon-spices.linuxmint.com';
const HTML_COUNT_ID = 'count';
const COMMENTS_REGEX = new RegExp(`<[a-z]+ id="${HTML_COUNT_ID}">([0-9]+)</[a-z]+>`);

const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

function _(str) {
  let xlet_dom_transl = Gettext.dgettext(UUID, str);
  if (xlet_dom_transl !== str)
    return xlet_dom_transl;
  // If the text was not found locally try with system-wide translations
  return Gettext.gettext(str);
}

class XletMenuItem extends PopupMenu.PopupBaseMenuItem {
  constructor(parent, xlet, params) {
    super(params);
    this.parent = parent;
    this.xlet = xlet;

    let label = new St.Label({ text: xlet.name });
    this.addActor(label);

    let stars = new St.BoxLayout({ style: 'spacing: .25em' });
    let star_icon = new St.Icon({ icon_name: 'starred', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
    let star_count = new St.Label({ text: xlet.score.toString() });
    stars.add_actor(star_icon);
    stars.add_actor(star_count);
    this.addActor(stars);

    this.comments_box = new St.BoxLayout({ style: 'spacing: .25em' });
    let comments_icon = new St.Icon({ icon_name: 'user-available', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
    this.comments_label = new St.Label({ text: '0' });
    this.comments_box.add_actor(comments_icon);
    this.comments_box.add_actor(this.comments_label);
    this.addActor(this.comments_box);
  }

  activate() {
    Util.spawn(['xdg-open', this.xlet.page]);
    this.update_comment_count(0);
    super.activate();
  }

  update_comment_count(count) {
    if (!this.comments_label)
      return;

    this.comments_label.set_text(count.toString());
    if (count > 0) {
      this.comments_box.opacity = 255;
      this.parent.add_unread(count);
    } else {
      this.comments_box.opacity = 128;
      this.parent.mark_as_read(this.xlet);
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
    if (typeof icon_name === 'string') {
      let icon = new St.Icon({ icon_name, icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
      this.addActor(icon, { span: 0 });
    }
    this.label = new St.Label({ text: title, style_class: 'popup-subtitle-menu-item' });
    this.addActor(this.label);
  }
}


class SpicesNotifier extends Applet.TextIconApplet {
  constructor(meta, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
    this.set_applet_icon_symbolic_name('spices-comments');
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    this.settings = new Settings.AppletSettings(this, meta.uuid, instance_id);
    this.settings.bind('username', 'username', this.reload);
    this.settings.bind('update-interval', 'update_interval', this.reload);
    this.settings.bind('show-nonzero-only', 'show_nonzero_only', this.update_applet);
    this.settings.bind('uuidList', 'uuidList', this.reload);
    this.settings.bind('uuids', 'uuids', this.make_uuidList);

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    let read_all = new PopupMenu.PopupIconMenuItem(_("Mark all as read"), 'object-select', St.IconType.SYMBOLIC);
    read_all.connect('activate', this.mark_all_as_read.bind(this));
    this._applet_context_menu.addMenuItem(read_all);

    this.updateId = null;
    this.iteration = 0;
    this.waiting = {};
    let cache = this.settings.getValue('xlets-cache');
    for (let _type of _TYPES) this.waiting[_type] = (cache[_type].length + 3)*1000;

    let reload_all = new PopupMenu.PopupIconMenuItem(_("Refresh"), 'reload', St.IconType.SYMBOLIC);
    reload_all.connect('activate', this.reload.bind(this));
    this._applet_context_menu.addMenuItem(reload_all);

    this.reload();
  }

  make_uuidList() {
    var uuidList = "";
    let counter = 0;
    for (let u of this.uuids) {
      uuidList += (counter === 0) ? u.uuid : ";"+u.uuid;
      counter += 1;
    }
    this.uuidList = uuidList;

    //Cinnamon seems to be triggering this function multiple times even though
    //uuids haven't changed so only reload when uuids have actually changed.
    if (uuidList != this.previous_uuidList) {
      this.reload()
    }
    this.previous_uuidList = uuidList;
  }

  on_applet_clicked() {
    if (this.menu.numMenuItems === 0)
      this.menu.addAction(_("No xlets found, click to reload"), this.reload.bind(this));
    this.menu.toggle();
  }

  on_applet_removed_from_panel() {
    if(this.updateId) {
      Mainloop.source_remove(this.updateId);
      this.updateId = null;
    }
  }

  update_applet() {
    if (this.unread > 0) {
      this.set_applet_label(this.unread.toString())
      this.actor.show();
    } else {
      if (this.show_nonzero_only) {
        this.actor.hide();
      } else {
        this.set_applet_label('');
        this.actor.show();
      }
    }
  }

  reload() {
    this.my_xlets = [];
    this.unread = 0;
    this.update_applet();
    if(this.updateId) {
      Mainloop.source_remove(this.updateId);
      this.updateId = null;
    }

    this.iteration++;
    // We need this to avoid duplicates on consecutive loads, because it's async

    var numType = 0;
    var _type = _TYPES[numType];
    let id = setInterval( () => {
      _type = _TYPES[numType];
      //~ global.log("_type: "+_type);
      this.get_xlets(_type);
      numType++;
      if (numType >= _TYPES.length)
        clearInterval(id);
    }, this.waiting[_type]);

    let ms = this.update_interval * 60 * 1000;
    this.updateId = Mainloop.timeout_add(ms, this.reload.bind(this));
  }

  async get_xlets(type) {
    let cache = this.get_xlet_cache(type);
    if (cache) {
      this.on_xlets_loaded(type, cache);
      return;
    }

    let iteration = this.iteration;
    let now = Math.ceil(Date.now() / 1000);
    /* The question mark at the end is a hack to force the server to not
       send us a very old cached version of the json file. */
    let response = await http.LoadAsync(`${SPICES_URL}/json/${type}.json?`+'time='+now);
    if (!response.Success) {
      logError(`HTTP Error! status : ${response.status}`);
    } else {
      if (iteration === this.iteration) {
        let xlets = JSON.parse(response.Data);
        this.save_xlet_cache(type, xlets);
        this.on_xlets_loaded(type, xlets);
      }
    }

  }

  save_xlet_cache(type, xlets) {
    // API only detects direct object writes
    // so we copy it, change it and write back again
    let cache = this.settings.getValue('xlets-cache');
    cache[type] = xlets;
    cache.timestamp = Date.now();
    this.settings.setValue('xlets-cache', cache);
    this.waiting[type] = (xlets.length + 3)*1000;
  }

  get_xlet_cache(type) {
    let cache = this.settings.getValue('xlets-cache');
    // Valid for 12h = 43200000
    if (cache.timestamp > Date.now() - 60000 * this.update_interval // to ms
      && Object.keys(cache[type]).length) {
      return cache[type];
    }
    return null;
  }

  async get_comment_count(xlet, item) {
    let [count, read] = this.get_comments_cache(xlet);
    if (count >= 0) {
      item.update_comment_count(count - read);
      return;
    }
    let now = Math.ceil(Date.now() / 1000);
    let response = await http.LoadAsync(xlet.page+"?time="+now);
    if (response.Success) {
      let result = COMMENTS_REGEX.exec(response.Data);
      if (result && result[1]) {
        let count = parseInt(result[1]);
        this.set_comments_cache(xlet, count, read);
        item.update_comment_count(count - read);
      } else {
        item.actor.hide();
        global.logWarning(xlet.name + ": This xlet is cached in the "
            + "xlet.json file but doesn't actually exist in the "
            + "Spices now OR the Cinnamon Spices changed the ID "
            + "(please report if there are 0 items)");
      }
    }
  }

  set_comments_cache(xlet, count, read) {
    let cache = this.settings.getValue('comment-cache');
    cache[xlet.uuid] = { count, read };
    cache.timestamp = Date.now();
    this.settings.setValue('comment-cache', cache);
  }

  get_comments_cache(xlet) {
    let read = 0, count = -1;
    let cache = this.settings.getValue('comment-cache');
    if (cache[xlet.uuid]) {
      read = cache[xlet.uuid].read || 0;
      // If cache is still valid
      if (cache.timestamp > Date.now() - this.update_interval * 60000) // Convert to ms
        count = cache[xlet.uuid].count;
    }
    return [count, read];
  }

  on_xlets_loaded(type, xlets) {
    let menuItems = [];
    let username = this.username.toLowerCase();
    let list = this.uuidList.toLowerCase().split(';');

    if (type === _TYPES[0]) this.menu.removeAll();

    for(let uuid in xlets) {
      let xlet = xlets[uuid];
      // If the user is the author of the xlet, or the
      // xlet is in the additional uuids list, add it
      if (xlet.author_user.toLowerCase() === username || list.indexOf(uuid.toLocaleLowerCase())>=0) {
        xlet.type = type;
        xlet.page = `${SPICES_URL}/${type}/view/${xlet['spices-id']}#${HTML_COUNT_ID}`;
        xlet.uuid = uuid; // Themes don't have UUIDs, use name

        let menuItem = new XletMenuItem(this, xlet);
        menuItems.push(menuItem);
        this.my_xlets.push(xlet);
      }
    }
    if (menuItems.length > 0) {
      // Xlets names are already translated system-wide
      let title = type[0].toUpperCase() + type.substring(1);
      this.menu.addMenuItem(new TitleSeparatorMenuItem(_(title), `spices-${type}-symbolic`));

      menuItems.sort((a,b) => a.xlet.name > b.xlet.name);
      for(let item of menuItems)
        this.menu.addMenuItem(item);

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      this.fetch_comments(menuItems);
    }

    //~ this.fetch_comments(menuItems);
  }

  fetch_comments(menuItems) {
    if (!menuItems || menuItems.length === 0)
      return;

    var numItem = 0;
    let id = setInterval( () => {
      //~ global.log("numItem: "+numItem);
      let item = menuItems[numItem];
      this.get_comment_count(item.xlet, item);
      numItem += 1;
      if (numItem >= menuItems.length)
        clearInterval(id);
    }, 1000);
  }

  add_unread(count) {
    this.unread += count;
    this.update_applet();
  }

  mark_as_read(xlet) {
    let [count, read] = this.get_comments_cache(xlet);

    // Update only if there was any unread comment
    if (count > read) {
      this.set_comments_cache(xlet, count, count);
      this.unread -= (count - read);
      this.update_applet();
    }
  }

  mark_all_as_read() {
    for(let xlet of this.my_xlets)
      this.mark_as_read(xlet);
    this.reload();
  }
}

function main(metadata, orientation, panel_height, instance_id) {
  return new SpicesNotifier(metadata, orientation, panel_height, instance_id);
}
