#!/usr/bin/python

import xml.etree.ElementTree as ET
import argparse
import requests
import json
import xmltodict

try:
    parser = argparse.ArgumentParser(description='Parsing XMl and returns JSON string')
    parser.add_argument('url', metavar='URL', type=str,
                        help='XML as string')


    args = parser.parse_args()
    #print(args.accumulate(args.integers))

    payload = requests.get(args.url)
    print(json.dumps(xmltodict.parse(payload.text)))
except Exception as e:
    print(json.dumps({"error": e}))