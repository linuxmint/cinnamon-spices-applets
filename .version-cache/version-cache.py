import os
from pathlib import Path
from typing import Dict, List, Optional, TypedDict
import subprocess
import json

class Version(TypedDict):
    version: str
    commit: str
    date: str
    url: str

class Metadata(TypedDict):
    uuid: str
    name: str
    description: str
    version: Optional[str]

class Applet(TypedDict):
    id: str
    path: Path
    versions: List[Version]

REPO_FOLDER = Path(os.path.realpath(os.path.abspath(os.path.join(
    os.path.normpath(os.path.join(os.getcwd(), *([".."] * 1)))))))

def get_current_metadata(path: Path) -> Metadata:
    with open(path, "r") as f:
        return json.load(f)

def obtain_versions(applet: Applet) -> List[Version]:
    output = subprocess.run("git log --oneline -- ", applet['path'].joinpath(f'files/{applet["id"]}'), )
    pass

if __name__ == "__main__":
    applets: Dict[str, Applet] = {}
    for item in REPO_FOLDER.iterdir():
        if not item.is_dir():
            continue
        metadataFile = item.joinpath(f"files/{item.name}/metadata.json")
        if (not metadataFile.exists() and not metadataFile.is_file()):
            continue
        
        metadata = get_current_metadata(metadataFile)
        applets[metadata["uuid"]] = {
            "id": metadata["uuid"],
            "path": item.relative_to(REPO_FOLDER),
            "versions": []
        }

    print(json.dumps(applets, indent=4))




