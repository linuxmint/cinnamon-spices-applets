# Source: https://github.com/linuxmint/cinnamon-settings-daemon/blob/eec27984940dfb11904b02228357f430b585c41f/plugins/color/generate-tz-header.py

from pathlib import Path
import re

THIS_FILE_DIR = Path(__file__).parent

INPUT_FILE = Path('/usr/share/zoneinfo/zone.tab')
OUTPUT_FILE = THIS_FILE_DIR / '../files/auto-dark-light@gihaume/5.8/src/core/Timezone_location_finder/database.json'

regex = re.compile(r"([+-]{1}[0-9]{2})([0-9]{2})([0-9]*)([+-]{1}[0-9]{3})([0-9]{2})([0-9]*)")

d = {}

for line in INPUT_FILE.read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#"):
        continue

    coords, tz = line.split('\t')[1:3]
    m = regex.search(coords)
    if not m:
        print(f"Skipping zone with unexpected coords format: {coords!r} (zone: {tz})")
        continue
    lat_deg, lat_min, lat_sec, long_deg, long_min, long_sec = m.groups()

    lat = int(lat_deg) + (int(lat_min) / 60.0) + (int(lat_sec or 0) / 3600.0)
    long = int(long_deg) + (int(long_min) / 60.0) + (int(long_sec or 0) / 3600.0)

    d[tz] = [lat, long]

output = "{\n"
output += "".join(
    f'    "{zone}": [{lat:.3f}, {long:.3f}],\n'
    for zone in sorted(d.keys())
    for lat, long in [d[zone]]
)
output = output[:-2]  # Removes last comma
output += "\n}\n"

OUTPUT_FILE.write_text(output)
