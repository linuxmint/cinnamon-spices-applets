/* =========================================================
 * GJS / Cinnamon Runtime Declarations
 * ========================================================= */

/* ---------- global objects ---------- */
declare const global: any;
declare const imports: any;

/* ---------- CommonJS / AMD helpers ---------- */
declare const exports: any;
declare function require(path: string): any;

/* ---------- Cinnamon Signals ---------- */
declare namespace Signals {
    interface Signals {
        connect(name: string, callback: Function): number;
        disconnect(id: number): void;
        emit(name: string, ...args: any[]): void;
    }
}

/* ---------- Cinnamon Applet base ---------- */
declare namespace imports.ui.applet {
    class TextIconApplet {
        constructor(orientation: any, panelHeight: number, instanceId: number);
        set_applet_label(label: string): void;
        set_applet_tooltip(text: string): void;
        set_applet_icon_name(name: string): void;
    }
}

/* ---------- Cinnamon / St / Clutter ---------- */
declare namespace imports.gi {
    const St: any;
    const Clutter: any;
    const Gio: any;
    const GLib: any;
    const Cinnamon: any;
}

/* ---------- Cinnamon helpers ---------- */
declare namespace imports.signals {}
declare namespace imports.mainloop {}
declare namespace imports.ui.popupMenu {}
declare namespace imports.ui.settings {}
declare namespace imports.ui.main {}
declare namespace imports.misc.util {}
declare namespace imports.misc.fileUtils {}
declare namespace imports.gettext {}

