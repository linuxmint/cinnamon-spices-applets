# ChatGPT Limits

A minimal read-only Cinnamon applet showing the remaining quota and reset
countdown for the short-term (5h) and weekly (7d) Codex limits returned by
ChatGPT. The panel shows configurable vertical gauges, the popup shows one
card per limit window with the exact reset time.

## Requirements

- Cinnamon 6.6 or newer
- Python 3
- An installed Codex CLI signed in with ChatGPT

The applet sends only `account/rateLimits/read` to the local Codex app-server.
It does not read credential files, store history, redeem reset credits, send
notifications or open web links.

## Features

- Panel gauges for 5h quota, 5h cycle time, 7d quota and 7d cycle time, with
  configurable visibility and order
- Color theme presets (dark and light) plus fully manual colors
- Custom panel font, bar sizes, margins, corner radius and text direction
- Popup cards with remaining quota, relative countdown and exact reset time
  (with date when the reset falls on another day)
- Displayed times are frozen at the moment the data was fetched and update on
  every refresh
- Last good data is cached, so a restart never starts with an empty panel; a
  failed refresh keeps the stale data with a `!` marker on the panel and a
  connection error message in the popup

## Reliability

- A 20-second watchdog (with SIGKILL escalation) stops an unresponsive
  backend request so the applet cannot remain in the refreshing state
  indefinitely
- A failed refresh schedules a quick retry after 30 seconds instead of
  waiting for the full refresh interval
