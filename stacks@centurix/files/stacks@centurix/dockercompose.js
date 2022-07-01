const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
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
function DockerCompose(docker_compose_cmd, docker_cmd, docker_compose_project_folder) {
	this._init(docker_compose_cmd, docker_cmd, docker_compose_project_folder);
}

DockerCompose.prototype = {
	_init: function(docker_compose_cmd, docker_cmd, docker_compose_project_folder) {
        this.docker_compose_cmd = docker_compose_cmd;
		this.docker_cmd = docker_cmd;
        this.docker_compose_project_folder = docker_compose_project_folder;
	},

    setDockerComposeCmd: function(docker_compose_cmd) {
        this.docker_compose_cmd = docker_compose_cmd;
    },

    setDockerCmd: function(docker_cmd) {
        this.docker_cmd = docker_cmd;
    },

	/*
	 * Deal with locating the docker compose/docker-compose commands
	 */

	execAsyncCmd: function(cmd) {
		let loop = GLib.MainLoop.new(null, false);
		try {
			let proc = Gio.Subprocess.new(
				cmd.split(" "),
				Gio.SubprocessFlags.STDOUT_PIPE | Gio.Subprocess.STDERR_PIPE
			);
			return new Promise((resolve, reject) => {
				proc.communicate_utf8_async(null, null, (proc, res) => {
					let [, stdout, stderr] = proc.communicate_utf8_finish(res);
					if (proc.get_successful()) {
						resolve(stdout);
					} else {
						reject(stdout);
					}
					loop.quit();
				});	
			})
		} catch(e) {
			global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: ${e}`);
		}
		loop.run();
	},

	availableDockerComposeCmd: function() {
		// this.docker_cmd = "chappy";
		global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: Checking Docker commands`);

		return new Promise((resolve, reject) => {
			this.execAsyncCmd(`which ${this.docker_cmd}`).then(result => {
				// Docker exists, check for the compose command
				this.execAsyncCmd(`${this.docker_cmd} compose`).then(result => {
					// Docker compose exists, use that
					resolve(result);
				}).catch(result => {
					// Older docker command
					this.execAsyncCmd(`which ${this.docker_compose_cmd}`).then(result => {
						resolve(this.docker_compose_cmd);
					}).catch(result => {
						reject("");
					})
				})
			}).catch(result => {
				// Look for docker-compose
				this.execAsyncCmd(`which ${this.docker_compose_cmd}`).then(result => {
					resolve(this.docker_compose_cmd);
				}).catch(result => {
					reject("");
				})
			});	
		})
	},

    exists: function() {
		/*
		 * Look for either docker-compose or the newer "docker compose" command
		 */
		return new Promise((resolve, reject) => {
			// 1. Check to see if docker_cmd is present
			// 2. If it does, check the version for the new "docker compose" command and use that
			// 3. If it does not, check for the older Python based "docker-compose"
			this.availableDockerComposeCmd().then(result => {
				global.log(`FOUND: ${result}`);
				resolve(result);
			}).catch(result => {
				global.log(`NOT FOUND!`);
				reject(result)
			})
		})
	},

	/*
	 * Deal with docker compose files in the project root
	 */

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
			global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: Checking for ${e}`);
		}
	},

    listDockerComposefiles: function() {
        return this.findDockerComposeFiles(Gio.file_new_for_path(Util.resolveHome(this.docker_compose_project_folder)));
    },

	/*
	 * Deal with docker images and containers
	 */
	listImages: function(stack_file) {
		/*
		Grab the results from the command and parse it
		       Container          Repository    Tag       Image Id       Size  
		-----------------------------------------------------------------------
		traffcap_node_1           node         16       15ddf4b49c29   904.6 MB
		traffcap_vault-server_1   vault        latest   f46a4c1a979e   198.6 MB
		*/
		this.exec(stack_file, "images").then((results) => {
			let images = this.exec(stack_file, "images");
			let lines = images.split("\n");
			global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: Image results`);
			lines.forEach((line) => {
				global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: ${line}`);
			})
		})
	},

    ssh: function(stack_file) {
        // Open up an SSH terminal
    },

    up: function(stack_file) {
        // Bring a stack up with `docker-compose up`
        this.exec(stack_file, "up", null, false);
    },

    down: function(stack_file) {
        // Bring a stack down with `docker-compose down`
        this.exec(stack_file, "down", null, false);
    },

	status: function(stack_file) {
		// Check to see if any processes are running, return true/false
		global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: CHECKING RUNNING STATE`);
		this.exec(stack_file, "top").then(result => {
			global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: RUNNING STATE: ${result}`);
		}).catch(result => {

		});
		return (result != "");
	},

	events: function(stack_file) {
		// Add a sink for events
		global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: ADDING EVENTS SINK`);
		this.exec(stack_file, "events", function(arg1, arg2, arg3) {
			global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: ARG1 ${arg1}`);
			global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: ARG2 ${arg2}`);
			global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: ARG3 ${arg3}`);
		});
	},

	exec: function(stack_file, command, callback = null, capture = true) {
		return new Promise((resolve, reject) => {
			callback = callback;
			try {
				this.availableDockerComposeCmd().then(cmd => {
					let [exit, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
						Util.resolveHome(this.docker_compose_project_folder),
						[cmd, "-f", stack_file, command],
						null,
						GLib.SpawnFlags.DO_NOT_REAP_CHILD,
						null
					);

					let out = "";

					if (capture) {
						let out_reader = new Gio.DataInputStream({ base_stream: new Gio.UnixInputStream({fd: stdout}) });

						let lines = [];
						let line;
						let length = 0;
			
						while (true) {
							[line, length] = out_reader.read_line(null);
							lines.push(line);
							if (length == 0) {
								break;
							}
						}
			
						out = lines.join("\n");
			
						global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: OUTPUT`);
						global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: ${out}`);
						global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: END OUTPUT`);
					} else {
						global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: NOT CHECKING OUTPUT`);
					}

					if (callback) {
						global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: Calling child_watch_add()...`);
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
						global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: ${this._watch}`);
					}
					resolve(out);
				}).catch(cmd => {
					// No available docker compose command
					reject(cmd);
				})
			} catch(e) {
				global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: ${e}`);
			}
		})
	}
}
