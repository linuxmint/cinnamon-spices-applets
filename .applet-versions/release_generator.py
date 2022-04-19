from .version_generator import generate_applet_version_map
import os
from pathlib import Path
import json

REPO_FOLDER = os.path.realpath(os.path.abspath(os.path.join(
    os.path.normpath(os.path.join(os.getcwd(), *([".."] * 1))))))

releasesPath = Path("releases.json")
if __name__ == "__main__":
    version_map = generate_applet_version_map()

    if (not releasesPath.exists()):
        with open(releasesPath, "w") as f:
            json.dump(version_map, f, indent=4)

    