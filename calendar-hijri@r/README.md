# Calendar with Hijri

A fork of the Cinnamon calendar applet (`calendar@cinnamon.org`) with an optional Islamic (Hijri) date display.

## Features

- All original Cinnamon calendar functionality (events, week numbers, custom formats)
- Optional Hijri date shown below the Gregorian date in the calendar popup
- Offline Kuwaiti algorithm — no internet required


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

Uses the Umm al-Qura (Kuwaiti) calendar via the official lookup table from
Microsoft's .NET `UmAlQuraCalendar`:
- Each Hijri year (1318–1500 AH, i.e. 1900–2077 CE) is stored as a 12-bit
  month-length mask together with the Gregorian date of 1 Muharram
- Matches the Saudi Umm al-Qura calendar without needing astronomical
  observation or an internet connection
- Example: 1 Muharram 1446 AH = July 7, 2024 CE

## Files

| File | Description |
|------|-------------|
| `applet.js` | Main applet logic |
| `calendar.js` | Calendar widget (original) |
| `eventView.js` | Events management (original) |
| `hijri.js` | Gregorian→Hijri conversion |
| `settings-schema.json` | Settings definitions |
| `metadata.json` | Applet metadata |
