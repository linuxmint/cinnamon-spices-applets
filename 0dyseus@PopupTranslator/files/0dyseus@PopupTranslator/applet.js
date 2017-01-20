const appletUUID = "0dyseus@PopupTranslator";
const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const Main = imports.ui.main;
const Tooltips = imports.ui.tooltips;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;

const OrnamentType = {
    NONE: 0,
    CHECK: 1,
    DOT: 2,
    ICON: 3
};

var $;

// For translation mechanism.
// Comments that start with // NOTE: are to be extracted by xgettext
// and are directed to translators only.
function _(aStr) {
    let customTrans = Gettext.dgettext(appletUUID, aStr);

    if (customTrans !== aStr)
        return customTrans;

    return Gettext.gettext(aStr);
}

function MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    this._init(aMetadata, aOrientation, aPanel_height, aInstance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(aMetadata, aOrientation, aPanel_height, aInstance_id) {
        Applet.TextIconApplet.prototype._init.call(this, aOrientation, aPanel_height, aInstance_id);

        this.settings = new Settings.AppletSettings(this, aMetadata.uuid, aInstance_id);
        this._bindSettings();

        this.applet_dir = aMetadata.path;
        this.metadata = aMetadata;
        this.orientation = aOrientation;
        this.main_applet_dir = this.applet_dir;

        try {
            // Use the this.main_applet_dir directory for imports shared by all supported Cinnamon versions.
            // If I use just this.applet_dir, I would be forced to put the files to be imported
            // repeatedly inside each version folder. ¬¬
            let regExp = new RegExp("(" + aMetadata.uuid + ")$", "g");
            if (!regExp.test(this.main_applet_dir)) {
                let tempFile = Gio.file_new_for_path(this.main_applet_dir);
                this.main_applet_dir = tempFile.get_parent().get_path();
            }

            // Import from main applet directory, not from "Cinnamon version" sub folders.
            imports.searchPath.push(this.main_applet_dir);
            // ALWAYS use the xlet UUID for the name of the "modules file".
            // Otherwise, it will import the wrong file and generate conflicts with other xlets
            // using a "modules file" with the exact same name. I learned this the hard way!!! ¬¬
            $ = imports[aMetadata.uuid];

            Gettext.bindtextdomain(this.metadata.uuid, GLib.get_home_dir() + "/.local/share/locale");

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._buildMenu();

            this.forceTranslation = false;
            this.detectedLang = "";

            this._updateIconAndLabel();
            this.set_applet_tooltip(_(aMetadata.name));
            this._expandAppletContextMenu();
            this.ensureHistoryFileExists();

            if (!this.pref_all_dependencies_met)
                this.checkDependencies();
        } catch (aErr) {
            global.logError(aErr);
        }

    },

    _expandAppletContextMenu: function() {
        try {
            this.google_context_check = new PopupMenu.PopupIndicatorMenuItem(this.providerData.google.name);
            this.google_context_check.tooltip = new Tooltips.Tooltip(
                this.google_context_check.actor,
                _("Set %s as default translation engine.").format(this.providerData.google.name)
            );
            this.google_context_check.setOrnament(OrnamentType.DOT, this.service_provider === "google");
            this.google_context_check.connect("activate", Lang.bind(this, function() {
                this._setContextCheckboxes("google");
            }));
            this._applet_context_menu.addMenuItem(this.google_context_check);

            this.yandex_context_check = new PopupMenu.PopupIndicatorMenuItem(this.providerData.yandex.name);
            this.yandex_context_check.tooltip = new Tooltips.Tooltip(
                this.yandex_context_check.actor,
                _("Set %s as default translation engine.").format(this.providerData.yandex.name)
            );
            this.yandex_context_check.setOrnament(OrnamentType.DOT, this.service_provider === "yandex");
            this.yandex_context_check.connect("activate", Lang.bind(this, function() {
                this._setContextCheckboxes("yandex");
            }));
            this._applet_context_menu.addMenuItem(this.yandex_context_check);
        } catch (aErr) {
            global.logError(aErr);
        }

        let menuItem = new PopupMenu.PopupSeparatorMenuItem();
        this._applet_context_menu.addMenuItem(menuItem);

        menuItem = new PopupMenu.PopupIconMenuItem(
            _("Translation history"),
            "popup-translator-document-open-recent",
            St.IconType.SYMBOLIC
        );
        menuItem.tooltip = new Tooltips.Tooltip(
            menuItem.actor,
            _("Open translation history window.")
        );
        menuItem.connect("activate", Lang.bind(this, function() {
            try {
                this.openTranslationHistory();
            } catch (aErr) {
                global.logError(aErr);
            }
        }));
        this._applet_context_menu.addMenuItem(menuItem);

        menuItem = new PopupMenu.PopupIconMenuItem(
            _("Check dependencies"),
            "popup-translator-edit-find",
            St.IconType.SYMBOLIC
        );
        menuItem.tooltip = new Tooltips.Tooltip(
            menuItem.actor,
            _("Check whether the dependencies for this applet are met.")
        );
        menuItem.connect("activate", Lang.bind(this, function() {
            this.checkDependencies();
        }));
        this._applet_context_menu.addMenuItem(menuItem);

        menuItem = new PopupMenu.PopupIconMenuItem(
            _("Help"),
            "dialog-information",
            St.IconType.SYMBOLIC
        );
        menuItem.tooltip = new Tooltips.Tooltip(
            menuItem.actor,
            _("Open this applet help file.")
        );
        menuItem.connect("activate", Lang.bind(this, function() {
            Util.spawn(["xdg-open", this.main_applet_dir + "/HELP.md"]);
        }));
        this._applet_context_menu.addMenuItem(menuItem);
    },

    _setContextCheckboxes: function(aProvider) {
        try {
            this.pref_service_provider = aProvider;
            this.google_context_check._ornament.child._delegate.setToggleState(aProvider === "google");
            this.yandex_context_check._ornament.child._delegate.setToggleState(aProvider === "yandex");
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    _updateIconAndLabel: function() {
        try {
            if (this.pref_custom_icon_for_applet === "") {
                this.set_applet_icon_name("");
            } else if (GLib.path_is_absolute(this.pref_custom_icon_for_applet) &&
                GLib.file_test(this.pref_custom_icon_for_applet, GLib.FileTest.EXISTS)) {
                if (this.pref_custom_icon_for_applet.search("-symbolic") != -1)
                    this.set_applet_icon_symbolic_path(this.pref_custom_icon_for_applet);
                else
                    this.set_applet_icon_path(this.pref_custom_icon_for_applet);
            } else if (Gtk.IconTheme.get_default().has_icon(this.pref_custom_icon_for_applet)) {
                if (this.pref_custom_icon_for_applet.search("-symbolic") != -1)
                    this.set_applet_icon_symbolic_name(this.pref_custom_icon_for_applet);
                else
                    this.set_applet_icon_name(this.pref_custom_icon_for_applet);
                /**
                 * START mark Odyseus
                 * I added the last condition without checking Gtk.IconTheme.get_default.
                 * Otherwise, if there is a valid icon name added by
                 *  Gtk.IconTheme.get_default().append_search_path, it will not be recognized.
                 * With the following extra condition, the worst that can happen is that
                 *  the applet icon will not change/be set.
                 */
            } else {
                try {
                    if (this.pref_custom_icon_for_applet.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_name(this.pref_custom_icon_for_applet);
                    else
                        this.set_applet_icon_name(this.pref_custom_icon_for_applet);
                } catch (aErr) {
                    global.logError(aErr);
                }
            }
        } catch (aErr) {
            global.logWarning("Could not load icon file \"" + this.pref_custom_icon_for_applet + "\" for menu button");
        }

        if (this.pref_use_a_custom_icon_for_applet && this.pref_custom_icon_for_applet === "") {
            this._applet_icon_box.hide();
        } else {
            this._applet_icon_box.show();
        }

        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) { // no menu label if in a vertical panel
            this.set_applet_label("");
        } else {
            if (this.pref_custom_label_for_applet !== "")
                this.set_applet_label(_(this.pref_custom_label_for_applet));
            else
                this.set_applet_label("");
        }

        this.update_label_visible();
    },

    update_label_visible: function() {
        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (typeof this.hide_applet_label !== "function")
            return;

        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT)
            this.hide_applet_label(true);
        else
            this.hide_applet_label(false);
    },

    on_orientation_changed: function(orientation) {
        this.orientation = orientation;
        this._buildMenu();
        this._updateIconAndLabel();
    },

    _buildMenu: function() {
        try {
            if (this.menu) {
                this.menuManager.removeMenu(this.menu);
                this.menu.destroy();
            }

            this.menu = new Applet.AppletPopupMenu(this, this.orientation);
            this.menu._transTable = new $.TranslationMenuItem(this);
            this.menu.addMenuItem(this.menu._transTable);
            this.menuManager.addMenu(this.menu);
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    _displayHistory: function(aSourceText) {
        let historyEntry = this.transHistory[aSourceText];
        this._displayPopup(
            historyEntry["sL"],
            historyEntry["tL"],
            aSourceText,
            "[" + _("History") + "] " + historyEntry["tT"]
        );
    },

    _displayPopup: function(aDetectedLang, aTargetLang, aSourceText, aTranslatedText) {
        try {
            let m = this.menu._transTable;
            if (m) {
                m.sourceText = aSourceText;
                m.providerURL = this.providerData[this.service_provider].websiteURL;
                m.providerURI = (this.providerData[this.service_provider].websiteURI)
                    .format(aTargetLang, encodeURIComponent(aSourceText));
                m.languagePair.set_text($.langs[aDetectedLang] + " > " + $.langs[aTargetLang]);
                m.translatedText.set_text(aTranslatedText);
                m.footerButton.tooltip._tooltip.set_text(_("Go to %s's website")
                    .format(this.providerData[this.service_provider].name));
                m.footerLabel.set_text(("Powered By %s")
                    .format(this.providerData[this.service_provider].name));
            }
        } finally {
            if (!this.menu.isOpen)
                this.menu.open(true);
        }
    },

    _bindSettings: function() {
        let bD = Settings.BindingDirection || null;
        let settingsArray = [
            [bD.IN, "pref_custom_icon_for_applet", this._updateIconAndLabel],
            [bD.IN, "pref_custom_label_for_applet", this._updateIconAndLabel],
            [bD.IN, "pref_translate_key", this._updateKeybindings],
            [bD.IN, "pref_force_translate_key", this._updateKeybindings],
            [bD.BIDIRECTIONAL, "pref_service_provider", null],
            [bD.IN, "pref_source_lang", null],
            [bD.IN, "pref_target_lang", null],
            [bD.IN, "pref_style_for_language_pair", null],
            [bD.IN, "pref_style_for_translated_text", null],
            [bD.IN, "pref_style_for_footer", null],
            [bD.IN, "pref_history_timestamp", null],
            [bD.IN, "pref_history_timestamp_custom", null],
            [bD.IN, "pref_history_initial_window_width", null],
            [bD.IN, "pref_history_initial_window_height", null],
            [bD.IN, "pref_history_width_to_trigger_word_wrap", null],
            [bD.IN, "pref_yandex_api_keys", null],
            [bD.BIDIRECTIONAL, "pref_all_dependencies_met", null],
        ];
        let newBinding = typeof this.settings.bind === "function";
        for (let [binding, property_name, callback] of settingsArray) {
            // Condition needed for retro-compatibility.
            // Mark for deletion on EOL.
            if (newBinding)
                this.settings.bind(property_name, property_name, callback);
            else
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    },

    translate: function(aForce) {
        this.forceTranslation = aForce;

        let selection = this.selection;

        if (selection === "" || selection === " ")
            return;

        let historyEntry = this.transHistory[selection];

        if (this.forceTranslation)
            historyEntry = false;

        if (historyEntry) {
            this._displayHistory(selection);
            return;
        }

        switch (this.service_provider) {
            case "google":
                let GoogleURL = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=%s&tl=%s&dt=t&q=".format(
                    this.pref_source_lang === "" ? "auto" : this.pref_source_lang,
                    this.pref_target_lang);
                this.Google_provider(GoogleURL, selection);
                break;
            case "yandex":
                let YandexURL = "https://translate.yandex.net/api/v1.5/tr.json/translate?key=%s&lang=%s&text=%s&format=plain&options=1";
                this.Yandex_provider(YandexURL, selection);
                break;
        }
    },

    Yandex_provider: function(aURL, aSourceText) {
        try {
            let APIKeys = this.pref_yandex_api_keys.split("\n").filter(function(aKey) { // Filter possible empty elements.
                if (aKey !== "")
                    return true;
            });

            if (APIKeys.length === 0) {
                Main.criticalNotify(_(this.metadata.name), [
                    _("No Yandex API keys were found!!!"),
                    _("Check this applet HELP.md file for instructions."),
                    _("It can be accessed from this applet context menu.")
                ].join("\n"));
                return;
            }

            let langPair = (this.pref_source_lang === "") ?
                this.pref_target_lang :
                this.pref_source_lang + "-" + this.pref_target_lang;
            let randomKey = APIKeys[Math.floor(Math.random() * APIKeys.length - 1) + 1];

            Util.spawn_async([
                    "python3",
                    this.main_applet_dir + "/appletHelper.py",
                    "yandex",
                    aURL,
                    randomKey,
                    langPair,
                    aSourceText
                ],
                Lang.bind(this, function(aResponse) {
                    try {
                        let result = JSON.parse(aResponse);
                        let transText = "",
                            errorMessage = "",
                            targetLang = this.pref_target_lang,
                            detectedLang = "",
                            informError = true;
                        switch (result.code) {
                            case 200:
                                informError = false;
                                transText = result.text[0];

                                if (this.pref_source_lang === "")
                                    detectedLang = result.detected.lang || "?";
                                else
                                    detectedLang = this.pref_source_lang;

                                // Do not save history if the source text is equal to the translated text.
                                if (aSourceText !== transText) {
                                    this.setTransHistory(
                                        aSourceText, {
                                            d: this._getTimeStamp(new Date().getTime()),
                                            sL: detectedLang,
                                            tL: targetLang,
                                            tT: transText
                                        }
                                    );
                                }

                                this._displayPopup(
                                    detectedLang,
                                    targetLang,
                                    aSourceText,
                                    transText
                                );
                                break;
                            case 401:
                                errorMessage = _("API key is invalid");
                                break;
                            case 402:
                                errorMessage = _("Blocked API key");
                                break;
                            case 404:
                                errorMessage = _("Exceeded the daily limit on the amount of translated text");
                                break;
                            case 413:
                                errorMessage = _("Exceeded the maximum text size");
                                break;
                            case 422:
                                errorMessage = _("The text cannot be translated");
                                break;
                            case 501:
                                errorMessage = _("The specified translation direction is not supported");
                                break;
                        }

                        if (informError) {
                            this._notifyParseError("Yandex Translator");
                            global.logError(errorMessage);

                            if (result.code === 401 || result.code === 402)
                                global.logError("API key: " + randomKey);
                        }
                    } catch (aErr) {
                        this._notifyParseError("Yandex Translator");
                        global.logError(aErr);
                    }
                }));
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    Google_provider: function(aURL, aSourceText) {
        try {
            Util.spawn_async([
                    "python3",
                    this.main_applet_dir + "/appletHelper.py",
                    "google",
                    aURL,
                    encodeURIComponent(aSourceText)
                ],
                Lang.bind(this, function(aResponse) {
                    let transText = "",
                        detectedLang;
                    try {
                        let result = JSON.parse(aResponse.replace(/,+/g, ",")),
                            targetLang = this.pref_target_lang;

                        if (result[0].length > 1) {
                            let i = 0,
                                iLen = result[0].length;
                            for (; i < iLen; i++) {
                                transText += (result[0][i][0]).trim() + " ";
                            }
                        } else {
                            transText = result[0][0][0];
                        }

                        if (this.pref_source_lang === "")
                            detectedLang = result[1] ? result[1] : "?";
                        else
                            detectedLang = this.pref_source_lang;

                        // Do not save history if the source text is equal to the translated text.
                        if (aSourceText !== transText) {
                            this.setTransHistory(
                                aSourceText, {
                                    d: this._getTimeStamp(new Date().getTime()),
                                    sL: detectedLang,
                                    tL: targetLang,
                                    tT: transText
                                }
                            );
                        }

                        this._displayPopup(
                            detectedLang,
                            targetLang,
                            aSourceText,
                            transText
                        );
                    } catch (aErr) {
                        this._notifyParseError("Google Translator");
                        global.logError(aErr);
                    }
                }));
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    on_applet_clicked: function() {
        if (this.pref_all_dependencies_met) {
            let ctrlKey = (Clutter.ModifierType.CONTROL_MASK & global.get_pointer()[2]) !== 0;
            this.translate(ctrlKey);
        } else {
            this.informAboutMissingDependencies();
        }
    },

    _updateKeybindings: function() {
        Main.keybindingManager.addHotKey(
            "popup_translator_translate_key-" + this._instance_id,
            this.pref_translate_key,
            Lang.bind(this, function() {
                this.translate(false);
            })
        );
        Main.keybindingManager.addHotKey(
            "popup_translator_force_translate_key-" + this._instance_id,
            this.pref_force_translate_key,
            Lang.bind(this, function() {
                this.translate(true);
            })
        );
    },

    _notifyParseError: function(aProvider) {
        Main.criticalNotify(_(this.metadata.name),
            _("Error parsing %s's request.").format(aProvider) + "\n" +
            _("A detailed error has been logged into ~/.cinnamon/glass.log file."));
    },

    _getTimeStamp: function(aDate) {
        let ts;
        switch (this.pref_history_timestamp) {
            case 0:
                ts = this.pref_history_timestamp_custom; // Custom
                break;
            case 1:
                ts = "YYYY MM-DD hh.mm.ss"; // ISO8601
                break;
            case 2:
                ts = "YYYY DD.MM hh.mm.ss"; // European
                break;
        }
        let dte = new Date(parseInt(aDate));
        let YYYY = String(dte.getFullYear());
        let MM = String(dte.getMonth() + 1);
        if (MM.length === 1) {
            MM = "0" + MM;
        }

        let DD = String(dte.getDate());
        if (DD.length === 1)
            DD = "0" + DD;

        let hh = String(dte.getHours());
        if (hh.length === 1)
            hh = "0" + hh;

        let mm = String(dte.getMinutes());
        if (mm.length === 1)
            mm = "0" + mm;

        let ss = String(dte.getSeconds());
        if (ss.length === 1)
            ss = "0" + ss;

        ts = ts.replace("YYYY", YYYY);
        ts = ts.replace("MM", MM);
        ts = ts.replace("DD", DD);
        ts = ts.replace("hh", hh);
        ts = ts.replace("mm", mm);
        ts = ts.replace("ss", ss);
        return ts;
    },

    providerData: {
        google: {
            name: "Google Translate",
            websiteURL: "https://translate.google.com/",
            websiteURI: "https://translate.google.com/?source=gtx_c#auto/%s/%s"
        },
        yandex: {
            name: "Yandex Translate",
            websiteURL: "http://translate.yandex.com/",
            websiteURI: "http://translate.yandex.com/?lang=%s&text=%s"
        }
    },

    ensureHistoryFileExists: function() {
        let configPath = [GLib.get_home_dir(), ".cinnamon", "configs", this.metadata.uuid + "History"].join("/");
        let configDir = Gio.file_new_for_path(configPath);

        if (!configDir.query_exists(null))
            configDir.make_directory_with_parents(null);

        this.historyFile = configDir.get_child("translation_history.json");

        let data,
            forceSaving;

        try {
            if (this.historyFile.query_exists(null)) {
                forceSaving = false;
                data = JSON.parse(Cinnamon.get_file_contents_utf8_sync(this.historyFile.get_path()));
            } else {
                forceSaving = true;
                data = {};
            }
        } finally {
            this._translation_history = data;

            if (forceSaving)
                this.saveHistoryToFile();
        }
    },

    saveHistoryToFile: function() {
        // Do not save the history with indentations. It's not needed.
        let rawData = JSON.stringify(this._translation_history);
        let raw = this.historyFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let out_file = Gio.BufferedOutputStream.new_sized(raw, 4096);
        Cinnamon.write_string_to_stream(out_file, rawData);
        out_file.close(null);
    },

    informAboutMissingDependencies: function() {
        Main.criticalNotify(_(this.metadata.name),
            _("Unmet dependencies found!!!") + "\n" +
            _("A detailed error has been logged into ~/.cinnamon/glass.log file."));
    },

    checkDependencies: function() {
        Util.spawn_async([
                "python3",
                this.main_applet_dir + "/appletHelper.py",
                "check-dependencies"
            ],
            Lang.bind(this, function(aResponse) {
                let res = (aResponse.split("<!--SEPARATOR-->")[1])
                    // Preserve line breaks.
                    .replace(/\n+/g, "<br>")
                    .replace(/\s+/g, " ")
                    .replace(/<br>/g, "\n");
                res = res.trim();

                if (res.length > 1) {
                    global.logError(
                        "\n# [" + _("Popup Translator") + "]" + "\n" +
                        "# " + _("Unmet dependencies found!!!") + "\n" +
                        res + "\n" +
                        "# " + _("Check this applet HELP.md file for instructions.") + "\n" +
                        "# " + _("It can be accessed from this applet context menu.")
                    );
                    this.informAboutMissingDependencies();
                    this.pref_all_dependencies_met = false;
                } else {
                    this.pref_all_dependencies_met = true;
                }
            }));
    },

    openTranslationHistory: function() {
        try {
            Util.spawn([
                "python3",
                this.main_applet_dir + "/appletHelper.py",
                "history",
                this.pref_history_initial_window_width + "," +
                this.pref_history_initial_window_height + "," +
                this.pref_history_width_to_trigger_word_wrap
            ]);
            this.menu.close(true);
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    get transHistory() {
        return this._translation_history;
    },

    setTransHistory: function(aSourceText, aTransObj) {
        this._translation_history[aSourceText] = aTransObj;
        this.saveHistoryToFile();
    },

    get selection() {
        let str = "";
        try {
            let process = new $.ShellOutputProcess(["xsel", "-o"]);
            // Remove possible "ilegal" characters.
            str = process.spawn_sync_and_get_output().replace(/[\"'<>]/g, "");
            // Replace line breaks and duplicated white spaces with a single space.
            str = (str.replace(/\s+/g, " ")).trim();
        } catch (aErr) {
            global.logError(aErr);
        } finally {
            return str;
        }
    },

    get service_provider() {
        return this.pref_service_provider;
    }
};

function main(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    return new MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id);
}
