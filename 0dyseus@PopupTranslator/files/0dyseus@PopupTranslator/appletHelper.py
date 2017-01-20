#!/usr/bin/python3

try:
    import requests
except ImportError:
    raise ImportError('ImportError')

import os
import sys
import gettext
import json
from inspect import getsourcefile
from os.path import abspath
from pathlib import Path
from pkgutil import iter_modules

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk, Pango, Gdk

# i18n
gettext.install("cinnamon", "/usr/share/locale")

home = os.path.expanduser("~")
scriptPath = abspath(getsourcefile(lambda: 0))
appletDir = os.path.realpath(os.path.dirname(scriptPath))
appletUUID = str(os.path.basename(appletDir))

langList = {
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
    "zu": "Zulu (G)"
}

translations = {}


def trans(string):
    # check for a translation for this xlet
    if appletUUID not in translations:
        try:
            translations[appletUUID] = gettext.translation(appletUUID,
                                                           home + "/.local/share/locale").gettext
        except IOError:
            try:
                translations[appletUUID] = gettext.translation(appletUUID,
                                                               "/usr/share/locale").gettext
            except IOError:
                translations[appletUUID] = None

    # do not translate whitespaces
    if not string.strip():
        return string

    if translations[appletUUID]:
        result = translations[appletUUID](string)

        try:
            result = result.decode("utf-8")
        except:
            result = result

        if result != string:
            return result
    return _(string)


class YandexTranslator:

    def __init__(self):
        self.headers = {
            "user-agent": "Mozilla/5.0",
            "Referer": "https://translate.yandex.net/",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        #                       URL         % (APIKey       langPair     text)
        self.req = requests.get(sys.argv[2] % (sys.argv[3], sys.argv[4], sys.argv[5]),
                                headers=self.headers, timeout=5)

    def translate(self):
        print(self.req.text)


class GoogleTranslator:

    def __init__(self):
        self.headers = {
            "user-agent": "Mozilla/5.0",
            "Referer": "https://translate.google.com/",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        #                       URL         + text
        self.req = requests.get(sys.argv[2] + sys.argv[3], headers=self.headers, timeout=5)

    def translate(self):
        if self.req.status_code == requests.codes.ok:
            print(self.req.text)
        else:
            print("self.req.status_code: %s") % self.req.status_code


class HistoryWindow():

    def __init__(self):
        gladefile = os.path.join(appletDir, "assets", "history.ui")
        [initial_window_width, initial_window_height,
            width_to_trigger_word_wrap] = sys.argv[2].split(",")

        # The following crap is done so I can set a custom width/height for the window. ¬¬
        file_content = str(Path(gladefile).read_text()).replace(
            "<default_width>", initial_window_width)
        file_content = file_content.replace("<default_height>", initial_window_height)

        builder = Gtk.Builder()
        builder.add_from_string(file_content)
        self.window = builder.get_object("main_window")
        self.window.set_icon_from_file(os.path.join(appletDir, "icon.png"))
        self.window.set_title(trans("Popup Translator history"))
        self.window.connect("destroy", self.quit_window)

        self.treeview = builder.get_object("treeview_history")

        column1 = Gtk.TreeViewColumn(trans("Date"), Gtk.CellRendererText(), text=1)
        column1.set_sort_column_id(1)
        column1.set_resizable(True)

        cr2 = Gtk.CellRendererText()
        cr2.set_property('wrap-mode', Pango.WrapMode.WORD_CHAR)
        cr2.set_property('wrap-width', int(width_to_trigger_word_wrap))
        cr2.set_property('editable', True)
        column2 = Gtk.TreeViewColumn(trans("Source text"), cr2, text=0)
        column2.set_sort_column_id(0)
        column2.set_resizable(True)

        cr3 = Gtk.CellRendererText()
        column3 = Gtk.TreeViewColumn(trans("Language Pair"), cr3, markup=2)
        column3.set_sort_column_id(2)
        column3.set_resizable(True)

        cr4 = Gtk.CellRendererText()
        cr4.set_property('wrap-mode', Pango.WrapMode.WORD_CHAR)
        cr4.set_property('wrap-width', int(width_to_trigger_word_wrap))
        cr4.set_property('editable', True)
        column4 = Gtk.TreeViewColumn(trans("Target text"), cr4, text=3)
        column4.set_sort_column_id(3)
        column4.set_resizable(True)

        self.treeview.append_column(column1)
        self.treeview.append_column(column2)
        self.treeview.append_column(column3)
        self.treeview.append_column(column4)

        self.treeview.set_headers_clickable(True)
        self.treeview.set_reorderable(False)
        self.treeview.set_search_column(0)
        self.treeview.set_enable_search(True)

        self.treeview.show()

        self.populate(self)

        close_button = builder.get_object("button_close")
        close_button.connect("clicked", self.quit_window)

        reload_button = builder.get_object("button_reload")
        reload_button.set_label(trans("Reload"))
        reload_button.set_tooltip_text(trans("Reload translation history"))
        reload_button.connect("clicked", self.populate)
        img_path = os.path.join(appletDir, "icons", "popup-translator-document-open-recent-symbolic.svg")
        img_file = Gio.File.new_for_path(img_path)
        img_file_icon = Gio.FileIcon.new(img_file)
        img = Gtk.Image.new_from_gicon(img_file_icon, Gtk.IconSize.BUTTON)
        reload_button.set_image(img)

    def quit_window(self, widget):
        self.window.destroy()
        Gtk.main_quit()

    def populate(self, widget):
        model = Gtk.TreeStore(str, str, str, str)
        path = os.path.join(
            home, ".cinnamon", "configs", appletUUID + "History", "translation_history.json")
        if (os.path.exists(path)):
            data = metadata = open(path, 'r').read()
            transList = json.loads(data)

            for entry in transList:
                try:
                    sourceLang = langList[transList[entry]["sL"]]
                except:
                    sourceLang = langList["?"]

                try:
                    targetLang = langList[transList[entry]["tL"]]
                except:
                    targetLang = langList["?"]

                iter = model.insert_before(None, None)
                model.set_value(iter, 0, entry)
                model.row_changed(model.get_path(iter), iter)
                model.set_value(iter, 1, "%s" % (transList[entry]["d"]))
                model.set_value(iter, 2, "<b>%s > %s</b>" % (sourceLang, targetLang))
                model.set_value(iter, 3, transList[entry]["tT"])

        model.set_sort_column_id(1, Gtk.SortType.DESCENDING)
        self.treeview.set_model(model)
        del model


def module_exists(module_name):
    return module_name in (name for loader, name, ispkg in iter_modules())


def main():
    arg = sys.argv[1]

    if arg == "google":
        GoogleTranslator().translate()
    elif arg == "yandex":
        YandexTranslator().translate()
    elif arg == "history":
        import signal

        win = HistoryWindow()
        signal.signal(signal.SIGINT, win.quit_window)
        Gtk.main()
    elif arg == "check-dependencies":
        import subprocess

        msg = "<!--SEPARATOR-->"

        try:
            subprocess.check_call(["xsel", "--version"])
        except OSError:
            msg += "# xsel command not found!!!\n"

        try:
            subprocess.check_call(["xdg-open", "--version"])
        except OSError:
            msg += "# xdg-open command not found!!!\n"

        if not module_exists("requests"):
            msg += "# requests Python module not found!!!\n"

        print(msg)

if __name__ == "__main__":
    main()
