# Syncthing Cinnamon

A Cinnamon applet to check the status of the running Syncthing instance. 

## Functions 

It has very basic functions, i.e. it can:

- place and update a panel icon according to the Syncthing status
- show a tooltip with the current status
- display a menu with basic Syncthing controls (open web UI, start/stop/restart, and show the log)

Configuration options:
- applet update interval (see below)
- syncthing command-line binaries and arguments
- web UI URL and port

## Notes

**It's my very first applet**, so there might be rough edges and the solutions are rudimental for now :)

It currently works only with Syncthing commands, meaning that that it should work equally when Syncthing runs as a standalone program (e.g. autostarted by Cinnamon) or as a systemd service. At the same, it's slightly 'dirty' (it uses timed bash commands for checking the status). 

** **Note that decreasing the applet update interval**, though limited to 0.5s, **might possibly slow down your computer**. Try it on your own system.

See [here](https://docs.syncthing.net/users/autostart.html#linux) for the autostart options and [the Syncthing website](https://syncthing.net/) for further documentation on Syncthing.

Full support for the systemd service - which should bring a sensible improvement in performance and capabilities - is planned but will be coming with time.

Not that all Syncthing configuration is demanded to its own web interface or command line - integration in the applet is not really possible -, as are all details/information on devices and synced folders. 
