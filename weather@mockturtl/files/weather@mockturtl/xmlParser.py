#!/usr/bin/python

try:
    import argparse
    import json     
    import requests
    import xmltodict
    from xml.parsers.expat import ExpatError
    from requests.exceptions import ConnectionError

    parser = argparse.ArgumentParser(description='Parsing XMl and returns JSON string')
    parser.add_argument('url', metavar='URL', type=str,
                        help='XML as string')

    args = parser.parse_args()

    payload = requests.get(args.url)
    print(json.dumps(xmltodict.parse(payload.text)))
except ImportError as e:
    print(json.dumps({"error": {"type": "import", "message": "Couldn't import packages"}}))
except ExpatError as e:
    print(json.dumps({"error": {"type": "payload", "message": "Payload is not XML"}}))
except ConnectionError as e:
    print(json.dumps({"error": {"type": "network", "message": "Could not connect to API"}}))
except Exception as e:
    print(json.dumps({"error": {"type": "unknown", "message": e}}))