//#!/usr/bin/gjs
const St = imports.gi.St;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;

function GraphVBars(area, provider) {
  this._init(area, provider);
}

GraphVBars.prototype = {

  _init: function(area, provider) {
    this.area = area;
    this.datalist = [];
    this.provider = provider;

  },

  paint: function(area, labelson, width, height, bgcolor, colorslist) {
    let cr = area.get_context();

    // Background
    cr.setSourceRGBA(bgcolor[0], bgcolor[1], bgcolor[2], bgcolor[3]);

    //cr.rectangle(0, 0, this.width, this.height);
    this.drawRoundedRectangle(cr, 0, 0, width, height, 5.0);
    cr.fill();

    // Usage Data Bars
    let vbarWidth = (width - 6) / (this.datalist.length);
    for (var i = 0; i < this.datalist.length; i++) {
      let vbarHeight = (height - 1) * this.datalist[i];
      let vbarOffset = i * vbarWidth + 3;

      //use this to select cpu from our colorlist, its incase we have more cpus than colors
      //This shouldnt happen but just incase
      var cpunum = i % colorslist.length;
      var r = colorslist[cpunum][0];
      var g = colorslist[cpunum][1];
      var b = colorslist[cpunum][2];
      var a = colorslist[cpunum][3];
      cr.setSourceRGBA(r, g, b, a);

      this.drawRoundedRectangle(cr, vbarOffset, height - vbarHeight, vbarWidth, vbarHeight, 1.50);
      cr.fill();
    }

    // Label
    if (labelson) {
      var labelstr = this.provider.getName();
      var pangolayout = this.area.create_pango_layout(labelstr);

      pangolayout.set_alignment(Pango.Alignment.CENTER);
      pangolayout.set_width(width);
      var fontsize_px = (1 / 3) * height;
      var fontdesc = Pango.font_description_from_string("Sans Normal " + fontsize_px + "px");
      pangolayout.set_font_description(fontdesc);

      cr.setSourceRGBA(1, 1, 1, 1);
      cr.moveTo(width / 2, 0); //place text in center of graph area
      PangoCairo.layout_path(cr, pangolayout);
      cr.fill();
    }

  },

  drawRoundedRectangle: function(cr, x, y, width, height, radius) {
    if (height > 0) {
      var degrees = 3.14159 / 180.0;
      cr.newSubPath();

      cr.moveTo(x + radius, y); // Move to A
      cr.lineTo(x + width - radius, y); // Straight line to B
      cr.curveTo(x + width, y, x + width, y, x + width, y + radius); // Curve to C, Control points are both at Q
      cr.lineTo(x + width, y + height - radius); // Move to D
      cr.curveTo(x + width, y + height, x + width, y + height, x + width - radius, y + height); // Curve to E
      cr.lineTo(x + radius, y + height); // Line to F
      cr.curveTo(x, y + height, x, y + height, x, y + height - radius); // Curve to G
      cr.lineTo(x, y + radius); // Line to H
      cr.curveTo(x, y, x, y, x + radius, y); // Curve to A

      cr.closePath();
    }
  },
  refreshData: function() {
    this.datalist = this.provider.getData();
  }

};

function GraphPieChart(area, provider) {
  this._init(area, provider);
}

GraphPieChart.prototype = {

  _init: function(area, provider) {
    this.area = area;
    this.datalist = [];
    this.provider = provider;
  },
  paint: function(area, labelson, width, height, bgcolor, colorslist) {
    let cr = area.get_context();

    //Draw Background
    cr.setSourceRGBA(bgcolor[0], bgcolor[1], bgcolor[2], bgcolor[3]);
    this.drawRoundedRectangle(cr, 0, 0, width, height, 5.0);
    cr.fill();

    //Draw Pie Chart
    var xcenter = width / 2;
    var ycenter = height / 2;
    var radius = width / 2 - 1;
    if (height < width)
      radius = height / 2 - 1;

    var runningpercent = 0; //to make the arcs larger so that they becomes 1 after the next loop

    cr.moveTo(xcenter, ycenter);
    for (var i = 0; i < this.datalist.length; i++) {
      //use this to select datapointnum from our colorlist, its incase we have more datapointnums than colors
      //This shouldnt happen but just incase, essentially we reuse colors from the beginning if we run out
      var datapointnum = i % colorslist.length;
      var r = colorslist[datapointnum][0];
      var g = colorslist[datapointnum][1];
      var b = colorslist[datapointnum][2];
      var a = colorslist[datapointnum][3];

      var startangle = (2 * 3.14159) * runningpercent;
      var endangle = (2 * 3.14159) * (runningpercent + this.datalist[i])
      runningpercent += this.datalist[i]; //update running percent

      cr.setSourceRGBA(r, g, b, a);
      cr.newPath();
      cr.moveTo(xcenter, ycenter);

      cr.arc(xcenter, ycenter, radius, startangle, endangle);

      cr.lineTo(xcenter, ycenter);
      cr.closePath();
      cr.fill();
    }

    // Label
    if (labelson) {
      var labelstr = this.provider.getName();
      var pangolayout = this.area.create_pango_layout(labelstr);

      pangolayout.set_alignment(Pango.Alignment.CENTER);
      pangolayout.set_width(width);
      var fontsize_px = (1 / 3) * height;
      var fontdesc = Pango.font_description_from_string("Sans Normal " + fontsize_px + "px");
      pangolayout.set_font_description(fontdesc);

      cr.setSourceRGBA(1, 1, 1, 1);
      cr.moveTo(width / 2, 0); //place text in center of graph area
      PangoCairo.layout_path(cr, pangolayout);
      cr.fill();
    }

  },

  drawRoundedRectangle: function(cr, x, y, width, height, radius) {
    if (height > 0) {
      var degrees = 3.14159 / 180.0;
      cr.newSubPath();

      cr.moveTo(x + radius, y); // Move to A
      cr.lineTo(x + width - radius, y); // Straight line to B
      cr.curveTo(x + width, y, x + width, y, x + width, y + radius); // Curve to C, Control points are both at Q
      cr.lineTo(x + width, y + height - radius); // Move to D
      cr.curveTo(x + width, y + height, x + width, y + height, x + width - radius, y + height); // Curve to E
      cr.lineTo(x + radius, y + height); // Line to F
      cr.curveTo(x, y + height, x, y + height, x, y + height - radius); // Curve to G
      cr.lineTo(x, y + radius); // Line to H
      cr.curveTo(x, y, x, y, x + radius, y); // Curve to A

      cr.closePath();
    }
  },

  refreshData: function() {
    this.datalist = this.provider.getData();
  }

};

function GraphLineChart(area, provider, width) {
  this._init(area, provider, width);
}

GraphLineChart.prototype = {
  _init: function(area, provider, width) {
    this.area = area;
    this.provider = provider;

    this.pixelsPerDataPoint = 5;
    this.dataPointsListSize = this.getDataPointsListSize(width);
    this.dataPointsList = [];

    this.autoScale = false;
    this.logScale = false;
    this.scale = 1.0;
    this.maxvalue = 1.0;
    this.maxvalueloc = null;
    this.minMaxValue = 1.0;

  },

  refreshData: function() {
    var datapoints = this.provider.getData();
    if (datapoints.length == 0)
      return true;

    if (this.maxvalueloc == null) //initialize
    {
      this.resizeDataPointsList(this.dataPointsListSize, datapoints.length);
    }

    this.dataPointsList.push(datapoints);
    this.dataPointsList.shift();
    this.maxvalueloc--;

    //double check what we just added isnt greater than our max (for all lines)
    for (var i = 0; i < datapoints.length; i++) {
      if (datapoints[i] > this.maxvalue && datapoints[i] > this.minMaxValue) {
        this.maxvalue = datapoints[i];
        this.maxvalueloc = this.dataPointsListSize - 1;
        this.scale = 1.0 / this.maxvalue;
      }
    }

    if (this.autoScale && (this.maxvalueloc < 0)) //find a new max we lost the old one
    {
      this.maxvalue = 1.0;
      for (var i = 0; i < this.dataPointsList.length; i++) {
        for (var j = 0; j < datapoints.length; j++) {
          if (this.dataPointsList[i][j] >= this.maxvalue && this.dataPointsList[i][j] > this.minMaxValue) {
            this.maxvalue = this.dataPointsList[i][j];
            this.maxvalueloc = i;
            this.scale = 1.0 / this.maxvalue;
          }
        }
      }

    }
    if (this.logScale && this.maxvalue > 1.0) {
      this.scale = 1.0 / Math.log(this.maxvalue);
    }
    //global.logError("scale: "+this.scale+" this.max:"+this.maxvalue+" this.minmaxVal:"+this.minMaxValue);
    return true;
  },

  getDataPointsListSize: function(width) {
    return Math.round(width / this.pixelsPerDataPoint);
  },
  resizeDataPointsList: function(newsize, numdatapoints) {
    this.dataPointsListSize = newsize;
    var newdatapointslist = [];
    for (var i = 0; i < newsize; i++) {
      if (i < (this.dataPointsList.length)) {
        newdatapointslist.push(this.dataPointsList[i]);
      } else {
        var emptypoints = [];
        for (var j = 0; j < numdatapoints; j++)
          emptypoints[j] = undefined;
        newdatapointslist.unshift(emptypoints);
      }
    }
    this.dataPointsList = newdatapointslist;
  },

  paint: function(area, labelson, width, height, bgcolor, colorslist) {
    let cr = area.get_context();
    if (this.dataPointsListSize != this.getDataPointsListSize(width)) {
      this.resizeDataPointsList(this.getDataPointsListSize(width), colorslist.length);
    }

    //Draw Background
    cr.setSourceRGBA(bgcolor[0], bgcolor[1], bgcolor[2], bgcolor[3]);
    this.drawRoundedRectangle(cr, 0, 0, width, height, 5.0);
    cr.fill();

    //data
    var numLinesOnChart = 0;
    if (this.dataPointsList.length > 0)
      numLinesOnChart = this.dataPointsList[0].length; //cheesy but it works
    for (var i = 0; i < numLinesOnChart; i++) {
      var lastval = 0;
      var beforelastval = 0;
      //use this to select datapointnum from our colorlist, its incase we have more datapointnums than colors
      //This shouldnt happen but just incase, essentially we reuse colors from the beginning if we run out
      var datapointnum = i % colorslist.length;
      var r = colorslist[datapointnum][0];
      var g = colorslist[datapointnum][1];
      var b = colorslist[datapointnum][2];
      var a = colorslist[datapointnum][3];
      cr.setSourceRGBA(r, g, b, a);
      cr.setLineWidth(1);
      //cr.setAntialias(1) //none
      cr.setLineJoin(1); //rounded
      for (var j = 1; j < this.dataPointsList.length; j++) {
        var maxvalue = this.minMaxValue;
        if (this.maxvalue > this.minMaxValue)
          maxvalue = this.maxvalue;

        //var val = Math.floor((height-1) * (this.dataPointsList[j][i]/(maxvalue)));

        var x1 = this.pixelsPerDataPoint * (j - 0.5) + this.pixelsPerDataPoint / 4;
        var x2 = this.pixelsPerDataPoint * (j) + this.pixelsPerDataPoint / 4;

        if (this.dataPointsList[j][i] == undefined || this.dataPointsList[j - 1][i] == undefined) //skip the beginning ones
          continue;
        var rawy1 = this.dataPointsList[j - 1][i];
        var rawy2 = this.dataPointsList[j][i];
        if (this.logScale) {
          //global.logError("Log scale2.");
          if (rawy1 >= 1)
            rawy1 = Math.log(rawy1);
          if (rawy2 >= 1)
            rawy2 = Math.log(rawy2);
        }
        //var y1 = height-Math.floor((height-1) * (rawy1/(maxvalue)));
        //var y2 = height-Math.floor((height-1) * (rawy2/(maxvalue)));
        var y1 = height - Math.floor((height - 1) * (rawy1 * this.scale));
        var y2 = height - Math.floor((height - 1) * (rawy2 * this.scale));
        //if(y1<0 || y2<0 || y1>30 || y2>30)
        //global.logError("rawy1: "+rawy1+" rawy2: "+rawy2+" y1: "+y1+" y2:"+y2+" scale: "+this.scale+" maxvale:"+maxvalue+" effscale: "+(1.0/maxvalue)+" this.maxv:"+this.maxvalue);
        cr.curveTo(x1, y1, x1, y2, x2, y2);
      }
      cr.stroke();
    }

    // Label
    if (labelson) {
      var labelstr = this.provider.getName();
      var pangolayout = this.area.create_pango_layout(labelstr);

      pangolayout.set_alignment(Pango.Alignment.CENTER);
      pangolayout.set_width(width);
      var fontsize_px = (1 / 3) * height;
      var fontdesc = Pango.font_description_from_string("Sans Normal " + fontsize_px + "px");
      pangolayout.set_font_description(fontdesc);

      cr.setSourceRGBA(1, 1, 1, 1);
      cr.moveTo(width / 2, 0); //place text in center of graph area
      PangoCairo.layout_path(cr, pangolayout);
      cr.fill();
    }
  },

  setColor: function(cr, i) {
    let c = this.colors[i % this.colors.length];
    cr.setSourceRGBA(c[0], c[1], c[2], c[3]);
  },

  setMinScaleYvalue: function(minMaxValue) {
    if (minMaxValue > 0) {
      this.minMaxValue = minMaxValue;
    }
  },
  setAutoScale: function(isautoscale) {
    this.autoScale = isautoscale;
  },
  setLogScale: function(islogscale) {
    this.logScale = islogscale;
  },
  drawRoundedRectangle: function(cr, x, y, width, height, radius) {
    if (height > 0) {
      var degrees = 3.14159 / 180.0;
      cr.newSubPath();

      cr.moveTo(x + radius, y); // Move to A
      cr.lineTo(x + width - radius, y); // Straight line to B
      cr.curveTo(x + width, y, x + width, y, x + width, y + radius); // Curve to C, Control points are both at Q
      cr.lineTo(x + width, y + height - radius); // Move to D
      cr.curveTo(x + width, y + height, x + width, y + height, x + width - radius, y + height); // Curve to E
      cr.lineTo(x + radius, y + height); // Line to F
      cr.curveTo(x, y + height, x, y + height, x, y + height - radius); // Curve to G
      cr.lineTo(x, y + radius); // Line to H
      cr.curveTo(x, y, x, y, x + radius, y); // Curve to A

      cr.closePath();
    }
  },
};