const Gettext = imports.gettext;
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

function throttle(fn, interval, callFirst) {
  let wait = false;
  let callNow = false;
  return function() {
    callNow = callFirst && !wait;
    let context = this;
    let args = arguments;
    if (!wait) {
      wait = true;
      setTimeout(function() {
        wait = false;
        if (!callFirst) {
          return fn.apply(context, args);
        }
      }, interval);
    }
    if (callNow) {
      callNow = false;
      return fn.apply(this, arguments);
    }
  };
}

var t  = function(str) {
  var resultConf = Gettext.dgettext('IcingTaskManager@json', str);
  if (resultConf != str) {
    return resultConf;
  }
  return Gettext.gettext(str);
};

// Native objects such as CinnamonApps and MetaWindows stringify with a unique identifier.
var isEqual = function(a, b) {
  if (!a) {
    a = 'null';
  }
  if (!b) {
    b = 'null';
  }
  return a.toString() === b.toString();
};

var each = function(obj, cb) {
  if (Array.isArray(obj)) {
    for (let i = 0, len = obj.length; i < len; i++) {
      let returnValue = cb(obj[i], i);
      if (returnValue === false) {
        return;
      } else if (returnValue === null) {
        break;
      } else if (returnValue === true) {
        continue;
      }
    }
  } else {
    for (let key in obj) {
      cb(obj[key], key);
    }
  }
};

var findIndex = function(arr, cb) {
  for (let i = 0, len = arr.length; i < len; i++) {
    if (cb(arr[i], i, arr)) {
      return i;
    }
  }
  return -1;
}

var find = function(arr, cb) {
  for (let i = 0, len = arr.length; i < len; i++) {
    if (cb(arr[i], i, arr)) {
      return arr[i];
    }
  }
  return null;
}

var filter = function (arr, cb) {
  let result = [];
  for (let i = 0, len = arr.length; i < len; i++) {
    if (cb(arr[i], i, arr)) {
      result.push(arr[i]);
    }
  }
  return result;
};

var map = function (arr, fn) {
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

var tryFn = function(fn, errCb) {
  try {
    return fn();
  } catch (e) {
    if (typeof errCb === 'function') {
      return errCb(e);
    }
  }
};

var unref = function(object) {
  // Some actors being destroyed have a cascading effect (e.g. PopupMenu items),
  // so it is safest to wait for the next 'tick' before removing references.
  setTimeout(() => {
    let keys = Object.keys(object);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] !== 'willUnmount') {
        object[keys[i]] = null;
      }
    }
  }, 0);
};

var getFocusState = function (metaWindow) {
  if (!metaWindow
    || metaWindow.minimized) {
    return false;
  }

  if (metaWindow.appears_focused) {
    return true;
  }

  let transientHasFocus = false;
  metaWindow.foreach_transient(function (transient) {
    if (transient && transient.appears_focused) {
      transientHasFocus = true;
      return false;
    }
    return true;
  });
  return transientHasFocus;
};