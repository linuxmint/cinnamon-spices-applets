// Copyright (C) 2014-2015 Lester Carballo Pérez <lestcape@gmail.com>
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

const St = imports.gi.St;
const Cogl = imports.gi.Cogl;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const Atk = imports.gi.Atk;
const Lang = imports.lang;
const Signals = imports.signals;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Params = imports.misc.params;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gdk = imports.gi.Gdk;
const DND = imports.ui.dnd;
//const Cairo = imports.cairo;

const Main = imports.ui.main;

const COLOR_FORMAT = {
   HEXA: 1,
   RGBA: 2,
   HSLA: 3,
   PIXL: 4
};

const SLIDER_SCROLL_STEP = 0.05; /* Slider scrolling step in % */

function SignalManager() {
   this._init.apply(this, arguments);
}

SignalManager.prototype = {

   _init: function(object) {
      this._object = object;
      this._storage = new Map();
   },

   connect: function(obj, sigName, callback, bind, force) {
      let id = 0;
      if(!this._storage.has(sigName))
         this._storage.set(sigName, []);
      if(bind)
         id = obj.connect(sigName, Lang.bind(bind, callback));
      else
         id = obj.connect(sigName, Lang.bind(this._object, callback));
      this._storage.get(sigName).push([obj, id, callback]);
      return id;
   },

   disconnect: function(sigName, obj, callbac) {
      if(!this._storage.has(sigName))
         return false;

      this._storage.get(sigName).forEach(Lang.bind(this, function (signal, i) {
         if((!obj || signal[0] == obj) &&
            (!callback || signal[2] == callback)) {
               signal[0].disconnect(signal[1]);
            this._storage.get(sigName).splice(i, 1);
         }
      }));

      if(this._storage.get(sigName).length == 0)
         this._storage.delete(sigName);
      return true;
   },

   disconnectAllSignals: function() {
      for(let signals of this._storage.values()) {
         for(let signal of signals) {
            signal[0].disconnect(signal[1]);
         }
      }
      this._storage.clear();
   },
  
   destroy: function() {
      this.disconnectAllSignals();
      this._storage = null;
   }
};

function ColorChooser() {
   this._init.apply(this, arguments);
}

ColorChooser.prototype = {
   _init: function(color, useClipboard) {
      try {
         this.actor = new St.BoxLayout({ vertical: true });
         this.actor._delegate = this;
         this._clipboard = St.Clipboard.get_default();
         this.useClipboard = (useClipboard == true);

         let [res, colorInit] = Clutter.Color.from_string("#FF0000FF");
         if(!color) {
            color = colorInit;
         }

         this.spectrum = new ScaleSpectrum(color, colorInit, [2, -1, 3, -2, 1, -3]);
         this.gradient = new GradientSelector(this.spectrum.value, color);
         this.opacity = new Slider(color.alpha);
         this.palette = new ColorPalette();
         this.savePalette = new ColorPalette();
         this.pickerIcon = new IconButton('color-chooser', St.IconType.FULLCOLOR, 20, 32, 32);
         this.saveButton = new IconButton('gtk-yes', St.IconType.FULLCOLOR, 20, 32, 32);
         this.colorInspector = new ColorInspector(color, 40, 28);

         let topActor = new St.BoxLayout({ vertical: false });
         let bottomActor = new St.BoxLayout({ vertical: false });

         let colorActor = new St.BoxLayout({ vertical: false });
         let selectionActor = new St.BoxLayout({ vertical: true });
         let opacityActor = new St.BoxLayout({ vertical: false });
         let saveActor = new St.BoxLayout({ vertical: false });

         let pickerBin = new St.Bin();
         let saveBin = new St.Bin();

         this.setSize(500, 300); // x = 380 300
         this.opacity.actor.style = "padding-right: 8px;";
         pickerBin.style = "padding: 8px 8px;";
         saveBin.style = "padding: 8px 8px;";

         pickerBin.set_child(this.pickerIcon.actor);
         saveBin.set_child(this.saveButton.actor);

         this.actor.add(topActor, {x_fill: true, y_fill: true, x_align: St.Align.START, y_align: St.Align.START, expand: true });
         this.actor.add(bottomActor);

         topActor.add(colorActor, {x_fill: true, y_fill: true, x_align: St.Align.START, y_align: St.Align.START, expand: true });
         topActor.add(selectionActor);

         bottomActor.add(opacityActor, {x_fill: true, y_fill: true, x_align: St.Align.START, y_align: St.Align.START, expand: true });
         bottomActor.add(saveActor);

         opacityActor.add(pickerBin);
         opacityActor.add(this.opacity.actor, {x_fill: true, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE, expand: true });

         saveActor.add(this.savePalette.actor, {x_fill: true, y_fill: false, x_align: St.Align.END, y_align: St.Align.MIDDLE });
         saveActor.add(saveBin, {x_fill: true, y_fill: false, x_align: St.Align.END, y_align: St.Align.MIDDLE });

         selectionActor.add(this.colorInspector.actor);
         selectionActor.add(this.palette.actor);

         colorActor.add(this.spectrum.actor);
         colorActor.add(this.gradient.actor, {x_fill: true, y_fill: true, x_align: St.Align.START, y_align: St.Align.START, expand: true });

         this.palette.loadDefault();
         this.savePalette.loadFromString("#00000000,#00000000,#00000000,#00000000,#00000000,#00000000");
         this._updateColor(color);

         this.signalManager = new SignalManager(this);
         this.signalManager.connect(this.spectrum, 'value-changed', this._onSpectrumColorChange);
         this.signalManager.connect(this.gradient, 'selected-color-changed', this._onGradientColorChange);
         this.signalManager.connect(this.opacity, 'value-changed', this._onOpacityColorChange);
         this.signalManager.connect(this.palette, 'select-color', this._onSelectedColorChange);
         this.signalManager.connect(this.savePalette, 'select-color', this._onSelectedColorChange);
         this.signalManager.connect(this.colorInspector, 'color-changed', this._onSelectedColorChange);
         this.signalManager.connect(this.colorInspector, 'color-format-changed', this._onColorFormatChange);
         this.pickerIcon.actor.connect('button-release-event', Lang.bind(this, this._executePicker));
         this.saveButton.actor.connect('button-release-event', Lang.bind(this, this._onColorSave));
      } catch (e) {
         global.logError(e);
      }
   },

   setSize: function(width, height) {
      this.actor.set_size(width, height);
   },

   setCurrentColor: function(color) {
      if(this.selectedColor != color) {
         this.spectrum.setValue(color);
         this.gradient.setGradientColor(this.spectrum.value);
         this.gradient.selectTargetColor(color);
         this._updateColor(color);
      }
   },

   setFocusKeyFocus: function(palette) {
      this.colorInspector.setFocusKeyFocus();
   },

   setFormat: function(format) {
      this.colorInspector.setFormat(format);
   },

   setSaveColors: function(palette) {
      let fixedPalette = ["#00000000","#00000000","#00000000","#00000000","#00000000","#00000000"];
      if(palette) {
         let paletteArray = palette.split(",");
         let maxValue = Math.min(6, paletteArray.length);
         for(let pos = 0; pos < maxValue; pos++) {
            fixedPalette[pos] = paletteArray[pos];
         }
      }
      let stringPalette = fixedPalette.join(",");
      this.savePalette.loadFromString(stringPalette);
   },

   saveToClipboard: function(useClipboard) {
      this.useClipboard = (useClipboard == true);
   },

   _executePicker: function() {
      let dropper = new EyeDropper(this, Lang.bind(this, this._onSelectedColorChange));
   },

   _onColorSave: function() {
      if(this.useClipboard) {
         let colorString = this.colorInspector.getStringColor();
         this._clipboard.set_text(colorString);
      }

      let color = this.colorInspector.value.to_string();
      this.savePalette.addColor(color);
      let stringPalette = this.savePalette.saveToString();
      this.emit('saved-color-changed', color, stringPalette);
   },

   _updateColor: function(color) {
      if(this.selectedColor != color) {
         this.selectedColor = color;
         let opacityValue = 255*this.opacity.value;
         if(opacityValue != color.alpha)
            color.alpha = opacityValue;
         this.colorInspector.setValue(color);
         this.emit('value-changed', color);
      }
   },

   _onColorFormatChange: function(inspector, format) {
      this.emit('color-format-changed', format);
   },

   _onOpacityColorChange: function(opacity, value) {
      let opacityValue = 255*this.opacity.value;
      if(opacityValue != this.selectedColor.alpha) {
         let [res, color] = Clutter.Color.from_string(this.selectedColor.to_string());
         color.alpha = opacityValue;
         this._updateColor(color);
      }
   },

   _onSelectedColorChange: function(actor, color) {
      this.setCurrentColor(color)
   },

   _onSpectrumColorChange: function(spectrum, color) {
      this.gradient.setGradientColor(color);
   },

   _onGradientColorChange: function(gradient, color) {
      this._updateColor(color);
   },

   destroy: function() {
      this.signalManager.destroy();
      this.spectrum.destroy();
      this.gradient.destroy();
      this.opacity.destroy();
      this.palette.destroy();
      this.savePalette.destroy();
      this.pickerIcon.destroy();
      this.saveButton.destroy();
      this.colorInspector.destroy();
      this.actor.destroy();
      this.emit('destroy');
   }
};
Signals.addSignalMethods(ColorChooser.prototype);

function Slider() {
   this._init.apply(this, arguments);
}

Slider.prototype = {

   _init: function(value, vertical) {
      this.actor = new St.Bin({ x_fill: true, y_fill: true, x_align: St.Align.START, reactive: true });
      this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));

      if (isNaN(value))
         value = 0;
      this._value = Math.max(Math.min(value, 1), 0);

      this.vertical = (vertical == true);

      this._slider = new St.DrawingArea({ style_class: 'popup-slider-menu-item', reactive: true });
      this._slider.set_size(-1, -1);
      this.actor.set_child(this._slider);
      this._slider.connect('repaint', Lang.bind(this, this._onActorRepaint));
      this.actor.connect('button-press-event', Lang.bind(this, this._startDragging));
      this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));

      this.actor._delegate = this;
      this._releaseId = this._motionId = 0;
      this._dragging = false;
   },

   setValue: function(value) {
      if (isNaN(value))
          value = 0;
      value = Math.max(Math.min(value, 1), 0); 
      if(this._value != value) {
         this._value = value;
         this._slider.queue_repaint();
         this._reportChange();
      }
   },

   _onActorRepaint: function(area) {
      let cr = area.get_context();
      let themeNode = area.get_theme_node();
      let [width, height] = area.get_surface_size();

      let handleRadius = themeNode.get_length('-slider-handle-radius');
      let sliderHeight = themeNode.get_length('-slider-height');
      let sliderBorderWidth = themeNode.get_length('-slider-border-width');
      let sliderBorderColor = themeNode.get_color('-slider-border-color');
      let sliderColor = themeNode.get_color('-slider-background-color');
      let sliderActiveBorderColor = themeNode.get_color('-slider-active-border-color');
      let sliderActiveColor = themeNode.get_color('-slider-active-background-color');

      let sliderBorderRadius, handleX, handleY, startX, startY, endX, endY, deltaX, deltaY, angle;
      if(this.vertical) {
         sliderBorderRadius = Math.min(height, sliderHeight) / 2;
         handleY = handleRadius + (height - 2 * handleRadius) * this._value;
         handleX = width / 2;
         startX = handleX;
         startY = sliderBorderRadius + sliderBorderWidth;
         endX = startX;
         endY = height - startY;
         deltaX = 0;
         deltaY = sliderBorderRadius;
         angle = Math.PI;
      } else {
         sliderBorderRadius = Math.min(width, sliderHeight) / 2;
         handleX = handleRadius + (width - 2 * handleRadius) * this._value;
         handleY = height / 2;
         startX = sliderBorderRadius + sliderBorderWidth;
         startY = handleY;
         endX = width - startX;
         endY = startY;
         deltaX = sliderBorderRadius;
         deltaY = 0;
         angle = Math.PI/2;
      }  

      cr.arc(startX, startY, sliderBorderRadius, angle, angle + Math.PI);
      cr.arc(handleX - deltaX, handleY - deltaY, sliderBorderRadius, angle + Math.PI, angle);
      Clutter.cairo_set_source_color(cr, sliderActiveColor);
      cr.fillPreserve();
      Clutter.cairo_set_source_color(cr, sliderActiveBorderColor);
      cr.setLineWidth(sliderBorderWidth);
      cr.stroke();

      cr.arc(endX, endY, sliderBorderRadius, angle + Math.PI, angle);
      cr.arc(handleX - deltaX, handleY - deltaY, sliderBorderRadius, angle, angle + Math.PI);
      Clutter.cairo_set_source_color(cr, sliderColor);
      cr.fillPreserve();
      Clutter.cairo_set_source_color(cr, sliderBorderColor);
      cr.setLineWidth(sliderBorderWidth);
      cr.stroke();

      let color = themeNode.get_foreground_color();
      Clutter.cairo_set_source_color(cr, color);
      cr.arc(handleX, handleY, handleRadius, 0, 2 * Math.PI);
      cr.fill();

      cr.$dispose();
   },

   _startDragging: function(actor, event) {
      if (this._dragging) // don't allow two drags at the same time
         return;

      this.emit('drag-begin');
      this._dragging = true;

      // FIXME: we should only grab the specific device that originated
      // the event, but for some weird reason events are still delivered
      // outside the slider if using clutter_grab_pointer_for_device
      Clutter.grab_pointer(this._slider);
      this._releaseId = this._slider.connect('button-release-event', Lang.bind(this, this._endDragging));
      this._motionId = this._slider.connect('motion-event', Lang.bind(this, this._motionEvent));
      let absX, absY;
      [absX, absY] = event.get_coords();
      this._moveHandle(absX, absY);
   },

   _endDragging: function() {
      if (this._dragging) {
         this._slider.disconnect(this._releaseId);
         this._slider.disconnect(this._motionId);

         Clutter.ungrab_pointer();
         this._dragging = false;

         this.emit('drag-end');
      }
      return true;
   },

   _onScrollEvent: function(actor, event) {
      let direction = event.get_scroll_direction();

      if (direction == Clutter.ScrollDirection.DOWN) {
         this._value = Math.max(0, this._value - SLIDER_SCROLL_STEP);
      }
      else if (direction == Clutter.ScrollDirection.UP) {
         this._value = Math.min(1, this._value + SLIDER_SCROLL_STEP);
      }

      this._slider.queue_repaint();
      this._reportChange();
   },

   _reportChange: function() {
      this.emit('value-changed', this._value);
   },

   _motionEvent: function(actor, event) {
      let absX, absY;
      [absX, absY] = event.get_coords();
      this._moveHandle(absX, absY);
      return true;
   },

   _moveHandle: function(absX, absY) {
      let relX, relY, sliderX, sliderY;
      [sliderX, sliderY] = this._slider.get_transformed_position();
      relX = absX - sliderX;
      relY = absY - sliderY;

      let handleRadius = this._slider.get_theme_node().get_length('-slider-handle-radius');

      let newvalue;
      if(this.vertical) {
         let height = this._slider.height;
         if (relY < handleRadius)
            newvalue = 0;
         else if (relY > height - handleRadius)
            newvalue = 1;
         else
            newvalue = (relY - handleRadius) / (height - 2 * handleRadius);
      } else {
         let width = this._slider.width;
         if (relX < handleRadius)
            newvalue = 0;
         else if (relX > width - handleRadius)
            newvalue = 1;
         else
            newvalue = (relX - handleRadius) / (width - 2 * handleRadius);
      }
      this._value = newvalue;
      this._slider.queue_repaint();
      this._reportChange();
   },

   get value() {
      return this._value;
   },

   _onKeyPressEvent: function(actor, event) {
      let key = event.get_key_symbol();
      if (key == Clutter.KEY_Right || key == Clutter.KEY_Left) {
         let delta = key == Clutter.KEY_Right ? 0.1 : -0.1;
         this._value = Math.max(0, Math.min(this._value + delta, 1));
         this._slider.queue_repaint();
         this._reportChange();
         this.emit('drag-end');
         return true;
      }
      return false;
   },

   destroy: function() {
      this.actor.destroy();
      this.emit('destroy');
   }
};
Signals.addSignalMethods(Slider.prototype);

function Scale() {
   this._init.apply(this, arguments);
}

Scale.prototype = {
   __proto__: Slider.prototype,

   _init: function(value, vertical) {
      Slider.prototype._init.call(this, value, vertical);
      this._slider.add_style_class_name('popup-scale-menu-item');
      this._slider.style = "min-width: 20px; min-height: 20px;";
      this.actor._delegate = this;
   },

   _onActorRepaint: function(area) {
      let cr = area.get_context();
      let themeNode = area.get_theme_node();
      let [width, height] = area.get_surface_size();

      let handleRadius = themeNode.get_length('-slider-handle-radius');
      let sliderHeight = themeNode.get_length('-slider-height');
      let sliderBorderWidth = themeNode.get_length('-slider-border-width');
      let sliderBorderColor = themeNode.get_color('-slider-border-color');
      let sliderColor = themeNode.get_color('-slider-background-color');
      let sliderActiveBorderColor = themeNode.get_color('-slider-active-border-color');
      let sliderActiveColor = themeNode.get_color('-slider-active-background-color');

      let sliderBorderRadius, handleX, handleY, startX, startY, endX, endY, deltaX, deltaY, angle;
      if(this.vertical) {
         sliderBorderRadius = Math.min(height, sliderHeight) / 2;
         handleY = handleRadius + (height - 4 * handleRadius) * this._value;
         handleX = width / 2;
         startX = handleX;
         startY = sliderBorderRadius + sliderBorderWidth + handleRadius;
         endX = startX;
         endY = height - startY;
         deltaX = 0;
         deltaY = sliderBorderRadius;
         angle = Math.PI;

         cr.arc(startX, startY, sliderBorderRadius, angle, angle + Math.PI);
         cr.arc(endX, endY, sliderBorderRadius, angle + Math.PI, angle);
         cr.lineTo(startX - sliderBorderRadius, startY);

         Clutter.cairo_set_source_color(cr, sliderColor);
         cr.fillPreserve();
         Clutter.cairo_set_source_color(cr, sliderBorderColor);
         cr.setLineWidth(sliderBorderWidth);
         cr.stroke();

         let color = themeNode.get_foreground_color();
         Clutter.cairo_set_source_color(cr, color);


         cr.lineTo(handleX, handleY + 2*handleRadius);
         cr.lineTo(handleX + handleRadius + sliderHeight, handleY + handleRadius);
         cr.lineTo(handleX, handleY);
         cr.lineTo(handleX - sliderHeight, handleY);
         cr.lineTo(handleX - sliderHeight, handleY + 2*handleRadius);
         cr.fill();
      } else {
         sliderBorderRadius = Math.min(width, sliderHeight) / 2;
         handleX = handleRadius + (width - 4 * handleRadius) * this._value;
         handleY = height / 2;
         startX = sliderBorderRadius + sliderBorderWidth + handleRadius;
         startY = handleY;
         endX = width - startX;
         endY = startY;
         deltaX = sliderBorderRadius;
         deltaY = 0;
         angle = Math.PI/2;

         cr.arc(startX, startY, sliderBorderRadius, angle, angle + Math.PI);
         cr.arc(endX, endY, sliderBorderRadius, angle + Math.PI, angle);
         cr.lineTo(startX - sliderBorderRadius, startY);

         Clutter.cairo_set_source_color(cr, sliderColor);
         cr.fillPreserve();
         Clutter.cairo_set_source_color(cr, sliderBorderColor);
         cr.setLineWidth(sliderBorderWidth);
         cr.stroke();

         let color = themeNode.get_foreground_color();
         Clutter.cairo_set_source_color(cr, color);

         cr.lineTo(handleX, handleY);
         cr.lineTo(handleX + handleRadius, handleY - handleRadius - sliderHeight);
         cr.lineTo(handleX + 2*handleRadius, handleY);
         cr.lineTo(handleX + 2*handleRadius, handleY + sliderHeight);
         cr.lineTo(handleX, handleY + sliderHeight);
         cr.fill();
      }
      cr.$dispose();
   }
};

function ScaleSpectrum() {
   this._init.apply(this, arguments);
}

ScaleSpectrum.prototype = {
   __proto__: Scale.prototype,

   _init: function(color, initColor, sequence) {
      Scale.prototype._init.call(this, 0, true);

      this._scale = this.actor;
      this._slider.add_style_class_name('color-scale');
      this.actor = new Cinnamon.GenericContainer({ reactive: true });
      this.actor._delegate = this;
      this._container = new St.Bin({ style_class: 'color-spectrum', x_fill: true, y_fill: true, x_align: St.Align.START });
      this._data = new Array(4*(sequence.length*255 + 1));
      this._imageActor = this._getSpectrumImage();
      this._generateSpectrum(initColor, sequence);
      this._container.set_child(this._imageActor);
      this._imageActor.set_reactive(true);

      let [hue, luminance, saturation] = color.to_hls();
      this._value = (hue/360);

      this.actor.add_actor(this._container);
      this.actor.add_actor(this._scale);

      this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
      this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
      this.actor.connect('allocate', Lang.bind(this, this._allocate));
   },

   _reportChange: function() {
      this.emit('value-changed', this.value);
   },

   _getSpectrumImage: function() {
      let coverImage = new Clutter.Image();
      let imageActor = new Clutter.Actor();
      imageActor.set_content_scaling_filters(
         Clutter.ScalingFilter.TRILINEAR,
         Clutter.ScalingFilter.LINEAR);
      imageActor.set_content(coverImage);
      return imageActor;
   },

   get value() {
      let colorPos = 4*parseInt(this._value*this._data.length/4);
      if(colorPos > this._data.length - 4)
         colorPos = this._data.length - 4;
      let color = Clutter.Color.new(this._data[colorPos], this._data[colorPos + 1], this._data[colorPos + 2], 255);
      return color;
   },

   setValue: function(color) {
      let [hue, luminance, saturation] = color.to_hls();
      let value = (hue/360);
      if((value != -1)&&(this._value != value)) {
         Scale.prototype.setValue.call(this, value);
      }
   },

   setSize: function(width, height) {
      this.actor.set_size(width, height);
   },

   _generateSpectrum: function(initColor, sequence) {
      let pos; let sign = 0; let index = 0;
      let color = [initColor.red, initColor.green, initColor.blue];
      let maxValue = this._data.length/4;
      let selected = Math.abs(sequence[index]) - 1;
      for (let x = 0; x < maxValue; x++) {
         if(index <= sequence.length) {
            pos = 4 * x;
            color[selected] += sign;
            if(x % 255 == 0) {
               selected = Math.abs(sequence[index]) - 1;
               sign = (sequence[index] > 0) ? 1 : -1;
               index++;
            }
            this._data[pos + 0] = color[0]; //red
            this._data[pos + 1] = color[1]; //green;
            this._data[pos + 2] = color[2]; //blue;
            this._data[pos + 3] = 255;//255 - x;//opacity
         } else {
            break;
         }
      }
      let pixelFormat = Cogl.PixelFormat.RGBA_8888;// Cogl.PixelFormat.RGB_888;
      let rowstride = 4;
      this._imageActor.content.set_data(this._data, pixelFormat, 1, maxValue, rowstride);
      //let pixbuf = GdkPixbuf.Pixbuf.new_from_data(this._data, GdkPixbuf.Colorspace.RGB, true, 8, 1, maxValue, rowstride, null);
      //this._imageActor.content.set_data(pixbuf.get_pixels(), pixelFormat, 1, maxValue, rowstride);
   },

   _getPreferredWidth: function(actor, forHeight, alloc) {
      let [cMin, cNatural] = this._container.get_preferred_width(-1);
      let [sMin, sNatural] = this._scale.get_preferred_width(-1);
      let width = cNatural + sNatural;
      alloc.min_size = alloc.natural_size = width;
   },

   _getPreferredHeight: function(actor, forWidth, alloc) {
      let [cChildMin, cChildWidth] = this._container.get_preferred_width(-1);
      let [cMin, cNatural] = this._container.get_preferred_height(cChildWidth);
      let [sChildMin, sChildWidth] = this._scale.get_preferred_width(-1);
      let [sMin, sNatural] = this._scale.get_preferred_height(sChildWidth);
      let height = cNatural + sNatural;
      alloc.min_size = alloc.natural_size = height;
   },

   _allocate: function(actor, box, flags) {
      let themeNode = this._slider.get_theme_node();
      let handleRadius = themeNode.get_length('-slider-handle-radius');

      let cChildBox = new Clutter.ActorBox();
      let sChildBox = new Clutter.ActorBox();
      let maxHeight = Math.max(box.y2, box.y1 + this._scale.height, box.y1 + this._container.height);
      sChildBox.x1 = box.x1;
      sChildBox.x2 = box.x1 + this._scale.width;
      sChildBox.y1 = box.y1;
      sChildBox.y2 = maxHeight;
      cChildBox.x1 = sChildBox.x2 - this._scale.width/2 + 4;
      cChildBox.x2 = sChildBox.x2 + this._container.width - this._scale.width/2 + 4;
      cChildBox.y1 = box.y1 + 2*handleRadius;
      cChildBox.y2 = maxHeight - 2*handleRadius;
      this._container.allocate(cChildBox, flags);
      this._scale.allocate(sChildBox, flags);
   },

   destroy: function() {
      this._data = null;
      this.actor.destroy();
      this.emit('destroy');
   }
};
Signals.addSignalMethods(ScaleSpectrum.prototype);

function GradientSelector() {
   this._init.apply(this, arguments);
}

GradientSelector.prototype = {

   _init: function(color, selectedColor) {
      this.actor = new Cinnamon.GenericContainer({ style_class: 'color-gradient', reactive: true });
      this.actor._delegate = this;
      this._container = new St.Bin({ x_fill: true, y_fill: true, x_align: St.Align.START });
      this._cursor = new CursorColor(16);   

      this._targetX = 0;
      this._targetY = 0;
      this._currentBox = null;
      this._currentFlags = null;
      this._dragging = false;
      this._motionId = 0;
      this._releaseId = 0;
      this._isInUpdate = false;
      this._updateIsNeeded = false;

      this._color = color;
      this._selectedColor = selectedColor;

      this._data = new Array(4*256*256);
      this._imageActor = this._getGradientImage();
      this._container.set_child(this._imageActor);
      this._imageActor.set_reactive(true);
      this._initGradient();

      this.actor.add_actor(this._container);
      this.actor.add_actor(this._cursor.actor);

      this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
      this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
      this.actor.connect('allocate', Lang.bind(this, this._allocate));
      this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));
   },

   setGradientColor: function(color) {
      if((!this._color)||(!this._color.equal(color))) {
         this._color = color;
         this._updateColor(color);
         this._imageActor.content.set_data(this._data, Cogl.PixelFormat.RGBA_8888, 256, 256, 1024);
         this._setHandle(this._targetX, this._targetY);
         this.emit('gradient-color-changed', color);
      }
   },

   selectTargetColor: function(color) {
     if((!this._selectedColor)||(!this._selectedColor.equal(color))) {
         this._selectedColor = color;
         let pos = this._getPosFromColor(color);
         if(pos != -1)
            this._setHandle((pos/4)%256, pos/(4*256));
      }
   },

   setTargetColorWithGradient: function(gradientColor, color) {
      this.setGradientColor(gradientColor);
      this.selectTargetColor(color);
   },

   setSize: function(width, height) {
      this.actor.set_size(width, height);
   },

   _initGradient: function() {
      this._updateColor(this._color);
      this._cursor.setColor(this._selectedColor);
      this._imageActor.content.set_data(this._data, Cogl.PixelFormat.RGBA_8888, 256, 256, 1024);
      let pos = this._getPosFromColor(this._selectedColor);
      if(pos != -1) {
         this._targetX = Math.round((pos/4)%256);
         this._targetY = Math.round(pos/(4*256));
      }
   },

   _getGradientImage: function() {
      let coverImage = new Clutter.Image();
      let imageActor = new Clutter.Actor();
      imageActor.set_content_scaling_filters(
         Clutter.ScalingFilter.TRILINEAR,
         Clutter.ScalingFilter.LINEAR);
      imageActor.set_content(coverImage);
      return imageActor;
   },

   // FIXME: This is a replacement for _findColorPos
   // as can fail and this not iterates over all colors.
   // We can find a color position if we resolve a not 
   // linear system equation, but with more equation than
   // variables. Then how to find a good approximation 
   // for the indeterminate system equation?
   _estimateColorPos: function(sColor, color) {
      let positions = [];
      positions.push(this._findForColor(sColor.red, sColor.blue, color.red, color.blue));
      positions.push(this._findForColor(sColor.red, sColor.green, color.red, color.green));
      positions.push(this._findForColor(sColor.blue, sColor.green, color.blue, color.green));
      let posX = 0;
      let posY = 0;
      let count = 0;
      for(let pos in positions) {
         if(positions[pos]) {
            posX += positions[pos][0];
            posY += positions[pos][1];
            count++
         }
      }
      if(count > 0)
         return 4 *(256 * posY + posX)/count;
      return -1;
   },

   _findForColor: function(sColor1, sColor2, color1, color2) {
      let d = color1*(255 - sColor2) - color2*(255 - sColor1);
      let x = -1;
      if(d > 0) {
         let y = Math.round(255*(color2*sColor1 - color1*sColor2)/d);
         if(y > 0) {
            if(color1 > 0)
               x = Math.round(255*(1 - 255*color1/(255*sColor1 + y*(255 - sColor1))));
            else
               x = Math.round(255*(1 - 255*color2/(255*sColor2 + y*(255 - sColor2))));
            if(x >= 0)
               return [x, y];
         }
      }
      return null;
   },

   _findColorPos: function(color) {
     let pos;
     for (let y = 0; y < 256; y++) {
         for (let x = 0; x < 256; x++) {
            pos = 4 *(256 * y + x);
            if((color.red == this._data[pos]) &&
               (color.green == this._data[pos + 1]) &&
               (color.blue == this._data[pos + 2])) {
               return pos;
            }
         }
      }
      return -1;
   },

   _updateColor: function(color) {
      if(!this._isInUpdate) {
         this._isInUpdate = true;
         let red, green, blue, redY, blueY, greenY, pos;
         for (let y = 0; y < 256; y++) {
            redY = color.red + y - y*color.red/255;
            greenY = color.green + y - y*color.green/255;
            blueY = color.blue + y - y*color.blue/255;
            for (let x = 0; x < 256; x++) {
               red = redY - x*redY/255;
               green = greenY - x*greenY/255;
               blue = blueY - x*blueY/255;
               pos = 4 *(256 * y + x);
               this._data[pos + 0] = Math.round(red);//red
               this._data[pos + 1] = Math.round(green);
               this._data[pos + 2] = Math.round(blue);//blue
               this._data[pos + 3] = 255;//255 - x;//opacity
               /*if(pos == 0) {
                   Main.notify("found:" + this._data[pos + 0] + " " + this._data[pos + 1] + " " + this._data[pos + 2])
                   Main.notify("color:" + color.red + " " + color.green + " " + color.blue)
               }
               if((this._selectedColor)&&(this._selectedColor.red == this._data[pos]) &&
                  (this._selectedColor.green == this._data[pos + 1]) &&
                  (this._selectedColor.blue == this._data[pos + 2])) {
                  Main.notify("is there")
               }*/
            }
         }
         if(this._updateIsNeeded) {
            this._updateIsNeed = false;
            this._updateColor(this._color);
         }
         this._isInUpdate = false;
      } else {
         this._updateIsNeeded = true;
      }
   },

   _getPosFromColor: function(color) {
      let pos = this._findColorPos(color);
      if(pos == -1)
         pos = this._estimateColorPos(this._color, color);
      if(pos == -1) {
         global.logError("Fail to found position");
         //Main.notify("Fail to found position");
      }
      return pos;
   },

   _getColorAtPos: function(posX, posY) {
      let colorPosX = parseInt((posX/256)*255);
      let colorPosY = parseInt((posY/256)*255);
      let colorPos = 4 *(256 * colorPosY + colorPosX);
      let color = Clutter.Color.new(this._data[colorPos], this._data[colorPos + 1], this._data[colorPos + 2], 255);
      return color;
   },

   _getPreferredWidth: function(actor, forHeight, alloc) {
      let [min, natural] = this._container.get_preferred_width(-1);
      alloc.min_size = alloc.natural_size = natural;
   },

   _getPreferredHeight: function(actor, forWidth, alloc) {
      let [childMin, childWidth] = this._container.get_preferred_width(-1);
      let [min, natural] = this._container.get_preferred_height(childWidth);
      alloc.min_size = alloc.natural_size = natural;
   },

   _onButtonPressEvent: function(actor, event) {
      if (this._dragging) // don't allow two drags at the same time
         return;

      this.emit('drag-begin');
      this._dragging = true;

      // FIXME: we should only grab the specific device that originated
      // the event, but for some weird reason events are still delivered
      // outside the slider if using clutter_grab_pointer_for_device
      Clutter.grab_pointer(this._imageActor);
      this._releaseId = this._imageActor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
      this._motionId = this._imageActor.connect('motion-event', Lang.bind(this, this._motionEvent));
      let [absX, absY] = event.get_coords();
      this._moveHandle(absX, absY);
   },

   _onButtonReleaseEvent: function(actor, event) {
      if (this._dragging) {
         this._imageActor.disconnect(this._releaseId);
         this._imageActor.disconnect(this._motionId);

         Clutter.ungrab_pointer();
         this._dragging = false;

         this.emit('drag-end');
      }
      return true;
   },

   _motionEvent: function(actor, event) {
      let absX, absY;
      [absX, absY] = event.get_coords();
      this._moveHandle(absX, absY);
      return true;
   },

   _moveHandle: function(mX, mY) {
      let [aX, aY] = this._container.get_transformed_position();
      let [aW, aH] = this._container.get_transformed_size();
      let posX = mX - aX;
      let posY = mY - aY;
      if((posX < 0)||(posX >= aW)||(posY < 0)||(posY >= aH)) {
         if(posX < 0) posX = 0;
         if(posY < 0) posY = 0;
         if(posX > aW) posX = aW;
         if(posY > aH) posY = aH;
      }
      this._setHandle(256*posX/aW, 256*posY/aH);
   },

   _setHandle: function(posX, posY) {
      this._targetX = Math.round(posX);
      this._targetY = Math.round(posY);
      let color = this._getColorAtPos(this._targetX, this._targetY);
      if((!this._selectedColor) || (color != this._selectedColor)) {
         this._selectedColor = color;
         this._cursor.setColor(color);
         this.actor.queue_relayout();
         this.emit('selected-color-changed', color);
      }
   },

   _allocate: function(actor, box, flags) {
      let posX = (box.x2 - box.x1)*this._targetX/256;
      let posY = (box.y2 - box.y1)*this._targetY/256;
      this._container.allocate(box, flags);
      this._currentBox = box;
      this._currentFlags = flags;
      let [minWidth, minHeight, naturalWidth, naturalHeight] = this._cursor.actor.get_preferred_size();
      let childBox = new Clutter.ActorBox();
      childBox.x1 = this._currentBox.x1 + posX - naturalWidth/2;
      childBox.x2 = childBox.x1 + naturalWidth;
      childBox.y1 = this._currentBox.y1 + posY - naturalHeight/2;
      childBox.y2 = childBox.y1 + naturalHeight;
      this._cursor.actor.allocate(childBox, this._currentFlags);
   },

   destroy: function() {
      this._data = null;
      this.actor.destroy();
      this.emit('destroy');
   }
};
Signals.addSignalMethods(GradientSelector.prototype);

function CursorColor() {
   this._init.apply(this, arguments);
}

CursorColor.prototype = {
   _init: function(size, color, forScreen) {
      this.actor = new St.DrawingArea({ style_class: 'color-cursor', reactive: true });
      this.actor.set_size(size, size);
      this.actor.connect('repaint', Lang.bind(this, this._onCursorRepaint));
      this._color = color;
      let [resW, blackColor] = Clutter.Color.from_string("#000000");
      let [resB, whiteColor] = Clutter.Color.from_string("#FFFFFF");
      this._whiteColor = whiteColor;
      this._blackColor = blackColor;
      if(!this._color) {
         this._color = whiteColor;
      }
      let [cursorColor, borderColor] = this._getCursorColors(this._color);
      this._cursorColor = cursorColor;
      this._borderColor = borderColor;
      this.allocId = 0;
      this.setForScreen(forScreen);
   },

   getColor: function() {
      return this._color;
   },

   show: function() {
      this.actor.show();
   },

   hide: function() {
      this.actor.hide();
   },

   setColor: function(color) {
      if(!this._color.equal(color)) {
         this._color = color;
         this._updateCursorColor();
      }
   },

   setForScreen: function(forScreen) {
      if(forScreen) {
         if(this.allocId == 0)
            this.allocId = this.actor.connect('allocation_changed', Lang.bind(this, this._onAllocationChanged));
      } else {
         if(this.allocId > 0) {
            this.actor.disconnect(this.allocId);
            this.allocId = 0;
         }
      }
   },

   isForScreen: function() {
      return (this.allocId != 0);
   },

   setSize: function(size) {
      this.actor.set_size(size, size);
   },

   getSize: function() {
      return Math.min(this.actor.width, this.actor.height);
   },

   getColorForScreen: function() {
      let [mX, mY, mask] = global.get_pointer();
      let size = this.getSize();
      let window = Gdk.Screen.get_default().get_root_window();
      let pixbuf = Gdk.pixbuf_get_from_window(window, mX + size/2, mY + size/2, 1, 1);
      let data = pixbuf.get_pixels();
      return Clutter.Color.new(data[0], data[1], data[2], 255);
   },
   
   _getCursorColors: function(color) {
      let sum = (color.red + color.green + color.blue);
      if(sum > 534)
         return [this._whiteColor, this._blackColor];
      return [this._blackColor, this._whiteColor];
   },

   _updateCursorColor: function() {
      let [cursorColor, borderColor] = this._getCursorColors(this._color);
      this._cursorColor = cursorColor;
      this._borderColor = borderColor;
      this.actor.queue_repaint();
   },

   _onAllocationChanged: function() {
      let color = this.getColorForScreen();
      if(!this._color.equal(color)) {
         this._color = color;
         this._updateCursorColor();
      }
   },

   _onCursorRepaint: function(area) {
      let cr = area.get_context();
      let themeNode = area.get_theme_node();
      let [width, height] = area.get_surface_size();
      let size = Math.min(width, height);
      let middle = size/2;
      let radius = 3;
        
      cr.setLineWidth(3);
      Clutter.cairo_set_source_color(cr, this._cursorColor);
      cr.lineTo(middle, 0);
      cr.lineTo(middle, middle - radius);
      cr.stroke();
      cr.lineTo(middle, size);
      cr.lineTo(middle, middle + radius);
      cr.stroke();
      cr.lineTo(0, middle);
      cr.lineTo(middle - radius, middle);
      cr.stroke();
      cr.lineTo(size, middle);
      cr.lineTo(middle + radius, middle);
      cr.stroke();


      cr.setLineWidth(2);
      Clutter.cairo_set_source_color(cr, this._borderColor);
      cr.lineTo(middle, 0);
      cr.lineTo(middle, middle - radius);
      cr.stroke();
      cr.lineTo(middle, size);
      cr.lineTo(middle, middle + radius);
      cr.stroke();
      cr.lineTo(0, middle);
      cr.lineTo(middle - radius, middle);
      cr.stroke();
      cr.lineTo(size, middle);
      cr.lineTo(middle + radius, middle);
      cr.stroke();

      cr.setLineWidth(2);
      cr.arc(middle, middle, radius + 1, 0, 2 * Math.PI);
      cr.stroke();

      cr.setLineWidth(radius);
      Clutter.cairo_set_source_color(cr, this._color);
      cr.arc(middle, middle, 1, 0, 2 * Math.PI);
      cr.stroke();

      cr.$dispose();
   },

   destroy: function() {
      this.actor.destroy();
      this.emit('destroy');
   }
};
Signals.addSignalMethods(CursorColor.prototype);

function EyeDropper() {
   this._init.apply(this, arguments);
}

EyeDropper.prototype = {
   _init: function(colorChooser, callback) {
      try {
         this.menu = this._findTopMenu(colorChooser);
         this._realSourceContains = null;
         this._callback = callback;
         let [res, selectedColor] = Clutter.Color.from_string("#FFFFFF");
         this._cursor = new CursorColor(16, selectedColor, true);
         this._xfixesCursor = Cinnamon.XFixesCursor.get_for_stage(global.stage);

         this.signalManager = new SignalManager(this);
         this.signalManager.connect(global.stage, 'captured-event', this._onStageEvent);
         this.signalManager.connect(global.stage, 'enter-event', this._onStageEvent);
         this.signalManager.connect(global.stage, 'leave-event', this._onStageEvent);

         this.actor = new St.Group({ visible: false, x: 0, y: 0 });
         Main.uiGroup.add_actor(this.actor);
         global.focus_manager.add_group(this.actor);

         let constraint = new Clutter.BindConstraint({ source: global.stage,
                                                       coordinate: Clutter.BindCoordinate.POSITION | Clutter.BindCoordinate.SIZE });
         this.actor.add_constraint(constraint);
         this.actor.add_actor(this._cursor.actor);

         if((this.menu) && (this.menu.sourceActor)) {
            this._realSourceContains = this.menu.sourceActor.contains;
            this.menu.sourceActor.contains = function() { return true; }
            DND.currentDraggable = global.stage.key_focus;
         }
         global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
         this._xfixesCursor.hide();
         this.actor.show();
      } catch(e) {
         global.logError(e);
      }
   },

   _findTopMenu: function(colorChooser) {
      let actor = colorChooser.actor.get_parent();
      while(actor != null) {
         if((actor.get_parent() == Main.uiGroup))
            return actor._delegate;
         actor = actor.get_parent();
      }
      return null;
   },

   _moveHandle: function(mX, mY) {
      this._cursor.actor.x = mX;
      this._cursor.actor.y = mY;
      this._cursor.actor.queue_relayout();
   },
    
   _onStageEvent: function(actor, event) {
      try {
         if(event.type) {
            let type = event.type();
            if((type == Clutter.EventType.KEY_PRESS) || (type == Clutter.EventType.KEY_RELEASE)) {
               if(event.get_key_symbol() == Clutter.Escape) {
                  this._pickedColor();
                  return true;
               }
               return false;
            }
            if(type == Clutter.EventType.BUTTON_RELEASE) {
               this._pickedColor();
               return true;
            }
            if(type == Clutter.EventType.MOTION) {
               let [absX, absY] = event.get_coords();
               this._moveHandle(absX, absY);
            }
         }
         return true;
      } catch(e) {
         global.logError(e);
      }

      return true;
   },

   _pickedColor: function() {
      let color = this._cursor.getColorForScreen();
      this._callback(this, color);
      this.emit("picked-color", color);
      this.destroy();
   },

   destroy: function() {
      this.signalManager.destroy();
      global.focus_manager.remove_group(this.actor);
      Main.uiGroup.remove_actor(this.actor);

      global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
      if((this.menu) && (this.menu.sourceActor)) {
         global.stage.set_key_focus(this.menu.actor);
         this.menu.sourceActor.contains = this._realSourceContains;
         DND.currentDraggable = null;
         global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
      }
      this.menu = null;
      this._xfixesCursor.show();
      this._cursor.destroy();
      this._cursor = null;
      this.actor.destroy();
      this.emit("destroy");
   }
};
Signals.addSignalMethods(EyeDropper.prototype);

function Button() {
   this._init.apply(this, arguments);
}

Button.prototype = {
   _init: function(label, width, height) {
      this.actor = new St.Button({
         style_class: 'modal-dialog-button',
         reactive:    true,
         //can_focus:   true,
         x_fill:      true,
         y_fill:      true,
         label:       label
      });
      this.actor._delegate = this;
      this._label = label;
      this.actor.set_size(width, height);
   },

   setSize: function(width, height) {
      this.actor.set_size(width, height);
   },

   destroy: function() {
      this.actor.destroy();
      this.emit("destroy");
   }
};
Signals.addSignalMethods(Button.prototype);

function ColorButton() {
   this._init.apply(this, arguments);
}

ColorButton.prototype = {
   __proto__: Button.prototype,

   _init: function(color, width, height) {
      Button.prototype._init.call(this, "", width, height);
      this.actor._delegate = this;
      this.actor.add_style_class_name('color-button');
      this._colorBox = new St.Bin({ style_class: 'color-button-box', x_fill: true, y_fill: true, x_align: St.Align.START });
      this.actor.style = "padding: 2px 2px; border-radius: 6px;";
      this.actor.set_child(this._colorBox);
      this.setValue(color);
   },

   get value() {
      return this.color;
   },

   setValue: function(color) {
      if(this.color != color) {
         this.color = color;
         let style = "background-color: rgba(%s,%s,%s,%s);".format(
            this.color.red,
            this.color.green,
            this.color.blue,
            this.color.alpha/255
         );
         this._colorBox.style = style;
      }
   }
};

function IconButton() {
   this._init.apply(this, arguments);
}

IconButton.prototype = {
   __proto__: Button.prototype,

   _init: function(iconName, iconType, iconSize, width, height) {
      Button.prototype._init.call(this, "", width, height);
      this.actor._delegate = this;
      this.actor.add_style_class_name('button-icon');
      if(!iconType)
         iconType = St.IconType.FULLCOLOR;
      this.icon = new St.Icon({ icon_name: iconName, icon_type: iconType });

      this.actor.style = "padding: 2px 2px; border-radius: 6px;";
      this.actor.set_child(this.icon);
      this.icon.set_icon_size(iconSize);
   }
};

function ColorPalette() {
   this._init.apply(this, arguments);
}

ColorPalette.prototype = {
   _init: function(palette) {
      this.actor = new St.BoxLayout({ style_class: 'color-palette', vertical: true });
      this.actor._delegate = this;

      this._buttons = new Array();
      this._palette = palette;
      if(this._palette)
         this._buildPalete();
   },

   loadDefault: function() {
      this._palette = [
         ["#000"   , "#444"   , "#666"   , "#999"   , "#ccc"   , "#eee"   , "#f3f3f3", "#fff"   ],
         ["#f00"   , "#f90"   , "#ff0"   , "#0f0"   , "#0ff"   , "#00f"   , "#90f"   , "#f0f"   ],
         ["#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#cfe2f3", "#d9d2e9", "#ead1dc"],
         ["#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#9fc5e8", "#b4a7d6", "#d5a6bd"],
         ["#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6fa8dc", "#8e7cc3", "#c27ba0"],
         ["#c00"   , "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3d85c6", "#674ea7", "#a64d79"],
         ["#900"   , "#b45f06", "#bf9000", "#38761d", "#134f5c", "#0b5394", "#351c75", "#741b47"],
         ["#600"   , "#783f04", "#7f6000", "#274e13", "#0c343d", "#073763", "#20124d", "#4c1130"]
      ];
      this._buildPalete();
   },

   loadFromString: function(stringPalette) {
      let colors;
      let colorRows = stringPalette.split("::");
      let palette = new Array();
      for(let row in colorRows) {
         colors = colorRows[row].split(",");
         palette.push(colors);
      }
      this._palette = palette;
      this._buildPalete();
   },

   saveToString: function() {
      let colorRows = new Array();
      for(let row in this._palette)
         colorRows.push(this._palette[row].join(','));
      return colorRows.join('::');
   },

   addColor: function(colorString) {
      let paletteRow;
      for(let posRow = this._palette.length - 1; posRow > 0; posRow--) {
         paletteRow = this._palette[posRow];
         for(let pos = paletteRow.length - 1; pos > 0; pos--) {
            paletteRow[pos] = paletteRow[pos - 1];
         }
         paletteRow[0] = this._palette[posRow - 1][this._palette[posRow - 1].length - 1];
      }
      paletteRow = this._palette[this._palette.length -1];
      for(let pos = paletteRow.length - 1; pos > 0; pos--) {
         paletteRow[pos] = paletteRow[pos - 1];
      }
      paletteRow = this._palette[0][0] = colorString;
      this._fillPalete();
   },

   _fillPalete: function() {
      let paletteRow, actorRow, bbt, color, children, actorColor;
      let [result, defaultColor] = Clutter.Color.from_string("#00000000");
      let rowChildren = this.actor.get_children();
      for(let posRow in rowChildren) {
         actorRow = rowChildren[posRow];
         paletteRow = this._palette[posRow];
         children = actorRow.get_children();
         for(let pos in children) {
            actorColor = children[pos];
            let [res, selectedColor] = Clutter.Color.from_string(paletteRow[pos]);
            if(res)
               color = selectedColor;
            else
               color = defaultColor;
            actorColor._delegate.setValue(color);
            actorColor._delegate.actor.remove_style_pseudo_class('disabled');
            actorColor._delegate.actor.set_reactive(true);
            if(color.alpha == 0) {
               actorColor._delegate.actor.add_style_pseudo_class('disabled');
               actorColor._delegate.actor.set_reactive(false);
            }
         }
      }
   },

   _buildPalete: function() {
      let paletteRow, actorRow, bbt, color;
      let [result, defaultColor] = Clutter.Color.from_string("#00000000");
      this._destroyButtons();
      this.actor.destroy_all_children();
      for(let row in this._palette) {
         actorRow = new St.BoxLayout({ vertical: false });
         paletteRow = this._palette[row];
         for(let pos in paletteRow) {
            let [res, selectedColor] = Clutter.Color.from_string(paletteRow[pos]);
            if(res)
               color = selectedColor;
            else
               color = defaultColor;
            bbt = new ColorButton(color, 24, 24);
            bbt.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
            bbt.actor.remove_style_pseudo_class('disabled');
            bbt.actor.set_reactive(true);
            if(color.alpha == 0) {
               bbt.actor.add_style_pseudo_class('disabled');
               bbt.actor.set_reactive(false);
            }
            actorRow.add_actor(bbt.actor);
            this._buttons.push(bbt);
         }
         this.actor.add_actor(actorRow);
      }
   },

   _onButtonRelease: function(actor, event) {
      if(!actor.has_style_pseudo_class('disabled'))
         this.emit("select-color", actor._delegate.value);
   },

   _destroyButtons: function() {
      for(let pos in this._buttons)
         this._buttons[pos].destroy();
      this._buttons = new Array();
   },

   destroy: function() {
      this._palette = null;
      this._destroyButtons();
      this._buttons = null;
      this.actor.destroy();
      this.emit("destroy");
   }
};
Signals.addSignalMethods(ColorPalette.prototype);

function ColorInspector() {
   this._init.apply(this, arguments);
}

ColorInspector.prototype = {
   _init: function(color, width, height) {
      this.actor = new St.BoxLayout({ style_class: 'color-inspector', vertical: false });
      this.actor._delegate = this;

      this._selectedColor = color;
      this._colorHint = new ColorButton(color, width, height);
      this._entryColor = new St.Entry({ name: 'menu-search-entry', hint_text: _("Type a color..."), track_hover: true, can_focus: true });
      this._entryColor.style = "width: -1px; min-width: 100px; font-family: monospace;";//color-entry
      this.actor.add(this._colorHint.actor);
      this.actor.add(this._entryColor, {x_fill: true, y_fill: false, x_align: St.Align.END, y_align: St.Align.MIDDLE, expand: true });
      this._formats = [COLOR_FORMAT.HEXA, COLOR_FORMAT.RGBA, COLOR_FORMAT.HSLA, COLOR_FORMAT.PIXL];
      this._format = 0;

      //this.entryColor.clutter_text.connect('text-changed', Lang.bind(this, this._onColorTextChanged));
      this._entryColor.clutter_text.connect('key-press-event', Lang.bind(this, this._onColorTextChanged));
      this._colorHint.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
   },

   setFocusKeyFocus: function() {
      global.stage.set_key_focus(this._entryColor);
   },

   setFormat: function(format) {
      this._format = this._formats.indexOf(format);
      this.setValue(this._selectedColor);
   },

   _onButtonRelease: function() {
      this._format++
      if(this._format == this._formats.length)
         this._format = 0;
      this.setValue(this._selectedColor);
      this.emit('color-format-changed', this._formats[this._format]);
   },

   get value() {
      return this._selectedColor;
   },

   setValue: function(color) {
      this._selectedColor = color;
      let format = this._formats[this._format];
      if(format == COLOR_FORMAT.HEXA) {
         this._entryColor.set_text(color.to_string().toUpperCase());
      } else if(format == COLOR_FORMAT.RGBA) {
         this._entryColor.set_text("RGBA(%s,%s,%s,%s)".format(color.red, color.green, color.blue, color.alpha));
      } else if(format == COLOR_FORMAT.PIXL) {
         this._entryColor.set_text("PIXEL(%s)".format(color.to_pixel()));
      } else if(format == COLOR_FORMAT.HSLA) {
         let [hue, luminance, saturation] = color.to_hls();
         let a = Math.round(1000*color.alpha/255)/1000;
         let l = Math.round(1000*luminance/255)/1000;
         let s = Math.round(1000*saturation/255)/1000;
         this._entryColor.set_text("HSLA(%s,%s,%s,%s)".format(hue, s, l, a));
      } 
      this._colorHint.setValue(color);
   },

   getStringColor: function() {
      return this._entryColor.get_text();
   },

   _onColorTextChanged: function(actor, event) {
      let symbol = event.get_key_symbol();
      if(symbol == Clutter.Return || symbol == Clutter.KP_Enter) {
         let colorText = this._entryColor.get_text();
         let [res, color] = Clutter.Color.from_string(colorText);
         if((res)&&(!color.equal(this._selectedColor))) {
            this.setValue(color);
            this.emit('color-changed', color);
         }
      }
   },

   destroy: function() {
      this._colorHint.destoy();
      this.actor.destroy();
      this.emit("destroy");
   }
};
Signals.addSignalMethods(ColorInspector.prototype);
