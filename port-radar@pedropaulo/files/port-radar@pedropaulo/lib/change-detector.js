const Model = typeof require === "function"
    ? require("./lib/socket-model")
    : imports["socket-model"];

// A different output order should not look like a change of process.
function ownershipSignature(records) {
    return records.map(function (record) {
        return record.processes.map(function (process) {
            return process.name + ":" + (process.pid === null ? "?" : process.pid);
        }).sort().join(",");
    }).sort().join("|");
}

function groupBy(records, keyFunction) {
    let groups = {};
    records.forEach(function (record) {
        let key = keyFunction(record);
        if (!groups[key])
            groups[key] = [];
        groups[key].push(record);
    });
    return groups;
}

function compareSnapshots(previous, current) {
    let oldEndpoints = groupBy(previous || [], Model.socketEndpointKey);
    let newEndpoints = groupBy(current || [], Model.socketEndpointKey);
    let changes = [];

    Object.keys(newEndpoints).forEach(function (key) {
        if (!oldEndpoints[key]) {
            changes.push({ type: "opened", record: newEndpoints[key][0], key: key });
        } else if (ownershipSignature(oldEndpoints[key]) !== ownershipSignature(newEndpoints[key])) {
            changes.push({ type: "ownership-changed", record: newEndpoints[key][0], previous: oldEndpoints[key][0], key: key });
        }
    });

    Object.keys(oldEndpoints).forEach(function (key) {
        if (!newEndpoints[key])
            changes.push({ type: "closed", record: oldEndpoints[key][0], key: key });
    });

    // Infer an address move only for a single binding with the same known owner.
    // Missing owners or replacements must keep their separate open/close events.
    let bindingKey = function (record) {
        return [record.protocol, record.family, record.port].join("|");
    };
    let oldBindings = groupBy(previous || [], bindingKey);
    let newBindings = groupBy(current || [], bindingKey);
    Object.keys(oldBindings).forEach(function (key) {
        if (oldBindings[key].length !== 1 || !newBindings[key] || newBindings[key].length !== 1)
            return;
        let before = oldBindings[key][0];
        let after = newBindings[key][0];
        if (before.address !== after.address && before.processes.length > 0 &&
            ownershipSignature([before]) === ownershipSignature([after])) {
            changes = changes.filter(function (change) {
                return change.key !== Model.socketEndpointKey(before) && change.key !== Model.socketEndpointKey(after);
            });
            changes.push({ type: "binding-changed", record: after, previous: before, key: Model.socketEndpointKey(after) });
        }
    });
    return changes;
}

var ChangeDetector = {
    compareSnapshots: compareSnapshots
};
