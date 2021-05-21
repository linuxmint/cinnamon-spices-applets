"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.limitString = void 0;
function limitString(text, maxCharNumber) {
    if (!text)
        return;
    if (text.length <= maxCharNumber)
        return text;
    return [...text].slice(0, maxCharNumber - 3).join('') + '...';
}
exports.limitString = limitString;
