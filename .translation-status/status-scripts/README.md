# Scripts, which create translation status tables in markdown

## Results:
1. Translation status for each spice (applet,desklet,extension), e.g. [Status of Weather Applet](https://github.com/NikoKrause/cinnamon-spices-applets/blob/applets-translation-status/.translation-status/applets-status/weather%40mockturtl/README.md)
2. Translation status for each language, e.g. [French Status](https://github.com/NikoKrause/cinnamon-spices-applets/blob/applets-translation-status/.translation-status/language-status/fr.md)
3. [Translation status of all applets by language](https://github.com/NikoKrause/cinnamon-spices-applets/blob/applets-translation-status/.translation-status/README.md)

## How to use:
Run `STATUS.sh` script in Terminal.

## How it works:
**Requirement:** The following directory structure is assumed in the local copy of your cinnamon-spices-(applets/desklets/extensions) repositories (further we use applets for examples, but same holds for desklets and extension)
```
| cinnamon-spices-applets
| | .translation-status
| | | status-scripts
| | | | Language-IDs.txt
| | | | spices-status.sh
| | | | untranslatedpo2md.sh
| | | | language-status.sh
| | | | translation-status.sh
| | | | STATUS.sh
```

### The Language-IDs.txt file
This file stores the information of the known language IDs and their corresponding language name:
```
languageID:languageNAME
fr:French
es:Spanish
```
The scripts are using this file as a *getter function* (id->name).

### The spices-status.sh script
This script (as the others as well) checks first in which Spices repo it is currently running by checking the name of the parent directory `cinnamon-spices-applets`.

It creates a folder `applets-status`, checks which applets in the `cinnamon-spices-applets` directory are translatable, i.e have a `po` folder, and copies those directories to `.translation-status/applets-status/UUID/po/`. From now on only those copied po files are used to get all needed information and to create the tables.

The developer of an applet usually takes care of the translation template (`.pot` file). Therefore the translation files (`.po` files) have to be updated against the template to get the correct number of untranslated strings (using `msgmerge`).

After the translation files have been updated, the untranslated strings are extracted in the directory `.translation-status/applets-status/UUID/untranslated-po/` (using `msgattrib`). *(If everything is translated in a language `ID.po`, no `untranslated-po/ID.po` file is created for this language)*

Now the script scans the `untranslated-po` files and counts the number of untranslated strings.

It writes those informations into a markdown table `.translation-status/applets-status/UUID/README.md`.

**NOTE:** If there exists an `ID.po` file with an `ID`, which is not in the `Language-IDs.txt` file, the script creates the `UNKNOWN-Language-IDs.txt` file. It has to be manually checked, if it's a wrong ID, an unnecessary ID (e.g. `fr_FR` if there is already `fr` for French from France), or a new lanugage, which then has to be added in the `Language-IDs.txt` file.

### The untranslatedpo2md.sh script
It extracts the untranslated strings in `untranslated-po/ID.po` and stores them in `untranslated-po/ID.md`.
The `untranslated-po/ID.po` files are no longer needed and are removed.

### The language-status.sh script
It creates a folder `language-status`. For every language ID in `Language-IDs.txt` file it creates a file `language-status/ID.md`.
For every language ID it does following:
* For every applet in `applet-status` it counts the number of translatable strings in the template `.pot` file. 
* And it gets the number of untranslatable strings from the `README.md` files created by the `spices-status.sh` script.
* Those informations are stored in the `language-status/ID.md` file.
* At the end of the `ID.md` files it add an **Overall statistics** line, which shows the sum of all translatable/untranslated strings of all applets.

### The translation-status.sh script
It creates a `README.md` file in `.translation-status/` directory. It greps the **Overall statistics** lines in the `language-status/ID.md` files and shows them in a table.

### The STATUS.sh script
The above mentioned scripts have to be executed in order of appearance above, since they depend on each other.
That's what the STATUS.sh file does.

**NOTE:** Before executing those scripts, it deletes `applets-status`, `language-status` and `README.md`, which are created by the scripts above. It's kinf of passive aggressive, but that way it ensures that everything is up to date and that removed applets are also removed in the status tables.