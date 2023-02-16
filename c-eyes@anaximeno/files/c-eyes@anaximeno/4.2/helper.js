const GLib = imports.gi.GLib;

function debounce(fn, timeout, options = {priority: GLib.PRIORITY_DEFAULT}) {
    let sourceId = null;

    return function (...args) {
        const debouncedFunc = () => {
            sourceId = null;
            fn.apply(this, args);
        };

        if (sourceId) {
            GLib.Source.remove(sourceId);
        }

        sourceId = GLib.timeout_add(options.priority, timeout, debouncedFunc);
    }
}