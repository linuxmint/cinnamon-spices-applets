const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const UUID = "multicore-sys-monitor@ccadeptic23";

//~ let dotCinnamonFilePath = GLib.get_home_dir() + '/.cinnamon/configs';
//~ let configFilePath;
//~ if (Gio.file_new_for_path(dotCinnamonFilePath).query_exists(null))
    //~ configFilePath = GLib.get_home_dir() + '/.cinnamon/configs/' + UUID;
//~ else
    //~ configFilePath = GLib.get_home_dir() + '/.config/cinnamon/spices/' + UUID;

const TAU = Math.PI * 2;

function RGBa2rgba(color) {
    //~ global.log("RGBa2rgba - Type of color: " + typeof color);
    if (typeof color == "string" && (color.includes(","))) {
        //~ global.log("RGBa2rgba - color: " + color);
        var rgbaArray = color.split(",");
        rgbaArray[0] = rgbaArray[0].replace(/rgba\(/g, "").replace(/rgb\(/g, "");
        rgbaArray[rgbaArray.length - 1] = rgbaArray[rgbaArray.length - 1].replace(/\)/g, "");
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
        //~ global.log("RGBa2rgba - rgbaArray: " + rgbaArray);
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
    //~ global.log(""+percentage+": "+r+", "+g+", "+b);
    return [r, g, b, a]
}

//~ let ConfigSettings = require('./ConfigSettings').ConfigSettings;

class GraphVBars {
  constructor(area, applet) {
    this.applet = applet;
    this.area = area;
    //~ this.configSettings = new ConfigSettings(configFilePath);
  }

  paint(providerName, currentReadings, area, areaContext, labelsEnabled, width, height, labelColor, bgColor, colorsList) {
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

    //~ global.log("GraphVBars labelColor: " + JSON.stringify(labelColor, null, 4));
    //~ global.log("GraphVBars bgColor: " + JSON.stringify(bgColor, null, 4));
    //~ global.log("GraphVBars colorsList: " + JSON.stringify(colorsList, null, 4));

    // Background
    areaContext.setSourceRGBA(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);

    //areaContext.rectangle(0, 0, this.width, this.height);
    this.drawRoundedRectangle(areaContext, 0, 0, width, height, 5.0);
    areaContext.fill();

    // Usage Data Bars
    let vbarWidth = (width - 6) / currentReadings.length;
    for (let i = 0; i < currentReadings.length; i++) {
      let currentR = parseFloat(currentReadings[i]);
      let vbarHeight = (height - 1) * currentR;
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
            //~ g = 0; b = 0
            r = colorsList[4][0];
            g = colorsList[4][1];
            b = colorsList[4][2];
            a = (colorsList[4][3] != null) ? colorsList[4][3] : 1;
          } else if (currentR >= 0.6) {
            //~ g = 127; b = 0
            r = colorsList[3][0];
            g = colorsList[3][1];
            b = colorsList[3][2];
            a = (colorsList[3][3] != null) ? colorsList[3][3] : 1;
          } else if (currentR >= 0.4) {
            //~ b = 0
            r = colorsList[2][0];
            g = colorsList[2][1];
            b = colorsList[2][2];
            a = (colorsList[2][3] != null) ? colorsList[2][3] : 1;
          } else if (currentR >= 0.2) {
            //~ r = 0 ; b = 0
            r = colorsList[1][0];
            g = colorsList[1][1];
            b = colorsList[1][2];
            a = (colorsList[1][3] != null) ? colorsList[1][3] : 1;
          } else {
            //~ r = 0 ; g = 0
            r = colorsList[0][0];
            g = colorsList[0][1];
            b = colorsList[0][2];
            a = (colorsList[0][3] != null) ? colorsList[0][3] : 1;
          }
        }
      }
      areaContext.setSourceRGBA(r, g, b, a);

      this.drawRoundedRectangle(areaContext, vbarOffset, height - vbarHeight, vbarWidth, vbarHeight, 1.5);
      areaContext.fill();
    }

    // Label
    if (labelsEnabled) {
      let pangolayout = area.create_pango_layout(providerName);

      pangolayout.set_alignment(Pango.Alignment.CENTER);
      pangolayout.set_width(width);
      let fontsize_px = Math.trunc(1 / 3 * height);
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
    for (let i = 0; i < props.length; i++) {
      this[props[i]] = undefined;
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

    //~ global.log("GraphPieChart labelColor: " + JSON.stringify(labelColor, null, 4));
    //~ global.log("GraphPieChart bgColor: " + JSON.stringify(bgColor, null, 4));
    //~ global.log("GraphPieChart colorsList: " + JSON.stringify(colorsList, null, 4));


    //Draw Background
    areaContext.setSourceRGBA(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);
    this.drawRoundedRectangle(areaContext, 0, 0, width, height, 5.0);
    areaContext.fill();

    //Draw Pie Chart
    let xcenter = width / 2;
    let ycenter = height / 2;
    let radius = Math.min(xcenter, ycenter) - 1;

    let runningpercent = 0; //to make the arcs larger so that they becomes 1 after the next loop

    areaContext.moveTo(xcenter, ycenter);
    for (let i = 0; i < currentReadings.length; i++) {
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
      pangolayout.set_width(width);
      let fontsize_px = Math.trunc(1 / 3 * height);
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
    for (let i = 0; i < props.length; i++) {
      this[props[i]] = undefined;
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
    //~ this.configSettings = new ConfigSettings(configFilePath);
  }

  refreshData(currentReadings, providerName) {
    let dataPoints = [];
    for (let i = 0; i < currentReadings.length; i++) {
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
    for (let i = 0; i < dataPoints.length; i++) {
      if (dataPoints[i] > this.maxValue && dataPoints[i] > this.minMaxValue) {
        this.maxValue = dataPoints[i];
        this.maxValueLoc = this.dataPointsListSize - 1;
        this.scale = 1.0 / this.maxValue;
      }
    }

    if (this.autoScale && this.maxValueLoc < 0) {
      //find a new max we lost the old one
      this.maxValue = 1.0;
      for (let i = 0; i < this.dataPointsList.length; i++) {
        for (let j = 0; j < dataPoints.length; j++) {
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
    //~ if (colorsList.length === 0) return;

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

    //Draw Background
    areaContext.setSourceRGBA(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);
    this.drawRoundedRectangle(areaContext, 0, 0, width, height, 5.0);
    areaContext.fill();

    //data
    let numLinesOnChart = 0;
    if (this.dataPointsList.length > 0) {
      numLinesOnChart = this.dataPointsList[0].length; //cheesy but it works
    }
    //~ global.log("GraphLineChart - numLinesOnChart: " + numLinesOnChart);

    for (let i = 0; i < numLinesOnChart; i++) {
      //use this to select datapointnum from our colorlist, its incase we have more datapointnums than colors
      //This shouldnt happen but just incase, essentially we reuse colors from the beginning if we run out
      let datapointnum = i % colorsList.length;
      let r, g, b, a;
      if (colorsList[datapointnum] == undefined) {
        //~ global.log("GraphLineChart - colorsList["+datapointnum+"] is undefined.");
        r = 1;
        g = 1;
        b = 1;
        a = 1;
      } else {
        //~ global.log("GraphLineChart - colorsList["+datapointnum+"]: " + JSON.stringify(colorsList[datapointnum], null, 4));
        r = colorsList[datapointnum][0];
        g = colorsList[datapointnum][1];
        b = colorsList[datapointnum][2];
        a = colorsList[datapointnum][3];
      }
      areaContext.setSourceRGBA(r, g, b, a);
      //~ areaContext.setLineWidth(this.configSettings.getThickness());
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

        let y1 = height - Math.floor((height - 1) * (rawy1 * this.scale));
        let y2 = height - Math.floor((height - 1) * (rawy2 * this.scale));

        areaContext.curveTo(x1, y1, x1, y2, x2, y2);
      }
      areaContext.stroke();
    }

    // Label
    if (labelsEnabled) {
      let pangolayout = area.create_pango_layout(providerName);

      pangolayout.set_alignment(Pango.Alignment.CENTER);
      pangolayout.set_width(width);
      let fontsize_px = Math.trunc(1 / 3 * height);
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
    for (let i = 0; i < props.length; i++) {
      this[props[i]] = undefined;
    }
  }
}
