'use strict';

function leadingZero(number) {
  if (!number || typeof number !== 'number') {
    return '00';
  }

  return number < 10 ? `0${number}` : number;
}

function dateToFormat(date, format) {
  const year = date.getFullYear();
  const month = leadingZero(date.getMonth() + 1);
  const day = leadingZero(date.getDate());

  let result = format.replace('Y', year);
  result = result.replace('M', month);
  result = result.replace('D', day);

  return result;
}

function periodFormat(interval, format) {
  const start = new Date();
  const end = new Date();

  start.setDate(start.getDate() - interval);

  return [dateToFormat(start, format), dateToFormat(end, format)];
}

function setSign(value) {
  if (value > 0) {
    return ' \u25b4';
  }
  else if (value < 0) {
    return ' \u25be';
  }

  return '';
}

function setStyle(value) {
  if (value > 0) {
    return 'color: #32d74b';
  }
  else if (value < 0) {
    return 'color: #ff453a';
  }

  return '';
}

function getPrice(number, symbol) {
  const price = parseFloat(number);

  if (typeof price !== 'number') {
    return;
  }

  const options = {
    style: 'currency',
    currency: symbol.toUpperCase(),
  };

  if (Math.abs(price) < 1) {
    options.minimumFractionDigits = 3;
  }

  return price.toLocaleString(undefined, options);
}

function getPercent(num) {
  if (typeof num !== 'number') {
    return;
  }

  const options = {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  };

  return ` ${parseFloat(num).toLocaleString(undefined, options)}%${setSign(num)}`;
}

function getDelta(num, symbol) {
  if (typeof num !== 'number') {
    return;
  }

  const options = {
    style: 'currency',
    currency: symbol.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  };

  if (Math.abs(num) < 1) {
    options.maximumFractionDigits = 3;
  }

  return `${parseFloat(num).toLocaleString(undefined, options)}${setSign(num)}`;
}

function toJSON(xmlStr, valueProp) {
  if (!xmlStr) {
    return;
  }

  const obj = {};
  const tag = /<[^>]*>/;
  let openingTag;
  let tagName;
  let inner;
  let tmpObj;

  openingTag = xmlStr.match(tag)[0];
  tagName = openingTag.substring(1, openingTag.length - 1);
  obj[tagName] = [];

  while (xmlStr.match(tag)) {
    inner = xmlStr.substring(openingTag.length, xmlStr.indexOf(`</${tagName}>`));
    xmlStr = xmlStr.substring(openingTag.length * 2 + 1 + inner.length);
    tmpObj = {};

    while (inner.match(tag)) {
      const keyTag = inner.match(tag)[0];
      const key = keyTag.substring(1, keyTag.length - 1);
      const val = inner.substring(keyTag.length, inner.indexOf(`</${key}>`));

      tmpObj[key] = val;
      inner = inner.substring(keyTag.length * 2 + 1 + val.length);
    }

    obj[tagName].push(tmpObj);
  }

  obj[tagName].forEach(data => {
    data.value = parseFloat(String(data[valueProp]));
  });

  return xmlStr.length ? 'Error' : obj;
}

// update every day at 23:00 (11:00 PM)
function getTimeToUpdateFiat() {
  const now = new Date();
  const newDate = now.getHours() >= 23 ? now.getDate() + 2 : now.getDate() + 1;
  const updateDate = new Date(now.getFullYear(), now.getMonth(), newDate);

  return Math.round((updateDate - now) / 1000 - 60 * 60);
}
