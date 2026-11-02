# Relay Switches — Cinnamon-Applet

[English](README.md)

Applet für die Leiste, das HTTP-Relaisboards schaltet (Steckdosen,
Kaffeemaschine, Drucker, …). Ein Klick öffnet ein Menü mit den konfigurierten
Schaltern und liest den echten Zustand vom Board zurück.

![Menü](screenshot.png)

## Funktionen

- Beliebig viele Schalter mit eigenem Namen, Symbol, Hosts und Pfaden.
- Mehrere Hosts pro Schalter werden gemeinsam geschaltet, z. B. eine
  Steckdosenleiste auf zwei Boards.
- Gruppen fassen mehrere Schalter zu einem zusätzlichen Schalter zusammen.
- Echter Status: der Status-Pfad wird gelesen, statt den Zustand zu raten.
- Symbol in der Leiste, optional Zähler (`2/4`) oder die Namen der aktiven Schalter.
- Regelmäßige Statusabfrage, optional Benachrichtigung, wenn ein Gerät nicht antwortet.
- CLI `relayctl` für Scripts, Hotkeys und Cron; sie liest die exportierte
  Konfiguration und läuft ohne Cinnamon.
- Oberfläche auf Deutsch und Englisch.

## Sprachen

Die Oberfläche gibt es auf Deutsch und Englisch. Englisch ist die
Quellsprache, Deutsch kommt aus `po/de.po`; die Sprache folgt der
Desktop-Locale, im Applet gibt es keinen Umschalter.

Für eine weitere Sprache `po/de.po` nach `po/<sprache>.po` kopieren, die
`msgstr`-Werte übersetzen und die `msgfmt`-Schleife aus der Installation erneut
ausführen (`xgettext`/`msgmerge` erzeugen die String-Liste nach Änderungen neu).

## Installation

In Cinnamon: **Systemeinstellungen → Applets → Herunterladen** → *Relay
Switches*, danach im Tab **Verwalten** hinzufügen.

Aus dem Quellcode (die Applet-Dateien liegen im Wurzelverzeichnis des Repositorys):

```bash
git clone https://github.com/ravelzh/ravel-cyber-pulse-cinnamon-relay-switches.git
cd ravel-cyber-pulse-cinnamon-relay-switches

# Applet-Dateien
install -d ~/.local/share/cinnamon/applets/relay-switches@ravel
install -m 644 metadata.json applet.js settings-schema.json icon.png \
        ~/.local/share/cinnamon/applets/relay-switches@ravel/

# Übersetzungen (braucht gettext)
for po in po/*.po; do
    lang="$(basename "$po" .po)"
    install -d "$HOME/.local/share/locale/$lang/LC_MESSAGES"
    msgfmt -o "$HOME/.local/share/locale/$lang/LC_MESSAGES/relay-switches@ravel.mo" "$po"
done

# optional: CLI
install -Dm 755 relayctl ~/.local/bin/relayctl
```

Cinnamon neu laden (oder neu anmelden):

```bash
dbus-send --session --dest org.Cinnamon --object-path /org/Cinnamon \
  --type=method_call org.Cinnamon.Eval string:'global.reexec_self()'
```

Danach das Applet hinzufügen: Rechtsklick auf die Leiste → **Applets** →
**Relay Switches**.

## Konfiguration

Rechtsklick auf das Applet → **Konfigurieren**. Nach einer frischen Installation
ist die Schalterliste leer, die Schalter werden dort eingetragen.

| Seite | Optionen |
| --- | --- |
| Schalter | Name, Symbol, Host(s), Ein-/Aus-/Status-Pfad pro Schalter; Gruppen |
| Leiste | Text neben dem Symbol, Leisten-Symbol, Symbol wenn etwas an ist, Aktion bei Mittelklick |
| Verhalten | Abfrageintervall, Benachrichtigungen, „Alle einschalten“/„Alle ausschalten“ im Menü, HTTP-Zeitlimit |

Ein Schalter braucht einen Namen und mindestens einen Host. Die Pfade sind mit
`/relay?state=1`, `/relay?state=0` und `/relay` vorbelegt, bei üblichen
Relaisboards muss also nur der Host eingetragen werden:

| Name | Symbol | Host(s) | Ein | Aus | Status |
| --- | --- | --- | --- | --- | --- |
| Kaffee | coffee-symbolic | 192.168.1.50 | /relay?state=1 | /relay?state=0 | /relay |

Mehrere Hosts werden mit Komma getrennt, erlaubt sind IP-Adressen oder URLs
(`http://board.local:8080`). Gruppen sind Zeilen auf derselben Seite und
verweisen auf Schalternamen, z. B. *Media* = `TV, Verstärker`.

![Einstellungen](settings.png)

## Status-Format

Die Antwort des Status-Pfads darf JSON sein (`{"on": true}`), ein reiner Wert
(`true`, `false`, `1`, `0`, `on`, `off`) oder ein JSON-Objekt mit einem der
Schlüssel `on`, `state`, `relay`, `power`, `status`.

Ein Schalter mit mehreren Hosts ist nur an, wenn alle Hosts „an“ melden;
antwortet einer nicht, gilt der Schalter als *offline*. Schalten lässt er sich
trotzdem.

## CLI

`relayctl` liest die Konfiguration, die das Applet nach
`~/.config/cinnamon/spices/relay-switches@ravel/switches.json` exportiert; die
Datei wird bei jeder Änderung der Konfiguration neu geschrieben. Die CLI selbst
braucht weder Cinnamon noch zusätzliche Pakete:

```bash
relayctl list
relayctl status
relayctl on Kaffee
relayctl off Media
relayctl toggle Drucker
relayctl all-off
```

Namen werden zuerst exakt, dann als eindeutiger Teilstring gesucht.
Gruppennamen werden auf ihre Mitglieder aufgelöst. Rückgabewert ist `1`, wenn
ein Gerät nicht erreichbar war. Die Ausgabe ist englisch, das Applet selbst
folgt der Desktop-Locale.

Wurde das Applet aus dem Store installiert, liegt `relayctl` im Applet-Verzeichnis
und braucht das Ausführungsrecht:

```bash
chmod +x ~/.local/share/cinnamon/applets/relay-switches@ravel/relayctl
~/.local/share/cinnamon/applets/relay-switches@ravel/relayctl status
```

## Deinstallation

```bash
rm -rf ~/.local/share/cinnamon/applets/relay-switches@ravel \
       ~/.config/cinnamon/spices/relay-switches@ravel \
       ~/.local/share/locale/*/LC_MESSAGES/relay-switches@ravel.mo
rm -f ~/.local/bin/relayctl            # nur wenn die CLI installiert wurde
```

## Hinweise

- Benötigt Cinnamon 5.8 oder neuer.
- HTTP-Anfragen laufen über `curl` (asynchron, ohne Shell).
- Symbolische Symbolnamen enden auf `-symbolic` und folgen der Leistenfarbe.
- Nach Änderungen an den Applet-Dateien Cinnamon neu laden (Alt+F2, `r`, Enter).

## Lizenz

GPL-3.0
