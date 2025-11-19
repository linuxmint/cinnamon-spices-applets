const { Gio } = imports.gi;

const settings = {
    background:  Gio.Settings.new('org.cinnamon.desktop.background'),
    slideshow:   Gio.Settings.new('org.cinnamon.desktop.background.slideshow'),
} as const;

/** An accessor to the Cinnamon system background settings. */
export class System_background {
    static get is_slideshow(): boolean {
        return settings.slideshow.get_boolean('slideshow-enabled');
    }
    static set is_slideshow(value: boolean) {
        settings.slideshow.set_boolean('slideshow-enabled', value);
    }

    /** Irrelevant to get when slideshow is enabled */
    static get picture_file(): string {
        return settings.background.get_string('picture-uri');
    }
    /** /!\ To not set when slideshow is enabled */
    static set picture_file(value: string) {
        settings.background.set_string('picture-uri', value);
    }

    /** Irrelevant to get when slideshow is disabled */
    static get slideshow_folder(): string {
        return settings.slideshow.get_string('image-source');
    }
    /** /!\ To not set when slideshow is disabled */
    static set slideshow_folder(value: string) {
        settings.slideshow.set_string('image-source', value);
    }
}
