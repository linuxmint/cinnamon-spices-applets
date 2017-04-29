
const GLib = imports.gi.GLib;



function ShellOutputProcess(command_argv) {
    this._init(command_argv);
};

ShellOutputProcess.prototype = {

    _init: function(command_argv) {
        this.command_argv = command_argv;
        this.flags = GLib.SpawnFlags.SEARCH_PATH ;
        this.success = false;
        this.standard_output_content = "";
        this.standard_error_content = "";
        this.pid = -1;
        this.standard_input_file_descriptor = -1;
        this.standard_output_file_descriptor = -1;
        this.standard_error_file_descriptor = -1;
    },

    spawn_sync_and_get_output: function() {
        this.spawn_sync();
        let output = this.get_standard_output_content();
        return output;
    },

    spawn_sync: function() {
        let [success, standard_output_content, standard_error_content] = GLib.spawn_sync(
            null,
            this.command_argv,
            null,
            this.flags,
            null);
        this.success = success;
        this.standard_output_content = standard_output_content;
        this.standard_error_content = standard_error_content;
    },

    get_standard_output_content: function() {
        return this.standard_output_content.toString();
    },

    spawn_sync_and_get_error: function() {
        this.spawn_sync();
        let output = this.get_standard_error_content();
        return output;
    },

    get_standard_error_content: function() {
        return this.standard_error_content.toString();
    },

    spawn_async: function() {
        let [success, pid, standard_input_file_descriptor,
             standard_output_file_descriptor, standard_error_file_descriptor] = GLib.spawn_async_with_pipes(
             null,
             this.command_argv,
             null,
             this.flags,
             null,
             null);

        this.success = success;
        this.pid = pid;
        this.standard_input_file_descriptor = standard_input_file_descriptor;
        this.standard_output_file_descriptor = standard_output_file_descriptor;
        this.standard_error_file_descriptor = standard_error_file_descriptor;
    },

};







function TerminalProcess(bash_command) {
    this._init(bash_command);
};

TerminalProcess.prototype = {

    _init: function(bash_command) {
        this.bash_command = bash_command;
        this.flags = GLib.SpawnFlags.SEARCH_PATH;
        this.success = false;

        this.default_pid = -1;
        this.pid = this.default_pid;
        this.tmp_filepath = "";
        this.spawn_async_calls = 0;
        this.spawned_async = false;

        this.maximized = false;
    },

    get bash_command() {
        return this._bash_command;
    },

    set bash_command(command) {
        command = this._add_semicolon_end(command);
        this._bash_command = command;
    },

    _add_semicolon_end: function(command) {
        command = command.trim();
        let last_char = command.slice(-1);
        let semicolon = ";";
        if(last_char != semicolon) {
            command = command + semicolon;
        }
        return command;
    },

    spawn_async: function() {
        this.spawn_async_calls++;
        if(this.spawn_async_calls == 1 && !this.spawned_async) {
            this.tmp_filepath = this.generate_tmp_filename();
            let command_argv = this.get_command_argv();
            [this.success]  = GLib.spawn_async(null, command_argv, null, this.flags, null, null);
            this.spawned_async = true;
        }
        this.spawn_async_calls--;
    },

    generate_tmp_filename: function() {
        let process = new ShellOutputProcess(['tempfile']);
        let output = process.spawn_sync_and_get_output();
        output = output.trim();
        return output;
    },

    get_command_argv: function() {
        let argv = ['gnome-terminal']
        if(this.maximized) {
            argv.push('--maximize');
        }
        argv.push('-e');

        let bash_command = this.get_full_bash_command();
        argv.push(bash_command);
        return argv;
    },

    get_full_bash_command: function() {
        let start_bash = "bash -c \"";
        let write_terminal_pid = "echo $$ > " + this.tmp_filepath + ";"
        let exec_user_command = this._bash_command;
        let keep_terminal_opened = "exec bash\"";
        return start_bash + write_terminal_pid + exec_user_command + keep_terminal_opened;
    },

    is_running: function() {
        if(this.spawned_async && this.pid == this.default_pid) {
            this.read_pid_and_delete_tmp_file_on_success();
        }
        return this.pid != this.default_pid;
    },

    read_pid_and_delete_tmp_file_on_success: function () {
        this.pid = this.read_pid();

        if(this.pid != this.default_pid) {
            this.delete_tmp_file();
        }
    },

    read_pid: function () {
        let process = new ShellOutputProcess(['cat', this.tmp_filepath]);
        let output = process.spawn_sync_and_get_output();
        if(output.length > 0) {
            return Number(output);
        }
        return this.default_pid;
    },

    delete_tmp_file: function () {
        let process = new ShellOutputProcess(['rm', this.tmp_filepath]);
        process.spawn_sync();
    },

    kill: function() {
        if(this.is_running()) {
            let process = new ShellOutputProcess(['kill', '-9', this.pid.toString()]);
            let output = process.spawn_sync_and_get_error();
            this.pid = this.default_pid;
            this.spawned_async = false;
        }
    },

}



