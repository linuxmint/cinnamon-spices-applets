/*
 * aVincePulse
 * Zentrale Definition der Messwerte
 *
 * Copyright (C) 2026 Angelo Vincenti - aVince Industrietechnik
 *
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License,
 * version 3, as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 *
 * Diese Datei enthält ausschließlich die Beschreibung der Messwerte.
 * Hardware-Erkennung und Messwerterfassung erfolgen getrennt.
 *
 * Das optionale Feld "symbol" führt ein Sinnbild getrennt von der
 * Beschriftung. Beides bleibt dadurch unabhängig: Die Beschriftung
 * kann übersetzt werden, ohne dass das Symbol mitgeführt oder dabei
 * verloren gehen kann.
 *
 * "symbolAnhebung" bestimmt, wie weit das Symbol angehoben wird,
 * damit es auf der Höhe der Großbuchstaben sitzt. Der Wert gehört
 * zum Zeichen, nicht zur Anzeige: Schriftzeichen haben
 * unterschiedliche Metriken und sitzen von Haus aus verschieden
 * hoch auf der Grundlinie. Mit derselben Anhebung für alle Zeichen
 * wirkt das eine richtig und das andere verrutscht.
 *
 * Der Wert wird mit der Schriftgröße multipliziert und bleibt
 * dadurch bei jeder Größe und Bildschirmauflösung im Verhältnis
 * gleich. Fehlt er, wird ein mittlerer Vorgabewert verwendet.
 */

/*
 * Uebersetzung (AP24).
 *
 * Die gettext-Domaene ist die UUID und damit in Applet und Desklet
 * verschieden. Dieses Modul muss aber in beiden bitgenau gleich
 * bleiben, also darf die UUID hier nicht stehen. Die Komponente
 * uebergibt deshalb ihre Uebersetzungsfunktion - dasselbe Muster wie
 * beim HardwareDetector seit AP08.
 *
 * Ohne gesetzten Uebersetzer bleibt der englische Ausgangstext
 * stehen. Das ist der richtige Rueckfall: lieber Englisch als leer.
 */
var uebersetzeMit = (text) => text;

function setzeUebersetzung(fn) {
    if (typeof fn === "function")
        uebersetzeMit = fn;
}

function _(text) {
    return uebersetzeMit(text);
}

/*
 * Fuellt %s in einer uebersetzten Vorlage (AP24).
 *
 * Meldungen werden als ganzer Satz uebersetzt, nicht in Stuecken:
 * "automatisch - %s nicht gefunden" statt "automatisch - " + name +
 * " nicht gefunden". Nur so kann eine andere Sprache die Wortstellung
 * aendern. Geschrieben wird stets fuelle(_("..."), wert), damit
 * xgettext die Vorlage findet.
 */
/*
 * Wandelt einen Wert aus der Einstellungsdatei in eine Zahl um.
 *
 * Number() allein genuegt nicht: Number(false), Number([]) und
 * Number(" ") ergeben jeweils 0 (Befund P8 aus AP25). Die
 * Einstellungsdatei ist von Hand bearbeitbar.
 */
function zahlOderNull(wert) {
    if (typeof wert === "number")
        return Number.isFinite(wert) ? wert : null;

    if (typeof wert !== "string" || wert.trim() === "")
        return null;

    const zahl = Number(wert);

    return Number.isFinite(zahl) ? zahl : null;
}

function fuelle(vorlage, ...werte) {
    let i = 0;
    return String(vorlage).replace(/%s/g, () => {
        const w = werte[i++];
        return (w === undefined || w === null) ? "" : String(w);
    });
}


var METRICS = {
    cpu_temp: {
        id: "cpu_temp",
        label: "CPU",
        type: "temperature",
        unit: "°C",
        defaultValue: "--"
    },

    cpu_load: {
        id: "cpu_load",
        label: "LOAD",
        type: "percentage",
        unit: "%",
        defaultValue: "--"
    },

    ram_load: {
        id: "ram_load",
        label: "RAM",
        type: "percentage",
        unit: "%",
        defaultValue: "--"
    },

    storage_temp: {
        id: "storage_temp",
        label: "SSD",
        type: "temperature",
        unit: "°C",
        defaultValue: "--"
    },

    storage_free: {
        id: "storage_free",
        label: "FREE",
        symbol: "⛁",
        symbolAnhebung: 30,
        type: "storage",
        unit: "GB",
        defaultValue: "--",
        dynamicUnit: true
    },

    fan_speed: {
        id: "fan_speed",
        label: "FAN",
        type: "rotation",
        unit: "rpm",
        defaultValue: "----"
    },

    battery_charge: {
        id: "battery_charge",
        label: "BATT",
        type: "percentage",
        unit: "%",
        defaultValue: "--"
    },

    psu_state: {
        id: "psu_state",
        label: "STATUS",
        type: "state",
        unit: "--",
        defaultValue: "PSU",
        dynamicUnit: true
    },

    net_down: {
        id: "net_down",
        label: "DOWN",
        type: "data_rate",
        unit: "KB/s",
        defaultValue: "0.0",
        dynamicUnit: true
    },

    net_up: {
        id: "net_up",
        label: "UP",
        type: "data_rate",
        unit: "KB/s",
        defaultValue: "0.0",
        dynamicUnit: true
    },

    // Die Pfeile sitzen von Haus aus auf Hoehe der Grossbuchstaben
    // und werden deshalb nicht angehoben. Als Symbol gefuehrt bleiben
    // sie auch bei einer eigenen Bezeichnung erhalten.
    speed_down: {
        id: "speed_down",
        label: "SPEED",
        symbol: "↓",
        symbolAnhebung: 0,
        type: "speedtest",
        unit: "MBit/s",
        defaultValue: "--"
    },

    speed_up: {
        id: "speed_up",
        label: "SPEED",
        symbol: "↑",
        symbolAnhebung: 0,
        type: "speedtest",
        unit: "MBit/s",
        defaultValue: "--"
    },

    ping: {
        id: "ping",
        label: "PING",
        type: "latency",
        unit: "ms",
        defaultValue: "--"
    },

    speed_age: {
        id: "speed_age",
        label: "LAST",
        symbol: "◷",
        symbolAnhebung: 110,
        type: "age",
        unit: "min",
        defaultValue: "--",
        dynamicUnit: true
    },

    jitter: {
        id: "jitter",
        label: "JITTER",
        type: "latency_variation",
        unit: "ms",
        defaultValue: "--"
    }
};

var METRIC_ORDER = [
    "cpu_temp",
    "cpu_load",
    "ram_load",
    "storage_temp",
    "storage_free",
    "fan_speed",
    "battery_charge",
    "psu_state",
    "net_down",
    "net_up",
    "speed_down",
    "speed_up",
    "ping",
    "jitter",
    "speed_age"
];

/*
 * Auslieferungsfassung der Messwertliste in den Einstellungen.
 *
 * Jeder Eintrag enthaelt die Messwert-ID, eine eigene Bezeichnung
 * (leer bedeutet: Vorgabe aus METRICS) und die Sichtbarkeit.
 * Die Reihenfolge entspricht METRIC_ORDER.
 */
function standardMesswertListe() {
    return METRIC_ORDER.map(id => ({
        messwert: id,
        bezeichnung: "",
        sichtbar: true
    }));
}

/*
 * Bereinigt die vom Benutzer eingestellte Messwertliste.
 *
 * Das Bearbeitungsfenster von Cinnamon zeigt immer alle Spalten,
 * also auch den Messwert selbst. Er laesst sich dort versehentlich
 * umstellen. Die Anzeige darf dadurch weder Luecken noch doppelte
 * Zeilen bekommen:
 *
 * - unbekannte oder beschaedigte Eintraege werden verworfen
 * - von doppelten Eintraegen gilt nur der erste
 * - fehlende Messwerte werden sichtbar am Ende ergaenzt
 *
 * Liefert eine Liste von { id, bezeichnung, sichtbar } in der
 * vom Benutzer gewaehlten Reihenfolge.
 */
function ordneMesswerte(liste) {
    const ergebnis = [];
    const vorhanden = {};
    const eintraege = Array.isArray(liste) ? liste : [];

    for (const eintrag of eintraege) {
        if (!eintrag || typeof eintrag !== "object")
            continue;

        const id = eintrag.messwert;

        if (!Object.prototype.hasOwnProperty.call(METRICS, id))
            continue;

        if (vorhanden[id])
            continue;

        vorhanden[id] = true;

        ergebnis.push({
            id: id,
            // Eigene Bezeichnungen erscheinen immer in Grossbuchstaben,
            // passend zu den Vorgaben. Das Eingabefeld von Cinnamon
            // laesst sich nicht einschraenken, daher wird hier
            // umgewandelt.
            bezeichnung:
                typeof eintrag.bezeichnung === "string"
                    ? eintrag.bezeichnung.trim().toUpperCase()
                    : "",
            // Nur ein ausdrueckliches false blendet aus.
            sichtbar: eintrag.sichtbar !== false
        });
    }

    for (const id of METRIC_ORDER) {
        if (vorhanden[id])
            continue;

        ergebnis.push({
            id: id,
            bezeichnung: "",
            sichtbar: true
        });
    }

    return ergebnis;
}

/*
 * Warnschwellen (AP18).
 *
 * richtung "hoch": Warnung, sobald der Wert die Schwelle erreicht
 * oder ueberschreitet. richtung "tief": sobald er sie erreicht oder
 * unterschreitet. Die Vorgaben sind uebliche Richtwerte und in den
 * Einstellungen jeder Komponente aenderbar.
 *
 * Speicher-Temperatur: NVMe-SSDs erreichen beim Kopieren grosser
 * Dateien leicht 60-70 degC. Die Referenz-SSD meldet selbst Warnung
 * bei 89 und kritisch bei 94 degC (hwmon temp1_max/temp1_crit).
 *
 * Der freie Speicherplatz wird in Prozent des Laufwerks bewertet, da
 * Laufwerke sehr verschieden gross sind. Der Akku wird nur im
 * Akkubetrieb bewertet; die Komponente uebergibt sonst keinen Wert.
 */
var WARNSCHWELLEN = {
    cpu_temp:       { richtung: "hoch", warnung: 80, kritisch: 90 },
    storage_temp:   { richtung: "hoch", warnung: 70, kritisch: 80 },
    cpu_load:       { richtung: "hoch", warnung: 85, kritisch: 95 },
    ram_load:       { richtung: "hoch", warnung: 85, kritisch: 95 },
    storage_free:   { richtung: "tief", warnung: 10, kritisch: 5 },
    battery_charge: { richtung: "tief", warnung: 20, kritisch: 10 }
};

/*
 * Warnfarben (AP18, ueberarbeitet in AP20).
 *
 * Zwei Saetze. Welcher passt, haengt vom Bildschirminhalt hinter der
 * Anzeige ab, und den kennt aVincePulse nicht: Die Auswertung des
 * tatsaechlichen Inhalts ueber global.stage.read_pixels wurde in AP08
 * bewusst verworfen, weil die Umschaltung beim Verschieben von
 * Fenstern springen wuerde. Der Benutzer waehlt den Satz deshalb
 * selbst (Entscheidung vom 20.09.2026, nach Erprobung auf hellem und
 * dunklem Hintergrundbild).
 *
 *   dunkel  leuchtend, wie seit AP18. Auf dunklem Hintergrund die
 *           kraeftigere Wirkung; vom Nutzer dort ausgewaehlt.
 *   hell    gedaempft. Auf hellem Hintergrund deutlich besser lesbar;
 *           vom Nutzer dort ausgewaehlt. Loest Befund G9 aus AP19.
 *
 * Kontraste, nachgerechnet mit
 * 06_TESTVERSIONEN/0.1.0-dev_AP20-PRUEFDATEN/kontrast.py (WCAG 2.1),
 * Schrift unmittelbar gegen den Bildschirminhalt, ohne Flaeche:
 *
 *   dunkel  #FFA726  1,94 : 1 gegen Weiss   10,81 : 1 gegen Schwarz
 *           #FF5252  3,19 : 1                6,58 : 1
 *   hell    #E65100  3,79 : 1                5,54 : 1
 *           #C62828  5,62 : 1                3,74 : 1
 *
 * Als Mindestkontrast fuer grosse, fette Schrift gelten 3,0 : 1. Der
 * Schriftschatten ist in diesen Zahlen nicht enthalten; er wirkt
 * sichtbar, laesst sich aber nicht in eine Kontrastzahl fassen. Den
 * Ausschlag gab deshalb der Augenschein des Nutzers.
 */
var WARNFARBEN_SAETZE = {
    dunkel: { warnung: "#FFA726", kritisch: "#FF5252" },
    hell:   { warnung: "#E65100", kritisch: "#C62828" }
};

var WARNFARBEN_VORGABE = "dunkel";

/*
 * Schriftschatten von Beschriftung, Wert und Einheit (AP20).
 *
 * Voll deckend und mit grossem Radius. Er traegt die Lesbarkeit,
 * sobald wenig oder keine Hintergrundflaeche eingestellt ist, und das
 * ist seit AP20 der Regelfall: Die Flaeche laesst sich nur bis 35
 * Prozent aufdrehen, weil daruber die Warnfarben auf der dann
 * mittelgrauen Flaeche verlieren (Erprobung vom 20.09.2026).
 *
 * Erprobt wurden 8 px voll deckend, 3 px voll deckend und ein
 * Doppelschatten aus beidem. Der Nutzer hat auf hellem wie auf
 * dunklem Hintergrund die erste Fassung gewaehlt.
 *
 * Applet und Desklet verwenden denselben Wert; bis AP19 lag das
 * Desklet bei 6 px und das Applet bei 8 px, beide mit 0.9.
 */
var SCHRIFTSCHATTEN = "0px 0px 8px rgba(0,0,0,1)";

/*
 * Farbe einer Warnstufe aus dem gewaehlten Satz.
 * Liefert null, wenn die Stufe nicht eingefaerbt wird.
 * Eine unbekannte oder beschaedigte Auswahl faellt auf die Vorgabe
 * zurueck.
 */
function warnfarbeFuer(stufe, farbwahl) {
    const satz = WARNFARBEN_SAETZE[String(farbwahl)] ||
                 WARNFARBEN_SAETZE[WARNFARBEN_VORGABE];

    return satz[stufe] || null;
}

/*
 * Puffer gegen Flackern: Eine erreichte Stufe gilt weiter, bis der
 * Wert die Schwelle um diesen Betrag wieder verlassen hat. Pendelt
 * die CPU-Last zwischen 84 und 86 %, wechselt die Farbe sonst bei
 * jedem Takt.
 */
var WARN_PUFFER = 2;

const WARN_RANG = { normal: 0, warnung: 1, kritisch: 2 };

function standardWarnListe() {
    return Object.keys(WARNSCHWELLEN).map(id => ({
        messwert: id,
        warnung: WARNSCHWELLEN[id].warnung,
        kritisch: WARNSCHWELLEN[id].kritisch,
        aktiv: true
    }));
}

/*
 * Bereinigt die eingestellte Liste der Warnschwellen.
 *
 * Unbekannte, beschaedigte und doppelte Eintraege werden verworfen,
 * fehlende Messwerte erhalten die Vorgaben. Sind Warnung und kritisch
 * vertauscht eingegeben, gilt die strengere Schwelle als kritisch.
 *
 * Liefert { Messwert-ID: { richtung, warnung, kritisch, aktiv } }.
 */
function ordneWarnschwellen(liste) {
    const ergebnis = {};

    for (const id in WARNSCHWELLEN) {
        ergebnis[id] = {
            richtung: WARNSCHWELLEN[id].richtung,
            warnung: WARNSCHWELLEN[id].warnung,
            kritisch: WARNSCHWELLEN[id].kritisch,
            aktiv: true
        };
    }

    const vorhanden = {};

    for (const eintrag of Array.isArray(liste) ? liste : []) {
        if (!eintrag || typeof eintrag !== "object")
            continue;

        const id = eintrag.messwert;

        if (!Object.prototype.hasOwnProperty.call(WARNSCHWELLEN, id) || vorhanden[id])
            continue;

        vorhanden[id] = true;

        const schwelle = ergebnis[id];
        // Nur Zahlen und nicht leere Texte gelten: false, [] und " "
        // ergaeben mit Number() jeweils 0 und damit eine Schwelle, die
        // dauerhaft ausloest (Befund P8 aus AP25).
        const warnung = zahlOderNull(eintrag.warnung);
        const kritisch = zahlOderNull(eintrag.kritisch);

        if (warnung !== null)
            schwelle.warnung = warnung;

        if (kritisch !== null)
            schwelle.kritisch = kritisch;

        schwelle.aktiv = eintrag.aktiv !== false;

        const a = schwelle.warnung;
        const b = schwelle.kritisch;

        if (schwelle.richtung === "hoch") {
            schwelle.warnung = Math.min(a, b);
            schwelle.kritisch = Math.max(a, b);
        } else {
            schwelle.warnung = Math.max(a, b);
            schwelle.kritisch = Math.min(a, b);
        }
    }

    return ergebnis;
}

/*
 * Bewertet einen Messwert: "normal", "warnung" oder "kritisch".
 *
 * vorher ist die bisherige Stufe; sie bestimmt den Puffer gegen
 * Flackern. Nicht auswertbare Werte wie "--" gelten als normal.
 */
function bewerteStufe(wert, schwelle, vorher) {
    if (!schwelle || !schwelle.aktiv)
        return "normal";

    if (wert === null || wert === undefined || wert === "")
        return "normal";

    const zahl = Number(wert);

    if (!Number.isFinite(zahl))
        return "normal";

    const bisher = WARN_RANG[vorher] || 0;

    // Abstand jenseits der Schwelle, in Richtung "schlechter" positiv.
    const jenseits = grenze =>
        schwelle.richtung === "hoch" ? zahl - grenze : grenze - zahl;

    const erreicht = (grenze, stufe) =>
        jenseits(grenze) >= 0 ||
        (bisher >= WARN_RANG[stufe] && jenseits(grenze) > -WARN_PUFFER);

    if (erreicht(schwelle.kritisch, "kritisch"))
        return "kritisch";

    if (erreicht(schwelle.warnung, "warnung"))
        return "warnung";

    return "normal";
}


/*
 * Unterstuetzung (AP23).
 *
 * aVincePulse ist und bleibt kostenlos und vollstaendig. Der Hinweis
 * erscheint ausschliesslich an einer Stelle, die der Benutzer von
 * sich aus aufsucht: ganz unten im Einstellungsfenster. Keine
 * Einblendung, keine Benachrichtigung, kein zeitgesteuerter Hinweis,
 * keine Zaehlung, keine gesperrte Funktion. Das entspricht sowohl der
 * Festlegung des Nutzers vom 19.09.2026 als auch der Regel von
 * Cinnamon Spices: "That link must not interrupt the user - no nag
 * screens, pop-ups, repeated prompts, or features held back behind
 * it inside the spice itself."
 *
 * Die Adresse steht hier und nur hier, damit Applet und Desklet nicht
 * auseinanderlaufen koennen. Weitere Stellen ausserhalb des Codes:
 * .github/FUNDING.yml, README.md und README.de.md.
 */
var UNTERSTUETZEN_URL = "https://ko-fi.com/avince";

/*
 * Wahr, wenn die hinterlegte Adresse unbrauchbar ist.
 *
 * Geprueft wird der Aufbau, nicht die Erreichbarkeit: Das Programm
 * ruft nichts ab, um festzustellen, ob es etwas anzeigen darf.
 * Bis zum 21.09.2026 stand hier ein Platzhalter, und die Pruefung
 * fing genau den ab; sie bleibt als Absicherung gegen eine geleerte
 * oder beschaedigte Konstante bestehen.
 *
 * Trifft sie zu, melden die Komponenten beim Klick, dass die Seite
 * nicht eingerichtet ist, statt einen Browser irgendwohin zu
 * schicken.
 */
function unterstuetzenUrlFehlt() {
    if (typeof UNTERSTUETZEN_URL !== "string")
        return true;

    // Nur eine verschluesselte Ko-fi-Adresse mit nicht leerem Namen
    // gilt als brauchbar.
    return !/^https:\/\/ko-fi\.com\/[A-Za-z0-9_.-]+$/.test(UNTERSTUETZEN_URL);
}
