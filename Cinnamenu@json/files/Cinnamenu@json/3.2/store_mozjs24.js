'use strict';

if (!Array.from) {
  Array.from = (function () {
    var toStr = Object.prototype.toString;
    var isCallable = function (fn) {
      return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
    };
    var toInteger = function (value) {
      var number = Number(value);
      if (isNaN(number)) { return 0; }
      if (number === 0 || !isFinite(number)) { return number; }
      return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
    };
    var maxSafeInteger = Math.pow(2, 53) - 1;
    var toLength = function (value) {
      var len = toInteger(value);
      return Math.min(Math.max(len, 0), maxSafeInteger);
    };

    // The length property of the from method is 1.
    return function from(arrayLike/*, mapFn, thisArg */) {
      // 1. Let C be the this value.
      var C = this;

      // 2. Let items be ToObject(arrayLike).
      var items = Object(arrayLike);

      // 3. ReturnIfAbrupt(items).
      if (arrayLike == null) {
        throw new TypeError('Array.from requires an array-like object - not null or undefined');
      }

      // 4. If mapfn is undefined, then let mapping be false.
      var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
      var T;
      if (typeof mapFn !== 'undefined') {
        // 5. else
        // 5. a If IsCallable(mapfn) is false, throw a TypeError exception.
        if (!isCallable(mapFn)) {
          throw new TypeError('Array.from: when provided, the second argument must be a function');
        }

        // 5. b. If thisArg was supplied, let T be thisArg; else let T be undefined.
        if (arguments.length > 2) {
          T = arguments[2];
        }
      }

      // 10. Let lenValue be Get(items, "length").
      // 11. Let len be ToLength(lenValue).
      var len = toLength(items.length);

      // 13. If IsConstructor(C) is true, then
      // 13. a. Let A be the result of calling the [[Construct]] internal method
      // of C with an argument list containing the single item len.
      // 14. a. Else, Let A be ArrayCreate(len).
      var A = isCallable(C) ? Object(new C(len)) : new Array(len);

      // 16. Let k be 0.
      var k = 0;
      // 17. Repeat, while k < len (also steps a - h)
      var kValue;
      while (k < len) {
        kValue = items[k];
        if (mapFn) {
          A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
        } else {
          A[k] = kValue;
        }
        k += 1;
      }
      // 18. Let putStatus be Put(A, "length", len, true).
      A.length = len;
      // 20. Return A.
      return A;
    };
  }());
}

// Must be writable: true, enumerable: false, configurable: true
if (typeof Object.assign != 'function') {
  // Must be writable: true, enumerable: false, configurable: true
  Object.defineProperty(Object, 'assign', {
    value: function assign(target, varArgs) { // .length of function is 2
      'use strict';
      if (target == null) { // TypeError if undefined or null
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var to = Object(target);

      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];

        if (nextSource != null) { // Skip over if undefined or null
          for (var nextKey in nextSource) {
            // Avoid bugs when hasOwnProperty is shadowed
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    },
    writable: true,
    configurable: true
  });
}

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

function queryCollection() {
  var collection = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  var query = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
    indexOnly: false,
    filter: false,
    findElementInArray: false
  };

  var queryKeys = (typeof query === 'undefined' ? 'undefined' : _typeof(query)) === 'object' ? Object.keys(query) : null;
  var filterResult = [];

  function handleMatch(argument, i, matches) {
    if (argument) {
      if (options.filter) {
        filterResult.push(collection[i]);
      } else {
        matches += 1;
      }
    }
    return matches;
  }

  for (var i = 0; i < collection.length; i++) {
    var matches = 0;
    if (!queryKeys) {
      matches = handleMatch(query(collection[i]), i, matches);
    } else {
      for (var z = 0; z < queryKeys.length; z++) {
        var argument = void 0;
        if (options.findElementInArray && Array.isArray(collection[i][queryKeys[z]])) {
          argument = collection[i][queryKeys[z]].indexOf(query[queryKeys[z]]) > -1;
        } else {
          argument = collection[i][queryKeys[z]] === query[queryKeys[z]];
        }
        matches = handleMatch(argument, i, matches);
      }
    }
    if (!options.filter && (queryKeys && matches === queryKeys.length || matches > 0 && !queryKeys)) {
      return options.indexOnly ? i : collection[i];
    }
  }
  if (options.filter) {
    return filterResult;
  }
  return options.indexOnly ? -1 : null;
}

function intersect(array1, array2) {
  var difference = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  var result = [];
  for (var i = 0; i < array1.length; i++) {
    if (!difference && array2.indexOf(array1[i]) > -1 || difference && array2.indexOf(array1[i]) === -1) {
      result.push(array1[i]);
    }
  }
  return result;
}

function clone(object) {
  var refs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  var cache = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

  if (!cache) {
    cache = object;
  }
  var copy = void 0;

  if (!object || (typeof object === 'undefined' ? 'undefined' : _typeof(object)) !== 'object' || object.prototype || object.toString().indexOf('[0x') > -1) {
    return object;
  }

  if (object instanceof Date) {
    copy = new Date();
    copy.setTime(object.getTime());
    return copy;
  }

  if (Array.isArray(object) || object instanceof Array) {
    refs.push(object);
    copy = [];
    for (var i = 0; i < object.length; i++) {
      if (refs.indexOf(object[i]) >= 0) {
        // circular
        return null;
      }
      copy[i] = clone(object[i], refs, cache);
    }

    refs.pop();
    return copy;
  }

  refs.push(object);
  copy = {};

  if (object instanceof Error) {
    copy.name = object.name;
    copy.message = object.message;
    copy.stack = object.stack;
  }

  var keys = Object.keys(object);
  for (var _i = 0; _i < keys.length; _i++) {
    if (!Object.prototype.hasOwnProperty.call(object, keys[_i])) {
      continue;
    }
    if (refs.indexOf(object[keys[_i]]) >= 0) {
      return null;
    }
    copy[keys[_i]] = clone(object[keys[_i]], refs, cache);
  }

  refs.pop();
  return copy;
}

function storeError(method, key, message) {
  return new Error('[store -> ' + method + ' -> ' + key + '] ' + message);
}

function getByPath(key, state) {
  var path = key.split('.');
  var object = clone(state);
  for (var i = 0; i < path.length; i++) {
    object = object[path[i]];
    if (!object) {
      return object;
    }
  }
  return object;
}

function init() {
  var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var listeners = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  var connections = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

  var publicAPI = Object.freeze({
    get: get,
    set: set,
    exclude: exclude,
    trigger: trigger,
    connect: connect,
    disconnect: disconnect,
    destroy: destroy
  });

  function getAPIWithObject(object) {
    return Object.assign(object, publicAPI);
  }

  function dispatch(object) {
    var keys = Object.keys(object);

    for (var i = 0; i < listeners.length; i++) {
      var commonKeys = intersect(keys, listeners[i].keys);
      if (commonKeys.length === 0) {
        continue;
      }
      if (listeners[i].callback) {
        var partialState = {};
        for (var z = 0; z < listeners[i].keys.length; z++) {
          partialState[listeners[i].keys[z]] = state[listeners[i].keys[z]];
        }
        listeners[i].callback(partialState);
      }
    }
  }

  function get() {
    var key = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

    if (!key || key === '*') {
      return state;
    }
    if (key.indexOf('.') > -1) {
      return getByPath(key, state);
    }
    return clone(state[key]);
  }

  function set(object, forceDispatch) {
    var keys = Object.keys(object);
    var changed = false;
    for (var i = 0; i < keys.length; i++) {
      if (typeof state[keys[i]] === 'undefined') {
        throw storeError('set', keys[i], 'Property not found.');
      }
      if (state[keys[i]] !== object[keys[i]]) {
        changed = true;
        state[keys[i]] = object[keys[i]];
      }
    }

    if ((changed || forceDispatch) && listeners.length > 0) {
      dispatch(object);
    }

    return publicAPI;
  }

  function exclude(excludeKeys) {
    var object = {};
    var keys = Object.keys(state);
    for (var i = 0; i < keys.length; i++) {
      if (excludeKeys.indexOf(keys[i]) === -1) {
        object[keys[i]] = state[keys[i]];
      }
    }

    return getAPIWithObject(object);
  }

  function trigger() {
    var _Array$from = Array.from(arguments),
        _Array$from2 = _toArray(_Array$from),
        key = _Array$from2[0],
        args = _Array$from2.slice(1);

    var matchedListeners = queryCollection(listeners, { keys: key }, {
      findElementInArray: true,
      filter: true
    });
    if (matchedListeners.length === 0) {
      throw storeError('trigger', key, 'Action not found.');
    }
    for (var i = 0; i < matchedListeners.length; i++) {
      if (matchedListeners[i].callback) {
        var _matchedListeners$i;

        var output = (_matchedListeners$i = matchedListeners[i]).callback.apply(_matchedListeners$i, _toConsumableArray(args));
        if (output !== undefined) {
          return output;
        }
      }
    }
  }

  function _connect(keys, callback, id) {
    var listener = void 0;

    if (callback) {
      listener = queryCollection(listeners, { callback: callback });
    }
    if (listener) {
      var newKeys = intersect(keys, listener.keys, true);
      listener.keys.concat(newKeys);
    } else {
      listeners.push({ keys: keys, callback: callback, id: id });
    }
  }

  function connect(actions, callback) {
    var id = connections++;
    if (Array.isArray(actions)) {
      _connect(actions, callback, id);
    } else if (typeof actions === 'string') {
      _connect([actions], callback, id);
    } else if ((typeof actions === 'undefined' ? 'undefined' : _typeof(actions)) === 'object') {
      var keys = Object.keys(actions);
      for (var i = 0; i < keys.length; i++) {
        _connect([keys[i]], actions[keys[i]], id);
      }
    }

    return id;
  }

  function disconnectByKey(key) {
    var listenerIndex = queryCollection(listeners, { keys: key }, {
      findElementInArray: true,
      indexOnly: true
    });
    if (listenerIndex === -1) {
      throw storeError('disconnect', key, 'Invalid disconnect key.');
    }
    listeners[listenerIndex] = undefined;
    listeners.splice(listenerIndex, 1);
  }

  function disconnect(key) {
    if (typeof key === 'string') {
      disconnectByKey(key);
    } else if (Array.isArray(key)) {
      for (var i = 0; i < key.length; i++) {
        disconnectByKey(key[i]);
      }
    } else if (typeof key === 'number') {
      var indexes = [];
      for (var _i2 = 0; _i2 < listeners.length; _i2++) {
        if (!listeners[_i2] || listeners[_i2].id !== key) {
          continue;
        }
        indexes.push(_i2);
      }
      for (var _i3 = 0; _i3 < indexes.length; _i3++) {
        listeners[indexes[_i3]] = undefined;
        listeners.splice(indexes[_i3], 1);
      }
    }
  }

  function destroy() {
    var keys = Object.keys(state);
    for (var i = 0; i < keys.length; i++) {
      state[keys[i]] = undefined;
    }
    for (var _i4 = 0; _i4 < listeners.length; _i4++) {
      listeners[_i4] = undefined;
    }
  }

  return getAPIWithObject(state);
}