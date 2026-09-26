/*
 * aVincePulse
 * Measurement Layer
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
 * Zuständig für die Erfassung und Aufbereitung der Messwerte.
 * Darstellung und UI bleiben in desklet.js bzw. applet.js.
 *
 * Diese Datei ist in Applet und Desklet identisch.
 *
 * Der HardwareDetector wird bewusst nicht hier importiert, sondern
 * beim Erzeugen übergeben. Cinnamon Spices verlangt für Applet und
 * Desklet getrennte Pakete mit eigener UUID; ein fest verdrahteter
 * Importpfad würde die beiden Kopien dieser Datei auseinanderlaufen
 * lassen. Der Pfad steht deshalb nur in desklet.js und applet.js.
 *
 * Netzwerkschnittstelle und Laufwerk fuer den freien Speicherplatz
 * koennen vom Benutzer gewaehlt werden. Ohne Wahl, mit "auto" oder wenn
 * die Wahl nicht vorhanden ist, gilt die Schnittstelle der
 * Standardverbindung bzw. die Systempartition "/".
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


// Dateisystemtypen, die trotz eines Geraets unter /dev kein
// sinnvolles Laufwerk fuer den freien Speicherplatz sind.
const KEIN_LAUFWERK_TYPEN = ["squashfs"];

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

var MeasurementProvider = class MeasurementProvider {
    constructor(hardwareDetector, speedtestRunner) {
        this._hardwareDetector = hardwareDetector;
        this._speedtestRunner = speedtestRunner;

        this._lastRx = null;
        this._lastTx = null;
        this._lastNetTime = null;
        this._lastInterface = null;

        this._lastCpuTotal = null;
        this._lastCpuIdle = null;

        // Auswahl des Benutzers; "auto" verhaelt sich wie bisher.
        this._netzAuswahl = "auto";
        this._laufwerkAuswahl = "auto";

        /*
         * Zuletzt gemessener freier Platz je Pfad (AP26).
         *
         * Gefuellt wird ausschliesslich von _frageLaufwerkAb(), also
         * asynchron. Beschriftungen und Bericht lesen daraus, ohne
         * selbst auf das Dateisystem zuzugreifen.
         */
        this._platzSpeicher = {};
    }

    /*
     * Uebernimmt die gewaehlte Netzwerkschnittstelle (Name wie
     * "wlp2s0") oder "auto". Wirkt ab der naechsten Messung.
     */
    setzeNetzwerkAuswahl(name) {
        this._netzAuswahl =
            typeof name === "string" && /^[A-Za-z0-9_.:@-]+$/.test(name) &&
            name !== "." && name !== ".."
                ? name
                : "auto";
    }

    /*
     * Uebernimmt das gewaehlte Laufwerk (Kennung wie "uuid:...")
     * oder "auto". Wirkt ab der naechsten Messung.
     */
    setzeLaufwerkAuswahl(kennung) {
        this._laufwerkAuswahl =
            typeof kennung === "string" && kennung !== ""
                ? kennung
                : "auto";
    }

    readCpuLoad() {
        try {
            const text = this._readFile("/proc/stat");

            if (!text)
                return "--";

            const line = text.split("\n")[0];
            const parts = line.trim().split(/\s+/);

            if (parts[0] !== "cpu")
                return "--";

            const values = parts.slice(1).map(Number);

            const idle =
                (values[3] || 0) +
                (values[4] || 0);

            const total =
                values.reduce((sum, value) => sum + value, 0);

            if (
                this._lastCpuTotal === null ||
                this._lastCpuIdle === null
            ) {
                this._lastCpuTotal = total;
                this._lastCpuIdle = idle;
                return "--";
            }

            const totalDelta = total - this._lastCpuTotal;
            const idleDelta = idle - this._lastCpuIdle;

            this._lastCpuTotal = total;
            this._lastCpuIdle = idle;

            // Nicht "totalDelta <= 0": NaN <= 0 ist false und liefe
            // durch (Befund P9 aus AP25).
            if (!(totalDelta > 0))
                return "--";

            const load =
                100 * (totalDelta - idleDelta) / totalDelta;

            return String(
                Math.round(Math.max(0, Math.min(100, load)))
            );

        } catch (e) {
            global.logError(e);
            return "--";
        }
    }

    readRamUsage() {
        try {
            const text = this._readFile("/proc/meminfo");

            if (!text)
                return "--";

            const totalMatch =
                text.match(/^MemTotal:\s+(\d+)\s+kB/m);

            const availableMatch =
                text.match(/^MemAvailable:\s+(\d+)\s+kB/m);

            if (!totalMatch || !availableMatch)
                return "--";

            const total = Number(totalMatch[1]);
            const available = Number(availableMatch[1]);

            if (total <= 0)
                return "--";

            const used =
                100 * (total - available) / total;

            return String(
                Math.round(Math.max(0, Math.min(100, used)))
            );

        } catch (e) {
            global.logError(e);
            return "--";
        }
    }

    /*
     * Liest die gespeicherten Speedtest-Werte.
     * Ablage und Format verantwortet speedtest.js.
     */
    readSpeedtestValues() {
        if (!this._speedtestRunner)
            return null;

        return this._speedtestRunner.leseWerte();
    }

    /*
     * Alter des letzten erfolgreichen Speedtests, aufbereitet
     * fuer die Anzeige in einer Messwertzeile.
     */
    readSpeedtestAge(werte) {
        if (!this._speedtestRunner)
            return null;

        return this._speedtestRunner.alterDesErgebnisses(werte);
    }

    readHardwareValues() {
        return this._hardwareDetector.readValues();
    }

    /*
     * Tauscht die Hardwareerkennung gegen eine neu durchgefuehrte aus.
     *
     * Die Erkennung laeuft sonst nur einmal beim Laden. Aendert sich
     * die Hardware oder wird ein Treiber verzoegert geladen, bliebe
     * ein Messwert bis zum naechsten Neustart verschwunden.
     */
    setHardwareDetector(hardwareDetector) {
        this._hardwareDetector = hardwareDetector;
    }

    /*
     * Reicht die Verfuegbarkeit der hardwareabhaengigen Messwerte
     * an die Anzeigeschicht weiter.
     */
    getMetricAvailability() {
        return this._hardwareDetector.getAvailability();
    }

    readNetworkSpeed() {
        const iface = this._aktiveSchnittstelle();

        if (!iface)
            return { down: 0, up: 0 };

        const rxText = this._readFile(
            "/sys/class/net/" + iface + "/statistics/rx_bytes"
        );

        const txText = this._readFile(
            "/sys/class/net/" + iface + "/statistics/tx_bytes"
        );

        // Eine leere Zaehlerdatei liefert "" und nicht null; Number("")
        // waere 0 und ergaebe im naechsten Takt einen Messausschlag in
        // Hoehe des gesamten Zaehlerstands (Befund P6 aus AP25).
        const rx = this._zahlOderNull(rxText);
        const tx = this._zahlOderNull(txText);

        if (rx === null || tx === null)
            return { down: 0, up: 0 };
        const now = GLib.get_monotonic_time() / 1000000;

        if (
            this._lastRx === null ||
            this._lastTx === null ||
            this._lastNetTime === null ||
            this._lastInterface !== iface
        ) {
            this._lastRx = rx;
            this._lastTx = tx;
            this._lastNetTime = now;
            this._lastInterface = iface;

            return { down: 0, up: 0 };
        }

        const elapsed = now - this._lastNetTime;

        let down = 0;
        let up = 0;

        if (elapsed > 0) {
            down = Math.max(
                0,
                (rx - this._lastRx) / elapsed
            );

            up = Math.max(
                0,
                (tx - this._lastTx) / elapsed
            );
        }

        this._lastRx = rx;
        this._lastTx = tx;
        this._lastNetTime = now;
        this._lastInterface = iface;

        return { down, up };
    }

    formatRate(bytesPerSecond) {
        if (bytesPerSecond >= 1024 * 1024 * 1024) {
            return {
                value:
                    (bytesPerSecond /
                    (1024 * 1024 * 1024)).toFixed(1),
                unit: "GB/s"
            };
        }

        if (bytesPerSecond >= 1024 * 1024) {
            return {
                value:
                    (bytesPerSecond /
                    (1024 * 1024)).toFixed(1),
                unit: "MB/s"
            };
        }

        if (bytesPerSecond >= 1024) {
            return {
                value:
                    (bytesPerSecond / 1024).toFixed(1),
                unit: "KB/s"
            };
        }

        return {
            value:
                Math.round(bytesPerSecond).toString(),
            unit: "B/s"
        };
    }

    /*
     * Freier Speicherplatz des gewaehlten Laufwerks, sonst der
     * Systempartition - asynchron (AP26).
     *
     * fertig(frei, anteil): frei in Byte, anteil in Prozent der
     * Groesse fuer die Warnschwellen (AP18). Beides null, wenn der
     * Wert nicht ermittelbar ist.
     *
     * Die Abfrage erfolgt ueber GIO und damit ausschliesslich fuer das
     * Dateisystem, in dem der Pfad liegt. Netzlaufwerke werden
     * weiterhin nicht angeboten: Sie sind auch asynchron keine gute
     * Wahl, weil ein nicht erreichbares Laufwerk bei jedem Takt eine
     * Abfrage offen liesse.
     */
    readStorageAsync(fertig) {
        this._frageLaufwerkAb(this._laufwerk().pfad, (eintrag) => {
            if (!eintrag) {
                fertig(null, null);
                return;
            }

            fertig(
                eintrag.frei,
                eintrag.gesamt
                    ? eintrag.frei / eintrag.gesamt * 100
                    : null
            );
        });
    }

    /*
     * Fragt freien Platz und Groesse eines Dateisystems asynchron ab
     * und legt beides im Zwischenspeicher ab.
     *
     * Bis AP25 lief die Abfrage synchron im Hauptthread. Die
     * Spices-Pruefliste verlangt, synchrone Dateizugriffe "at all
     * costs" zu vermeiden, und der Grund ist hier greifbar: Bei einem
     * haengenden USB- oder Netzlaufwerk fror die Oberflaeche ein -
     * alle drei Sekunden erneut (Befund S1 aus AP25).
     *
     * Beide Werte kommen aus EINEM Aufruf. Vorher fragten
     * readStorageFree() und readStorageFreeAnteil() getrennt ab, also
     * zweimal je Takt und zweimal ueber _laufwerk() (Befund P14).
     *
     * fertig(eintrag) wird in jedem Fall gerufen, auch bei einem
     * Fehler; der Eintrag ist dann null.
     */
    _frageLaufwerkAb(pfad, fertig) {
        const melde = (eintrag) => {
            this._platzSpeicher[pfad] = eintrag;

            if (fertig)
                fertig(eintrag);
        };

        try {
            Gio.File.new_for_path(pfad).query_filesystem_info_async(
                "filesystem::free,filesystem::size",
                GLib.PRIORITY_DEFAULT,
                null,
                (datei, ergebnis) => {
                    try {
                        melde(this._platzAusInfo(
                            datei.query_filesystem_info_finish(ergebnis)));
                    } catch (e) {
                        melde(null);
                    }
                }
            );
        } catch (e) {
            melde(null);
        }
    }

    /*
     * Wertet das Ergebnis einer Dateisystemabfrage aus.
     * Rueckgabe { frei, gesamt } in Byte, oder null.
     */
    _platzAusInfo(info) {
        if (!info)
            return null;

        // get_attribute_uint64() liefert 0, wenn das Attribut nicht
        // gesetzt werden konnte; bei einem vorzeichenlosen Wert ist
        // "free < 0" nie wahr. Ohne has_attribute() erschiene ein
        // Dateisystem ohne statvfs als "0 B frei" (Befund P2).
        if (!info.has_attribute("filesystem::free"))
            return null;

        const frei = info.get_attribute_uint64("filesystem::free");

        if (!Number.isFinite(frei) || frei < 0)
            return null;

        const gesamt = info.has_attribute("filesystem::size")
            ? info.get_attribute_uint64("filesystem::size")
            : 0;

        return {
            frei: frei,
            gesamt: Number.isFinite(gesamt) && gesamt > 0 ? gesamt : null
        };
    }

    /*
     * Fuellt den Zwischenspeicher fuer alle eingehaengten Laufwerke
     * und ruft danach fertig().
     *
     * Gebraucht von den Beschriftungen des Auswahlfeldes und vom
     * Hardwarebericht: Beide nennen den freien Platz jedes Laufwerks,
     * und beide duerfen dafuer die Oberflaeche nicht anhalten.
     */
    aktualisiereLaufwerkPlatz(fertig) {
        const pfade = this._laufwerke().map(l => l.pfad);

        // Die Systempartition steht in der Beschriftung von
        // "Automatisch (...)", auch wenn sie nicht in der Liste ist.
        if (pfade.indexOf("/") === -1)
            pfade.push("/");

        let offen = pfade.length;

        if (offen === 0) {
            if (fertig)
                fertig();
            return;
        }

        for (const pfad of pfade)
            this._frageLaufwerkAb(pfad, () => {
                if (--offen === 0 && fertig)
                    fertig();
            });
    }

    /*
     * Zuletzt gemessener freier Platz eines Pfades in Byte, ohne
     * jeden Zugriff auf das Dateisystem.
     *
     * null, solange fuer diesen Pfad noch keine Abfrage zurueck ist;
     * formatSize() macht daraus "--". Wer einen sicher belegten Wert
     * braucht, ruft vorher aktualisiereLaufwerkPlatz().
     */
    _platzAusSpeicher(pfad) {
        const eintrag = this._platzSpeicher[pfad];

        return eintrag ? eintrag.frei : null;
    }

    /*
     * Formatiert eine Byte-Angabe als Speichergroesse.
     * Die Einheit wird automatisch gewaehlt.
     */
    formatSize(bytes) {
        if (bytes === null || !Number.isFinite(bytes)) {
            return {
                value: "--",
                unit: "GB"
            };
        }

        if (bytes >= 1024 * 1024 * 1024 * 1024) {
            return {
                value:
                    (bytes /
                    (1024 * 1024 * 1024 * 1024)).toFixed(1),
                unit: "TB"
            };
        }

        if (bytes >= 1024 * 1024 * 1024) {
            return {
                value:
                    (bytes /
                    (1024 * 1024 * 1024)).toFixed(1),
                unit: "GB"
            };
        }

        return {
            value:
                (bytes / (1024 * 1024)).toFixed(0),
            unit: "MB"
        };
    }

    /*
     * Wandelt einen Rohwert aus /proc oder /sys in eine Zahl um.
     *
     * Number() allein genuegt nicht: Number(null), Number(""),
     * Number(false) und Number([]) ergeben jeweils 0 und sind endlich.
     * Ein fehlender oder leerer Wert erschiene damit als gueltige Null
     * (Befund P6 aus AP25, dieselbe Falle wie in AP22).
     */
    _zahlOderNull(rohwert) {
        if (typeof rohwert !== "string" || rohwert.trim() === "")
            return null;

        const zahl = Number(rohwert);

        return Number.isFinite(zahl) ? zahl : null;
    }

    _readFile(path) {
        try {
            const result = GLib.file_get_contents(path);

            if (!result[0])
                return null;

            return ByteArray.toString(result[1]).trim();
        } catch (e) {
            return null;
        }
    }

    /*
     * Schnittstelle der Standardverbindung ins Internet.
     *
     * Gelesen aus /proc/net/route statt ueber "ip route": Bisher wurde
     * dafuer bei jedem Takt ein eigenes Programm gestartet. Gibt es
     * mehrere Standardrouten, gilt die mit der kleinsten Metrik, wie
     * bei "ip route".
     */
    _getDefaultInterface() {
        const text = this._readFile("/proc/net/route");

        if (!text)
            return null;

        let beste = null;
        let besteMetrik = Infinity;

        for (const zeile of text.split("\n").slice(1)) {
            const teile = zeile.trim().split(/\s+/);

            if (teile.length < 8)
                continue;

            const ziel = teile[1];
            const flags = parseInt(teile[3], 16);
            const metrik = Number(teile[6]);
            const maske = teile[7];

            // Standardroute: Ziel und Maske 0, Route aktiv (RTF_UP).
            if (ziel !== "00000000" || maske !== "00000000" || !(flags & 0x1))
                continue;

            if (metrik < besteMetrik) {
                beste = teile[0];
                besteMetrik = metrik;
            }
        }

        return beste;
    }

    /*
     * Gemessene Schnittstelle: die gewaehlte, sofern vorhanden,
     * sonst die der Standardverbindung.
     */
    _aktiveSchnittstelle() {
        if (
            this._netzAuswahl !== "auto" &&
            GLib.file_test(
                "/sys/class/net/" + this._netzAuswahl,
                GLib.FileTest.EXISTS
            )
        )
            return this._netzAuswahl;

        return this._getDefaultInterface();
    }

    /*
     * Alle Netzwerkschnittstellen ausser der internen (lo), mit Art
     * und Zustand. Virtuelle Schnittstellen werden mit aufgefuehrt,
     * da darunter auch VPN-Verbindungen fallen.
     */
    _schnittstellen() {
        const liste = [];

        try {
            const verzeichnis = Gio.File.new_for_path("/sys/class/net");
            const enumerator = verzeichnis.enumerate_children(
                "standard::name",
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info;

            while ((info = enumerator.next_file(null)) !== null) {
                const name = info.get_name();

                if (name === "lo")
                    continue;

                const basis = "/sys/class/net/" + name;

                liste.push({
                    name: name,
                    art: this._schnittstellenArt(name, basis),
                    verbunden: this._istVerbunden(basis)
                });
            }

            enumerator.close(null);

        } catch (e) {
            global.logError(e);
        }

        return liste.sort((a, b) => a.name.localeCompare(b.name));
    }

    _schnittstellenArt(name, basis) {
        const vorhanden = pfad =>
            GLib.file_test(basis + pfad, GLib.FileTest.EXISTS);

        const uevent = this._readFile(basis + "/uevent") || "";

        if (vorhanden("/wireless") || vorhanden("/phy80211"))
            return _("WLAN");

        if (/DEVTYPE=wwan/.test(uevent) || name.startsWith("ww"))
            return _("Mobile broadband");

        if (
            this._readFile(basis + "/type") === "65534" ||
            /DEVTYPE=wireguard/.test(uevent) ||
            /^(tun|tap|wg|ppp|vpn)/.test(name)
        )
            return _("VPN");

        // Ohne zugehoeriges Geraet ist die Schnittstelle rein virtuell,
        // etwa eine Bruecke fuer virtuelle Maschinen oder Docker.
        if (!vorhanden("/device"))
            return _("virtual");

        return _("LAN");
    }

    /*
     * VPN-Schnittstellen melden als Zustand haeufig "unknown", auch
     * wenn sie aktiv sind. Dann entscheiden die Flags UP und RUNNING.
     */
    _istVerbunden(basis) {
        const zustand = this._readFile(basis + "/operstate");

        if (zustand === "up")
            return true;

        if (zustand !== "unknown")
            return false;

        const flags = parseInt(this._readFile(basis + "/flags") || "0", 16);

        return (flags & 0x41) === 0x41;
    }

    /*
     * Angebot fuer das Auswahlfeld der Netzwerkschnittstelle in der
     * Form { Anzeigetext: Name }, wie Cinnamon sie erwartet.
     */
    getNetzwerkOptionen(aktuelleWahl) {
        const optionen = {};
        const liste = this._schnittstellen();
        const standard = this._getDefaultInterface();
        const beschreibe = s => s.name + " – " + s.art;

        const std = liste.find(s => s.name === standard);

        optionen[
            fuelle(
                _("Automatic (%s)"),
                std ? beschreibe(std) : _("no connection at the moment")
            )
        ] = "auto";

        for (const s of liste) {
            let text = beschreibe(s) + "  ·  " +
                (s.verbunden ? _("connected") : _("disconnected"));

            while (text in optionen)
                text += " ";

            optionen[text] = s.name;
        }

        if (
            aktuelleWahl &&
            aktuelleWahl !== "auto" &&
            !liste.some(s => s.name === aktuelleWahl)
        )
            optionen[fuelle(_("Not found: %s"), aktuelleWahl)] = aktuelleWahl;

        return optionen;
    }

    /*
     * Alle lokal eingehaengten Laufwerke.
     *
     * Beruecksichtigt werden nur Dateisysteme auf einem Geraet unter
     * /dev. Netzlaufwerke, tmpfs, proc und aehnliche fallen dadurch
     * heraus, ebenso eingehaengte Programmpakete (squashfs auf
     * /dev/loop).
     *
     * Kennung ist die UUID des Dateisystems. Ein USB-Stick wird so
     * wiedererkannt, auch wenn er beim naechsten Mal an anderer
     * Stelle eingehaengt wird. Ist mehrfach dasselbe Dateisystem
     * eingehaengt, zaehlt der erste Einhaengeort.
     */
    _laufwerke() {
        const text = this._readFile("/proc/self/mounts") || "";
        const uuids = this._uuidsNachGeraet();
        const liste = [];
        const vorhanden = {};

        for (const zeile of text.split("\n")) {
            const teile = zeile.split(" ");

            if (teile.length < 3)
                continue;

            const geraet = this._entschluessele(teile[0]);
            const pfad = this._entschluessele(teile[1]);
            const typ = teile[2];

            if (
                !geraet.startsWith("/dev/") ||
                geraet.startsWith("/dev/loop") ||
                KEIN_LAUFWERK_TYPEN.includes(typ)
            )
                continue;

            const kern = this._kernelName(geraet);
            const kennung = uuids[kern]
                ? "uuid:" + uuids[kern]
                : "dev:" + kern;

            if (vorhanden[kennung])
                continue;

            vorhanden[kennung] = true;

            liste.push({
                kennung: kennung,
                pfad: pfad,
                geraet: GLib.path_get_basename(geraet),
                typ: typ
            });
        }

        return liste;
    }

    /*
     * Kernelname der gemessenen Partition, etwa "nvme0n1p2", oder "".
     *
     * Die Hardwareerkennung braucht ihn, um den Temperatursensor
     * desselben Laufwerks zu waehlen (Befund B1 aus AP25).
     */
    laufwerkGeraet() {
        const l = this._laufwerk();

        if (l.geraet)
            return l.geraet;

        // Der Rueckfall nennt nur den Pfad; das Geraet dazu steht in
        // der Laufwerksliste.
        const eintrag = this._laufwerke().find(k => k.pfad === l.pfad);

        return eintrag ? eintrag.geraet : "";
    }

    /*
     * Gemessenes Laufwerk: das gewaehlte, sofern eingehaengt,
     * sonst die Systempartition.
     */
    _laufwerk() {
        if (this._laufwerkAuswahl !== "auto") {
            const gewaehlt = this._laufwerke()
                .find(l => l.kennung === this._laufwerkAuswahl);

            if (gewaehlt)
                return gewaehlt;
        }

        return { kennung: "auto", pfad: "/" };
    }

    getLaufwerkOptionen(aktuelleWahl) {
        const optionen = {};
        const liste = this._laufwerke();
        const beschreibe = l =>
            l.pfad + " – " + l.geraet + "  ·  " + l.typ +
            "  ·  " + this._platzText(l.pfad);

        const system = liste.find(l => l.pfad === "/");

        optionen[
            fuelle(
                _("Automatic (%s)"),
                system
                    ? "/ – " + system.geraet + ", " + this._platzText("/")
                    : "/"
            )
        ] = "auto";

        for (const l of liste) {
            let text = beschreibe(l);

            while (text in optionen)
                text += " ";

            optionen[text] = l.kennung;
        }

        if (
            aktuelleWahl &&
            aktuelleWahl !== "auto" &&
            !liste.some(l => l.kennung === aktuelleWahl)
        )
            optionen[fuelle(_("Not mounted: %s"), aktuelleWahl)] = aktuelleWahl;

        return optionen;
    }

    _platzText(pfad) {
        const groesse = this.formatSize(this._platzAusSpeicher(pfad));

        return fuelle(_("%s %s free"), groesse.value, groesse.unit);
    }

    // Kernelname eines Geraets, etwa "dm-0" fuer /dev/mapper/...
    _kernelName(geraet) {
        try {
            return GLib.path_get_basename(GLib.file_read_link(geraet));
        } catch (e) {
            return GLib.path_get_basename(geraet);
        }
    }

    // Zuordnung Kernelname -> Dateisystem-UUID.
    _uuidsNachGeraet() {
        const zuordnung = {};

        try {
            const verzeichnis = Gio.File.new_for_path("/dev/disk/by-uuid");
            const enumerator = verzeichnis.enumerate_children(
                "standard::name",
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                null
            );

            let info;

            while ((info = enumerator.next_file(null)) !== null) {
                const uuid = info.get_name();

                try {
                    const ziel = GLib.file_read_link(
                        "/dev/disk/by-uuid/" + uuid
                    );

                    zuordnung[GLib.path_get_basename(ziel)] = uuid;
                } catch (e) {
                    // Eintrag ohne lesbares Ziel: uebergehen.
                }
            }

            enumerator.close(null);

        } catch (e) {
            // Ohne by-uuid wird das Geraet selbst als Kennung verwendet.
        }

        return zuordnung;
    }

    // /proc/self/mounts schreibt Leerzeichen und aehnliches oktal (\040).
    _entschluessele(text) {
        return text.replace(
            /\\([0-7]{3})/g,
            (treffer, oktal) => String.fromCharCode(parseInt(oktal, 8))
        );
    }

    /*
     * Berichtsteil ueber Netzwerkschnittstellen und Laufwerke,
     * angehaengt an den Hardwarebericht.
     */
    /*
     * Hardwarebericht, asynchron (AP26).
     *
     * Der Bericht nennt den freien Platz jedes Laufwerks. Die Werte
     * werden vorher frisch geholt, damit dort nichts Veraltetes und
     * kein "--" steht - anders als bei den Beschriftungen des
     * Auswahlfeldes, die eine Sekunde alte Angabe vertragen.
     */
    berichtTextAsync(fertig) {
        this.aktualisiereLaufwerkPlatz(() => fertig(this.berichtText()));
    }

    berichtText() {
        const zeilen = [];
        const aktiv = this._aktiveSchnittstelle();

        const herkunft = (auswahl, gefunden) =>
            auswahl === "auto"
                ? _("automatic")
                : gefunden
                    ? _("selected manually")
                    : fuelle(_("automatic – %s was selected but is absent"),
                             auswahl);

        const ueberschrift = _("Network interfaces");

        zeilen.push("");
        zeilen.push(ueberschrift);
        zeilen.push(unterstreiche(ueberschrift));
        zeilen.push(fuelle(
            _("Measured: %s  (%s)"),
            aktiv || _("none"),
            herkunft(this._netzAuswahl, aktiv === this._netzAuswahl)
        ));
        zeilen.push("");

        const netzZeilen = [
            [_("Name"), _("Type"), _("State"), _("Used for")]
        ];

        for (const s of this._schnittstellen()) {
            netzZeilen.push([
                s.name,
                s.art,
                s.verbunden ? _("connected") : _("disconnected"),
                s.name === aktiv ? "DOWN/UP" : "-"
            ]);
        }

        for (const z of tabelle(netzZeilen))
            zeilen.push(z);

        const laufwerk = this._laufwerk();
        const ueberschrift2 = _("Drives (mounted locally)");

        zeilen.push("");
        zeilen.push(ueberschrift2);
        zeilen.push(unterstreiche(ueberschrift2));
        zeilen.push(fuelle(
            _("Measured: %s  (%s)"),
            laufwerk.pfad,
            herkunft(this._laufwerkAuswahl,
                     laufwerk.kennung === this._laufwerkAuswahl)
        ));
        zeilen.push("");

        const lwZeilen = [
            [_("Mount point"), _("Device"), _("Type"), _("Free"),
             _("Used for"), _("Identifier")]
        ];

        for (const l of this._laufwerke()) {
            const platz = this.formatSize(this._platzAusSpeicher(l.pfad));

            lwZeilen.push([
                l.pfad,
                l.geraet,
                l.typ,
                platz.value + " " + platz.unit,
                l.pfad === laufwerk.pfad ? "FREE" : "-",
                l.kennung
            ]);
        }

        // Spalte 3 ist die Groessenangabe und steht rechtsbuendig.
        for (const z of tabelle(lwZeilen, [3]))
            zeilen.push(z);

        zeilen.push("");
        zeilen.push(_("Network shares are deliberately not offered: the " +
                      "query runs on every tick, and a share that cannot " +
                      "be reached could block the interface."));

        return zeilen.join("\n") + "\n";
    }
};

/*
 * Mindestabstand zur naechsten Taktmarke in Millisekunden.
 *
 * Ein Zeitgeber kann einige Millisekunden vor der Marke ausloesen.
 * Laege die naechste Marke dann nur wenige Millisekunden entfernt,
 * folgte sofort ein zweiter Takt. Unterhalb dieses Abstands gilt
 * deshalb die uebernaechste Marke.
 */
var TAKT_MINDESTABSTAND_MS = 200;

/*
 * Millisekunden bis zur naechsten Taktmarke auf der Systemuhr.
 *
 * Taktmarken sind die vollen Vielfachen des Intervalls, bei 3 Sekunden
 * also :00, :03, :06 und so weiter. Applet und Desklet richten sich
 * dadurch nach derselben Uhr und messen bei gleichem Intervall im
 * selben Moment, ohne voneinander zu wissen. Bisher lief jeder Takt
 * ab dem eigenen Startzeitpunkt, beide lagen bis zu ein Intervall
 * auseinander.
 *
 * Die Marke wird bei jedem Takt neu berechnet. Verzoegerungen des
 * Zeitgebers summieren sich dadurch nicht auf.
 *
 * jetztMs ist nur fuer Tests vorgesehen.
 */
function msBisZumNaechstenTakt(intervallSekunden, jetztMs) {
    const intervall =
        Math.max(1, Math.round(Number(intervallSekunden) || 3)) * 1000;

    const jetzt =
        jetztMs === undefined ? Date.now() : jetztMs;

    let rest = intervall - (jetzt % intervall);

    if (rest < TAKT_MINDESTABSTAND_MS)
        rest += intervall;

    return rest;
}
