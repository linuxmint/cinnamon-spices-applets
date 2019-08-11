var Mainloop = imports.mainloop;
var setTimeout = function (func, ms) {
    var args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    var id = Mainloop.timeout_add(ms, function () {
        func.apply(null, args);
        return false;
    }, null);
    return id;
};
var clearTimeout = function (id) {
    Mainloop.source_remove(id);
};
var setInterval = function (func, ms) {
    var args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    var id = Mainloop.timeout_add(ms, function () {
        func.apply(null, args);
        return true;
    }, null);
    return id;
};
var clearInterval = function (id) {
    Mainloop.source_remove(id);
};
