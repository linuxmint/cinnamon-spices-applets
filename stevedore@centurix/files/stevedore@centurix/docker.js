const Mainloop = imports.mainloop;
const TerminalReader = imports.applet.terminal_reader;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;

function Docker() {
    this._init();
}

Docker.prototype = {
    _init: function() {
    },

    isInstalled: function() {
        return this.commandPath() != '';
    },

    commandPath: function() {
        let [res, list, err, status] = GLib.spawn_command_line_sync("which docker");
        return list.toString().replace('\n', '');
    },

    parseColumnMetadata: function(original_row) {
        row = original_row;
        last_reduction = '';
        while (row != last_reduction) {
            last_reduction = row;
            row = row.replace(/   /gi, '  ');
        }
        positions = [];
        row.split('  ').forEach(function(element) {
            positions.push({
                name: element,
                position: original_row.match(element).index,
                length: -1
            });
        });
        for (var index = 0; index < positions.length - 1; index++) {
            positions[index].length = positions[index + 1].position - positions[index].position;
        }
        return positions;
    },

    colCommand: function(command) {
        let [res, list, err, status] = GLib.spawn_command_line_sync(this.commandPath() + ' ' + command);
        output_lines = list.toString().split('\n');
        // Each column is a minimum of 20 characters, but can be larger. Column headings tell us how wide...
        columns = this.parseColumnMetadata(output_lines[0]);
        lines = [];
        for (var index = 1; index < output_lines.length - 1; index++) {
            line = {};
            columns.forEach(function(column) {
                if (column.length != -1) {
                    line[column.name.toLowerCase()] = output_lines[index].substr(column.position, column.length).trim();
                } else {
                    line[column.name.toLowerCase()] = output_lines[index].substr(column.position).trim();
                }
            });
            lines.push(line);
        }
        return lines;
    },

    // --format option may help a lot here...
    listImages: function() {
        return this.colCommand('image ls');
    },

    addImage: function(image_name) {
        try {
            let [res, list, err, status] = GLib.spawn_command_line_async(this.commandPath() + ' pull ' + image_name);
            return true
        } catch(e) {
            global.log(e);
        }
    },

    removeImage: function(image_name) {
        let [res, list, err, status] = GLib.spawn_command_line_async(this.commandPath() + ' image rm -f ' + image_name);
        return true;
    },

    checkPullProcess: function() {
        let [res, list, err, status] = GLib.spawn_command_line_sync('ps aux');
        return (new RegExp('docker pull').test(list));
    },

    listContainers: function() {
        return this.colCommand('container ls --all');
    },

    startContainer: function(container_id) {
        try {
            let [res, list, err, status] = GLib.spawn_command_line_async(this.commandPath() + ' start -i ' + container_id);
            // Parse list to make sure it started properly, what kind of errors do we get?
            return true;
        } catch(e) {
            global.log(e);
        }
    },

    stopContainer: function(container_id) {
        try {
            // Brutally kill a docker image
            let [res, list, err, status] = GLib.spawn_command_line_sync(this.commandPath() + ' stop -t 5 ' + container_id);
            // Parse list to make sure it stopped properly, what kind of errors do we get?
            return true;
        } catch(e) {
            global.log(e);
        }
    },

    newContainer: function(image_id, volume, workdir, memory, memorySwap, entrypoint, params) {
        try {
            arguments = ' create';
            if (params != '')
                arguments += ' ' + params;
            arguments += ' --tty';
            if (volume != '')
                arguments += ' --volume=' + volume;
            if (workdir != '')
                arguments += ' --workdir=' + workdir;
            if (memory != '')
                arguments += ' --memory=' + memory;
            if (memorySwap != '')
                arguments += ' --memory-swap=' + memorySwap;

            arguments += ' ' + image_id + ' ';

            if (entrypoint != '')
                arguments += ' ' + entrypoint;

            let [res, list, err, status] = GLib.spawn_command_line_sync(this.commandPath() + arguments);
            return true;
        } catch(e) {
            global.log(e);
        }
    },

    removeContainer: function(container_id) {
        try {
            let [res, list, err, status] = GLib.spawn_command_line_sync(this.commandPath() + ' rm -f ' + container_id);
            return true;
        } catch(e) {
            global.log(e);
        }
    },

    inspectContainer: function(container_id) {
        try {
            let [res, list, err, status] = GLib.spawn_command_line_sync(this.commandPath() + ' inspect ' + container_id);
            return JSON.parse(list)[0];
        } catch(e) {
            global.log(e);
        }
    },

    hasSSH: function(container_id) {
        try {
            container = this.inspectContainer(container_id);
            return ('22/tcp' in container.NetworkSettings.Ports);
        } catch(e) {
            global.log(e);
            return false;
        }
    },

    hasWeb: function(container_id) {
        try {
            container = this.inspectContainer(container_id);
            return ('80/tcp' in container.NetworkSettings.Ports);
        } catch(e) {
            global.log(e);
            return false;
        }
    },

    IPAddress: function(container_id) {
        try {
            container = this.inspectContainer(container_id);
            return container.NetworkSettings.Networks.bridge.IPAddress;
        } catch(e) {
            global.log(e);
            return false;
        }
    },

    mounts: function(container_id) {
        try {
            container = this.inspectContainer(container_id);
            return container.Mounts;
        } catch(e) {
            global.log(e);
            return false;
        }
    },

    path: function(container_id) {
        try {
            container = this.inspectContainer(container_id);
            return container.Path;
        } catch(e) {
            global.log(e);
            return false;
        }
    },

    memory: function(container_id) {
        try {
            container = this.inspectContainer(container_id);
            return container.HostConfig.Memory;
        } catch(e) {
            global.log(e);
            return false;
        }
    },

    openTTY: function(container_id) {
        try {
            Main.Util.spawnCommandLine("gnome-terminal -x " + this.commandPath() + ' attach ' + container_id);
        } catch(e) {
            global.log(e);
        }
    },

    versions: function() {
        let [res, list, err, status] = GLib.spawn_command_line_sync(this.commandPath() + ' version');
        return {
            docker: (/Version:(.*)/gi).exec(list)[1].trim(),
            api: (/API version:(.*)/gi).exec(list)[1].trim(),
            go: (/Go version:(.*)/gi).exec(list)[1].trim(),
            commit: (/Git commit:(.*)/gi).exec(list)[1].trim(),
            built: (/Built:(.*)/gi).exec(list)[1].trim(),
            os: (/OS\/Arch:(.*)/gi).exec(list)[1].trim()
        }
    }
}
