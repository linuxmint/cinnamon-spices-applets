// Imports
const Applet    = imports.ui.applet;
const GLib      = imports.gi.GLib;
const Gio       = imports.gi.Gio;
const Json      = imports.gi.Json;
const PopupMenu = imports.ui.popupMenu;
const Gettext   = imports.gettext;

const UUID = "timeshift-spy@nicog60";

const _ = (str) => {
    let translation = Gettext.gettext(str);
    if (translation !== str) {
      return translation;
    }
    return Gettext.dgettext(UUID, str);
}

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

        Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale')

        this.init_members()

        this.create_menu(orientation)

        this.set_state(IDLE)
    }

    init_members() {
        this.reload_config       = this.reload_config.bind(this)
        this.check_backup_device = this.check_backup_device.bind(this)
        this.check_if_snapping   = this.check_if_snapping.bind(this)
        this.check_if_ended      = this.check_if_ended.bind(this)
        this.update_icon         = this.update_icon.bind(this)
        this.make_snapshot       = this.make_snapshot.bind(this)

        this.menu        = null
        this.menuManager = null

        this.monitor_flags = Gio.FileMonitorFlags.SEND_MOVED +
                             Gio.FileMonitorFlags.WATCH_MOVES

        this.config_file_path = '/etc/timeshift/timeshift.json'
        this.config_file      = Gio.File.new_for_path(this.config_file_path)
        this.config_monitor   = this.config_file.monitor_file(this.monitor_flags, null)
        this.config_monitor.connect('changed', this.reload_config)

        Gio.VolumeMonitor.get().connect('mount-added',   this.check_backup_device)
        Gio.VolumeMonitor.get().connect('mount-removed', this.check_backup_device)

        this.backup_device_uuid = null
        this.snapshot_directory = null
        this.current_snapshot   = null

        this.snapshot_directory_monitor = null
        this.snapshot_directory_handler = null

        this.info_file_monitor          = null
        this.info_file_handler          = null

        this.rsync_file_monitor         = null
        this.rsync_file_handler         = null
    }

    /**
     * Create the popup menu
     */
    create_menu(orientation) {
        this.menu    = new Applet.AppletPopupMenu(this, orientation);
        let menuItem = new PopupMenu.PopupMenuItem(_('Make a new snapshot'));
        
        menuItem.connect('activate', this.make_snapshot);
        this.menu.addMenuItem(menuItem);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);
    }

    /**
     * Called when the applet icon is clicked.
     * If the state is WAIT_FOR_SNAP, which means the backup device is connected
     * and not making a snapshot, toggle a menu that shows a "make snapshot".
     */
    on_applet_clicked() {
    	if(this.state === WAIT_FOR_SNAP && !this.check_timeshift_gtk())
    		this.menu.toggle()
    }

    /**
     * Reads the backup device uuid from the Timeshift config and checks
     * if it is mounted.
     */
    reload_config() {
        this.debug('reloading config')

        this.backup_device_uuid = null

        if(this.config_file.query_exists(null)) {
            this.debug('parsing config')

        	var parser = Json.Parser.new_immutable()
        	parser.load_from_file(this.config_file_path)
        	var object = parser.get_root().get_object()

        	var uuid = object.get_string_member('backup_device_uuid')

        	if(uuid.length > 0) {
                this.debug('devide uuid found')

                this.backup_device_uuid = uuid
				this.check_backup_device()
            }
        }
    }

    /**
     * Checks if the backup device is mounted. If it is, Changes the
     * applet state to WAIT_FOR_SNAP
     */
    check_backup_device() {
        this.debug('checking backing device')

        this.snapshot_directory = null

        let [success, result] = GLib.spawn_command_line_sync('bash -c "lsblk -o UUID,MOUNTPOINT | grep ' + this.backup_device_uuid + '"')
        
        if(success) {
            this.debug('device found')

            let result_str = result.toString()
            let [uuid, mount] = result_str.split(" ")

            if(mount)
            {
                mount = mount.trim()
                let mount_point = Gio.File.new_for_path(mount)

                if(mount.length !== 0 && mount_point.query_exists(null)) {
                    this.debug('mount point found')

                    this.snapshot_directory = mount_point.get_child('timeshift')
                                                         .get_child('snapshots')
                    this.set_state(WAIT_FOR_SNAP)
                    return
                }
            }
        }

        this.set_state(IDLE)
    }

    /**
     * Once the backup device is mounted, checks if Timeshift is making
     * a snapshot. If it does, change the state to SNAPPING
     */
    check_if_snapping() {
        this.debug('checking if snapping')

        this.current_snapshot = null

        // If one of them is null, something is probably wrong. better check again
        if(this.backup_device_uuid === null || this.snapshot_directory === null) {
            this.debug('invalid member state')
            this.check_backup_device()
            return
        }

        // Handles if there is no snapshots yet.
        if(!this.snapshot_directory.query_exists(null)) {
            this.debug('snapshot directory not created yet')
            return
        }

        var is_snapping = false

        try {
            // Get all the snapshots names (and therefore dates)
            let children = this.snapshot_directory.enumerate_children('standard::name', 0, null)

            let list = []
            let snap

            while(snap = children.next_file(null))
                list.push(snap.get_name())

            if(list.length > 0) {
                list.sort((a, b) => a.localeCompare(b) < 0)

                // Now it have the latest snapshot available, checks if its date match
                // the current date. No need to check a past snapshot.
                // then checks the present of the two files that gives away the snapshot
                // process 

                let now = new Date().toISOString()

                if(now.slice(0, 10) === list[0].slice(0, 10)) {
                    let last_snap = this.snapshot_directory.get_child(list[0])

                    let info = last_snap.get_child('info.json')
                    let rsync = last_snap.get_child('rsync-log-changes')

                    if(!info.query_exists(null) && !rsync.query_exists(null)) {
                        this.debug('snapshot creataion detected')
                        this.current_snapshot = last_snap
                        is_snapping = true
                    }
                }
            }   
        }
        catch(e) {
            this.debug(e.toString())
            this.set_applet_tooltip(e.toString())
            this.set_applet_icon_name('timeshift-error')
        }
        finally {
            if(is_snapping)
                this.set_state(SNAPPING)
            else
                this.set_state(WAIT_FOR_SNAP)
        }
    }

    /**
     * Once it has detected that a snapshot is currently being made, checks
     * for the presence of the two give-away files and set the state to
     * WAIT_FOR_SNAP once they appear
     */
    check_if_ended() {
        this.debug('checking end of snapshot')

        // simple check, if that attribute is not set then there is something
        // wrong. let's go back one step for safety.
        if(this.current_snapshot === null) {
            this.debug('invalid member state')
            this.check_if_snapping()
            return
        }

        var info = this.current_snapshot.get_child('info.json')
        var rsync = this.current_snapshot.get_child('rsync-log-changes')

        if(info.query_exists(null) || rsync.query_exists(null)) {
            this.debug('end of snapshot detected')
            this.set_state(WAIT_FOR_SNAP)
        }
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
            this.debug('changing from ' +
                        this.state_to_string(this.state) +
                        ' to ' + 
                        this.state_to_string(state))

            this.leave(this.state)
            this.state = state
            this.check_menu()
            this.enter(state)
        }
    }

    /**
     * Performs all the necessary action for entering the state
     */
    enter(state) {
        switch(state) {
            case IDLE:
            this.set_applet_icon_name('timeshift-idle')
            this.reload_config()
            if(this.backup_device_uuid === null)
                this.set_applet_tooltip(_('Timeshift not configured'))
            
            if(this.snapshot_directory === null)
                this.set_applet_tooltip(_('Backup device not found'))
            break

            case WAIT_FOR_SNAP:
            this.set_applet_icon_name('timeshift-wait')
            this.set_applet_tooltip(_('Wait for snapshot to begin'))
            
            this.snapshot_directory_monitor = this.snapshot_directory.monitor_directory(this.monitor_flags, null)
            this.snapshot_directory_handler = this.snapshot_directory_monitor.connect('changed', this.check_if_snapping)

            this.check_if_snapping()
            break

            case SNAPPING:
            this.set_applet_tooltip(_('Making snapshot...'))
            
            this.info_file_monitor = this.current_snapshot.get_child('info.json').monitor_file(this.monitor_flags, null)
            this.info_file_handler = this.info_file_monitor.connect('changed', this.check_if_ended)

            this.rsync_file_monitor = this.current_snapshot.get_child('rsync-log-changes').monitor_file(this.monitor_flags, null)
            this.rsync_file_handler = this.rsync_file_monitor.connect('changed', this.check_if_ended)

            this.icon_timer = setInterval(this.update_icon, 50)
            this.check_if_ended()
            break

            default:
            break;
        }
    }

    /**
     * Performs all the necessary action for leaving the state
     */
    leave(state) {
         switch(state) {
            case IDLE:
            break
            

            case WAIT_FOR_SNAP:
            if(this.snapshot_directory_monitor) {
                this.snapshot_directory_monitor.disconnect(this.snapshot_directory_handler)
                delete this.snapshot_directory_monitor
                delete this.snapshot_directory_handler
            }
            break

            case SNAPPING:
            if(this.info_file_monitor) {
                this.info_file_monitor.disconnect(this.info_file_handler)
                delete this.info_file_monitor
                delete this.info_file_handler
            }
            if(this.rsync_file_monitor) {
                this.rsync_file_monitor.disconnect(this.rsync_file_handler)
                delete this.rsync_file_monitor
                delete this.rsync_file_handler
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
     * Ask for password, as timeshift requires root privileges, and make a new
     * snapshot.
     */
    make_snapshot() {
        let start = GLib.spawn_command_line_async('bash -c "pkexec timeshift --create"')
        if(!start)
            this.debug('Unable to start snapshot')
    }

    /**
     * Checks if the menu needs to be closed. If the backup device is not
     * connected or if a snapshot is being made, then close the menu.
     */
    check_menu() {
    	if((this.state !== WAIT_FOR_SNAP || this.check_timeshift_gtk()) && this.menu.isOpen)
    		this.menu.close()
    }

    /**
     * Checks if the timeshift GUI is open as a snapshot can't be launched with the GUI running.
     */
    check_timeshift_gtk() {
        let [success, result] = GLib.spawn_command_line_sync('bash -c "wmctrl -lx | grep timeshift-gtk.Timeshift-gtk"')
        if(result.length > 0) {
            return true
        }
        return false
    }

    state_to_string(state) {
        switch(state) {
            case IDLE:
            return 'IDLE'

            case WAIT_FOR_SNAP:
            return 'WAIT_FOR_SNAP'

            case SNAPPING:
            return 'SNAPPING'
        }
    }

    debug(msg) {
        //global.log('--> ' + msg)
    }
}





function main(metadata, orientation, panelHeight, instanceId) {
    return new TimeshiftSpy(orientation, panelHeight, instanceId);
}
