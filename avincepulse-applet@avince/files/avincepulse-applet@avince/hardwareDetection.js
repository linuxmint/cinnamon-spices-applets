/*
 * aVincePulse
 * Hardware Detection / Sensor Mapping
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
 * Erkennt geeignete hwmon-Sensoren fuer:
 * - CPU-Temperatur
 * - Storage-/NVMe-Temperatur
 * - Luefterdrehzahl
 *
 * Messwerte werden direkt aus /sys/class/hwmon gelesen.
 *
 * Zusaetzlich wird der Systemakku ueber /sys/class/power_supply erkannt.
 * Akkus von Peripheriegeraeten werden dabei ausgeschlossen.
 *
 * Der Sensor fuer CPU-Temperatur, Speicher-Temperatur und Luefter
 * kann vom Benutzer vorgegeben werden. Ohne Vorgabe, mit "auto" oder
 * wenn der vorgegebene Sensor fehlt, gilt die automatische Auswahl
 * ueber das Punktesystem.
 *
 * Jeder Sensor traegt eine Kennung aus Chip, Geraet und Sensornummer,
 * zum Beispiel "dell_smm|dell_smm_hwmon|temp3". Die hwmonN-Nummer ist
 * bewusst nicht enthalten, da sie sich nach einem Neustart aendern
 * kann. Chip und Bezeichnung allein reichen nicht: dell_smm meldet
 * sechs Temperaturen ohne Bezeichnung, zwei NVMe-SSDs heissen beide
 * "nvme / Composite".
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
function fuelle(vorlage, ...werte) {
    let i = 0;
    return String(vorlage).replace(/%s/g, () => {
        const w = werte[i++];
        return (w === undefined || w === null) ? "" : String(w);
    });
}

/*
 * Tabellenhilfen fuer die Berichte (AP24).
 *
 * Bis zur Uebersetzung standen Trennlinien und Spaltenbreiten fest
 * im Code - "----------------------" unter einer Ueberschrift mit
 * 22 Zeichen, padEnd(16) fuer eine Spalte. Sobald ein Text uebersetzt
 * wird, aendert sich seine Laenge und die Formatierung verrutscht.
 * Beides wird deshalb aus dem Inhalt berechnet.
 */
function unterstreiche(text) {
    return "-".repeat(String(text).length);
}

/*
 * Formatiert eine Tabelle: erste Zeile Ueberschriften, danach die
 * Daten. Jede Spalte wird so breit wie ihr laengster Eintrag.
 * "rechts" nennt die Spaltennummern, die rechtsbuendig stehen.
 */
function tabelle(zeilen, rechts = []) {
    if (!zeilen.length)
        return [];

    const spalten = zeilen[0].length;
    const breite = [];

    for (let i = 0; i < spalten; i++) {
        breite.push(Math.max(...zeilen.map(z => String(z[i] ?? "").length)));
    }

    const formatiere = (z) => z.map((wert, i) => {
        const t = String(wert ?? "");
        // Die letzte Spalte nicht auffuellen, das gaebe Leerzeichen
        // am Zeilenende.
        if (i === spalten - 1)
            return rechts.includes(i) ? t.padStart(breite[i]) : t;
        return (rechts.includes(i) ? t.padStart(breite[i]) : t.padEnd(breite[i])) + "  ";
    }).join("");

    const ausgabe = [formatiere(zeilen[0])];
    ausgabe.push(formatiere(zeilen[0].map(w => "-".repeat(String(w).length))));

    for (const z of zeilen.slice(1))
        ausgabe.push(formatiere(z));

    return ausgabe;
}


const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

// Messwerte, deren Sensor waehlbar ist, und die zugehoerige Sensorart.
var SENSOR_ARTEN = ["cpu", "storage", "fan"];

var HardwareDetector = class HardwareDetector {
    /*
     * auswahl: optional { cpu, storage, fan } mit je einer
     * Sensorkennung oder "auto".
     */
    constructor(auswahl) {
        this._auswahl = this._normalisiereAuswahl(auswahl);

        // Muss vor detect() stehen: _scoreStorage() liest es.
        this._laufwerkGeraet = "";
        this._laufwerkPfad = "";
        this._speicherProtokolliert = false;

        this._mapping = this.detect();

        global.log(
            "aVincePulse AP05: CPU sensor -> " +
            this._describe(this._mapping.cpu)
        );

        /*
         * Der Speichersensor wird hier bewusst NICHT protokolliert.
         *
         * Er steht zu diesem Zeitpunkt erst vorlaeufig fest: Welches
         * Laufwerk gemessen wird, erfaehrt die Erkennung erst durch
         * setzeLaufwerkGeraet(), und auf einem Rechner mit zwei
         * gleichartigen Platten aendert sich die Wahl dadurch. Eine
         * Zeile an dieser Stelle nannte den falschen Sensor und stand
         * dann ueberholt im Protokoll - genau dort, wo man bei einem
         * Verdacht zuerst nachsieht (Befund B7 aus AP25).
         *
         * Die Zeile schreibt stattdessen setzeLaufwerkGeraet(), nach
         * der Zuordnung, und zwar auch dann, wenn sich kein Laufwerk
         * ermitteln laesst.
         */

        global.log(
            "aVincePulse AP05: FAN sensor -> " +
            this._describe(this._mapping.fan)
        );

        global.log(
            "aVincePulse AP07: Battery/PSU -> " +
            this._describeBattery(this._mapping.battery)
        );
    }

    detect() {
        const sensors = this._scanHwmon();

        // Alle gefundenen Sensoren bleiben erhalten, damit sie zur
        // Auswahl angeboten und ohne neuen Suchlauf gewechselt
        // werden koennen.
        this._sensoren = sensors;

        this._automatisch = {
            cpu: this._selectBest(
                sensors.temperatures,
                sensor => this._scoreCpu(sensor)
            ),

            storage: this._selectBest(
                sensors.temperatures,
                sensor => this._scoreStorage(sensor)
            ),

            fan: this._selectBest(
                sensors.fans,
                sensor => this._scoreFan(sensor)
            )
        };

        /*
         * Herkunft der Sensorwahl, in zwei Fassungen (AP26).
         *
         * _quelle traegt den uebersetzten Text fuer den
         * Hardwarebericht, den der Benutzer liest.
         *
         * _quelleKennung traegt eine feste, unuebersetzte Kennung fuer
         * die Protokollzeilen. Abschnitt 8 des Statusdokuments
         * verlangt unuebersetzte Protokolle: Auf einem englischen
         * System stand dort bisher "automatic", auf einem deutschen
         * "automatisch" - wer ein Protokoll nach einem festen Wort
         * durchsucht, fand es nicht.
         */
        this._quelle = {};
        this._quelleKennung = {};

        const mapping = {
            battery: this._detectBattery()
        };

        for (const art of SENSOR_ARTEN)
            mapping[art] = this._waehleSensor(art);

        return mapping;
    }

    /*
     * Nennt das Laufwerk, dessen freien Platz die Anzeige zeigt.
     *
     * Ohne diese Angabe waehlte die Automatik den Temperatursensor
     * allein nach der Beschriftung. Auf einem Rechner mit zwei NVMe
     * tragen beide einen Sensor "Composite", beide erhalten dieselbe
     * Bewertung, und _selectBest() nimmt bei Gleichstand den zuerst
     * gefundenen. Angezeigt wurden dann die Temperatur des einen und
     * der freie Platz des anderen Laufwerks - ohne jeden Hinweis
     * darauf (Befund B1 aus AP25, auf dem Zweitgeraet gefunden).
     *
     * geraet ist der Kernelname der gemessenen Partition, etwa
     * "nvme0n1p2". Aendert sich nichts, geschieht nichts.
     */
    setzeLaufwerkGeraet(geraet) {
        const name = typeof geraet === "string" ? geraet : "";
        const geaendert = name !== this._laufwerkGeraet;

        if (geaendert) {
            this._laufwerkGeraet = name;
            this._laufwerkPfad = name ? this._blockPfad(name) : "";

            // Die automatische Wahl haengt jetzt vom Laufwerk ab.
            this._automatisch.storage = this._selectBest(
                this._sensoren.temperatures,
                sensor => this._scoreStorage(sensor)
            );

            this._mapping.storage = this._waehleSensor("storage");
        }

        /*
         * Die einzige Protokollzeile zum Speichersensor (Befund B7).
         *
         * Geschrieben wird beim ersten Aufruf und danach nur noch,
         * wenn sich die Zuordnung wirklich aendert. Der erste Aufruf
         * zaehlt auch dann, wenn er nichts aendert - sonst fehlte die
         * Zeile auf einem Rechner, dessen Laufwerk sich nicht
         * ermitteln laesst.
         */
        if (geaendert || !this._speicherProtokolliert) {
            this._speicherProtokolliert = true;

            global.log(
                "aVincePulse AP05: Storage sensor -> " +
                this._describe(this._mapping.storage) +
                "  (drive: " + (name || "unknown") +
                ", " + this._quelleKennung.storage + ")"
            );
        }
    }

    /*
     * Geraetepfad einer Partition, wie ihn /sys/class/block als
     * Verweisziel nennt - etwa
     * "../../devices/pci0000:00/.../nvme/nvme0/nvme0n1/nvme0n1p2".
     *
     * Der Text genuegt; er muss nicht aufgeloest werden. Gesucht wird
     * darin spaeter ein einzelnes Pfadglied.
     */
    _blockPfad(geraet) {
        try {
            return GLib.file_read_link("/sys/class/block/" + geraet) || "";
        } catch (e) {
            return "";
        }
    }

    /*
     * Gehoert dieser Sensor zu dem Laufwerk, dessen Platz die Anzeige
     * nennt?
     *
     * Verglichen wird auf ein ganzes Pfadglied, nicht auf einen
     * Textausschnitt: "nvme0" darf nicht auf "nvme0n1" passen.
     */
    _gehoertZumLaufwerk(sensor) {
        if (!this._laufwerkPfad || !sensor.geraet)
            return false;

        return ("/" + this._laufwerkPfad + "/")
            .includes("/" + sensor.geraet + "/");
    }

    /*
     * Uebernimmt eine neue Sensorauswahl ohne erneuten Suchlauf.
     * Die Aenderung wirkt ab dem naechsten readValues().
     */
    setzeAuswahl(auswahl) {
        this._auswahl = this._normalisiereAuswahl(auswahl);

        for (const art of SENSOR_ARTEN) {
            this._mapping[art] = this._waehleSensor(art);

            global.log(
                "aVincePulse AP14: " + art + " sensor (" +
                this._quelleKennung[art] + ") -> " +
                this._describe(this._mapping[art])
            );
        }
    }

    /*
     * Bietet die Sensoren einer Art zur Auswahl an.
     *
     * Rueckgabe: Objekt { Anzeigetext: Kennung } in der Form, die
     * Cinnamon fuer die Optionen eines Auswahlfeldes erwartet.
     * Der erste Eintrag ist immer "Automatisch" mit dem Sensor, den
     * die automatische Auswahl gerade verwendet.
     *
     * Ist ein gespeicherter Sensor nicht mehr vorhanden, erscheint er
     * als "Nicht gefunden", damit das Auswahlfeld nicht leer wirkt und
     * die Wahl erhalten bleibt, bis der Sensor zurueckkehrt.
     */
    getSensorOptionen(art, aktuelleWahl) {
        const optionen = {};
        const auto = this._automatisch[art];

        optionen[
            fuelle(
                _("Automatic (%s)"),
                auto ? this._anzeigeName(auto, art) : _("no sensor found")
            )
        ] = "auto";

        const kandidaten = this._kandidaten(art).slice().sort(
            (a, b) =>
                a.chip.localeCompare(b.chip) ||
                a.geraet.localeCompare(b.geraet) ||
                a.index - b.index
        );

        for (const sensor of kandidaten) {
            const wert = art === "fan"
                ? this._readFan(sensor) + " rpm"
                : this._readTemperature(sensor) + " \u00b0C";

            let text = this._anzeigeName(sensor, art) + "  \u00b7  " + wert;

            // Anzeigetexte muessen eindeutig sein, da sie als
            // Schluessel dienen.
            while (text in optionen)
                text += " ";

            optionen[text] = sensor.key;
        }

        if (
            aktuelleWahl &&
            aktuelleWahl !== "auto" &&
            !kandidaten.some(sensor => sensor.key === aktuelleWahl)
        )
            optionen[fuelle(_("Not found: %s"), aktuelleWahl)] = aktuelleWahl;

        return optionen;
    }

    _normalisiereAuswahl(auswahl) {
        const ergebnis = {};

        for (const art of SENSOR_ARTEN) {
            const wert = auswahl ? auswahl[art] : null;

            ergebnis[art] =
                typeof wert === "string" && wert !== ""
                    ? wert
                    : "auto";
        }

        return ergebnis;
    }

    _kandidaten(art) {
        if (!this._sensoren)
            return [];

        return art === "fan"
            ? this._sensoren.fans
            : this._sensoren.temperatures;
    }

    /*
     * Liefert den vom Benutzer gewaehlten Sensor, sonst den
     * automatisch ermittelten. Vermerkt die Herkunft fuer Protokoll
     * und Hardwarebericht.
     */
    _waehleSensor(art) {
        const gewuenscht = this._auswahl[art];
        const auto = this._automatisch[art];

        if (gewuenscht === "auto") {
            this._quelle[art] = _("automatic");
            this._quelleKennung[art] = "auto";
            return auto;
        }

        const sensor = this._kandidaten(art)
            .find(kandidat => kandidat.key === gewuenscht);

        if (sensor) {
            this._quelle[art] = _("selected manually");
            this._quelleKennung[art] = "manual";
            return sensor;
        }

        this._quelle[art] = fuelle(
            _("automatic – selected sensor %s was not found"), gewuenscht);

        // Der gewuenschte Sensor gehoert ins Protokoll: Ohne ihn waere
        // nicht zu erkennen, welcher Sensor verschwunden ist.
        this._quelleKennung[art] =
            "auto-fallback, not found: " + gewuenscht;

        return auto;
    }

    /*
     * Lesbarer Name eines Sensors, zum Beispiel "coretemp - Core 0".
     * Sensoren ohne Bezeichnung werden durchnummeriert. Melden mehrere
     * Geraete denselben Chip, etwa zwei NVMe-SSDs, wird das Geraet
     * angehaengt.
     */
    _anzeigeName(sensor, art) {
        const bezeichnung = sensor.label || fuelle(
            art === "fan" ? _("Fan %s") : _("Temperature %s"), sensor.index);

        const geraete = new Set(
            this._kandidaten(art)
                .filter(kandidat => kandidat.chip === sensor.chip)
                .map(kandidat => kandidat.geraet)
        );

        return sensor.chip + " \u2013 " + bezeichnung +
            (geraete.size > 1 ? " [" + sensor.geraet + "]" : "");
    }


    /*
     * Kennung eines Geraets fuer die gespeicherte Sensorwahl.
     *
     * Bevorzugt die Seriennummer, die der Kernel neben dem Geraet
     * ablegt - bei NVMe unter <hwmon>/device/serial. Sie gehoert zur
     * Hardware und ueberlebt jeden Neustart, waehrend der Geraetename
     * die Fundreihenfolge widerspiegelt.
     *
     * Ohne Seriennummer bleibt es beim Geraetenamen. Fuer die
     * uebrigen Chips - coretemp.0, dell_smm_hwmon, thermal_zoneN -
     * ist das tragfaehig: Ihre Namen ergeben sich aus dem Aufbau des
     * Rechners, nicht aus einer Zaehlung.
     *
     * Das Praefix "sn:" haelt beide Faelle auseinander und macht in
     * einer gespeicherten Einstellung lesbar, worauf sie sich stuetzt.
     */
    _stabileKennung(basePath, geraet) {
        const roh = this._readFile(basePath + "/device/serial");

        if (typeof roh !== "string")
            return geraet;

        // Leerzeichen und der Trenner der Kennung wuerden sie sonst
        // zerlegen; Seriennummern enthalten beides gelegentlich.
        const serial = roh.trim().replace(/[\s|]+/g, "");

        return serial ? "sn:" + serial : geraet;
    }

    /*
     * Geraet, an dem ein hwmon-Chip haengt, etwa "nvme0" oder
     * "coretemp.0". Stabiler als die hwmonN-Nummer, aber nicht
     * zugesichert: Der Kernel vergibt diese Namen in der Reihenfolge,
     * in der er die Geraete findet. Bei zwei NVMe-Laufwerken kann
     * "nvme0" nach einem Neustart die andere Platte sein, und ein
     * abgezogener und wieder verbundener Empfaenger erscheint als
     * "hidpp_battery_24" statt "hidpp_battery_22" (Befund B9 aus
     * AP25, auf dem Zweitgeraet belegt).
     *
     * Dieser Name dient deshalb nur der Anzeige und dem Abgleich mit
     * dem gemessenen Laufwerk. Was gespeichert wird, liefert
     * _stabileKennung().
     */
    _geraetVon(basePath) {
        try {
            return GLib.path_get_basename(
                GLib.file_read_link(basePath + "/device")
            );
        } catch (e) {
            return "";
        }
    }

    readValues() {
        const battery =
            this._readBattery(this._mapping.battery);

        return {
            cpu: this._readTemperature(this._mapping.cpu),
            ssd: this._readTemperature(this._mapping.storage),
            fan: this._readFan(this._mapping.fan),
            batteryCharge: battery.charge,
            psuState: battery.psu
        };
    }

    getMapping() {
        return this._mapping;
    }

    /*
     * Meldet, welche hardwareabhaengigen Messwerte auf diesem
     * Geraet tatsaechlich verfuegbar sind.
     *
     * Die Schluessel entsprechen den Messwert-IDs aus metrics.js.
     * Messwerte, die hier nicht aufgefuehrt sind, gelten als
     * immer verfuegbar - etwa CPU-Auslastung oder Netzwerk,
     * die nicht von einem Sensor abhaengen.
     *
     * Die Auswertung erfolgt einmalig bei der Hardwareerkennung.
     */
    getAvailability() {
        const hasBattery = !!(
            this._mapping.battery &&
            this._mapping.battery.path
        );

        return {
            cpu_temp: this._mapping.cpu !== null,
            storage_temp: this._mapping.storage !== null,
            fan_speed: this._mapping.fan !== null,

            // Ladezustand und Netzteilzustand werden nur auf
            // Geraeten mit Akku angezeigt. Ein Desktop-PC meldet
            // haeufig eine AC-Schnittstelle, aber keinen Akku -
            // eine dauerhafte Anzeige "PSU ON" waere dort ohne Aussage.
            battery_charge: hasBattery,
            psu_state: hasBattery
        };
    }

    _scanHwmon() {
        const result = {
            temperatures: [],
            fans: []
        };

        try {
            const rootPath = "/sys/class/hwmon";
            const root = Gio.File.new_for_path(rootPath);

            const enumerator = root.enumerate_children(
                "standard::name",
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info;

            while ((info = enumerator.next_file(null)) !== null) {
                const dirName = info.get_name();

                if (!/^hwmon[0-9]+$/.test(dirName))
                    continue;

                const basePath =
                    rootPath + "/" + dirName;

                const chip =
                    this._readFile(basePath + "/name") || "";

                this._scanHwmonDirectory(
                    basePath,
                    chip,
                    result
                );
            }

            enumerator.close(null);

        } catch (e) {
            global.logError(e);
        }

        return result;
    }

    _scanHwmonDirectory(basePath, chip, result) {
        const geraet = this._geraetVon(basePath);
        const kennung = this._stabileKennung(basePath, geraet);

        try {
            const dir = Gio.File.new_for_path(basePath);

            const enumerator = dir.enumerate_children(
                "standard::name",
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info;

            while ((info = enumerator.next_file(null)) !== null) {
                const name = info.get_name();

                let match =
                    name.match(/^temp([0-9]+)_input$/);

                if (match) {
                    const index = Number(match[1]);

                    const label =
                        this._readFile(
                            basePath +
                            "/temp" +
                            index +
                            "_label"
                        ) || "";

                    result.temperatures.push({
                        chip: chip,
                        label: label,
                        index: index,
                        geraet: geraet,
                        key: chip + "|" + kennung + "|temp" + index,
                        path: basePath + "/" + name
                    });

                    continue;
                }

                match =
                    name.match(/^fan([0-9]+)_input$/);

                if (match) {
                    const index = Number(match[1]);

                    const label =
                        this._readFile(
                            basePath +
                            "/fan" +
                            index +
                            "_label"
                        ) || "";

                    result.fans.push({
                        chip: chip,
                        label: label,
                        index: index,
                        geraet: geraet,
                        key: chip + "|" + kennung + "|fan" + index,
                        path: basePath + "/" + name
                    });
                }
            }

            enumerator.close(null);

        } catch (e) {
            global.logError(e);
        }
    }

    _scoreCpu(sensor) {
        const chip =
            sensor.chip.toLowerCase();

        const label =
            sensor.label.toLowerCase();

        // Intel
        if (chip.includes("coretemp")) {
            if (label.includes("package id"))
                return 1000;

            if (label.includes("package"))
                return 980;

            if (label.startsWith("core"))
                return 800;

            return 750 - sensor.index;
        }

        // AMD
        if (
            chip.includes("k10temp") ||
            chip.includes("zenpower")
        ) {
            if (label === "tdie")
                return 1000;

            if (label === "tctl")
                return 950;

            if (label.includes("tccd"))
                return 750;

            return 700 - sensor.index;
        }

        // Weitere Systeme
        if (
            label.includes("cpu") ||
            label.includes("package") ||
            label === "tdie" ||
            label === "tctl"
        )
            return 600;

        if (
            chip.includes("cpu") &&
            chip.includes("thermal")
        )
            return 550;

        return -1;
    }

    /*
     * Bewertung des Speicherplatz-Sensors.
     *
     * Der Zuschlag fuer das richtige Laufwerk ist bewusst groesser als
     * jede Grundbewertung: Ein schwaecher beschrifteter Sensor des
     * gemessenen Laufwerks ist richtiger als ein "Composite" eines
     * anderen (Befund B1). Ist kein Laufwerk bekannt oder laesst es
     * sich keinem Sensor zuordnen, bleibt es beim bisherigen
     * Verhalten - Rechner mit nur einer Platte aendern sich nicht.
     */
    _scoreStorage(sensor) {
        const grund = this._scoreStorageGrund(sensor);

        if (grund < 0)
            return grund;

        return grund + (this._gehoertZumLaufwerk(sensor) ? 10000 : 0);
    }

    _scoreStorageGrund(sensor) {
        const chip =
            sensor.chip.toLowerCase();

        const label =
            sensor.label.toLowerCase();

        if (chip.includes("nvme")) {
            if (label === "composite")
                return 1000;

            if (label.includes("sensor 1"))
                return 850;

            return 800 - sensor.index;
        }

        if (chip.includes("drivetemp"))
            return 900 - sensor.index;

        if (
            label.includes("composite") ||
            label.includes("ssd") ||
            label.includes("drive") ||
            label.includes("disk")
        )
            return 600;

        return -1;
    }

    _scoreFan(sensor) {
        const chip =
            sensor.chip.toLowerCase();

        if (chip.includes("dell_smm"))
            return 1000 - sensor.index;

        if (
            chip.includes("thinkpad") ||
            chip.includes("nct") ||
            chip.includes("it87") ||
            chip.includes("asus") ||
            chip.includes("applesmc")
        )
            return 800 - sensor.index;

        // Jeder echte fan*_input ist besser als kein FAN.
        return 500 - sensor.index;
    }

    _selectBest(candidates, scorer) {
        let best = null;
        let bestScore = -1;

        for (const sensor of candidates) {
            const score = scorer(sensor);

            if (score > bestScore) {
                best = sensor;
                bestScore = score;
            }
        }

        return bestScore >= 0 ? best : null;
    }

    _readTemperature(sensor) {
        if (!sensor)
            return "--";

        // _readFile() liefert bei einer leeren Datei "" und nicht null;
        // Number("") waere 0 und damit eine scheinbar gueltige
        // Temperatur (Befund P7 aus AP25).
        const zahl =
            this._zahlOderNull(this._readFile(sensor.path));

        if (zahl === null)
            return "--";

        let value = zahl;

        // Linux hwmon liefert Temperaturen normalerweise
        // in Milligrad Celsius.
        if (Math.abs(value) > 1000)
            value = value / 1000;

        if (value < -50 || value > 150)
            return "--";

        return String(Math.round(value));
    }

    _readFan(sensor) {
        if (!sensor)
            return "----";

        // Wie bei der Temperatur: eine leere Datei ergaebe sonst 0 rpm
        // (Befund P7 aus AP25).
        const value =
            this._zahlOderNull(this._readFile(sensor.path));

        if (
            value === null ||
            value < 0 ||
            value > 200000
        )
            return "----";

        return String(Math.round(value));
    }

    /*
     * Sucht den Systemakku unter /sys/class/power_supply.
     *
     * Akkus von Peripheriegeraeten - Funkmaus, Tastatur, Headset -
     * melden sich dort ebenfalls als "Battery", tragen aber
     * scope = Device. Nur diese werden ausgeschlossen.
     * Fehlt die scope-Datei, handelt es sich nach Linux-Konvention
     * um den Systemakku.
     *
     * Zusaetzlich wird die Netzteil-Schnittstelle gesucht, damit
     * Netzbetrieb und Akkubetrieb unterschieden werden koennen.
     */
    _detectBattery() {
        const result = {
            path: null,
            acPath: null
        };

        try {
            const rootPath = "/sys/class/power_supply";
            const root = Gio.File.new_for_path(rootPath);

            const enumerator = root.enumerate_children(
                "standard::name",
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info;

            while ((info = enumerator.next_file(null)) !== null) {
                const basePath =
                    rootPath + "/" + info.get_name();

                const type =
                    (this._readFile(basePath + "/type") || "")
                        .toLowerCase();

                if (type === "mains") {
                    if (!result.acPath)
                        result.acPath = basePath;

                    continue;
                }

                if (type !== "battery")
                    continue;

                const scope =
                    (this._readFile(basePath + "/scope") || "")
                        .toLowerCase();

                // Peripheriegeraete ueberspringen.
                if (scope === "device")
                    continue;

                if (!result.path)
                    result.path = basePath;
            }

            enumerator.close(null);

        } catch (e) {
            global.logError(e);
        }

        return result;
    }

    /*
     * Liefert Ladezustand und Betriebszustand des Systemakkus.
     * Ohne Akku - Desktop-PC, Mini-PC - bleiben beide Werte "--".
     */
    _readBattery(battery) {
        const result = {
            charge: "--",
            psu: "--"
        };

        if (!battery)
            return result;

        if (battery.path) {
            result.charge =
                this._readBatteryCharge(battery.path);
        }

        result.psu =
            this._readPsuState(battery);

        return result;
    }

    _readBatteryCharge(basePath) {
        /*
         * _readFile() endet auf trim() und liefert bei einer LEEREN
         * Datei "" und nicht null. Eine Pruefung auf "!== null"
         * liesse den leeren Text durch, Number("") waere 0 und damit
         * endlich, groesser gleich 0 und kleiner gleich 100 - die
         * Anzeige stuende auf "0 %", und die Ersatzrechnung aus
         * charge_now/charge_full weiter unten kaeme nie zum Zug.
         *
         * Im Akkubetrieb loest 0 zusaetzlich dauerhaft die kritische
         * Warnstufe aus (Schwelle "tief", kritisch 10), obwohl der
         * Akku voll sein kann.
         *
         * Dieselbe Falle wie bei P1, P6, P7, P8 und P9 aus AP25; diese
         * Stelle war dort uebersehen worden und kam im Abschluss-Audit
         * vom 26.09.2026 ans Licht (AP27).
         */
        const wert =
            this._zahlOderNull(this._readFile(basePath + "/capacity"));

        if (wert !== null && wert >= 0 && wert <= 100)
            return String(Math.round(wert));

        // Nicht jede Hardware stellt capacity bereit.
        // In diesem Fall wird der Ladezustand berechnet.
        const pairs = [
            ["/charge_now", "/charge_full"],
            ["/energy_now", "/energy_full"]
        ];

        for (const pair of pairs) {
            // Number(null) und Number("") ergeben 0 und sind endlich.
            // Ohne die Pruefung auf einen brauchbaren Rohwert erschiene
            // ein fehlendes charge_now als "0 %" (Befund P1 aus AP25).
            const nowRoh = this._readFile(basePath + pair[0]);
            const fullRoh = this._readFile(basePath + pair[1]);

            const now = this._zahlOderNull(nowRoh);
            const full = this._zahlOderNull(fullRoh);

            if (
                now !== null &&
                full !== null &&
                full > 0
            ) {
                const percent = 100 * now / full;

                return String(
                    Math.round(
                        Math.max(0, Math.min(100, percent))
                    )
                );
            }
        }

        return "--";
    }

    /*
     * Zustand der Stromversorgung (Power Supply Unit).
     *
     * ON  = Netzteil angeschlossen, das Geraet laedt oder
     *       laeuft im Netzbetrieb
     * OFF = kein Netzteil, das Geraet laeuft ueber den Akku
     * --  = keine Netzteil-Schnittstelle vorhanden
     */
    _readPsuState(battery) {
        if (!battery.acPath) {
            // Ohne AC-Schnittstelle laesst sich der Netzbetrieb
            // ersatzweise aus dem Akkustatus ableiten.
            if (!battery.path)
                return "--";

            const status =
                (this._readFile(battery.path + "/status") || "")
                    .toLowerCase();

            if (status === "discharging")
                return "OFF";

            if (status === "charging" || status === "full")
                return "ON";

            return "--";
        }

        const online =
            this._readFile(battery.acPath + "/online");

        if (online === "1")
            return "ON";

        if (online === "0")
            return "OFF";

        return "--";
    }

    /*
     * Wandelt einen Rohwert aus /sys in eine Zahl um.
     *
     * Number() allein genuegt nicht: Number(null), Number(""),
     * Number(false) und Number([]) ergeben jeweils 0 und sind endlich.
     * Ein fehlender oder leerer Wert erschiene damit als gueltige Null
     * (Befund P1 aus AP25, dieselbe Falle wie in AP22).
     */
    _zahlOderNull(rohwert) {
        if (typeof rohwert !== "string" || rohwert.trim() === "")
            return null;

        const zahl = Number(rohwert);

        return Number.isFinite(zahl) ? zahl : null;
    }

    _readFile(path) {
        try {
            const result =
                GLib.file_get_contents(path);

            if (!result[0])
                return null;

            return ByteArray
                .toString(result[1])
                .trim();

        } catch (e) {
            return null;
        }
    }

    /*
     * Lesbarer Bericht ueber die erkannte Hardware.
     * Dient der Anzeige und dem Abspeichern als Textdatei.
     */
    berichtText(komponente) {
        const zeilen = [];
        const titel = _("aVincePulse - detected hardware");

        zeilen.push(titel);
        zeilen.push("=".repeat(titel.length));
        zeilen.push("");
        zeilen.push(fuelle(_("Created on   : %s"), new Date().toLocaleString()));
        zeilen.push(fuelle(_("Created by   : %s"), komponente || _("unknown")));
        zeilen.push("");

        const u1 = _("Sensors");
        zeilen.push(u1);
        zeilen.push(unterstreiche(u1));

        // Die drei Sensorzeilen als Tabelle, damit der Doppelpunkt
        // in jeder Sprache untereinander steht.
        const sensorZeilen = [
            [_("CPU temperature"), this._describe(this._mapping.cpu), this._quelle.cpu],
            [_("Drive temperature"), this._describe(this._mapping.storage), this._quelle.storage],
            [_("Fan"), this._describe(this._mapping.fan), this._quelle.fan]
        ];

        const breite = Math.max(...sensorZeilen.map(z => z[0].length),
                                _("Battery / power supply").length);

        for (const [name, wert, quelle] of sensorZeilen) {
            zeilen.push(name.padEnd(breite) + " : " + wert);
            zeilen.push(" ".repeat(breite) + "   (" + quelle + ")");
        }

        zeilen.push(_("Battery / power supply").padEnd(breite) + " : " +
                    this._describeBattery(this._mapping.battery));
        zeilen.push("");

        const verfuegbar = this.getAvailability();
        const u2 = _("Available values");

        zeilen.push(u2);
        zeilen.push(unterstreiche(u2));

        const vZeilen = [[_("Value"), _("State")]];

        for (const id of Object.keys(verfuegbar)) {
            vZeilen.push([
                id,
                verfuegbar[id] ? _("present") : _("not present")
            ]);
        }

        for (const z of tabelle(vZeilen))
            zeilen.push(z);

        zeilen.push("");
        zeilen.push(_("Every other value does not depend on a sensor and " +
                      "is always available."));
        zeilen.push("");

        const u3 = _("Every sensor on this system");
        zeilen.push(u3);
        zeilen.push(unterstreiche(u3));

        /*
         * Eine Zeile je Sensor mit berechneten Spaltenbreiten, damit
         * sich die Liste ohne seitliches Scrollen lesen laesst. Der
         * hwmon-Pfad steht bewusst nicht darin: Er ist lang und
         * aendert sich nach einem Neustart. Fuer die verwendeten
         * Sensoren steht er oben.
         */
        const alle = this._scanHwmon();

        const verwendung = {};
        const zuordnung = [
            ["cpu", "CPU"],
            ["storage", _("Drive")],
            ["fan", _("Fan")]
        ];

        for (const [art, name] of zuordnung) {
            const sensor = this._mapping[art];

            if (sensor)
                verwendung[sensor.key] =
                    (verwendung[sensor.key] ? verwendung[sensor.key] + "+" : "") +
                    name;
        }

        const sortiert = liste => liste.slice().sort(
            (a, b) =>
                a.chip.localeCompare(b.chip) ||
                a.geraet.localeCompare(b.geraet) ||
                a.index - b.index
        );

        const sZeilen = [
            [_("Kind"), _("Chip"), _("Label"), _("Reading"),
             _("Used for"), _("Identifier")]
        ];

        for (const s of sortiert(alle.temperatures)) {
            sZeilen.push([
                _("Temperature"),
                s.chip,
                s.label || fuelle(_("Temperature %s"), s.index),
                this._readTemperature(s) + " °C",
                verwendung[s.key] || "-",
                s.key
            ]);
        }

        for (const s of sortiert(alle.fans)) {
            sZeilen.push([
                _("Fan"),
                s.chip,
                s.label || fuelle(_("Fan %s"), s.index),
                this._readFan(s) + " rpm",
                verwendung[s.key] || "-",
                s.key
            ]);
        }

        // Spalte 3 ist der Messwert und steht rechtsbuendig.
        for (const z of tabelle(sZeilen, [3]))
            zeilen.push(z);

        zeilen.push("");
        zeilen.push(_("Reading: measured while this report was written."));
        zeilen.push(_("Identifier: what the sensor choice in the settings " +
                      "stores. Where a device reports a serial number it is " +
                      "used, so the choice still finds the same device after " +
                      "a restart, even if the kernel numbers the devices " +
                      "differently."));

        return zeilen.join("\n") + "\n";
    }

    _describeBattery(battery) {
        if (!battery || !battery.path)
            return _("not found (system without battery)");

        return (
            battery.path +
            " / AC: " +
            (battery.acPath || _("none"))
        );
    }

    _describe(sensor) {
        if (!sensor)
            return _("not found");

        return (
            sensor.chip +
            " / " +
            (sensor.label || _("unlabeled")) +
            " / " +
            sensor.path
        );
    }
};
