const Mainloop = imports.mainloop;

var setTimeout = function(func, ms) {
  let args = [];
  if (arguments.length > 2) {
    args = args.slice.call(arguments, 2);
  }

  let id = Mainloop.timeout_add(ms, () => {
    func.apply(null, args);
    return false; // Stop repeating
  }, null);

  return id;
};

var clearTimeout = function(id) {
  Mainloop.source_remove(id);
};

var setInterval = function(func, ms) {
  let args = [];
  if (arguments.length > 2) {
    args = args.slice.call(arguments, 2);
  }

  let id = Mainloop.timeout_add(ms, () => {
    func.apply(null, args);
    return true; // Repeat
  }, null);

  return id;
};

var clearInterval = function(id) {
  Mainloop.source_remove(id);
};
// Native objects such as CinnamonApps and MetaWindows stringify with a unique identifier.
var isEqual = function(a, b) {
 /* if (!a) {
    a = 'null';
  }
  if (!b) {
    b = 'null';
  }*/
  return a === b;
};

var sortBy = function(array = [], property = '', direction = 'asc') {
  let arg;
  array.sort(function(a, b) {
    if (!a || !b || !a[property] || !b[property]) {
      return -1;
    }
    if (typeof (a[property] || b[property]) === 'number') {
      arg = direction === 'asc' ? a[property] - b[property] : b[property] - a[property];
    } else {
      arg = direction ===  'asc' ? a[property] > b[property] : a[property] < b[property];
    }
    return a[property] === b[property] ? 0 : +(arg) || -1;
  });
}

var isString = function(string) {
  return typeof string === 'string' || string instanceof String;
}

var unref = function(object) {
  let keys = Object.keys(object);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] !== 'buttonState' && keys[i] !== 'state') {
      object[keys[i]] = null;
    }
  }
};

var tryFn = function(fn, errCb) {
  try {
    return fn();
  } catch (e) {
    if (typeof errCb === 'function') {
      errCb(e);
    }
  }
};