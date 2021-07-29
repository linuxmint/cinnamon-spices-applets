/*
  Copyright © 2015-2016 Hasan Yavuz Özderya

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

const Lang = imports.lang;
const St = imports.gi.St;
const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const Pango = imports.gi.Pango;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const UUID = "mailnagapplet@ozderya.net";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const dbus_name = "mailnag.MailnagService";
const dbus_path = "/mailnag/MailnagService";
const dbus_interface = "mailnag.MailnagService";

const dbus_xml =
"<node name=\"/mailnag/MailnagService\"> \
  <interface name=\"mailnag.MailnagService\"> \
    <signal name=\"MailsRemoved\"> \
      <arg type=\"aa{sv}\" name=\"remaining_mails\" /> \
    </signal> \
    <signal name=\"MailsAdded\"> \
      <arg type=\"aa{sv}\" name=\"new_mails\" /> \
      <arg type=\"aa{sv}\" name=\"all_mails\" /> \
    </signal> \
    <method name=\"GetMailCount\"> \
      <arg direction=\"out\" type=\"u\" /> \
    </method> \
    <method name=\"MarkMailAsRead\"> \
      <arg direction=\"in\"  type=\"s\" name=\"mail_id\" /> \
    </method> \
    <method name=\"Shutdown\"> \
    </method> \
    <method name=\"GetMails\"> \
      <arg direction=\"out\" type=\"aa{sv}\" /> \
    </method> \
    <method name=\"CheckForMails\"> \
    </method> \
  </interface> \
</node>";

const MailnagProxy = Gio.DBusProxy.makeProxyWrapper(dbus_xml);

// if have more than this many, show "Mark All Read" button
const SHOW_MARK_ALL_COUNT = 3;

function dump(x)
{
    if (typeof x === "object" && x !== null) {
        global.log(JSON.stringify(x));
    }
    else
    {
        global.log(String(x));
    }
}

function MailItem(id, sender, sender_address, subject, datetime, account)
{
	this._init(id, sender, sender_address, subject, datetime, account);
}

MailItem.prototype = {
	__proto__: PopupMenu.PopupBaseMenuItem.prototype,

	_init: function(id, sender, sender_address, subject, datetime, account)
	{
		PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

		this.id = id;
        this.subject = subject;
        this.account = account;
		this.datetime = datetime;

        if (sender == "")
        {
            sender = sender_address;
        }
        this.sender = sender;

		try
		{
			this._sender_label = new St.Label(
				{text: sender, style_class: "mailnag-sender-label"});
			this._subject_label = new St.Label(
				{text: subject, style_class: "mailnag-subject-label"});
			this._datetime_label = new St.Label(
				{text: this.formatDatetime(datetime),
				 style_class: 'popup-inactive-menu-item'});

			// mark read icon
			let markReadIcon = new St.Icon({
				icon_name:   'edit-delete',
				icon_type:   St.IconType.SYMBOLIC,
				style_class: 'popup-menu-icon'
			});
			this.markReadButton = new St.Button(
				{child: markReadIcon, style_class: "mailnag-mark-read-button"});

			// setup layout
			this._vBox = new St.BoxLayout({vertical: true});

			this._vBox.add(this._sender_label);
			this._vBox.add(this._subject_label);

			this.addActor(this._vBox, {expand: true});
			this.addActor(this._datetime_label);
			this.addActor(this.markReadButton,
						  {expand: false, align: St.Align.END});
		}
		catch (e)
		{
			global.logError(e);
		}
	},

	activate: function(event, keepMenu)
	{
		this.emit('activate', event, true); // keepMenu=True, prevents menu from closing
	},

	updateTimeDisplay: function()
	{
		this._datetime_label.text = this.formatDatetime(this.datetime);
	},

	// formats datetime relative to now
	formatDatetime: function(datetime)
	{
		let now = new Date();
		const sec_1min = 60; // 60 sec
		const sec_1h = 60 * 60; // 60 min * 60 sec
		const sec_24h = 24 * 60 * 60; // 24 hours * 60 min * 60 sec
		const days_1w = 7 // 7 days
		const days_1m = 30 // 30 days
		let time_diff = (now.getTime() - datetime.getTime()) / 1e3;
		let days_diff = Math.floor(time_diff / sec_24h);

		if (days_diff == 0) // today
		{
			if (time_diff < sec_1min) // <1 minute
			{
				return _("just now");
			}
			else if (time_diff < 2 * sec_1min) // <2 minute
			{
				return "1 minute ago";
			}
			else if (time_diff < sec_1h) // <1 hour
			{
				return Math.floor(time_diff / sec_1min) + _(" minutes ago");
			}
			else if (time_diff < 2 * sec_1h) // <2 hours
			{
				return "1 hour ago";
			}
			else
			{
				return Math.floor(time_diff / sec_1h) + _(" hours ago");
			}
		}
		else // before today
		{
			if (days_diff == 1) // <1 day
			{
				return _("yesterday");
			}
			else if (days_diff < days_1w) // <1 week
			{
				return days_diff + _(" days ago");
			}
			else if (days_diff < days_1m) // <1 month
			{
				return Math.ceil(days_diff / days_1w) + _(" weeks ago");
			}
			else
			{
				return datetime.toLocaleDateString();
			}
		}
	}
}

function AccountMenu(account, orientation)
{
    this._init(account, orientation);
}

AccountMenu.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(account, orientation)
    {
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, account, false);
        this._orientation = orientation; // needed for sorting
		this.label.style_class = "mailnag-account-label";
		this.menuItems = {};
    },

    add: function(mailMenuItem)
    {
        if (this._orientation == St.Side.TOP)
        {
            this.menu.addMenuItem(mailMenuItem, 0); // add to top of menu
        }
        else
        {
            this.menu.addMenuItem(mailMenuItem); // add to bottom of menu
        }

		this.menuItems[mailMenuItem.id] = mailMenuItem;
    }
}

function NotificationSource()
{
	this._init.apply(this, arguments);
}

NotificationSource.prototype = {
	__proto__: MessageTray.Source.prototype,

	_init: function()
	{
		MessageTray.Source.prototype._init.call(this, "Mailnag");
		this._setSummaryIcon(this.createNotificationIcon());
	},

	createNotificationIcon: function()
	{
		return new St.Icon({icon_name: 'mail-unread', icon_size: this.ICON_SIZE});
	}
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

		this._orientation = orientation;

        this.set_applet_icon_symbolic_name("mail-read");
        this.set_applet_tooltip('?');
		this.set_applet_label('?');

        this.menuItems = {};
        this.accountMenus = {};

		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);

		this._applet_context_menu.addCommandlineAction(
			_("Configure Mailnag"), "mailnag-config");

		this.mailnagWasRunning = false;

		try
		{
			// init notifications
			this._notificationSource = new NotificationSource();
			if (Main.messageTray) Main.messageTray.add(this._notificationSource);

			// init settings
			this.settings = new Settings.AppletSettings(
				this, metadata["uuid"], instance_id);
			this.settings.bindProperty(Settings.BindingDirection.IN,
                "notifications", "notifications_enabled", function(){});
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "launch_client_on_click", "launch_client_on_click", function(){});
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "client", "client", function(){});
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "middle_click", "middle_click_behavior", function(){});
		}
		catch (e)
		{
			global.logError(e);
		}

		try
		{
			// watch bus
			this.busWatcherId = Gio.bus_watch_name(
				Gio.BusType.SESSION, dbus_name, Gio.BusNameOwnerFlags.NONE,
				Lang.bind(this, this.onBusAppeared), Lang.bind(this, this.onBusVanished));
		}
		catch(e)
		{
			global.logError(e);
		}
    },

	// called on applet startup (even though mailnag bus already exists)
	onBusAppeared: function()
	{
		try
		{
			let bus = Gio.bus_get_sync(Gio.BusType.SESSION, null)
			this.mailnag = new MailnagProxy(bus, dbus_name, dbus_path);

			// connect mailnag signals
			this._onMailsAddedId = this.mailnag.connectSignal(
				'MailsAdded', Lang.bind(this, this.onMailsAdded));
			this._onMailsRemovedId = this.mailnag.connectSignal(
				'MailsRemoved', Lang.bind(this, this.onMailsRemoved));

			this.loadMails();

			this.mailnagWasRunning = true;
		}
		catch(e)
		{
			global.logError(e);
		}
	},

	onBusVanished: function()
	{
		// disconnect signals
		if (typeof this._onMailsAddedId !== "undefined")
		{
			this.mailnag.disconnectSignal(this._onMailsAddedId);
			this.mailnag.disconnectSignal(this._onMailsRemovedId);
			delete this._onMailsAddedId;
			delete this.mailnag;
		}

		// TODO: delete any notifications currently alive

		if (this.mailnagWasRunning)
		{
			this.showError(_("Mailnag daemon stopped working!"));
		}
		else
		{
			this.showError(_("Mailnag daemon isn't running! Do you have it installed?"));
		}
	},

	loadMails: function()
	{
		this.menu.removeAll();
		this.menuItems = {};
		this.accountMenus = {};

		try
		{
			let mails = this.getMails();
			if (mails.length > 0)
			{
				this.removeNoUnread();

				mails = this.sortMails(mails);

				if (mails.length > SHOW_MARK_ALL_COUNT)
				{
					this.showMarkAllRead();
				}

				for (var mail of Object.values(mails))
                {
                    let mi = this.makeMenuItem(mail);
					this.addMailMenuItem(mi);
                }
			}
			else
			{
				this.showNoUnread();
			}
			this.showMailCount();
		}
		catch (e)
		{
			// TODO: show error messsage in menu
			global.logError(e);
		}
	},

	getMails: function()
	{
		try
		{
			let mails = this.mailnag.GetMailsSync();
			return this.fromDbusMailList(mails);
		}
		catch (e)
		{
			// TODO: show error messsage in menu
			global.logError(e);
		}
	},

	// converts the mail list returned from dbus to a list of dictionaries
	fromDbusMailList: function(dbusList)
	{
		let mails = dbusList[0];
		let r = [];

		for (var mail of Object.values(mails))
		{
			let [sender, size1] = mail['sender_name'].get_string();
			let [sender_address, size2] = mail['sender_addr'].get_string();
			let [subject, size3] = mail['subject'].get_string();
			let [mail_id, size4] = mail['id'].get_string();
            let datetime = new Date(mail['datetime'].get_int32()*1000); // sec to ms
            let account = "";
            try
            {
                let [accountx, size5] = mail['account_name'].get_string();
                account = accountx;

				// make mail id unique in case same mail appears in multiple accounts (in case of mail forwarding)
				mail_id += "_" + account;
            }
            catch (e)
            {
                // ignored
            }

			r.push({id: mail_id, sender: sender, datetime: datetime,
                    sender_address: sender_address, subject: subject,
                    account: account});
		}
		return r;
	},

	sortMails: function(mails)
	{
		// ascending order
		mails.sort(function(m1, m2) {return m1.datetime - m2.datetime;});
		return mails;
	},

	onMailsAdded: function(source, t, newMails)
	{
		try
		{
			this.removeNoUnread();

			newMails = this.fromDbusMailList(newMails);
			newMails = this.sortMails(newMails);

			if (this.currentMailCount() + newMails.length > SHOW_MARK_ALL_COUNT)
			{
				this.showMarkAllRead();
			}

			for (var mail of Object.values(newMails))
            {
                let mi = this.makeMenuItem(mail);
				this.addMailMenuItem(mi);
			}
			this.notify(newMails);
			this.showMailCount();

			if (this.currentMailCount() > SHOW_MARK_ALL_COUNT)
			{
				this.showMarkAllRead();
			}
		}
		catch(e)
		{
			global.logError(e);
		}
	},

	onMailsRemoved: function(source, t, remainingMails)
	{
		try
		{
			remainingMails = this.fromDbusMailList(remainingMails);

			// make a list of remaining ids
			let ids = [];
			for (let mail of Object.values(remainingMails))
			{
				ids.push(mail.id);
			}

			// remove menu item if its id isn't in the list
			for (let mi of Object.values(this.menuItems))
			{
				if (ids.indexOf(mi.id) < 0)
				{
					this.removeMailMenuItem(mi.id);
				}
			}
		}
		catch (e)
		{
			global.logError(e);
		}
	},

	makeMenuItem: function(mail)
	{
		let mi = new MailItem(mail.id, mail.sender, mail.sender_address, mail.subject, mail.datetime, mail.account);
		mi.markReadButton.connect(
			'clicked',
            Lang.bind(this, function(){this.markMailRead(mail.id)}));
        mi.connect('activate', Lang.bind(this, this.launchClient));
		this.menuItems[mail.id] = mi;
		return mi;
    },

    makeAccountMenu: function(account)
    {
        let accmenu = new AccountMenu(account, this._orientation);
        this.accountMenus[account] = accmenu;

        if (this._orientation == St.Side.TOP)
        {
            this.menu.addMenuItem(accmenu, 0);
        }
        else
        {
            this.menu.addMenuItem(accmenu);
        }

        return accmenu;
    },

	// Adds a MailItem to the menu. If `account` is defined it's added
	// to its 'account menu'. An 'account menu' is created if it
	// doesn't exist.
	addMailMenuItem : function(mailItem)
	{
        if (mailItem.account)
        {
            let accmenu;
            if (mailItem.account in this.accountMenus)
            {
                accmenu = this.accountMenus[mailItem.account];
            }
            else
            {
                accmenu = this.makeAccountMenu(mailItem.account);
            }
            accmenu.add(mailItem);
        }
        else
        {
            if (this._orientation == St.Side.TOP)
            {
                this.menu.addMenuItem(mailItem, 0); // add to top of menu
            }
            else
            {
                this.menu.addMenuItem(mailItem); // add to bottom of menu
            }
        }
	},

	notify: function(mails)
	{
		try
		{
			if (!this.notifications_enabled) return;

			let ntfTitle = "";
			let ntfBody = "";
			let markButtonLabel = "";
			if (mails.length > 1)
			{
				ntfTitle = _("You have %d new mails!").format(mails.length);
				markButtonLabel = _("Mark All Read");
				for (var mail of Object.values(mails))
				{
					ntfBody += mail.subject + "\n";
				}
			}
			else
			{
				ntfTitle = _("You have new mail!");
				ntfBody = mails[0].subject;
				markButtonLabel = _("Mark Read");
			}
			let notification = new MessageTray.Notification(
				this._notificationSource,
				"Mailnag", ntfTitle,
				{
					body: ntfBody
				}
			)
			notification.setTransient(true);
			notification.addButton('mark-read', markButtonLabel);
			notification.connect('action-invoked', Lang.bind(this, function(source, action) {
				if (action == 'mark-read')
				{
					this.markMailsRead(mails)
					source.destroy();
				}
			}));
			this._notificationSource.notify(notification);
		}
		catch (e)
		{
			global.logError(e);
		}
	},

	showMarkAllRead: function()
	{
		try
		{
			if (typeof this._markAllRead !== "undefined")
			{
				this.removeMarkAllRead();
			}

			this._markAllRead = new PopupMenu.PopupMenuItem(_("Mark All Read"));
			this._separator = new PopupMenu.PopupSeparatorMenuItem();

			this._markAllRead.connect('activate', Lang.bind(this, this.markAllRead));

			if (this._orientation == St.Side.TOP)
			{
				this.menu.addMenuItem(this._separator);
				this.menu.addMenuItem(this._markAllRead);
			}
			else
			{
				this.menu.addMenuItem(this._markAllRead, 0);
				this.menu.addMenuItem(this._separator, 1);
			}
		}
		catch (e)
		{
			global.logError(e);
		}
	},

	removeMarkAllRead: function()
	{
		try
		{
			if (typeof this._markAllRead !== "undefined")
			{
				this._markAllRead.destroy();
				this._separator.destroy();
				delete this._markAllRead;
				delete this._separator;
			}
		}
		catch (e)
		{
			global.logError(e);
		}
	},

	// removes all items from menu and adds a message
	showNoUnread: function()
	{
		try
		{
            this.menu.removeAll();
            this.accountMenus = {};
            this.menuItems = {};
			this._noUnreadItem = this.menu.addAction(_("No unread mails."));
			this.set_applet_icon_symbolic_name("mail-read");
		}
		catch (e)
		{
			global.logError(e);
		}
	},

	// makes sure "no unread mail" is not shown
	removeNoUnread: function()
	{
		try
		{
			if (typeof this._noUnreadItem !== "undefined")
			{
				this._noUnreadItem.destroy();
				delete this._noUnreadItem;
			}
			this.set_applet_icon_symbolic_name("mail-unread");
		}
		catch (e)
		{
			global.logError(e);
		}
	},

	currentMailCount: function()
	{
		return Object.keys(this.menuItems).length;
	},

	showMailCount: function()
	{
		// display '?' if mailnag proxy is not present
		if (typeof this.mailnag === 'undefined')
		{
			this.set_applet_label('?');
			this.set_applet_tooltip(_("Mailnag daemon is not running!"));
		}
		else
		{
			let num = Object.keys(this.menuItems).length
			this.set_applet_label(num.toString());
			if (num > 0)
            {
                if (num == 1)
                {
                    let s = "";
                    for (var m of Object.values(this.menuItems)) // actually there is only 1 item
                    {
                        s = _("You have a mail from %s!").format(m.sender);
                    }
                    this.set_applet_tooltip(s);
                }
                else
                {
                    this.set_applet_tooltip(_("You have %d unread mails!").format(num));
                }
            }
			else
			{
				this.set_applet_tooltip(_("No unread mails."));
			}
		}
	},

	showError: function(message)
	{
		global.logError("MailnagApplet ERROR: " + message);

		this.menu.removeAll();
		this.set_applet_label('!!');
		this.set_applet_tooltip(_("Click to see error!"));
		this.menu.addAction(_("Error: " + message));
		this.set_applet_icon_symbolic_name("mail-unread");
	},

	markMailRead: function(id)
	{
		try
		{
			// remove account name from mail id
			let actual_id = id.slice(0, id.indexOf("_"));

			// tell mailnag
			this.mailnag.MarkMailAsReadSync(actual_id);

			this.removeMailMenuItem(id);
		}
		catch(e)
		{
			global.logError(e);
		}
	},

	removeMailMenuItem: function(id)
	{
		// switch the focus to `menu` from `menuItem` to prevent menu from closing
		this.menu.actor.grab_key_focus();

		// update account menu if there is one
		let account = this.menuItems[id].account;
		if (account)
		{
			let accountMenu = this.accountMenus[account];
			delete accountMenu.menuItems[id];
			if (Object.keys(accountMenu.menuItems).length == 0)
			{
				// remove account menu as well
				accountMenu.destroy();
				delete this.accountMenus[account];
			}
		}

		// remove menu item
		this.menuItems[id].destroy();
		delete this.menuItems[id];

		// handle other visual updates
		if (Object.keys(this.menuItems).length == 0)
		{
			this.showNoUnread();
			this.menu.close();
		}
		this.showMailCount();

		if (this.currentMailCount() <= SHOW_MARK_ALL_COUNT)
		{
			this.removeMarkAllRead();
		}

		// TODO: destroy the notification as well if any
	},

	// marks a list of mails as read
	markMailsRead: function(mails)
	{
		try
		{
			for (var mail of Object.values(mails))
			{
				this.markMailRead(mail.id)
			}
		}
		catch(e)
		{
			global.logError(e);
		}
	},

	// mark all currently displayed mail as read
	markAllRead: function()
	{
		for (var m of Object.values(this.menuItems))
		{
			this.markMailRead(m.id);
		}
    },

    launchClient: function()
    {
        if (!this.launch_client_on_click) return;

        if (this.client.startsWith("http")) // client is a web page
        {
            Util.spawnCommandLine("xdg-open " + this.client);
        }
        else // client is a command
        {
            Util.spawnCommandLine(this.client);
        }
        this.menu.close();
    },

    on_applet_clicked: function(event) {
        if (!this.menu.isOpen)
        {
            for (let accmenu of Object.values(this.accountMenus))
            {
                accmenu.menu.open();
            }

			for (let mi of Object.values(this.menuItems))
			{
				mi.updateTimeDisplay();
			}
        }
        this.menu.toggle();
    },

	_onButtonPressEvent: function (actor, event)
	{
		if (event.get_button() == 2) // 2: middle button
		{
			switch (this.middle_click_behavior)
			{
				case "mark_read":
				    this.markAllRead();
				    break;
				case "launch_client":
				    this.launchClient();
				    break;
				default:
				    // do nothing
				    break;
			}
		}
		return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
	},

	on_orientation_changed: function(orientation)
	{
		this._orientation = orientation
		try
		{
			this.loadMails();
		}
		catch (e)
		{
			global.logError(e);
		}
	},

	on_applet_removed_from_panel: function()
	{
		// TODO: remove all notifications
		if (typeof this._onMailsAddedId !== "undefined")
		{
			this.mailnag.disconnectSignal(this._onMailsAddedId);
			delete this._onMailsAddedId;
		}
		if (typeof this._onMailsRemovedId !== "undefined")
		{
			this.mailnag.disconnectSignal(this._onMailsRemovedId);
			delete this._onMailsRemovedId;
		}

		Gio.bus_unwatch_name(this.busWatcherId);
	}
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
