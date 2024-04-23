# Monitor Input Source
A cinnamon applet that allows you to change the input source your monitors are using.

Perfect for people who have two computers connected to different input sources on a monitor.
Quicker and easier then reaching for the buttons on the monitor

This applet uses [ddcutil](https://www.ddcutil.com/) to communicate with your monitor, sending commands
to your monitors to retrieve status and to change settings.

## Features

1. Change the input source for each monitor attached to your PC with just 2 mouse clicks
2. Check-mark icon on input menu items indicating which input sources are currently active
3. Assign quick actions to enable switching monitor inputs with a single panel icon click

### How to define a Quick Action

Open the menu (left-click).
Click on the desired input source using one of the following mouse buttons (with optional modifier keys):
1. Middle, Forward or Back mouse buttons
2. Shift or Control key and any mouse button
3. Shift and Control keys and any mouse button

Once a quick action has been defined, the tool-tip text for the panel button will show all the active quick action options.
Now you can use the quick action(s) you defined on the MonitorInputSource panel icon to change to the selected input with a single click.

### Menu Item Descriptions

#### DisplayPort/HDMI/DVI/VGA
These menu items represent the inputs attached to your monitors. Left-click these menu items to direct the monitor to switch
to that input source (by using the "ddcutil setvcp 60" command). You can also click these menu items to define quick actions (See above).

#### Clear monitor cache
A cache is maintained to avoid re-running ddcutil queries for input sources. This option will clear this cache so the next
refresh of the monitor list will take a bit longer but if there is some issue with the cached values then this should fix it.

#### Clear quick actions
All the quick actions that you have previously defined will be cleared. This is useful when you have defined a quick action that
you would like to remove. There is no way to clear just one quick action.

#### Refresh
This menu item will clear the monitor list and re-run "ddcutil detect" to obtain a current list of attached monitors. The monitor
cache is then used to get the input list for each monitor. If there is no cache entry for a specific monitor, the "ddcutil capabilities"
command is run to get a list of inputs for the new monitor and the results are added to the cache.

## Requirements
The [ddcutil](https://www.ddcutil.com/) package must be installed for this applet to operate correctly. It's best to install ddcutil 2.0
or better for optimal ease of use and performance, but older versions will work fine if you follow the instructions below.

```
sudo apt-get install ddcutil
```

If your package repository does not currently offer ddcutil 2.0 or better (i.e Mint 21.2 and older) then you
will need to add your user to the i2c group and then logout and back in again for the change to take effect:

```
sudo groupadd --system i2c  #If the group does not exist yet
```
```
sudo usermod -G i2c -a $USER
```
See: https://www.ddcutil.com/i2c_permissions/

Even better, install ddcutil 2.0:

See: https://www.ddcutil.com/install/

or build from the source:

https://www.ddcutil.com/building/

Once properly setup you should see information about your monitor(s) when running this command:

```
ddcutil detect
```

If you get errors running that command, you might get some clues about what is wrong by running:

```
ddcutil environment
```

## Installation
1. Right click on the cinnamon panel that you wish to add MonitorInputSource to and then click "Applets"
2. Click on the "Download" tab and select "Monitor Input Source" and then click the install button on the right
3. Click on the "Manage Tab"
4. Select the "Monitor Input Source" entry and then click the "+" button at the bottom of the Applet window
5. Right click on the cinnamon panel and use "Panel edit mode" to enable moving the applet within the panel
6. Click "Panel edit mode" again to disable edit mode once you have placed the applet icon where you like

## Feedback
You can leave a comment here on cinnamon-spices.linuxmint.com or you can create an issue on my development GitHub repository:

https://github.com/klangman/MonitorInputSource

This is where I develop new features or test out any new ideas I have before pushing to cinnamon-spices.
