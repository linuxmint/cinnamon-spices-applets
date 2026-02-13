# Translations

Helping with translating the applet is much appreciated. The project provides a template `.pot` file which can be used to translate the applet into new languages.

See: [Translating](#translating)

## Reusing Existing Translations

The applet is based on the Fish applet for GNOME and MATE. Most of the original text strings were retained. Therefore, the original translations can be reused.

Fish Applet for MATE panel:

- [mate-fish.pot](https://github.com/mate-desktop/mate-panel/blob/master/mate-fish.pot)
- [po translation files](https://github.com/mate-desktop/mate-panel/tree/master/po)

However, there are some deviations (like error handling) in this applet from the original which still require new translations. Furthermore, new features could be added in the future that will need translation as well.

## Available Translations and Their Authors

- Catalan (ca): Odyssey
- German (de): kriegcc
- Spanish (es): haggen88
- French (fr): Claudiux
- Hungarian (hu): bossbob88
- Italian (it): Dragone2
- Dutch (nl): qadzek

[Generated Translation Status Table](https://github.com/linuxmint/cinnamon-spices-applets/blob/translation-status-tables/.translation-tables/tables/fish%40kriegcc.md)

Thank you to everyone who has contributed translations to make this applet available in multiple languages.

## Translating

### Adding New Translations or Adjusting Existing Ones

The applet's translations are located in the directory `files/fish@kriegcc/po/`.
Use translation software that supports the `.pot` format, such as _Poedit_.
Open the `fish@kriegcc.pot` template file in the translation software and create or open a translation.

You can then submit your translation on GitHub by forking [this repo](https://github.com/linuxmint/cinnamon-spices-applets) and making a pull request containing your changes.

### Updating the Template and Testing Translations

Use the script `cinnamon-spices-makepot` provided by the Cinnamon team in the repository's root folder to update the `.pot` template file and install new translations.

Updating the translation template `.pot`:

```sh
./cinnamon-spices-makepot fish@kriegcc
```

Test translations `.po` locally:

```sh
./cinnamon-spices-makepot fish@kriegcc --install
```

More info:

```sh
./cinnamon-spices-makepot --help
```
