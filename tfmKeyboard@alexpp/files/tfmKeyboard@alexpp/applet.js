const Applet = imports.ui.applet
// http://developer.gnome.org/st/stable/
const St = imports.gi.St
const Gtk = imports.gi.Gtk
const GLib = imports.gi.GLib
const Settings = imports.ui.settings
const PopupMenu = imports.ui.popupMenu
const Lang = imports.lang
const Main = imports.ui.main
const MessageTray = imports.ui.messageTray
// http://developer.gnome.org/glib/unstable/glib-The-Main-Event-Loop.html
const Mainloop = imports.mainloop

const UUID = "tfmKeyboard@alexpp"
const Meta = imports.ui.appletManager.appletMeta[UUID]

GLib.chdir(Meta.path)
Gtk.IconTheme.get_default().append_search_path(Meta.path)

const CMD_INIT = '"'+Meta.path+'/init.sh"'
const CMD_NORMAL = 'xmodmap "'+Meta.path+'/normal.map"'
const CMD_DIFF = 'xmodmap "'+Meta.path+'/diff.map"'
const CMD_DIVIN = 'xmodmap "'+Meta.path+'/divin.map"'

// Multilingue
// https://github.com/linuxmint/Cinnamon/blob/master/files/usr/lib/cinnamon-json-makepot/cinnamon-json-makepot.py
// cinnamon-json-makepot -j po/tfmKeyboard@alexpp.orig.pot
// msguniq po/tfmKeyboard@alexpp.orig.pot > po/tfmKeyboard@alexpp.pot
// msginit --locale=fr --input=tfmKeyboard@alexpp.pot
// msgmerge -U fr.po tfmKeyboard@alexpp.pot
// cinnamon-json-makepot -i tfmKeyboard@alexpp
// cinnamon-json-makepot -r tfmKeyboardt@alexpp

const Gettext = imports.gettext
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
	global.log([UUID, str])
	return Gettext.dgettext(UUID, str)
}

function MyApplet(metadata, orientation, panelHeight, instanceId){
	this._init(orientation, panelHeight, instanceId)
}

MyApplet.prototype = {
	__proto__: Applet.TextIconApplet.prototype,
	FirstRun           : true,
	kb_original        : 'normal',
	label_prefix       : '',
	switch_time        : 0,
	can_record         : null,
	record_time        : 0,
	VIDEO_DIRECTORY    : '',
/*
	cw_X               : 0,
	cw_Y               : 0,
	cw_W               : 0,
	cw_H               : 0,
	*/
	H_F1               : '1',
	H_F2               : '2',
	H_F3               : '3',
	H_F4               : '4',
	H_F5               : '5',
	H_F6               : '6',
	H_F7               : '7',
	H_F8               : '8',
	H_F9               : '9',
	H_F10              : 'F10',
	H_F11              : 'F11',
	H_F12              : 'F12',

	D_F1               : '1',
	D_F2               : '2',
	D_F3               : '3',
	D_F4               : '4',
	D_F5               : '5',
	D_F6               : '6',
	D_F7               : '7',
	D_F8               : '8',
	D_F9               : '9',
	D_F10              : 'F10',
	D_F11              : 'F11',
	D_F12              : 'F12',

	USE_TEXT           : true,
	USE_ICON           : true,
	USE_MENUPOPUP      : true,
	USE_HOTKEYS        : true,
	USE_RECORD         : true,
	CMD_SWITCH         : 'divin',
	HOTKEY_SWITCH      : '<control><shift>Z',
	HOTKEY_NORMAL      : '<control><shift>N',
	HOTKEY_DIFF        : '<control><shift>H',
	HOTKEY_DIVIN       : '<control><shift>D',
	HOTKEY_RECORD      : '<control><shift>R',
	HOTKEY_RECORD_S    : '<control><alt>R',
	SWITCH_TIMEOUT     : 0,
	RECORD_TIMEOUT     : 2.5 * 60,
	RECORD_CROP_X      : 0,
	RECORD_CROP_Y      : 0,
	RECORD_CROP_W      : 0,
	RECORD_CROP_H      : 0,
	USE_FIXED_ZONE     : true,
	RECORD_FIXED_WIDTH : 800,
	RECORD_FIXED_HEIGHT: 600,
	RECORD_DIRECTORY   : "{VIDEO_DIR}",
	RECORD_FILENAME    : "screencast_%Y-%M-%D_%H:%I:%S",
	CMD_RECORD_PROGRAM : 'avconv',
//	CMD_RECORD_START   : '{PRG} -video_size {WIDTH}x{HEIGHT} -framerate 15 -f x11grab -i :0.0+{X},{Y} "{DIRECTORY}/{FILENAME}.mp4"',
	CMD_RECORD_STOP    : 'killall {PRG}',

	_init: function(orientation, panelHeight, instanceId){
		Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId)
		if (this.USE_TEXT) this.set_applet_label(_("Loading...."))
		this.set_applet_tooltip(_("Transformice keyboard configuration switch"))

		// Test de capacités
		let [res, echoed, err, status] = GLib.spawn_command_line_sync("which xmodmap")
		if (status != 0) throw UUID+': Error xmodmap not found.'

		// Détection du mode en cours (en cas de redémarrage de cinnamon)
		GLib.spawn_command_line_sync(CMD_INIT)

		// Paramètres
		this.settings = new Settings.AppletSettings(this, UUID, instanceId)

		this._Reg_Setting("USE_TEXT", this.update_label)
		this._Reg_Setting("USE_ICON", this.update_label)
		this._Reg_Setting("USE_MENUPOPUP")
		this._Reg_Setting("USE_HOTKEYS", this.on_setting_change)
		this._Reg_Setting("USE_RECORD", this.on_setting_change)

		this._Reg_Setting("CMD_SWITCH")
		this._Reg_Setting("SWITCH_TIMEOUT")
		this._Reg_Setting("RECORD_TIMEOUT")

		this._Reg_Setting("CMD_RECORD_PROGRAM", this.on_setting_change)
		this._Reg_Setting("RECORD_FILENAME")
		this._Reg_Setting("RECORD_DIRECTORY")
		this._Reg_Setting("H_F1", this.on_diff_update)
		this._Reg_Setting("H_F2", this.on_diff_update)
		this._Reg_Setting("H_F3", this.on_diff_update)
		this._Reg_Setting("H_F4", this.on_diff_update)
		this._Reg_Setting("H_F5", this.on_diff_update)
		this._Reg_Setting("H_F6", this.on_diff_update)
		this._Reg_Setting("H_F7", this.on_diff_update)
		this._Reg_Setting("H_F8", this.on_diff_update)
		this._Reg_Setting("H_F9", this.on_diff_update)
		this._Reg_Setting("H_F10", this.on_diff_update)
		this._Reg_Setting("H_F11", this.on_diff_update)
		this._Reg_Setting("H_F12", this.on_diff_update)

		this._Reg_Setting("D_F1", this.on_divin_update)
		this._Reg_Setting("D_F2", this.on_divin_update)
		this._Reg_Setting("D_F3", this.on_divin_update)
		this._Reg_Setting("D_F4", this.on_divin_update)
		this._Reg_Setting("D_F5", this.on_divin_update)
		this._Reg_Setting("D_F6", this.on_divin_update)
		this._Reg_Setting("D_F7", this.on_divin_update)
		this._Reg_Setting("D_F8", this.on_divin_update)
		this._Reg_Setting("D_F9", this.on_divin_update)
		this._Reg_Setting("D_F10", this.on_divin_update)
		this._Reg_Setting("D_F11", this.on_divin_update)
		this._Reg_Setting("D_F12", this.on_divin_update)

		this._Reg_Setting("RECORD_CROP_X")
		this._Reg_Setting("RECORD_CROP_Y")
		this._Reg_Setting("RECORD_CROP_W")
		this._Reg_Setting("RECORD_CROP_H")
		this._Reg_Setting("USE_FIXED_ZONE")
		this._Reg_Setting("RECORD_FIXED_WIDTH")
		this._Reg_Setting("RECORD_FIXED_HEIGHT")

		// Initialisation selon les paramètres
		this.VIDEO_DIRECTORY = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_VIDEOS)
		//global.screen.get_display().connect('notify::focus-window', Lang.bind(this, this._onFocusWindow));
		//this._onFocusWindow(null)

		// Menus https://git.gnome.org/browse/gnome-shell/tree/js/ui/popupMenu.js
		this.menuManager = new PopupMenu.PopupMenuManager(this)
		this.menu = new Applet.AppletPopupMenu(this, orientation)
		this.menuManager.addMenu(this.menu)
		this._contentSection = new PopupMenu.PopupMenuSection()
		this.menu.addMenuItem(this._contentSection)

		this.on_setting_change()
		this.update_all()
		this.FirstRun = false
	},

	update_all: function() {
		if (this.kb_original != "normal") {
			this.switch_time = this.SWITCH_TIMEOUT
			if (this.SWITCH_TIMEOUT != 0) this.on_switch_tick()
		} else this.switch_time = 0

		this.update_label()
		if (!this.FirstRun) this._notifyMessage(this.kb_original, this.label_prefix)

//		global.log("tfm@keyboard::update_all " + [this.kb_original, this.label_prefix, this.FirstRun])
	},

	update_label: function() {
		if (this.USE_ICON)
			this.set_applet_icon_name(this.kb_original)
		else
		// https://github.com/linuxmint/Cinnamon/wiki/API-reference-%5Bapplet.js%5D#public-methods-3
			this.hide_applet_icon()

		if (this.kb_original == "normal")
			this.label_prefix = _("Normal")
		else if (this.kb_original == "diff")
			this.label_prefix = _("Hard")
		else
			this.label_prefix = _("Divine")

		let timelbl = ""
		if (this.switch_time > 0 && this.SWITCH_TIMEOUT != 0) {
			timelbl = ""+this.switch_time
		}

		if (this.can_record) {
			if (this.record_time > 0) {
				if (timelbl == "")
					timelbl = this.record_time+"R"
				else
					timelbl = timelbl+ ' ' + this.record_time+"R"
			}
		}
		if (timelbl != "" && this.USE_TEXT)
			timelbl = ": "+timelbl

		if (this.USE_TEXT)
			this.set_applet_label(this.label_prefix + timelbl )
		else
			this.set_applet_label(timelbl)
	},

	do_record: function () {
		if (!this.can_record) {
			if (this.USE_RECORD)
				this._notifyMessage('error', _("Screencast recorder '%s' not found").format(this.CMD_RECORD_PROGRAM))
			return
		}
		//if (!this.currentwindow) return

		this.RECORD_DIRECTORY = this._filename_parse(this.RECORD_DIRECTORY)
		let cmd = "{PRG} -video_size {WIDTH}x{HEIGHT} -r 25 -f x11grab -i :0.0+{X},{Y} \"{DIRECTORY}/{FILENAME}.mp4\""

		if (this.CMD_RECORD_PROGRAM == "vlc")
			cmd = "{PRG} screen:// -I dummy --screen-left={X} --screen-top={Y} --screen-width={WIDTH} --screen-height={HEIGHT} --no-video :screen-fps=25 :screen-caching=300 --sout \"#transcode{vcodec=h264,vb=800,fps=25,scale=1,acodec=none}:duplicate{dst=std{access=file,mux=mp4,dst='{DIRECTORY}/{FILENAME}.mp4'}}\""
		cmd = this._filename_parse(cmd)

		if (this.record_time <=0 && cmd) {
			//global.log(UUID+'::do_record() '+[cmd])
			GLib.spawn_command_line_async(cmd)
		}
		this.record_time = this.RECORD_TIMEOUT
		this.on_record_tick()
		this.update_menu()
	},

	stop_record: function () {
		this.record_time = 0
		let [res, echoed, err, status] = GLib.spawn_command_line_sync(this._filename_parse(this.CMD_RECORD_STOP))
		//global.log(UUID+'::stop_record '+[res, echoed, err, status])
		this.update_menu()
	},

	on_record_tick: function() {
		Mainloop.source_remove(this.timeout_record)
		this.timeout_record = null
		this.update_label()
		if (this.record_time > 0) {
    			this.timeout_record = Mainloop.timeout_add(1000, Lang.bind(this, this.on_record_tick))
			this.record_time = this.record_time - 1
		} else
			this.stop_record()
	},

	on_switch_tick: function() {
		Mainloop.source_remove(this.timeout_switch)
		this.timeout_switch = null
		this.update_label()
		if (this.switch_time > 0) {
    			this.timeout_switch = Mainloop.timeout_add(1000, Lang.bind(this, this.on_switch_tick))
			this.switch_time = this.switch_time - 1
		} else this.on_normal()
	},

	on_normal: function(){
		if (this.timeout_switch) {
			this.switch_time = 0
			Mainloop.source_remove(this.timeout_switch)
			this.timeout_switch = null
		}
		if (this.kb_original == "normal") return
		/*let [res, echoed, err, status] = */GLib.spawn_command_line_async(CMD_NORMAL)
        	this.kb_original = "normal"
		this.update_all()
	},
	on_diff: function(){
		this.switch_time = this.SWITCH_TIMEOUT
		if (this.kb_original == "diff") return
		/*let [res, echoed, err, status] = */GLib.spawn_command_line_async(CMD_DIFF)
        	this.kb_original = "diff"
		this.update_all()
	},
	on_divin: function(){
		this.switch_time = this.SWITCH_TIMEOUT
		if (this.kb_original == "divin") return
		/*let [res, echoed, err, status] = */GLib.spawn_command_line_async(CMD_DIVIN)
        	this.kb_original = "divin"
		this.update_all()
	},
	on_switch: function(){
		if (this.kb_original == "normal") {
			if (this.CMD_SWITCH == "diff")
				/*[res, echoed, err, status] = */GLib.spawn_command_line_sync(CMD_DIFF)
			else
				/*[res, echoed, err, status] = */GLib.spawn_command_line_sync(CMD_DIVIN)
	        this.kb_original = this.CMD_SWITCH // echoed.toString().split("\n")[0]
		} else {
	        this.switch_time = 0
			/*[res, echoed, err, status] = */GLib.spawn_command_line_async(CMD_NORMAL)
	        this.kb_original = "normal"
		}
		this.update_all()
	},

	on_setting_change: function () {

		let [res, echoed, err, status] = GLib.spawn_command_line_sync(this._filename_parse("which {PRG}"))
		this.can_record = (status == 0) && this.USE_RECORD
		if (this.record_time != 0 && !this.FirstRun) this.stop_record()
		//global.log(UUID+'::on_setting_change '+ [this._filename_parse("which {PRG}"), this.can_record, this.USE_RECORD])

		if (this.USE_HOTKEYS) {
			Main.keybindingManager.addHotKey('tfm-switch', this.HOTKEY_SWITCH, Lang.bind(this, this.on_switch))
			Main.keybindingManager.addHotKey('tfm-normal', this.HOTKEY_NORMAL, Lang.bind(this, this.on_normal))
			Main.keybindingManager.addHotKey('tfm-diff'  , this.HOTKEY_DIFF  , Lang.bind(this, this.on_diff))
			Main.keybindingManager.addHotKey('tfm-divin' , this.HOTKEY_DIVIN , Lang.bind(this, this.on_divin))
		} else {
			Main.keybindingManager.removeHotKey('tfm-switch')
			Main.keybindingManager.removeHotKey('tfm-normal')
			Main.keybindingManager.removeHotKey('tfm-diff')
			Main.keybindingManager.removeHotKey('tfm-divin')
		}

		//if (this.can_record && this.USE_HOTKEYS) {
			Main.keybindingManager.addHotKey('tfm-record', this.HOTKEY_RECORD, Lang.bind(this, this.do_record))
			Main.keybindingManager.addHotKey('tfm-record-S', this.HOTKEY_RECORD_S, Lang.bind(this, function(){
				this.record_time = 0
				this.on_record_tick();
			}))
		/*} else {
			Main.keybindingManager.removeHotKey('tfm-record')
			Main.keybindingManager.removeHotKey('tfm-record-S')
		}*/

		this.update_menu()
	},

	update_menu: function() {
		this.menu.removeAll()

		this.menu.addAction(_("Switch normal / prefered mode"),	Lang.bind(this, this.on_switch))
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem())
		this.menu.addAction(_("Normal"),				Lang.bind(this, this.on_normal))
		this.menu.addAction(_("Hard"),				Lang.bind(this, this.on_diff))
		this.menu.addAction(_("Divine"),				Lang.bind(this, this.on_divin))
		if (this.can_record) {
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem())
			if (this.record_time)
				this.menu.addAction(_("Stop recording"),				Lang.bind(this, this.stop_record))
			else
				this.menu.addAction(_("Start recording"),				Lang.bind(this, this.do_record))
		}
	},

	on_diff_update: function () {
		let cmd ='"'+Meta.path+'/genmap.sh" diff '+this.H_F1+" "+this.H_F2+" "+this.H_F3+" "+this.H_F4+" "+this.H_F5+" "+this.H_F6+" "+this.H_F7+" "+this.H_F8+" "+this.H_F9+" "+this.H_F10+" "+this.H_F11+" "+this.H_F12
		let [res, echoed, err, status] = GLib.spawn_command_line_sync(cmd)
		global.log(UUID+'::on_diff_update'+[cmd, res, echoed, err, status])

		if (this.kb_original == "diff") GLib.spawn_command_line_async(CMD_DIFF)
	},
	on_divin_update: function () {
		let cmd ='"'+Meta.path+'/genmap.sh" divin '+this.D_F1+" "+this.D_F2+" "+this.D_F3+" "+this.D_F4+" "+this.D_F5+" "+this.D_F6+" "+this.D_F7+" "+this.D_F8+" "+this.D_F9+" "+this.D_F10+" "+this.D_F11+" "+this.D_F12
		let [res, echoed, err, status] = GLib.spawn_command_line_sync(cmd)
		global.log(UUID+'::on_divin_update'+[cmd, res, echoed, err, status])

		if (this.kb_original == "divin") GLib.spawn_command_line_async(CMD_DIVIN)
	},

	_Reg_Setting_O: function (key) {
		this.settings.bindProperty(Settings.BindingDirection.OUT,// Setting type
			key,				// The setting key
			key,				// The property to manage (this.width)
			null,			// Callback when value changes
			null)			// Optional callback data
	},
	_Reg_Setting: function (key, callback, callback_data) {
		this.settings.bindProperty(Settings.BindingDirection.IN,// Setting type
			key,				// The setting key
			key,				// The property to manage (this.width)
			callback,			// Callback when value changes
			callback_data)			// Optional callback data
	},

	_padNum: function(num) { return (num < 10 ? '0' + num : num); },
	_filename_parse: function( file ) {
		let date = new Date();
		//let width =
		let monitor = Main.layoutManager.primaryMonitor

		let replacements = {
			'%Y': date.getFullYear(),
			'%M': this._padNum(date.getMonth() + 1),
			'%D': this._padNum(date.getDate()),
			'%H': this._padNum(date.getHours()),
			'%I': this._padNum(date.getMinutes()),
			'%S': this._padNum(date.getSeconds()),
			'%m': this._padNum(date.getMilliseconds()),
			'{X}': monitor.x + /*this.cw_X +*/ this.RECORD_CROP_X,
			'{Y}': monitor.y + /*this.cw_Y +*/ this.RECORD_CROP_Y,
			'{WIDTH}':  this.USE_FIXED_ZONE ? this.RECORD_FIXED_WIDTH : monitor.width - this.RECORD_CROP_X - this.RECORD_CROP_W,
			'{HEIGHT}': this.USE_FIXED_ZONE ? this.RECORD_FIXED_HEIGHT : monitor.height - this.RECORD_CROP_Y - this.RECORD_CROP_H,
			'{VIDEO_DIR}': this.VIDEO_DIRECTORY,
			'{DIRECTORY}': this.RECORD_DIRECTORY,
			'{FILENAME}': this._get_filename(),
			'{PRG}': this.CMD_RECORD_PROGRAM,
		};

		// FIX [libx264 @ 0xa1e6a0] height not divisible by 2 (1280x899)
		// Error while opening encoder for output stream #0:0 - maybe incorrect parameters such as bit_rate, rate, width or height
		if (replacements['{WIDTH}'] % 2 == 1) replacements['{WIDTH}']--
		if (replacements['{HEIGHT}'] % 2 == 1) replacements['{HEIGHT}']--

		for (var k in replacements) {
			file = file.replace(k, replacements[k])
		}
		return file
	},

	_get_filename: function () {
		let filename = this.RECORD_FILENAME
		let date = new Date();
		let replacements = {
			'%Y': date.getFullYear(),
			'%M': this._padNum(date.getMonth() + 1),
			'%D': this._padNum(date.getDate()),
			'%H': this._padNum(date.getHours()),
			'%I': this._padNum(date.getMinutes()),
			'%S': this._padNum(date.getSeconds()),
			'%m': this._padNum(date.getMilliseconds()),
		};

		for (var k in replacements) {
			filename = filename.replace(k, replacements[k])
		}
		return filename
	},

	_ensureSource: function() {
		if (!this._source) {
			this._source = new MessageTray.Source()
			this._source.connect('destroy', Lang.bind(this, function() {this._source = null;}))
			if (Main.messageTray) Main.messageTray.add(this._source)
		}
	},

	_notifyMessage: function(iconName, text) {
		Mainloop.source_remove(this.timeoutId)
		if (this._notification)
			this._notification.destroy()

		this._ensureSource()

		let icon = new St.Icon({ icon_name: iconName,
					 icon_type: St.IconType.FULLCOLOR,
					 icon_size: this._source.ICON_SIZE
					})
		this._notification = new MessageTray.Notification(this._source, _("Transformice"), text, { icon: icon })
		this._notification.setUrgency(MessageTray.Urgency.NORMAL)
		this._notification.setTransient(true)
		this._notification.connect('destroy', function() {this._notification = null;})
		this._source.notify(this._notification)

		this.timeoutId = Mainloop.timeout_add(5500, Lang.bind(this, function() {
			//global.log("tfm@keyboard::timeout")
			if (this._notification)
				this._notification.destroy()
			Mainloop.source_remove(this.timeoutId)
			}))
	},

/*/REMOVED global.get_window_actors()

global.get_window_actors()[0].get_size()
global.get_window_actors()[0].get_position()
global.get_window_actors()[0].get_meta_window().get_layer()
global.get_window_actors()[0].meta_window.get_wm_class()
global.get_window_actors()[0].meta_window.get_title() == "Mozilla Firefox"

avconv -video_size 1024x768 -framerate 15 -f x11grab -i :0.0+100,200 output.mp4

//* /
	_onFocusWindow: function(display) {
		try {
			this._windows = global.get_window_actors()
			this._windows.forEach(Lang.bind(this, function (w){
				if (w.meta_window.has_focus())
				    this.currentwindow = w
				return w.meta_window.has_focus()
			}))
		} catch (e) {
			global.log([UUID, e])
		}

		if (this.currentwindow) {
			this.cw_X = this.currentwindow.get_position()[0]
			this.cw_Y = this.currentwindow.get_position()[1]
			this.cw_W = this.currentwindow.get_size()[0]
			this.cw_H = this.currentwindow.get_size()[1]
		} else
			global.log("ERROR "+[UUID, 'onFocusWindow'])
	},//*/

	on_applet_removed_from_panel: function() {
		this.settings.finalize();
		Mainloop.source_remove(this.timeoutId)
		this.on_normal()
		this.stop_record()
		//*let [res, echoed, err, status] = */GLib.spawn_command_line_sync('bash -c "rm *.map"')
		//global.log(UUID+'::on_applet_removed_from_panel'+[res, echoed, err, status])
	},

	//  applet click event
	on_applet_clicked: function(event){
		if (this.USE_MENUPOPUP)
			this.menu.toggle()
		else
			this.on_switch()
	}
}

function main(metadata, orientation, panelHeight, instanceId){
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instanceId)
    return myApplet
}
