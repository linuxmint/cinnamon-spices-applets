### 1.0.2

  * Add panelHeight and instance_id to various functions
  * Add Configure (settings-schema.json) to applet
  * Provide options to choose different vnstati formats including a user specified format
  * Tidy code to remove trailing spaces
  * Change Icon to be unique and have better affordance
  * Add CHANGELOG.md
  * Update README.md

### 1.0.1

  * Changes for Cinnamon 4.0 and higher to avoid segfaults when old Network Manager Library is no longer available by using multiversion with folder 4.0 - Issues #2094 and #2097
  * Remove Try-Catch as no longer required in 4.0 and associated changes.
  * It is believed that all Distributions packaging Cinnamon 4.0 have changed to the new Network Manager Libraries
  * Update README.md

### 1.0.0

  * Change "author" to "pdcurtis and set "original author" to clefebvre
  * Changes to check which network manager libraries are in use and choose which to use - addresses/solves issue #1647 with Fedora versions 27 and higher.
