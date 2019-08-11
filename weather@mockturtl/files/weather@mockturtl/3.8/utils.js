var Mainloop = imports.mainloop;
var setTimeout = function (func, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    let id = Mainloop.timeout_add(ms, () => {
        func.apply(null, args);
        return false;
    }, null);
    return id;
};
const clearTimeout = function (id) {
    Mainloop.source_remove(id);
};
const setInterval = function (func, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    let id = Mainloop.timeout_add(ms, () => {
        func.apply(null, args);
        return true;
    }, null);
    return id;
};
const clearInterval = function (id) {
    Mainloop.source_remove(id);
};
var tzSupported = function () {
    var date = new Date();
    try {
        date.toLocaleString('en-GB', { timeZone: 'Europe/London' });
        return true;
    }
    catch (e) {
        return false;
    }
};
