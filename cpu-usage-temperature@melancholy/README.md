# CPU Usage and Temperature

Cinnamon applet that shows CPU usage and CPU temperature in one panel label:

```text
CPU: 2%
Temp: 55°C
```

It keeps the simple text/hover behavior from `cpu-monitor-text@gnemonix` and the temperature behavior from `temperature@fevimu`. CPU usage is read from `/proc/stat`; temperature is read from `sensors` when available, with Linux thermal files as a fallback.

When `sensors` reports high or critical thresholds, the applet menu shows them and the panel background can turn orange for high temperature or red for critical temperature.

The settings let you switch to the single-line layout, customize CPU and temperature labels, choose left/center/right text alignment, change the font size, customize the single-line separator, and change the high/critical alert colors.

## Local Test

From this repository:

```bash
cp -r cpu-usage-temperature@melancholy/files/cpu-usage-temperature@melancholy ~/.local/share/cinnamon/applets/
cinnamon-dbus-command ReloadXlet cpu-usage-temperature@melancholy APPLET
```

Then open System Settings -> Applets, search for "CPU Usage and Temperature", and add it to the panel.

If `sensors` is not installed:

```bash
sudo apt install lm-sensors
sudo sensors-detect
```

## Credits

- Temperature behavior is based on `temperature@fevimu`.
- CPU usage behavior is based on `cpu-monitor-text@gnemonix`.
- Icon: `cpu-x` from the Papirus icon theme by the Papirus Development Team, licensed under GPL-3.

## License

GPL-3. See `LICENSE`.
