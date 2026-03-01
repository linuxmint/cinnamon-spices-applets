const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

let _;

/**
 * RAM Monitor Applet for Cinnamon
 * 
 * Features:
 * - Asynchronous data fetching to prevent UI blocking.
 * - Monospaced font stability for consistent panel layout.
 * - Dynamic warning thresholds with visual blink alerts.
 */
class MaRamMonitorApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        // Initialize settings and bind them to local properties
        // This section sets up the applet's settings and binds them to properties on the applet instance. Each setting is linked to a method that updates the UI when the setting changes, ensuring that user preferences are reflected immediately without needing to restart the applet.
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);

        // --- Core UI Settings ---
        this.settings.bindProperty(Settings.BindingDirection.IN, "mem-label", "mem_label", this._update_ui, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-mode", "show_mode", this._update_ui, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-total", "show_total", this._update_ui, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-value", "show_value", this._update_ui, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-percent", "show_percent", this._update_ui, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "unit-type", "unit_type", this._update_ui, null);

        // --- Loop & Threshold Settings ---
        this.settings.bindProperty(Settings.BindingDirection.IN, "frequency", "frequency", this._on_frequency_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "warning-usage", "warning_usage", this._update_ui, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "warning-available", "warning_available", this._update_ui, null);

        // --- Layout Stability & Interaction ---
        this.settings.bindProperty(Settings.BindingDirection.IN, "use-monospace", "use_monospace", () => {
            this._apply_label_style();
            this._update_ui();
        }, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "padding-size", "padding_size", this._update_ui, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "enable-click-launch", "enable_click_launch", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "custom-command", "custom_command", null, null);

        // UI Container - Using BoxLayout for layout stability
        // The applet's main container is a BoxLayout, which provides a stable and flexible layout for the label. This choice helps prevent layout shifts and ensures that the applet remains visually consistent regardless of the content being displayed. The main label is added to this box, and the box is then added to the applet's actor, forming the basic structure of the UI.
        this._box = new St.BoxLayout();
        this._mainLabel = new St.Label({
            text: "",
            y_align: Clutter.ActorAlign.CENTER
        });

        this.actor.add_child(this._box);
        this._box.add_child(this._mainLabel);

        // Internal State Management
        // These properties manage the warning state and blinking effect. The _isWarningActive flag indicates whether the current memory usage is in a warning state based on user-defined thresholds. The _blinkState is used to toggle the visual state for the blinking effect. The _timeoutId and _blinkTimeoutId are used to manage the scheduling of the main update loop and the blink loop, allowing for proper cleanup when the applet is removed.
        // The initialization of these properties ensures that the applet starts in a known state, with no active warnings and no scheduled loops until the main update loop is started. This contributes to the stability and predictability of the applet's behavior from the moment it is added to the panel.
        this._isWarningActive = false;
        this._blinkState = false;
        this._timeoutId = 0;
        this._blinkTimeoutId = 0;

        // Apply initial styles and start the update loops
        // The initial call to _apply_label_style ensures that the font style is set according to user preferences right from the start, preventing any layout shifts when the applet first appears. The _update_loop and _blink_loop methods are then called to start the regular updates and warning animations, ensuring that the applet is fully functional as soon as it is added to the panel.
        // The order of these calls is important: we apply styles before starting the loops to ensure that the UI is correctly styled before any updates occur, which contributes to a smoother user experience.
        this._apply_label_style();
        this._update_loop();
        this._blink_loop();
    }

    /**
     * Restarts the main update loop when user changes the frequency in settings.
     * This ensures that the applet updates at the new interval without requiring a full restart, providing a seamless user experience when adjusting refresh rates.
     */
    _on_frequency_changed() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this._update_loop();
    }

    /**
     * Primary loop for fetching system memory data.
     * This loop is responsible for regularly updating the displayed memory information based on the user-defined frequency. It calls the asynchronous method to fetch memory data, processes it according to user settings, and updates the UI. The loop is designed to be efficient and responsive, ensuring that the applet remains up-to-date without causing performance issues. If the frequency setting is changed by the user, this loop will be restarted with the new interval to reflect the updated refresh rate.
     */
    _update_loop() {
        this._update_ui();
        let interval = parseFloat(this.frequency) * 1000;
        this._timeoutId = Mainloop.timeout_add(interval, () => {
            this._update_loop();
            return false;
        });
    }

    /**
     * Secondary loop for the warning animation.
     * Includes existence checks and ensures the loop stops if the applet is removed.
     * This loop toggles the "warning-blink" style class on the applet's actor to create a blinking effect when memory usage crosses user-defined thresholds. The loop runs every 500ms, but only applies the blinking effect when the warning state is active. If the applet is removed while this loop is running, it will detect that the main label no longer exists and will stop scheduling further iterations, preventing potential errors or crashes due to missing UI elements.
     */
    _blink_loop() {
        // Safety check: If the applet was removed, stop the loop immediately
        if (!this._mainLabel) {
            this._blinkTimeoutId = 0;
            return false; // This stops the Mainloop
        }

        // Warning state management - toggles the "warning-blink" style class based on thresholds
        if (this._isWarningActive) {
            this._blinkState = !this._blinkState;

            if (this._blinkState) {
                this.actor.add_style_class_name("warning-blink");
            } else {
                this.actor.remove_style_class_name("warning-blink");
            }
        } else {
            // Ensure visual state is reset when warning is no longer active
            if (this._blinkState || this.actor.has_style_class_name("warning-blink")) {
                this.actor.remove_style_class_name("warning-blink");
                this._blinkState = false;
            }
        }

        // Schedule the next blink iteration
        this._blinkTimeoutId = Mainloop.timeout_add(500, () => {
            this._blink_loop();
            return false;
        });
    }

    /**
     * Applies or removes monospace font styling based on user preference.
     * This method is called both during initialization and when the user toggles the monospace setting. It ensures that the font style is updated immediately to reflect the user's choice, contributing to a stable and consistent layout in the panel.
     * The use of monospace fonts can help prevent layout shifts by ensuring that all characters occupy the same width, which is particularly beneficial for displaying numerical data like memory usage. When monospace is enabled, the font is set to "monospace" with bold weight for better readability. When disabled, the font style is reset to the default, allowing for a more traditional appearance if the user prefers it.
     * The method also includes a safety check to ensure that it only attempts to apply styles if the main label exists, preventing potential errors if the applet is removed while this method is being executed.
     */
    _apply_label_style() {
        if (!this._mainLabel) return;
        if (this.use_monospace) {
            this._mainLabel.set_style("font-family: monospace; font-weight: bold;");
        } else {
            this._mainLabel.set_style(null);
        }
    }

    /**
     * Main UI renderer - now asynchronous with safety checks.
     * Includes robust error handling for file reading and parsing, and ensures that if the applet is removed while waiting for data, it will not attempt to update the UI, preventing potential errors or crashes.
     * The method fetches memory information asynchronously to avoid blocking the main thread, processes the data according to user settings, and updates the display. It also manages the warning state based on user-defined thresholds and ensures that the UI remains responsive and accurate even in edge cases such as read errors or applet removal during asynchronous operations.
     */
    async _update_ui() {
        // Fetch memory data asynchronously
        const memData = await this._getMemInfoAsync();

        // GUARD: Check if the applet was removed while waiting for data
        // If _mainLabel no longer exists, we stop execution to prevent errors
        if (!this._mainLabel) return;

        // Handle case where memory data could not be retrieved
        if (!memData) {
            this._mainLabel.set_text(_("RAM error"));
            return;
        }

        // Data processing and display logic
        const { total, available } = memData;
        const used = total - available;
        const divisor = this.unit_type === "GiB" ? Math.pow(1024, 3) : Math.pow(1000, 3);

        // Calculate display values based on user settings
        const totalNum = (total * 1024 / divisor);
        const mainNum = (this.show_mode === "used" ? (used * 1024) : (available * 1024)) / divisor;
        const pNum = (this.show_mode === "used" ? (used / total) : (available / total)) * 100;

        // Formatting with optional monospace padding
        const NBSP = "\u00A0"; // Non-breaking space
        let displayVal = mainNum.toFixed(1);
        let displayTotal = totalNum.toFixed(1);
        let displayPercent = pNum.toFixed(1);

        // Apply padding for monospace if enabled
        if (this.use_monospace) {
            displayVal = displayVal.padStart(this.padding_size, NBSP);
            displayTotal = displayTotal.padStart(this.padding_size, NBSP);
            displayPercent = displayPercent.padStart(this.padding_size, NBSP);
        }

        // Construct the display string based on user preferences
        let content = "";
        if (this.show_value) {
            content += displayVal;
            if (this.show_total) content += " / " + displayTotal;
            content += " " + this.unit_type;
        }

        // Add percentage display if enabled
        if (this.show_percent) {
            let spacePrefix = this.show_value ? " " : "";
            content += spacePrefix + "(" + displayPercent + "%)";
        }

        // If neither value nor percent is shown, default to showing percent for clarity
        if (!this.show_value && !this.show_percent) {
            content = displayPercent + "%";
        }

        // Add optional prefix label from settings
        let prefixText = this.mem_label ? this.mem_label : "";

        // Update the main label with the constructed content
        this._mainLabel.set_text(prefixText + content);

        // Update tooltip to reflect current display mode
        this.set_applet_tooltip(this.show_mode === "used" ? _("Used RAM") : _("Available RAM"));

        // Warning Logic - Determine if warning state should be active based on thresholds
        if (this.show_mode === "used") {
            this._isWarningActive = this.warning_usage < 100 && parseFloat(pNum) >= this.warning_usage;
        } else {
            this._isWarningActive = this.warning_available > 0 && parseFloat(pNum) <= this.warning_available;
        }
    }

    /**
     * Reads /proc/meminfo asynchronously to prevent GUI stutters.
     * Optimized to stop parsing as soon as required fields are found.
     */
    async _getMemInfoAsync() {
        try {
            let file = Gio.File.new_for_path("/proc/meminfo");

            // Read file contents asynchronously
            // The use of a Promise here allows us to read the file without blocking the main thread. The load_contents_async method is called, and we wait for it to complete using the Promise. If the file is read successfully, we resolve the Promise with the contents; if there is an error, we reject it with an appropriate error message.
            // The contents are returned as a byte array, which we will decode into a string for processing.
            const contents = await new Promise((resolve, reject) => {
                file.load_contents_async(null, (obj, res) => {
                    try {
                        let [success, contents] = obj.load_contents_finish(res);
                        if (success) resolve(contents);
                        else reject(new Error("Could not read file"));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            // FIX: Use TextDecoder instead of contents.toString()
            // This prevents the Gjs-WARNING and ensures future compatibility.
            let decoder = new TextDecoder('utf-8');
            let text = decoder.decode(contents);
            let lines = text.split('\n');

            let memInfo = { total: null, available: null };

            // Parse lines to find MemTotal and MemAvailable
            // The loop iterates through each line of the /proc/meminfo output, looking for the lines that start with "MemTotal:" and "MemAvailable:". When it finds these lines, it extracts the numerical value by removing all non-digit characters and parsing the result as an integer. The loop is optimized to stop as soon as both values are found, which can improve performance on systems with large memory where the relevant information is near the top of the file.
            for (let line of lines) {
                if (line.startsWith('MemTotal:') && memInfo.total === null) {
                    memInfo.total = parseInt(line.replace(/\D/g, ''));
                } else if (line.startsWith('MemAvailable:') && memInfo.available === null) {
                    memInfo.available = parseInt(line.replace(/\D/g, ''));
                }

                // Optimization: Stop parsing once we have both values
                if (memInfo.total !== null && memInfo.available !== null) break;
            }

            // Return only if we have both values and they are valid numbers
            return (memInfo.total > 0 && memInfo.available > 0) ? memInfo : null;

        } catch (e) {
            global.logError(`[MaRamMonitorApplet]: ` + _("Kernel read error: %s").replace("%s", e.message));
            return null;
        }
    }

    /**
     * Click handler to spawn a system monitor.
     * Verifies if the command exists in PATH before execution.
     */
    on_applet_clicked(event) {
        if (this.enable_click_launch && this.custom_command) {
            let cmdBase = this.custom_command.split(" ")[0];
            if (GLib.find_program_in_path(cmdBase)) {
                imports.misc.util.spawnCommandLine(this.custom_command);
            } else {
                imports.ui.main.notify(_("RAM Applet error"), _('Command "%s" not found.').replace("%s", cmdBase));
            }
        }
    }

    /**
     * Cleanup resources when the applet is removed from the panel.
     * Ensures all loops are terminated and references are cleared.
     * This prevents potential memory leaks and ensures that the applet can be safely removed without leaving behind orphaned processes or UI elements.
     * The existence checks in the loops ensure that if the applet is removed while an asynchronous operation is pending, the loops will stop gracefully without throwing errors due to missing UI elements.
     * This method is crucial for maintaining the stability and performance of the Cinnamon desktop environment, especially when users frequently add and remove applets from their panels.
     */
    on_applet_removed_from_panel() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        if (this._blinkTimeoutId) {
            Mainloop.source_remove(this._blinkTimeoutId);
            this._blinkTimeoutId = 0;
        }

        this._mainLabel = null;
        this._box = null;
    }
}

/**
 * Initializes gettext translations for the applet.
 * Ensures that all user-facing strings can be localized based on the applet's UUID and locale directory.
 * This function is called once during the applet's main initialization.
 * @param {*} uuid The unique identifier for the applet, used to locate translation files.
 */
function initTranslations(uuid) {
    Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid + "/locale");
    _ = (str) => Gettext.dgettext(uuid, str);
}

/**
 * Main entry point for the applet. Called by Cinnamon when the applet is added to the panel.
 * Initializes translations and creates an instance of the MaRamMonitorApplet class.
 * The parameters are provided by Cinnamon and include metadata about the applet, its orientation, panel height, and instance ID.
 * @param {*} metadata An object containing metadata about the applet, such as its UUID, name, description, version, etc. This is defined in the applet's metadata.json file.
 * @param {*} orientation The orientation of the panel where the applet is placed (e.g., St.Side.TOP, St.Side.BOTTOM, etc.). This can be used to adjust the applet's layout or styling based on its position.
 * @param {*} panelHeight The height of the panel in pixels. This can be useful for scaling the applet's UI elements appropriately to fit within the panel.
 * @param {*} instanceId A unique identifier for this instance of the applet. This is important for managing multiple instances of the same applet and ensuring that settings are applied correctly to each instance.
 * @returns {MaRamMonitorApplet} An instance of the MaRamMonitorApplet class, which will be managed by Cinnamon.
 */
function main(metadata, orientation, panelHeight, instanceId) {
    initTranslations(metadata.uuid);
    return new MaRamMonitorApplet(metadata, orientation, panelHeight, instanceId);
}