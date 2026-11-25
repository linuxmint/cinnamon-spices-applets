/* shader.js
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

const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;

// GObject classes are registered lazily, once per shader while the module is loaded.
const _shaderClasses = new Map();

/**
 * Returns the GLSL effect class for the given shader, registering it on first use.
 * A unique GType name is used because the applet modules may be evaluated again
 * (e.g. on applet reload) while the previously registered types still exist.
 * @param {String} id The shader id
 * @param {String} declarations The GLSL declarations (uniforms, functions)
 * @param {String} code The GLSL code of the fragment's main function
 * @returns {GObject.Class} A Cinnamon.GLSLEffect subclass
 */
function getShaderClass(id, declarations, code) {
    if (_shaderClasses.has(id)) return _shaderClasses.get(id);

    const typeName = `CEyesShader_${id}_${GLib.uuid_string_random().replace(/-/g, "")}`;

    const shaderClass = GObject.registerClass({
        GTypeName: typeName,
    }, class CEyesShaderEffect extends Cinnamon.GLSLEffect {
        vfunc_build_pipeline() {
            this.add_glsl_snippet(Cinnamon.SnippetHook.FRAGMENT, declarations, code, true);
        }
    });

    _shaderClasses.set(id, shaderClass);
    return shaderClass;
}


/**
 * A GLSL fragment shader applied on an actor, on the GPU.
 *
 * The shader code replaces the fragment processing: what the actor paints is
 * available as layer 0 (e.g. `uniform sampler2D tex;` sampled at
 * `cogl_tex_coord_in[0]`, premultiplied alpha) and the result must be written
 * to `cogl_color_out`, premultiplied and multiplied by `cogl_color_in`.
 */
var ShaderLayer = class ShaderLayer {
    /**
     * @param {String} id The shader id, unique for each declarations and code pair
     * @param {String} declarations The GLSL declarations (uniforms, functions)
     * @param {String} code The GLSL code of the fragment's main function
     * @param {String[]} uniforms The names of the float uniforms set with setUniform
     */
    constructor(id, declarations, code, uniforms) {
        const ShaderClass = getShaderClass(id, declarations, code);

        this._name = `c-eyes-${id}`;
        this._effect = new ShaderClass();
        this._locations = new Map(uniforms.map(u => [u, this._effect.get_uniform_location(u)]));
        this._actor = null;
    }

    attach(actor) {
        this.detach();
        actor.add_effect_with_name(this._name, this._effect);
        this._actor = actor;
    }

    detach() {
        if (!this._actor) return;
        this._actor.remove_effect(this._effect);
        this._actor = null;
    }

    /**
     * Sets a float uniform (float, vec2, vec3 or vec4, depending on the number of values)
     * @param {String} name The uniform name, as given to the constructor
     * @param {number[]} values The uniform components
     */
    setUniform(name, values) {
        const location = this._locations.get(name);
        // Uniforms unused by the code are optimized away by the GLSL compiler.
        if (location === undefined || location < 0) return;
        this._effect.set_uniform_float(location, values.length, values);
    }

    /**
     * Requests a new frame of the shader. Only the shader runs again: the actor isn't repainted.
     */
    queueRepaint() {
        this._effect.queue_repaint();
    }

    destroy() {
        this.detach();
        this._effect = null;
    }
}
