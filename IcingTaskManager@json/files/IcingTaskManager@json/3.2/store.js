
function queryCollection(collection, query, options = {
  indexOnly: false,
  filter: false,
  findElementInArray: false
}) {
  let queryKeys = Object.keys(query);
  let filterResult = [];
  for (let i = 0; i < collection.length; i++) {
    let matches = 0;
    for (let z = 0; z < queryKeys.length; z++) {
      let argument;
      if (options.findElementInArray && Array.isArray(collection[i][queryKeys[z]])) {
        argument = collection[i][queryKeys[z]].indexOf(query[queryKeys[z]]) > -1;
      } else {
        argument = collection[i][queryKeys[z]] === query[queryKeys[z]];
      }
      if (argument) {
          if (options.filter) {
            filterResult.push(collection[i]);
          } else {
            matches += 1;
          }
      }
    }
    if (!options.filter && matches === queryKeys.length) {
      return options.indexOnly ? i : collection[i];
    }
  }
  if (options.filter) {
    return filterResult;
  }
  return options.indexOnly ? -1 : null;
}

function intersect(array1, array2, difference = false) {
  let result = [];
  for (let i = 0; i < array1.length; i++) {
    if ((!difference && array2.indexOf(array1[i]) > -1)
      || (difference && array2.indexOf(array1[i]) === -1)) {
      result.push(array1[i]);
    }
  }
  return result;
}

function clone(object, refs = [], cache = null) {
  if (!cache) {
    cache = object;
  }
  let copy;

  if (!object
    || typeof object !== 'object'
    || object.prototype
    || object.toString().indexOf('[0x') > -1) {
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
    for (let i = 0; i < object.length; i++) {
      if (refs.indexOf(object[i]) >= 0) { // circular
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

  let keys = Object.keys(object);
  for (let i = 0; i < keys.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(object, keys[i])) {
      continue;
    }
    if (refs.indexOf(object[keys[i]]) >= 0) {
      return null;
    }
    copy[keys[i]] = clone(object[keys[i]], refs, cache);
  }

  refs.pop();
  return copy;
}

function storeError(method, key, message) {
  return new Error('[store -> '  + method + ' -> ' + key + '] ' + message);
}

function getByPath(key, state) {
  const path = key.split('.');
  let object = clone(state);
  for (let i = 0; i < path.length; i++) {
    object = object[path[i]];
    if (!object) {
      return object;
    }
  }
  return object;
}

function init(state = {}, listeners = []) {
  const publicAPI = Object.freeze({
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
    let keys = Object.keys(object);

    for (let i = 0; i < listeners.length; i++) {
      let commonKeys = intersect(keys, listeners[i].keys);
      if (commonKeys.length === 0) {
        continue;
      }
      if (listeners[i].callback) {
        listeners[i].callback(commonKeys);
      }
    }
  }

  function get(key = null) {
    if (!key || key === '*') {
      return state;
    }
    if (key.indexOf('.') > -1) {
      return getByPath(key, state);
    }
    return clone(state[key]);
  }

  function set(object) {
    let keys = Object.keys(object);
    for (let i = 0; i < keys.length; i++) {
      state[keys[i]] = object[keys[i]];
    }

    if (listeners.length > 0) {
      dispatch(object);
    }
  }

  function exclude(excludeKeys) {
    let object = {};
    let keys = Object.keys(state);
    for (let i = 0; i < keys.length; i++) {
      if (excludeKeys.indexOf(keys[i]) === -1) {
        object[keys[i]] = state[keys[i]];
      }
    }

    return getAPIWithObject(object);
  }

  function trigger() {
    const [key, ...args] = Array.from(arguments);
    let matchedListeners = queryCollection(listeners, {keys: key}, {
      findElementInArray: true,
      filter: true
    });
    for (let i = 0; i < matchedListeners.length; i++) {
      if (matchedListeners[i].callback) {
        return matchedListeners[i].callback(...args);
      }
    }
  }

  function _connect(keys, callback) {
    let listener;

    if (callback) {
      listener = queryCollection(listeners, {callback: callback});
    }
    if (listener) {
      let newKeys = intersect(keys, listener.keys, true);
      listener.keys.concat(newKeys);
    } else {
      listeners.push({keys: keys, callback: callback});
    }
  }

  function connect(actions, callback) {
    if (Array.isArray(actions) || typeof actions === 'string') {
      _connect(actions, callback);
    } else if (typeof actions === 'object') {
      let keys = Object.keys(actions);
      for (let i = 0; i < keys.length; i++) {
        _connect(keys[i], actions[keys[i]]);
      }
    }

    return publicAPI;
  }

  function disconnect(key) {
    let listenerIndex = queryCollection(listeners, {keys: key}, {
      findElementInArray: true,
      indexOnly: true
    });
    if (listenerIndex === -1) {
      throw storeError('disconnect', key, 'Invalid disconnect key.');
    }
    listeners[listenerIndex] = undefined;
    listeners.splice(listenerIndex, 1);
  }

  function destroy() {
    let keys = Object.keys(state);
    for (let i = 0; i < keys.length; i++) {
      state[keys[i]] = undefined;
    }
    for (let i = 0; i < listeners.length; i++) {
      listeners[i] = undefined;
    }
  }

  return getAPIWithObject(state);
}

