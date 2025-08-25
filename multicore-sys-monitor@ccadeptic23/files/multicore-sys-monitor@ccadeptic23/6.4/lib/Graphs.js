const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const UUID = "multicore-sys-monitor@ccadeptic23";

const TAU = Math.PI * 2;

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

  paint(providerName, currentReadings, area, areaContext, labelsEnabled, width, height, labelColor, bgColor, colorsList) {
    if (providerName == 'SWAP' && this.applet.Mem_swapWidth === 0)
      return;
    if (!labelColor) {
        labelColor = [1, 1, 1, 0.1];
    } else {
        labelColor = RGBa2rgba(labelColor);
    }

    bgColor = RGBa2rgba(bgColor);

    //~ global.log("Type of GraphVBars colorsList: " + typeof colorsList);
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
    if (this.applet.borderOn) {
      if (providerName != 'SWAP') {
        borderColor = RGBa2rgba(this.applet.borderColor);
        areaContext.setSourceRGBA(borderColor[0], borderColor[1], borderColor[2], borderColor[3]);
        //~ areaContext.rectangle(0, 0, width, height);
        //~ areaContext.fill();

        //~ areaContext.moveTo(0.5, 0);
        //~ areaContext.lineTo(width - 0.5, 0);
        //~ areaContext.lineTo(width - 0.5, height);
        //~ areaContext.lineTo(0.5, height);
        areaContext.moveTo(0, 0);
        areaContext.lineTo(width, 0);
        areaContext.lineTo(width, height);
        areaContext.lineTo(0, height);

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

    //~ this.drawRoundedRectangle(areaContext, 0, 0, width, height, 5.0);
    areaContext.rectangle(_x_origin, _y_origin, _width, _height);
    areaContext.fill();

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

      this.drawRoundedRectangle(areaContext, vbarOffset, _height - vbarHeight, vbarWidth, vbarHeight, 1.5);
      areaContext.fill();
    }

    // Label
    if (labelsEnabled) {
      let pangolayout = area.create_pango_layout(providerName);

      pangolayout.set_alignment(Pango.Alignment.CENTER);
      pangolayout.set_width(_width);
      let fontsize_px = Math.trunc(1 / 3 * _height);
      let fontdesc = Pango.font_description_from_string('Sans Normal ' + fontsize_px + 'px');
      pangolayout.set_font_description(fontdesc);

      areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);
      areaContext.moveTo(_width / 2, 0); //place text in center of graph area
      PangoCairo.layout_path(areaContext, pangolayout);
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
    //~ for (let i = 0; i < props.length; i++) {
      //~ this[props[i]] = undefined;
    //~ }
    for (let prop of props) {
      this[prop] = undefined;
    }
  }
}

class GraphVBars100 extends GraphVBars {
  paint(providerName, currentReadings, area, areaContext, labelsEnabled, width, height, labelColor, bgColor, colorsList) {
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
    if (this.applet.borderOn) {
      if (providerName != 'SWAP') {
        borderColor = RGBa2rgba(this.applet.borderColor);
        areaContext.setSourceRGBA(borderColor[0], borderColor[1], borderColor[2], borderColor[3]);
        areaContext.moveTo(0, 0);
        areaContext.lineTo(width, 0);
        areaContext.lineTo(width, height);
        areaContext.lineTo(0, height);

        areaContext.closePath();
        areaContext.stroke();
        _width = width - 1;
      } else {
        _width = width;
      }
      _height = height - 2;
      _x_origin = 2;
      _y_origin = 1;
    }


    //Draw Background
    if ( bgColor[3] > 0.5) bgColor[3] = 0.5;
    areaContext.setSourceRGBA(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);

    //~ this.drawRoundedRectangle(areaContext, 0, 0, width, height, 5.0);
    areaContext.rectangle(_x_origin, _y_origin, _width, _height);
    areaContext.fill();

    // Usage Data Bars
    let interBar = 2; // 2 pixels
    let len = currentReadings.length;
    let nbInterBars = len + 1;
    let vbarWidth = (_width - interBar * nbInterBars) / len;
    for (let i=0; i<len; i++) {
      let currentR = Math.round(100 * currentReadings[i].value, 2) / 100;
      let maxValue = Math.round(100 * currentReadings[i].maxvalue, 2) / 100;
      let vbarHeight = (_height - 1) * currentR;
      let vbarOffset = i * (vbarWidth) + (i + 1) * interBar;

      let r=1, g=1, b=1, a=1;

      //~ let barnum = i % colorsList.length;
      let barnum = 0;
      r = colorsList[barnum][0];
      g = colorsList[barnum][1];
      b = colorsList[barnum][2];
      a = (colorsList[barnum][3] != null) ? colorsList[barnum][3] : 1;
      areaContext.setSourceRGBA(r, g, b, a);
      this.drawRoundedRectangle(areaContext, vbarOffset, 1, vbarWidth, _height - 2, 1.0);
      areaContext.fill();

      if(currentR < maxValue) {
        barnum = 1;
        r = colorsList[barnum][0];
        g = colorsList[barnum][1];
        b = colorsList[barnum][2];
        a = (colorsList[barnum][3] != null) ? colorsList[barnum][3] : 1;
        areaContext.setSourceRGBA(r, g, b, a);
      } else {
        let alertColor = RGBa2rgba(this.applet.DiskUsage_colorAlert);
        areaContext.setSourceRGBA(alertColor[0], alertColor[1], alertColor[2], alertColor[3]);
      }

      this.drawRoundedRectangle(areaContext, vbarOffset, _height - vbarHeight, vbarWidth, vbarHeight, 1.0);
      areaContext.fill();

      // Label
      if (labelsEnabled) {
        let pangolayout = area.create_pango_layout(providerName);

        pangolayout.set_alignment(Pango.Alignment.CENTER);
        pangolayout.set_width(_width);
        let fontsize_px = Math.trunc(1 / 3 * _height);
        let fontdesc = Pango.font_description_from_string('Sans Normal ' + fontsize_px + 'px');
        pangolayout.set_font_description(fontdesc);

        areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);
        areaContext.moveTo(_width / 2, 0); //place text in center of graph area
        PangoCairo.layout_path(areaContext, pangolayout);
        areaContext.fill();
      }
    }
  }
}

class GraphPieChart {
  constructor(area, applet) {
    this.applet = applet;
    this.area = area;
  }

  paint(providerName, currentReadings, area, areaContext, labelsEnabled, width, height, labelColor, bgColor, colorsList) {
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

    let _width = width;
    let _height = height;
    let _x_origin = 0;
    let _y_origin = 0;

    //Draw Border
    let borderColor;
    if (this.applet.borderOn) {
      borderColor = RGBa2rgba(this.applet.borderColor);
      areaContext.setSourceRGBA(borderColor[0], borderColor[1], borderColor[2], borderColor[3]);
      //~ areaContext.rectangle(0, 0, width, height);
      //~ areaContext.fill();

      //~ areaContext.moveTo(0.5, 0);
      //~ areaContext.lineTo(width - 0.5, 0);
      //~ areaContext.lineTo(width - 0.5, height);
      //~ areaContext.lineTo(0.5, height);
      areaContext.moveTo(0, 0);
      areaContext.lineTo(width, 0);
      areaContext.lineTo(width, height);
      areaContext.lineTo(0, height);

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
    //~ this.drawRoundedRectangle(areaContext, 0, 0, width, height, 5.0);
    areaContext.rectangle(_x_origin, _y_origin, _width, _height);
    areaContext.fill();

    //Draw Pie Chart
    let xcenter = _width / 2;
    let ycenter = _height / 2;
    let radius = Math.min(xcenter, ycenter) - 1;

    let runningpercent = 0; //to make the arcs larger so that they becomes 1 after the next loop

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

    // Label
    if (labelsEnabled) {
      let pangolayout = area.create_pango_layout(providerName);

      pangolayout.set_alignment(Pango.Alignment.CENTER);
      pangolayout.set_width(_width);
      let fontsize_px = Math.trunc(1 / 3 * _height);
      let fontdesc = Pango.font_description_from_string('Sans Normal ' + fontsize_px + 'px');
      pangolayout.set_font_description(fontdesc);

      areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);
      areaContext.moveTo(_width / 2, 0); //place text in center of graph area
      PangoCairo.layout_path(areaContext, pangolayout);
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
    //~ for (let i = 0; i < props.length; i++) {
      //~ this[props[i]] = undefined;
    //~ }
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
    this.scale = 1.0;
    this.maxValue = 1.0;
    this.maxValueLoc = null;
    this.minMaxValue = 1.0;
  }

  refreshData(currentReadings, providerName) {
    let dataPoints = [];
    for (let i=0, len=currentReadings.length; i<len; i++) {
      if (!currentReadings[i].readingRatesList) {
        continue;
      }
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

    //double check what we just added isnt greater than our max (for all lines)
    for (let i=0, len=dataPoints.length; i<len; i++) {
      if (dataPoints[i] > this.maxValue && dataPoints[i] > this.minMaxValue) {
        this.maxValue = dataPoints[i];
        this.maxValueLoc = this.dataPointsListSize - 1;
        this.scale = 1.0 / this.maxValue;
      }
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

  paint(providerName, currentReadings, area, areaContext, labelsEnabled, width, height, labelColor, bgColor, colorsList=[]) {
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
    if (this.applet.borderOn) {
      borderColor = RGBa2rgba(this.applet.borderColor);
      areaContext.setSourceRGBA(borderColor[0], borderColor[1], borderColor[2], borderColor[3]);
      //~ areaContext.rectangle(0, 0, width, height);
      //~ areaContext.fill();

      //~ areaContext.moveTo(0.5, 0);
      //~ areaContext.lineTo(width - 0.5, 0);
      //~ areaContext.lineTo(width - 0.5, height);
      //~ areaContext.lineTo(0.5, height);
      areaContext.moveTo(0, 0);
      areaContext.lineTo(width, 0);
      areaContext.lineTo(width, height);
      areaContext.lineTo(0, height);

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
    //~ this.drawRoundedRectangle(areaContext, 0, 0, width, height, 5.0);
    //~ this.drawRoundedRectangle(areaContext, _x_origin, _y_origin, _width, _height, 5.0);
    areaContext.rectangle(_x_origin, _y_origin, _width, _height);
    areaContext.fill();

    //data
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
        let x1 = this.pixelsPerDataPoint * (j - 0.5) + this.pixelsPerDataPoint / 4;
        let x2 = this.pixelsPerDataPoint * j + this.pixelsPerDataPoint / 4;

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

        areaContext.curveTo(x1, y1, x1, y2, x2, y2);
      }
      areaContext.stroke();
    }

    // Label
    if (labelsEnabled) {
      let pangolayout = area.create_pango_layout(providerName);

      pangolayout.set_alignment(Pango.Alignment.CENTER);
      pangolayout.set_width(width);
      let fontsize_px = Math.trunc(1 / 3 * _height);
      let fontdesc = Pango.font_description_from_string('Sans Normal ' + fontsize_px + 'px');
      pangolayout.set_font_description(fontdesc);

      areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);
      areaContext.moveTo(width / 2, 0); //place text in center of graph area
      PangoCairo.layout_path(areaContext, pangolayout);
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
    //~ for (let i = 0; i < props.length; i++) {
      //~ this[props[i]] = undefined;
    //~ }
    for (let prop of props) {
      this[prop] = undefined;
    }
  }
}
