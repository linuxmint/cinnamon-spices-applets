
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

let Compatibility;
if (typeof require !== 'undefined') {
    Compatibility = require('./compatibility');
} else {
    Compatibility = AppletDirectory.compatibility;
}

const SignalType = {
    SIGHUP:    1,
    SIGINT:    2,
    SIGQUIT: 3,
    SIGILL:    4,
    SIGTRAP: 5,
    SIGIOT:    6,
    SIGBUS:    7,
    SIGFPE:    8,
    SIGKILL: 9,
    SIGUSR1: 10,
    SIGSEGV: 11,
    SIGUSR2: 12,
    SIGPIPE: 13,
    SIGALRM: 14,
    SIGTERM: 15,
    SIGSTKFLT: 16,
    SIGCHLD: 17,
    SIGCONT: 18,
    SIGSTOP: 19,
    SIGTSTP: 20,
    SIGTTIN: 21,
    SIGTTOU: 22,
}






function ShellOutputProcess(command_argv) {
    this._init(command_argv);
};

ShellOutputProcess.prototype = {

    _init: function(command_argv) {
        this.command_argv = command_argv;
        this.flags = GLib.SpawnFlags.SEARCH_PATH;
        this.success = false;
        this.standard_output_content = "";
        this.standard_error_content = "";
        this.pid = -1;
        this.standard_input_file_descriptor = -1;
        this.standard_output_file_descriptor = -1;
        this.standard_error_file_descriptor = -1;
        this.cinnamon_version_adapter = new Compatibility.CinnamonVersionAdapter();
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
        return this.cinnamon_version_adapter.byte_array_to_string(this.standard_output_content);
    },

    spawn_sync_and_get_error: function() {
        this.spawn_sync();
        let output = this.get_standard_error_content();
        return output;
    },

    get_standard_error_content: function() {
        return this.cinnamon_version_adapter.byte_array_to_string(this.standard_error_content);
    },

    spawn_async: function() {
        let [success, pid, standard_input_file_descriptor,
             standard_output_file_descriptor, standard_error_file_descriptor] = GLib.spawn_async_with_pipes(
             null,
             this.command_argv,
             null,
             this.flags,
             null);

        this.success = success;
        this.pid = pid;
        this.standard_input_file_descriptor = standard_input_file_descriptor;
        this.standard_output_file_descriptor = standard_output_file_descriptor;
        this.standard_error_file_descriptor = standard_error_file_descriptor;
    },

};








function BackgroundProcess(command_argv, streams_on){
    this._init(command_argv, streams_on);
}

BackgroundProcess.prototype = {
    _init: function(command_argv, streams_on){
        this.command_argv = command_argv;
        this.streams_on = streams_on;
        this.flags = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD;
        this.fill_all_characters_buffer = -1;
        this.default_pid = -1;
        this.pid = this.default_pid;
        this.spawn_async_calls = 0;
        this.pause_resume_async_calls = 0;
        this.spawned_async = false;
        this.paused = false;
        this.callback_object = null;
        this.callback_process_finished = null;

        this.success = false;
        this.standard_output_content = "";
        this.standard_error_content = "";
        this.standard_input_file_descriptor = -1;
        this.standard_output_file_descriptor = -1;
        this.standard_error_file_descriptor = -1;
        this.standard_output_characters = 0;
        this.standard_error_characters = 0;
        this.standard_input_unix_stream = new Gio.UnixOutputStream({ fd: this.standard_input_file_descriptor,
                                                                     close_fd: true });
        this.standard_output_unix_stream = new Gio.UnixInputStream({ fd: this.standard_output_file_descriptor,
                                                                     close_fd: true });
        this.standard_error_unix_stream = new Gio.UnixInputStream({ fd: this.standard_error_file_descriptor,
                                                                    close_fd: true });
        this.standard_output_data_stream = new Gio.DataInputStream({ base_stream: this.standard_output_unix_stream });
        this.standard_error_data_stream = new Gio.DataInputStream({ base_stream: this.standard_error_unix_stream });
        this.standard_error_cancellable = new Gio.Cancellable();
        this.standard_output_cancellable = new Gio.Cancellable();
        this.cinnamon_version_adapter = new Compatibility.CinnamonVersionAdapter();
    },

    set_callback_process_finished: function(callback_object, callback_function) {
        this.callback_object = callback_object;
        this.callback_process_finished = callback_function;
    },

    spawn_async: function() {
        try {
            this.spawn_async_calls++;
            if(this.spawn_async_calls == 1 && !this.spawned_async) {
                this._spawn_async_with_pipes();
                this.spawned_async = true;
            }
        } finally {
            this.spawn_async_calls--;
        }
    },

    _spawn_async_with_pipes: function() {
        let [success, pid, standard_input_file_descriptor,
             standard_output_file_descriptor, standard_error_file_descriptor] = GLib.spawn_async_with_pipes(
             null,
             this.command_argv,
             null,
             this.flags,
             null);

        this.success = success;
        this.pid = pid;
        this.standard_input_file_descriptor = standard_input_file_descriptor;
        this.standard_output_file_descriptor = standard_output_file_descriptor;
        this.standard_error_file_descriptor = standard_error_file_descriptor;
        this._init_streams();
        this._add_exit_callback();

        this._read_streams();
    },

    _init_streams: function() {
        this.standard_output_characters = 0;
        this.standard_error_characters = 0;
        this.standard_input_unix_stream = new Gio.UnixOutputStream({ fd: this.standard_input_file_descriptor,
                                                                     close_fd: true });
        this.standard_output_unix_stream = new Gio.UnixInputStream({ fd: this.standard_output_file_descriptor,
                                                                     close_fd: true });
        this.standard_error_unix_stream = new Gio.UnixInputStream({ fd: this.standard_error_file_descriptor,
                                                                    close_fd: true });
        this.standard_error_data_stream = new Gio.DataInputStream({ base_stream: this.standard_error_unix_stream });
        this.standard_output_data_stream = new Gio.DataInputStream({ base_stream: this.standard_output_unix_stream });
        this.standard_error_cancellable = new Gio.Cancellable();
        this.standard_output_cancellable = new Gio.Cancellable();
    },

    _add_exit_callback: function() {
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT_IDLE,
                             this.pid,
                             Lang.bind(this, this._on_exit));
    },

    _on_exit: function(pid, status) {
        GLib.spawn_close_pid(pid);
        this._close_streams();
        this._set_not_running();
        this._invoke_callback_process_finished(pid, status);
    },

    _invoke_callback_process_finished: function(pid, status) {
        if(this.callback_process_finished != null) {
            this.callback_process_finished.call(this.callback_object, this, pid, status);
        }
    },

    _read_streams: function() {
        if(this.streams_on) {
            this._read_standard_output_descriptor();
            this._read_standard_error_descriptor();
        }
    },

   _read_standard_output_descriptor: function() {
        this.standard_output_data_stream.fill_async(this.fill_all_characters_buffer,
                                                    GLib.PRIORITY_DEFAULT,
                                                    this.standard_output_cancellable,
                                                    Lang.bind(this, this._on_fill_async_standard_output));
   },

   _on_fill_async_standard_output: function(stream, fill_async_result) {
         try {
            let closed = stream.is_closed();
            if(!closed) {
                this.standard_output_characters = stream.fill_finish(fill_async_result);
                if(this.standard_output_characters >= 0) {
                    this._read_increase_standard_output_buffer(stream);
                }
            }
         } catch(e) {
             global.log("Error while filling standard output buffer: " + e);
         }
    },

    _read_increase_standard_output_buffer: function(stream) {
        if(this.standard_output_characters == 0) {
            this._read_standard_output_buffer(stream);
        }
        else {
            this.increase_buffer_size(stream);
            this._read_standard_output_descriptor();
        }
   },

   _read_standard_output_buffer: function(stream) {
       this.standard_output_content = this.cinnamon_version_adapter.byte_array_to_string(stream.peek_buffer());
   },

   increase_buffer_size: function(stream) {
        let size =  2 * stream.get_buffer_size();
        stream.set_buffer_size(size);
   },

   _read_standard_error_descriptor: function() {
        this.standard_error_data_stream.fill_async(this.fill_all_characters_buffer,
                                                   GLib.PRIORITY_DEFAULT,
                                                   this.standard_error_cancellable,
                                                   Lang.bind(this, this._on_fill_async_standard_error));
   },

   _on_fill_async_standard_error: function(stream, fill_async_result) {
         try {
            let closed = stream.is_closed();
            if(!closed) {
                this.standard_error_characters = stream.fill_finish(fill_async_result);
                if(this.standard_error_characters >= 0) {
                    this._read_increase_standard_error_buffer(stream);
                }
            }
         } catch(e) {
             global.log("Error while filling standard error buffer: " + e);
         }
    },

    _read_increase_standard_error_buffer: function(stream) {
        if(this.standard_error_characters == 0) {
            this._read_standard_error_buffer(stream);
        }
        else {
            this.increase_buffer_size(stream);
            this._read_standard_error_descriptor();
        }
    },

    _read_standard_error_buffer: function(stream) {
       this.standard_error_content = this.cinnamon_version_adapter.byte_array_to_string(stream.peek_buffer());
    },

    _close_streams: function(){
        this._close_standard_input_stream();
        this._close_standard_output_streams();
        this._close_standard_error_streams();
    },

    _close_standard_input_stream: function() {
         try {
             this.standard_input_unix_stream.close(null);
         } catch(e) {
             global.log("Error while closing standard input stream: " + e);
         }
    },

    _close_standard_output_streams: function() {
         try {
             this.standard_output_data_stream.close_async(GLib.PRIORITY_DEFAULT, this.standard_output_cancellable, null);
             this.standard_output_unix_stream.close_async(GLib.PRIORITY_DEFAULT, this.standard_output_cancellable, null);
         } catch(e) {
             global.log("Error while closing standard output streams: " + e);
         }
    },

    _close_standard_error_streams: function() {
         try {
             this.standard_error_data_stream.close_async(GLib.PRIORITY_DEFAULT, this.standard_error_cancellable, null);
             this.standard_error_unix_stream.close_async(GLib.PRIORITY_DEFAULT, this.standard_error_cancellable, null);
         } catch(e) {
             global.log("Error while closing standard error streams: " + e);
         }
    },

    _set_not_running: function() {
        this.pid = this.default_pid;
        this.spawned_async = false;
        this.paused = false;
    },

    get_standard_output_content: function() {
        return this.standard_output_content;
    },

    get_standard_error_content: function() {
        return this.standard_error_content;
    },

    kill: function() {
        this.send_kill_signal();
    },

    send_kill_signal: function() {
        if(this.is_running()) {
            let process = new ShellOutputProcess(['kill', '-9', this.pid.toString()]);
            let output = process.spawn_sync_and_get_error();
        }
    },

    is_running: function() {
        return this.pid != this.default_pid;
    },

    pause: function() {
        try {
            this.pause_resume_async_calls++;
            if(this.pause_resume_async_calls == 1 && !this.paused) {
                this.send_stop_signal();
            }
        } finally {
            this.pause_resume_async_calls--;
        }
    },

    send_stop_signal: function() {
        if(this.is_running()) {
            let process = new ShellOutputProcess(['kill', '-STOP', this.pid.toString()]);
            let output = process.spawn_sync_and_get_error();
            this.paused = true;
        }
    },

    resume: function() {
        try {
            this.pause_resume_async_calls++;
            if(this.pause_resume_async_calls == 1 && this.paused) {
                this.send_cont_signal();
            }
        } finally {
            this.pause_resume_async_calls--;
        }
    },

    send_cont_signal: function() {
        if(this.is_running()) {
            let process = new ShellOutputProcess(['kill', '-CONT', this.pid.toString()]);
            let output = process.spawn_sync_and_get_error();
            this.paused = false;
        }
    },

    is_paused: function() {
        return this.paused;
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
        try {
            this.spawn_async_calls++;
            if(this.spawn_async_calls == 1 && !this.spawned_async) {
                this.tmp_filepath = this.generate_tmp_filename();
                let command_argv = this.get_command_argv();
                [this.success]  = GLib.spawn_async(null, command_argv, null, this.flags, null, null);
                this.spawned_async = true;
            }
        } finally {
            this.spawn_async_calls--;
        }
    },

    generate_tmp_filename: function() {
        let process = new ShellOutputProcess(['mktemp']);
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





