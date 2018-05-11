const Soup = imports.gi.Soup;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const Mainloop = imports.mainloop;
const Util = imports.misc.util;

const session = new Soup.SessionAsync();
const UUID = 'spices-notifier@germanfr';

const SPICES_URL = 'https://cinnamon-spices.linuxmint.com';

const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

function _(str) {
	return Gettext.dgettext(UUID, str);
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

		this.comments = new St.BoxLayout({ style: 'spacing: .25em' });
		let comment_icon = new St.Icon({ icon_name: 'user-available', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
		this.count = new St.Label({ text: '0' });
		this.comments.add_actor(comment_icon);
		this.comments.add_actor(this.count);
		this.addActor(this.comments);
	}

	activate() {
		Util.spawn(['xdg-open', this.xlet.page]);
		this.update_comment_count(0);
		super.activate();
	}

	update_comment_count(count) {
		if (!this.count)
			return;

		this.count.set_text(count.toString());
		if (count > 0) {
			this.comments.opacity = 255;
			this.parent.add_unread(count);
		} else {
			this.comments.opacity = 128;
			this.parent.mark_as_read(this.xlet);
		}
	}

	destroy() {
		this.count = null;
		super.destroy();
	}
};


class SpicesNotifier extends Applet.TextIconApplet {
	constructor(meta, orientation, panel_height, instance_id) {
		super(orientation, panel_height, instance_id);
		this.set_applet_icon_symbolic_name('spices-comments')

		this.settings = new Settings.AppletSettings(this, meta.uuid, instance_id);
		this.settings.bind('username', 'username', this.reload);
		this.settings.bind('update-interval', 'update_interval', this.reload);

		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);

		let read_all = new PopupMenu.PopupIconMenuItem(_("Mark all as read"), 'object-select', St.IconType.SYMBOLIC);
		read_all.connect('activate', this.mark_all_as_read.bind(this));
		this._applet_context_menu.addMenuItem(read_all);

		this.updateId = 0;
		this.iteration = 0;

		this.reload();
	}

	on_applet_clicked() {
		if (this.menu.numMenuItems === 0)
			this.menu.addAction(_("No xlets found, click to reload"), this.reload.bind(this));
		this.menu.toggle();
	}

	on_applet_removed_from_panel() {
		if(this.updateId > 0)
			Mainloop.source_remove(this.updateId);
	}

	update_label() {
		if (this.unread > 0)
			this.set_applet_label(this.unread.toString())
		else
			this.set_applet_label('');
	}

	reload() {
		this.my_xlets = [];
		this.unread = 0;
		this.set_applet_label('');
		this.menu.removeAll();
		if(this.updateId > 0)
			Mainloop.source_remove(this.updateId);

		// We need this to avoid duplicates on consecutive loads, because it's async
		this.iteration++;
		this.get_xlets('applets');
		this.get_xlets('desklets');
		this.get_xlets('extensions');
		this.get_xlets('themes');

		let ms = this.update_interval * 60 * 1000;
		this.updateId = Mainloop.timeout_add(ms, this.reload.bind(this));
	}

	get_xlets(type) {
		let cache = this.get_xlet_cache(type);
		if (cache) {
			this.on_xlets_loaded(type, cache);
			return;
		}

		let iteration = this.iteration;
		let msg = Soup.Message.new('GET', `${SPICES_URL}/json/${type}.json`);
		session.queue_message(msg, (session, message) => {
			if (message.status_code === 200 && iteration === this.iteration) {
				let xlets = JSON.parse(message.response_body.data);
				this.save_xlet_cache(type, xlets);
				this.on_xlets_loaded(type, xlets);
			}
		});
	}

	save_xlet_cache(type, xlets) {
		// API only detects direct object writes
		// so we copy it, change it and write back again
		let cache = this.settings.getValue('xlets-cache');
		cache[type] = xlets;
		cache.timestamp = Date.now();
		this.settings.setValue('xlets-cache', cache);
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

	get_comment_count(xlet, item) {
		let [count, read] = this.get_comments_cache(xlet);
		if (count >= 0) {
			item.update_comment_count(count - read);
			return;
		}

		let msg = Soup.Message.new('GET', xlet.page);
		session.queue_message(msg, (session, message) => {
			if (message.status_code === 200) {
				let regex = /<[a-z]+ id="count">([0-9]+)<\/[a-z]+>/;
				let result = regex.exec(message.response_body.data);
				let count = result[1] ? parseInt(result[1]) : 0;
				this.set_comments_cache(xlet, count, read);
				item.update_comment_count(count - read);
			}
		});
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

		for(let uuid in xlets) {
			let xlet = xlets[uuid];
			if (xlet.author_user === this.username) {
				xlet.type = type;
				xlet.page = `${SPICES_URL}/${type}/view/${xlet['spices-id']}`;
				xlet.uuid = uuid; // Themes don't have UUIDs, use name

				let menuItem = new XletMenuItem(this, xlet);
				this.menu.addMenuItem(menuItem);
				menuItems.push(menuItem);
				this.my_xlets.push(xlet);
			}
		}
		if (menuItems.length > 0)
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		this.fetch_comments(menuItems);
	}

	fetch_comments(menuItems) {
		for(let item of menuItems) {
			this.get_comment_count(item.xlet, item);
		}
	}

	add_unread(count) {
		this.unread += count;
		this.update_label();
	}

	mark_as_read(xlet) {
		let [count, read] = this.get_comments_cache(xlet);
		this.set_comments_cache(xlet, count, count);
		this.unread -= count;
		this.update_label();
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
