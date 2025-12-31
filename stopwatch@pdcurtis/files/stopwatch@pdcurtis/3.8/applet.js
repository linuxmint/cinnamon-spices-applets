/* This applet provides a Simple Stopwatch.
It is not only useful in its own right
but is also provides a 'tutorial' framework for other more
complex applets - for example it provides a settings screen
and a 'standard' right click (context) menu which opens
the settings panel and a Housekeeping submenu accessing
help and a version/update files and also the gnome system monitor program
in case you want to find out how much machine power this applet is
using at various update rates. It also an example of how to implement
l10n localisation/translation support.
Items with a ++ in the comment are not specific to this applet and useful for re-use
*/
const Applet = imports.ui.applet; // ++
const Settings = imports.ui.settings; // ++ Needed if you use Settings Screen
const St = imports.gi.St; // ++
const PopupMenu = imports.ui.popupMenu; // ++ Needed for menus
const Lang = imports.lang; //  ++ Needed for menus
const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Gettext = imports.gettext; // ++ Needed for translations
const Mainloop = imports.mainloop; // Needed for timer update loop

/*
// Old l10n/translation support thanks to @NikoKrause to be removed next update
const Gettext = imports.gettext
const UUID = "stopwatch@pdcurtis"
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}
*/

// ++ Always needed if you want localisation/translation support
// New l10n support thanks to ideas from @Odyseus, @lestcape and @NikoKrause
// Note UUID is set in MyApplet _init: below and before function called
// and const Gettext = imports.gettext; is now in list above for consistency
var UUID;

function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);

    if (customTrans !== str && customTrans !== "")
        return customTrans;

    return Gettext.gettext(str);
}


// modifier button
class TimeModifierButton extends PopupMenu.PopupBaseMenuItem
{
    constructor (applet, label, modifier)
    {
        super();
        this._init();

        this._applet = applet;
        this._modifier = modifier;

        this.label = new St.Label({ text: label });
        this.addActor(this.label);
        this.label.realize();

        this.connect('activate', this._on_activate.bind(this));
    }

    _on_activate ()
    {
        this._applet.startTime -= this._modifier;
        this._applet.pausedAt += this._modifier;
        this._applet.updateUI()
    }
}


// ++ Always needed
function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

// ++ Always needed
MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype, // Text Applet

    _init: function (metadata, orientation, panelHeight, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id); // ++ Picks up UUID from metadata for Settings

            this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
                "refreshInterval-spinner", // The setting key
                "refreshInterval", // The property to manage (this.refreshInterval)
                this.on_settings_changed, // Callback when value changes
                null); // Optional callback data

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "counterTitle",
                "counterTitle",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "modeContinueCounting",
                "modeContinueCounting",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "displayFullPanel",
                "displayFullPanel",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "enableExperimentalFunctions",
                "enableExperimentalFunctions",
                this.on_settings_changed,
                null);

             // The following are generic Settings used to save values through Cinnamon and machine restarts etc
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "counterStatus",
                "counterStatus",
                this.on_generic_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
               "pausedAt",
               "pausedAt",
               this.on_generic_changed,
               null);

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "startTime",
                "startTime",
                this.on_generic_changed,
                null);

            // ++ Make metadata values available within applet for context menu.
            this.cssfile = metadata.path + "/stylesheet.css"; // No longer required
            this.changelog = metadata.path + "/CHANGELOG.md";
            this.helpfile = metadata.path + "/README.md";
            this.appletPath = metadata.path;

            // ++ Part of new l10n support
            UUID = metadata.uuid;
            Gettext.bindtextdomain(metadata.uuid, GLib.get_home_dir() + "/.local/share/locale");

            this.settingsCommand = 'cinnamon-settings applets ' + metadata.uuid;
            this.applet_running = true; //** New

            // Choose Text Editor depending on whether Mint 18 with Cinnamon 3.0 and latter
            if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.0" ) <= 0 ){
               this.textEd = "gedit";
            } else {
                this.textEd = "xdg-open";
            }

            // Check stylesheet file over-ride location and use
            this.ccsfilePersistent = GLib.get_home_dir() + "/" + UUID + "/stylesheet.css"; // path to stylesheet file placed in user's home folder.
            if (GLib.file_test(this.ccsfilePersistent, GLib.FileTest.EXISTS)) {
//                  Main.warningNotify(_("Stopwatch Applet - Stylesheet persistence active"));
                  //Over-ride code - currently a copy which needs an extra cinnamon restarts after any change
                  GLib.spawn_command_line_async("cp  " + this.ccsfilePersistent + " " + metadata.path + "/stylesheet.css");
            }


            // ++ Build Context (Right Click) Menu
            this.buildContextMenu();

            // Set initial conditions

            if(this.counterStatus == "ready") {
                    this.startTime = this.getCurrentTime(); // Called first run before Settings has received a value.
            }


            // Finally start the update loop for the applet display running
            this.updateLoop();
        } catch (e) {
            global.logError(e);
        }
    },

    // ++ Function called when settings are changed
    on_settings_changed: function () {
        this.updateLoop();
    },

    // ++ Null function called when Generic (internal) Setting changed
    on_generic_changed: function () {
    },

    // ++ Build the Right Click Context Menu
    buildContextMenu: function () {
        this._applet_context_menu.removeAll();

        // name modifier
        let section = new PopupMenu.PopupMenuSection();
        section.actor.set_style('margin: 5px 0; padding: 0 10px;');
        this._applet_context_menu.addMenuItem(section);

        this._searchEntry = new St.Entry({
            name: 'menu-search-entry',
            hint_text: _('Name'),
            text: this.counterTitle,
            track_hover: true,
            can_focus: true

        });

        section.actor.add_actor(this._searchEntry);

        this._searchEntryText = this._searchEntry.clutter_text;
        this._searchEntryText.connect('key-press-event', (se, prop) => {
            this.counterTitle = this._searchEntry.get_text();
            this.updateLoop();
        });

        // state modifiers
        let container = new St.BoxLayout();
        container.set_style('padding: 3px 8px;');
        this._applet_context_menu.addActor(container);

        let menuitem = new PopupMenu.PopupMenuItem(_("Start   "));
        menuitem.connect('activate', Lang.bind(this, function (event) {
            this.counterStatus = "running";
            this.startTime = this.getCurrentTime();
            this.updateLoop();
        }));
        container.add_actor(menuitem.actor);

        menuitem = new PopupMenu.PopupMenuItem(_("Pause   "));
        menuitem.connect('activate', Lang.bind(this, function (event) {
            this.counterStatus = "paused";
            this.pausedAt = this.currentCount; // Changed to reduce load on Settings
            this.updateUI();
        }));
        container.add_actor(menuitem.actor);

        menuitem = new PopupMenu.PopupMenuItem(_("Reset   "));
        menuitem.connect('activate', Lang.bind(this, function (event) {
            this.counterStatus = "ready";
            this.updateUI();
        }));
        container.add_actor(menuitem.actor);


        menuitem = new PopupMenu.PopupMenuItem(_("Continue  "));
        menuitem.connect('activate', Lang.bind(this, function (event) {
            if (this.counterStatus == "paused") {
                this.updateUI();
                this.counterStatus = "running";
                this.startTime = this.getCurrentTime() - this.pausedAt; // Fudge start time
                this.updateLoop();
            }
        }));
        container.add_actor(menuitem.actor);


        menuitem = new PopupMenu.PopupMenuItem(_("Continue from Start"));
        menuitem.connect('activate', Lang.bind(this, function (event) {
            if (this.counterStatus == "paused") {
                this.counterStatus = "running";
                this.updateLoop();
            }
        }));
        container.add_actor(menuitem.actor);



        if (this.enableExperimentalFunctions) {

/*         Time modifier buttons - possible precursor to mechanism for adding a timer function
           Currently needs Cinnamon restart to enable these functions
           as Context menu is not rebuilt 0n-the-fly when it is enabled.
*/
           let container2 = new St.BoxLayout();
           container2.set_style('padding: 5px 20px;');
           this._applet_context_menu.addActor(container2);

           let button;

           button = new TimeModifierButton(this, '-1h', -60*60);
           button.actor.set_style('padding: 5px 10px;');
           container2.add_actor(button.actor);

           button = new TimeModifierButton(this, '-15min', -15*60);
           button.actor.set_style('padding: 5px 10px;');
           container2.add_actor(button.actor);

           button = new TimeModifierButton(this, '-5min', -5*60);
           button.actor.set_style('padding: 5px 10px;');
           container2.add_actor(button.actor);

           button = new TimeModifierButton(this, '+5min', 5*60);
           button.actor.set_style('padding: 5px 10px;');
           container2.add_actor(button.actor);

           button = new TimeModifierButton(this, '+15min', 15*60);
           button.actor.set_style('padding: 5px 10px;');
           container2.add_actor(button.actor);

           button = new TimeModifierButton(this, '+1h', 60*60);
           button.actor.set_style('padding: 5px 10px;');
           container2.add_actor(button.actor);

        }

/*
        // other buttons to be removed after testing completed
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        menuitem = new PopupMenu.PopupMenuItem(_("If paused, continue counting from now"));
        menuitem.connect('activate', Lang.bind(this, function (event) {
            if (this.counterStatus == "paused") {
                this.updateUI();
                this.counterStatus = "running";
                this.startTime = this.getCurrentTime() - this.pausedAt; // Fudge start time
                this.updateLoop();
            }
        }));
        this._applet_context_menu.addMenuItem(menuitem);

        menuitem = new PopupMenu.PopupMenuItem(_("If paused, continue counting from original start time"));
        menuitem.connect('activate', Lang.bind(this, function (event) {
            if (this.counterStatus == "paused") {
                this.counterStatus = "running";
                this.updateLoop();
            }
        }));
        this._applet_context_menu.addMenuItem(menuitem);
*/
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // ++ Set up sub menu for Housekeeping and System Items
        this.subMenu1 = new PopupMenu.PopupSubMenuMenuItem(_("Housekeeping and System Sub Menu"));
        this._applet_context_menu.addMenuItem(this.subMenu1);

        this.subMenuItem1 = new PopupMenu.PopupMenuItem(_("View the Changelog"));
        this.subMenuItem1.connect('activate', Lang.bind(this, function (event) {
            GLib.spawn_command_line_async(this.textEd + ' ' + this.changelog);
        }));
        this.subMenu1.menu.addMenuItem(this.subMenuItem1); // Note this has subMenu1.menu not subMenu1._applet_context_menu as one might expect

        this.subMenuItem2 = new PopupMenu.PopupMenuItem(_("Open the Help file"));
        this.subMenuItem2.connect('activate', Lang.bind(this, function (event) {
            GLib.spawn_command_line_async(this.textEd + ' ' + this.helpfile);
        }));
        this.subMenu1.menu.addMenuItem(this.subMenuItem2);


        this.subMenuItem4 = new PopupMenu.PopupMenuItem(_("Open stylesheet.css  (Advanced Function)"));
        this.subMenuItem4.connect('activate', Lang.bind(this, function (event) {
            GLib.spawn_command_line_async(this.textEd + ' ' + this.cssfile);
        }));
        this.subMenu1.menu.addMenuItem(this.subMenuItem4);

        this.subMenuItem3 = new PopupMenu.PopupMenuItem(_("Open the gnome system monitor (Advanced testing function)"));
        this.subMenuItem3.connect('activate', Lang.bind(this, function (event) {
            GLib.spawn_command_line_async('gnome-system-monitor');
        }));
        this.subMenu1.menu.addMenuItem(this.subMenuItem3);

        if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"2.0" ) <= 0 ){
            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let menuitem = new PopupMenu.PopupMenuItem(_("Configure..."));
            menuitem.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.settingsCommand);
            }));
            this._applet_context_menu.addMenuItem(menuitem);
        }
    },

    // Compare two version numbers (strings) based on code by Alexey Bass (albass)
    // Takes account of many variations of version numers including cinnamon.
    versionCompare: function (left, right) {
       if (typeof left + typeof right != 'stringstring')
            return false;
       var a = left.split('.'),
         b = right.split('.'),
         i = 0, len = Math.max(a.length, b.length);
        for (; i < len; i++) {
            if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
                return 1;
            } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
                return -1;
            }
        }
       return 0;
    },

    // Gets the current time in milliseconds from 1970
    getCurrentTime: function () {
        let d = new Date();
        let x = Math.floor(d.getTime() / 1000);
        return x;
    },

    // Return time formated as hh:mm:ss or mm:ss if hours 0 with a verbose string in this.verboseCount
    formatTime: function (value) {
        let temp = value;
        this.days = Math.floor(temp / (3600 * 24));
        temp = temp - (this.days * 3600 * 24);
        this.hours = Math.floor(temp / 3600);
        temp = temp - (this.hours * 3600);
        this.minutes = Math.floor(temp / 60);
        this.seconds = temp - (this.minutes * 60);
        let string = "";
        this.verboseCount = "";
        if (this.days > 0) {
            this.verboseCount = this.verboseCount + this.days + " " + _("days") + " "
        };
        if (this.hours > 0) {
            this.verboseCount = this.verboseCount + this.hours + " " + _("hours") + " "
        };
        if (this.minutes < 10) {
            this.verboseCount = this.verboseCount + "0"
        };
        this.verboseCount = this.verboseCount + this.minutes + ":";
        if (this.seconds < 10) {
            this.verboseCount = this.verboseCount + "0"
        };
        this.verboseCount = this.verboseCount + this.seconds;
        if (this.hours > 0 && this.hours < 10) {
            string = string + "0"
        };
        if (this.hours > 0) {
            string = string + this.hours + ":"
        };
        if (this.minutes < 10) {
            string = string + "0"
        };
        string = string + this.minutes + ":";
        if (this.seconds < 10) {
            string = string + "0"
        };
        string = string + this.seconds
        return string;
    },

    // Handler for when the applet is clicked - cycles through states
    on_applet_clicked: function (event) {
        this.updateUI(); // Update as could be delayed from updateLoop
        if (this.counterStatus == "ready") {
            this.counterStatus = "running";
            this.startTime = this.getCurrentTime();

        } else if (this.counterStatus == "running") {
            this.counterStatus = "paused";
            this.pausedAt = this.currentCount; // Changed to reduce calls to Settings

        } else if (this.counterStatus == "paused") {
            if (this.modeContinueCounting) {
                this.updateUI();
                this.counterStatus = "running";
                this.startTime = this.getCurrentTime() - this.pausedAt; // Fudge start time
            } else {
                this.counterStatus = "ready"
            }
        }
        this.updateLoop();
    },



    // This updates the numerical display in the applet and in the tooltip and background colour of applet
    updateUI: function () {

        var label = ""
        var tooltip = ''
        var klass = 'stopwatch '
        if (this.displayFullPanel) {
             label = this.counterTitle + "\n"
        }


        if (this.counterStatus == 'running') {
            this.currentCount = this.getCurrentTime() - this.startTime
            label += this.formatTime(this.currentCount);
            tooltip = this.counterTitle + ': ' + _('Running for') + ' ' + this.verboseCount + ' - ' + _('Click to Pause');


            if (this.days > 0) {
                klass = ' stopwatch-running-day-exceeded'
            } else {
                klass = 'stopwatch stopwatch-running'
            }
        }
        else if (this.counterStatus == 'paused') {
            label += this.formatTime(this.pausedAt)

            if (this.modeContinueCounting) {
                tooltip = this.counterTitle + ': ' + _('Paused at') + ' ' + this.verboseCount + ' - ' + _('Click to Continue Counting')
            } else {
                tooltip = this.counterTitle + ': ' + _('Paused at') + ' ' + this.verboseCount + ' - ' + _('Click to Reset')
            }

            if (this.days > 0) {
                klass += 'stopwatch-paused-day-exceeded'
            } else {
                klass += 'stopwatch-paused'
            }
        }
        else if (this.counterStatus == 'ready') {
            label += '00:00'
            tooltip = this.counterTitle + ': ' + _('Ready - Click to Start')
            klass = 'stopwatch stopwatch-ready'
        }

        this.set_applet_tooltip(tooltip)
        this.set_applet_label(label)
        this.actor.style_class = klass
    },


    // This is the loop run at refreshInterval rate to call updateUI() to update the display in the applet and tooltip
    updateLoop: function () {
        this.updateUI();
        // Only run updateLoop if counter running to save processsor load
        // Also inhibit when applet after has been removed from panel
        if (this.counterStatus == "running"  && this.applet_running == true) {
            Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this.updateLoop));
        }
    },


    // ++ This finalises the settings when the applet is removed from the panel
    on_applet_removed_from_panel: function () {
        // inhibit the update timer when applet removed from panel
        this.applet_running = false;
        this.settings.finalize();
    }
};

function main(metadata, orientation, panelHeight, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
    return myApplet;
}
/*
0.9.0 Release Candidate 30-07-2013
0.9.1 Help file facility added and link to gnome-system-monitor
0.9.2 Change Hold to Pause in Tooltip
0.9.3 Beautified at http://jsbeautifier.org/ and a few more comments 14-08-2013
0.9.4 Major improvement - only run updateLoop() when counter running to save processor
      This is important if you have multiple instances as each would consume processor
      even when not running.
0.9.5 Added a Checkbox to Settings giving option to continue counting from paused.
      Normal sequence on clicking is 'start -> pause -> reset'
      In optional mode this changes to 'start -> pause -> continue -> pause etc'.
      In this mode one has to use th Right Click (Context) Menu to reset. 15-08-2013
0.9.6 Refinement of Tooltip text. 15-08-2013
0.9.6 Removed Simple from Title. Custom Icon in folder and icon line removed from metadata.json
      (alternative is line "icon": "appointment-new") and follow theme 17-08-2013
0.9.7 Major change to single counterStatus from a series of flags
0.9.8 counterStatus, currentCount and startTime are now stored as Settings variables
      so the counter is not reset by a cinnamon reset.
0.9.9 New variable pauseAt added and replaces currentCount in Settings to reduce the load on Settings
      as it is updated only at time of counter being paused.
      Changed to call a null function when a generic setting changed rather than a UI update. 25-08-2013
1.0.0 Initial version on Cinnamon Spices web site 01-09-2013
1.1.0 Quick fix to background colours to use transparency so they work with light and dark themes 02-09-2013
1.1.1 Added radiused border to background colours and made them configurable via a stylesheet
      (stylesheet.css in the applet folder). Extra menu item added to open stylesheet.css 04-09-2013
1.1.2 Took opportunity to change from red background when days greater than 1 to a red border
      so one still knows if it is paused or counting
1.2.0 Inhibit counter updates after counter removed from panel
1.2.1 Modifications for Cinnamon 2 by adding cinnamonVersion to settings
      to allow Cinnamon Version to be specified and thus inhibit extra settings menu entry
1.2.2 Change 'Settings' to 'Configure..' and place after housekeping for consistency
1.2.3 Pick up Cinnamon Version from environment variable CINNAMON_VERSION rather than settings window
2.0.0 Use Cinnamon version to choose text editor to start to look at changelog etc
2.0.2 01-02-2017 Change helpfile to use README.md instead of help.txt in applet folder
      Remove icon.png and help.txt from applet folder
2.0.3 Version numbering harmonised with other Cinnamon applets and added to metadata.json so it shows in 'About...'
      icon.png copied back into applet folder so it shows in 'About...'
2.0.4 Bug corrected at line 138 this.currentCount had comma, not stop.
      Use of this.UUID = metadata.uuid removed (only used in Config... for Cinnamon <2.0) which makes use of UUID in l10n more obvious.
2.0.5 Improved l10n Support:
        UUID set from metadata.uuid so no need for explicit definition.
        _() function now checks for system translations if a local one not found.
        Based on ideas from @Odyseus, @lestcape and @NikoKrause
## 2.1.0
 * CHANGELOG.md added to applet with a symbolic link from UUID - CHANGELOG.md is now displayed on Cinnamon Spices web site.
 * CHANGELOG.md is a simplified version of the existing changelog.txt
 * Applet updated so CHANGELOG.md is displayed from context
 * README.md in UUID is now symbolic link from UUID
## 2.1.1
 * Use xdg-open in place of gedit or xed to allow use on more distros
## 2.1.2
 * Update stylesheet to better match Cinnamon 4.0 System Styles - less rounded.
 * Add an initial mechanism to provide persistence for user edits of the stylesheet.
### 2.2.0
  * Adds an option in Configure... to display Counter Heading in Panel.
  * New single line layout for Start, Pause, Reset, Continue and Continue from Start Time in Context Menu
  * Adds ability to edit Counter Heading in Context menu as well as Configure..
  * Adds option in Configure... to add experimental functions such as an ability to modify time by buttons in Context (right click) Menu - a possible precursor to a flexible timer function
  * Implements changes proposed by @100k (Łukasz Dobrowolski)in #2648 and uses code provided by him to implement his suggestions.
  * Minor changes in stylesheet.css to match the other applets in the suite..
  * Closes #2648
*/

