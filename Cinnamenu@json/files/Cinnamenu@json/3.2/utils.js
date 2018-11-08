const GObject = imports.gi.GObject;
const Mainloop = imports.mainloop;

const setTimeout = function(func, ms) {
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

const clearTimeout = function(id) {
  Mainloop.source_remove(id);
};

const setInterval = function(func, ms) {
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

const clearInterval = function(id) {
  Mainloop.source_remove(id);
};
// Native objects such as CinnamonApps and MetaWindows stringify with a unique identifier.
const isEqual = function(a, b) {
  return a === b;
};

const sortBy = function(array = [], property = '', direction = 'asc') {
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

const sortDirs = (dirs) => {
  dirs.sort(function(a, b) {
    let prefCats = ['administration', 'preferences'];
    let menuIdA = a.get_menu_id().toLowerCase();
    let menuIdB = b.get_menu_id().toLowerCase();
    let prefIdA = prefCats.indexOf(menuIdA);
    let prefIdB = prefCats.indexOf(menuIdB);
    if (prefIdA < 0 && prefIdB >= 0) {
      return -1;
    }
    if (prefIdA >= 0 && prefIdB < 0) {
      return 1;
    }
    let nameA = a.get_name().toLowerCase();
    let nameB = b.get_name().toLowerCase();
    if (nameA > nameB) {
      return 1;
    }
    if (nameA < nameB) {
      return -1;
    }
    return 0;
  });
  return dirs;
};

const isString = function(string) {
  return typeof string === 'string' || string instanceof String;
}

const unref = function(object) {
  let keys = Object.keys(object);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== 'buttonState' && keys[i] !== 'state') {
      object[keys[i]] = null;
    }
  }
};

const tryFn = function(fn, errCb) {
  try {
    return fn();
  } catch (e) {
    if (typeof errCb === 'function') {
      errCb(e);
    }
  }
};

const map = function (arr, fn) {
  if (arr == null) {
    return [];
  }

  let len = arr.length;
  let out = Array(len);

  for (let i = 0; i < len; i++) {
    out[i] = fn(arr[i], i, arr);
  }

  return out;
}

const find = function(arr, cb) {
  for (let i = 0, len = arr.length; i < len; i++) {
    if (cb(arr[i], i, arr)) {
      return arr[i];
    }
  }
  return null;
}

// TODO: Use this instead of queryCollection
const findIndex = function(arr, cb) {
  for (let i = 0, len = arr.length; i < len; i++) {
    if (cb(arr[i], i, arr)) {
      return i;
    }
  }
  return -1;
}

const isFinalized = function(obj) {
  return obj && GObject.Object.prototype.toString.call(obj).indexOf('FINALIZED') > -1;
}