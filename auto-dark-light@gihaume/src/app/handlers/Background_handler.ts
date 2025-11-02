import type { Applet } from "../ui/Applet";
import type { Settings } from "../ui/Settings";
import { System_background } from "../../lib/sys/System_background";

export class Background_handler {
    private readonly _settings: Settings;

    constructor(applet: Applet, settings: Settings) {
        this._settings = settings;

        applet.on_button_detect_background_light =
            () => this.detect_light_background();
        applet.on_button_detect_background_dark =
            () => this.detect_dark_background();
        applet.on_button_apply_background_light =
            () => this.apply_light_background();
        applet.on_button_apply_background_dark =
            () => this.apply_dark_background();
    }

    detect_light_background(): void {
        const is_slideshow = System_background.is_slideshow;
        this._settings.light_background_is_slideshow = is_slideshow;
        if (is_slideshow)
            this._settings.light_background_slideshow_folder =
                System_background.slideshow_folder
                    .replace('directory://', "file://") // https://github.com/linuxmint/cinnamon/issues/12374
        else
            this._settings.light_background_file = System_background.picture_file;
    }
    detect_dark_background(): void {
        const is_slideshow = System_background.is_slideshow;
        this._settings.dark_background_is_slideshow = is_slideshow;
        if (is_slideshow)
            this._settings.dark_background_slideshow_folder =
                System_background.slideshow_folder
                    .replace('directory://', "file://"); // https://github.com/linuxmint/cinnamon/issues/12374
        else
            this._settings.dark_background_file = System_background.picture_file;
    }
    apply_light_background(): void {
        const is_slideshow = this._settings.light_background_is_slideshow;
        System_background.is_slideshow = is_slideshow;
        if (is_slideshow)
            System_background.slideshow_folder =
                decodeURIComponent( // If the folder was chosen via a filechooser, it may contain non-ASCII characters
                    this._settings.light_background_slideshow_folder
                        .replace('file://', "directory://") // https://github.com/linuxmint/cinnamon/issues/12374
                );
        else
            System_background.picture_file =
                this._settings.light_background_file;
    }
    apply_dark_background(): void {
        const is_slideshow = this._settings.dark_background_is_slideshow;
        System_background.is_slideshow = is_slideshow;
        if (is_slideshow)
            System_background.slideshow_folder =
                decodeURIComponent( // If the folder was chosen via a filechooser, it may contain non-ASCII characters
                    this._settings.dark_background_slideshow_folder
                        .replace('file://', "directory://") // https://github.com/linuxmint/cinnamon/issues/12374
                );
        else
            System_background.picture_file = this._settings.dark_background_file;
    }
}
