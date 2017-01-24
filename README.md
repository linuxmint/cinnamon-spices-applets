# cinnamon-spices-applets

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
- UUID/icon.png
- UUID/screenshot.png
- UUID/README.md
- UUID/files/
- UUID/files/UUID
- UUID/files/UUID/metadata.json
- UUID/files/UUID/extension.js

There are two important directories:

- UUID/ is the root level directory, it includes files which are used by the website and on github.
- UUID/files/ represents the content of the ZIP archive which users can download from https://cinnamon-spices.linuxmint.com or which is sent to Cinnamon when installing the spice from System Settings. This is the content which is interpreted by Cinnamon itself.

As you can see, the content of the spice isn't placed inside UUID/files/ directly, but inside UUID/files/UUID/ instead. This guarantees files aren't extracted directly onto the file system, but placed in the proper UUID directory. The presence of this UUID directory, inside of files/ isn't actually needed by Cinnamon (as Cinnamon creates it if it's missing), but it is needed to guarantee a proper manual installation (i.e. when users download the ZIP from the Cinnamon Spices website).

At the root level:

- info.json contains information about the spice. For instance, this is the file which contains the github username of the spice's author.
- icon.png is the icon associated with the spice.
- screenshot.png is a screenshot of the spice in action.
- README.md is optional and can be used to show instructions and information about the spice. It appears both in Github and on the website.

# Rights and responsibility of the author

The author is in charge of the development of the spice.

Authors can modify their spice under the following conditions:

- They need to respect the file structure and workflow defined here
- They cannot introduce malicious code or code which would have a negative impact on the environment

Authors are able to accept or refuse changes from other people which modify the features or the look of their spice.

# Pull requests from authors and workflow

To modify a spice, developers create a Pull Request.

Members of the cinnamon-spices-developers team review the pull request.

If the author of the pull request is the spice author (his github username matches the author field in UUID/info.json), the reviewer only has to perform the following checks:

- The changes only impact spices which belong to that author
- The changes respect the spices file structure
- The changes do not introduce malicious code or code which would negatively impact the desktop environment

If everything is fine, the PR is merged, the website is updated and users can see a spice update in System Settings.

# Pull requests from other people

In addition to the checks specified above, if the pull requests comes from somebody else than the author, the reviewer will need to check the nature of the changes.

If the changes represent a bug fix, the PR can be merged.

If the changes represent a change in functionality, or in look and feel, or if their implementation could be questioned and/or discussed, the reviewer should leave the PR open and ask the author to review it.

If the author is happy with the PR, it can then be merged. If he's not, it can be closed instead.

# Deletions

Authors are entitled to remove their spice.

The Cinnamon team is also entitled to do so. Common reasons are lack of maintenance, critical bugs, or if the features are already provided, either by Cinnamon itself, or by another spice which is more successful.

# Additions

New spices can be added by Pull Request.

The Cinnamon team can accept or reject the addition and should give justification in the PR comments section.



