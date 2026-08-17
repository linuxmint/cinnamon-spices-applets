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

Gio._promisify(Gio.File.prototype, 'load_contents_async', 'load_contents_finish');
Gio._promisify(Gio.File.prototype, 'query_info_async', 'query_info_finish');
Gio._promisify(Gio.File.prototype, 'replace_contents_async', 'replace_contents_finish');

function _(text) { return Gettext.dgettext(UUID, text); }

class AppData {
    constructor(name, icon = null, startingTime = 0) {
        this.name = name
        this.icon = icon
        this.time = startingTime
    }
    
    static IsSteamApp(name) { return name.startsWith("steam_app_") }
    
    static EvalAppForName(app) {
        let name = app.get_name()
        
        // Steam apps use proton for compatibility, using desktop id to categorize them is unreliable and their name always sounds technical (steam_app_{steam app id})
        if(this.IsSteamApp(name)) return app.get_windows()[0].get_title()
        
        return name
    }
    
    static FromApp(app) {
        return new AppData(AppData.EvalAppForName(app), app.create_icon_texture(24), 0)
    }
    
    static FromSavedEntry([name, data]) {
        return new AppData(name, null, data[0])
    }
    
    static FromSavedEntries(entries) {
        let dataDict = {}
        
        Object.entries(entries).forEach(([key, val]) => {
            dataDict[key] = AppData.FromSavedEntry([key, val])
        })
        
        return dataDict
    }
    
    static FromWindows(windows) {
        let tracker = Cinnamon.WindowTracker.get_default();
        let dataDict = {}
        
        windows.forEach(window => {
            let app = tracker.get_window_app(window);
            dataDict[app.get_name()] = AppData.FromApp(app)
        })
        
        return dataDict
    }
}

class AppUsageMeter extends Applet.TextIconApplet {
    // UI ELEMENTS
    menuManager = new PopupMenu.PopupMenuManager(this);
    settingsMenu;
    menu; // applet menu
    scrollView // scrollview when too many apps are present on the list
    scrollViewItemBox // container inside scrollview
    exportContainer // a container for export buttons present right below the scrollView

    // APPDATA RELATED
    apps; // dictionary { key: Apps PID, value: AppData structure }
    appSections = []; // array of AppSection from top to bottom
    appToSection; // a dict that maps an AppData using its pid to an AppSection, useful when sorting
    activeApps = new Set(); // Set of active apps pid's
    inactiveApps = new Set(); // Set for inactive pid's
    sortService // Object responsible for sorting apps

    // SIGNAL ID'S
    mainTimer; // updates every active apps timer
    saveInterval // saves in an interval of hours specified in settings
    appOpeningSignalId; 

    // D-BUS RELATED
    exportedObject; // exported service.
    dBusId; // dbus owns name

    constructor(orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.settingsMenu = this.HandleSettings(instanceId)
        
        let windows = this.GetUniqueAppWindows();

        if(this.settingsMenu.getValue("enable-saving")) this.SetupAppsWithSaveFile(windows)
        else this.SetupAppsFromRunningWindows(windows)
        
        this.set_applet_label(_("App Usage"));
        this.set_applet_tooltip(_("Displays apps and how long they were running."));
    }
    
    AppSetupFinished() {
        this.appToSection = this.sortService.GetSort(this.apps);
        this.appOpeningSignalId = !this._buildUI()
            ? global.window_manager.connect("map", (wm, actor) => this.OnAppOpeningNoUI(wm, actor))
            : global.window_manager.connect("map", (wm, actor) => this.OnAppOpening(wm, actor))
            
        global.window_manager.connect("destroy", (wm, actor) => this.OnAppClosing(wm, actor))
        
        this.SetMainLoop()
    }

    SetupAppsFromRunningWindows(runningWindows) {
        this.apps = AppData.FromWindows(runningWindows)
        let appKeys = Object.keys(this.apps)

        if(appKeys.length < 1) { this.AppSetupFinished(); return }

        AppSection.GenerateEmpty(appKeys.length).forEach(section => this.appSections.push(section))
        appKeys.forEach(key => this.activeApps.add(key))
        
        this.AppSetupFinished()
    }

    async SetupAppsWithSaveFile(runningWindows) {
        let activeAppsData = AppData.FromWindows(runningWindows)

        try {
            let saveOutdated = await this.IsSaveOutdated() 
           
            if(saveOutdated != null) {
                let saveFile = await this.LoadState(saveOutdated)
                this.apps = AppData.FromSavedEntries(saveFile)
                
                Object.keys(activeAppsData).forEach(id => this.activeApps.add(id))
                Object.keys(this.apps).forEach(key => {
                    if(!this.activeApps.has(key)) this.inactiveApps.add(key)
                })
                Object.entries(activeAppsData).forEach(([key, val]) => {
                    if(this.apps[key] == null) this.apps[key] = val
                    delete activeAppsData[key]
                })
                
                AppSection.GenerateEmpty(this.activeApps.size + this.inactiveApps.size).forEach(section => this.appSections.push(section))
                this.AppSetupFinished()
            }
            else this.SetupAppsFromRunningWindows(runningWindows)
        }
        catch (error) {
            global.logError(error)
            this.SetupAppsFromRunningWindows(runningWindows)
        }
    }

    on_applet_clicked() { this.menu.toggle() }
    on_applet_reloaded(deleteConfig) { this.OnBeingClosed() }
    on_applet_removed_from_panel() { this.OnBeingClosed() }
    
    onBusAcquired(connection, name) {      
        let serviceInstance = new DBusService(this);
        this.exportedObject = Gio.DBusExportedObject.wrapJSObject(DBusService.interface, serviceInstance);

        serviceInstance._impl = this.exportedObject;
        this.exportedObject.export(connection, '/info/dau');
        
        // global.log(_(`%s connection acquired`).format(name));
    }

    onNameAcquired(connection, name) { /* global.log(_(`%s: name acquired`).format(name)); */ }
    onNameLost(connection, name) { /* global.log(_(`%s: name lost`).format(name)); */ }

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
        if(this.sortService.constructor.name == "TimeSorting" && !this.sortService.ascendingOrder) {
            this.mainTimer = Mainloop.timeout_add(1000, () => this.UpdateTimersTimeSort())
        }
        else if(this.sortService.constructor.name == "TimeSorting" && this.sortService.ascendingOrder) {
            this.mainTimer = Mainloop.timeout_add(1000, () => this.UpdateTimersTimeSortAsc())
        }
        else this.mainTimer = Mainloop.timeout_add(1000, () => this.UpdateActiveTimers())
        
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

    TryDeleteNoAppsLabel() {
        if(!this.IsUIEmpty()) return
        this.menu.actor.get_children()[0].get_children()[0].get_children()[0].destroy()
    }
    
    OnAppOpeningNoUI(wm, actor) {
        [this.scrollView, this.scrollViewItemBox, this.exportContainer] = this.buildBaseUI()
        this.TryDeleteNoAppsLabel()        
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
        let appId = AppData.EvalAppForName(app)
        
        // makes app actve again
        if(this.inactiveApps.has(appId)) {
            this.activeApps.add(appId)
            this.inactiveApps.delete(appId)
        }
        // adds the app section the the ui
        else if(!this.activeApps.has(appId)) {
            try {
                let newAppData = AppData.FromApp(app)
                this.apps[newAppData.name] = newAppData
                this.appSections.push(AppSection.GenerateEmpty()[0].Fill(newAppData, this.settingsMenu.getValue("max-char-for-app-label")))
                this.scrollViewItemBox.add_child(this.appSections.at(-1).ui.actor)
                this.activeApps.add(newAppData.name)
                
                this.QueueSort()
                this.RecalcScrollViewHeight()
            } catch (error) {
                global.logError(_("App opened: %s").format(app.get_name()))
                global.logError(error)
            }
        }

        if(this.mainTimer == null) this.AppOpeningWhileLoopDeactivated()
    }
    
    OnAppClosing(wm, actor) {
        try {
            let tracker = Cinnamon.WindowTracker.get_default();
            let app = tracker.get_window_app(actor.meta_window)
            let appName = AppData.EvalAppForName(app)
            
            if(app == null || app.get_windows().length - 1 > 0) return
            
            this.inactiveApps.add(appName)
            this.activeApps.delete(appName)

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
        this.activeApps.forEach(id => {
            try {
                this.appSections[this.appToSection[id]].SetTimer(++this.apps[id].time);
            } catch (e) {
                global.logError(_("Failed timer for %s").format(id));
                global.logError(e);
                return false
            }
        });
        
        return true; // Is here so that Mainloop recognizes its an interval. Might edit this to add an override to stop
    }
    
    // Same as UpdateActiveTimers except checks if time sort is required every tick. desc order
    UpdateTimersTimeSort() {
        let appTimersUpdated = []
        
        this.activeApps.forEach(id => {
            this.appSections[this.appToSection[id]].SetTimer(++this.apps[id].time);
            appTimersUpdated.push([this.apps[id].time, this.appToSection[id]])
        });
        
        for(let i = 0; i < appTimersUpdated.length; ++i) {
            let section = this.appSections[appTimersUpdated[i][1] - 1]
            let thisSection = this.appSections[appTimersUpdated[i][1]]
            if(section == null) continue
            
            try {
                let nextAppSectionTime = AppSection.TimeToInt(section.timeLabel.text)
                if(appTimersUpdated[i][0] > nextAppSectionTime) { this.QueueSort(); break; }
                
            } catch (error) {
                global.logError(error)
            }
            
        }
        
        return true;
    }
    
    UpdateTimersTimeSortAsc() {
        let appTimersUpdated = []
        
        this.activeApps.forEach(id => {
            this.appSections[this.appToSection[id]].SetTimer(++this.apps[id].time);
            appTimersUpdated.push([this.apps[id].time, this.appToSection[id]])
        })
        
        for(let i = 0; i < appTimersUpdated.length; ++i) {
            let section = this.appSections[appTimersUpdated[i][1] + 1]
            let thisSection = this.appSections[appTimersUpdated[i][1]]
            if(section == null) continue
            
            let nextAppSectionTime = AppSection.TimeToInt(section.timeLabel.text)
            if(appTimersUpdated[i][0] > nextAppSectionTime) { this.QueueSort(); break; }
        }
        
        return true;
    }
    
    /**
     * Builds the UI on startup
     * @returns {boolean} bool weather the list had any apps
    */
    _buildUI() {    
        if(this.activeApps.size + this.inactiveApps.size < 1) { this.buildUIEmpty(); return false }
        
        [this.scrollView, this.scrollViewItemBox, this.exportContainer] = this.buildBaseUI()
        
        this.FillAppSections()
        
        this.appSections.forEach(section => {
            this.scrollViewItemBox.add_child(section.ui.actor)
        })
        
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
        return this.activeApps.size + this.inactiveApps.size <=0; 
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

    GetUniqueAppWindows() {
        let tracker = Cinnamon.WindowTracker.get_default();
        let windowAdded = new Set()
        let windows = []

        global.get_window_actors().forEach(actor => {
            let win = actor.meta_window;
            let app = tracker.get_window_app(win);
            
            if(app == null || app.get_name() == "Unknown" || windowAdded.has(win.get_pid())) return

            windowAdded.add(win.get_pid())
            windows.push(win)
        });

        return windows
    }
    
    async SaveState() {
        if(this.appSections.length < 1) return false;
        const data = {};

        for(const [id, appdata] of Object.entries(this.apps)) {            
            data[id] = [];
            let attr = {}
            let attrCount = 0
            
            // optional data that may not be present but is helpful
            if(appdata.iconPath != null) { attr["icon-path"] = appdata.iconPath; ++attrCount; }
            // if(appdata.attr != null) attr["section-attr"] = appdata.attr 

            data[id].push(appdata.time);
            if(attrCount > 0) data[id].push(attr);
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
    
    HandleSettings(instanceId) {    
        let menu = new Settings.AppletSettings(this, UUID, instanceId);
        
        if(menu.getValue("save-path") == menu.getDefaultValue("save-path")) {
            this.savePath = `${GLib.get_user_cache_dir()}/DailyAppUsage/save.json`
            menu.setValue("save-path", this.savePath)
        }
        else this.savePath = menu.getValue("save-path")
        
        this.sortService = this.GetSortingService(menu.getValue("sort-apps-by"), menu.getValue("sort-order"))
        
        if(menu.getValue("enable-export-dbus")) this.dBusId = this.TrySetupDBus()
        
        menu.connect("changed::apps-visible", () => this.AppsVisibleCountChanged())
        menu.connect("changed::max-char-for-app-label", () => this.AppLabelCharCountChanged())
        menu.connect("changed::sort-apps-by", (menu, settingKey, oldValue, newValue) => this.SortServiceChanged(newValue, this.sortService.ascendingOrder))
        menu.connect("changed::sort-order", ((menu, settingKey, oldValue, newValue) => this.SortOrderChanged(newValue)))
        
        menu.connect("changed::enable-saving", () => this.ToogleEnablingSaving())
        menu.connect("changed::save-interval", () => this.RestartSaveInterval())
        menu.connect("changed::save-path", ((menu, settingKey, oldValue, newValue) => { this.savePath = newValue }));
        
        menu.connect("changed::show-export-buttons", ((menu, settingKey, oldValue, newValue)  => this.ResetExportBtns(newValue)))
        menu.connect("changed::enable-export-dbus", () => this.ToogleDBus())
        
        return menu
    }
    
    RecalcScrollViewHeight() {
        if(this.appSections.length < 1) return

        let sectionHeight = this.appSections[0].GetSectionFullHeight()
        this.scrollView.height = sectionHeight * Math.min(this.appSections.length, this.settingsMenu.getValue("apps-visible"))
    }

    AppsVisibleCountChanged() {
        this.RecalcScrollViewHeight()
    }

    AppLabelCharCountChanged() {
        this.ResetAppLabelCharWidth()
    }

    ResetAppLabelCharWidth() {
        let maxWidth = this.settingsMenu.getValue("max-char-for-app-label")

        Object.entries(this.appToSection).forEach(([appId, sectionIdx]) => {
            this.appSections[sectionIdx].nameLabel.set_text(Helper.truncate(this.apps[appId].name, maxWidth))
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
        
        this.appSections.forEach(section => {
            data.rows.push([section.nameLabel.text, section.timeLabel.text])
        })
        
        return Helper.toCSV(data)
    }
    
    AppsAsJSON() {
        const data = {}
        
        this.appSections.forEach(section => {
            let key = section.nameLabel.text
            data[key] = {}
            data[key]["time"] = section.timeLabel.text
        })
        
        return JSON.stringify(data)
    }
    
    ExportBtnPressed(strData, defaultMsg, errorMsg) {
        let message = defaultMsg
        try {
            this.CreateFile(this.settingsMenu.getValue("export-path") + `/${new Date().toISOString().replace("T", "-").replace("Z", "").split(".")[0]}.json`, new TextEncoder().encode(strData))
        }
        catch(err) { global.logError(_("coudnt save json %s").format(err)); message = errorMsg }
        finally { Main.notify("App Usage", _(message)) }
    }
    
    JSONBtnClicked() { ExportBtnPressed(this.AppsAsJSON()) }
    CSVBtnClicked() { this.ExportBtnPressed(this.AppsAsCSV()) }
    
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
    
    FillAppSections() {
        let maxLabelChar = this.settingsMenu.getValue("max-char-for-app-label")
        
        Object.keys(this.appToSection).forEach(key => {
            this.appSections[this.appToSection[key]].Fill(this.apps[key], maxLabelChar)
        })
    }
    
    GetSortingService(sortingOption, isAscending) {
        switch(sortingOption) {
            case "name":
                return new NameSorting(isAscending)
            case "time":
                return new TimeSorting(isAscending)
            case "first-added":
            default:
                return new SortingRecentAdded(isAscending)
        }
    }
    
    QueueSort() {
        this.appToSection = this.sortService.GetSort(this.apps)
        this.FillAppSections()
    }
    
    SortServiceChanged(newSortMethod, order) {
        let previousServiceName = this.sortService.constructor.name
        this.sortService = this.GetSortingService(newSortMethod, order)
        this.QueueSort()
        
        // this is a lazy way to set a new increment function. There are three. a base one
        // and two others: UpdateTimersTimeSortAsc and UpdateTimersTimeSort. 
        // difference is the two other timers track if the list should be resorted
        if(previousServiceName == "TimeSorting" || this.sortService.constructor.name == "TimeSorting") {
            this.CloseMainLoop()
            this.SetMainLoop()
        }
    }
    
    SortOrderChanged(newOrder) {
        this.sortService.ascendingOrder = newOrder
        this.QueueSort()
        
        if(this.sortService.constructor.name == "TimeSorting") {
            this.CloseMainLoop()
            this.SetMainLoop()
        }
    }
}

class AppSection {
    appDataId // id used to identify what app this appsection represents
    ui = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        sensitive: false,
        focusOnHover: false
    });
    nameLabel = new St.Label({
        style: "color: white;"
    })
    timeLabel = new St.Label({
        style: this.nameLabel.style
    })
    
    constructor() {
        this.ui.addActor(this.nameLabel)
        this.ui.addActor(this.timeLabel)
    }
    
    Fill(appData, maxLabelChar = 30) {
        this.nameLabel.set_text(Helper.truncate(appData.name, maxLabelChar))
        this.timeLabel.set_text(AppSection.IntToTime(appData.time))
        // global.log(`"${this.nameLabel.text}"`)
        
        return this;
    }
    
    static GenerateEmpty(amount = 1) {
        let arr = []
        
        for(let i = 0; i < amount; i++) {
            arr.push(new AppSection())
        }
        
        return arr
    }
    
    // static GenerateAttributes(app) {
    //     let attr = {}
    //     let keyCount = 0
    //     let name = app.get_name()
        
    //     if(this.IsSteamApp(name)) {attr["SteamId"] = parseInt(name.slice(10)); ++keyCount} // that gets the id
            
    //     if(keyCount <= 0) return null
    //     return attr
    // } 
    
    // static GetIconPath(appSection) {
    //     if(appSection.attr != null && appSection.attr["SteamId"] != null) return "steam_icon_" + appSection.attr["SteamId"]
        
    //     if(appSection.UiIcon.gicon == undefined || appSection.UiIcon.gicon == null) {
                
    //         if(appSection.UiIcon.child != undefined) {
    //             let n = appSection.UiIcon.child.get_style_class_name()
    //             if(n != null) return n
    //             else return appSection.UiIcon.get_style_class_name()
    //         }
    //         else if(appSection.UiIcon.icon_name != undefined) return appSection.UiIcon.get_icon_name()
                
    //         global.logError("no gicon, no child")
    //         global.logError(appSection.UiIcon)
    //         return null
    //     }
              
    //     if(typeof appSection.UiIcon.gicon.get_file === "function") return appSection.UiIcon.gicon.get_file().get_path()
    //     else if(appSection.UiIcon.gicon.names != undefined) return appSection.UiIcon.gicon.names[0]
    //     else throw new Error("nothing captured");
    // }
       
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
    
    // static TryGetSystemIcon(iconName, size) {
    //     try {
    //         let icon = Gio.icon_new_for_string(iconName);
    //         let theme = Gtk.IconTheme.get_default();

    //         if (icon instanceof Gio.ThemedIcon && theme.lookup_icon(icon.get_names()[0]) 
    //             || icon instanceof Gio.FileIcon) 
    //             return new St.Icon({gicon: icon, icon_size: size})

    //         return null;
    //     } catch (e) {
    //         global.logError(e)
    //         return null;
    //     }
    // }

    GetSectionFullHeight() { return this.ui.actor.get_preferred_height(-1)[1]; }

    // ReplaceIcon(stIcon) {
    //     this.uiIcon.destroy()
    //     this.uiIcon = stIcon
    //     this.ui.addActor(this.uiIcon, {position: 0})
    // }
    
    SetTimer(int) {
        this.timeLabel.set_text(AppSection.IntToTime(int))
    }
}

class AppSorting {
    ascendingOrder; // true - ascending, false - descending
    
    constructor(ascendingOrder) {
        this.ascendingOrder = ascendingOrder
        if(new.target === AppSorting) throw new Error("AppSorting is an abstract class");
    }
    
    // returns a dict {key:appDatas id, value: appsection index}
    GetSort(appDataDict) {
        return null
    }
}

class NameSorting extends AppSorting {
    GetSort(appDataDict) {
        const size = Object.keys(appDataDict).length
        let appNames = Object.fromEntries(Object.entries(appDataDict).map(([key, val]) => [key, val.name]))
        appNames = Object.fromEntries(
            Object.entries(appNames).sort(([, a], [, b]) => a.localeCompare(b))
        );
        
        if(this.ascendingOrder) {
            Object.entries(appNames).forEach((key, i) => {
                appNames[key[0]] = size - 1 - i
            })
        }
        else {
            Object.entries(appNames).forEach((key, i) => {
                appNames[key[0]] = i
            }) 
        }
        
        return appNames
    }
}

class TimeSorting extends AppSorting {
    GetSort(appDataDict) {
        const size = Object.keys(appDataDict).length
        let appTimes = Object.fromEntries(Object.entries(appDataDict).map(([key, val]) => [key, val.time]))
        appTimes = Object.fromEntries(
            Object.entries(appTimes).sort(([, a], [, b]) => a - b)
        );
        
        if(this.ascendingOrder) {
            Object.entries(appTimes).forEach((key, i) => {
                appTimes[key[0]] = i
            }) 
        }
        else {
            Object.entries(appTimes).forEach((key, i) => {
                appTimes[key[0]] = size - 1 - i
            })
        }
        
        return appTimes
    }
}

// remember! this.apps does not preserve insertion order when dealing with integer keys.
// this works assuming insertion order is present
class SortingRecentAdded extends AppSorting {
    GetSort(appDataDict) {
        let dict = {}
        let pids = Object.keys(appDataDict)

        if(this.ascendingOrder) for(let i = pids.length - 1; i >= 0; i--) dict[pids[i]] = pids.length - 1 - i
        else for(let i = 0; i < pids.length; i++) dict[pids[i]] = i
        return dict
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
    get ReadJSON() { return this.applet.AppsAsJSON(); }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new AppUsageMeter(orientation, panel_height, instance_id)
}