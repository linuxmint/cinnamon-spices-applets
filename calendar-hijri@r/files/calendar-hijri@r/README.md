# Calendar with Hijri

A fork of the Cinnamon calendar applet (`calendar@cinnamon.org`) with an optional Islamic (Hijri) date display.

## Features

- All original Cinnamon calendar functionality (events, week numbers, custom formats)
- Optional Hijri date shown below the Gregorian date in the calendar popup
- Offline Umm al-Qura algorithm — no internet required


## Install

```bash
git clone https://github.com/sporteka2/calendar-hijri
cp -r calendar-hijri ~/.local/share/cinnamon/applets/calendar-hijri@r
```

Then reload Cinnamon (**Ctrl+Alt+Esc**) and add "Calendar with Hijri" to your panel via **Applets** settings.

## Usage

Right-click the applet → **Configure** → enable **Show Islamic (Hijri) date**.

The Hijri date appears in the calendar popup header:
```
Monday
June 30, 2026
15 Muharram 1448 AH
```

## Hijri algorithm

Uses the official Saudi **Umm al-Qura** calendar (KACST) — the civil lunar
calendar of Saudi Arabia. The implementation is a Reduced Julian Day (RJD)
month-start table:
- For every Hijri month (1318–1500 AH, i.e. 1900–2077 CE) the RJD of its first
  day is stored in a lookup array
- A Gregorian date is resolved by a binary search over that table
- Matches the Saudi Umm al-Qura calendar without needing astronomical
  observation or an internet connection
- Example: 1 Muharram 1446 AH = July 7, 2024 CE

The conversion core is maintained as a standalone library, reused here
unchanged (only a small GLib adapter is inlined in `applet.js`):

- Library: **hijri** — <https://codeberg.org/sporteka/hijri>
- Install from npm/Codeberg: `npm install git+https://codeberg.org/sporteka/hijri.git`

## Files

| File | Description |
|------|-------------|
| `applet.js` | Main applet logic (includes the GLib adapter for `hijri.js`) |
| `calendar.js` | Calendar widget (original) |
| `eventView.js` | Events management (original) |
| `hijri.js` | Umm al-Qura conversion (RJD month-start table) — from the [`hijri`](https://codeberg.org/sporteka/hijri) library |
| `settings-schema.json` | Settings definitions |
| `metadata.json` | Applet metadata |
