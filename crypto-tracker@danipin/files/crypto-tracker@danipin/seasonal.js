const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const Cairo = imports.gi.cairo;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Animations = imports.animations.Animations;
const Utils = imports.utils.Utils;

const Gettext = imports.gettext;
const UUID = "crypto-tracker@danipin";

function _(str) {
  let forced = _applet ? _applet.forcedLocale : null;
  if (forced && forced !== "system") {
      let old = GLib.getenv("LANGUAGE");
      GLib.setenv("LANGUAGE", forced, true);
      let res = Gettext.dgettext(UUID, str);
      if (old) GLib.setenv("LANGUAGE", old, true);
      else GLib.unsetenv("LANGUAGE");
      return res;
  }
  return Gettext.dgettext(UUID, str);
}

var _applet;

function init(applet) {
    _applet = applet;
}

function handleMetricOverlay(item, metricIndex) {
    const i = metricIndex;
    const m = _applet.metrics[i];

    // Check if any overlay is active
    let isOverlayActive = _applet.ghostOverlayActive || _applet.newYearMetricActive || _applet.giftOverlayActive || _applet.pizzaOverlayActive;

    // In Basic Mode: Hide metrics 2 and 3 if overlay is active to make room
    if (!_applet.apiValid && isOverlayActive && i > 1) {
        return 'hide';
    }

    // Halloween Easter-Egg: Big Ghost instead of Metric 1
    if (i === 1 && _applet.ghostOverlayActive) {
        let width = "100%";
        let height = (_applet.ghostOverlayHeight > 0) ? _applet.ghostOverlayHeight + "px" : (_applet.apiValid ? "165px" : "130px");
        let ghostContainer = new St.Widget({ layout_manager: new Clutter.BinLayout(), style: "min-width: " + width + "; height: " + height + "; padding: 10px 15px;" });

        let bigGhost = new St.Label({ text: "👻", style: "font-size: 110px;" });
        _applet.activeGhostActor = bigGhost;

        bigGhost.set_pivot_point(0.5, 0.5);
        bigGhost.set_x_align(Clutter.ActorAlign.CENTER);
        bigGhost.set_y_align(Clutter.ActorAlign.CENTER);

        // Animation: Fall-in, then wiggle
        let fallPhase = 'fall';
        let y = -200; // Start off-screen top
        bigGhost.set_translation(0, y, 0);
        bigGhost.set_scale(0.25, 0.25);
        bigGhost.set_opacity(255 * 0.25);
        let velocity = 0;
        let wT = 0;
        let waitFrames = 0;

        let fallAnimFunc = () => {
            if (!bigGhost) return false;

            if (fallPhase === 'fall') {
                velocity += 0.5; // Gravity (viel langsamer)
                y += velocity;

                let targetY = 0;
                let startY = -200;
                let progress = Math.max(0, Math.min(1, (y - startY) / (targetY - startY)));

                let scale = 0.25 + (0.75 * progress);
                bigGhost.set_scale(scale, scale);
                bigGhost.set_opacity(255 * scale);

                if (y >= targetY) {
                    y = targetY;
                    fallPhase = 'wait';
                    Utils.sendNotification("Crypto-Tracker", _("HAPPY HALLOWEEN !"), "complete.oga", "face-smile-symbolic");
                }

                bigGhost.set_translation(0, y, 0);
                return true;
            }
            else if (fallPhase === 'wait') {
                waitFrames++;
                if (waitFrames > 15) fallPhase = 'wiggle';
                return true;
            }
            else if (fallPhase === 'wiggle') {
                wT += 0.3;
                if (wT >= 8 * Math.PI) {
                    bigGhost.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, 0);

                    // Explosion only AFTER wiggling
                    if (bigGhost) {
                        let op = 255;
                        Mainloop.timeout_add(15, () => {
                            if (!bigGhost) return false;
                            op -= 20;
                            if (op <= 0) { bigGhost.set_opacity(0); return false; }
                            bigGhost.set_opacity(op);
                            return true;
                        });

                        let [gx, gy] = bigGhost.get_transformed_position();
                        let [gw, gh] = bigGhost.get_transformed_size();
                        let globalArea = new St.DrawingArea({ reactive: false });
                        globalArea.set_size(global.stage.width, global.stage.height);
                        Main.uiGroup.add_actor(globalArea);
                        globalArea.raise_top();
                        Animations.startCandyConfetti(globalArea, () => { globalArea.destroy(); }, gx + gw / 2, gy + gh / 2);
                    }
                    fallAnimId = null;
                    return false;
                }
                let angle = 15 * Math.sin(wT);
                bigGhost.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, angle);
                return true;
            }
            return false;
        };

        let fallAnimId = Mainloop.timeout_add(20, fallAnimFunc);
        bigGhost.connect('destroy', () => { if (fallAnimId) { Mainloop.source_remove(fallAnimId); fallAnimId = null; } });

        ghostContainer.add_child(bigGhost);

        item.addActor(ghostContainer, { expand: true });

        // Click on the ghost should not close the menu
        item.connect('activate', () => {
            _applet.menu.close = () => { };
            Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
        });
        return true;
    }

    // New Year Easter-Egg: Champagne glasses instead of Metric 1
    if (i === 1 && _applet.newYearMetricActive) {
        let width = "100%";
        let height = (_applet.ghostOverlayHeight > 0) ? _applet.ghostOverlayHeight + "px" : (_applet.apiValid ? "165px" : "130px");
        let container = new St.Widget({ layout_manager: new Clutter.BinLayout(), style: "min-width: " + width + "; height: " + height + "; padding: 10px 15px;" });

        // Year Layer (Background)
        let yearArea = new St.DrawingArea({ reactive: false });
        yearArea.set_x_expand(true);
        yearArea.set_y_expand(true);
        yearArea.set_opacity(0); // Initially invisible

        // Glasses Layer (Foreground)
        let bigGlasses = new St.Label({ text: "🥂", style: "font-size: 110px;" });

        bigGlasses.set_pivot_point(0.5, 0.5);
        bigGlasses.set_x_align(Clutter.ActorAlign.CENTER);
        bigGlasses.set_y_align(Clutter.ActorAlign.CENTER);
        bigGlasses.set_opacity(255);

        // Calculate year (Old -> New)
        let d = new Date();
        let targetYear = d.getFullYear();
        // FIX: Show next year from February onwards (Preview), otherwise it looks outdated when testing
        if (d.getMonth() > 0) targetYear += 1;
        let oldYearStr = (targetYear - 1).toString();
        let newYearStr = targetYear.toString();

        // Automatically detect from which digit the year changes
        // (Important for decade changes like 2029 -> 2030)
        let changeIdx = 0;
        while (changeIdx < oldYearStr.length && oldYearStr[changeIdx] === newYearStr[changeIdx]) {
            changeIdx++;
        }

        let yearAnim = {
            phase: 'static', // static, dropping, hold
            oldY: 0, oldVel: 0,
            newY: -150, newVel: 0,
            holdCounter: 0
        };

        // Draw year (Pastel)
        Utils.safeRepaint(yearArea, (a, cr, w, h) => {
            const pastelColors = [[1.0, 0.7, 0.7], [0.7, 1.0, 0.7], [0.7, 0.85, 1.0], [1.0, 1.0, 0.7]];

            let layout = PangoCairo.create_layout(cr);
            let desc = Pango.FontDescription.from_string("Sans Bold 60");
            layout.set_font_description(desc);

            // Calculate layout based on old year
            layout.set_text(oldYearStr, -1);
            let [ink, log] = layout.get_pixel_extents();

            let startX = (w - log.width) / 2;
            let startY = (h - log.height) / 2 - 10;
            let currX = startX;

            for (let k = 0; k < oldYearStr.length; k++) {
                let c = pastelColors[k % pastelColors.length];
                let cl = PangoCairo.create_layout(cr);
                cl.set_font_description(desc);

                // Calculate width based on new digit (for layout stability)
                cl.set_text(newYearStr[k], -1);
                let [ci, cl_log] = cl.get_pixel_extents();
                let charWidth = cl_log.width;

                if (k < changeIdx) {
                    // Static part (Prefix)
                    cr.setSourceRGBA(c[0], c[1], c[2], 1.0);
                    cr.moveTo(currX, startY);
                    PangoCairo.show_layout(cr, cl);
                } else {
                    // Animated part (Suffix)
                    // Old (falls away)
                    if (yearAnim.phase !== 'hold') {
                        let clOld = PangoCairo.create_layout(cr); clOld.set_font_description(desc); clOld.set_text(oldYearStr[k], -1);
                        cr.setSourceRGBA(c[0], c[1], c[2], 1.0); cr.moveTo(currX, startY + yearAnim.oldY); PangoCairo.show_layout(cr, clOld);
                    }
                    // New (falls in)
                    if (yearAnim.phase === 'dropping' || yearAnim.phase === 'hold') {
                        cr.setSourceRGBA(c[0], c[1], c[2], 1.0); cr.moveTo(currX, startY + yearAnim.newY); PangoCairo.show_layout(cr, cl);
                    }
                }
                currX += charWidth;
            }
        });

        // Animation
        let phase = 'fall';
        let velocity = 0;
        let y = -250;
        let wT = 0;
        let waitFrames = 0;

        bigGlasses.set_translation(0, y, 0);

        let animFunc = () => {
            if (!bigGlasses) return false;

            if (phase === 'fall') {
                velocity += 2.5;
                y += velocity;
                if (y >= 0) {
                    y = 0;
                    velocity = -velocity * 0.5; // First Bounce (Energy loss)
                    phase = 'bounce';
                }
                bigGlasses.set_translation(0, y, 0);
                return true;
            } else if (phase === 'bounce') {
                velocity += 2.5; // Gravity
                y += velocity;
                if (y >= 0) {
                    y = 0;
                    velocity = -velocity * 0.5; // Further Bounces
                    if (Math.abs(velocity) < 1.0) {
                        phase = 'firework';
                    }
                }
                bigGlasses.set_translation(0, y, 0);
                return true;
            } else if (phase === 'firework') {
                let [gx, gy] = bigGlasses.get_transformed_position();
                let [gw, gh] = bigGlasses.get_transformed_size();
                let globalArea = new St.DrawingArea({ reactive: false });
                globalArea.set_size(global.stage.width, global.stage.height);
                Main.uiGroup.add_actor(globalArea);
                globalArea.raise_top();
                Animations.startNewYearConfetti(globalArea, () => { globalArea.destroy(); }, gx + gw / 2, gy + gh / 2);
                phase = 'dissolve';
                return true;
            } else if (phase === 'dissolve') {
                waitFrames++;
                // Fade out glasses (approx. 1 second)
                let glassProgress = Math.min(1.0, waitFrames / 50);
                bigGlasses.set_opacity(255 * (1 - glassProgress));

                // Fade in number (starts late and slow)
                let yearStart = 40;
                let yearDuration = 100;
                let yearProgress = 0;

                if (waitFrames > yearStart) {
                    yearProgress = Math.min(1.0, (waitFrames - yearStart) / yearDuration);
                }
                yearArea.set_opacity(255 * yearProgress);

                if (yearProgress >= 1.0) {
                    phase = 'year_drop';
                    yearAnim.phase = 'dropping';
                    yearArea.queue_repaint();
                }
                return true;
            } else if (phase === 'year_drop') {
                let gravity = 0.4;
                yearAnim.oldVel += gravity; yearAnim.oldY += yearAnim.oldVel;

                if (yearAnim.newY < 0 || yearAnim.newVel !== 0) {
                    yearAnim.newVel += gravity; yearAnim.newY += yearAnim.newVel;
                    if (yearAnim.newY >= 0) {
                        yearAnim.newY = 0; yearAnim.newVel = -yearAnim.newVel * 0.5; // Bounce
                        if (Math.abs(yearAnim.newVel) < 0.5) { yearAnim.newY = 0; yearAnim.newVel = 0; phase = 'year_hold'; }
                    }
                }
                yearArea.queue_repaint();
                return true;
            } else if (phase === 'year_hold') {
                yearAnim.holdCounter++;
                if (yearAnim.holdCounter >= 150) { // 3 seconds (150 * 20ms)
                    // Fade out year, then fade in chart
                    let steps = 20;
                    let step = 0;
                    Mainloop.timeout_add(25, () => {
                        step++;
                        if (!yearArea) return false;
                        try { yearArea.set_opacity(255 * (1 - step / steps)); } catch (e) { }

                        if (step >= steps) {
                            _applet.newYearOverlayActive = false;
                            _applet.newYearMetricActive = false;
                            _applet.newYearStartTime = 0;
                            _applet.menu.close = () => { };
                            _applet.fadeInChart = true; // Enable fade-in
                            _applet._buildMenu();
                            _applet.fadeInChart = false; // Reset flag
                            Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                            return false;
                        }
                        return true;
                    });
                    animId = null;
                    return false; // Stop year_hold loop
                }
                return true;
            }
            return false;
        };
        let animId = Mainloop.timeout_add(20, animFunc);
        bigGlasses.connect('destroy', () => { if (animId) Mainloop.source_remove(animId); });
        container.add_child(yearArea); container.add_child(bigGlasses);
        item.addActor(container, { expand: true });
        return true;
    }

    // Xmas Easter-Egg: Gifts instead of Metric 1
    if (i === 1 && _applet.giftOverlayActive) {
        let width = "100%";
        let height = (_applet.ghostOverlayHeight > 0) ? _applet.ghostOverlayHeight + "px" : (_applet.apiValid ? "165px" : "130px");
        
        let giftContainer = new St.Widget({ layout_manager: new Clutter.BinLayout(), style: "min-width: " + width + "; height: " + height + "; padding: 10px 15px;" });
        let bigGift = new St.Label({ text: "🎁", style: "font-size: 110px;" });
        _applet.activeGiftActor = bigGift;

        bigGift.set_pivot_point(0.5, 0.5);
        bigGift.set_x_align(Clutter.ActorAlign.CENTER);
        bigGift.set_y_align(Clutter.ActorAlign.CENTER);

        // Animation: Fall in and then wiggle
        let animationRunning = true;
        let phase = 'fall';
        let velocity = 0;
        let y = -250;
        let wT = 0;
        let waitFrames = 0;

        bigGift.set_translation(0, y, 0);

        let animFunc = () => {
            if (!bigGift) return false;

            if (phase === 'fall') {
                velocity += 2.5; // Gravity
                y += velocity;
                if (y >= 0) {
                    y = 0;
                    phase = 'wiggle';
                    Utils.sendNotification("Crypto-Tracker", _("MERRY CHRISTMAS 🎄"), "complete.oga", "face-smile-symbolic");
                }
                bigGift.set_translation(0, y, 0);
                return true;
            } else if (phase === 'wiggle') {
                wT += 0.3;
                if (wT >= 4 * Math.PI) {
                    bigGift.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, 0);
                    phase = 'wait_explode'; // New Phase: Wait
                    waitFrames = 0;
                    return true;
                }
                let angle = 15 * Math.sin(wT);
                bigGift.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, angle);
                return true;
            } else if (phase === 'wait_explode') {
                waitFrames++;
                if (waitFrames > 25) { // wait approx. 0.5 seconds (25 * 20ms)
                    if (bigGift) {
                        let op = 255;
                        Mainloop.timeout_add(15, () => {
                            if (!bigGift) return false;
                            op -= 20;
                            if (op <= 0) { bigGift.set_opacity(0); return false; }
                            bigGift.set_opacity(op);
                            return true;
                        });

                        let [gx, gy] = bigGift.get_transformed_position();
                        let [gw, gh] = bigGift.get_transformed_size();
                        let globalArea = new St.DrawingArea({ reactive: false });
                        globalArea.set_size(global.stage.width, global.stage.height);
                        Main.uiGroup.add_actor(globalArea);
                        globalArea.raise_top();

                        Animations.startXmasConfetti(globalArea, () => {
                            globalArea.destroy();
                            // Reset timer: Close shortly after confetti ends
                            if (_applet._ghostTimer) { Mainloop.source_remove(_applet._ghostTimer); _applet._ghostTimer = null; }
                            _applet._ghostTimer = Mainloop.timeout_add(1000, () => {
                                _applet.menu.close = () => { }; _applet.giftOverlayActive = false; _applet._ghostTimer = null; _applet.activeGiftActor = null; _applet.fadeInChart = true; _applet._buildMenu(); _applet.fadeInChart = false; Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
                                return false;
                            });
                        }, gx + gw / 2, gy + gh / 2);
                    }
                    animationRunning = false;
                    animId = null;
                    return false;
                }
                return true;
            }
            return false;
        };

        let animId = Mainloop.timeout_add(20, animFunc);
        bigGift.connect('destroy', () => { if (animId) Mainloop.source_remove(animId); });

        giftContainer.add_child(bigGift);

        item.addActor(giftContainer, { expand: true });

        // Prevents a click on the gift (during animation) from closing the menu.
        item.connect('activate', () => {
            _applet.menu.close = () => { };
            Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
        });
        return true;
    }

    // Pizza Easter-Egg: Falling Bitcoin Logo
    if (i === 1 && _applet.pizzaOverlayActive) {
        let width = "100%";
        let height = (_applet.ghostOverlayHeight > 0) ? _applet.ghostOverlayHeight + "px" : (_applet.apiValid ? "165px" : "130px");
        
        let container = new St.Widget({ layout_manager: new Clutter.BinLayout(), style: "min-width: " + width + "; height: " + height + "; padding: 10px 15px;" });
        let iconPath = _applet.metadata.path + "/icons/btc-symbolic.svg";
        let gicon = new Gio.FileIcon({ file: Gio.file_new_for_path(iconPath) });
        let btcIcon = new St.Icon({ gicon: gicon, icon_size: 110, style: "color: #f7931a;" });
        btcIcon.set_pivot_point(0.5, 0.5);
        btcIcon.set_x_align(Clutter.ActorAlign.CENTER);
        btcIcon.set_y_align(Clutter.ActorAlign.CENTER);

        _applet.activeGiftActor = container; // For Fade-Out Logic

        // Animation
        let phase = 'fall';
        let velocity = 0;
        let y = -300;
        let rotation = 0;
        let wT = 0;

        btcIcon.set_translation(0, y, 0);

        let animFunc = () => {
            if (!btcIcon) return false;

            if (phase === 'fall') {
                velocity += 4.0; // Gravity
                y += velocity;

                if (y >= 0) {
                    if (velocity > 15) { // Bounce
                        y = 0;
                        velocity = -velocity * 0.6;
                    } else {
                        y = 0;
                        phase = 'wiggle';
                        rotation = 0; // Straighten up
                        Utils.sendNotification("Crypto-Tracker", _("HAPPY BITCOIN PIZZA DAY 🍕"), "complete.oga", "face-smile-symbolic");

                        // Global Confetti
                        let [gx, gy] = container.get_transformed_position();
                        let [gw, gh] = container.get_transformed_size();

                        // Fallback to screen center if coordinates are 0
                        if (gx === 0 && gy === 0) {
                            gx = global.stage.width / 2 - gw / 2;
                            gy = global.stage.height / 2 - gh / 2;
                        }

                        let globalArea = new St.DrawingArea({ reactive: false });
                        globalArea.set_size(global.stage.width, global.stage.height);
                        Main.uiGroup.add_actor(globalArea);
                        globalArea.raise_top();
                        Animations.startPizzaConfetti(globalArea, () => { globalArea.destroy(); }, gx + gw / 2, gy + gh / 2);
                    }
                }
                btcIcon.set_translation(0, y, 0);
                // btcIcon.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, rotation);
                return true;
            } else if (phase === 'wiggle') {
                wT += 0.4;
                if (wT >= 2 * Math.PI) { // 1x wiggle
                    btcIcon.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, 0);
                    btcIcon.set_scale(1, 1);
                    animId = null;
                    return false;
                }
                let angle = 10 * Math.sin(wT);
                btcIcon.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, angle);

                let s = 1.0 + 0.1 * Math.sin(wT);
                btcIcon.set_scale(s, s);
                return true;
            }
            return false;
        };

        let animId = Mainloop.timeout_add(20, animFunc);
        btcIcon.connect('destroy', () => { if (animId) Mainloop.source_remove(animId); });

        container.add_child(btcIcon);

        item.addActor(container, { expand: true });

        // Disable click
        item.actor.set_reactive(false);

        // Prevents closing on click (if reactive was on)
        item.connect('activate', () => {
            _applet.menu.close = () => { };
            Mainloop.timeout_add(100, () => { _applet.menu.close = _applet._originalMenuClose; return false; });
        });
        return true;
    }

    return false; // No overlay was handled
}

function updateTheme(rebuild = true) {
    let enabled = _applet.settings.getValue("enable-holiday-theme");
    // Try to get the value directly or via the bound property
    let forceTheme = _applet.settings.getValue("dev-force-theme");
    if (forceTheme === undefined || forceTheme === null) forceTheme = _applet['dev-force-theme'];
    if (!forceTheme) forceTheme = "auto";

    let now = new Date();
    let mon = now.getMonth(); 
    let day = now.getDate();
    
    _applet.currentTheme = null;
    let themeId = null;
    
    if (forceTheme !== "auto") {
        themeId = forceTheme;
    } else if (enabled) {
        if ((mon === 11 && day === 31) || (mon === 0 && day === 1)) themeId = "newyear";
        else if (mon === 11 && (day === 24 || day === 25)) themeId = "xmas_eve";
        else if ((mon === 11 && day >= 6) || (mon === 0 && day <= 6)) themeId = "xmas";
        else if ((mon === 9 && day >= 25) || (mon === 10 && day <= 2)) themeId = "halloween";
        else if (mon === 1 && day === 14) themeId = "valentine";
        else if (mon === 4 && day === 22) themeId = "pizza";
        else if (mon === 3) themeId = "easter"; // April
    }

    if (themeId === "xmas" || themeId === "xmas_eve") {
        _applet.currentTheme = {
            name: themeId,
            hoverColor: "rgba(220, 20, 60, 0.12)", // Red
            hoverColorHeader: "rgba(220, 20, 60, 0.20)",
            icons: (themeId === "xmas_eve" || (mon === 11 && (day === 24 || day === 25))) ? ["🎅"] : ["⛄"],
            particleColor: [1, 1, 1, 0.25] // White Snow
        };
    } else if (themeId === "newyear") {
        _applet.currentTheme = {
            name: 'newyear',
            hoverColor: "rgba(255, 215, 0, 0.12)", // Gold
            hoverColorHeader: "rgba(255, 215, 0, 0.20)",
            icons: ["🍾"],
            particleColor: [1, 0.84, 0, 0.4] // Golden Particles (Fallback)
        };
    } else if (themeId === "halloween") {
        _applet.currentTheme = {
            name: 'halloween',
            hoverColor: "rgba(255, 140, 0, 0.12)", // Orange
            hoverColorHeader: "rgba(255, 140, 0, 0.20)",
            icons: ["🎃", "👻", "🕸️"],
            particleColor: [1, 0.55, 0, 0.4] // Orange Particles
        };
    } else if (themeId === "valentine") {
        _applet.currentTheme = {
            name: 'valentine',
            hoverColor: "rgba(255, 105, 180, 0.12)", // HotPink
            hoverColorHeader: "rgba(255, 105, 180, 0.20)",
            icons: ["❤️", "🌹"],
            particleColor: [1, 0.4, 0.7, 0.4] // Pink Particles
        };
    } else if (themeId === "pizza") {
        _applet.currentTheme = {
            name: 'pizza',
            hoverColor: "rgba(255, 215, 0, 0.12)", // Gold
            hoverColorHeader: "rgba(255, 215, 0, 0.20)",
            icons: ["🍕"]
        };
    } else if (themeId === "easter") {
        _applet.currentTheme = {
            name: 'easter',
            hoverColor: "rgba(152, 251, 152, 0.12)", // PaleGreen
            hoverColorHeader: "rgba(152, 251, 152, 0.20)",
            icons: ["🐇"],
            particleColor: [1, 1, 0.8, 0.4] // Light Yellow Particles
        };
    }

    if (_applet.currentTheme) {
        _applet.hoverColor = _applet.currentTheme.hoverColor;
        _applet.hoverColorHeader = _applet.currentTheme.hoverColorHeader;
    } else {
        _applet.hoverColor = "rgba(128,128,128,0.11)";
        _applet.hoverColorHeader = "rgba(128,128,128,0.20)";
    }
    
    // Compatibility: Set isXmas flag if old code still accesses it
    _applet.isXmas = (themeId === "xmas" || themeId === "xmas_eve");

    if (rebuild && _applet.metrics && _applet.metrics[1]) _applet._buildMenu();
}

var Seasonal = {
    init: init,
    handleMetricOverlay: handleMetricOverlay,
    updateTheme: updateTheme
};
