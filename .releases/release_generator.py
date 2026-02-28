from typing import Dict
from utils.version_generator import generate_applet_version_map, Applet
import os
from pathlib import Path
import json
from itertools import zip_longest

REPO_FOLDER = os.path.realpath(os.path.abspath(os.path.join(
    os.path.normpath(os.path.join(os.getcwd(), *([".."] * 1))))))

releasesPath = Path("releases.json")
if __name__ == "__main__":
    version_map = generate_applet_version_map()

    old_version_map: Dict[str, Applet] = {}
    if (releasesPath.exists()):
        with open(releasesPath, "r") as f:
            old_version_map = json.load(f)

    # compare
    for [id, applet] in version_map.items():
        old_applet = old_version_map.get(applet["id"], None)
        old_applet_versions = old_applet["versions"] if old_applet is not None else []

        for new, old in zip_longest(applet["versions"], old_applet_versions, fillvalue=None):
            # Should not care about the order of the versions, they should be sorted already
            if old is None:
                # New version compared to the old file
                pass

    with open(releasesPath, "w") as f:
        json.dump(version_map, f, indent=4)