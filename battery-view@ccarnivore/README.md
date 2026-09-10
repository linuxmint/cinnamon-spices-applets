# Solar Battery View

A Cinnamon panel applet that displays battery state of charge and power flow from a Fronius inverter via the Fronius Solar API v1.

## Features

- **Battery icon** with color-coded SOC (green/yellow/red) and charge direction arrows (>> charging, << discharging)
- **Solar panel icon** showing grid status: green >> (exporting), red << (importing), blue = (neutral)
- **SOC percentage** displayed as text between the icons
- **Tooltip** with detailed power flow information (battery, PV, grid)
- **Click to refresh** data immediately
- **Configurable** thresholds for SOC colors, PV production, and grid export/import significance
- **Charge alert**: system notification and/or fullscreen dialog when the battery reaches a configured SOC while charging
- **REST triggers**: calls a configurable endpoint when the battery starts charging from surplus, and a second one when the battery runs low while discharging (e.g. to switch a smart plug)

## Requirements

- A Fronius inverter (tested with Symo GEN24) accessible on the local network
- The Fronius Solar API v1 must be enabled (default on most models)
- A battery connected to the inverter (tested with BYD)

## Configuration

- **Inverter IP**: IP address of your Fronius inverter
- **Poll interval**: How often to fetch data (5-300 seconds, click applet for manual refresh)
- **SOC green threshold**: SOC percentage at or above which the battery icon turns green
- **SOC yellow threshold**: SOC percentage at or above which the battery icon turns yellow (below is red)
- **PV production threshold**: PV power below this value is considered inactive (filters noise at night)
- **Grid export/import threshold**: Grid exchange below this value is shown as neutral (filters insignificant values)

### Charge Alert

Alerts you once when the battery reaches a charge level. It only fires while the battery is
**charging**, never while discharging.

- **Alert when the battery reaches a charge level**: master switch
- **Alert at SOC**: the level that triggers the alert (default 100%)
- **Re-arm after SOC drops this far below the alert level**: hysteresis, default 5%. A full battery
  stops charging and gets topped up again whenever the sun comes out. Without this band, every
  top-up would fire a new alert. With the default, the alert only re-arms once SOC drops below 95%.
- **Alert type**: notification only, fullscreen dialog only, or both. The notification is a critical
  one, so it stays in the message tray until dismissed. The dialog is a modal fullscreen overlay
  that has to be acknowledged with OK.

### REST Triggers

Calls an HTTP endpoint when the battery changes between "charging from surplus" and "low and
discharging". Intended for controlling a smart plug: switch a consumer on while there is surplus
production, switch it off before the battery is drained.

- **Endpoint 1** is called when the battery charges with at least *Minimum charge power* watts.
- **Endpoint 2** is called when the battery discharges and SOC is below *SOC below which discharging
  triggers endpoint 2*.
- In between (neutral: idle battery, or discharging while still well charged) **nothing is called** -
  the plug keeps its last commanded state until the opposite condition is actually met.

Each endpoint takes a URL, a method (GET or POST), and an optional body plus content type for POST.
The **Test** buttons fire the call immediately, so you can verify the configuration without waiting
for the right weather. A test call does not change the remembered plug state.

Debouncing (solar power fluctuates heavily with passing clouds):

- Calls are **edge triggered**: an endpoint is called once on the state change, not on every poll.
- The condition must hold for **Confirm condition for this many polls** consecutive polls (default 3)
  before the call goes out.
- Charging only counts as surplus above **Minimum charge power** (default 100 W), which ignores trickle
  charging.
- The last successful action is persisted, so restarting Cinnamon does not re-fire it. A failed call is
  **not** persisted and is therefore retried on the next poll.

Example URLs:

| Device | On | Off |
|--------|----|-----|
| Shelly (Gen1) | `http://192.168.1.50/relay/0?turn=on` | `http://192.168.1.50/relay/0?turn=off` |
| Tasmota | `http://192.168.1.51/cm?cmnd=Power%20On` | `http://192.168.1.51/cm?cmnd=Power%20Off` |

## Icon Legend

### Battery Icon (right)
| Icon | Meaning |
|------|---------|
| Green >> | High SOC, charging |
| Green << | High SOC, discharging |
| Yellow >> | Medium SOC, charging |
| Yellow << | Medium SOC, discharging |
| Red >> | Low SOC, charging |
| Red << | Low SOC, discharging |
| Grey ? | Connection error |

### Solar Icon (left)
| Icon | Meaning |
|------|---------|
| Green >> | Significant grid export (production exceeds consumption) |
| Red << | Significant grid import (consumption exceeds production) |
| Blue = | Neutral (below configured thresholds) |
