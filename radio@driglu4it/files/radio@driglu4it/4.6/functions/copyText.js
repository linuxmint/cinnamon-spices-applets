"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyText = void 0;
const { Clipboard, ClipboardType } = imports.gi.St;
function copyText(text) {
    Clipboard.get_default().set_text(ClipboardType.CLIPBOARD, text);
}
exports.copyText = copyText;
