# Linux Mint global microphone mute applet
## How to install
Just clone this repository and copy the `MuteToggler@jebeaudet.com` folder to `~/.local/share/cinnamon/applets/` and restart Cinnamon (`ALT+F2` -> `r` does that!). The applet should now be available in the Applets panel. Add it!

## How to use
There are 2 ways to toggle the global microphone mute, click on the applet icon or bind a hotkey in the settings.

If the icon is green, you're not muted.

If the icon is red, you're muted globally!

## How does it work
Under the hood, it uses the command `amixer set Capture toggle` to toggle between muted and unmuted. The command is triggered by the hotkey or by clicking on the applet. There's also a reconliation loop every second so if the command is executed from the shell directly, the applet will get in sync within the second to show you the real mute status.

## Logs 
Logs are located in the looking glass, `ALT+F2` -> `lg` to access it.
