import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, TypedDict
import subprocess
import json
from multiprocessing import Pool

class Version(TypedDict):
    version: str
    commit: str
    date: str
    url: str
    message: str

class Metadata(TypedDict):
    uuid: str
    name: str
    description: str
    version: Optional[str]

class Applet(TypedDict):
    id: str
    path: str
    versions: List[Version]

REPO_FOLDER = Path(subprocess.check_output([
    "git",
    "rev-parse",
    "--show-toplevel"
], encoding="utf-8").strip())

def get_current_metadata(path: Path) -> Metadata:
    with open(path, "r") as f:
        return json.load(f)

def obtain_versions(applet: Applet) -> List[Version]:
    versions: List[Version] = []
    metadataPath = Path(applet['path']).joinpath(f'metadata.json')
    output = subprocess.check_output([
        "git",
        "log",
        "--pretty=format:%h;%aI;%s%d",
        "--", 
        str(metadataPath)
    ], cwd=REPO_FOLDER, encoding="utf-8")

    previousVersion: Optional[str] = None
    for line in reversed(output.splitlines()):
        if line is None:
            continue

        [commit, timestamp, message] = line.split(";", 2)
        try:
            metadata: Metadata = json.loads(subprocess.check_output([
                "git",
                "show",
                f"{commit}:{str(metadataPath)}"
            ], cwd=REPO_FOLDER))
        except subprocess.CalledProcessError:
            continue

        version = str(metadata["version"]) if metadata.get("version") is not None else "0.0.0"
        if (version != previousVersion):
            versions.append({
                "version": version,
                "commit": commit,
                "message": message,
                "date": timestamp,
                "url": f"https://github.com/linuxmint/cinnamon-spices-applets/archive/{commit}.zip"
            })
        previousVersion = version
        
    return versions

def get_applet_info(metadata: Metadata, item: Path) -> Applet:
    applet: Applet = {
            "id": metadata["uuid"],
            "path": str(item.joinpath("files/" + item.name).relative_to(REPO_FOLDER)),
            "versions": []
        }

    applet["versions"] = obtain_versions(applet)
    return applet

if __name__ == "__main__":
    applets: Dict[str, Applet] = {}
    pool = Pool()
    items: List[Tuple[Metadata, Path]] = []
    for item in sorted(REPO_FOLDER.iterdir()):
        if not item.is_dir():
            continue
        metadataFile = item.joinpath(f"files/{item.name}/metadata.json")
        if (not metadataFile.exists() and not metadataFile.is_file()):
            continue
        
        metadata = get_current_metadata(metadataFile)
        items.append((metadata, item))

    results = pool.starmap(get_applet_info, items)
    for result in results:
        applets[result["id"]] = result
    
    print(json.dumps(applets, indent=4))




