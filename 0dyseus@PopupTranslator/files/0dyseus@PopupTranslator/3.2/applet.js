const appletUUID = "0dyseus@PopupTranslator";
const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const Pango = imports.gi.Pango;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const Main = imports.ui.main;
const Tooltips = imports.ui.tooltips;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;

// For translation mechanism.
// Comments that start with // NOTE: are to be extracted by xgettext
// and are directed to translators only.
function _(aStr) {
    let customTrans = Gettext.dgettext(appletUUID, aStr);

    if (customTrans !== aStr)
        return customTrans;

    return Gettext.gettext(aStr);
}

function TranslationMenuItem(appsMenuButton) {
    this._init(appsMenuButton);
}

TranslationMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false,
            focusOnHover: false
        });

        this.appsMenuButton = appsMenuButton;
        // Dinamically set when popup is shown.
        this._sourceText = "";
        this._providerURI = "";
        this._providerURL = "";

        let table = new St.BoxLayout({
            vertical: true
        });
        table.set_style("min-width: 30em; max-width: 30em;");

        this.languagePair = new St.Label({
            text: "",
            style: this.appsMenuButton.pref_style_for_language_pair
        });
        this.languagePair.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE;

        table.add(this.languagePair, {
            x_align: St.Align.START
        });

        this.translatedText = new St.Label({
            text: "",
            style: this.appsMenuButton.pref_style_for_translated_text
        });

        this.translatedText.get_clutter_text().set_line_wrap(true);
        this.translatedText.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this.translatedText.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE;

        table.add(this.translatedText, {
            x_align: St.Align.START
        });

        let toolbar = new St.BoxLayout({
            vertical: false
        });

        let icon1 = new St.Icon({
            icon_size: 18,
            icon_name: "custom-edit-copy",
            icon_type: St.IconType.SYMBOLIC,
            style_class: "popup-menu-icon"
        });
        this.button1 = new St.Button({
            child: icon1,
            style: "padding-right: 5px;"
        });

        let icon2 = new St.Icon({
            icon_size: 18,
            icon_name: "custom-translate",
            icon_type: St.IconType.SYMBOLIC,
            style_class: "popup-menu-icon"
        });

        this.button2 = new St.Button({
            child: icon2,
            style: "padding-right: 5px;"
        });

        let icon3 = new St.Icon({
            icon_size: 18,
            icon_name: "custom-document-open-recent",
            icon_type: St.IconType.SYMBOLIC,
            style_class: "popup-menu-icon"
        });

        this.button3 = new St.Button({
            child: icon3,
            style: "padding-right: 5px;"
        });

        this.footerLabel = new St.Label({
            text: "",
            style: this.appsMenuButton.pref_style_for_footer
        });
        this.footerButton = new St.Button({
            child: this.footerLabel
        });

        this._addConnectionsAndTooltipToButton(
            "button1",
            _("Copy translated text to clipboard"),
            "_copyToClipboard"
        );

        this._addConnectionsAndTooltipToButton(
            "button2",
            _("Translate text on provider's website"),
            "_translateOnProviderWebsite"
        );

        this._addConnectionsAndTooltipToButton(
            "button3",
            _("Open translation history"),
            "_openTranslationHistory"
        );

        this._addConnectionsAndTooltipToButton(
            "footerButton",
            "", // Dinamically set when popup is shown.
            "_openProviderWebsite"
        );

        toolbar.add(this.button1, {
            x_align: St.Align.START,
            x_fill: false
        });

        toolbar.add(this.button2, {
            x_align: St.Align.START,
            x_fill: false
        });

        toolbar.add(this.button3, {
            x_align: St.Align.START,
            x_fill: false
        });

        // Spacer
        toolbar.add(new St.BoxLayout(), {
            expand: true,
            x_fill: true
        });

        toolbar.add(this.footerButton, {
            x_align: St.Align.END,
            x_fill: false
        });

        table.add(toolbar, {
            x_fill: true,
            y_fill: true,
            expand: true,
            y_align: St.Align.MIDDLE,
            x_align: St.Align.START
        });

        this.addActor(table, {
            expand: true,
            span: 1,
            align: St.Align.START
        });
    },

    _copyToClipboard: function() {
        let text = this.translatedText.get_text();
        St.Clipboard.get_default().set_text(text);
        this.closeMenu();
    },

    _openTranslationHistory: function() {
        try {
            Util.spawn([
                "python3",
                this.appsMenuButton.main_applet_dir + "/appletHelper.py",
                "history",
                this.appsMenuButton.pref_history_initial_window_width + "," +
                this.appsMenuButton.pref_history_initial_window_height + "," +
                this.appsMenuButton.pref_history_width_to_trigger_word_wrap
            ]);
            this.closeMenu();
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    _translateOnProviderWebsite: function() {
        Util.spawn(['gvfs-open', this.providerURI]);
        this.closeMenu();
    },

    _openProviderWebsite: function() {
        Util.spawn(['gvfs-open', this.providerURL]);
        this.closeMenu();
    },

    _addConnectionsAndTooltipToButton: function(aButton, aSourceText, aCallback) {
        this[aButton].connect("clicked", Lang.bind(this, this[aCallback]));
        this[aButton].connect("enter-event", Lang.bind(this, this._onButtonEnterEvent, aButton));
        this[aButton].connect("leave-event", Lang.bind(this, this._onButtonLeaveEvent, aButton));
        this[aButton].tooltip = new Tooltips.Tooltip(this[aButton], aSourceText);
        // Ensure tooltip is destroyed when this button is destroyed
        this[aButton].connect("destroy", Lang.bind(this, function() {
            this[aButton].tooltip.destroy();
        }));
    },

    _onButtonEnterEvent: function(aE, aButton) {
        global.set_cursor(Cinnamon.Cursor.POINTING_HAND);
        return false;
    },

    _onButtonLeaveEvent: function(aE, aButton) {
        global.unset_cursor();
    },

    closeMenu: function(aE, aButton) {
        this.appsMenuButton.menu.close(true);
    },

    set sourceText(aText) {
        this._sourceText = aText;
    },

    get sourceText() {
        return this._sourceText;
    },

    set providerURI(aURI) {
        this._providerURI = aURI;
    },

    get providerURI() {
        return this._providerURI;
    },

    set providerURL(aURL) {
        this._providerURL = aURL;
    },

    get providerURL() {
        return this._providerURL;
    }
};

function MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    this._init(aMetadata, aOrientation, aPanel_height, aInstance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(aMetadata, aOrientation, aPanel_height, aInstance_id) {
        Applet.TextIconApplet.prototype._init.call(this, aOrientation, aPanel_height, aInstance_id);

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

            // Gtk.IconTheme.get_default().append_search_path(this.main_applet_dir + "/icons/");
            Gettext.bindtextdomain(this.metadata.uuid, GLib.get_home_dir() + "/.local/share/locale");

            this.settings = new Settings.AppletSettings(this, aMetadata.uuid, aInstance_id);
            this._bindSettings();

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._buildMenu();

            this.forceTranslation = false;
            this.detectedLang = "";

            this._updateIconAndLabel();
            this.set_applet_tooltip(_(aMetadata.name));
            this._expand_applet_context_menu();
            this.ensureHistoryFileExists();
        } catch (aErr) {
            global.logError(aErr);
        }

    },

    _expand_applet_context_menu: function() {
        let menuItem = new PopupMenu.PopupIconMenuItem(
            _("Open translation history"),
            "custom-document-open-recent",
            St.IconType.SYMBOLIC);
        menuItem.connect("activate", Lang.bind(this, function() {
            try {
                Util.spawn([
                    "python3",
                    this.main_applet_dir + "/appletHelper.py",
                    "history",
                    this.pref_history_initial_window_width + "," +
                    this.pref_history_initial_window_height + "," +
                    this.pref_history_width_to_trigger_word_wrap
                ]);
            } catch (aErr) {
                global.logError(aErr);
            }
        }));
        this._applet_context_menu.addMenuItem(menuItem);

        menuItem = new PopupMenu.PopupIconMenuItem(_("Help"),
            "dialog-information", St.IconType.SYMBOLIC);
        menuItem.connect("activate", Lang.bind(this, function() {
            Util.spawn(["xdg-open", this.main_applet_dir + "/HELP.md"]);
        }));
        this._applet_context_menu.addMenuItem(menuItem);
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

        // this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));

        this._updateIconAndLabel();
    },

    _buildMenu: function() {
        try {
            if (this.menu) {
                this.menuManager.removeMenu(this.menu);
                this.menu.destroy();
            }

            this.menu = new Applet.AppletPopupMenu(this, this.orientation);
            this.menu._transTable = new TranslationMenuItem(this);
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
                m.providerURL = this.providerData[this.pref_service_provider].websiteURL;
                m.providerURI = (this.providerData[this.pref_service_provider].websiteURI)
                    .format(aTargetLang, encodeURIComponent(aSourceText));
                m.languagePair.set_text(this.langs[aDetectedLang] + " > " + this.langs[aTargetLang]);
                m.translatedText.set_text(aTranslatedText);
                m.footerButton.tooltip._tooltip.set_text(_("Go to %s's website")
                    .format(this.providerData[this.pref_service_provider].name));
                m.footerLabel.set_text(("Powered By %s")
                    .format(this.providerData[this.pref_service_provider].name));
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
            [bD.IN, "pref_service_provider", null],
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

        switch (this.pref_service_provider) {
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
            let langPair = (this.pref_source_lang === "") ?
                this.pref_target_lang :
                this.pref_source_lang + "-" + this.pref_target_lang;
            let APIKeys = this.pref_yandex_api_keys.split("\n").filter(function(aKey) { // Filter possible empty elements.
                if (aKey !== "")
                    return true;
            });
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
                                transText = (result.text[0]).trim();

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
                                    langPair,
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
        let ctrlKey = (Clutter.ModifierType.CONTROL_MASK & global.get_pointer()[2]) !== 0;
        this.translate(ctrlKey);
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
        Main.warningNotify(_(this.metadata.name),
            _("Error parsing %s's request.").format(aProvider) + "\n" +
            _("A detailed error has been logged into ~/.cinnamon/glass.log file."));
    },

    langs: {
        "?": "Unknown",
        "": "Auto",
        "af": "Afrikaans (G)",
        "sq": "Albanian",
        "am": "Amharic",
        "ar": "Arabic",
        "hy": "Armenian",
        "az": "Azerbaijani",
        "eu": "Basque (G)",
        "be": "Belarusian",
        "bn": "Bengali (G)",
        "bs": "Bosnian (Y)",
        "bg": "Bulgarian",
        "ca": "Catalan",
        "ny": "Cebuano",
        "ceb": "Chichewa",
        "zh": "Chinese (Y)",
        "zh-CN": "Chinese (G)",
        "co": "Corsican",
        "hr": "Croatian",
        "cs": "Czech",
        "da": "Danish",
        "nl": "Dutch",
        "en": "English",
        "eo": "Esperanto (G)",
        "et": "Estonian",
        "tl": "Filipino (G)",
        "fi": "Finnish",
        "fr": "French",
        "fy": "Frisian (G)",
        "gl": "Galician (G)",
        "ka": "Georgian",
        "de": "German",
        "el": "Greek",
        "gu": "Gujarati (G)",
        "ht": "Haitian Creole",
        "ha": "Hausa (G)",
        "haw": "Hawaiian (G)",
        "he": "Hebrew (Y)",
        "iw": "Hebrew (G)",
        "hi": "Hindi",
        "hmn": "Hmong",
        "hu": "Hungarian",
        "is": "Icelandic",
        "ig": "Igbo",
        "id": "Indonesian",
        "ga": "Irish (G)",
        "it": "Italian",
        "ja": "Japanese",
        "jw": "Javanese",
        "kn": "Kannada (G)",
        "kk": "Kazakh (G)",
        "km": "Khmer (G)",
        "ko": "Korean",
        "ku": "Kurdish (Kurmanji) (G)",
        "ky": "Kyrgyz (G)",
        "lo": "Lao (G)",
        "la": "Latin (G)",
        "lv": "Latvian",
        "lt": "Lithuanian",
        "lb": "Luxembourgish",
        "mk": "Macedonian",
        "mg": "Malagasy",
        "ms": "Malay",
        "ml": "Malayalam",
        "mt": "Maltese",
        "mi": "Maori (G)",
        "mr": "Marathi (G)",
        "mn": "Mongolian (G)",
        "my": "Myanmar (Burmese) (G)",
        "ne": "Nepali (G)",
        "no": "Norwegian",
        "ps": "Pashto",
        "fa": "Persian",
        "pl": "Polish",
        "pt": "Portuguese",
        "pa": "Punjabi (G)",
        "ro": "Romanian",
        "ru": "Russian",
        "sm": "Samoan (G)",
        "gd": "Scots Gaelic (G)",
        "sr": "Serbian",
        "st": "Sesotho (G)",
        "sn": "Shona (G)",
        "sd": "Sindhi (G)",
        "si": "Sinhala (G)",
        "sk": "Slovak",
        "sl": "Slovenian",
        "so": "Somali",
        "es": "Spanish",
        "su": "Sundanese (G)",
        "sw": "Swahili (G)",
        "sv": "Swedish",
        "tg": "Tajik (G)",
        "ta": "Tamil (G)",
        "te": "Telugu (G)",
        "th": "Thai",
        "tr": "Turkish",
        "uk": "Ukrainian",
        "ur": "Urdu",
        "uz": "Uzbek (G)",
        "vi": "Vietnamese",
        "cy": "Welsh",
        "xh": "Xhosa (G)",
        "yi": "Yiddish (G)",
        "yo": "Yoruba (G)",
        "zu": "Zulu (G)",
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
            let process = new ShellOutputProcess(["xsel", "-o"]);
            // Remove possible "ilegal" characters.
            str = process.spawn_sync_and_get_output().replace(/[\"'<>]/g, "");
            // Replace line breaks and duplicated white spaces with a single space.
            str = (str.replace(/\s+/g, " ")).trim();
        } catch (aErr) {
            global.logError(aErr);
        } finally {
            return str;
        }
    }
};

function main(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    return new MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id);
}

function ShellOutputProcess(command_argv) {
    this._init(command_argv);
}

ShellOutputProcess.prototype = {

    _init: function(command_argv) {
        this.command_argv = command_argv;
        this.flags = GLib.SpawnFlags.SEARCH_PATH;
        this.success = false;
        this.standard_output_content = "";
        this.standard_error_content = "";
        this.pid = -1;
        this.standard_input_file_descriptor = -1;
        this.standard_output_file_descriptor = -1;
        this.standard_error_file_descriptor = -1;
    },

    spawn_sync_and_get_output: function() {
        this.spawn_sync();
        let output = this.get_standard_output_content();
        return output;
    },

    spawn_sync: function() {
        let [success, standard_output_content, standard_error_content] = GLib.spawn_sync(
            null,
            this.command_argv,
            null,
            this.flags,
            null);
        this.success = success;
        this.standard_output_content = standard_output_content;
        this.standard_error_content = standard_error_content;
    },

    get_standard_output_content: function() {
        return this.standard_output_content.toString();
    },

    spawn_sync_and_get_error: function() {
        this.spawn_sync();
        let output = this.get_standard_error_content();
        return output;
    },

    get_standard_error_content: function() {
        return this.standard_error_content.toString();
    },

    spawn_async: function() {
        let [
            success,
            pid,
            standard_input_file_descriptor,
            standard_output_file_descriptor,
            standard_error_file_descriptor
        ] = GLib.spawn_async_with_pipes(
            null,
            this.command_argv,
            null,
            this.flags,
            null,
            null);

        this.success = success;
        this.pid = pid;
        this.standard_input_file_descriptor = standard_input_file_descriptor;
        this.standard_output_file_descriptor = standard_output_file_descriptor;
        this.standard_error_file_descriptor = standard_error_file_descriptor;
    },

};
