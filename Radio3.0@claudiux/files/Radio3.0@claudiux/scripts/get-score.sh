#!/bin/bash
echo -n $(curl -s https://cinnamon-spices.linuxmint.com/json/applets.json |  python3 -c "import json,sys;obj=json.load(sys.stdin);print(obj['Radio3.0@claudiux']['score']);")
