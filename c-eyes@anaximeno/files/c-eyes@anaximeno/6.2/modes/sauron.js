/* modes/sauron.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
'use strict';

const Clutter = imports.gi.Clutter;
// Cinnamon resolves require paths from the applet's root folder, even in sub folders.
const { EyeMode } = require("./modes/base.js");
const { ShaderLayer } = require("./shader.js");

const DEFAULT_COLORS = Object.freeze({
    base: "#8A1400",
    iris: "#FF7B00",
    pupil: "#000000",
});

// The shader time is wrapped to keep it small, preserving float precision on the GPU.
const TIME_WRAP_S = 600.0;

// Envelope of the surge played when the eye wakes up: a quick rise, a short hold, then a slow settle.
const SURGE_RISE_S = 0.15;
const SURGE_HOLD_S = 0.35;
const SURGE_END_S = 1.6;

/*
 * Shader inputs:
 *  - tex: the pupil, the only part drawn with Cairo (premultiplied alpha)
 *  - u_time: animation time in seconds (already scaled by the speed setting)
 *  - u_size: drawing area size in pixels
 *  - u_center: pupil center in pixels, relative to the drawing area
 *  - u_eye_rad: eye radius in pixels (the eye is centered in the area)
 *  - u_blink: 0 when the eye is open, 1 when it is closed (resting)
 *  - u_flare: 0..1 surge played when the eye wakes up
 *  - u_turbulence, u_glow: the flame settings (0..1)
 *  - u_base_color, u_iris_color: the eye colors (0..1)
 */
const DECLARATIONS = `
uniform sampler2D tex;
uniform float u_time;
uniform vec2 u_size;
uniform vec2 u_center;
uniform float u_eye_rad;
uniform float u_blink;
uniform float u_flare;
uniform float u_turbulence;
uniform float u_glow;
uniform vec3 u_base_color;
uniform vec3 u_iris_color;

float ce_hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float ce_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(ce_hash(i), ce_hash(i + vec2(1.0, 0.0)), u.x),
               mix(ce_hash(i + vec2(0.0, 1.0)), ce_hash(i + vec2(1.0, 1.0)), u.x),
               u.y);
}

float ce_fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
        value += amplitude * ce_noise(p);
        p = p * 2.03 + vec2(17.0, 9.0);
        amplitude *= 0.5;
    }
    return value;
}

vec3 ce_hot_color() {
    return mix(u_iris_color, vec3(1.0, 0.97, 0.88), 0.75);
}

// Heat (0..1) to color: embers, base color, iris color, then white-hot.
vec3 ce_fire_ramp(float heat) {
    vec3 ember = u_base_color * 0.35;
    if (heat < 0.4) return mix(ember, u_base_color, heat / 0.4);
    if (heat < 0.75) return mix(u_base_color, u_iris_color, (heat - 0.4) / 0.35);
    return mix(u_iris_color, ce_hot_color(), (heat - 0.75) / 0.25);
}

// Average of 8 samples of tex on a ring of the given radius (pixels) around px.
vec4 ce_sample_ring(vec2 px, float radius, vec2 size) {
    vec4 sum = vec4(0.0);
    for (int i = 0; i < 8; i++) {
        float angle = float(i) * 0.785398;
        sum += texture2D(tex, (px + vec2(cos(angle), sin(angle)) * radius) / size);
    }
    return sum * 0.125;
}
`;

/*
 * An almond shaped eye made of fire, with flames radiating from the pupil and a
 * glow around it. Instead of closing, the eye rests: the fire dims, calms down
 * and slowly breathes. When it wakes up it surges, stronger and wider with a
 * contracted pupil, before settling back.
 */
const CODE = `
vec2 uv = cogl_tex_coord_in[0].xy;
vec2 size = max(u_size, vec2(1.0));
vec2 px = uv * size;
float eye_rad = max(u_eye_rad, 1.0);

float rest = clamp(u_blink, 0.0, 1.0);
float flare = clamp(u_flare, 0.0, 1.0);
float turb = (0.3 + 0.7 * u_turbulence) * mix(1.0, 0.5, rest) * (1.0 + 0.5 * flare);

// Eye space: centered and normalized by the eye radius.
vec2 q = (px - size * 0.5) / eye_rad;

// Polar coordinates around the pupil, for flames that follow the gaze.
vec2 d = (px - u_center) / eye_rad;
float r = length(d);
vec2 dir = d / max(r, 0.0001);

float streaks = ce_fbm(dir * 2.5 + vec2(r * 2.2 - u_time * 1.3));
float swirl = ce_fbm(q * 1.8 + vec2(0.0, u_time * 0.9));

// Almond shape, widened by the surge, its edges displaced by the flames.
float s = length(vec2(q.x / 0.9, q.y / 0.62)) / (1.0 + 0.15 * flare);
s += ((streaks - 0.5) * 0.7 + (swirl - 0.5) * 0.4) * turb;

float breathing = rest * (0.5 + 0.5 * sin(u_time * 1.7));
float energy = mix(1.0, 0.55, rest) * (1.0 - 0.15 * breathing) + 0.35 * flare;
float flicker = 0.92 + 0.16 * ce_noise(vec2(u_time * 4.0, 3.7));

float body = 1.0 - smoothstep(0.75, 1.05, s);
float heat = clamp(1.15 - 0.75 * r - 0.35 * s + (streaks - 0.5) * 0.8 * turb, 0.0, 1.0);
// Translucent parts (the glow and the fading edges of the fire) use bright colors:
// dark colors at partial opacity would look like smudges on light panels.
vec3 glow_rgb = ce_fire_ramp(clamp(0.8 * energy, 0.0, 1.0));
vec3 body_rgb = ce_fire_ramp(clamp(heat * energy, 0.0, 1.0)) * flicker;
body_rgb = mix(glow_rgb, clamp(body_rgb, 0.0, 1.0), body);

float glow = clamp((u_glow + 0.4 * flare) * 0.7 * exp(-max(s - 0.9, 0.0) * 3.5) * (0.75 + 0.25 * swirl), 0.0, 1.0);
float glow_a = glow * (1.0 - body) * min(energy, 1.0);

vec4 fire = vec4(body_rgb * body + glow_rgb * glow_a, body + glow_a);

// Pupil: it wobbles from the heat and contracts during the surge. Blurred samples
// give a soft distance to its outline, which is burnt by the flames (ragged edge)
// and surrounded by a white-hot rim.
vec2 wobble = (vec2(swirl, streaks) - 0.5) * 1.2 * turb;
vec2 pupil_px = u_center + (px - u_center) * (1.0 + 0.35 * flare) + wobble;
vec4 inner = 0.5 * texture2D(tex, pupil_px / size) + 0.5 * ce_sample_ring(pupil_px, 1.0, size);
vec4 halo = ce_sample_ring(pupil_px, 2.5, size);

float burn = ce_noise(px * 0.9 + vec2(0.0, -u_time * 3.0));
float threshold = 0.5 + (burn - 0.5) * 0.5 * turb;
float pupil_a = smoothstep(threshold - 0.2, threshold + 0.2, inner.a) * body;
vec3 pupil_rgb = inner.a > 0.0 ? inner.rgb / inner.a : vec3(0.0);

float rim = clamp(halo.a * 1.6, 0.0, 1.0) * (1.0 - pupil_a) * body * min(energy, 1.0);
fire.rgb = mix(fire.rgb, ce_hot_color() * fire.a, rim * 0.8);

vec4 eye = vec4(pupil_rgb * pupil_a, pupil_a) + fire * (1.0 - pupil_a);

// Fade out near the area borders, so the fire is never cut by them.
vec2 border = min(px, size - px);
float fade = max(eye_rad * 0.25, 1.0);
float window = smoothstep(0.0, fade, border.x) * smoothstep(0.0, fade, border.y);

cogl_color_out = eye * window * cogl_color_in;
`;

const UNIFORMS = Object.freeze([
    "u_time",
    "u_size",
    "u_center",
    "u_eye_rad",
    "u_blink",
    "u_flare",
    "u_turbulence",
    "u_glow",
    "u_base_color",
    "u_iris_color",
]);

function parseColor(value) {
    const [ok, color] = Clutter.Color.from_string(value);
    return ok ? color : null;
}

function colorToVec3(color) {
    return [color.red / 255, color.green / 255, color.blue / 255];
}

function smoothstep(edge0, edge1, x) {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

/**
 * Surge envelope at the given time since the surge started
 * @param {number} elapsed_s Seconds since the surge started
 * @returns {number} The surge strength (0..1)
 */
function surgeEnvelope(elapsed_s) {
    return smoothstep(0, SURGE_RISE_S, elapsed_s) * (1 - smoothstep(SURGE_HOLD_S, SURGE_END_S, elapsed_s));
}


/**
 * The Sauron eye: an eye made of fire. Only the pupil is drawn with Cairo, the
 * flames, the glow, resting (instead of closing) and waking up are rendered by
 * a shader.
 */
var SauronMode = class SauronMode extends EyeMode {
    constructor(mode) {
        super(mode);
        this._layer = null;
        this._time = 0.0;
        this._surge_elapsed_s = null;
        this._options = { speed: 1.0, turbulence: 0.6, glow: 0.6 };
    }

    get animated() {
        return true;
    }

    get default_palette() {
        if (!SauronMode._palette) {
            SauronMode._palette = {
                base_color: parseColor(DEFAULT_COLORS.base),
                iris_color: parseColor(DEFAULT_COLORS.iris),
                pupil_color: parseColor(DEFAULT_COLORS.pupil),
            };
        }
        return SauronMode._palette;
    }

    enable(area) {
        this.disable();
        const layer = new ShaderLayer("sauron", DECLARATIONS, CODE, UNIFORMS);
        layer.attach(area);
        this._layer = layer;
        this._applyOptions();
    }

    disable() {
        if (!this._layer) return;
        this._layer.destroy();
        this._layer = null;
    }

    /**
     * @param {Object} options
     * @param {number} options.speed Flames speed multiplier
     * @param {number} options.turbulence Flames turbulence (0..1)
     * @param {number} options.glow Glow strength (0..1)
     */
    configure(options) {
        this._options = Object.assign({}, this._options, options);
        this._applyOptions();
    }

    onFrame(delta_s) {
        if (!this._layer) return;

        this._time = (this._time + delta_s * this._options.speed) % TIME_WRAP_S;
        this._layer.setUniform("u_time", [this._time]);
        this._advanceSurge(delta_s);
        this._layer.queueRepaint();
    }

    onWake() {
        this._surge_elapsed_s = 0.0;
    }

    drawEye(area, blink_rate, options) {
        const [area_width, area_height] = area.allocation.get_size();
        const half_width = area_width * 0.5;
        const half_height = area_height * 0.5;

        const mouse_x = options.mouse_x - options.area_x - half_width;
        const mouse_y = options.mouse_y - options.area_y - half_height;

        const mouse_ang = Math.atan2(mouse_y, mouse_x);
        const mouse_dist = Math.sqrt(mouse_x * mouse_x + mouse_y * mouse_y);

        const min_area_size = Math.min(area_width, area_height);
        const eye_rad = Math.max((min_area_size - options.padding) * 0.5, 1);
        const pupil_rad = eye_rad * 0.3;

        // The pupil travels further horizontally, following the almond shape of the eye.
        const reach = Math.min(mouse_dist / eye_rad, 1.0);
        const pupil_x = half_width + Math.cos(mouse_ang) * eye_rad * 0.4 * reach;
        const pupil_y = half_height + Math.sin(mouse_ang) * eye_rad * 0.15 * reach;

        const cr = area.get_context();
        this.clearArea(cr, area_width, area_height);

        cr.translate(pupil_x, pupil_y);
        Clutter.cairo_set_source_color(cr, options.pupil_color);
        this._drawPupil(cr, pupil_rad, options.pupil_shape);

        if (this._layer) {
            this._layer.setUniform("u_size", [area_width, area_height]);
            this._layer.setUniform("u_center", [pupil_x, pupil_y]);
            this._layer.setUniform("u_eye_rad", [eye_rad]);
            this._layer.setUniform("u_blink", [blink_rate]);
            this._layer.setUniform("u_base_color", colorToVec3(options.base_color));
            this._layer.setUniform("u_iris_color", colorToVec3(options.iris_color));
        }
    }

    _applyOptions() {
        if (!this._layer) return;
        this._layer.setUniform("u_turbulence", [this._options.turbulence]);
        this._layer.setUniform("u_glow", [this._options.glow]);
    }

    _advanceSurge(delta_s) {
        if (this._surge_elapsed_s === null) return;

        // The surge follows real time: it is a reaction, not part of the flames' speed.
        this._surge_elapsed_s += delta_s;

        if (this._surge_elapsed_s >= SURGE_END_S) {
            this._surge_elapsed_s = null;
            this._layer.setUniform("u_flare", [0.0]);
        } else {
            this._layer.setUniform("u_flare", [surgeEnvelope(this._surge_elapsed_s)]);
        }
    }
}
