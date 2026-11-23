#!/usr/bin/env python3
# -*- coding: utf-8 -*-
##########################################################
##                       Clockoo                        ##
##            Interface strings (EN, IT, DE)            ##
##                 written in Python 3                  ##
##                          🌞                          ##
##       by FranzBias 2026 · github.com/FranzBias       ##
##            Licensed under the MIT License            ##
##          See LICENSE file for full license.          ##
##########################################################
# SPDX-License-Identifier: MIT
"""
clockoo_i18n.py — interface strings of Clockoo 🕰️

Why this file exists: Franz speaks Italian and German, the code speaks
English. Every visible string lives here, keyed by its English text;
missing translations fall back to English, so adding a language never
breaks the app.

by Franz & Aldus
"""

import gettext
import locale
import os

LANGS = ("en", "it", "de")

# Inside the Cinnamon applet, Cinnamon compiles the applet's po/ files into
# ~/.local/share/locale: those translations (maybe more languages than
# ours) win, the table below is the fallback.
APPLET_UUID = "clockoo@FranzBias"
_gettext = None

_T = {
    "it": {
        "Cuckoo": "Cucù",
        "Alarms": "Sveglie",
        "Hourly cuckoo": "Cucù orario",
        "Hours": "Ore",
        "Minute": "Minuto",
        "Sound": "Suono",
        "Call as many times as the hour": "Chiama tante volte quante sono le ore",
        "All": "Tutte",
        "None": "Nessuna",
        "Day": "Giorno",
        "Play": "Prova",
        "New alarm": "Nuova sveglia",
        "Edit alarm": "Modifica sveglia",
        "Name": "Nome",
        "Time": "Ora",
        "Days": "Giorni",
        "No day = rings once": "Nessun giorno = suona una volta sola",
        "Text to read aloud (optional)": "Testo da leggere ad alta voce (facoltativo)",
        "Voice": "Voce",
        "Try voice": "Prova voce",
        "Repeat": "Ripeti",
        "times": "volte",
        "Cancel": "Annulla",
        "Save": "Salva",
        "Delete": "Elimina",
        "Delete alarm «%s»?": "Eliminare la sveglia «%s»?",
        "No alarms yet.": "Ancora nessuna sveglia.",
        "Once": "Una volta",
        "Every day": "Ogni giorno",
        "Weekdays": "Lun–Ven",
        "Weekend": "Sab–Dom",
        "Next alarm: %s": "Prossima sveglia: %s",
        "No alarm set": "Nessuna sveglia attiva",
        "Open Clockoo": "Apri Clockoo",
        "Quit": "Esci",
        "Stop": "Stop",
        "Snooze %d min": "Posticipa %d min",
        "Snoozed until %s": "Posticipata alle %s",
        "Invalid time": "Ora non valida",
        "Alarm": "Sveglia",
        "systemd reported a problem": "systemd ha segnalato un problema",
        "No voices found in %s": "Nessuna voce trovata in %s",
        "Interface language": "Lingua dell'interfaccia",
        "Automatic": "Automatica",
        "Mon": "Lun", "Tue": "Mar", "Wed": "Mer", "Thu": "Gio",
        "Fri": "Ven", "Sat": "Sab", "Sun": "Dom",
        "today": "oggi", "tomorrow": "domani",
        "Timer": "Timer",
        "Timer finished": "Timer scaduto",
        "Quick start": "Avvio rapido",
        "Custom": "Personalizzato",
        "Custom…": "Personalizzato…",
        "%d min": "%d min",
        "Start": "Avvia",
        "Running timers": "Timer in corso",
        "No timer running.": "Nessun timer in corso.",
        "ends at %s": "finisce alle %s",
        "Could not start the timer": "Impossibile avviare il timer",
        "Sounds folder": "Cartella dei suoni",
        "Use the bundled sounds": "Usa i suoni inclusi",
        "Text to read (optional)": "Testo da leggere (facoltativo)",
        "Save this timer for later": "Salva questo timer per dopo",
        "Saved timers": "Timer salvati",
        "By duration": "Per durata",
        "By name": "Per nome",
        "Sort the saved timers": "Ordina i timer salvati",
        "No saved timers. Set one above and press 💾.": "Nessun timer salvato. Impostane uno qui sopra e premi 💾.",
        "Move up": "Sposta su",
        "Move down": "Sposta giù",
        "Delete saved timer «%s»?": "Eliminare il timer salvato «%s»?",
        "Icon": "Icona",
        "Follow the theme": "Segui il tema",
        "Wood (light themes)": "Legno (temi chiari)",
        "Brass (dark themes)": "Ottone (temi scuri)",
        "Crescendo: the volume grows from soft to full": "Crescendo: il volume cresce da piano a pieno",
        "Warn me before": "Avvisami prima",
        "minutes": "minuti",
        "Quiet night from": "Notte silenziosa dalle",
        "to": "alle",
        "Stopwatch": "Cronometro",
        "Lap": "Giro",
        "Reset": "Azzera",
        "Pause": "Pausa",
        "No laps yet.": "Ancora nessun giro.",
        "In %d min": "Tra %d min",
        "Alarm at %s": "Sveglia alle %s",
        "Snooze": "Posticipo",
        "min (0 = general setting: %d)": "min (0 = impostazione generale: %d)",
        "Pomodoro": "Pomodoro",
        "Work": "Lavoro",
        "Break": "Pausa",
        "Long break": "Pausa lunga",
        "Long break every": "Pausa lunga ogni",
        "works": "lavori",
        "Works in all": "Lavori in tutto",
        "(0 = no end)": "(0 = senza fine)",
        "Start pomodoro": "Avvia pomodoro",
        "min": "min",
        "Now: %s, %s": "Ora: %s, %s",
        "Pomodoro finished": "Pomodoro finito",
        "Stop pomodoro": "Ferma pomodoro",
        "Today": "Oggi",
        "This week": "Questa settimana",
        "Resume": "Riprendi",
        "paused": "in pausa",
    },
    "de": {
        "Cuckoo": "Kuckuck",
        "Alarms": "Wecker",
        "Hourly cuckoo": "Stündlicher Kuckuck",
        "Hours": "Stunden",
        "Minute": "Minute",
        "Sound": "Klang",
        "Call as many times as the hour": "So oft rufen, wie es Uhr ist",
        "All": "Alle",
        "None": "Keine",
        "Day": "Tag",
        "Play": "Anhören",
        "New alarm": "Neuer Wecker",
        "Edit alarm": "Wecker bearbeiten",
        "Name": "Name",
        "Time": "Uhrzeit",
        "Days": "Tage",
        "No day = rings once": "Kein Tag = klingelt einmal",
        "Text to read aloud (optional)": "Vorzulesender Text (optional)",
        "Voice": "Stimme",
        "Try voice": "Stimme testen",
        "Repeat": "Wiederholen",
        "times": "mal",
        "Cancel": "Abbrechen",
        "Save": "Speichern",
        "Delete": "Löschen",
        "Delete alarm «%s»?": "Wecker «%s» löschen?",
        "No alarms yet.": "Noch keine Wecker.",
        "Once": "Einmal",
        "Every day": "Täglich",
        "Weekdays": "Mo–Fr",
        "Weekend": "Sa–So",
        "Next alarm: %s": "Nächster Wecker: %s",
        "No alarm set": "Kein Wecker aktiv",
        "Open Clockoo": "Clockoo öffnen",
        "Quit": "Beenden",
        "Stop": "Stopp",
        "Snooze %d min": "Schlummern %d Min.",
        "Snoozed until %s": "Geschlummert bis %s",
        "Invalid time": "Ungültige Uhrzeit",
        "Alarm": "Wecker",
        "systemd reported a problem": "systemd hat ein Problem gemeldet",
        "No voices found in %s": "Keine Stimmen in %s gefunden",
        "Interface language": "Sprache der Oberfläche",
        "Automatic": "Automatisch",
        "Mon": "Mo", "Tue": "Di", "Wed": "Mi", "Thu": "Do",
        "Fri": "Fr", "Sat": "Sa", "Sun": "So",
        "today": "heute", "tomorrow": "morgen",
        "Timer": "Timer",
        "Timer finished": "Timer abgelaufen",
        "Quick start": "Schnellstart",
        "Custom": "Eigene Dauer",
        "Custom…": "Eigene Dauer…",
        "%d min": "%d Min.",
        "Start": "Starten",
        "Running timers": "Laufende Timer",
        "No timer running.": "Kein Timer aktiv.",
        "ends at %s": "endet um %s",
        "Could not start the timer": "Timer konnte nicht gestartet werden",
        "Sounds folder": "Klangordner",
        "Use the bundled sounds": "Mitgelieferte Klänge verwenden",
        "Text to read (optional)": "Vorzulesender Text (optional)",
        "Save this timer for later": "Diesen Timer für später speichern",
        "Saved timers": "Gespeicherte Timer",
        "By duration": "Nach Dauer",
        "By name": "Nach Name",
        "Sort the saved timers": "Gespeicherte Timer sortieren",
        "No saved timers. Set one above and press 💾.": "Keine gespeicherten Timer. Oben einstellen und 💾 drücken.",
        "Move up": "Nach oben",
        "Move down": "Nach unten",
        "Delete saved timer «%s»?": "Gespeicherten Timer «%s» löschen?",
        "Icon": "Symbol",
        "Follow the theme": "Dem Thema folgen",
        "Wood (light themes)": "Holz (helle Themen)",
        "Brass (dark themes)": "Messing (dunkle Themen)",
        "Crescendo: the volume grows from soft to full": "Crescendo: die Lautstärke steigt von leise bis voll",
        "Warn me before": "Vorher erinnern",
        "minutes": "Minuten",
        "Quiet night from": "Ruhige Nacht von",
        "to": "bis",
        "Stopwatch": "Stoppuhr",
        "Lap": "Runde",
        "Reset": "Zurücksetzen",
        "Pause": "Pause",
        "No laps yet.": "Noch keine Runden.",
        "In %d min": "In %d Min.",
        "Alarm at %s": "Wecker um %s",
        "Snooze": "Schlummern",
        "min (0 = general setting: %d)": "Min. (0 = allgemeine Einstellung: %d)",
        "Pomodoro": "Pomodoro",
        "Work": "Arbeit",
        "Break": "Pause",
        "Long break": "Lange Pause",
        "Long break every": "Lange Pause nach",
        "works": "Arbeitsphasen",
        "Works in all": "Arbeitsphasen insgesamt",
        "(0 = no end)": "(0 = ohne Ende)",
        "Start pomodoro": "Pomodoro starten",
        "min": "Min.",
        "Now: %s, %s": "Jetzt: %s, %s",
        "Pomodoro finished": "Pomodoro beendet",
        "Stop pomodoro": "Pomodoro beenden",
        "Today": "Heute",
        "This week": "Diese Woche",
        "Resume": "Fortsetzen",
        "paused": "pausiert",
    },
}

_current = "en"


def system_lang():
    for var in ("LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"):
        value = os.environ.get(var, "")
        if value:
            code = value.split(":")[0][:2].lower()
            if code in LANGS:
                return code
    try:
        code = (locale.getlocale()[0] or "")[:2].lower()
    except ValueError:
        code = ""
    return code if code in LANGS else "en"


def set_lang(code):
    """code: 'auto' or one of LANGS."""
    global _current, _gettext
    auto = code in (None, "", "auto")
    _current = system_lang() if auto else (code if code in LANGS else "en")
    _gettext = None
    if os.environ.get("CLOCKOO_PROFILE") == "applet":
        _gettext = gettext.translation(
            APPLET_UUID, os.path.expanduser("~/.local/share/locale"),
            languages=None if auto else [_current], fallback=True).gettext
    return _current


def current():
    return _current


def _(text):
    if _gettext:
        translated = _gettext(text)
        if translated != text:
            return translated
    return _T.get(_current, {}).get(text, text)
