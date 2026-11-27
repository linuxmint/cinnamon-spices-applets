# Traydeck

A clean, customizable home for your tray icons.

Traydeck replaces the stock **System Tray** and **XApp Status** applets. It hosts both
kinds of tray icon (XApp status icons, including StatusNotifier apps such as Tailscale,
NordVPN or Dropbox, and legacy XEmbed icons) in one place and lets you manage them.

## Features

- **Show / Overflow / Hide** for every icon. Overflow tucks an icon into a popup behind
  a small chevron button.
- The chevron is always visible and its popup has **Manage icons…** and **Settings**.
- **Reorder** icons with up/down arrows.
- **Icon size**: match the panel, or set 12-48 px. **Spacing** between icons.
- Rounded hover highlight, optional app text labels.
- Icons that are not running stay listed (dimmed) so you can set them up in advance.
- Settings are kept per icon by the program that owns it, so they survive restarts.
- Keeps the screen-recording indicator the stock XApp applet shows.

## Using it

Remove *System Tray* and *XApp Status* from your panel and add *Traydeck* in their place.
Then click the chevron and choose **Manage icons…**, or right-click the tray and choose
**Manage tray icons…**.

Only one instance is allowed, because the legacy tray protocol can only have one owner.

## About this applet

Traydeck is vibe coded: it was written with the help of an AI coding assistant. I saw
an opportunity to improve Cinnamon's notification area (the tray), and I used the tools
I had available to fill the gap. I have tested it as much as I can on my own desktop
(Cinnamon 6.8), but please report anything that misbehaves.
