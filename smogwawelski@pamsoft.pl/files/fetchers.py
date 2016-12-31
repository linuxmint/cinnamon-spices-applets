#!/usr/bin/env python
import urllib2
import requests

from abc import ABCMeta, abstractmethod
from time import strftime
import datetime


TIMEOUT = 3

class Fetcher(object):
    __metaclass__ = ABCMeta

    HOURS = range(1, 25)

    @abstractmethod
    def fetch_data(self, station_id, selected_wios, wios_mapping):
        pass


class LDFetcher(Fetcher):
    def __init__(self):
        pass

    def fetch_data(self, station_id, selected_wios, wios_mapping):
        export_file_name = wios_mapping.get(selected_wios, 'fetchers.filename.' + str(station_id))
        url = wios_mapping.get(selected_wios, 'url').format(station_id=station_id, filename=export_file_name)
        headers = {'Accept': 'application/xml, text/xml, */*; q=0.01',
                   'Referer': 'http://www.wios.lodz.pl/serwis/index.php?id=62',
                   'DNT': '1',
                   'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0'}
        r = requests.get(url, headers=headers)
        return r.text


class MPFetcher(Fetcher):
    def __init__(self):
        pass

    def fetch_data(self, station_id, selected_wios, wios_mapping):
        channels = wios_mapping.get(selected_wios, 'fetcher.channels.' + str(station_id))
        date = strftime(wios_mapping.get(selected_wios, 'dateformat'))
        url = wios_mapping.get(selected_wios, 'url')

        headers = {'Accept': 'application/json, text/javascript, */*; q=0.01',
                   'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                   'Referer': 'http://monitoring.krakow.pios.gov.pl/dane-pomiarowe/automatyczne',
                   'Cookie': 'start_selector_nth=0; start_selector_hide=yes',
                   'DNT': '1',
                   'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0'}
        query_string = '{"measType": "Auto", "viewType": "Station", "dateRange": "Day", "date": "%s", "viewTypeEntityId": %s, "channels": %s }' % (date, station_id, channels)

        payload = {'query': query_string}
        r = requests.post(url, data=payload, headers=headers, timeout=TIMEOUT)
        return r.text


class PKFetcher(Fetcher):
    def __init__(self):
        pass

    def fetch_data(self, station_id, selected_wios, wios_mapping):
        url = wios_mapping.get(selected_wios, 'url')
        date = strftime(wios_mapping.get(selected_wios, 'dateformat'))
        headers = {'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                   'Referer': 'http://stacje2.wios.rzeszow.pl/pl/1,6/2/raport_dzienny.html',
                   'DNT': '1',
                   'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0'}
        payload = {'date': date, 'meteo': 0, 'station': station_id, 'type': 1}
        r = requests.post(url, data=payload, headers=headers, timeout=TIMEOUT)
        return r.text


class PMFetcher(Fetcher):
    def __init__(self):
        pass

    def fetch_data(self, station_id, selected_wios, wios_mapping):
        url = wios_mapping.get(selected_wios, 'url')
        headers = {'Accept': 'application/xml, text/xml, */*; q=0.01',
                   'Referer': 'http://airpomerania.pl/pomiary/wyniki-pomiarowe.html',
                   'DNT': '1',
                   'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0'}
        r = requests.get(url, headers=headers, timeout=TIMEOUT)
        return r.content


class WMFetcher(Fetcher):
    def __init__(self):
        pass

    def fetch_data(self, station_id, selected_wios, wios_mapping):
        date_format = wios_mapping.get(selected_wios, 'dateformat')
        date = strftime(date_format)
        time_from = strftime('%Y%m%d0000')
        time_to = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime('%Y%m%d0000')
        url = wios_mapping.get(selected_wios, 'url').format(stationId=station_id, timeFrom=time_from, timeTo=time_to)
        headers = {'Accept': 'application/xml, text/xml, */*; q=0.01',
                   'Referer': 'http://www.wios.olsztyn.pl:82/index.php?type=rg&data={date}&os=sub&sid={stationId}&rg=dan'.format(date=date, stationId=station_id),
                   'DNT': '1',
                   'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0'}
        r = requests.get(url, headers=headers, timeout=TIMEOUT)
        return r.content

class GetTextFetcher(Fetcher):
    def __init__(self):
        pass

    def fetch_data(self, station_id, selected_wios, wios_mapping):
        url = wios_mapping.get(selected_wios, 'url').format(stationId=station_id)
        headers = {'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                   'Referer': 'http://www.wios.bialystok.pl/index.php?go={station_id}'.format(station_id=station_id),
                   'DNT': '1',
                   'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0'}
        r = requests.get(url, headers=headers, timeout=TIMEOUT)
        return r.text


class CommonFetcher(Fetcher):
    def __init__(self):
        pass

    def fetch_data(self, station_id, selected_wios, wios_mapping):
        wios_url = wios_mapping.get(selected_wios, 'url')
        date_format = wios_mapping.get(selected_wios, 'dateformat')
        date = strftime(date_format)
        url = wios_url.format(stationId=station_id, date=date)
        response = urllib2.urlopen(url, timeout=TIMEOUT)
        return response.read()


FETCHER_MAPPING = {
    'DS': MPFetcher,
    'KP': CommonFetcher,
    'LB': CommonFetcher,
    'LS': CommonFetcher,
    'LD': LDFetcher,
    'MP': MPFetcher,
    'MZ': CommonFetcher,
    'OP': CommonFetcher,
    'PK': PKFetcher,
    'PM': PMFetcher,
    'PL': GetTextFetcher,
    'SL': CommonFetcher,
    'SK': CommonFetcher,
    'WP': MPFetcher,
    'WM': WMFetcher,
    'ZP': CommonFetcher,
}


class FetcherFactory:
    def __init__(self):
        pass

    @staticmethod
    def get(wios_id):
        return FETCHER_MAPPING[wios_id]()