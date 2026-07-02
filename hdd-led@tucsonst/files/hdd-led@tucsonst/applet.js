const UUID = "hdd-led@tucsonst";

// Cinnamon-Spices applet to simulate a HDD activity LED on the system panel.
// tucsonst - S. Tillman
// Derived from storage-act-led@mrbartblog (GPLv3), used and redistributed
// under the same license.

const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const decoder = new TextDecoder("utf-8");

// Fixed pixel widths for the popup's Device / Reads / Writes columns.
// Real widget widths, rather than space-padded text, so alignment doesn't
// depend on the menu font being monospaced.
const COL_WIDTH_NAME = 110;
const COL_WIDTH_NUM = 70;

const UPDATE_RATE_MS = 100;         // 100ms update time setting
const TOOLTIP = _("Drive activity\n");
const DISKSTATS = "/proc/diskstats";
const DEVICE = _("Device");
const READS  = _("Reads");
const WRITES = _("Writes");
const TOTALS = _("Totals");
const ERROR_MSG = _("Error processing ") + DISKSTATS;


class HDDLEDapplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);

        Gio._promisify(Gio.File.prototype, 'load_contents_async', 'load_contents_finish');
        this.set_applet_tooltip(TOOLTIP);
        this.last_reads = 0;
        this.last_writes = 0;
        this.deviceStats = [];      // per-device {name, reads, writes}
        this.totalStats = null;     // {reads, writes} or null on error

        this.set_applet_icon_name("idle");

        // Popup menu shown on click, built fresh each time from current stats.
        // NOTE: must use Applet.AppletPopupMenu (not the generic PopupMenu.PopupMenu)
        // - it's the subclass that knows how to attach to an applet's actor and
        // position its arrow against the panel. The generic class won't display
        // at all when used directly on an Applet.
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._update_loop();
    }

    async _getFileContent(file) {
        try {
            // Returns an array: [contents, etag]
            const [contents] = await file.load_contents_async(null);

            // 'contents' is a Uint8Array; convert it to a string if needed
            const text = decoder.decode(contents);
            return text;
        } catch (e) {
            logError(e, 'Failed to load file');
            return "";
        }
    }

    async _get_disk_stats() {
        let total_r = 0;
        let total_w = 0;
        let devices = [];

        let file = Gio.file_new_for_path(DISKSTATS);

        let content = await this._getFileContent(file);
        if (content == "") return { r: 0, w: 0, devices: [], ok: false }; // file read was unsuccessful

        let devname_prefix = "loop"; // skip loop devices
        let devmap_prefix = "dm-";   // dev mapper prefix
        let lines = content.split('\n');

        for (let line of lines) {
            let parts = line.trim().split(/\s+/);
            if (parts.length >= 7 && !(parts[2].startsWith(devname_prefix)
                || parts[2].startsWith(devmap_prefix))) { // Only count disks, skip partitions/dev mappers
                let reads = parseInt(parts[3]);
                let writes = parseInt(parts[7]);
                total_r += reads;
                total_w += writes;
                devices.push({ name: parts[2].trim(), reads: reads, writes: writes });
            }
        }
        return { r: total_r, w: total_w, devices: devices, ok: true };
    }

    async _update_loop() {
        let stats = await this._get_disk_stats();
        let has_read = stats.r > this.last_reads;
        let has_write = stats.w > this.last_writes;

        if (has_read && has_write) {
            this.set_applet_icon_name("both");
        } else if (has_read) {
            this.set_applet_icon_name("read");
        } else if (has_write) {
            this.set_applet_icon_name("write");
        } else {
            this.set_applet_icon_name("idle");
        }
        this.last_reads = stats.r;
        this.last_writes = stats.w;

        if (stats.ok) {
            this.deviceStats = stats.devices;
            this.totalStats = { reads: stats.r, writes: stats.w };
            this.set_applet_tooltip(TOOLTIP + `${READS}: ${stats.r}\n${WRITES}: ${stats.w}`);
        } else {
            this.deviceStats = [];
            this.totalStats = null;
            this.set_applet_tooltip(TOOLTIP + ERROR_MSG);
        }

        this._timer_id = Mainloop.timeout_add(UPDATE_RATE_MS, () => {
            this._update_loop();
            return false;
        });
    }

    // Builds one menu row as three separately-widthed St.Label columns inside
    // a non-reactive PopupBaseMenuItem, so numbers line up regardless of the
    // theme's menu font (proportional fonts break simple space-padding).
    _addStatsRow(name, reads, writes, bold) {
        let item = new PopupMenu.PopupBaseMenuItem({ reactive: false });

        let nameLabel = new St.Label({ text: String(name) });
        nameLabel.set_style(`width: ${COL_WIDTH_NAME}px;` + (bold ? " font-weight: bold;" : ""));

        let readsLabel = new St.Label({ text: String(reads) });
        readsLabel.set_style(`width: ${COL_WIDTH_NUM}px; text-align: right;` + (bold ? " font-weight: bold;" : ""));

        let writesLabel = new St.Label({ text: String(writes) });
        writesLabel.set_style(`width: ${COL_WIDTH_NUM}px; text-align: right;` + (bold ? " font-weight: bold;" : ""));

        item.addActor(nameLabel);
        item.addActor(readsLabel);
        item.addActor(writesLabel);
        this.menu.addMenuItem(item);
    }

    _buildStatsMenu() {
        this.menu.removeAll();

        if (!this.totalStats) {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(ERROR_MSG, { reactive: false }));
            return;
        }

        this._addStatsRow(DEVICE, READS, WRITES, true);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        for (let dev of this.deviceStats) {
            this._addStatsRow(dev.name, dev.reads, dev.writes, false);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addStatsRow(TOTALS, this.totalStats.reads, this.totalStats.writes, true);
    }

    on_applet_clicked() {
        this._buildStatsMenu();
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        if (this._timer_id) {
            Mainloop.source_remove(this._timer_id);
        }
    }
}

function main(metadata, orientation, panelHeight, instance_id) {
    return new HDDLEDapplet(metadata, orientation, panelHeight, instance_id);
}
