const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const {write_string_to_stream} = imports.gi.Cinnamon
const {listDirAsync} = imports.misc.fileUtils;
const {find, tryFn} = imports.misc.util;
const Mainloop = imports.mainloop;

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

const setSchema = function(path, cb) {
  let schema, shouldReturn;
  let knownProviders = [];
  let enabledProviders = global.settings.get_strv('enabled-search-providers');
  let schemaFile = Gio.File.new_for_path(path + '/' + 'settings-schema.json');
  let backupSchemaFile = Gio.File.new_for_path(path + '/' + 'settings-schema-backup.json');
  let next = () => cb(knownProviders, enabledProviders);
  let [success, json] = schemaFile.load_contents(null);
  if (!success) return next();

  tryFn(function() {
    schema = JSON.parse(json);
  }, () => {
    shouldReturn = true;
  });
  if (shouldReturn) {
    return next();
  }
  // Back up the schema file if it doesn't have any modifications generated from this function.
  if (schema.layout.extensionProvidersSection.title !== 'Extensions') {
    success = schemaFile.copy(backupSchemaFile, Gio.FileCopyFlags.OVERWRITE, null, null)
    if (!success) return next();
  }
  let getMetaData = (dir, file, name) => {
    if (name.indexOf('@') === -1) {
      return null;
    }
    let fd = Gio.File.new_for_path(dir.get_path() + '/' + name + '/metadata.json');
    if (!fd.query_exists(null)) {
      return null;
    }
    let [success, json] = fd.load_contents(null);
    if (!success) {
      return null;
    }

    tryFn(function() {
      file = JSON.parse(json);
    }, function() {
      shouldReturn = true;
    });
    if (shouldReturn) {
      return null;
    }

    return file;
  };
  let buildSettings = (fds) => {
    // Build the schema file with the available search provider UUIDs.
    schema.layout.extensionProvidersSection.keys = [];
    let changed = false;
    for (let z = 0; z < fds.length; z++) {
      let [dir, files] = fds[z];
      for (let i = 0; i < files.length; i++) {
        let name = files[i].get_name();
        if (name.indexOf('@') === -1) {
          continue;
        }
        files[i] = getMetaData(dir, files[i], name);
        if (!files[i]) {
          continue;
        }
        changed = true;
        knownProviders.push(name);
        schema.layout.extensionProvidersSection.keys.push(files[i].uuid);
        schema[files[i].uuid] = {
          type: 'checkbox',
          default: false,
          description: files[i].name,
          tooltip: files[i].description,
          dependency: 'enable-search-providers'
        }
      }
    }

    // Write to file if there is a change in providers
    if (!changed || knownProviders.length === 0) {
      return next();
    }
    // The default title for the extensions section tells the user no extensions are found.
    schema.layout.extensionProvidersSection.title = 'Extensions';
    tryFn(function() {
      json = JSON.stringify(schema);
      let raw = schemaFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
      let out = Gio.BufferedOutputStream.new_sized(raw, 4096);
      write_string_to_stream(out, json);
      out.close(null);
    }, () => {
      shouldReturn = true;
    });
    if (shouldReturn) {
      // Restore from the backup schema if it exists
      if (backupSchemaFile.query_exists(null)) {
        backupSchemaFile.copy(schemaFile, Gio.FileCopyFlags.OVERWRITE, null, null)
      }
      return next();
    }
    next();
  };
  let providerFiles = [];
  let dataDir = Gio.File.new_for_path(global.datadir + '/search_providers');
  let userDataDir = Gio.File.new_for_path(global.userdatadir + '/search_providers');
  if (dataDir.query_exists(null)) {
    listDirAsync(dataDir, (files) => {
      providerFiles = providerFiles.concat([[dataDir, files]]);
      if (userDataDir.query_exists(null)) {
        listDirAsync(userDataDir, (files) => {
          providerFiles = providerFiles.concat([[userDataDir, files]]);
          buildSettings(providerFiles);
        });
      } else {
        buildSettings(providerFiles);
      }
    });
  } else if (userDataDir.query_exists(null)) {
    listDirAsync(userDataDir, (files) => {
      buildSettings([[userDataDir, files]]);
    });
  } else {
    if (backupSchemaFile.query_exists(null)) {
      backupSchemaFile.copy(schemaFile, Gio.FileCopyFlags.OVERWRITE, null, null)
    }
    next();
  }
};