'use strict';

const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;

function drawGraph(width, height, context, graphData, labels, colors, duration, messages, crypto) {
  const graphColor = Clutter.Color.from_string(colors.graph)[1];
  const red = graphColor.red / 255;
  const green = graphColor.green / 255;
  const blue = graphColor.blue / 255;
  const fontSizeTitle = 18;
  const fontSizeNormal = 11;

  let min = 0;
  let max = 0;
  let average = 0;

  const lineChart = data => {
    const length = data.length;

    // Max, Min and Average price
    const values = data.map(item => item.value);
    min = Math.min(...values, Number.POSITIVE_INFINITY);
    max = Math.max(...values, Number.NEGATIVE_INFINITY);

    const delta = max - min;
    average = values.reduce((accumulator, item) => accumulator + item, 0) / length;

    // Draw graph
    const heightGraph = height - 112;
    const step = (width - 110) / length;

    for (let i = 0; i < length; i++) {
      const nextIndex = (i + 1) === length ? i : i + 1;
      const valueLeft = height - 30 - (heightGraph * ((data[i].value - min) / delta));
      const valueRight = height - 30 - (heightGraph * ((data[nextIndex].value - min) / delta));
      const moveXleft = step / 2 + step * i;
      const moveXright = step / 2 + step * nextIndex;

      context.setSourceRGB(red, green, blue);
      context.moveTo(moveXleft, valueLeft);
      context.setLineWidth(2);
      context.lineTo(moveXright, valueRight);
      context.stroke();
    }
  };

  // EU graph
  if (graphData.hasOwnProperty('Obs')) {
    lineChart(graphData.Obs);
  }
  // RU graph
  else if (graphData.hasOwnProperty('Record')) {
    lineChart(graphData.Record);
  }
  // Crypto graph
  else if (graphData.hasOwnProperty('Data')) {
    const data = graphData.Data;
    const length = data.length;

    // Max and Min price
    min = Math.min(...data.map(item => item.low), Number.POSITIVE_INFINITY);
    max = Math.max(...data.map(item => item.high), Number.NEGATIVE_INFINITY);

    const delta = max - min;

    // Draw graph
    const heightGraph = height - 90;
    const step = (width - 110) / length;

    data.forEach((data, index) => {
      const low = heightGraph * ((data.low - min) / delta);
      const high = heightGraph * ((data.high - min) / delta);
      const open = heightGraph * ((data.open - min) / delta);
      const close = heightGraph * ((data.close - min) / delta);
      const moveX = step / 2 + step * index;

      context.setSourceRGBA(red, green, blue, 1);
      context.moveTo(moveX, height - 30 - low);
      context.setLineWidth(1);
      context.lineTo(moveX, height - 30 - high);
      context.stroke();

      context.setSourceRGBA(red, green, blue, open < close ? 1 : .4);
      context.moveTo(moveX, height - 30 - open);
      context.setLineWidth(3);
      context.lineTo(moveX, height - 30 - close);
      context.stroke();
    });
  }
  // Error
  else {
    // Error text
    graphText(context, graphColor, fontSizeTitle + 2, 15, height / 2 - (fontSizeTitle + 2), messages.error);
    graphText(context, graphColor, fontSizeNormal + 3, 15, height / 2 + (fontSizeNormal + 3), messages.wait);

    return;
  }

  const colorIncrease = Clutter.Color.from_string(colors.increase)[1];
  const colorDecrease = Clutter.Color.from_string(colors.decrease)[1];

  if (crypto) {
    const colorPercent1H = labels.percent['1H'] < 0 ? colorDecrease : colorIncrease;
    const colorPercent24H = labels.percent['24H'] < 0 ? colorDecrease : colorIncrease;
    const colorPercent7D = labels.percent['7D'] < 0 ? colorDecrease : colorIncrease;
    const colorDeltaCrypto = labels.delta < 0 ? colorDecrease : colorIncrease;

    const titleSize = (width - labels.title.length * 9) / 2;
    const history = messages.history + duration + wordEndings(duration, messages.days);
    const historySize = width - history.length * 6.5 - 10;
    const lastDateSize = width - labels.lastUpdated.length * 6.5 - 10;

    graphText(context, graphColor, fontSizeTitle, titleSize, 22, labels.title); // Title text
    graphText(context, graphColor, fontSizeNormal, 15, 45, labels.maxLabel(max)); // Max price text
    graphText(context, graphColor, fontSizeNormal, historySize, 45, history); // Count history days text
    graphLine(context, graphColor, 8, 50, width, 1); // Top line
    graphText(context, graphColor, fontSizeNormal + 1, width - 100, 80, labels.rank); // Rank text
    graphText(context, colorDeltaCrypto, fontSizeNormal, width - 100, 110, labels.deltaLabel); // Delta text
    graphText(context, colorPercent1H, fontSizeNormal, width - 100, 150, labels.percentLabel['1H']); // Percents text
    graphText(context, colorPercent24H, fontSizeNormal, width - 100, 170, labels.percentLabel['24H']); // Percents text
    graphText(context, colorPercent7D, fontSizeNormal, width - 100, 190, labels.percentLabel['7D']); // Percents text
    graphLine(context, graphColor, 8, height - 16, width, 1); // Bottom line
    graphText(context, graphColor, fontSizeNormal, 15, height - 2, labels.minLabel(min)); // Min price text
    graphText(context, graphColor, fontSizeNormal, lastDateSize, height - 2, labels.lastUpdated); // Last update text
  }
  else {
    const colorPercent = labels.percent < 0 ? colorDecrease : colorIncrease;
    const colorDelta = labels.delta < 0 ? colorDecrease : colorIncrease;

    const history = messages.history + duration + wordEndings(duration, messages.days);
    const historySize = width - history.length * (fontSizeNormal / 2 + 1.5) - 10;
    const lastDateSize = width - labels.lastUpdate.length * (fontSizeNormal / 2 + 1.5) - 10;

    graphText(context, graphColor, fontSizeTitle, 30, 22, labels.name); // Name text
    graphText(context, graphColor, fontSizeTitle, 30, 44, labels.price); // Price text
    graphText(context, graphColor, fontSizeNormal, 15, 67, labels.maxLabel(max)); // Max price text
    graphText(context, graphColor, fontSizeNormal, historySize, 67, history); // Count history days text
    graphLine(context, graphColor, 8, 72, width, 1); // Top line
    graphText(context, graphColor, fontSizeNormal + 1, width - 100, 90, messages.average); // Average price text
    graphText(context, graphColor, fontSizeNormal + 1, width - 100, 108, labels.averageLabel(average)); // Average price text
    graphText(context, colorPercent, fontSizeNormal + 3, width - 100, 160, labels.percentLabel); // Percents text
    graphText(context, colorDelta, fontSizeNormal + 1, width - 100, 180, labels.deltaLabel); // Delta text
    graphLine(context, graphColor, 8, height - 16, width, 1); // Bottom line
    graphText(context, graphColor, fontSizeNormal, 15, height - 2, labels.minLabel(min)); // Min price text
    graphText(context, graphColor, fontSizeNormal, lastDateSize, height - 2, labels.lastUpdate); // Last update text
  }
}

function graphText(context, graphColor, FontSize, pxX, pxY, text) {
  context.setSourceRGBA(graphColor.red / 255, graphColor.green / 255, graphColor.blue / 255, .8);
  context.setFontSize(FontSize);
  context.moveTo(pxX, pxY);
  context.showText(text);
}

function graphLine(context, graphColor, posX, posY, width, height) {
  context.setSourceRGBA(graphColor.red / 255, graphColor.green / 255, graphColor.blue / 255, .2);
  context.moveTo(posX, posY);
  context.setLineWidth(height);
  context.lineTo(width - posX, posY);
  context.stroke();
}

function wordEndings(number, titles) {
  const n = parseInt(number);

  // if the system language is Russian
  if (GLib.getenv('LANG').startsWith('ru')) {
    return titles[(n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2)];
  }
  else {
    return titles[(n !== 1 ? 1 : 0)];
  }
}
