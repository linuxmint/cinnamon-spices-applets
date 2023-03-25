const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const UUID = "multicore-sys-monitor@ccadeptic23";

let dotCinnamonFilePath = GLib.get_home_dir() + '/.cinnamon/configs';
let configFilePath;
if (Gio.file_new_for_path(dotCinnamonFilePath).query_exists(null))
  configFilePath = GLib.get_home_dir() + '/.cinnamon/configs/' + UUID;
else
  configFilePath = GLib.get_home_dir() + '/.config/cinnamon/spices/' + UUID;


let ConfigSettings;
if (typeof require !== 'undefined') {
  ConfigSettings = require('./ConfigSettings').ConfigSettings;
} else {
  const AppletDir = imports.ui.appletManager.applets[UUID];
  ConfigSettings = AppletDir.ConfigSettings.ConfigSettings;
}

function GraphVBars(area) {
  this._init(area);
}

GraphVBars.prototype = {
  _init: function(area) {

  },

  paint: function(providerName, currentReadings, area, areaContext, labelsEnabled, width, height, labelColor, bgColor, colorsList) {
    if (!labelColor) {
      labelColor = [1, 1, 1, 0.1];
    }

    // Background
    areaContext.setSourceRGBA(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);

    //areaContext.rectangle(0, 0, this.width, this.height);
    this.drawRoundedRectangle(areaContext, 0, 0, width, height, 5.0);
    areaContext.fill();

    // Usage Data Bars
    let vbarWidth = (width - 6) / currentReadings.length;
    for (let i = 0; i < currentReadings.length; i++) {
      let vbarHeight = (height - 1) * currentReadings[i];
      let vbarOffset = i * vbarWidth + 3;

      //use this to select cpu from our colorlist, its incase we have more cpus than colors
      //This shouldnt happen but just incase
      let cpunum = i % colorsList.length;
      let r = colorsList[cpunum][0];
      let g = colorsList[cpunum][1];
      let b = colorsList[cpunum][2];
      let a = colorsList[cpunum][3];
      areaContext.setSourceRGBA(r, g, b, a);

      this.drawRoundedRectangle(areaContext, vbarOffset, height - vbarHeight, vbarWidth, vbarHeight, 1.5);
      areaContext.fill();
    }

    // Label
    if (labelsEnabled) {
      let pangolayout = area.create_pango_layout(providerName);

      pangolayout.set_alignment(Pango.Alignment.CENTER);
      pangolayout.set_width(width);
      let fontsize_px = 1 / 3 * height;
      let fontdesc = Pango.font_description_from_string('Sans Normal ' + fontsize_px + 'px');
      pangolayout.set_font_description(fontdesc);

      areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);
      areaContext.moveTo(width / 2, 0); //place text in center of graph area
      PangoCairo.layout_path(areaContext, pangolayout);
      areaContext.fill();
    }
  },

  drawRoundedRectangle: function(areaContext, x, y, width, height, radius) {
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
  },
  destroy: function() {
    let props = Object.keys(this);
    for (let i = 0; i < props.length; i++) {
      this[props[i]] = undefined;
    }
  },
};

function GraphPieChart(area) {
  this._init(area);
}

GraphPieChart.prototype = {
  _init: function(area) {},
  paint: function(providerName, currentReadings, area, areaContext, labelsEnabled, width, height, labelColor, bgColor, colorsList) {
    if (!labelColor) {
      labelColor = [1, 1, 1, 0.1];
    }

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

      let startangle = 2 * 3.14159 * runningpercent;
      let endangle = 2 * 3.14159 * (runningpercent + currentReadings[i]);
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
      let fontsize_px = 1 / 3 * height;
      let fontdesc = Pango.font_description_from_string('Sans Normal ' + fontsize_px + 'px');
      pangolayout.set_font_description(fontdesc);

      areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);
      areaContext.moveTo(width / 2, 0); //place text in center of graph area
      PangoCairo.layout_path(areaContext, pangolayout);
      areaContext.fill();
    }
  },

  drawRoundedRectangle: function(areaContext, x, y, width, height, radius) {
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
  },
  destroy: function() {
    let props = Object.keys(this);
    for (let i = 0; i < props.length; i++) {
      this[props[i]] = undefined;
    }
  },
};

function GraphLineChart(area, width) {
  this._init(area, width);
}

GraphLineChart.prototype = {
  _init: function(area, width) {

    this.pixelsPerDataPoint = 5 * global.ui_scale;
    this.dataPointsListSize = this.getDataPointsListSize(width);
    this.dataPointsList = [];

    this.autoScale = false;
    this.logScale = false;
    this.scale = 1.0;
    this.maxValue = 1.0;
    this.maxValueLoc = null;
    this.minMaxValue = 1.0;
    this.configSettings = new ConfigSettings(configFilePath);
  },

  refreshData: function(currentReadings, providerName) {
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
  },

  getDataPointsListSize: function(width) {
    return Math.round(width / this.pixelsPerDataPoint);
  },
  resizeDataPointsList: function(newsize, numdatapoints) {
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
  },

  paint: function(providerName, currentReadings, area, areaContext, labelsEnabled, width, height, labelColor, bgColor, colorsList) {

    this.refreshData(currentReadings, providerName);
    if (!labelColor) {
      labelColor = [1, 1, 1, 0.1];
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

    for (let i = 0; i < numLinesOnChart; i++) {
      //use this to select datapointnum from our colorlist, its incase we have more datapointnums than colors
      //This shouldnt happen but just incase, essentially we reuse colors from the beginning if we run out
      let datapointnum = i % colorsList.length;
      let r = colorsList[datapointnum][0];
      let g = colorsList[datapointnum][1];
      let b = colorsList[datapointnum][2];
      let a = colorsList[datapointnum][3];
      areaContext.setSourceRGBA(r, g, b, a);
      areaContext.setLineWidth(this.configSettings.getThickness());

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
      let fontsize_px = 1 / 3 * height;
      let fontdesc = Pango.font_description_from_string('Sans Normal ' + fontsize_px + 'px');
      pangolayout.set_font_description(fontdesc);

      areaContext.setSourceRGBA(labelColor[0], labelColor[1], labelColor[2], labelColor[3]);
      areaContext.moveTo(width / 2, 0); //place text in center of graph area
      PangoCairo.layout_path(areaContext, pangolayout);
      areaContext.fill();
    }
  },

  drawRoundedRectangle: function(areaContext, x, y, width, height, radius) {
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
  },
  destroy: function() {
    let props = Object.keys(this);
    for (let i = 0; i < props.length; i++) {
      this[props[i]] = undefined;
    }
  },
};
