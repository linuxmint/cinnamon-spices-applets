const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;

// Work around Cinnamon#8201
const tryFn = function(callback, errCallback) {
    try {
        return callback();
    } catch (e) {
        if (typeof errCallback === 'function') {
            return errCallback(e);
        }
    }
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
};

const readFileAsync = function(file, opts = {utf8: true}) {
  const {utf8} = opts;
  return new Promise(function(resolve, reject) {
    if (typeof file === 'string' || file instanceof String) {
      file = Gio.File.new_for_path(file);
    }
    if (!file.query_exists(null)) reject(new Error('File does not exist.'));
    file.load_contents_async(null, function(object, result) {
      tryFn(() => {
        let [success, data] = file.load_contents_finish(result);
        if (!success) return reject(new Error('File cannot be read.'));
        if (utf8) {
          if (data instanceof Uint8Array) data = ByteArray.toString(data);
          else data = data.toString();
        }
        resolve(data);
      }, (e) => reject(e));
    });
  });
};

const readJSONAsync = function(file) {
  return readFileAsync(file).then(function(json) {
    return JSON.parse(json);
  });
};


module.exports = {tryFn, sortBy, readFileAsync, readJSONAsync};
