# Startpage Search

A Cinnamon panel applet providing a Startpage search field. Click the
magnifier icon, type your query, press Enter: your default browser opens
on the Startpage results page.

![screenshot](screenshot.png)

## Why

Startpage (privacy-first meta-search engine: proxies Google results
without tracking) deserves a one-click launcher. This applet has zero
dependencies and behaves like any native panel applet: free positioning,
panel-height-aware icon, keyboard-first flow.

## Dependencies

None. Pure Cinnamon API (cjs, St toolkit).

## Installation

From Cinnamon System Settings -> Applets -> Download tab (once accepted
in the official spices), or manually:

```bash
mkdir -p ~/.local/share/cinnamon/applets/StartpageSearch@pzim-devdata
cp -r files/StartpageSearch@pzim-devdata/* \
 ~/.local/share/cinnamon/applets/StartpageSearch@pzim-devdata/
```

Then right-click the panel -> Applets -> add "Startpage Search".

## Usage

| Action | Result |
|----------------------|------------------------------------------|
| Left click on icon | Opens the popup, focuses the field |
| Type query + Enter | Browser opens on Startpage results |
| Esc | Closes the popup |

## Configuration

No configuration needed.
