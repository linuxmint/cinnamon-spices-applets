const St = imports.gi.St;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const Cairo = imports.gi.cairo;
const Animations = imports.animations.Animations;
const PopupMenu = imports.ui.popupMenu;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext;
const UUID = "crypto-tracker@danipin";

function _(str) {
  return Gettext.dgettext(UUID, str);
}

var _applet;

function init(applet) {
    _applet = applet;
}

function createTimeframeLabel(label, value) {
    let isActive = (_applet.selectedTimeframe === value);

    // Styles defined for hover effect (background gray on hover)
    let baseStyle = "width: 42px; text-align: center; padding: 2px 0; border-radius: " + _applet.hoverRadius + "; ";
    let activeStyle = baseStyle + "color: #449d44; font-weight: bold; background-color: rgba(68,157,68,0.25);";
    let normalStyle = baseStyle + "opacity: 0.55;";
    let hoverStyle = baseStyle + "opacity: 1.0; background-color: " + _applet.hoverColorHeader + ";";

    let lbl = new St.Label({ 
        text: label, 
        reactive: true, 
        style: isActive ? activeStyle : normalStyle
    });

    if (!isActive) {
        lbl.connect('enter-event', () => { lbl.set_style(hoverStyle); });
        lbl.connect('leave-event', () => { lbl.set_style(normalStyle); });
    }

    lbl.connect('button-press-event', () => { return true; });
    lbl.connect('button-release-event', () => {
        if (_applet.selectedTimeframe !== value) {
            // Prevents menu closing when switching
            _applet.menu.close = () => {}; 
            
            // 1. Set new timeframe
            _applet.selectedTimeframe = value; 
            
            // 2. Redraw menu (starts chart fetch if necessary)
            _applet._buildMenu(); 
            
            // 3. Adjust panel trend immediately (uses cache if available)
            _applet.updateVisuals();

            // Release menu close function after short time
            Mainloop.timeout_add(100, () => { 
                _applet.menu.close = _applet._originalMenuClose; 
                return false; 
            });
        }
        return true; 
    });
    return lbl;
}

function createTimeframeSection() {
    let innerBox = new St.BoxLayout({ x_align: St.Align.MIDDLE });
    let createDivider = () => { 
        let bin = new St.Bin({ style: "padding: 0 2px;" }); 
        bin.set_child(new St.Label({ text: "|", style: "color: rgba(128, 128, 128, 0.3);" })); 
        return bin; 
    };

    innerBox.add(createTimeframeLabel("1H", "0.041"));  innerBox.add(createDivider());
    innerBox.add(createTimeframeLabel("4H", "0.166"));  innerBox.add(createDivider());
    innerBox.add(createTimeframeLabel("12H", "0.5"));    innerBox.add(createDivider());
    innerBox.add(createTimeframeLabel("1D", "1"));      innerBox.add(createDivider());
    innerBox.add(createTimeframeLabel("3D", "3"));      innerBox.add(createDivider());
    innerBox.add(createTimeframeLabel("1W", "7"));      innerBox.add(createDivider());
    innerBox.add(createTimeframeLabel("1M", "30"));

    let centerBin = new St.Bin({ x_align: St.Align.MIDDLE }); 
    centerBin.set_child(innerBox);
    let barWrapper = new St.BoxLayout({ style: "padding-top: 12px; padding-bottom: 5px;" }); 
    barWrapper.add(centerBin, { expand: true });
    return barWrapper;
}

function drawHeader(headContainer, applet) {
    // Overlay container: Allows stacking of title and button
    let overlay = new St.Widget({ 
        layout_manager: new Clutter.BinLayout(), 
        x_expand: true, 
        y_expand: true,
        reactive: false
    });

    // 1. Layer: Title / Theme (Takes full width)
    let titleLayer = new St.BoxLayout({ vertical: true, x_expand: true, y_expand: true });

    let createFixedLabel = (text, marginBottom = "3px") => {
        let bin = new St.Bin({ style: "height: 40px; margin-bottom: " + marginBottom + ";" });
        let lbl = new St.Label({
            text: text,
            style: "font-weight: bold; text-align: center; font-size: 19px; padding-top: 5px;"
        });
        bin.set_child(lbl);
        return bin;
    };

    if (applet.currentView === "portfolio") {
        titleLayer.add(createFixedLabel(_("Portfolio Tracker")));
    } else if (applet.currentView === "alarms") {
        titleLayer.add(createFixedLabel(_("Alarm Management")));
    } else if (applet.currentView === "api_stats") {
        titleLayer.add(createFixedLabel(_("API Usage & Stats")));
    } else if (applet.currentView === "donate") {
        titleLayer.add(createFixedLabel(_("Support Development")));
    } else {
        if (!_applet.currentTheme) {
            // Standard header if no theme is active
            if (_applet.apiValid) {
                titleLayer.add(createFixedLabel(_("Market Dashboard")));
            } else {
                titleLayer.add(createFixedLabel(_("24H Price Change [%]"), "10px"));
            }
        } else {
            // Theme Animation Logic moved inside else block to use titleContainer
            drawThemeHeader(titleLayer);
        }
    }

    overlay.add_actor(titleLayer);

    // 2. Layer: Menu Button (Top Right, floating, in own box)
    let menuLayer = new St.BoxLayout({ 
        vertical: false, 
        x_expand: true, 
        y_expand: true, 
        reactive: false // IMPORTANT: So clicks on title go through
    });

    // Spacer to push button to the right
    menuLayer.add(new St.Widget({ reactive: false }), { expand: true });

    let menuBin = new St.Bin({ reactive: true, style: "padding: 2px; border-radius: 4px; margin-top: 16px; margin-right: 27px;" });
    let menuIcon = new St.Icon({ icon_name: "view-more-symbolic", icon_size: 16, style: "color: " + _applet.colors.text_more_dim + ";" });
    menuBin.set_child(menuIcon);

    // Define styles with margin so button doesn't jump
    let marginTop = "4px";
    if (applet.currentView === "dashboard" && applet.currentTheme) {
        marginTop = "12px";
    }
    let styleNormal = "padding: 2px; border-radius: 4px; margin-top: " + marginTop + "; margin-right: 30px; background-color: transparent;";

    menuBin.set_style(styleNormal);
    menuBin.connect('enter-event', () => { menuIcon.set_style("color: " + _applet.colors.text + ";"); });
    menuBin.connect('leave-event', () => { menuIcon.set_style("color: " + _applet.colors.text_more_dim + ";"); });
    
    menuBin.connect('button-press-event', () => { return true; });
    menuBin.connect('button-release-event', () => {
        applet.menu.close = () => {};
        
        // If header menu already open -> Close
        if (applet.isHeaderMenuOpen) {
            applet._closeAnyDropdown(() => {
                applet._buildMenu();
                Mainloop.timeout_add(100, () => { 
                    if (applet.menu) applet.menu.close = applet._originalMenuClose; 
                    return false; 
                });
            });
            return true;
        }

        // If something else is open -> Close, Pause, then open header
        if (applet._closeAnyDropdown(() => {
            Mainloop.timeout_add(120, () => {
                applet.isHeaderMenuOpen = true;
                applet._buildMenu();
                Mainloop.timeout_add(100, () => { if (applet.menu) applet.menu.close = applet._originalMenuClose; return false; });
                return false;
            });
        })) {
            return true;
        }

        // Open directly
        applet.isHeaderMenuOpen = !applet.isHeaderMenuOpen;
        applet._buildMenu();
        Mainloop.timeout_add(100, () => { 
            if (applet.menu) applet.menu.close = applet._originalMenuClose; 
            return false; 
        });
        return true;
    });

    menuLayer.add(menuBin, { expand: false, x_fill: false, y_fill: false });
    overlay.add_child(menuLayer);
    
    headContainer.add(overlay, { expand: false, x_fill: true, y_fill: false });

    if (applet.isHeaderMenuOpen) {
        let dropdownItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: "popup-menu-item" });
        dropdownItem.actor.style = "padding: 0px;";
        
        // Debug Styles (Colors for nesting)
        let showDebug = applet.settings.getValue("dev-show-frames");
        let dOuter = showDebug ? "border: 1px solid rgba(255, 0, 0, 0.8);" : ""; // Red (Outer)
        let dNav   = showDebug ? "border: 1px solid rgba(0, 255, 0, 0.8);" : ""; // Green (Container)
        let dItem  = showDebug ? "border: 1px solid rgba(0, 100, 255, 0.8);" : ""; // Blue (Items)

        // 100% width, no spacing (Padding 0)
        let outerBox = new St.BoxLayout({ vertical: true, style: "padding: 0px;" + dOuter });

        // NavBox fills everything (no margin/padding/radius)
        let navBox = new St.BoxLayout({ vertical: true, style: "background-color: " + _applet.colors.bg_popup + "; margin: 0px; padding: 0px;" + dNav });
        
        let createNavItem = (label, viewId) => {
            let baseStyle = "padding: 12px 40px; border-bottom: 1px solid " + _applet.colors.divider + ";";
            let item = new St.BoxLayout({ reactive: true, style: baseStyle + dItem });
            let lbl = new St.Label({ 
                text: label, 
                style: (applet.currentView === viewId) ? "font-weight: bold; color: " + _applet.colors.text + ";" : "color: " + _applet.colors.text_dim + ";" 
            });
            item.add(lbl);
            
            item.connect('enter-event', () => item.set_style(baseStyle + "background-color: " + applet.hoverColor + ";" + dItem));
            item.connect('leave-event', () => item.set_style(baseStyle + "background-color: transparent;" + dItem));
            
            item.connect('button-press-event', () => { return true; });
            item.connect('button-release-event', () => {
                applet.menu.close = () => {}; // Block closing

                // Helper for view switch after animation
                let switchView = () => {
                    if (applet.resetViewStates) applet.resetViewStates();
                    applet.currentView = viewId;
                    applet.isHeaderMenuOpen = false;
                    applet.activeHeaderMenuActor = null;
                    
                    applet._isViewSwitching = true; // Activate animation
                    applet._buildMenu();
                    applet._isViewSwitching = false; // Reset

                    if (viewId === 'portfolio') {
                        applet._lastGlobalFetch = 0;
                        applet.updatePrices();
                    }

                    Mainloop.timeout_add(100, () => { 
                        if (applet.menu) applet.menu.close = applet._originalMenuClose; 
                        return false; 
                    });
                };

                // Collapse Animation
                if (applet.activeHeaderMenuActor) {
                    Animations.animateCollapse(applet.activeHeaderMenuActor, switchView, 8);
                } else {
                    switchView();
                }
                return true;
            });
            return item;
        };
        
        navBox.add(createNavItem(_("Market Dashboard"), "dashboard"));
        navBox.add(createNavItem(_("Portfolio Tracker"), "portfolio"));
        navBox.add(createNavItem(_("Alarm Management"), "alarms"));
        if (applet.apiValid) {
            navBox.add(createNavItem(_("API Usage & Stats"), "api_stats"));
        }
        navBox.add(createNavItem(_("Support"), "donate"));

        let setBaseStyle = "padding: 12px 40px; border-bottom: 1px solid " + _applet.colors.divider + ";";
        let settingsItem = new St.BoxLayout({ reactive: true, style: setBaseStyle + dItem });
        settingsItem.add(new St.Label({ text: _("Settings"), style: "color: " + _applet.colors.text_dim + ";" }));
        
        settingsItem.connect('enter-event', () => settingsItem.set_style(setBaseStyle + "background-color: " + applet.hoverColor + ";" + dItem));
        settingsItem.connect('leave-event', () => settingsItem.set_style(setBaseStyle + "background-color: transparent;" + dItem));
        
        settingsItem.connect('button-press-event', () => { return true; });
        settingsItem.connect('button-release-event', () => {
            applet.menu.close = () => {}; // Block closing
            
            // FIX: Execute settings command immediately so the window opens reliably
            try {
                // Use native method (like Right Click -> Configure)
                if (typeof applet.configureApplet === 'function') {
                    applet.configureApplet();
                } else {
                    let uuid = (applet.metadata && applet.metadata.uuid) ? applet.metadata.uuid : "crypto-tracker@danipin";
                    let instanceId = (applet.instance_id !== undefined) ? applet.instance_id : 0;
                    let cmd = "cinnamon-settings applets " + uuid + " " + instanceId;
                    try {
                        Util.spawnCommandLine(cmd);
                    } catch(err) {
                        GLib.spawn_command_line_async(cmd);
                    }
                }
            } catch (e) {
                global.logError("Crypto-Tracker: Settings Error: " + e);
            }

            let closeMenu = () => {
                applet.isHeaderMenuOpen = false;
                applet.activeHeaderMenuActor = null;
                applet.menu.close = applet._originalMenuClose; // Restore close
                applet.menu.close(); // Close menu
            };

            if (applet.activeHeaderMenuActor) {
                Animations.animateCollapse(applet.activeHeaderMenuActor, closeMenu, 8);
            } else {
                closeMenu();
            }
            return true;
        });
        navBox.add(settingsItem);
        
        outerBox.add(navBox);
        dropdownItem.addActor(outerBox, { expand: true, span: -1 });
        headContainer.add(dropdownItem.actor);
        applet.activeHeaderMenuActor = dropdownItem.actor;
        Animations.animateExpand(dropdownItem.actor, null, 8);
    }
}

function drawThemeHeader(headContainer) {
    // --- THEME-ANIMATION (Particles) ---
    let headerHeight = 40;
    let area = new St.DrawingArea({ style: "height: " + headerHeight + "px; width: 100%; margin-bottom: 3px;", reactive: true });

    let isHalloween = (_applet.currentTheme.name === 'halloween');
    let isPizza = (_applet.currentTheme.name === 'pizza');
    let isEaster = (_applet.currentTheme.name === 'easter');
    let isXmas = (_applet.currentTheme.name === 'xmas' || _applet.currentTheme.name === 'xmas_eve');
    let isNewYear = (_applet.currentTheme.name === 'newyear');
    let isValentine = (_applet.currentTheme.name === 'valentine');
    let pizzaFlyAnim = { active: false, yOffset: 0 };

    // Initialize light chain data only once per menu build
    let lightChainData = null;
    if (isXmas) {
        lightChainData = { bulbs: [] };
        const bulbColors = [[1, 0.2, 0.2], [0.2, 1, 0.2], [0.2, 0.5, 1], [1, 1, 0.2], [1, 0.5, 0], [1, 0.2, 1]];
        let numBulbs = 18; // More bulbs
        for (let i = 0; i < numBulbs; i++) {
            // Star (i=0) slow, lights (i>0) faster
            let speed = (i === 0) ? (0.0005 + Math.random() * 0.0015) : (0.002 + Math.random() * 0.003);
            lightChainData.bulbs.push({
                size: 3 + Math.random() * 3,       // Smaller bulbs (3-6px)
                speed: speed,
                offset: Math.random() * 20,         // Phase shift
                color: bulbColors[i % bulbColors.length]
            });
        }
    }

    let d = new Date();
    let isFirework = isPizza || isNewYear; // Fireworks for Pizza Day and New Year

    let particles = [];
    let pCount = isHalloween ? 6 : 45; // Halved for Halloween

    const FIREWORK_COLORS = [
        [1, 0.2, 0.2, 0.8], // Red
        [1, 1, 0.2, 0.8],   // Yellow
        [0.3, 0.5, 1, 0.8], // Blue
        [0.3, 1, 0.3, 0.8], // Green
        [1, 1, 1, 0.8]      // White
    ];

    const EGG_COLORS = [
        [1, 0.6, 0.6, 0.8], // Pink
        [0.6, 0.8, 1, 0.8], // Blue
        [1, 1, 0.6, 0.8],   // Yellow
        [0.6, 1, 0.6, 0.8], // Green
        [0.8, 0.6, 1, 0.8]  // Purple
    ];

    for (let k = 0; k < pCount; k++) {
        let pIcon = isHalloween ? ((Math.random() > 0.5) ? "🎃" : "👻") : "🎃";
        let pRv = (Math.random() - 0.5) * 0.05;
        let pR = Math.random() * Math.PI * 2;
        let pBaseR = 0;
        let pWiggle = false;

        // Ghosts must not be upside down
        if (pIcon === "👻") {
            pRv = 0; // No rotation
            pR = (Math.random() - 0.5) * 0.5; // Slight tilt (-15° to +15°)
            pBaseR = pR;
            if (Math.random() > 0.5) pWiggle = true; // 50% wiggle
        }

        let particle = {
            x: 0.05 + Math.random() * 0.9, // 5% margin left/right
            y: Math.random(),
            s: Math.random() * 1.5 + 0.5,
            v: isHalloween ? (Math.random() * 0.0015 + 0.001) : (Math.random() * 0.003 + 0.002), // Slower for Halloween
            hType: (Math.random() > 0.5) ? 1 : 0, // 0=Swing, 1=Travel
            hSpeed: (Math.random() * 0.003 + 0.001) * (Math.random() > 0.5 ? 1 : -1), // Horizontal speed
            r: pR,
            rv: pRv,
            baseR: pBaseR,
            wiggle: pWiggle,
            grow: (k % 6 === 0),
            shrinking: false, // Status for growing/shrinking
            icon: pIcon,
            life: isFirework ? (Math.random() * 200 + 50) : -1, // Lifespan for fireworks
            alpha: isEaster ? 0.7 : 1.0,
            landed: false,
            landTime: 0
        };

        if (isFirework) {
            particle.color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
        } else if (isEaster) {
            particle.color = EGG_COLORS[Math.floor(Math.random() * EGG_COLORS.length)];
        }

        particles.push(particle);
    }

    let startTime = (_applet.newYearOverlayActive && _applet.newYearStartTime) ? _applet.newYearStartTime : Date.now();
    let ghostRect = null; // For click detection
    let starRect = null; // For Christmas star
    let pizzaRect = null; // For Pizza Day
    let bottleRect = null; // For New Year

    // Choose random icon from current theme
    let icons = _applet.currentTheme.icons;
    let currentIcon = icons[Math.floor(Math.random() * icons.length)];
    if (isHalloween) currentIcon = "👻"; // Force ghost as main character
    if (isEaster) currentIcon = "🐇"; // Force rabbit as main character

    area.connect('repaint', (a) => {
        let cr = a.get_context();
        let [w, h] = a.get_surface_size();
        
        // FIX: Determine theme color and brightness
        let themeNode = _applet.menu.actor.get_theme_node();
        let fg = themeNode.get_foreground_color();
        // If text is dark (< 128), we have a light theme
        let isLightTheme = ((fg.red + fg.green + fg.blue) / 3) < 128;

        // FIX: Force dark background for light theme
        if (isLightTheme) {
            cr.setSourceRGBA(0.15, 0.15, 0.15, 1.0); // Dark background
            cr.rectangle(0, 0, w, h);
            cr.fill();
            
            // Set text color to white since background is now dark
            fg = { red: 240, green: 240, blue: 240 };
            isLightTheme = false; // Switch logic for particles to "Dark Theme"
        }

        if (isValentine) {
            let layoutHearts = PangoCairo.create_layout(cr);
            layoutHearts.set_text("💕", -1);
            layoutHearts.set_font_description(Pango.FontDescription.from_string("Sans 27"));

            cr.save();
            cr.translate(90, h + 1);
            cr.rotate(-0.1);
            let [ink, log] = layoutHearts.get_pixel_extents();
            cr.moveTo(-log.width / 2, -log.height);

            cr.pushGroup();
            PangoCairo.show_layout(cr, layoutHearts);
            cr.popGroupToSource();
            cr.paintWithAlpha(0.15);
            cr.restore();
        }

        if (isHalloween) {
            // Spooky Houses & Tombstones (Background Icons - Rear Layer)

            // House (Center, smaller, transparent)
            let layoutHouse = PangoCairo.create_layout(cr);
            layoutHouse.set_text("🏚️", -1);
            layoutHouse.set_font_description(Pango.FontDescription.from_string("Sans 35"));

            cr.save();
            cr.translate(w / 2, h + 2);
            cr.rotate(-0.02);
            let [inkH, logH] = layoutHouse.get_pixel_extents();
            cr.moveTo(-logH.width / 2, -logH.height);

            cr.pushGroup();
            PangoCairo.show_layout(cr, layoutHouse);
            cr.popGroupToSource();
            cr.paintWithAlpha(0.55); // 55% Opacity
            cr.restore();

            // Tombstones (left and right)
            let layoutTomb = PangoCairo.create_layout(cr);
            layoutTomb.set_text("🪦", -1);

            // Tombstone 1 (Left)
            layoutTomb.set_font_description(Pango.FontDescription.from_string("Sans 15"));
            cr.save();
            cr.translate(w / 2 - 120, h + 2); // ~2cm further out
            cr.rotate(-0.05);
            let [inkT, logT] = layoutTomb.get_pixel_extents();
            cr.moveTo(-logT.width / 2, -logT.height);

            cr.pushGroup();
            PangoCairo.show_layout(cr, layoutTomb);
            cr.popGroupToSource();
            cr.paintWithAlpha(0.3);
            cr.restore();

            // Tombstone 2 (Right)
            layoutTomb.set_font_description(Pango.FontDescription.from_string("Sans 12"));
            cr.save();
            cr.translate(w / 2 + 120, h + 1); // ~2cm further out
            cr.rotate(0.05);
            let [inkT2, logT2] = layoutTomb.get_pixel_extents();
            cr.moveTo(-logT2.width / 2, -logT2.height);

            cr.pushGroup();
            PangoCairo.show_layout(cr, layoutTomb);
            cr.popGroupToSource();
            cr.paintWithAlpha(0.25);
            cr.restore();

            // Tombstone 3 (New - Left of the right one, overlapping)
            layoutTomb.set_font_description(Pango.FontDescription.from_string("Sans 13.5"));
            cr.save();
            cr.translate(w / 2 + 108, h + 3);
            cr.rotate(-0.04);
            let [inkT3, logT3] = layoutTomb.get_pixel_extents();
            cr.moveTo(-logT3.width / 2, -logT3.height);

            cr.pushGroup();
            PangoCairo.show_layout(cr, layoutTomb);
            cr.popGroupToSource();
            cr.paintWithAlpha(0.3);
            cr.restore();
        }

        if (isEaster) {
            // House in background (Halloween method)
            let layoutHouse = PangoCairo.create_layout(cr);
            layoutHouse.set_text("🏡", -1);
            layoutHouse.set_font_description(Pango.FontDescription.from_string("Sans 30"));

            cr.save();
            cr.translate(w / 2, h + 4); // Centered, slightly sunken into the grass
            let [ink, log] = layoutHouse.get_pixel_extents();
            cr.moveTo(-log.width / 2, -log.height);

            cr.pushGroup();
            PangoCairo.show_layout(cr, layoutHouse);
            cr.popGroupToSource();
            cr.paintWithAlpha(0.55);
            cr.restore();
        }

        // 1. Particles (NOW UP HERE - BACKGROUND)
        let pc = _applet.currentTheme.particleColor;
        particles.forEach(f => {
            let x = f.x * w;
            let y = f.y * h;

            if (f.color) {
                cr.setSourceRGBA(f.color[0], f.color[1], f.color[2], f.alpha);
            } else {
                if (!pc) return;
                cr.setSourceRGBA(pc[0], pc[1], pc[2], pc[3]);
            }

            if (isEaster) {
                cr.save();
                cr.translate(x, y);
                cr.scale(0.8, 1.1); // Egg shape
                cr.arc(0, 0, f.s * 1.5, 0, 2 * Math.PI);
                cr.restore();
                cr.fill();
            } else if (isXmas) {
                let size = f.s * 1.8;
                cr.setLineWidth(1.0);
                cr.save();
                cr.translate(x, y); cr.rotate(f.r);
                for (let i = 0; i < 3; i++) { cr.moveTo(-size, 0); cr.lineTo(size, 0); cr.rotate(Math.PI / 3); }
                cr.stroke();
                cr.restore();
            } else {
                cr.arc(x, y, f.s, 0, 2 * Math.PI);
                cr.fill();
            }
        });

        // Grass/Ground for themes (drawn before icons)
        if (isEaster || isXmas || isHalloween) {
            cr.save();
            if (isXmas) {
                cr.setSourceRGBA(0.40, 0.40, 0.40, 1.0); // Snow ground
            } else if (isHalloween) {
                cr.setSourceRGBA(0.28, 0.26, 0.24, 1.0); // Lighter ground
            } else { // isEaster
                cr.setSourceRGBA(0.08, 0.25, 0.08, 1.0); // Dark grass
            }

            let margin = 76; // 2cm margin
            cr.moveTo(margin, h);
            for (let gx = margin; gx <= w - margin; gx += 4) {
                let shape, baseHeight;
                if (isXmas) {
                    baseHeight = 2; // Slightly higher for snow (was 1)
                    shape = (Math.sin(gx * 0.015) + 1) * 0.07 + (Math.sin(gx * 0.005) + 1) * 0.03;
                } else { // isEaster or isHalloween
                    baseHeight = 2; // Normal height for grass/soil
                    shape = (Math.sin(gx * 0.015) + 1) * 0.15 + (Math.sin(gx * 0.005) + 1) * 0.06;
                }

                let edgeDist = Math.min(gx - margin, (w - margin) - gx);
                let fade = (edgeDist < 50) ? (edgeDist / 50) : 1.0;

                cr.lineTo(gx, h + 1 - (baseHeight + shape) * fade);
            }
            cr.lineTo(w - margin, h);
            cr.fill();
            cr.restore();
        }

        // 1. Draw text
        cr.setSourceRGBA(fg.red/255, fg.green/255, fg.blue/255, 1.0);
        let layout = PangoCairo.create_layout(cr);

        // IMPORTANT: For the drawing loop we need the pure text without markup!
        let dashboardText = (isHalloween || isNewYear || isPizza) ? "Market Dashboard" : _("Market Dashboard");
        let baseText = _applet.apiValid ? dashboardText + " " : _("24H Price Change [%]") + " ";
        let desc = Pango.FontDescription.from_string("Sans Bold 14");
        layout.set_font_description(desc);

        let drawStandardText = null;

        if (isHalloween) {
            // --- HALLOWEEN SPECIAL ---

            // 1. Pumpkin Rain (Rear Layer)
            cr.save();
            particles.forEach((f, idx) => {
                // Transparency based on size (smaller = more transparent)
                let alpha = 0.05 + (f.s - 0.5) * 0.2; // Much more transparent (Max ~0.35)
                if (alpha > 0.4) alpha = 0.4;

                let pLayout = PangoCairo.create_layout(cr);
                pLayout.set_text(f.icon, -1);
                let size = 5 * f.s; // Max 10 (significantly smaller than main icons 15/17)
                pLayout.set_font_description(Pango.FontDescription.from_string("Sans " + size));

                cr.save();
                cr.translate(f.x * w, f.y * h);
                // Some rotate
                if (idx % 2 === 0) cr.rotate(f.r);

                let [ink, log] = pLayout.get_pixel_extents();
                cr.moveTo(-log.width / 2, -log.height / 2); // Draw centered

                // FIX: Force real transparency for emojis
                cr.pushGroup();
                PangoCairo.show_layout(cr, pLayout);
                cr.popGroupToSource();
                cr.paintWithAlpha(alpha);

                cr.restore();
            });
            cr.restore();

            // 2. Spider web (Middle layer)
            cr.save();
            cr.translate(20, 20); // Pivot
            cr.rotate(-20 * (Math.PI / 180)); // 20° to the left (5° more)
            cr.translate(-20, -20);
            let layoutWeb = PangoCairo.create_layout(cr);
            layoutWeb.set_text("🕸️", -1);
            layoutWeb.set_font_description(Pango.FontDescription.from_string("Sans 50")); // Even smaller
            cr.moveTo(-25, -15); // 5mm down (~20px)

            cr.pushGroup();
            PangoCairo.show_layout(cr, layoutWeb);
            cr.popGroupToSource();
            cr.paintWithAlpha(0.12); // Force significant transparency
            cr.restore();

            // 2b. Spider web Right (New)
            cr.save();
            cr.translate(w - 20, 20);
            cr.rotate(68 * (Math.PI / 180)); // 68°
            cr.translate(-(w - 20), -20);
            let layoutWeb2 = PangoCairo.create_layout(cr);
            layoutWeb2.set_text("🕸️", -1);
            layoutWeb2.set_font_description(Pango.FontDescription.from_string("Sans 34")); // Size 34
            cr.moveTo(w - 25, -13); // 5px higher

            cr.pushGroup();
            PangoCairo.show_layout(cr, layoutWeb2);
            cr.popGroupToSource();
            cr.paintWithAlpha(0.12); // Force significant transparency
            cr.restore();

            // 3. Text & Wiggle Ghost (Foreground)
            layout.set_markup(baseText, -1);
            let [ink, logical] = layout.get_pixel_extents();
            let textW = logical.width;

            // Prepare ghost layout to know size
            let layoutG = PangoCairo.create_layout(cr);
            layoutG.set_text("👻", -1);
            layoutG.set_font_description(Pango.FontDescription.from_string("Sans 15")); // Smaller
            let [gInk, gLog] = layoutG.get_pixel_extents();
            let ghostW = gLog.width;
            let ghostH = gLog.height;

            // Calculate total width for centering
            let totalW = textW + ghostW + 8; // 8px spacing
            let startX = (w - totalW) / 2;
            let startY = (h - logical.height) / 2 + 6; // 2px lower

            // Time for animations
            let elapsed = Date.now() - startTime;

            // Draw text
            cr.setSourceRGBA(0.9, 0.9, 0.9, 1.0);

            let currentX = startX;
            let chars = baseText.split('');

            chars.forEach((char, i) => {
                let charLayout = PangoCairo.create_layout(cr);
                charLayout.set_font_description(desc);
                charLayout.set_text(char, -1);
                let [cInk, cLog] = charLayout.get_pixel_extents();

                let angle = (Math.sin(i * 123.45) * 0.15);
                let yOffset = 0;
                let alpha = 1.0;
                let scaleY = 1.0;

                // Tilt 'M' to the right
                if (i === 0) {
                    angle = 0.2;
                }

                // Drop 'D' after 5 seconds and fade in slowly
                if (i === 7) { // 'D' in Dashboard
                    let animProgress = Math.min(1.0, elapsed / 2000);
                    alpha = animProgress;
                    scaleY = animProgress;

                    if (elapsed > 6000) {
                        let animTime = elapsed - 6000;
                        if (animTime < 500) { // 0.5s tilt phase
                            angle = -0.4;
                        } else { // Fall phase
                            angle = -0.4; // Keep it tilted
                            let fallTime = animTime - 500;
                            yOffset = 0.0005 * fallTime * fallTime; // Gravity
                        }
                    }
                }

                cr.save();
                cr.translate(currentX + cLog.width / 2, startY + cLog.height / 2 + yOffset);
                cr.rotate(angle);
                cr.scale(1, scaleY);
                cr.translate(-cLog.width / 2, -cLog.height / 2);

                let isDark = ['a', 'e', 'o', 'd'].includes(char);
                if (i === 13) isDark = false; // Leave 3rd 'a' at the end white

                if (isDark) {
                    cr.setSourceRGBA(fg.red/255, fg.green/255, fg.blue/255, alpha * 0.7); // Slightly more transparent
                } else {
                    cr.setSourceRGBA(fg.red/255, fg.green/255, fg.blue/255, alpha);
                }
                cr.moveTo(0, 0);
                PangoCairo.show_layout(cr, charLayout);
                cr.restore();

                currentX += cLog.width;
            });

            // Ghost Animation Timeline
            let ghostAlpha = 0;
            let angle = 0;

            // 0-2s: Invisible
            if (elapsed < 2000) {
                ghostAlpha = 0;
            }
            // 2s-5s: Fade In (3s)
            else if (elapsed < 5000) {
                ghostAlpha = (elapsed - 2000) / 3000;
            }
            // 5s-10s: Visible (Wait 5s)
            else if (elapsed < 10000) {
                ghostAlpha = 1.0;
            }
            // 10s-12s: Wiggle (2s)
            else if (elapsed < 12000) {
                ghostAlpha = 1.0;
                angle = 0.2 * Math.sin((elapsed - 10000) * 0.015);
            }
            // 12s-15s: Wait (3s)
            else if (elapsed < 15000) {
                ghostAlpha = 1.0;
            }
            // 15s-18s: Fade Out (3s)
            else if (elapsed < 18000) {
                ghostAlpha = 1.0 - (elapsed - 15000) / 3000;
            }
            // 16s+: Gone

            let ghostX = startX + textW + 8 - 8; // 4px further to the left
            let ghostY = startY + (logical.height - ghostH) / 2 - 3; // 2px lower
            ghostRect = { x: ghostX, y: ghostY, w: ghostW, h: ghostH };

            if (ghostAlpha > 0) {
                cr.save();
                // Pivot: Center Bottom
                cr.translate(ghostX + ghostW / 2, ghostY + ghostH);
                cr.rotate(angle);
                cr.translate(-ghostW / 2, -ghostH);
                cr.moveTo(0, 0);

                cr.pushGroup();
                PangoCairo.show_layout(cr, layoutG);
                cr.popGroupToSource();
                cr.paintWithAlpha(ghostAlpha);
                cr.restore();
            }

            // Pumpkin Drop (from 18s)
            if (elapsed >= 18000) {
                let dropT = elapsed - 18000;
                let duration = 800; // 0.8s fall time
                let progress = dropT / duration;

                let targetY = ghostY - 1; // Pumpkin 1px higher
                let pY = targetY;
                let pX = ghostX - 3; // Pumpkin 3px to the left
                let pAngle = 0;

                if (progress < 1) {
                    pY = -50 + (targetY + 50) * (progress * progress);
                } else {
                    let landT = dropT - duration;

                    // Stand for 5 seconds (with wiggle)
                    if (landT < 5000) {
                        pY = targetY;
                        if (landT < 1500) { // Stronger wiggle at the beginning
                            pAngle = 0.4 * Math.sin(landT * 0.02) * (1 - landT / 1500);
                        }
                    } else {
                        // Roll out to the right
                        let rollT = landT - 5000;
                        let moveX = 0.0002 * rollT * rollT; // Acceleration
                        pX += moveX;
                        pY = targetY;
                        pAngle = moveX / 10; // Roll rotation

                        // Loop reset when out of frame
                        if (pX > w + 50) {
                            startTime = Date.now();
                            return;
                        }
                    }
                }

                cr.save();
                let layoutP = PangoCairo.create_layout(cr);
                layoutP.set_text("🎃", -1);
                layoutP.set_font_description(Pango.FontDescription.from_string("Sans 17")); // 1px smaller

                let [pInk, pLog] = layoutP.get_pixel_extents();
                cr.translate(pX + pLog.width / 2, pY + pLog.height / 2);
                cr.rotate(pAngle);
                cr.translate(-pLog.width / 2, -pLog.height / 2);

                cr.moveTo(0, 0);
                PangoCairo.show_layout(cr, layoutP);
                cr.restore();
            }

        } else if (isNewYear && _applet.newYearOverlayActive) {
            // --- NEW YEAR ANIMATION (Complex Morph) ---
            let elapsed = Date.now() - startTime;

            let srcText = "Market Dashboard ";
            let tgtText = "Happy New Year";
            let iconText = "🍾";

            // Keep: 'a'(1)->'a'(1), 'e'(4)->'e'(7), 'a'(13)->'a'(12), 'r'(14)->'r'(13)
            let keepMap = { 1: 1, 4: 7, 13: 12, 14: 13 };

            // Generate delays (only once per animation)
            if (!_applet._nyAnimState || _applet._nyAnimState.startTime !== startTime) {
                const pastelColors = [
                    [1.0, 0.7, 0.7], // Pastel Red
                    [0.7, 1.0, 0.7], // Pastel Green
                    [0.7, 0.85, 1.0], // Pastel Blue
                    [1.0, 1.0, 0.7],   // Pastel Yellow
                    [0.9, 0.7, 1.0],   // Pastel Purple
                    [1.0, 0.8, 0.6],  // Pastel Orange
                    [0.6, 0.9, 0.9]  // Pastel Cyan
                ];
                _applet._nyAnimState = {
                    startTime: startTime,
                    srcDelays: srcText.split('').map(() => Math.random() * 1000), // 0-1s random
                    tgtDelays: tgtText.split('').map(() => Math.random() * 1000), // 0-1s random
                    tgtColors: tgtText.split('').map(() => pastelColors[Math.floor(Math.random() * pastelColors.length)]),
                    confettiTriggered: [false, false, false]
                };
            }
            let state = _applet._nyAnimState;

            // Calculate layouts
            let layoutSrc = PangoCairo.create_layout(cr);
            layoutSrc.set_font_description(desc);
            layoutSrc.set_text(srcText, -1);
            let [sInk, sLog] = layoutSrc.get_pixel_extents();

            let layoutIcon = PangoCairo.create_layout(cr);
            layoutIcon.set_font_description(desc);
            layoutIcon.set_markup("<span rise='2048'>" + iconText + "</span>", -1);
            let [iInk, iLog] = layoutIcon.get_pixel_extents();

            let totalW = sLog.width + iLog.width;
            let startX = (w - totalW) / 2;
            let startY = (h - sLog.height) / 2 + 6;

            let descTgt = Pango.FontDescription.from_string("Sans Bold 16"); // Larger font
            // Target Layout (Centered in text area)
            let layoutTgt = PangoCairo.create_layout(cr);
            layoutTgt.set_font_description(descTgt);
            layoutTgt.set_text(tgtText, -1);
            let [tInk, tLog] = layoutTgt.get_pixel_extents();
            let tgtStartX = startX + (sLog.width - tLog.width) / 2;

            // Helper: Calculate positions
            let getCharPositions = (text, startX, fontDesc) => {
                let positions = [];
                let currX = startX;
                for (let i = 0; i < text.length; i++) {
                    let charLayout = PangoCairo.create_layout(cr);
                    charLayout.set_font_description(fontDesc);
                    charLayout.set_text(text[i], -1);
                    let [charInk, charLog] = charLayout.get_pixel_extents();
                    positions.push({ x: currX, w: charLog.width, char: text[i] });
                    currX += charLog.width;
                }
                return positions;
            };

            let srcPos = getCharPositions(srcText, startX, desc);
            let tgtPos = getCharPositions(tgtText, tgtStartX, descTgt);

            // 1. Draw static bottle
            cr.save();
            cr.translate(startX + sLog.width, startY);
            PangoCairo.show_layout(cr, layoutIcon);
            cr.restore();

            // 2. Drop old letters (Irregular)
            srcPos.forEach((p, i) => {
                if (keepMap[i] !== undefined) return; // Stay put
                if (p.char === " ") return;

                let dropDelay = state.srcDelays[i];
                let t = elapsed - dropDelay;

                if (t > 0) {
                    let yOffset = 0.0005 * t * t; // Gravity
                    let alpha = Math.max(0, 1.0 - (t / 800)); // Fade out

                    if (alpha > 0 && startY + yOffset < h + 20) {
                        cr.save();
                        cr.translate(p.x, startY + yOffset);
                        let l = PangoCairo.create_layout(cr);
                        l.set_font_description(desc);
                        l.set_text(p.char, -1);
                        cr.setSourceRGBA(fg.red/255, fg.green/255, fg.blue/255, alpha);
                        PangoCairo.show_layout(cr, l);
                        cr.restore();
                    }
                } else {
                    // Draw static letter before fall
                    cr.save();
                    cr.translate(p.x, startY);
                    let l = PangoCairo.create_layout(cr);
                    l.set_font_description(desc);
                    l.set_text(p.char, -1);
                    cr.setSourceRGBA(fg.red/255, fg.green/255, fg.blue/255, 1.0);
                    PangoCairo.show_layout(cr, l);
                    cr.restore();
                }
            });

            // 3. Move kept letters (Morph)
            for (let srcIdx in keepMap) {
                let tgtIdx = keepMap[srcIdx];
                let pSrc = srcPos[srcIdx];
                let pTgt = tgtPos[tgtIdx];

                // Starts after most have fallen (e.g. from 1000ms)
                let morphDelay = 1000;
                let t = Math.max(0, elapsed - morphDelay);
                let progress = Math.min(1.0, t / 1500); // 1.5s duration

                // Ease-in-out
                let ease = progress < .5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

                let currX = pSrc.x + (pTgt.x - pSrc.x) * ease;

                // Color changes to pastel
                let targetColor = state.tgtColors[tgtIdx];
                let r = 0.9 + (targetColor[0] - 0.9) * ease;
                let g = 0.9 + (targetColor[1] - 0.9) * ease;
                let b = 0.9 + (targetColor[2] - 0.9) * ease;

                // Size grows from 14 to 16
                let currentSize = 14 + (16 - 14) * ease;

                cr.save();
                cr.translate(currX, startY);
                let l = PangoCairo.create_layout(cr);
                l.set_font_description(Pango.FontDescription.from_string("Sans Bold " + currentSize));
                l.set_text(pSrc.char, -1);
                cr.setSourceRGBA(r, g, b, 1.0);
                PangoCairo.show_layout(cr, l);
                cr.restore();
            }

            // 4. New letters fall in from above (Irregular)
            tgtPos.forEach((p, i) => {
                let isKept = false;
                for (let k in keepMap) { if (keepMap[k] === i) isKept = true; }
                if (isKept) return;
                if (p.char === " ") return;

                let dropDelay = 2000 + state.tgtDelays[i]; // Starts from 2s
                let t = elapsed - dropDelay;

                if (t > 0) {
                    let y = startY;
                    let fallTime = 500;
                    if (t < fallTime) {
                        let p = t / fallTime;
                        let startYOffset = -150;
                        y = startY + startYOffset * (1 - p * p); // EaseIn (Accelerate)
                    } else {
                        let settleT = t - fallTime;
                        // Damped bounce
                        let bounce = 12 * Math.exp(-0.006 * settleT) * Math.sin(0.025 * settleT);
                        y = startY + bounce;
                    }

                    cr.save();
                    cr.translate(p.x, y);
                    let l = PangoCairo.create_layout(cr);
                    l.set_font_description(descTgt);
                    l.set_text(p.char, -1);
                    let c = state.tgtColors[i];
                    cr.setSourceRGBA(c[0], c[1], c[2], 1.0);
                    PangoCairo.show_layout(cr, l);
                    cr.restore();
                }
            });

            // 5. Mini Confetti (3x staggered)
            if (elapsed > 3000 && !state.confettiTriggered[0]) {
                state.confettiTriggered[0] = true;
                Animations.startSparkleConfetti(area, null, w / 2 - 100, h / 2);
            }
            if (elapsed > 3500 && !state.confettiTriggered[1]) {
                state.confettiTriggered[1] = true;
                Animations.startSparkleConfetti(area, null, w / 2 + 100, h / 2);
            }
            if (elapsed > 4000 && !state.confettiTriggered[2]) {
                state.confettiTriggered[2] = true;
                Animations.startSparkleConfetti(area, null, w / 2, h / 2 - 50);
            }

        } else {
            // --- STANDARD THEMES ---
            if (isPizza && _applet.apiValid) {
                // PIZZA SPECIAL: Halloween logic (Drawing loop)
                
                // 1. Calculate total width (for centering)
                let tempLayout = PangoCairo.create_layout(cr);
                tempLayout.set_font_description(desc);
                tempLayout.set_text(baseText, -1);
                let [tInk, tLog] = tempLayout.get_pixel_extents();
                
                let layoutIcon = PangoCairo.create_layout(cr);
                layoutIcon.set_font_description(desc);
                layoutIcon.set_markup("<span rise='2048'>" + currentIcon + "</span>", -1);
                let [iInk, iLog] = layoutIcon.get_pixel_extents();
                
                let totalW = tLog.width + iLog.width;
                let startX = (w - totalW) / 2;
                let startY = (h - tLog.height) / 2 + 6;
                
                // House in background (Halloween method)
                if (isEaster) {
                    let layoutHouse = PangoCairo.create_layout(cr);
                    layoutHouse.set_text("🏡", -1);
                    layoutHouse.set_font_description(Pango.FontDescription.from_string("Sans 30"));

                    cr.save();
                    cr.translate(w / 2, h + 4); // Centered, slightly sunken into the grass
                    let [ink, log] = layoutHouse.get_pixel_extents();
                    cr.moveTo(-log.width / 2, -log.height);

                    cr.pushGroup();
                    PangoCairo.show_layout(cr, layoutHouse);
                    cr.popGroupToSource();
                    cr.paintWithAlpha(0.65);
                    cr.restore();
                }

                drawStandardText = () => {
                    let currentX = startX;
                    let chars = baseText.split('');
                    
                    chars.forEach((char, i) => {
                        let charLayout = PangoCairo.create_layout(cr);
                        charLayout.set_font_description(desc);
                        
                        let isB = (i === 11); // The 'b' in Dashboard
                        
                        if (isB) {
                            charLayout.set_markup("<span color='#f7931a'>₿</span>", -1);
                        } else {
                            charLayout.set_text(char, -1);
                        }
                        
                        let [cInk, cLog] = charLayout.get_pixel_extents();
                        
                        cr.save();
                        let yOff = 0;
                        if (isB) {
                            pizzaRect = { x: currentX, y: startY - 5, w: cLog.width, h: cLog.height + 5 };
                            if (pizzaFlyAnim.active) yOff = pizzaFlyAnim.yOffset;
                        }
                        
                        cr.translate(currentX, startY + yOff);
                        
                        if (!isB) cr.setSourceRGBA(fg.red/255, fg.green/255, fg.blue/255, 1.0);
                        
                        if (!isB || !_applet.pizzaOverlayActive || pizzaFlyAnim.active) {
                            PangoCairo.show_layout(cr, charLayout);
                        }
                        
                        cr.restore();
                        currentX += cLog.width;
                    });
                    
                    // Icon
                    cr.setSourceRGBA(fg.red/255, fg.green/255, fg.blue/255, 1.0);
                    
                    if (isEaster) {
                        cr.save();
                        let [iInk, iLog] = layoutIcon.get_pixel_extents();
                        cr.translate(currentX + iLog.width / 2, startY + iLog.height / 2);
                        cr.rotate(0.17); // ~10 degrees to the right
                        cr.translate(-iLog.width / 2, -iLog.height / 2);
                        cr.moveTo(0, 0);
                        PangoCairo.show_layout(cr, layoutIcon);
                        cr.restore();
                    } else {
                        cr.moveTo(currentX, startY);
                        PangoCairo.show_layout(cr, layoutIcon);
                    }
                    
                    // Restore Easter eggs
                    if (isEaster) {
                        // 3 Colorful eggs right of the rabbit (Rear layer -> Draw first)
                        let eggBaseX = currentX + iLog.width + 10; // Right of the icon
                        let eggBaseY = h - 8; 
                        let drawEgg = (x, y, color, angle) => {
                            cr.save(); cr.translate(x, y); cr.rotate(angle); cr.scale(0.8, 1.15);
                            cr.arc(0, 0, 6, 0, 2 * Math.PI); 
                            cr.setSourceRGBA(color[0], color[1], color[2], 1.0); cr.fill();
                            cr.restore();
                        };
                        // Red, Blue, Yellow (Darker)
                        drawEgg(eggBaseX, eggBaseY, [0.75, 0.2, 0.2], -0.2);
                        drawEgg(eggBaseX + 9, eggBaseY + 1, [0.2, 0.4, 0.8], 0.15);
                        drawEgg(eggBaseX + 18, eggBaseY - 1, [0.85, 0.7, 0.1], 0.35);
                        
                        // Blue egg in foreground (before the transparent 'o')
                        // We need to find the position of the 'o'. Since we incremented currentX, we have to calculate back or save it in the loop.
                        // Easier: We use the known position relative to startX.
                        // But since we have variable widths, it is safer to do it in the loop or recalculate here.
                        // We use an approximation based on the index here, since we already had the widths above.
                        // Better: We draw it directly at the place of the 'o' in the loop? No, the 'o' is gone.
                        // We use Pango to find the position of the 'o' in the total text.
                        let tempL = PangoCairo.create_layout(cr); tempL.set_font_description(desc); tempL.set_text(baseText.substring(0, 12), -1);
                        let [ti, tl] = tempL.get_pixel_extents();
                        let oX = startX + tl.width + 7; // +7 as requested before
                        let oY = h - 10; // 3px up
                        drawEgg(oX, oY, [0.2, 0.4, 0.8], 0.15);
                    }
                };
            } else {
                // STANDARD RENDERING
                let bMarkup = "<span color='#f7931a'>₿</span>";
                let fullText = _applet.apiValid ? (isPizza ? "Market Dash" + bMarkup + "oard " : "Market Dashboard ") : "24H Price Change [%] ";
                
                // Easter Special: Replace 'o' with space for the blue egg
                if (isEaster && _applet.apiValid) {
                    fullText = "Market Dashb  ard ";
                }
                
                let layoutText = PangoCairo.create_layout(cr);
                layoutText.set_font_description(desc);
                layoutText.set_markup(fullText, -1);
                let [tInk, tLog] = layoutText.get_pixel_extents();

                let layoutIcon = PangoCairo.create_layout(cr);
                if (isEaster) {
                    let descRabbit = Pango.FontDescription.from_string("Sans 24");
                    layoutIcon.set_font_description(descRabbit);
                    layoutIcon.set_markup("<span rise='-3072'>" + currentIcon + "</span>", -1);
                } else {
                    layoutIcon.set_font_description(desc);
                    layoutIcon.set_markup("<span rise='2048'>" + currentIcon + "</span>", -1);
                }
                let [iInk, iLog] = layoutIcon.get_pixel_extents();

                let totalW = tLog.width + iLog.width;
                let textX = (w - totalW) / 2;
                let textY = (h - tLog.height) / 2 + 6;

                if (isNewYear) {
                    bottleRect = { x: textX + tLog.width, y: textY, w: iLog.width, h: iLog.height };
                }
                
                if (isPizza) {
                    pizzaRect = { x: textX + tLog.width, y: textY, w: iLog.width, h: iLog.height };
                }

                // Define click area for Pizza in Basic Mode
                if (isPizza && !_applet.apiValid) {
                    pizzaRect = { x: textX + tLog.width, y: textY, w: iLog.width, h: iLog.height };
                }

                if ((isEaster || isXmas) && typeof textX === 'number' && !isNaN(textX)) {
                    cr.save();
                    if (isXmas) {
                        // Snowflake left
                        let layoutFlake = PangoCairo.create_layout(cr);
                        layoutFlake.set_text("❄️", -1);
                        layoutFlake.set_font_description(Pango.FontDescription.from_string("Sans 35"));
                        cr.moveTo(textX - 90, textY - 20);
                        cr.pushGroup(); PangoCairo.show_layout(cr, layoutFlake); cr.popGroupToSource(); cr.paintWithAlpha(0.10);

                        // Snowflake right
                        let layoutFlake2 = PangoCairo.create_layout(cr);
                        layoutFlake2.set_text("❄️", -1);
                        layoutFlake2.set_font_description(Pango.FontDescription.from_string("Sans 15"));
                        cr.moveTo(textX - 30, textY - 20);
                        cr.pushGroup(); PangoCairo.show_layout(cr, layoutFlake2); cr.popGroupToSource(); cr.paintWithAlpha(0.10);

                        // Evergreen tree right
                        let layoutTree = PangoCairo.create_layout(cr);
                        layoutTree.set_text("🌲", -1);
                        layoutTree.set_font_description(Pango.FontDescription.from_string("Sans 18"));
                        cr.moveTo(textX + totalW - 15, textY - 5);
                        cr.pushGroup(); PangoCairo.show_layout(cr, layoutTree); cr.popGroupToSource(); cr.paintWithAlpha(0.28);

                        // Second tree (smaller, right next to it)
                        let layoutTree2 = PangoCairo.create_layout(cr);
                        layoutTree2.set_text("🌲", -1);
                        layoutTree2.set_font_description(Pango.FontDescription.from_string("Sans 15"));
                        cr.moveTo(textX - 5 + totalW + 6, textY - 0);
                        cr.pushGroup(); PangoCairo.show_layout(cr, layoutTree2); cr.popGroupToSource(); cr.paintWithAlpha(0.25);
                    } else { // isEaster
                        // 3 Colorful eggs right of the rabbit (Rear layer -> Draw first)
                        let eggBaseX = textX + totalW - 5; // 5px further to the left
                        let eggBaseY = h - 4; // 2px further down (was -6)
                        let drawEgg = (x, y, color, angle) => {
                            cr.save(); cr.translate(x, y); cr.rotate(angle); cr.scale(0.8, 1.15);
                            cr.arc(0, 0, 5, 0, 2 * Math.PI); // Slightly larger (5)
                            cr.setSourceRGBA(color[0], color[1], color[2], 0.7); cr.fill();
                            cr.restore();
                        };
                        // Strong colors (Darker), same layer
                        drawEgg(eggBaseX, eggBaseY, [0.75, 0.2, 0.2], -0.2);
                        drawEgg(eggBaseX + 8, eggBaseY, [0.2, 0.4, 0.8], 0.15);
                        drawEgg(eggBaseX + 16, eggBaseY, [0.85, 0.7, 0.1], 0.35);

                        let treeDist = -1; let treeRadius = 9; let treeX = textX - treeDist - treeRadius;
                        let tree2Radius = treeRadius * 0.75; let tree2X = treeX - 11;
                        cr.setSourceRGBA(0.55, 0.35, 0.2, 0.4); cr.rectangle(tree2X - 1.5, h - 11, 3, 11); cr.fill();
                        cr.setSourceRGBA(0.06, 0.25, 0.06, 1.0); cr.arc(tree2X, h - 16, tree2Radius, 0, 2 * Math.PI); cr.fill();
                        cr.setSourceRGBA(0.55, 0.35, 0.2, 0.4); cr.rectangle(treeX - 2, h - 14, 4, 14); cr.fill();
                        cr.setSourceRGBA(0.1, 0.35, 0.1, 1.0); cr.arc(treeX, h - 20, 9, 0, 2 * Math.PI); cr.fill();
                    }
                    cr.restore();
                }

                drawStandardText = () => {
                    cr.setSourceRGBA(fg.red/255, fg.green/255, fg.blue/255, 1.0);
                    cr.moveTo(textX, textY);
                    PangoCairo.show_layout(cr, layoutText);
                    // Always draw icon statically, no animation here
                    let iconX = textX + tLog.width;
                    let iconY = textY;
                    if (isEaster) {
                        iconX -= 8; // 3px further to the left (was -5)
                        iconY -= 11; // 1px further up (was -10)
                        
                        cr.save();
                        let [iInk, iLog] = layoutIcon.get_pixel_extents();
                        cr.translate(iconX + iLog.width / 2, iconY + iLog.height / 2);
                        cr.rotate(0.17); // ~10 degrees to the right
                        cr.translate(-iLog.width / 2, -iLog.height / 2);
                        cr.moveTo(0, 0);
                        PangoCairo.show_layout(cr, layoutIcon);
                        cr.restore();
                    } else {
                        cr.moveTo(iconX, iconY);
                        PangoCairo.show_layout(cr, layoutIcon);
                    }

                    // Blue egg in foreground (in front of text)
                    if (isEaster && _applet.apiValid) {
                        let pos = layoutText.index_to_pos(12); // 'o'
                        let oX = pos.x / Pango.SCALE;
                        let eggX = textX + oX + 4; // 2px further to the right (was +2)
                        let eggY = h - 13; // 3px further up (was -10)

                        cr.save(); 
                        cr.translate(eggX, eggY); 
                        cr.rotate(0.15); 
                        cr.scale(0.8, 1.15);
                        cr.arc(0, 0, 6, 0, 2 * Math.PI); 
                        cr.setSourceRGBA(0.2, 0.4, 0.8, 0.9); // 90% Opacity, Darker
                        cr.fill();
                        cr.restore();
                    }
                };
            }
        }

        // Christmas light chain
        if (isXmas) {
            // Triangle points for a centered Christmas tree
            let p1 = { x: w / 2, y: 8 };           // Tip
            let p2 = { x: w / 2 - 15, y: h - 4 };  // Bottom left (narrower)
            let p3 = { x: w / 2 + 15, y: h - 4 };  // Bottom right (narrower)

            cr.save();
            cr.setSourceRGBA(0.15, 0.15, 0.15, 0.9); // Cable
            cr.setLineWidth(1.5);

            // Draw cable as triangle
            cr.moveTo(p1.x, p1.y);
            cr.lineTo(p2.x, p2.y);
            cr.lineTo(p3.x, p3.y);
            cr.closePath(); // Closes the path from p3 to p1
            cr.stroke();

            // Calculate path segments and total length to distribute bulbs evenly
            let path = [p1, p2, p3, p1];
            let totalLength = 0;
            let segments = [];
            for (let i = 0; i < path.length - 1; i++) {
                let dx = path[i + 1].x - path[i].x;
                let dy = path[i + 1].y - path[i].y;
                let len = Math.sqrt(dx * dx + dy * dy);
                segments.push({ start: path[i], end: path[i + 1], dx: dx, dy: dy, len: len, startLen: totalLength });
                totalLength += len;
            }

            let time = Date.now();
            const bulbColors = [[1, 0.2, 0.2], [0.2, 1, 0.2], [0.2, 0.5, 1], [1, 1, 0.2], [1, 0.5, 0], [1, 0.2, 1]];

            lightChainData.bulbs.forEach((bulb, i) => {
                // Distribute bulbs along the total length of the path
                let dist = (i / lightChainData.bulbs.length) * totalLength;

                let seg = segments.find(s => dist >= s.startLen && dist < s.startLen + s.len);
                if (!seg) seg = segments[segments.length - 1];

                let distInSeg = dist - seg.startLen;
                let t = seg.len > 0 ? distInSeg / seg.len : 0;

                let bx = seg.start.x + t * seg.dx;
                let by = seg.start.y + t * seg.dy;

                let c = bulb.color;
                if (i > 0) {
                    // Colors change smoother (interpolation) and slower
                    let colorSpeed = 0.00015;
                    let colorT = (time * colorSpeed) + i;
                    let idx1 = Math.floor(colorT) % bulbColors.length;
                    let idx2 = (idx1 + 1) % bulbColors.length;
                    let t = colorT - Math.floor(colorT);

                    let c1 = bulbColors[idx1];
                    let c2 = bulbColors[idx2];
                    c = [c1[0] * (1 - t) + c2[0] * t, c1[1] * (1 - t) + c2[1] * t, c1[2] * (1 - t) + c2[2] * t];
                }

                let blink = Math.sin(time * bulb.speed + bulb.offset);
                let alpha;

                if (i === 0) { // Star
                    alpha = 0.7 + 0.3 * ((blink + 1) / 2); // Subtle, soft glow for the star
                } else { // Lights
                    alpha = 0.25 + 0.75 * ((blink + 1) / 2); // Stronger dimming for lights
                }

                if (i === 0) {
                    // Star at the tip
                    starRect = { x: bx - 12, y: by - 12, w: 24, h: 24 }; // Save click area
                    let starSize = 7;

                    // Glow for star
                    let pat = new Cairo.RadialGradient(bx, by, 1, bx, by, starSize * 1.5);
                    pat.addColorStopRGBA(0, 1, 0.85, 0.1, alpha * 0.8);
                    pat.addColorStopRGBA(1, 1, 0.85, 0.1, 0);
                    cr.setSource(pat);
                    cr.arc(bx, by, starSize * 1.5, 0, 2 * Math.PI);
                    cr.fill();

                    cr.save();
                    cr.translate(bx, by);
                    cr.setSourceRGBA(1, 0.85, 0.1, alpha); // Gold
                    cr.moveTo(0, -starSize);
                    for (let k = 0; k < 5; k++) {
                        cr.rotate(Math.PI / 5);
                        cr.lineTo(0, -starSize * 0.4);
                        cr.rotate(Math.PI / 5);
                        cr.lineTo(0, -starSize);
                    }
                    cr.fill();
                    cr.restore();
                } else {
                    let bulbSize = bulb.size;
                    let pat = new Cairo.RadialGradient(bx, by, 1, bx, by, bulbSize);
                    pat.addColorStopRGBA(0, c[0], c[1], c[2], alpha * 0.9);
                    pat.addColorStopRGBA(1, c[0], c[1], c[2], 0);
                    cr.setSource(pat);
                    cr.arc(bx, by, bulbSize, 0, 2 * Math.PI);
                    cr.fill();

                    cr.setSourceRGBA(c[0], c[1], c[2], 0.9);
                    cr.arc(bx, by, bulbSize * 0.3, 0, 2 * Math.PI);
                    cr.fill();
                }
            });
            cr.restore();
        }

        if (drawStandardText) drawStandardText();

        cr.$dispose();
    });

    // Helper: Determine height of content area to prevent jumping
    let captureHeight = () => {
        let h = 0;
        
        if (_applet.apiValid) {
            // --- API MODE ---
            // Determine exact height of the first metric (incl. chart)
            if (_applet.metrics[1] && _applet.metrics[1].mainBox) {
                try {
                    let alloc = _applet.metrics[1].mainBox.get_allocation_box();
                    h = alloc.y2 - alloc.y1;
                    // FIX: Subtract overlay padding (20px) as 'height' in style defines the content box
                    if (h > 10) h -= 10;
                } catch (e) {}
            }
            // Fallback API
            if (h <= 0) h = 148;
        } else {
            // --- BASIC MODE ---
            // Determine height of the entire metric section (all 3 rows)
            if (_applet.metricsSectionActor) {
                try {
                    let alloc = _applet.metricsSectionActor.get_allocation_box();
                    h = alloc.y2 - alloc.y1;
                    
                    // Fallback: Sum children if allocation is implausible
                    if (h < 50) {
                        let children = _applet.metricsSectionActor.get_children();
                        let sum = 0;
                        children.forEach(c => { let a = c.get_allocation_box(); sum += (a.y2 - a.y1); });
                        if (sum > h) h = sum;
                    }
                    
                    // Correction Basic: Padding (20px) + Margin (9px) + Tolerance
                    if (h > 30) h -= 30;
                } catch (e) {}
            }
            // Fallback Basic
            if (h <= 0) h = 130;
        }
        
        _applet.ghostOverlayHeight = h;
    };

    // Click handler for the ghost
    area.connect('button-release-event', (actor, event) => {
        let [stageX, stageY] = event.get_coords();
        let [ax, ay] = actor.get_transformed_position();
        let relX = stageX - ax;
        let relY = stageY - ay;

        // NEW YEAR BOTTLE CHECK
        if (bottleRect && relX >= bottleRect.x && relX <= bottleRect.x + bottleRect.w &&
            relY >= bottleRect.y && relY <= bottleRect.y + bottleRect.h) {

            if (_applet.newYearOverlayActive) return true;

            _applet.menu.close = () => { };
            _applet.newYearOverlayActive = true;
            _applet.newYearStartTime = Date.now();
            startTime = _applet.newYearStartTime;

            _applet._buildMenu();
            Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });

            if (_applet._nyMetricTimeout) Mainloop.source_remove(_applet._nyMetricTimeout);
            _applet._nyMetricTimeout = Mainloop.timeout_add(4500, () => {
                _applet._nyMetricTimeout = null;

                // Block closing briefly for stable transition
                _applet.menu.close = () => { };

                captureHeight();

                _applet.newYearMetricActive = true;
                _applet._buildMenu();

                Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                return false;
            });

            return true;
        }

        // 1. HALLOWEEN GHOST CHECK
        if (ghostRect && relX >= ghostRect.x && relX <= ghostRect.x + ghostRect.w &&
            relY >= ghostRect.y && relY <= ghostRect.y + ghostRect.h) {

            // Only clickable when 100% opacity (5s - 15s)
            let elapsed = Date.now() - startTime;
            if (elapsed < 5000 || elapsed >= 15000) return false;

            captureHeight();
            _applet.menu.close = () => { }; // Keep menu open
            _applet.ghostOverlayActive = true;
            _applet._buildMenu();

            Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });

            if (_applet._ghostTimer) Mainloop.source_remove(_applet._ghostTimer);
            _applet._ghostTimer = Mainloop.timeout_add(5000, () => {
                // Fade Out Ghost
                if (_applet.activeGhostActor) {
                    if (_applet.activeGhostActor.get_opacity() === 0) {
                        _applet.menu.close = () => { };
                        _applet.ghostOverlayActive = false;
                        _applet._ghostTimer = null;
                        _applet.activeGhostActor = null;
                        _applet.fadeInChart = true;
                        _applet._buildMenu();
                        _applet.fadeInChart = false;
                        Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                        return false;
                    }

                    let steps = 20;
                    let step = 0;
                    Mainloop.timeout_add(25, () => {
                        step++;
                        if (!_applet.activeGhostActor) return false;
                        try { _applet.activeGhostActor.set_opacity(255 * (1 - step / steps)); } catch (e) { }

                        if (step >= steps) {
                            _applet.menu.close = () => { };
                            _applet.ghostOverlayActive = false;
                            _applet._ghostTimer = null;
                            _applet.activeGhostActor = null;
                            _applet.fadeInChart = true;
                            _applet._buildMenu();
                            _applet.fadeInChart = false;
                            Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                            return false;
                        }
                        return true;
                    });
                } else {
                    _applet.menu.close = () => { };
                    _applet.ghostOverlayActive = false;
                    _applet._ghostTimer = null;
                    _applet._buildMenu();
                    Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                }
                return false;
            });
            return true;
        }

        // 2. XMAS STAR CHECK
        if (starRect && relX >= starRect.x && relX <= starRect.x + starRect.w &&
            relY >= starRect.y && relY <= starRect.y + starRect.h) {

            if (_applet.starLocked) return true;

            // Date Check: December 24th and 25th OR explicit Christmas Eve theme
            let d = new Date();
            let mon = d.getMonth();
            let day = d.getDate();
            let isDateMatch = (mon === 11 && (day === 24 || day === 25));
            let isForcedEve = (_applet.currentTheme.name === 'xmas_eve');

            if (!isDateMatch && !isForcedEve) return false;

            captureHeight();
            _applet.menu.close = () => { };
            _applet.giftOverlayActive = true;
            _applet.starLocked = true;
            Mainloop.timeout_add_seconds(15, () => { _applet.starLocked = false; return false; });

            Mainloop.timeout_add(20, () => {
                _applet._buildMenu();
                Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                return false;
            });

            if (_applet._ghostTimer) Mainloop.source_remove(_applet._ghostTimer);
            _applet._ghostTimer = Mainloop.timeout_add(6000, () => {
                // Fade Out Gift
                if (_applet.activeGiftActor) {
                    let steps = 20;
                    let step = 0;
                    Mainloop.timeout_add(25, () => {
                        step++;
                        if (!_applet.activeGiftActor) return false;
                        try { _applet.activeGiftActor.set_opacity(255 * (1 - step / steps)); } catch (e) { }

                        if (step >= steps) {
                            _applet.menu.close = () => { };
                            _applet.giftOverlayActive = false;
                            _applet._ghostTimer = null;
                            _applet.activeGiftActor = null;
                            _applet.fadeInChart = true;
                            _applet._buildMenu();
                            _applet.fadeInChart = false;
                            Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                            return false;
                        }
                        return true;
                    });
                } else {
                    _applet.menu.close = () => { };
                    _applet.giftOverlayActive = false;
                    _applet._ghostTimer = null;
                    _applet._buildMenu();
                    Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                }
                return false;
            });
            return true;
        }

        // 3. PIZZA CHECK
        if (pizzaRect && relX >= pizzaRect.x && relX <= pizzaRect.x + pizzaRect.w &&
            relY >= pizzaRect.y && relY <= pizzaRect.y + pizzaRect.h) {

            if (_applet.pizzaOverlayActive) return true;

            // Split logic: API mode with animation, Basic mode without.
            if (_applet.apiValid) {
                if (pizzaFlyAnim.active) return true;

                pizzaFlyAnim.active = true;
                pizzaFlyAnim.yOffset = 0;
                let velocity = -2.7; // Less speed = less height (approx. 20px)
                let gravity = 0.4;
                let bounceCount = 0;
                let phase = 'bounce';
                let waitFrames = 0;
                
                let flyLoop = Mainloop.timeout_add(20, () => {
                    if (!area) return false;
                    
                    if (phase === 'wait') {
                        waitFrames--;
                        if (waitFrames <= 0) {
                            if (bounceCount < 2) { phase = 'bounce'; velocity = -2.7; }
                            else { phase = 'fly'; velocity = -1.0; }
                        }
                    } else if (phase === 'bounce') {
                        pizzaFlyAnim.yOffset += velocity;
                        velocity += gravity;
                        if (pizzaFlyAnim.yOffset >= 0 && velocity > 0) {
                            pizzaFlyAnim.yOffset = 0;
                            bounceCount++;
                            phase = 'wait';
                            // 1. Pause short (5 frames = 100ms), 2. Pause longer (15 frames = 300ms)
                            waitFrames = (bounceCount < 2) ? 3 : 7;
                        }
                    } else { velocity -= 0.5; pizzaFlyAnim.yOffset += velocity; }

                    area.queue_repaint();

                    if (pizzaFlyAnim.yOffset < -60 && phase === 'fly') {
                        // Animation finished -> Start overlay
                        
                        // Wait time (800ms) before overlay appears
                        Mainloop.timeout_add(800, () => {
                            captureHeight();
                            _applet.menu.close = () => { };
                            _applet.pizzaOverlayActive = true;
                            _applet._buildMenu();
                            Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                            return false;
                        });

                        return false; // Stops the loop
                    }
                    return true;
                });
                area.connect('destroy', () => { if (flyLoop) Mainloop.source_remove(flyLoop); });
            } else {
                // Basic mode: Start overlay immediately, no animation
                captureHeight();
                _applet.menu.close = () => { };
                _applet.pizzaOverlayActive = true;
                _applet._buildMenu();
                Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
            }

            // Common logic for closing the overlay after 5 seconds
            if (_applet._ghostTimer) Mainloop.source_remove(_applet._ghostTimer);
            _applet._ghostTimer = Mainloop.timeout_add(5000, () => {
                if (_applet.activeGiftActor) { 
                    let steps = 20; let step = 0;
                    Mainloop.timeout_add(25, () => {
                        step++;
                        if (!_applet.activeGiftActor) return false;
                        try { _applet.activeGiftActor.set_opacity(255 * (1 - step / steps)); } catch (e) { }
                        if (step >= steps) {
                            _applet.menu.close = () => { }; _applet.pizzaOverlayActive = false; _applet._ghostTimer = null; _applet.activeGiftActor = null; _applet.fadeInChart = true; _applet._buildMenu(); _applet.fadeInChart = false; Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                            return false;
                        }
                        return true;
                    });
                } else {
                    _applet.menu.close = () => { }; _applet.pizzaOverlayActive = false; _applet._ghostTimer = null; _applet._buildMenu(); Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                }
                return false;
            });

            return true;
        }
        return false;
    });

    let animId = Mainloop.timeout_add(50, () => {
        if (!area) return false;
        let [w, h] = area.get_surface_size();

        particles.forEach(f => {
            // Easter eggs landing
            if (isEaster && f.landed) {
                f.landTime--;
                if (f.landTime <= 0) {
                    f.y = -0.1; f.x = 0.05 + Math.random() * 0.9;
                    f.landed = false;
                }
                return; // Stay put
            }

            f.y += f.v;
            f.r += f.rv; // Update rotation
            if (isHalloween) {
                if (f.icon === "👻" && f.wiggle) {
                    f.r = f.baseR + Math.sin(Date.now() * 0.003 + f.y * 10) * 0.2; // Soft wiggle
                }

                if (f.hType === 1) {
                    f.x += f.hSpeed; // Horizontal travel
                    if (f.x > 1.1) f.x = -0.1; // Wrap right -> left
                    if (f.x < -0.1) f.x = 1.1; // Wrap left -> right
                } else {
                    f.x += Math.sin(Date.now() * 0.001 + f.y * 10) * 0.005; // Swing
                }

                // Growing effect (approaching)
                if (f.grow) {
                    if (!f.shrinking) {
                        f.s += 0.008;
                        if (f.s > 2.8) f.shrinking = true; // Max size reached -> Shrink
                    } else {
                        f.s -= 0.008; // Shrink again
                    }
                }
            } else {
                if (isFirework) {
                    // Glow effect for fireworks
                    let baseAlpha = 0.5 + 0.5 * Math.abs(Math.sin(f.y * 10 + Date.now() * 0.005));

                    // Soft fade out at end of life (last 60 frames / 3s)
                    if (f.life < 60) {
                        f.alpha = baseAlpha * (f.life / 60);
                    } else {
                        f.alpha = baseAlpha;
                    }

                    f.life--;
                    if (f.life <= 0) {
                        f.y = -0.1; f.x = 0.05 + Math.random() * 0.9; f.life = Math.random() * 200 + 50;
                    }
                }
                f.x += (Math.random() - 0.5) * 0.0015;
            }

            // Collision detection for Easter eggs
            if (isEaster && w > 0) {
                let gx = f.x * w;
                let margin = 76;
                let grassH = 0;
                if (gx >= margin && gx <= w - margin) {
                    let gt = Date.now() * 0.0005;
                    let shape = (Math.sin(gx * 0.015) + 1) * 0.15 + (Math.sin(gx * 0.005) + 1) * 0.06;
                    let sway = Math.sin(gt + gx * 0.01) * 0.5;
                    let edgeDist = Math.min(gx - margin, (w - margin) - gx);
                    let fade = (edgeDist < 50) ? (edgeDist / 50) : 1.0;
                    grassH = (2 + shape + sway) * fade;
                }
                let grassY = 1.0 - (grassH / h); // Normalized Y

                if (grassH > 0 && f.y >= grassY && f.y < grassY + 0.1) { // Ground touched
                    if (Math.random() > 0.4) { // 60% chance to stay put
                        f.y = grassY;
                        f.landed = true;
                        f.landTime = 50 + Math.random() * 100;
                    }
                }
            }

            // Reset only if out bottom OR (if growing) if they are small/transparent again
            let reset = (f.y > 1);
            if (f.grow && f.shrinking && f.s < 0.5) reset = true;

            if (reset) {
                f.y = -0.1; f.x = 0.05 + Math.random() * 0.9;
                if (f.grow) { f.s = 0.5; f.shrinking = false; }
            }
        });
        area.queue_repaint();
        return true;
    });

    area.connect('destroy', () => { if (animId) Mainloop.source_remove(animId); });
    headContainer.add(area);
}

var Header = {
    init: init,
    createTimeframeSection: createTimeframeSection,
    drawHeader: drawHeader
};