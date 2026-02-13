/** Allows import of other files e.g. const GitHub=imports.github; = github.js */
imports.searchPath.push( imports.ui.appletManager.appletMeta["github-projects@morgan-design.com"].path );

/** Imports START **/
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Gettext = imports.gettext;
//const _ = Gettext.gettext;
const Cinnamon = imports.gi.Cinnamon;

const Applet = imports.ui.applet;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;

const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;

const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;

const Notify = imports.gi.Notify;

const CinnamonVersion=imports.misc.config.PACKAGE_VERSION;

const UUID = "github-projects@morgan-design.com";

// l10n/translation support

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

/** Imports END **/

/** Custom Files START **/
const GitHub=imports.github;
const Logger=imports.logger;
/** Custom Files END **/

const APPLET_ICON = global.userdatadir + "/applets/github-projects@morgan-design.com/icon.png";

const NotificationMessages = {
    AttemptingToLoad:   { title: _("GitHub Explorer"),					content: _("Attempting to Load your GitHub Repos") },
    SuccessfullyLoaded: { title: _("GitHub Explorer"),					content: _("Successfully Loaded GitHub Repos for user %s") + " ", replace: "USER_NAME" },
    ErrorOnLoad:		{ title: _("ERROR:: GitHub Explorer ::ERROR"), content: _("Failed to load GitHub Repositories! Check applet Configuration") }
};

// Simple space indents
const L1Indent = "  ";
const L2Indent = "    ";

/* Application Hook */
function main(metadata, orientation, instance_id) {
	let myApplet = new MyApplet(metadata, orientation, instance_id);
	return myApplet;
}

const Config = {
	show_issues_icon_on_repo_name: true
};

/* Constructor */
function MyApplet(metadata, orientation, instance_id) {
	this._init(metadata, orientation, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, instance_id) {

	Applet.IconApplet.prototype._init.call(this, orientation, instance_id);

	this.metadata = metadata;

	this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

	this._reloadGitHubFeedTimerId = 0;
	this._shouldDisplayLookupNotification = true;

	try {
	    this.set_applet_icon_path(APPLET_ICON);

	    this.settings.bindProperty(Settings.BindingDirection.IN,   // The binding direction - IN means we only listen for changes from this applet
					    "username",                               // The setting key, from the setting schema file
					    "username",                               // The property to bind the setting to - in this case it will initialize this.icon_name to the setting value
					    this.on_settings_changed,                  // The method to call when this.icon_name has changed, so you can update your applet
					    null);                                     // Any extra information you want to pass to the callback (optional - pass null or just leave out this last argument)

	    this.settings.bindProperty(Settings.BindingDirection.IN,
					    "enable-auto-refresh",
					    "enable_auto_refresh",
					    this.on_settings_changed,
					    null);

	    this.settings.bindProperty(Settings.BindingDirection.IN,
					    "enable-verbose-logging",
					    "enable_verbose_logging",
					    this.on_settings_changed,
					    null);

	    this.settings.bindProperty(Settings.BindingDirection.IN,
					    "enable-github-change-notifications",
					    "enable_github_change_notifications",
					    this.on_settings_changed,
					    null);

	    this.settings.bindProperty(Settings.BindingDirection.IN,
					    "refresh-interval",
					    "refresh_interval",
					    this.on_settings_changed,
					    null);

	    this.settings.bindProperty(Settings.BindingDirection.IN, 
	    				"show-issues-icon-on-repo-name",
	    				"show_issues_icon_on_repo_name",
	    				this.on_settings_changed,
					    null);

	    // Set version from metadata
	    this.settings.setValue("applet-version", metadata.version);

	    // Default set config so we know if things change later
	    Config.show_issues_icon_on_repo_name = this.settings.getValue("show-issues-icon-on-repo-name");

	    this.logger = new Logger.Logger({
		    uuid: this.metadata.uuid,
		    verboseLogging: this.settings.getValue("enable-verbose-logging")
	    });

		this.logger.debug("Cinnamon Version : " + CinnamonVersion);

	    // Menu setup
	    this.menu = new Applet.AppletPopupMenu(this, orientation);
	    this.menuManager = new PopupMenu.PopupMenuManager(this);
	    this.menuManager.addMenu(this.menu);

	    let self = this;

	    // Create and Setup new GitHub object
	    this.gh = new GitHub.GitHub({
		    username: this.settings.getValue("username"),
		    version: this.metadata.version,
		    logger: this.logger
	    });

	    // Handle failures
	    this.gh.onFailure(function(status_code, error_message){
		    self._handleGitHubErrorResponse(status_code, error_message);
	    });

	    // Handle success
	    this.gh.onSuccess(function(jsonData){
		    self._handleGitHubSuccessResponse(jsonData);
	    });

	    // Handle repo change events
	    this.gh.onRepositoryChangedEvent(function(changeEvent){
		    self._handleRepositoryChangedEvent(changeEvent);
	    });

	    // Add Settings menu item if not running cinnamon 2.0+
	    if(parseInt(CinnamonVersion) == 1) {
			let settingsMenu = new PopupMenu.PopupImageMenuItem(_("Settings"), "preferences-system-symbolic");
			settingsMenu.connect('activate', Lang.bind(this, function(){
				this._openSettingsConfiguration();
			}));
			this._applet_context_menu.addMenuItem(settingsMenu);	    	
	    }

	    // If no username set, launch configuration options and tell the user
	    if(this.settings.getValue("username") == "" || this.settings.getValue("username") == undefined){
		    this._openSettingsConfiguration();

		    this.set_applet_tooltip(_("Check Applet Configuration"));
		    this._displayErrorNotification(NotificationMessages['ErrorOnLoad']);
	    } else {
		    // Make first github lookup and trigger ticking timer!
		    this._startGitHubLookupTimer()
	    }
	}
	catch (e) {
	    if(this.logger!=undefined){
	        this.logger.error(e);
	        global.logError(e);
	    }
	    else{
	        global.logError(e);
	    }
	}
    },

    on_applet_clicked: function(event){
		this.menu.toggle();
    },

    on_applet_removed_from_panel: function() {
		this._killPeriodicTimer(); // Stop the ticking timer
		this.settings.finalize(); // We want to remove any connections and file listeners here
    },

    on_open_github_home_pressed: function(){ this._openUrl("http://github.com/jamesmorgan/github-explorer"); },

    on_open_cinnamon_home_pressed: function(){ this._openUrl("http://cinnamon-spices.linuxmint.com/applets/view/105"); },

    on_open_developer_home_pressed: function(){ this._openUrl("http://morgan-design.com"); },

    on_settings_changed: function() {
		var newUserName = this.settings.getValue("username");

		var refreshStillEnabled = this.settings.getValue("enable-auto-refresh");

		var userNameChanged = this.gh.username != newUserName;

		// Get the latest option
		var showIssuesIconOnRepo = this.settings.getValue("show-issues-icon-on-repo-name");
		
		// Has option changed
		var hasShowIssuesConfigChanged = Config.show_issues_icon_on_repo_name != showIssuesIconOnRepo;

		// Reset back on config object
		Config.show_issues_icon_on_repo_name = showIssuesIconOnRepo;

		this.gh.username = newUserName;

		this.logger.verboseLogging = this.settings.getValue("enable-verbose-logging");

		// If rehresh disabled then kill timer
		if(!refreshStillEnabled){
			this._killPeriodicTimer();
		}
		// If not ticking and enabled, start it
		else if (this._reloadGitHubFeedTimerId == null && refreshStillEnabled){
			this._startGitHubLookupTimer();
		}
		// If username changed perform new lookup
		else if(userNameChanged){
			this._triggerGitHubLookup();
		}
		// Refresh github if to show issues
		else if(hasShowIssuesConfigChanged){
			this._triggerGitHubLookup();
		}

		this.logger.debug("App : Username loaded = " + newUserName);
		this.logger.debug("App : Refresh Interval = " + this.settings.getValue("enable-auto-refresh"));
		this.logger.debug("App : Auto Refresh = " + this.settings.getValue("refresh-interval"));
		this.logger.debug("App : Show Issues = " + Config.show_issues_icon_on_repo_name);
		this.logger.debug("App : Verbose Logging = " + this.settings.getValue("enable-verbose-logging"));
		this.logger.debug("App : Github Notifications = " + this.settings.getValue("enable-github-change-notifications"));
    },

    _openSettingsConfiguration: function(){
	    Util.spawnCommandLine("cinnamon-settings applets " + this.metadata.uuid);
    },

    _handleGitHubErrorResponse: function(status_code, error_message){
		this.logger.error("Error Response, status code: " + status_code + " message: " + error_message);

		let notificationMessage = {};

		if(status_code === 403 && this.gh.hasExceededApiLimit()){
			notificationMessage = {title:"GitHub Explorer",content:error_message};
			this.set_applet_tooltip(_("API Rate Exceeded will try again once we are allowed"));
		}
		else {
			notificationMessage = NotificationMessages['ErrorOnLoad'];
			this.set_applet_tooltip(_("Check Applet Configuration"))
		}
		this._displayErrorNotification(notificationMessage);
		this._shouldDisplayLookupNotification = true;
    },

    _handleGitHubSuccessResponse: function(jsonData) {
		if(this._shouldDisplayLookupNotification){
			this._displayNotification(NotificationMessages['SuccessfullyLoaded']);
			this._shouldDisplayLookupNotification = false;
		}
		this.set_applet_tooltip(_("Click here to open GitHub") + "\l\n"+this.gh.lastAttemptDateTime);
		this._createApplicationMenu(jsonData);
    },

    _handleRepositoryChangedEvent: function(event){
		this.logger.debug("Change Event. type [" + event.type + "] content ["  + event.content + "]");
		if(this.settings.getValue("enable-github-change-notifications")){
			this._displayNotification({
				title: event.type + " - " + event.content,
				content: event.link_url
			});
		}
    },

     _displayNotification: function(notifyContent){
		let msg = notifyContent.content;
		switch(notifyContent.replace){
			case "USER_NAME":
				msg = msg.format(this.gh.username);
		}
		let notification = "notify-send \""+notifyContent.title+"\" \""+msg+"\" -i " + APPLET_ICON + " -a GIT_HUB_EXPLORER -t 10 -u low";
		this.logger.debug("notification call = [" + notification + "]")
		Util.spawnCommandLine(notification);
    },

    _displayErrorNotification: function(notificationMessage) {
		this.menu.removeAll();
		this._addDefaultMenuItems();
		this._displayNotification(notificationMessage);
    },

    _createApplicationMenu: function(repos) {
		this.logger.debug("Rebuilding Menu - attempt @ = " + this.gh.lastAttemptDateTime);
		this.menu.removeAll();

		this._addDefaultMenuItems();

		for (let i in repos) {
			let name = repos[i].name;
			let open_issues_count = repos[i].open_issues_count;

			// Show open issues if they have any
			let repoNameHeader = Config.show_issues_icon_on_repo_name && (open_issues_count != '0') 
										? name + " ("+open_issues_count+")"
										: name;
			// Main Menu Item
			let gitHubRepoMenuItem = new PopupMenu.PopupSubMenuMenuItem(repoNameHeader);

			// Open Repo Item
			let html_url = repos[i].html_url;
			let openRepoItem = this._createPopupImageMenuItem(L1Indent + _("Open Repo In Browser"), "web-browser-symbolic", function() {
					this._openUrl(html_url);
			});
			gitHubRepoMenuItem.menu.addMenuItem(openRepoItem);

			// Project Home Item
			let homepage = repos[i].homepage;
			if(homepage != undefined && homepage != ""){
				let projectHomePageItem = this._createPopupImageMenuItem(L1Indent + _("Project Home"), "user-home-symbolic", function() {
						this._openUrl(homepage);
				});
				gitHubRepoMenuItem.menu.addMenuItem(projectHomePageItem);
			}

			// Details
			let gitHubRepoDetailsItem = new PopupMenu.PopupSubMenuMenuItem(_(L1Indent + _("Details")), "dialog-information-symbolic");

			// Details : Watchers
			let openWatchers = this._createPopupImageMenuItem(L2Indent + _("Watchers") + ": " + repos[i].watchers_count, "avatar-default-symbolic", function() {
					this._openUrl("https://github.com/"+this.gh.username+"/"+name+"/watchers");
			}, { reactive: true });
			gitHubRepoDetailsItem.menu.addMenuItem(openWatchers);

			// Details : Open Issues
			let issuesIcon = open_issues_count == '0' ? "dialog-information" : "dialog-warning-symbolic";
			let openIssuesCountItem = this._createPopupImageMenuItem(L2Indent + _("Open Issues") + ": " + open_issues_count, issuesIcon, function() {
					this._openUrl("https://github.com/"+this.gh.username+"/"+name+"/issues");
			}, { reactive: true });
			gitHubRepoDetailsItem.menu.addMenuItem(openIssuesCountItem);

			// Details : Forks
			let forks = repos[i].forks;
			let forksItem = this._createPopupImageMenuItem(L2Indent + _("Forks") + ": " + forks, "preferences-system-network-proxy-symbolic", function() {
					this._openUrl("https://github.com/"+this.gh.username+"/"+name+"/network");
			}, { reactive: true });
			gitHubRepoDetailsItem.menu.addMenuItem(forksItem);

			// Add Details
			gitHubRepoMenuItem.menu.addMenuItem(gitHubRepoDetailsItem);

			this.menu.addMenuItem(gitHubRepoMenuItem);
		}
    },

    _createPopupImageMenuItem: function(title, icon, bindFunction, options){
		options = options || {};
		let openRepoItem = new PopupMenu.PopupImageMenuItem(title, icon, options);
		openRepoItem.connect("activate", Lang.bind(this, bindFunction));
		return openRepoItem;
    },

	_openUrl: function(url) {
		Util.spawnCommandLine("xdg-open " + url);
    },

    _addDefaultMenuItems: function() {
		this._addOpenGitHubMenuItem();
		this._addOpenGistMenuItem();
	    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    },

    _addOpenGitHubMenuItem: function(){
		var githubHomeMenu = this._createPopupImageMenuItem(_("Open GitHub Home"), "", function() {
				this._openUrl("https://github.com/"+this.gh.username);
		}, { reactive: true });

		this.menu.addMenuItem(githubHomeMenu);
    },

    _addOpenGistMenuItem: function(){
		var gistMenu = this._createPopupImageMenuItem(_("Create A Gist"), "", function() {
				this._openUrl("https://gist.github.com/");
		}, { reactive: true });

		this.menu.addMenuItem(gistMenu);
    },

    _killPeriodicTimer: function(){
		if (this._reloadGitHubFeedTimerId) {
			Mainloop.source_remove(this._reloadGitHubFeedTimerId);
			this._reloadGitHubFeedTimerId = null;
		}
    },

    _triggerGitHubLookup: function() {
		if(this._shouldDisplayLookupNotification){
			this._displayNotification(NotificationMessages['AttemptingToLoad']);
		}
		this.gh.loadDataFeed();
    },

    /**
     * This method should only be triggered once and then keep its self alive
     **/
    _startGitHubLookupTimer: function() {
		this._killPeriodicTimer();

		this._triggerGitHubLookup();

		let timeout_in_minutes = this.gh.hasExceededApiLimit()
						? this.gh.minutesUntilNextRefreshWindow()
						: this.settings.getValue("refresh-interval")

		this.logger.debug("Time in minutes until next API request [" + timeout_in_minutes + "]");

		let timeout_in_seconds = timeout_in_minutes * 60 * 1000;

		if (timeout_in_seconds > 0 && this.settings.getValue("enable-auto-refresh")) {
			this._reloadGitHubFeedTimerId = Mainloop.timeout_add(timeout_in_seconds, Lang.bind(this, this._startGitHubLookupTimer));
		}
    },
};
