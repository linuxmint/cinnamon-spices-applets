const { Clipboard, ClipboardType } = imports.gi.St

export function copyText(text: string) {
    Clipboard.get_default().set_text(ClipboardType.CLIPBOARD, text)
}