const UUID = "hdd-led@tucsonst";

// Cinnamon-Spices applet to simulate a HDD activity LED on the system panel.
// tucsonst - S. Tillman

const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const decoder = new TextDecoder("utf-8");
const Util = imports.misc.util;

const UPDATE_RATE_MS = 100;         // 100ms update time setting
const TOOLTIP = _("Drive activity\n");
const DISKSTATS = "/proc/diskstats";
const DEVICE = _("Device");
const READS  = _("Reads");
const WRITES = _("Writes");
const TOTALS = _("Totals");


class HDDLEDapplet extends Applet.TextIconApplet {
   constructor(metadata, orientation, panelHeight, instance_id) {
       super(orientation, panelHeight, instance_id);

        Gio._promisify(Gio.File.prototype, 'load_contents_async', 'load_contents_finish');        
        this.set_applet_tooltip(TOOLTIP);
        this.statinfo = TOOLTIP;
        this.last_reads = 0;
        this.last_writes = 0;
        this.rows = 3; //rows of drive status for dialog box
        this.set_applet_icon_name("idle");
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
        let devstats = "";

        let file = Gio.file_new_for_path(DISKSTATS);

        let content = await this._getFileContent(file);
        if (content == "") return {r: 0, W: 0, ds: ""};  //file read was unsuccessful 

        let devname = "loop"; //skip the loop devices assuming these are first entries in diskstats
        let devmap = "dm-"; //dev mapper prefix
        devstats = `"--column=${DEVICE} --column=${READS} --column=${WRITES} "`;
        let lines = content.split('\n');
        this.rows = 0;

        for (let line of lines) {
            let parts = line.trim().split(/\s+/);
            if (parts.length >= 7 && !(parts[2].startsWith(devname) 
            || parts[2].startsWith(devmap))) { //Only count the disks, skipping partitions and dev mappers
                total_r += parseInt(parts[3]);
                total_w += parseInt(parts[7]);
                devname = parts[2].trim();
                devstats += `"${devname} " "${parts[3]} " "${parts[7]} "`
                this.rows += 1;
            }
        }
        return { r: total_r, w: total_w, ds: devstats };
        
    }


    async _update_loop() {
        this.stats = await this._get_disk_stats();
        let has_read = this.stats.r > this.last_reads;
        let has_write = this.stats.w > this.last_writes;

        if (has_read && has_write) {
            this.set_applet_icon_name("both");
        } else if (has_read) {
            this.set_applet_icon_name("read");
        } else if (has_write) {
            this.set_applet_icon_name("write");
        } else {
            this.set_applet_icon_name("idle");
        }
        this.last_reads = this.stats.r;
        this.last_writes = this.stats.w;
        let statstip = "";
        if (this.stats.ds != "") {
        statstip = TOOLTIP + `${READS}: ${this.stats.r}\n${WRITES}: ${this.stats.w}`;
        this.statinfo = `${this.stats.ds} "${TOTALS} " "${this.stats.r} " "${this.stats.w} "`
        }
        else {
            statstip = TOOLTIP + _("Error processing ") + DISKSTATS;
            this.statinfo = _("Error processing ") + DISKSTATS;
        }
        this.set_applet_tooltip(statstip);
        this._timer_id = Mainloop.timeout_add(UPDATE_RATE_MS, () => {
            this._update_loop();
            return false;
        });
    }

    on_applet_removed_from_panel() {
        if (this._timer_id) {
            Mainloop.source_remove(this._timer_id);
        }
    }

    on_applet_clicked() {
        let height = (this.rows+3) * 20 + 120; //rows of output x pixels/row + margin
        const width = 3 * 15 * 10 // columns x avg chars/column x pixels/char
        let cmd = "";
        if (this.statinfo.startsWith(_("Error"))) {
            cmd = `zenity --error --title=${UUID} --text="${this.statinfo}"`; 
        }
        else {
            cmd = `zenity --list --title=${UUID} --height=${height} --width=${width} --text="Drive Activity" "${this.statinfo}"`;
        }
        Util.spawnCommandLine(cmd) ;
    }

}

function main(metadata, orientation, panelHeight, instance_id) {
    return new HDDLEDapplet(metadata, orientation, panelHeight, instance_id);
}
