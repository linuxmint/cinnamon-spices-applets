# Translation drafts — not available applet languages

These files contain **57 untranslated messages each**. They are translation
scaffolds, not machine translations and not completed language support. They live
outside `files/`, so the applet installer and Cinnamon Spices do not ship them.

| Draft | Target variety | Reference |
| --- | --- | --- |
| `nhe.po` | Eastern Huasteca Nahuatl | [SIL course entry](https://mexico.sil.org/resources/archives/326) |
| `nhg.po` | Tetelcingo Nahuatl / Mösiehuali̱ | [SIL language page](https://mexico.sil.org/es/lengua_cultura/nahuatl/mosiehuali-nhg) |
| `nlv.po` | Orizaba Nahuatl / Sierra de Zongolica | [SIL language page](https://mexico.sil.org/es/lengua_cultura/nahuatl/nawatl-orizaba-nlv) |
| `yua.po` | Yucatec Maya | [WALS language entry](https://wals.info/languoid/lect/wals_code_yct) |

The references identify the varieties; they do not provide or validate translations
of this application's messages. The Nahuatl drafts cover the three varieties
discussed for this project, not every Nahuatl variety. The Maya draft targets
Yucatec Maya specifically, not all languages in the Mayan family.

Each entry keeps its English `msgid`, source location, and an extracted comment
with the Spanish translation for reference. Its `msgstr` is intentionally empty.
No plural rule has been assumed: the current template has no plural messages.

## Completing a draft

Translate the whole message into the target variety, using consistent terminology
and the orthography appropriate to its intended community. Preserve `%s`, AWS
product names, commands, and identifiers such as `backup:DescribeRestoreJob`.
Do not copy a translation across varieties without checking its suitability.

The applet reads a restore job's status; it does not start a restore. “Refresh now”
requests a new status query. “Profile” means an AWS CLI named profile. “Region”
means the AWS region containing the job. Error messages must preserve whether the
applet retries automatically or requires the user to correct a problem.

Record the translator and revision date when actual translations are supplied.
Before enabling a catalog, review its language, compare its message coverage with
the current `.pot`, check placeholders with `msgfmt --check --check-format`, and
test the UI. Move the completed file into
`files/aws-cold-restore-monitor@paynalton.tech/po/` and update the main README only
when it is ready to be listed as a supported language.
