# Display Scale

Size slider for font and layout scaling, optionally combined with variable screen scaling.

Display Scale puts a **100–200% size slider** in the Cinnamon panel. Choose **Aa** for text scaling, which also enlarges layouts that follow the text size. Choose the **screen icon** to combine Cinnamon's screen scaling levels with text scaling, so you can select the text size and control when the rest of the desktop grows with it.

## Install and use

1. In **System Settings → Applets → Download**, find and download **Display Scale**. In **Manage**, add it to the panel.
2. Open the applet, choose a mode and drag the slider. It applies when you release it. You can also hold the initial press on the panel icon, move to the slider or a mode button and release there. Escape cancels a drag.
3. Open the applet's settings from its panel icon to change the increment, set custom steps or choose the startup mode. To move the point at which the next screen scaling level takes effect, drag the shaded band or use the **Scaling** tab. See the [settings screenshot](images/settings.png).

The menu closes before a scaling change. It stays open if releasing the slider or switching modes leaves the effective scaling unchanged. For the shaded band, **Keep menu open** controls this separately.

The switch point can be set up to half a step earlier or later. A later point lets the text grow further before the next screen step kicks in. With a suitable monitor and switch point, for example, text can be at 160% while the screen is at 125%. The **Menu** tab controls shading, scale marks and tooltips. **Cinnamon** shows the same picture layout setting as the background settings.

For Onboard, choose whether to keep its visible size and position or to adapt scaling to the keyboard's share of the desktop. Switch off the adjustment to let Onboard follow normal screen scaling.

**Optional:** Download and enable **Display Scale - Additional Features** in **System Settings → Extensions** if you want to keep the panel size or adjust desklet and OSD150 positions. These controls are in the applet under **Scaling → Additional Features**. The slider and the Onboard keyboard options work without the extension.

**Compatibility:** Tested with LMDE 7, Cinnamon 6.6.9 and X11. Screen scaling requires one active, unrotated display and uses the scaling levels Cinnamon offers for it. Wayland is unsupported. Onboard adjustments are for a running, freely positioned Onboard keyboard.

## Deutsch: Darstellungsgröße

Größenregler für Schrift- und Layoutvergrößerung, wahlweise mit zusätzlicher variabler Bildschirmvergrößerung.

Unter **Systemeinstellungen → Applets → Herunterladen** nach **Darstellungsgröße** suchen und das Applet herunterladen. Danach unter **Verwalten** zur Leiste hinzufügen. Das Leistensymbol öffnet den Regler für 100–200 %. **Aa** ändert die Schriftgröße und die davon abhängigen Layouts. Das **Bildschirmsymbol** kombiniert Cinnamons Bildschirmstufen mit Textvergrößerung.

Den Regler ziehen und loslassen. Alternativ das Leistensymbol gedrückt halten und direkt über dem Regler oder einem Modusknopf loslassen. Escape bricht das Ziehen ab. Ändert sich die Skalierung nicht, bleibt das Menü beim Loslassen oder Moduswechsel offen. Für das schattierte Band gilt separat **Menü offenhalten**.

Über das Kontextmenü des Leistensymbols lassen sich Schrittweite, eigene Stufen und Startmodus einstellen. Im Reiter **Skalierung** oder durch Ziehen am schattierten Band kann der Wechselpunkt um bis zu eine halbe Stufe vor- oder zurückverlegt werden. Mit einem späteren Wechselpunkt wächst die Schrift länger, bevor die nächste Bildschirmstufe einsetzt. Je nach Bildschirm und Wechselpunkt sind etwa 160 % Schriftgröße bei 125 % Bildschirmvergrößerung möglich. **Menü** bündelt Schattierung, Skalenstriche und Tooltips. **Cinnamon** zeigt dieselbe Einstellung fürs Bildformat wie der Hintergrunddialog.

Bei Onboard lässt sich die sichtbare Größe und Position der Tastatur beibehalten oder die Vergrößerung an ihre Größe im Verhältnis zur Arbeitsfläche anpassen. Ist die Anpassung aus, folgt Onboard der normalen Bildschirmvergrößerung.

Für den Ausgleich von Leiste, Desklets und OSD150 unter **Systemeinstellungen → Erweiterungen** die optionale Erweiterung **Darstellungsgröße – Zusatzfunktionen** herunterladen und aktivieren. Die Optionen erscheinen im Applet unter **Skalierung → Zusatzfunktionen**. Regler und Onboard-Anpassung funktionieren auch ohne die Erweiterung.

Getestet auf LMDE 7 mit Cinnamon 6.6.9 unter X11. Die Bildschirmvergrößerung setzt einen einzelnen aktiven, ungedrehten Bildschirm voraus. Wayland wird nicht unterstützt. Die Onboard-Anpassung gilt für die laufende, frei positionierte Bildschirmtastatur.

---

By rasmarc. Based on **uiscaler** by joka42, originally based on **Resolution Switcher** by dennis@nixdev.com. GPL-2.0-or-later. Interface available in 16 languages.
