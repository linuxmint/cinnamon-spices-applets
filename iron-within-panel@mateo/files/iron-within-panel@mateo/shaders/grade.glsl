/* Cinematic grade, one fullscreen pass.
 * Cogl / Clutter shader language (GLSL 1.20). Do not add a #version line.
 * Cogl declares cogl_tex_coord_in and cogl_color_out.
 *
 * The offscreen buffer is premultiplied. The grade runs on straight
 * RGB and the result is multiplied by alpha again.
 *
 * Contrast is an S-curve around mid gray. Endpoints stay put, so the
 * curve does not hard-clip blacks the way a plain RGB multiply does.
 */

uniform sampler2D tex;
uniform float intensity;
uniform float exposure;
uniform float contrast;
uniform float highlights;
uniform float shadows;
uniform float blacks;
uniform float saturation;
uniform float temperature;
uniform float shadow_teal;
uniform float highlight_warmth;
uniform float gamma_power;
uniform float vignette;
uniform float skin_protect;
uniform float grain;
uniform float grain_time;
uniform float tex_width;
uniform float tex_height;

float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float s_curve(float x, float c) {
    float y = clamp(x, 0.0, 1.0) - 0.5;
    float denom = 1.0 + (c - 1.0) * 2.0 * abs(y);
    return clamp(y * c / max(denom, 0.0001) + 0.5, 0.0, 1.0);
}

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

/* Coarse moving grain, slightly wider than tall, plus a faint line crawl.
 * Matches the static on the reference footage: visible in the blacks,
 * quieter on the hottest highlights. */
vec3 add_grain(vec3 color) {
    vec2 px = cogl_tex_coord_in[0].st * vec2(max(tex_width, 1.0), max(tex_height, 1.0));
    vec2 seed = vec2(grain_time, grain_time * 0.37);
    float fine = hash(floor(px) + seed) - 0.5;
    float coarse = hash(floor(vec2(px.x * 0.42, px.y * 0.62)) + vec2(grain_time * 1.3, grain_time * 0.7)) - 0.5;
    float band = hash(vec2(floor(px.y * 0.5), grain_time)) - 0.5;
    float n = fine * 0.45 + coarse * 1.05 + band * 0.22;
    float yb = luma(color);
    float mask = mix(0.78, 1.0, smoothstep(0.0, 0.22, yb));
    mask *= mix(1.0, 0.62, smoothstep(0.72, 1.0, yb));
    return color + n * grain * mask;
}

float skin_mask(vec3 c, float y) {
    float rb = c.r - c.b;
    float rg = c.r - c.g;
    float maxc = max(c.r, max(c.g, c.b));
    float minc = min(c.r, min(c.g, c.b));
    float sat = maxc - minc;
    float hue = smoothstep(0.03, 0.10, rb) * smoothstep(0.0, 0.05, rg);
    float sat_ok = smoothstep(0.05, 0.14, sat) * (1.0 - smoothstep(0.50, 0.75, sat));
    float y_ok = smoothstep(0.18, 0.32, y) * (1.0 - smoothstep(0.72, 0.90, y));
    return clamp(hue * sat_ok * y_ok, 0.0, 1.0);
}

void main() {
    vec4 src = texture2D(tex, cogl_tex_coord_in[0].st);

    if (src.a < 0.001) {
        cogl_color_out = vec4(0.0);
        return;
    }

    float amount = clamp(intensity, 0.0, 1.0);
    vec3 original = src.rgb / src.a;
    vec3 color = original;

    color *= exp2(exposure);

    float black_point = clamp(-blacks, 0.0, 1.0) * 0.25;
    color = clamp((color - black_point) / max(1.0 - black_point, 0.001), 0.0, 1.0);

    float y = luma(color);
    /* Peak in the mid-shadows, zero at the floor, so blacks stay separated. */
    float shadow_mask = smoothstep(0.0, 0.16, y) * (1.0 - smoothstep(0.16, 0.55, y));
    float high_mask = smoothstep(0.58, 0.94, y);
    color *= mix(1.0, 1.0 + shadows, shadow_mask);
    color *= mix(1.0, 1.0 + highlights, high_mask);
    color = clamp(color, 0.0, 1.0);

    float curve = max(contrast, 0.05);
    color = vec3(s_curve(color.r, curve), s_curve(color.g, curve), s_curve(color.b, curve));

    color = pow(max(color, vec3(0.0)), vec3(max(gamma_power, 0.05)));

    y = luma(color);
    color = mix(vec3(y), color, clamp(saturation, 0.0, 2.0));

    /* temperature < 0 cools. -0.05 moves red by about 1 percent. */
    float t = clamp(temperature, -1.0, 1.0);
    color.r *= 1.0 + 0.25 * t;
    color.g *= 1.0 + 0.04 * t;
    color.b *= 1.0 - 0.16 * t;
    color = clamp(color, 0.0, 1.0);

    y = luma(color);
    /* Teal only in the deep shadows. A dark-theme page is mostly above
     * this, so the UI does not pick up a blue wash. */
    float shadow_tint = 1.0 - smoothstep(0.0, 0.18, y);
    float high_tint = smoothstep(0.62, 0.96, y);
    float mid = smoothstep(0.38, 0.50, y) * (1.0 - smoothstep(0.50, 0.64, y));
    float skin = skin_mask(color, y) * clamp(skin_protect, 0.0, 1.0);
    float teal_cut = clamp(mid + skin, 0.0, 1.0);
    float teal_amt = shadow_teal * shadow_tint * (1.0 - teal_cut);
    float warm_amt = highlight_warmth * high_tint * (1.0 - mid);

    color.r += -0.40 * teal_amt + 0.90 * warm_amt;
    color.g +=  0.12 * teal_amt + 0.22 * warm_amt;
    color.b +=  0.50 * teal_amt - 0.55 * warm_amt;

    if (grain > 0.001)
        color = add_grain(color);

    vec2 p = cogl_tex_coord_in[0].st - vec2(0.5);
    float vig = smoothstep(0.28, 0.78, length(p));
    color *= 1.0 - clamp(vignette, 0.0, 1.0) * vig;

    color = clamp(color, 0.0, 1.0);
    color = mix(original, color, amount);
    cogl_color_out = vec4(color * src.a, src.a);
}
