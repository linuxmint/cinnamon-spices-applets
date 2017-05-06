const appletUUID = "0dyseus@PopupTranslator";
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Pango = imports.gi.Pango;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Tooltips = imports.ui.tooltips;
const Cinnamon = imports.gi.Cinnamon;
const Gettext = imports.gettext;

Gettext.bindtextdomain(appletUUID, GLib.get_home_dir() + "/.local/share/locale");

function _(aStr) {
    let customTrans = Gettext.dgettext(appletUUID, aStr);

    if (customTrans !== aStr)
        return customTrans;

    return Gettext.gettext(aStr);
}

function convertHistoryZeroToOne(aData) {
    let newData = {};
    try {
        for (let srcTxt in aData) {
            if (aData.hasOwnProperty(srcTxt)) {
                newData[aData[srcTxt]["tL"]] = newData[aData[srcTxt]["tL"]] || {};
                newData[aData[srcTxt]["tL"]][srcTxt] = aData[srcTxt];
            }
        }
    } catch (aErr) {
        global.logError(aErr);
    } finally {
        return newData;
    }
}

const OrnamentType = {
    NONE: 0,
    CHECK: 1,
    DOT: 2,
    ICON: 3
};

const langs = {
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
};

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
        // Dynamically set when popup is shown.
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
            icon_name: "popup-translator-edit-copy",
            icon_type: St.IconType.SYMBOLIC,
            style_class: "popup-menu-icon"
        });
        this.button1 = new St.Button({
            child: icon1,
            style: "padding-right: 5px;"
        });

        let icon2 = new St.Icon({
            icon_size: 18,
            icon_name: "popup-translator-translate",
            icon_type: St.IconType.SYMBOLIC,
            style_class: "popup-menu-icon"
        });

        this.button2 = new St.Button({
            child: icon2,
            style: "padding-right: 5px;"
        });

        let icon3 = new St.Icon({
            icon_size: 18,
            icon_name: "popup-translator-document-open-recent",
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
        this.appsMenuButton.openTranslationHistory();
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

    _onButtonEnterEvent: function(aE, aButton) { // jshint ignore:line
        global.set_cursor(Cinnamon.Cursor.POINTING_HAND);
        return false;
    },

    _onButtonLeaveEvent: function(aE, aButton) { // jshint ignore:line
        global.unset_cursor();
    },

    closeMenu: function(aE, aButton) { // jshint ignore:line
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

/*
exported convertHistoryZeroToOne,
         langs,
         OrnamentType
 */
