# Mouse Power Saver

Mouse Power Saver is a Cinnamon panel applet by DoctorShoe.

It controls USB mouse autosuspend from the Cinnamon panel.

## Motivation

Mouse Power Saver was originally created to solve a practical fullscreen streaming problem with very sensitive USB mice.

When watching video streams in Firefox or other browsers, even tiny unwanted mouse activity can make the video control bar appear again and again. This is especially annoying during fullscreen playback, for example when watching public broadcaster streams or other online video services.

The applet helps by putting the USB mouse into power-saving mode after a short delay. While the mouse is suspended, accidental sensor activity no longer keeps disturbing the video playback. A click wakes the mouse again when needed.

For normal desktop work, writing, gaming, or other situations where mouse standby is inconvenient, the applet can be switched off quickly from the Cinnamon panel.

The additional Touchpad Guard options are included because laptop touchpads can cause similar accidental pointer activity.

## Features

- Left click toggles mouse power saving on/off
- Green icon: power saving active
- Red icon: normal mode / off
- Right-click menu with:
  - Off / normal mode
  - 10 seconds
  - 20 seconds
  - 30 seconds
  - 1 minute
- Optional Touchpad Guard
- Persistent settings through udev
- Checkmarks show the active mode

## Notes

Some USB mice wake up by movement. Others wake up only by clicking a mouse button.

In video players, left click may pause playback. Middle-click may be better for waking the mouse.

Bluetooth mice and some wireless receivers may not be supported.

## Tested on

- Linux Mint Cinnamon
- Cinnamon 6.6.7
- Sunplus USB Optical Mouse 1bcf:0005

## Installation

Run:

    cd ~/mouse-power-saver-release/mouse-power-saver@doctorshoe
    ./scripts/install.sh

Then reload Cinnamon:

    Alt + F2
    r
    Enter

Then add the applet from the Cinnamon panel applets menu.

## Uninstallation

Run:

    cd ~/mouse-power-saver-release/mouse-power-saver@doctorshoe
    ./scripts/uninstall.sh

## Security

The installer creates a limited sudoers rule.

It allows only these commands without a password:

    /usr/local/bin/mouse-power-saver on 10000
    /usr/local/bin/mouse-power-saver on 20000
    /usr/local/bin/mouse-power-saver on 30000
    /usr/local/bin/mouse-power-saver on 60000
    /usr/local/bin/mouse-power-saver off

It does not grant general passwordless sudo access.
