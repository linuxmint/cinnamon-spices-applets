#!/usr/bin/env python
# coding=utf-8
import re
import json
import datetime

from popos import Data, DataEntry
from abc import ABCMeta, abstractmethod
from lxml import html
from lxml import etree
from time import strftime
from time import strptime
from os.path import expanduser


class Parser(object):
    __metaclass__ = ABCMeta

    HOURS = range(1, 25)
    HOME = expanduser('~/.local/share/cinnamon/applets/smogwawelski@pamsoft.pl/')

    @abstractmethod
    def parse_data(self, page, station_id, selected_wios, wios_mapping):
        pass

    @staticmethod
    def stringify_children(node):
        from lxml.etree import tostring
        from itertools import chain
        parts = ([node.text] + list(chain(*([tostring(c, with_tail=False), c.tail] for c in node.getchildren()))) +
                 [node.tail])
        # filter removes possible Nones in texts and tails

        result = ''.join(filter(None, parts))
        return result.replace('<sub>', '').replace('</sub>', '').replace('<sup>', '').replace('</sup>', '')

    @staticmethod
    def extract_last_value(lst):
        for index, element in reversed(list(enumerate(lst))):
            if element.strip() and element != '-':
                return index

    @staticmethod
    def load_location(voivodeship, station_id):
        json_data=open(Parser.HOME + 'settings-schema.json')
        data = json.load(json_data)
        for key, value in data['STATION_ID']['options'].items():
            if value == voivodeship + '-' + station_id:
                founded_name = key.split(' - ')
                if len(founded_name) == 2:
                    return founded_name[1]
                else:
                    return ' - '.join(founded_name[1:])


class ColumnBasedParser(Parser):
    def __init__(self):
        pass

    def parse_data(self, page, station_id, selected_wios, wios_mapping):
        xpath_keys = wios_mapping.get(selected_wios, 'xpath.keys')
        xpath_units = wios_mapping.get(selected_wios, 'xpath.units')
        xpath_column = wios_mapping.get(selected_wios, 'xpath.column')

        tree = html.fromstring(page)
        location_name = self.load_location(selected_wios, station_id)
        keys = tree.xpath(xpath_keys)
        try:
            units = tree.xpath(xpath_units)
        except UnicodeDecodeError:
            # Swietokrzyskie unit encoding problem
            parser = etree.HTMLParser(encoding="ISO-8859-1")
            tree2 = html.fromstring(page, parser=parser)
            units = tree2.xpath(xpath_units)
        column = tree.xpath(xpath_column)
        last_val_index = self.extract_last_value(column)

        result_map = {}  # empty map
        if last_val_index is not None:
            for index, key in enumerate(keys):
                try:
                    xpath_cols = wios_mapping.get(selected_wios, 'xpath.cols')
                    xpath = xpath_cols.format(last_val_index+1, index+1)
                    hour = self.HOURS[last_val_index]
                    unit = units[index]
                    value = tree.xpath(xpath)[0].strip()
                    result_map[key] = DataEntry(unit, '', hour, str(value))
                except IndexError:
                    # no data for given key, skipping
                    pass
        return Data(result_map, strftime("%Y-%m-%d %H:%M:%S"), location_name, station_id)


class RowBasedParser(Parser):

    KEY_REGEXP = re.compile(r'.*\((.+)\).*')
    PARAMETER_COLUMN = 0
    UNIT_COLUMN = 1
    MAXIMUM_FOR_GIVEN_UNIT_COLUMN = 2

    def __init__(self):
        pass

    def extract_key(self, row_data):
        return self.KEY_REGEXP.match(row_data).group(1)

    def parse_rows(self, rows, data_cols_range_start, data_cols_range_end, hour_shift):
        """
        Parse table rows.
        :param rows: Rows to parse
        :param data_cols_range_start: start column that contains data (usualy 3, cause first two are substance and unit name)
        :param data_cols_range_end: (Eg. can be last (-1) or if we want to ommit 3 last columns then (-3)
        :param hour_shift: when two tables are available the second table contains data from eg. 18 hour, so we need hour index shift to have valid time
        :return: results map
        """
        result_map = {}  # empty map
        for row in rows[2:]:
            key = self.extract_key(row[self.PARAMETER_COLUMN].text_content())
            unit = row[self.UNIT_COLUMN].text_content().strip()
            maxvalue = row[self.MAXIMUM_FOR_GIVEN_UNIT_COLUMN].text_content().strip()
            if maxvalue == '-':
               maxvalue = ''
            striped_row = [i.text_content() for i in row[data_cols_range_start:data_cols_range_end]]  # omit header elements and get plain numbers
            last_val_index = self.extract_last_value(striped_row)
            if last_val_index is not None:
                hour = self.HOURS[last_val_index+hour_shift]
                value = striped_row[last_val_index].strip()
                result_map[key] = DataEntry(unit, maxvalue, hour, str(value))
        return result_map

    def parse_data(self, page, station_id, selected_wios, wios_mapping):
        xpath_location = wios_mapping.get(selected_wios, 'xpath.location.name')
        xpath_rows = wios_mapping.get(selected_wios, 'xpath.rows')
        tree = html.fromstring(page)
        location_name = tree.xpath(xpath_location)[0].split(',')[0]
        rows = tree.xpath(xpath_rows)

        result_map = self.parse_rows(rows, 3, -1, 0)
        return Data(result_map, strftime("%Y-%m-%d %H:%M:%S"), location_name, station_id)


class WMParser(Parser):
    def __init__(self):
        pass

    def parse_data(self, page, station_id, selected_wios, wios_mapping):
        xpath_keys = wios_mapping.get(selected_wios, 'xpath.keys')
        xpath_units = wios_mapping.get(selected_wios, 'xpath.units')
        xpath_column = wios_mapping.get(selected_wios, 'xpath.column')

        tree = html.fromstring(page)
        location_name = self.load_location(selected_wios, station_id)
        keys = tree.xpath(xpath_keys)
        units = tree.xpath(xpath_units)
        column = tree.xpath(xpath_column)
        last_val_index = self.extract_last_value(column)

        result_map = {}  # empty map
        if last_val_index is not None:
            for index, key in enumerate(keys):
                try:
                    xpath_cols = wios_mapping.get(selected_wios, 'xpath.cols')
                    xpath = xpath_cols.format(last_val_index+3, index+2)
                    hour = self.HOURS[last_val_index]
                    unit = self.stringify_children(units[index]).replace('[', '').replace(']','')
                    value = tree.xpath(xpath)[0].strip()
                    fixed_key = key.split('-')[0]
                    result_map[fixed_key] = DataEntry(unit, '', hour, str(value))
                except IndexError:
                    # no data for given key, skipping
                    pass
        return Data(result_map, strftime("%Y-%m-%d %H:%M:%S"), location_name, station_id)


class PKParser(RowBasedParser):

    KEY_REGEXP = re.compile(r'(.+)')

    def parse_data(self, page, station_id, selected_wios, wios_mapping):
        xpath_rows = wios_mapping.get(selected_wios, 'xpath.rows')
        tree = html.fromstring(page)
        location_name = self.load_location(selected_wios, station_id)
        rows_table1 = tree.xpath(xpath_rows.format(table_index=1))
        rows_table2 = tree.xpath(xpath_rows.format(table_index=2))
        result_map1 = self.parse_rows(rows_table1, 2, None, 0)  # None = every column
        result_map2 = self.parse_rows(rows_table2, 2, -3, 17)  # ignore last 3 columns
        if len(result_map2) == 0:
            return Data(result_map1, strftime("%Y-%m-%d %H:%M:%S"), location_name, station_id)
        else:
            return Data(result_map2, strftime("%Y-%m-%d %H:%M:%S"), location_name, station_id)


class PMParser(Parser):

    def parse_data(self, xml_data, station_id, selected_wios, wios_mapping):
        root = etree.fromstring(xml_data)
        start_date = datetime.datetime.fromtimestamp(int(root.attrib['start_date']))
        xpath_station = './/station[@name="{station}"]/.'.format(station=station_id)
        station_data_element = root.findall(xpath_station)[0]
        location_name = station_data_element.attrib['localisation']
        result_map = {}  # empty map
        for substance in station_data_element:
            substance_type = substance.attrib['type']
            substance_values = substance.text.split('|')
            for index, element in reversed(list(enumerate(substance_values))):
                if element != '-999':
                    hour = start_date + datetime.timedelta(hours=index)
                    result_map[substance_type] = DataEntry('µg/m3', "", hour.strftime('%H'), str(element))
                    break
        return Data(result_map, strftime("%Y-%m-%d %H:%M:%S"), location_name, station_id)


class PLParser(Parser):

    SUBSTANCE_AND_UNIT_REGEXP = re.compile(r'(\w*).*\[(.*)\]')

    def parse_data(self, page, station_id, selected_wios, wios_mapping):
        tree = html.fromstring(page)
        location_name = self.load_location(selected_wios, station_id)
        xpath_data = wios_mapping.get(selected_wios, 'parsers.xpath.data_row')
        xpath_label = wios_mapping.get(selected_wios, 'parsers.xpath.label_row')
        data_cols = tree.xpath(xpath_data)
        labels_cols = tree.xpath(xpath_label)
        result_map = {}  # empty map
        hour = strptime(data_cols[0], '%d.%m.%y\xa0\xa0\xa0%H:%M').tm_hour
        for index, data_cell in enumerate(data_cols[1:]):
            label = self.stringify_children(labels_cols[index+1])
            matcher = self.SUBSTANCE_AND_UNIT_REGEXP.match(label)
            substance_type = matcher.group(1)
            unit = matcher.group(2) # removing first character
            result_map[substance_type] = DataEntry(unit, "", hour, str(data_cell.replace(',', '.')))
        return Data(result_map, strftime("%Y-%m-%d %H:%M:%S"), location_name, station_id)

class LDParser(Parser):

    SUBSTANCE_AND_UNIT_REGEXP = re.compile(r'([\S\w]+)\[(.+)\]')

    def parse_data(self, page, station_id, selected_wios, wios_mapping):
        xpath_labels = wios_mapping.get(selected_wios, 'parsers.xpath.label_row')
        xpath_data = wios_mapping.get(selected_wios, 'parsers.xpath.data_row')
        location_name = self.load_location('LD', station_id)
        tree = html.fromstring(page)
        labels_cols = tree.xpath(xpath_labels)
        data_cols = tree.xpath(xpath_data)
        result_map = {}  # empty map
        hour = strptime(data_cols[0].xpath('span/b')[0].text, '%y.%m.%d %H:%M').tm_hour
        for index, data_cell in enumerate(data_cols[1:]):
            matcher = self.SUBSTANCE_AND_UNIT_REGEXP.match(labels_cols[index+1].text)
            substance_type = matcher.group(1).replace('\u00c2', '').strip()
            unit = matcher.group(2)[1:]  # removing first character
            try :
                value = data_cell.text.strip()
                result_map[substance_type] = DataEntry(unit, "", hour, str(value))
            except ValueError:
                value = None
        return Data(result_map, strftime("%Y-%m-%d %H:%M:%S"), location_name, station_id)


class MPParser(Parser):

    def parse_data(self, page, station_id, selected_wios, wios_mapping):
        # page is json
        json_data = json.loads(page)
        location_name = self.load_location(selected_wios, station_id)
        result_map = {}  # empty map
        series = json_data['data']['series']
        for serie in series:
            try:
                substance_type = serie['paramId'].upper()
                value = serie['data'][-1][1]
                hour = datetime.datetime.fromtimestamp(int(serie['data'][-1][0])).strftime('%H')
                unit = serie['unit']
                result_map[substance_type] = DataEntry(unit, "", hour, str(value))
            except IndexError:
                #value = serie['data'][-1][1] throws IndexError when no data for given substance, ignoring
                pass
        return Data(result_map, strftime("%Y-%m-%d %H:%M:%S"), location_name, station_id)


class SLParser(Parser):

    KEY_REGEXP = re.compile(r'.*\((.+)\).*')
    PARAMETER_COLUMN = 0
    UNIT_COLUMN = 1
    MAXIMUM_FOR_GIVEN_UNIT_COLUMN = 2

    def __init__(self):
        pass

    def extract_key(self, row_data):
        match = self.KEY_REGEXP.match(row_data)
        if match == None:
            return None
        else:
            return match.group(1)

    def parse_data(self, page, station_id, selected_wios, wios_mapping):
        xpath_rows = wios_mapping.get(selected_wios, 'xpath.rows')
        tree = html.fromstring(page)
        location_name = self.load_location('SL', station_id)
        rows = tree.xpath(xpath_rows)

        result_map = {}  # empty map
        for row in rows[2:]:
            key = self.extract_key(row[self.PARAMETER_COLUMN].text_content())
            if (key != None):
                unit = row[self.UNIT_COLUMN].text_content().strip()
                maxvalue = row[self.MAXIMUM_FOR_GIVEN_UNIT_COLUMN].text_content().strip()
                if maxvalue == '-':
                    maxvalue = ''
                striped_row = [i.text_content() for i in row[3:-1]]  # omit header elements and get plain numbers
                last_val_index = self.extract_last_value(striped_row)
                if last_val_index is not None:
                    hour = self.HOURS[last_val_index]
                    value = striped_row[last_val_index].strip()
                    result_map[key] = DataEntry(unit, maxvalue, hour, str(value))
        return Data(result_map, strftime("%Y-%m-%d %H:%M:%S"), location_name, station_id)

PARSER_MAPPING = {
    'DS': MPParser,
    'KP': ColumnBasedParser,
    'LB': ColumnBasedParser,
    'LS': RowBasedParser,
    'LD': LDParser,
    'MP': MPParser,
    'MZ': ColumnBasedParser,
    'OP': RowBasedParser,
    'PK': PKParser,
    'PM': PMParser,
    'PL': PLParser,
    'SL': SLParser,
    'SK': ColumnBasedParser,
    'WM': WMParser,
    'WP': MPParser,
    'ZP': RowBasedParser,
    }


class ParserFactory:
    def __init__(self):
        pass

    @staticmethod
    def get(wios_id):
        return PARSER_MAPPING[wios_id]()