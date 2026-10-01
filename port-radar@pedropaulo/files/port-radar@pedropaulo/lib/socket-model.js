const UNKNOWN_PROCESS = "Unknown process";

function socketIdentity(record) {
    let processPart = record.processes.map(function (process) {
        return process.pid === null ? process.name : process.name + ":" + process.pid;
    }).join(",");
    return [record.protocol, record.family, record.address, record.port, processPart].join("|");
}

// Leave process details out so we can detect a new owner at the same endpoint.
function socketEndpointKey(record) {
    return [record.protocol, record.family, record.address, record.port].join("|");
}

function createSocketRecord(values) {
    // Sort a copy so comparisons stay stable without changing the parser input.
    let processes = (values.processes || []).slice().sort(function (a, b) {
        return a.name.localeCompare(b.name) || (a.pid || 0) - (b.pid || 0);
    });
    let processName = processes.length > 0 ? processes.map(function (process) {
        return process.name;
    }).join(", ") : UNKNOWN_PROCESS;
    let pid = processes.length > 0 ? processes[0].pid : null;
    let record = {
        protocol: values.protocol,
        family: values.family,
        address: values.address,
        port: values.port,
        processName: processName,
        pid: pid,
        processes: processes,
        displayProcess: processName
    };
    record.identity = socketIdentity(record);
    record.endpointKey = socketEndpointKey(record);
    return record;
}

var SocketModel = {
    UNKNOWN_PROCESS: UNKNOWN_PROCESS,
    createSocketRecord: createSocketRecord,
    socketIdentity: socketIdentity,
    socketEndpointKey: socketEndpointKey
};
