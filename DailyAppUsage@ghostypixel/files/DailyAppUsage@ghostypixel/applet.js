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
const GObject = imports.gi.GObject
const GdkPixbuf = imports.gi.GdkPixbuf;
const Cogl = imports.gi.Cogl;
const Gettext = imports.gettext;
const UUID = "DailyAppUsage@ghostypixel"

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

Gio._promisify(Gio.File.prototype, 'load_contents_async', 'load_contents_finish');
Gio._promisify(Gio.File.prototype, 'query_info_async', 'query_info_finish');
Gio._promisify(Gio.File.prototype, 'replace_contents_async', 'replace_contents_finish');

function _(text) { return Gettext.dgettext(UUID, text); }
function MinutesToMs(intMinutes) { return 1000 * 60 * intMinutes }

function toCSV(table) {
    const lines = [
        table.columns.join(","),
        ...table.rows.map(row => row.join(","))
    ];

    return lines.join("\n");
}

function connectOnce(obj, signal, callback) {
    let id = obj.connect(signal, (...args) => {
        obj.disconnect(id);
        callback(...args);
    });

    return id;
}

class AppMetadata {
    constructor(name, startingTime = 0, attr) {
        this.name = name
        this.time = startingTime
        this.attr = attr
    }
    
    static IsSteamName(name) { return name.startsWith("steam_app_") }
    
    static GetNameFromApp(app) {
        let name = app.get_name()
        
        // Steam apps use proton for compatibility, using desktop id to categorize them is unreliable and their name always sounds technical (steam_app_{steam app id})
        if(this.IsSteamName(name)) return app.get_windows()[0].get_title()
        
        return name
    }
    
    static FromApp(app) {
        let attributes = AppMetadata.GenerateAttributes(app)
        return new AppMetadata(AppMetadata.GetNameFromApp(app), 0, attributes)
    }
    
    static FromSavedEntry(entry) {
        return new AppMetadata(entry[0], entry[1], entry[2])
    }
    
    static FromSavedEntries(entries, activeApps) {
        return Object.fromEntries(
            Object.entries(entries).map(([key, val]) => [key, AppMetadata.FromSavedEntry(val)])
        );
    }
    
    static FromWindows(windows) {
        let tracker = Cinnamon.WindowTracker.get_default();
        let dataDict = {}
        
        windows.forEach(window => {
            let app = tracker.get_window_app(window);
            dataDict[window.get_wm_class()] = AppMetadata.FromApp(app)
        })
        
        return dataDict
    }
    
    static GenerateAttributes(app) {
        let attr = {}
        let name = app.get_name()
        
        if(this.IsSteamName(name)) attr["SteamId"] = parseInt(name.match(/\d+$/)[0]); // that gets the id
            
        return attr
    } 
    
    static GetWindowId(window) { return window.get_wm_class() }
}

class AppUsageMeter extends Applet.TextApplet {
    // UI ELEMENTS
    menuManager = new PopupMenu.PopupMenuManager(this);
    settingsMenu;
    popupMenu;
    scrollView // scrollview when too many apps are present on the list
    innerScrollViewBox // container inside scrollview
    exportButtonsContainer // a container for export buttons present right below the scrollView

    // APPDATA RELATED
    appsMeta; // dictionary { key: Apps PID, value: AppMetadata structure }
    appSections; // AppSectionList
    appToSection; // a dict that maps an AppMetadata using its pid to an AppSection, useful when sorting
    activeApps = new Set(); // Set of active apps pid's
    inactiveApps = new Set(); // Set for inactive pid's
    sortService // Object responsible for sorting apps
    appIcons; // Holds icon images, is responsible for asynchronous extraction, provides a signal for when an icon appears or is updated.

    // SIGNAL ID'S
    timerIntervalId; // updates every active apps timer
    saveIntervalId // saves in an interval of hours specified in settings
    appOpeningSignalId; // fires when an app is opened
    
    // OTHER
    isMouseHovering = false
    updateLastSaveTime
    timerIntervalUpdateFunctions = {}

    /*
        D-BUS RELATED
    
        To Inspect the dbus service use:
        busctl --user introspect   info.DAU   /info/dau
        
        To Call a method:
        busctl --user call \
        info.DAU \
        /info/dau \
        info.DAU \
        <METHODNAME>
        
        To Call a property:
        busctl --user get-property \
        info.DAU \
        /info/dau \
        info.DAU \
        <PROPERTYNAME>
    */
    dBus; // exported service.
    dBusId;
    
    // Subscriptions for unsubing
    iconAddedUnsub;
    iconUpdatedUnsub;
    
    constructor(orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        
        this.popupMenu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.popupMenu);
        this.settingsMenu = this.HandleSettings(instanceId)
        
        let windows = this.GetUniqueAppWindows();
        
        this.set_applet_label(_("App Usage"));
        
        this.appSections = this.settingsMenu.getValue("enable-app-icons") ? new IconedAppSectionsList() : new AppSectionsList()
        
        if(this.settingsMenu.getValue("enable-saving")) this.SetupAppsWithSaveFile(windows)
        else this.SetupAppsFromRunningWindows(windows)
    }

    SetupAppsFromRunningWindows(runningWindows) {
        this.appsMeta = AppMetadata.FromWindows(runningWindows)
        let appKeys = Object.keys(this.appsMeta)
        
        this.appIcons = new AppIconManager()
        this.iconAddedUnsub = this.appIcons.iconLoaded.subscribe(this.OnIconAdded.bind(this))

        if(appKeys.length < 1) { this.AppSetupFinished(); return }

        this.appSections.PushEmptyAppSections(appKeys.length)
        appKeys.forEach(key => this.activeApps.add(key))
        
        this.appIcons.AddWithWindows(runningWindows)
        this.AppSetupFinished()
    }

    async SetupAppsWithSaveFile(runningWindows) {
        let activeAppsData = AppMetadata.FromWindows(runningWindows)

        try {
            let saveOutdated = await this.IsSaveOutdated() 
           
            if(saveOutdated != null) {
                let saveFile = await this.LoadState(saveOutdated)

                this.appsMeta = AppMetadata.FromSavedEntries(saveFile["AppMetadata"], activeAppsData)
                
                Object.keys(activeAppsData).forEach(id => this.activeApps.add(id))
                Object.keys(this.appsMeta).forEach(key => {
                    if(!this.activeApps.has(key)) this.inactiveApps.add(key)
                })
                Object.entries(activeAppsData).forEach(([key, val]) => {
                    if(this.appsMeta[key] == null) this.appsMeta[key] = val
                    delete activeAppsData[key]
                })
                
                this.appSections.PushEmptyAppSections(this.activeApps.size + this.inactiveApps.size)
                
                this.appIcons = AppIconManager.FromSavedData(saveFile["AppIconManager"], runningWindows)
                this.iconAddedUnsub = this.appIcons.iconLoaded.subscribe(this.OnIconAdded.bind(this))
                
                this.AppSetupFinished()
            }
            else this.SetupAppsFromRunningWindows(runningWindows)
        }
        catch (error) {
            global.logError(error)
            this.Clear()
            this.SetupAppsFromRunningWindows(runningWindows)
        }
    }
    
    AppSetupFinished() {
        this.appToSection = this.sortService.GetSort(this.appsMeta);
        let uiBuilt = this._buildUI()
        
        const onMapEvent = (wm, actor) => {
            if (!uiBuilt) return this.OnAppOpeningNoUI(wm, actor);
            else return this.OnAppOpening(wm, actor);
        };

        this.appOpeningSignalId = global.window_manager.connect("map", (wm, actor) => this.GetAppOpeningCallback(wm, actor, uiBuilt));
            
        global.window_manager.connect("destroy", (wm, actor) => this.OnAppClosing(wm, actor))
        
        this.actor.connect("enter-event", () => this.OnMouseEnter())
        this.actor.connect("leave-event", () => this.OnMouseLeave())
        
        this.iconUpdatedUnsub = this.appIcons.iconUpdated.subscribe(this.OnIconUpdated.bind(this))
        
        this.timerIntervalUpdateFunctions["TimerUpdate"] = this.GetTimerUpdateFunction()

        this.SetMainLoop()
        this.UpdateTooltipText()
    }
    
    GetAppOpeningCallback(wm, actor, uiBuilt) {
        if(!uiBuilt) return this.OnAppOpeningNoUI(wm, actor);
        else return this.OnAppOpening(wm, actor);
    }

    on_applet_clicked() { this.popupMenu.toggle() }
    on_applet_reloaded(deleteConfig) { this.OnBeingClosed() }
    on_applet_removed_from_panel() { this.OnBeingClosed() }
    
    onBusAcquired(connection, name) {      
        let serviceInstance = new DBusService(this);
        this.dBus = Gio.DBusExportedObject.wrapJSObject(DBusService.interface, serviceInstance);

        serviceInstance._impl = this.dBus;
        this.dBus.export(connection, '/info/dau');
        
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
    
    AddTimerInterval() { 
        this.timerIntervalId = Mainloop.timeout_add(1000, () => this.CallIntervalUpdateFunctions()); 
    }
    
    AddSaveInterval() {
        if(this.settingsMenu.getValue("enable-saving")) {
            let time = MinutesToMs(parseInt(this.settingsMenu.getValue("save-interval")) * 60)
            this.saveIntervalId = Mainloop.timeout_add(time, () => this.SaveState())
            this.updateLastSaveTime = new Date()
        }
    }

    SetMainLoop() {        
        this.AddSaveInterval()
        this.AddTimerInterval()
    }
    
    CloseMainLoop() {
        if(this.timerIntervalId != null) { Mainloop.source_remove(this.timerIntervalId); this.timerIntervalId = null}
        if(this.saveIntervalId != null) { Mainloop.source_remove(this.saveIntervalId); this.saveIntervalId = null}
    }

    RestartSaveInterval() {
        if(this.saveIntervalId != null) { Mainloop.source_remove(this.saveIntervalId); this.saveIntervalId = null}
        this.AddSaveInterval()
    }

    TryDeleteNoAppsLabel() {
        if(!this.IsUIEmpty()) return
        this.popupMenu.actor.get_children()[0].get_children()[0].get_children()[0].destroy()
    }
    
    OnAppOpeningNoUI(wm, actor) {
        [this.scrollView, this.innerScrollViewBox, this.exportButtonsContainer] = this.buildBaseUI()
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
        
        this.AddApp(actor.meta_window.get_wm_class(), app)
    }
    
    AddApp(wmClass, app) {        
        // makes app actve again
        if(this.inactiveApps.has(wmClass)) {
            this.activeApps.add(wmClass)
            this.inactiveApps.delete(wmClass)
        }
        // adds the app section the the ui
        else if(!this.activeApps.has(wmClass)) {
            try {
                let newAppMetadata = AppMetadata.FromApp(app)
                this.appsMeta[wmClass] = newAppMetadata
                this.appSections.PushEmptyAppSections(1)
                this.innerScrollViewBox.add_child(this.appSections.At(-1))
                this.activeApps.add(wmClass)
                
                this.QueueSort()
                this.RecalcScrollViewHeight()
            } catch (error) {
                global.logError(_("App opened: %s").format(newAppMetadata.name))
                global.logError(error)
            }
        }

        this.appIcons.AddWithApp(wmClass, app)
        if(this.timerIntervalId == null) this.AppOpeningWhileLoopDeactivated()
            
    }
    
    OnAppClosing(wm, actor) {
        try {
            let tracker = Cinnamon.WindowTracker.get_default();
            let wmClass = actor.meta_window.get_wm_class()
            let app = tracker.get_window_app(actor.meta_window)
            
            if(app == null || app.get_windows().length - 1 > 0) return
            
            this.inactiveApps.add(wmClass)
            this.activeApps.delete(wmClass)

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
    
    /**
     * Builds the UI on startup
     * @returns {boolean} bool weather the list had any apps
    */
    _buildUI() {    
        if(this.activeApps.size + this.inactiveApps.size < 1) { this.buildUIEmpty(); return false }
        
        [this.scrollView, this.innerScrollViewBox, this.exportButtonsContainer] = this.buildBaseUI()
        
        this.appSections.FillAppSections(this)
        this.appSections.AddToInnerScrollView(this.innerScrollViewBox)
        
        return true
    }
    
    buildUIEmpty() {
        this.popupMenu.addActor(new St.Label({
            text: _("No apps were opened."),
            style: "color: white;"
        }))
    }
    
    // TODO: check if scrollbar should be visible
    buildBaseUI() {
        let scrollView = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.NEVER,
        });
        
        scrollView.set_overlay_scrollbars(true);
        
        const adjustment = scrollView.vscroll.adjustment;
        adjustment.connect("notify::value", () => {
            this.onScrollChanged(adjustment.value).bind(this);
        });
        
        let insideScrollView = new St.BoxLayout({
            vertical: true,
        });
        
        let container = new St.BoxLayout({ 
            vertical: false,
            x_expand: true,
            y_expand: true, 
            x_align: Clutter.ActorAlign.CENTER
        })
        
        this.popupMenu.addActor(scrollView)
        scrollView.add_actor(insideScrollView)
        this.popupMenu.addActor(container)
        
        let exportOpt = this.settingsMenu.getValue("show-export-buttons")
        if(exportOpt != "opNone") this.buildExportButtons(exportOpt, container)
        
        this.QueueScrollViewHeightRecalc()
        
        return [scrollView, insideScrollView, container]
    }

    IsUIEmpty() { return this.activeApps.size + this.inactiveApps.size <= 0 }
    
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
        if(this.appSections.IsEmpty()) return false;
        
        try {
            const data = {
                "AppMetadata" : {},
                "AppIconManager" : this.appIcons.GetState()
            };
            
            let saveAppMetadata = data["AppMetadata"]

            for(const [id, appMeta] of Object.entries(this.appsMeta)) {            
                saveAppMetadata[id] = [appMeta.name, appMeta.time];
                
                // optional data that may not be present but is helpful
                if(appMeta.attr != null && Object.keys(appMeta.attr).length > 0) saveAppMetadata[id].push(appMeta.attr);
            }

            const bytes = new TextEncoder().encode(JSON.stringify(data));
            await this.CreateFile(this.savePath, bytes)
            
            this.updateLastSaveTime = new Date()
            return true
        }
        catch { return false }
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
        try {  
            let file = Gio.File.new_for_commandline_arg(this.savePath);
            let parent = file.get_parent();
            
            if(parent != null) {
                try { parent.make_directory_with_parents(null); } 
                catch (e) {
                    if(!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                        throw e;
                }
            }
        
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
            if(err.constructor.name == "Gio_IOErrorEnum") return null
            throw new Error("Couldn't indicate save data: ", err)
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
        menu.connect("changed::max-char-for-app-label", (menu, settingKey, oldValue, newValue) => this.AppLabelCharCountChanged(newValue))
        menu.connect("changed::enable-app-icons", ((menu, settingKey, oldValue, newValue) => this.ToogleIcons(newValue)))
        menu.connect("changed::scroll-bar-visible", ((menu, settingKey, oldValue, newValue) => this.ToogleScrollBarVisibility(newValue)))
        
        menu.connect("changed::sort-apps-by", (menu, settingKey, oldValue, newValue) => this.SortServiceChanged(newValue, this.sortService.ascendingOrder))
        menu.connect("changed::sort-order", (menu, settingKey, oldValue, newValue) => this.SortOrderChanged(newValue))
        
        menu.connect("changed::enable-saving", () => this.ToogleEnablingSaving())
        menu.connect("changed::save-interval", () => this.RestartSaveInterval())
        menu.connect("changed::save-path", ((menu, settingKey, oldValue, newValue) => { this.savePath = newValue }));
        
        menu.connect("changed::show-export-buttons", ((menu, settingKey, oldValue, newValue)  => this.ResetExportBtns(newValue)))
        menu.connect("changed::enable-export-dbus", () => this.ToogleDBus())
        
        return menu
    }
    
    // TODO: Find out if it is possible to remove the if check on RecalcScrollViewHeight()
    RecalcScrollViewHeight() {
        if(this.appSections.IsEmpty()) return

        let sectionHeight = this.appSections.GetFirstSectionFullHeight()
        
        this.scrollView.height = sectionHeight * Math.min(this.appSections.Length(), this.settingsMenu.getValue("apps-visible"))
    }

    AppsVisibleCountChanged() { this.RecalcScrollViewHeight() }
    
    AppLabelCharCountChanged(newCharCount) { 
        this.appSections.SetCharCount(newCharCount); 
        this.appSections.FillAppSections(this) // fires because when increasing the value, appsections need to be refilled
    }

    ToogleEnablingSaving() {
        if(this.settingsMenu.getValue("enable-saving")) {
            this.saveIntervalId = Mainloop.timeout_add(MinutesToMs(parseInt(this.settingsMenu.getValue("save-interval")) * 60) + 1, () => this.SaveState())
            this.updateLastSaveTime = new Date()
        }
        else if(this.saveIntervalId != null) { Mainloop.source_remove(this.saveIntervalId); this.saveIntervalId = null}
    }
    
    AppsAsCSV() {
        const data = { columns: ["Name", "Time"], rows: this.appSections.AsArrayOfPairs() }
        return toCSV(data)
    }
    
    AppsAsJSON() { return JSON.stringify(this.appSections.AsJson()) }
    
    ExportBtnPressed(strData, extension, defaultMsg = _("Export Successful"), errorMsg = _("Export Unsuccesful")) {
        let message = defaultMsg
        try {
            this.CreateFile(this.settingsMenu.getValue("export-path") + `/${new Date().toISOString().replace("T", "-").replace("Z", "").split(".")[0]}.${extension}`, new TextEncoder().encode(strData))
        }
        catch(err) { global.logError(_("coudnt save json %s").format(err)); message = errorMsg }
        finally { Main.notify("App Usage", _(message)) }
    }
    
    JSONBtnClicked() { this.ExportBtnPressed(this.AppsAsJSON(), "json") }
    CSVBtnClicked() { this.ExportBtnPressed(this.AppsAsCSV(), "csv") }
    
    // This function will very likely be changed in the future.
    ResetExportBtns(exportOpt) {
        function ClearContainer(children) { for(let child of children) child.destroy(); }
        
        function ContainerSweep(children, container) {
            ClearContainer(children)
            container.set_style("")
        }
        
        let children = this.exportButtonsContainer.get_children()
        let length = children.length
        
        switch(exportOpt) {  
            case "opNone":
                ContainerSweep(children, this.exportButtonsContainer)
            break;
            
            case "opCSV":
                if(length == 0) this.buildExportButtons(exportOpt, this.exportButtonsContainer)
                else if(length == 1) {
                    children[children.length - 1].destroy()
                    this.buildExportButtons(exportOpt, this.exportButtonsContainer)
                }
                else if(length == 2) children[children.length - 1].destroy()
            break;
            
            case "opJSON":
                if(children.length == 2) {
                    children[0].destroy()
                    return;
                }
                else if(children.length == 1) children[0].destroy()
                
                this.buildExportButtons(exportOpt, this.exportButtonsContainer)
            break;
            
            case "opBoth":
                if(children.length == 1) {
                    if(children[0].label == "CSV") exportOpt = "opJSON"
                    else if(children[0].label == "JSON") ClearContainer(children)
                }
                    
                this.buildExportButtons(exportOpt, this.exportButtonsContainer)
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
        if(this.dBus != null) this.dBus.unexport()
        Gio.bus_unown_name(this.dBusId);
        this.dBusId = this.dBus = null
    }
    
    async SaveBtnPressed() {
        try{
            let wasSaved = await this.SaveState();
            let message = wasSaved ? "Saved successfully." : "Saving failed :( \nCheck looking glass for further info."
            Main.notify("App Usage", _(message))
        }
        catch(err) {
            global.logError(err)
        }
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
        this.appToSection = this.sortService.GetSort(this.appsMeta)
        this.appSections.FillAppSections(this)
    }
    
    SortServiceChanged(newSortMethod, order) {
        let previousServiceName = this.sortService.constructor.name
        this.sortService = this.GetSortingService(newSortMethod, order)
        this.QueueSort()
        
        this.timerIntervalUpdateFunctions["TimerUpdate"] = this.GetTimerUpdateFunction()
    }
    
    SortOrderChanged(newOrder) {
        this.sortService.ascendingOrder = newOrder
        this.QueueSort()
        
        this.timerIntervalUpdateFunctions["TimerUpdate"] = this.GetTimerUpdateFunction()
    }

    
    ToogleIcons(value) {
        try {
            if(value) this.EnableIcons()
            else this.DisableIcons()
        
            this.QueueScrollViewHeightRecalc() 
            // global.log("icons toogled")
        } catch (error) {
            global.logError(error)
        }
        
    }
    
    OnIconAdded(data) {
        if(this.appToSection == null) return
        this.appSections.SectionsIconLoaded(this.appToSection[data["appId"]], this.appIcons.GetIcon(data["iconId"]))
    }
    
    OnIconUpdated(data) { 
        if(this.appToSection == null) return
        this.appSections.SectionsIconUpdated(this.appToSection[data["appId"]], this.appIcons.GetIcon(data["iconId"]))
    }
    
    UpdateTooltipText() { this.set_applet_tooltip(this.GenerateToolTip()) }
    
    OnMouseEnter() {
        this.timerIntervalUpdateFunctions["ToolTipUpdate"] = new UpdateTooltipText()
        this.isMouseHovering = true
        
        this.timerIntervalUpdateFunctions["ToolTipUpdate"].Call(this)
        return Clutter.EVENT_PROPAGATE;
    }
    
    OnMouseLeave() {
        this.timerIntervalUpdateFunctions["ConfirmHoverEnd"] = new ConfirmNoHover()
        this.isMouseHovering = false
        
        return Clutter.EVENT_PROPAGATE;
    }
    
    // NOTE: TEST THIS
    Clear() {
        this.activeApps = new Set()
        this.inactiveApps = new Set()
        this.appsMeta = {}
        this.appToSection = {}
        this.appIcons = null

        this.appSections.DestroySections()
        this.appSections = null
    }
    
    // *** these two methods relay on the fact there's only two section types.
    EnableIcons() {
        let iconedAppSections = IconedAppSectionsList.FromAppSectionsList(this.appSections)
        
        this.appSections.DestroySections()
        
        this.appSections = iconedAppSections
        this.appSections.AddToInnerScrollView(this.innerScrollViewBox)
        this.iconAddedUnsub = this.appIcons.iconLoaded.subscribe(this.OnIconAdded.bind(this))
        this.iconUpdatedUnsub = this.appIcons.iconUpdated.subscribe(this.OnIconUpdated.bind(this))
        this.appSections.FillAppSections(this)  
    }
    
    DisableIcons() {
        let appSections = AppSectionsList.FromIconedAppSectionsList(this.appSections)
        
        this.iconAddedUnsub()
        this.iconUpdatedUnsub()
        
        this.appSections.DestroySections()
        this.appSections = appSections
        this.appSections.AddToInnerScrollView(this.innerScrollViewBox)
        this.appSections.FillAppSections(this)     
    }
    // ***
    
    QueueScrollViewHeightRecalc() {
        connectOnce(this.popupMenu, "open-state-changed", () => {
            this.RecalcScrollViewHeight().bind(this)
        })
    }
    
    onScrollChanged(value) {
        let adjustment = this.scrollView.vscroll.adjustment;
        let itemHeight = this.appSections.GetFirstSectionFullHeight();
        let current = adjustment.value;

        adjustment.value = Math.round(current / itemHeight) * itemHeight;
    }

    ToogleScrollBarVisibility(value) {
        if(value) {
            this.scrollView.vscrollbar_policy = St.PolicyType.AUTOMATIC
            return
        }

        this.scrollView.vscrollbar_policy = St.PolicyType.NEVER
    }

    GetActiveAppCount() { return this.activeApps.size }

    GenerateToolTip() {
        return _("Active apps: %s\nNext save in %s").format(String(this.GetActiveAppCount()), this.GetTimeToNextSave());
    }

    GetTimeToNextSave() {
        let intervalTime = MinutesToMs(parseInt(this.settingsMenu.getValue("save-interval")) * 60)
        return AppUsageMeter.GetTimeLeft(this.updateLastSaveTime, intervalTime)
    }
    
    CallIntervalUpdateFunctions() {
        Object.values(this.timerIntervalUpdateFunctions).forEach(updateFunction => updateFunction.Call(this))
        return true // MainLoop Lib needs to know weather to keep the interval alive
    }

    GetTimerUpdateFunction() {
        if(this.sortService.constructor.name === "TimeSorting") {
            if(!this.sortService.ascendingOrder) return new UpdateTimersTimeSort();
            else return new UpdateTimersTimeSortAsc();
        }
        else return new UpdateActiveTimers();
    }
    
    // TODO: make saving modular and modify tooltip generation to support multiple cases
    static GetTimeLeft(targetDate, timeInMilliseconds) {
        try {
            const target = new Date(targetDate.getTime() + timeInMilliseconds);
            const timeDifference = target - new Date();

            const hours = Math.floor(timeDifference / (1000 * 60 * 60));
            const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

            const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            return formattedTime;
        }
        catch { return "{ Couldn't get time }" } // When saves are disabled this is what will be displayed.
    }
}

class AppIconManager extends Map {
    iconLoaded = new Observer()
    iconUpdated = new Observer()
    #iconExists = new Set() // holds icon names/paths
    #iconNameToIcon = {} // returns icon id | Replace this with something better
    #appIdToIcon = {} // returns icon id
    #iconCount = 0;
    
    static IconIdentifierType = Object.freeze({
        NONE: 0,
        GICON_THEME: 1,
        GICON_FILEPATH: 2,
        THEMED_ICON_NAME: 3,
    });
    
    // mapArg is the array used to create the Map object.
    constructor(mapArg, defaultIconName = "application-x-executable") {
        super(mapArg);
        
        let id = this.ReserveId();
        
        this.set(id, [AppIconManager.ImgBuffFromSystemIconName(defaultIconName), defaultIconName, AppIconManager.IconIdentifierType.THEMED_ICON_NAME]);
        this.#iconNameToIcon[defaultIconName] = id;        
    }
    
    // NOTE: extracionType returned by saveData is a string!
    static FromSavedData(saveData, runningWindows, defaultIconName = "application-x-executable") {
        function AddFromWindows(windows, manager, appIdToIconId) {
            let tracker = Cinnamon.WindowTracker.get_default();
            let idsTracked = []
        
            windows.forEach(window => {
                let app = tracker.get_window_app(window)
                let wmClass = window.get_wm_class()
                let slot = appIdToIconId[wmClass]
                
                if(slot == null || slot == 0) slot = manager.ReserveId()
                else idsTracked.push(wmClass)
                
                manager.AddFromStIcon(wmClass, slot, app.create_icon_texture(24))
            })
            
            return idsTracked
        }
        
        try {
            let iconIdToAppId = Object.entries(saveData["AppIdToIconId"])
                .reduce((acc, [key, val]) => { acc[val] = key; return acc; }, {});
            let manager = new AppIconManager(null, defaultIconName)
            
            manager.#iconCount = saveData["Count"]
            
            // Load icons from existing windows and see if some of them belong to previously opened apps
            AddFromWindows(runningWindows, manager, saveData["AppIdToIconId"]).forEach(appId => {
                delete saveData["AppIdToIconId"][appId]
            })
            
            for(const [key, val] of Object.entries(saveData["Icons"])) {
                let AssignIconFunc = AppIconManager.GetExtractionMethodForSaveEntry(Number(key))
                
                // key, val 2 are just pairs inside the icon bucket. buckets are icons of certain type like IconIdentifierType.GICON_THEME
                for(const [key2, val2] of Object.entries(val)) {
                    AssignIconFunc(manager, iconIdToAppId[key2], key2, val2)
                    delete saveData["AppIdToIconId"][iconIdToAppId[key2]]
                }
            }
            
            for(const key of Object.keys(saveData["AppIdToIconId"])) {
                manager.#appIdToIcon[key] = 0
            }
            
            return manager
        } catch (error) {
            // global.logError(error)
            return new AppIconManager()
        }
    }
    
    GetIcon(id = 0) { return this.get(id)[0] }
    GetIconWithAppId(name) { return this.GetIcon(this.#appIdToIcon[name])}
    
    SetIcon(appId, iconId, iconName, extractionType, img) { 
        try {            
            let isNew = this.#appIdToIcon[appId] == null || this.#appIdToIcon[appId] == 0
            let message = { "appId": appId, "iconId": iconId }
            
            this.set(iconId, [img, iconName, extractionType])
            this.#appIdToIcon[appId] = iconId
            this.#iconNameToIcon[iconName] = iconId
            if(iconName != null) this.#iconExists.add(iconName)
            
            if(isNew) this.iconLoaded.notify(message)
            else this.iconUpdated.notify(message)
        } catch (error) {
            global.logError(error)
        }
    }
    
    // icon name is different from appId or app name, its the icon.gicon path or themed icon name
    // multiple apps can request the same icon, different app names, same icon name
    AppHasIcon(appId) { 
        let iconId = this.#appIdToIcon[appId]
        
        if(iconId == null) return false
        
        return this.#iconExists.has(this.get(iconId)[1]) 
    }
    
    ReserveId() { return this.#iconCount++ }
    
    async AddFromStIcon(appId, iconId, stIcon) { 
        let [img, iconName, extractionType] = await this.ExtractIconFromStIcon(stIcon)
        
        this.SetIcon(appId, iconId, iconName, extractionType, img)
    }
    
    AddWithApp(wmClass, app, slot = this.ReserveId()) {        
        if(this.AppHasIcon(wmClass)) { /* global.log(wmClass); */ return }
        this.AddFromStIcon(wmClass, slot, app.create_icon_texture(24))
    }
    
    AddWithWindow(window, tracker) {
        let slot = this.ReserveId()
        let app = tracker.get_window_app(window)
        let wmClass = window.get_wm_class()
        
        this.AddWithApp(wmClass, app, slot)
    }
    
    AddWithWindows(windows) {
        let tracker = Cinnamon.WindowTracker.get_default();
        
        windows.forEach(window => {
            this.AddWithWindow(window, tracker)
        })
    }
    
    GetState() {
        // The reason some are wrapped with Object.fromEntries is to create a copy of the object and not just pass refs
        let savedappIdToIcon = Object.fromEntries(Object.entries(this.#appIdToIcon)) 
        let iconIdentifierSet = new Set(Object.values(AppIconManager.IconIdentifierType));
        let iconPaths = Object.fromEntries(
            Object.entries(AppIconManager.IconIdentifierType).map(([key, value]) => [value, {}])
        );
        let iconData = Object.fromEntries(this.entries()) // local copy for editing.
        let emptyAppNames = []
        
        for(const [key, val] of Object.entries(savedappIdToIcon)) {
            if(iconData[val][2] == AppIconManager.IconIdentifierType.NONE) {
                emptyAppNames.push(key)
                delete iconData[val]
            }
        }
        
        for(const [key, val] of Object.entries(iconData)) {
            iconPaths[val[2]][key] = val[1]
            iconIdentifierSet.delete(val[2])
        }
        
        emptyAppNames.forEach(name => savedappIdToIcon[name] = 0)
        
        delete iconPaths[AppIconManager.IconIdentifierType.THEMED_ICON_NAME][0]
        if(Object.keys(iconPaths[AppIconManager.IconIdentifierType.THEMED_ICON_NAME]) < 1) iconIdentifierSet.add(AppIconManager.IconIdentifierType.THEMED_ICON_NAME)
        
        delete iconPaths[AppIconManager.IconIdentifierType.NONE]
        iconIdentifierSet.forEach(type => delete iconPaths[type] )
        
        let state = {
            "Icons" : iconPaths,
            "AppIdToIconId" : savedappIdToIcon,
            "Count" : this.size
        }
        
        return state
    }
    
    GetAppsAndIcons() {
        return Object.fromEntries(
            Object.entries(this.#appIdToIcon).map(([key, val]) => [key, this.GetIcon(val)])
        );
    }
    
    static ClutterImgFromPixBuff(buff) {
        const content = new Clutter.Image();
        
        content.set_data(
            buff.get_pixels(),
            Cogl.PixelFormat.RGBA_8888,
            buff.get_width(),
            buff.get_height(),
            buff.get_rowstride()
        );
        
        return content
    }
    
    static async GetImgFromGIconFile(gicon) {
        return new Promise((resolve, reject) => {
            const iconTheme = Gtk.IconTheme.get_default();
            const iconInfo = iconTheme.lookup_by_gicon(gicon, 24, 0);
            
            iconInfo.load_icon_async(null, (source, result) => {
                try {
                    resolve(AppIconManager.ClutterImgFromPixBuff(source.load_icon_finish(result)));
                } 
                catch (e) { reject(e); }
            });
        }) 
        
    }
    
    static ImgBuffFromSystemIconName(name) {
        let theme = Gtk.IconTheme.get_default();
        
        try {
            let info = theme.lookup_icon(name, 24, 0);
            let pixbuf = info.load_icon();
            return AppIconManager.ClutterImgFromPixBuff(pixbuf)
        }
        catch(err) {
            // global.logError(`${name}`, err)
            return this.GetIcon()
        }
    }
    
    static ExtractGiconThemed(gicon) { 
        const theme = Gtk.IconTheme.get_default();
        const info = theme.lookup_by_gicon(gicon, 24, 0);
        let name = gicon.get_names()[0]
        
        return [AppIconManager.ClutterImgFromPixBuff(info.load_icon()), name, AppIconManager.IconIdentifierType.GICON_THEME]
    }
    static async ExtractGiconFilePath(gicon) { 
        const file = gicon.get_file();
        let path = file.get_path()
        
        return [await AppIconManager.GetImgFromGIconFile(gicon), path, AppIconManager.IconIdentifierType.GICON_FILEPATH]
    }
    static ExtractIconThemed(iconName) { return [AppIconManager.ImgBuffFromSystemIconName(iconName), iconName, AppIconManager.IconIdentifierType.THEMED_ICON_NAME] }
    
    static ExtractChildContent(childObj) { return [childObj.get_content(), null, AppIconManager.IconIdentifierType.NONE] }
    
    async ExtractIconFromStIcon(stIcon) {
        let iconContent;
        let iconIdentifierName = null;
        let iconIdentifierType = null;
        let giconExists = stIcon.gicon != null
        
        try {
            if(giconExists && stIcon.gicon.names != null) {        
                return AppIconManager.ExtractGiconThemed(stIcon.gicon)
            }
            else if(giconExists && stIcon.gicon.names == null) {
                return await AppIconManager.ExtractGiconFilePath(stIcon.gicon)
            }
            else if(stIcon["icon-name"] != null) {
                return AppIconManager.ExtractIconThemed(stIcon["icon-name"])
            }
            else if(stIcon.child != null) {
                return AppIconManager.ExtractChildContent(stIcon.get_child())
            }
            else this.GetIcon()
        } 
        catch (error) {
            global.logError(error)
        }
    }
    
    static GetExtractionMethodForSaveEntry(iconExtractionType) {
        switch(iconExtractionType) {
            case AppIconManager.IconIdentifierType.GICON_FILEPATH:
                return async (iconManager, appId, iconId, name) => {
                    try {
                        let img = await AppIconManager.GetIconFromPath(name, 24) 
                        iconManager.SetIcon(appId, iconId, name, iconExtractionType, AppIconManager.ClutterImgFromPixBuff(img))
                    } catch (error) {
                        global.logError(error)
                    }
                }
            
            case AppIconManager.IconIdentifierType.THEMED_ICON_NAME:
            case AppIconManager.IconIdentifierType.GICON_THEME:
                return (iconManager, appId, iconId, name) => {
                    iconManager.SetIcon(appId, iconId, name, iconExtractionType, AppIconManager.ImgBuffFromSystemIconName(name))
                }
                
            default: 
                throw new Exception("Invalid extraction type value: " + iconExtractionType + "Type of: " + typeof iconExtractionType)
        }
    }
    
    static async GetIconFromPath(filePath, size) {
        const file = Gio.File.new_for_path(filePath);

        const stream = await new Promise((resolve, reject) => {
            file.read_async(
                GLib.PRIORITY_DEFAULT,
                null,
                (file, result) => {
                    try {
                        resolve(file.read_finish(result));
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });

        try {
            const pixbuf = await new Promise((resolve, reject) => {
                GdkPixbuf.Pixbuf.new_from_stream_async(
                    stream,
                    null,
                    (source, result) => {
                        try {
                            resolve(
                                GdkPixbuf.Pixbuf.new_from_stream_finish(result)
                            );
                        } catch (e) {
                            reject(e);
                        }
                    }
                );
            });

            stream.close(null);

            return pixbuf;
        } catch (e) {
            stream.close(null);
            throw e;
        }
    }
    
    logMap() {
        for(const [key, val] of this.entries()) {
            global.log(`${key}: ${val}`);
        }
    }
    
    AddEmpty(appIds) { appIds.forEach(id => this.#appIdToIcon[id] = 0) }
}

const AppSection = GObject.registerClass(
    
class AppSection extends St.BoxLayout {    
    nameLabel = new St.Label({
        style: "color: white;",
        y_align: Clutter.ActorAlign.CENTER
    })
    timeLabel = new St.Label({
        style: this.nameLabel.style,
        y_align: Clutter.ActorAlign.CENTER
    })
    
    constructor(params = {}) {
        super(params)
        
        this.style_class = "popup-menu-item",
        this.style = "padding-top: 3px; padding-bottom: 3px; padding-left: 8px;",
        this.y_align = Clutter.ActorAlign.CENTER
        
        this.add_actor(this.nameLabel)
        this.add_actor(this.timeLabel)
    }
    
    static FromIconedSection(section) {
        let newSection = new AppSection()
        newSection.nameLabel.set_text(section.nameLabel.text)
        newSection.timeLabel.set_text(section.timeLabel.text)
        
        return newSection
    }
    
    Fill(appData) {
        this.nameLabel.set_text(appData.name)
        this.timeLabel.set_text(AppSection.IntToTime(appData.time))
        
        return this;
    }
    
    static GenerateEmpty(amount = 1) {
        return Array.from({ length: amount }, () => new AppSection());
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

    GetSectionFullHeight() { return this.get_preferred_height(-1)[1]; }
    
    SetTimer(int) { this.timeLabel.set_text(AppSection.IntToTime(int)) }
})

const IconedAppSection = GObject.registerClass(
    
class IconedAppSection extends AppSection {
    icon = new St.Widget({ width: 24, height: 24 })
    
    constructor(params = {}) {
        super(params)
        this.insert_child_at_index(this.icon, 0)
    }
    
    static FromAppSection(section) {
        let newSection = new IconedAppSection()
        newSection.nameLabel.set_text(section.nameLabel.text)
        newSection.timeLabel.set_text(section.timeLabel.text)
        
        return newSection
    }
    
    static GenerateEmpty(amount = 1) {
        return Array.from({ length: amount }, () => new IconedAppSection());
    }
    
    // Gio.icon_new_for_string( // creates a gicon from string, a desktop id or a unique icon name
    ReplaceIcon(iconContent) { this.icon.set_content(iconContent); }
}

)

class AppSorting {
    ascendingOrder; // true - ascending, false - descending
    
    constructor(ascendingOrder) {
        this.ascendingOrder = ascendingOrder
        if(new.target === AppSorting) throw new Error("AppSorting is an abstract class");
    }
    
    // returns a dict {key:appDatas id, value: appsection index}
    GetSort(appDataDict) { return null }
}

class NameSorting extends AppSorting {
    GetSort(appDataDict) {
        const appNames = Object.entries(appDataDict)
            .map(([key, val]) => [key, val.name])
            .sort(([, a], [, b]) => a.localeCompare(b));
            
        return Object.fromEntries(appNames.map(([name, key], index) => [name, this.ascendingOrder ? index : appNames.length - 1 - index]));
    }
}

class TimeSorting extends AppSorting {
    GetSort(appDataDict) {
        const appTimes = Object.entries(appDataDict)
            .map(([key, val]) => [key, val.time])
            .sort(([, a], [, b]) => a - b);

        return Object.fromEntries(appTimes.map(([time, key], index) => [time, this.ascendingOrder ? index : appTimes.length - 1 - index]));
    }
}

// remember! this.appsMeta does not preserve insertion order when dealing with integer keys.
// this works assuming insertion order is present
class SortingRecentAdded extends AppSorting {
    GetSort(appDataDict) {
        const pids = Object.keys(appDataDict);
        return Object.fromEntries(pids.map((pid, index) => [pid, this.ascendingOrder ? index : pids.length - 1 - index]));
    }
}

// base class with logic responsible for filling appsections.
class BaseAppSectionsList {
    appSections = [];

    constructor() {
        if(new.target === BaseAppSectionsList) throw new Error("BaseAppSectionsList is an abstract class");
    }

    FillAppSections(applet) { }
    
    PushEmptyAppSections(count) { }
    
    Length() { return this.appSections.length }
    
    IsEmpty() { return this.Length() < 1 }
    
    At(idx) { return this.appSections.at(idx) }
    
    AddToInnerScrollView(scrollView) {
        this.appSections.forEach(section => scrollView.add_child(section))
    }
    
    GetFirstSectionFullHeight() { return this.appSections[0].GetSectionFullHeight() }
    
    AsArrayOfPairs() { 
        let rows = []
        
        this.appSections.forEach(section => {
            rows.push([section.nameLabel.text, section.timeLabel.text])
        })
        
        return rows
    }
    
    AsJson() { 
        let data = {}
        
        this.appSections.forEach(section => {
            let key = section.nameLabel.text
            data[key] = {}
            data[key]["time"] = section.timeLabel.text
        })
        
        return data
    }
    
    DestroySections() { this.appSections.forEach(section => section.destroy()) }
    
    SectionsIconLoaded(idx, icon) { }
    SectionsIconUpdated(idx, icon) { }
    
    SetCharCount(charCount) {
        this.appSections.forEach(section => {
            section.nameLabel.get_clutter_text().set_max_length(charCount) 
        })
    }
}

class AppSectionsList extends BaseAppSectionsList {
    static FromIconedAppSectionsList(sectionList) {
        let newList = new AppSectionsList()
        newList.PushEmptyAppSections(sectionList.appSections.length) 
        
        return newList
    }
    
    FillAppSections(applet) {
        Object.keys(applet.appToSection).forEach(key => {
            this.appSections[applet.appToSection[key]].Fill(applet.appsMeta[key]);
        });
    }
    
    PushEmptyAppSections(count) { 
        AppSection.GenerateEmpty(count).forEach(section => this.appSections.push(section))   
    }
}

class IconedAppSectionsList extends AppSectionsList {
    static FromAppSectionsList(sectionList) {
        let newList = new IconedAppSectionsList()
        newList.PushEmptyAppSections(sectionList.appSections.length) 
        
        return newList
    }
    
    FillAppSections(applet) {
        super.FillAppSections(applet);

        Object.entries(applet.appIcons.GetAppsAndIcons()).forEach(([key, val]) => {
            this.appSections[applet.appToSection[key]].ReplaceIcon(val);
        });
    }
    
    PushEmptyAppSections(count) { 
        IconedAppSection.GenerateEmpty(count).forEach(section => this.appSections.push(section))  
    }
    
    SectionsIconLoaded(idx, icon) {
        this.appSections[idx].ReplaceIcon(icon)
    }
    
    SectionsIconUpdated(idx, icon) { this.SectionsIconLoaded(idx, icon) }
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

class AppletIntervalFunction {
    Call(applet) { }
}

class UpdateActiveTimers extends AppletIntervalFunction {
    Call(applet) {
        applet.activeApps.forEach(id => {
            try {
                applet.appSections.At(applet.appToSection[id]).SetTimer(++applet.appsMeta[id].time);
            } catch (e) {
                global.logError(_("Failed timer for %s").format(id));
                global.logError(e);
            }
        });
    }
}

class UpdateTimersTimeSort extends AppletIntervalFunction {
    Call(applet) {
        let appTimersUpdated = []
        
        applet.activeApps.forEach(id => {
            applet.appSections.At(applet.appToSection[id]).SetTimer(++applet.appsMeta[id].time);
            appTimersUpdated.push([applet.appsMeta[id].time, applet.appToSection[id]])
        });
        
        for(let i = 0; i < appTimersUpdated.length; ++i) {
            let section = applet.appSections.At(appTimersUpdated[i][1] - 1)
            if(section == null) continue
            
            try {
                let nextAppSectionTime = AppSection.TimeToInt(section.timeLabel.text)
                if(appTimersUpdated[i][0] > nextAppSectionTime) { applet.QueueSort(); break; }
                
            } catch (error) {
                global.logError(error)
            }
        }
    }
}

class UpdateTimersTimeSortAsc extends AppletIntervalFunction {
    Call(applet) {
        let appTimersUpdated = []
        
        applet.activeApps.forEach(id => {
            applet.appSections.At(applet.appToSection[id]).SetTimer(++applet.appsMeta[id].time);
            appTimersUpdated.push([applet.appsMeta[id].time, applet.appToSection[id]])
        })
        
        for(let i = 0; i < appTimersUpdated.length; ++i) {
            let section = applet.appSections.At(appTimersUpdated[i][1] + 1)
            if(section == null) continue
            
            let nextAppSectionTime = AppSection.TimeToInt(section.timeLabel.text)
            if(appTimersUpdated[i][0] > nextAppSectionTime) { applet.QueueSort(); break; }
        }
    }
}

class UpdateTooltipText extends AppletIntervalFunction {
    Call(applet) { applet.UpdateTooltipText() }
}

class ConfirmNoHover extends AppletIntervalFunction {
    Call(applet) {
        delete applet.timerIntervalUpdateFunctions["ConfirmHoverEnd"]
        
        if(applet.isMouseHovering) return
        delete applet.timerIntervalUpdateFunctions["ToolTipUpdate"]
    }
}

class Observer { 
    #subscribers = new Set(); 
    
    get size() { return this.#subscribers.size; }
    
    subscribe(callback) { 
        if(typeof callback !== "function") { 
            throw new TypeError("Subscriber must be a function"); 
        } 
        
        this.#subscribers.add(callback);
        return () => { this.#subscribers.delete(callback); }; 
    }
    
    notify(data) { 
        for(const subscriber of this.#subscribers) subscriber(data); 
    } 
    
    clear() { this.#subscribers.clear(); } 
}

function main(metadata, orientation, panel_height, instance_id) {
    return new AppUsageMeter(orientation, panel_height, instance_id)
}