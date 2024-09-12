/* helpers.js
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

const { STYLE_TWEAK_UNSET_KEY } = require("./constants.js");

function basicStylesDecoder(stylesText) {
    let stylesObject = {};

    if (stylesText) {
        let stylesDeclarations = stylesText.split(";");

        for (let styleDecl of stylesDeclarations) {
            if (!styleDecl) continue;
            let [style, value] = styleDecl.split(":");
            stylesObject[style.trim()] = value.trim();
        }
    }

    return stylesObject;
}

function basicStylesEncoder(stylesObject) {
    let stylesEncoded = "";

    if (stylesObject)
        for (let [key, value] of Object.entries(stylesObject))
            if (value && value !== STYLE_TWEAK_UNSET_KEY)
                stylesEncoded += `${key}: ${value}; `;

    return stylesEncoded.trimEnd();
}

function round(value, nplaces = 0) {
    let multDiv = 10 ** nplaces;
    return Math.round(value * multDiv) / multDiv;
}