const Applet = imports.ui.applet;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const UUID = 'pointthat@muratozalp';

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + '/locale');

function _(text) {
    return Gettext.dgettext(UUID, text);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        this.metadata = metadata;
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        this.set_applet_icon_path(this.metadata.path + '/icon.png');
        this.set_applet_tooltip(_('Mouse Beam: Off'));

        this.isActive = false;
        
        // Ray settings (loaded from settings-schema.json)
        this.settings = new Settings.AppletSettings(this, this.metadata.uuid, this.instance_id);
        this._colorCache = null;
        if (this.settings.isReady) {
            this.settings.bind('rayCount', 'rayCount', this._onSettingsChanged);
            this.settings.bind('rayLength', 'rayLength', this._onSettingsChanged);
            this.settings.bind('gap', 'gap', this._onSettingsChanged);
            this.settings.bind('lineWidth', 'lineWidth', this._onSettingsChanged);
            this.settings.bind('rayColor', 'rayColor', this._onSettingsChanged);
        } else {
            // Fall back to fixed values if settings cannot be loaded
            this.rayCount = 12;
            this.rayLength = 35;
            this.gap = 10;
            this.lineWidth = 4;
            this.rayColor = 'rgb(255, 204, 0)';
        }
        
        // DİKKAT: Cinnamon's main frame is this.actor.
        // We gave a different name to the beam window!
        this._rayActor = null;
        this._rayCanvas = null;
        this._loopId = null;
    },

    on_applet_clicked: function(event) {
        if (this.isActive) {
            this.stopEffect();
        } else {
            this.startEffect();
        }
    },

    on_applet_removed_from_panel: function() {
        this.stopEffect();
        if (this.settings) {
            this.settings.finalize();
            this.settings = null;
        }
    },

    startEffect: function() {
        if (this.isActive) return;
        this.isActive = true;
        
        this.set_applet_icon_path(this.metadata.path + '/icon-active.png');
        this.set_applet_tooltip(_('Mouse Beam: On'));

        let size = (this.gap + this.rayLength + this.lineWidth) * 2;
        
        // Create the beam window
        this._rayActor = new St.Bin({
            style_class: 'pointthat-pencere',
            width: size,
            height: size,
            reactive: false
        });
        
        this._rayCanvas = new St.DrawingArea();
        this._rayCanvas.set_size(size, size);
        this._rayCanvas.connect('repaint', (area) => this.drawRays(area));
        
        this._rayActor.set_child(this._rayCanvas);
        global.stage.add_actor(this._rayActor);

        this.updatePosition();
        this._loopId = Mainloop.timeout_add(16, () => this.updatePosition());
    },

    stopEffect: function() {
        if (!this.isActive) return;
        this.isActive = false;
        this.set_applet_icon_path(this.metadata.path + '/icon.png');
        this.set_applet_tooltip(_('Mouse Beam: Off'));
        
        if (this._loopId) {
            Mainloop.source_remove(this._loopId);
            this._loopId = null;
        }
        if (this._rayActor) {
            global.stage.remove_actor(this._rayActor);
            this._rayActor.destroy();
            this._rayActor = null;
        }
    },

    updatePosition: function() {
        if (!this.isActive) return GLib.SOURCE_REMOVE;
        
        try {
            // X11 backend: use the Cinnamon API directly
            let [x, y, mods] = global.get_pointer();
            let size = (this.gap + this.rayLength + this.lineWidth) * 2;
            
            this._rayActor.set_position(x - (size / 2), y - (size / 2));
        } catch (e) {
            // Continue silently on error
        }
        
        return GLib.SOURCE_CONTINUE;
    },

    drawRays: function(area) {
        let cr = area.get_context();
        let size = (this.gap + this.rayLength + this.lineWidth) * 2;
        let centerX = size / 2;
        let centerY = size / 2;
        
        cr.setLineWidth(this.lineWidth);
        cr.setLineCap(2); // Rounded line caps
        
        // Configurable color (default yellow)
        let color = this._getColor();
        cr.setSourceRGBA(color[0], color[1], color[2], color[3]);
        
        let angleStep = (2 * Math.PI) / this.rayCount;
        
        for (let i = 0; i < this.rayCount; i++) {
            let angle = i * angleStep;
            
            let startX = centerX + (this.gap * Math.cos(angle));
            let startY = centerY + (this.gap * Math.sin(angle));
            
            let endX = centerX + ((this.gap + this.rayLength) * Math.cos(angle));
            let endY = centerY + ((this.gap + this.rayLength) * Math.sin(angle));
            
            cr.moveTo(startX, startY);
            cr.lineTo(endX, endY);
            cr.stroke();
        }
    },

    _onSettingsChanged: function() {
        this._colorCache = null;

        if (this.isActive) {
            // Size may have changed: resize the actor and redraw
            let size = (this.gap + this.rayLength + this.lineWidth) * 2;
            this._rayActor.set_size(size, size);
            this._rayCanvas.set_size(size, size);
            this._rayCanvas.queue_repaint();
            this.updatePosition();
        }
    },

    _getColor: function() {
        if (this._colorCache) return this._colorCache;
        let color = [1.0, 0.8, 0.0, 0.9]; // default yellow
        try {
            let s = String(this.rayColor).trim();
            let m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
            if (m) {
                let alpha = m[4] !== undefined ? parseFloat(m[4]) : 0.9;
                color = [
                    parseInt(m[1], 10) / 255.0,
                    parseInt(m[2], 10) / 255.0,
                    parseInt(m[3], 10) / 255.0,
                    alpha
                ];
            } else {
                let [success, parsed] = Clutter.Color.from_string(s);
                if (success) {
                    color = [
                        parsed.red / 255.0,
                        parsed.green / 255.0,
                        parsed.blue / 255.0,
                        parsed.alpha / 255.0
                    ];
                }
            }
        } catch (e) {
            // Keep the default yellow if the color cannot be parsed
        }
        this._colorCache = color;
        return color;
    },

    destroy: function() {
        this.stopEffect();
        Applet.IconApplet.prototype.destroy.call(this);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
