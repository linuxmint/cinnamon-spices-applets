# Projekt IT Calendar

**Cinnamon Spices Applet** – A comprehensive calendar for Cinnamon with holidays, system events, and modern TypeScript architecture.  
Written in **TypeScript**, with modular compilation for development and production.

---

## 🌟 Features

- **📅 Complete Calendar Views:**
  - Month view with week numbers
  - Year overview with quick month selection  
  - Day detail view with events and holidays

- **🎉 Advanced Holiday System:**
  - Regional holiday configurations (DE, AT, CH, and more)
  - Automatic locale detection
  - Support for fixed-date and Easter-based holidays
  - Historical holiday rules with year-based conditions

- **📅 Event Integration:**
  - Synchronization with Cinnamon Calendar Server (Evolution/Google Calendar)
  - Event indicators in month view
  - Detailed event lists in day view
  - Color-coded event display

- **⌨️ Enhanced Navigation:**
  - Mouse scroll for month navigation
  - Keyboard arrow keys for navigation
  - "Today" button to reset view
  - Responsive UI with tooltips

- **🌍 Internationalization:**
  - Multi-language support via gettext
  - Localized day/month names
  - System locale detection

- **⚡ Modern Architecture:**
  - TypeScript with strict type checking
  - Modular design with separation of concerns
  - Hybrid module system for Cinnamon compatibility
  - Production and development build modes

---

## 🏗️ Project Structure

```
calendar/
├── src/                           # TypeScript source files
│   ├── applet.ts                 # Main applet controller
│   ├── CalendarLogic.ts          # Holiday calculations and date logic
│   ├── CalendarView.ts           # Main calendar UI components
│   ├── EventManager.ts           # System calendar integration
│   ├── EventListView.ts          # Event list rendering
│   └── declarations.d.ts         # TypeScript declarations
├── files/                        # Build output directory
│   └── calendar@projektit.de/    # Production applet files
├── holidays/                     # Holiday definitions by language
│   ├── de.json                  # German holidays (national/regional)
│   ├── en.json                  # English holidays
│   └── ...
├── locale/                       # Translation files
│   └── de/LC_MESSAGES/
│       └── calendar.po
├── metadata.json                 # Applet metadata
├── stylesheet.css                # Custom styling
├── build.sh                      # Build script (dev/prod modes)
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.dev.json             # Development build config
├── tsconfig.prod.json            # Production build config
└── README.md                     # This file
```

---

## ⚙️ Installation

### For Users:
1. **From Cinnamon Spices:**  
   Download from [Cinnamon Spices](https://cinnamon-spices.linuxmint.com/applets/view/xxx)

2. **Manual Installation:**
   ```bash
   git clone https://github.com/ArnoldSchiller/calendar.git
   cd calendar
   ./build.sh prod
   ```
   The applet will be installed to `~/.local/share/cinnamon/applets/calendar@projektit.de`

3. **Enable in Cinnamon:**
   - Right-click panel → Add Applets
   - Find "Calendar" in the list
   - Add to panel

## 🌍 Internationalization & Translations

This applet features smart translation handling without requiring separate translation files:

### Smart Translation Strategy:
The applet uses a **three-tier fallback system** for translations:

1. **Applet Context** - First checks for applet-specific translations
2. **Cinnamon Core** - Falls back to Cinnamon's translations
3. **GNOME Calendar** - Uses GNOME Calendar translations as final fallback

### How it works:
```typescript
function _(str: string) {
    // Priority: 1. Applet, 2. Cinnamon, 3. GNOME Calendar
    let custom = Gettext.dgettext(uuid, str);
    if (custom !== str) return custom;
    let cinnamon = Gettext.dgettext("cinnamon", str);
    if (cinnamon !== str) return cinnamon;
    return Gettext.dgettext("gnome-calendar", str);
}
```

### Benefits:
- **Immediate multi-language support** without creating translation files
- **Leverages existing translations** from well-maintained projects
- **Reduced maintenance** - no need to manage `.po` files
- **Consistent terminology** with the rest of the desktop environment

### Currently Supported Languages:
The applet automatically supports all languages that Cinnamon and GNOME Calendar support, including but not limited to:
- English (en)
- German (de)
- French (fr) 
- Spanish (es)
- Italian (it)
- And many more...

### Adding Applet-Specific Translations:
While not required, if you want to add applet-specific translations:

1. Create a `.po` file for your language:
```
locale/
└── [lang]/LC_MESSAGES/
    └── calendar.po
```

2. Add translations using standard gettext format:
```po
msgid "Import a Calendar (.ics)"
msgstr "Kalender importieren (.ics)"
```

3. The applet will prioritize your custom translations over the fallbacks.

### Notes for Translators:
- The applet uses common calendar terminology already translated in Cinnamon/GNOME
- Only truly unique strings might need applet-specific translations
- Consider contributing translations upstream to Cinnamon/GNOME for broader impact

---


## 🔬 Technical Comparison

| Feature | This Applet | Traditional Cinnamon Calendar |
|---------|-------------|-------------------------------|
| **Codebase** | TypeScript with types | Plain JavaScript (2012) |
| **Architecture** | Modular, separated concerns | Monolithic `eventViewer.js` |
| **Build System** | Dev/Prod with AMD bundling | Manual concatenation |
| **Holiday System** | JSON-based, regional, historical | Hardcoded, limited |
| **Event Integration** | DBus via Calendar Server | Mixed approaches |
| **Translation** | Smart fallback system | Manual .po files |
| **Maintenance** | Easy to extend | Difficult to modify |


### For Developers:
```bash
# Clone repository
git clone https://github.com/ArnoldSchiller/calendar.git
cd calendar

# Development build (modular files)
./build.sh dev

# Production build (single applet.js)
./build.sh prod

# Test in Cinnamon
# Copy to applets directory or use symlink
ln -s "$PWD/files/calendar@projektit.de" ~/.local/share/cinnamon/applets/
```

---

## 🔧 Building

### Development Mode (Modular):
```bash
./build.sh dev
```
- Outputs separate `.js` files
- Uses Cinnamon's `requireModule` for dynamic loading
- Easier debugging with individual source files
- Installs as `calendar-dev@projektit.de`

### Production Mode (Bundled):
```bash
./build.sh prod
```
- Creates single `applet.js` bundle
- Includes AMD loader for Cinnamon compatibility
- Optimized for distribution
- Installs as `calendar@projektit.de`

### TypeScript Configuration:
- **Development:** `tsconfig.dev.json` → `module: "None"`
- **Production:** `tsconfig.prod.json` → `module: "AMD"`

---

## 🧩 Architecture

### Core Components:
1. **`applet.ts`** - Main controller, connects Cinnamon panel with components
2. **`CalendarLogic.ts`** - Pure date logic, holiday calculations, JSON loading
3. **`CalendarView.ts`** - UI rendering (grid, navigation, views)
4. **`EventManager.ts`** - DBus communication with Cinnamon Calendar Server
5. **`EventListView.ts`** - Event list display component

### Key Design Decisions:
- **Hybrid Module System:** Uses both `exports` (AMD) and `global` assignment for Cinnamon compatibility
- **State-Driven UI:** Central `.render()` method updates all views on state change
- **Separation of Concerns:** Logic, UI, and data management in separate modules
- **GJS Compatibility:** Uses native GLib/Gio instead of Node.js APIs

---

## 📊 Holiday System

```
files/calendar@projektit.de/holidays:
ar.json  ca.json       el.json  fi.json  hu.json  kk.json  mt.json  pt.json  sl.json                 sv.json           vi.json
be.json  cs.json       en.json  fr.json  id.json  ko.json  nb.json  ro.json  sr@ijekavian.json       tr.json           wa.json
bg.json  da.json       es.json  ga.json  is.json  lb.json  nl.json  ru.json  sr@ijekavianlatin.json  uk.json           zh.json
bn.json  default.json  et.json  he.json  it.json  lt.json  nn.json  si.json  sr.json                 uz@cyrillic.json
bs.json  de.json       fa.json  hr.json  ja.json  lv.json  pl.json  sk.json  sr@latin.json           uz.json
```
Data based on the KDE KHolidays framework (plan2 files generated 2025)

### Configuration Files:
Holidays are defined in JSON files in `/holidays/`:
```json
{
  "regions": {
    "de": [
      {"n": "New Year", "k": "f", "m": 1, "d": 1},
      {"n": "Christmas", "k": "f", "m": 12, "d": 25}
    ],
    "de-BY": [
      {"n": "Assumption Day", "k": "f", "m": 8, "d": 15}
    ]
  }
}
```

### Holiday Types:
- **Fixed Date (`"k": "f"`)**: Specific month/day
- **Easter-based (`"k": "e"`)**: Offset from Easter Sunday
- **Conditional (`"c"`)**: Year-based conditions (e.g., `"year<=1994"`)

### Locale Detection:
Automatically detects system language and loads appropriate holiday file.

---

## 🔌 Event Integration

### Supported Sources:
- **Cinnamon Calendar Server** (Evolution Data Server)
- **Google Calendar** (via Evolution)
- **Local Calendar Files** (ICS import - *planned*)

### Features:
- Real-time event synchronization
- Color coding by calendar source
- Event indicators in month view
- Full event details in day view
- Automatic refresh every 60 seconds

---

## 🎨 Customization

### Settings (via Cinnamon Settings):
- Show/hide week numbers
- Custom date/time formats
- Event display preferences
- Custom keyboard shortcuts

### Styling:
Edit `stylesheet.css` for custom theming. CSS classes follow BEM-like naming:
- `.calendar-main-box` - Main container
- `.calendar-day` - Individual day cells
- `.calendar-today` - Today's cell
- `.calendar-nonwork-day` - Sundays/holidays
- `.calendar-event-button` - Event items

---

## 🐛 Debugging

### Logs:
```bash
# Monitor Cinnamon logs for applet errors
journalctl -f -o cat /usr/bin/cinnamon 2>&1 | grep -E "calendar@projektit|Calendar"
```

### Development Tools:
- Use `global.log()` and `global.logError()` in code
- Development build preserves source structure for debugging
- Browser DevTools for CSS debugging (right-click → Inspect)

### Common Issues:
- **Module not found:** Ensure correct build mode (dev vs prod)
- **Holidays not showing:** Check locale detection and JSON file permissions
- **Events missing:** Verify Calendar Server is running (`org.cinnamon.CalendarServer`)

---

## 🚀 Roadmap / TODO

### Planned Features:
- [ ] **ICS File Import** - Direct import of .ics calendar files
- [ ] **Additional Holiday Regions** - More countries and regions
- [ ] **Custom Holiday Definitions** - User-defined holidays
- [ ] **Theme Integration** - Better Cinnamon theme compatibility
- [ ] **Weather Integration** - Weather forecasts in day view

### Known Limitations:
- ICS import requires file dialog implementation
- Some calendar server features depend on Evolution configuration
- Regional holiday coverage is currently Europe-focused

---

## 👥 Contributing

1. **Fork the repository**
2. **Create a feature branch:**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make changes and commit:**
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push to your fork:**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Translation Contributions:
- Edit `.po` files in `/locale/`
- Submit updates via Pull Request

---

## 📄 License

This project is licensed under the **GPL-3.0-or-later License**.

---

## 🌐 Contact & Links

**Author:** Arnold Schiller  
**UUID:** `calendar@projektit.de`  
**GitHub:** https://github.com/ArnoldSchiller/calendar  
**Project Page:** https://projektit.de/kalender  
**Cinnamon Spices:** https://cinnamon-spices.linuxmint.com/applets

---

## 🙏 Acknowledgments

- **Cinnamon Team** for the excellent desktop environment
- **GNOME/GTK** for the underlying technologies
- **TypeScript** for bringing modern JavaScript to Cinnamon
- **All Contributors** who help improve this applet
```

