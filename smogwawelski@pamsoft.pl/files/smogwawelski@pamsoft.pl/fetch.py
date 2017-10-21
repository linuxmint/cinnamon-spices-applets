#!/usr/bin/env python
import urllib2
import ConfigParser

from time import strftime, sleep
from os.path import expanduser
from parsers import ParserFactory
from fetchers import FetcherFactory

HOME = expanduser('~/.local/share/cinnamon/applets/smogwawelski@pamsoft.pl/')
# HOME = expanduser('~/Desktop/SmogWawelski/src/')

def get_config():
    return get_configuration(HOME + 'data/config.properties')


def get_wios_mapping():
    return get_configuration(HOME + 'wios.properties')


def get_configuration(file_location):
    config_parser = ConfigParser.ConfigParser()
    config_parser.readfp(open(file_location))
    return config_parser


# config = get_config()
# wios_mapping = get_wios_mapping()
# selected_wios = config.get('fetch', 'wios')
# station_id = config.get('fetch', 'station.id')
#
# data = FetcherFactory.get(selected_wios).fetch_data(station_id, selected_wios, wios_mapping)
# fetched_data = ParserFactory.get(selected_wios).parse_data(data, station_id, selected_wios, wios_mapping)
# obj = open(HOME + 'data/data.json', 'w', 0)  # 0 = no buffer
# obj.write(fetched_data.to_json())
# obj.close()

#main loop
while True:
    config = get_config()
    wios_mapping = get_wios_mapping()
    selected_wios = config.get('fetch', 'wios')
    station_id = config.get('fetch', 'station.id')
    sleepTimeInMinutes = get_config().get('fetch', 'refresh.time')
    data = FetcherFactory.get(selected_wios).fetch_data(station_id, selected_wios, wios_mapping)
    fetched_data = ParserFactory.get(selected_wios).parse_data(data, station_id, selected_wios, wios_mapping)
    obj = open(HOME + 'data/data.json', 'w', 0)  # 0 = no buffer
    obj.write(fetched_data.to_json())
    obj.close()
    sleep(60*int(sleepTimeInMinutes))