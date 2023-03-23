// Multi-core System Monitor Scroller.
// Copyright (C) 2011-2012 Chace Clark <ccdevelop23@gmail.com>.
//
// Multi-core System Monitor is libre software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or newer.
//
// You should have received a copy of the GNU General Public License along with
// this file. If not, see <http://www.gnu.org/licenses/>.
const UUID = 'multicore-sys-monitor@ccadeptic23';
imports.gi.versions.Gtk = '3.0';
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Gdk = imports.gi.Gdk;

imports.searchPath.unshift('.');
var tryFn = imports.utils.tryFn;
var _ = imports.utils._;
var to_string = imports.tostring.to_string

const DEFAULT_CONFIG = {
  labelsOn: true,
  thickness: 1,
  refreshRate: 1000,
  labelColor: [0.9333333333333333, 0.9333333333333333, 0.9254901960784314, 1],
  backgroundColor: [1, 1, 1, 0.1],
  cpu: {
    enabled: true,
    width: 40,
    colors: [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]]
  },
  mem: {
    enabled: true,
    width: 40,
    colors: [[1, 1, 1, 1], [0.6, 0.6, 0.6, 0.8], [0.8, 0.8, 0.8, 0.8], [0.9, 0.9, 0.9, 0.1]],
    swapcolors: [[1, 1, 1, 0.15]]
  },
  net: {
    enabled: true,
    autoscale: true,
    logscale: true,
    width: 40,
    devices: []
  },
  disk: {
    enabled: true,
    autoscale: true,
    logscale: true,
    width: 40,
    devices: [
      {
        id: '/',
        enabled: true,
        show: true,
        colors: [[1, 1, 1, 1], [0.6, 0.6, 0.6, 0.8]]
      }
    ]
  }
};

function Preferences() {
  this._init();
}

Preferences.prototype = {
  _init: function() {
    tryFn(() => {
      this.config = JSON.parse(ARGV[0]);
    }, () => {
      this.config = DEFAULT_CONFIG;
    });

    this.builder = new Gtk.Builder();
    this.builder.set_translation_domain(UUID);

    tryFn(() => {
      this.builder.add_from_file('prefsui.glade');
    });

    this.win = this.builder.get_object('windowMain');
    this.win.set_resizable(true);
    this.win.set_icon_from_file('./icon.png');
    this.win.connect('destroy', () => Gtk.main_quit()); // quit program when titlebar's x is clicked
    this.builder.get_object('applyButton').connect(
      'clicked',
      Lang.bind(this, function() {
        this.save();
        print('SAVE'); // Send the last message to the parent process, Tell it to save these preferences
        this.win.destroy();
      })
    );

    this.builder.get_object('cancelButton').connect(
      'clicked',
      Lang.bind(this, function() {
        this.win.destroy();
      })
    );
    this.aboutScalingwin = this.builder.get_object('scalingAboutDialog');
    this.builder.get_object('closeAboutScalingButton').connect(
      'clicked',
      Lang.bind(this, function() {
        this.aboutScalingwin.hide();
      })
    );
    this.builder.get_object('netAboutScalingButton').connect(
      'clicked',
      Lang.bind(this, function() {
        this.aboutScalingwin.run();
      })
    );
    this.builder.get_object('diskAboutScalingButton').connect(
      'clicked',
      Lang.bind(this, function() {
        this.aboutScalingwin.run();
      })
    );
    this.refreshRateScale = Gtk.Scale.new_with_range(
      Gtk.Orientation.HORIZONTAL,
      500,
      2000,
      1
    );
    this.refreshRateScale.set_value_pos(Gtk.PositionType.RIGHT);
    this.refreshRateScale.width_request = 300;
    let box3 = this.builder.get_object('box3');
    box3.add(this.refreshRateScale);
    box3.set_child_packing(
      this.refreshRateScale, // child
      false, // expand
      true, // fill
      1, // padding
      Gtk.PackType.START // pack_type
    );


    this.thicknessScale = Gtk.Scale.new_with_range(
      Gtk.Orientation.HORIZONTAL,
      1,
      5,
      1
    );
    this.thicknessScale.set_value_pos(Gtk.PositionType.RIGHT);
    this.thicknessScale.width_request = 300;
    let box100 = this.builder.get_object('box100');
    box100.add(this.thicknessScale);
    box100.set_child_packing(
      this.thicknessScale, // child
      false, // expand
      true, // fill
      1, // padding
      Gtk.PackType.START // pack_type
    );

    this.load();
    print(JSON.stringify(this.config)); //print default settings again for the monitoring process

    this.win.show_all();
  },

  load: function() {
    this.setColor('labelColorButton', this.config.labelColor);
    this.builder.get_object('labelColorButton').connect(
      'color-set',
      Lang.bind(this, function() {
        this.save();
      })
    );
    this.setColor('backgroundColorButton', this.config.backgroundColor);
    this.builder.get_object('backgroundColorButton').connect(
      'color-set',
      Lang.bind(this, function() {
        this.save();
      })
    );
    this.thicknessScale.set_value(this.config.thickness);
    this.thicknessScale.connect(
      'value-changed',
      Lang.bind(this, function() {
        this.save();
      })
    );
    this.refreshRateScale.set_value(this.config.refreshRate);
    this.refreshRateScale.connect(
      'value-changed',
      Lang.bind(this, function() {
        this.save();
      })
    );
    this.builder.get_object('labelsSwitch').set_active(this.config.labelsOn);
    this.builder.get_object('labelsSwitch').connect(
      'notify::active',
      Lang.bind(this, function() {
        this.save();
      })
    );

    this.builder.get_object('cpuEnableSwitch').set_active(this.config.cpu.enabled);
    this.builder.get_object('cpuSettingsBox').set_sensitive(this.config.cpu.enabled);
    this.builder.get_object('cpuEnableSwitch').connect(
      'notify::active',
      Lang.bind(this, function() {
        let isEnabled = this.builder.get_object('cpuEnableSwitch').get_active();
        this.builder.get_object('cpuSettingsBox').set_sensitive(isEnabled);
        this.save();
      })
    );
    this.builder.get_object('cpuWidthScale').set_value(this.config.cpu.width);
    this.builder.get_object('cpuWidthScale').connect(
      'value-changed',
      Lang.bind(this, function() {
        this.save();
      })
    );

    //build the CPU color selection area (depends on number of CPU's)
    this.cpuColorSelectionBox = this.builder.get_object('cpuColorChoicesBox');
    this.cpuButtonList = [];
    for (let i = 0; i < this.config.cpu.colors.length; i++) {
      let currentcpuvbox = new Gtk.VBox();

      let cpuButton = new Gtk.ColorButton();
      let cpuLabel = new Gtk.Label({
        label: _('CPU') + (i + 1)
      });
      //currentcpuvbox.set_hexpand(false);
      cpuButton.set_halign(3);
      cpuButton.set_use_alpha(true);
      currentcpuvbox.add(cpuLabel);
      currentcpuvbox.add(cpuButton);
      this.cpuColorSelectionBox.add(currentcpuvbox);
      let color = new Gdk.RGBA({
        red: this.config.cpu.colors[i][0],
        green: this.config.cpu.colors[i][1],
        blue: this.config.cpu.colors[i][2],
        alpha: this.config.cpu.colors[i][3]
      });
      cpuButton.set_rgba(color);
      cpuButton.connect(
        'color-set',
        Lang.bind(this, function() {
          this.save();
        })
      );
      this.cpuButtonList[i] = cpuButton;
    }
    //Memory Stuff
    this.builder.get_object('memEnableSwitch').set_active(this.config.mem.enabled);
    this.builder.get_object('memEnableSwitch').connect(
      'notify::active',
      Lang.bind(this, function() {
        let isEnabled = this.builder.get_object('memEnableSwitch').get_active();
        this.builder.get_object('memSettingsBox').set_sensitive(isEnabled);
        this.save();
      })
    );
    this.builder.get_object('memSettingsBox').set_sensitive(this.config.mem.enabled);

    this.builder.get_object('memWidthScale').set_value(this.config.mem.width);
    this.builder.get_object('memWidthScale').connect(
      'value-changed',
      Lang.bind(this, function() {
        this.save();
      })
    );

    this.builder.get_object('usedupColorButton').connect(
      'color-set',
      Lang.bind(this, function() {
        this.save();
      })
    );
    this.builder.get_object('cachedColorButton').connect(
      'color-set',
      Lang.bind(this, function() {
        this.save();
      })
    );
    this.builder.get_object('bufferColorButton').connect(
      'color-set',
      Lang.bind(this, function() {
        this.save();
      })
    );
    this.builder.get_object('freeColorButton').connect(
      'color-set',
      Lang.bind(this, function() {
        this.save();
      })
    );

    this.setColorByName('usedupColorButton', this.config.mem.colors[0]);
    this.setColorByName('cachedColorButton', this.config.mem.colors[1]);
    this.setColorByName('bufferColorButton', this.config.mem.colors[2]);
    this.setColorByName('freeColorButton', this.config.mem.colors[3]);

    //Swap Stuff
    this.builder.get_object('swapColorButton').connect(
      'color-set',
      Lang.bind(this, function() {
        this.save();
      })
    );
    this.setColorByName('swapColorButton', this.config.mem.swapcolors[0]);

    //Network Stuff
    this.builder.get_object('netEnableSwitch').set_active(this.config.net.enabled);
    this.builder.get_object('netEnableSwitch').connect(
      'notify::active',
      Lang.bind(this, function() {
        let isEnabled = this.builder.get_object('netEnableSwitch').get_active();
        this.builder.get_object('netSettingsBox').set_sensitive(isEnabled);
        this.save();
      })
    );

    this.builder.get_object('netSettingsBox').set_sensitive(this.config.net.enabled);
    this.builder.get_object('netAutoScaleSwitch').set_active(this.config.net.autoscale); //before connect
    this.builder.get_object('netAutoScaleSwitch').connect(
      'notify::active',
      Lang.bind(this, function() {
        this.save();
      })
    );
    this.builder.get_object('netLogScaleSwitch').set_active(this.config.net.logscale); //before connect
    this.builder.get_object('netLogScaleSwitch').connect(
      'notify::active',
      Lang.bind(this, function() {
        this.save();
      })
    );

    this.builder.get_object('netWidthScale').set_value(this.config.net.width);
    this.builder.get_object('netWidthScale').connect(
      'value-changed',
      Lang.bind(this, function() {
        this.save();
      })
    );

    this.netDevicesChoicesBox = this.builder.get_object('netDevicesChoicesBox');
    this.netDownButtonList = [];
    this.netUpButtonList = [];
    this.netEnableSwitchList = [];
    let currentdev_vbox, currentdev_hbox, devLabel, devEnableLabel, devEnableSwitch, devDownColorButton, devDownLabel, devUpColorButton, devUpLabel;

    for (let i = 0; i < this.config.net.devices.length; i++) {
      //build the device sections
      currentdev_vbox = new Gtk.VBox();
      currentdev_hbox = new Gtk.HBox();
      devLabel = new Gtk.Label({
        label: this.config.net.devices[i].id
      });
      devLabel.set_halign(Gtk.Align.START); //start
      devEnableLabel = new Gtk.Label({
        label: _('Enable')
      });
      devEnableLabel.set_halign(Gtk.Align.END); //end
      devEnableSwitch = new Gtk.Switch();
      devEnableSwitch.set_halign(Gtk.Align.START); //start
      devEnableSwitch.set_valign(Gtk.Align.CENTER);
      devEnableSwitch.set_margin_left(10);
      devDownColorButton = new Gtk.ColorButton();
      devDownColorButton.set_halign(Gtk.Align.START);
      devDownColorButton.set_use_alpha(true);
      devDownLabel = new Gtk.Label({
        label: _('Down')
      });
      devDownLabel.set_halign(2);

      devUpColorButton = new Gtk.ColorButton();
      devUpColorButton.set_halign(1);
      devUpColorButton.set_use_alpha(true);
      devUpLabel = new Gtk.Label({
        label: _('Up')
      });
      devUpLabel.set_halign(2);

      //add them to the appropriate containers.
      currentdev_vbox.add(devLabel);
      currentdev_hbox.add(devEnableLabel);
      currentdev_hbox.add(devEnableSwitch);
      currentdev_hbox.add(devDownLabel);
      currentdev_hbox.add(devDownColorButton);
      currentdev_hbox.add(devUpLabel);
      currentdev_hbox.add(devUpColorButton);
      currentdev_vbox.add(currentdev_hbox);
      currentdev_vbox.add(
        new Gtk.Separator({
          marginTop: 5
        })
      );

      //show the device only if the config oks it
      if (this.config.net.devices[i].show) {
        this.netDevicesChoicesBox.add(currentdev_vbox);
      }

      //Configure the Widgets initial values
      this.setColorByObject(devDownColorButton, this.config.net.devices[i].colors[0]);
      this.setColorByObject(devUpColorButton, this.config.net.devices[i].colors[1]);

      devEnableSwitch.set_active(this.config.net.devices[i].enabled);
      if (!this.config.net.devices[i].enabled) {
        devDownLabel.set_sensitive(this.config.net.devices[i].enabled);
        devDownColorButton.set_sensitive(this.config.net.devices[i].enabled);
        devUpLabel.set_sensitive(this.config.net.devices[i].enabled);
        devUpColorButton.set_sensitive(this.config.net.devices[i].enabled);
      }

      //connect the widgets callbacks
      devDownColorButton.connect(
        'color-set',
        Lang.bind(this, function() {
          this.save();
        })
      );
      devUpColorButton.connect(
        'color-set',
        Lang.bind(this, function() {
          this.save();
        })
      );
      devEnableSwitch.connect(
        'notify::active',
        (myswitch) => {
          let isEnabled = myswitch.get_active();
          let children = myswitch.get_parent().get_children();

          let startloc = children.indexOf(myswitch);
          if (startloc >= 0) {
            for (let i = children.indexOf(myswitch) + 1; i < children.length; i++) {
              children[i].set_sensitive(isEnabled);
            }
          }
          this.save();
        }
      );
      this.netDownButtonList[i] = devDownColorButton;
      this.netUpButtonList[i] = devUpColorButton;
      this.netEnableSwitchList[i] = devEnableSwitch;
    }
    //Disk Stuff
    this.builder.get_object('diskEnableSwitch').set_active(this.config.disk.enabled);
    this.builder.get_object('diskEnableSwitch').connect(
      'notify::active',
      Lang.bind(this, function() {
        let isEnabled = this.builder.get_object('diskEnableSwitch').get_active();
        this.builder.get_object('diskSettingsBox').set_sensitive(isEnabled);
        this.save();
      })
    );
    this.builder.get_object('diskSettingsBox').set_sensitive(this.config.disk.enabled);
    this.builder.get_object('diskAutoScaleSwitch').set_active(this.config.disk.autoscale); //before connect
    this.builder.get_object('diskAutoScaleSwitch').connect(
      'notify::active',
      Lang.bind(this, function() {
        this.save();
      })
    );
    this.builder.get_object('diskLogScaleSwitch').set_active(this.config.disk.logscale); //before connect
    this.builder.get_object('diskLogScaleSwitch').connect(
      'notify::active',
      Lang.bind(this, function() {
        this.save();
      })
    );

    this.builder.get_object('diskWidthScale').set_value(this.config.disk.width);
    this.builder.get_object('diskWidthScale').connect(
      'value-changed',
      Lang.bind(this, function() {
        this.save();
      })
    );

    this.diskDevicesChoicesBox = this.builder.get_object('diskDevicesChoicesBox');
    this.diskDownButtonList = [];
    this.diskUpButtonList = [];
    this.diskEnableSwitchList = [];

    for (let i = 0; i < this.config.disk.devices.length; i++) {
      //build the device sections
      currentdev_vbox = new Gtk.VBox();
      currentdev_hbox = new Gtk.HBox();
      devLabel = new Gtk.Label({
        label: this.config.disk.devices[i].id
      });
      devLabel.set_halign(1); //start

      devEnableLabel = new Gtk.Label({
        label: _('Enable')
      });
      devEnableLabel.set_halign(Gtk.Align.END); //end

      devEnableSwitch = new Gtk.Switch();
      devEnableSwitch.set_halign(Gtk.Align.START); //start
      devEnableSwitch.set_valign(Gtk.Align.CENTER);
      devEnableSwitch.set_margin_left(10);
      devEnableSwitch.set_vexpand(false);
      devEnableSwitch.set_hexpand(false);

      devDownColorButton = new Gtk.ColorButton();
      devDownColorButton.set_halign(1);
      devDownColorButton.set_use_alpha(true);

      devDownLabel = new Gtk.Label({
        label: _('Read')
      });
      devDownLabel.set_halign(2);

      devUpColorButton = new Gtk.ColorButton();
      devUpColorButton.set_halign(1);
      devUpColorButton.set_use_alpha(true);

      devUpLabel = new Gtk.Label({
        label: _('Write')
      });
      devUpLabel.set_halign(2);

      //add them to the appropriate containers.
      currentdev_vbox.add(devLabel);
      currentdev_hbox.add(devEnableLabel);
      currentdev_hbox.add(devEnableSwitch);
      currentdev_hbox.add(devDownLabel);
      currentdev_hbox.add(devDownColorButton);
      currentdev_hbox.add(devUpLabel);
      currentdev_hbox.add(devUpColorButton);
      currentdev_vbox.add(currentdev_hbox);
      currentdev_vbox.add(
        new Gtk.Separator({
          marginTop: 5
        })
      );
      //show the device only if the config oks it
      if (this.config.disk.devices[i].show) {
        this.diskDevicesChoicesBox.add(currentdev_vbox);
      }

      //Configure the Widgets initial values
      this.setColorByObject(devDownColorButton, this.config.disk.devices[i].colors[0]);
      this.setColorByObject(devUpColorButton, this.config.disk.devices[i].colors[1]);

      devEnableSwitch.set_active(this.config.disk.devices[i].enabled);
      if (!this.config.disk.devices[i].enabled) {
        devDownLabel.set_sensitive(this.config.disk.devices[i].enabled);
        devDownColorButton.set_sensitive(this.config.disk.devices[i].enabled);
        devUpLabel.set_sensitive(this.config.disk.devices[i].enabled);
        devUpColorButton.set_sensitive(this.config.disk.devices[i].enabled);
      }

      //connect the widgets callbacks
      devDownColorButton.connect(
        'color-set',
        Lang.bind(this, function() {
          this.save();
        })
      );
      devUpColorButton.connect(
        'color-set',
        Lang.bind(this, function() {
          this.save();
        })
      );
      devEnableSwitch.connect(
        'notify::active',
        (myswitch) => {
          let isEnabled = myswitch.get_active();
          let children = myswitch.get_parent().get_children();

          let startloc = children.indexOf(myswitch);
          if (startloc >= 0) {
            for (let i = children.indexOf(myswitch) + 1; i < children.length; i++) {
              children[i].set_sensitive(isEnabled);
            }
          }
          this.save();
        }
      );
      this.diskDownButtonList[i] = devDownColorButton;
      this.diskUpButtonList[i] = devUpColorButton;
      this.diskEnableSwitchList[i] = devEnableSwitch;
    }
  },

  save: function() {
    this.config.thickness = this.thicknessScale.get_value();
    this.config.refreshRate = this.refreshRateScale.get_value();
    this.config.labelColor = this.getColorByName('labelColorButton');
    this.config.backgroundColor = this.getColorByName('backgroundColorButton');
    this.config.labelsOn = this.builder.get_object('labelsSwitch').get_active();

    //CPU Settings
    this.config.cpu.enabled = this.builder.get_object('cpuEnableSwitch').get_active();
    this.config.cpu.width = this.builder.get_object('cpuWidthScale').get_value();
    for (let i = 0; i < this.config.cpu.colors.length; i++) {
      this.config.cpu.colors[i] = this.getColorByObject(this.cpuButtonList[i]);
    }

    //MEM Settings
    this.config.mem.enabled = this.builder.get_object('memEnableSwitch').get_active();
    this.config.mem.width = this.builder.get_object('memWidthScale').get_value();

    this.config.mem.colors[0] = this.getColorByName('usedupColorButton');
    this.config.mem.colors[1] = this.getColorByName('cachedColorButton');
    this.config.mem.colors[2] = this.getColorByName('bufferColorButton');
    this.config.mem.colors[3] = this.getColorByName('freeColorButton');

    //SWAP Settings
    this.config.mem.swapcolors[0] = this.getColorByName('swapColorButton');

    //NET Settings
    this.config.net.enabled = this.builder.get_object('netEnableSwitch').get_active();
    this.config.net.autoscale = this.builder.get_object('netAutoScaleSwitch').get_active();
    this.config.net.logscale = this.builder.get_object('netLogScaleSwitch').get_active();
    this.config.net.width = this.builder.get_object('netWidthScale').get_value();

    for (let i = 0; i < this.config.net.devices.length; i++) {
      this.config.net.devices[i].enabled = this.netEnableSwitchList[i].get_active();
      this.config.net.devices[i].colors[0] = this.getColorByObject(this.netDownButtonList[i]);
      this.config.net.devices[i].colors[1] = this.getColorByObject(this.netUpButtonList[i]);
    }

    //Disk Settings
    this.config.disk.enabled = this.builder.get_object('diskEnableSwitch').get_active();
    this.config.disk.autoscale = this.builder.get_object('diskAutoScaleSwitch').get_active();
    this.config.disk.logscale = this.builder.get_object('diskLogScaleSwitch').get_active();
    this.config.disk.width = this.builder.get_object('diskWidthScale').get_value();

    for (let i = 0; i < this.config.disk.devices.length; i++) {
      this.config.disk.devices[i].enabled = this.diskEnableSwitchList[i].get_active();
      this.config.disk.devices[i].colors[0] = this.getColorByObject(this.diskDownButtonList[i]);
      this.config.disk.devices[i].colors[1] = this.getColorByObject(this.diskUpButtonList[i]);
    }
    print(JSON.stringify(this.config));
  },

  getColorByName: function(widgetname) {
    let c = new Gdk.RGBA();

    //check the parameters since ubuntu wants a reference instead of a returned value
    let params = getParamNames(this.builder.get_object(widgetname).get_rgba);

    if (params === null) {
      c = this.builder.get_object(widgetname).get_rgba();
    } else if (params[0] === 'color') {
      this.builder.get_object(widgetname).get_rgba(c);
    }

    return [c.red, c.green, c.blue, c.alpha];
  },
  getColorByObject: function(widget) {
    let c = new Gdk.RGBA();

    //check the parameters since ubuntu wants a reference instead of a returned value
    let params = getParamNames(widget.get_rgba);

    if (params === null) {
      c = widget.get_rgba();
    } else if (params[0] === 'color') {
      widget.get_rgba(c);
    }

    return [c.red, c.green, c.blue, c.alpha];
  },
  setColorByObject: function(widget, c) {
    let color = new Gdk.RGBA({
      red: c[0],
      green: c[1],
      blue: c[2],
      alpha: c[3]
    });
    widget.set_rgba(color);
  },
  setColorByName: function(widgetname, c) {
    let color = new Gdk.RGBA({
      red: c[0],
      green: c[1],
      blue: c[2],
      alpha: c[3]
    });
    this.builder.get_object(widgetname).set_rgba(color);
  },
  setColor: function(widget, c) {
    let color = new Gdk.RGBA({
      red: c[0],
      green: c[1],
      blue: c[2],
      alpha: c[3]
    });
    this.builder.get_object(widget).set_rgba(color);
  }
};

function getParamNames(func) {
  let funStr = to_string(func);
  return funStr.slice(funStr.indexOf('(') + 1, funStr.indexOf(')')).match(/([^\s,]+)/g);
}
try {
  Gtk.init(null);
  let prefui = new Preferences();
  Gtk.main();
} catch (e) {
  print(e)
}

