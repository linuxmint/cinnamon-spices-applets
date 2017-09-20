const Mainloop = imports.mainloop;

const setTimeout = function(func, ms /* , ... args */) {
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

const setInterval = function(func, ms /* , ... args */) {
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

function defer(func) {
  return new Proxy(func, {
    apply: function(target, boundObject, argumentsList) {
      Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, function() {
        target.apply(boundObject, argumentsList);
      });
      return true;
    }
  });
}