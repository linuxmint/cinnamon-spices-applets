# Pacman Workspace Switcher

A Cinnamon panel applet that replaces the standard workspace switcher with Pac-Man themed icons.

- The **active workspace** shows an animated Pac-Man (mouth opens and closes).
- **Inactive workspaces** show classic ghosts: Blinky (red), Pinky (pink), Inky (cyan) and Clyde (orange) — or pac-dots if you prefer a cleaner look.
- Small **window-count dots** appear below each inactive workspace icon showing how many windows are open there.

## Features

- Animated Pac-Man mouth (can be disabled)
- Classic ghost colors per ghost (Blinky, Pinky, Inky, Clyde) or a single custom color
- Optional pac-dot mode instead of ghosts
- Window count indicator dots (up to 5)
- Configurable grid: columns × rows
- Mouse scroll to switch workspaces (by column or by row)
- Full color customization: Pac-Man color, ghost color, ghost eye color, pac-dot color
- Icon size and spacing controls

## Installation

### From Cinnamon Spices (recommended)
Search for **"Pacman Workspace Switcher"** in *System Settings → Applets → Download*.

### Manual
```bash
git clone https://github.com/TegoSavage/Arcade-Workspace-Switcher ~/.local/share/cinnamon/applets/pacman-workspace@tegouwu
```
Then right-click the panel → *Add applets to the panel* → find **Pacman Workspace Switcher**.

## Configuration

Right-click the applet → **Configure...**

| Setting | Description |
|---------|-------------|
| Columns / Rows | Grid size (creates/removes workspaces automatically) |
| Mouse scroll | Switch by column or by row |
| Icon size | 14–52 px |
| Spacing | Gap between icons |
| Animate Pac-Man | Enable/disable mouth animation |
| Show ghosts | Toggle between ghost mode and pac-dot mode |
| Classic ghost colors | Each ghost gets its Pac-Man arcade color |
| Ghost color / Eye color | Custom colors when classic mode is off |
| Pac-dot color | Color of the dots in pac-dot mode |
| Window count dots | Show how many windows are open per workspace |



## Requirements

- Cinnamon 4.6 or newer


## Discleimer

- This project is inspired by classic arcade aesthetics.
Pac-Man is a registered trademark of Bandai Namco Entertainment.
This project is not affiliated with or endorsed by Bandai Namco.

## License

- MIT LICENSE
