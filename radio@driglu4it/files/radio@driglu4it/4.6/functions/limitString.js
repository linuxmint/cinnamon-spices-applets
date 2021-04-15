"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.limitString = void 0;
function limitString(text) {
    const MAX_LENGTH = 40;
    if (text.length <= MAX_LENGTH)
        return text;
    return [...text].slice(0, MAX_LENGTH - 3).join('') + '...';
}
exports.limitString = limitString;
