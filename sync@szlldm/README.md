# sync
Cinnamon DE panel applet to show unwritten data amount and initiate sync

---
## What is this?
It is a simple panel applet for the Cinnamon Desktop Environment.
Its main goal is to show the amount of _dirty_ data in memory, and be able to execute _sync_ operation by a single click.

The number one use case is to monitor yet unwritten data onto slow pendrives. Copying large files to a slow removable media seemingly might happen in a moment, but under the hood only the write chace was written. Initiating _sync_ operation before media removal can prevent data loss by actually writing out the content of the cache.

## Screenshot
![Image](screenshot.png "sync applet")

## Manual install
Just copy the sync@szlldm directory into ~/.local/share/cinnamon/applets/
