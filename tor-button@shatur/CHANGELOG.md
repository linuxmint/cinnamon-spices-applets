## Changelog

### 1.2

Added support for torrc config and fixed some bugs
 * Added tab in config to configure path for torrc file
 * Added error message when attempting to rebuild chain if tor isn't running
 * `GLib.shell_parse_argv` moved into function
 * Fixed some translation issues and bugs in code

### 1.1

Major code improvements
 * Switched from `gksu` to `polkit`
 * Got rid of unsafe `GLib.spawn_command_line_sync`
 * Added native javascript `GLib.child_watch_add` instead of creating text file in /tmp dir to checking status of Tor
 * Switched from `pkill` to `kill` by pid
 * Code simplification

### 1.0

Initial release

