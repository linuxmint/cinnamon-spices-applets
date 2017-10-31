## Changelog

### 1.1

Major code improvements
 * Switched from `gksu` to `polkit`
 * Got rid of unsafe `GLib.spawn_command_line_sync`
 * Added native javascript `GLib.child_watch_add` instead of creating text file in /tmp dir to checking status of Tor
 * Switched from `pkill` to `kill` by pid 
 * Code simplification

### 1.0

Initial release


