#!/usr/bin/env python3
# -*- coding:Utf-8 -*-

# Author: Leigh Scott (@leigh123linux on Github)

import json
import urllib.request

def get_location():
    with urllib.request.urlopen("https://ipinfo.io/json", timeout=5) as resp:
        data = json.loads(resp.read().decode())
    lat, lon = data["loc"].split(",")
    return float(lat), float(lon)

lat, lon = get_location()
print(lat, lon)
