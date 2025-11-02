const { Gio } = imports.gi;

const settings = {
    desktop:  Gio.Settings.new('org.cinnamon.desktop.interface'),
    cinnamon: Gio.Settings.new('org.cinnamon.theme')
} as const;

/** An accessor to the Cinnamon system themes settings. */
export class System_themes {
    static get mouse(): string {
        return settings.desktop.get_string('cursor-theme');
    }
    static set mouse(value: string) {
        settings.desktop.set_string('cursor-theme', value);
    }

    static get apps(): string {
        return settings.desktop.get_string('gtk-theme');
    }
    static set apps(value: string) {
        settings.desktop.set_string('gtk-theme', value);
    }

    static get icons(): string {
        return settings.desktop.get_string('icon-theme');
    }
    static set icons(value: string) {
        settings.desktop.set_string('icon-theme', value);
    }

    static get desktop(): string {
        return settings.cinnamon.get_string('name');
    }
    static set desktop(value: string) {
        settings.cinnamon.set_string('name', value);
    }
}
