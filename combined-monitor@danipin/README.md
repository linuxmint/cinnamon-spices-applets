# Combined Monitor Applet für Cinnamon
> Systemüberwachung von CPU, RAM und SWAP in einem einzigen, kompakten Panel-Element.
> UUID: combined-monitor@danipin

## 🖥️ Funktionen
Dieses Applet bietet eine umfassende Übersicht über die Systemauslastung direkt in Ihrer Cinnamon-Leiste.

* **Kompakte Anzeige:** Zeigt CPU-, RAM- und SWAP-Auslastung (%) in einem Element.
* **Visuelle Schwellwerte:** Frei konfigurierbare Farbregeln (LOW, MED, HIGH, CRITICAL) zur visuellen Warnung.
* **Anpassbares Layout:** Die Reihenfolge der Metriken (z.B. CPU | RAM | SWAP) kann über die Einstellungen oder durch Scrollen mit dem Mausrad über das Applet gewechselt werden.
* **Flexibles Design:** Unterstützt Textlabels, Theme-Icons oder die Verwendung eigener SVG/PNG-Symbole, um das Applet perfekt in das Desktop-Theme zu integrieren.
* **Einstellbares Trennzeichen:** Konfigurieren Sie das Trennzeichen und dessen Farbe (Standard ist `|`).
* **SWAP-Option:** Kann so eingestellt werden, dass SWAP nur angezeigt wird, wenn es tatsächlich genutzt wird (> 0%).

## ⚙️ Installation

### 1. Manuelle Installation

1.  Laden Sie das Applet-Archiv (z.B. von GitHub) herunter und entpacken Sie es. Der entstandene Ordner heißt z.B. `cinnamon-combined-monitor-main`.

2.  **❗ WICHTIG – Ordner umbenennen ❗**
    Der Ordner muss für Cinnamon **zwingend** in den Namen der Applet-UUID umbenannt werden: **`combined-monitor@danipin`**

3.  Kopieren Sie den **umbenannten Ordner** in Ihr lokales Cinnamon-Applet-Verzeichnis:

    ```bash
    cp -r combined-monitor@danipin ~/.local/share/cinnamon/applets/
    ```

4.  **Cinnamon neu starten** (entweder durch Abmelden/Anmelden oder mit der Tastenkombination `Alt` + `F2`, gefolgt von `r` und `Enter`).

5.  Fügen Sie das Applet über die **Systemeinstellungen -> Applets** zur Leiste hinzu.

### 2. Installation über Cinnamon Spices (Zukünftig)

Sobald das Applet von Cinnamon genehmigt wurde, können Sie es direkt über die Applet-Verwaltung in Ihren Systemeinstellungen installieren.

## 🛠️ Benutzung & Konfiguration

* **Linksklick auf das Applet:** Öffnet ein Kontextmenü zur schnellen Auswahl von **Trennzeichen**-Voreinstellungen und **Symbol**-Icons (inklusive Vorschau).
* **Mausrad über dem Applet:** Ändert schnell die **Layout-Variante** (z.B. von CPU | RAM | SWAP zu RAM | CPU | SWAP).
* **Rechtsklick auf das Applet:** Öffnet das **Konfigurationsmenü** mit allen detaillierten Optionen.

## 📜 Lizenz
Dieses Applet ist unter der MIT-Lizenz veröffentlicht.
