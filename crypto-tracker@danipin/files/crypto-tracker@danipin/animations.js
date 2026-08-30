const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;

var _applet;

function init(applet) {
    _applet = applet;
}

function startConfetti(area, onComplete, offsetX = 0) {
    if (!area) {
        if (onComplete) onComplete();
        return;
    }
    
    let particles = [];
    let colors = [[1,0,0], [0,1,0], [0,0,1], [1,1,0], [1,0,1], [0,1,1], [1,0.5,0]];
    
    // Initial burst
    for (let i=0; i<60; i++) {
        particles.push({
            x: 0, y: 0, 
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 1.0) * 15, // More upwards
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 6 + 3,
            life: 1.0,
            r: Math.random() * Math.PI,
            rv: (Math.random() - 0.5) * 0.2
        });
    }
    
    let animId = Mainloop.timeout_add(20, () => {
        if (!area) {
            if (onComplete) onComplete();
            return false;
        }
        let active = false;
        particles.forEach(p => {
            if (p.life > 0) {
                p.x += p.vx; p.y += p.vy; p.vy += 0.8; p.life -= 0.015; p.r += p.rv;
                active = true;
            }
        });
        area.queue_repaint();
        if (!active) {
            if (onComplete) onComplete();
            return false;
        }
        return true;
    });
    
    area.connect('repaint', (a) => {
        let cr = a.get_context(); let [w, h] = a.get_surface_size();
        particles.forEach(p => { if (p.life > 0) { cr.save(); cr.translate(w/2 + offsetX + p.x, h/2 + p.y); cr.rotate(p.r); cr.setSourceRGBA(p.color[0], p.color[1], p.color[2], p.life); cr.rectangle(-p.size/2, -p.size/2, p.size, p.size); cr.fill(); cr.restore(); } });
        cr.$dispose();
    });
}

function startCandyConfetti(area, onComplete, startX, startY) {
    if (!area) {
        if (onComplete) onComplete();
        return;
    }
    
    let particles = [];
    const candies = ["🍬", "🍭", "🍫", "🍩", "🍪"];
    
    // Initial burst
    for (let i=0; i<50; i++) {
        particles.push({
            x: 0, y: 0, 
            vx: (Math.random() - 0.5) * 22, // Radius halved
            vy: (Math.random() - 1.2) * 22, // Height halved
            candy: candies[Math.floor(Math.random() * candies.length)],
            size: Math.random() * 15 + 20, // Slightly larger
            life: 1.0,
            r: Math.random() * Math.PI * 2,
            rv: (Math.random() - 0.5) * 0.2
        });
    }
    
    let animId = Mainloop.timeout_add(10, () => {
        if (!area) { if (onComplete) onComplete(); return false; }
        let active = false;
        particles.forEach(p => {
            if (p.life > 0) { p.x += p.vx; p.y += p.vy; p.vy += 1.5; p.life -= 0.02; p.r += p.rv; active = true; }
        });
        area.queue_repaint();
        if (!active) { if (onComplete) onComplete(); return false; }
        return true;
    });
    
    area.connect('repaint', (a) => {
        let cr = a.get_context(); let [w, h] = a.get_surface_size();
        let cx = (startX !== undefined && startX !== null) ? startX : w/2;
        let cy = (startY !== undefined && startY !== null) ? startY : h/2;
        
        particles.forEach(p => { 
            if (p.life > 0) { 
                cr.save(); cr.translate(cx + p.x, cy + p.y); cr.rotate(p.r); 
                let layout = PangoCairo.create_layout(cr);
                layout.set_text(p.candy, -1);
                layout.set_font_description(Pango.FontDescription.from_string("Sans " + p.size));
                let [ink, logical] = layout.get_pixel_extents();
                cr.moveTo(-logical.width/2, -logical.height/2);
                cr.pushGroup(); PangoCairo.show_layout(cr, layout); cr.popGroupToSource(); cr.paintWithAlpha(Math.min(1.0, p.life * 2.5));
                cr.restore(); 
            } 
        });
        cr.$dispose();
    });
}

function startXmasConfetti(area, onComplete, startX, startY) {
    if (!area) {
        if (onComplete) onComplete();
        return;
    }
    
    let particles = [];
    const items = ["🍬", "🍭", "🍪", "🌟", "❄️", "🎄", "🎅", "🎁", "🔔", "⛄", "🍫"];
    
    // Initial burst
    for (let i=0; i<50; i++) {
        particles.push({
            x: 0, y: 0, 
            vx: (Math.random() - 0.5) * 22, 
            vy: (Math.random() - 1.2) * 22, 
            item: items[Math.floor(Math.random() * items.length)],
            size: Math.random() * 15 + 20, 
            life: 1.0,
            r: Math.random() * Math.PI * 2,
            rv: (Math.random() - 0.5) * 0.2
        });
    }
    
    let animId = Mainloop.timeout_add(10, () => {
        if (!area) { if (onComplete) onComplete(); return false; }
        let active = false;
        particles.forEach(p => {
            if (p.life > 0) { p.x += p.vx; p.y += p.vy; p.vy += 1.5; p.life -= 0.02; p.r += p.rv; active = true; }
        });
        area.queue_repaint();
        if (!active) { if (onComplete) onComplete(); return false; }
        return true;
    });
    
    area.connect('repaint', (a) => {
        let cr = a.get_context(); let [w, h] = a.get_surface_size();
        let cx = (startX !== undefined && startX !== null) ? startX : w/2;
        let cy = (startY !== undefined && startY !== null) ? startY : h/2;
        
        particles.forEach(p => { 
            if (p.life > 0) { 
                cr.save(); cr.translate(cx + p.x, cy + p.y); cr.rotate(p.r); 
                let layout = PangoCairo.create_layout(cr);
                layout.set_text(p.item, -1);
                layout.set_font_description(Pango.FontDescription.from_string("Sans " + p.size));
                let [ink, logical] = layout.get_pixel_extents();
                cr.moveTo(-logical.width/2, -logical.height/2);
                cr.pushGroup(); PangoCairo.show_layout(cr, layout); cr.popGroupToSource(); cr.paintWithAlpha(Math.min(1.0, p.life * 2.5));
                cr.restore(); 
            } 
        });
        cr.$dispose();
    });
}

function startNewYearConfetti(area, onComplete, startX, startY) {
    if (!area) {
        if (onComplete) onComplete();
        return;
    }
    
    let particles = [];
    const items = ["🥂", "🍾", "✨", "🎆", "🎇", "🌟"];
    
    // Initial burst
    for (let i=0; i<50; i++) {
        particles.push({
            x: 0, y: 0, 
            vx: (Math.random() - 0.5) * 25, 
            vy: (Math.random() - 1.2) * 25, 
            item: items[Math.floor(Math.random() * items.length)],
            size: Math.random() * 15 + 20, 
            life: 1.0,
            r: Math.random() * Math.PI * 2,
            rv: (Math.random() - 0.5) * 0.2
        });
    }
    
    let animId = Mainloop.timeout_add(10, () => {
        if (!area) { if (onComplete) onComplete(); return false; }
        let active = false;
        particles.forEach(p => {
            if (p.life > 0) { p.x += p.vx; p.y += p.vy; p.vy += 1.5; p.life -= 0.02; p.r += p.rv; active = true; }
        });
        area.queue_repaint();
        if (!active) { if (onComplete) onComplete(); return false; }
        return true;
    });
    
    area.connect('repaint', (a) => {
        let cr = a.get_context(); let [w, h] = a.get_surface_size();
        let cx = (startX !== undefined && startX !== null) ? startX : w/2;
        let cy = (startY !== undefined && startY !== null) ? startY : h/2;
        
        particles.forEach(p => { 
            if (p.life > 0) { 
                cr.save(); cr.translate(cx + p.x, cy + p.y); cr.rotate(p.r); 
                let layout = PangoCairo.create_layout(cr);
                layout.set_text(p.item, -1);
                layout.set_font_description(Pango.FontDescription.from_string("Sans " + p.size));
                let [ink, logical] = layout.get_pixel_extents();
                cr.moveTo(-logical.width/2, -logical.height/2);
                cr.pushGroup(); PangoCairo.show_layout(cr, layout); cr.popGroupToSource(); cr.paintWithAlpha(Math.min(1.0, p.life * 2.5));
                cr.restore(); 
            } 
        });
        cr.$dispose();
    });
}

function startPizzaConfetti(area, onComplete, startX, startY) {
    if (!area) {
        if (onComplete) onComplete();
        return;
    }
    
    // Global Actor Tracking removed as it often causes issues and is not strictly necessary
    // for local animation in the menu.

    let particles = [];
    const items = ["🍕", "🧀", "🍅", "🌶️", "₿"];
    
    // Initial burst
    for (let i=0; i<50; i++) {
        particles.push({
            x: 0, y: 0, 
            vx: (Math.random() - 0.5) * 22, 
            vy: (Math.random() - 1.2) * 22, 
            item: items[Math.floor(Math.random() * items.length)],
            size: Math.random() * 15 + 20, 
            life: 1.0,
            r: Math.random() * Math.PI * 2,
            rv: (Math.random() - 0.5) * 0.2
        });
    }
    
    let animId = Mainloop.timeout_add(10, () => {
        if (!area) { if (onComplete) onComplete(); return false; }
        let active = false;
        particles.forEach(p => {
            if (p.life > 0) { p.x += p.vx; p.y += p.vy; p.vy += 1.5; p.life -= 0.02; p.r += p.rv; active = true; }
        });
        area.queue_repaint();
        if (!active) { if (onComplete) onComplete(); return false; }
        return true;
    });
    
    area.connect('repaint', (a) => {
        let cr = a.get_context(); let [w, h] = a.get_surface_size();
        let cx = (startX !== undefined && startX !== null) ? startX : w/2;
        let cy = (startY !== undefined && startY !== null) ? startY : h/2;
        
        particles.forEach(p => { 
            if (p.life > 0) { 
                cr.save(); cr.translate(cx + p.x, cy + p.y); cr.rotate(p.r); 
                let layout = PangoCairo.create_layout(cr);
                layout.set_text(p.item, -1);
                layout.set_font_description(Pango.FontDescription.from_string("Sans " + p.size));
                let [ink, logical] = layout.get_pixel_extents();
                cr.moveTo(-logical.width/2, -logical.height/2);
                cr.pushGroup(); PangoCairo.show_layout(cr, layout); cr.popGroupToSource(); cr.paintWithAlpha(Math.min(1.0, p.life * 2.5));
                cr.restore(); 
            } 
        });
        cr.$dispose();
    });
}

function startSparkleConfetti(area, onComplete, startX, startY) {
    if (!area) { if (onComplete) onComplete(); return; }
    
    let particles = [];
    // Gold, Silver, White
    const colors = [[1, 0.84, 0], [0.8, 0.8, 0.8], [1, 1, 1]];
    
    // Fewer particles, smaller radius
    for (let i=0; i<30; i++) {
        particles.push({
            x: 0, y: 0, 
            vx: (Math.random() - 0.5) * 4, // Very small radius (approx. 1.5cm spread)
            vy: (Math.random() - 1.0) * 4, 
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 1.5 + 0.5, // Tiny pixels (0.5 - 2px)
            life: 1.0,
            decay: 0.01 + Math.random() * 0.02
        });
    }
    
    let animId = Mainloop.timeout_add(20, () => {
        if (!area) { if (onComplete) onComplete(); return false; }
        let active = false;
        particles.forEach(p => {
            if (p.life > 0) { p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= p.decay; active = true; }
        });
        area.queue_repaint();
        if (!active) { if (onComplete) onComplete(); return false; }
        return true;
    });
    
    area.connect('repaint', (a) => {
        let cr = a.get_context(); let [w, h] = a.get_surface_size();
        let cx = (startX !== undefined && startX !== null) ? startX : w/2;
        let cy = (startY !== undefined && startY !== null) ? startY : h/2;
        
        particles.forEach(p => { 
            if (p.life > 0) { 
                cr.setSourceRGBA(p.color[0], p.color[1], p.color[2], p.life);
                cr.rectangle(cx + p.x, cy + p.y, p.size, p.size); // Small pixel rectangles
                cr.fill();
            } 
        });
        cr.$dispose();
    });
}

function setupMetricAnimations(metric) {
    let animId = null;
    let animType = null; // 'wiggle' or 'pulse'
    let animT = 0;

    metric.stopAnim = () => {
        if (animId) { Mainloop.source_remove(animId); animId = null; }
        animType = null;
        try { 
            metric.icon_bin.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, 0);
            metric.icon_bin.set_scale(1.0, 1.0);
            let icon = metric.icon_bin.get_child();
            if (icon) {
                icon.set_style(""); // Reset style
            }
        } catch(e) { /* Actor might already be destroyed */ }
    };

    metric.updateAlarmState = (active) => {
        if (active) {
            if (animType === 'pulse') return; // Already running
            metric.stopAnim();
            animType = 'pulse';
            animT = 0;
            animId = Mainloop.timeout_add(40, () => { // Faster interval for smoother color gradient
                animT += 0.08; // Slower increment for gentle pulse
                
                // Sine wave from 0 to 1 and back
                let intensity = (Math.sin(animT) + 1) / 2; 
                
                // Interpolation between White (255,255,255) and Orange (#e67e22 -> 230,126,34)
                let r = Math.round(255 * (1 - intensity) + 230 * intensity);
                let g = Math.round(255 * (1 - intensity) + 126 * intensity);
                let b = Math.round(255 * (1 - intensity) + 34 * intensity);
                
                let color = `rgb(${r}, ${g}, ${b})`;
                
                let icon = metric.icon_bin.get_child();
                if (icon) {
                    icon.set_style("color: " + color + ";");
                }
                
                return true;
            });
        } else {
            if (animType === 'pulse') metric.stopAnim();
        }
    };

    metric.container_box.connect('enter-event', () => {
        if (animType === 'pulse') return; // Alarm has priority
        if (animType === 'wiggle') return;
        
        animType = 'wiggle';
        animT = 0;
        animId = Mainloop.timeout_add(50, () => {
            animT += 0.6;
            let maxT = 4 * Math.PI;
            if (animT >= maxT) {
                // Animation finished. Reset state and let timeout be removed by 'return false'.
                animId = null;
                animType = null;
                metric.icon_bin.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, 0);
                return false;
            }
            let angle = 30 * (1 - (animT / maxT)) * Math.sin(animT);
            metric.icon_bin.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, angle);
            return true;
        });
    });
    metric.container_box.connect('destroy', () => {
        metric.stopAnim();
    });
}

function animateRocket(actor) {
    let rT = 0;
    let rAnim = Mainloop.timeout_add(40, () => {
        rT += 0.15;
        if (rT >= 4 * Math.PI) {
            actor.set_scale(1, 1);
            rAnim = null; // Prevents 'destroy' function from removing an invalid ID.
            return false;
        }
        let s = 1.0 + 0.1 * Math.abs(Math.sin(rT));
        actor.set_scale(s, s);
        return true;
    });
    actor.connect('destroy', () => { if (rAnim) Mainloop.source_remove(rAnim); });
}

function addStarHoverEffect(actor) {
    let animId = null;
    actor.connect('enter-event', () => {
        if (animId) return;
        actor.set_opacity(255); actor.set_scale(1.2, 1.2);
        let t = 0;
        animId = Mainloop.timeout_add(50, () => { t += 0.6; let max = 4 * Math.PI; if (t >= max) { actor.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, 0); animId = null; return false; } actor.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, 15 * (1 - t/max) * Math.sin(t)); return true; });
    });
    actor.connect('leave-event', () => { if (animId) { Mainloop.source_remove(animId); animId = null; } actor.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, 0); actor.set_scale(1, 1); actor.set_opacity(80); });
}

function animateExpand(actor, onComplete, steps = 6) {
    let [min, nat] = actor.get_preferred_height(350); 
    if (nat <= 0) [min, nat] = actor.get_preferred_height(-1);
    
    if (nat > 0) {
        actor.set_height(0);
        actor.set_opacity(0);
        actor.set_clip_to_allocation(true);
        let h = 0;
        // Default: 6 steps * 12ms = ~72ms
        let step = nat / steps; 
        
        let animId = Mainloop.timeout_add(12, () => {
            try {
                if (!actor) return false;
                h += step;
                if (h >= nat) { 
                    actor.set_height(-1); 
                    actor.set_opacity(255); 
                    actor.set_clip_to_allocation(false); 
                    if (onComplete) onComplete();
                    return false; 
                }
                actor.set_height(h);
                actor.set_opacity(255 * (h / nat));
                return true;
            } catch (e) { return false; }
        });
    } else {
        if (onComplete) onComplete();
    }
}

function animateCollapse(actor, onComplete, steps = 6) {
    if (!actor) { if (onComplete) onComplete(); return; }
    
    let alloc = actor.get_allocation_box();
    let startH = alloc.y2 - alloc.y1;
    if (startH <= 0) { let [m, n] = actor.get_preferred_height(-1); startH = n; }

    actor.set_clip_to_allocation(true);
    let h = startH;
    let step = startH / steps; 
    
    let animId = Mainloop.timeout_add(12, () => {
        try {
            if (!actor) {
                // FIX: Fire callback even if actor was destroyed (prevents hanging)
                if (onComplete) onComplete();
                return false;
            }
            h -= step;
            if (h <= 0) { actor.set_height(0); actor.set_opacity(0); if (onComplete) onComplete(); return false; }
            actor.set_height(h);
            actor.set_opacity(255 * (h / startH));
            return true;
        } catch (e) { return false; }
    });
}

function animateFadeIn(actor, onComplete, steps = 20) {
    if (!actor) { if (onComplete) onComplete(); return; }
    
    actor.set_opacity(0);
    let op = 0;
    let step = 255 / steps;
    
    let animId = Mainloop.timeout_add(12, () => {
        try {
            if (!actor) return false;
            op += step;
            if (op >= 255) { 
                actor.set_opacity(255); 
                if (onComplete) onComplete(); 
                return false; 
            }
            actor.set_opacity(op);
            return true;
        } catch (e) { return false; }
    });
}

var Animations = {
    init: init,
    startConfetti: startConfetti,
    startCandyConfetti: startCandyConfetti,
    startXmasConfetti: startXmasConfetti,
    startNewYearConfetti: startNewYearConfetti,
    startPizzaConfetti: startPizzaConfetti,
    startSparkleConfetti: startSparkleConfetti,
    setupMetricAnimations: setupMetricAnimations,
    animateRocket: animateRocket,
    addStarHoverEffect: addStarHoverEffect,
    animateExpand: animateExpand,
    animateCollapse: animateCollapse,
    animateFadeIn: animateFadeIn
};