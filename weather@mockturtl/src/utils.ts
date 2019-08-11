var Mainloop = imports.mainloop;

var setTimeout = function(func: any, ms: number) {
  let args: any[] = [];
  if (arguments.length > 2) {
    args = args.slice.call(arguments, 2);
  }

  let id = Mainloop.timeout_add(ms, () => {
    func.apply(null, args);
    return false; // Stop repeating
  }, null);

  return id;
};

const clearTimeout = function(id: any) {
  Mainloop.source_remove(id);
};

const setInterval = function(func: any, ms: number) {
  let args: any[] = [];
  if (arguments.length > 2) {
    args = args.slice.call(arguments, 2);
  }

  let id = Mainloop.timeout_add(ms, () => {
    func.apply(null, args);
    return true; // Repeat
  }, null);

  return id;
};

const clearInterval = function(id: any) {
  Mainloop.source_remove(id);
};