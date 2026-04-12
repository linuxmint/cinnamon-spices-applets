# Solar Battery View

A Cinnamon panel applet that displays battery state of charge and power flow from a Fronius inverter via the Fronius Solar API v1.

## Features

- **Battery icon** with color-coded SOC (green/yellow/red) and charge direction arrows (>> charging, << discharging)
- **Solar panel icon** showing grid status: green >> (exporting), red << (importing), blue = (neutral)
- **SOC percentage** displayed as text between the icons
- **Tooltip** with detailed power flow information (battery, PV, grid)
- **Click to refresh** data immediately
- **Configurable** thresholds for SOC colors, PV production, and grid export/import significance

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
