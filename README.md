# cinnamon-spices-applets

![Validate spices](https://github.com/linuxmint/cinnamon-spices-applets/workflows/Validate%20spices/badge.svg)

This repository hosts all the applets available for the Cinnamon desktop environment.

Users can install spices from https://cinnamon-spices.linuxmint.com, or directly from within Cinnamon -> System Settings.

# Definitions

## UUID

Each spice is given a name which uniquely identifies them.

That name is their UUID and it is unique.

## Author

Each spice has an author.

The github username of the author is specified in the spice's info.json file.

# File structure

A spice can contain many files, but it should have the following file structure:

- UUID/
- UUID/info.json
- UUID/screenshot.png
- UUID/README.md
- UUID/files/
- UUID/files/UUID
- UUID/files/UUID/metadata.json
- UUID/files/UUID/applet.js
- UUID/files/UUID/icon.png

There are two important directories:

- UUID/ is the root level directory, it includes files which are used by the website and on github.
- UUID/files/ represents the content of the ZIP archive which users can download from https://cinnamon-spices.linuxmint.com or which is sent to Cinnamon when installing the spice from System Settings. This is the content which is interpreted by Cinnamon itself.

As you can see, the content of the spice isn't placed inside UUID/files/ directly, but inside UUID/files/UUID/ instead. This guarantees files aren't extracted directly onto the file system, but placed in the proper UUID directory. The presence of this UUID directory, inside of files/ isn't actually needed by Cinnamon (as Cinnamon creates it if it's missing), but it is needed to guarantee a proper manual installation (i.e. when users download the ZIP from the Cinnamon Spices website).

Important note:

- The UUID/files/ directory has to be "empty", which means that it should contain ONLY the UUID directory. Else the spice won't be installable through System Settings.

At the root level:

- info.json contains information about the spice. For instance, this is the file which contains the github username of the spice's author.
- screenshot.png is a screenshot of the spice in action.
- README.md is optional and can be used to show instructions and information about the spice. It appears both in Github and on the website.

## Validation

To check if a spice with UUID satifies those requirements run the `validate-spice` script in this repo:
```
./validate-spice UUID
```

# Rights and responsibility of the author

The author is in charge of the development of the spice.

Authors can modify their spice under the following conditions:

- They need to respect the file structure and workflow defined here
- They cannot introduce malicious code or code which would have a negative impact on the environment

Authors are able to accept or refuse changes from other people which modify the features or the look of their spice.

Authors may choose to pass on development of their applet to someone else. In that case, the "author" field in UUID/info.json will be changed to the new developer and the "original_author" field will be added to give credit to the original developer.

If an author abandons their applet, the Linux Mint team will take over maintenance of the applet or pass it on to someone else. Several factors are used to determine if an applet is abandoned, including prolonged activity, failure to respond to requests, and serious breakages that have occurred due to changes in API, etc. If you plan to abandon an applet, please notify us, so we don't have to guess as to whether it is abandoned or not.

# Pull requests from authors and workflow

To modify a spice, developers create a Pull Request.

Members of the cinnamon-spices-developers team review the pull request.

If the author of the pull request is the spice author (his github username matches the author field in UUID/info.json), the reviewer only has to perform the following checks:

- The changes only impact spices which belong to that author
- The changes respect the spices file structure
- The changes do not introduce malicious code or code which would negatively impact the desktop environment

If everything is fine, the PR is merged, the website is updated and users can see a spice update in System Settings.

# Pull requests from other people

In addition to the checks specified above, if the pull request comes from somebody other than the author, it will be held until the author reviews it or gives a thumbs-up, with the following exceptions:

- If it is a bug fix, the PR may be merged, though if the bug is minor, or the fix could potentially impact the way the applet works, we may wait for author approval before merging.
- If the pull request adds translations it will likewise be merged. These are not going to effect the functionality of the code, and will make the applet available to many users who couldn't use it before due to a language barrier. We view this as essentially a bugfix, but it is included here for clarification.
- If the author fails to respond in a reasonable time, we will assume the applet is abandoned (as mentioned above) and the pull request will be merged assuming it meets all other requirements.

If the changes represent a change in functionality, or in look and feel, or if their implementation could be questioned and/or discussed, the reviewer should leave the PR open and ask the author to review it.

If the author is happy with the PR, it can then be merged. If he's not, it can either be closed or updated to reflect any changes the author requested, at which point it will either be merged or the author may be asked to review the changes depending on whether it is clear the changes fully meet the author's requirements.

# Deletions

Authors are entitled to remove their spice.

The Cinnamon team is also entitled to do so. Common reasons are lack of maintenance, critical bugs, or if the features are already provided, either by Cinnamon itself, or by another spice which is more successful.

# Additions

New spices can be added by Pull Request.

The Cinnamon team can accept or reject the addition and should give justification in the PR comments section.

# Reporting Bugs and Creating Pull Requests

See the [Guidelines for Contributing](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/.github/CONTRIBUTING.md).

# Translations

The script `cinnamon-spices-makepot` in this repo was written to help authors to update their translation template (`.pot`) file and to help translators to test their translations.

Updating a translation template `.pot`:
```
./cinnamon-spices-makepot UUID
```

Test your translations `.po` locally before uploading to Spices:
```
./cinnamon-spices-makepot UUID --install
```

More info:
```
./cinnamon-spices-makepot --help
```

# Translations Status Tables

The spices receive updates which sometimes contain new or updated strings that need to be translated. The translation status tables were created to give translators a better overview of the current state of translations and also to make it easier to track where new untranslated strings appear.

* [Translation Status Tables for Applets](https://github.com/linuxmint/cinnamon-spices-applets/blob/translation-status-tables/.translation-tables/tables/README.md)

To ensure that these tables are always up-to-date, they are automatically regenerated whenever a new commit is pushed to the master branch.

# Javascript feature backward compatibility table
## (incomplete)
To determine the backward compatibility of a javascript feature, look at it's page on [mdm web docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript) to see in which version of Firefox it was introduced. Then compare with the table below.

<table><tr><th colspan="1">Mint<br/>Version</th><th colspan="1">Codename</th><th colspan="1">Release Date</th><th colspan="1">Cinnamon<br/>Version</th><th colspan="2">Firefox version<br/>(CJS JS engine)</th></tr>
<tr><td colspan="1">17</td><td colspan="1">Qiana</td><td colspan="1">31 May 14</td><td colspan="1">2.2.14</td><td colspan="1"></td></tr>
<tr><td colspan="1">17.1</td><td colspan="1">Rebecca</td><td colspan="1">29 Nov 14</td><td colspan="1">2.4.6</td><td colspan="1"></td></tr>
<tr><td colspan="1">17.2</td><td colspan="1">Rafaela</td><td colspan="1">30 Jun 15</td><td colspan="1">2.6.13</td><td colspan="1"></td></tr>
<tr><td colspan="1">17.3</td><td colspan="1">Rosa</td><td colspan="1">4 Dec 15</td><td colspan="1">2.8.7</td><td colspan="1"></td></tr>
<tr><td colspan="1">18</td><td colspan="1">Sarah</td><td colspan="1">30 Jun 16</td><td colspan="1">3.0.7</td><td colspan="1"></td></tr>
<tr><td colspan="1">18.1</td><td colspan="1">Serena</td><td colspan="1">16 Dec 16</td><td colspan="1">3.2.8</td><td colspan="1"></td></tr>
<tr><td colspan="1">18.2</td><td colspan="1">Sonya</td><td colspan="1">2 Jul 17</td><td colspan="1">3.4.4</td><td colspan="1"></td></tr>
<tr><td colspan="1">18.3</td><td colspan="1">Sylvia</td><td colspan="1">27 Nov 17</td><td colspan="1">3.6.7</td><td colspan="1"></td></tr>
<tr><td colspan="1">19</td><td colspan="1">Tara</td><td colspan="1">29 Jun 18</td><td colspan="1">3.8.8</td><td colspan="1" rowspan="5">52</td></tr>
<tr><td colspan="1">19.1</td><td colspan="1">Tessa</td><td colspan="1">19 Dec 18</td><td colspan="1">4.0.9</td></tr>
<tr><td colspan="1">19.2</td><td colspan="1">Tina</td><td colspan="1">2 Aug 19</td><td colspan="1">4.2.3</td></tr>
<tr><td colspan="1">19.3</td><td colspan="1">Tricia</td><td colspan="1">18 Dec 19</td><td colspan="1">4.4.8</td></tr>
<tr><td colspan="1">20*</td><td colspan="1">Ulyana</td><td colspan="1">27 Jun 20</td><td colspan="1">4.6.7</td></tr>
<tr><td colspan="1">20.1</td><td colspan="1">Ulyssa</td><td colspan="1">8 Jan 21</td><td colspan="1">4.8.6</td><td colspan="1" rowspan="5">78</td></tr>
<tr><td colspan="1">20.2</td><td colspan="1">Uma</td><td colspan="1">8 Jul 21</td><td colspan="1">5.0.5</td></tr>
<tr><td colspan="1">20.3</td><td colspan="1">Una</td><td colspan="1">7 Jan 22</td><td colspan="1">5.2.7</td></tr>
<tr><td colspan="1">21*</td><td colspan="1">Vanessa</td><td colspan="1">31 Jul 22</td><td colspan="1">5.4.12</td></tr>
<tr><td colspan="1">21.1</td><td colspan="1">Vera</td><td colspan="1">20 Dec 22</td><td colspan="1">5.6.8</td></tr>
<tr><td colspan="1">21.2</td><td colspan="1">Victoria</td><td colspan="1">16 Jul 23</td><td colspan="1">5.8.4</td><td colspan="1" rowspan="2">102</td></tr>
<tr><td colspan="1">21.3</td><td colspan="1">Virginia</td><td colspan="1">12 Jan 24</td><td colspan="1">6.0.4</td></tr>
<tr><td colspan="1">22</td><td colspan="1">Wilma</td><td colspan="1"></td><td colspan="1">6.2.x</td><td colspan="1" rowspan="1">115</td></tr>
</table>

*Mint 20 series is officially supported until Apr 2025, 21 series until Apr 2027. Earlier versions official support has ended.
