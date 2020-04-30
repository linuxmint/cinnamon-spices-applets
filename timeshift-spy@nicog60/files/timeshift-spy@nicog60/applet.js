// Imports
const Applet    = imports.ui.applet;
const GLib      = imports.gi.GLib;
const Gio       = imports.gi.Gio;
const Json      = imports.gi.Json;
const PopupMenu = imports.ui.popupMenu;
const Gettext   = imports.gettext;

// Get text boilerplate
Gettext.textdomain("timeshift-spy@nicog60");
Gettext.bindtextdomain("timeshift-spy@nicog60n", GLib.get_home_dir() + '/.local/share/locale');

const _ = Gettext.gettext;

/**
 * This applet aim to quickly display de status of Timeshift, even if it is
 * making a snapshot in the background. This can help beginners to understand
 * why they are unable to unplug their hard drive safetly and why the Timeshift
 * GUI refuse to start saying another instance is running.
 *
 * It does so by reading the Timeshift config to get the backup device UUID,
 * then checks if the device is plugged and mouted.
 * then look into the snapshot directory and get the latest snapshot that match
 * the current date.
 * then checks for the existence of 2 files within the snapshot directory:
 * - 'info.json' which summarise the snapshot and tells timeshift it is a
 *   valid one.
 * - 'rsync-log-changes' which summarise what changed in the current snapshot
 * 
 * If a snapshot directory is named after the current date and those 2 files are
 * missing, it means Timeshift and rsync are working on a snapshot.
 */

/**
 * Constants representing the state of the applet
 */
const IDLE          = 0 /**< The applet is waiting for the backup device to be
                             connected and mounted */
const WAIT_FOR_SNAP = 1 /**< The backup device is mounted, the applet is waiting
                             for Timeshifth to start a new snapshot */
const SNAPPING      = 2 /**< Timeshift is currently operating */

/**
 * This is the applet main (and unique) class
 */
class TimeshiftSpy extends Applet.IconApplet {
    /**
     * Initialises the Applet
     */
    constructor(orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId)
        
        // Some bindings
        this.reload_config = this.reload_config.bind(this)
        this.check_if_snapping = this.check_if_snapping.bind(this)
        this.check_if_ended = this.check_if_ended.bind(this)
        this.update_icon = this.update_icon.bind(this)
        this.make_snapshot = this.make_snapshot.bind(this)

        // Create the menu
        this.menu = new Applet.AppletPopupMenu(this, orientation)
        let menuItem = new PopupMenu.PopupMenuItem(_('Make a new snapshot'))
        menuItem.connect('activate', () => this.make_snapshot())
        this.menu.addMenuItem(menuItem)

    	this.menuManager = new PopupMenu.PopupMenuManager(this);
    	this.menuManager.addMenu(this.menu);

        // Set the initial state to IDLE.
        this.set_state(IDLE)

        // Connects some signal to avoid polling constantly.
        // We'll get notified when a device is mounted
        Gio.VolumeMonitor.get().connect('mount-added', (v) => this.check_backup_device() )
        Gio.VolumeMonitor.get().connect('mount-removed', (v) => this.check_backup_device() )
    }

    /**
     * Called when the applet icon is clicked.
     * If the state is WAIT_FOR_SNAP, which means the backup device is connected
     * and not making a snapshot, toggle a menu that shows a "make snapshot".
     */
    on_applet_clicked() {
    	if(this.state === WAIT_FOR_SNAP)
    		this.menu.toggle()
    }

    /**
     * Reads the backup device uuid from the Timeshift config and checks
     * if it is mounted.
     */
    reload_config() {
        var old_uuid = this.backup_device_uuid

        var parser = Json.Parser.new_immutable()
        parser.load_from_file('/etc/timeshift.json')
        var object = parser.get_root().get_object()

        this.backup_device_uuid = object.get_string_member('backup_device_uuid')

        this.check_backup_device()
    }

    /**
     * Checks if the backup device is mounted. If it is, Changes the
     * applet state to WAIT_FOR_SNAP
     */
    check_backup_device() {
        var v_list = Gio.VolumeMonitor.get().get_volumes()

        var found = v_list.some(v => {
            let uuid = v.get_uuid()
            let mount = v.get_mount();

            if(uuid === this.backup_device_uuid && mount !== null)
                return true
            else
                return false
        })

        if(found)
            this.set_state(WAIT_FOR_SNAP)
        else
            this.set_state(IDLE)
    }

    /**
     * Once the backup device is mounted, checks if Timeshift is making
     * a snapshot. If it does, change the state to SNAPPING
     */
    check_if_snapping() {
        delete this.current

        // retrieve the moun point. If it fails to get it, check if the backup
        // device is there again and update the state.

        // Get the volume
        var v = Gio.VolumeMonitor.get().get_volume_for_uuid(this.backup_device_uuid)

        if(v === null) {
            this.check_backup_device()
            return
        }

        // Get the mount point
        var m = v.get_mount()

        if(m === null) {
            this.check_backup_device()
            return
        }

        // Go down the rabbit hole from teh mount point. Navigate in the
        // snapshots directory, then get the list of all the snapshots, order
        // them to have the latest first

        // Go to the snapshot dir
        var f = m.get_root()

        if(f === null)
            return

        f = f.get_child('timeshift').get_child('snapshots')

        // Get all the snapshots names (and therefore dates)
        var e = f.enumerate_children('standard::name', 0, null)

        var list = []
        var snap

        while(snap = e.next_file(null))
            list.push(snap.get_name())

        if(list.length === 0)
            return

        list.sort((a, b) => a.localeCompare(b) < 0)

        // Now it have the latest snapshot available, checks if its date match
        // the current date. No need to check a past snapshot.
        // then checks the present of the two files that gives away the snapshot
        // process 

        var now = new Date().toISOString()

        if(now.slice(0, 10) !== list[0].slice(0, 10))
            return

        f = f.get_child(list[0])

        this.current = f.get_path()

        var info = f.get_child('info.json')
        var rsync = f.get_child('rsync-log-changes')

        if(!info.query_exists(null) && !rsync.query_exists(null))
            this.set_state(SNAPPING)
    }

    /**
     * Once it has detected that a snapshot is currently being made, checks
     * for the presence of the two give-away files and set the state to
     * WAIT_FOR_SNAP once they appear
     */
    check_if_ended() {
        // simple check, if that attribute is not set then there is something
        // wrong. let's go back one step for safety.
        if(!this.current) {
            check_if_snapping()
            return
        }

        var f = Gio.File.new_for_path(this.current)

        var info = f.get_child('info.json')
        var rsync = f.get_child('rsync-log-changes')

        if(info.query_exists(null) || rsync.query_exists(null))
            this.set_state(WAIT_FOR_SNAP)
    }

    /**
     * Updates the applet icon one step further with that nice spinning arrows.
     */
    update_icon() {
        if(!this.icon || this.icon > 11)
            this.icon = 0

        this.set_applet_icon_name('timeshift-snap-' + this.icon.toString())
        this.icon++
    }

    /**
     * The the current state of the applet
     */
    set_state(state) {
        if(this.state !== state)
        {
            this.state = state
            this.clear_all()
            this.check_menu()
            this.start(state)
        }
    }

    /**
     * Stops the timer(s) associated with the given state
     */
    clear(state) {
        switch(state) {
            case IDLE:
            if(this.idle_timer) {
                clearInterval(this.idle_timer)
                delete this.idle_timer
            }
            break
            

            case WAIT_FOR_SNAP:
            if(this.wait_timer) {
                clearInterval(this.wait_timer)
                delete this.wait_timer
            }
            break

            case SNAPPING:
            if(this.snap_timer) {
                clearInterval(this.snap_timer)
                delete this.snap_timer
            }
            if(this.icon_timer) {
                clearInterval(this.icon_timer)
                delete this.icon_timer
            }
            break

            default:
            break
        }
    }

    /**
     * Clears all the timers
     */
    clear_all() {
        this.clear(IDLE)
        this.clear(WAIT_FOR_SNAP)
        this.clear(SNAPPING)
    }

    /**
     * Starts the timer(s) for the given state and update icons and tootips.
     * In order to save resources, timers are quite long when the applet is
     * waiting for something. not a big deal if the icons updates 1 or 2 secs
     * after the snapshot actually starts.
     */
    start(state) {
        switch(state) {
            case IDLE:
            this.set_applet_icon_name('timeshift-idle')
            this.set_applet_tooltip(_('Backup device not found'))
            this.idle_timer = setInterval(this.reload_config, 60000)
            this.reload_config()
            break

            case WAIT_FOR_SNAP:
            this.set_applet_icon_name('timeshift-wait')
            this.set_applet_tooltip(_('Wait for snapshot to begin'))
            this.wait_timer = setInterval(this.check_if_snapping, 1000)
            this.check_if_snapping()
            break

            case SNAPPING:
            this.set_applet_tooltip(_('Making snapshot...'))
            this.snap_timer = setInterval(this.check_if_ended, 500)
            this.check_if_ended()
            this.icon_timer = setInterval(this.update_icon, 50)
            break
        }
    }

    /**
     * Ask for password, as timeshift requires root privileges, and make a new
     * snapshot.
     */
    make_snapshot() {
    	GLib.spawn_command_line_async('pkexec timeshift --create')
    }

    /**
     * Checks if the menu needs to be closed. If the backup device is not
     * connected or if a snapshot is being made, then close the menu.
     */
    check_menu() {
    	if(this.state !== WAIT_FOR_SNAP && this.menu.isOpen)
    		this.menu.close()
    }
}





function main(metadata, orientation, panelHeight, instanceId) {
    return new TimeshiftSpy(orientation, panelHeight, instanceId);
}
