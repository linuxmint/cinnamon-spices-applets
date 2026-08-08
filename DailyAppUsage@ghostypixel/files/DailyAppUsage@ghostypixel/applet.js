const Applet = imports.ui.applet
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const Gettext = imports.gettext;
const UUID = "DailyAppUsage@ghostypixel"

const AppletDir = imports.ui.appletManager.applets[UUID];
const Helper = AppletDir.helper

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

Gio._promisify(
    Gio.File.prototype,
    'load_contents_async',
    'load_contents_finish'
);

Gio._promisify(
    Gio.File.prototype,
    'query_info_async',
    'query_info_finish'
);

Gio._promisify(
    Gio.File.prototype,
    'replace_contents_async',
    'replace_contents_finish'
);

function _(text) { return Gettext.dgettext(UUID, text); }

class AppUsageMeter extends Applet.TextIconApplet {
    constructor(orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
    
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.settingsMenu = new Settings.AppletSettings(this, UUID, instanceId)
        this.HandleSettings()
        
        let runningApps = this.GetRunningApps()

        if(!this.settingsMenu.getValue("enable-saving")) this.SetupAppsFromRunningWindows(runningApps)
        else this.SetupAppsWithSaveFile(runningApps)
        
        this.set_applet_label(_("App Usage"));
        this.set_applet_tooltip(_("Displays apps and how long they were running."));
    }
    
    InitializationFinished() {
        this.appOpeningSignalId = !this._buildUI()
            ? global.window_manager.connect("map", (wm, actor) => this.OnAppOpeningNoUI(wm, actor))
            : global.window_manager.connect("map", (wm, actor) => this.OnAppOpening(wm, actor))
            
        global.window_manager.connect("destroy", (wm, actor) => this.OnAppClosing(wm, actor))
        
        this.SetMainLoop()
    }

    SetupAppsFromRunningWindows(runningApps) {
        this.apps = AppSection.FromApps(runningApps, this.settingsMenu.getValue("max-char-for-app-label"))
        this.activeApps = new Set(Object.keys(this.apps))
        this.inactiveApps = new Set()
        
        this.InitializationFinished()
    }

    async SetupAppsWithSaveFile(runningApps) {
        let saveOutdated = await this.IsSaveOutdated()
        if(saveOutdated != null) {
            try {
                let saveFile = await this.LoadState(saveOutdated)
                let maxLabelChar = this.settingsMenu.getValue("max-char-for-app-label")
                
                let appsSectionsNewlyRunning = AppSection.FromApps(runningApps, maxLabelChar)
                let appSectionsWithHistory = {}
                
                Object.entries(appsSectionsNewlyRunning).forEach(([key, value]) => {
                    if(saveFile[key] != undefined) {
                        let t = saveFile[key][0]
                
                        value.timeLabel.set_text(AppSection.IntToTime(t))
                        appSectionsWithHistory[key] = value
                        delete appsSectionsNewlyRunning[key]
                    }
                })
                
                let inactiveAppSections = AppSection.FromSaveFile(
                    Object.fromEntries(
                        Object.entries(saveFile).filter(([key]) => !(key in appSectionsWithHistory) && !(key in appsSectionsNewlyRunning))
                    ),
                    maxLabelChar
                )
                
                this.apps = {}
                this.activeApps = new Set([...Object.keys(appSectionsWithHistory), ...Object.keys(appsSectionsNewlyRunning)])
                this.inactiveApps = new Set(Object.keys(inactiveAppSections))
                
                Object.entries(saveFile).forEach(([key, value]) => {
                    if(appSectionsWithHistory[key] != undefined) {
                        this.apps[key] = appSectionsWithHistory[key]
                        delete appSectionsWithHistory[key]
                    }
                    else if(inactiveAppSections[key] != undefined) {
                        this.apps[key] = inactiveAppSections[key]
                        delete inactiveAppSections[key]
                    }
                })
                
                if(appsSectionsNewlyRunning != undefined) Object.entries(appsSectionsNewlyRunning).forEach(([key, value]) => { this.apps[key] = value; })
            } catch (error) {
                global.logError(error)
            }
            
            this.InitializationFinished()
        }
        else this.SetupAppsFromRunningWindows(runningApps)
    }

    on_applet_clicked() {
        this.menu.toggle()
    }
    
    on_applet_reloaded(deleteConfig) {
        this.OnBeingClosed()
    }

    on_applet_removed_from_panel() {
        this.OnBeingClosed()
    }
    
    onBusAcquired(connection, name) {      
        let serviceInstance = new DBusService(this);
        this.exportedObject = Gio.DBusExportedObject.wrapJSObject(DBusService.interface, serviceInstance);

        serviceInstance._impl = this.exportedObject;
        this.exportedObject.export(connection, '/info/dau');
        
        // global.log(_(`%s connection acquired`).format(name));
    }

    onNameAcquired(connection, name) {
        // global.log(_(`%s: name acquired`).format(name));
    }

    onNameLost(connection, name) {
        // global.log(_(`%s: name lost`).format(name));
    }

    OnBeingClosed() {
        if(this.settingsMenu.getValue("enable-saving")) this.SaveState()
        if(this.dBusId != null) this.DisableDBus()
        this.CloseMainLoop()
    }
    
    TrySetupDBus() {
        return Gio.bus_own_name(
            Gio.BusType.SESSION,
            'info.DAU',
            Gio.BusNameOwnerFlags.NONE,
            this.onBusAcquired.bind(this),
            this.onNameAcquired.bind(this),
            this.onNameLost.bind(this)
        );
    }
    
    AddSaveInterval() {
        // + 1 so it has time to update timers, ill probably increase it
        if(this.settingsMenu.getValue("enable-saving")) {
            let time = Helper.MinutesToMs(parseInt(this.settingsMenu.getValue("save-interval")) * 60) + 1
            this.saveInterval = Mainloop.timeout_add(time, () => this.SaveState())
        }
    }

    SetMainLoop() {
        this.mainTimer = Mainloop.timeout_add(1000, () => this.UpdateActiveTimers())
        this.AddSaveInterval()
    }
    
    CloseMainLoop() {
        if(this.mainTimer != null) { Mainloop.source_remove(this.mainTimer); this.mainTimer = null}
        if(this.saveInterval != null) { Mainloop.source_remove(this.saveInterval); this.saveInterval = null}
    }

    RestartSaveInterval() {
        if(this.saveInterval != null) { Mainloop.source_remove(this.saveInterval); this.saveInterval = null}
        this.AddSaveInterval()
    }

    DeleteNoAppsLabel() {
        if(!this.IsUIEmpty()) return
        this.menu.actor.get_children()[0].get_children()[0].get_children()[0].destroy()
    }
    
    OnAppOpeningNoUI(wm, actor) {
        [this.scrollView, this.scrollViewItemBox, this.exportContainer] = this.buildBaseUI()
        this.DeleteNoAppsLabel()        
        this.OnAppOpening(wm, actor)
        
        global.window_manager.disconnect(this.appOpeningSignalId)
        this.appOpeningSignalId = global.window_manager.connect("map", (wm, actor) => this.OnAppOpening(wm, actor))
    }

    AppOpeningWhileLoopDeactivated() {
        this.SetMainLoop()
        // global.log(_("Loop readded"))
    }
    
    OnAppOpening(wm, actor) {
        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(actor.meta_window)
        
        if(app == null || app.get_name() == _("Unknown")) return
        this.AddApp(app)
    }
    
    AddApp(app) {
        let appId = AppSection.EvalAppForName(app)
        
        // makes app actve again
        if(this.inactiveApps.has(appId)) {
            this.activeApps.add(appId)
            this.inactiveApps.delete(appId)
            ++this.apps[appId].appInstances
        }
        else if(this.activeApps.has(appId)) {
            ++this.apps[appId].appInstances
        }
        // adds the app section the the ui
        else {
            try {
                let newAppSection = AppSection.ConstructFromApp(app, undefined, this.settingsMenu.getValue("max-char-for-app-label"))
                this.apps[newAppSection.nameLabel.text] = newAppSection
                this.activeApps.add(newAppSection.nameLabel.text)
                this.scrollViewItemBox.add_child(newAppSection.ui.actor)
                this.RecalcScrollViewHeight()
            } catch (error) {
                // global.log(_("App opened: %s").format(app.get_name()))
                global.logError(error)
            }
        }

        if(this.mainTimer == null) this.AppOpeningWhileLoopDeactivated()
    }
    
    OnAppClosing(wm, actor) {
        try {
            let tracker = Cinnamon.WindowTracker.get_default();
            let app = tracker.get_window_app(actor.meta_window)
            
            if(app == null) return
            
            let appSection = this.apps[AppSection.EvalAppForName(app)]
            
            if(--appSection.appInstances > 0) return
            
            this.inactiveApps.add(AppSection.EvalAppForName(app))
            this.activeApps.delete(AppSection.EvalAppForName(app))

            if(this.activeApps.size == 0) this.OnLastActiveAppClosing()
        } 
        catch (error) {
            global.logError(_("App closed: %s").format(app.get_name()))
            global.logError(error)
        }
    }

    OnLastActiveAppClosing() {
        this.CloseMainLoop()
        // global.log(_("Loop removed"))
    }
    
    UpdateActiveTimers() {
        this.activeApps.forEach(item => {
            try {
                this.apps[item].IncrementTimer();
            } catch (e) {
                global.logError(_("Failed timer for %s").format(item));
                global.logError(e);
                return false
            }
        });

        return true; // Is here so that Mainloop recognizes its an interval. Might edit this to add an override to stop
    }
    
    /**
     * Builds the UI on startup
     * @returns {boolean} bool weather the list had any apps
    */
    _buildUI() {    
        if(Object.keys(this.apps).length < 1) { this.buildUIEmpty(); return false }
        
        [this.scrollView, this.scrollViewItemBox, this.exportContainer] = this.buildBaseUI()
        
        for(const [key, val] of Object.entries(this.apps)) {
            this.scrollViewItemBox.add_child(val.ui.actor)
        }
        
        return true
    }
    
    buildUIEmpty() {
        this.menu.addActor(new St.Label({
            text: _("No apps were opened."),
            style: "color: white;"
        }))
    }
    
    buildBaseUI() {
        let scrollView = new St.ScrollView({
            style_class: 'popup-scroll-view',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
        });
        
        let insideScrollView = new St.BoxLayout({
            vertical: true,
        });
        
        let container = new St.BoxLayout({ 
            vertical: false,
            x_expand: true,
            y_expand: true, 
        })
        let exportOpt = this.settingsMenu.getValue("show-export-buttons")
        
        container.x_align = Clutter.ActorAlign.CENTER;
        
        this.menu.addActor(scrollView)
        scrollView.add_actor(insideScrollView)
        this.menu.addActor(container)
   
        if(exportOpt != "opNone") this.buildExportButtons(exportOpt, container)
        
        Helper.connectOnce(this.menu, "open-state-changed", () => {
            this.RecalcScrollViewHeight()
        })
        
        return [scrollView, insideScrollView, container]
    }

    IsUIEmpty() {
        let label = this.menu.actor.get_children()[0].get_children()[0].get_children()[0]
        return label != null && label.constructor.name == "St_Label"
    }
    
    buildExportButtons(option, container) { 
        function buildBtn(title, color, callable) {
            let btn = new St.Button({
                label: title,
                style: `background-color: ${color}; color: white; padding: 5px 10px; border-radius: 5px; border: white 1px solid;`,
                track_hover: true,
                reactive: true,
            })

            btn.connect("clicked", callable)
            
            return btn
        }
        const GetCSVBtn = () => buildBtn("CSV", "#43aa55", this.CSVBtnClicked.bind(this))
        const GetJSONBtn = () => buildBtn("JSON", "#f1a45e", this.JSONBtnClicked.bind(this))
        
        container.set_style("spacing: 8px; margin: 10px 10px 0px;")
        
        switch(option) {
            case "opCSV":
                container.add_child(GetCSVBtn())
            break;
            
            case "opJSON":
                container.add_child(GetJSONBtn())
            break;
            
            case "opBoth":
                container.add_child(GetCSVBtn())
                container.add_child(GetJSONBtn())
            break;
        }
    }
    
    GetRunningApps() {
        let tracker = Cinnamon.WindowTracker.get_default();
        let appCreated = new Set()
        let apps = []

        global.get_window_actors().forEach(actor => {
            let win = actor.meta_window;
            let app = tracker.get_window_app(win);
            
            if(app == null || app.get_name() == "Unknown" || appCreated.has(AppSection.EvalAppForName(app))) return

            apps.push(app)
        });
        
        return apps
    }
    
    async SaveState() {
        if(Object.keys(this.apps).length < 1) return false;
        const data = {};

        for(const [label, app] of Object.entries(this.apps)) {
            let time = AppSection.TimeToInt(app.timeLabel.text)
            
            if(time <= 0) continue
            
            data[label] = [];
            let attr = {}
            
            if(app.iconPath != null) attr["icon-path"] = app.iconPath
            if(app.attr != null) attr["section-attr"] = app.attr

            data[label].push(time);
            data[label].push(attr);
        }

        const bytes = new TextEncoder().encode(JSON.stringify(data));
        
        return await this.CreateFile(this.savePath, bytes)
    }
    
    async LoadState() {
        try {
            const file = Gio.File.new_for_commandline_arg(this.savePath);
            const [contents, etag] = await file.load_contents_async(null);
            const json = new TextDecoder().decode(contents);
            return JSON.parse(json);
        }
        catch (err) {
            global.logError(_("Failed to read save file. %s").format(err));
            return {};
        }
    }
    
    /**
     * Checks if the save file is outdated meaning it's last edited date is not today's date
     * @returns {Gio.File}  if file is not outdated
     * @returns {null} null if file is outdated
    */
    async IsSaveOutdated() {   
        let file = Gio.File.new_for_commandline_arg(this.savePath);
        let parent = file.get_parent();
        
        if(parent != null) {
            try { parent.make_directory_with_parents(null); } 
            catch (e) {
                if(!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                    throw e;
            }
        }
        
        try {
            let info = await file.query_info_async(
                "time::modified",
                Gio.FileQueryInfoFlags.NONE,
                0,
                null,
            );
            let modified = info.get_attribute_uint64("time::modified");
            let date = new Date(modified * 1000);
            
            if(new Date().toISOString().split("T")[0] > new Date(date).toISOString().split("T")[0]) return null
            else return file
        }
        catch(err) {
            global.logError(err)
            return null
        }
    }
    
    HandleSettings() {       
        let menu = this.settingsMenu;
        
        if(menu.getValue("save-path") == menu.getDefaultValue("save-path")) {
            this.savePath = `${GLib.get_user_cache_dir()}/DailyAppUsage/save.json`
            menu.setValue("save-path", this.savePath)
        }
        else this.savePath = menu.getValue("save-path")
        
        global.log(this.savePath, menu.getValue("save-path"))
        
        if(menu.getValue("enable-export-dbus")) this.dBusId = this.TrySetupDBus()
        
        this.iconSize = menu.getValue("icon-size")
        
        menu.connect("changed::icon-size", () => this.ResetIconSize())
        menu.connect("changed::apps-visible", () => this.AppsVisibleCountChanged())
        menu.connect("changed::max-char-for-app-label", () => this.AppLabelCharCountChanged())
        menu.connect("changed::save-interval", () => this.RestartSaveInterval())
        menu.connect("changed::save-path", (menu, settingKey, oldValue, newValue) => { this.savePath = newValue });
        menu.connect("changed::enable-saving", () => this.ToogleEnablingSaving())
        menu.connect("changed::show-export-buttons", (menu, settingKey, oldValue, newValue)  => this.ResetExportBtns(newValue))
        menu.connect("changed::enable-export-dbus", () => this.ToogleDBus())
    }
    
    RecalcScrollViewHeight() {
        let keys = Object.keys(this.apps)
        if(keys.length < 1) return

        let sectionHeight = this.apps[keys[0]].GetSectionFullHeight()
        this.scrollView.height = sectionHeight * Math.min(keys.length, this.settingsMenu.getValue("apps-visible"))
    }

    AppsVisibleCountChanged() {
        this.RecalcScrollViewHeight()
    }

    AppLabelCharCountChanged() {
        this.ResetAppLabelCharWidth()
    }

    ToString() {
        let keys = Object.keys(this.apps)
        if(keys.length < 1) return _("No Apps Active")

        let str = this.SettingsAsString() + _("\n\nApps:")

        keys.forEach((key, idx) => {
            let app = this.apps[key]
            str += (idx + 1) + `. ` + app.ToString()
        })

        return str
    }

    SettingsAsString() {
        return _(`Settings: { \n\tGENERAL
        \n\n\tApp count before UI overflow: %i
        \n\tApp label max characters: %i
        \n\n\tSAVE FILE
        \n\n\tEnabled: %d
        \n\tInterval: %i Hours
        \n\tAbsolute path: \"%s\" 
        \n}`).format(
            this.settingsMenu.getValue("apps-visible"), 
            this.settingsMenu.getValue("max-char-for-app-label"), 
            this.settingsMenu.getValue("enable-saving"),
            this.settingsMenu.getValue("save-interval"),
            this.settingsMenu.getValue("save-path")
        )
    }

    ResetAppLabelCharWidth() {
        let maxWidth = this.settingsMenu.getValue("max-char-for-app-label")

        Object.keys(this.apps).forEach(key => {
            this.apps[key].nameLabel.set_text(Helper.truncate(key, maxWidth))
        })
    }

    ToogleEnablingSaving() {
        if(this.settingsMenu.getValue("enable-saving")) {
            this.saveInterval = Mainloop.timeout_add(Helper.MinutesToMs(parseInt(this.settingsMenu.getValue("save-interval")) * 60) + 1, () => this.SaveState())
        }
        else if(this.saveInterval != null) { Mainloop.source_remove(this.saveInterval); this.saveInterval = null}
    }
    
    AppsAsCSV() {
        const data = { columns: ["Name", "Time"], rows: [] }
        
        Object.keys(this.apps).forEach(key => {
            let appSection = this.apps[key]
            data.rows.push([key, appSection.timeLabel.text])
        })
        
        return Helper.toCSV(data)
    }
    
    AppsAsJSON() {
        const data = {}
        
        Object.keys(this.apps).forEach(key => {
            let appSection = this.apps[key]
            data[key] = {}
            data[key]["time"] = appSection.timeLabel.text
        })
        
        return JSON.stringify(data)
    }
    
    JSONBtnClicked() {
        try {
            this.CreateFile(this.settingsMenu.getValue("export-path") + `/${new Date().toISOString().replace("T", "-").replace("Z", "").split(".")[0]}.json`, this.AppsAsJSON())
        }
        catch(err) { global.logError(_("coudnt save json %s").format(err)) }
    }
    
    CSVBtnClicked() {
        try {
            this.CreateFile(this.settingsMenu.getValue("export-path") + `/${new Date().toISOString().replace("T", "-").replace("Z", "").split(".")[0]}.csv`, this.AppsAsCSV())
        }
        catch(err) { global.logError(_("coudnt save csv %s").format(err)) }
    }
    
    ResetIconSize() {
        this.iconSize = this.settingsMenu.getValue("icon-size")
    }
    
    // This function will very likely be changed in the future.
    ResetExportBtns(exportOpt) {
        function ClearContainer(children) { for(let child of children) child.destroy(); }
        
        function ContainerSweep(children, container) {
            ClearContainer(children)
            container.set_style("")
        }
        
        let children = this.exportContainer.get_children()
        let length = children.length
        
        switch(exportOpt) {  
            case "opNone":
                ContainerSweep(children, this.exportContainer)
            break;
            
            case "opCSV":
                if(length == 0) this.buildExportButtons(exportOpt, this.exportContainer)
                else if(length == 1) {
                    children[children.length - 1].destroy()
                    this.buildExportButtons(exportOpt, this.exportContainer)
                }
                else if(length == 2) children[children.length - 1].destroy()
            break;
            
            case "opJSON":
                if(children.length == 2) {
                    children[0].destroy()
                    return;
                }
                else if(children.length == 1) children[0].destroy()
                
                this.buildExportButtons(exportOpt, this.exportContainer)
            break;
            
            case "opBoth":
                if(children.length == 1) {
                    if(children[0].label == "CSV") exportOpt = "opJSON"
                    else if(children[0].label == "JSON") ClearContainer(children)
                }
                    
                this.buildExportButtons(exportOpt, this.exportContainer)
            break;
        }
    }
    
    async CreateFile(path, data) {
        try {
            const file = Gio.File.new_for_commandline_arg(path);
            await file.replace_contents_async(
                data,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
            
            return true;
        } 
        catch (err) {
            global.logError(_("Failed to Create/Overwrite file: %s").format(err))
            throw err
        }
    }
    
    ToogleDBus() {
        if(this.dBusId != null) this.DisableDBus()
        else this.dBusId = this.TrySetupDBus()
    }
    
    DisableDBus() {
        if(this.exportedObject != null) this.exportedObject.unexport()
        Gio.bus_unown_name(this.dBusId);
        this.dBusId = this.exportedObject = null
    }
    
    async SaveBtnPressed() {
        let wasSaved = await this.SaveState();
        let message = wasSaved ? "Saved successfully." : "Saving failed :( \nCheck looking glass for further info."
        Main.notify("App Usage", _(message))
    }
}

class AppSection {
    static ConstructFromApp(app, time = "00:00:00", labelMaxChar = 30) {
        let appSection = new AppSection()
        appSection.attr = AppSection.GenerateAttributes(app)
        
        let uiElements = AppSection.GenerateTabFromApp(app, time, labelMaxChar, appSection.attr)
        
        appSection.ui = uiElements[0]
        appSection.UiIcon = uiElements[1]
        appSection.nameLabel = uiElements[2]
        appSection.timeLabel = uiElements[3]
        appSection.iconPath = AppSection.GetIconPath(appSection)
        appSection.appInstances = app.get_windows().length
        
        return appSection
    }
    
    static ConstructFromSaveEntry([appName, info], labelMaxChar = 30) {
        let appSection = new AppSection()
        let timeStr = AppSection.IntToTime(info[0]);
        let icon = null
        let iconPth = null
        
        if(info.length > 1) {
            let attributes = info[1]["section-attr"]
            let theme = Gtk.IconTheme.get_default();
            
            if(attributes != null) {
                appSection.attr = attributes
                
                Object.keys(attributes).forEach(key => {
                    switch(key) {
                        case "SteamId":
                            iconPth = "steam_icon_" + attributes["SteamId"]
                            icon = AppSection.TryGetSystemIcon(iconPth, 24)
                            if(icon == null) icon = AppSection.TryGetSystemIcon("steam", 24)
                        break
                    }
                })
            }
            else appSection.attr = null
            
            if(icon == null && iconPth == null) {
                iconPth = info[1]["icon-path"]
                
                if(Helper.IsPath(iconPth)) {
                    let file = Gio.File.new_for_path(iconPth);
                    icon = new St.Icon({ gicon: new Gio.FileIcon({ file }), icon_size: 24 })
                }
                else if(iconPth != "fallback-app-icon") icon = new St.Icon({gicon: Gio.icon_new_for_string(iconPth), icon_size: 24});
            }
        }
        
        let uiElements = AppSection._GenerateAppTab(appName, timeStr, icon, labelMaxChar)
        
        appSection.ui = uiElements[0]
        appSection.UiIcon = uiElements[1]
        appSection.nameLabel = uiElements[2]
        appSection.timeLabel = uiElements[3]
        appSection.iconPath = iconPth
        appSection.appInstances = 0
        
        return appSection
    }
    
    static EvalAppForName(app) {
        let name = app.get_name()
        
        // Steam apps use proton for compatibility, using desktop id to categorize them is unreliable and their name always sounds technical (steam_app_{steam app id})
        if(this.IsSteamApp(name)) return app.get_windows()[0].get_title()
        
        return name
    }
    
    static GenerateAttributes(app) {
        let attr = {}
        let keyCount = 0
        let name = app.get_name()
        
        if(this.IsSteamApp(name)) {attr["SteamId"] = parseInt(name.slice(10)); ++keyCount} // that gets the id
            
        if(keyCount <= 0) return null
        return attr
    } 
    
    static IsSteamApp(name) { return name.startsWith("steam_app_") }
    
    static FromApps(apps, labelMaxChar = 30) {
        let appSections = {}
        
        apps.forEach(app => { 
            let section = AppSection.ConstructFromApp(app, undefined, labelMaxChar)
            appSections[section.nameLabel.text] = section
        })
        
        return appSections
    }
    
    static FromSaveFile(save, labelMaxChar = 30) {
        let appSections = {}
        
        for(const [key, data] of Object.entries(save)) { 
            appSections[key] = AppSection.ConstructFromSaveEntry([key, data], labelMaxChar) 
        }
        
        return appSections
    }
    
    static GetIconPath(appSection) {
        if(appSection.attr != null && appSection.attr["SteamId"] != null) return "steam_icon_" + appSection.attr["SteamId"]
        
        if(appSection.UiIcon.gicon == undefined || appSection.UiIcon.gicon == null) {
                
            if(appSection.UiIcon.child != undefined) {
                let n = appSection.UiIcon.child.get_style_class_name()
                if(n != null) return n
                else return appSection.UiIcon.get_style_class_name()
            }
            else if(appSection.UiIcon.icon_name != undefined) return appSection.UiIcon.get_icon_name()
                
            global.logError("no gicon, no child")
            global.logError(appSection.UiIcon)
            return null
        }
              
        if(typeof appSection.UiIcon.gicon.get_file === "function") return appSection.UiIcon.gicon.get_file().get_path()
        else if(appSection.UiIcon.gicon.names != undefined) return appSection.UiIcon.gicon.names[0]
        else throw new Error("nothing captured");
    }
    
    static GenerateTabFromApp(app, time = "00:00:00", labelMaxChar = 30, attributes = null) {
        let name = app.get_name()
        
        if(attributes != null) {
            Object.keys(attributes).forEach(key => {
                switch(key) {
                    case "SteamId":
                        name = app.get_windows()[0].get_title()
                    break;
                }
            })
        }
        
        return AppSection._GenerateAppTab(name, time, app.create_icon_texture(24), labelMaxChar)
    }
    
    static _GenerateAppTab(label, time, icon = null, labelMaxChar = 30) {
        let section = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            sensitive: false,
            focusOnHover: false
        });
        let appLabel = new St.Label({
            text: Helper.truncate(label, labelMaxChar),
            style: "color: white;"
        })
        let timeLabel = new St.Label({
            text: time,
            style: appLabel.style
        })
        
        timeLabel.set_name("timer")
        
        if(icon == null) icon = new St.Icon({gicon: Gio.icon_new_for_string("system-file-manager"), icon_size: 24});
        
        section.addActor(icon)
        section.addActor(appLabel)
        section.addActor(timeLabel)
        
        return [section, icon, appLabel, timeLabel]
    }
    
    static TimeToInt(timeStr) {
        const [hours, minutes, seconds] = timeStr.split(":").map(Number);
        return (hours * 3600) + (minutes * 60) + seconds;
    }
    
    static IntToTime(timeInt) {
        const hours = Math.floor(timeInt / 3600);
        const minutes = Math.floor((timeInt % 3600) / 60);
        const seconds = timeInt % 60;
        const pad = (n) => String(n).padStart(2, '0');

        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    
    static TryGetSystemIcon(iconName, size) {
        try {
            let icon = Gio.icon_new_for_string(iconName);
            let theme = Gtk.IconTheme.get_default();

            if (icon instanceof Gio.ThemedIcon && theme.has_icon(icon.get_names()[0]) 
                || icon instanceof Gio.FileIcon) 
                return new St.Icon({gicon: icon, icon_size: size})

            return null;
        } catch (e) {
            global.logError(e)
            return null;
        }
    }

    GetSectionFullHeight() {
        let [minHeight, naturalHeight] = this.ui.actor.get_preferred_height(-1);
        return naturalHeight;
    }
    
    IncrementTimer() {
        let timerLabel = this.timeLabel;
        let next = this.constructor.IntToTime(
            this.constructor.TimeToInt(timerLabel.text) + 1
        );

        timerLabel.set_text(next);
    }

    ToString() {
        return _(`%s | Instances active: %i, Time: %s, Flags: None} \n`).format(this.nameLabel.text, this.appInstances, this.timeLabel.text)
    }

    AttrToStr() {
        return "Function evaulating not finished..."
    }
}

class DBusService {
    static interface = `
        <node>
            <interface name="info.DAU">
                <property name="ReadCSV" type="s" access="read"/>
                <property name="ReadJSON" type="s" access="read"/>
            </interface>
        </node>
    `
    
    constructor(appUsageApplet) {
        this.applet = appUsageApplet
    }
    
    get ReadCSV() { return this.applet.AppsAsCSV(); }
    get ReadJSON() { return this.applet.AppsAsJSON() }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new AppUsageMeter(orientation, panel_height, instance_id)
}