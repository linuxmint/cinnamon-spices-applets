### v1.4.1
  * "Disconnect" is now enabled while connecting (whether the connect attempt was started from this menu or externally via the CLI), so a stuck/slow `STATE_CONNECTING` can be aborted with `cato-sdp stop` instead of being stuck until it times out on its own.

### v1.4.0
  * Recognized Cato's "Direct Access" behavior: the client can report "connected" while actually on the office LAN with no SDP tunnel at all (text "Connected to CATO VPN via office", no `state =` field). This is now shown with its own panel icon (a network symbol inside the shield) instead of looking identical to a real SDP tunnel.

### v1.3.1
  * Recognized a new client state, `STATE_CONNECTED_UNAUTH` (an established but unauthenticated tunnel), which was previously misread as "unknown" and left the panel stuck looking like it was still connecting.
  * This state is now shown the same as "Disconnected" in the panel icon/style, with "Not authenticated" in the status/tooltip, and both Connect and Disconnect remain available from the menu.
  * Fixed reconnecting from this state: clicking "Connect" now stops the stuck unauthenticated tunnel before starting a new one (previously it only ran `start`, which was a no-op while the old tunnel was still up).

### v1.3.0
  * Removed the text label next to the panel icon; connection status is now conveyed solely via the icon color, the hover tooltip, and the popup menu.
  * The tooltip now shows the connection/account name on hover when connected or connecting, in addition to the state.
  * Added a "Statistics" submenu to the popup menu showing client version, connection (account) name, session duration, received/sent bytes, and network settings (interface, tunnel IP, internal IP, DNS).

### v1.2.0
  * Replaced the single-color symbolic panel icon with three dedicated full-color state icons: grey (Disconnected), white outline with a green center (Connecting), and all green (Connected).

### v1.1.1
  * Fixed status detection: the client's "state = STATE_AUTHENTICATED" field was being misread as "connecting" because a loose fallback regex matched "authenticat" in "AUTHENTICATED". Status is now parsed from the explicit STATE_* field first.
  * Strip ANSI color escape codes from the client's output before parsing/logging/copying, so matching and debug output are clean.

### v1.1.0
  * Added a "Debug mode" setting: logs every `cato-sdp` invocation (command, exit code, stdout/stderr) to Cinnamon's log.
  * Added a "Copy Debug Info" menu entry (visible when debug mode is on) to copy recent command history to the clipboard.
  * Failed `start`/`stop` commands now always show an error notification with the first line of the client's output, in addition to being logged.
  * `status` parsing now also recognizes "no active connection" as disconnected.

### v1.0.0
  * Initial release: connect/disconnect/status for the Cato SDP Linux client, with panel icon status and desktop notifications.
