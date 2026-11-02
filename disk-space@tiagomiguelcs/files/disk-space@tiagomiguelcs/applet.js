/*
 * Disk Space Cinnamon Applet
 *
 * A simple Cinnamon panel applet that displays remaining disk space.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * "May the Force be with you." (Star Wars, 1977)
 */

const St = imports.gi.St;
const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const DEBUG = false;

class CinnamonDiskSpace extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this._applet_icon_box.set_style("margin-right: 0 !important;");
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        this._timeoutId = 0;
        this._bindSettings();
        this._buildLabels();
        this._start();

        if (DEBUG) {
            global.logWarning("[DS] Applet UUID: " + metadata.uuid);
            global.logWarning("[DS] Applet path: " + metadata.path);
            global.logWarning("[DS] Update Interval: " + this.update_interval + "m or " + (this.update_interval * 60 * 1000) + "ms");
        }

    }

    _bindSettings() {
        this.settings.bind("applet-icon", "applet_icon", this._onIconChanged);
        this.settings.bind("display-type", "display_type", this._onDisplaySettingsChanged);
        this.settings.bind("message", "message", this._onDisplaySettingsChanged);
        this.settings.bind("show-default-suffix", "show_default_suffix", this._onDisplaySettingsChanged);
        this.settings.bind("filesystem", "filesystem", this._onDisplaySettingsChanged)
        this.settings.bind("update-interval", "update_interval", this._onIntervalChanged);

        this.set_applet_icon_symbolic_name(this.applet_icon);
    }

    _buildLabels() {
        this._messageLabel = new St.Label({
            reactive: true,
            track_hover: true,
            style_class: "applet-label",
        });

        this._valueLabel = new St.Label({
            reactive: true,
            track_hover: true,
            style_class: "applet-label",
        });

        this._percentLabel = new St.Label({
            reactive: true,
            track_hover: true,
            style_class: "applet-label",
        });

        this._messageSuffixLabel = new St.Label({
            reactive: true,
            track_hover: true,
            style_class: "applet-label",
        });

        this._labelsBox = new St.BoxLayout({
            reactive: true,
            track_hover: true,
        });

        this._labelsBox.add_child(this._messageLabel);
        this._labelsBox.add_child(this._valueLabel);
        this._labelsBox.add_child(this._percentLabel);
        this._labelsBox.add_child(this._messageSuffixLabel);

        this._layoutBin = new St.Bin();
        this._layoutBin.set_child(this._labelsBox);

        this.actor.add(this._layoutBin, { y_align: St.Align.MIDDLE, y_fill: false });

        // Keep tooltip/accessibility focus associated with the numeric value.
        this.actor.set_label_actor(this._valueLabel);
    }

    _updateLabels(stats) {
        if (DEBUG) global.logError("[DS] Updating...")
        // global.logError(stats);
        var value = "";
        var suffix = "";
        var percent = false;
        switch (this.display_type) {
            case "used_p":
                value = stats.used_p.toString();
                suffix = this.show_default_suffix ? "Used" : suffix;
                percent = true;
                break;
            case "free_p":
                value = stats.free_p.toString();
                suffix = this.show_default_suffix ? "Free" : suffix;
                percent = true;
                break;
            case "used":
                value = stats.used.toString();
                suffix = this.show_default_suffix ? "Used" : suffix;
                break;
            case "free":
                value = stats.free.toString();
                suffix = this.show_default_suffix ? "Free" : suffix;
                break;
            default:
                value = "0";
        }

        this._messageLabel.set_text(this.message + " ");
        this._valueLabel.set_text(value);
        if (suffix.length > 0) this._messageSuffixLabel.set_text(" " + suffix + "");
        else this._messageSuffixLabel.set_text("");
        if (percent)
            this._percentLabel.set_text("%");
        else
            this._percentLabel.set_text("");

        // Update tooltip
        var fs = decodeURIComponent(this.filesystem.replace("file://", "").trim());
        if (fs == null || fs == "") fs = "/";
        const tooltipText =
            fs +
            "\nTotal: " + stats.total +
            "\nUsed: " + stats.used + " (" + stats.used_p + "%)" +
            "\nFree: " + stats.free + " (" + stats.free_p + "%)";
        this.set_applet_tooltip(tooltipText);
    }

    _onDisplaySettingsChanged() {
        this._getDiskSpace();
    }

    _onIconChanged() {
        const iconName = (this.applet_icon && this.applet_icon.trim()) ? this.applet_icon.trim() : "drive-harddisk";
        this.set_applet_icon_symbolic_name(iconName);
    }

    _onIntervalChanged() {
        if (DEBUG) global.logError("[DS] Update interval (ms): " + this.update_interval);
        this._restartLoop();
    }

    _start() {
        this._restartLoop();
    }

    _restartLoop() {
        if (this._timeoutId) {
            try {
                GLib.source_remove(this._timeoutId);
            } catch (e) { }
            this._timeoutId = 0;
        }
        const updateInterval = this.update_interval * 60 * 1000;
        this._getDiskSpace();

        if (updateInterval > 0) {
            this._timeoutId = Mainloop.timeout_add(updateInterval, () => {
                this._getDiskSpace();
                return true;
            });
        }
    }

    _getEmptyDiskSpace() {
        return { total: 0, used: 0, free: 0, free_p: 0, used_p: 0 };
    }

    _getDiskSpace() {
        var total = 0, free = 0, used = 0, free_p = 0, used_p = 0;
        var fs = decodeURIComponent(this.filesystem.replace("file://", "").trim());
        // Fallback to / if fails
        if (fs == null || fs == "") fs = "/";

        // https://docs.gtk.org/gio/vfunc.File.query_filesystem_info_async.html
        // Adapted from diskspace@schorschii, thank you.
        let file = Gio.file_new_for_path(fs);
        file.query_filesystem_info_async(
            Gio.FILE_ATTRIBUTE_FILESYSTEM_USED
            + "," + Gio.FILE_ATTRIBUTE_FILESYSTEM_FREE
            + "," + Gio.FILE_ATTRIBUTE_FILESYSTEM_SIZE,
            1, null, (source_object, response, data) => {
                try {
                    let fileInfo = file.query_filesystem_info_finish(response);
                    free = fileInfo.get_attribute_uint64(Gio.FILE_ATTRIBUTE_FILESYSTEM_FREE);
                    total = fileInfo.get_attribute_uint64(Gio.FILE_ATTRIBUTE_FILESYSTEM_SIZE);
                    if (this.reserved_blocks_as_used_space)
                        used = total - free;
                    else
                        used = fileInfo.get_attribute_uint64(Gio.FILE_ATTRIBUTE_FILESYSTEM_USED);

                    if (total !== 0) {
                        // Free and Used Space Percentage
                        free_p = Math.round((free * 100) / total);
                        used_p = 100 - free_p;
                    }
                    total = GLib.format_size(total);
                    free = GLib.format_size(free);
                    used = GLib.format_size(used);
                } catch (err) {
                    // e.g. file not found (= not mounted)
                    if (DEBUG) global.logError("[DS] Error getting filesystem info: " + fs + err);
                    this._updateLabels(this._getEmptyDiskSpace());
                }

                if (DEBUG) {
                    global.logWarning("[DS] Filesystem: " + fs);
                    global.logWarning("[DS] total: " + total + " | free: " + free + " | used: " + used);
                    global.logWarning("[DS] Free Space: " + free_p + "% | Used Space:" + used_p + "%");
                }
                this._updateLabels({ total, used, free, free_p, used_p });
            }
        );
    }

    on_applet_removed_from_panel() {
        if (this._timeoutId) {
            try {
                GLib.source_remove(this._timeoutId);
            } catch (e) { }
            this._timeoutId = 0;
        }

        this.settings.finalize();
    }

}

function main(metadata, orientation, panel_height, instance_id) {
    // return new CinnamonWorkspaceSwitcher(metadata, orientation, panel_height, instance_id);
    return new CinnamonDiskSpace(metadata, orientation, panel_height, instance_id);
}
