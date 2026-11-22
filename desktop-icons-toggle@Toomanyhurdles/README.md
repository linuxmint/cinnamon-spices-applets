# Desktop Icons Toggle

A panel toggle switch that hides and shows your desktop icons, with a
right-click menu for switching the desktop to a solid colour background.

## Why use it

It is handy when you record your screen. One click hides your desktop icons, and one more sets a plain colour background. Your video looks clean, and viewers cannot see your personal files and folders. When you finish, one click brings everything back.

## Usage

**Left click** the applet to hide or show the desktop icons. The panel icon is
a toggle switch: filled with the knob on the right when icons are shown,
outlined with the knob on the left when they are hidden.

**Right click** for the menu:

- **Show desktop icons** - the same toggle, as a switch.
- **Solid colour background**
  - **My colour** - applies your saved colour.
  - **Choose a colour...** - opens a colour picker, saves the result as
    "My colour" and applies it.
  - Nine preset colours.
- **Restore wallpaper** - puts your picture background back as it was.

"My colour" can also be set from the applet's settings (right click >
Configure).

## How it works

- Desktop icons are toggled through the `org.nemo.desktop` `desktop-layout`
  setting, the same one used by System Settings > Desktop. The previous layout
  (for example, icons on all monitors) is remembered and restored.
- The solid colour is applied through `org.cinnamon.desktop.background`. The
  previous picture mode is remembered so "Restore wallpaper" can put it back.
- If a wallpaper slideshow is running it is paused while a solid colour is
  applied, and resumed by "Restore wallpaper".

## Requirements

- Cinnamon with Nemo managing the desktop (the default on Linux Mint).
- `zenity` for the "Choose a colour..." dialog. It is installed by default on
  Linux Mint. Without it, the applet opens its settings page instead, which has
  its own colour button.

## Tested on

- Linux Mint 22.3 "Zena", Cinnamon 6.6.9
