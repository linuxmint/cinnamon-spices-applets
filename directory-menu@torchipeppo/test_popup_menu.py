# there is no guarantee that this file is kept pu to date with each release.
# I only plan to update it when I need it, so if I add new args it might lag behind.

# memo: another way I have to get output is the `log` function in popup_mennu.py
# but this method is instantaneous

import subprocess
from pathlib import Path
import json

args = {
    "starting_uri": f"file://{Path.home()}",
    "show_hidden": False,
    "x": 0,
    "y": 0,
    "orientation": 0,
    "character_limit": -1,
    "favorites_first": False,
    "pinned_first": False,
    "order_by": 1,
}

subprocess.run(["python3", "files/directory-menu@torchipeppo/popup_menu.py", json.dumps(args)])
