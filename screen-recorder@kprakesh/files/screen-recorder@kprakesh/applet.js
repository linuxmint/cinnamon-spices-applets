
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

    startRecording() {
    
        let monitor = Main.layoutManager.primaryMonitor;
        let screen_resolution = `${monitor.width}x${monitor.height}`;
        
        let now = GLib.DateTime.new_now_local();
        let timestamp = now.format("%Y-%m-%d_%H-%M-%S");
        let ext = this.outputFormat; 
        
        let save_dir = this.saveDirectory;
        if (save_dir.startsWith("~")) {
            save_dir = save_dir.replace("~", GLib.get_home_dir());
        }
        
        let output_file = `${save_dir}/ScreenRecord_${timestamp}.${ext}`;

        let audio_flag = this.recordAudio ? "-f pulse -i $(pactl get-default-sink).monitor" : "";

        let codec_flags = "";
        if (ext === "webm") {
            codec_flags = this.recordAudio ? "-c:v libvpx -crf 10 -b:v 1M -c:a libvorbis" : "-c:v libvpx -crf 10 -b:v 1M";
        } else {
            codec_flags = this.recordAudio ? "-c:v libx264 -preset ultrafast -c:a aac" : "-c:v libx264 -preset ultrafast";
        }

        let command = `bash -c 'ffmpeg -video_size ${screen_resolution} -framerate 30 -f x11grab -i :0.0 ${audio_flag} ${codec_flags} "${output_file}"'`;

        Util.spawnCommandLineAsync(command);
        
        // --- UI Updates for Recording ---
        this.set_applet_icon_symbolic_name("media-playback-stop");
        this.set_applet_label(" REC ");
        this._applet_icon.style = "color: #ff4444;"; 
        // --------------------------------

        this.recordMenuItem.label.set_text("Stop Recording");
        this.recordMenuItem.setIconSymbolicName("media-playback-stop");
        
        this.isRecording = true;
    }

    stopRecording() {
        Util.spawnCommandLineAsync("killall -SIGINT ffmpeg");
        
        // --- UI Updates for Stopped ---
        this.set_applet_icon_symbolic_name("camera-video-symbolic");
        this.set_applet_label(""); 
        this._applet_icon.style = ""; 
        // ------------------------------
        
        this.recordMenuItem.label.set_text("Start Recording");
        this.recordMenuItem.setIconSymbolicName("media-record");
        
        this.isRecording = false;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new ScreenRecorderApplet(metadata, orientation, panel_height, instance_id);
}
