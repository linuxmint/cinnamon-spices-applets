# DDC/CI Multi-Monitor

A Cinnamon applet that lets you adjust brightness of external monitors via DDC/CI.

## Requirements

In order to function correctly this applet requires `ddcutil`.

It can be installed following these steps:

1. Install **ddcutil** and **i2c-tools** using:

   ```bash
   sudo apt install ddcutil i2c-tools
   ```

2. To let **ddcutil** work without requiring root priviledges, the user must be
   part of the **i2c** group. Run the following command to add the current user
   to the **i2c** group.

   ```bash
   sudo usermod -aG i2c $USER
   ```

   After having executed the command, log out to apply the new configuration.

More information on how to install **ddcutil** can be found
[here](https://askubuntu.com/questions/894465/changing-the-screen-brightness-of-the-external-screen#1181157)
in section "Tool 2".

You can check if **ddcutil** has been installed correctly and the monitor
supports the DDC/CI protocol running:

```bash
ddcutil capabilities
```

## Configuration

The applet provides several configuration options, accessible through the **Applet Settings**:

* **Applet Label**

  * Customize the label text shown in the panel.

* **Brightness Step Size**

  * Adjust the increment/decrement step (in %) when scrolling on the applet icon.

* **Toggle Points (Middle-Click Support)**

  * Enable up to three user-defined brightness levels.
  * Cycle through these levels by middle-clicking the applet icon.

* **Selected Monitor Mode**

  * Restrict brightness adjustments (scrolling and middle-click toggles) to selected monitors.
  * Useful for setups where only specific monitors should be controlled by this instance of the applet.

All of these options are **optional**. By default, the applet behaves as in earlier versions: scrolling adjusts brightness in fixed steps across all detected monitors.

---