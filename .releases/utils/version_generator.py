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
    applet_checksum: str
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

def get_applet_hash(applet_folder: Path, hash: str) -> Optional[str]:
    '''Gets hash of the applet "dist" ({name}/files/{name}) folder'''
    try:
        output = subprocess.check_output([
            "git",
            "rev-parse",
            f"{hash}:{str(applet_folder)}", 
            
        ], cwd=REPO_FOLDER, encoding="utf-8")
    except subprocess.CalledProcessError as e:
        return None
    return output.strip()

def obtain_versions(applet: Applet) -> List[Version]:
    versions: List[Version] = []
    metadataPath = Path(applet['path']).joinpath(f'metadata.json')

    # Get changelog for applet
    output = subprocess.check_output([
        "git",
        "log",
        "--pretty=format:%h;%aI;%s%d",
        "--", 
        str(applet['path'])
    ], cwd=REPO_FOLDER, encoding="utf-8")

    previousVersion: Optional[str] = None
    currentRevision: int = 1
    for line in reversed(output.splitlines()):
        if line is None:
            continue

        # Get information on commit
        [commit, timestamp, message] = line.split(";", 2)
        hash = get_applet_hash(Path(applet["path"]), commit)
        if (hash is None):
            # No files in applet dist folder, skip
            continue
        
        try:
            metadata: Metadata = json.loads(subprocess.check_output([
                "git",
                "show",
                f"{commit}:{str(metadataPath)}"
            ], cwd=REPO_FOLDER))
        except subprocess.CalledProcessError:
            # No metadata.json file in commit, skip
            continue

        # Normalize version, can't be null and we add revision that we increment when version was not changed
        version = str(metadata["version"]) if metadata.get("version") is not None else "0.0.0"
        if (version == previousVersion):
            currentRevision += 1
        else:
            currentRevision = 1

        versions.append({
            "version": f"{version}-{str(currentRevision)}",
            "commit": commit,
            "message": message,
            "date": timestamp,
            "applet_checksum": hash,
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

def generate_applet_version_map() -> Dict[str, Applet]:
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
    return applets

if __name__ == "__main__":
    print(json.dumps(generate_applet_version_map(), indent=4))
