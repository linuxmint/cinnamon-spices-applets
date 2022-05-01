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

	listImages: function(stack_file) {
		/*
		Grab the results from the command and parse it
		       Container          Repository    Tag       Image Id       Size  
		-----------------------------------------------------------------------
		traffcap_node_1           node         16       15ddf4b49c29   904.6 MB
		traffcap_vault-server_1   vault        latest   f46a4c1a979e   198.6 MB
		*/
		let results = this.exec(stack_file, ["images"]);
		let lines = results.split("\n");
		global.log("IMAGES RESULTS");
		lines.forEach((line) => {
			global.log(line);
		})
	},

    ssh: function(stack_file) {
        // Open up an SSH terminal
    },

    up: function(stack_file) {
        // Bring a stack up with `docker-compose up`
        this.exec(stack_file, ["up"], null, false);
    },

    down: function(stack_file) {
        // Bring a stack down with `docker-compose down`
        this.exec(stack_file, ["down"], null, false);
    },

	status: function(stack_file) {
		// Check to see if any processes are running, return true/false
		global.log("*********************CHECKING RUNNING STATE***********************");
		let result = this.exec(stack_file, ["top"]);
		global.log("RUNNING STATE: " + result);
		return (result != "");
	},

	events: function(stack_file) {
		// Add a sink for events
		global.log("*********************ADDING EVENTS SINK***********************");
		let result = this.exec(stack_file, ["events", "--json"], this.capturedEvent, false);
	},

	readAsync : function()
    {
        this.out_reader.fill_async(-1, GLib.PRIORITY_DEFAULT, null, Lang.bind(this, this.capturedEvent));
    },

	capturedEvent: function(istr, res) {
        try
        {
            var avail = istr.get_available();
            global.log("readAsyncCallback avail " + avail);
            if (avail > 0)
            {
                var buf = istr.read_bytes(avail, null).get_data();
                global.log("buf " + buf);
                this.readBuffer += buf;
                this.readAsync();
            }
            else
            {
                // this.freeResources(this.DO_NOT_FINISH_PROCESS);
                // if (this.callback != null)
                // {
                //     this.callback(0, this.readBuffer);
                // }
                // this.isProcFinished = true;
            }
        }
        catch (e)
        {
            global.log("readAsyncCallback:");
            // this.freeResources();
        }
	},

	exec: function(stack_file, command, callback = null, capture = true) {
		try {
			let [exit, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
				Util.resolveHome(this.docker_compose_project_folder),
				['/usr/bin/docker-compose', "-f", stack_file].concat(command),
				null,
				GLib.SpawnFlags.DO_NOT_REAP_CHILD,
				null
			);

			let out = "";

			if (capture) {
				this.out_reader = new Gio.DataInputStream({ base_stream: new Gio.UnixInputStream({fd: stdout}) });

				let lines = [];
				let line;
				let length = 0;
	
				while (true) {
					[line, length] = this.out_reader.read_line(null);
					lines.push(line);
					if (length == 0) {
						break;
					}
				}
	
				out = lines.join("\n");
	
				global.log("***********************OUTPUT***********************");
				global.log(out);
				global.log("***********************END OUTPUT***********************");	
			} else {
				global.log("***********************NOT CHECKING  OUTPUT***********************")
			}

			if (callback) {
				this.out_reader = new Gio.DataInputStream({ base_stream: new Gio.UnixInputStream({fd: stdout}) });
				global.log("Calling child_watch_add()...");
				this.readAsync()
				// out_reader.fill_async(-1, GLib.PRIORITY_DEFAULT, null, Land.bind(this, callback));
				// this._watch = GLib.child_watch_add(
				// 	GLib.PRIORITY_DEFAULT,
				// 	pid,
				// 	Lang.bind(this, callback)
				// );
				global.log("Added child_watch_add()...");
				global.log(this._watch);
			}

			return out;
		} catch(e) {
			global.log(UUID + "::DockerCompose:Exec(" + command + "): " + e);
		}
	}

}
