# Country Clock Cinnamon Applet

Country Clock is a Cinnamon applet for Linux Mint. It shows the current time in another country or time zone, with either a bundled SVG flag icon or a country code in the panel.

## Features

- Preset countries and cities, including Bolivia - La Paz.
- Custom IANA time zone support, such as `Asia/Tokyo`.
- Bundled SVG flags for consistent color rendering in the Cinnamon panel.
- Optional country codes for users who prefer text instead of flags.
- 24-hour and AM/PM formats.
- Optional tooltip with the active time zone.

## Installation

1. Copy the applet folder into your local Cinnamon applets directory:

   ```sh
   mkdir -p ~/.local/share/cinnamon/applets
   cp -r files/world-clock-country@dennguez ~/.local/share/cinnamon/applets/
   ```

2. Reload Cinnamon:

   ```sh
   cinnamon --replace
   ```

   You can also log out and log back in.

3. Open **System Settings > Applets**.
4. Find **Country Clock** and add it to your panel.

## Configuration

Right-click the applet in the panel and select **Configure**.

Available settings:

- **Time zone**: choose a preset country/city or select **Custom**.
- **Custom time zone**: enter an IANA time zone such as `America/La_Paz`, `Europe/Madrid`, or `Asia/Tokyo`.
- **Custom flag image**: choose a local SVG or PNG when using a custom time zone.
- **Custom country code**: enter the text shown for a custom time zone when using country codes.
- **Country indicator**: choose `Flag` or `Country code`.
- **Time format**: choose `24-hour` or `AM/PM`.
- **Show time zone in tooltip**: show the selected time zone when hovering over the applet.

## Included Presets

- UTC
- Bolivia - La Paz
- Mexico - Mexico City
- United States - New York
- United States - Los Angeles
- Colombia - Bogota
- Peru - Lima
- Ecuador - Quito
- Chile - Santiago
- Argentina - Buenos Aires
- Uruguay - Montevideo
- Brazil - Sao Paulo
- United Kingdom - London
- Spain - Madrid
- France - Paris
- Germany - Berlin
- Italy - Rome
- Portugal - Lisbon
- India - Kolkata
- Thailand - Bangkok
- Japan - Tokyo
- China - Shanghai
- South Korea - Seoul
- Australia - Sydney
- New Zealand - Auckland

## Troubleshooting

If the applet does not appear or fails to load:

1. Make sure the folder name is exactly `world-clock-country@dennguez`.
2. Make sure the folder contains `metadata.json`, `applet.js`, `settings-schema.json`, and the `flags` directory.
3. Restart Cinnamon or log out and log back in.
4. Check Cinnamon logs:

   ```sh
   tail -n 200 ~/.xsession-errors
   ```

If a custom time zone is invalid, the applet falls back to UTC and reports the issue in the tooltip.
