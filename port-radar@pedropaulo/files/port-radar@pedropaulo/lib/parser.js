const Model = typeof require === "function"
    ? require("./lib/socket-model")
    : imports["socket-model"];

function parseEndpoint(value) {
    if (!value)
        return null;

    let separator = value.lastIndexOf(":");
    if (separator < 0)
        return null;
    // Keep the interface suffix when ss prints an address such as [fe80::1]%eth0.
    let address = value.substring(0, separator).replace(/^\[([^\]]+)\](.*)$/, "$1$2");
    let portText = value.substring(separator + 1);
    if (!/^\d+$/.test(portText))
        return null;

    let port = Number(portText);
    if (!address || !Number.isInteger(port) || port < 0 || port > 65535)
        return null;
    return { address: address, port: port };
}

function parseProcesses(value) {
    let processes = [];
    if (!value)
        return processes;
    let processPattern = /\("([^"]+)",pid=(\d+)/g;
    let match;
    while ((match = processPattern.exec(value)) !== null) {
        processes.push({ name: match[1], pid: Number(match[2]) });
    }
    return processes;
}

function parseLine(line, family) {
    let fields = line.trim().split(/\s+/);
    if (fields.length < 5)
        return null;
    // Some ss output includes a protocol column before the socket state.
    let netid = /^(tcp|udp)$/i.test(fields[0]) ? fields.shift().toUpperCase() : null;
    let state = fields[0].toUpperCase();
    let protocol = null;
    if (state === "LISTEN")
        protocol = "TCP";
    else if (state === "UNCONN")
        protocol = "UDP";
    else
        return null;
    if (netid && netid !== protocol)
        return null;
    let endpoint = parseEndpoint(fields[3]);
    if (!endpoint)
        return null;
    // Process details may be absent when the current user cannot read them.
    let processField = fields.slice(5).join(" ");
    return Model.createSocketRecord({
        protocol: protocol,
        family: family || (endpoint.address.indexOf(":") >= 0 ? "IPv6" : "IPv4"),
        address: endpoint.address,
        port: endpoint.port,
        processes: parseProcesses(processField)
    });
}

function parseSsOutput(output, family) {
    if (typeof output !== "string" || output.length === 0)
        return [];
    return output.split(/\r?\n/).map(function (line) { return parseLine(line, family); }).filter(function (record) {
        return record !== null;
    });
}

var Parser = {
    parseEndpoint: parseEndpoint,
    parseLine: parseLine,
    parseSsOutput: parseSsOutput
};
