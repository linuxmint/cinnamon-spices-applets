# Stock Tracker

A clean, configurable, minimalist stock ticker applet for the Cinnamon panel.

It cycles through your watchlist one symbol at a time in the panel — the symbol
keeps your panel's default text colour while the price and change are tinted
green for gains and red for losses. Click it to open a tidy popup that lists
every tracked stock with its current price, day's change, and a mini intraday
chart.

![Stock Tracker icon](icon.png)

## Features

- Rotating panel ticker — one symbol at a time, so it stays compact even on a narrow panel.
- Detail popup with per-stock mini charts (sparklines) drawn natively, no images.
- Configurable refresh interval, rotation speed, decimals, and chart range.
- Show change as a percentage, an absolute value, or both.
- Optional colour coding — gains in green, losses in red, with the ticker symbol kept in your panel's default colour (can be turned off for a flat look).
- No API key and no account required.
- Graceful failure: if a request fails, the applet keeps the last good price and shows a clear status instead of breaking.

## Requirements

- Cinnamon 6.0 or newer (tested against the 6.x series on Linux Mint 22.x).
- **curl** — used for all network requests (see *Data source* below for why).
  It is preinstalled on most distributions; if missing, install it with
  `sudo apt install curl`.
- An internet connection.

## Installation

### Manual

1. Copy the `stocktracker@hololand` folder into:

   ```
   ~/.local/share/cinnamon/applets/
   ```

   so that the path becomes:

   ```
   ~/.local/share/cinnamon/applets/stocktracker@hololand/
   ```

2. Right-click the Cinnamon panel → **Applets**.
3. Find **Stock Tracker**, select it, and click the **+** (add) button.

To configure it, select it in the Applets list and click the gear icon, or
right-click the applet in the panel → **Configure**.

## Configuration

| Setting | What it does |
| --- | --- |
| Watchlist | The symbols to track. Use the exact Yahoo Finance ticker (e.g. `AAPL`, `MSFT`, `SPY`, `BRK-B`). The display name is an optional label. |
| Show symbol in panel | Toggle the ticker symbol next to the price. |
| Change display | Percent, absolute, or both. |
| Color coding | Green for gains, red for losses. |
| Decimal places | Price precision. |
| Rotation interval | Seconds each symbol is shown before rotating. |
| Refresh interval | How often prices are fetched (default 60s). |
| Chart range | Time window for the popup sparklines (1 day to 1 year). |
| Show charts | Turn the popup mini charts on or off. |

## Data source

Prices come from Yahoo Finance's `v8/finance/chart` endpoint. No API key is
required, but Yahoo's API now blocks non-browser TLS fingerprints and requires a
session cookie plus a "crumb" token. To work around this the applet:

- makes requests via **curl** with a browser-matched TLS cipher order;
- performs a cookie → (consent, where applicable) → crumb handshake on first
  use and caches the result, reusing it across refreshes and restarts.

This is the same approach the community "Yahoo Finance Quotes" desklet uses.
Note that this is an **unofficial** endpoint: Yahoo changes it periodically
(historically once or twice a year), and when they do, the applet may need an
update. It degrades gracefully in the meantime — showing the last successful
values and a clear status line rather than breaking.

This applet is not affiliated with or endorsed by Yahoo. Market data is provided
for informational purposes only and is not investment advice. Prices may be
delayed.

## Troubleshooting

- **"No data" / dashes:** check the symbol spelling, your internet connection,
  and that the market data is available for that ticker on Yahoo Finance.
- **Nothing updates:** look in `~/.xsession-errors` or run
  `Looking Glass` (Cinnamon's debugger, `Alt`+`F2` → `lg`) and check the
  Log tab for lines tagged `[stocktracker@hololand]`.
- **Reload after editing code:** `Alt`+`F2` → `r` restarts Cinnamon.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
