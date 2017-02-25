#!/usr/bin/env python
import json
import ConfigParser
import sys, os

from time import strftime, sleep
from os.path import expanduser
from parsers import ParserFactory
from fetchers import FetcherFactory

HOME = expanduser('~/.local/share/cinnamon/applets/smogwawelski@pamsoft.pl/')
# HOME = expanduser('~/Desktop/SmogWawelski/src/')


class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def get_wios_mapping(file_location):
    config_parser = ConfigParser.ConfigParser()
    config_parser.readfp(open(file_location))
    return config_parser


with open(HOME + 'settings-schema.json') as data_file:

        wios_mapping = get_wios_mapping(HOME + 'wios.properties')
        data = json.load(data_file)
        options = data['STATION_ID']['options']
        for k, v in sorted(options.iteritems()):
            splitted_value = v.split('-')
            selected_wios = splitted_value[0]
            station_id = splitted_value[1]
            key = k.encode('UTF-8')
            try:
                data = FetcherFactory.get(selected_wios).fetch_data(station_id, selected_wios, wios_mapping)
                fetched_data = ParserFactory.get(selected_wios).parse_data(data, station_id, selected_wios, wios_mapping)
                updated = fetched_data.updatedAt
                measurements = len(fetched_data.measurements)
                print bcolors.OKGREEN + "{wios}-{id}\t{updated}, {count},\t{k}".format(k=key, updated=updated, count=measurements, wios=selected_wios, id=station_id) + bcolors.ENDC
            except Exception as e:
                exc_type, exc_obj, exc_tb = sys.exc_info()
                print bcolors.FAIL + "{wios}-{id}\t{k}:\t{et}-{er}".format(k=key, er=e.message, wios=selected_wios, id=station_id, et=exc_type.__name__ ) + bcolors.ENDC
