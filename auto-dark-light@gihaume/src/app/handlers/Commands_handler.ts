import type { Applet } from "../ui/Applet";
import { launch_command } from "../../lib/sys/launch_command";
import type { Settings } from "../ui/Settings";

export class Commands_handler {
    private readonly _settings: Settings;

    constructor(applet: Applet, settings: Settings) {
        this._settings = settings;

        applet.on_button_launch_commands_light =
            () => this.launch_light_commands();
        applet.on_button_launch_commands_dark =
            () => this.launch_dark_commands();
    }

    launch_dark_commands(): void {
        this._launch_commands(this._settings.dark_commands_list);
    }

    launch_light_commands(): void {
        this._launch_commands(this._settings.light_commands_list);
    }

    private _launch_commands(
        commands_list:
            | Settings['light_commands_list']
            | Settings['dark_commands_list']
    ): void {
        for (const command of commands_list) {
            if (!command.active)
                continue;
            launch_command(command.name, command.expiry, command.command);
        }
    }
}
