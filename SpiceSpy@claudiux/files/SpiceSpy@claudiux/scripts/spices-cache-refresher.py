#!/usr/bin/env python3
# -*- coding:Utf-8 -*-

# Author : Claude CLERC <cc@claudeclerc.fr> <claude.clerc@gmail.com>
try:
    import os
    import sys
    import cinnamon
    sys.path.insert(1, "/usr/share/cinnamon/cinnamon-settings/bin")
    from Spices import ThreadedTaskManager, Spice_Harvester
    # ~ updater = cinnamon.UpdateManager()
    # ~ updater.refresh_all_caches()
    for col in ["applet", "desklet", "extension", "action", "theme"]:
        sh = Spice_Harvester(col)
        sh.refresh_cache()
        sh._download_image_cache()
except Exception as e:
    print("Cinnamon updates failed: %s" % e)
