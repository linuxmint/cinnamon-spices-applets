'use strict';

var Lang = imports.lang;
var Mainloop = imports.mainloop;
var setTimeout = function setTimeout(cb, duration) {
  var _this = this,
      _arguments = arguments;

  Mainloop.timeout_add(duration, Lang.bind(this, function () {
    cb.call(_this, _arguments);
  }));
};

var Main = imports.ui.main;
var clog = function clog() {
  var label = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'LOG';
  var input = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '...';

  try {
    if (label === undefined || label === null) {
      Main._logInfo('NULL: ');
      Main._logTrace(label);
    } else if (input === undefined || input === null) {
      Main._logInfo((label ? label : 'NULL') + ': ');
      Main._logTrace(input);
    } else {
      Main._logInfo(label + ': ' + JSON.stringify(input));
    }
  } catch (e) {
    try {
      Main._logInfo(label + ': ' + e);
    } catch (e) {
      Main._logInfo('Could not parse logging input: ' + e);
    }
  }
};