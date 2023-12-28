const { Clutter, GObject } = imports.gi;

var DesaturateEffect = GObject.registerClass({
    GTypeName: `Cjs_DesaturateEffect_${Math.random()}`,
}, class DesaturateEffect extends Clutter.DesaturateEffect {
    _init(properties) {
        super._init();
        this.updateEffect(properties);
    }

    updateEffect(properties) {
        this.factor = properties.factor;
        this.queue_repaint();
    }
});

var InversionEffect = GObject.registerClass({
    GTypeName: `Cjs_InversionEffect_${Math.random()}`,
}, class InversionEffect extends Clutter.ShaderEffect {
    _init(properties) {
        super._init();
        this.updateEffect(properties);

        this._source = ShaderLib.getInversion();
        this.set_shader_source(this._source);
    }

    updateEffect(properties) {
        this._mode = properties.mode;
        this.queue_repaint();
    }

    vfunc_get_static_shader_source() {
        return this._source;
    }

    vfunc_paint_target(...args) {
        this.set_uniform_value('tex', 0);
        this.set_uniform_value('INVERSION_MODE', this._mode);
        super.vfunc_paint_target(...args);
    }
});

var ColorMixerEffect = GObject.registerClass({
    GTypeName: `Cjs_ColorMixerEffect_${Math.random()}`,
}, class ColorMixerEffect extends Clutter.ShaderEffect {
    _init(properties) {
        super._init();
        // 0 - GRB, 1 - BRG
        this.updateEffect(properties);

        this._source = ShaderLib.getChannelMix();
        this.set_shader_source(this._source);
    }

    updateEffect(properties) {
        this._mode = properties.mode;
        this._strength = properties.factor;
        this.queue_repaint();
    }

    vfunc_get_static_shader_source() {
        return this._source;
    }

    vfunc_paint_target(...args) {
        this.set_uniform_value('tex', 0);
        this.set_uniform_value('MIX_MODE', this._mode);
        this.set_uniform_value('STRENGTH', this._strength);
        super.vfunc_paint_target(...args);
    }
});

var DaltonismEffect = GObject.registerClass({
    GTypeName: `Cjs_DaltonismEffect_${Math.random()}`,
}, class DaltonismEffect extends Clutter.ShaderEffect {
    _init(properties) {
        super._init();

        this.updateEffect(properties);

        this._source = ShaderLib.getDaltonism()
        this.set_shader_source(this._source);
    }

    updateEffect(properties) {
        this._mode = properties.mode;
        this._strength = properties.factor;
        this.queue_repaint();
    }

    vfunc_get_static_shader_source() {
        return this._source;
    }

    vfunc_paint_target(...args) {
        this.set_uniform_value('tex', 0);
        this.set_uniform_value('COLORBLIND_MODE', this._mode);
        this.set_uniform_value('STRENGTH', this._strength);
        super.vfunc_paint_target(...args);
    }
});

var ShaderLib = class {
    static getDaltonism() {
        return `
            uniform sampler2D tex;
            uniform float STRENGTH;
            uniform int COLORBLIND_MODE;

            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);

                // RGB to LMS matrix
                float L = (17.8824 * c.r) + (43.5161 * c.g) + (4.11935 * c.b);
                float M = (3.45565 * c.r) + (27.1554 * c.g) + (3.86714 * c.b);
                float S = (0.0299566 * c.r) + (0.184309 * c.g) + (1.46709 * c.b);

                float l;
                float m;
                float s;

                // Remove invisible colors
                if ( COLORBLIND_MODE == 0 || COLORBLIND_MODE == 1 || COLORBLIND_MODE == 5 ) { // Protanopia - reds are greatly reduced
                    l = 0.0 * L + 2.02344 * M + -2.52581 * S;
                    m = 0.0 * L + 1.0 * M + 0.0 * S;
                    s = 0.0 * L + 0.0 * M + 1.0 * S;
                } else if ( COLORBLIND_MODE == 2 || COLORBLIND_MODE == 3 || COLORBLIND_MODE == 6) {// Deuteranopia - greens are greatly reduced
                    l = 1.0 * L + 0.0 * M + 0.0 * S;
                    m = 0.494207 * L + 0.0 * M + 1.24827 * S;
                    s = 0.0 * L + 0.0 * M + 1.0 * S;
                } else if ( COLORBLIND_MODE == 4 || COLORBLIND_MODE == 7) {// Tritanopia - blues are greatly reduced (1 of 10 000)
                    l = 1.0 * L + 0.0 * M + 0.0 * S;
                    m = 0.0 * L + 1.0 * M + 0.0 * S;
                    // GdH - trinatopia vector calculated by me, all public sources were off
                    s = -0.012491378299329402 * L + 0.07203451899279534 * M + 0.0 * S;
                }

                // LMS to RGB matrix conversion
                vec4 error;
                error.r = (0.0809444479 * l) + (-0.130504409 * m) + (0.116721066 * s);
                error.g = (-0.0102485335 * l) + (0.0540193266 * m) + (-0.113614708 * s);
                error.b = (-0.000365296938 * l) + (-0.00412161469 * m) + (0.693511405 * s);

                // The error is what they see

                if (COLORBLIND_MODE > 4) {
                    // this is my attempt to improve algorithm of the simulation (GdH)
                    // dichromatic people are missing one of the three color information,
                    // but this doesn't mean that the missing color has no lightness for them
                    // so we need to level up lightness of the missing color

                    // convert input and output to grey scale
                    float c_light = (mix(vec3(dot(c.rgb, vec3(0.299, 0.587, 0.114))), c.rgb, 1.0)).g;
                    float e_light = (mix(vec3(dot(error.rgb, vec3(0.299, 0.587, 0.114))), error.rgb, 1.0)).g;
                    // calculate difference in lightness
                    float lightness_diff = e_light - c_light;

                    if (COLORBLIND_MODE == 5) { // protanopia

                        // shift lightness of the output towards the original lightness (this is how I see it "right")
                        error.rg = error.rg + 2.0 * lightness_diff;
                    }

                    else if (COLORBLIND_MODE == 6) { // deuteranopia
                        error.rg = error.rg + 0.7 * lightness_diff;
                    }

                    // ratio between original and error colors allows adjusting filter for weaker forms of dichromacy
                    error = error * STRENGTH + c * (1.0 - STRENGTH);
                    error.a = 1.0;

                    error.a = c.a;
                    cogl_color_out = error.rgba;
                    return;
                } else {
                    // ratio between original and error colors allows adjusting filter for weaker forms of dichromacy
                    error = error * STRENGTH + c * (1.0 - STRENGTH);
                    error.a = 1.0;

                    // Isolate invisible colors to color vision deficiency (calculate error matrix)
                    error = (c - error);

                    // Shift colors
                    vec4 correction;
                    // protanopia / protanomaly corrections
                    if ( COLORBLIND_MODE == 0 ) {
                        //(kwin effect values)
                        correction.r = error.r * 0.56667 + error.g * 0.43333 + error.b * 0.00000;
                        correction.g = error.r * 0.55833 + error.g * 0.44267 + error.b * 0.00000;
                        correction.b = error.r * 0.00000 + error.g * 0.24167 + error.b * 0.75833;

                        // tries to mimic Android, GdH
                        //correction.r = error.r * -0.5 + error.g * -0.3 + error.b * 0.0;
                        //correction.g = error.r *  0.2 + error.g *  0.0 + error.b * 0.0;
                        //correction.b = error.r *  0.2 + error.g *  1.0 + error.b * 1.0;

                    // protanopia / protanomaly high contrast G-R corrections
                    } else if ( COLORBLIND_MODE == 1 ) {
                        correction.r = error.r * 2.56667 + error.g * 0.43333 + error.b * 0.00000;
                        correction.g = error.r * 1.55833 + error.g * 0.44267 + error.b * 0.00000;
                        correction.b = error.r * 0.00000 + error.g * 0.24167 + error.b * 0.75833;

                    // deuteranopia / deuteranomaly corrections (tries to mimic Android, GdH)
                    } else if ( COLORBLIND_MODE == 2 ) {
                        correction.r = error.r * -0.7 + error.g * 0.0 + error.b * 0.0;
                        correction.g = error.r *  0.5 + error.g * 1.0 + error.b * 0.0;
                        correction.b = error.r * -0.3 + error.g * 0.0 + error.b * 1.0;

                    // deuteranopia / deuteranomaly high contrast R-G corrections
                    } else if ( COLORBLIND_MODE == 3 ) {
                        correction.r = error.r * -1.5 + error.g * 1.5 + error.b * 0.0;
                        correction.g = error.r * -1.5 + error.g * 1.5 + error.b * 0.0;
                        correction.b = error.r * 1.5 + error.g * 0.0 + error.b * 0.0;

                    // tritanopia / tritanomaly corrections (GdH)
                    } else if ( COLORBLIND_MODE == 4 ) {
                        correction.r = error.r * 0.3 + error.g * 0.5 + error.b * 0.4;
                        correction.g = error.r * 0.5 + error.g * 0.7 + error.b * 0.3;
                        correction.b = error.r * 0.0 + error.g * 0.0 + error.b * 1.0;
                    }

                    // Add compensation to original values
                    correction = c + correction;
                    correction.a = c.a;
                    cogl_color_out = correction.rgba;
                }
            }
        `;
    }

    static getChannelMix() {
        return `
            uniform sampler2D tex;
            uniform int MIX_MODE;
            uniform float STRENGTH;
            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
                vec4 m;
                if (MIX_MODE == 0) {
                    m = vec4(c.b, c.r, c.g, c.a);
                } else if (MIX_MODE == 1) {
                    m = vec4(c.g, c.b, c.r, c.a);
                }
                c = m * STRENGTH + c * (1.0 - STRENGTH);
                cogl_color_out = c;
            }
        `;
    }

    static getInversion() {
        return `
            uniform sampler2D tex;
            uniform int INVERSION_MODE;
            // Modes: 0 = Lightness
            //        1 = Lightness - white bias
            //        2 = Color

            // based on shift_whitish.glsl https://github.com/vn971/linux-color-inversion

            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
                if (INVERSION_MODE < 2) {
                    /* INVERSION_MODE ? shifted : non-shifted */
                    float mode = float(INVERSION_MODE);
                    float white_bias = mode * c.a * 0.02;
                    float m = 1.0 + white_bias;
                    float shift = white_bias + c.a - min(c.r, min(c.g, c.b)) - max(c.r, max(c.g, c.b));
                    c = vec4(  ((shift + c.r) / m),
                               ((shift + c.g) / m),
                               ((shift + c.b) / m),
                               c.a);

                } else if (INVERSION_MODE == 2) {
                    c = vec4(c.a * 1.0 - c.r, c.a * 1.0 - c.g, c.a * 1.0 - c.b, c.a);
                }

                // gamma has to be compensated to maintain perceived differences in lightness on dark and light ends of the lightness scale
                float gamma = 1.8;
                c.rgb = pow(c.rgb, vec3(1.0/gamma));

                cogl_color_out = c;
            }
        `;
    }
}
