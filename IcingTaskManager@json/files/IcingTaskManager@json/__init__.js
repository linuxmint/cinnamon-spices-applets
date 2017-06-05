const Lang = imports.lang;
const Mainloop = imports.mainloop;
const setTimeout = function(cb, duration){
  Mainloop.timeout_add(duration, Lang.bind(this, ()=>{
    cb.call(this, arguments)
  }))
}

const Main = imports.ui.main;
function clog() {
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