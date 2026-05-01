const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;

const UUID = "multicore-sys-monitor@ccadeptic23";

const TAU = Math.PI * 2;

const HOME_DIR = GLib.get_home_dir();
Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans.length > 0 && customTrans !== str)
        return customTrans;
    return Gettext.gettext(str);
}

function get_nemo_size_prefixes() {
  let _SETTINGS_SCHEMA='org.nemo.preferences';
  let _SETTINGS_KEY = 'size-prefixes';
  let _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
  return _interface_settings.get_string(_SETTINGS_KEY)
}

const formatBytesValueUnit = (bytes, decimals=2, withRate=true) => {
  const spaces = 16;
  let _rate = (withRate === true) ? rate : "";
  if (bytes < 1) {
    return '0'.padStart(spaces/2 - 1) + '.00'.padEnd(spaces/2 - 1) + 'B'.padStart(3, ' ') + _rate;
  }
  let dm = (decimals + 1) || 3;
  let isBinary = get_nemo_size_prefixes().startsWith('base-2');
  let k, sizes, i;
  if (!isBinary) {
    k = 1000;
    sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    i = Math.min(Math.max(0, Math.trunc(Math.log10(bytes) / 3)), 8); // Math.log10(k) = 3.
  } else {
    k = 1024;
    sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    i = Math.min(Math.max(0, Math.trunc(Math.log2(bytes) / 10)), 8); // Math.log2(k) = 10.
  }
  let value;
  if (isNaN(i)) {
    i = 0;
    value = "0";
  } else {
    value = (bytes / Math.pow(k, i)).toPrecision(dm).toString();
  }

  return [value, sizes[i] + _rate];
}


function RGBa2rgba(color) {
  if (typeof color == "string" && color.includes(",")) {
    var rgbaArray = color.split(",");
    rgbaArray[0] = rgbaArray[0].replace(/rgba\(/g, "").replace(/rgb\(/g, "");
    rgbaArray[rgbaArray.length - 1] = rgbaArray[rgbaArray.length - 1].replace(/\)/g, "");
    if (rgbaArray.length === 3) rgbaArray.push(1.0);
    for (let i=0; i<3; i++) {
      rgbaArray[i] = 1.0 * rgbaArray[i] / 255;
      if (rgbaArray[i] === 1)
        rgbaArray[i] = 1.0;
    }
    if (rgbaArray.length === 4) {
      rgbaArray[3] = 1.0 * rgbaArray[3];
      if (rgbaArray[3] === 1)
        rgbaArray[3] = 1.0;
    } else {
      rgbaArray.push(1.0);
    }
    return rgbaArray
  } else {
    return color
  }
}

function pc2RGB(percentage) {
  // https://fr.wikipedia.org/wiki/Teinte_Saturation_Valeur
  const s = 1.0, v = 1.0, a = 1;
  let t = 240.0*(1.0-percentage);
  let t_i = parseInt((t/60) % 6);
  let f = t/60 - t_i;
  let l = 0; // l = v*(1-s)
  let m = v*(1-f*s);
  let n = v*(1-(1-f)*s);
  let r, g, b;

  if (t_i === 0) {
    r = v;
    g = n;
    b = l;
  } else if (t_i === 1) {
    r = m;
    g = v;
    b = l;
  } else if (t_i === 2) {
    r = l;
    g = v;
    b = n;
  } else if (t_i === 3) {
    r = l;
    g = m;
    b = v;
  } else if (t_i === 4) {
    r = n;
    g = l;
    b = v;
  } else {
    r = v;
    g = l;
    b = m;
  }
  return [r, g, b, a]
}

class GraphVBars {
  constructor(area, applet) {
    this.applet = applet;
    this.area = area;
  }

  paint(providerName, currentReadings, area, areaContext, labelProps, width, height, labelColor, bgColor, colorsList) {
    function drawLabel(labelProps, fontsize_px, width, height) {
      let fontdesc = Pango.font_description_from_string('Dejavu Sans Mono Bold ' + labelProps.zoom * fontsize_px + 'px');
      if (labelProps.on) {
        let pangolayout = area.create_pango_layout(labelProps.labelStr);

        pangolayout.set_alignment(Pango.Alignment.CENTER);
        pangolayout.set_width(_width);
        pangolayout.set_font_description(fontdesc);

        areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);
        areaContext.moveTo(_width / 2, labelProps.pos); //place text
        PangoCairo.layout_path(areaContext, pangolayout);
        areaContext.fill();
      }
    }

    if (providerName == 'SWAP' && this.applet.Mem_swapWidth === 0)
      return;
    if (!labelColor) {
      labelColor = [1, 1, 1, 0.1];
    } else {
      labelColor = RGBa2rgba(labelColor);
    }

    bgColor = RGBa2rgba(bgColor);

    if (typeof colorsList == "object") {
        for (let i=0, len=colorsList.length; i<len; i++)
            colorsList[i] = RGBa2rgba(colorsList[i]);
    } else {
        colorsList = RGBa2rgba(colorsList);
    }

    let _width = width;
    let _height = height;
    let _x_origin = 0;
    let _y_origin = 0;

    //Draw Border
    let borderColor;
    let borderRadius = this.applet.borderRadius;
    if (this.applet.borderOn) {
      if (providerName != 'SWAP') {
        borderColor = RGBa2rgba(this.applet.borderColor);
        areaContext.setSourceRGBA(borderColor[0], borderColor[1], borderColor[2], borderColor[3]);
        /**       A----------B
         *       /            \
         *      H              C
         *      |              |
         *      |              |
         *      G              D
         *       \            /
         *        F----------E
         *
        **/
        const A = {x: borderRadius, y: 0};
        const B = {x: width - borderRadius, y: 0};
        const C = {x: width, y: borderRadius};
        const D = {x: width, y: height - borderRadius};
        const E = {x: width - borderRadius, y: height};
        const F = {x: borderRadius, y: height};
        const G = {x: 0, y: height - borderRadius};
        const H = {x: 0, y: borderRadius};

        if (borderRadius == 0) {
          areaContext.moveTo(0, 0);
          areaContext.lineTo(width, 0);
          areaContext.lineTo(width, height);
          areaContext.lineTo(0, height);
        } else {
          areaContext.moveTo(A.x, A.y);
          areaContext.lineTo(B.x, B.y);
          areaContext.curveTo(width, 0, width, 0, C.x, C.y);
          areaContext.lineTo(D.x, D.y);
          areaContext.curveTo(width, height, width, height, E.x, E.y);
          areaContext.lineTo(F.x, F.y);
          areaContext.curveTo(0, height, 0, height, G.x, G.y);
          areaContext.lineTo(H.x, H.y);
          areaContext.curveTo(0, 0, 0, 0, A.x, A.y);
        }

        areaContext.closePath();
        areaContext.stroke();
        _width = width - 2;
      } else {
        _width = width + 1;
      }
      _height = height - 2;
      _x_origin = 1;
      _y_origin = 1;
    }


    //Draw Background
    if ( bgColor[3] > 0.5) bgColor[3] = 0.5;
    areaContext.setSourceRGBA(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);

    areaContext.rectangle(_x_origin, _y_origin, _width, _height);
    areaContext.fill();

    // Label
    let fontsize_px = Math.trunc(1 / 3 * _height);
    let fontdesc = Pango.font_description_from_string('Dejavu Sans Mono Bold ' + labelProps.zoom * fontsize_px + 'px');
    if (!labelProps.fg)
      drawLabel(labelProps, fontsize_px, width, _height);


    // Usage Data Bars
    let vbarWidth = (_width - 6) / currentReadings.length;
    for (let i=0, len=currentReadings.length; i<len; i++) {
      let currentR = parseFloat(currentReadings[i]);
      let vbarHeight = (_height - 1) * currentR;
      let vbarOffset = i * vbarWidth + 3;

      let r=1, g=1, b=1, a=1;

      let use_natural_colors = this.applet.CPU_useProgressiveColors;

      if (!this.applet.CPU_byActivity || providerName == 'SWAP') {
        //use this to select cpu from our colorlist, its incase we have more cpus than colors
        //This shouldnt happen but just incase
        let cpunum = i % colorsList.length;
        r = colorsList[cpunum][0];
        g = colorsList[cpunum][1];
        b = colorsList[cpunum][2];
        a = (colorsList[cpunum][3] != null) ? colorsList[cpunum][3] : 1;
      } else {
        if (use_natural_colors) {
          [r, g, b, a] = pc2RGB(currentR)
        } else {
          colorsList = [
            RGBa2rgba(this.applet.CPU_activity_0_20),
            RGBa2rgba(this.applet.CPU_activity_20_40),
            RGBa2rgba(this.applet.CPU_activity_40_60),
            RGBa2rgba(this.applet.CPU_activity_60_80),
            RGBa2rgba(this.applet.CPU_activity_80_100)
          ];
          if (currentR >= 0.8) {
            r = colorsList[4][0];
            g = colorsList[4][1];
            b = colorsList[4][2];
            a = (colorsList[4][3] != null) ? colorsList[4][3] : 1;
          } else if (currentR >= 0.6) {
            r = colorsList[3][0];
            g = colorsList[3][1];
            b = colorsList[3][2];
            a = (colorsList[3][3] != null) ? colorsList[3][3] : 1;
          } else if (currentR >= 0.4) {
            r = colorsList[2][0];
            g = colorsList[2][1];
            b = colorsList[2][2];
            a = (colorsList[2][3] != null) ? colorsList[2][3] : 1;
          } else if (currentR >= 0.2) {
            r = colorsList[1][0];
            g = colorsList[1][1];
            b = colorsList[1][2];
            a = (colorsList[1][3] != null) ? colorsList[1][3] : 1;
          } else {
            r = colorsList[0][0];
            g = colorsList[0][1];
            b = colorsList[0][2];
            a = (colorsList[0][3] != null) ? colorsList[0][3] : 1;
          }
        }
      }
      areaContext.setSourceRGBA(r, g, b, a);

      this.drawRoundedRectangle(areaContext, vbarOffset, _height - vbarHeight, vbarWidth, vbarHeight, 1.0);
      areaContext.fill();
    }

    // Temperature
    fontsize_px = Math.trunc(this.applet.CPU_tempFontFactor / 100 * _height);
    fontdesc = Pango.font_description_from_string('Dejavu Sans Mono Bold ' + fontsize_px + 'px');
    if (providerName != 'SWAP' &&
      this.applet.CPU_showTemp &&
      (!this.applet.CPU_temp_hovering_only || (this.applet.CPU_temp_hovering_only && this.applet.hovered)) &&
      this.applet.CPU_temperature
    ) {
      let degrees = (this.applet.CPU_tempInFahrenheit) ? "°F" : "°C";
      let pangolayout2 = area.create_pango_layout("" + this.applet.CPU_temperature + degrees);

      let isRight = this.applet.CPU_tempCorner.includes("R");
      let isTop = this.applet.CPU_tempCorner.includes("T");
      if (isRight)
        pangolayout2.set_alignment(Pango.Alignment.RIGHT);
      else
        pangolayout2.set_alignment(Pango.Alignment.LEFT);

      pangolayout2.set_width(_width);
      pangolayout2.set_font_description(fontdesc);

      let tempColor;
      let CPU_tempHigh = 1 * this.applet.CPU_tempHigh;
      let CPU_tempCrit = 1 * this.applet.CPU_tempCrit;
      if (this.applet.CPU_tempInFahrenheit) {
        CPU_tempHigh = 1.8 * CPU_tempHigh + 32;
        CPU_tempCrit = 1.8 * CPU_tempCrit + 32;
      }
      if (1 * this.applet.CPU_temperature < 1 * CPU_tempHigh)
        tempColor = RGBa2rgba(this.applet.CPU_tempColor);
      else if (1 * this.applet.CPU_temperature < 1 * CPU_tempCrit)
        tempColor = RGBa2rgba(this.applet.CPU_tempColorHigh);
      else
        tempColor = RGBa2rgba(this.applet.CPU_tempColorCrit);

      areaContext.setSourceRGBA(tempColor[0], tempColor[1], tempColor[2], tempColor[3]);

      if (isRight) {
        if (isTop)
          areaContext.moveTo(_width, 0); //place text in top right corner of graph area
        else
          areaContext.moveTo(_width, 0.6 * _height); //place text in bottom right corner of graph area
      } else {
        if (isTop)
          areaContext.moveTo(3, 0); //place text in top left corner of graph area
        else
          areaContext.moveTo(3, 0.6 * _height); //place text in bottom left corner of graph area
      }

      PangoCairo.layout_path(areaContext, pangolayout2);
      areaContext.fill();
    }

    // Label
    if (labelProps.fg)
      drawLabel(labelProps, fontsize_px, width, _height);
  }

  drawRoundedRectangle(areaContext, x, y, width, height, radius) {
    if (height > 0) {
      areaContext.newSubPath();

      areaContext.moveTo(x + radius, y); // Move to A
      areaContext.lineTo(x + width - radius, y); // Straight line to B
      areaContext.curveTo(x + width, y, x + width, y, x + width, y + radius); // Curve to C, Control points are both at Q
      areaContext.lineTo(x + width, y + height - radius); // Move to D
      areaContext.curveTo(x + width, y + height, x + width, y + height, x + width - radius, y + height); // Curve to E
      areaContext.lineTo(x + radius, y + height); // Line to F
      areaContext.curveTo(x, y + height, x, y + height, x, y + height - radius); // Curve to G
      areaContext.lineTo(x, y + radius); // Line to H
      areaContext.curveTo(x, y, x, y, x + radius, y); // Curve to A

      areaContext.closePath();
    }
  }
  destroy() {
    let props = Object.keys(this);
    for (let prop of props) {
      this[prop] = undefined;
    }
  }
}

class GraphVBars100 extends GraphVBars {
  paint(providerName, currentReadings, area, areaContext, labelProps, width, height, labelColor, bgColor, colorsList) {
    function drawLabel(labelProps, fontsize_px, width, height) {
      let fontdesc = Pango.font_description_from_string('Dejavu Sans Mono Bold ' + labelProps.zoom * fontsize_px + 'px');
      if (labelProps.on) {
        let pangolayout = area.create_pango_layout(labelProps.labelStr);

        pangolayout.set_alignment(Pango.Alignment.CENTER);
        pangolayout.set_width(_width);
        pangolayout.set_font_description(fontdesc);

        areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);
        areaContext.moveTo(_width / 2, labelProps.pos); //place text
        PangoCairo.layout_path(areaContext, pangolayout);
        areaContext.fill();
      }
    }

    const isBAT = providerName === _("BAT");
    if (!labelColor) {
        labelColor = [1, 1, 1, 0.1];
    } else {
        labelColor = RGBa2rgba(labelColor);
    }

    bgColor = RGBa2rgba(bgColor);

    if (typeof colorsList == "object") {
        for (let i=0, len=colorsList.length; i<len; i++)
            colorsList[i] = RGBa2rgba(colorsList[i]);
    } else {
        colorsList = RGBa2rgba(colorsList);
    }

    let _width = width;
    let _height = height;
    let _x_origin = 2;
    let _y_origin = 1;

    //Draw Border
    let borderColor;
    let borderRadius = this.applet.borderRadius;
    if (this.applet.borderOn) {
      if (providerName != 'SWAP') {
        borderColor = RGBa2rgba(this.applet.borderColor);
        areaContext.setSourceRGBA(borderColor[0], borderColor[1], borderColor[2], borderColor[3]);
        const A = {x: borderRadius, y: 0};
        const B = {x: width - borderRadius, y: 0};
        const C = {x: width, y: borderRadius};
        const D = {x: width, y: height - borderRadius};
        const E = {x: width - borderRadius, y: height};
        const F = {x: borderRadius, y: height};
        const G = {x: 0, y: height - borderRadius};
        const H = {x: 0, y: borderRadius};

        if (borderRadius == 0) {
          areaContext.moveTo(0, 0);
          areaContext.lineTo(width, 0);
          areaContext.lineTo(width, height);
          areaContext.lineTo(0, height);
        } else {
          areaContext.moveTo(A.x, A.y);
          areaContext.lineTo(B.x, B.y);
          areaContext.curveTo(width, 0, width, 0, C.x, C.y);
          areaContext.lineTo(D.x, D.y);
          areaContext.curveTo(width, height, width, height, E.x, E.y);
          areaContext.lineTo(F.x, F.y);
          areaContext.curveTo(0, height, 0, height, G.x, G.y);
          areaContext.lineTo(H.x, H.y);
          areaContext.curveTo(0, 0, 0, 0, A.x, A.y);
        }

        areaContext.closePath();
        areaContext.stroke();
        _width = width - 1;
      } else {
        _width = width;
      }
      _height = height - 2;
      //~ _height = height;
      //~ _x_origin = 2;
      _x_origin = 3;
      //~ _y_origin = 1;
      _y_origin = 2;
    }


    //Draw Background
    if ( bgColor[3] > 0.5) bgColor[3] = 0.5;
    areaContext.setSourceRGBA(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);

    areaContext.rectangle(_x_origin, _y_origin, _width, _height);
    areaContext.fill();

    let fontdesc;
    let fontsize_px = Math.trunc(1 / 3 * _height);
    // Label
    if (!labelProps.fg)
      drawLabel(labelProps, fontsize_px, width, _height);

    // Usage Data Bars
    fontsize_px = Math.trunc(this.applet.percentFontFactor / 100 * _height);
    fontdesc = Pango.font_description_from_string('Dejavu Sans Mono Bold ' + fontsize_px + 'px');
    let interBar = 2; // 2 pixels
    let len = currentReadings.length;
    let nbInterBars = len + 1;
    let vbarWidth = (_width - interBar * nbInterBars) / len;
    for (let i=0; i<len; i++) {
      let currentR = Math.round(100 * currentReadings[i].value, 2) / 100;
      let maxValue = null;
      let minValue = null;
      if (!isBAT)
        maxValue = Math.round(100 * currentReadings[i].maxvalue, 2) / 100;
      if (isBAT) {
        minValue = Math.round(100 * currentReadings[i].minvalue, 2) / 100;
        //~ global.log("minValue: " + minValue + " & currentR: " + currentR);
      }
      let vbarHeight = (_height - 3) * currentR;
      let vbarOffset = i * (vbarWidth) + (i + 1) * interBar;

      let r=1, g=1, b=1, a=1;

      let barnum = 0;
      r = colorsList[barnum][0];
      g = colorsList[barnum][1];
      b = colorsList[barnum][2];
      a = (colorsList[barnum][3] != null) ? colorsList[barnum][3] : 1;
      areaContext.setSourceRGBA(r, g, b, a);
      this.drawRoundedRectangle(areaContext, vbarOffset, 1, vbarWidth, _height - 2, 1.0);
      areaContext.fill();
      let alertColor;
      if (isBAT && minValue != null && currentR <= minValue) {
        alertColor = (!isBAT) ? RGBa2rgba(this.applet.DiskUsage_colorAlert) : RGBa2rgba(this.applet.Battery_colorAlert);
        areaContext.setSourceRGBA(alertColor[0], alertColor[1], alertColor[2], alertColor[3]);
        this.drawRoundedRectangle(areaContext, vbarOffset, 1, vbarWidth, _height - 2, 1.0);
        areaContext.fill();
      }

      if((maxValue != null && currentR < maxValue) || (minValue != null && currentR > minValue)) {
        barnum = 1;
        r = colorsList[barnum][0];
        g = colorsList[barnum][1];
        b = colorsList[barnum][2];
        a = (colorsList[barnum][3] != null) ? colorsList[barnum][3] : 1;
        areaContext.setSourceRGBA(r, g, b, a);
      } else {
        alertColor = (!isBAT) ? RGBa2rgba(this.applet.DiskUsage_colorAlert) : RGBa2rgba(this.applet.Battery_colorAlert);
        areaContext.setSourceRGBA(alertColor[0], alertColor[1], alertColor[2], alertColor[3]);
      }

      this.drawRoundedRectangle(areaContext, vbarOffset, _height - vbarHeight, vbarWidth, vbarHeight, 1.0);
      areaContext.fill();

      // Show the percentage value on each bar:
      if ((!isBAT && (this.applet.DiskUsage_value_display === "always" || (this.applet.DiskUsage_value_display === "hover" && this.applet.hovered))) ||
          (isBAT && (this.applet.Battery_value_display === "always" || (this.applet.Battery_value_display === "hover" && this.applet.hovered)))
      ) {

        let percentValue = Math.round(currentReadings[i].value * 100) + "%";
        let pangolayoutPerCent = area.create_pango_layout(percentValue);
        pangolayoutPerCent.set_alignment(Pango.Alignment.CENTER);
        pangolayoutPerCent.set_width(vbarWidth);
        pangolayoutPerCent.set_font_description(fontdesc);
        areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);
        //place text in center of graph area
        if ((!isBAT && this.applet.DiskUsage_valueCorner === "T") ||
            (isBAT && this.applet.Battery_valueCorner === "T")
        )
          areaContext.moveTo(vbarOffset + vbarWidth / 2, 1); // top.
        if ((!isBAT && this.applet.DiskUsage_valueCorner === "B") ||
            (isBAT && this.applet.Battery_valueCorner === "B")
        )
          areaContext.moveTo(vbarOffset + vbarWidth / 2, (1.0 - this.applet.percentFontFactor / 100) * _height - 1); // bottom.
        PangoCairo.layout_path(areaContext, pangolayoutPerCent);
        areaContext.fill();
      }
    }

    // Label
    if (labelProps.fg)
      drawLabel(labelProps, fontsize_px, width, _height);
  }
}

class GraphPieChart {
  constructor(area, applet) {
    this.applet = applet;
    this.area = area;
  }

  paint(providerName, currentReadings, area, areaContext, labelProps, width, height, labelColor, bgColor, colorsList) {
    function drawLabel(labelProps, fontsize_px, width, height) {
      if (labelProps.on) {
        let fontdesc = Pango.font_description_from_string('Dejavu Sans Mono Bold ' + labelProps.zoom * fontsize_px + 'px');
        let pangolayout = area.create_pango_layout(labelProps.labelStr);

        pangolayout.set_alignment(Pango.Alignment.CENTER);
        pangolayout.set_width(_width);
        pangolayout.set_font_description(fontdesc);

        areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);
        areaContext.moveTo(_width / 2, labelProps.pos); //place text
        PangoCairo.layout_path(areaContext, pangolayout);
        areaContext.fill();
      }
    }

    if (!labelColor) {
      labelColor = [1, 1, 1, 0.1];
    } else {
      labelColor = RGBa2rgba(labelColor);
    }

    bgColor = RGBa2rgba(bgColor);

    if (typeof colorsList == "string") {
      colorsList = RGBa2rgba(colorsList);
    } else {
      for (let i=0, len=colorsList.length; i<len; i++) {
        colorsList[i] = RGBa2rgba(colorsList[i]);
      }
    }

    let _width = width;
    let _height = height;
    let _x_origin = 0;
    let _y_origin = 0;

    let fontsize_px = Math.trunc(1 / 3 * _height);
    if (!labelProps.fg)
      drawLabel(labelProps, fontsize_px, width, height);

    //Draw Border
    let borderColor;
    let borderRadius = this.applet.borderRadius;
    if (this.applet.borderOn) {
      borderColor = RGBa2rgba(this.applet.borderColor);
      areaContext.setSourceRGBA(borderColor[0], borderColor[1], borderColor[2], borderColor[3]);
      const A = {x: borderRadius, y: 0};
      const B = {x: width - borderRadius, y: 0};
      const C = {x: width, y: borderRadius};
      const D = {x: width, y: height - borderRadius};
      const E = {x: width - borderRadius, y: height};
      const F = {x: borderRadius, y: height};
      const G = {x: 0, y: height - borderRadius};
      const H = {x: 0, y: borderRadius};

      if (borderRadius == 0) {
        areaContext.moveTo(0, 0);
        areaContext.lineTo(width, 0);
        areaContext.lineTo(width, height);
        areaContext.lineTo(0, height);
      } else {
        areaContext.moveTo(A.x, A.y);
        areaContext.lineTo(B.x, B.y);
        areaContext.curveTo(width, 0, width, 0, C.x, C.y);
        areaContext.lineTo(D.x, D.y);
        areaContext.curveTo(width, height, width, height, E.x, E.y);
        areaContext.lineTo(F.x, F.y);
        areaContext.curveTo(0, height, 0, height, G.x, G.y);
        areaContext.lineTo(H.x, H.y);
        areaContext.curveTo(0, 0, 0, 0, A.x, A.y);
      }

      areaContext.closePath();
      areaContext.stroke();
      _width = width - 2;
      _height = height - 2;
      _x_origin = 1;
      _y_origin = 1;
    }

    //Draw Background
    if ( bgColor[3] > 0.5) bgColor[3] = 0.5;
    areaContext.setSourceRGBA(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);
    areaContext.rectangle(_x_origin, _y_origin, _width, _height);
    areaContext.fill();

    if (this.applet.Mem_chartType === "pie") {
      //Draw Pie Chart
      let xcenter = _width / 2;
      let ycenter = _height / 2;
      let radius = Math.min(xcenter, ycenter) - 2;

      var runningpercent = 0; //to make the arcs larger so that they becomes 1 after the next loop

      areaContext.moveTo(xcenter, ycenter);
      for (let i=0, len=currentReadings.length; i<len; i++) {
        //use this to select datapointnum from our colorlist, its incase we have more datapointnums than colors
        //This shouldnt happen but just incase, essentially we reuse colors from the beginning if we run out
        let datapointnum = i % colorsList.length;
        let r = colorsList[datapointnum][0];
        let g = colorsList[datapointnum][1];
        let b = colorsList[datapointnum][2];
        let a = colorsList[datapointnum][3];

        let origin = (this.applet.Mem_startAt12Oclock) ? -Math.PI / 2 : 0;

        let startangle = TAU * runningpercent + origin;
        let endangle = TAU * (runningpercent + currentReadings[i]) + origin;
        runningpercent += currentReadings[i]; //update running percent

        areaContext.setSourceRGBA(r, g, b, a);
        areaContext.newPath();
        areaContext.moveTo(xcenter, ycenter);

        areaContext.arc(xcenter, ycenter, radius, startangle, endangle);

        areaContext.lineTo(xcenter, ycenter);
        areaContext.closePath();
        areaContext.fill();
      }
    } else {
      // Bar chart
      //~ let vbarWidth = 0.8 * (_width - 6);
      let vbarWidth = 0.6 * (_width - 6);
      let r=1, g=1, b=1, a=1;
      var old_height = 0;
      var vbarHeight;
      for (let i=0, len=currentReadings.length; i<len; i++) {
        let currentR = parseFloat(currentReadings[i]);
        vbarHeight = (height - 1) * currentR;
        [r, g, b, a] = colorsList[i];
        areaContext.setSourceRGBA(r, g, b, a);
        let plus = 0;
        if (i==0) plus = 1;
        this.drawRoundedRectangle(
          areaContext,
          //~ 1 + 0.2 * width, // x
          1 + 0.25 * width, // x
          height - (plus + old_height + vbarHeight), // y
          vbarWidth, // width
          vbarHeight, // height
          1.0
        );
        areaContext.fill();
        old_height = old_height + vbarHeight;
      }

    }

    // Label
    //~ let fontsize_px = Math.trunc(1 / 3 * _height);
    if (labelProps.fg)
      drawLabel(labelProps, fontsize_px, width, height);

    let fontdesc = Pango.font_description_from_string('Dejavu Sans Mono Bold ' + labelProps.zoom * fontsize_px + 'px');


    //Show percentage value in center of pie chart
    //~ global.log("this.applet.Mem_value_display: " + this.applet.Mem_value_display + " - this.applet.hovered: " + this.applet.hovered);
    fontsize_px = Math.trunc(this.applet.percentFontFactor / 100 * _height);
    fontdesc = Pango.font_description_from_string('Dejavu Sans Mono Bold ' + fontsize_px + 'px');
    if (this.applet.Mem_value_display === "always" || (this.applet.Mem_value_display === "hover" && this.applet.hovered)) {
      let percentValue = (Math.round(currentReadings[0] * 100)) + "%";
      let pangolayoutPerCent = area.create_pango_layout(percentValue);
      pangolayoutPerCent.set_alignment(Pango.Alignment.CENTER);
      pangolayoutPerCent.set_width(_width);
      pangolayoutPerCent.set_font_description(fontdesc);

      areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);
      //place text in center of graph area
      if (this.applet.Mem_valueCorner === "T")
        areaContext.moveTo(width / 2, 1); // top.
      else
        areaContext.moveTo(width / 2, (1.0 - this.applet.percentFontFactor / 100) * _height - 1); // bottom.
      PangoCairo.layout_path(areaContext, pangolayoutPerCent);
      areaContext.fill();
    }
  }

  drawRoundedRectangle(areaContext, x, y, width, height, radius) {
    if (height > 0) {
      areaContext.newSubPath();

      areaContext.moveTo(x + radius, y); // Move to A
      areaContext.lineTo(x + width - radius, y); // Straight line to B
      areaContext.curveTo(x + width, y, x + width, y, x + width, y + radius); // Curve to C, Control points are both at Q
      areaContext.lineTo(x + width, y + height - radius); // Move to D
      areaContext.curveTo(x + width, y + height, x + width, y + height, x + width - radius, y + height); // Curve to E
      areaContext.lineTo(x + radius, y + height); // Line to F
      areaContext.curveTo(x, y + height, x, y + height, x, y + height - radius); // Curve to G
      areaContext.lineTo(x, y + radius); // Line to H
      areaContext.curveTo(x, y, x, y, x + radius, y); // Curve to A

      areaContext.closePath();
    }
  }

  destroy() {
    let props = Object.keys(this);
    for (let prop of props) {
      this[prop] = undefined;
    }
  }
};

class GraphLineChart {
  constructor(area, width, applet) {
    this.applet = applet;
    this.area = area;

    this.pixelsPerDataPoint = 5 * global.ui_scale;
    this.dataPointsListSize = this.getDataPointsListSize(width);
    this.dataPointsList = [];

    this.autoScale = false;
    this.logScale = false;
    this.minPrefix = "B";
    this.scale = 1.0;
    this.maxValue = 1.0;
    this.maxValueLoc = null;
    this.minMaxValue = 1.0;

    this.ledColor = RGBa2rgba("rgba(67, 67, 67, 1)");
    this.isReading = false;
    this.isWriting = false;
    this.typeOfGraph = "graphled";
  }

  get minNetShownValue() {
    return this.applet.minNetShownValue;
  }

  get minDiskShownValue() {
    return this.applet.minDiskShownValue;
  }

  refreshData(currentReadings, providerName) {
    this.isReading = false;
    this.isWriting = false;
    if (providerName == _("DISK")) {
      this.autoScale = this.applet.Disk_autoscale;
      this.logScale = this.applet.Disk_logscale;
      this.typeOfGraph = this.applet.Disk_typeOfGraph;
      this.minPrefix = this.applet.Disk_minPrefix;
    }
    if (providerName == _("NET")) {
      this.autoScale = this.applet.Net_autoscale;
      this.logScale = this.applet.Net_logscale;
      this.typeOfGraph = this.applet.Net_typeOfGraph;
      this.minPrefix = this.applet.Net_minPrefix;
    }
    let dataPoints = [];
    for (let i=0, len=currentReadings.length; i<len; i++) {
      if (!currentReadings[i].readingRatesList) {
        continue;
      }
      this.isReading = this.isReading || currentReadings[i].readingRatesList[0] > 0;
      this.isWriting = this.isWriting || currentReadings[i].readingRatesList[1] > 0;
      dataPoints = dataPoints.concat(currentReadings[i].readingRatesList);
    }
    if (dataPoints.length === 0) {
      return true;
    }


    if (this.maxValueLoc == null) {
      //initialize
      this.resizeDataPointsList(this.dataPointsListSize, dataPoints.length);
    }

    this.dataPointsList.push(dataPoints);
    this.dataPointsList.shift();
    this.maxValueLoc--;

    for (let i=0, len=dataPoints.length; i<len; i++) {
      //check what we just added isnt lesser than our min (for all lines)
      if (
        (providerName == _("NET") && dataPoints[i] < this.minNetShownValue) ||
        (providerName == _("DISK") && dataPoints[i] < this.minDiskShownValue)
      )
        dataPoints[i] = 0;

      //~ if (providerName == _("DISK") && dataPoints[i] < this.minDiskShownValue)
        //~ dataPoints[i] = 0;

      //double check what we just added isnt greater than our max (for all lines)
      if (dataPoints[i] > this.maxValue && dataPoints[i] > this.minMaxValue) {
        this.maxValue = dataPoints[i];
        this.maxValueLoc = this.dataPointsListSize - 1;
        this.scale = 1.0 / this.maxValue;
      }
    }

    if (this.isReading && this.isWriting) {
      this.ledColor = RGBa2rgba("rgba(184, 113, 88, 1)");
    } else if (this.isReading) {
      this.ledColor = RGBa2rgba("rgba(126, 180, 69, 1)");
    } else if (this.isWriting) {
      this.ledColor = RGBa2rgba("rgba(244, 67, 54, 1)");
    } else {
      this.ledColor = RGBa2rgba("rgba(67, 67, 67, 1)");
    }

    if (this.autoScale && this.maxValueLoc < 0) {
      //find a new max we lost the old one
      this.maxValue = 1.0;
      for (let i=0, len_i=this.dataPointsList.length; i<len_i; i++) {
        for (let j=0, len_j=dataPoints.length; j<len_j; j++) {
          if (this.dataPointsList[i][j] == null) {
            continue;
          }
          if (this.dataPointsList[i][j] >= this.maxValue && this.dataPointsList[i][j] > this.minMaxValue) {
            this.maxValue = this.dataPointsList[i][j];
            this.maxValueLoc = i;
            this.scale = 1.0 / this.maxValue;
          }
        }
      }
    }
    if (this.logScale && this.maxValue > 1.0) {
      this.scale = 1.0 / Math.log(this.maxValue);
    }

    return true;
  }

  getDataPointsListSize(width) {
    return Math.round(width / this.pixelsPerDataPoint);
  }

  resizeDataPointsList(newsize, numdatapoints) {
    this.dataPointsListSize = newsize;
    let newdatapointslist = [];
    for (let i = 0; i < newsize; i++) {
      if (i < this.dataPointsList.length) {
        newdatapointslist.push(this.dataPointsList[i]);
      } else {
        let emptypoints = [];
        for (let j = 0; j < numdatapoints; j++) {
          emptypoints[j] = undefined;
        }
        newdatapointslist.unshift(emptypoints);
      }
    }
    this.dataPointsList = newdatapointslist;
  }

  paint(providerName, currentReadings, area, areaContext, labelProps, width, height, labelColor, bgColor, colorsList=[]) {
    function drawLabel(labelProps, fontsize_px, width, height) {
      let fontdesc = Pango.font_description_from_string('Dejavu Sans Mono Bold ' + labelProps.zoom * fontsize_px + 'px');
      if (labelProps.on) {
        let pangolayout = area.create_pango_layout(labelProps.labelStr);

        pangolayout.set_alignment(Pango.Alignment.CENTER);
        pangolayout.set_width(width);
        pangolayout.set_font_description(fontdesc);

        areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);

        areaContext.moveTo(width / 2, labelProps.pos); //place text in center of graph area
        PangoCairo.layout_path(areaContext, pangolayout);
        areaContext.fill();
      }
    }

    this.refreshData(currentReadings, providerName);
    if (!labelColor) {
      labelColor = [1, 1, 1, 0.1];
    } else {
        labelColor = RGBa2rgba(labelColor);
    }

    bgColor = RGBa2rgba(bgColor);

    if (typeof colorsList == "string") {
        colorsList = RGBa2rgba(colorsList);
    } else {
        for (let i=0, len=colorsList.length; i<len; i++)
            colorsList[i] = RGBa2rgba(colorsList[i]);
    }

    if (this.dataPointsListSize !== this.getDataPointsListSize(width)) {
      this.resizeDataPointsList(this.getDataPointsListSize(width), colorsList.length);
    }

    let _width = width;
    let _height = height;
    let _x_origin = 0;
    let _y_origin = 0;

    //Draw Border
    let borderColor;
    let borderRadius = this.applet.borderRadius;
    if (this.applet.borderOn) {
      borderColor = RGBa2rgba(this.applet.borderColor);
      areaContext.setSourceRGBA(borderColor[0], borderColor[1], borderColor[2], borderColor[3]);
      const A = {x: borderRadius, y: 0};
      const B = {x: width - borderRadius, y: 0};
      const C = {x: width, y: borderRadius};
      const D = {x: width, y: height - borderRadius};
      const E = {x: width - borderRadius, y: height};
      const F = {x: borderRadius, y: height};
      const G = {x: 0, y: height - borderRadius};
      const H = {x: 0, y: borderRadius};

      if (borderRadius == 0) {
        areaContext.moveTo(0, 0);
        areaContext.lineTo(width, 0);
        areaContext.lineTo(width, height);
        areaContext.lineTo(0, height);
      } else {
        areaContext.moveTo(A.x, A.y);
        areaContext.lineTo(B.x, B.y);
        areaContext.curveTo(width, 0, width, 0, C.x, C.y);
        areaContext.lineTo(D.x, D.y);
        areaContext.curveTo(width, height, width, height, E.x, E.y);
        areaContext.lineTo(F.x, F.y);
        areaContext.curveTo(0, height, 0, height, G.x, G.y);
        areaContext.lineTo(H.x, H.y);
        areaContext.curveTo(0, 0, 0, 0, A.x, A.y);
      }

      areaContext.closePath();
      areaContext.stroke();
      _width = width - 2;
      _height = height - 2;
      _x_origin = 1;
      _y_origin = 1;
    }

    //Draw Background
    if ( bgColor[3] > 0.5) bgColor[3] = 0.5;
    areaContext.setSourceRGBA(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);
    areaContext.rectangle(_x_origin, _y_origin, _width, _height);
    areaContext.fill();

    // Label
    let fontsize_px = Math.trunc(1 / 3 * _height);
    if (!labelProps.fg) {
      drawLabel(labelProps, fontsize_px, width, _height)
    }

    //data
    if (this.typeOfGraph.includes("graph")) {
      let numLinesOnChart = 0;
      if (this.dataPointsList.length > 0) {
        numLinesOnChart = this.dataPointsList[0].length; //cheesy but it works
      }

      for (let i = 0; i < numLinesOnChart; i++) {
        //use this to select datapointnum from our colorlist, its incase we have more datapointnums than colors
        //This shouldnt happen but just incase, essentially we reuse colors from the beginning if we run out
        let datapointnum = i % colorsList.length;
        let r, g, b, a;
        if (colorsList[datapointnum] == undefined) {
          r = 1;
          g = 1;
          b = 1;
          a = 1;
        } else {
          r = colorsList[datapointnum][0];
          g = colorsList[datapointnum][1];
          b = colorsList[datapointnum][2];
          a = colorsList[datapointnum][3];
        }
        areaContext.setSourceRGBA(r, g, b, a);
        areaContext.setLineWidth(this.applet.thickness);

        areaContext.setLineJoin(1); //rounded
        for (let j = 1; j < this.dataPointsList.length; j++) {
          let x1 = this.pixelsPerDataPoint * j + this.pixelsPerDataPoint / 4;
          let x2 = this.pixelsPerDataPoint * (j + 0.5) + this.pixelsPerDataPoint / 4;

          if (this.dataPointsList[j][i] === undefined || this.dataPointsList[j - 1][i] === undefined) {
            continue;
          }
          let rawy1 = this.dataPointsList[j - 1][i];
          let rawy2 = this.dataPointsList[j][i];
          if (this.logScale) {
            if (rawy1 >= 1) {
              rawy1 = Math.log(rawy1);
            }
            if (rawy2 >= 1) {
              rawy2 = Math.log(rawy2);
            }
          }

          let y1 = _height - Math.floor((_height - 2) * (rawy1 * this.scale));
          let y2 = _height - Math.floor((_height - 2) * (rawy2 * this.scale));
          if (y1 < 0 || y2 < 0) continue;

          areaContext.curveTo(x1, y1, x1, y2, x2, y2);
        }
        areaContext.stroke();
      }
    }

    // Label
    fontsize_px = Math.trunc(1 / 3 * _height);
    if (labelProps.fg) {
      drawLabel(labelProps, fontsize_px, width, _height)
    }

    fontsize_px = Math.trunc(this.applet.flowFontFactor / 100 * _height);
    let fontdesc = Pango.font_description_from_string('Dejavu Sans Mono Bold ' + fontsize_px + 'px');

    // Total
    let totalNetOK = providerName == _('NET') && this.applet.Net_total_display;
    let speedDiskOK = providerName == _('DISK') && this.applet.Disk_speed_display;
    let isOnlyLeftOrRight, isRight, isTop;
    var wantSpeed;
    var total;
    var previous;
    const refreshRate = 0.001 * this.applet.refreshRate;

    if (totalNetOK) {
      if (this.applet.Net_total_hovering_only && !this.applet.hovered) return;
      wantSpeed = this.applet.Net_total_type === "speed";

      isOnlyLeftOrRight = this.applet.Net_totalCorner.includes("O");
      isRight = this.applet.Net_totalCorner.includes("R");
      isTop = this.applet.Net_totalCorner.includes("T");

      total = this.applet.networkProvider.totalAmountCurrent;
      previous = this.applet.networkProvider.totalAmountPrevious;
      if (wantSpeed) {
        total[0] = (total[0] - previous[0]) / refreshRate;
        total[1] = (total[1] - previous[1]) / refreshRate;
      }
    }

    if (speedDiskOK) {
      if (this.applet.Disk_speed_hovering_only && !this.applet.hovered) return;
      wantSpeed = true;

      isOnlyLeftOrRight = this.applet.Disk_speedCorner.includes("O");
      isRight = this.applet.Disk_speedCorner.includes("R");
      isTop = this.applet.Disk_speedCorner.includes("T");

      total = this.applet.diskProvider.totalAmountCurrent;
      previous = this.applet.diskProvider.totalAmountPrevious;
      if (wantSpeed) {
        total[0] = (total[0] - previous[0]) / refreshRate;
        total[1] = (total[1] - previous[1]) / refreshRate;
      }
    }

    var unit0 = "B", unit1 = "B";
    const PREFIXES = ["B", "K", "M", "G", "T", "P", "E", "Z", "Y"];
    var UNITS;
    if (get_nemo_size_prefixes().startsWith("base-2"))
      UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
    else
      UNITS = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    if (providerName == _("NET") && this.minPrefix !== "B") {
      if (total[0] < this.minNetShownValue) {
        total[0] = 0;
        unit0 = UNITS[PREFIXES.indexOf(this.minPrefix)];
      }
      if (total[1] < this.minNetShownValue) {
        total[1] = 0;
        unit1 = UNITS[PREFIXES.indexOf(this.minPrefix)];
      }
    }

    if (providerName == _("DISK") && this.minPrefix !== "B") {
      if (total[0] < this.minDiskShownValue) {
        total[0] = 0;
        unit0 = UNITS[PREFIXES.indexOf(this.minPrefix)];
      }
      if (total[1] < this.minDiskShownValue) {
        total[1] = 0;
        unit1 = UNITS[PREFIXES.indexOf(this.minPrefix)];
      }
    }

    if (totalNetOK || speedDiskOK) {
      let _down = formatBytesValueUnit(total[0], 2, false);
      let down;
      if (isOnlyLeftOrRight) {
        down = Math.round(_down[0]).toString().padStart(4, " ") + " " + _down[1].trim().padStart(3, " ");
        if (_down[0] == 0) down = "0".padStart(4, " ") + " " + unit0.padStart(3, " ");
      } else {
        down =  Math.round(_down[0]).toString().padStart(4, " ") + " " + _down[1].padStart(3, " ");
        if (_down[0] == 0) down = "0".padStart(4, " ") + " " + unit0.padStart(3, " ");
      }

      let _up = formatBytesValueUnit(total[1], 2, false);
      let up;
      if (isOnlyLeftOrRight) {
        up =  Math.round(_up[0]).toString().padStart(4, " ") + " " + _up[1].trim().padStart(3, " ");
        if (_up[0] == 0) up = "0".padStart(4, " ") + " " + unit1.padStart(3, " ");
      } else {
        up =  Math.round(_up[0]).toString().padStart(4, " ") + " " + _up[1].padStart(3, " ");
        if (_up[0] == 0) up = "0".padStart(4, " ") + " " + unit1.padStart(3, " ");
      }

      let downstr = '▼ ' + down;
      let upstr = '▲ ' + up;
      let downupstr = downstr + ' |' + upstr;
      let pangolayout2 = null;
      let pangolayout3 = null;
      if (isOnlyLeftOrRight) {
        pangolayout2 = area.create_pango_layout(downstr);
        pangolayout3 = area.create_pango_layout(upstr);
      } else {
        pangolayout2 = area.create_pango_layout(downupstr);
      }
      pangolayout2.set_single_paragraph_mode(true);
      if (pangolayout3 != null)
        pangolayout3.set_single_paragraph_mode(true);

      if (isRight) {
        pangolayout2.set_alignment(Pango.Alignment.RIGHT);
        if (pangolayout3 != null)
          pangolayout3.set_alignment(Pango.Alignment.RIGHT);
      } else {
        pangolayout2.set_alignment(Pango.Alignment.LEFT);
        if (pangolayout3 != null)
          pangolayout3.set_alignment(Pango.Alignment.LEFT);
      }

      pangolayout2.set_ellipsize(Pango.EllipsizeMode.NONE);
      pangolayout2.set_width(-1); // Required to display it on a single line.
      pangolayout2.set_height(this.applet.flowFontFactor / 100 * _height);
      if (pangolayout3 != null) {
        pangolayout3.set_ellipsize(Pango.EllipsizeMode.NONE);
        pangolayout3.set_width(-1); // Required to display it on a single line.
        pangolayout3.set_height(this.applet.flowFontFactor / 100 * _height);
      }
      pangolayout2.set_font_description(fontdesc);
      if (pangolayout3 != null)
        pangolayout3.set_font_description(fontdesc);

      areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);

      if (isOnlyLeftOrRight) {
        if (isRight) {
          areaContext.moveTo(1 * width - downstr.length * 7.5, 0);
          PangoCairo.layout_path(areaContext, pangolayout2);
          areaContext.moveTo(1 * width  - upstr.length * 7.5, (1.0 - this.applet.flowFontFactor / 100) * _height - 1);
          PangoCairo.layout_path(areaContext, pangolayout3);
        } else {
          areaContext.moveTo(3, 0);
          PangoCairo.layout_path(areaContext, pangolayout2);
          areaContext.moveTo(3, (1.0 - this.applet.flowFontFactor / 100) * _height - 1);
          PangoCairo.layout_path(areaContext, pangolayout3);
        }
      } else {
        if (isRight) {
          if (isTop)
            areaContext.moveTo(1 * width - downupstr.length * 7.5, 1); //place text in top right corner of graph area
          else
            areaContext.moveTo(1 * width  - downupstr.length * 7.5, (1.0 - this.applet.flowFontFactor / 100) * _height - 1); //place text in bottom right corner of graph area
        } else {
          if (isTop)
            areaContext.moveTo(3, 0); //place text in top left corner of graph area
          else
            areaContext.moveTo(3, (1.0 - this.applet.flowFontFactor / 100) * _height - 1); //place text in bottom left corner of graph area
        }
        PangoCairo.layout_path(areaContext, pangolayout2);
      }
      areaContext.fill();
    }

    // led:
    if (this.typeOfGraph.includes("led")) {
      let pangolayout4 = area.create_pango_layout(this.led);
      pangolayout4.set_single_paragraph_mode(true);
      //~ pangolayout4.set_font_description(fontdesc);
      if (this.ledLocation === "LO") {
        pangolayout4.set_alignment(Pango.Alignment.LEFT);
        areaContext.moveTo(8, _height / 3 - 3);
      } else {
        pangolayout4.set_alignment(Pango.Alignment.RIGHT);
        areaContext.moveTo(1 * width  - 24, _height / 3 - 3);
      }
      areaContext.setSourceRGBA(this.ledColor[0], this.ledColor[1], this.ledColor[2], this.ledColor[3]);
      PangoCairo.layout_path(areaContext, pangolayout4);
      areaContext.fill();
    }
  }

  get led() {
    return this.applet.led;
  }

  get ledLocation() {
    return this.applet.ledLocation;
  }

  drawRoundedRectangle(areaContext, x, y, width, height, radius) {
    if (height > 0) {
      areaContext.newSubPath();

      areaContext.moveTo(x + radius, y); // Move to A
      areaContext.lineTo(x + width - radius, y); // Straight line to B
      areaContext.curveTo(x + width, y, x + width, y, x + width, y + radius); // Curve to C, Control points are both at Q
      areaContext.lineTo(x + width, y + height - radius); // Move to D
      areaContext.curveTo(x + width, y + height, x + width, y + height, x + width - radius, y + height); // Curve to E
      areaContext.lineTo(x + radius, y + height); // Line to F
      areaContext.curveTo(x, y + height, x, y + height, x, y + height - radius); // Curve to G
      areaContext.lineTo(x, y + radius); // Line to H
      areaContext.curveTo(x, y, x, y, x + radius, y); // Curve to A

      areaContext.closePath();
    }
  }
  destroy() {
    let props = Object.keys(this);
    for (let prop of props) {
      this[prop] = undefined;
    }
  }
}
