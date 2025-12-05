const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Util = imports.misc.util;

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        this.set_applet_icon_symbolic_name("edit-copy");
        this.set_applet_tooltip("Copy Panel");
        
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        
        this._cleanOrphanedApplets();
        this._buildMenu();
    },
    
    _cleanOrphanedApplets: function() {
        let panelSettings = new Gio.Settings({ schema_id: 'org.cinnamon' });
        let appletSettings = new Gio.Settings({ schema_id: 'org.cinnamon' });
        
        let panels = panelSettings.get_strv('panels-enabled');
        let applets = appletSettings.get_strv('enabled-applets');
        
        let validPanelIds = [];
        for (let i = 0; i < panels.length; i++) {
            let panelId = panels[i].split(':')[0];
            validPanelIds.push(panelId);
        }
        
        let cleanedApplets = [];
        for (let i = 0; i < applets.length; i++) {
            let applet = applets[i];
            let panelPart = applet.split(':')[0];
            let panelId = panelPart.replace('panel', '');
            
            if (validPanelIds.indexOf(panelId) !== -1) {
                cleanedApplets.push(applet);
            } else {
                global.log("Panel Copy: Removing orphaned applet: " + applet);
            }
        }
        
        if (cleanedApplets.length !== applets.length) {
            global.log("Panel Copy: Cleaned " + (applets.length - cleanedApplets.length) + " orphaned applets");
            appletSettings.set_strv('enabled-applets', cleanedApplets);
        }
    },
    
    _buildMenu: function() {
        this.menu.removeAll();
        
        let panelSettings = new Gio.Settings({ schema_id: 'org.cinnamon' });
        let enabledPanels = panelSettings.get_strv('panels-enabled');
        
        let monitorCount = Main.layoutManager.monitors.length;
        let positions = ['top', 'bottom', 'left', 'right'];
        
        for (let i = 0; i < enabledPanels.length; i++) {
            let panelStr = enabledPanels[i];
            let parts = panelStr.split(':');
            let panelId = parts[0];
            let monitor = parts[1];
            let position = parts[2];
            
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
            let header = new PopupMenu.PopupMenuItem("Panel " + panelId + " (" + position + ", monitor " + monitor + ")", {
                reactive: false,
                style_class: 'popup-subtitle-menu-item'
            });
            this.menu.addMenuItem(header);
            
            for (let p = 0; p < positions.length; p++) {
                let pos = positions[p];
                let label = "  → Copy to " + pos + " (monitor " + monitor + ")";
                let item = new PopupMenu.PopupMenuItem(label);
                
                let self = this;
                let sourcePid = panelId;
                let targetMon = monitor;
                let targetPos = pos;
                
                item.connect('activate', function() {
                    self._copyPanel(sourcePid, targetMon, targetPos);
                });
                
                this.menu.addMenuItem(item);
            }
            
            if (monitorCount > 1) {
                for (let m = 0; m < monitorCount; m++) {
                    if (m.toString() !== monitor) {
                        let label = "  → Copy to monitor " + m + " (" + position + ")";
                        let item = new PopupMenu.PopupMenuItem(label);
                        
                        let self = this;
                        let sourcePid = panelId;
                        let targetMon = m.toString();
                        let targetPos = position;
                        
                        item.connect('activate', function() {
                            self._copyPanel(sourcePid, targetMon, targetPos);
                        });
                        
                        this.menu.addMenuItem(item);
                    }
                }
            }
        }
    },
    
    on_applet_clicked: function(event) {
        this._buildMenu();
        this.menu.toggle();
    },
    
    _isMultipleInstanceApplet: function(uuid) {
        try {
            const AppletManager = imports.ui.appletManager;
            
            if (!AppletManager.appletMeta || !AppletManager.appletMeta[uuid]) {
                return false;
            }
            
            let appletPath = AppletManager.appletMeta[uuid].path;
            let metadataFile = Gio.File.new_for_path(appletPath + '/metadata.json');
            
            if (!metadataFile.query_exists(null)) {
                return false;
            }
            
            let [success, contents] = metadataFile.load_contents(null);
            if (!success) {
                return false;
            }
            
            let metadataStr = contents.toString();
            let metadata = JSON.parse(metadataStr);
            
            if (!metadata.hasOwnProperty('max-instances')) {
                return false;
            }
            
            let maxInstances = metadata['max-instances'];
            
            if (typeof maxInstances === 'string') {
                maxInstances = parseInt(maxInstances);
            }
            
            return (maxInstances !== 1);
            
        } catch (e) {
            global.log("Panel Copy: Error checking applet metadata for " + uuid + ": " + e.toString());
            return false;
        }
    },
    
    _copyPanel: function(sourcePanelId, targetMonitor, targetPosition) {
        this.menu.close();
        
        try {
            this._cleanOrphanedApplets();
            
            let panelSettings = new Gio.Settings({ schema_id: 'org.cinnamon' });
            let appletSettings = new Gio.Settings({ schema_id: 'org.cinnamon' });
            
            let panels = panelSettings.get_strv('panels-enabled');
            let applets = appletSettings.get_strv('enabled-applets');
            
            let sourcePanel = null;
            for (let i = 0; i < panels.length; i++) {
                if (panels[i].startsWith(sourcePanelId + ':')) {
                    sourcePanel = panels[i];
                    break;
                }
            }
            
            if (!sourcePanel) {
                Main.notify("Panel Copy Tool", "Panel " + sourcePanelId + " not found");
                return;
            }
            
            for (let i = 0; i < panels.length; i++) {
                let parts = panels[i].split(':');
                if (parts[1] === targetMonitor && parts[2] === targetPosition) {
                    Main.notify("Panel Copy Tool", "A panel already exists at " + targetPosition + " on monitor " + targetMonitor);
                    return;
                }
            }
            
            let newPanelId = this._getNextPanelId(panels);
            
            let sourceApplets = [];
            for (let i = 0; i < applets.length; i++) {
                if (applets[i].startsWith('panel' + sourcePanelId + ':')) {
                    sourceApplets.push(applets[i]);
                }
            }
            
            let newApplets = [];
            let skippedCount = 0;
            
            for (let i = 0; i < sourceApplets.length; i++) {
                let applet = sourceApplets[i];
                let appletParts = applet.split(':');
                let zone = appletParts[1];
                let order = appletParts[2];
                
                let rest = appletParts.slice(3).join(':');
                let lastColonIndex = rest.lastIndexOf(':');
                let fullUuid = rest.substring(0, lastColonIndex);
                
                if (!this._isMultipleInstanceApplet(fullUuid)) {
                    skippedCount++;
                    continue;
                }
                
                let newId = this._getNextAppletId(applets.concat(newApplets));
                
                let newApplet = 'panel' + newPanelId + ':' + zone + ':' + order + ':' + fullUuid + ':' + newId;
                newApplets.push(newApplet);
            }
            
            let finalApplets = applets.concat(newApplets);
            appletSettings.set_strv('enabled-applets', finalApplets);
            
            let newPanelStr = newPanelId + ':' + targetMonitor + ':' + targetPosition;
            panels.push(newPanelStr);
            panelSettings.set_strv('panels-enabled', panels);
            
            let message = "Panel copied.";
            if (skippedCount > 0) {
                message += " (" + skippedCount + " single-instance applet" + (skippedCount > 1 ? "s" : "") + " skipped)";
            }
            Main.notify("Panel Copy Tool", message);
            
        } catch (e) {
            Main.notify("Panel Copy Tool", "Error: " + e.toString());
        }
    },
    
    _getNextPanelId: function(panels) {
        let maxId = 0;
        for (let i = 0; i < panels.length; i++) {
            let id = parseInt(panels[i].split(':')[0]);
            if (!isNaN(id) && id > maxId) maxId = id;
        }
        return (maxId + 1).toString();
    },
    
    _getNextAppletId: function(applets) {
        let maxId = 0;
        for (let i = 0; i < applets.length; i++) {
            let lastColon = applets[i].lastIndexOf(':');
            if (lastColon !== -1) {
                let id = parseInt(applets[i].substring(lastColon + 1));
                if (!isNaN(id) && id > maxId) maxId = id;
            }
        }
        return (maxId + 1).toString();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}