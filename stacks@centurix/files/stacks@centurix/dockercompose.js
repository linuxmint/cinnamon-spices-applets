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
		/*
		 * Fetch the best available docker compose command
		 */
		global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: Checking Docker commands`);

		return new Promise((resolve, reject) => {
			this.execAsyncCmd(`which ${this.docker_cmd}`).then(cmd_path => {
				cmd_path = cmd_path.trim();
				// Docker exists, check for the compose command
				this.execAsyncCmd(`${cmd_path} compose`).then(result => {
					// Docker compose exists, use that
					resolve(`${cmd_path} compose`);
				}).catch(result => {
					// Older docker command
					this.execAsyncCmd(`which ${this.docker_compose_cmd}`).then(cmd_path => {
						cmd_path = cmd_path.trim();
						resolve(cmd_path);
					}).catch(result => {
						reject("");
					})
				})
			}).catch(result => {
				// Look for docker-compose
				this.execAsyncCmd(`which ${this.docker_compose_cmd}`).then(cmd_path => {
					cmd_path = cmd_path.trim();
					resolve(cmd_path);
				}).catch(result => {
					reject("");
				})
			});	
		})
	},

    available: function() {
		/*
		 * See if everything is there
		 */
		return new Promise((resolve, reject) => {
			// 1. Check to see if docker_cmd is present
			// 2. If it does, check the version for the new "docker compose" command and use that
			// 3. If it does not, check for the older Python based "docker-compose"
			this.availableDockerComposeCmd().then(result => {
				resolve(result);
			}).catch(result => {
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
	logs: function(stack_file) {
		// View the logs
		return new Promise((resolve, reject) => {
			this.exec(stack_file, "logs").then(logs => {
				resolve(logs);
			}).catch(result => {
				reject(result);
			});	
		})
	},

    up: function(stack_file) {
        // Bring a stack up with `docker-compose up`
        this.exec(stack_file, "up", null, false);
    },

    down: function(stack_file) {
        // Bring a stack down with `docker-compose down`
        this.exec(stack_file, "down", null, false);
    },

	isUp: function(stack_file) {
		return new Promise((resolve, reject) => {
			// Check to see if any processes are running, return true/false
			global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: CHECKING RUNNING STATE`);
			this.exec(stack_file, "top").then(result => {
				global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: RUNNING STATE: UP`);
				if (result.length > 0) { // Any content from top shows that it is running
					resolve();
				} else {
					reject();
				}
			}).catch(result => {
				global.log(`${UUID}::DockerCompose:${(new Error().stack).split('@')[0]}: RUNNING STATE: DOWN`);
				reject();
			});
		})
	},

	exec: function(stack_file, command, callback = null, capture = true) {
		return new Promise((resolve, reject) => {
			callback = callback;
			try {
				this.availableDockerComposeCmd().then(cmd => {
					let fullCmd = cmd.split(" ").concat([
						"-f",
						stack_file,
						command
					]);
					let [exit, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
						"/",
						fullCmd,
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
							if (line === null) {
								break;
							}
							lines.push(ByteArray.toString(line));
						}

						out = lines.join("\n");
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
