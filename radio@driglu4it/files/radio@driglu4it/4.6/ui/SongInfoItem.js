"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSongInfoItem = void 0;
const limitString_1 = require("functions/limitString");
const IconMenuItem_1 = require("ui/IconMenuItem");
function createSongInfoItem() {
    const songInfoItem = new IconMenuItem_1.IconMenuItem("", "audio-x-generic", { hover: false });
    function setTitle(title) {
        songInfoItem.text = limitString_1.limitString(title);
    }
    Object.defineProperties(songInfoItem, {
        title: {
            set(title) {
                setTitle(title);
            }
        }
    });
    return songInfoItem;
}
exports.createSongInfoItem = createSongInfoItem;
