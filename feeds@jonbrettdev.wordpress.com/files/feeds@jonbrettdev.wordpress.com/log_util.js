/*
 * Cinnamon RSS feed reader (Logger Backend)
 *
 * Author: jonbrett.dev@gmail.com
 * Date: 2015
 *
 * Cinnamon RSS feed reader applet is free software: you can redistribute it
 * and/or modify it under the terms of the GNU General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * Cinnamon RSS feed reader applet is distributed in the hope that it will be
 * useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General
 * Public License for more details.
 * You should have received a copy of the GNU General Public License along
 * with Cinnamon RSS feed reader applet.  If not, see
 * <http://www.gnu.org/licenses/>.
 */

/**
* Logger utility to allow the user to enable debug logging on the fly.
**/

function Logger(options) {
    this.uuid = options.uuid || "";
    this.verbose = options.verbose || false;
}

Logger.prototype.debug = function(msg) {
    // Only log when verbose logging is enabled
    if(this.verbose){
        global.log(this.uuid + " :: " + msg);
    }
}

Logger.prototype.info = function(msg) {
    // always display info logging
    global.log(this.uuid + " :: " + msg);
}

Logger.prototype.error = function(msg) {
    // always display error logging
    global.logError(this.uuid + " :: ERROR :: " + msg);
}