const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const UUID = "stacks@centurix";
let Util;
if (typeof require !== 'undefined') {
	Util = require('./util');
} else {
	const AppletDir = imports.ui.appletManager.applets['stacks@centurix'];
	Util = AppletDir.util;
}

/**
 * docker-compose manager
 */
function DockerCompose(docker_compose_cmd, docker_compose_project_folder) {
	this._init(docker_compose_cmd, docker_compose_project_folder);
}

DockerCompose.prototype = {
	_init: function(docker_compose_cmd, docker_compose_project_folder) {
        this.docker_compose_cmd = docker_compose_cmd;
        this.docker_compose_project_folder = docker_compose_project_folder;
	},

    setDockerComposeCmd: function(docker_compose_cmd) {
        this.docker_compose_cmd = docker_compose_cmd;
    },

    exists: function() {
		try {
			global.log(UUID + "::DockerCompose:exists: checking for " + this.docker_compose_cmd);
			let [res, list, err, status] = GLib.spawn_command_line_sync("which " + this.docker_compose_cmd);
			return parseInt(status) == 0;
		} catch(e) {
			global.log(UUID + "::DockerCompose:exists: " + e);
		}
	},

    findDockerComposeFiles: function(currentDir) {
		// Scan through the docker compose project folder for:
		// docker-compose.yaml and docker-compose.yml files
		try {
			let compose_files = [];
			let enumerator = currentDir.enumerate_children("standard::*", Gio.FileQueryInfoFlags.NONE, null);

			let info;
			while ( (info = enumerator.next_file(null)) != null ) {
				if ( info.get_is_hidden() ) continue;
				if ( info.get_file_type() == Gio.FileType.DIRECTORY) {
					let childDir = currentDir.get_child(info.get_name());
					compose_files = compose_files.concat(this.findDockerComposeFiles(childDir));
				} else {
					if ( !info.get_name().endsWith(".yaml") && !info.get_name().endsWith(".yml") ) continue;
					compose_files.push(currentDir.get_child(info.get_name()).get_path());
				}
			}
			return compose_files;
		} catch(e) {
			global.log(UUID + "::DockerCompose:findDockerComposeFiles: " + e);
		}
	},

    listDockerComposefiles: function() {
        return this.findDockerComposeFiles(Gio.file_new_for_path(Util.resolveHome(this.docker_compose_project_folder)));
    },

    ssh: function(stack_file) {
        // Open up an SSH terminal
    },

    up: function(stack_file) {
        // Bring a stack up with `docker-compose up`
        this.exec(stack_file, "up")
    },

    down: function(stack_file) {
        // Bring a stack down with `docker-compose down`
        this.exec(stack_file, "down")
    },

	status: function(stack_file) {
		// Check to see if any processes are running, return true/false
		global.log("*********************CHECKING RUNNING STATE***********************");
		let result = this.exec(stack_file, "top");
		global.log("RUNNING STATE: " + result);
		return (result != "");
	},

	exec: function(stack_file, command, callback = null) {
		callback = callback;
		try {
			global.log("Calling spawn_async_with_pipes()...");
			global.log("Calling from " + this.docker_compose_project_folder);
			global.log(['/usr/bin/docker-compose', "-f", stack_file, command]);
			global.log(Util.resolveHome(this.docker_compose_project_folder));

			let [exit, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
				Util.resolveHome(this.docker_compose_project_folder),
				['/usr/bin/docker-compose', "-f", stack_file, command],
				null,
				GLib.SpawnFlags.DO_NOT_REAP_CHILD,
				null
			);
			global.log(exit);
			global.log(pid);
			global.log(stdin);
			global.log(stdout);
			global.log(stderr);

			let out_reader = new Gio.DataInputStream({ base_stream: new Gio.UnixInputStream({fd: stdout}) });

			let [out, size] = out_reader.read_line(null);

			global.log("***********************OUTPUT***********************");
			let result = "";
			if (out) {
				out.forEach(value => {
					result += String.fromCharCode(value);
				});	
			}
			global.log(result);
			global.log("***********************END OUTPUT***********************");
			global.log(size);
		
			global.log("Calling child_watch_add()...");
			this._watch = GLib.child_watch_add(
				GLib.PRIORITY_DEFAULT,
				pid,
				Lang.bind(this, function(pid, status, requestObj) {
					GLib.source_remove(this._watch);
					if (typeof callback == 'function') {
						callback();
					}
				})
			);
			global.log(this._watch);
			return result;
		} catch(e) {
			global.log(UUID + "::DockerCompose:Exec(" + command + "): " + e);
		}
	}
}
