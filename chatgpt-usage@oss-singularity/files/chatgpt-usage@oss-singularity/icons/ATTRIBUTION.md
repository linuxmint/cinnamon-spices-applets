# Bundled action icons

## Original project artwork

`applet.svg`, `usage.svg`, `chat-bubble.svg` and `terminal-bot.svg` were drawn
for OSS Singularity as original geometric artwork. They are licensed under
GPL-3.0-or-later, as are the PNGs rendered from them: `../icon.png`,
`usage-white.png` and `terminal-bot.png`. The robot is a terminal-themed project
character, not the Codex desktop sprite. No OpenAI knot or character is included.

Reproduce the PNGs with `python3 scripts/render-icons.py` in the source
repository; `--check` verifies their correspondence to the editable SVGs.

## Yaru Icons

The following unmodified symbolic SVGs come from [Ubuntu Yaru](https://github.com/ubuntu/yaru),
as shipped by `yaru-theme-icon` version `24.04.2-0ubuntu1`:

- `view-refresh-symbolic.svg` — Refresh now
- `utilities-system-monitor-symbolic.svg` — Analytics
- `web-browser-symbolic.svg` — ChatGPT and Codex Cloud
- `emblem-ok-symbolic.svg` — Updated confirmation

Yaru Icons — Copyright 2018 [Sam Hewitt](https://snwh.org/). Licensed under
[Creative Commons Attribution-ShareAlike 4.0 International](LICENSE-CC-BY-SA-4.0.txt).
The files are copied unchanged from Yaru's `scalable/actions`, `scalable/apps`
and `scalable/emblems` directories. Cinnamon still applies symbolic foreground
colors to fit the popup theme; the icon artwork no longer depends on the
installed system icon theme.

This attribution applies to the four SVG files listed above.

Source revision: Yaru 24.04.2, commit
[`18b443818c0e5fed138bb4f43aff595b3e095951`](https://github.com/ubuntu/yaru/tree/18b443818c0e5fed138bb4f43aff595b3e095951/icons).
The upstream filenames for the two app aliases are
`system-monitor-app-symbolic.svg` and `webbrowser-app-symbolic.svg`.
All four bundled SVGs were verified byte-for-byte against that revision.
