const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const ByteArray = imports.byteArray;

const UUID = "duolingo-helper@nodeengineer.com";
const APPLET_PATH = global.userdatadir + "/applets/" + UUID;
const UPDATE_INTERVAL_SECONDS = 300;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function formatString(template, values) {
  let text = template;
  for (let value of values) {
    text = text.replace("%s", value);
  }
  return text;
}

let soupASyncSession;
if (Soup.MAJOR_VERSION === 2) {
    soupASyncSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(soupASyncSession, new Soup.ProxyResolverDefault());
} else {
    soupASyncSession = new Soup.Session();
}

function MyApplet(metadata, orientation, panelHeight, instanceId) {
  this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _init: function(metadata, orientation, panelHeight, instanceId) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

    this.metadata = metadata;
    this.instanceId = instanceId;
    this.usernames = [];
    this.userData = [];
    this.pendingRequests = 0;
    this.refreshTimer = 0;

    this.settings = new Settings.AppletSettings(this, UUID, instanceId);
    this.settings.bindProperty(
      Settings.BindingDirection.IN,
      "users",
      "users",
      this.onSettingsChanged,
      null
    );

    this.set_applet_icon_path(APPLET_PATH + "/icon.png");
    this.set_applet_label("Duo");
    this.set_applet_tooltip(_("Duolingo Helper"));

    this.addSettingsMenuItem();
    this.buildMenu(orientation);
    this.refresh();
  },

  addSettingsMenuItem: function() {
    this.settingsMenuItem = new PopupMenu.PopupIconMenuItem(
      _("Settings"),
      "xsi-preferences",
      St.IconType.SYMBOLIC
    );
    this.settingsMenuItem.connect("activate", () => this.configureApplet());
    this._applet_context_menu.addMenuItem(this.settingsMenuItem);
  },

  buildMenu: function(orientation) {
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.rebuildMenu();
  },

  on_applet_clicked: function() {
    this.menu.toggle();
  },

  on_applet_removed_from_panel: function() {
    if (this.refreshTimer > 0) {
      GLib.source_remove(this.refreshTimer);
      this.refreshTimer = 0;
    }
  },

  onSettingsChanged: function() {
    this.refresh();
  },

  getConfiguredUsers: function() {
    let names = [];
    let seen = {};
    let rows = this.users || [];

    for (let row of rows) {
      if (row.enabled === false) {
        continue;
      }

      let username = (row.username || "").trim();
      if (username.length === 0 || seen[username.toLowerCase()]) {
        continue;
      }

      seen[username.toLowerCase()] = true;
      names.push(username);
    }

    return names;
  },

  refresh: function() {
    if (this.refreshTimer > 0) {
      GLib.source_remove(this.refreshTimer);
      this.refreshTimer = 0;
    }

    this.usernames = this.getConfiguredUsers();
    this.userData = [];
    this.pendingRequests = this.usernames.length;

    if (this.usernames.length === 0) {
      this.set_applet_label("Duo");
      this.set_applet_tooltip(_("Duolingo Helper") + "\n" + _("Right-click -> Settings"));
      this.rebuildMenu();
      return;
    }

    this.set_applet_label("...");
    for (let username of this.usernames) {
      this.fetchUser(username);
    }

    this.refreshTimer = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      UPDATE_INTERVAL_SECONDS,
      () => {
        this.refresh();
        return GLib.SOURCE_REMOVE;
      }
    );
  },

  fetchUser: function(username) {
    let url = `https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(username)}`;
    let request = Soup.Message.new("GET", url);
    request.request_headers.set_content_type("application/json", null);

    if (Soup.MAJOR_VERSION === 2) {
      soupASyncSession.queue_message(request, (session, message) => {
        if (message.status_code !== 200) {
          this.recordError(username, message.status_code);
          return;
        }

        try {
          this.recordResponse(username, JSON.parse(message.response_body.data));
        } catch (err) {
          this.recordError(username, "parse");
        }
      });
    } else {
      soupASyncSession.send_and_read_async(request, Soup.MessagePriority.NORMAL, null, (session, response) => {
        if (request.get_status() !== 200) {
          this.recordError(username, request.get_status());
          return;
        }

        try {
          let bytes = session.send_and_read_finish(response);
          this.recordResponse(username, JSON.parse(ByteArray.toString(ByteArray.fromGBytes(bytes))));
        } catch (err) {
          this.recordError(username, "parse");
        }
      });
    }
  },

  recordResponse: function(username, responseParsed) {
    if (!responseParsed.users || responseParsed.users.length === 0) {
      this.recordError(username, "not-found");
      return;
    }

    this.userData.push(this.normalizeUser(responseParsed.users[0], username));
    this.finishRequest();
  },

  recordError: function(username, status) {
    this.userData.push({
      username: username,
      error: status === "not-found" ? _("not found") : formatString(_("Error %s"), [status])
    });
    this.finishRequest();
  },

  finishRequest: function() {
    this.pendingRequests--;
    if (this.pendingRequests <= 0) {
      this.userData.sort((a, b) => a.username.localeCompare(b.username));
      this.updateDisplay();
    }
  },

  normalizeUser: function(user, fallbackUsername) {
    let courses = user.courses || [];
    let currentCourse = null;

    for (let course of courses) {
      if (course.id === user.currentCourseId) {
        currentCourse = course;
        break;
      }
    }

    if (!currentCourse && courses.length > 0) {
      currentCourse = courses[0];
    }

    currentCourse = currentCourse || {};

    return {
      username: user.username || fallbackUsername,
      name: user.name || user.username || fallbackUsername,
      streak: user.streak || 0,
      totalXp: user.totalXp || 0,
      courseTitle: currentCourse.title || user.learningLanguage || _("no course"),
      courseXp: currentCourse.xp || 0,
      hasPlus: user.hasPlus === true,
      activeRecently: user.hasRecentActivity15 === true,
      courseCount: courses.length
    };
  },

  updateDisplay: function() {
    let validUsers = this.userData.filter(user => !user.error);

    if (validUsers.length === 0) {
      this.set_applet_label("Duo");
      this.set_applet_tooltip(this.buildTooltip());
      this.rebuildMenu();
      return;
    }

    let totalStreak = 0;
    for (let user of validUsers) {
      totalStreak += user.streak;
    }

    this.set_applet_label(validUsers.length + " | " + totalStreak);
    this.set_applet_tooltip(this.buildTooltip());
    this.rebuildMenu();
  },

  buildTooltip: function() {
    if (this.userData.length === 0) {
      return _("Duolingo Helper") + "\n" + _("No users configured");
    }

    let lines = [_("Duolingo Statistics")];
    for (let user of this.userData) {
      if (user.error) {
        lines.push(user.username + ": " + user.error);
        continue;
      }

      lines.push(
        formatString(_("%s: %s days, %s total XP, %s XP in %s%s"), [
          user.username,
          user.streak,
          user.totalXp,
          user.courseXp,
          user.courseTitle,
          user.hasPlus ? ", Plus" : ""
        ])
      );
    }

    return lines.join("\n");
  },

  rebuildMenu: function() {
    if (!this.menu) {
      return;
    }

    this.menu.removeAll();

    if (this.userData.length === 0) {
      this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("No users configured")));
    } else {
      for (let user of this.userData) {
        let text = user.error
          ? user.username + ": " + user.error
          : formatString(_("%s - %s days - %s XP"), [user.username, user.streak, user.totalXp]);
        let item = new PopupMenu.PopupMenuItem(text);
        if (!user.error) {
          item.connect("activate", () => this.openProfile(user.username));
        }
        this.menu.addMenuItem(item);
      }
    }

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    let openDuolingo = new PopupMenu.PopupMenuItem(_("Open Duolingo"));
    openDuolingo.connect("activate", () => GLib.spawn_command_line_async("xdg-open 'https://duolingo.com'"));
    this.menu.addMenuItem(openDuolingo);

    let refreshNow = new PopupMenu.PopupMenuItem(_("Refresh now"));
    refreshNow.connect("activate", () => this.refresh());
    this.menu.addMenuItem(refreshNow);
  },

  openProfile: function(username) {
    let url = "https://www.duolingo.com/profile/" + encodeURIComponent(username);
    GLib.spawn_command_line_async("xdg-open " + GLib.shell_quote(url));
  }
};

function main(metadata, orientation, panelHeight, instanceId) {
  return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
