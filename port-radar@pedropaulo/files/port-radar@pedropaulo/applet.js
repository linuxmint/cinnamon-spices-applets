const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Gettext = imports.gettext;
const Config = imports.misc.config;
const UUID = "port-radar@pedropaulo";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(text) {
    return Gettext.dgettext(UUID, text);
}

var PortRadarApplet = class extends Applet.TextIconApplet {
    constructor(orientation, panelHeight, instanceId, metadata) {
        super(orientation, panelHeight, instanceId);
        this._destroyed = false;
        this._version = metadata.version;
        this._scanInProgress = false;
        this._refreshPending = false;
        this._lastUpdated = null;
        this._scanTimer = null;
        this._records = [];
        this._socketItems = new Map();
        this._socketViewSignature = null;
        this._changes = [];
        this._hasSnapshot = false;
        this._scanError = null;
        this._filter = "all";
        this._ready = false;
        this._compatible = parseInt(Config.PACKAGE_VERSION, 10) >= 6;

        // Use Cinnamon's loader so reloading the applet also reloads these modules.
        const Scanner = require("./lib/scanner");
        const ChangeDetector = require("./lib/change-detector");
        this._compareSnapshots = ChangeDetector.compareSnapshots;

        this.set_applet_icon_symbolic_path(GLib.build_filenamev([metadata.path, "icons", "port-radar-symbolic.svg"]));
        this.set_applet_tooltip(_("Port Radar — local sockets"));
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("refresh-interval", "refreshInterval", Lang.bind(this, this._settingsChanged));
        this.settings.bind("max-entries", "maxEntries", Lang.bind(this, this._settingsChanged));
        this.settings.bind("show-count", "showCount", Lang.bind(this, this._settingsChanged));
        this.settings.bind("show-udp", "showUdp", Lang.bind(this, this._settingsChanged));
        this.settings.bind("show-ipv6", "showIpv6", Lang.bind(this, this._settingsChanged));

        this._scanner = new Scanner.TcpScanner();
        this._header = new PopupMenu.PopupMenuItem(_("Port Radar"), { reactive: false, style_class: "port-radar-title" });
        this._status = new PopupMenu.PopupMenuItem(_("Scanning…"), { reactive: false, style_class: "port-radar-summary" });
        this.menu.addMenuItem(this._header);
        this.menu.addMenuItem(this._status);
        let searchRow = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this._searchEntry = new St.Entry({
            hint_text: _("Search port, process, address or PID"),
            style_class: "port-radar-search",
            can_focus: true,
            x_expand: true
        });
        searchRow.addActor(this._searchEntry, { expand: true, span: -1 });
        this._searchEntry.clutter_text.connect("text-changed", Lang.bind(this, this._searchChanged));
        this.menu.addMenuItem(searchRow);

        this._filterItem = new PopupMenu.PopupSubMenuMenuItem(_("All ports"));
        this._addFilterOption("all", _("All ports"));
        this._addFilterOption("TCP", _("TCP"));
        this._addFilterOption("UDP", _("UDP"));
        this._addFilterOption("IPv4", _("IPv4"));
        this._addFilterOption("IPv6", _("IPv6"));
        this._addFilterOption("loopback", _("Loopback only"));
        this._addFilterOption("non-loopback", _("Non-loopback"));
        this.menu.addMenuItem(this._filterItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._socketSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._socketSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._changesItem = new PopupMenu.PopupSubMenuMenuItem(_("Recent changes"));
        this._changesSection = this._changesItem.menu;
        this._changesItem.actor.hide();
        this.menu.addMenuItem(this._changesItem);
        this._updated = new PopupMenu.PopupMenuItem("", { reactive: false, style_class: "port-radar-detail" });
        this._updated.actor.hide();
        this.menu.addMenuItem(this._updated);
        this._refreshItem = new PopupMenu.PopupMenuItem(_("Refresh now"));
        this._refreshItem.connect("activate", Lang.bind(this, this.refresh));
        this.menu.addMenuItem(this._refreshItem);

        let aboutItem = new PopupMenu.PopupMenuItem(_("About Port Radar"));
        aboutItem.connect("activate", () => this.openAbout());
        this.menu.addMenuItem(aboutItem);

        // Settings callbacks can run during setup; wait until the menu is ready.
        this._ready = true;
        this._settingsChanged();
        this.refresh();
    }

    _addFilterOption(value, label) {
        let option = new PopupMenu.PopupMenuItem(label);
        option.connect("activate", Lang.bind(this, function () {
            this._filter = value;
            this._filterItem.label.set_text(label);
            this._render();
        }));
        this._filterItem.menu.addMenuItem(option);
    }

    _settingsChanged() {
        if (this._destroyed || !this._ready)
            return;
        this._restartTimer();
        this._updatePanelLabel();
        this._render();
    }

    _restartTimer() {
        if (this._scanTimer !== null) {
            Mainloop.source_remove(this._scanTimer);
            this._scanTimer = null;
        }
        let interval = Number(this.refreshInterval);
        if (this._compatible && interval > 0) {
            this._scanTimer = Mainloop.timeout_add_seconds(interval, Lang.bind(this, function () {
                this.refresh();
                return true;
            }));
        }
    }

    refresh() {
        if (this._destroyed)
            return;
        // Several refresh requests during a scan only need one follow-up scan.
        if (this._scanInProgress) {
            this._refreshPending = true;
            return;
        }
        if (!this._compatible) {
            this._scanError = "unsupported-version";
            this._status.actor.add_style_class_name("port-radar-error");
            this._updatePanelLabel();
            this._render();
            return;
        }
        this._scanInProgress = true;
        this._scanError = null;
        this._status.label.set_text(_("Scanning local sockets…"));
        this._scanner.scan(Lang.bind(this, function (records, error) {
            if (this._destroyed)
                return;
            this._scanInProgress = false;
            if (error) {
                this._scanError = error.code || "scan-failed";
                global.logError(new Error("Port Radar [" + this._scanError + "]: " +
                    (error.message || this._scanErrorMessage())));
                this._status.actor.add_style_class_name("port-radar-error");
            } else {
                this._acceptSnapshot(records);
                this._status.actor.remove_style_class_name("port-radar-error");
            }
            this._updatePanelLabel();
            this._render();
            if (this._refreshPending) {
                this._refreshPending = false;
                this.refresh();
            }
        }));
    }

    _acceptSnapshot(records) {
        let previous = this._records;
        let hadSnapshot = this._hasSnapshot;
        this._records = records;
        this._hasSnapshot = true;
        this._lastUpdated = GLib.DateTime.new_now_local().format("%H:%M:%S");
        // The first scan is our baseline, not a batch of newly opened ports.
        if (hadSnapshot) {
            try {
                let detected = this._compareSnapshots(previous, records);
                this._changes = detected.concat(this._changes).slice(0, 8);
            } catch (error) {
                // Keep the fresh results even if updating the history fails.
                global.logError(error);
            }
        }
    }

    _processLabel(record) {
        return record.processes.length ? record.processName : record.address;
    }

    _searchChanged() {
        this._render();
    }

    _matchesFilter(record) {
        if (!this.showUdp && record.protocol === "UDP")
            return false;
        if (!this.showIpv6 && record.family === "IPv6")
            return false;
        if (this._filter === "TCP" || this._filter === "UDP" || this._filter === "IPv4" || this._filter === "IPv6")
            return record.protocol === this._filter || record.family === this._filter;
        if (this._filter === "loopback")
            return this._isLoopback(record.address);
        if (this._filter === "non-loopback")
            return !this._isLoopback(record.address);
        return true;
    }

    _isLoopback(address) {
        return address.split("%")[0] === "::1" || address.indexOf("127.") === 0;
    }

    _filteredRecords() {
        let query = this._searchEntry.get_text().trim().toLowerCase();
        return this._records.filter(Lang.bind(this, function (record) {
            if (!this._matchesFilter(record))
                return false;
            if (!query)
                return true;
            let searchable = [record.port, record.protocol, record.family, record.address,
                this._processLabel(record), record.processes.map(process => process.pid).join(" ")].join(" ").toLowerCase();
            return searchable.indexOf(query) >= 0;
        }));
    }

    // The panel count follows settings, not the search or temporary menu filter.
    _enabledRecords() {
        return this._records.filter(record =>
            (this.showUdp || record.protocol !== "UDP") &&
            (this.showIpv6 || record.family !== "IPv6"));
    }

    // Show IPv4 and IPv6 under one port, but keep TCP and UDP separate.
    _groupPorts(records) {
        let groups = new Map();
        records.forEach(record => {
            let key = record.protocol + ":" + record.port;
            if (!groups.has(key))
                groups.set(key, { port: record.port, protocol: record.protocol, records: [] });
            groups.get(key).records.push(record);
        });
        return Array.from(groups.values()).sort((a, b) =>
            a.port - b.port || a.protocol.localeCompare(b.protocol));
    }

    _render() {
        if (!this._status || this._scanInProgress)
            return;
        this._moveFocusBeforeClearing(this._changesSection);
        this._changesSection.removeAll();

        if (this._lastUpdated) {
            this._updated.label.set_text((this._scanError
                ? _("Last successful update: %s") : _("Updated at %s")).format(this._lastUpdated));
            this._updated.actor.show();
        }
        this._renderChanges();
        if (this._scanError) {
            this._moveFocusBeforeClearing(this._socketSection);
            this._socketSection.removeAll();
            this._socketItems.clear();
            this._socketViewSignature = null;
            this._status.label.set_text(this._scanErrorMessage());
            return;
        }

        let total = this._groupPorts(this._enabledRecords()).length;
        let groups = this._groupPorts(this._filteredRecords());
        this._status.label.set_text(groups.length === total
            ? _("%d ports in use").format(total)
            : _("%d of %d ports").format(groups.length, total));

        let limit = Math.max(1, Number(this.maxEntries) || 50);
        let visibleGroups = groups.slice(0, limit);
        let signature = JSON.stringify([groups.length, limit, groups.length === 0 && total === 0, visibleGroups.map(group =>
            [group.protocol, group.port, group.records.map(record => record.identity).sort()])]);
        // Keep the existing widgets (and keyboard focus) when only the update
        // time changed. Record order from ss does not affect this comparison.
        if (signature === this._socketViewSignature)
            return;
        let expanded = new Set();
        this._socketItems.forEach((item, key) => {
            if (item.menu.isOpen)
                expanded.add(key);
        });
        this._moveFocusBeforeClearing(this._socketSection);
        this._socketSection.removeAll();
        this._socketItems.clear();
        this._socketViewSignature = signature;

        if (!groups.length) {
            let text = total === 0 ? _("No local sockets detected") : _("No sockets match this search and filter");
            this._socketSection.addMenuItem(new PopupMenu.PopupMenuItem(text,
                { reactive: false, style_class: "port-radar-empty" }));
            return;
        }

        visibleGroups.forEach(group => {
            let names = [...new Set(group.records.flatMap(record => record.processes.map(process => process.name)))];
            let title = group.port + " · " + group.protocol;
            if (names.length)
                title += " · " + names.join(", ");
            let item = new PopupMenu.PopupSubMenuMenuItem(title);
            item.actor.add_style_class_name("port-radar-socket");
            this._addCopyAction(item.menu, _("Copy port"), group.port);
            group.records.forEach((record, index) => {
                if (index > 0)
                    item.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                item.menu.addMenuItem(new PopupMenu.PopupMenuItem(record.address + " · " + record.family,
                    { reactive: false, style_class: "port-radar-detail" }));
                this._addCopyAction(item.menu, _("Copy address: %s").format(record.address), record.address);
                record.processes.forEach(process => {
                    let detail = process.name;
                    if (process.pid !== null)
                        detail += " · PID " + process.pid;
                    item.menu.addMenuItem(new PopupMenu.PopupMenuItem(detail,
                        { reactive: false, style_class: "port-radar-detail" }));
                    if (process.pid !== null)
                        this._addCopyAction(item.menu, _("Copy PID: %d").format(process.pid), process.pid);
                });
            });
            this._socketSection.addMenuItem(item);
            let key = group.protocol + ":" + group.port;
            this._socketItems.set(key, item);
            if (expanded.has(key))
                item.menu.open(false);
        });
        if (groups.length > limit) {
            this._socketSection.addMenuItem(new PopupMenu.PopupMenuItem(
                _("Showing %d of %d ports").format(limit, groups.length),
                { reactive: false, style_class: "port-radar-empty" }));
        }
    }

    _moveFocusBeforeClearing(section) {
        if (!this.menu.isOpen)
            return;
        let focus = global.stage.get_key_focus();
        // Cinnamon closes the popup when a focused actor is destroyed and
        // focus becomes null. Park it on a surviving actor inside the menu.
        if (focus && section.actor.contains(focus))
            this.menu.actor.grab_key_focus();
    }

    _addCopyAction(menu, label, value) {
        let item = new PopupMenu.PopupMenuItem(label);
        item.connect("activate", () => {
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, String(value));
        });
        menu.addMenuItem(item);
    }

    _renderChanges() {
        this._changesItem.actor.visible = this._changes.length > 0;
        if (!this._changes.length)
            return;
        this._changesItem.label.set_text(_("Recent changes (%d)").format(this._changes.length));
        this._changes.forEach(Lang.bind(this, function (change) {
            let record = change.record;
            let action = change.type === "opened" ? _("OPENED") :
                change.type === "closed" ? _("CLOSED") :
                change.type === "ownership-changed" ? _("PROCESS CHANGED") : _("BINDING CHANGED");
            let text = _("%s  %s %d  ·  %s").format(action, record.protocol, record.port, this._processLabel(record));
            this._changesSection.addMenuItem(new PopupMenu.PopupMenuItem(text, { reactive: false, style_class: change.type === "closed" ? "port-radar-change-closed" : "port-radar-change" }));
        }));
    }

    _scanErrorMessage() {
        let messages = {
            "missing-dependency": _("Install iproute2 to read local ports, then refresh."),
            "unsupported-version": _("Port Radar requires Cinnamon 6.0 or later."),
            "timeout": _("Reading ports took too long. Try refreshing."),
            "scan-failed": _("Could not read local ports. Try running ss -lntup in a terminal.")
        };
        return messages[this._scanError] || messages["scan-failed"];
    }

    _updatePanelLabel() {
        let count = this._groupPorts(this._enabledRecords()).length;
        this.set_applet_label(this.showCount ? (this._scanError ? "!" : String(count)) : "");
        let tooltip = this._scanError ? _("Port Radar") + " · " + this._scanErrorMessage()
            : _("Port Radar · %d ports in use").format(count);
        if (this._scanError && this._lastUpdated)
            tooltip += "\n" + _("Last successful update: %s").format(this._lastUpdated);
        this.set_applet_tooltip(tooltip);
    }

    on_applet_clicked() {
        let opening = !this.menu.isOpen;
        this.menu.toggle();
        if (opening)
            this.refresh();
    }

    on_applet_removed_from_panel() {
        if (this._destroyed)
            return;
        // Async replies may still arrive after the applet leaves the panel.
        this._destroyed = true;
        if (this._scanTimer !== null)
            Mainloop.source_remove(this._scanTimer);
        this._scanTimer = null;
        this._refreshPending = false;
        this._scanner.cancel();
        // Closing releases the modal grab. Destroying removes the actor from
        // Cinnamon's global UI group and disconnects its menu manager.
        this.menu.close(false);
        this.menu.destroy();
        this.settings.finalize();
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new PortRadarApplet(orientation, panelHeight, instanceId, metadata);
}
