const Gio = imports.gi.Gio;

function HostsFile() {
    this._init();
}

HostsFile.prototype = {
    _hosts_file: null,
    _lines: [],
    _ips: {},

    findIp: new RegExp('(?:[0-2]?[0-9]{1,2}\.){3}[0-2]?[0-9]{1,2}(?=\\s+)'),
    findComment: new RegExp('^\s*#'),
    removeComment: new RegExp('^\\s*#\\s*(.+?)\\s*$'),

    _init: function() {
        this._hosts_file = Gio.File.new_for_path('/etc/hosts');
        this._readFile();
    },

    _readFile: function() {
        this._lines = '';
        this._ips = {};
        let content = this._hosts_file.load_contents(null);
        this._lines = String(content[1]).split("\n");
        for (let i = 0, l = this._lines.length; i < l; i++) {
            this._readEntries(i, this._lines[i]);
        }
    },

    _readEntries: function(i, line) {
        let ip = this.findIp.exec(line);
        if (ip !== null) {
            ip = ip[0];
            if (!(ip in this._ips)) {
                this._ips[ip] = [];
            }
            let lineEntry = {
                line: i,
                commented: this.findComment.test(line)
            };
            this._ips[ip].push(lineEntry);
        }
    },

    save: function() {
        /* Has a problem with the rest of a file */
        let readwrite = this._hosts_file.open_readwrite(null);
        let writeFile = readwrite.get_output_stream();
        let content = this._lines.join("\n").trim() + "\n";
        writeFile.write(content, null);
        writeFile.truncate(content.length, null, null);
        writeFile.close(null);
        this._readFile();
        return true;
    },

    getIp: function(host) {
        let searcher = new RegExp('\\s+' + host + '\\s*(.|$)');
        for (let lineNum in this._lines) {
            let line = this._lines[lineNum];
            if (searcher.test(line)) {
                let ip = this.findIp.exec(line);
                if (ip !== null) {
                    return ip;
                }
            }
        }
        return false;
    },

    addIp: function(ip, hosts) {
        if (this.exists(ip)) {
            return false;
        }
        this._ips[ip] = [];
        this._lines.push(ip + "\t" + hosts.join(' '));
        let i = this._lines.length;
        this._ips[ip].push({
            line: i,
            commented: false
        });
        return true;
    },

    addHost: function(ip, host) {
        if (!this.exists(ip)) {
            return null;
        }
        let i = this._ips[ip][0].line;
        this._lines[i] += ' ' + host;
        return i;
    },

    replaceHosts: function(ip, host) {
        if (!this.exists(ip)) {
            return null;
        }
        let i = this._ips[ip][0].line;
        this._lines[i] = ip + "\t" + hosts.join(' ');
        return i;
    },

    commentEntry: function(ip) {
        if (!this.isSingular(ip)) {
            return null;
        }
        let i = this._ips[ip][0].line;
        this._lines[i] = '# ' + this._lines[i];
        this._ips[ip][0].commented = true;
        return i;
    },

    uncommentEntry: function (ip) {
        if (!this.isSingular(ip)) {
            return null;
        }
        let i = this._ips[ip][0].line;
        let line = this.removeComment.exec(this._lines[i]);
        if (line == null) {
            return false;
        }
        this._lines[i] = line[1];
        this._ips[ip][0].commented = false;
        return i;
    },

    exists: function(ip) {
        return (ip in this._ips);
    },

    isSingular: function (ip) {
        if (!this.exists(ip)) {
            return null;
        }
        return this._ips[ip].length == 1;
    },

    isCommented: function (ip) {
        if (!this.isSingular(ip)) {
            return null;
        }
        return this._ips[ip][0].commented;
    }
}
