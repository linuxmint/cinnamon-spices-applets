const Applet = imports.ui.applet;
const St = imports.gi.St;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;

const UUID = "day-progress@chmodmasx";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

// Pie chart drawing class
function Pie() {
    this._init.apply(this, arguments);
}

Pie.prototype = {
    _init: function() {
        this._angle = 0;
        this._outerBorder = true;
        this.actor = new St.DrawingArea({
            style_class: 'pie',
            visible: false
        });
        this.actor.connect('repaint', Lang.bind(this, this._onRepaint));
    },

    setAngle: function(angle) {
        if (this._angle === angle)
            return;
        this._angle = angle;
        this.actor.queue_repaint();
    },

    calculateStyles: function(width, height, outerBorder) {
        let min = Math.min(width, height);
        min += 0.5;
        this.actor.set_style('width: ' + min + 'em; height: ' + min + 'em;');
        this._outerBorder = outerBorder;
    },

    _onRepaint: function(area) {
        let [width, height] = area.get_surface_size();
        let cr = area.get_context();
        let themeNode = area.get_theme_node();
        
        let fillColor = themeNode.get_color('-pie-color');
        let bgColor = themeNode.get_color('-pie-background-color');
        let borderColor = themeNode.get_color('-pie-border-color');
        let borderWidth = themeNode.get_length('-pie-border-width');
        let radius = Math.min(width / 2, height / 2);

        let startAngle = 3 * Math.PI / 2;
        let endAngle = startAngle + this._angle;

        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineJoin(Cairo.LineJoin.ROUND);
        cr.translate(width / 2, height / 2);

        if (this._angle < 2 * Math.PI)
            cr.moveTo(0, 0);

        cr.arc(0, 0, radius - borderWidth * (this._outerBorder ? 2.6 : 1), startAngle, endAngle);

        if (this._angle < 2 * Math.PI)
            cr.lineTo(0, 0);

        cr.closePath();

        cr.setLineWidth(0);
        Clutter.cairo_set_source_color(cr, fillColor);
        cr.fill();

        if (!this._outerBorder) {
            cr.moveTo(0, 0);

            if (this._angle >= 2 * Math.PI || this._angle >= 0) {
                cr.arc(0, 0, radius - borderWidth, startAngle, startAngle - 0.000000000001);
            } else {
                cr.arc(0, 0, radius - borderWidth, endAngle, startAngle);
            }

            cr.lineTo(0, 0);
            cr.closePath();
            cr.setLineWidth(0);
            Clutter.cairo_set_source_color(cr, bgColor);
            cr.fill();
        }
        
        // Draw outer border
        if (this._outerBorder) {
            cr.arc(0, 0, radius - borderWidth, startAngle, startAngle + 2 * Math.PI);
            cr.setLineWidth(borderWidth);
            Clutter.cairo_set_source_color(cr, borderColor);
            cr.stroke();
        }
    },

    destroy: function() {
        this.actor.destroy();
    }
};

// Main applet
function DayProgressApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

DayProgressApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.Applet.prototype._init.call(this, orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this.instanceId = instanceId;
        
        // Configuration
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        
        this.settings.bind("show-elapsed", "showElapsed", Lang.bind(this, this.updateBar));
        this.settings.bind("width", "width", Lang.bind(this, this.onSizeChanged));
        this.settings.bind("height", "height", Lang.bind(this, this.onSizeChanged));
        this.settings.bind("style", "style", Lang.bind(this, this.onStyleChanged));
        this.settings.bind("start-hour", "startHour", Lang.bind(this, this.updateBar));
        this.settings.bind("end-hour", "endHour", Lang.bind(this, this.updateBar));
        
        // Initialize minutes to 0 since they are not configurable
        this.startMinute = 0;
        this.endMinute = 0;

        // Build UI
        this.box = new St.BoxLayout({
            xAlign: Clutter.ActorAlign.CENTER,
            yAlign: Clutter.ActorAlign.CENTER
        });

        this.pie = new Pie();

        this.box.add_child(this.pie.actor);
        this.actor.add_actor(this.box);

        // Menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Menu items
        this.menuElapsedContainer = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.elapsedLabel = new St.Label({
            text: _("Elapsed"),
            x_align: Clutter.ActorAlign.START,
            x_expand: true,
            style_class: 'day-progress-label'
        });
        this.elapsedValue = new St.Label({ text: '' });
        this.menuElapsedContainer.addActor(this.elapsedLabel);
        this.menuElapsedContainer.addActor(this.elapsedValue);

        this.menuRemainingContainer = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.remainingLabel = new St.Label({
            text: _("Remaining"),
            x_align: Clutter.ActorAlign.START,
            x_expand: true,
            style_class: 'day-progress-label'
        });
        this.remainingValue = new St.Label({ text: '' });
        this.menuRemainingContainer.addActor(this.remainingLabel);
        this.menuRemainingContainer.addActor(this.remainingValue);

        this.menu.addMenuItem(this.menuElapsedContainer);
        this.menu.addMenuItem(this.menuRemainingContainer);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        let settingsItem = new PopupMenu.PopupMenuItem(_("Settings"));
        settingsItem.connect('activate', Lang.bind(this, function() {
            imports.gi.Gio.Subprocess.new(
                ['xlet-settings', 'applet', this.metadata.uuid, '-i',  this.instanceId.toString()],
                imports.gi.Gio.SubprocessFlags.NONE
            );
        }));
        this.menu.addMenuItem(settingsItem);

        // Initialize styles and values
        this.calculateStyles();
        this._applet_tooltip._tooltip.set_style_class_name("day-progress-tooltip")
        
        // Update immediately to populate the menu values
        this.updateBar();

        // Timer to update every 10 seconds
        this.timerID = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, Lang.bind(this, function() {
            this.updateBar();
            return GLib.SOURCE_CONTINUE;
        }));
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    onSizeChanged: function() {
        this.calculateStyles();
        this.updateBar();
    },

    onStyleChanged: function() {
        this.calculateStyles();
    },

    calculateStyles: function() {
        let w = this.width / 5;
        let h = this.height / 10;
        
        // style 0 = Pie (with border), style 1 = Pie (no border)
        this.pie.calculateStyles(w, h, this.style == 0);
        this.pie.actor.visible = true;
        
        this.updateBar();
    },

    updateBar: function() {
        let localDateTime = GLib.DateTime.new_now_local();
        let startTimeFraction = this.startHour / 24 + this.startMinute / (60 * 24);
        let endTimeFraction = this.endHour / 24 + this.endMinute / (60 * 24);

        let currentTimeFraction = (localDateTime.get_hour() + localDateTime.get_minute() / 60 + localDateTime.get_second() / 3600) / 24;

        let percentElapsedOfPeriod;
        
        // If startHour and endHour are equal, consider it as a full 24-hour period
        if (this.startHour === this.endHour && this.startMinute === this.endMinute) {
            percentElapsedOfPeriod = currentTimeFraction;
        }
        // No midnight wrap-around
        else if (endTimeFraction > startTimeFraction) {
            percentElapsedOfPeriod = this.mapNumber(
                this.clamp(currentTimeFraction, startTimeFraction, endTimeFraction),
                startTimeFraction, endTimeFraction, 0, 1
            );
        } else {
            // Midnight wrap-around
            if (currentTimeFraction >= endTimeFraction && currentTimeFraction < startTimeFraction) {
                percentElapsedOfPeriod = 1;
            } else {
                let durationFraction = (1 - (startTimeFraction - endTimeFraction));
                let offset = 1 - startTimeFraction;
                let offsettedTimeFraction = (currentTimeFraction + 1 + offset) % 1;
                percentElapsedOfPeriod = this.mapNumber(
                    this.clamp(offsettedTimeFraction, 0, durationFraction),
                    0, durationFraction, 0, 1
                );
            }
        }

        let percentRemainingOfPeriod = 1 - percentElapsedOfPeriod;
        
        // Update pie angle
        this.pie.setAngle((this.showElapsed ? percentElapsedOfPeriod : percentRemainingOfPeriod) * (Math.PI * 2.0));

        let duration;
        if (this.startHour === this.endHour && this.startMinute === this.endMinute) {
            duration = 1; // Full 24 hours
        } else if (endTimeFraction > startTimeFraction) {
            duration = (endTimeFraction - startTimeFraction);
        } else {
            duration = (1 - (startTimeFraction - endTimeFraction));
        }
        
        let elapsedHours = Math.floor(percentElapsedOfPeriod * duration * 24);
        let elapsedMinutes = Math.floor((percentElapsedOfPeriod * duration * 24 * 60) % 60);
        let remainingHours = Math.floor(percentRemainingOfPeriod * duration * 24);
        let remainingMinutes = Math.floor((percentRemainingOfPeriod * duration * 24 * 60) % 60);
        
        if (elapsedHours < 10) elapsedHours = " " + elapsedHours; else elapsedHours = "" + elapsedHours;
        if (elapsedMinutes < 10) elapsedMinutes = " " + elapsedMinutes; else elapsedMinutes = "" + elapsedMinutes;
        if (remainingHours < 10) remainingHours = " " + remainingHours; else remainingHours = "" + remainingHours;
        if (remainingMinutes < 10) remainingMinutes = " " + remainingMinutes; else remainingMinutes = "" + remainingMinutes;
        
        this.elapsedValue.text = elapsedHours + 'h ' + elapsedMinutes + 'm | ' + Math.round(percentElapsedOfPeriod * 100) + '%';
        this.remainingValue.text = remainingHours + 'h ' + remainingMinutes + 'm | ' + Math.round(percentRemainingOfPeriod * 100) + '%';
        
        this._updateTooltip();
    },
    
    _updateTooltip: function() {
        let elapsedLength = _("Elapsed").length;
        let remainingLength = _("Remaining").length;
        let maxLength = Math.max(elapsedLength, remainingLength);
        this.set_applet_tooltip(" ".repeat(maxLength - elapsedLength) + _("Elapsed") + " " + this.elapsedValue.text + 
        "\n" + " ".repeat(maxLength - remainingLength) + _("Remaining") + " " + this.remainingValue.text);
    },

    mapNumber: function(number, inMin, inMax, outMin, outMax) {
        return (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    },

    clamp: function(number, min, max) {
        return Math.max(min, Math.min(number, max));
    },

    on_applet_removed_from_panel: function() {
        if (this.timerID) {
            GLib.Source.remove(this.timerID);
            this.timerID = null;
        }
        this.settings.finalize();
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new DayProgressApplet(metadata, orientation, panelHeight, instanceId);
}
