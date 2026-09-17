# Antigravity Usage Monitor

A Cinnamon panel applet that shows how much of your Google Antigravity quota you
have used, without opening a terminal.

```
   2% (1:45)  ◬  11%
   └─ 5h ──┘  ▲  └─ weekly
              agy icon
```

## Features

- 5-hour and weekly usage percentages in the panel, with the time left until the
  5-hour window resets
- Colour-coded: green below 70%, yellow from 70% to 85%, red above 85%
- Tooltip shows both model groups (Gemini and Claude/GPT), their reset times and
  the age of the data
- Switchable panel group: Gemini or Claude/GPT
- Left click forces an immediate refresh
- When a refresh fails, the last known values stay on the panel in yellow and the
  tooltip says how old they are

## Requirements

- Google Antigravity installed and signed in; the applet runs its `agy`
  command-line tool
- `agy` on `PATH` or in `~/.local/bin`; otherwise set the path in the applet
  settings

The applet makes no network calls of its own. It runs
`agy -p "/usage" --output-format json` in the background and reads the result.
The call consumes no tokens and needs no running IDE.

## Settings

| Setting | Default | Description |
|---|---|---|
| Update interval | 5 minutes | How often the applet runs `agy` |
| Model group on panel | Gemini | Which group of limits appears on the panel; the tooltip always shows both |
| Path to the agy binary | empty | Set this when `agy` is not on `PATH` or in `~/.local/bin` |

## Notes

The numbers are **usage**, not remaining quota: `agy` reports the fraction left,
the applet displays `(1 - remaining) x 100` so the values mean the same thing as
in Claude Usage Monitor next to it on the panel.

## Credits

Based on [claude-usage@mtwebster](https://cinnamon-spices.linuxmint.com/applets/view/435)
by Michael Webster. The panel layout, settings wiring and colour classes follow
that applet; the data source, parsing, caching and error handling are new.

## License

GPL-3.0-or-later.

[Changelog](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/agy-usage@rawendil/CHANGELOG.md)
