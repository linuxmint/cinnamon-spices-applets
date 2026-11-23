# Bing Daily — Cinnamon Applet

Sets your desktop wallpaper to the **Bing Image of the Day**, every day — fetched exclusively via the [Peapix API](https://peapix.com). No connection to `bing.com` is ever made.

![Bing Daily in panel](screenshots/applets.png)

---

## Features

- 🖼 **Daily wallpaper** — automatically fetches and sets the Bing Image of the Day
- 🌍 **Region selection** — choose your region for locally relevant images and cultural events (e.g. July 4th in the US, Cherry Blossom season in Japan, Diwali in India)
- 📅 **Flexible frequency** — update daily, weekly, or monthly
- 🕐 **Custom update time** — choose what time of day the refresh runs
- 🕘 **Image history** — browse backwards and forwards through past wallpapers
- 📦 **Populate History** — bulk-download the last ~8 days in one click
- 🗑️ **Clear All Images** — wipe the local cache from the menu
- 🔒 **Privacy first** — zero Microsoft connections, zero telemetry
- ⚙️ **systemd timer** — reliable background scheduling, no polling loops
- 🐍 **Zero dependencies** — Python 3 stdlib only, nothing to `pip install`
- 🎨 **Symbolic icon** — follows your panel theme, light or dark

---

## Requirements

| Component | Provided by |
|-----------|-------------|
| Linux Mint 21.x or 22.x with Cinnamon | — |
| Python 3 (stdlib only) | Pre-installed on all Ubuntu/Mint |
| systemd (user session) | Pre-installed on all Ubuntu/Mint |
| `gsettings` | Pre-installed with Cinnamon |

No additional packages need to be installed.

---

## Install

### Via Cinnamon Spices (recommended)

1. Right-click your Cinnamon panel → **Applets**
2. Go to the **Download** tab
3. Search for **Bing Daily** → click **Install**
4. Switch to the **Manage** tab → find **Bing Daily** → click **+**
5. Click **Done**

### Manual install

```bash
git clone https://github.com/keithdriscoll/bing-daily.git
cd bing-daily
bash install.sh
```

Then add the applet to your panel:

1. Right-click your Cinnamon panel → **Applets**
2. Find **Bing Daily** → click **+**
3. Click **Done**

---

## Applet Menu

| Item | Action |
|------|--------|
| Refresh Now | Fetch today's image immediately |
| ◀ Previous Image | Switch to a newer image in history |
| ▶ Next Image | Switch to an older image in history |
| Open Current Image | Open the image in your default viewer |
| Image Info | Show title and copyright of the current image |
| Populate History | Bulk-download the last ~8 days of images |
| Clear All Images | Remove all cached wallpapers from disk |
| Settings | Open the applet settings panel |
| About | Show version info and open project page |

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Auto-update | On | Enable/disable automatic refresh |
| Frequency | Daily | How often to fetch a new image (Daily / Weekly / Monthly) |
| Update time | 08:00 | Time of day for automatic refresh |
| Region | Global | Region for image selection — affects local holidays and cultural imagery |
| History limit | 30 | Maximum number of wallpapers to keep on disk |

### About Region

Bing curates daily images around local events, national holidays, and cultural moments. Selecting your region means you'll see imagery that's actually relevant to where you live:

- 🇺🇸 **United States** — Independence Day, Thanksgiving, national parks
- 🇯🇵 **Japan** — Cherry blossom season, national holidays
- 🇮🇳 **India** — Diwali, Holi, local landmarks
- 🌍 **Global** — Bing's worldwide pick, no regional bias

---

## Privacy

- **No connection to Microsoft** — images are fetched exclusively via [Peapix](https://peapix.com/api), never from `bing.com`
- **No telemetry** — nothing phoned home, ever
- **URL parameters stripped before logging** — no identifying data in `log.txt`
- **All data stored locally** — `~/.cache/bing-daily/` only

---

## File Locations

| Path | Contents |
|------|----------|
| `~/.local/share/cinnamon/applets/bing-daily@keithdriscoll.nyc/` | Applet code |
| `~/.cache/bing-daily/` | Downloaded images and history |
| `~/.cache/bing-daily/log.txt` | All events and errors |
| `~/.cache/bing-daily/history.json` | Image metadata history |
| `~/.config/bing-daily/config.json` | User settings |
| `~/.config/systemd/user/bing-daily.{service,timer}` | systemd units |

---

## Troubleshooting

**Read the log:**
```bash
tail -f ~/.cache/bing-daily/log.txt
```

**Check the timer:**
```bash
systemctl --user status bing-daily.timer
```

**Manual refresh:**
```bash
python3 ~/.local/share/cinnamon/applets/bing-daily@keithdriscoll.nyc/engine/bing_engine.py refresh
```

**Wallpaper not changing after refresh:**
```bash
gsettings get org.cinnamon.desktop.background picture-uri
```

**Applet not loading:**
```bash
grep -i bing ~/.xsession-errors
```
Then reload Cinnamon: `Alt+F2` → type `r` → Enter.

**Note:** The systemd service waits 30 seconds after boot before running, to allow the network to come up. This is normal — the wallpaper will update shortly after login.

---

## Uninstall

```bash
systemctl --user disable --now bing-daily.timer
rm ~/.config/systemd/user/bing-daily.{service,timer}
systemctl --user daemon-reload
rm -rf ~/.local/share/cinnamon/applets/bing-daily@keithdriscoll.nyc

# Optional: remove cached images
rm -rf ~/.cache/bing-daily
```

---

## License

MIT — © 2026 Keith Driscoll · [keithdriscoll.nyc](https://keithdriscoll.nyc)
