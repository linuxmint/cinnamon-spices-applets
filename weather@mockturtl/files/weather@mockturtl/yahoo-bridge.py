#!venv/bin/python3
try:
    import json
    import argparse
    from requests_oauthlib import OAuth1
    import requests
    
    parser = argparse.ArgumentParser(description='Gets yahoo Weather and returns it as JSON string')
    parser.add_argument('--params', metavar='params', type=str,
                        help='parameters in json format, must include lat and lon')

    args = parser.parse_args()
    paramArgs = json.loads(args.params)

    lat = paramArgs.get("lat", None)
    lon = paramArgs.get("lon", None)

    if (lat == None or lon == None):
        print(json.dumps({"error": {"type": "params", "message": "Invalid parameters, must contain lat and lon"}}))
        quit()

    url = "https://weather-ydn-yql.media.yahoo.com/forecastrss"
    app_id = "Zptm0N7i"
    consumer_key = "dj0yJmk9TWFaaFJTOEtqeFFUJmQ9WVdrOVduQjBiVEJPTjJrbWNHbzlNQS0tJnM9Y29uc3VtZXJzZWNyZXQmc3Y9MCZ4PWNh"
    just_a_string = "9cfc990819b2d974ab43e10a2b296f263f2889e7"

    params = {
        "lat" : lat,
        "lon": lon,
        "format": "json",
        "u": "c"
    }

    headers = { 'X-Yahoo-App-Id': app_id }

    headeroauth = OAuth1(consumer_key, just_a_string, signature_type='auth_header')
    r = requests.get(url, auth=headeroauth, params=params, headers=headers)
    print(json.dumps(json.loads(r.text))) #r.json() returns incorrect JSON
except ImportError as e:
    print(json.dumps({"error": {"type": "import", "message": "Couldn't import packages", "data": str(e)}}))
except ConnectionError as e:
    print(json.dumps({"error": {"type": "network", "message": "Could not connect to API", "data": str(e)}}))
except Exception as e:
    print(json.dumps({"error": {"type": "unknown", "message": "Unexpected Error", "data": str(e)}}))