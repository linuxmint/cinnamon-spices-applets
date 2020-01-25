#!/usr/bin/python

try:
    import argparse
    import json     
    import requests
    import xmltodict

    parser = argparse.ArgumentParser(description='Parsing XMl and returns JSON string')
    parser.add_argument('url', metavar='URL', type=str,
                        help='XML as string')

    args = parser.parse_args()

    payload = requests.get(args.url)
    print(json.dumps(xmltodict.parse(payload.text)))
except ImportError as e:
    print(json.dumps({"error": {"type": "import", "message": "Couldn't import packages"}}))
except Exception as e:
    print(json.dumps({"error": {"type": "general", "message": e}}))