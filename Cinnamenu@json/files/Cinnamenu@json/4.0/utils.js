const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const {listDirAsync} = imports.misc.fileUtils;
const {each} = imports.misc.util;

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

// Recursive each wrapper, for asynchronous iteration
const rEach = (array, cb, finishCb, i = -1) => {
  i++;
  if (array[i] === undefined) {
    if (typeof finishCb === 'function') finishCb();
    return;
  }
  let next = () => rEach(array, cb, finishCb, i);
  cb(array[i], i, next);
}

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

const sortDirs = function(dirs) {
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

const writeFileAsync = function(file, data) {
  return new Promise(function(resolve,  reject) {
    if (typeof file === 'string' || file instanceof String) {
      file = Gio.File.new_for_path(file);
    }

    let write = (stream) => {
      stream.truncate(0, null);
      stream.output_stream.write_bytes_async(ByteArray.fromString(String(data)), 0, null, (source, result) => {
        source.write_bytes_finish(result);
        source.flush_async(0, null, (source, result) => {
          source.flush_finish(result);
          source.close_async(0, null, (source, result) => {
            resolve(!source.close_finish(result));
          });
        });
      });
    };

    file.create_readwrite_async(Gio.FileCreateFlags.REPLACE_DESTINATION, 0, null, (source, result) => {
      tryFn(function() {
          write(source.create_readwrite_finish(result));
      }, function(e) {
        tryFn(function() {
          file.open_readwrite_async(0, null, (source, result) => {
            write(source.open_readwrite_finish(result));
          });
        }, function(e) {
          reject(e);
        });
      });
    });
  });
}

const readJSONAsync = function(file) {
  return readFileAsync(file).then(function(json) {
    return JSON.parse(json);
  })
};

const copyFileAsync = function(file, destinationFile, userData) {
  return new Promise(function(resolve, reject) {
    file.copy_async(
      destinationFile, // destination
      Gio.FileCopyFlags.OVERWRITE, // set of Gio.FileCopyFlags
      0, // IO priority
      null, // Gio.Cancellable
      null, // progress callback
      function(localFile, taskJob) {
        tryFn(function() {
          if (!file.copy_finish(taskJob)) return reject(new Error('File cannot be copied.'));
          resolve(userData);
        }, (e) => reject(e));
      }
    );
  });
}

const buildSettings = function(fds, knownProviders, schema, schemaFile, backupSchemaFile, next) {
  // Build the schema file with the available search provider UUIDs.
  schema.layout.extensionProvidersSection.keys = [];
  let changed = false;

  let finish = function() {
    // Write to file if there is a change in providers
    if (!changed || knownProviders.length === 0) {
      return next();
    }

    // The default title for the extensions section tells the user no extensions are found.
    schema.layout.extensionProvidersSection.title = 'Extensions';
    let json = JSON.stringify(schema);
    writeFileAsync(schemaFile, json).then(next).catch(function() {
      // Restore from the backup schema if it exists
      copyFileAsync(backupSchemaFile, schemaFile).then(next);
    });
  }

  rEach(fds, function(fd, i, nextIter) {
    let [dir, files] = fd;
    rEach(files, function(file, f, nextIter2) {
      let name = file.get_name();
      if (name.indexOf('@') === -1) return nextIter2();
      readJSONAsync(`${dir.get_path()}/${name}/metadata.json`).then(function(json) {
        changed = true;
        knownProviders.push(name);
        schema.layout.extensionProvidersSection.keys.push(json.uuid);
        schema[json.uuid] = {
          type: 'checkbox',
          default: false,
          description: json.name,
          tooltip: json.description,
          dependency: 'enable-search-providers'
        }
        nextIter2();
      }).catch(nextIter2);
    }, nextIter)
  }, finish);
};

const setSchema = function(path, categoryButtons, startupCategory, cb) {
  let schemaFile = Gio.File.new_for_path(path + '/settings-schema.json');
  let backupSchemaFile = Gio.File.new_for_path(path + '/settings-schema-backup.json');
  let startupCategoryValid = false;
  let knownProviders = [];
  let next = () => cb(knownProviders, startupCategoryValid);

  readJSONAsync(schemaFile).then(function(schema) {
    each(categoryButtons, function(category) {
      schema.startupCategory.options[category.categoryNameText] = category.id;
      if (category.id === startupCategory) startupCategoryValid = true;
    });

    // Back up the schema file if it doesn't exist.
    if (!backupSchemaFile.query_exists(null)) {
      return copyFileAsync(schemaFile, backupSchemaFile, schema);
    }
    return Promise.resolve(schema);
  }).then(function(schema) {
    let providerFiles = [];
    let dataDir = Gio.File.new_for_path(global.datadir + '/search_providers');
    let userDataDir = Gio.File.new_for_path(global.userdatadir + '/search_providers');
    if (dataDir.query_exists(null)) {
      listDirAsync(dataDir, (files) => {
        providerFiles = providerFiles.concat([[dataDir, files]]);
        if (userDataDir.query_exists(null)) {
          listDirAsync(userDataDir, (files) => {
            providerFiles = providerFiles.concat([[userDataDir, files]]);
            buildSettings(providerFiles, knownProviders, schema, schemaFile, backupSchemaFile, next);
          });
        } else {
          buildSettings(providerFiles, knownProviders, schema, schemaFile, backupSchemaFile, next);
        }
      });
    } else if (userDataDir.query_exists(null)) {
      listDirAsync(userDataDir, (files) => {
        buildSettings([[userDataDir, files]], knownProviders, schema, schemaFile, backupSchemaFile, next);
      });
    } else {
      next();
    }
  }).catch(function(e) {
    global.log(e);
    copyFileAsync(backupSchemaFile, schemaFile).then(next);
  });
};

module.exports = {tryFn, sortBy, sortDirs, readFileAsync, readJSONAsync, writeFileAsync, copyFileAsync, buildSettings, setSchema};
