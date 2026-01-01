# Changelog - Projekt IT Calendar

## v1.0.0 (Rewrite 2026)
### 🏗️ Architectural Rewrite
- Complete TypeScript conversion
- Modular architecture with separation of concerns
- Eliminated monolithic `eventViewer.js`
- Hybrid module system for Cinnamon compatibility

### 🎉 New Features
- Advanced holiday system with regional configurations
- Automatic locale detection for holidays
- Easter-based holiday calculations
- Historical holiday rules with year conditions
- Event synchronization via Cinnamon Calendar Server
- Keyboard navigation improvements
- Three-tier translation system (Cinnamon/GNOME fallback)

### 🔧 Technical Improvements
- TypeScript with strict type checking
- AMD module bundling for production
- Development/Production build system
- GJS-native file operations (GLib instead of Node.js fs)
- Signal-based event management
- Responsive UI with Clutter/St

### 🐛 Bugs Fixed from Original
- Fixed month view rendering issues
- Improved keyboard navigation
- Better event display synchronization
- Holiday calculation accuracy
- Memory leak fixes in UI rendering
- Improved locale handling

### 📦 Dependencies
- TypeScript 5.x
- Cinnamon 5.0+ (tested up to 6.0)
- GLib 2.0+
