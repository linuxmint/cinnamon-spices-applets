
/*
 * Simple Disk LED
 * A small Cinnamon panel applet that indicates disk activity.
 *
 * Author: Chat GPit
 *
 * The applet samples Linux /proc/diskstats every 200 milliseconds.
 * If the cumulative read/write sector counters of any supported whole
 * disk change between samples, the LED is shown in green for that sample.
 */

const Clutter = imports.gi.Clutter;
const Applet = imports.ui.applet;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const Mainloop = imports.mainloop;

class SimpleDiskLED extends Applet.Applet {

    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        // The previous counter value is used to detect activity between
        // two samples. null means that no initial sample has been taken yet.
        this._lastActivity = null;
        this._timer = null;
        this._readInProgress = false;
        this._removed = false;

        // Create a Gio.File object for the disk statistics.
        this._diskStatsFile = Gio.File.new_for_path("/proc/diskstats");

        // Create the small, initially dark indicator shown in the panel.
        this._led = new St.Widget({
            reactive: false,
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'min-width: 16px; max-width: 16px; ' +
                   'min-height: 10px; max-height: 10px; ' +
                   'background-color: #202020; ' +
                   'border: 1px solid #555555; ' +
                   'border-radius: 1px;'
        });

        this._led.set_size(16, 10);
        this.actor.add_child(this._led);

        this.set_applet_tooltip("Disk activity");

        // Poll disk statistics five times per second.
        // Returning true keeps the GLib timeout active until removal.
        this._timer = Mainloop.timeout_add(200, () => {
            this._checkActivity();
            return true;
        });
    }

    /*
     * Parse cumulative disk I/O counters from /proc/diskstats.
     *
     * The fields used here are:
     *   fields[2]  device name
     *   fields[5]  sectors read
     *   fields[9]  sectors written
     *
     * Only whole disks are included; partition entries are ignored.
     */
    _parseDiskStats(contents) {
        let total = 0;

        for (let line of contents.split("\n")) {
            let fields = line.trim().split(/\s+/);

            if (fields.length < 10)
                continue;

            let device = fields[2];

            // Match whole disks, not their numbered partitions.
            // Supported naming schemes:
            //   sd*/hd*   traditional SCSI/IDE-style names
            //   vd*/xvd*  virtual disks
            //   nvme*n*   NVMe namespaces
            //   mmcblk*   eMMC/SD block devices
            if (!/^(sd[a-z]+|hd[a-z]+|vd[a-z]+|xvd[a-z]+|nvme\d+n\d+|mmcblk\d+)$/.test(device))
                continue;

            total += Number(fields[5]); // sectors read
            total += Number(fields[9]); // sectors written
        }

        return total;
    }

    /*
     * Start an asynchronous read of /proc/diskstats.
     *
     * The readInProgress flag prevents overlapping requests.
     * The callback is ignored if the applet has been removed.
     */
    _checkActivity() {
        if (this._readInProgress || this._removed)
            return;

        this._readInProgress = true;

        this._diskStatsFile.load_contents_async(null, (file, result) => {
            this._readInProgress = false;

            if (this._removed)
                return;

            try {
                let [success, contents] =
                    file.load_contents_finish(result);

                if (!success)
                    return;

                let text = ByteArray.toString(contents);
                let current = this._parseDiskStats(text);

                this._updateActivity(current);

            } catch (e) {
                // A read/parse error should not break the applet's timer.
            }
        });
    }

    /*
     * Compare the current counters with the previous sample and update
     * the indicator. Any change means that at least one monitored disk
     * performed read or write activity during the sampling interval.
     */
    _updateActivity(current) {
        // The first successful sample establishes a baseline only.
        if (this._lastActivity !== null &&
            current !== this._lastActivity) {

            this._led.set_style(
                'background-color: #20d34b; ' +
                'border: 1px solid #555555; ' +
                'border-radius: 1px;'
            );

        } else {
            this._led.set_style(
                'background-color: #202020; ' +
                'border: 1px solid #555555; ' +
                'border-radius: 1px;'
            );
        }

        this._lastActivity = current;
    }

    /*
     * Stop the periodic callback when Cinnamon removes the applet.
     * Any outstanding asynchronous callback will then be ignored.
     */
    on_applet_removed_from_panel() {
        this._removed = true;

        if (this._timer !== null) {
            Mainloop.source_remove(this._timer);
            this._timer = null;
        }
    }
}

// Cinnamon calls main() when it creates an applet instance.
function main(metadata, orientation, panelHeight, instanceId) {
    return new SimpleDiskLED(
        metadata, orientation, panelHeight, instanceId
    );
}
