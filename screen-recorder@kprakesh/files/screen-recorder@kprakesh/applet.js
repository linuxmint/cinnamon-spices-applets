
/**
 * Screen Recorder
 * Copyright (C) 2026 kprakesh
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */



const Applet = imports.ui.applet;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const PopupMenu = imports.ui.popupMenu; 
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Main = imports.ui.main;

class ScreenRecorderApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        
        this.metadata = metadata;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("record-audio", "recordAudio");
        this.settings.bind("output-format", "outputFormat");
        //this.settings.bind("video-resolution", "videoResolution");
        this.settings.bind("save-directory", "saveDirectory");
        
        this.isRecording = false;

        this.set_applet_icon_symbolic_name("camera-video-symbolic");
        this.set_applet_label(""); 
        this.set_applet_tooltip("Screen Recorder");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Create the Start/Stop Toggle Menu Item
        this.recordMenuItem = new PopupMenu.PopupIconMenuItem(
            "Start Recording", 
            "media-record", 
            St.IconType.SYMBOLIC 
        );
        
        this.recordMenuItem.connect('activate', () => this.toggleRecording());
        
        this.menu.addMenuItem(this.recordMenuItem);
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    toggleRecording() {
        if (!this.isRecording) {
            this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    // Ensure ffmpeg is installed before attempting to record; notify user if missing
    checkDependencies() {
        if (!GLib.find_program_in_path("ffmpeg")) {
            let title = "Screen Recorder: Dependency Missing";
            let msg = "Please open your terminal and run:\n\nsudo apt install ffmpeg";
            
            Main.notify(title, msg); 
            
            return false;
        }
        return true;
    }
    
    startRecording() {
    
        if (!this.checkDependencies()) return;

        let monitor = Main.layoutManager.primaryMonitor;
        let screen_resolution = `${monitor.width}x${monitor.height}`;
        let now = GLib.DateTime.new_now_local();
        let timestamp = now.format("%Y-%m-%d_%H-%M-%S");
        
        let save_dir = this.saveDirectory.replace("~", GLib.get_home_dir());
        let output_file = `${save_dir}/ScreenRecord_${timestamp}.${this.outputFormat}`;

        // Properly escape the path for the shell
        let escaped_output = GLib.shell_quote(output_file);

        let audio_flag = this.recordAudio ? "-f pulse -i $(pactl get-default-sink).monitor" : "";
        let codec_flags = (this.outputFormat === "webm") 
            ? "-c:v libvpx -crf 10 -b:v 1M -c:a libvorbis" 
            : "-c:v libx264 -preset ultrafast -c:a aac";

        let ffmpeg_cmd = `ffmpeg -video_size ${screen_resolution} -framerate 30 -f x11grab -i :0.0 ${audio_flag} ${codec_flags} ${escaped_output}`;

        // Use GLib to spawn so we can track the PID
        let [success, argv] = GLib.shell_parse_argv(`bash -c '${ffmpeg_cmd}'`);
        if (success) {
            let [result, pid] = GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
            this.current_pid = pid;

            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, this.current_pid, (pid, status) => {
                if (this.isRecording) this.stopRecording(true); // Reset UI if ffmpeg dies
                GLib.spawn_close_pid(pid);
            });
        }

        this.set_applet_icon_symbolic_name("media-playback-stop");
        this.set_applet_label("REC");
        this._applet_icon.style = "color: #ff4444;";  
        this.recordMenuItem.label.set_text("Stop Recording");
        this.isRecording = true;
    }

    stopRecording(was_crash = false) {
        if (this.current_pid && !was_crash) {
            Util.spawn(["kill", "-SIGINT", this.current_pid.toString()]);
        }
        this.current_pid = null;
        
        this.set_applet_icon_symbolic_name("camera-video-symbolic");
        this.set_applet_label("");
        this._applet_icon.style = ""; 
        this.recordMenuItem.label.set_text("Start Recording");
        this.set_applet_tooltip("Screen Recorder");
        this.isRecording = false;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new ScreenRecorderApplet(metadata, orientation, panel_height, instance_id);
}
