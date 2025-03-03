
const Applet = imports.ui.applet;
const Extension = imports.ui.extension;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Util = imports.misc.util;
const { to_string } = require("./lib/to-string");
const {
  _sourceIds,
  timeout_add_seconds,
  timeout_add,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  source_exists,
  source_remove,
  remove_all_sources
} = require("./lib/mainloopTools");

const UUID = 'Bps@claudiux';
const HOME_DIR = GLib.get_home_dir();
const APPLET_DIR = `${HOME_DIR}/.local/share/cinnamon/applets/${UUID}`;
const ICONS_DIR = `${APPLET_DIR}/icons`;
const ICON_DOWNLOAD = `${ICONS_DIR}/download-symbolic.svg`;
const ICON_UPLOAD = `${ICONS_DIR}/upload-symbolic.svg`;
const ICON_FORBIDDEN = `${ICONS_DIR}/forbidden-symbolic.svg`;
const SCRIPTS_DIR = `${APPLET_DIR}/scripts`;
const DATA_SCRIPT = `${SCRIPTS_DIR}/get-network-data.sh`;
const UNPLUGGED_SCRIPT = `${SCRIPTS_DIR}/unplugged-network-devices.sh`;

const AppletGui = require('./lib/appletGui');

const _KI = Math.pow(2, 10);
const _MI = Math.pow(2, 20);
const _GI = Math.pow(2, 30);
const _TI = Math.pow(2, 40);

const _P3 = 10**3;
const _P6 = 10**6;
const _P9 = 10**9;
const _P12 = 10**12;

const DECIMAL_MULTIPLE = {
    "k": _P3,
    "M": _P6,
    "G": _P9,
    "T": _P12,
    "1": 1
}

const BINARY_MULTIPLE = {
    "k": _KI,
    "M": _MI,
    "G": _GI,
    "T": _TI,
    "1": 1
}

function _(str) {
    return Gettext.dgettext(UUID, str);
}

class Bps extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.orientation = orientation;
        this.instanceId = instance_id;
        this.applet_version = metadata.version;
        this.applet_name = metadata.name;

        this.setAllowedLayout(Applet.AllowedLayout.HORIZONTAL);

        if (this.is_vertical) {
            this.set_applet_tooltip(_(this.applet_name) + "\n<b>" + _("Does not work on vertical panel!") + "</b>", true);
            this.is_running = false;
        } else {
            this.set_applet_tooltip(_(this.applet_name));
            this.is_running = true;
        }

        this.renewInterfacesId = null;
        this.enterEventId = null;
        this.leaveEventId = null;
        this.scaleChangedId = null;

        this.network_directory = "/sys/class/net/";

        this.network_interfaces = [];
        this.checked_interfaces = [];
        this.checked_interfaces_string = "";
        this.unplugged_interfaces = [];
        this.unplugged_interfaces_string = "";

        this.network_data = {};

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.s = new Settings.AppletSettings(this, UUID, this.instanceId);
        this.display_mode = 0;
        this.s.bind("unit_type", "unit_type");
        this.s.bind("is_binary", "is_binary");
        this.update_every = 1; // seconds
        this.update_available_interfaces_every = 10; // seconds
        this.gui_speed_type = 0;
        this.s.bind("gui_value_order", "gui_value_order",  () => { this.reload() });
        //~ this.s.bind("decimal_places", "decimal_places");
        this.decimal_places = 1; // Auto: -1.
        this.gui_text_css = "font-weight: bold; font-size: 15px; text-align: right; font-family: monospace;";
        this.gui_symbolic_icon = true;
        this.hover_popup_text_css = "font-size: 15px; padding: 5px; font-weight: normal;";
        this.hover_popup_numbers_css = "font-size: 15px; padding: 5px; font-weight: bold;";
        this.s.bind("display_minimum_quantity", "display_minimum_quantity");
        this.s.bind("display_minimum_unit_multiple", "display_minimum_unit_multiple");
        this.s.bind("minimum_bytes_to_display", "minimum_bytes_to_display");
        this.s.bind("checked_interfaces_string", "checked_interfaces_string");
        this.s.bind("unplugged_interfaces_string", "unplugged_interfaces_string");

        this.populate_display_minimum_fields();

        this._connect_signals();

        this.list_network_interfaces();

        //~ setInterval( () => {
            //~ global.log("this.network_interfaces: " + this.network_interfaces);
            //~ global.log("this.unplugged_interfaces: " + this.unplugged_interfaces);
        //~ }, 10000);
        this._init_gui();
    } // End of constructor

    _connect_signals() {
        //~ global.connect("shutdown", () => { this.on_shutdown() });
        this.enterEventId = this.actor.connect("enter-event", (actor, event) => this.on_enter_event(actor, event));
        this.leaveEventId = this.actor.connect("leave-event", (actor, event) => this.on_leave_event(actor, event));
        this.scaleChangedId = global.connect("scale-changed", () => { this.on_panel_height_changed() });
    } // End of _connect_signals

    _disconnect_signals() {
        if (this.enterEventId)
            this.actor.disconnect(this.enterEventId); // "enter-event"
        if (this.leaveEventId)
            this.actor.disconnect(this.leaveEventId); // "leave-event"
        if (this.scaleChangedId)
            global.disconnect(this.scaleChangedId); // "scale-changed"
        this.enterEventId = null;
        this.leaveEventId = null;
        this.scaleChangedId = null;
    } // End of _disconnect_signals

    list_network_interfaces() {
        let subProcess = Util.spawnCommandLineAsyncIO("ls -1A " + this.network_directory,
            (stdout, stderr, exitCode) => {
                if (exitCode == 0) {
                    //~ global.log("typeof stdout: " + typeof stdout);
                    this.network_interfaces = stdout.slice(0, -1).split("\n");
                }
                subProcess.send_signal(9);
            },
            {}
        );
        this.list_unplugged_network_interfaces();
        if (this.renewInterfacesId == null) {
            this.renewInterfacesId = timeout_add_seconds(
                this.update_available_interfaces_every,
                () => {
                    this.list_network_interfaces();
                    this.list_unplugged_network_interfaces();
                    return this.is_running;
                }
            );
        }
        return this.is_running;
    } // End of list_network_interfaces

    list_unplugged_network_interfaces() {
        let subProcess = Util.spawnCommandLineAsyncIO(UNPLUGGED_SCRIPT,
            (stdout, stderr, exitCode) => {
                if (exitCode == 0) {
                    this.unplugged_interfaces = stdout.slice(0, -1).split(" ");
                }
                subProcess.send_signal(9);
            },
            {}
        )
    }

    //~ list_unplugged_network_interfaces_OLD() {
        //~ var unplugged = [];
        //~ for (let net_interface of this.network_interfaces) {
            //~ let path = `${this.network_directory}/${net_interface}/operstate`;
            //~ let [success, contents_array] = GLib.file_get_contents(path);
            //~ if (success) {
                //~ let operstate = to_string(contents_array);
                //~ if (!operstate.startsWith("up"))
                    //~ unplugged.push(net_interface);
            //~ } else {
                //~ unplugged.push(net_interface);
            //~ }
        //~ }
        //~ this.unplugged_interfaces = unplugged;
    //~ } // End of list_unplugged_network_interfaces

    update_data() {
        var data = {};
        var received = 0;
        var sent = 0;
        var diff_ts = 1000;
        let subProcess = Util.spawnCommandLineAsyncIO(DATA_SCRIPT,
            (stdout, stderr, exitCode) => {
                if (exitCode == 0) {
                    let result = stdout.slice(0, -1).split(" ");
                    for (let r of result) {
                        let d = r.split(":");
                        data[d[0]] = {"rx": parseInt(d[1]), "tx": parseInt(d[2]), "timestamp": Date.now()}
                        if (this.network_data[d[0]]) {
                            diff_ts = (data[d[0]]["timestamp"] - this.network_data[d[0]]["timestamp"]);
                            received += (data[d[0]]["rx"] - this.network_data[d[0]]["rx"]) * 1000 / diff_ts;
                            sent += (data[d[0]]["tx"] - this.network_data[d[0]]["tx"]) * 1000 / diff_ts;
                        }
                        this.network_data[d[0]] = data[d[0]];
                    }
                    this.gui_speed.set_received_text(this.convert_bytes(received));
                    this.gui_speed.set_sent_text(this.convert_bytes(sent));
                }
                subProcess.send_signal(9);
            },
            {}
        )
    } // End of update_data

    convert_bytes(bytes) {
        if (this.is_vertical)
            return "";
        let unit = "";
        let value = "";
        let bits;
        if (bytes < this.minimum_bytes_to_display) {
            bytes = 0;
            bits = 0;
            value = "0.0";
            if (this.unit_type === 0) { // bytes
                unit = _("   B");
                if (this.is_binary === true) {
                    if (this.minimum_bytes_to_display >= _TI)
                        unit = _(" TiB");
                    else if (this.minimum_bytes_to_display >= _GI)
                        unit = _(" GiB");
                    else if (this.minimum_bytes_to_display >= _MI)
                        unit = _(" MiB");
                    else if (this.minimum_bytes_to_display >= _KI)
                        unit = _(" kiB");
                } else { // decimal
                    if (this.minimum_bytes_to_display >= _P12)
                        unit = _(" TB");
                    else if (this.minimum_bytes_to_display >= _P9)
                        unit = _(" GB");
                    else if (this.minimum_bytes_to_display >= _P6)
                        unit = _(" MB");
                    else if (this.minimum_bytes_to_display >= _P3)
                        unit = _(" kB");
                }
            } else { // bits
                unit = _("   b");
                let minimum_bits_to_display = this.minimum_bytes_to_display;
                if (this.is_binary === true) {
                    if (minimum_bits_to_display >= _TI)
                        unit = _(" Tib");
                    else if (minimum_bits_to_display >= _GI)
                        unit = _(" Gib");
                    else if (minimum_bits_to_display >= _MI)
                        unit = _(" Mib");
                    else if (minimum_bits_to_display >= _KI)
                        unit = _(" kib");
                } else { // decimal
                    if (minimum_bits_to_display >= _P12)
                        unit = _(" Tb");
                    else if (minimum_bits_to_display >= _P9)
                        unit = _(" Gb");
                    else if (minimum_bits_to_display >= _P6)
                        unit = _(" Mb");
                    else if (minimum_bits_to_display >= _P3)
                        unit = _(" kb");
                }
            }
            return value + unit;
        }

        if (this.unit_type === 0) { // bytes
            if (this.is_binary === true) { // binary
                if(bytes >= _TI) {
                    return "" + this.formatted_string(Math.round(bytes/_TI*10)/10) + _(" TiB");
                }
                if(bytes >= _GI) {
                    return "" + this.formatted_string(Math.round(bytes/_GI*10)/10) + _(" GiB");
                }
                if(bytes >= _MI) {
                    return "" + this.formatted_string(Math.round(bytes/_MI*10)/10) + _(" MiB");
                }
                if(bytes >= _KI) {
                    return "" + this.formatted_string(Math.round(bytes/_KI*10)/10) + _(" kiB");
                }
                return "" + this.formatted_string(bytes) + _("   B");
            } else { // decimal
                if(bytes >= _P12) {
                    return "" + this.formatted_string(Math.round(bytes/_P12*10)/10) + _(" TB");
                }
                if(bytes >= _P9) {
                    return "" + this.formatted_string(Math.round(bytes/_P9*10)/10) + _(" GB");
                }
                if(bytes >= _P6) {
                    return "" + this.formatted_string(Math.round(bytes/_P6*10)/10) + _(" MB");
                }
                if(bytes >= _P3) {
                    return "" + this.formatted_string(Math.round(bytes/_P3*10)/10) + _(" kB");
                }
                return "" + this.formatted_string(bytes) + _("   B");
            }
        } else { // bits
            bits = bytes * 8;
            if (this.is_binary === true) { // binary
                if(bits >= _TI) {
                    return "" + this.formatted_string(Math.round(bits/_TI*10)/10) + _(" Tib");
                }
                if(bits >= _GI) {
                    return "" + this.formatted_string(Math.round(bits/_GI*10)/10) + _(" Gib");
                }
                if(bits >= _MI) {
                    return "" + this.formatted_string(Math.round(bits/_MI*10)/10) + _(" Mib");
                }
                if(bits >= _KI) {
                    return "" + this.formatted_string(Math.round(bits/_KI*10)/10) + _(" kib");
                }
                return "" + this.formatted_string(bits) + _("   b");
            } else { // decimal
                if(bits >= _P12) {
                    return "" + this.formatted_string(Math.round(bits/_P12*10)/10) + _(" Tb");
                }
                if(bits >= _P9) {
                    return "" + this.formatted_string(Math.round(bits/_P9*10)/10) + _(" Gb");
                }
                if(bits >= _P6) {
                    return "" + this.formatted_string(Math.round(bits/_P6*10)/10) + _(" Mb");
                }
                if(bits >= _P3) {
                    return "" + this.formatted_string(Math.round(bits/_P3*10)/10) + _(" kb");
                }
                return "" + this.formatted_string(bits) + _("   b");
            }
        }
    } // End of convert_bytes

    formatted_string(value) {
        let v = "" + value;
        if (this.is_vertical) {
            // Returns no decimal
            if (v.includes("."))
                v = v.slice(0, v.indexOf("."));
            //~ v = "\n" + v + "\n";
            return v.trim();
            //~ return v;
        } else {
            // Returns 1 decimal, even if this is 0.
            if (v.includes("."))
                return v;
            return v+".0"
        }
    } // End of formatted_string

    populate_display_minimum_fields() {
        let min_value = this.minimum_bytes_to_display;
        if (this.is_binary) { // binary
            if (min_value >= _TI) {
                this.display_minimum_unit_multiple = "T";
                this.display_minimum_quantity = Math.min(1023, Math.ceil(min_value / _TI));
                return
            }
            if (min_value >= _GI) {
                this.display_minimum_unit_multiple = "G";
                this.display_minimum_quantity = Math.min(1023, Math.ceil(min_value / _GI));
                return
            }
            if (min_value >= _MI) {
                this.display_minimum_unit_multiple = "M";
                this.display_minimum_quantity = Math.min(1023, Math.ceil(min_value / _MI));
                return
            }
            if (min_value >= _KI) {
                this.display_minimum_unit_multiple = "k";
                this.display_minimum_quantity = Math.min(1023, Math.ceil(min_value / _KI));
                return
            }
            this.display_minimum_unit_multiple = "1";
            this.display_minimum_quantity = Math.min(1023, min_value);
        } else { // decimal
            if (min_value >= _P12) {
                this.display_minimum_unit_multiple = "T";
                this.display_minimum_quantity = Math.min(999, Math.ceil(min_value / _P12));
                return
            }
            if (min_value >= _P9) {
                this.display_minimum_unit_multiple = "G";
                this.display_minimum_quantity = Math.min(999, Math.ceil(min_value / _P9));
                return
            }
            if (min_value >= _P6) {
                this.display_minimum_unit_multiple = "M";
                this.display_minimum_quantity = Math.min(999, Math.ceil(min_value / _P6));
                return
            }
            if (min_value >= _P3) {
                this.display_minimum_unit_multiple = "k";
                this.display_minimum_quantity = Math.min(999, Math.ceil(min_value / _P3));
                return
            }
            this.display_minimum_unit_multiple = "1";
            this.display_minimum_quantity = Math.min(999, min_value);
        }
    } // End of populate_display_minimum_fields

    _on_display_minimum_button_clicked() {
        if (this.is_binary) { // binary
            this.minimum_bytes_to_display = this.display_minimum_quantity * BINARY_MULTIPLE[this.display_minimum_unit_multiple];
        } else { // decimal
            this.display_minimum_quantity = Math.min(999, this.display_minimum_quantity);
            this.minimum_bytes_to_display = this.display_minimum_quantity * DECIMAL_MULTIPLE[this.display_minimum_unit_multiple];
        }
    } // End of _on_display_minimum_button_clicked

    get is_vertical() {
        return (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
    }

    on_applet_added_to_panel() {
        if (this.is_vertical) return;
        this.is_running = true;
        this.run();
    } // End of on_applet_added_to_panel

    on_applet_removed_from_panel(deleteConfig) {
        this.is_running = false;
        remove_all_sources();
        this._disconnect_signals();
    } // End of on_applet_removed_from_panel

    // Override
    on_panel_height_changed() {
        this._init_gui();
    } // End of on_panel_height_changed

    on_orientation_changed() {
        this.reload()
    } // End of on_orientation_changed

    on_enter_event(actor, event) {
        this.last_enter_time = Date.now();
    } // End of on_enter_event

    on_leave_event(actor, event) {
        let now = Date.now();
        if (this.last_enter_time) {
            let difference = now - this.last_enter_time;
            if (difference >= 5000) {
                this.reload();
                 return;
            }
        }
        this.is_running = false;
        remove_all_sources();
        if (this.is_vertical) return;
        this.is_running = true;
        this.run();
    } // End of on_leave_event

    reload() {
        this.is_running = false;
        Extension.reloadExtension(UUID, Extension.Type.APPLET);
    }

    _init_gui() {
        this.gui_speed = new AppletGui.GuiSpeed(this._panelHeight, this.gui_speed_type, this.gui_value_order, this.decimal_places, this.is_binary);
        //~ this.gui_data_limit = new AppletGui.GuiDataLimit(this._panelHeight, this.gui_data_limit_type);
        this.actor.destroy_all_children();
        this._add_gui_speed();
        //~ this._add_gui_data_limit();
    } // End of _init_gui

    _add_gui_speed() {
        this.actor.add(this.gui_speed.actor,
                      { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE, y_fill: false });
        this.on_gui_icon_changed();
        this.on_gui_css_changed();
    } // End of _add_gui_speed

    on_gui_icon_changed() {
        if (this.is_vertical) {
            this.gui_speed.set_reveived_icon(ICON_FORBIDDEN);
            this.gui_speed.set_sent_icon(ICON_FORBIDDEN);
            return
        }
        this.gui_speed.set_reveived_icon(ICON_DOWNLOAD);
        this.gui_speed.set_sent_icon(ICON_UPLOAD);
    } // End of on_gui_icon_changed

    on_gui_css_changed() {
        this.gui_speed.set_text_style(this.gui_text_css);
    } // End of on_gui_css_changed

    run() {
        this._run_calculate_speed_running();
        //~ this._run_update_available_interfaces_running();
    } // End of run

    _run_calculate_speed_running() {
        if(this.is_running) {
            this._run_calculate_speed();
        }
    } // End of _run_calculate_speed_running

    _run_calculate_speed() {
        this._calculate_speed();
        timeout_add_seconds(this.update_every, () => { this._run_calculate_speed_running() });
    } // End of _run_calculate_speed

    _calculate_speed() {
        this.update_data();
    } // End of _calculate_speed

    _run_update_available_interfaces_running() {

    } // End of _run_update_available_interfaces_running
} // End of class Bps

function main(metadata, orientation, panel_height, instance_id) {
    return new Bps(metadata, orientation, panel_height, instance_id);
}



