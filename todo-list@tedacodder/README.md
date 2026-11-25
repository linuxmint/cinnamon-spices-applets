# Todo List

A prioritized todo list in your Cinnamon panel. The panel icon shows how many tasks
are ongoing, coloured by the most urgent one. Open the list with a click or with
**Ctrl+Alt+D**. Everything works from the keyboard.

## Features

- Four priorities: Critical, High, Medium and Low, each with its own colour.
- Four tabs: Daily, Backlog, Ongoing and Completed.
- Daily tasks reset to incomplete on the next day. Their text is kept.
- Search, edit, complete, park, start, and remove tasks.
- Six themes: Neon, Omarchy, Ember, Paper, Sakura and Lagoon. The choice is saved.
- Keyboard-only use. Press `t` to change theme and Escape to close.

## Usage

| Action | How |
| --- | --- |
| Open | Click the panel icon, or press Ctrl+Alt+D |
| Close | Click **Close**, click outside the window, or press Escape |
| Add a task | Press `n`, type, then press Enter |
| Search | Press `/` |
| Complete a task | Press `c` on a focused row |
| Remove a task | Press `x` on a focused row |

Use Tab and Shift+Tab to move between controls. Use Up and Down to move between rows.

## Keyboard shortcut

Ctrl+Alt+D opens and closes the list while the applet is on the panel. You can
change the key by editing `HOTKEY` in `applet.js`.

## Privacy

Your tasks are stored only on your computer, in
`~/.local/state/todo-list/todos.json`. The applet makes no network connections and
does not collect any data.

## Requirements

- Cinnamon 5.8 or later.

## Known limitations

- Changes made to `todos.json` by another program appear after Cinnamon restarts.
- The panel icon's critical colour depends on Cinnamon exposing the icon to applets.
  If it does not, the icon keeps its normal colour.

## Troubleshooting

Check the Cinnamon log for messages from the applet:

```
grep "todo-list" ~/.xsession-errors | tail -20
```

If Ctrl+Alt+D does nothing, make sure the applet is on the panel, and restart
Cinnamon.

## Licence

Copyright (c) 2026 tedacodder. Released under the MIT License. See `LICENSE`.

Portions are derived from check_ur_todo and omarchy-priority-todos, both MIT
licensed. The upstream licence text is kept unchanged in `LICENSE-third-party.txt`.

## Credits

Based on check_ur_todo by Aston Lewis, which is based on omarchy-priority-todos by
Dejan V.
