/* Luma unsharp mask, separate from the grade.
 * Cogl / Clutter shader language (GLSL 1.20). Do not add a #version line.
 *
 * Opaque pixels only. Translucent window frames and shadows are copied
 * unchanged so the kernel does not ring on alpha edges.
 */

uniform sampler2D tex;
uniform float amount;
uniform float tex_width;
uniform float tex_height;

float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
    vec2 uv = cogl_tex_coord_in[0].st;
    vec4 src = texture2D(tex, uv);

    if (src.a < 0.98 || amount <= 0.001) {
        cogl_color_out = src;
        return;
    }

    vec2 px = vec2(1.0 / max(tex_width, 1.0), 1.0 / max(tex_height, 1.0));
    vec4 s1 = texture2D(tex, uv + vec2(px.x, 0.0));
    vec4 s2 = texture2D(tex, uv - vec2(px.x, 0.0));
    vec4 s3 = texture2D(tex, uv + vec2(0.0, px.y));
    vec4 s4 = texture2D(tex, uv - vec2(0.0, px.y));

    float a_min = min(min(s1.a, s2.a), min(s3.a, s4.a));
    if (a_min < 0.98) {
        cogl_color_out = src;
        return;
    }

    vec3 color = src.rgb / src.a;
    vec3 blur = (
        s1.rgb / s1.a +
        s2.rgb / s2.a +
        s3.rgb / s3.a +
        s4.rgb / s4.a
    ) * 0.25;

    float detail = luma(color) - luma(blur);
    color = clamp(color + vec3(detail) * amount, 0.0, 1.0);
    cogl_color_out = vec4(color * src.a, src.a);
}
