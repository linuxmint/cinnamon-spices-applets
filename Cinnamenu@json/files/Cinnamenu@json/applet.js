const Applet = imports.ui.applet;

// If this is true, it will force all modules to reload when an xlet is restarted.
window.__DEBUG = false;

function main(metadata, orientation, panel_height, instance_id) {
  global[metadata.uuid] = [metadata, orientation, panel_height, instance_id];

  const runtime = Function;
  const replace = String.prototype.replace;

  // folders bootstrap
  const ENTRY_FILE = './__applet.js';
  const CURRENT_DIR = metadata.path;
  const DIR_SEPARATOR = /\//.test(CURRENT_DIR) ? '/' : '\\';
  const PROGRAM_NAME = 'applet.js';
  const PROGRAM_DIR = CURRENT_DIR;

  window.ARGV = [metadata.path];

  // Check the env and load the applet if requireWithPath is available. This prevents us from reloading and overwriting
  // globals after an applet has already loaded Cinnode.
  if (typeof requireWithPath !== 'undefined') {
    let applet = requireWithPath(ENTRY_FILE, CURRENT_DIR);
    return applet;
  }

  // inject the cinnode folder to import at runtime internal helpers
  imports.searchPath.push([PROGRAM_DIR, 'cinnode_modules'].join(DIR_SEPARATOR));

  // populate the constants file
  Object.defineProperties(
    imports.cinnode.constants, {
      ENTRY_FILE: {
        enumerable: true,
        value: ENTRY_FILE
      },
      CURRENT_DIR: {
        enumerable: true,
        value: CURRENT_DIR
      },
      DEBUG: {
        enumerable: true,
        value: ARGV.some(arg => arg === '--debug')
      },
      DIR_SEPARATOR: {
        enumerable: true,
        value: DIR_SEPARATOR
      },
      PROGRAM_NAME: {
        enumerable: true,
        value: PROGRAM_NAME
      },
      PROGRAM_DIR: {
        enumerable: true,
        value: PROGRAM_DIR
      },
      TRANSFORM: {
        enumerable: true,
        value: typeof Symbol === 'undefined'
      }
    }
  );

  // module handler
  window.evaluateModule = function (sanitize, nmsp, unique, id, fd) {
    const
      dir = id.slice(0, -1 - fd.get_basename().length),
      exports = {},
      module = {
        exports: exports,
        id: id
      },
      content = (sanitize ? transform : String)(
        replace.call(fd.load_contents(null)[1], /^#![^\n\r]*/, '')
      );
    // sanitize && print(transform(content));
    nmsp[unique] = exports;
    runtime(
      'require',
      'exports',
      'module',
      '__dirname',
      '__filename',
      content
    ).call(
      exports,
      function require(module) {
        return requireWithPath(module, dir);
      },
      exports,
      module,
      dir,
      id
    );
    return (nmsp[unique] = module.exports);
  }

  // bring in polyfills and all modules loaders + process and timers
  window.polyfills = imports.cinnode.polyfills;
  const mainloop = imports.cinnode.mainloop;
  window.__gi = imports.cinnode.gi_modules.withRuntime();
  window.core = imports.cinnode.core_modules.withRuntime(evaluateModule);
  window.modules = imports.cinnode.node_modules.withRuntime(evaluateModule);
  window.Babel = imports.cinnode.babelMin.Babel;
  window.BabelOptions = {
    plugins: [
      'transform-decorators-legacy',
      'transform-class-properties',
      'transform-flow-strip-types',
      'transform-es2015-classes',
      'transform-es2015-literals',
      'transform-es2015-object-super',
      'transform-es2015-parameters',
      'transform-es2015-shorthand-properties',
      'transform-es2015-unicode-regex',
      'transform-exponentiation-operator',
      'transform-es2015-template-literals'
    ],
    moduleIds: true,
    compact: false
  };

  if (typeof window.Promise === 'undefined') {
    global.Promise = imports.cinnode.promise.ES6Promise.Promise;
    window.Promise = global.Promise;
  }

  global.GObjectProperties = imports.cinnode.extended.GObjectProperties;
  window.GObjectProperties = global.GObjectProperties;

  global.require = function require(module) {
    return requireWithPath(module, CURRENT_DIR);
  }
  window.require = global.require;

  global.loadedModules = [];
  global.redundantModules = 0;

  // the actual require
  window.requireWithPath = function (module, dir) {
    try {
      switch (true) {
      case core.has(module):
        return core.get(module);
      case __gi.has(module):
        return __gi.get(module);
      default:
        return modules.get(module) || modules.load(module, dir);
      }
    } catch (e) {
      if (!e.stack) {
        e.stack = '';
      }
      let moduleName = module.indexOf('/') !== -1 ? module.split('/')[1] : module;
      let stack = e.stack.split('\n');
      stack = [String(e)].concat(stack);
      for (let i = 0, len = stack.length; i < len; i++) {
        if (i === 0) {
          continue;
        }
        stack[i] = '    ' + stack[i].replace(/Function/g, moduleName).replace(/anonymous/g, '<anonymous>').replace(/@\//g, ' @ /');
      }
      e.stack = stack.join('\n');
      console.log(e.stack)
    }
  }

  // makes most ES6 compatible with GJS
  window.transform = function (code) {
    BabelOptions.filename = global.lastModule;
    let transpile = Babel.transform(code, BabelOptions);
    return transpile.code;
  }

  // initialize basic global modules
  ARGV.core = core;
  window.process = core.get('process');
  window.timers = core.get('timers');
  window.console = core.get('console');

  delete ARGV.core;
  window.clearInterval = global.clearInterval;
  window.clearTimeout = global.clearTimeout;
  window.setInterval = global.setInterval;
  window.setTimeout = global.setTimeout;

  /*
  The actual applet is required through the importer, processed by Babel, and returned here.

  In the applet's main JS file (i.e. __applet.js), the main function should look like this:

  let [metadata, orientation, panel_height, instance_id] =  global['applet@author'];

  module.exports = (function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
  })(metadata, orientation, panel_height, instance_id)
  */
  let applet = requireWithPath(ENTRY_FILE, CURRENT_DIR);
  return applet;
}