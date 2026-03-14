const UUID = "hdd-led@tucsonst";

// Cinnamon-Spices applet to simulate a HDD activity LED on the system panel.
// tucsonst - S. Tillman

const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const Util = imports.misc.util;

const TOOLTIP = _("Drive activity\n");
const DISKSTATS = "/proc/diskstats";
const DEVICE = _("Device");
const READS  = _("Reads");
const WRITES = _("Writes");
const TOTALS = _("Totals");


const to_string = function(data) {
    if (ByteArray.hasOwnProperty("toString")) {
        return "" + ByteArray.toString(data);
    }
    return "" + data.toString();
};

class HDDLEDapplet extends Applet.TextIconApplet {
   constructor(metadata, orientation, panelHeight, instance_id) {
       super(orientation, panelHeight, instance_id);

        this.set_applet_tooltip(TOOLTIP);
        this.statinfo = TOOLTIP;
        this.last_reads = 0;
        this.last_writes = 0;
        this.rows = 3; //rows of drive status for dialog box

        this._update_loop();
    }

    _get_disk_stats() {
        try {
            let [success, content] = GLib.file_get_contents(DISKSTATS);
            if (!success) return { r: 0, w: 0, ds: "" };

            let total_r = 0;
            let total_w = 0;
            let devname = "loop"; //skip the loop devices assuming at top of diskstats
            let devmap = "dm-"; //dev mapper prefix
            let devstats = `"--column=${DEVICE} --column=${READS} --column=${WRITES} "`
            let lines = to_string(content).split('\n');
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
        } catch (e) {
            return { r: 0, w: 0, ds: "" };
        }
    }

    _update_loop() {
        let stats = this._get_disk_stats();

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
        let statstip = "";
        if (stats.ds != "") {
           statstip = TOOLTIP + `${READS}: ${stats.r}\n${WRITES}: ${stats.w}`;
           this.statinfo = `${stats.ds} "${TOTALS} " "${stats.r} " "${stats.w} "`
        }
        else {
            statstip = TOOLTIP + _("Error processing ") + DISKSTATS;
            this.statinfo = _("Error processing ") + DISKSTATS;
        }
        this.set_applet_tooltip(statstip);
        
        // 100ms update time setting
        this._timer_id = Mainloop.timeout_add(100, () => {
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
