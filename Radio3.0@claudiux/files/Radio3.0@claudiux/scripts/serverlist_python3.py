#!/bin/env python
import socket
import random
import urllib
import urllib.request
import json

def get_radiobrowser_base_urls():
    """
    Get all base urls of all currently available radiobrowser servers

    Returns:
    list: a list of strings

    """
    hosts = []
    # get all hosts from DNS
    ips = socket.getaddrinfo('all.api.radio-browser.info',
                             80, 0, 0, socket.IPPROTO_TCP)
    for ip_tupple in ips:
        ip = ip_tupple[4][0]

        # do a reverse lookup on every one of the ips to have a nice name for it
        host_addr = socket.gethostbyaddr(ip)
        # add the name to a list if not already in there
        if host_addr[0] not in hosts:
            hosts.append(host_addr[0])

    # sort list of names
    hosts.sort()
    # add "https://" in front to make it an url
    return list(map(lambda x: "https://" + x, hosts))

def downloadUri(uri, param):
    """
    Download file with the correct headers set

    Returns:
    a string result

    """
    paramEncoded = None
    if param != None:
        paramEncoded = json.dumps(param)
        print('Request to ' + uri + ' Params: ' + ','.join(param))
    else:
        print('Request to ' + uri)

    req = urllib.request.Request(uri, paramEncoded)
    #TODO: change the user agent to name your app and version
    req.add_header('User-Agent', 'MyApp/0.0.1')
    req.add_header('Content-Type', 'application/json')
    response = urllib.request.urlopen(req)
    data=response.read()

    response.close()
    return data

def downloadRadiobrowser(path, param):
    """
    Download file with relative url from a random api server.
    Retry with other api servers if failed.

    Returns:
    a string result

    """
    servers = get_radiobrowser_base_urls()
    random.shuffle(servers)
    i = 0
    for server_base in servers:
        print('Random server: ' + server_base + ' Try: ' + str(i))
        uri = server_base + path

        try:
            data = downloadUri(uri, param)
            return data
        except Exception as e:
            print("Unable to download from api url: " + uri, e)
            pass
        i += 1
    return {}

def downloadRadiobrowserStats():
    stats = downloadRadiobrowser("/json/stats", None)
    return json.loads(stats)

def downloadRadiobrowserStationsByCountry(countrycode):
    stations = downloadRadiobrowser("/json/stations/bycountrycodeexact/" + countrycode, None)
    return json.loads(stations)

def downloadRadiobrowserStationsByName(name):
    stations = downloadRadiobrowser("/json/stations/search", {"name":name})
    return json.loads(stations)

# print list of names
print("All available urls")
print("------------------")
for host in get_radiobrowser_base_urls():
    print(host)
print("")

print("Stats")
print("------------")
print(json.dumps(downloadRadiobrowserStats(), indent=4))
