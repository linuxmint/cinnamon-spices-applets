/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;

// l10n/translation support
const UUID = "scripts@paucapo.com";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function findTerminalEmulator() {
    var returnStruct = {
        found: false,
        commandToExecuteInTerminal: "",
        foundTerminalDescription: _("No terminals are found. Switch the setting <Find automatically a terminal> off to fix this.")
    };

    // Search method 1 : desktop env Gsettings
    try {
        let candidateSchemasRegex = [".*cinnamon.*default.*terminal.*",
                                    ".*gnome.*default.*terminal.*"];

        let source = Gio.SettingsSchemaSource.get_default();
        let schemasStruct = source ? source.list_schemas(false) : new Array(0); 
        // list_schemas returns two arrays: out string[] non_relocatable, out string[] relocatable)

        // Simplification of schemasStruct
        let schemaArray = new Array(0);
        for (let array of schemasStruct) {
            for (let schema of array) {
                if (schema.includes("terminal"))
                    schemaArray.push(schema); 
            }
        }

        for (let regex of candidateSchemasRegex) {
            for (let schema of schemaArray) {
                if (schema.match(regex)) {
                    let settingsSchema = source.lookup(schema, false);
                    if (settingsSchema) {
                        let exec = "";
                        let execArg = "";
                        if (settingsSchema.has_key("exec")) {
                            let execKey = settingsSchema.get_key("exec");
                            exec = execKey.get_default_value().get_string()[0];
                        }
                        if (settingsSchema.has_key("exec-arg")) {
                            let execArgKey = settingsSchema.get_key("exec-arg");
                            execArg = execArgKey.get_default_value().get_string()[0];
                        }
                        if (exec && execArg) {
                            if (GLib.find_program_in_path(exec)) {
                                returnStruct.commandToExecuteInTerminal = exec + " " + execArg;
                                returnStruct.foundTerminalDescription = 
                                    _("Desktop env default terminal: ") + exec + " (" + schema + ")" + "\n" 
                                    + _("Command to execute a script: ") + returnStruct.commandToExecuteInTerminal;
                                returnStruct.found = true;
                                return returnStruct;
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        global.logError(e);
    }

    // Search method 2 : x-terminal-emulator
    try {
        let xTermPath = GLib.find_program_in_path("x-terminal-emulator");
        if (xTermPath) {
            if (GLib.file_test(xTermPath, GLib.FileTest.IS_SYMLINK)) {
                let xTermPathSymLink2 = GLib.file_read_link(xTermPath);
                if (GLib.file_test(xTermPathSymLink2, GLib.FileTest.IS_SYMLINK)) {
                    let termWrapper = GLib.file_read_link(xTermPathSymLink2);
                    if (GLib.file_test(termWrapper, GLib.FileTest.IS_EXECUTABLE)) {
                        returnStruct.commandToExecuteInTerminal = xTermPath + " -e";
                        returnStruct.foundTerminalDescription = 
                            _("Sym-link of x-terminal-emulator: ") + termWrapper + "\n" 
                            + _("Command to execute a script: ") + returnStruct.commandToExecuteInTerminal;
                        returnStruct.found = true;
                        return returnStruct;
                    }
                }
            }
        }
    } catch (e) {
        global.logError(e);
    }

    // Search method 3 : we try to find a famous terminal emulator
    try {
        let candidateTerminals = ["gnome-terminal", "tilix", "konsole", "guake", "qterminal", "terminator", "uxterm", "nxterm", "color-xterm", "rxvt", "xterm", "dtterm"];
        for (let termName of candidateTerminals) {
            let termPath = GLib.find_program_in_path(termName);
            if (termPath) {
                if (GLib.file_test(termPath, GLib.FileTest.IS_EXECUTABLE)) {
                    if (termName == "gnome-terminal") 
                        returnStruct.commandToExecuteInTerminal = termPath + " --";
                    else 
                        returnStruct.commandToExecuteInTerminal = termPath + " -e";
                    
                    returnStruct.foundTerminalDescription = 
                        termPath  + "\n" 
                        + _("Command to execute a script: ") + returnStruct.commandToExecuteInTerminal;
                    returnStruct.found = true;
                    return returnStruct;
                }

            }
        }
    } catch (e) {
        global.logError(e);
    }
    return returnStruct;
}

/**
 * A PopupSubMenuMenuItem without arrow icon, so that the sub-menu looks like a context menu.
 * The sub-menu is the "Ask what to do" menu.
 * It has also a custom _onButtonReleaseEvent() 
 * and handles how to execute the associated script.
 */
class PopupMenuItemWithContext extends PopupMenu.PopupSubMenuMenuItem {
    _init (labelText, scriptsApplet, fileToExecute, params) {

        // The constructor of PopupSubMenuMenuItem is not called on purpose
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        this.scriptsApplet = scriptsApplet;
        this.fileToExecute = fileToExecute;
        this.isAskWhatToDoMenuCreated = false;

        // Like PopupSubMenuMenuItem:
        this.label = new St.Label({ text: labelText, y_expand: true});
        this.addActor(this.label);
        this.actor.label_actor = this.label;
        this.menu = new PopupMenu.PopupSubMenu(this.actor);
    }

    destroy() { 
        // Like PopupSubMenuMenuItem:
        this.menu.destroy();
        PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
    }

    // override
    _onButtonReleaseEvent(actor, event) {
        let behavior;
        switch (event.get_button()) {
            case 1: // left click
                behavior = this.scriptsApplet.leftClickBehavior;
                break;
            case 3: // right click
                behavior = this.scriptsApplet.rightClickBehavior;
                break;
            default:
                return;
        }

        let exists = GLib.file_test(this.fileToExecute, GLib.FileTest.IS_REGULAR);
        if (!exists) {
            this.scriptsApplet._showNotify( _("The script: <%s> doesn't exist").format(this.label.text));
            return;
        }

        this.isFileExecutable = GLib.file_test(this.fileToExecute, GLib.FileTest.IS_EXECUTABLE);
        if (this.isFileExecutable) {
            switch (behavior) {
                case "executeSilently":
                    this._executeScriptSilently();
                    break;
                case "executeInTerminal":
                    this._executeScriptInTerminal();
                    break;
                case "edit":
                    this._editScript();
                    break;
                case "ask":
                    this._toggleAskWhatToDoMenu();
                    break;
                default:
                    this._executeScriptSilently();
            }
        }
        else {
            switch (behavior) {
                case "ask":
                    this._toggleAskWhatToDoMenu();
                    break;
                default:
                    this._openFile();
            }
        }
    }

    _toggleAskWhatToDoMenu() {      
        if (!this.isAskWhatToDoMenuCreated) {
            this.isAskWhatToDoMenuCreated = true;
            
            if (this.isFileExecutable) {
                let executeSilentlyItem = new PopupMenu.PopupIconMenuItem(_("Execute silently"), "user-not-tracked-symbolic", St.IconType.SYMBOLIC);
                executeSilentlyItem.label.add_style_class_name('scripts-ask-menu');
                executeSilentlyItem.connect('activate', Lang.bind(this, this._executeScriptSilently));
                this.menu.addMenuItem(executeSilentlyItem);
                
                let executeInTerminalItem = new PopupMenu.PopupIconMenuItem(_("Execute in terminal"), "utilities-terminal-symbolic", St.IconType.SYMBOLIC);
                executeInTerminalItem.label.add_style_class_name('scripts-ask-menu');
                executeInTerminalItem.connect('activate', Lang.bind(this, this._executeScriptInTerminal));
                this.menu.addMenuItem(executeInTerminalItem);

                let editItem = new PopupMenu.PopupIconMenuItem(_("Edit the script"), "document-edit-symbolic", St.IconType.SYMBOLIC);
                editItem.label.add_style_class_name('scripts-ask-menu');
                editItem.connect('activate', Lang.bind(this, this._editScript));
                this.menu.addMenuItem(editItem);
            }
            else {
                let openItem = new PopupMenu.PopupIconMenuItem(_("Open the document"), "x-office-document-symbolic", St.IconType.SYMBOLIC);
                openItem.label.add_style_class_name('scripts-ask-menu');
                openItem.connect('activate', Lang.bind(this, this._openFile));
                this.menu.addMenuItem(openItem);
            }
        }
        this.menu.toggle();
    }

    _executeScriptSilently() {
        try {
            GLib.spawn_command_line_async("\"" + this.fileToExecute + "\"");
        } catch (e) {
            // notify showed prevent script errors
            this.scriptsApplet._showNotify(e);
        }
        this.scriptsApplet.menu.close(true);
    }

    _executeScriptInTerminal() {
        try {
            GLib.spawn_command_line_async(this.scriptsApplet.commandToExecuteInTerminal + " \"" + this.fileToExecute + "\"");
        } catch (e) {
            // notify showed prevent script errors
            this.scriptsApplet._showNotify(e);
        }
        this.scriptsApplet.menu.close(true);
    }

    _editScript() {
        try {
            global.log("this.scriptsApplet.commandToEditScripts = " + this.scriptsApplet.commandToEditScripts)
            GLib.spawn_command_line_async(this.scriptsApplet.commandToEditScripts + " \"" + this.fileToExecute + "\"");
        } catch (e) {
            // notify showed prevent script errors
            this.scriptsApplet._showNotify(e);
        }
        this.scriptsApplet.menu.close(true);
    }

    _openFile() {
        try {
            GLib.spawn_command_line_async("xdg-open \"" + this.fileToExecute + "\"");
        } catch (e) {
            // notify showed prevent script errors
            this.scriptsApplet._showNotify(e);
        }
        this.scriptsApplet.menu.close(true);
    }
};

function MyApplet(metadata, orientation, panelHeight, instance_id) {
   this._init(metadata, orientation, panelHeight, instance_id);
}

MyApplet.prototype = {
   __proto__: Applet.TextIconApplet.prototype,

   _init: function(metadata, orientation, panelHeight, instance_id) {
      Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);

      this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);

      this.settings.bindProperty(Settings.BindingDirection.IN, "autoupdate", "autoupdate", this._onSettingsAutoupdate, null)
      this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "directory", "directory", this._onSettingsDirectory, null)

      this.settings.bindProperty(Settings.BindingDirection.IN, "showtitle", "showtitle", this._onSettingsTitle, null)
      this.settings.bindProperty(Settings.BindingDirection.IN, "paneltitle", "paneltitle", this._onSettingsTitle, null)

      this.settings.bindProperty(Settings.BindingDirection.IN, "customicon", "customicon", this._onSettingsIcon, null)
      this.settings.bindProperty(Settings.BindingDirection.IN, "icon", "icon", this._onSettingsIcon, null)

      this.settings.bind("rightClickBehavior", "rightClickBehavior");
      this.settings.bind("leftClickBehavior", "leftClickBehavior");
      this.settings.bind("findTerminalAutomatically", "findTerminalAutomatically", this._onSettingsTerminal);
      this.settings.bind("foundTerminalDescription", "foundTerminalDescription");
      this.settings.bind("overrideCommandToExecuteInTerminal", "overrideCommandToExecuteInTerminal", this._onSettingsTerminal);
      this.commandToExecuteInTerminal = "";
      this.settings.bind("useDefaultTextEditorWithScripts", "useDefaultTextEditorWithScripts", this._onSettingsTextEditorWithScripts);
      this.settings.bind("overrideCommandToEditScripts", "overrideCommandToEditScripts", this._onSettingsTextEditorWithScripts); 
      // Dependencies are not checked here to make cinnamon start-up faster
      this.depAreMet = false;
      this._applet_context_menu._signals.connect(this._applet_context_menu, 'activate', this._checkDependenciesMet);
      
      if (this.directory == "" || typeof this.directory == "undefined") {
         this.directory = GLib.get_home_dir()+"/.local/share/nemo/scripts";
      }
      this.autoupdate_last = this.autoupdate;
      this.directory_last = this.directory;

      this._onSettingsIcon();
      this._onSettingsTitle();

      try {

         //this.set_applet_icon_symbolic_name("system-run");

         this.menuManager = new PopupMenu.PopupMenuManager(this);
         this.menu = new Applet.AppletPopupMenu(this, orientation);
         this.menuManager.addMenu(this.menu);

         if (!this.autoupdate)
            this._createMenu();

      } catch (e) {
         global.logError(e);
      }
   },

   on_applet_removed_from_panel: function() {
      this.settings.finalize();
   },

   _onSettingsAutoupdate: function() {
      if (this.autoupdate != this.autoupdate_last) {
         this.autoupdate_last = this.autoupdate;
         this._updateMenu();
      }
   },

   _onSettingsDirectory: function() {
      if (this.directory != this.directory_last) {
         this.directory_last = this.directory;
         this._updateMenu();
      }
   },

   _onSettingsTitle: function() {
      if (this.showtitle) {
         this.set_applet_label(_(this.paneltitle));
         this.set_applet_tooltip(_(this.paneltitle));
      } else {
         this.set_applet_label("");
         this.set_applet_tooltip(_("Scripts"));
      }
   },

   _onSettingsIcon: function() {
      if (this.customicon) {
         let icon_file = Gio.File.new_for_path(this.icon);
         if (icon_file.query_exists(null)) {
            this.set_applet_icon_path(this.icon)
         } else {
            this.set_applet_icon_name(this.icon)
            //this.set_applet_icon_symbolic_name(this.icon);
         }
      } else {
         this.set_applet_icon_symbolic_name("system-run");
      }
   },

    /**
     * In addition of being settings callback, 
     * this function returns the terminal availability status.
     */
    _onSettingsTerminal: function() {
        if (this.findTerminalAutomatically) {
            let term = findTerminalEmulator();
            if (term.found) {
                this.commandToExecuteInTerminal = term.commandToExecuteInTerminal;
                this.foundTerminalDescription = term.foundTerminalDescription;
                return true;
            } 
            else {
                this.depAreMet = false;
                this.commandToExecuteInTerminal = "";
                this.foundTerminalDescription = ""; 
                return false;
            }
        }
        else {
            this.commandToExecuteInTerminal = this.overrideCommandToExecuteInTerminal;
            this.foundTerminalDescription = "";
            return true;
        }
    },

    _onSettingsTextEditorWithScripts: function() {      
        if (this.useDefaultTextEditorWithScripts)
            this.commandToEditScripts = "xdg-open";
        else
            this.commandToEditScripts = this.overrideCommandToEditScripts;
    },

    _checkDependenciesMet: function() {

        if (this.depAreMet == false) 
            this.depAreMet = this._are_dependencies_installed();
        return this.depAreMet;
    },

    _are_dependencies_installed: function() {
        this._onSettingsTextEditorWithScripts(); // to make sure that commandToEditScripts is set 
        let isTerminalEmulatorFound = this._onSettingsTerminal();
        let isNotifyInstalled = GLib.find_program_in_path("notify-send");
        let isxdg_openInstalled = GLib.find_program_in_path("xdg-open");
        let allDependencies = isxdg_openInstalled && isNotifyInstalled && isTerminalEmulatorFound;
        if (!allDependencies) {
            let message = _("The applet Script Menu cant run due to missing dependencies. The missing dependencies are:") + " -- ";
            if (!isNotifyInstalled) 
                message += "notify-send -- "
    
            if (!isxdg_openInstalled)
                message += "xdg-open -- "
    
            if (!isTerminalEmulatorFound) 
                message += _("Terminal emulator. Switch the setting <Find automatically a terminal> off to fix this.") + " -- ";
    
            if (isNotifyInstalled) {
                this._showNotify(message);
            }
            else if (isTerminalEmulatorFound) {
                try {
                    GLib.spawn_command_line_async(this.commandToExecuteInTerminal
                        + " 'sh -c \"echo " + message + "; sleep 1; exec bash\"'");
                } catch (e) {
                    global.logError(e);
                }
            }
            global.logError(message);
        }
        return allDependencies;
    },

   on_applet_clicked: function(event) {
      if (!this._checkDependenciesMet()) 
         return;
      if (this.autoupdate && !this.menu.isOpen) {
         this._updateMenu();
      }
      this.menu.toggle();
   },

   _updateMenu: function() {
      this.menu.removeAll();
      this._createMenu();
   },

   _createMenu: function() {
      this.menu = this._loadDir(this.directory, this.menu);

      this._addSeparator();

      let open = new PopupMenu.PopupIconMenuItem(_("Open scripts folder"), "folder-open-symbolic", St.IconType.SYMBOLIC);
      open.connect('activate', Lang.bind(this, this._openFolder));
      this.menu.addMenuItem(open);

      if (!this.autoupdate) {
         let update = new PopupMenu.PopupIconMenuItem(_("Update menu"), "emblem-synchronizing-symbolic", St.IconType.SYMBOLIC);
         update.connect('activate', Lang.bind(this, this._updateMenu));
         this.menu.addMenuItem(update);
      }
   },

   _showNotify: function(message){
        let title = _("Applet 'Script Menu'");
        GLib.spawn_command_line_async("notify-send --icon=system-run \"" + title + "\" \"" + message + "\"");
   },

   _addSeparator: function() {
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
   },

   _openFolder: function() {
      try {
         GLib.spawn_command_line_async("xdg-open '"+this.directory+"'");
      } catch (e) {
         this._showNotify(e);
      }
   },


   _loadDir: function(dir, m) {

      // Workaround for Cinnamon 3.2.x settings window path selectors.
      // They return an URI instead of a path like they used to. ¬¬
      if (/^file:\/\//.test(dir))
          dir = dir.substr(7);
      
      let currentDir =  Gio.file_new_for_path(dir);
      if (currentDir.query_exists(null)){

         let dirs = [];
         let files = [];

         let enumerator= currentDir.enumerate_children('standard::type', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
         let file;

         // get all dirs and files
         while ((file = enumerator.next_file(null)) != null) {
            let fileName = file.get_name();
            let fileType = file.get_file_type();
            if (fileType == Gio.FileType.DIRECTORY) {
               dirs.push(fileName);
            } else {
               files.push(fileName);
            }
         }

         // populate dirs first
         if (dirs.length > 0) {
            dirs.sort();
            for (let i = 0; i < dirs.length; i++) {
               let directory =  currentDir.get_path() + "/" + dirs[i];
               let submenu = new PopupMenu.PopupSubMenuMenuItem(dirs[i]);
               submenu.label.add_style_class_name('scripts-directory');
               submenu.menu = this._loadDir(directory, submenu.menu);
               m.addMenuItem(submenu);
            }
         }

         // populate files
         if (files.length > 0) {
                files.sort();
                for (let i = 0; i < files.length; i++) {
                    let script = currentDir.get_path() + "/" + files[i];
                    let item = new PopupMenuItemWithContext(files[i], this, script);
                    m.addMenuItem(item);
                }
         }
      }

      return m;
   }

};

function main(metadata, orientation, panelHeight, instance_id) {
   let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
   return myApplet;
}



