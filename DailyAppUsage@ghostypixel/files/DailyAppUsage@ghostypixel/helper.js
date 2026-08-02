/**
 * Recursively prints the name and type of every actor in a Cinnamon UI tree.
 * @param {Clutter.Actor} actor - The root actor to start from.
 * @param {number} [depth=0] - Current recursion depth (used for indentation).
 */
function printTree(root) {
    if (!root) return;
    const lines = [];

    function walk(obj, indent = "") {
        const ctor = obj.constructor?.name ?? "<unknown>";
        const children = typeof obj.get_children === "function"
            ? obj.get_children()
            : [];

        lines.push(`${indent}|- ${ctor} (${children.length})`);

        for (const child of children) walk(child, indent + "|  ");
    }

    walk(root);

    global.log("\n" + lines.join("\n"));
}

function toCSV(table) {
    const lines = [
        table.columns.join(","),
        ...table.rows.map(row => row.join(","))
    ];

    return lines.join("\n");
}

function truncate(str, maxLength) {
    if(str.length <= maxLength) return str;
    return str.slice(0, maxLength) + "...";
}

function debugActorTree(actor, indent = "") {
    const name = actor.name || actor.constructor?.name || actor.toString();

    const width = actor.width;
    const height = actor.height;

    global.log(`${indent}${name} (${width}×${height})`);

    if(actor.get_children) {
        for(const child of actor.get_children()) debugActorTree(child, indent + "  ");
    }
}

function connectOnce(obj, signal, callback) {
    let id = obj.connect(signal, (...args) => {
        obj.disconnect(id);
        callback(...args);
    });

    return id;
}

/**
 * returns the numer of minutes as miliseconds
 * @param {int} intMinutes - minutes as int
 * @returns {int} miliseconds
 */
function MinutesToMs(intMinutes) { return 1000 * 60 * intMinutes }

var IsPath = str => str.startsWith("/");
var SetToStr = set => [...set].join(" | ")